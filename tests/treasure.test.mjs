import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GEMSTONES,ART_OBJECTS,TRADE_GOODS,TRADE_BARS,TREASURES} from '../treasure-data.js';
import {EQUIPMENT,findEquipment,itemFromEquipment} from '../catalog.js';
import {filterEquipment} from '../catalog-ui.js';
import {contentSourceIds} from '../content-sources.js';
import {equipmentIconURL,validItemIconKey} from '../equipment-icons.js';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';

test('the standard treasure tables include every value tier and distinct kind of loot',()=>{
  const tiers=entries=>Object.fromEntries([...new Set(entries.map(item=>item.cost))].map(cost=>[cost,entries.filter(item=>item.cost===cost).length]));
  assert.deepEqual(tiers(GEMSTONES),{'10 GP':12,'50 GP':12,'100 GP':10,'500 GP':6,'1,000 GP':8,'5,000 GP':4});
  assert.deepEqual(tiers(ART_OBJECTS),{'25 GP':10,'250 GP':10,'750 GP':10,'2,500 GP':10,'7,500 GP':10});
  assert.equal(TRADE_GOODS.length,23);assert.equal(TRADE_BARS.length,3);
  assert.equal(TREASURES.length,128);
  for(const treasure of TREASURES){
    assert.equal(findEquipment(treasure.id),treasure);
    assert.equal(treasure.category,'Treasure');assert.ok(!treasure.magic);
    assert.equal(treasure.source,"Dungeon Master's Guide");
    assert.ok(validItemIconKey(treasure.iconKey),treasure.name);
  }
  assert.equal(new Set(EQUIPMENT.map(item=>item.id)).size,EQUIPMENT.length,'no collision with equipment or magic items');
});

test('emerald and the full treasure groups can be searched and follow the correct source setting',()=>{
  const emerald=findEquipment('emerald');
  assert.equal(emerald.cost,'1,000 GP');assert.equal(emerald.iconKey,'emerald');
  assert.deepEqual(filterEquipment(EQUIPMENT,{group:'Gemstones',query:'emerald'}),[emerald]);
  for(const group of ['Gemstones','Art objects & jewelry','Trade goods','Trade bars']){
    const entries=TREASURES.filter(item=>item.group===group);
    assert.deepEqual(filterEquipment(EQUIPMENT,{group}),entries);
  }
  const hiddenSources=contentSourceIds(emerald,'item');
  assert.deepEqual(filterEquipment(TREASURES,{settings:{hiddenSources}}),[]);
  assert.ok(filterEquipment(TREASURES,{settings:{hiddenSources:contentSourceIds({source:'2024 core'},'item')}}).includes(emerald),'treasure belongs to the DMG rather than the PHB');
});

test('loot snapshots retain values, distinct artwork, quantities and editable weight estimates in backups',async()=>{
  const character=makeCharacter();
  character.items=TREASURES.map(entry=>({...itemFromEquipment(entry),name:`Quest loot: ${entry.name}`,qty:3}));
  const state={version:SAVE_VERSION,characters:[character],activeId:character.id,settings:{sound:false}};
  const loaded=parseBackup(JSON.stringify(state));
  assert.deepEqual(loaded,state);
  for(const [index,entry] of TREASURES.entries()){
    const item=loaded.characters[0].items[index];
    assert.match(item.description,new RegExp(`Cost: ${entry.cost.replace(/[.]/g,'\\.')}\\.`));
    assert.equal(equipmentIconURL(item),`./assets/equipment/${entry.iconKey}.webp`,'renaming quest loot keeps its icon');
    const bytes=await readFile(new URL(`../assets/equipment/${entry.iconKey}.webp`,import.meta.url));
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    if(entry.weightStatus)assert.ok(item.description.includes(entry.weightStatus));
  }
  for(const gem of GEMSTONES)assert.ok(gem.weight>0&&/Estimated/.test(gem.weightStatus));
  for(const name of ['Chicken','Goat','Sheep','Pig','Cow','Ox']){
    const animal=TRADE_GOODS.find(entry=>entry.name===name);
    assert.equal(animal.carried,false);assert.equal(animal.weight,0);
  }
  assert.equal(findEquipment('flour-2-lb').weight,2);
  assert.equal(findEquipment('silver-trade-bar-2-lb').weight,2);
  assert.equal(findEquipment('gold-trade-bar-5-lb').cost,'250 GP');
  assert.notEqual(equipmentIconURL(findEquipment('ruby')),equipmentIconURL(findEquipment('emerald')));
  assert.notEqual(equipmentIconURL(findEquipment('pearl')),equipmentIconURL(findEquipment('black-pearl')));
});
