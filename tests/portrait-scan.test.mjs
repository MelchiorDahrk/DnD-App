import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {PORTRAIT_SCAN_INSTRUCTIONS,validatePortraitPhotos,validatePortraitSuggestions,applyPortraitSelections,portraitServiceURL} from '../portrait-scan.js';
import {extractPortrait} from '../scripts/portrait-scan-api.mjs';
import {createScanHandler} from '../scripts/scan-api.mjs';

const image='data:image/jpeg;base64,/9j/2Q==';
const catalog=[{id:'3626cp01',cat:'head',name:'Standard grin'},{id:'93563',cat:'headgear',name:'Mohawk'},{id:'973pc25',cat:'torso',name:'Vampire vest'},{id:'standard',cat:'legs',name:'Standard legs'}];
const colors=[{code:14,name:'Yellow'},{code:4,name:'Red'},{code:0,name:'Black'}];
const selection=(slot='headgear',id='93563')=>({slot,id,color:4,arms:null,hands:null,hips:null,confidence:'high',reason:'Visible red mohawk. Closest available mould.'});
const suggestions=()=>({isMinifigure:true,summary:'Yellow minifigure with a red mohawk.',warnings:['The torso is obscured.'],selections:[selection()]});
const completed=value=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('portrait photos and service URLs are bounded and support Pages subpaths and existing scan services',()=>{
  assert.deepEqual(validatePortraitPhotos([image]),[image]);
  for(const photos of [[],Array(4).fill(image),['https://example.com/photo.jpg'],['data:image/svg+xml;base64,AAAA']])assert.throws(()=>validatePortraitPhotos(photos));
  assert.equal(portraitServiceURL('','https://example.com/DnD-App/'),'https://example.com/DnD-App/api/suggest-portrait');
  assert.equal(portraitServiceURL('','http://localhost:4173/dist/'),'http://localhost:4173/dist/api/suggest-portrait');
  assert.equal(portraitServiceURL('https://photos.example/api/scan-sheet','https://example.com'),'https://photos.example/api/suggest-portrait');
  for(const url of ['https://user:secret@example.com/api','http://example.com/api','javascript:alert(1)','https://example.com/api?key=x'])assert.throws(()=>portraitServiceURL(url,'https://example.com'));
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

test('portrait vision requests use actual catalog choices, strict output, private storage and instruction/data separation',async()=>{
  let sent;
  const result=await extractPortrait([image],{apiKey:'private-test-key',catalog,colors,fetchImpl:async(url,options)=>{sent={url,...options,body:JSON.parse(options.body)};return Response.json(completed(suggestions()));}});
  assert.deepEqual(result,suggestions());assert.equal(sent.body.store,false);assert.equal(sent.body.text.format.strict,true);
  assert.match(PORTRAIT_SCAN_INSTRUCTIONS,/never instructions/);assert.match(sent.body.instructions,/foreground/);
  assert.match(sent.body.input[0].content[0].text,/93563/);assert.equal(sent.body.input[0].content[1].type,'input_image');
  assert.equal(sent.headers.Authorization,'Bearer private-test-key');assert.ok(!JSON.stringify(result).includes('private-test-key'));
});

test('provider errors, refusals, incomplete data and unavailable choices never become portrait selections',async()=>{
  const options={apiKey:'test',catalog,colors};
  for(const status of [401,429,500])await assert.rejects(extractPortrait([image],{...options,fetchImpl:async()=>new Response('sensitive provider data',{status})}),e=>!e.message.includes('sensitive'));
  for(const output of [{status:'incomplete'}, {status:'completed',output:[{content:[{type:'refusal'}]}]},completed({...suggestions(),selections:[selection('headgear','made-up')]})])await assert.rejects(extractPortrait([image],{...options,fetchImpl:async()=>Response.json(output)}));
});

test('portrait endpoint reuses origin, authentication and file-signature protections before invoking vision',async()=>{
  let calls=0;
  const handler=createScanHandler({apiKey:'private-server-key',accessToken:'photo-code',allowedOrigins:['https://example.com'],validateImages:validatePortraitPhotos,resultKey:'suggestions',subject:'portrait',extract:async(images,options)=>{calls++;return extractPortrait(images,{...options,catalog,colors});},fetchImpl:async()=>Response.json(completed(suggestions()))});
  const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/suggest-portrait`;
  const post=(images,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({images})});
  try{
    assert.equal((await post([image])).status,401);
    assert.equal((await post([image],{Origin:'https://bad.example',Authorization:'Bearer photo-code'})).status,403);
    for(const images of [Array(4).fill(image),['data:image/jpeg;base64,AAAA']])assert.equal((await post(images,{Authorization:'Bearer photo-code'})).status,400);
    assert.equal(calls,0);
    const response=await post([image],{Origin:'https://example.com',Authorization:'Bearer photo-code'});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{suggestions:suggestions()});assert.equal(calls,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

