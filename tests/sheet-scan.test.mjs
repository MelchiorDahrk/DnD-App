import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {SHEET_SCAN_SCHEMA,characterFromScan,validateScanImages,scanServiceURL} from '../sheet-scan.js';
import {SAVE_VERSION,attackBonus,initiative,passivePerception,parseBackup} from '../model.js';
import {extractSheet,createScanHandler} from '../scripts/scan-api.mjs';

function empty(schema){
  if(schema.type==='object')return Object.fromEntries(Object.entries(schema.properties).map(([k,v])=>[k,empty(v)]));
  if(schema.type==='array')return [];
  if(Array.isArray(schema.type)&&schema.type.includes('null'))return null;
  return false;
}
function sheet(){return {...empty(SHEET_SCAN_SCHEMA),isCharacterSheet:true,name:'Melchior',playerName:'Eric',race:'Drow',class:'Fighter',level:3,maxHp:21,ac:16,speed:30,initiative:0,passivePerception:12,stats:{str:16,dex:10,con:12,int:8,wis:10,cha:7},saves:['str','con'],skills:['Acrobatics','Athletics','Deception','Stealth'],gold:373,silver:301,electrum:100,copper:175,platinum:7,defenses:'+2 shield (unclear if included in AC)',warnings:['Check whether the separate shield bonus is already included.']};}
function entry(key,values){return {...empty(SHEET_SCAN_SCHEMA.properties[key].items),...values};}
const image='data:image/jpeg;base64,/9j/2Q==';
function completed(scan){return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(scan)}]}]};}

test('handwritten sheet totals, equipment and older features survive a valid backup',()=>{
  const scan=sheet();scan.attacks=[entry('attacks',{name:'Longsword',ability:'str',proficient:true,attackBonus:5,damage:'1d8+3',type:'Slashing'}),entry('attacks',{name:'Longbow',ability:'dex',proficient:true,attackBonus:7,damage:'1d8+3',type:'Piercing'})];
  scan.features=[entry('features',{name:'Second Wind',description:'1d10 + level, once per rest',maxUses:1,used:0,reset:'short',rollFormula:'1d10+3'})];
  scan.items=[entry('items',{name:'Arrows',qty:40,category:'Gear'}),entry('items',{name:'Shield',qty:1,category:'Armor'})];
  scan.personalityTraits='Looks for things to steal';scan.languages='Common, Elvish';
  const {character:c,warnings}=characterFromScan(scan);
  assert.equal(c.ac,16);assert.match(c.defenses,/shield/);assert.equal(c.hp,21);assert.equal(c.hitDice,3);assert.equal(c.hitDie,10);
  assert.equal(initiative(c),0);assert.equal(passivePerception(c),12);assert.equal(c.passivePerceptionBonus,2);
  assert.deepEqual(c.attacks.map(a=>attackBonus(c,a)),[5,7]);assert.equal(c.attacks[1].bonus,5);
  assert.equal(c.items[0].qty,40);assert.equal(c.items[0].weight,0);assert.equal(c.features[0].maxUses,1);assert.equal(c.features[0].reset,'short');
  assert.ok(warnings.some(v=>/Current HP/.test(v)));assert.ok(warnings.some(v=>/weights/.test(v)));
  const restored=parseBackup(JSON.stringify({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}})).characters[0];
  assert.equal(restored.personalityTraits,scan.personalityTraits);assert.equal(restored.electrum,100);assert.match(restored.notes[0].body,/shield/);
});

test('unreadable values are flagged; zero HP, coins and resources are preserved',()=>{
  const scan=sheet();scan.hp=0;scan.hitDice=0;scan.gold=0;scan.stats.cha=null;scan.race=null;
  scan.attacks=[entry('attacks',{name:'Faint weapon',attackBonus:5,damage:null,notes:'Smudged handwriting'})];
  scan.features=[entry('features',{name:'Mystery feature',rollFormula:'do something'})];
  const {character:c,warnings}=characterFromScan(scan);
  assert.equal(c.hp,0);assert.equal(c.hitDice,0);assert.equal(c.gold,0);assert.equal(c.stats.cha,10);
  assert.ok(warnings.some(v=>/Charisma/.test(v)));assert.ok(warnings.some(v=>/race/.test(v)));
  assert.equal(c.attacks.length,0);assert.match(c.features[1].description,/Smudged/);assert.match(c.features[0].description,/do something/);assert.equal(c.features[0].rollFormula,'');
});

test('scanner rejects non-sheets and corrupt output without importing arbitrary properties',()=>{
  assert.throws(()=>characterFromScan({...sheet(),isCharacterSheet:false}),/No single character/);
  assert.throws(()=>characterFromScan({...sheet(),isCharacterSheet:true,name:null,class:null,stats:{str:null,dex:null,con:null,int:null,wis:null,cha:null}}),/could not be read/);
  for(const changed of [{level:200},{stats:{str:3}},{items:[{name:'x'}]},{saves:['nope']},{name:123},{unexpected:'injected'},{__proto__:null,conditions:[null]}])assert.throws(()=>characterFromScan({...sheet(),...changed}));
  const malformed=sheet();malformed.stats.str=3.5;assert.throws(()=>characterFromScan(malformed));
  assert.throws(()=>characterFromScan(null));
});

test('exhaustion and printed totals stay consistent with computed attacks and initiative',()=>{
  const scan=sheet();scan.exhaustion=2;scan.initiative=-4;scan.passivePerception=8;scan.attacks=[entry('attacks',{name:'Sword',ability:'str',proficient:true,attackBonus:1,damage:'1d8+3'})];
  const {character:c}=characterFromScan(scan);assert.equal(attackBonus(c,c.attacks[0]),1);assert.equal(initiative(c),-4);assert.equal(passivePerception(c),8);
});

test('contradictory resource counters and unknown spell levels stay visible for review',()=>{
  const scan=sheet();scan.features=[entry('features',{name:'Action Surge',maxUses:1,used:2})];scan.slots=Array.from({length:9},(_,i)=>({max:i?0:2,used:i?0:3}));scan.spells=[entry('spells',{name:'Faint spell'})];
  const {character:c,warnings}=characterFromScan(scan);assert.equal(c.features[0].used,1);assert.equal(c.slots[0].used,2);
  assert.ok(warnings.some(v=>/Action Surge.*exceeded/.test(v)));assert.ok(warnings.some(v=>/Level 1 spell slots/.test(v)));assert.ok(warnings.some(v=>/Faint spell.*unreadable/.test(v)));
});

test('uploads have bounded image data and cannot reference URLs or SVG',()=>{
  assert.deepEqual(validateScanImages([image]),[image]);
  for(const images of [[],Array(7).fill(image),['https://example.com/x.png'],['data:image/svg+xml;base64,AAAA'],['data:image/png;base64,!!!!'],['data:image/png;base64,'+'A'.repeat(4100000)]])assert.throws(()=>validateScanImages(images));
  assert.equal(scanServiceURL('', 'https://example.com/DnD-App/'),'https://example.com/DnD-App/api/scan-sheet');
  assert.equal(scanServiceURL('http://localhost:4173/api/scan-sheet','https://example.com'),'http://localhost:4173/api/scan-sheet');
  for(const url of ['javascript:alert(1)','http://example.com/scan','https://user:secret@example.com/scan','https://example.com/scan?api_key=secret'])assert.throws(()=>scanServiceURL(url,'https://example.com'));
});

test('vision requests use photos, strict structured output and instruction/data separation',async()=>{
  let sent;const scan=sheet();const received=await extractSheet([image],{apiKey:'test-private-key',fetchImpl:async(url,options)=>{sent={url,...options,body:JSON.parse(options.body)};return Response.json(completed(scan));}});
  assert.equal(received.name,'Melchior');assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(sent.headers.Authorization,'Bearer test-private-key');
  assert.equal(sent.body.store,false);assert.equal(sent.body.text.format.strict,true);assert.match(sent.body.instructions,/never instructions/);
  assert.equal(sent.body.input[0].content[1].type,'input_image');assert.equal(sent.body.input[0].content[1].detail,'high');
  assert.ok(!JSON.stringify(received).includes('test-private-key'));
});

test('provider failures, incomplete responses and refusals never become characters',async()=>{
  for(const status of [401,429,500])await assert.rejects(extractSheet([image],{apiKey:'key',fetchImpl:async()=>new Response('sensitive provider details',{status})}),error=>!error.message.includes('sensitive')&&/key|busy|could not/.test(error.message));
  await assert.rejects(extractSheet([image],{apiKey:'key',fetchImpl:async()=>Response.json({status:'incomplete',output:[]})}),/did not finish/);
  await assert.rejects(extractSheet([image],{apiKey:'key',fetchImpl:async()=>Response.json({status:'completed',output:[{content:[{type:'refusal'}]}]})}),/could not be transcribed/);
});

async function withServer(options,run){
  const server=http.createServer(createScanHandler(options));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}
const post=(url,body={images:[image]},headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('scan endpoint keeps secrets server-side and enforces origin, access code and image type',async()=>{
  let calls=0;
  await withServer({apiKey:'server-private-key',accessToken:'scanner-code',allowedOrigins:['https://example.com'],fetchImpl:async()=>{calls++;return Response.json(completed(sheet()));}},async url=>{
    assert.equal((await post(url)).status,401);
    assert.equal((await post(url,undefined,{Origin:'https://untrusted.example',Authorization:'Bearer scanner-code'})).status,403);
    const invalid=await post(url,{images:['data:image/jpeg;base64,AAAA']},{Authorization:'Bearer scanner-code'});assert.equal(invalid.status,400);assert.equal(calls,0);
    const response=await post(url,undefined,{Origin:'https://example.com',Authorization:'Bearer scanner-code'});
    assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'https://example.com');assert.equal(response.headers.get('cache-control'),'no-store');
    const body=await response.text();assert.match(body,/Melchior/);assert.ok(!body.includes('server-private-key'));assert.equal(calls,1);
    const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:'https://example.com'}});assert.equal(preflight.status,204);
  });
});

test('unconfigured endpoint and malformed uploads return actionable errors without calling vision',async()=>{
  await withServer({apiKey:''},async url=>{const response=await post(url);assert.equal(response.status,503);assert.match((await response.json()).error,/OPENAI_API_KEY/);});
  await withServer({apiKey:'test',fetchImpl:async()=>{throw new Error('should not call vision');}},async url=>{
    assert.equal((await post(url,{images:[]})).status,400);
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    assert.equal((await fetch(url,{method:'POST',body:'text'})).status,415);
    assert.equal((await fetch(url)).status,405);
    const remoteHost=await new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST',headers:{Host:'public.example','Content-Type':'application/json'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});req.on('error',reject);req.end(JSON.stringify({images:[image]}));});
    assert.equal(remoteHost.status,503);assert.match(remoteHost.body.error,/SCAN_ACCESS_TOKEN/);
  });
});
