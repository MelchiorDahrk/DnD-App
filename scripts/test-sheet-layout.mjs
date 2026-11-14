import {visualChecks,waitForImages} from '../tests/helpers/browser-checks.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {checkSheetImprovements} from '../tests/helpers/sheet-improvements.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {parseBackup} from '../model.js';
import {SHEET_SECTIONS} from '../sheet-layout.js';
import {sheetItems} from '../sheet-actions.js';
import {equipmentIconURL} from '../equipment-icons.js';
import {EQUIPMENT,itemFromEquipment} from '../catalog.js';

const root=resolve(import.meta.dirname,'..');
const port=process.env.SHEET_TEST_PORT || '4187';
const base=process.env.SHEET_TEST_URL || `http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a browser.');
let server,browser;
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
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1440,height:1100});
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),defaultPartyState());
  await page.reload({waitUntil:'networkidle0'});
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

  // Every shipped item must render through the sheet, including entries beyond
  // the compact pack preview. Favorites expose them without changing inventories.
  const coverage=structuredClone(original);
  for(const c of coverage.characters)c.sheetLayout={collapsed:[],favorites:{pack:c.items.map(item=>item.id)}};
  for(const c of coverage.characters) {
    coverage.activeId=c.id;
    await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),coverage);
    await page.reload({waitUntil:'networkidle0'});
    assert.equal(await page.$('canvas'),null,'Sheet icons must not initialize WebGL');
    for(const item of c.items) {
      const selector=`${entrySelector('pack',item.id)} .equipment-icon img`;
      assert.ok(await page.$(selector),`${c.name}: sheet icon for ${item.name}`);
      await waitForImages(page,selector);
      if(visualChecks)assert.ok(await page.$eval(selector,img=>img.naturalWidth===160&&img.naturalHeight===160),`${c.name}: thumbnail size for ${item.name}`);
      assert.equal(await page.$eval(selector,img=>img.getAttribute('src')),equipmentIconURL(item));
    }
    for(const attack of c.attacks) {
      assert.ok(equipmentIconURL(attack),`${c.name}: explicit artwork for ${attack.name}`);
      const selector=`${entrySelector('attacks',attack.id)} .equipment-icon img`;
      assert.ok(await page.$(selector),`${c.name}: sheet weapon icon for ${attack.name}`);
      await page.$eval(selector,img=>{img.scrollIntoView({block:'center'});return img.decode();});
      await page.click(`${entrySelector('attacks',attack.id)} [data-action="attack-roll"]`);
      await page.$eval('#modal .combat-icon img',img=>img.decode());
      assert.equal(await page.$eval('#modal .combat-icon img',img=>img.getAttribute('src')),equipmentIconURL(attack));
      await page.click('#modal [data-combat-action="close"]');
    }
    await page.setViewport({width:390,height:844});
    if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${c.name}: mobile sheet icons fit`);
    await page.setViewport({width:1440,height:1100});
  }
  // Exercise the entire catalog in the actual inventory, including lazy images
  // below the fold, plus safe artwork for custom items and renamed attacks.
  const catalogState=structuredClone(original),catalogCharacter=catalogState.characters[0];
  catalogCharacter.items=EQUIPMENT.map(itemFromEquipment);
  catalogCharacter.items.push({...catalogCharacter.items[0],id:'custom-item',name:'Custom treasure',category:'Treasure'});
  catalogCharacter.attacks.push({...catalogCharacter.attacks[0],id:'renamed-weapon',name:'Moonblade',weaponId:'rapier'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),catalogState);
  await page.goto(new URL('#inventory',base).href,{waitUntil:'networkidle0'});
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$$eval('.inventory-list .equipment-icon img',imgs=>imgs.length),EQUIPMENT.length+1);
  for(const img of await page.$$('.inventory-list .equipment-icon img')) {
    await img.evaluate(async img=>{img.scrollIntoView({block:'center'});await img.decode();});
    assert.ok(await img.evaluate(img=>img.naturalWidth>0),'Equipment image loads');
  }
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'networkidle0'});
  for(const img of await page.$$('.inventory-list .equipment-icon img'))await img.evaluate(async img=>{img.scrollIntoView({block:'center'});await img.decode();});
  await page.setOfflineMode(false);
  await page.setViewport({width:390,height:844});
  if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Full catalog inventory fits mobile');
  await page.setViewport({width:1440,height:1100});
  await page.goto(new URL('#sheet',base).href,{waitUntil:'networkidle0'});
  const renamed=entrySelector('attacks','renamed-weapon');
  assert.match(await page.$eval(`${renamed} img`,img=>img.getAttribute('src')),/\/rapier.webp/);
  await page.click(`${renamed} [data-action="attack-roll"]`);
  assert.match(await page.$eval('#modal .combat-icon img',img=>img.getAttribute('src')),/\/rapier.webp/);
  await page.click('#modal [data-combat-action="close"]');
  await page.$eval(`${renamed} img`,img=>img.src='./assets/equipment/missing-test.webp');
  await page.waitForFunction(selector=>!document.querySelector(`${selector} img`),{},renamed);
  assert.equal(await page.$eval(`${renamed} .equipment-icon .icon`,svg=>getComputedStyle(svg).visibility),'visible','Image failure reveals SVG');
  console.log(`PASS all ${EQUIPMENT.length} catalog items, custom entries, renamed weapons and offline artwork`);
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),original);
  await page.reload({waitUntil:'networkidle0'});
  await page.$eval('[data-sheet-section="pack"]',node=>node.scrollIntoView());
  await waitForImages(page,'[data-sheet-section="pack"] .equipment-icon img');
  assert.ok(await page.$$eval('[data-sheet-section="pack"] .equipment-icon img',(imgs,count)=>imgs.length===count&&imgs.every(img=>img.complete&&img.naturalWidth>0),sheetItems(active(original)).length),'Sheet inventory preview and equipped items show LEGO icons');
  console.log('PASS all 63 default inventory entries and every default attack show loaded LEGO icons on desktop/mobile sheets and dialogs without WebGL');

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
  await mkdir(resolve(root,'.tmp'),{recursive:true});
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
  console.log('PASS all ten sections collapse by keyboard and retain only favorite entries');

  await page.click(`${entrySelector('abilities',selected.abilities)} [data-action="ability-roll"]`);
  await page.waitForSelector('#modal[open] .roll-modal');
  await page.click('#modal [data-action="close"]');
  await page.click(`${entrySelector('attacks',selected.attacks)} [data-action="attack-roll"]`);
  await page.click('#modal [data-combat-action="roll"]');
  await page.waitForSelector('#modal[open] .roll-modal');
  await page.click('#modal [data-action="close"]');
  const featureBefore=active(await state()).features.find(f=>f.id===selected.features);
  await page.click(`${entrySelector('features',selected.features)} [data-action="feature-roll"]`);
  await page.waitForSelector('#modal[open] .roll-modal');
  await page.click('#modal [data-action="close"]');
  assert.equal(active(await state()).features.find(f=>f.id===selected.features).used,featureBefore.used+1);
  await page.click(`${entrySelector('skills',selected.skills)} [data-action="skill-prof"]`);
  assert.deepEqual(await visibleKeys('skills'),[selected.skills]);
  console.log('PASS collapsed favorites still roll abilities and attacks, spend resources, and edit proficiency');

  const layout=active(await state()).sheetLayout;
  await page.reload({waitUntil:'networkidle0'});
  assert.deepEqual(active(await state()).sheetLayout,layout);
  for (const section of SHEET_SECTIONS) assert.deepEqual(await visibleKeys(section),[selected[section]]);
  const restored=parseBackup(JSON.stringify(await state()));
  assert.deepEqual(active(restored).sheetLayout,layout);
  await page.click('[data-action="characters"]');
  await page.click('[data-action="switch-character"]:not(.active)');
  assert.equal(await page.$$eval('.sheet-section-toggle[aria-expanded="true"]',nodes=>nodes.length),10);
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
  assert.equal((await visibleKeys('skills')).length,24);
  console.log('PASS mobile layouts at 390px and 320px, removing the last favorite, and expanding restores all rows');

  // A note remains a favorite when another note becomes the journal preview.
  const saved=await state(),c=active(saved);
  c.notes.unshift({...c.notes[0],id:'new-preview',title:'A different pinned note',pinned:true});
  const packFavorite=c.items.find(item=>item.id===selected.pack);
  c.items.unshift(...[1,2,3].map(i=>({...packFavorite,id:`new-consumable-${i}`})));
  await page.evaluate(saved=>localStorage.setItem('questlog.v2',JSON.stringify(saved)),saved);
  await page.reload({waitUntil:'networkidle0'});
  assert.deepEqual(await visibleKeys('journal'),[selected.journal]);
  assert.deepEqual(await visibleKeys('pack'),[selected.pack]);
  console.log('PASS favorite journal notes and items survive changes to the usual previews');

  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'networkidle0'});
  assert.deepEqual(await visibleKeys('pack'),[selected.pack]);
  await page.setOfflineMode(false);
  console.log('PASS the sheet and favorites reload offline from the updated service-worker cache');

  await page.click(`${entrySelector('attacks',selected.attacks)} [data-action="attack"]`);
  await page.click('#modal [data-action="delete-entry"]');
  await page.click('#modal [data-action="confirm-delete"]');
  assert.deepEqual(await visibleKeys('attacks'),[]);
  assert.ok(!active(await state()).sheetLayout.favorites.attacks.includes(selected.attacks));

  const empty=await state(),emptyCharacter=active(empty);
  for (const collection of ['items','notes','attacks','features']) emptyCharacter[collection]=[];
  emptyCharacter.slots.forEach(slot=>{slot.max=0;slot.used=0;});
  emptyCharacter.sheetLayout={collapsed:[...SHEET_SECTIONS],favorites:{}};
  await page.evaluate(saved=>localStorage.setItem('questlog.v2',JSON.stringify(saved)),empty);
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$$eval('.sheet-section-body:not([hidden])',nodes=>nodes.length),0);
  for (const section of SHEET_SECTIONS) {
    if(visualChecks)assert.ok(await page.$eval(sectionSelector(section),node=>node.getBoundingClientRect().height<100),'Sections without favorites should shrink to their headings');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS deleting favorites and collapsing empty sections with no browser errors');
  await checkSheetImprovements(page,{base,original,root});
  assert.deepEqual(errors,[]);
} finally {
  await browser?.close();
  server?.kill();
}
