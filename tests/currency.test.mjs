import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMoney} from '../model.js';

test('money accepts totals, relative changes, and addition/subtraction chains',()=>{
  for(const [expression,total] of [['25',25],['0',0],['+10',60],['-5',45],['−5',45],['25+10-5',30],[' + 10 − 5 ',55],['50 - 50 + 1',1],['+0',50]]) {
    assert.equal(calculateMoney(50,expression),total,expression);
  }
});

test('money rejects malformed expressions and unsafe arithmetic',()=>{
  for(const expression of ['', ' ', '1.5', '1,000', '1 2', '1e3', '0x10', '1+','--5','10+-5','2*5','10/2','(10+5)','Infinity','NaN','alert(1)','1;globalThis.test=1','9007199254740992-9007199254740991','1+'.repeat(61)+'1']) {
    assert.throws(()=>calculateMoney(50,expression),undefined,expression);
  }
});

test('money preserves whole coin limits without silently clamping or borrowing',()=>{
  assert.equal(calculateMoney(100000000,'+0'),100000000);
  assert.equal(calculateMoney(50,'-50'),0);
  assert.equal(calculateMoney(50,'100000000'),100000000);
  assert.throws(()=>calculateMoney(50,'-51'),/enough coins/);
  assert.throws(()=>calculateMoney(0,'-1'),/enough coins/);
  assert.throws(()=>calculateMoney(100000000,'+1'),/100,000,000/);
  assert.throws(()=>calculateMoney(50,'100000001'),/100,000,000/);
});
