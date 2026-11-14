import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {makeCharacter,parseBackup} from '../model.js';
import {initialState} from '../default-characters.js';
import {WEAPONS,attackFromWeapon} from '../catalog.js';
import {SOUND_FILES} from '../sound-assets.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.SOUND_TEST_PORT||'4196';
const base=process.env.SOUND_TEST_URL||`http://127.0.0.1:${port}${process.env.SOUND_TEST_PATH||'/dist/'}`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to an installed browser.');
// Assert production copies, not just references in the build script.
const manifest=JSON.parse(await readFile(resolve(root,'assets/sfx/manifest.json'),'utf8'));
for(const path of ['sound.js','sound-assets.js','sound-events.js','assets/sfx/manifest.json','assets/sfx/CREDITS.md',...SOUND_FILES])assert.deepEqual(await readFile(resolve(root,'dist',path)),await readFile(resolve(root,path)),`Production copy: ${path}`);
assert.equal(createHash('sha256').update(await readFile(resolve(root,'dist/assets/sfx/manifest.json'))).digest('hex'),createHash('sha256').update(await readFile(resolve(root,'assets/sfx/manifest.json'))).digest('hex'));
let server,browser;
try{
  if(!process.env.SOUND_TEST_URL){
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));});
  }
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[],thirdPartyAudio=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/\.(ogg|mp3)(\?|$)/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)thirdPartyAudio.push(request.url());});
  await page.evaluateOnNewDocument(()=>{
    window.audioMetrics={contexts:0,starts:0};
    const Native=window.AudioContext;
    window.AudioContext=class extends Native{
      constructor(...args){super(...args);window.audioMetrics.contexts++;window.audioContextForTest=this;}
      createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(...args)=>{window.audioMetrics.starts++;return start(...args);};return source;}
    };
  });
  await page.setViewport({width:1280,height:1000});await page.goto(base,{waitUntil:'networkidle0'});
  const c=makeCharacter({name:'Sound test adventurer',class:'Fighter',subclass:'Champion',level:4,hitDice:4,hp:5,maxHp:30,skills:['Athletics','Perception'],stats:{str:16,dex:16,con:14,int:12,wis:12,cha:10},weaponProficiencies:'Simple and Martial weapons'});
  c.attacks=['Longsword','Longbow','Dagger','Mace','Greatsword'].map(name=>{const w=WEAPONS.find(w=>w.name===name);return {id:w.id,...attackFromWeapon(w,c)};});
  c.items=[{id:'potion',name:'Potion of Healing',category:'Consumable',qty:2,weight:.5,equipped:false,description:'',wiki:''}];
  c.spells=['Fireball','Ray of Frost','Lightning Bolt','Sacred Flame','Chill Touch','Cure Wounds','Shield','A custom spell'].map((name,i)=>({id:'spell-'+i,name,level:0,school:i===6?'Abjuration':'Evocation',castingTime:'Action',range:'60 ft.',duration:'Instantaneous',notes:'',wiki:'',prepared:true,concentration:false}));
  const state={...initialState(),characters:[c],activeId:c.id};parseBackup(JSON.stringify(state));
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),state);await page.reload({waitUntil:'networkidle0'});
  async function instrument(){await page.evaluate(async()=>{const {sound}=await import(new URL('./sound.js',location.href));window.soundForTest=sound;window.soundCalls=[];const play=sound.play;sound.play=async(name,options)=>{const call={name,result:null};window.soundCalls.push(call);call.result=await play(name,options);return call.result;};const native=crypto.getRandomValues.bind(crypto);window.testDice=[];crypto.getRandomValues=array=>{if(window.testDice.length){array[0]=window.testDice.shift()-1;return array;}return native(array);};});}
  await instrument();
  const dice=values=>page.evaluate(values=>window.testDice=[...values],values);
  const mark=()=>page.evaluate(()=>window.soundCalls.length);
  const played=(event,after)=>page.waitForFunction((event,after)=>window.soundCalls.slice(after).some(c=>c.name===event&&c.result===true),{timeout:10000},event,after).catch(async error=>{throw Error(`${event}: ${JSON.stringify(await page.evaluate(after=>({calls:window.soundCalls.slice(after),audio:window.soundForTest.diagnostics(),title:document.querySelector('#modal-title')?.textContent,invalid:[...document.querySelectorAll('#modal :invalid')].map(n=>({name:n.name,message:n.validationMessage}))}),after))}`,{cause:error});});
  const navigate=route=>page.click(`[data-action="navigate"][data-route="${route}"]`);
  const close=async()=>{if(await page.$eval('#modal',n=>n.open))await page.click('#modal [data-action="close"],#modal [data-combat-action="close"]');};
  const submit=()=>page.click('#modal button[type="submit"]');
  const clearAudio=()=>page.evaluate(()=>window.soundForTest.stopAll());
  const action=async(event,callback)=>{await new Promise(resolve=>setTimeout(resolve,250));const after=await mark();await callback();const error=await page.$eval('#form-error',n=>n.hidden?'':n.textContent).catch(()=>'');assert.equal(error,'',`${event}: ${error}`);await played(event,after);};
  const adjustHP=async(amount,kind='damage')=>{await page.click('[data-action="hp"]');await page.$eval('#modal [name="amount"]',(n,amount)=>n.value=String(amount),amount);await page.click(`[data-action="hp-apply"][data-kind="${kind}"]`);};

  await navigate('dice');assert.equal(await mark(),0,'Opening dice does not request a sound');
  await dice([12]);await page.click('#dice-form button[type="submit"]');assert.equal(await page.evaluate(()=>window.audioMetrics.contexts),0,'Disabled gameplay allocates no audio');
  await navigate('settings');await action('ui.confirm',()=>page.click('[data-action="sound"]'));
  await page.$eval('[data-audio-volume="master"]',n=>{n.value='37';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.$eval('[data-audio-volume="magic"]',n=>{n.value='72';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.reload({waitUntil:'networkidle0'});await instrument();
  assert.equal(await page.$eval('[data-audio-volume="master"]',n=>n.value),'37');
  assert.equal(await page.$eval('[data-audio-volume="magic"]',n=>n.value),'72');
  assert.equal(await page.$eval('[data-action="sound"]',n=>n.getAttribute('aria-checked')),'true');
  await action('dice.roll',()=>page.click('[data-action="sound-preview"]'));
  await navigate('dice');await dice([20]);await action('dice.critical',()=>page.click('#dice-form button[type="submit"]'));
  await dice([1]);await action('dice.failure',()=>page.click('#dice-form button[type="submit"]'));
  assert.equal(await page.evaluate(()=>window.audioMetrics.contexts),1,'All gameplay shares one context');
  console.log('PASS disabled/default, gesture unlock, actual rolls, critical/failure, single context, volume persistence');

  // Every bundled encoding is decoded by the real browser and checked for non-silence/onset.
  const decoded=await page.evaluate(async assets=>{
    const results=[];
    for(const asset of assets)for(const [format,path] of Object.entries(asset.files)){
      const response=await fetch(new URL(path,location.href));if(!response.ok)throw Error(path);
      const buffer=await window.audioContextForTest.decodeAudioData(await response.arrayBuffer());
      const samples=buffer.getChannelData(0);let energy=0,first=-1;
      for(let i=0;i<samples.length;i++){energy+=samples[i]*samples[i];if(first<0&&Math.abs(samples[i])>.008)first=i/buffer.sampleRate;}
      results.push({id:asset.id,format,duration:buffer.duration,rms:Math.sqrt(energy/samples.length),onset:first});
    }
    return results;
  },manifest.assets);
  for(const r of decoded){assert.ok(r.duration>0&&r.duration<15,JSON.stringify(r));assert.ok(r.rms>.0003,`Silent: ${JSON.stringify(r)}`);assert.ok(r.onset>=0&&r.onset<.3,`Delayed onset: ${JSON.stringify(r)}`);}
  assert.equal(decoded.length,SOUND_FILES.length);console.log(`PASS ${manifest.assets.length} effects × OGG/MP3 real decoding, non-silence and responsive onset`);

  await navigate('sheet');await clearAudio();
  const attack=(id,event,roll=12)=>action(event,async()=>{await page.click(`[data-action="attack-roll"][data-id="${id}"]`);await dice([roll]);await page.click('#modal [data-combat-action="roll"]');});
  const sword=c.attacks[0];await attack(sword.id,'combat.sword');
  assert.equal(await page.$('.combat-outcome'),null,'Unknown target AC needs hit confirmation');
  assert.equal(await page.evaluate(()=>window.soundCalls.some(c=>c.name==='combat.hit')),false,'Unknown outcome has no impact sound');
  await action('combat.hit',()=>page.click('#modal [data-combat-action="hit"]'));await close();
  await attack(c.attacks[1].id,'combat.bow');await action('combat.miss',()=>page.click('#modal [data-combat-action="miss"]'));await close();
  await attack(c.attacks[2].id,'combat.dagger');await close();
  await attack(c.attacks[4].id,'combat.heavy',20);await played('combat.critical',0);await close();
  await attack(c.attacks[3].id,'combat.sword');await action('combat.blunt',()=>page.click('#modal [data-combat-action="hit"]'));await close();
  console.log('PASS weapon families, unknown hit outcome, manual hits/misses and critical impacts');

  await navigate('spells');
  for(const [index,event] of ['magic.fire','magic.ice','magic.lightning','magic.radiant','magic.dark','magic.heal','magic.protect','magic.cast'].entries()){
    await clearAudio();await action(event,async()=>{await page.click(`[data-action="cast"][data-id="spell-${index}"]`);await submit();});
  }
  await navigate('sheet');
  await action('magic.heal',async()=>{await page.click('[data-action="hp"]');await page.$eval('[name="amount"]',n=>n.value='3');await page.click('[data-action="hp-apply"][data-kind="heal"]');});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  assert.equal((await saved()).characters[0].hp,8);
  await navigate('inventory');await dice([2,2]);
  const potionAfter=await mark();
  await action('item.potion',async()=>{await page.click('[data-action="use-item"][data-id="potion"]');await page.click('[data-action="confirm-use-item"]');});
  await played('magic.heal',potionAfter);assert.equal((await saved()).characters[0].hp,14);await close();
  console.log('PASS spell categories/custom fallback, HP increases, potion handling and restoration');

  await navigate('sheet');await clearAudio();
  await page.click('[data-action="rest"][data-kind="long"]');
  await page.waitForFunction(()=>window.soundForTest.diagnostics().voices>0);
  await close();await page.waitForFunction(()=>window.soundForTest.diagnostics().voices===0);
  await page.click('[data-action="rest"][data-kind="long"]');await action('rest.long',submit);await close();
  await page.click('[data-action="rest"][data-kind="short"]');await action('rest.short',submit);await close();
  // No healing cue when a player attempts to heal already full HP.
  const beforeNoop=await mark();await page.click('[data-action="hp"]');await page.click('[data-action="hp-apply"][data-kind="heal"]');
  assert.equal(await page.evaluate(after=>window.soundCalls.slice(after).some(c=>c.name==='magic.heal'),beforeNoop),false);
  await clearAudio();await page.click('[data-action="level-up"]');
  const beforeInvalid=await mark();await page.$eval('[name="hpGain"]',n=>n.value='0');await submit();
  assert.equal(await mark(),beforeInvalid,'Invalid level-up has no fanfare');
  await page.$eval('[name="hpGain"]',n=>n.value='8');await action('progression.level',submit);
  assert.equal((await saved()).characters[0].level,5);assert.ok(await page.$('.vfx-level'));await close();
  parseBackup(JSON.stringify(await saved()));
  console.log('PASS rest ambience/cancel/completion, no-op healing, successful level-up/VFX and version 2 backup');

  // Taking damage is an action even at 0 HP; its audio must not depend on a VFX delta.
  const damage=async amount=>{
    const after=await mark();await action('combat.damage',()=>adjustHP(amount));
    assert.equal(await page.evaluate(after=>window.soundCalls.slice(after).filter(c=>c.name==='combat.damage').length,after),1,'One damage cue per action');
  };
  const fullHP=(await saved()).characters[0].hp;
  await damage(2);assert.equal((await saved()).characters[0].hp,fullHP-2);
  await action('magic.protect',()=>adjustHP(3,'temp'));
  await damage(2);assert.equal((await saved()).characters[0].tempHp,1);assert.equal((await saved()).characters[0].hp,fullHP-2);
  await damage(3);assert.equal((await saved()).characters[0].tempHp,0);assert.equal((await saved()).characters[0].hp,fullHP-4);
  await damage(9999);assert.equal((await saved()).characters[0].hp,0);
  await damage(2);assert.equal((await saved()).characters[0].hp,0);
  const beforeZero=await mark();await adjustHP(0);assert.equal(await mark(),beforeZero,'Zero damage is silent');
  await page.setViewport({width:390,height:844});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await damage(1);
  await page.setViewport({width:1280,height:1000});await page.emulateMediaFeatures([]);
  console.log('PASS damage to HP, temporary HP, overflow, 0 HP, zero amount and reduced-motion mobile playback');

  await navigate('settings');
  await page.select('#sound-preview-event','combat.damage');await action('combat.damage',()=>page.click('[data-action="sound-preview"]'));
  await page.select('#sound-preview-event','dice.roll');
  await page.evaluate(()=>{document.querySelector('#toasts').replaceChildren();document.querySelector('.sound-settings details').open=true;});
  for(const width of [390,320]){
    await page.setViewport({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}px settings fits`);
    await mkdir(resolve(root,'.tmp'),{recursive:true});await page.screenshot({path:resolve(root,`.tmp/sound-settings-${width}.png`)});
  }
  await page.setViewport({width:1280,height:1000});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const cached=await page.evaluate(async paths=>{const cacheNames=await caches.keys();const cache=await caches.open(cacheNames.find(n=>n.startsWith('questlog-app-')));return Promise.all(paths.map(async path=>!!await cache.match(new URL(path,location.href))));},SOUND_FILES);
  assert.ok(cached.every(Boolean),'Both encodings of the entire sound set are precached');
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});await instrument();
  await action('dice.roll',()=>page.click('[data-action="sound-preview"]'));
  await navigate('dice');await dice([12]);await action('dice.roll',()=>page.click('#dice-form button[type="submit"]'));
  await navigate('sheet');await action('combat.damage',()=>adjustHP(1));
  await navigate('settings');await page.click('[data-action="sound"]');
  assert.equal(await page.evaluate(()=>window.soundForTest.diagnostics().voices),0,'Mute stops active playback');
  const starts=await page.evaluate(()=>window.audioMetrics.starts);await navigate('dice');await page.click('#dice-form button[type="submit"]');
  await navigate('sheet');await adjustHP(1);
  assert.equal(await page.evaluate(()=>window.audioMetrics.starts),starts,'Muted offline gameplay stays silent');
  assert.deepEqual(errors,[]);assert.deepEqual(thirdPartyAudio,[]);
  console.log('PASS production build copies, /dist/ hosting, 320/390px settings, full offline cache/playback, mute and no external audio');
}finally{await browser?.close();server?.kill();}
