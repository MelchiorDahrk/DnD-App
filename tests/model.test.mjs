import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_VERSION,RULES_URL,wikiURL,referenceURL,exhaustionPenalty,walkingSpeed,abilityCheckBonus,saveBonus,attackBonus,shortRest,COINS,SHEET_TEXT,initiative,passivePerception,rollFeature,validDiceFormula,demoCharacter,makeCharacter,parseBackup,rollDice,randomDie,mod,proficiency,skillBonus,changeHP,longRest,levelUp,safeURL,castingAbility} from '../model.js';
const demoState = () => {const c=demoCharacter();return {version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};};

test('ability, proficiency, expertise, and level boundaries',()=>{
  assert.equal(mod(9),-1);assert.equal(mod(18),4);assert.equal(proficiency(4),2);assert.equal(proficiency(5),3);assert.equal(proficiency(20),6);
  const c=demoCharacter();assert.equal(skillBonus(c,'Stealth'),6);c.expertise=['Stealth'];assert.equal(skillBonus(c,'Stealth'),8);
});
test('damage spends temporary HP before actual HP; healing caps and resets death saves',()=>{
  const c=demoCharacter();c.tempHp=7;changeHP(c,10,'damage');assert.equal(c.tempHp,0);assert.equal(c.hp,21);
  changeHP(c,99,'damage');assert.equal(c.hp,0);c.deathFailure=2;changeHP(c,4,'heal');assert.equal(c.hp,4);assert.equal(c.deathFailure,0);
  changeHP(c,999,'heal');assert.equal(c.hp,c.maxHp);changeHP(c,8,'temp');changeHP(c,3,'temp');assert.equal(c.tempHp,8);
});
test('2024 long rest recovers all hit dice, slots and rest resources, and one exhaustion level',()=>{
  const c=demoCharacter();c.hitDice=0;c.hp=1;c.tempHp=8;c.deathSuccess=2;c.conditions=['Poisoned'];c.concentration='Test';c.exhaustion=3;
  c.features=[{reset:'short',used:1},{reset:'long',used:2},{reset:'manual',used:2}];longRest(c);
  assert.equal(c.hp,28);assert.equal(c.hitDice,3);assert.equal(c.exhaustion,2);assert.equal(c.tempHp,0);assert.equal(c.slots[0].used,0);assert.equal(c.concentration,'');assert.equal(c.deathSuccess,0);assert.deepEqual(c.conditions,['Poisoned']);assert.deepEqual(c.features.map(f=>f.used),[0,0,2]);
});

test('rest recovery respects blocked exhaustion removal, minimum HP, and exhaustion floor',()=>{
  const c=demoCharacter();c.exhaustion=2;longRest(c,{reduceExhaustion:false});assert.equal(c.exhaustion,2);
  c.exhaustion=0;longRest(c);assert.equal(c.exhaustion,0);
  c.hp=0;c.hitDice=0;c.slots[0].used=1;const before=structuredClone(c);
  assert.throws(()=>longRest(c),/at least 1 HP/);assert.throws(()=>shortRest(c),/at least 1 HP/);assert.deepEqual(c,before);
});

test('2024 Second Wind regains one use on a short rest and all uses on a long rest',()=>{
  const c=makeCharacter({class:'Fighter',level:3,hitDice:3,maxHp:28,hp:10});
  c.features=[{name:'Second Wind',maxUses:2,used:2,reset:'long',shortRestRecovery:1},{reset:'short',used:4},{reset:'manual',used:2}];
  assert.equal(shortRest(c,1,()=>5),7);assert.equal(c.hp,17);assert.equal(c.hitDice,2);assert.deepEqual(c.features.map(f=>f.used),[1,0,2]);
  shortRest(c);assert.equal(c.features[0].used,0);shortRest(c);assert.equal(c.features[0].used,0);
  c.features[0].used=2;longRest(c);assert.equal(c.features[0].used,0);
  assert.throws(()=>shortRest(c,4),/available/);
});

test('2024 exhaustion applies to sheet D20 Tests and speed, preserving ability scores and damage',()=>{
  const c=demoCharacter(),before=structuredClone(c),a=c.attacks[0];c.exhaustion=2;
  assert.equal(exhaustionPenalty(c),4);assert.equal(abilityCheckBonus(c,'dex'),0);assert.equal(skillBonus(c,'Stealth'),2);
  assert.equal(saveBonus(c,'dex'),2);assert.equal(attackBonus(c,a),4);assert.equal(initiative(c),0);assert.equal(passivePerception(c),11);assert.equal(walkingSpeed(c),25);
  assert.deepEqual(c.stats,before.stats);assert.equal(a.damage,before.attacks[0].damage);
  assert.equal(8+proficiency(c.level)+mod(c.stats[castingAbility(c)]),13);
  c.exhaustion=6;c.speed=20;assert.equal(walkingSpeed(c),0);
});

test('2024 demo has current Ranger features, healing, mastery, and rest resources',()=>{
  const c=demoCharacter();assert.equal(c.background,'Soldier');
  assert.equal(c.features.some(f=>f.name==='Primeval Awareness'),false);
  const favored=c.features.find(f=>f.name==='Favored Enemy');assert.equal(favored.maxUses,2);assert.equal(favored.reset,'long');
  assert.ok(c.features.some(f=>f.name==='Weapon Mastery'));assert.ok(c.features.some(f=>f.name==='Hunter’s Lore'));
  assert.equal(c.spells.find(s=>s.name==='Cure Wounds').school,'Abjuration');assert.match(c.spells.find(s=>s.name==='Cure Wounds').notes,/2d8/);
  assert.equal(attackBonus(c,c.attacks[0]),8);assert.ok(c.expertise.includes('Survival'));
});

test('reference defaults use current rules and explicit links open without compatibility rewriting',()=>{
  assert.equal(wikiURL('Ranger'),RULES_URL+'/character-classes#Ranger');
  assert.equal(wikiURL('cure-wounds','spell'),'https://www.dndbeyond.com/spells/2619079-cure-wounds');
  assert.equal(referenceURL('','Ranger'),wikiURL('Ranger'));
  assert.equal(referenceURL('https://dnd5e.wikidot.com/ranger','Ranger'),'https://dnd5e.wikidot.com/ranger');
  assert.equal(referenceURL('https://dnd5e.wikidot.com/spell:cure-wounds','Cure Wounds','spell'),'https://dnd5e.wikidot.com/spell:cure-wounds');
  assert.equal(referenceURL('https://example.com/homebrew','Custom','spell'),'https://example.com/homebrew');
  assert.equal(referenceURL('https://dnd5e.wikidot.com/homebrew-custom','Custom','spell'),'https://dnd5e.wikidot.com/homebrew-custom');
  assert.equal(referenceURL('javascript:alert(1)','Custom','spell'),'');
});
test('level-up increases maximum and current HP without silently changing class choices or XP',()=>{
  const c=demoCharacter();levelUp(c,8);assert.equal(c.level,4);assert.equal(c.maxHp,36);assert.equal(c.hp,32);assert.equal(c.hitDice,4);assert.equal(c.xp,1450);assert.equal(c.slots[0].max,3);
  c.level=20;assert.throws(()=>levelUp(c,8),/level 20/);
});
test('dice expressions, modifiers, advantage, and invalid rolls',()=>{
  const rolls=[2,5];const r=rollDice(' 2d6 + 3 ','normal',()=>rolls.shift());assert.equal(r.total,10);assert.deepEqual(r.rolls,[2,5]);
  let values=[4,18];assert.equal(rollDice('d20-1','advantage',()=>values.shift()).total,17);
  values=[4,18];assert.equal(rollDice('1d20+3','disadvantage',()=>values.shift()).total,7);
  for(const expression of ['0d6','51d6','1d1','1d101','1d20;alert(1)','2d6+NaN'])assert.throws(()=>rollDice(expression));
  assert.throws(()=>rollDice('2d6','advantage'),/single|one d20/);
});
test('random die rejects biased tail values and includes both endpoints',()=>{
  let values=[4294967295,0];assert.equal(randomDie(6,a=>a[0]=values.shift()),1);assert.equal(randomDie(6,a=>a[0]=5),6);
});
test('backups round-trip every character collection and reject corrupt rules data',()=>{
  const state=demoState();assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  const other=makeCharacter({name:'Mira',class:'Wizard'});state.characters.push(other);assert.equal(parseBackup(JSON.stringify(state)).characters.length,2);
  const c=state.characters[0];c.slots[0].used=99;assert.throws(()=>parseBackup(JSON.stringify(state)),/spell slots/);c.slots[0].used=0;
  c.hp=-1;assert.throws(()=>parseBackup(JSON.stringify(state)),/hit points/);c.hp=1;
  c.notes[0].updated='not a date';assert.throws(()=>parseBackup(JSON.stringify(state)),/note/);
  assert.throws(()=>parseBackup('{broken'),/JSON/);assert.throws(()=>parseBackup('{"version":9}'),/only version 2/);
});
test('empty journals require no active character, populated journals require a matching one',()=>{
  const empty={version:SAVE_VERSION,characters:[],activeId:null,settings:{sound:true}};
  assert.deepEqual(parseBackup(JSON.stringify(empty)),empty);
  for(const activeId of ['missing','',undefined])assert.throws(()=>parseBackup(JSON.stringify({...empty,activeId})),/active character/);
  const populated=demoState();
  for(const activeId of [null,'missing',undefined])assert.throws(()=>parseBackup(JSON.stringify({...populated,activeId})),/active character/);
  assert.throws(()=>parseBackup(JSON.stringify({...empty,characters:Array(101).fill(populated.characters[0])})),/0–100/);
});

test('reference links reject script and data URLs',()=>{
  assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('data:text/html,hello'),'');assert.equal(safeURL('https://dnd5e.wikidot.com/ranger'),'https://dnd5e.wikidot.com/ranger');
});
test('imported IDs cannot inject HTML into action attributes',()=>{
  const state=demoState();state.characters[0].items[0].id='x" onclick="alert(1)';
  assert.throws(()=>parseBackup(JSON.stringify(state)),/IDs/);
});
test('subclass casting ability can override the class default',()=>{
  const c=makeCharacter({class:'Fighter'});c.spellAbility='int';assert.equal(castingAbility(c),'int');
  const wizard=makeCharacter({class:'Wizard'});assert.equal(castingAbility(wizard),'int');
});

test('paper-sheet details, all five coins, adjustments, and weapon notes survive export/import',()=>{
  const c=makeCharacter({name:'Melchior',playerName:'Eric',class:'Fighter',subclass:'Battle Master',level:3,hitDice:3,stats:{str:16,dex:10,con:12,int:8,wis:10,cha:7},maxHp:21,hp:21,ac:18,initiativeBonus:2,passivePerceptionBonus:2});
  c.personalityTraits='Looks for things to steal or hidden.';c.ideals='People — loyal to friends.';c.bonds='Wants to become the greatest thief!';c.flaws='An innocent person is in prison for a crime I committed.';
  c.languages='Common, Elvish';c.armorProficiencies='All armor and shields';c.weaponProficiencies='All weapons';c.toolProficiencies="Thieves’ tools";c.senses='Superior darkvision: 120 ft.';c.defenses='Chain mail: 16 AC; shield: +2 (18 total).';
  for(const key of Object.keys(COINS))c[key]=17;
  c.attacks=[{id:'longsword',name:'Longsword',ability:'str',bonus:0,proficient:true,damage:'1d8+3',type:'Slashing',range:'5 ft.',notes:'Two hands: 1d10+3.',rollMode:'normal'}];
  c.features=[{id:'superiority',name:'Superiority dice',description:'Feinting Attack, Riposte; record other maneuvers here.',maxUses:4,used:1,reset:'short',wiki:'',rollFormula:'1d8',shortRestRecovery:0}];
  const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
  assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  assert.equal(initiative(c),2);assert.equal(passivePerception(c),12);
  c.stats.dex=14;c.skills.push('Perception');assert.equal(initiative(c),4);assert.equal(passivePerception(c),14);
});

test('old save versions and incomplete current saves are rejected without migration',()=>{
  for(const version of [undefined,0,1,3,'2']) {
    const state=demoState();state.version=version;
    assert.throws(()=>parseBackup(JSON.stringify(state)),/only version 2/);
  }
  for(const key of [...Object.keys(SHEET_TEXT),'playerName','electrum','platinum','initiativeBonus','passivePerceptionBonus','spellAbility','initiativeAdvantage']) {
    const state=demoState();delete state.characters[0][key];
    assert.throws(()=>parseBackup(JSON.stringify(state)),/Invalid backup/);
  }
  for(const key of ['rollFormula','shortRestRecovery']) {
    const state=demoState();delete state.characters[0].features[0][key];
    assert.throws(()=>parseBackup(JSON.stringify(state)),/Invalid backup/);
  }
  const state=demoState();delete state.characters[0].attacks[0].notes;
  assert.throws(()=>parseBackup(JSON.stringify(state)),/attack notes/);
  const attackState=demoState();delete attackState.characters[0].attacks[0].rollMode;
  assert.throws(()=>parseBackup(JSON.stringify(attackState)),/attack roll mode/);
});

test('new fields reject corrupted backups instead of silently replacing them',()=>{
  for(const [key,value] of [['electrum',-1],['platinum',1.5],['initiativeBonus',100],['passivePerceptionBonus','2'],['senses',null],['playerName',{}],['bonds','x'.repeat(20001)]]) {
    const state=demoState();state.characters[0][key]=value;assert.throws(()=>parseBackup(JSON.stringify(state)),/Invalid backup/);
  }
  const state=demoState();state.characters[0].features[0].rollFormula='0d8';assert.throws(()=>parseBackup(JSON.stringify(state)),/feature/);
  const recovery=demoState();recovery.characters[0].features[0].shortRestRecovery=3;assert.throws(()=>parseBackup(JSON.stringify(recovery)),/short-rest recovery/);
});

test('feature dice spend exactly one use, stop when exhausted, and refresh on the chosen rest',()=>{
  const c=demoCharacter(),f={id:'resource',name:'Superiority dice',description:'',maxUses:4,used:0,reset:'short',wiki:'',rollFormula:'1d8',shortRestRecovery:0};
  c.features=[f];
  for(let i=1;i<=4;i++){assert.equal(rollFeature(f,()=>6).total,6);assert.equal(f.used,i);}
  assert.throws(()=>rollFeature(f,()=>6),/No uses/);assert.equal(f.used,4);
  longRest(c);assert.equal(f.used,0);
  f.rollFormula='invalid';assert.throws(()=>rollFeature(f));assert.equal(f.used,0);
  f.rollFormula='1d10+3';f.maxUses=1;assert.equal(rollFeature(f,()=>7).total,10);assert.equal(f.used,1);
  f.maxUses=0;f.used=0;assert.equal(rollFeature(f,()=>1).total,4);assert.equal(f.used,0);
  for(const expression of ['0d6','51d8','1d101','1d8;alert(1)'])assert.equal(validDiceFormula(expression),false);
});
