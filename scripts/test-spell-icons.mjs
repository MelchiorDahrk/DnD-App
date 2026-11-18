import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {demoCharacter,parseBackup} from '../model.js';
import {SPELL_CATALOG} from '../progression-data.js';
import {SPELL_ICON_LIBRARY} from '../spell-icons.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.SPELL_ICON_TEST_PORT||'4194';
// A subdirectory exercises the same relative paths used by GitHub Pages.
const base=process.env.SPELL_ICON_TEST_URL||`http://127.0.0.1:${port}${process.env.SPELL_ICON_TEST_PATH||'/dist/'}`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
let server,browser;
try{
  if(!process.env.SPELL_ICON_TEST_URL){
    if(!process.env.SPELL_ICON_TEST_PATH)assert.ok(existsSync(resolve(root,'dist/spell-icons.js')),'Build the production app first: npm run build');
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));});
  }
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.setViewport({width:1280,height:1000});
  await page.goto(base,{waitUntil:'networkidle0'});
  const character=demoCharacter();
  const names=['Fireball','Magic Missile','Shield','Cure Wounds','Healing Word','Misty Step','Mage Hand','Detect Magic','Lightning Bolt','Counterspell','Eldritch Blast','Animate Dead'];
  character.spells=names.map((name,index)=>({...SPELL_CATALOG.find(spell=>spell.name===name),id:`spell-${index}`,prepared:true}));
  character.spells.push({...character.spells[0],id:'homebrew',name:'Moonlit Echo',school:'Illusion',damageType:'cold'});
  character.slots[2]={max:3,used:0};
  await page.evaluate(character=>localStorage.setItem('questlog.v2',JSON.stringify({version:2,characters:[character],activeId:character.id,settings:{sound:false}})),character);
  await page.goto(`${base}#spells`);await page.reload({waitUntil:'networkidle0'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const enter=(name,value)=>page.$eval(`#modal [name="${name}"]`,(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const close=()=>page.click('#modal [data-action="close"]');
  const submit=()=>page.click('#modal button[type="submit"]');
  const edit=()=>page.click('[data-action="spell"][data-id="spell-0"]');
  const key=()=>page.$eval('[data-spell-icon-preview] [data-spell-icon]',node=>node.dataset.spellIcon);
  const search=value=>page.$eval('[data-spell-icon-search]',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const castPreview=async(id,expectedKey,{calm=false,screenshot}={})=>{
    await page.click(`[data-action="cast"][data-id="${id}"]`);await submit();
    await page.waitForSelector('.vfx-spell-cast .vfx-spell-art');
    const effect=await page.$eval('.vfx-spell-cast',(burst,id)=>{
      const artwork=burst.querySelector('.spell-icon'),sigil=burst.querySelector('.vfx-spell-art');
      const card=document.querySelector(`[data-action="spell"][data-id="${id}"]`).closest('.spell-card');
      return {key:artwork.dataset.spellIcon,color:getComputedStyle(artwork).color,reference:getComputedStyle(card.querySelector('.spell-icon')).color,
        glow:burst.style.getPropertyValue('--vfx-color'),accent:burst.style.getPropertyValue('--vfx-accent'),caption:getComputedStyle(burst.querySelector('.vfx-caption strong')).color,
        generic:!!burst.querySelector('.vfx-glyph-orbit'),loading:artwork.querySelector('img')?.loading,
        display:getComputedStyle(sigil).display,animation:getComputedStyle(sigil).animationName,canvas:!!burst.parentElement.querySelector('.vfx-canvas')};
    },id);
    assert.equal(effect.key,expectedKey);assert.equal(effect.color,effect.reference);assert.equal(effect.glow,effect.color);assert.equal(effect.accent,effect.color);assert.equal(effect.caption,effect.color);
    assert.equal(effect.generic,false);assert.equal(effect.loading,'eager');assert.notEqual(effect.display,'none');
    if(calm){assert.equal(effect.animation,'none');assert.equal(effect.canvas,false);}
    if(screenshot){
      await page.waitForFunction(()=>{const animation=document.querySelector('.vfx-spell-art')?.getAnimations()[0];return !animation||animation.currentTime>=450;});
      await mkdir(resolve(root,'.tmp/spell-icons'),{recursive:true});await page.screenshot({path:resolve(root,`.tmp/spell-icons/${screenshot}.png`)});
    }
    return effect.color;
  };
  console.log('RUN spell displays, effect artwork, picker and save persistence');
  assert.equal(await page.$$('.spell-grid .equipment-icon').then(nodes=>nodes.length),0);
  assert.equal(await page.$$eval('.spell-grid [data-spell-icon]',nodes=>nodes.length),names.length+1);
  assert.equal(await page.$eval('.spell-card:last-child [data-spell-icon]',node=>node.dataset.spellIcon),'snowflake-2');
  await edit();assert.equal(await key(),'fireball');
  await enter('name','Shield');assert.equal(await key(),'magic-shield');
  await page.click('.spell-icon-picker summary');await search('teleport');
  assert.ok(await page.$('[data-spell-icon-key="teleport"]:not([hidden])'));
  await page.select('[data-spell-icon-group]','Healing & life');
  assert.match(await page.$eval('[data-spell-icon-count]',node=>node.textContent),/No icons found/);
  await page.select('[data-spell-icon-group]','');await search('ghost');
  await page.click('[data-spell-icon-key="ghost"]');assert.equal(await key(),'ghost');
  await enter('name','Fireball');await page.select('#modal [name="school"]','Necromancy');assert.equal(await key(),'ghost');
  await page.select('#modal [name="school"]','Evocation');
  await search('nothing matches');assert.equal(await page.$eval('[name="spellIconKey"]:checked',node=>node.value),'ghost');
  await page.focus('[data-spell-icon-search]');await page.keyboard.press('Enter');assert.equal(await page.$eval('#modal',node=>node.open),true);
  await submit();assert.equal((await saved()).characters[0].spells[0].spellIconKey,'ghost');
  assert.equal(parseBackup(JSON.stringify(await saved())).characters[0].spells[0].spellIconKey,'ghost');
  console.log('RUN casting animation follows manual artwork and effect color');
  await castPreview('spell-0','ghost');
  await page.reload({waitUntil:'networkidle0'});await edit();assert.equal(await key(),'ghost');
  await page.click('.spell-icon-picker summary');await page.click('.spell-icon-picker .item-icon-auto');assert.equal(await key(),'fireball');await close();
  assert.equal((await saved()).characters[0].spells[0].spellIconKey,'ghost','Cancel preserves the saved override');
  // Exercise the real backup export and import UI, including duplicate-ID copies.
  await page.evaluate(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='application/json')window.spellBackupText=blob.text();return create(blob);};});
  await page.click('[data-action="characters"]');await page.click('#modal [data-action="export"]');
  const backup=await page.evaluate(()=>window.spellBackupText);assert.equal(parseBackup(backup).characters[0].spells[0].spellIconKey,'ghost');await close();
  await mkdir(resolve(root,'.tmp/spell-icons'),{recursive:true});const backupFile=resolve(root,'.tmp/spell-icons/backup.json');await writeFile(backupFile,backup);
  await (await page.$('#import-file')).uploadFile(backupFile);await page.waitForSelector('[data-action="confirm-import"]');await page.click('[data-action="confirm-import"]');
  assert.equal((await saved()).characters[1].spells[0].spellIconKey,'ghost','JSON import preserves artwork in the copied character');
  await page.click('[data-action="characters"]');await page.click(`[data-action="switch-character"][data-id="${character.id}"]`);
  await page.goto(`${base}#spells`);await page.waitForSelector('.spell-grid');
  await edit();await page.click('.spell-icon-picker summary');await page.click('.spell-icon-picker .item-icon-auto');await submit();
  assert.equal((await saved()).characters[0].spells[0].spellIconKey,'');
  // Casting, slots, preparation, and concentration still use the existing actions.
  const before=(await saved()).characters[0].slots[2].used;
  const colors=[];
  for(const theme of ['light','dark']){
    await page.evaluate(theme=>window.QuestlogTheme.set(theme),theme);
    colors.push(await castPreview('spell-0','fireball',{screenshot:`casting-${theme}`}));
    if(theme==='light')assert.equal((await saved()).characters[0].slots[2].used,before+1);
  }
  assert.notEqual(colors[0],colors[1],'Casting follows the current light/dark palette');
  const cold=await castPreview('homebrew','snowflake-2');assert.notEqual(cold,colors[1],'Different spell effects have their own animation color');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await castPreview('spell-0','fireball',{calm:true,screenshot:'casting-reduced-motion'});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.click('[data-action="prepare"][data-id="spell-0"]');assert.equal((await saved()).characters[0].spells[0].prepared,false);
  await page.click('[data-action="prepare"][data-id="spell-0"]');
  await page.click('[data-action="cast"][data-id="spell-7"]');await submit();assert.equal((await saved()).characters[0].concentration,'Detect Magic');
  await page.goto(`${base}#sheet`);await page.waitForSelector('.sheet-spell [data-spell-icon]');
  assert.equal(await page.$$('.sheet-spell .equipment-icon').then(nodes=>nodes.length),0);
  await page.click('[data-action="level-up"]');await page.waitForSelector('.level-spell-list .spell-choice-icon');assert.ok(await page.$('.level-spell-list [data-spell-icon]'));await close();
  await page.goto(`${base}#spells`);await page.waitForSelector('.spell-grid');

  console.log(`RUN all ${SPELL_ICON_LIBRARY.length} SVGs: local loading, transparency and geometry`);
  const assets=await page.evaluate(async entries=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d',{willReadFrequently:true});const result=[];
    for(const {key} of entries){const img=new Image();img.src=`./assets/spell-icons/${key}.svg`;try{await img.decode();}catch{result.push({key,missing:true});continue;}ctx.clearRect(0,0,64,64);ctx.drawImage(img,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i]>16)pixels++;result.push({key,pixels,corner:data[3],width:img.naturalWidth});}return result;
  },SPELL_ICON_LIBRARY);
  for(const asset of assets){assert.ok(!asset.missing,asset.key);assert.ok(asset.pixels>50&&asset.pixels<3600,`${asset.key}: visible transparent artwork (${asset.pixels})`);assert.equal(asset.corner,0,asset.key);}
  console.log('RUN light/dark contrast, mobile picker and missing-image fallback');
  await mkdir(resolve(root,'.tmp/spell-icons'),{recursive:true});
  for(const theme of ['light','dark']){
    await page.evaluate(theme=>window.QuestlogTheme.set(theme),theme);
    const contrast=await page.$$eval('.spell-grid .spell-icon',nodes=>{
      const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=rgb=>rgb.map(n=>(n/=255)<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
      return nodes.map(node=>{const color=lum(rgb(getComputedStyle(node).color)),bg=lum(rgb(getComputedStyle(node.closest('.item-symbol')).backgroundColor));return (Math.max(color,bg)+.05)/(Math.min(color,bg)+.05);});
    });assert.ok(contrast.every(value=>value>=3),`${theme}: visible icon contrast ${Math.min(...contrast)}`);
    await page.screenshot({path:resolve(root,`.tmp/spell-icons/spellbook-${theme}.png`),fullPage:true});
  }
  await page.setViewport({width:390,height:844});await edit();await page.click('.spell-icon-picker summary');
  assert.ok(await page.$eval('#modal',node=>node.scrollWidth<=node.clientWidth),'Mobile editor fits');
  await search('fireball');await page.$eval('.spell-icon-picker',node=>node.scrollIntoView({block:'start'}));
  await page.screenshot({path:resolve(root,'.tmp/spell-icons/picker-mobile.png')});await close();
  await page.$eval('.spell-grid .spell-icon>img',node=>{node.loading='eager';node.src='./assets/spell-icons/missing-test.svg';});
  await page.waitForFunction(()=>!document.querySelector('.spell-grid .spell-icon').querySelector('img'));
  assert.equal(await page.$eval('.spell-grid .spell-icon-fallback',node=>getComputedStyle(node).visibility),'visible');
  assert.equal(await page.$eval('.spell-grid .spell-icon-art',node=>getComputedStyle(node).display),'none');
  await page.goto(`${base}#settings`);await page.waitForSelector('a[href="./assets/spell-icons/CREDITS.md"]');
  assert.equal((await page.goto(new URL('./assets/spell-icons/CREDITS.md',base).href)).status(),200);
  await page.goto(`${base}#spells`);
  console.log('RUN service worker cache and offline subdirectory reload');
  await page.waitForFunction(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();if(!registration?.active)return false;
    const cache=await caches.open('questlog-app-v74-spell-casting');return !!await cache.match('./assets/spell-icons/fireball.svg');
  },{timeout:90000});
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('.spell-grid [data-spell-icon]');
  const offline=await page.evaluate(async entries=>{
    const paths=['./spell-icons.js','./spell-icon-mappings.js','./spell-icon-manifest.js','./spell-icons.css','./assets/spell-icons/CREDITS.md',...entries.map(({key})=>`./assets/spell-icons/${key}.svg`)];
    return Promise.all(paths.map(async path=>{try{return (await fetch(path)).ok;}catch{return false;}}));
  },SPELL_ICON_LIBRARY);assert.ok(offline.every(Boolean),'All spell assets work offline under the Pages prefix');
  await page.setOfflineMode(false);assert.deepEqual(errors,[]);
  console.log('Spell icon browser checks passed. Screenshots: .tmp/spell-icons/');
}finally{await browser?.close();server?.kill();}
