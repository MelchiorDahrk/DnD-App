import {emptyFigure,configurationKey} from '../../vendor/bricktrait/src/lib/presets.js';
import {createHash} from 'node:crypto';
export const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
const IDENTITY=[1,0,0,0,1,0,0,0,1];
// Core geometry is packed by Bricktrait but does not appear in the part picker.
const ASSEMBLY_CORE=['3815','3816','3817','3818','3819','3820'].map(id=>({id,cat:'body',name:'Standard minifigure assembly component'}));
export function parseMPD(text){
  const files=new Map();let current=[];let key='main.ldr';
  for(const line of text.replace(/\r/g,'').split('\n')){
    if(/^0 FILE /i.test(line)){if(current.length)files.set(key.toLowerCase(),current);key=line.slice(7).trim();current=[];}else current.push(line);
  }
  if(current.length)files.set(key.toLowerCase(),current);return files;
}
export function references(lines){
  return lines.flatMap(line=>{const m=line.trim().match(/^1\s+(\d+)\s+((?:[-+\d.eE]+\s+){11}[-+\d.eE]+)\s+(.+)$/);if(!m)return [];const n=m[2].trim().split(/\s+/).map(Number);return [{id:m[3].replace(/\\/g,'/').toLowerCase(),color:Number(m[1]),at:n.slice(0,3),m:n.slice(3)}];});
}
const multiply=(a,b)=>[0,1,2].flatMap(i=>[0,1,2].map(j=>a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j]));
const transform=(m,v)=>[0,1,2].map(i=>m[i*3]*v[0]+m[i*3+1]*v[1]+m[i*3+2]*v[2]);
export function flattenModel(files,key,catalog,frame={at:[0,0,0],m:IDENTITY,color:16},trail=new Set()){
  if(trail.has(key))throw new Error(`Cyclic MPD reference ${key}`);
  const next=new Set([...trail,key]);return references(files.get(key)||[]).flatMap(ref=>{
    const at=transform(frame.m,ref.at).map((n,i)=>n+frame.at[i]);const m=multiply(frame.m,ref.m);const color=ref.color===16?frame.color:ref.color;
    const id=ref.id.replace(/\.dat$/,'');
    if(files.has(ref.id)&&!catalog.has(id))return flattenModel(files,ref.id,catalog,{at,m,color},next);
    return [{id,color,at,m}];
  });
}
// Inventories are not assemblies. Only known slot categories and explicit pairs
// are accepted. No fuzzy print matching and no guessed external color IDs.
export function resolveExternalPart(part,catalog,overrides={}){
  const explicit=overrides.parts?.[part.part_num];
  const candidates=explicit?[explicit]:part.external_ids?.LDraw||[];
  return candidates.map(id=>String(id).toLowerCase().replace(/\.dat$/,'')).find(id=>catalog.has(id))||null;
}
export function resolveExternalColor(color,overrides={}){
  return overrides.colors?.[color.id]??color.external_ids?.LDraw?.ext_ids?.[0]??null;
}
export function assembleInventory(items,parts,{sourceKind='omr',mappings={}}={}){
  const catalog=new Map([...ASSEMBLY_CORE,...parts].map(p=>[p.id,p]));const figure=emptyFigure();const issues=[];const assigned=new Set();
  const list=items.filter(p=>!p.is_spare).flatMap(p=>{
    if(sourceKind==='rebrickable'){
      const id=resolveExternalPart(p.part,catalog,mappings),color=resolveExternalColor(p.color,mappings);
      if(!id||color===null){issues.push({part:p.part.part_num,color:p.color.id,reason:'No verified LDraw part/color mapping'});return [];}
      const quantity=p.quantity??1;
      if(!Number.isInteger(quantity)||quantity<1||quantity>35){issues.push({part:p.part.part_num,reason:'Unsupported inventory quantity'});return [];}
      return Array.from({length:quantity},()=>({id,color:Number(color)}));
    }return [p];
  });
  for(const slot of ['head','torso','legs','headgear','neck','back']){
    const found=list.filter(p=>catalog.get(p.id)?.cat===slot);
    if(found.length>1){issues.push({slot,reason:'Multiple components compete for one slot'});continue;}
    if(found.length){figure[slot].id=found[0].id;figure[slot].color=found[0].color;assigned.add(found[0]);}
  }
  const raw=id=>list.filter(p=>p.id===id);
  let combinedLegs=false;
  for(const rule of mappings.legAssemblies||[]){
    const group=rule.parts.map(id=>raw(id));
    if(!group.every(p=>p.length===1)||!catalog.has(rule.id))continue;
    const [hips,right,left]=group.map(p=>p[0]);
    if(right.color!==left.color||hips.color!==(rule.hips==='parent'?right.color:rule.hips))continue;
    figure.legs={id:rule.id,color:right.color,hips:hips.color};group.flat().forEach(p=>assigned.add(p));combinedLegs=true;break;
  }
  const plainHips=list.filter(p=>/^3815[ab]?$/.test(p.id)),rightLeg=list.filter(p=>/^3816[ab]?$/.test(p.id)),leftLeg=list.filter(p=>/^3817[ab]?$/.test(p.id));
  if(!combinedLegs&&plainHips.length===1&&rightLeg.length===1&&leftLeg.length===1){
    figure.legs={id:'standard',color:rightLeg[0].color,hips:plainHips[0].color};
    if(rightLeg[0].color!==leftLeg[0].color)issues.push({slot:'legs',reason:'Different left/right leg colors are not editable independently'});
    [...plainHips,...rightLeg,...leftLeg].forEach(p=>assigned.add(p));
  } else if(!combinedLegs&&figure.legs.id&&/^3815/.test(figure.legs.id)&&rightLeg.length===1&&leftLeg.length===1){
    figure.legs.hips=figure.legs.color;figure.legs.color=rightLeg[0].color;
    [...rightLeg,...leftLeg].forEach(p=>assigned.add(p));
  }
  if(!combinedLegs&&/^Hips( with (?!Tentacles)|$)/.test(catalog.get(figure.legs.id)?.name||'')&&(rightLeg.length!==1||leftLeg.length!==1)){
    issues.push({part:figure.legs.id,reason:'Separate printed or missing legs have no verified compatible assembly'});figure.legs.id=null;
  }
  const arms=[...raw('3818'),...raw('3819')],hands=raw('3820');
  figure.torso.arms=arms[0]?.color??figure.torso.color;figure.torso.hands=hands[0]?.color??figure.head.color;
  if(figure.torso.id&&!catalog.get(figure.torso.id)?.arms&&(raw('3818').length!==1||raw('3819').length!==1||hands.length!==2))issues.push({slot:'torso',reason:'Incomplete separate arm/hand inventory; matching torso/head colors used pending review'});
  [...arms,...hands].forEach(p=>assigned.add(p));
  if(new Set(arms.map(p=>p.color)).size>1||new Set(hands.map(p=>p.color)).size>1)issues.push({slot:'torso',reason:'Asymmetric arm/hand colors cannot be edited independently'});
  if(figure.legs.id!=='standard'&&!/^3815/.test(figure.legs.id))figure.legs.hips=figure.legs.color;
  const handheld=list.filter(p=>catalog.get(p.id)?.cat==='hand');
  // OMR placement supplies attachment evidence. Bare inventories require a
  // reviewed per-figure slot override instead of guessing a weapon's hand.
  for(const item of handheld){
    if(!item.at||!hands.length){issues.push({part:item.id,reason:'Hand attachment requires a reviewed slot mapping'});continue;}
    const ordered=[...hands].sort((a,b)=>Math.hypot(...a.at.map((v,i)=>v-item.at[i]))-Math.hypot(...b.at.map((v,i)=>v-item.at[i])));
    const hand=ordered[0],torso=list.find(p=>p.id===figure.torso.id);
    if(!torso||Math.hypot(...hand.at.map((v,i)=>v-item.at[i]))>35){issues.push({part:item.id,reason:'Not attached to a hand'});continue;}
    const dx=hand.at.map((n,i)=>n-torso.at[i]);const localX=torso.m[0]*dx[0]+torso.m[3]*dx[1]+torso.m[6]*dx[2];const slot=localX<0?'handR':'handL';
    const grip=mappings.grips?.[item.id];
    if(grip&&!figure[slot].id){figure[slot]={id:item.id,color:item.color,spin:grip.spin||0};}
    else issues.push({part:item.id,slot,reason:'Handheld orientation needs manual review'});
  }
  for(const item of list)if(!assigned.has(item)&&!handheld.includes(item)&&!['88646','87580','92593'].includes(item.id))issues.push({part:item.id,color:item.color,reason:'Unsupported component or attachment'});
  if(catalog.get(figure.head.id)?.moulded!==undefined&&figure.headgear.id){issues.push({part:figure.headgear.id,reason:'Moulded-head headgear needs placement review'});figure.headgear.id=null;}
  const essential=['head','torso','legs'].filter(slot=>!figure[slot].id);
  const status=essential.length?'unavailable':issues.length?'partial':'complete';
  return {figure,compatibility:{status,issues,...(essential.length?{missingEssential:essential}:{})}};
}
export function extractOMRFigures(model,parts,mappings={}){
  const files=parseMPD(model.text),catalog=new Map(parts.map(p=>[p.id,p]));const results=[];
  const author=model.text.match(/^0 Author:\s*(.+)/mi)?.[1]||'LDraw OMR contributors';
  const headerLicense=model.text.match(/^0 !LICENSE (.*)$/mi)?.[1]||'';
  const license=/CC BY 4\.0/i.test(headerLicense)?'CC-BY-4.0':'CC-BY-2.0';
  for(const [key,lines] of files){
    if(!/\.ldr$|\.mpd$/i.test(key))continue;
    const items=flattenModel(files,key,catalog);
    // An assembly must contain exactly one actual head and torso; a set model
    // containing multiple people is never treated as a single minifigure.
    if(items.filter(p=>catalog.get(p.id)?.cat==='head'||/^3626/.test(p.id)).length!==1||items.filter(p=>catalog.get(p.id)?.cat==='torso'||/^973/.test(p.id)).length!==1)continue;
    if(items.length>35)continue;
    const result=assembleInventory(items,parts,{mappings});
    const name=lines.find(l=>/^0 (?![!\/]|Name:|Author:|FILE|STEP|BFC|ROTSTEP|NOFILE)/.test(l))?.slice(2).trim()||key.replace(/\.ldr$/,'');
    const theme=/The Lord of the Rings/.test(model.theme)?'Lord of the Rings':/The Hobbit/.test(model.theme)?'The Hobbit':/Western/.test(model.theme)?'Western':model.theme.split(' > ')[0];
    const assemblyAuthor=lines.find(l=>/^0 Author:/i.test(l))?.replace(/^0 Author:\s*/i,'')||author;
    const assemblyLicenseLine=lines.find(l=>/^0 !LICENSE /i.test(l));
    const assemblyLicense=assemblyLicenseLine?(/CC BY 4\.0/i.test(assemblyLicenseLine)?'CC-BY-4.0':'CC-BY-2.0'):license;
    const licenseUrl=`https://creativecommons.org/licenses/by/${assemblyLicense==='CC-BY-4.0'?'4.0':'2.0'}/`;
    results.push({id:`omr-${slug(model.number)}-${digest(key)}`,name:`${name.replace(new RegExp('^'+model.number.split('-')[0]+'\\s*-?\\s*'),'')} · ${model.number}`,description:`Minifigure assembly from ${model.name} (${model.year}). Standing pose reconstructed from the credited OMR model.`,theme,category:model.theme,faction:model.theme.split(' > ')[1]||'',species:'',archetypes:[],tags:[model.name,model.number,model.theme],kind:'official',originalId:`${model.number}/${key}`,sourceWarnings:model.sourceWarnings||[],sources:[{name:'LDraw OMR',url:model.url,author:assemblyAuthor,license:assemblyLicense,licenseUrl,assembly:key}],sourceComponents:items.map(({id,color,at,m})=>({id,color,at,m})),...result});
  }
  return results;
}
export function deduplicatePresets(presets,{preferredIds=[]}={}){
  const seen=new Map(),duplicates=[];
  const preferred=new Set(preferredIds);
  for(const p of [...presets].sort((a,b)=>Number(preferred.has(b.id))-Number(preferred.has(a.id))||a.id.localeCompare(b.id))){
    const key=`${p.kind}/${configurationKey(p.figure)}`;const prior=seen.get(key);
    if(prior){
      prior.aliases=[...new Set([...(prior.aliases||[]),p.name,...p.aliases||[]])];
      prior.themes=[...new Set([prior.theme,...prior.themes||[],p.theme,...p.themes||[]])].sort();
      prior.tags=[...new Set([...prior.tags,...p.tags,p.faction||''])].filter(Boolean);
      prior.originalIds=[...new Set([prior.originalId,...prior.originalIds||[],p.originalId,...p.originalIds||[]])].filter(Boolean);
      prior.sources=[...new Map([...prior.sources,...p.sources].map(s=>[JSON.stringify(s),s])).values()];
      prior.sourceComponents=[...new Map([...(prior.sourceComponents||[]),...(p.sourceComponents||[])].map(s=>[JSON.stringify(s),s])).values()];
      prior.compatibility.issues=[...new Map([...prior.compatibility.issues,...p.compatibility.issues].map(s=>[JSON.stringify(s),s])).values()];
      if(prior.compatibility.issues.length)prior.compatibility.status='partial';
      duplicates.push({id:p.id,canonical:prior.id});
    }
    else seen.set(key,p);
  }
  return {presets:[...seen.values()],duplicates:duplicates.sort((a,b)=>a.id.localeCompare(b.id))};
}
