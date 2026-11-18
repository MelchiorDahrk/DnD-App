import {SKILLS,COINS,signed,uid} from './model.js';
import {portraitMarkup} from './portrait.js';
import {icon} from './icons.js';
import {partyRows,turnOrder,skillLeaders,partyTime} from './party-model.js';
import {presentPartyDice} from './dice-roller.js';
import {sound} from './sound.js';

export function createPartyPlay(ui) {
  const {esc,btn,field,actions,setModal,modal,toast,getState,navigate}=ui;
  let connectedAt=Date.now(),partyId='',seen=new Set(),reactions=new Map(),latestRoll=null,skill='Perception',notification='',prompting='',recovering=false;
  const party=()=>ui.party(),store=()=>ui.store(),user=()=>ui.user();
  const active=()=>getState().characters.find(c=>c.id===getState().activeId);
  const own=()=>party()?.characters.filter(c=>c.ownerId===user()?.uid)||[];
  const run=async fn=>{try{await fn();}catch(error){toast(error.message,true);}};
  const checked=(key,fallback=false)=>getState().settings[key]??fallback;
  const safeSigned=value=>signed(Number.isFinite(Number(value))?Number(value):0);
  function connectionMarkup(){
    const errors=party()?.errors||{},issue=ui.serviceIssue?.();
    if(!Object.keys(errors).length&&!issue)return '';
    const permissions=!!issue||Object.values(errors).some(error=>error.code==='permission-denied');
    return `<section class="storage-warning party-connection-warning" role="status"><div><strong>${permissions?'Party session setup needs an update.':'Party updates are interrupted.'}</strong><p>${permissions?'Your party selection is preserved. Some session features are unavailable until the server has the Firestore rules for this app version.':'Your party selection is preserved. Reconnect and retry to resume live updates.'}</p></div>${btn('cloud-retry','Retry connection','btn btn-sm')}</section>`;
  }
  function settingsMarkup(){
    return `<section class="panel party-settings" data-settings-section="party" tabindex="-1"><div class="panel-heading"><h2>${icon('people')}Party</h2></div><div class="setting-row"><div><strong>Live activity notifications</strong><p>Show party activity at the bottom of other pages.</p></div>${btn('party-notifications-toggle','','toggle-switch'+(checked('partyNotifications',true)?' active':''),`role="switch" aria-checked="${checked('partyNotifications',true)}" aria-label="Party activity notifications"`)}</div><div class="setting-row"><div><strong>Session Mode</strong><p>Keep party health, conditions, and the current turn at the top of every page.</p></div>${btn('party-session-toggle','','toggle-switch'+(checked('sessionMode')?' active':''),`role="switch" aria-checked="${checked('sessionMode')}" aria-label="Session Mode"`)}</div></section>${connectionMarkup()}`;
  }
  function card(c,index){
    const live=c.live,sheet=c.sheet;if(!sheet)return '';
    const current=party().combat.active&&party().combat.current===c.id,unconscious=live&&(live.hp===0||live.conditions.includes('Unconscious'));
    const reaction=reactions.get(c.id),effect=reaction?.until>Date.now()?reaction.kind:'';
    return `<article class="party-player${current?' is-current':''}${unconscious?' is-unconscious':''}${effect?' reaction-'+effect:''}" data-party-character="${esc(c.characterId)}" ${current?'aria-current="step"':''}>
      <div class="party-player-top"><span>${icon('heart')} <strong>${live?esc(live.hp):'…'}</strong><small> / ${live?esc(live.maxHp):'…'} HP${live?.tempHp?` +${esc(live.tempHp)}`:''}</small></span><span title="Armor class">${icon('shield')} <strong>${esc(sheet.ac)}</strong><small> AC</small></span></div>
      ${btn('party-member',`<span class="party-portrait${live?.inspiration?' is-inspired':''}">${portraitMarkup(sheet)}<span class="party-heal-sparks" aria-hidden="true">✦ · ✧ · ✦</span></span>`,'party-portrait-button',`data-id="${esc(c.id)}" aria-label="Interact with ${esc(sheet.name)}" aria-haspopup="dialog"`)}
      <h2>${esc(sheet.name)}</h2><p>Level ${esc(sheet.level)} ${esc(sheet.class)}${c.ownerId===user()?.uid?' · You':''}</p>
      <div class="party-health"><div class="hp-track${live&&live.hp/live.maxHp<.3?' low':''}" role="progressbar" aria-label="${esc(sheet.name)} health" aria-valuemin="0" aria-valuemax="${esc(live?.maxHp||1)}" aria-valuenow="${esc(live?.hp||0)}"><span class="hp-current" style="width:${live?live.hp/live.maxHp*100:0}%"></span></div></div>
      <div class="party-player-status">${unconscious?'<span>Unconscious</span>':''}${(live?.conditions||[]).filter(s=>s!=='Unconscious').map(s=>`<span>${esc(s)}</span>`).join('')}${live?.inspiration?`<span class="party-inspired">✦ Inspired${live.inspiration>1?' ×'+esc(live.inspiration):''}</span>`:''}${live?.concentration?`<span title="Concentration">${icon('spark')}${esc(live.concentration)}</span>`:''}${live?.exhaustion?`<span>Exhaustion ${esc(live.exhaustion)}</span>`:''}</div>
      <div class="party-player-turn"><span>${current?'CURRENT TURN':party().combat.active?Object.hasOwn(party().combat.scores||{},c.id)?`UP NEXT · ${index}`:'NOT IN ENCOUNTER':'INITIATIVE'}</span>${btn('party-initiative',Object.hasOwn(party().combat.scores||{},c.id)?safeSigned(party().combat.scores[c.id]):'Set','btn btn-sm btn-ghost',`data-id="${esc(c.id)}" aria-label="Set initiative for ${esc(sheet.name)}"`)}</div>
    </article>`;
  }
  function transferText(offer){try{const payload=JSON.parse(offer.payload);return payload.kind==='money'?`${payload.amount} ${COINS[payload.coin]}`:`${payload.amount} × ${payload.item.name}`;}catch{return 'Invalid offer';}}
  function requestsMarkup(){
    const p=party();
    const offers=p.transfers.filter(o=>['pending','declined'].includes(o.status)&&(o.recipientId===user().uid||o.senderId===user().uid));
    const rests=p.rests.filter(r=>Date.now()-partyTime(r)<86400000);
    if(!offers.length&&!rests.length)return '';
    return `<div class="party-requests">${offers.map(o=>`<div class="party-request"><span>${esc(o.fromName)} → ${esc(o.toName)}<strong>${esc(transferText(o))}</strong><small>${o.status==='declined'?'Declined · returning to sender':'Awaiting acceptance · reserved by sender'}</small></span><div class="cloud-actions">${o.recipientId===user().uid&&o.status==='pending'?btn('party-transfer-accept','Accept','btn btn-primary',`data-id="${esc(o.id)}"`)+btn('party-transfer-decline','Decline','btn',`data-id="${esc(o.id)}"`):o.senderId===user().uid?btn('party-transfer-cancel','Return to pack','btn',`data-id="${esc(o.id)}"`):''}</div></div>`).join('')}${rests.map(r=>`<div class="party-request"><span>${r.kind==='long'?'Long':'Short'} rest<strong>${r.replies.filter(v=>v.yes).length} yes · ${r.replies.filter(v=>!v.yes).length} no · ${Math.max(0,p.members.length-r.replies.length)} waiting</strong></span>${r.replies.some(v=>v.actorId===user().uid)?'<span class="badge">Replied</span>':btn('party-rest-reply','Reply','btn',`data-id="${esc(r.id)}"`)}</div>`).join('')}</div>`;
  }
  function feedMarkup(){
    const events=party().activities;
    return `<div class="party-feed-heading"><h2>${icon('journal')}At the table</h2><span class="party-live-dot">LIVE ACTIVITY</span></div><ol class="party-feed" aria-label="Party activity">${events.map(e=>{let text=e.text;if(e.kind==='roll'){try{const r=JSON.parse(e.result);text=`rolled ${r.total} · ${r.label} (${r.expression})`;}catch{text='rolled dice';}}return `<li><span class="party-event-icon">${icon(e.kind==='roll'?'dice':e.kind==='healing'?'heart':e.kind==='inspiration'?'star':e.kind==='damage'?'sword':'spark')}</span><div><strong>${esc(e.name)}</strong> ${esc(text)}<time>${new Date(partyTime(e)).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time></div></li>`;}).join('')||'<li class="party-feed-empty">The table is quiet. Rolls, damage, healing, and conditions appear here live.</li>'}</ol>`;
  }
  function skillMarkup(){
    const leaders=skillLeaders(party().characters,skill),best=leaders[0]?.bonus;
    return `<section class="panel party-skill-finder"><div class="panel-heading"><h2>${icon('compass')}Who’s best at…</h2><label class="visually-hidden" for="party-skill">Party skill finder</label><select id="party-skill" data-party-skill>${Object.keys(SKILLS).map(s=>`<option ${s===skill?'selected':''}>${esc(s)}</option>`).join('')}</select></div><div class="party-skill-results">${leaders.map(({character:c,bonus})=>btn('party-member',`<span>${esc(c.sheet.name)}${bonus===best?'<small>BEST IN PARTY</small>':''}</span><strong>${safeSigned(bonus)}</strong>`,'party-skill-result'+(bonus===best?' is-best':''),`data-id="${esc(c.id)}"`)).join('')||'<p class="form-help">Loading shared skills…</p>'}</div></section>`;
  }
  function markup(){
    const p=party(),ordered=turnOrder(p.characters,p.combat);let index=0;
    return `${connectionMarkup()}<div class="page-heading party-heading"><div><div class="eyebrow">YOUR ADVENTURING PARTY <span class="party-live-dot">LIVE</span></div><div class="party-title"><h1>${esc(p.name||'Your party')}</h1>${btn('navigate',icon('edit'),'icon-btn','data-route="party-manage" aria-label="Manage party" title="Manage party"')}</div></div><div class="heading-actions">${btn('party-session-toggle',icon('people')+(checked('sessionMode')?'Session Mode on':'Session Mode'),'btn'+(checked('sessionMode')?' btn-primary':''))}${btn('party-rest',icon('camp')+'Group rest','btn')}</div></div>
      <section class="party-table" aria-label="Party members in turn order">${partyRows(ordered).map(row=>`<div class="party-player-row">${row.map(c=>card(c,index++)).join('')}</div>`).join('')||`<div class="panel panel-body"><p>Bring your adventurers to the table.</p>${btn('cloud-share','Share a character','btn btn-primary')}</div>`}</section>
      <section class="party-turn-bar" aria-label="Shared initiative tracker"><div><span class="eyebrow">${p.combat.active?'ROUND '+esc(p.combat.round):'SHARED INITIATIVE'}</span><strong>${p.combat.active?esc(p.characters.find(c=>c.id===p.combat.current)?.sheet.name||'Choose next turn')+'’s turn':'Set initiative, then start the encounter.'}</strong></div><div class="cloud-actions">${p.combat.active?btn('party-next-turn','Next turn '+icon('chevron'),'btn btn-primary')+btn('party-end-combat','End encounter','btn btn-ghost'):btn('party-start-combat','Start encounter','btn btn-primary')}</div></section>
      <section class="party-play-area" aria-label="Shared play area"><div class="party-play-heading"><span>${icon('dice')}THE PLAY AREA</span><div class="cloud-actions">${btn('party-roll','Roll dice','btn btn-sm')}${btn('party-rest','Rest','btn btn-sm btn-ghost')}</div></div><div id="party-roll" class="party-roll-host" data-party-id="${esc(p.id)}">${latestRoll?staticRoll(latestRoll):'<div class="party-tray-empty">'+icon('dice')+'<strong>A place for every adventure.</strong><span>Roll together. Watch the story unfold.</span></div>'}</div><div id="party-requests">${requestsMarkup()}</div><div id="party-activity">${feedMarkup()}</div></section>${skillMarkup()}`;
  }
  function staticRoll(event){try{const r=JSON.parse(event.result);return `<div class="party-last-roll"><span>${esc(event.name)} · ${esc(r.label)}</span><strong>${esc(r.total)}</strong><small>${esc(r.expression)} · ${r.rolls.map(v=>esc(v)).join(' + ')}${r.bonus?' '+safeSigned(r.bonus):''}</small></div>`;}catch{return '';}}
  function update(data){
    if(partyId!==data.id){partyId=data.id;connectedAt=Date.now();seen=new Set();reactions=new Map();latestRoll=null;prompting='';notification='';}
    for(const event of [...data.activities].reverse()){
      if(seen.has(event.id))continue;seen.add(event.id);
      if(event.kind==='roll')latestRoll=event;
      if(partyTime(event)<connectedAt-2000)continue;
      if(['damage','healing','inspiration'].includes(event.kind))reactions.set(event.actorId+'_'+event.characterId,{kind:event.kind,until:Date.now()+2400});
      if(event.actorId!==user()?.uid){const sounds={damage:'combat.damage',healing:'magic.heal',inspiration:'inspiration.gain',condition:'condition.apply',unconscious:'condition.apply',roll:'dice.roll'};sound.play(sounds[event.kind]||'ui.confirm');}
      if(ui.route()!=='party'&&event.actorId!==user()?.uid)notification=`${event.name} ${event.kind==='roll'?'is rolling dice':event.text||'has an update'}`;
    }
    for(const offer of data.transfers){const key='transfer:'+offer.id;if(seen.has(key))continue;seen.add(key);if(offer.status==='pending'&&offer.recipientId===user()?.uid&&partyTime(offer)>=connectedAt-2000)notification=`${offer.fromName} offers you ${transferText(offer)}`;}
    if(!recovering&&data.transfers.some(o=>o.senderId===user()?.uid&&o.status==='declined')){
      recovering=true;store().recoverEscrow().catch(error=>toast(error.message,true)).finally(()=>{recovering=false;ui.refreshCharacter();});
    }
  }
  function mount(){
    const p=party(),session=!!p&&checked('sessionMode');document.body.classList.toggle('session-mode',session);
    let header=document.getElementById('party-session-header');
    if(!header){header=document.createElement('header');header.id='party-session-header';header.className='party-session-header';document.querySelector('.app-shell').prepend(header);}
    header.hidden=!session;
    if(session){const ordered=turnOrder(p.characters,p.combat);header.innerHTML=`${btn('navigate',`<span class="party-live-dot">SESSION</span><strong>${esc(p.name)}</strong>`,'session-party-name','data-route="party"')}<div class="session-members">${ordered.map(c=>btn('party-member',`${portraitMarkup(c.sheet)}<span><strong>${esc(c.sheet.name)}</strong><small>${esc(c.live?.hp??'…')}/${esc(c.live?.maxHp??'…')} HP · AC ${esc(c.sheet.ac)}${c.live?.conditions.length?' · '+esc(c.live.conditions.join(', ')):''}</small></span>`,'session-member'+(p.combat.active&&p.combat.current===c.id?' is-current':''),`data-id="${esc(c.id)}"`)).join('')}</div><div class="session-controls">${p.combat.active?`<small>R${esc(p.combat.round)}</small>${btn('party-next-turn',icon('chevron'),'icon-btn','aria-label="Next turn"')}`:''}${btn('party-session-toggle',icon('close'),'icon-btn','aria-label="Exit Session Mode"')}</div>`;}
    let notice=document.getElementById('party-notification');
    if(!notice){notice=document.createElement('div');notice.id='party-notification';notice.className='party-notification';notice.setAttribute('role','status');document.body.append(notice);}
    notice.hidden=!p||!notification||ui.route()==='party'||!checked('partyNotifications',true);
    notice.innerHTML=notification?btn('navigate',icon('people')+`<span><strong>${esc(p?.name)}</strong>${esc(notification)}</span>`,'party-notification-link','data-route="party"')+btn('party-notification-dismiss',icon('close'),'icon-btn','aria-label="Dismiss party notification"'):'';
    if(ui.route()==='party')notification='';
    const host=document.getElementById('party-roll');
    if(host&&latestRoll&&host.dataset.rollId!==latestRoll.id){host.dataset.rollId=latestRoll.id;host.innerHTML=staticRoll(latestRoll);if(Date.now()-partyTime(latestRoll)<20000){try{presentPartyDice(JSON.parse(latestRoll.result),host);}catch{}}}
    if(!modal.open&&p){const rest=p.rests.find(r=>r.repliesReady&&r.actorId!==user()?.uid&&!r.replies.some(v=>v.actorId===user()?.uid)&&Date.now()-partyTime(r)<86400000&&prompting!==r.id);if(rest){prompting=rest.id;restDialog(rest);}}
  }
  function restDialog(rest){
    const name=party().characters.find(c=>c.characterId===rest.characterId&&c.ownerId===rest.actorId)?.sheet.name||'A companion';
    setModal('Rest with your party?',`<p>${esc(name)} proposes a <strong>${rest.kind} rest</strong>. Join them?</p><p class="form-help">Yes opens your character’s rest choices. Each player finishes their own rest.</p><div class="modal-actions">${btn('party-rest-no','No','btn',`data-id="${esc(rest.id)}"`)}${btn('party-rest-yes','Yes, rest together','btn btn-primary',`data-id="${esc(rest.id)}"`)}</div>`);
  }
  function requestRest(kind){
    if(!party()||!own().some(c=>c.characterId===active()?.id))return false;
    if(party().errors?.rests){ui.openRest(kind);return true;}
    run(async()=>{const id=await store().requestRest(partyId,kind,active().id);await store().replyRest(partyId,id,true,active().id);ui.openRest(kind);});return true;
  }
  async function broadcastRoll(result,label){
    const c=active(),shared=own().find(s=>s.characterId===c?.id);if(!shared||party().errors?.activities)return;
    const r={expression:result.expression,rolls:result.rolls,total:result.total,bonus:result.bonus||0,mode:result.mode||'normal',natural:result.natural??null,label};
    await store().activity(partyId,{kind:'roll',characterId:c.id,name:c.name,result:JSON.stringify(r)});
    if(/^initiative$/i.test(label))await store().setInitiative(partyId,shared.id,r.total);
  }
  async function transferDialog(target,kind){
    await ui.ready();const sources=own().map(c=>getState().characters.find(s=>s.id===c.characterId)).filter(Boolean),source=sources.find(c=>c.id===active()?.id)||sources[0];
    if(!source)throw new Error('Share one of your characters with this party first.');
    const options=kind==='money'?`<label class="form-field">Coin<select name="coin">${Object.entries(COINS).map(([key,label])=>`<option value="${key}">${key} (${source[key]||0} ${label})</option>`).join('')}</select></label>`:`<label class="form-field">Item<select name="itemId" required>${source.items.filter(i=>i.qty&&!i.equipped&&!i.attuned).map(i=>`<option value="${esc(i.id)}">${esc(i.name)} (${i.qty})</option>`).join('')}</select></label>`;
    const id=uid();setModal(kind==='money'?'Offer coins':'Offer an item',`<p>From ${esc(source.name)} to ${esc(target.sheet.name)}. The other player must accept.</p>${options}${field('Amount','amount',1,'number','required min="1" max="100000000" step="1"')}<p class="form-help">The offer is reserved until accepted. Declining or cancelling returns it to your pack. Unequip and unattune items first.</p>${actions('Send offer')}`,data=>run(async()=>{await ui.ready();await store().offerTransfer(partyId,source.id,target,{kind,amount:Number(data.get('amount')),coin:data.get('coin'),itemId:data.get('itemId')},id);modal.close();await ui.refreshCharacter(source.id);toast('Offer sent. Waiting for acceptance.');}));
  }
  function handle(action,el){
    if(!action.startsWith('party-'))return false;
    const p=party(),id=el.dataset.id;
    if(action==='party-session-toggle'||action==='party-notifications-toggle'){const key=action==='party-session-toggle'?'sessionMode':'partyNotifications';getState().settings[key]=!checked(key,key==='partyNotifications');ui.commit();return true;}
    if(action==='party-notification-dismiss'){notification='';mount();return true;}
    if(!p){toast('Join a party first.',true);return true;}
    const feature=action.includes('transfer')||action.startsWith('party-offer-')?'transfers':action.includes('rest')?'rests':action.includes('initiative')||action.includes('combat')||action==='party-next-turn'?'combat':action==='party-roll'?'activities':'';
    if(feature&&p.errors?.[feature]){toast('This party feature needs the updated server rules. Use Retry connection after the rules are published.',true);return true;}
    switch(action){
      case 'party-member':{const c=p.characters.find(c=>c.id===id);if(!c)break;setModal(esc(c.sheet.name),`<div class="party-member-preview">${portraitMarkup(c.sheet)}<p>${esc(c.sheet.class)} · Level ${esc(c.sheet.level)}</p></div><div class="party-member-actions">${btn('cloud-view',icon('sheet')+'View character sheet','btn btn-primary',`data-id="${esc(id)}"`)}${c.ownerId!==user().uid?btn('party-offer-item',icon('bag')+'Transfer items','btn',`data-id="${esc(id)}"`)+btn('party-offer-money',icon('coin')+'Transfer money','btn',`data-id="${esc(id)}"`):''}</div>`);break;}
      case 'party-offer-item':case 'party-offer-money':run(()=>transferDialog(p.characters.find(c=>c.id===id),action.endsWith('money')?'money':'item'));break;
      case 'party-transfer-accept':case 'party-transfer-decline':run(async()=>{await ui.ready();const offer=p.transfers.find(o=>o.id===id);await store().answerTransfer(partyId,id,action.endsWith('accept'));modal.close();await ui.refreshCharacter(offer?.toCharacter);sound.play('item.acquire');ui.refresh();});break;
      case 'party-transfer-cancel':run(async()=>{await ui.ready();await store().reclaimTransfer(partyId,id,{cancel:true});await ui.refreshCharacter();ui.refresh();});break;
      case 'party-initiative':{const c=p.characters.find(c=>c.id===id);setModal('Set shared initiative',`${field(esc(c.sheet.name),'score',p.combat.scores?.[id]??0,'number','required min="-99" max="999" step="1"')}${actions('Set initiative')}`,data=>run(async()=>{await store().setInitiative(partyId,id,Number(data.get('score')));modal.close();ui.refresh();}));break;}
      case 'party-start-combat':case 'party-next-turn':case 'party-end-combat':run(()=>store().advanceTurn(partyId,p.characters,{start:action==='party-start-combat',end:action==='party-end-combat'}));break;
      case 'party-rest':setModal('Rest with the party',`<p>Invite everyone to take a rest. Each player can answer yes or no.</p><div class="modal-actions">${btn('party-rest-short','Short rest','btn btn-primary')}${btn('party-rest-long','Long rest','btn')}</div>`);break;
      case 'party-rest-short':case 'party-rest-long':if(!requestRest(action.endsWith('long')?'long':'short'))toast('Select a character shared with this party first.',true);break;
      case 'party-rest-reply':{const rest=p.rests.find(r=>r.id===id);if(rest)restDialog(rest);break;}
      case 'party-rest-yes':case 'party-rest-no':run(async()=>{const rest=p.rests.find(r=>r.id===id),yes=action.endsWith('yes');if(yes&&!own().some(c=>c.characterId===active()?.id))throw new Error('Select a character shared with this party first.');await store().replyRest(partyId,id,yes,active()?.id||'');modal.close();if(yes)ui.openRest(rest.kind);ui.refresh();});break;
      case 'party-roll':setModal('Roll at the table',`${field('Dice expression','expression','1d20','text','required maxlength="30"')}${field('Roll label','label','Party roll','text','required maxlength="120"')}${actions('Roll dice')}`,data=>{const expression=String(data.get('expression')),label=String(data.get('label'));ui.roll(expression,label);});break;
    }
    return true;
  }
  document.addEventListener('change',event=>{if(event.target.hasAttribute('data-party-skill')){skill=event.target.value;ui.refresh();}});
  return {markup,settingsMarkup,connectionMarkup,handle,update,mount,requestRest,broadcastRoll,reset:()=>{partyId='';latestRoll=null;notification='';reactions.clear();mount();}};
}
