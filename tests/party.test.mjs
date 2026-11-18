import test from 'node:test';
import assert from 'node:assert/strict';
import {demoCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {publicProjection} from '../cloud-model.js';
import {partyRows,turnOrder,skillLeaders,liveActivities,reserveTransfer,receiveTransfer} from '../party-model.js';

test('party rows keep equal card sizes and balance incomplete rows',()=>{
  for(const [count,sizes] of [[1,[1]],[2,[2]],[3,[3]],[4,[2,2]],[5,[3,2]],[6,[3,3]],[7,[3,2,2]],[8,[3,3,2]]])assert.deepEqual(partyRows(Array.from({length:count},(_,id)=>({id}))).map(r=>r.length),sizes);
});
test('initiative rotates from the current turn and keeps deterministic ties',()=>{
  const characters=['c','a','b','d'].map(id=>({id})),combat={scores:{a:20,b:15,c:15},current:'b'};
  assert.deepEqual(turnOrder(characters,combat).map(c=>c.id),['b','c','a','d']);
  assert.deepEqual(characters.map(c=>c.id),['c','a','b','d']);
});
test('skill finder includes tied leaders and uses shared public bonuses',()=>{
  const a=demoCharacter(),b=demoCharacter();b.name='Other';
  const chars=[a,b].map((c,i)=>({id:String(i),sheet:publicProjection(c),live:{}}));
  assert.equal(skillLeaders(chars,'Stealth').length,2);assert.equal(skillLeaders(chars,'Stealth')[0].bonus,6);
  chars[0].live.exhaustion=2;assert.equal(skillLeaders(chars,'Stealth')[0].character.id,'1');assert.equal(skillLeaders(chars,'Stealth')[1].bonus,2);
  assert.deepEqual(skillLeaders(chars,'fake'),[]);
});
test('live activities include temporary damage, healing, conditions and inspiration',()=>{
  const before={hp:10,tempHp:5,conditions:[],inspiration:0,concentration:''};
  assert.deepEqual(liveActivities(before,{...before,tempHp:2}),[{kind:'damage',text:'takes 3 damage'}]);
  assert.deepEqual(liveActivities(before,{...before,hp:0,tempHp:0,conditions:['Poisoned'],inspiration:1}).map(e=>e.kind),['damage','unconscious','inspiration','condition']);
  assert.equal(liveActivities(before,{...before,hp:14})[0].kind,'healing');assert.deepEqual(liveActivities(null,before),[]);
});
test('offers reserve each coin denomination and refund exactly without inventing change',()=>{
  const c=demoCharacter(),b=demoCharacter(),original=c.gold,recipient=b.gold;
  const offer=reserveTransfer(c,{kind:'money',coin:'gold',amount:12});assert.equal(c.gold,original-12);
  receiveTransfer(b,offer);assert.equal(b.gold,recipient+12);
  receiveTransfer(c,offer,{refund:true});assert.equal(c.gold,original);
  assert.throws(()=>reserveTransfer(c,{kind:'money',coin:'gold',amount:original+1}),/enough/);
  assert.throws(()=>reserveTransfer(c,{kind:'money',coin:'gold',amount:1.5}),/whole/);
  assert.throws(()=>reserveTransfer(c,{kind:'money',coin:'__proto__',amount:1}),/coin type/);
});
test('item offers split a stack, preserve uses, and arrive unequipped with a fresh ID',()=>{
  const a=demoCharacter(),b=demoCharacter(),item=a.items.find(i=>i.name==='Arrows');
  const offer=reserveTransfer(a,{kind:'item',itemId:item.id,amount:3});assert.equal(item.qty,17);
  receiveTransfer(b,offer);const received=b.items.at(-1);assert.notEqual(received.id,item.id);assert.equal(received.qty,3);assert.equal(received.equipped,false);
  receiveTransfer(a,offer,{refund:true});assert.equal(item.qty,20);
  assert.throws(()=>reserveTransfer(a,{kind:'item',itemId:a.items.find(i=>i.equipped).id,amount:1}),/Unequip/);
  assert.throws(()=>reserveTransfer(a,{kind:'item',itemId:item.id,amount:100}),/quantity/);
});
test('party preferences round trip and reject corrupt values',()=>{
  const c=demoCharacter(),state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false,partyNotifications:false,sessionMode:true}};
  assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  state.settings.sessionMode='yes';assert.throws(()=>parseBackup(JSON.stringify(state)),/party settings/);
});
