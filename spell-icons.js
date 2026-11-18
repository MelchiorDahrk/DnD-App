import {icon} from './icons.js';
import {SPELL_ICON_LIBRARY} from './spell-icon-manifest.js';
import {spellIconName,EXACT_SPELL_ICONS,SCHOOL_SPELL_ICONS,EFFECT_SPELL_ICONS,SUMMON_SPELL_ICONS,UNKNOWN_SPELL_ICON} from './spell-icon-mappings.js';
export {SPELL_ICON_LIBRARY} from './spell-icon-manifest.js';

const library=new Map(SPELL_ICON_LIBRARY.map(entry=>[entry.key,entry]));
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const validSpellIconKey=key=>typeof key==='string'&&library.has(key);
export const spellIconURL=key=>validSpellIconKey(key)?`./assets/spell-icons/${key}.svg`:null;

// Only explicit structured values are inspected. Notes such as "resistant to
// fire", "cannot heal", and "summoning is blocked" never become effect matches.
// Supports the local homebrew shape plus common SRD/API damage descriptors.
export function spellEffectIcon(spell={}) {
  const effects=[spell.effect,spell.effectType,...(Array.isArray(spell.effects)?spell.effects:[]),...(Array.isArray(spell.effectTags)?spell.effectTags:[])];
  const tags=effects.flatMap(value=>typeof value==='string'?[spellIconName(value)]:value&&typeof value==='object'?[spellIconName(value.type),spellIconName(value.effect)]:[]);
  if(spell.healing===true||spell.healing&&typeof spell.healing==='object'||tags.includes('healing'))return EFFECT_SPELL_ICONS.healing;
  const creature=spellIconName(spell.summonType||spell.summonedCreatureType||spell.summon?.creatureType);
  if(Object.hasOwn(SUMMON_SPELL_ICONS,creature))return {key:SUMMON_SPELL_ICONS[creature],tone:library.get(SUMMON_SPELL_ICONS[creature]).tone};
  for(const tag of ['resurrection','teleportation','summoning','transformation','illusion','protection','flight'])if(tags.includes(tag))return EFFECT_SPELL_ICONS[tag];
  const damages=[spell.damageType,...(Array.isArray(spell.damageTypes)?spell.damageTypes:[]),...(Array.isArray(spell.damageInflict)?spell.damageInflict:[]),spell.damage?.type,spell.damage?.damage_type?.name,
    ...effects.filter(value=>value&&typeof value==='object'&&spellIconName(value.type)==='damage').map(value=>value.damageType)];
  for(const value of damages){const type=spellIconName(typeof value==='object'?value?.name:value);if(Object.hasOwn(EFFECT_SPELL_ICONS,type))return EFFECT_SPELL_ICONS[type];}
  for(const tag of tags)if(Object.hasOwn(EFFECT_SPELL_ICONS,tag))return EFFECT_SPELL_ICONS[tag];
  return null;
}

export function automaticSpellIcon(spell={}) {
  const name=spellIconName(spell.name),exact=Object.hasOwn(EXACT_SPELL_ICONS,name)?EXACT_SPELL_ICONS[name]:null;
  if(exact)return {...exact,source:'exact'};
  const effect=spellEffectIcon(spell);if(effect)return {...effect,source:'effect'};
  const schoolName=spellIconName(spell.school),school=Object.hasOwn(SCHOOL_SPELL_ICONS,schoolName)?SCHOOL_SPELL_ICONS[schoolName]:null;
  return {...(school||UNKNOWN_SPELL_ICON),source:school?'school':'unknown'};
}

export function selectSpellIcon(spell={}) {
  const auto=automaticSpellIcon(spell);
  const manual=library.get(spell.spellIconKey);
  return manual?{key:manual.key,tone:['exact','effect'].includes(auto.source)?auto.tone:manual.tone,source:'manual'}:auto;
}

/** Local SVG masks preserve the original artwork while inheriting theme ink. */
export function spellIconMarkup(spell={}) {
  const {key,tone}=selectSpellIcon(spell),url=spellIconURL(key);
  return `<span class="spell-icon spell-tone-${tone}" data-spell-icon="${key}" style="--spell-art:url('${url}')" aria-hidden="true"><span class="spell-icon-fallback">${icon('spark')}</span><span class="spell-icon-art"></span><img src="${url}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>`;
}

/** A broken/missing SVG reveals the built-in arcane star, never equipment art. */
export function installSpellIconFallbacks(root=document) {
  root.addEventListener('error',event=>{
    if(event.target instanceof HTMLImageElement&&event.target.parentElement?.classList.contains('spell-icon'))event.target.remove();
  },true);
}

export function spellIconPicker(spell) {
  const selected=validSpellIconKey(spell.spellIconKey)?spell.spellIconKey:'';
  const groups=[...new Set(SPELL_ICON_LIBRARY.map(entry=>entry.group))].sort();
  return `<details class="item-icon-picker spell-icon-picker"><summary><span class="item-icon-preview" data-spell-icon-preview>${spellIconMarkup(spell)}</span><span>Icon<strong data-spell-icon-label>${esc(library.get(selected)?.label||'Automatic')}</strong></span><span class="item-icon-browse">Browse library</span></summary><p class="form-help">Choose artwork for this spell, or restore Automatic to follow its name, effect, and school.</p><div class="form-grid"><label class="form-field">Search spell icons<input type="search" data-spell-icon-search placeholder="Try fireball, healing, wings, or portal" autocomplete="off"></label><label class="form-field">Icon category<select data-spell-icon-group><option value="">All icons</option>${groups.map(group=>`<option>${esc(group)}</option>`).join('')}</select></label></div><label class="item-icon-auto"><input type="radio" name="spellIconKey" value="" ${selected?'':'checked'}>Automatic · match this spell</label><p class="form-help" data-spell-icon-count role="status">${SPELL_ICON_LIBRARY.length} icons available.</p><div class="item-icon-grid" role="group" aria-label="Spell icon library">${SPELL_ICON_LIBRARY.map(entry=>`<label class="item-icon-choice" data-spell-icon-key="${entry.key}"><input type="radio" name="spellIconKey" value="${entry.key}" ${selected===entry.key?'checked':''}><span>${spellIconMarkup({spellIconKey:entry.key})}<span>${esc(entry.label)}</span></span></label>`).join('')}</div><p class="form-help">Artwork by Lorc and Delapouite, <a href="https://game-icons.net/" target="_blank" rel="noopener noreferrer">Game-icons.net</a> · <a href="./assets/spell-icons/CREDITS.md" target="_blank" rel="noopener noreferrer">credits & license</a>.</p></details>`;
}

export function updateSpellIconPicker(root,original={}) {
  const picker=root.querySelector('.spell-icon-picker');if(!picker)return;
  const spellIconKey=picker.querySelector('[name="spellIconKey"]:checked')?.value||'';
  const spell={...original,name:root.querySelector('[name="name"]').value,school:root.querySelector('[name="school"]').value,spellIconKey};
  picker.querySelector('[data-spell-icon-preview]').innerHTML=spellIconMarkup(spell);
  picker.querySelector('[data-spell-icon-label]').textContent=library.get(spellIconKey)?.label||'Automatic';
  const words=spellIconName(picker.querySelector('[data-spell-icon-search]').value).split(' ').filter(Boolean),group=picker.querySelector('[data-spell-icon-group]').value;
  const matches=new Set(SPELL_ICON_LIBRARY.filter(entry=>(!group||entry.group===group)&&words.every(word=>spellIconName(`${entry.label} ${entry.group} ${entry.keywords}`).includes(word))).map(entry=>entry.key));
  for(const choice of picker.querySelectorAll('[data-spell-icon-key]'))choice.hidden=!matches.has(choice.dataset.spellIconKey);
  picker.querySelector('[data-spell-icon-count]').textContent=matches.size?`${matches.size} of ${SPELL_ICON_LIBRARY.length} icons. Choose one below.`:'No icons found. Try another search or category.';
}
