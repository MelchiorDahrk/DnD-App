import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {searchCreatures, SRD_CREATURES} from '../creature-catalog.js';
import {CREATURE_ART_FILES, creatureArtPath, GENERIC_CREATURE, resolveCreatureArt} from '../creature-icons.js';
import {
  addCreatures, changeCreature, creatureHealth, creatureTemplate, encounterDefinition, encounterProjection,
  encounterSummary, liveCreature, nextEncounterTurn, publicCreature
} from '../encounter-model.js';
import {encounterTurnView} from '../encounter-ui.js';

const goblin = SRD_CREATURES.find(row => row.id === 'srd-goblin-warrior');
const homebrew = creatureTemplate({
  name: 'Lava Sprite', stats: {hp: 13, ac: 15, type: 'Elemental', cr: 0.125, scores: {dex: 16}, actions: [
    {name: 'Ember', attack: 4, damage: [{formula: '2d4+1', type: 'Fire'}], usage: {recharge: 5}}
  ]}
}, 'custom-lava');

test('SRD 5.2.1 catalog validates, filters, and preserves distinctive stats', () => {
  assert.equal(SRD_CREATURES.length, 341);
  assert.equal(new Set(SRD_CREATURES.map(row => row.id)).size, SRD_CREATURES.length);
  for (const row of SRD_CREATURES) assert.deepEqual(creatureTemplate(row, row.id), row);
  assert.equal(goblin.stats.hp, 10);
  assert.equal(goblin.stats.type, 'fey');
  assert.equal(goblin.stats.actions.find(action => action.name === 'Scimitar').attack, 4);
  const dragon = SRD_CREATURES.find(row => row.id === 'srd-adult-red-dragon');
  assert.equal(dragon.stats.initiativeMod, 12);
  assert.equal(dragon.stats.actions.find(action => action.name === 'Fire Breath').usage.recharge, 5);
  assert.equal(dragon.stats.saves.dex, 6);
  assert.deepEqual(searchCreatures([], {query: 'gObLiN WaR', type: 'Fey', cr: '1/4'}), [goblin]);
  assert.deepEqual(searchCreatures([], {query: 'Goblin War', type: 'beast'}), []);
});

test('homebrew templates validate stats and actions and can be searched independently', () => {
  assert.deepEqual(searchCreatures([homebrew], {query: 'lava', type: 'elemental', cr: '1/8'}), [homebrew]);
  assert.equal(homebrew.stats.initiativeMod, 3);
  assert.equal(homebrew.stats.actions[0].usage.max, 1);
  assert.throws(() => creatureTemplate({name: 'Broken', hp: -1}, 'test'), /HP/);
  assert.throws(() => creatureTemplate({name: 'Broken', cr: 0.75}, 'test'), /Challenge Rating/);
  assert.throws(() => creatureTemplate({name: 'Broken', actions: [{name: 'Hit', damage: [{formula: '2 apples'}]}]}, 'test'), /damage formula/);
});

test('quantity, overrides, and duplicate names yield independent instances', () => {
  const prep = addCreatures([], goblin, 2, {name: 'Scout', maxHp: 14, ac: 13, notes: 'ambush'});
  const all = addCreatures(prep, goblin, 2, {name: 'Scout'});
  assert.deepEqual(all.map(row => row.name), ['Scout #1', 'Scout #2', 'Scout #3', 'Scout #4']);
  assert.equal(new Set(all.map(row => row.id)).size, 4);
  assert.equal(encounterSummary(all), '4 × CR 1/4');
  assert.equal(goblin.stats.hp, 10);
  assert.equal(all[0].stats.ac, 15);
  assert.equal(all[0].ac, 13);
  assert.equal(all[0].notes, 'ambush');
  assert.throws(() => addCreatures(all, goblin, 30), /up to 30/);
  const a = liveCreature(all[0]), b = liveCreature(all[1]);
  assert.equal(a.hp, 14);
  assert.notEqual(a.stats.actions, b.stats.actions);
  assert.notEqual(a.conditions, b.conditions);
  assert.notEqual(a.used, b.used);
  assert.equal(a.initiative, null);
});

test('creature HP, conditions, manual overrides, and rechargeable resources', () => {
  let [row] = addCreatures([], homebrew, 1).map(liveCreature);
  const change = (kind, fields = {}) => { row = changeCreature(row, {kind, ...fields}); };
  assert.equal(creatureHealth(row), 'Healthy');
  change('temp', {amount: 5});
  change('temp', {amount: 2});
  change('damage', {amount: 6});
  assert.deepEqual([row.hp, row.tempHp, creatureHealth(row)], [12, 0, 'Injured']);
  change('damage', {amount: 6});
  assert.equal(creatureHealth(row), 'Bloodied');
  change('condition', {condition: 'Prone', enabled: true});
  assert.deepEqual(row.conditions, ['Prone']);
  change('condition', {condition: 'Prone', enabled: false});
  assert.deepEqual(row.conditions, []);
  change('resource', {index: 0, use: true});
  assert.equal(row.used[0], 1);
  assert.throws(() => change('resource', {index: 0, use: true}), /no uses left/);
  change('resource', {index: 0, use: false});
  assert.equal(row.used[0], 0);
  change('defeat');
  assert.equal(creatureHealth(row), 'Defeated');
  change('heal', {amount: 30});
  assert.equal(creatureHealth(row), 'Healthy');
  change('edit', {values: {maxHp: 18, ac: 21}, hp: 11, tempHp: 2, initiative: 17});
  assert.deepEqual([row.maxHp, row.hp, row.tempHp, row.ac, row.initiative], [18, 11, 2, 21, 17]);
});

test('projection excludes hidden creatures, notes, and unidentified artwork and stats', () => {
  const img = 'data:image/webp;base64,YQ==';
  const [row] = addCreatures([], goblin, 1, {notes: 'Secret', art: {image: img}}).map(liveCreature);
  assert.equal(publicCreature(row), null);
  row.visible = true;
  row.conditions.push('Prone');
  assert.deepEqual(publicCreature(row), {id: row.id, name: 'Unknown creature', art: {kind: 'generic'}, initiative: null, health: 'Healthy', conditions: ['Prone']});
  row.identity = row.exact = true;
  row.publicName = 'Cloaked scout';
  const visible = publicCreature(row);
  assert.equal(visible.exact.hp, 10);
  assert.equal(visible.name, 'Cloaked scout');
  assert.equal(visible.identity, 'Goblin Warrior');
  assert.equal(visible.art.image, img);
  assert.doesNotMatch(JSON.stringify(visible), /Secret|Scimitar|srd-goblin/);
});

test('mixed turns preserve deterministic ties and cursor after removal, defeat, and reinforcements', () => {
  const creatures = addCreatures([], goblin, 2, {}, ['@a', '@b']).map(liveCreature);
  creatures[0].initiative = 14;
  creatures[1].initiative = 8;
  let run = {creatures, round: 1, turn: 0, cursor: null, acted: []};
  const players = {amy_pc: 14, bob_pc: 10, zoe_pc: 5};
  const next = () => {
    run = nextEncounterTurn(run, players);
    return run.cursor.id;
  };
  assert.equal(next(), '@a');
  const [high, low] = addCreatures([], goblin, 2, {}, ['@high', '@low']).map(liveCreature);
  high.initiative = 28; low.initiative = 9;
  run.creatures = [{...creatures[1], hp: 0}, high, low];
  assert.equal(next(), 'amy_pc');
  assert.equal(next(), 'bob_pc');
  assert.equal(next(), '@low');
  assert.equal(next(), 'zoe_pc');
  assert.equal(run.round, 1);
  assert.equal(next(), '@high');
  assert.equal(run.round, 2);
});

test('Party and Session Mode use the same mixed turn view without hidden creature IDs', () => {
  const [row] = addCreatures([], goblin, 1).map(liveCreature);
  row.initiative = 12;
  const encounter = {...encounterDefinition('raid', 'Secret title'), status: 'active', run: {
    id: 'run', creatures: [row], cursor: {id: row.id, score: 12}
  }};
  const party = {combat: {managed: true, encounterId: 'run', scores: {pc: 9}, current: ''}, characters: [{id: 'pc'}], encounter: encounterProjection(encounter)};
  assert.deepEqual(encounterTurnView(party).ordered.map(row => row.id), ['pc']);
  assert.equal(encounterTurnView(party).combat.current, '');
  assert.equal(encounterTurnView(party, encounter).combat.current, row.id);
  row.visible = true;
  party.encounter = encounterProjection(encounter);
  assert.deepEqual(encounterTurnView(party).ordered.map(row => row.id), [row.id, 'pc']);
  assert.equal(encounterTurnView(party).combat.scores[row.id], 12);
});

test('portrait resolution prioritizes a custom upload, then curated name, type and generic art', async () => {
  const image = 'data:image/png;base64,YQ==';
  assert.equal(resolveCreatureArt({...goblin, art: {image, icon: 'minotaur'}}).image, image);
  assert.equal(resolveCreatureArt({...goblin, art: {icon: 'minotaur'}}).key, 'minotaur');
  assert.equal(resolveCreatureArt(goblin).key, 'goblin-head');
  assert.equal(resolveCreatureArt(homebrew).key, 'fire-silhouette');
  assert.equal(creatureArtPath(resolveCreatureArt({name: 'Oddity'})), GENERIC_CREATURE);
  assert.equal(creatureArtPath({kind: 'image', image: 'javascript:alert(1)'}), GENERIC_CREATURE);
  await Promise.all(CREATURE_ART_FILES.map(file => access(new URL('.' + file, import.meta.url))));
});
