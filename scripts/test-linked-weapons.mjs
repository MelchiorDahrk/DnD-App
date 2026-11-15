import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {findEquipment,itemFromEquipment,attackFromWeapon} from '../catalog.js';

const root=resolve(import.meta.dirname,'..'),port=process.env.LINKED_WEAPON_TEST_PORT||'4198',base=`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a browser.');
let server,browser;
try{
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Test server did not start')),10000);
    server.once('error',reject);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.stderr.once('data',data=>reject(Error(String(data))));
  });
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1280,height:950});
  await page.goto(base,{waitUntil:'networkidle0'});
  const c=makeCharacter({name:'Linked weapons',stats:{str:12,dex:18,con:14,int:10,wis:12,cha:10}}),legacy={...itemFromEquipment(findEquipment('rapier')),id:'legacy',iconKey:'dwarvenaxe'};
  c.items=[legacy];c.attacks=[{id:'old-rapier',...attackFromWeapon(findEquipment('rapier'),c),bonus:3,damage:'1d8+7',notes:'Keep my custom settings'}];
  await page.evaluate(state=>localStorage.setItem('questlog.v2',JSON.stringify(state)),{version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});
  await page.goto(base+'#inventory');await page.reload({waitUntil:'networkidle0'});
  const saved=async()=>parseBackup(await page.evaluate(()=>localStorage.getItem('questlog.v2'))).characters[0];
  const click=(action,id)=>page.click(`[data-action="${action}"]${id?'[data-id="'+id+'"]':''}`);
  const value=name=>page.$eval(`#modal [name="${name}"]`,node=>node.type==='checkbox'?node.checked:node.value);
  const set=values=>page.evaluate(values=>{for(const [key,value] of Object.entries(values)){const input=document.querySelector(`#modal [name="${key}"]`);if(input.type==='checkbox')input.checked=value;else input.value=value;}},values);
  const save=async()=>{await page.click('#modal button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('#modal').open);};
  const add=async preset=>{await click('item');if(preset)await page.select('[data-catalog-pick="item"]',preset);};
  const matchingIcons=async(itemId,attackId,key,roll=false)=>{
    await page.goto(base+'#inventory');await page.waitForSelector(`[data-inventory-item="${itemId}"]`);
    const source=await page.$eval(`[data-inventory-item="${itemId}"] .equipment-icon img`,node=>node.getAttribute('src'));
    assert.equal(source,`./assets/equipment/${key}.webp`);
    await page.goto(base+'#sheet');await page.waitForSelector(`[data-sheet-entry="${attackId}"]`);
    assert.equal(await page.$eval(`[data-sheet-entry="${attackId}"] .equipment-icon img`,node=>node.getAttribute('src')),source,'sheet action matches inventory');
    await click('attack-roll',attackId);
    assert.equal(await page.$eval('.combat-icon img',node=>node.getAttribute('src')),source,'attack dialog matches inventory');
    if(roll){
      await page.click('[data-combat-action="roll"]');await page.waitForSelector('.vfx-weapon img',{timeout:20000});
      assert.equal(await page.$eval('.vfx-weapon img',node=>node.getAttribute('src')),source,'attack animation matches inventory');
      await page.waitForFunction(()=>!document.body.classList.contains('dice-pending'),{timeout:20000});
    }
    await page.click('[data-combat-action="close"]');
    await page.goto(base+'#inventory');await page.waitForSelector('.inventory-list');
  };
  let current=await saved();assert.equal(current.attacks[0].itemId,'legacy');assert.equal(current.attacks[0].bonus,3);
  await click('item','legacy');assert.equal(await value('damage'),'1d8+7');assert.equal(await value('notes'),'Keep my custom settings');await click('close');
  await matchingIcons('legacy','old-rapier','dwarvenaxe');

  await add();assert.equal(await page.$eval('[data-item-attack-fields]',node=>node.hidden&&node.disabled),true);
  await page.select('[data-catalog-pick="item"]','longbow');
  assert.equal(await page.$eval('[data-item-attack-fields]',node=>!node.hidden&&!node.disabled),true);
  assert.equal(await value('damage'),'1d8+4');assert.equal(await value('ability'),'dex');assert.equal(await value('range'),'150/600 ft.');
  assert.equal(await value('weaponId'),'longbow');assert.match(await value('notes'),/Slow/);
  await set({damage:'bad'});await page.click('#modal button[type="submit"]');
  assert.match(await page.$eval('#form-error',node=>node.textContent),/damage dice/);assert.equal((await saved()).items.length,1);
  await set({name:'Star bow',damage:'2d6+4',bonus:2,qty:2,mastery:'Slow',rollMode:'advantage',proficient:false,actionType:'bonus',notes:'Custom bow dice'});
  await page.click('.item-icon-picker summary');
  await page.$eval('[data-item-icon-search]',node=>{node.value='katana';node.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('[data-item-icon-key="katana"]');await save();
  current=await saved();let bow=current.items.find(item=>item.name==='Star bow'),attack=current.attacks.find(a=>a.itemId===bow.id);
  assert.equal(attack.damage,'2d6+4');assert.equal(attack.mastery,'Slow');assert.equal(attack.rollMode,'advantage');assert.equal(attack.proficient,false);assert.equal(attack.actionType,'bonus');
  assert.equal(bow.catalogId,'longbow');const bowId=bow.id,attackId=attack.id;
  await matchingIcons(bowId,attackId,'katana',true);
  await page.goto(base+'#sheet');await page.waitForSelector(`[data-action="attack"][data-id="${attackId}"]`);await click('attack',attackId);
  await set({name:'Starlight',damage:'1d10+5',bonus:4,actionType:'reaction',notes:'Edited from actions'});await save();
  current=await saved();assert.equal(current.items.find(i=>i.id===bowId).name,'Starlight');assert.equal(current.items.find(i=>i.id===bowId).actionType,'reaction');
  await page.goto(base+'#inventory');await page.waitForSelector('.inventory-list');await click('item',bowId);
  assert.equal(await value('damage'),'1d10+5');assert.equal(await value('bonus'),'4');assert.equal(await value('notes'),'Edited from actions');await save();
  await page.reload({waitUntil:'networkidle0'});assert.equal((await saved()).attacks.find(a=>a.itemId===bowId).id,attackId);
  await matchingIcons(bowId,attackId,'katana');
  await click('item',bowId);await page.click('.item-icon-picker summary');await page.click('.item-icon-auto');await save();
  await matchingIcons(bowId,attackId,'longsword');

  await add('longbow');await set({name:'Starlight'});await save();
  current=await saved();const duplicate=current.items.find(i=>i.name==='Starlight'&&i.id!==bowId),duplicateAttack=current.attacks.find(a=>a.itemId===duplicate.id);
  assert.notEqual(duplicateAttack.id,attackId);
  await click('use-item',bowId);assert.equal(await page.$$eval('.item-attack-use',nodes=>nodes.length),1);
  assert.equal(await page.$eval('.item-attack-use [data-action="attack-roll"]',node=>node.dataset.id),attackId);await click('close');
  await page.goto(base+'#sheet');await page.waitForSelector(`[data-sheet-entry="${attackId}"]`);
  await page.click(`[data-action="sheet-favorite"][data-entry="${attackId}"]`);
  await page.goto(base+'#inventory');await page.waitForSelector('.inventory-list');await click('item',bowId);await click('delete-entry');
  assert.match(await page.$eval('#modal',node=>node.textContent),/linked action will also be removed/);await click('confirm-delete');
  current=await saved();assert.ok(!current.items.some(i=>i.id===bowId));assert.ok(!current.attacks.some(a=>a.id===attackId));
  assert.ok(!current.sheetLayout.favorites.attacks.includes(attackId));assert.ok(current.attacks.some(a=>a.id===duplicateAttack.id));
  await page.click(`[data-action="quantity"][data-id="${duplicate.id}"][data-delta="-1"]`);
  current=await saved();assert.ok(!current.items.some(i=>i.id===duplicate.id));assert.ok(!current.attacks.some(a=>a.itemId===duplicate.id));

  await add('magic-weapon-1-2-or-3-2');assert.equal(await value('weaponId'),'longsword');assert.equal(await value('bonus'),'2');assert.equal(await value('damage'),'1d8+3');
  await page.select('[name="weaponId"]','longbow');assert.equal(await value('name'),'Weapon, +2');assert.equal(await value('damage'),'1d8+6');assert.equal(await value('ability'),'dex');
  await save();current=await saved();const magic=current.items.find(i=>i.catalogId==='magic-weapon-1-2-or-3-2');assert.equal(current.attacks.find(a=>a.itemId===magic.id).bonus,2);
  await click('item',magic.id);await page.select('[name="category"]','Gear');await set({damage:''});await save();
  assert.ok(!(await saved()).attacks.some(a=>a.itemId===magic.id),'changing category removes its action without validating disabled dice');

  await add();await page.select('[name="category"]','Weapon');
  await set({name:'Clockwork launcher',damage:'3d6+2',ability:'int',bonus:5,type:'Force',range:'60 ft.',notes:'A custom weapon',actionType:'action'});await save();
  current=await saved();const custom=current.items.find(i=>i.name==='Clockwork launcher'),customAttack=current.attacks.find(a=>a.itemId===custom.id);
  assert.equal(customAttack.weaponId,'');assert.equal(customAttack.damage,'3d6+2');
  await page.reload({waitUntil:'networkidle0'});await click('item',custom.id);
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  for(const width of [390,320]){
    await page.setViewport({width,height:844});await page.$eval('[data-item-attack-fields]',node=>node.scrollIntoView({block:'start'}));
    assert.ok(await page.$eval('#modal',node=>node.scrollWidth<=node.clientWidth+1),'weapon editor fits mobile width');
    await page.screenshot({path:resolve(root,`.tmp/linked-weapons-${width}.png`)});
  }
  await click('close');
  await page.goto(base+'#sheet');await page.waitForSelector(`[data-action="attack"][data-id="${customAttack.id}"]`);await click('attack',customAttack.id);await click('delete-entry');
  assert.match(await page.$eval('#modal',node=>node.textContent),/Clockwork launcher.*linked action/s);await click('close');
  assert.ok((await saved()).items.some(i=>i.id===custom.id),'canceling linked deletion keeps both entries');
  assert.deepEqual(errors,[]);
  console.log('PASS linked weapon catalog/custom editors, matching item/action/dialog/VFX icons, Automatic, legacy adoption, duplicate names, edits from either side, deletion, quantity, category, backup reload and mobile.');
}finally{await browser?.close();server?.kill();}
