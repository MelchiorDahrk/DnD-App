import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {FEATURE_CATALOG} from '../feature-catalog.js';
import {parseBackup} from '../model.js';

const root=resolve(import.meta.dirname,'..');
const port=process.env.FEATURE_TEST_PORT||'4189';
const base=process.env.FEATURE_TEST_URL||`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
const id=(name,owner)=>FEATURE_CATALOG.find(e=>e.name===name&&(!owner||e.owner===owner)).id;
let server,browser;
try{
  if(!process.env.FEATURE_TEST_URL){
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Test server did not start.')),10000);
      server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));
      server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
      server.stderr.once('data',data=>reject(new Error(String(data))));
    });
  }
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:1100});
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),defaultPartyState());
  await page.reload({waitUntil:'networkidle0'});
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const active=s=>s.characters.find(c=>c.id===s.activeId);
  const field=name=>`#modal [name="${name}"]`;
  const value=name=>page.$eval(field(name),node=>node.value);
  const options=()=>page.$$eval('[data-catalog-pick="feat"] option',nodes=>nodes.map(n=>n.value));
  const setValue=async(selector,value)=>page.$eval(selector,(node,value)=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));},String(value));
  const search=async value=>page.$eval('[data-catalog-search="feat"]',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const snapshot=()=>page.$$eval('#modal [name]',nodes=>Object.fromEntries(nodes.map(n=>[n.name,n.value])));
  await page.click('[data-action="feature"]:not([data-id])');
  assert.ok((await options()).includes(id('Second Wind')));
  assert.ok((await options()).includes(id('Superiority Dice')));
  assert.ok(!(await options()).includes(id('Rage')));
  await setValue(field('name'),'A custom ability');await setValue(field('description'),'Keep these notes.');
  const custom=await snapshot();
  await search('zzzznoresults');
  assert.equal((await options()).length,1);assert.deepEqual(await snapshot(),custom);
  await page.select('[data-catalog-scope="feat"]','all');await search('');
  assert.equal((await options()).length,FEATURE_CATALOG.length+1);
  await page.select('[data-catalog-group="feat"]','Class features');await search('second wind');
  await page.select('[data-catalog-pick="feat"]',id('Second Wind'));
  assert.equal(await value('maxUses'),'2');assert.equal(await value('rollFormula'),'1d10+3');
  await setValue('[data-feature-level]',10);
  assert.equal(await value('maxUses'),'4');assert.equal(await value('rollFormula'),'1d10+10');
  await setValue('[data-feature-level]',3);
  const chosen=await snapshot();
  await search('barbarian');assert.deepEqual(await snapshot(),chosen);
  await page.select('[data-catalog-pick="feat"]','');assert.deepEqual(await snapshot(),chosen);
  await search('');
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.screenshot({path:resolve(root,'.tmp/features-desktop.png')});
  for(const width of [390,320]){
    await page.setViewport({width,height:844});
    const geometry=await page.$eval('#modal',node=>{
      const bounds=node.getBoundingClientRect();
      return {left:bounds.left,right:bounds.right,overflow:node.scrollWidth>node.clientWidth};
    });
    assert.ok(geometry.left>=0&&geometry.right<=width&&!geometry.overflow,`${width}px modal fits`);
    await page.screenshot({path:resolve(root,`.tmp/features-${width}.png`)});
  }
  await page.click('#modal button[type="submit"]');
  let saved=await state(),c=active(saved),feature=c.features.at(-1);
  assert.equal(feature.name,'Second Wind');assert.equal(feature.rollFormula,'1d10+3');
  parseBackup(JSON.stringify(saved));
  // Explicit preset selection preserves spent uses; filtering/editing alone preserves every field.
  await page.click(`[data-action="feature"][data-id="${feature.id}"]`);
  await setValue(field('used'),1);await page.click('#modal button[type="submit"]');
  await page.click(`[data-action="feature"][data-id="${feature.id}"]`);
  const editing=await snapshot();await search('Lucky');assert.deepEqual(await snapshot(),editing);
  await page.click('#modal button[type="submit"]');
  assert.equal(active(await state()).features.at(-1).used,1);
  console.log('PASS suggestions, all-option/category/search filters, custom field preservation, class-level scaling, save/edit, 320px and 390px layouts');
  // Large point pools retain all points and render a bounded number of controls.
  await page.click('[data-action="feature"]:not([data-id])');
  await page.select('[data-catalog-scope="feat"]','all');await search('lay on hands');
  await page.select('[data-catalog-pick="feat"]',id('Lay On Hands'));await setValue('[data-feature-level]',20);
  assert.equal(await value('maxUses'),'100');
  await page.click('#modal button[type="submit"]');
  saved=await state();feature=active(saved).features.at(-1);parseBackup(JSON.stringify(saved));
  const row=`[data-sheet-entry="${feature.id}"]`;
  assert.equal(await page.$$eval(`${row} .slot-dot`,nodes=>nodes.length),0);
  await page.click(`${row} [data-action="feature-use"][data-used="1"]`);
  assert.equal(active(await state()).features.at(-1).used,1);
  await page.click(`${row} [data-action="feature-use"][data-used="0"]`);
  assert.equal(active(await state()).features.at(-1).used,0);
  console.log('PASS 100-point pools round-trip and spend/restore through compact controls');
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  await page.click('[data-action="feature"]:not([data-id])');
  await page.select('[data-catalog-scope="feat"]','all');
  assert.equal((await options()).length,FEATURE_CATALOG.length+1);
  await page.select('[data-catalog-group="feat"]','Maneuvers');await search('riposte');
  await page.select('[data-catalog-pick="feat"]',id('Riposte'));
  assert.equal(await value('maxUses'),'0');assert.match(await value('description'),/shared Superiority Dice/);
  assert.deepEqual(errors,[]);
  console.log('PASS full catalog reloads offline and shared-pool options have no duplicate charges; no browser errors');
}finally{await browser?.close();server?.kill();}
