import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectableCatalog} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
import {assembleBulkFigure} from './lib/rebrickable-inventories.mjs';
const root=resolve(import.meta.dirname,'..'),vendor=resolve(root,'vendor/bricktrait');
const read=async file=>JSON.parse(await fs.readFile(resolve(root,file),'utf8'));
export async function buildCoverageReport(){
  const parts=await read('vendor/bricktrait/static/ldraw/catalog.json');
  const catalog=await read('vendor/bricktrait/preset-catalog.json');
  const bulk=await read('vendor/bricktrait/presets/sources/rebrickable-bulk.json');
  const mappings=await read('vendor/bricktrait/presets/rebrickable-mappings.json');
  const reviewed=await read('vendor/bricktrait/presets/mappings.json');
  const verified={...reviewed,parts:{...mappings.parts,...reviewed.parts},colors:{...mappings.colors,...reviewed.colors}};
  const build=await read('.cache/portrait-coverage/ldraw-build-report.json');
  let changes=await read('.cache/portrait-coverage/change-metrics.json').catch(()=>null);
  const storedBaseline=await read('reports/minifigure-baseline.json').catch(()=>null);
  changes??=storedBaseline?.changeMetrics||null;
  const baseline=await read('.cache/portrait-coverage/baseline.json').catch(()=>storedBaseline);
  if(baseline&&changes){await fs.writeFile(resolve(root,'reports/minifigure-baseline.json'),JSON.stringify({...baseline,partIds:storedBaseline?.partIds||[],presetIds:storedBaseline?.presetIds||[],changeMetrics:changes},null,2)+'\n');}
  const before=await read('.cache/portrait-coverage/before-parts.json').catch(()=>[]);
  const oldPresets=await read('.cache/portrait-coverage/before-presets.json').catch(()=>({presets:[]}));
  const available=selectableCatalog(parts),byId=new Map(parts.map(p=>[p.id,p])),sources=new Map(build.sourceParts.map(p=>[p.id,p])),skipped=new Map(build.skipped.map(p=>[p.id,p]));
  const used=new Set(catalog.presets.flatMap(p=>Object.values(p.figure).map(p=>p?.id).filter(Boolean)));
  const present=new Set(catalog.presets.flatMap(p=>[p.originalId,...p.originalIds||[]]));
  const accessoryInventories=new Map();
  for(const set of Object.values(bulk.setInventories||{})){
    const fig=bulk.figures.find(f=>f.id===set.figureId);if(!fig)continue;
    const extras=set.parts.filter(item=>!fig.parts.some(p=>p.part_num===item.part_num&&p.color===item.color));
    if(!accessoryInventories.has(fig.id))accessoryInventories.set(fig.id,[]);
    accessoryInventories.get(fig.id).push(...extras.map(item=>{
      const ldrawId=verified.parts[item.part_num],part=byId.get(ldrawId);
      return {externalId:item.part_num,description:bulk.parts[item.part_num]?.name||item.part_num,sourceMinifigure:fig.id,sourceSet:set.id,quantity:item.quantity,color:item.color,isSpare:!!item.is_spare,ldrawId:ldrawId||null,reason:!ldrawId?'No verified LDraw ID mapping':!sources.has(ldrawId)?'Geometry absent from libraries':!part||part.attachmentOnly?skipped.get(ldrawId)?.reason||'Unsupported attachment':'Geometry available; set accessory needs reviewed assembly placement'};
    }));
  }
  const missingFromLibraries=[],skippedDuringBuild=[],unverifiedMappings=[],assembliesNotDefined=[],dnd=[];
  const opportunities=new Map();
  for(const fig of bulk.figures){
    const {compatibility,figure}=assembleBulkFigure(fig,bulk,parts,verified);
    const missing=[];
    for(const item of fig.parts){
      if(item.is_spare)continue;
      const externalId=item.part_num,ldrawId=verified.parts[externalId];
      const entry={externalId,description:bulk.parts[externalId]?.name||externalId,sourceMinifigure:fig.id,minifigureName:fig.name,sourceURL:`https://rebrickable.com/minifigs/${fig.id}/`,quantity:item.quantity,color:item.color,ldrawId:ldrawId||null};
      if(!ldrawId){entry.reason=mappings.ambiguous[externalId]?'Multiple LDraw keyword mappings require review':'No verified LDraw ID mapping; geometry absence cannot be established';unverifiedMappings.push(entry);missing.push(entry);}
      else if(!sources.has(ldrawId)){entry.reason='Verified identifier is absent from official and unofficial libraries';missingFromLibraries.push(entry);missing.push(entry);}
      else if(!byId.has(ldrawId)||byId.get(ldrawId).attachmentOnly){entry.reason=skipped.get(ldrawId)?.reason||'Geometry exists but has no supported editor attachment';skippedDuringBuild.push(entry);missing.push(entry);}
    }
    const unmappedColors=fig.parts.filter(p=>!p.is_spare&&verified.colors[p.color]===undefined).map(p=>({externalId:p.part_num,color:p.color,reason:'No verified LDraw color mapping'}));
    if(!missing.length&&!unmappedColors.length&&!present.has(fig.id))assembliesNotDefined.push({id:fig.id,name:fig.name,reason:compatibility.status==='unavailable'?'Known components require an assembly or attachment definition':'Components resolve; an exact complete assembly requires review',issues:compatibility.issues});
    const blocking=[...new Set(missing.map(p=>p.externalId))];
    for(const id of blocking){if(!opportunities.has(id))opportunities.set(id,{externalId:id,description:bulk.parts[id]?.name,figures:[],singleComponentUnlocks:[]});const item=opportunities.get(id);item.figures.push(fig.id);if(blocking.length===1&&!unmappedColors.length)item.singleComponentUnlocks.push(fig.id);}
    if(fig.sets.some(s=>/^71047-\d+$/.test(s.id)))dnd.push({id:fig.id,name:fig.name,sets:fig.sets.filter(s=>s.id.startsWith('71047-')).map(s=>s.id),preset:catalog.presets.find(p=>p.originalId===fig.id||p.originalIds?.includes(fig.id))?.id||null,status:compatibility.status,components:fig.parts.length,available:fig.parts.filter(p=>verified.parts[p.part_num]&&byId.has(verified.parts[p.part_num])&&!byId.get(verified.parts[p.part_num]).attachmentOnly).length,missing,unmappedColors,accessories:accessoryInventories.get(fig.id)||[],assemblyIssues:compatibility.issues});
  }
  const oldIds=new Set(before.length?before.map(p=>p.id):storedBaseline?.partIds||[]),oldPresetIds=new Set(oldPresets.presets.length?oldPresets.presets.map(p=>p.id):storedBaseline?.presetIds||[]);
  const report={version:1,source:bulk.source,baseline:baseline?{...baseline,previouslyHidden:baseline.previouslyHidden.length}:null,summary:{libraryParts:parts.length,selectableParts:available.length,selectableWithStandardLegs:available.length+1,newlyBundledParts:parts.filter(p=>!oldIds.has(p.id)).length,newLibraryParts:changes?.newLibraryParts??null,newlyClassifiedParts:changes?.newlyClassifiedParts??null,newSelectableParts:available.filter(p=>!oldIds.has(p.id)).length,previouslyHidden:baseline?.previouslyHidden.length??null,presets:catalog.stats,newPresets:catalog.presets.filter(p=>!oldPresetIds.has(p.id)).length,importedRebrickablePresets:catalog.presets.filter(p=>p.originalId?.startsWith('fig-')||p.originalIds?.some(id=>id.startsWith('fig-'))).length,sourceInventories:bulk.figures.length,missingFromLibraries:missingFromLibraries.length,skippedComponentOccurrences:skippedDuringBuild.length,unverifiedMappingOccurrences:unverifiedMappings.length,dndFigures:dnd.length,dndExact:dnd.filter(p=>p.status==='complete').length,dndPartial:dnd.filter(p=>p.status==='partial').length},missingFromLibraries,skippedDuringBuild,unverifiedMappings,previouslyHidden:(baseline?.previouslyHidden||[]).map(id=>({id,name:byId.get(id)?.name,available:available.some(p=>p.id===id),technicalRestriction:skipped.get(id)?.reason||null})),unusedSelectableParts:available.filter(p=>!used.has(p.id)),assembliesNotDefined,unlockOpportunities:[...opportunities.values()].sort((a,b)=>b.singleComponentUnlocks.length-a.singleComponentUnlocks.length||b.figures.length-a.figures.length),dnd,cmfSetAccessories:[...accessoryInventories.values()].flat(),technicalRestrictions:build.skipped,limitations:['An unmapped external ID does not prove missing geometry. These cases are separate from confirmed missing geometry.','Source inventories describe minifigure components; accessories packaged in the parent set may require separate attachment review.','Complete means the verified source minifigure inventory is represented; fan-authored OMR source warnings are retained.']};
  await fs.mkdir(resolve(root,'reports'),{recursive:true});
  await fs.writeFile(resolve(root,'reports/minifigure-coverage.json'),JSON.stringify(report)+'\n');
  const lines=['# Minifigure coverage', '',`Source inventories: ${bulk.figures.length}. Selectable parts: ${available.length} + standard legs. Presets: ${catalog.stats.total} (${report.summary.importedRebrickablePresets} with Rebrickable identities).`, '', 'The machine-readable report separates verified missing geometry, skipped builds, legacy hidden parts, unused selectable parts, assemblies requiring review, and unverified identifier mappings. Unmapped IDs are never asserted to be absent geometry.','','## Dungeons & Dragons CMF 71047','','| Figure | Available inventory components | Status |','| --- | ---: | --- |',...dnd.map(p=>`| ${p.name} (${p.id}) | ${p.available}/${p.components} | ${p.status} |`),'','See [minifigure-coverage.json](minifigure-coverage.json) for every component identifier, description, source figure, reason, technical restriction and ranked opportunity.','','## Refresh','','`npm run refresh:portraits` downloads both LDraw libraries, rebuilds geometry, updates theme and verified mapping snapshots, imports the public bulk inventories, builds presets and cached previews, and writes this report. Ordinary `npm run build` reuses local and checked-in snapshots. Targeted API imports remain available with `REBRICKABLE_API_KEY`.',''];
  await fs.writeFile(resolve(root,'reports/minifigure-coverage.md'),lines.join('\n'));
  console.log(JSON.stringify(report.summary,null,2));return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildCoverageReport();
