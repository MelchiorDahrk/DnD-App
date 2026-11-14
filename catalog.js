// Rules summaries adapted from the CC BY 4.0 SRD 5.2.1. See README.md for attribution.
// Core-book options outside the SRD have short reference summaries, not full rules text.
import {CLASSES, wikiURL, subclassURL, mod, signed, uid} from './model.js';

const slug = value => value.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const equipmentURL=(name,group)=>{
  const named=wikiURL(name,'equipment');
  if(!named.endsWith('/equipment:all'))return named;
  return wikiURL(/Weapons/.test(group)?'weapons':/Armor/.test(group)?'armor':/Tools|instruments|Gaming/.test(group)?'tools':/vehicles|Mounts|Ships/.test(group)?'mounts':'adventuring-gear');
};
const equipment = (name,group,weight,cost,details,extra={}) => ({id:slug(name),name,group,category:'Gear',weight,cost,details,wiki:equipmentURL(name,group),...extra});

// name, damage, type, properties, mastery, weight (lb.), cost, family
const weaponRows = [
  ['Club','1d4','Bludgeoning','Light','Slow',2,'1 SP','Simple melee'],
  ['Dagger','1d4','Piercing','Finesse, Light, Thrown (20/60 ft.)','Nick',1,'2 GP','Simple melee'],
  ['Greatclub','1d8','Bludgeoning','Two-Handed','Push',10,'2 SP','Simple melee'],
  ['Handaxe','1d6','Slashing','Light, Thrown (20/60 ft.)','Vex',2,'5 GP','Simple melee'],
  ['Javelin','1d6','Piercing','Thrown (30/120 ft.)','Slow',2,'5 SP','Simple melee'],
  ['Light Hammer','1d4','Bludgeoning','Light, Thrown (20/60 ft.)','Nick',2,'2 GP','Simple melee'],
  ['Mace','1d6','Bludgeoning','None','Sap',4,'5 GP','Simple melee'],
  ['Quarterstaff','1d6','Bludgeoning','Versatile (1d8)','Topple',4,'2 SP','Simple melee'],
  ['Sickle','1d4','Slashing','Light','Nick',2,'1 GP','Simple melee'],
  ['Spear','1d6','Piercing','Thrown (20/60 ft.), Versatile (1d8)','Sap',3,'1 GP','Simple melee'],
  ['Dart','1d4','Piercing','Finesse, Thrown (20/60 ft.)','Vex',0.25,'5 CP','Simple ranged'],
  ['Light Crossbow','1d8','Piercing','Ammunition (80/320 ft.; bolts), Loading, Two-Handed','Slow',5,'25 GP','Simple ranged'],
  ['Shortbow','1d6','Piercing','Ammunition (80/320 ft.; arrows), Two-Handed','Vex',2,'25 GP','Simple ranged'],
  ['Sling','1d4','Bludgeoning','Ammunition (30/120 ft.; sling bullets)','Slow',0,'1 SP','Simple ranged'],
  ['Battleaxe','1d8','Slashing','Versatile (1d10)','Topple',4,'10 GP','Martial melee'],
  ['Flail','1d8','Bludgeoning','None','Sap',2,'10 GP','Martial melee'],
  ['Glaive','1d10','Slashing','Heavy, Reach, Two-Handed','Graze',6,'20 GP','Martial melee'],
  ['Greataxe','1d12','Slashing','Heavy, Two-Handed','Cleave',7,'30 GP','Martial melee'],
  ['Greatsword','2d6','Slashing','Heavy, Two-Handed','Graze',6,'50 GP','Martial melee'],
  ['Halberd','1d10','Slashing','Heavy, Reach, Two-Handed','Cleave',6,'20 GP','Martial melee'],
  ['Lance','1d10','Piercing','Heavy, Reach, Two-Handed (unless mounted)','Topple',6,'10 GP','Martial melee'],
  ['Longsword','1d8','Slashing','Versatile (1d10)','Sap',3,'15 GP','Martial melee'],
  ['Maul','2d6','Bludgeoning','Heavy, Two-Handed','Topple',10,'10 GP','Martial melee'],
  ['Morningstar','1d8','Piercing','None','Sap',4,'15 GP','Martial melee'],
  ['Pike','1d10','Piercing','Heavy, Reach, Two-Handed','Push',18,'5 GP','Martial melee'],
  ['Rapier','1d8','Piercing','Finesse','Vex',2,'25 GP','Martial melee'],
  ['Scimitar','1d6','Slashing','Finesse, Light','Nick',3,'25 GP','Martial melee'],
  ['Shortsword','1d6','Piercing','Finesse, Light','Vex',2,'10 GP','Martial melee'],
  ['Trident','1d8','Piercing','Thrown (20/60 ft.), Versatile (1d10)','Topple',4,'5 GP','Martial melee'],
  ['Warhammer','1d8','Bludgeoning','Versatile (1d10)','Push',5,'15 GP','Martial melee'],
  ['War Pick','1d8','Piercing','Versatile (1d10)','Sap',2,'5 GP','Martial melee'],
  ['Whip','1d4','Slashing','Finesse, Reach','Slow',3,'2 GP','Martial melee'],
  ['Blowgun','1','Piercing','Ammunition (25/100 ft.; needles), Loading','Vex',1,'10 GP','Martial ranged'],
  ['Hand Crossbow','1d6','Piercing','Ammunition (30/120 ft.; bolts), Light, Loading','Vex',3,'75 GP','Martial ranged'],
  ['Heavy Crossbow','1d10','Piercing','Ammunition (100/400 ft.; bolts), Heavy, Loading, Two-Handed','Push',18,'50 GP','Martial ranged'],
  ['Longbow','1d8','Piercing','Ammunition (150/600 ft.; arrows), Heavy, Two-Handed','Slow',2,'50 GP','Martial ranged'],
  ['Musket','1d12','Piercing','Ammunition (40/120 ft.; firearm bullets), Loading, Two-Handed','Slow',10,'500 GP','Martial ranged'],
  ['Pistol','1d10','Piercing','Ammunition (30/90 ft.; firearm bullets), Loading','Vex',3,'250 GP','Martial ranged']
];
export const WEAPONS = weaponRows.map(([name,damage,type,properties,mastery,weight,cost,family]) => equipment(name,'Weapons',weight,cost,`${family}. ${damage} ${type.toLowerCase()}. ${properties}. Mastery: ${mastery}.`,{category:'Weapon',damage,type,properties,mastery,family}));

const armorRows = [
  ['Padded Armor',8,'5 GP',11,'Light',0,true],['Leather Armor',10,'10 GP',11,'Light',0,false],['Studded Leather Armor',13,'45 GP',12,'Light',0,false],
  ['Hide Armor',12,'10 GP',12,'Medium',0,false],['Chain Shirt',20,'50 GP',13,'Medium',0,false],['Scale Mail',45,'50 GP',14,'Medium',0,true],['Breastplate',20,'400 GP',14,'Medium',0,false],['Half Plate Armor',40,'750 GP',15,'Medium',0,true],
  ['Ring Mail',40,'30 GP',14,'Heavy',0,true],['Chain Mail',55,'75 GP',16,'Heavy',13,true],['Splint Armor',60,'200 GP',17,'Heavy',15,true],['Plate Armor',65,'1,500 GP',18,'Heavy',15,true],['Shield',6,'10 GP',2,'Shield',0,false]
];
export const ARMOR = armorRows.map(([name,weight,cost,ac,family,strength,stealth]) => {
  const armorClass=family==='Shield'?'+2 AC':`${ac}${family==='Light'?' + Dex modifier':family==='Medium'?' + Dex modifier (max +2)':''} AC`;
  return equipment(name,'Armor & shields',weight,cost,`${family}. ${armorClass}. ${strength?`Strength ${strength} or speed −10 ft. `:''}${stealth?'Disadvantage on Stealth. ':''}Requires appropriate armor training.`,{category:'Armor',ac,family,strength,stealth});
});

const gearRows = [
  ['Acid',1,'25 GP','Replace an attack: throw up to 20 ft.; Dex save (8 + Dex modifier + proficiency) or 2d6 acid damage.'],
  ["Alchemist’s Fire",1,'50 GP','Replace an attack: throw up to 20 ft.; Dex save (8 + Dex modifier + proficiency) or 1d4 fire damage and burning.'],
  ['Antitoxin',0,'50 GP','Drink as a Bonus Action; advantage on saves to avoid or end Poisoned for 1 hour.'],
  ['Backpack',5,'2 GP','Capacity: 30 lb. / 1 cubic foot. Can also serve as a saddlebag.'],
  ['Ball Bearings',2,'1 GP','Utilize: cover a 10-foot square within 10 ft.; entering creatures make a DC 10 Dex save or fall Prone.'],
  ['Barrel',70,'2 GP','Capacity: 40 gallons of liquid or 4 cubic feet of dry goods.'],
  ['Basket',2,'4 SP','Capacity: 40 lb. / 2 cubic feet.'],
  ['Bedroll',7,'1 GP','Sleeps one Small or Medium creature; protects against extreme cold while used.'],
  ['Bell',0,'1 GP','Utilize: ring a bell audible up to 60 ft. away.'],
  ['Blanket',3,'5 SP','Advantage on saves against extreme cold while wrapped in it.'],
  ['Block and Tackle',5,'1 GP','Hoist up to four times the weight you can normally lift.'],
  ['Book',5,'25 GP','An accurate nonfiction reference grants +5 to relevant Intelligence knowledge checks about its topic.'],
  ['Bottle, Glass',2,'2 GP','Capacity: 1½ pints.'],['Bucket',2,'5 CP','Capacity: ½ cubic foot.'],
  ["Burglar’s Pack",42,'16 GP','Backpack, ball bearings, bell, 10 candles, crowbar, hooded lantern, 7 oil, 5 days of rations, rope, tinderbox, waterskin. Weight includes the contents.'],
  ['Caltrops',2,'1 GP','Utilize: cover a 5-foot square; entering creatures make a DC 15 Dex save or take 1 piercing damage and have speed 0 until their next turn.'],
  ['Candle',0,'1 CP','Burns 1 hour; bright light 5 ft. and dim light 5 ft. farther.'],
  ['Case, Crossbow Bolt',1,'1 GP','Holds 20 bolts. Ammunition sold separately.'],['Case, Map or Scroll',1,'1 GP','Holds 10 sheets of paper or 5 sheets of parchment.'],
  ['Chain',10,'5 GP','10-foot chain. Can bind a Grappled, Incapacitated, or Restrained creature; see rules for checks to bind, escape, or break it.'],
  ['Chest',25,'5 GP','Capacity: 12 cubic feet.'],["Climber’s Kit",12,'25 GP','Harness, boot tips, gloves, and pitons. Anchor yourself to limit a fall to 25 ft. from the anchor.'],
  ['Clothes, Fine',6,'15 GP','Fine clothing; may grant advantage when influencing nobles and wealthy people if appropriate.'],['Clothes, Traveler’s',4,'2 GP','Hard-wearing clothing for travel.'],
  ['Component Pouch',2,'25 GP','Replaces nonconsumed spell material components without a specified cost.'],['Costume',4,'5 GP','Dress as a particular person or type of person.'],
  ['Crowbar',5,'2 GP','Advantage on Strength checks where the crowbar provides leverage.'],
  ["Diplomat’s Pack",39,'39 GP','Chest, fine clothes, ink, 5 ink pens, lamp, 2 map/scroll cases, 4 oil, 5 paper, 5 parchment, perfume, tinderbox. Weight includes contents.'],
  ["Dungeoneer’s Pack",55,'12 GP','Backpack, caltrops, crowbar, 2 oil, 10 days of rations, rope, tinderbox, 10 torches, waterskin. Weight includes contents.'],
  ["Entertainer’s Pack",58.5,'40 GP','Backpack, bedroll, bell, bullseye lantern, 3 costumes, mirror, 8 oil, 9 days of rations, tinderbox, waterskin. Weight includes contents.'],
  ["Explorer’s Pack",55,'10 GP','Backpack, bedroll, 2 oil, 10 days of rations, rope, tinderbox, 10 torches, waterskin. Weight includes contents.'],
  ['Flask',1,'2 CP','Capacity: 1 pint.'],['Grappling Hook',4,'2 GP','Utilize: throw to catch a railing or ledge within 50 ft.; DC 13 Dex (Acrobatics).'],
  ["Healer’s Kit",3,'5 GP','10 uses. Utilize: spend one use to stabilize a creature at 0 HP without a Medicine check.'],
  ['Holy Water',1,'25 GP','Replace an attack: throw up to 20 ft.; Fiend or Undead makes Dex save (8 + Dex modifier + proficiency) or takes 2d8 radiant damage.'],
  ['Hunting Trap',25,'5 GP','Utilize: set a trap. DC 13 Dex save or 1d4 piercing damage and speed 0; see rules for escape and anchoring.'],
  ['Ink',0,'10 GP','1-ounce bottle.'],['Ink Pen',0,'2 CP','Writing pen; requires ink.'],['Jug',4,'2 CP','Capacity: 1 gallon.'],['Ladder',25,'1 SP','10 feet long.'],
  ['Lamp',1,'5 SP','Burns 6 hours per oil flask; bright light 15 ft. and dim light 30 ft. farther.'],
  ['Lantern, Bullseye',2,'10 GP','Burns 6 hours per oil flask; bright light in a 60-foot cone and dim light 60 ft. farther.'],
  ['Lantern, Hooded',2,'5 GP','Burns 6 hours per oil flask; bright light 30 ft. and dim light 30 ft. farther. Hood reduces it to dim light 5 ft.'],
  ['Lock',1,'10 GP','Thieves’ Tools: DC 15 Dex check to pick.'],['Magnifying Glass',0,'100 GP','Advantage on checks to inspect fine detail; can light a fire with sunlight.'],
  ['Manacles',6,'2 GP','Bind a Small or Medium creature; see rules for binding, escape, and breaking.'],['Map',0,'1 GP','Accurate map grants +5 to Wisdom (Survival) checks to navigate the mapped area.'],
  ['Mirror',0.5,'5 GP','Handheld steel mirror.'],['Net',3,'1 GP','Replace an attack: target within 15 ft.; Dex save (8 + Dex modifier + proficiency) or Restrained if Large or smaller. Escape DC 10; AC 10, 5 HP.'],
  ['Oil',1,'1 SP','One flask fuels a lamp or lantern for 6 hours. Can be thrown or spread; see rules for ignition and fire damage.'],
  ['Paper',0,'2 SP','One sheet.'],['Parchment',0,'1 SP','One sheet.'],['Perfume',0,'5 GP','4-ounce vial.'],
  ['Poison, Basic',0,'100 GP','Bonus Action: coat a weapon or up to 3 pieces of ammunition. On a hit, adds 1d4 poison damage; lasts 1 minute or until damage is dealt.'],
  ['Pole',7,'5 CP','10 feet long.'],['Pot, Iron',10,'2 GP','Capacity: 1 gallon.'],
  ['Potion of Healing',0.5,'50 GP','Bonus Action: drink or administer within 5 ft.; restores 2d4 + 2 HP. Using it here heals your character.'],
  ['Pouch',1,'5 SP','Capacity: 6 lb. / ⅕ cubic foot.'],
  ["Priest’s Pack",29,'33 GP','Backpack, blanket, holy water, lamp, 7 days of rations, robe, tinderbox. Weight includes contents.'],
  ['Quiver',1,'1 GP','Holds 20 arrows. Ammunition sold separately.'],['Ram, Portable',35,'4 GP','+4 to Strength checks to break a door; a helper grants advantage.'],
  ['Rations',2,'5 SP','Food for one day.'],['Robe',4,'1 GP','Travel or ceremonial robe.'],['Rope',5,'1 GP','50 feet long; can be tied, climbed, or used to bind.'],['Sack',0.5,'1 CP','Capacity: 30 lb. / 1 cubic foot.'],
  ["Scholar’s Pack",22,'40 GP','Backpack, book, ink, ink pen, lamp, 10 oil, 10 paper, tinderbox. Weight includes contents.'],
  ['Shovel',5,'2 GP','Digging tool.'],['Signal Whistle',0,'5 CP','Utilize: audible up to 600 ft. away.'],
  ['Spell Scroll (Cantrip)',0,'30 GP','Single-use spell; the spell must be on your class spell list. See scroll rules for casting.'],['Spell Scroll (Level 1)',0,'50 GP','Single-use level 1 spell; the spell must be on your class spell list. See scroll rules for casting.'],
  ['Spikes, Iron',5,'1 GP','Ten iron spikes.'],['Spyglass',1,'1,000 GP','Objects viewed through it are magnified to twice their size.'],['String',0,'1 SP','10 feet long.'],
  ['Tent',20,'2 GP','Sleeps two Small or Medium creatures.'],['Tinderbox',1,'5 SP','Bonus Action to light exposed fuel; 1 minute to light other fires.'],
  ['Torch',1,'1 CP','Burns 1 hour; bright light 20 ft. and dim light 20 ft. farther. Can deal 1 fire damage as a simple melee weapon.'],['Vial',0,'1 GP','Capacity: 4 ounces.'],['Waterskin',5,'2 SP','Capacity: 4 pints. Listed weight is full.']
];
const consumables = new Set(['Acid','Alchemist’s Fire','Antitoxin','Candle','Holy Water','Oil','Poison, Basic','Potion of Healing','Rations','Spell Scroll (Cantrip)','Spell Scroll (Level 1)','Torch']);
const gear = gearRows.map(([name,weight,cost,details])=>equipment(name,name.endsWith('Pack')?'Equipment packs':'Adventuring gear',weight,cost,details,{category:consumables.has(name)?'Consumable':'Gear'}));

const toolRows = [
  ['Alchemist’s Supplies',8,'50 GP','Intelligence','Identify a substance or start a fire (DC 15).'],["Brewer’s Supplies",9,'20 GP','Intelligence','Detect poisoned drink (DC 15); identify alcohol (DC 10).'],
  ["Calligrapher’s Supplies",5,'10 GP','Dexterity','Write forgery-resistant flourishes (DC 15).'],["Carpenter’s Tools",6,'8 GP','Strength','Seal or pry open a door or container (DC 20).'],["Cartographer’s Tools",6,'15 GP','Wisdom','Draft a map of a small area (DC 15).'],
  ["Cobbler’s Tools",5,'5 GP','Dexterity','Modify footwear for advantage on the wearer’s next Acrobatics check (DC 10).'],["Cook’s Utensils",8,'1 GP','Wisdom','Improve flavor (DC 10); detect spoiled or poisoned food (DC 15).'],
  ["Glassblower’s Tools",5,'30 GP','Intelligence','Discern a glass container’s contents in the past 24 hours (DC 15).'],["Jeweler’s Tools",2,'25 GP','Intelligence','Discern a gem’s value (DC 15).'],["Leatherworker’s Tools",5,'5 GP','Dexterity','Add a leather design (DC 10).'],
  ["Mason’s Tools",8,'10 GP','Strength','Chisel a symbol or hole in stone (DC 10).'],["Painter’s Supplies",5,'10 GP','Wisdom','Paint a recognizable image (DC 10).'],["Potter’s Tools",3,'10 GP','Intelligence','Discern a ceramic container’s contents in the past 24 hours (DC 15).'],
  ["Smith’s Tools",8,'20 GP','Strength','Pry open a door or container (DC 20).'],["Tinker’s Tools",10,'50 GP','Dexterity','Build a Tiny scrap item that lasts 1 minute (DC 20).'],["Weaver’s Tools",5,'1 GP','Dexterity','Mend clothing or sew a Tiny design (DC 10).'],["Woodcarver’s Tools",5,'1 GP','Dexterity','Carve a pattern in wood (DC 10).'],
  ['Disguise Kit',3,'25 GP','Charisma','Apply makeup (DC 10).'],['Forgery Kit',5,'15 GP','Dexterity','Mimic up to 10 words (DC 15); duplicate a wax seal (DC 20).'],['Herbalism Kit',3,'5 GP','Intelligence','Identify a plant (DC 10). Craft antitoxin, candles, healer’s kits, or healing potions.'],["Navigator’s Tools",2,'25 GP','Wisdom','Plot a course (DC 10); determine position by stars (DC 15).'],["Poisoner’s Kit",2,'50 GP','Intelligence','Detect poison on an object (DC 10).'],["Thieves’ Tools",1,'25 GP','Dexterity','Pick a lock or disarm a trap (DC 15).']
];
const tools = toolRows.map(([name,weight,cost,ability,details])=>equipment(name,'Tools',weight,cost,`${ability} checks. Utilize: ${details} Add proficiency if trained; also gain advantage if a proficient skill applies.`));
const instruments = [['Bagpipes',6,30],['Drum',3,6],['Dulcimer',10,25],['Flute',1,2],['Horn',2,3],['Lute',2,35],['Lyre',2,30],['Pan Flute',2,12],['Shawm',1,2],['Viol',1,30]].map(([name,weight,gp])=>equipment(name,'Musical instruments',weight,`${gp} GP`,'Charisma checks. Play a known tune (DC 10) or improvise a song (DC 15). Each instrument has its own proficiency.'));
const gaming = [['Dice Set','1 SP'],['Dragonchess Set','1 GP'],['Playing Card Set','5 SP'],['Three-Dragon Ante Set','1 GP']].map(([name,cost])=>equipment(name,'Gaming sets',0,cost,'Wisdom checks. Detect cheating (DC 10) or win the game (DC 20). Each set has its own proficiency.'));
const ammunition = [['Arrows',20,1,'1 GP'],['Bolts',20,1.5,'1 GP'],['Bullets, Firearm',10,2,'3 GP'],['Bullets, Sling',20,1.5,'4 CP'],['Needles',50,1,'1 GP']].map(([name,amount,weight,cost])=>equipment(name,'Ammunition',weight,cost,`${amount} pieces per bundle. Quantity counts bundles; weight and price are per bundle. Storage sold separately.`));
const focuses = [
  ['Crystal (Arcane Focus)',1,'10 GP','Sorcerer, Warlock, or Wizard spellcasting focus.'],['Orb (Arcane Focus)',3,'20 GP','Sorcerer, Warlock, or Wizard spellcasting focus.'],['Rod (Arcane Focus)',2,'10 GP','Sorcerer, Warlock, or Wizard spellcasting focus.'],['Staff (Arcane Focus)',4,'5 GP','Sorcerer, Warlock, or Wizard focus; also functions as a Quarterstaff.'],['Wand (Arcane Focus)',1,'10 GP','Sorcerer, Warlock, or Wizard spellcasting focus.'],
  ['Sprig of Mistletoe (Druidic Focus)',0,'1 GP','Druid or Ranger spellcasting focus.'],['Wooden Staff (Druidic Focus)',4,'5 GP','Druid or Ranger focus; also functions as a Quarterstaff.'],['Yew Wand (Druidic Focus)',1,'10 GP','Druid or Ranger spellcasting focus.'],
  ['Amulet (Holy Symbol)',1,'5 GP','Cleric or Paladin focus; worn or held.'],['Emblem (Holy Symbol)',0,'5 GP','Cleric or Paladin focus; worn on fabric or a Shield.'],['Reliquary (Holy Symbol)',2,'5 GP','Cleric or Paladin focus; held.']
].map(([name,weight,cost,details])=>equipment(name,'Spellcasting focuses',weight,cost,`${details} Replaces nonconsumed material components without a listed cost.`));
const tack = [['Carriage',600,'100 GP'],['Cart',200,'15 GP'],['Chariot',100,'250 GP'],['Feed (1 day)',10,'5 CP'],['Saddle, Exotic',40,'60 GP'],['Saddle, Military',30,'20 GP'],['Saddle, Riding',25,'10 GP'],['Sled',300,'20 GP'],['Wagon',400,'35 GP']].map(([name,weight,cost])=>equipment(name,'Tack & drawn vehicles',weight,cost,name==='Saddle, Military'?'Advantage on checks to remain mounted.':name==='Saddle, Exotic'?'Required for an aquatic or flying mount.':'Mount and transport equipment. Keep vehicles in a separate inventory if they are not carried.'));

const mounts = [['Camel',450,'50 GP'],['Elephant',1320,'200 GP'],['Horse, Draft',540,'50 GP'],['Horse, Riding',480,'75 GP'],['Mastiff',195,'25 GP'],['Mule',420,'8 GP'],['Pony',225,'30 GP'],['Warhorse',540,'400 GP']].map(([name,capacity,cost])=>equipment(name,'Mounts',0,cost,`Carrying capacity: ${capacity} lb. A drawn vehicle allows up to five times base carrying capacity, including vehicle weight. Mounts are not counted toward your carried weight. See the creature’s stat block for combat.`,{carried:false}));
const ships = [
  ['Airship','8 mph',10,20,1,13,300,0,'40,000 GP'],['Galley','4 mph',80,0,150,15,500,20,'30,000 GP'],['Keelboat','1 mph',1,6,0.5,15,100,10,'3,000 GP'],['Longship','3 mph',40,150,10,15,300,15,'10,000 GP'],['Rowboat','1½ mph',1,3,0,11,50,0,'50 GP'],['Sailing Ship','2 mph',20,20,100,15,300,15,'10,000 GP'],['Warship','2½ mph',60,60,200,15,500,20,'25,000 GP']
].map(([name,speed,crew,passengers,cargo,ac,hp,threshold,cost])=>equipment(name,'Ships & airships',0,cost,`Speed ${speed}; crew ${crew}; passengers ${passengers}; cargo ${cargo} tons; AC ${ac}; HP ${hp}; damage threshold ${threshold||'none'}. Vehicles are not counted toward your carried weight.${name==='Rowboat'?' A carried Rowboat weighs 100 lb.; adjust its inventory weight if you carry it.':''}`,{carried:false}));
const spellbook = equipment('Spellbook','Adventuring gear',3,'50 GP','A Wizard’s 100-page spellbook. Contains your recorded Wizard spells; record individual spells in your spellbook view.');

export const EQUIPMENT = [...WEAPONS,...ARMOR,...gear,spellbook,...tools,...instruments,...gaming,...ammunition,...focuses,...tack,...mounts,...ships];
export const EQUIPMENT_GROUPS = [...new Set(EQUIPMENT.map(item=>item.group))];
export const findEquipment = id => EQUIPMENT.find(item=>item.id===id);
export const equipmentDescription = item => `${item.details}\nCost: ${item.cost}.${item.carried===false?' Weight excluded from carried gear.':` Weight: ${item.weight} lb.${item.weight===0?' (negligible)':''}`}`;
export const equipmentFields = item => ({name:item.name,category:item.category,weight:item.weight,description:equipmentDescription(item),wiki:item.wiki});
export const itemFromEquipment = item => ({id:uid(),qty:1,equipped:false,...equipmentFields(item)});
export function attackFromWeapon(weapon,character) {
  const ability=weapon.properties.includes('Finesse')?(character.stats.dex>character.stats.str?'dex':'str'):weapon.family.endsWith('ranged')?'dex':'str';
  const modifier=mod(character.stats[ability]);
  const training=(character.weaponProficiencies||CLASS_OPTIONS.find(option=>option.name===character.class)?.weapons||'').toLowerCase();
  const restricted=training.includes('with finesse or light')?weapon.properties.includes('Finesse')||weapon.properties.includes('Light'):training.includes('with light')?weapon.properties.includes('Light'):true;
  const proficient=training.includes(weapon.name.toLowerCase())||training.includes('all weapons')||(weapon.family.startsWith('Simple')?training.includes('simple'):training.includes('martial')&&restricted);
  const heavyDisadvantage=weapon.properties.includes('Heavy')&&character.stats[weapon.family.endsWith('ranged')?'dex':'str']<13;
  const distance=weapon.properties.match(/\d+\/\d+ ft\./)?.[0],reach=weapon.properties.includes('Reach')?'10 ft.':'5 ft.';
  const range=weapon.family.endsWith('melee')?reach+(distance?`; thrown ${distance}`:''):distance||reach;
  const mastery=character.features.some(f=>/^weapon mastery\b/i.test(f.name)&&f.description.toLowerCase().includes(`${weapon.name} (${weapon.mastery})`.toLowerCase()))?weapon.mastery:'';
  return {name:weapon.name,weaponId:weapon.id,mastery,ability,bonus:0,proficient,rollMode:heavyDisadvantage?'disadvantage':'normal',damage:weapon.damage==='1'?String(Math.max(0,1+modifier)):weapon.damage+(modifier?signed(modifier):''),type:weapon.type,range,notes:weapon.details};
}

const classRows = [
  ['Artificer','Intelligence','con,int','Light and Medium; Shields','Simple weapons','Magical Tinkering, spellcasting. Supplemental class; choose the rules version used by your table.','Arcana, History, Investigation, Medicine, Nature, Perception, Sleight of Hand'],
  ['Barbarian','Strength','str,con','Light and Medium; Shields','Simple and Martial weapons','Rage, Unarmored Defense, Weapon Mastery.','Animal Handling, Athletics, Intimidation, Nature, Perception, Survival'],
  ['Bard','Charisma','dex,cha','Light','Simple weapons','Bardic Inspiration (d6), spellcasting (Charisma).','Any three skills'],
  ['Cleric','Wisdom','wis,cha','Light and Medium; Shields','Simple weapons','Spellcasting (Wisdom), Divine Order (Protector or Thaumaturge).','History, Insight, Medicine, Persuasion, Religion'],
  ['Druid','Wisdom','int,wis','Light; Shields','Simple weapons','Druidic, spellcasting (Wisdom), Primal Order (Magician or Warden).','Animal Handling, Arcana, Insight, Medicine, Nature, Perception, Religion, Survival'],
  ['Fighter','Strength or Dexterity','str,con','Light, Medium, and Heavy; Shields','Simple and Martial weapons','Fighting Style, Second Wind (1d10 + Fighter level), Weapon Mastery.','Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Persuasion, Survival'],
  ['Monk','Dexterity and Wisdom','str,dex','None','Simple weapons; Martial weapons with Light','Martial Arts (d6), Unarmored Defense.','Acrobatics, Athletics, History, Insight, Religion, Stealth'],
  ['Paladin','Strength and Charisma','wis,cha','Light, Medium, and Heavy; Shields','Simple and Martial weapons','Lay on Hands (5 × Paladin level HP), spellcasting (Charisma), Weapon Mastery.','Athletics, Insight, Intimidation, Medicine, Persuasion, Religion'],
  ['Ranger','Dexterity and Wisdom','str,dex','Light and Medium; Shields','Simple and Martial weapons','Spellcasting (Wisdom), Favored Enemy (Hunter’s Mark), Weapon Mastery.','Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival'],
  ['Rogue','Dexterity','dex,int','Light','Simple weapons; Martial weapons with Finesse or Light','Expertise, Sneak Attack (1d6), Thieves’ Cant, Weapon Mastery.','Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Persuasion, Sleight of Hand, Stealth'],
  ['Sorcerer','Charisma','con,cha','None','Simple weapons','Spellcasting (Charisma), Innate Sorcery.','Arcana, Deception, Insight, Intimidation, Persuasion, Religion'],
  ['Warlock','Charisma','wis,cha','Light','Simple weapons','Eldritch Invocations, Pact Magic (Charisma). Pact slots return after a Short or Long Rest.','Arcana, Deception, History, Intimidation, Investigation, Nature, Religion'],
  ['Wizard','Intelligence','int,wis','None','Simple weapons','Spellcasting (Intelligence), Ritual Adept, Arcane Recovery.','Arcana, History, Insight, Investigation, Medicine, Religion']
];
export const CLASS_OPTIONS = classRows.map(([name,primary,saves,armor,weapons,details,skills])=>({name,hitDie:CLASSES[name],primary,saves:saves.split(','),armor,weapons,details,skills,skillCount:name==='Rogue'?4:['Bard','Ranger'].includes(name)?3:2,wiki:wikiURL(name)}));

const species = (name,size,speed,senses,details) => ({name,size,speed,senses,details,wiki:wikiURL(name,'species')});
export const SPECIES = [
  species('Aasimar','Small or Medium',30,'Darkvision 60 ft.','Celestial Resistance (necrotic and radiant), Healing Hands, Light Bearer. Celestial Revelation at level 3. Core-book option.'),
  species('Dragonborn','Medium',30,'Darkvision 60 ft.','Choose draconic ancestry for damage resistance and Breath Weapon (Dex save, DC 8 + Con modifier + proficiency; uses = proficiency / Long Rest). Draconic Flight at level 5.'),
  species('Dwarf','Medium',30,'Darkvision 120 ft.','Dwarven Resilience: poison resistance and advantage against Poisoned. Dwarven Toughness: +1 HP per level. Stonecunning grants temporary Tremorsense.'),
  species('Elf','Medium',30,'Darkvision 60 ft.','Fey Ancestry, Keen Senses (choose Insight, Perception, or Survival), Trance. Choose Drow, High Elf, or Wood Elf lineage.'),
  species('Drow','Medium',30,'Darkvision 120 ft.','Elf traits. Drow lineage: Dancing Lights; Faerie Fire at level 3 and Darkness at level 5. Choose Intelligence, Wisdom, or Charisma for lineage spells.'),
  species('High Elf','Medium',30,'Darkvision 60 ft.','Elf traits. High Elf lineage: a changeable Wizard cantrip; Detect Magic at level 3 and Misty Step at level 5.'),
  species('Wood Elf','Medium',35,'Darkvision 60 ft.','Elf traits. Wood Elf lineage: Druidcraft; Longstrider at level 3 and Pass without Trace at level 5.'),
  species('Gnome','Small',30,'Darkvision 60 ft.','Gnomish Cunning: advantage on Intelligence, Wisdom, and Charisma saves. Choose Forest or Rock Gnome lineage.'),
  species('Forest Gnome','Small',30,'Darkvision 60 ft.','Gnomish Cunning, Minor Illusion, Speak with Animals (free uses = proficiency / Long Rest).'),
  species('Rock Gnome','Small',30,'Darkvision 60 ft.','Gnomish Cunning, Mending, Prestidigitation, and a magical Tiny clockwork device.'),
  species('Goliath','Medium',35,'','Giant Ancestry (choose Cloud, Fire, Frost, Hill, Stone, or Storm); Powerful Build. Large Form at level 5.'),
  species('Halfling','Small',30,'','Brave (advantage against Frightened), Halfling Nimbleness, Luck (reroll a 1 on a D20 Test), Naturally Stealthy.'),
  species('Human','Small or Medium',30,'','Resourceful (Heroic Inspiration after a Long Rest), Skillful (one skill), Versatile (one Origin feat).'),
  species('Orc','Medium',30,'Darkvision 120 ft.','Adrenaline Rush (Bonus Action Dash and temporary HP; uses = proficiency / Short or Long Rest), Relentless Endurance (once / Long Rest).'),
  species('Tiefling','Small or Medium',30,'Darkvision 60 ft.','Otherworldly Presence (Thaumaturgy). Choose Abyssal, Chthonic, or Infernal legacy for resistance and legacy spells.'),
  species('Abyssal Tiefling','Small or Medium',30,'Darkvision 60 ft.','Poison resistance; Poison Spray, Ray of Sickness at level 3, Hold Person at level 5; Thaumaturgy.'),
  species('Chthonic Tiefling','Small or Medium',30,'Darkvision 60 ft.','Necrotic resistance; Chill Touch, False Life at level 3, Ray of Enfeeblement at level 5; Thaumaturgy.'),
  species('Infernal Tiefling','Small or Medium',30,'Darkvision 60 ft.','Fire resistance; Fire Bolt, Hellish Rebuke at level 3, Darkness at level 5; Thaumaturgy.')
];

const backgroundRows = [
  ['Acolyte','Intelligence, Wisdom, Charisma','Magic Initiate (Cleric)','Insight, Religion','Calligrapher’s Supplies'],['Artisan','Strength, Dexterity, Intelligence','Crafter','Investigation, Persuasion','One kind of Artisan’s Tools'],['Charlatan','Dexterity, Constitution, Charisma','Skilled','Deception, Sleight of Hand','Forgery Kit'],
  ['Criminal','Dexterity, Constitution, Intelligence','Alert','Sleight of Hand, Stealth','Thieves’ Tools'],['Entertainer','Strength, Dexterity, Charisma','Musician','Acrobatics, Performance','One Musical Instrument'],['Farmer','Strength, Constitution, Wisdom','Tough','Animal Handling, Nature','Carpenter’s Tools'],
  ['Guard','Strength, Intelligence, Wisdom','Alert','Athletics, Perception','One Gaming Set'],['Guide','Dexterity, Constitution, Wisdom','Magic Initiate (Druid)','Stealth, Survival','Cartographer’s Tools'],['Hermit','Constitution, Wisdom, Charisma','Healer','Medicine, Religion','Herbalism Kit'],
  ['Merchant','Constitution, Intelligence, Charisma','Lucky','Animal Handling, Persuasion','Navigator’s Tools'],['Noble','Strength, Intelligence, Charisma','Skilled','History, Persuasion','One Gaming Set'],['Sage','Constitution, Intelligence, Wisdom','Magic Initiate (Wizard)','Arcana, History','Calligrapher’s Supplies'],
  ['Sailor','Strength, Dexterity, Wisdom','Tavern Brawler','Acrobatics, Perception','Navigator’s Tools'],['Scribe','Dexterity, Intelligence, Wisdom','Skilled','Investigation, Perception','Calligrapher’s Supplies'],['Soldier','Strength, Dexterity, Constitution','Savage Attacker','Athletics, Intimidation','One Gaming Set'],['Wayfarer','Dexterity, Wisdom, Charisma','Lucky','Insight, Stealth','Thieves’ Tools']
];
export const BACKGROUNDS = backgroundRows.map(([name,abilities,feat,skills,tool])=>({name,abilities,feat,skills,tool,details:`Increase one listed ability by 2 and another by 1, or all three by 1 (maximum 20). Choose the background’s starting equipment or 50 GP.`,wiki:wikiURL(name,'background')}));

const subclassRows = {
  Artificer:[['Alchemist','Experimental elixirs.'],['Armorer','Magical armor.'],['Artillerist','Arcane artillery.'],['Battle Smith','Steel Defender and martial magic.']],
  Barbarian:[['Path of the Berserker','Frenzy and ferocious melee attacks.'],['Path of the Wild Heart','Animal-inspired rage powers.'],['Path of the World Tree','Vitality and world-tree magic.'],['Path of the Zealot','Divine fury and resilience.']],
  Bard:[['College of Dance','Unarmored dance and inspiring movement.'],['College of Glamour','Fey charm and beguiling performances.'],['College of Lore','Bonus skills and Cutting Words.'],['College of Valor','Armor training and martial inspiration.']],
  Cleric:[['Life Domain','Stronger healing and protection.'],['Light Domain','Radiance, fire, and defensive flares.'],['Trickery Domain','Illusions, deception, and stealth.'],['War Domain','Weapons and divine battle magic.']],
  Druid:[['Circle of the Land','Land-based spells and nature’s recovery.'],['Circle of the Moon','Combat-focused Wild Shape.'],['Circle of the Sea','Ocean magic and a wrathful sea aura.'],['Circle of the Stars','Starry Form and cosmic guidance.']],
  Fighter:[['Battle Master','Superiority dice (d8 at level 3) and combat maneuvers.'],['Champion','Improved critical hits and athletic prowess.'],['Eldritch Knight','Intelligence-based Wizard spellcasting.'],['Psi Warrior','Psionic energy dice and protective strikes.']],
  Monk:[['Warrior of Mercy','Healing and harmful ki techniques.'],['Warrior of Shadow','Darkness, stealth, and shadow movement.'],['Warrior of the Elements','Elemental reach and attacks.'],['Warrior of the Open Hand','Open Hand Technique and martial control.']],
  Paladin:[['Oath of Devotion','Sacred weapons and devotion.'],['Oath of Glory','Heroic athleticism and inspiration.'],['Oath of the Ancients','Nature’s wrath and protective magic.'],['Oath of Vengeance','Pursuit and focused retribution.']],
  Ranger:[['Beast Master','Primal companion.'],['Fey Wanderer','Fey charm and psychic strikes.'],['Gloom Stalker','Ambush, darkness, and dread.'],['Hunter','Hunter’s Lore and tactical prey choices.']],
  Rogue:[['Arcane Trickster','Intelligence-based Wizard spells and Mage Hand tricks.'],['Assassin','Ambush and first-round burst damage.'],['Soulknife','Psychic blades and psionic energy.'],['Thief','Fast Hands and agile climbing.']],
  Sorcerer:[['Aberrant Sorcery','Psionic spells and telepathic speech.'],['Clockwork Sorcery','Order magic and restoring balance.'],['Draconic Sorcery','Draconic resilience and elemental affinity.'],['Wild Magic Sorcery','Wild Magic Surge and Tides of Chaos.']],
  Warlock:[['Archfey Patron','Fey magic and enhanced Misty Step.'],['Celestial Patron','Healing Light and celestial spells.'],['Fiend Patron','Dark One’s Blessing and fiery magic.'],['Great Old One Patron','Telepathy and unsettling psychic magic.']],
  Wizard:[['Abjurer','Arcane Ward and protective magic.'],['Diviner','Portent and divination magic.'],['Evoker','Destructive magic and empowered cantrips.'],['Illusionist','Improved illusions and illusory creatures.']]
};
export const SUBCLASSES = Object.entries(subclassRows).flatMap(([className,rows])=>rows.map(([name,details])=>({name,className,details,level:3,wiki:subclassURL(name,className)})));

export const ORIGIN_FEATS = [
  ['Alert','Add proficiency bonus to initiative. Can swap initiative with a willing ally after rolling.'],['Crafter','Three Artisan’s Tools proficiencies, discounts on nonmagical items, and temporary crafted gear.'],['Healer','Use a Healer’s Kit to support healing with a Hit Die; reroll 1s on qualifying healing dice.'],['Lucky','Luck points equal proficiency bonus / Long Rest. Spend for advantage on your D20 Test or disadvantage on an attack against you.'],
  ['Magic Initiate (Cleric)','Choose two Cleric cantrips and one level 1 Cleric spell. Choose Int, Wis, or Cha; one free casting / Long Rest; may also use spell slots.'],['Magic Initiate (Druid)','Choose two Druid cantrips and one level 1 Druid spell. Choose Int, Wis, or Cha; one free casting / Long Rest; may also use spell slots.'],['Magic Initiate (Wizard)','Choose two Wizard cantrips and one level 1 Wizard spell. Choose Int, Wis, or Cha; one free casting / Long Rest; may also use spell slots.'],
  ['Musician','Three instrument proficiencies; after a Short or Long Rest, grant Heroic Inspiration to allies (up to proficiency bonus).'],['Savage Attacker','Once per turn when you hit with a weapon, roll its damage dice twice and use either result.'],['Skilled','Choose three skill or tool proficiencies.'],['Tavern Brawler','d4 unarmed damage, reroll 1s on unarmed damage, improvised weapon proficiency, and a once-per-turn 5-foot push on qualifying unarmed hits.'],['Tough','Maximum HP increases by 2 per character level.']
].map(([name,details])=>({name,details,wiki:wikiURL(name,'feat')}));

export function applyStartingOptions(character) {
  const cls=CLASS_OPTIONS.find(option=>option.name===character.class);
  const ancestry=SPECIES.find(option=>option.name===character.race);
  if(cls){character.hitDie=cls.hitDie;character.saves=[...cls.saves];character.armorProficiencies=cls.armor;character.weaponProficiencies=cls.weapons;}
  if(ancestry){character.speed=ancestry.speed;character.senses=ancestry.senses;}
  character.maxHp=character.hitDie+mod(character.stats.con);character.hp=character.maxHp;
  character.ac=10+mod(character.stats.dex);
  return character;
}
