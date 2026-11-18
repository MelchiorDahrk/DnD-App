import assert from 'node:assert/strict';
import {existsSync,readdirSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {makeCharacter,parseBackup,SAVE_VERSION,COINS} from '../model.js';
import {findEquipment,itemFromEquipment} from '../catalog.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.UI_TEST_PORT||'4206',base=`http://127.0.0.1:${port}/`;
const cache=resolve(root,'.cache/puppeteer/chrome-headless-shell');
const cached=existsSync(cache)?readdirSync(cache).reverse().map(version=>resolve(cache,version,'chrome-headless-shell-win64/chrome-headless-shell.exe')):[];
const executablePath=process.env.BROWSER_PATH||[...cached,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to Chromium.');
const c=makeCharacter({name:'UI checks',gold:50,silver:20,copper:10});
c.items=['longsword','shield','torch','healers-kit'].map((key,i)=>({...itemFromEquipment(findEquipment(key)),id:`item-${i}`}));
c.items[0].equipped=true;
c.sheetLayout={collapsed:[],favorites:{pack:['item-2']}};
c.notes=Array.from({length:24},(_,i)=>({id:`note-${i}`,title:`${i%2?'Quest':'Session'} ${i}`,body:'A lead to follow.',tag:i%2?'Quest':'Session',pinned:i===0,updated:'2026-11-17T12:00:00Z'}));
const spell={school:'Evocation',castingTime:'Action',range:'60 feet',duration:'Instantaneous',notes:'',wiki:'',concentration:false,prepared:false};
c.spells=[{...spell,id:'spark',name:'Arc Spark',level:0},{...spell,id:'ward',name:'Ward',level:1,prepared:true},{...spell,id:'mist',name:'Mist',level:1,concentration:true}];
const fixture={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
parseBackup(JSON.stringify(fixture));
let server,browser,page;
try {
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);done();});});
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluateOnNewDocument(()=>{window.QUESTLOG_FIREBASE_CONFIG=null;});
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await page.reload({waitUntil:'networkidle0'});
  const click=async selector=>{await page.$eval(selector,n=>n.scrollIntoView({block:'center',behavior:'instant'}));await page.click(selector);};
  const go=async route=>{await page.evaluate(route=>location.hash=route,route);await page.waitForFunction(route=>location.hash===`#${route}`&&document.title.startsWith({inventory:'Inventory',spells:'Spellbook',journal:'Journal',settings:'Settings',sheet:'Character sheet'}[route]),{},route);};
  const filter=name=>click(`.list-toolbar [data-filter="${name}"]`);
  const selected=()=>page.$$eval('.list-toolbar [aria-pressed="true"]',nodes=>nodes.map(n=>n.dataset.filter));
  const balances=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));return Object.fromEntries(['copper','silver','electrum','gold','platinum'].map(key=>[key,s.characters[0][key]]));});
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await go('inventory');
  await filter('Weapon');await filter('Gear');
  assert.deepEqual(await selected(),['Weapon','Gear']);
  assert.equal(await page.$$eval('[data-inventory-item]',nodes=>nodes.length),2);
  assert.equal(await page.$eval(':focus',n=>n.dataset.filter),'Gear');
  await page.type('#search','longsword');
  assert.equal(await page.$$eval('[data-inventory-item]',nodes=>nodes.length),1,'Search intersects selected types');
  await page.$eval('#search',n=>{n.value='';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await filter('Weapon');assert.deepEqual(await selected(),['Gear']);
  await filter('Gear');assert.deepEqual(await selected(),['All']);
  await filter('Favorites');await filter('Equipped');
  assert.equal(await page.$$eval('[data-inventory-item]',nodes=>nodes.length),2);
  await filter('All');assert.deepEqual(await selected(),['All']);
  assert.ok(await page.$$eval('.filter-tab',nodes=>nodes.every(n=>n.querySelector('svg')&&!n.querySelector('img'))));
  const before=await balances();
  for(const key of Object.keys(COINS)) {
    await click(`.coin-balance[data-denomination="${key}"]`);
    assert.equal(await page.$eval('#modal-title',n=>n.textContent),'Coin Purse');
    assert.deepEqual(await page.$$eval('#modal [data-currency-input]',nodes=>nodes.map(n=>n.name)),[key]);
    await page.$eval(`#modal [name="${key}"]`,n=>n.value='+2');
    await page.click('#modal button[type="submit"]');
    before[key]+=2;assert.deepEqual(await balances(),before,'Only the clicked denomination changes');
  }
  await click('.coin-balance[data-denomination="gold"]');
  await page.$eval('#modal [name="gold"]',n=>{n.value='-999';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#modal button[type="submit"]');
  assert.match(await page.$eval('#form-error',n=>n.textContent),/enough coins/);
  await page.keyboard.press('Escape');assert.deepEqual(await balances(),before);
  await click('.coin-purse-heading [data-action="currency"]');
  assert.equal(await page.$$eval('#modal [data-currency-input]',nodes=>nodes.length),5);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>document.querySelectorAll('.toast').forEach(n=>n.remove()));
  for(const width of [1440,390,320]) {
    await page.setViewport({width,height:844});
    await go('journal');await filter('Pinned');await filter('Quest');
    assert.equal(await page.$$eval('.note-card',nodes=>nodes.length),13);
    await filter('Pinned');assert.equal(await page.$$eval('.note-card',nodes=>nodes.length),12);
    await filter('Quest');assert.deepEqual(await selected(),['All']);
    await page.evaluate(()=>scrollTo(0,700));
    assert.ok(await page.$eval('.list-toolbar',n=>Math.abs(n.getBoundingClientRect().top-(innerWidth<=760?65:0))<1));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Journal fits ${width}`);
    await page.screenshot({path:resolve(root,`.tmp/journal-ui-${width}.png`)});
    await go('spells');await filter('Cantrips');await filter('Ready');
    assert.equal(await page.$$eval('.spell-card',nodes=>nodes.length),2);
    await filter('Cantrips');assert.equal(await page.$$eval('.spell-card',nodes=>nodes.length),1);
    await filter('Ready');assert.deepEqual(await selected(),['All']);
    await go('inventory');assert.deepEqual(await selected(),['All']);
    for(const row of await page.$$eval('[data-inventory-item]',nodes=>nodes.map(n=>{const card=n.getBoundingClientRect(),edit=n.querySelector('.inventory-edit').getBoundingClientRect();return {top:edit.top-card.top,right:card.right-edit.right};})))assert.ok(row.top<=12&&row.right<=12,'Item edit is at the upper right');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Pack fits ${width}`);
    if(width<=390){await page.evaluate(()=>scrollTo(0,700));assert.ok(await page.$eval('.list-toolbar',n=>Math.abs(n.getBoundingClientRect().top-65)<1),'Pack search and filters stay under the topbar');}
    await page.screenshot({path:resolve(root,`.tmp/pack-ui-${width}.png`),fullPage:true});
  }
  await go('sheet');await click('.hp-manage');
  assert.equal(await page.$eval('#modal-title',n=>n.textContent),'Hit Points');await page.keyboard.press('Escape');
  await click('.character-switch');
  assert.equal(await page.$eval('#modal [data-action="export"]',n=>n.textContent),'Download');
  assert.ok(await page.$('#modal [data-action="import"]'));
  const chooser=page.waitForFileChooser();await page.click('#modal [data-action="import"]');await (await chooser).cancel();
  await page.keyboard.press('Escape');await go('settings');
  assert.equal(await page.$('[data-settings-section="backup"]'),null);
  await click('[data-action="demo-2024"]');
  assert.equal(await page.$eval('.hero h2',n=>n.textContent),'Lyra Ashwood');
  assert.deepEqual(errors,[]);

  // Render account UI with a local transport double; no real account or network writes.
  const accountContext=await browser.createBrowserContext(),account=await accountContext.newPage();const accountErrors=[];account.on('pageerror',e=>accountErrors.push(e.message));
  await account.setBypassServiceWorker(true);await account.setRequestInterception(true);
  const mocks={
    '/firebase-client.js':`export const authMessage=e=>e.message;export async function createFirebaseClient(){return {watch(fn){window.testAuth=fn;fn(null);}}}`,
    '/cloud-store.js':`export class CloudStore{watchParties(next){next([]);return ()=>{};}}`,
    '/cloud-sync.js':`export class CharacterSync{constructor(options){this.options=options;this.queue=[];this.meta=new Map(options.getState().characters.map(c=>[c.id,{}]));this.loaded=true;window.testStatus=value=>options.onStatus(value);}start(){window.testStatus({state:'synced',pending:0});}stop(){}observe(){return true;}deliverDeferred(){}}`
  };
  account.on('request',request=>{const body=mocks[new URL(request.url()).pathname];if(body)request.respond({status:200,contentType:'text/javascript',body});else request.continue();});
  await account.goto(base,{waitUntil:'networkidle0'});
  await account.evaluate(s=>{localStorage.setItem('questlog.v2',JSON.stringify({...s,characters:[],activeId:null}));localStorage.setItem('questlog.v2.account.ui-test',JSON.stringify(s));localStorage.setItem('questlog.migration.ui-test','offered');},fixture);
  await account.evaluate(()=>window.testAuth({uid:'ui-test',email:'ui@example.test',emailVerified:true}));
  await account.waitForSelector('.character-switch');
  await account.evaluate(()=>location.hash='settings');await account.waitForSelector('[data-cloud-status].cloud-synced');
  assert.ok(await account.$('[data-cloud-status]>.icon'));assert.equal(await account.$('[data-action="cloud-upload"]'),null);
  assert.ok(await account.$eval('[data-cloud-status]',n=>{const expected=document.createElement('span');expected.style.color='var(--status-success)';document.body.append(expected);const match=getComputedStyle(n).color===getComputedStyle(expected).color;expected.remove();return match;}),'Synced uses the success green');
  await account.locator('.character-switch').click();assert.equal(await account.$('#modal [data-action="cloud-upload"]'),null);
  assert.ok(await account.$('#modal [data-cloud-status].cloud-synced>.icon'));
  await account.evaluate(()=>window.testStatus({state:'pending',pending:1}));
  assert.equal(await account.$('#modal [data-cloud-status].cloud-synced'),null);
  await account.evaluate(()=>window.testStatus({state:'synced',pending:0}));
  assert.ok(await account.$('#modal [data-cloud-status].cloud-synced>.icon'));
  await account.keyboard.press('Escape');
  await account.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await account.locator('.character-switch').click();assert.ok(await account.$('#modal [data-action="cloud-upload"]'));
  await account.keyboard.press('Escape');await account.evaluate(()=>location.hash='sheet');await account.waitForSelector('.hero');
  await account.evaluate(()=>location.hash='settings');await account.waitForSelector('.account-panel');
  assert.ok(await account.$('[data-action="cloud-upload"]'));
  await account.evaluate(()=>localStorage.setItem('questlog.v2','{invalid'));
  await account.locator('.character-switch').click();assert.equal(await account.$('#modal [data-action="cloud-upload"]'),null);
  assert.deepEqual(accountErrors,[]);
  console.log('PASS multi-select filters, sticky search, SVG icons, coin editors, item edit position, menu actions, renamed dialogs/example and live synced/guest states');
} catch(error) {
  await page?.screenshot({path:resolve(root,'.tmp/ui-updates-failure.png'),fullPage:true}).catch(()=>{});throw error;
} finally {await browser?.close();server?.kill();}
