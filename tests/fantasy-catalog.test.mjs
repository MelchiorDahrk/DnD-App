import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import rules from '../vendor/bricktrait/fantasy-catalog.json' with {type:'json'};
import cmfs from '../vendor/bricktrait/cmf-catalog.json' with {type:'json'};
import {selectableCatalog,browseParts,isCMFPart,partThemes} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
import {search} from '../vendor/bricktrait/src/lib/search.ts';
import {state} from './helpers/bricktrait-state.mjs';
const parts=Object.entries(rules.categories).flatMap(([cat,entries])=>Object.entries(entries).map(([id,name])=>({id,name,cat})));
parts.push({id:'3885',name:'Sword Darksaber',cat:'hand',theme:'Star Wars'},{id:'5525',name:'Sci-fi antenna',cat:'hand'},
  {id:'future-head',name:'Unclassified printed head Pattern',cat:'head'},{id:'future-torso',name:'Unclassified torso',cat:'torso'});

test('All Parts includes every supported slot regardless of theme metadata and historical exclusions',()=>{
  assert.deepEqual(selectableCatalog(parts),parts);
  assert.ok(search(selectableCatalog(parts),'darksaber').some(p=>p.id==='3885'));
  assert.ok(search(selectableCatalog(parts),'antenna').some(p=>p.id==='5525'));
  assert.deepEqual(selectableCatalog([...parts,{id:'3001',cat:'equipment'},{id:'3818',cat:'body'}]),parts);
});
test('themes only organize browsing; searching spans all themes and unclassified parts stay selectable',()=>{
  const dark=parts.find(p=>p.id==='3885'),unclassified=parts.find(p=>p.id==='5525');
  assert.ok(browseParts(parts,{theme:'Star Wars'}).includes(dark));
  assert.ok(!browseParts(parts,{theme:'Castle'}).includes(dark));
  assert.ok(browseParts(parts,{theme:'unclassified'}).includes(unclassified));
  assert.ok(search(browseParts(parts,{theme:'Castle',collection:'fantasy',query:'darksaber'}),'darksaber').includes(dark));
  assert.ok(browseParts(parts).includes(unclassified));
  assert.deepEqual(partThemes({id:'future',cat:'head',themes:['Star Wars','Castle']}),['Star Wars','Castle']);
});
test('1000 random figures use the full supported catalog and unclassified anatomy can be selected',()=>{
  const allowed=new Set([...parts.map(p=>p.id),'standard']);
  for(let i=0;i<1000;i++){
    state.randomize(parts);
    for(const [slot,part] of Object.entries(state.portrait.figure))if(slot!=='pose'&&part.id)assert.ok(allowed.has(part.id),part.id);
  }
  state.randomize(parts.filter(p=>p.id==='future-head'||p.id==='future-torso'));
  assert.equal(state.portrait.figure.head.id,'future-head');assert.equal(state.portrait.figure.torso.id,'future-torso');
});
test('random generation tolerates missing optional slots and preserves the current figure without anatomy',()=>{
  state.randomize(parts.filter(p=>['head','torso'].includes(p.cat)));
  assert.equal(state.portrait.figure.legs.id,'standard');
  for(const key of ['headgear','neck','back','handR','handL'])assert.equal(state.portrait.figure[key].id,null);
  const before=structuredClone(state.portrait.figure);state.randomize([]);assert.deepEqual(state.portrait.figure,before);
});
test('previously excluded components round-trip with colors, poses, cameras and legacy shares',()=>{
  const design=structuredClone(state.initial);design.figure.handR.id='3885';design.figure.handR.color=4;design.figure.pose.armR=35;
  design.view={yaw:21,pitch:10,zoom:.65};design.style={...design.style,background:'space',ring:true,shape:'round'};
  assert.deepEqual(state.fromHash(state.toHash(design)),design);
  assert.deepEqual(state.fromHash(btoa(JSON.stringify([design.figure,design.view,design.style]))),design);
});
test('CMF metadata is optional and does not remove other selectable parts',()=>{
  const list=Object.entries(cmfs.categories).flatMap(([cat,entries])=>Object.entries(entries).map(([id,name])=>({id,name,cat})));
  assert.ok(list.length);assert.ok(list.every(isCMFPart));
  assert.deepEqual(search(list,'cmf'),list);
  assert.ok(browseParts([...list,{id:'unclassified',name:'Unknown',cat:'head'}]).some(p=>p.id==='unclassified'));
});
test('every bundled valid minifigure part is exposed under All Parts',{skip:false},async t=>{
  let catalog;try{catalog=JSON.parse(await readFile(new URL('../vendor/bricktrait/static/ldraw/catalog.json',import.meta.url),'utf8'));}catch{t.skip('Generated at build time');return;}
  const expected=catalog.filter(p=>!['body','equipment'].includes(p.cat)&&!p.attachmentOnly);
  assert.deepEqual(selectableCatalog(catalog),expected);
  assert.deepEqual(browseParts(catalog),expected);
  for(const id of Object.keys(rules.exclude))if(catalog.some(p=>p.id===id&&!p.attachmentOnly))assert.ok(selectableCatalog(catalog).some(p=>p.id===id),id);
});
