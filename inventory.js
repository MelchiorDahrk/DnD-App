import {EQUIPMENT,itemFromEquipment} from './catalog.js';
import {PACK_CONTENTS,equipmentName,removeEmptyItems} from './inventory-rules.js';

export function packContents(item) {
  const name=equipmentName(item.name),rows=Object.hasOwn(PACK_CONTENTS,name)?PACK_CONTENTS[name]:null;
  return rows?.map(([name,qty])=>{
    const entry=EQUIPMENT.find(entry=>equipmentName(entry.name)===equipmentName(name));
    if(!entry)throw new Error(`Missing equipment: ${name}.`);
    return {entry,qty};
  })||[];
}

const stackFields=['category','weight','description','wiki','iconKey','actionType','maxUses','usesLeft','consumeOnEmpty'];
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
