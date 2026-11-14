import assert from 'node:assert/strict';
import {existsSync,readdirSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';

const root=resolve(import.meta.dirname,'..'),port=process.env.DICE_TEST_PORT||'4198';
const base=process.env.DICE_TEST_URL||`http://127.0.0.1:${port}/dist/`;
const cache=resolve(root,'.cache/puppeteer/chrome-headless-shell');
const cachedBrowsers=existsSync(cache)?readdirSync(cache).reverse().map(version=>resolve(cache,version,'chrome-headless-shell-win64/chrome-headless-shell.exe')):[];
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe',...cachedBrowsers,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath&&!/firefox/i.test(executablePath),'Set BROWSER_PATH to Chrome/Chromium for offline and media emulation.');
let server,browser;
try {
  if(!process.env.DICE_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));});
  }
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const page=await browser.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)external.push(request.url());});
  await page.setViewport({width:1280,height:1000});
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),defaultPartyState());
  await page.goto(base+'#dice',{waitUntil:'networkidle0'});
  await page.reload({waitUntil:'networkidle0'});
  const instrument=()=>page.evaluate(()=>{
    window.testDice=[];window.diceSettled=null;
    const original=crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues=array=>{if(window.testDice.length){array[0]=window.testDice.shift()-1;return array;}return original(array);};
    document.addEventListener('dice-settled',event=>window.diceSettled=event.detail);
  });
  await instrument();
  const roll=async(expression,values,mode='normal',settled=true)=>{
    await page.click(`[data-action="roll-mode"][data-mode="${mode}"]`);
    await page.evaluate(({expression,values})=>{
      window.testDice=[...values];window.diceSettled=null;
      document.querySelector('#dice-expression').value=expression;
      document.querySelector('#dice-form').requestSubmit();
    },{expression,values});
    if(settled) {
      await page.waitForSelector('.dice-stage[data-state="settled"]',{timeout:20000});
      assert.ok(await page.$('.dice-stage canvas'),expression+' has real 3D dice');
      const outcome=await page.evaluate(()=>window.diceSettled);
      assert.equal(outcome.total,values.reduce((a,b)=>a+b,0),'engine targets match the rolled faces');
      assert.ok(outcome.results.every(r=>r.visible===r.value||(['d10','d100'].includes(r.type)&&r.visible===0&&[10,100].includes(r.value))),'visible faces match targets');
    }
  };
  for(const sides of [4,6,8,10,12,20,100]) {
    await roll(`1d${sides}`,[sides]);
    assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),String(sides));
    console.log(`d${sides}: actual canvas and landing face verified`);
  }
  await roll('2d6+3',[2,5]);assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'10');
  await roll('1d20+4',[3,17],'advantage');assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'21');
  await roll('1d20-2',[3,17],'disadvantage');assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'1');
  await mkdir(resolve(root,'.tmp'),{recursive:true});await page.screenshot({path:resolve(root,'.tmp/dice-desktop.png'),fullPage:true});
  console.log('Modifiers and advantage/disadvantage verified');

  // A new roll cancels animation only: both outcomes are recorded exactly once.
  const count=await page.$$eval('.history-row',nodes=>nodes.length);
  await roll('1d20',[4],'normal',false);await roll('1d6',[6]);
  assert.equal(await page.$$eval('.history-row',nodes=>nodes.length),count+2);
  assert.equal(await page.$$eval('.dice-stage canvas',nodes=>nodes.length),1);
  await page.click('[data-action="navigate"][data-route="sheet"]');
  assert.equal(await page.$('.dice-stage'),null);
  await page.click('[data-action="ability-roll"][data-key="str"]');
  await page.waitForSelector('#modal .dice-stage canvas');
  await page.click('#modal [data-action="close"]');
  await page.waitForFunction(()=>!document.querySelector('.dice-stage'));
  console.log('Fast rerolls, navigation, sheet rolls and dialog cleanup verified');

  const active=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));return s.characters.find(c=>c.id===s.activeId);});
  await page.click('[data-action="attack-roll"]');
  await page.evaluate(()=>window.testDice=[20]);await page.click('[data-combat-action="roll"]');
  await page.waitForSelector('#modal .dice-stage[data-state="settled"]',{timeout:20000});
  assert.match(await page.$eval('.combat-outcome',n=>n.textContent),/Critical hit/);
  await page.click('[data-combat-action="damage"]');
  await page.waitForSelector('#modal .dice-stage[data-state="settled"]',{timeout:20000});
  await page.click('[data-combat-action="close"]');
  const feature=(await active()).features.find(f=>f.rollFormula&&f.maxUses&&f.used<f.maxUses);
  assert.ok(feature,'default character has a tracked die resource');
  await page.click(`[data-action="feature-roll"][data-id="${feature.id}"]`);
  await page.waitForSelector('#modal .dice-stage[data-state="settled"]',{timeout:20000});
  assert.equal((await active()).features.find(f=>f.id===feature.id).used,feature.used+1);
  await page.click('#modal [data-action="close"]');
  const beforeRest=await active();
  await page.click('[data-action="rest"][data-kind="short"]');
  await page.evaluate(()=>{window.testDice=[6];document.querySelector('#modal [name="dice"]').value='1';document.querySelector('#modal-form').requestSubmit();});
  await page.waitForSelector('#modal .dice-stage[data-state="settled"]',{timeout:20000});
  assert.equal((await active()).hitDice,beforeRest.hitDice-1);
  assert.equal(await page.$eval('#modal .dice-stage-faces',n=>n.textContent),'6');
  await page.click('#modal [data-action="close"]');
  console.log('Combat, one-use feature spending and Short Rest Hit Dice verified');

  await page.setViewport({width:390,height:844});
  await page.goto(base+'#dice',{waitUntil:'networkidle0'});
  await roll('1d100',[42]);
  assert.ok(await page.$eval('.dice-stage',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  await page.screenshot({path:resolve(root,'.tmp/dice-mobile.png'),fullPage:true});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await roll('1d20+2',[18],'normal',false);
  await page.waitForSelector('.dice-stage[data-state="static"]');
  assert.equal(await page.$('.dice-stage canvas'),null);
  assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'20');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await roll('1d3',[3],'normal',false);await page.waitForSelector('.dice-stage[data-state="static"]');
  await roll('50d6',Array(50).fill(2),'normal',false);await page.waitForSelector('.dice-stage[data-state="static"]');
  assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'100');
  await roll('7',[],'normal',false);assert.equal(await page.$('.dice-stage'),null);
  console.log('Mobile, reduced motion and fallback results verified');

  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});await instrument();
  await roll('2d6+1',[3,6]);assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'10');
  await page.setOfflineMode(false);
  console.log('3D engine works offline under the production subpath');

  const fallbackPage=await browser.newPage();
  await fallbackPage.evaluateOnNewDocument(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};});
  await fallbackPage.goto(base+'#dice',{waitUntil:'networkidle0'});
  await fallbackPage.$eval('#dice-form',form=>form.requestSubmit());
  await fallbackPage.waitForSelector('.dice-stage[data-state="static"]');
  assert.equal(await fallbackPage.$('.dice-stage canvas'),null);
  assert.match(await fallbackPage.$eval('.dice-stage-status',n=>n.textContent),/Result:/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('WebGL failure preserves the result; no runtime external requests or page errors');
} finally {await browser?.close();server?.kill();}
