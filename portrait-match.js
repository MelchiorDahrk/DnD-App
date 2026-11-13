import {DESCRIPTOR_VERSION} from './portrait-image-analysis.js';

// [colour, silhouette, pattern, edges, complexity]. Similarity, never probability.
export const MATCH_WEIGHTS={head:[.35,.15,.3,.15,.05],headgear:[.15,.5,.12,.18,.05],neck:[.2,.4,.15,.2,.05],back:[.3,.3,.2,.15,.05],torso:[.4,.1,.3,.15,.05],legs:[.4,.15,.25,.15,.05],hand:[.1,.55,.1,.2,.05]};
// Conservative gates; photographic calibration is still needed. No automatic colours.
export const MATCH_THRESHOLDS={minimum:.56,strong:.84,gap:.07,shortlist:48};
export const slotCategory=slot=>slot==='handR'||slot==='handL'?'hand':slot;
const clamp=v=>Math.max(0,Math.min(1,v));
export function rgbToLab(rgb) {
  const [r,g,b]=rgb.map(v=>{v/=255;return v>.04045?((v+.055)/1.055)**2.4:v/12.92;});
  const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
  const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
  return [116*y-16,500*(x-y),200*(y-z)];
}
export function estimateColors(descriptor,palette) {
  if(!descriptor?.dominant?.length)return [];
  const lab=rgbToLab(descriptor.dominant[0]);
  return palette.filter(c=>!c.alpha&&/^#?[a-f\d]{6}$/i.test(c.hex)).map(c=>{
    const hex=c.hex.replace('#',''),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)),other=rgbToLab(rgb);
    // Chroma matters more than lighting differences.
    const delta=Math.hypot((lab[0]-other[0])*.55,lab[1]-other[1],lab[2]-other[2]);
    return {code:c.code,distance:Math.round(delta*100)/100};
  }).sort((a,b)=>a.distance-b.distance||a.code-b.code).slice(0,3);
}
const vector=(a,b)=>1-a.reduce((s,n,i)=>s+Math.abs(n-b[i]),0)/(255*a.length);
function colourScore(query,ref) {
  let hist=ref.hist;
  if(ref.base>20&&query.dominant?.length){
    hist=ref.fixed.slice();const [r,g,b]=query.dominant[0];hist[(r>>6)*16+(g>>6)*4+(b>>6)]+=ref.base;
  }
  const a=query.hist.reduce((s,n)=>s+n,0)||1,b=hist.reduce((s,n)=>s+n,0)||1;
  return clamp(query.hist.reduce((s,n,i)=>s+Math.sqrt(n/a*hist[i]/b),0));
}
export function compareDescriptors(query,ref,category,stageA=false) {
  const shape=.5*Math.exp(-Math.abs(Math.log(query.aspect/ref.aspect)))+.35*vector(query.mask,ref.mask)+.15*(1-Math.abs(query.fill-ref.fill));
  const color=colourScore(query,ref);
  if(stageA)return category==='hand'||category==='headgear'?.75*shape+.25*color:.55*color+.45*shape;
  const values=[color,shape,vector(query.gray,ref.gray),vector(query.edges,ref.edges),1-Math.abs(query.complexity-ref.complexity)/255];
  return clamp(values.reduce((s,n,i)=>s+n*MATCH_WEIGHTS[category][i],0));
}
export function validateMatchIndex(index) {
  if(index?.version!==DESCRIPTOR_VERSION||!Array.isArray(index.parts)||!index.parts.length||index.parts.length>10000)throw new Error('Matching data is unavailable or out of date. Browse the part palette instead.');
  const ids=new Set();
  for(const p of index.parts){
    if(typeof p.id!=='string'||!/^(?:unf\/)?[a-zA-Z0-9_-]{1,100}$/.test(p.id)||ids.has(p.id)||!Object.hasOwn(MATCH_WEIGHTS,p.cat)||!Array.isArray(p.views)||!p.views.length)throw new Error('Invalid matching catalog.');ids.add(p.id);
    for(const d of p.views){
      if(!Number.isFinite(d.aspect)||d.aspect<=0||!Number.isFinite(d.fill)||!Number.isFinite(d.base)||!Number.isFinite(d.complexity)||!Array.isArray(d.dominant)||!d.dominant.length||d.dominant.some(rgb=>!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)||v<0||v>255)))throw new Error('Invalid matching descriptor.');
      for(const [key,length] of [['mask',64],['gray',64],['hist',64],['fixed',64],['edges',16]])if(!Array.isArray(d[key])||d[key].length!==length||d[key].some(v=>!Number.isInteger(v)||v<0||v>255))throw new Error('Invalid matching descriptor.');
    }
  }
  return index;
}
export function matchPortraitSlot(slot,descriptor,index,catalog,palette,{visible=true,thresholds=MATCH_THRESHOLDS}={}) {
  const empty={slot,candidates:[],colors:[],uncertain:true,status:'unresolved'};
  if(!visible||!descriptor||descriptor.coverage<.06)return empty;
  const cat=slotCategory(slot),valid=new Set(catalog.filter(p=>p.cat===cat).map(p=>p.id));
  if(!Object.hasOwn(MATCH_WEIGHTS,cat))return empty;
  const shortlist=index.parts.filter(p=>p.cat===cat&&valid.has(p.id)).map(p=>({p,score:Math.max(...p.views.map(d=>compareDescriptors(descriptor,d,cat,true)))})).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id,'en')).slice(0,thresholds.shortlist);
  const ranked=shortlist.map(({p})=>({id:p.id,score:Math.round(Math.max(...p.views.map(d=>compareDescriptors(descriptor,d,cat)))*10000)/10000,color:null})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id,'en'));
  const colors=estimateColors(descriptor,palette);
  if(!ranked.length||ranked[0].score<thresholds.minimum)return {...empty,colors};
  const strong=descriptor.quality>=.8&&ranked[0].score>=thresholds.strong&&ranked[0].score-(ranked[1]?.score??0)>=thresholds.gap;
  return {slot,candidates:ranked.slice(0,5),colors,uncertain:!strong,status:strong?'strong':'ambiguous'};
}
