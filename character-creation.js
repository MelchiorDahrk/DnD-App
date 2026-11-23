import {ABILITIES, SKILLS, SAVE_VERSION, makeCharacter, parseBackup, castingAbility, mod, proficiency, randomDie, rollDice, uid, wikiURL} from './model.js';
import {BACKGROUNDS, BASIC_EQUIPMENT, CLASS_OPTIONS, SPECIES, WEAPONS, applyStartingOptions, itemFromEquipment} from './catalog.js';
import {FEATURE_CATALOG} from './feature-catalog.js';
import {SPELL_CATALOG} from './progression-data.js';
import {addProgressionFeature, addProgressionSpell, eligibleFeat, levelOnePlan, originFeatChoices, spellKey} from './level-up.js';
import {LANGUAGE_GROUPS, TOOL_NAMES, ensureTraining, hasArmorTraining, trainingKey} from './training-rules.js';
import {contentEnabled, visibleContent} from './content-sources.js';
import {armorClass, itemDefense, setItemEquipped} from './armor-class.js';
import {linkWeaponActions} from './inventory.js';
import {parsePrice} from './shop-model.js';
import {syncSpellSlots} from './spell-slots.js';
import {artisanTools, instruments, gamingSets, holySymbols, simpleWeapons, classEquipment, backgroundEquipment} from './character-creation-equipment.js';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_COST = {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9};
export const CREATION_STEPS = ['Identity and class', 'Species and background', 'Ability scores', 'Training', 'Features and feats', 'Starting spells', 'Starting equipment', 'Review'];
export const WIZARD_STARTER_SPELLS = {
  classCantrips:['light','magehand','rayoffrost'],
  classSpells:['detectmagic','featherfall','magearmor','magicmissile','sleep','thunderwave'],
  wizardPrepared:['featherfall','magearmor','magicmissile','sleep']
};
export const LINEAGES = {
  Elf: ['Drow', 'High Elf', 'Wood Elf'],
  Gnome: ['Forest Gnome', 'Rock Gnome'],
  Tiefling: ['Abyssal Tiefling', 'Chthonic Tiefling', 'Infernal Tiefling']
};
const legacySpecies = [
  {name:'Half-Elf', size:'Medium', speed:30, senses:'Darkvision 60 ft.', details:'Earlier-book traits, with ability increases from your background.', wiki:wikiURL('Half-Elf','species','2014')},
  {name:'Half-Orc', size:'Medium', speed:30, senses:'Darkvision 60 ft.', details:'Earlier-book traits, with ability increases from your background.', wiki:wikiURL('Half-Orc','species','2014')}
];
const draconic = {Black:'Acid', Blue:'Lightning', Brass:'Fire', Bronze:'Lightning', Copper:'Acid', Gold:'Fire', Green:'Poison', Red:'Fire', Silver:'Cold', White:'Cold'};
const giant = {
  'Cloud’s Jaunt':'Bonus Action teleport up to 30 feet to an unoccupied space you can see.',
  'Fire’s Burn':'When you hit and damage a target, deal an extra 1d10 Fire damage.',
  'Frost’s Chill':'When you hit and damage a target, deal an extra 1d6 Cold damage and reduce its Speed by 10 feet until your next turn starts.',
  'Hill’s Tumble':'When you hit and damage a Large or smaller target, you can knock it Prone.',
  'Stone’s Endurance':'Use your Reaction to reduce incoming damage by 1d12 plus your Constitution modifier.',
  'Storm’s Thunder':'After taking damage, use your Reaction to deal 1d8 Thunder damage to the creature that dealt it if it is within 60 feet.'
};
const fiendish = {'Abyssal Tiefling':'Poison', 'Chthonic Tiefling':'Necrotic', 'Infernal Tiefling':'Fire'};
const abilityIds = Object.keys(ABILITIES);
const skills = Object.keys(SKILLS);
const mental = ['int','wis','cha'].map(id => ({id, label:ABILITIES[id]}));
const allLanguages = [...LANGUAGE_GROUPS.Standard, ...LANGUAGE_GROUPS.Rare];
const option = value => typeof value === 'string' ? {id:value,label:value} : value;
const itemsAsOptions = items => items.map(item => ({id:item.id,label:item.name,item}));
const spellOption = spell => ({id:spell.id,label:spell.name,spell});
const listed = text => text.split(',').map(value => value.trim());

export function newCharacterDraft() {
  return {name:'', class:'', species:'', background:'', targetLevel:1, method:'array', assignments:{}, pointBuy:{}, manual:{}, bonuses:{}, rolls:[], choices:{}};
}

export function rollStartingScores(roller = randomDie) {
  return Array.from({length:6}, () => {
    const roll = rollDice('4d6', 'normal', roller);
    const dropped = roll.rolls.indexOf(Math.min(...roll.rolls));
    return {dice:roll.rolls, dropped, total:roll.total-roll.rolls[dropped]};
  });
}

export function startingAbilities(draft, eligible = []) {
  const errors = [], base = {}, increases = {}, final = {};
  const pool = draft.method==='array' ? STANDARD_ARRAY : draft.rolls.map(roll => roll.total);
  const used = new Set();
  let spent = 0;
  for (const ability of abilityIds) {
    const assignment = draft.assignments[ability];
    const score = ['array','roll'].includes(draft.method)
      ? (/^[0-5]$/.test(assignment ?? '') ? pool[Number(assignment)] : undefined)
      : Number(draft.method==='points' ? draft.pointBuy[ability] ?? 8 : draft.manual[ability]);
    if (['array','roll'].includes(draft.method) && score !== undefined) {
      const index = Number(assignment);
      if (used.has(index)) errors.push('Assign each array entry or roll only once.');
      used.add(index);
    }
    if (!Number.isInteger(score) || score<1 || score>20 || (draft.method==='points' && !Object.hasOwn(POINT_COST,score))) {
      errors.push(`Choose a valid base score for ${ABILITIES[ability]}.`);
    } else {
      base[ability] = score;
      if (draft.method==='points') spent += POINT_COST[score];
    }
    increases[ability] = Number(draft.bonuses[ability] ?? 0);
    if (!Number.isInteger(increases[ability]) || increases[ability]<0 || increases[ability]>2 || (increases[ability] && !eligible.includes(ability))) {
      errors.push(`Choose an eligible increase for ${ABILITIES[ability]}.`);
    }
    if (base[ability] !== undefined) {
      final[ability] = base[ability] + increases[ability];
      if (final[ability]>20) errors.push(`${ABILITIES[ability]} cannot exceed 20.`);
    }
  }
  if (!['array','roll','points','manual'].includes(draft.method)) errors.push('Choose an ability score method.');
  if (spent>27) errors.push(`Point buy costs ${spent} points. The budget is 27.`);
  const pattern = Object.values(increases).filter(Boolean).sort().join(',');
  if (!['1,2','1,1,1'].includes(pattern)) errors.push('Assign +2 and +1 to two eligible abilities, or +1 to three.');
  return {base,increases,final,spent,errors:[...new Set(errors)]};
}

function startingPackages(rows, preview) {
  return rows.map((row,index) => ({
    id:String(index), label:row.items.length
      ? `Package ${String.fromCharCode(65+index)} · ${row.items.map(([id,qty,name]) => `${qty>1?`${qty} × `:''}${name || preview(id)}`).join(', ')}${row.gold?` + ${row.gold} GP`:''}`
      : `${row.gold} GP`
  }));
}

export function creationPlan(draft, settings = {}, through = 7) {
  const errors = CREATION_STEPS.map(() => []);
  const groups = CREATION_STEPS.map(() => []);
  const classes = visibleContent(CLASS_OPTIONS,settings,'class');
  const species = visibleContent([...SPECIES.filter(s => !Object.values(LINEAGES).flat().includes(s.name)),...legacySpecies],settings,'race');
  const backgrounds = visibleContent(BACKGROUNDS,settings,'background');
  const cls = classes.find(row => row.name===draft.class);
  const background = backgrounds.find(row => row.name===draft.background);
  const speciesRow = species.find(row => row.name===draft.species);
  const customSpecies = draft.species==='custom', customBackground = draft.background==='custom';
  const name = String(draft.name ?? '').trim();
  const targetLevel = Number(draft.targetLevel);
  if (!name || name.length>120) errors[0].push('Enter a character name of 1–120 characters.');
  if (!cls) errors[0].push('Choose an enabled class.');
  if (String(draft.playerName || '').length>120 || String(draft.campaign || '').length>500) errors[0].push('Keep the player name within 120 characters and campaign within 500.');
  if (targetLevel!==1) errors[0].push('New characters must start at level 1.');

  const choose = (step,id,label,count,options,details='') => {
    if (!count || step>through) return [];
    options = options.map(option).filter(o =>
      (!o.entry || contentEnabled(o.entry,settings)) &&
      (!o.item || contentEnabled(o.item,settings,'item')) &&
      (!o.spell || contentEnabled(o.spell,settings,'spell'))
    );
    groups[step].push({id,label,count,options,details});
    const value = draft.choices[id] ?? [];
    const picked = Array.isArray(value) ? [...new Set(value)].map(key => options.find(o => o.id===key)).filter(Boolean) : [];
    if (picked.length!==count || value.length!==count) errors[step].push(`Choose ${count} for ${label}.`);
    return picked.slice(0,count);
  };
  const one = (...args) => choose(...args)[0]?.id;
  const customName = (key,label) => {
    const text = String(draft[key] ?? '').trim();
    if (!text || text.length>120) errors[1].push(`Enter a ${label} name of 1–120 characters.`);
    return text;
  };
  const lineageName = Object.hasOwn(LINEAGES,draft.species) && one(1,'lineage','Species lineage',1,
    SPECIES.filter(row => LINEAGES[draft.species].includes(row.name) && contentEnabled(row,settings,'race')).map(row => ({id:row.name,label:row.name,entry:row})));
  const lineage = SPECIES.find(row => row.name===lineageName) || speciesRow;
  const sizeOptions = lineage?.size.split(' or ') || ['Small','Medium'];
  const size = sizeOptions.length===1 && !customSpecies ? sizeOptions[0] : (lineage || customSpecies) && one(1,'size','Size',1,sizeOptions);
  if ((!customSpecies && !speciesRow) || (!customBackground && !background)) errors[1].push('Choose an enabled species and background, or enter a table-approved option.');
  const race = customSpecies ? customName('customSpecies','species') : lineage?.name || '';
  const backgroundName = customBackground ? customName('customBackground','background') : background?.name || '';
  const customSpeed = Number(draft.customSpeed ?? 30);
  if (customSpecies && (!Number.isInteger(customSpeed) || customSpeed<0 || customSpeed>999)) errors[1].push('Enter a valid walking speed.');
  const eligible = background ? listed(background.abilities.toLowerCase()).map(a => a.slice(0,3)) : abilityIds;
  const abilities = startingAbilities(draft,eligible);
  errors[2].push(...abilities.errors);
  const c = makeCharacter({
    name, class:cls?.name, race, background:backgroundName,
    playerName:String(draft.playerName ?? '').trim(), campaign:String(draft.campaign ?? '').trim(),
    alignment:String(draft.alignment || 'Unaligned'),
    stats:Object.fromEntries(abilityIds.map(id => [id,abilities.final[id] || 10])),
    ...(size ? {size} : {})
  });
  if (cls) applyStartingOptions(c);
  if (lineage) {c.speed=lineage.speed; c.senses=lineage.senses;}
  if (customSpecies) {c.speed=customSpeed; c.senses=String(draft.customSenses ?? '').trim();}
  const training = ensureTraining(c);
  c.trainingOrigins = {};
  const grantTraining = (group,value,source) => {
    if (!value) return;
    const list = ['skills','saves','expertise'].includes(group) ? c[group] : training[group];
    if (!list.includes(value)) list.push(value);
    const origins = (c.trainingOrigins[group] ??= Object.create(null))[value] ??= [];
    if (!origins.includes(source)) origins.push(source);
  };
  const classSource = `Class · ${c.class}`, backgroundSource = `Background · ${c.background}`, speciesSource = `Species · ${c.race}`;
  if (cls) for (const [group,values] of Object.entries({saves:c.saves, armor:training.armor, weapons:training.weapons})) {
    for (const value of values) grantTraining(group,value,classSource);
  }
  if (background) for (const skill of listed(background.skills)) grantTraining('skills',skill,backgroundSource);
  if (customBackground) for (const picked of choose(3,'backgroundSkills','Background skills',2,skills)) grantTraining('skills',picked.id,backgroundSource);

  const byToolName = name => BASIC_EQUIPMENT.find(i => i.id===trainingKey(name));
  const backgroundToolChoices = customBackground ? TOOL_NAMES.map(byToolName).filter(Boolean)
    : /Artisan/.test(background?.tool || '') ? artisanTools
    : /Musical/.test(background?.tool || '') ? instruments
    : /Gaming/.test(background?.tool || '') ? gamingSets : [];
  const bgTool = backgroundToolChoices.length
    ? one(3,'backgroundTool','Background tool',1,itemsAsOptions(backgroundToolChoices))
    : background?.tool && trainingKey(background.tool);
  grantTraining('tools',bgTool,backgroundSource);
  const classTools = {Druid:['herbalism-kit'], Rogue:['thieves-tools'], Artificer:['thieves-tools','tinkers-tools']};
  for (const tool of classTools[c.class] || []) grantTraining('tools',tool,classSource);
  const trainingTools = items => itemsAsOptions(items.filter(item => !training.tools.includes(item.id)));
  if (['Artificer','Bard','Monk'].includes(c.class)) {
    const pool = {Artificer:artisanTools, Bard:instruments, Monk:[...artisanTools,...instruments]}[c.class];
    const label = c.class==='Bard' ? 'Bard instrument proficiencies' : `${c.class} tool proficiency`;
    for (const picked of choose(3,'classTool',label,c.class==='Bard'?3:1,trainingTools(pool))) grantTraining('tools',picked.id,classSource);
  }
  if (cls) {
    const allowed = /^Any/.test(cls.skills) ? skills : listed(cls.skills);
    for (const picked of choose(3,'classSkills',`${cls.name} skills`,cls.skillCount,allowed.filter(skill => !c.skills.includes(skill)))) grantTraining('skills',picked.id,classSource);
  }
  for (const skill of c.race==='Half-Orc' ? ['Intimidation'] : []) {
    if (c.skills.includes(skill)) {
      const replacement = one(3,'speciesReplacement','Replacement for overlapping Intimidation',1,skills.filter(s => !c.skills.includes(s)));
      grantTraining('skills',replacement,speciesSource);
    }
    grantTraining('skills',skill,speciesSource);
  }
  const speciesSkills = draft.species==='Elf' ? ['Insight','Perception','Survival'] : skills;
  const speciesSkillCount = {'Elf':1,'Human':1,'Half-Elf':2}[draft.species] || 0;
  const untrainedSpeciesSkills = speciesSkills.filter(skill => !c.skills.includes(skill));
  const speciesSkillChoice = untrainedSpeciesSkills.length>=speciesSkillCount ? untrainedSpeciesSkills : skills.filter(skill => !c.skills.includes(skill));
  for (const picked of choose(3,'speciesSkills',`${draft.species} skill proficiency`,speciesSkillCount,speciesSkillChoice,
    untrainedSpeciesSkills.length<speciesSkillCount ? 'Choose a replacement for the overlapping proficiency.' : '')) grantTraining('skills',picked.id,speciesSource);
  grantTraining('languages','Common','Character creation');
  if (c.class==='Rogue') grantTraining('languages','Thieves’ Cant',classSource);
  if (c.class==='Druid') grantTraining('languages','Druidic',classSource);
  for (const picked of choose(3,'languages','Standard languages',2,LANGUAGE_GROUPS.Standard.filter(s => s!=='Common'))) grantTraining('languages',picked.id,'Character creation');
  if (c.class==='Rogue' || c.race==='Half-Elf') {
    const picked = one(3,'classLanguage',c.class==='Rogue'?'Thieves’ Cant additional language':'Half-Elf additional language',1,allLanguages.filter(s => !training.languages.includes(s)));
    grantTraining('languages',picked,c.class==='Rogue'?classSource:speciesSource);
    if (c.class==='Rogue' && c.race==='Half-Elf') grantTraining('languages',one(3,'legacyLanguage','Half-Elf additional language',1,allLanguages.filter(s => !training.languages.includes(s))),speciesSource);
  }
  if (customSpecies || customBackground) for (const language of listed(String(draft.customLanguages || '')).filter(Boolean)) {
    if (language.length>100) errors[3].push('Keep each additional language within 100 characters.');
    else grantTraining('languages',language,'Custom · table choice');
  }
  if (customSpecies) {
    const count = key => {
      const value=Number(draft[key] || 0);
      if (Number.isInteger(value) && value>=0 && value<=6) return value;
      errors[3].push('Select from zero to six additional species skills or tools.');
      return 0;
    };
    for (const picked of choose(3,'customSpeciesSkills','Custom species skills',count('customSkillCount'),skills.filter(s=>!c.skills.includes(s)))) grantTraining('skills',picked.id,speciesSource);
    for (const picked of choose(3,'customSpeciesTools','Custom species tools',count('customToolCount'),trainingTools(TOOL_NAMES.map(byToolName).filter(Boolean)))) grantTraining('tools',picked.id,speciesSource);
  }

  const ancestry = draft.species==='Dragonborn' && one(4,'dragon','Draconic ancestry',1,Object.entries(draconic).map(([id,type]) => ({id,label:`${id} · ${type}`})));
  const giantAncestry = draft.species==='Goliath' && one(4,'giant','Giant ancestry',1,Object.keys(giant));
  const order = c.class==='Cleric' ? 'Divine Order' : 'Primal Order';
  const orderChoice = ['Cleric','Druid'].includes(c.class) && one(4,'order',order,1,c.class==='Cleric'
    ? [{id:'Protector',label:'Protector · Martial weapons and Heavy armor'},{id:'Thaumaturge',label:'Thaumaturge · extra cantrip and Lore bonus'}]
    : [{id:'Warden',label:'Warden · Martial weapons and Medium armor'},{id:'Magician',label:'Magician · extra cantrip and Nature bonus'}]);
  if (['Protector','Warden'].includes(orderChoice)) {
    grantTraining('armor',orderChoice==='Protector'?'Heavy':'Medium',`${classSource} · ${order}`);
    for (const weapon of WEAPONS.filter(w => w.family.startsWith('Martial'))) grantTraining('weapons',weapon.id,`${classSource} · ${order}`);
  }
  const plan = cls && levelOnePlan(c);
  const addFeature = (entry,origin) => addProgressionFeature(c,entry,origin);
  const referenceFeature = (name,details,source,wiki,resource) => addFeature({id:`creation-${trainingKey(name)}`,name,details,wiki,resource},source);
  const override = {
    'Giant Ancestry':giantAncestry, 'Draconic Ancestry':ancestry && `${ancestry} dragon · ${draconic[ancestry]}`,
    'Damage Resistance':ancestry && `Resistance to ${draconic[ancestry]} damage.`,
    'Breath Weapon':ancestry && `${draconic[ancestry]} damage. Dexterity save DC ${8+mod(c.stats.con)+proficiency(c.level)}. Choose a 15-foot Cone or a 30-foot Line when you use it.`,
    'Celestial Resistance':'Resistance to Necrotic and Radiant damage.',
    'Keen Senses':draft.choices.speciesSkills?.join(', '),
    'Elven Lineage':lineageName, 'Gnomish Lineage':lineageName,
    'Fiendish Legacy':fiendish[c.race] && `${c.race} · Resistance to ${fiendish[c.race]} damage.`,
    'Skillful':draft.choices.speciesSkills?.join(', '), 'Dwarven Toughness':'Your maximum Hit Points increase by 1 for each character level.',
    'Resourceful':'Gain Heroic Inspiration after finishing a Long Rest.',
    'Divine Order':orderChoice==='Thaumaturge' ? 'Thaumaturge · Add your Wisdom modifier (minimum +1) to Arcana and Religion checks. You know one additional Cleric cantrip.' : orderChoice,
    'Primal Order':orderChoice==='Magician' ? 'Magician · Add your Wisdom modifier (minimum +1) to Arcana and Nature checks. You know one additional Druid cantrip.' : orderChoice
  };
  if (plan && through>=4) for (const entry of plan.fresh) {
    const trait = entry.group==='Species traits';
    if (customSpecies && trait) continue;
    if (Object.hasOwn(giant,entry.name) && giantAncestry!==entry.name) continue;
    const details = override[entry.name] || giant[entry.name];
    const feature = addFeature(details?{...entry,details}:entry,trait?speciesSource:classSource);
    const formula = {'Fire’s Burn':'1d10','Frost’s Chill':'1d6','Storm’s Thunder':'1d8'}[feature?.name];
    if(formula)feature.rollFormula=formula;
  }
  let invocation = '', fightingStyle = '';
  for (const ch of plan?.choices || []) {
    if (ch.kind==='spell' || ch.kind==='expertise') continue;
    for (const picked of choose(4,ch.id,ch.label,ch.count,ch.options)) {
      if (ch.kind==='mastery') referenceFeature(`Weapon Mastery: ${picked.label}`,`Selected mastery: ${picked.label}. Apply this mastery when using the weapon.`,classSource,cls.wiki);
      else if (picked.entry) addFeature(picked.entry,classSource);
      if (ch.id==='invocations') invocation=picked.label;
      if (ch.id==='style') fightingStyle=picked.label;
    }
  }
  const originFeats = FEATURE_CATALOG.filter(f => f.group==='Origin feats' && eligibleFeat(f,c));
  const featChoices = originFeats.map(entry => ({id:entry.id,label:entry.name,entry}));
  let firstFeat = originFeats.find(f => f.name===background?.feat);
  if (customBackground || background && draft.originFeatMode==='table') {
    const id = one(4,'backgroundFeat','Background Origin feat',1,featChoices);
    firstFeat = originFeats.find(f => f.id===id);
  } else if (background && (!firstFeat || !contentEnabled(firstFeat,settings)) && through>=4) errors[4].push(`${background.feat} is required by this background and must be enabled.`);
  const humanFeatId = draft.species==='Human' && one(4,'humanFeat','Human Origin feat',1,
    featChoices.filter(f => f.id!==firstFeat?.id || f.entry.repeatable));
  const humanFeat = originFeats.find(f => f.id===humanFeatId);
  const featSpells = [];
  for (const [prefix,feat,origin] of [['background',firstFeat,backgroundSource],['human',humanFeat,speciesSource]]) {
    if (!feat || through<4) continue;
    const feature = addFeature(feat,origin);
    if (feat.published) {
      const decisions = String(draft[`${prefix}FeatNotes`] || '').trim();
      if (!decisions || decisions.length>2000) errors[4].push(`Record ${feat.name} selections and table-managed effects from its source (1–2,000 characters).`);
      else feature.description+=`\n\nTable selections: ${decisions}`;
    }
    featSpells.push({prefix,feat,feature});
    const trainingChoices = [];
    for (const ch of originFeatChoices(feat,c).filter(ch => ch.kind!=='spell')) {
      for (const picked of choose(4,`${prefix}-${ch.id}`,ch.label,ch.count,ch.options)) {
        const skill = Object.hasOwn(SKILLS,picked.id);
        grantTraining(skill?'skills':'tools',skill?picked.id:trainingKey(picked.id),`Feat · ${feat.name} (${origin})`);
        trainingChoices.push(picked.label);
      }
    }
    if (trainingChoices.length) feature.description+=`\n\nSelected training: ${trainingChoices.join(', ')}.`;
  }
  if (c.class==='Rogue') {
    for (const picked of choose(4,'expertise','Rogue Expertise',2,c.skills)) grantTraining('expertise',picked.id,classSource);
  }
  if (customSpecies || customBackground || c.class==='Artificer') {
    const manualFeatures = String(draft.customFeatures || '').split('\n').map(line => line.trim()).filter(Boolean);
    if (customSpecies && !manualFeatures.length && through>=4) errors[4].push('Record the custom species traits or describe the table-approved rules.');
    for (const line of manualFeatures) {
      const [name,...description] = line.split('|');
      if (!name.trim() || name.trim().length>200 || line.length>4000) errors[4].push('Use Feature | notes, with a feature name of 1–200 characters.');
      else referenceFeature(name.trim(),description.join('|').trim(),'Custom · table choice',wikiURL('rules'));
    }
  }

  const grants = [];
  const addSpell = (spell,source,{ability,mode,feature} = {}) => {
    if (!contentEnabled(spell,settings,'spell')) {
      errors[5].push(`${source} requires ${spell.name}. Enable its content source to continue.`);
      return;
    }
    const stored = addProgressionSpell(c,spell,source);
    if (ability) (stored.castingGrants ??= []).push({origin:source,ability,mode,...(feature ? {featureId:feature.id} : {})});
    grants.push({spell,source,ability,mode});
  };
  if (plan && through>=5) {
    const lineageAbility = !customSpecies && (plan.grant.some(spell => spell.origin.includes('lineage')) || ['High Elf','Aarakocra'].includes(c.race))
      ? c.race==='Aasimar' ? 'cha' : one(5,'lineageAbility','Species spellcasting ability',1,mental,c.race==='Aarakocra'?'Wind Caller grants Gust of Wind at level 3.':'') : '';
    if (lineageAbility) c.lineageAbility=lineageAbility;
    const lookup = name => SPELL_CATALOG.find(s => s.id===spellKey(name));
    for (const spell of plan.grant) {
      const isSpecies = spell.origin.includes('lineage');
      if (isSpecies && customSpecies) continue;
      const forest = isSpecies && spell.level>0 && c.race==='Forest Gnome';
      const ranger = spell.origin.startsWith('Favored Enemy');
      const feature = c.features.find(f => f.name===(forest?'Speak with Animals (lineage)':'Favored Enemy'));
      addSpell(spell,spell.origin,{ability:isSpecies?lineageAbility:castingAbility(c),mode:forest||ranger?'free':spell.level?'slot':'at-will',feature:forest||ranger?feature:undefined});
    }
    for (const ch of plan.choices.filter(ch => !customSpecies && ch.id==='elfCantrip')) {
      for (const picked of choose(5,ch.id,ch.label,ch.count,ch.options)) addSpell(picked.spell,'High Elf lineage',{ability:lineageAbility,mode:'at-will'});
    }
    for (const {prefix,feat,feature} of featSpells) {
      const spellChoices = originFeatChoices(feat,c).filter(ch => ch.kind==='spell');
      const ability = spellChoices.length && one(5,`${prefix}-featAbility`,`${feat.name} casting ability`,1,mental);
      for (const ch of spellChoices) for (const picked of choose(5,`${prefix}-${ch.id}`,ch.label,ch.count,ch.options)) {
        addSpell(picked.spell,feat.name,{ability,mode:picked.spell.level?'free':'at-will',feature:picked.spell.level?feature:undefined});
      }
    }
    const byClass = plan.available.filter(s => s.level===0);
    const additionalCantrip = ['Thaumaturge','Magician'].includes(orderChoice) ? 1 : 0;
    const chosenCantrips = choose(5,'classCantrips',`${c.class} cantrips`,plan.after.cantrips+additionalCantrip,byClass.map(spellOption));
    const wizard = c.class==='Wizard';
    const listedSpells = choose(5,'classSpells',wizard?'Wizard spellbook':`${c.class} starting spells`,plan.spellGain,plan.available.filter(s => s.level>0 && !plan.grant.some(g => g.id===s.id && g.origin.includes('always prepared'))).map(spellOption));
    const prepared = wizard ? choose(5,'wizardPrepared','Wizard prepared spells',plan.after.prepared,listedSpells).map(s => s.id) : listedSpells.map(s => s.id);
    for (const picked of [...chosenCantrips,...listedSpells]) {
      const ready = picked.spell.level===0 || prepared.includes(picked.id);
      const stored = addProgressionSpell(c,picked.spell,'',ready);
      stored.classPrepared=ready;
      stored.origins=[...new Set([...(stored.origins || (stored.origin?[stored.origin]:[])),c.class])];
    }
    if (invocation==='Pact of the Chain') addSpell(lookup('Find Familiar'),invocation,{ability:'cha',mode:'at-will'});
    if (invocation==='Armor of Shadows') addSpell(lookup('Mage Armor'),invocation,{ability:'cha',mode:'at-will'});
    if (fightingStyle==='Fighting Style: Arcane Warrior') {
      const ability = one(5,'arcaneWarriorAbility','Arcane Warrior casting ability',1,mental,'Use the casting ability specified by your source.');
      for (const picked of choose(5,'arcaneWarriorCantrips','Arcane Warrior Wizard cantrips',2,SPELL_CATALOG.filter(s=>s.level===0&&s.classes.includes('Wizard')).map(spellOption))) {
        addSpell(picked.spell,'Arcane Warrior',{ability,mode:'at-will'});
      }
    }
    if (invocation==='Pact of the Tome') {
      const available = SPELL_CATALOG.filter(s => !c.spells.some(old => old.prepared && spellKey(old.name)===s.id));
      for (const [id,label,count,pool] of [
        ['tomeCantrips','Pact of the Tome cantrips',3,available.filter(s => s.level===0)],
        ['tomeRituals','Pact of the Tome rituals',2,available.filter(s => s.level===1 && s.ritual)]
      ]) for (const picked of choose(5,id,label,count,pool.map(spellOption))) addSpell(picked.spell,invocation,{ability:'cha',mode:picked.spell.level?'slot':'at-will'});
    }
    c.spellSlotMode='auto';
    syncSpellSlots(c);
  }
  const manualSpells = customSpecies || customBackground || featSpells.some(({feat})=>feat.published);
  if (manualSpells && through>=5) for (const line of String(draft.customSpells || '').split('\n').filter(line => line.trim())) {
    const [level,name,ability] = line.split('|').map(text => text.trim());
    if (!/^[1-9]$|^0$/.test(level) || !name || name.length>200 || !Object.hasOwn(ABILITIES,ability)) {
      errors[5].push('Enter custom spells as level | name | ability abbreviation.');
      continue;
    }
    const known = SPELL_CATALOG.find(s => s.id===spellKey(name));
    if (known && known.level!==Number(level)) {errors[5].push(`${name} is a level ${known.level} spell in the catalog.`);continue;}
    addSpell(known || {id:spellKey(name),name,level:Number(level),school:'Other',castingTime:'See spell rules',range:'See spell rules',duration:'See spell rules',concentration:false,wiki:wikiURL(name,'spell'),notes:'Table-approved spell.',source:'Custom'},'Custom · table choice',{ability,mode:Number(level)?'slot':'at-will'});
  }

  let shop=[], shoppingTotal=0;
  if (cls && through>=6) {
    const gearById = id => BASIC_EQUIPMENT.find(item => item.id===id);
    const packageChoices = {
      bardInstrument:instruments, classSymbol:holySymbols, backgroundSymbol:holySymbols, wayfarerGame:gamingSets,
      artificerArmor:['studded-leather-armor','scale-mail'].map(gearById), artificerWeapon1:simpleWeapons, artificerWeapon2:simpleWeapons
    };
    const preview = id => id.startsWith('@') ? ({backgroundTool:'your background tool',classTool:'your class tool',bardInstrument:'musical instrument',classSymbol:'holy symbol',backgroundSymbol:'holy symbol',wayfarerGame:'gaming set',artificerArmor:'armor',artificerWeapon1:'simple weapon',artificerWeapon2:'simple weapon'})[id.slice(1)] : gearById(id)?.name || id;
    const classGear = classEquipment[c.class];
    const bgGear = background ? [backgroundEquipment[background.name],{gold:50,items:[]}] : [{gold:50,items:[]}];
    const packageAvailable = row => row.items.every(([id]) => id.startsWith('@') || (gearById(id) && contentEnabled(gearById(id),settings,'item')));
    const addItem = (id,qty,name) => {
      const entry = gearById(id);
      if (!entry || !contentEnabled(entry,settings,'item')) {errors[6].push(`This package requires an unavailable item (${id}).`);return;}
      const staff = ['staff-arcane-focus','wooden-staff-druidic-focus'].includes(id);
      const label = staff ? `Quarterstaff (${id==='staff-arcane-focus'?'Arcane':'Druidic'} Focus)` : name || entry.name;
      const existing = c.items.find(i => i.catalogId===id && i.name===label);
      if (existing) existing.qty+=qty;
      else c.items.push({...itemFromEquipment(entry),qty,name:label,...(staff?{category:'Weapon'}:{})});
    };
    for (const [kind,rows] of [['class',classGear],['background',bgGear]]) {
      const key = one(6,`${kind}Package`,`${kind==='class'?'Class':'Background'} equipment`,1,startingPackages(rows,preview).filter(o => packageAvailable(rows[Number(o.id)])));
      if (key===undefined) continue;
      const row = rows[Number(key)];
      c.gold+=row.gold;
      for (const [id,qty,name] of row.items) {
        const dynamic = id.slice(1);
        const options = packageChoices[dynamic];
        const pick = !id.startsWith('@') ? id
          : dynamic==='backgroundTool' ? bgTool
          : dynamic==='classTool' ? draft.choices.classTool?.[0]
          : options && one(6,dynamic,`${kind==='class'?'Class':'Background'} ${preview(id)}`,1,itemsAsOptions(options));
        if (pick) {
          // Ammunition is tracked by the inventory as a bundle with its own use counter.
          const bundle = Number(gearById(pick)?.details.match(/^(\d+) pieces per bundle/)?.[1]);
          addItem(pick,bundle?qty/bundle:qty,name);
        }
      }
    }
    if (invocation==='Pact of the Blade') {
      const pact = one(6,'pactWeapon','Initial pact weapon',1,itemsAsOptions(WEAPONS.filter(w => w.family.endsWith('melee'))),
        'Conjure and bond with this weapon. You can change your bond in play.');
      if (pact) {
        addItem(pact,1,`${gearById(pact).name} (Pact Weapon)`);
      }
    }
    const crafter = featSpells.some(({feat})=>feat.name==='Crafter');
    const priceFactor = crafter ? 0.8 : 1;
    shop = BASIC_EQUIPMENT.filter(item => !item.magic && !['pistol','musket','bullets-firearm'].includes(item.id) && contentEnabled(item,settings,'item'))
      .map(item=>({item, price:parsePrice(item.cost)}))
      .filter(({price})=>price!==null && Math.floor(price*priceFactor)<=c.gold*100)
      .map(({item,price})=>({id:item.id,label:item.name,price:Math.floor(price*priceFactor)}));
    for (const {id,quantity} of draft.purchases || []) {
      const row = shop.find(item=>item.id===id),count=Number(quantity);
      if (!row || !Number.isInteger(count) || count<1 || count>999) {
        errors[6].push('Choose an available item and a quantity from 1 to 999 for each purchase.');
        continue;
      }
      shoppingTotal+=row.price*count;
      addItem(id,count);
    }
    if (shoppingTotal>c.gold*100) errors[6].push('Starting equipment purchases exceed your starting money.');
    else {
      const change=c.gold*100-shoppingTotal;
      c.gold=Math.floor(change/100);c.silver=Math.floor(change%100/10);c.copper=change%10;
    }
    for (const [id,label,matching] of [
      ['equipArmor','Wear armor',armor=>armor.family!=='Shield'],['equipShield','Wield shield',armor=>armor.family==='Shield']
    ]) {
      const worn = c.items.filter(item=>{
        const armor=itemDefense(item).armor;
        return armor && matching(armor) && hasArmorTraining(c,armor.family);
      });
      if (!worn.length) continue;
      const picks = [{id:'none',label:'Leave in pack'},...worn.map(item=>({id:item.catalogId,label:item.name}))];
      groups[6].push({id,label,count:1,options:picks,defaultValue:worn[0].catalogId});
      const saved = draft.choices[id]?.[0];
      const key = picks.some(o=>o.id===saved) ? saved : worn[0].catalogId;
      const item = worn.find(item=>item.catalogId===key);
      if (item) setItemEquipped(c,item,true);
    }
    linkWeaponActions(c);
    const monk = c.class==='Monk' && !c.items.some(item=>item.equipped && itemDefense(item).armor);
    const tavern = featSpells.some(({feat})=>feat.name==='Tavern Brawler');
    const ability = monk && c.stats.dex>c.stats.str ? 'dex' : 'str';
    const modifier = mod(c.stats[ability]);
    const unarmedStyle = fightingStyle==='Fighting Style: Unarmed Fighting';
    const handsOccupied = c.items.some(item=>item.equipped&&(item.category==='Weapon'||itemDefense(item).armor?.family==='Shield'));
    const dice = unarmedStyle?(handsOccupied?'1d6':'1d8'):monk?'1d6':tavern?'1d4':'';
    const unarmed = {
      id:uid(),name:'Unarmed Strike',weaponId:'',mastery:'',ability,bonus:0,proficient:true,rollMode:'normal',
      damage:dice ? dice+(modifier>0?`+${modifier}`:modifier<0?String(modifier):'') : String(Math.max(0,1+modifier)),
      type:'Bludgeoning',range:'5 ft.',notes:unarmedStyle
        ? 'Unarmed Fighting uses a d6 while holding a weapon or Shield, or a d8 with neither. Resolve grapple damage separately.'
        : 'Damage option. Grapple and Shove use their saving throw rules.'
    };
    c.attacks.push(unarmed);
    if (c.race==='Aarakocra') c.attacks.push({
      ...unarmed,id:uid(),name:'Talons',type:'Slashing',damage:`1d6${modifier>0?`+${modifier}`:modifier||''}`,
      notes:'Aarakocra Unarmed Strike using talons.'
    });
  }
  const names = ids => ids.map(id => BASIC_EQUIPMENT.find(i => i.id===id)?.name || id);
  c.languages=training.languages.join(', ');
  c.toolProficiencies=names(training.tools).join(', ');
  c.armorProficiencies=training.armor.join(', ');
  if (draft.species==='Dwarf') c.maxHp++;
  if (featSpells.some(({feat}) => feat.name==='Tough')) c.maxHp+=2;
  c.hp=c.maxHp;
  c.ac=armorClass(c);
  return {character:c,classes,species,backgrounds,cls,lineage,background,groups,errors,abilities,eligible,grants,featSpells,manualSpells,shop};
}

export function finishLevelOne(draft,settings = {}) {
  const plan = creationPlan(draft,settings);
  const error = plan.errors.flat()[0];
  if (error) throw new Error(error);
  return parseBackup(JSON.stringify({version:SAVE_VERSION,activeId:plan.character.id,characters:[plan.character],settings:{sound:false}})).characters[0];
}
