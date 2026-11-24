import {levelUp,uid,mod,SKILLS,ABILITIES,wikiURL,subclassURL,parseBackup,SAVE_VERSION,castingAbility,proficiency,abilityCheckBonus} from './model.js';
import {FEATURE_CATALOG,featureFields,featureMatchesCharacter,isFeat} from './feature-catalog.js';
import {CLASS_OPTIONS,SUBCLASSES,SPECIES,WEAPONS,EQUIPMENT} from './catalog.js';
import {CLASS_LEVELS,SPELL_CATALOG} from './progression-data.js';
import {trainingFor,ensureTraining,trainingKey,TOOL_NAMES,LANGUAGE_GROUPS} from './training-rules.js';
import {classSlotMaximums,isThirdCaster,spellSlotPlan,syncSpellSlots} from './spell-slots.js';
import {CLASSES,advanceClass,characterClasses,characterClass,characterClassLevel,classHitDie,multiclassRequirements} from './character-classes.js';
import {SUBCLASS_ALIASES,SUBCLASS_ROWS,LEGACY_SUBCLASSES,SUPPLEMENTAL_SUBCLASSES,SUBCLASS_SPELLS,LINEAGE_SPELLS,LAND_SPELLS,LEGACY_EXPANDED_SPELLS,LEGACY_LINEAGE_SPELLS,GENIE_SPELLS} from './progression-options.js';

export const normalized=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
export function spellKey(s){const n=normalized(s).replace(/^(bigbys|drawmijs|evards|leomunds|melfs|mordenkainens|nystuls|otilukes|ottos|rarys|tashas|tensers)/,'');return ({brandingsmite:'shiningsmite',feeblemind:'befuddlement',hand:'arcanehand',sword:'arcanesword',magicaura:'arcanistsmagicaura'})[n]||n;}
export function canonicalSubclass(name){return Object.entries(SUBCLASS_ALIASES).find(([key])=>normalized(key)===normalized(name))?.[1]||name;}
export const LEVEL_SUBCLASSES=[...SUBCLASSES.map(s=>({...s,source:s.className==='Artificer'?'2014':'2024'})),...SUPPLEMENTAL_SUBCLASSES,...LEGACY_SUBCLASSES];
const spellByName=name=>SPELL_CATALOG.find(s=>s.id===spellKey(name));
const has=(c,name)=>c.features.some(f=>normalized(f.name)===normalized(name)||normalized(f.name)===normalized(`${name} (Origin feat)`));
export const FEAT_ABILITIES={Actor:['cha'],Athlete:['str','dex'],Charger:['str','dex'],Chef:['con','wis'],'Crossbow Expert':['dex'],Crusher:['str','con'],'Defensive Duelist':['dex'],'Dual Wielder':['str','dex'],Durable:['con'],'Elemental Adept':['int','wis','cha'],'Fey-Touched':['int','wis','cha'],Grappler:['str','dex'],'Great Weapon Master':['str'],'Heavily Armored':['con','str'],'Heavy Armor Master':['con','str'],'Inspiring Leader':['wis','cha'],'Keen Mind':['int'],'Lightly Armored':['str','dex'],'Mage Slayer':['str','dex'],'Martial Weapon Training':['str','dex'],'Medium Armor Master':['str','dex'],'Moderately Armored':['str','dex'],'Mounted Combatant':['str','dex','wis'],Observant:['int','wis'],Piercer:['str','dex'],Poisoner:['dex','int'],'Polearm Master':['str','dex'],Resilient:Object.keys(ABILITIES),'Ritual Caster':['int','wis','cha'],Sentinel:['str','dex'],'Shadow-Touched':['int','wis','cha'],Sharpshooter:['dex'],'Shield Master':['str'], 'Skill Expert':Object.keys(ABILITIES),Skulker:['dex'],Slasher:['str','dex'],Speedy:['dex','con'],'Spell Sniper':['int','wis','cha'],Telekinetic:['int','wis','cha'],Telepathic:['int','wis','cha'],'War Caster':['int','wis','cha'],'Weapon Master':['str','dex']};
Object.assign(FEAT_ABILITIES,{Linguist:['int'],Gunner:['dex'],'Dragon Fear':['str','con','cha'],'Dragon Hide':['str','con','cha'],'Dwarven Fortitude':['con'],'Elven Accuracy':['dex','int','wis','cha'],'Fade Away':['dex','int'],'Fey Teleportation':['int','cha'],'Flames of Phlegethos':['int','cha'],'Infernal Constitution':['con'],'Orcish Fury':['str','con'],'Second Chance':['dex','con','cha'],'Squat Nimbleness':['str','dex']});
export const featAbilityChoices=entry=>entry?.abilities??(entry?.group==='Epic boons'?Object.keys(ABILITIES):FEAT_ABILITIES[entry?.name]||[]);
const featureById=new Map(FEATURE_CATALOG.map(e=>[e.id,e]));
const hasFeat=(c,name)=>{
  const expected=normalized(name);
  return c.features.some(f=>{
    if(normalized(f.name.replace(/\s*\(.*\)$/,''))!==expected)return false;
    const preset=f.catalogId&&featureById.get(f.catalogId);
    return !preset||isFeat(preset);
  });
};
const dragonmarkNames=FEATURE_CATALOG.filter(e=>e.group==='Dragonmark feats').map(e=>e.name);
const asiLevels=cls=>cls==='Fighter'?[4,6,8,12,14,16,19]:cls==='Rogue'?[4,8,10,12,16,19]:[4,8,12,16,19];
const spellList=names=>new Set(names.split('|').map(spellKey));
const artificerSpells=spellList('Acid Splash|Guidance|Light|Mage Hand|Mending|Message|Poison Spray|Prestidigitation|Ray of Frost|Resistance|Shocking Grasp|Spare the Dying|Thorn Whip|Alarm|Cure Wounds|Detect Magic|Disguise Self|Expeditious Retreat|Faerie Fire|False Life|Feather Fall|Grease|Identify|Jump|Longstrider|Purify Food and Drink|Sanctuary|Aid|Alter Self|Arcane Lock|Blur|Continual Flame|Darkvision|Enhance Ability|Enlarge/Reduce|Heat Metal|Invisibility|Lesser Restoration|Levitate|Magic Mouth|Magic Weapon|Protection from Poison|Rope Trick|See Invisibility|Spider Climb|Web|Blink|Catnap|Create Food and Water|Dispel Magic|Elemental Weapon|Flame Arrows|Fly|Glyph of Warding|Haste|Protection from Energy|Revivify|Tiny Servant|Water Breathing|Water Walk|Arcane Eye|Elemental Bane|Fabricate|Freedom of Movement|Leomund’s Secret Chest|Mordenkainen’s Faithful Hound|Mordenkainen’s Private Sanctum|Otiluke’s Resilient Sphere|Stone Shape|Stoneskin|Animate Objects|Bigby’s Hand|Creation|Greater Restoration|Skill Empowerment|Transmute Rock|Wall of Stone');
export function classProgression(c,level=characterClassLevel(c,c.class)){
  if(c.class==='Artificer'){
    const slots=classSlotMaximums(c.class,level);
    return {className:c.class,level,slots,cantrips:level>=14?4:level>=10?3:2,prepared:Math.max(1,Math.floor(level/2)+mod(c.stats.int)),specific:{},features:FEATURE_CATALOG.filter(f=>f.className===c.class&&!f.subclass&&f.level===level).map(f=>f.name)};
  }
  if(isThirdCaster(c.class,canonicalSubclass(c.subclass))&&level>=3){
    const slots=classSlotMaximums(c.class,level,canonicalSubclass(c.subclass));
    const prepared=[0,0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13][level];
    return {...CLASS_LEVELS.find(r=>r.className===c.class&&r.level===level),slots,cantrips:(c.subclass==='Arcane Trickster'?3:2)+(level>=10?1:0),prepared,specific:{}};
  }
  return CLASS_LEVELS.find(r=>r.className===c.class&&r.level===level);
}
export function progressionForClass(character,className){
  const row=characterClass(character,className);
  return row&&classProgression({...character,class:row.class,subclass:row.subclass},row.level);
}
function reference(name,owner,level,source='2024'){
  const resource=({'Arcane Shot':'two-short','Giant’s Might':'pb-long','Magic Awareness':'pb-long','Bolstering Magic':'pb-long','Fighting Spirit':'three-long','Unleash Incarnation':'con-long','Reclaim Potential':'con-long','Chronal Shift':'two-long','Momentary Stasis':'int-long',Bladesong:'pb-long','Healing Light':'healing-light','Steps of the Fey':'cha-long','Warding Flare':'wis-long','War Priest':'wis-short','Hexblade’s Curse':'one-short','Form of Dread':'pb-long'})[name];
  return {id:`progression-${normalized(owner)}-${level}-${normalized(name)}`,name,owner,level,source,resource,details:`${owner} feature at level ${level}. Consult the linked rules for its effects and any choices.`,wiki:subclassURL(owner,'',source),group:'Subclass features'};
}
function subclassEntries(c){
  const subclass=canonicalSubclass(c.subclass),option=LEVEL_SUBCLASSES.find(s=>s.name===subclass&&s.className===c.class);
  const rows=option?.rows||SUBCLASS_ROWS[subclass]||[];
  const existing=FEATURE_CATALOG.filter(f=>f.group==='Subclass features'&&f.subclass===subclass&&f.name!==subclass);
  const added=rows.flatMap(([level,...names])=>names.filter(name=>!existing.some(e=>normalized(e.name)===normalized(name)&&e.level===level)).map(name=>({
    ...reference(name,subclass,level,option?.source),className:c.class,subclass,wiki:option?.wiki,
    ...(option?.book?{book:option.book}:{}),
    ...(subclass==='Bladesinger'&&name==='Bladesong'?{resource:'int-long'}:{}),
    ...(subclass==='Arcane Archer'&&name==='Arcane Shot'?{resource:'int-short'}:{})
  })));
  return [...existing,...added].filter(f=>!(option?.source==='2014'&&c.class==='Cleric'&&['Divine Strike','Potent Spellcasting'].includes(f.name)));
}
const classNameAliases={'Font of Magic':'Font of Magic / Sorcery Points','Paladin’s Smite':'Paladin’s Smite'};
const multiclassTraining={
  Artificer:{armor:['Light','Medium','Shield'],tools:['Thieves’ Tools','Tinker’s Tools']},
  Barbarian:{armor:['Shield'],martial:true},
  Bard:{armor:['Light'],skill:true,instrument:true},
  Cleric:{armor:['Light','Medium','Shield']},
  Druid:{armor:['Light','Shield']},
  Fighter:{armor:['Light','Medium','Shield'],martial:true},
  Paladin:{armor:['Light','Medium','Shield'],martial:true},
  Ranger:{armor:['Light','Medium','Shield'],martial:true,skill:true},
  Rogue:{armor:['Light'],tools:['Thieves’ Tools'],skill:true},
  Warlock:{armor:['Light']}
};
const orderOptions={
  Cleric:{label:'Divine Order',defense:'Protector',caster:'Thaumaturge',armor:'Heavy'},
  Druid:{label:'Primal Order',defense:'Warden',caster:'Magician',armor:'Medium'}
};
const artificerSubclassTool={Alchemist:'Alchemist’s Supplies',Armorer:'Smith’s Tools',Artillerist:'Woodcarver’s Tools','Battle Smith':'Smith’s Tools'};
const subclassTraining={
  'College of Valor':{armor:['Medium','Shield'],martial:true},
  'College of Swords':{armor:['Medium'],weapons:['scimitar']},
  'Death Domain':{martial:true},
  'Forge Domain':{armor:['Heavy'],tools:['Smith’s Tools']},
  'Nature Domain':{armor:['Heavy']},
  'Order Domain':{armor:['Heavy']},
  'Tempest Domain':{armor:['Heavy'],martial:true},
  'Twilight Domain':{armor:['Heavy'],martial:true},
  'Hexblade Patron':{armor:['Medium','Shield'],martial:true},
  Armorer:{armor:['Heavy']},
  'Battle Smith':{martial:true}
};
const separateClassFeatures=new Set(['channeldivinity','spellcasting','unarmoreddefense','psionicpower','psionicenergydice']);
function matchesProgressionFeature(feature,entry,character){
  const key=normalized(entry.name);
  if(feature.catalogId===entry.id)return true;
  if(normalized(feature.name)!==key)return false;
  if(entry.className&&separateClassFeatures.has(key)){
    const owner=featureById.get(feature.catalogId)?.className||feature.origin?.match(/^Class · ([^·]+?)(?: ·|$)/)?.[1]||character.class;
    return owner===entry.className;
  }
  return true;
}
function grantClassTraining(character,className,grants){
  const source=`Class · ${className}`,training=ensureTraining(character);
  const add=(key,values)=>{
    for(const value of values){
      if(!training[key].includes(value))training[key].push(value);
      if(character.trainingOrigins){
        const origins=(character.trainingOrigins[key]??={})[value]??=[];
        if(!origins.includes(source))origins.push(source);
      }
    }
  };
  add('armor',grants.armor||[]);
  add('tools',(grants.tools||[]).map(trainingKey));
  add('languages',grants.languages||[]);
  add('weapons',grants.weapons||[]);
  if(grants.martial)add('weapons',WEAPONS.filter(w=>w.family.startsWith('Martial')).map(w=>w.id));
}
function resourceUpdates(before,after){
  const entries=characterClasses(after).flatMap(row=>subclassEntries({...after,class:row.class,subclass:row.subclass}));
  if(characterClasses(after).some(row=>canonicalSubclass(row.subclass)==='Rune Knight')){
    for(const f of before.features.filter(f=>f.name.startsWith('Rune: ')&&f.catalogId))
      entries.push({...reference(f.name,'Rune Knight',1,'2014'),id:f.catalogId,className:'Fighter',resource:'rune'});
  }
  const rulesById=new Map(entries.map(entry=>[entry.id,entry]));
  const candidates=[...FEATURE_CATALOG,...entries];
  const updates=[];
  for(const f of before.features){
    const entry=rulesById.get(f.catalogId)||featureById.get(f.catalogId)||candidates
      .find(e=>matchesProgressionFeature(f,e,before)&&featureMatchesCharacter(e,after));
    if(!entry)continue;
    const old=featureFields(entry,before),next=featureFields(entry,after),fields={};
    for(const key of ['maxUses','reset','shortRestRecovery','rollFormula'])if(f[key]===old[key]&&old[key]!==next[key])fields[key]=next[key];
    if(Object.keys(fields).length)updates.push({id:f.id,name:f.name,fields});
  }
  return updates;
}
function classEntries(c,level){
  return classProgression(c,level).features.filter(n=>!/(Subclass|Ability Score Improvement|Epic Boon)/.test(n)).map(name=>{
    if(c.class==='Warlock'&&name==='Mystic Arcanum')name=`Mystic Arcanum (${(level+1)/2}th-level spell)`;
    const entry=FEATURE_CATALOG.find(f=>f.className===c.class&&!f.subclass&&normalized(f.name)===normalized(classNameAliases[name]||name));
    return entry?{...entry,level}:{...reference(name,c.class,level,c.class==='Artificer'?'2014':'2024'),className:c.class,group:'Class features'};
  });
}
export function eligibleFeat(f,c){
  if(!isFeat(f)||f.group==='Fighting styles'||f.campaignGift||f.level>c.level||!featureMatchesCharacter(f,c))return false;
  if((f.published?hasFeat(c,f.name):has(c,f.name))&&f.name!=='Ability Score Improvement'&&!f.repeatable)return false;
  if(f.name.startsWith('Boon of Siberys')&&hasFeat(c,'Boon of Siberys'))return false;
  if(f.requiresFeat&&!hasFeat(c,f.requiresFeat))return false;
  const classes=characterClasses(c),hasClass=(...names)=>classes.some(row=>names.includes(row.class));
  const canCast=()=>classes.some(row=>progressionForClass(c,row.class)?.prepared>0);
  if(f.requiresCasting&&!canCast())return false;
  if(f.requiredAbilities&&!f.requiredAbilities.some(a=>c.stats[a]>=13))return false;
  if(f.requiresDragonmark&&!dragonmarkNames.some(name=>hasFeat(c,name)))return false;
  if(['Dragonmark feats','Planar pact feats'].includes(f.group)&&FEATURE_CATALOG.some(e=>e.group===f.group&&hasFeat(c,e.name)))return false;
  if(f.requiresWeaponMastery&&!has(c,'Weapon Mastery')&&!hasClass('Barbarian','Fighter','Paladin','Ranger','Rogue'))return false;
  if(['War Caster','Elemental Adept','Spell Sniper','Eldritch Adept','Metamagic Adept'].includes(f.name)&&!canCast())return false;
  if(f.name==='Grappler'&&c.stats.str<13&&c.stats.dex<13)return false;
  if(f.name==='Ritual Caster'&&!['int','wis','cha'].some(a=>c.stats[a]>=13))return false;
  const training=trainingFor(c),armor=training.armor.join(' '),weapons=WEAPONS.some(w=>w.family.startsWith('Martial')&&training.weapons.includes(w.id))?'martial':'';
  if(f.name==='Strike of the Giants'&&!/martial/i.test(weapons)&&normalized(c.background)!=='giantfoundling')return false;
  if(f.name==='Rune Shaper'&&!canCast()&&normalized(c.background)!=='runecarver')return false;
  if(f.name==='Initiate of High Sorcery'&&!hasClass('Sorcerer','Wizard')&&normalized(c.background)!=='mageofhighsorcery')return false;
  if(f.name==='Squire of Solamnia'&&!hasClass('Fighter','Paladin')&&normalized(c.background)!=='knightofsolamnia')return false;
  if(f.name==='Purple Dragon Commandant'&&!hasFeat(c,'Purple Dragon Rook')&&!/martial/i.test(weapons))return false;
  if(f.name==='Spellfire Adept'&&!hasFeat(c,'Spellfire Spark')&&!canCast())return false;
  if(f.name==='Fighting Initiate'&&!/martial/i.test(weapons))return false;
  // PHB 2024 prerequisites differ from the abilities a feat can increase.
  const abilityPrereqs={Actor:['cha'],Athlete:['str','dex'],Charger:['str','dex'],'Crossbow Expert':['dex'],'Defensive Duelist':['dex'],'Dual Wielder':['str','dex'],'Great Weapon Master':['str'],'Inspiring Leader':['wis','cha'],'Keen Mind':['int'],Observant:['int','wis'],'Polearm Master':['str','dex'],Sentinel:['str','dex'],Sharpshooter:['dex'],Skulker:['dex'],Speedy:['dex','con']};
  if(abilityPrereqs[f.name]&&!abilityPrereqs[f.name].some(a=>c.stats[a]>=13))return false;
  if(['Heavily Armored','Medium Armor Master'].includes(f.name)&&!/medium/i.test(armor))return false;
  if(f.name==='Heavy Armor Master'&&!/heavy/i.test(armor))return false;
  if(f.name==='Moderately Armored'&&!/light/i.test(armor))return false;
  if(f.name==='Shield Master'&&!/shield/i.test(armor))return false;
  if(f.name==='Squat Nimbleness'&&!featureMatchesCharacter({species:['Dwarf']},c)){
    const size=c.size||SPECIES.find(s=>normalized(s.name)===normalized(c.race))?.size;
    if(size&&!size.includes('Small'))return false;
  }
  return true;
}
export function levelUpPlan(character,selection={}){
  if(character.level>=20)throw new Error('You’ve reached level 20.');
  const className=selection.className??character.class;
  if(!Object.hasOwn(CLASSES,className))throw new Error('Choose a class to advance.');
  const prior=characterClass(character,className);
  if(!prior){
    const missing=multiclassRequirements(character,className);
    if(missing.length)throw new Error(`Multiclass prerequisites: ${missing.map(row=>`${row.class} requires ${row.abilities.map(a=>ABILITIES[a]).join(' or ')} 13`).join(', ')}.`);
  }
  return progressionPlan(character,className,(prior?.level??0)+1,selection);
}
const startingBaseline={slots:Array(9).fill(0),cantrips:0,prepared:0,specific:{}};
export function levelOnePlan(character){
  if(character.level!==1||character.subclass)throw new Error('Initialize progression on a level 1 character without a subclass.');
  return progressionPlan(character,character.class,1,{},true);
}
function progressionPlan(character,className,level,selection,starting=false){
  const prior=characterClass(character,className),entering=!prior;
  const {subclass=prior?.subclass||'',race=character.race,choices:choiceSelections={},land=character.circleLand||'Temperate',abilities={}}=selection;
  const c={...character,class:className,level:character.level+Number(!starting),subclass:canonicalSubclass(subclass),race};
  if(c.subclass&&level<3&&!prior?.subclass)throw new Error('This class gains its subclass at class level 3.');
  const next={...character,race,...(starting?{}:advanceClass(character,className,c.subclass))};
  const knownSubclass=LEVEL_SUBCLASSES.find(s=>s.name===c.subclass);
  if(knownSubclass&&knownSubclass.className!==c.class)throw new Error('That subclass is not available to your class.');
  const before=starting||entering?startingBaseline:classProgression({...c,subclass:prior.subclass},prior.level);
  const after=classProgression(c,level);
  if(c.class==='Artificer')after.prepared=Math.max(1,Math.floor(level/2)+mod(c.stats.int+Number(abilities.int||0)));
  const training=entering?multiclassTraining[className]||{}:null,order=entering?orderOptions[className]:null;
  const orderChoice=choiceSelections.order?.[0];
  const known=new Set(c.features.map(f=>normalized(f.name)));
  const selectedGiant=c.trainingOrigins&&c.race==='Goliath'&&c.features.find(f=>f.name==='Giant Ancestry')?.description;
  const species=FEATURE_CATALOG.filter(f=>f.group==='Species traits'&&featureMatchesCharacter(f,c)&&
    (!selectedGiant||!/(Jaunt|Burn|Chill|Tumble|Endurance|Thunder)$/.test(f.name)||f.name===selectedGiant));
  const all=[...Array.from({length:level},(_,i)=>classEntries(c,i+1)).flat(),...subclassEntries(c),...species];
  const unlock=f=>f.group==='Species traits'?c.level:level;
  const unique=new Map();
  for(const f of all)if(f.level<=unlock(f)&&!c.features.some(old=>matchesProgressionFeature(old,f,character)))unique.set(f.id,f);
  const fresh=[...unique.values()].filter(f=>f.level===unlock(f)&&!['Colossus Slayer','Horde Breaker'].includes(f.name));
  const catchup=[...unique.values()].filter(f=>f.level<unlock(f));
  const projectedStats=Object.fromEntries(Object.entries(c.stats).map(([key,value])=>[key,value+(Number(abilities[key])||0)]));
  const updates=resourceUpdates(character,{...next,stats:projectedStats});
  const choices=[];
  const add=(id,label,count,options,kind='feature')=>{if(count>0)choices.push({id,label,count,kind,options:options.map(o=>typeof o==='string'?{id:o,label:o}:o)});};
  const skillOptions=(allowed=Object.keys(SKILLS))=>(Array.isArray(allowed)?allowed:/^Any/.test(allowed)?Object.keys(SKILLS):String(allowed).split(',').map(s=>s.trim())).filter(s=>Object.hasOwn(SKILLS,s)&&!c.skills.includes(s));
  const toolOptions=EQUIPMENT.filter(e=>e.toolAbility&&!trainingFor(c).tools.includes(e.id)).map(e=>({id:e.name,label:e.name}));
  const artisanNames=new Set(EQUIPMENT.filter(e=>e.group==='Tools').slice(0,17).map(e=>e.name));
  const specialistTool=c.class==='Artificer'&&level===3?artificerSubclassTool[c.subclass]:null;
  if(specialistTool&&trainingFor(c).tools.includes(trainingKey(specialistTool)))add('specialistTool','Artificer specialist artisan’s tool',1,toolOptions.filter(option=>artisanNames.has(option.id)),'tool');
  const baseSkills=CLASS_OPTIONS.find(o=>o.name===c.class);
  if(training?.skill)add('classSkills',`${className} multiclass skill proficiency`,1,skillOptions(baseSkills.skills),'skills');
  if(training?.instrument)add('multiclassTool','Musical instrument proficiency',1,toolOptions.filter(option=>EQUIPMENT.some(e=>e.name===option.id&&e.group==='Musical instruments')),'tool');
  if(!starting&&!entering&&className===character.class&&c.skills.length<baseSkills.skillCount)add('classSkills','Earlier class skill proficiencies',baseSkills.skillCount-c.skills.length,skillOptions(baseSkills.skills),'skills');
  if(order)add('order',order.label,1,[order.defense,order.caster]);
  const expertOptions=()=>[...new Set([...c.skills,...(choiceSelections.classSkills||[])])].filter(s=>!c.expertise.includes(s));
  if((c.class==='Bard'&&[2,9].includes(level))||(c.class==='Rogue'&&level===6))add('expertise','Skill Expertise',2,expertOptions(),'expertise');
  if(c.class==='Ranger'&&[2,9].includes(level))add('expertise','Skill Expertise',level===2?1:2,expertOptions(),'expertise');
  if(c.class==='Ranger'&&level===2&&c.trainingOrigins)add('deftLanguages','Deft Explorer languages',2,[...LANGUAGE_GROUPS.Standard,...LANGUAGE_GROUPS.Rare].filter(language=>!trainingFor(c).languages.includes(language)),'language');
  if(c.class==='Wizard'&&level===2)add('expertise','Scholar Expertise',1,expertOptions().filter(s=>['Arcana','History','Investigation','Medicine','Nature','Religion'].includes(s)),'expertise');
  if(c.class==='Rogue'&&level<6&&(entering||c.expertise.length<2))add('expertise',level===1?'Expertise':'Earlier skill Expertise',entering?2:2-c.expertise.length,expertOptions(),'expertise');
  if(entering&&c.class==='Rogue')add('rogueLanguage','Thieves’ Cant additional language',1,[...LANGUAGE_GROUPS.Standard,...LANGUAGE_GROUPS.Rare].filter(language=>language!=='Thieves’ Cant'&&!trainingFor(c).languages.includes(language)),'language');
  if(c.class==='Barbarian'&&level===3)add('skills','Primal Knowledge skill',1,skillOptions(CLASS_OPTIONS.find(o=>o.name===c.class).skills),'skills');
  if(c.subclass==='College of Lore'&&level===3)add('skills','Bonus Proficiencies',3,skillOptions(),'skills');
  if(c.subclass==='Battle Master'&&level===3)add('skills','Student of War skill',1,skillOptions(['History','Insight','Investigation','Persuasion','Performance']),'skills');
  if(c.subclass==='Battle Master'&&level===3)add('tools','Student of War tool',1,toolOptions.filter(o=>artisanNames.has(o.id)),'tool');
  if(c.subclass==='Fey Wanderer'&&level===3)add('skills','Otherworldly Glamour skill',1,skillOptions(['Deception','Performance','Persuasion']),'skills');
  if(c.subclass==='Knowledge Domain'&&level===3){
    add('knowledge','Blessings of Knowledge (proficiency and Expertise)',2,['Arcana','History','Nature','Religion'].filter(skill=>!c.expertise.includes(skill)),'knowledge');
    add('knowledgeTool','Blessings of Knowledge artisan’s tool',1,toolOptions.filter(tool=>artisanNames.has(tool.label)),'tool');
  }
  if(c.subclass==='Bladesinger'&&level===3)add('bladesingerSkill','Training in War and Song skill',1,skillOptions(['Acrobatics','Athletics','Performance','Persuasion']),'skills');
  if(c.subclass==='Enchanter'&&level===3)add('enchanterSkill','Enchanting Conversationalist skill',1,skillOptions(['Deception','Intimidation','Persuasion']),'skills');
  if(c.subclass==='Vestige Patron'&&level===3){
    add('vestigeForm','Vestige Companion form',1,['Celestial','Fiend','Undead']);
    add('vestigeDomain','Vestige Spells domain',1,['Life Domain','Light Domain','Trickery Domain','War Domain']);
  }
  if(c.subclass==='Nature Domain'&&level===3)add('skills','Acolyte of Nature skill',1,skillOptions(['Animal Handling','Nature','Survival']),'skills');
  if(c.subclass==='Order Domain'&&level===3)add('skills','Order Domain skill',1,skillOptions(['Intimidation','Persuasion']),'skills');
  if(c.subclass==='Peace Domain'&&level===3)add('skills','Implement of Peace skill',1,skillOptions(['Insight','Performance','Persuasion']),'skills');
  if(c.subclass==='Samurai'&&level===3)add('skills','Samurai proficiency',1,[...skillOptions(['History','Insight','Performance','Persuasion']),...['One language (record in Languages)']],'training');
  if(asiLevels(c.class).includes(level)&&!(c.class==='Artificer'&&level===19))add('feat',level===19?'Epic Boon or feat':'Feat or Ability Score Improvement',1,FEATURE_CATALOG.filter(f=>eligibleFeat(f,next)).map(f=>({id:f.id,label:f.name,entry:f})),'feat');
  const featureOptions=group=>FEATURE_CATALOG.filter(f=>f.group===group&&f.level<=level&&!known.has(normalized(f.name)));
  if((level===1&&c.class==='Fighter')||(['Paladin','Ranger'].includes(c.class)&&level===2)||(c.subclass==='Champion'&&level===7)){
    const options=featureOptions('Fighting styles');
    if(level===2)options.push(FEATURE_CATALOG.find(f=>f.className===c.class&&f.name===(c.class==='Paladin'?'Blessed Warrior':'Druidic Warrior')));
    add('style','Fighting Style',1,options.map(f=>({id:f.id,label:f.name,entry:f})));
  }
  if(c.class==='Sorcerer'&&[2,10,17].includes(level))add('metamagic','Metamagic',2,featureOptions('Metamagic').map(f=>({id:f.id,label:f.name,entry:f})));
  if(c.class==='Warlock')add('invocations','Eldritch Invocations',after.specific.eldritch_invocations-(before.specific.eldritch_invocations||0),featureOptions('Eldritch invocations').map(f=>({id:f.id,label:f.name,entry:f})));
  if(c.subclass==='Battle Master'&&[3,7,10,15].includes(level))add('maneuvers','Battle Master maneuvers',level===3?3:2,featureOptions('Maneuvers').map(f=>({id:f.id,label:f.name,entry:f})));
  const masteryCount=row=>row.specific.weapon_mastery||(['Rogue','Ranger','Paladin'].includes(c.class)&&row!==startingBaseline?2:0);
  const mastery=masteryCount(after)-masteryCount(before);
  if(mastery>0)add('mastery',level===1?'Weapon Mastery':'Additional Weapon Mastery',mastery,WEAPONS.filter(w=>
    (!(starting||entering)||trainingFor(c).weapons.includes(w.id)||training?.martial&&w.family.startsWith('Martial'))&&
    (c.class!=='Barbarian'||w.family.includes('melee'))).map(w=>({id:w.name,item:w,label:`${w.name} (${w.mastery})`})),'mastery');
  const chooseEffect=(id,label,options)=>add(id,label,1,options);
  if(c.subclass==='Armorer'&&level===3)chooseEffect('armorModel','Armor Model',['Guardian','Infiltrator']);
  if(c.subclass==='Hunter'&&level===3)chooseEffect('prey','Hunter’s Prey',['Colossus Slayer','Horde Breaker']);
  if(c.subclass==='Hunter'&&level===7)chooseEffect('defense','Defensive Tactics',['Escape the Horde','Multiattack Defense']);
  if(c.subclass==='Path of the Wild Heart'){
    if(level===3)chooseEffect('wildHeart','Rage of the Wilds',['Bear','Eagle','Wolf']);
    if(level===6)chooseEffect('wildHeart','Aspect of the Wilds',['Owl','Panther','Salmon']);
    if(level===14)chooseEffect('wildHeart','Power of the Wilds',['Falcon','Lion','Ram']);
  }
  if(c.subclass==='Draconic Sorcery'&&level===6)chooseEffect('element','Elemental Affinity',['Acid','Cold','Fire','Lightning','Poison']);
  if(c.subclass==='College of Swords'&&level===3)add('swordsStyle','College of Swords style',1,featureOptions('Fighting styles').filter(f=>['Fighting Style: Dueling','Fighting Style: Two-Weapon Fighting'].includes(f.name)).map(f=>({id:f.id,label:f.name,entry:f})));
  if(c.subclass==='Path of the Storm Herald'&&level===3)chooseEffect('storm','Storm Aura environment',['Desert','Sea','Tundra']);
  if(c.subclass==='Rune Knight'&&[3,7,10,15].includes(level))add('runes','Rune Carver runes',level===3?2:1,['Cloud','Fire','Frost','Stone',...(level>=7?['Hill','Storm']:[])].filter(name=>!has(c,`Rune: ${name}`)).map(name=>({id:name,label:name,entry:{...reference(`Rune: ${name}`,'Rune Knight',level,'2014'),resource:'rune'}})));
  if(c.subclass==='Arcane Archer'&&[3,7,10,15,18].includes(level))chooseArcaneShots();
  function chooseArcaneShots(){add('arcaneShots','Arcane Shot options',level===3?2:1,['Banishing','Beguiling','Bursting','Enfeebling','Grasping','Piercing','Seeking','Shadow'].filter(name=>!has(c,`Arcane Shot: ${name}`)).map(name=>({id:name,label:name,entry:{...reference(`Arcane Shot: ${name}`,'Arcane Archer',level),book:'Arcana Unleashed'}})));}
  if(c.subclass==='Cavalier'&&level===3)add('skills','Cavalier proficiency',1,skillOptions(['Animal Handling','History','Insight','Performance','Persuasion']),'skills');
  if(c.subclass==='Phantom'&&level===3)add('phantomTraining','Whispers of the Dead proficiency',1,[...skillOptions(),...toolOptions],'training');
  if(c.subclass==='Divine Soul'&&level===3)chooseEffect('affinity','Divine Magic affinity',['Good','Evil','Law','Chaos','Neutrality']);
  if(c.subclass==='Genie Patron'&&level===3)chooseEffect('genie','Genie kind',['Dao','Djinni','Efreeti','Marid']);
  if(c.class==='Cleric'&&level===7)chooseEffect('blessed','Blessed Strikes',['Divine Strike','Potent Spellcasting']);
  if(c.class==='Druid'&&level===7)chooseEffect('fury','Elemental Fury',['Primal Strike','Potent Spellcasting']);
  const feat=choices.find(ch=>ch.id==='feat')?.options.find(o=>o.id===choiceSelections.feat?.[0]);
  if(feat?.label==='Squat Nimbleness'&&!featureMatchesCharacter({species:['Dwarf']},c)&&(c.size||SPECIES.find(s=>normalized(s.name)===normalized(c.race))?.size)!=='Small')add('featSize','Squat Nimbleness size prerequisite',1,[{id:'Small',label:'My character is Small'}]);
  if(feat?.label==='Skill Expert'){
    add('featSkills','Skill Expert proficiency',1,skillOptions(),'skills');
    add('featExpertise','Skill Expert Expertise',1,[...new Set([...expertOptions(),...(choiceSelections.featSkills||[])])],'expertise');
  }
  if(feat?.label==='Prodigy'){
    add('featSkills','Prodigy proficiency',1,skillOptions(),'skills');
    add('featExpertise','Prodigy Expertise',1,[...new Set([...expertOptions(),...(choiceSelections.featSkills||[])])],'expertise');
    add('featTools','Prodigy tool',1,toolOptions,'tool');
  }
  if(feat?.label==='Martial Adept')add('featManeuvers','Martial Adept maneuvers',2,featureOptions('Maneuvers').map(f=>({id:f.id,label:f.name,entry:f})));
  if(feat?.label==='Metamagic Adept')add('featMetamagic','Metamagic Adept options',2,featureOptions('Metamagic').map(f=>({id:f.id,label:f.name,entry:f})));
  if(feat?.label==='Fighting Initiate')add('featStyle','Fighting Initiate style',1,featureOptions('Fighting styles').map(f=>({id:f.id,label:f.name,entry:f})));
  if(feat?.label==='Eldritch Adept')add('featInvocation','Eldritch Adept invocation',1,featureOptions('Eldritch invocations').filter(f=>c.class==='Warlock'||['Armor of Shadows','Eldritch Mind','Fiendish Vigor','Mask of Many Faces','Misty Visions','Otherworldly Leap'].includes(f.name)).map(f=>({id:f.id,label:f.name,entry:f})));
  if(feat)choices.push(...originFeatChoices(feat.entry,c));
  if(feat?.label==='Resilient')add('resilient','Resilient saving throw proficiency',1,Object.keys(ABILITIES).filter(a=>!c.saves.includes(a)).map(a=>({id:a,label:ABILITIES[a]})),'save');
  const extraSpells=(id,label,count,filter)=>add(id,label,count,SPELL_CATALOG.filter(filter).map(s=>({id:s.id,label:s.name,spell:s})),'spell');
  const style=choices.find(ch=>ch.id==='style')?.options.find(o=>o.id===choiceSelections.style?.[0]);
  const warrior=style?.label==='Blessed Warrior'?'Cleric':style?.label==='Druidic Warrior'?'Druid':'';
  if(warrior)extraSpells('bonusCantrips',`${style.label} cantrips`,2,s=>s.level===0&&s.classes.includes(warrior));
  if(style?.label==='Fighting Style: Arcane Warrior'){
    add('arcaneWarriorAbility','Arcane Warrior casting ability',1,['int','wis','cha'].map(id=>({id,label:ABILITIES[id]})),'castingAbility');
    extraSpells('arcaneWarriorCantrips','Arcane Warrior cantrips',2,s=>s.level===0&&s.classes.includes('Wizard'));
  }
  const invocations=(choiceSelections.invocations||[]).map(id=>featureById.get(id)?.name);
  if(invocations.includes('Pact of the Tome')){
    const alreadyPrepared=new Set(c.spells.filter(spell=>spell.prepared).map(spell=>spellKey(spell.name)));
    extraSpells('tomeCantrips','Pact of the Tome cantrips',3,s=>s.level===0&&s.classes.length&&!alreadyPrepared.has(s.id));
    extraSpells('tomeRituals','Pact of the Tome rituals',2,s=>s.level===1&&s.ritual&&s.classes.length&&!alreadyPrepared.has(s.id));
  }
  if(feat?.label==='Artificer Initiate'){
    extraSpells('bonusCantrips','Artificer Initiate cantrip',1,s=>s.level===0&&artificerSpells.has(s.id));
    extraSpells('bonusSpell','Artificer Initiate spell',1,s=>s.level===1&&artificerSpells.has(s.id));
    add('featTools','Artificer Initiate tool',1,toolOptions.filter(o=>artisanNames.has(o.id)),'tool');
  }
  if(feat?.label==='Wood Elf Magic')extraSpells('bonusCantrips','Wood Elf Magic cantrip',1,s=>s.level===0&&s.classes.includes('Druid'));
  if(feat?.label==='Fey-Touched')extraSpells('bonusSpell','Fey-Touched level 1 spell',1,s=>s.level===1&&['Divination','Enchantment'].includes(s.school));
  if(feat?.label==='Shadow-Touched')extraSpells('bonusSpell','Shadow-Touched level 1 spell',1,s=>s.level===1&&['Illusion','Necromancy'].includes(s.school));
  if(c.subclass==='Nature Domain'&&level===3)extraSpells('natureCantrip','Acolyte of Nature cantrip',1,s=>s.level===0&&s.classes.includes('Druid'));
  if(c.subclass==='Arcana Domain'&&level===3){
    add('arcanaSkill','Student of Arcana skill',1,skillOptions(['Arcana',...baseSkills.skills.split(', ')]),'skills');
    extraSpells('arcanaCantrips','Student of Arcana cantrips',2,s=>s.level===0&&s.classes.includes('Wizard'));
  }
  if(c.subclass==='Death Domain'&&level===3)extraSpells('reaper','Reaper cantrip',1,s=>s.level===0&&s.school==='Necromancy');
  if(c.subclass==='Arcane Archer'&&level===3){
    const lore=['Arcana','Nature'];
    add('archerSkill','Arcane Archer Lore replacement skills',lore.filter(skill=>c.skills.includes(skill)).length,skillOptions(baseSkills.skills),'skills');
    extraSpells('archerCantrip','Arcane Archer Lore cantrip',1,s=>['druidcraft','prestidigitation'].includes(s.id));
  }
  if(c.subclass==='College of Lore'&&level===6)extraSpells('loreSecrets','Magical Discoveries',2,s=>s.level>0&&s.level<=3&&s.classes.some(cls=>['Cleric','Druid','Wizard'].includes(cls)));
  if(c.subclass==='Arcana Domain'&&level===17)for(const tier of [6,7,8,9])extraSpells(`arcaneMastery${tier}`,`Magical Mastery level ${tier} spell`,1,s=>s.level===tier&&s.classes.includes('Wizard'));
  if(c.class==='Wizard'&&level===18)for(const tier of [1,2])extraSpells(`spellMastery${tier}`,`Spell Mastery level ${tier} spell`,1,s=>s.level===tier&&s.classes.includes('Wizard')&&/^(1 )?action$/i.test(s.castingTime));
  if(c.class==='Wizard'&&level===20)extraSpells('signature','Signature Spells',2,s=>s.level===3&&s.classes.includes('Wizard'));
  if(c.race==='High Elf'&&!c.spells.some(s=>(s.origin||'').includes('High Elf')))extraSpells('elfCantrip','High Elf cantrip',1,s=>s.level===0&&s.classes.includes('Wizard'));
  if(feat?.label==='Ritual Caster'||has(c,'Ritual Caster')&&proficiency(c.level)>proficiency(character.level))extraSpells('rituals','Ritual Caster spells',feat?.label==='Ritual Caster'?proficiency(c.level):1,s=>s.level===1&&s.ritual&&s.classes.some(cls=>['Cleric','Druid','Wizard'].includes(cls))&&!c.spells.some(old=>spellKey(old.name)===s.id));
  const savant={Abjurer:'Abjuration',Conjurer:'Conjuration',Diviner:'Divination',Enchanter:'Enchantment',Evoker:'Evocation',Illusionist:'Illusion',Necromancer:'Necromancy',Transmuter:'Transmutation'}[c.subclass];
  const newSpellTier=after.slots.findLastIndex(n=>n>0)>before.slots.findLastIndex(n=>n>0);
  if(savant&&(level===3||newSpellTier))extraSpells('savant',`${savant} Savant spellbook additions`,level===3?2:1,s=>s.level>0&&s.level<=(after.slots.findLastIndex(n=>n>0)+1)&&s.classes.includes('Wizard')&&s.school===savant&&!c.spells.some(old=>spellKey(old.name)===s.id));
  const grant=[];
  const addSpell=(name,origin,at)=>{
    const fromClass=!/lineage|^Fey-Touched|^Shadow-Touched|^Telekinetic|^Telepathic|^Drow High Magic|^Fey Teleportation|^Wood Elf Magic/.test(origin);
    if(at>(fromClass?level:c.level))return;
    const spell=spellByName(name);
    if(!spell)throw new Error(`Missing spell data: ${name}`);
    grant.push({...spell,origin,at,fromClass});
  };
  for(const [at,...names] of SUBCLASS_SPELLS[c.subclass]||[])if(at<=level)for(const name of names)addSpell(name,`${c.subclass} (always prepared)`,at);
  if(c.subclass==='Vestige Patron'){
    const domain=choiceSelections.vestigeDomain?.[0]||c.features.find(f=>f.name.startsWith('Vestige Spells domain: '))?.name.split(': ')[1];
    if(['Life Domain','Light Domain','Trickery Domain','War Domain'].includes(domain)){
      for(const [at,...names] of SUBCLASS_SPELLS[domain])if(at<=level)for(const name of names)addSpell(name,`Vestige Spells · ${domain} (always prepared)`,at);
    }
  }
  if(c.subclass==='Circle of the Land')for(const [at,...names] of LAND_SPELLS[land]||[])if(at<=level)for(const name of names)addSpell(name,`Circle of the Land: ${land} (always prepared)`,at);
  for(const [at,...names] of LINEAGE_SPELLS[c.race]||[])if(at<=c.level)for(const name of names)addSpell(name,`${c.race} lineage`,at);
  for(const [at,...names] of LEGACY_LINEAGE_SPELLS[c.race]||[])if(at<=c.level)for(const name of names)addSpell(name,`${c.race} lineage (2014 rules)${c.race==='Yuan-ti'&&name==='Animal Friendship'?' · at will, snakes only':''}`,at);
  if(c.class==='Ranger')addSpell('Hunter’s Mark','Favored Enemy (always prepared)',1);
  if(c.subclass==='Arcane Trickster')addSpell('Mage Hand','Arcane Trickster (bonus cantrip)',3);
  if(c.class==='Druid')addSpell('Speak with Animals','Druidic (always prepared)',1);
  if(c.class==='Druid'&&level>=2)addSpell('Find Familiar','Wild Companion (spell slot or Wild Shape)',2);
  if(c.class==='Paladin'&&level>=2)addSpell('Divine Smite','Paladin’s Smite (always prepared)',2);
  if(c.class==='Paladin'&&level>=5)addSpell('Find Steed','Faithful Steed (always prepared)',5);
  if(c.class==='Warlock'&&level>=9)addSpell('Contact Other Plane','Contact Patron (always prepared)',9);
  if(c.class==='Bard'&&level>=20)for(const name of ['Power Word Heal','Power Word Kill'])addSpell(name,'Words of Creation (always prepared)',20);
  if(c.subclass==='Circle of the Stars')for(const name of ['Guidance','Guiding Bolt'])addSpell(name,'Star Map (always prepared)',3);
  if(c.subclass==='College of Spirits')addSpell('Guidance','Guiding Whispers',3);
  if(c.subclass==='Grave Domain')addSpell('Spare the Dying','Circle of Mortality',3);
  if(c.subclass==='Drakewarden')addSpell('Thaumaturgy','Draconic Gift',3);
  if(c.subclass==='Lunar Sorcery')addSpell('Sacred Flame','Moon Fire',3);
  if(c.subclass==='Shadow Magic'&&level>=3)addSpell('Darkness','Eyes of the Dark',3);
  if(c.subclass==='Divine Soul'&&choiceSelections.affinity?.[0])addSpell(({Good:'Cure Wounds',Evil:'Inflict Wounds',Law:'Bless',Chaos:'Bane',Neutrality:'Protection from Evil and Good'})[choiceSelections.affinity[0]],'Divine Magic (always prepared)',3);
  if(c.subclass==='Fathomless Patron'&&level>=10)addSpell('Evard’s Black Tentacles','Grasping Tentacles (always prepared)',10);
  if(feat?.label==='Fey-Touched')addSpell('Misty Step','Fey-Touched (one free casting per Long Rest)',level);
  if(feat?.label==='Shadow-Touched')addSpell('Invisibility','Shadow-Touched (one free casting per Long Rest)',level);
  if(feat?.label==='Telekinetic')addSpell('Mage Hand','Telekinetic',level);
  if(feat?.label==='Telepathic')addSpell('Detect Thoughts','Telepathic (one free casting per Long Rest)',level);
  if(feat?.label==='Drow High Magic'){
    addSpell('Detect Magic','Drow High Magic (at will)',level);
    for(const name of ['Levitate','Dispel Magic'])addSpell(name,'Drow High Magic (one free casting per Long Rest)',level);
  }
  if(feat?.label==='Fey Teleportation')addSpell('Misty Step','Fey Teleportation (one free casting per Short or Long Rest)',level);
  if(feat?.label==='Wood Elf Magic')for(const name of ['Longstrider','Pass without Trace'])addSpell(name,'Wood Elf Magic (one free casting per Long Rest)',level);
  const maxSpellLevel=after.slots.findLastIndex(n=>n>0)+1;
  const expanded=new Set((LEGACY_EXPANDED_SPELLS[c.subclass]||[]).filter(([at])=>at<=level).flatMap(([, ...names])=>names.map(spellKey)));
  const genie=choiceSelections.genie?.[0]||c.genieKind||'Dao';
  if(c.subclass==='Genie Patron')for(const [at,...names] of GENIE_SPELLS[genie]||[])if(at<=level)for(const name of names)expanded.add(spellKey(name));
  const spellClass=isThirdCaster(c.class,c.subclass)?c.class==='Monk'?'Sorcerer':'Wizard':c.class;
  const permitted=s=>c.class==='Artificer'?artificerSpells.has(s.id):s.classes.includes(spellClass)||(c.class==='Sorcerer'&&c.subclass==='Divine Soul'&&s.classes.includes('Cleric'))||expanded.has(s.id)||(c.class==='Bard'&&level>=10&&s.classes.some(cls=>['Cleric','Druid','Wizard'].includes(cls)));
  const available=SPELL_CATALOG.filter(s=>s.level<=maxSpellLevel&&permitted(s));
  const arcanum=c.class==='Warlock'&&[11,13,15,17].includes(level)?(level+1)/2:0;
  const arcanumOptions=arcanum?SPELL_CATALOG.filter(s=>s.level===arcanum&&permitted(s)):[];
  const recordedOrder=orderOptions[className];
  const earlierCantrip=Number(!!recordedOrder&&c.features.some(f=>f.name===recordedOrder.label&&f.description.startsWith(recordedOrder.caster)));
  const bonusCantrips=earlierCantrip+Number(!!order&&orderChoice===order.caster);
  const ordinaryCantrips=after.cantrips-Number(c.subclass==='Arcane Trickster'&&level>=3)+bonusCantrips;
  const beforeCantrips=before.cantrips-Number(prior?.subclass==='Arcane Trickster'&&prior.level>=3)+earlierCantrip;
  const requiresSpellChoices=entering||Boolean(character.multiclass?.length&&!before.prepared&&after.prepared);
  return {character:next,className,subclass:c.subclass,classLevel:level,hitDie:classHitDie(character,className),entering,training,order,before,after,fresh,catchup,updates,choices,grant,available,maxSpellLevel,arcanum,arcanumOptions,land,requiresSpellChoices,
    ordinaryCantrips,bonusCantrips,cantripGain:Math.max(0,ordinaryCantrips-beforeCantrips),spellGain:c.class==='Wizard'?(level===1?6:2):Math.max(0,after.prepared-before.prepared),
    hpBonuses:{dwarvenToughness:/dwarf/i.test(c.race)?1:0,tough:has(c,'Tough')?2:0,newTough:feat?.label==='Tough'?2*next.level:0},
    warnings:[...(!LEVEL_SUBCLASSES.some(s=>s.name===c.subclass&&s.className===c.class)&&level>=3?['This subclass has no bundled progression. Add its unlocks below using your book.']:[]),...(!species.length&&!LEGACY_LINEAGE_SPELLS[c.race]?['This species has no bundled progression. Add its unlocks below using your book.']:[])]};
}
export function originFeatChoices(entry,c){
  const tools=TOOL_NAMES.filter(name=>!trainingFor(c).tools.includes(trainingKey(name)));
  const options=names=>names.map(id=>({id,label:id}));
  const choice=(id,label,count,kind,options)=>({id,label,count,kind,options});
  if(entry.name==='Skilled')return [choice('featSkills','Skilled proficiencies',3,'training',options([...Object.keys(SKILLS).filter(s=>!c.skills.includes(s)),...tools]))];
  const group=entry.name==='Crafter'?'Tools':entry.name==='Musician'?'Musical instruments':'';
  if(group){
    const eligible=EQUIPMENT.filter(e=>e.group===group);
    const names=new Set((group==='Tools'?eligible.slice(0,17):eligible).map(e=>e.name));
    return [choice('featTools',`${entry.name} proficiencies`,3,'tool',options(tools.filter(name=>names.has(name))))];
  }
  const list=entry.name.match(/^Magic Initiate \((\w+)\)/)?.[1];
  if(!list)return [];
  const spells=level=>SPELL_CATALOG.filter(s=>s.level===level&&s.classes.includes(list)).map(s=>({id:s.id,label:s.name,spell:s}));
  return [choice('bonusCantrips',`${entry.name} cantrips`,2,'spell',spells(0)),choice('bonusSpell',`${entry.name} level 1 spell`,1,'spell',spells(1))];
}
export function addProgressionFeature(c,entry,origin=''){
  if(!entry.repeatable&&c.features.some(f=>{
    if(!matchesProgressionFeature(f,entry,c))return false;
    const previous=f.catalogId&&featureById.get(f.catalogId);
    return !previous||isFeat(previous)===isFeat(entry);
  }))return;
  const feature={id:uid(),used:0,...featureFields(entry,c),catalogId:entry.id,...(origin?{origin}:{})};
  c.features.push(feature);
  return feature;
}
export function addProgressionSpell(c,spell,origin='',prepared=true){
  const existing=c.spells.find(s=>spellKey(s.name)===spell.id);
  if(existing){
    if(prepared)existing.prepared=true;
    if(origin){existing.origins=[...new Set([...(existing.origins||[]),...(existing.origin?[existing.origin]:[]),origin])];existing.origin=existing.origin||origin;}
    return existing;
  }
  const {classes,id,source,ritual,at,fromClass,...fields}=spell;
  const stored={...fields,id:uid(),prepared,origin,notes:`${origin?origin+'\n\n':''}${spell.notes}`};
  c.spells.push(stored);
  return stored;
}
export const isClassSpell=s=>s.classPrepared!==undefined||!s.origin;
export const isClassPrepared=s=>s.classPrepared??s.prepared;
export const grantedSpell=(plan,id)=>plan.grant.some(spell=>spell.id===id&&spell.fromClass);
export function classSpellState(spell,character,className){
  if(spell.classSpells)return spell.classSpells[className];
  if(spell.origin===className||spell.origins?.includes(className))return {prepared:isClassPrepared(spell)};
  if(className===character.class&&(spell.classPrepared!==undefined||!spell.origin&&progressionForClass(character,className)?.prepared>0))return {prepared:isClassPrepared(spell)};
}
export function spellCastingStats(character,className){
  const ability=castingAbility(character,className),bonus=proficiency(character.level);
  return {ability,attack:bonus+abilityCheckBonus(character,ability),dc:8+bonus+mod(character.stats[ability])};
}
export function readySpellClasses(spell,character){
  return characterClasses(character).filter(({class:name})=>{
    const state=classSpellState(spell,character,name);
    return state?.prepared||state?.granted;
  }).map(row=>row.class);
}
export function setClassSpell(spell,character,className,state){
  if(!spell.classSpells){
    spell.classSpells={};
    const old=characterClasses(character);
    // A legacy boolean belongs to the primary class. Explicit class sources
    // are kept when an additional class starts using the same spell.
    for(const row of old){
      if(spell.origin===row.class||spell.origins?.includes(row.class)||row.class===character.class&&spell.classPrepared!==undefined)
        spell.classSpells[row.class]={prepared:isClassPrepared(spell)};
    }
  }
  if(state){
    spell.classSpells[className]=state;
    spell.origins=[...new Set([...(spell.origins||[]),...(spell.origin?[spell.origin]:[]),className])];
  }else{
    delete spell.classSpells[className];
    if(spell.origins)spell.origins=spell.origins.filter(origin=>origin!==className);
  }
  const primary=spell.classSpells[character.class]?.prepared;
  if(primary!==undefined)spell.classPrepared=primary;else delete spell.classPrepared;
  spell.prepared=Boolean(spell.manualPrepared||spell.origin||spell.castingGrants?.length||Object.values(spell.classSpells).some(row=>row.prepared||row.granted));
}
export function applyLevelUp(character,selection={}){
  const plan=levelUpPlan(character,selection),c=structuredClone(character),chosen=selection.choices||{};
  const {className,subclass,classLevel,entering,hitDie}=plan;
  if(!Number.isInteger(selection.hpGain)||selection.hpGain<1||selection.hpGain>999)throw new Error('Enter HP gained from your Hit Die, including Constitution (1–999).');
  if((selection.requireFullProgression||className!==c.class)&&selection.hpGain>Math.max(1,hitDie+mod(c.stats.con)))throw new Error('HP gain exceeds your Hit Die plus Constitution modifier.');
  if(classLevel>=3&&!subclass)throw new Error('Choose a subclass for class level 3.');
  if(['Elf','Gnome','Tiefling'].includes(plan.character.race))throw new Error('Choose your species lineage to unlock its magic.');
  const picked=[];
  const pending=[];
  for(const choice of plan.choices){
    if(choice.options.length<choice.count&&(selection.manualChoiceIds||[]).includes(choice.id)){pending.push(choice);continue;}
    const ids=chosen[choice.id]||[];
    if(ids.length!==choice.count||new Set(ids).size!==ids.length)throw new Error(`Choose ${choice.count} option(s) for ${choice.label}.`);
    for(const id of ids){const option=choice.options.find(o=>o.id===id);if(!option)throw new Error(`Invalid choice for ${choice.label}.`);picked.push({choice,option});}
  }
  const abilityIncreases=selection.abilities||{};
  for(const [ability,amount] of Object.entries(abilityIncreases))if(!Object.hasOwn(ABILITIES,ability)||!Number.isInteger(amount)||amount<0||amount>2)throw new Error('Choose valid ability increases.');
  const feat=picked.find(p=>p.choice.kind==='feat')?.option;
  const points=Object.values(abilityIncreases).reduce((a,b)=>a+b,0);
  if(feat?.label==='Ability Score Improvement'&&points!==2)throw new Error('Ability Score Improvement grants two ability score points.');
  if(!feat&&points)throw new Error('No ability increase is available at this level.');
  if(feat&&feat.label!=='Ability Score Improvement'&&points>1)throw new Error('Review the feat’s ability increase; choose at most one point.');
  if(feat&&feat.label!=='Ability Score Improvement'){
    const allowed=featAbilityChoices(feat.entry);
    if(points!==(allowed.length?1:0)||Object.entries(abilityIncreases).some(([a,n])=>n&&!allowed.includes(a)))throw new Error(allowed.length?'Choose the +1 ability increase allowed by this feat.':'This Origin feat does not grant an ability increase.');
    if(feat.label==='Resilient'&&abilityIncreases[chosen.resilient?.[0]]!==1)throw new Error('Resilient must increase the ability for its selected saving throw.');
  }
  const cap=feat?.entry.group==='Epic boons'?30:20;
  for(const [ability,amount] of Object.entries(abilityIncreases))if(amount&&c.stats[ability]+amount>cap)throw new Error(`This increase cannot raise ${ABILITIES[ability]} above ${cap}.`);
  const beforeCon=mod(c.stats.con);
  for(const [ability,amount] of Object.entries(abilityIncreases))c.stats[ability]+=amount;
  c.race=plan.character.race;
  if(subclass==='Circle of the Land'){if(!Object.hasOwn(LAND_SPELLS,plan.land))throw new Error('Choose a Circle of the Land terrain.');c.circleLand=plan.land;}
  if(className==='Barbarian'&&classLevel===20)for(const a of ['str','con'])c.stats[a]=Math.min(25,c.stats[a]+4);
  if(className==='Monk'&&classLevel===20)for(const a of ['dex','wis'])c.stats[a]=Math.min(25,c.stats[a]+4);
  const {dwarvenToughness,tough,newTough}=plan.hpBonuses;
  const hpExtra=dwarvenToughness+tough+(mod(c.stats.con)-beforeCon)*plan.character.level;
  levelUp(c,selection.hpGain,{className,subclass});
  c.maxHp=Math.min(9999,c.maxHp+hpExtra);c.hp=Math.min(c.maxHp,c.hp+hpExtra);
  if(entering){
    const languages=className==='Rogue'?['Thieves’ Cant']:className==='Druid'?['Druidic']:[];
    if(multiclassTraining[className]||languages.length)grantClassTraining(c,className,{...plan.training,languages});
    const addedArmor=(plan.training.armor||[]).filter(name=>!trainingFor(character).armor.includes(name));
    if(addedArmor.length)c.armorProficiencies=[c.armorProficiencies,...addedArmor].filter(Boolean).join(', ');
    if(plan.training.martial&&WEAPONS.some(w=>w.family.startsWith('Martial')&&!trainingFor(character).weapons.includes(w.id)))c.weaponProficiencies=[c.weaponProficiencies,'Martial weapons'].filter(Boolean).join('; ');
    if(plan.training.tools)c.toolProficiencies=[c.toolProficiencies,...plan.training.tools.filter(tool=>!trainingFor(character).tools.includes(trainingKey(tool)))].filter(Boolean).join('; ');
    if(languages.length)c.languages=[...new Set([...trainingFor(character).languages,...languages])].join(', ');
  }
  const order=plan.order,orderChoice=chosen.order?.[0];
  if(order&&orderChoice===order.defense)grantClassTraining(c,className,{armor:[order.armor],martial:true});
  const fixedIds=plan.fresh.map(f=>f.id);
  const grantIds=new Set(selection.requireFullProgression||entering?[...fixedIds,...(selection.featureIds||[])]:selection.featureIds??fixedIds);
  for(const id of grantIds){
    const entry=[...plan.fresh,...plan.catchup].find(f=>f.id===id);
    if(!entry)throw new Error('That feature is not available at this level.');
    const source=entry.group==='Species traits'?`Species · ${entry.owner}`:`Class · ${className}${entry.subclass?` · ${entry.subclass}`:''}`;
    const feature=addProgressionFeature(c,entry,source);
    if(feature&&orderChoice&&entry.name===order?.label)feature.description=`${orderChoice} · ${entry.details}`;
  }
  if(selection.requireFullProgression||selection.updateResources!==false)for(const update of resourceUpdates(character,c)){
    const f=c.features.find(f=>f.id===update.id);
    Object.assign(f,update.fields);
    f.used=Math.min(f.used,f.maxUses);
  }
  for(const {choice,option} of picked){
    if(choice.kind==='skills')c.skills.push(option.id);
    else if(choice.kind==='training'&&Object.hasOwn(SKILLS,option.id))c.skills.push(option.id);
    else if(choice.kind==='tool'||choice.kind==='training'){const tools=ensureTraining(c).tools,id=trainingKey(option.id);if(!tools.includes(id))tools.push(id);c.toolProficiencies=[c.toolProficiencies,option.id].filter(Boolean).join('; ');}
    else if(choice.kind==='language'){
      const training=ensureTraining(c);
      if(!training.languages.includes(option.id))training.languages.push(option.id);
      c.languages=training.languages.join(', ');
    }
    else if(choice.kind==='knowledge'){if(!c.skills.includes(option.id))c.skills.push(option.id);c.expertise.push(option.id);}
    else if(choice.kind==='save')c.saves.push(option.id);
    else if(choice.kind==='expertise')c.expertise.push(option.id);
    else if(choice.kind==='mastery')addProgressionFeature(c,{...reference(`Weapon Mastery: ${option.label}`,className,classLevel),details:`Selected mastery: ${option.label}. Apply the mastery property when using this weapon.`},`Class · ${className}`);
    else if(option.entry&&option.label!=='Ability Score Improvement')addProgressionFeature(c,{...option.entry,...(choice.id==='runes'?{className,subclass}:{})},`${choice.kind==='feat'?'Feat':'Class'} · ${className}`);
    else if(!option.entry&&!['spell','castingAbility'].includes(choice.kind)&&choice.id!=='order')addProgressionFeature(c,reference(`${choice.label}: ${option.label}`,subclass||className,classLevel),`Class · ${className}`);
    if(choice.id==='genie')c.genieKind=option.id;
    if(c.trainingOrigins){
      const isSkill=Object.hasOwn(SKILLS,option.id);
      const group=choice.kind==='save'?'saves':choice.kind==='language'?'languages':
        choice.kind==='training'?(isSkill?'skills':'tools'):choice.kind==='tool'?'tools':
        ['skills','expertise'].includes(choice.kind)?choice.kind:'';
      if(group){
        const source=choice.id.startsWith('feat')&&feat?`Feat · ${feat.label}`:`Class · ${className}`;
        const origins=(c.trainingOrigins[group]??={})[group==='tools'?trainingKey(option.id):option.id]??=[];
        if(!origins.includes(source))origins.push(source);
      }
    }
  }
  for(const choice of pending)addProgressionFeature(c,{...reference(`Pending choice: ${choice.label}`,className,classLevel),details:`Choose ${choice.count} option(s) for ${choice.label}. The sheet has too few eligible recorded proficiencies/options. Review your book and fill in the missing selections and sheet entries.`});
  c.maxHp+=newTough;c.hp+=newTough;
  if(className==='Monk'&&classLevel===14)c.saves=Object.keys(ABILITIES);
  if(className==='Rogue'&&classLevel===15)c.saves=[...new Set([...c.saves,'wis','cha'])];
  if(subclass==='Scout'&&classLevel===3)for(const skill of ['Nature','Survival']){if(!c.skills.includes(skill))c.skills.push(skill);if(!c.expertise.includes(skill))c.expertise.push(skill);}
  if(subclass==='Arcane Archer'&&classLevel===3)for(const skill of ['Arcana','Nature'])if(!c.skills.includes(skill))c.skills.push(skill);
  if(classLevel===3){
    const grants=subclassTraining[subclass],tool=className==='Artificer'&&artificerSubclassTool[subclass];
    if(grants)grantClassTraining(c,className,grants);
    if(tool&&!trainingFor(c).tools.includes(trainingKey(tool)))grantClassTraining(c,className,{tools:[tool]});
  }
  const state=spell=>classSpellState(spell,character,className);
  const belongs=spell=>!entering&&state(spell)?.prepared!==undefined;
  const classKeys=new Set(character.spells.filter(belongs).map(s=>spellKey(s.name)));
  const swaps=[];
  for(const [oldField,newField,cantrip] of [['replaceSpellId','replacementSpellId',false],['replaceCantripId','replacementCantripId',true]]){
    const oldId=selection[oldField],newId=selection[newField];if(!oldId&&!newId)continue;
    const old=character.spells.find(s=>s.id===oldId&&belongs(s)&&(s.level===0)===cantrip&&!plan.grant.some(g=>g.id===spellKey(s.name))&&plan.available.some(a=>a.id===spellKey(s.name)));
    const next=plan.available.find(s=>s.id===newId&&(s.level===0)===cantrip&&!classKeys.has(s.id)&&!plan.grant.some(g=>g.id===s.id));
    if(!cantrip&&!['Bard','Sorcerer','Warlock','Fighter','Rogue','Monk'].includes(className)||!old||!next)throw new Error('Choose both an eligible old spell and a new replacement, or leave both replacement fields blank.');
    swaps.push({old,next});
  }
  const ids=selection.spellIds||[];
  if(swaps.some(s=>ids.includes(s.next.id)))throw new Error('Select a replacement spell only in its replacement field.');
  if(new Set(ids).size!==ids.length)throw new Error('Choose each spell once.');
  if(picked.some(row=>row.choice.id.startsWith('tome')&&(ids.includes(row.option.id)||swaps.some(s=>s.next.id===row.option.id))))
    throw new Error('Choose different spells for Pact of the Tome and your ordinary spell selections.');
  const available=[...plan.available,...plan.arcanumOptions];
  const spells=ids.map(id=>{const s=available.find(s=>s.id===id);if(!s)throw new Error('That spell is not available to this class at this level.');return s;});
  if(spells.some(s=>s.level<=plan.maxSpellLevel&&grantedSpell(plan,s.id)))throw new Error('A spell already granted by this class does not use its ordinary spell allowance.');
  const newCantrips=spells.filter(s=>s.level===0&&!classKeys.has(s.id));
  // Missing older selections can be filled now; existing species/feat spells do
  // not consume the class allowance when their origin is known.
  const classCantrips=character.spells.filter(s=>s.level===0&&belongs(s)&&plan.available.some(a=>a.id===spellKey(s.name))&&!grantedSpell(plan,spellKey(s.name))).length;
  if(newCantrips.length>Math.max(plan.cantripGain,plan.ordinaryCantrips-classCantrips))throw new Error('Too many new class cantrips selected.');
  const ordinary=spells.filter(s=>s.level>0&&s.level<=plan.maxSpellLevel);
  const grantedKeys=new Set(plan.grant.map(s=>s.id));
  const existingClass=character.spells.filter(s=>s.level>0&&belongs(s)&&(s.classSpells||s.classPrepared!==undefined||!grantedKeys.has(spellKey(s.name)))&&plan.available.some(a=>a.id===spellKey(s.name)));
  const newOrdinary=ordinary.filter(s=>!classKeys.has(s.id));
  const preparedCaster=['Cleric','Druid','Paladin','Ranger','Wizard','Artificer'].includes(className);
  const knownCaster=plan.after.prepared>0&&!preparedCaster;
  if(knownCaster&&newOrdinary.length>Math.max(plan.spellGain,plan.after.prepared-existingClass.length))throw new Error('Too many new class spells selected.');
  const wizardSpecial=picked.filter(p=>p.choice.id==='signature'||p.choice.id.startsWith('spellMastery')).map(p=>p.option.spell);
  if(className==='Wizard'&&new Set([...ordinary,...wizardSpecial].filter(s=>!classKeys.has(s.id)).map(s=>s.id)).size>plan.spellGain)throw new Error(`A Wizard adds ${plan.spellGain} spells to their spellbook at this class level, in addition to Savant spells.`);
  if(picked.some(p=>p.choice.id==='savant'&&ids.includes(p.option.id)))throw new Error('Choose different spells for Savant and your ordinary spellbook additions.');
  const prepared=selection.preparedIds??existingClass.filter(s=>state(s).prepared).map(s=>s.id);
  if(!Array.isArray(prepared)||new Set(prepared).size!==prepared.length||prepared.some(id=>!existingClass.some(s=>s.id===id)))throw new Error('Choose valid prepared spells.');
  const alreadyPrepared=new Set(existingClass.filter(s=>prepared.includes(s.id)).map(s=>spellKey(s.name)));
  const savantIds=picked.filter(p=>p.choice.id==='savant').map(p=>p.option.id);
  const preparable=[...newOrdinary.map(s=>s.id),...savantIds].filter(id=>!classKeys.has(id));
  const prepareNewIds=selection.prepareNewIds;
  if(prepareNewIds!==undefined&&(!Array.isArray(prepareNewIds)||prepareNewIds.some(id=>!preparable.includes(id))))throw new Error('Choose only newly learned spells in new spell preparations.');
  const prepareNew=id=>className!=='Wizard'||(prepareNewIds?prepareNewIds.includes(id):selection.prepareNewSpells===true);
  const newPrepared=new Set([...preparable.filter(prepareNew),...picked.filter(p=>p.choice.id.startsWith('spellMastery')).map(p=>p.option.id).filter(id=>!alreadyPrepared.has(id))]).size;
  if(selection.requireFullProgression||plan.requiresSpellChoices){
    if(newCantrips.length!==plan.cantripGain)throw new Error(`Choose ${plan.cantripGain} new class cantrip(s).`);
    if(className==='Wizard'||knownCaster){
      if(newOrdinary.length!==plan.spellGain)throw new Error(`Choose ${plan.spellGain} new class spell(s).`);
    }
    if(preparedCaster&&prepared.length+newPrepared!==plan.after.prepared)throw new Error(`Prepare ${plan.after.prepared} class spells before continuing.`);
  }
  if(preparedCaster&&prepared.length+newPrepared>plan.after.prepared)throw new Error(`Prepare at most ${plan.after.prepared} class spells. Uncheck earlier preparations to make room.`);
  for(const spell of existingClass){
    const stored=c.spells.find(s=>s.id===spell.id),ready=prepared.includes(spell.id);
    setClassSpell(stored,c,className,{...state(spell),prepared:ready});
  }
  const arcanum=spells.filter(s=>plan.arcanum&&s.level===plan.arcanum);
  if(plan.arcanum&&arcanum.length!==1)throw new Error(`Choose one level ${plan.arcanum} Mystic Arcanum spell.`);
  const addSpell=(spell,origin='',prepared=true)=>addProgressionSpell(c,spell,origin,prepared);
  const preserveLegacySource=spell=>{
    const old=c.spells.find(s=>spellKey(s.name)===spell.id);
    if(!old||old.classSpells||old.origin||className===c.class)return;
    if(progressionForClass(character,c.class)?.prepared)setClassSpell(old,c,c.class,{prepared:isClassPrepared(old)});
    else if(old.prepared)old.manualPrepared=true;
  };
  const addClassSpell=(spell,ready)=>{
    preserveLegacySource(spell);
    const stored=addSpell(spell,'',false);
    setClassSpell(stored,c,className,{...classSpellState(stored,c,className),prepared:ready});
  };
  const grantClassSpell=(spell,origin)=>{
    preserveLegacySource(spell);
    const stored=addSpell(spell,origin);
    const old=character.spells.find(s=>s.id===stored.id);
    setClassSpell(stored,c,className,{...classSpellState(stored,c,className),...(old?classSpellState(old,character,className):{}),granted:true});
    return stored;
  };
  const trackCasting=(stored,origin,ability,feature,mode='free')=>{
    if(!stored.castingGrants?.some(grant=>grant.origin===origin&&grant.featureId===feature?.id))
      (stored.castingGrants??=[]).push({origin,ability,mode,...(feature?{featureId:feature.id}:{})});
  };
  const classAbility=castingAbility(c,className);
  for(const spell of spells){
    if(spell.level>plan.maxSpellLevel){
      const resource=c.features.find(f=>f.name===`Mystic Arcanum (${plan.arcanum}th-level spell)`);
      if(resource){
        resource.description+=`\nSelected spell: ${spell.name}.`;
        trackCasting(addSpell(spell,'Mystic Arcanum'),'Mystic Arcanum',classAbility,resource,'free-only');
      }else addSpell(spell,'Mystic Arcanum');
    }
    else addClassSpell(spell,spell.level===0||prepareNew(spell.id));
  }
  if(subclass==='Necromancer'&&classLevel===3&&!classKeys.has('findfamiliar')&&!ordinary.some(spell=>spell.id==='findfamiliar'))addClassSpell(spellByName('Find Familiar'),false);
  for(const {old,next} of swaps){
    const stored=c.spells.find(s=>s.id===old.id);
    setClassSpell(stored,c,className,undefined);
    if(!stored.origin&&!stored.manualPrepared&&!stored.castingGrants?.length&&!Object.keys(stored.classSpells).length)c.spells=c.spells.filter(s=>s.id!==old.id);
    addClassSpell(next,true);
  }
  for(const {choice,option} of picked)if(choice.kind==='spell'){
    const mastery=choice.id.startsWith('spellMastery');
    if(choice.id==='savant'||mastery)addClassSpell(option.spell,mastery||prepareNew(option.id));
    else if(choice.id.startsWith('tome'))grantClassSpell(option.spell,'Pact of the Tome');
    else if(choice.id==='arcaneWarriorCantrips')trackCasting(addSpell(option.spell,'Arcane Warrior'),'Arcane Warrior',chosen.arcaneWarriorAbility[0],undefined,'at-will');
    else if(['signature','loreSecrets','arcanaCantrips','arcaneMastery6','arcaneMastery7','arcaneMastery8','arcaneMastery9','natureCantrip','reaper','archerCantrip'].includes(choice.id)||choice.id==='bonusCantrips'&&['Blessed Warrior','Druidic Warrior'].includes(chosen.style?.map(id=>featureById.get(id)?.name)[0]))
      grantClassSpell(option.spell,choice.label);
    else addSpell(option.spell,choice.label);
    if(mastery)c.spells.find(s=>spellKey(s.name)===option.id).prepared=true;
  }
  for(const {choice,option} of picked)if(choice.id==='invocations'){
    const spellName=({'Pact of the Chain':'Find Familiar','Armor of Shadows':'Mage Armor','Misty Visions':'Silent Image','Fiendish Vigor':'False Life','Otherworldly Leap':'Jump','Ascendant Step':'Levitate','Master of Myriad Forms':'Alter Self','One with Shadows':'Invisibility','Visions of Distant Realms':'Arcane Eye','Whispers of the Grave':'Speak with Dead'})[option.label];
    if(spellName)trackCasting(addSpell(spellByName(spellName),option.label),option.label,classAbility,undefined,'at-will');
  }
  for(const {choice,option} of picked)if(choice.id==='signature'||choice.id.startsWith('spellMastery')){
    const resource=addProgressionFeature(c,{...reference(`${choice.label}: ${option.label}`,'Wizard',classLevel),details:`Selected ${option.label}. ${choice.id==='signature'?'One free level 3 casting per Short or Long Rest.':'Eligible at-will casting while prepared; consult Spell Mastery restrictions.'}`,resource:choice.id==='signature'?'one-short':undefined});
    if(resource&&choice.id==='signature')trackCasting(c.spells.find(s=>spellKey(s.name)===option.id),choice.label,classAbility,resource,'free-only');
  }
  const restGrants={"Paladin’s Smite":'Paladin’s Smite','Faithful Steed':'Faithful Steed','Favored Enemy':'Favored Enemy','Contact Patron':'Contact Patron','Star Map':'Star Map','Wild Companion':'Wild Shape'};
  for(const spell of plan.grant){
    if(!spell.fromClass){
      addSpell(spell,spell.origin);
      continue;
    }
    const stored=grantClassSpell(spell,spell.origin);
    const pair=Object.entries(restGrants).find(([origin])=>spell.origin.startsWith(origin));
    const feature=pair&&c.features.find(f=>f.name===pair[1]&&f.maxUses>0);
    if(feature&&spell.level>0)trackCasting(stored,spell.origin,classAbility,feature,'free-only');
  }
  if(plan.after.prepared&&!c.spellSlotMode){
    if(selection.updateSlots===false&&!selection.requireFullProgression) c.spellSlotMode='manual';
    else {
      if(spellSlotPlan(character).pactMagic)c.pactMagic=true;
      c.spellSlotMode='auto';
    }
  }
  syncSpellSlots(c);
  if(className===c.class&&['Eldritch Knight','Arcane Trickster'].includes(subclass)&&c.spellAbility==='auto')c.spellAbility='int';
  for(const spell of plan.grant.filter(s=>s.level>0&&(/lineage|free casting/.test(s.origin))&&!/at will/.test(s.origin))){
    const lineage=spell.origin.includes('lineage'),owner=lineage?c.race:spell.origin.split(' (')[0],name=c.race==='Aarakocra'&&lineage?'Wind Caller':`${owner}: ${spell.name}`;
    if(!c.features.some(f=>f.maxUses>0&&(normalized(f.name)===normalized(name)||!lineage&&normalized(f.name)===normalized(owner)||lineage&&normalized(f.name).includes(normalized(spell.name))&&/\(lineage\)/.test(f.name)))){
      addProgressionFeature(c,{...reference(name,owner,c.level),details:`${spell.origin}. Free ${spell.name} casting; choose No slot in Spellbook and spend a use here.`,resource:c.race==='Forest Gnome'&&lineage?'pb-long':/Short or Long/.test(spell.origin)?'one-short':'one-long'});
    }
    if(lineage&&c.lineageAbility){
      const stored=c.spells.find(s=>spellKey(s.name)===spell.id);
      const feature=c.features.find(f=>f.name===name||f.name===`${spell.name} (lineage)`);
      if(feature&&!stored.castingGrants?.some(g=>g.origin===spell.origin)){
        (stored.castingGrants??=[]).push({origin:spell.origin,ability:c.lineageAbility,mode:'free',featureId:feature.id});
      }
    }
  }
  for(const line of String(selection.customFeatures||'').split('\n').map(s=>s.trim()).filter(Boolean)){
    if(line.length>200)throw new Error('Keep each custom feature name within 200 characters.');
    addProgressionFeature(c,reference(line,c.subclass||c.race,c.level,'2014'));
  }
  for(const line of String(selection.customSpells||'').split('\n').map(s=>s.trim()).filter(Boolean)){
    const match=line.match(/^([0-9])\s*\|\s*(.{1,200})$/);
    if(!match)throw new Error('Enter additional spells as level | name, for example 2 | My book’s spell.');
    const name=match[2].trim();if(!name)throw new Error('Enter a name for each additional spell.');
    addSpell({id:spellKey(name),name,level:Number(match[1]),school:'Other',castingTime:'See spell rules',range:'See spell rules',duration:'See spell rules',concentration:false,wiki:wikiURL(name,'spell'),notes:'Book / table selection during level-up. Fill casting details and effects from your source in the spell editor.'},'Book / table choice');
  }
  c.skills=[...new Set(c.skills)];c.expertise=[...new Set(c.expertise)];
  c.maxHp=Math.min(9999,c.maxHp);c.hp=Math.min(c.hp,c.maxHp);
  parseBackup(JSON.stringify({version:SAVE_VERSION,activeId:c.id,characters:[c],settings:{sound:false}}));
  for(const key of ['pactMagic','pactSlot','hitDicePools'])if(!Object.hasOwn(c,key))delete character[key];
  Object.assign(character,c);
  return character;
}
