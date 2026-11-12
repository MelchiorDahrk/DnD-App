import config from '../../fantasy-catalog.json' with { type: 'json' };

/** Explicit IDs are authoritative. Names in the JSON are review notes, never rules. */
export function isFantasyPart(part, rules = config) {
  if (Object.hasOwn(rules.exclude, part.id)) return false;
  return Object.hasOwn(rules.categories[part.cat] || {}, part.id) ||
    Object.hasOwn(rules.include[part.cat] || {}, part.id);
}

/** Filtering a selection must not mutate the complete rendering library. */
export function fantasyCatalog(parts, rules = config) {
  return parts.filter(part => isFantasyPart(part, rules));
}
