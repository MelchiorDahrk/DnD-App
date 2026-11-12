import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';

const base=process.env.PORTRAIT_TEST_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage();await page.setViewport({width:1440,height:1100});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let uploaded=null,responseMode='success';
const match=(slot,id,color,confidence='high')=>({slot,id,color,arms:null,hands:null,hips:null,confidence,reason:'Closest available part. Check against the reference photo.'});
const mock={isMinifigure:true,summary:'A minifigure with a red mohawk and yellow skin.',warnings:['The torso is partially obscured.'],selections:[match('headgear','93563',4),match('head','3626cp01',14,'low')]};
await page.setRequestInterception(true);
page.on('request',async request=>{
  if(new URL(request.url()).pathname.endsWith('/api/suggest-portrait')){
    uploaded=JSON.parse(request.postData());
    if(responseMode==='wait')return;
    await request.respond({status:200,contentType:'application/json',body:JSON.stringify({suggestions:responseMode==='invalid'?{...mock,selections:[match('headgear','invented',4)]}:mock})});
  }else await request.continue();
});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
async function open(){
  await page.click('[data-action="portrait"]');
  const frame=await (await page.waitForSelector('.portrait-editor')).contentFrame();
  await frame.waitForSelector('.preview:not(.busy)',{timeout:120000});await page.waitForSelector('.portrait-use:not([disabled])');
  await page.click('.portrait-photo-panel>summary');return frame;
}
async function photo(){
  const paths=process.env.PORTRAIT_PHOTO_FIXTURES?JSON.parse(process.env.PORTRAIT_PHOTO_FIXTURES):[];
  let path=paths[0];
  if(!path){
    const data=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=64;return canvas.toDataURL('image/png').split(',')[1];});
    await fs.mkdir(resolve('.tmp'),{recursive:true});path=resolve('.tmp/portrait-photo-fixture.png');await fs.writeFile(path,Buffer.from(data,'base64'));
  }
  await (await page.$('[data-photo-files]')).uploadFile(path);
  await page.waitForSelector('[data-photo="suggest"]:not([disabled])');
}
try{
  await page.goto(base,{waitUntil:'networkidle0'});
  const initial=await saved();let frame=await open();await photo();
  await page.click('[data-photo="suggest"]');await page.waitForSelector('[data-photo="apply"]:not([disabled])');
  assert.equal(uploaded.images.length,1);assert.match(uploaded.images[0],/^data:image\/jpeg;base64,/);
  assert.equal(await page.$eval('[data-match="0"]',el=>el.checked),true);
  assert.equal(await page.$eval('[data-match="1"]',el=>el.checked),false);
  assert.deepEqual(await saved(),initial,'Suggestions do not save a portrait');
  await page.click('[data-photo="apply"]');
  await page.waitForFunction(()=>!document.querySelector('.portrait-photo-panel').open);
  await frame.waitForSelector('.slots .pick[aria-label="Headgear: Hair Mohawk"]');
  await frame.waitForSelector('.preview:not(.busy)');
  await frame.click('button[title*="Undo"]');
  await frame.waitForFunction(()=>!document.querySelector('.slots .pick[aria-label="Headgear: Hair Mohawk"]'));
  await frame.click('button[title*="Redo"]');await frame.waitForSelector('.slots .pick[aria-label="Headgear: Hair Mohawk"]');
  await page.click('[data-portrait-close]');assert.deepEqual(await saved(),initial);
  console.log('PASS upload, review, apply, undo/redo and cancel without saving photos');

  frame=await open();
  const collection=await frame.$('select[aria-label="Part collection"]');await collection.select('cmf');
  await frame.waitForSelector('.picker .pick');
  await frame.type('.picker input[type="search"]','cmf');
  await frame.waitForSelector('.picker .pick');
  assert.ok(await frame.$$eval('.picker .pick',els=>els.length>0));
  responseMode='invalid';await photo();await page.click('[data-photo="suggest"]');await page.waitForSelector('.portrait-photo-error:not([hidden])');
  assert.match(await page.$eval('.portrait-photo-error',el=>el.textContent),/unavailable/);
  assert.equal(await page.$('[data-photo="apply"]'),null);
  console.log('PASS CMF filtering/search and rejection of unavailable suggestions');

  await page.setViewport({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.$eval('.portrait-editor',el=>el.getBoundingClientRect().height>150));
  await fs.mkdir(resolve('screenshots'),{recursive:true});await page.screenshot({path:'screenshots/portrait-photo-mobile.png'});
  responseMode='wait';await page.click('[data-photo="suggest"]');await page.waitForSelector('[data-photo="stop"]:not([hidden])');
  await page.click('[data-photo="stop"]');await page.waitForSelector('[data-photo="suggest"]:not([disabled])');
  await page.click('[data-portrait-close]');assert.deepEqual(await saved(),initial);
  console.log('PASS mobile layout, stopping analysis and dialog cleanup');

  await page.setViewport({width:1440,height:1100});frame=await open();await photo();responseMode='success';
  await page.click('[data-photo="suggest"]');await page.waitForSelector('[data-photo="apply"]:not([disabled])');
  await page.screenshot({path:'screenshots/portrait-photo-desktop.png'});
  await page.click('[data-photo="apply"]');await page.waitForFunction(()=>!document.querySelector('.portrait-photo-panel').open);
  await frame.waitForSelector('.preview:not(.busy)');await page.click('.portrait-use');await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'));
  const state=await saved(),portrait=state.characters.find(c=>c.id===state.activeId).portrait;
  assert.equal(portrait.design.figure.headgear.id,'93563');assert.equal(portrait.design.figure.headgear.color,4);
  assert.ok(!JSON.stringify(state).includes(uploaded.images[0]));
  assert.deepEqual(errors,[]);console.log('PASS saving editable suggestions excludes reference photos from backups');
}finally{await browser.close();}
