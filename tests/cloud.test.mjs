import test from 'node:test';
import assert from 'node:assert/strict';
import {demoCharacter,parseBackup} from '../model.js';
import {configuration} from '../firebase-config.js';
import {authMessage} from '../firebase-client.js';
import {CharacterSync} from '../cloud-sync.js';
import {splitCharacter,joinCharacter,fragments,makeOperation,applyLive,applyFields,publicProjection,accountKey,invitationToken,CloudConflict,emptyState} from '../cloud-model.js';

test('phase 1: missing configuration preserves optional guest entry point',()=>{
  assert.equal(configuration({QUESTLOG_FIREBASE_CONFIG:null}),null);
  assert.ok(configuration({}).projectId);
  assert.match(authMessage({code:'auth/popup-closed-by-user'}),/cancelled/);
  assert.match(authMessage({code:'auth/account-exists-with-different-credential'}),/originally used/);
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
