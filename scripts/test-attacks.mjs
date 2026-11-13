import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {WEAPONS,attackFromWeapon} from '../catalog.js';
import {parseBackup} from '../model.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.ATTACK_TEST_PORT||'4194';
const base=process.env.ATTACK_TEST_URL||`http://127.0.0.1:${port}${process.env.ATTACK_TEST_PATH||'/'}`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a browser.');
let server,browser,calmBrowser;
try{
  if(!process.env.ATTACK_TEST_URL){
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));});
  }
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1280,height:1000});await page.goto(base,{waitUntil:'networkidle0'});
  const initial=defaultPartyState(),c=initial.characters[1];initial.activeId=c.id;c.inspiration=true;
  for(const name of ['Greatsword','Dagger','Scimitar','Pike','Rapier','Longbow','Spear']){
    const weapon=WEAPONS.find(w=>w.name===name);c.attacks.push({id:weapon.id,...attackFromWeapon(weapon,c),mastery:weapon.mastery});
  }
  c.features.push({...initial.characters[2].features.find(f=>f.name==='Sneak Attack'),id:'sneak'});
  const superiority={...initial.characters[0].features.find(f=>/Superiority Dice/i.test(f.name)),id:'superiority'};
  assert.ok(superiority.rollFormula);c.features.push(superiority);
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),initial);await page.reload({waitUntil:'networkidle0'});
  // Deterministic real dice for browser assertions. No attack UI or rules are mocked.
  await page.evaluate(()=>{window.attackTestDice=[];const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(window.attackTestDice.length){array[0]=window.attackTestDice.shift()-1;return array;}return original(array);};});
  const dice=values=>page.evaluate(values=>window.attackTestDice=[...values],values);
  const action=name=>`#modal [data-combat-action="${name}"]`;
  const click=name=>page.click(action(name));
  const open=async(id,values=[12])=>{await page.click(`[data-action="attack-roll"][data-id="${id}"]`);await dice(values);};
  const close=async()=>{await click('close');await page.waitForFunction(()=>!document.querySelector('#modal').open);};
  const active=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));return s.characters.find(c=>c.id===s.activeId);});
  const axe=c.attacks.find(a=>a.name==='Greataxe'),battleaxe=c.attacks.find(a=>a.name==='+1 Battleaxe');

  await open(axe.id,[20]);await click('roll');
  assert.match(await page.$eval('.combat-outcome',n=>n.textContent),/Critical hit/);
  await page.waitForSelector('.vfx-weapon img');
  assert.match(await page.$eval('.vfx-weapon img',n=>n.getAttribute('src')),/greataxe/);
  assert.equal(await page.$eval('.vfx-layer',n=>getComputedStyle(n).pointerEvents),'none');
  await dice([4,8]);await click('damage');
  assert.match(await page.$eval('.combat-followup .roll-expression',n=>n.textContent),/2d12\+3/);
  assert.equal(await page.$eval('.combat-followup .big-die strong',n=>n.textContent),'15');
  await click('cleave');assert.match(await page.$eval('.combat-weapon',n=>n.textContent),/Cleave/);
  await dice([12]);await click('roll');await click('hit');await dice([7]);await click('damage');
  assert.match(await page.$eval('.combat-followup .roll-expression',n=>n.textContent),/1d12$/);
  assert.equal(await page.$eval(action('cleave'),n=>n.disabled),true,'no recursive Cleave');await close();

  await open(battleaxe.id);await click('roll');await click('hit');
  assert.match(await page.$eval('[data-mastery="Topple"]',n=>n.textContent),/DC 13/);
  await page.$eval('[name="targetCon"]',n=>n.value='2');await dice([10]);await click('topple');
  assert.match(await page.$eval('.combat-save',n=>n.textContent),/12.*Failed: Prone/);await close();

  await open('greatsword',[1]);await click('roll');
  assert.match(await page.$eval('[data-mastery="Graze"]',n=>n.textContent),/3 Slashing damage/);
  assert.equal(await page.$(action('damage')),null);await close();

  await open('dagger',[9]);await click('roll');await click('hit');
  await click('light'); // Scimitar follows Dagger in the only other Light option.
  assert.match(await page.$eval('.combat-weapon',n=>n.textContent),/Scimitar.*Light extra attack/);
  await dice([12]);await click('roll');await click('hit');
  assert.match(await page.$eval('[data-mastery="Nick"]',n=>n.textContent),/does not also grant/);
  assert.equal(await page.$(action('light')),null);await close();

  for(const [id,mastery,text] of [['pike','Push','Large or smaller'],['spear','Sap','next attack'],['longbow','Slow','do not stack'],['rapier','Vex','same creature']]){
    await open(id,[14,14]);await click('roll');await click('hit');
    assert.ok((await page.$eval(`[data-mastery="${mastery}"]`,n=>n.textContent)).includes(text));await close();
  }

  await open('rapier',[3]);await click('roll');
  await dice([20]);await page.click(`${action('inspiration')}[data-index="0"]`);
  assert.match(await page.$eval('.combat-outcome',n=>n.textContent),/Critical/);
  assert.equal((await active()).inspiration,false);
  await page.click('.combat-details summary');await dice([2,3,4,5]);
  await page.click(`${action('feature')}[data-id="sneak"]`);
  assert.match(await page.$eval('.combat-extra-result .roll-expression',n=>n.textContent),/4d6/);
  const before=(await active()).features.find(f=>f.id==='superiority').used;
  await page.click('.combat-details summary');await dice([5,6]);await page.click(`${action('feature')}[data-id="superiority"]`);
  assert.equal((await active()).features.find(f=>f.id==='superiority').used,before+1);
  await page.click('.combat-details summary');assert.equal(await page.$eval(`${action('feature')}[data-id="superiority"]`,n=>n.disabled),true);
  await close();

  const claws=c.attacks.find(a=>a.name==='Beast: Claws');
  await open(claws.id);await click('roll');await click('hit');await click('claw');
  await dice([12]);await click('roll');await click('hit');await dice([4]);await click('damage');
  assert.match(await page.$eval('.combat-followup .roll-expression',n=>n.textContent),/1d6\+3/);
  assert.equal(await page.$(action('claw')),null,'the extra claw cannot trigger itself');await close();

  // Cover is added to AC; disadvantage cancels situational advantage.
  await open('longbow',[10]);await page.$eval('[name="ac"]',n=>n.value='15');await page.$eval('[name="distance"]',n=>n.value='200');await page.select('[name="cover"]','half');await page.click('[name="advantage"]');await click('roll');
  assert.match(await page.$eval('.combat-outcome',n=>n.textContent),/Miss.*AC 17/);
  assert.match(await page.$eval('.form-help',n=>n.textContent),/cancel/);await close();
  await open('longbow');await page.$eval('[name="distance"]',n=>n.value='601');await click('roll');
  assert.match(await page.$eval('#form-error',n=>n.textContent),/long range/);await close();

  await open('rapier',[19]);await page.$eval('[name="ac"]',n=>n.value='99');await click('roll');
  await click('critical');assert.match(await page.$eval('.combat-outcome',n=>n.textContent),/Critical hit/);await close();

  // Editor, saved unlock, renamed magic weapon, custom option, and backup validation.
  await page.click(`[data-action="attack"][data-id="${battleaxe.id}"]`);
  assert.equal(await page.$eval('[name="mastery"]',n=>n.value),'Topple');
  assert.equal(await page.$eval('[name="weaponId"]',n=>n.value),'battleaxe');
  await page.select('[name="mastery"]','');await page.click('#modal button[type="submit"]');
  assert.equal((await active()).attacks.find(a=>a.id===battleaxe.id).mastery,'');
  parseBackup(JSON.stringify(await page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')))));

  // Direct damage supports a critical toggle, and mobile dialogs remain within the viewport.
  await page.setViewport({width:390,height:844});
  await page.click(`[data-action="damage-roll"][data-id="${axe.id}"]`);await page.click('[name="directCritical"]');await dice([4,4]);await click('damage');
  await mkdir(resolve(root,'.tmp'),{recursive:true});await page.screenshot({path:resolve(root,'.tmp/attack-mobile.png')});
  for(const width of [390,320]){
    await page.setViewport({width,height:844});
    const geometry=await page.$eval('#modal',n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,overflow:n.scrollWidth>n.clientWidth};});
    assert.ok(geometry.left>=0&&geometry.right<=width&&!geometry.overflow,`${width}px attack dialog fits`);
  }
  await close();await page.waitForFunction(()=>!document.querySelector('.vfx-layer'));
  await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  // Reload restores scroll position; center the target above the persistent mobile nav.
  await page.$eval(`[data-action="attack-roll"][data-id="${axe.id}"]`,node=>node.scrollIntoView({block:'center'}));
  await page.click(`[data-action="attack-roll"][data-id="${axe.id}"]`);await click('roll');
  assert.ok(await page.$('.combat-result'),'guided attacks work offline');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  if(/firefox/i.test(executablePath))calmBrowser=await puppeteer.launch({executablePath,browser:'firefox',headless:true,extraPrefsFirefox:{'ui.prefersReducedMotion':1}});
  const calmPage=await (calmBrowser||browser).newPage();calmPage.on('pageerror',error=>errors.push(error.message));
  if(!calmBrowser)await calmPage.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await calmPage.goto(base,{waitUntil:'networkidle0'});await calmPage.evaluate(saved=>localStorage.setItem('questlog.v2',JSON.stringify(saved)),saved);await calmPage.reload({waitUntil:'networkidle0'});
  assert.equal(await calmPage.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  await calmPage.click(`[data-action="attack-roll"][data-id="${axe.id}"]`);await calmPage.click(action('roll'));
  assert.ok(await calmPage.$('.vfx-calm'));assert.equal(await calmPage.$('.vfx-weapon'),null,'reduced motion creates no moving weapon');
  assert.deepEqual(errors,[]);
  console.log('Attack browser checks passed: all masteries, criticals, extra damage, resources, Inspiration, cover, range, editing, backup, mobile, reduced motion, and offline.');
}finally{await calmBrowser?.close();await browser?.close();server?.kill();}
