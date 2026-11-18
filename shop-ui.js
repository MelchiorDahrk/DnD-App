import {EQUIPMENT,EQUIPMENT_GROUPS} from './catalog.js';
import {filterEquipment,statPreview} from './catalog-ui.js';
import {COINS,uid} from './model.js';
import {itemIconMarkup} from './item-icons.js';
import {icon} from './icons.js';
import {effectiveDM} from './party-model.js';
import {sound} from './sound.js';
import {
  STORE_TYPES,STORE_LIMIT,PRICE_LIMIT,MAGIC_RARITIES,MAGIC_TYPES,newShop,defaultMerchandise,
  merchandiseEntry,merchandiseLine,randomMerchandise,quoteSale,purchasePrice,formatPrice,walletTotal
} from './shop-model.js';

export function createShopUI(ui) {
  const {esc,btn,field,actions,setModal,modal,toast,getState}=ui;
  let view=null,stop=()=>{},busy=false;
  const canManage=()=>!!ui.party()&&effectiveDM(ui.party())===ui.user()?.uid;
  const settings=()=>getState().settings;
  const scope=()=>[ui.user()?.uid,ui.party()?.id,canManage()].join('/');
  const root=()=>modal.open?modal.querySelector('[data-shop-view]'):null;
  const put=(selector,markup)=>{const host=root()?.querySelector(selector);if(host)host.innerHTML=markup;};
  const clean=()=>{stop();stop=()=>{};view=null;};
  const action=(name,label,style='btn',attrs='')=>btn('party-shop-'+name,label,style,attrs);
  const option=(value,label=value,selected=false)=>`<option value="${esc(value)}" ${selected?'selected':''}>${esc(label)}</option>`;
  const select=(label,name,options)=>`<label class="form-field">${label}<select name="${name}">${options}</select></label>`;
  const number=(label,name,value,min,max,required=false)=>field(label,name,value??'','number',`min="${min}" max="${max}" step="1" ${required?'required':''}`);
  const dataId=id=>`data-id="${esc(id)}"`;
  const status=text=>`<p class="shop-message" role="status">${esc(text)}</p>`;
  const pendingSlot='<div data-shop-pending></div>';
  const feedbackSlot='<p class="shop-feedback" data-shop-feedback role="status"></p>';
  const back=()=>action('list',icon('chevron')+'All stores','btn btn-ghost');
  const checkManage=()=>{if(!canManage())throw new Error('Only the Dungeon Master can manage stores.');};

  function show(kind,title,markup,state={},submit=null) {
    clean();
    view={kind,scope:scope(),...state};
    setModal(esc(title),`<section class="shop-view" data-shop-view="${kind}">${markup}</section>`,submit);
    return view;
  }
  function failure(error) {
    return error.code==='permission-denied'?'Store access is unavailable. The DM may have closed the store, or Firestore rules may need an update.':error.message;
  }
  async function run(work) {
    if(busy)return;
    busy=true;
    const active=view,formError=root()?modal.querySelector('#form-error'):null;
    if(formError)formError.hidden=true;
    try{await work();}
    catch(error){
      if(view===active&&root()&&formError){
        formError.className='form-error';
        formError.textContent=failure(error);
        formError.hidden=false;
        formError.scrollIntoView({block:'nearest',behavior:'instant'});
        sound.play('ui.error');
      }else toast(failure(error),true);
    }finally{busy=false;}
  }
  function feedback(message) {
    const host=root()?.querySelector('[data-shop-feedback]');
    if(host)host.textContent=message;
    else toast(message);
  }
  const pendingPrefix=()=>`questlog.shop.${ui.user()?.uid}.`;
  function pendingOrders() {
    const prefix=pendingPrefix(),orders=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key?.startsWith(prefix))continue;
      try{
        const order=JSON.parse(localStorage.getItem(key));
        if(order?.partyId===ui.party()?.id)orders.push(order);
      }catch{/* A damaged local receipt cannot be retried. */}
    }
    return orders;
  }
  function renderPending() {
    const orders=pendingOrders();
    put('[data-shop-pending]',orders.map(order=>`<div class="shop-pending"><span>Check pending ${order.kind==='sell'?'sale':'purchase'} for ${esc(order.label)}.</span>${action('retry','Resolve trade','btn btn-sm',dataId(order.id))}</div>`).join(''));
  }
  function showList() {
    const party=ui.party();
    if(!party)throw new Error('Join a party to browse its stores.');
    const manage=canManage();
    const active=show('list','Town stores',`<div class="shop-toolbar"><span>${esc(party.name)}</span>${manage?action('new',icon('plus')+'Create store','btn btn-primary'):''}</div>${feedbackSlot}${pendingSlot}<div data-shop-list>${status('Finding stores…')}</div>`,{shops:[]});
    renderPending();
    stop=ui.store().watchShops(party.id,manage,shops=>{
      if(view!==active||!root())return;
      active.shops=shops;
      put('[data-shop-list]',shops.sort((a,b)=>a.name.localeCompare(b.name)).map(shop=>`<article class="shop-list-row"><div><h3>${esc(shop.name)}</h3><small>${esc(STORE_TYPES[shop.type]?.name||shop.type)}${shop.open?'':' · Closed'}</small>${shop.description?`<p>${esc(shop.description)}</p>`:''}</div><div class="shop-controls">${shop.open?action('browse','Browse','btn btn-sm',dataId(shop.id)):''}${manage?action('edit','Edit','btn btn-sm',dataId(shop.id)):''}</div></article>`).join('')||status(manage?'Create a store and open it when the inventory is ready.':'No stores are open.'));
    },error=>{if(view===active)put('[data-shop-list]',status(failure(error)));});
  }
  function characters() {
    const shared=new Set(ui.party()?.characters.filter(c=>c.ownerId===ui.user()?.uid).map(c=>c.characterId));
    return getState().characters.filter(c=>shared.has(c.id));
  }
  function browserControls() {
    const people=characters(),activeId=view.characterId||getState().activeId;
    if(!people.some(c=>c.id===activeId))view.characterId=people[0]?.id;
    else view.characterId=activeId;
    return people.length?select('Shopping as','shopCharacter',people.map(c=>option(c.id,c.name,c.id===view.characterId)).join('')):status('Share a character with this party to buy or sell.');
  }
  function walletMarkup(character) {
    return character?`<div class="shop-wallet">${icon('coin')}<span>${Object.entries(COINS).map(([coin,label])=>`${esc(character[coin]||0)} ${label}`).join(' · ')}</span><strong>${esc(formatPrice(walletTotal(character)))} total</strong></div>`:'';
  }
  function showShop(id,mode='buy',characterId='') {
    const active=show('browse','Storefront',`<div class="shop-toolbar">${back()}<div data-shop-character></div></div><div data-shop-wallet></div><div class="shop-banner" data-shop-banner>${status('Opening store…')}</div>${feedbackSlot}${pendingSlot}<div class="shop-toolbar"><div class="shop-controls" aria-label="Trade mode" data-shop-tabs></div>${field('Search merchandise','shopSearch','','search','autocomplete="off"')}</div><div data-shop-merchandise></div>`,{id,mode,characterId});
    put('[data-shop-character]',browserControls());
    renderPending();
    stop=ui.store().watchShop(ui.party().id,id,shop=>{
      if(view!==active||!root())return;
      if(!shop?.open){active.shop=null;put('[data-shop-banner]',status('This store is closed.'));put('[data-shop-merchandise]','');return;}
      active.shop=shop;
      modal.querySelector('#modal-title').textContent=shop.name;
      put('[data-shop-banner]',`<strong>${esc(STORE_TYPES[shop.type]?.name||shop.type)}</strong>${shop.description?`<p>${esc(shop.description)}</p>`:''}`);
      renderBrowse();
    },error=>{
      if(view!==active)return;
      active.shop=null;
      put('[data-shop-banner]',status(failure(error)));
      put('[data-shop-merchandise]','');
    });
  }
  function renderBrowse() {
    const shop=view?.shop;
    if(!shop||!root())return;
    const character=characters().find(c=>c.id===view.characterId);
    put('[data-shop-wallet]',walletMarkup(character));
    put('[data-shop-tabs]',['buy','sell'].map(mode=>action('mode',mode==='buy'?'Buy':'Sell','btn btn-sm'+(mode===view.mode?' btn-primary':''),`data-mode="${mode}" aria-pressed="${mode===view.mode}"`)).join(''));
    const query=root().querySelector('[name="shopSearch"]')?.value.trim().toLowerCase()||'';
    const selling=view.mode==='sell';
    const rows=selling?(character?.items||[]).filter(item=>item.qty).map(entry=>{
      const quote=quoteSale(shop,character,entry);
      return {id:entry.id,entry,price:quote.unitCp,stock:entry.qty,info:quote.error};
    }):Object.entries(shop.items).map(([id,line])=>({id,entry:merchandiseEntry(line),price:line.priceCp,stock:line.stock}));
    const visible=rows.filter(({entry})=>entry&&`${entry.name} ${entry.group||entry.category} ${entry.rarity||''}`.toLowerCase().includes(query))
      .sort((a,b)=>a.entry.name.localeCompare(b.entry.name));
    put('[data-shop-merchandise]',visible.map(({id,entry,price,stock,info})=>`<article class="shop-item"><div class="shop-item-art">${itemIconMarkup(entry)}</div><div class="shop-item-text"><strong>${esc(entry.name)}</strong><small>${esc(entry.group||entry.category)}${entry.magic?' · '+esc(entry.rarity):''}</small>${info?`<small>${esc(info)}</small>`:''}</div><div class="shop-item-price"><strong>${esc(info?'—':formatPrice(price))}</strong><span class="badge" ${stock===null?'aria-label="Unlimited stock"':''}>${stock===null?'∞':stock===0?'Sold Out':esc(stock)+' available'}</span></div>${action('detail',selling?'Sell…':'View','btn btn-sm',dataId(id)+(selling&&info?' disabled':''))}</article>`).join('')||status(selling?'No matching items in this character’s pack.':'No matching merchandise.'));
  }
  function showDetails(id) {
    const {shop,mode,characterId}=view,character=characters().find(c=>c.id===characterId);
    if(!shop?.open)throw new Error('This store is closed.');
    const selling=mode==='sell',line=selling?null:shop.items[id];
    const entry=selling?character?.items.find(i=>i.id===id):merchandiseEntry(line);
    if(!entry)return;
    const price=selling?quoteSale(shop,character,entry).unitCp:line.priceCp;
    const stock=selling?entry.qty:line.stock;
    const preview=entry.cost&&entry.wiki?statPreview(entry,'item'):
      `<div class="catalog-item-art">${itemIconMarkup(entry)}</div><strong>${esc(entry.category)} · ${esc(entry.weight)} lb. each</strong><p class="catalog-rules">${esc(entry.details||entry.description||'')}</p>`;
    const possible=character&&price>0&&(stock===null||stock>0);
    const active=show('detail',entry.name,`<div class="shop-toolbar">${action('back','Back to '+esc(shop.name),'btn btn-ghost')}<strong>${esc(formatPrice(price))} each</strong></div>${walletMarkup(character)}<div class="catalog-preview shop-preview">${preview}</div>${pendingSlot}${
      possible?`<div class="shop-toolbar">${number('Quantity','shopQuantity',1,1,stock??99999,true)}<output data-shop-total aria-live="polite">${esc(formatPrice(price))}</output></div><div class="modal-actions"><button type="submit" class="btn btn-primary">${selling?'Confirm sale':'Confirm purchase'}</button></div>`
        :status(stock===0?'Sold Out':!character?'Share a character to make a purchase.':'The DM needs to set a price for this item.')
    }`,{id:shop.id,mode,characterId,price},data=>run(async()=>{
      if(pendingOrders().some(order=>order.storeId===shop.id&&order.characterId===characterId&&order.kind===mode&&order.itemId===id))throw new Error('Resolve the pending trade for this item first.');
      await trade({partyId:ui.party().id,storeId:shop.id,characterId,id:uid(),kind:mode,itemId:id,quantity:Number(data.get('shopQuantity')),expectedUnitCp:price,label:entry.name},active);
    }));
    renderPending();
  }
  async function trade(order,active) {
    const store=ui.store(),account=ui.user()?.uid,key=pendingPrefix()+order.id;
    await ui.ready();
    if(ui.user()?.uid!==account||ui.party()?.id!==order.partyId)throw new Error('Reopen the store in the correct party.');
    localStorage.setItem(key,JSON.stringify(order));
    try{await store.shopOrder(order);}
    catch(error){
      if(!['aborted','cancelled','deadline-exceeded','internal','unknown','unavailable'].includes(error.code))localStorage.removeItem(key);
      if(view===active)renderPending();
      throw error;
    }
    localStorage.removeItem(key);
    if(ui.user()?.uid!==account)return;
    if(order.kind==='buy')sound.play('item.acquire');
    let message=order.kind==='buy'?'Purchase complete. Added to your pack.':'Sale complete. Coins added to your purse.';
    try{await ui.refreshCharacter(order.characterId);}catch{message+=' Your sheet will update when synchronization resumes.';}
    if(view===active&&root()){
      if(active.kind==='list')renderPending();
      else showShop(order.storeId,order.kind,order.characterId);
    }
    feedback(message);
  }
  function showEditor(shop) {
    checkManage();
    const draft=shop?structuredClone(shop):newShop('general',settings());
    const active=show('edit',shop?'Edit store':'Create store',`<div class="shop-toolbar">${back()}${shop?action('delete','Delete store','btn btn-danger'):''}</div>
      <div class="form-grid">${field('Store name','shopName',draft.name,'text','required maxlength="100" autofocus')}${select('Store type','shopType',Object.entries(STORE_TYPES).map(([key,type])=>option(key,type.name,key===draft.type)).join(''))}
      <label class="form-field full">Description <textarea name="shopDescription" maxlength="2000" rows="2">${esc(draft.description)}</textarea></label>
      ${number('Price multiplier (%)','multiplier',draft.multiplier,1,1000,true)}${number('Resale rate (%)','buyRate',draft.buyRate,0,100,true)}</div>
      <p class="form-help">Trade goods and treasure sell at full value. Overrides are final prices per catalog unit, in copper.</p>
      <label class="check-field"><input type="checkbox" name="acceptAll" ${draft.acceptAll?'checked':''}>Buy merchandise outside this store’s categories</label>
      <label class="check-field"><input type="checkbox" name="shopOpen" ${draft.open?'checked':''}>Open to party members after saving</label>
      <details class="shop-editor-tool"><summary>Add from catalog</summary><div class="form-grid">${field('Search catalog','catalogSearch','','search','autocomplete="off"')}${select('Category','catalogGroup',option('All')+EQUIPMENT_GROUPS.map(group=>option(group)).join(''))}</div><div data-shop-catalog></div></details>
      <details class="shop-editor-tool"><summary>Add Random Magic Items</summary><div class="form-grid">${select('Rarity','magicRarity',MAGIC_RARITIES.map(rarity=>option(rarity)).join(''))}${select('Item type','magicType',Object.keys(MAGIC_TYPES).map(type=>option(type)).join(''))}${number('Different items','magicCount',3,1,STORE_LIMIT)}</div>${action('random','Add Random Magic Items','btn btn-sm')}${feedbackSlot}</details>
      <details class="shop-editor-tool"><summary>Add custom merchandise</summary><div class="form-grid">${field('Custom item name','customName','','text','maxlength="200"')}${select('Category','customCategory',['Gear','Armor','Consumable','Treasure','Weapon'].map(type=>option(type)).join(''))}${field('Weight each (lb.)','customWeight',0,'number','min="0" max="99999" step="any"')}<label class="form-field full">Item description <textarea name="customDetails" maxlength="2000" rows="2"></textarea></label></div>${action('custom','Add custom item','btn btn-sm')}</details>
      <div class="shop-toolbar shop-inventory-heading"><h3>Merchandise</h3>${action('defaults','Restore default inventory','btn btn-sm')}</div><p class="form-help">Leave stock blank for ∞. Set it to 0 to mark an item Sold Out. Items with variable or compound prices need a DM price.</p>
      <div data-shop-editor-items></div>${actions('Save store','','party-shop-list')}`,{id:shop?.id||uid(),revision:shop?.revision||0,draft,autoDefaults:!shop},()=>run(async()=>{
      checkManage();readEditor();
      await ui.store().saveShop(ui.party().id,active.id,draft,active.revision);
      if(view===active&&root())showList();
      feedback(draft.open?'Store saved and open.':'Store saved as closed.');
    }));
    renderEditorItems();renderCatalog();
  }
  function readEditor() {
    const {draft}=view,form=modal.querySelector('form'),data=new FormData(form);
    Object.assign(draft,{name:String(data.get('shopName')),description:String(data.get('shopDescription')),type:String(data.get('shopType')),
      multiplier:Number(data.get('multiplier')),buyRate:Number(data.get('buyRate')),acceptAll:data.has('acceptAll'),open:data.has('shopOpen')});
    for(const field of form.querySelectorAll('[data-shop-line]')){
      const {id,key}=field.dataset;
      draft.items[id][key]=field.value===''?null:field.valueAsNumber;
    }
  }
  function renderEditorItems() {
    const {draft}=view;
    put('[data-shop-editor-items]',Object.entries(draft.items).map(([id,line])=>{
      const entry=merchandiseEntry(line);
      const attrs=(key,max,min)=>`data-shop-line data-id="${esc(id)}" data-key="${key}" min="${min}" max="${max}" step="1" aria-label="${esc(entry?.name||id)} ${key==='stock'?'stock':key==='priceOverride'?'purchase price':'resale price'}"`;
      return `<article class="shop-edit-item"><div class="shop-item-art">${entry?itemIconMarkup(entry):icon('bag')}</div><div class="shop-item-text"><strong>${esc(entry?.name||id)}</strong><small>${esc(entry?.cost||'Custom item')}${entry?.magic?' · '+esc(entry.rarity):''}</small></div>${action('remove',icon('trash'),'icon-btn',dataId(id)+` aria-label="Remove ${esc(entry?.name||id)}"`)}<div class="shop-edit-values">
        ${field('Buy price (cp)','',line.priceOverride??'','number',attrs('priceOverride',PRICE_LIMIT,1))}${field('Resale (cp)','',line.sellOverride??'','number',attrs('sellOverride',PRICE_LIMIT,1))}${field('Stock','',line.stock??'','number',attrs('stock',99999,0)+' placeholder="∞"')}
        <small data-shop-line-quote="${esc(id)}">${esc(formatPrice(purchasePrice(entry,line,draft.multiplier)))}</small></div></article>`;
    }).join('')||status('Add merchandise for this store.'));
  }
  function renderCatalog() {
    const form=modal.querySelector('form'),query=form.elements.catalogSearch.value,group=form.elements.catalogGroup.value;
    const matches=filterEquipment(EQUIPMENT,{query,group,settings:settings()}).filter(item=>!Object.hasOwn(view.draft.items,item.id));
    put('[data-shop-catalog]',matches.slice(0,40).map(entry=>`<div class="shop-catalog-row"><div class="shop-item-art">${itemIconMarkup(entry)}</div><span><strong>${esc(entry.name)}</strong><small>${esc(entry.group)} · ${esc(entry.cost)}</small></span>${action('add','Add','btn btn-sm',dataId(entry.id)+` aria-label="Add ${esc(entry.name)}"`)}</div>`).join('')
      +(matches.length>40?status(`Showing 40 of ${matches.length}. Search to narrow the list.`):matches.length?'':status('No matching catalog items.')));
  }
  function editMerchandise(edit) {
    checkManage();readEditor();
    edit(view.draft.items,modal.querySelector('form').elements);
    view.autoDefaults=false;
    renderEditorItems();renderCatalog();
  }
  function addLine(items,entry,line=merchandiseLine(entry)){
    if(Object.keys(items).length>=STORE_LIMIT)throw new Error(`A store can list at most ${STORE_LIMIT} items.`);
    items[entry.id]=line;
  }
  function handle(name,element) {
    if(name!=='party-stores'&&!name.startsWith('party-shop-'))return false;
    run(async()=>{
      if(name==='party-stores'||name==='party-shop-list'){showList();return;}
      if(!view||!root()||view.scope!==scope())throw new Error('Reopen Stores to continue.');
      const id=element.dataset.id;
      switch(name){
        case 'party-shop-new':showEditor();break;
        case 'party-shop-edit':{const shop=view.shops.find(s=>s.id===id);if(shop)showEditor(shop);break;}
        case 'party-shop-browse':showShop(id);break;
        case 'party-shop-back':showShop(view.id,view.mode,view.characterId);break;
        case 'party-shop-mode':{view.mode=element.dataset.mode;renderBrowse();root().querySelector(`[data-mode="${view.mode}"]`)?.focus();break;}
        case 'party-shop-detail':showDetails(id);break;
        case 'party-shop-retry':{const order=pendingOrders().find(o=>o.id===id);if(order)await trade(order,view);break;}
        case 'party-shop-defaults':editMerchandise(items=>{for(const key of Object.keys(items))delete items[key];Object.assign(items,defaultMerchandise(view.draft.type,settings()));});break;
        case 'party-shop-remove':editMerchandise(items=>delete items[id]);break;
        case 'party-shop-add':editMerchandise(items=>{const entry=EQUIPMENT.find(i=>i.id===id);if(entry&&!Object.hasOwn(items,id))addLine(items,entry);});break;
        case 'party-shop-random':editMerchandise((items,fields)=>{
          const count=Number(fields.magicCount.value);
          const entries=randomMerchandise({rarity:fields.magicRarity.value,type:fields.magicType.value,count},items,settings());
          entries.forEach(entry=>addLine(items,entry));
          feedback(entries.length===count?`Added ${count} magic items.`:entries.length?`Added ${entries.length} matching magic items.`:'No additional items match that rarity and type.');
        });break;
        case 'party-shop-custom':editMerchandise((items,fields)=>{
          const name=fields.customName.value.trim();
          if(!name||!fields.customWeight.checkValidity())throw new Error('Enter a name and valid weight for the custom item.');
          const entry={id:'custom-'+uid(),name,category:fields.customCategory.value,weight:Number(fields.customWeight.value),details:fields.customDetails.value};
          addLine(items,entry,{...merchandiseLine(entry),custom:entry});
          fields.customName.value='';fields.customDetails.value='';
        });break;
        case 'party-shop-delete':{
          checkManage();
          const {id,draft}=view,partyId=ui.party().id;
          const active=show('delete','Delete store?',`<p>Remove ${esc(draft.name)} from this party?</p>${actions('Delete store','','party-shop-list')}`,{},()=>run(async()=>{
            checkManage();await ui.store().deleteShop(partyId,id);if(view===active&&root())showList();feedback('Store deleted.');
          }));
          break;
        }
      }
    });
    return true;
  }
  function mount() {
    if(!view)return;
    if(!root()){clean();return;}
    if(view.scope!==scope()){
      if(ui.party()&&ui.user()&&view.scope.split('/').slice(0,2).join('/')===scope().split('/').slice(0,2).join('/'))showList();
      else{clean();modal.close();}
      return;
    }
    if(view.kind==='browse'){
      const people=characters(),control=root().querySelector('[name="shopCharacter"]');
      if((control?.options.length||0)!==people.length||people.some((c,i)=>control?.options[i]?.value!==c.id||control?.options[i]?.text!==c.name))put('[data-shop-character]',browserControls());
      const current=people.find(c=>c.id===view.characterId);
      if(view.character!==current){view.character=current;renderBrowse();}
    }
  }
  modal.addEventListener('close',()=>{if(!modal.open)clean();});
  modal.addEventListener('input',event=>{
    if(!root()||!view)return;
    const field=event.target;
    if(field.name==='shopSearch')renderBrowse();
    if(field.name==='catalogSearch')renderCatalog();
    if(field.name==='shopQuantity')put('[data-shop-total]',esc(formatPrice(view.price*(field.valueAsNumber||0))));
    if(field.hasAttribute('data-shop-line')||field.name==='multiplier'){
      if(field.hasAttribute('data-shop-line'))view.autoDefaults=false;
      readEditor();
      for(const quote of root().querySelectorAll('[data-shop-line-quote]')){
        const line=view.draft.items[quote.dataset.shopLineQuote];
        quote.textContent=formatPrice(purchasePrice(merchandiseEntry(line),line,view.draft.multiplier));
      }
    }
  });
  modal.addEventListener('change',event=>{
    if(!root()||!view)return;
    const field=event.target;
    if(field.name==='shopCharacter'){view.characterId=field.value;renderBrowse();}
    if(field.name==='catalogGroup')renderCatalog();
    if(field.name==='shopType'){
      readEditor();
      if(view.autoDefaults){view.draft.items=defaultMerchandise(field.value,settings());renderEditorItems();renderCatalog();}
    }
  });
  return {handle,mount};
}
