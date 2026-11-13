import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,SAVE_VERSION,parseBackup,shortRest,CLASSES} from '../model.js';
import {FEATURE_CATALOG,featureFields} from '../feature-catalog.js';
import {CLASS_LEVELS,SPELL_CATALOG} from '../progression-data.js';
import {SUBCLASSES} from '../catalog.js';
import {levelUpPlan,applyLevelUp,canonicalSubclass,classProgression,spellKey,FEAT_ABILITIES,LEVEL_SUBCLASSES} from '../level-up.js';
import {LEGACY_LINEAGE_SPELLS,LEGACY_SUBCLASSES} from '../progression-options.js';
const feature=(name,c,extra={})=>({id:crypto.randomUUID(),used:0,...featureFields(FEATURE_CATALOG.find(f=>f.name===name&&(!f.className||f.className===c.class)),c),...extra});
function selection(c,extra={}){
  const result={hpGain:8,choices:{},abilities:{},...extra};
  // Dependent choices (e.g. baseline skills -> Expertise, feat -> spells) are
  // deliberately resolved as a player does through the form.
  for(let pass=0;pass<4;pass++){
    const plan=levelUpPlan(c,result);
    for(const choice of plan.choices){
      if(result.choices[choice.id])continue;
      const opts=choice.kind==='feat'?[choice.options.find(o=>o.label==='Ability Score Improvement')]:choice.options;
      result.choices[choice.id]=opts.slice(0,choice.count).map(o=>o.id);
      assert.equal(result.choices[choice.id].length,choice.count,`${c.class} ${c.subclass} ${c.level+1}: ${choice.label}`);
      if(choice.kind==='feat'){
        const scores=Object.entries(c.stats).filter(([,n])=>n<=18);
        result.abilities={[scores[0]?.[0]||'str']:2};
      }
    }
  }
  const plan=levelUpPlan(c,result);
  if(plan.arcanum)result.spellIds=[SPELL_CATALOG.find(s=>s.level===plan.arcanum&&s.classes.includes('Warlock')).id];
  return result;
}
const roundTrip=c=>parseBackup(JSON.stringify({version:SAVE_VERSION,activeId:c.id,characters:[c],settings:{sound:false}}));

test('all 240 core class levels exist and every supported subclass has later unlocks',()=>{
  assert.equal(SPELL_CATALOG.filter(s=>s.source==='2024').length,391);
  assert.deepEqual(SPELL_CATALOG.find(s=>s.name==='Toll the Dead').classes,['Cleric','Warlock','Wizard']);
  assert.ok(SPELL_CATALOG.some(s=>s.name==='Sorcerous Burst'&&s.classes.includes('Sorcerer')));
  assert.ok(SPELL_CATALOG.some(s=>s.name==='Word of Radiance'&&s.classes.includes('Cleric')));
  assert.equal(CLASS_LEVELS.find(l=>l.className==='Wizard'&&l.level===20).prepared,25);
  for(const cls of new Set(CLASS_LEVELS.map(r=>r.className)))assert.deepEqual(CLASS_LEVELS.filter(r=>r.className===cls).map(r=>r.level),Array.from({length:20},(_,i)=>i+1));
  for(const sub of SUBCLASSES){
    const c=makeCharacter({class:sub.className,subclass:sub.name,level:19});
    const p=levelUpPlan(c);
    assert.ok([...p.fresh,...p.catchup].some(f=>f.subclass===sub.name&&f.level>3),sub.name);
  }
});
test('Fighter and Rogue extra ASIs, Expertise and higher-level choices are available at actual levels',()=>{
  for(const [cls,levels] of [['Fighter',[4,6,8,12,14,16,19]],['Rogue',[4,8,10,12,16,19]]])for(let level=2;level<=20;level++){
    const p=levelUpPlan(makeCharacter({class:cls,level:level-1}));
    assert.equal(p.choices.some(ch=>ch.id==='feat'),levels.includes(level),`${cls} ${level}`);
  }
  for(const [cls,level,count] of [['Bard',9,2],['Rogue',6,2],['Ranger',9,2]]){
    const p=levelUpPlan(makeCharacter({class:cls,level:level-1,skills:['Arcana','History','Perception','Survival']}));
    assert.equal(p.choices.find(ch=>ch.id==='expertise').count,count);
  }
});
test('level-up is atomic, requires explicit choices, and cancel/preview leaves saves untouched',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Battle Master',level:3}),before=structuredClone(c);
  levelUpPlan(c);assert.deepEqual(c,before);
  assert.throws(()=>applyLevelUp(c,{hpGain:8}),/Choose/);assert.deepEqual(c,before);
  const chosen=selection(c);chosen.spellIds=['invalid-spell'];assert.throws(()=>applyLevelUp(c,chosen),/not available/);assert.deepEqual(c,before);
  assert.throws(()=>applyLevelUp(c,{...selection(c),hpGain:NaN}),/HP/);assert.deepEqual(c,before);
});
test('resource scaling preserves spent uses and customized values',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Battle Master',level:3,skills:['Athletics','Perception']});
  c.features=[feature('Second Wind',c,{used:1}),feature('Superiority Dice',c,{used:2}),feature('Action Surge',c,{maxUses:7,used:3})];
  applyLevelUp(c,selection(c));
  assert.equal(c.features[0].maxUses,3);assert.equal(c.features[0].used,1);assert.equal(c.features[0].rollFormula,'1d10+4');
  assert.equal(c.features[1].used,2);assert.equal(c.features[2].maxUses,7);assert.equal(c.features[2].used,3);roundTrip(c);
});
test('2024 lineage spells unlock at 3 and 5 without adding alternate lineages',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Champion',race:'Wood Elf',level:4,skills:['Athletics','Perception']});
  applyLevelUp(c,selection(c));
  assert.ok(c.spells.some(s=>spellKey(s.name)==='passwithouttrace'));
  assert.ok(c.spells.some(s=>s.name==='Longstrider'));assert.ok(!c.spells.some(s=>s.name==='Darkness'));
  assert.equal(c.features.find(f=>f.name==='Pass without Trace (lineage)').maxUses,1);roundTrip(c);
});
test('2024 versions replace renamed 2014 subclasses and spells; unreplaced PHB subclasses remain',()=>{
  assert.equal(canonicalSubclass('School of Evocation'),'Evoker');assert.equal(canonicalSubclass('Path of the Totem Warrior'),'Path of the Wild Heart');
  assert.equal(spellKey('Branding Smite'),spellKey('Shining Smite'));assert.equal(spellKey('Feeblemind'),spellKey('Befuddlement'));
  assert.equal(new Set(SPELL_CATALOG.map(s=>s.id)).size,SPELL_CATALOG.length);
  assert.ok(!SPELL_CATALOG.some(s=>s.name==='Feeblemind'||s.name==='Branding Smite'));
  assert.ok(SPELL_CATALOG.some(s=>s.name==='Blade Ward'));
  const c=makeCharacter({class:'Cleric',subclass:'Tempest Domain',level:4,skills:['Insight','Religion']});
  applyLevelUp(c,selection(c));assert.ok(c.spells.some(s=>s.name==='Call Lightning'));roundTrip(c);
});
test('Warlock slots retain expenditure when their level changes and recover on Short Rest',()=>{
  const c=makeCharacter({class:'Warlock',level:2,subclass:'Fiend Patron',skills:['Arcana','Deception']});c.slots[0]={max:2,used:1};
  applyLevelUp(c,selection(c));assert.deepEqual(c.slots[0],{max:0,used:0});assert.deepEqual(c.slots[1],{max:2,used:1});
  shortRest(c);assert.equal(c.slots[1].used,0);roundTrip(c);
  const p=levelUpPlan(makeCharacter({class:'Warlock',level:10,subclass:'Fiend Patron'}));assert.equal(p.arcanum,6);assert.equal(p.after.slots[5],0);
  assert.equal(p.fresh.find(f=>f.name==='Mystic Arcanum (6th-level spell)').resource,'one-long');
});
test('HP includes Dwarven Toughness, Tough, and retroactive Constitution increases exactly once',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Champion',race:'Dwarf',level:3,skills:['Athletics','Perception']});
  c.features=[feature('Dwarven Toughness',c)];const hp=c.maxHp;
  const pick=selection(c);pick.abilities={con:2};applyLevelUp(c,pick);assert.equal(c.maxHp,hp+8+1+4);
  const d=makeCharacter({class:'Fighter',subclass:'Champion',level:3,skills:['Athletics','Perception']});
  const tough=FEATURE_CATALOG.find(f=>f.name==='Tough'),select=selection(d);select.choices.feat=[tough.id];select.abilities={};
  const old=d.maxHp;applyLevelUp(d,select);assert.equal(d.maxHp,old+8+8);roundTrip(d);
});
test('third casters have correct slots and Intelligence casting; ASI caps reject invalid increases',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Eldritch Knight',level:3,skills:['Athletics','Arcana']});
  assert.deepEqual(classProgression(c,4).slots.slice(0,3),[3,0,0]);
  const p=selection(c);p.abilities={dex:2};applyLevelUp(c,p);assert.equal(c.spellAbility,'int');roundTrip(c);
  c.level=5;c.stats.str=20;const before=structuredClone(c),bad=selection(c);bad.abilities={str:2};
  assert.throws(()=>applyLevelUp(c,bad),/above 20/);assert.deepEqual(c,before);
});

test('ASI permits +2 or +1/+1 and rejects overspending without changing the character',()=>{
  for(const abilities of [{str:2},{str:1,dex:1}]){
    const c=makeCharacter({class:'Fighter',subclass:'Champion',level:3,skills:['Athletics','Perception']}),before=structuredClone(c.stats);
    applyLevelUp(c,{...selection(c),abilities});
    for(const ability of Object.keys(c.stats))assert.equal(c.stats[ability],before[ability]+(abilities[ability]||0));
  }
  for(const abilities of [{str:2,dex:2},{str:1},{str:1,dex:1,con:1},{str:1.5,dex:.5}]){
    const c=makeCharacter({class:'Fighter',subclass:'Champion',level:3,skills:['Athletics','Perception']}),before=structuredClone(c);
    assert.throws(()=>applyLevelUp(c,{...selection(c),abilities}),/ability|points/);assert.deepEqual(c,before);
  }
  const c=makeCharacter({class:'Fighter',subclass:'Champion',level:3,stats:{str:19,dex:19,con:14,int:10,wis:10,cha:10},skills:['Athletics','Perception']});
  applyLevelUp(c,{...selection(c),abilities:{str:1,dex:1}});assert.equal(c.stats.str,20);assert.equal(c.stats.dex,20);
});

test('racial feats respect species and lineages; unknown Small size requires an explicit choice',()=>{
  const racial={
    'Bountiful Luck':['Halfling','Human'],'Dragon Fear':['Dragonborn','Human'],'Dragon Hide':['Dragonborn','Human'],
    'Drow High Magic':['Drow','High Elf'],'Dwarven Fortitude':['Hill Dwarf','Human'],'Elven Accuracy':['Wood Elf','Human'],
    'Fade Away':['Forest Gnome','Human'],'Fey Teleportation':['High Elf','Wood Elf'],'Flames of Phlegethos':['Infernal Tiefling','Human'],
    'Infernal Constitution':['Abyssal Tiefling','Human'],'Orcish Fury':['Half-Orc','Orc'],'Prodigy':['Half-Elf','Wood Elf'],
    'Second Chance':['Human','Wood Elf'],'Wood Elf Magic':['Wood Elf','High Elf'],'Squat Nimbleness':['Dwarf','Dragonborn']
  };
  const names=c=>levelUpPlan(c).choices.find(ch=>ch.id==='feat').options.map(o=>o.label);
  for(const [name,[valid,invalid]] of Object.entries(racial)){
    const c=makeCharacter({class:'Fighter',subclass:'Champion',race:valid,level:3,skills:['Athletics','Perception']});
    assert.ok(names(c).includes(name),`${valid} qualifies for ${name}`);
    c.race=invalid;assert.ok(!names(c).includes(name),`${invalid} cannot select ${name}`);
    const before=structuredClone(c),s=selection(c);s.choices.feat=[FEATURE_CATALOG.find(f=>f.name===name).id];
    assert.throws(()=>applyLevelUp(c,s),/Invalid choice/);assert.deepEqual(c,before);
  }
  const feat=FEATURE_CATALOG.find(f=>f.name==='Squat Nimbleness');
  for(const race of ['Human','Custom folk']){
    const c=makeCharacter({class:'Fighter',subclass:'Champion',race,level:3,skills:['Athletics','Perception']}),s=selection(c);
    s.choices.feat=[feat.id];s.abilities={dex:1};assert.throws(()=>applyLevelUp(c,s),/size prerequisite/);
    s.choices.featSize=['Small'];applyLevelUp(c,s);assert.ok(c.features.some(f=>f.name===feat.name));
  }
  for(const race of ['Dwarf','Hill Dwarf','Halfling','Forest Gnome']){
    const c=makeCharacter({class:'Fighter',subclass:'Champion',race,level:3}),plan=levelUpPlan(c,{choices:{feat:[feat.id]}});
    assert.ok(!plan.choices.some(ch=>ch.id==='featSize'),race);
  }
});

test('caster feats require the class or subclass casting feature rather than incidental magic',()=>{
  const gated=['War Caster','Spell Sniper','Elemental Adept','Eldritch Adept','Metamagic Adept'];
  for(const [className,subclass,allowed] of [['Fighter','Champion',false],['Fighter','Eldritch Knight',true],['Rogue','Thief',false],['Rogue','Arcane Trickster',true],['Monk','Warrior of Shadow',false],['Wizard','Evoker',true],['Warlock','Fiend Patron',true]]){
    const c=makeCharacter({class:className,subclass,race:'Wood Elf',level:3,stats:{str:10,dex:10,con:10,int:10,wis:10,cha:10},spells:[{name:'Druidcraft',level:0}]});
    const names=levelUpPlan(c).choices.find(ch=>ch.id==='feat').options.map(o=>o.label);
    for(const name of gated)assert.equal(names.includes(name),allowed,`${className} ${subclass}: ${name}`);
  }
  const c=makeCharacter({class:'Fighter',subclass:'Champion',level:3}),before=structuredClone(c);
  const s=selection(c);s.choices.feat=[FEATURE_CATALOG.find(f=>f.name==='War Caster').id];s.abilities={int:1};
  assert.throws(()=>applyLevelUp(c,s),/Invalid choice/);assert.deepEqual(c,before);
});

test('feat gates use 2024 ability and training prerequisites, and prevent duplicate and premature feats',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Champion',level:3,stats:{str:10,dex:10,con:10,int:10,wis:10,cha:10}});
  const names=()=>levelUpPlan(c).choices.find(ch=>ch.id==='feat').options.map(o=>o.label);
  for(const name of ['Crusher','Heavy Armor Master','Mage Slayer','Mounted Combatant','Piercer','Poisoner','Slasher','Shield Master','Martial Weapon Training'])assert.ok(names().includes(name),name);
  for(const name of ['Actor','Athlete','Charger','Crossbow Expert','Defensive Duelist','Dual Wielder','Great Weapon Master','Inspiring Leader','Keen Mind','Observant','Polearm Master','Sentinel','Sharpshooter','Skulker','Speedy','Grappler','Ritual Caster','Boon of Fate'])assert.ok(!names().includes(name),name);
  c.stats.dex=13;assert.ok(names().includes('Grappler'));assert.ok(names().includes('Crossbow Expert'));
  c.armorProficiencies='None';for(const name of ['Shield Master','Heavy Armor Master','Heavily Armored','Medium Armor Master','Moderately Armored'])assert.ok(!names().includes(name),name);
  c.armorProficiencies='Light armor; Shields';assert.ok(names().includes('Shield Master'));assert.ok(names().includes('Moderately Armored'));assert.ok(!names().includes('Heavy Armor Master'));
  c.features=[feature('Athlete',c)];assert.ok(!names().includes('Athlete'));
});

test('known subclasses cannot grant feats or casting progression to a different class',()=>{
  for(const [cls,subclass] of [['Fighter','Arcane Trickster'],['Rogue','Eldritch Knight'],['Barbarian','Evoker']]){
    const c=makeCharacter({class:cls,subclass,level:3}),before=structuredClone(c);
    assert.throws(()=>levelUpPlan(c),/subclass.*class/);assert.throws(()=>applyLevelUp(c,{hpGain:8}),/subclass.*class/);assert.deepEqual(c,before);
    assert.equal(classProgression(c).prepared,0);
  }
  assert.doesNotThrow(()=>levelUpPlan(makeCharacter({class:'Fighter',subclass:'My custom subclass',level:3})));
});
test('feat-specific skills and spell selections are required and persist',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Champion',level:3,skills:['Athletics','Perception']});
  const feat=FEATURE_CATALOG.find(f=>f.name==='Magic Initiate (Wizard)'),s=selection(c);
  s.choices.feat=[feat.id];s.abilities={};assert.throws(()=>applyLevelUp(c,s),/cantrips/);
  s.choices.bonusCantrips=['firebolt','magehand'];s.choices.bonusSpell=['shield'];applyLevelUp(c,s);
  assert.ok(c.spells.some(s=>s.name==='Shield'));assert.ok(c.spells.some(s=>s.name==='Mage Hand'));roundTrip(c);
  assert.ok(FEAT_ABILITIES['Skill Expert']);
});
test('all 13 classes can advance through levels 2–20 with legal selections and valid saves',()=>{
  for(const cls of Object.keys(CLASSES)){
    const c=makeCharacter({class:cls,subclass:SUBCLASSES.find(s=>s.className===cls).name,stats:{str:14,dex:14,con:14,int:14,wis:14,cha:14},skills:['Arcana','History','Insight','Perception','Stealth']});
    for(let level=2;level<=20;level++){
      applyLevelUp(c,selection(c));assert.equal(c.level,level,`${cls} ${level}`);roundTrip(c);
    }
  }
});
test('every earlier subclass has a labeled progression and legacy cleric damage features are replaced',()=>{
  for(const sub of LEGACY_SUBCLASSES){
    assert.ok(LEVEL_SUBCLASSES.some(s=>s.name===sub.name&&s.source==='2014'));
    const p=levelUpPlan(makeCharacter({class:sub.className,subclass:sub.name,level:19}));
    assert.ok([...p.fresh,...p.catchup].some(f=>f.subclass===sub.name&&f.level>3),sub.name);
    if(sub.className==='Cleric')assert.ok(![...p.fresh,...p.catchup].some(f=>f.subclass===sub.name&&['Divine Strike','Potent Spellcasting'].includes(f.name)));
  }
});
test('every built-in subclass can complete each level without granting unselected option groups',()=>{
  for(const sub of LEVEL_SUBCLASSES){
    const c=makeCharacter({class:sub.className,subclass:sub.name,stats:{str:14,dex:14,con:14,int:14,wis:14,cha:14},skills:['Arcana','History','Insight','Perception','Stealth']});
    for(let level=2;level<=20;level++)applyLevelUp(c,selection(c));
    roundTrip(c);
    if(sub.name==='Battle Master')assert.equal(c.features.filter(f=>FEATURE_CATALOG.some(e=>e.group==='Maneuvers'&&e.id===f.catalogId)).length,9);
  }
});
test('every bundled earlier lineage exposes its later spells, with 2024 spell replacements',()=>{
  for(const race of Object.keys(LEGACY_LINEAGE_SPELLS)){
    const c=makeCharacter({class:'Fighter',subclass:'Champion',race,level:4,skills:['Athletics','Perception']});
    applyLevelUp(c,selection(c));
    for(const [at,...names] of LEGACY_LINEAGE_SPELLS[race])if(at<=5)for(const name of names)assert.ok(c.spells.some(s=>spellKey(s.name)===spellKey(name)),`${race}: ${name}`);
    roundTrip(c);
  }
});
test('Wizard spellbook learning is independent of preparation capacity',()=>{
  const c=makeCharacter({class:'Wizard',subclass:'Evoker',level:6,skills:['Arcana','History']});
  const old=SPELL_CATALOG.filter(s=>s.level>0&&s.level<=3&&s.classes.includes('Wizard')).slice(0,10);
  c.spells=old.map(s=>{const {classes,source,ritual,id,...fields}=s;return {...fields,id:crypto.randomUUID(),prepared:true};});
  const selected=selection(c),p=levelUpPlan(c,selected);
  selected.spellIds=p.available.filter(s=>s.level===4&&s.id!==selected.choices.savant?.[0]).slice(0,2).map(s=>s.id);
  applyLevelUp(c,selected);
  assert.equal(c.spells.filter(s=>s.prepared).length,10);assert.equal(c.spells.length,13);roundTrip(c);
});
test('missing eligible import data has an explicit pending-choice path and custom additions stay atomic',()=>{
  const c=makeCharacter({class:'Wizard',level:1,skills:['Athletics','Stealth']});
  assert.throws(()=>applyLevelUp(c,{hpGain:6}),/Scholar/);
  applyLevelUp(c,{hpGain:6,manualChoiceIds:['expertise'],customSpells:'1 | Book spell',customFeatures:'Book feature'});
  assert.ok(c.features.some(f=>f.name==='Pending choice: Scholar Expertise'));assert.ok(c.spells.some(s=>s.name==='Book spell'));roundTrip(c);
});
test('a known caster can replace one spell without using its new-spell allowance',()=>{
  const c=makeCharacter({class:'Sorcerer',subclass:'Wild Magic Sorcery',level:5,skills:['Arcana','Deception']});
  const known=SPELL_CATALOG.filter(s=>s.level>0&&s.level<=3&&s.classes.includes('Sorcerer')).slice(0,9);
  c.spells=known.map(s=>{const {classes,source,ritual,id,...fields}=s;return {...fields,id:crypto.randomUUID(),prepared:true};});
  const s=selection(c),next=SPELL_CATALOG.find(s=>s.level===2&&s.classes.includes('Sorcerer')&&!known.includes(s));
  s.replaceSpellId=c.spells[0].id;s.replacementSpellId=next.id;
  const oldName=c.spells[0].name;applyLevelUp(c,s);assert.equal(c.spells.length,9);assert.ok(!c.spells.some(s=>s.name===oldName));assert.ok(c.spells.some(s=>s.name===next.name));roundTrip(c);
});
test('independent lineage and feat grants retain independent free castings',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Champion',race:'Wood Elf',level:3,skills:['Athletics','Perception']});
  c.features=[feature('Longstrider (lineage)',c,{used:1})];
  const chosen=selection(c);chosen.choices.feat=[FEATURE_CATALOG.find(f=>f.name==='Wood Elf Magic').id];chosen.abilities={};chosen.choices.bonusCantrips=['guidance'];
  applyLevelUp(c,chosen);
  const resources=c.features.filter(f=>f.maxUses&&f.name.includes('Longstrider'));
  assert.equal(resources.length,2);assert.equal(resources[0].used,1);assert.equal(resources[1].used,0);roundTrip(c);
});
test('earlier Artificer preparation includes an Intelligence increase chosen in the same level-up',()=>{
  const c=makeCharacter({class:'Artificer',subclass:'Alchemist',level:3,stats:{str:10,dex:14,con:14,int:14,wis:10,cha:10},skills:['Arcana','History']});
  const s=selection(c);s.abilities={int:2};const p=levelUpPlan(c,s);assert.equal(p.after.prepared,5);
  const granted=new Set(p.grant.map(s=>s.id));s.spellIds=p.available.filter(s=>s.level>0&&!granted.has(s.id)).slice(0,5).map(s=>s.id);
  applyLevelUp(c,s);assert.equal(c.stats.int,16);roundTrip(c);
});
