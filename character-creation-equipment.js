import {BASIC_EQUIPMENT, WEAPONS} from './catalog.js';

export const artisanTools = BASIC_EQUIPMENT.filter(item => item.group === 'Tools').slice(0, 17);
export const instruments = BASIC_EQUIPMENT.filter(item => item.group === 'Musical instruments');
export const gamingSets = BASIC_EQUIPMENT.filter(item => item.group === 'Gaming sets');
export const holySymbols = BASIC_EQUIPMENT.filter(item => item.name.endsWith('(Holy Symbol)'));
export const simpleWeapons = WEAPONS.filter(item => item.family.startsWith('Simple'));

// Package rows use catalog IDs, optional quantities and optional display names.
// A key beginning with @ resolves to an earlier selection or package choice.
const gear = (gold, ...items) => ({gold, items: items.map(item => Array.isArray(item) ? item : [item, 1])});
const packages = (gold, ...options) => [...options, gear(gold)];
export const classEquipment = {
  Artificer: [gear(0, '@artificerArmor', '@artificerWeapon1', '@artificerWeapon2', 'light-crossbow', ['bolts', 20], 'thieves-tools', 'dungeoneers-pack')],
  Barbarian: packages(75, gear(15, 'greataxe', ['handaxe', 4], 'explorers-pack')),
  Bard: packages(90, gear(19, 'leather-armor', ['dagger', 2], '@bardInstrument', 'entertainers-pack')),
  Cleric: packages(110, gear(7, 'chain-shirt', 'shield', 'mace', '@classSymbol', 'priests-pack')),
  Druid: packages(50, gear(9, 'leather-armor', 'shield', 'sickle', 'wooden-staff-druidic-focus', 'explorers-pack', 'herbalism-kit')),
  Fighter: packages(155,
    gear(4, 'chain-mail', 'greatsword', 'flail', ['javelin', 8], 'dungeoneers-pack'),
    gear(11, 'studded-leather-armor', 'scimitar', 'shortsword', 'longbow', ['arrows', 20], 'quiver', 'dungeoneers-pack')),
  Monk: packages(50, gear(11, 'spear', ['dagger', 5], '@classTool', 'explorers-pack')),
  Paladin: packages(150, gear(9, 'chain-mail', 'shield', 'longsword', ['javelin', 6], '@classSymbol', 'priests-pack')),
  Ranger: packages(150, gear(7, 'studded-leather-armor', 'scimitar', 'shortsword', 'longbow', ['arrows', 20], 'quiver', 'sprig-of-mistletoe-druidic-focus', 'explorers-pack')),
  Rogue: packages(100, gear(8, 'leather-armor', ['dagger', 2], 'shortsword', 'shortbow', ['arrows', 20], 'quiver', 'thieves-tools', 'burglars-pack')),
  Sorcerer: packages(50, gear(28, 'spear', ['dagger', 2], 'crystal-arcane-focus', 'dungeoneers-pack')),
  Warlock: packages(100, gear(15, 'leather-armor', 'sickle', ['dagger', 2], 'orb-arcane-focus', ['book', 1, 'Book (occult lore)'], 'scholars-pack')),
  Wizard: packages(55, gear(5, ['dagger', 2], 'staff-arcane-focus', 'robe', 'spellbook', 'scholars-pack'))
};

export const backgroundEquipment = {
  Acolyte: gear(8, 'calligraphers-supplies', ['book', 1, 'Book (prayers)'], '@backgroundSymbol', ['parchment', 10], 'robe'),
  Artisan: gear(32, '@backgroundTool', ['pouch', 2], 'clothes-travelers'),
  Charlatan: gear(15, 'forgery-kit', 'costume', 'clothes-fine'),
  Criminal: gear(16, ['dagger', 2], 'thieves-tools', 'crowbar', ['pouch', 2], 'clothes-travelers'),
  Entertainer: gear(11, '@backgroundTool', ['costume', 2], 'mirror', 'perfume', 'clothes-travelers'),
  Farmer: gear(30, 'sickle', 'carpenters-tools', 'healers-kit', 'pot-iron', 'shovel', 'clothes-travelers'),
  Guard: gear(12, 'spear', 'light-crossbow', ['bolts', 20], '@backgroundTool', 'lantern-hooded', 'manacles', 'quiver', 'clothes-travelers'),
  Guide: gear(3, 'shortbow', ['arrows', 20], 'cartographers-tools', 'bedroll', 'quiver', 'tent', 'clothes-travelers'),
  Hermit: gear(16, 'quarterstaff', 'herbalism-kit', 'bedroll', ['book', 1, 'Book (philosophy)'], 'lamp', ['oil', 3], 'clothes-travelers'),
  Merchant: gear(22, 'navigators-tools', ['pouch', 2], 'clothes-travelers'),
  Noble: gear(29, '@backgroundTool', 'clothes-fine', 'perfume'),
  Sage: gear(8, 'quarterstaff', 'calligraphers-supplies', ['book', 1, 'Book (history)'], ['parchment', 8], 'robe'),
  Sailor: gear(20, 'dagger', 'navigators-tools', 'rope', 'clothes-travelers'),
  Scribe: gear(23, 'calligraphers-supplies', 'clothes-fine', 'lamp', ['oil', 3], ['parchment', 12]),
  Soldier: gear(14, 'spear', 'shortbow', ['arrows', 20], '@backgroundTool', 'healers-kit', 'quiver', 'clothes-travelers'),
  Wayfarer: gear(16, ['dagger', 2], 'thieves-tools', '@wayfarerGame', 'bedroll', ['pouch', 2], 'clothes-travelers')
};
