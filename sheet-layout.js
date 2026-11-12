import {icon} from './icons.js';

export const SHEET_SECTIONS = ['abilities','combat','attacks','journal','pack','skills','features','essentials','personality','proficiencies'];

export function validSheetLayout(layout) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const uniqueList = (value,max,valid) => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(valid);
  return record(layout)
    && uniqueList(layout.collapsed,SHEET_SECTIONS.length,key=>SHEET_SECTIONS.includes(key))
    && record(layout.favorites)
    && Object.entries(layout.favorites).every(([section,keys])=>SHEET_SECTIONS.includes(section)
      && uniqueList(keys,2001,key=>typeof key === 'string' && key.length > 0 && key.length <= 120));
}

export const isSheetFavorite = (c,section,key) => c.sheetLayout?.favorites[section]?.includes(key) || false;

function layoutFor(c) {
  return c.sheetLayout ||= {collapsed:[],favorites:{}};
}

export function toggleSheetSection(c,section) {
  if (!SHEET_SECTIONS.includes(section)) return;
  const layout=layoutFor(c);
  layout.collapsed=layout.collapsed.includes(section)?layout.collapsed.filter(key=>key!==section):[...layout.collapsed,section];
}

export function toggleSheetFavorite(c,section,key) {
  if (!SHEET_SECTIONS.includes(section) || typeof key !== 'string' || !key || key.length > 120) return;
  const layout=layoutFor(c),keys=layout.favorites[section] || [];
  layout.favorites[section]=keys.includes(key)?keys.filter(value=>value!==key):[...keys,key];
}

// Enhance the existing sheet in place so toggles preserve keyboard focus and scroll position.
export function mountSheetLayout(root,c) {
  for (const section of root.querySelectorAll('[data-sheet-section]')) {
    const key=section.dataset.sheetSection;
    const heading=section.querySelector('.panel-heading, .section-heading');
    const title=heading.querySelector('h2');
    const label=title.textContent.trim();
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='sheet-section-toggle';
    toggle.dataset.action='sheet-collapse';
    toggle.dataset.section=key;
    toggle.dataset.label=label;
    toggle.innerHTML=icon('down','sheet-chevron')+title.innerHTML;
    title.replaceChildren(toggle);
    const count=document.createElement('span');
    count.className='sheet-favorite-count';
    toggle.append(count);
    const body=document.createElement('div');
    body.id=`sheet-section-${key}`;
    body.className='sheet-section-body';
    toggle.setAttribute('aria-controls',body.id);
    heading.after(body);
    while (body.nextSibling) body.append(body.nextSibling);

    for (let entry of body.querySelectorAll('[data-sheet-entry]')) {
      if (entry.matches('button')) {
        const wrapper=document.createElement('div');
        wrapper.className=`sheet-tile ${entry.classList.contains('ability-card')?'ability-entry':entry.classList.contains('combat-stat')?'combat-entry':'sheet-inline-entry'}`;
        wrapper.dataset.sheetEntry=entry.dataset.sheetEntry;
        wrapper.dataset.sheetLabel=entry.dataset.sheetLabel;
        entry.removeAttribute('data-sheet-entry');
        entry.removeAttribute('data-sheet-label');
        entry.before(wrapper);
        wrapper.append(entry);
        entry=wrapper;
      }
      const favorite=document.createElement('button');
      favorite.type='button';
      favorite.className='sheet-favorite';
      favorite.dataset.action='sheet-favorite';
      favorite.dataset.section=key;
      favorite.dataset.entry=entry.dataset.sheetEntry;
      favorite.dataset.label=entry.dataset.sheetLabel;
      favorite.innerHTML=icon('star');
      (entry.querySelector('dt, .note-preview-tag') || entry).append(favorite);
    }
    for (const extra of body.querySelectorAll('.empty-state, .skill-description, .nav-divider, .data-caption')) extra.dataset.sheetExtra='';
  }
  refreshSheetLayout(root,c);
}

export function refreshSheetLayout(root,c) {
  for (const section of root.querySelectorAll('[data-sheet-section]')) {
    const key=section.dataset.sheetSection,collapsed=c.sheetLayout?.collapsed.includes(key) || false;
    const toggle=section.querySelector('.sheet-section-toggle');
    let favorites=0;
    for (const entry of section.querySelectorAll('[data-sheet-entry]')) {
      const favorite=isSheetFavorite(c,key,entry.dataset.sheetEntry);
      const button=entry.querySelector('.sheet-favorite');
      if (favorite) favorites++;
      entry.hidden=collapsed && !favorite;
      button.classList.toggle('active',favorite);
      button.setAttribute('aria-pressed',String(favorite));
      button.setAttribute('aria-label',`${favorite?'Remove':'Add'} ${button.dataset.label} ${favorite?'from':'to'} favorites`);
      button.title=favorite?'Remove from favorites':'Favorite: keep visible when collapsed';
    }
    for (const extra of section.querySelectorAll('[data-sheet-extra]')) extra.hidden=collapsed;
    for (const group of section.querySelectorAll('[data-sheet-group]')) group.hidden=collapsed && !group.querySelector('[data-sheet-entry]:not([hidden])');
    section.classList.toggle('is-collapsed',collapsed);
    section.querySelector('.sheet-section-body').hidden=collapsed && !favorites;
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.setAttribute('aria-label',`${collapsed?'Expand':'Collapse'} ${toggle.dataset.label}`);
    toggle.title=`${collapsed?'Expand':'Collapse'} ${toggle.dataset.label}`;
    const count=toggle.querySelector('.sheet-favorite-count');
    count.textContent=collapsed && favorites?`${favorites} favorite${favorites===1?'':'s'}`:'';
    count.hidden=!count.textContent;
  }
}
