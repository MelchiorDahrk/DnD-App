import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import catalog from '../vendor/bricktrait/preset-catalog.json' with {type:'json'};
import baseline from '../reports/minifigure-baseline.json' with {type:'json'};
test('all pre-expansion preset identities survive catalog expansion',()=>{
  const ids=new Set(catalog.presets.map(p=>p.id));
  for(const id of baseline.presetIds)assert.ok(ids.has(id),id);
});
test('removed upstream apron geometry retains authorship and can be rebuilt offline',async()=>{
  for(const part of ['3815bp01.dat','s/3815bp01s01.dat']){
    const text=await fs.readFile(resolve('vendor/bricktrait/presets/legacy-ldraw/parts',part),'utf8');
    assert.match(text,/0 Author:/);assert.match(text,/0 !LICENSE Licensed under CC BY 4.0/);
  }
});
test('generated part packs and all offline shared dependencies exist',async t=>{
  let parts,deps;
  try{parts=JSON.parse(await fs.readFile('vendor/bricktrait/static/ldraw/catalog.json','utf8'));deps=JSON.parse(await fs.readFile('vendor/bricktrait/static/ldraw/dependencies.json','utf8'));}
  catch{t.skip('Generated during npm run build');return;}
  const root=resolve('vendor/bricktrait/static/ldraw');
  for(const p of parts){assert.ok(deps[p.id],p.id);await fs.access(resolve(root,'p',p.id+'.ldr'));}
  for(const file of new Set(Object.values(deps).flat()))await fs.access(resolve(root,file));
});
