import {renderSkills} from './training-ui.js';
import {ensureTraining,trainingKey} from './training-rules.js';
import {SAVE_VERSION,RULES_URL,referenceURL,exhaustionPenalty,walkingSpeed,abilityCheckBonus,saveBonus,attackBonus,shortRest,COINS,calculateMoney,SHEET_TEXT,initiative,passivePerception,validDiceFormula,rollFeature,ABILITIES,SKILLS,CLASSES,XP,CONDITIONS,STORAGE_KEY,uid,mod,signed,proficiency,skillBonus,castingAbility,wikiURL,safeURL,demoCharacter,makeCharacter,parseBackup,rollDice,changeHP,longRest,clamp,randomDie} from './model.js';
import {initialState} from './default-characters.js';
import {inspirationPoints,inspirationLimit,gainInspiration,spendInspiration} from './model.js';
import {icon,conditionIcon} from './icons.js';
import {createConditionUsage} from './condition-usage.js';
import {ACTION_TYPES,actionTiming,sheetSpells} from './sheet-actions.js';
import {itemIconMarkup,attackIconMarkup,installItemIconFallbacks,itemIconPicker,updateItemIconPicker} from './item-icons.js';
import {isSheetFavorite,mountSheetLayout,refreshSheetLayout,toggleSheetSection,toggleSheetFavorite,jumpToSheetSection} from './sheet-layout.js';
import {campArt} from './art.js';
import {characterHero} from './character-hero.js';
import {portraitMarkup} from './portrait.js';
import {openPortraitMaker} from './portrait-ui.js';
import {SUBCLASSES,WEAPONS,ARMOR,applyStartingOptions,attackFromEquipment} from './catalog.js';
import {characterChoice,classPreview,catalogPicker,handleCatalogFilter,handleCatalogChoice,catalogBrowser,updateCatalogBrowser} from './catalog-ui.js';
import {playEffect,clearEffects,hpFeedback,effectGlyph} from './vfx.js';
import {openLevelUp} from './level-up-ui.js';
import {restRefreshes,restReminders} from './rest-rules.js';
import {MASTERIES,attackWeapon,attackMastery} from './attack-rules.js';
import {openAttack} from './attack-ui.js';
import {beginDice,presentDice,clearDice,diceColorPreferences,DEFAULT_DICE_COLORS} from './dice-roller.js';
import {sound,SOUND_CATEGORIES} from './sound.js';
import {rollSoundEvent,spellSoundEvent,equipSoundEvent} from './sound-events.js';
import {itemUses,removeEmptyItems,setItemQuantity,spendItemUse} from './inventory-rules.js';
import {packContents,unpackItem,itemAttack,saveItemAttack,linkWeaponActions,itemTool,addToolToInventory,toolCheck} from './inventory.js';
import {armorClass,armorClassDetails,itemDefense,setItemEquipped,armorTrainingEffects,armorCheckMode} from './armor-class.js';
import {CONTENT_SOURCES,contentEnabled} from './content-sources.js';
import {createCloudUI} from './cloud-ui.js';

installItemIconFallbacks();
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn = (action,label,cls='btn',attrs='') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const ext = (url,label,cls='') => safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer" class="${cls}">${label}</a>` : `<span class="${cls}">${label}</span>`;
const fmt = n => Number(n).toLocaleString();
function themeSelect(id='appearance') {
  return `<label class="theme-control" for="${id}"><span>Appearance</span><select id="${id}" data-theme-select>${[['system','System — follow device'],['light','Light — Daylight Adventurer'],['dark','Dark — Candlelit Adventurer']].map(([value,label])=>`<option value="${value}" ${window.QuestlogTheme.preference===value?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
const routes = {sheet:['Character sheet','sheet'],inventory:['Inventory','bag'],spells:['Spellbook','book'],journal:['Journal','journal'],dice:['Dice roller','dice'],party:['Party','people'],wiki:['Compendium','compass'],settings:['Settings','settings'],'party-manage':['Party management','people']};
let storageError = '';
let state;
try { const saved=localStorage.getItem(STORAGE_KEY);state=saved?parseBackup(saved):initialState(); }
catch { state=initialState();storageError='Your saved data could not be loaded. Saving is paused to preserve it. Import a backup, or start a character and enable saving in Settings when ready to replace the unreadable data.'; }
let storageBlocked = !!storageError;
const SHEET_HELP_KEY='questlog.sheet-help-dismissed';
let sheetHelpDismissed=false;
try {sheetHelpDismissed=localStorage.getItem(SHEET_HELP_KEY)==='true';} catch {}
sound.configure({enabled:state.settings.sound});
let route = Object.hasOwn(routes,location.hash.slice(1))?location.hash.slice(1):'sheet';
let filters=new Set(),query='',rollMode='normal',diceExpression='1d20',rollHistory=[],lastRoll=null;
let modalSubmit=null,installPrompt=null,trainingEditingId=null;
let cleanupSheetNavigation=()=>{};
const conditionUsage=createConditionUsage();
const character = () => state.characters.find(c=>c.id===state.activeId) || state.characters[0];
const modal = $('#modal');
const hpActions=new Map();
function trackedHP(c,amount,kind){changeHP(c,amount,kind);hpActions.set(c.id,{amount,kind});}

function persist({remote=false}={}) {
  state.characters.forEach(linkWeaponActions);
  if (storageBlocked) { toast('This sheet is temporary. Export a backup to keep your changes.',true);return false; }
  try {const serialized=JSON.stringify(state);if(new Blob([serialized]).size>2000000)throw new Error('Storage limit');if(!remote){if(!cloud.observe(hpActions))throw new Error('Cloud queue unavailable');hpActions.clear();}localStorage.setItem(cloud.storageKey(),serialized);storageError='';return true;}
  catch { storageError='Device storage is unavailable or full. Changes are in memory only. Download your characters from the character menu before closing this page.';toast('Couldn’t save on this device. Export a backup before leaving.',true);return false; }
}
function commit(message='') { persist();render();if(message)toast(message); }
function toast(message,error=false) {
  if(error)sound.play('ui.error');
  const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.innerHTML=icon(error?'flag':'check')+`<span>${esc(message)}</span>`;$('#toasts').append(el);setTimeout(()=>el.remove(),4800);
}
function equipItem(c,item,value) {
  for(const displaced of setItemEquipped(c,item,value))toast(`${displaced.name} unequipped.`);
}
function navigate(next) { if(!Object.hasOwn(routes,next))return;if(next!==route)trainingEditingId=null;clearEffects();clearDice();sound.stopAmbience();route=next;query='';filters.clear();location.hash=next;render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true}); }
function setModal(title,body,onSubmit=null,{hideTitle=false}={}) {
  sound.stopAmbience();
  clearEffects();
  modalSubmit=onSubmit;
  modal.innerHTML=`<form id="modal-form"><header class="modal-header${hideTitle?' modal-header-compact':''}"><h2 id="modal-title"${hideTitle?' class="visually-hidden"':''}>${title}</h2>${btn('close',icon('close'),'icon-btn','aria-label="Close dialog"')}</header><div class="modal-body">${body}<div id="form-error" role="alert" hidden></div></div></form>`;
  if(!modal.open)modal.showModal();
  modal.scrollTop=0;
  modal.querySelector('[autofocus], input:not([type="checkbox"]), textarea, select, button')?.focus({preventScroll:true});
}
const actions = (label='Save changes',extra='',cancelAction='close') => `<div class="modal-actions">${extra}${btn(cancelAction,'Cancel','btn btn-ghost')}<button class="btn btn-primary" type="submit">${icon('check')}${esc(label)}</button></div>`;
function field(label,name,value='',type='text',extra='') { return `<label class="form-field ${extra.includes('data-full')?'full':''}">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`; }
function select(label,name,values,value,extra='') { return `<label class="form-field">${label}<select name="${name}" ${extra}>${values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`; }
const textarea = (label,name,value,rows=5,maxlength=20000) => `<label class="form-field full">${label}<textarea name="${name}" rows="${rows}" maxlength="${maxlength}">${esc(value)}</textarea></label>`;
const num = (data,key) => Number(data.get(key));
const textValue = (data,key) => String(data.get(key)||'').trim();
const sheetEntry = (key,label) => `data-sheet-entry="${esc(key)}" data-sheet-label="${esc(label)}"`;
const BACKGROUND_KEYS = ['personalityTraits','ideals','bonds','flaws'];
function timingBadge(entry,kind) {
  const timing=actionTiming(entry,kind);
  return timing?`<span class="action-timing timing-${timing}">${ACTION_TYPES[timing]}</span>`:'';
}
function timingField(entry) {
  return `<label class="form-field">Action type<select name="actionType"><option value="">Automatic from notes / default</option>${Object.entries(ACTION_TYPES).map(([value,label])=>`<option value="${value}" ${entry.actionType===value?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
function conditionButton(c,name) {
  const active=c.conditions.includes(name);
  return btn('condition',conditionIcon(name), `condition-chip${active?' active':''}`,`data-condition="${name}" aria-label="${name}" aria-pressed="${active}" title="${name}: ${active?'clear':'apply'}"`);
}
function renderConditionControls(c) {
  const shortcuts=conditionUsage.shortcuts(c);
  const activeCount=c.conditions.length+(c.exhaustion?1:0);
  const moreLabel='All status effects'+(activeCount?` · ${activeCount} active`:'');
  return `<div class="condition-controls" ${sheetEntry('condition-controls','Condition shortcuts')}><div class="condition-tray" role="group" aria-label="Frequent conditions, active first">${shortcuts.map(name=>name==='Exhaustion'?btn('conditions',conditionIcon(name)+(c.exhaustion?`<span class="condition-level" aria-hidden="true">${c.exhaustion}</span>`:''),`condition-chip${c.exhaustion?' active':''}`,`data-exhaustion aria-label="Exhaustion level ${c.exhaustion}: edit" title="Exhaustion level ${c.exhaustion}: edit" aria-haspopup="dialog"`):conditionButton(c,name)).join('')}</div>${btn('conditions',icon('more')+(activeCount?'<span class="condition-overflow-dot" aria-hidden="true"></span>':''),'condition-more',`aria-label="${moreLabel}" title="${moreLabel}" aria-haspopup="dialog"`)}</div>`;
}
function itemUseButton(item) {
  const unpack=packContents(item).length>0,uses=itemUses(item);
  return btn(unpack?'unpack-item':'use-item',unpack?'Unpack':uses.maxUses?'Use 1':'Use','btn btn-sm',`data-id="${item.id}" aria-label="${unpack?'Unpack':'Use'} ${esc(item.name)}" ${item.qty===0||(!unpack&&uses.maxUses&&uses.usesLeft===0)?'disabled':''}`);
}
function itemUsesMarkup(item) {
  const uses=itemUses(item);
  return uses.maxUses?`<div class="item-uses"><meter min="0" max="${uses.maxUses}" value="${uses.usesLeft}" aria-label="${esc(item.name)} uses remaining"></meter><span>${uses.usesLeft} / ${uses.maxUses} uses${item.qty>1&&uses.consumeOnEmpty?' · current item':''}</span></div>`:'';
}
function showUnpack(item) {
  const contents=packContents(item);if(!contents.length||item.qty<1)return;
  setModal(`Unpack ${esc(item.name)}?`,`<p class="modal-intro">Open one pack and add these supplies to your inventory.</p><ul class="unpack-contents">${contents.map(({entry,qty})=>`<li><span class="item-symbol">${itemIconMarkup(entry)}</span><span>${esc(entry.name)}</span><strong>×${qty}</strong></li>`).join('')}</ul><p class="form-help">One pack will be used. Matching supplies stack together. A favorited pack stays in your inventory when empty.</p><div class="modal-actions">${btn('close','Keep packed','btn')}${btn('confirm-unpack-item',icon('bag')+'Unpack one','btn btn-primary',`data-id="${item.id}"`)}</div>`);
}
function itemUseTitle(item) {
  return `<span class="item-use-title"><span class="item-symbol" aria-hidden="true">${itemIconMarkup(item)}</span><span>Use ${esc(item.name)}${item.category==='Consumable'?'?':'.'}</span></span>`;
}
function showItemUse(item) {
  if(itemTool(item)){showToolUse(item);return;}
  const attacks=character().attacks.filter(a=>a.itemId===item.id);
  setModal(itemUseTitle(item),`${timingBadge(item,'item')}<p class="modal-intro">${esc(item.category)} · ${item.equipped?'Equipped':'In inventory'}</p>${item.description?`<div class="detail-paragraph">${esc(item.description)}</div>`:''}${item.wiki?ext(referenceURL(item.wiki,item.name,'equipment'),'Read the item rules '+icon('external'),'text-btn'):''}${attacks.map(a=>`<div class="item-attack-use">${btn('attack-roll',icon('dice')+'Attack with '+esc(a.name),'btn btn-primary',`data-id="${a.id}"`)}${btn('damage-roll',esc(a.damage)+' damage','btn',`data-id="${a.id}"`)}</div>`).join('')}<p class="form-help">Apply the item’s other effects at the table.</p><div class="modal-actions">${btn('close','Done','btn btn-primary')}${btn('item',icon('edit')+'Edit item','btn',`data-id="${item.id}"`)}</div>`);
}
function showToolUse(item) {
  const c=character(),entry=itemTool(item);if(!entry||item.qty<1)return;
  setModal(itemUseTitle(item),`<p class="modal-intro">${esc(entry.details)}</p><p class="tool-ability">Ability: <strong>${ABILITIES[entry.toolAbility]}</strong> · Base tool check ${signed(toolCheck(c,item).bonus)}</p><div class="form-grid"><label class="form-field">Relevant skill (only if the DM agrees)<select name="toolSkill"><option value="None">None</option>${Object.keys(SKILLS).map(name=>`<option value="${esc(name)}">${esc(name)} (${signed(skillBonus(c,name))})</option>`).join('')}</select></label>${select('Situational roll mode','toolMode',['normal','advantage','disadvantage'],'normal')}</div><p class="form-help">Skill choices show your skill bonuses. This tool always uses ${ABILITIES[entry.toolAbility]}. Your tool proficiency adds your proficiency bonus. If a proficient skill also applies, gain advantage. Proficiency is counted once; skill Expertise can double it. Exhaustion and untrained armor apply. This does not spend the tool or resolve crafting time or materials.</p>${actions('Roll check')}`,data=>{
    const check=toolCheck(c,item,{skill:textValue(data,'toolSkill')==='None'?'':textValue(data,'toolSkill')});
    const manual=textValue(data,'toolMode'),disadvantage=manual==='disadvantage'||c.conditions.includes('Poisoned');
    const mode=armorCheckMode(c,check.ability,check.advantage||manual==='advantage',disadvantage,check.skill);
    performRoll(`1d20${signed(check.bonus)}`,item.name+' · '+ABILITIES[check.ability]+(check.skill?' ('+check.skill+')':''),mode);
  });
}
function inventoryFavorite(c,item) {
  const favorite=isSheetFavorite(c,'pack',item.id);
  return btn('sheet-favorite',icon('star'),`sheet-favorite inventory-favorite${favorite?' active':''}`,`data-section="pack" data-entry="${item.id}" aria-pressed="${favorite}" aria-label="${favorite?'Remove':'Add'} ${esc(item.name)} ${favorite?'from':'to'} inventory favorites" title="${favorite?'Remove from':'Add to'} inventory favorites"`);
}
function concentrationBanner(c) {
  return c.concentration?`<div class="concentration-banner">${icon('spark')}Concentrating on <strong>${esc(c.concentration)}</strong>${btn('end-concentration',icon('close'),'icon-btn','aria-label="End concentration"')}</div>`:'';
}
function renderSheetActions(c) {
  const spells=sheetSpells(c);
  return (c.attacks.length?c.attacks.map(a=>renderAttack(c,a)).join(''):'')+
    concentrationBanner(c)+spells.map(s=>`<div class="action-row sheet-spell${c.concentration===s.name?' concentrating':''}" ${sheetEntry(s.id,s.name)}><div class="item-symbol">${itemIconMarkup(s,'spark')}</div><div class="action-info"><strong>${ext(referenceURL(s.wiki,s.name,'spell'),esc(s.name)+' '+icon('external'))}</strong>${timingBadge(s,'spell')}<small>${s.level===0?'Cantrip':'Level '+s.level}${s.range?' · '+esc(s.range):''} · ${esc(s.castingTime)||'Casting time not set'}</small>${s.concentration?`<small class="spell-concentration">${icon('spark')}${c.concentration===s.name?'Concentrating':'Requires concentration'}</small>`:''}</div>${btn('cast',icon('spark')+'Cast','btn btn-sm',`data-id="${s.id}" aria-label="Cast ${esc(s.name)}"`)}</div>`).join('')+
    (!c.attacks.length&&!spells.length?empty('sword','Your next move','Add a weapon attack or ready a spell in your spellbook.','attack','Add attack'):'')+
    (c.slots.some(s=>s.max)?`<div class="spell-peek" ${sheetEntry('spell-slots','Spell slots')}>${icon('spark')}Spell slots <strong>Level ${c.slots.findIndex(s=>s.max)+1}</strong>${slotDots(c.slots.find(s=>s.max),c.slots.findIndex(s=>s.max))}</div>`:'');
}
const coinName = key => key[0].toUpperCase()+key.slice(1);
const coinStud = key => `<img class="coin-stud" src="./assets/equipment/coin-${key}.webp" alt="" aria-hidden="true" width="160" height="160" decoding="sync">`;
const coinBalanceLabel=(c,key)=>`Edit ${coinName(key).toLowerCase()} pieces, ${fmt(c[key])} ${COINS[key].toUpperCase()}`;
function updateCoinBalances(c) {
  // Keep decoded coin images mounted when an editor saves a new balance.
  for(const balance of document.querySelectorAll('.coin-balance')) {
    const key=balance.dataset.denomination;
    balance.querySelector('strong').textContent=fmt(c[key]);
    balance.setAttribute('aria-label',coinBalanceLabel(c,key));
  }
}
function renderCoinBalances(c) {
  return `<span class="coin-balances">${Object.entries(COINS).map(([key,unit])=>`<button type="button" class="coin-balance" data-action="currency" data-denomination="${key}" aria-label="${coinBalanceLabel(c,key)}">${coinStud(key)}<strong>${fmt(c[key])}</strong><abbr title="${coinName(key)} pieces">${unit.toUpperCase()}</abbr></button>`).join('')}</span>`;
}
function empty(symbol,title,copy,action='',label='') { return `<div class="empty-state">${icon(symbol)}<h2>${title}</h2><p>${copy}</p>${action?btn(action,icon('plus')+label,'btn btn-primary'):''}</div>`; }
function pageHeading(title,buttons='') {return `<div class="page-heading"><div><h1>${esc(title)}</h1></div>${buttons?`<div class="heading-actions">${buttons}</div>`:''}</div>`;}

function renderChrome() {
  const c=character();
  $('#sidebar').innerHTML=`<a href="#sheet" class="brand" aria-label="Questlog home"><span class="brand-mark">${icon('dice')}</span><span class="brand-name">questlog</span></a><div class="brand-sub">YOUR POCKET ADVENTURE</div><div class="nav-label">ADVENTURE MENU</div><nav class="desktop-nav">${Object.entries(routes).slice(0,6).map(([key,[label,symbol]])=>btn('navigate',icon(symbol)+label,`nav-link${route===key?' active':''}`,`data-route="${key}" ${route===key?'aria-current="page"':''}`)).join('')}</nav><div class="nav-divider"></div><div class="nav-label">A LITTLE GUIDANCE</div>${btn('navigate',icon('compass')+'Compendium',`nav-link${route==='wiki'?' active':''}`,'data-route="wiki"')}<div class="sidebar-bottom"><div class="camp-card">${campArt()}<p>Even heroes need a break.</p><small>Rest up. The road can wait.</small>${btn('rest',icon('camp')+'Take a rest','', 'data-kind="short"')}</div>${themeSelect('sidebar-appearance')}<div class="sidebar-foot"><span>QUESTLOG / 2024 RULES</span>${btn('navigate',icon('settings'),'icon-btn','data-route="settings" aria-label="Settings"')}</div></div>`;
  $('#topbar').innerHTML=`<div class="breadcrumb">Your adventures ${icon('chevron')} <strong>${routes[route][0]}</strong></div><a class="mobile-brand" href="#sheet">${icon('dice')}questlog</a><div class="topbar-right"><span class="save-state" title="${storageError?'Changes are not saved':'Saved on this browser. Export a backup to move devices.'}"><span class="status-dot" style="${storageError?'background:var(--status-warning)':''}"></span>${storageError?'Unsaved · export a backup':'Saved on this device'}</span>${btn('characters',`<span class="mini-avatar">${portraitMarkup(c)}</span><span>${esc(c.name.split(' ')[0])}</span>${icon('down')}`,'character-switch','aria-label="Manage characters"')}</div>`;
  const mobile = [['sheet','sheet','Sheet'],['inventory','bag','Pack'],['spells','book','Spells'],['journal','journal','Journal'],['dice','dice','Roll'],['more','more','More']];
  $('#mobile-nav').innerHTML=mobile.map(([key,sym,label])=>btn(key==='more'?'more':'navigate',icon(sym)+`<span>${label}</span>`,`${route===key||(key==='more'&&['party','wiki','settings'].includes(route))?'active':''}`,`data-route="${key}" ${route===key?'aria-current="page"':''}`)).join('');
}
function render() {
  const partyRoll=route==='party'?$('#party-roll'):null;
  const partyControls=route==='party'?$('.party-roll-controls'):null;
  cloud.viewRoute(route);
  const previousSection=$('.sheet-header')?.dataset.activeSection;
  cleanupSheetNavigation();
  cleanupSheetNavigation=()=>{};
  const hasCharacter=!!character();
  document.body.classList.toggle('no-character',!hasCharacter);
  for(const id of ['sidebar','topbar','mobile-nav'])$('#'+id).hidden=!hasCharacter;
  $('.skip-link').textContent=hasCharacter?'Skip to character':'Skip to main content';
  if(!hasCharacter){
    for(const id of ['sidebar','topbar','mobile-nav'])$('#'+id).replaceChildren();
    $('#main').innerHTML=(storageError?`<div class="storage-warning">${esc(storageError)}</div>`:'')+(route==='settings'?renderSettings():route==='party'?cloud.partyMarkup():route==='party-manage'?cloud.partyManagementMarkup():renderLanding()+cloud.accountMarkup())+`<div class="cloud-actions">${btn('navigate','Home','btn btn-ghost','data-route="sheet"')}${btn('navigate','Account & settings','btn btn-ghost','data-route="settings"')}${btn('navigate','Party','btn btn-ghost','data-route="party"')}</div>`;
    document.title='Welcome · Questlog';
    cloud.afterRender();
    return;
  }
  renderChrome();
  const views={sheet:renderSheet,inventory:renderInventory,spells:renderSpells,journal:renderJournal,dice:renderDice,party:cloud.partyMarkup,'party-manage':cloud.partyManagementMarkup,wiki:renderWiki,settings:renderSettings};
  $('#main').innerHTML=(storageError?`<div class="storage-warning">${esc(storageError)} ${btn('export','Export current sheet','btn btn-sm')}</div>`:'')+views[route]();
  if(partyRoll&&$('#party-roll')?.dataset.partyId===partyRoll.dataset.partyId)$('#party-roll').replaceWith(partyRoll);
  if(partyControls&&partyRoll&&$('#party-roll')?.dataset.partyId===partyRoll.dataset.partyId)$('.party-roll-controls')?.replaceWith(partyControls);
  if(route==='sheet')cleanupSheetNavigation=mountSheetLayout($('#main'),character(),previousSection);
  if(route==='wiki')updateCatalogBrowser($('#main'),true,state.settings);
  document.title=`${routes[route][0]} · Questlog`;
  cloud.afterRender();
}
function renderLanding() {
  return `<section class="landing" aria-labelledby="welcome-title"><div class="landing-masthead"><div class="landing-brand"><span class="brand-mark">${icon('dice')}</span><span class="brand-name">questlog</span></div>${themeSelect('landing-appearance')}</div><div class="landing-intro"><p class="eyebrow">A JOURNAL FOR THE ROAD · 2024 RULES</p><h1 id="welcome-title">Your next adventure starts here.</h1><p>A place for your characters, their gear, and the stories along the way. Choose an adventurer to get started.</p></div><div class="landing-options">${[
    ['import','upload','Import a character','Bring your characters along from a Questlog JSON backup.'],
    ['new-character','plus','Create a new character','Start a fresh sheet and make the adventurer your own.']
  ].map(([action,symbol,title,copy])=>btn(action,`<span class="landing-option-icon">${icon(symbol)}</span><strong>${title}</strong><span class="landing-option-copy">${copy}</span><span class="landing-option-arrow" aria-hidden="true">${icon('chevron')}</span>`,'landing-option')).join('')}</div><p class="landing-note">${icon('shield')}Saved in this browser. No account needed. Export a backup to keep a copy.</p></section>`;
}
function slotDots(slot,level,small=false) {return `<div class="slot-dots">${Array.from({length:slot.max},(_,i)=>btn('slot','',`slot-dot${i<slot.used?' used':''}`,`aria-pressed="${i<slot.used}" data-level="${level}" data-used="${i<slot.used?i:i+1}" aria-label="${i<slot.used?'Restore':'Use'} level ${level+1} spell slot ${i+1}" title="${i<slot.used?'Restore':'Use'} a spell slot"`)).join('')}</div>`;}
function renderHero(c) {return characterHero(c,{editable:true});}

function renderSheetHeader(c) {
  const effects=[...c.conditions,...(c.exhaustion?['Exhaustion '+c.exhaustion]:[])];
  const health=`${c.hp} of ${c.maxHp} hit points${c.tempHp?`, plus ${c.tempHp} temporary hit points`:''}${c.hp===0?`. Death saves: ${c.deathSuccess} successes, ${c.deathFailure} failures`:''}`;
  const hpScale=Math.max(c.maxHp,c.hp+c.tempHp);
  return `<div class="sheet-header" role="region" aria-label="Character sheet quick access"><div class="sheet-status" role="group" aria-label="${esc(c.name)} status">
    ${btn('hp',`<span class="sheet-health-value">${icon('heart')}<strong>${c.hp}</strong><span>/ ${c.maxHp}</span>${c.tempHp?`<span class="sheet-temp-hp">+${c.tempHp}</span>`:''}</span>${c.hp||c.tempHp?`<span class="sheet-health-track" aria-hidden="true"><span class="hp-current" style="width:${c.hp/hpScale*100}%"></span>${c.tempHp?`<span class="hp-temp" style="width:${c.tempHp/hpScale*100}%"></span>`:''}</span>`:''}${c.hp===0?`<span class="sheet-death-summary" aria-hidden="true"><span>✓ ${c.deathSuccess}</span><span>✕ ${c.deathFailure}</span></span>`:''}`,`sheet-health${c.hp===0?' is-down':c.hp/c.maxHp<.3?' is-low':''}`,`data-kind="damage" aria-label="${health}. Manage hit points" title="${health}" aria-haspopup="dialog"`)}
    <div class="sheet-status-stat" aria-label="Armor class ${armorClass(c)}" title="Armor class ${armorClass(c)}">${icon('shield')}<span><small>AC</small><strong>${armorClass(c)}</strong></span></div>
    ${btn('sheet-jump',icon('boot')+`<span><small>Speed</small><strong>${walkingSpeed(c)}<small> ft</small></strong></span>`,'sheet-status-stat sheet-status-speed',`data-section="combat" aria-label="Walking speed ${walkingSpeed(c)} feet. Go to Status" title="Walking speed ${walkingSpeed(c)} feet"`)}
    <div class="sheet-status-effects">${btn('conditions',icon(effects.length?'flag':'check')+`<span>${effects.length||'OK'}</span>${c.exhaustion?`<span class="sheet-exhaustion">E${c.exhaustion}</span>`:''}`,`sheet-status-effect${effects.length?' has-conditions':''}`,`aria-label="${esc(effects.join(', ')||'No conditions')}. Manage status effects" title="${esc(effects.join(', ')||'No conditions')}" aria-haspopup="dialog"`)}</div>
    </div><nav class="sheet-section-nav" aria-label="Character sheet sections"></nav></div>`;
}
function renderSheet() {
  const c=character(),next=XP[c.level+1],pct=next?clamp((c.xp-XP[c.level])/(next-XP[c.level])*100,0,100):100;
  return renderSheetHeader(c)+pageHeading('Character Sheet',btn('rest',icon('camp')+'Rest','btn','data-kind="long"')+btn('level-up',icon('spark')+'Level up','btn btn-primary',''+(c.level>=20?'disabled':'')))+
    renderHero(c)+`<div class="xp-strip"><span class="xp-label">${icon('spark')}EXPERIENCE</span><div class="xp-progress" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><div class="xp-fill" style="width:${pct}%"></div></div><span class="xp-value"><strong>${fmt(c.xp)}</strong> / ${next?fmt(next)+' XP':'MAX LEVEL'}</span>${btn('xp',icon('plus')+'Add XP','xp-add')}<span class="passive-summary">${icon('eye')}Passive Perception <strong>${passivePerception(c)}</strong>${btn('passives',icon('edit'),'icon-btn','aria-label="Edit passive Perception bonus"')}</span></div>`+
    (sheetHelpDismissed?'':`<div class="sheet-layout-help">${icon('star')}<span>Star favorites to keep them visible when a section is collapsed. Tap a section title to collapse it.</span>${btn('dismiss-sheet-help',icon('close'),'icon-btn','aria-label="Dismiss favorites tip"')}</div>`)+
    `<section class="ability-section" data-sheet-section="abilities"><div class="section-heading"><h2>${icon('dice')}Abilities</h2><div class="ability-heading-tools"><span class="badge">Proficiency ${signed(proficiency(c.level))}</span>${c.exhaustion?`<span class="hint">Exhaustion −${exhaustionPenalty(c)}</span>`:''}${btn('abilities',icon('edit'),'icon-btn','aria-label="Edit abilities and saving throw proficiencies"')}</div></div><div class="ability-grid" data-sheet-group>${Object.entries(ABILITIES).map(([key,label])=>`<div class="sheet-tile ability-entry" ${sheetEntry(key,label)}>${btn('ability-roll',`<div class="ability-label">${label}</div><div class="ability-mod">${signed(mod(c.stats[key]))}</div><span class="ability-score">${c.stats[key]}</span>`,'ability-card',`data-key="${key}" aria-label="Roll a ${label} check, ${signed(abilityCheckBonus(c,key))}"`)}<div class="ability-save"><span class="save-proficiency" role="img" aria-label="${label} saving throw: ${c.saves.includes(key)?'proficient':'not proficient'}" title="Edit saving throw proficiency in abilities"><span class="prof-dot ${c.saves.includes(key)?'active':''}"></span></span>${btn('save-roll','<span class="save-label">Saving</span>'+icon('shield')+signed(saveBonus(c,key)),'save-roll',`data-key="${key}" aria-label="Roll ${label} saving throw, ${signed(saveBonus(c,key))}" title="Roll ${label} saving throw"`)}</div></div>`).join('')}</div></section>`+
    `<div class="dashboard-grid"><section class="panel" data-sheet-section="combat"><div class="panel-heading"><h2>${icon('heart')}Status</h2>${btn('combat-edit',icon('edit'),'icon-btn','aria-label="Edit combat stats"')}</div>${renderCombat(c)}</section><section class="panel" data-sheet-section="attacks"><div class="panel-heading"><h2>${icon('sword')}Attacks & actions</h2>${btn('attack',icon('plus'),'icon-btn','aria-label="Add an attack"')}</div>${renderSheetActions(c)}</section></div>`+
    `<div class="skills-grid">${renderSkills(c,{editing:trainingEditingId===c.id})}<div class="column">${renderFeatures(c)}</div></div>`;
}
function featureCharges(f) {
  if(f.maxUses<=12)return Array.from({length:f.maxUses},(_,i)=>btn('feature-use','',`slot-dot${i<f.used?' used':''}`,`data-id="${f.id}" data-used="${i<f.used?i:i+1}" aria-label="${i<f.used?'Restore':'Use'} ${esc(f.name)} charge ${i+1}"`)).join('');
  return `<div class="feature-counter">${btn('feature-use',icon('minus'),'icon-btn',`data-id="${f.id}" data-used="${f.used+1}" ${f.used>=f.maxUses?'disabled':''} aria-label="Spend one ${esc(f.name)} point"`)}<strong>${f.maxUses-f.used} / ${f.maxUses}</strong>${btn('feature-use',icon('plus'),'icon-btn',`data-id="${f.id}" data-used="${f.used-1}" ${f.used<=0?'disabled':''} aria-label="Restore one ${esc(f.name)} point"`)}${btn('feature', 'Set amount','text-btn',`data-id="${f.id}"`)}</div>`;
}
function renderFeatures(c) {
  return `<section class="panel" data-sheet-section="features"><div class="panel-heading"><h2>${icon('star')}Features & resources</h2>${btn('feature',icon('plus'),'icon-btn','aria-label="Add a feature or resource"')}</div><div class="features-list">${c.features.length?c.features.map(f=>`<div class="action-row" ${sheetEntry(f.id,f.name)}><div class="item-symbol">${itemIconMarkup(f,'star')}</div><div class="action-info"><strong>${ext(referenceURL(f.wiki,f.name,c.class),esc(f.name)+' '+icon('external'))}</strong>${timingBadge(f,'feature')}<small>${esc(f.description)}</small>${f.maxUses?`<div class="feature-uses">${featureCharges(f)}<small>${f.maxUses-f.used} / ${f.maxUses} remaining · Resets: ${f.reset==='manual'?'manually':f.reset+' rest'}${f.reset==='long'&&f.shortRestRecovery?' · +'+f.shortRestRecovery+' use(s) / short rest':''}</small></div>`:''}${f.rollFormula?btn('feature-roll',icon('dice')+esc(f.rollFormula)+(f.maxUses?' · Use & roll':' · Roll'),'btn btn-sm feature-roll',`data-id="${f.id}" ${f.maxUses&&f.used>=f.maxUses?'disabled':''} aria-label="Roll ${esc(f.name)}${f.maxUses?' and spend one use':''}"`):''}</div>${btn('feature',icon('edit'),'icon-btn',`data-id="${f.id}" aria-label="Edit ${esc(f.name)}"`)}</div>`).join(''):empty('star','A few special talents','Track class features, feats, maneuvers, and limited-use abilities.','feature','Add feature')}</div></section>`;
}
function showBackground() {
  const c=character();
  setModal('Background',`<p class="modal-intro">Personality & backstory</p><dl class="sheet-copy">${BACKGROUND_KEYS.map(key=>`<div><dt>${SHEET_TEXT[key]}</dt><dd class="${c[key]?'':'unset'}">${c[key]?esc(c[key]):'Not recorded yet.'}</dd></div>`).join('')}</dl><div class="modal-actions">${btn('close','Done','btn')}${btn('personality',icon('edit')+'Edit background','btn btn-primary')}</div>`);
}
function editSheetText(title,keys,{afterSave,cancelAction='close'}={}) {
  const c=character();setModal(title,`<div class="form-grid">${keys.map(key=>textarea(SHEET_TEXT[key],key,c[key],3)).join('')}</div>${actions('Save changes','',cancelAction)}`,data=>{for(const key of keys)c[key]=textValue(data,key);modal.close();commit('Character sheet updated.');afterSave?.();});
}
function editPassives() {
  const c=character();setModal('Passive Perception',`${field('Passive Perception bonus','passivePerceptionBonus',c.passivePerceptionBonus,'number','required min="-99" max="99" step="1"')}<p class="form-help">Passive Perception = 10 + Perception skill bonus + this adjustment. Current total: ${passivePerception(c)}.</p>${actions()}`,data=>{c.passivePerceptionBonus=num(data,'passivePerceptionBonus');modal.close();commit('Passive Perception updated.');});
}
function renderInspiration(c) {
  const points=inspirationPoints(c),limit=inspirationLimit(state.settings);
  const title='Spend 1 Heroic Inspiration to reroll one die immediately after rolling it; use the new roll. Track the reroll manually.';
  if(limit===1&&points<=1)return btn('inspiration',icon('inspiration')+'Heroic Inspiration',`btn btn-sm inspiration${points?' active':''}`,`${sheetEntry('inspiration','Heroic Inspiration')} aria-pressed="${!!points}" title="${title}"`);
  return `<div class="sheet-inline-entry inspiration-control" ${sheetEntry('inspiration','Heroic Inspiration')}><span class="inspiration${points?' active':''}" title="${title}">${icon('inspiration')}Heroic Inspiration <span class="inspiration-count" role="status">${points} / ${limit}</span></span><div class="quantity-stepper" role="group" aria-label="Heroic Inspiration points">${btn('inspiration',icon('minus'),'','data-change="spend" aria-label="Spend 1 Heroic Inspiration" '+(points?'':'disabled'))}${btn('inspiration',icon('plus'),'','data-change="gain" aria-label="Gain 1 Heroic Inspiration" '+(points>=limit?'disabled':''))}</div></div>`;
}
function renderCombat(c) {
  const hpScale=Math.max(c.maxHp,c.hp+c.tempHp),ac=armorClassDetails(c);
  return `<div class="combat-grid" data-sheet-group><div class="hp-block" ${sheetEntry('hp','Hit points')}><button type="button" class="hp-manage" data-action="hp" aria-label="${c.hp} of ${c.maxHp} hit points${c.tempHp?`, plus ${c.tempHp} temporary hit points`:''}. Apply damage, healing, or temporary HP" aria-haspopup="dialog"><span class="tiny-label hp-title">${icon('heart')}HIT POINTS${c.tempHp?` <span>+${c.tempHp} TEMP</span>`:''}</span><span class="hp-numbers"><strong>${c.hp}</strong><span>/ ${c.maxHp}</span></span><span class="hp-track${c.hp/c.maxHp<.3?' low':''}" role="progressbar" aria-label="Hit points" aria-valuemin="0" aria-valuemax="${c.maxHp}" aria-valuenow="${c.hp}" aria-valuetext="${c.hp} of ${c.maxHp} hit points${c.tempHp?`, plus ${c.tempHp} temporary hit points`:''}"><span class="hp-current" style="width:${c.hp/hpScale*100}%"></span>${c.tempHp?`<span class="hp-temp" style="width:${c.tempHp/hpScale*100}%"></span>`:''}</span></button></div><div class="combat-stat" ${sheetEntry('ac','Armor class')}><span class="tiny-label">ARMOR CLASS</span>${icon('shield')}<strong>${ac.total}</strong><small>${c.acOverride===undefined?'Automatic':'Override'}</small></div>${btn('initiative',`<span class="tiny-label">INITIATIVE</span>${icon('bolt')}<strong>${signed(initiative(c))}</strong><small>Tap to roll</small>`,'combat-stat',sheetEntry('initiative','Initiative'))}<div class="combat-stat" ${sheetEntry('speed','Speed')}><span class="tiny-label">SPEED</span>${icon('boot')}<strong>${walkingSpeed(c)}<span style="font-size:10px"> ft.</span></strong><small>Walking</small></div></div><div class="combat-notes" data-ac-breakdown aria-live="polite"><span>${esc(ac.summary)}${ac.warnings.map(warning=>`<br>${esc(warning)}`).join('')}</span></div><div class="status-row" data-sheet-group>${btn('conditions',icon(c.conditions.length||c.exhaustion?'flag':'check')+esc([...c.conditions,...(c.exhaustion?['Exhaustion '+c.exhaustion]:[])].join(', ')||'No conditions.'),'btn btn-sm condition-summary',`${sheetEntry('conditions','Conditions')} aria-haspopup="dialog"`)}${renderConditionControls(c)}${renderInspiration(c)}</div>${c.defenses?`<div class="combat-notes" ${sheetEntry('defenses',SHEET_TEXT.defenses)}><span>${esc(c.defenses)}</span></div>`:''}${c.hp===0?`<div class="death-saves" ${sheetEntry('death-saves','Death saving throws')}><div class="death-counter">Success ${Array.from({length:3},(_,i)=>btn('death-counter','',i<c.deathSuccess?'active':'',`data-kind="success" data-value="${i<c.deathSuccess?i:i+1}" aria-label="Set ${i+1} death save successes"`)).join('')}</div><div class="death-counter">Failure ${Array.from({length:3},(_,i)=>btn('death-counter','',i<c.deathFailure?'active':'',`data-kind="failure" data-value="${i<c.deathFailure?i:i+1}" aria-label="Set ${i+1} death save failures"`)).join('')}</div>${btn('death-roll',icon('dice')+'Death save','btn btn-sm',`${c.deathSuccess>=3||c.deathFailure>=3?'disabled':''}`)}${c.deathSuccess>=3||c.deathFailure>=3?`<div class="death-message">${c.deathFailure>=3?'Three failures. Check with your DM.':'Stable. You’re still at 0 HP.'}</div>`:''}</div>`:''}`;
}
function renderAttack(c,a) {const hit=attackBonus(c,a);return `<div class="action-row" ${sheetEntry(a.id,a.name)}><div class="item-symbol">${attackIconMarkup(a,undefined,c.items)}</div><div class="action-info">${btn('attack',esc(a.name),'',`data-id="${a.id}" style="padding:0;text-align:left;font-size:11px;font-weight:600;margin-bottom:5px" aria-label="Edit ${esc(a.name)}"`)}<small style="display:block">${esc(a.type)}${a.range?' · '+esc(a.range):''}${a.rollMode!=='normal'?' · '+esc(a.rollMode):''}</small>${timingBadge(a,'attack')}${a.notes?`<small class="attack-notes">${esc(a.notes)}</small>`:''}</div><div class="action-rolls">${btn('attack-roll',icon('dice')+signed(hit),'roll-button',`data-id="${a.id}" aria-label="Roll ${esc(a.name)} to hit"`)}${btn('damage-roll',esc(a.damage),'roll-button damage-button',`data-id="${a.id}" aria-label="Roll ${esc(a.name)} damage"`)}</div></div>`;}
function searchToolbar(placeholder,action='',label='') {return `<div class="toolbar"><label class="search-field">${icon('search')}<input id="search" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(query)}"></label>${action?btn(action,icon('plus')+label,'btn btn-primary'):''}</div>`;}
const FILTER_ICONS={All:'grid',Favorites:'star',Equipped:'check',Weapon:'sword',Armor:'shield',Gear:'bag',Consumable:'potion',Treasure:'coin',Pinned:'pin',Session:'journal',Quest:'flag',People:'people',Lore:'book',Personal:'sheet',Ready:'check',Cantrips:'spark',Concentration:'eye'};
function listToolbar(placeholder,choices) {
  return `<div class="list-toolbar">${searchToolbar(placeholder)}<div class="filter-tabs" role="group" aria-label="Filter types">${choices.map(f=>{const active=f==='All'?!filters.size:filters.has(f);return btn('filter',icon(FILTER_ICONS[f]),`filter-tab${active?' active':''}`,`data-filter="${f}" aria-label="${f}" title="${f}" aria-pressed="${active}"`);}).join('')}</div></div>`;
}
function matchesFilters(matches) {return !filters.size||[...filters].some(matches);}
function renderInventory() {
  const c=character(),weight=c.items.reduce((n,i)=>n+i.weight*i.qty,0),items=c.items.filter(i=>matchesFilters(f=>f==='Favorites'?isSheetFavorite(c,'pack',i.id):f==='Equipped'?i.equipped:i.category===f)&&(i.name+' '+i.description).toLowerCase().includes(query.toLowerCase()));
  return pageHeading('Inventory',btn('item',icon('plus')+'Add item','btn btn-primary'))+
    `<div class="summary-grid inventory-summary"><div class="summary-card">${icon('bag')}<div><strong>${c.items.reduce((n,i)=>n+i.qty,0)}</strong><small>Items carried</small></div></div><div class="summary-card">${icon('boot')}<div><strong>${weight.toLocaleString(undefined,{maximumFractionDigits:1})} <span style="font-size:12px">lb.</span></strong><small>Capacity ${c.stats.str*15} lb. ${weight>c.stats.str*15?'· Over capacity':''}</small></div></div><div class="summary-card currency-summary"><div class="coin-purse-heading"><span class="coin-purse-title">Coin purse</span>${btn('currency','Manage '+icon('chevron'),'text-btn','aria-label="Edit coin purse"')}</div>${renderCoinBalances(c)}</div></div>`+
    listToolbar('Search your inventory…',['All','Favorites','Equipped','Weapon','Armor','Gear','Consumable','Treasure'])+`<div class="panel inventory-list">${items.length?items.map(i=>`<div class="action-row" data-inventory-item="${i.id}"><div class="item-symbol">${itemIconMarkup(i)}</div><div class="action-info"><strong>${esc(i.name)}</strong><div class="inventory-details"><span class="badge">${i.category}</span><small>${i.weight} lb. each</small>${i.wiki?ext(referenceURL(i.wiki,i.name,'equipment'),'Rules '+icon('external'),'text-btn'):''}</div>${i.description?`<details class="inventory-description"><summary>Description<span class="inventory-description-preview" aria-hidden="true">${esc(i.description)}</span></summary><p class="inventory-stats">${esc(i.description)}</p></details>`:''}${itemUsesMarkup(i)}</div><div class="item-right"><div class="quantity-stepper">${btn('quantity',icon('minus'),'',`data-id="${i.id}" data-delta="-1" aria-label="Remove one ${esc(i.name)}" ${i.qty===0?'disabled':''}`)}<span>${i.qty}</span>${btn('quantity',icon('plus'),'',`data-id="${i.id}" data-delta="1" aria-label="Add one ${esc(i.name)}" ${i.qty>=99999?'disabled':''}`)}</div>${btn('equip',icon(i.equipped?'check':'plus')+(i.equipped?'Equipped':'Equip'),`equipped-btn${i.equipped?' active':''}`,`data-id="${i.id}" aria-pressed="${i.equipped}"`)}${i.category==='Weapon'||i.category==='Consumable'||i.equipped||itemTool(i)||itemUses(i).maxUses||packContents(i).length?itemUseButton(i):''}</div><div class="inventory-card-actions">${inventoryFavorite(c,i)}${btn('item',icon('edit'),'icon-btn inventory-edit',`data-id="${i.id}" aria-label="Edit ${esc(i.name)}"`)}</div></div>`).join(''):empty('bag',query?'No treasures found':'Travel light. Dream big.',query?'Try a different search or inventory filter.':'Add equipment, potions, and the curious things you find along the way.','item','Add item')}</div><p class="data-caption">Weight includes item quantities. Weapons have linked actions on your sheet. AC updates automatically from equipped armor, shields, and defensive items. Equipped weapons occupy hands; edit a stack to dual wield two of it. Standard carrying capacity is Strength × 15.</p>`;
}
function renderJournal() {
  const c=character(),notes=[...c.notes].filter(n=>matchesFilters(f=>f==='Pinned'?n.pinned:n.tag===f)&&(n.title+' '+n.body).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.updated)-Date.parse(a.updated));
  return pageHeading('Journal',btn('note',icon('plus')+'Write a note','btn btn-primary'))+listToolbar('Search your notes…',['All','Pinned','Session','Quest','People','Lore','Personal'])+`<div class="notes-grid">${notes.length?notes.map(n=>`<article class="note-card${n.pinned?' pinned':''}"><div class="note-card-head"><span class="badge">${esc(n.tag||'Note')}</span>${btn('pin-note',icon('pin'),`icon-btn${n.pinned?' pin-active':''}`,`data-id="${n.id}" aria-label="${n.pinned?'Unpin':'Pin'} ${esc(n.title)}" aria-pressed="${n.pinned}"`)}</div><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p><div class="note-card-footer"><time datetime="${esc(n.updated)}">${new Date(n.updated).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time><div>${btn('view-note','Read '+icon('arrow'),'text-btn',`data-id="${n.id}"`)}</div></div></article>`).join(''):empty('journal',query?'No notes found':'The page is yours.',query?'Try another phrase or a different category.':'Record your first session, a character secret, or a lead you can’t let go.','note','Write a note')}</div>`;
}
function renderSpells() {
  const c=character(),ability=castingAbility(c),spells=c.spells.filter(s=>matchesFilters(f=>f==='Ready'?s.prepared:f==='Cantrips'?s.level===0:f==='Concentration'&&s.concentration)&&(s.name+' '+s.school).toLowerCase().includes(query.toLowerCase()));
  return pageHeading('Spellbook',btn('spell',icon('plus')+'Add spell','btn btn-primary'))+
  `<div class="summary-grid"><div class="summary-card">${icon('spark')}<div><strong>${8+proficiency(c.level)+mod(c.stats[ability])}</strong><small>Spell save DC · ${ability.toUpperCase()}</small></div></div><div class="summary-card">${icon('bolt')}<div><strong>${signed(proficiency(c.level)+abilityCheckBonus(c,ability))}</strong><small>Spell attack bonus</small></div></div><div class="summary-card">${icon('book')}<div><strong>${c.spells.filter(s=>s.prepared).length}</strong><small>Prepared spells</small></div></div></div>`+
  `<section class="panel slot-panel"><strong>Spell slots</strong>${c.slots.some(s=>s.max)?c.slots.map((s,i)=>s.max?`<div class="slot-level">Level ${i+1}${slotDots(s,i)}</div>`:'').join(''):'<span style="font-size:11px;color:var(--muted)">Set your available spell slots.</span>'}${btn('slots','Edit slots','btn btn-sm')}</section>${c.concentration?`<div class="concentration-banner">${icon('spark')}Concentrating on <strong>${esc(c.concentration)}</strong>${btn('end-concentration',icon('close'),'icon-btn','aria-label="End concentration"')}</div>`:''}`+
  listToolbar('Find a spell…',['All','Ready','Cantrips','Concentration'])+`<div class="spell-grid">${spells.length?spells.map(s=>`<article class="spell-card"><div class="spell-card-head"><div class="item-symbol">${itemIconMarkup(s,'spark')}</div><div class="action-info"><h2>${ext(referenceURL(s.wiki,s.name,'spell'),esc(s.name)+' '+icon('external'))}</h2><small>${s.level===0?'Cantrip':`Level ${s.level}`} · ${esc(s.school)}${s.concentration?' · Concentration':''}</small>${timingBadge(s,'spell')}</div>${btn('spell',icon('edit'),'icon-btn',`data-id="${s.id}" aria-label="Edit ${esc(s.name)}"`)}</div><dl><div><dt>Casting time</dt><dd>${esc(s.castingTime)||'—'}</dd></div><div><dt>Range</dt><dd>${esc(s.range)||'—'}</dd></div><div><dt>Duration</dt><dd>${esc(s.duration)||'—'}</dd></div><div><dt>Availability</dt><dd>${s.prepared?'Prepared':'Not readied'}</dd></div></dl>${s.notes?`<p>${esc(s.notes)}</p>`:''}<div class="spell-card-foot">${btn('prepare',icon(s.prepared?'check':'plus')+(s.prepared?'Readied':'Ready spell'),`equipped-btn${s.prepared?' active':''}`,`data-id="${s.id}" aria-pressed="${s.prepared}"`)}${btn('cast',icon('spark')+'Cast spell','btn btn-primary btn-sm',`data-id="${s.id}"`)}</div></article>`).join(''):empty('book',query?'No spells found':'Begin your spellbook.',query?'Try a different search or spell filter.':'Add the spells your character knows. Each one can link to its Wikidot spell reference.','spell','Add spell')}</div><p class="data-caption">Slots are tracked manually so this works with your table’s class and multiclass rules. Warlocks can restore pact slots manually after a short rest. Readying a spell is a tracking aid, without enforcing class limits.</p>`;
}
function renderDice() {return pageHeading('Dice Roller')+`<div class="dice-layout"><section class="dice-tray"><div id="dice-stage" class="dice-stage-host"></div><div class="big-die" id="tray-die">${icon('dice')}<strong>${lastRoll?lastRoll.total:'20'}</strong></div><div class="dice-selection">${[4,6,8,10,12,20,100].map(d=>btn('select-die',icon('dice')+`d${d}`,`dice-select${diceExpression===`1d${d}`?' active':''}`,`data-sides="${d}"`)).join('')}</div><form id="dice-form" class="dice-form"><input id="dice-expression" name="expression" value="${esc(diceExpression)}" aria-label="Dice expression, for example 2d6 plus 3" maxlength="30" autocomplete="off" spellcheck="false"><button type="submit" class="btn btn-primary">${icon('dice')}Roll dice</button></form><div class="dice-modes">${['normal','advantage','disadvantage'].map(m=>btn('roll-mode',m[0].toUpperCase()+m.slice(1),`dice-mode${rollMode===m?' active':''}`,`data-mode="${m}" aria-pressed="${rollMode===m}"`)).join('')}</div><p class="roll-detail" id="roll-detail" aria-live="polite">${lastRoll?esc(rollBreakdown(lastRoll)):'Try 1d20+4, 2d6, or 4d6. The dice await.'}</p><p class="data-caption">Advantage & disadvantage apply to a single d20.</p></section><section class="panel"><div class="panel-heading"><h2>${icon('journal')}This session’s rolls</h2>${btn('clear-rolls','Clear','text-btn')}</div><div class="roll-history">${rollHistory.length?rollHistory.map(r=>`<div class="history-row"><div class="history-result">${r.total}</div><div><strong>${esc(r.label)}</strong><small>${esc(r.expression)}${r.mode!=='normal'?' · '+r.mode:''}${r.natural===20?' · Natural 20!':''}${r.natural===1?' · Natural 1':''}</small></div><time>${new Date(r.time).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time></div>`).join(''):`<div class="roll-history-empty" aria-label="No rolls yet">${icon('dice')}</div>`}</div></section></div>`;}
const wikiEntries=[['Classes','2024 progression & features.','people','classes'],['Spells','Revised spell descriptions.','spark','spells'],['Weapons','Properties & Weapon Mastery.','sword','weapons'],['Armor','Armor training & equipment.','shield','armor'],['Adventuring gear','Potions, tools, and supplies.','bag','adventuring-gear'],['Magic items','Current item rules.','star','wondrous-items'],['Backgrounds','Ability increases & Origin feats.','journal','backgrounds'],['Feats','Origin, General, and more.','bolt','feats'],['Species','Your character’s heritage.','leaf','species'],['Rules glossary','Conditions, rests, and actions.','compass','rules']];
function renderWiki() {
  const c=character();
  const books=[['2024 rules wiki','Revised classes, spells, feats & equipment.','book',RULES_URL],['Earlier 5e wiki','Earlier-book options & supplemental references.','compass','https://dnd5e.wikidot.com/'],['Free Basic Rules','General rules, actions & conditions.','people','https://www.dndbeyond.com/sources/dnd/br-2024']];
  return pageHeading('Compendium')+catalogBrowser(state.settings)+`<div class="adventure-tip">${icon('compass')}<div><strong>2024 core rules.</strong>References prefer Wikidot: the 2024 wiki for revised rules and the earlier 5e wiki for older options. General rules use the free Basic Rules where Wikidot has no matching page. Links open in a new tab and need an internet connection.</div></div><h2 class="wiki-section">Explore the 2024 rules</h2><div class="wiki-grid">${wikiEntries.map(([name,desc,sym,key])=>ext(wikiURL(key),icon(sym)+`<div><strong>${name}</strong><small>${desc}</small></div>`+icon('external'),'wiki-card')).join('')}</div><h2 class="wiki-section">More rules references</h2><div class="wiki-grid">${books.map(([name,desc,sym,path])=>ext(path,icon(sym)+`<div><strong>${name}</strong><small>${desc}</small></div>`+icon('external'),'wiki-card')).join('')}</div><h2 class="wiki-section">For ${esc(c.name)}</h2><div class="wiki-grid">${ext(wikiURL(c.class),icon('people')+`<div><strong>${esc(c.class)}</strong><small>2024 class progression & features</small></div>`+icon('external'),'wiki-card')}${c.spells.slice(0,5).map(s=>ext(referenceURL(s.wiki,s.name,'spell'),icon('spark')+`<div><strong>${esc(s.name)}</strong><small>Spell rules & descriptions</small></div>`+icon('external'),'wiki-card')).join('')}</div>`;
}
function sourceCount() {
  return `${CONTENT_SOURCES.filter(source=>!state.settings.hiddenSources?.includes(source.id)).length} of ${CONTENT_SOURCES.length} sources enabled`;
}
function renderContentSources() {
  return `<section class="content-source-settings" data-settings-section="sources" tabindex="-1" aria-labelledby="content-sources-title"><h3 id="content-sources-title">${icon('book')}Content sources</h3><p>Choose which books appear in the compendium and when adding feats, items, and other options. Existing characters keep all their content and can still use and edit it.</p><p class="form-help" data-source-count aria-live="polite">${sourceCount()}</p><div class="source-actions">${btn('sources-all','Enable all','btn btn-sm')}${btn('sources-none','Disable all','btn btn-sm')}</div><label class="form-field">Find a source<input type="search" data-source-search placeholder="Book title…" autocomplete="off"></label><div class="content-source-list">${CONTENT_SOURCES.map(source=>`<label class="check-field" data-source-row><input type="checkbox" data-content-source="${source.id}" ${state.settings.hiddenSources?.includes(source.id)?'':'checked'}><span>${esc(source.label)}</span></label>`).join('')}</div><p class="form-help" data-source-empty hidden>No sources match this search.</p></section>`;
}
function saveContentSources() {
  persist();
  const count=$('[data-source-count]');if(count)count.textContent=sourceCount();
}
function renderDiceColors() {
  const colors=diceColorPreferences.get();
  return `<section class="dice-color-settings" aria-labelledby="dice-colors-title"><h3 id="dice-colors-title">${icon('dice')}Dice colors</h3><p>Choose the dice and number colors for all your rolls. Saved in this browser.</p><div class="dice-color-controls"><div class="dice-color-preview" data-dice-color-preview role="img" aria-label="Dice color preview" style="--dice-body:${colors.body};--dice-numbers:${colors.numbers}"><span aria-hidden="true">20</span></div><div class="dice-color-fields">${[['body','Dice'],['numbers','Numbers']].map(([key,label])=>`<label class="dice-color-field"><span>${label}</span><input type="color" value="${colors[key]}" data-dice-color="${key}" aria-label="${label} color"><output data-dice-color-value="${key}">${colors[key]}</output></label>`).join('')}</div></div>${btn('reset-dice-colors','Reset dice colors','text-btn')}</section>`;
}
function updateDiceColors(update) {
  const saved=diceColorPreferences.set(update),colors=diceColorPreferences.get();
  for(const input of document.querySelectorAll('[data-dice-color]'))input.value=colors[input.dataset.diceColor];
  for(const output of document.querySelectorAll('[data-dice-color-value]'))output.value=colors[output.dataset.diceColorValue];
  for(const preview of document.querySelectorAll('[data-dice-color-preview]')) {
    preview.style.setProperty('--dice-body',colors.body);preview.style.setProperty('--dice-numbers',colors.numbers);
  }
  return saved;
}
function renderInspirationSettings() {
  return `<div class="setting-row">${icon('inspiration')}<div><strong>Heroic Inspiration</strong><p>Manual override for your table. The default limit is 1 point per character.</p><label class="form-field inspiration-limit-setting" for="inspiration-limit">Maximum points<input id="inspiration-limit" type="number" value="${inspirationLimit(state.settings)}" min="1" max="999" step="1" required aria-describedby="inspiration-limit-help"></label><p id="inspiration-limit-help">Choose 1–999. Lowering the limit keeps points already held.</p></div></div>`;
}
function renderSoundSettings() {
  const prefs=sound.getPreferences();
  const slider=(key,label,value)=>`<label class="sound-volume"><span>${esc(label)}</span><input type="range" min="0" max="100" step="1" value="${Math.round(value*100)}" data-audio-volume="${key}" aria-label="${esc(label)} volume"><output>${Math.round(value*100)}%</output></label>`;
  const previews=[
    ['dice.roll','Dice roll'],['dice.multiple','Multiple dice'],['dice.critical','Natural 20'],['dice.failure','Natural 1'],['combat.sword','Sword swing'],['combat.heavy','Heavy swing'],['combat.dagger','Dagger'],['combat.bow','Bow release'],['combat.blunt','Blunt impact'],['combat.unarmed','Unarmed hit'],['combat.damage','Taking damage'],['combat.miss','Miss'],['combat.critical','Critical hit'],['magic.cast','Spellcasting'],['magic.ice','Ice magic'],['magic.lightning','Lightning magic'],['magic.heal','Healing'],['magic.protect','Protective magic'],['progression.xp','Gain XP'],['progression.level','Level up'],['rest.short','Short rest complete'],['rest.long','Long rest complete'],['rest.campfire','Campfire (5 seconds)'],['inspiration.gain','Inspiration gained'],['inspiration.spend','Inspiration spent'],['resource.restore','Resource restored'],['item.potion','Potion'],
    ['item.equip','Equip gear'],['item.equip.weapon','Equip sword / blade'],['item.equip.dagger','Equip dagger'],['item.equip.bow','Equip bow'],['item.equip.wood','Equip wooden weapon'],['item.equip.metal','Equip metal weapon / tool'],['item.equip.shield','Equip shield'],['item.equip.armor','Equip metal armor'],['item.equip.leather','Equip leather armor'],['item.equip.cloth','Equip clothing'],['item.equip.pack','Equip pack / leather gear'],['item.equip.potion','Equip potion / bottle'],['item.equip.book','Equip book'],['item.equip.scroll','Equip scroll'],['item.equip.coin','Equip coins'],['item.equip.jewelry','Equip jewelry'],['item.equip.focus','Equip spellcasting focus'],
    ['condition.apply','Apply condition / increase Exhaustion'],['condition.clear','Clear condition / reduce Exhaustion'],
    ['item.coin','Coins'],['item.acquire','New item'],['item.consume','Consume item'],['book.page','Page turn'],['ui.confirm','Confirmation'],['ui.error','Error']
  ];
  return `<div class="sound-settings">${slider('master','Master',prefs.volume)}<details><summary>Audio categories</summary>${Object.entries(SOUND_CATEGORIES).map(([key,label])=>slider(key,label,prefs.categories[key])).join('')}</details><div class="sound-preview"><label class="form-field">Sound preview<select id="sound-preview-event">${previews.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>${btn('sound-preview',icon('sound')+'Test sound','btn btn-sm',state.settings.sound?'':'disabled')}</div><p class="form-help">Enable sound, then try a preview. Campfire ambience fades out automatically. Volume preferences stay on this device.</p></div>`;
}
function renderSettingsHeader() {
  const sections=[['account','people','Account'],['party','people','Party'],['preferences','settings','Preferences'],['sound','sound','Sound'],['sources','book','Content sources']];
  return `<header class="settings-header">${pageHeading('Settings')}<nav class="sheet-section-nav" aria-label="Settings sections">${sections.map(([key,symbol,label])=>btn('settings-jump',icon(symbol)+label,'sheet-section-link',`data-section="${key}"`)).join('')}</nav></header>`;
}
function jumpToSettingsSection(key) {
  const header=$('.settings-header'),target=$(`[data-settings-section="${CSS.escape(key)}"]`);
  if(!header||!target)return;
  const top=parseFloat(getComputedStyle(header).top)||0;
  target.style.scrollMarginTop=`${top+header.getBoundingClientRect().height+12}px`;
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function renderSettings() {return renderSettingsHeader()+`<div data-settings-section="account" tabindex="-1">${cloud.accountMarkup()}</div>`+cloud.partySettingsMarkup()+`<div class="settings-grid"><section class="panel" data-settings-section="preferences" tabindex="-1"><div class="panel-heading"><h2>${icon('settings')}Your preferences</h2></div><div class="setting-row appearance-setting">${icon('moon')}<div><strong>The light of your adventure</strong><p>The same journal, in daylight or by candlelight.</p>${themeSelect('settings-appearance')}</div></div>${renderDiceColors()}${renderInspirationSettings()}${storageBlocked?`<div class="panel-body">${btn('recover-storage','Enable saving for this sheet','btn btn-danger')}</div>`:''}<div class="setting-row" data-settings-section="sound" tabindex="-1">${icon('sound')}<div><strong>Sound effects</strong><p>Dice, steel, spells, and a moment by the fire.</p></div>${btn('sound','','toggle-switch'+(state.settings.sound?' active':''),`role="switch" aria-checked="${state.settings.sound}" aria-label="Sound effects"`)}</div>${renderSoundSettings()}${renderContentSources()}<div class="setting-row">${icon('people')}<div><strong>Your adventurers</strong><p>${state.characters.length} character${state.characters.length!==1?'s':''} saved in this browser.</p></div>${btn('characters','Manage','btn btn-sm')}</div><div class="setting-row">${icon('book')}<div><strong>Try the 2024 example</strong><p>Add the updated Ranger alongside your saved characters.</p></div>${btn('demo-2024','Add 2024 example','btn btn-sm')}</div><div class="setting-row">${icon('compass')}<div><strong>Take Questlog with you</strong><p>Install on your home screen for easy access.</p></div>${btn('install','How to','btn btn-sm')}</div></section></div>`;}

// Dialogs keep the on-sheet flows small enough for a thumb and a dice bag.
function showCharacters() {const c=character();setModal('Characters',`${state.characters.map(x=>`<div class="character-manager-row">${btn('switch-character',`<span class="mini-avatar">${portraitMarkup(x)}</span><div><strong>${esc(x.name)}</strong><small>Level ${x.level} ${esc(x.race)} ${esc(x.class)}</small></div>${icon(x.id===c?.id?'check':'chevron')}`,`character-option${x.id===c?.id?' active':''}`,`data-id="${x.id}"`)}${btn('delete-character',icon('trash')+'Delete','btn btn-sm btn-danger',`data-id="${x.id}" aria-label="Delete ${esc(x.name)}"`)}</div>`).join('')}<div class="modal-actions">${btn('new-character',icon('plus')+'New character','btn btn-primary')}${btn('export',icon('download')+'Download','btn')}${btn('import',icon('upload')+'Import','btn')}</div>${storageBlocked?btn('recover-storage','Enable saving for this sheet','btn btn-danger'):''}${cloud.characterMenuMarkup()}`);}
function deleteCharacter(id=state.activeId) {
  const c=state.characters.find(x=>x.id===id);
  if(!c)return;
  setModal('Delete character?',`<p class="character-delete-warning">Permanently delete <strong>${esc(c.name)}</strong> and all their stats, portrait, notes, items, and spells? This can’t be undone.</p><p class="modal-intro">Export a backup before deleting if you want to keep a copy.</p><p id="character-delete-help" class="modal-intro">Type <strong>${esc(c.name)}</strong> exactly to confirm.</p>${field('Character name to confirm deletion','characterName','','text','required maxlength="120" autocomplete="off" spellcheck="false" aria-describedby="character-delete-help"')}<div class="modal-actions">${btn('close','Keep character','btn')}<button type="submit" class="btn btn-danger" data-confirm-delete-character disabled>${icon('trash')}Delete character</button></div>`,data=>{
    if(!state.characters.some(x=>x.id===c?.id))throw new Error('This character is no longer available.');
    if(data.get('characterName')!==c.name)throw new Error('Type the character name exactly to confirm deletion.');
    state.characters=state.characters.filter(x=>x.id!==c.id);
    if(state.activeId===c.id){state.activeId=state.characters[0]?.id??null;query='';filters.clear();}
    modal.close();commit(c.name+' deleted.');
  });
  const input=modal.querySelector('[name="characterName"]'),submit=modal.querySelector('[data-confirm-delete-character]');
  input.addEventListener('input',()=>{submit.disabled=input.value!==c.name;});
  input.focus({preventScroll:true});
}
function editPortrait() {
  if(modal.open){$('#modal-form').requestSubmit();if(modal.open)return;}
  const c=character(),id=c.id;
  openPortraitMaker({character:c,onSave:portrait=>{
    const target=state.characters.find(item=>item.id===id);
    if(!target)throw new Error('This character is no longer available. Close the editor and choose a character.');
    const next={...state,characters:state.characters.map(item=>item.id===id?{...item,portrait}:item)};
    if(new Blob([JSON.stringify(next)]).size>2000000)throw new Error('This portrait would exceed the 2 MB save limit. Export a backup and remove unused entries first.');
    target.portrait=portrait;commit('Portrait saved for '+target.name+'.');
  }});
}
function editCharacter(isNew=false) {
  const c=isNew?makeCharacter():character();
  const classes=Object.keys(CLASSES).filter(name=>(!isNew&&name===c.class)||contentEnabled({name},state.settings,'class'));
  if(isNew){
    if(!classes.includes(c.class))c.class=classes[0]||'';
    for(const name of ['race','background'])if(!contentEnabled({name:c[name]},state.settings,name))c[name]='';
  }
  setModal(isNew?'A new story begins.':'Meet your adventurer.',`<p class="modal-intro">${isNew?'Choose a name and a calling. Then customize your stats, equipment, and spells on your sheet.':'The little details make a character your own.'}</p><div class="form-grid">${field('Character name','name',isNew?'':c.name,'text','required maxlength="120" data-full placeholder="What shall we call you?"')}${field('Player name','playerName',c.playerName,'text','maxlength="120"')}${field('Level','level',c.level,'number','required min="1" max="20" step="1"')}${field('Experience points','xp',c.xp,'number','required min="0" max="100000000" step="1"')}${characterChoice('Species / race','race',c.race,{required:true,settings:state.settings})}${select('Class','class',classes.length?classes:[''],c.class,'required')}${classPreview(c.class)}${characterChoice('Subclass','subclass',c.subclass,{entries:SUBCLASSES.filter(option=>option.className===c.class),settings:state.settings})}${characterChoice('Background','background',c.background,{settings:state.settings})}${select('Alignment','alignment',['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil','Unaligned'],c.alignment)}${field('Campaign','campaign',c.campaign,'text','maxlength="100"')}</div><p class="form-help">${isNew?'Class hit die, saving throws, armor and weapon training, and species speed and senses are filled in for a new character. HP starts at first level; set higher-level HP in Edit stats. Choose background ability increases, skill choices, feats, and features using the previews. Species traits and feats are recorded and applied manually.':'Dropdown previews show 2024 options; custom and earlier-book entries are supported. Changing an option doesn’t rebuild your existing stats, notes, or equipment. Edit hit die size, scores, spells, and features as needed. Set level and XP here when copying a sheet, or use Level up to gain HP as you advance.'}</p>${!isNew?btn('portrait',icon('edit')+'Make or edit portrait','btn portrait-details-action'):''}${actions(isNew?'Create character':'Save character',!isNew?btn('delete-character',icon('trash')+'Delete character','btn btn-danger left-action'):'')}`,data=>{
    c.playerName=textValue(data,'playerName');c.level=num(data,'level');c.xp=num(data,'xp');c.hitDice=Math.min(c.hitDice,c.level);c.name=textValue(data,'name');c.race=textValue(data,'race');c.class=textValue(data,'class');c.subclass=textValue(data,'subclass');c.background=textValue(data,'background');c.alignment=textValue(data,'alignment');c.campaign=textValue(data,'campaign');
    if(isNew){c.hitDice=c.level;applyStartingOptions(c);state.characters.push(c);state.activeId=c.id;}
    modal.close();route='sheet';location.hash='sheet';commit(isNew?'Your story starts here. Welcome, '+c.name+'.':'Character updated.');
  });
}
function editAbilities() {
  const c=character();
  setModal('A few natural talents.',`<p class="modal-intro">Edit your total scores, including background increases, feats, and item bonuses. Modifiers and proficient checks update automatically.</p><div class="form-grid">${Object.entries(ABILITIES).map(([key,label])=>field(label,key,c.stats[key],'number','required min="1" max="30" step="1"')).join('')}</div><fieldset class="training-group"><legend>Saving throw proficiencies</legend><div class="training-options">${Object.entries(ABILITIES).map(([key,label])=>`<label class="check-field"><input type="checkbox" name="saves" value="${key}" ${c.saves.includes(key)?'checked':''}>${label}</label>`).join('')}</div></fieldset><p class="form-help">Changing Constitution won’t recalculate maximum HP. Update it in your combat stats, including any retroactive hit point changes.</p>${actions()}`,data=>{
    for(const key of Object.keys(ABILITIES))c.stats[key]=num(data,key);
    c.saves=data.getAll('saves').filter(key=>Object.hasOwn(ABILITIES,key));
    modal.close();commit('Abilities updated.');
  });
}
function editCombat() {
  const c=character();
  setModal('Ready for the next encounter.',`<div class="form-grid">${field('Maximum hit points','maxHp',c.maxHp,'number','required min="1" max="9999" step="1"')}${field('Current hit points','hp',c.hp,'number','required min="0" max="9999" step="1"')}${field('Temporary hit points','tempHp',c.tempHp,'number','required min="0" max="9999" step="1"')}${field('AC adjustment (temporary or custom bonuses)','acBonus',c.acBonus||0,'number','required min="-99" max="99" step="1"')}${field('AC override (optional total)','acOverride',c.acOverride??'','number','min="0" max="99" step="1" placeholder="Leave blank for automatic AC"')}${field('Base walking speed (before Exhaustion, ft.)','speed',c.speed,'number','required min="0" max="999" step="1"')}${field('Initiative bonus (in addition to Dexterity)','initiativeBonus',c.initiativeBonus,'number','required min="-99" max="99" step="1"')}${select('Hit die size','hitDie',['d6','d8','d10','d12'],'d'+c.hitDie)}${field('Hit dice remaining','hitDice',c.hitDice,'number',`required min="0" max="${c.level}" step="1"`)}${textarea(SHEET_TEXT.defenses,'defenses',c.defenses,3)}</div><label class="check-field"><input name="initiativeAdvantage" type="checkbox" ${c.initiativeAdvantage?'checked':''}>Advantage on initiative</label><p class="form-help">AC ${armorClass(c)}: ${esc(armorClassDetails(c).summary)}. Armor, shields, equipped items, and ability scores update AC automatically. Leave the override blank to keep automatic AC. Previously recorded AC: ${c.ac}. Exhaustion reduces the displayed walking speed automatically.</p>${actions()}`,data=>{
    if(num(data,'hp')>num(data,'maxHp'))throw new Error('Current HP cannot exceed maximum HP.');
    c.initiativeAdvantage=data.has('initiativeAdvantage');
    if(textValue(data,'acOverride')==='')delete c.acOverride;else c.acOverride=num(data,'acOverride');
    for(const key of ['maxHp','hp','tempHp','acBonus','speed','hitDice','initiativeBonus'])c[key]=num(data,key);
    c.hitDie=Number(textValue(data,'hitDie').slice(1));c.defenses=textValue(data,'defenses');
    if(c.hp>0){c.deathSuccess=0;c.deathFailure=0;}
    modal.close();commit('Combat stats updated.');
  });
}

function showHP(kind='damage') {const c=character();setModal('Hit Points',`<div class="hp-modal-display">${c.hp} <small>/ ${c.maxHp} HP</small></div><div class="hp-modal-temp">${c.tempHp?c.tempHp+' temporary hit points':'No temporary hit points'}</div>${field('Amount','amount',1,'number','required min="0" max="9999" step="1" class="hp-input" autofocus')}<div class="hp-action-grid">${btn('hp-apply',icon('minus')+'Damage','btn btn-danger','data-kind="damage"')}${btn('hp-apply',icon('plus')+'Heal','btn btn-primary','data-kind="heal"')}${btn('hp-apply',icon('shield')+'Temp HP','btn','data-kind="temp"')}</div><p class="form-help">Damage uses temporary HP first. Temporary HP doesn’t stack; the higher value is kept. Check massive-damage and concentration rules with your DM.</p>`,data=>applyHP(data,kind));}
function applyHP(data,kind) {const c=character();const n=num(data,'amount');if(!Number.isInteger(n)||n<0||n>9999)throw new Error('Enter an amount from 0 to 9,999.');const before={hp:c.hp,tempHp:c.tempHp};trackedHP(c,n,kind);if(kind==='damage'&&n>0)sound.play('combat.damage');modal.close();commit(kind==='damage'?`${n} damage taken.`:kind==='heal'?`${n} healing applied.`:`Temporary HP is now ${c.tempHp}.`);showHPFeedback(before,kind);}
function showHPFeedback(before,kind,target='.hp-block') {
  const feedback=hpFeedback(before,character(),kind);
  if(feedback){if(feedback.kind==='heal')sound.play('magic.heal');else if(feedback.kind==='shield')sound.play('magic.protect');playEffect(feedback.kind,{...feedback,target});}
}
function showConditions() {
  const c=character();
  setModal('How are you holding up?',`<p class="modal-intro">Track your current conditions. Tap again to clear one.</p><div class="condition-grid">${CONDITIONS.map(v=>conditionButton(c,v)).join('')}</div><div style="margin-top:18px">${field('Exhaustion level (2024: 0–6)','exhaustion',c.exhaustion,'number','required min="0" max="6" step="1"')}</div><p class="form-help">2024 Exhaustion subtracts 2 per level from all D20 Tests and 5 feet per level from Speed. At level 6, the character dies. Sheet checks, saves (including death saves), attacks, initiative, passive Perception, and walking speed include these penalties. Ability scores, damage, and spell save DC stay unchanged. Apply penalties manually to custom dice rolls; other conditions are reminders. ${ext(wikiURL('rules'),'Read the 2024 conditions '+icon('external'))}</p>${actions('Done')}`,data=>{
    const level=num(data,'exhaustion'),before=c.exhaustion;
    if(level>before)conditionUsage.record('Exhaustion');
    c.exhaustion=level;modal.close();commit(c.exhaustion===6?'Exhaustion 6: the character dies. Check with your DM.':'Condition tracker updated.');
    if(level!==before)sound.play(level>before?'condition.apply':'condition.clear');
  });
}
function restRefreshList(rows,complete=false) {
  return `<ul class="rest-refresh-list">${rows.map(row=>`<li data-rest-refresh="${esc(row.key)}"><div><strong>${esc(row.title)}</strong><span class="rest-values">${esc(row.before)} → <b>${esc(row.after)}</b>${row.before===row.after?' <small>Unchanged</small>':''}</span>${row.detail?`<small class="rest-row-detail">${esc(row.detail)}</small>`:''}${row.cooldown&&!complete?'<small class="rest-cooldown">Check the special cooldown before restoring this resource.</small>':''}</div>${row.featureId&&!complete?`<label class="rest-restore"><input type="checkbox" name="restoreFeature" value="${esc(row.featureId)}" ${row.before!==row.after||!row.cooldown?'checked':''}>Restore</label>`:''}</li>`).join('')}</ul>`;
}
function restReminderList(reminders,complete=false,reviewed=[]) {
  return `<ul class="rest-reminder-list">${reminders.map(row=>`<li><label class="rest-reminder-check"><input type="checkbox" name="reviewedReminder" value="${esc(row.key)}" ${reviewed.includes(row.key)?'checked':''} aria-label="Reviewed ${esc(row.title)}"><span><strong>${esc(row.title)}</strong><span class="rest-reminder-detail">${esc(row.detail)}</span></span></label><div class="rest-reminder-links">${row.wiki?ext(row.wiki,'Rules '+icon('external')):''}${complete?btn('rest-review','Edit '+(row.featureId?'feature':row.target==='spells'?'spellbook':row.target==='inventory'?'inventory':row.target==='stats'?'stats':row.target==='conditions'?'conditions':'features'),'text-btn',`data-target="${esc(row.target)}" ${row.featureId?`data-id="${esc(row.featureId)}"`:''}`):''}</div></li>`).join('')}</ul>`;
}
function showRest(kind='short') {
  const c=character();
  if(c.hp<1) {toast('You need at least 1 HP to start a rest.',true);return;}
  const reminders=restReminders(c,kind),initial=restRefreshes(c,{kind}),defaultSkips=initial.filter(row=>row.cooldown).map(row=>row.featureId);
  const preview=restRefreshes(c,{kind,skipFeatureIds:defaultSkips});
  setModal(kind==='long'?'A well-earned night’s rest.':'Catch your breath.',`<div class="rest-illustration rest-${kind}"><div class="rest-sky" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>${campArt()}<span class="rest-moon" aria-hidden="true">${effectGlyph(kind==='long'?'moon':'camp')}</span><span class="rest-scene-label">${kind==='long'?'UNDER A QUIET SKY':'A MOMENT BY THE FIRE'}</span></div><div class="choice-buttons">${btn('rest','Short rest',`btn${kind==='short'?' btn-primary':''}`,'data-kind="short"')}${btn('rest','Long rest',`btn${kind==='long'?' btn-primary':''}`,'data-kind="long"')}</div>${kind==='long'?`<p class="form-help">A Long Rest normally takes 8 hours. Wait at least 16 hours after the previous Long Rest before starting another. Finish once your DM confirms the rest qualifies.</p><label class="check-field"><input name="reduceExhaustion" type="checkbox" checked>Remove one Exhaustion level if eligible</label><p class="form-help">Uncheck recovery when an effect prevents it, including unresolved dehydration or malnutrition.</p>`:`<p class="modal-intro" style="margin-top:18px">A Short Rest takes at least 1 hour. You have ${c.hitDice} d${c.hitDie} available, with ${signed(mod(c.stats.con))} Constitution per die.</p>${field('Hit dice to spend','dice',0,'number',`required min="0" max="${c.hitDice}" step="1"`)}`}<section class="rest-section" aria-labelledby="rest-refresh-title"><h3 id="rest-refresh-title">What will refresh</h3><p>Available amounts before → after this rest. Uncheck a resource if another rule blocks its recovery.</p><div id="rest-refresh-preview" aria-live="polite">${preview.length?restRefreshList(preview):'<p>No tracked resources to refresh.</p>'}</div></section>${reminders.length?`<section class="rest-section" aria-labelledby="rest-reminder-title"><h3 id="rest-reminder-title">${kind==='long'?'Long Rest reminders':'Short Rest reminders'}</h3><p>Review choices and effects for this character. These changes are yours to apply; checking a reminder marks it reviewed.</p>${restReminderList(reminders)}</section>`:''}${actions(kind==='long'?'Finish long rest':'Finish short rest')}`,data=>{
    const beforeHP=c.hp,beforeDice=c.hitDice;
    let hitDiceRoll=null;
    const skipFeatureIds=initial.filter(row=>row.featureId&&!data.getAll('restoreFeature').includes(row.featureId)).map(row=>row.featureId);
    const refreshed=restRefreshes(c,{kind,reduceExhaustion:data.has('reduceExhaustion'),skipFeatureIds});
    if(kind==='long')longRest(c,{reduceExhaustion:data.has('reduceExhaustion'),skipFeatureIds});
    else {
      const rolls=[];
      const healing=shortRest(c,num(data,'dice'),sides=>{const value=randomDie(sides);rolls.push(value);return value;},{skipFeatureIds});
      if(rolls.length) {
        const bonus=healing-rolls.reduce((sum,value)=>sum+value,0);
        hitDiceRoll=recordRoll({expression:`${rolls.length}d${c.hitDie}${bonus?signed(bonus):''}`,rolls,total:healing,bonus,mode:'normal',natural:null},'Short Rest · Hit Dice');
      }
      refreshed.unshift({key:'hp',title:'Hit points',before:beforeHP,after:c.hp},{key:'hit-dice',title:'Hit Dice',before:beforeDice,after:c.hitDice});
    }
    commit();
    setModal(kind==='long'?'Long rest complete.':'Short rest complete.',`<p class="modal-intro">${esc(c.name)} is ready for the road. Your sheet has been updated.</p><section class="rest-section" aria-labelledby="rest-refreshed-title"><h3 id="rest-refreshed-title">Refreshed & cleared</h3>${restRefreshList(refreshed,true)}</section>${reminders.length?`<section class="rest-section" aria-labelledby="rest-reminder-title"><h3 id="rest-reminder-title">Choices & reminders</h3><p>Work through these before your next adventure. Use Edit to update your sheet.</p>${restReminderList(reminders,true,data.getAll('reviewedReminder'))}</section>`:''}<div class="modal-actions">${btn('close','Done','btn btn-primary')}</div>`);
    sound.play(kind==='long'?'rest.long':'rest.short');
    const feedback=()=>playEffect(kind==='long'?'long-rest':'short-rest',{label:kind==='long'?'Rested & restored':'A moment of respite',detail:`${c.hp>beforeHP?'+'+(c.hp-beforeHP)+' HP · ':''}${kind==='long'?'A NEW DAY AWAITS':'READY FOR THE ROAD'}`});
    if(hitDiceRoll)afterRoll(hitDiceRoll,feedback);else feedback();
  });
  sound.startAmbience();
  for(const input of modal.querySelectorAll('[name="reduceExhaustion"], [name="restoreFeature"]'))input.addEventListener('change',()=>{
    const data=new FormData($('#modal-form'));
    const skipFeatureIds=initial.filter(row=>row.featureId&&!data.getAll('restoreFeature').includes(row.featureId)).map(row=>row.featureId);
    const rows=restRefreshes(c,{kind,reduceExhaustion:data.has('reduceExhaustion'),skipFeatureIds});
    for(const row of rows){const value=modal.querySelector(`[data-rest-refresh="${CSS.escape(row.key)}"] .rest-values`);if(value)value.innerHTML=`${esc(row.before)} → <b>${esc(row.after)}</b>${row.before===row.after?' <small>Unchanged</small>':''}`;const detail=modal.querySelector(`[data-rest-refresh="${CSS.escape(row.key)}"] .rest-row-detail`);if(detail)detail.textContent=row.detail;}
  });
}
function showXP() {const c=character();setModal('A little experience goes a long way.',`<p class="modal-intro">Currently ${fmt(c.xp)} XP. ${c.level<20?`Level ${c.level+1} starts at ${fmt(XP[c.level+1])} XP.`:'You’re a level 20 legend.'} Level up whenever your DM gives the word.</p><div class="form-grid">${field('Experience to add','amount',100,'number','required min="0" max="10000000" step="1"')}${field('Or set total XP','total','','number','min="0" max="100000000" step="1" placeholder="Leave blank to add"')}</div>${actions('Update experience')}`,data=>{const before=c.xp;c.xp=data.get('total')!==''?num(data,'total'):Math.min(100000000,c.xp+num(data,'amount'));modal.close();commit('Experience updated. Keep that adventure going.');if(c.xp>before){sound.play('progression.xp');playEffect('xp',{label:`+${fmt(c.xp-before)} XP`,detail:'EVERY CHAPTER COUNTS',target:'.xp-strip'});}});}
function showLevelUp() {openLevelUp(character(),{setModal,settings:state.settings,onComplete:()=>{persist();render();celebrate();}});}
function celebrate() {
  const c=character();
  setModal('A new chapter unlocked.',`<div class="celebration celebration-ascend"><div class="ascension-stage"><div class="ascension-sigil" aria-hidden="true">${effectGlyph('star')}</div><span class="ascension-kicker">THE ADVENTURE CONTINUES</span><div class="avatar-frame">${portraitMarkup(c)}<span class="level-badge">LVL ${String(c.level).padStart(2,'0')}</span></div><span class="ascension-level">LEVEL ${String(c.level).padStart(2,'0')}</span></div><h2>LEVEL UP!</h2><p>The road has changed you, ${esc(c.name.split(' ')[0])}.<br>And there’s still so much story left.</p><span class="badge">LEVEL ${c.level} ${esc(c.class).toUpperCase()} · ${c.maxHp} MAX HP</span><p>Check your class progression for new abilities, spells, and choices.</p>${ext(wikiURL(c.class),'View class progression '+icon('external'),'btn')}</div><div class="modal-actions">${btn('close','Onward, adventurer. '+icon('arrow'),'btn btn-primary')}</div>`);
  sound.play('progression.level');
  playEffect('level',{target:'.ascension-stage .avatar-frame',caption:false,sigil:false});
}

function itemDefenseFields(item) {
  const profile=itemDefense(item);
  return `<fieldset class="item-use-settings"><legend>Armor class & hands</legend><div class="form-grid"><label class="form-field">Base armor / shield<select name="armorId"><option value="">Automatic${profile.armor?' · '+esc(profile.armor.name):''}</option>${ARMOR.map(armor=>`<option value="${armor.id}" ${item.armorId===armor.id?'selected':''}>${esc(armor.name)}</option>`).join('')}</select></label>${field('AC bonus (blank = item default)','itemAcBonus',item.acBonus??'','number','min="-99" max="99" step="1" placeholder="Automatic"')}${select('Bonus applies','acCondition',['Always','Without armor or shield'],profile.condition)}${select('Wielding','wielding',['Automatic','One hand','Two hands','Dual wield (2 from stack)'],item.wielding||'Automatic')}</div><label class="check-field"><input name="requiresAttunement" type="checkbox" ${profile.requiresAttunement?'checked':''}>Requires attunement</label><label class="check-field"><input name="attuned" type="checkbox" ${item.attuned?'checked':''}>Attuned to this item</label><p class="form-help">Equip worn items and weapons currently in hand. AC bonuses apply while equipped and, when required, attuned. For magic armor choose its base armor; the bonus adds to that base. A shield uses one hand. Choose Dual wield to hold two weapons from one stack. Use the bonus field for other defensive items or conditional effects when active.</p></fieldset>`;
}
function updateItemDefenseFields(target) {
  if(target?.dataset.catalogPick!=='item')return;
  const input=name=>modal.querySelector(`[name="${name}"]`);
  if(!input('armorId'))return;
  const profile=itemDefense({catalogId:input('catalogId').value,name:input('name').value,category:input('category').value,qty:Number(input('qty').value)});
  input('armorId').value='';input('armorId').options[0].textContent='Automatic'+(profile.armor?' · '+profile.armor.name:'');
  input('itemAcBonus').value='';input('wielding').value='Automatic';input('acCondition').value=profile.condition;
  input('requiresAttunement').checked=profile.requiresAttunement;input('attuned').checked=false;
}
function editItem(id) {const c=character(),existing=c.items.find(i=>i.id===id),i=existing||{name:'',category:'Gear',qty:1,weight:0,equipped:false,description:'',wiki:''},uses=itemUses(i),defaults=attackFromEquipment(i,c),attack=itemAttack(c,i)||{...defaults,damage:defaults.damage||'1d6'};setModal(existing?'A closer look at your gear.':'Something for your pack.',`${catalogPicker('item',c,state.settings)}<input type="hidden" name="catalogId" value="${esc(i.catalogId||'')}"><div class="form-grid">${field('Item name','name',i.name,'text','required maxlength="200" data-full')}${timingField(i)}${select('Category','category',['Weapon','Armor','Gear','Consumable','Treasure'],i.category)}${field('Quantity','qty',i.qty,'number','required min="0" max="99999" step="1"')}${field('Weight each (lb.)','weight',i.weight,'number','required min="0" max="99999" step="any"')}${field('Reference link (optional)','wiki',i.wiki,'url','maxlength="2000" placeholder="https://dnd2024.wikidot.com/…"')}${textarea('Description / item notes','description',i.description,4)}</div>${itemDefenseFields(i)}<fieldset class="item-use-settings" data-item-attack-fields><legend>Weapon action</legend><p class="form-help">This weapon has a linked action on your sheet. Editing either keeps the weapon name and attack settings together. Removing the weapon removes its action.</p><div class="form-grid">${attackFields(c,attack)}</div></fieldset><fieldset class="item-use-settings"><legend>Limited uses</legend><div class="form-grid">${field('Uses per item (0 = unlimited)','maxUses',uses.maxUses,'number','required min="0" max="99999" step="1"')}${field('Uses remaining in current item','usesLeft',uses.usesLeft,'number','required min="0" max="99999" step="1"')}</div><label class="check-field"><input type="checkbox" name="consumeOnEmpty" ${uses.consumeOnEmpty?'checked':''}>Use up one item when its uses run out</label><p class="form-help">For kits and ammunition bundles, the next item starts full. Leave unchecked for rechargeable items; edit remaining uses when recharging.</p></fieldset>${itemIconPicker(i)}<label class="check-field"><input type="checkbox" name="equipped" ${i.equipped?'checked':''}>Equipped</label><p class="form-help">Drinking or administering a potion uses a Bonus Action under the 2024 rules. An ordinary Potion of Healing rolls 2d4 + 2 and heals this character. Other consumables reduce their quantity only.</p>${actions(existing?'Save item':'Add to pack',existing?btn('delete-entry',icon('trash'),'btn btn-danger left-action',`data-type="items" data-id="${id}" aria-label="Delete item"`):'')}`,data=>{
    const maxUses=num(data,'maxUses'),usesLeft=num(data,'usesLeft');if(usesLeft>maxUses)throw new Error('Remaining uses cannot exceed uses per item.');
    const attackFields=textValue(data,'category')==='Weapon'?readAttack(data):null;
    if(attackFields&&!itemAttack(c,i)&&c.attacks.length>=2000)throw new Error('Your action list is full. Remove an action before adding a weapon.');
    if(textValue(data,'wielding')==='Dual wield (2 from stack)'&&num(data,'qty')<2)throw new Error('Dual wielding from a stack requires at least two items.');
    const item={armorId:textValue(data,'armorId'),acCondition:textValue(data,'acCondition'),wielding:textValue(data,'wielding'),requiresAttunement:data.has('requiresAttunement'),attuned:data.has('attuned'),acBonus:textValue(data,'itemAcBonus')===''?undefined:num(data,'itemAcBonus'),...(attackFields?{weaponId:attackFields.weaponId}:{}),catalogId:textValue(data,'catalogId'),maxUses,usesLeft,consumeOnEmpty:data.has('consumeOnEmpty'),id:existing?.id||uid(),name:textValue(data,'name'),actionType:textValue(data,'actionType'),category:textValue(data,'category'),qty:num(data,'qty'),weight:num(data,'weight'),description:textValue(data,'description'),wiki:textValue(data,'wiki'),equipped:data.has('equipped'),iconKey:textValue(data,'iconKey')};if(item.maxUses&&item.consumeOnEmpty){if(!item.qty)item.usesLeft=0;else if(existing?.qty===0&&item.usesLeft===0)item.usesLeft=item.maxUses;}const acquired=!existing||item.qty>existing.qty,equipmentChanged=existing&&item.equipped!==existing.equipped;if(existing)Object.assign(existing,item);else c.items.push(item);equipItem(c,existing||item,item.equipped);if(attackFields)saveItemAttack(c,existing||item,attackFields);modal.close();commit(existing?'Item updated.':'A new addition to your pack.');if(acquired)sound.play('item.acquire');else if(equipmentChanged)sound.play(equipSoundEvent(item));
  });updateItemAttackFields();}
function editCurrency(denomination) {
  const c=character(),keys=Object.hasOwn(COINS,denomination)?[denomination]:Object.keys(COINS),before=Object.fromEntries(keys.map(key=>[key,c[key]]));
  const calculate=(key,value)=>{try{return calculateMoney(before[key],value);}catch(error){throw new Error(`${coinName(key)}: ${error.message}`);}};
  setModal('Coin Purse',`<p class="modal-intro" id="currency-help">Enter a total, <strong>+10</strong> to add, or <strong>−5</strong> to spend. You can also calculate <strong>25+10−5</strong>. ${keys.length===1?'':'Each coin type is counted separately.'}</p><div class="form-grid">${keys.map(key=>{const unit=COINS[key];return `<label class="form-field"><span class="coin-field-label">${coinStud(key)}${coinName(key)} pieces (${unit.toUpperCase()})</span><input name="${key}" type="text" value="${c[key]}" required maxlength="120" spellcheck="false" autocomplete="off" aria-describedby="currency-help ${key}-result" data-currency-input="${key}"><span class="coin-calculation" id="${key}-result" aria-live="polite">Balance: ${fmt(c[key])} ${unit.toUpperCase()}</span></label>`;}).join('')}</div>${actions(keys.length===1?'Update balance':'Update purse')}`,data=>{
    // Validate every denomination before changing any saved balance.
    const next=Object.fromEntries(keys.map(key=>[key,calculate(key,data.get(key))]));
    const studs=keys.map(denomination=>({denomination,amount:next[denomination]-before[denomination]})).filter(change=>change.amount);
    Object.assign(c,next);modal.close();
    if(persist()){renderChrome();updateCoinBalances(c);$('#main>.storage-warning')?.remove();}else render();
    toast('Coin purse updated.');
    if(studs.length){sound.play('item.coin');playEffect('money',{label:studs.map(({denomination,amount})=>`${amount>0?'+':'−'}${fmt(Math.abs(amount))} ${COINS[denomination].toUpperCase()}`).join(' · '),detail:'COIN PURSE UPDATED',target:'.coin-balances',sigil:false,studs});}
  });
  for(const input of modal.querySelectorAll('[data-currency-input]'))input.addEventListener('input',()=>{
    $('#form-error').hidden=true;
    const key=input.dataset.currencyInput,unit=COINS[key].toUpperCase(),result=modal.querySelector(`#${key}-result`);
    try {
      const total=calculate(key,input.value);input.removeAttribute('aria-invalid');
      result.classList.remove('coin-calculation-error');
      result.textContent=total===before[key]?`Balance: ${fmt(total)} ${unit}`:`${fmt(before[key])} ${unit} → ${fmt(total)} ${unit}`;
    } catch(error) {
      input.setAttribute('aria-invalid','true');result.classList.add('coin-calculation-error');result.textContent=error.message;
    }
  });
}

function editNote(id) {const c=character(),existing=c.notes.find(n=>n.id===id),n=existing||{title:'',body:'',tag:'Session',pinned:false};setModal(existing?'Back to the story.':'A page for your next adventure.',`<div class="form-grid">${field('Note title','title',n.title,'text','required maxlength="200" data-full placeholder="A name, a clue, a questionable plan…"')}${select('Category','tag',['Session','Quest','People','Lore','Personal'],n.tag)}${textarea('Your notes','body',n.body,10,100000)}</div><label class="check-field"><input name="pinned" type="checkbox" ${n.pinned?'checked':''}>Pin this note to your character sheet</label>${actions('Save note',existing?btn('delete-entry',icon('trash'),'btn btn-danger left-action',`data-type="notes" data-id="${id}" aria-label="Delete note"`):'')}`,data=>{const note={id:existing?.id||uid(),title:textValue(data,'title'),body:String(data.get('body')||''),tag:textValue(data,'tag'),pinned:data.has('pinned'),updated:new Date().toISOString()};if(existing)Object.assign(existing,note);else c.notes.unshift(note);modal.close();commit('A little piece of the story, saved.');});}
function viewNote(id) {const n=character().notes.find(n=>n.id===id);if(!n)return;sound.play('book.page');setModal(esc(n.title),`<div class="note-preview-tag">${esc(n.tag)} · ${new Date(n.updated).toLocaleDateString()}</div><div class="detail-paragraph">${esc(n.body)}</div><div class="modal-actions">${btn('close','Close','btn')}${btn('note',icon('edit')+'Edit note','btn btn-primary',`data-id="${n.id}"`)}</div>`);}
function attackFields(c,a) {
  const weaponId=attackWeapon(a)?.id||'',mastery=attackMastery(c,a);
  return `<label class="form-field">Weapon rules<select name="weaponId"><option value="">Custom / no weapon properties</option>${WEAPONS.filter(w=>w.id===weaponId||contentEnabled(w,state.settings,'item')).map(w=>`<option value="${w.id}" ${w.id===weaponId?'selected':''}>${esc(w.name)}</option>`).join('')}</select></label><label class="form-field">Unlocked mastery<select name="mastery"><option value="">None / not unlocked</option>${MASTERIES.map(m=>`<option value="${m}" ${m===mastery?'selected':''}>${m}</option>`).join('')}</select></label>${select('Attack ability','ability',Object.keys(ABILITIES),a.ability)}${select('Attack roll mode','rollMode',['normal','advantage','disadvantage'],a.rollMode)}${field('Additional attack bonus','bonus',a.bonus,'number','required min="-99" max="99" step="1"')}${field('Damage dice or fixed amount (include modifier)','damage',a.damage,'text','required maxlength="30" placeholder="1d8+4"')}${field('Damage type','type',a.type,'text','maxlength="100"')}${field('Range / reach','range',a.range,'text','maxlength="100"')}${textarea('Attack notes / alternate damage','notes',a.notes,3)}<label class="check-field"><input name="proficient" type="checkbox" ${a.proficient?'checked':''}>Add proficiency bonus for custom attacks</label>${select('Weapon proficiency','proficiencyMode',['auto','proficient','untrained'],a.proficiencyMode||'auto')}<p class="form-help">Auto uses your selections in Skills → Proficiencies for known weapons. Choose an override for a specific feature or table ruling.</p><p class="form-help">Select a mastery only when a feature unlocks it for this weapon. Weapon rules support renamed magic weapons; choose Custom for spells and natural attacks. Attack accuracy updates from your scores and proficiency; keep the saved damage formula’s ability modifier current. The guided attack checks Heavy, range, cover, conditions, critical hits, and mastery follow-ups. Exhaustion reduces accuracy, never damage.</p>`;
}
function readAttack(data) {
  const damage=textValue(data,'damage');
  if(!validDiceFormula(damage))throw new Error('Use damage dice like 1d8+4 or a fixed amount.');
  return {name:textValue(data,'name'),actionType:textValue(data,'actionType'),weaponId:textValue(data,'weaponId'),mastery:textValue(data,'mastery'),ability:textValue(data,'ability'),bonus:num(data,'bonus'),proficient:data.has('proficient'),proficiencyMode:textValue(data,'proficiencyMode'),rollMode:textValue(data,'rollMode'),damage,type:textValue(data,'type'),range:textValue(data,'range'),notes:textValue(data,'notes')};
}
function updateItemAttackFields(target) {
  const fields=modal.querySelector('[data-item-attack-fields]');
  if(!fields)return;
  const weapon=modal.querySelector('[name="category"]').value==='Weapon';
  fields.hidden=!weapon;fields.disabled=!weapon;
  if(target?.name==='weaponId'&&target.value){
    const item={name:modal.querySelector('[name="name"]').value,catalogId:modal.querySelector('[name="catalogId"]').value};
    const defaults=attackFromEquipment(item,character(),target.value);
    for(const [key,value] of Object.entries(defaults)){
      if(['name','actionType'].includes(key))continue;
      const input=fields.querySelector(`[name="${key}"]`);
      if(input){if(input.type==='checkbox')input.checked=value;else input.value=value;}
    }
  }
}
function editAttack(id) {
  const c=character(),existing=c.attacks.find(a=>a.id===id),a=existing||{name:'',ability:'str',bonus:0,proficient:true,damage:'1d6',type:'Slashing',range:'5 ft.',notes:'',rollMode:'normal',weaponId:'',mastery:''};
  const linked=c.items.find(item=>item.id===existing?.itemId);
  setModal(existing?'Fine-tune your attack.':'Your next move.',`${catalogPicker('attack',c,state.settings)}${linked?'<p class="form-help">Linked to your pack weapon. Its name and action type update here too.</p>':''}<div class="form-grid">${field('Attack name','name',a.name,'text','required maxlength="200" data-full')}${timingField(a)}${attackFields(c,a)}</div>${actions('Save attack',existing?btn('delete-entry',icon('trash'),'btn btn-danger left-action',`data-type="attacks" data-id="${id}" aria-label="Delete attack"`):'')}`,data=>{
    const attack={...readAttack(data),id:existing?.id||uid()};
    if(existing)Object.assign(existing,attack);else c.attacks.push(attack);
    if(linked){linked.name=attack.name;linked.actionType=attack.actionType;linked.weaponId=attack.weaponId;equipItem(c,linked,linked.equipped);}
    modal.close();commit('Attack ready.');
  });
}
function editFeature(id) {
  const c=character(),existing=c.features.find(f=>f.id===id),f=existing||{name:'',description:'',maxUses:0,used:0,reset:'long',wiki:'',rollFormula:'',shortRestRecovery:0};
  setModal(existing?'A special talent.':'What makes you extraordinary?',`${catalogPicker('feat',c,state.settings)}<div class="form-grid">${field('Feature / resource name','name',f.name,'text','required maxlength="200" data-full')}${timingField(f)}${field('Maximum uses / points (0 = unlimited)','maxUses',f.maxUses,'number','required min="0" max="999" step="1"')}${select('Refresh after','reset',['short','long','manual'],f.reset)}${field('Uses regained on Short Rest (long-rest resources)','shortRestRecovery',f.shortRestRecovery,'number','required min="0" max="999" step="1"')}${field('Uses already spent','used',f.used,'number','required min="0" max="999" step="1"')}${field('Dice formula (optional)','rollFormula',f.rollFormula,'text','maxlength="30" placeholder="1d8 or 1d10+3"')}${field('Reference link (optional)','wiki',f.wiki,'url','maxlength="2000"')}${textarea('What it does / your notes','description',f.description)}</div><p class="form-help">For superiority dice, enter 4 uses and 1d8. For 2024 Second Wind at Fighter level 3, enter 2 uses, long-rest refresh, 1 use regained on Short Rest, and 1d10+3. Rolling spends one use; apply healing or damage separately.</p>${actions('Save feature',existing?btn('delete-entry',icon('trash'),'btn btn-danger left-action',`data-type="features" data-id="${id}" aria-label="Delete feature"`):'')}`,data=>{
    const rollFormula=textValue(data,'rollFormula');if(rollFormula&&!validDiceFormula(rollFormula))throw new Error('Use a dice formula like 1d8 or 1d10+3.');
    if(num(data,'used')>num(data,'maxUses'))throw new Error('Used points cannot exceed maximum uses.');
    if(num(data,'shortRestRecovery')>num(data,'maxUses'))throw new Error('Short Rest recovery cannot exceed maximum uses.');
    const feature={id:existing?.id||uid(),shortRestRecovery:num(data,'shortRestRecovery'),name:textValue(data,'name'),actionType:textValue(data,'actionType'),description:textValue(data,'description'),maxUses:num(data,'maxUses'),used:num(data,'used'),reset:textValue(data,'reset'),wiki:textValue(data,'wiki'),rollFormula};
    if(existing)Object.assign(existing,feature);else c.features.push(feature);modal.close();commit('Feature saved.');
  });
}

function editSpell(id) {const c=character(),existing=c.spells.find(s=>s.id===id),s=existing||{name:'',level:1,school:'Evocation',castingTime:'1 action',range:'',duration:'Instantaneous',concentration:false,prepared:true,notes:'',wiki:''};setModal(existing?'A little spellcraft.':'A new spark of magic.',`<div class="form-grid">${field('Spell name','name',s.name,'text','required maxlength="200" data-full')}${field('Spell level (0 = cantrip)','level',s.level,'number','required min="0" max="9" step="1"')}${select('School','school',['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation','Other'],s.school)}${field('Casting time','castingTime',s.castingTime,'text','maxlength="100"')}${field('Range','range',s.range,'text','maxlength="100"')}${field('Duration','duration',s.duration,'text','maxlength="100"')}${field('2024 reference link (blank = Wikidot spell reference)','wiki',s.wiki,'url','maxlength="2000"')}${textarea('Spell notes','notes',s.notes,4)}</div><label class="check-field"><input name="concentration" type="checkbox" ${s.concentration?'checked':''}>Requires concentration</label><label class="check-field"><input name="prepared" type="checkbox" ${s.prepared?'checked':''}>Prepared and ready to cast</label>${actions('Save spell',existing?btn('delete-entry',icon('trash'),'btn btn-danger left-action',`data-type="spells" data-id="${id}" aria-label="Delete spell"`):'')}`,data=>{const name=textValue(data,'name'),spell={id:existing?.id||uid(),name,level:num(data,'level'),school:textValue(data,'school'),castingTime:textValue(data,'castingTime'),range:textValue(data,'range'),duration:textValue(data,'duration'),concentration:data.has('concentration'),prepared:data.has('prepared'),notes:textValue(data,'notes'),wiki:textValue(data,'wiki')||wikiURL(name,'spell')};if(existing){if(c.concentration===existing.name)c.concentration=spell.name;Object.assign(existing,spell);}else c.spells.push(spell);modal.close();commit('A little more magic in your spellbook.');});}
function editSlots() {const c=character();setModal('Magic for the road ahead.',`<p class="modal-intro">Enter maximum slots for each spell level. Used slots are kept up to the new maximum. Tap slot squares in your spellbook to spend or restore them.</p><div class="form-grid">${select('Spellcasting ability (auto = class default)','spellAbility',['auto','int','wis','cha','str','dex','con'],c.spellAbility)}${c.slots.map((s,i)=>field('Level '+(i+1)+' maximum','slot'+i,s.max,'number','required min="0" max="20" step="1"')).join('')}</div><p class="form-help">Use the 2024 class rules to check your spell progression, including multiclass and pact magic rules.</p>${actions('Save slots')}`,data=>{c.spellAbility=textValue(data,'spellAbility');c.slots.forEach((s,i)=>{s.max=num(data,'slot'+i);s.used=Math.min(s.used,s.max);});modal.close();commit('Spell slots updated.');});}
function castSpell(id) {const c=character(),s=c.spells.find(s=>s.id===id);if(!s)return;if(armorTrainingEffects(c).blocksCasting){toast('You cannot cast spells while wearing armor without training.',true);return;}const available=c.slots.map((slot,i)=>({slot,level:i+1})).filter(({slot,level})=>level>=s.level&&slot.used<slot.max);setModal(`Cast ${esc(s.name)}.`,`${s.concentration&&c.concentration?`<div class="concentration-banner">${icon('spark')}This will replace concentration on ${esc(c.concentration)}.</div>`:''}<p class="modal-intro">${s.level===0?'Cantrips don’t use a spell slot.':'Choose the slot you’re using. You can cast without a slot for rituals, scrolls, or a class feature if your table allows it.'}</p>${s.level>0?select('Cast using','slot',[...available.map(v=>'Level '+v.level),'No slot (ritual / item / feature)'],available[0]?'Level '+available[0].level:'No slot (ritual / item / feature)'):''}${s.notes?`<div class="detail-paragraph">${esc(s.notes)}</div>`:''}<p class="form-help">Apply the spell’s damage, healing, and other effects separately. ${ext(referenceURL(s.wiki,s.name,'spell'),'Read the full spell '+icon('external'))}</p>${actions('Cast spell')}`,data=>{if(armorTrainingEffects(c).blocksCasting)throw new Error('Remove armor without training before casting.');if(s.level>0&&String(data.get('slot')).startsWith('Level ')){const i=Number(String(data.get('slot')).slice(6))-1;if(!c.slots[i]||c.slots[i].used>=c.slots[i].max)throw new Error('That slot is no longer available.');c.slots[i].used++;}if(s.concentration)c.concentration=s.name;modal.close();commit(`${s.name} cast.${s.concentration?' You’re concentrating.':''}`);sound.play(spellSoundEvent(s));playEffect('spell',{label:s.name,detail:s.concentration?'CONCENTRATION BEGINS':'SPELL CAST',target:'.concentration-banner, .spell-grid'});});}

function rollBreakdown(r) {if(!r.rolls.length)return `Fixed result: ${r.total}`;return `${r.rolls.join(r.mode==='normal'?' + ':' & ')}${r.mode!=='normal'?` → ${r.mode==='advantage'?'higher':'lower'} die`:''}${r.bonus?' '+signed(r.bonus):''} = ${r.total}`;}
function performRoll(expression,label='Dice roll',mode='normal',inDialog=true,result=null,featureId='',partyOptions={}) {
  clearEffects();
  const r=recordRoll(result||rollDice(expression,mode),label,{celebrate:true,inlineParty:!inDialog&&route==='party',partyOptions});
  if(inDialog)setModal(esc(label),`<div class="roll-modal"><div class="roll-expression">${esc(r.expression)}${mode!=='normal'?' · '+mode:''}</div><div class="big-die">${icon('dice')}<strong>${r.total}</strong></div>${r.natural===20?'<div class="roll-critical">✦ NATURAL 20! ✦</div>':r.natural===1?'<div class="roll-critical fail">NATURAL 1. A NEW PLOT TWIST.</div>':''}<div class="roll-breakdown">${esc(rollBreakdown(r))}</div></div><div class="modal-actions">${btn('close','Keep adventuring','btn')}${featureId?btn('feature-roll',icon('dice')+'Use & roll again','btn btn-primary',`data-id="${featureId}" ${character().features.some(f=>f.id===featureId&&f.maxUses&&f.used>=f.maxUses)?'disabled':''}`):btn('reroll',icon('dice')+'Roll again','btn btn-primary',`data-expression="${esc(expression)}" data-label="${esc(label)}" data-mode="${mode}"`)}</div>`);
  else render();
  return r;
}
function afterRoll(result,callback) {
  result.finished.then(status=>{if(lastRoll===result&&status!=='cancelled')callback();});
}
function recordRoll(result,label,{criticalFeedback=true,celebrate=false,onReveal,inlineParty=false,partyOptions={}}={}) {
  const r={...result,label,time:Date.now()};lastRoll=r;rollHistory.unshift(r);rollHistory=rollHistory.slice(0,50);
  if(r.rolls.length)beginDice();
  cloud.broadcastRoll(r,label,{...partyOptions,inline:inlineParty}).catch(error=>toast('Party roll could not be shared: '+error.message,true));
  let finish;
  Object.defineProperty(r,'finished',{value:new Promise(resolve=>{finish=resolve;})});
  const event=rollSoundEvent(r,label);if(event)sound.play(event);
  // Rules and their callers finish rendering before the tray mounts (including combat dialogs).
  queueMicrotask(async()=>{
    if(lastRoll!==r){finish('cancelled');return;}
    const inDialog=modal.open,host=inlineParty?$('#party-roll'):inDialog?modal.querySelector('.modal-body'):$('#dice-stage');
    if(!host?.isConnected){clearDice();finish('cancelled');return;}
    const status=await presentDice(r,host);
    finish(status);
    if(lastRoll!==r||status==='cancelled')return;
    if(criticalFeedback&&r.natural===20)sound.play('dice.critical');else if(r.natural===1)sound.play('dice.failure');
    if(onReveal)onReveal();
    // Expensive celebration particles follow the throw, so software renderers can finish it.
    if(celebrate&&r.natural===20&&lastRoll===r&&host?.isConnected&&['settled','static'].includes(status))
      playEffect('critical',{label:'Natural 20!',detail:'A LEGENDARY ROLL',target:inDialog?'.big-die':'#tray-die'});
  });
  return r;
}
function startAttack(id,damageOnly=false) {
  const c=character(),attack=c.attacks.find(a=>a.id===id);if(!attack)return;
  openAttack({character:c,attack,modal,setModal,recordRoll,onChange:()=>commit(),damageOnly});
}
function exportBackup() {const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`questlog-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup downloaded. Keep it somewhere safe.');}
function confirmDelete(type,id) {
  const c=character(),entry=c[type]?.find(v=>v.id===id);if(!entry)return;
  if(type==='attacks'&&entry.itemId){confirmDelete('items',entry.itemId);return;}
  const linked=type==='items'&&itemAttack(c,entry);
  setModal('Leave this behind?',`<p class="modal-intro">Delete “${esc(entry.name||entry.title)}”? ${linked?'Its linked action will also be removed. ':''}This can’t be undone. Export a backup first if you want to keep a copy.</p><div class="modal-actions">${btn('close','Keep it','btn')}${btn('confirm-delete',icon('trash')+'Delete','btn btn-danger',`data-type="${type}" data-id="${id}"`)}</div>`);
}
function showInstall() {if(installPrompt){installPrompt.prompt();installPrompt.userChoice.finally(()=>{installPrompt=null;});return;}setModal('Your adventure, in your pocket.',`<p class="modal-intro">Open your hosted Questlog link on your phone, then add it to your home screen.</p><ul class="install-instructions"><li><strong>iPhone / iPad:</strong> In Safari, tap Share, then Add to Home Screen.</li><li><strong>Android:</strong> Open the browser menu, then Install app or Add to Home screen.</li><li>Open the app online and let it finish loading before heading off the grid.</li></ul><p class="form-help">If you already installed Questlog, open it from your home screen. Device data stays local; export and import to move characters between browsers.</p><div class="modal-actions">${btn('close','Got it','btn btn-primary')}</div>`);}

document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;
  const action=el.dataset.action,id=el.dataset.id,c=character();
  try {
    if(cloud.handle(action,el))return;
    switch(action){
      case 'sources-all':case 'sources-none':{
        state.settings.hiddenSources=action==='sources-none'?CONTENT_SOURCES.map(source=>source.id):[];
        document.querySelectorAll('[data-content-source]').forEach(input=>input.checked=action==='sources-all');
        saveContentSources();break;
      }
      case 'navigate':if(modal.open)modal.close();navigate(el.dataset.route);break;
      case 'close':modal.close();break;
      case 'characters':showCharacters();break;
      case 'settings-jump':jumpToSettingsSection(el.dataset.section);break;
      case 'more':setModal('More pages',`${btn('navigate',icon('compass')+'<div><strong>Compendium</strong></div>'+icon('chevron'),'character-option','data-route="wiki"')}${btn('navigate',icon('people')+'<div><strong>Party</strong></div>'+icon('chevron'),'character-option','data-route="party"')}${btn('navigate',icon('settings')+'<div><strong>Settings</strong></div>'+icon('chevron'),'character-option','data-route="settings"')}${btn('characters',icon('people')+'<div><strong>Characters</strong></div>'+icon('chevron'),'character-option')}`);break;
      case 'switch-character':trainingEditingId=null;clearEffects();state.activeId=id;modal.close();query='';filters.clear();commit('Ready when you are.');break;
      case 'demo-2024':{if(state.characters.length>=100){toast('This browser has 100 characters. Export a backup before removing any.',true);break;}const example=demoCharacter();state.characters.push(example);state.activeId=example.id;navigate('sheet');commit('2024 example added. Your other characters are preserved.');break;}
      case 'new-character':if(state.characters.length>=100){toast('This browser has 100 characters. Export a backup before removing any.',true);break;}editCharacter(true);break;
      case 'edit-character':editCharacter();break;
      case 'portrait':editPortrait();break;
      case 'delete-character':deleteCharacter(id);break;
      case 'sheet-collapse':if(el.dataset.section==='skills'&&trainingEditingId===c.id){trainingEditingId=null;toggleSheetSection(c,'skills');commit();break;}toggleSheetSection(c,el.dataset.section);persist();renderChrome();refreshSheetLayout($('#main'),c);break;
      case 'sheet-jump':{
        if(c.sheetLayout?.collapsed.includes(el.dataset.section)){toggleSheetSection(c,el.dataset.section);persist();renderChrome();refreshSheetLayout($('#main'),c);}
        jumpToSheetSection($('#main'),el.dataset.section);break;
      }
      case 'sheet-favorite':{
        toggleSheetFavorite(c,el.dataset.section,el.dataset.entry);const removed=removeEmptyItems(c);persist();if(removed){render();$('#main').focus({preventScroll:true});break;}if(route!=='sheet'){const key=el.dataset.entry;render();$(`#main [data-action="sheet-favorite"][data-entry="${key}"]`)?.focus({preventScroll:true});break;}renderChrome();refreshSheetLayout($('#main'),c);
        if(el.closest('[data-sheet-entry]')?.hidden)$('#main').querySelector(`[data-sheet-section="${el.dataset.section}"] .sheet-section-toggle`)?.focus({preventScroll:true});
        break;
      }
      case 'abilities':editAbilities();break;
      case 'combat-edit':editCombat();break;
      case 'background':showBackground();break;
      case 'personality':editSheetText('Edit background',BACKGROUND_KEYS,{afterSave:showBackground,cancelAction:'background'});break;
      case 'passives':editPassives();break;
      case 'dismiss-sheet-help':{sheetHelpDismissed=true;try{localStorage.setItem(SHEET_HELP_KEY,'true');}catch{}el.closest('.sheet-layout-help').remove();$('[data-sheet-section="abilities"] .sheet-section-toggle')?.focus({preventScroll:true});break;}
      case 'ability-roll':performRoll(`1d20${signed(abilityCheckBonus(c,el.dataset.key))}`,ABILITIES[el.dataset.key]+' check',armorCheckMode(c,el.dataset.key));break;
      case 'initiative':performRoll(`1d20${signed(initiative(c)+cloud.initiativeModifier())}`,'Roll for initiative',armorCheckMode(c,'dex',c.initiativeAdvantage));break;
      case 'skill-roll':performRoll(`1d20${signed(skillBonus(c,el.dataset.skill))}`,el.dataset.skill+' check',armorCheckMode(c,SKILLS[el.dataset.skill],false,false,el.dataset.skill));break;
      case 'save-roll':performRoll(`1d20${signed(saveBonus(c,el.dataset.key))}`,ABILITIES[el.dataset.key]+' saving throw',armorCheckMode(c,el.dataset.key));break;
      case 'training-edit':{const editing=trainingEditingId!==c.id;trainingEditingId=editing?c.id:null;if(editing&&c.sheetLayout?.collapsed.includes('skills')){toggleSheetSection(c,'skills');persist();}render();$('#main [data-action="training-edit"]')?.focus({preventScroll:true});break;}
      case 'skills-filter':{c.sheetLayout ||= {collapsed:[],favorites:{}};c.sheetLayout.skillsProficientOnly=!c.sheetLayout.skillsProficientOnly;commit();$('#main [data-action="skills-filter"]')?.focus({preventScroll:true});break;}
      case 'skills-tab':{c.sheetLayout ||= {collapsed:[],favorites:{}};if(!['skills','proficiencies','languages','tools'].includes(el.dataset.tab))break;c.sheetLayout.skillsTab=el.dataset.tab;commit();$(`#skills-tab-${el.dataset.tab}`)?.focus({preventScroll:true});break;}
      case 'add-tool':{addToolToInventory(c,el.dataset.tool);commit('Tool added to your pack.');break;}
      case 'custom-language':if(trainingEditingId!==c.id)break;setModal('Add a language',`${field('Language','language','','text','required maxlength="100"')}${actions('Add language')}`,data=>{const name=textValue(data,'language'),languages=ensureTraining(c).languages;if(languages.length>=100)throw new Error('Keep 100 languages or fewer.');if(!languages.some(value=>trainingKey(value)===trainingKey(name)))languages.push(name);modal.close();commit('Language added.');});break;
      case 'skill-prof':{if(trainingEditingId!==c.id)break;const key=el.dataset.skill;if(c.expertise.includes(key)){c.expertise=c.expertise.filter(s=>s!==key);c.skills=c.skills.filter(s=>s!==key);}else if(c.skills.includes(key))c.expertise.push(key);else c.skills.push(key);commit();break;}
      case 'hp':showHP(el.dataset.kind);break;
      case 'hp-apply':{const form=$('#modal-form');if(form.reportValidity())applyHP(new FormData(form),el.dataset.kind);break;}
      case 'inspiration':{
        const gaining=el.dataset.change==='gain'||(!el.dataset.change&&!inspirationPoints(c));
        if(!(gaining?gainInspiration(c,state.settings):spendInspiration(c)))break;
        commit(gaining?'Heroic Inspiration ready: reroll one die immediately after rolling it.':'Heroic Inspiration spent: use the new die roll.');
        sound.play(gaining?'inspiration.gain':'inspiration.spend');playEffect(gaining?'inspiration':'inspiration-spent',{label:gaining?'Inspired!':'Inspiration unleashed',detail:gaining?'YOUR NEXT GREAT MOMENT AWAITS':'MAKE THIS ROLL COUNT',target:'.inspiration'});break;
      }
      case 'conditions':showConditions();if(el.hasAttribute('data-exhaustion'))$('#modal [name="exhaustion"]')?.focus();break;
      case 'condition':{
        const name=el.dataset.condition;
        if(!CONDITIONS.includes(name))break;
        const active=!c.conditions.includes(name);
        c.conditions=active?[...c.conditions,name]:c.conditions.filter(value=>value!==name);
        if(active)conditionUsage.record(name);
        sound.play(active?'condition.apply':'condition.clear');
        el.classList.toggle('active',active);
        el.setAttribute('aria-pressed',String(active));
        el.title=`${name}: ${active?'clear':'apply'}`;
        persist();render();
        const shortcut=$(`.condition-tray [data-condition="${name}"]`);
        const target=el.isConnected?el:shortcut?.getClientRects().length?shortcut:$('.condition-more');
        target?.focus({preventScroll:true});
        playEffect('condition',{label:name,detail:active?'CONDITION APPLIED':'CONDITION CLEARED',target});
        break;
      }
      case 'death-counter':c[el.dataset.kind==='success'?'deathSuccess':'deathFailure']=Number(el.dataset.value);commit();break;
      case 'death-roll':{if(c.hp>0||c.deathSuccess>=3||c.deathFailure>=3)break;const before={hp:c.hp,tempHp:c.tempHp};const r=performRoll(`1d20${signed(-exhaustionPenalty(c))}`,'Death saving throw');if(r.natural===20){trackedHP(c,1,'heal');}else if(r.total>=10)c.deathSuccess=Math.min(3,c.deathSuccess+1);else c.deathFailure=Math.min(3,c.deathFailure+(r.natural===1?2:1));commit();if(r.natural===20)afterRoll(r,()=>{toast('Natural 20! You regain 1 HP.');showHPFeedback(before,'heal','.big-die');});break;}
      case 'rest':if(modal.querySelector('.rest-illustration')||!cloud.requestRest(el.dataset.kind||'short'))showRest(el.dataset.kind);break;
      case 'rest-review':modal.close();if(id)editFeature(id);else if(el.dataset.target==='stats')editCombat();else if(el.dataset.target==='conditions')showConditions();else {navigate(el.dataset.target==='features'?'sheet':el.dataset.target);if(el.dataset.target==='features')document.querySelector('[data-sheet-section="features"]')?.scrollIntoView({block:'start'});}break;
      case 'xp':showXP();break;
      case 'level-up':showLevelUp();break;
      case 'item':editItem(id);break;
      case 'currency':editCurrency(el.dataset.denomination);break;
      case 'quantity':{const item=c.items.find(i=>i.id===id);if(!item)break;const before=item.qty;setItemQuantity(c,item,item.qty+Number(el.dataset.delta));commit();if(item.qty>before)sound.play('item.acquire');break;}
      case 'equip':{const item=c.items.find(i=>i.id===id);equipItem(c,item,!item.equipped);commit();sound.play(equipSoundEvent(item));break;}
      case 'unpack-item':{const item=c.items.find(i=>i.id===id);if(item)showUnpack(item);break;}
      case 'confirm-unpack-item':{const result=unpackItem(c,id);if(!result)break;modal.close();commit(result.pack.name+' unpacked.');sound.play('item.acquire');playEffect('unpack',{label:'Supplies ready',detail:result.pack.name,pack:result.pack,contents:result.contents.map(({entry})=>entry),sigil:false});break;}
      case 'use-item':{const item=c.items.find(i=>i.id===id);if(!item||item.qty<1)break;const uses=itemUses(item);if(uses.maxUses){if(!uses.usesLeft)break;setModal(itemUseTitle(item),`${itemUsesMarkup(item)}<p class="modal-intro">Spend one use.${uses.consumeOnEmpty?' The item is used up when its counter reaches zero.':''}</p>${item.description?`<div class="detail-paragraph">${esc(item.description)}</div>`:''}<p class="form-help">Apply the item’s effects at the table.</p><div class="modal-actions">${btn('close','Save it','btn')}${btn('confirm-use-item','Spend one use','btn btn-primary',`data-id="${id}"`)}</div>`);break;}if(item.category!=='Consumable'){showItemUse(item);break;}setModal(itemUseTitle(item),`<p class="modal-intro">This will use one item from your pack. ${/^potion of healing$/i.test(item.name)?'As a Bonus Action, drink it to roll 2d4 + 2 and restore that much HP to this character.':'Apply its effects at the table.'}</p><div class="modal-actions">${btn('close','Save it','btn')}${btn('confirm-use-item','Use item','btn btn-primary',`data-id="${id}"`)}</div>`);break;}
      case 'confirm-use-item':{const item=c.items.find(i=>i.id===id);if(!item||!spendItemUse(c,item))break;sound.play(/potion/i.test(item.name)?'item.potion':'item.consume');if(/^potion of healing$/i.test(item.name)){const before={hp:c.hp,tempHp:c.tempHp};const r=performRoll('2d4+2','Potion of healing');trackedHP(c,r.total,'heal');commit();afterRoll(r,()=>{toast(`${r.total} healing. A little better already.`);showHPFeedback(before,'heal','.big-die');});}else{modal.close();commit(item.name+' used.');}break;}
      case 'note':editNote(id);break;
      case 'view-note':viewNote(id);break;
      case 'pin-note':{const n=c.notes.find(n=>n.id===id);n.pinned=!n.pinned;commit(n.pinned?'Note pinned to your sheet.':'Note unpinned.');break;}
      case 'attack':editAttack(id);break;
      case 'attack-roll':startAttack(id);break;
      case 'damage-roll':startAttack(id,true);break;
      case 'feature':editFeature(id);break;
      case 'feature-roll':{const f=c.features.find(f=>f.id===id);if(!f?.rollFormula)break;const result=rollFeature(f);performRoll(f.rollFormula,f.name,'normal',true,result,f.id);commit();break;}
      case 'feature-use':{const f=c.features.find(f=>f.id===id),before=f.used;f.used=clamp(Number(el.dataset.used),0,f.maxUses);commit();if(f.used<before)sound.play('resource.restore');if(f.used!==before)playEffect('resource',{label:f.name,detail:f.used>before?'POWER SPENT':'POWER RESTORED',target:`[data-sheet-entry="${CSS.escape(id)}"]`});break;}
      case 'spell':editSpell(id);break;
      case 'prepare':{const s=c.spells.find(s=>s.id===id);s.prepared=!s.prepared;commit();break;}
      case 'slots':editSlots();break;
      case 'slot':{const index=Number(el.dataset.level),slot=c.slots[index],before=slot.used;slot.used=clamp(Number(el.dataset.used),0,slot.max);commit();if(slot.used<before)sound.play('resource.restore');if(slot.used!==before)playEffect('spell',{label:`Level ${index+1} slot`,detail:slot.used>before?'MAGIC EXPENDED':'MAGIC RESTORED',target:'.slot-panel, .spell-peek'});break;}
      case 'cast':castSpell(id);break;
      case 'end-concentration':c.concentration='';commit('Concentration ended.');break;
      case 'filter':{const value=el.dataset.filter;if(value==='All')filters.clear();else if(filters.has(value))filters.delete(value);else filters.add(value);render();[...document.querySelectorAll('.list-toolbar [data-filter]')].find(node=>node.dataset.filter===value)?.focus({preventScroll:true});break;}
      case 'select-die':diceExpression='1d'+el.dataset.sides;if(el.dataset.sides!=='20')rollMode='normal';render();break;
      case 'roll-mode':diceExpression=$('#dice-expression').value;rollMode=el.dataset.mode;render();break;
      case 'reroll':performRoll(el.dataset.expression,el.dataset.label,el.dataset.mode);break;
      case 'clear-rolls':rollHistory=[];render();break;
      case 'reset-dice-colors':{const saved=updateDiceColors(DEFAULT_DICE_COLORS);toast(saved?'Default dice colors restored.':'Dice colors reset for this visit. Browser storage is unavailable.',!saved);break;}
      case 'delete-entry':confirmDelete(el.dataset.type,id);break;
      case 'confirm-delete':{const type=el.dataset.type;if(!['items','notes','spells','attacks','features'].includes(type))break;const entry=c[type].find(v=>v.id===id);if(type==='spells'&&entry?.name===c.concentration)c.concentration='';c[type]=c[type].filter(v=>v.id!==id);const section={items:'pack',notes:'journal',spells:'attacks',attacks:'attacks',features:'features'}[type];if(section&&isSheetFavorite(c,section,id))toggleSheetFavorite(c,section,id);modal.close();commit((entry?.name||entry?.title||'Entry')+' removed.');break;}
      case 'export':exportBackup();break;
      case 'import':$('#import-file').click();break;
      case 'confirm-import':{const incoming=modal._incoming;if(!incoming)break;incoming.characters.forEach(x=>{if(state.characters.some(c=>c.id===x.id)){x.id=uid();x.name=x.name.slice(0,110)+' (imported)';}state.characters.push(x);});state.activeId=incoming.characters[0].id;delete modal._incoming;modal.close();navigate('sheet');commit(`${incoming.characters.length} character${incoming.characters.length===1?'':'s'} added. Welcome back.`);break;}
      case 'sound':state.settings.sound=!state.settings.sound;sound.configure({enabled:state.settings.sound});sound.unlock();commit();sound.play('ui.confirm');break;
      case 'sound-preview':{const event=$('#sound-preview-event').value;if(state.settings.sound){sound.unlock();if(event==='rest.campfire')sound.startAmbience(event,{maxDuration:5});else sound.play(event);}break;}
      case 'install':showInstall();break;
      case 'recover-storage':setModal('Save this sheet on this device?',`<p class="modal-intro">This replaces the unreadable Questlog data stored in this browser with your current characters. Export a backup of your current sheet first if you need it.</p><div class="modal-actions">${btn('close','Cancel','btn')}${btn('confirm-recover-storage','Replace saved data','btn btn-danger')}</div>`);break;
      case 'confirm-recover-storage':storageBlocked=false;modal.close();commit('Saving enabled for this sheet.');break;
    }
  }catch(error){toast(error.message||'That action couldn’t be completed.',true);}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='modal-form'){event.preventDefault();if(!modalSubmit)return;try{for(const input of event.target.querySelectorAll('input[required][type="text"]:not(:disabled)')){if(!input.value.trim())throw new Error('Please fill in '+(input.closest('label')?.firstChild.textContent||'all required fields')+'.');}modalSubmit(new FormData(event.target));}catch(error){sound.play('ui.error');const el=$('#form-error');el.hidden=false;el.className='form-error';el.textContent=error.message;}}
  if(event.target.id==='dice-form'){event.preventDefault();try{diceExpression=$('#dice-expression').value;performRoll(diceExpression,'Custom roll',rollMode,false);}catch(error){toast(error.message,true);}}
});
document.addEventListener('input',event=>{if(event.target.hasAttribute('data-audio-volume')){const key=event.target.dataset.audioVolume,value=Number(event.target.value)/100;sound.configure(key==='master'?{volume:value}:{categories:{[key]:value}});event.target.nextElementSibling.value=Math.round(value*100)+'%';}if(event.target.dataset.catalogSearch)handleCatalogFilter(modal,event.target,character(),state.settings);if(event.target.hasAttribute('data-feature-level'))handleCatalogChoice(modal,event.target,character(),state.settings);if(event.target.id==='search'){query=event.target.value;const start=event.target.selectionStart;render();const input=$('#search');input.focus({preventScroll:true});try{input.setSelectionRange(start,start);}catch{}}});
document.addEventListener('change',event=>{
  if(event.target.hasAttribute('data-training')){
    const input=event.target,c=character();
    if(trainingEditingId!==c.id){render();return;}
    const t=ensureTraining(c),kind=input.dataset.training,value=input.value;
    if(kind==='weapon-group'){
      const ids=WEAPONS.filter(w=>w.family.startsWith(value)).map(w=>w.id);
      t.weapons=input.checked?[...new Set([...t.weapons,...ids])]:t.weapons.filter(id=>!ids.includes(id));
    }else if(['armor','weapons','languages','tools'].includes(kind))t[kind]=input.checked?[...new Set([...t[kind],value])]:t[kind].filter(id=>id!==value);
    commit();[...document.querySelectorAll('[data-training]')].find(node=>node.dataset.training===kind&&node.value===value)?.focus({preventScroll:true});return;
  }
  if(event.target.id==='inspiration-limit'){
    if(!event.target.reportValidity())return;
    state.settings.inspirationLimit=Number(event.target.value);commit('Heroic Inspiration limit updated.');return;
  }
  if(event.target.hasAttribute('data-content-source')){
    const hidden=new Set(state.settings.hiddenSources||[]),id=event.target.dataset.contentSource;
    if(event.target.checked)hidden.delete(id);else hidden.add(id);
    state.settings.hiddenSources=[...hidden];saveContentSources();
  }
  if(event.target.hasAttribute('data-dice-color')&&!updateDiceColors({[event.target.dataset.diceColor]:event.target.value}))toast('Dice colors changed for this visit. Browser storage is unavailable.',true);
  if(modal.contains(event.target)){handleCatalogChoice(modal,event.target,character(),state.settings);updateItemAttackFields(event.target);updateItemDefenseFields(event.target);updateItemIconPicker(modal);}
  if(event.target.matches('[data-reference-kind], [data-reference-entry], [data-reference-rarity], [data-reference-edition], [data-reference-feature-group], [data-reference-feature-source]'))updateCatalogBrowser($('#main'),!event.target.hasAttribute('data-reference-entry'),state.settings);
});
document.addEventListener('input',event=>{if(event.target.hasAttribute('data-dice-color'))updateDiceColors({[event.target.dataset.diceColor]:event.target.value});if(modal.contains(event.target))updateItemIconPicker(modal);if(event.target.hasAttribute('data-reference-search'))updateCatalogBrowser($('#main'),true,state.settings);});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.target.dataset.catalogSearch||event.target.hasAttribute('data-item-icon-search')))event.preventDefault();});
document.addEventListener('keydown',event=>{
  if(!event.target.matches('.training-tabs [role="tab"]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const tabs=[...event.target.parentElement.querySelectorAll('[role="tab"]')],index=tabs.indexOf(event.target);
  tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length].click();
});
document.addEventListener('input',event=>{
  if(!event.target.hasAttribute('data-source-search'))return;
  const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'');
  const words=normalize(event.target.value).split(/\s+/).filter(Boolean);
  const rows=[...document.querySelectorAll('[data-source-row]')];
  rows.forEach(row=>row.hidden=!words.every(word=>normalize(row.textContent).includes(word)));
  $('[data-source-empty]').hidden=rows.some(row=>!row.hidden);
});
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>2000000)throw new Error('Choose a backup smaller than 2 MB.');const incoming=parseBackup(await file.text());if(!incoming.characters.length)throw new Error('This backup has no characters to import. Choose another backup or create a new character.');if(state.characters.length+incoming.characters.length>100)throw new Error('Questlog supports up to 100 characters per browser.');modal._incoming=incoming;setModal('Bring your adventures along.',`<p class="modal-intro">Add ${incoming.characters.length} character${incoming.characters.length===1?'':'s'} from this backup? Your existing characters will be kept. Matching characters will be added as separate imported copies.</p>${incoming.characters.map(c=>`<div class="character-option"><span class="mini-avatar">${portraitMarkup(c)}</span><div><strong>${esc(c.name)}</strong><small>Level ${c.level} ${esc(c.class)} · ${c.notes.length} notes · ${c.items.length} items</small></div></div>`).join('')}<div class="modal-actions">${btn('close','Cancel','btn')}${btn('confirm-import','Import characters','btn btn-primary')}</div>`);}catch(error){toast(error.message,true);}
});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(Object.hasOwn(routes,next)&&next!==route){trainingEditingId=null;clearEffects();clearDice();sound.stopAmbience();route=next;query='';filters.clear();render();window.scrollTo(0,0);}});
window.addEventListener('storage',event=>{if(event.key===SHEET_HELP_KEY&&event.newValue==='true'){sheetHelpDismissed=true;$('.sheet-layout-help')?.remove();}});
// Other tabs can edit the same browser data. Refresh without silently overwriting them.
window.addEventListener('storage',event=>{if(event.key===cloud.storageKey()&&event.newValue){try{const incoming=parseBackup(event.newValue);clearEffects();incoming.characters.forEach(linkWeaponActions);state=incoming;cloud.external();sound.configure({enabled:state.settings.sound});if(modal.open)modal.close();render();toast('Sheet refreshed with changes from another tab.');}catch{toast('Another tab saved unreadable data. Export your current sheet.',true);storageBlocked=true;}}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
modal.addEventListener('close',()=>{sound.stopAmbience();clearDice();cloud.deferred();});
modal.addEventListener('cancel',()=>sound.stopAmbience());
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
const cloud=createCloudUI({esc,btn,field,actions,setModal,modal,toast,getState:()=>state,setState:(next,{blocked=false,error=''}={})=>{trainingEditingId=null;state=next;storageBlocked=blocked;storageError=error;sound.configure({enabled:state.settings.sound});},render,navigate,commit,deleteCharacter,openRest:showRest,roll:performRoll,persist:()=>persist(),saveRemote:()=>persist({remote:true})});
if(!storageBlocked)persist();
render();
cloud.start();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js',{scope:'./',type:'module'}).catch(()=>{/* The tracker still works without installation; show local storage status separately. */});
