// SRD 5.2.1 summaries (CC BY 4.0); additional PHB options are brief references.
// Presets are editable snapshots, not a character builder. See docs/catalog.md.
import {RULES_URL, mod, signed} from './model.js';
import {ORIGIN_FEATS, SUBCLASSES} from './catalog.js';

const PHB='https://www.dndbeyond.com/sources/dnd/phb-2024';
const slug=value=>value.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const entries=[];
function add(group,owner,rows,extra={}) {
  for(const [level,name,details,resource] of rows) entries.push({
    id:slug(`${group}-${owner}-${name}`),name,group,owner,level,details,resource,
    source:'2024 core',wiki:`${RULES_URL}/character-classes#${owner}`,...extra
  });
}

const classRows={
  Barbarian:[
    [1,'Rage','Bonus Action to rage; apply resistance, Strength benefits, and rage damage at the table.','rage'],
    [1,'Unarmored Defense','Without armor: AC = 10 + Dexterity modifier + Constitution modifier; a Shield is allowed.'],
    [1,'Weapon Mastery','Record your selected weapon masteries in attack notes.'],
    [2,'Danger Sense','Advantage on Dexterity saves unless Incapacitated.'],[2,'Reckless Attack','Choose reckless Strength attacks; resolve incoming attack Advantage manually.'],
    [3,'Primal Knowledge','Additional skill and rage-based Strength skill substitutions.'],[5,'Extra Attack','Two attacks when taking the Attack action.'],[5,'Fast Movement','Increase speed while not wearing Heavy armor.'],
    [7,'Feral Instinct','Advantage on Initiative. Enable it in Edit stats.'],[7,'Instinctive Pounce','Move as part of entering Rage.'],[9,'Brutal Strike','Trade Reckless Attack Advantage for damage and a tactical effect.'],
    [11,'Relentless Rage','Constitution save to stay standing during Rage; track the increasing DC manually.'],[13,'Improved Brutal Strike','Additional Brutal Strike effects; improves again at level 17.'],
    [15,'Persistent Rage','Rage improvements and once-per-Long-Rest recovery when rolling Initiative.'],[18,'Indomitable Might','Minimum result for qualifying Strength checks and saves.'],[20,'Primal Champion','Increase Strength and Constitution; update scores manually.']
  ],
  Bard:[
    [1,'Bardic Inspiration','Grant an inspiration die. Rolling here spends the grant; apply it to the recipient separately.','inspiration'],[1,'Spellcasting','Charisma spellcasting; manage spells and slots in Spellbook.'],
    [2,'Expertise','Choose skill Expertise; update skill dots.'],[2,'Jack of All Trades','Half proficiency on qualifying untrained ability checks; apply manually.'],[5,'Font of Inspiration','Bardic Inspiration refreshes on Short Rests; spell slots can recover a use.'],
    [7,'Countercharm','Reaction to help resist being Charmed or Frightened.'],[10,'Magical Secrets','Broaden your spell selection; manage choices in Spellbook.'],[18,'Superior Inspiration','Recover Bardic Inspiration when rolling Initiative as described in the rules.'],[20,'Words of Creation','Power Word Heal and Power Word Kill improvements; manage casting manually.']
  ],
  Cleric:[
    [1,'Spellcasting','Wisdom spellcasting; manage spells and slots in Spellbook.'],[1,'Divine Order','Choose Protector or Thaumaturge; update training or cantrips manually.'],
    [2,'Channel Divinity','Shared pool for Divine Spark, Turn Undead, and domain options.','cleric-channel'],[2,'Divine Spark','Spend Channel Divinity to heal or deal damage. Use the shared pool.'],[2,'Turn Undead','Spend Channel Divinity to turn Undead. Use the shared pool.'],
    [5,'Sear Undead','Adds damage to Turn Undead; spend the shared Channel Divinity pool.'],[7,'Blessed Strikes','Choose Divine Strike or Potent Spellcasting; apply manually.'],[10,'Divine Intervention','Request a qualifying spell through divine intervention; review casting restrictions.','one-long'],
    [14,'Improved Blessed Strikes','Improves your chosen Blessed Strikes option.'],[20,'Greater Divine Intervention','Wish option has a special multi-day recovery. Track that cooldown manually.']
  ],
  Druid:[
    [1,'Spellcasting','Wisdom spellcasting; manage spells and slots in Spellbook.'],[1,'Druidic','Druidic language and Speak with Animals; record in languages and Spellbook.'],[1,'Primal Order','Choose Magician or Warden; update cantrips and training manually.'],
    [2,'Wild Shape','Shared pool for Beast forms and features that spend Wild Shape.','wild-shape'],[2,'Wild Companion','Spend a spell slot or Wild Shape use for Find Familiar; use the shared pool.'],
    [5,'Wild Resurgence','Track the once-per-Long-Rest conversion of Wild Shape to a level 1 slot. Other conversions remain manual.','one-long'],[7,'Elemental Fury','Choose Potent Spellcasting or Primal Strike.'],[15,'Improved Elemental Fury','Improves your chosen Elemental Fury option.'],[18,'Beast Spells','Cast qualifying spells while in Wild Shape.'],[20,'Archdruid','Wild Shape recovery, spell-slot conversion, and longevity; resolve special recovery manually.']
  ],
  Fighter:[
    [1,'Fighting Style','Choose a Fighting Style from its catalog category.'],[1,'Second Wind','Bonus Action healing; a Short Rest restores one use. Apply healing separately.','second-wind'],[1,'Weapon Mastery','Record selected mastery properties in your attack notes.'],
    [2,'Action Surge','Take an additional action, excluding the Magic action.','action-surge'],[2,'Tactical Mind','Spend Second Wind on a failed ability check; restore the use if the check still fails. Use the shared Second Wind pool.'],
    [5,'Extra Attack','Two attacks per Attack action.'],[5,'Tactical Shift','Move when using Second Wind without provoking Opportunity Attacks.'],[9,'Indomitable','Reroll a failed save and add Fighter level.','indomitable'],[9,'Tactical Master','Exchange eligible mastery effects for Push, Sap, or Slow.'],
    [11,'Two Extra Attacks','Three attacks per Attack action.'],[13,'Studied Attacks','After missing, gain Advantage on your next attack against that creature as specified in the rules.'],[20,'Three Extra Attacks','Four attacks per Attack action.']
  ],
  Monk:[
    [1,'Martial Arts','Unarmed and Monk weapon benefits. The formula rolls the Martial Arts die only.','martial-arts'],[1,'Unarmored Defense','Without armor or Shield: AC = 10 + Dexterity modifier + Wisdom modifier.'],
    [2,'Focus Points','Shared pool for Flurry of Blows, Patient Defense, Step of the Wind, and other Focus abilities.','focus'],[2,'Flurry of Blows','Spend Focus Points from the shared pool for extra Unarmed Strikes.'],[2,'Patient Defense','Bonus Action defense; enhanced option spends the shared Focus pool.'],[2,'Step of the Wind','Bonus Action movement; enhanced option spends the shared Focus pool.'],
    [2,'Unarmored Movement','Increase speed without armor or Shield; update base speed manually.'],[2,'Uncanny Metabolism','When rolling Initiative, restore Focus and heal. Apply both separately.','metabolism'],[3,'Deflect Attacks','Reaction to reduce qualifying attack damage; redirection can spend Focus.'],
    [4,'Slow Fall','Reaction to reduce falling damage.'],[5,'Extra Attack','Two attacks per Attack action.'],[5,'Stunning Strike','Spend the shared Focus pool for a stunning attempt.'],[6,'Empowered Strikes','Unarmed Strikes can deal Force damage.'],[7,'Evasion','Improved outcomes on qualifying Dexterity saves.'],
    [9,'Acrobatic Movement','Move across liquids and vertical surfaces during your turn.'],[10,'Heightened Focus','Improves your Focus options; spend the existing Focus pool.'],[10,'Self-Restoration','Remove qualifying conditions and resist deprivation.'],[13,'Deflect Energy','Deflect Attacks applies to more damage types.'],[14,'Disciplined Survivor','Saving throw proficiency and Focus-powered rerolls.'],[15,'Perfect Focus','Recover Focus when rolling Initiative as described in the rules.'],[18,'Superior Defense','Spend Focus for a defensive state; update effects manually.'],[20,'Body and Mind','Increase Dexterity and Wisdom; update scores manually.']
  ],
  Paladin:[
    [1,'Lay On Hands','Healing points, not activations. Each charge is 1 HP; apply healing or condition removal separately.','lay-on-hands'],[1,'Spellcasting','Charisma spellcasting; manage spells and slots in Spellbook.'],[1,'Weapon Mastery','Record selected mastery properties in attack notes.'],
    [2,'Fighting Style','Choose a Fighting Style or Blessed Warrior.'],[2,'Blessed Warrior','Choose two Cleric cantrips instead of a Fighting Style feat.'],[2,'Paladin’s Smite','One free Divine Smite casting; additional castings use spell slots.','one-long'],
    [3,'Channel Divinity','Shared pool for Divine Sense and oath options.','paladin-channel'],[3,'Divine Sense','Spend Channel Divinity from its shared pool.'],[5,'Extra Attack','Two attacks per Attack action.'],[5,'Faithful Steed','One free Find Steed casting; further castings use spell slots.','one-long'],
    [6,'Aura of Protection','Apply the aura’s saving throw bonus manually.'],[9,'Abjure Foes','Spend the shared Channel Divinity pool.'],[10,'Aura of Courage','Aura protects against Frightened.'],[11,'Radiant Strikes','Additional radiant weapon/Unarmed Strike damage; update attack formulas.'],[14,'Restoring Touch','Spend Lay On Hands points to end qualifying conditions.'],[18,'Aura Expansion','Your Paladin auras extend farther.']
  ],
  Ranger:[
    [1,'Spellcasting','Wisdom spellcasting; manage spells and slots in Spellbook.'],[1,'Favored Enemy','Free Hunter’s Mark castings. Choose No slot in Spellbook and spend this resource.','favored-enemy'],[1,'Weapon Mastery','Record selected mastery properties in attack notes.'],
    [2,'Deft Explorer','Skill Expertise and languages; record choices manually.'],[2,'Fighting Style','Choose a Fighting Style or Druidic Warrior.'],[2,'Druidic Warrior','Choose two Druid cantrips instead of a Fighting Style feat.'],[5,'Extra Attack','Two attacks per Attack action.'],[6,'Roving','Increased walking speed plus climbing and swimming speeds.'],
    [9,'Expertise','Choose additional skill Expertise; update skill dots.'],[10,'Tireless','Grant yourself temporary HP; resolve exhaustion recovery on Short Rests manually.','tireless'],[13,'Relentless Hunter','Damage no longer breaks concentration on Hunter’s Mark.'],[14,'Nature’s Veil','Bonus Action invisibility; track the duration manually.','wis-long'],[17,'Precise Hunter','Advantage on attacks against your Hunter’s Mark target.'],[18,'Feral Senses','Record Blindsight in senses.'],[20,'Foe Slayer','Hunter’s Mark damage improves; update spell notes.']
  ],
  Rogue:[
    [1,'Expertise','Choose skill Expertise; update skill dots.'],[1,'Sneak Attack','Once per turn when its conditions are met. Apply this damage separately.','sneak-attack'],[1,'Thieves’ Cant','Record Thieves’ Cant and your additional language.'],[1,'Weapon Mastery','Record selected mastery properties in attack notes.'],
    [2,'Cunning Action','Bonus Action Dash, Disengage, or Hide.'],[3,'Steady Aim','Trade movement for Advantage under its conditions.'],[5,'Cunning Strike','Trade Sneak Attack dice for an effect; shared damage cost, not separate charges.'],[5,'Uncanny Dodge','Reaction to halve qualifying attack damage.'],[7,'Evasion','Improved outcomes on qualifying Dexterity saves.'],[7,'Reliable Talent','Minimum die result for qualifying proficient ability checks.'],
    [11,'Improved Cunning Strike','Apply two Cunning Strike effects.'],[14,'Devious Strikes','Additional Cunning Strike options; pay the damage-dice cost.'],[15,'Slippery Mind','Wisdom and Charisma saving throw proficiency.'],[18,'Elusive','Attack rolls cannot have Advantage against you unless Incapacitated.'],[20,'Stroke of Luck','Turn a failed D20 Test into a 20.','one-short']
  ],
  Sorcerer:[
    [1,'Spellcasting','Charisma spellcasting; manage spells and slots in Spellbook.'],[1,'Innate Sorcery','Bonus Action magical surge; update DC and spell attack Advantage manually.','two-long'],[2,'Font of Magic / Sorcery Points','Shared Sorcery Point pool; spend and recover points explicitly.','sorcery'],[2,'Metamagic','Choose Metamagic options from their catalog category; all spend Sorcery Points.'],
    [5,'Sorcerous Restoration','Special Short Rest Sorcery Point recovery once per Long Rest; apply the point recovery manually.','one-long'],[7,'Sorcery Incarnate','Additional Innate Sorcery benefits and Sorcery Point reactivation.'],[20,'Arcane Apotheosis','Enhanced Metamagic during Innate Sorcery; resolve costs manually.']
  ],
  Warlock:[
    [1,'Eldritch Invocations','Choose options from the Eldritch invocations category.'],[1,'Pact Magic','Track Pact Magic slots separately; refresh them manually on a Short Rest.'],[2,'Magical Cunning','Recover Pact Magic slots with a special ritual; update slots separately.','one-long'],[9,'Contact Patron','Free Contact Other Plane casting to contact your patron.','one-long'],
    [11,'Mystic Arcanum (6th-level spell)','One casting of your selected level 6 arcanum.','one-long'],[13,'Mystic Arcanum (7th-level spell)','One casting of your selected level 7 arcanum.','one-long'],[15,'Mystic Arcanum (8th-level spell)','One casting of your selected level 8 arcanum.','one-long'],[17,'Mystic Arcanum (9th-level spell)','One casting of your selected level 9 arcanum.','one-long'],[20,'Eldritch Master','Magical Cunning restores all Pact Magic slots.']
  ],
  Wizard:[
    [1,'Spellcasting','Intelligence spellcasting; manage your spellbook, prepared spells, and slots.'],[1,'Ritual Adept','Cast eligible rituals from your spellbook.'],[1,'Arcane Recovery','Recover qualifying spell slots during a Short Rest, once per Long Rest. Update slots separately.','one-long'],[2,'Scholar','Choose Expertise in an eligible Intelligence skill.'],[5,'Memorize Spell','Change a prepared spell after a Short Rest.'],[18,'Spell Mastery','Choose eligible spells for at-will casting.'],[20,'Signature Spells','Choose two spells; each has its own free casting. Create a separate resource for each chosen spell.']
  ],
  Artificer:[[1,'Magical Tinkering','Supplemental Artificer reference; use your table’s book and rules version.'],[1,'Spellcasting','Supplemental Artificer spellcasting; manage spells and slots manually.'],[2,'Infuse Item','Record selected infusions and active items; review the table’s Artificer version.'],[3,'The Right Tool for the Job','Create a tool set using the supplemental class rules.'],[6,'Tool Expertise','Update tool proficiency notes.'],[7,'Flash of Genius','Reaction bonus; review the table’s Artificer version.','int-long'],[10,'Magic Item Adept','Crafting and attunement benefits; record manually.'],[11,'Spell-Storing Item','Record the chosen spell and review the item’s uses manually.'],[14,'Magic Item Savant','Expanded magic-item use and attunement.'],[18,'Magic Item Master','Expanded attunement.'],[20,'Soul of Artifice','Capstone reference; resolve attunement-based effects manually.']]
};
for(const [className,rows] of Object.entries(classRows)) {
  add('Class features',className,rows,{className,...(className==='Artificer'?{source:'Supplemental / earlier book',wiki:'https://www.dndbeyond.com/classes'}:{})});
  if(className!=='Artificer')add('Class features',className,[[4,'Ability Score Improvement','Choose an eligible feat at the levels listed for your class; edit scores and effects manually.'],[19,'Epic Boon','Choose an Epic Boon or another eligible feat.']],{className});
}

// Every supported subclass has an editable reference; individual resources below
// supplement those references without inventing a full rules progression.
for(const subclass of SUBCLASSES) add('Subclass features',subclass.name,[[3,subclass.name,`${subclass.details} Subclass reference: record your selected features and any additional resources from your book.`]],{className:subclass.className,subclass:subclass.name,wiki:subclass.wiki,source:subclass.className==='Artificer'?'Supplemental / earlier book':'2024 core'});
const subclassRows={
  'Path of the Berserker':[[3,'Frenzy','Extra damage when using Reckless Attack during Rage.'],[6,'Mindless Rage','Rage protects against Charmed and Frightened.'],[10,'Retaliation','Reaction attack after qualifying damage.'],[14,'Intimidating Presence','Frighten nearby foes; Rage can restore its use.','one-long']],
  'College of Lore':[[3,'Bonus Proficiencies','Record the extra skill proficiencies.'],[3,'Cutting Words','Spend Bardic Inspiration from its existing pool.'],[6,'Magical Discoveries','Select additional spells using your subclass rules.'],[14,'Peerless Skill','Spend Bardic Inspiration for your own qualifying failed test.']],
  'Life Domain':[[3,'Disciple of Life','Apply the healing bonus manually.'],[3,'Preserve Life','Spend Channel Divinity from the existing Cleric pool; distribute healing manually.'],[6,'Blessed Healer','Healing others can also heal you; apply manually.'],[17,'Supreme Healing','Use maximum qualifying healing dice results.']],
  'Circle of the Land':[[3,'Land’s Aid','Spend Wild Shape from its existing pool.'],[6,'Natural Recovery','One free eligible Circle spell casting per Long Rest; review slot recovery separately.','one-long'],[10,'Nature’s Ward','Defensive benefits depend on your land choice.'],[14,'Nature’s Sanctuary','Spend Wild Shape from its existing pool.']],
  'Battle Master':[[3,'Superiority Dice','Shared pool for all maneuvers. Roll here to spend one die, then resolve the chosen maneuver.','superiority'],[3,'Student of War','Record chosen skill and tool training.'],[7,'Know Your Enemy','Assess a creature; review the resource rules.','one-long'],[10,'Improved Combat Superiority','Superiority Dice increase to d10, then d12 at Fighter level 18.'],[15,'Relentless','One maneuver per turn can use a d8 without spending a Superiority Die.']],
  Champion:[[3,'Improved Critical','Record the expanded critical range in attack notes.'],[3,'Remarkable Athlete','Athletic and initiative benefits; enable initiative Advantage in Edit stats.'],[7,'Additional Fighting Style','Choose another Fighting Style feat.'],[10,'Heroic Warrior','Gain Heroic Inspiration in combat as specified in your subclass rules.'],[18,'Survivor','Enhanced resilience and combat recovery; apply manually.']],
  'Psi Warrior':[[3,'Psionic Energy Dice','Shared Psi Warrior pool; distinct from Soulknife dice. Review die size and recovery in your book.','psi'],[3,'Protective Field','Spend Psi Warrior dice from the shared pool.'],[3,'Psionic Strike','Spend Psi Warrior dice from the shared pool.'],[3,'Telekinetic Movement','Move a target telekinetically; track its special free-use/recovery rules manually.']],
  'Warrior of the Open Hand':[[3,'Open Hand Technique','Enhance Flurry of Blows; spend Focus from its existing pool.'],[6,'Wholeness of Body','Bonus Action healing; apply the result separately.','wholeness'],[11,'Fleet Step','Combine Step of the Wind with other Bonus Actions as described in the rules.'],[17,'Quivering Palm','Spend the shared Focus pool and resolve the effect manually.']],
  'Oath of Devotion':[[3,'Sacred Weapon','Spend Channel Divinity from the existing Paladin pool.'],[7,'Aura of Devotion','Aura protects against Charmed.'],[15,'Smite of Protection','Divine Smite provides a protective benefit.'],[20,'Holy Nimbus','Oath capstone; review duration and spell-slot reactivation.','one-long']],
  Hunter:[[3,'Hunter’s Lore','Learn information about your Hunter’s Mark target.'],[3,'Colossus Slayer','Chosen Hunter’s Prey option; once per turn against a wounded target.'],[3,'Horde Breaker','Alternative Hunter’s Prey option; resolve its extra attack manually.'],[7,'Defensive Tactics','Choose and record your defensive option.'],[11,'Superior Hunter’s Prey','Improved Hunter’s Mark damage application.'],[15,'Superior Hunter’s Defense','Reaction to reduce and redirect qualifying damage.']],
  Assassin:[[3,'Assassinate','Initiative and opening-round benefits; update initiative Advantage manually.'],[3,'Assassin’s Tools','Record the additional tool training.'],[9,'Infiltration Expertise','Disguise and infiltration benefits.'],[13,'Envenom Weapons','Sneak Attack poison enhancement; resolve the save and effects manually.'],[17,'Death Strike','Opening-round damage enhancement; resolve the saving throw manually.']],
  Soulknife:[[3,'Psionic Energy Dice','Shared Soulknife pool; distinct from Psi Warrior dice. Review die size and recovery in your book.','psi'],[3,'Psi-Bolstered Knack','Spend Soulknife dice on a qualifying failed check; use its shared pool.'],[3,'Psychic Whispers','Telepathic communication; review free uses and shared-die cost.'],[3,'Psychic Blades','Create Psychic Blade attacks in the attack editor.']],
  Thief:[[3,'Fast Hands','Additional Bonus Action options.'],[3,'Second-Story Work','Climbing and jumping benefits.'],[9,'Supreme Sneak','Sneak Attack/Cunning Strike interaction while hidden.'],[13,'Use Magic Device','Expanded magic-item use.'],[17,'Thief’s Reflexes','An additional turn in the opening round.']],
  'Draconic Sorcery':[[3,'Draconic Resilience','Adjust AC and HP using your subclass rules.'],[6,'Elemental Affinity','Choose your element and record damage and resistance benefits.'],[14,'Dragon Wings','Bonus Action flight; review duration and Sorcery Point reactivation.','one-long'],[18,'Dragon Companion','Enhanced Summon Dragon casting; manage the free casting and other costs manually.']],
  'Fiend Patron':[[3,'Dark One’s Blessing','Temporary HP from qualifying defeats; apply manually.'],[6,'Dark One’s Own Luck','Add a die to a qualifying ability check or saving throw.','fiend-luck'],[10,'Fiendish Resilience','Choose a damage resistance.'],[14,'Hurl Through Hell','Banish and damage a target; review slot reactivation.','one-long']],
  Evoker:[[3,'Evocation Savant','Record additional evocation spells.'],[3,'Potent Cantrip','Cantrip damage on qualifying misses and successful saves.'],[6,'Sculpt Spells','Protect selected creatures from your Evocation spells.'],[10,'Empowered Evocation','Add Intelligence to an eligible Evocation damage roll.'],[14,'Overchannel','Maximize qualifying spell damage; track repeat-use damage manually.']]
};
for(const [subclass,rows] of Object.entries(subclassRows)) {
  const parent=SUBCLASSES.find(entry=>entry.name===subclass);
  add('Subclass features',subclass,rows,{className:parent.className,subclass,wiki:parent.wiki});
}
add('Subclass features','Path of the Beast',[[3,'Form of the Beast','Supplemental Beast Barbarian: choose bite, claws, or tail during Rage; manage natural weapon attacks separately.'],[6,'Bestial Soul','Supplemental Beast Barbarian movement and natural weapon improvements.'],[10,'Infectious Fury','Supplemental Beast Barbarian; resolve the save and effect manually.','con-long'],[14,'Call the Hunt','Supplemental Beast Barbarian group enhancement.','con-long']],{className:'Barbarian',subclass:'Path of the Beast',source:'Supplemental / earlier book',wiki:'https://www.dndbeyond.com/sources/dnd/tcoe'});

const speciesRows={
  Aasimar:[[1,'Celestial Resistance','Record Necrotic and Radiant resistance.'],[1,'Darkvision','Record your species’ Darkvision range in senses.'],[1,'Healing Hands','Touch healing; apply the result separately.','healing-hands'],[1,'Light Bearer','Record the Light cantrip in Spellbook.'],[3,'Celestial Revelation','Choose the revelation form when activating it; apply its effects manually.','one-long']],
  Dragonborn:[[1,'Draconic Ancestry','Choose your ancestor and its damage type.'],[1,'Breath Weapon','Replace an attack with a breath weapon. Resolve the save and damage type separately.','breath'],[1,'Damage Resistance','Record the resistance chosen through Draconic Ancestry.'],[1,'Darkvision','Record Darkvision 60 ft. in senses.'],[5,'Draconic Flight','Temporary spectral wings.','one-long']],
  Dwarf:[[1,'Darkvision','Record Darkvision 120 ft. in senses.'],[1,'Dwarven Resilience','Poison resistance and Advantage against Poisoned.'],[1,'Dwarven Toughness','Increase maximum HP by 1 per level manually.'],[1,'Stonecunning','Temporary Tremorsense while on a stone surface.','pb-long']],
  Elf:[[1,'Elven Lineage','Choose Drow, High Elf, or Wood Elf; add the corresponding lineage magic.'],[1,'Fey Ancestry','Advantage on saves to avoid or end Charmed.'],[1,'Keen Senses','Choose the permitted skill proficiency.'],[1,'Trance','Elven sleep and resting traits.'],[1,'Darkvision','Record the range from your selected lineage.']],
  Gnome:[[1,'Gnomish Cunning','Advantage on Intelligence, Wisdom, and Charisma saving throws.'],[1,'Gnomish Lineage','Choose Forest or Rock Gnome magic.'],[1,'Darkvision','Record Darkvision 60 ft. in senses.']],
  Goliath:[[1,'Giant Ancestry','Choose one ancestry benefit; add that option as a shared-use resource.'],[1,'Cloud’s Jaunt','Cloud Giant ancestry option. Choose only your ancestry option.','pb-long'],[1,'Fire’s Burn','Fire Giant ancestry option. Choose only your ancestry option.','pb-long'],[1,'Frost’s Chill','Frost Giant ancestry option. Choose only your ancestry option.','pb-long'],[1,'Hill’s Tumble','Hill Giant ancestry option. Choose only your ancestry option.','pb-long'],[1,'Stone’s Endurance','Stone Giant ancestry option. Choose only your ancestry option.','stone-endurance'],[1,'Storm’s Thunder','Storm Giant ancestry option. Choose only your ancestry option.','pb-long'],[1,'Powerful Build','Carrying and grapple-related benefits; resolve manually.'],[5,'Large Form','Bonus Action growth; apply size and speed changes separately.','one-long']],
  Halfling:[[1,'Brave','Advantage on saves to avoid or end Frightened.'],[1,'Halfling Nimbleness','Move through spaces of larger creatures.'],[1,'Luck','Reroll qualifying natural 1s; distinct from the Lucky feat.'],[1,'Naturally Stealthy','Hide when obscured by an eligible larger creature.']],
  Human:[[1,'Resourceful','Gain Heroic Inspiration after a Long Rest; toggle it manually.'],[1,'Skillful','Choose and record an additional skill proficiency.'],[1,'Versatile','Choose an additional Origin feat from its catalog category.']],
  Orc:[[1,'Adrenaline Rush','Bonus Action Dash and temporary HP; apply the temporary HP separately.','pb-short'],[1,'Darkvision','Record Darkvision 120 ft. in senses.'],[1,'Relentless Endurance','Drop to 1 HP instead of 0 when eligible; apply manually.','one-long']],
  Tiefling:[[1,'Fiendish Legacy','Choose Abyssal, Chthonic, or Infernal legacy and its magic.'],[1,'Otherworldly Presence','Record Thaumaturgy in Spellbook.'],[1,'Darkvision','Record Darkvision 60 ft. in senses.']]
};
for(const [species,rows] of Object.entries(speciesRows))add('Species traits',species,rows,{species:[species],wiki:`${species==='Aasimar'?PHB:RULES_URL}/character-origins#${species}`});
for(const [lineage,cantrip,first,second] of [
  ['Drow','Dancing Lights','Faerie Fire','Darkness'],['High Elf','Wizard cantrip (changeable)','Detect Magic','Misty Step'],['Wood Elf','Druidcraft','Longstrider','Pass without Trace'],
  ['Abyssal Tiefling','Poison Spray','Ray of Sickness','Hold Person'],['Chthonic Tiefling','Chill Touch','False Life','Ray of Enfeeblement'],['Infernal Tiefling','Fire Bolt','Hellish Rebuke','Darkness']
])add('Species traits',lineage,[[1,'Lineage Magic',`Record ${cantrip} and your lineage’s resistance or other benefits. Choose the permitted casting ability.`],[3,`${first} (lineage)`,`One free ${first} casting. Add the spell separately and choose No slot for the free casting.`,'one-long'],[5,`${second} (lineage)`,`One free ${second} casting. Add the spell separately and choose No slot for the free casting.`,'one-long']],{species:[lineage],wiki:`${RULES_URL}/character-origins#${lineage.includes('Tiefling')?'Tiefling':'Elf'}`});
add('Species traits','Forest Gnome',[[1,'Forest Gnome Magic','Record Minor Illusion and Speak with Animals in Spellbook.'],[1,'Speak with Animals (lineage)','Free lineage castings; add the spell separately.','pb-long']],{species:['Forest Gnome'],wiki:`${RULES_URL}/character-origins#Gnome`});
add('Species traits','Rock Gnome',[[1,'Rock Gnome Magic','Record Mending, Prestidigitation, and your clockwork device rules.']],{species:['Rock Gnome'],wiki:`${RULES_URL}/character-origins#Gnome`});

for(const feat of ORIGIN_FEATS)add('Origin feats','Origin',[[1,feat.name,feat.details,feat.name==='Lucky'?'pb-long':feat.name.startsWith('Magic Initiate')?'one-long':undefined]],{wiki:feat.wiki});
const generalFeats=[
  ['Ability Score Improvement','Increase your chosen ability scores manually.'],['Actor','Impersonation and performance talent.'],['Athlete','Athletic movement and climbing.'],['Charger','Charge attacks and movement.'],['Chef','Cooking, rest benefits, and treats; record prepared treats separately.'],['Crossbow Expert','Crossbow handling and close-range shooting.'],['Crusher','Bludgeoning weapon tactics.'],['Defensive Duelist','Reaction defense with a Finesse weapon.'],['Dual Wielder','Enhanced two-weapon fighting.'],['Durable','Resilience and Hit Die healing.'],['Elemental Adept','Choose an element for spell damage benefits.'],['Fey-Touched','Record the chosen spells and each free casting separately.'],['Grappler','Enhanced grappling and Unarmed Strikes.'],['Great Weapon Master','Heavy-weapon damage and follow-up attacks.'],['Heavily Armored','Heavy armor training.'],['Heavy Armor Master','Heavy armor damage reduction.'],['Inspiring Leader','Temporary HP after a rest; apply manually.'],['Keen Mind','Recall and study benefits.'],['Lightly Armored','Light armor and Shield training.'],['Mage Slayer','Anti-caster tactics and a special saving throw benefit.'],['Martial Weapon Training','Martial weapon proficiency.'],['Medium Armor Master','Enhanced Medium armor use.'],['Moderately Armored','Medium armor training.'],['Mounted Combatant','Mounted attack and defense benefits.'],['Observant','Perception, Insight, Investigation, and Search benefits.'],['Piercer','Piercing damage benefits.'],['Poisoner','Craft and apply poison; track doses as consumables.'],['Polearm Master','Polearm attacks and reactions.'],['Resilient','Choose an ability and its saving throw proficiency.'],['Ritual Caster','Record chosen rituals and track its special casting separately.'],['Sentinel','Opportunity Attack and protection benefits.'],['Shadow-Touched','Record the chosen spells and each free casting separately.'],['Sharpshooter','Enhanced ranged attacks.'],['Shield Master','Shield attacks and defensive benefits.'],['Skill Expert','Record chosen proficiency and Expertise.'],['Skulker','Stealth and hiding benefits.'],['Slasher','Slashing damage tactics.'],['Speedy','Movement and escape benefits.'],['Spell Sniper','Spell attack range and cover benefits.'],['Telekinetic','Mage Hand and telekinetic movement.'],['Telepathic','Telepathy and Detect Thoughts; track free casting separately.'],['War Caster','Concentration and reaction spellcasting benefits.'],['Weapon Master','Choose a weapon mastery and record it in attack notes.']
];
add('General feats','Feat',generalFeats.map(([name,details])=>[4,name,`${details} Review the feat’s ability, training, and spellcasting prerequisites; apply increases and other effects manually.`]),{wiki:`${PHB}/feats`,prerequisites:'Level 4+; additional prerequisites depend on the feat. Check your book.'});
add('Fighting styles','Style',[
  ['Archery','Bonus to ranged weapon attack rolls.'],['Blind Fighting','Record the granted Blindsight.'],['Defense','Armor Class bonus while armored.'],['Dueling','Damage bonus with an eligible one-handed melee weapon.'],['Great Weapon Fighting','Minimum damage die results for qualifying weapons.'],['Interception','Reaction to reduce damage to an ally.'],['Protection','Shield-based reaction to protect an ally.'],['Thrown Weapon Fighting','Damage bonus for thrown attacks.'],['Two-Weapon Fighting','Add ability modifier to qualifying extra attack damage.'],['Unarmed Fighting','Enhanced Unarmed Strike and grapple damage.']
].map(([name,details])=>[1,`Fighting Style: ${name}`,`${details} Requires the Fighting Style feature; apply the effect manually.`]),{wiki:`${PHB}/feats`,prerequisites:'Fighting Style feature'});
add('Epic boons','Boon',['Combat Prowess','Dimensional Travel','Energy Resistance','Fate','Fortitude','Irresistible Offense','Recovery','Skill','Speed','Spell Recall','the Night Spirit','Truesight'].map(name=>[19,`Boon of ${name}`,'Epic Boon reference. Review its prerequisites and benefits in your book; edit scores, resources, and other effects manually.']),{wiki:`${PHB}/feats`,prerequisites:'Level 19+; check any additional prerequisites.'});

add('Maneuvers','Battle Master',[
  ['Ambush','Improve Stealth or Initiative.'],['Bait and Switch','Exchange positions and grant an AC benefit.'],['Commanding Presence','Improve an eligible social check.'],['Commander’s Strike','Direct an ally’s reaction attack.'],['Disarming Attack','Attempt to disarm a target.'],['Distracting Strike','Help an ally attack the target.'],['Evasive Footwork','Defensive movement.'],['Feinting Attack','Feint to improve an attack.'],['Goading Attack','Encourage a foe to attack you.'],['Lunging Attack','Extend an attack through movement.'],['Maneuvering Attack','Help an ally reposition.'],['Menacing Attack','Attempt to Frighten the target.'],['Parry','Reaction to reduce damage.'],['Precision Attack','Improve an attack roll.'],['Pushing Attack','Attempt to push a target.'],['Rally','Grant temporary HP.'],['Riposte','Reaction counterattack.'],['Sweeping Attack','Damage another nearby target.'],['Tactical Assessment','Improve an eligible knowledge or perception check.'],['Trip Attack','Attempt to knock a target Prone.']
].map(([name,details])=>[3,name,`${details} Spend and roll from your shared Superiority Dice resource; this entry has no independent charges.`]),{className:'Fighter',subclass:'Battle Master',wiki:`${PHB}/character-classes#BattleMaster`,sharedPool:'Superiority Dice'});
add('Metamagic','Sorcerer',['Careful Spell','Distant Spell','Empowered Spell','Extended Spell','Heightened Spell','Quickened Spell','Seeking Spell','Subtle Spell','Transmuted Spell','Twinned Spell'].map(name=>[2,name,'Selected Metamagic option. Spend the required Sorcery Points from the shared pool; consult your book for cost and eligible spells.']),{className:'Sorcerer',wiki:`${PHB}/character-classes#Sorcerer`,sharedPool:'Sorcery Points'});
add('Eldritch invocations','Warlock',[
  [2,'Agonizing Blast'],[1,'Armor of Shadows'],[5,'Ascendant Step'],[2,'Devil’s Sight'],[12,'Devouring Blade'],[1,'Eldritch Mind'],[5,'Eldritch Smite'],[2,'Eldritch Spear'],[2,'Fiendish Vigor'],[5,'Gaze of Two Minds'],[5,'Gift of the Depths'],[9,'Gift of the Protectors'],[2,'Lessons of the First Ones'],[9,'Lifedrinker'],[2,'Mask of Many Faces'],[5,'Master of Myriad Forms'],[2,'Misty Visions'],[5,'One with Shadows'],[2,'Otherworldly Leap'],[1,'Pact of the Blade'],[1,'Pact of the Chain'],[1,'Pact of the Tome'],[2,'Repelling Blast'],[15,'Visions of Distant Realms'],[5,'Thirsting Blade'],[7,'Whispers of the Grave'],[9,'Witch Sight'],[5,'Investment of the Chain Master']
].map(([level,name])=>[level,name,'Invocation reference. Review level, pact, spell, and other prerequisites in your book. Record any selected spells and limited uses separately.']),{className:'Warlock',wiki:`${PHB}/character-classes#Warlock`,prerequisites:'Warlock levels and any additional pact, spell, or invocation prerequisites in your book.'});
add('Custom resources','Custom',[[1,'Custom feature','Name and describe any feature, feat, species trait, item power, or house rule.'],[1,'Short-rest resource','Set your own name, maximum uses, dice formula, and notes.','one-short'],[1,'Long-rest resource','Set your own name, maximum uses, dice formula, and notes.','one-long'],[1,'Item charges / manual recovery','Set the item’s maximum charges and recover them according to its rules.','one-manual']],{source:'Custom',wiki:`${RULES_URL}/rules-glossary`});

export const FEATURE_CATALOG=entries;
export const FEATURE_GROUPS=[...new Set(entries.map(entry=>entry.group))];
const normalized=value=>String(value||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const matches=(actual,expected)=>normalized(actual)===normalized(expected);
function speciesMatches(race,allowed) {
  const value=normalized(race);
  return allowed.some(name=>{
    if(matches(race,name))return true;
    if(name==='Elf')return /\b(elf|drow)\b/.test(value);
    if(name==='Gnome')return /\bgnome\b/.test(value);
    if(name==='Dwarf')return /\bdwarf\b/.test(value);
    if(name==='Tiefling')return /\btiefling\b/.test(value);
    return false;
  });
}
export function featureMatchesCharacter(entry,character={}) {
  if(entry.className&&!matches(character.class,entry.className))return false;
  if(entry.subclass&&!matches(character.subclass,entry.subclass))return false;
  if(entry.species&&!speciesMatches(character.race,entry.species))return false;
  if(entry.group==='Fighting styles'&&!['Fighter','Paladin','Ranger'].includes(character.class))return false;
  return true;
}
export function filterFeatures({character={},scope='character',group='All',query=''}={}) {
  const terms=normalized(query).split(' ').filter(Boolean);
  return entries.filter(entry=>{
    if(group!=='All'&&entry.group!==group)return false;
    if(scope!=='all'&&(!featureMatchesCharacter(entry,character)||(scope==='character'&&entry.level>(character.level||1))))return false;
    const haystack=normalized([entry.name,entry.details,entry.group,entry.owner,entry.className,entry.subclass,entry.source,...(entry.species||[])].join(' '));
    return terms.every(term=>haystack.includes(term));
  });
}
export function featureRequirements(entry) {
  return [entry.className,entry.subclass,...(entry.species||[]),entry.level>1?`Level ${entry.level}+`:'',entry.prerequisites].filter(Boolean).join(' · ')||'Any character; review your chosen options';
}
const tier=(level,steps)=>steps.reduce((value,[at,next])=>level>=at?next:value,steps[0][1]);
export function featureFields(entry,character={},classLevel=character.level||1) {
  const level=Math.max(1,Math.min(20,Math.trunc(Number(classLevel))||1));
  const totalLevel=Math.max(1,Math.min(20,Number(character.level)||1));
  const pb=2+Math.floor((totalLevel-1)/4),ability=name=>Math.max(1,mod(character.stats?.[name]??10));
  let maxUses=0,reset='manual',shortRestRecovery=0,rollFormula='';
  const resource=entry.resource;
  if(resource){reset='long';maxUses=1;}
  if(resource==='one-short')reset='short';
  if(resource==='one-manual')reset='manual';
  if(resource==='two-long')maxUses=2;
  if(resource==='pb-long'||resource==='pb-short'){maxUses=pb;if(resource==='pb-short')reset='short';}
  if(['wis-long','int-long','con-long'].includes(resource))maxUses=ability(resource.slice(0,3));
  if(resource==='rage'){maxUses=tier(level,[[1,2],[3,3],[6,4],[12,5],[17,6]]);shortRestRecovery=1;}
  if(resource==='second-wind'){maxUses=tier(level,[[1,2],[4,3],[10,4]]);shortRestRecovery=1;rollFormula=`1d10+${level}`;}
  if(resource==='action-surge'){maxUses=level>=17?2:1;reset='short';}
  if(resource==='indomitable')maxUses=tier(level,[[1,1],[13,2],[17,3]]);
  if(resource==='inspiration'){maxUses=ability('cha');reset=level>=5?'short':'long';rollFormula=`1d${tier(level,[[1,6],[5,8],[10,10],[15,12]])}`;}
  if(resource==='cleric-channel'){maxUses=tier(level,[[1,2],[6,3],[18,4]]);shortRestRecovery=1;}
  if(resource==='paladin-channel'){maxUses=level>=11?3:2;shortRestRecovery=1;}
  if(resource==='wild-shape'){maxUses=tier(level,[[1,2],[6,3],[17,4]]);shortRestRecovery=1;}
  if(resource==='focus'){maxUses=level;reset='short';}
  if(resource==='martial-arts'||resource==='metabolism'){rollFormula=`1d${tier(level,[[1,6],[5,8],[11,10],[17,12]])}${resource==='metabolism'?`+${level}`:''}`;if(resource==='martial-arts'){maxUses=0;reset='manual';}}
  if(resource==='lay-on-hands')maxUses=level*5;
  if(resource==='favored-enemy')maxUses=tier(level,[[1,2],[5,3],[9,4],[13,5],[17,6]]);
  if(resource==='tireless'){maxUses=ability('wis');rollFormula=`1d8${signed(mod(character.stats?.wis??10))}`;}
  if(resource==='sneak-attack'){maxUses=0;reset='manual';rollFormula=`${Math.ceil(level/2)}d6`;}
  if(resource==='sorcery')maxUses=level;
  if(resource==='superiority'){maxUses=tier(level,[[1,4],[7,5],[15,6]]);reset='short';rollFormula=`1d${tier(level,[[1,8],[10,10],[18,12]])}`;}
  if(resource==='psi'){maxUses=2*(2+Math.floor((level-1)/4));shortRestRecovery=1;rollFormula=`1d${tier(level,[[1,6],[5,8],[11,10],[17,12]])}`;}
  if(resource==='wholeness'){maxUses=ability('wis');rollFormula=`1d${tier(level,[[1,6],[5,8],[11,10],[17,12]])}${signed(mod(character.stats?.wis??10))}`;}
  if(resource==='fiend-luck'){maxUses=ability('cha');rollFormula='1d10';}
  if(resource==='healing-hands')rollFormula=`${pb}d4`;
  if(resource==='breath'){maxUses=pb;rollFormula=`${tier(totalLevel,[[1,1],[5,2],[11,3],[17,4]])}d10`;}
  if(resource==='stone-endurance'){maxUses=pb;const con=mod(character.stats?.con??10);rollFormula=`1d12${con<0?'':'+'}${con}`;}
  return {name:entry.name,description:entry.details,wiki:entry.wiki,maxUses,reset,shortRestRecovery,rollFormula};
}
