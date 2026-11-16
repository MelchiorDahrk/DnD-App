import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assembleInventory,extractOMRFigures,deduplicatePresets,digest,slug} from './lib/minifigure-presets.mjs';
import {emptyFigure,validatePreset} from '../vendor/bricktrait/src/lib/presets.js';
import {assembleBulkFigure} from './lib/rebrickable-inventories.mjs';
import {DEFAULT_PORTRAIT_IDS} from '../portrait-defaults.js';
const root=resolve(import.meta.dirname,'..'),vendor=resolve(root,'vendor/bricktrait');
const read=async file=>JSON.parse(await fs.readFile(resolve(vendor,file),'utf8'));
async function write(file,data){await fs.mkdir(resolve(file,'..'),{recursive:true});const text=JSON.stringify(data,null,2)+'\n';if(await fs.readFile(file,'utf8').catch(()=>'')!==text)await fs.writeFile(file,text);}
export function applyPresetOverrides(input,override={}){
  const figure=structuredClone(input.figure);
  for(const [slot,patch] of Object.entries(override.figure||{}))figure[slot]={...figure[slot],...patch};
  return {...input,...override,figure,compatibility:{...input.compatibility,...override.compatibility}};
}
export function generateOriginals(recipes,parts){
  const catalog=new Map(parts.map(p=>[p.id,p])),out=[];
  const faces=['3626cp01','3626bp05','3626cp72','3626cpbb','3626cpbh','3626cp88'];
  const add=(name,archetype,torso,wear,wearColor,item,body,legs,neck=null,back=null,species='Human')=>{
    const fig=emptyFigure(),seed=parseInt(digest(name).slice(0,6),16);
    const skin=species==='Orc'?330:species==='Goblin'?2:species==='Undead'?15:species==='Demon'?4:species==='Elf'?78:14;
    const head=species==='Goblin'?'42109':species==='Orc'?'3626bpma':species==='Undead'?'3626bpa8':faces[seed%faces.length];
    fig.head={id:head,color:skin};fig.headgear={id:wear,color:wearColor};
    fig.torso={id:torso,color:body,arms:body,hands:skin};
    fig.legs={id:['Dwarf','Halfling','Goblin'].includes(species)?'41879a':'standard',color:legs,hips:legs};
    if(neck)fig.neck={id:neck,color:/Beard/.test(catalog.get(neck)?.name||'')?6:71};
    if(back)fig.back={id:back,color:6};
    if(item)fig.handR={id:item,color:/Bow|Lute|Broom|Staff|Wand|Fishing/.test(catalog.get(item)?.name||'')?6:71,spin:0};
    if(['Paladin','Knight','Guard','Fighter','Soldier'].includes(archetype))fig.handL={id:'3846',color:71,spin:0};
    if(item)fig.pose.armR=10;
    out.push({id:`original-${slug(name)}`,name,description:`Original Questlog ${species.toLowerCase()} ${archetype.toLowerCase()} with ${catalog.get(torso)?.name?.replace(/^Torso with /,'').replace(/ Pattern$/,'')}. Customize any component.`,theme:'Original Fantasy',category:archetype,archetypes:[archetype],species,kind:'original',tags:[archetype,species,'fantasy','D&D'],sources:[{name:'Questlog original combination',url:'https://library.ldraw.org/',author:'Questlog; geometry by LDraw contributors (credits in part packs)',license:'CC-BY-4.0 (combination); geometry per LDraw file',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'}],figure:fig,compatibility:{status:'complete',issues:[]}});
  };
  for(const [archetype,outfits,wear,wearColor,item,body,legs,neck,back] of recipes.recipes)for(const [name,torso] of outfits)add(name,archetype,torso,wear,wearColor,item,body,legs,neck,back);
  for(const [species,name,torso,wear,wearColor,item,body,legs,back,neck] of recipes.speciesRecipes)add(name,species==='Undead'?'Undead':species==='Demon'?'Demon':/miner|smith/i.test(name)?'Artificer':/archer|scout|hunter/i.test(name)?'Ranger':/sorcerer|invoker|spell|hex/i.test(name)?'Wizard':'Adventurer',torso,wear,wearColor,item,body,legs,neck,back,species);
  return out;
}
export async function buildPresets({refreshSources=false,writeOutput=true}={}){
  const parts=await read('static/ldraw/catalog.json'),colors=await read('static/ldraw/colors.json');
  const mappings=await read('presets/mappings.json'),overrides=await read('presets/overrides.json');
  const sourcePath=resolve(vendor,'presets/sources/omr-inventories.json');
  if(refreshSources){
    const models=JSON.parse(await fs.readFile(resolve(root,'.cache/presets/omr-models.json'),'utf8'));
    const extracted=models.flatMap(m=>extractOMRFigures(m,parts,mappings)).map(({figure,compatibility,...source})=>source);
    await write(sourcePath,{version:1,models:models.map(({text,...meta})=>meta),assemblies:extracted});
  }
  const source=JSON.parse(await fs.readFile(sourcePath,'utf8'));
  const official=source.assemblies.map(p=>{
    const assembly=assembleInventory(p.sourceComponents,parts,{mappings});
    for(const reason of p.sourceWarnings||[])assembly.compatibility.issues.push({slot:'source',reason});
    if(assembly.compatibility.status==='complete'&&assembly.compatibility.issues.length)assembly.compatibility.status='partial';
    return {...p,...assembly};
  });
  const rebrickablePath=resolve(vendor,'presets/sources/rebrickable-inventories.json');
  if(existsSync(rebrickablePath)){
    for(const p of JSON.parse(await fs.readFile(rebrickablePath,'utf8'))){
      official.push({id:`rebrickable-${p.id}`,name:p.name,description:`Inventory imported from Rebrickable ${p.id}.`,theme:p.theme||'Unclassified',category:p.category||p.theme||'Unclassified',tags:p.tags||[],sourceComponents:p.parts.map(p=>({externalId:p.part.part_num,name:p.part.name,color:p.color.id,quantity:p.quantity})),species:p.species||'',archetypes:p.archetypes||[],kind:'official',originalId:p.id,sources:[{name:'Rebrickable',url:p.url,author:'Rebrickable contributors',license:'Rebrickable Terms of Service ยง5.1',licenseUrl:'https://rebrickable.com/terms/'}],...assembleInventory(p.parts,parts,{sourceKind:'rebrickable',mappings})});
    }
  }
  const bulkPath=resolve(vendor,'presets/sources/rebrickable-bulk.json');
  if(existsSync(bulkPath)){
    const bulk=JSON.parse(await fs.readFile(bulkPath,'utf8'));
    const verified=await read('presets/rebrickable-mappings.json');
    const externalMappings={...mappings,parts:{...verified.parts,...mappings.parts},colors:{...verified.colors,...mappings.colors}};
    for(const fig of bulk.figures){
      const {source,figure,compatibility}=assembleBulkFigure(fig,bulk,parts,externalMappings);
      official.push({id:`rebrickable-${source.id}`,name:source.name,description:`Official LEGO minifigure inventory from Rebrickable ${source.id}. ${source.sets.length?`Found in ${source.sets.map(s=>s.id).join(', ')}.`:''}`,theme:source.theme,themes:source.themes,category:source.cmf?'Collectible Minifigures':source.theme,tags:[...source.themes,...source.sets.flatMap(s=>[s.id,s.name,String(s.year)])],species:'',archetypes:[],kind:'official',originalId:source.id,sources:[{name:'Rebrickable bulk catalog',url:source.url,author:'Rebrickable contributors',license:'Rebrickable Terms of Service ง5.1',licenseUrl:'https://rebrickable.com/terms/'}],sourceInventory:source.id,sourceComponents:source.parts.map(p=>({externalId:p.part.part_num,name:p.part.name,color:p.color.id,quantity:p.quantity,ldrawId:externalMappings.parts[p.part.part_num]||null})),figure,compatibility});
    }
  }
  const originals=generateOriginals(await read('presets/original-recipes.json'),parts);
  const rejected=[],excluded=[],accepted=[];
  for(const input of [...official,...originals]){
    const override=overrides.presets[input.id]||{};
    const p=applyPresetOverrides(input,override);
    // Preset curation never removes source inventories or selectable pieces.
    p.thumbnail=`preset-thumbs/${p.id}.webp`;
    if(p.hidden||p.compatibility.status==='unavailable'){rejected.push({id:p.id,name:p.name,sourceInventory:p.sourceInventory,...p.compatibility,hidden:!!p.hidden});continue;}
    const errors=validatePreset(p,parts,colors);
    // Physical torso must exist and essential anatomy must be represented.
    if(errors.length)throw new Error(`${p.id}: ${errors.join('; ')}`);
    for(const slot of Object.values(p.figure))if(slot?.id&&slot.id!=='standard'&&!existsSync(resolve(vendor,'static/ldraw/p',`${slot.id}.ldr`)))throw new Error(`Missing part pack ${slot.id}`);
    accepted.push(p);
  }
  // Preserve established canonical IDs when a new source adds an identical
  // configuration, so refreshes do not invalidate favorites or recent picks.
  const previous=await read('preset-catalog.json').catch(()=>({presets:[]}));
  const {presets,duplicates}=deduplicatePresets(accepted,{preferredIds:previous.presets.map(p=>p.id)});
  presets.sort((a,b)=>a.id.localeCompare(b.id));
  const stats={total:presets.length,official:presets.filter(p=>p.kind==='official').length,original:presets.filter(p=>p.kind==='original').length,complete:presets.filter(p=>p.compatibility.status==='complete').length,partial:presets.filter(p=>p.compatibility.status==='partial').length,themes:[...new Set(presets.map(p=>p.theme))].sort(),sourceModels:source.models.length,unavailable:rejected.length,excluded:excluded.length,deduplicated:duplicates.length};
  // Full source matrices stay in the build snapshot. Runtime metadata contains
  // original IDs/colors for missing-part inspection without source geometry.
  const compact=presets.map(({sourceComponents,...p})=>({...p,...(sourceComponents?{sourceComponents:sourceComponents.map(({id,color,externalId,ldrawId,quantity,name})=>({...(id?{id}:{}),color,...(externalId?{externalId,ldrawId,quantity,name}:{})}))}:{})}));
  const catalog={version:1,stats,presets:compact};
  const report={version:1,stats,modelsWithoutFigures:source.models.filter(m=>!source.assemblies.some(p=>p.sources.some(s=>s.url===m.url))).map(({number,name,theme,url})=>({number,name,theme,url,reason:'No isolated compatible minifigure assembly in this model'})),unavailable:rejected.map(p=>p.sourceInventory?{id:p.id,name:p.name,sourceInventory:p.sourceInventory,status:p.status,missingEssential:p.missingEssential,issueCount:p.issues.length,report:'reports/minifigure-coverage.json'}:p),duplicates,partial:presets.filter(p=>p.compatibility.status==='partial').map(p=>({id:p.id,name:p.name,...p.compatibility})),limitations:['OMR is fan-authored; source model omissions are not a guarantee of retail inventory completeness. Models flagged for missing parts or prints remain partial until reviewed.','Unsupported compound accessories, asymmetric limbs and attachment orientations are reported rather than guessed.','Rebrickable bulk inventories and verified LDraw keyword mappings require no API key. Unmapped geometry and colors are reported rather than guessed; targeted API refreshes can add verified mappings.']};
  report.excluded=excluded;
  if(writeOutput){
    const defaults=Object.fromEntries(DEFAULT_PORTRAIT_IDS.map(id=>{
      const preset=compact.find(p=>p.id===id);
      if(!preset)throw new Error(`Missing default portrait preset ${id}`);
      return [id,{thumbnail:preset.thumbnail,figure:preset.figure}];
    }));
    const defaultsFile=resolve(root,'portrait-default-data.js');
    const defaultsText='// Generated by npm run build:presets from the curated default IDs.\nexport const DEFAULT_PORTRAITS = '+JSON.stringify(defaults)+';\n';
    if(await fs.readFile(defaultsFile,'utf8').catch(()=>'')!==defaultsText)await fs.writeFile(defaultsFile,defaultsText);
    await write(resolve(vendor,'preset-catalog.json'),catalog);
    const usedIds=new Set(compact.flatMap(p=>Object.values(p.figure).map(slot=>slot?.id).filter(id=>id&&id!=='standard')));
    await write(resolve(vendor,'presets/asset-manifest.json'),{version:1,parts:parts.filter(p=>usedIds.has(p.id)).sort((a,b)=>a.id.localeCompare(b.id)),colors:colors.map(c=>c.code).sort((a,b)=>a-b)});
    await write(resolve(vendor,'presets/compatibility-report.json'),report);
    await fs.mkdir(resolve(vendor,'static'),{recursive:true});
    await fs.writeFile(resolve(vendor,'static/preset-catalog.json'),JSON.stringify(catalog)+'\n');
  }
  return {catalog,report};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {catalog}=await buildPresets({refreshSources:process.argv.includes('--refresh-omr')});console.log(JSON.stringify(catalog.stats,null,2));
}
