import {copy,fragments,joinCharacter,splitCharacter} from './cloud-model.js';
import {uid} from './model.js';
import {initiativeOrder,reserveTransfer,receiveTransfer} from './party-model.js';

// Party operations write only the acting user's private sheet. Offers escrow the
// sender's assets, then the recipient's acceptance and credit commit together.
export class PartyStore {
  async partyTransaction(action){
    for(let attempt=0;attempt<4;attempt++){
      try{return await action();}catch(error){if(attempt===3||!['permission-denied','aborted'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));}
    }
  }
  async activity(partyId,event,id=uid()) {
    await this.s.setDoc(this.ref(`parties/${partyId}/activities/${id}`),{...event,actorId:this.uid,createdAt:this.s.serverTimestamp()});
    return id;
  }
  async combat(partyId,change) {
    const ref=this.ref(`parties/${partyId}/session/combat`);
    return this.s.runTransaction(this.db,async tx=>{
      const snapshot=await tx.get(ref),previous=snapshot.exists()?snapshot.data():{scores:{},current:'',round:1,active:false};
      const next=change(copy(previous));
      tx.set(ref,{scores:next.scores,current:next.current,round:next.round,active:next.active,updatedBy:this.uid});
    });
  }
  async setInitiative(partyId,sharedId,score) {
    if(!Number.isInteger(score)||score< -99||score>999)throw new Error('Initiative must be a whole number from −99 to 999.');
    await this.combat(partyId,state=>{state.scores[sharedId]=score;return state;});
  }
  async advanceTurn(partyId,characters,{start=false,end=false}={}) {
    return this.combat(partyId,state=>{
      if(end)return {...state,active:false,current:''};
      const ordered=initiativeOrder(characters,state).filter(c=>Object.hasOwn(state.scores,c.id));
      if(!ordered.length)throw new Error('Set initiative for at least one character first.');
      const index=ordered.findIndex(c=>c.id===state.current),next=start||index<0?0:(index+1)%ordered.length;
      return {...state,active:true,current:ordered[next].id,round:start?1:state.round+(next===0&&index>=0?1:0)};
    });
  }
  async requestRest(partyId,kind,characterId) {
    if(!['short','long'].includes(kind))throw new Error('Choose a rest type.');
    const id=uid();await this.s.setDoc(this.ref(`parties/${partyId}/rests/${id}`),{kind,actorId:this.uid,characterId,createdAt:this.s.serverTimestamp()});return id;
  }
  async replyRest(partyId,id,yes,characterId) {
    await this.s.setDoc(this.ref(`parties/${partyId}/rests/${id}/replies/${this.uid}`),{yes,characterId,actorId:this.uid});
  }
  async ownedForTransfer(tx,characterId) {
    const path=this.path(characterId),meta=await tx.get(this.ref(path)),live=await tx.get(this.ref(`${path}/state/live`));
    if(!meta.exists()||meta.data().deleted)throw new Error('This character is no longer available.');
    const content=await this.readContent(tx,path,meta.data());
    return {path,meta:meta.data(),character:joinCharacter(content,live.data()),live:live.data()};
  }
  async writeTransferCharacter(tx,owned) {
    // A removed weapon can also remove a linked action from the shared sheet.
    const chunks=fragments(splitCharacter(owned.character).content);
    joinCharacter(splitCharacter(owned.character).content,owned.live);
    let shared=null,previous=null,projection=null;
    if(owned.meta.partyId){
      const member=await tx.get(this.ref(`parties/${owned.meta.partyId}/members/${this.uid}`));
      const root=member.exists()?await tx.get(this.ref(`parties/${owned.meta.partyId}`)):null;
      if(root?.exists()){
        shared=`parties/${owned.meta.partyId}/characters/${this.uid}_${owned.character.id}`;
        const snapshot=await tx.get(this.ref(shared));previous=snapshot.exists()?snapshot.data():null;
        if(previous)projection=await this.sharedData(owned.character);
      }
    }
    chunks.forEach((json,i)=>tx.set(this.ref(`${owned.path}/content/${i}`),{json}));
    for(let i=chunks.length;i<owned.meta.chunks;i++)tx.delete(this.ref(`${owned.path}/content/${i}`));
    tx.update(this.ref(owned.path),{revision:owned.meta.revision+1,chunks:chunks.length});
    if(projection&&(previous.sheetHash!==projection.sheetHash||previous.detailsHash!==projection.detailsHash)){
      projection.chunks.forEach((json,i)=>tx.set(this.ref(`${shared}/sheet/${i}`),{json}));
      for(let i=projection.chunks.length;i<previous.chunks;i++)tx.delete(this.ref(`${shared}/sheet/${i}`));
      tx.set(this.ref(shared),{ownerId:this.uid,characterId:owned.character.id,sheet:projection.sheet,chunks:projection.chunks.length,sheetHash:projection.sheetHash,detailsHash:projection.detailsHash});
    }
  }
  async offerTransfer(partyId,fromCharacter,to,options,id=uid()) {
    if(to.ownerId===this.uid)throw new Error('Choose another player’s character.');
    return this.partyTransaction(()=>this.s.runTransaction(this.db,async tx=>{
      const ref=this.ref(`parties/${partyId}/transfers/${id}`),existing=await tx.get(ref);
      if(existing.exists())return id;
      const owned=await this.ownedForTransfer(tx,fromCharacter);
      const target=await tx.get(this.ref(`parties/${partyId}/characters/${to.id}`));
      if(!target.exists()||target.data().ownerId!==to.ownerId)throw new Error('That character is no longer in this party.');
      const original=options.kind==='item'?copy(owned.character.items.find(i=>i.id===options.itemId)):null;
      const originalAttacks=original?copy(owned.character.attacks.filter(a=>a.itemId===original.id)):[];
      const payload=reserveTransfer(owned.character,options),refund=copy(payload);
      if(original)refund.item={...original,qty:payload.amount};
      if(originalAttacks.length&&!owned.character.items.some(i=>i.id===original.id))refund.attacks=originalAttacks;
      await this.writeTransferCharacter(tx,owned);
      tx.set(ref,{senderId:this.uid,recipientId:to.ownerId,fromCharacter,toCharacter:to.characterId,fromName:owned.character.name,toName:target.data().sheet.name,payload:JSON.stringify(payload),status:'pending',createdAt:this.s.serverTimestamp()});
      tx.set(this.ref(`users/${this.uid}/escrow/${id}`),{partyId,characterId:fromCharacter,refund:JSON.stringify(refund)});
      return id;
    }));
  }
  async answerTransfer(partyId,id,accept) {
    return this.partyTransaction(()=>this.s.runTransaction(this.db,async tx=>{
      const ref=this.ref(`parties/${partyId}/transfers/${id}`),snapshot=await tx.get(ref);
      if(!snapshot.exists())throw new Error('This offer is no longer available.');
      const offer=snapshot.data();if(offer.recipientId!==this.uid)throw new Error('This offer belongs to another player.');
      if(offer.status!=='pending')return;
      if(accept){const owned=await this.ownedForTransfer(tx,offer.toCharacter);receiveTransfer(owned.character,JSON.parse(offer.payload));await this.writeTransferCharacter(tx,owned);}
      tx.update(ref,{status:accept?'accepted':'declined'});
    }));
  }
  async reclaimTransfer(partyId,id,{cancel=false}={}) {
    return this.partyTransaction(()=>this.s.runTransaction(this.db,async tx=>{
      const ref=this.ref(`parties/${partyId}/transfers/${id}`),snapshot=await tx.get(ref),escrowRef=this.ref(`users/${this.uid}/escrow/${id}`),escrow=await tx.get(escrowRef);
      if(!snapshot.exists()||!escrow.exists())return;
      const offer=snapshot.data();if(offer.senderId!==this.uid)throw new Error('This offer belongs to another player.');
      if(['accepted','refunded'].includes(offer.status)){tx.delete(escrowRef);return;}
      if(offer.status==='pending'&&!cancel)return;
      const owned=await this.ownedForTransfer(tx,offer.fromCharacter);
      receiveTransfer(owned.character,JSON.parse(escrow.data().refund),{refund:true});await this.writeTransferCharacter(tx,owned);
      tx.update(ref,{status:'refunded'});tx.delete(escrowRef);
    }));
  }
  async recoverEscrow() {
    const escrows=await this.s.getDocs(this.s.collection(this.db,`users/${this.uid}/escrow`));
    for(const escrow of escrows.docs){
      const partyId=escrow.data().partyId,offer=await this.s.getDoc(this.ref(`parties/${partyId}/transfers/${escrow.id}`));
      let cancel=false;
      if(offer.exists()&&offer.data().status==='pending'){
        try{const root=await this.s.getDoc(this.ref(`parties/${partyId}`)),member=await this.s.getDoc(this.ref(`parties/${partyId}/members/${offer.data().recipientId}`));cancel=!root.exists()||!member.exists();}
        catch(error){if(error.code==='permission-denied')cancel=true;else throw error;}
      }
      await this.reclaimTransfer(partyId,escrow.id,{cancel});
    }
  }
  async checkTransferDeletion(characterId) {
    const records=await this.s.getDocs(this.s.collection(this.db,`users/${this.uid}/escrow`));
    for(const record of records.docs){
      if(record.data().characterId!==characterId)continue;
      const offer=await this.s.getDoc(this.ref(`parties/${record.data().partyId}/transfers/${record.id}`));
      if(offer.exists()&&['pending','declined'].includes(offer.data().status))throw new Error('Finish or cancel this character’s pending party transfers before deleting them.');
    }
  }
}
