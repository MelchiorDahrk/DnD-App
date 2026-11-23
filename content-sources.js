import {EQUIPMENT,CLASS_OPTIONS,SPECIES,BACKGROUNDS,SUBCLASSES} from './catalog.js';
import {FEATURE_CATALOG,FEAT_SOURCES} from './feature-catalog.js';
import {SPELL_CATALOG} from './progression-data.js';

const key=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const phb2024='Player’s Handbook (2024)',phb2014='Player’s Handbook (2014)';
const earlier='Other earlier character options';
const titles=new Map(FEAT_SOURCES.map(title=>[key(title),title]));
for(const title of [phb2024,phb2014,'Dungeon Master’s Guide (2024)',earlier])titles.set(key(title),title);

function sourceTitle(value,edition='2024') {
  const title=value.trim().replace(/^Source:\s*/i,'').replace(/\.$/,'');
  const normalized=key(title);
  if(/^playershandbook(?:2014|2024)?$/.test(normalized))return edition==='2014'||normalized.endsWith('2014')?phb2014:phb2024;
  if(/^dungeonmastersguide(?:2014|2024)?$/.test(normalized))return `Dungeon Master’s Guide (${normalized.endsWith('2014')?'2014':edition})`;
  if(/^(?:dd|dnd)beyonddrops/.test(normalized))return 'D&D Beyond Drops';
  return titles.get(normalized)||title.replace(/ - /g,': ');
}

// Source records from different catalogs use different punctuation and sometimes
// name more than one book. A shared entry is visible if any of its books is on.
export function contentSourceTitles(entry,kind='feature') {
  if(entry.source==='Custom'||entry.group==='Custom resources')return [];
  if(entry.book)return [sourceTitle(entry.book,entry.edition)];
  if(kind==='race'&&['Half-Elf','Half-Orc'].includes(entry.name))return [phb2014];
  if(entry.className==='Artificer'||entry.name==='Artificer'||entry.subclass==='Path of the Beast')return ['Tasha’s Cauldron of Everything'];
  if(entry.source==='2024 core'||entry.source==='2024')return [phb2024];
  if(entry.source==='2014')return [kind==='feature'&&entry.species?phb2014:earlier];
  if(entry.source==='Supplemental / earlier book')return [earlier];
  if(!entry.source)return [phb2024];
  // One upstream record appends its rules to the source line.
  let source=entry.source.split(/\s+This statuette\b/)[0];
  source=source.replace(/Lost Mine of Phandelver and Phandelver and Below\s*[:=]\s*The Shattered Obelisk/g,'Lost Mine of Phandelver; Phandelver and Below: The Shattered Obelisk');
  return [...new Set(source.split(/;|,\s*(?=World of Warcraft|Fizban's Treasury)/).filter(Boolean).map(title=>sourceTitle(title,entry.edition)))];
}

export const contentSourceIds=(entry,kind)=>contentSourceTitles(entry,kind).map(key);
const excludedSource=source=>source.includes('worldofwarcraft');
export function contentEnabled(entry,settings={},kind) {
  const sources=contentSourceIds(entry,kind),hidden=settings.hiddenSources||[];
  return !sources.some(excludedSource)&&(!sources.length||sources.some(source=>!hidden.includes(source)));
}
export const visibleContent=(entries,settings,kind)=>entries.filter(entry=>contentEnabled(entry,settings,kind));

const sourceTitles=new Set([earlier]);
for(const [entries,kind] of [[FEATURE_CATALOG,'feature'],[EQUIPMENT,'item'],[SPELL_CATALOG,'spell'],[CLASS_OPTIONS,'class'],[SPECIES,'race'],[BACKGROUNDS,'background'],[SUBCLASSES,'subclass']]){
  for(const entry of visibleContent(entries,{},kind))for(const title of contentSourceTitles(entry,kind))sourceTitles.add(title);
}
export const CONTENT_SOURCES=[...sourceTitles].map(label=>({id:key(label),label})).sort((a,b)=>a.label.localeCompare(b.label));
export const enabledFeatSources=settings=>FEAT_SOURCES.filter(book=>contentEnabled({book},settings));
