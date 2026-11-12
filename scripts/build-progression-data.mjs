// Rebuild the bundled rules facts: node scripts/build-progression-data.mjs --download
// SRD text is CC BY 4.0; see docs/level-up.md for attribution and scope.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'.tmp/rules');
await mkdir(dir,{recursive:true});
if(process.argv.includes('--download')){
  for(const edition of ['2024','2014'])for(const kind of ['Spells','Levels']){
    const response=await fetch(`https://raw.githubusercontent.com/5e-bits/5e-database/main/src/${edition}/en/5e-SRD-${kind}.json`);
    if(!response.ok)throw new Error(`SRD download: ${response.status}`);
    await writeFile(resolve(dir,`${edition}-${kind}.json`),await response.text());
  }
  const response=await fetch('https://www.dndbeyond.com/sources/dnd/br-2024/character-classes');
  if(!response.ok)throw new Error(`Class list download: ${response.status}`);
  await writeFile(resolve(dir,'classes.html'),await response.text());
  for(const cls of ['Bard','Cleric','Druid','Paladin','Ranger','Sorcerer','Warlock','Wizard']){
    const response=await fetch(`https://roll20.net/compendium/dnd5e/Classes%3A${cls}?expansion=32231`);
    if(!response.ok)throw new Error(`PHB class list download: ${response.status}`);
    await writeFile(resolve(dir,`phb-${cls}.html`),await response.text());
  }
}
const read=async name=>JSON.parse(await readFile(resolve(dir,name),'utf8'));
const normal=s=>s.toLowerCase().replace(/[’'\uFFFD]/g,'').replace(/[^a-z0-9]/g,'');
const aliases={'brandingsmite':'shiningsmite','feeblemind':'befuddlement',hand:'arcanehand',sword:'arcanesword',magicaura:'arcanistsmagicaura'};
const key=s=>{const n=normal(s).replace(/^(bigbys|drawmijs|evards|leomunds|melfs|mordenkainens|nystuls|otilukes|ottos|rarys|tashas|tensers)/,'');return aliases[n]||n;};
const spells=new Map();
for(const edition of ['2014','2024'])for(const s of await read(`${edition}-Spells.json`)){
  spells.set(key(s.name),{id:key(s.name),name:s.name,level:s.level,school:s.school.name,classes:s.classes.map(c=>c.name),castingTime:s.casting_time,range:s.range,duration:s.duration,concentration:s.concentration,ritual:s.ritual,notes:[s.description||s.desc?.join('\n'),Array.isArray(s.higher_level)?s.higher_level.join('\n'):s.higher_level,`Components: ${s.components.join(', ')}${s.material?` (${s.material})`:''}`].filter(Boolean).join('\n\n'),source:edition,wiki:`https://www.dndbeyond.com/sources/dnd/br-${edition}/spell-descriptions`});
}
const html=await readFile(resolve(dir,'classes.html'),'utf8');
const strip=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#(?:39|x27);|&rsquo;/g,"'").replace(/&nbsp;/g,' ').trim();
for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)){
  const match=table[1].match(/id="(?:CantripsLevel0|Level([1-9]))(Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Warlock|Wizard)Spells"/);
  if(!match)continue;
  const level=Number(match[1]||0),cls=match[2];
  for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
    if(cells.length<2)continue;
    const name=strip(cells[0]),id=key(name),existing=spells.get(id);
    if(existing){if(!existing.classes.includes(cls))existing.classes.push(cls);continue;}
    const href=cells[0].match(/href="([^"]+)"/)?.[1];
    spells.set(id,{id,name:name.replace(/\uFFFD/g,'’'),level,school:strip(cells[1]),classes:[cls],castingTime:'See spell rules',range:'See spell rules',duration:'See spell rules',concentration:/\bC\b/.test(strip(cells[2]||'')),ritual:/\bR\b/.test(strip(cells[2]||'')),notes:'2024 Player’s Handbook spell reference. Consult the linked spell for casting details and effects.',source:'2024',wiki:href?.startsWith('http')?href:`https://www.dndbeyond.com${href||'/sources/dnd/phb-2024/spells'}`});
  }
}
const levels=(await read('2024-Levels.json')).filter(l=>!l.subclass).map(l=>({className:l.class.name,level:l.level,features:l.features.map(f=>f.name),cantrips:l.spellcasting?.cantrips_known||0,prepared:l.spellcasting?.prepared_spells||0,slots:Array.from({length:9},(_,i)=>l.spellcasting?.[`spell_slots_level_${i+1}`]||0),specific:l.class_specific||{}}));
// Free class lists omit paid-book spells. Use the licensed PHB lists to supply
// complete class membership, names, levels and schools, without copying book text.
for(const s of spells.values())if(s.source==='2024')s.classes=[];
for(const cls of ['Bard','Cleric','Druid','Paladin','Ranger','Sorcerer','Warlock','Wizard']){
  const page=await readFile(resolve(dir,`phb-${cls}.html`),'utf8');
  const tables=[...page.matchAll(/<h6>(Cantrips \(Level 0 (?:\w+ )?Spells\)|Level ([1-9]) \w+ Spells)<\/h6>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/g)];
  if(tables.length!==(cls==='Paladin'||cls==='Ranger'?5:10))throw new Error(`Incomplete PHB spell tables: ${cls}`);
  for(const [,heading,tier,table] of tables)for(const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
    const cells=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);if(cells.length<2)continue;
    const name=strip(cells[0]),id=key(name),level=Number(tier||0);
    let entry=spells.get(id);
    if(!entry){entry={id,name,level,school:strip(cells[1]),classes:[],castingTime:'See spell rules',range:'See spell rules',duration:'See spell rules',concentration:/\bC\b/.test(strip(cells[2]||'')),ritual:/\bR\b/.test(strip(cells[2]||'')),notes:'2024 Player’s Handbook spell reference. Consult the linked spell for casting details and effects.',source:'2024',wiki:cells[0].match(/href="([^"]+)"/)?.[1]||'https://www.dndbeyond.com/sources/dnd/phb-2024/spells'};spells.set(id,entry);}
    if(!entry.classes.includes(cls))entry.classes.push(cls);
  }
}
// The publisher's tables are authoritative. In particular, the community JSON
// currently understates Wizard preparation and some Sorcerer progression.
for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)){
  const cls=table[1].match(/id="(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard)Features"/)?.[1];
  if(!cls)continue;
  const heads=[...(table[1].match(/<thead>([\s\S]*?)<\/thead>/)?.[1]||'').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].at(-1)?.[1]||'';
  const headers=[...heads.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>strip(m[1]));
  for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
    const level=Number(strip(cells[0]||''));if(!level)continue;
    const data=levels.find(l=>l.className===cls&&l.level===level);
    const numeric=heading=>Number(strip(cells[headers.indexOf(heading)]||''))||0;
    if(headers.includes('Prepared Spells'))data.prepared=numeric('Prepared Spells');
    if(headers.includes('Cantrips'))data.cantrips=numeric('Cantrips');
    if(cls==='Warlock'){data.slots=Array(9).fill(0);data.slots[numeric('Slot Level')-1]=numeric('Spell Slots');}
    else if(headers.includes('1'))data.slots=Array.from({length:9},(_,i)=>numeric(String(i+1)));
    for(const [label,key] of [['Eldritch Invocations','eldritch_invocations'],['Weapon Mastery','weapon_mastery']])if(headers.includes(label))data.specific[key]=numeric(label);
    const featureCell=cells[headers.indexOf('Class Features')]||'';
    data.features=[...featureCell.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(m=>strip(m[1]));
  }
}
for(const [name,level,school,classes,source] of [
  ['Summon Construct',4,'Conjuration',['Wizard'],'2024'],
  ['Catnap',3,'Enchantment',['Artificer','Bard','Sorcerer','Wizard'],'2014'],
  ['Elemental Bane',4,'Transmutation',['Artificer','Druid','Warlock','Wizard'],'2014'],
  ['Flame Arrows',3,'Transmutation',['Artificer','Druid','Ranger','Sorcerer','Wizard'],'2014'],
  ['Tiny Servant',3,'Transmutation',['Artificer','Wizard'],'2014'],
  ['Skill Empowerment',5,'Transmutation',['Artificer','Bard','Sorcerer','Wizard'],'2014'],
  ['Transmute Rock',5,'Transmutation',['Artificer','Druid','Wizard'],'2014']
])if(!spells.has(key(name)))spells.set(key(name),{id:key(name),name,level,school,classes,castingTime:'See spell rules',range:'See spell rules',duration:'See spell rules',concentration:['Elemental Bane','Flame Arrows','Skill Empowerment'].includes(name),ritual:false,notes:'Supplemental spell reference; consult your book for casting details and effects.',source,wiki:source==='2024'?'https://www.dndbeyond.com/sources/dnd/phb-2024/spells':'https://www.dndbeyond.com/sources/dnd/xgte/spells'});
if(levels.length!==240)throw new Error(`Expected 240 core class levels, got ${levels.length}`);
for(const name of ['Witch Bolt','Cloud of Daggers','Crown of Madness'])spells.get(key(name)).castingTime='Action';
spells.get(key('Arcane Vigor')).castingTime='Bonus Action';
const header='// Generated by scripts/build-progression-data.mjs. SRD 5.2/5.1: CC BY 4.0.\n';
await writeFile(resolve(root,'progression-data.js'),header+`export const CLASS_LEVELS=${JSON.stringify(levels)};\nexport const SPELL_CATALOG=${JSON.stringify([...spells.values()].sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)))};\n`);
console.log(`Bundled ${levels.length} class levels and ${spells.size} spells.`);
