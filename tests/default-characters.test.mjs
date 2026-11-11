import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCharacters,initialState} from '../default-characters.js';
import {SAVE_VERSION,STORAGE_KEY,attackBonus,initiative,passivePerception,skillBonus,shortRest,longRest,parseBackup} from '../model.js';

test('fresh saves contain the three photographed characters and round-trip without changes',()=>{
  const state=initialState();
  assert.equal(SAVE_VERSION,2);assert.equal(STORAGE_KEY,'questlog.v2');
  assert.deepEqual(state.characters.map(c=>[c.name,c.playerName,c.class,c.level,c.maxHp]),[
    ['Melchior','Eric','Fighter',3,21],['Balin','Rob','Barbarian',3,35],['Teyla','Jen','Rogue',3,24]
  ]);
  assert.equal(state.activeId,state.characters[0].id);
  assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  const second=initialState();assert.notEqual(state.activeId,second.activeId);
  state.characters[0].items[0].qty=0;assert.equal(second.characters[0].items[0].qty,1);
  assert.ok(state.characters.every(c=>c.notes.some(n=>n.pinned&&n.body.includes('IMG_'))));
});

test('paper inventories, personality and every coin denomination are retained',()=>{
  const party=defaultCharacters();
  assert.deepEqual(party.map(c=>[c.copper,c.silver,c.electrum,c.gold,c.platinum]),[[175,301,100,373,7],[100,140,40,90,14],[80,271,70,338,5]]);
  for(const c of party)for(const key of ['personalityTraits','ideals','bonds','flaws'])assert.ok(c[key]);
  for(const [c,name,qty] of [[party[0],'Arrows',40],[party[0],'Healer’s kit',9],[party[1],'Javelins',4],[party[1],'Handaxes',2],[party[2],'Arrows',25],[party[2],'Blowgun needles',100],[party[2],'Healer’s kit',8]])assert.equal(c.items.find(i=>i.name===name).qty,qty);
  assert.ok(party[0].items.some(i=>i.name==='Quaal’s feather token'));
  assert.ok(party[2].items.some(i=>i.name==='Sovereign glue'));
});

test('Melchior uses 2024 Fighter and Battle Master mechanics with the original origins',()=>{
  const [c]=defaultCharacters();
  assert.equal(c.race,'Drow');assert.equal(c.background,'Criminal (Fence)');
  assert.equal(c.ac,18);assert.equal(initiative(c),2);assert.equal(passivePerception(c),12);assert.equal(c.passivePerceptionBonus,0);
  assert.deepEqual(c.attacks.map(a=>attackBonus(c,a)),[5,5,4]);
  assert.equal(c.attacks[2].damage,'1d8');assert.equal(c.attacks[2].rollMode,'disadvantage');
  assert.ok(!c.features.some(f=>f.name==='Know Your Enemy'));
  for(const name of ['Tactical Mind','Student of War','Weapon Mastery','Trip Attack','Alert (Origin feat)','Sunlight Sensitivity'])assert.ok(c.features.some(f=>f.name===name));
  const wind=c.features.find(f=>f.name==='Second Wind'),dice=c.features.find(f=>f.name==='Superiority dice');
  assert.deepEqual([wind.maxUses,wind.reset,wind.shortRestRecovery,wind.rollFormula],[2,'long',1,'1d10+3']);
  wind.used=2;dice.used=4;shortRest(c);assert.equal(wind.used,1);assert.equal(dice.used,0);longRest(c);assert.equal(wind.used,0);
  assert.equal(c.spells.find(s=>s.name==='Dancing Lights').school,'Illusion');
  assert.ok(c.spells.some(s=>s.name==='Faerie Fire'));
});

test('Balin retains Hill Dwarf, Guild Artisan and Beast with the 2024 Barbarian',()=>{
  const [,c]=defaultCharacters();
  assert.equal(c.race,'Hill Dwarf');assert.equal(c.background,'Guild Artisan');assert.equal(c.subclass,'Path of the Beast');
  assert.equal(c.speed,25);assert.equal(c.ac,16);assert.equal(passivePerception(c),9);assert.equal(c.passivePerceptionBonus,0);
  const rage=c.features.find(f=>f.name==='Rage');assert.deepEqual([rage.maxUses,rage.reset,rage.shortRestRecovery],[3,'long',1]);
  rage.used=3;shortRest(c);assert.equal(rage.used,2);longRest(c);assert.equal(rage.used,0);
  assert.match(c.features.find(f=>f.name==='Danger Sense').description,/saving throws/);
  assert.ok(c.features.some(f=>f.name==='Primal Knowledge'));
  assert.deepEqual(c.attacks.filter(a=>a.name.startsWith('Beast:')).map(a=>[attackBonus(c,a),a.damage]),[[5,'1d8+3'],[5,'1d6+3'],[5,'1d8+3']]);
  assert.ok(!c.features.some(f=>f.name==='Relentless Endurance'));
  assert.match(c.notes[0].body,/Relentless Endurance/);assert.match(c.notes[0].body,/Healing Surge/);
});

test('Teyla is the requested Wood Elf Folk Hero using 2024 Rogue and Assassin features',()=>{
  const [,,c]=defaultCharacters();
  assert.equal(c.race,'Wood Elf');assert.equal(c.background,'Folk Hero (Insurrectionist)');assert.equal(c.subclass,'Assassin');
  assert.equal(c.speed,35);assert.equal(c.ac,17);assert.equal(c.initiativeAdvantage,true);assert.equal(initiative(c),5);
  assert.equal(passivePerception(c),11);assert.equal(c.passivePerceptionBonus,0);
  assert.equal(skillBonus(c,'Athletics'),5);assert.equal(skillBonus(c,'Stealth'),9);
  assert.equal(skillBonus(c,'Animal Handling'),1);assert.equal(skillBonus(c,'Survival'),1);
  assert.deepEqual(c.attacks.map(a=>attackBonus(c,a)),[7,7,1]);
  const sword=c.attacks.find(a=>a.name==='Longsword');assert.equal(sword.ability,'str');assert.equal(sword.proficient,false);assert.equal(sword.damage,'1d8+1');
  assert.match(c.features.find(f=>f.name==='Assassinate').description,/adds 3 damage/);
  assert.equal(c.features.find(f=>f.name==='Lucky (Origin feat)').maxUses,2);
  assert.ok(c.spells.some(s=>s.name==='Druidcraft'));assert.ok(c.spells.some(s=>s.name==='Longstrider'));
  assert.ok(c.items.some(i=>i.name==='Disguise kit'));assert.ok(c.items.some(i=>i.name==='Poisoner’s kit'));
});
