// Refresh the explicit theme snapshot from the same cached sources as the packer.
// Run after build-parts.mjs; no source downloads or theme guessing run in the UI.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import rules from '../vendor/bricktrait/fantasy-catalog.json' with {type:'json'};
import {PORTRAIT_THEMES, sourcePartThemes} from './lib/portrait-themes.mjs';

const root = resolve(import.meta.dirname, '..');
const parts = JSON.parse(await readFile(resolve(root, 'vendor/bricktrait/static/ldraw/catalog.json'), 'utf8'))
  .filter(part => !['body', 'equipment'].includes(part.cat));
const byId = new Map(parts.map(part => [part.id, part]));
const sources = new Map();
for (const part of parts) {
  for (const folder of ['ldraw', 'ldraw-unofficial']) {
    try {
      sources.set(part.id, await readFile(resolve(root, '.cache', folder, 'parts', `${part.id}.dat`), 'utf8'));
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!sources.has(part.id)) throw new Error(`Missing cached LDraw source for ${part.id}; run the LDraw downloader first.`);
}

function themesOf(id, visiting = new Set()) {
  if (visiting.has(id)) return [];
  const source = sources.get(id);
  const themes = new Set(sourcePartThemes(source));
  // Shortcuts may only name their print in a child torso/head/hips file. Inherit
  // associations from selectable components, not unrelated geometry primitives.
  const next = new Set([...visiting, id]);
  for (const line of source.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] !== '1' || fields.length < 15) continue;
    const ref = fields.slice(14).join(' ').toLowerCase().replace(/\.dat$/, '');
    if (byId.has(ref)) for (const theme of themesOf(ref, next)) themes.add(theme);
  }
  return [...themes];
}

const memberships = new Map(parts.map(part => [part.id, new Set(themesOf(part.id))]));
// These shared moulds have no franchise keyword in LDraw. Keep the association
// explicit: Dastan/Tamina hair, Persian helmet and Dagger of Time; Ninjago's
// sword carriers, Caribbean pirate gear and Atlantis's shared speargun. This
// does not make every similar-looking mould eligible.
const supplements = {
  'Prince of Persia':['88283', '88284', '88286', '88288', '88288p01'],
  'Ninjago':['19141', '98132'],
  'Pirates of the Caribbean':['95348', '95221', '2562', '2530', '64644'],
  'Atlantis':['30088']
};
for (const [theme, ids] of Object.entries(supplements)) for (const id of ids) {
  if (!memberships.has(id)) throw new Error(`Reviewed theme supplement ${theme}/${id} is not in the supported LDraw catalog.`);
  memberships.get(id).add(theme);
}
// An assembly can identify a printed torso/hips more precisely than the print's
// own header (for example Bilbo's LOTR torso). Share those associations without
// spreading themes across every variant that reuses a plain head or helmet.
for (const part of parts) {
  if (!/^Torso with Arms\b|^Hips and Legs\b/.test(part.name)) continue;
  for (const line of sources.get(part.id).split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] !== '1' || fields.length < 15) continue;
    const ref = fields.slice(14).join(' ').toLowerCase().replace(/\.dat$/, '');
    const child = byId.get(ref);
    if (child?.cat !== part.cat || !/\bPattern\b/.test(child.name)) continue;
    for (const theme of memberships.get(part.id)) memberships.get(ref).add(theme);
  }
}
const themes = Object.fromEntries(PORTRAIT_THEMES.map(([name]) => [name, {}]));
for (const part of parts) {
  if (Object.hasOwn(rules.exclude, part.id)) continue;
  for (const theme of memberships.get(part.id)) (themes[theme][part.cat] ??= {})[part.id] = part.name;
}
const result = {
  _notes: [
    'Explicit selectable IDs associated with the requested themes by LDraw descriptions and !KEYWORDS, shared between printed bodies and their assembled shortcuts, plus reviewed shared-mould supplements.',
    'Only complete, texture-free parts supported by portrait slots are included. Source tags and model coverage are incomplete; this is not a complete set or minifigure inventory.',
    'Empty themes record no identified compatible parts in this source snapshot. Avatar means The Last Airbender, not the unrelated Na’vi theme.',
    'Regenerate with node scripts/update-theme-catalog.mjs after building LDraw parts. Review the diff; fantasy exclusions still take precedence.'
  ],
  themes
};
await writeFile(resolve(root, 'vendor/bricktrait/theme-catalog.json'), JSON.stringify(result, null, 2) + '\n');
for (const [name, categories] of Object.entries(themes)) {
  const count = Object.values(categories).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
  console.log(`${name}: ${count} compatible parts${count ? '' : ' identified in this snapshot'}`);
}
