import {createFirebaseClient,authMessage} from './firebase-client.js';
import {CloudStore} from './cloud-store.js';
import {CharacterSync} from './cloud-sync.js';
import {accountKey,emptyState,copy} from './cloud-model.js';
import {parseBackup,uid,ABILITIES,SKILLS,mod,signed as signedNumber,skillBonus,saveBonus,walkingSpeed} from './model.js';
import {characterHero} from './character-hero.js';
import {icon,conditionIcon} from './icons.js';
import {createPartyPlay} from './party-ui.js';

export function createCloudUI(ui){
  const {esc,btn,field,actions,setModal,modal,toast,getState,setState,render,navigate}=ui;
  let client=null,user=null,sync=null,store=null,stopParties=()=>{},stopParty=()=>{},party=null,partyIds=[],selected='',accountError='',busy=false,status={state:'guest',pending:0},generation=0,renderTimer,pointerDown=false,visibleRoute=location.hash.slice(1);
  const play=createPartyPlay({...ui,party:()=>party,store:()=>store,user:()=>user,route:()=>visibleRoute,refresh:()=>refresh(),ready:async()=>{
    if(!navigator.onLine)throw new Error('Reconnect before transferring items or coins.');
    sync?.reloadQueue();if(!sync?.loaded||sync.blocked||sync.conflict||sync.queue.length||sync.running)throw new Error('Wait for pending cloud saves to finish, then try again.');
  },refreshCharacter:async id=>{if(!sync)return;if(id)await sync.refresh(id);else for(const c of getState().characters)await sync.refresh(c.id);sync.deliverDeferred();}});
  document.addEventListener('pointerdown',()=>pointerDown=true);
  document.addEventListener('pointerup',()=>pointerDown=false);
  document.addEventListener('pointercancel',()=>pointerDown=false);
  const signed=()=>{if(!store)throw new Error('Sign in to use parties.');return store;};
  const run=async action=>{if(busy)return;busy=true;try{await action();}catch(error){toast(authMessage(error),true);}finally{busy=false;refresh();}};
  const refresh=(partyOnly=false)=>{clearTimeout(renderTimer);if(modal.open){updateStatus();play.mount();return;}renderTimer=setTimeout(()=>{if(pointerDown)return refresh(partyOnly);if(!modal.open&&(!partyOnly||['party','party-manage'].includes(visibleRoute)))render();else play.mount();},60);};
  function characterStatus(id){if(sync?.conflict?.characterId===id)return 'Conflict';if(sync?.queue.some(op=>op.characterId===id))return navigator.onLine?'Pending':'Offline · pending';return sync?.meta.has(id)?'Synced':sync?.loaded?'Local · upload pending':'Connecting…';}
  function hasGuestCharacters(){try{const saved=localStorage.getItem(accountKey(null));return !!saved&&parseBackup(saved).characters.length>0;}catch{return false;}}
  const statusMarkup=text=>text==='Synced'?icon('check')+esc(text):esc(text);
  function setStatus(el,text){el.classList.toggle('cloud-synced',text==='Synced');el.innerHTML=statusMarkup(text);}
  function updateStatus(){document.querySelectorAll('[data-cloud-account-error]').forEach(el=>el.textContent=accountError);document.querySelectorAll('[data-cloud-message]').forEach(el=>el.textContent=status.message||'');document.querySelectorAll('[data-cloud-status]').forEach(el=>setStatus(el,statusText()));document.querySelectorAll('[data-cloud-character]').forEach(el=>setStatus(el,characterStatus(el.dataset.cloudCharacter)));}
  const statusText=()=>({guest:'Guest · saved on this device',pending:`Pending · ${status.pending} change${status.pending===1?'':'s'}`,synced:'Synced',offline:`Offline · ${status.pending} pending`,error:'Cloud error · local copy preserved',conflict:'Conflict · choose a copy'}[status.state]||'Connecting…');
  function characterMenuMarkup(){
    return `<section class="character-menu-account" aria-label="Account and cloud saves"><h3>Account & cloud saves</h3>${user?`<p><strong>${esc(user.displayName||user.email)}</strong><br><span class="${status.state==='synced'?'cloud-synced':''}" data-cloud-status role="status">${statusMarkup(statusText())}</span></p><div class="cloud-actions">${hasGuestCharacters()?btn('cloud-upload','Copy guest characters','btn'):''}${btn('navigate','Account & settings','btn btn-ghost','data-route="settings"')}</div>`:`<p>Keep your adventurers across devices and join a live party.</p><div class="cloud-actions">${btn('cloud-signup','Create an account','btn btn-primary')}${btn('cloud-email','Sign in','btn')}</div>`}</section>`;
  }
  function accountMarkup(){
    return `<section class="panel account-panel" aria-labelledby="account-title"><div class="panel-heading"><h2 id="account-title">Account</h2><span class="badge${status.state==='synced'?' cloud-synced':''}" data-cloud-status role="status">${statusMarkup(statusText())}</span></div><div class="panel-body about-copy">${user?
      `<p><strong>${esc(user.displayName||user.email)}</strong>${user.displayName?`<br>${esc(user.email)}`:''}</p>${!user.emailVerified?`<p>Please verify your email. ${btn('cloud-verify','Send verification email','btn btn-sm')}</p>`:''}<p>${status.pending?`${status.pending} queued change(s). Keep a JSON backup while offline.`:'Local account characters upload automatically; guest characters require your choice below.'}</p><p data-cloud-message>${esc(status.message||'')}</p><details><summary>Character synchronization (${getState().characters.length})</summary><ul>${getState().characters.map(c=>`<li>${esc(c.name)} — <span class="${characterStatus(c.id)==='Synced'?'cloud-synced':''}" data-cloud-character="${esc(c.id)}">${statusMarkup(characterStatus(c.id))}</span></li>`).join('')}</ul></details><div class="cloud-actions">${hasGuestCharacters()?btn('cloud-upload','Copy guest characters to account','btn'):''}${btn('cloud-retry','Retry sync','btn')}${btn('cloud-signout','Sign out','btn btn-ghost')}</div>${sync?.conflict?`<p>Export a backup before resolving. “Keep local” deliberately replaces overlapping cloud fields with this device’s current values.</p><div class="cloud-actions">${btn('cloud-keep-cloud','Use cloud copy','btn')}${btn('cloud-keep-local','Keep local copy','btn btn-danger')}${btn('cloud-conflict-copy','Keep both as separate characters','btn')}</div>`:''}`:
      `<p>Keep playing on this device, or sign in for cloud saves and a live party.</p><p data-cloud-account-error role="alert">${esc(accountError)}</p><div class="cloud-actions">${btn('cloud-guest','Continue without an account','btn btn-ghost')}${btn('cloud-google','Sign in with Google','btn')}${btn('cloud-email','Sign in with email','btn btn-primary')}${btn('cloud-signup','Create an account','btn')}</div>`}</div></section>`;
  }
  function partyCard(c,detail=false){
    const sheet=c.sheet,live=c.live;if(!sheet)return '';
    const hp=live?.hp??0,max=live?.maxHp??1,temp=live?.tempHp||0,scale=Math.max(max,hp+temp);
    const resource=(label,remaining,total)=>`<div class="party-resource"><span>${esc(label)}</span><strong>${esc(remaining)} <small>/ ${esc(total)}</small></strong></div>`;
    const resources=live?sheet.slots.map((slot,i)=>live.slotMax[i]?resource(`Level ${i+1} slots`,Math.max(0,live.slotMax[i]-(live.slotUses[i]||0)),live.slotMax[i]):'').join('')+sheet.features.map(f=>resource(f.name,Math.max(0,(live.featureMax[f.id]||0)-(live.featureUses[f.id]||0)),live.featureMax[f.id]||0)).join(''):'';
    return `<article class="panel party-character${detail?' party-character-detail':''}">
      ${characterHero({...sheet,inspiration:live?.inspiration,concentration:live?.concentration},{compact:true})}
      <div class="party-card-body">${live?`
        <section class="party-health" aria-label="Hit points"><div class="party-health-heading"><span>${icon('heart')}Hit points</span>${temp?`<span class="party-temp-hp">+${esc(temp)} temp</span>`:''}</div><div class="hp-numbers"><strong>${esc(hp)}</strong><span> / ${esc(max)} HP</span></div><div class="hp-track${hp/max<.3?' low':''}" role="progressbar" aria-label="${esc(sheet.name)} health" aria-valuemin="0" aria-valuemax="${esc(max)}" aria-valuenow="${esc(hp)}"><span class="hp-current" style="width:${hp/scale*100}%"></span>${temp?`<span class="hp-temp" style="width:${temp/scale*100}%"></span>`:''}</div></section>
        <div class="party-stats"><div class="combat-stat">${icon('shield')}<span class="tiny-label">Armor class</span><strong>${esc(sheet.ac)}</strong></div><div class="combat-stat">${icon('spark')}<span class="tiny-label">Inspiration</span><strong>${esc(live.inspiration)}</strong></div></div>
        <div class="party-status"><div class="party-condition-list">${live.conditions.length?live.conditions.map(name=>`<span class="badge party-condition">${conditionIcon(name)}${esc(name)}</span>`).join(''):`<span class="party-clear">${icon('check')}No conditions</span>`}${live.exhaustion?`<span class="badge party-condition">${conditionIcon('Exhaustion')}Exhaustion ${esc(live.exhaustion)}</span>`:''}</div><div class="party-concentration">${icon('spark')}<span>${live.concentration?`Concentrating: <strong>${esc(live.concentration)}</strong>`:'No concentration'}</span></div></div>
        ${resources?`<section class="party-resource-section" aria-label="Resources"><h3>Resources</h3><div class="party-resources">${resources}</div></section>`:''}
        ${detail?`<div class="party-rest-state"><div class="party-resource"><span>Hit Dice</span><strong>${esc(live.hitDice)} <small>remaining${sheet.details?.hitDie?` · d${esc(sheet.details.hitDie)}`:''}</small></strong></div><div class="party-resource"><span>Death saves</span><strong>${esc(live.deathSuccess)} <small>success ·</small> ${esc(live.deathFailure)} <small>failure</small></strong></div></div>`:''}
      `:'<p class="party-loading" role="status">Loading live state…</p>'}
      ${detail?`${readOnlyDetails(sheet,live)}<p class="form-help">Read-only shared sheet. Personal notes and private content stay with the owner.</p>`:`<div class="cloud-actions party-card-actions">${btn('cloud-view','View shared sheet','btn btn-primary',`data-id="${esc(c.id)}"`)}${c.ownerId===user?.uid?btn('cloud-unshare','Remove from party','btn btn-ghost',`data-id="${esc(c.characterId)}"`):''}</div>`}</div></article>`;
  }
  function readOnlyDetails(sheet,live){
    if(!sheet.details||!live)return '';
    const c={...sheet,...sheet.details,...live};
    const rows=(entries,format)=>entries.map(entry=>`<div class="action-row"><div class="action-info">${format(entry)}</div></div>`).join('');
    const skillRow=(label,value)=>`<div class="party-skill"><span>${esc(label)}</span><strong>${signedNumber(value)}</strong></div>`;
    return `<div class="party-details"><section class="ability-section"><div class="section-heading"><h3>Abilities</h3></div><div class="ability-grid">${Object.entries(ABILITIES).map(([key,label])=>`<div class="ability-card"><div class="ability-label">${label}</div><div class="ability-mod">${signedNumber(mod(c.stats[key]))}</div><span class="ability-score">${esc(c.stats[key])}</span></div>`).join('')}</div></section><section class="panel"><div class="panel-heading"><h2>${icon('shield')}Saving throws & skills</h2></div><div class="panel-body"><p class="party-movement">Speed ${walkingSpeed(c)} ft · Hit die d${c.hitDie}</p><h3>Saving throws</h3><div class="party-skill-grid">${Object.entries(ABILITIES).map(([key,label])=>skillRow(label,saveBonus(c,key))).join('')}</div><h3>Skills</h3><div class="party-skill-grid">${Object.keys(SKILLS).map(skill=>skillRow(skill,skillBonus(c,skill))).join('')}</div></div></section><section class="panel"><div class="panel-heading"><h2>${icon('sword')}Attacks</h2></div>${rows(c.attacks,a=>`<strong>${esc(a.name)}</strong><small>${esc(a.damage)} ${esc(a.type)} · ${esc(a.range)}</small>`)||'<p class="panel-body">No attacks shared.</p>'}</section><section class="panel"><div class="panel-heading"><h2>${icon('book')}Spellbook</h2></div>${rows(c.spells,s=>`<strong>${esc(s.name)}</strong><small>${s.level?'Level '+s.level:'Cantrip'} · ${esc(s.school)} · ${esc(s.castingTime)} · ${esc(s.range)} · ${esc(s.duration)}${s.prepared?' · Prepared':''}${s.concentration?' · Concentration':''}</small>`)||'<p class="panel-body">No spells shared.</p>'}</section></div>`;
  }
  function partyMemberLabel(member){
    if(member.uid===user?.uid)return 'You';
    return party?.characters.filter(c=>c.ownerId===member.uid).map(c=>c.sheet?.name).filter(Boolean).join(', ')||`Party member ${party?.members.findIndex(m=>m.uid===member.uid)+1}`;
  }
  function partyManagementMarkup(){
    if(!user)return `<div class="page-heading"><h1>Party</h1></div>${accountMarkup()}`;
    const token=new URL(location.href).searchParams.get('invite');
    const invitations=party?.invitations.filter(invitation=>!invitation.revoked)||[];
    return `<div class="page-heading"><h1>Party management</h1><div class="heading-actions">${party?btn('navigate','Back to table','btn','data-route="party"'):''}${btn('cloud-create-party','Create party','btn btn-primary')}${btn('cloud-join','Join invitation','btn')}</div></div>${token?`<section class="panel panel-body"><p>An invitation is ready. Join after signing in.</p>${btn('cloud-join-link','Join this party','btn btn-primary')}</section>`:''}<div class="cloud-actions party-tabs">${partyIds.map(id=>btn('cloud-select-party',party?.id===id?esc(party.name):'Open party','btn'+(selected===id?' btn-primary':''),`data-id="${esc(id)}"`)).join('')}</div>${party?`<section class="panel"><div class="panel-heading"><h2>${esc(party.name||'Your party')}</h2><span class="badge">LIVE</span></div><div class="panel-body"><div class="cloud-actions">${btn('cloud-share','Share a character','btn')}${party.ownerId===user.uid?btn('cloud-invite','Create invitation link','btn')+btn('cloud-rename','Rename party','btn'):''}${btn('cloud-leave','Leave party','btn btn-ghost')}</div><p>Shared characters show public sheet details and combat resources. Your journal, inventory, spell notes and personal metadata remain private.</p><div class="party-members">${party.members.map(m=>`<span>${esc(partyMemberLabel(m))}${party.ownerId===user.uid&&m.uid!==user.uid?btn('cloud-remove-member','Remove','btn btn-sm btn-ghost',`data-id="${esc(m.uid)}"`):''}</span>`).join('')}</div>${party.ownerId===user.uid&&invitations.length?`<details><summary>Manage invitations</summary>${invitations.map(i=>`<div class="setting-row"><span>${'Invitation · expires '+new Date((i.createdAt.seconds+7*86400)*1000).toLocaleDateString()}</span>${btn('cloud-revoke','Revoke','btn btn-sm',`data-id="${esc(i.token)}"`)}</div>`).join('')}</details>`:''}</div></section><div class="party-grid">${party.characters.map(c=>{try{return partyCard(c);}catch{return '<p>A shared character contains invalid data. Ask its owner to share it again.</p>';}}).join('')||'<p>No characters shared yet.</p>'}</div>`:'<p>Select or create a party. You can belong to several parties; each character shares with one at a time.</p>'}`;
  }
  const partyMarkup=()=>party&&!new URL(location.href).searchParams.has('invite')?play.markup():partyManagementMarkup();
  function chooseParty(id){
    stopParty();party=null;selected=id;
    if(!id){play.reset();return refresh();}
    const token=generation;
    const details=new Map();
    stopParty=signed().watchParty(id,data=>{if(token!==generation||id!==selected)return;party=data;play.update(data);
      for(const c of data.characters){if(c.sheet.skillBonuses)continue;const cached=details.get(c.detailsHash);if(cached?.value)c.sheet.details=cached.value;else if(!cached){details.set(c.detailsHash,{});signed().readShared(id,c.id).then(latest=>{if(token!==generation||id!==selected)return;details.set(latest.detailsHash,{value:latest.sheet.details});const current=party?.characters.find(s=>s.id===c.id);if(current&&current.detailsHash===latest.detailsHash)current.sheet.details=latest.sheet.details;refresh();}).catch(()=>{});}}
      const view=modal.querySelector('[data-cloud-shared]');if(view){const c=party.characters.find(c=>c.id===view.dataset.cloudShared);if(c){c.sheet.details=view._details;view.innerHTML=partyCard(c,true);if(view.dataset.detailsHash!==c.detailsHash){view.dataset.detailsHash=c.detailsHash;signed().readShared(id,c.id).then(latest=>{if(!view.isConnected||token!==generation||id!==selected||latest.detailsHash!==view.dataset.detailsHash)return;const active=party.characters.find(c=>c.id===latest.id);if(active?.live&&active.live.revision>latest.live.revision)latest.live=active.live;view._details=latest.sheet.details;view.innerHTML=partyCard(latest,true);}).catch(error=>toast(error.message,true));}}else modal.close();}refresh(true);},error=>{
      if(token!==generation||id!==selected)return;stopParty();party=null;selected='';partyIds=partyIds.filter(p=>p!==id);play.reset();store?.recoverEscrow().catch(()=>{});if(modal.querySelector('[data-cloud-shared]'))modal.close();toast('Party access ended. You may have been removed, or the party is unavailable.',true);refresh();
    });refresh();
  }
  function listenParties(){
    stopParties();const token=generation;
    stopParties=store.watchParties(ids=>{if(token!==generation)return;partyIds=ids;if(!selected||!ids.includes(selected))chooseParty(ids[0]||'');refresh();},error=>toast(authMessage(error),true));
  }
  async function changeUser(next){
    // Initial signed-out Auth readiness must not replace an active guest sheet
    // or interrupt existing dialogs and clicks.
    if(!next&&!user){status={state:'guest',pending:0};updateStatus();return;}
    const token=++generation;sync?.stop();sync=null;stopParties();stopParty();party=null;partyIds=[];selected='';store=null;
    if(modal.open)modal.close();
    // Switch namespaces without copying account characters or preferences into
    // another account or the guest key.
    user=next;
    play.reset();
    try{
      const saved=localStorage.getItem(accountKey(next?.uid));
      setState(saved?parseBackup(saved):emptyState({sound:false}));
    }catch{accountError='Saved data for this account is unreadable. Saving is paused to preserve it. Export a backup or recover storage in Settings.';setState(emptyState({sound:false}),{blocked:true,error:accountError});status={state:'error',pending:0,message:accountError};toast(accountError,true);render();return;}
    if(!next){status={state:'guest',pending:0};render();return;}
    store=new CloudStore(client,next.uid);
    sync=new CharacterSync({store,getState,onRemote:(id,remote)=>{
      if(token!==generation)return false;if(modal.open)return false;
      const state=getState(),index=state.characters.findIndex(c=>c.id===id);
      if(remote){if(index<0){if(state.characters.length>=100){toast('Cloud sheet limit reached. Remove or back up local sheets first.',true);return false;}state.characters.push(remote);}else state.characters[index]=remote;}
      else if(index>=0)state.characters.splice(index,1);
      if(!state.characters.some(c=>c.id===state.activeId))state.activeId=state.characters[0]?.id??null;
      ui.saveRemote();refresh();return true;
    },onStatus:value=>{if(token===generation){const changed=!!status.conflict!==!!value.conflict;status=value;updateStatus();if(changed&&!modal.open)render();}}});
    sync.start();
    store.recoverEscrow().catch(error=>toast(authMessage(error),true));
    listenParties();
    render();
    // Migration is explicitly offered in the account panel and first-sign-in dialog.
    if(hasGuestCharacters()&&!localStorage.getItem(`questlog.migration.${next.uid}`))offerUpload();
  }
  function offerUpload(){
    const guest=localStorage.getItem(accountKey(null)),incoming=guest?parseBackup(guest):emptyState();
    setModal('Bring your adventurers to the cloud?',`<p>${incoming.characters.length} guest character(s) are saved on this device. Copy them into this account? Originals remain in guest storage. Existing matching IDs will be skipped; use “Keep separate copies” if you want both.</p><div class="modal-actions">${btn('close','Later','btn btn-ghost')}${btn('cloud-upload-confirm','Upload missing characters','btn btn-primary')}${btn('cloud-upload-copies','Keep separate copies','btn')}</div>`);
  }
  function emailDialog(signup=false){
    setModal(signup?'Create your account':'Sign in with email',`<div class="form-grid">${field('Email','email','','email','required autocomplete="email" maxlength="254"')}${field('Password','password','','password',`required minlength="${signup?8:1}" autocomplete="${signup?'new-password':'current-password'}"`)}</div>${actions(signup?'Create account':'Sign in',!signup?btn('cloud-reset','Reset password','btn btn-ghost'):'')}`,data=>run(async()=>{await (signup?client.signup(String(data.get('email')),String(data.get('password'))):client.signin(String(data.get('email')),String(data.get('password'))));modal.close();if(signup)toast('Account created. Check your inbox for a verification email.');}));
  }
  function handle(action,el){
    if(action==='delete-character'&&user){run(async()=>{await signed().checkTransferDeletion(el.dataset.id||getState().activeId);ui.deleteCharacter(el.dataset.id);});return true;}
    if(play.handle(action,el))return true;
    if(!action.startsWith('cloud-'))return false;
    if(['cloud-email','cloud-signup','cloud-google'].includes(action)&&!client){toast(accountError||'Account service is loading or disabled. Guest play remains available.',true);return true;}
    switch(action){
      case 'cloud-guest':if(modal.open)modal.close();navigate('sheet');break;
      case 'cloud-email':emailDialog();break;
      case 'cloud-signup':emailDialog(true);break;
      case 'cloud-google':run(()=>client.google());break;
      case 'cloud-reset':{const email=modal.querySelector('[name="email"]')?.value;if(!email){toast('Enter your email first.',true);break;}run(async()=>{await client.reset(email);toast('If this email has an account, a password reset email has been sent.');});break;}
      case 'cloud-verify':run(async()=>{await client.verify();toast('Verification email sent.');});break;
      case 'cloud-signout':run(async()=>{await client.signout();});break;
      case 'cloud-upload':offerUpload();break;
      case 'cloud-upload-confirm':case 'cloud-upload-copies':run(async()=>{
        const guest=parseBackup(localStorage.getItem(accountKey(null))||JSON.stringify(emptyState()));let count=0,skipped=0;
        for(const original of guest.characters){
          if(getState().characters.length>=100)throw new Error('Account character limit reached. Originals remain in guest storage.');
          const c=copy(original);
          if(action==='cloud-upload-copies'){c.id=uid();c.name=c.name.slice(0,105)+' (guest copy)';}
          if(getState().characters.some(c2=>c2.id===c.id)||await store.readCharacter(c.id)){skipped++;continue;}
          getState().characters.push(c);count++;
        }
        if(!getState().activeId)getState().activeId=getState().characters[0]?.id??null;
        ui.persist();localStorage.setItem(`questlog.migration.${user.uid}`,'offered');modal.close();toast(`${count} character(s) queued. ${skipped} matching ID(s) kept in guest storage.`);
      });break;
      case 'cloud-retry':sync?.retrySync();if(store){listenParties();chooseParty(selected||partyIds[0]||'');}break;
      case 'cloud-keep-cloud':case 'cloud-keep-local':run(()=>sync.resolve(action==='cloud-keep-local'?'local':'cloud'));break;
      case 'cloud-conflict-copy':run(async()=>{const id=sync.conflict.characterId,c=copy(getState().characters.find(c=>c.id===id));if(!c)throw new Error('Export your backup before resolving the deletion.');await sync.resolve('cloud');c.id=uid();c.name=c.name.slice(0,105)+' (local copy)';getState().characters.push(c);ui.persist();});break;
      case 'cloud-create-party':if(!user){navigate('settings');break;}setModal('Gather your party',`${field('Party name','name','','text','required maxlength="100"')}${actions('Create party')}`,data=>run(async()=>{const id=await signed().createParty(String(data.get('name')).trim(),user.displayName||'Adventurer');modal.close();chooseParty(id);}));break;
      case 'cloud-select-party':chooseParty(el.dataset.id);break;
      case 'cloud-rename':setModal('Rename your party',`${field('Party name','name',party.name,'text','required maxlength="100"')}${actions('Save name')}`,data=>run(async()=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Enter a party name.');await signed().s.updateDoc(signed().ref(`parties/${selected}`),{name});modal.close();}));break;
      case 'cloud-invite':run(async()=>{const token=await signed().invite(selected),url=new URL(location.href);url.search='';url.searchParams.set('invite',token);url.hash='party';setModal('An invitation for the road',`<p>Anyone with this link can sign in and join for 7 days, unless you revoke it.</p>${field('Invitation link','link',url.href,'url','readonly')}<div class="cloud-actions">${btn('cloud-copy-invite','Copy link','btn btn-primary')}</div>${actions('Done')}`,()=>modal.close());});break;
      case 'cloud-copy-invite':run(async()=>{
        const input=modal.querySelector('[name="link"]');if(!input)return;
        try{await navigator.clipboard.writeText(input.value);}
        catch{
          input.focus();input.select();input.setSelectionRange(0,input.value.length);
          if(!document.execCommand('copy'))throw new Error('Couldn’t copy automatically. Touch and hold the selected invitation link to copy it.');
        }
        toast('Invitation link copied.');
      });break;
      case 'cloud-revoke':run(()=>signed().revoke(selected,el.dataset.id));break;
      case 'cloud-join':setModal('Join your companions',`${field('Invitation link or token','invitation','','text','required maxlength="2000"')}${actions('Join party')}`,data=>run(async()=>{const value=String(data.get('invitation'));let token=value;try{token=new URL(value).searchParams.get('invite')||value;}catch{}const id=await signed().join(token,user.displayName||'Adventurer');modal.close();chooseParty(id);}));break;
      case 'cloud-join-link':run(async()=>{const url=new URL(location.href),id=await signed().join(url.searchParams.get('invite'),user.displayName||'Adventurer');url.searchParams.delete('invite');history.replaceState(null,'',url);chooseParty(id);});break;
      case 'cloud-share':setModal('Share an adventurer',`<p>Only public sheet details and combat state are shared. Wait for pending cloud saves to finish first.</p>${getState().characters.map(c=>btn('cloud-share-character',esc(c.name),'character-option',`data-id="${esc(c.id)}"`)).join('')}`);break;
      case 'cloud-share-character':run(async()=>{if(sync.queue.length)throw new Error('Wait for pending saves, then try sharing again.');const partyId=selected;await signed().share(partyId,getState().characters.find(c=>c.id===el.dataset.id));modal.close();chooseParty(partyId);render();});break;
      case 'cloud-unshare':run(()=>signed().unshare(selected,el.dataset.id));break;
      case 'cloud-view':run(async()=>{const c=await signed().readShared(selected,el.dataset.id);setModal('Shared character sheet',`<div data-cloud-shared="${esc(c.id)}">${partyCard(c,true)}</div>`);const view=modal.querySelector('[data-cloud-shared]');view._details=c.sheet.details;view.dataset.detailsHash=c.detailsHash;});break;
      case 'cloud-leave':{
        const wasCreator=party.ownerId===user.uid;
        const leave=async successor=>{if(sync.queue.length)throw new Error('Wait for pending cloud saves before leaving.');for(const offer of party.transfers.filter(o=>o.senderId===user.uid&&['pending','declined'].includes(o.status)))await signed().reclaimTransfer(selected,offer.id,{cancel:true});for(const c of party.characters.filter(c=>c.ownerId===user.uid))await signed().unshare(selected,c.characterId);if(wasCreator){if(successor)await signed().transferAndLeave(selected,successor);else await signed().closeParty(selected);}else await signed().removeMember(selected,user.uid);stopParty();selected='';party=null;play.reset();if(modal.open)modal.close();};
        if(party.ownerId===user.uid){const others=party.members.filter(m=>m.uid!==user.uid);setModal('Leave your party?',others.length?`<p>Choose a new creator before leaving. Your shared characters will be removed. Private character ownership stays unchanged.</p><label class="form-field">New party creator<select name="successor" required>${others.map(m=>`<option value="${esc(m.uid)}">${esc(partyMemberLabel(m))}</option>`).join('')}</select></label>${actions('Transfer and leave')}`:`<p>You are the final member. Leaving will close the party and invalidate its invitations. Your private characters remain saved.</p>${actions('Leave and close party')}`,data=>run(()=>leave(String(data.get('successor')||''))));}else run(()=>leave(''));break;
      }
      case 'cloud-remove-member':run(()=>signed().removeMember(selected,el.dataset.id));break;
    }
    return true;
  }
  return {accountMarkup,characterMenuMarkup,partyMarkup,partyManagementMarkup,partySettingsMarkup:play.settingsMarkup,afterRender:play.mount,requestRest:play.requestRest,broadcastRoll:play.broadcastRoll,handle,statusText,storageKey:()=>accountKey(user?.uid),get user(){return user;},observe:hpActions=>sync?sync.observe(hpActions):true,external:()=>sync?.acceptExternal(),deferred:()=>{if(sync){sync.deliverDeferred();refresh();}},viewRoute:next=>{visibleRoute=next;},
    async start(){try{client=await createFirebaseClient();if(client)client.watch(next=>{changeUser(next).catch(error=>{accountError=authMessage(error);toast(accountError,true);});});else{accountError='Cloud accounts are disabled on this installation.';updateStatus();}}catch(error){accountError=authMessage(error);status={state:'guest',pending:0};updateStatus();}}
  };
}
