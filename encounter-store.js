import {uid} from './model.js';
import {
  addCreatures, changeCreature, creatureId, creatureTemplate, encounterDefinition, encounterProjection,
  ENCOUNTER_BYTES, ENCOUNTER_LIMIT, integer, isCreatureId, isLiveEncounter, liveCreature, nextEncounterTurn,
  updateCreatureSetup
} from './encounter-model.js';

function encode(data) {
  const payload = JSON.stringify(data);
  if (new TextEncoder().encode(payload).length > ENCOUNTER_BYTES)
    throw new Error('This encounter is too large. Remove some creatures, portrait uploads, or notes.');
  return payload;
}

function definition(snapshot) {
  if (!snapshot.exists()) return null;
  const {name, status, revision, payload} = snapshot.data();
  const {roster, run} = JSON.parse(payload);
  return {id: snapshot.id, name, status, revision, roster, run};
}

function combatReset(store, runId = '') {
  return {
    scores: {}, modifiers: {}, current: '', round: 1, active: !!runId,
    encounterId: runId, initiativeCharacter: '', updatedBy: store.uid,
    ...(runId ? {managed: true} : {})
  };
}

export class EncounterStore {
  constructor(store) {
    this.store = store;
  }

  ref(party, path) {
    return this.store.ref(`parties/${party}/${path}`);
  }

  async library(party) {
    const {s, db} = this.store;
    const collection = name => s.getDocsFromServer(s.collection(db, `parties/${party}/${name}`));
    const [encounters, templates] = await Promise.all([collection('encounters'), collection('creatureTemplates')]);
    return {
      encounters: encounters.docs.map(definition).sort((a, b) => a.name.localeCompare(b.name)),
      templates: templates.docs.map(doc => ({...JSON.parse(doc.data().payload), revision: doc.data().revision}))
    };
  }

  async read(party, id) {
    return definition(await this.store.s.getDocFromServer(this.ref(party, `encounters/${id}`)));
  }

  watchPublic(party, next, error) {
    return this.store.s.onSnapshot(this.ref(party, 'session/encounter'), {includeMetadataChanges: true}, snapshot =>
      next(snapshot.exists() ? snapshot.data() : null, snapshot.metadata.fromCache), error);
  }

  watchActive(party, id, next, error) {
    return this.store.s.onSnapshot(this.ref(party, `encounters/${id}`), {includeMetadataChanges: true}, snapshot =>
      next(definition(snapshot), snapshot.metadata.fromCache), error);
  }

  watchInbox(party, next, error) {
    const {s, db} = this.store;
    const hits = s.collection(db, `parties/${party}/encounterInbox/${this.store.uid}/hits`);
    return s.onSnapshot(s.query(hits, s.orderBy('createdAt', 'desc'), s.limit(20)), snapshot =>
      next(snapshot.docs.filter(doc => doc.data().createdAt).map(doc => ({id: doc.id, ...doc.data()}))), error);
  }

  async acknowledge(party, id) {
    const {s, db} = this.store;
    const ref = this.ref(party, `encounterInbox/${this.store.uid}/hits/${id}`);
    return s.runTransaction(db, async tx => {
      const hit = await tx.get(ref);
      if (hit.exists() && !hit.data().acknowledged) tx.update(ref, {acknowledged: true});
    });
  }

  async saveTemplate(party, draft, id = uid(), revision = 0) {
    const {s, db} = this.store;
    const template = creatureTemplate({...draft, source: 'Homebrew'}, id);
    const ref = this.ref(party, `creatureTemplates/${id}`);
    await s.runTransaction(db, async tx => {
      const before = await tx.get(ref);
      if ((before.data()?.revision || 0) !== revision) throw new Error('This template changed. Open the latest version and try again.');
      tx.set(ref, {name: template.name, payload: encode(template), revision: revision + 1});
    });
    return id;
  }

  deleteTemplate(party, id, revision) {
    const {s, db} = this.store;
    const ref = this.ref(party, `creatureTemplates/${id}`);
    return s.runTransaction(db, async tx => {
      const before = await tx.get(ref);
      if (before.data()?.revision !== revision) throw new Error('This template changed. Open the latest version and try again.');
      tx.delete(ref);
    });
  }

  async mutate(party, id, command) {
    const {s, db} = this.store;
    const encounterRef = this.ref(party, `encounters/${id}`);
    const combatRef = this.ref(party, 'session/combat');
    const publicRef = this.ref(party, 'session/encounter');
    const newId = uid();
    const quantity = command.kind === 'add' ? integer(command.quantity, 1, ENCOUNTER_LIMIT, 'Quantity') : 0;
    const ids = Array.from({length: quantity}, creatureId);
    return this.store.partyTransaction(() => s.runTransaction(db, async tx => {
      const snapshot = await tx.get(encounterRef);
      const before = definition(snapshot);
      if (command.kind === 'create') {
        if (before) return before.id;
        this.write(tx, encounterRef, encounterDefinition(id, command.name));
        return id;
      }
      if (!before) throw new Error('This encounter is no longer available.');
      if (command.revision !== undefined && command.revision !== before.revision)
        throw new Error('The encounter changed. Open the latest version and try again.');
      if (command.runId !== undefined && command.runId !== before.run?.id)
        throw new Error('This encounter is no longer running.');
      const live = isLiveEncounter(before);
      const next = structuredClone(before);
      const combat = live || command.kind === 'start' ? (await tx.get(combatRef)).data() : null;
      if (live && (!combat?.active || !combat.managed || combat.encounterId !== before.run.id))
        throw new Error('The shared turn order has changed. Reopen the encounter.');
      const roster = live ? next.run.creatures : next.roster;
      const position = roster.findIndex(row => row.id === command.creature);
      const requireCreature = () => {
        if (position < 0) throw new Error('This creature is no longer available.');
        return roster[position];
      };
      const requireLive = () => {
        if (!live) throw new Error('Start the encounter first.');
      };
      switch (command.kind) {
        case 'rename':
          next.name = encounterDefinition(id, command.name).name;
          break;
        case 'duplicate': {
          const ref = this.ref(party, `encounters/${newId}`);
          const duplicate = encounterDefinition(newId, command.name);
          duplicate.roster = next.roster.map(row => ({...row, id: creatureId()}));
          this.write(tx, ref, duplicate);
          return newId;
        }
        case 'delete':
          if (live) throw new Error('End the encounter before deleting it.');
          tx.delete(encounterRef);
          return id;
        case 'archive':
          if (next.status !== 'completed') throw new Error('Finish the encounter before archiving it.');
          next.status = 'archived';
          break;
        case 'reset':
          if (live) throw new Error('End the encounter before resetting it.');
          next.status = 'prepared';
          next.run = null;
          break;
        case 'start':
          if (combat?.active) throw new Error('End the current encounter or initiative session first.');
          if (next.status !== 'prepared') throw new Error('Reset the encounter before starting it again.');
          next.status = 'active';
          next.run = {id: newId, cursor: null, acted: [], round: 1, turn: 0, creatures: next.roster.map(liveCreature)};
          tx.set(combatRef, combatReset(this.store, newId));
          break;
        case 'pause':
        case 'resume':
          requireLive();
          next.status = command.kind === 'pause' ? 'paused' : 'active';
          break;
        case 'end':
          requireLive();
          next.status = 'completed';
          tx.set(combatRef, combatReset(this.store));
          tx.delete(publicRef);
          break;
        case 'add': {
          if (!live && next.status !== 'prepared') throw new Error('Reset this encounter to edit its roster.');
          const template = creatureTemplate(command.template, command.template.id);
          const added = addCreatures(roster, template, quantity, command.values, ids);
          if (live) next.run.creatures = [...roster, ...added.slice(roster.length).map(liveCreature)];
          else next.roster = added;
          break;
        }
        case 'remove':
          requireCreature();
          if (!live && next.status !== 'prepared') throw new Error('Reset this encounter to edit its roster.');
          roster.splice(position, 1);
          break;
        case 'setup':
          if (next.status !== 'prepared') throw new Error('Reset this encounter to edit its roster.');
          roster[position] = updateCreatureSetup(requireCreature(), command.values);
          break;
        case 'creature':
          requireLive();
          roster[position] = changeCreature(requireCreature(), command.change);
          break;
        case 'initiative':
          requireLive();
          for (const [creature, score] of Object.entries(command.scores)) {
            const row = roster.find(row => row.id === creature);
            if (row) row.initiative = integer(score, -999, 999, 'Initiative');
          }
          break;
        case 'turn': {
          if (next.status !== 'active') throw new Error('Resume this encounter to advance turns.');
          if (command.turn !== next.run.turn) throw new Error('The turn already advanced. Review the current turn.');
          // Player scores are read inside the same transaction that advances the
          // cursor. Ignore shares removed since initiative was entered.
          const known = new Set(command.characters);
          const scores = Object.fromEntries(Object.entries(combat.scores).filter(([key]) => known.has(key)));
          next.run = nextEncounterTurn(next.run, scores);
          const {id: current} = next.run.cursor;
          tx.set(combatRef, {...combat, current: isCreatureId(current) ? '' : current, round: next.run.round,
            initiativeCharacter: '', updatedBy: this.store.uid});
          break;
        }
        default:
          throw new Error('Unknown encounter change.');
      }
      this.write(tx, encounterRef, next);
      if (isLiveEncounter(next)) {
        const projected = encounterProjection(next);
        if (!live || JSON.stringify(projected) !== JSON.stringify(encounterProjection(before))) tx.set(publicRef, projected);
      }
      return id;
    }));
  }

  write(tx, ref, encounter) {
    const {name, status, revision, roster, run} = encounter;
    tx.set(ref, {name, status, revision: revision + 1, payload: encode({roster, run})});
  }

  async publishAttack(party, {id, runId, creature, target, action, attack, damage, amount, damageType, operation = uid()}) {
    const {s, db, uid: actorId} = this.store;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(operation)) throw new Error('Invalid attack ID.');
    const eventRef = this.ref(party, `activities/${operation}`);
    return s.runTransaction(db, async tx => {
      const [event, snapshot, share] = await Promise.all([
        tx.get(eventRef),
        tx.get(this.ref(party, `encounters/${id}`)),
        tx.get(this.ref(party, `characters/${target}`))
      ]);
      if (event.exists()) return operation;
      const encounter = definition(snapshot);
      if (!isLiveEncounter(encounter) || encounter.run.id !== runId) throw new Error('This encounter is no longer running.');
      const row = encounter.run.creatures.find(row => row.id === creature);
      if (!row) throw new Error('This creature is no longer available.');
      if (!share.exists()) throw new Error('Choose a character shared with the party.');
      const {ownerId, characterId, sheet} = share.data();
      const source = row.visible ? row.publicName || (row.identity ? row.name : 'Unknown creature') : 'Unknown creature';
      const label = row.visible && row.identity ? String(action).slice(0, 120) : 'Creature attack';
      const type = String(damageType || 'unspecified').trim().slice(0, 60) || 'unspecified';
      const damageAmount = integer(amount, 0, 9999, 'Damage');
      const createdAt = s.serverTimestamp();
      const loggedRolls = row.visible && row.identity ? [attack, damage].filter(Boolean) : [];
      loggedRolls.forEach((roll, index) => {
        const {expression, rolls, total, bonus, mode, natural} = roll;
        const message = {expression, rolls, total, bonus, mode, natural,
          label: `${label} · ${roll === attack ? 'to hit' : type + ' damage'}`};
        tx.set(this.ref(party, `activities/${operation}-${index}`), {
          actorId, createdAt, characterId: '', name: source, kind: 'roll', result: JSON.stringify(message)
        });
      });
      tx.set(eventRef, {actorId, createdAt, characterId: '', kind: 'encounter', name: source,
        text: `targets ${sheet.name}${attack ? ` (attack ${attack.total})` : ''} · ${damageAmount} ${type} damage`});
      if (damageAmount) tx.set(this.ref(party, `encounterInbox/${ownerId}/hits/${operation}`), {
        actorId, createdAt, characterId, source, amount: damageAmount, damageType: type, acknowledged: false
      });
      return operation;
    });
  }
}
