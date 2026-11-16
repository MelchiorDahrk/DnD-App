// Species-specific anatomy takes priority, followed by exact subclass and class outfits.
export const CLASS_PORTRAITS = {
  Artificer:['apron-tinkerer',{Alchemist:'apron-potion-maker',Armorer:'silver-crusader','Battle Smith':'leather-apron-smith'}],
  Barbarian:['fur-cloaked-wanderer',{'Path of the Beast':'lionhide-raider','Path of the Berserker':'lurtz-blood-berserker','Path of the Wild Heart':'lionhide-raider'}],
  Bard:['golden-lace-minstrel',{'College of Glamour':'lavender-pendant-singer','College of Valor':'blue-bodice-troubadour'}],
  Cleric:['golden-stole-healer',{'Life Domain':'white-robe-curate','War Domain':'silver-crusader','Trickery Domain':'diamond-amulet-priest'}],
  Druid:['leafbelt-keeper',{'Circle of the Moon':'furcloak-herbalist','Circle of the Stars':'star-robed-sage'}],
  Fighter:['falcon-veteran',{'Battle Master':'crossed-pikes-mercenary',Champion:'studded-leather-duelist','Eldritch Knight':'standing-dragon-knight'}],
  Monk:['ropebelt-pilgrim',{'Warrior of Shadow':'green-robed-shinobi','Warrior of the Elements':'samurai-blossom-mystic'}],
  Paladin:['lion-oathkeeper',{'Oath of Glory':'royal-champion','Oath of Vengeance':'silver-crusader','Oath of the Ancients':'standing-dragon-knight'}],
  Ranger:['greenwood-scout',{Hunter:'studded-leather-archer','Gloom Stalker':'black-collar-forester','Fey Wanderer':'blue-collar-pathfinder'}],
  Rogue:['wolfpack-cutpurse',{Assassin:'leather-buckle-stalker',Thief:'pursebelt-pickpocket','Arcane Trickster':'black-fold-occultist',Soulknife:'black-crossbelt-hunter'}],
  Sorcerer:['jade-dragon-adept',{'Draconic Sorcery':'ornate-dragon-scholar','Wild Magic Sorcery':'red-medallion-adept'}],
  Warlock:['emerald-pactbinder',{'Fiend Patron':'crimson-pactbinder','Great Old One Patron':'black-fold-occultist','Celestial Patron':'golden-stole-healer'}],
  Wizard:['star-robed-sage',{Abjurer:'gold-stole-magister',Evoker:'ornate-dragon-scholar',Illusionist:'silver-pendant-adept'}]
};
export const RACE_PORTRAITS = {
  Elf:['silver-mail-sentinel',{Fighter:'silver-mail-sentinel',Paladin:'silver-mail-sentinel',Ranger:'greenwood-archer',Rogue:'forest-duelist',Wizard:'evenstar-spellweaver',Sorcerer:'evenstar-spellweaver',Warlock:'evenstar-spellweaver',Druid:'greenwood-archer'}],
  Dwarf:['mountain-shieldbearer',{Barbarian:'mountain-shieldbearer',Fighter:'forge-guardian',Paladin:'forge-guardian',Artificer:'runesmith',Wizard:'runesmith',Cleric:'runesmith'}],
  Halfling:['pocket-scout',{Bard:'road-minstrel',Rogue:'pocket-scout',Ranger:'pocket-scout',Druid:'garden-keeper'}],
  Orc:['ironhide-raider',{Barbarian:'warband-champion',Fighter:'warband-champion',Wizard:'ash-shaman',Sorcerer:'ash-shaman',Warlock:'ash-shaman',Cleric:'ash-shaman',Druid:'ash-shaman'}],
  Goblin:['cave-cutpurse',{Rogue:'cave-cutpurse',Artificer:'tunnel-miner',Wizard:'hex-whisperer',Sorcerer:'hex-whisperer',Warlock:'hex-whisperer'}],
  Tiefling:['ember-invoker',{Fighter:'ash-knight',Paladin:'ash-knight',Barbarian:'ash-knight'}],
  Undead:['grave-sentinel',{Wizard:'crypt-sorcerer',Sorcerer:'crypt-sorcerer',Warlock:'crypt-sorcerer'}]
};
const normalized=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const entry=(table,value)=>Object.entries(table).find(([name])=>normalized(name)===normalized(value))?.[1];
const raceAliases={
  'high elf':'Elf','wood elf':'Elf',drow:'Elf','dark elf':'Elf','half-elf':'Elf',
  'hill dwarf':'Dwarf','mountain dwarf':'Dwarf',duergar:'Dwarf',
  'lightfoot halfling':'Halfling','stout halfling':'Halfling','half-orc':'Orc',
  'abyssal tiefling':'Tiefling','chthonic tiefling':'Tiefling','infernal tiefling':'Tiefling'
};
export function defaultPortraitId(character={}) {
  const race=entry(RACE_PORTRAITS,raceAliases[normalized(character.race)]||character.race);
  const cls=entry(CLASS_PORTRAITS,character.class);
  const name=(race&&(entry(race[1],character.class)||race[0]))||
    (cls&&(entry(cls[1],character.subclass)||cls[0]));
  return name?`original-${name}`:null;
}
export const DEFAULT_PORTRAIT_IDS=[...new Set([...Object.values(CLASS_PORTRAITS),...Object.values(RACE_PORTRAITS)].flatMap(([name,variants])=>[name,...Object.values(variants)]).map(name=>`original-${name}`))];
