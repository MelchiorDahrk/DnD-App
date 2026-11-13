import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {extractDescriptor,foregroundMask,clampRect,regionRect,REGION_TEMPLATE,DESCRIPTOR_VERSION} from '../portrait-image-analysis.js';
import {matchPortraitSlot,estimateColors,validateMatchIndex,compareDescriptors} from '../portrait-match.js';
import {fantasyCatalog,isClassicFantasyPart,isCMFPart,partThemes} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
import {referenceFingerprint} from '../scripts/build-portrait-match-index.mjs';

function fixture({rgb=[180,0,0],shape='square',noise=0}={}){
  const width=64,height=64,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const inside=shape==='thin'?x>=28&&x<36&&y>=4&&y<60:x>=10&&x<54&&y>=10&&y<54;
    const i=(y*width+x)*4;
    if(inside){for(let c=0;c<3;c++)data[i+c]=rgb[c]+(noise?((x*17+y*31)%noise)-noise/2:0);data[i+3]=255;}
  }
  return {data,width,height};
}
const desc=options=>extractDescriptor(fixture(options),{transparent:true});
const palette=[{code:4,name:'Red',hex:'#b40000'},{code:1,name:'Blue',hex:'#1e5aa8'},{code:14,name:'Yellow',hex:'#fac80a'}];
const part=(id,cat,options)=>({id,cat,views:[desc(options)]});
const index={version:DESCRIPTOR_VERSION,parts:[part('red','torso',{}),part('blue','torso',{rgb:[30,90,168]}),part('square','hand',{}),part('thin','hand',{shape:'thin'})]};
const catalog=index.parts.map(({id,cat})=>({id,cat,name:id}));

test('feature extraction and ranked results are deterministic, bounded and slot filtered',()=>{
  assert.deepEqual(desc({noise:8}),desc({noise:8}));
  const first=matchPortraitSlot('torso',desc({noise:8}),index,catalog,palette);
  assert.deepEqual(first,matchPortraitSlot('torso',desc({noise:8}),index,catalog,palette));
  assert.equal(first.candidates[0].id,'red');
  assert.ok(first.candidates.every(c=>['red','blue'].includes(c.id)&&c.score>=0&&c.score<=1&&c.color===null));
  assert.equal(matchPortraitSlot('handR',desc({shape:'thin'}),index,catalog,palette).candidates[0].id,'thin');
  assert.equal(matchPortraitSlot('handL',desc(),index,catalog,palette).candidates[0].id,'square');
});
test('colour and silhouette comparisons tolerate modest noise and distinguish obvious differences',()=>{
  const red=desc(),blue=desc({rgb:[30,90,168]}),noisy=desc({noise:14}),thin=desc({shape:'thin'});
  assert.ok(compareDescriptors(noisy,red,'torso')>compareDescriptors(noisy,blue,'torso'));
  assert.ok(compareDescriptors(thin,thin,'hand')>compareDescriptors(thin,red,'hand'));
  assert.equal(estimateColors(red,palette)[0].code,4);assert.equal(estimateColors(blue,palette)[0].code,1);
  assert.equal(estimateColors(red,palette).length,3);assert.deepEqual(estimateColors(null,palette),[]);
});
test('duplicate-looking parts remain ambiguous and no unapproved ID can enter a shortlist',()=>{
  const duplicate={...index,parts:[part('a','torso',{}),part('b','torso',{}),part('invented','torso',{})]};
  const result=matchPortraitSlot('torso',desc(),duplicate,[{id:'a',cat:'torso'},{id:'b',cat:'torso'}],palette);
  assert.equal(result.status,'ambiguous');assert.equal(result.uncertain,true);
  assert.deepEqual(result.candidates.map(c=>c.id),['a','b']);
  assert.deepEqual(matchPortraitSlot('torso',desc(),index,[],palette).candidates,[]);
});
test('missing, obscured, unsupported and insufficient regions stay unresolved',()=>{
  for(const descriptor of [null,{...desc(),coverage:.01}])assert.equal(matchPortraitSlot('head',descriptor,index,catalog,palette).status,'unresolved');
  assert.deepEqual(matchPortraitSlot('torso',desc(),index,catalog,palette,{visible:false}).candidates,[]);
  assert.deepEqual(matchPortraitSlot('unknown',desc(),index,catalog,palette).candidates,[]);
  assert.deepEqual(matchPortraitSlot('torso',desc(),index,catalog,palette,{thresholds:{minimum:1.01,shortlist:48}}).candidates,[]);
  const blank=fixture();blank.data.fill(0);assert.equal(extractDescriptor(blank,{transparent:true}),null);
  assert.throws(()=>extractDescriptor({data:[],width:10,height:10}));
});
test('cluttered backgrounds are flagged, crop boundaries remain valid, and each photograph has independent regions',()=>{
  const image=fixture();for(let i=0;i<image.data.length;i+=4){image.data[i]=(i*7)%255;image.data[i+1]=(i*13)%255;image.data[i+3]=255;}
  assert.equal(foregroundMask(image).reliable,false);
  const a=structuredClone(REGION_TEMPLATE),b=structuredClone(REGION_TEMPLATE);a.head[0]=.8;assert.notDeepEqual(a.head,b.head);
  assert.deepEqual(clampRect([-.1,.9,2,2]),[0,.9,1,1-.9]);
  assert.deepEqual(regionRect([.1,.2,.8,.6],[.25,0,.5,.5]),[.30000000000000004,.2,.4,.3]);
});
test('matching data rejects schema drift, corrupt vectors and duplicate IDs',()=>{
  assert.equal(validateMatchIndex(index),index);
  for(const changed of [{...index,version:-1},{...index,parts:[index.parts[0],index.parts[0]]},{...index,parts:[{...index.parts[0],cat:'body'}]},{...index,parts:[{...index.parts[0],views:[{...desc(),hist:[NaN]}]}]}])assert.throws(()=>validateMatchIndex(changed));
});
test('generated reference index covers the approved catalog, memberships and all transparent thumbnails',async t=>{
  let built;try{built=JSON.parse(await readFile(new URL('../vendor/bricktrait/static/portrait-match-index.json',import.meta.url),'utf8'));}catch{t.skip('Generated by npm run build; build validates the same schema.');return;}
  validateMatchIndex(built);
  const source=JSON.parse(await readFile(new URL('../vendor/bricktrait/static/ldraw/catalog.json',import.meta.url),'utf8'));
  const allowed=[...fantasyCatalog(source),{id:'standard',cat:'legs'}];
  assert.deepEqual(new Set(built.parts.map(p=>p.id)),new Set(allowed.map(p=>p.id)));
  assert.equal(built.sourceHash,await referenceFingerprint(allowed.sort((a,b)=>a.id.localeCompare(b.id,'en'))),'Rebuild index when sources change');
  assert.ok(Buffer.byteLength(JSON.stringify(built))<5*1024*1024);
  for(const p of built.parts){assert.equal(p.fantasy,isClassicFantasyPart(p));assert.equal(p.cmf,isCMFPart(p));assert.deepEqual(p.themes,partThemes(p));assert.ok(p.views.every(d=>d.coverage<.95&&d.coverage>0),'Reference has transparent margins');assert.ok((await stat(new URL(`../vendor/bricktrait/static/thumbs/${p.id}.webp`,import.meta.url))).size>0);}
});
