import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {compileModule} from 'svelte/compiler';
import catalog from '../vendor/bricktrait/preset-catalog.json' with {type:'json'};
import assets from '../vendor/bricktrait/presets/asset-manifest.json' with {type:'json'};
import mappings from '../vendor/bricktrait/presets/mappings.json' with {type:'json'};
import {configurationKey,validatePreset,presetFigure,filterPresets,emptyFigure,readPresetPreferences} from '../vendor/bricktrait/src/lib/presets.js';
import {assembleInventory,resolveExternalPart,resolveExternalColor,parseMPD,flattenModel,deduplicatePresets} from '../scripts/lib/minifigure-presets.mjs';
import {buildPresets,applyPresetOverrides} from '../scripts/build-minifigure-presets.mjs';
import {validPortrait} from '../portrait.js';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {state} from './helpers/bricktrait-state.mjs';
const vendor=resolve(import.meta.dirname,'../vendor/bricktrait');

test('the populated catalog validates every component and color and has no duplicate configurations or IDs',async()=>{
  for(const kind of ['official','original']){
    const entries=catalog.presets.filter(p=>p.kind===kind);
    assert.ok(entries.length,`${kind} collection is populated`);
    assert.equal(entries.length,catalog.stats[kind],`${kind} summary matches the catalog`);
  }
  for(const status of ['complete','partial'])assert.equal(catalog.presets.filter(p=>p.compatibility.status===status).length,catalog.stats[status]);
  const ids=new Set(),configs=new Set();
  for(const p of catalog.presets){
    assert.deepEqual(validatePreset(p,assets.parts,assets.colors),[],p.id);
    assert.ok(!ids.has(p.id),p.id);ids.add(p.id);
    const key=`${p.kind}/${configurationKey(p.figure)}`;assert.ok(!configs.has(key),p.id);configs.add(key);
    assert.notEqual(p.compatibility.status,'unavailable');
    assert.equal(p.compatibility.status==='partial',p.compatibility.issues.length>0,p.id);
    await access(resolve(vendor,'presets/thumbnails',p.id+'.webp'));
    assert.ok(readFileSync(resolve(vendor,'presets/thumbnails',p.id+'.webp')).subarray(8,12).toString()==='WEBP');
  }
  assert.equal(ids.size,catalog.stats.total);
});
test('schema validation rejects wrong slots, unknown colors and malformed poses',()=>{
  assert.deepEqual(validatePreset(null,assets.parts,assets.colors),['Preset must be an object']);
  assert.ok(validatePreset({tags:'bad',sources:{}},assets.parts,assets.colors).length);
  const p=structuredClone(catalog.presets[0]);p.figure.head.id=p.figure.torso.id;p.figure.legs.color=-99;delete p.figure.pose.armR;
  const errors=validatePreset(p,assets.parts,assets.colors);
  assert.ok(errors.some(e=>e.startsWith('Invalid head part')));assert.ok(errors.some(e=>e.includes('legs.color')));assert.ok(errors.includes('Invalid pose armR'));
});
test('manual corrections preserve source references and unmodified slot fields',()=>{
  const source=catalog.presets.find(p=>p.kind==='official'),before=structuredClone(source);
  const corrected=applyPresetOverrides(source,{name:'Reviewed identity',figure:{head:{color:78},pose:{head:10}}});
  assert.equal(corrected.figure.head.id,source.figure.head.id);assert.equal(corrected.figure.head.color,78);
  assert.equal(corrected.figure.pose.armR,source.figure.pose.armR);assert.equal(corrected.figure.pose.head,10);
  assert.deepEqual(corrected.sources,source.sources);assert.deepEqual(source,before);
});
test('external mappings require exact evidence; IDs and color numbers are never assumed interchangeable',()=>{
  const parts=new Map(assets.parts.map(p=>[p.id,p]));
  assert.equal(resolveExternalPart({part_num:'3626cp01'},parts),null);
  assert.equal(resolveExternalPart({part_num:'rb-print',external_ids:{LDraw:['missing','3626cp01']}},parts),'3626cp01');
  assert.equal(resolveExternalPart({part_num:'rb-print',external_ids:{BrickLink:['3626cp01']}},parts),null);
  assert.equal(resolveExternalPart({part_num:'manual'},parts,{parts:{manual:'3626cp01'}}),'3626cp01');
  assert.equal(resolveExternalColor({id:14}),null);
  assert.equal(resolveExternalColor({id:14,external_ids:{LDraw:{ext_ids:[4]}}}),4);
  assert.equal(resolveExternalColor({id:14},{colors:{14:1}}),1);
});
test('incomplete inventories never receive random anatomy or ambiguous attachments',()=>{
  const inventory=[{id:'3626cp01',color:14},{id:'973p43',color:1},{id:'3815',color:0},{id:'3816',color:0},{id:'3817',color:0},{id:'3818',color:1},{id:'3819',color:1},{id:'3820',color:14},{id:'3820',color:14}];
  const p=assets.parts.concat(['3815','3816','3817'].map(id=>({id,name:'Core component',cat:'body'})));
  assert.equal(assembleInventory(inventory,p).compatibility.status,'complete');
  const noHead=assembleInventory(inventory.filter(p=>p.id!=='3626cp01'),p);
  assert.equal(noHead.compatibility.status,'unavailable');assert.equal(noHead.figure.head.id,null);
  const duplicate=assembleInventory([...inventory,{id:'3626cp01',color:14}],p);
  assert.equal(duplicate.compatibility.status,'unavailable');
  const extra=assembleInventory([...inventory,{id:'unmatched-print',color:4}],p);
  assert.equal(extra.compatibility.status,'partial');assert.equal(extra.compatibility.issues[0].part,'unmatched-print');
  assert.throws(()=>presetFigure({...noHead}),/cannot be assembled/);
  const external=assembleInventory([{part:{part_num:'unknown'},color:{id:99},quantity:1}],p,{sourceKind:'rebrickable'});
  assert.equal(external.compatibility.status,'unavailable');assert.equal(external.compatibility.issues[0].part,'unknown');
  const duplicateExternal=assembleInventory([{part:{part_num:'head',external_ids:{LDraw:['3626cp01']}},color:{id:14,external_ids:{LDraw:{ext_ids:[14]}}},quantity:2}],p,{sourceKind:'rebrickable'});
  assert.ok(duplicateExternal.compatibility.issues.some(i=>i.reason==='Multiple components compete for one slot'));
});
test('reviewed printed-leg mappings preserve exact colors and reject incompatible hip colors',()=>{
  const base=[{id:'3626cp01',color:14},{id:'973p43',color:1}];
  const parts=[...assets.parts,{id:'73200bpw2',cat:'legs',name:'Hips and Legs with Blue/White Triangles, Fringe Pattern'},{id:'3815b',cat:'legs',name:'Hips'}];
  const legs=[{id:'3815b',color:1},{id:'3816bpw2',color:19},{id:'3817bpw2',color:19}];
  const exact=assembleInventory([...base,...legs],parts,{mappings});assert.equal(exact.figure.legs.id,'73200bpw2');assert.equal(exact.figure.legs.color,19);
  const wrong=assembleInventory([...base,...legs.map(p=>p.id==='3815b'?{...p,color:4}:p)],parts,{mappings});assert.equal(wrong.compatibility.status,'unavailable');
});
test('MPD conversion inherits colors and transforms, resolves nested submodels and rejects cycles',()=>{
  const files=parseMPD('0 FILE main.ldr\n1 4 10 0 0 1 0 0 0 1 0 0 0 1 child.ldr\n0 FILE child.ldr\n1 16 0 5 0 1 0 0 0 1 0 0 0 1 3626cp01.dat');
  const items=flattenModel(files,'main.ldr',new Map());assert.equal(items[0].id,'3626cp01');assert.equal(items[0].color,4);assert.deepEqual(items[0].at,[10,5,0]);
  files.set('child.ldr',['1 16 0 0 0 1 0 0 0 1 0 0 0 1 main.ldr']);assert.throws(()=>flattenModel(files,'main.ldr',new Map()),/Cyclic/);
});
test('deduplication preserves distinct source identities and search metadata',()=>{
  const p=structuredClone(catalog.presets.find(p=>p.kind==='official'));
  const second={...structuredClone(p),id:'other-identity',name:'Second identity',theme:'Another theme',originalId:'another-source',compatibility:{status:'partial',issues:[{part:'cape',reason:'Missing'}]}};
  const result=deduplicatePresets([p,second]);assert.equal(result.presets.length,1);
  assert.ok(filterPresets(result.presets,{query:'Second identity'}).length);assert.ok(filterPresets(result.presets,{theme:'Another theme'}).length);
  assert.equal(result.presets[0].compatibility.status,'partial');assert.equal(result.duplicates.length,1);
  const stable=deduplicatePresets([{...structuredClone(p),id:'z-established'},{...structuredClone(p),id:'a-new-source'}],{preferredIds:['z-established']});
  assert.equal(stable.presets[0].id,'z-established','refresh preserves established canonical IDs');
});
test('preset application is cloned, undoable as one action, and leaves view/style and saved portraits alone',async()=>{
  const historyPath=resolve(import.meta.dirname,'../.tmp/bricktrait-history-test.mjs');
  const text=stripTypeScriptTypes(await readFile(resolve(vendor,'src/lib/history.svelte.ts'),'utf8')).replace("from './state.svelte'",`from '${pathToFileURL(resolve(import.meta.dirname,'../.tmp/bricktrait-state-test.mjs')).href}'`);
  await writeFile(historyPath,compileModule(text,{filename:'history.svelte.js',generate:'server'}).js.code);
  const history=await import(pathToFileURL(historyPath));
  Object.assign(state.portrait,structuredClone(state.initial));history.track(state.portrait);
  const before=structuredClone(state.portrait),preset=catalog.presets.find(p=>p.kind==='original');
  history.transaction(()=>state.portrait.figure=presetFigure(preset));
  const applied=structuredClone(state.portrait);assert.deepEqual(applied.view,before.view);assert.deepEqual(applied.style,before.style);
  state.portrait.figure.torso.color=4;
  history.transaction(()=>state.portrait.figure=presetFigure(catalog.presets[0]));
  history.undo();assert.equal(state.portrait.figure.torso.color,4,'pending customization is its own history step');
  history.undo();assert.deepEqual(state.portrait,applied);
  history.undo();assert.deepEqual(state.portrait,before);
  history.redo();assert.deepEqual(state.portrait,applied);
  assert.deepEqual(preset.figure,presetFigure(preset));
});
test('customized presets round-trip through portrait shares and character backups; old portraits still open',()=>{
  const design={...structuredClone(state.initial),figure:presetFigure(catalog.presets.find(p=>p.kind==='original'))};
  design.figure.torso.color=4;design.figure.pose.armR=35;design.view.yaw=20;
  const image='data:image/webp;base64,UklGRg==',portrait={image,design};assert.ok(validPortrait(portrait));
  const c=makeCharacter({portrait});const backup={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
  assert.deepEqual(parseBackup(JSON.stringify(backup)).characters[0].portrait,portrait);
  assert.deepEqual(state.fromHash(state.toHash(design)),design);
  const old=structuredClone(state.initial);delete old.figure.neck;delete old.figure.back;delete old.figure.pose;
  const reopened=state.fromHash(btoa(JSON.stringify([old.figure,old.view,old.style])));assert.ok(reopened.figure.neck);assert.deepEqual(reopened.figure.pose,emptyFigure().pose);
});
test('search, themes, archetypes, species, compatibility and personal collections compose',()=>{
  const elves=filterPresets(catalog.presets,{kind:'original',species:'Elf'});assert.ok(elves.length>=4);
  assert.ok(filterPresets(catalog.presets,{query:'forestmen',kind:'official'}).length);
  assert.ok(filterPresets(catalog.presets,{archetype:'Wizard',compatibility:'complete'}).length);
  const p=elves[0];assert.deepEqual(filterPresets(catalog.presets,{collection:'favorites',favorites:[p.id]}),[p]);
  assert.deepEqual(filterPresets(catalog.presets,{collection:'recent',recent:[elves[1].id,p.id],sort:'recent'}).map(p=>p.id),[elves[1].id,p.id]);
  assert.deepEqual(filterPresets(catalog.presets,{query:'nonexistent-figure-zzzzz'}),[]);
  assert.deepEqual(readPresetPreferences({getItem:()=>'{broken'}),{favorites:[],recent:[]});
});
test('catalog regeneration is reproducible and respects checked-in corrections',{skip:!existsSync(resolve(vendor,'static/ldraw/catalog.json'))},async()=>{
  const first=await buildPresets({writeOutput:false}),second=await buildPresets({writeOutput:false});
  assert.deepEqual(first,second);assert.deepEqual(first.catalog,catalog);
});
