// Explicit equipment names, never inventory IDs (itemFromEquipment generates those).
// Re-render after editing: npm run build:item-icons. Unlisted names keep SVG icons.
export const EQUIPMENT_ICONS = {
  longsword: {part:'98370',color:71,names:['Longsword']},
  shortsword: {part:'3847',color:71,names:['Shortsword']},
  greatsword: {part:'59',color:71,names:['Greatsword']},
  dagger: {part:'88288',color:71,names:['Dagger']},
  rapier: {part:'93550',color:71,names:['Rapier']},
  scimitar: {part:'43887',color:71,names:['Scimitar']},
  handaxe: {part:'3835',color:71,names:['Handaxe']},
  battleaxe: {part:'3848',color:71,names:['Battleaxe']},
  greataxe: {part:'95052',color:71,names:['Greataxe']},
  spear: {part:'4497',color:6,names:['Spear','Javelin']},
  pike: {part:'90391p02',color:6,names:['Pike','Lance']},
  trident: {part:'92290',color:71,names:['Trident']},
  shortbow: {part:'4499',color:6,names:['Shortbow']},
  longbow: {part:'93231',color:6,names:['Longbow']},
  crossbow: {part:'2570',color:6,names:['Light Crossbow','Hand Crossbow','Heavy Crossbow']},
  shield: {part:'91884p02',color:6,names:['Shield']},
  staff: {part:'95049',color:6,names:['Quarterstaff','Staff','Staff (Arcane Focus)','Wooden Staff (Druidic Focus)']},
  wand: {part:'36752a',color:6,names:['Wand','Wand (Arcane Focus)','Yew Wand (Druidic Focus)']},
  club: {part:'88001',color:6,names:['Greatclub']},
  hammer: {part:'75904',color:71,names:['Warhammer','Maul']},
  lighthammer: {part:'55295',color:71,names:['Light Hammer']},
  whip: {part:'61975',color:6,names:['Whip']},
  potion: {part:'5608p02',color:47,names:['Potion of Healing','Acid','Antitoxin','Holy Water','Alchemist’s Fire']},
  bottle: {part:'95228',color:47,names:['Bottle, Glass','Flask','Oil','Perfume']},
  book: {part:'33009-f1',color:6,names:['Book','Spellbook']},
  torch: {part:'3959',color:6,names:['Torch']},
  lantern: {part:'37776',color:297,names:['Lantern, Bullseye','Lantern, Hooded','Lamp']},
  shovel: {part:'3837',color:71,names:['Shovel']},
  crowbar: {part:'92585',color:72,names:['Crowbar']},
  rope: {part:'13783',color:19,names:['Rope']},
  magnifier: {part:'30152ap01',color:0,names:['Magnifying Glass']},
  lute: {part:'80503',color:6,names:['Lute']},
  horn: {part:'71342',color:297,names:['Horn']},
  pot: {part:'98374',color:0,names:['Pot, Iron']},
  backpack: {part:'30158c01',color:6,names:['Backpack']},
  quiver: {part:'4498',color:6,names:['Quiver']}
};

export const normalizeEquipmentName = name => String(name ?? '').normalize('NFKD')
  .replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

const byName = new Map(Object.entries(EQUIPMENT_ICONS).flatMap(([key,entry]) =>
  entry.names.map(name => [normalizeEquipmentName(name),key])));

export function equipmentIconURL(item) {
  const key = byName.get(normalizeEquipmentName(item?.name));
  return key ? `./assets/equipment/${key}.webp` : null;
}
