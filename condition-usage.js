import {CONDITIONS} from './model.js';

export const CONDITION_USAGE_KEY = 'questlog.condition-usage.v1';
export const QUICK_CONDITION_LIMIT = 6;
const defaults = ['Prone','Poisoned','Grappled','Frightened','Restrained','Stunned'];
const names = [...new Set([...defaults,...CONDITIONS,'Exhaustion'])];

// This is a disposable browser preference, independent of character backups.
export function createConditionUsage(getStorage = () => globalThis.localStorage) {
  let usage = {};
  try {
    const saved = JSON.parse(getStorage()?.getItem(CONDITION_USAGE_KEY) || '{}');
    for (const name of names) {
      const entry = saved?.[name];
      if (Number.isSafeInteger(entry?.count) && entry.count > 0 && Number.isSafeInteger(entry?.lastUsed) && entry.lastUsed >= 0) {
        usage[name] = {count:Math.min(entry.count,1000000),lastUsed:entry.lastUsed};
      }
    }
  } catch { /* Unavailable or damaged preference storage uses the defaults. */ }
  return {
    record(name) {
      if (!names.includes(name)) return;
      usage[name] = {count:Math.min((usage[name]?.count || 0)+1,1000000),lastUsed:Date.now()};
      try { getStorage()?.setItem(CONDITION_USAGE_KEY,JSON.stringify(usage)); }
      catch { /* Keep learning for this session when storage is unavailable. */ }
    },
    shortcuts(character) {
      const active = new Set([...character.conditions,...(character.exhaustion ? ['Exhaustion'] : [])]);
      return [...names].sort((a,b) => Number(active.has(b))-Number(active.has(a))
        || (usage[b]?.count || 0)-(usage[a]?.count || 0)
        || (usage[b]?.lastUsed || 0)-(usage[a]?.lastUsed || 0)
        || names.indexOf(a)-names.indexOf(b)).slice(0,QUICK_CONDITION_LIMIT);
    }
  };
}
