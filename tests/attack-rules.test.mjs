import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {WEAPONS,attackFromWeapon} from '../catalog.js';
import {defaultCharacters} from '../default-characters.js';
import {attackWeapon,attackMastery,attackContext,resolveRollMode,attackOutcome,damageFormula,rollAttackDamage,rerollAttackDie,toppleDC,attackDamageFeatures} from '../attack-rules.js';

const c=()=>makeCharacter({stats:{str:16,dex:10,con:14,int:10,wis:10,cha:10}});
const attack=(name,character=c())=>({id:name,...attackFromWeapon(WEAPONS.find(w=>w.name===name),character)});
const sequence=values=>()=>{assert.ok(values.length,'unexpected roll');return values.shift();};

test('mastery requires an explicit unlock or a previously recorded weapon choice',()=>{
  const character=c(),a=attack('Greataxe',character);
  assert.equal(attackMastery(character,a),'');
  const legacy={...a};delete legacy.mastery;delete legacy.weaponId;
  character.features=[{name:'Weapon Mastery',description:'Choose two weapons. Greataxe has Cleave.'}];
  assert.equal(attackMastery(character,legacy),'');
  character.features[0].description='Chosen: Greataxe (Cleave).';
  assert.equal(attackMastery(character,legacy),'Cleave');
  assert.equal(attackMastery(character,{...legacy,mastery:''}),'','explicit None overrides legacy choices');
  assert.equal(attackMastery(character,{...a,mastery:'Topple'}),'Topple','custom grants remain possible');
  assert.equal(attackWeapon({...legacy,name:'+1 Greataxe'}).id,'greataxe');
  assert.equal(attackWeapon({...legacy,name:'Greataxemancer spell'}),null);
  assert.equal(attackWeapon({...legacy,weaponId:''}),null);
});

test('default party legacy mastery selections work, without granting natural weapons or unchosen weapons mastery',()=>{
  const [fighter,barbarian,rogue]=defaultCharacters();
  assert.deepEqual(fighter.attacks.map(a=>attackMastery(fighter,a)),['Sap','Sap','Slow']);
  assert.deepEqual(barbarian.attacks.map(a=>attackMastery(barbarian,a)),['Cleave','Topple','','','']);
  assert.deepEqual(rogue.attacks.map(a=>attackMastery(rogue,a)),['Vex','Vex','']);
});

test('advantage sources do not stack and any disadvantage cancels all advantage',()=>{
  assert.equal(resolveRollMode(true,true),'normal');assert.equal(resolveRollMode(false,false),'normal');
  const character=c();character.conditions=['Poisoned','Prone'];
  const context=attackContext(character,{...attack('Longbow'),rollMode:'advantage'},{advantage:true,kind:'ranged',distance:200,closeEnemy:true});
  assert.equal(context.mode,'normal');assert.ok(context.disadvantages.length>=4);
  assert.equal(attackContext(character,attack('Longbow'),{override:true,advantage:true}).mode,'advantage');
  character.conditions=['Frightened'];
  const spear={...attack('Spear'),rollMode:'normal'};
  assert.equal(attackContext(character,spear,{fearVisible:false}).mode,'normal');
  assert.equal(attackContext(character,spear,{fearVisible:true}).mode,'disadvantage');
});

test('Heavy, thrown range, reach, cover, and incapacitation are checked separately from roll modifiers',()=>{
  const character=c();character.exhaustion=2;
  const bow=attack('Longbow',character);bow.rollMode='normal';
  assert.equal(attackContext(character,bow).mode,'disadvantage');
  assert.match(attackContext(character,bow,{kind:'ranged',distance:601}).blocked,/long range/);
  const spear=attack('Spear',character);
  assert.equal(attackContext(character,spear,{kind:'ranged',distance:30}).mode,'disadvantage');
  assert.match(attackContext(character,spear,{kind:'melee',distance:10}).blocked,/reach/);
  assert.equal(attackContext(character,attack('Whip'),{distance:10}).blocked,'');
  assert.equal(attackContext(character,spear,{cover:'half'}).coverBonus,2);
  assert.equal(attackContext(character,spear,{cover:'three-quarters'}).coverBonus,5);
  assert.match(attackContext(character,spear,{cover:'total'}).blocked,/Total cover/);
  character.conditions=['Stunned'];assert.match(attackContext(character,spear).blocked,/cannot make attacks/);
  assert.equal(toppleDC(character,spear),13,'Exhaustion does not reduce mastery DC');
  assert.equal(attackContext(character,spear).bonus,1,'Exhaustion does reduce attack bonus');
});

test('natural 1 and 20 override AC; normal attacks must meet cover-adjusted AC',()=>{
  assert.equal(attackOutcome({natural:1,total:40},1),'miss');
  assert.equal(attackOutcome({natural:20,total:0},99),'critical');
  assert.equal(attackOutcome({natural:12,total:17},15,2),'hit');
  assert.equal(attackOutcome({natural:12,total:17},15,5),'miss');
  assert.equal(attackOutcome({natural:12,total:17},''),null);
});

test('Cleave and Light damage remove only positive ability damage, retaining magic bonuses and negative modifiers',()=>{
  const character=c(),axe={...attack('Battleaxe',character),damage:'1d8+4'};
  assert.equal(damageFormula(character,axe,{omitAbility:true}),'1d8+1');
  assert.equal(damageFormula(character,axe,{omitAbility:true,keepAbility:true}),'1d8+4');
  assert.equal(damageFormula(character,axe,{twoHanded:true,omitAbility:true}),'1d10+1');
  character.stats.str=8;axe.damage='1d8-1';
  assert.equal(damageFormula(character,axe,{omitAbility:true}),'1d8-1');
});

test('critical damage doubles all dice but never fixed bonuses, and supports the maximum saved dice pool',()=>{
  const result=rollAttackDamage('1d8+4',true,sequence([3,7]));
  assert.equal(result.expression,'2d8+4');assert.equal(result.total,14);assert.deepEqual(result.rolls,[3,7]);
  assert.equal(rollAttackDamage('2d6',true,()=>3).total,12,'Sneak Attack dice double too');
  assert.equal(rollAttackDamage('5',true,()=>assert.fail('fixed damage rolls no dice')).total,5);
  assert.equal(rollAttackDamage('50d6+3',true,()=>1).total,103);
  assert.equal(rollAttackDamage('1d4-5',false,()=>1).total,0,'damage cannot become healing');
  assert.equal(rollAttackDamage('1d20',false,()=>20).natural,null,'a damage d20 is not an attack roll');
});

test('Heroic Inspiration replaces just the chosen die and recalculates kept die and critical status',()=>{
  const base={rolls:[20,3],mode:'advantage',bonus:5,natural:20,total:25};
  assert.deepEqual(rerollAttackDie(base,0,()=>1).rolls,[1,3]);
  assert.equal(rerollAttackDie(base,0,()=>1).total,8);
  assert.equal(rerollAttackDie({...base,mode:'disadvantage'},1,()=>20).natural,20);
  assert.deepEqual(base.rolls,[20,3],'the previous history result stays intact');
  assert.throws(()=>rerollAttackDie(base,2),/Choose one/);
});

test('extra damage candidates respect Sneak Attack weapon eligibility',()=>{
  const character=c();character.features=[{name:'Sneak Attack',rollFormula:'2d6'},{name:'Superiority Dice',rollFormula:'1d8'},{name:'Second Wind',rollFormula:'1d10+3'}];
  assert.deepEqual(attackDamageFeatures(character,attack('Longsword')).map(f=>f.name),['Superiority Dice']);
  assert.deepEqual(attackDamageFeatures(character,attack('Dagger')).map(f=>f.name),['Sneak Attack','Superiority Dice']);
});

test('new fields round-trip and invalid fields are rejected without requiring migration of old attacks',()=>{
  const character=c();character.attacks=[{...attack('Greataxe'),mastery:'Cleave'}];
  const state={version:SAVE_VERSION,characters:[character],activeId:character.id,settings:{sound:false}};
  assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  const legacy=structuredClone(state);delete legacy.characters[0].attacks[0].mastery;delete legacy.characters[0].attacks[0].weaponId;
  assert.deepEqual(parseBackup(JSON.stringify(legacy)),legacy);
  for(const [key,value] of [['mastery','Explode'],['weaponId','<script>']]){
    const invalid=structuredClone(state);invalid.characters[0].attacks[0][key]=value;
    assert.throws(()=>parseBackup(JSON.stringify(invalid)),/invalid attack/);
  }
});
