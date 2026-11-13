import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {COINS,parseBackup} from '../model.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.CURRENCY_TEST_PORT||'4191';
const base=process.env.CURRENCY_TEST_URL||`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium or Firefox browser.');
const isFirefox=/firefox/i.test(executablePath);
let server,browser,calmBrowser;
try {
  if(!process.env.CURRENCY_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Test server did not start.')),10000);
      server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));
      server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
      server.stderr.once('data',data=>reject(new Error(String(data))));
    });
  }
  browser=await puppeteer.launch({executablePath,browser:isFirefox?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1440,height:1000});
  await page.goto(base,{waitUntil:'networkidle0'});
  const initial=defaultPartyState();
  Object.keys(COINS).forEach(key=>initial.characters[0][key]=50);
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),initial);
  await page.goto(`${base}#inventory`,{waitUntil:'networkidle0'});
  await page.reload({waitUntil:'networkidle0'});
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const balances=async()=>{const saved=await state(),c=saved.characters.find(c=>c.id===saved.activeId);return Object.fromEntries(Object.keys(COINS).map(key=>[key,c[key]]));};
  const open=()=>page.click('[data-action="currency"]');
  const enter=(key,value)=>page.$eval(`#modal [name="${key}"]`,(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const submit=()=>page.click('#modal button[type="submit"]');
  await open();
  await enter('gold','+10');assert.equal(await page.$eval('#gold-result',node=>node.textContent),'50 GP → 60 GP');
  assert.deepEqual(await balances(),Object.fromEntries(Object.keys(COINS).map(key=>[key,50])));
  await page.click('#modal [data-action="close"]');
  await open();assert.equal(await page.$eval('#modal [name="gold"]',node=>node.value),'50');
  const expressions={copper:'-5',silver:'25+10-5',electrum:'0',gold:'+10',platinum:' + 10 − 5 '};
  for(const [key,value] of Object.entries(expressions))await enter(key,value);
  await submit();
  assert.deepEqual(await balances(),{copper:45,silver:30,electrum:0,gold:60,platinum:55});
  parseBackup(JSON.stringify(await state()));
  await page.waitForFunction(()=>[...document.querySelectorAll('.vfx-stud')].every(img=>img.complete&&img.naturalWidth));
  const effects=await page.$$eval('.vfx-stud',nodes=>nodes.map(node=>({src:node.getAttribute('src'),className:node.className,animation:node.getAnimations()[0]?.playState,pointerEvents:getComputedStyle(node).pointerEvents})));
  assert.equal(effects.length,35);
  assert.equal(effects.filter(effect=>effect.className.includes('gain')).length,14);
  assert.equal(effects.filter(effect=>effect.className.includes('spend')).length,21);
  assert.ok(effects.every(effect=>effect.pointerEvents==='none'&&effect.animation==='running'));
  assert.ok(effects.some(effect=>effect.src.endsWith('coin-gold.webp')));
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.screenshot({path:resolve(root,'.tmp/currency-studs.png')});
  await page.waitForFunction(()=>!document.querySelector('.vfx-layer'));
  await open();await enter('gold','+1');await enter('platinum','-999');await submit();
  assert.ok(await page.$eval('#modal',node=>node.open));
  assert.match(await page.$eval('#form-error',node=>node.textContent),/Platinum:.*enough coins/);
  assert.equal((await balances()).gold,60);assert.equal((await balances()).platinum,55);
  for(const value of ['1.5','1e3','10+','100000001']) {
    await enter('platinum',value);await submit();
    assert.equal((await balances()).gold,60);
    assert.equal(await page.$eval('#modal [name="platinum"]',node=>node.getAttribute('aria-invalid')),'true');
  }
  await enter('platinum','55');
  await enter('gold','-5');
  for(const width of [390,320]) {
    await page.setViewport({width,height:844});
    const geometry=await page.$eval('#modal',node=>{const rect=node.getBoundingClientRect();return {left:rect.left,right:rect.right,overflow:node.scrollWidth>node.clientWidth};});
    assert.ok(geometry.left>=0&&geometry.right<=width&&!geometry.overflow,`${width}px purse fits`);
    await page.screenshot({path:resolve(root,`.tmp/currency-${width}.png`)});
  }
  await submit();assert.equal((await balances()).gold,55);
  assert.equal(await page.$$eval('.vfx-stud-spend',nodes=>nodes.length),7);
  await open();await submit();
  assert.equal(await page.$$eval('.vfx-money',nodes=>nodes.length),0,'unchanged balances do not animate');
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const savedBalances=await balances();
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  assert.deepEqual(await balances(),savedBalances);
  await open();await enter('copper','+2');await submit();
  assert.equal((await balances()).copper,47);
  await page.waitForFunction(()=>[...document.querySelectorAll('.vfx-stud')].every(img=>img.complete&&img.naturalWidth));
  assert.equal(await page.$$eval('.vfx-stud-gain',nodes=>nodes.length),7);
  // Firefox uses its native preference; Chromium supports per-page media emulation.
  if(isFirefox)calmBrowser=await puppeteer.launch({executablePath,browser:'firefox',headless:true,extraPrefsFirefox:{'ui.prefersReducedMotion':1}});
  const calmPage=await (calmBrowser||browser).newPage();
  calmPage.on('pageerror',error=>errors.push(error.message));
  if(!isFirefox)await calmPage.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await calmPage.goto(base,{waitUntil:'networkidle0'});
  await calmPage.evaluate(saved=>localStorage.setItem('questlog.v2',JSON.stringify(saved)),await state());
  await calmPage.reload({waitUntil:'networkidle0'});
  assert.equal(await calmPage.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  await calmPage.click('[data-action="currency"]');
  await calmPage.$eval('#modal [name="gold"]',input=>{input.value='+5';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await calmPage.click('#modal button[type="submit"]');
  assert.equal(await calmPage.$$eval('.vfx-stud',nodes=>nodes.length),0);
  assert.equal(await calmPage.$eval('.vfx-money.vfx-calm .vfx-caption strong',node=>node.textContent),'+5 GP');
  assert.deepEqual(errors,[]);
  console.log('PASS currency totals, relative changes, expressions, live previews, cancel, atomic validation, stud gains/spending, cleanup, 320px/390px layouts, reduced motion, persistence and offline use');
} finally {await calmBrowser?.close();await browser?.close();server?.kill();}
