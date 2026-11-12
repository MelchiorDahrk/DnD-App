import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,changeHP} from '../model.js';
import {hpFeedback} from '../vfx.js';

function apply(c,amount,kind) {
  const before={hp:c.hp,tempHp:c.tempHp};
  changeHP(c,amount,kind);
  return hpFeedback(before,c,kind);
}

test('combat feedback counts absorbed damage and actual HP loss separately',()=>{
  const c=makeCharacter({hp:20,maxHp:20,tempHp:6});
  assert.deepEqual(apply(c,10,'damage'),{kind:'damage',label:'−10',detail:'4 HP · 6 absorbed',amount:10});
  assert.equal(c.hp,16);
  c.tempHp=8;
  assert.deepEqual(apply(c,3,'damage'),{kind:'damage',label:'−3',detail:'0 HP · 3 absorbed',amount:3});
  assert.equal(c.hp,16);
});

test('healing feedback caps at maximum HP and recognizes revival',()=>{
  const c=makeCharacter({hp:18,maxHp:20});
  assert.deepEqual(apply(c,99,'heal'),{kind:'heal',label:'+2 HP',detail:'HEALING',amount:2});
  assert.equal(apply(c,5,'heal'),null);
  c.hp=0;
  assert.deepEqual(apply(c,1,'heal'),{kind:'heal',label:'+1 HP',detail:'BACK ON YOUR FEET',amount:1});
});

test('temporary HP feedback shows only the new protection actually granted',()=>{
  const c=makeCharacter({hp:20,maxHp:20,tempHp:5});
  assert.equal(apply(c,3,'temp'),null);
  assert.equal(apply(c,5,'temp'),null);
  assert.deepEqual(apply(c,8,'temp'),{kind:'shield',label:'+3 TEMP',detail:'PROTECTED',amount:3});
});

test('zero amounts and unchanged HP do not create misleading combat effects',()=>{
  const c=makeCharacter({hp:2,maxHp:20});
  for(const kind of ['damage','heal','temp'])assert.equal(apply(c,0,kind),null);
  assert.equal(apply(c,999,'damage').amount,2);
  assert.equal(apply(c,999,'damage'),null);
});
