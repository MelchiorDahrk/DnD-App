import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,shortRest,longRest} from '../model.js';
import {arcaneRecoveryPlan,flexibleCastingOptions,spellSlotPlan,syncSpellSlots} from '../spell-slots.js';
import {restRefreshes} from '../rest-rules.js';
import {applyLive,joinCharacter,makeOperation,splitCharacter} from '../cloud-model.js';

test('regular slots combine class levels and round contributing caster classes',()=>{
  const c=makeCharacter({class:'Wizard',level:9,spellSlotMode:'auto',multiclass:[
    {class:'Ranger',level:3,subclass:''},
    {class:'Fighter',level:3,subclass:'Eldritch Knight'}
  ]});
  assert.deepEqual(spellSlotPlan(c).maxima,[4,3,3,0,0,0,0,0,0]);
  c.multiclass[1].subclass='Champion';
  assert.deepEqual(spellSlotPlan(c).maxima,[4,3,2,0,0,0,0,0,0]);
  assert.deepEqual(spellSlotPlan(makeCharacter({class:'Monk',subclass:'Warrior of the Mystic Arts',level:7})).maxima.slice(0,3),[4,2,0]);
});

test('separate Pact Magic survives cloud operations and rests independently',()=>{
  const c=makeCharacter({class:'Warlock',level:3,spellSlotMode:'auto'});
  syncSpellSlots(c);
  c.slots[1].used=1;
  c.level=6;
  c.multiclass=[{class:'Wizard',level:3,subclass:''}];
  syncSpellSlots(c);
  assert.deepEqual(c.pactSlot,{level:2,max:2,used:1});
  c.slots[1].used=1;
  const split=splitCharacter(c);
  assert.deepEqual(joinCharacter(split.content,split.live),c);
  const rested=structuredClone(c);
  shortRest(rested);
  assert.equal(rested.slots[1].used,1);
  assert.equal(rested.pactSlot.used,0);
  const patch=makeOperation(c,rested);
  assert.equal(applyLive(split.live,patch).pactSlot.used,0);
  longRest(rested);
  assert.equal(rested.slots[1].used,0);
  const single=structuredClone(c);
  delete single.multiclass;
  syncSpellSlots(single);
  assert.equal(single.pactSlot,undefined);
  assert.equal(applyLive(split.live,makeOperation(c,single)).pactSlot,undefined);
});

test('overrides outlast advancement, while Flexible Casting slots expire',()=>{
  const c=makeCharacter({class:'Sorcerer',level:2,spellSlotMode:'auto',slotOverrides:[4,...Array(8).fill(null)]});
  c.features=[{name:'Font of Magic / Sorcery Points',maxUses:2,used:0,reset:'long'}];
  syncSpellSlots(c);
  assert.deepEqual(flexibleCastingOptions(c).options.map(row=>row.level),[1]);
  c.temporarySlots=[1,0,0,0,0];
  syncSpellSlots(c);
  assert.equal(c.slots[0].max,5);
  assert.equal(restRefreshes(c).find(row=>row.key==='slot-0').after,4);
  longRest(c);
  assert.equal(c.temporarySlots,undefined);
  c.level=5;
  syncSpellSlots(c);
  assert.deepEqual(c.slots.slice(0,3).map(slot=>slot.max),[4,3,2]);
  const old=makeCharacter({class:'Wizard',level:5});
  old.slots[0].max=1;
  syncSpellSlots(old);
  assert.equal(old.slots[0].max,1);
});

test('Arcane Grimoire adds to the recovery budget only when held and attuned',()=>{
  const c=makeCharacter({class:'Wizard',level:3,spellSlotMode:'auto'});
  c.features=[{name:'Arcane Recovery',maxUses:1,used:0}];
  syncSpellSlots(c);
  c.slots[0].used=1;
  c.items=[{catalogId:'magic-2014-arcane-grimoire',qty:1,equipped:true}];
  assert.equal(arcaneRecoveryPlan(c).budget,2);
  c.items[0].attuned=true;
  assert.equal(arcaneRecoveryPlan(c).budget,3);
  c.items[0].equipped=false;
  assert.equal(arcaneRecoveryPlan(c).budget,2);
  c.features[0].used=1;
  assert.equal(arcaneRecoveryPlan(c),null);
});
