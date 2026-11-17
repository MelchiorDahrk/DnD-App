import {visualChecks,waitForImages,waitForRollResult} from '../tests/helpers/browser-checks.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {catalogSheetState} from '../tests/helpers/sheet-fixtures.mjs';
import {checkCharacterBackground,checkSheetImprovements,checkSheetNavigation,checkSheetPopups} from '../tests/helpers/sheet-improvements.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {parseBackup,SKILLS} from '../model.js';
import {SHEET_SECTIONS} from '../sheet-layout.js';
import {equipmentIconURL} from '../equipment-icons.js';
import {EQUIPMENT} from '../catalog.js';

const root=resolve(import.meta.dirname,'..');
const port=process.env.SHEET_TEST_PORT || '4187';
const base=process.env.SHEET_TEST_URL || `http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a browser.');
let server,browser,page,phase='starting browser';
const errors=[],consoleMessages=[];
try {
  if (!process.env.SHEET_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Test server did not start.')),10000);
      server.once('error',error=>{clearTimeout(timer);reject(error);});
      server.once('exit',code=>{clearTimeout(timer);reject(new Error(`Test server exited (${code}).`));});
      server.stderr.on('data',data=>{clearTimeout(timer);reject(new Error(String(data)));});
      server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
    });
  }
  const firefox=/firefox/i.test(executablePath);
  browser=await puppeteer.launch({executablePath,browser:firefox?'firefox':'chrome',headless:true,args:['--no-sandbox',...(firefox?[]:['--enable-unsafe-swiftshader','--use-angle=swiftshader'])]});
  page=await browser.newPage();
  if(process.env.SHEET_TEST_CPU_RATE)await page.emulateCPUThrottling(Number(process.env.SHEET_TEST_CPU_RATE));
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{consoleMessages.push(`${message.type()}: ${message.text()}`);if(consoleMessages.length>50)consoleMessages.shift();});
  await page.setViewport({width:1440,height:1100});
  await page.goto(base,{waitUntil:'load'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),defaultPartyState());
  await page.reload({waitUntil:'load'});
  await page.waitForSelector('[data-sheet-section]');
  assert.equal(await page.$$eval('[data-sheet-section]',nodes=>nodes.length),SHEET_SECTIONS.length);
  assert.equal(await page.$$eval('[data-sheet-entry] button button',nodes=>nodes.length),0);
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const active=s=>s.characters.find(c=>c.id===s.activeId);
  const sectionSelector=section=>`[data-sheet-section="${section}"]`;
  const entrySelector=(section,key)=>`${sectionSelector(section)} [data-sheet-entry=${JSON.stringify(key)}]`;
  const visibleKeys=section=>page.$$eval(`${sectionSelector(section)} [data-sheet-entry]`,nodes=>nodes.filter(node=>node.getBoundingClientRect().height>0).map(node=>node.dataset.sheetEntry));
  const selected={};
  const original=await state();
  assert.equal(await page.$('[data-sheet-section="essentials"], #skills-tab-saves'),null);
  assert.equal(await page.$$eval('.ability-entry [data-action="save-roll"]',nodes=>nodes.length),6);
  assert.ok(await page.$('.xp-strip .passive-summary'),'Passive Perception is beside XP');
  assert.equal(await page.$('[data-sheet-entry="hit-dice"]'),null);
  assert.notEqual(await page.$eval('.inspiration .icon',n=>n.innerHTML),await page.$eval('.sheet-favorite .icon',n=>n.innerHTML),'Inspiration has a unique icon');
  await page.click('[data-action="dismiss-sheet-help"]');
  assert.equal(await page.$('.sheet-layout-help'),null);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$('.sheet-layout-help'),null,'Favorites tip stays dismissed after reload');
  const passiveBefore=Number(await page.$eval('.passive-summary strong',n=>n.textContent));
  await page.click('[data-action="passives"]');
  await page.$eval('#modal [name="passivePerceptionBonus"]',n=>n.value=String(Number(n.value)+1));
  await page.click('#modal button[type="submit"]');
  assert.equal(await page.$eval('.passive-summary strong',n=>Number(n.textContent)),passiveBefore+1);
  await page.evaluate(()=>location.hash='settings');
  await page.waitForSelector('.settings-grid');
  const settingsCopy=await page.$eval('.settings-grid',n=>n.textContent);
  assert.doesNotMatch(settingsCopy,/The default party|Made for the table|Offline, and ready for the road/);
  assert.equal(await page.$('[data-action="default-party"]'),null);
  await page.evaluate(()=>location.hash='sheet');
  await page.waitForSelector('.ability-entry');

  phase='default party sheet and attack artwork';
  console.log(`RUN ${phase}`);

  // Existing saved pack favorites must not restore inventory on the sheet.
  const coverage=structuredClone(original);
  for(const c of coverage.characters)c.sheetLayout={collapsed:[],favorites:{pack:c.items.map(item=>item.id)}};
  for(const c of coverage.characters) {
    coverage.activeId=c.id;
    await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),coverage);
    await page.reload({waitUntil:'load'});
    assert.equal(await page.$('canvas'),null,'Sheet icons must not initialize WebGL');
    assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null,`${c.name}: removed previews stay absent`);
    for(const attack of c.attacks) {
      assert.ok(equipmentIconURL(attack),`${c.name}: explicit artwork for ${attack.name}`);
      const selector=`${entrySelector('attacks',attack.id)} .equipment-icon img`;
      assert.ok(await page.$(selector),`${c.name}: sheet weapon icon for ${attack.name}`);
      await waitForImages(page,selector);
      await page.$eval(`${entrySelector('attacks',attack.id)} [data-action="attack-roll"]`,node=>node.scrollIntoView({block:'center',behavior:'instant'}));
      await page.click(`${entrySelector('attacks',attack.id)} [data-action="attack-roll"]`);
      await waitForImages(page,'#modal .combat-icon img');
      assert.equal(await page.$eval('#modal .combat-icon img',img=>img.getAttribute('src')),equipmentIconURL(attack));
      await page.click('#modal [data-combat-action="close"]');
    }
    await page.setViewport({width:390,height:844});
    if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${c.name}: mobile sheet icons fit`);
    await page.setViewport({width:1440,height:1100});
  }
  // Exercise the entire catalog in the actual inventory, including lazy images
  // below the fold, plus safe artwork for custom items and renamed attacks.
  phase='full catalog inventory and offline artwork';
  console.log(`RUN ${phase}`);
  const catalogState=catalogSheetState(original);
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),catalogState);
  await page.goto(new URL('#inventory',base).href,{waitUntil:'load'});
  await page.reload({waitUntil:'load'});
  const catalogImages='.inventory-list .equipment-icon img';
  assert.equal(await page.$$eval(catalogImages,imgs=>imgs.length),EQUIPMENT.length+1,'Every catalog item renders after loading a valid save');
  await waitForImages(page,catalogImages);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$$eval(catalogImages,imgs=>imgs.length),EQUIPMENT.length+1,'Every catalog item also renders offline');
  await waitForImages(page,catalogImages);
  await page.setOfflineMode(false);
  await page.setViewport({width:390,height:844});
  if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Full catalog inventory fits mobile');
  await page.setViewport({width:1440,height:1100});
  await page.goto(new URL('#sheet',base).href,{waitUntil:'load'});
  const renamed=entrySelector('attacks','renamed-weapon');
  assert.match(await page.$eval(`${renamed} img`,img=>img.getAttribute('src')),/\/rapier.webp/);
  await page.click(`${renamed} [data-action="attack-roll"]`);
  assert.match(await page.$eval('#modal .combat-icon img',img=>img.getAttribute('src')),/\/rapier.webp/);
  await page.click('#modal [data-combat-action="close"]');
  await page.$eval(`${renamed} img`,img=>img.src='./assets/equipment/missing-test.webp');
  await page.waitForFunction(selector=>!document.querySelector(`${selector} img`),{},renamed);
  assert.equal(await page.$eval(`${renamed} .equipment-icon .icon`,svg=>getComputedStyle(svg).visibility),'visible','Image failure reveals SVG');
  console.log(`PASS all ${EQUIPMENT.length} catalog items, custom entries, renamed weapons and offline artwork`);
  phase='section favorites, interactions and persistence';
  console.log(`RUN ${phase}`);
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),original);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null);
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  phase='character background notes';
  console.log(`RUN ${phase}`);
  await checkCharacterBackground(page,{original,root});
  console.log('PASS removed previews stay absent and default attacks show loaded LEGO icons on desktop/mobile sheets and dialogs without WebGL');

  for (const width of [390,320]) {
    await page.setViewport({width,height:844});
    if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px expanded sheet must not overflow horizontally`);
    if(visualChecks) {
      const labelOverlaps=await page.$$eval('.ability-entry',entries=>entries.flatMap(entry=>{
        const range=document.createRange();
        range.selectNodeContents(entry.querySelector('.ability-label'));
        const label=range.getBoundingClientRect(),star=entry.querySelector('.sheet-favorite').getBoundingClientRect();
        return label.right<=star.left || label.bottom<=star.top || label.top>=star.bottom?[]:[{name:entry.dataset.sheetLabel,label:label.toJSON(),star:star.toJSON()}];
      }));
      assert.deepEqual(labelOverlaps,[],`${width}px ability names must not overlap favorite buttons`);
    }
  }
  await page.$eval('.ability-section',node=>node.scrollIntoView());
  await page.screenshot({path:resolve(root,'.tmp/sheet-expanded-320.png')});
  await page.setViewport({width:1440,height:1100});

  for (const section of SHEET_SECTIONS) {
    const selector=sectionSelector(section);
    const key=await page.$eval(selector,node=>(node.querySelector('[data-action="feature-roll"]')?.closest('[data-sheet-entry]') || node.querySelector('[data-sheet-entry]')).dataset.sheetEntry);
    selected[section]=key;
    await page.click(`${entrySelector(section,key)} .sheet-favorite`);
    await page.focus(`${selector} .sheet-section-toggle`);
    await page.keyboard.press('Enter');
    assert.deepEqual(await visibleKeys(section),[key],`${section}: only the favorite stays visible`);
    assert.equal(await page.$eval(`${selector} .sheet-section-toggle`,node=>node.getAttribute('aria-expanded')),'false');
    assert.equal(await page.$eval(`${entrySelector(section,key)} .sheet-favorite`,node=>node.getAttribute('aria-pressed')),'true');
  }
  console.log(`PASS all ${SHEET_SECTIONS.length} sections collapse by keyboard and retain only favorite entries`);

  phase='collapsed favorite ability roll';
  await page.locator(`${entrySelector('abilities',selected.abilities)} [data-action="ability-roll"]`).click();
  await waitForRollResult(page);
  await page.locator('#modal [data-action="close"]').click();
  // Fix only the sampled dice, keeping the real click handler, rules and tray.
  // Exercise every attack result branch rather than letting a random 20 make CI fail.
  await page.evaluate(()=>{
    window.sheetTestRandom=crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues=array=>{
      if(window.sheetTestDice?.length){array[0]=window.sheetTestDice.shift()-1;return array;}
      return window.sheetTestRandom(array);
    };
  });
  try {
    for(const natural of [1,12,20]) {
      phase=`collapsed favorite attack: natural ${natural}`;console.log(`RUN ${phase}`);
      await page.locator(`${entrySelector('attacks',selected.attacks)} [data-action="attack-roll"]`).click();
      await page.evaluate(value=>window.sheetTestDice=[value],natural);
      await page.locator('#modal [data-combat-action="roll"]').click();
      assert.deepEqual(await waitForRollResult(page),[natural],phase);
      assert.equal(await page.$('#modal [data-combat-action="roll"]'),null,'The attack left setup and produced a result.');
      if(natural===20)assert.ok(await page.$('#modal [data-combat-action="damage"]'),'A natural 20 offers critical damage.');
      else if(natural===1)assert.ok(await page.$('#modal .combat-miss'),'A natural 1 is a miss.');
      else assert.ok(await page.$('#modal [data-combat-action="hit"]'),'Other rolls allow hit confirmation.');
      await page.locator('#modal [data-combat-action="close"]').click();
    }
  } finally {
    await page.evaluate(()=>{crypto.getRandomValues=window.sheetTestRandom;delete window.sheetTestRandom;delete window.sheetTestDice;});
  }
  phase='collapsed favorite feature roll and resource use';
  const featureBefore=active(await state()).features.find(f=>f.id===selected.features);
  await page.locator(`${entrySelector('features',selected.features)} [data-action="feature-roll"]`).click();
  await waitForRollResult(page);
  await page.locator('#modal [data-action="close"]').click();
  assert.equal(active(await state()).features.find(f=>f.id===selected.features).used,featureBefore.used+1);
  await page.click(`${entrySelector('skills',selected.skills)} [data-action="skill-prof"]`);
  assert.deepEqual(await visibleKeys('skills'),[selected.skills]);
  console.log('PASS collapsed favorites still roll abilities and attacks, spend resources, and edit proficiency');

  phase='favorite persistence and character switching';
  const layout=active(await state()).sheetLayout;
  await page.reload({waitUntil:'load'});
  assert.deepEqual(active(await state()).sheetLayout,layout);
  for (const section of SHEET_SECTIONS) assert.deepEqual(await visibleKeys(section),[selected[section]]);
  const restored=parseBackup(JSON.stringify(await state()));
  assert.deepEqual(active(restored).sheetLayout,layout);
  await page.click('[data-action="characters"]');
  await page.click('[data-action="switch-character"]:not(.active)');
  assert.equal(await page.$$eval('.sheet-section-toggle[aria-expanded="true"]',nodes=>nodes.length),SHEET_SECTIONS.length);
  assert.equal(await page.$('.sheet-layout-help'),null,'Dismissal also applies to other characters');
  await page.click('[data-action="characters"]');
  await page.click(`[data-action="switch-character"][data-id="${original.activeId}"]`);
  assert.deepEqual(active(await state()).sheetLayout,layout);
  console.log('PASS reload, backup validation, and character switching preserve independent choices');

  if(visualChecks)assert.ok(await page.$eval(sectionSelector('skills'),node=>node.getBoundingClientRect().height<250),'Collapsed skills panel should fit its favorite rows');
  await page.evaluate(()=>document.querySelectorAll('.toast').forEach(node=>node.remove()));
  await page.evaluate(()=>scrollTo(0,0));
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.screenshot({path:resolve(root,'.tmp/sheet-favorites-desktop.png'),fullPage:true});
  for (const width of [390,320]) {
    await page.setViewport({width,height:844});
    if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px sheet must not overflow horizontally`);
    for (const section of SHEET_SECTIONS) assert.deepEqual(await visibleKeys(section),[selected[section]]);
    await page.screenshot({path:resolve(root,`.tmp/sheet-favorites-${width}.png`),fullPage:true});
  }
  await page.focus(`${entrySelector('skills',selected.skills)} .sheet-favorite`);
  await page.keyboard.press(' ');
  assert.deepEqual(await visibleKeys('skills'),[]);
  assert.equal(await page.$eval(':focus',node=>node.dataset.action),'sheet-collapse');
  await page.keyboard.press('Enter');
  assert.equal((await visibleKeys('skills')).length,Object.keys(SKILLS).length);
  console.log('PASS mobile layouts at 390px and 320px, removing the last favorite, and expanding restores all rows');

  // Changing inventory and notes does not restore the removed previews.
  const saved=await state(),c=active(saved);
  c.notes.unshift({...c.notes[0],id:'new-preview',title:'A different pinned note',pinned:true});
  c.items.unshift(...[1,2,3].map(i=>({...c.items[0],id:`new-consumable-${i}`})));
  await page.evaluate(saved=>localStorage.setItem('questlog.v2',JSON.stringify(saved)),saved);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null);
  console.log('PASS journal and inventory changes leave the sheet focused on character stats');

  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'load'});
  assert.deepEqual(await visibleKeys('abilities'),[selected.abilities]);
  assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null);
  await page.setOfflineMode(false);
  console.log('PASS the sheet and favorites reload offline from the updated service-worker cache');

  const editFavoriteAttack=`${entrySelector('attacks',selected.attacks)} [data-action="attack"]`;
  await page.$eval(editFavoriteAttack,node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await page.locator(editFavoriteAttack).click();
  await page.click('#modal [data-action="delete-entry"]');
  await page.click('#modal [data-action="confirm-delete"]');
  assert.deepEqual(await visibleKeys('attacks'),[]);
  assert.ok(!active(await state()).sheetLayout.favorites.attacks.includes(selected.attacks));

  const empty=await state(),emptyCharacter=active(empty);
  for (const collection of ['items','notes','attacks','features']) emptyCharacter[collection]=[];
  emptyCharacter.slots.forEach(slot=>{slot.max=0;slot.used=0;});
  emptyCharacter.sheetLayout={collapsed:[...SHEET_SECTIONS],favorites:{}};
  await page.evaluate(saved=>localStorage.setItem('questlog.v2',JSON.stringify(saved)),empty);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$$eval('.sheet-section-body:not([hidden])',nodes=>nodes.length),0);
  for (const section of SHEET_SECTIONS) {
    if(visualChecks)assert.ok(await page.$eval(sectionSelector(section),node=>node.getBoundingClientRect().height<100),'Sections without favorites should shrink to their headings');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS deleting favorites and collapsing empty sections with no browser errors');
  phase='sheet improvements, mobile interactions and offline persistence';
  console.log(`RUN ${phase}`);
  await checkSheetImprovements(page,{base,original,root});
  phase='sticky section navigation and compact status summary';
  console.log(`RUN ${phase}`);
  await checkSheetNavigation(page,{original,root});
  phase='modal scrolling and shared page footer';
  console.log(`RUN ${phase}`);
  await checkSheetPopups(page);
  assert.deepEqual(errors,[]);
} catch(error) {
  const directory=resolve(root,'.tmp/browser-diagnostics/sheet');
  try {
    await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,'failure.json'),JSON.stringify({phase,message:error.message,stack:error.stack,url:page?.url(),errors,consoleMessages},null,2));
    if(page) {
      await writeFile(resolve(directory,'failure.html'),await page.content());
      await page.screenshot({path:resolve(directory,'failure.png')});
    }
    console.error(`Sheet test diagnostics: ${directory}`);
  } catch(diagnosticError) {console.error('Could not capture sheet test diagnostics:',diagnosticError.message);}
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
