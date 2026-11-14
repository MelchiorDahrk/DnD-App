import test from 'node:test';
import assert from 'node:assert/strict';
import {rollDice} from '../model.js';
import {rollAttackDamage} from '../attack-rules.js';
import {diceAnimationPlan,facesMatch} from '../dice-roller.js';

test('3D targets preserve every recorded face and leave modifiers in the rules model',()=>{
  for(const sides of [4,6,8,10,12,20,100]) {
    const result=rollDice(`2d${sides}+3`,'normal',()=>sides);
    assert.deepEqual(diceAnimationPlan(result).dice,[{dice:`d${sides}`,rolled:sides},{dice:`d${sides}`,rolled:sides}]);
    assert.equal(result.total,2*sides+3);
  }
});
test('advantage, disadvantage and critical damage animate all rolled dice',()=>{
  for(const mode of ['advantage','disadvantage']) {
    const values=[3,19],r=rollDice('1d20-2',mode,()=>values.shift());
    assert.deepEqual(diceAnimationPlan(r).dice.map(d=>d.rolled),[3,19]);
    assert.equal(r.total,mode==='advantage'?17:1);
  }
  assert.equal(diceAnimationPlan(rollAttackDamage('2d6+3',true,()=>4)).dice.length,4);
});
test('fixed, unusual and large rolls keep their full result without a misleading partial animation',()=>{
  for(const expression of ['7','1d3','50d6','11d100']) {
    const r=rollDice(expression,'normal',()=>2);
    const before=structuredClone(r);
    assert.equal(diceAnimationPlan(r).dice.length,0);
    assert.deepEqual(r,before);
  }
  assert.equal(diceAnimationPlan(rollDice('10d100','normal',()=>100)).dice.length,10);
});
test('visible face validation accepts D&D zero faces and rejects actual mismatches',()=>{
  assert.ok(facesMatch([{type:'d10',value:10,visible:0},{type:'d100',value:100,visible:0},{type:'d100',value:0,visible:0},{type:'d20',value:20,visible:20}]));
  assert.equal(facesMatch([{type:'d20',value:20,visible:1}]),false);
  assert.equal(facesMatch([]),false);
});
