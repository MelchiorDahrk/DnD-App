// Public bulk catalog snapshots; no API key, runtime requests, or theme allowlist.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),cache=resolve(root,'.cache/presets/bulk');
export async function* csvRows(file){
  const stream=createReadStream(file).pipe(createGunzip());stream.setEncoding('utf8');
  let fields=[],value='',quoted=false,afterQuote=false,header;
  for await(const chunk of stream)for(const char of chunk){
    if(afterQuote){if(char==='"'){value+='"';afterQuote=false;continue;}quoted=false;afterQuote=false;}
    if(quoted){if(char==='"')afterQuote=true;else value+=char;continue;}
    if(char==='"'){quoted=true;continue;}
    if(char===','){fields.push(value);value='';continue;}
    if(char==='\n'){fields.push(value.replace(/\r$/,''));value='';if(!header)header=fields;else yield Object.fromEntries(header.map((k,i)=>[k,fields[i]??'']));fields=[];continue;}
    value+=char;
  }
  if(value||fields.length){fields.push(value);if(header)yield Object.fromEntries(header.map((k,i)=>[k,fields[i]??'']));}
}
const files=['minifigs','inventories','inventory_parts','inventory_minifigs','parts','colors','sets','themes','part_categories'];
export async function downloadBulk({refresh=false}={}){
  await fs.mkdir(cache,{recursive:true});
  const manifest={source:'https://rebrickable.com/downloads/',terms:'https://rebrickable.com/terms/',files:{}};
  // Bound concurrent requests and keep complete archives on interrupted refreshes.
  for(let start=0;start<files.length;start+=3){
    const results=await Promise.allSettled(files.slice(start,start+3).map(async name=>{
      const file=resolve(cache,name+'.csv.gz'),url=`https://cdn.rebrickable.com/media/downloads/${name}.csv.gz`;
      if(!refresh&&await fs.access(file).then(()=>true,()=>false))return;
      const r=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);
      const bytes=Buffer.from(await r.arrayBuffer());await fs.writeFile(file+'.next',bytes);await fs.rename(file+'.next',file);
      manifest.files[name]={url,sha256:createHash('sha256').update(bytes).digest('hex'),lastModified:r.headers.get('last-modified')};
      console.log(`Downloaded ${name}: ${(bytes.length/1e6).toFixed(2)} MB`);
    }));
    for(const result of results)if(result.status==='rejected')throw result.reason;
  }
  if(Object.keys(manifest.files).length)await fs.writeFile(resolve(cache,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
export async function importBulk({refresh=false,download=true}={}){
  if(download)await downloadBulk({refresh});
  const figs=new Map();for await(const row of csvRows(resolve(cache,'minifigs.csv.gz')))figs.set(row.fig_num,{id:row.fig_num,name:row.name,num_parts:Number(row.num_parts),sets:[],parts:[]});
  const inventories=new Map(),setInventories=new Map();
  for await(const row of csvRows(resolve(cache,'inventories.csv.gz'))){
    const target=figs.has(row.set_num)?inventories:setInventories;
    const previous=target.get(row.set_num);if(!previous||Number(row.version)>previous.version)target.set(row.set_num,{id:row.id,version:Number(row.version)});
  }
  const selected=new Map([...inventories].map(([id,inv])=>[inv.id,figs.get(id)]));
  const sets=new Map();for await(const row of csvRows(resolve(cache,'sets.csv.gz')))sets.set(row.set_num,row);
  const themes=new Map();for await(const row of csvRows(resolve(cache,'themes.csv.gz')))themes.set(row.id,row);
  const chain=id=>{const out=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const t=themes.get(id);if(!t)break;out.unshift(t.name);id=t.parent_id;}return out;};
  const bySetInventory=new Map([...setInventories].map(([id,v])=>[v.id,id]));
  const setFigures=new Map();
  for await(const row of csvRows(resolve(cache,'inventory_minifigs.csv.gz'))){
    if(!setFigures.has(row.inventory_id))setFigures.set(row.inventory_id,[]);setFigures.get(row.inventory_id).push({id:row.fig_num,quantity:Number(row.quantity)});
    const fig=figs.get(row.fig_num),set=sets.get(bySetInventory.get(row.inventory_id));
    if(fig&&set)fig.sets.push({id:set.set_num,name:set.name,year:Number(set.year),themes:chain(set.theme_id)});
  }
  const singleCMF=new Map(),setInventoriesData={};
  for(const [inventory,figures] of setFigures){
    const setId=bySetInventory.get(inventory),set=sets.get(setId);
    if(figures.length===1&&figures[0].quantity===1&&set&&chain(set.theme_id).includes('Collectible Minifigures')){
      const entry={id:setId,name:set.name,figureId:figures[0].id,parts:[]};singleCMF.set(inventory,entry);setInventoriesData[setId]=entry;
    }
  }
  const usedParts=new Set(),usedColors=new Set();
  let count=0;
  for await(const row of csvRows(resolve(cache,'inventory_parts.csv.gz'))){
    const fig=selected.get(row.inventory_id),set=singleCMF.get(row.inventory_id);if(!fig&&!set)continue;
    const item={part_num:row.part_num,color:Number(row.color_id),quantity:Number(row.quantity),...(row.is_spare==='True'?{is_spare:true}:{})};if(fig)fig.parts.push(item);if(set)set.parts.push(item);usedParts.add(row.part_num);usedColors.add(Number(row.color_id));count++;
  }
  const parts={};for await(const row of csvRows(resolve(cache,'parts.csv.gz')))if(usedParts.has(row.part_num))parts[row.part_num]={name:row.name,category:Number(row.part_cat_id)};
  const colors={};for await(const row of csvRows(resolve(cache,'colors.csv.gz')))if(usedColors.has(Number(row.id)))colors[row.id]={name:row.name,rgb:row.rgb,is_trans:row.is_trans==='True'};
  const categories={};for await(const row of csvRows(resolve(cache,'part_categories.csv.gz')))categories[row.id]=row.name;
  const data={version:1,source:JSON.parse(await fs.readFile(resolve(cache,'manifest.json'),'utf8')),categories,parts,colors,setInventories:setInventoriesData,figures:[...figs.values()].filter(f=>f.parts.length).sort((a,b)=>a.id.localeCompare(b.id))};
  const out=resolve(root,'vendor/bricktrait/presets/sources/rebrickable-bulk.json');
  await fs.writeFile(out,JSON.stringify(data)+'\n');
  console.log(`Preserved ${data.figures.length} minifigure inventories (${count} figure and CMF set component rows, ${usedParts.size} unique parts), with unrestricted theme discovery.`);
  return data;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await importBulk({refresh:process.argv.includes('--refresh'),download:!process.argv.includes('--cached')});
