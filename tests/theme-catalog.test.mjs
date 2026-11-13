import test from 'node:test';
import assert from 'node:assert/strict';
import themes from '../vendor/bricktrait/theme-catalog.json' with {type:'json'};
import rules from '../vendor/bricktrait/fantasy-catalog.json' with {type:'json'};
import {fantasyCatalog, isFantasyPart, isThemedPart, partThemes} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
import {search} from '../vendor/bricktrait/src/lib/search.ts';
import {PORTRAIT_THEMES, sourcePartThemes} from '../scripts/lib/portrait-themes.mjs';

const themed = Object.entries(themes.themes).flatMap(([theme, categories]) =>
  Object.entries(categories).flatMap(([cat, entries]) => Object.entries(entries).map(([id, name]) => ({id, name, cat, theme}))));
const unique = [...new Map(themed.map(part => [part.id, part])).values()];

test('all 18 requested themes have explicit snapshots; every available entry is selectable and discoverable', () => {
  assert.equal(PORTRAIT_THEMES.length, 18);
  assert.deepEqual(Object.keys(themes.themes), PORTRAIT_THEMES.map(([name]) => name));
  for (const part of themed) {
    assert.ok(['head', 'headgear', 'neck', 'back', 'torso', 'legs', 'hand'].includes(part.cat), part.id);
    assert.ok(isThemedPart(part), part.id);
    assert.ok(isFantasyPart(part), part.id);
    // Exercise explicit membership even if old generated metadata has a generic label.
    const source = {...part, theme:'Unrelated old guess'};
    assert.ok(partThemes(source).includes(part.theme), `${part.id}: ${part.theme}`);
    assert.ok(search([source], part.theme).includes(source), `${part.id}: ${part.theme}`);
    assert.equal(isThemedPart({...part, cat:'body'}), false);
    assert.equal(isFantasyPart(part, {...rules, exclude:{...rules.exclude, [part.id]:'test denial'}}), false);
  }
  assert.ok(unique.length > 700, 'the snapshot covers available theme parts, including printed assemblies');
  assert.deepEqual(fantasyCatalog(unique), unique);
  assert.equal(isThemedPart({id:'future-part', cat:'hand', theme:'Castle'}), false);
});

test('theme detection separates licensed themes, shared associations, and unsupported lookalikes', () => {
  const source = (name, keywords = '') => `0 ${name}\n0 !KEYWORDS ${keywords}\n`;
  for (const [name, keywords] of [
    ['Vikings', 'Viking'], ['Indiana Jones', 'Indiana Jones'], ['Prince of Persia', 'Prince of Persia'],
    ['Pirates of the Caribbean', 'POTC'], ["Pharaoh's Quest", "Pharaoh's Quest"],
    ['The Hobbit', 'Bilbo Baggins'], ['Legends of Chima', 'Chima'], ['Dreamzzz', 'Dreamzzz'],
    ['Avatar: The Last Airbender', 'Aang, The Last Airbender'], ['One Piece', 'One Piece, Luffy']
  ]) assert.ok(sourcePartThemes(source('Minifig Head', keywords)).includes(name), name);
  assert.deepEqual(sourcePartThemes(source('Minifig Head', 'Avatar, Na’vi, Jake Sully')), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Head in One Piece', 'Namina')), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Head', 'Teenage Mutant Ninja Turtles')), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Torso', 'Foot Ninja, TMNT')), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Head', 'Jedi Knight, Star Wars')), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Torso', 'Knights of Ren, Star Wars')), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Hips', 'Han Solo, Pirate, Star Wars')), []);
  assert.deepEqual(sourcePartThemes('0 Minifig Head\n0 Author: Aang\n0 !HISTORY One Piece\n3 16 0 0 0 1 1 1 2 2 2'), []);
  assert.deepEqual(sourcePartThemes(source('Minifig Hat', 'Pirates, Pirates of the Caribbean')), ['Pirates', 'Pirates of the Caribbean']);
});

test('previously skipped accessories and newer theme prints are approved in their correct slots', () => {
  for (const [theme, cat, id] of [
    ['Prince of Persia', 'back', '88290'], ['Prince of Persia', 'headgear', '88287'],
    ["Pharaoh's Quest", 'hand', '93252'], ['Dreamzzz', 'hand', '5330p01'],
    ['Atlantis', 'hand', '87748p01'], ['Atlantis', 'hand', '30088'], ['Legends of Chima', 'head', '3626cpap'],
    ['Prince of Persia', 'hand', '88288p01'], ['Ninjago', 'back', '19141'], ['Pirates of the Caribbean', 'back', '95348'],
    ['The Hobbit', 'torso', '973pm2'], ['The Hobbit', 'torso', '76382pm2']
  ]) {
    assert.ok(themes.themes[theme][cat]?.[id], `${theme}: ${cat}/${id}`);
    assert.ok(search(fantasyCatalog(unique), id).some(part => part.id === id), id);
  }
  for (const id of Object.keys(rules.exclude)) assert.ok(!unique.some(part => part.id === id), id);
});

