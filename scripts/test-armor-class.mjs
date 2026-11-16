import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {makeCharacter,SAVE_VERSION,parseBackup} from '../model.js';
import {findEquipment,itemFromEquipment} from '../catalog.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.AC_TEST_PORT||'4201';
const base=process.env.AC_TEST_URL||`http://127.0.0.1:${port}/${process.env.AC_TEST_PATH||''}`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
let server,browser;
try {
  if(!process.env.AC_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('AC test server did not start')),10000);
      server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));
    });
  }
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1280,height:1000});await page.goto(base,{waitUntil:'networkidle0'});
  const c=makeCharacter({name:'Dynamic AC test',class:'Fighter',ac:99});
  c.items=[['chain-mail','armor',true],['shield','shield',true],['longsword','sword',true],['dagger','dagger',false],['longbow','bow',false],['magic-cloak-of-protection','cloak',false]]
    .map(([catalogId,id,equipped])=>({...itemFromEquipment(findEquipment(catalogId)),id,equipped}));
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),{version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});
  await page.reload({waitUntil:'networkidle0'});
  const saved=async()=>parseBackup(await page.evaluate(()=>localStorage.getItem('questlog.v2'))).characters[0];
  const route=async name=>{await page.goto(base+'#'+name);await page.waitForSelector(name==='sheet'?'[data-sheet-entry="ac"] strong':'.inventory-list');};
  const ac=async total=>{
    await route('sheet');
    assert.equal(await page.$eval('[data-sheet-entry="ac"] strong',node=>Number(node.textContent)),total);
    assert.ok(await page.$(`.sheet-status-stat[aria-label="Armor class ${total}"]`));
  };
  const clearToasts=async()=>page.evaluate(()=>document.querySelector('#toasts').replaceChildren());
  const unequipped=async names=>assert.deepEqual(await page.$$eval('#toasts .toast span',nodes=>nodes.map(node=>node.textContent).filter(text=>text.endsWith(' unequipped.'))),names.map(name=>`${name} unequipped.`));
  const equip=async(id,displaced=[])=>{await route('inventory');await clearToasts();await page.click(`[data-action="equip"][data-id="${id}"]`);await unequipped(displaced);};
  const fill=async values=>page.evaluate(values=>{
    for(const [name,value] of Object.entries(values)) {
      const input=document.querySelector(`#modal [name="${name}"]`);assertInput(input,name);
      if(input.type==='checkbox')input.checked=value;else input.value=value;
    }
    function assertInput(input,name){if(!input)throw Error(`Missing input: ${name}`);}
  },values);
  const submit=async()=>{await page.click('#modal button[type="submit"]');await page.waitForSelector('#modal:not([open])');};
  const edit=async(id,values,displaced=[])=>{
    await route('inventory');
    const selector=`[data-action="item"][data-id="${id}"]`;
    await page.$eval(selector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    await page.click(selector);
    await page.waitForSelector('#modal[open] [name="equipped"]');
    await fill(values);await clearToasts();await submit();await unequipped(displaced);
  };
  const combat=async values=>{await route('sheet');await page.click('[data-action="combat-edit"]');await fill(values);await submit();};

  console.log('RUN dynamic AC: shield, dual wielding, two hands, unequipping');
  await ac(18);await equip('dagger',['Shield']);await ac(16);assert.equal((await saved()).items.find(i=>i.id==='shield').equipped,false);
  await equip('dagger');await equip('shield');await ac(18);
  await equip('bow',['Shield','Longsword']);await ac(16);assert.equal((await saved()).items.find(i=>i.id==='sword').equipped,false);
  await equip('shield',['Longbow']);await ac(18);assert.equal((await saved()).items.find(i=>i.id==='bow').equipped,false);
  await equip('armor');await ac(14);await equip('armor');await ac(18);

  console.log('RUN linked weapon edits notify about displaced equipment');
  await equip('sword');await route('sheet');
  const swordAttack=(await saved()).attacks.find(attack=>attack.itemId==='sword');
  await page.click(`[data-action="attack"][data-id="${swordAttack.id}"]`);
  await fill({weaponId:'longbow'});await clearToasts();await submit();await unequipped(['Shield']);await ac(16);
  await page.click(`[data-action="attack"][data-id="${swordAttack.id}"]`);
  await fill({weaponId:'longsword'});await clearToasts();await submit();await unequipped([]);
  await equip('sword');await equip('shield');await ac(18);

  console.log('RUN magic base armor, attunement, ability changes, deletion and persistence');
  await route('inventory');await page.click('[data-action="item"]:not([data-id])');
  await page.select('[data-catalog-pick="item"]','magic-armor-1-2-or-3-1');
  await fill({armorId:'plate-armor',equipped:true});await clearToasts();await submit();await unequipped(['Chain Mail']);await ac(21);
  const magic=(await saved()).items.find(i=>i.catalogId==='magic-armor-1-2-or-3-1');
  assert.equal((await saved()).items.find(i=>i.id==='armor').equipped,false);
  await equip('cloak');await ac(21);await edit('cloak',{attuned:true});await ac(22);
  await page.reload({waitUntil:'networkidle0'});await ac(22);
  await page.click('[data-action="abilities"]');await fill({dex:18});await submit();await ac(22);
  await edit(magic.id,{armorId:'half-plate-armor'});await ac(21);
  await equip(magic.id);await ac(17);
  await route('inventory');await page.click('[data-action="item"][data-id="cloak"]');
  await page.click('#modal [data-action="delete-entry"]');await page.click('#modal [data-action="confirm-delete"]');await ac(16);

  console.log('RUN adjustments, override reset, stack dual wielding and quantity zero');
  await combat({acBonus:2});await ac(18);await combat({acOverride:25});await ac(25);
  await equip('shield');await ac(25);await combat({acOverride:''});await ac(16);
  await equip('shield');await ac(18);
  await edit('dagger',{qty:2,wielding:'Dual wield (2 from stack)',equipped:true},['Shield']);await ac(16);
  await equip('shield',['Dagger']);await ac(18);assert.equal((await saved()).items.find(i=>i.id==='dagger').equipped,false);
  await edit('shield',{qty:0});await ac(16);assert.equal((await saved()).items.some(i=>i.id==='shield'),false);
  assert.equal((await saved()).ac,99,'the previous recorded AC remains available as a reference');

  await page.setViewport({width:390,height:844});await ac(16);
  await edit('armor',{equipped:true});await ac(18);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>document.querySelector('#toasts').replaceChildren());
  await mkdir(resolve(root,'.tmp'),{recursive:true});await page.screenshot({path:resolve(root,'.tmp/dynamic-ac-mobile.png'),fullPage:true});
  await page.waitForFunction(()=>navigator.serviceWorker.controller,{timeout:30000});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-sheet-entry="ac"] strong');
  assert.equal(await page.$eval('[data-sheet-entry="ac"] strong',node=>Number(node.textContent)),18);
  assert.deepEqual(errors,[]);
  console.log('PASS dynamic AC, equipment transitions, magic items, edits, persistence, mobile and offline reload.');
}finally{await browser?.close();server?.kill();}
