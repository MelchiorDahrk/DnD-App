import {CONDITIONS, mod, uid, validDiceFormula} from './model.js';
import {compareInitiativeIds, initiativeOrder} from './party-model.js';
import {normalizeCreatureArt, resolveCreatureArt} from './creature-icons.js';

export const ENCOUNTER_LIMIT = 30;
export const ENCOUNTER_BYTES = 600000;
export const DEFAULT_CREATURE_VISIBILITY = {visible: true, identity: true};
export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const CREATURE_CONDITIONS = [...CONDITIONS, 'Exhaustion'];
export const ACTION_GROUPS = ['Trait', 'Action', 'Bonus action', 'Reaction', 'Legendary action', 'Spell'];
export const creatureId = () => '@' + uid();
export const isCreatureId = id => typeof id === 'string' && /^@[a-z0-9-]+$/i.test(id);
export const isLiveEncounter = encounter => ['active', 'paused'].includes(encounter?.status);
export const formatCR = cr => ({0.125: '1/8', 0.25: '1/4', 0.5: '1/2'}[cr] ?? String(cr));

export function integer(value, min, max, label) {
  if (value === '' || value == null || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max)
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return Number(value);
}

function clean(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function name(value, label) {
  const result = clean(value);
  if (!result) throw new Error(`Enter a ${label}.`);
  return result;
}

function creatureAction(action) {
  const usage = action.usage;
  const recharge = usage?.recharge ? integer(usage.recharge, 2, 6, 'Recharge threshold') : 0;
  const max = recharge ? 1 : usage?.max ? integer(usage.max, 1, 99, 'Uses') : 0;
  return {
    name: name(action.name, 'creature action name'),
    group: ACTION_GROUPS.includes(action.group) ? action.group : 'Action',
    description: clean(action.description, 6000),
    attack: action.attack == null || action.attack === '' ? null : integer(action.attack, -99, 99, 'Attack bonus'),
    damage: (action.damage || []).slice(0, 12).map(part => {
      const formula = clean(part.formula, 30).replace(/[−–]/g, '-');
      if (!validDiceFormula(formula)) throw new Error('Enter a damage formula such as 2d6+3 or a fixed amount.');
      return {formula, type: clean(part.type, 60)};
    }),
    usage: max ? {max, recharge, reset: clean(usage.reset, 80)} : null
  };
}

export function creatureTemplate(draft, id) {
  const stats = draft.stats || draft;
  const scores = Object.fromEntries(ABILITY_KEYS.map(key => [key, integer(stats.scores?.[key] ?? 10, 1, 30, key.toUpperCase())]));
  const saves = Object.fromEntries(ABILITY_KEYS.map(key => [key, integer(stats.saves?.[key] ?? mod(scores[key]), -99, 99, 'Save bonus')]));
  const cr = Number(stats.cr ?? 0);
  if (![0.125, 0.25, 0.5].includes(cr)) integer(cr, 0, 30, 'Challenge Rating');
  return {
    id, name: name(draft.name, 'creature name'), source: clean(draft.source || 'Homebrew', 100),
    art: normalizeCreatureArt(draft.art),
    stats: {
      size: clean(stats.size || 'Medium', 60), type: clean(stats.type || 'Other', 80),
      alignment: clean(stats.alignment || 'Unaligned'), cr,
      ac: integer(stats.ac ?? 10, 0, 999, 'AC'), hp: integer(stats.hp ?? 1, 1, 9999, 'HP'),
      initiativeMod: integer(stats.initiativeMod ?? mod(scores.dex), -99, 99, 'Initiative modifier'),
      scores, saves, speed: clean(stats.speed, 300), skills: clean(stats.skills, 500),
      senses: clean(stats.senses, 500), languages: clean(stats.languages, 500),
      resistances: clean(stats.resistances, 500), immunities: clean(stats.immunities, 500),
      vulnerabilities: clean(stats.vulnerabilities, 500), conditionImmunities: clean(stats.conditionImmunities, 500),
      description: clean(stats.description, 4000), actions: (stats.actions || []).slice(0, 80).map(creatureAction)
    }
  };
}

export function encounterDefinition(id, title) {
  return {id, name: name(title, 'name for the encounter'), status: 'prepared', revision: 0, roster: [], run: null};
}

export function updateCreatureSetup(creature, values) {
  return {...creature,
    name: name(values.name ?? creature.name, 'creature name'),
    maxHp: integer(values.maxHp ?? creature.maxHp, 1, 9999, 'Maximum HP'),
    ac: integer(values.ac ?? creature.ac, 0, 999, 'AC'),
    initiativeMod: integer(values.initiativeMod ?? creature.initiativeMod, -99, 99, 'Initiative modifier'),
    art: normalizeCreatureArt(values.art ?? creature.art),
    notes: clean(values.notes ?? creature.notes, 4000),
    publicName: clean(values.publicName ?? creature.publicName),
    visible: values.visible ?? creature.visible,
    identity: values.identity ?? creature.identity,
    exact: values.exact ?? creature.exact
  };
}

export function addCreatures(roster, template, quantity, values = {}, ids) {
  const count = integer(quantity, 1, ENCOUNTER_LIMIT, 'Quantity');
  if (roster.length + count > ENCOUNTER_LIMIT) throw new Error(`An encounter can hold up to ${ENCOUNTER_LIMIT} creatures.`);
  ids ??= Array.from({length: count}, creatureId);
  const added = [];
  const names = new Set(roster.map(row => row.name));
  const base = clean(values.name) || template.name;
  const numbered = count > 1 || names.has(base) || [...names].some(name => name.startsWith(`${base.slice(0, 111)} #`));
  let suffix = 1;
  for (let index = 0; index < count; index++) {
    let display = base;
    if (numbered) {
      do { display = `${base.slice(0, 111)} #${suffix++}`; } while (names.has(display));
    }
    names.add(display);
    added.push(updateCreatureSetup({
      id: ids[index], templateId: template.id, templateName: template.name, source: template.source,
      name: display, stats: structuredClone(template.stats),
      maxHp: template.stats.hp, ac: template.stats.ac, initiativeMod: template.stats.initiativeMod,
      art: template.art, notes: '', publicName: '', ...DEFAULT_CREATURE_VISIBILITY, exact: false
    }, {...values, name: display}));
  }
  return [...roster, ...added];
}

export function liveCreature(prepared) {
  return {...structuredClone(prepared), hp: prepared.maxHp, tempHp: 0, conditions: [], used: {}, initiative: null, defeated: false};
}

export function changeCreature(creature, command) {
  const next = {...creature};
  switch (command.kind) {
    case 'damage': {
      const amount = integer(command.amount, 0, 9999, 'Damage');
      const absorbed = Math.min(creature.tempHp, amount);
      next.tempHp -= absorbed;
      next.hp = Math.max(0, creature.hp - amount + absorbed);
      break;
    }
    case 'heal':
      next.hp = Math.min(creature.maxHp, creature.hp + integer(command.amount, 0, 9999, 'Healing'));
      if (next.hp) next.defeated = false;
      break;
    case 'temp':
      next.tempHp = Math.max(creature.tempHp, integer(command.amount, 0, 9999, 'Temporary HP'));
      break;
    case 'defeat':
      next.defeated = true;
      next.hp = 0;
      next.tempHp = 0;
      break;
    case 'visibility':
      next.visible = command.visible;
      next.identity = command.identity ?? creature.identity;
      break;
    case 'condition': {
      if (!CREATURE_CONDITIONS.includes(command.condition)) throw new Error('Choose a condition.');
      const conditions = new Set(creature.conditions);
      if (command.enabled) conditions.add(command.condition);
      else conditions.delete(command.condition);
      next.conditions = [...conditions];
      break;
    }
    case 'resource': {
      const usage = creature.stats.actions[command.index]?.usage;
      if (!usage) throw new Error('Choose a limited-use ability.');
      const used = creature.used[command.index] || 0;
      if (command.use && used >= usage.max) throw new Error('This ability has no uses left.');
      next.used = {...creature.used, [command.index]: command.use ? used + 1 : 0};
      break;
    }
    case 'edit':
      Object.assign(next, updateCreatureSetup(creature, command.values));
      next.hp = integer(command.hp, 0, next.maxHp, 'Current HP');
      next.tempHp = integer(command.tempHp, 0, 9999, 'Temporary HP');
      next.defeated = next.hp === 0 && next.defeated;
      next.initiative = command.initiative === '' ? null : integer(command.initiative, -999, 999, 'Initiative');
      break;
    default:
      throw new Error('Unknown creature change.');
  }
  return next;
}

export function creatureHealth(row) {
  if (row.defeated || row.hp === 0) return 'Defeated';
  if (row.hp * 2 <= row.maxHp) return 'Bloodied';
  return row.hp < row.maxHp ? 'Injured' : 'Healthy';
}

export function activeCreature(row) {
  return !row.defeated && row.hp > 0;
}

export function publicCreature(row) {
  if (!row.visible) return null;
  const result = {
    id: row.id, name: row.publicName || (row.identity ? row.name : 'Unknown creature'),
    art: row.identity ? resolveCreatureArt(row) : {kind: 'generic'},
    health: creatureHealth(row), conditions: [...row.conditions]
  };
  if (row.identity) result.identity = row.templateName;
  if (row.exact) {
    result.exact = {hp: row.hp, maxHp: row.maxHp, tempHp: row.tempHp, ac: row.ac};
    if (row.identity) {
      const {size, type, alignment, cr, speed, scores, saves, skills, senses, resistances, immunities, vulnerabilities, conditionImmunities, languages} = row.stats;
      Object.assign(result.exact, {size, type, alignment, cr, speed, scores, saves, skills, senses, resistances, immunities, vulnerabilities, conditionImmunities, languages});
    }
  }
  return result;
}

export function encounterProjection(encounter) {
  const {run} = encounter;
  const creatures = run.creatures.map(publicCreature).filter(Boolean);
  const cursor = run.cursor;
  const scores = Object.fromEntries(run.creatures.filter(row => row.visible && activeCreature(row) && row.initiative != null)
    .map(row => [row.id, row.initiative]));
  // Hidden creatures only appear in the public order while taking a turn.
  if (isCreatureId(cursor?.id) && !Object.hasOwn(scores, cursor.id)) scores[cursor.id] = cursor.score;
  const ordered = initiativeOrder(Object.keys(scores).map(id => ({id})), {scores});
  return {
    id: encounter.id, runId: run.id, status: encounter.status, creatures,
    creatureTurns: ordered.map(({id}) => scores[id]), current: ordered.findIndex(({id}) => id === cursor?.id),
    started: !!cursor
  };
}

export function nextEncounterTurn(run, playerScores) {
  const scores = {...playerScores};
  for (const row of run.creatures) if (activeCreature(row) && row.initiative !== null) scores[row.id] = row.initiative;
  const ordered = initiativeOrder(Object.keys(scores).map(id => ({id})), {scores});
  if (!ordered.length) throw new Error('Enter initiative for at least one participant first.');
  const cursor = run.cursor;
  const acted = new Set(run.acted);
  const next = ordered.find(({id}) => !acted.has(id) && (!cursor || scores[id] < cursor.score ||
    (scores[id] === cursor.score && compareInitiativeIds(id, cursor.id) > 0)));
  const id = (next || ordered[0]).id;
  return {
    ...run, cursor: {id, score: scores[id]}, acted: next ? [...acted, id] : [id],
    turn: run.turn + 1, round: run.round + (next ? 0 : 1)
  };
}

export function encounterSummary(roster) {
  const counts = new Map();
  for (const row of roster) counts.set(row.stats.cr, (counts.get(row.stats.cr) || 0) + 1);
  return [...counts].sort(([a], [b]) => a - b).map(([cr, count]) => `${count} × CR ${formatCR(cr)}`).join(' · ');
}
