import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {STORAGE_KEY,parseBackup} from '../model.js';
import {initialState} from '../default-characters.js';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';

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
    assert.equal(await page.$$eval('.landing-option',ns=>ns.length),3);
    assert.ok(await page.$eval('#sidebar',n=>n.hidden));
    assert.ok(await page.$eval('#mobile-nav',n=>n.hidden));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Landing fits ${width}px`);
    await page.screenshot({path:resolve(root,`.tmp/landing-${width}.png`)});
    await page.click('[data-action="choose-default"]');
    assert.equal(await page.$$eval('#modal [data-action="load-default"]',ns=>ns.length),3);
    assert.ok(await fits(),`Default chooser fits ${width}px`);
    await close();
  }
  await page.click('[data-action="new-character"]');await page.keyboard.press('Escape');
  assert.deepEqual(await saved(),initialState(),'Canceling onboarding leaves an empty journal');
  await page.evaluate(()=>{location.hash='spells';});
  await page.waitForSelector('.landing');
  await page.reload({waitUntil:'networkidle0'});
  assert.ok(await page.$('.landing'),'A character-specific deep link still shows onboarding when empty');
  await page.focus('[data-action="choose-default"]');await page.keyboard.press('Enter');
  await page.click('[data-action="load-default"][data-index="1"]');
  assert.deepEqual((await saved()).characters.map(c=>c.name),['Balin'],'Choose only the requested default');
  assert.equal(await page.$eval('.hero h2',n=>n.textContent),'Balin');
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$('.landing'),null,'Existing saves resume the character sheet');
  console.log('PASS fresh landing, responsive choices, cancellation, deep links, keyboard default selection and reload');

  await page.evaluate((key,s)=>localStorage.setItem(key,JSON.stringify(s)),STORAGE_KEY,initialState());
  await page.reload({waitUntil:'networkidle0'});
  await page.click('[data-action="new-character"]');
  await page.type('#modal [name="name"]','A new adventurer');
  await page.select('#modal [name="class"]','Wizard');
  await page.click('#modal button[type="submit"]');
  assert.equal((await saved()).characters.length,1);
  assert.equal((await saved()).characters[0].class,'Wizard');
  assert.equal((await saved()).characters[0].name,'A new adventurer');
  parseBackup(JSON.stringify(await saved()));
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('.hero h2',n=>n.textContent),'A new adventurer');
  console.log('PASS creating the first character with class choices saves and survives reload');

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
  await page.click('[data-action="choose-default"]');await page.click('[data-action="load-default"]');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),'unreadable save','Onboarding never overwrites unreadable saves');
  assert.deepEqual(errors,[]);
  console.log('PASS unreadable saves remain protected through onboarding; no browser errors');
}finally{await browser?.close();server?.kill();}
