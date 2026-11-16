import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,attackBonus,parseBackup,SAVE_VERSION} from '../model.js';
import {defaultCharacters} from '../default-characters.js';
import {WEAPONS,EQUIPMENT,itemFromEquipment,attackFromWeapon} from '../catalog.js';
import {ensureTraining,trainingFor,hasWeaponTraining,validTraining} from '../training-rules.js';
import {prepareTraining,addToolToInventory,itemTool,toolCheck,linkWeaponActions} from '../inventory.js';
import {armorClass,armorTrainingEffects,armorCheckMode} from '../armor-class.js';
import {attackContext} from '../attack-rules.js';
const entry=name=>EQUIPMENT.find(e=>e.name===name);
const backup=c=>JSON.stringify({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});

test('default notes become structured training and missing physical tools without duplicates',()=>{
  const [fighter,barbarian,rogue]=defaultCharacters();
  assert.deepEqual(fighter.training.languages,['Common','Dwarvish','Elvish']);
  assert.deepEqual(fighter.training.armor,['Light','Medium','Heavy','Shield']);
  for(const c of [fighter,barbarian,rogue]){
    assert.ok(validTraining(c.training));
    for(const id of c.training.tools)assert.ok(c.items.some(i=>itemTool(i)?.id===id&&i.qty>0));
    const original=structuredClone(c);prepareTraining(c);assert.deepEqual(c,original);
    assert.deepEqual(parseBackup(backup(c)).characters[0],c);
  }
  assert.ok(!rogue.training.weapons.includes('longsword'));
  assert.ok(!rogue.training.weapons.includes('blowgun'));
  assert.ok(rogue.training.weapons.includes('hand-crossbow'));
  assert.ok(rogue.training.languages.includes('Thieves’ Cant'));
  assert.ok(barbarian.training.tools.includes('brewers-supplies'));
});

test('older saves remain valid and convert once; losing tools never recreates them',()=>{
  const c=makeCharacter({languages:'Common, Undercommon, Moon Speech',toolProficiencies:'Thieves’ tools; Smith’s tools (Student of War)'});
  const restored=parseBackup(backup(c)).characters[0];assert.equal(restored.training,undefined);
  linkWeaponActions(restored);assert.equal(restored.items.length,2);
  assert.ok(restored.training.languages.includes('Moon Speech'));
  restored.items=[];linkWeaponActions(restored);assert.equal(restored.items.length,0);
  addToolToInventory(restored,'thieves-tools');addToolToInventory(restored,'thieves-tools');assert.equal(restored.items.length,1);
});

test('weapon selections change existing and renamed attacks immediately; custom attacks and overrides work',()=>{
  const c=makeCharacter({class:'Rogue'}),w=WEAPONS.find(w=>w.id==='longsword'),a=attackFromWeapon(w,c);
  ensureTraining(c);a.name='My ancestral blade';
  const before=attackBonus(c,a);c.training.weapons.push(w.id);
  assert.equal(attackBonus(c,a),before+2);c.level=5;assert.equal(attackBonus(c,a),before+3);
  c.training.weapons=[];a.proficiencyMode='proficient';assert.equal(attackBonus(c,a),before+3);
  a.proficiencyMode='untrained';assert.equal(attackBonus(c,a),before);
  assert.equal(attackBonus(c,{...a,weaponId:'',proficiencyMode:'auto',proficient:true}),before+3);
  assert.ok(!hasWeaponTraining(c,w));
});

test('restricted legacy martial rules recognize the full Rogue wording and Monk light weapons',()=>{
  const c=makeCharacter({class:'Rogue',weaponProficiencies:'Simple weapons; Martial weapons with the Finesse or Light property'});
  const weapons=trainingFor(c).weapons;
  assert.ok(weapons.includes('rapier'));assert.ok(weapons.includes('hand-crossbow'));assert.ok(!weapons.includes('longbow'));
  c.class='Monk';c.weaponProficiencies='';assert.ok(!trainingFor(c).weapons.includes('rapier'));
});

test('tool checks use the catalog ability, one proficiency, applicable Expertise, exhaustion and both proficiencies for advantage',()=>{
  const c=makeCharacter({level:5,skills:['Sleight of Hand'],stats:{str:16,dex:18,con:10,int:12,wis:10,cha:10}});
  ensureTraining(c);const tools=addToolToInventory(c,'thieves-tools');
  assert.equal(toolCheck(c,tools).bonus,4);assert.equal(toolCheck(c,tools).ability,'dex');
  c.training.tools.push('thieves-tools');assert.equal(toolCheck(c,tools).bonus,7);
  let check=toolCheck(c,tools,{skill:'Sleight of Hand'});assert.equal(check.bonus,7);assert.equal(check.advantage,true);
  c.expertise.push('Sleight of Hand');check=toolCheck(c,tools,{skill:'Sleight of Hand'});assert.equal(check.bonus,10);
  c.exhaustion=2;assert.equal(toolCheck(c,tools,{skill:'Sleight of Hand'}).bonus,6);
  const smith=addToolToInventory(c,'smiths-tools');assert.equal(toolCheck(c,smith).ability,'str');
  assert.equal(tools.qty,1);assert.equal(smith.qty,1);
  tools.qty=0;assert.throws(()=>toolCheck(c,tools),/Carry/);
});

test('armor training controls shield AC, untrained tests and casting without reducing armor base AC',()=>{
  const c=makeCharacter({class:'Wizard'});ensureTraining(c);
  c.items=['Chain Mail','Shield'].map(name=>({...itemFromEquipment(entry(name)),equipped:true}));
  assert.equal(armorClass(c),16);assert.equal(armorTrainingEffects(c).blocksCasting,true);
  assert.equal(armorCheckMode(c,'dex'),'disadvantage');assert.equal(armorCheckMode(c,'int'),'normal');
  assert.equal(armorCheckMode(c,'str',true),'normal');
  const a=attackFromWeapon(WEAPONS.find(w=>w.id==='longsword'),c);
  assert.equal(attackContext(c,a).mode,'disadvantage');
  c.training.armor=['Heavy','Shield'];assert.equal(armorClass(c),18);
  assert.equal(armorTrainingEffects(c).blocksCasting,false);
  assert.equal(armorCheckMode(c,'dex',false,false,'Stealth'),'disadvantage');
  c.training.armor=[];assert.equal(armorClass(c),16,'an explicitly empty selection never falls back to class defaults');
});

test('training backup validation rejects malformed and excessive selections',()=>{
  const c=makeCharacter();ensureTraining(c);
  for(const [key,value] of [['armor',['Light','Light']],['weapons',['laser']],['languages',['']],['tools',['banana']]]){
    const changed=structuredClone(c);changed.training[key]=value;assert.throws(()=>parseBackup(backup(changed)),/training selections/);
  }
});

test('Common Sign Language does not silently grant spoken Common',()=>{
  const c=makeCharacter({languages:'Common Sign Language; Deep Speech; Moon Speech (campaign)'});
  assert.deepEqual(trainingFor(c).languages,['Common Sign Language','Deep Speech','Moon Speech']);
});

test('Elven Chain retains its specific armor-training exception',()=>{
  const c=makeCharacter({class:'Wizard'});ensureTraining(c);
  c.items=[{...itemFromEquipment(entry('Elven Chain')),equipped:true}];
  assert.equal(armorTrainingEffects(c).blocksCasting,false);
  assert.equal(armorClass(c),17);
  assert.equal(armorCheckMode(c,'str'),'normal');
});
