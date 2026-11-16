// Optional network refresh. Ordinary builds consume the checked-in snapshot.
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const cache=resolve(root,'.cache/presets');
const decode=s=>s.replace(/&#0?39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
export async function cachedFetch(url,{refresh=false,headers={},delay=350}={}) {
  const {createHash}=await import('node:crypto');
  const file=resolve(cache,createHash('sha256').update(url).digest('hex'));
  if(!refresh){try{return await fs.readFile(file,'utf8');}catch{}}
  await new Promise(r=>setTimeout(r,delay));
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
  const text=await response.text();
  await fs.mkdir(cache,{recursive:true});await fs.writeFile(file,text);return text;
}
export function parseSetList(html){
  return [...html.matchAll(/<tr\b[^>]*[\s\S]*?<\/tr>/g)].flatMap(([row])=>{
    const id=row.match(/href="https:\/\/library.ldraw.org\/omr\/sets\/(\d+)"/)?.[1];
    const cells=[...row.matchAll(/fi-ta-text fi-ta-text-item fi-size-sm[^>]*>(.*?)<\/div>/g)].map(m=>decode(m[1]));
    return id&&cells.length>=4?[{id,number:cells[0],name:cells[1],theme:cells[2],year:Number(cells[3])}]:[];
  });
}
export async function importOMR({refresh=false}={}){
  const first=await cachedFetch('https://library.ldraw.org/omr/sets',{refresh});
  const pages=Math.max(...[...first.matchAll(/gotoPage\((\d+),/g)].map(m=>Number(m[1])));
  const sets=parseSetList(first);
  for(let page=2;page<=pages;page++){
    sets.push(...parseSetList(await cachedFetch(`https://library.ldraw.org/omr/sets?page=${page}`,{refresh})));
    if(page%10===0)console.log(`OMR index ${page}/${pages}`);
  }
  // Discovery spans every source theme. Assembly compatibility is evaluated
  // downstream without a theme allowlist.
  const wanted=sets;
  const models=[];
  for(const [i,set] of wanted.entries()){
    const page=await cachedFetch(`https://library.ldraw.org/omr/sets/${set.id}`,{refresh});
    const links=[...new Set([...page.matchAll(/href="([^"]+)"/g)].map(m=>decode(m[1])).filter(u=>/\.(mpd|ldr)(\?|$)/i.test(u)))];
    // Main and alternate models can share figures; catalog generation deduplicates them.
    for(const url of links){
      const text=await cachedFetch(new URL(url,'https://library.ldraw.org').href,{refresh});
      const modelLicense=text.match(/^0 !LICENSE (.*)$/mi)?.[1]||'';
      if(!/^(?:Licensed under CC BY (?:2\.0 and CC BY )?4\.0|Redistributable under CCAL version 2\.0|Licensed under CC BY 2\.0)/i.test(modelLicense))continue;
      const sourceWarnings=['Parts','Patterns','Stickers'].filter(label=>new RegExp(`Missing ${label}</span><br>\\s*Yes`).test(page)).map(label=>`Source OMR model reports missing ${label.toLowerCase()}; retail inventory accuracy requires review.`);
      models.push({...set,sourceWarnings,url:new URL(url,'https://library.ldraw.org').href,text});
    }
    if(i%10===0)console.log(`OMR models ${i+1}/${wanted.length}, ${models.length} files`);
  }
  const out=resolve(root,'.cache/presets/omr-models.json');
  await fs.writeFile(out,JSON.stringify(models));console.log(`Saved ${models.length} licensed models to ${out}`);
}
export async function importRebrickable(ids,{refresh=false,search=''}={}){
  const key=process.env.REBRICKABLE_API_KEY;
  if(!key){console.log('Rebrickable skipped: set REBRICKABLE_API_KEY for an optional refresh.');return;}
  const results=[];
  const get=async path=>{
    if(!path||/^[a-z]+:|^\//i.test(path))throw new Error('Invalid API pagination path');
    return JSON.parse(await cachedFetch(`https://rebrickable.com/api/v3/lego/${path}`,{refresh,delay:1100,headers:{Authorization:`key ${key}`}}));
  };
  const nextPath=url=>{
    if(!url)return null;
    const next=new URL(url,'https://rebrickable.com');
    if(next.origin!=='https://rebrickable.com'||!next.pathname.startsWith('/api/v3/lego/'))throw new Error('Unexpected API pagination origin');
    return next.pathname.slice('/api/v3/lego/'.length)+next.search;
  };
  if(search){
    let path=`minifigs/?page_size=100&search=${encodeURIComponent(search)}`;
    while(path){const data=await get(path);if(!Array.isArray(data.results))throw new Error('Invalid API catalog response');ids.push(...data.results.map(p=>p.set_num));path=nextPath(data.next);}
  }
  if(!ids.length)throw new Error('Pass fig- IDs or --search followed by an exact name/theme search.');
  ids=[...new Set(ids)];
  for(const id of ids){
    if(!/^fig-\d+$/.test(id))throw new Error(`Invalid minifigure ID: ${id}`);
    const fig=await get(`minifigs/${id}/`);let url=`minifigs/${id}/parts/?page_size=1000`;const parts=[];
    while(url){const data=await get(url);if(!Array.isArray(data.results))throw new Error('Invalid API inventory response');parts.push(...data.results);url=nextPath(data.next);}
    for(const entry of parts){
      if(!entry.part?.external_ids?.LDraw)entry.part=await get(`parts/${encodeURIComponent(entry.part.part_num)}/`);
      if(!entry.color?.external_ids?.LDraw)entry.color=await get(`colors/${Number(entry.color.id)}/`);
    }
    results.push({id,name:fig.name,url:`https://rebrickable.com/minifigs/${id}/`,parts});
  }
  await fs.mkdir(cache,{recursive:true});
  await fs.writeFile(resolve(cache,'rebrickable.json'),JSON.stringify(results,null,2)+'\n');
  const destination=resolve(root,'vendor/bricktrait/presets/sources/rebrickable-inventories.json');
  await fs.mkdir(resolve(destination,'..'),{recursive:true});
  const existing=JSON.parse(await fs.readFile(destination,'utf8').catch(()=>'[]'));
  await fs.writeFile(destination,JSON.stringify([...new Map([...existing,...results].map(p=>[p.id,p])).values()].sort((a,b)=>a.id.localeCompare(b.id)),null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),refresh=args.includes('--refresh'),searchIndex=args.indexOf('--search');
  if(args.includes('--omr'))await importOMR({refresh});
  else await importRebrickable(args.filter((arg,i)=>!arg.startsWith('--')&&(searchIndex<0||i!==searchIndex+1)),{refresh,search:searchIndex>=0?args[searchIndex+1]||'':''});
}
