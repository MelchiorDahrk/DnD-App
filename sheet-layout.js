import {icon} from './icons.js';

export const SHEET_SECTIONS = ['abilities','combat','attacks','skills','features'];
// Keep older layouts valid, including favorites still used by the inventory page.
const SAVED_SECTIONS = [...SHEET_SECTIONS,'essentials','proficiencies','personality','journal','pack'];
const sheetScrolls = new WeakMap();

export function validSheetLayout(layout) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const uniqueList = (value,max,valid) => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(valid);
  return record(layout)
    && (layout.skillsProficientOnly===undefined || typeof layout.skillsProficientOnly==='boolean')
    && (layout.skillsTab===undefined || ['skills','proficiencies','languages','tools','saves'].includes(layout.skillsTab))
    && uniqueList(layout.collapsed,SAVED_SECTIONS.length,key=>SAVED_SECTIONS.includes(key))
    && record(layout.favorites)
    && Object.entries(layout.favorites).every(([section,keys])=>SAVED_SECTIONS.includes(section)
      && uniqueList(keys,section==='attacks'?4001:2001,key=>typeof key === 'string' && key.length > 0 && key.length <= 120));
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
  if (!SAVED_SECTIONS.includes(section) || typeof key !== 'string' || !key || key.length > 120) return;
  const layout=layoutFor(c),keys=layout.favorites[section] || [];
  layout.favorites[section]=keys.includes(key)?keys.filter(value=>value!==key):[...keys,key];
}

// Enhance the existing sheet in place so toggles preserve keyboard focus and scroll position.
export function mountSheetLayout(root,c,activeSection='') {
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
      if (entry.matches('button, .combat-stat')) {
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
  return mountSheetNavigation(root,activeSection);
}

// Keep the compact navigation in sync with the visible headings, including the
// two-column desktop layout. Tear it down whenever the app replaces the sheet.
function mountSheetNavigation(root,activeSection) {
  const header=root.querySelector('.sheet-header'),nav=header?.querySelector('.sheet-section-nav');
  if(!nav)return ()=>{};
  const labels={abilities:'Abilities',combat:'Status',attacks:'Actions',skills:'Skills',features:'Features',proficiencies:'Training'};
  const sections=[...root.querySelectorAll('[data-sheet-section]')];
  for(const section of sections) {
    const key=section.dataset.sheetSection,toggle=section.querySelector('.sheet-section-toggle');
    section.id=`sheet-anchor-${key}`;
    const button=document.createElement('button');
    button.type='button';
    button.className='sheet-section-link';
    button.dataset.action='sheet-jump';
    button.dataset.section=key;
    button.setAttribute('aria-controls',section.id);
    button.setAttribute('aria-label',`Go to ${toggle.dataset.label}`);
    button.title=toggle.dataset.label;
    const symbol=toggle.querySelector('.icon:not(.sheet-chevron)');
    if(symbol)button.append(symbol.cloneNode(true));
    const label=document.createElement('span');
    label.textContent=labels[key]||toggle.dataset.label;
    button.append(label);
    nav.append(button);
  }
  header.dataset.activeSection=activeSection||'';
  let frame=0;
  const update=()=>{
    frame=0;
    const top=parseFloat(getComputedStyle(header).top)||0;
    const offset=top+header.getBoundingClientRect().height+12;
    const scrollPadding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
    root.style.setProperty('--sheet-scroll-offset',`${Math.max(0,offset-scrollPadding)}px`);
    // Keep the requested destination selected while passing other headings.
    if(sheetScrolls.has(root))return;
    const positions=sections.map(section=>({key:section.dataset.sheetSection,rect:section.getBoundingClientRect()}));
    const current=positions.find(({key})=>key===header.dataset.activeSection);
    // Short or collapsed sheets can reach the page bottom before a destination
    // reaches the header. Keep that visible destination selected after a jump.
    if(scrollY+innerHeight>=document.documentElement.scrollHeight-2&&current?.rect.top>=offset-1&&current.rect.top<innerHeight-80) {
      setActiveSheetSection(header,current.key);return;
    }
    const passed=positions.filter(({rect})=>rect.top<=offset+1);
    const nearest=passed.length?Math.max(...passed.map(({rect})=>rect.top)):positions[0].rect.top;
    const candidates=positions.filter(({rect})=>Math.abs(rect.top-nearest)<2);
    const key=candidates.find(({key})=>key===header.dataset.activeSection)?.key||candidates[0].key;
    setActiveSheetSection(header,key);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const interrupt=()=>{
    if(!sheetScrolls.has(root))return;
    cancelSheetScroll(root);
    schedule();
  };
  const onKeydown=event=>{
    if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))interrupt();
  };
  const observer=new ResizeObserver(schedule);
  observer.observe(header);
  for(const section of sections)observer.observe(section);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('wheel',interrupt,{passive:true});
  window.addEventListener('pointerdown',interrupt,{passive:true});
  window.addEventListener('keydown',onKeydown);
  update();
  return ()=>{
    cancelSheetScroll(root);
    observer.disconnect();
    window.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);
    window.removeEventListener('wheel',interrupt);
    window.removeEventListener('pointerdown',interrupt);
    window.removeEventListener('keydown',onKeydown);
    cancelAnimationFrame(frame);
    root.style.removeProperty('--sheet-scroll-offset');
  };
}

function setActiveSheetSection(header,key) {
  header.dataset.activeSection=key;
  for(const button of header.querySelectorAll('.sheet-section-link')) {
    const active=button.dataset.section===key,changed=button.classList.contains('active')!==active;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');
    if(active&&changed) {
      const nav=button.parentElement,rect=button.getBoundingClientRect(),bounds=nav.getBoundingClientRect();
      if(rect.left<bounds.left)nav.scrollLeft+=rect.left-bounds.left-4;
      else if(rect.right>bounds.right)nav.scrollLeft+=rect.right-bounds.right+4;
    }
  }
}

function cancelSheetScroll(root) {
  const scroll=sheetScrolls.get(root);
  if(scroll)cancelAnimationFrame(scroll.frame);
  sheetScrolls.delete(root);
}

export function jumpToSheetSection(root,key) {
  if(!SHEET_SECTIONS.includes(key))return;
  const section=root.querySelector(`[data-sheet-section="${key}"]`),header=root.querySelector('.sheet-header');
  if(!section||!header)return;
  cancelSheetScroll(root);
  setActiveSheetSection(header,key);
  section.querySelector('.sheet-section-toggle').focus({preventScroll:true});
  const offset=(parseFloat(getComputedStyle(header).top)||0)+header.getBoundingClientRect().height+12;
  const start=window.scrollY,left=window.scrollX;
  const target=Math.max(0,Math.min(start+section.getBoundingClientRect().top-offset,document.documentElement.scrollHeight-innerHeight));
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||Math.abs(target-start)<1) {
    window.scrollTo({top:target,left,behavior:'instant'});
    return;
  }
  // Cap travel at a brief 240 ms, even for long mobile sheets.
  const scroll={frame:0},started=performance.now();
  sheetScrolls.set(root,scroll);
  const step=now=>{
    const progress=Math.min(1,(now-started)/240),eased=1-(1-progress)**3;
    window.scrollTo({top:start+(target-start)*eased,left,behavior:'instant'});
    if(progress<1)scroll.frame=requestAnimationFrame(step);
    else sheetScrolls.delete(root);
  };
  scroll.frame=requestAnimationFrame(step);
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
    for (const notes of section.querySelectorAll('[data-ac-breakdown]')) notes.hidden=collapsed&&!isSheetFavorite(c,key,'ac');
    if(key==='skills'){
      for(const extra of section.querySelectorAll('.training-tabs,.skill-controls'))extra.hidden=collapsed;
      for(const panel of section.querySelectorAll('.training-tab-panel'))panel.hidden=collapsed?!panel.querySelector('[data-sheet-entry]:not([hidden])'):panel.id!==`skills-panel-${c.sheetLayout?.skillsTab==='saves'?'skills':c.sheetLayout?.skillsTab||'skills'}`;
    }
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
