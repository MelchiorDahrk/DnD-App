import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {parseBackup,SKILLS,signed,skillBonus,saveBonus} from '../model.js';
import {waitForRollResult} from '../tests/helpers/browser-checks.mjs';
const root=resolve(import.meta.dirname,'..'),port=process.env.TRAINING_TEST_PORT||'4198';
const base=process.env.TRAINING_TEST_URL||`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a browser.');
let server,browser,page;
try {
  if(!process.env.TRAINING_TEST_URL){
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
    await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);done();});});
  }
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,extraPrefsFirefox:{'ui.prefersReducedMotion':1},args:['--no-sandbox']});
  page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!/firefox/i.test(executablePath))await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.setViewport({width:1440,height:1100});
  await page.goto(base,{waitUntil:'load'});
  const fixture=defaultPartyState(),c=fixture.characters.find(c=>c.id===fixture.activeId);
  c.sheetLayout={collapsed:[],favorites:{essentials:['perception']},skillsTab:'saves'};
  delete c.training;c.items=c.items.filter(i=>!/thieves|smith/i.test(i.name));
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await page.reload({waitUntil:'load'});
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const active=s=>s.characters.find(c=>c.id===s.activeId);
  const click=async selector=>{await page.$eval(selector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.click(selector);};
  const tab=async id=>{await click(`#skills-tab-${id}`);await page.waitForSelector(`#skills-panel-${id}:not([hidden])`);};
  assert.equal(await page.$$eval('.training-tabs [role="tab"]',nodes=>nodes.length),4);
  assert.equal(await page.$('[data-sheet-section="proficiencies"]'),null);
  assert.equal(await page.$('#skills-tab-saves'),null);
  assert.equal(await page.$eval('#skills-tab-skills',n=>n.getAttribute('aria-selected')),'true','Older Saves tab choices fall back to Skills');
  assert.equal(await page.$$eval('.ability-entry [data-action="save-roll"]',nodes=>nodes.length),6);
  const dexSave='.ability-entry [data-action="save-roll"][data-key="dex"]';
  const beforeSave=active(await state());
  assert.equal(await page.$eval(dexSave,n=>n.textContent),signed(saveBonus(beforeSave,'dex')));
  await click('.ability-entry [data-action="save-prof"][data-key="dex"]');
  assert.equal(await page.$eval(dexSave,n=>n.textContent),signed(saveBonus(active(await state()),'dex')));
  await click(dexSave);await waitForRollResult(page);
  assert.equal(await page.$eval('#modal .roll-expression',n=>n.textContent),`1d20${signed(saveBonus(active(await state()),'dex'))}`);
  await click('#modal [data-action="close"]');
  await click('.ability-entry [data-action="save-prof"][data-key="dex"]');
  let saved=active(await state());assert.ok(saved.training.tools.includes('thieves-tools'));assert.ok(saved.items.some(i=>/smith/i.test(i.name)));
  const first=saved.attacks.find(a=>a.name==='Longsword'),attackSelector=`[data-sheet-entry="${first.id}"] [data-action="attack-roll"]`;
  const hitBefore=await page.$eval(attackSelector,n=>n.textContent);
  await tab('proficiencies');await click('[data-training="weapons"][value="longsword"]');
  assert.notEqual(await page.$eval(attackSelector,n=>n.textContent),hitBefore,'Changes update an existing linked action');
  await click('[data-training="weapons"][value="longsword"]');assert.equal(await page.$eval(attackSelector,n=>n.textContent),hitBefore);
  const ac=await page.$eval('[data-ac-breakdown]',n=>n.textContent);
  await click('[data-training="armor"][value="Shield"]');
  assert.match(await page.$eval('[data-ac-breakdown]',n=>n.textContent),/shield training is required/);
  await click('[data-training="armor"][value="Shield"]');assert.equal(await page.$eval('[data-ac-breakdown]',n=>n.textContent),ac);
  await tab('languages');await click('[data-training="languages"][value="Undercommon"]');
  await page.reload({waitUntil:'load'});assert.equal(await page.$eval('[data-training="languages"][value="Undercommon"]',n=>n.checked),true);
  assert.equal(await page.$eval('#skills-tab-languages',n=>n.getAttribute('aria-selected')),'true');
  await page.focus('#skills-tab-languages');await page.keyboard.press('ArrowRight');assert.equal(await page.$eval(':focus',n=>n.id),'skills-tab-tools');
  saved=active(await state());const thieves=saved.items.find(i=>/thieves/i.test(i.name));
  await click(`#skills-panel-tools [data-action="use-item"][data-id="${thieves.id}"]`);
  assert.equal(await page.$('#modal [name="toolAbility"]'),null,'Tool abilities cannot be changed');
  assert.match(await page.$eval('#modal .tool-ability',n=>n.textContent),/Dexterity/);
  const options=await page.$$eval('#modal [name="toolSkill"] option',nodes=>nodes.map(n=>[n.value,n.textContent]));
  assert.deepEqual(options,[['None','None'],...Object.keys(SKILLS).map(name=>[name,`${name} (${signed(skillBonus(saved,name))})`])]);
  await page.select('#modal [name="toolSkill"]','Stealth');
  await click('#modal button[type="submit"]');await waitForRollResult(page);
  assert.match(await page.$eval('.roll-expression',n=>n.textContent),/1d20\+2/);
  await click('#modal [data-action="close"]');assert.equal(active(await state()).items.find(i=>i.id===thieves.id).qty,1);
  const count=active(await state()).items.length;
  await click('[data-training="tools"][value="alchemists-supplies"]');assert.equal(active(await state()).items.length,count,'Proficiency alone does not grant equipment');
  await click('[data-action="add-tool"][data-tool="alchemists-supplies"]');assert.equal(active(await state()).items.length,count+1);
  for(const width of [1440,390,320]){
    await page.setViewport({width,height:900});
    for(const id of ['skills','proficiencies','languages','tools']){
      await tab(id);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${id} fits`);
    }
    await tab('tools');await page.$eval('[data-sheet-section="skills"]',n=>n.scrollIntoView({block:'start'}));
    await page.screenshot({path:resolve(root,`.tmp/training-tools-${width}.png`)});
  }
  // Inventory uses the same tool and opens the same roll dialog without equipping it.
  await page.evaluate(()=>location.hash='inventory');await page.waitForSelector('.inventory-list');
  await click(`.inventory-list [data-action="use-item"][data-id="${thieves.id}"]`);
  assert.equal(await page.$('#modal [name="toolAbility"]'),null);assert.ok(await page.$('#modal .tool-ability'));await page.keyboard.press('Escape');
  await page.evaluate(()=>location.hash='sheet');await page.waitForSelector('.training-tabs');
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);await page.reload({waitUntil:'load'});
  assert.equal(await page.$eval('#skills-tab-tools',n=>n.getAttribute('aria-selected')),'true');
  assert.ok(active(await state()).training.languages.includes('Undercommon'));parseBackup(JSON.stringify(await state()));
  assert.deepEqual(errors,[]);
  console.log('PASS structured training migration, live attack and shield calculations, tools, rolls, ownership, tabs, keyboard, mobile, backups and offline reload');
} catch(error) {if(page){await page.screenshot({path:resolve(root,'.tmp/training-failure.png')});console.error(await page.evaluate(()=>({tab:document.querySelector('.training-tabs [aria-selected=true]')?.id,language:document.querySelector('[data-training=languages][value=Undercommon]')?.getBoundingClientRect().toJSON(),scrollY})));}throw error;} finally {await browser?.close();server?.kill();}
