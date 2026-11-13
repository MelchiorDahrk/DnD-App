import test from 'node:test';
import assert from 'node:assert/strict';
import rules from '../vendor/bricktrait/fantasy-catalog.json' with {type:'json'};
import cmfs from '../vendor/bricktrait/cmf-catalog.json' with {type:'json'};
import themes from '../vendor/bricktrait/theme-catalog.json' with {type:'json'};
import {fantasyCatalog,isFantasyPart,isCMFPart,isClassicFantasyPart} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
import {search} from '../vendor/bricktrait/src/lib/search.ts';
import {state} from './helpers/bricktrait-state.mjs';

const parts=Object.entries(rules.categories).flatMap(([cat,entries])=>Object.entries(entries).map(([id,name])=>({id,name,cat})));
parts.push({id:'3885',name:'Sword Darksaber',cat:'hand',theme:'Star Wars'},{id:'5525',name:'Sci-fi antenna',cat:'hand'},
  {id:'30173a',name:'Sword Katana',cat:'hand',theme:'Ninjago'},{id:'3837',name:'Shovel',cat:'hand',theme:'City'});

test('explicit IDs control fantasy browsing and search regardless of theme metadata',()=>{
  const allowed=fantasyCatalog(parts);
  assert.ok(search(allowed,'sword').length>0);
  assert.deepEqual(search(allowed,'darksaber'),[]);
  assert.deepEqual(search(allowed,'antenna'),[]);
  assert.ok(allowed.some(p=>p.id==='30173a'));
  assert.ok(allowed.some(p=>p.id==='3837'));
  assert.equal(isFantasyPart({id:'new-future-gun',cat:'hand',theme:'Castle'}),false);
  assert.equal(isFantasyPart({id:'3885',cat:'hand'},{...rules,include:{hand:{3885:'test'}}}),false);
  assert.equal(parts.length,allowed.length+2,'filtering preserves the complete source');
});

test('every slot has options, defaults remain valid, and 1000 random figures use only allowed IDs',()=>{
  for(const cat of ['head','headgear','neck','back','torso','legs','hand'])assert.ok(fantasyCatalog(parts).some(p=>p.cat===cat),cat);
  const check=figure=>{
    for(const [slot,part] of Object.entries(figure)) {
      if(slot==='pose'||part.id===null)continue;
      const cat=slot.startsWith('hand')?'hand':slot;
      assert.ok(isFantasyPart({id:part.id,cat}),`${slot}: ${part.id}`);
    }
  };
  check(state.initial.figure);
  for(let i=0;i<1000;i++){state.randomize(parts);check(state.portrait.figure);}
});

test('random generation handles missing optional slots and preserves current figure if mandatory options are missing',()=>{
  state.randomize(parts.filter(p=>['head','torso'].includes(p.cat)));
  assert.equal(state.portrait.figure.legs.id,'standard');
  for(const key of ['headgear','neck','back','handR','handL'])assert.equal(state.portrait.figure[key].id,null);
  const before=structuredClone(state.portrait.figure);
  state.randomize([]);assert.deepEqual(state.portrait.figure,before);
});

test('legacy share links preserve excluded equipped parts and all figure, pose and camera details',()=>{
  const design=structuredClone(state.initial);
  design.figure.handR.id='3885';design.figure.pose.armR=35;design.view={yaw:21,pitch:10,zoom:.65};
  design.style={...design.style,background:'space',ring:true,shape:'round'};
  assert.deepEqual(state.fromHash(state.toHash(design)),design);
  const legacy=btoa(JSON.stringify([design.figure,design.view,design.style]));
  assert.deepEqual(state.fromHash(legacy),design);
});

test('CMF-associated parts extend browsing and search without changing fantasy membership or exclusion priority',()=>{
  const cmfParts=Object.entries(cmfs.categories).flatMap(([cat,entries])=>Object.entries(entries).map(([id,name])=>({id,name,cat})));
  assert.ok(cmfParts.length>=350);
  for(const id of ['93563','973pc25','973pca3','16709p0l']){
    const part=cmfParts.find(p=>p.id===id);assert.ok(part,id);assert.ok(isCMFPart(part));assert.ok(isFantasyPart(part));
    assert.equal(isClassicFantasyPart(part),false);
  }
  const searchable=fantasyCatalog(cmfParts);
  assert.deepEqual(search(searchable,'cmf'),searchable);
  assert.deepEqual(search(searchable,'collectible minifigures'),searchable);
  for(const id of Object.keys(rules.exclude))assert.equal(isFantasyPart({id,cat:'torso'}),false);
});

test('randomization accepts new theme parts and preserves the approved selection boundary', () => {
  const themed = Object.values(themes.themes).flatMap(categories => Object.entries(categories).flatMap(([cat, entries]) =>
    Object.entries(entries).map(([id, name]) => ({id, name, cat}))));
  const unique = [...new Map(themed.map(part => [part.id, part])).values()];
  const added = unique.filter(part => !Object.hasOwn(rules.categories[part.cat] || {}, part.id) &&
    !Object.hasOwn(rules.include[part.cat] || {}, part.id) && !Object.hasOwn(cmfs.categories[part.cat] || {}, part.id));
  assert.ok(added.length > 200, 'theme collections expand the selectable library');
  // A single option per slot checks eligibility while retaining optional empty
  // slots and the randomizer's standard-legs fallback.
  const candidates = ['head', 'headgear', 'neck', 'back', 'torso', 'legs', 'hand'].map(cat =>
    added.find(part => part.cat === cat) || parts.find(part => part.cat === cat));
  state.randomize(candidates);
  for (const [slot, selected] of Object.entries(state.portrait.figure)) {
    if (slot === 'pose' || selected.id === null) continue;
    const cat = slot.startsWith('hand') ? 'hand' : slot;
    assert.ok(isFantasyPart({id:selected.id, cat}), `${slot}: ${selected.id}`);
    assert.ok(selected.id === candidates.find(part => part.cat === cat).id ||
      (cat === 'legs' && selected.id === 'standard'));
  }
});
