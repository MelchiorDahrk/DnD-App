import {EQUIPMENT,MAGIC_ITEMS,MAGIC_ITEM_VERSIONS,MAGIC_VARIANT_EQUIPMENT,findEquipment,itemFromEquipment} from './catalog.js';
import {readCoinPrice} from './magic-item-prices.js';
import {contentEnabled} from './content-sources.js';
import {defaultItemUses,equipmentName,itemUses} from './inventory-rules.js';
import {linkWeaponActions,sameStack} from './inventory.js';
import {reserveTransfer} from './party-model.js';
import {uid} from './model.js';

export const STORE_LIMIT=100;
export const PRICE_LIMIT=100000000;
const STOCK_LIMIT=99999;
const COIN_VALUES={platinum:1000,gold:100,electrum:50,silver:10,copper:1};
export const SHOP_EQUIPMENT=[...EQUIPMENT,...MAGIC_VARIANT_EQUIPMENT];
const itemKey=item=>item.category+'/'+equipmentName(item.name);
const catalogNames=new Map([...SHOP_EQUIPMENT].reverse().map(entry=>[itemKey(entry),entry]));
const inGroups=(...groups)=>entry=>groups.includes(entry.group);
const hasId=(...ids)=>entry=>ids.includes(entry.id);
const adventuring=inGroups('Adventuring gear','Equipment packs','Ammunition');
const focus=inGroups('Spellcasting focuses');
const armor=inGroups('Armor & shields');
const mount=inGroups('Mounts','Tack & drawn vehicles');
const supplies=hasId('acid','alchemists-fire','antitoxin','alchemists-supplies','herbalism-kit','poisoners-kit','poison-basic','vial','bottle-glass','perfume');
const scribe=hasId('book','map','ink','ink-pen','paper','parchment','case-map-or-scroll','spellbook','spell-scroll-cantrip','spell-scroll-level-1','calligraphers-supplies','cartographers-tools');
const trail=hasId('backpack','bedroll','blanket','climbers-kit','clothes-travelers','crowbar','grappling-hook','healers-kit','hunting-trap','lantern-hooded','map','oil','rations','rope','shovel','tent','tinderbox','torch','waterskin','explorers-pack','arrows','bolts');
const precious=entry=>inGroups('Gemstones','Trade bars')(entry)
  ||entry.group==='Trade goods'&&/^(Silver|Gold|Platinum) \(/.test(entry.name)
  ||entry.group==='Art objects & jewelry'&&/\b(bracelet|ring|necklace|pendant|locket|brooch|circlet|anklet|crown|chain)\b/i.test(entry.name);
const melee=entry=>entry.group==='Weapons'&&entry.family.endsWith('melee');
const smith=entry=>melee(entry)||(armor(entry)&&!hasId('padded-armor','leather-armor','hide-armor')(entry))
  ||hasId('spikes-iron','chain','smiths-tools','iron-1-lb')(entry);
const arcane=entry=>focus(entry)||entry.itemType==='Scroll'||['Wand','Staff','Rod'].includes(entry.itemType)
  ||hasId('component-pouch','spellbook','spell-scroll-cantrip','spell-scroll-level-1')(entry);
const isPotion=entry=>entry.itemType==='Potion';
const isScroll=entry=>entry.itemType==='Scroll';
const everyday=hasId('backpack','bedroll','blanket','bucket','candle','chest','clothes-travelers','flask','healers-kit','lamp','oil','pouch','rations','rope','sack','tinderbox','torch','waterskin');
const rareOrUnique=entry=>entry.unique||entry.artifact||/\b(artifact|unique)\b/i.test(entry.rarity||'');

// Each type supplies its own sale policy and curated starting stock.
const template=(name,accept,defaults=accept,limit=24)=>({name,accept,defaults,limit});
export const STORE_TYPES={
  general:template('General Store',entry=>adventuring(entry)&&entry.category!=='Consumable'||everyday(entry),everyday),
  blacksmith:template('Blacksmith',smith,entry=>melee(entry)&&!hasId('club','greatclub','quarterstaff','whip')(entry)||hasId('shield','spikes-iron','chain','smiths-tools','iron-1-lb')(entry),32),
  armorer:template('Armorer',armor),
  alchemist:template('Alchemist',entry=>supplies(entry)||isPotion(entry),entry=>supplies(entry)||hasId('potion-of-healing','magic-potion-of-greater-healing','magic-potion-of-climbing')(entry)),
  arcane:template('Arcane Shop',arcane,entry=>arcane(entry)&&!entry.magic||hasId('magic-spell-scroll','magic-wand-of-magic-detection')(entry)),
  scribe:template('Scribe / Bookshop',entry=>scribe(entry)||isScroll(entry),entry=>scribe(entry)||entry.id==='magic-spell-scroll'),
  jeweler:template('Jeweler',precious,entry=>precious(entry)&&(entry.group!=='Gemstones'||(parsePrice(entry.cost)??Infinity)<=1000),35),
  stables:template('Stables',mount),
  outfitter:template('Adventuring Outfitter',entry=>adventuring(entry)&&entry.category!=='Consumable'||trail(entry),trail),
  magic:template('Magic Item Dealer',entry=>!!entry.magic,hasId('potion-of-healing','magic-potion-of-greater-healing','magic-bag-of-holding','magic-cloak-of-protection','magic-driftglobe','magic-immovable-rod','magic-rope-of-climbing','magic-wand-of-secrets'))
};

export const MAGIC_RARITIES=['Common','Uncommon','Rare','Very Rare','Legendary'];
export const MAGIC_TYPES={
  Any:[],Weapons:['Weapon'],'Armor / Shields':['Armor'],Potions:['Potion'],Scrolls:['Scroll'],
  Rings:['Ring'],'Wands / Staves / Rods':['Wand','Staff','Rod'],'Wondrous Items':['Wondrous Item']
};
const magicWeaponBase=entry=>entry.typeDetails?.match(/^Weapon\s*\(([^)]+)\)/i)?.[1]||'';
const smithMagic=entry=>{
  if(entry.itemType==='Armor')return true;
  if(entry.itemType!=='Weapon'||/^Ammunition\b/i.test(entry.typeDetails||''))return false;
  const base=magicWeaponBase(entry);
  if(/\bammunition\b/i.test(base)&&!/\bmelee\b/i.test(base))return false;
  return !/\b(?:bow|crossbow|longbow|shortbow|sling|blowgun|musket|pistol)\b/i.test(base);
};
const wondrous=namePattern=>entry=>entry.itemType==='Wondrous Item'&&namePattern.test(entry.name);
const stockMagic={
  general:wondrous(/\b(?:bag|broom|candle|jug|lamp|lantern|pouch|rope|sack)\b/i),
  blacksmith:smithMagic,
  armorer:entry=>entry.itemType==='Armor',
  alchemist:isPotion,
  arcane,
  scribe:entry=>isScroll(entry)||wondrous(/\b(?:book|spellbook|tome|manual|lexicon|grimoire|quill|ink)\b/i)(entry),
  jeweler:entry=>entry.itemType==='Ring'||wondrous(/\b(?:amulet|bracelet|brooch|circlet|crown|gem|necklace|pearl|pendant|talisman)\b/i)(entry),
  stables:wondrous(/\b(?:saddle|horseshoes|reins)\b/i),
  outfitter:wondrous(/\b(?:backpack|bag|bedroll|boots|cloak|compass|lantern|quiver|rope|tent)\b/i),
  magic:()=>true
};
export const matchesShopMagic=(entry,storeType)=>Object.hasOwn(stockMagic,storeType)&&stockMagic[storeType](entry);
export function parsePrice(value) {
  const copper=readCoinPrice(value);
  return copper!==null&&copper<=PRICE_LIMIT?copper:null;
}
export function formatPrice(copper) {
  if(copper==null)return 'Price pending';
  // Quote in gold, silver, and copper to keep storefront prices easy to compare.
  const gold=Math.floor(copper/100),silver=Math.floor(copper%100/10),rest=copper%10;
  return [gold&&gold.toLocaleString()+' gp',silver&&silver+' sp',rest&&rest+' cp'].filter(Boolean).join(' ')||'0 cp';
}
export function walletTotal(character) {
  return Object.entries(COIN_VALUES).reduce((total,[coin,value])=>total+(character[coin]||0)*value,0);
}
function credit(change,amount) {
  for(const [coin,value] of Object.entries(COIN_VALUES)){
    const count=Math.min(Math.floor(amount/value),100000000-(change[coin]||0));
    change[coin]=(change[coin]||0)+count;
    amount-=count*value;
  }
  if(amount)throw new Error('This transaction would exceed your coin limits.');
}
function walletChange(character,amount) {
  const coins=Object.keys(COIN_VALUES),wallet=Object.fromEntries(coins.map(coin=>[coin,character[coin]||0]));
  if(amount>=0){credit(wallet,amount);return wallet;}
  let due=-amount;
  if(walletTotal(character)<due)throw new Error('This character does not have enough coins.');
  for(const coin of coins){
    const spend=Math.min(wallet[coin],Math.floor(due/COIN_VALUES[coin]));
    wallet[coin]-=spend;due-=spend*COIN_VALUES[coin];
  }
  if(due){
    const coin=coins.reverse().find(key=>wallet[key]&&COIN_VALUES[key]>due);
    wallet[coin]--;
    credit(wallet,COIN_VALUES[coin]-due);
  }
  return wallet;
}
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const scaledPrice=(price,multiplier)=>{
  if(price==null)return null;
  const scaled=Math.max(1,Math.round(price*multiplier/100));
  return scaled<=PRICE_LIMIT?scaled:null;
};
export const merchandiseEntry=line=>line?.custom?{...line.custom,id:line.catalogId,group:line.custom.category}:findEquipment(line?.catalogId);
export const merchandiseLine=(entry,stock=entry.magic?1:null)=>({catalogId:entry.id,priceOverride:null,sellOverride:null,stock});
const catalogPrice=entry=>entry?.priceCp??parsePrice(entry?.cost);
export const purchasePrice=(entry,line,multiplier)=>line.priceOverride??scaledPrice(catalogPrice(entry),multiplier);

export function defaultMerchandise(type,settings) {
  const {defaults,limit}=STORE_TYPES[type];
  return Object.fromEntries(EQUIPMENT.filter(entry=>defaults(entry)&&contentEnabled(entry,settings)).slice(0,limit).map(entry=>[entry.id,merchandiseLine(entry)]));
}
export function newShop(type='general',settings={}) {
  return {name:'',type,description:'',multiplier:100,buyRate:50,acceptAll:false,open:false,items:defaultMerchandise(type,settings)};
}
export function randomMerchandise({rarity,type,count,storeType='magic'},items,settings,random=Math.random) {
  if(!MAGIC_RARITIES.includes(rarity)||!Object.hasOwn(MAGIC_TYPES,type)||!Object.hasOwn(STORE_TYPES,storeType)||!integer(count,1,STORE_LIMIT))throw new Error('Choose a rarity, item type, and valid quantity.');
  const types=MAGIC_TYPES[type],names=new Set(Object.values(items).map(line=>equipmentName(merchandiseEntry(line)?.name)));
  const pool=MAGIC_ITEMS.flatMap(entry=>MAGIC_ITEM_VERSIONS.get(entry.id)?.choices.map(choice=>choice.entry)||[entry]).filter(entry=>{
    const rarities=entry.id==='potion-of-healing'?['Common']:entry.rarities;
    return !Object.hasOwn(items,entry.id)&&!rareOrUnique(entry)&&rarities.includes(rarity)
      &&matchesShopMagic(entry,storeType)&&(!types.length||types.includes(entry.itemType))&&contentEnabled(entry,settings);
  });
  const chosen=[];
  while(pool.length&&chosen.length<Math.min(count,STORE_LIMIT-Object.keys(items).length)){
    const [entry]=pool.splice(Math.floor(random()*pool.length),1),name=equipmentName(entry.name);
    if(names.has(name))continue;
    names.add(name);chosen.push(entry);
  }
  return chosen;
}
export function prepareShop(draft,previousItems={}) {
  const {name,type,description,multiplier,buyRate,acceptAll,open}=draft;
  if(typeof name!=='string'||!name.trim()||name.trim().length>100||typeof description!=='string'||description.length>2000||!Object.hasOwn(STORE_TYPES,type))throw new Error('Enter a store name and choose a store type.');
  if(!integer(multiplier,1,1000)||!integer(buyRate,0,100))throw new Error('Enter a price multiplier from 1–1000% and a resale rate from 0–100%.');
  if(Object.keys(draft.items).length>STORE_LIMIT)throw new Error(`A store can list at most ${STORE_LIMIT} items.`);
  const items=Object.fromEntries(Object.entries(draft.items).map(([id,line])=>{
    const {catalogId,priceOverride,sellOverride,stock,custom}=line,entry=merchandiseEntry(line);
    if(id!==catalogId||!entry||!/^[a-z0-9-]{1,200}$/.test(id)||![priceOverride,sellOverride].every(value=>value===null||integer(value,1,PRICE_LIMIT))
      ||!(stock===null||integer(stock,0,STOCK_LIMIT)))throw new Error('Check each item’s prices and stock.');
    if(entry.magic&&!Object.hasOwn(previousItems,id)&&(!matchesShopMagic(entry,type)||!contentEnabled(entry,{},'item')))
      throw new Error(`${entry.name} is unavailable for new stock at a ${STORE_TYPES[type].name}.`);
    if(custom&&(!id.startsWith('custom-')||typeof custom.name!=='string'||!custom.name.trim()||custom.name.length>200
      ||!['Weapon','Armor','Gear','Consumable','Treasure'].includes(custom.category)||!Number.isFinite(custom.weight)||custom.weight<0||custom.weight>99999
      ||typeof custom.details!=='string'||custom.details.length>2000))throw new Error('Check the custom merchandise fields.');
    const priceCp=purchasePrice(entry,line,multiplier);
    return [id,{catalogId,priceOverride,sellOverride,stock,priceCp,...(custom?{custom:{name:custom.name.trim(),category:custom.category,weight:custom.weight,details:custom.details}}:{})}];
  }));
  return {name:name.trim(),type,description:description.trim(),multiplier,buyRate,acceptAll:!!acceptAll,open:!!open,items};
}
export function quoteSale(shop,character,item) {
  if(!item?.qty)return {error:'This item is no longer available.'};
  if(item.equipped||item.attuned||item.containerId||character.items.some(i=>i.containerId===item.id))return {error:'Unequip, unattune, or unpack this item first.'};
  const uses=itemUses(item);
  if(uses.maxUses&&uses.usesLeft<uses.maxUses)return {error:'Only unused items or full bundles can be sold.'};
  const catalogEntry=findEquipment(item.catalogId)||catalogNames.get(itemKey(item));
  const id=Object.hasOwn(shop.items,item.catalogId)?item.catalogId:catalogEntry?.id;
  const listed=Object.hasOwn(shop.items,id)?shop.items[id]:null;
  const entry=merchandiseEntry(listed)||catalogEntry;
  if(entry&&defaultItemUses(entry).maxUses>uses.maxUses)return {error:'This store buys full catalog bundles only.'};
  if(listed?.sellOverride)return {unitCp:listed.sellOverride};
  if(!shop.acceptAll&&!listed&&(!entry||!STORE_TYPES[shop.type]?.accept(entry)))return {error:'This store does not buy this kind of item.'};
  const basis=listed?listed.priceCp:scaledPrice(catalogPrice(entry),shop.multiplier);
  if(basis==null)return {error:'This item needs a resale price from the DM.'};
  const isTreasure=entry&&inGroups('Gemstones','Art objects & jewelry','Trade goods','Trade bars')(entry);
  const unitCp=isTreasure?basis:Math.floor(basis*shop.buyRate/100);
  return unitCp>0?{unitCp}:{error:'This store offers no coins for this item.'};
}
export function applyShopOrder(shop,character,{kind,itemId,quantity,expectedUnitCp}) {
  if(!shop?.open)throw new Error('This store is closed.');
  if(!integer(quantity,1,STOCK_LIMIT))throw new Error('Enter a positive whole quantity.');
  if(kind==='sell'){
    const item=character.items.find(item=>item.id===itemId),{unitCp,error}=quoteSale(shop,character,item);
    if(error)throw new Error(error);
    if(unitCp!==expectedUnitCp)throw new Error('The price changed. Review the updated offer.');
    const wallet=walletChange(character,unitCp*quantity);
    reserveTransfer(character,{kind:'item',itemId,amount:quantity});
    Object.assign(character,wallet);
    return {unitCp};
  }
  if(kind!=='buy')throw new Error('Choose Buy or Sell.');
  const line=Object.hasOwn(shop.items,itemId)?shop.items[itemId]:null,entry=merchandiseEntry(line);
  if(!entry||!integer(line.priceCp,1,PRICE_LIMIT))throw new Error('This item is waiting for a price or is no longer available.');
  if(line.priceCp!==expectedUnitCp)throw new Error('The price changed. Review the updated offer.');
  if(line.stock!==null&&(!integer(line.stock,0,STOCK_LIMIT)||line.stock<quantity))throw new Error('There is not enough stock left.');
  const wallet=walletChange(character,-line.priceCp*quantity);
  const incoming=line.custom?{id:uid(),catalogId:itemId,name:entry.name,category:entry.category,weight:entry.weight,description:entry.details,wiki:'',equipped:false}:itemFromEquipment(entry);
  const stack=character.items.find(item=>item.catalogId===itemId&&!item.equipped&&!item.containerId&&!item.attuned&&sameStack(item,incoming)&&item.qty+quantity<=STOCK_LIMIT);
  if(stack)stack.qty+=quantity;
  else{
    if(character.items.length>=2000)throw new Error('Your inventory is full.');
    character.items.push({...incoming,qty:quantity});
  }
  Object.assign(character,wallet);
  linkWeaponActions(character);
  return {unitCp:line.priceCp,remaining:line.stock===null?null:line.stock-quantity};
}
