import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {STORAGE_KEY,parseBackup} from '../model.js';
import {initialState} from '../default-characters.js';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {linkWeaponActions} from '../inventory.js';
import {chooseBuilderValue,fillLevelOne,nextBuilderStep} from '../tests/helpers/character-builder.mjs';

const root=resolve(import.meta.dirname,'..'),port=process.env.CHARACTER_TEST_PORT||'4194';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
let server,browser;
try{
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',d=>reject(new Error(String(d))));});
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1280,height:1000});
  await page.goto(`http://127.0.0.1:${port}${process.env.CHARACTER_TEST_PATH||'/'}`,{waitUntil:'networkidle0'});
  const fixture=defaultPartyState(),[first,second,last]=fixture.characters;
  first.name=second.name='Éowyn "Ember" <the Bold>';
  last.name='Long adventurer name '.repeat(6).slice(0,120).trim();
  fixture.characters.forEach(linkWeaponActions);
  parseBackup(JSON.stringify(fixture));
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
  const manage=()=>page.click('.character-switch');
  const remove=id=>page.click(`#modal [data-action="delete-character"][data-id="${id}"]`);
  const confirm=()=>page.click('#modal [data-confirm-delete-character]');
  const disabled=()=>page.$eval('[data-confirm-delete-character]',n=>n.disabled);
  const type=async value=>page.$eval('[name="characterName"]',(n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const close=()=>page.click('#modal [data-action="close"]');
  const fits=()=>page.$eval('#modal',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&n.scrollWidth<=n.clientWidth;});
  await mkdir(resolve(root,'.tmp'),{recursive:true});

  assert.deepEqual(await saved(),initialState());
  for(const width of [1280,390,320]){
    await page.setViewport({width,height:900});
    assert.equal(await page.$$eval('.landing-option',ns=>ns.length),2);
    assert.ok(await page.$eval('#sidebar',n=>n.hidden));
    assert.ok(await page.$eval('#mobile-nav',n=>n.hidden));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Landing fits ${width}px`);
    await page.screenshot({path:resolve(root,`.tmp/landing-${width}.png`)});
    assert.equal(await page.$('[data-action="choose-default"]'),null);
  }
  await page.click('[data-action="new-character"]');await page.keyboard.press('Escape');
  assert.deepEqual(await saved(),initialState(),'Canceling onboarding leaves an empty journal');
  await page.evaluate(()=>{location.hash='spells';});
  await page.waitForSelector('.landing');
  await page.reload({waitUntil:'networkidle0'});
  assert.ok(await page.$('.landing'),'A character-specific deep link still shows onboarding when empty');
  console.log('PASS fresh landing, responsive choices, cancellation, deep links and no default party');

  await page.evaluate((key,s)=>localStorage.setItem(key,JSON.stringify(s)),STORAGE_KEY,initialState());
  await page.reload({waitUntil:'networkidle0'});
  await page.focus('[data-action="new-character"]');await page.keyboard.press('Enter');
  await nextBuilderStep(page);
  assert.match(await page.$eval('#modal .character-builder [role="alert"]',n=>n.textContent),/Enter a character name/);
  assert.deepEqual(await saved(),initialState(),'Failed builder validation writes nothing');
  await fillLevelOne(page,{background:'Sage',onStep:async step=>{
    if(step===3){
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await chooseBuilderValue(page,'method','roll');
      await page.click('[data-builder-roll]');
      assert.equal(await page.$$eval('.builder-rolls li',items=>items.length),6);
      assert.equal(await page.$$eval('.builder-rolls s',items=>items.length),6);
      await chooseBuilderValue(page,'method','array');
      assert.equal(await page.$eval('[name="assignments.str"]',n=>n.value),'0');
    }
    if(step===4){
      await page.click('[data-builder-back]');
      assert.equal(await page.$eval('[name="assignments.str"]',n=>n.value),'0');
      assert.equal(await page.$eval('[name="bonuses.con"]',n=>n.value),'2');
      await nextBuilderStep(page);
      assert.equal(await page.$eval('[name="choice-classSkills"]',n=>!!n.value),true);
    }
    if(step===8) {
      for(const [theme,width] of [['light',390],['dark',320]]){
        await page.evaluate(theme=>window.QuestlogTheme.set(theme),theme);
        await page.setViewport({width,height:900});
        assert.ok(await fits(),`Builder review fits ${theme} at ${width}px`);
        await page.screenshot({path:resolve(root,`.tmp/builder-${theme}-${width}.png`)});
      }
      assert.deepEqual(await saved(),initialState(),'Review is still a draft');
    }
  }});
  await nextBuilderStep(page);
  await page.waitForSelector('#modal:not([open])');
  assert.equal((await saved()).characters.length,1);
  assert.equal((await saved()).characters[0].class,'Wizard');
  assert.equal((await saved()).characters[0].name,'A new adventurer');
  assert.equal((await saved()).characters[0].spells.filter(s=>s.level===1&&s.classPrepared!==undefined).length,6);
  parseBackup(JSON.stringify(await saved()));
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('.hero h2',n=>n.textContent),'A new adventurer');
  const grantedSpell=(await saved()).characters[0].spells.find(s=>s.castingGrants?.some(grant=>grant.mode==='free'));
  const featureId=grantedSpell.castingGrants[0].featureId;
  await page.evaluate(()=>{location.hash='spells';});
  await page.locator(`[data-action="cast"][data-id="${grantedSpell.id}"]`).click();
  const free=await page.$eval('#modal [name="slot"]',field=>[...field.options].find(o=>o.value.startsWith('Free ·')).value);
  await page.select('#modal [name="slot"]',free);
  assert.match(await page.$eval('[data-spell-casting-ability]',n=>n.textContent),/DC \d+/);
  await page.click('#modal button[type="submit"]');
  const afterCasting=(await saved()).characters[0];
  assert.equal(afterCasting.features.find(f=>f.id===featureId).used,1);
  assert.ok(afterCasting.slots.every(s=>s.used===0));
  console.log('PASS creating the first character with class choices saves and survives reload');

  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'networkidle0'});
  const beforeOffline=await saved();
  await manage();await page.click('#modal [data-action="new-character"]');
  await fillLevelOne(page,{name:'Offline Vanguard',className:'Fighter',species:'Human',level:3});
  await nextBuilderStep(page);
  await page.waitForSelector('.level-up-preview');
  await page.click('#modal button[type="submit"]');
  await page.waitForSelector('[data-builder-step="8"]');
  await nextBuilderStep(page);
  await page.select('[name="levelSubclass"]','Champion');
  await page.click('#modal button[type="submit"]');
  await page.waitForSelector('[data-builder-step="8"]');
  assert.deepEqual(await saved(),beforeOffline,'Intervening levels remain in the draft');
  await nextBuilderStep(page);
  await page.waitForSelector('#modal:not([open])');
  const offline=(await saved()).characters.find(c=>c.name==='Offline Vanguard');
  assert.equal(offline.level,3);
  assert.ok(offline.features.some(f=>f.name==='Action Surge'));
  assert.ok(offline.features.some(f=>f.name==='Improved Critical'));
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('.hero h2',n=>n.textContent),'Offline Vanguard');
  await page.setOfflineMode(false);
  console.log('PASS offline draft progression and creation survive a reload');

  await page.evaluate((key,s)=>localStorage.setItem(key,JSON.stringify(s)),STORAGE_KEY,initialState());
  await page.reload({waitUntil:'networkidle0'});
  const emptyPath=resolve(root,'.tmp/empty-characters.json'),invalidPath=resolve(root,'.tmp/invalid-characters.json'),backupPath=resolve(root,'.tmp/landing-import.json');
  await writeFile(emptyPath,JSON.stringify(initialState()));await writeFile(invalidPath,'{invalid');await writeFile(backupPath,JSON.stringify(fixture));
  for(const path of [emptyPath,invalidPath]){
    await (await page.$('#import-file')).uploadFile(path);
    await page.waitForFunction(()=>document.querySelector('.toast.error'));
    assert.deepEqual(await saved(),initialState(),'Empty or invalid imports preserve the journal');
    assert.ok(await page.$('.landing'));
    await page.evaluate(()=>document.querySelectorAll('.toast').forEach(n=>n.remove()));
  }
  let chooser=page.waitForFileChooser();await page.click('[data-action="import"]');await (await chooser).accept([backupPath]);
  await page.waitForSelector('#modal[open] [data-action="confirm-import"]',{visible:true});await close();
  assert.deepEqual(await saved(),initialState(),'Canceling import preserves the empty journal');
  chooser=page.waitForFileChooser();await page.click('[data-action="import"]');await (await chooser).accept([backupPath]);
  await page.waitForSelector('#modal[open] [data-action="confirm-import"]',{visible:true});await page.click('[data-action="confirm-import"]');
  assert.deepEqual(await saved(),fixture,'Importing from the landing page saves the exact characters');
  assert.equal(await page.$eval('.hero h2',n=>n.textContent),first.name);
  await page.reload({waitUntil:'networkidle0'});
  assert.deepEqual(await saved(),fixture);
  console.log('PASS landing import, validation, cancellation and persistence');

  for(const width of [1280,390,320]){
    await page.setViewport({width,height:900});await manage();
    assert.equal(await page.$$eval('#modal [data-action="delete-character"]',ns=>ns.length),3);
    assert.equal(await page.$('#modal button button'),null,'Roster actions are separate buttons');
    assert.ok(await fits(),`Character manager fits ${width}px`);
    await page.screenshot({path:resolve(root,`.tmp/characters-${width}.png`)});
    await remove(second.id);
    assert.ok(await fits(),`Delete confirmation fits ${width}px`);
    assert.equal(await page.$eval('.character-delete-warning strong',n=>n.textContent),second.name);
    await page.screenshot({path:resolve(root,`.tmp/delete-character-${width}.png`)});
    await close();
  }
  console.log('PASS visible roster delete actions and confirmation layouts at desktop, 390px and 320px');

  await manage();await remove(second.id);
  assert.ok(await disabled(),'Deletion starts disabled');
  assert.equal(await page.$eval('[name="characterName"]',n=>document.activeElement===n),true);
  for(const value of [second.name.toLowerCase(),second.name+' ',second.name.slice(0,-1)]){
    await type(value);assert.ok(await disabled(),'Only the exact name enables deletion');
  }
  await page.$eval('#modal-form',n=>n.requestSubmit());
  assert.match(await page.$eval('#form-error',n=>n.textContent),/name exactly/);
  assert.deepEqual(await saved(),fixture,'Submitting a mismatch preserves every character');
  await type(second.name);assert.equal(await disabled(),false);
  await type('');assert.ok(await disabled(),'Clearing a matching name disables deletion again');
  await type(second.name);await page.click('#modal .modal-actions [data-action="close"]');
  assert.deepEqual(await saved(),fixture,'Keep character cancels deletion');
  await manage();await remove(second.id);await type(second.name);await page.keyboard.press('Escape');
  assert.deepEqual(await saved(),fixture,'Escape cancels deletion');
  console.log('PASS exact-name validation, submit validation, Keep character and Escape preserve all saved data');

  await manage();await remove(second.id);await type(second.name);await confirm();
  const expected={...fixture,characters:[first,last]};
  assert.deepEqual(await saved(),expected,'Deleting an inactive duplicate name preserves the active character and all other data');
  await page.reload({waitUntil:'networkidle0'});assert.deepEqual(await saved(),expected);
  parseBackup(JSON.stringify(await saved()));
  await page.click('[data-action="edit-character"]');
  assert.match(await page.$eval('#modal [data-action="delete-character"]',n=>n.textContent),/Delete character/);
  await page.$eval('#modal [name="name"]',n=>{n.value='Unsaved name';});
  await page.click('#modal [data-action="delete-character"]');
  assert.equal(await page.$eval('.character-delete-warning strong',n=>n.textContent),first.name,'Confirmation uses the saved name');
  await type(first.name);await page.keyboard.press('Enter');
  expected.characters=[last];expected.activeId=last.id;
  assert.deepEqual(await saved(),expected,'Deleting the active character selects the remaining character');
  await page.reload({waitUntil:'networkidle0'});assert.deepEqual(await saved(),expected);
  parseBackup(JSON.stringify(await saved()));
  console.log('PASS inactive and active deletion target the intended ID, preserve other data and survive reload');

  await manage();assert.equal(await page.$eval('#modal [data-action="delete-character"]',n=>n.disabled),false);await close();
  await page.click('[data-action="edit-character"]');
  assert.equal(await page.$eval('#modal [data-action="delete-character"]',n=>n.disabled),false);await close();
  await page.setViewport({width:1280,height:1000});
  await page.click('#sidebar [data-route="settings"]');await page.click('#main [data-action="characters"]');
  assert.ok(await page.$('#modal [data-action="delete-character"]'),'Settings Manage exposes deletion');
  await remove(last.id);await type(last.name);await confirm();
  expected.characters=[];expected.activeId=null;
  assert.deepEqual(await saved(),expected,'Deleting the final character persists an empty journal');
  assert.ok(await page.$('.settings-grid'),'Settings remain accessible without a character');
  await page.click('.cloud-actions [data-route="sheet"]');
  assert.ok(await page.$('.landing'));
  await page.reload({waitUntil:'networkidle0'});assert.deepEqual(await saved(),expected);
  parseBackup(JSON.stringify(await saved()));
  assert.ok(await page.$('.landing'),'The empty journal remains empty after reload');
  console.log('PASS last-character deletion from Settings returns to onboarding and survives reload');

  const other=await browser.newPage();await other.goto(page.url(),{waitUntil:'networkidle0'});
  await other.evaluate((key,s)=>localStorage.setItem(key,JSON.stringify(s)),STORAGE_KEY,fixture);
  await page.waitForSelector('.character-switch');
  assert.equal(await page.$('.landing'),null);
  assert.match(await page.$eval('.character-switch',n=>n.textContent),/Éowyn/);
  await other.evaluate((key,s)=>localStorage.setItem(key,JSON.stringify(s)),STORAGE_KEY,expected);
  await page.waitForSelector('.landing');await other.close();
  console.log('PASS cross-tab updates transition between empty journals and character sheets');

  await page.evaluate(key=>localStorage.setItem(key,'unreadable save'),STORAGE_KEY);
  await page.reload({waitUntil:'networkidle0'});
  assert.match(await page.$eval('.storage-warning',n=>n.textContent),/Saving is paused/);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),'unreadable save');
  await page.click('[data-action="new-character"]');
  await fillLevelOne(page,{name:'Temporary adventurer',className:'Fighter'});
  await nextBuilderStep(page);
  assert.match(await page.$eval('#form-error',n=>n.textContent),/Saving is paused/);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),'unreadable save','Onboarding never overwrites unreadable saves');
  assert.deepEqual(errors,[]);
  console.log('PASS unreadable saves remain protected through onboarding; no browser errors');
}finally{await browser?.close();server?.kill();}
