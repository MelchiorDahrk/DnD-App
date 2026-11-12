// Explicit equipment names, never inventory IDs (itemFromEquipment generates those).
// Re-render after editing: npm run build:item-icons. Unlisted names keep SVG icons.
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
  club: {part:'88001',color:6,names:['Greatclub']},
  hammer: {part:'75904',color:71,names:['Warhammer','Maul']},
  lighthammer: {part:'55295',color:71,names:['Light Hammer','Hammer']},
  whip: {part:'61975',color:6,names:['Whip']},
  potion: {part:'5608p02',color:47,names:['Potion of Healing','Potion of greater healing','Potion of supreme healing','Potion of flying','Potion of mind reading','Potion of storm giant strength','Potion of stone giant strength','Acid','Antitoxin','Holy Water','Alchemist’s Fire']},
  bottle: {part:'95228',color:47,names:['Bottle, Glass','Flask','Oil','Perfume']},
  book: {part:'33009-f1',color:6,view:{yaw:90},names:['Book','Spellbook']},
  torch: {part:'3959',color:6,view:{pitch:-90},names:['Torch','Torches']},
  lantern: {part:'37776',color:297,names:['Lantern, Bullseye','Lantern, Hooded','Lamp']},
  shovel: {part:'3837',color:71,names:['Shovel']},
  crowbar: {part:'92585',color:72,view:{yaw:90},names:['Crowbar']},
  rope: {part:'13783',color:19,names:['Rope','Hempen rope']},
  magnifier: {part:'30152ap01',color:0,names:['Magnifying Glass','Jeweler’s kit']},
  lute: {part:'80503',color:6,names:['Lute']},
  horn: {part:'71342',color:297,view:{yaw:90},names:['Horn']},
  pot: {part:'98374',color:0,names:['Pot, Iron']},
  backpack: {part:'30158c01',color:6,names:['Backpack']},
  quiver: {part:'4498',color:6,names:['Quiver','Arrows','Arrow of slaying']},
  chainmail: {part:'973p41',color:71,names:['Chain mail']},
  studdedarmor: {part:'973p45',color:6,names:['Studded leather armor']},
  kit: {part:'37702c01',color:6,names:['Healer’s kit','Disguise kit','Poisoner’s kit']},
  rations: {part:'4342',color:19,names:['Rations']},
  tinderbox: {part:'3069b',color:6,view:{pitch:90},names:['Tinderbox']},
  waterskin: {part:'95228',color:6,names:['Waterskin']},
  scroll: {parts:[{id:'3068bp40',color:19,m:[1,0,0,0,0,-1,0,1,0]}],names:['Spell scroll of invisibility']},
  feather: {part:'87693',color:297,view:{yaw:90},names:['Quaal’s feather token']},
  emerald: {part:'30153',color:34,names:['Emerald']},
  oil: {part:'95228',color:46,names:['Oil of slipperiness']},
  poison: {part:'u9180',color:34,names:['Poison vial']},
  explorerspack: {part:'26073',color:6,names:['Explorer’s pack']},
  bedroll: {parts:[{id:'3062b',color:19},{id:'3062b',color:6,at:[0,-24,0]},{id:'3062b',color:19,at:[0,-48,0]}],names:['Bedroll']},
  messkit: {parts:[{id:'6256',color:71},{id:'3899',color:71,at:[27,0,0]}],view:{pitch:90},names:['Mess kit']},
  thievestools: {parts:[{id:'40359a',color:297,m:[0,0,-1,0,1,0,1,0,0]},{id:'92585',color:72,at:[50,0,0],m:[0,0,-1,0,1,0,1,0,0]}],names:['Thieves’ tools']},
  grapplinghook: {part:'30192',color:71,names:['Grappling hook']},
  driftglobe: {part:'30106',color:47,names:['Driftglobe']},
  glue: {part:'95228',color:15,names:['Sovereign glue']},
  chalk: {parts:[{id:'87994',color:15},{id:'87994',color:4,at:[8,0,0]},{id:'87994',color:2,at:[16,0,0]}],names:['Colored chalk']},
  pitons: {parts:[{id:'87994',color:71},{id:'87994',color:71,at:[8,0,0]}],names:['Pitons']},
  blowgun: {part:'87994',color:6,names:['Blowgun']},
  needles: {parts:[{id:'87994',color:71},{id:'87994',color:71,at:[6,0,0]},{id:'87994',color:71,at:[12,0,0]}],names:['Blowgun needles']}
};

/** Small brick assemblies share the same renderer as individual accessories. */
export const equipmentIconParts = entry => entry.parts || [{id:entry.part,color:entry.color}];

/** LDraw parts use different axes; face each item's broad side without a camera tilt. */
export const equipmentIconView = entry => ({yaw:0,pitch:0,zoom:1,...entry.view});

export const normalizeEquipmentName = name => String(name ?? '').normalize('NFKD')
  .replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

const byName = new Map(Object.entries(EQUIPMENT_ICONS).flatMap(([key,entry]) =>
  entry.names.map(name => [normalizeEquipmentName(name),key])));

export function equipmentIconURL(item) {
  const key = byName.get(normalizeEquipmentName(item?.name));
  return key ? `./assets/equipment/${key}.webp` : null;
}
