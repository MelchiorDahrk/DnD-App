// Shared by the build pipeline, browser and tests. No network dependencies.
export const SLOTS = ['head','headgear','neck','back','torso','legs','handR','handL'];
export const STANDING_POSE = {head:0,armR:0,armL:0,raiseR:0,raiseL:0,wristR:0,wristL:0,legR:0,legL:0,spreadR:0,spreadL:0};
export function emptyFigure(){
  return {head:{id:null,color:14},headgear:{id:null,color:0},neck:{id:null,color:0},back:{id:null,color:0},torso:{id:null,color:0,arms:0,hands:14},legs:{id:null,color:0,hips:0},handR:{id:null,color:71,spin:0},handL:{id:null,color:71,spin:0},pose:{...STANDING_POSE}};
}
export function configurationKey(figure){
  return JSON.stringify(SLOTS.map(s=>Object.entries(figure[s]).sort(([a],[b])=>a.localeCompare(b))));
}
export function validatePreset(preset,parts,colors){
  if(!preset||typeof preset!=='object'||Array.isArray(preset))return ['Preset must be an object'];
  const errors=[];const catalog=new Map(parts.map(p=>[p.id,p]));const palette=new Set(colors.map(c=>typeof c==='number'?c:c.code));
  if(!/^[a-z0-9][a-z0-9-]+$/.test(preset.id||''))errors.push('Invalid stable ID');
  for(const key of ['name','description','theme','category'])if(typeof preset[key]!=='string'||!preset[key].trim())errors.push(`Missing ${key}`);
  if(!['official','original'].includes(preset.kind))errors.push('Invalid kind');
  if(!['complete','partial','unavailable'].includes(preset.compatibility?.status))errors.push('Invalid compatibility');
  if(!Array.isArray(preset.tags)||!Array.isArray(preset.sources)||!preset.sources.length)errors.push('Missing tags or attribution');
  if(Array.isArray(preset.tags)&&preset.tags.some(tag=>typeof tag!=='string'))errors.push('Invalid tags');
  for(const source of Array.isArray(preset.sources)?preset.sources:[])if(!source?.name||!source?.author||!source?.license||!/^https:\/\//.test(source.url||'')||!/^https:\/\//.test(source.licenseUrl||''))errors.push('Invalid source attribution');
  if(preset.kind==='official'&&!preset.originalId)errors.push('Missing original source identity');
  if(!Array.isArray(preset.compatibility?.issues)||(preset.compatibility.status==='complete'&&preset.compatibility.issues.length))errors.push('Invalid compatibility issues');
  if(!preset.thumbnail?.startsWith('preset-thumbs/'))errors.push('Invalid thumbnail');
  for(const slot of SLOTS){
    const part=preset.figure?.[slot];if(!part){errors.push(`Missing slot ${slot}`);continue;}
    const cat=slot.startsWith('hand')?'hand':slot;
    if(part.id!==null&&!(slot==='legs'&&part.id==='standard')&&catalog.get(part.id)?.cat!==cat)errors.push(`Invalid ${slot} part ${part.id}`);
    for(const [key,value] of Object.entries(part))if(['color','arms','hands','hips'].includes(key)&&!palette.has(value))errors.push(`Invalid ${slot}.${key} ${value}`);
    if(slot.startsWith('hand')&&!Number.isFinite(part.spin))errors.push(`Invalid ${slot} spin`);
  }
  if(!Number.isFinite(preset.figure?.torso?.arms)||!Number.isFinite(preset.figure?.torso?.hands)||!Number.isFinite(preset.figure?.legs?.hips))errors.push('Missing body colors');
  for(const key of Object.keys(STANDING_POSE))if(!Number.isFinite(preset.figure?.pose?.[key])||Math.abs(preset.figure.pose[key])>180)errors.push(`Invalid pose ${key}`);
  if(preset.compatibility?.status!=='unavailable'&&(!preset.figure?.head?.id||!preset.figure?.torso?.id||!preset.figure?.legs?.id))errors.push('Missing essential anatomy');
  if(catalog.get(preset.figure?.head?.id)?.moulded!==undefined&&preset.figure?.headgear?.id)errors.push('Unreviewed moulded head/headgear combination');
  return errors;
}
export function presetFigure(preset){
  if(!preset?.figure||preset.compatibility?.status==='unavailable')throw new Error('This preset cannot be assembled.');
  return structuredClone(preset.figure);
}
const normalized=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterPresets(presets,{query='',theme='',archetype='',species='',kind='',compatibility='',collection='',sort='name',favorites=[],recent=[]}={}){
  const words=normalized(query).trim().split(/\s+/).filter(Boolean);
  const selected=new Set(collection==='favorites'?favorites:recent);
  return presets.filter(p=>(!theme||p.theme===theme||p.themes?.includes(theme))&&(!archetype||p.archetypes?.includes(archetype))&&(!species||p.species===species)&&(!kind||p.kind===kind)&&(!compatibility||p.compatibility.status===compatibility)&&(!collection||selected.has(p.id))&&words.every(w=>normalized([p.name,p.description,p.theme,p.category,p.faction,p.species,p.originalId,...p.originalIds||[],...p.tags,...p.archetypes||[],...p.aliases||[]].join(' ')).includes(w))).sort((a,b)=>sort==='recent'?((recent.indexOf(a.id)<0?Infinity:recent.indexOf(a.id))-(recent.indexOf(b.id)<0?Infinity:recent.indexOf(b.id))||a.name.localeCompare(b.name)):sort==='theme'?(a.theme.localeCompare(b.theme)||a.name.localeCompare(b.name)):a.name.localeCompare(b.name));
}
export function readPresetPreferences(storage){
  try{const data=JSON.parse(storage.getItem('bricktrait.presets.v1'));return {favorites:[...new Set(data?.favorites?.filter(x=>typeof x==='string')||[])].slice(0,2000),recent:[...new Set(data?.recent?.filter(x=>typeof x==='string')||[])].slice(0,30)};}catch{return {favorites:[],recent:[]};}
}
