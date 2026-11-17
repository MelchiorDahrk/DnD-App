import test from 'node:test';
import assert from 'node:assert/strict';
import {demoCharacter,parseBackup} from '../model.js';
import {configuration} from '../firebase-config.js';
import {authMessage,cloudMessage} from '../firebase-client.js';
import {CharacterSync} from '../cloud-sync.js';
import {splitCharacter,joinCharacter,fragments,makeOperation,applyLive,applyFields,publicProjection,accountKey,invitationToken,CloudConflict,emptyState} from '../cloud-model.js';

test('phase 1: missing configuration preserves optional guest entry point',()=>{
  assert.equal(configuration({QUESTLOG_FIREBASE_CONFIG:null}),null);
  assert.ok(configuration({}).projectId);
  assert.match(authMessage({code:'auth/popup-closed-by-user'}),/cancelled/);
  assert.match(authMessage({code:'auth/account-exists-with-different-credential'}),/originally used/);
});

test('Firestore permission errors explain the required rules and preserve local copies',()=>{
  const denied={code:'permission-denied',message:'Missing or insufficient permissions.'};
  assert.match(cloudMessage(denied),/publish Questlog’s Firestore rules/);
  assert.match(cloudMessage(denied),/local characters are preserved/);
  assert.equal(authMessage(denied),cloudMessage(denied));
  assert.equal(cloudMessage({...denied,code:'firestore/permission-denied'}),cloudMessage(denied));
});

test('denied character index stays in error and retry reconnects after rules are published',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let deny,indexWatches=0,stops=0;
  const state={characters:[],activeId:null};
  const store={uid:'alice',watchIndex:(next,error)=>{indexWatches++;if(indexWatches===1)deny=error;else next([]);return ()=>stops++;}};
  const sync=new CharacterSync({store,storage:{getItem:()=>null},getState:()=>state,onRemote:()=>{},online:()=>true});
  // Mimic Firestore's terminal listener error, including an empty local queue.
  sync.listenIndex();deny({code:'permission-denied',message:'Missing or insufficient permissions.'});
  await sync.flush();
  assert.equal(sync.state,'error','An empty queue cannot conceal a denied database read.');
  assert.equal(sync.loaded,false);assert.match(sync.message,/Firestore permissions/);
  await sync.retrySync();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(indexWatches,2);assert.equal(stops,1);
  assert.equal(sync.loaded,true);assert.equal(sync.state,'synced');
});
test('phase 2: private content and all custom fields survive split, fragments and v2 backup',()=>{
  const c=demoCharacter();c.custom={value:'🐉'.repeat(70000)};
  const {content,live}=splitCharacter(c),chunks=fragments(content);
  assert.ok(chunks.length>1);assert.ok(chunks.every(chunk=>new TextEncoder().encode(chunk).length<=240000));
  assert.equal(content.hp,undefined);assert.equal(content.slots[0].used,undefined);
  const restored=joinCharacter(JSON.parse(chunks.join('')),live);
  assert.deepEqual(restored,c);
  assert.deepEqual(parseBackup(JSON.stringify({...emptyState(),characters:[c],activeId:c.id})).characters[0],c);
  assert.notEqual(accountKey('alice'),accountKey('bob'));assert.equal(accountKey(null),'questlog.v2');
});
test('phase 2: unchanged sheets produce no field changes and independent fields merge',()=>{
  const c=demoCharacter(),same=makeOperation(c,structuredClone(c));assert.equal(same.content.length,0);assert.equal(same.live.length,0);
  const changed=structuredClone(c);changed.name='A new name';const op=makeOperation(c,changed);
  const current=splitCharacter(c).content;current.campaign='Another device';
  assert.equal(applyFields(current,op.content).campaign,'Another device');
  current.name='Simultaneous name';assert.throws(()=>applyFields(current,op.content),CloudConflict);
});
test('phase 4: damage and healing replay on current HP using existing temp HP and death rules',()=>{
  const c=demoCharacter();c.hp=20;c.tempHp=5;
  const d=structuredClone(c);d.hp=13;d.tempHp=0;
  const damage=makeOperation(c,d,{kind:'damage',amount:12});assert.equal(damage.content.length,0);assert.equal(damage.live.length,0);
  const once=applyLive(splitCharacter(c).live,damage);assert.equal(once.hp,13);assert.equal(once.tempHp,0);
  const twice=applyLive(once,damage);assert.equal(twice.hp,1);
  const healed=applyLive({...twice,hp:0,deathSuccess:2,deathFailure:2},{hpAction:{kind:'heal',amount:99}});
  assert.equal(healed.hp,c.maxHp);assert.equal(healed.deathSuccess,0);assert.equal(healed.deathFailure,0);
  assert.equal(applyLive({...healed,tempHp:10},{hpAction:{kind:'temp',amount:3}}).tempHp,10);
});
test('phase 4: condition changes merge and resource conflicts require resolution',()=>{
  const c=demoCharacter(),next=structuredClone(c);next.conditions=['Poisoned'];next.slots[0].used=2;
  const op=makeOperation(c,next),current=splitCharacter(c).live;current.conditions=['Prone'];
  assert.deepEqual(applyLive(current,op).conditions,['Prone','Poisoned']);
  current.slotUses[0]=3;assert.throws(()=>applyLive(current,op),CloudConflict);
});
test('phase 3: public projection excludes notes and arbitrary custom metadata; invitations are random',()=>{
  const c=demoCharacter();c.privateToken='private';const shared=publicProjection(c);
  for(const key of ['notes','items','spells','privateToken','personalityTraits','campaign'])assert.equal(shared[key],undefined);
  assert.equal(shared.features[0].description,undefined);
  const a=invitationToken(),b=invitationToken();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);
});
test('phase 4: identical concurrent complex live edits conflict instead of being silently dropped',()=>{
  const c=demoCharacter(),next=structuredClone(c);next.inspiration=1;
  const operation=makeOperation(c,next),once=applyLive(splitCharacter(c).live,operation);
  assert.throws(()=>applyLive(once,operation),CloudConflict);
});
test('phase 2: an older cloud read finishing later cannot replace a newer sheet',async()=>{
  const c=demoCharacter(),pending=[],received=[];
  const store={uid:'alice',readCharacter:()=>new Promise(resolve=>pending.push(resolve))};
  const sync=new CharacterSync({store,storage:{getItem:()=>null},getState:()=>({characters:[c]}),onRemote:(id,value)=>received.push(value),online:()=>true});
  const first=sync.refresh(c.id),second=sync.refresh(c.id),live={...splitCharacter(c).live,revision:1};
  pending[1]({character:{...c,name:'Newer'},meta:{revision:2},live});await second;
  pending[0]({character:c,meta:{revision:1},live});await first;
  assert.equal(received.length,1);assert.equal(sync.remote.get(c.id).name,'Newer');
});
test('phase 4: queue storage failure preserves the baseline and reports unsaved work',()=>{
  const c=demoCharacter(),state={characters:[c],activeId:c.id};
  const sync=new CharacterSync({store:{uid:'alice'},storage:{getItem:()=>null,setItem:()=>{throw new Error('Full');},removeItem:()=>{}},getState:()=>state,onRemote:()=>{},online:()=>false});
  c.hp--;assert.equal(sync.observe(new Map([[c.id,{kind:'damage',amount:1}]])),false);
  assert.equal(sync.queue.length,0);assert.equal(sync.baseline.get(c.id).hp,c.hp+1);assert.equal(sync.state,'error');
});

test('edits queued while a completed flush releases its browser lock still upload',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  t.after(()=>{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;});
  let release,completed;
  const gate=new Promise(resolve=>release=resolve),finished=new Promise(resolve=>completed=resolve);
  let requests=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,work)=>{
    await work();if(++requests===1){completed();await gate;}
  }}}});
  const state={characters:[],activeId:null},applied=[],storage=new Map();
  let uploaded;
  const store={uid:'alice',apply:async(id,op)=>{applied.push(op);uploaded=op.create;},readCharacter:async()=>({character:uploaded,meta:{revision:1},live:{...splitCharacter(uploaded).live,revision:1}})};
  const sync=new CharacterSync({store,storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},getState:()=>state,onRemote:()=>{},online:()=>true});
  sync.loaded=true;
  const initial=sync.flush();await finished;
  state.characters.push(demoCharacter());sync.observe();t.mock.timers.tick(0);
  assert.equal(applied.length,0,'The first flush still holds the lock.');
  release();await initial;
  // Let any immediately requested follow-up finish without an online/retry event.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(applied.length,1,'The queued upload must not need another event.');
  assert.equal(sync.queue.length,0);assert.equal(sync.state,'synced');
});

for(const conflict of [false,true])test(`concurrent flush requests preserve ${conflict?'conflict resolution':'error retry backoff'}`,async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const c=demoCharacter(),state={characters:[c]},storage=new Map();let calls=0;
  const store={uid:'alice',apply:async()=>{calls++;throw conflict?new CloudConflict(['name']):new Error('Temporarily unavailable');}};
  const sync=new CharacterSync({store,storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},getState:()=>state,onRemote:()=>{},online:()=>true,onStatus:({state})=>{if(state==='pending')sync.flush();}});
  sync.queue.push({id:'queued',characterId:c.id,create:c});sync.saveQueue();
  await sync.flush();
  assert.equal(calls,1);assert.equal(sync.queue.length,1);assert.equal(sync.state,conflict?'conflict':'error');
  t.mock.timers.tick(9999);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1,'Concurrent requests must not bypass the retry delay.');
  t.mock.timers.tick(1);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,conflict?1:2,'Conflicts stay paused; connection failures keep their scheduled retry.');
});
