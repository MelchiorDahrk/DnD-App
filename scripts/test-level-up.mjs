import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {makeCharacter,parseBackup} from '../model.js';
import {FEATURE_CATALOG} from '../feature-catalog.js';
import {SPELL_CATALOG} from '../progression-data.js';
const root=resolve(import.meta.dirname,'..'),port=process.env.LEVEL_TEST_PORT||'4191';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a Chromium browser.');
let server,browser;
try{
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',d=>reject(new Error(String(d))));});
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1280,height:1000});await page.goto(`http://127.0.0.1:${port}${process.env.LEVEL_TEST_PATH||'/'}`,{waitUntil:'networkidle0'});
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const active=s=>s.characters.find(c=>c.id===s.activeId);
  const set=async(name,value)=>page.$eval(`#modal [name="${name}"]`,(n,v)=>{n.value=String(v);n.dispatchEvent(new Event('change',{bubbles:true}));},value);
  const open=()=>page.click('[data-action="level-up"]');
  const submit=()=>page.click('#modal-form button[type="submit"]');
  const load=async c=>{const s=await state();s.characters=[c];s.activeId=c.id;await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),s);await page.reload({waitUntil:'networkidle0'});};
  let before=await state();await open();await page.click('#modal [data-action="close"]');assert.deepEqual(await state(),before);
  await open();const asi=FEATURE_CATALOG.find(f=>f.name==='Ability Score Improvement'&&f.group==='General feats');
  await set('choice-feat',asi.id);await set('choice-mastery','Club');await set('ability-con',2);await submit();
  let saved=await state(),c=active(saved);assert.equal(c.level,4);assert.equal(c.stats.con,14);assert.equal(c.features.find(f=>f.name==='Second Wind').maxUses,3);parseBackup(JSON.stringify(saved));
  assert.equal(c.maxHp,active(before).maxHp+7+4);
  console.log('PASS cancel, explicit ASI/mastery choices, Constitution HP, resource scaling, save validation');
  await load(makeCharacter({class:'Ranger',subclass:'Hunter',race:'Wood Elf',level:4,skills:['Stealth','Perception','Survival']}));
  await open();await page.click('[name="spellIds"][value="lesserrestoration"]');
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  for(const width of [1280,390,320]){
    await page.setViewport({width,height:900});
    const fits=await page.$eval('#modal',n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&n.scrollWidth<=n.clientWidth;});
    assert.ok(fits,`Level-up fits ${width}px`);await page.screenshot({path:resolve(root,`.tmp/level-up-${width}.png`)});
  }
  await submit();c=active(await state());assert.equal(c.level,5);assert.deepEqual(c.slots.slice(0,2).map(s=>s.max),[4,2]);
  for(const name of ['Lesser Restoration','Pass without Trace'])assert.ok(c.spells.some(s=>s.name===name),name);
  console.log('PASS new spell tier, selectable class spell, level-5 lineage magic, mobile layouts');
  await load(makeCharacter({class:'Sorcerer',level:2,skills:['Arcana','Deception']}));await open();await set('levelSubclass','Draconic Sorcery');
  assert.ok(await page.$('[name="spellIds"][value="scorchingray"]'));await page.click('[name="spellIds"][value="scorchingray"]');await submit();
  c=active(await state());assert.equal(c.level,3);assert.equal(c.subclass,'Draconic Sorcery');assert.ok(c.spells.some(s=>s.name==='Scorching Ray'));assert.ok(c.spells.some(s=>spellName(s.name)==='dragonsbreath'));
  console.log('PASS subclass selection refreshes features, spell lists and always-prepared spells');
  const wizard=makeCharacter({class:'Wizard',subclass:'Evoker',level:6,skills:['Arcana','History']});
  wizard.spells=SPELL_CATALOG.filter(s=>s.level===1&&s.classes.includes('Wizard')).slice(0,10).map(s=>({...s,prepared:true}));
  await load(wizard);await open();const savant=await page.$eval('[name="choice-savant"]',n=>n.options[1].value);await set('choice-savant',savant);
  for(const spell of SPELL_CATALOG.filter(s=>s.level===4&&s.classes.includes('Wizard')&&s.id!==savant).slice(0,2))await page.click(`[name="spellIds"][value="${spell.id}"]`);
  await submit();c=active(await state());assert.equal(c.level,7);assert.equal(c.spells.filter(s=>s.prepared).length,10);assert.equal(c.spells.length,13);
  console.log('PASS Wizard learns two spells plus Savant without preparing them');
  await load(makeCharacter({class:'Warlock',subclass:'Fiend Patron',level:10,skills:['Arcana','Deception']}));await open();
  const arcanum=await page.$eval('[name="arcanum"]',n=>n.options[1].value);await set('arcanum',arcanum);await submit();
  c=active(await state());assert.equal(c.level,11);assert.equal(c.slots[5].max,0);assert.ok(c.spells.some(s=>s.level===6&&s.origin==='Mystic Arcanum'));parseBackup(JSON.stringify(await state()));
  await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});await open();assert.ok(await page.$('[name="choice-feat"]'));
  assert.deepEqual(errors,[]);console.log('PASS Mystic Arcanum, Pact slots, offline level-up, no browser errors');
}finally{await browser?.close();server?.kill();}
function spellName(name){return name.toLowerCase().replace(/[^a-z]/g,'');}
