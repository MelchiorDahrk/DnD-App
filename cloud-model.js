// Pure synchronization rules, shared by the browser and emulator tests.
import {changeHP,parseBackup,SAVE_VERSION,ABILITIES,SKILLS,skillBonus,initiative} from './model.js';
import {armorClass,armorCheckMode} from './armor-class.js';
import {selectSpellIcon} from './spell-icons.js';
// Share the resolved artwork for structured homebrew effects without sharing
// private effect metadata. Exact names and schools can be resolved by readers.
const publicSpellIcon=spell=>{const selected=selectSpellIcon(spell);return ['manual','effect'].includes(selected.source)?{spellIconKey:selected.key}:{};};
export const LIVE_KEYS=['hp','maxHp','tempHp','conditions','exhaustion','deathSuccess','deathFailure','inspiration','concentration','hitDice'];
export const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
export const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const accountKey=uid=>uid?`questlog.v2.account.${uid}`:'questlog.v2';
export const queueKey=uid=>`questlog.cloud.v1.${uid}`;
export function emptyState(settings={sound:true}){return {version:SAVE_VERSION,characters:[],activeId:null,settings:copy(settings)};}
export function splitCharacter(character){
  const content=copy(character),live={};
  for(const key of LIVE_KEYS){live[key]=content[key];delete content[key];}
  live.inspiration=Number(live.inspiration);
  live.slotUses=content.slots.map(slot=>slot.used);
  live.slotMax=content.slots.map(slot=>slot.max);
  content.slots.forEach(slot=>{delete slot.used;delete slot.max;});
  live.featureUses=Object.fromEntries(content.features.map(feature=>[feature.id,feature.used]));
  live.featureMax=Object.fromEntries(content.features.map(feature=>[feature.id,feature.maxUses]));
  content.features.forEach(feature=>{delete feature.used;delete feature.maxUses;});
  return {content,live};
}
export function joinCharacter(content,live){
  const c={...copy(content),...Object.fromEntries(LIVE_KEYS.map(key=>[key,copy(live[key])]))};
  c.slots=c.slots.map((slot,i)=>({...slot,max:live.slotMax[i]??0,used:live.slotUses[i]??0}));
  c.features=c.features.map(feature=>({...feature,maxUses:live.featureMax[feature.id]??0,used:live.featureUses[feature.id]??0}));
  // Apply the same validation/defaults as version 2 JSON import.
  return parseBackup(JSON.stringify({...emptyState(),characters:[c],activeId:c.id})).characters[0];
}
export function fragments(content){
  const json=JSON.stringify(content);
  if(new TextEncoder().encode(json).length>2000000)throw new Error('Character exceeds the 2 MB cloud limit. Export a backup and reduce large content.');
  // 60,000 UTF-16 code units are at most 240 KB encoded, including emoji.
  const result=[];
  for(let i=0;i<json.length;){let end=Math.min(json.length,i+60000);const last=json.charCodeAt(end-1);if(end<json.length&&last>=0xd800&&last<=0xdbff)end--;result.push(json.slice(i,end));i=end;}
  return result;
}
export function fieldChanges(before,after){
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>!equal(before[key],after[key])).map(key=>({key,before:copy(before[key])??null,after:copy(after[key])??null,remove:!Object.hasOwn(after,key)}));
}
export class CloudConflict extends Error {
  constructor(fields){super(`Changes on another device overlap: ${fields.join(', ')}. Choose which copy to keep.`);this.code='questlog/conflict';this.fields=fields;}
}
export function applyFields(current,changes,{force=false,strict=false}={}){
  const next=copy(current),conflicts=[];
  for(const change of changes){
    if(!force&&!equal(current[change.key]??null,change.before)&&(strict||!equal(current[change.key]??null,change.after))){conflicts.push(change.key);continue;}
    if(change.remove)delete next[change.key];else next[change.key]=copy(change.after);
  }
  if(conflicts.length)throw new CloudConflict(conflicts);
  return next;
}
export function makeOperation(before,after,hpAction=null){
  const a=splitCharacter(before),b=splitCharacter(after);
  const content=fieldChanges(a.content,b.content);
  let live=fieldChanges(a.live,b.live);
  const resources={slots:[],features:[]};
  b.live.slotUses.forEach((after,index)=>{const before=a.live.slotUses[index];if(before!==after)resources.slots.push({index,before,after});});
  for(const id of new Set([...Object.keys(a.live.featureUses),...Object.keys(b.live.featureUses)])){
    const before=a.live.featureUses[id]??0,after=b.live.featureUses[id]??0;
    if(before!==after||!Object.hasOwn(b.live.featureUses,id))resources.features.push({id,before,after,remove:!Object.hasOwn(b.live.featureUses,id)});
  }
  live=live.filter(change=>!['slotUses','featureUses'].includes(change.key));
  const conditions=live.some(change=>change.key==='conditions')?{add:b.live.conditions.filter(v=>!a.live.conditions.includes(v)),remove:a.live.conditions.filter(v=>!b.live.conditions.includes(v))}:null;
  live=live.filter(change=>change.key!=='conditions');
  if(hpAction)live=live.filter(change=>!['hp','tempHp','deathSuccess','deathFailure'].includes(change.key));
  return {content,live,conditions,resources,hpAction:hpAction&&copy(hpAction)};
}
export function applyLive(current,operation){
  let next=applyFields(current,operation.live||[],{...operation,strict:true});
  if(operation.conditions)next.conditions=[...new Set([...next.conditions.filter(v=>!operation.conditions.remove.includes(v)),...operation.conditions.add])];
  for(const change of operation.resources?.slots||[]){
    if(operation.force)next.slotUses[change.index]=change.after;
    else if(change.after>change.before){
      const value=next.slotUses[change.index]+change.after-change.before;
      if(value>next.slotMax[change.index])throw new CloudConflict([`level ${change.index+1} slots exhausted`]);
      next.slotUses[change.index]=value;
    }else if(operation.force||next.slotUses[change.index]===change.before)next.slotUses[change.index]=change.after;
    else throw new CloudConflict([`level ${change.index+1} slots restored on another device`]);
  }
  for(const change of operation.resources?.features||[]){
    const current=next.featureUses[change.id]??0;
    if(operation.force){if(change.remove)delete next.featureUses[change.id];else next.featureUses[change.id]=change.after;}
    else if(change.after>change.before){
      const value=current+change.after-change.before;
      if(value>(next.featureMax[change.id]??0))throw new CloudConflict(['feature uses exhausted']);next.featureUses[change.id]=value;
    }else if(current===change.before){if(change.remove)delete next.featureUses[change.id];else next.featureUses[change.id]=change.after;}
    else throw new CloudConflict(['feature resource restored on another device']);
  }
  if(operation.hpAction)changeHP(next,operation.hpAction.amount,operation.hpAction.kind);
  return next;
}
export const hasChanges=op=>!!(op.content?.length||op.live?.length||op.conditions||op.hpAction||op.resources?.slots.length||op.resources?.features.length);
export function publicProjection(character){
  // Deliberate allowlist: no notes, backstory, inventory, spell notes, or metadata.
  return {initiative:initiative({...character,exhaustion:0}),initiativeMode:armorCheckMode(character,'dex',character.initiativeAdvantage),id:character.id,name:character.name,playerName:character.playerName||'',class:character.class,subclass:character.subclass,level:character.level,race:character.race,ac:armorClass(character),portrait:copy(character.portrait)||null,skillBonuses:Object.fromEntries(Object.keys(SKILLS).map(skill=>[skill,skillBonus({...character,exhaustion:0},skill)])),slots:character.slots.map(slot=>({max:slot.max})),features:character.features.filter(f=>f.maxUses).map(f=>({id:f.id,name:f.name,maxUses:f.maxUses})),details:{
    stats:Object.fromEntries(Object.keys(ABILITIES).map(key=>[key,character.stats[key]])),initiativeBonus:character.initiativeBonus,initiativeAdvantage:character.initiativeAdvantage,initiative:initiative({...character,exhaustion:0}),initiativeMode:armorCheckMode(character,'dex',character.initiativeAdvantage),skills:copy(character.skills),expertise:copy(character.expertise),saves:copy(character.saves),speed:character.speed,hitDie:character.hitDie,spellAbility:character.spellAbility,
    attacks:character.attacks.map(a=>({name:a.name,ability:a.ability,bonus:a.bonus,damage:a.damage,type:a.type,range:a.range})),
    spells:character.spells.map(s=>({name:s.name,level:s.level,school:s.school,castingTime:s.castingTime,range:s.range,duration:s.duration,concentration:s.concentration,prepared:s.prepared,...publicSpellIcon(s)}))
  }};
}
export function invitationToken(random=globalThis.crypto){
  return Array.from(random.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
}
export function validPublicDetails(d){
  const text=(s,max)=>typeof s==='string'&&s.length<=max,integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  return !!d&&Object.keys(ABILITIES).every(key=>integer(d.stats?.[key],1,30))
    && (d.initiativeBonus===undefined||integer(d.initiativeBonus,-99,99))
    && (d.initiativeAdvantage===undefined||typeof d.initiativeAdvantage==='boolean')
    && (d.initiative===undefined||integer(d.initiative,-199,199))
    && (d.initiativeMode===undefined||['normal','advantage','disadvantage'].includes(d.initiativeMode))
    && ['skills','expertise'].every(key=>Array.isArray(d[key])&&d[key].length<=30&&d[key].every(skill=>Object.hasOwn(SKILLS,skill)))
    && Array.isArray(d.saves)&&d.saves.length<=30&&d.saves.every(key=>Object.hasOwn(ABILITIES,key))
    && integer(d.speed,0,100000000)&&[6,8,10,12].includes(d.hitDie)
    && Array.isArray(d.attacks)&&d.attacks.length<=2000&&d.attacks.every(a=>a&&text(a.name,200)&&text(a.damage,30)&&text(a.type,100)&&text(a.range,100))
    && Array.isArray(d.spells)&&d.spells.length<=2000&&d.spells.every(s=>s&&text(s.name,200)&&integer(s.level,0,9)&&['school','castingTime','range','duration'].every(key=>text(s[key],2000))&&typeof s.prepared==='boolean'&&typeof s.concentration==='boolean'&&(s.spellIconKey===undefined||text(s.spellIconKey,100)&&/^[a-z0-9-]*$/.test(s.spellIconKey)));
}
