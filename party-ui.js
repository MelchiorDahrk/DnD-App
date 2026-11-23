import {SKILLS,COINS,signed,uid,initiative,mod} from './model.js';
import {portraitMarkup} from './portrait.js';
import {icon,conditionIcon} from './icons.js';
import {armorCheckMode} from './armor-class.js';
import {partyRows,turnOrder,skillLeaders,partyTime,designatedDM,effectiveDM} from './party-model.js';
import {presentPartyDice} from './dice-roller.js';
import {diceControlsMarkup,mountDiceControls} from './dice-controls.js';
import {sound,playRollSound,playRollFeedback} from './sound.js';
import {partyStatusSoundEvent} from './sound-events.js';
import {createShopUI} from './shop-ui.js';

export function createPartyPlay(ui) {
  const {esc,btn,field,actions,setModal,modal,toast,getState,navigate}=ui;
  const shop=createShopUI(ui);
  let connectedAt=Date.now(),partyId='',seen=new Set(),reactions=new Map(),latestRoll=null,skill='Perception',notification='',prompting='',initiativePrompts=new Set(),recovering=false;
  let sessionMarkup='',pendingRollFeedback='';
  const party=()=>ui.party(),store=()=>ui.store(),user=()=>ui.user();
  const active=()=>getState().characters.find(c=>c.id===getState().activeId);
  const own=()=>party()?.characters.filter(c=>c.ownerId===user()?.uid)||[];
  const isDM=()=>!!party()&&effectiveDM(party())===user()?.uid;
  const run=async fn=>{try{await fn();}catch(error){toast(error.message,true);}};
  const checked=(key,fallback=false)=>getState().settings[key]??fallback;
  const safeSigned=value=>signed(Number.isFinite(Number(value))?Number(value):0);
  const isUnconscious=live=>live&&(live.hp===0||live.conditions.includes('Unconscious'));
  function reactionFor(id){
    const reaction=reactions.get(id);
    return reaction?.until>Date.now()?reaction:null;
  }
  function partyPortrait(sheet,live){
    return `<span class="party-portrait${live?.inspiration?' is-inspired':''}">${portraitMarkup(sheet)}<span class="party-heal-sparks" aria-hidden="true">✦ · ✧ · ✦</span></span>`;
  }
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
    const combat=party().combat,hasInitiative=Object.hasOwn(combat.scores||{},c.id),canEnterInitiative=c.ownerId===user()?.uid&&combat.active;
    const initiativeValue=hasInitiative?esc(combat.scores[c.id]):canEnterInitiative?icon('dice')+'Roll':'—';
    const current=party().combat.active&&party().combat.current===c.id,unconscious=isUnconscious(live);
    const reaction=reactionFor(c.id);
    const statusButton=(name,content)=>btn('party-status',content,'party-status-icon',`data-status="${esc(name)}" aria-label="${esc(name)}" title="${esc(name)}" aria-haspopup="dialog"`);
    const conditions=[...(live?.conditions||[])];if(unconscious&&!conditions.includes('Unconscious'))conditions.push('Unconscious');
    const statuses=conditions.map(name=>statusButton(name,conditionIcon(name)));
    if(live?.exhaustion)statuses.push(statusButton('Exhaustion '+live.exhaustion,conditionIcon('Exhaustion')));
    if(live?.concentration)statuses.push(statusButton('Concentration: '+live.concentration,icon('eye')));
    const left=statuses.filter((_,i)=>i%2===0).join(''),right=(live?.inspiration?statusButton('Heroic Inspiration'+(live.inspiration>1?' ×'+live.inspiration:''),icon('inspiration')):'')+statuses.filter((_,i)=>i%2===1).join('');
    return `<article class="party-player${current?' is-current':''}${unconscious?' is-unconscious':''}${reaction?' reaction-'+reaction.kind:''}" data-party-character="${esc(c.characterId)}" ${reaction?`data-party-reaction="${esc(reaction.id)}"`:''} ${current?'aria-current="step"':''}>
      <div class="party-player-top"><span>${icon('heart')} <strong>${live?esc(live.hp):'…'}</strong><small> / ${live?esc(live.maxHp):'…'} HP${live?.tempHp?` +${esc(live.tempHp)}`:''}</small></span><span title="Armor class">${icon('shield')} <strong>${esc(sheet.ac)}</strong><small> AC</small></span></div>
      <div class="party-portrait-row"><div class="party-portrait-status">${left}</div>${btn('party-member',partyPortrait(sheet,live),'party-portrait-button',`data-id="${esc(c.id)}" aria-label="Interact with ${esc(sheet.name)}" aria-haspopup="dialog"`)}<div class="party-portrait-status">${right}</div></div>
      <h2>${esc(sheet.name)}${designatedDM(party())?.id===c.id?' <span class="badge party-dm-badge" title="Dungeon Master">DM</span>':''}</h2><p>Level ${esc(sheet.level)} ${esc(sheet.class)}${c.ownerId===user()?.uid?' · You':''}</p>
      <div class="party-player-turn"><span>${current?'CURRENT TURN':combat.active?hasInitiative?`UP NEXT · ${index}`:'INITIATIVE':'INITIATIVE'}</span>${canEnterInitiative?btn('party-initiative',initiativeValue,'btn btn-sm btn-ghost',`data-id="${esc(c.id)}" aria-label="Enter initiative for ${esc(sheet.name)}"`):`<strong aria-label="Initiative for ${esc(sheet.name)}">${initiativeValue}</strong>`}</div>
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
    const p=party(),ordered=turnOrder(p.characters,p.combat),dm=designatedDM(p);let index=0;
    const dmName=p.members.find(m=>m.uid===effectiveDM(p))?.displayName||dm?.sheet.playerName||(dm?'Party member':'Party owner');
    return `${connectionMarkup()}<div class="page-heading party-heading"><div class="party-title"><h1>${esc(p.name||'Your party')}</h1>${btn('navigate',icon('edit'),'icon-btn','data-route="party-manage" aria-label="Manage party" title="Manage party"')}</div><p class="party-dm-name"><span class="badge party-dm-badge">DM</span> ${esc(dm?dm.sheet.name+' · '+dmName:dmName)}</p><div class="heading-actions">${btn('party-stores',icon('bag')+'Stores','btn')}${btn('party-session-toggle',icon('people')+(checked('sessionMode')?'Session Mode on':'Session Mode'),'btn'+(checked('sessionMode')?' btn-primary':''))}</div></div>
      <section class="party-table" aria-label="Party members in turn order">${partyRows(ordered).map(row=>`<div class="party-player-row">${row.map(c=>card(c,index++)).join('')}</div>`).join('')||`<div class="panel panel-body"><p>Bring your adventurers to the table.</p>${btn('cloud-share','Share a character','btn btn-primary')}</div>`}</section>
      <section class="party-play-area" aria-label="Shared play area"><div class="party-play-heading"><div class="cloud-actions party-encounter-actions">${isDM()?(p.combat.active?btn('party-end-combat','End','btn btn-sm btn-ghost','aria-label="End encounter"'):btn('party-start-combat','Start','btn btn-sm','aria-label="Start encounter"')):''}${btn('party-roll',icon('dice')+'Roll','btn btn-sm btn-primary')}${isDM()&&p.combat.active?btn('party-next-turn',icon('chevron'),'icon-btn',`aria-label="${p.combat.current?'Next turn':'Begin turns'}" title="${p.combat.current?'Next turn':'Begin turns'}"`):''}</div><div class="cloud-actions">${btn('party-skills','Skills','btn btn-sm btn-ghost')}${isDM()?btn('party-rest','Rest','btn btn-sm btn-ghost'):''}</div></div>${p.combat.active?`<p class="party-encounter-status" role="status">Round ${esc(p.combat.round)} · ${p.combat.current?esc(p.characters.find(c=>c.id===p.combat.current)?.sheet.name||'Adventurer')+'’s turn':'Roll initiative, then begin turns'}</p>`:''}<div class="party-roll-controls">${diceControlsMarkup('1d20')}<div class="party-roll-fields">${field('Label','party-label','Party roll','text','required maxlength="120" aria-label="Roll label"')}<details class="dice-notation"><summary>Dice formula</summary>${field('Formula','party-expression','1d20','text','required maxlength="30" autocomplete="off" spellcheck="false"')}</details></div></div><div id="party-roll" class="party-roll-host" data-party-id="${esc(p.id)}">${latestRoll?staticRoll(latestRoll):'<div class="party-tray-empty">'+icon('dice')+'<strong>A place for every adventure.</strong><span>Roll together. Watch the story unfold.</span></div>'}</div><div id="party-requests">${requestsMarkup()}</div><div id="party-activity">${feedMarkup()}</div></section>`;
  }
  function staticRoll(event){try{const r=JSON.parse(event.result);return `<div class="party-last-roll"><span>${esc(event.name)} · ${esc(r.label)}</span><strong>${esc(r.total)}</strong><small>${esc(r.expression)} · ${r.rolls.map(v=>esc(v)).join(' + ')}${r.bonus?' '+safeSigned(r.bonus):''}</small></div>`;}catch{return '';}}
  function react(characterId,event){
    reactions.set(characterId,{id:event.id,kind:event.kind,until:Date.now()+2400});
    setTimeout(()=>{
      if(reactions.get(characterId)?.id!==event.id)return;
      reactions.delete(characterId);
      document.querySelectorAll(`[data-party-reaction="${CSS.escape(event.id)}"]`).forEach(node=>{
        node.classList.remove('reaction-'+event.kind);
        node.removeAttribute('data-party-reaction');
      });
    },2400);
  }
  function playActivity(event,data,characterId){
    if(event.kind==='roll'){
      try {
        const result=JSON.parse(event.result);
        playRollSound(result);
        if(ui.route()==='party')pendingRollFeedback=event.id;
        else playRollFeedback(result,.55);
      }catch{/* Ignore unreadable rolls. */}
      return;
    }
    const shared=data.characters.find(c=>c.id===characterId);
    const name=event.text?.startsWith('concentrates on ')?event.text.slice('concentrates on '.length):'';
    const spell=name?shared?.sheet?.details?.spells?.find(s=>s.name===name):undefined;
    const cue=partyStatusSoundEvent(event,spell);
    if(cue)sound.play(cue,{variant:name.length});
  }
  function update(data){
    if(partyId!==data.id){partyId=data.id;connectedAt=Date.now();seen=new Set();reactions=new Map();latestRoll=null;pendingRollFeedback='';prompting='';initiativePrompts.clear();notification='';}
    if(!data.combat.active)initiativePrompts.clear();
    for(const event of [...data.activities].reverse()){
      if(seen.has(event.id))continue;seen.add(event.id);
      if(event.kind==='roll')latestRoll=event;
      if(partyTime(event)<connectedAt-2000)continue;
      const characterId=event.actorId+'_'+event.characterId;
      if(['damage','healing','inspiration'].includes(event.kind))react(characterId,event);
      if(event.actorId!==user()?.uid)playActivity(event,data,characterId);
      if(ui.route()!=='party'&&event.actorId!==user()?.uid)notification=`${event.name} ${event.kind==='roll'?'is rolling dice':event.text||'has an update'}`;
    }
    for(const offer of data.transfers){const key='transfer:'+offer.id;if(seen.has(key))continue;seen.add(key);if(offer.status==='pending'&&offer.recipientId===user()?.uid&&partyTime(offer)>=connectedAt-2000)notification=`${offer.fromName} offers you ${transferText(offer)}`;}
    if(!recovering&&data.transfers.some(o=>o.senderId===user()?.uid&&o.status==='declined')){
      recovering=true;store().recoverEscrow().catch(error=>toast(error.message,true)).finally(()=>{recovering=false;ui.refreshCharacter();});
    }
  }
  function sessionMember(c,combat){
    const {sheet,live}=c,reaction=reactionFor(c.id);
    const current=combat.active&&combat.current===c.id;
    const status=`${esc(live?.hp??'…')}/${esc(live?.maxHp??'…')} HP · AC ${esc(sheet.ac)}${live?.conditions.length?' · '+esc(live.conditions.join(', ')):''}`;
    const classes='session-member'+(current?' is-current':'')+(isUnconscious(live)?' is-unconscious':'')+(reaction?' reaction-'+reaction.kind:'');
    return btn('party-member',`${partyPortrait(sheet,live)}<span class="session-member-details"><strong>${esc(sheet.name)}</strong><small>${status}</small></span>`,classes,`data-id="${esc(c.id)}" ${reaction?`data-party-reaction="${esc(reaction.id)}"`:''}`);
  }
  function mount(){
    shop.mount();
    const p=party(),session=!!p&&checked('sessionMode');document.body.classList.toggle('session-mode',session);
    let header=document.getElementById('party-session-header');
    if(!header){header=document.createElement('header');header.id='party-session-header';header.className='party-session-header';document.querySelector('.app-shell').prepend(header);}
    header.hidden=!session;
    if(session){
      const ordered=turnOrder(p.characters,p.combat);
      const markup=`${btn('navigate',icon('people'),'session-party-name icon-btn','data-route="party" aria-label="Party menu" title="Party menu"')}<div class="session-members">${ordered.map(c=>sessionMember(c,p.combat)).join('')}</div><div class="session-controls">${p.combat.active?`<small>R${esc(p.combat.round)}</small>${isDM()?btn('party-next-turn',icon('chevron'),'icon-btn',`aria-label="${p.combat.current?'Next turn':'Begin turns'}" title="${p.combat.current?'Next turn':'Begin turns'}"`):''}`:''}${btn('party-session-toggle',icon('close'),'icon-btn','aria-label="Exit Session Mode"')}</div>`;
      if(markup!==sessionMarkup){
        const scrollLeft=header.querySelector('.session-members')?.scrollLeft||0;
        header.innerHTML=sessionMarkup=markup;
        header.querySelector('.session-members').scrollLeft=scrollLeft;
      }
    }
    let notice=document.getElementById('party-notification');
    if(!notice){notice=document.createElement('div');notice.id='party-notification';notice.className='party-notification';notice.setAttribute('role','status');document.body.append(notice);}
    notice.hidden=!p||!notification||ui.route()==='party'||!checked('partyNotifications',true);
    notice.innerHTML=notification?btn('navigate',icon('people')+`<span><strong>${esc(p?.name)}</strong>${esc(notification)}</span>`,'party-notification-link','data-route="party"')+btn('party-notification-dismiss',icon('close'),'icon-btn','aria-label="Dismiss party notification"'):'';
    if(ui.route()==='party')notification='';
    const host=document.getElementById('party-roll');
    const controls=document.querySelector('.party-roll-controls');
    if(controls)mountDiceControls(controls,controls.querySelector('[name="party-expression"]'));
    if(host&&latestRoll&&host.dataset.rollId!==latestRoll.id){
      const event=latestRoll;
      host.dataset.rollId=event.id;host.innerHTML=staticRoll(event);
      if(Date.now()-partyTime(event)<20000){
        try {
          const result=JSON.parse(event.result),feedback=pendingRollFeedback===event.id;
          pendingRollFeedback='';
          presentPartyDice(result,host).then(status=>{if(feedback&&status!=='cancelled')playRollFeedback(result);});
        }catch{/* Ignore unreadable rolls. */}
      }
    }
    if(!modal.open&&p){
      const pending=p.combat.active&&!p.errors?.combat&&own().find(c=>!Object.hasOwn(p.combat.scores||{},c.id)&&!initiativePrompts.has(`${p.combat.encounterId||'legacy'}:${c.id}`));
      if(pending){initiativeDialog(pending);return;}
      const rest=p.rests.find(r=>r.repliesReady&&r.actorId!==user()?.uid&&!r.replies.some(v=>v.actorId===user()?.uid)&&Date.now()-partyTime(r)<86400000&&prompting!==r.id);if(rest){prompting=rest.id;restDialog(rest);}
    }
  }
  function restDialog(rest){
    const name=party().characters.find(c=>c.characterId===rest.characterId&&c.ownerId===rest.actorId)?.sheet.name||party().members.find(m=>m.uid===rest.actorId)?.displayName||'The Dungeon Master';
    setModal('Rest with your party?',`<p>${esc(name)} proposes a <strong>${rest.kind} rest</strong>. Join them?</p><p class="form-help">Yes opens your character’s rest choices. Each player finishes their own rest.</p><div class="modal-actions">${btn('party-rest-no','No','btn',`data-id="${esc(rest.id)}"`)}${btn('party-rest-yes','Yes, rest together','btn btn-primary',`data-id="${esc(rest.id)}"`)}</div>`);
  }
  function requestRest(kind){
    if(!isDM())throw new Error('Only the Dungeon Master can invite the party to rest.');
    const character=own().find(c=>c.characterId===active()?.id);
    return run(async()=>{
      const id=await store().requestRest(partyId,kind,character?.characterId);
      modal.close();
      if(character){await store().replyRest(partyId,id,true,character.characterId);ui.openRest(kind);}
      else toast('Rest invitation sent.');
    });
  }
  async function broadcastRoll(result,label,{characterId,temporaryModifier,inline=false}={}){
    const shared=characterId?party()?.characters.find(c=>c.id===characterId):own().find(s=>s.characterId===active()?.id);
    if(!shared){if(inline)throw new Error('Select a character shared with this party first.');return;}
    if(shared.ownerId!==user()?.uid)throw new Error('You can only roll for your own characters.');
    const r={expression:result.expression,rolls:result.rolls,...(result.dieSides?{dieSides:result.dieSides}:{}),total:result.total,bonus:result.bonus||0,mode:result.mode||'normal',natural:result.natural??null,label,criticalFeedback:result.criticalFeedback,combatSounds:result.combatSounds};
    const id=uid(),event={id,kind:'roll',actorId:user().uid,characterId:shared.characterId,name:shared.sheet.name,result:JSON.stringify(r)};
    if(inline){latestRoll=event;const host=document.getElementById('party-roll');if(host){host.dataset.rollId=id;host.innerHTML=staticRoll(event);}}
    if(!party().errors?.activities)await store().activity(partyId,{kind:event.kind,characterId:event.characterId,name:event.name,result:event.result},id);
    if(party().combat.active&&/^(?:roll for )?initiative$/i.test(label))await store().setInitiative(partyId,shared.id,r.total,{temporaryModifier});
  }
  function initiativeDialog(c){
    if(c.ownerId!==user()?.uid||!party().combat.active)return;
    const local=getState().characters.find(s=>c.ownerId===user().uid&&s.id===c.characterId),details=c.sheet.details;
    const base=local?initiative(local):Number.isFinite(c.sheet.initiative)?c.sheet.initiative-2*(c.live?.exhaustion||0):details?mod(details.stats.dex)+(details.initiativeBonus||0)-2*(c.live?.exhaustion||0):null;
    if(base===null){toast('Loading initiative details. Try again in a moment.',true);return;}
    const mode=local?armorCheckMode(local,'dex',local.initiativeAdvantage):c.sheet.initiativeMode||details?.initiativeMode||'normal';
    initiativePrompts.add(`${party().combat.encounterId||'legacy'}:${c.id}`);
    setModal('Roll initiative',`<p>An encounter has started. Enter initiative for <strong>${esc(c.sheet.name)}</strong>.</p><p>Calculated modifier ${safeSigned(base)}${mode!=='normal'?' · '+mode:''}</p><p class="form-help">Includes Dexterity, recorded feat and class bonuses, and Exhaustion.</p><label class="form-field">How will you roll?<select name="initiativeMethod" data-initiative-method><option value="app">Roll in the app</option><option value="physical">Enter a physical roll</option></select></label><div data-initiative-app>${field('Temporary initiative modifier','temporaryModifier',party().combat.modifiers?.[c.id]||0,'number','required min="-99" max="99" step="1"')}<p class="form-help">Added for this encounter. Ending the encounter clears this modifier and the roll.</p></div><div data-initiative-physical hidden>${field('Initiative total (including all modifiers)','initiativeTotal','','number','disabled required min="-999" max="999" step="1"')}</div>${actions('Roll initiative')}`,data=>{
      if(data.get('initiativeMethod')==='physical'){
        run(async()=>{await store().setInitiative(partyId,c.id,Number(data.get('initiativeTotal')),{temporaryModifier:0});modal.close();ui.refresh();});return;
      }
      const temporaryModifier=Number(data.get('temporaryModifier'));modal.close();
      ui.roll(`1d20${signed(base+temporaryModifier)}`,'Initiative',mode,ui.route()!=='party',null,'',{characterId:c.id,temporaryModifier});
    });
  }
  function skillsDialog(){setModal('Party skills',`<div id="party-skills-dialog">${skillMarkup()}</div>`);}
  async function transferDialog(target,kind){
    await ui.ready();const sources=own().map(c=>getState().characters.find(s=>s.id===c.characterId)).filter(Boolean),source=sources.find(c=>c.id===active()?.id)||sources[0];
    if(!source)throw new Error('Share one of your characters with this party first.');
    const options=kind==='money'?`<label class="form-field">Coin<select name="coin">${Object.entries(COINS).map(([key,label])=>`<option value="${key}">${key} (${source[key]||0} ${label})</option>`).join('')}</select></label>`:`<label class="form-field">Item<select name="itemId" required>${source.items.filter(i=>i.qty&&!i.equipped&&!i.attuned).map(i=>`<option value="${esc(i.id)}">${esc(i.name)} (${i.qty})</option>`).join('')}</select></label>`;
    const id=uid();setModal(kind==='money'?'Offer coins':'Offer an item',`<p>From ${esc(source.name)} to ${esc(target.sheet.name)}. The other player must accept.</p>${options}${field('Amount','amount',1,'number','required min="1" max="100000000" step="1"')}<p class="form-help">The offer is reserved until accepted. Declining or cancelling returns it to your pack. Unequip and unattune items first.</p>${actions('Send offer')}`,data=>run(async()=>{await ui.ready();await store().offerTransfer(partyId,source.id,target,{kind,amount:Number(data.get('amount')),coin:data.get('coin'),itemId:data.get('itemId')},id);modal.close();await ui.refreshCharacter(source.id);toast('Offer sent. Waiting for acceptance.');}));
  }
  function handle(action,el){
    if(shop.handle(action,el))return true;
    if(!action.startsWith('party-'))return false;
    const p=party(),id=el.dataset.id;
    if(action==='party-session-toggle'||action==='party-notifications-toggle'){const key=action==='party-session-toggle'?'sessionMode':'partyNotifications';getState().settings[key]=!checked(key,key==='partyNotifications');ui.commit();return true;}
    if(action==='party-notification-dismiss'){notification='';mount();return true;}
    if(!p){toast('Join a party first.',true);return true;}
    if(['party-start-combat','party-end-combat','party-next-turn','party-rest','party-rest-short','party-rest-long'].includes(action)&&!isDM()){
      toast('Only the Dungeon Master can use that control.',true);return true;
    }
    const feature=action.includes('transfer')||action.startsWith('party-offer-')?'transfers':action.includes('rest')?'rests':action.includes('initiative')||action.includes('combat')||action==='party-next-turn'?'combat':action==='party-roll'?'activities':'';
    if(feature&&p.errors?.[feature]){toast('This party feature needs the updated server rules. Use Retry connection after the rules are published.',true);return true;}
    switch(action){
      case 'party-status':setModal(esc(el.dataset.status),`<p>${esc(el.dataset.status)}</p><div class="modal-actions">${btn('close','Done','btn btn-primary')}</div>`);break;
      case 'party-skills':skillsDialog();break;
      case 'party-member':{const c=p.characters.find(c=>c.id===id);if(!c)break;setModal(esc(c.sheet.name),`<div class="party-member-preview">${portraitMarkup(c.sheet)}<p>${esc(c.sheet.class)} · Level ${esc(c.sheet.level)}</p></div><div class="party-member-actions">${btn('cloud-view',icon('sheet')+'View character sheet','btn btn-primary',`data-id="${esc(id)}"`)}${c.ownerId!==user().uid?btn('party-offer-item',icon('bag')+'Transfer items','btn',`data-id="${esc(id)}"`)+btn('party-offer-money',icon('coin')+'Transfer money','btn',`data-id="${esc(id)}"`):''}</div>`);break;}
      case 'party-offer-item':case 'party-offer-money':run(()=>transferDialog(p.characters.find(c=>c.id===id),action.endsWith('money')?'money':'item'));break;
      case 'party-transfer-accept':case 'party-transfer-decline':run(async()=>{await ui.ready();const offer=p.transfers.find(o=>o.id===id);await store().answerTransfer(partyId,id,action.endsWith('accept'));modal.close();await ui.refreshCharacter(offer?.toCharacter);sound.play('item.acquire');ui.refresh();});break;
      case 'party-transfer-cancel':run(async()=>{await ui.ready();await store().reclaimTransfer(partyId,id,{cancel:true});await ui.refreshCharacter();ui.refresh();});break;
      case 'party-initiative':{const c=p.characters.find(c=>c.id===id);if(c)initiativeDialog(c);break;}
      case 'party-start-combat':case 'party-next-turn':case 'party-end-combat':run(()=>store().advanceTurn(partyId,p.characters,{start:action==='party-start-combat',end:action==='party-end-combat'}));break;
      case 'party-rest':setModal('Rest with the party',`<p>Invite everyone to take a rest. Each player can answer yes or no.</p><div class="modal-actions">${btn('party-rest-short','Short rest','btn btn-primary')}${btn('party-rest-long','Long rest','btn')}</div>`);break;
      case 'party-rest-short':case 'party-rest-long':requestRest(action.endsWith('long')?'long':'short');break;
      case 'party-rest-reply':{const rest=p.rests.find(r=>r.id===id);if(rest)restDialog(rest);break;}
      case 'party-rest-yes':case 'party-rest-no':run(async()=>{const rest=p.rests.find(r=>r.id===id),yes=action.endsWith('yes');if(yes&&!own().some(c=>c.characterId===active()?.id))throw new Error('Select a character shared with this party first.');await store().replyRest(partyId,id,yes,active()?.id||'');modal.close();if(yes)ui.openRest(rest.kind);ui.refresh();});break;
      case 'party-roll':{const controls=document.querySelector('.party-roll-controls'),expression=controls.querySelector('[name="party-expression"]'),label=controls.querySelector('[name="party-label"]');if(!expression.reportValidity()||!label.reportValidity())break;if(!own().some(c=>c.characterId===active()?.id)){toast('Select a character shared with this party first.',true);break;}ui.roll(expression.value,label.value,'normal',false);break;}
    }
    return true;
  }
  document.addEventListener('change',event=>{
    if(event.target.hasAttribute('data-party-skill')){skill=event.target.value;const host=document.getElementById('party-skills-dialog');if(host)host.innerHTML=skillMarkup();}
    if(event.target.hasAttribute('data-initiative-method')){
      const physical=event.target.value==='physical';
      for(const [selector,enabled] of [['[data-initiative-app]',!physical],['[data-initiative-physical]',physical]]){const host=modal.querySelector(selector);host.hidden=!enabled;host.querySelector('input').disabled=!enabled;}
      modal.querySelector('button[type="submit"]').textContent=physical?'Save initiative':'Roll initiative';
    }
  });
  const initiativeModifier=()=>party()?.combat.modifiers?.[own().find(c=>c.characterId===active()?.id)?.id]||0;
  return {markup,settingsMarkup,connectionMarkup,handle,update,mount,broadcastRoll,initiativeModifier,reset:()=>{partyId='';latestRoll=null;notification='';reactions.clear();mount();}};
}
