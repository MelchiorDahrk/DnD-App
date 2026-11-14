import test from 'node:test';
import assert from 'node:assert/strict';
import {actionTiming,sheetItems,sheetSpells} from '../sheet-actions.js';
import {demoCharacter,makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';

test('action timing distinguishes activation from follow-up spell effects and extra actions',()=>{
  for (const [castingTime,expected] of [['1 action','action'],['1 Bonus Action, immediately after hitting','bonus'],['1 reaction, when hit','reaction'],['10 minutes','special'],['','']]) {
    assert.equal(actionTiming({castingTime,notes:'Move it with a Bonus Action.'},'spell'),expected);
  }
  for (const description of ['Bonus Action: heal.','On your turn, use a Bonus Action to Hide.','Spend a shared die and a Bonus Action to feint.']) assert.equal(actionTiming({description},'feature'),'bonus');
  assert.equal(actionTiming({description:'Spend your Reaction to attack.'},'feature'),'reaction');
  assert.equal(actionTiming({description:'As an action, activate this item.'},'item'),'action');
  assert.equal(actionTiming({description:'On your turn, take one extra action other than the Magic action.'},'feature'),'');
  assert.equal(actionTiming({name:'Potion of healing'},'item'),'bonus');
  assert.equal(actionTiming({},'attack'),'action');
  assert.equal(actionTiming({actionType:'bonus'},'attack'),'bonus');
  assert.equal(actionTiming({actionType:'passive',description:'Bonus Action in the old rules.'},'feature'),'passive');
});

test('sheet inventory includes equipped gear and favorites beyond the preview without duplicates',()=>{
  const c=makeCharacter();
  c.items=Array.from({length:7},(_,i)=>({id:'item-'+i,category:'Gear',equipped:i===5}));
  c.sheetLayout={collapsed:[],favorites:{pack:['item-5','item-6','deleted']}};
  assert.deepEqual(sheetItems(c).map(i=>i.id),['item-0','item-1','item-2','item-5','item-6']);
  c.items[4].category='Consumable';
  assert.deepEqual(sheetItems(c).map(i=>i.id),['item-4','item-0','item-1','item-5','item-6']);
  assert.equal(c.items[0].id,'item-0','Preview sorting does not reorder saved inventory');
});

test('readied spells include an active concentration spell until concentration ends',()=>{
  const c={spells:[{id:'ready',name:'Readied',prepared:true},{id:'active',name:'Active',prepared:false},{id:'other',name:'Other',prepared:false}],concentration:'Active'};
  assert.deepEqual(sheetSpells(c).map(s=>s.id),['ready','active']);
  c.concentration='';
  assert.deepEqual(sheetSpells(c).map(s=>s.id),['ready']);
});

test('skill filter and action overrides round-trip while invalid values are rejected',()=>{
  const c=demoCharacter(),backup=()=>JSON.stringify({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});
  c.sheetLayout={collapsed:['skills'],favorites:{pack:[c.items[0].id]},skillsProficientOnly:true};
  c.attacks[0].actionType='bonus';c.items[0].actionType='action';c.features[0].actionType='passive';
  assert.deepEqual(parseBackup(backup()).characters[0],c);
  c.sheetLayout.skillsProficientOnly='yes';
  assert.throws(()=>parseBackup(backup()),/invalid character sheet layout/);
  c.sheetLayout.skillsProficientOnly=false;
  for (const entry of [c.attacks[0],c.items[0],c.features[0]]) {
    const before=entry.actionType;entry.actionType='invented';
    assert.throws(()=>parseBackup(backup()),/invalid action type/);
    entry.actionType=before;
  }
});

test('action favorites accommodate both attack and readied spell collections',()=>{
  const c=makeCharacter({sheetLayout:{collapsed:['attacks'],favorites:{attacks:Array.from({length:4001},(_,i)=>'action-'+i)}}});
  const backup=()=>JSON.stringify({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});
  assert.deepEqual(parseBackup(backup()).characters[0].sheetLayout,c.sheetLayout);
  c.sheetLayout.favorites.attacks.push('one-too-many');
  assert.throws(()=>parseBackup(backup()),/invalid character sheet layout/);
});
