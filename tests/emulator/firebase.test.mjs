import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendEmailVerification,sendPasswordResetEmail} from 'firebase/auth';
import {CloudStore} from '../../cloud-store.js';
import {CharacterSync} from '../../cloud-sync.js';
import {demoCharacter,uid,changeHP} from '../../model.js';
import {makeOperation,queueKey,copy,splitCharacter} from '../../cloud-model.js';

const projectId='demo-questlog';let env;
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>env.clearFirestore());
after(async()=>env?.cleanup());
const storeFor=uid=>new CloudStore({sdk,db:env.authenticatedContext(uid).firestore()},uid);
const op=value=>({id:uid(),...value});
const create=async(store,c=demoCharacter())=>{await store.apply(c.id,op({create:c}));return c;};
const waitFor=async predicate=>{const until=Date.now()+15000;while(Date.now()<until){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,30));}throw new Error('Timed out waiting for realtime state');};

async function transferParty(){
  const a=storeFor('alice'),b=storeFor('bob'),c=await create(a),d=await create(b),party=await a.createParty('Shared adventure','Alice');
  await b.join(await a.invite(party),'Bob');await a.share(party,c);await b.share(party,d);
  return {a,b,c,d,party,target:{id:`bob_${d.id}`,ownerId:'bob',characterId:d.id}};
}

test('party transfers escrow coins, require the recipient, and credit an acceptance only once',async()=>{
  const {a,b,c,d,party,target}=await transferParty(),eve=storeFor('eve');
  const id=await a.offerTransfer(party,c.id,target,{kind:'money',coin:'gold',amount:9});
  await assert.rejects(a.checkTransferDeletion(c.id),/pending party transfers/);
  assert.equal((await a.readCharacter(c.id)).character.gold,c.gold-9);assert.equal((await b.readCharacter(d.id)).character.gold,d.gold);
  await assert.rejects(a.answerTransfer(party,id,true),/another player/);await assert.rejects(eve.answerTransfer(party,id,true));
  await assertFails(sdk.updateDoc(a.ref(`parties/${party}/transfers/${id}`),{status:'accepted'}));
  await assertFails(sdk.updateDoc(b.ref(`parties/${party}/transfers/${id}`),{payload:'{}'}));
  await Promise.all([b.answerTransfer(party,id,true),b.answerTransfer(party,id,true)]);
  assert.equal((await b.readCharacter(d.id)).character.gold,d.gold+9);
  await a.reclaimTransfer(party,id,{cancel:true});assert.equal((await a.readCharacter(c.id)).character.gold,c.gold-9);
  await a.checkTransferDeletion(c.id);
  assert.equal((await sdk.getDocs(sdk.collection(a.db,'users/alice/escrow'))).size,0);
  await assertFails(sdk.getDoc(b.ref(`users/alice/characters/${c.id}/content/0`)));
});

test('declined and cancelled item transfers refund once, preserve private descriptions, and survive removal',async()=>{
  const {a,b,c,d,party,target}=await transferParty(),item=c.items.find(i=>i.name==='Moonstone pendant');
  const id=await a.offerTransfer(party,c.id,target,{kind:'item',itemId:item.id,amount:1});
  assert.equal((await a.readCharacter(c.id)).character.items.some(i=>i.id===item.id),false);
  assert.equal((await sdk.getDoc(b.ref(`parties/${party}/transfers/${id}`))).data().payload.includes(item.description),false);
  await b.answerTransfer(party,id,false);await Promise.all([a.reclaimTransfer(party,id),a.reclaimTransfer(party,id)]);
  assert.deepEqual((await a.readCharacter(c.id)).character.items.find(i=>i.id===item.id),item);
  assert.equal((await b.readCharacter(d.id)).character.items.length,d.items.length);
  const pending=await b.offerTransfer(party,d.id,{id:`alice_${c.id}`,ownerId:'alice',characterId:c.id},{kind:'money',coin:'silver',amount:3});
  await a.removeMember(party,'bob');await b.recoverEscrow();
  assert.equal((await b.readCharacter(d.id)).character.silver,d.silver);
  assert.equal((await sdk.getDoc(b.ref(`parties/${party}/transfers/${pending}`))).data().status,'refunded');
});

test('competing offers cannot overspend and accepting an item preserves its quantity',async()=>{
  const {a,b,c,d,party,target}=await transferParty();
  const results=await Promise.allSettled([a.offerTransfer(party,c.id,target,{kind:'money',coin:'gold',amount:60}),a.offerTransfer(party,c.id,target,{kind:'money',coin:'gold',amount:60})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await a.readCharacter(c.id)).character.gold,14);
  const arrows=c.items.find(i=>i.name==='Arrows'),id=await a.offerTransfer(party,c.id,target,{kind:'item',itemId:arrows.id,amount:4});
  await b.answerTransfer(party,id,true);await b.answerTransfer(party,id,true);
  assert.equal((await a.readCharacter(c.id)).character.items.find(i=>i.id===arrows.id).qty,16);
  assert.equal((await b.readCharacter(d.id)).character.items.filter(i=>i.name==='Arrows').reduce((n,i)=>n+i.qty,0),24);
});

test('party session streams initiative, rest votes, exact rolls and damage activity',async()=>{
  const {a,b,c,d,party}=await transferParty();let latest;const stop=b.watchParty(party,data=>latest=data,error=>{throw error;});
  try{
    await a.setInitiative(party,`alice_${c.id}`,20,{temporaryModifier:4});await b.setInitiative(party,`bob_${d.id}`,10);
    const chars=[{id:`alice_${c.id}`},{id:`bob_${d.id}`}];await a.advanceTurn(party,chars,{start:true});
    await waitFor(()=>latest?.combat.current===`alice_${c.id}`);await b.advanceTurn(party,chars);await waitFor(()=>latest?.combat.current===`bob_${d.id}`);
    await a.advanceTurn(party,chars);await waitFor(()=>latest?.combat.round===2);
    assert.equal(latest.combat.modifiers[`alice_${c.id}`],4);await a.advanceTurn(party,chars,{end:true});await waitFor(()=>latest?.combat.active===false);assert.deepEqual(latest.combat.scores,{});assert.deepEqual(latest.combat.modifiers,{});assert.equal(latest.combat.round,1);
    const rest=await a.requestRest(party,'short',c.id);await a.replyRest(party,rest,true,c.id);await b.replyRest(party,rest,false,d.id);
    await waitFor(()=>latest?.rests.find(r=>r.id===rest)?.replies.length===2);
    await assertFails(sdk.setDoc(b.ref(`parties/${party}/rests/${rest}/replies/alice`),{yes:false,characterId:c.id,actorId:'alice'}));
    const result={expression:'2d6+3',rolls:[2,5],total:10,bonus:3,label:'Stealth',mode:'normal'};
    const event=await a.activity(party,{kind:'roll',characterId:c.id,name:c.name,result:JSON.stringify(result)});
    await waitFor(()=>latest?.activities.some(e=>e.id===event));assert.deepEqual(JSON.parse(latest.activities.find(e=>e.id===event).result),result);
    await a.apply(c.id,op({hpAction:{amount:4,kind:'damage'}}));await waitFor(()=>latest?.activities.some(e=>e.kind==='damage'));
    assert.equal(latest.characters.find(s=>s.characterId===c.id).live.hp,c.hp-4);
    const eve=storeFor('eve');await assertFails(sdk.getDoc(eve.ref(`parties/${party}/session/combat`)));await assert.rejects(eve.activity(party,{kind:'roll',characterId:c.id,name:c.name,result:'{}'}));
  }finally{stop();}
});

test('phase 1: Auth emulator creates an account, verifies, signs out and logs in',async()=>{
  const app=initializeApp({apiKey:'fake-key',projectId,appId:'emulator'},'auth-test');
  try{
    const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    const email=`quest-${uid()}@example.com`,password='sword-and-shield-123';
    const result=await createUserWithEmailAndPassword(auth,email,password);assert.equal(result.user.email,email);
    await sendEmailVerification(result.user);await sendPasswordResetEmail(auth,email);
    const id=result.user.uid;await signOut(auth);assert.equal(auth.currentUser,null);
    assert.equal((await signInWithEmailAndPassword(auth,email,password)).user.uid,id);
  }finally{await deleteApp(app);}
});
test('phase 2: uploads preserve fields, reject duplicates and deny other accounts',async()=>{
  const alice=storeFor('alice'),bob=storeFor('bob'),c=demoCharacter();c.custom={private:'🐉'.repeat(45000)};
  await create(alice,c);assert.deepEqual((await alice.readCharacter(c.id)).character,c);
  await assert.rejects(create(alice,c),/existing character ID/);
  assert.equal(await bob.readCharacter(c.id),null);
  await assertFails(sdk.getDoc(sdk.doc(bob.db,`users/alice/characters/${c.id}`)));
  await assertFails(sdk.updateDoc(sdk.doc(alice.db,alice.path(c.id)),{ownerId:'bob',revision:2}));
  await assertFails(sdk.updateDoc(sdk.doc(alice.db,`${alice.path(c.id)}/state/live`),{hp:-1,revision:2}));
  await assertFails(sdk.getDoc(sdk.doc(env.unauthenticatedContext().firestore(),alice.path(c.id))));
});

test('a guest upload stays pending through metadata acknowledgment without a second create',async()=>{
  const store=storeFor('alice'),c=demoCharacter(),state={characters:[],activeId:null},values=new Map();
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const read=store.readCharacter.bind(store),apply=store.apply.bind(store),applied=[];
  let release,reading=false;
  const gate=new Promise(resolve=>release=resolve);
  store.apply=async(id,operation)=>{applied.push(operation);return apply(id,operation);};
  store.readCharacter=async id=>{const result=await read(id);reading=true;await gate;return result;};
  const sync=new CharacterSync({store,storage,getState:()=>state,onRemote:()=>{},online:()=>true});
  let flush;
  try{
    sync.loaded=true;state.characters.push(c);sync.observe();clearTimeout(sync.timer);
    flush=sync.flush();await waitFor(()=>reading);
    await sync.receiveIndex([]);clearTimeout(sync.timer);
    release();await flush;
    assert.equal(sync.conflict,null,'The upload must not conflict with its own acknowledged create.');
    assert.equal(applied.length,1);assert.equal(sync.queue.length,0);assert.equal(sync.state,'synced');
    assert.deepEqual((await read(c.id)).character,c);
    assert.equal((await sdk.getDocs(sdk.collection(store.db,`${store.path(c.id)}/operations`))).size,1,'Only the original create receipt is stored.');
  }finally{
    release();await flush;sync.stopped=true;clearTimeout(sync.timer);clearTimeout(sync.retry);
  }
});

test('publishing app rules recovers denied listeners and queued character backups',async()=>{
  const rules=await readFile(new URL('../../firestore.rules',import.meta.url),'utf8');
  const denied=await initializeTestEnvironment({projectId,firestore:{rules:"rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }"}});
  let restored,sync;
  try{
    const store=new CloudStore({sdk,db:denied.authenticatedContext('alice').firestore()},'alice');
    const state={characters:[],activeId:null},values=new Map();
    const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),key:i=>[...values.keys()][i],get length(){return values.size;}};
    sync=new CharacterSync({store,storage,getState:()=>state,onRemote:()=>{},online:()=>true});
    sync.listenIndex();await waitFor(()=>sync.indexError);
    await sync.flush();assert.equal(sync.state,'error');assert.equal(sync.loaded,false);
    const character=demoCharacter();state.characters.push(character);sync.observe();await sync.flush();
    assert.equal(sync.queue.length,1,'A denied backup remains queued on this device.');
    assert.equal(sync.state,'error');assert.match(sync.message,/Firestore permissions/);
    restored=await initializeTestEnvironment({projectId,firestore:{rules}});
    await sync.retrySync();await waitFor(()=>sync.loaded&&sync.state==='synced'&&sync.queue.length===0);
    assert.deepEqual((await store.readCharacter(character.id)).character,character);
    assert.ok(await store.createParty('After publishing rules','Alice'));
  }finally{
    if(sync){sync.stopped=true;clearTimeout(sync.timer);clearTimeout(sync.retry);sync.indexStop?.();sync.activeStop?.();}
    if(!restored)restored=await initializeTestEnvironment({projectId,firestore:{rules}});
    await restored.cleanup();await denied.cleanup();
  }
});

test('legacy rules preserve party reads when new session listeners are denied, and retry restores them',async()=>{
  const current=await readFile(new URL('../../firestore.rules',import.meta.url),'utf8'),legacy=await readFile(new URL('../fixtures/pre-party-play.rules',import.meta.url),'utf8');
  const a=storeFor('alice'),id=await a.createParty('A party that already exists','Alice');let latest,stop,legacyEnv,restored;const errors=[];
  try{
    legacyEnv=await initializeTestEnvironment({projectId,firestore:{rules:legacy}});
    assert.equal(await a.partyAccess(id),true);
    stop=a.watchParty(id,data=>latest=data,error=>errors.push(error));
    await waitFor(()=>latest?.name==='A party that already exists'&&latest.errors.combat&&latest.errors.activities&&latest.errors.transfers&&latest.errors.rests);
    assert.deepEqual(errors,[],'Feature permission errors must not report revoked membership.');
    assert.equal(latest.members[0].uid,'alice');
    const created=await a.createParty('Created under legacy rules','Alice');assert.equal(await a.partyAccess(created),true);
    stop();restored=await initializeTestEnvironment({projectId,firestore:{rules:current}});
    latest=null;stop=a.watchParty(id,data=>latest=data,error=>errors.push(error));
    await waitFor(()=>latest?.name==='A party that already exists'&&latest.members.length===1);
    await a.setInitiative(id,'alice_character',17);await waitFor(()=>latest.combat.scores?.alice_character===17);
    assert.deepEqual(latest.errors,{});assert.deepEqual(errors,[]);
    await sdk.deleteDoc(a.ref(`parties/${id}`));await waitFor(()=>errors.length===1);
    assert.equal(errors[0].code,'questlog/party-access-ended','A deleted party still ends access.');
  }finally{
    stop?.();if(!restored)restored=await initializeTestEnvironment({projectId,firestore:{rules:current}});
    await restored.cleanup();await legacyEnv?.cleanup();
  }
});
test('phase 2: two devices merge independent fields and surface overlapping edits',async()=>{
  const a=storeFor('alice'),b=storeFor('alice'),c=await create(a),left=copy(c),right=copy(c);
  left.name='Left device';right.campaign='Right device';
  await Promise.all([a.apply(c.id,op(makeOperation(c,left))),b.apply(c.id,op(makeOperation(c,right)))]);
  const merged=(await a.readCharacter(c.id)).character;assert.equal(merged.name,left.name);assert.equal(merged.campaign,right.campaign);
  right.name='Overlapping name';await assert.rejects(b.apply(c.id,op(makeOperation(c,right))),/overlap/);
  assert.equal((await a.readCharacter(c.id)).character.name,left.name);
});
test('phase 2: deletion removes sheet content and blocks resurrection by an old device',async()=>{
  const a=storeFor('alice'),c=await create(a);
  await a.apply(c.id,op({delete:true,revision:1,liveRevision:1}));assert.equal(await a.readCharacter(c.id),null);
  assert.equal((await sdk.getDoc(sdk.doc(a.db,`${a.path(c.id)}/content/0`))).exists(),false);
  assert.equal((await sdk.getDoc(sdk.doc(a.db,`${a.path(c.id)}/state/live`))).exists(),false);
  await assert.rejects(a.apply(c.id,op({hpAction:{kind:'heal',amount:1}})),/deleted/);
});
test('phase 4: concurrent damage/healing, temp HP, receipts, slots and conditions',async()=>{
  const a=storeFor('alice'),b=storeFor('alice'),c=demoCharacter();c.hp=20;c.tempHp=5;await create(a,c);
  const damage=op({hpAction:{kind:'damage',amount:12}});
  await Promise.all([a.apply(c.id,damage),b.apply(c.id,op({hpAction:{kind:'damage',amount:3}}))]);
  let remote=(await a.readCharacter(c.id)).character;assert.equal(remote.hp,10);assert.equal(remote.tempHp,0);
  await b.apply(c.id,damage);assert.equal((await a.readCharacter(c.id)).character.hp,10);
  await a.apply(c.id,op({hpAction:{kind:'heal',amount:999}}));assert.equal((await a.readCharacter(c.id)).character.hp,c.maxHp);
  const updated=copy(remote);updated.conditions=['Poisoned'];updated.slots[0].used=2;updated.features[0].used=1;
  await a.apply(c.id,op(makeOperation(remote,updated)));
  remote=(await a.readCharacter(c.id)).character;assert.deepEqual(remote.conditions,['Poisoned']);assert.equal(remote.slots[0].used,2);assert.equal(remote.features[0].used,1);assert.equal(remote.hp,c.maxHp);
  const chunks=await sdk.getDocs(sdk.collection(a.db,`${a.path(c.id)}/content`));assert.equal(chunks.docs[0].data().json.includes('"hp"'),false);
});
test('phase 3: unpredictable invitations enforce membership, expiry and revocation',async()=>{
  const a=storeFor('alice'),b=storeFor('bob'),eve=storeFor('eve'),party=await a.createParty('The Brick Fellowship','Alice');
  await assertFails(sdk.getDoc(sdk.doc(b.db,`parties/${party}`)));
  await assertFails(sdk.setDoc(sdk.doc(b.db,`parties/${party}/members/bob`),{uid:'bob',displayName:'Bob',invitation:'',joinedAt:sdk.serverTimestamp()}));
  await assertFails(sdk.getDocs(sdk.collection(b.db,'invitations')));
  const token=await a.invite(party);assert.match(token,/^[a-f0-9]{64}$/);assert.equal(await b.join(token,'Bob'),party);
  await assertSucceeds(sdk.getDoc(sdk.doc(b.db,`parties/${party}`)));
  await assertFails(sdk.updateDoc(sdk.doc(b.db,`parties/${party}`),{ownerId:'bob'}));
  await a.revoke(party,token);await assert.rejects(eve.join(token,'Eve'),/revoked/);
  await assertFails(sdk.setDoc(sdk.doc(eve.db,`parties/${party}/members/eve`),{uid:'eve',displayName:'Eve',invitation:token,joinedAt:sdk.serverTimestamp()}));
  await assert.rejects(eve.join('0'.repeat(64),'Eve'),/invalid/);
  const expired='f'.repeat(64);await env.withSecurityRulesDisabled(async context=>sdk.setDoc(sdk.doc(context.firestore(),`invitations/${expired}`),{partyId:party,creatorId:'alice',revoked:false,createdAt:sdk.Timestamp.fromMillis(1)}));
  await assert.rejects(eve.join(expired,'Eve'),/expired/);
  await assertFails(sdk.setDoc(sdk.doc(eve.db,`parties/${party}/members/eve`),{uid:'eve',displayName:'Eve',invitation:expired,joinedAt:sdk.serverTimestamp()}));
  await assertFails(sdk.updateDoc(sdk.doc(b.db,`parties/${party}/members/bob`),{role:'owner'}));
  await a.removeMember(party,'bob');await assertFails(sdk.getDoc(sdk.doc(b.db,`parties/${party}`)));
});
test('phase 3: removing a member revokes shared reads and owner saves detach safely',async()=>{
  const a=storeFor('alice'),b=storeFor('bob'),c=await create(b),party=await a.createParty('Removal table','Alice');
  await b.join(await a.invite(party),'Bob');await b.share(party,c);
  await assertFails(sdk.updateDoc(sdk.doc(a.db,b.path(c.id)),{name:'Creator cannot edit',revision:2}));
  await a.removeMember(party,'bob');
  await assertFails(sdk.getDoc(sdk.doc(b.db,`parties/${party}/characters/bob_${c.id}`)));
  await b.apply(c.id,op({hpAction:{kind:'damage',amount:1}}));
  const remote=await b.readCharacter(c.id);assert.equal(remote.character.hp,c.hp-1);assert.equal(remote.meta.partyId,'');
  assert.equal((await sdk.getDocs(sdk.collection(a.db,`parties/${party}/characters`))).size,0);
});
test('phase 3: creators transfer to an existing member when leaving, and the last member can close',async()=>{
  const a=storeFor('alice'),b=storeFor('bob'),party=await a.createParty('Handing over the map','Alice'),token=await a.invite(party);
  await b.join(token,'Bob');await assertFails(a.transferAndLeave(party,'stranger'));
  await a.transferAndLeave(party,'bob');await assertFails(sdk.getDoc(sdk.doc(a.db,`parties/${party}`)));
  assert.equal((await sdk.getDoc(sdk.doc(b.db,`parties/${party}`))).data().ownerId,'bob');
  await b.closeParty(party);await assert.rejects(a.join(token,'Alice'),/revoked/);
  assert.equal((await sdk.getDocs(sdk.collection(b.db,'users/bob/parties'))).size,0);
});
test('phase 4: party listeners receive small live updates; shared sheets remain read-only',async()=>{
  const a=storeFor('alice'),b=storeFor('bob'),c=await create(a),party=await a.createParty('Live table','Alice');
  await b.join(await a.invite(party),'Bob');await a.share(party,c);
  let snapshot;const stop=b.watchParty(party,data=>{snapshot=data;},error=>{throw error;});
  try{
    await waitFor(()=>snapshot?.characters[0]?.live?.hp===c.hp);
    const shared=snapshot.characters[0];assert.equal(shared.sheet.notes,undefined);
    const readOnly=await b.readShared(party,shared.id);assert.deepEqual(readOnly.sheet.details.stats,c.stats);assert.equal(readOnly.sheet.details.spells[0].notes,undefined);assert.equal(readOnly.sheet.details.attacks[0].notes,undefined);
    await a.apply(c.id,op({hpAction:{kind:'damage',amount:12}}));
    await waitFor(()=>snapshot?.characters[0]?.live?.hp===c.hp-12);
    const path=`parties/${party}/characters/alice_${c.id}`;
    await assertFails(sdk.updateDoc(sdk.doc(b.db,path),{'sheet.name':'Hijack'}));
    await assertFails(sdk.updateDoc(sdk.doc(b.db,`${path}/state/live`),{hp:99,revision:3}));
    await assertFails(sdk.setDoc(sdk.doc(b.db,`${path}/sheet/0`),{json:'{}'}));
    await assertFails(sdk.getDoc(sdk.doc(b.db,`${a.path(c.id)}/content/0`)));
    await a.unshare(party,c.id);await waitFor(()=>snapshot?.characters.length===0);
  }finally{stop();}
});
test('phase 4: durable offline queue survives restart and deduplicates a lost acknowledgement',async()=>{
  const a=storeFor('alice'),c=await create(a),values=new Map(),storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const state={characters:[copy(c)],activeId:c.id};let online=false;
  // CharacterSync only uses window for listener registration in start(), so this
  // test exercises durable capture/restart/replay directly against Firestore.
  const options={store:a,storage,getState:()=>state,online:()=>online,onRemote:(id,remote)=>{state.characters=[remote];}};
  const first=new CharacterSync(options);first.loaded=true;first.activeId=c.id;first.meta.set(c.id,{revision:1,liveRevision:1});
  changeHP(state.characters[0],12,'damage');first.observe(new Map([[c.id,{kind:'damage',amount:12}]]));clearTimeout(first.timer);
  assert.equal(first.queue.length,1);assert.match([...values.values()].join(''),/damage/);
  const operation=first.queue[0];await a.apply(c.id,operation); // server committed; simulate response lost
  const restarted=new CharacterSync(options);online=true;await restarted.flush();
  assert.equal(restarted.queue.length,0);assert.equal((await a.readCharacter(c.id)).character.hp,c.hp-12);
  clearTimeout(restarted.retry);
});
test('phase 4: public sheets larger than one document are chunked and loaded read-only',async()=>{
  const a=storeFor('alice'),b=storeFor('bob'),c=demoCharacter(),template=c.spells[0];
  c.spells=Array.from({length:150},(_,i)=>({...template,id:uid(),name:`Public spell ${i}`,notes:'',school:'s'.repeat(2000),castingTime:'c'.repeat(2000),range:'r'.repeat(2000),duration:'d'.repeat(2000)}));
  await create(a,c);const party=await a.createParty('Large sheets','Alice');await b.join(await a.invite(party),'Bob');await a.share(party,c);
  const path=`parties/${party}/characters/alice_${c.id}`,meta=(await sdk.getDoc(sdk.doc(a.db,path))).data();
  assert.ok(meta.chunks>1);assert.equal(meta.sheet.details,undefined);
  const shared=await b.readShared(party,`alice_${c.id}`);assert.equal(shared.sheet.details.spells.length,150);
  assert.ok(Buffer.byteLength(JSON.stringify(shared.sheet.details))>1048576);
  const chunks=await sdk.getDocs(sdk.collection(a.db,`${path}/sheet`));assert.ok(chunks.docs.every(d=>Buffer.byteLength(d.data().json)<240000));
  await a.apply(c.id,op({hpAction:{kind:'damage',amount:1}}));assert.equal((await sdk.getDoc(sdk.doc(a.db,path))).data().detailsHash,meta.detailsHash);
  await a.unshare(party,c.id);assert.equal((await sdk.getDocs(sdk.collection(a.db,`${path}/sheet`))).size,0);
});
