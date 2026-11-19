import {ABILITIES, COINS, castingAbility, initiative, mod, signed, walkingSpeed} from './model.js';
import {armorClassDetails,armorSpeedPenalty} from './armor-class.js';
import {BASIC_EQUIPMENT} from './catalog.js';
import {contentSourceTitles} from './content-sources.js';
import {openLevelUp} from './level-up-ui.js';
import {CREATION_STEPS, POINT_COST, STANDARD_ARRAY, creationPlan, finishLevelOne, newCharacterDraft, rollStartingScores} from './character-creation.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ruleLink = (url,label='Read the rules') => /^https:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}&nbsp;↗</a>` : '';
const rules = 'https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character';
const option = row => typeof row==='string' ? {id:row,label:row} : row;
const options = (rows,value) => rows.map(option).map(row => `<option value="${esc(row.id)}"${String(row.id)===String(value)?' selected':''}>${esc(row.label)}</option>`).join('');
const select = (label,name,rows,value,attrs='',placeholder='Choose…') => `<label class="form-field"><span>${esc(label)}</span><select name="${esc(name)}" ${attrs}>${placeholder?`<option value="">${esc(placeholder)}</option>`:''}${options(rows,value)}</select></label>`;
const input = (label,name,value,attrs='') => `<label class="form-field"><span>${esc(label)}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const textarea = (label,name,value,max=20000) => `<label class="form-field"><span>${esc(label)}</span><textarea name="${name}" rows="3" maxlength="${max}">${esc(value)}</textarea></label>`;
const preview = (entry,kind,details=entry?.details) => entry
  ? `<div class="catalog-preview"><strong>${esc(entry.name)}</strong><p>${esc(details)}</p><small>${esc(contentSourceTitles(entry,kind).join(' · '))} · ${ruleLink(entry.wiki)}</small></div>` : '';

function choiceGroup(group,selected) {
  if (group.defaultValue && !group.options.some(o=>o.id===selected[0])) selected=[group.defaultValue];
  const slots = Array.from({length:group.count},(_,index) => {
    const value = selected[index];
    const filtered = group.options.filter(row => row.id===value || !selected.includes(row.id));
    const label = group.count===1 ? group.label : `${group.label} ${index+1}`;
    return select(label,`choice-${group.id}`,filtered,value,`data-builder-choice="${group.id}" data-choice-index="${index}"`);
  });
  const entries = selected.map(id => group.options.find(row => row.id===id)).filter(Boolean);
  const references = entries.flatMap(row => row.entry ? [preview(row.entry,'feature')] : row.spell ? [
    `<p class="form-help">${esc(row.spell.name)} · ${esc(row.spell.school)} · ${esc(row.spell.castingTime)} · ${ruleLink(row.spell.wiki,'Spell rules')}</p>`
  ] : []);
  return `<fieldset class="level-choice builder-choice"><legend>${esc(group.label)}${group.count>1?` · choose ${group.count}`:''}</legend>${group.details?`<p class="form-help">${esc(group.details)}</p>`:''}${group.options.length<group.count?'<p class="form-help">Too few options are available from the enabled sources or earlier selections.</p>':''}<div class="form-grid">${slots.join('')}</div>${references.join('')}</fieldset>`;
}

function abilityStep(draft,{abilities,eligible}) {
  const pool = draft.method==='array' ? STANDARD_ARRAY : draft.rolls.map(roll => roll.total);
  const rolls = draft.method==='roll' ? `<button type="button" class="btn" data-builder-roll>${draft.rolls.length?'Roll all six again':'Roll 4d6 six times'}</button><div data-builder-dice></div>${draft.rolls.length?`<ol class="builder-rolls" aria-label="Ability score rolls">${draft.rolls.map((roll,index)=>`<li><strong>Roll ${index+1}</strong><span>${roll.dice.map((die,i)=>i===roll.dropped?`<s aria-label="${die}, dropped">${die}</s>`:`<b>${die}</b>`).join(' ')}</span><strong>${roll.total}</strong></li>`).join('')}</ol>`:''}` : '';
  return `${select('Score method','method',[{id:'array',label:'Standard array'},{id:'roll',label:'Roll 4d6, drop the lowest'},{id:'points',label:'27-point buy'},{id:'manual',label:'Manual base scores'}],draft.method,'','')}
    ${rolls}
    ${draft.method==='points'?`<p class="form-help" aria-live="polite">${abilities.spent} of 27 points spent. Score costs are shown beside each option.</p>`:''}
    ${draft.method==='manual'?'<p class="form-help">Enter table-approved base scores before applying background increases.</p>':''}
    <p class="form-help">Add +2 and +1 to two eligible abilities, or +1 to three. Eligible abilities: ${eligible.map(id=>ABILITIES[id]).join(', ')}. Maximum final score: 20.</p>
    <div class="builder-abilities">${Object.entries(ABILITIES).map(([id,label])=>{
      const used = Object.entries(draft.assignments).filter(([ability])=>ability!==id).map(([,value])=>String(value));
      const rows = pool.map((score,index)=>({id:String(index),label:draft.method==='roll'?`${score} (roll ${index+1})`:String(score)})).filter(row=>!used.includes(row.id)||String(draft.assignments[id])===row.id);
      const field = draft.method==='points'
        ? select('Base',`pointBuy.${id}`,Object.entries(POINT_COST).map(([id,cost])=>({id,label:`${id} · ${cost} pt`})),draft.pointBuy[id] ?? 8,'','')
        : draft.method==='manual' ? input('Base',`manual.${id}`,draft.manual[id],'type="number" min="1" max="20" step="1"')
        : select('Base',`assignments.${id}`,rows,draft.assignments[id]);
      return `<fieldset class="level-choice"><legend>${label}</legend><div class="builder-score-row">${field}${eligible.includes(id)?select('Increase',`bonuses.${id}`,[{id:'0',label:'+0'},{id:'1',label:'+1'},{id:'2',label:'+2'}],draft.bonuses[id] ?? 0,'',''):'<span>+0</span>'}<span class="builder-final-score">Final <strong>${abilities.final[id] ?? '—'}</strong><small>Modifier ${abilities.final[id]===undefined?'—':signed(mod(abilities.final[id]))}</small></span></div></fieldset>`;
    }).join('')}</div>`;
}

const list = values => values.length ? values.map(esc).join(', ') : 'None';
const spellAvailability = spell => spell.level===0?'Cantrip'
  : `Level ${spell.level} · ${spell.classPrepared===false
    ? `In class spellbook${spell.prepared?' · ready from another source':''}`
    : spell.prepared?'Prepared':'In spellbook'}`;
function review(c, plan) {
  const ac = armorClassDetails(c);
  const training = c.training;
  const itemName = id => BASIC_EQUIPMENT.find(item=>item.id===id)?.name || id;
  const table = (label,entries) => `<div><dt>${label}</dt><dd>${list(entries)}</dd></div>`;
  return `<div class="builder-review">
    <div class="catalog-preview"><strong>${esc(c.name)}</strong><p>Level ${c.level} ${esc([c.class,c.subclass,c.race,c.background].filter(Boolean).join(' · '))}${c.size?` · ${esc(c.size)}`:''}</p></div>
    <div class="builder-review-stats">${Object.entries(c.stats).map(([id,score])=>`<div><span>${esc(ABILITIES[id])}</span><strong>${score}</strong><small>${signed(mod(score))}</small></div>`).join('')}</div>
    <dl class="builder-review-facts">${table('Hit points',[`${c.hp} / ${c.maxHp}`])}${table('Armor Class',[`${ac.total} · ${ac.summary}`])}${table('Walking speed',[`${walkingSpeed(c,c.trainingOrigins?armorSpeedPenalty(c):0)} ft.`])}${table('Initiative',[signed(initiative(c))])}${table('Hit Dice',[`${c.hitDice}d${c.hitDie}`])}${table('Saving throws',c.saves.map(id=>ABILITIES[id]))}${table('Skills',c.skills.map(skill=>c.expertise.includes(skill)?`${skill} (Expertise)`:skill))}${table('Languages',training.languages)}${table('Tools',training.tools.map(itemName))}${table('Weapon training',training.weapons.map(itemName))}${table('Armor training',training.armor)}</dl>
    <section><h3>Features and feats</h3><ul>${c.features.map(f=>`<li>${ruleLink(f.wiki,f.name)||esc(f.name)}${f.origin?` · ${esc(f.origin)}`:''}${f.maxUses?` · ${f.maxUses} uses / ${f.reset==='short'?'Short or Long Rest':f.reset==='long'?'Long Rest':'manual recovery'}`:''}<small>${esc(f.description)}</small></li>`).join('')}</ul></section>
    <section><h3>Spells</h3>${c.slots.some(s=>s.max)?`<p>${c.pactMagic?'Pact Magic':'Class spellcasting'} · ${ABILITIES[castingAbility(c)]} · ${c.slots.map((slot,index)=>slot.max?`${slot.max} level-${index+1} slot${slot.max===1?'':'s'}`:'').filter(Boolean).join(', ')}</p>`:''}${c.spells.length?`<ul>${c.spells.map(spell=>`<li>${ruleLink(spell.wiki,spell.name)||esc(spell.name)} · ${spellAvailability(spell)}${spell.origins?.length?` · ${esc(spell.origins.join(', '))}`:spell.origin?` · ${esc(spell.origin)}`:''}${spell.castingGrants?.length?`<small>${esc(spell.castingGrants.map(g=>`${g.origin} · ${ABILITIES[g.ability]}${g.mode==='free'?' · free casting available':g.mode==='at-will'&&spell.level?' · no slot required':''}`).join('; '))}</small>`:''}</li>`).join('')}</ul>`:'<p>No starting spells.</p>'}</section>
    <section><h3>Equipment and coins</h3>${c.items.length?`<ul>${c.items.map(item=>`<li>${item.qty} × ${esc(item.name)}${item.equipped?' (equipped)':''}${item.category==='Gear'&&item.usesLeft?` · ${item.usesLeft} uses per bundle`:''}</li>`).join('')}</ul>`:'<p>No starting items.</p>'}<p>${Object.entries(COINS).filter(([key])=>c[key]).map(([key,label])=>`${c[key]} ${label.toUpperCase()}`).join(', ')||'0 GP'}</p></section>
    ${plan.targetLevel>1?`<p class="form-help">Starting level ${plan.targetLevel}. Apply each intervening level before creating the character. Ask your DM about any extra gear for higher-level starts.</p>`:''}
  </div>`;
}

export function openCharacterBuilder({setModal,onComplete,settings={},animateRoll}) {
  const draft = newCharacterDraft();
  let step=0, advanced=null, resumeAdvance=null, showErrors=false;
  const assignmentsByMethod = {};
  const saveFields = form => {
    const selections = {};
    for (const field of form.querySelectorAll('input[name],select[name],textarea[name]')) {
      const {name,value} = field;
      const {builderChoice,choiceIndex} = field.dataset;
      if (builderChoice) (selections[builderChoice] ??= [])[Number(choiceIndex)]=value;
      else if (field.dataset.purchaseIndex!==undefined) draft.purchases[Number(field.dataset.purchaseIndex)][field.dataset.purchaseValue]=value;
      else if (name.includes('.')) {
        const [key,id]=name.split('.');
        draft[key][id]=value;
      } else draft[name]=value;
    }
    Object.assign(draft.choices,selections);
  };
  const draw = focus => {
    const plan = creationPlan(draft,settings,step);
    const groups = plan.groups[step].map(group=>choiceGroup(group,draft.choices[group.id] || [])).join('');
    const byName = rows=>rows.map(row=>({id:row.name,label:row.name}));
    const scope = plan.character;
    const descriptions = [
      'Choose who your adventurer is and how they begin.',
      'Your species grants traits. Your background grants training, eligible ability increases, and an Origin feat.',
      'Generate six base scores, then apply the increases from your background.',
      'Choose your class skills and additional training. Everyone starts with Common and two standard languages.',
      'Choose the options that shape your class, species, and Origin feats.',
      'Choose class spells and any spells granted by your traits or feats.',
      'Choose the equipment or coin offered by your class and background.',
      'Review the sheet before you create your character.'
    ];
    let body = groups;
    if (step===0) body = `<div class="form-grid">${input('Character name','name',draft.name,'maxlength="120" autocomplete="off"')}${select('Class','class',byName(plan.classes),draft.class)}${input('Player name (optional)','playerName',draft.playerName,'maxlength="120"')}${input('Campaign (optional)','campaign',draft.campaign,'maxlength="100"')}${select('Alignment','alignment',['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil','Unaligned'],draft.alignment || 'Unaligned','','')}${input('Starting level','targetLevel',draft.targetLevel,'type="number" min="1" max="20" step="1"')}</div>${preview(plan.cls,'class',plan.cls?`${plan.cls.details} Primary ability: ${plan.cls.primary}. Hit die: d${plan.cls.hitDie}.`:'')}`;
    if (step===1) body = `<div class="form-grid">${select('Species','species',[...byName(plan.species),{id:'custom',label:'Custom or earlier-book species'}],draft.species)}${select('Background','background',[...byName(plan.backgrounds),{id:'custom',label:'Custom or earlier-book background'}],draft.background)}
      ${draft.species==='custom'?`${input('Species name','customSpecies',draft.customSpecies,'maxlength="120"')}${input('Walking speed (ft.)','customSpeed',draft.customSpeed ?? 30,'type="number" min="0" max="999" step="1"')}${input('Senses (optional)','customSenses',draft.customSenses,'maxlength="500"')}`:''}
      ${draft.background==='custom'?input('Background name','customBackground',draft.customBackground,'maxlength="120"'):''}</div>${groups}${preview(plan.lineage,'race')}${preview(plan.background,'background',plan.background?`${plan.background.skills} · ${plan.background.tool} · ${plan.background.feat}. Eligible abilities: ${plan.background.abilities}.`:'')}`;
    if (step===2) body = abilityStep(draft,plan);
    if (step===3) body = `<p class="form-help">Granted so far: ${list([...scope.skills,...scope.training.languages])}.</p>
      ${draft.species==='custom'?`<div class="form-grid">${select('Species skill choices','customSkillCount',['0','1','2','3','4','5','6'],draft.customSkillCount || '0','','')}${select('Species tool choices','customToolCount',['0','1','2','3','4','5','6'],draft.customToolCount || '0','','')}</div>`:''}
      ${groups}${draft.species==='custom'||draft.background==='custom'?input('Additional table-approved languages (comma separated)','customLanguages',draft.customLanguages,'maxlength="500"'):''}`;
    if (step===4) body = `${groups}${plan.featSpells.map(({prefix,feat})=>feat.published?textarea(`${feat.name} choices from your book`,`${prefix}FeatNotes`,draft[`${prefix}FeatNotes`],2000):'').join('')}
      ${draft.species==='custom'||draft.background==='custom'||scope.class==='Artificer'?`<p class="form-help">${scope.class==='Artificer'?'Artificer uses the app’s Tasha-era progression. Record variant rules or table choices here.':'Record any table-approved features. Resolve conditional effects during play.'}</p>${textarea('Custom features, one per line (name | notes)','customFeatures',draft.customFeatures)}`:''}
      ${scope.features.length?`<details class="level-choice"><summary>Features already granted</summary><ul>${scope.features.map(f=>`<li>${ruleLink(f.wiki,f.name)||esc(f.name)} · ${esc(f.origin)}${f.maxUses?` · ${f.maxUses} uses`:''}</li>`).join('')}</ul></details>`:''}`;
    if (step===5) body = `${groups}${plan.grants.length?`<p class="form-help">Also granted: ${plan.grants.map(g=>`${esc(g.spell.name)} (${esc(g.source)})`).join(', ')}.</p>`:''}${plan.manualSpells?textarea('Custom spells, one per line (level | name | ability, e.g. 0 | Light | cha)','customSpells',draft.customSpells):''}${!groups&&!plan.grants.length&&!plan.manualSpells?'<p>No spell selections for this build.</p>':''}`;
    if (step===6) {
      const gearOptions = plan.shop.map(row=>({...row,label:`${row.label} · ${row.price>=100?`${row.price/100} GP`:`${row.price} CP`}`}));
      const equipmentPreview = scope.items.length ? `<p class="form-help">In your starting pack: ${list(scope.items.map(item=>`${item.qty} × ${item.name}`))}.</p>` : '';
      body = `${groups}${equipmentPreview}<details class="level-choice"${draft.purchases?.length?' open':''}><summary>Buy gear with starting coins</summary>
        <p class="form-help">Coins remaining: ${scope.gold} GP, ${scope.silver} SP, ${scope.copper} CP.</p>
        ${(draft.purchases || []).map(({id,quantity},index)=>`<div class="builder-purchase"><div class="form-grid">
          ${select(`Item ${index+1}`,`purchase-item-${index}`,gearOptions,id,`data-purchase-index="${index}" data-purchase-value="id"`)}
          ${input('Quantity',`purchase-count-${index}`,quantity,`type="number" min="1" max="999" step="1" data-purchase-index="${index}" data-purchase-value="quantity"`)}
        </div><button type="button" class="btn btn-sm" data-remove-purchase="${index}">Remove item ${index+1}</button></div>`).join('')}
        ${plan.shop.length&&(draft.purchases?.length || 0)<20?'<button type="button" class="btn" data-add-purchase>Add equipment</button>':''}</details>`;
    }
    if (step===7) body = review(advanced || scope,plan);
    const c = advanced || scope;
    const advancing = step===7 && c.level<plan.targetLevel;
    const submit = step<7 ? 'Next' : advancing ? `Advance to level ${c.level+1}` : 'Create character';
    const messages = step===7?plan.errors.flat():plan.errors[step];
    const validation = showErrors&&messages.length ? `<div class="form-error" role="alert"><strong>Complete these choices to continue.</strong><ul>${messages.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
    setModal(step===7?'Review your character':CREATION_STEPS[step],`
      <div class="character-builder" data-builder-step="${step+1}">
        <div class="builder-progress"><strong>Character builder</strong><span>Step ${step+1} of ${CREATION_STEPS.length}</span></div>
        <progress aria-label="Character builder progress" max="${CREATION_STEPS.length}" value="${step+1}"></progress>
        <p class="modal-intro">${descriptions[step]} ${ruleLink(rules,'2024 character creation')}</p>
        ${body}${validation}
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close">Cancel</button>
        ${step>0?`<button type="button" class="btn" data-builder-back>${advanced?'Back to level 1':'Back'}</button>`:''}
        <button type="submit" class="btn btn-primary">${submit}</button></div>
      </div>`,()=>{
      saveFields(document.querySelector('#modal-form'));
      const checked = creationPlan(draft,settings,step);
      const first = checked.errors.findIndex((errors,index)=>index<=step && errors.length);
      if (first>=0) {step=first;showErrors=true;draw();return;}
      showErrors=false;
      if (step<7) {step++;draw();return;}
      if (advancing) {
        const next = structuredClone(advanced || finishLevelOne(draft,settings));
        if (resumeAdvance) {resumeAdvance();return;}
        resumeAdvance=openLevelUp(next,{setModal,settings,creationMode:true,onBack:()=>draw(),onComplete:()=>{
          next.ac=armorClassDetails(next).total;
          advanced=next;
          resumeAdvance=null;
          draw();
        }});
        return;
      }
      onComplete(advanced || finishLevelOne(draft,settings));
    });
    const form = document.querySelector('#modal-form');
    form.noValidate=true;
    if (focus) {
      form.querySelectorAll(`[name="${CSS.escape(focus.name)}"]`)[focus.index ?? 0]?.focus({preventScroll:true});
      form.closest('dialog').scrollTop=focus.scroll ?? 0;
    }
    form.querySelector('[data-builder-back]')?.addEventListener('click',()=>{
      saveFields(form);
      resumeAdvance=null;
      if (advanced) advanced=null;
      else step--;
      showErrors=false;
      draw();
    });
    form.querySelector('[data-builder-roll]')?.addEventListener('click',()=>{
      saveFields(form);
      draft.rolls=rollStartingScores();
      draft.assignments={};
      draw();
      animateRoll?.(draft.rolls[0],document.querySelector('[data-builder-dice]'));
    });
    form.querySelector('[data-add-purchase]')?.addEventListener('click',()=>{
      saveFields(form);
      (draft.purchases ??= []).push({id:'',quantity:1});
      draw({name:`purchase-item-${draft.purchases.length-1}`});
    });
    for (const button of form.querySelectorAll('[data-remove-purchase]')) button.addEventListener('click',()=>{
      saveFields(form);
      draft.purchases.splice(Number(button.dataset.removePurchase),1);
      draw();
    });
    form.addEventListener('change',event=>{
      const field=event.target;
      if (!field.matches('select,[name^="manual."],[data-purchase-index]')) return;
      const method=draft.method;
      saveFields(form);
      if (field.name==='method' && method!==draft.method) {
        assignmentsByMethod[method]=draft.assignments;
        draft.assignments=assignmentsByMethod[draft.method] || {};
      }
      if (field.name==='background') draft.bonuses={};
      draw({name:field.name,index:Number(field.dataset.choiceIndex ?? 0),scroll:form.closest('dialog').scrollTop});
    });
  };
  draw();
}
