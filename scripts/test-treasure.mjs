import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {makeCharacter,parseBackup,SAVE_VERSION,COINS} from '../model.js';
import {TREASURES} from '../treasure-data.js';
import {TREASURE_ICONS} from '../equipment-icons.js';
import {waitForImages,visualChecks} from '../tests/helpers/browser-checks.mjs';
import {findChromium} from './lib/chromium.mjs';

const root=resolve(import.meta.dirname,'..'),port=process.env.TREASURE_TEST_PORT||'4200';
const base=process.env.TREASURE_TEST_URL||`http://127.0.0.1:${port}/${process.env.TREASURE_TEST_PATH||''}`;
const executablePath=await findChromium();
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
let server,browser;
try {
  if(!process.env.TREASURE_TEST_URL){
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Server did not start')),10000);
      server.once('error',error=>{clearTimeout(timer);reject(error);});
      server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
      server.stderr.once('data',data=>{clearTimeout(timer);reject(Error(String(data)));});
    });
  }
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1280,height:950});await page.goto(base,{waitUntil:'networkidle0'});
  const character=makeCharacter({name:'Treasure checks',copper:7,silver:4,electrum:1,gold:12,platinum:2});
  character.items=[{id:'existing-emerald',name:'Emerald',category:'Treasure',qty:1,weight:.1,equipped:false,description:'Quest reward; keep this value and story.',wiki:''}];
  const original=structuredClone(character);
  const purse=character=>Object.fromEntries(Object.keys(COINS).map(key=>[key,character[key]]));
  if(visualChecks)await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),{version:SAVE_VERSION,characters:[character],activeId:character.id,settings:{sound:false}});
  await page.goto(base+'#inventory');await page.reload({waitUntil:'networkidle0'});
  const saved=async()=>parseBackup(await page.evaluate(()=>localStorage.getItem('questlog.v2'))).characters[0];
  const set=(selector,value)=>page.$eval(selector,(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const field=name=>`#modal [name="${name}"]`;
  const open=()=>page.click('[data-action="item"]:not([data-id])');
  const close=()=>page.click('#modal [data-action="close"]');
  const submit=()=>page.click('#modal button[type="submit"]');
  const select=id=>page.select('[data-catalog-pick="item"]',id);
  console.log('RUN emerald search, editable quest loot, value, artwork and persistence');
  await open();await set(field('name'),'Keep this name');await set(field('description'),'Keep these notes');
  await page.select('[data-catalog-group="item"]','Gemstones');
  await set('[data-catalog-search="item"]','emerald');
  assert.deepEqual(await page.$$eval('[data-catalog-pick="item"] option[value]:not([value=""])',nodes=>nodes.map(node=>node.value)),['emerald']);
  assert.equal(await page.$eval(field('description'),node=>node.value),'Keep these notes');
  await select('emerald');
  assert.equal(await page.$eval(field('category'),node=>node.value),'Treasure');
  assert.match(await page.$eval(field('description'),node=>node.value),/Cost: 1,000 GP/);
  assert.equal(await page.$eval('[name="iconKey"]:checked',node=>node.value),'emerald');
  await waitForImages(page,'[data-catalog-preview="item"] img');
  if(visualChecks)await page.screenshot({path:resolve(root,'.tmp/treasure-desktop.png'),fullPage:true});
  await set(field('name'),'Quest emerald');await set(field('qty'),'2');await set(field('weight'),'.05');
  await submit();await page.reload({waitUntil:'networkidle0'});
  const state=await saved(),emerald=state.items.at(-1);
  assert.equal(emerald.name,'Quest emerald');assert.equal(emerald.iconKey,'emerald');assert.equal(emerald.qty,2);assert.equal(emerald.weight,.05);
  assert.deepEqual(state.items[0],original.items[0]);assert.deepEqual(purse(state),purse(original));

  console.log('RUN treasure compendium, all groups, distinct icons and mobile selection');
  await page.click('[data-action="navigate"][data-route="wiki"]');
  await set('[data-reference-search]','emerald');await page.select('[data-reference-entry]','emerald');
  assert.match(await page.$eval('[data-reference-preview]',node=>node.textContent),/1,000 GP/);
  await waitForImages(page,'[data-reference-preview] img');
  await page.setViewport({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(base+'#inventory');await open();
  for(const group of [...new Set(TREASURES.map(item=>item.group))]){
    await page.select('[data-catalog-group="item"]',group);
    assert.equal(await page.$$eval('[data-catalog-pick="item"] option[value]:not([value=""])',nodes=>nodes.length),TREASURES.filter(item=>item.group===group).length);
  }
  await page.select('[data-catalog-group="item"]','Gemstones');await select('black-pearl');
  assert.match(await page.$eval('[data-catalog-preview="item"] img',node=>node.src),/black-pearl.webp$/);
  await waitForImages(page,'[data-catalog-preview="item"] img');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(visualChecks)await page.screenshot({path:resolve(root,'.tmp/treasure-mobile.png'),fullPage:true});
  await close();

  console.log('RUN offline treasure data, icons, save and reload');
  await page.waitForFunction(()=>navigator.serviceWorker.controller,{timeout:30000});
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});await open();
  for(const id of ['ruby','gold-bracelet','gold-trade-bar-5-lb','chicken']){
    await select(id);await waitForImages(page,'[data-catalog-preview="item"] img');await submit();await open();
  }
  await close();await page.reload({waitUntil:'networkidle0'});
  const offline=await saved();
  assert.equal(offline.items.at(-1).name,'Chicken');assert.equal(offline.items.at(-1).weight,0);
  assert.ok(offline.items.some(item=>item.iconKey==='gem-red'));
  await waitForImages(page,'.inventory-list .equipment-icon img');
  assert.deepEqual(offline.items[0],original.items[0]);assert.deepEqual(purse(offline),purse(original));
  assert.deepEqual(errors,[]);
  if(visualChecks){
    await page.setOfflineMode(false);await page.setViewport({width:1120,height:1000});
    const icons={emerald:{label:'Emerald'},diamond:{label:'Diamond'},pearl:{label:'Pearl'},...TREASURE_ICONS};
    await page.setContent(`<body style="margin:16px;background:#eef1e5;font:14px sans-serif"><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px">${Object.entries(icons).map(([key,{label}])=>`<figure style="margin:0;text-align:center;background:#fff;padding:8px"><img width="150" height="150" src="${base}assets/equipment/${key}.webp"><figcaption>${label}</figcaption></figure>`).join('')}</div></body>`);
    await waitForImages(page,'img');
    await page.screenshot({path:resolve(root,'.tmp/treasure-icons.png'),fullPage:true});
  }
  console.log(`PASS ${TREASURES.length} treasure presets: search, icons, editable inventory, compendium, mobile and offline.`);
} finally {await browser?.close();server?.kill();}
