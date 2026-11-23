import {SRD_CREATURES} from './creature-data.js';
import {formatCR} from './encounter-model.js';

export {SRD_CREATURES};
export const CREATURE_TYPES = [...new Set(SRD_CREATURES.map(entry => entry.stats.type))].sort();
export const CHALLENGE_RATINGS = [...new Set(SRD_CREATURES.map(entry => entry.stats.cr))].sort((a, b) => a - b);

export function searchCreatures(templates, {query = '', type = '', cr = ''} = {}) {
  const search = query.trim().toLowerCase();
  return [...templates, ...SRD_CREATURES].filter(entry =>
    (!search || entry.name.toLowerCase().includes(search)) &&
    (!type || entry.stats.type.toLowerCase() === type.toLowerCase()) &&
    (cr === '' || formatCR(entry.stats.cr) === String(cr))
  ).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
