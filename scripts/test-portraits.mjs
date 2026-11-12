import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {validPortrait} from '../portrait.js';

const base=process.env.PORTRAIT_TEST_URL||'http://localhost:4173/';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage();
await page.setViewport({width:1440,height:1100});
const errors=[];
const externalRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)externalRequests.push(request.url());});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
async function readyFrame() {
  const element=await page.waitForSelector('.portrait-editor');
  const frame=await element.contentFrame();
  await frame.waitForSelector('.preview:not(.busy)',{timeout:120000});
  assert.equal(await frame.$('.preview .notice'),null,'WebGL must be available');
  assert.equal(await frame.$('.preview .error'),null,'Parts must load successfully');
  await page.waitForSelector('.portrait-use:not([disabled])');
  return frame;
}
async function open() {await page.click('[data-action=portrait]');return readyFrame();}
async function save(frame) {
  await page.click('.portrait-use');
  await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'),{timeout:60000});
}
async function setYaw(frame,value) {
  await frame.evaluate(()=>[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.trim()==='Camera').click());
  await frame.waitForSelector('input[type=range]');
  await frame.evaluate(value=>{const input=document.querySelector('.panel input[type=range]');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);
}
try {
  await page.goto(base,{waitUntil:'networkidle0'});
  const attribution=await page.evaluate(async()=>Promise.all(['portrait-maker/LICENSE','portrait-maker/ldraw/CREDITS.txt','portrait-maker/ldraw/CAlicense4.txt'].map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error(`Missing attribution: ${path}`);return response.text();})));
  assert.match(attribution[0],/Copyright \(c\) 2026 Maxichance/);
  assert.match(attribution[1],/file\s+author\s+license/);
  assert.match(attribution[2],/Creative Commons/i);
  console.log('PASS deployed code license and LDraw attribution');
  let frame=await open();
  await save(frame);
  let s=await state();
  const firstId=s.activeId;
  const original=s.characters.find(c=>c.id===firstId).portrait;
  assert.ok(validPortrait(original));
  if(process.argv.includes('--write-default')) {
    await fs.writeFile(resolve('assets/portrait-adventurer.webp'),Buffer.from(original.image.split(',')[1],'base64'));
    console.log('Generated starter portrait using the reused Bricktrait renderer.');
  }
  console.log('PASS render and save a real portrait');

  frame=await open();
  const nextHead=await frame.$eval('.picker .pick[aria-pressed="false"]',el=>el.querySelector('.id').textContent);
  await frame.click('.picker .pick[aria-pressed="false"]');
  await frame.click('.swatch[title$="(78)"]');
  await setYaw(frame,25);await save(frame);
  s=await state();const saved=s.characters.find(c=>c.id===firstId).portrait;
  assert.equal(saved.design.view.yaw,25);
  assert.equal(saved.design.figure.head.id,nextHead);
  assert.equal(saved.design.figure.head.color,78);
  frame=await open();
  await frame.evaluate(()=>[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.trim()==='Camera').click());
  await frame.waitForFunction(()=>document.querySelector('.panel input[type=range]')?.value==='25');
  await setYaw(frame,-25);
  await page.click('[data-portrait-close]');
  assert.deepEqual((await state()).characters.find(c=>c.id===firstId).portrait,saved);
  console.log('PASS edit, reopen, and cancel without changing saved design');

  await page.click('[data-action=characters]');
  await page.click('[data-action=switch-character]:not(.active)');
  const secondId=(await state()).activeId;
  frame=await open();await setYaw(frame,-15);await save(frame);
  s=await state();assert.equal(s.characters.find(c=>c.id===secondId).portrait.design.view.yaw,-15);
  assert.deepEqual(s.characters.find(c=>c.id===firstId).portrait,saved);
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('.hero .character-portrait',img=>img.src),(await state()).characters.find(c=>c.id===secondId).portrait.image);
  console.log('PASS separate character portraits and reload persistence');

  await page.click('[data-action=edit-character]');
  await page.$eval('[name=campaign]',input=>{input.value='Portrait browser check';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#modal [data-action=portrait]');
  frame=await readyFrame();
  assert.equal((await state()).characters.find(c=>c.id===secondId).campaign,'Portrait browser check');
  await frame.focus('.preview canvas');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'));
  console.log('PASS details save before editing and Escape cancels the maker');

  const backupPath=resolve('.tmp/portrait-browser-backup.json');
  await fs.mkdir(resolve('.tmp'),{recursive:true});
  await fs.writeFile(backupPath,JSON.stringify(await state()));
  await (await page.$('#import-file')).uploadFile(backupPath);
  await page.waitForSelector('[data-action=confirm-import]');
  await page.click('[data-action=confirm-import]');
  s=await state();
  assert.equal(s.characters.filter(c=>c.portrait?.design.view.yaw===25).length,2);
  assert.equal(s.characters.filter(c=>c.portrait?.design.view.yaw===-15).length,2);
  console.log('PASS backup import preserves portrait images and editable designs');

  // Return to the original second character for offline checks.
  await page.click('[data-action=characters]');
  await page.click(`[data-action=switch-character][data-id="${secondId}"]`);

  await fs.mkdir('screenshots',{recursive:true});
  frame=await open();
  await frame.waitForFunction(()=>{
    const scroll=document.querySelector('.picker .scroll')?.getBoundingClientRect();
    if(!scroll)return false;
    const visible=[...document.querySelectorAll('.picker .thumb')].filter(el=>{const rect=el.getBoundingClientRect();return rect.bottom>scroll.top&&rect.top<scroll.bottom;});
    return visible.length>0&&visible.every(el=>el.querySelector('img'));
  },{timeout:60000});
  await page.screenshot({path:'screenshots/portrait-maker-desktop.png'});
  await page.setViewport({width:390,height:844});
  await page.screenshot({path:'screenshots/portrait-maker-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await frame.$eval('.bar .strip',el=>el.getBoundingClientRect().height<=60),'Mobile swatches must stay compact');
  assert.ok(await frame.$eval('.lang select',el=>el.getBoundingClientRect().right<=innerWidth),'Mobile header controls must fit');
  await page.click('[data-portrait-close]');
  await page.screenshot({path:'screenshots/bricktrait-character-mobile.png'});
  console.log('PASS mobile layout without horizontal overflow');

  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'load'});
  await page.waitForSelector('.hero .character-portrait');
  assert.equal(await page.$eval('.hero .character-portrait',img=>img.src),(await state()).characters.find(c=>c.id===secondId).portrait.image);
  frame=await open();
  await page.click('[data-portrait-close]');
  await page.setOfflineMode(false);
  console.log('PASS offline sheet portrait and cached editor reopening');

  assert.deepEqual(errors,[],'Browser JavaScript errors');
  assert.deepEqual(externalRequests,[],'The editor must be fully self-hosted');
  console.log('All portrait browser checks passed.');
} finally { await browser.close(); }
