import {ABILITIES, mod, rollDice, signed, uid} from './model.js';
import {icon, conditionIcon} from './icons.js';
import {turnOrder} from './party-model.js';
import {attackOutcome, rollAttackDamage} from './attack-rules.js';
import {CREATURE_ICONS, creatureArtPath, GENERIC_CREATURE, hasLEGOArt, readCreatureImage, resolveCreatureArt} from './creature-icons.js';
import {
  ABILITY_KEYS, ACTION_GROUPS, activeCreature, CREATURE_CONDITIONS, creatureHealth, encounterSummary,
  ENCOUNTER_LIMIT, formatCR, isLiveEncounter
} from './encounter-model.js';

const STAT_LABELS = {
  speed: 'Speed', skills: 'Skills', senses: 'Senses', languages: 'Languages',
  resistances: 'Resistances', immunities: 'Damage immunities', vulnerabilities: 'Vulnerabilities',
  conditionImmunities: 'Condition immunities', description: 'Description'
};
const STATUS_LABELS = {prepared: 'Prepared', active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived'};
const visibleStatus = {hidden: 'Hidden', unknown: 'Revealed without identity', named: 'Identity revealed'};
const toHit = bonus => `1d20${bonus ? signed(bonus) : ''}`;

export function encounterTurnView(party, privateEncounter) {
  const combat = party.combat;
  const projection = combat.managed && party.encounter?.runId === combat.encounterId ? party.encounter : null;
  const full = projection && privateEncounter?.run?.id === projection.runId ? privateEncounter : null;
  const creatures = full ? full.run.creatures.map(row => ({
    id: row.id, name: row.name, art: resolveCreatureArt(row), initiative: row.initiative,
    health: creatureHealth(row), conditions: row.conditions, hp: row.hp, maxHp: row.maxHp, visible: row.visible
  })) : projection?.creatures || [];
  const current = full?.run.cursor?.id || projection?.current || combat.current;
  const scores = {...combat.scores};
  for (const row of creatures) if (row.initiative != null && row.health !== 'Defeated') scores[row.id] = row.initiative;
  return {
    combat: {...combat, current, scores}, projection, full,
    started: !!(full?.run.cursor || projection?.started || combat.current),
    ordered: turnOrder([...party.characters, ...creatures.filter(row => row.health !== 'Defeated')
      .map(row => ({id: row.id, creature: row}))], {...combat, current, scores}),
    creatures
  };
}

export function createEncounterUI(ui) {
  const {esc, btn, field, actions, setModal, modal, toast, party, store, user, isDM} = ui;
  let stop = () => {}, watched = '', active, catalog, library, busy = false;
  let privateError = '', attackDraft;
  let viewedCreature = null;
  const action = (id, label, attrs = '', classes = 'btn btn-sm') => btn('encounter-' + id, label, classes, attrs);
  const dataId = id => `data-id="${esc(id)}"`;
  const selected = (a, b) => String(a) === String(b) ? ' selected' : '';
  const option = (value, label, choice) => `<option value="${esc(value)}"${selected(value, choice)}>${esc(label)}</option>`;
  const select = (label, name, options, value) => `<label class="form-field">${label}<select name="${name}">${options.map(([id, text]) => option(id, text, value)).join('')}</select></label>`;
  const area = (label, name, value, max = 4000, rows = 3) => `<label class="form-field">${label}<textarea name="${name}" rows="${rows}" maxlength="${max}">${esc(value || '')}</textarea></label>`;
  const input = (label, name, value, min, max, required = true) => field(label, name, value ?? '', 'number', `step="1" min="${min}" max="${max}"${required ? ' required' : ''}`);
  const check = (label, name, value) => `<label class="check-field"><input type="checkbox" name="${name}"${value ? ' checked' : ''}>${label}</label>`;
  const marker = (view, content, dm = true) => `<div data-encounter-dialog="${view}" ${dm ? 'data-encounter-dm' : ''}>${content}</div>`;
  const dialog = () => modal.querySelector('[data-encounter-dialog]');
  const ready = () => navigator.onLine && party()?.encounterCached === false && !party()?.errors.encounters;
  const state = () => encounterTurnView(party(), isDM() ? active : null);
  const mayManage = () => !!party()?.name && (!party().dm || (party().charactersReady && party().membersReady)) && isDM();
  const portrait = art => `<span class="party-portrait encounter-portrait"><img class="character-portrait${art?.kind === 'image' || hasLEGOArt(art) ? '' : ' encounter-icon'}" src="${esc(creatureArtPath(art))}" alt="" width="128" height="128" loading="lazy"></span>`;
  document.addEventListener('error', event => {
    const image = event.target;
    if (image.matches?.('.encounter-portrait img') && image.getAttribute('src') !== GENERIC_CREATURE) {
      image.src = GENERIC_CREATURE;
      image.classList.add('encounter-icon');
    }
  }, true);

  function reset() {
    stop();
    watched = '';
    active = null;
    privateError = '';
    library = null;
    attackDraft = null;
    viewedCreature = null;
    if (dialog()) modal.close();
  }

  function update(p) {
    if (!mayManage() && modal.open && dialog()?.hasAttribute('data-encounter-dm')) modal.close();
    if (modal.open && dialog()?.dataset.encounterDialog === 'public-creature' && viewedCreature) {
      const row = p.encounter?.creatures.find(row => row.id === viewedCreature.id);
      if (!row) modal.close();
      else if (JSON.stringify(row) !== JSON.stringify(viewedCreature)) showCreature(row);
    }
    const id = mayManage() && p.charactersReady && p.encounter?.id;
    const key = id ? `${p.id}/${id}` : '';
    if (watched === key) return;
    stop();
    watched = key;
    active = null;
    privateError = '';
    if (!key) return;
    stop = store().encounters.watchActive(p.id, id, (encounter, cached) => {
      if (watched !== key || !mayManage()) return;
      const oldRevision = active?.revision;
      active = isLiveEncounter(encounter) ? {...encounter, cached} : null;
      if (oldRevision !== active?.revision) refreshCombat();
      ui.refresh();
    }, error => {
      if (watched !== key) return;
      active = null;
      privateError = error.message;
      ui.refresh();
    });
  }

  async function run(work, dm = true) {
    if (busy) return;
    if (dm && !mayManage()) return;
    if (!ready()) {
      toast('Connect to the party before changing an encounter.', true);
      return;
    }
    busy = true;
    const form = modal.open ? dialog() : null;
    form?.setAttribute('aria-busy', 'true');
    try { await work(party().id); }
    catch (error) {
      // The shared modal may have changed while the request was in flight.
      const feedback = form?.isConnected && modal.querySelector('#form-error');
      if (feedback) {
        feedback.hidden = false;
        feedback.className = 'form-error';
        feedback.textContent = error.message;
      } else toast(error.message, true);
    } finally {
      busy = false;
      form?.removeAttribute('aria-busy');
    }
  }

  const lookup = id => active?.id === id ? active : library?.encounters.find(row => row.id === id);
  const creds = encounter => isLiveEncounter(encounter) ? {runId: encounter.run.id} : {revision: encounter.revision};
  const change = (p, encounter, command) => store().encounters.mutate(p, encounter.id, {...creds(encounter), ...command});
  const conditions = row => (row.conditions || []).map(name => `<span class="badge party-condition">${conditionIcon(name)}${esc(name)}</span>`).join('');

  function creatureCard(row, current = false, dm = false) {
    const summary = dm ? `${row.hp}/${row.maxHp} HP · ${row.health}` : row.exact ?
      `${row.exact.hp}/${row.exact.maxHp} HP · AC ${row.exact.ac}` : row.health;
    return `<article class="encounter-card${current ? ' is-current' : ''}">${action('creature',
      portrait(row.art) + `<span><strong>${esc(row.name)}</strong><small>${esc(summary)}</small></span>`,
      dataId(row.id), 'encounter-card-button')}
      <div class="encounter-card-meta">${row.initiative != null ? `<span>Initiative ${esc(row.initiative)}</span>` : '<span>Awaiting initiative</span>'}
      ${dm && !row.visible ? '<span class="badge">Hidden</span>' : ''}${conditions(row)}</div></article>`;
  }

  function markup() {
    const p = party();
    const view = state();
    if (!view.projection && !mayManage()) return hitsMarkup();
    const full = view.full;
    const creatures = turnOrder(view.creatures, view.combat);
    const waiting = p.combat.managed && !view.projection;
    const scored = view.ordered.filter(row => Object.hasOwn(view.combat.scores, row.id));
    return `<section class="panel encounter-section" aria-label="Encounters">
      <div class="panel-heading"><h2>${icon('sword')}Encounters</h2>${mayManage() ? action('library', 'Manage encounters') : ''}</div>
      ${waiting ? '<p class="panel-body" role="status">Synchronizing the current encounter…</p>' : ''}
      ${view.projection ? `<div class="panel-body"><div class="encounter-heading">
        <div><h3>${esc(full?.name || 'Active encounter')}</h3><span class="badge">${STATUS_LABELS[view.projection.status]}</span>
        ${!ready() || full?.cached ? '<small role="status">Reconnecting · last known state</small>' : ''}</div>
        ${full ? lifecycle(full) : ''}</div>
        ${full && creatures.length ? `<p class="form-help">${creatures.length} creatures · ${esc(encounterSummary(full.run.creatures))}</p>` : ''}
        ${privateError ? '<p role="status">DM encounter details are unavailable. Retry the party connection.</p>' : ''}
        ${scored.length ? `<ol class="encounter-turns" aria-label="Encounter turn order">${scored.map(row =>
          `<li${row.id === view.combat.current ? ' aria-current="true"' : ''}>${esc(row.creature?.name || row.sheet?.name)} · ${view.combat.scores[row.id]}</li>`).join('')}</ol>` : ''}
        <div class="encounter-cards">${creatures.map(row => creatureCard(row, row.id === view.combat.current, !!full)).join('')}</div>
        ${!creatures.length ? `<p class="form-help">${full ? 'Add a creature to build the encounter.' : 'Creatures appear here when your DM reveals them.'}</p>` : ''}
      </div>` : ''}
      ${hitsMarkup()}
    </section>`;
  }

  function hitsMarkup() {
    const p = party();
    const hits = (p.encounterHits || []).filter(hit => !hit.acknowledged);
    if (!hits.length) return '';
    return `<section class="encounter-inbox panel-body" aria-label="Damage for your characters">${hits.map(hit => {
      const target = p.characters.find(c => c.ownerId === user()?.uid && c.characterId === hit.characterId);
      return `<article class="setting-row"><div><strong>${esc(hit.amount)} ${esc(hit.damageType)} damage</strong>
        <p>${esc(hit.source)} → ${esc(target?.sheet.name || 'Your character')}</p></div><div class="cloud-actions">
        ${target ? action('review-hit', 'Open HP controls', dataId(hit.id)) : ''}
        ${action('dismiss-hit', 'Dismiss', dataId(hit.id), 'btn btn-ghost btn-sm')}</div></article>`;
    }).join('')}</section>`;
  }

  function lifecycle(encounter) {
    const {id, status} = encounter;
    return `<div class="cloud-actions">${action('catalog', 'Add creatures', dataId(id))}
      ${action('initiative', 'Roll initiative', dataId(id))}
      ${action(status === 'paused' ? 'resume' : 'pause', status === 'paused' ? 'Resume' : 'Pause', dataId(id))}
      ${action('end', 'End encounter', dataId(id), 'btn btn-sm btn-danger')}</div>`;
  }

  function sessionMember(row, combat) {
    const current = row.id === combat.current;
    const details = [row.initiative != null ? 'Init ' + row.initiative : '', row.health, ...row.conditions].filter(Boolean).join(' · ');
    return action('creature', `${portrait(row.art)}<span class="session-member-details"><strong>${esc(row.name)}</strong><small>${esc(details)}</small></span>`,
      dataId(row.id) + (current ? ' aria-current="true"' : ''), 'session-member' + (current ? ' is-current' : ''));
  }

  function turnStatus(view) {
    if (view.projection?.status === 'paused') return 'Encounter paused';
    const current = view.ordered.find(item => item.id === view.combat.current);
    if (current) return esc(current.creature?.name || current.sheet?.name || 'Adventurer') + '’s turn';
    return view.started ? 'Turn in progress' : 'Roll initiative, then begin turns';
  }

  function next() {
    if (!active || active.status !== 'active') return;
    const encounter = active;
    const characters = party().characters.map(c => c.id);
    run(p => change(p, encounter, {kind: 'turn', turn: encounter.run.turn, characters}));
  }

  async function openLibrary(p) {
    const [entries, source] = await Promise.all([store().encounters.library(p), import('./creature-catalog.js')]);
    if (p !== party()?.id || !mayManage()) return;
    catalog = source;
    library = entries;
    const rows = entries.encounters.map(encounter => {
      const {id, name, status, roster} = encounter;
      const atts = dataId(id);
      return `<article class="encounter-list-row"><div><strong>${esc(name)}</strong><small>${STATUS_LABELS[status]} · ${roster.length} prepared</small></div>
        ${action('builder', isLiveEncounter(encounter) ? 'Open combat' : 'Open encounter', atts)}</article>`;
    }).join('');
    const templates = entries.templates.map(template => `<article class="encounter-list-row">${portrait(resolveCreatureArt(template))}
      <div><strong>${esc(template.name)}</strong><small>CR ${formatCR(template.stats.cr)} · ${esc(template.stats.type)}</small></div>
      ${action('template', 'Edit template', dataId(template.id))}</article>`).join('');
    setModal('Encounters', marker('library', `<div class="cloud-actions">
      ${action('create', 'Create encounter', '', 'btn btn-primary')}${action('template', 'Create creature template', '', 'btn')}
      </div><div class="encounter-list">${rows || '<p class="form-help">Your saved encounters will appear here.</p>'}</div>
      ${templates ? `<details><summary>Homebrew templates (${entries.templates.length})</summary><div class="encounter-list">${templates}</div></details>` : ''}`));
  }

  function builder(encounter) {
    if (isLiveEncounter(encounter)) { modal.close(); ui.navigate('party'); return; }
    const {roster, status, run, id} = encounter;
    const atts = dataId(id);
    const prepared = status === 'prepared';
    const rows = prepared ? roster : run?.creatures || roster;
    setModal(esc(encounter.name), marker('builder', `<div class="encounter-heading"><div>
      <span class="badge">${STATUS_LABELS[status]}</span> <span>${rows.length} creatures</span><small>${esc(encounterSummary(rows))}</small></div>
      <div class="cloud-actions">${action('name', 'Rename', atts)}${action('duplicate', 'Duplicate', atts)}
      ${prepared ? action('start', 'Start encounter', atts, 'btn btn-primary btn-sm') : action('reset', 'Reset for reuse', atts)}
      ${status === 'completed' ? action('archive', 'Archive', atts) : ''}
      ${action('delete', 'Delete', atts, 'btn btn-sm btn-danger')}</div></div>
      ${prepared ? action('catalog', 'Add creatures', atts, 'btn btn-primary') : ''}
      <div class="encounter-cards">${rows.map(row => `<article class="encounter-card"><div class="encounter-card-button">
        ${portrait(resolveCreatureArt(row))}<span><strong>${esc(row.name)}</strong><small>CR ${formatCR(row.stats.cr)} · AC ${row.ac} · ${prepared ? row.maxHp + ' HP' : `${row.hp}/${row.maxHp} HP`}</small></span></div>
        ${prepared ? action('setup', 'Edit creature', `${atts} data-creature="${esc(row.id)}"`) :
        action('history', 'View creature', `${atts} data-creature="${esc(row.id)}"`)}</article>`).join('')}</div>
      <div class="modal-actions">${action('library', 'Back to encounters', '', 'btn')}</div>`));
  }

  async function reloadBuilder(p, id) {
    const encounter = await store().encounters.read(p, id);
    if (party()?.id !== p || !mayManage()) return;
    if (encounter) {
      if (library) library.encounters = [...library.encounters.filter(row => row.id !== id), encounter];
      builder(encounter);
    }
  }

  function nameDialog(kind, encounter) {
    const titles = {create: 'Create encounter', name: 'Rename encounter', duplicate: 'Duplicate encounter'};
    const initial = kind === 'duplicate' ? `${encounter.name.slice(0, 112)} copy` : encounter?.name || '';
    setModal(titles[kind], marker('name', field('Encounter name', 'name', initial, 'text', 'required maxlength="120" autofocus') + actions(titles[kind])), data =>
      run(async p => {
        const id = kind === 'create'
          ? await store().encounters.mutate(p, uid(), {kind, name: data.get('name')})
          : await change(p, encounter, {kind: kind === 'name' ? 'rename' : kind, name: data.get('name')});
        await reloadBuilder(p, id);
      }));
  }

  function catalogDialog(encounter) {
    const types = [...new Set([...catalog.CREATURE_TYPES, ...library.templates.map(row => row.stats.type)])].sort((a, b) => a.localeCompare(b));
    const ratings = [...new Set([...catalog.CHALLENGE_RATINGS, ...library.templates.map(row => row.stats.cr)])].sort((a, b) => a - b);
    setModal('Creature compendium', marker('catalog', `<div class="encounter-filters">
      ${field('Search creature names', 'query', '', 'search', 'autofocus')}
      ${select('Type', 'type', [['', 'All types'], ...types.map(type => [type, type])], '')}
      ${select('Challenge Rating', 'cr', [['', 'All ratings'], ...ratings.map(cr => [formatCR(cr), 'CR ' + formatCR(cr)])], '')}
      </div><div data-encounter-results class="encounter-cards" aria-label="Creatures"></div>
      <div class="modal-actions">${action('builder', 'Back to encounter', dataId(encounter.id), 'btn')}</div>`));
    const root = dialog();
    const render = () => {
      const results = catalog.searchCreatures(library.templates, Object.fromEntries(new FormData(modal.querySelector('form'))));
      const holder = root.querySelector('[data-encounter-results]');
      holder.innerHTML = results.slice(0, 36).map(template => `<article class="encounter-card">${action('select',
        `${portrait(resolveCreatureArt(template))}<span><strong>${esc(template.name)}</strong><small>${esc(template.stats.type)} · CR ${formatCR(template.stats.cr)} · ${template.stats.hp} HP</small></span>`,
        `${dataId(encounter.id)} data-template="${esc(template.id)}"`, 'encounter-card-button')}</article>`).join('') ||
        '<p class="form-help">No creatures match the filters.</p>';
      if (results.length > 36) holder.insertAdjacentHTML('beforeend', `<p class="form-help">Showing 36 of ${results.length}. Refine the search for more specific results.</p>`);
    };
    root.addEventListener('input', render);
    render();
  }

  function artFields(art = {}) {
    const icons = Object.keys(CREATURE_ICONS).sort().map(key => [key, key.replaceAll('-', ' ')]);
    return `<div class="encounter-fields">
      ${select('Portrait icon', 'artIcon', [['', 'Automatic'], ...icons], art.icon || '')}
      <label class="form-field">Upload portrait<input name="portrait" type="file" accept="image/png,image/jpeg,image/webp"></label>
      ${art.image ? check('Remove uploaded portrait', 'removePortrait', false) : ''}</div>`;
  }

  async function artwork(data, prior = {}) {
    const image = await readCreatureImage(data.get('portrait'));
    return {icon: data.get('artIcon'), image: image || (data.has('removePortrait') ? '' : prior.image || '')};
  }

  function setupFields(row, adding = false) {
    const visibility = !row.visible ? 'hidden' : row.identity ? 'named' : 'unknown';
    return `<div class="encounter-fields">
      ${adding ? input('Quantity', 'quantity', 1, 1, ENCOUNTER_LIMIT) : ''}
      ${field(adding ? 'Custom name or group name' : 'Creature name', 'name', adding ? '' : row.name, 'text', `maxlength="120" ${adding ? '' : 'required'}`)}
      ${input('Maximum HP', 'maxHp', row.maxHp, 1, 9999)}${input('Armor Class', 'ac', row.ac, 0, 999)}
      ${input('Initiative modifier', 'initiativeMod', row.initiativeMod, -99, 99)}
      ${select('Player visibility', 'visibility', Object.entries(visibleStatus), visibility)}
      ${field('Public display name', 'publicName', row.publicName || '', 'text', 'maxlength="120"')}
      ${check('Reveal exact statistics', 'exact', row.exact)}
      </div>${artFields(row.art)}${area('Private DM notes', 'notes', row.notes)}`;
  }

  async function setupValues(data, row) {
    return {
      name: data.get('name'), maxHp: data.get('maxHp'), ac: data.get('ac'), initiativeMod: data.get('initiativeMod'),
      publicName: data.get('publicName'), visible: data.get('visibility') !== 'hidden', identity: data.get('visibility') === 'named',
      exact: data.has('exact'), notes: data.get('notes'), art: await artwork(data, row.art)
    };
  }

  function addDialog(encounter, template) {
    const row = {name: template.name, maxHp: template.stats.hp, ac: template.stats.ac, initiativeMod: template.stats.initiativeMod, art: template.art};
    setModal(esc(template.name), marker('add', `<div class="encounter-detail-title">${portrait(resolveCreatureArt(template))}
      <div><strong>${esc(template.stats.type)} · CR ${formatCR(template.stats.cr)}</strong><p>${esc(template.source)}</p></div></div>
      ${setupFields(row, true)}${statBlock(template.stats, false)}${actions('Add to encounter')}`), data =>
      run(async p => {
        await change(p, encounter, {kind: 'add', template, quantity: data.get('quantity'), values: await setupValues(data, row)});
        if (encounter.run && isLiveEncounter(encounter)) { modal.close(); ui.navigate('party'); }
        else await reloadBuilder(p, encounter.id);
      }));
  }

  function setupDialog(encounter, row) {
    const live = isLiveEncounter(encounter);
    const attrs = `${dataId(encounter.id)} data-creature="${esc(row.id)}"`;
    setModal('Edit ' + esc(row.name), marker('setup', setupFields(row) + (live ? `<div class="encounter-fields">
      ${input('Current HP', 'hp', row.hp, 0, 9999)}${input('Temporary HP', 'tempHp', row.tempHp, 0, 9999)}
      ${input('Initiative total', 'initiative', row.initiative, -999, 999, false)}</div>` : '') +
      actions('Save creature', action('remove', 'Remove creature', attrs, 'btn btn-danger left-action'))), data =>
      run(async p => {
        const values = await setupValues(data, row);
        const command = live ? {kind: 'creature', change: {kind: 'edit', values, hp: data.get('hp'),
          tempHp: data.get('tempHp'), initiative: data.get('initiative')}} : {kind: 'setup', values};
        await change(p, encounter, {...command, creature: row.id, revision: encounter.revision});
        if (live) { modal.close(); ui.refresh(); }
        else await reloadBuilder(p, encounter.id);
      }));
  }

  function statBlock(stats, rolls) {
    const abilities = stats.scores ? `<div class="encounter-abilities">${ABILITY_KEYS.map(key => `<article><strong>${key.toUpperCase()}</strong>
      <span>${stats.scores[key]} (${signed(mod(stats.scores[key]))})</span><small>Save ${signed(stats.saves[key])}</small>
      ${rolls ? `<div>${action('check', 'Check', `data-ability="${key}"`)}${action('save', 'Save', `data-ability="${key}"`)}</div>` : ''}
      </article>`).join('')}</div>` : '';
    return `<details class="encounter-detail"><summary>Statistics</summary>
      <p>${[stats.size, stats.type, stats.alignment, stats.cr !== undefined ? 'CR ' + formatCR(stats.cr) : ''].filter(Boolean).map(esc).join(' · ')}</p>
      ${abilities}<dl>${Object.entries(STAT_LABELS).filter(([field]) => stats[field]).map(([field, name]) =>
        `<dt>${esc(name)}</dt><dd>${esc(stats[field])}</dd>`).join('')}</dl></details>`;
  }

  function abilities(row, interactive) {
    return row.stats.actions.map((entry, index) => {
      const usage = entry.usage;
      const attrs = `data-index="${index}"`;
      const left = usage ? usage.max - (row.used?.[index] || 0) : 0;
      const usageText = usage ? `${left}/${usage.max} · ${usage.recharge ? 'Recharge ' + usage.recharge + '–6' : esc(usage.reset || 'Manual reset')}` : '';
      return `<article class="encounter-ability"><strong>${esc(entry.name)}</strong><small>${esc(entry.group)}${usage ? ' · ' + usageText : ''}</small>
        <p>${esc(entry.description)}</p>${interactive ? `<div class="cloud-actions">
        ${entry.attack != null || entry.damage.length ? action('attack', 'Roll / target', attrs) : ''}
        ${usage ? action('use', 'Use', attrs + (left ? '' : ' disabled')) : ''}
        ${usage && left !== usage.max ? action('reset-use', 'Reset use', attrs) : ''}
        ${usage?.recharge && !left ? action('recharge', 'Roll recharge', attrs) : ''}
        </div>` : ''}</article>`;
    }).join('');
  }

  function showCreature(row) {
    if (!row) return;
    if (active?.run?.creatures.some(candidate => candidate.id === row.id) && mayManage()) {
      setModal(esc(row.name), marker('combat', `<div class="encounter-dice"></div><div data-encounter-combat="${esc(row.id)}"></div>`));
      refreshCombat();
      return;
    }
    viewedCreature = row;
    setModal(esc(row.name), marker('public-creature', `<div class="encounter-detail-title">${portrait(row.art)}<div>
      <strong>${esc(row.health)}</strong>${row.identity && row.identity !== row.name ? `<p>${esc(row.identity)}</p>` : ''}<p>${conditions(row)}</p></div></div>${row.exact ?
        `<p>${row.exact.hp}/${row.exact.maxHp} HP · ${row.exact.tempHp} temp · AC ${row.exact.ac}</p>${row.exact.scores ? statBlock(row.exact, false) : ''}` : ''}
      <div class="modal-actions">${btn('close', 'Done', 'btn btn-primary')}</div>`, false));
  }

  function refreshCombat() {
    const body = modal.open && modal.querySelector('[data-encounter-combat]');
    if (!body) return;
    const row = active?.run?.creatures.find(candidate => candidate.id === body.dataset.encounterCombat);
    if (!row) { modal.close(); ui.refresh(); return; }
    const amount = body.querySelector('[name="amount"]')?.value || 1;
    const openDetails = [...body.querySelectorAll('details')].map(el => el.open);
    const focused = document.activeElement;
    const focusAttrs = el => [el.dataset.action, el.dataset.ability, el.dataset.index, el.dataset.condition, el.name];
    const previousFocus = body.contains(focused) && focusAttrs(focused);
    modal.querySelector('#modal-title').textContent = row.name;
    body.innerHTML = `<div class="encounter-detail-title">${portrait(resolveCreatureArt(row))}<div><strong>${row.hp}/${row.maxHp} HP</strong>
      <p>${row.tempHp} temp · AC ${row.ac} · Initiative ${row.initiative ?? '—'}</p><p>${esc(row.templateName)} · ${esc(row.source)} · ${esc(creatureHealth(row))} · ${row.visible ? 'Revealed' : 'Hidden'}</p></div></div>
      <div class="encounter-hp-controls">${input('HP adjustment', 'amount', amount, 0, 9999)}
      ${action('damage', 'Damage', '', 'btn btn-sm btn-danger')}${action('heal', 'Heal')}${action('temp', 'Temp HP')}
      ${activeCreature(row) ? action('defeat', 'Mark defeated') : ''}</div>
      <div class="cloud-actions">${action('roll-one', 'Roll initiative')}${action('setup', 'Edit / reveal creature', `${dataId(active.id)} data-creature="${esc(row.id)}"`)}
      ${action('visibility', row.visible ? 'Hide from players' : 'Reveal to players')}
      ${row.visible && !row.identity ? action('identity', 'Reveal identity') : ''}
      ${action('record', 'Record attack manually')}</div>
      <details class="encounter-detail"><summary>Conditions ${row.conditions.length ? '· ' + esc(row.conditions.join(', ')) : ''}</summary>
      <div class="condition-grid" role="group" aria-label="Creature conditions">${CREATURE_CONDITIONS.map(condition => {
        const label = esc(condition), applied = row.conditions.includes(condition);
        return action('condition', conditionIcon(condition),
          `data-condition="${label}" aria-label="${label}" aria-pressed="${applied}" title="${label}"`,
          `condition-chip${applied ? ' active' : ''}`);
      }).join('')}</div></details>
      ${statBlock(row.stats, true)}
      ${row.stats.actions.length ? `<details class="encounter-detail" open><summary>Attacks and abilities</summary>${abilities(row, true)}</details>` : ''}
      ${row.notes ? `<div class="encounter-notes"><strong>Private DM notes</strong><p>${esc(row.notes)}</p></div>` : ''}`;
    [...body.querySelectorAll('details')].forEach((el, index) => { if (openDetails[index] !== undefined) el.open = openDetails[index]; });
    if (previousFocus) [...body.querySelectorAll('button,input')].find(el =>
      focusAttrs(el).every((value, index) => value === previousFocus[index]))?.focus({preventScroll: true});
  }

  function initiativeDialog(encounter) {
    const rows = encounter.run.creatures.filter(activeCreature);
    setModal('Creature initiative', marker('initiative', `<div class="form-grid">
      ${rows.map(row => check(`${esc(row.name)} (${signed(row.initiativeMod)})`, 'creature', true).replace('name="creature"', `name="creature" value="${esc(row.id)}"`)).join('')}
      </div>${check('Identical creatures share initiative', 'group', false)}
      ${select('Roll mode', 'mode', [['normal', 'Normal'], ['advantage', 'Advantage'], ['disadvantage', 'Disadvantage']], 'normal')}
      ${actions('Roll for selected')}`), data => run(async p => {
      const form = dialog();
      const selected = new Set(data.getAll('creature'));
      const creatures = rows.filter(row => selected.has(row.id));
      if (!creatures.length) throw new Error('Select at least one creature.');
      const grouped = data.has('group'), mode = data.get('mode');
      const totals = new Map();
      const scores = {};
      for (const row of creatures) {
        const key = grouped ? `${row.templateId}:${row.initiativeMod}` : row.id;
        if (!totals.has(key)) totals.set(key, rollDice(toHit(row.initiativeMod), mode).total);
        scores[row.id] = totals.get(key);
      }
      await change(p, encounter, {kind: 'initiative', scores});
      if (!modal.open || dialog() !== form) return;
      setModal('Creature initiative results', marker('initiative-results', `
        <dl class="encounter-list encounter-initiative-results">${creatures.map(row => `
          <div class="encounter-list-row"><dt>${esc(row.name)}</dt><dd>${scores[row.id]}</dd></div>`).join('')}</dl>
        <div class="modal-actions">${btn('close', 'Done', 'btn btn-primary', 'autofocus')}</div>`));
    }));
  }

  function attackDialog(row, index) {
    const entry = row.stats.actions[index];
    const partyId = party().id;
    const draft = {id: active.id, runId: active.run.id, creature: row.id, entry, partyId, operation: uid()};
    attackDraft = draft;
    const targets = party().characters.map(c => [c.id, c.sheet.name]);
    setModal(esc(entry?.name || 'Record attack'), marker('attack', `<p>${esc(row.name)}${entry?.description ? ' · ' + esc(entry.description) : ''}</p>
      ${select('Target character', 'target', [['', 'Choose a target'], ...targets], '')}
      <div class="encounter-fields">${select('Roll mode', 'mode', [['normal', 'Normal'], ['advantage', 'Advantage'], ['disadvantage', 'Disadvantage']], 'normal')}
      ${input('Attack total (optional)', 'attackTotal', '', -999, 999, false)}
      ${entry?.damage.length ? select('Damage component', 'component', entry.damage.map((part, i) => [i, `${part.formula} ${part.type}`]), '0') : ''}
      ${field('Damage dice or fixed amount', 'formula', entry?.damage[0]?.formula || '', 'text', 'maxlength="30"')}
      ${input('Damage to report', 'amount', '', 0, 9999)}
      ${field('Damage type', 'damageType', entry?.damage[0]?.type || '', 'text', 'maxlength="60"')}
      ${check('Roll critical damage', 'critical', false)}
      </div><div class="cloud-actions">${entry?.attack != null ? action('roll-attack', 'Roll attack') : ''}${action('roll-damage', 'Roll damage')}</div>
      <p class="form-help" data-attack-outcome role="status"></p>
      <div class="encounter-dice"></div>
      <p class="form-help">Check the hit and adjust reported damage for the table. The targeted player receives a damage notice.</p>
      ${actions('Publish to party', action('creature', 'Back to creature', dataId(row.id), 'btn left-action'))}`), data => run(async p => {
      if (!data.get('target')) throw new Error('Choose a target character.');
      if (p !== draft.partyId) throw new Error('This attack belongs to another party.');
      const total = data.get('attackTotal');
      const attack = total === '' ? null : draft.attack?.total === Number(total) ? draft.attack :
        {expression: 'Manual', rolls: [], total: Number(total), bonus: 0, mode: 'normal', natural: null};
      await store().encounters.publishAttack(p, {...draft, action: entry?.name || 'Creature attack',
        target: data.get('target'), amount: data.get('amount'), damageType: data.get('damageType'), attack, damage: draft.damage});
      modal.close();
      toast('Attack recorded for the party.');
      ui.refresh();
    }));
    modal.querySelector('[name="component"]')?.addEventListener('change', event => {
      const component = entry.damage[Number(event.target.value)];
      modal.querySelector('[name="formula"]').value = component.formula;
      modal.querySelector('[name="damageType"]').value = component.type;
      draft.damage = null;
    });
    modal.querySelector('[name="target"]').addEventListener('change', () => showOutcome(draft, modal.querySelector('form')));
  }

  function showOutcome(draft, form) {
    if (!draft.attack) return;
    const ac = party().characters.find(row => row.id === form.elements.target.value)?.sheet.ac;
    const outcome = attackOutcome(draft.attack, ac);
    form.querySelector('[data-attack-outcome]').textContent = {
      critical: 'Natural 20 · critical hit',
      hit: 'Meets the target’s listed AC',
      miss: draft.attack.natural === 1 ? 'Natural 1 · miss' : 'Below the target’s listed AC'
    }[outcome] || '';
    form.elements.critical.checked = outcome === 'critical';
  }

  function templateDialog(template) {
    const stats = template?.stats || {ac: 10, hp: 1, cr: 0, size: 'Medium', alignment: 'Unaligned'};
    const actionFields = (entry = {}) => `<div class="encounter-template-action"><div class="encounter-fields">
      ${field('Action name', 'actionName', entry.name || '', 'text', 'maxlength="120"')}
      ${select('Action group', 'actionGroup', ACTION_GROUPS.map(key => [key, key]), entry.group || 'Action')}
      ${input('Attack bonus', 'attackBonus', entry.attack, -99, 99, false)}
      ${input('Limited uses', 'maxUses', entry.usage?.max, 1, 99, false)}
      ${input('Recharge on d6 (2–6)', 'recharge', entry.usage?.recharge || '', 2, 6, false)}
      ${field('Reset timing', 'resetTiming', entry.usage?.reset || '', 'text', 'maxlength="80"')}
      </div>${area('Damage components (dice, type)', 'damageLines', entry.damage?.map(part => `${part.formula}, ${part.type}`).join('\n'), 1000, 2)}
      ${area('Action rules', 'actionDescription', entry.description, 6000)}${action('remove-action', 'Remove action', '', 'btn btn-ghost btn-sm')}</div>`;
    const p = party().id;
    setModal(template ? 'Edit creature template' : 'Create homebrew creature', marker('template', `<div class="encounter-fields">
      ${field('Creature name', 'name', template?.name || '', 'text', 'required maxlength="120"')}
      ${field('Size', 'size', stats.size, 'text', 'maxlength="60"')}
      ${field('Type', 'type', stats.type || '', 'text', 'maxlength="80"')}
      ${field('Alignment', 'alignment', stats.alignment, 'text', 'maxlength="120"')}
      ${field('Challenge Rating', 'cr', formatCR(stats.cr), 'text', 'required maxlength="5"')}
      ${input('Armor Class', 'ac', stats.ac, 0, 999)}${input('Hit Points', 'hp', stats.hp, 1, 9999)}
      ${input('Initiative modifier', 'initiativeMod', stats.initiativeMod, -99, 99, false)}</div>
      ${artFields(template?.art)}
      <details class="encounter-detail"><summary>Abilities and defenses</summary>
        <div class="encounter-fields">${ABILITY_KEYS.map(key =>
          input(ABILITIES[key], key, stats.scores?.[key] || 10, 1, 30) + input(ABILITIES[key] + ' save bonus', 'save-' + key, stats.saves?.[key], -99, 99, false)).join('')}
        ${Object.entries(STAT_LABELS).filter(([key]) => key !== 'description').map(([key, label]) => field(label, key, stats[key] || '', 'text', 'maxlength="300"')).join('')}
        </div>${area('Description', 'description', stats.description)}</details>
      <details class="encounter-detail" open><summary>Traits, actions and reactions</summary>
      <div data-template-actions>${(stats.actions || []).map(actionFields).join('')}</div>${action('add-action', 'Add action')}</details>
      ${actions('Save template', template ? action('delete-template', 'Delete template', dataId(template.id), 'btn btn-danger left-action') : '')}`), data => run(async id => {
      if (id !== p) throw new Error('This template belongs to another party.');
      const fields = Object.fromEntries([...Object.keys(STAT_LABELS), 'size', 'type', 'alignment', 'ac', 'hp'].map(key => [key, data.get(key)]));
      const values = {
        ...fields, cr: ({'1/8': 0.125, '1/4': 0.25, '1/2': 0.5}[data.get('cr').trim()] ?? data.get('cr')),
        initiativeMod: data.get('initiativeMod') || undefined,
        scores: Object.fromEntries(ABILITY_KEYS.map(key => [key, data.get(key)])),
        saves: Object.fromEntries(ABILITY_KEYS.map(key => [key, data.get('save-' + key) || undefined])),
        actions: [...modal.querySelectorAll('.encounter-template-action')].map(node => {
          const value = name => node.querySelector(`[name="${name}"]`).value.trim();
          return {
            name: value('actionName'), group: value('actionGroup'), description: value('actionDescription'), attack: value('attackBonus'),
            damage: value('damageLines').split('\n').filter(Boolean).map(line => {
              const [formula, type] = line.split(',');
              return {formula, type};
            }),
            usage: {max: value('maxUses'), recharge: value('recharge'), reset: value('resetTiming')}
          };
        })
      };
      await store().encounters.saveTemplate(p, {name: data.get('name'), stats: values, art: await artwork(data, template?.art)}, template?.id, template?.revision);
      await openLibrary(p);
    }));
    modal.querySelector('[data-template-actions]').addEventListener('encounter:add-action', event =>
      event.target.insertAdjacentHTML('beforeend', actionFields()));
  }

  function confirm(encounter, kind, row) {
    const destructive = ['delete', 'remove', 'reset', 'delete-template'].includes(kind);
    const title = {
      end: 'End encounter?', delete: 'Delete encounter?', remove: 'Remove creature?',
      reset: 'Reset this encounter?', 'delete-template': 'Delete creature template?'
    }[kind];
    const message = {
      end: 'Save the final combat state and clear the shared turn order.',
      delete: 'This removes the saved encounter and its history.',
      remove: 'This removes the instance from this roster.',
      reset: 'This clears the last run and restores the prepared roster.',
      'delete-template': 'This removes the reusable template. Saved encounter instances retain their statistics.'
    }[kind];
    setModal(title, marker('confirm', `<p class="modal-intro">${message}</p>${actions(title.slice(0, -1), '', 'close')}`), () =>
      run(async p => {
        if (kind === 'delete-template') {
          await store().encounters.deleteTemplate(p, encounter.id, encounter.revision);
          await openLibrary(p);
          return;
        }
        await change(p, encounter, {kind, creature: row?.id, ...(destructive ? {revision: encounter.revision} : {})});
        if (kind === 'delete') await openLibrary(p);
        else if (isLiveEncounter(encounter)) { modal.close(); ui.refresh(); }
        else await reloadBuilder(p, encounter.id);
      }));
  }

  function handle(key, el) {
    if (!key.startsWith('encounter-')) return false;
    const command = key.slice(10);
    const id = el.dataset.id;
    const p = party();
    if (!p) return true;
    if (command === 'review-hit' || command === 'dismiss-hit') {
      const hit = p.encounterHits?.find(hit => hit.id === id && !hit.acknowledged);
      if (hit && command === 'review-hit' && p.characters.some(c => c.ownerId === user()?.uid && c.characterId === hit.characterId))
        ui.reviewCreatureDamage(hit.characterId, hit.amount);
      if (hit && command === 'dismiss-hit') run(p => store().encounters.acknowledge(p, id), false);
      return true;
    }
    if (command === 'creature') {
      showCreature(state().creatures.find(row => row.id === id));
      return true;
    }
    if (!mayManage()) return true;
    const encounter = lookup(id) || active;
    const row = encounter?.run?.creatures.find(row => row.id === (el.dataset.creature || dialog()?.querySelector('[data-encounter-combat]')?.dataset.encounterCombat))
      || encounter?.roster.find(row => row.id === el.dataset.creature);
    const index = Number(el.dataset.index);
    if (busy) return true;
    switch (command) {
      case 'library': run(openLibrary); break;
      case 'builder': if (encounter) builder(encounter); break;
      case 'create': case 'name': case 'duplicate': nameDialog(command, encounter); break;
      case 'template': templateDialog(library?.templates.find(template => template.id === id)); break;
      case 'delete-template': {
        const template = library?.templates.find(template => template.id === id);
        if (template) confirm(template, command);
        break;
      }
      case 'add-action': modal.querySelector('[data-template-actions]')?.dispatchEvent(new Event('encounter:add-action')); break;
      case 'remove-action': el.closest('.encounter-template-action')?.remove(); break;
      case 'catalog':
        run(async p => {
          if (!catalog || !library) {
            const [entries, source] = await Promise.all([store().encounters.library(p), import('./creature-catalog.js')]);
            if (party()?.id !== p || !mayManage()) return;
            catalog = source;
            library = entries;
          }
          if (encounter) catalogDialog(encounter);
        });
        break;
      case 'select': {
        const template = [...library.templates, ...catalog.SRD_CREATURES].find(template => template.id === el.dataset.template);
        if (template && encounter) addDialog(encounter, template);
        break;
      }
      case 'setup': if (row) setupDialog(encounter, row); break;
      case 'history': if (row) setModal(esc(row.name), marker('history', `<div class="encounter-detail-title">${portrait(resolveCreatureArt(row))}
        <p>${row.hp}/${row.maxHp} HP · AC ${row.ac} · ${esc(creatureHealth(row))}</p></div>${statBlock(row.stats, false)}
        ${abilities(row, false)}${row.notes ? `<p class="encounter-notes">${esc(row.notes)}</p>` : ''}
        <div class="modal-actions">${action('builder', 'Back to encounter', dataId(encounter.id), 'btn')}</div>`)); break;
      case 'delete': case 'end': case 'reset': case 'remove': if (encounter) confirm(encounter, command, row); break;
      case 'start': case 'pause': case 'resume': case 'archive':
        if (encounter) run(async p => {
          await change(p, encounter, {kind: command});
          if (command === 'archive') await reloadBuilder(p, encounter.id);
          else { modal.close(); ui.refresh(); }
        });
        break;
      case 'initiative': if (encounter?.run) initiativeDialog(encounter); break;
      case 'roll-one':
        if (row) run(p => change(p, encounter, {kind: 'initiative',
          scores: {[row.id]: ui.rollCreature(toHit(row.initiativeMod), row.name + ' initiative').total}}));
        break;
      case 'check': case 'save': {
        const key = el.dataset.ability;
        if (row && ABILITY_KEYS.includes(key)) ui.rollCreature(toHit(command === 'save' ? row.stats.saves[key] : mod(row.stats.scores[key])),
          `${row.name} · ${ABILITIES[key]} ${command}`);
        break;
      }
      case 'attack': case 'record': if (row) attackDialog(row, index); break;
      case 'visibility': case 'identity':
        if (row) run(p => change(p, encounter, {kind: 'creature', creature: row.id, change: {
          kind: 'visibility', visible: command === 'identity' || !row.visible,
          ...(command === 'identity' ? {identity: true} : {})
        }}));
        break;
      case 'roll-attack': case 'roll-damage':
        if (attackDraft && dialog()?.dataset.encounterDialog === 'attack') {
          const form = modal.querySelector('form');
          try {
            if (command === 'roll-attack') {
              attackDraft.attack = ui.rollCreature(toHit(attackDraft.entry.attack), 'Creature attack', form.elements.mode.value);
              form.elements.attackTotal.value = attackDraft.attack.total;
              showOutcome(attackDraft, form);
            } else {
              const damage = rollAttackDamage(form.elements.formula.value, form.elements.critical.checked);
              attackDraft.damage = ui.rollCreature(damage.expression, 'Creature damage', 'normal', damage);
              form.elements.amount.value = damage.total;
            }
          } catch (error) { toast(error.message, true); }
        }
        break;
      case 'damage': case 'heal': case 'temp': case 'defeat': case 'condition': case 'use': case 'reset-use': case 'recharge':
        if (row) run(async p => {
          let update = {kind: command, amount: modal.querySelector('[name="amount"]')?.value,
            condition: el.dataset.condition, enabled: el.getAttribute('aria-pressed') !== 'true'};
          if (['use', 'reset-use', 'recharge'].includes(command)) {
            if (command === 'recharge') {
              const result = ui.rollCreature('1d6', row.stats.actions[index].name + ' recharge');
              if (result.total < row.stats.actions[index].usage.recharge) return;
            }
            update = {kind: 'resource', index, use: command === 'use'};
          }
          await change(p, encounter, {kind: 'creature', creature: row.id, change: update});
        });
        break;
    }
    return true;
  }

  return {markup, state, turnStatus, sessionMember, next, update, reset, handle};
}
