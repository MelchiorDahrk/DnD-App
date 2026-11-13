// Explicit equipment names, never inventory IDs (itemFromEquipment generates those).
// Re-render after editing: npm run build:item-icons (build:portraits packs new parts).
// Every shipped item/action is mapped; custom entries use the category artwork.
export const EQUIPMENT_ICONS = {
  longsword: {part:'98370',color:71,view:{yaw:90},names:['Longsword']},
  shortsword: {part:'3847',color:71,view:{yaw:90},names:['Shortsword']},
  greatsword: {part:'59',color:71,view:{yaw:90},names:['Greatsword']},
  dagger: {part:'88288',color:71,view:{yaw:90},names:['Dagger','Daggers']},
  rapier: {part:'93550',color:71,names:['Rapier']},
  scimitar: {part:'43887',color:71,view:{yaw:90},names:['Scimitar']},
  handaxe: {part:'3835',color:71,view:{yaw:90},names:['Handaxe','Handaxes']},
  battleaxe: {part:'3848',color:71,view:{yaw:90},names:['Battleaxe','+1 Battleaxe']},
  greataxe: {part:'95052',color:71,view:{yaw:90},names:['Greataxe']},
  spear: {part:'4497',color:6,names:['Spear','Javelin','Javelins','Blood spear','Magic spear']},
  pike: {part:'90391p02',color:6,names:['Pike','Lance']},
  trident: {part:'92290',color:71,view:{yaw:90},names:['Trident']},
  shortbow: {part:'4499',color:6,view:{yaw:90},names:['Shortbow']},
  longbow: {part:'93231',color:6,view:{yaw:90},names:['Longbow']},
  crossbow: {part:'2570',color:6,view:{pitch:90},names:['Light Crossbow','Hand Crossbow','Heavy Crossbow']},
  shield: {part:'91884p02',color:6,names:['Shield']},
  staff: {part:'95049',color:6,names:['Quarterstaff','Staff','Staff (Arcane Focus)','Wooden Staff (Druidic Focus)']},
  wand: {part:'36752a',color:6,names:['Wand','Wand (Arcane Focus)','Yew Wand (Druidic Focus)']},
  club: {part:'88001',color:6,names:['Club','Greatclub']},
  hammer: {part:'75904',color:71,names:['Warhammer','Maul']},
  lighthammer: {part:'55295',color:71,names:['Light Hammer','Hammer']},
  whip: {part:'61975',color:6,names:['Whip']},
  potion: {part:'5608p02',color:47,names:['Potion of Healing','Potion of greater healing','Potion of supreme healing','Potion of flying','Potion of mind reading','Potion of storm giant strength','Potion of stone giant strength','Acid','Antitoxin','Holy Water','Alchemist’s Fire']},
  bottle: {part:'95228',color:47,names:['Bottle, Glass','Flask','Oil','Perfume','Vial','Ink']},
  book: {part:'33009-f1',color:6,view:{yaw:90},names:['Book','Spellbook']},
  torch: {part:'3959',color:6,view:{pitch:-90},names:['Torch','Torches']},
  lantern: {part:'37776',color:297,names:['Lantern, Bullseye','Lantern, Hooded','Lamp']},
  shovel: {part:'3837',color:71,names:['Shovel']},
  crowbar: {part:'92585',color:72,view:{yaw:90},names:['Crowbar']},
  rope: {part:'13783',color:19,names:['Rope','Hempen rope','String','Block and Tackle']},
  magnifier: {part:'30152ap01',color:0,names:['Magnifying Glass','Jeweler’s kit','Jeweler’s Tools']},
  lute: {part:'80503',color:6,names:['Lute','Lyre']},
  horn: {part:'71342',color:297,view:{yaw:90},names:['Horn','Signal Whistle']},
  pot: {part:'98374',color:0,names:['Pot, Iron','Potter’s Tools']},
  backpack: {part:'30158c01',color:6,names:['Backpack']},
  quiver: {part:'4498',color:6,names:['Quiver','Arrows','Arrow of slaying','Bolts','Case, Crossbow Bolt']},
  chainmail: {part:'973p41',color:71,names:['Chain mail','Chain Shirt','Ring Mail']},
  studdedarmor: {part:'973p45',color:6,names:['Studded leather armor','Padded Armor','Leather Armor','Hide Armor']},
  kit: {part:'37702c01',color:6,names:['Healer’s kit','Disguise kit','Poisoner’s kit','Climber’s Kit']},
  rations: {part:'4342',color:19,names:['Rations','Feed (1 day)']},
  tinderbox: {part:'3069b',color:6,view:{pitch:90},names:['Tinderbox']},
  waterskin: {part:'95228',color:6,names:['Waterskin']},
  scroll: {parts:[{id:'3068bp40',color:19,m:[1,0,0,0,0,-1,0,1,0]}],names:['Spell scroll of invisibility','Spell Scroll (Cantrip)','Spell Scroll (Level 1)','Case, Map or Scroll']},
  feather: {part:'87693',color:297,view:{yaw:90},names:['Quaal’s feather token','Ink Pen','Calligrapher’s Supplies','Forgery Kit']},
  emerald: {part:'30153',color:34,names:['Emerald','Crystal (Arcane Focus)']},
  oil: {part:'95228',color:46,names:['Oil of slipperiness']},
  poison: {part:'u9180',color:34,names:['Poison vial','Poison, Basic']},
  explorerspack: {part:'26073',color:6,names:['Explorer’s pack','Burglar’s Pack','Diplomat’s Pack','Dungeoneer’s Pack','Entertainer’s Pack','Priest’s Pack','Scholar’s Pack']},
  bedroll: {parts:[{id:'3062b',color:19},{id:'3062b',color:6,at:[0,-24,0]},{id:'3062b',color:19,at:[0,-48,0]}],names:['Bedroll','Blanket']},
  messkit: {parts:[{id:'6256',color:71},{id:'3899',color:71,at:[27,0,0]}],view:{pitch:90},names:['Mess kit','Cook’s Utensils']},
  thievestools: {parts:[{id:'40359a',color:297,m:[0,0,-1,0,1,0,1,0,0]},{id:'92585',color:72,at:[50,0,0],m:[0,0,-1,0,1,0,1,0,0]}],names:['Thieves’ tools']},
  grapplinghook: {part:'30192',color:71,names:['Grappling hook']},
  driftglobe: {part:'30106',color:47,names:['Driftglobe','Orb (Arcane Focus)']},
  glue: {part:'95228',color:15,names:['Sovereign glue']},
  chalk: {parts:[{id:'87994',color:15},{id:'87994',color:4,at:[8,0,0]},{id:'87994',color:2,at:[16,0,0]}],names:['Colored chalk']},
  pitons: {parts:[{id:'87994',color:71},{id:'87994',color:71,at:[8,0,0]}],names:['Pitons','Spikes, Iron']},
  blowgun: {part:'87994',color:6,names:['Blowgun']},
  needles: {parts:[{id:'87994',color:71},{id:'87994',color:71,at:[6,0,0]},{id:'87994',color:71,at:[12,0,0]}],names:['Blowgun needles','Needles']},
  // Weapons and natural attacks also serve the sheet, attack dialog and VFX.
  mace: {parts:[{id:'98578',color:71},{id:'98578',color:71,m:[1,0,0,0,-1,0,0,0,-1]},{id:'87994',color:6,at:[0,30,0]}],names:['Mace','Morningstar']},
  flail: {part:'59232',color:71,names:['Flail']},
  sickle: {part:'37341d',color:71,view:{yaw:90},names:['Sickle']},
  halberd: {part:'6123',color:71,view:{yaw:90},names:['Halberd','Glaive']},
  pickaxe: {part:'3841',color:71,view:{yaw:90},names:['War Pick','Mason’s Tools']},
  dart: {part:'87994',color:71,names:['Dart']},
  sling: {part:'20546',color:6,names:['Sling']},
  musket: {part:'2561',color:6,names:['Musket']},
  pistol: {part:'2562',color:72,view:{yaw:90},names:['Pistol']},
  // Additional recipes below cover the full equipment catalog, not just defaults.
  platearmor: {part:'2587',color:71,names:['Breastplate','Half Plate Armor','Plate Armor','Scale Mail','Splint Armor']},
  barrel: {part:'2489',color:6,view:{yaw:-25,pitch:15},names:['Barrel','Brewer’s Supplies']},
  basket: {part:'30109',color:19,view:{yaw:-25,pitch:15},names:['Basket']},
  bucket: {part:'12884c01',color:72,view:{yaw:-25,pitch:15},names:['Bucket']},
  chest: {parts:[{id:'4738b',color:6},{id:'4739b',color:6,at:[0,-24,0]}],view:{yaw:-25,pitch:15},names:['Chest','Reliquary (Holy Symbol)']},
  sack: {part:'10169',color:6,names:['Sack','Pouch','Component Pouch']},
  clothes: {part:'973',color:19,names:['Clothes, Fine','Clothes, Traveler’s','Costume','Robe']},
  tools: {part:'98368',color:6,names:['Tinker’s Tools','Cobbler’s Tools','Leatherworker’s Tools']},
  saw: {part:'18826',color:71,view:{yaw:90},names:['Carpenter’s Tools','Woodcarver’s Tools']},
  smith: {parts:[{id:'55295',color:71},{id:'4006',color:72,at:[25,0,0]}],names:['Smith’s Tools']},
  scissors: {part:'18920',color:71,names:['Weaver’s Tools']},
  paintbrush: {part:'93552p06',color:19,names:['Painter’s Supplies']},
  alchemy: {parts:[{id:'95228',color:47},{id:'u9180',color:34,at:[25,0,0]}],names:['Alchemist’s Supplies','Glassblower’s Tools']},
  compass: {part:'74948p01',color:297,view:{pitch:75},names:['Cartographer’s Tools','Map']},
  sextant: {part:'30154',color:297,names:['Navigator’s Tools']},
  telescope: {part:'64644',color:297,view:{yaw:90},names:['Spyglass']},
  manacles: {part:'61482',color:71,names:['Manacles']},
  paper: {part:'3068b',color:19,view:{pitch:75},names:['Paper','Parchment']},
  mirror: {part:'30152a',color:80,names:['Mirror']},
  jug: {part:'3899',color:6,view:{yaw:-25,pitch:15},names:['Jug']},
  rod: {part:'87994',color:6,names:['Pole','Rod (Arcane Focus)','Ram, Portable']},
  violin: {part:'69947p01',color:6,names:['Viol']},
  guitar: {part:'25975p01',color:6,names:['Dulcimer']},
  bullets: {parts:[{id:'32474',color:71},{id:'32474',color:71,at:[22,0,0]}],names:['Ball Bearings','Bullets, Firearm','Bullets, Sling']},
  caltrops: {parts:[{id:'30192',color:71},{id:'30192',color:71,at:[20,0,0]}],view:{yaw:-25,pitch:20},names:['Caltrops','Hunting Trap']},
  horse: {part:'4493c00',color:6,view:{yaw:90,pitch:10},names:['Horse, Draft','Horse, Riding','Mule','Warhorse']},
  pony: {part:'82445',color:19,view:{yaw:90,pitch:10},names:['Pony']},
  camel: {part:'88291',color:19,view:{yaw:90,pitch:10},names:['Camel']},
  saddle: {part:'4491b',color:6,view:{yaw:-25,pitch:15},names:['Saddle, Exotic','Saddle, Military','Saddle, Riding']},
  boat: {part:'92709c02',color:6,view:{yaw:35,pitch:30},names:['Galley','Keelboat','Longship','Rowboat','Sailing Ship','Warship']},
  bell: {part:'6017',color:297,view:{pitch:-15},names:['Bell']},
  candle: {parts:[{id:'3062b',color:15},{id:'37775',color:46,at:[0,-4,0]}],view:{yaw:90},names:['Candle']},
  chain: {part:'30104',color:71,view:{pitch:75},names:['Chain']},
  lock: {part:'3070bp09',color:71,view:{pitch:75},names:['Lock']},
  net: {part:'48298',color:19,view:{yaw:-25,pitch:25},names:['Net']},
  herbs: {part:'32607',color:2,names:['Herbalism Kit','Sprig of Mistletoe (Druidic Focus)']},
  flute: {part:'87994',color:19,names:['Flute','Shawm']},
  panflute: {parts:[{id:'87994',color:19},{id:'87994',color:19,at:[8,7,0]},{id:'87994',color:19,at:[16,14,0]},{id:'87994',color:19,at:[24,21,0]}],names:['Pan Flute']},
  bagpipes: {parts:[{id:'10169',color:6},{id:'87994',color:19,at:[-8,-80,0]},{id:'87994',color:19,at:[4,-87,0]},{id:'87994',color:19,at:[16,-80,0]}],names:['Bagpipes']},
  drum: {parts:[{id:'3941',color:6},{id:'14769',color:19,at:[0,-8,0]}],view:{yaw:-25,pitch:20},names:['Drum']},
  dice: {parts:[{id:'3068bp91',color:15},{id:'3068bp95',color:15,at:[45,0,0]}],view:{pitch:75},names:['Dice Set']},
  chess: {parts:[{id:'4589',color:0},{id:'4589',color:15,at:[25,0,0]},{id:'6141',color:0,at:[0,8,0]},{id:'6141',color:15,at:[25,8,0]}],view:{yaw:-25,pitch:15},names:['Dragonchess Set']},
  cards: {part:'3069bp0n',color:15,view:{pitch:75},names:['Playing Card Set','Three-Dragon Ante Set']},
  symbol: {part:'11609',color:297,view:{pitch:75},names:['Amulet (Holy Symbol)','Emblem (Holy Symbol)']},
  dog: {part:'92586',color:19,view:{yaw:90,pitch:10},names:['Mastiff']},
  elephant: {part:'6245p01',color:7,view:{yaw:90,pitch:10},names:['Elephant']},
  ladder: {part:'4175',color:6,names:['Ladder']},
  cart: {part:'3888ac01',color:6,view:{yaw:-25,pitch:20},names:['Carriage','Cart','Chariot','Wagon']},
  sled: {parts:[{id:'90509',color:6,at:[-20,0,0]},{id:'90509',color:6,at:[20,0,0]},{id:'3020',color:6,at:[0,-8,0]}],view:{yaw:-25,pitch:25},names:['Sled']},
  tent: {parts:[{id:'3039',color:19,at:[0,0,-20]},{id:'3039',color:19,at:[0,0,20],m:[-1,0,0,0,1,0,0,0,-1]}],view:{yaw:-25,pitch:15},names:['Tent']},
  airship: {parts:[{id:'98107',color:19},{id:'98107',color:19,m:[1,0,0,0,-1,0,0,0,-1]},{id:'30109',color:6,at:[0,155,0]}],view:{yaw:-25,pitch:10},names:['Airship']}
};

// Natural attacks have no equipment preset, but still need their own artwork.
export const ACTION_ICONS = {
  bite: {part:'28588',color:2,view:{yaw:90},names:['Beast: Bite','Bite']},
  claws: {part:'10187',color:71,view:{pitch:65},names:['Beast: Claws','Claws','Claw']},
  tail: {part:'24204',color:2,view:{yaw:90},names:['Beast: Tail','Tail','Beast: Tail defense']},
  unarmed: {part:'11092',color:6,view:{yaw:-25,pitch:15},names:['Unarmed Strike','Unarmed','Punch']},
  action: {part:'11609',color:297,view:{pitch:75},names:[]}
};

// Currency uses the canonical LDraw round 1 x 1 plate, with its raised stud.
// LDraw colours: Metallic Copper/Silver/Green/Gold, then Chrome Silver.
export const CURRENCY_ICONS = {
  'coin-copper': {part:'6141',color:300,view:{yaw:-25,pitch:30}},
  'coin-silver': {part:'6141',color:80,view:{yaw:-25,pitch:30}},
  'coin-electrum': {part:'6141',color:81,view:{yaw:-25,pitch:30}},
  'coin-gold': {part:'6141',color:82,view:{yaw:-25,pitch:30}},
  'coin-platinum': {part:'6141',color:383,view:{yaw:-25,pitch:30}}
};

export const LDRAW_ICONS = {...EQUIPMENT_ICONS,...ACTION_ICONS,...CURRENCY_ICONS};

// Even homebrew items and actions receive bundled artwork, with SVGs beneath
// each image in case it cannot load. Values are keys in LDRAW_ICONS.
export const ITEM_ICON_DEFAULTS = {
  Weapon:'longsword',Armor:'shield',Consumable:'potion',Treasure:'emerald',Gear:'backpack',
  sword:'longsword',bow:'shortbow',shield:'shield',heart:'potion',spark:'wand',star:'action',bag:'backpack'
};

/** Small brick assemblies share the same renderer as individual accessories. */
export const equipmentIconParts = entry => entry.parts || [{id:entry.part,color:entry.color}];

/** LDraw parts use different axes; face each item's broad side without a camera tilt. */
export const equipmentIconView = entry => ({yaw:0,pitch:0,zoom:1,...entry.view});

export const normalizeEquipmentName = name => String(name ?? '').normalize('NFKD')
  .replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

const byName = new Map(Object.entries({...EQUIPMENT_ICONS,...ACTION_ICONS}).flatMap(([key,entry]) =>
  entry.names.map(name => [normalizeEquipmentName(name),key])));

export function equipmentIconURL(item) {
  const key = byName.get(normalizeEquipmentName(item?.name));
  return key ? `./assets/equipment/${key}.webp` : null;
}
