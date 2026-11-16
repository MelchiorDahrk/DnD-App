import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {WEAPONS,attackFromWeapon} from '../catalog.js';
import {defaultCharacters} from '../default-characters.js';
import {attackWeapon,attackMastery,attackContext,attackModeSummary,resolveRollMode,attackOutcome,damageFormula,rollAttackDamage,rerollAttackDie,toppleDC,attackDamageFeatures} from '../attack-rules.js';

const c=()=>makeCharacter({stats:{str:16,dex:10,con:14,int:10,wis:10,cha:10}});
// Isolate live rules from the catalog's optional prefilled saved roll mode.
const attack=(name,character=c())=>({id:name,...attackFromWeapon(WEAPONS.find(w=>w.name===name),character),rollMode:'normal'});
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
  assert.equal(attackContext(character,attack('Longbow'),{override:true,advantage:true}).mode,'normal','retired blanket override cannot bypass rules');
  character.conditions=['Frightened'];
  const spear={...attack('Spear'),rollMode:'normal'};
  assert.equal(attackContext(character,spear,{fearVisible:false}).mode,'normal');
  assert.equal(attackContext(character,spear,{fearVisible:true}).mode,'disadvantage');
});

test('multiple advantage sources cancel one disadvantage, and the reverse also cancels',()=>{
  const character=c(),a={...attack('Rapier'),rollMode:'advantage'};
  character.conditions=['Poisoned'];
  const context=attackContext(character,a,{advantage:true});
  assert.equal(context.advantages.length,2);assert.equal(context.disadvantages.length,1);
  assert.equal(context.mode,'normal');
  assert.equal(attackModeSummary(context),'Normal: Advantage and disadvantage cancel');
  character.conditions.push('Prone','Restrained');
  const reverse=attackContext(character,{...a,rollMode:'normal'},{advantage:true});
  assert.equal(reverse.advantages.length,1);assert.equal(reverse.disadvantages.length,3);
  assert.equal(reverse.mode,'normal');
});

test('source overrides affect only their source and never the situational selections',()=>{
  const character=c(),a={...attack('Longbow'),rollMode:'advantage'};
  character.conditions=['Poisoned','Prone'];
  const options={kind:'ranged',distance:200,closeEnemy:true,advantage:true,disadvantage:true,disabledSources:['condition-poisoned','long-range']};
  const context=attackContext(character,a,options);
  assert.deepEqual(context.disadvantages,['Heavy: ability score below 13','Prone','Enemy within 5 ft.','Situational disadvantage']);
  assert.deepEqual(context.advantages,['Saved attack mode','Situational advantage']);
  assert.equal(context.mode,'normal');
  assert.equal(context.sources.find(s=>s.id==='condition-poisoned').enabled,false);
  const automaticIds=context.sources.map(s=>s.id);
  const allOff=attackContext(character,a,{...options,disabledSources:automaticIds});
  assert.deepEqual(allOff.advantages,['Situational advantage']);
  assert.deepEqual(allOff.disadvantages,['Situational disadvantage']);
  assert.equal(attackContext(character,a,{...options,disabledSources:automaticIds,disadvantage:false}).mode,'advantage');
  assert.equal(attackContext(character,a,{...options,disabledSources:automaticIds,advantage:false}).mode,'disadvantage');
  assert.equal(attackModeSummary(attackContext(character,a,{...options,disabledSources:automaticIds,advantage:false,disadvantage:false})),'Normal: automatic sources disabled');
  assert.deepEqual(attackContext(character,a,{...options,disabledSources:[]}),attackContext(character,a,{...options,disabledSources:undefined}),'clearing overrides restores defaults');
  assert.deepEqual(options.disabledSources,['condition-poisoned','long-range'],'context does not mutate options');
});

test('inactive sources and stale override IDs never create modifiers or bypass blockers',()=>{
  const character=c();character.stats.dex=14;
  const a={...attack('Spear'),rollMode:'normal'},options={kind:'melee',distance:5,closeEnemy:true,fearVisible:true,disabledSources:['long-range','made-up','condition-poisoned']};
  assert.deepEqual(attackContext(character,a,options).sources,[]);
  assert.equal(attackModeSummary(attackContext(character,a,options)),'');
  assert.equal(attackContext(character,attack('Longbow'),{distance:150}).sources.length,0);
  assert.deepEqual(attackContext(character,{...attack('Rapier'),rollMode:'disadvantage'},{disabledSources:['saved-mode']}).disadvantages,[]);
  const off={kind:'ranged',disabledSources:['long-range','nearby-enemy','heavy']};
  assert.match(attackContext(character,attack('Longbow'),{...off,distance:601}).blocked,/long range/);
  assert.match(attackContext(character,a,{...off,cover:'total'}).blocked,/Total cover/);
  character.conditions=['Unconscious'];assert.match(attackContext(character,a,off).blocked,/cannot make attacks/);
});

test('each tracked condition and Heavy can be overridden independently',()=>{
  const character=c(),a={...attack('Longbow'),rollMode:'advantage'};
  character.conditions=['Blinded','Poisoned','Prone','Restrained','Frightened'];
  const options={fearVisible:true,closeEnemy:true,distance:200};
  const baseline=attackContext(character,a,options);
  for(const source of baseline.sources){
    const context=attackContext(character,a,{...options,disabledSources:[source.id]});
    assert.deepEqual(context.sources.filter(s=>s.enabled).map(s=>s.id),baseline.sources.filter(s=>s.id!==source.id).map(s=>s.id),source.id);
    assert.equal(context.mode,source.id==='saved-mode'?'disadvantage':'normal');
  }
  assert.equal(attackContext(character,a,{...options,fearVisible:false}).sources.some(s=>s.id==='condition-frightened'),false);
});

test('2024 Sharpshooter removes long-range and nearby-enemy penalties only for Ranged weapons',()=>{
  const character=c();character.features=[{name:'Sharpshooter'}];
  const bow=attackContext(character,attack('Longbow'),{distance:200,closeEnemy:true});
  assert.deepEqual(bow.disadvantages,['Heavy: ability score below 13'],'unrelated Heavy penalty remains');
  assert.deepEqual(bow.ignoredSources.map(s=>s.id),['nearby-enemy','long-range']);
  assert.equal(bow.sources.some(s=>['nearby-enemy','long-range'].includes(s.id)),false,'negated rules have no override controls');
  assert.equal(bow.closeEnemyRelevant,false);
  assert.match(attackContext(character,attack('Longbow'),{distance:601}).blocked,/long range/);
  assert.deepEqual(attackContext(character,attack('Dagger'),{kind:'ranged',distance:30,closeEnemy:true}).disadvantages,['Enemy within 5 ft.','Long range'],'a thrown melee weapon is not a Ranged weapon');
  assert.equal(attackContext(character,attack('Dart'),{kind:'ranged',distance:30}).mode,'normal','a thrown Ranged weapon qualifies');
  const custom={...attack('Longbow'),weaponId:'',name:'Custom ray'};
  assert.deepEqual(attackContext(character,custom,{kind:'ranged',distance:200,closeEnemy:true}).disadvantages,['Enemy within 5 ft.','Long range']);
});

test('2024 Crossbow Expert removes close-combat disadvantage only with crossbows',()=>{
  const character=c();character.stats.dex=14;character.features=[{name:'Crossbow Expert'}];
  for(const name of ['Hand Crossbow','Light Crossbow','Heavy Crossbow']){
    const context=attackContext(character,attack(name),{closeEnemy:true});
    assert.equal(context.mode,'normal',name);
    assert.equal(context.sources.length,0);assert.equal(context.ignoredSources[0].feature,'Crossbow Expert');
    assert.equal(context.warnings.some(w=>w.startsWith('Loading:')),false);
  }
  assert.deepEqual(attackContext(character,attack('Hand Crossbow'),{distance:40,closeEnemy:true}).disadvantages,['Long range']);
  character.conditions=['Poisoned'];
  assert.deepEqual(attackContext(character,attack('Hand Crossbow'),{closeEnemy:true}).disadvantages,['Poisoned']);
  for(const name of ['Longbow','Blowgun','Pistol','Dagger']){
    assert.ok(attackContext(character,attack(name),{kind:'ranged',closeEnemy:true}).disadvantages.includes('Enemy within 5 ft.'),name);
  }
});

test('features must actually be recorded; exact legacy names and current catalog references work',()=>{
  const character=c();character.stats.dex=14;character.class='Fighter';character.level=20;
  const a=attack('Longbow'),options={distance:200};
  for(const feature of [null,{name:'Improved Sharpshooter'},{name:'Custom feature',description:'Sharpshooter'},{name:'Sharpshooter',catalogId:'earlier-feats-feat-sharpshooter'},{name:'Sharpshooter (2014)'},{name:'Sharpshooter',wiki:'https://dnd5e.wikidot.com/feat:sharpshooter'}]){
    character.features=feature?[feature]:[];
    assert.equal(attackContext(character,a,options).mode,'disadvantage',JSON.stringify(feature));
  }
  for(const feature of [{name:'Sharpshooter'},{name:' sharpshooter (Feat)'},{name:'Sharpshooter (2024)'},{name:'Renamed feat',catalogId:'general-feats-feat-sharpshooter'}]){
    character.features=[feature];assert.equal(attackContext(character,a,options).mode,'normal',JSON.stringify(feature));
  }
});

test('conditional features require confirmation and cannot negate unrelated penalties',()=>{
  const character=c();character.stats.dex=14;
  character.features=['Reckless Attack','Steady Aim','Assassinate','Precise Hunter','Innate Sorcery','Mounted Combatant','Gunner'].map(name=>({name}));
  assert.equal(attackContext(character,attack('Rapier')).mode,'normal','possession does not activate conditional advantage');
  assert.equal(attackContext(character,attack('Longbow'),{closeEnemy:true}).mode,'disadvantage','2014 Gunner is not a 2024 exception');
  const ray={...attack('Longbow'),weaponId:'',name:'Custom spell',range:'120 ft.'};
  character.features=[{name:'Spell Sniper'}];
  assert.equal(attackContext(character,ray,{kind:'ranged',closeEnemy:true}).mode,'disadvantage','a custom attack is not assumed to be a spell');
  const confirmed=attackContext(character,ray,{kind:'ranged',closeEnemy:true,spellAttack:true});
  assert.equal(confirmed.mode,'normal');assert.equal(confirmed.ignoredSources[0].feature,'Spell Sniper');
  assert.equal(confirmed.featureConfirmations[0].id,'spellAttack');
  assert.equal(attackContext(character,attack('Longbow'),{closeEnemy:true,spellAttack:true}).mode,'disadvantage','confirmation cannot turn a known weapon into a spell');
  character.conditions=['Poisoned'];
  assert.deepEqual(attackContext(character,ray,{kind:'ranged',closeEnemy:true,spellAttack:true}).disadvantages,['Poisoned']);
  assert.equal(attackContext(character,ray,{kind:'melee',spellAttack:true}).featureConfirmations.length,0);
  character.features=[];assert.equal(attackContext(character,ray,{kind:'ranged',closeEnemy:true,spellAttack:true}).mode,'disadvantage');
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
  const oldCharacter=legacy.characters[0];
  oldCharacter.features=[{...defaultCharacters()[0].features[0],name:'Sharpshooter'}];
  oldCharacter.stats.dex=14;
  oldCharacter.attacks=[{...attack('Longbow',oldCharacter),name:'+1 Longbow'}];
  delete oldCharacter.attacks[0].weaponId;delete oldCharacter.attacks[0].mastery;
  const oldSave=JSON.stringify(legacy),loaded=parseBackup(oldSave);
  assert.equal(attackContext(loaded.characters[0],loaded.characters[0].attacks[0],{distance:200}).mode,'normal','legacy named feat and weapon work after import');
  attackContext(loaded.characters[0],loaded.characters[0].attacks[0],{disabledSources:['saved-mode','condition-poisoned']});
  assert.equal(JSON.stringify(loaded),oldSave,'calculations and overrides never migrate or rewrite existing saves');
  for(const [key,value] of [['mastery','Explode'],['weaponId','<script>']]){
    const invalid=structuredClone(state);invalid.characters[0].attacks[0][key]=value;
    assert.throws(()=>parseBackup(JSON.stringify(invalid)),/invalid attack/);
  }
});
