import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {STORAGE_KEY,parseBackup} from '../model.js';
import {initialState} from '../default-characters.js';

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
  const fixture=initialState(),[first,second,last]=fixture.characters;
  first.name=second.name='Éowyn "Ember" <the Bold>';
  last.name='Long adventurer name '.repeat(6).slice(0,120).trim();
  parseBackup(JSON.stringify(fixture));
  await page.evaluate((key,s)=>localStorage.setItem(key,JSON.stringify(s)),STORAGE_KEY,fixture);
  await page.reload({waitUntil:'networkidle0'});
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
  const manage=()=>page.click('.character-switch');
  const remove=id=>page.click(`#modal [data-action="delete-character"][data-id="${id}"]`);
  const confirm=()=>page.click('#modal [data-confirm-delete-character]');
  const disabled=()=>page.$eval('[data-confirm-delete-character]',n=>n.disabled);
  const type=async value=>page.$eval('[name="characterName"]',(n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const close=()=>page.click('#modal [data-action="close"]');
  const fits=()=>page.$eval('#modal',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&n.scrollWidth<=n.clientWidth;});
  await mkdir(resolve(root,'.tmp'),{recursive:true});

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

  await manage();assert.ok(await page.$eval('#modal [data-action="delete-character"]',n=>n.disabled));
  assert.match(await page.$eval('#modal .form-help',n=>n.textContent),/Create another character/);await close();
  await page.click('[data-action="edit-character"]');
  assert.ok(await page.$eval('#modal [data-action="delete-character"]',n=>n.disabled));
  assert.match(await page.$eval('#modal .modal-body',n=>n.textContent),/Keep at least one character/);await close();
  await page.setViewport({width:1280,height:1000});
  await page.click('#sidebar [data-route="settings"]');await page.click('#main [data-action="characters"]');
  assert.ok(await page.$('#modal [data-action="delete-character"]'),'Settings Manage exposes deletion');
  assert.deepEqual(await saved(),expected);assert.deepEqual(errors,[]);
  console.log('PASS last-character restriction is visible in manager and editor, Settings access, no browser errors');
}finally{await browser?.close();server?.kill();}
