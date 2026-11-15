import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT,itemFromEquipment} from '../catalog.js';
import {defaultCharacters} from '../default-characters.js';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';

const entry=name=>{
  const item=EQUIPMENT.find(item=>item.name===name);
  assert.ok(item,name);
  return item;
};

test('every carried preset has a positive weight or an explicit negligible/nonphysical reason',()=>{
  for(const item of EQUIPMENT) {
    assert.ok(Number.isFinite(item.weight)&&item.weight>=0,item.name);
    if(item.carried===false)continue;
    if(item.weight===0)assert.match(item.weightStatus,/negligible|Spatial void/,item.name);
    assert.doesNotMatch(item.weightStatus||'',/Unspecified|currently excluded/,item.name);
    const snapshot=itemFromEquipment(item);
    assert.equal(snapshot.weight,item.weight,item.name);
    if(item.weightStatus)assert.ok(snapshot.description.includes(item.weightStatus),item.name);
  }
});

test('explicit physical weights take precedence over generic shape and base equipment',()=>{
  for(const [name,weight] of [
    ['Bag of Holding',5],['Bag of Beans',.5],['Bead of Force',1/16],
    ['Apparatus of Kwalish',500],["Gurt's Greataxe",325],['Staff of Defense',3],
    ['Stone of Controlling Earth Elementals',5],['Pot of Awakening',10],
    ['Professor Orb',5],['Icon of Ravenloft',10],['The Infernal Machine Of Lum The Mad',5500]
  ]) {
    assert.equal(entry(name).weight,weight,name);
    assert.match(entry(name).weightStatus,/Listed/,name);
  }
  assert.equal(entry('Mechanical Wonder').weight,500);
  assert.match(entry('Mechanical Wonder').weightStatus,/gyrocopter variant/);
  assert.equal(entry('Portable Hole').weight,0);
  assert.match(entry('Portable Hole').weightStatus,/negligible/);
  assert.equal(entry('Ythryn Mythallar').carried,false);
});

test('variable bases and estimated shapes have useful defaults with visible adjustment notes',()=>{
  for(const [name,weight] of [['Weapon, +1',3],['Armor, +1',10],['Dwarven Plate',65],['Oathbow',2]]) {
    assert.equal(entry(name).weight,weight,name);
    assert.match(entry(name).weightStatus,/Default base.*adjust/,name);
  }
  assert.equal(entry('Cloak of Protection').weight,3);
  assert.match(entry('Cloak of Protection').weightStatus,/Estimated cloak/);
  assert.equal(entry('Ring of Protection').weight,.02);
  assert.match(entry('Ring of Protection').weightStatus,/Estimated ring/);
  assert.equal(entry('Paper').weight,.01);
  assert.match(entry('Paper').weightStatus,/Estimated.*rules list negligible/);
});

test('mundane ammunition stays bundled and magic ammunition counts individual pieces',()=>{
  assert.equal(entry('Arrows').weight,1);
  for(const name of ['Ammunition, +1','Ammunition, +2','Ammunition, +3','Ammunition of Slaying','Unbreakable Arrow']) {
    assert.equal(entry(name).weight,.05,name);
    assert.match(entry(name).weightStatus,/per piece/,name);
  }
  assert.equal(entry('Sling Bullets of Althemone').weight,.075);
});

test('included paper inventories use physical weights without multiplying ammunition by bundle size',()=>{
  const [melchior,balin,teyla]=defaultCharacters();
  for(const c of [melchior,balin,teyla])for(const item of c.items)assert.ok(item.weight>0,`${c.name}: ${item.name}`);
  const arrow=melchior.items.find(item=>item.name==='Arrows');
  assert.equal(arrow.qty,40);assert.equal(arrow.weight*arrow.qty,2);
  assert.equal(balin.items.find(item=>item.name==='+1 Battleaxe').weight,4);
  const needles=teyla.items.find(item=>item.name==='Blowgun needles');
  assert.equal(needles.qty,100);assert.equal(needles.weight*needles.qty,2);
  const pack=teyla.items.find(item=>item.name==='Explorer’s pack');
  assert.equal(pack.weight,5);assert.match(pack.description,/Backpack only/);
});

test('saved and custom weights survive loading independently of new catalog defaults',()=>{
  const c=makeCharacter();
  c.items=[{...itemFromEquipment(entry('Cloak of Protection')),weight:0,description:'My old custom notes'},itemFromEquipment(entry('Bead of Force'))];
  const state={version:SAVE_VERSION,activeId:c.id,characters:[c],settings:{sound:false}};
  assert.deepEqual(parseBackup(JSON.stringify(state)),state);
});
