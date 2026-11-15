import assert from 'node:assert/strict';
import {existsSync,readdirSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
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
let server,browser,page,phase='starting browser';
const errors=[],external=[],consoleMessages=[];
try {
  if(!process.env.DICE_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));});
  }
  const softwarePainting=process.env.DICE_TEST_SOFTWARE_RENDERING==='1'?['--disable-accelerated-2d-canvas','--disable-gpu-compositing','--disable-gpu-rasterization']:[];
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader',...softwarePainting]});
  page=await browser.newPage();
  if(process.env.DICE_TEST_CPU_RATE)await page.emulateCPUThrottling(Number(process.env.DICE_TEST_CPU_RATE));
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{consoleMessages.push(`${message.type()}: ${message.text()}`);if(consoleMessages.length>50)consoleMessages.shift();});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)external.push(request.url());});
  await page.setViewport({width:1280,height:1000});
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),defaultPartyState());
  await page.goto(base+'#dice',{waitUntil:'networkidle0'});
  await page.reload({waitUntil:'networkidle0'});
  const instrument=()=>page.evaluate(async()=>{
    window.testDice=[];window.diceSettled=null;window.criticalEvents=[];
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)
        if(node.nodeType===1&&node.matches('.vfx-critical'))window.criticalEvents.push(document.querySelector('.dice-stage')?.dataset.state);
    }).observe(document.body,{childList:true,subtree:true});
    const original=crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues=array=>{if(window.testDice.length){array[0]=window.testDice.shift()-1;return array;}return original(array);};
    document.addEventListener('dice-settled',event=>window.diceSettled=event.detail);
    // Freeze only throw vectors, not the engine, rendering, or settlement calculation.
    // open-dice 1.13 otherwise chooses these with Math.random independently of the dice values.
    const {DiceRoller}=await import(new URL('./dice-engine/dice-engine.js',location.href).href);
    if(typeof DiceRoller.prototype._generateRandomSeed!=='function')throw Error('Update the throw fixture for this open-dice version.');
    DiceRoller.prototype._generateRandomSeed=function(){
      let seed=++window.testThrowIndex;
      const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      return {xPos:random(),yPos:random(),zPos:random(),rotAxis:[random(),random(),random()],rotAngle:random(),vel:[random(),random(),random()],angVel:[random(),random(),random()]};
    };
    const originalRoll=DiceRoller.prototype.roll;
    DiceRoller.prototype.roll=function(dice){window.testThrowIndex=0;return originalRoll.call(this,dice);};
  });
  await instrument();
  const waitForSettled=async(selector='.dice-stage')=>{
    await page.waitForFunction(selector=>['settled','static'].includes(document.querySelector(selector)?.dataset.state),{timeout:20000},selector);
    const result=await page.$eval(selector,node=>({state:node.dataset.state,status:node.querySelector('.dice-stage-status')?.textContent,note:node.querySelector('.dice-stage-note')?.textContent}));
    assert.equal(result.state,'settled',`${phase}: ${JSON.stringify(result)}`);
  };
  const roll=async(expression,values,mode='normal',settled=true)=>{
    phase=`${expression} (${mode})`;
    const modeSelector=`[data-action="roll-mode"][data-mode="${mode}"]`;
    await page.$eval(modeSelector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForFunction(selector=>{
      const node=document.querySelector(selector),rect=node?.getBoundingClientRect();
      return rect&&node.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));
    },{},modeSelector);
    await page.locator(modeSelector).click();
    await page.evaluate(({expression,values})=>{
      window.testDice=[...values];window.diceSettled=null;window.criticalEvents=[];
      document.querySelector('#dice-expression').value=expression;
      document.querySelector('#dice-form').requestSubmit();
    },{expression,values});
    if(settled) {
      await page.waitForSelector('.dice-stage[data-state="rolling"]');
      assert.ok(await page.evaluate(()=>{
        const hidden=selector=>getComputedStyle(document.querySelector(selector)).visibility==='hidden';
        return hidden('#tray-die')&&hidden('#roll-detail')&&hidden('.history-row:first-child')&&
          document.querySelector('.dice-stage-faces').hidden&&
          document.querySelector('#tray-die').getAttribute('aria-hidden')==='true'&&
          !/Result:|\(\d+\)/.test(document.querySelector('.dice-stage-status').textContent+' '+document.querySelector('.dice-stage-note').textContent);
      }),'totals, history, kept results and accessible summaries stay concealed during the throw');
      if(expression==='1d20'&&values[0]===20) {
        await page.waitForSelector('.dice-stage[data-state="rolling"]');
        assert.equal(await page.$('.vfx-canvas'),null,'natural-20 particles must wait for the 3D throw');
      }
      await waitForSettled();
      assert.ok(await page.$eval('#tray-die',node=>getComputedStyle(node).visibility==='visible'&&!node.inert&&node.getAttribute('aria-hidden')!=='true'));
      assert.ok(await page.$('.dice-stage canvas'),expression+' has real 3D dice');
      const outcome=await page.evaluate(()=>window.diceSettled);
      assert.equal(outcome.total,values.reduce((a,b)=>a+b,0),'engine targets match the rolled faces');
      assert.ok(outcome.results.every(r=>r.visible===r.value||(['d10','d100'].includes(r.type)&&r.visible===0&&[10,100].includes(r.value))),'visible faces match targets');
      if(expression==='1d20'&&values[0]===20)assert.deepEqual(await page.evaluate(()=>window.criticalEvents),['settled'],'celebrate only after the actual throw settles');
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

  phase='particle lifetime at low frame rate';
  const particlesStarted=await page.evaluate(async()=>{
    const {clearEffects,playEffect}=await import(new URL('./vfx.js',location.href).href);
    clearEffects();window.normalAnimationFrame=requestAnimationFrame;
    window.requestAnimationFrame=callback=>window.normalAnimationFrame(()=>setTimeout(()=>callback(performance.now()),250));
    playEffect('critical',{label:'Timing check'});
    return !!document.querySelector('.vfx-canvas');
  });
  assert.ok(particlesStarted);
  await page.waitForFunction(()=>!document.querySelector('.vfx-canvas'),{timeout:5000});
  await page.evaluate(()=>{window.requestAnimationFrame=window.normalAnimationFrame;});
  console.log('Particle lifetime stays bounded when frames are slow');

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
  phase='attack';
  await page.click('[data-action="attack-roll"]');
  await page.evaluate(()=>window.testDice=[20]);await page.click('[data-combat-action="roll"]');
  await page.waitForSelector('#modal .dice-stage[data-state="rolling"]');
  assert.ok(await page.$eval('.combat-outcome',node=>getComputedStyle(node).visibility==='hidden'&&node.inert));
  await waitForSettled('#modal .dice-stage');
  assert.match(await page.$eval('.combat-outcome',n=>n.textContent),/Critical hit/);
  await page.click('[data-combat-action="damage"]');
  phase='critical damage';await waitForSettled('#modal .dice-stage');
  await page.click('[data-combat-action="close"]');
  const feature=(await active()).features.find(f=>f.rollFormula&&f.maxUses&&f.used<f.maxUses);
  assert.ok(feature,'default character has a tracked die resource');
  await page.click(`[data-action="feature-roll"][data-id="${feature.id}"]`);
  phase='feature resource';await waitForSettled('#modal .dice-stage');
  assert.equal((await active()).features.find(f=>f.id===feature.id).used,feature.used+1);
  await page.click('#modal [data-action="close"]');
  const beforeRest=await active();
  await page.click('[data-action="rest"][data-kind="short"]');
  await page.evaluate(()=>{window.testDice=[6];document.querySelector('#modal [name="dice"]').value='1';document.querySelector('#modal-form').requestSubmit();});
  phase='Short Rest';await waitForSettled('#modal .dice-stage');
  assert.equal((await active()).hitDice,beforeRest.hitDice-1);
  assert.equal(await page.$eval('#modal .dice-stage-faces',n=>n.textContent),'6');
  await page.click('#modal [data-action="close"]');
  console.log('Combat, one-use feature spending and Short Rest Hit Dice verified');

  await page.setViewport({width:390,height:844});
  await page.goto(base+'#dice',{waitUntil:'networkidle0'});
  // Compare projected die size with the previous 230px mobile tray using the real camera.
  await page.evaluate(()=>{
    window.projectedDice=[];
    const style=document.createElement('style');style.id='previous-dice-size';style.textContent='.dice-surface{height:230px!important}';document.head.append(style);
  });
  await page.evaluate(async()=>{
    const {DiceRoller}=await import(new URL('./dice-engine/dice-engine.js',location.href).href);
    const original=DiceRoller.prototype.roll;
    DiceRoller.prototype.roll=function(dice){
      const camera=this.camera;
      window.projectedDice.push(this.height/(camera.top-camera.bottom)*camera.zoom);
      return original.call(this,dice);
    };
  });
  await roll('1d6',[6]);
  await page.$eval('#previous-dice-size',style=>style.remove());
  await roll('1d100',[42]);
  const scales=await page.evaluate(()=>window.projectedDice);
  assert.equal(scales.at(-1)/scales.at(-2),2,'mobile dice project at exactly twice their previous size');
  assert.ok(await page.$eval('.dice-stage',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  await page.screenshot({path:resolve(root,'.tmp/dice-mobile.png'),fullPage:true});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.ok(await page.$('.dice-stage[data-state="settled"] canvas'),'changing motion preference keeps an already stationary tray stable');
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

  phase='unfinished throw fallback';
  const stalledPage=await browser.newPage();
  await stalledPage.goto(base+'#dice',{waitUntil:'networkidle0'});
  await stalledPage.evaluate(async()=>{
    const {DiceRoller}=await import(new URL('./dice-engine/dice-engine.js',location.href).href);
    DiceRoller.prototype.roll=()=>new Promise(()=>{});
    crypto.getRandomValues=array=>{array[0]=19;return array;};
    document.querySelector('#dice-form').requestSubmit();
  });
  await stalledPage.waitForSelector('.dice-stage[data-state="static"]',{timeout:20000});
  assert.equal(await stalledPage.$eval('#tray-die strong',n=>n.textContent),'20');
  assert.equal(await stalledPage.$$eval('.history-row',nodes=>nodes.length),1,'a timed-out animation never rerolls or records twice');
  assert.equal(await stalledPage.$('.dice-stage canvas'),null);
  await stalledPage.close();
  console.log('Unfinished animation preserves its single recorded result and releases WebGL');

  phase='WebGL fallback';
  const fallbackPage=await browser.newPage();
  await fallbackPage.evaluateOnNewDocument(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};});
  await fallbackPage.goto(base+'#dice',{waitUntil:'networkidle0'});
  await fallbackPage.$eval('#dice-form',form=>form.requestSubmit());
  await fallbackPage.waitForSelector('.dice-stage[data-state="static"]');
  assert.equal(await fallbackPage.$('.dice-stage canvas'),null);
  assert.match(await fallbackPage.$eval('.dice-stage-status',n=>n.textContent),/Result:/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('WebGL failure preserves the result; no runtime external requests or page errors');
} catch(error) {
  const directory=resolve(root,'.tmp/browser-diagnostics/dice');await mkdir(directory,{recursive:true});
  const state=await page?.evaluate(()=>({url:location.href,stage:document.querySelector('.dice-stage')?.outerHTML,result:document.querySelector('#tray-die')?.textContent,outcome:window.diceSettled})).catch(()=>null);
  await writeFile(resolve(directory,'failure.json'),JSON.stringify({phase,error:error.stack,state,errors,consoleMessages},null,2));
  await page?.screenshot({path:resolve(directory,'failure.png'),fullPage:true}).catch(()=>{});
  throw error;
} finally {await browser?.close();server?.kill();}
