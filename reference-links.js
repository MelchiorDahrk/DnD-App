import {PAGES_2014,PAGES_2024} from './reference-pages.js';

export const RULES_URL='https://dnd2024.wikidot.com';
export const LEGACY_RULES_URL='https://dnd5e.wikidot.com';
// Wikidot has no general rules glossary. This publisher reference is freely readable.
const GLOSSARY_URL='https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary';
const classes=['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const normal=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const pages={'2014':PAGES_2014,'2024':PAGES_2024};
const indexes=Object.fromEntries(Object.entries(pages).map(([edition,paths])=>[edition,new Map(paths.map(path=>[normal(path),path]))]));
const base=edition=>edition==='2014'?LEGACY_RULES_URL:RULES_URL;
const pathFor=(path,edition)=>indexes[edition].get(normal(path));
const knownURL=(path,edition)=>{const found=pathFor(path,edition);return found?base(edition)+found:'';};
const spellAliases={arcanehand:'bigbyshand',arcanesword:'mordenkainenssword',arcanistsmagicaura:'nystulsmagicaura',acidarrow:'melfsacidarrow',blacktentacles:'evardsblacktentacles',floatingdisk:'tensersfloatingdisk',faithfulhound:'mordenkainensfaithfulhound',instantsummons:'drawmijsinstantsummons',magnificentmansion:'mordenkainensmagnificentmansion',privatesanctum:'mordenkainensprivatesanctum',resilientsphere:'otilukesresilientsphere',secretchest:'leomundssecretchest',tinyhut:'leomundstinyhut',hideouslaughter:'tashashideouslaughter',irresistibledance:'ottosirresistibledance',telepathicbond:'rarystelepathicbond'};
spellAliases.freezingsphere='otilukesfreezingsphere';

export function safeURL(url){
  try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}
}
export function subclassURL(name,className,edition='2024'){
  edition=edition==='2014'||className==='Artificer'?'2014':'2024';
  let part=String(name||'');
  if(edition==='2014')part=part.replace(/^(?:Path of (?:the )?|College of |Circle of (?:the )?|Way of (?:the )?|Oath of (?:the )?|School of )/i,'').replace(/ (?:Domain|Patron|Magic)$/i,'');
  if(normal(part)==='purpledragonknight')part='banneret';
  const candidates=className?[className]:classes;
  for(const cls of candidates){const url=knownURL(`${cls}:${part}`,edition);if(url)return url;}
  return className?wikiURL(className,'class',edition):base(edition);
}
export function wikiURL(label,category='',edition='2024'){
  edition=edition==='2014'?'2014':'2024';
  const key=normal(label),kind=normal(category),cls=classes.find(name=>normal(name)===key);
  const indexPaths={classes:'/',spells:'spell:all',weapons:'equipment:weapon',armor:'equipment:armor',equipment:'equipment:all',adventuringgear:'equipment:adventuring-gear',tools:'equipment:tool',mounts:'equipment:mounts-and-vehicles',wondrousitems:'magic-item:all',backgrounds:'background:all',species:'species:all',feats:'feat:all'};
  const olderPaths={spells:'spells',weapons:'weapons',armor:'armor',equipment:'adventuring-gear',adventuringgear:'adventuring-gear',tools:'tools',mounts:'mounts-vehicles',wondrousitems:'wondrous-items',species:'lineage'};
  const indexURL=kind=>base(edition)+'/'+(edition==='2014'?olderPaths[kind]||'':indexPaths[kind]||'');
  if(kind==='spell'){
    const alias=spellAliases[key]||key;
    return knownURL('spell:'+alias,edition)||knownURL('spell:'+key,edition)||indexURL('spells');
  }
  if(cls){const current=cls==='Artificer'?'2014':edition;return base(current)+'/'+cls.toLowerCase()+(current==='2024'?':main':'');}
  if(classes.some(name=>normal(name)===kind))return subclassURL(label,classes.find(name=>normal(name)===kind),edition);
  if(kind==='subclass')return subclassURL(label,'',edition);
  if(kind==='feat'){
    const name=String(label).replace(/^Fighting Style:\s*/i,'').replace(/\s*\(.*\)$/,'');
    if(edition==='2014'&&normal(name)==='dwarvenfortitude')return knownURL('feat:dwarven-resilience',edition);
    return knownURL('feat:'+name,edition)||knownURL(name,edition)||indexURL('feats');
  }
  if(kind==='background')return knownURL('background:'+label,edition)||knownURL(label,edition)||indexURL('backgrounds');
  if(kind==='species'||kind==='race'){
    const family=edition==='2024'?/elf|drow/i.test(label)?'Elf':/gnome/i.test(label)?'Gnome':/tiefling/i.test(label)?'Tiefling':label:label;
    return knownURL((edition==='2014'?'lineage:':'species:')+family,edition)||knownURL(family,edition)||indexURL('species');
  }
  if(kind==='equipment'||kind==='item')return knownURL('magic-item:'+label,edition)||knownURL('wondrous-items:'+label,edition)||indexURL('equipment');
  if(['rules','conditions'].includes(kind||key))return GLOSSARY_URL;
  if(indexPaths[kind||key])return indexURL(kind||key);
  return base(edition);
}

// Resolve old built-in publisher links at display time; backups and custom links stay intact.
export function referenceURL(url,label,category=''){
  if(!url)return wikiURL(label,category);
  const safe=safeURL(url);if(!safe)return '';
  const parsed=new URL(safe),host=parsed.hostname.replace(/^www\./,'');
  if(host!=='dndbeyond.com')return safe;
  const path=parsed.pathname;
  const posts={'/posts/323-a-light-in-the-darkness-playing-a-drow-character':LEGACY_RULES_URL+'/lineage:elf','/posts/915-barbarian-101-path-of-the-beast-from-tashas':LEGACY_RULES_URL+'/barbarian:beast'};
  if(posts[path])return posts[path];
  if(!/^\/(?:sources\/dnd\/|spells(?:\/|$)|feats(?:\/|$)|classes(?:\/|$)|backgrounds(?:\/|$)|equipment(?:\/|$)|magic-items(?:\/|$))/.test(path))return safe;
  if(path.startsWith('/sources/dnd/')&&!/^\/sources\/dnd\/(?:br-2024|br-2014|basic-rules-2014|phb-2024|phb-2014|dmg-2024|mm-2024|xgte|tcoe|scag|vrgtr|egtw|ftod|dsotdq)(?:\/|$)/.test(path))return safe;
  const edition=/2014|\/br-2014\b|\/(?:xgte|tcoe|scag|vrgtr|egtw|ftod|dsotdq)(?:\/|$)/.test(path)?'2014':'2024';
  let fragment=parsed.hash.slice(1);try{fragment=decodeURIComponent(fragment);}catch{}
  const destination=path.match(/^\/(?:spells|feats|backgrounds|equipment|magic-items)\/(.+)$/)?.[1]?.replace(/^\d+-/,'')||label;
  if(/\/spells(?:\/|$)|\/spell-descriptions/.test(path))return wikiURL(destination,'spell',edition);
  if(/\/feats(?:\/|$)/.test(path))return wikiURL(destination,'feat',edition);
  if(/\/backgrounds(?:\/|$)/.test(path))return wikiURL(destination,'background',edition==='2024'&&/folk.hero/i.test(path)?'2014':edition);
  if(/\/character-origins|\/races(?:\/|$)/.test(path)){
    const species=knownURL((edition==='2014'?'lineage:':'species:')+fragment,edition)||knownURL('background:'+fragment,edition);
    return species||wikiURL(label,category==='background'?'background':'species',edition);
  }
  if(/\/character-classes|\/classes(?:\/|$)/.test(path)){
    const cls=classes.find(name=>normal(name)===normal(fragment));
    if(cls)return wikiURL(cls,'class',edition);
    if(fragment)return subclassURL(fragment,'',edition);
    return wikiURL(label,category,edition);
  }
  if(/\/equipment(?:\/|$)|\/magic-items(?:\/|$)/.test(path)){
    const sections={weapons:'weapons',armor:'armor',adventuringgear:'adventuring-gear'};
    return sections[normal(fragment)]?wikiURL(sections[normal(fragment)],'',edition):wikiURL(label,category||'equipment',edition);
  }
  if(category==='spell'||category==='feat'||category==='background')return wikiURL(label,category,edition);
  if(/\/rules-glossary$/.test(path))return safe;
  // Earlier subclass/feat references often pointed to an entire sourcebook.
  const feat=wikiURL(label,'feat',edition);
  if(/\/feat:(?!all$)/.test(feat))return feat;
  const subclass=subclassURL(label,'',edition);if(subclass!==base(edition))return subclass;
  const fallback=wikiURL(label,category,edition);
  return fallback===base(edition)?safe:fallback;
}
