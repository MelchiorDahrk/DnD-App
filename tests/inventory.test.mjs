import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,parseBackup,SAVE_VERSION,longRest,shortRest} from '../model.js';
import {findEquipment,itemFromEquipment,WEAPONS,attackFromWeapon,attackFromEquipment} from '../catalog.js';
import {PACK_CONTENTS,itemUses,removeEmptyItems,setItemQuantity,spendItemUse} from '../inventory-rules.js';
import {packContents,unpackItem,itemAttack,saveItemAttack,linkWeaponActions} from '../inventory.js';

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

test('pack weapon defaults match every action preset and survive backup reloads',()=>{
  const c=makeCharacter({stats:{str:8,dex:18,con:10,int:10,wis:10,cha:10}});
  for(const weapon of WEAPONS){
    const entry=itemFromEquipment(weapon);c.items.push(entry);
    const defaults=attackFromEquipment(entry,c);
    assert.deepEqual(defaults,{...attackFromWeapon(weapon,c),actionType:''});
    saveItemAttack(c,entry,defaults);
    assert.equal(itemAttack(c,entry).weaponId,weapon.id);
  }
  assert.equal(c.attacks.length,38);
  assert.deepEqual(parseBackup(JSON.stringify(state(c))),state(c));
});

test('magic weapons use their documented base, potency, and complete special-damage notes',()=>{
  const c=makeCharacter({stats:{str:16,dex:14,con:10,int:10,wis:10,cha:10}});
  const dagger=attackFromEquipment(item('magic-dagger-of-venom'),c);
  assert.equal(dagger.weaponId,'dagger');assert.equal(dagger.bonus,1);assert.equal(dagger.damage,'1d4+4');
  assert.match(dagger.notes,/2d10 Poison/);
  const magic=item('magic-weapon-1-2-or-3-2'),sword=attackFromEquipment(magic,c),bow=attackFromEquipment(magic,c,'longbow');
  assert.equal(sword.weaponId,'longsword');assert.equal(sword.bonus,2);assert.equal(sword.damage,'1d8+5');
  assert.equal(bow.weaponId,'longbow');assert.equal(bow.ability,'dex');assert.equal(bow.damage,'1d8+4');
  assert.equal(attackFromEquipment(item('magic-weapon-1-2-or-3'),c).bonus,0,'variable potency must be reviewed');
});

test('legacy weapons adopt only unambiguous actions and retain custom attack settings and favorites',()=>{
  const c=makeCharacter(),sword=item('longsword');c.items=[sword];
  const existing={id:'old-action',...attackFromWeapon(findEquipment('longsword'),c),damage:'2d8+7',bonus:4,notes:'My house rules',mastery:'Sap',actionType:'reaction'};
  c.attacks=[existing];c.sheetLayout={collapsed:[],favorites:{attacks:[existing.id]}};
  linkWeaponActions(c);linkWeaponActions(c);
  assert.equal(c.attacks.length,1);assert.equal(itemAttack(c,sword),existing);
  assert.equal(existing.damage,'2d8+7');assert.equal(existing.bonus,4);assert.equal(existing.notes,'My house rules');
  assert.equal(sword.actionType,'reaction');assert.deepEqual(c.sheetLayout.favorites.attacks,['old-action']);
  assert.equal(itemAttack(c,{}),undefined,'an unsaved item cannot claim a standalone action');
});

test('duplicate weapon names link by item identity, with independent edits and cascading removal',()=>{
  const c=makeCharacter(),first=item('dagger'),second=item('dagger');c.items=[first,second];
  c.attacks=[{id:'standalone',...attackFromWeapon(findEquipment('dagger'),c)}];
  linkWeaponActions(c);assert.equal(c.attacks.length,3);assert.equal(c.attacks[0].itemId,undefined);
  const attack=itemAttack(c,first),other=itemAttack(c,second);first.name='Moon dagger';first.actionType='bonus';
  saveItemAttack(c,first,{...attack,damage:'1d4+8',rollMode:'advantage',mastery:'Nick',proficient:false});
  assert.equal(attack.name,'Moon dagger');assert.equal(attack.actionType,'bonus');assert.equal(attack.damage,'1d4+8');
  assert.notEqual(other.id,attack.id);assert.notEqual(other.damage,attack.damage);
  c.sheetLayout={collapsed:[],favorites:{attacks:[attack.id,other.id,'standalone']}};
  first.qty=2;setItemQuantity(c,first,1);assert.ok(c.attacks.includes(attack));
  setItemQuantity(c,first,0);assert.ok(!c.attacks.includes(attack));
  assert.ok(c.attacks.includes(other));assert.equal(c.attacks[0].id,'standalone');
  assert.deepEqual(c.sheetLayout.favorites.attacks,[other.id,'standalone']);
  second.category='Gear';removeEmptyItems(c);assert.deepEqual(c.attacks.map(a=>a.id),['standalone']);
});

test('saved weapon links reject missing, duplicate, or malformed item references',()=>{
  const c=makeCharacter(),weapon=item('spear');c.items=[weapon];linkWeaponActions(c);
  for(const itemId of ['missing','<bad>',2]){
    const invalid=structuredClone(c);invalid.attacks[0].itemId=itemId;
    assert.throws(()=>parseBackup(JSON.stringify(state(invalid))),/attack item link/);
  }
  const duplicate=structuredClone(c);duplicate.attacks.push({...duplicate.attacks[0],id:'another-action'});
  assert.throws(()=>parseBackup(JSON.stringify(state(duplicate))),/duplicate attack item link/);
  const invalid=structuredClone(c);invalid.items[0].catalogId={bad:true};
  assert.throws(()=>parseBackup(JSON.stringify(state(invalid))),/item catalog reference/);
});
