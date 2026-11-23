import {portraitMarkup} from './portrait.js';
import {landscape} from './art.js';
import {icon} from './icons.js';
import {wikiURL,safeURL} from './model.js';
import {characterClasses} from './character-classes.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The sheet and live party use the same portrait, identity and level frame.
// Shared characters supply only public fields and never receive edit controls.
export function characterHero(c,{editable=false,compact=false}={}) {
  const classLabel=c.classBreakdown?esc(c.classBreakdown):characterClasses(c).map(row=>{
    const url=safeURL(wikiURL(row.class)),label=esc(`${row.class} ${row.level}`);
    return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(row.subclass||row.class)}">${label}</a>`:label;
  }).join('<span class="meta-dot">/</span>');
  const tags=[c.background,c.alignment].filter(Boolean);
  const portrait=`${portraitMarkup(c)}${editable?'<span class="portrait-edit-hint">'+icon('edit')+'</span>':''}<span class="level-badge">LVL ${String(c.level).padStart(2,'0')}</span>`;
  return `<section class="hero${compact?' party-hero':''}" data-inspired="${!!c.inspiration}" data-concentrating="${!!c.concentration}" aria-label="${esc(c.name)}">
    <div class="hero-art">${landscape()}</div>
    ${editable?`<button type="button" class="icon-btn hero-edit" data-action="edit-character" aria-label="Edit character details">${icon('edit')}</button>`:''}
    <div class="hero-content">
      ${editable?`<button type="button" class="avatar-frame portrait-button" data-action="portrait" aria-label="Make or edit character portrait" title="Make or edit portrait">${portrait}</button>`:`<div class="avatar-frame">${portrait}</div>`}
      <div class="hero-info"><h2>${esc(c.name)}</h2>
        <div class="hero-meta">${c.race?`<span>${esc(c.race)}</span><span class="meta-dot">·</span>`:''}${classLabel}${c.subclass&&!c.multiclass?.length&&!c.classBreakdown?`<span class="meta-dot">·</span><span>${esc(c.subclass)}</span>`:''}</div>
        ${c.playerName?`<div class="hero-player">Played by ${esc(c.playerName)}</div>`:''}
        ${tags.length?`<div class="hero-tags">${tags.map(tag=>`<span class="hero-tag">${esc(tag)}</span>`).join('')}</div>`:''}
        ${editable?`<button type="button" class="btn hero-background" data-action="background" aria-haspopup="dialog">${icon('journal')}Background</button>`:''}
      </div>
    </div>
  </section>`;
}
