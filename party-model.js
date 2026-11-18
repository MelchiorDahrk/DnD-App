import {SKILLS,skillBonus,uid,COINS} from './model.js';
import {itemUses,removeMissingItemActions} from './inventory-rules.js';

export const partyTime = event => event.createdAt?.toMillis?.() ?? (event.createdAt?.seconds||0)*1000;
export function initiativeOrder(characters,combat={}) {
  const scores=combat.scores||{};
  return [...characters].sort((a,b)=>(scores[b.id]??-1000)-(scores[a.id]??-1000)||a.id.localeCompare(b.id));
}
export function turnOrder(characters,combat={}) {
  const ordered=initiativeOrder(characters,combat);
  if(!combat.current)return ordered;
  const participants=ordered.filter(c=>Object.hasOwn(combat.scores||{},c.id)),waiting=ordered.filter(c=>!Object.hasOwn(combat.scores||{},c.id)),index=participants.findIndex(c=>c.id===combat.current);
  return [...(index>0?[...participants.slice(index),...participants.slice(0,index)]:participants),...waiting];
}
export function partyRows(characters) {
  // Balance the last rows: four is 2 + 2, seven is 3 + 2 + 2.
  const rows=[];let index=0;
  while(index<characters.length){const remaining=characters.length-index,size=remaining===4?2:Math.min(3,remaining);rows.push(characters.slice(index,index+size));index+=size;}
  return rows;
}
export function skillLeaders(characters,skill) {
  if(!Object.hasOwn(SKILLS,skill))return [];
  return characters.filter(c=>(c.sheet?.details||c.sheet?.skillBonuses)&&c.live).map(c=>({character:c,bonus:c.sheet.skillBonuses?.[skill]!==undefined?c.sheet.skillBonuses[skill]-2*(c.live.exhaustion||0):skillBonus({...c.sheet,...c.sheet.details,...c.live},skill)})).sort((a,b)=>b.bonus-a.bonus||a.character.sheet.name.localeCompare(b.character.sheet.name));
}
export function liveActivities(before,after) {
  if(!before||!after)return [];
  const events=[],lost=(before.hp+before.tempHp)-(after.hp+after.tempHp);
  if(after.hp<before.hp||lost>0)events.push({kind:'damage',text:`takes ${Math.max(before.hp-after.hp,lost)} damage`});
  if(after.hp>before.hp)events.push({kind:'healing',text:`recovers ${after.hp-before.hp} HP`});
  if(after.hp===0&&before.hp>0)events.push({kind:'unconscious',text:'falls unconscious'});
  if(after.inspiration>before.inspiration)events.push({kind:'inspiration',text:'gains Heroic Inspiration'});
  for(const condition of after.conditions||[])if(!before.conditions?.includes(condition))events.push({kind:'condition',text:`gains ${condition}`});
  for(const condition of before.conditions||[])if(!after.conditions?.includes(condition))events.push({kind:'condition',text:`clears ${condition}`});
  if(after.exhaustion!==before.exhaustion)events.push({kind:'condition',text:`Exhaustion ${after.exhaustion>before.exhaustion?'increases':'decreases'} to ${after.exhaustion}`});
  if(after.concentration!==before.concentration)events.push({kind:'condition',text:after.concentration?`concentrates on ${after.concentration}`:'ends concentration'});
  return events;
}

export function reserveTransfer(character,{kind,itemId,amount,coin}) {
  if(!Number.isInteger(amount)||amount<1||amount>100000000)throw new Error('Enter a positive whole amount.');
  if(kind==='money'){
    if(!Object.hasOwn(COINS,coin))throw new Error('Choose a coin type.');
    if((character[coin]||0)<amount)throw new Error('You do not have enough coins.');
    character[coin]-=amount;return {kind,coin,amount};
  }
  if(kind!=='item')throw new Error('Choose items or money.');
  const item=character.items.find(i=>i.id===itemId);
  if(!item||item.qty<amount)throw new Error('That quantity is no longer available.');
  const uses=itemUses(item);
  if(uses.maxUses&&uses.usesLeft<uses.maxUses&&amount<item.qty)throw new Error('Transfer the entire partly used stack, or finish using its current item first.');
  if(item.equipped||item.attuned||item.containerId||character.items.some(i=>i.containerId===item.id))throw new Error('Unequip, unattune, and unpack the item before transferring it.');
  const payload={kind,item:structuredClone(item),amount};
  payload.item.qty=amount;payload.item.equipped=false;
  if(uses.maxUses)Object.assign(payload.item,uses);
  // Only the offered item is shared; personal descriptions stay private.
  payload.item.description='';delete payload.item.notes;
  item.qty-=amount;if(!item.qty)character.items=character.items.filter(i=>i.id!==item.id);
  removeMissingItemActions(character);
  return payload;
}
export function receiveTransfer(character,payload,{refund=false}={}) {
  if(!Number.isInteger(payload.amount)||payload.amount<1)throw new Error('Invalid transfer amount.');
  if(payload.kind==='money'){
    if(!Object.hasOwn(COINS,payload.coin)||(character[payload.coin]||0)+payload.amount>100000000)throw new Error('This transfer exceeds the coin limit.');
    character[payload.coin]=(character[payload.coin]||0)+payload.amount;
  }else if(payload.kind==='item'&&payload.item){
    const original=refund&&character.items.find(i=>i.id===payload.item.id);
    if(original){if(original.qty+payload.amount>99999)throw new Error('This refund exceeds the item quantity limit.');original.qty+=payload.amount;return;}
    if(character.items.length>=2000)throw new Error('Your inventory is full.');
    character.items.push({...structuredClone(payload.item),id:refund?payload.item.id:uid(),qty:payload.amount,...(!refund?{equipped:false,attuned:false}:{})});
    if(refund&&payload.attacks){
      const restore=payload.attacks.filter(a=>!character.attacks.some(existing=>existing.id===a.id||existing.itemId===a.itemId));
      if(character.attacks.length+restore.length>2000)throw new Error('Make room in your action list before reclaiming this weapon.');
      character.attacks.push(...structuredClone(restore));
    }
  }else throw new Error('Invalid transfer.');
}
