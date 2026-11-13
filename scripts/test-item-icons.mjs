import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {parseBackup} from '../model.js';
import {EXTRA_ITEM_ICONS,ITEM_ICON_LIBRARY} from '../equipment-icons.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.ITEM_ICON_TEST_PORT||'4195';
const base=process.env.ITEM_ICON_TEST_URL||`http://127.0.0.1:${port}${process.env.ITEM_ICON_TEST_PATH||'/'}`;
const executablePath=process.env.BROWSER_PATH||[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'
].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
let server,browser;
try {
  if(!process.env.ITEM_ICON_TEST_URL){
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Server did not start')),10000);
      server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
      server.stderr.once('data',data=>reject(Error(String(data))));
    });
  }
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1280,height:1000});
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),defaultPartyState());
  await page.goto(`${base}#inventory`);await page.reload({waitUntil:'networkidle0'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const enter=(name,value)=>page.$eval(`#modal [name="${name}"]`,(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const search=value=>page.$eval('[data-item-icon-search]',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const choose=key=>page.click(`[data-item-icon-key="${key}"]`);
  const submit=()=>page.click('#modal button[type="submit"]');
  const close=()=>page.click('#modal [data-action="close"]');
  const item=async()=>{const state=await saved();return state.characters[0].items.find(i=>i.name==='Moonlit blade');};
  await page.click('[data-action="item"]:not([data-id])');
  await enter('name','Moonlit blade');await enter('description','Keep these notes.');
  await page.click('.item-icon-picker summary');
  assert.equal(await page.$$eval('[data-item-icon-key]',nodes=>nodes.length),ITEM_ICON_LIBRARY.length);
  await search('samurai');
  assert.ok(await page.$('[data-item-icon-key="katana"]:not([hidden])'));
  assert.equal(await page.$('[data-item-icon-key="apple"]:not([hidden])'),null);
  await choose('katana');
  assert.equal(await page.$eval('[data-item-icon-label]',node=>node.textContent),'Katana');
  await search('nothing matches this');
  assert.match(await page.$eval('[data-item-icon-count]',node=>node.textContent),/No icons found/);
  assert.equal(await page.$eval('[name="iconKey"]:checked',node=>node.value),'katana','filtering keeps selection');
  await page.focus('[data-item-icon-search]');await page.keyboard.press('Enter');
  assert.equal(await page.$eval('#modal',node=>node.open),true,'search Enter does not save');
  await submit();assert.equal((await item()).iconKey,'katana');
  assert.match(await page.$eval('.inventory-list .action-row:last-child img',node=>node.src),/katana.webp$/);
  assert.equal(parseBackup(JSON.stringify(await saved())).characters[0].items.at(-1).iconKey,'katana');
  await page.reload({waitUntil:'networkidle0'});
  const id=(await item()).id;
  const edit=()=>page.click(`[data-action="item"][data-id="${id}"]`);
  await edit();assert.equal(await page.$eval('[name="iconKey"]:checked',node=>node.value),'katana');
  await page.click('.item-icon-picker summary');await search('apple');await choose('apple');await close();
  assert.equal((await item()).iconKey,'katana','cancel leaves saved artwork alone');
  await edit();await page.select('[data-catalog-pick="item"]','longsword');
  assert.equal(await page.$eval('[name="iconKey"]:checked',node=>node.value),'katana','presets keep explicit artwork');
  await page.click('.item-icon-picker summary');await page.click('.item-icon-auto');
  assert.match(await page.$eval('[data-item-icon-preview] img',node=>node.src),/longsword.webp$/);
  await close();
  await page.setViewport({width:390,height:844});await edit();await page.click('.item-icon-picker summary');
  await page.select('[data-item-icon-group]','Weapons');await search('21459');
  assert.equal(await page.$$eval('[data-item-icon-key]:not([hidden])',nodes=>nodes.length),1);
  await choose('katana');
  assert.ok(await page.$eval('#modal',node=>node.scrollWidth<=node.clientWidth),'mobile editor fits');
  await search('sword');
  await mkdir(resolve(root,'screenshots'),{recursive:true});
  await page.$eval('.item-icon-picker',node=>node.scrollIntoView({block:'start'}));
  await page.screenshot({path:resolve(root,'screenshots/item-icon-picker-mobile.png')});
  await page.click('.item-icon-auto');await submit();assert.equal((await item()).iconKey,'');
  await edit();assert.match(await page.$eval('[data-item-icon-preview] img',node=>node.src),/backpack.webp$/);await close();
  // Every shipped image must load, including choices that are not used by presets.
  const missing=await page.evaluate(async keys=>{
    const loaded=await Promise.all(keys.map(key=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve('');img.onerror=()=>resolve(key);img.src=`./assets/equipment/${key}.webp`;})));
    return loaded.filter(Boolean);
  },ITEM_ICON_LIBRARY.map(entry=>entry.key));
  assert.deepEqual(missing,[]);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  await edit();await page.click('.item-icon-picker summary');await search('chakram');await choose('chakram');await submit();
  assert.equal((await item()).iconKey,'chakram','library choices save offline');
  await page.waitForFunction(()=>{const image=document.querySelector('.inventory-list .action-row:last-child img');return image?.complete&&image.naturalWidth>0;});
  await page.setOfflineMode(false);
  // Make a contact sheet for reviewing new LDraw silhouettes and camera angles.
  await page.setViewport({width:1200,height:1000});
  await page.evaluate(entries=>{
    document.body.innerHTML=`<main style="margin:0;padding:20px;display:grid;grid-template-columns:repeat(10,1fr);gap:10px;background:#f6f7f1">${entries.map(entry=>`<div style="text-align:center;font:11px sans-serif"><img src="./assets/equipment/${entry.key}.webp" style="width:90px;height:90px"><div>${entry.label}</div></div>`).join('')}</main>`;
  },ITEM_ICON_LIBRARY.filter(entry=>Object.hasOwn(EXTRA_ITEM_ICONS,entry.key)));
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
  await page.screenshot({path:resolve(root,'screenshots/item-icon-library.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`Item icon picker passed: ${ITEM_ICON_LIBRARY.length} assets, search/category/part ID, preview, presets, cancel, save/reload/backup, Automatic, offline selection, and mobile layout.`);
} finally {await browser?.close();server?.kill();}
