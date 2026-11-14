import test from 'node:test';
import assert from 'node:assert/strict';
import {createConditionUsage,CONDITION_USAGE_KEY,QUICK_CONDITION_LIMIT} from '../condition-usage.js';

const empty = {conditions:[],exhaustion:0};
const storage = (initial = null) => {
  let saved = initial;
  return {getItem:() => saved,setItem:(key,value) => {assert.equal(key,CONDITION_USAGE_KEY);saved=value;}};
};

test('frequent conditions survive reload and active effects stay within reach',() => {
  const cache=storage(),usage=createConditionUsage(() => cache);
  assert.equal(usage.shortcuts(empty).length,QUICK_CONDITION_LIMIT);
  usage.record('Invisible');usage.record('Invisible');usage.record('Blinded');
  assert.deepEqual(createConditionUsage(() => cache).shortcuts(empty).slice(0,2),['Invisible','Blinded']);
  assert.deepEqual(usage.shortcuts({conditions:['Petrified'],exhaustion:2}).slice(0,2),['Petrified','Exhaustion']);
  assert.equal(usage.shortcuts(empty)[0],'Invisible','Cleared effects return to frequency order');
});

test('corrupt or unavailable usage cache never prevents using conditions',() => {
  const defaults=createConditionUsage(() => storage()).shortcuts(empty);
  for(const saved of ['broken','null','[]',JSON.stringify({Invisible:{count:-1,lastUsed:1},Blinded:{count:'10',lastUsed:1}})]) {
    assert.deepEqual(createConditionUsage(() => storage(saved)).shortcuts(empty),defaults);
  }
  const usage=createConditionUsage(() => {throw new Error('Storage blocked');});
  usage.record('Exhaustion');
  assert.equal(usage.shortcuts(empty)[0],'Exhaustion','Session preferences work without localStorage');
  usage.record('Unknown condition');
  assert.equal(usage.shortcuts(empty).includes('Unknown condition'),false);
});

test('usage is bounded and extra saved keys are ignored',() => {
  const cache=storage(JSON.stringify({Invisible:{count:Number.MAX_SAFE_INTEGER,lastUsed:1},unknown:{count:99,lastUsed:1}}));
  const usage=createConditionUsage(() => cache);
  usage.record('Invisible');
  assert.deepEqual(Object.keys(JSON.parse(cache.getItem())),['Invisible']);
  assert.equal(JSON.parse(cache.getItem()).Invisible.count,1000000);
});
