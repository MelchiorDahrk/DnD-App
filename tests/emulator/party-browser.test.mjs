import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import puppeteer from 'puppeteer-core';
import {findChromium} from '../../scripts/lib/chromium.mjs';
import {demoCharacter,uid} from '../../model.js';
import {linkWeaponActions} from '../../inventory.js';

test('party browser: table layout, shared rolls, initiative, transfers, rest votes and session navigation',{timeout:180000},async()=>{
  const root=resolve(import.meta.dirname,'../..'),assetRoot=process.env.QUESTLOG_TEST_BUILD?resolve(root,process.env.QUESTLOG_TEST_BUILD):root,diagnostics=resolve(root,'.tmp/browser-diagnostics/party');
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
  const server=http.createServer(async(req,res)=>{try{let path=resolve(assetRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==assetRoot&&!path.startsWith(assetRoot+sep))throw Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const url=`http://127.0.0.1:${server.address().port}/`;
  const browser=await puppeteer.launch({executablePath:await findChromium(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[],messages=[],instances=[];let alice,bob,phase='setup';await mkdir(diagnostics,{recursive:true});
  // Party snapshots replace cards between resolving a selector and scrolling it
  // into view. Locators re-resolve detached controls before dispatching a click.
  const press=(page,selector)=>page.locator(selector).click();
  const click=(page,action)=>press(page,action==='close'?'#modal[open] .modal-header [data-action="close"]':`[data-action="${action}"]`);
  const submit=page=>press(page,'#modal button[type="submit"]');
  const text=(page,value)=>page.waitForFunction(value=>document.body.innerText.includes(value),{},value);
  const fill=(page,name,value)=>page.$eval(`#modal [name="${name}"]`,(el,value)=>el.value=value,value);
  const closed=page=>page.waitForSelector('#modal:not([open])');
  const accountState=page=>page.evaluate(async()=>{const s=await import('./firebase-sdk/firebase.js');return JSON.parse(localStorage.getItem('questlog.v2.account.'+s.getAuth().currentUser.uid));});
  const waitForValue=(page,characterId,key,expected)=>page.waitForFunction(async(characterId,key,expected)=>{const sdk=await import('./firebase-sdk/firebase.js');return JSON.parse(localStorage.getItem('questlog.v2.account.'+sdk.getAuth().currentUser.uid)).characters.find(c=>c.id===characterId)?.[key]===expected;},{},characterId,key,expected);
  const waitForQuantity=(page,characterId,itemId,expected)=>page.waitForFunction(async(characterId,itemId,expected)=>{const sdk=await import('./firebase-sdk/firebase.js');return JSON.parse(localStorage.getItem('questlog.v2.account.'+sdk.getAuth().currentUser.uid)).characters.find(c=>c.id===characterId)?.items.find(i=>i.id===itemId)?.qty===expected;},{},characterId,itemId,expected);
  async function open(name,characters){
    const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:1440,height:1100});page.on('pageerror',error=>errors.push(error.message));
    const instance={name,context,page,characters};instances.push(instance);page.on('console',message=>messages.push(`${name}: ${message.type()}: ${message.text()}`));
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    await page.evaluateOnNewDocument(()=>{window.QUESTLOG_FIREBASE_CONFIG={apiKey:'fake-key',projectId:'demo-questlog',appId:'emulator',authDomain:'demo-questlog.firebaseapp.com'};window.QUESTLOG_FIREBASE_EMULATORS={host:'127.0.0.1',auth:9099,firestore:8080};});
    await page.goto(url,{waitUntil:'networkidle0'});
    const uid=await page.evaluate(async(name,characters)=>{const sdk=await import('./firebase-sdk/firebase.js'),{CloudStore}=await import('./cloud-store.js');const credential=await sdk.createUserWithEmailAndPassword(sdk.getAuth(),`${name}-${crypto.randomUUID()}@example.com`,'party-test-password');const store=new CloudStore({sdk,db:sdk.getFirestore()},credential.user.uid);for(const c of characters)await store.apply(c.id,{id:crypto.randomUUID(),create:c});return credential.user.uid;},name,characters);
    await text(page,characters[0].name);await page.goto(url+'#party');return Object.assign(instance,{uid});
  }
  async function storeCall(instance,method,args){return instance.page.evaluate(async(method,args)=>{const sdk=await import('./firebase-sdk/firebase.js'),{CloudStore}=await import('./cloud-store.js');return new CloudStore({sdk,db:sdk.getFirestore()},sdk.getAuth().currentUser.uid)[method](...args);},method,args);}
  try{
    const make=(name,id)=>{const c=demoCharacter();c.name=name;c.id=id;linkWeaponActions(c);return c;};
    const a=make('Melchior','alice-main'),a2=make('Teyla','alice-second'),a3=make('Balin','alice-third'),b=make('Jane','bob-main');
    alice=await open('alice',[a,a2,a3]);bob=await open('bob',[b]);
    const party=await storeCall(alice,'createParty',['The Brick Fellowship','Alice']),invite=await storeCall(alice,'invite',[party]);await storeCall(bob,'join',[invite,'Bob']);
    for(const c of [a,a2,a3])await storeCall(alice,'share',[party,c]);await storeCall(bob,'share',[party,b]);
    await Promise.all([alice,bob].map(({page})=>page.waitForFunction(()=>document.querySelectorAll('.party-player').length===4)));
    phase='balanced cards';
    assert.deepEqual(await bob.page.$$eval('.party-player-row',rows=>rows.map(r=>r.children.length)),[2,2]);
    const widths=await bob.page.$$eval('.party-player',cards=>cards.map(c=>c.getBoundingClientRect().width));assert.ok(Math.max(...widths)-Math.min(...widths)<1);
    await bob.page.screenshot({path:resolve(diagnostics,'party-four-desktop.png'),fullPage:true});
    await storeCall(alice,'unshare',[party,a3.id]);await bob.page.waitForFunction(()=>document.querySelectorAll('.party-player').length===3);
    assert.deepEqual(await bob.page.$$eval('.party-player-row',rows=>rows.map(r=>r.children.length)),[3]);
    await bob.page.screenshot({path:resolve(diagnostics,'party-three-desktop.png'),fullPage:true});
    await storeCall(alice,'unshare',[party,a2.id]);await bob.page.waitForFunction(()=>document.querySelectorAll('.party-player').length===2);
    assert.ok(Math.abs((await bob.page.$eval('.party-player',c=>c.getBoundingClientRect().width))-widths[0])<1,'Two members retain the three-column card width.');
    await storeCall(bob,'unshare',[party,b.id]);await bob.page.waitForFunction(()=>document.querySelectorAll('.party-player').length===1);
    assert.ok(await bob.page.$eval('.party-player-row',row=>{const card=row.firstElementChild.getBoundingClientRect(),bounds=row.getBoundingClientRect();return Math.abs((card.left+card.right)/2-(bounds.left+bounds.right)/2)<1;}),'A single member is centered.');
    assert.ok(Math.abs((await bob.page.$eval('.party-player',c=>c.getBoundingClientRect().width))-widths[0])<1,'One member retains the three-column card width.');
    await storeCall(alice,'share',[party,a2]);await storeCall(bob,'share',[party,b]);await bob.page.waitForFunction(()=>document.querySelectorAll('.party-player').length===3);
    await bob.page.setViewport({width:390,height:844});assert.equal(await bob.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await bob.page.screenshot({path:resolve(diagnostics,'party-mobile.png'),fullPage:true});await bob.page.setViewport({width:1440,height:1100});
    phase='initiative';
    assert.equal(await bob.page.$('[data-action="party-initiative"]'),null,'Initiative waits for an encounter.');
    await bob.page.goto(url+'#inventory');await click(alice.page,'party-start-combat');
    await Promise.all([alice,bob].map(({page})=>page.waitForSelector('#modal[open] [data-initiative-method]')));
    assert.match(await bob.page.$eval('#modal',n=>n.textContent),/Jane/,'Encounter prompts appear on other pages for the owner.');
    await bob.page.select('[data-initiative-method]','physical');await fill(bob.page,'initiativeTotal','12');await submit(bob.page);await closed(bob.page);
    for(const name of ['Melchior','Teyla']){await alice.page.waitForFunction(name=>document.querySelector('#modal[open]')?.textContent.includes(name),{},name);await alice.page.select('[data-initiative-method]','physical');await fill(alice.page,'initiativeTotal',name==='Melchior'?'80':'50');await submit(alice.page);}
    await closed(alice.page);await bob.page.goto(url+'#party');await bob.page.waitForFunction(()=>document.querySelector('[data-party-character="alice-main"] .party-player-turn')?.textContent.includes('80'));
    assert.equal(await bob.page.$('[data-party-character="alice-main"] [data-action="party-initiative"]'),null,'Other players’ initiative is read-only.');
    assert.equal(await alice.page.$('[data-party-character="bob-main"] [data-action="party-initiative"]'),null);
    await press(bob.page,'[data-action="party-initiative"][aria-label="Enter initiative for Jane"]');await fill(bob.page,'temporaryModifier','0');await submit(bob.page);await closed(bob.page);await bob.page.waitForFunction(()=>document.querySelector('.party-feed')?.textContent.includes('Jane rolled'));
    await click(alice.page,'party-next-turn');await Promise.all([alice,bob].map(({page})=>page.waitForFunction(()=>document.querySelector('.party-player.is-current h2')?.textContent==='Melchior')));await click(alice.page,'party-next-turn');await bob.page.waitForFunction(()=>document.querySelector('.party-player:first-child h2')?.textContent==='Teyla');
    await click(bob.page,'party-end-combat');await bob.page.waitForFunction(()=>!document.querySelector('[data-action="party-initiative"]'));
    await click(bob.page,'party-start-combat');await bob.page.waitForSelector('[data-initiative-method]');assert.equal(await bob.page.$eval('#modal [name="temporaryModifier"]',n=>n.value),'0');await click(bob.page,'close');await alice.page.waitForSelector('[data-initiative-method]');await click(alice.page,'close');await alice.page.waitForFunction(()=>document.querySelector('#modal[open]')?.textContent.includes('Teyla'));await click(alice.page,'close');await click(bob.page,'party-end-combat');
    phase='member sheet';await press(bob.page,`[data-action="party-member"][aria-label="Interact with Melchior"]`);await click(bob.page,'cloud-view');await text(bob.page,'Saving throws');assert.equal(await bob.page.$('#modal [data-action="hp-apply"]'),null);await click(bob.page,'close');
    phase='money acceptance';
    await press(alice.page,'[data-action="party-member"][aria-label="Interact with Jane"]');await click(alice.page,'party-offer-money');await alice.page.waitForSelector('#modal [name="coin"]');await alice.page.select('#modal [name="coin"]','gold');await fill(alice.page,'amount','7');await submit(alice.page);await closed(alice.page);await bob.page.waitForSelector('[data-action="party-transfer-accept"]');
    await waitForValue(alice.page,a.id,'gold',a.gold-7);
    assert.equal((await accountState(bob.page)).characters.find(c=>c.id===b.id).gold,b.gold);await click(bob.page,'party-transfer-accept');await waitForValue(bob.page,b.id,'gold',b.gold+7);
    phase='item decline';
    const arrows=a.items.find(i=>i.name==='Arrows');
    await press(alice.page,'[data-action="party-member"][aria-label="Interact with Jane"]');await click(alice.page,'party-offer-item');await alice.page.waitForSelector('#modal [name="itemId"]');await alice.page.select('#modal [name="itemId"]',arrows.id);await fill(alice.page,'amount','3');await submit(alice.page);await closed(alice.page);await bob.page.waitForSelector('[data-action="party-transfer-decline"]');
    await waitForQuantity(alice.page,a.id,arrows.id,arrows.qty-3);
    await click(bob.page,'party-transfer-decline');await waitForQuantity(alice.page,a.id,arrows.id,arrows.qty);
    phase='live damage and notifications';await bob.page.goto(url+'#inventory');await alice.page.goto(url+'#sheet');await click(alice.page,'hp');await fill(alice.page,'amount','4');await press(alice.page,'[data-action="hp-apply"][data-kind="damage"]');await bob.page.waitForSelector('#party-notification:not([hidden])');await press(bob.page,'#party-notification [data-action="navigate"]');await bob.page.waitForFunction(()=>location.hash==='#party'&&document.querySelector('.party-feed')?.textContent.includes('takes 4 damage'));
    phase='portrait reactions';await storeCall(alice,'apply',[a.id,{id:uid(),hpAction:{amount:2,kind:'heal'}}]);await bob.page.waitForSelector('[data-party-character="alice-main"].reaction-healing');assert.equal(await bob.page.$eval('[data-party-character="alice-main"] .party-heal-sparks',node=>getComputedStyle(node).display),'block');
    await storeCall(alice,'apply',[a.id,{id:uid(),live:[{key:'inspiration',before:0,after:1}]}]);await bob.page.waitForSelector('[data-party-character="alice-main"] .party-portrait.is-inspired');
    await press(bob.page,'[data-party-character="alice-main"] [data-action="party-status"]');await bob.page.waitForFunction(()=>document.querySelector('#modal-title')?.textContent==='Heroic Inspiration');await click(bob.page,'close');
    await storeCall(alice,'apply',[a.id,{id:uid(),hpAction:{amount:999,kind:'damage'}}]);await bob.page.waitForSelector('[data-party-character="alice-main"].is-unconscious');await storeCall(alice,'apply',[a.id,{id:uid(),hpAction:{amount:20,kind:'heal'}}]);await bob.page.waitForFunction(()=>!document.querySelector('[data-party-character="alice-main"]')?.classList.contains('is-unconscious'));
    phase='shared roll';await alice.page.goto(url+'#dice');await alice.page.evaluate(async()=>{const {rollDice}=await import('./model.js');const expression=document.querySelector('[name="expression"]');if(expression)expression.value='1d20';});
    await press(alice.page,'[data-action="navigate"][data-route="party"]');const trayHeight=await alice.page.$eval('#party-roll',n=>n.getBoundingClientRect().height);await alice.page.$eval('[name="party-expression"]',n=>n.value='2d6+3');await alice.page.$eval('[name="party-label"]',n=>n.value='Group stealth');await click(alice.page,'party-roll');assert.equal(await alice.page.$('#modal[open]'),null);
    const rollId=await alice.page.$eval('#party-roll',n=>n.dataset.rollId);await bob.page.waitForFunction(rollId=>document.querySelector('#party-roll')?.dataset.rollId===rollId&&['settled','static'].includes(document.querySelector('#party-roll .dice-stage')?.dataset.state),{},rollId);
    const remote=await bob.page.$$eval('#party-roll .dice-stage-faces span',nodes=>nodes.map(n=>Number(n.textContent)));await alice.page.waitForFunction(()=>['settled','static'].includes(document.querySelector('#party-roll .dice-stage')?.dataset.state));assert.deepEqual(remote,await alice.page.$$eval('#party-roll .dice-stage-faces span',nodes=>nodes.map(n=>Number(n.textContent))));assert.equal(await alice.page.$eval('#party-roll',n=>n.getBoundingClientRect().height),trayHeight);
    phase='rest vote';await click(alice.page,'party-rest');await click(alice.page,'party-rest-short');await bob.page.waitForSelector('[data-action="party-rest-no"]');await click(bob.page,'party-rest-no');await bob.page.waitForFunction(()=>document.querySelector('.party-requests')?.textContent.includes('1 yes · 1 no'));await click(alice.page,'close');
    phase='session header and notification preference';await click(bob.page,'party-session-toggle');await bob.page.goto(url+'#journal');await bob.page.waitForSelector('body.session-mode #party-session-header:not([hidden])');assert.equal(await bob.page.$eval('#topbar',node=>getComputedStyle(node).display),'none');await bob.page.goto(url+'#settings');await click(bob.page,'party-notifications-toggle');assert.equal((await accountState(bob.page)).settings.partyNotifications,false);await bob.page.reload();await bob.page.waitForSelector('body.session-mode');assert.equal((await accountState(bob.page)).settings.partyNotifications,false);
    phase='skill finder';await bob.page.goto(url+'#party');assert.equal(await bob.page.$('.party-skill-finder'),null);await click(bob.page,'party-skills');await bob.page.select('[data-party-skill]','Stealth');await bob.page.waitForFunction(()=>document.querySelector('#modal .party-skill-results')?.textContent.includes('+6'));await click(bob.page,'close');
    await bob.page.screenshot({path:resolve(diagnostics,'party-session-desktop.png'),fullPage:true});
    phase='sticky session filters';assert.equal(await bob.page.$eval('.session-party-name',n=>n.textContent),'');
    for(const width of [390,1440]){await bob.page.setViewport({width,height:700});await bob.page.goto(url+'#inventory');await bob.page.waitForSelector('.list-toolbar');await bob.page.evaluate(()=>scrollTo(0,700));assert.ok(await bob.page.$eval('.list-toolbar',n=>{const header=document.querySelector('#party-session-header');return getComputedStyle(n).position==='sticky'&&Math.abs(n.getBoundingClientRect().top-header.getBoundingClientRect().bottom)<1;}),'Session header keeps regular filters sticky below it');}
    await press(bob.page,'.session-party-name');await bob.page.waitForSelector('.party-player');
    phase='party management and switching';const second=await storeCall(alice,'createParty',['The second fellowship','Alice']);await storeCall(alice,'share',[second,a3]);await alice.page.goto(url+'#party-manage');await alice.page.waitForFunction(()=>document.querySelectorAll('.party-management-card').length===2);
    assert.equal(await alice.page.$('.party-character'),null);assert.doesNotMatch(await alice.page.$eval('#main',n=>n.textContent),/Open party/);
    await press(alice.page,`[data-action="cloud-edit-party"][data-id="${second}"]`);assert.equal((await accountState(alice.page)).activeId,a.id,'Editing another party keeps the current character');
    for(const width of [320,390]){await alice.page.setViewport({width,height:844});assert.ok(await alice.page.$eval('[data-action="cloud-join"]',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),'Join invitation fits mobile');assert.equal(await alice.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    await alice.page.screenshot({path:resolve(diagnostics,'party-management-mobile.png'),fullPage:true});
    await press(alice.page,`[data-action="cloud-select-party"][data-id="${second}"]`);await alice.page.waitForSelector('[data-party-character="alice-third"]');assert.equal((await accountState(alice.page)).activeId,a3.id);
    await alice.page.goto(url+'#party-manage');await press(alice.page,`[data-action="cloud-select-party"][data-id="${party}"]`);await alice.page.waitForSelector('[data-party-character="alice-main"]');assert.equal((await accountState(alice.page)).activeId,a.id);
    await alice.page.setViewport({width:390,height:844});assert.ok(await alice.page.$$eval('.party-player',nodes=>nodes.every(n=>n.getBoundingClientRect().height<250)),'Mobile cards stay compact');await alice.page.screenshot({path:resolve(diagnostics,'party-updated-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  }catch(error){
    const states={};
    for(const {name,page} of instances){
      states[name]=await page.evaluate(()=>({url:location.href,body:document.body.innerText,status:document.querySelector('[data-cloud-status]')?.textContent})).catch(()=>null);
      await page.screenshot({path:resolve(diagnostics,`${name}-failure.png`),fullPage:true}).catch(()=>{});
      const html=await page.content().catch(()=>null);if(html)await writeFile(resolve(diagnostics,`${name}-failure.html`),html).catch(()=>{});
    }
    await writeFile(resolve(diagnostics,'state.json'),JSON.stringify({phase,errors,messages,states},null,2)).catch(()=>{});
    error.message+=`\nPhase: ${phase}\nBrowser errors: ${errors.join('; ')}`;throw error;
  }
  finally{await browser.close();await new Promise(done=>server.close(done));}
});
