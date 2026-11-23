import assert from 'node:assert/strict';
import {existsSync,readdirSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {visualChecks} from '../tests/helpers/browser-checks.mjs';

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
  phase='custom dice colors';
  assert.equal(await page.$('[data-dice-color]'),null,'Dice color editing stays in Settings');
  assert.equal(await page.$('.dice-selection, .dice-notation, #dice-expression'),null,'The wheels are the roll page’s dice controls');
  assert.equal(await page.$('.tray-eyebrow'),null);
  assert.equal(await page.$eval('.roll-history-empty',node=>node.textContent),'');
  assert.ok(await page.$('.roll-history-empty>.icon'));
  await page.goto(base+'#settings',{waitUntil:'networkidle0'});
  const colors={body:'#7c3aed',numbers:'#e6ffb3'};
  const controls=()=>page.$$eval('[data-dice-color]',inputs=>Object.fromEntries(inputs.map(input=>[input.dataset.diceColor,input.value])));
  const setColor=(key,value)=>page.$eval(`[data-dice-color="${key}"]`,(input,value)=>{
    input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  },value);
  assert.deepEqual(await controls(),{body:'#365f58',numbers:'#fff5d7'});
  await setColor('body',colors.body);await setColor('numbers',colors.numbers);
  assert.deepEqual(await page.$eval('[data-dice-color-preview]',node=>({body:node.style.getPropertyValue('--dice-body'),numbers:node.style.getPropertyValue('--dice-numbers')})),colors);
  await page.goto(base+'#settings',{waitUntil:'networkidle0'});
  assert.deepEqual(await controls(),colors,'Settings shares the dice roller preferences');
  await page.$eval('[data-action="reset-dice-colors"]',node=>node.click());
  assert.deepEqual(await controls(),{body:'#365f58',numbers:'#fff5d7'});
  await page.reload({waitUntil:'networkidle0'});
  assert.deepEqual(await controls(),{body:'#365f58',numbers:'#fff5d7'},'reset persists');
  await setColor('body',colors.body);await setColor('numbers',colors.numbers);
  await page.goto(base+'#dice',{waitUntil:'networkidle0'});
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$('[data-dice-color]'),null,'The roll page remains free of color controls after reloading');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.dice-colors.v1'))),colors);
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.screenshot({path:resolve(root,'.tmp/dice-color-controls.png'),fullPage:true});
  console.log('Independent color pickers, preview, shared Settings, reset and persistence verified');
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
    DiceRoller.prototype.roll=function(dice){window.testThrowIndex=0;window.testDiceRoller=this;window.testDiceConfig=dice.map(({diceColor,backgroundColor,textColor})=>({diceColor,backgroundColor,textColor}));return originalRoll.call(this,dice);};
  });
  await instrument();
  const assertDiceColors=async()=>{
    const actual=await page.evaluate(()=>window.testDiceConfig);
    assert.ok(actual?.length,'dice colors reach the real engine');
    assert.ok(actual.every(die=>die.diceColor===0xffffff&&die.backgroundColor===colors.body&&die.textColor===colors.numbers),'body and number colors apply independently to every die');
  };
  const waitForSettled=async(selector='.dice-stage')=>{
    await page.waitForFunction(selector=>['settled','static'].includes(document.querySelector(selector)?.dataset.state),{timeout:20000},selector);
    const result=await page.$eval(selector,node=>({state:node.dataset.state,status:node.querySelector('.dice-stage-status')?.textContent,note:node.querySelector('.dice-stage-note')?.textContent}));
    assert.equal(result.state,'settled',`${phase}: ${JSON.stringify(result)}`);
  };
  const selectDice=expression=>page.evaluate(expression=>{
    const [quantity,sides]=expression.split('d');
    document.querySelector(`[data-dice-wheel="quantity"] [data-dice-value="${quantity}"]`).click();
    document.querySelector(`[data-dice-wheel="sides"] [data-dice-value="${sides}"]`).click();
  },expression);
  const roll=async(expression,values,mode='normal',settled=true)=>{
    phase=`${expression} (${mode})`;
    await selectDice(expression);
    const modeSelector=`[data-action="roll-mode"][data-mode="${mode}"]`;
    await page.$eval(modeSelector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForFunction(selector=>{
      const node=document.querySelector(selector),rect=node?.getBoundingClientRect();
      return rect&&node.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));
    },{},modeSelector);
    await page.locator(modeSelector).click();
    await page.evaluate(values=>{
      window.testDice=[...values];window.diceSettled=null;window.criticalEvents=[];
      document.querySelector('#dice-form').requestSubmit();
    },values);
    if(settled) {
      await page.waitForSelector('.dice-stage[data-state="rolling"]');
      const rollingHeight=await page.$eval('.dice-tray',node=>node.getBoundingClientRect().height);
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
      assert.ok(Math.abs(await page.$eval('.dice-tray',node=>node.getBoundingClientRect().height)-rollingHeight)<1,'Revealing faces and the total preserves tray height');
      assert.ok(await page.$eval('#tray-die',node=>getComputedStyle(node).visibility==='visible'&&!node.inert&&node.getAttribute('aria-hidden')!=='true'));
      assert.ok(await page.$('.dice-stage canvas'),expression+' has real 3D dice');
      await assertDiceColors();
      const outcome=await page.evaluate(()=>window.diceSettled);
      assert.equal(outcome.total,values.reduce((a,b)=>a+b,0),'engine targets match the rolled faces');
      assert.ok(outcome.results.every(r=>r.visible===r.value||(['d10','d100'].includes(r.type)&&r.visible===0&&[10,100].includes(r.value))),'visible faces match targets');
      if(expression==='1d20'&&values[0]===20)assert.deepEqual(await page.evaluate(()=>window.criticalEvents),['settled'],'celebrate only after the actual throw settles');
    }
  };
  const dieGeometry=()=>page.evaluate(()=>window.testDiceRoller.dice.map(({type,mesh,body})=>{
    mesh.geometry.computeBoundingBox();
    const {min,max}=mesh.geometry.boundingBox;
    return {type,meshSize:max.clone().sub(min).length(),bodySize:body.boundingRadius};
  }));
  const desktopGeometry=new Map();
  for(const sides of [4,6,8,10,12,20,100]) {
    await roll(`1d${sides}`,[sides]);
    assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),String(sides));
    desktopGeometry.set(`d${sides}`,(await dieGeometry())[0]);
    console.log(`d${sides}: actual canvas and landing face verified`);
  }
  await roll('2d6',[2,5]);assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'7');
  await roll('1d20',[3,17],'advantage');assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'17');
  await roll('1d20',[3,17],'disadvantage');assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'3');
  await mkdir(resolve(root,'.tmp'),{recursive:true});await page.screenshot({path:resolve(root,'.tmp/dice-desktop.png'),fullPage:true});
  console.log('Multiple dice and advantage/disadvantage verified');

  phase='Quick roll';
  const quickHistory=await page.$$eval('.history-row',nodes=>nodes.length);
  await page.locator('[data-action="roll-mode"][data-mode="advantage"]').click();
  await page.evaluate(()=>{window.testDice=[6,20];window.criticalEvents=[];});
  await page.locator('#dice-form button[value="quick"]').click();
  assert.equal(await page.$eval('.dice-stage',node=>node.dataset.state),'static');
  assert.equal(await page.$('.dice-stage canvas, .dice-pending'),null);
  assert.equal(await page.$eval('.dice-face-kept',node=>node.textContent),'20');
  assert.equal(await page.$eval('#tray-die strong',node=>node.textContent),'20');
  assert.equal(await page.$$eval('.history-row',nodes=>nodes.length),quickHistory+1);
  assert.deepEqual(await page.evaluate(()=>window.criticalEvents),[]);

  phase='effect cleanup';
  const particlesStarted=await page.evaluate(async()=>{
    const {clearEffects,playEffect}=await import(new URL('./vfx.js',location.href).href);
    clearEffects();playEffect('critical',{label:'Cleanup check'});
    return !!document.querySelector('.vfx-canvas');
  });
  assert.ok(particlesStarted);
  // Poll independently of animation frames: software rendering can delay them.
  // Sparse-frame lifetime behavior is checked with a controlled clock in unit tests.
  await page.waitForFunction(()=>!document.querySelector('.vfx-layer'),{polling:100,timeout:15000});
  console.log('Effects release their canvas and overlay after playback');

  // A new roll cancels animation only: both outcomes are recorded exactly once.
  const count=await page.$$eval('.history-row',nodes=>nodes.length);
  await roll('1d20',[4],'normal',false);await roll('1d6',[6]);
  assert.equal(await page.$$eval('.history-row',nodes=>nodes.length),count+2);
  assert.equal(await page.$$eval('.dice-stage canvas',nodes=>nodes.length),1);
  await page.click('[data-action="navigate"][data-route="sheet"]');
  assert.equal(await page.$('.dice-stage'),null);
  await page.click('[data-action="ability-roll"][data-key="str"]');
  await page.waitForSelector('#modal .dice-stage canvas');
  await assertDiceColors();
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

  // Use the Roll dice button, including rerolls, without scrolling to the result after settlement.
  for(const viewport of [{width:390,height:844},{width:390,height:664},{width:320,height:568},{width:760,height:1024}]) {
    await page.setViewport(viewport);
    await page.goto(base+'#dice',{waitUntil:'networkidle0'});
    await instrument();
    const mobileRolls=[['1d6',[6]],['1d100',[42]]];
    if(viewport.width===390&&viewport.height===844)mobileRolls.push(['1d4',[4]],['1d8',[8]],['1d10',[10]],['1d12',[12]],['1d20',[16]],['4d6',[1,2,3,4]],['2d20',[3,17]]);
    for(const [expression,values] of mobileRolls) {
      phase=`mobile ${viewport.width}×${viewport.height}: ${expression}`;
      await selectDice(expression);
      await page.evaluate(values=>{
        window.testDice=[...values];window.diceSettled=null;
      },values);
      const submit='#dice-form button[type="submit"]';
      await page.$eval(submit,node=>node.scrollIntoView({block:'center',behavior:'instant'}));
      await page.waitForFunction(selector=>{
        const node=document.querySelector(selector),rect=node?.getBoundingClientRect();
        return rect&&node.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));
      },{},submit);
      await page.locator(submit).click();
      await waitForSettled();
      assert.ok(await page.$('.dice-stage canvas'),'mobile roll keeps the 3D dice');
      await assertDiceColors();
      assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),String(values.reduce((sum,value)=>sum+value,0)));
      for(const die of await dieGeometry()){
        const baseline=desktopGeometry.get(die.type);
        const meshScale=die.meshSize/baseline.meshSize,bodyScale=die.bodySize/baseline.bodySize;
        assert.ok(Math.abs(meshScale-bodyScale)<0.00001,`${phase}: collision shape scales with the visible die`);
        if(visualChecks)assert.ok(Math.abs(meshScale-3)<0.00001,`${phase}: visible die is three times larger`);
      }
      const layout=await page.evaluate(()=>{
        const rect=selector=>document.querySelector(selector).getBoundingClientRect();
        const stage=rect('.dice-stage'),surface=rect('.dice-surface'),total=rect('#tray-die strong');
        const top=rect('.topbar').bottom,bottom=rect('.mobile-nav').top;
        return {fits:stage.left>=0&&stage.right<=innerWidth,compact:Math.abs(surface.height-Math.max(140,Math.min(innerHeight*.28,230)))<1,
          resultVisible:total.top>=top&&total.bottom<=bottom,totalTop:total.top,totalBottom:total.bottom,top,bottom};
      });
      if(visualChecks)assert.ok(layout.fits&&layout.compact,`${phase}: compact tray fits the phone: ${JSON.stringify(layout)}`);
      assert.ok(layout.resultVisible,`${phase}: total stays above mobile navigation: ${JSON.stringify(layout)}`);
      if(viewport.width===390&&viewport.height===844)await page.$eval('.dice-stage',n=>n.scrollIntoView({block:'start',behavior:'instant'}));
      if(viewport.width===390&&viewport.height===844)await page.screenshot({path:resolve(root,`.tmp/dice-mobile-${expression}.png`)});
    }
    if(viewport.width===390&&viewport.height===844)await page.screenshot({path:resolve(root,'.tmp/dice-mobile.png')});
  }
  await page.setViewport({width:390,height:844});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.ok(await page.$('.dice-stage[data-state="settled"] canvas'),'changing motion preference keeps an already stationary tray stable');
  await roll('1d20',[18],'normal',false);
  await page.waitForSelector('.dice-stage[data-state="static"]');
  assert.equal(await page.$('.dice-stage canvas'),null);
  assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'18');
  assert.deepEqual(await page.$eval('.dice-stage-faces span',node=>({body:getComputedStyle(node).backgroundColor,numbers:getComputedStyle(node).color})),{body:'rgb(124, 58, 237)',numbers:'rgb(230, 255, 179)'},'reduced motion also uses the chosen dice colors');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await roll('50d6',Array(50).fill(2),'normal',false);await page.waitForSelector('.dice-stage[data-state="static"]');
  assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'100');
  console.log('Mobile dice rolls and visible results, reduced motion and fallback results verified');

  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});await instrument();
  await roll('2d6',[3,6]);assert.equal(await page.$eval('#tray-die strong',n=>n.textContent),'9');
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
