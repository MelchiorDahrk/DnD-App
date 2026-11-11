export const SAVE_VERSION = 2;
export const STORAGE_KEY = `questlog.v${SAVE_VERSION}`;
export const RULES_URL = 'https://www.dndbeyond.com/sources/dnd/br-2024';
export const ABILITIES = {str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma'};
export const SKILLS = {Acrobatics:'dex','Animal Handling':'wis',Arcana:'int',Athletics:'str',Deception:'cha',History:'int',Insight:'wis',Intimidation:'cha',Investigation:'int',Medicine:'wis',Nature:'int',Perception:'wis',Performance:'cha',Persuasion:'cha',Religion:'int','Sleight of Hand':'dex',Stealth:'dex',Survival:'wis'};
export const COINS = {copper:'cp',silver:'sp',electrum:'ep',gold:'gp',platinum:'pp'};
export const SHEET_TEXT = {personalityTraits:'Personality traits',ideals:'Ideals',bonds:'Bonds',flaws:'Flaws',languages:'Languages',armorProficiencies:'Armor training',weaponProficiencies:'Weapon proficiencies',toolProficiencies:'Tool & other proficiencies',senses:'Senses',defenses:'Armor, shield & defense notes'};
const sheetDefaults = () => Object.fromEntries([...Object.keys(SHEET_TEXT),'playerName'].map(key=>[key,'']).concat([['electrum',0],['platinum',0],['initiativeBonus',0],['passivePerceptionBonus',0]]));
export const CLASSES = {Artificer:8,Barbarian:12,Bard:8,Cleric:8,Druid:8,Fighter:10,Monk:8,Paladin:10,Ranger:10,Rogue:8,Sorcerer:6,Warlock:8,Wizard:6};
export const XP = [0,0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
export const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const mod = n => Math.floor((Number(n) - 10) / 2);
export const signed = n => `${n >= 0 ? '+' : ''}${n}`;
export const proficiency = level => 2 + Math.floor((level - 1) / 4);
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const exhaustionPenalty = c => 2 * c.exhaustion;
export const walkingSpeed = c => Math.max(0,c.speed - 5 * c.exhaustion);
export const abilityCheckBonus = (c,ability) => mod(c.stats[ability]) - exhaustionPenalty(c);
export const saveBonus = (c,ability) => abilityCheckBonus(c,ability) + (c.saves.includes(ability) ? proficiency(c.level) : 0);
export const attackBonus = (c,a) => abilityCheckBonus(c,a.ability) + a.bonus + (a.proficient ? proficiency(c.level) : 0);
export function skillBonus(c, skill) { return abilityCheckBonus(c,SKILLS[skill]) + (c.expertise.includes(skill) ? 2 : c.skills.includes(skill) ? 1 : 0) * proficiency(c.level); }
export const initiative = c => abilityCheckBonus(c,'dex') + c.initiativeBonus;
export const passivePerception = c => 10 + skillBonus(c,'Perception') + c.passivePerceptionBonus;
export function validDiceFormula(value) {
  if (typeof value!=='string') return false;
  const m=value.toLowerCase().replace(/\s/g,'').match(/^(\d{0,2})d(\d{1,3})([+-]\d{1,4})?$/);
  return !!m && Number(m[1]||1)>=1 && Number(m[1]||1)<=50 && Number(m[2])>=2 && Number(m[2])<=100;
}
export function rollFeature(feature, roller = randomDie) {
  if (feature.maxUses && feature.used>=feature.maxUses) throw new Error('No uses remaining. Restore this resource before rolling.');
  const result=rollDice(feature.rollFormula,'normal',roller);
  if (feature.maxUses) feature.used++;
  return result;
}
export function castingAbility(c) { return Object.hasOwn(ABILITIES,c.spellAbility) ? c.spellAbility : ['Wizard','Artificer'].includes(c.class) ? 'int' : ['Bard','Paladin','Sorcerer','Warlock'].includes(c.class) ? 'cha' : 'wis'; }
export function wikiURL(label, category = '') {
  const key = label.toLowerCase().replace(/['’]/g,'').replace(/-/g,' ');
  const spellLinks = {'hunters mark':'2619166-hunters-mark','cure wounds':'2619079-cure-wounds','speak with animals':'2619059-speak-with-animals',longstrider:'2619004-longstrider',goodberry:'2618952-goodberry','ensnaring strike':'2619172-ensnaring-strike'};
  if (category==='spell') return spellLinks[key] ? `https://www.dndbeyond.com/spells/${spellLinks[key]}` : `${RULES_URL}/spell-descriptions`;
  const cls = Object.keys(CLASSES).find(name=>name.toLowerCase()===key);
  if (cls && cls!=='Artificer') return `${RULES_URL}/character-classes#${cls}`;
  if (category==='ranger') return `${RULES_URL}/character-classes#Ranger`;
  const sections = {classes:'character-classes',spells:'spell-descriptions',weapons:'equipment#Weapons',armor:'equipment#Armor',equipment:'equipment','adventuring-gear':'equipment#AdventuringGear','adventuring gear':'equipment#AdventuringGear','wondrous-items':'magic-items','wondrous items':'magic-items',backgrounds:'character-origins#CharacterBackgrounds',species:'character-origins#CharacterSpecies',feats:'feats',conditions:'rules-glossary',rules:'rules-glossary'};
  return `${RULES_URL}/${sections[category] || sections[key] || 'rules-glossary'}`;
}
export function referenceURL(url,label,category='') {
  return url ? safeURL(url) : wikiURL(label,category);
}
export function safeURL(url) {
  try { const u = new URL(url); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function makeCharacter(values = {}) {
  const cls = Object.hasOwn(CLASSES, values.class) ? values.class : 'Ranger';
  const stats = values.stats || {str:10,dex:14,con:14,int:10,wis:12,cha:10};
  const maxHp = CLASSES[cls] + mod(stats.con);
  return {
    ...sheetDefaults(),id:uid(),name:'New adventurer',race:'Human',class:cls,subclass:'',background:'',alignment:'Neutral Good',campaign:'A new adventure',level:1,xp:0,
    stats,hp:maxHp,maxHp,tempHp:0,ac:12,speed:30,gold:0,silver:0,copper:0,inspiration:false,initiativeAdvantage:false,
    hitDie:CLASSES[cls],hitDice:1,skills:[],expertise:[],saves:[],conditions:[],exhaustion:0,
    items:[],spells:[],slots:Array.from({length:9},()=>({max:0,used:0})),notes:[],features:[],attacks:[],
    concentration:'',spellAbility:'auto',deathSuccess:0,deathFailure:0,...values,class:cls
  };
}
export function demoCharacter() {
  const c = makeCharacter({name:'Lyra Ashwood',race:'Wood Elf',class:'Ranger',subclass:'Hunter',background:'Soldier',campaign:'The Lost Mines',level:3,xp:1450,
    stats:{str:12,dex:18,con:14,int:10,wis:16,cha:8},hp:24,maxHp:28,ac:15,speed:35,gold:74,silver:12,copper:8,hitDice:3,
    skills:['Stealth','Perception','Survival','Nature','Athletics','Intimidation'],expertise:['Survival'],saves:['str','dex'],
    languages:'Common, Elvish, Dwarvish, Sylvan, Goblin',armorProficiencies:'Light and Medium armor; Shields',weaponProficiencies:'Simple and Martial weapons',toolProficiencies:'Gaming set (dice)',senses:'Darkvision 60 ft.; Fey Ancestry; Trance',personalityTraits:'A former army scout, happiest under an open sky.',defenses:'Leather armor: 11 + 4 Dexterity = AC 15. Ability scores use rolled starting values and Soldier background increases.'});
  c.items = [
    {id:uid(),name:'Longbow',category:'Weapon',qty:1,weight:2,equipped:true,description:'1d8 piercing; range 150/600 ft.; ammunition, heavy, two-handed. Mastery: Slow. Heavy ranged weapons require Dexterity 13 to avoid disadvantage.',wiki:wikiURL('weapons')},
    {id:uid(),name:'Shortsword',category:'Weapon',qty:2,weight:2,equipped:true,description:'1d6 piercing; finesse, light. Mastery: Vex.',wiki:wikiURL('weapons')},
    {id:uid(),name:'Leather armor',category:'Armor',qty:1,weight:10,equipped:true,description:'AC 11 + Dexterity modifier. Armor class is tracked manually on your sheet.',wiki:wikiURL('armor')},
    {id:uid(),name:'Potion of healing',category:'Consumable',qty:2,weight:0.5,equipped:false,description:'As a Bonus Action, drink it or administer it to a creature within 5 ft. Restores 2d4 + 2 HP; using it here heals this character.',wiki:wikiURL('equipment')},
    {id:uid(),name:'Arrows',category:'Gear',qty:20,weight:0.05,equipped:false,description:'A quiver of goose-feather arrows.',wiki:wikiURL('weapons')},
    {id:uid(),name:"Explorer’s pack",category:'Gear',qty:1,weight:55,equipped:false,description:'Backpack, bedroll, 2 flasks of oil, 10 days of rations, rope, tinderbox, 10 torches, and waterskin. Adjust weight as supplies change.',wiki:wikiURL('adventuring-gear')},
    {id:uid(),name:'Moonstone pendant',category:'Treasure',qty:1,weight:0.1,equipped:false,description:'A keepsake from home. Warm to the touch under moonlight.',wiki:''}
  ];
  c.attacks = [
    {id:uid(),name:'Longbow',ability:'dex',bonus:2,proficient:true,damage:'1d8+4',type:'Piercing',range:'150 / 600 ft.',notes:'Includes +2 Archery. Slow mastery: on a damaging hit, reduce target speed by 10 ft. until the start of your next turn; repeated Slow hits do not stack.'},
    {id:uid(),name:'Shortsword',ability:'dex',bonus:0,proficient:true,damage:'1d6+4',type:'Piercing',range:'5 ft.',notes:'Vex mastery: on a damaging hit, gain advantage on your next attack against that creature before the end of your next turn. A Light extra attack uses a Bonus Action and deals 1d6 without the ability modifier.'}
  ];
  c.spells = [
    {id:uid(),name:"Hunter’s Mark",level:1,school:'Divination',castingTime:'1 Bonus Action',range:'90 ft.',duration:'Up to 1 hour',concentration:true,prepared:true,notes:'Always prepared via Favored Enemy. Adds 1d6 Force damage when an attack roll hits the marked target. For a free casting, select No slot and spend a Favored Enemy use in Features.',wiki:wikiURL('hunters-mark','spell')},
    {id:uid(),name:'Cure Wounds',level:1,school:'Abjuration',castingTime:'1 action',range:'Touch',duration:'Instantaneous',concentration:false,prepared:true,notes:'2024: heals 2d8 + Wisdom modifier (2d8+3 here). Each slot level above 1 adds 2d8. Apply healing separately.',wiki:wikiURL('cure-wounds','spell')},
    {id:uid(),name:'Speak with Animals',level:1,school:'Divination',castingTime:'1 action',range:'Self',duration:'10 minutes',concentration:false,prepared:true,notes:'Ritual: add 10 minutes to cast without a slot while prepared.',wiki:wikiURL('speak-with-animals','spell')},
    {id:uid(),name:'Ensnaring Strike',level:1,school:'Conjuration',castingTime:'1 Bonus Action, immediately after hitting with a weapon',range:'Self',duration:'Up to 1 minute',concentration:true,prepared:true,notes:'The target makes a Strength save or is Restrained. Use the 2024 spell description for damage and escape rules.',wiki:wikiURL('Ensnaring Strike','spell')},
    {id:uid(),name:'Goodberry',level:1,school:'Conjuration',castingTime:'1 action',range:'Self',duration:'24 hours',concentration:false,prepared:true,notes:'Creates 10 berries. A creature uses a Bonus Action to eat one and regain 1 HP.',wiki:wikiURL('Goodberry','spell')},
    {id:uid(),name:'Druidcraft',level:0,school:'Transmutation',castingTime:'1 action',range:'30 ft.',duration:'Instantaneous',concentration:false,prepared:true,notes:'Wood Elf lineage cantrip; uses Wisdom for this demo.',wiki:wikiURL('Druidcraft','spell')},
    {id:uid(),name:'Longstrider',level:1,school:'Transmutation',castingTime:'1 action',range:'Touch',duration:'1 hour',concentration:false,prepared:true,notes:'Wood Elf lineage: always prepared at level 3. One free casting per Long Rest; track its feature use. Otherwise spend a slot. Increase speed manually while active.',wiki:wikiURL('Longstrider','spell')}
  ];
  c.slots[0] = {max:3,used:1};
  const now = new Date().toISOString();
  c.notes = [
    {id:uid(),title:'The road to Phandalin',body:'Gundren has gone ahead with Sildar. We’re taking the supply wagon along the Triboar Trail.\n\nSomething about this job feels bigger than a simple delivery.',tag:'Session',pinned:true,updated:now},
    {id:uid(),title:'A favor for the innkeeper',body:'Find out what’s been prowling around the orchard after sundown. Ask Daran before we leave town.',tag:'Quest',pinned:false,updated:now},
    {id:uid(),title:'People worth remembering',body:'Gundren Rockseeker — our employer. Enthusiastic, terrible at keeping secrets.\nSildar Hallwinter — a steady sword and a kind word.',tag:'People',pinned:false,updated:now}
  ];
  c.features = [
    {id:uid(),name:'Favored Enemy',description:'Hunter’s Mark is always prepared. Cast it without a spell slot twice per Long Rest at this level. Spend a use here when choosing No slot in the spellbook.',maxUses:2,used:0,reset:'long',wiki:wikiURL('Ranger')},
    {id:uid(),name:'Weapon Mastery',description:'Chosen weapons: Longbow (Slow) and Shortsword (Vex). Change your choices on a Long Rest. Apply mastery effects at the table.',maxUses:0,used:0,reset:'manual',wiki:wikiURL('weapons')},
    {id:uid(),name:'Deft Explorer',description:'Expertise in Survival; two additional languages (Sylvan and Goblin) are recorded on the sheet.',maxUses:0,used:0,reset:'manual',wiki:wikiURL('Ranger')},
    {id:uid(),name:'Fighting Style: Archery',description:'The +2 bonus to ranged weapon attack rolls is included in the Longbow attack.',maxUses:0,used:0,reset:'manual',wiki:wikiURL('feats')},
    {id:uid(),name:'Hunter’s Lore',description:'While Hunter’s Mark affects a creature, learn its Immunities, Resistances, and Vulnerabilities, if any.',maxUses:0,used:0,reset:'manual',wiki:wikiURL('hunter','ranger')},
    {id:uid(),name:'Hunter’s Prey: Colossus Slayer',description:'Once per turn, a weapon hit deals an extra 1d8 damage if the target is below its HP maximum. Roll this damage separately. May switch to Horde Breaker on a Short or Long Rest.',maxUses:0,used:0,reset:'manual',rollFormula:'1d8',wiki:wikiURL('hunter','ranger')},
    {id:uid(),name:'Savage Attacker (Origin feat)',description:'Soldier background feat: once per turn when a weapon attack hits, roll the weapon’s damage dice twice and use either roll. Resolve this manually.',maxUses:0,used:0,reset:'manual',wiki:wikiURL('feats')},
    {id:uid(),name:'Wood Elf: Longstrider',description:'One free Longstrider casting per Long Rest. Choose No slot and spend this use; Wisdom is the chosen lineage spellcasting ability.',maxUses:1,used:0,reset:'long',wiki:wikiURL('species')}
  ];
  c.features = c.features.map(f=>({rollFormula:'',shortRestRecovery:0,...f}));
  c.attacks = c.attacks.map(a=>({rollMode:'normal',...a}));
  return c;
}

// Unbiased integer dice. Rejection sampling avoids modulo bias.
export function randomDie(sides, random = array => crypto.getRandomValues(array)) {
  const limit = Math.floor(4294967296 / sides) * sides;
  const data = new Uint32Array(1);
  do { random(data); } while (data[0] >= limit);
  return data[0] % sides + 1;
}
export function rollDice(expression, mode = 'normal', roller = randomDie) {
  const input = String(expression).toLowerCase().replace(/\s/g,'');
  const match = input.match(/^(\d{0,2})d(\d{1,3})([+-]\d{1,4})?$/);
  if (!match) throw new Error('Use dice notation like 1d20+4 or 2d6.');
  const count = Number(match[1] || 1), sides = Number(match[2]), bonus = Number(match[3] || 0);
  if (count < 1 || count > 50 || sides < 2 || sides > 100) throw new Error('Choose 1–50 dice, with 2–100 sides.');
  if (!['normal','advantage','disadvantage'].includes(mode)) throw new Error('Unknown roll mode.');
  if (mode !== 'normal' && (count !== 1 || sides !== 20)) throw new Error('Advantage and disadvantage use one d20.');
  const rolls = Array.from({length: mode === 'normal' ? count : 2},()=>roller(sides));
  const kept = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls.reduce((a,b)=>a+b,0);
  return {expression:input,rolls,total:kept+bonus,bonus,mode,natural:count===1&&sides===20?kept:null};
}
export function changeHP(c, amount, kind) {
  const n = Math.max(0, Math.floor(amount));
  if (kind === 'damage') { const absorbed = Math.min(c.tempHp,n); c.tempHp -= absorbed; c.hp = Math.max(0,c.hp-(n-absorbed)); }
  if (kind === 'heal') c.hp = Math.min(c.maxHp,c.hp+n);
  if (kind === 'temp') c.tempHp = Math.max(c.tempHp,n);
  if (c.hp > 0) { c.deathSuccess=0; c.deathFailure=0; }
  return c;
}
export function longRest(c,{reduceExhaustion=true}={}) {
  if (c.hp<1) throw new Error('You need at least 1 HP to start a Long Rest.');
  c.hp=c.maxHp;c.tempHp=0;c.hitDice=c.level;
  if (reduceExhaustion) c.exhaustion=Math.max(0,c.exhaustion-1);
  c.slots.forEach(s=>s.used=0);c.concentration='';c.deathSuccess=0;c.deathFailure=0;
  c.features.filter(f=>f.reset!=='manual').forEach(f=>f.used=0);
}
export function shortRest(c,count=0,roller=randomDie) {
  if (c.hp<1) throw new Error('You need at least 1 HP to start a Short Rest.');
  if (!Number.isInteger(count)||count<0||count>c.hitDice) throw new Error('Choose an available number of Hit Dice.');
  const healing=Array.from({length:count},()=>Math.max(0,roller(c.hitDie)+mod(c.stats.con))).reduce((a,b)=>a+b,0);
  changeHP(c,healing,'heal');c.hitDice-=count;
  for (const f of c.features) {
    if (f.reset==='short') f.used=0;
    else if (f.reset==='long'&&f.shortRestRecovery) f.used=Math.max(0,f.used-f.shortRestRecovery);
  }
  return healing;
}
export function levelUp(c, gain) {
  if (c.level >= 20) throw new Error('You’ve reached level 20. Legendary!');
  const hpGain = Math.max(1,Math.floor(gain));
  c.level++;c.maxHp=Math.min(9999,c.maxHp+hpGain);c.hp=Math.min(c.maxHp,c.hp+hpGain);c.hitDice=Math.min(c.level,c.hitDice+1);
  // Class features, spells, ASIs, and multiclass choices remain explicit player edits.
  return c;
}

function requireThat(condition, message) { if (!condition) throw new Error(`Invalid backup: ${message}`); }
const numberIn = (v,min,max) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
const integerIn = (v,min,max) => Number.isInteger(v)&&numberIn(v,min,max);
const string = (v,max=20000) => typeof v==='string'&&v.length<=max;
function validateCharacter(c) {
  requireThat(c && typeof c==='object' && string(c.id,100) && /^[a-zA-Z0-9_-]+$/.test(c.id) && string(c.name,120) && c.name.trim(),'each character needs a safe ID and a name.');
  requireThat(string(c.playerName,120),'invalid player name.');
  for (const key of Object.keys(SHEET_TEXT)) requireThat(string(c[key]),`invalid ${key}.`);
  for (const key of ['electrum','platinum']) requireThat(integerIn(c[key],0,100000000),`invalid ${key}.`);
  for (const key of ['initiativeBonus','passivePerceptionBonus']) requireThat(integerIn(c[key],-99,99),`invalid ${key}.`);
  requireThat(Object.hasOwn(CLASSES,c.class),'unknown character class.');
  for (const key of ['race','subclass','background','alignment','campaign','concentration']) requireThat(string(c[key],500),`invalid ${key}.`);
  requireThat(integerIn(c.level,1,20)&&integerIn(c.xp,0,100000000),'invalid level or XP.');
  requireThat(c.stats&&Object.keys(ABILITIES).every(k=>integerIn(c.stats[k],1,30)),'ability scores must be 1–30.');
  requireThat(integerIn(c.maxHp,1,9999)&&integerIn(c.hp,0,c.maxHp)&&integerIn(c.tempHp,0,9999),'invalid hit points.');
  for (const key of ['ac','speed','gold','silver','copper']) requireThat(integerIn(c[key],0,100000000),`invalid ${key}.`);
  requireThat([6,8,10,12].includes(c.hitDie)&&integerIn(c.hitDice,0,c.level),'invalid hit dice.');
  requireThat(typeof c.inspiration==='boolean','invalid inspiration.');
  requireThat(typeof c.initiativeAdvantage==='boolean','invalid initiative advantage.');
  requireThat(c.spellAbility==='auto'||Object.hasOwn(ABILITIES,c.spellAbility),'invalid casting ability.');
  for (const [key,values] of [['skills',Object.keys(SKILLS)],['expertise',Object.keys(SKILLS)],['saves',Object.keys(ABILITIES)],['conditions',CONDITIONS]]) requireThat(Array.isArray(c[key])&&c[key].length<=30&&c[key].every(v=>values.includes(v)),`invalid ${key}.`);
  requireThat(integerIn(c.exhaustion,0,6)&&integerIn(c.deathSuccess,0,3)&&integerIn(c.deathFailure,0,3),'invalid condition counters.');
  requireThat(Array.isArray(c.slots)&&c.slots.length===9&&c.slots.every(s=>s&&integerIn(s.max,0,99)&&integerIn(s.used,0,s.max)),'invalid spell slots.');
  for (const key of ['items','spells','notes','features','attacks']) {
    requireThat(Array.isArray(c[key])&&c[key].length<=2000,`invalid ${key}.`);
    const ids = new Set();
    c[key].forEach(v=>{requireThat(v&&string(v.id,100)&&/^[a-zA-Z0-9_-]+$/.test(v.id)&&!ids.has(v.id),`invalid or duplicate ${key} IDs.`);ids.add(v.id);});
  }
  c.items.forEach(v=>requireThat(string(v.name,200)&&v.name.trim()&&['Weapon','Armor','Gear','Consumable','Treasure'].includes(v.category)&&integerIn(v.qty,0,99999)&&numberIn(v.weight,0,99999)&&typeof v.equipped==='boolean'&&string(v.description)&&string(v.wiki,2000),'invalid item.'));
  c.spells.forEach(v=>requireThat(string(v.name,200)&&v.name.trim()&&integerIn(v.level,0,9)&&['school','castingTime','range','duration','notes','wiki'].every(k=>string(v[k],k==='notes'?20000:2000))&&typeof v.concentration==='boolean'&&typeof v.prepared==='boolean','invalid spell.'));
  c.notes.forEach(v=>requireThat(string(v.title,200)&&v.title.trim()&&string(v.body,100000)&&string(v.tag,100)&&typeof v.pinned==='boolean'&&string(v.updated,100)&&!Number.isNaN(Date.parse(v.updated)),'invalid note.'));
  c.features.forEach(v=>requireThat(string(v.name,200)&&v.name.trim()&&string(v.description)&&string(v.wiki,2000)&&integerIn(v.maxUses,0,99)&&integerIn(v.used,0,v.maxUses)&&['short','long','manual'].includes(v.reset)&&string(v.rollFormula,30)&&(v.rollFormula===''||validDiceFormula(v.rollFormula)),'invalid feature.'));
  c.features.forEach(v=>requireThat(integerIn(v.shortRestRecovery,0,v.maxUses),'invalid short-rest recovery.'));
  c.attacks.forEach(v=>{
    requireThat(string(v.name,200)&&v.name.trim()&&Object.hasOwn(ABILITIES,v.ability)&&integerIn(v.bonus,-99,99)&&typeof v.proficient==='boolean'&&string(v.damage,30)&&string(v.type,100)&&string(v.range,100),'invalid attack.');
    requireThat(string(v.notes),'invalid attack notes.');
    requireThat(['normal','advantage','disadvantage'].includes(v.rollMode),'invalid attack roll mode.');
    requireThat(validDiceFormula(v.damage),'invalid attack damage.');
  });
  return c;
}
export function parseBackup(text) {
  requireThat(typeof text==='string'&&text.length<=2000000,'file is too large (2 MB maximum).');
  let data;
  try {data=JSON.parse(text);} catch {throw new Error('This file isn’t valid JSON. Choose a Questlog backup.');}
  requireThat(data?.version===SAVE_VERSION,`only version ${SAVE_VERSION} Questlog saves are supported. Older saves cannot be loaded or imported.`);
  requireThat(Array.isArray(data.characters)&&data.characters.length>0&&data.characters.length<=100,'expected 1–100 characters.');
  data.characters.forEach(validateCharacter);
  requireThat(new Set(data.characters.map(c=>c.id)).size===data.characters.length,'duplicate character IDs.');
  requireThat(data.characters.some(c=>c.id===data.activeId),'active character is missing.');
  requireThat(data.settings&&typeof data.settings.sound==='boolean','invalid settings.');
  return data;
}
