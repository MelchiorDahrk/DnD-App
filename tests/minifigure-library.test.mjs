import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {zipSync,strToU8} from 'fflate';
import {fetchLibraries,archivePath} from '../vendor/bricktrait/scripts/fetch-ldraw.mjs';
import {csvRows} from '../scripts/import-rebrickable-bulk.mjs';
import {keywordMappings,verifiedColorMap,torsoInventoryColors,assembleBulkFigure} from '../scripts/lib/rebrickable-inventories.mjs';
const temp=resolve(import.meta.dirname,'../.tmp/library-tests');
test('explicit refresh replaces same-size changed files and removes stale files; ordinary fetch stays offline',async()=>{
  const dest=resolve(temp,'library');await fs.mkdir(dest,{recursive:true});
  await fs.mkdir(resolve(dest,'parts'),{recursive:true});await fs.writeFile(resolve(dest,'parts/one.dat'),'old');
  await fs.writeFile(resolve(dest,'.questlog-complete'),'previous');await fs.writeFile(resolve(dest,'stale.dat'),'old');
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(zipSync({'ldraw/parts/one.dat':strToU8('new'),'ldraw/p/primitive.dat':strToU8('geometry'),'ldraw/CAreadme.txt':strToU8('attribution')}),{status:200,headers:{etag:'new-version'}});};
  try{
    const libraries=[{url:'https://example.test/library.zip',dest}];
    await fetchLibraries({libraries});assert.equal(calls,0);
    await fetchLibraries({refresh:true,libraries});assert.equal(calls,1);
    assert.equal(await fs.readFile(resolve(dest,'parts/one.dat'),'utf8'),'new');
    assert.equal(await fs.access(resolve(dest,'stale.dat')).then(()=>true,()=>false),false);
    assert.equal(JSON.parse(await fs.readFile(resolve(dest,'.questlog-complete'))).etag,'new-version');
    globalThis.fetch=async()=>new Response('unavailable',{status:503});
    await assert.rejects(()=>fetchLibraries({refresh:true,libraries}),/503/);
    assert.equal(await fs.readFile(resolve(dest,'parts/one.dat'),'utf8'),'new','failed download preserves the usable cache');
  }finally{globalThis.fetch=original;}
});
test('archive extraction rejects traversal and supports the official archive prefix',()=>{
  assert.equal(archivePath(temp,'ldraw/parts/a.dat'),resolve(temp,'parts/a.dat'));
  for(const name of ['../outside.dat','ldraw/../../outside.dat','..\\outside.dat'])assert.throws(()=>archivePath(temp,name),/Invalid archive path/);
});
test('bulk CSV preserves quoted commas, escaped quotes, embedded newlines and CRLF',async()=>{
  await fs.mkdir(temp,{recursive:true});const file=resolve(temp,'quoted.csv.gz');
  await fs.writeFile(file,gzipSync('id,name\r\n1,"Red, Blue"\r\n2,"A ""quoted"" head"\r\n3,"Two\nlines"\r\n'));
  const rows=[];for await(const row of csvRows(file))rows.push(row);
  assert.deepEqual(rows,[{id:'1',name:'Red, Blue'},{id:'2',name:'A "quoted" head'},{id:'3',name:'Two\nlines'}]);
});
test('mappings use explicit evidence, reject ambiguous prints and never assume shared numeric colors',()=>{
  const map=keywordMappings([{id:'print1',source:'official',externalIds:['rb-print']},{id:'variant1',source:'official',externalIds:['ambiguous']},{id:'variant2',source:'unofficial',externalIds:['ambiguous']}]);
  assert.equal(map.parts['rb-print'],'print1');assert.equal(map.parts.ambiguous,undefined);assert.equal(map.ambiguous.ambiguous.length,2);
  const colors=verifiedColorMap({14:{name:'Red'},99:{name:'Light Bluish Gray'},5:{name:'Unknown'}},[{code:4,name:'Red'},{code:71,name:'Light Bluish Grey'}]);
  assert.equal(colors.map[14],4);assert.equal(colors.map[99],71);assert.equal(colors.map[5],undefined);
});
test('separate limbs use explicitly named source colors; unknown/printed arms require review',()=>{
  const colors={0:{name:'Black'},14:{name:'Yellow'},4:{name:'Red'}};
  assert.deepEqual(torsoInventoryColors('Torso, Gold Trim Print, Black Arms, Yellow Hands',colors),{arms:0,hands:14});
  assert.equal(torsoInventoryColors('Torso, Black Printed Arms, Yellow Hands',colors),null);
  const data={parts:{head:{name:'Printed Head'},body:{name:'Torso, Gold Trim Print, Black Arms, Yellow Hands'},legs:{name:'Hips and Legs'}},colors};
  const fig={id:'fig-000001',name:'Source CMF',sets:[{id:'71000-1',name:'Source series',year:2024,themes:['Collectible Minifigures']}],parts:[{part_num:'head',color:14,quantity:1},{part_num:'body',color:4,quantity:1},{part_num:'legs',color:0,quantity:1}]};
  const parts=[{id:'head1',cat:'head'},{id:'torso1',cat:'torso'},{id:'legs1',cat:'legs',name:'Hips and Legs'}];
  const result=assembleBulkFigure(fig,data,parts,{parts:{head:'head1',body:'torso1',legs:'legs1'},colors:{0:0,4:4,14:14}});
  assert.equal(result.compatibility.status,'complete');assert.equal(result.figure.torso.arms,0);assert.equal(result.figure.torso.hands,14);
  assert.equal(result.source.parts[1].part.name,data.parts.body.name);
});
test('source snapshot preserves all twelve D&D CMFs and broad theme discovery',async()=>{
  const data=JSON.parse(await fs.readFile(new URL('../vendor/bricktrait/presets/sources/rebrickable-bulk.json',import.meta.url),'utf8'));
  const dnd=data.figures.filter(f=>f.sets.some(s=>s.id.startsWith('71047-')));
  assert.equal(dnd.length,12);assert.ok(dnd.every(f=>f.parts.length>=3));
  assert.ok(data.figures.length>10000);assert.ok(data.figures.some(f=>f.sets.some(s=>s.themes.includes('Star Wars'))));
  for(const fig of dnd)for(const part of fig.parts){assert.ok(data.parts[part.part_num].name);assert.ok(data.colors[part.color]);}
});
