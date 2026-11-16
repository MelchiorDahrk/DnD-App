import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {findChromium} from '../../scripts/lib/chromium.mjs';
import {demoCharacter,uid} from '../../model.js';

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
  const errors=[];let alice,bob;
  const click=async(page,action)=>page.locator(`[data-action="${action}"]`).click();
  const fill=async(page,name,value)=>{await page.waitForSelector(`#modal[open] [name="${name}"]`);await page.type(`#modal [name="${name}"]`,value);};
  const waitText=(page,text)=>page.waitForFunction(text=>document.body.innerText.includes(text),{},text);
  async function open(name,{guest=false,disabled=false}={}){
    const context=await browser.createBrowserContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const c=demoCharacter();c.name=name;c.id=uid();
    await page.evaluateOnNewDocument((c,guest,disabled)=>{
      window.QUESTLOG_FIREBASE_CONFIG=disabled?null:{apiKey:'fake-key',projectId:'demo-questlog',appId:'emulator',authDomain:'demo-questlog.firebaseapp.com'};
      window.QUESTLOG_FIREBASE_EMULATORS={host:'127.0.0.1',auth:9099,firestore:8080};
      if(guest&&!localStorage.getItem('questlog.v2'))localStorage.setItem('questlog.v2',JSON.stringify({version:2,characters:[c],activeId:c.id,settings:{sound:false}}));
    },c,guest,disabled);
    await page.goto(url,{waitUntil:'domcontentloaded'});return {context,page,c};
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

    alice=await open('Alice Brick',{guest:true});bob=await open('Bob Brick');
    const aliceEmail=`alice-${uid()}@example.com`,bobEmail=`bob-${uid()}@example.com`;
    await alice.page.goto(url+'#settings');await signup(alice.page,aliceEmail);
    await click(alice.page,'cloud-upload');await click(alice.page,'cloud-upload-confirm');
    await alice.page.waitForFunction(()=>!document.querySelector('#modal').open);
    await waitText(alice.page,'Synced');
    await alice.page.goto(url+'#party');await click(alice.page,'cloud-create-party');await fill(alice.page,'name','Browser Fellowship');await alice.page.click('#modal button[type="submit"]');
    await waitText(alice.page,'Browser Fellowship');await click(alice.page,'cloud-invite');
    await alice.page.waitForSelector('#modal [name="link"]');const invite=await alice.page.$eval('#modal [name="link"]',el=>el.value);
    assert.ok(invite.includes('/Questlog/?invite='));await click(alice.page,'close');
    await signup(bob.page,bobEmail);await bob.page.goto(invite);await click(bob.page,'cloud-join-link');await waitText(bob.page,'Browser Fellowship');
    await click(alice.page,'cloud-share');await click(alice.page,'cloud-share-character');
    await waitText(bob.page,'Alice Brick');await bob.page.waitForFunction(()=>document.querySelector('.party-health')?.innerText.includes('24 / 28'));
    await alice.page.goto(url+'#sheet');await click(alice.page,'hp');await alice.page.$eval('#modal [name="amount"]',el=>el.value='12');await alice.page.click('[data-action="hp-apply"][data-kind="damage"]');
    await bob.page.waitForFunction(()=>document.querySelector('.party-health')?.innerText.includes('12 / 28'));
    await alice.page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await alice.page.setOfflineMode(true);
    await click(alice.page,'hp');await alice.page.$eval('#modal [name="amount"]',el=>el.value='2');await alice.page.click('[data-action="hp-apply"][data-kind="damage"]');
    await alice.page.reload({waitUntil:'load'});await waitText(alice.page,'Alice Brick');
    await alice.page.setOfflineMode(false);
    await bob.page.waitForFunction(()=>document.querySelector('.party-health')?.innerText.includes('10 / 28'));
    await click(bob.page,'cloud-view');await waitText(bob.page,'Strength');assert.equal(await bob.page.$('#modal [data-action="hp-apply"]'),null);await click(bob.page,'close');
    await alice.page.goto(url+'#settings');await click(alice.page,'cloud-signout');await waitText(alice.page,'Continue without an account');
    assert.equal(await alice.page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')).characters[0].hp),24,'guest original preserved');
    await click(alice.page,'cloud-email');await fill(alice.page,'email',bobEmail);await fill(alice.page,'password','sword-and-shield-123');await alice.page.click('#modal button[type="submit"]');
    await waitText(alice.page,bobEmail);assert.equal(await alice.page.evaluate(async()=>{const s=await import('./firebase-sdk/firebase.js');return JSON.parse(localStorage.getItem('questlog.v2.account.'+s.getAuth().currentUser.uid)||'{"characters":[]}').characters.length;}),0);
    await alice.page.reload({waitUntil:'domcontentloaded'});await waitText(alice.page,bobEmail);
    assert.equal(await alice.page.$('.character-switch'),null,'Bob cannot see Alice account sheets');
    assert.deepEqual(errors,[]);
  }catch(error){
    await mkdir(resolve(root,'.tmp/cloud-browser'),{recursive:true});
    for(const [name,instance] of [['alice',alice],['bob',bob]])if(instance)await instance.page.screenshot({path:resolve(root,`.tmp/cloud-browser/${name}.png`),fullPage:true}).catch(()=>{});
    error.message+=`\nBrowser errors: ${errors.join('; ')}`;throw error;
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
