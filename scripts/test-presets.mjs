import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {state as bricktrait} from '../tests/helpers/bricktrait-state.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {validPortrait} from '../portrait.js';
import catalog from '../vendor/bricktrait/preset-catalog.json' with {type:'json'};
import {filterPresets} from '../vendor/bricktrait/src/lib/presets.js';
import {visualChecks} from '../tests/helpers/browser-checks.mjs';
const originalPreset=catalog.presets.find(p=>p.kind==='original');
const officialPreset=catalog.presets.find(p=>p.kind==='official');
const offlinePreset=catalog.presets.find(p=>p.id!==originalPreset?.id&&p.kind==='original');
assert.ok(originalPreset&&officialPreset&&offlinePreset,'Both preset collections must have usable choices.');
const card=p=>`.preset-browser [data-preset-id="${p.id}"]`;
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
async function find(frame,preset){
  await search(frame,preset.name);await frame.waitForSelector(card(preset));
  const expected=filterPresets(catalog.presets,{query:preset.name}).map(p=>p.id);
  const visible=await frame.$$eval('.preset-browser .card',nodes=>nodes.map(node=>node.dataset.presetId));
  assert.ok(visible.length&&visible.every(id=>expected.includes(id)),'Search returns matching figures.');
}
async function filter(frame,label,value){
  await frame.evaluate(({label,value})=>{
    const control=[...document.querySelectorAll('.filters label')].find(node=>node.firstChild.textContent.trim()===label)?.querySelector('select');
    if(!control)throw new Error(`Missing filter: ${label}`);
    control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));
  },{label,value});
}
try{
  console.log('RUN all static preview files load and decode');
  await page.goto(new URL('portrait-maker/',base).href,{waitUntil:'networkidle0'});await settled(page);
  const thumbnails=await page.evaluate(async({presets,visual})=>{
    const results=[];
    for(const p of presets){
      const img=new Image();let timer;
      try{
        img.src=p.thumbnail;
        await Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image decode timed out')),15000);})]);
        const result={id:p.id,width:img.naturalWidth,height:img.naturalHeight};
        if(visual){const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>8)opaque++;Object.assign(result,{alpha:data[3],opaque});}
        results.push(result);
      }catch(error){results.push({id:p.id,error:error.message});}finally{clearTimeout(timer);}
    }return results;
  },{presets:catalog.presets,visual:visualChecks});
  for(const t of thumbnails){
    assert.ok(!t.error&&t.width>0&&t.height>0,`${t.id}: ${t.error||'decoded preview'}`);
    if(visualChecks){assert.equal(t.width,192,t.id);assert.equal(t.alpha,0,t.id);assert.ok(t.opaque>500&&t.opaque<t.width*t.height*.85,t.id);}
  }
  console.log(`PASS ${thumbnails.length} usable assembled previews`);
  console.log('RUN browser search, filters, favorites, recent picks, application and undo/redo');
  await presets(page);await find(page,originalPreset);
  const before=await design(page);
  await page.click(`${card(originalPreset)} .favorite`);assert.equal(await page.$eval(`${card(originalPreset)} .favorite`,el=>el.getAttribute('aria-pressed')),'true');
  await page.click(`${card(originalPreset)} .choose`);await settled(page);
  const applied=await design(page),p=originalPreset;assert.deepEqual(applied.figure,p.figure);assert.deepEqual(applied.view,before.view);assert.deepEqual(applied.style,before.style);
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await settled(page);assert.deepEqual((await design(page)).figure,before.figure);
  await page.keyboard.down('Control');await page.keyboard.down('Shift');await page.keyboard.press('z');await page.keyboard.up('Shift');await page.keyboard.up('Control');await settled(page);assert.deepEqual((await design(page)).figure,p.figure);
  await page.reload({waitUntil:'networkidle0'});await settled(page);await presets(page);await find(page,p);
  assert.equal(await page.$eval(`${card(p)} .favorite`,el=>el.getAttribute('aria-pressed')),'true');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('bricktrait.presets.v1')));assert.ok(stored.recent.includes(p.id));
  await filter(page,'Collection','official');
  await page.waitForFunction(id=>!document.querySelector(`[data-preset-id="${id}"]`),{},p.id);
  assert.ok((await page.$$eval('.preset-browser .card',nodes=>nodes.map(node=>node.dataset.presetId))).every(id=>catalog.presets.find(p=>p.id===id)?.kind==='official'));
  await filter(page,'Collection','');await find(page,officialPreset);await page.click(`${card(officialPreset)} .choose`);await settled(page);
  assert.deepEqual((await design(page)).figure,officialPreset.figure);
  await page.setViewport({width:390,height:844});await page.evaluate(()=>document.querySelector('.preset-browser').scrollIntoView());
  if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile has no horizontal overflow');
  await find(page,p);await page.locator(`${card(p)} .choose`).click();await settled(page);
  assert.deepEqual((await design(page)).figure,p.figure,'preset application also works on mobile');
  await fs.mkdir(resolve('.tmp'),{recursive:true});await page.screenshot({path:resolve('.tmp/preset-browser-mobile.png'),fullPage:true});
  console.log('PASS presets browser and mobile layout');
  console.log('RUN host save/cancel, customization and reopen');
  await page.setViewport({width:1400,height:1100});await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),defaultPartyState());await page.reload({waitUntil:'networkidle0'});
  await page.waitForFunction(async()=>{const registration=await navigator.serviceWorker.getRegistration();return registration?.active?.state==='activated';},{timeout:60000});
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload({waitUntil:'networkidle0'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:60000});
  const original=await page.evaluate(()=>localStorage.getItem('questlog.v2'));
  await page.click('[data-action=portrait]');let frame=await editor();await presets(frame);await find(frame,p);await frame.click(`${card(p)} .choose`);await settled(frame);
  assert.equal(await page.evaluate(()=>localStorage.getItem('questlog.v2')),original,'applying a preset cannot save the character');
  await page.click('[data-portrait-close]');assert.equal(await page.evaluate(()=>localStorage.getItem('questlog.v2')),original,'cancel leaves saved state untouched');
  await page.click('[data-action=portrait]');frame=await editor();await presets(frame);await find(frame,p);await frame.click(`${card(p)} .choose`);await settled(frame);
  await tab(frame,'Pose');await frame.$eval('.panel input[type=range]',el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));});await settled(frame);
  const customized=await design(frame);assert.equal(customized.figure.pose.head,20);
  await page.click('.portrait-use');await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'),{timeout:60000});
  const saved=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));return s.characters.find(c=>c.id===s.activeId).portrait;});
  assert.ok(validPortrait(saved));assert.deepEqual(saved.design.figure,customized.figure);
  await page.click('[data-action=portrait]');frame=await editor();assert.deepEqual((await design(frame)).figure,customized.figure);
  await presets(frame);await frame.waitForSelector('button:not([disabled])');
  await frame.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:60000});
  console.log('RUN offline collection download and uncached-choice reconstruction');
  await frame.evaluate(()=>[...document.querySelectorAll('.preset-browser button')].find(b=>b.textContent.includes('Download collection')).click());
  await frame.waitForFunction(()=>document.querySelector('.preset-browser').textContent.includes('collection is ready offline'),{timeout:120000});
  await page.setOfflineMode(true);await find(frame,offlinePreset);await frame.click(`${card(offlinePreset)} .choose`);await settled(frame);assert.deepEqual((await design(frame)).figure,offlinePreset.figure);await page.setOfflineMode(false);
  assert.deepEqual(errors,[]);console.log('PASS save/reopen, cancel isolation, editable pose, offline reconstruction');
}catch(error){
  const diagnostics=resolve('.tmp/browser-diagnostics/presets');await fs.mkdir(diagnostics,{recursive:true});
  await fs.writeFile(resolve(diagnostics,'failure.json'),JSON.stringify({error:error.stack,errors,url:page.url()},null,2));
  await page.screenshot({path:resolve(diagnostics,'failure.png'),fullPage:true}).catch(()=>{});
  throw error;
}finally{await browser.close();}
