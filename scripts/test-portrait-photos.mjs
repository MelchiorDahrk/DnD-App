import {visualChecks} from '../tests/helpers/browser-checks.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {validPortrait} from '../portrait.js';

const base=process.env.PORTRAIT_TEST_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to Chromium.');
const browser=await puppeteer.launch({executablePath,headless:true,protocolTimeout:60000,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage();await page.setViewport({width:1440,height:1100,hasTouch:true,isMobile:true});
const errors=[],external=[],posts=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.method()!=='GET')posts.push(r.url());if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
const headgear=frame=>frame.$eval('.slots .pick[aria-label^="Headgear:"]',el=>el.getAttribute('aria-label'));
async function open(){
  await page.click('[data-action="portrait"]');const frame=await (await page.waitForSelector('.portrait-editor')).contentFrame();
  await frame.waitForSelector('.preview:not(.busy)',{timeout:120000});await page.waitForSelector('.portrait-use:not([disabled])');
  await page.click('.portrait-photo-panel>summary');await page.waitForSelector('[data-photo="manual"]:not([disabled])');return frame;
}
async function upload(paths){
  await (await page.$('[data-photo-files]')).uploadFile(...paths);await page.waitForFunction(()=>document.querySelector('.portrait-photo-panel').getAttribute('aria-busy')==='false');
}
async function match(){await page.click('[data-photo="suggest"]');await page.waitForSelector('.portrait-photo-results:not([hidden])',{timeout:30000});await page.waitForFunction(()=>document.querySelector('.portrait-photo-panel').getAttribute('aria-busy')==='false');}
async function chooseHeadgear(id){
  const panel='[data-palette="headgear"]';
  // Opening details queues a toggle handler that replaces the palette buttons.
  // Wait for that initial render and use locators that reacquire replaced nodes.
  if(!await page.$eval(panel,element=>element.open))await page.locator(`${panel}>summary`).click();
  await page.waitForFunction(selector=>{
    const panel=document.querySelector(selector);
    return panel?.open&&panel.querySelector('.portrait-palette-items')?.childElementCount>0;
  },{},panel);
  await page.locator('[data-search="headgear"]').fill(id);
  await page.locator(`${panel} [data-candidate="${id}"]`).click();
  await page.waitForSelector(`${panel} [data-candidate="${id}"][aria-pressed="true"]`,{visible:true});
}
async function manualMohawk(){
  await chooseHeadgear('93563');
  const color='[data-color="color"][data-slot="headgear"]';
  await page.waitForSelector(`${color}:not([disabled])`);
  await page.select(color,'4');
  assert.equal(await page.$eval(color,element=>element.value),'4');
}
async function preview(){await page.click('[data-photo="preview"]');await page.waitForSelector('.portrait-photo-assembly:not([hidden])',{timeout:60000});await page.waitForSelector('[data-photo="apply"]:not([disabled])');}
async function apply(){await page.click('[data-photo="apply"]');await page.waitForFunction(()=>!document.querySelector('.portrait-photo-panel').open);}
try {
  console.log('RUN photo upload, matching and desktop selection');
  await page.goto(base,{waitUntil:'networkidle0'});await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),defaultPartyState());await page.reload({waitUntil:'networkidle0'});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // A rendered figure with deterministic sensor noise exercises the real worker,
  // Canvas regions and matcher. No network inference response is mocked.
  const generated=await page.evaluate(async()=>{
    const {REGION_TEMPLATE}=await import('./portrait-image-analysis.js');
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=600;const ctx=canvas.getContext('2d');ctx.fillStyle='#eee';ctx.fillRect(0,0,400,600);
    for(const [slot,id] of [['headgear','93563'],['head','3626cp01'],['torso','973pc25'],['legs','standard']]){
      const img=new Image();img.src=`./portrait-maker/thumbs/${id}.webp`;await img.decode();const [x,y,w,h]=REGION_TEMPLATE[slot];ctx.drawImage(img,x*400,y*600,w*400,h*600);
    }
    const pixels=ctx.getImageData(0,0,400,600);for(let i=0;i<pixels.data.length;i+=4)for(let c=0;c<3;c++)pixels.data[i+c]+=((i*13+c*7)%7)-3;ctx.putImageData(pixels,0,0);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await fs.mkdir(resolve('.tmp'),{recursive:true});const fixture=resolve('.tmp/portrait-photo-fixture.png'),invalid=resolve('.tmp/portrait-photo-invalid.txt'),corrupt=resolve('.tmp/portrait-photo-corrupt.jpg');
  await fs.writeFile(fixture,Buffer.from(generated,'base64'));await fs.writeFile(invalid,'unsupported upload');await fs.writeFile(corrupt,'not an image');
  const paths=process.env.PORTRAIT_PHOTO_FIXTURES?JSON.parse(process.env.PORTRAIT_PHOTO_FIXTURES):[fixture];
  const initial=await saved();let frame=await open();const originalHeadgear=await headgear(frame);
  assert.equal(await page.$('[name="portraitService"]'),null);assert.equal(await page.$('[name="portraitAccess"]'),null);
  await upload([invalid]);assert.match(await page.$eval('.portrait-photo-error',el=>el.textContent),/JPG/);
  await upload([corrupt]);assert.equal(await page.$$eval('.portrait-photo-previews figure',els=>els.length),0);
  await upload([paths[0],paths[0],paths[0],paths[0]]);assert.match(await page.$eval('.portrait-photo-error',el=>el.textContent),/three/);
  await upload([paths[0],paths[0],paths[0]]);assert.equal(await page.$$eval('.portrait-photo-previews figure',els=>els.length),3);
  await page.click('[data-photo="primary"][data-index="1"]');assert.equal(await page.$eval('[data-photo="primary"][data-index="1"]',el=>el.getAttribute('aria-pressed')),'true');
  await page.click('[data-photo="rotate"]');await page.waitForFunction(()=>document.querySelector('.portrait-photo-panel').getAttribute('aria-busy')==='false');
  await page.click('[data-photo="primary"][data-index="0"]');
  await page.select('[data-source="head"]','2');await page.select('[data-edit-photo]','0');await page.select('[data-edit-region]','crop');
  await page.evaluate(()=>{for(const [i,v] of [0,0,100,100].entries()){const el=document.querySelector(`[data-rect="${i}"]`);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));}});
  await page.evaluate(()=>{document.querySelector('[data-photo="suggest"]').click();document.querySelector('[data-photo="stop"]').click();});
  await page.waitForFunction(()=>document.querySelector('.portrait-photo-panel').getAttribute('aria-busy')==='false');
  assert.match(await page.$eval('.portrait-photo-status',el=>el.textContent),/Stopped/);
  await match();
  assert.ok(await page.$$eval('[data-slot-card="headgear"]>.portrait-candidates [data-candidate]',els=>els.length>0&&els.length<=5),'Ranked thumbnails must appear');
  assert.equal(await page.$$eval('.portrait-candidate[aria-pressed=true]',els=>els.length),0,'Ambiguous choices require review');
  assert.equal(await page.$$eval('[data-slot-card="back"]>.portrait-candidates [data-candidate]',els=>els.length),0,'Obscured back is unresolved');
  const first=await page.$('[data-slot-card="headgear"]>.portrait-candidates [data-candidate]');await first.click();
  assert.equal(await first.evaluate(el=>el.getAttribute('aria-pressed')),'true');
  const unranked=await page.evaluate(async()=>{const index=await (await fetch('./portrait-maker/portrait-match-index.json')).json();const ranked=[...document.querySelectorAll('[data-slot-card="headgear"]>.portrait-candidates [data-candidate]')].map(el=>el.dataset.candidate);return index.parts.find(p=>p.cat==='headgear'&&!ranked.includes(p.id)).id;});
  await chooseHeadgear(unranked);await manualMohawk();
  await page.click('[data-none="back"]');await page.click('[data-unchanged="back"]');
  await preview();assert.equal(await headgear(frame),originalHeadgear,'Temporary preview does not edit the figure');assert.deepEqual(await saved(),initial);
  await apply();await frame.waitForSelector('.slots .pick[aria-label="Headgear: Hair Mohawk"]');await frame.waitForSelector('.preview:not(.busy)');
  await frame.click('button[title*="Undo"]');await frame.waitForFunction(label=>document.querySelector('.slots .pick[aria-label^="Headgear:"]').getAttribute('aria-label')===label,{},originalHeadgear);
  await frame.click('button[title*="Redo"]');await frame.waitForSelector('.slots .pick[aria-label="Headgear: Hair Mohawk"]');
  await page.click('[data-portrait-close]');assert.deepEqual(await saved(),initial);console.log('PASS local upload/validation, three views, ranking, manual unranked choice, preview, apply, undo/redo and cancel');

  console.log('RUN mobile touch controls, palette selection and portrait saving');
  frame=await open();await upload([paths[0]]);
  await page.setViewport({width:390,height:844,hasTouch:true,isMobile:true});
  await page.$eval('.portrait-crop',el=>el.scrollIntoView({block:'center'}));
  const before=await page.$eval('[data-rect="0"]',el=>el.value);
  const box=await page.$eval('.portrait-crop-box',el=>{const b=el.getBoundingClientRect();return {x:b.x+b.width*.4,y:b.y+b.height*.4};});
  await page.touchscreen.touchStart(box.x,box.y);await page.touchscreen.touchMove(box.x+8,box.y);await page.touchscreen.touchEnd();
  assert.notEqual(await page.$eval('[data-rect="0"]',el=>el.value),before);
  if(visualChecks){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const cpuRate=Number(process.env.PORTRAIT_PHOTO_CPU_RATE||1);
  const cdp=cpuRate>1?await page.createCDPSession():null;
  if(cdp)await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
  for(const width of [320,390]) {
    await page.setViewport({width,height:844,hasTouch:true,isMobile:true});
    await page.locator('[data-photo="manual"]').click();
    await manualMohawk();
    console.log(`PASS ${width}px fresh palette opens, searches and selects a part`);
  }
  if(cdp){await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}
  await preview();
  await fs.mkdir(resolve('.tmp/screenshots'),{recursive:true});await page.screenshot({path:'.tmp/screenshots/portrait-photo-mobile.png'});
  await page.setViewport({width:1440,height:1100,hasTouch:true,isMobile:true});await page.screenshot({path:'.tmp/screenshots/portrait-photo-desktop.png'});
  await apply();await frame.waitForSelector('.preview:not(.busy)');await page.click('.portrait-use');await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'));
  const state=await saved(),portrait=state.characters.find(c=>c.id===state.activeId).portrait;assert.ok(validPortrait(portrait));assert.equal(portrait.design.figure.headgear.id,'93563');assert.equal(portrait.design.figure.headgear.color,4);assert.ok(!JSON.stringify(state).includes('blob:'));
  const corners=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [[0,0],[255,0],[0,255],[255,255]].map(([x,y])=>ctx.getImageData(x,y,1,1).data[3]);},portrait.image);assert.deepEqual(corners,[0,0,0,0]);
  console.log('PASS narrow layout, touch region controls, transparent save and photo-free character data');

  console.log('RUN offline photo recognition and palette selection');
  frame=await open();await page.click('[data-photo="cache"]');await page.waitForFunction(()=>document.querySelector('.portrait-palette-cache').textContent==='Visual palette cached for offline matching.',{timeout:180000});
  const beforeOffline=await saved();await page.click('[data-portrait-close]');await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  frame=await open();await upload([paths[0]]);await match();assert.ok(await page.$$eval('.portrait-candidate',els=>els.length>0));await manualMohawk();
  const image=await page.$('[data-palette="headgear"] [data-candidate="93563"] img');await image.evaluate(img=>img.decode());await preview();await apply();
  await page.click('[data-portrait-close]');assert.deepEqual(await saved(),beforeOffline);
  console.log('PASS cached offline recognition, visual palette and Bricktrait preview without downloading the geometry catalog');
  assert.deepEqual(external,[]);assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);console.log('PASS no external requests, photo uploads, inference calls or browser errors');
} catch(error) {
  const directory=resolve('.tmp/browser-diagnostics/portrait-photos');
  try {
    await fs.mkdir(directory,{recursive:true});
    await page.screenshot({path:resolve(directory,'failure.png')});
    const controls=await page.$$eval('[data-palette="headgear"], [data-search="headgear"], [data-candidate="93563"]',elements=>elements.map(element=>({
      tag:element.tagName,open:element.open,value:element.value,pressed:element.getAttribute('aria-pressed'),
      connected:element.isConnected,rect:element.getBoundingClientRect().toJSON(),visibility:getComputedStyle(element).visibility
    })));
    await fs.writeFile(resolve(directory,'failure.json'),JSON.stringify({message:error.message,url:page.url(),controls,errors},null,2));
    console.error(`Photo test diagnostics: ${directory}`);
  } catch(diagnosticError) {console.error('Could not capture photo test diagnostics:',diagnosticError.message);}
  throw error;
} finally {await browser.close();}
