import {CLASS_LEVELS} from './progression-data.js';

const fullCasters = ['Bard','Cleric','Druid','Sorcerer','Wizard'];
const halfCasters = ['Artificer','Paladin','Ranger'];
const emptySlots = () => Array(9).fill(0);
const classSlots = (name,level) => CLASS_LEVELS.find(row=>row.className===name&&row.level===level)?.slots || emptySlots();
const thirdCaster = {Fighter:'Eldritch Knight',Rogue:'Arcane Trickster',Monk:'Warrior of the Mystic Arts'};
export const isThirdCaster = (name,subclass) => Boolean(thirdCaster[name] && thirdCaster[name]===subclass);

export function classSlotMaximums(name,level,subclass) {
  if (!isThirdCaster(name,subclass) || level<3) return classSlots(name==='Artificer'?'Paladin':name,level);
  return [
    level>=7 ? 4 : level>=4 ? 3 : 2,
    level>=10 ? 3 : level>=7 ? 2 : 0,
    level>=16 ? 3 : level>=13 ? 2 : 0,
    level>=19 ? 1 : 0,0,0,0,0,0
  ];
}

export function characterClassLevel(character,name) {
  const additional=character.multiclass || [];
  if(character.class===name)return character.level-additional.reduce((total,row)=>total+row.level,0);
  return additional.find(row=>row.class===name)?.level ?? 0;
}

export function spellSlotPlan(character) {
  const additional = character.multiclass || [];
  const primaryLevel = characterClassLevel(character,character.class);
  const classes = [{class:character.class,subclass:character.subclass,level:primaryLevel},...additional];
  const casters = classes.filter(row=>row.class!=='Warlock'&&classSlotMaximums(row.class,row.level,row.subclass).some(Boolean));
  const warlock = classes.find(row=>row.class==='Warlock');
  const pact = warlock ? classSlots('Warlock',warlock.level) : emptySlots();
  if (!casters.length) return {maxima:pact,pactMagic:Boolean(warlock),pactSlot:null};

  const casterLevel = casters.reduce((total,row)=>{
    if (halfCasters.includes(row.class)) return total+Math.ceil(row.level/2);
    if (fullCasters.includes(row.class)) return total+row.level;
    return total+Math.floor(row.level/3);
  },0);
  const [first] = casters;
  const maxima = casters.length===1 ? classSlotMaximums(first.class,first.level,first.subclass) : classSlots('Wizard',casterLevel);
  const tier = pact.findIndex(Boolean);
  return {maxima,pactMagic:false,pactSlot:tier<0?null:{level:tier+1,max:pact[tier]}};
}

export function syncSpellSlots(character) {
  if (character.spellSlotMode!=='auto') return;
  const plan = spellSlotPlan(character);
  const oldPact = character.pactSlot;
  const wasPact = character.pactMagic===true && !oldPact;
  const pactUsed = oldPact?.used ?? (wasPact ? character.slots.reduce((total,slot)=>total+slot.used,0) : 0);
  const maxima = plan.maxima.map((max,index)=>Math.min(99,(character.slotOverrides?.[index] ?? max)+(character.temporarySlots?.[index] ?? 0)));
  const calculatedPactTier=plan.maxima.findIndex(Boolean);
  const pactTier = maxima[calculatedPactTier] ? calculatedPactTier : maxima.findIndex(Boolean);
  const movePactUses=plan.pactMagic && (!wasPact || !character.slots[pactTier]?.max);
  for (const [index,slot] of character.slots.entries()) {
    const spent = wasPact===plan.pactMagic ? slot.used : 0;
    const used = movePactUses ? index===pactTier?pactUsed:0 : spent;
    slot.max=maxima[index];
    slot.used=Math.min(slot.max,used);
  }
  if (plan.pactMagic) character.pactMagic=true;
  else delete character.pactMagic;
  if (plan.pactSlot) {
    const max=character.pactSlotOverride ?? plan.pactSlot.max;
    character.pactSlot={level:plan.pactSlot.level,max,used:Math.min(max,pactUsed)};
  } else {
    delete character.pactSlot;
  }
}

export function flexibleCastingOptions(character) {
  const level=characterClassLevel(character,'Sorcerer');
  const feature=character.features.find(({catalogId,name})=>catalogId==='class-features-sorcerer-font-of-magic-sorcery-points'||name==='Font of Magic / Sorcery Points');
  if(!feature||character.spellSlotMode!=='auto')return {feature,options:[]};
  const options=[2,3,5,6,7].map((cost,index)=>({level:index+1,cost,required:[2,3,5,7,9][index]}))
    .filter(row=>level>=row.required&&feature.maxUses-feature.used>=row.cost&&character.slots[row.level-1].max<99);
  return {feature,options};
}

export function arcaneRecoveryPlan(character) {
  const wizardLevel=characterClassLevel(character,'Wizard');
  const feature=character.features.find(({catalogId,name})=>catalogId==='class-features-wizard-arcane-recovery'||name==='Arcane Recovery');
  if(!wizardLevel||!feature||feature.used>=feature.maxUses||character.pactMagic)return null;
  const grimoire=character.items.some(item=>item.qty>0&&item.equipped&&item.attuned&&
    (item.catalogId==='magic-2014-arcane-grimoire'||!item.catalogId&&item.name==='Arcane Grimoire'));
  const budget=Math.ceil(wizardLevel/2)+Number(grimoire);
  const slots=character.slots.slice(0,Math.min(5,budget)).map((slot,index)=>({slot,level:index+1})).filter(row=>row.slot.used);
  return slots.length ? {feature,budget,slots,grimoire} : null;
}

export function validSlotSettings(character,classNames) {
  const whole = (value,min,max) => Number.isInteger(value) && value>=min && value<=max;
  if (character.spellSlotMode!==undefined && !['auto','manual'].includes(character.spellSlotMode)) return false;
  if (character.slotOverrides!==undefined && (!Array.isArray(character.slotOverrides) || character.slotOverrides.length!==9 || !character.slotOverrides.every(value=>value===null||whole(value,0,99)))) return false;
  if (character.temporarySlots!==undefined && (character.spellSlotMode!=='auto'||!Array.isArray(character.temporarySlots)||character.temporarySlots.length!==5||!character.temporarySlots.every(value=>whole(value,0,99)))) return false;
  if (character.pactSlotOverride!==undefined && !whole(character.pactSlotOverride,0,99)) return false;
  const pact = character.pactSlot;
  if (pact!==undefined && (!pact||!whole(pact.level,1,9)||!whole(pact.max,0,99)||!whole(pact.used,0,pact.max)||character.pactMagic===true)) return false;
  if (character.multiclass===undefined) return true;
  if (!Array.isArray(character.multiclass) || character.multiclass.length>=classNames.length) return false;
  const classSet = new Set([character.class]);
  let levels=0;
  for (const row of character.multiclass) {
    if (!row||!classNames.includes(row.class)||classSet.has(row.class)||!whole(row.level,1,19)||typeof row.subclass!=='string'||row.subclass.length>500) return false;
    classSet.add(row.class);
    levels+=row.level;
  }
  return levels<character.level;
}
