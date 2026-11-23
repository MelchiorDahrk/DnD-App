import {copy,fragments,joinCharacter,splitCharacter} from './cloud-model.js';
import {uid} from './model.js';
import {initiativeOrder,reserveTransfer,receiveTransfer} from './party-model.js';
import {applyShopOrder,prepareShop} from './shop-model.js';

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
  async assignDM(partyId,sharedId) {
    const path=`parties/${partyId}`;
    return this.s.runTransaction(this.db,async tx=>{
      const root=this.ref(path),party=await tx.get(root);
      if(party.data()?.ownerId!==this.uid)throw new Error('Only the party owner can assign the DM.');
      let dm=null;
      if(sharedId){
        const shared=await tx.get(this.ref(`${path}/characters/${sharedId}`));
        if(!shared.exists())throw new Error('Choose a character currently shared with this party.');
        const {ownerId,characterId}=shared.data();
        dm={sharedId,ownerId,characterId};
      }
      tx.update(root,{dm});
    });
  }
  async combat(partyId,change) {
    const ref=this.ref(`parties/${partyId}/session/combat`);
    return this.s.runTransaction(this.db,async tx=>{
      const snapshot=await tx.get(ref),previous=snapshot.exists()?snapshot.data():{scores:{},current:'',round:1,active:false};
      const next=change(copy(previous));
      tx.set(ref,{scores:next.scores,modifiers:next.modifiers||{},current:next.current,round:next.round,active:next.active,encounterId:next.encounterId||'',initiativeCharacter:next.initiativeCharacter||'',updatedBy:this.uid});
    });
  }
  async setInitiative(partyId,sharedId,score,{temporaryModifier}={}) {
    if(!Number.isInteger(score)||score< -999||score>999)throw new Error('Initiative must be a whole number from −999 to 999.');
    if(temporaryModifier!==undefined&&(!Number.isInteger(temporaryModifier)||temporaryModifier< -99||temporaryModifier>99))throw new Error('Temporary initiative modifier must be a whole number from −99 to 99.');
    const shared=await this.s.getDoc(this.ref(`parties/${partyId}/characters/${sharedId}`));
    if(!shared.exists()||shared.data().ownerId!==this.uid)throw new Error('You can only enter initiative for your own characters.');
    await this.combat(partyId,state=>{if(!state.active)throw new Error('Start an encounter before entering initiative.');state.scores[sharedId]=score;state.initiativeCharacter=sharedId;if(temporaryModifier!==undefined){state.modifiers||={};state.modifiers[sharedId]=temporaryModifier;}return state;});
  }
  async advanceTurn(partyId,characters,{start=false,end=false}={}) {
    return this.combat(partyId,state=>{
      state.initiativeCharacter='';
      if(end)return {...state,scores:{},modifiers:{},active:false,current:'',round:1};
      if(start)return state.active?state:{...state,scores:{},modifiers:{},active:true,current:'',round:1,encounterId:uid()};
      const ordered=initiativeOrder(characters,state).filter(c=>Object.hasOwn(state.scores,c.id));
      if(!ordered.length)throw new Error('Enter initiative for at least one character first.');
      const index=ordered.findIndex(c=>c.id===state.current),next=start||index<0?0:(index+1)%ordered.length;
      return {...state,active:true,current:ordered[next].id,round:start?1:state.round+(next===0&&index>=0?1:0)};
    });
  }
  async requestRest(partyId,kind,characterId='') {
    if(!['short','long'].includes(kind))throw new Error('Choose a rest type.');
    const id=uid();await this.s.setDoc(this.ref(`parties/${partyId}/rests/${id}`),{kind,actorId:this.uid,characterId,createdAt:this.s.serverTimestamp()});return id;
  }
  async replyRest(partyId,id,yes,characterId) {
    await this.s.setDoc(this.ref(`parties/${partyId}/rests/${id}/replies/${this.uid}`),{yes,characterId,actorId:this.uid});
  }
  async ownedPartyCharacter(tx,characterId) {
    const path=this.path(characterId),meta=await tx.get(this.ref(path)),live=await tx.get(this.ref(`${path}/state/live`));
    if(!meta.exists()||meta.data().deleted)throw new Error('This character is no longer available.');
    const content=await this.readContent(tx,path,meta.data());
    return {path,meta:meta.data(),character:joinCharacter(content,live.data()),live:live.data()};
  }
  async writePartyCharacter(tx,owned) {
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
  watchShops(partyId,manage,next,error){
    const stores=this.s.collection(this.db,`parties/${partyId}/stores`);
    const query=manage?stores:this.s.query(stores,this.s.where('open','==',true));
    return this.s.onSnapshot(query,snapshot=>next(snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))),error);
  }
  watchShop(partyId,storeId,next,error){
    return this.s.onSnapshot(this.ref(`parties/${partyId}/stores/${storeId}`),snapshot=>next(snapshot.exists()?{id:snapshot.id,...snapshot.data()}:null),error);
  }
  async saveShop(partyId,id,draft,revision=0){
    const ref=this.ref(`parties/${partyId}/stores/${id}`);
    await this.s.runTransaction(this.db,async tx=>{
      const current=(await tx.get(ref)).data();
      if((current?.revision||0)!==revision)throw new Error('The store changed while you were editing. Open it again to edit the latest stock.');
      const data=prepareShop(draft,current?.items);
      tx.set(ref,{...data,revision:revision+1,lastPurchase:null});
    });
  }
  async deleteShop(partyId,id){
    await this.s.deleteDoc(this.ref(`parties/${partyId}/stores/${id}`));
  }
  async shopOrder({partyId,storeId,characterId,id,kind,itemId,quantity,expectedUnitCp}){
    if(!/^[\w-]{1,100}$/.test(id))throw new Error('Invalid order ID.');
    const shopRef=this.ref(`parties/${partyId}/stores/${storeId}`);
    const receipt=this.ref(`${this.path(characterId)}/shopReceipts/${id}`);
    const details={partyId,storeId,kind,itemId,quantity,unitCp:expectedUnitCp};
    return this.partyTransaction(()=>this.s.runTransaction(this.db,async tx=>{
      const done=await tx.get(receipt);
      if(done.exists()){
        if(Object.entries(details).some(([key,value])=>done.data()[key]!==value))throw new Error('This order ID was already used for another trade.');
        return {duplicate:true};
      }
      const shop=(await tx.get(shopRef)).data();
      if(!shop?.open)throw new Error('This store is closed.');
      const owned=await this.ownedPartyCharacter(tx,characterId);
      if(owned.meta.partyId!==partyId)throw new Error('Choose one of your characters shared with this party.');
      const {remaining}=applyShopOrder(shop,owned.character,{kind,itemId,quantity,expectedUnitCp});
      await this.writePartyCharacter(tx,owned);
      tx.set(receipt,{...details,createdAt:this.s.serverTimestamp()});
      if(kind==='buy'&&remaining!==null)tx.update(shopRef,{
        items:{...shop.items,[itemId]:{...shop.items[itemId],stock:remaining}},
        revision:shop.revision+1,lastPurchase:{uid:this.uid,characterId,id}
      });
      return {duplicate:false};
    }));
  }
  async offerTransfer(partyId,fromCharacter,to,options,id=uid()) {
    if(to.ownerId===this.uid)throw new Error('Choose another player’s character.');
    return this.partyTransaction(()=>this.s.runTransaction(this.db,async tx=>{
      const ref=this.ref(`parties/${partyId}/transfers/${id}`),existing=await tx.get(ref);
      if(existing.exists())return id;
      const owned=await this.ownedPartyCharacter(tx,fromCharacter);
      const target=await tx.get(this.ref(`parties/${partyId}/characters/${to.id}`));
      if(!target.exists()||target.data().ownerId!==to.ownerId)throw new Error('That character is no longer in this party.');
      const original=options.kind==='item'?copy(owned.character.items.find(i=>i.id===options.itemId)):null;
      const originalAttacks=original?copy(owned.character.attacks.filter(a=>a.itemId===original.id)):[];
      const payload=reserveTransfer(owned.character,options),refund=copy(payload);
      if(original)refund.item={...original,qty:payload.amount};
      if(originalAttacks.length&&!owned.character.items.some(i=>i.id===original.id))refund.attacks=originalAttacks;
      await this.writePartyCharacter(tx,owned);
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
      if(accept){const owned=await this.ownedPartyCharacter(tx,offer.toCharacter);receiveTransfer(owned.character,JSON.parse(offer.payload));await this.writePartyCharacter(tx,owned);}
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
      const owned=await this.ownedPartyCharacter(tx,offer.fromCharacter);
      receiveTransfer(owned.character,JSON.parse(escrow.data().refund),{refund:true});await this.writePartyCharacter(tx,owned);
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
