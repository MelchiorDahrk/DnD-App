import {EQUIPMENT,MAGIC_ITEMS,WEAPONS,CLASS_OPTIONS,SPECIES,BACKGROUNDS,SUBCLASSES,EQUIPMENT_GROUPS,equipmentFields,attackFromWeapon,attackFromEquipment} from './catalog.js';
import {FEATURE_CATALOG,FEATURE_GROUPS,FEAT_GROUPS,isFeat,filterFeatures,featureFields,featureRequirements} from './feature-catalog.js';
import {itemIconMarkup} from './item-icons.js';
import {contentEnabled,visibleContent,enabledFeatSources} from './content-sources.js';

const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options = (entries,value,blank='Choose an option…') => `<option value="">${esc(blank)}</option>${entries.map(entry=>`<option value="${esc(entry.id||entry.name)}" ${(entry.id||entry.name)===value?'selected':''}>${esc(entry.name)}</option>`).join('')}`;
const customValue = '__questlog_custom__';
const characterOptions = name => name==='race'?SPECIES:name==='background'?BACKGROUNDS:[];
const featSourceOptions=settings=>'<option value="All">All enabled feat sources</option>'+enabledFeatSources(settings).map(source=>`<option>${esc(source)}</option>`).join('');
const featureSource=entry=>[entry.source,entry.book].filter(Boolean).join(' · ');

function statPreview(entry,kind) {
  if(!entry)return '<p>Choose an option to see its stats.</p>';
  let stats=[];
  if(kind==='class')stats=[['Hit die',`d${entry.hitDie}`],['Primary ability',entry.primary],['Saving throws',entry.saves.map(s=>s.toUpperCase()).join(', ')],['Armor training',entry.armor],['Weapons',entry.weapons],[`Skills (choose ${entry.skillCount})`,entry.skills]];
  if(kind==='race')stats=[['Size',entry.size],['Speed',`${entry.speed} ft.`],['Senses',entry.senses||'No special senses']];
  if(kind==='background')stats=[['Ability choices',entry.abilities],['Origin feat',entry.feat],['Skills',entry.skills],['Tool',entry.tool]];
  if(kind==='subclass')stats=[['Class',entry.className],['Subclass level',entry.level]];
  if(kind==='item'||kind==='attack')stats=[['Category',entry.group],['Cost',entry.cost.replace(/^B\s*\+/,'Base item + ')],['Weight',entry.carried===false?'Not counted as carried gear':entry.weightStatus?`${entry.weight} lb. · ${entry.weightStatus}`:`${entry.weight} lb.${entry.weight===0?' (negligible)':''}`]];
  if(entry.magic)stats.push(['Rules',entry.edition||'2024'],['Rarity',entry.rarity],['Attunement',entry.attunement],['Type',entry.typeDetails],['Source',entry.source]);
  return `${kind==='item'?`<div class="catalog-item-art">${itemIconMarkup(entry)}</div>`:''}<strong>${esc(entry.name)}</strong>${stats.length?`<dl>${stats.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}<p class="catalog-rules">${esc(entry.details)}</p>${(entry.tables||[]).map(rows=>`<div class="catalog-table-scroll" tabindex="0" role="region" aria-label="${esc(entry.name)} stats"><table>${rows.map((cells,i)=>`<tr>${cells.map(cell=>`<${i?'td':'th'}>${esc(cell)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</table></div>`).join('')}${entry.magic?'<p class="form-help">AC from supported defensive items updates when equipped and attuned. Configure base armor and other AC bonuses in the item editor; manage charges, spells, and other effects at the table. B in a price means the base item cost.</p>':''}<a href="${esc(entry.wiki)}" target="_blank" rel="noopener noreferrer" class="text-btn">Read the rules ↗</a>`;
}

function featureOptions(entries,selected='') {
  return '<option value="">Custom entry / choose a preset…</option>'+FEATURE_GROUPS.map(group=>{
    const choices=entries.filter(entry=>entry.group===group).sort((a,b)=>a.owner.localeCompare(b.owner)||a.level-b.level||a.name.localeCompare(b.name));
    return choices.length?`<optgroup label="${esc(group)}">${choices.map(entry=>`<option value="${entry.id}" ${entry.id===selected?'selected':''}>${esc(entry.name)}${entry.className||entry.species?` · ${esc(entry.owner)}`:''}${entry.level>1?` · L${entry.level}+`:''}${entry.book?` · ${esc(entry.book)}`:''}</option>`).join('')}</optgroup>`:'';
  }).join('');
}
function featureCount(entries) {
  return `${entries.length} of ${FEATURE_CATALOG.length} presets shown. Choose All options to include feats above your level and options for other characters. Sources can be enabled in Settings. Custom entries are always available below.`;
}
function featurePicker(character,settings) {
  const entries=visibleContent(filterFeatures({character}),settings);
  return `<section class="catalog-picker feature-picker" aria-label="Feature & resource catalog"><div class="catalog-picker-heading"><strong>Feature & resource catalog</strong><span class="badge">${FEATURE_CATALOG.length} PRESETS</span></div><div class="form-grid"><label class="form-field">Show<select data-catalog-scope="feat"><option value="character">For this character · level ${character.level||1}</option><option value="character-all-levels">This character · all levels</option><option value="all">All options · every character</option></select></label><label class="form-field">Category<select data-catalog-group="feat"><option value="All">All categories</option>${FEATURE_GROUPS.map(group=>`<option>${esc(group)}</option>`).join('')}</select></label><label class="form-field full">Feat source<select data-catalog-source="feat">${featSourceOptions(settings)}</select></label><label class="form-field full">Find a feature or resource<input type="search" data-catalog-search="feat" placeholder="Name, class, species, ability, or source…" autocomplete="off"></label><label class="form-field full">Choose a preset<select data-catalog-pick="feat">${featureOptions(entries)}</select></label><label class="form-field full" data-feature-level-field hidden>Class level for this preset<input type="number" data-feature-level required disabled min="1" max="20" step="1" value="${character.level||1}"></label></div><div class="catalog-preview" data-catalog-preview="feat" aria-live="polite"><p>Choose a class feature, species trait, feat, subclass reference, or resource template. Suggestions use your recorded class, subclass, species, and level; check prerequisites in your book.</p></div><p class="form-help" data-catalog-count="feat" aria-live="polite">${featureCount(entries)}</p><p class="form-help">Presets fill the editable fields below. Review class level for multiclass characters. Uses and dice are set when selected; review them after leveling. Shared pools, spells, stat changes, and special recovery remain player-managed.</p></section>`;
}
function featurePreview(entry,character,level) {
  if(!entry)return '<p>Choose a preset to see its defaults. Your current fields are kept.</p>';
  const values=featureFields(entry,character,level);
  const uses=values.maxUses?`${values.maxUses} · ${values.reset==='manual'?'manual recovery':values.reset+' rest'}${values.shortRestRecovery?` · +${values.shortRestRecovery} / short rest`:''}`:'No independent use limit';
  return `<strong>${esc(entry.name)}</strong><dl><div><dt>Options / level</dt><dd>${esc(featureRequirements(entry))}</dd></div><div><dt>Rules / source</dt><dd>${esc(featureSource(entry))}</dd></div><div><dt>Uses / points</dt><dd>${esc(uses)}</dd></div>${values.rollFormula?`<div><dt>Roll</dt><dd>${esc(values.rollFormula)}</dd></div>`:''}${entry.sharedPool?`<div><dt>Shared pool</dt><dd>${esc(entry.sharedPool)} · spend separately</dd></div>`:''}</dl><p>${esc(values.description)}</p><a href="${esc(entry.wiki)}" target="_blank" rel="noopener noreferrer" class="text-btn">Read the rules ↗</a>`;
}
function fillFields(root,values) {
  for(const [name,value] of Object.entries(values)){
    const input=root.querySelector(`[name="${name}"]`);
    if(input){if(input.type==='radio'){const choice=[...root.querySelectorAll(`[name="${name}"]`)].find(option=>option.value===value);if(choice)choice.checked=true;}else if(input.type==='checkbox')input.checked=value;else input.value=value;}
  }
  const used=root.querySelector('[name="used"]');
  if(used&&values.maxUses!==undefined)used.value=Math.min(Number(used.value)||0,values.maxUses);
}

export function characterChoice(label,name,value,{entries=characterOptions(name),required=false,settings={}}={}) {
  entries=entries.filter(entry=>entry.name===value||contentEnabled(entry,settings,name));
  const known=entries.some(entry=>entry.name===value),custom=!!value&&!known;
  return `<div class="character-choice"><label class="form-field">${esc(label)}<select data-character-choice="${name}" ${required?'required':''}>${options(entries,known?value:'',required?'Choose '+label.toLowerCase()+'…':'None / choose later')}${`<option value="${customValue}" ${custom?'selected':''}>Custom / earlier-book option…</option>`}</select></label><label class="form-field custom-choice" data-custom-for="${name}" ${custom?'':'hidden'}>Custom ${esc(label.toLowerCase())}<input name="${name}" type="${custom?'text':'hidden'}" value="${esc(value)}" maxlength="100" ${custom&&required?'required':''}></label><div class="catalog-preview" data-option-preview="${name}" aria-live="polite">${statPreview(entries.find(entry=>entry.name===value),name)}</div></div>`;
}

export function classPreview(value) {
  return `<div class="catalog-preview full" data-option-preview="class" aria-live="polite">${statPreview(CLASS_OPTIONS.find(entry=>entry.name===value),'class')}</div>`;
}

function pickerEntries(kind) {return kind==='attack'?WEAPONS:EQUIPMENT;}
const magicRarities=['Common','Uncommon','Rare','Very Rare','Legendary','Artifact','Unique','Unknown'];
const rarityOptions=()=>'<option value="All">All rarities</option>'+magicRarities.map(r=>`<option>${r}</option>`).join('');
const editionOptions=()=>'<option value="All">All rules</option><option value="2024">2024</option><option value="2014">2014 · earlier-only items</option>';
export function filterEquipment(entries,{query='',group='All',rarity='All',attunement='All',edition='All',settings={}}={}) {
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry=>contentEnabled(entry,settings,'item')&&(group==='All'||entry.group===group)&&(edition==='All'||(entry.edition||'2024')===edition)&&(rarity==='All'||entry.rarities?.includes(rarity))&&(attunement==='All'||entry.magic&&(attunement==='Required')===(entry.attunement!=='Not required'))&&words.every(word=>`${entry.name} ${entry.details} ${entry.itemType||''} ${entry.rarity||''} ${entry.attunement||''} ${entry.source||''} ${entry.edition||'2024'} ${(entry.tables||[]).flat(2).join(' ')}`.toLowerCase().includes(word)));
}
function filteredEntries(root,kind,character,settings) {
  const query=(root.querySelector(`[data-catalog-search="${kind}"]`)?.value||'').trim().toLowerCase();
  const group=root.querySelector(`[data-catalog-group="${kind}"]`)?.value||'All';
  if(kind==='feat')return visibleContent(filterFeatures({character,group,query,source:root.querySelector('[data-catalog-source="feat"]')?.value||'All',scope:root.querySelector('[data-catalog-scope="feat"]').value}),settings);
  return filterEquipment(pickerEntries(kind),{settings,query,group,rarity:root.querySelector('[data-catalog-rarity]')?.value||'All',attunement:root.querySelector('[data-catalog-attunement]')?.value||'All',edition:root.querySelector('[data-catalog-edition]')?.value||'All'});
}
function pickerOptions(entries,selected,kind,allowCustom=true) {
  if(kind==='feat')return featureOptions(entries,selected);
  if(kind!=='item')return options(entries,selected,'Custom entry / choose a preset…');
  return `<option value="">${allowCustom?'Custom item / choose equipment…':'Choose equipment…'}</option>`+EQUIPMENT_GROUPS.map(group=>{
    const items=entries.filter(entry=>entry.group===group).sort((a,b)=>a.name.localeCompare(b.name));
    return items.length?`<optgroup label="${esc(group)}">${items.map(entry=>`<option value="${entry.id}" ${entry.id===selected?'selected':''}>${esc(entry.name)} · ${esc(entry.magic?(entry.edition||'2024')+' · '+entry.rarity+' · ':'')}${esc(entry.cost)}</option>`).join('')}</optgroup>`:'';
  }).join('');
}
export function catalogPicker(kind,character={},settings={}) {
  if(kind==='feat')return featurePicker(character,settings);
  const entries=visibleContent(pickerEntries(kind),settings,'item');
  const label=kind==='attack'?'Weapon preset':'Equipment & magic items';
  const itemFilters=kind==='item'?`<label class="form-field">Equipment type<select data-catalog-group="item"><option>All</option>${EQUIPMENT_GROUPS.map(group=>`<option>${esc(group)}</option>`).join('')}</select></label><label class="form-field">Rarity<select data-catalog-rarity="item">${rarityOptions()}</select></label><label class="form-field">Attunement<select data-catalog-attunement="item"><option value="All">Any attunement</option><option value="Required">Required</option><option value="Not required">Not required</option></select></label>`:'';
  return `<section class="catalog-picker" aria-label="${label}"><div class="catalog-picker-heading"><strong>${label}</strong><span class="badge">${kind==='item'?'2014 + 2024':'2024'}</span></div><div class="form-grid">${itemFilters}${kind==='item'?`<label class="form-field">Rules version<select data-catalog-edition="item">${editionOptions()}</select></label>`:''}<label class="form-field ${kind==='item'?'':'full'}">Find ${kind==='attack'?'a weapon':'equipment'}<input type="search" data-catalog-search="${kind}" placeholder="${kind==='item'?'Name, effect, rarity, or source…':'Search by name…'}" autocomplete="off"></label><label class="form-field full">${label}<select data-catalog-pick="${kind}">${pickerOptions(entries,'',kind)}</select></label></div><div class="catalog-preview" data-catalog-preview="${kind}" aria-live="polite"><p>${kind==='item'?'Choose equipment or a magic item to fill its name, category, weight, cost, stats, and LEGO icon.':'Choose a weapon to fill damage, ability, range, and mastery notes.'} You can edit every field before saving.</p></div><p class="form-help" data-catalog-count="${kind}">${entries.length} presets available from enabled sources. Existing notes change only when you select a preset.</p></section>`;
}

export function handleCatalogFilter(root,target,character={},settings={}) {
  const kind=target.dataset.catalogSearch||target.dataset.catalogGroup||target.dataset.catalogScope||target.dataset.catalogSource||target.dataset.catalogRarity||target.dataset.catalogAttunement||target.dataset.catalogEdition;
  if(!kind)return false;
  const entries=filteredEntries(root,kind,character,settings),select=root.querySelector(`[data-catalog-pick="${kind}"]`),previous=select.value;
  select.innerHTML=pickerOptions(entries,previous,kind);
  root.querySelector(`[data-catalog-count="${kind}"]`).textContent=kind==='feat'?`${featureCount(entries)}${entries.length?'':' Try another search, category, or Show filter.'}`:`${entries.length} preset${entries.length===1?'':'s'} found. ${entries.length?'Select one to fill the fields below.':'Try another search or equipment type.'}`;
  if(!select.value)root.querySelector(`[data-catalog-preview="${kind}"]`).innerHTML='<p>Choose a preset to see its stats. Your current fields are kept.</p>';
  if(kind==='feat'&&!select.value){root.querySelector('[data-feature-level-field]').hidden=true;root.querySelector('[data-feature-level]').disabled=true;}
  return true;
}

export function handleCatalogChoice(root,target,character,settings={}) {
  if(target.dataset.catalogGroup||target.dataset.catalogScope||target.dataset.catalogSource||target.dataset.catalogRarity||target.dataset.catalogAttunement||target.dataset.catalogEdition)return handleCatalogFilter(root,target,character,settings);
  if(target.hasAttribute('data-feature-level')){
    const entry=FEATURE_CATALOG.find(option=>option.id===root.querySelector('[data-catalog-pick="feat"]').value);
    if(entry&&target.validity.valid){fillFields(root,featureFields(entry,character,target.value));root.querySelector('[data-catalog-preview="feat"]').innerHTML=featurePreview(entry,character,target.value);}
    return true;
  }
  if(target.dataset.catalogPick){
    if(target.dataset.catalogPick==='feat'){
      const entry=FEATURE_CATALOG.find(option=>option.id===target.value),level=root.querySelector('[data-feature-level]');
      root.querySelector('[data-feature-level-field]').hidden=!entry?.className;
      level.disabled=!entry?.className;
      if(entry)level.value=entry.className===character.class?character.level:entry.level;
      root.querySelector('[data-catalog-preview="feat"]').innerHTML=featurePreview(entry,character,level.value);
      if(entry)fillFields(root,featureFields(entry,character,level.value));
      return true;
    }
    const kind=target.dataset.catalogPick,entry=pickerEntries(kind).find(option=>(option.id||option.name)===target.value);
    root.querySelector(`[data-catalog-preview="${kind}"]`).innerHTML=statPreview(entry,kind);
    if(!entry)return true;
    const values=kind==='item'?{...equipmentFields(entry),...(entry.category==='Weapon'?attackFromEquipment(entry,character):{}),actionType:entry.actionType||''}:attackFromWeapon(entry,character);
    fillFields(root,values);
    return true;
  }
  if(target.dataset.characterChoice){
    const name=target.dataset.characterChoice,wrapper=target.closest('.character-choice'),input=wrapper.querySelector(`[name="${name}"]`),custom=target.value===customValue;
    wrapper.querySelector('[data-custom-for]').hidden=!custom;
    input.type=custom?'text':'hidden';input.required=custom&&target.required;
    if(!custom)input.value=target.value;
    else {input.value='';input.focus();}
    const entries=name==='subclass'?SUBCLASSES.filter(entry=>entry.className===root.querySelector('[name="class"]').value):characterOptions(name);
    wrapper.querySelector('[data-option-preview]').innerHTML=statPreview(entries.find(entry=>entry.name===target.value),name);
    return true;
  }
  if(target.name==='class'&&root.querySelector('[data-option-preview="class"]')){
    root.querySelector('[data-option-preview="class"]').innerHTML=statPreview(CLASS_OPTIONS.find(entry=>entry.name===target.value),'class');
    const wrapper=root.querySelector('[data-character-choice="subclass"]').closest('.character-choice');
    wrapper.outerHTML=characterChoice('Subclass','subclass','',{entries:SUBCLASSES.filter(entry=>entry.className===target.value),settings});
    return true;
  }
  return false;
}

export function catalogBrowser(settings={}) {
  return `<section class="panel catalog-browser"><div class="panel-heading"><h2>Equipment, magic items & character options</h2><span class="badge">OFFLINE</span></div><div class="panel-body"><p class="modal-intro">Browse stats here, or use the dropdowns when adding equipment, attacks, features, or character details. Shared magic items use their 2024 rules; earlier-only items are labeled 2014.</p><div class="form-grid"><label class="form-field">Browse<select data-reference-kind>${['Equipment','Magic items','Classes','Species / races','Backgrounds','Subclasses','Origin feats','Feats','Features & resources'].map(name=>`<option>${name}</option>`).join('')}</select></label><label class="form-field" data-reference-search-filter>Find an entry<input type="search" data-reference-search placeholder="Name, effect, rarity, or source…" autocomplete="off"></label><label class="form-field" data-reference-item-filter>Rarity<select data-reference-rarity>${rarityOptions()}</select></label><label class="form-field" data-reference-item-filter>Rules version<select data-reference-edition>${editionOptions()}</select></label><label class="form-field" data-reference-feature-filter hidden>Category<select data-reference-feature-group><option value="All">All categories</option>${FEATURE_GROUPS.map(group=>`<option>${esc(group)}</option>`).join('')}</select></label><label class="form-field" data-reference-feature-filter hidden>Feat source<select data-reference-feature-source>${featSourceOptions(settings)}</select></label><label class="form-field full">Choose an entry<select data-reference-entry></select></label></div><p class="form-help" data-reference-count aria-live="polite"></p><div class="catalog-preview" data-reference-preview aria-live="polite"></div></div></section>`;
}
export function updateCatalogBrowser(root,reset=false,settings={}) {
  const kind=root.querySelector('[data-reference-kind]')?.value;if(!kind)return;
  let [entries,previewKind]=['Features & resources','Feats','Origin feats'].includes(kind)?[FEATURE_CATALOG.filter(entry=>kind==='Feats'?isFeat(entry):kind==='Origin feats'?entry.group==='Origin feats':true),'feature']:kind==='Classes'?[CLASS_OPTIONS,'class']:kind==='Species / races'?[SPECIES,'race']:kind==='Backgrounds'?[BACKGROUNDS,'background']:kind==='Subclasses'?[SUBCLASSES,'subclass']:kind==='Magic items'?[MAGIC_ITEMS,'item']:[EQUIPMENT,'item'];
  entries=visibleContent(entries,settings,previewKind);
  const total=entries.length;
  root.querySelectorAll('[data-reference-item-filter]').forEach(node=>node.hidden=previewKind!=='item');
  root.querySelectorAll('[data-reference-search-filter]').forEach(node=>node.hidden=!['item','feature'].includes(previewKind));
  root.querySelectorAll('[data-reference-feature-filter]').forEach(node=>node.hidden=previewKind!=='feature');
  if(previewKind==='feature'){
    const groupSelect=root.querySelector('[data-reference-feature-group]'),groups=kind==='Feats'?FEAT_GROUPS:kind==='Origin feats'?['Origin feats']:FEATURE_GROUPS;
    const previous=groupSelect.value;
    groupSelect.innerHTML='<option value="All">All categories</option>'+groups.map(group=>`<option>${esc(group)}</option>`).join('');
    groupSelect.value=groups.includes(previous)?previous:'All';
    const matches=new Set(filterFeatures({scope:'all',query:root.querySelector('[data-reference-search]').value,group:groupSelect.value,source:root.querySelector('[data-reference-feature-source]').value}).map(entry=>entry.id));
    entries=entries.filter(entry=>matches.has(entry.id));
  }
  if(previewKind==='item')entries=filterEquipment(entries,{query:root.querySelector('[data-reference-search]').value,rarity:root.querySelector('[data-reference-rarity]').value,edition:root.querySelector('[data-reference-edition]').value});
  root.querySelector('[data-reference-count]').textContent=`${entries.length} of ${total} entries shown.`;
  const select=root.querySelector('[data-reference-entry]');
  if(reset){const previous=select.value;select.innerHTML=previewKind==='item'?pickerOptions(entries,previous,'item',false):previewKind==='feature'?featureOptions(entries,previous):options(entries,previous);}
  const entry=entries.find(entry=>(entry.id||entry.name)===select.value);
  root.querySelector('[data-reference-preview]').innerHTML=previewKind==='feature'?(entry?`<strong>${esc(entry.name)}</strong><p>${esc(entry.group)} · ${esc(featureSource(entry))}</p><p>${esc(featureRequirements(entry))}</p><p>${esc(entry.details)}</p><a class="text-btn" href="${esc(entry.wiki)}" target="_blank" rel="noopener noreferrer">Read the rules ↗</a>`:'<p>Choose a feature or resource. Use Add feature on your sheet for character-specific defaults.</p>'):statPreview(entry,previewKind);
}
