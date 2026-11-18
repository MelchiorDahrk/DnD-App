import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {SPELL_ICON_LIBRARY} from '../spell-icon-manifest.js';
import {SPELL_ICON_ASSIGNMENTS,SCHOOL_SPELL_ICONS,EFFECT_SPELL_ICONS,UNKNOWN_SPELL_ICON} from '../spell-icon-mappings.js';
import {SPELL_CATALOG} from '../progression-data.js';
import {automaticSpellIcon,validSpellIconKey} from '../spell-icons.js';

const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'assets/spell-icons');
const expected=new Set([...SPELL_ICON_ASSIGNMENTS,...Object.values(SCHOOL_SPELL_ICONS),...Object.values(EFFECT_SPELL_ICONS),UNKNOWN_SPELL_ICON].map(entry=>entry.key));
assert.equal(new Set(SPELL_ICON_LIBRARY.map(entry=>entry.key)).size,SPELL_ICON_LIBRARY.length,'Unique stable keys');
assert.deepEqual(new Set(SPELL_ICON_LIBRARY.map(entry=>entry.key)),expected,'Import only artwork used by mappings and fallbacks');
assert.deepEqual(new Set((await readdir(dir)).filter(file=>file.endsWith('.svg'))),new Set([...expected].map(key=>`${key}.svg`)));
for(const entry of SPELL_ICON_LIBRARY){
  assert.match(entry.key,/^[a-z0-9-]+$/);assert.ok(entry.artist&&entry.source&&entry.group&&entry.tone);
  const svg=await readFile(resolve(dir,`${entry.key}.svg`),'utf8');
  assert.match(svg,/viewBox="0 0 512 512"/);assert.match(svg,/<path/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject)|\bon\w+=|(?:href|url)\s*[:=(]|M0 0h512v512H0z/i);
  assert.equal(createHash('sha256').update(svg).digest('hex'),entry.sha256,`${entry.key}: imported artwork integrity`);
}
for(const spell of SPELL_CATALOG){const selection=automaticSpellIcon(spell);assert.equal(selection.source,'exact',spell.name);assert.ok(validSpellIconKey(selection.key),spell.name);}
const credits=await readFile(resolve(dir,'CREDITS.md'),'utf8');
for(const entry of SPELL_ICON_LIBRARY){assert.ok(credits.includes(entry.source),`${entry.key}: source credit`);assert.ok(credits.includes(entry.artist));}
assert.match(credits,/creativecommons.org\/licenses\/by\/3.0/);
console.log(`Spell artwork verified: ${SPELL_ICON_LIBRARY.length} local SVGs, ${SPELL_CATALOG.length} exact catalog mappings, complete attribution.`);
