import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,parseBackup,SAVE_VERSION,longRest,shortRest} from '../model.js';
import {findEquipment,itemFromEquipment} from '../catalog.js';
import {PACK_CONTENTS,itemUses,removeEmptyItems,setItemQuantity,spendItemUse} from '../inventory-rules.js';
import {packContents,unpackItem} from '../inventory.js';

const item=id=>itemFromEquipment(findEquipment(id));
const state=c=>({version:SAVE_VERSION,activeId:c.id,characters:[c],settings:{sound:false}});
const favorite=(c,i)=>{c.sheetLayout={collapsed:[],favorites:{pack:[i.id]}};};

test('every 2024 pack resolves to real catalog supplies with exact quantities',()=>{
  const expected={
    'burglars-pack':{Backpack:1,'Ball Bearings':1,Bell:1,Candle:10,Crowbar:1,'Lantern, Hooded':1,Oil:7,Rations:5,Rope:1,Tinderbox:1,Waterskin:1},
    'diplomats-pack':{Chest:1,'Clothes, Fine':1,Ink:1,'Ink Pen':5,Lamp:1,'Case, Map or Scroll':2,Oil:4,Paper:5,Parchment:5,Perfume:1,Tinderbox:1},
    'dungeoneers-pack':{Backpack:1,Caltrops:1,Crowbar:1,Oil:2,Rations:10,Rope:1,Tinderbox:1,Torch:10,Waterskin:1},
    'entertainers-pack':{Backpack:1,Bedroll:1,Bell:1,'Lantern, Bullseye':1,Costume:3,Mirror:1,Oil:8,Rations:9,Tinderbox:1,Waterskin:1},
    'explorers-pack':{Backpack:1,Bedroll:1,Oil:2,Rations:10,Rope:1,Tinderbox:1,Torch:10,Waterskin:1},
    'priests-pack':{Backpack:1,Blanket:1,'Holy Water':1,Lamp:1,Rations:7,Robe:1,Tinderbox:1},
    'scholars-pack':{Backpack:1,Book:1,Ink:1,'Ink Pen':1,Lamp:1,Oil:10,Parchment:10,Tinderbox:1}
  };
  assert.equal(Object.keys(PACK_CONTENTS).length,7);
  for(const [id,contents] of Object.entries(expected)) {
    const c=makeCharacter(),pack=item(id);c.items=[pack];
    const packedWeight=pack.weight;
    const result=unpackItem(c,pack.id);
    assert.ok(result);
    assert.deepEqual(Object.fromEntries(c.items.map(i=>[i.name,i.qty])),contents);
    assert.ok(c.items.every(i=>i.id!==pack.id&&i.description&&i.wiki));
    assert.ok(Math.abs(c.items.reduce((sum,item)=>sum+item.weight*item.qty,0)-packedWeight)<1e-9,`${id} retains its weight after unpacking`);
    assert.deepEqual(parseBackup(JSON.stringify(state(c))),state(c));
  }
});

test('older pack names unpack one at a time, stacking supplies without losing notes or favorites',()=>{
  const c=makeCharacter(),pack=item('explorers-pack'),torch=item('torch'),custom=item('torch');
  pack.name="Explorer's pack";pack.qty=2;torch.qty=3;torch.equipped=true;custom.description='A keepsake';
  c.items=[pack,torch,custom];favorite(c,torch);
  unpackItem(c,pack.id);
  assert.equal(c.items.find(i=>i.id===pack.id).qty,1);
  assert.equal(c.items.find(i=>i.id===torch.id).qty,13);
  assert.equal(c.items.find(i=>i.id===torch.id).equipped,true);
  assert.equal(c.items.find(i=>i.id===custom.id).description,'A keepsake');
  unpackItem(c,pack.id);
  assert.equal(c.items.find(i=>i.id===torch.id).qty,23);
  assert.equal(c.items.find(i=>i.id===pack.id),undefined);
  assert.equal(c.items.reduce((sum,i)=>sum+i.weight*i.qty,0),114);
  assert.equal(unpackItem(c,pack.id),null);
});

test('empty favorites survive unpacking, consumption, editing and save reload',()=>{
  for(const operation of ['unpack','consume','quantity']) {
    const c=makeCharacter(),entry=item(operation==='unpack'?'explorers-pack':'torch');c.items=[entry];favorite(c,entry);
    if(operation==='unpack')unpackItem(c,entry.id);
    else if(operation==='consume')spendItemUse(c,entry);
    else setItemQuantity(c,entry,0);
    assert.equal(c.items.find(i=>i.id===entry.id).qty,0);
    const restored=parseBackup(JSON.stringify(state(c))).characters[0];
    assert.equal(restored.items.find(i=>i.id===entry.id).qty,0);
    restored.sheetLayout.favorites.pack=[];removeEmptyItems(restored);
    assert.equal(restored.items.find(i=>i.id===entry.id),undefined);
  }
});

test('ordinary zero quantities are removed, including old saves',()=>{
  const c=makeCharacter(),torch=item('torch');c.items=[torch];
  setItemQuantity(c,torch,0);assert.deepEqual(c.items,[]);
  c.items=[item('torch')];spendItemUse(c,c.items[0]);assert.deepEqual(c.items,[]);
  c.items=[{...item('torch'),qty:0}];assert.deepEqual(parseBackup(JSON.stringify(state(c))).characters[0].items,[]);
});

test('healer kits get ten uses, advance to the next kit, and never recharge on rest',()=>{
  const c=makeCharacter(),kit=item('healers-kit');kit.qty=2;c.items=[kit];favorite(c,kit);
  delete kit.maxUses;delete kit.usesLeft;delete kit.consumeOnEmpty;kit.name="Healer's kit";
  assert.equal(itemUses(kit).usesLeft,10);
  spendItemUse(c,kit);assert.equal(kit.usesLeft,9);assert.equal(kit.qty,2);
  shortRest(c);longRest(c);assert.equal(kit.usesLeft,9);
  for(let n=0;n<9;n++)spendItemUse(c,kit);
  assert.equal(kit.qty,1);assert.equal(kit.usesLeft,10);
  for(let n=0;n<10;n++)spendItemUse(c,kit);
  assert.equal(kit.qty,0);assert.equal(kit.usesLeft,0);assert.equal(spendItemUse(c,kit),false);
  setItemQuantity(c,kit,1);assert.equal(kit.usesLeft,10);
  assert.deepEqual(parseBackup(JSON.stringify(state(c))),state(c));
});

test('last spent kit disappears, bundle ammo uses pieces, and individual ammo stays individual',()=>{
  const c=makeCharacter(),kit=item('healers-kit');kit.usesLeft=1;c.items=[kit];spendItemUse(c,kit);assert.deepEqual(c.items,[]);
  const arrows=item('arrows');c.items=[arrows];assert.equal(itemUses(arrows).maxUses,20);
  spendItemUse(c,arrows);assert.equal(arrows.qty,1);assert.equal(arrows.usesLeft,19);
  assert.equal(itemUses({name:'Arrows',qty:20,description:'Individual arrows',weight:.05}).maxUses,0);
  for(const id of ['disguise-kit','climbers-kit','herbalism-kit','thieves-tools']) {
    assert.equal(itemUses(item(id)).maxUses,0);assert.deepEqual(packContents(item(id)),[]);
  }
});

test('custom rechargeable items stay in inventory at zero uses and counters validate',()=>{
  const c=makeCharacter(),wand={...item('torch'),name:'Custom wand',maxUses:7,usesLeft:1,consumeOnEmpty:false};c.items=[wand];
  spendItemUse(c,wand);assert.equal(wand.qty,1);assert.equal(wand.usesLeft,0);
  assert.equal(spendItemUse(c,wand),false);
  assert.deepEqual(parseBackup(JSON.stringify(state(c))),state(c));
  for(const changes of [{maxUses:-1},{usesLeft:8},{usesLeft:1.5},{consumeOnEmpty:'yes'}]) {
    const invalid=state(structuredClone(c));Object.assign(invalid.characters[0].items[0],changes);
    assert.throws(()=>parseBackup(JSON.stringify(invalid)),/invalid.*item/i);
  }
});

test('unpacking respects quantity and entry limits without losing supplies',()=>{
  const c=makeCharacter(),pack=item('explorers-pack'),torch=item('torch');torch.qty=99999;c.items=[pack,torch];
  unpackItem(c,pack.id);assert.equal(c.items.filter(i=>i.name==='Torch').reduce((sum,i)=>sum+i.qty,0),100009);
  const full=makeCharacter(),fullPack=item('explorers-pack');full.items=[fullPack,...Array.from({length:1999},()=>item('torch'))];
  const before=structuredClone(full.items);assert.throws(()=>unpackItem(full,fullPack.id),/inventory is full/);
  assert.deepEqual(full.items,before);
});
