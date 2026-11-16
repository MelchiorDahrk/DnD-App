import config from '../../fantasy-catalog.json' with { type: 'json' };
import cmfs from '../../cmf-catalog.json' with {type:'json'};
import themeCatalog from '../../theme-catalog.json' with {type:'json'};

const memberships = new Map();
for (const [theme, categories] of Object.entries(themeCatalog.themes)) {
  for (const [cat, entries] of Object.entries(categories)) for (const id of Object.keys(entries)) {
    const key = `${cat}/${id}`;
    if (!memberships.has(key)) memberships.set(key, []);
    memberships.get(key).push(theme);
  }
}

/** Specific, possibly shared theme associations take precedence over old guesses. */
export function partThemes(part) {
  return [...new Set([...(memberships.get(`${part.cat}/${part.id}`) ?? []), ...(part.themes ?? []), ...(part.theme ? [part.theme] : [])])];
}

export function isThemedPart(part, rules = config) {
  return PORTRAIT_CATEGORIES.has(part.cat) && partThemes(part).length > 0;
}

export function isCMFPart(part, rules = config) {
  return Object.hasOwn(cmfs.categories[part.cat]||{},part.id) || partThemes(part).includes('Collectible Minifigures');
}

export function isClassicFantasyPart(part,rules=config){
  return Object.hasOwn(rules.categories[part.cat]||{},part.id)||Object.hasOwn(rules.include[part.cat]||{},part.id) || partThemes(part).some(theme => ['Castle','Vikings','Lord of the Rings','The Hobbit','Dungeons & Dragons'].includes(theme));
}

/** Explicit IDs are authoritative. Names in the JSON are review notes, never rules. */
export function isFantasyPart(part, rules = config) {
  return isClassicFantasyPart(part,rules)||isCMFPart(part,rules)||isThemedPart(part,rules);
}

/** Technical slot support only. Theme metadata never controls eligibility. */
export const PORTRAIT_CATEGORIES = new Set(['head','headgear','neck','back','torso','legs','hand']);
export function selectableCatalog(parts) {
  return parts.filter(part => PORTRAIT_CATEGORIES.has(part.cat) && !part.attachmentOnly);
}

/** Optional browsing filters. A search intentionally spans every theme. */
export function browseParts(parts, {theme='',collection='',query=''} = {}) {
  const all = selectableCatalog(parts);
  if (query.trim()) return all;
  return all.filter(part => (!theme || (theme === 'unclassified' ? !partThemes(part).length : partThemes(part).includes(theme))) &&
    (!collection || (collection === 'fantasy' ? isClassicFantasyPart(part) : collection === 'cmf' ? isCMFPart(part) : isThemedPart(part))));
}

/** Filtering a selection must not mutate the complete rendering library. */
export function fantasyCatalog(parts, rules = config) {
  return parts.filter(part => isFantasyPart(part, rules));
}
