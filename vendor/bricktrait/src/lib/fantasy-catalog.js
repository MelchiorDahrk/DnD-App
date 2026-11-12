import config from '../../fantasy-catalog.json' with { type: 'json' };
import cmfs from '../../cmf-catalog.json' with {type:'json'};

export function isCMFPart(part) {
  return !Object.hasOwn(config.exclude,part.id)&&Object.hasOwn(cmfs.categories[part.cat]||{},part.id);
}

export function isClassicFantasyPart(part,rules=config){
  return !Object.hasOwn(rules.exclude,part.id)&&(Object.hasOwn(rules.categories[part.cat]||{},part.id)||Object.hasOwn(rules.include[part.cat]||{},part.id));
}

/** Explicit IDs are authoritative. Names in the JSON are review notes, never rules. */
export function isFantasyPart(part, rules = config) {
  if (Object.hasOwn(rules.exclude, part.id)) return false;
  return isClassicFantasyPart(part,rules)||isCMFPart(part);
}

/** Filtering a selection must not mutate the complete rendering library. */
export function fantasyCatalog(parts, rules = config) {
  return parts.filter(part => isFantasyPart(part, rules));
}
