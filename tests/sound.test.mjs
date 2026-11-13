import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {createSoundManager,AUDIO_PREFERENCES_KEY} from '../sound.js';
import {SOUND_ASSETS,SOUND_FILES} from '../sound-assets.js';
import {SOUND_EVENTS,spellSoundEvent,weaponSoundEvent,rollSoundEvent} from '../sound-events.js';
import {defaultPartyState} from './helpers/default-party.mjs';
import {parseBackup,SAVE_VERSION} from '../model.js';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFile(resolve(root,path));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('curated local assets have approved provenance, hashes, formats and event mappings',async()=>{
  const manifest=JSON.parse(await read('assets/sfx/manifest.json'));
  const selection=JSON.parse(await read('scripts/sfx-selection.json'));
  const evidence=JSON.parse(await read('assets/sfx/license-evidence.json'));
  assert.match(manifest.source.revision,/^[a-f0-9]{40}$/);
  assert.equal(manifest.source.revision,selection.revision);
  assert.equal(manifest.source.catalogSha256,selection.catalogSha256);
  assert.ok(manifest.assets.length>=40&&manifest.assets.length<=70);
  assert.equal(new Set(manifest.assets.map(a=>a.id)).size,manifest.assets.length);
  assert.deepEqual(Object.keys(SOUND_ASSETS),manifest.assets.map(a=>a.id));
  const referenced=new Set(Object.values(SOUND_EVENTS).flatMap(e=>e.variants));
  for(const [event,definition] of Object.entries(SOUND_EVENTS)){
    assert.ok(definition.variants.length,event);
    for(const id of definition.variants)assert.ok(SOUND_ASSETS[id],`${event}: ${id}`);
  }
  let bytes=0;
  for(const asset of manifest.assets){
    assert.ok(referenced.has(asset.id),`Unmapped asset: ${asset.id}`);
    assert.equal(asset.license,'CC0-1.0');assert.ok(asset.author&&asset.pack&&asset.sourceURL);
    const proof=evidence.find(p=>p.sourceURL===asset.sourceURL);assert.equal(proof?.license,'CC0-1.0');assert.equal(proof.evidenceType,'original-source-page');assert.match(proof.sourcePageSha256,/^[a-f0-9]{64}$/);
    assert.match(asset.originalSha256,/^[a-f0-9]{64}$/);
    const chosen=selection.sounds.find(s=>s.id===asset.id);assert.ok(chosen);
    if(asset.catalogId){assert.equal(asset.catalogId,chosen.catalogId);assert.ok(asset.sourceFileURL.includes('/'+manifest.source.revision+'/'));}
    else {assert.equal(chosen.license,'CC0-1.0');assert.equal(asset.originalSha256,chosen.sha256);}
    assert.ok(asset.duration>0&&asset.duration<=15,asset.id);
    for(const format of ['ogg','mp3']){
      const path=asset.files[format];assert.match(path,/^assets\/sfx\/[a-z0-9/-]+\.(ogg|mp3)$/);
      const file=await read(path);assert.equal(hash(file),asset.sha256[format]);assert.equal(file.length,asset.sizes[format]);bytes+=file.length;
      if(format==='ogg')assert.equal(file.subarray(0,4).toString(),'OggS');
      assert.equal(SOUND_ASSETS[asset.id].files[format],path);
    }
  }
  assert.ok(bytes<2_000_000,'Keep the bundled audio small');
  assert.ok((await read('assets/sfx/CREDITS.md')).length);
  const shipped=[];for(const d of await readdir(resolve(root,'assets/sfx'),{withFileTypes:true}))if(d.isDirectory())for(const f of await readdir(resolve(root,'assets/sfx',d.name)))if(/\.(ogg|mp3)$/.test(f))shipped.push(`assets/sfx/${d.name}/${f}`);
  assert.deepEqual(shipped.sort(),[...SOUND_FILES].sort(),'No untracked/unapproved audio');
});

function fixture(overrides={}){
  const store=new Map();let created=0,allocations=0,fetches=0,decodes=0,clock=1000,hidden=false;
  const context={currentTime:0,destination:{},resume:()=>Promise.resolve(),decodeAudioData:async()=>{decodes++;return {duration:.5};},createGain:()=>({gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}},connect(){},disconnect(){}}),createBufferSource:()=>{allocations++;return {connect(){},disconnect(){},start(){},stop(){}};}};
  const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
  const manager=createSoundManager({createContext:()=>{created++;return context;},storage,fetchAudio:async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};},now:()=>clock,isHidden:()=>hidden,...overrides});
  return {manager,context,storage,store,tick:()=>clock+=1000,background:()=>hidden=true,stats:()=>({created,allocations,fetches,decodes})};
}
test('disabled mode and autoplay lock allocate no audio and make no requests',async()=>{
  const f=fixture();assert.equal(f.manager.unlock(),false);assert.equal(await f.manager.play('dice.roll'),false);
  f.manager.configure({enabled:true});assert.equal(await f.manager.play('dice.roll'),false);
  assert.deepEqual(f.stats(),{created:0,allocations:0,fetches:0,decodes:0});
  f.manager.unlock();f.manager.configure({enabled:false});assert.equal(await f.manager.play('dice.roll'),false);assert.equal(f.stats().allocations,0);
});
test('unsupported, missing and invalid audio fail safely; MP3 is a local fallback',async()=>{
  const requested=[];const f=fixture({fetchAudio:async url=>{requested.push(url.href);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
  f.context.decodeAudioData=async()=>{if(requested.at(-1).endsWith('.ogg'))throw Error('Unsupported Vorbis');return {duration:.4};};
  f.manager.configure({enabled:true});f.manager.unlock();assert.equal(await f.manager.play('ui.confirm'),true);
  assert.ok(requested[0].endsWith('.ogg'));assert.ok(requested[1].endsWith('.mp3'));
  assert.equal(await f.manager.play('unknown.event'),false);f.manager.stopAll();
  for(const fetchAudio of [async()=>{throw Error('Offline missing asset');},async()=>({ok:false})]){
    const f=fixture({fetchAudio});f.manager.configure({enabled:true});f.manager.unlock();assert.equal(await f.manager.play('ui.confirm'),false);assert.equal(f.manager.diagnostics().voices,0);
  }
  const noAudio=fixture({createContext:()=>null});noAudio.manager.configure({enabled:true});assert.equal(noAudio.manager.unlock(),false);assert.equal(await noAudio.manager.play('ui.confirm'),false);
  const invalid=fixture({events:{bad:{variants:['bad'],category:'dice',gain:1,cooldown:0}},assets:{bad:{files:{ogg:'https://external.invalid/sound.ogg'}}}});invalid.manager.configure({enabled:true});invalid.manager.unlock();assert.equal(await invalid.manager.play('bad'),false);assert.equal(invalid.stats().fetches,0);
});
test('cooldowns, per-event limits, global limits and decoded cache bound repeated events',async()=>{
  const f=fixture();f.manager.configure({enabled:true});f.manager.unlock();
  await f.manager.play('ui.confirm');assert.equal(await f.manager.play('ui.confirm'),false);
  for(let i=0;i<80;i++){f.tick();await f.manager.play('ui.confirm');}
  assert.equal(f.manager.diagnostics().voices,2);assert.equal(f.stats().created,1);assert.equal(f.stats().fetches,1);
  for(const event of Object.keys(SOUND_EVENTS)){f.tick();await f.manager.play(event);assert.ok(f.manager.diagnostics().voices<=8);assert.ok(f.manager.diagnostics().cached<=24);}
  f.manager.configure({enabled:false});assert.equal(f.manager.diagnostics().voices,0);
});
test('mute and ambience cancellation invalidate pending loads before they can play',async()=>{
  let release;const f=fixture({fetchAudio:()=>new Promise(resolve=>release=()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}))});
  f.manager.configure({enabled:true});f.manager.unlock();const pending=f.manager.startAmbience();f.manager.stopAmbience(0);release();assert.equal(await pending,false);assert.equal(f.stats().allocations,0);
  f.tick();const next=f.manager.play('ui.confirm');f.manager.configure({enabled:false});release();assert.equal(await next,false);assert.equal(f.stats().allocations,0);
});
test('a burst cannot create unbounded pending downloads or play after cancellation',async()=>{
  const releases=[];const f=fixture({fetchAudio:()=>new Promise(resolve=>{releases.push(()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}));})});
  f.manager.configure({enabled:true});f.manager.unlock();
  const pending=Object.keys(SOUND_EVENTS).map(event=>f.manager.play(event));
  assert.ok(f.manager.diagnostics().pending<=8);assert.ok(releases.length<=8);
  f.manager.stopAll();for(const release of releases)release();
  assert.ok((await Promise.all(pending)).every(result=>result===false));
  assert.equal(f.manager.diagnostics().pending,0);assert.equal(f.stats().allocations,0);
});
test('volume/category preferences persist separately and tolerate corrupt or unavailable storage',async()=>{
  const f=fixture();f.manager.configure({enabled:true,volume:.37,categories:{magic:.22,combat:0}});f.manager.unlock();
  assert.equal(await f.manager.play('combat.sword'),false);
  const reloaded=createSoundManager({storage:f.storage});assert.equal(reloaded.getPreferences().volume,.37);assert.equal(reloaded.getPreferences().categories.magic,.22);
  assert.equal(reloaded.diagnostics().enabled,false,'Master enable stays in the existing character settings');
  f.store.set(AUDIO_PREFERENCES_KEY,'broken');assert.equal(createSoundManager({storage:f.storage}).getPreferences().volume,.65);
  f.store.set(AUDIO_PREFERENCES_KEY,JSON.stringify({volume:99,categories:{magic:-8,dice:'bad'}}));const safe=createSoundManager({storage:f.storage}).getPreferences();assert.equal(safe.volume,1);assert.equal(safe.categories.magic,0);assert.equal(safe.categories.dice,1);
  const unavailable=fixture({storage:{getItem(){throw Error('Unavailable');},setItem(){throw Error('Full');}}});assert.doesNotThrow(()=>unavailable.manager.configure({volume:.5}));
  f.manager.configure({volume:0});assert.equal(await f.manager.play('ui.confirm'),false);
});
test('background playback is blocked and ambience stops without stopping other effects',async()=>{
  const f=fixture();f.manager.configure({enabled:true});f.manager.unlock();await f.manager.startAmbience();await f.manager.play('ui.confirm');
  assert.equal(f.manager.diagnostics().voices,2);f.manager.stopAmbience(0);assert.equal(f.manager.diagnostics().voices,1);
  f.background();assert.equal(await f.manager.play('dice.roll'),false);f.manager.stopAll();
});
test('combat metadata and spell names resolve meaningful cues without inventing hit results',()=>{
  assert.equal(weaponSoundEvent({name:'Longbow'},null,{ranged:true}),'combat.bow');
  assert.equal(weaponSoundEvent({name:'Dagger'}),'combat.dagger');
  assert.equal(weaponSoundEvent({name:'Greatsword'}),'combat.heavy');
  assert.equal(weaponSoundEvent({name:'Mace',type:'Bludgeoning'},null,{phase:'impact'}),null);
  assert.equal(weaponSoundEvent({name:'Mace',type:'Bludgeoning'},null,{phase:'impact',outcome:'hit'}),'combat.blunt');
  assert.equal(weaponSoundEvent({name:'Longbow'},null,{ranged:true,phase:'damage',outcome:'hit'}),'combat.arrow-hit');
  assert.equal(weaponSoundEvent({},null,{outcome:'miss'}),'combat.miss');
  for(const [name,event] of [['Healing Word','heal'],['Fireball','fire'],['Ray of Frost','ice'],['Lightning Bolt','lightning'],['Sacred Flame','radiant'],['Chill Touch','dark'],['Shield','protect'],['Custom spell','cast']])assert.equal(spellSoundEvent({name}),'magic.'+event);
  assert.equal(spellSoundEvent({name:'Custom',school:'Abjuration'}),'magic.protect');
  assert.equal(rollSoundEvent({rolls:[]}),null);assert.equal(rollSoundEvent({rolls:[10]},'DEX save'),'dice.check');assert.equal(rollSoundEvent({rolls:[1,3]}),'dice.multiple');
});
test('existing version 2 backups retain their settings and round-trip without new fields',()=>{
  for(const enabled of [false,true]){
    const state=defaultPartyState();state.settings.sound=enabled;assert.equal(state.version,SAVE_VERSION);
    const restored=parseBackup(JSON.stringify(state));assert.deepEqual(restored.settings,{sound:enabled});assert.deepEqual(parseBackup(JSON.stringify(restored)),state);
  }
});
test('service worker caches all encodings and sound modules under its own subdirectory',async()=>{
  let assets;const code=(await read('sw.js')).toString().replace(/^import .*;$/gm,'');
  vm.runInNewContext(code+'\ncapture(ASSETS);',{LDRAW_ICONS:{},SOUND_FILES,self:{addEventListener(){},skipWaiting(){}},capture:urls=>assets=urls,URL,Response});
  for(const path of [...SOUND_FILES,'sound.js','sound-events.js','sound-assets.js','assets/sfx/manifest.json'])assert.ok(assets.includes('./'+path),path);
  assert.ok(assets.every(path=>!/^https?:/.test(path)));
});
