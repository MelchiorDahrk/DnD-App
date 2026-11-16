import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,demoCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {ARMOR,findEquipment,itemFromEquipment} from '../catalog.js';
import {armorClass,armorClassDetails,itemDefense,setItemEquipped} from '../armor-class.js';
import {setItemQuantity,spendItemUse} from '../inventory-rules.js';
import {defaultCharacters} from '../default-characters.js';

const item=(id,extra={})=>({...itemFromEquipment(findEquipment(id)),...extra});
const fighter=()=>makeCharacter({class:'Fighter',stats:{str:16,dex:18,con:16,int:10,wis:16,cha:10},ac:99});
const backup=c=>JSON.stringify({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});

test('AC derives from current armor and ability scores rather than the recorded total',()=>{
  const c=fighter();assert.equal(armorClass(c),14);
  const expected={Light:armor=>armor.ac+4,Medium:armor=>armor.ac+2,Heavy:armor=>armor.ac};
  for(const armor of ARMOR.filter(armor=>armor.family!=='Shield')) {
    c.items=[item(armor.id,{equipped:true})];
    assert.equal(armorClass(c),expected[armor.family](armor),armor.name);
    c.stats.dex=8;
    assert.equal(armorClass(c),armor.ac+(armor.family==='Heavy'?0:-1),`${armor.name} with negative Dexterity`);
    c.stats.dex=18;
  }
  c.items=[];c.stats.dex=8;assert.equal(armorClass(c),9);
});

test('equipping replacement armor, unequipping, deletion, and zero quantity update AC immediately',()=>{
  const c=fighter(),leather=item('leather-armor'),plate=item('plate-armor');c.items=[leather,plate];
  setItemEquipped(c,leather,true);assert.equal(armorClass(c),15);
  setItemEquipped(c,plate,true);assert.equal(leather.equipped,false);assert.equal(armorClass(c),18);
  setItemEquipped(c,plate,false);assert.equal(armorClass(c),14);
  setItemEquipped(c,plate,true);c.sheetLayout={collapsed:[],favorites:{pack:[plate.id]}};
  setItemQuantity(c,plate,0);assert.ok(c.items.includes(plate));assert.equal(armorClass(c),14);
  setItemEquipped(c,plate,true);assert.equal(plate.equipped,false);
  setItemQuantity(c,plate,1);setItemEquipped(c,plate,true);assert.equal(armorClass(c),18);
  c.items=c.items.filter(i=>i!==plate);assert.equal(armorClass(c),14);
});

test('a shield requires training and contributes only once regardless of copies or quantity',()=>{
  const c=fighter(),shield=item('shield',{equipped:true,qty:3});c.items=[shield,{...shield,id:'another'}];
  assert.equal(armorClass(c),16);
  c.armorProficiencies='Light armor';assert.equal(armorClass(c),14);
  assert.match(armorClassDetails(c).warnings.join(' '),/training/);
  c.armorProficiencies='Shields';assert.equal(armorClass(c),16);
});

test('switching between shield, dual weapons, and two-handed weapons manages hands and AC',()=>{
  const c=fighter(),armor=item('chain-mail'),shield=item('shield'),sword=item('longsword'),dagger=item('dagger'),bow=item('longbow');
  c.items=[armor,shield,sword,dagger,bow];
  for(const i of [armor,shield,sword])setItemEquipped(c,i,true);
  assert.equal(armorClass(c),18);
  setItemEquipped(c,dagger,true);assert.equal(sword.equipped,true);assert.equal(shield.equipped,false);assert.equal(armorClass(c),16);
  setItemEquipped(c,dagger,false);setItemEquipped(c,shield,true);assert.equal(armorClass(c),18);
  setItemEquipped(c,bow,true);assert.equal(sword.equipped,false);assert.equal(shield.equipped,false);assert.equal(armorClass(c),16);
  setItemEquipped(c,shield,true);assert.equal(bow.equipped,false);assert.equal(armorClass(c),18);
  sword.wielding='Two hands';setItemEquipped(c,sword,true);assert.equal(shield.equipped,false);assert.equal(armorClass(c),16);
});

test('two weapons from one stack are explicit and decrease to one hand as quantity decreases',()=>{
  const c=fighter(),shield=item('shield'),daggers=item('dagger',{qty:2});c.items=[shield,daggers];
  setItemEquipped(c,shield,true);setItemEquipped(c,daggers,true);assert.equal(armorClass(c),16,'carrying two is not dual wielding');
  daggers.wielding='Dual wield (2 from stack)';setItemEquipped(c,daggers,true);
  assert.equal(shield.equipped,false);assert.equal(armorClass(c),14);
  setItemQuantity(c,daggers,1);assert.equal(itemDefense(daggers).hands,1);
  setItemEquipped(c,shield,true);assert.equal(armorClass(c),16);
});

test('magic armor uses its selected base and potency, and magic shields add their enhancement to +2',()=>{
  const c=fighter(),armor=item('magic-armor-1-2-or-3-1',{equipped:true,armorId:'half-plate-armor'}),shield=item('magic-shield-1-2-or-3-3',{equipped:true});
  c.items=[armor,shield];assert.equal(armorClass(c),23);
  armor.armorId='plate-armor';assert.equal(armorClass(c),24);
  armor.requiresAttunement=true;assert.equal(armorClass(c),23);
  armor.attuned=true;assert.equal(armorClass(c),24);
  shield.equipped=false;assert.equal(armorClass(c),19);
});

test('worn and attuned defensive items apply once, stack with distinct items, and stop on removal',()=>{
  const c=fighter(),ring=item('magic-ring-of-protection',{equipped:true}),cloak=item('magic-cloak-of-protection',{equipped:true,attuned:true});
  c.items=[ring,cloak];assert.equal(armorClass(c),15);
  ring.attuned=true;assert.equal(armorClass(c),16);
  c.items.push({...ring,id:'duplicate',qty:4});assert.equal(armorClass(c),16);
  cloak.equipped=false;assert.equal(armorClass(c),15);
  c.items=c.items.filter(i=>i!==ring&&i.id!=='duplicate');assert.equal(armorClass(c),14);
  const charm=item('torch',{name:'Temporary defensive charm',equipped:true,category:'Consumable',acBonus:2});c.items=[charm];
  assert.equal(armorClass(c),16);spendItemUse(c,charm);assert.equal(armorClass(c),14);
});

test('named magic armor and held defensive staves use their documented bases and bonuses',()=>{
  const c=fighter();
  for(const [id,expected] of [['magic-dragon-scale-mail',17],['magic-glamoured-studded-leather',17],['magic-dwarven-plate',20],['magic-elven-chain',17]]) {
    c.items=[item(id,{equipped:true,attuned:true})];assert.equal(armorClass(c),expected,id);
  }
  const staff=item('magic-2014-staff-of-defense',{equipped:true,attuned:true});
  c.items=[staff];assert.equal(armorClass(c),15);assert.equal(itemDefense(staff).hands,1);
});

test('unarmored defense and bracers respect armor and shield restrictions and ability changes',()=>{
  const c=fighter(),bracers=item('magic-bracers-of-defense',{equipped:true,attuned:true}),shield=item('shield',{equipped:true}),leather=item('leather-armor',{equipped:true});
  c.class='Barbarian';c.items=[bracers];assert.equal(armorClass(c),19);
  c.stats.con=18;assert.equal(armorClass(c),20);
  c.items.push(shield);assert.equal(armorClass(c),20,'shield replaces the bracers bonus');
  c.items.push(leather);assert.equal(armorClass(c),17);
  c.items=[bracers];c.class='Monk';assert.equal(armorClass(c),19);
  c.items.push(shield);assert.equal(armorClass(c),14,'untrained shield also prevents Monk defense and bracers');
  c.armorProficiencies='Shields';assert.equal(armorClass(c),16);
});

test('Defense applies only with armor, and custom adjustments and explicit overrides remain available',()=>{
  const c=fighter();c.features=[{name:'Fighting Style: Defense'}];assert.equal(armorClass(c),14);
  c.items=[item('plate-armor',{equipped:true})];assert.equal(armorClass(c),19);
  c.acBonus=2;assert.equal(armorClass(c),21);c.acOverride=12;assert.equal(armorClass(c),12);
  c.items=[];assert.equal(armorClass(c),12);assert.equal(armorClassDetails(c).automatic,16);
  delete c.acOverride;assert.equal(armorClass(c),16);
});

test('existing name-only characters and enhanced armor names work without changing their recorded AC',()=>{
  for(const c of [...defaultCharacters(),demoCharacter()])assert.equal(armorClass(c),c.ac,c.name);
  const c=fighter();c.items=[{name:'+1 Plate Armor',category:'Armor',qty:1,equipped:true}];
  assert.equal(armorClass(c),19);assert.equal(c.ac,99);
  c.items[0].name='Mysterious armor';assert.match(armorClassDetails(c).warnings.join(' '),/Choose a base armor/);
  c.items[0].armorId='chain-mail';assert.equal(armorClass(c),16);
});

test('legacy saves with incompatible held equipment never grant a phantom shield bonus',()=>{
  const c=fighter();c.items=[item('shield',{equipped:true}),item('shortsword',{equipped:true}),item('dagger',{equipped:true})];
  assert.equal(armorClass(c),14);assert.match(armorClassDetails(c).warnings.join(' '),/both hands/);
});

test('AC settings survive backups, remain optional for older saves, and reject corrupt values',()=>{
  const c=fighter();c.acBonus=1;c.acOverride=20;
  c.items=[item('magic-armor-1-2-or-3-1',{armorId:'plate-armor',acBonus:2,acCondition:'Always',wielding:'Automatic',requiresAttunement:true,attuned:true,equipped:true})];
  const restored=parseBackup(backup(c)).characters[0];assert.deepEqual(restored,c);assert.equal(armorClass(restored),20);
  delete c.acBonus;delete c.acOverride;assert.equal(armorClass(parseBackup(backup(c)).characters[0]),20);
  for(const [key,value] of [['acBonus','2'],['armorId',{}],['weaponId',null],['acCondition','Sometimes'],['wielding',4],['requiresAttunement',1],['attuned','true']]) {
    const bad=structuredClone(c);bad.items[0][key]=value;assert.throws(()=>parseBackup(backup(bad)),/Invalid backup/);
  }
  for(const [key,value] of [['acBonus',1.5],['acOverride',100]]) {const bad=structuredClone(c);bad[key]=value;assert.throws(()=>parseBackup(backup(bad)),/Invalid backup/);}
});
