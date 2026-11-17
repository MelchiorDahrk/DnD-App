import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {CONDITIONS,SKILLS,parseBackup} from '../../model.js';
import {CONDITION_USAGE_KEY,QUICK_CONDITION_LIMIT} from '../../condition-usage.js';
import {waitForImages} from './browser-checks.mjs';
import {SHEET_SECTIONS} from '../../sheet-layout.js';

export async function checkCharacterBackground(page,{original,root}) {
  const fixture=structuredClone(original),c=fixture.characters.find(c=>c.id===fixture.activeId);
  const keys=['personalityTraits','ideals','bonds','flaws'];
  const initial=['A storyteller.\nKeeps <secrets> & promises.','Freedom','Old friends','Too curious'];
  keys.forEach((key,index)=>c[key]=initial[index]);
  c.sheetLayout={collapsed:['personality'],favorites:{personality:['ideals']}};
  const readNotes=()=>page.$$eval('#modal .sheet-copy dd',nodes=>nodes.map(node=>node.textContent));
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')));
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$('[data-sheet-section="personality"], .sheet-section-link[data-section="personality"]'),null,'Story is absent from the scrolling sheet and navigation');
  assert.doesNotMatch(await page.$eval('#main',node=>node.textContent),/Keeps <secrets>/,'Notes appear only in the dialog');
  for(const width of [1440,390,320]) {
    await page.setViewport({width,height:844});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    assert.ok(await page.$eval('.hero [data-action="background"]',node=>{
      const button=node.getBoundingClientRect(),card=node.closest('.hero').getBoundingClientRect();
      return button.width>0&&button.left>=card.left&&button.right<=card.right&&button.bottom<=card.bottom;
    }),`${width}px Background button fits in the character card`);
    await page.screenshot({path:resolve(root,`.tmp/background-card-${width}.png`)});
    await page.focus('.hero [data-action="background"]');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#modal-title',node=>node.textContent),'Background');
    assert.deepEqual(await readNotes(),initial,'Multiline notes and literal markup are preserved');
    assert.equal(await page.$('#modal .sheet-copy secrets'),null,'Notes are escaped');
    await page.keyboard.press('Escape');
  }
  await page.click('.hero [data-action="background"]');
  await page.click('#modal [data-action="personality"]');
  assert.deepEqual(await page.$$eval('#modal textarea',nodes=>nodes.map(node=>node.value)),initial);
  await page.$eval('#modal [name="ideals"]',node=>node.value='Unsaved edit');
  await page.click('#modal .modal-actions [data-action="background"]');
  assert.deepEqual(await readNotes(),initial,'Cancel returns to the saved notes');
  assert.equal((await saved()).characters.find(character=>character.id===c.id).ideals,'Freedom');
  await page.click('#modal [data-action="personality"]');
  const updated=['A new chapter.\nA friend of <dragons> & elves.','Kindness','My party',''];
  await page.$$eval('#modal textarea',(nodes,values)=>nodes.forEach((node,index)=>node.value=values[index]),updated);
  await page.click('#modal button[type="submit"]');
  assert.deepEqual(await readNotes(),[...updated.slice(0,3),'Not recorded yet.'],'Saving returns to the updated Background dialog');
  const result=await saved(),changed=result.characters.find(character=>character.id===c.id);
  assert.deepEqual(keys.map(key=>changed[key]),updated,'Every field persists, including cleared notes');
  assert.deepEqual(result.characters.filter(character=>character.id!==c.id),original.characters.filter(character=>character.id!==c.id),'Editing only changes the active character');
  await page.screenshot({path:resolve(root,'.tmp/background-dialog-320.png')});
  await page.click('#modal .modal-actions [data-action="close"]');
  await page.setOfflineMode(true);
  try {
    await page.reload({waitUntil:'load'});
    await page.click('.hero [data-action="background"]');
    assert.deepEqual(await readNotes(),[...updated.slice(0,3),'Not recorded yet.'],'Background notes survive offline reload');
    await page.keyboard.press('Escape');
  } finally {await page.setOfflineMode(false);}
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),original);
  await page.setViewport({width:1440,height:1100});
  await page.reload({waitUntil:'load'});
  console.log('PASS character-card Background dialog, mobile layout, keyboard access, editing, cancel, clearing notes, per-character persistence and offline reload');
}

export async function checkSheetNavigation(page,{original,root}) {
  const previousTheme=await page.evaluate(()=>window.QuestlogTheme.preference);
  await page.evaluate(()=>window.QuestlogTheme.set('light'));
  const fixture=structuredClone(original),c=fixture.characters.find(c=>c.id===fixture.activeId);
  c.sheetLayout={collapsed:[...SHEET_SECTIONS],favorites:{abilities:['str']}};
  Object.assign(c,{hp:5,tempHp:7,conditions:['Poisoned','Prone'],exhaustion:2,inspiration:true,concentration:'Bless <Ward>'});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await page.reload({waitUntil:'load'});
  const link=key=>`.sheet-section-nav [data-section="${key}"]`;
  const active=()=>page.$eval('.sheet-section-link[aria-current="location"]',n=>n.dataset.section);
  const waitForDestination=async key=>{
    const state=await page.evaluateHandle(()=>({y:scrollY,changed:performance.now()}));
    try {
      await page.waitForFunction((key,state)=>{
        if(scrollY!==state.y){state.y=scrollY;state.changed=performance.now();}
        const rect=document.querySelector(`[data-sheet-section="${key}"]`).getBoundingClientRect();
        const header=document.querySelector('.sheet-header').getBoundingClientRect();
        const atBottom=scrollY+innerHeight>=document.documentElement.scrollHeight-1;
        return performance.now()-state.changed>=100&&rect.top>=header.bottom-1&&rect.top<innerHeight-80&&(Math.abs(rect.top-header.bottom-12)<1||atBottom);
      },{timeout:3000,polling:50},key,state);
    } finally {await state.dispose();}
  };
  const sampleJump=async key=>{
    const state=await page.evaluateHandle(key=>{
      const header=document.querySelector('.sheet-header'),section=document.querySelector(`[data-sheet-section="${key}"]`);
      const state={header,section,start:scrollY,frames:[],frame:0};
      const sample=()=>{
        state.frames.push({y:scrollY,key:header.dataset.activeSection});
        state.frame=requestAnimationFrame(sample);
      };
      document.querySelector(`.sheet-section-nav [data-section="${key}"]`).click();
      state.frame=requestAnimationFrame(sample);
      return state;
    },key);
    try {
      await waitForDestination(key);
      return await state.evaluate((state,key)=>({start:state.start,end:scrollY,frames:state.frames,sameHeader:state.header===document.querySelector('.sheet-header'),sameSection:state.section===document.querySelector(`[data-sheet-section="${key}"]`)}),key);
    } finally {
      await state.evaluate(state=>cancelAnimationFrame(state.frame));
      await state.dispose();
    }
  };
  assert.deepEqual(await page.$$eval('.sheet-section-link',nodes=>nodes.map(n=>n.dataset.section)),SHEET_SECTIONS);
  assert.ok(await page.$$eval('.sheet-section-link',nodes=>nodes.every(n=>document.getElementById(n.getAttribute('aria-controls')))));
  assert.match(await page.$eval('.sheet-health',n=>n.getAttribute('aria-label')),/5 of .*plus 7 temporary hit points/);
  assert.match(await page.$eval('.sheet-status .has-conditions',n=>n.getAttribute('aria-label')),/Poisoned, Prone, Exhaustion 2/);
  assert.equal(await page.$('.sheet-concentration, .sheet-inspiration, .sheet-status [data-action="combat-edit"]'),null);
  await page.click('.sheet-status-stat[aria-label^="Armor class"]');
  assert.equal(await page.$('#modal[open]'),null,'Armor class is read-only in the sticky header');
  for(const key of ['hp-current','hp-temp']) {
    const width=await page.$eval(`.sheet-health-track>.${key}`,n=>n.style.width);
    assert.equal(width,await page.$eval(`.hp-track>.${key}`,n=>n.style.width),'Both HP bars use the same scale');
  }
  assert.equal(await page.$eval('.sheet-health-track>.hp-temp',n=>getComputedStyle(n).backgroundColor),await page.$eval('.hp-track>.hp-temp',n=>getComputedStyle(n).backgroundColor));
  for(const width of [1440,390,320]) {
    await page.setViewport({width,height:width===1440?900:844});
    await page.evaluate(()=>scrollTo(0,400));
    await page.waitForFunction(()=>document.querySelector('.sheet-header').getBoundingClientRect().top===(innerWidth<=760?65:0));
    const dimensions=await page.$eval('.sheet-header',n=>({height:n.offsetHeight,width:n.offsetWidth,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(dimensions.height<=96,`${width}px header stays compact`);
    assert.ok(dimensions.scrollWidth<=dimensions.viewport,`${width}px header fits the screen`);
    for(const key of SHEET_SECTIONS) {
      await page.$eval(link(key),n=>n.scrollIntoView({block:'nearest',inline:'nearest'}));
      await page.click(link(key));
      await waitForDestination(key);
      await page.waitForFunction(key=>document.activeElement?.dataset.section===key,{},key);
      assert.equal(await page.$eval(`[data-sheet-section="${key}"] .sheet-section-toggle`,n=>n.getAttribute('aria-expanded')),'true',`${key} opens on jump`);
      await page.waitForFunction(key=>document.querySelector('.sheet-header').dataset.activeSection===key,{timeout:3000},key);
      assert.equal(await active(),key,`${width}px ${key} is selected`);
      const visible=await page.$eval(`[data-sheet-section="${key}"]`,n=>{
        const rect=n.getBoundingClientRect(),header=document.querySelector('.sheet-header').getBoundingClientRect();
        return rect.top>=header.bottom-1&&rect.top<innerHeight-80;
      });
      assert.ok(visible,`${width}px ${key} heading stays visible below the header`);
    }
    await page.$eval(link('skills'),n=>n.scrollIntoView({block:'nearest',inline:'nearest'}));
    await page.click(link('skills'));
    await waitForDestination('skills');
    await page.evaluate(()=>scrollBy(0,100));
    await page.waitForFunction(()=>document.querySelector('.sheet-header').dataset.activeSection==='skills');
    await page.evaluate(()=>{document.activeElement?.blur();document.querySelectorAll('.toast').forEach(n=>n.remove());});
    await page.screenshot({path:resolve(root,`.tmp/sheet-navigation-${width}.png`)});
    if(width<=390) {
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      for(const key of ['features','abilities']) {
        const motion=await sampleJump(key);
        assert.notEqual(motion.start,motion.end,`${width}px ${key} moves to another section`);
        const direction=Math.sign(motion.end-motion.start);
        assert.ok(motion.frames.every((frame,i)=>i===0||(frame.y-motion.frames[i-1].y)*direction>=-1),`${width}px ${key} moves steadily toward the destination`);
        assert.ok(motion.frames.every(frame=>frame.key===key),`${width}px selected destination stays steady during travel`);
        assert.ok(motion.sameHeader&&motion.sameSection,'Scrolling preserves the mounted sheet');
      }
    }
  }
  await page.evaluate(()=>{
    document.querySelector('.sheet-section-nav [data-section="features"]').click();
    document.querySelector('.sheet-section-nav [data-section="skills"]').click();
  });
  await waitForDestination('skills');
  assert.equal(await active(),'skills','A second tap redirects the scroll to the newest destination');
  const interrupted=await page.evaluate(async()=>{
    document.querySelector('.sheet-section-nav [data-section="features"]').click();
    window.dispatchEvent(new PointerEvent('pointerdown'));
    const stopped=scrollY;
    await new Promise(resolve=>setTimeout(resolve,300));
    return {stopped,end:scrollY};
  });
  assert.equal(interrupted.end,interrupted.stopped,'Touch or pointer input stops the animated scroll');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  try {
    const motion=await page.evaluate(()=>{
      const start=scrollY;
      document.querySelector('.sheet-section-nav [data-section="features"]').click();
      return {start,end:scrollY};
    });
    assert.ok(motion.end-motion.start>300,'Reduced motion jumps directly to the destination');
    await waitForDestination('features');
  } finally {await page.emulateMediaFeatures([]);}
  const layout=await page.evaluate(()=>JSON.parse(localStorage.getItem('questlog.v2')).characters.find(c=>c.id===JSON.parse(localStorage.getItem('questlog.v2')).activeId).sheetLayout);
  assert.deepEqual(layout.favorites,{abilities:['str']},'Jumping preserves favorites');
  assert.deepEqual(layout.collapsed,[],'Expanded destinations are saved');
  await page.click('.sheet-status [data-action="conditions"]');
  await page.$eval('#modal [name="exhaustion"]',n=>n.value='1');
  await page.click('#modal button[type="submit"]');
  assert.equal(await page.$eval('.sheet-exhaustion',n=>n.textContent),'E1','Status summary updates after edits');
  await page.click('[data-action="characters"]');
  await page.click('[data-action="switch-character"]:not(.active)');
  const next=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('questlog.v2'));return s.characters.find(c=>c.id===s.activeId);});
  assert.match(await page.$eval('.sheet-status',n=>n.getAttribute('aria-label')),new RegExp(next.name));
  assert.equal(await page.$eval('.sheet-health-value>strong',n=>Number(n.textContent)),next.hp);
  await page.click('#mobile-nav [data-route="inventory"]');
  assert.equal(await page.$('.sheet-header'),null,'Other pages do not show sheet navigation');
  await page.click('#mobile-nav [data-route="sheet"]');
  assert.equal(await page.$$eval('.sheet-section-link',n=>n.length),SHEET_SECTIONS.length,'Returning mounts a single navigation');
  for(const [hp,tempHp] of [[c.maxHp,c.maxHp],[0,7],[5,0]]) {
    Object.assign(c,{hp,tempHp});
    await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
    await page.reload({waitUntil:'load'});
    const scale=Math.max(c.maxHp,hp+tempHp);
    assert.ok(Math.abs(await page.$eval('.sheet-health-track>.hp-current',n=>parseFloat(n.style.width))-hp/scale*100)<.001);
    assert.equal(await page.$('.sheet-health-track>.hp-temp')!==null,!!tempHp);
    if(tempHp) assert.equal(await page.$eval('.sheet-health-track>.hp-temp',n=>n.style.width),await page.$eval('.hp-track>.hp-temp',n=>n.style.width));
  }
  Object.assign(c,{hp:0,tempHp:0,deathSuccess:1,deathFailure:2});
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),fixture);
  await page.reload({waitUntil:'load'});
  assert.match(await page.$eval('.sheet-health.is-down',n=>n.getAttribute('aria-label')),/Death saves: 1 successes, 2 failures/);
  assert.equal(await page.$eval('.sheet-death-summary',n=>n.textContent),'✓ 1✕ 2');
  await page.evaluate(()=>window.QuestlogTheme.set('dark'));
  await page.evaluate(()=>scrollTo(0,800));
  await page.screenshot({path:resolve(root,'.tmp/sheet-navigation-dark-320.png')});
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$$eval('.sheet-section-link',n=>n.length),SHEET_SECTIONS.length,'Navigation reloads offline');
  await page.$eval(link('features'),n=>n.scrollIntoView({block:'nearest',inline:'nearest'}));
  await page.click(link('features'));
  assert.equal(await page.$eval('[data-sheet-section="features"] .sheet-section-toggle',n=>n.getAttribute('aria-expanded')),'true');
  await page.setOfflineMode(false);
  await page.evaluate(theme=>window.QuestlogTheme.set(theme),previousTheme);
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),original);
  await page.setViewport({width:1440,height:1100});
  await page.reload({waitUntil:'load'});
  console.log('PASS sticky section navigation, collapsed destinations, keyboard focus, live status, compact desktop/mobile layout, character switching and offline navigation');
}

export async function checkSheetPopups(page) {
  const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));
  for(const width of [1440,390,320]) {
    await page.setViewport({width,height:650});
    for(const action of ['combat-edit','level-up']) {
      console.log(`RUN ${width}px ${action} modal scrolling`);
      await page.evaluate(()=>scrollTo(0,500));
      // Open from a scrolled sheet without Puppeteer scrolling the trigger first.
      await page.$eval(`#main [data-action="${action}"]`,n=>n.click());
      await page.waitForSelector('#modal[open]');
      const backgroundY=await page.evaluate(()=>scrollY);
      await page.mouse.move(2,300);
      await page.mouse.wheel({deltaY:400});
      await settle();
      assert.equal(await page.evaluate(()=>scrollY),backgroundY,`${width}px ${action}: backdrop scrolling stays locked`);
      const box=await page.$eval('#modal',n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
      await page.$eval('#modal',n=>n.scrollTop=0);
      await page.mouse.move(box.x,box.y);
      await page.mouse.wheel({deltaY:500});
      await page.waitForFunction(()=>document.querySelector('#modal').scrollTop>0);
      await page.$eval('#modal',n=>n.scrollTop=n.scrollHeight);
      await page.mouse.wheel({deltaY:500});
      await settle();
      assert.equal(await page.evaluate(()=>scrollY),backgroundY,`${width}px ${action}: dialog scroll cannot chain to the page`);
      if(action==='combat-edit')await page.keyboard.press('Escape');
      else await page.click('#modal [data-action="close"]');
      await page.waitForFunction(()=>!document.querySelector('dialog:modal'));
      assert.equal(await page.evaluate(()=>scrollY),backgroundY,'Closing preserves the page position');
      await page.mouse.move(width/2,300);
      await page.mouse.wheel({deltaY:-250});
      await page.waitForFunction(y=>scrollY<y,{},backgroundY);
    }
  }
  await page.setViewport({width:1440,height:900});
  await page.$eval('[data-action="edit-character"]',n=>n.click());
  await page.click('#modal [data-action="portrait"]');
  await page.waitForSelector('.portrait-dialog[open]');
  assert.equal(await page.$$eval('dialog:modal',nodes=>nodes.length),1,'Portrait editor replaces the shared dialog');
  const backgroundY=await page.evaluate(()=>scrollY);
  await page.mouse.move(2,300);
  await page.mouse.wheel({deltaY:400});
  await settle();
  assert.equal(await page.evaluate(()=>scrollY),backgroundY,'The separate portrait dialog locks background scrolling');
  await page.click('[data-portrait-close]');
  await page.waitForSelector('.portrait-dialog',{hidden:true});
  await page.waitForFunction(()=>!document.querySelector('dialog:modal'));
  for(const route of ['sheet','inventory','spells','journal','dice','wiki','settings']) {
    await page.$eval(`#sidebar [data-route="${route}"]`,n=>n.click());
    assert.doesNotMatch(await page.$eval('body',n=>n.textContent),/A little less bookkeeping|A little more adventure/i);
  }
  await page.click('#sidebar [data-route="sheet"]');
  await page.setViewport({width:1440,height:1100});
  console.log('PASS status and level-up dialogs scroll independently, page scrolling resumes on close, portrait dialog locks the page, and all pages omit the slogan');
}

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
  await page.evaluate((s,key)=>{localStorage.setItem('questlog.v2',JSON.stringify(s));localStorage.removeItem(key);},fixture,CONDITION_USAGE_KEY);
  await page.goto(new URL('#inventory',base).href,{waitUntil:'load'});
  await page.reload({waitUntil:'load'});
  const favorite='[data-action="sheet-favorite"][data-entry="sheet-favorite-item"]';
  await page.click(favorite);
  assert.equal(await page.$eval(favorite,n=>n.getAttribute('aria-pressed')),'true');
  assert.equal(await page.$eval(':focus',n=>n.dataset.entry),'sheet-favorite-item');
  await page.click('.filter-tabs [data-filter="Favorites"]');
  assert.equal(await page.$$eval('.inventory-list .action-row',n=>n.length),1);
  await page.click('.desktop-nav [data-route="sheet"]');
  assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null,'Inventory and journal previews are absent');
  assert.equal(await page.$eval('.heading-actions [data-action="rest"]',n=>n.textContent.trim()),'Rest');
  await page.click('.heading-actions [data-action="rest"]');
  for(const kind of ['long','short']) assert.ok(await page.$(`#modal [data-action="rest"][data-kind="${kind}"]`));
  await page.click('#modal [data-action="rest"][data-kind="short"]');
  assert.ok(await page.$('#modal [name="dice"]'),'Rest offers Short Rest Hit Dice');
  await page.click('#modal [data-action="close"]');
  for(const [section,title] of [['abilities','Abilities'],['combat','Status']]) assert.equal(await page.$eval(`[data-sheet-section="${section}"] .sheet-section-toggle`,n=>n.dataset.label),title);
  await page.click('.desktop-nav [data-route="inventory"]');
  const inventoryItem=id=>`[data-inventory-item="${id}"]`;
  await page.click(`${inventoryItem('sheet-equipped-item')} [data-action="use-item"]`);
  assert.match(await page.$eval('#modal',n=>n.textContent),/A useful keepsake/);
  await page.click('#modal [data-action="close"]');
  assert.equal(active(await state()).items.find(i=>i.id==='sheet-equipped-item').qty,1);
  await page.click(`${inventoryItem('sheet-weapon')} [data-action="use-item"]`);
  await page.click('#modal [data-action="attack-roll"]');
  assert.ok(await page.$('#modal [data-combat-action="roll"]'),'Equipped weapon opens guided attack');
  await page.click('#modal [data-combat-action="close"]');
  await page.click(`${inventoryItem('sheet-potion')} [data-action="use-item"]`);
  await page.click('#modal [data-action="confirm-use-item"]');
  assert.equal(active(await state()).items.find(i=>i.id==='sheet-potion'),undefined);
  assert.ok(active(await state()).hp>c.hp,'Potion heals from inventory');
  await page.click('#modal [data-action="close"]');
  assert.equal(await page.$(inventoryItem('sheet-potion')),null);
  await page.click('.desktop-nav [data-route="sheet"]');

  for(const [id,label] of [['sheet-action-spell','Action'],['sheet-bonus-spell','Bonus Action'],['sheet-reaction-spell','Reaction']]) assert.equal(await page.$eval(`${entry('attacks',id)} .action-timing`,n=>n.textContent),label);
  assert.equal(await page.$(entry('attacks','sheet-unready-spell')),null);
  await page.click(`${entry('attacks','sheet-bonus-spell')} [data-action="cast"]`);
  await page.click('#modal button[type="submit"]');
  assert.equal(active(await state()).slots[0].used,1);
  assert.equal(active(await state()).concentration,'Sheet bonus spell');
  assert.equal(await page.$eval(`${entry('attacks','sheet-bonus-spell')} .spell-concentration`,n=>n.textContent),'Concentrating');
  await page.reload({waitUntil:'load'});
  assert.match(await page.$eval('[data-sheet-section="attacks"] .concentration-banner',n=>n.textContent),/Sheet bonus spell/);
  await page.click('[data-action="end-concentration"]');
  assert.equal(active(await state()).concentration,'');
  await page.click(`${entry('attacks',c.attacks[0].id)} [data-action="attack"]`);
  await page.select('#modal [name="actionType"]','bonus');
  await page.click('#modal button[type="submit"]');
  assert.equal(await page.$eval(`${entry('attacks',c.attacks[0].id)} .action-timing`,n=>n.textContent),'Bonus Action');

  assert.equal(await page.$$eval('.status-row .condition-tray .condition-chip',nodes=>nodes.length),QUICK_CONDITION_LIMIT);
  assert.equal(await page.$eval('.condition-tray',node=>node.textContent.trim()),'','Shortcuts have no visible labels');
  await page.click('.condition-tray [data-condition="Prone"]');
  await page.click('.condition-tray [data-condition="Prone"]');
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).Prone.count,CONDITION_USAGE_KEY),1,'Clearing does not inflate usage');
  await page.click('.condition-more');
  for(const name of CONDITIONS) {
    const selector=`#modal [data-condition="${name}"]`;
    await waitForImages(page,`${selector} img`);
    assert.equal(await page.$eval(selector,node=>node.getAttribute('aria-label')),name);
    await page.click(selector);
    assert.equal(await page.$eval(selector,n=>n.getAttribute('aria-pressed')),'true');
    assert.equal(await page.$eval(':focus',n=>n.dataset.condition),name);
  }
  assert.deepEqual(active(await state()).conditions,CONDITIONS);
  await page.click('#modal button[type="submit"]');
  assert.ok(await page.$('.condition-more .condition-overflow-dot'),'Overflow indicates hidden active conditions');
  await page.reload({waitUntil:'load'});
  await page.click('.condition-more');
  await page.click('#modal [data-condition="Blinded"]');
  assert.ok(!active(await state()).conditions.includes('Blinded'));
  await page.$eval('#modal [name="exhaustion"]',n=>n.value='2');
  await page.click('#modal button[type="submit"]');
  assert.equal(active(await state()).exhaustion,2);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).Exhaustion.count,CONDITION_USAGE_KEY),1);

  await page.click('[data-action="skills-filter"]');
  const proficient=[...new Set([...c.skills,...c.expertise])].sort();
  assert.deepEqual(await page.$$eval('[data-action="skill-prof"]',n=>n.map(n=>n.dataset.skill).sort()),proficient);
  assert.equal(await page.$$eval('[data-action="save-roll"]',n=>n.length),6);
  await page.reload({waitUntil:'load'});
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
  await page.reload({waitUntil:'load'});
  assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null,'Removed previews stay absent offline');
  assert.ok(active(await state()).sheetLayout.favorites.pack.includes(gear.id),'Inventory favorites persist offline');
  await waitForImages(page,'.condition-tray img');
  await page.click('.condition-more');
  await waitForImages(page,'#modal .condition-icon');
  await page.click('#modal [data-action="close"]');
  assert.equal(await page.$$eval('.sheet-spell',n=>n.length),3);
  await page.setOfflineMode(false);
  await page.setViewport({width:1440,height:1100});
  await page.click('.desktop-nav [data-route="inventory"]');
  await page.click(favorite);
  assert.equal(await page.$eval(favorite,n=>n.getAttribute('aria-pressed')),'false');
  await page.click('.desktop-nav [data-route="sheet"]');
  assert.equal(await page.$('[data-sheet-section="pack"], [data-sheet-section="journal"]'),null);
  await page.evaluate(s=>localStorage.setItem('questlog.v2',JSON.stringify(s)),original);
  await page.setViewport({width:1440,height:1100});
  await page.reload({waitUntil:'load'});
  console.log('PASS inventory favorites, equipped item use, action timing, readied spells and concentration, all condition icons, saved skill filter, mobile and offline behavior');
}
