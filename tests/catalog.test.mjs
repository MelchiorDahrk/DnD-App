import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT,WEAPONS,ARMOR,EQUIPMENT_GROUPS,CLASS_OPTIONS,SPECIES,BACKGROUNDS,SUBCLASSES,ORIGIN_FEATS,findEquipment,itemFromEquipment,attackFromWeapon,applyStartingOptions} from '../catalog.js';
import {CLASSES,SAVE_VERSION,makeCharacter,parseBackup,rollDice,validDiceFormula} from '../model.js';
import {characterChoice} from '../catalog-ui.js';

test('basic catalog covers each equipment family with unique IDs and usable numeric weights',()=>{
  assert.equal(WEAPONS.length,38);assert.equal(ARMOR.length,13);
  assert.equal(new Set(EQUIPMENT.map(item=>item.id)).size,EQUIPMENT.length);
  for(const item of EQUIPMENT){
    assert.match(item.id,/^[a-z0-9-]+$/);assert.ok(Number.isFinite(item.weight)&&item.weight>=0);
    assert.match(item.cost,/^[\d,.]+ (CP|SP|GP)$/);assert.ok(item.details.length>0);assert.ok(item.wiki.startsWith('https://dnd2024.wikidot.com/'));
  }
  for(const group of ['Weapons','Armor & shields','Adventuring gear','Equipment packs','Tools','Musical instruments','Gaming sets','Ammunition','Spellcasting focuses','Tack & drawn vehicles','Mounts','Ships & airships'])assert.ok(EQUIPMENT_GROUPS.includes(group),group);
  for(const id of ['net','thieves-tools','spellbook','potion-of-healing','waterskin','explorers-pack','warhorse','rowboat'])assert.ok(findEquipment(id),id);
});

test('2024 equipment retains damage, mastery, armor, pack contents and bundle units',()=>{
  assert.equal(findEquipment('lance').damage,'1d10');assert.equal(findEquipment('dagger').mastery,'Nick');
  assert.equal(findEquipment('longsword').mastery,'Sap');assert.equal(findEquipment('pistol').damage,'1d10');
  assert.equal(findEquipment('plate-armor').ac,18);assert.equal(findEquipment('plate-armor').strength,15);assert.equal(findEquipment('plate-armor').stealth,true);
  assert.equal(findEquipment('shield').ac,2);assert.equal(findEquipment('thieves-tools').weight,1);
  assert.equal(findEquipment('arrows').weight,1);assert.match(findEquipment('arrows').details,/20 pieces per bundle/);
  assert.equal(findEquipment('explorers-pack').weight,55);assert.match(findEquipment('explorers-pack').details,/10 days of rations/);
  assert.equal(findEquipment('warhorse').carried,false);assert.match(itemFromEquipment(findEquipment('warhorse')).description,/Weight excluded/);
});

test('every equipment and weapon preset survives a current save without schema migration',()=>{
  const c=makeCharacter();c.items=EQUIPMENT.map(itemFromEquipment);
  c.attacks=WEAPONS.map(weapon=>({id:weapon.id,...attackFromWeapon(weapon,c)}));
  const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
  assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  assert.notEqual(itemFromEquipment(WEAPONS[0]).id,itemFromEquipment(WEAPONS[0]).id);
});

test('weapon presets use finesse, thrown, reach and fixed damage without inventing dice',()=>{
  const dex=makeCharacter({stats:{str:8,dex:18,con:10,int:10,wis:10,cha:10}});
  assert.equal(attackFromWeapon(findEquipment('dagger'),dex).ability,'dex');
  assert.equal(attackFromWeapon(findEquipment('javelin'),dex).ability,'str');
  assert.equal(attackFromWeapon(findEquipment('javelin'),dex).damage,'1d6-1');
  assert.equal(attackFromWeapon(findEquipment('javelin'),dex).range,'5 ft.; thrown 30/120 ft.');
  assert.equal(attackFromWeapon(findEquipment('whip'),dex).range,'10 ft.');
  assert.equal(attackFromWeapon(findEquipment('longbow'),dex).range,'150/600 ft.');
  const wizard=applyStartingOptions(makeCharacter({class:'Wizard'}));
  assert.equal(attackFromWeapon(findEquipment('rapier'),wizard).proficient,false);
  assert.equal(attackFromWeapon(findEquipment('dagger'),wizard).proficient,true);
  assert.equal(attackFromWeapon(findEquipment('greataxe'),wizard).rollMode,'disadvantage');
  const rogue=applyStartingOptions(makeCharacter({class:'Rogue'}));
  assert.equal(attackFromWeapon(findEquipment('rapier'),rogue).proficient,true);
  assert.equal(attackFromWeapon(findEquipment('longbow'),rogue).proficient,false);
  const blowgun=attackFromWeapon(findEquipment('blowgun'),dex);
  assert.equal(blowgun.damage,'5');assert.equal(validDiceFormula(blowgun.damage),true);
  assert.equal(rollDice(blowgun.damage,'normal',()=>assert.fail('Fixed damage must not roll dice')).total,5);
  assert.equal(rollDice('0').total,0);assert.throws(()=>rollDice('5','advantage'),/one d20/);
  for(const formula of ['-1','10000','1+2','1;alert(1)'])assert.equal(validDiceFormula(formula),false);
});

test('character choices cover core classes, all core species, backgrounds and matching subclasses',()=>{
  assert.deepEqual(CLASS_OPTIONS.map(option=>option.name),Object.keys(CLASSES));
  for(const name of ['Aasimar','Dragonborn','Dwarf','Elf','Gnome','Goliath','Halfling','Human','Orc','Tiefling'])assert.ok(SPECIES.some(option=>option.name===name));
  assert.equal(BACKGROUNDS.length,16);assert.equal(ORIGIN_FEATS.length,12);
  for(const cls of CLASS_OPTIONS){assert.equal(SUBCLASSES.filter(option=>option.className===cls.name).length,4);assert.equal(cls.saves.length,2);}
  for(const background of BACKGROUNDS)assert.ok(ORIGIN_FEATS.some(feat=>feat.name===background.feat));
});

test('new characters get selected class basics and species movement without changing scores or selecting feats',()=>{
  const c=makeCharacter({class:'Wizard',race:'Wood Elf',background:'Sage'}),scores=structuredClone(c.stats);
  applyStartingOptions(c);
  assert.equal(c.hitDie,6);assert.equal(c.maxHp,8);assert.equal(c.hp,8);assert.equal(c.ac,12);assert.equal(c.speed,35);
  assert.deepEqual(c.saves,['int','wis']);assert.equal(c.armorProficiencies,'None');assert.equal(c.weaponProficiencies,'Simple weapons');
  assert.equal(c.senses,'Darkvision 60 ft.');assert.deepEqual(c.stats,scores);assert.deepEqual(c.features,[]);
});

test('custom and older-book values stay selected, escaped, and editable',()=>{
  const markup=characterChoice('Background','background','Folk Hero <script>alert(1)</script>');
  assert.match(markup,/value="__questlog_custom__" selected/);assert.match(markup,/Folk Hero &lt;script&gt;/);assert.doesNotMatch(markup,/<script>/);
  assert.match(markup,/<input name="background" type="text"/);
  const known=characterChoice('Species / race','race','Wood Elf',{required:true});
  assert.match(known,/<option value="Wood Elf" selected/);assert.match(known,/35 ft\./);
});
