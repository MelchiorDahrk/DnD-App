import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import puppeteer from 'puppeteer-core';
import {findChromium} from '../../scripts/lib/chromium.mjs';

test('party access browser: old rules do not hide parties or claim membership was revoked',{timeout:120000},async()=>{
  const root=resolve(import.meta.dirname,'../..'),assetRoot=process.env.QUESTLOG_TEST_BUILD?resolve(root,process.env.QUESTLOG_TEST_BUILD):root,diagnostics=resolve(root,'.tmp/browser-diagnostics/party-access');
  const current=await readFile(resolve(root,'firestore.rules'),'utf8'),legacy=await readFile(resolve(root,'tests/fixtures/pre-party-play.rules'),'utf8');
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
  const server=http.createServer(async(req,res)=>{try{let path=resolve(assetRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==assetRoot&&!path.startsWith(assetRoot+sep))throw Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const url=`http://127.0.0.1:${server.address().port}/`;
  let rulesEnv=await initializeTestEnvironment({projectId:'demo-questlog',firestore:{rules:current}});
  const browser=await puppeteer.launch({executablePath:await findChromium(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage(),errors=[];let phase='setup';page.on('pageerror',error=>errors.push(error.message));
  const click=action=>page.locator(`[data-action="${action}"]`).click();
  const text=value=>page.waitForFunction(value=>document.body.innerText.includes(value),{},value);
  try{
    await page.evaluateOnNewDocument(()=>{window.QUESTLOG_FIREBASE_CONFIG={apiKey:'fake-key',projectId:'demo-questlog',appId:'emulator',authDomain:'demo-questlog.firebaseapp.com'};window.QUESTLOG_FIREBASE_EMULATORS={host:'127.0.0.1',auth:9099,firestore:8080};});
    await page.goto(url,{waitUntil:'networkidle0'});
    const existing=await page.evaluate(async()=>{const sdk=await import('./firebase-sdk/firebase.js'),{CloudStore}=await import('./cloud-store.js');const credential=await sdk.createUserWithEmailAndPassword(sdk.getAuth(),`access-${crypto.randomUUID()}@example.com`,'party-access-password');return new CloudStore({sdk,db:sdk.getFirestore()},credential.user.uid).createParty('The original party','Adventurer');});
    phase='legacy login';await rulesEnv.cleanup();rulesEnv=await initializeTestEnvironment({projectId:'demo-questlog',firestore:{rules:legacy}});
    await page.goto(url+'#party');await page.reload({waitUntil:'domcontentloaded'});
    await text('The original party');await page.waitForSelector('.party-connection-warning');
    assert.doesNotMatch(await page.$eval('#toasts',node=>node.textContent),/Party access ended|Cloud access is blocked/);
    phase='new party';await page.locator('[data-action="navigate"][data-route="party-manage"]').click();await click('cloud-create-party');await page.type('#modal [name="name"]','The new party');await page.locator('#modal button[type="submit"]').click();await page.waitForSelector('#modal:not([open])');await text('The new party');
    assert.doesNotMatch(await page.$eval('#toasts',node=>node.textContent),/Party access ended/);
    const ids=await page.evaluate(async()=>{const sdk=await import('./firebase-sdk/firebase.js');return (await sdk.getDocs(sdk.collection(sdk.getFirestore(),`users/${sdk.getAuth().currentUser.uid}/parties`))).docs.map(doc=>doc.id);});
    assert.equal(ids.length,2);assert.ok(ids.includes(existing),'The original party index survives the denied feature reads.');
    await page.locator(`[data-action="cloud-select-party"][data-id="${existing}"]`).click();await text('The original party');
    phase='publish and retry';await rulesEnv.cleanup();rulesEnv=await initializeTestEnvironment({projectId:'demo-questlog',firestore:{rules:current}});
    await page.locator('.party-connection-warning [data-action="cloud-retry"]').click();await page.waitForFunction(()=>!document.querySelector('.party-connection-warning'));
    await page.locator('[data-action="navigate"][data-route="party"]').click();await text('The original party');
    await page.evaluate(async id=>{const sdk=await import('./firebase-sdk/firebase.js'),{CloudStore}=await import('./cloud-store.js');await new CloudStore({sdk,db:sdk.getFirestore()},sdk.getAuth().currentUser.uid).activity(id,{kind:'condition',characterId:'test-character',name:'Adventurer',text:'session restored'});},existing);
    await text('session restored');assert.deepEqual(errors,[]);
  }catch(error){await mkdir(diagnostics,{recursive:true});await page.screenshot({path:resolve(diagnostics,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(diagnostics,'state.json'),JSON.stringify({phase,errors,body:await page.$eval('body',node=>node.innerText)},null,2));error.message+=`\nPhase: ${phase}`;throw error;}
  finally{await rulesEnv.cleanup();const restore=await initializeTestEnvironment({projectId:'demo-questlog',firestore:{rules:current}});await restore.cleanup();await browser.close();await new Promise(done=>server.close(done));}
});
