import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {visualChecks,waitForImages} from '../tests/helpers/browser-checks.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';

const root=resolve(import.meta.dirname,'..');
const port=process.env.THEME_TEST_PORT||'4198';
const base=process.env.THEME_TEST_URL||`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','C:/Program Files/Mozilla Firefox/firefox.exe'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium or Firefox browser.');
let server,browser;
// Optional design review; excluded from functional deployment checks.
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
  browser=await puppeteer.launch({browser:/firefox/i.test(executablePath)?'firefox':'chrome',executablePath,headless:true,protocolTimeout:45000,args:['--no-sandbox']});
  console.log('RUN offscreen lazy image loading');
  const lazyPage=await browser.newPage();
  await lazyPage.setViewport({width:390,height:844});
  await lazyPage.setContent('<img loading="lazy" style="margin-top:20000px" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E">');
  await waitForImages(lazyPage,'img');
  assert.equal(await lazyPage.$eval('img',image=>image.naturalWidth),1);
  await lazyPage.setContent('<img src="data:image/png;base64,aW52YWxpZA==">');
  await assert.rejects(()=>waitForImages(lazyPage,'img'),/Images failed to load/);
  await lazyPage.close();
  console.log('PASS lazy images load without an unbounded decode wait; broken images still fail');
  const page=await browser.newPage(),errors=[];
  console.log('RUN appearance selection and persistence');
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1440,height:1100});
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'}]);
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.waitForSelector('#landing-appearance');
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  if(visualChecks)await page.screenshot({path:resolve(root,'.tmp/daylight-landing.png')});
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
  console.log('PASS light/dark/system selection and persistence');
  const views={sheet:'.hero',inventory:'.inventory-list',spells:'.spell-grid',journal:'.notes-grid',dice:'#dice-form',wiki:'.catalog-browser',settings:'#settings-appearance'};
  const characterSave=await page.evaluate(()=>localStorage.getItem('questlog.v2'));
  for(const theme of ['light','dark']) {
    console.log(`RUN ${theme} routes and dialogs`);
    await page.evaluate(theme=>window.QuestlogTheme.set(theme),theme);
    await page.goto(base+'#sheet');
    await page.waitForSelector('.hero .character-portrait');
    await waitForImages(page,'.hero img,.equipment-icon img');
    if(visualChecks)await page.screenshot({path:resolve(root,`.tmp/${theme==='light'?'daylight':'candlelit'}-sheet.png`)});
    for(const width of [1440,768,390,320]) {
      await page.setViewport({width,height:1000});
      for(const route of ['sheet','inventory','spells','journal','dice','wiki','settings']) {
        await page.goto(base+'#'+route);
        await page.waitForSelector(views[route]);
        if(visualChecks) {
          const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
          assert.equal(overflow,false,`${theme} ${width}px ${route} must not overflow`);
        }
        assert.equal(await page.$eval('html',node=>node.dataset.theme),theme);
        if(visualChecks)assert.deepEqual(await page.evaluate(contrastFailures),[],`${theme} ${width}px ${route} text contrast`);
      }
    }
    await page.goto(base+'#settings');
    await page.select('#settings-appearance',theme==='light'?'dark':'light');
    await page.select('#settings-appearance',theme);
    await page.goto(base+'#sheet');
    await page.click('[data-action="edit-character"]');
    await page.waitForSelector('#modal[open] input');
    assert.ok(await page.$eval('#modal',node=>node.getAttribute('aria-label')||document.getElementById(node.getAttribute('aria-labelledby'))?.textContent.trim()),'Dialog has an accessible name');
    if(visualChecks)assert.deepEqual(await page.evaluate(contrastFailures),[],`${theme} character editor text contrast`);
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(()=>document.querySelector('#modal').contains(document.activeElement)),'Native dialog keeps keyboard focus inside');
    await page.keyboard.press('Escape');
    await page.click('[data-action="rest"][data-kind="long"]');
    await page.waitForSelector('#modal[open] button[type="submit"]');
    if(visualChecks)assert.deepEqual(await page.evaluate(contrastFailures),[],`${theme} rest dialog text contrast`);
    await page.keyboard.press('Escape');
    await page.setViewport({width:390,height:844});
    if(visualChecks)await page.screenshot({path:resolve(root,`.tmp/${theme==='light'?'daylight':'candlelit'}-mobile.png`)});
    await page.setViewport({width:1440,height:1100});
    console.log(`PASS ${theme} routes, image loading, dialogs and keyboard focus`);
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('questlog.v2')),characterSave,'Appearance does not rewrite character data');
  const other=await browser.newPage();await other.goto(base,{waitUntil:'networkidle0'});
  await other.evaluate(()=>window.QuestlogTheme.set('light'));
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await other.close();
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  // Exercise the app under reduced motion without pinning CSS durations.
  await page.click('[data-action="ability-roll"]');
  await page.waitForSelector('#modal[open] .roll-modal');
  await page.keyboard.press('Escape');
  console.log('PASS cross-tab synchronization and interaction under reduced motion');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  console.log('RUN offline reload');
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('.hero');
  await waitForImages(page,'.hero img,.equipment-icon img');
  await page.evaluate(()=>window.QuestlogTheme.set('dark'));
  assert.equal(await page.$eval('html',node=>node.dataset.theme),'dark');
  await page.setOfflineMode(false);
  console.log('PASS offline sheet, LEGO images and appearance switching');
  if(process.env.THEME_TEST_PRODUCTION) {
    const response=await page.goto(base+'dev/theme-showcase.html');
    assert.equal(response.status(),404,'Development workshop is excluded from production');
  } else {
    await page.goto(base+'dev/theme-showcase.html',{waitUntil:'networkidle0'});
    await page.waitForSelector('.workshop .equipment-icon img');
    await waitForImages(page,'.equipment-icon img');
    for(const theme of ['light','dark']) {await page.select('[data-theme-select]',theme);if(visualChecks)await page.screenshot({path:resolve(root,`.tmp/showcase-${theme}.png`),fullPage:true});}
    await page.setViewport({width:320,height:844});
    if(visualChecks)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Workshop fits 320px');
    await page.click('#open-dialog');await page.waitForSelector('#sample-dialog[open]');await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log(`PASS appearance functionality${visualChecks?' plus optional layout/contrast review':''}; ${process.env.THEME_TEST_PRODUCTION?'production workshop exclusion':'development workshop interaction'}`);
} finally {await browser?.close();server?.kill();}
