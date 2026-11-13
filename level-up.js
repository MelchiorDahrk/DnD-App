import {levelUp,uid,mod,SKILLS,ABILITIES,RULES_URL,parseBackup,SAVE_VERSION} from './model.js';
import {FEATURE_CATALOG,featureFields,featureMatchesCharacter} from './feature-catalog.js';
import {CLASS_OPTIONS,SUBCLASSES,SPECIES,WEAPONS,EQUIPMENT} from './catalog.js';
import {CLASS_LEVELS,SPELL_CATALOG} from './progression-data.js';
import {SUBCLASS_ALIASES,SUBCLASS_ROWS,LEGACY_SUBCLASSES,SUBCLASS_SPELLS,LINEAGE_SPELLS,LAND_SPELLS,LEGACY_EXPANDED_SPELLS,LEGACY_LINEAGE_SPELLS,GENIE_SPELLS} from './progression-options.js';

export const normalized=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
export function spellKey(s){const n=normalized(s).replace(/^(bigbys|drawmijs|evards|leomunds|melfs|mordenkainens|nystuls|otilukes|ottos|rarys|tashas|tensers)/,'');return ({brandingsmite:'shiningsmite',feeblemind:'befuddlement',hand:'arcanehand',sword:'arcanesword',magicaura:'arcanistsmagicaura'})[n]||n;}
export function canonicalSubclass(name){return Object.entries(SUBCLASS_ALIASES).find(([key])=>normalized(key)===normalized(name))?.[1]||name;}
export const LEVEL_SUBCLASSES=[...SUBCLASSES.map(s=>({...s,source:s.className==='Artificer'?'2014':'2024'})),...LEGACY_SUBCLASSES];
const spellByName=name=>SPELL_CATALOG.find(s=>s.id===spellKey(name));
const has=(c,name)=>c.features.some(f=>normalized(f.name)===normalized(name)||normalized(f.name)===normalized(`${name} (Origin feat)`));
export const FEAT_ABILITIES={Actor:['cha'],Athlete:['str','dex'],Charger:['str','dex'],Chef:['con','wis'],'Crossbow Expert':['dex'],Crusher:['str','con'],'Defensive Duelist':['dex'],'Dual Wielder':['str','dex'],Durable:['con'],'Elemental Adept':['int','wis','cha'],'Fey-Touched':['int','wis','cha'],Grappler:['str','dex'],'Great Weapon Master':['str'],'Heavily Armored':['con','str'],'Heavy Armor Master':['con','str'],'Inspiring Leader':['wis','cha'],'Keen Mind':['int'],'Lightly Armored':['str','dex'],'Mage Slayer':['str','dex'],'Martial Weapon Training':['str','dex'],'Medium Armor Master':['str','dex'],'Moderately Armored':['str','dex'],'Mounted Combatant':['str','dex','wis'],Observant:['int','wis'],Piercer:['str','dex'],Poisoner:['dex','int'],'Polearm Master':['str','dex'],Resilient:Object.keys(ABILITIES),'Ritual Caster':['int','wis','cha'],Sentinel:['str','dex'],'Shadow-Touched':['int','wis','cha'],Sharpshooter:['dex'],'Shield Master':['str'], 'Skill Expert':Object.keys(ABILITIES),Skulker:['dex'],Slasher:['str','dex'],Speedy:['dex','con'],'Spell Sniper':['int','wis','cha'],Telekinetic:['int','wis','cha'],Telepathic:['int','wis','cha'],'War Caster':['int','wis','cha'],'Weapon Master':['str','dex']};
Object.assign(FEAT_ABILITIES,{Linguist:['int'],Gunner:['dex'],'Dragon Fear':['str','con','cha'],'Dragon Hide':['str','con','cha'],'Dwarven Fortitude':['con'],'Elven Accuracy':['dex','int','wis','cha'],'Fade Away':['dex','int'],'Fey Teleportation':['int','cha'],'Flames of Phlegethos':['int','cha'],'Infernal Constitution':['con'],'Orcish Fury':['str','con'],'Second Chance':['dex','con','cha'],'Squat Nimbleness':['str','dex']});
const asiLevels=cls=>cls==='Fighter'?[4,6,8,12,14,16,19]:cls==='Rogue'?[4,8,10,12,16,19]:[4,8,12,16,19];
const spellList=names=>new Set(names.split('|').map(spellKey));
const artificerSpells=spellList('Acid Splash|Guidance|Light|Mage Hand|Mending|Message|Poison Spray|Prestidigitation|Ray of Frost|Resistance|Shocking Grasp|Spare the Dying|Thorn Whip|Alarm|Cure Wounds|Detect Magic|Disguise Self|Expeditious Retreat|Faerie Fire|False Life|Feather Fall|Grease|Identify|Jump|Longstrider|Purify Food and Drink|Sanctuary|Aid|Alter Self|Arcane Lock|Blur|Continual Flame|Darkvision|Enhance Ability|Enlarge/Reduce|Heat Metal|Invisibility|Lesser Restoration|Levitate|Magic Mouth|Magic Weapon|Protection from Poison|Rope Trick|See Invisibility|Spider Climb|Web|Blink|Catnap|Create Food and Water|Dispel Magic|Elemental Weapon|Flame Arrows|Fly|Glyph of Warding|Haste|Protection from Energy|Revivify|Tiny Servant|Water Breathing|Water Walk|Arcane Eye|Elemental Bane|Fabricate|Freedom of Movement|Leomund’s Secret Chest|Mordenkainen’s Faithful Hound|Mordenkainen’s Private Sanctum|Otiluke’s Resilient Sphere|Stone Shape|Stoneskin|Animate Objects|Bigby’s Hand|Creation|Greater Restoration|Skill Empowerment|Transmute Rock|Wall of Stone');
export function classProgression(c,level=c.level){
  if(c.class==='Artificer'){
    const slots=CLASS_LEVELS.find(r=>r.className==='Paladin'&&r.level===level).slots;
    return {className:c.class,level,slots,cantrips:level>=14?4:level>=10?3:2,prepared:Math.max(1,Math.floor(level/2)+mod(c.stats.int)),specific:{},features:FEATURE_CATALOG.filter(f=>f.className===c.class&&!f.subclass&&f.level===level).map(f=>f.name)};
  }
  if(((c.class==='Fighter'&&canonicalSubclass(c.subclass)==='Eldritch Knight')||(c.class==='Rogue'&&canonicalSubclass(c.subclass)==='Arcane Trickster'))&&level>=3){
    const tier=level>=19?4:level>=13?3:level>=7?2:1;
    const slots=Array(9).fill(0);slots[0]=level>=7?4:level>=4?3:2;if(tier>=2)slots[1]=level>=10?3:2;if(tier>=3)slots[2]=level>=16?3:2;if(tier>=4)slots[3]=1;
    const prepared=[0,0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13][level];
    return {...CLASS_LEVELS.find(r=>r.className===c.class&&r.level===level),slots,cantrips:(c.subclass==='Arcane Trickster'?3:2)+(level>=10?1:0),prepared,specific:{}};
  }
  return CLASS_LEVELS.find(r=>r.className===c.class&&r.level===level);
}
function reference(name,owner,level,source='2024'){
  const resource=({'Arcane Shot':'two-short','Giant’s Might':'pb-long','Magic Awareness':'pb-long','Bolstering Magic':'pb-long','Fighting Spirit':'three-long','Unleash Incarnation':'con-long','Reclaim Potential':'con-long','Chronal Shift':'two-long','Momentary Stasis':'int-long',Bladesong:'pb-long','Healing Light':'healing-light','Steps of the Fey':'cha-long','Warding Flare':'wis-long','War Priest':'wis-short','Hexblade’s Curse':'one-short','Form of Dread':'pb-long'})[name];
  return {id:`progression-${normalized(owner)}-${level}-${normalized(name)}`,name,owner,level,source,resource,details:`${owner} feature at level ${level}. Consult the linked rules for its effects and any choices.`,wiki:`https://www.dndbeyond.com/sources/dnd/${source==='2014'?'phb-2014':'phb-2024'}/character-classes`,group:'Subclass features'};
}
function subclassEntries(c){
  const subclass=canonicalSubclass(c.subclass),option=LEVEL_SUBCLASSES.find(s=>s.name===subclass&&s.className===c.class);
  const rows=SUBCLASS_ROWS[subclass]||LEGACY_SUBCLASSES.find(s=>s.name===subclass)?.rows||[];
  const existing=FEATURE_CATALOG.filter(f=>f.group==='Subclass features'&&f.subclass===subclass&&f.name!==subclass);
  const added=rows.flatMap(([level,...names])=>names.filter(name=>!existing.some(e=>normalized(e.name)===normalized(name)&&e.level===level)).map(name=>({...reference(name,subclass,level,option?.source),className:c.class,subclass})));
  return [...existing,...added].filter(f=>!(option?.source==='2014'&&c.class==='Cleric'&&['Divine Strike','Potent Spellcasting'].includes(f.name)));
}
const classNameAliases={'Font of Magic':'Font of Magic / Sorcery Points','Paladin’s Smite':'Paladin’s Smite'};
function classEntries(c,level){
  return classProgression(c,level).features.filter(n=>!/(Subclass|Ability Score Improvement|Epic Boon)/.test(n)).map(name=>{
    if(c.class==='Warlock'&&name==='Mystic Arcanum')name=`Mystic Arcanum (${(level+1)/2}th-level spell)`;
    const entry=FEATURE_CATALOG.find(f=>f.className===c.class&&!f.subclass&&normalized(f.name)===normalized(classNameAliases[name]||name));
    return entry?{...entry,level}:{...reference(name,c.class,level,c.class==='Artificer'?'2014':'2024'),className:c.class,group:'Class features'};
  });
}
function eligibleFeat(f,c){
  if(!['General feats','Origin feats','Epic boons','Earlier feats'].includes(f.group)||f.level>c.level||!featureMatchesCharacter(f,c))return false;
  if(has(c,f.name)&&f.name!=='Ability Score Improvement')return false;
  if(['War Caster','Elemental Adept','Spell Sniper','Eldritch Adept','Metamagic Adept'].includes(f.name)&&!classProgression(c).prepared)return false;
  if(f.name==='Grappler'&&c.stats.str<13&&c.stats.dex<13)return false;
  if(f.name==='Ritual Caster'&&!['int','wis','cha'].some(a=>c.stats[a]>=13))return false;
  const base=CLASS_OPTIONS.find(option=>option.name===c.class),armor=c.armorProficiencies||base.armor,weapons=c.weaponProficiencies||base.weapons;
  if(f.name==='Fighting Initiate'&&!/martial/i.test(weapons))return false;
  // PHB 2024 prerequisites differ from the abilities a feat can increase.
  const abilityPrereqs={Actor:['cha'],Athlete:['str','dex'],Charger:['str','dex'],'Crossbow Expert':['dex'],'Defensive Duelist':['dex'],'Dual Wielder':['str','dex'],'Great Weapon Master':['str'],'Inspiring Leader':['wis','cha'],'Keen Mind':['int'],Observant:['int','wis'],'Polearm Master':['str','dex'],Sentinel:['str','dex'],Sharpshooter:['dex'],Skulker:['dex'],Speedy:['dex','con']};
  if(abilityPrereqs[f.name]&&!abilityPrereqs[f.name].some(a=>c.stats[a]>=13))return false;
  if(['Heavily Armored','Medium Armor Master'].includes(f.name)&&!/medium/i.test(armor))return false;
  if(f.name==='Heavy Armor Master'&&!/heavy/i.test(armor))return false;
  if(f.name==='Moderately Armored'&&!/light/i.test(armor))return false;
  if(f.name==='Shield Master'&&!/shield/i.test(armor))return false;
  if(f.name==='Squat Nimbleness'&&!featureMatchesCharacter({species:['Dwarf']},c)){
    const size=SPECIES.find(s=>normalized(s.name)===normalized(c.race))?.size;
    if(size&&!size.includes('Small'))return false;
  }
  return true;
}
export function levelUpPlan(character,{subclass=character.subclass,race=character.race,choices:choiceSelections={},land=character.circleLand||'Temperate',abilities={}}={}){
  if(character.level>=20)throw new Error('You’ve reached level 20.');
  const c={...character,level:character.level+1,subclass:canonicalSubclass(subclass),race},level=c.level;
  const knownSubclass=LEVEL_SUBCLASSES.find(s=>s.name===c.subclass);
  if(knownSubclass&&knownSubclass.className!==c.class)throw new Error('That subclass is not available to your class.');
  const before=classProgression(character),after=classProgression(c);
  if(c.class==='Artificer')after.prepared=Math.max(1,Math.floor(level/2)+mod(c.stats.int+Number(abilities.int||0)));
  const known=new Set(c.features.map(f=>normalized(f.name)));
  const species=FEATURE_CATALOG.filter(f=>f.group==='Species traits'&&featureMatchesCharacter(f,c));
  const all=[...Array.from({length:level},(_,i)=>classEntries(c,i+1)).flat(),...subclassEntries(c),...species];
  const unique=new Map();for(const f of all)if(f.level<=level)unique.set(f.id,f);
  const fresh=[...unique.values()].filter(f=>f.level===level&&!known.has(normalized(f.name))&&!['Colossus Slayer','Horde Breaker'].includes(f.name));
  const catchup=[...unique.values()].filter(f=>f.level<level&&!known.has(normalized(f.name)));
  const updates=[];
  for(const f of c.features){
    const entry=[...unique.values()].find(e=>(f.catalogId&&f.catalogId===e.id)||normalized(e.name)===normalized(f.name));
    if(!entry)continue;
    const old=featureFields(entry,character),next=featureFields(entry,c),fields={};
    for(const key of ['maxUses','reset','shortRestRecovery','rollFormula'])if(f[key]===old[key]&&old[key]!==next[key])fields[key]=next[key];
    if(Object.keys(fields).length)updates.push({id:f.id,name:f.name,fields});
  }
  const choices=[];
  const add=(id,label,count,options,kind='feature')=>{if(count>0)choices.push({id,label,count,kind,options:options.map(o=>typeof o==='string'?{id:o,label:o}:o)});};
  const skillOptions=(allowed=Object.keys(SKILLS))=>(Array.isArray(allowed)?allowed:/^Any/.test(allowed)?Object.keys(SKILLS):String(allowed).split(',').map(s=>s.trim())).filter(s=>Object.hasOwn(SKILLS,s)&&!c.skills.includes(s));
  const toolOptions=EQUIPMENT.filter(e=>['Tools','Musical instruments','Gaming sets'].includes(e.group)&&!normalized(c.toolProficiencies).includes(normalized(e.name))).map(e=>({id:e.name,label:e.name}));
  const artisanNames=new Set(EQUIPMENT.filter(e=>e.group==='Tools').slice(0,17).map(e=>e.name));
  const baseSkills=CLASS_OPTIONS.find(o=>o.name===c.class);
  if(c.skills.length<baseSkills.skillCount)add('classSkills','Earlier class skill proficiencies',baseSkills.skillCount-c.skills.length,skillOptions(baseSkills.skills),'skills');
  const expertOptions=()=>[...new Set([...c.skills,...(choiceSelections.classSkills||[])])].filter(s=>!c.expertise.includes(s));
  if((c.class==='Bard'&&[2,9].includes(level))||(c.class==='Rogue'&&level===6))add('expertise','Skill Expertise',2,expertOptions(),'expertise');
  if(c.class==='Ranger'&&[2,9].includes(level))add('expertise','Skill Expertise',level===2?1:2,expertOptions(),'expertise');
  if(c.class==='Wizard'&&level===2)add('expertise','Scholar Expertise',1,expertOptions().filter(s=>['Arcana','History','Investigation','Nature','Religion'].includes(s)),'expertise');
  if(c.class==='Rogue'&&level<6&&c.expertise.length<2)add('expertise','Earlier skill Expertise',2-c.expertise.length,expertOptions(),'expertise');
  if(c.class==='Barbarian'&&level===3)add('skills','Primal Knowledge skill',1,skillOptions(CLASS_OPTIONS.find(o=>o.name===c.class).skills),'skills');
  if(c.subclass==='College of Lore'&&level===3)add('skills','Bonus Proficiencies',3,skillOptions(),'skills');
  if(c.subclass==='Battle Master'&&level===3)add('skills','Student of War skill',1,skillOptions(['History','Insight','Investigation','Persuasion','Performance']),'skills');
  if(c.subclass==='Battle Master'&&level===3)add('tools','Student of War tool',1,toolOptions.filter(o=>artisanNames.has(o.id)),'tool');
  if(c.subclass==='Fey Wanderer'&&level===3)add('skills','Otherworldly Glamour skill',1,skillOptions(['Deception','Performance','Persuasion']),'skills');
  if(c.subclass==='Knowledge Domain'&&level===3)add('knowledge','Blessings of Knowledge (proficiency and Expertise)',2,skillOptions(['Arcana','History','Nature','Religion']),'knowledge');
  if(c.subclass==='Nature Domain'&&level===3)add('skills','Acolyte of Nature skill',1,skillOptions(['Animal Handling','Nature','Survival']),'skills');
  if(c.subclass==='Order Domain'&&level===3)add('skills','Order Domain skill',1,skillOptions(['Intimidation','Persuasion']),'skills');
  if(c.subclass==='Peace Domain'&&level===3)add('skills','Implement of Peace skill',1,skillOptions(['Insight','Performance','Persuasion']),'skills');
  if(c.subclass==='Samurai'&&level===3)add('skills','Samurai proficiency',1,[...skillOptions(['History','Insight','Performance','Persuasion']),...['One language (record in Languages)']],'training');
  if(asiLevels(c.class).includes(level))add('feat',level===19&&c.class!=='Artificer'?'Epic Boon or feat':'Feat or Ability Score Improvement',1,FEATURE_CATALOG.filter(f=>eligibleFeat(f,c)).map(f=>({id:f.id,label:f.name,entry:f})),'feat');
  const featureOptions=group=>FEATURE_CATALOG.filter(f=>f.group===group&&f.level<=level&&!known.has(normalized(f.name)));
  if((['Paladin','Ranger'].includes(c.class)&&level===2)||(c.subclass==='Champion'&&level===7)){
    const options=featureOptions('Fighting styles');
    if(level===2)options.push(FEATURE_CATALOG.find(f=>f.className===c.class&&f.name===(c.class==='Paladin'?'Blessed Warrior':'Druidic Warrior')));
    add('style','Fighting Style',1,options.map(f=>({id:f.id,label:f.name,entry:f})));
  }
  if(c.class==='Sorcerer'&&[2,10,17].includes(level))add('metamagic','Metamagic',2,featureOptions('Metamagic').map(f=>({id:f.id,label:f.name,entry:f})));
  if(c.class==='Warlock')add('invocations','Eldritch Invocations',after.specific.eldritch_invocations-before.specific.eldritch_invocations,featureOptions('Eldritch invocations').map(f=>({id:f.id,label:f.name,entry:f})));
  if(c.subclass==='Battle Master'&&[3,7,10,15].includes(level))add('maneuvers','Battle Master maneuvers',level===3?3:2,featureOptions('Maneuvers').map(f=>({id:f.id,label:f.name,entry:f})));
  const mastery=(after.specific.weapon_mastery||0)-(before.specific.weapon_mastery||0);
  if(mastery>0)add('mastery','Additional Weapon Mastery',mastery,WEAPONS.filter(w=>c.class!=='Barbarian'||w.family.includes('melee')).map(w=>({id:w.name,label:`${w.name} (${w.mastery})`})),'mastery');
  const chooseEffect=(id,label,options)=>add(id,label,1,options);
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
  function chooseArcaneShots(){add('arcaneShots','Arcane Shot options',level===3?2:1,['Banishing','Beguiling','Bursting','Enfeebling','Grasping','Piercing','Seeking','Shadow'].filter(name=>!has(c,`Arcane Shot: ${name}`)).map(name=>({id:name,label:name,entry:reference(`Arcane Shot: ${name}`,'Arcane Archer',level,'2014')})));}
  if(c.subclass==='Cavalier'&&level===3)add('skills','Cavalier proficiency',1,skillOptions(['Animal Handling','History','Insight','Performance','Persuasion']),'skills');
  if(c.subclass==='Phantom'&&level===3)add('phantomTraining','Whispers of the Dead proficiency',1,[...skillOptions(),...toolOptions],'training');
  if(c.subclass==='Divine Soul'&&level===3)chooseEffect('affinity','Divine Magic affinity',['Good','Evil','Law','Chaos','Neutrality']);
  if(c.subclass==='Genie Patron'&&level===3)chooseEffect('genie','Genie kind',['Dao','Djinni','Efreeti','Marid']);
  if(c.class==='Cleric'&&level===7)chooseEffect('blessed','Blessed Strikes',['Divine Strike','Potent Spellcasting']);
  if(c.class==='Druid'&&level===7)chooseEffect('fury','Elemental Fury',['Primal Strike','Potent Spellcasting']);
  const feat=choices.find(ch=>ch.id==='feat')?.options.find(o=>o.id===choiceSelections.feat?.[0]);
  if(feat?.label==='Squat Nimbleness'&&!featureMatchesCharacter({species:['Dwarf']},c)&&SPECIES.find(s=>normalized(s.name)===normalized(c.race))?.size!=='Small')add('featSize','Squat Nimbleness size prerequisite',1,[{id:'Small',label:'My character is Small'}]);
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
  if(feat?.label==='Skilled')add('featSkills','Skilled proficiencies',3,[...skillOptions(),...toolOptions],'training');
  if(feat?.label==='Crafter')add('featTools','Crafter tools',3,toolOptions.filter(o=>artisanNames.has(o.id)),'tool');
  if(feat?.label==='Musician')add('featTools','Musician instruments',3,EQUIPMENT.filter(e=>e.group==='Musical instruments').map(e=>e.name),'tool');
  if(feat?.label==='Resilient')add('resilient','Resilient saving throw proficiency',1,Object.keys(ABILITIES).filter(a=>!c.saves.includes(a)).map(a=>({id:a,label:ABILITIES[a]})),'save');
  const extraSpells=(id,label,count,filter)=>add(id,label,count,SPELL_CATALOG.filter(filter).map(s=>({id:s.id,label:s.name,spell:s})),'spell');
  const magicInitiate=feat?.label.match(/^Magic Initiate \((\w+)\)/)?.[1];
  const style=choices.find(ch=>ch.id==='style')?.options.find(o=>o.id===choiceSelections.style?.[0]);
  const warrior=style?.label==='Blessed Warrior'?'Cleric':style?.label==='Druidic Warrior'?'Druid':'';
  if(magicInitiate||warrior)extraSpells('bonusCantrips',`${feat?.label||style.label} cantrips`,2,s=>s.level===0&&s.classes.includes(magicInitiate||warrior));
  if(magicInitiate)extraSpells('bonusSpell','Magic Initiate level 1 spell',1,s=>s.level===1&&s.classes.includes(magicInitiate));
  if(feat?.label==='Artificer Initiate'){
    extraSpells('bonusCantrips','Artificer Initiate cantrip',1,s=>s.level===0&&artificerSpells.has(s.id));
    extraSpells('bonusSpell','Artificer Initiate spell',1,s=>s.level===1&&artificerSpells.has(s.id));
    add('featTools','Artificer Initiate tool',1,toolOptions.filter(o=>artisanNames.has(o.id)),'tool');
  }
  if(feat?.label==='Wood Elf Magic')extraSpells('bonusCantrips','Wood Elf Magic cantrip',1,s=>s.level===0&&s.classes.includes('Druid'));
  if(feat?.label==='Fey-Touched')extraSpells('bonusSpell','Fey-Touched level 1 spell',1,s=>s.level===1&&['Divination','Enchantment'].includes(s.school));
  if(feat?.label==='Shadow-Touched')extraSpells('bonusSpell','Shadow-Touched level 1 spell',1,s=>s.level===1&&['Illusion','Necromancy'].includes(s.school));
  if(c.subclass==='Nature Domain'&&level===3)extraSpells('natureCantrip','Acolyte of Nature cantrip',1,s=>s.level===0&&s.classes.includes('Druid'));
  if(c.subclass==='Arcana Domain'&&level===3)extraSpells('arcanaCantrips','Arcane Initiate cantrips',2,s=>s.level===0&&s.classes.includes('Wizard'));
  if(c.subclass==='Death Domain'&&level===3)extraSpells('reaper','Reaper cantrip',1,s=>s.level===0&&s.school==='Necromancy');
  if(c.subclass==='Arcane Archer'&&level===3){add('skills','Arcane Archer Lore skill',1,skillOptions(['Arcana','Nature']),'skills');extraSpells('archerCantrip','Arcane Archer Lore cantrip',1,s=>['druidcraft','prestidigitation'].includes(s.id));}
  if(c.subclass==='College of Lore'&&level===6)extraSpells('loreSecrets','Magical Discoveries',2,s=>s.level>0&&s.level<=3&&s.classes.some(cls=>['Cleric','Druid','Wizard'].includes(cls)));
  if(c.subclass==='Arcana Domain'&&level===17)for(const tier of [6,7,8,9])extraSpells(`arcaneMastery${tier}`,`Arcane Mastery level ${tier} spell`,1,s=>s.level===tier&&s.classes.includes('Wizard'));
  if(c.class==='Wizard'&&level===18)for(const tier of [1,2])extraSpells(`spellMastery${tier}`,`Spell Mastery level ${tier} spell`,1,s=>s.level===tier&&s.classes.includes('Wizard')&&/^(1 )?action$/i.test(s.castingTime));
  if(c.class==='Wizard'&&level===20)extraSpells('signature','Signature Spells',2,s=>s.level===3&&s.classes.includes('Wizard'));
  if(c.race==='High Elf'&&!c.spells.some(s=>(s.origin||'').includes('High Elf')))extraSpells('elfCantrip','High Elf cantrip',1,s=>s.level===0&&s.classes.includes('Wizard'));
  if(feat?.label==='Ritual Caster'||has(c,'Ritual Caster')&&Math.floor((level-1)/4)>Math.floor((character.level-1)/4))extraSpells('rituals','Ritual Caster spells',feat?.label==='Ritual Caster'?2+Math.floor((level-1)/4):1,s=>s.level===1&&s.ritual&&s.classes.some(cls=>['Cleric','Druid','Wizard'].includes(cls))&&!c.spells.some(old=>spellKey(old.name)===s.id));
  const savant={Abjurer:'Abjuration',Diviner:'Divination',Evoker:'Evocation',Illusionist:'Illusion'}[c.subclass];
  const newSpellTier=after.slots.findLastIndex(n=>n>0)>before.slots.findLastIndex(n=>n>0);
  if(savant&&(level===3||newSpellTier))extraSpells('savant',`${savant} Savant spellbook additions`,level===3?2:1,s=>s.level>0&&s.level<=(after.slots.findLastIndex(n=>n>0)+1)&&s.classes.includes('Wizard')&&s.school===savant&&!c.spells.some(old=>spellKey(old.name)===s.id));
  const grant=[];
  const addSpell=(name,origin,at)=>{const spell=spellByName(name);if(!spell)throw new Error(`Missing spell data: ${name}`);grant.push({...spell,origin,at});};
  for(const [at,...names] of SUBCLASS_SPELLS[c.subclass]||[])if(at<=level)for(const name of names)addSpell(name,`${c.subclass} (always prepared)`,at);
  if(c.subclass==='Circle of the Land')for(const [at,...names] of LAND_SPELLS[land]||[])if(at<=level)for(const name of names)addSpell(name,`Circle of the Land: ${land} (always prepared)`,at);
  for(const [at,...names] of LINEAGE_SPELLS[c.race]||[])if(at<=level)for(const name of names)addSpell(name,`${c.race} lineage`,at);
  for(const [at,...names] of LEGACY_LINEAGE_SPELLS[c.race]||[])if(at<=level)for(const name of names)addSpell(name,`${c.race} lineage (2014 rules)${c.race==='Yuan-ti'&&name==='Animal Friendship'?' · at will, snakes only':''}`,at);
  if(c.class==='Ranger')addSpell('Hunter’s Mark','Favored Enemy (always prepared)',1);
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
  const permitted=s=>c.class==='Artificer'?artificerSpells.has(s.id):s.classes.includes(['Eldritch Knight','Arcane Trickster'].includes(c.subclass)?'Wizard':c.class)||(c.class==='Sorcerer'&&c.subclass==='Divine Soul'&&s.classes.includes('Cleric'))||expanded.has(s.id)||(c.class==='Bard'&&level>=10&&s.classes.some(cls=>['Cleric','Druid','Wizard'].includes(cls)));
  const available=SPELL_CATALOG.filter(s=>s.level<=maxSpellLevel&&permitted(s));
  const arcanum=c.class==='Warlock'&&[11,13,15,17].includes(level)?(level+1)/2:0;
  const arcanumOptions=arcanum?SPELL_CATALOG.filter(s=>s.level===arcanum&&permitted(s)):[];
  return {character:c,before,after,fresh,catchup,updates,choices,grant,available,maxSpellLevel,arcanum,arcanumOptions,land,
    cantripGain:Math.max(0,after.cantrips-before.cantrips),spellGain:c.class==='Wizard'?2:Math.max(0,after.prepared-before.prepared),
    hpBonus:(/dwarf/i.test(c.race)?1:0)+(has(c,'Tough')?2:0),
    warnings:[...(!LEVEL_SUBCLASSES.some(s=>s.name===c.subclass&&s.className===c.class)&&level>=3?['This subclass has no bundled progression. Add its unlocks below using your book.']:[]),...(!species.length&&!LEGACY_LINEAGE_SPELLS[c.race]?['This species has no bundled progression. Add its unlocks below using your book.']:[])]};
}
function addFeature(c,entry){
  if(c.features.some(f=>normalized(f.name)===normalized(entry.name)))return;
  c.features.push({id:uid(),used:0,...featureFields(entry,c),catalogId:entry.id});
}
export function applyLevelUp(character,selection={}){
  const plan=levelUpPlan(character,selection),c=structuredClone(character),chosen=selection.choices||{};
  if(!Number.isInteger(selection.hpGain)||selection.hpGain<1||selection.hpGain>999)throw new Error('Enter HP gained from your Hit Die, including Constitution (1–999).');
  if(c.level===2&&!plan.character.subclass)throw new Error('Choose a subclass for level 3.');
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
    const allowed=feat.entry.group==='Epic boons'?Object.keys(ABILITIES):FEAT_ABILITIES[feat.label]||[];
    if(points!==(allowed.length?1:0)||Object.entries(abilityIncreases).some(([a,n])=>n&&!allowed.includes(a)))throw new Error(allowed.length?'Choose the +1 ability increase allowed by this feat.':'This Origin feat does not grant an ability increase.');
    if(feat.label==='Resilient'&&abilityIncreases[chosen.resilient?.[0]]!==1)throw new Error('Resilient must increase the ability for its selected saving throw.');
  }
  const cap=feat?.entry.group==='Epic boons'?30:20;
  for(const [ability,amount] of Object.entries(abilityIncreases))if(amount&&c.stats[ability]+amount>cap)throw new Error(`This increase cannot raise ${ABILITIES[ability]} above ${cap}.`);
  const beforeCon=mod(c.stats.con);
  for(const [ability,amount] of Object.entries(abilityIncreases))c.stats[ability]+=amount;
  c.subclass=plan.character.subclass;c.race=plan.character.race;
  if(c.subclass==='Circle of the Land'){if(!Object.hasOwn(LAND_SPELLS,plan.land))throw new Error('Choose a Circle of the Land terrain.');c.circleLand=plan.land;}
  if(c.class==='Barbarian'&&plan.character.level===20)for(const a of ['str','con'])c.stats[a]=Math.min(25,c.stats[a]+4);
  if(c.class==='Monk'&&plan.character.level===20)for(const a of ['dex','wis'])c.stats[a]=Math.min(25,c.stats[a]+4);
  const hpExtra=plan.hpBonus+(mod(c.stats.con)-beforeCon)*plan.character.level;
  levelUp(c,selection.hpGain);c.maxHp=Math.min(9999,c.maxHp+hpExtra);c.hp=Math.min(c.maxHp,c.hp+hpExtra);
  const grantIds=new Set(selection.featureIds??plan.fresh.map(f=>f.id));
  for(const id of grantIds){const entry=[...plan.fresh,...plan.catchup].find(f=>f.id===id);if(!entry)throw new Error('That feature is not available at this level.');addFeature(c,entry);}
  const resourceEntries=[...FEATURE_CATALOG,...subclassEntries(c),...c.features.filter(f=>c.subclass==='Rune Knight'&&f.name.startsWith('Rune: ')&&f.catalogId).map(f=>({...reference(f.name,'Rune Knight',c.level,'2014'),id:f.catalogId,resource:'rune'}))];
  if(selection.updateResources!==false)for(const f of c.features){
    const entry=resourceEntries.find(e=>featureMatchesCharacter(e,c)&&((f.catalogId&&f.catalogId===e.id)||normalized(f.name)===normalized(e.name)));
    if(!entry)continue;
    const old=featureFields(entry,character),next=featureFields(entry,c);
    for(const key of ['maxUses','reset','shortRestRecovery','rollFormula'])if(f[key]===old[key])f[key]=next[key];
    f.used=Math.min(f.used,f.maxUses);
  }
  for(const {choice,option} of picked){
    if(choice.kind==='skills')c.skills.push(option.id);
    else if(choice.kind==='training'&&Object.hasOwn(SKILLS,option.id))c.skills.push(option.id);
    else if(choice.kind==='tool'||choice.kind==='training')c.toolProficiencies=[c.toolProficiencies,option.id].filter(Boolean).join('; ');
    else if(choice.kind==='knowledge'){c.skills.push(option.id);c.expertise.push(option.id);}
    else if(choice.kind==='save')c.saves.push(option.id);
    else if(choice.kind==='expertise')c.expertise.push(option.id);
    else if(choice.kind==='mastery')addFeature(c,{...reference(`Weapon Mastery: ${option.label}`,c.class,c.level),details:`Selected mastery: ${option.label}. Apply the mastery property when using this weapon.`});
    else if(option.entry&&option.label!=='Ability Score Improvement')addFeature(c,option.entry);
    else if(!option.entry&&choice.kind!=='spell')addFeature(c,reference(`${choice.label}: ${option.label}`,c.subclass||c.class,c.level));
    if(choice.id==='genie')c.genieKind=option.id;
  }
  for(const choice of pending)addFeature(c,{...reference(`Pending choice: ${choice.label}`,c.class,c.level),details:`Choose ${choice.count} option(s) for ${choice.label}. The sheet has too few eligible recorded proficiencies/options. Review your book and fill in the missing selections and sheet entries.`});
  if(feat?.label==='Tough'){c.maxHp+=2*c.level;c.hp+=2*c.level;}
  if(c.class==='Monk'&&c.level===14)c.saves=Object.keys(ABILITIES);
  if(c.class==='Rogue'&&c.level===15)c.saves=[...new Set([...c.saves,'wis','cha'])];
  if(c.subclass==='Scout'&&c.level===3)for(const skill of ['Nature','Survival']){if(!c.skills.includes(skill))c.skills.push(skill);if(!c.expertise.includes(skill))c.expertise.push(skill);}
  const oldKeys=new Set(character.spells.map(s=>spellKey(s.name)));
  const swaps=[];
  for(const [oldField,newField,cantrip] of [['replaceSpellId','replacementSpellId',false],['replaceCantripId','replacementCantripId',true]]){
    const oldId=selection[oldField],newId=selection[newField];if(!oldId&&!newId)continue;
    const old=character.spells.find(s=>s.id===oldId&&!s.origin&&(s.level===0)===cantrip&&!plan.grant.some(g=>g.id===spellKey(s.name))&&plan.available.some(a=>a.id===spellKey(s.name)));
    const next=plan.available.find(s=>s.id===newId&&(s.level===0)===cantrip&&!oldKeys.has(s.id));
    if(!cantrip&&!['Bard','Sorcerer','Warlock'].includes(c.class)||!old||!next)throw new Error('Choose both an eligible old spell and a new replacement, or leave both replacement fields blank.');
    swaps.push({old,next});
  }
  const ids=selection.spellIds||[];
  if(swaps.some(s=>ids.includes(s.next.id)))throw new Error('Select a replacement spell only in its replacement field.');
  if(new Set(ids).size!==ids.length)throw new Error('Choose each spell once.');
  const available=[...plan.available,...plan.arcanumOptions];
  const spells=ids.map(id=>{const s=available.find(s=>s.id===id);if(!s)throw new Error('That spell is not available to this class at this level.');return s;});
  const newCantrips=spells.filter(s=>s.level===0&&!oldKeys.has(s.id));
  // Missing older selections can be filled now; existing species/feat spells do
  // not consume the class allowance when their origin is known.
  const classCantrips=character.spells.filter(s=>s.level===0&&!s.origin&&plan.available.some(a=>a.id===spellKey(s.name))).length;
  if(newCantrips.length>Math.max(plan.cantripGain,plan.after.cantrips-classCantrips))throw new Error('Too many new class cantrips selected.');
  const ordinary=spells.filter(s=>s.level>0&&s.level<=plan.maxSpellLevel);
  const grantedKeys=new Set(plan.grant.map(s=>s.id));
  const existingClass=character.spells.filter(s=>s.level>0&&!s.origin&&!grantedKeys.has(spellKey(s.name))&&plan.available.some(a=>a.id===spellKey(s.name)));
  if(['Bard','Sorcerer','Warlock'].includes(c.class)&&ordinary.filter(s=>!oldKeys.has(s.id)).length>Math.max(plan.spellGain,plan.after.prepared-existingClass.length))throw new Error('Too many new class spells selected.');
  const wizardSpecial=picked.filter(p=>p.choice.id==='signature'||p.choice.id.startsWith('spellMastery')).map(p=>p.option.spell);
  if(c.class==='Wizard'&&new Set([...ordinary,...wizardSpecial].filter(s=>!oldKeys.has(s.id)).map(s=>s.id)).size>2)throw new Error('A Wizard adds two spells to their spellbook when gaining a level, in addition to Savant spells.');
  if(picked.some(p=>p.choice.id==='savant'&&ids.includes(p.option.id)))throw new Error('Choose different spells for Savant and your ordinary spellbook additions.');
  const prepared=selection.preparedIds??existingClass.filter(s=>s.prepared).map(s=>s.id);
  if(!Array.isArray(prepared)||prepared.some(id=>!existingClass.some(s=>s.id===id)))throw new Error('Choose valid prepared spells.');
  const alreadyPrepared=new Set(existingClass.filter(s=>prepared.includes(s.id)).map(s=>spellKey(s.name)));
  const newPrepared=new Set([...(c.class==='Wizard'&&selection.prepareNewSpells!==true?[]:[...ordinary.map(s=>s.id),...picked.filter(p=>p.choice.id==='savant').map(p=>p.option.id)]).filter(id=>!oldKeys.has(id)),...picked.filter(p=>p.choice.id.startsWith('spellMastery')).map(p=>p.option.id).filter(id=>!alreadyPrepared.has(id))]).size;
  if(['Cleric','Druid','Paladin','Ranger','Wizard','Artificer'].includes(c.class)&&prepared.length+newPrepared>plan.after.prepared)throw new Error(`Prepare at most ${plan.after.prepared} class spells. Uncheck earlier preparations to make room.`);
  for(const spell of existingClass)c.spells.find(s=>s.id===spell.id).prepared=prepared.includes(spell.id);
  const arcanum=spells.filter(s=>plan.arcanum&&s.level===plan.arcanum);
  if(plan.arcanum&&arcanum.length!==1)throw new Error(`Choose one level ${plan.arcanum} Mystic Arcanum spell.`);
  const addSpell=(spell,origin='',prepared=true)=>{
    const existing=c.spells.find(s=>spellKey(s.name)===spell.id);
    if(existing){if(origin){existing.prepared=true;existing.origins=[...new Set([...(existing.origins||[]),...(existing.origin?[existing.origin]:[]),origin])];existing.origin=existing.origin||origin;}return;}
    const {classes,id,source,ritual,at,...fields}=spell;
    c.spells.push({...fields,id:uid(),prepared,origin,notes:`${origin?origin+'\n\n':''}${spell.notes}`});
  };
  for(const spell of spells)addSpell(spell,spell.level>plan.maxSpellLevel?'Mystic Arcanum':'',spell.level===0||c.class!=='Wizard'||selection.prepareNewSpells===true);
  for(const {old,next} of swaps){c.spells=c.spells.filter(s=>s.id!==old.id);addSpell(next);}
  for(const {choice,option} of picked)if(choice.kind==='spell'){
    const mastery=choice.id.startsWith('spellMastery');
    addSpell(option.spell,choice.id==='savant'||mastery?'':choice.label,choice.id!=='savant'||selection.prepareNewSpells===true);
    if(mastery)c.spells.find(s=>spellKey(s.name)===option.id).prepared=true;
  }
  for(const {choice,option} of picked)if(choice.id==='signature'||choice.id.startsWith('spellMastery'))addFeature(c,{...reference(`${choice.label}: ${option.label}`,'Wizard',c.level),details:`Selected ${option.label}. ${choice.id==='signature'?'One free level 3 casting per Short or Long Rest.':'Eligible at-will casting while prepared; consult Spell Mastery restrictions.'}`,resource:choice.id==='signature'?'one-short':undefined});
  for(const spell of plan.grant)addSpell(spell,spell.origin);
  if(arcanum.length){const resource=c.features.find(f=>f.name===`Mystic Arcanum (${plan.arcanum}th-level spell)`);if(resource)resource.description+=`\nSelected spell: ${arcanum[0].name}.`;
  }
  if(plan.after.prepared&&selection.updateSlots!==false){
    const spent=c.slots.reduce((sum,s)=>sum+s.used,0);
    c.slots.forEach((s,i)=>{s.max=plan.after.slots[i];s.used=Math.min(s.used,s.max);});
    if(c.class==='Warlock'){const slot=c.slots.find(s=>s.max>0);if(slot)slot.used=Math.min(slot.max,spent);}
  }
  if(c.class==='Warlock')c.pactMagic=true;
  if(['Eldritch Knight','Arcane Trickster'].includes(c.subclass)&&c.spellAbility==='auto')c.spellAbility='int';
  for(const spell of plan.grant.filter(s=>s.level>0&&(/lineage|free casting/.test(s.origin))&&!/at will/.test(s.origin))){
    const lineage=spell.origin.includes('lineage'),owner=lineage?c.race:spell.origin.split(' (')[0],name=`${owner}: ${spell.name}`;
    if(!c.features.some(f=>f.maxUses>0&&(normalized(f.name)===normalized(name)||!lineage&&normalized(f.name)===normalized(owner)||lineage&&normalized(f.name).includes(normalized(spell.name))&&/\(lineage\)/.test(f.name)))){
      addFeature(c,{...reference(name,owner,c.level),details:`${spell.origin}. Free ${spell.name} casting; choose No slot in Spellbook and spend a use here.`,resource:c.race==='Forest Gnome'&&lineage?'pb-long':/Short or Long/.test(spell.origin)?'one-short':'one-long'});
    }
  }
  for(const line of String(selection.customFeatures||'').split('\n').map(s=>s.trim()).filter(Boolean)){
    if(line.length>200)throw new Error('Keep each custom feature name within 200 characters.');
    addFeature(c,reference(line,c.subclass||c.race,c.level,'2014'));
  }
  for(const line of String(selection.customSpells||'').split('\n').map(s=>s.trim()).filter(Boolean)){
    const match=line.match(/^([0-9])\s*\|\s*(.{1,200})$/);
    if(!match)throw new Error('Enter additional spells as level | name, for example 2 | My book’s spell.');
    const name=match[2].trim();if(!name)throw new Error('Enter a name for each additional spell.');
    addSpell({id:spellKey(name),name,level:Number(match[1]),school:'Other',castingTime:'See spell rules',range:'See spell rules',duration:'See spell rules',concentration:false,wiki:`${RULES_URL}/spell-descriptions`,notes:'Book / table selection during level-up. Fill casting details and effects from your source in the spell editor.'},'Book / table choice');
  }
  c.skills=[...new Set(c.skills)];c.expertise=[...new Set(c.expertise)];
  c.maxHp=Math.min(9999,c.maxHp);c.hp=Math.min(c.hp,c.maxHp);
  parseBackup(JSON.stringify({version:SAVE_VERSION,activeId:c.id,characters:[c],settings:{sound:false}}));
  Object.assign(character,c);
  return character;
}
