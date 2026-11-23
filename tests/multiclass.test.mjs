import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,parseBackup,SAVE_VERSION,XP,proficiency,shortRest,longRest} from '../model.js';
import {characterClasses,characterClassLevel,classBreakdown,hitDicePools,reconcileHitDice} from '../character-classes.js';
import {applyLevelUp,levelUpPlan,classSpellState,grantedSpell,readySpellClasses,spellCastingStats,spellKey} from '../level-up.js';
import {spellSlotPlan,arcaneRecoveryPlan,flexibleCastingOptions,syncSpellSlots} from '../spell-slots.js';
import {featureFields,FEATURE_CATALOG,filterFeatures} from '../feature-catalog.js';
import {trainingFor,trainingKey} from '../training-rules.js';
import {restRefreshes,restReminders} from '../rest-rules.js';
import {attacksPerAction} from '../attack-rules.js';
import {armorClass} from '../armor-class.js';
import {applyFields,applyLive,CloudConflict,joinCharacter,makeOperation,publicProjection,splitCharacter} from '../cloud-model.js';

const stats={str:16,dex:14,con:14,int:16,wis:14,cha:18};
const build=(className,values={})=>makeCharacter({class:className,stats:{...stats},skills:['Athletics','Perception','Arcana'],...values});
const roundTrip=c=>parseBackup(JSON.stringify({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}})).characters[0];
const byClass=(name,level,subclass='')=>({class:name,level,subclass});

function choicesFor(c,selection={}){
  const result={hpGain:4,choices:{},...selection};
  for(let pass=0;pass<4;pass++){
    for(const choice of levelUpPlan(c,result).choices){
      if(result.choices[choice.id])continue;
      if(choice.id==='feat'){
        result.choices.feat=[choice.options.find(option=>option.label==='Ability Score Improvement').id];
        result.abilities={con:2};
      }else result.choices[choice.id]=choice.options.slice(0,choice.count).map(option=>option.id);
    }
  }
  return result;
}

function startingSpells(c,className,{cantrip,spell,choices}={}){
  const selection=choicesFor(c,{className,...(choices?{choices}:{})});
  const p=levelUpPlan(c,selection);
  const options=level=>p.available.filter(row=>(row.level===0)===level&&!grantedSpell(p,row.id));
  const picks=(rows,count,preferred)=>[...new Set([preferred,...rows.map(row=>row.id)].filter(Boolean))].slice(0,count);
  const spells=picks(options(false),p.spellGain,spell);
  selection.spellIds=[...picks(options(true),p.cantripGain,cantrip),...spells];
  if(className==='Wizard')selection.prepareNewIds=spells.slice(0,p.after.prepared);
  return selection;
}

test('Fighter/Rogue uses the existing guided progression for a new, secondary, and third class',()=>{
  const c=build('Fighter',{level:5,subclass:'Champion',hitDice:4,xp:XP[6],saves:['str','con'],gold:80});
  const original=structuredClone(c);
  const selection=choicesFor(c,{className:'Rogue',choices:{classSkills:['Stealth'],expertise:['Stealth','Perception'],rogueLanguage:['Gnomish']}});
  const preview=levelUpPlan(c,selection);
  assert.deepEqual(c,original);
  assert.equal(classBreakdown(preview.character),'Fighter 5 / Rogue 1');
  assert.equal(preview.classLevel,1);
  assert.equal(preview.hitDie,8);
  applyLevelUp(c,selection);
  assert.equal(c.level,6);
  assert.equal(c.maxHp,original.maxHp+4);
  assert.equal(c.xp,original.xp);
  assert.equal(proficiency(c.level),3);
  assert.deepEqual(c.items,original.items);
  assert.equal(c.gold,80);
  assert.deepEqual(c.saves,original.saves);
  assert.deepEqual(c.expertise,['Stealth','Perception']);
  assert.deepEqual(trainingFor(c).languages,['Thieves’ Cant','Gnomish']);
  assert.ok(trainingFor(c).tools.includes(trainingKey('Thieves’ Tools')));
  assert.equal(c.features.find(f=>f.name==='Sneak Attack').rollFormula,'1d6');

  applyLevelUp(c,choicesFor(c,{className:'Rogue'}));
  assert.equal(classBreakdown(c),'Fighter 5 / Rogue 2');
  assert.ok(c.features.some(f=>f.name==='Cunning Action'));
  assert.ok(!c.features.some(f=>f.name==='Tactical Mind'));
  applyLevelUp(c,choicesFor(c,{className:'Monk'}));
  assert.deepEqual(characterClasses(c),[byClass('Fighter',5,'Champion'),byClass('Rogue',2),byClass('Monk',1)]);
  assert.deepEqual(hitDicePools(c),[{die:10,max:5,available:4},{die:8,max:3,available:3}]);
  assert.deepEqual(roundTrip(c),c);
});

test('prerequisites, HP, selections, and subclass validation leave the source sheet unchanged',()=>{
  const c=build('Fighter',{level:5,subclass:'Champion',stats:{...stats,str:12,dex:13,int:12}});
  const before=structuredClone(c);
  assert.throws(()=>applyLevelUp(c,{className:'Wizard',hpGain:6}),/Wizard requires Intelligence 13/);
  assert.throws(()=>applyLevelUp(c,{className:'Ranger',hpGain:8,subclass:'Hunter'}),/class level 3/);
  assert.throws(()=>applyLevelUp(c,{...choicesFor(c,{className:'Rogue'}),hpGain:11}),/Hit Die/);
  assert.throws(()=>applyLevelUp(c,{className:'Rogue',hpGain:7}),/skill proficiency/);
  assert.deepEqual(c,before);
  const existing=build('Fighter',{level:7,subclass:'Champion',stats:{...stats,dex:12},multiclass:[byClass('Rogue',2)]});
  assert.throws(()=>levelUpPlan(existing,{className:'Wizard'}),/Rogue requires Dexterity 13/);
  assert.doesNotThrow(()=>levelUpPlan(existing,{className:'Rogue'}));
  assert.throws(()=>applyLevelUp(existing,{className:'Rogue',subclass:'Life Domain',hpGain:5}),/subclass.*class/);
  assert.throws(()=>applyLevelUp(existing,{className:'Rogue',hpGain:5}),/Choose a subclass/);
});

test('limited first-level training and feature-granted training apply independently',()=>{
  const c=build('Wizard',{saves:['int','wis'],armorProficiencies:'Custom battle robes',weaponProficiencies:'Dagger',toolProficiencies:'Calligrapher’s Supplies'});
  applyLevelUp(c,startingSpells(c,'Cleric',{choices:{order:['Protector']}}));
  assert.deepEqual(trainingFor(c).armor.sort(),['Heavy','Light','Medium','Shield']);
  assert.ok(trainingFor(c).weapons.includes('longsword'));
  assert.ok(!trainingFor(c).weapons.includes('club'));
  assert.deepEqual(c.saves,['int','wis']);
  assert.match(c.armorProficiencies,/Custom battle robes/);
  assert.ok(c.features.some(f=>f.name==='Divine Order'&&f.description.startsWith('Protector')));
  const other=build('Wizard',{saves:['int','wis']});
  applyLevelUp(other,choicesFor(other,{className:'Fighter'}));
  assert.deepEqual(trainingFor(other).armor,['Light','Medium','Shield']);
  assert.ok(!other.saves.includes('con'));
  assert.equal(other.features.find(f=>f.name==='Second Wind').rollFormula,'1d10+1');
  assert.ok(other.features.some(f=>f.name.startsWith('Fighting Style:')));
});

test('mixed Hit Dice preserve legacy expenditure, validate limits, and recover by size',()=>{
  const c=build('Fighter',{level:5,subclass:'Champion',multiclass:[byClass('Wizard',2)],hitDice:3,hp:10,maxHp:50});
  const legacy=roundTrip(c);
  assert.equal(legacy.hitDicePools,undefined);
  assert.deepEqual(hitDicePools(legacy),[{die:10,max:3,available:1},{die:6,max:2,available:2}]);
  const before=structuredClone(legacy);
  assert.throws(()=>shortRest(legacy,{10:2,6:1}),/available/);
  assert.deepEqual(legacy,before);
  const sides=[];
  assert.equal(shortRest(legacy,{10:1,6:1},die=>{sides.push(die);return die;}),20);
  assert.deepEqual(sides,[10,6]);
  assert.deepEqual(legacy.hitDicePools,{10:0,6:1});
  assert.deepEqual(roundTrip(legacy),legacy);
  assert.throws(()=>roundTrip({...legacy,hitDicePools:{6:1,10:4}}),/Hit Dice pools/);
  assert.throws(()=>roundTrip({...legacy,hitDicePools:{6:2,10:0}}),/Hit Dice pools/);
  const preview=restRefreshes(legacy).filter(row=>row.key.startsWith('hit-dice'));
  assert.deepEqual(preview.map(row=>[row.before,row.after]),[[0,3],[1,2]]);
  longRest(legacy);
  assert.deepEqual(legacy.hitDicePools,{10:3,6:2});
  assert.equal(legacy.hp,50);
});

test('class levels control subclasses, feats and resource scaling while total level controls proficiency',()=>{
  const c=build('Fighter',{level:7,subclass:'Champion',multiclass:[byClass('Rogue',2)],hitDice:7});
  const sneak=FEATURE_CATALOG.find(entry=>entry.className==='Rogue'&&entry.name==='Sneak Attack');
  c.features.push({id:'sneak',used:0,catalogId:sneak.id,...featureFields(sneak,c)});
  assert.equal(c.features[0].rollFormula,'1d6');
  const rogue3=choicesFor(c,{className:'Rogue',subclass:'Thief'});
  assert.equal(levelUpPlan(c,rogue3).choices.some(choice=>choice.id==='feat'),false);
  applyLevelUp(c,rogue3);
  assert.equal(c.subclass,'Champion');
  assert.equal(characterClasses(c)[1].subclass,'Thief');
  assert.equal(c.features[0].rollFormula,'2d6');
  assert.ok(c.features.some(f=>f.name==='Fast Hands'));
  const hp=c.maxHp;
  applyLevelUp(c,choicesFor(c,{className:'Rogue'}));
  assert.equal(c.stats.con,16);
  assert.equal(c.maxHp,hp+4+9);
  assert.equal(proficiency(c.level),4);
  const fighter=levelUpPlan(c,{className:'Fighter'});
  assert.equal(fighter.classLevel,6);
  assert.ok(fighter.choices.some(choice=>choice.id==='feat'));
  assert.ok(!filterFeatures({character:c,query:'Reliable Talent'}).length);
});

test('Wizard entry uses six book spells, preserves the class spell ceiling, and earns separate dice',()=>{
  const c=build('Fighter',{level:3,subclass:'Champion',hitDice:2});
  const selection=startingSpells(c,'Wizard',{spell:'magicmissile'});
  const p=levelUpPlan(c,selection);
  assert.equal(p.spellGain,6);
  assert.equal(p.maxSpellLevel,1);
  const before=structuredClone(c);
  assert.throws(()=>applyLevelUp(c,{...selection,spellIds:[...selection.spellIds,'fireball']}),/not available/);
  assert.throws(()=>applyLevelUp(c,{...selection,prepareNewIds:[]}),/Prepare 4/);
  assert.deepEqual(c,before);
  applyLevelUp(c,selection);
  assert.equal(c.spells.filter(s=>s.level===1).length,6);
  assert.equal(c.spells.filter(s=>s.level===1&&s.prepared).length,4);
  assert.ok(c.features.some(f=>f.name==='Arcane Recovery'));
  assert.equal(c.slots[0].max,2);
  assert.deepEqual(c.hitDicePools,{10:2,6:1});
});

test('learning an unprepared Wizard spell preserves an older manual casting source',()=>{
  const c=build('Fighter',{level:3,subclass:'Champion'});
  c.spells=[{id:'manual-missile',name:'Magic Missile',level:1,school:'Evocation',castingTime:'1 action',range:'120 feet',duration:'Instantaneous',concentration:false,prepared:true,wiki:'',notes:'Custom ring'}];
  const selection=startingSpells(c,'Wizard',{spell:'magicmissile'});
  const spells=levelUpPlan(c,selection).available.filter(row=>row.level===1);
  selection.prepareNewIds=selection.spellIds.filter(id=>id!=='magicmissile'&&spells.some(row=>row.id===id)).slice(0,4);
  applyLevelUp(c,selection);
  const spell=c.spells.find(row=>row.id==='manual-missile');
  assert.equal(spell.notes,'Custom ring');
  assert.equal(spell.manualPrepared,true);
  assert.equal(spell.prepared,true);
  assert.deepEqual(classSpellState(spell,c,'Wizard'),{prepared:false});
});

test('Arcane Trickster starts casting at Rogue 3 and gains Mage Hand separately',()=>{
  const c=build('Fighter',{level:7,subclass:'Champion',multiclass:[byClass('Rogue',2)],hitDice:7});
  const selection=choicesFor(c,{className:'Rogue',subclass:'Arcane Trickster'});
  const plan=levelUpPlan(c,selection);
  assert.equal(plan.cantripGain,2);
  assert.equal(plan.spellGain,3);
  assert.throws(()=>applyLevelUp(c,selection),/Choose 2 new class cantrip/);
  const normal=plan.available.filter(spell=>!grantedSpell(plan,spell.id));
  selection.spellIds=[...normal.filter(spell=>spell.level===0).slice(0,2),...normal.filter(spell=>spell.level===1).slice(0,3)].map(spell=>spell.id);
  applyLevelUp(c,selection);
  assert.deepEqual(classSpellState(c.spells.find(spell=>spell.name==='Mage Hand'),c,'Rogue'),{granted:true});
  assert.equal(spellCastingStats(c,'Rogue').ability,'int');
  assert.equal(c.slots[0].max,2);
});

test('Cleric/Wizard has one spell card with independently prepared sources and casting statistics',()=>{
  const c=build('Cleric',{level:2,hitDice:2,spellSlotMode:'auto'});
  syncSpellSlots(c);
  c.slots[0].used=1;
  const sanctuary={id:'old-prep',name:'Protection from Evil and Good',level:1,school:'Abjuration',castingTime:'1 action',range:'Touch',duration:'10 minutes',concentration:true,prepared:true,wiki:'',notes:'Personal notes'};
  c.spells=[sanctuary];
  const wizard=startingSpells(c,'Wizard',{spell:spellKey(sanctuary.name)});
  applyLevelUp(c,wizard);
  const both=c.spells.find(s=>s.name===sanctuary.name);
  assert.equal(c.spells.filter(s=>s.name===sanctuary.name).length,1);
  assert.equal(both.notes,'Personal notes');
  assert.deepEqual(readySpellClasses(both,c),['Cleric','Wizard']);
  assert.deepEqual(spellCastingStats(c,'Cleric'),{ability:'wis',attack:4,dc:12});
  assert.deepEqual(spellCastingStats(c,'Wizard'),{ability:'int',attack:5,dc:13});
  assert.deepEqual(c.slots.slice(0,3),[{max:4,used:1},{max:2,used:0},{max:0,used:0}]);
  applyLevelUp(c,choicesFor(c,{className:'Wizard',preparedIds:[]}));
  const retained=c.spells.find(s=>s.id===both.id);
  assert.deepEqual(classSpellState(retained,c,'Cleric'),{prepared:true});
  assert.deepEqual(classSpellState(retained,c,'Wizard'),{prepared:false});
  assert.deepEqual(readySpellClasses(retained,c),['Cleric']);
  assert.ok(restReminders(c).some(row=>row.title==='Wizard prepared spells'));
  assert.ok(restReminders(c).some(row=>row.title==='Cleric prepared spells'));
  assert.equal(arcaneRecoveryPlan(c).budget,1);
});

test('Paladin/Sorcerer rounds half-caster levels up and never stacks Extra Attack',()=>{
  const c=build('Paladin',{level:6,subclass:'Oath of Devotion',hitDice:6,spellSlotMode:'auto'});
  syncSpellSlots(c);
  applyLevelUp(c,startingSpells(c,'Sorcerer'));
  assert.equal(classBreakdown(c),'Paladin 6 / Sorcerer 1');
  assert.deepEqual(spellSlotPlan(c).maxima.slice(0,4),[4,3,0,0]);
  assert.equal(attacksPerAction(c),2);
  const martial=build('Fighter',{level:16,subclass:'Champion',multiclass:[byClass('Paladin',5,'Oath of Devotion')],hitDice:16});
  assert.equal(attacksPerAction(martial),3);
  const wrangler=build('Fighter',{level:10,subclass:'Champion',multiclass:[byClass('Warlock',5,'Fiend Patron')],features:[{name:'Thirsting Blade'}]});
  assert.equal(attacksPerAction(wrangler,{pactWeapon:true}),2);
  const odd=build('Paladin',{level:8,multiclass:[byClass('Sorcerer',3,'Wild Magic Sorcery')]});
  assert.deepEqual(spellSlotPlan(odd).maxima.slice(0,4),[4,3,3,0]);
});

test('Warlock/Sorcerer preserves spent Pact slots and recovers pact without regular slots',()=>{
  const c=build('Warlock',{level:2,hitDice:2,spellSlotMode:'auto'});
  syncSpellSlots(c);
  c.slots[0].used=1;
  applyLevelUp(c,startingSpells(c,'Sorcerer',{spell:'shield'}));
  assert.deepEqual(c.pactSlot,{level:1,max:2,used:1});
  assert.equal(c.slots[0].max,2);
  c.slots[0].used=1;
  shortRest(c,0);
  assert.equal(c.pactSlot.used,0);
  assert.equal(c.slots[0].used,1);
  applyLevelUp(c,choicesFor(c,{className:'Sorcerer'}));
  const font=c.features.find(feature=>feature.name==='Font of Magic / Sorcery Points');
  assert.equal(font.maxUses,2);
  font.used=1;
  assert.ok(flexibleCastingOptions(c).conversions.some(row=>row.pact&&row.slot===c.pactSlot));
  longRest(c);
  assert.equal(c.slots[0].used,0);
  assert.equal(font.used,0);
  const reverse=build('Sorcerer',{spellSlotMode:'auto'});
  syncSpellSlots(reverse);
  reverse.slots[0].used=1;
  applyLevelUp(reverse,startingSpells(reverse,'Warlock'));
  assert.equal(reverse.slots[0].used,1);
  assert.equal(reverse.pactSlot.used,0);
});

test('Pact of the Tome adds its own Warlock spell choices outside ordinary preparation',()=>{
  const c=build('Sorcerer');
  const invocation=FEATURE_CATALOG.find(entry=>entry.name==='Pact of the Tome');
  const selection=startingSpells(c,'Warlock',{choices:{invocations:[invocation.id]}});
  const p=levelUpPlan(c,selection);
  for(const choice of p.choices.filter(choice=>choice.id.startsWith('tome'))){
    selection.choices[choice.id]=choice.options.filter(row=>!selection.spellIds.includes(row.id)).slice(0,choice.count).map(row=>row.id);
  }
  applyLevelUp(c,selection);
  const tome=c.spells.filter(spell=>spell.origin==='Pact of the Tome');
  assert.equal(tome.length,5);
  assert.ok(tome.every(spell=>classSpellState(spell,c,'Warlock').granted));
  assert.equal(c.spells.filter(spell=>spell.level===1&&classSpellState(spell,c,'Warlock')?.prepared).length,2);
  assert.deepEqual(c.items,[]);
});

test('overlapping Channel Divinity pools scale and refresh independently while armor formulas use one base',()=>{
  const c=build('Paladin',{level:8,subclass:'Oath of Devotion',multiclass:[byClass('Cleric',1)]});
  const paladin=FEATURE_CATALOG.find(e=>e.className==='Paladin'&&e.name==='Channel Divinity');
  c.features.push({id:'paladin-channel',used:2,catalogId:paladin.id,origin:'Class · Paladin',...featureFields(paladin,c)});
  applyLevelUp(c,choicesFor(c,{className:'Cleric'}));
  const pools=c.features.filter(f=>f.name==='Channel Divinity');
  assert.deepEqual(pools.map(f=>[f.origin,f.maxUses,f.used]),[['Class · Paladin',2,2],['Class · Cleric',2,0]]);
  pools[1].used=1;
  shortRest(c);
  assert.deepEqual(pools.map(f=>f.used),[1,0]);
  const monk=build('Barbarian',{level:2,multiclass:[byClass('Monk',1)],stats:{...stats,wis:18}});
  assert.equal(armorClass(monk),16);
});

test('legacy Artificer uses its own training, spells, subclass progression and caster rounding',()=>{
  const c=build('Wizard',{level:2,hitDice:2,spellSlotMode:'auto'});
  applyLevelUp(c,startingSpells(c,'Artificer',{spell:'curewounds'}));
  assert.equal(characterClassLevel(c,'Artificer'),1);
  assert.ok(c.features.some(f=>f.name==='Magical Tinkering'));
  for(const tool of ['Thieves’ Tools','Tinker’s Tools'])assert.ok(trainingFor(c).tools.includes(trainingKey(tool)));
  assert.deepEqual(c.slots.slice(0,3).map(slot=>slot.max),[4,2,0]);
  applyLevelUp(c,choicesFor(c,{className:'Artificer'}));
  applyLevelUp(c,choicesFor(c,{className:'Artificer',subclass:'Armorer'}));
  assert.ok(trainingFor(c).armor.includes('Heavy'));
  assert.ok(c.features.some(f=>f.name==='Arcane Armor'));
  assert.deepEqual(classSpellState(c.spells.find(s=>s.name==='Magic Missile'),c,'Artificer'),{granted:true});
});

test('cloud operations and backups carry class origins and live dice, with conflict protection',()=>{
  const before=build('Fighter',{level:3,subclass:'Champion',hitDice:2});
  const after=structuredClone(before);
  applyLevelUp(after,startingSpells(after,'Wizard',{spell:'magicmissile'}));
  const a=splitCharacter(before),b=splitCharacter(after),operation=makeOperation(before,after);
  assert.equal(b.content.hitDicePools,undefined);
  assert.deepEqual(b.live.hitDicePools,{10:2,6:1});
  assert.deepEqual(joinCharacter(applyFields(a.content,operation.content),applyLive(a.live,operation)),roundTrip(after));
  assert.equal(publicProjection(after).classBreakdown,'Fighter 3 / Wizard 1');
  const spent=structuredClone(after);
  shortRest(spent,{6:1},()=>3);
  const rest=makeOperation(after,spent);
  assert.deepEqual(joinCharacter(b.content,applyLive(b.live,rest)).hitDicePools,{10:2,6:0});
  assert.throws(()=>applyLive(splitCharacter(spent).live,rest),CloudConflict);
  spent.multiclass[0].level=2;
  spent.level++;
  reconcileHitDice(spent,hitDicePools(after));
  assert.equal(spent.hitDice,4);
});

test('level 20 is the total limit and existing single-class advancement still works',()=>{
  const single=build('Fighter',{level:4,subclass:'Champion',hitDice:2});
  applyLevelUp(single,choicesFor(single));
  assert.equal(classBreakdown(single),'Fighter 5');
  assert.equal(single.hitDice,3);
  assert.equal(single.hitDicePools,undefined);
  const c=build('Fighter',{level:19,subclass:'Champion',multiclass:[byClass('Rogue',3,'Thief')]});
  applyLevelUp(c,choicesFor(c,{className:'Rogue'}));
  assert.equal(c.level,20);
  const before=structuredClone(c);
  for(const className of ['Rogue','Fighter','Wizard'])assert.throws(()=>applyLevelUp(c,{className,hpGain:4}),/level 20/);
  assert.deepEqual(c,before);
});
