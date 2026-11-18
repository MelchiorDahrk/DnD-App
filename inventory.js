import {EQUIPMENT,itemFromEquipment,attackFromEquipment} from './catalog.js';
import {uid,abilityCheckBonus,proficiency,SKILLS} from './model.js';
import {PACK_CONTENTS,equipmentName,removeEmptyItems} from './inventory-rules.js';
import {ensureTraining,trainingKey} from './training-rules.js';

export const toolCatalog = () => EQUIPMENT.filter(entry=>entry.toolAbility);
export function itemTool(item) {
  return toolCatalog().find(entry=>entry.id===item.catalogId)||toolCatalog().find(entry=>trainingKey(entry.name)===trainingKey(item.name)||entry.id==='jewelers-tools'&&trainingKey(item.name)==='jewelers-kit');
}
export function addToolToInventory(c,id) {
  const entry=toolCatalog().find(entry=>entry.id===id);
  if(!entry)throw new Error('Choose a tool from the catalog.');
  const owned=c.items.find(item=>itemTool(item)?.id===id);
  if(owned){if(owned.qty===0)owned.qty=1;return owned;}
  if(c.items.length>=2000)throw new Error('Your inventory is full. Remove an item before adding tools.');
  const item=itemFromEquipment(entry);c.items.push(item);return item;
}
export function prepareTraining(c) {
  const importing=!c.training;
  ensureTraining(c);
  // Convert the old combined sheet once. Later proficiency changes never grant gear.
  if(importing)for(const id of c.training.tools)if(c.items.length<2000)addToolToInventory(c,id);
  return c;
}
export function toolCheck(c,item,{skill=''}={}) {
  const tool=itemTool(item);
  if(!tool||!c.items.includes(item)||item.qty<1)throw new Error('Carry this tool in your pack before using it.');
  const ability=tool.toolAbility;
  if(skill&&!Object.hasOwn(SKILLS,skill))throw new Error('Choose an applicable skill.');
  const trained=ensureTraining(c).tools.includes(tool.id),skilled=skill&&(c.skills.includes(skill)||c.expertise.includes(skill));
  const multiplier=skilled&&c.expertise.includes(skill)?2:trained||skilled?1:0;
  return {ability,skill,trained,skilled:!!skilled,advantage:!!(trained&&skilled),bonus:abilityCheckBonus(c,ability)+multiplier*proficiency(c.level)};
}

export function itemAttack(character,item) {
  return item.id?character.attacks.find(attack=>attack.itemId===item.id):undefined;
}

export function saveItemAttack(character,item,fields) {
  if(item.category!=='Weapon')return;
  const existing=itemAttack(character,item);
  if(!existing&&character.attacks.length>=2000)throw new Error('Your action list is full. Remove an action before adding a weapon.');
  const attack={...fields,id:existing?.id||uid(),itemId:item.id,name:item.name,actionType:item.actionType||''};
  if(existing)Object.assign(existing,attack);else character.attacks.push(attack);
  return attack;
}

export function linkWeaponActions(character) {
  prepareTraining(character);
  removeEmptyItems(character);
  const weapons=character.items.filter(item=>item.category==='Weapon');
  for(const item of weapons){
    if(itemAttack(character,item))continue;
    // Adopt an older action only when both names are unambiguous. Its manually
    // recorded bonuses, formulas, mastery, ID and favorites stay intact.
    const name=equipmentName(item.name),matches=character.attacks.filter(attack=>equipmentName(attack.name)===name);
    if(weapons.filter(other=>equipmentName(other.name)===name).length===1&&matches.length===1&&!matches[0].itemId){
      matches[0].itemId=item.id;
      item.actionType=matches[0].actionType||item.actionType||'';
      matches[0].actionType=item.actionType;
      continue;
    }
    const defaults=attackFromEquipment(item,character);
    if(defaults.damage&&character.attacks.length<2000)saveItemAttack(character,item,defaults);
  }
}

export function packContents(item) {
  const name=equipmentName(item.name),rows=Object.hasOwn(PACK_CONTENTS,name)?PACK_CONTENTS[name]:null;
  return rows?.map(([name,qty])=>{
    const entry=EQUIPMENT.find(entry=>equipmentName(entry.name)===equipmentName(name));
    if(!entry)throw new Error(`Missing equipment: ${name}.`);
    return {entry,qty};
  })||[];
}

const stackFields=['category','weight','description','wiki','iconKey','actionType','maxUses','usesLeft','consumeOnEmpty','armorId','weaponId','acBonus','acCondition','wielding','requiresAttunement','attuned'];
export function sameStack(a,b) {
  return equipmentName(a.name)===equipmentName(b.name)&&stackFields.every(key=>(a[key]??'')===(b[key]??''));
}

export function unpackItem(character,id) {
  const pack=character.items.find(item=>item.id===id);
  if(!pack||pack.qty<1)return null;
  const contents=packContents(pack);
  if(!contents.length)return null;
  // Prepare the whole change first, so a full inventory never loses a pack.
  const next={...character,items:character.items.map(item=>({...item}))};
  next.items.find(item=>item.id===id).qty--;
  removeEmptyItems(next);
  const addedIds=[];
  for(const {entry,qty} of contents) {
    const incoming=itemFromEquipment(entry);
    const existing=next.items.find(item=>sameStack(item,incoming)&&item.qty+qty<=99999);
    if(existing){existing.qty+=qty;addedIds.push(existing.id);}
    else {incoming.qty=qty;next.items.push(incoming);addedIds.push(incoming.id);}
  }
  if(next.items.length>2000)throw new Error('Your inventory is full. Remove some entries before unpacking this pack.');
  character.items=next.items;
  return {pack,contents,addedIds};
}
