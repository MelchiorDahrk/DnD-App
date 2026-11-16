import {ARMOR,EQUIPMENT,WEAPONS,findEquipment} from './catalog.js';
import {equipmentName} from './inventory-rules.js';
import {mod} from './model.js';
import {hasArmorTraining} from './training-rules.js';

export function armorTrainingEffects(character) {
  const worn=character.items.filter(equipped).map(item=>({item,...itemDefense(item)})).filter(p=>p.armor&&p.armor.family!=='Shield');
  const untrained=worn.filter(p=>!trainedWithArmor(character,p));
  return {untrained,blocksCasting:untrained.length>0,disadvantage:untrained.length>0,stealth:worn.some(p=>p.armor.stealth)};
}
export function armorCheckMode(c,ability,advantage=false,disadvantage=false,skill='') {
  const effects=armorTrainingEffects(c);
  disadvantage ||= effects.disadvantage&&['str','dex'].includes(ability)||skill==='Stealth'&&effects.stealth;
  return advantage===disadvantage?'normal':advantage?'advantage':'disadvantage';
}

const armorName = name => equipmentName(name).replace(/\+\s*[123]/g,'').replace(/[,()]/g,'').replace(/\barmor\b/g,'').replace(/\s+/g,' ').trim();
const equipped = item => item.equipped && item.qty>0;
const itemEntry = item => findEquipment(item.catalogId)||EQUIPMENT.find(entry=>equipmentName(entry.name)===equipmentName(item.name));
const trainedWithArmor=(character,profile)=>hasArmorTraining(character,profile.armor.family)||profile.entry?.id==='magic-elven-chain'||equipmentName(profile.item.name)==='elven chain';

// Resolve catalog data on demand so older, name-only inventory entries work too.
// Free-form descriptions aren't interpreted as executable rules.
export function itemDefense(item) {
  const entry=itemEntry(item),name=entry?.name||item.name||'';
  const namedArmor=ARMOR.find(armor=>armorName(armor.name)===armorName(name));
  const defaultBase=/(?:Default base |^Base )(.+?)(?:;| weight$)/i.exec(entry?.weightStatus||'')?.[1];
  const typeBase=/^Armor \(([^)]+)\)/i.exec(entry?.typeDetails||'')?.[1];
  const shield=item.category==='Armor'&&(/\bshield\b/i.test(name)||/Armor \(Shield\)/i.test(entry?.typeDetails||''));
  const armor=ARMOR.find(armor=>armor.id===item.armorId)||
    (item.category==='Armor'?(shield?ARMOR.find(armor=>armor.family==='Shield'):namedArmor||ARMOR.find(armor=>armorName(armor.name)===armorName(defaultBase||typeBase))):null);
  const potency=/\+\s*([123])\b/.exec(name)?.[1];
  const fixedBonus={
    'ring of protection':1,'cloak of protection':1,'bracers of defense':2,
    'staff of power':2,'elven chain':1,'robe of the archmagi':0,
    'demon armor':1,'dragon scale mail':1,'dwarven plate':2,
    'glamoured studded leather':1,'scarab of protection':1,'staff of defense':1,
    'hewards hireling armor':1
  }[equipmentName(name)];
  const weapon=WEAPONS.find(weapon=>weapon.id===item.weaponId)||WEAPONS.find(weapon=>armorName(weapon.name)===armorName(name));
  const held=item.category==='Weapon'||['Staff','Rod','Wand'].includes(entry?.itemType)||item.wielding&&item.wielding!=='Automatic';
  const hands=!held?0:item.wielding==='Dual wield (2 from stack)'?Math.min(2,item.qty):item.wielding==='Two hands'?2:item.wielding==='One hand'?1:/Two-Handed/.test(weapon?.properties||'')?2:1;
  return {
    armor,entry,hands,
    bonus:item.acBonus??(fixedBonus??(armor?Number(potency||0):0)),
    requiresAttunement:item.requiresAttunement??(/^Requires Attunement/i.test(entry?.attunement||'')||/Attunement: Requires Attunement/i.test(item.description||'')),
    condition:item.acCondition||(/bracers of defense/i.test(name)?'Without armor or shield':'Always')
  };
}

// Equipping represents what is worn or held now, rather than everything carried.
// Prefer the newly selected item when it conflicts with armor or occupied hands.
export function setItemEquipped(character,item,value) {
  item.equipped=!!value&&item.qty>0;
  if(!item.equipped)return;
  const profile=itemDefense(item),others=character.items.filter(other=>other!==item&&equipped(other));
  if(profile.armor&&profile.armor.family!=='Shield') {
    for(const other of others)if(itemDefense(other).armor&&itemDefense(other).armor.family!=='Shield')other.equipped=false;
  }
  const isShield=profile.armor?.family==='Shield';
  if(!isShield&&!profile.hands)return;
  let available=2-(isShield?1:profile.hands);
  // Keep a compatible second weapon before a shield when starting dual wielding.
  const held=others.filter(other=>itemDefense(other).hands).reverse();
  const shields=others.filter(other=>itemDefense(other).armor?.family==='Shield');
  for(const other of [...held,...shields]) {
    const otherProfile=itemDefense(other),cost=otherProfile.hands||1;
    if((isShield&&otherProfile.armor?.family==='Shield')||cost>available)other.equipped=false;
    else available-=cost;
  }
}

export function armorClassDetails(character) {
  const active=character.items.filter(equipped).map(item=>({item,...itemDefense(item)}));
  const dex=mod(character.stats.dex),parts=[],warnings=[];
  const armor=active.filter(profile=>profile.armor&&profile.armor.family!=='Shield')
    .sort((a,b)=>armorValue(b)-armorValue(a))[0];
  const hands=active.reduce((sum,profile)=>sum+profile.hands,0);
  const shields=active.filter(profile=>profile.armor?.family==='Shield');
  const usingShield=hands<=1&&shields.length>0;
  const shield=hands<=1&&hasArmorTraining(character,'Shield')?shields.sort((a,b)=>bonus(b)-bonus(a))[0]:null;
  if(shields.length&&!shield)warnings.push(hands>1?'Shield inactive: both hands are occupied.':'Shield inactive: shield training is required.');
  if(hands>2)warnings.push('More than two hands are equipped; put away unused weapons.');
  if(armor&&!trainedWithArmor(character,armor))warnings.push('No '+armor.armor.family.toLowerCase()+' armor training: disadvantage on Strength/Dexterity D20 Tests; cannot cast spells.');
  for(const profile of active) {
    if(profile.item.category==='Armor'&&!profile.armor)warnings.push(`Choose a base armor for ${profile.item.name}.`);
    if(profile.requiresAttunement&&!profile.item.attuned&&profile.bonus)warnings.push(`${profile.item.name}: attunement needed for its AC bonus.`);
  }
  function bonus(profile) {return !profile.requiresAttunement||profile.item.attuned?profile.bonus:0;}
  function armorValue(profile) {return profile.armor.ac+(profile.armor.family==='Light'?dex:profile.armor.family==='Medium'?Math.min(2,dex):0)+bonus(profile);}
  let base=armor?armorValue(armor):10+dex,label=armor?armor.item.name:'Unarmored (10 + Dexterity)';
  if(!armor) {
    const candidates=[{value:base,label}];
    if(character.class==='Barbarian')candidates.push({value:10+dex+mod(character.stats.con),label:'Unarmored Defense (Dexterity + Constitution)'});
    if(character.class==='Monk'&&!usingShield)candidates.push({value:10+dex+mod(character.stats.wis),label:'Unarmored Defense (Dexterity + Wisdom)'});
    const robe=active.find(profile=>equipmentName(profile.entry?.name||profile.item.name)==='robe of the archmagi'&&(!profile.requiresAttunement||profile.item.attuned));
    if(robe)candidates.push({value:15+dex,label:robe.item.name});
    const best=candidates.sort((a,b)=>b.value-a.value)[0];base=best.value;label=best.label;
  }
  parts.push(`${label}: ${base}`);
  let total=base;
  if(shield) {const value=shield.armor.ac+bonus(shield);total+=value;parts.push(`${shield.item.name}: +${value}`);}
  const applied=new Set();
  for(const profile of active) {
    if(profile.armor||!bonus(profile)||profile.condition==='Without armor or shield'&&(armor||usingShield))continue;
    // Multiple copies of the same magic item do not stack, even in one stack.
    const key=profile.entry?.variantOf||profile.entry?.id||equipmentName(profile.item.name);
    if(applied.has(key))continue;
    applied.add(key);total+=bonus(profile);parts.push(`${profile.item.name}: ${bonus(profile)>=0?'+':''}${bonus(profile)}`);
  }
  if(armor&&character.features.some(feature=>/^(?:fighting style:\s*)?defen[cs]e(?:\s*\(.*\))?$/i.test(feature.name))) {total++;parts.push('Defense fighting style: +1');}
  if(character.acBonus) {total+=character.acBonus;parts.push(`AC adjustment: ${character.acBonus>=0?'+':''}${character.acBonus}`);}
  const automatic=total;
  if(character.acOverride!==undefined) {total=character.acOverride;parts.push(`Manual override: ${total}`);}
  return {total,automatic,parts,warnings,summary:parts.join(' · ')};
}

export const armorClass = character => armorClassDetails(character).total;
