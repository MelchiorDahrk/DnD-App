import {WEAPON_ROWS,TOOL_ROWS} from './training-data.js';

export const trainingKey = name => String(name||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const ARMOR_TRAINING=['Light','Medium','Heavy','Shield'];
export const LANGUAGE_GROUPS={
  Standard:['Common','Common Sign Language','Draconic','Dwarvish','Elvish','Giant','Gnomish','Goblin','Halfling','Orc'],
  Rare:['Abyssal','Celestial','Deep Speech','Druidic','Infernal','Primordial','Sylvan','Thieves’ Cant','Undercommon'],
  'Primordial dialects':['Aquan','Auran','Ignan','Terran']
};
export const TRAINING_WEAPONS=WEAPON_ROWS.map(([name,,,properties,,,,family])=>({id:trainingKey(name),name,properties,family}));
export const TOOL_NAMES=[...TOOL_ROWS.map(row=>row[0]),'Bagpipes','Drum','Dulcimer','Flute','Horn','Lute','Lyre','Pan Flute','Shawm','Viol','Dice Set','Dragonchess Set','Playing Card Set','Three-Dragon Ante Set'];
const classArmor={Artificer:'Light Medium Shield',Barbarian:'Light Medium Shield',Bard:'Light',Cleric:'Light Medium Shield',Druid:'Light Shield',Fighter:'Light Medium Heavy Shield',Monk:'',Paladin:'Light Medium Heavy Shield',Ranger:'Light Medium Shield',Rogue:'Light',Sorcerer:'',Warlock:'Light',Wizard:''};
const classWeapons=cls=>['Barbarian','Fighter','Paladin','Ranger'].includes(cls)?'Simple and Martial weapons':cls==='Rogue'?'Simple weapons; Martial weapons with Finesse or Light':cls==='Monk'?'Simple weapons; Martial weapons with Light':'Simple weapons';
const contains=(text,name)=>new RegExp('(?:^|[^a-z0-9])'+trainingKey(name).replaceAll('-','[^a-z0-9]+')+'(?:$|[^a-z0-9])','i').test(String(text).replace(/[’']/g,''));

export function legacyTraining(c) {
  const armor=c.armorProficiencies||classArmor[c.class]||'',weapons=c.weaponProficiencies||classWeapons(c.class);
  const restricted=/martial weapons with (?:the )?(?:finesse or light|finesse|light)/i.exec(weapons)?.[0]||'';
  const parts=String(c.languages||'').split(/[,;\n]/).map(part=>part.replace(/\s*\([^)]*\)/g,'').trim()).filter(Boolean);
  const languages=Object.values(LANGUAGE_GROUPS).flat().filter(name=>parts.some(part=>trainingKey(part)===trainingKey(name)));
  // Preserve table languages as individual choices, including names outside the core list.
  for(const name of parts) {
    if(name.length<=100&&languages.length<100&&!languages.some(value=>trainingKey(value)===trainingKey(name)))languages.push(name);
  }
  return {armor:ARMOR_TRAINING.filter(name=>contains(armor,name)||name==='Shield'&&/shields/i.test(armor)),
    weapons:TRAINING_WEAPONS.filter(w=>contains(weapons,w.name)||/all weapons/i.test(weapons)||
      (w.family.startsWith('Simple')?/simple/i.test(weapons):/martial/i.test(weapons)&&(!restricted||/finesse/i.test(restricted)&&w.properties.includes('Finesse')||/light/i.test(restricted)&&w.properties.includes('Light')))).map(w=>w.id),
    languages,tools:TOOL_NAMES.filter(name=>contains(c.toolProficiencies,name)||name==='Dice Set'&&/gaming set\s*\(dice\)/i.test(c.toolProficiencies)).map(trainingKey)};
}
export const trainingFor = c => c.training||legacyTraining(c);
export function ensureTraining(c) {return c.training ||= legacyTraining(c);}
export const hasArmorTraining=(c,family)=>trainingFor(c).armor.includes(family);
export const hasWeaponTraining=(c,weapon)=>!!weapon&&trainingFor(c).weapons.includes(weapon.id);
export function trainingWeapon(attack) {
  if(attack.weaponId!==undefined)return TRAINING_WEAPONS.find(w=>w.id===attack.weaponId);
  return [...TRAINING_WEAPONS].sort((a,b)=>b.name.length-a.name.length).find(w=>contains(attack.name,w.name));
}
export function attackIsProficient(c,a) {
  if(a.proficiencyMode==='proficient')return true;
  if(a.proficiencyMode==='untrained')return false;
  const weapon=trainingWeapon(a);
  return c.training&&weapon?hasWeaponTraining(c,weapon):a.proficient;
}
export function validTraining(t) {
  const list=(value,max,valid)=>Array.isArray(value)&&value.length<=max&&new Set(value).size===value.length&&value.every(valid);
  return t&&typeof t==='object'&&!Array.isArray(t)&&list(t.armor,4,v=>ARMOR_TRAINING.includes(v))&&
    list(t.weapons,TRAINING_WEAPONS.length,v=>TRAINING_WEAPONS.some(w=>w.id===v))&&
    list(t.languages,100,v=>typeof v==='string'&&v.trim().length>0&&v.length<=100)&&
    list(t.tools,100,v=>TOOL_NAMES.some(name=>trainingKey(name)===v));
}
