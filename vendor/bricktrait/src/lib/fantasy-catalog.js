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
  return memberships.get(`${part.cat}/${part.id}`) ?? (part.theme ? [part.theme] : []);
}

export function isThemedPart(part, rules = config) {
  return !Object.hasOwn(rules.exclude, part.id) && memberships.has(`${part.cat}/${part.id}`);
}

export function isCMFPart(part, rules = config) {
  return !Object.hasOwn(rules.exclude,part.id)&&Object.hasOwn(cmfs.categories[part.cat]||{},part.id);
}

export function isClassicFantasyPart(part,rules=config){
  return !Object.hasOwn(rules.exclude,part.id)&&(Object.hasOwn(rules.categories[part.cat]||{},part.id)||Object.hasOwn(rules.include[part.cat]||{},part.id));
}

/** Explicit IDs are authoritative. Names in the JSON are review notes, never rules. */
export function isFantasyPart(part, rules = config) {
  if (Object.hasOwn(rules.exclude, part.id)) return false;
  return isClassicFantasyPart(part,rules)||isCMFPart(part,rules)||isThemedPart(part,rules);
}

/** Filtering a selection must not mutate the complete rendering library. */
export function fantasyCatalog(parts, rules = config) {
  return parts.filter(part => isFantasyPart(part, rules));
}
