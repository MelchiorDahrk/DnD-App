import {EQUIPMENT,itemFromEquipment,attackFromEquipment} from './catalog.js';
import {uid} from './model.js';
import {PACK_CONTENTS,equipmentName,removeEmptyItems} from './inventory-rules.js';

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
function sameStack(a,b) {
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
