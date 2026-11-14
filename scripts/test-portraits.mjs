import {visualChecks} from '../tests/helpers/browser-checks.mjs';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {validPortrait} from '../portrait.js';
import {EQUIPMENT_ICONS} from '../equipment-icons.js';
import themeCatalog from '../vendor/bricktrait/theme-catalog.json' with {type:'json'};

const started=performance.now();
let checkStarted=started,checkName='browser startup';
const seconds=since=>((performance.now()-since)/1000).toFixed(1);
function startCheck(name) {checkName=name;checkStarted=performance.now();console.log(`RUN ${name} (${seconds(started)}s total)`);}
function pass() {console.log(`PASS ${checkName} (${seconds(checkStarted)}s; ${seconds(started)}s total)`);}

const base=process.env.PORTRAIT_TEST_URL||'http://localhost:4173/';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage();
await page.setViewport({width:1440,height:1100});
const errors=[];
const externalRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)externalRequests.push(request.url());});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
async function readyFrame() {
  const element=await page.waitForSelector('.portrait-editor');
  const frame=await element.contentFrame();
  await frame.waitForSelector('.preview:not(.busy)',{timeout:120000});
  assert.equal(await frame.$('.preview .notice'),null,'WebGL must be available');
  assert.equal(await frame.$('.preview .error'),null,'Parts must load successfully');
  await page.waitForSelector('.portrait-use:not([disabled])');
  return frame;
}
async function open() {await page.click('[data-action=portrait]');return readyFrame();}
async function save(frame) {
  await page.click('.portrait-use');
  await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'),{timeout:60000});
}
function transparentStyle(style) {
  assert.equal(style.background,'none');assert.equal(style.ring,false);
  assert.equal(style.shape,'square');assert.equal(style.outline,false);
}
async function imagePixels(src) {
  return page.evaluate(async src=>{
    const img=new Image();img.src=src;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const {width:w,height:h}=canvas;
    const data=ctx.getImageData(0,0,w,h).data;
    let count=0,minX=w,minY=h,maxX=0,maxY=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>8){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    return {w,h,corners:[data[3],data[(w-1)*4+3],data[((h-1)*w)*4+3],data[(w*h-1)*4+3]],count,bounds:[minX,minY,maxX,maxY]};
  },src);
}
async function setYaw(frame,value) {
  await frame.evaluate(()=>[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.trim()==='Camera').click());
  await frame.waitForSelector('input[type=range]');
  await frame.evaluate(value=>{const input=document.querySelector('.panel input[type=range]');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);
}
try {
  startCheck('inventory static thumbnails, custom backpack images and SVGs, and missing-asset fallback without WebGL');
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),defaultPartyState());
  await page.reload({waitUntil:'networkidle0'});
  await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('questlog.v2'));
    s.characters.find(c=>c.id===s.activeId).items.push(
      {id:'icon-mapped',name:'Longsword',category:'Weapon',qty:1,weight:3,equipped:false,description:'Icon fixture',wiki:''},
      {id:'icon-custom',name:'Custom moon compass',category:'Gear',qty:1,weight:0,equipped:false,description:'Fallback fixture',wiki:''});
    localStorage.setItem('questlog.v2',JSON.stringify(s));
    localStorage.setItem('bricktrait:prefs',JSON.stringify({favourites:['3885','30173a'],recent:['3885','30173a']}));
  });
  await page.reload({waitUntil:'networkidle0'});
  await page.click('[data-action=navigate][data-route=inventory]');
  await page.waitForSelector('.inventory-list .equipment-icon img');
  assert.equal(await page.$('canvas'),null,'Inventory lists need no WebGL');
  const mappedRow=await page.$eval('[data-action=item][data-id=icon-mapped]',el=>el.closest('.action-row').innerHTML);
  assert.match(mappedRow,/assets\/equipment\/longsword.webp/);
  const customIcon=await page.$eval('[data-action=item][data-id=icon-custom]',el=>el.closest('.action-row').querySelector('.equipment-icon').innerHTML);
  assert.match(customIcon,/<img src="\.\/assets\/equipment\/backpack\.webp"/);assert.match(customIcon,/<svg/);
  await page.$eval('.inventory-list .equipment-icon img',img=>img.src='./assets/equipment/missing-test.webp');
  await page.waitForFunction(()=>[...document.querySelectorAll('.equipment-icon')].some(el=>!el.querySelector('img')&&getComputedStyle(el.querySelector('svg')).visibility==='visible'));
  await page.click('[data-action=navigate][data-route=sheet]');
  pass();
  startCheck('deployed code license and LDraw attribution');
  const attribution=await page.evaluate(async()=>Promise.all(['portrait-maker/LICENSE','portrait-maker/ldraw/CREDITS.txt','portrait-maker/ldraw/CAlicense4.txt'].map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error(`Missing attribution: ${path}`);return response.text();})));
  assert.match(attribution[0],/Copyright \(c\) 2026 Maxichance/);
  assert.match(attribution[1],/file\s+author\s+license/);
  assert.match(attribution[2],/Creative Commons/i);
  assert.deepEqual((await imagePixels(new URL('assets/portrait-adventurer.webp',base).href)).corners,[0,0,0,0],'Bundled starter portrait must be transparent');
  pass();
  startCheck('embedded portrait editor loads');
  let frame=await open();
  pass();
  startCheck('portrait studio follows site appearance and redraws lighting without changing the design');
  const preference=await page.evaluate(()=>window.QuestlogTheme.preference);
  await page.evaluate(()=>window.QuestlogTheme.set('light'));
  await frame.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  const daylight=await frame.$eval('.preview canvas',canvas=>canvas.toDataURL());
  const lightPanel=await frame.$eval('.panel',el=>getComputedStyle(el).getPropertyValue('--card').trim());
  assert.equal(lightPanel,'#faf5e9');
  const beforeThemeChange=await state();
  await page.evaluate(()=>window.QuestlogTheme.set('dark'));
  await frame.waitForFunction(before=>document.documentElement.dataset.theme==='dark'&&document.querySelector('.preview canvas').toDataURL()!==before,{},daylight);
  assert.equal(await frame.$eval('.panel',el=>getComputedStyle(el).getPropertyValue('--card').trim()),'#222c27');
  assert.deepEqual(await state(),beforeThemeChange,'Changing lighting does not mutate saved characters');
  const night=await frame.$eval('.preview canvas',canvas=>canvas.toDataURL());
  assert.deepEqual((await imagePixels(night)).corners,[0,0,0,0]);
  // Invalid messages cannot override the theme of a session-bound editor.
  await page.evaluate(()=>document.querySelector('.portrait-editor').contentWindow.postMessage({type:'questlog:portrait-theme',session:'wrong-session',theme:'light'},location.origin));
  await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await frame.$eval('html',el=>el.dataset.theme),'dark');
  await page.evaluate(value=>window.QuestlogTheme.set(value),preference);
  const resolvedTheme=await page.$eval('html',el=>el.dataset.theme);
  await frame.waitForFunction(theme=>document.documentElement.dataset.theme===theme,{},resolvedTheme);
  pass();
  startCheck('bundled editor thumbnails and missing-asset WebGL fallback');
  const thumbnail=await frame.waitForSelector('.picker .pick[aria-pressed="false"] .thumb img[src*="/thumbs/"]');
  await thumbnail.evaluate(img=>img.decode());
  const thumbContainer=await thumbnail.evaluateHandle(img=>img.parentElement);
  await thumbnail.evaluate(img=>{img.src='./thumbs/missing-test.webp';});
  await frame.waitForFunction(el=>{
    const img=el.querySelector('img');
    return img?.src.startsWith('blob:')&&img.complete&&img.naturalWidth>0;
  },{timeout:60000},thumbContainer);
  await thumbContainer.dispose();await thumbnail.dispose();
  pass();
  startCheck('render and save a real portrait');
  await save(frame);
  let s=await state();
  const firstId=s.activeId;
  const original=s.characters.find(c=>c.id===firstId).portrait;
  assert.ok(validPortrait(original));
  transparentStyle(original.design.style);
  assert.match(original.image,/^data:image\/webp/);
  assert.deepEqual((await imagePixels(original.image)).corners,[0,0,0,0]);
  assert.ok((await imagePixels(original.image)).count>1000,'Portrait must contain a real figure');
  if(process.argv.includes('--write-default')) {
    await fs.writeFile(resolve('assets/portrait-adventurer.webp'),Buffer.from(original.image.split(',')[1],'base64'));
    console.log('Generated starter portrait using the journal portrait renderer.');
  }
  pass();

  startCheck('edit, reopen, and cancel without changing saved design');
  frame=await open();
  const nextHead=await frame.$eval('.picker .pick[aria-pressed="false"]',el=>el.querySelector('.id').textContent);
  await frame.click('.picker .pick[aria-pressed="false"]');
  await frame.click('.swatch[title$="(78)"]');
  await frame.waitForSelector('.picker .thumb img[src^="blob:"]',{timeout:60000});
  await setYaw(frame,25);await save(frame);
  s=await state();const saved=s.characters.find(c=>c.id===firstId).portrait;
  assert.equal(saved.design.view.yaw,25);
  assert.equal(saved.design.figure.head.id,nextHead);
  assert.equal(saved.design.figure.head.color,78);
  frame=await open();
  await frame.evaluate(()=>[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.trim()==='Camera').click());
  await frame.waitForFunction(()=>document.querySelector('.panel input[type=range]')?.value==='25');
  await setYaw(frame,-25);
  await page.click('[data-portrait-close]');
  assert.deepEqual((await state()).characters.find(c=>c.id===firstId).portrait,saved);
  pass();

  startCheck('available theme filters/search and new headgear, scabbard, staff and printed body render/save/reopen');
  frame=await open();
  const slotIndex={headgear:0,head:1,neck:2,back:3,torso:4,legs:5,hand:6};
  async function browseTheme(cat,theme,query='') {
    await frame.evaluate(index=>document.querySelectorAll('.slots .pick')[index].click(),slotIndex[cat]);
    await frame.waitForSelector('.picker select[aria-label="Part collection"]');
    await frame.select('.picker select[aria-label="Part collection"]','themes');
    await frame.select('.picker select[aria-label="Theme"]',theme);
    await frame.$eval('.picker input[type=search]',(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},query);
    await frame.waitForSelector('.picker .pick');
  }
  for(const [theme,categories] of Object.entries(themeCatalog.themes)) {
    const category=Object.entries(categories).sort((a,b)=>Object.keys(a[1]).length-Object.keys(b[1]).length)[0];
    if(!category)continue;
    const [cat,entries]=category;
    await browseTheme(cat,theme,theme);
    const shown=await frame.$$eval('.picker .pick .id',elements=>elements.map(el=>el.textContent));
    assert.ok(shown.length>0,theme);
    for(const id of shown)assert.ok(Object.hasOwn(entries,id),`${theme}: ${cat}/${id}`);
  }
  const themedFigure=[['headgear','Prince of Persia','88287'],['back','Pirates of the Caribbean','95348'],['hand',"Pharaoh's Quest",'93252'],['torso',"Pharaoh's Quest",'76382pq0'],['legs',"Pharaoh's Quest",'73200bpq0']];
  for(const [cat,theme,id] of themedFigure) {
    await browseTheme(cat,theme,id);
    await frame.click(`.picker .pick[title*=" · ${id}"]`);
    await frame.waitForSelector('.preview:not(.busy)',{timeout:60000});
    assert.equal(await frame.$('.preview .error'),null,`${theme}: ${id} renders`);
  }
  await save(frame);
  const themedPortrait=(await state()).characters.find(c=>c.id===firstId).portrait;
  for(const [cat,,id] of themedFigure)assert.equal(themedPortrait.design.figure[cat==='hand'?'handR':cat].id,id);
  assert.ok((await imagePixels(themedPortrait.image)).count>1000);
  frame=await open();
  assert.ok(await frame.$('.slots .pick[title*="Desert Head Wrap"]'));
  assert.ok(await frame.$('.slots .pick[title*="Sword Scabbard with Shoulder Strap"]'));
  await page.click('[data-portrait-close]');
  await page.evaluate(({id,portrait})=>{
    const s=JSON.parse(localStorage.getItem('questlog.v2'));s.characters.find(c=>c.id===id).portrait=portrait;localStorage.setItem('questlog.v2',JSON.stringify(s));
    const prefs=JSON.parse(localStorage.getItem('bricktrait:prefs'));
    prefs.favourites=['3885','30173a'];prefs.recent=['3885','30173a'];localStorage.setItem('bricktrait:prefs',JSON.stringify(prefs));
  },{id:firstId,portrait:saved});
  await page.reload({waitUntil:'networkidle0'});
  pass();

  startCheck('legacy ring normalization, excluded equipped part rendering, and lossless cancellation');
  // Seed an actual v2 legacy save, including a now excluded part. Opening and
  // canceling must preserve even its old flattened ringed image byte for byte.
  const legacy=structuredClone(saved);
  legacy.design.style={...legacy.design.style,background:'space',ring:true,shape:'round',outline:true};
  legacy.image=await page.evaluate(async src=>{
    const image=new Image();image.src=src;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#262a72';ctx.fillRect(0,0,256,256);
    ctx.drawImage(image,0,0);ctx.lineWidth=16;ctx.strokeStyle='#1f5ef5';ctx.beginPath();ctx.arc(128,128,116,0,Math.PI*2);ctx.stroke();
    return canvas.toDataURL('image/webp');
  },saved.image);
  legacy.design.figure.handR.id='3885';legacy.design.figure.pose.armR=30;
  legacy.design.view={yaw:17,pitch:9,zoom:.65};
  await page.evaluate(({id,portrait})=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));s.characters.find(c=>c.id===id).portrait=portrait;localStorage.setItem('questlog.v2',JSON.stringify(s));}, {id:firstId,portrait:legacy});
  await page.reload({waitUntil:'networkidle0'});
  frame=await open();
  assert.equal(await frame.$eval('.modes',el=>el.textContent.includes('Scene')),false);
  assert.equal(await frame.$('input[type=color]'),null,'Embedded editor exposes no background or ring colours');
  assert.ok(await frame.$('.slots .pick[title*="Darksaber"]'),'Excluded equipped part remains in its slot');
  await frame.evaluate(()=>document.querySelectorAll('.slots .pick')[6].click());
  await frame.waitForSelector('.picker .pick');
  assert.equal(await frame.$('.picker .pick[title*="Darksaber"]'),null);
  for(const label of ['Favourites','Recent']) {
    await frame.evaluate(label=>[...document.querySelectorAll('.views button')].find(el=>el.textContent.includes(label)).click(),label);
    await frame.waitForFunction(()=>document.querySelectorAll('.picker .pick').length===1);
    assert.match(await frame.$eval('.picker .pick',el=>el.title),/30173a/);
  }
  await frame.evaluate(()=>document.querySelector('.views button').click());
  await frame.$eval('.picker input[type=search]',input=>{input.value='darksaber';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await frame.waitForFunction(()=>document.querySelectorAll('.picker .pick').length===0);
  assert.deepEqual((await imagePixels(await frame.$eval('.preview canvas',c=>c.toDataURL('image/webp')))).corners,[0,0,0,0]);
  await page.click('[data-portrait-close]');
  assert.deepEqual((await state()).characters.find(c=>c.id===firstId).portrait,legacy);
  frame=await open();await save(frame);
  const converted=(await state()).characters.find(c=>c.id===firstId).portrait;
  assert.deepEqual(converted.design.figure,legacy.design.figure);
  assert.deepEqual(converted.design.view,legacy.design.view);
  transparentStyle(converted.design.style);
  assert.deepEqual((await imagePixels(converted.image)).corners,[0,0,0,0]);
  // Restore the fixture used by the existing per-character and backup checks.
  await page.evaluate(({id,portrait})=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));s.characters.find(c=>c.id===id).portrait=portrait;localStorage.setItem('questlog.v2',JSON.stringify(s));},{id:firstId,portrait:saved});
  await page.reload({waitUntil:'networkidle0'});
  pass();

  startCheck(visualChecks?'equipment thumbnail geometry review':'equipment thumbnails load with nonempty transparent artwork');
  for(const key of Object.keys(EQUIPMENT_ICONS)) {
    const px=await imagePixels(new URL(`assets/equipment/${key}.webp`,base).href);
    assert.ok(px.w>0&&px.h>0,`${key}: image loads`);assert.deepEqual(px.corners,[0,0,0,0],key);
    if(visualChecks) {
      assert.equal(px.w,160);assert.equal(px.h,160);
      assert.ok(px.count>50,`${key}: real geometry`);
      const [x,y,right,bottom]=px.bounds;
      assert.ok(x>0&&y>0&&right<159&&bottom<159,`${key}: no clipped edges`);
      assert.ok(Math.abs((x+right)/2-79.5)<19&&Math.abs((y+bottom)/2-79.5)<19,`${key}: centered`);
      const broadsideRatio={handaxe:0.36,battleaxe:0.24,greataxe:0.6}[key];
      if(broadsideRatio)assert.ok((right-x+1)/(bottom-y+1)>=broadsideRatio,`${key}: the broad blade face must be visible`);
    } else assert.ok(px.count>0,`${key}: nonempty image`);
  }
  const review=await browser.newPage();
  await review.setViewport({width:1000,height:1100});
  await review.setContent(`<style>body{margin:24px;background:#eef1e5;font:14px Georgia;color:#254937}main{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}figure{margin:0;padding:9px;text-align:center;background:#fffef9;border-radius:7px}figure:nth-child(even){background:#254937;color:#eef1e5}img{width:88px;height:88px;object-fit:contain}figcaption{font-size:12px}</style><h1>Questlog LEGO equipment</h1><main>${Object.keys(EQUIPMENT_ICONS).map(key=>`<figure><img src="${new URL(`assets/equipment/${key}.webp`,base).href}"><figcaption>${key}</figcaption></figure>`).join('')}</main>`);
  await review.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
  await fs.mkdir('screenshots',{recursive:true});
  await review.screenshot({path:'screenshots/equipment-icons.png',fullPage:true});await review.close();
  pass();

  startCheck('separate character portraits and reload persistence');
  await page.click('[data-action=characters]');
  await page.click('[data-action=switch-character]:not(.active)');
  const secondId=(await state()).activeId;
  frame=await open();await setYaw(frame,-15);await save(frame);
  s=await state();assert.equal(s.characters.find(c=>c.id===secondId).portrait.design.view.yaw,-15);
  assert.deepEqual(s.characters.find(c=>c.id===firstId).portrait,saved);
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('.hero .character-portrait',img=>img.src),(await state()).characters.find(c=>c.id===secondId).portrait.image);
  pass();

  startCheck('details save before editing and Escape cancels the maker');
  await page.click('[data-action=edit-character]');
  await page.$eval('[name=campaign]',input=>{input.value='Portrait browser check';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#modal [data-action=portrait]');
  frame=await readyFrame();
  assert.equal((await state()).characters.find(c=>c.id===secondId).campaign,'Portrait browser check');
  await frame.focus('.preview canvas');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.portrait-dialog'));
  pass();

  startCheck('backup import preserves portrait images and editable designs');
  const backupPath=resolve('.tmp/portrait-browser-backup.json');
  await fs.mkdir(resolve('.tmp'),{recursive:true});
  const beforeImport=await state();
  await fs.writeFile(backupPath,JSON.stringify(beforeImport));
  await (await page.$('#import-file')).uploadFile(backupPath);
  await page.waitForSelector('[data-action=confirm-import]');
  await page.click('[data-action=confirm-import]');
  s=await state();
  assert.equal(s.characters.filter(c=>c.portrait?.design.view.yaw===25).length,2);
  assert.equal(s.characters.filter(c=>c.portrait?.design.view.yaw===-15).length,2);
  assert.deepEqual(s.characters.filter(c=>c.portrait?.design.view.yaw===25).map(c=>c.items),[beforeImport.characters.find(c=>c.id===firstId).items,beforeImport.characters.find(c=>c.id===firstId).items]);
  pass();

  startCheck('mobile portrait editor and cancellation');
  // Return to the original second character for offline checks.
  await page.click('[data-action=characters]');
  await page.click(`[data-action=switch-character][data-id="${secondId}"]`);

  await fs.mkdir('screenshots',{recursive:true});
  frame=await open();
  await frame.waitForFunction(()=>{
    const scroll=document.querySelector('.picker .scroll')?.getBoundingClientRect();
    if(!scroll)return false;
    const visible=[...document.querySelectorAll('.picker .thumb')].filter(el=>{const rect=el.getBoundingClientRect();return rect.bottom>scroll.top&&rect.top<scroll.bottom;});
    return visible.length>0&&visible.every(el=>el.querySelector('img'));
  },{timeout:60000});
  await page.screenshot({path:'screenshots/portrait-maker-desktop.png'});
  await page.setViewport({width:390,height:844});
  await page.screenshot({path:'screenshots/portrait-maker-mobile.png'});
  if(visualChecks)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(visualChecks)assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(visualChecks)assert.ok(await frame.$eval('.bar .strip',el=>el.getBoundingClientRect().height<=60),'Mobile swatches must stay compact');
  if(visualChecks)assert.ok(await frame.$eval('.lang select',el=>el.getBoundingClientRect().right<=innerWidth),'Mobile header controls must fit');
  await page.click('[data-portrait-close]');
  await page.screenshot({path:'screenshots/bricktrait-character-mobile.png'});
  pass();

  startCheck('offline sheet portrait and cached editor reopening');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:60000});
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'load'});
  await page.waitForSelector('.hero .character-portrait');
  assert.equal(await page.$eval('.hero .character-portrait',img=>img.src),(await state()).characters.find(c=>c.id===secondId).portrait.image);
  frame=await open();
  await save(frame);
  for(const key of Object.keys(EQUIPMENT_ICONS)) {
    assert.ok((await imagePixels(new URL(`assets/equipment/${key}.webp`,base).href)).count>0,`${key}: bundled offline icon`);
  }
  await page.setOfflineMode(false);
  pass();

  assert.deepEqual(errors,[],'Browser JavaScript errors');
  assert.deepEqual(externalRequests,[],'The editor must be fully self-hosted');
  console.log(`All portrait browser checks passed (${seconds(started)}s total).`);
} catch(error) {
  console.error(`FAIL ${checkName} after ${seconds(checkStarted)}s (${seconds(started)}s total)`);
  throw error;
} finally { await browser.close(); }
