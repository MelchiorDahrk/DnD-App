import {copy,equal,splitCharacter,joinCharacter,fragments,applyFields,applyLive,CloudConflict,publicProjection,invitationToken,validPublicDetails} from './cloud-model.js';
import {PartyStore} from './party-store.js';
import {liveActivities} from './party-model.js';

export class CloudStore extends PartyStore {
  constructor(client,uid){super();this.client=client;this.s=client.sdk;this.db=client.db;this.uid=uid;}
  ref(path){return this.s.doc(this.db,path);}
  async sharedData(character){
    const sheet=publicProjection(character),details=sheet.details;delete sheet.details;
    const chunks=fragments(details),hash=async text=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
    const [detailsHash,sheetHash]=await Promise.all([hash(chunks.join('')),hash(JSON.stringify(sheet))]);
    return {sheet,chunks,detailsHash,sheetHash};
  }
  async readShared(partyId,id){
    const path=`parties/${partyId}/characters/${id}`;
    return this.s.runTransaction(this.db,async tx=>{
      const [shared,live]=await Promise.all([tx.get(this.ref(path)),tx.get(this.ref(`${path}/state/live`))]);
      if(!shared.exists())throw new Error('This character is no longer shared.');
      const data=shared.data(),parts=await Promise.all(Array.from({length:data.chunks},(_,i)=>tx.get(this.ref(`${path}/sheet/${i}`))));
      const details=JSON.parse(parts.map(d=>d.data().json).join(''));
      if(!validPublicDetails(details))throw new Error('This shared sheet contains invalid data. Ask its owner to share it again.');
      return {id,...data,sheet:{...data.sheet,details},live:live.data()};
    });
  }
  path(id){if(!/^[\w-]{1,100}$/.test(id))throw new Error('Invalid character ID.');return `users/${this.uid}/characters/${id}`;}
  async readContent(transaction,path,meta){
    const snapshots=await Promise.all(Array.from({length:meta.chunks},(_,i)=>transaction.get(this.ref(`${path}/content/${i}`))));
    return JSON.parse(snapshots.map(snapshot=>{if(!snapshot.exists())throw new Error('Incomplete cloud sheet. Your local copy is preserved.');return snapshot.data().json;}).join(''));
  }
  async readCharacter(id){
    const path=this.path(id);
    return this.s.runTransaction(this.db,async tx=>{
      const [meta,live]=await Promise.all([tx.get(this.ref(path)),tx.get(this.ref(`${path}/state/live`))]);
      if(!meta.exists()||meta.data().deleted)return null;
      const content=await this.readContent(tx,path,meta.data());
      return {character:joinCharacter(content,live.data()),meta:meta.data(),live:live.data()};
    });
  }
  async readLive(id){
    const path=this.path(id);
    return this.s.runTransaction(this.db,async tx=>{
      const [meta,live]=await Promise.all([tx.get(this.ref(path)),tx.get(this.ref(`${path}/state/live`))]);
      return meta.exists()&&!meta.data().deleted?{meta:meta.data(),live:live.data()}:null;
    });
  }
  watchIndex(next,error){return this.s.onSnapshot(this.s.collection(this.db,`users/${this.uid}/characters`),{includeMetadataChanges:true},snapshot=>{if(!snapshot.metadata.fromCache)next(snapshot.docs.map(d=>({id:d.id,...d.data()})));},error);}
  watchLive(id,next,error){return this.s.onSnapshot(this.ref(`${this.path(id)}/state/live`),snapshot=>{if(snapshot.exists())next(snapshot.data());},error);}
  async apply(id,operation){
    // Revision rules can reject a transaction whose read version was overtaken
    // before authorization (also observable in the emulator). Re-read in a fresh
    // transaction, keeping the same receipt ID. Never relax the rule or drop work.
    for(let attempt=0;attempt<4;attempt++){
      try{return await this.applyOnce(id,operation);}
      catch(error){if(attempt===3||!['permission-denied','aborted'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)+Math.random()*80));}
    }
  }
  async applyOnce(id,operation){
    const path=this.path(id),metaRef=this.ref(path),liveRef=this.ref(`${path}/state/live`),receipt=this.ref(`${path}/operations/${operation.id}`);
    return this.s.runTransaction(this.db,async tx=>{
      const [metaSnap,liveSnap,done]=await Promise.all([tx.get(metaRef),tx.get(liveRef),tx.get(receipt)]);
      if(done.exists())return {duplicate:true};
      const meta=metaSnap.exists()?metaSnap.data():null;
      if(operation.create){
        if(meta)throw new CloudConflict(['existing character ID']);
        const parts=splitCharacter(operation.create),chunks=fragments(parts.content);
        tx.set(metaRef,{ownerId:this.uid,name:operation.create.name,revision:1,chunks:chunks.length,partyId:'',deleted:false});
        chunks.forEach((json,i)=>tx.set(this.ref(`${path}/content/${i}`),{json}));
        tx.set(liveRef,{...parts.live,revision:1});
      }else{
        if(!meta||meta.deleted)throw new CloudConflict(['character deleted on another device']);
        const currentLive=liveSnap.data();
        let content=null,oldChunks=null;
        const contentChanged=!!operation.content?.length;
        if(contentChanged||operation.live?.some(change=>['slotMax','featureMax'].includes(change.key))){
          const original=await this.readContent(tx,path,meta);
          oldChunks=fragments(original);content=applyFields(original,operation.content||[],operation);
        }
        const nextLive=applyLive(currentLive,operation);
        const membership=meta.partyId?await tx.get(this.ref(`parties/${meta.partyId}/members/${this.uid}`)):null;
        const partyRoot=membership?.exists()?await tx.get(this.ref(`parties/${meta.partyId}`)):null;
        const partyExists=partyRoot?.exists();
        const sharedPath=meta.partyId?`parties/${meta.partyId}/characters/${this.uid}_${id}`:'';
        const sharedMeta=sharedPath&&partyExists&&(content||operation.delete)?await tx.get(this.ref(sharedPath)):null;
        // Validate the complete merged sheet when content changes. Live-only patches
        // are bounded by rules; their base is already a validated local character.
        if(content){try{joinCharacter(content,nextLive);}catch{throw new CloudConflict(['sheet limits or combat values changed']);}}
        const projection=content&&sharedMeta?await this.sharedData(joinCharacter(content,nextLive)):null;
        if(operation.delete){
          if(!operation.force&&(meta.revision!==operation.revision||currentLive.revision!==operation.liveRevision))throw new CloudConflict(['updated character being deleted']);
          tx.update(metaRef,{deleted:true,revision:meta.revision+1,name:'Deleted character',chunks:1,partyId:''});
          for(let i=0;i<meta.chunks;i++)tx.delete(this.ref(`${path}/content/${i}`));
          tx.delete(liveRef);
          if(sharedMeta?.exists())this.removePartyProjection(tx,partyRoot,sharedMeta);
        }else{
          if(contentChanged){
            const chunks=fragments(content);
            chunks.forEach((json,i)=>{if(json!==oldChunks[i])tx.set(this.ref(`${path}/content/${i}`),{json});});
            for(let i=chunks.length;i<oldChunks.length;i++)tx.delete(this.ref(`${path}/content/${i}`));
            tx.update(metaRef,{name:content.name,revision:meta.revision+1,chunks:chunks.length});
          }
          if(!equal(currentLive,nextLive))tx.set(liveRef,{...nextLive,revision:currentLive.revision+1});
          if(meta.partyId){
            // Only sharing after membership is checked by the same transaction.
            // If removed, detach privately so local/cloud saves can continue.
            // Membership is read before any writes in this transaction.
            if(!partyExists)tx.update(metaRef,{partyId:'',...(!contentChanged?{revision:meta.revision+1}:{})});
            else {
              const shared=`parties/${meta.partyId}/characters/${this.uid}_${id}`;
              if(projection){
                const previous=sharedMeta.exists()?sharedMeta.data():null;
                if(previous?.detailsHash!==projection.detailsHash){
                  projection.chunks.forEach((json,i)=>tx.set(this.ref(`${shared}/sheet/${i}`),{json}));
                  for(let i=projection.chunks.length;i<(previous?.chunks||0);i++)tx.delete(this.ref(`${shared}/sheet/${i}`));
                }
                if(previous?.sheetHash!==projection.sheetHash||previous?.detailsHash!==projection.detailsHash)tx.set(this.ref(shared),{ownerId:this.uid,characterId:id,sheet:projection.sheet,chunks:projection.chunks.length,detailsHash:projection.detailsHash,sheetHash:projection.sheetHash});
              }
              if(!equal(currentLive,nextLive))tx.set(this.ref(`${shared}/state/live`),{...nextLive,revision:currentLive.revision+1});
              liveActivities(currentLive,nextLive).forEach((event,index)=>tx.set(this.ref(`parties/${meta.partyId}/activities/${operation.id}_${index}`),{...event,characterId:id,name:content?.name||meta.name,actorId:this.uid,createdAt:this.s.serverTimestamp()}));
            }
          }
        }
      }
      tx.set(receipt,{operationId:operation.id,createdAt:this.s.serverTimestamp()});
      return {duplicate:false};
    });
  }
  async createParty(name,displayName){
    const party=this.s.doc(this.s.collection(this.db,'parties'));
    const batch=this.s.writeBatch(this.db);
    batch.set(party,{ownerId:this.uid,name,createdAt:this.s.serverTimestamp()});
    batch.set(this.ref(`${party.path}/members/${this.uid}`),{uid:this.uid,displayName:displayName||'',invitation:'',joinedAt:this.s.serverTimestamp()});
    batch.set(this.ref(`users/${this.uid}/parties/${party.id}`),{partyId:party.id});
    await batch.commit();return party.id;
  }
  async invite(partyId){
    const token=invitationToken(),createdAt=this.s.serverTimestamp(),batch=this.s.writeBatch(this.db);
    batch.set(this.ref(`invitations/${token}`),{partyId,creatorId:this.uid,createdAt,revoked:false});
    batch.set(this.ref(`parties/${partyId}/invitations/${token}`),{token,createdAt,revoked:false});
    await batch.commit();return token;
  }
  async revoke(partyId,token){
    const batch=this.s.writeBatch(this.db);batch.update(this.ref(`invitations/${token}`),{revoked:true});batch.update(this.ref(`parties/${partyId}/invitations/${token}`),{revoked:true});await batch.commit();
  }
  async join(token,displayName){
    if(!/^[a-f0-9]{64}$/.test(token))throw new Error('This invitation is invalid.');
    return this.s.runTransaction(this.db,async tx=>{
      const invite=await tx.get(this.ref(`invitations/${token}`));
      if(!invite.exists()||invite.data().revoked||invite.data().createdAt.toMillis()+7*86400000<=Date.now())throw new Error('This invitation is invalid, expired, or revoked.');
      const {partyId}=invite.data(),member=this.ref(`parties/${partyId}/members/${this.uid}`),existing=await tx.get(member);
      if(!existing.exists())tx.set(member,{uid:this.uid,displayName:displayName||'',invitation:token,joinedAt:this.s.serverTimestamp()});
      tx.set(this.ref(`users/${this.uid}/parties/${partyId}`),{partyId});return partyId;
    });
  }
  watchParties(next,error){
    return this.s.onSnapshot(this.s.collection(this.db,`users/${this.uid}/parties`),{includeMetadataChanges:true},snapshot=>{
      // A local party index entry can arrive before its membership batch is
      // authorized. Wait for the server before opening member-only listeners.
      if(!snapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites)next(snapshot.docs.map(d=>d.id));
    },error);
  }
  watchPartySummary(partyId,next,error){
    const data={id:partyId,members:[],characters:[],invitations:[]},stops=[];
    stops.push(this.s.onSnapshot(this.ref(`parties/${partyId}`),snapshot=>{if(snapshot.exists()){Object.assign(data,snapshot.data());next(copy(data));}},error));
    for(const kind of ['members','characters','invitations'])stops.push(this.s.onSnapshot(this.s.collection(this.db,`parties/${partyId}/${kind}`),snapshot=>{data[kind]=snapshot.docs.map(d=>({id:d.id,...d.data()}));next(copy(data));},kind==='invitations'?()=>{}:error));
    return ()=>stops.forEach(stop=>stop());
  }
  async partyAccess(partyId){
    // A feature read being denied is not proof that membership was revoked.
    // Confirm against the server, never an empty/offline cache snapshot.
    const member=await this.s.getDocFromServer(this.ref(`parties/${partyId}/members/${this.uid}`));
    if(!member.exists())return false;
    const root=await this.s.getDocFromServer(this.ref(`parties/${partyId}`));
    return root.exists();
  }
  async share(partyId,character){
    const id=character.id,path=this.path(id),shared=`parties/${partyId}/characters/${this.uid}_${id}`;
    await this.s.runTransaction(this.db,async tx=>{
      const [meta,live,previous]=await Promise.all([tx.get(this.ref(path)),tx.get(this.ref(`${path}/state/live`)),tx.get(this.ref(shared))]);
      if(!meta.exists()||meta.data().deleted)throw new Error('Wait for this character to finish uploading.');
      if(meta.data().partyId&&meta.data().partyId!==partyId){
        const oldMember=await tx.get(this.ref(`parties/${meta.data().partyId}/members/${this.uid}`));
        if(oldMember.exists()&&(await tx.get(this.ref(`parties/${meta.data().partyId}`))).exists())throw new Error('Remove this character from their current party first.');
      }
      const content=await this.readContent(tx,path,meta.data());
      const projection=await this.sharedData(joinCharacter(content,live.data()));
      tx.update(this.ref(path),{partyId,revision:meta.data().revision+1});
      tx.set(this.ref(shared),{ownerId:this.uid,characterId:id,sheet:projection.sheet,chunks:projection.chunks.length,detailsHash:projection.detailsHash,sheetHash:projection.sheetHash});
      projection.chunks.forEach((json,i)=>tx.set(this.ref(`${shared}/sheet/${i}`),{json}));
      for(let i=projection.chunks.length;i<(previous.exists()?previous.data().chunks:0);i++)tx.delete(this.ref(`${shared}/sheet/${i}`));
      tx.set(this.ref(`${shared}/state/live`),live.data());
    });
  }
  async unshare(partyId,id){
    const path=this.path(id),shared=`parties/${partyId}/characters/${this.uid}_${id}`;
    await this.s.runTransaction(this.db,async tx=>{
      const [meta,projection,party]=await Promise.all([tx.get(this.ref(path)),tx.get(this.ref(shared)),tx.get(this.ref(`parties/${partyId}`))]);
      if(meta.exists()&&meta.data().partyId===partyId)tx.update(this.ref(path),{partyId:'',revision:meta.data().revision+1});
      if(projection.exists())this.removePartyProjection(tx,party,projection);
    });
  }
  removePartyProjection(tx,party,projection){
    if(party.data()?.dm?.sharedId===projection.id)tx.update(party.ref,{dm:null});
    for(let i=0;i<projection.data().chunks;i++)tx.delete(this.ref(`${projection.ref.path}/sheet/${i}`));
    tx.delete(this.ref(`${projection.ref.path}/state/live`));
    tx.delete(projection.ref);
  }
  async removeMember(partyId,uid){
    const party=await this.s.getDoc(this.ref(`parties/${partyId}`));
    if(party.exists()&&party.data().ownerId===uid)throw new Error('Transfer party ownership before leaving.');
    // The user's own index is a convenience, never an authorization source.
    const shared=await this.s.getDocs(this.s.query(this.s.collection(this.db,`parties/${partyId}/characters`),this.s.where('ownerId','==',uid)));
    for(const snapshot of shared.docs)await this.s.runTransaction(this.db,async tx=>{
      const [root,current]=await Promise.all([tx.get(party.ref),tx.get(snapshot.ref)]);
      if(current.exists())this.removePartyProjection(tx,root,current);
    });
    await this.s.runTransaction(this.db,async tx=>{
      const root=await tx.get(party.ref);
      if(root.data()?.dm?.ownerId===uid)tx.update(root.ref,{dm:null});
      tx.delete(this.ref(`parties/${partyId}/members/${uid}`));
    });
    if(uid===this.uid)await this.s.deleteDoc(this.ref(`users/${uid}/parties/${partyId}`));
  }
  async transferAndLeave(partyId,newOwner){
    await this.s.runTransaction(this.db,async tx=>{
      const party=await tx.get(this.ref(`parties/${partyId}`));
      tx.update(party.ref,{ownerId:newOwner,...(party.data()?.dm?.ownerId===this.uid?{dm:null}:{})});
      tx.delete(this.ref(`parties/${partyId}/members/${this.uid}`));
      tx.delete(this.ref(`users/${this.uid}/parties/${partyId}`));
    });
  }
  async closeParty(partyId){
    // The UI only offers this to a creator who is the final member. Deleting the
    // root also revokes orphaned memberships if a custom client closes a group.
    const invites=await this.s.getDocs(this.s.collection(this.db,`parties/${partyId}/invitations`));
    for(const invite of invites.docs)if(!invite.data().revoked)await this.revoke(partyId,invite.id);
    const batch=this.s.writeBatch(this.db);
    batch.delete(this.ref(`parties/${partyId}`));
    batch.delete(this.ref(`parties/${partyId}/members/${this.uid}`));
    batch.delete(this.ref(`users/${this.uid}/parties/${partyId}`));
    await batch.commit();
  }
  watchParty(partyId,next,error){
    const stops=[],liveStops=new Map(),replyStops=new Map(),data={id:partyId,members:[],characters:[],invitations:[],activities:[],transfers:[],rests:[],combat:{},errors:{}};let stopped=false,checking=false;
    const emit=()=>{if(!stopped)next(copy(data));};
    const fail=scope=>async failure=>{
      if(stopped)return;
      data.errors[scope]={code:failure.code||'',message:failure.message||'Connection unavailable'};emit();
      if(['combat','activities','transfers','rests','replies'].includes(scope)||checking)return;
      checking=true;
      try{if(!await this.partyAccess(partyId)&&!stopped){stopped=true;error(Object.assign(new Error('Party membership ended.'),{code:'questlog/party-access-ended'}));}}
      catch{/* A rules or network error must not erase the party selection. */}
      finally{checking=false;}
    };
    const ended=()=>{if(!stopped){stopped=true;error(Object.assign(new Error('Party membership ended.'),{code:'questlog/party-access-ended'}));}};
    stops.push(this.s.onSnapshot(this.ref(`parties/${partyId}/members/${this.uid}`),{includeMetadataChanges:true},snapshot=>{if(!snapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites&&!snapshot.exists())ended();},fail('membership')));
    stops.push(this.s.onSnapshot(this.ref(`parties/${partyId}`),{includeMetadataChanges:true},snapshot=>{if(snapshot.exists()){Object.assign(data,snapshot.data());emit();}else if(!snapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites)ended();},fail('party')));
    stops.push(this.s.onSnapshot(this.ref(`parties/${partyId}/session/combat`),snapshot=>{data.combat=snapshot.exists()?snapshot.data():{};emit();},fail('combat')));
    for(const kind of ['members','characters','invitations','activities','transfers','rests']){
      const collection=this.s.collection(this.db,`parties/${partyId}/${kind}`),source=['activities','rests'].includes(kind)?this.s.query(collection,this.s.orderBy('createdAt','desc'),this.s.limit(kind==='rests'?10:50)):collection;
      stops.push(this.s.onSnapshot(source,snapshot=>{
        data[kind]=snapshot.docs.filter(d=>!['activities','rests'].includes(kind)||d.data().createdAt).map(d=>({id:d.id,...d.data(),...(kind==='characters'?{live:data.characters.find(c=>c.id===d.id)?.live}:kind==='rests'?{replies:data.rests.find(r=>r.id===d.id)?.replies||[],repliesReady:data.rests.find(r=>r.id===d.id)?.repliesReady||false}: {})}));
        if(kind==='characters'){
          data.charactersReady=true;
          const ids=new Set(data.characters.map(c=>c.id));
          for(const [id,stop] of liveStops)if(!ids.has(id)){stop();liveStops.delete(id);}
          for(const c of data.characters)if(!liveStops.has(c.id))liveStops.set(c.id,this.s.onSnapshot(this.ref(`parties/${partyId}/characters/${c.id}/state/live`),snapshot=>{const target=data.characters.find(row=>row.id===c.id);if(target&&snapshot.exists()){target.live=snapshot.data();emit();}},fail('characters')));
        }
        if(kind==='rests'){
          for(const [id,stop] of replyStops)if(!data.rests.some(r=>r.id===id)){stop();replyStops.delete(id);}
          for(const rest of data.rests)if(!replyStops.has(rest.id))replyStops.set(rest.id,this.s.onSnapshot(this.s.collection(this.db,`parties/${partyId}/rests/${rest.id}/replies`),snapshot=>{const target=data.rests.find(r=>r.id===rest.id);if(target){target.replies=snapshot.docs.map(d=>({id:d.id,...d.data()}));target.repliesReady=true;emit();}},fail('replies')));
        }
        emit();
      },kind==='invitations'?()=>{}:fail(kind)));
    }
    return ()=>{stopped=true;stops.forEach(stop=>stop());liveStops.forEach(stop=>stop());replyStops.forEach(stop=>stop());};
  }
}
