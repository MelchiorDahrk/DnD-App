import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';

const root=resolve(import.meta.dirname,'..');
const port=process.env.THEME_TEST_PORT||'4198';
const base=process.env.THEME_TEST_URL||`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','C:/Program Files/Mozilla Firefox/firefox.exe'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium or Firefox browser.');
let server,browser;
// Check rendered text against its nearest painted surface, in addition to token tests.
const contrastFailures=()=>{
  const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
  const lum=rgb=>rgb.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('body *')].flatMap(element=>{
    if(![...element.childNodes].some(node=>node.nodeType===3&&node.textContent.trim())||!element.getClientRects().length||element.closest('[hidden],button:disabled'))return [];
    const style=getComputedStyle(element),size=parseFloat(style.fontSize);
    if(style.visibility!=='visible'||size===0)return [];
    let parent=element,background;
    while(parent){const color=rgb(getComputedStyle(parent).backgroundColor);if(color.length&&color[3]!==0){background=color;break;}parent=parent.parentElement;}
    if(!background)return [];
    const a=lum(rgb(style.color)),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum=size>=24||(size>=18.66&&Number(style.fontWeight)>=700)?3:4.5;
    return ratio>=minimum?[]:[{text:element.textContent.trim().slice(0,40),class:element.className,ratio:ratio.toFixed(2)}];
  });
};
try {
  if(!process.env.THEME_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);done();});server.stderr.once('data',data=>reject(Error(String(data))));});
  }
  browser=await puppeteer.launch({browser:/firefox/i.test(executablePath)?'firefox':'chrome',executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1440,height:1100});
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'}]);
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.waitForSelector('#landing-appearance');
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.screenshot({path:resolve(root,'.tmp/daylight-landing.png')});
  await page.select('#landing-appearance','dark');
  assert.equal(await page.$eval('html',node=>node.dataset.theme),'dark');
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('#landing-appearance',node=>node.value),'dark');
  await page.select('#landing-appearance','system');
  assert.equal(await page.$eval('html',node=>node.dataset.theme),'light');
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.select('#landing-appearance','light');
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'}]);
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),defaultPartyState());
  await page.reload({waitUntil:'networkidle0'});
  const characterSave=await page.evaluate(()=>localStorage.getItem('questlog.v2'));
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>window.QuestlogTheme.set(theme),theme);
    await page.goto(base+'#sheet');
    await page.waitForSelector('.hero .character-portrait');
    await page.$$eval('.hero img,.equipment-icon img',images=>Promise.all(images.map(image=>image.decode())));
    await page.screenshot({path:resolve(root,`.tmp/${theme==='light'?'daylight':'candlelit'}-sheet.png`)});
    for(const width of [1440,768,390,320]) {
      await page.setViewport({width,height:1000});
      for(const route of ['sheet','inventory','spells','journal','dice','wiki','settings']) {
        await page.goto(base+'#'+route);
        await page.waitForFunction(route=>location.hash==='#'+route&&document.title.startsWith(route==='sheet'?'Character sheet':route==='spells'?'Spellbook':route==='wiki'?'2024':route==='journal'?'Adventure':route==='settings'?'Settings':route==='dice'?'Dice':'Inventory'),{},route);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflow,false,`${theme} ${width}px ${route} must not overflow`);
        assert.equal(await page.$eval('html',node=>node.dataset.theme),theme);
        assert.deepEqual(await page.evaluate(contrastFailures),[],`${theme} ${width}px ${route} text contrast`);
      }
    }
    await page.goto(base+'#settings');
    await page.select('#settings-appearance',theme==='light'?'dark':'light');
    await page.select('#settings-appearance',theme);
    await page.goto(base+'#sheet');
    await page.click('[data-action="edit-character"]');
    await page.waitForSelector('#modal[open] input');
    assert.equal(await page.$eval('#modal',node=>node.getAttribute('aria-labelledby')),'modal-title');
    assert.deepEqual(await page.evaluate(contrastFailures),[],`${theme} character editor text contrast`);
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(()=>document.querySelector('#modal').contains(document.activeElement)),'Native dialog keeps keyboard focus inside');
    await page.keyboard.press('Escape');
    await page.click('[data-action="rest"][data-kind="long"]');
    await page.waitForSelector('#modal[open] .rest-illustration');
    assert.deepEqual(await page.evaluate(contrastFailures),[],`${theme} rest dialog text contrast`);
    await page.keyboard.press('Escape');
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:resolve(root,`.tmp/${theme==='light'?'daylight':'candlelit'}-mobile.png`)});
    await page.setViewport({width:1440,height:1100});
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('questlog.v2')),characterSave,'Appearance does not rewrite character data');
  const other=await browser.newPage();await other.goto(base,{waitUntil:'networkidle0'});
  await other.evaluate(()=>window.QuestlogTheme.set('light'));
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await other.close();
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await page.$eval('.btn',node=>getComputedStyle(node).transitionDuration),'0s');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const cached=await page.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(key=>key.includes('v29')));return Promise.all(['theme.js','theme.css','assets/gui/portrait-border.png','assets/gui/journal-divider.png'].map(async path=>!!await cache.match(new URL(path,location.href))));});
  assert.ok(cached.every(Boolean),'All appearance assets are precached');
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('.hero');
  await page.evaluate(()=>window.QuestlogTheme.set('dark'));
  assert.equal(await page.$eval('html',node=>node.dataset.theme),'dark');
  await page.setOfflineMode(false);
  if(process.env.THEME_TEST_PRODUCTION) {
    const response=await page.goto(base+'dev/theme-showcase.html');
    assert.equal(response.status(),404,'Development workshop is excluded from production');
  } else {
    await page.goto(base+'dev/theme-showcase.html',{waitUntil:'networkidle0'});
    await page.waitForSelector('.workshop .equipment-icon img');
    assert.ok(await page.$$eval('.equipment-icon img',images=>images.every(image=>image.complete&&image.naturalWidth>0)),'Workshop uses loaded LEGO icons');
    for(const theme of ['light','dark']) {await page.select('[data-theme-select]',theme);await page.screenshot({path:resolve(root,`.tmp/showcase-${theme}.png`),fullPage:true});}
    await page.setViewport({width:320,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Workshop fits 320px');
    await page.click('#open-dialog');await page.waitForSelector('#sample-dialog[open]');await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log('PASS light/dark/system, persistence, cross-tab sync, all seven routes at 1440/768/390/320px, AA text contrast, forms/dialogs, LEGO art, reduced motion, offline appearance assets, workshop');
} finally {await browser?.close();server?.kill();}
