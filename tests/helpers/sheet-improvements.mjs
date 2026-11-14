import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {CONDITIONS,SKILLS,parseBackup} from '../../model.js';

export async function checkSheetImprovements(page,{base,original,root}) {
  const fixture=structuredClone(original),c=fixture.characters.find(c=>c.id===fixture.activeId);
  c.sheetLayout={collapsed:[],favorites:{}};
  c.hp=c.maxHp-10;
  const gear={id:'sheet-favorite-item',name:'Favorite keepsake',category:'Gear',qty:1,weight:0,equipped:false,description:'A useful keepsake.',wiki:''};
  c.items.push(gear,{...gear,id:'sheet-equipped-item',name:'Equipped tool',equipped:true},
    {...gear,id:'sheet-potion',name:'Potion of healing',category:'Consumable',equipped:true},
    {...gear,id:'sheet-weapon',name:c.attacks[0].name,category:'Weapon',equipped:true});
  const spell={id:'sheet-action-spell',name:'Sheet action spell',level:1,school:'Evocation',castingTime:'1 action',range:'30 ft.',duration:'1 minute',concentration:true,prepared:true,notes:'',wiki:''};
  c.spells=[spell,{...spell,id:'sheet-bonus-spell',name:'Sheet bonus spell',castingTime:'1 Bonus Action'},
    {...spell,id:'sheet-reaction-spell',name:'Sheet reaction spell',castingTime:'1 reaction, when hit',concentration:false},
    {...spell,id:'sheet-unready-spell',name:'Unready spell',prepared:false}];
  c.concentration='';c.conditions=[];c.slots[0]={max:3,used:0};
  const active=state=>state.characters.find(c=>c.id===state.activeId);
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  const entry=(section,id)=>`[data-sheet-section="${section}"] [data-sheet-entry="${id}"]`;
  await page.setViewport({width:1440,height:1100});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await page.goto(new URL('#inventory',base).href,{waitUntil:'networkidle0'});
  await page.reload({waitUntil:'networkidle0'});
  const favorite='[data-action="sheet-favorite"][data-entry="sheet-favorite-item"]';
  await page.click(favorite);
  assert.equal(await page.$eval(favorite,n=>n.getAttribute('aria-pressed')),'true');
  assert.equal(await page.$eval(':focus',n=>n.dataset.entry),'sheet-favorite-item');
  await page.click('.filter-tabs [data-filter="Favorites"]');
  assert.equal(await page.$$eval('.inventory-list .action-row',n=>n.length),1);
  await page.click('.desktop-nav [data-route="sheet"]');
  for(const id of ['sheet-favorite-item','sheet-equipped-item','sheet-potion','sheet-weapon']) assert.ok(await page.$(entry('pack',id)),`${id} appears on sheet`);
  assert.equal(await page.$eval('.heading-actions [data-action="rest"]',n=>n.textContent.trim()),'Rest');
  await page.click('.heading-actions [data-action="rest"]');
  for(const kind of ['long','short']) assert.ok(await page.$(`#modal [data-action="rest"][data-kind="${kind}"]`));
  await page.click('#modal [data-action="rest"][data-kind="short"]');
  assert.ok(await page.$('#modal [name="dice"]'),'Rest offers Short Rest Hit Dice');
  await page.click('#modal [data-action="close"]');
  for(const [section,title] of [['abilities','Abilities'],['combat','Status'],['journal','Journal'],['pack','Inventory']]) assert.equal(await page.$eval(`[data-sheet-section="${section}"] .sheet-section-toggle`,n=>n.dataset.label),title);
  await page.click('[data-sheet-section="pack"] .sheet-section-toggle');
  assert.equal(await page.$eval(entry('pack',gear.id),n=>n.hidden),false,'Inventory favorite survives collapse');
  await page.click('[data-sheet-section="pack"] .sheet-section-toggle');
  await page.click(`${entry('pack','sheet-equipped-item')} [data-action="use-item"]`);
  assert.match(await page.$eval('#modal',n=>n.textContent),/A useful keepsake/);
  await page.click('#modal [data-action="close"]');
  assert.equal(active(await state()).items.find(i=>i.id==='sheet-equipped-item').qty,1);
  await page.click(`${entry('pack','sheet-weapon')} [data-action="use-item"]`);
  await page.click('#modal [data-action="attack-roll"]');
  assert.ok(await page.$('#modal [data-combat-action="roll"]'),'Equipped weapon opens guided attack');
  await page.click('#modal [data-combat-action="close"]');
  await page.click(`${entry('pack','sheet-potion')} [data-action="use-item"]`);
  await page.click('#modal [data-action="confirm-use-item"]');
  assert.equal(active(await state()).items.find(i=>i.id==='sheet-potion').qty,0);
  assert.ok(active(await state()).hp>c.hp,'Potion heals from sheet');
  await page.click('#modal [data-action="close"]');
  assert.equal(await page.$eval(`${entry('pack','sheet-potion')} [data-action="use-item"]`,n=>n.disabled),true);

  for(const [id,label] of [['sheet-action-spell','Action'],['sheet-bonus-spell','Bonus Action'],['sheet-reaction-spell','Reaction']]) assert.equal(await page.$eval(`${entry('attacks',id)} .action-timing`,n=>n.textContent),label);
  assert.equal(await page.$(entry('attacks','sheet-unready-spell')),null);
  await page.click(`${entry('attacks','sheet-bonus-spell')} [data-action="cast"]`);
  await page.click('#modal button[type="submit"]');
  assert.equal(active(await state()).slots[0].used,1);
  assert.equal(active(await state()).concentration,'Sheet bonus spell');
  assert.equal(await page.$eval(`${entry('attacks','sheet-bonus-spell')} .spell-concentration`,n=>n.textContent),'Concentrating');
  await page.reload({waitUntil:'networkidle0'});
  assert.match(await page.$eval('[data-sheet-section="attacks"] .concentration-banner',n=>n.textContent),/Sheet bonus spell/);
  await page.click('[data-action="end-concentration"]');
  assert.equal(active(await state()).concentration,'');
  await page.click(`${entry('attacks',c.attacks[0].id)} [data-action="attack"]`);
  await page.select('#modal [name="actionType"]','bonus');
  await page.click('#modal button[type="submit"]');
  assert.equal(await page.$eval(`${entry('attacks',c.attacks[0].id)} .action-timing`,n=>n.textContent),'Bonus Action');

  for(const name of CONDITIONS) {
    const selector=`.condition-tray [data-condition="${name}"]`;
    assert.ok(await page.$(`${selector} svg path, ${selector} svg circle`),`${name} has an icon`);
    await page.click(selector);
    assert.equal(await page.$eval(selector,n=>n.getAttribute('aria-pressed')),'true');
    assert.equal(await page.$eval(':focus',n=>n.dataset.condition),name);
  }
  assert.deepEqual(active(await state()).conditions,CONDITIONS);
  await page.reload({waitUntil:'networkidle0'});
  await page.click('.condition-tray [data-condition="Blinded"]');
  assert.ok(!active(await state()).conditions.includes('Blinded'));
  await page.click('.condition-tray [data-action="conditions"]');
  await page.$eval('#modal [name="exhaustion"]',n=>n.value='2');
  await page.click('#modal button[type="submit"]');
  assert.equal(active(await state()).exhaustion,2);

  await page.click('[data-action="skills-filter"]');
  const proficient=[...new Set([...c.skills,...c.expertise])].sort();
  assert.deepEqual(await page.$$eval('[data-action="skill-prof"]',n=>n.map(n=>n.dataset.skill).sort()),proficient);
  assert.equal(await page.$$eval('[data-action="save-roll"]',n=>n.length),6);
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.$eval('[data-action="skills-filter"]',n=>n.getAttribute('aria-pressed')),'true');
  assert.equal(await page.$eval(`${entry('attacks',c.attacks[0].id)} .action-timing`,n=>n.textContent),'Bonus Action');
  await page.click('[data-action="characters"]');
  await page.click('[data-action="switch-character"]:not(.active)');
  assert.equal(await page.$$eval('[data-action="skill-prof"]',n=>n.length),Object.keys(SKILLS).length);
  await page.click('[data-action="characters"]');
  await page.click(`[data-action="switch-character"][data-id="${c.id}"]`);
  assert.equal(await page.$eval('[data-action="skills-filter"]',n=>n.getAttribute('aria-pressed')),'true');
  await page.click('[data-action="skills-filter"]');
  assert.equal(await page.$$eval('[data-action="skill-prof"]',n=>n.length),Object.keys(SKILLS).length);
  parseBackup(JSON.stringify(await state()));
  for(const width of [1440,390,320]) {
    await page.setViewport({width,height:width===1440?1100:844});
    await page.evaluate(()=>{document.activeElement?.blur();document.querySelectorAll('.toast').forEach(n=>n.remove());scrollTo(0,0);});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px sheet fits viewport`);
    await page.screenshot({path:resolve(root,`.tmp/sheet-improvements-${width}.png`),fullPage:true});
  }
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'networkidle0'});
  assert.ok(await page.$(entry('pack',gear.id)),'Inventory favorite reloads offline');
  assert.equal(await page.$$eval('.sheet-spell',n=>n.length),3);
  await page.setOfflineMode(false);
  await page.setViewport({width:1440,height:1100});
  await page.click('.desktop-nav [data-route="inventory"]');
  await page.click(favorite);
  assert.equal(await page.$eval(favorite,n=>n.getAttribute('aria-pressed')),'false');
  await page.click('.desktop-nav [data-route="sheet"]');
  assert.equal(await page.$(entry('pack',gear.id)),null,'Removing inventory favorite removes the extra sheet item');
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),original);
  await page.setViewport({width:1440,height:1100});
  await page.reload({waitUntil:'networkidle0'});
  console.log('PASS inventory favorites, equipped item use, action timing, readied spells and concentration, all condition icons, saved skill filter, mobile and offline behavior');
}
