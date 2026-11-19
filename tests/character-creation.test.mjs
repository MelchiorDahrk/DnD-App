import test from 'node:test';
import assert from 'node:assert/strict';
import {ABILITIES, SAVE_VERSION, initiative, longRest, mod, parseBackup, skillBonus, walkingSpeed} from '../model.js';
import {CLASS_OPTIONS, BACKGROUNDS} from '../catalog.js';
import {FEATURE_CATALOG} from '../feature-catalog.js';
import {classProgression, applyLevelUp, levelOnePlan, levelUpPlan, spellKey} from '../level-up.js';
import {armorClass,armorSpeedPenalty} from '../armor-class.js';
import {emptyState, publicProjection, splitCharacter, joinCharacter} from '../cloud-model.js';
import {creationPlan, finishLevelOne, newCharacterDraft, rollStartingScores, startingAbilities} from '../character-creation.js';

const featureId = name => FEATURE_CATALOG.find(entry=>entry.name===name).id;
const find = (c,name) => c.features.find(f=>f.name===name);
const abilities = Object.keys(ABILITIES);

function completeDraft(className, species='Dwarf', background='Soldier', selections={}, values={}) {
  const draft = {...newCharacterDraft(),name:'Indigo Bricks',class:className,species,background,...values};
  draft.choices={...selections};
  draft.assignments=Object.fromEntries(abilities.map((id,index)=>[id,String(index)]));
  for(let step=0;step<7;step++){
    let plan=creationPlan(draft,{},step);
    for(let attempts=0;attempts<20&&plan.errors[step].length;attempts++){
      if(step===2)draft.bonuses={[plan.eligible[0]]:2,[plan.eligible[1]]:1};
      else{
        const group=plan.groups[step].find(row=>!row.defaultValue&&(!draft.choices[row.id]||draft.choices[row.id].some(id=>!row.options.some(option=>option.id===id))));
        assert.ok(group,plan.errors[step].join(' / '));
        assert.ok(group.options.length>=group.count,group.label);
        draft.choices[group.id]=group.options.slice(0,group.count).map(option=>option.id);
      }
      plan=creationPlan(draft,{},step);
    }
    assert.deepEqual(plan.errors[step],[],`Step ${step+1} for ${className}`);
  }
  return draft;
}

test('ability generation keeps roll identities and validates budgets, patterns and score caps',()=>{
  const dice=[3,3,6,1,5,5,1,2,1,1,1,1,6,6,6,6,1,2,3,4,2,2,2,2];
  const rolls=rollStartingScores(()=>dice.shift());
  assert.deepEqual(rolls.map(roll=>roll.total),[12,12,3,18,9,6]);
  assert.deepEqual(rolls[0],{dice:[3,3,6,1],dropped:3,total:12});
  const draft={...completeDraft('Fighter'),method:'roll',rolls};
  let result=startingAbilities(draft,['str','dex','con']);
  assert.equal(result.base.str,12);
  assert.equal(result.base.dex,12);
  assert.deepEqual(result.errors,[]);
  draft.assignments.dex=draft.assignments.str;
  assert.match(startingAbilities(draft,['str','dex','con']).errors.join(' '),/only once/);
  draft.method='points';
  draft.pointBuy={str:15,dex:15,con:15,int:8,wis:8,cha:8};
  draft.bonuses={str:1,dex:1,con:1};
  result=startingAbilities(draft,['str','dex','con']);
  assert.equal(result.spent,27);
  assert.equal(result.final.str,16);
  assert.deepEqual(result.errors,[]);
  draft.pointBuy.cha=9;
  assert.match(startingAbilities(draft,['str','dex','con']).errors.join(' '),/28 points/);
  draft.pointBuy.cha=16;
  assert.match(startingAbilities(draft,['str','dex','con']).errors.join(' '),/Charisma/);
  draft.method='manual';
  draft.manual={str:20,dex:12,con:12,int:10,wis:10,cha:10};
  assert.match(startingAbilities(draft,['str','dex','con']).errors.join(' '),/exceed 20/);
  draft.manual.str=18;draft.bonuses={str:2,wis:1};
  assert.match(startingAbilities(draft,['str','dex','con']).errors.join(' '),/eligible increase/);
});

test('all supported classes initialize their fixed features, training, HP, spell counts and slots at level 1',()=>{
  const classResource = {
    Barbarian:['Rage',2], Bard:['Bardic Inspiration',1], Fighter:['Second Wind',2], Paladin:['Lay On Hands',5],
    Ranger:['Favored Enemy',2], Sorcerer:['Innate Sorcery',2], Wizard:['Arcane Recovery',1]
  };
  for(const cls of CLASS_OPTIONS){
    const draft=completeDraft(cls.name);
    const c=finishLevelOne(draft),row=classProgression(c);
    assert.equal(c.level,1,cls.name);
    assert.equal(c.hitDice,1);
    assert.equal(c.hitDie,cls.hitDie);
    assert.equal(c.hp,cls.hitDie+mod(c.stats.con)+1);
    assert.deepEqual(c.saves,cls.saves);
    assert.equal(c.skills.length,cls.skillCount+2);
    assert.equal(c.training.languages.includes('Common'),true);
    assert.ok(c.skills.includes('Athletics'));
    assert.ok(find(c,'Savage Attacker'));
    for(const name of row.features)assert.ok(c.features.some(f=>f.name.toLowerCase()===name.toLowerCase()),`${cls.name} ${name}`);
    if(classResource[c.class]){
      const [name,max]=classResource[c.class];
      assert.equal(find(c,name)?.maxUses,max,`${cls.name} ${name}`);
    }
    assert.deepEqual(c.slots.map(slot=>slot.max),row.slots);
    assert.equal(c.spells.filter(s=>s.classPrepared===true&&s.level>0).length,row.prepared);
    assert.equal(c.spells.filter(s=>s.classPrepared===true&&s.level===0).length,row.cantrips);
    const draftWithoutLevels=structuredClone(c);
    levelOnePlan(c);
    assert.deepEqual(c,draftWithoutLevels);
    assert.equal(new Set(c.spells.map(v=>v.name)).size,c.spells.length);
  }
});

test('every built-in background applies its package, skills and Origin feat',()=>{
  for(const bg of BACKGROUNDS){
    const draft=completeDraft('Fighter','Dwarf',bg.name);
    const c=finishLevelOne(draft);
    assert.ok(bg.skills.split(', ').every(s=>c.trainingOrigins.skills[s].includes(`Background · ${bg.name}`)),bg.name);
    assert.equal(find(c,bg.feat)?.origin,`Background · ${bg.name}`);
    assert.ok(c.training.tools.length);
    assert.ok(c.items.length>0);
    if(bg.feat==='Tough')assert.equal(c.hp,c.hitDie+mod(c.stats.con)+3);
    if(bg.feat==='Alert')assert.equal(initiative(c),mod(c.stats.dex)+2);
  }
});

test('Fighter and Rogue get trained attacks, mastery, armor, languages and Expertise',()=>{
  const fighter=finishLevelOne(completeDraft('Fighter','Human','Soldier',{
    size:['Small'],humanFeat:[featureId('Tough')],style:[featureId('Fighting Style: Defense')],
    mastery:['Greatsword','Flail','Javelin'],classPackage:['0']
  }));
  assert.equal(fighter.size,'Small');
  assert.equal(armorClass(fighter),17);
  assert.equal(fighter.items.find(i=>i.name==='Javelin').qty,8);
  assert.ok(fighter.attacks.some(a=>a.name==='Greatsword'&&a.mastery==='Graze'&&a.itemId));
  assert.equal(find(fighter,'Second Wind').rollFormula,'1d10+1');
  assert.ok(fighter.trainingOrigins.skills[fighter.skills.at(-1)].includes('Species · Human'));
  longRest(fighter);
  assert.equal(fighter.inspiration,1);

  const rogue=finishLevelOne(completeDraft('Rogue','Halfling','Criminal',{mastery:['Dagger','Shortbow']}));
  assert.equal(rogue.expertise.length,2);
  assert.ok(rogue.expertise.every(skill=>rogue.skills.includes(skill)));
  assert.equal(find(rogue,'Sneak Attack').rollFormula,'1d6');
  assert.equal(rogue.training.languages.length,5);
  assert.ok(rogue.training.languages.includes('Thieves’ Cant'));
  assert.deepEqual(rogue.trainingOrigins.tools['thieves-tools'],['Background · Criminal','Class · Rogue']);
  assert.equal(rogue.items.find(i=>i.catalogId==='arrows').usesLeft,20);
  assert.equal(rogue.items.find(i=>i.catalogId==='arrows').qty,1);
});

test('Cleric, Wizard and Warlock retain distinct preparations and limited casting grants',()=>{
  const cleric=finishLevelOne(completeDraft('Cleric','Human','Acolyte',{
    order:['Thaumaturge'],'background-featAbility':['cha'],'background-bonusSpell':['bless'],
    classSpells:['bless','bane','command','curewounds']
  }));
  assert.equal(cleric.spells.filter(s=>s.level===0&&s.classPrepared).length,4);
  assert.equal(skillBonus(cleric,'Religion'),mod(cleric.stats.int)+2+Math.max(1,mod(cleric.stats.wis)));
  const bless=cleric.spells.find(s=>s.name==='Bless');
  assert.deepEqual(bless.origins,['Magic Initiate (Cleric)','Cleric']);
  assert.deepEqual(bless.castingGrants,[{origin:'Magic Initiate (Cleric)',ability:'cha',mode:'free',featureId:find(cleric,'Magic Initiate (Cleric)').id}]);
  assert.equal(cleric.items.find(i=>i.catalogId==='shield').equipped,true);

  const wizard=finishLevelOne(completeDraft('Wizard','Elf','Sage',{
    lineage:['High Elf'],lineageAbility:['cha'],elfCantrip:['magehand'],
    'background-featAbility':['wis'],'background-bonusSpell':['magicmissile'],
    classSpells:['alarm','burninghands','charmperson','comprehendlanguages','detectmagic','magicmissile'],
    wizardPrepared:['alarm','burninghands','charmperson','detectmagic']
  }));
  const book=wizard.spells.filter(s=>s.level===1&&s.classPrepared!==undefined);
  assert.equal(book.length,6);
  assert.equal(book.filter(s=>s.classPrepared).length,4);
  assert.equal(book.find(s=>s.name==='Magic Missile').classPrepared,false);
  assert.equal(book.find(s=>s.name==='Magic Missile').prepared,true);
  assert.equal(wizard.spells.find(s=>s.name==='Mage Hand').castingGrants[0].ability,'cha');
  assert.ok(wizard.attacks.some(attack=>attack.weaponId==='quarterstaff'));

  const tome=finishLevelOne(completeDraft('Warlock','Gnome','Wayfarer',{
    lineage:['Forest Gnome'],invocations:[featureId('Pact of the Tome')],lineageAbility:['int']
  }));
  assert.equal(tome.pactMagic,true);
  assert.equal(tome.slots[0].max,1);
  assert.equal(tome.spells.filter(s=>s.origin==='Pact of the Tome'&&s.level===0).length,3);
  assert.equal(tome.spells.filter(s=>s.origin==='Pact of the Tome'&&s.level===1).length,2);
  assert.equal(find(tome,'Speak with Animals (lineage)').maxUses,2);

  const chain=finishLevelOne(completeDraft('Warlock','Dwarf','Soldier',{invocations:[featureId('Pact of the Chain')]}));
  assert.equal(chain.spells.find(s=>s.name==='Find Familiar').castingGrants[0].mode,'at-will');
  const blade=finishLevelOne(completeDraft('Warlock','Dwarf','Soldier',{invocations:[featureId('Pact of the Blade')],pactWeapon:['rapier']}));
  assert.ok(blade.attacks.some(a=>a.name==='Rapier (Pact Weapon)'&&a.proficiencyMode==='proficient'&&a.itemId));
});

test('variant and mandatory choices, spell legality, and sources reject invalid builds without mutating inputs',()=>{
  const dragonDraft=completeDraft('Fighter','Dragonborn','Soldier',{dragon:['Gold']});
  const dragon=finishLevelOne(dragonDraft);
  assert.match(find(dragon,'Breath Weapon').description,/Fire damage/);
  assert.equal(find(dragon,'Breath Weapon').maxUses,2);
  const giant=finishLevelOne(completeDraft('Barbarian','Goliath','Soldier',{giant:['Frost’s Chill']}));
  assert.equal(find(giant,'Frost’s Chill').rollFormula,'1d6');
  assert.equal(find(giant,'Cloud’s Jaunt'),undefined);
  const tiefling=finishLevelOne(completeDraft('Fighter','Tiefling','Soldier',{lineage:['Infernal Tiefling'],lineageAbility:['int']}));
  assert.match(find(tiefling,'Fiendish Legacy').description,/Fire/);
  assert.deepEqual(tiefling.spells.map(s=>s.name),['Thaumaturgy','Fire Bolt']);
  delete dragonDraft.choices.dragon;
  const prior=structuredClone(dragonDraft);
  assert.throws(()=>finishLevelOne(dragonDraft),/Draconic ancestry/);
  assert.deepEqual(dragonDraft,prior);
  assert.throws(()=>finishLevelOne(dragonDraft,{hiddenSources:['playershandbook2024']}),/enabled class/);
  const invalid=completeDraft('Wizard');
  invalid.choices.classCantrips=['eldritchblast','magehand','magehand'];
  assert.throws(()=>finishLevelOne(invalid),/Wizard cantrips/);
});

test('gear alternatives and purchases respect the wallet and equipment choice',()=>{
  const draft=completeDraft('Fighter','Dwarf','Soldier',{classPackage:['2'],backgroundPackage:['1']},
    {purchases:[{id:'chain-mail',quantity:1},{id:'shield',quantity:1},{id:'longsword',quantity:1}]});
  const c=finishLevelOne(draft);
  assert.equal(c.gold,105);
  assert.equal(armorClass(c),18);
  assert.ok(c.attacks.some(attack=>attack.name==='Longsword'));
  draft.choices.equipShield=['none'];
  assert.equal(armorClass(finishLevelOne(draft)),16);
  const slow=structuredClone(c);
  slow.stats.str=10;
  assert.equal(walkingSpeed(slow,armorSpeedPenalty(slow)),20);
  draft.purchases[0].quantity=3;
  assert.throws(()=>finishLevelOne(draft),/exceed your starting money/);
});

test('repeatable Skilled and manual species selections keep independent provenance',()=>{
  const skilled=finishLevelOne(completeDraft('Rogue','Human','Charlatan',{humanFeat:[featureId('Skilled')]}));
  assert.equal(skilled.features.filter(f=>f.name==='Skilled').length,2);
  const chosen=Object.values(skilled.trainingOrigins.skills).flat().filter(source=>source.startsWith('Feat · Skilled'));
  assert.equal(chosen.length,6);
  const custom=finishLevelOne(completeDraft('Fighter','custom','custom',{backgroundFeat:[featureId('Tough')]},{
    customSpecies:'Marshling',customBackground:'River Guide',customSpeed:25,customSkillCount:1,customToolCount:1,
    customFeatures:'Amphibious | Can breathe air and water.',customLanguages:'Aquan',
    customSpells:'0 | Light | wis'
  }));
  assert.equal(custom.speed,25);
  assert.ok(custom.training.languages.includes('Aquan'));
  assert.ok(find(custom,'Amphibious').origin.startsWith('Custom'));
  assert.ok(custom.spells.some(s=>s.name==='Light'&&s.castingGrants[0].ability==='wis'));
});

test('sequential higher-level starts apply actual progression and v2/cloud round trips preserve private data',()=>{
  const c=finishLevelOne(completeDraft('Fighter','Human','Soldier',{humanFeat:[featureId('Tough')]}));
  const hp=c.hp;
  applyLevelUp(c,{hpGain:7,requireFullProgression:true});
  assert.equal(c.level,2);
  assert.equal(c.hp,hp+9);
  assert.ok(find(c,'Action Surge'));
  assert.throws(()=>applyLevelUp(c,{hpGain:7,requireFullProgression:true}),/Choose a subclass/);
  assert.equal(c.level,2);
  applyLevelUp(c,{hpGain:7,subclass:'Champion',requireFullProgression:true});
  assert.equal(c.hitDice,3);
  assert.ok(find(c,'Improved Critical'));
  const state={...emptyState({sound:false}),version:SAVE_VERSION,activeId:c.id,characters:[c]};
  const saved=parseBackup(JSON.stringify(state)).characters[0];
  const {content,live}=splitCharacter(saved);
  assert.deepEqual(joinCharacter(content,live),saved);
  const shared=JSON.stringify(publicProjection(saved));
  assert.doesNotMatch(shared,/trainingOrigins|Class ·|Background ·|castingGrants|classPrepared/);

  const wizard=finishLevelOne(completeDraft('Wizard'));
  const plan=levelUpPlan(wizard);
  const [first,second]=plan.available.filter(s=>s.level===1&&!wizard.spells.some(old=>spellKey(old.name)===s.id));
  const scholar=plan.choices.find(ch=>ch.id==='expertise').options[0].id;
  const advancement={hpGain:5,requireFullProgression:true,choices:{expertise:[scholar]},spellIds:[first.id,second.id]};
  assert.throws(()=>applyLevelUp(wizard,advancement),/Prepare 5 class spells/);
  applyLevelUp(wizard,{...advancement,prepareNewIds:[first.id]});
  assert.equal(wizard.spells.filter(s=>s.level>0&&s.classPrepared).length,5);
  assert.equal(wizard.spells.filter(s=>s.level>0&&s.classPrepared!==undefined).length,8);
});
