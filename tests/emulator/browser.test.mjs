import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {findChromium} from '../../scripts/lib/chromium.mjs';
import {demoCharacter,uid} from '../../model.js';
import {fillLevelOne,nextBuilderStep} from '../helpers/character-builder.mjs';

test('browser: guest/offline, account isolation, subdirectory assets and two-account live parties',{timeout:180000},async()=>{
  const root=resolve(import.meta.dirname,'../..'),assetRoot=process.env.QUESTLOG_TEST_BUILD?resolve(root,process.env.QUESTLOG_TEST_BUILD):root,mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
  const server=http.createServer(async(req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/Questlog/,'');let file=resolve(assetRoot,'.'+path);
      if(!file.startsWith(assetRoot+sep)&&file!==assetRoot)throw new Error('outside root');
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/Questlog/`;
  const browser=await puppeteer.launch({executablePath:await findChromium(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[],messages=[];let alice,bob,phase='guest offline';
  const click=async(page,action)=>page.locator(`[data-action="${action}"]`).click();
  const fill=async(page,name,value)=>{await page.waitForSelector(`#modal[open] [name="${name}"]`);await page.type(`#modal [name="${name}"]`,value);};
  const waitText=(page,text)=>page.waitForFunction(text=>document.body.innerText.includes(text),{},text);
  async function open(name,{guest=false,disabled=false,holdSyncLock=false}={}){
    const context=await browser.createBrowserContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>messages.push(`${name}: ${message.type()}: ${message.text()}`));
    const c=demoCharacter();c.name=name;c.id=uid();
    await page.evaluateOnNewDocument((c,guest,disabled,holdSyncLock)=>{
      window.QUESTLOG_FIREBASE_CONFIG=disabled?null:{apiKey:'fake-key',projectId:'demo-questlog',appId:'emulator',authDomain:'demo-questlog.firebaseapp.com'};
      window.QUESTLOG_FIREBASE_EMULATORS={host:'127.0.0.1',auth:9099,firestore:8080};
      if(holdSyncLock&&!sessionStorage.getItem('questlog.test.sync-lock-held')){
        const request=navigator.locks.request.bind(navigator.locks);let held=false;
        navigator.locks.request=async(name,...args)=>{
          const result=await request(name,...args);
          if(name.startsWith('questlog-sync-')&&!held){held=true;sessionStorage.setItem('questlog.test.sync-lock-held','1');await new Promise(resolve=>window.releaseSyncLock=resolve);}
          return result;
        };
      }
      if(guest&&!localStorage.getItem('questlog.v2'))localStorage.setItem('questlog.v2',JSON.stringify({version:2,characters:[c],activeId:c.id,settings:{sound:false}}));
    },c,guest,disabled,holdSyncLock);
    await page.goto(url,{waitUntil:'networkidle0'});
    if(!disabled)await page.waitForFunction(async()=>{
      const sdk=await import('./firebase-sdk/firebase.js');
      try {await sdk.getAuth().authStateReady();return true;}
      catch {return false;}
    });
    return {context,page,c};
  }
  async function signup(page,email){
    await click(page,'cloud-signup');await fill(page,'email',email);await fill(page,'password','sword-and-shield-123');await page.click('#modal button[type="submit"]');
    await page.waitForFunction(()=>!document.querySelector('#modal').open);await waitText(page,email);
  }
  try{
    // A configured Firebase project is never required for existing guest sheets.
    const offline=await open('Offline Guest',{guest:true,disabled:true});
    await waitText(offline.page,'Offline Guest');await offline.page.goto(url+'#settings');await waitText(offline.page,'Account');
    await offline.page.waitForFunction(async()=>!!(await navigator.serviceWorker.ready).active);
    await offline.page.reload({waitUntil:'domcontentloaded'});
    await offline.page.setOfflineMode(true);await offline.page.reload({waitUntil:'load'});await waitText(offline.page,'Account');
    await offline.page.setOfflineMode(false);await offline.context.close();

    phase='sign up';alice=await open('Alice Brick',{guest:true,holdSyncLock:true});bob=await open('Bob Brick');
    const aliceEmail=`alice-${uid()}@example.com`,bobEmail=`bob-${uid()}@example.com`;
    await click(alice.page,'characters');
    assert.ok(await alice.page.$('#modal [data-action="cloud-signup"]'),'Create an account is available from the character menu.');
    assert.ok(await alice.page.$('#modal [data-action="cloud-email"]'),'Sign in is available from the character menu.');
    await signup(alice.page,aliceEmail);
    await alice.page.goto(url+'#settings');
    phase='upload guest';await click(alice.page,'cloud-upload');await click(alice.page,'cloud-upload-confirm');
    await alice.page.waitForFunction(()=>!document.querySelector('#modal').open);
    // The first empty sync has finished its callback but still holds its request
    // promise. Let the queued upload's timer fire before releasing that promise.
    await alice.page.waitForFunction(()=>typeof window.releaseSyncLock==='function'&&document.querySelector('[data-cloud-status]')?.textContent.startsWith('Pending'));
    await alice.page.evaluate(async()=>{await new Promise(resolve=>setTimeout(resolve,0));window.releaseSyncLock();});
    await alice.page.waitForFunction(()=>document.querySelector('[data-cloud-status]')?.textContent==='Synced');
    const uploaded=await alice.page.evaluate(async id=>{const s=await import('./firebase-sdk/firebase.js'),{CloudStore}=await import('./cloud-store.js');return new CloudStore({sdk:s,db:s.getFirestore()},s.getAuth().currentUser.uid).readCharacter(id);},alice.c.id);
    assert.equal(uploaded?.character.name,'Alice Brick','Synced means the guest character reached the server.');
    await alice.page.locator('#topbar [data-action="characters"]').click();
    assert.ok(await alice.page.$('#modal [data-action="cloud-upload"]'),'Account characters can access guest transfer from the character menu.');
    assert.match(await alice.page.$eval('#modal .character-menu-account',el=>el.innerText),new RegExp(aliceEmail));
    assert.equal(await alice.page.$('#modal [data-action="cloud-signup"]'),null,'Signed-in accounts show their account details.');
    await alice.page.click('#modal [data-action="navigate"][data-route="settings"]');
    await alice.page.waitForFunction(()=>!document.querySelector('#modal').open);
    phase='create party';await alice.page.goto(url+'#party');await click(alice.page,'cloud-create-party');await fill(alice.page,'name','Browser Fellowship');await alice.page.click('#modal button[type="submit"]');
    await waitText(alice.page,'Browser Fellowship');
    await alice.page.goto(url+'#party-manage');await click(alice.page,'cloud-edit-party');await alice.page.waitForSelector('.party-members');
    assert.doesNotMatch(await alice.page.$eval('#toasts',el=>el.textContent),/Party access ended/i,'Creating the first party must not report lost access.');
    assert.match(await alice.page.$eval('.party-members',el=>el.textContent),/You/);
    assert.doesNotMatch(await alice.page.$eval('.party-members',el=>el.textContent),new RegExp(aliceEmail),'The party roster hides the account identity.');
    await click(alice.page,'cloud-invite');
    await alice.page.waitForSelector('#modal [name="link"]');const invite=await alice.page.$eval('#modal [name="link"]',el=>el.value);
    await alice.context.overridePermissions(url,['clipboard-read','clipboard-write']);
    await alice.page.setViewport({width:390,height:844});await click(alice.page,'cloud-copy-invite');
    await waitText(alice.page,'Invitation link copied.');
    assert.equal(await alice.page.evaluate(()=>navigator.clipboard.readText()),invite,'The mobile copy button writes the complete invitation URL.');
    await alice.page.setViewport({width:800,height:600});
    assert.ok(invite.includes('/Questlog/?invite='));await click(alice.page,'close');
    phase='join party';await signup(bob.page,bobEmail);await bob.page.goto(invite);await click(bob.page,'cloud-join-link');await waitText(bob.page,'Browser Fellowship');
    await alice.page.$eval('#main details',el=>el.open=true);await click(alice.page,'cloud-revoke');
    await alice.page.waitForFunction(()=>!document.querySelector('[data-action="cloud-revoke"]'));
    assert.equal(await alice.page.$$eval('#main details',els=>els.filter(el=>el.textContent.includes('Manage invitations')).length),0,'Revoked invitations disappear from the list.');
    phase='share character';await click(alice.page,'cloud-share');await click(alice.page,'cloud-share-character');
    await alice.page.waitForSelector('#modal:not([open])');
    await alice.page.waitForSelector('.party-shared-members');assert.equal(await alice.page.$('.party-character'),null);
    assert.match(await alice.page.$eval('#main',el=>el.textContent),/Alice Brick/,'Sharing refreshes the sender’s party without a reload');
    await alice.page.goto(url+'#party');await alice.page.waitForSelector('.party-player');
    await waitText(bob.page,'Alice Brick');await bob.page.waitForFunction(()=>document.querySelector('.party-player-top strong')?.textContent==='24');
    phase='live damage';await alice.page.goto(url+'#sheet');await click(alice.page,'hp');await alice.page.$eval('#modal [name="amount"]',el=>el.value='12');await alice.page.click('[data-action="hp-apply"][data-kind="damage"]');
    await bob.page.waitForFunction(()=>document.querySelector('.party-player-top strong')?.textContent==='12');
    await alice.page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    phase='offline replay';await alice.page.setOfflineMode(true);
    await click(alice.page,'hp');await alice.page.$eval('#modal [name="amount"]',el=>el.value='2');await alice.page.click('[data-action="hp-apply"][data-kind="damage"]');
    await alice.page.reload({waitUntil:'load'});await waitText(alice.page,'Alice Brick');
    await alice.page.setOfflineMode(false);
    await bob.page.waitForFunction(()=>document.querySelector('.party-player-top strong')?.textContent==='10');
    phase='shared sheet';assert.ok(await bob.page.$eval('.party-player',n=>n.getBoundingClientRect().width>200),'A party viewer without a local character still gets a full-width card');await bob.page.locator('.party-portrait-button').click();await click(bob.page,'cloud-view');await waitText(bob.page,'Strength');assert.equal(await bob.page.$('#modal [data-action="hp-apply"]'),null);await click(bob.page,'close');
    phase='offline character creation and account sync';
    await alice.page.setOfflineMode(true);
    await alice.page.locator('#topbar [data-action="characters"]').click();
    await alice.page.click('#modal [data-action="new-character"]');
    await fillLevelOne(alice.page,{name:'Ember Ward',className:'Warlock',species:'Human',background:'Acolyte'});
    await nextBuilderStep(alice.page);
    await alice.page.waitForSelector('#modal:not([open])');
    const created=await alice.page.evaluate(async()=>{
      const s=await import('./firebase-sdk/firebase.js');
      return JSON.parse(localStorage.getItem('questlog.v2.account.'+s.getAuth().currentUser.uid)).characters.find(c=>c.name==='Ember Ward');
    });
    assert.equal(created.pactMagic,true);
    assert.ok(created.spells.some(spell=>spell.castingGrants?.length));
    await alice.page.reload({waitUntil:'load'});await waitText(alice.page,'Ember Ward');
    await alice.page.setOfflineMode(false);
    await alice.page.goto(url+'#settings');
    await alice.page.waitForFunction(()=>document.querySelector('[data-cloud-status]')?.textContent==='Synced');
    const cloudCreated=await alice.page.evaluate(async id=>{
      const s=await import('./firebase-sdk/firebase.js'),{CloudStore}=await import('./cloud-store.js');
      return new CloudStore({sdk:s,db:s.getFirestore()},s.getAuth().currentUser.uid).readCharacter(id);
    },created.id);
    assert.deepEqual(cloudCreated.character,created);
    assert.doesNotMatch(await bob.page.$eval('#main',el=>el.textContent),/Ember Ward/,'Creating a character does not share it with the party.');
    phase='account isolation';await alice.page.goto(url+'#settings');await click(alice.page,'cloud-signout');await waitText(alice.page,'Continue without an account');
    assert.equal(await alice.page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')).characters[0].hp),24,'guest original preserved');
    await click(alice.page,'cloud-email');await fill(alice.page,'email',bobEmail);await fill(alice.page,'password','sword-and-shield-123');await alice.page.click('#modal button[type="submit"]');
    await waitText(alice.page,bobEmail);assert.equal(await alice.page.evaluate(async()=>{const s=await import('./firebase-sdk/firebase.js');return JSON.parse(localStorage.getItem('questlog.v2.account.'+s.getAuth().currentUser.uid)||'{"characters":[]}').characters.length;}),0);
    await alice.page.reload({waitUntil:'domcontentloaded'});await waitText(alice.page,bobEmail);
    assert.equal(await alice.page.$('.character-switch'),null,'Bob cannot see Alice account sheets');
    assert.deepEqual(errors,[]);
  }catch(error){
    const diagnostics=resolve(root,'.tmp/browser-diagnostics/firebase');await mkdir(diagnostics,{recursive:true});
    const states={};
    for(const [name,instance] of [['alice',alice],['bob',bob]])if(instance){
      states[name]=await instance.page.evaluate(()=>({url:location.href,status:document.querySelector('[data-cloud-status]')?.textContent,message:document.querySelector('[data-cloud-message]')?.textContent,body:document.body.innerText,queue:Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('questlog.cloud.')))})).catch(()=>null);
      const html=await instance.page.content().catch(()=>null);if(html)await writeFile(resolve(diagnostics,`${name}.html`),html).catch(()=>{});
      await instance.page.screenshot({path:resolve(diagnostics,`${name}.png`),fullPage:true}).catch(()=>{});
    }
    await writeFile(resolve(diagnostics,'state.json'),JSON.stringify({phase,errors,messages,states},null,2)).catch(()=>{});
    const summary=Object.fromEntries(Object.entries(states).map(([name,state])=>[name,state&&{status:state.status,message:state.message,queued:Object.keys(state.queue).length}]));
    error.message+=`\nPhase: ${phase}\nCloud state: ${JSON.stringify(summary)}\nBrowser errors: ${errors.join('; ')}`;throw error;
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
