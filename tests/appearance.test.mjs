import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../theme.js',import.meta.url),'utf8');
function boot({saved=null,dark=false,blocked=false}={}) {
  const windowEvents={},documentEvents={},metadata={},events=[],selects=[{}];
  const storage=new Map(saved===null?[]:[['questlog.appearance',saved]]);
  const media={matches:dark,addEventListener(type,fn){this.change=fn;}};
  const root={matchMedia:()=>media,localStorage:{getItem(key){if(blocked)throw Error('Blocked');return storage.get(key)??null;},setItem(key,value){if(blocked)throw Error('Blocked');storage.set(key,value);}},addEventListener:(type,fn)=>windowEvents[type]=fn,CustomEvent:class {constructor(type,init){this.type=type;this.detail=init.detail;}},document:{documentElement:{dataset:{}},querySelector(selector){return {setAttribute:(_,value)=>metadata[selector]=value};},querySelectorAll:()=>selects,dispatchEvent:event=>events.push(event),addEventListener:(type,fn)=>documentEvents[type]=fn}};
  vm.runInNewContext(source,{window:root});
  return {root,media,storage,metadata,selects,events,windowEvents,documentEvents};
}
test('appearance resolves before modules load, follows the system by default and updates metadata',()=>{
  for(const dark of [false,true]) {
    const {root,metadata}=boot({dark});
    assert.equal(root.QuestlogTheme.preference,'system');
    assert.equal(root.document.documentElement.dataset.theme,dark?'dark':'light');
    assert.ok(metadata['meta[name="theme-color"]']?.trim(),'Browser chrome gets a theme color');
    assert.equal(metadata['meta[name="color-scheme"]'],dark?'dark':'light');
  }
});
test('explicit appearance persists, updates existing controls immediately and ignores system changes',()=>{
  const {root,media,storage,selects}=boot();
  assert.equal(root.QuestlogTheme.set('dark'),true);
  assert.equal(storage.get('questlog.appearance'),'dark');
  assert.equal(selects[0].value,'dark');
  media.matches=false;media.change();
  assert.equal(root.QuestlogTheme.theme,'dark');
  root.QuestlogTheme.set('system');
  assert.equal(root.QuestlogTheme.theme,'light');
  media.matches=true;media.change();
  assert.equal(root.QuestlogTheme.theme,'dark');
  assert.equal(boot({saved:'light',dark:true}).root.QuestlogTheme.theme,'light');
});
test('unavailable storage and invalid preferences leave a usable appearance',()=>{
  const {root}=boot({blocked:true,dark:true});
  assert.equal(root.QuestlogTheme.set('light'),false);
  assert.equal(root.QuestlogTheme.theme,'light');
  assert.equal(boot({saved:'invalid'}).root.QuestlogTheme.preference,'system');
  root.QuestlogTheme.set('invalid');
  assert.equal(root.QuestlogTheme.preference,'system');
});
test('native change events and other tabs synchronize appearance independently of character data',()=>{
  const {root,documentEvents,windowEvents,storage}=boot();
  documentEvents.change({target:{matches:()=>true,value:'dark'}});
  assert.equal(root.QuestlogTheme.theme,'dark');
  windowEvents.storage({key:'questlog.appearance',newValue:'light'});
  assert.equal(root.QuestlogTheme.theme,'light');
  windowEvents.storage({key:null,newValue:null});
  assert.equal(root.QuestlogTheme.preference,'system');
  assert.deepEqual([...storage.keys()],['questlog.appearance']);
});
test('theme runtime loads before CSS; build and offline cache include every appearance asset',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.ok(read('index.html').indexOf('src="./theme.js"')<read('index.html').indexOf('href="./theme.css"'));
  for(const asset of ['theme.js','theme.css','assets/gui/portrait-border.png','assets/gui/journal-divider.png']) {
    assert.ok(existsSync(new URL('../'+asset,import.meta.url)),asset);
    assert.ok(read('sw.js').includes(asset),`${asset} is precached`);
  }
  assert.match(read('scripts/build.mjs'),/theme\.js/);
  assert.match(read('scripts/build.mjs'),/assets\/gui/);
  assert.doesNotMatch(read('scripts/build.mjs'),/theme-showcase/);
});
