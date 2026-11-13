// Audit wiki rest interactions and compile names/timing facts, never full rule text.
// node scripts/build-rest-references.mjs --download refreshes the ignored research cache.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {SUBCLASSES} from '../catalog.js';
import {LEGACY_SUBCLASSES,SUBCLASS_ROWS} from '../progression-options.js';
const root=resolve(import.meta.dirname,'..'),cache=resolve(root,'.tmp/rest-wiki');
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const slug=s=>s.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-');
const clean=s=>s.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&(?:#8217|rsquo);/g,'’').replace(/&(?:#8211|ndash);/g,'–').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
function parse(html){
 const body=(html.split('<div id="page-content">')[1]||'').split('<div class="page-tags">')[0];
 const blocks=body.split(/(?=<h[1-6]\b)/i).map(block=>({heading:clean(block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]||''),text:clean(block)})).filter(b=>/long rest|dawn|daily|each day/i.test(b.text));
 return {body,blocks,title:clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'')};
}
async function download(){
 await mkdir(cache,{recursive:true});
 const base='https://dnd2024.wikidot.com',queue=['/'],seen=new Set(queue),data=[];
 const allowed=p=>/^\/(?:artificer|barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard|species|feat|feats|spell|spells|equipment|magic-item|rules-glossary|misc|invocation|eldritch-invocation|background)(?::|\/|$)/.test(p)&&!/(?:^\/|:)(?:ua|homebrew)(?:-|:|$)/.test(p);
 while(queue.length){
  await Promise.all(queue.splice(0,6).map(async path=>{
   const response=await fetch(base+path,{signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error(`Wiki audit failed: ${path} (${response.status})`);
   const html=await response.text(),parsed=parse(html);
   await writeFile(resolve(cache,encodeURIComponent(path).replace(/%/g,'_')+'.html'),html);
   for(const match of parsed.body.matchAll(/href="([^"#?]+)(?:[?#][^"]*)?"/g)){
    const p=match[1].replace(base,'');if(allowed(p)&&!seen.has(p)){seen.add(p);queue.push(p);}
   }
   data.push({path,title:parsed.title,blocks:parsed.blocks});
  }));
  if(data.length%120===0)console.log(`${data.length} pages audited`);
 }
 const pairs=LEGACY_SUBCLASSES.map(s=>[s.className,s.name]);
 pairs.push(['Artificer','main'],...['Alchemist','Armorer','Artillerist','Battle Smith'].map(n=>['Artificer',n]));
 const legacy=[];
 for(let start=0;start<pairs.length;start+=6)await Promise.all(pairs.slice(start,start+6).map(async([cls,name])=>{
  const part=cls==='Wizard'?name.replace(/^School of /,'').replace(/^(Chronurgy|Graviturgy) Magic$/,'$1'):name.replace(/^(?:Path of (?:the )?|College of |Circle of (?:the )?|Way of (?:the )?|Oath of (?:the )?)/,'').replace(/ (?:Domain|Patron)$/,'');
  const path='/'+cls.toLowerCase()+(name==='main'?'':':'+(name==='Purple Dragon Knight'?'banneret':slug(part)));
  const url='https://dnd5e.wikidot.com'+path,response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Legacy audit failed: ${url} (${response.status})`);
  const html=await response.text();legacy.push({path,className:cls,subclass:name==='main'?'':name,url,status:response.status,blocks:parse(html).blocks});
 }));
 await writeFile(resolve(cache,'audit.json'),JSON.stringify(data,null,2));
 await writeFile(resolve(cache,'legacy.json'),JSON.stringify(legacy,null,2));
 await writeFile(resolve(cache,'audit-date.json'),JSON.stringify({date:new Date().toISOString().slice(0,10)}));
}
if(process.argv.includes('--download'))await download();
let data,legacy;
try {data=JSON.parse(await readFile(resolve(cache,'audit.json'),'utf8'));legacy=JSON.parse(await readFile(resolve(cache,'legacy.json'),'utf8'));}
catch {throw new Error('Run node scripts/build-rest-references.mjs --download to populate the research cache.');}
const title=r=>r.title.replace(/ - D&D 5e \(2024\)$/,'');
const rows=[];
function add(r,b,extra={}){
 if(!/long rest|dawn|daily|each day/i.test(b.text))return;
 const name=b.heading.replace(/^Level \d+:\s*/i,'')||title(r);
 if(!name||/Variant|Table|^common|Features$|Traits$|Lineages$/.test(name))return;
 const interactions=(b.text.match(/[^.!?]*\b(?:long rest|short rest|short or long rest|dawn)\b[^.!?]*[.!?]?/gi)||[]).join(' ');
 const kind=/dawn/i.test(b.text)&&!/long rest/i.test(b.text)?'dawn':/\b(?:1d4|2d4|seven|7|several) (?:days|long rests)\b/i.test(b.text)?'cooldown':/\b(?:replace|choose|change|roll|create|produce|imbue|vanish|disappear|lasts until|temporary hit points|heroic inspiration|resets to)\b/i.test(interactions)?'review':'recovery';
 const level=Number(b.heading.match(/^Level (\d+):/i)?.[1]||extra.level||1);
 rows.push({name,level,short:/short (?:or long )?rest/i.test(b.text),kind,wiki:r.url||'https://dnd2024.wikidot.com'+r.path,...extra,...(extra.category==='item'&&/dawn/i.test(b.text)?{dawn:true}:{})});
}
for(const r of data){
 const match=r.path.match(/^\/(artificer|barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard):(.+)$/);
 if(match){
  // Keep the app's earlier Artificer; new subclass names remain explicit references.
  const className=match[1][0].toUpperCase()+match[1].slice(1);
  if(match[1]==='artificer'&&(match[2]==='main'||SUBCLASSES.some(s=>s.className===className&&norm(s.name)===norm(title(r)))))continue;
  if(match[2]==='main')for(const b of r.blocks)add(r,b,{className,implicit:true});
  else if(match[2]==='eldritch-invocation')for(const b of r.blocks)add(r,b,{category:'feature'});
  else {const subclass=SUBCLASSES.find(s=>s.className===className&&norm(s.name)===norm(title(r)))?.name||title(r);for(const b of r.blocks)add(r,b,{className,subclass,implicit:true});}
 } else if(/^\/(?:feat|spell|magic-item|species):/.test(r.path)&&!/:all$|:crafting$/.test(r.path)&&r.blocks.length){
  const category=r.path.startsWith('/feat:')?'feature':r.path.startsWith('/spell:')?'spell':r.path.startsWith('/species:')?'species':'item';
  add(r,{heading:title(r),text:r.blocks.map(b=>b.text).join(' ')},{category});
 }
}
for(const r of legacy.filter(r=>r.status===200))for(const b of r.blocks){
 const entry=LEGACY_SUBCLASSES.find(s=>s.name===r.subclass);
 const levels=(entry?.rows||SUBCLASS_ROWS[r.subclass]||[]).flatMap(([level,...names])=>names.map(name=>({name,level})));
 const name=b.heading.replace(/\s*\(.*\)$/,'');
 const level=levels.find(v=>norm(v.name)===norm(name))?.level||Number(b.text.match(/(?:at|At|Beginning at|Starting at) (\d+)(?:st|nd|rd|th) level/)?.[1])||1;
 add({...r,title:r.subclass||r.className},{...b,heading:name},{className:r.className,subclass:r.subclass,level,implicit:!!r.subclass||r.className==='Artificer',legacy:true});
}
const references=[...new Map(rows.map(r=>[r.wiki+'#'+r.name,r])).values()].sort((a,b)=>(a.wiki+'#'+a.name).localeCompare(b.wiki+'#'+b.name));
const auditDate=await readFile(resolve(cache,'audit-date.json'),'utf8').then(value=>JSON.parse(value).date).catch(()=>'2026-11-13');
const audit={date:auditDate,pages:data.length+legacy.length,references:references.length};
await writeFile(resolve(root,'rest-reference-data.js'),'// Names and rest timing facts; generated by scripts/build-rest-references.mjs.\n// Original reminder summaries live in rest-rules.js; see docs/rest-reminders.md.\nexport const REST_AUDIT = '+JSON.stringify(audit)+';\nexport const REST_REFERENCES = [\n'+references.map(r=>'  '+JSON.stringify(r)).join(',\n')+'\n];\n');
console.log(`${audit.pages} wiki pages audited; ${references.length} rest references compiled.`);
