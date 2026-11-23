const local = ['bear-head', 'daemon-skull', 'goblin-head', 'minotaur'];
const shared = ['acid-blob', 'angel-wings', 'brain-tentacle', 'dragon-head', 'evil-tree', 'fire-silhouette',
  'ghost', 'hanging-spider', 'horse-head', 'robot-golem', 'skeleton-inside', 'wolf-head', 'beast-eye', 'duality-mask'];
export const CREATURE_ICONS = Object.fromEntries([
  ...local.map(key => [key, `./assets/creatures/${key}.svg`]),
  ...shared.map(key => [key, `./assets/spell-icons/${key}.svg`])
]);
export const GENERIC_CREATURE = './assets/creatures/silhouette.svg';

// Add future local LEGO renders here by stable template ID. Existing encounters
// resolve these references at display time without changing their stat blocks.
export const LEGO_CREATURE_ART = Object.freeze({});
export const CREATURE_ART_FILES = [...Object.values(CREATURE_ICONS), ...Object.values(LEGO_CREATURE_ART), GENERIC_CREATURE];
const byName = [
  [/\b(?:goblin|hobgoblin|bugbear)\b/i, 'goblin-head'],
  [/\b(?:dragon|drake|wyvern)\b/i, 'dragon-head'],
  [/\b(?:wolf|worg|werewolf)\b/i, 'wolf-head'],
  [/\b(?:bear|werebear)\b/i, 'bear-head'],
  [/\b(?:spider|ettercap|drider)\b/i, 'hanging-spider'],
  [/\b(?:ghost|specter|wraith|banshee)\b/i, 'ghost'],
  [/\b(?:skeleton|zombie)\b/i, 'skeleton-inside'],
  [/\b(?:horse|pony|unicorn|pegasus)\b/i, 'horse-head'],
  [/\bminotaur\b/i, 'minotaur']
];
const byType = {
  aberration: 'brain-tentacle', beast: 'beast-eye', celestial: 'angel-wings', construct: 'robot-golem',
  dragon: 'dragon-head', elemental: 'fire-silhouette', fey: 'duality-mask', fiend: 'daemon-skull',
  giant: 'minotaur', humanoid: 'duality-mask', monstrosity: 'beast-eye', ooze: 'acid-blob',
  plant: 'evil-tree', undead: 'skeleton-inside'
};

export function isCreatureImage(image) {
  return typeof image === 'string' && image.length <= 14000 &&
    /^data:image\/(?:webp|png|jpeg);base64,[a-z0-9+/]+={0,2}$/i.test(image);
}

export function normalizeCreatureArt(art) {
  return {
    image: isCreatureImage(art?.image) ? art.image : '',
    icon: Object.hasOwn(CREATURE_ICONS, art?.icon) ? art.icon : ''
  };
}

export function resolveCreatureArt(creature) {
  const art = normalizeCreatureArt(creature.art);
  if (art.image) return {kind: 'image', image: art.image};
  const registryId = creature.templateId || creature.id || '';
  const type = String(creature.stats?.type || '').toLowerCase().split(/[ (]/)[0];
  const icon = art.icon || byName.find(([pattern]) => pattern.test(creature.templateName || creature.name))?.[1]
    || (Object.hasOwn(byType, type) ? byType[type] : '');
  return icon ? {kind: 'icon', key: icon, registryId} : {kind: 'generic', registryId};
}

export const hasLEGOArt = art => Object.hasOwn(LEGO_CREATURE_ART, art?.registryId);

export function creatureArtPath(art) {
  if (art?.kind === 'image' && isCreatureImage(art.image)) return art.image;
  if (hasLEGOArt(art)) return LEGO_CREATURE_ART[art.registryId];
  if (art?.kind === 'icon' && Object.hasOwn(CREATURE_ICONS, art.key)) return CREATURE_ICONS[art.key];
  return GENERIC_CREATURE;
}

export async function readCreatureImage(file) {
  if (!file?.size) return '';
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type) || file.size > 8_000_000)
    throw new Error('Choose a JPG, PNG, or WebP image up to 8 MB.');
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    for (const size of [128, 96, 64]) {
      canvas.width = canvas.height = size;
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale, height = image.height * scale;
      canvas.getContext('2d').drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const result = canvas.toDataURL('image/webp', 0.75);
      if (isCreatureImage(result)) return result;
    }
    throw new Error('The portrait could not fit. Try a smaller image.');
  } finally {
    image.close();
  }
}
