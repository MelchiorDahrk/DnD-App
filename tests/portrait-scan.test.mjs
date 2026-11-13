import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePortraitPhotos,validatePortraitSuggestions,applyPortraitSelections} from '../portrait-scan.js';

const image='data:image/jpeg;base64,/9j/2Q==';
const catalog=[{id:'3626cp01',cat:'head',name:'Standard grin'},{id:'93563',cat:'headgear',name:'Mohawk'},{id:'973pc25',cat:'torso',name:'Vampire vest'},{id:'standard',cat:'legs',name:'Standard legs'}];
const colors=[{code:14,name:'Yellow'},{code:4,name:'Red'},{code:0,name:'Black'}];
const selection=(slot='headgear',id='93563')=>({slot,id,color:4,arms:null,hands:null,hips:null,confidence:'high',reason:'Visible red mohawk. Closest available mould.'});
const suggestions=()=>({isMinifigure:true,summary:'Yellow minifigure with a red mohawk.',warnings:['The torso is obscured.'],selections:[selection()]});

test('portrait photos are bounded and reject unsupported uploads',()=>{
  assert.deepEqual(validatePortraitPhotos([image]),[image]);
  for(const photos of [[],Array(4).fill(image),['https://example.com/photo.jpg'],['data:image/svg+xml;base64,AAAA']])assert.throws(()=>validatePortraitPhotos(photos));
});

test('suggestions reject invented IDs, wrong slots, duplicate slots, invalid colours, removals and extra fields',()=>{
  assert.deepEqual(validatePortraitSuggestions(suggestions(),catalog,colors),suggestions());
  const bad=[{id:'invented'},{slot:'torso'},{color:999999},{arms:14},{confidence:'certain'},{reason:5},{extra:'injected'},{slot:'head',id:null}];
  for(const change of bad)assert.throws(()=>validatePortraitSuggestions({...suggestions(),selections:[{...selection(),...change}]},catalog,colors));
  assert.throws(()=>validatePortraitSuggestions({...suggestions(),selections:[selection(),selection()]},catalog,colors));
  assert.throws(()=>validatePortraitSuggestions({...suggestions(),selections:[]},catalog,colors));
  assert.throws(()=>validatePortraitSuggestions({...suggestions(),isMinifigure:false},catalog,colors));
});

test('reviewed selections preserve unselected parts, pose, source data and unknown colours',()=>{
  const original={head:{id:'3626cp01',color:14},headgear:{id:null,color:0},neck:{id:'beard',color:4},back:{id:'cape',color:0},torso:{id:'old-shirt',color:0,arms:0,hands:14},legs:{id:'standard',color:0,hips:0},handR:{id:null,color:0,spin:30},handL:{id:null,color:0,spin:0},pose:{armR:25,head:10}};
  const before=structuredClone(original);
  const next=applyPortraitSelections(original,[selection(),{...selection('back',null),color:null},{...selection('torso','973pc25'),color:null,arms:4,hands:14}],catalog,colors);
  assert.deepEqual(original,before);
  assert.deepEqual(next.headgear,{id:'93563',color:4});assert.equal(next.back.id,null);
  assert.deepEqual(next.torso,{id:'973pc25',color:0,arms:4,hands:14});
  for(const slot of ['head','neck','legs','handR','handL','pose'])assert.deepEqual(next[slot],before[slot]);
});

