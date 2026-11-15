import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {state as bricktrait} from '../tests/helpers/bricktrait-state.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {validPortrait} from '../portrait.js';
import catalog from '../vendor/bricktrait/preset-catalog.json' with {type:'json'};
const base=process.env.PRESET_TEST_URL||process.env.PORTRAIT_TEST_URL||'http://localhost:4173/';
const executablePath=process.env.BROWSER_PATH||process.env.CHROME_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to Chromium.');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:1400,height:1100});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function tab(frame,name){await frame.evaluate(name=>[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()===name).click(),name);}
async function design(frame){return bricktrait.fromHash(await frame.evaluate(()=>location.hash));}
async function settled(frame){await frame.waitForSelector('.preview:not(.busy)',{timeout:60000});await wait(550);assert.equal(await frame.$('.preview .error'),null);}
async function editor(){const element=await page.waitForSelector('.portrait-editor');const frame=await element.contentFrame();await settled(frame);return frame;}
async function presets(frame){await tab(frame,'Presets');await frame.waitForSelector('.preset-browser .card');}
async function search(frame,value){await frame.$eval('.preset-browser input[type=search]',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
try{
  console.log('RUN all static preview files decode with transparent backgrounds');
  await page.goto(new URL('portrait-maker/',base).href,{waitUntil:'networkidle0'});await settled(page);
  const thumbnails=await page.evaluate(async presets=>{
    const results=[];
    for(const p of presets){const img=new Image();img.src=p.thumbnail;await img.decode();const c=document.createElement('canvas');c.width=c.height=192;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,192,192).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>8)opaque++;results.push({id:p.id,width:img.naturalWidth,alpha:data[3],opaque});}return results;
  },catalog.presets);
  for(const t of thumbnails){assert.equal(t.width,192,t.id);assert.equal(t.alpha,0,t.id);assert.ok(t.opaque>500&&t.opaque<192*192*.85,t.id);}
  console.log(`PASS ${thumbnails.length} transparent assembled previews`);
  console.log('RUN browser search, filters, favorites, recent picks, application and undo/redo');
  await presets(page);assert.ok((await page.$$('.preset-browser .card')).length<=24);
  await search(page,'Falcon veteran');await page.waitForFunction(()=>document.querySelectorAll('.preset-browser .card').length===1);
  const before=await design(page);
  await page.click('.preset-browser .favorite');assert.equal(await page.$eval('.favorite',el=>el.getAttribute('aria-pressed')),'true');
  await page.click('.preset-browser .choose');await settled(page);
  const applied=await design(page),p=catalog.presets.find(x=>x.id==='original-falcon-veteran');assert.deepEqual(applied.figure,p.figure);assert.deepEqual(applied.view,before.view);assert.deepEqual(applied.style,before.style);
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await settled(page);assert.deepEqual((await design(page)).figure,before.figure);
  await page.keyboard.down('Control');await page.keyboard.down('Shift');await page.keyboard.press('z');await page.keyboard.up('Shift');await page.keyboard.up('Control');await settled(page);assert.deepEqual((await design(page)).figure,p.figure);
  await page.reload({waitUntil:'networkidle0'});await settled(page);await presets(page);await search(page,'Falcon veteran');
  assert.equal(await page.$eval('.favorite',el=>el.getAttribute('aria-pressed')),'true');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('bricktrait.presets.v1')));assert.ok(stored.recent.includes(p.id));
  await page.select('.filters label:nth-child(4) select','official');assert.equal(await page.$('.preset-browser .card'),null);
  await page.select('.filters label:nth-child(4) select','');await search(page,'Frodo');await page.waitForSelector('.preset-browser .card');await page.click('.choose');await settled(page);
  assert.ok(catalog.presets.some(p=>p.kind==='official'&&JSON.stringify(p.figure)===JSON.stringify(bricktrait.fromHash(new URL(page.url()).hash).figure)));
  await page.setViewport({width:390,height:844});await page.evaluate(()=>document.querySelector('.preset-browser').scrollIntoView());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile has no horizontal overflow');
  await fs.mkdir(resolve('.tmp'),{recursive:true});await page.screenshot({path:resolve('.tmp/preset-browser-mobile.png'),fullPage:true});
  console.log('PASS presets browser and mobile layout');
  console.log('RUN host save/cancel, customization and reopen');
  await page.setViewport({width:1400,height:1100});await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),defaultPartyState());await page.reload({waitUntil:'networkidle0'});
  const original=await page.evaluate(()=>localStorage.getItem('questlog.v2'));
  await page.click('[data-action=portrait]');let frame=await editor();await presets(frame);await search(frame,'Falcon veteran');await frame.click('.choose');await settled(frame);
  assert.equal(await page.evaluate(()=>localStorage.getItem('questlog.v2')),original,'applying a preset cannot save the character');
  await page.click('[data-portrait-close]');assert.equal(await page.evaluate(()=>localStorage.getItem('questlog.v2')),original,'cancel leaves saved state untouched');
  await page.click('[data-action=portrait]');frame=await editor();await presets(frame);await search(frame,'Falcon veteran');await frame.click('.choose');await settled(frame);
  await tab(frame,'Pose');await frame.$eval('.panel input[type=range]',el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));});await settled(frame);
  const customized=await design(frame);assert.equal(customized.figure.pose.head,20);
  await page.click('.portrait-use');await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'),{timeout:60000});
  const saved=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));return s.characters.find(c=>c.id===s.activeId).portrait;});
  assert.ok(validPortrait(saved));assert.deepEqual(saved.design.figure,customized.figure);
  await page.click('[data-action=portrait]');frame=await editor();assert.deepEqual((await design(frame)).figure,customized.figure);
  await presets(frame);await frame.waitForSelector('button:not([disabled])');
  const offline=await frame.evaluate(()=>!!navigator.serviceWorker?.controller);
  if(offline){
    console.log('RUN offline collection download and uncached-choice reconstruction');
    await frame.evaluate(()=>[...document.querySelectorAll('.preset-browser button')].find(b=>b.textContent.includes('Download collection')).click());
    await frame.waitForFunction(()=>document.querySelector('.preset-browser').textContent.includes('collection is ready offline'),{timeout:120000});
    await page.setOfflineMode(true);await search(frame,'Greenwood archer');await frame.click('.choose');await settled(frame);assert.equal((await design(frame)).figure.headgear.id,'13766p01');await page.setOfflineMode(false);
  }
  assert.deepEqual(errors,[]);console.log('PASS save/reopen, cancel isolation, editable pose, offline reconstruction');
}finally{await browser.close();}
