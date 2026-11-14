import {SAVE_VERSION, makeCharacter, uid, wikiURL} from './model.js';

// The supplied paper sheets are character data, never executable instructions.
// Use 2024 classes with the group's older origin/subclass choices where indicated.
const item = (name,category='Gear',qty=1,description='',equipped=false) => ({id:uid(),name,category,qty,weight:0,equipped,description,wiki:''});
const feature = (name,description,values={}) => ({id:uid(),name,description,maxUses:0,used:0,reset:'manual',rollFormula:'',shortRestRecovery:0,wiki:'',...values});
const attack = (name,ability,bonus,damage,type,notes='',values={}) => ({id:uid(),name,ability,bonus,damage,type,notes,proficient:true,range:'5 ft.',rollMode:'normal',...values});
const spell = (name,level,school,range,duration,concentration,notes) => ({id:uid(),name,level,school,castingTime:'1 action',range,duration,concentration,prepared:true,notes,wiki:wikiURL(name,'spell')});
const linkFeatures = (c,names,url) => c.features.filter(f=>names.includes(f.name)).forEach(f=>{f.wiki=url.endsWith('/feat:all')?wikiURL(f.name,'feat'):url;});
const review = (source,body) => ({id:uid(),title:'2024 conversion & paper sheet notes',tag:'Personal',pinned:true,updated:new Date().toISOString(),body:`Source: ${source}.\n\n${body}\n\nThe recorded final ability scores and rolled maximum HP are retained. Background increases are already included; do not add species ability increases. Blank current HP starts at maximum; blank XP and temporary HP start at 0. Equipment weights were not written and start at 0. Special effects and situational modifiers are resolved manually unless a roll mode or resource explicitly tracks them.\n\n2024 rules and older-origin guidance: https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character#BackgroundsandSpeciesfromOlderBooks`});

function melchior() {
  const c=makeCharacter({name:'Melchior',playerName:'Eric',race:'Drow',class:'Fighter',subclass:'Battle Master',background:'Criminal (Fence)',alignment:'Chaotic Neutral',campaign:'',level:3,
    stats:{str:16,dex:10,con:12,int:8,wis:10,cha:7},maxHp:21,hp:21,ac:18,speed:30,hitDice:3,initiativeBonus:2,
    copper:175,silver:301,electrum:100,gold:373,platinum:7,
    saves:['str','con'],skills:['Acrobatics','Athletics','Deception','Stealth','Perception','Insight'],spellAbility:'cha',
    personalityTraits:'Looks for things to steal or hidden.',ideals:'People — loyal to friends.',bonds:'Want to become the greatest thief!',flaws:"An innocent person is in prison for a crime I committed (and I don’t care).",
    languages:'Common, Elvish, Dwarvish',armorProficiencies:'Light, Medium, and Heavy armor; Shields',weaponProficiencies:'Simple and Martial weapons',toolProficiencies:'Thieves’ tools; Smith’s tools (Student of War)',senses:'Superior Darkvision: 120 ft. (2014 Drow)',
    defenses:'Chain mail 16 + shield 2 = AC 18. Doff the shield for two-handed attacks. The 2014 Drow’s Sunlight Sensitivity remains applicable.'});
  c.attacks=[
    attack('Longsword','str',0,'1d8+3','Slashing','Versatile: 1d10+3 with two hands (no shield). Mastery: Sap.'),
    attack('Blood spear','str',0,'1d6+3','Piercing','Uses standard spear damage until its magic is confirmed. Versatile: 1d8+3; thrown 20/60 ft. Mastery: Sap.'),
    attack('Longbow','dex',2,'1d8','Piercing','+4 to hit = Dexterity 0 + proficiency 2 + Archery 2. Heavy: Dexterity below 13 gives disadvantage (enabled). Requires two hands and no shield. Mastery: Slow.',{range:'150 / 600 ft.',rollMode:'disadvantage'})
  ];
  c.features=[
    feature('Second Wind','Bonus Action: regain 1d10+3 HP. Apply the healing after rolling. Two uses per Long Rest; recover one spent use on a Short Rest.',{maxUses:2,reset:'long',shortRestRecovery:1,rollFormula:'1d10+3'}),
    feature('Tactical Mind','After a failed ability check, roll 1d10 and add it. Spend one Second Wind use manually only if the check then succeeds; this shares Second Wind’s pool.',{rollFormula:'1d10'}),
    feature('Action Surge','On your turn, take one extra action other than the Magic action.',{maxUses:1,reset:'short'}),
    feature('Superiority dice','Four d8s, recovered on a Short or Long Rest. Maneuvers: Feinting Attack, Riposte, Trip Attack. Spend from this shared pool; maneuver save DC 13 (Strength).',{maxUses:4,reset:'short',rollFormula:'1d8'}),
    feature('Feinting Attack','Spend a shared Superiority die and a Bonus Action to feint at a creature within 5 ft. Gain advantage on your next attack against it this turn; add the die to damage on a hit.'),
    feature('Riposte','When a creature misses you with a melee attack roll, spend your Reaction and a shared Superiority die to make a melee weapon attack against it; add the die to damage on a hit.'),
    feature('Trip Attack','On a weapon or Unarmed Strike hit, spend a shared Superiority die and add it to damage. A Large or smaller target makes a Strength save (DC 13) or falls Prone.'),
    feature('Student of War','Additional Fighter skill: Insight. Additional artisan’s tool: Smith’s tools.'),
    feature('Weapon Mastery','Chosen: Longsword (Sap), Spear (Sap), Longbow (Slow). Change one weapon choice per Long Rest. Apply the mastery effects at the table.'),
    feature('Fighting Style: Archery','Ranged weapon attacks gain +2 accuracy; included in Longbow.'),
    feature('Alert (Origin feat)','The Criminal background uses the older-background guidance. Add proficiency to initiative (included: +2). After rolling, you may swap initiative with a willing ally in the same combat if neither of you is Incapacitated.'),
    feature('Keen Senses','2014 Elf: proficiency in Perception, included on the sheet.'),
    feature('Fey Ancestry & Trance','2014 Drow: advantage on saves against being charmed; magic cannot put you to sleep. Meditate consciously for 4 hours instead of sleeping.'),
    feature('Sunlight Sensitivity','2014 Drow: attack rolls and sight-based Perception checks have disadvantage when you, the target, or the perceived subject is in direct sunlight. Resolve this situational effect manually.'),
    feature('Drow Magic: Faerie Fire','2014 Drow: one Faerie Fire casting per Long Rest using Charisma. In Spellbook choose No slot, then spend this use.',{maxUses:1,reset:'long'})
  ];
  c.spells=[spell('Dancing Lights',0,'Illusion','120 ft.','Up to 1 minute',true,'2024 spell: up to four small lights or one humanoid shape; move them with a Bonus Action. Drow cantrip; uses Charisma.'),spell('Faerie Fire',1,'Evocation','60 ft.','Up to 1 minute',true,'2024 spell: Dexterity save; outlined targets grant advantage to attackers who can see them and cannot benefit from Invisible. One free Drow casting per Long Rest; choose No slot and spend the matching feature use.')];
  c.items=[
    item('Chain mail','Armor',1,'AC 16; Stealth checks have disadvantage.',true),item('Shield','Armor',1,'+2 AC while wielded; doff for two-handed attacks.',true),
    item('Longsword','Weapon',1,'1d8+3 slashing; 1d10+3 with two hands.',true),item('Blood spear','Weapon',1,'Original sheet says 1d6+4; unverified magic is recorded here. Default attack uses normal spear damage.'),item('Longbow','Weapon',1,'1d8 piercing; +4 accuracy; Heavy disadvantage with Dexterity 10.'),
    item('Arrows','Gear',40),item('Healer’s kit','Gear',9,'Written “Healer’s kit x9”; confirm whether this is kits or remaining uses.'),
    item('Backpack'),item('Hammer'),item('Pitons','Gear',10),item('Torches','Gear',10),item('Rations','Consumable',20,'20 days of rations.'),item('Tinderbox'),item('Waterskin'),item('Rope','Gear',1,'50 ft.'),
    item('Crowbar','Gear',1,'Use the 2024 equipment’s advantage when it provides leverage. Original sheet annotation: +2 to open; kept here as an unconfirmed house rule.'),item('Spell scroll of invisibility','Consumable',1,'Spell-scroll use requires the spell to be on your class spell list. This Fighter cannot normally use it; another caster or a table ruling is needed.'),item('Quaal’s feather token','Gear',1,'Token type and effect are not specified.'),
    item('Potion of flying','Consumable',1,'Faint handwritten “pot. flying”; confirm this reading.'),item('Potion of healing','Consumable'),item('Potion of storm giant strength','Consumable'),
    item('Emerald','Treasure',1,'Margin: one emerald, value 15 gp (handwriting to confirm).')
  ];
  c.notes=[review('IMG_4389.jpg','2024 Fighter and Battle Master; 2014 Drow and Criminal (Fence) retained as origin choices. Example background allocation: +2 Dexterity, +1 Constitution, already included in the final scores. Alert is the chosen Origin feat. Fighter skills: Acrobatics/Athletics; background: Deception/Stealth; Student of War: Insight; Elf: Perception. Third starting language selected: Dwarvish.\n\nCorrections: chain mail plus shield totals AC 18; Alert gives initiative +2; Perception proficiency gives passive 12 without an artificial bonus. Longbow is +4 and 1d8, with Heavy disadvantage; original +7 / 1d8+3 is retained here for reference. Blood spear defaults to normal spear damage until its unidentified magic is confirmed. Second Wind has 2 uses, Long Rest reset, +1 use per Short Rest. Added Tactical Mind, Weapon Mastery, Student of War, a third maneuver (Trip Attack), and Drow Faerie Fire. Know Your Enemy is a level 7 feature, so it is not active at level 3.\n\nCopper is read as 175; gold as 373. The flying potion label, emerald value, erased marks, and historical shaded death saves need review. Death saves start clear. Chain mail’s Stealth disadvantage and Drow sunlight penalties are situational and applied manually.')];
  linkFeatures(c,['Superiority dice','Feinting Attack','Riposte','Trip Attack','Student of War'],wikiURL('Battle Master','Fighter'));
  linkFeatures(c,['Keen Senses','Fey Ancestry & Trance','Sunlight Sensitivity','Drow Magic: Faerie Fire'],wikiURL('Elf','species','2014'));
  linkFeatures(c,['Alert (Origin feat)','Fighting Style: Archery'],wikiURL('feats'));
  return c;
}

function balin() {
  const c=makeCharacter({name:'Balin',playerName:'Rob',race:'Hill Dwarf',class:'Barbarian',subclass:'Path of the Beast',background:'Guild Artisan',alignment:'Neutral Good',campaign:'',level:3,
    stats:{str:16,dex:14,con:14,int:10,wis:4,cha:9},maxHp:35,hp:35,ac:16,speed:25,hitDice:3,
    copper:100,silver:140,electrum:40,gold:90,platinum:14,
    saves:['str','con'],skills:['Athletics','Insight','Intimidation','Persuasion','Perception'],
    personalityTraits:'Always want to know how things work.',ideals:'Aspiration — work hard.',bonds:'Revenge on those who destroyed my business.',flaws:'Always want more.',
    languages:'Common, Dwarvish, Elvish',armorProficiencies:'Light and Medium armor; Shields',weaponProficiencies:'Simple and Martial weapons',toolProficiencies:'Jeweler’s tools (Guild Artisan); Brewer’s supplies (2014 Dwarf); Smith’s tools, Mason’s tools, Tinker’s tools (Crafter)',
    senses:'Darkvision: 60 ft. (2014 Hill Dwarf)',defenses:'Unarmored Defense: 10 + Dexterity 2 + Constitution 2 + shield 2 = AC 16. Without the shield: AC 14. Greataxe requires two hands. Dwarven Resilience grants Poison resistance.'});
  c.attacks=[
    attack('Greataxe','str',0,'1d12+3','Slashing','Two hands; doff shield and use AC 14. Mastery: Cleave. Add +2 damage while raging.'),
    attack('+1 Battleaxe','str',1,'1d8+4','Slashing','One-handed with shield. Versatile: 1d10+4 without shield. Mastery: Topple, DC 13. Add +2 damage while raging.'),
    attack('Beast: Bite','str',0,'1d8+3','Piercing','Only in Bite form during Rage; add +2 Rage damage. Once on your turn, a damaging bite heals 2 HP if you were below half HP when you hit.'),
    attack('Beast: Claws','str',0,'1d6+3','Slashing','Only in Claws form during Rage, with an empty claw hand; add +2 Rage damage. Once per turn, attacking with a claw as part of the Attack action allows one extra claw attack in that action.'),
    attack('Beast: Tail','str',0,'1d8+3','Piercing','Only in Tail form during Rage; add +2 Rage damage. Reach 10 ft. Tail reaction can add 1d8 AC against a visible attacker’s hit within 10 ft.',{range:'10 ft.'})
  ];
  c.features=[
    feature('Rage','Bonus Action while not in Heavy armor. Resist Bludgeoning, Piercing, and Slashing; add +2 damage to Strength-based weapon/Unarmed Strike hits; advantage on Strength checks and saves. No spells or concentration. Extend each round with an enemy attack roll, forcing an enemy save, or a Bonus Action, up to 10 minutes. Ends on Incapacitated or donning Heavy armor. Apply effects manually.',{maxUses:3,reset:'long',shortRestRecovery:1}),
    feature('Reckless Attack','Choose on your first attack roll of your turn: Strength-based attack rolls have advantage until your next turn, and attacks against you also have advantage until then. Set attack roll mode as needed.'),
    feature('Danger Sense','Advantage on Dexterity saving throws unless Incapacitated. This applies to saves, not Dexterity ability checks; roll with advantage manually.'),
    feature('Primal Knowledge','Additional Barbarian skill: Perception (included). While raging, Acrobatics, Intimidation, Perception, Stealth, and Survival checks may use Strength. Roll those situational Strength checks with advantage manually.'),
    feature('Unarmored Defense','With no armor: 10 + Dexterity modifier + Constitution modifier. A shield is allowed; current AC 16 includes it.'),
    feature('Weapon Mastery','Chosen: Greataxe (Cleave) and Battleaxe (Topple). Change one weapon choice per Long Rest. Resolve mastery effects manually; the Beast’s natural weapons have no assigned mastery.'),
    feature('Form of the Beast (Tasha’s)','Retained supplemental subclass with the 2024 Barbarian. On entering Rage choose Bite, Claws, or Tail; use only that form’s attack until Rage ends. The natural weapon counts as a simple melee weapon. See attack notes for its effect.'),
    feature('Beast: Tail defense','Only in Tail form: Reaction when a creature you see within 10 ft. hits you. Roll 1d8 and add it to AC against that attack; determine whether the hit misses manually.',{rollFormula:'1d8'}),
    feature('Dwarven Resilience','2014 Hill Dwarf: advantage on saves against poison and resistance to Poison damage. Apply these situational effects manually.'),
    feature('Dwarven Toughness','2014 Hill Dwarf: +1 maximum HP per character level. The retained 35 HP includes this level 3 bonus of 3; do not add it again.'),
    feature('Stonecunning','2014 Dwarf: when an Intelligence (History) check concerns the origin of stonework, use double proficiency. At this level, roll 1d20+4 manually.'),
    feature('Crafter (Origin feat)','Chosen using the older Guild Artisan background guidance. Three extra tool proficiencies: Smith’s, Mason’s, and Tinker’s. Buy nonmagical items at a 20% discount. With appropriate proficient tools, make one temporary item from the feat’s Fast Crafting table after a Long Rest.')
  ];
  c.items=[
    item('Greataxe','Weapon',1,'1d12+3 slashing; two hands; incompatible with wielding the shield.'),item('+1 Battleaxe','Weapon',1,'1d8+4 slashing one-handed; 1d10+4 two-handed.',true),item('Shield','Armor',1,'+2 AC, included in AC 16.',true),
    item('Magic spear','Weapon',1,'Magic effect and attack statistics are not written.'),item('Handaxes','Weapon',2),item('Javelins','Weapon',4),
    item('Potion of healing','Consumable'),item('Oil of slipperiness','Consumable'),item('Potion of mind reading','Consumable'),item('Potion of flying','Consumable'),item('Arrow of slaying','Consumable'),
    item('Jeweler’s kit','Gear',1,'Spelling normalized from the handwritten equipment entry.')
  ];
  c.notes=[review('IMG_4390.jpg','2024 Barbarian with the existing Path of the Beast (Tasha’s), 2014 Hill Dwarf, and Guild Artisan choices retained. Background increases are treated as +2 Strength and +1 Dexterity, already included. Crafter is the selected Origin feat. Barbarian skills: Athletics/Intimidation; Guild Artisan: Insight/Persuasion; Primal Knowledge: Perception, giving passive 9 with no artificial adjustment. Languages and unrecorded tool selections are editable defaults.\n\nRage now has 3 uses, Long Rest reset, and +1 use on a Short Rest. Added Primal Knowledge, Weapon Mastery, Unarmored Defense, and all three Beast form attacks. Danger Sense gives advantage on Dexterity saves, not checks. Hill Dwarf’s retained species uses speed 25 and Darkvision 60 ft.; the paper speed 30 was corrected. AC 16 includes shield; AC 14 when using the two-handed greataxe.\n\nThe paper’s Relentless Endurance is not supplied by this dwarf/class build; its presence needs a specific table grant. “Healing Surge (everyone)” is a table rule, not a standard class feature. Both original labels remain recorded here. The magic spear’s effect is unspecified. Name reads Balin, HP 35, Wisdom 4. Margin: “jeweler / mercs” (uncertain), 3 green, 3 dark blue, 3 light blue, 3 brown, 3 black, a separate 15, and a column “13, 9, 10, 14, 14, 4”.')];
  linkFeatures(c,['Form of the Beast (Tasha’s)','Beast: Tail defense'],wikiURL('Path of the Beast','Barbarian','2014'));
  linkFeatures(c,['Dwarven Resilience','Dwarven Toughness','Stonecunning'],wikiURL('Dwarf','species','2014'));
  linkFeatures(c,['Crafter (Origin feat)'],wikiURL('Crafter','feat'));
  return c;
}

function teyla() {
  const c=makeCharacter({name:'Teyla',playerName:'Jen',race:'Wood Elf',class:'Rogue',subclass:'Assassin',background:'Folk Hero (Insurrectionist)',alignment:'Chaotic Neutral',campaign:'',level:3,
    stats:{str:12,dex:20,con:12,int:12,wis:8,cha:8},maxHp:24,hp:24,ac:17,speed:35,hitDice:3,inspiration:true,initiativeAdvantage:true,spellAbility:'int',
    copper:80,silver:271,electrum:70,gold:338,platinum:5,
    saves:['dex','int'],skills:['Acrobatics','Animal Handling','Athletics','Investigation','Stealth','Survival','Perception'],expertise:['Athletics','Stealth'],
    personalityTraits:'Confident in myself and the potential of others.',ideals:'Freedom fighter!',bonds:'Family! Even though I don’t know where they are.',flaws:'Things would be better if I were in charge. (Tyrant at heart.)',
    languages:'Common, Elvish, Dwarvish; Abyssal (Rogue); Thieves’ Cant',armorProficiencies:'Light armor',weaponProficiencies:'Simple weapons; Martial weapons with the Finesse or Light property',toolProficiencies:'Disguise kit; Poisoner’s kit; Thieves’ tools; Woodcarver’s tools and land vehicles (Folk Hero)',
    senses:'Darkvision: 60 ft.',defenses:'Written AC 17. Studded leather armor is listed; equipment does not recalculate AC.'});
  c.attacks=[
    attack('Shortsword','dex',0,'1d6+5','Piercing','Finesse, Light. Mastery: Vex. Qualifies for Sneak Attack when its conditions are met.'),attack('Shortbow','dex',0,'1d6+5','Piercing','Mastery: Vex. Qualifies for Sneak Attack when its conditions are met.',{range:'80 / 320 ft.'}),
    attack('Longsword','str',0,'1d8+1','Slashing','No proficiency: 2024 Rogue and Wood Elf do not grant this weapon. Uses Strength; versatile 1d10+1. No Sneak Attack because it lacks Finesse and is not ranged.',{proficient:false})
  ];
  c.features=[
    feature('Sneak Attack','Once per turn, add 2d6 on a hit with a Finesse or Ranged weapon when you have advantage, or an ally is within 5 ft. of the target and is not Incapacitated and you lack disadvantage. Roll damage separately.',{rollFormula:'2d6'}),
    feature('Expertise','Double proficiency in Athletics and Stealth (included).'),
    feature('Cunning Action','On your turn, use a Bonus Action to Dash, Disengage, or Hide.'),
    feature('Steady Aim','Bonus Action if you have not moved this turn: gain advantage on your next attack roll this turn; your Speed becomes 0 for the rest of the turn. Set the attack’s roll mode when using this.'),
    feature('Assassinate','Advantage on initiative (enabled). In round 1, advantage on attack rolls against creatures that have not acted; a Sneak Attack hit in that round adds 3 damage of the weapon’s type. Apply that damage manually. Surprise no longer makes these hits automatic critical hits.'),
    feature('Assassin’s Tools','Gain a Disguise kit and Poisoner’s kit and proficiency with both; kits are in inventory.'),
    feature('Weapon Mastery','Chosen: Shortsword (Vex) and Shortbow (Vex). A damaging Vex hit grants advantage on your next attack against that creature before your next turn ends. Change one weapon choice per Long Rest.'),
    feature('Fey Ancestry & Trance','Advantage on saves to avoid or end Charmed; no sleep needed and magic cannot put you to sleep. A conscious four-hour trance can complete a Long Rest.'),
    feature('Keen Senses','Chosen Elf skill: Perception. This gives passive Perception 11 with no artificial adjustment.'),
    feature('Wood Elf: Longstrider','2024 lineage: Druidcraft, base speed 35 ft., and one free Longstrider per Long Rest at level 3. Intelligence is the chosen casting ability. Choose No slot and spend this use; add 10 ft. speed manually while the spell is active.',{maxUses:1,reset:'long'}),
    feature('Lucky (Origin feat)','Chosen under the older Folk Hero background guidance. Spend a Luck Point to gain advantage on your D20 Test or impose disadvantage on an attack roll against you. Two points at this level; recover all on a Long Rest. Apply the roll mode manually.',{maxUses:2,reset:'long'}),
    feature('Rustic Hospitality (Folk Hero)','The older background remains part of the character: common folk may offer shelter and assistance, subject to its limits and the table’s ruling.'),
    feature('Blowgun & poison','Original equipment is retained. A blowgun has neither Finesse nor Light, so this Rogue has no proficiency with it; poison effects and ammunition are managed at the table.')
  ];
  c.items=[
    item('Longsword','Weapon',1,'Not proficient; Strength-based 1d8+1. Retained from the paper inventory.'),item('Shortsword','Weapon',1,'1d6+5 piercing.',true),item('Shortbow','Weapon',1,'1d6+5 piercing.'),item('Arrows','Gear',25),
    item('Studded leather armor','Armor',1,'Written total AC 17.',true),item('Daggers','Weapon',2),item('Blowgun','Weapon'),item('Blowgun needles','Gear',100),item('Poison vial','Consumable'),
    item('Explorer’s pack','Gear',1,'Contents are listed separately below; no combined pack weight is added.'),item('Bedroll'),item('Mess kit'),item('Tinderbox'),item('Torches','Gear',10),item('Rations','Consumable',20),item('Waterskin'),item('Hempen rope','Gear',1,'50 ft.'),
    item('Thieves’ tools'),item('Disguise kit','Gear',1,'Granted by 2024 Assassin’s Tools.'),item('Poisoner’s kit','Gear',1,'Granted by 2024 Assassin’s Tools.'),item('Grappling hook','Gear',1,'A parenthetical rope annotation is hard to read.'),item('Healer’s kit','Gear',8,'Written “Healer’s kit x8”; confirm whether this means kits or uses.'),
    item('Driftglobe','Gear',1,'Sheet annotation: Daylight. Track its effects and charges manually.'),item('Potion of healing','Consumable'),item('Potion of greater healing','Consumable'),item('Potion of stone giant strength','Consumable'),item('Potion of supreme healing','Consumable'),item('Sovereign glue','Consumable'),item('Colored chalk','Gear',10)
  ];
  c.spells=[spell('Druidcraft',0,'Transmutation','30 ft.','Instantaneous',false,'Wood Elf lineage cantrip using Intelligence. Create minor natural effects as described in the 2024 spell.'),spell('Longstrider',1,'Transmutation','Touch','1 hour',false,'Wood Elf lineage: one free casting per Long Rest. Choose No slot, spend the feature use, and increase the target’s speed by 10 ft. manually.')];
  c.notes=[review('IMG_4391.jpg','2024 Rogue/Assassin and Wood Elf, with mixed elf/human ancestry in the story. Folk Hero (Insurrectionist) is retained as requested using the 2024 older-background guidance. Background increases: +2 Dexterity and +1 Charisma, already included. Lucky is the chosen Origin feat. Rogue skills: Acrobatics/Athletics/Investigation/Stealth; Folk Hero: Animal Handling/Survival; Keen Senses: Perception. Expertise stays Athletics/Stealth. Woodcarver’s tools is the selected Folk Hero artisan proficiency; Dwarvish is the additional starting language and Abyssal is the Rogue’s extra language.\n\nCorrections: base speed 35, Perception proficiency for passive 11, no artificial passive adjustment. Longsword uses Strength, no proficiency: +1 to hit and 1d8+1 (original sheet: +7 and 1d8+5). It does not qualify for Sneak Attack. The 2024 Wood Elf has lineage magic rather than the old weapon training. Added Druidcraft, Longstrider, Cunning Action, Weapon Mastery, Lucky, and both Assassin kits. Assassinate grants initiative advantage and +3 damage on a round-one Sneak Attack hit, not automatic surprise criticals.\n\nAge 70; height 6 ft.; Inspiration starts enabled from the marked box. Healer’s kit quantity and the grappling-hook rope note need review. Margin scores “18, 12, 11, 8, 12, 8” remain here rather than replacing the circled current scores.')];
  linkFeatures(c,['Assassinate','Assassin’s Tools'],wikiURL('Assassin','Rogue'));
  linkFeatures(c,['Keen Senses','Fey Ancestry & Trance','Wood Elf: Longstrider'],wikiURL('Elf','species'));
  linkFeatures(c,['Lucky (Origin feat)'],wikiURL('Lucky','feat'));
  linkFeatures(c,['Rustic Hospitality (Folk Hero)'],wikiURL('Folk Hero','background','2014'));
  return c;
}

export function defaultCharacters() { return [melchior(),balin(),teyla()]; }
export function initialState() {
  return {version:SAVE_VERSION,characters:[],activeId:null,settings:{sound:false}};
}
