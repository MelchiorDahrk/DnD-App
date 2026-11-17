import {copy,equal,queueKey,makeOperation,hasChanges,splitCharacter,joinCharacter} from './cloud-model.js';
import {uid} from './model.js';
import {cloudMessage} from './firebase-client.js';

export class CharacterSync {
  constructor({store,storage=localStorage,getState,onRemote,onStatus=()=>{},online=()=>navigator.onLine}){
    Object.assign(this,{store,storage,getState,onRemote,onStatus,online});
    this.key=queueKey(store.uid);this.prefix=this.key+'.op.';this.sequence=0;this.baseline=new Map(getState().characters.map(c=>[c.id,copy(c)]));
    this.remote=new Map();this.meta=new Map();this.liveRecords=new Map();this.refreshSequence=new Map();this.indexStop=null;this.indexError=null;this.activeStop=null;this.activeId=null;
    this.queue=[];this.conflict=null;this.running=false;this.stopped=false;this.loaded=false;
    try{const saved=storage.getItem(this.key);if(saved){const data=JSON.parse(saved);if(data.queue){if(!Array.isArray(data.queue))throw new Error('Invalid queue');this.queue=data.queue;this.saveQueue();}}this.reloadQueue();}
    catch{this.blocked=true;this.status('error','Pending cloud operations could not be read. Export a backup; this queue has been preserved.');}
  }
  status(state,message=''){
    if(state==='synced'&&this.indexError){state='error';message=cloudMessage(this.indexError);}
    else if(state==='synced'&&!this.loaded)state='connecting';
    this.state=state;this.message=message;this.onStatus({state,message,pending:this.queue.length,conflict:this.conflict,loaded:this.loaded});
  }
  // Each operation has its own key. Two tabs cannot overwrite an entire queue
  // with stale localStorage snapshots. Web Locks serialize consumers, and server
  // receipts also cover browsers without Web Locks.
  saveQueue(){for(const op of this.queue)this.storage.setItem(this.prefix+op.id,JSON.stringify(op));this.storage.setItem(this.key,JSON.stringify({version:1}));}
  reloadQueue(){
    if(typeof this.storage.key!=='function')return;
    const next=[];
    for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(this.prefix))next.push(JSON.parse(this.storage.getItem(key)));}
    this.queue=next.sort((a,b)=>(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
  }
  dropOperations(ids){for(const id of ids)this.storage.removeItem(this.prefix+id);this.queue=this.queue.filter(op=>!ids.includes(op.id));}
  acceptExternal(){this.baseline=new Map(this.getState().characters.map(c=>[c.id,copy(c)]));this.reloadQueue();this.flush();}
  start(){
    if(this.blocked)return;
    this.listenIndex();
    this.reconnect=()=>this.retrySync();window.addEventListener('online',this.reconnect);
    this.offline=()=>this.status('offline','Changes stay on this device until you reconnect.');window.addEventListener('offline',this.offline);
    this.queueChanged=event=>{if(event.key?.startsWith(this.prefix)){this.reloadQueue();this.flush();}};window.addEventListener('storage',this.queueChanged);
    this.select(this.getState().activeId);this.flush();
  }
  listenIndex(){
    this.indexStop?.();
    this.indexStop=this.store.watchIndex(rows=>{this.indexError=null;this.receiveIndex(rows);},error=>{this.indexError=error;this.fail(error);});
  }
  retrySync(){
    if(this.stopped||this.blocked)return;
    clearTimeout(this.retry);
    // Firestore ends a listener after a permissions error. Recreate it after
    // rules are published rather than only retrying queued writes.
    this.listenIndex();
    const active=this.activeId;this.activeId=null;this.select(active);
    return this.flush();
  }
  stop(){this.stopped=true;clearTimeout(this.timer);clearTimeout(this.retry);this.indexStop?.();this.activeStop?.();window.removeEventListener('online',this.reconnect);window.removeEventListener('offline',this.offline);window.removeEventListener('storage',this.queueChanged);}
  select(id){
    if(id===this.activeId)return;this.activeStop?.();this.activeStop=null;this.activeId=id;
    if(!id)return;
    this.activeStop=this.store.watchLive(id,live=>{
      if((this.liveRecords.get(id)?.revision||0)>live.revision)return;
      this.liveRecords.set(id,live);
      const old=this.remote.get(id);if(!old)return;
      try{const remote=joinCharacter(splitCharacter(old).content,live);this.remote.set(id,remote);const meta=this.meta.get(id);if(meta)meta.liveRevision=live.revision;this.deliver(id,remote);}catch{this.refresh(id).catch(error=>this.fail(error));}
    },error=>this.fail(error));
    if(this.loaded)this.refresh(id).catch(error=>this.fail(error));
  }
  async receiveIndex(rows){
    if(this.stopped)return;
    try{
      for(const row of rows){
        if(this.stopped)return;
        const old=this.meta.get(row.id);
        if(row.deleted){this.refreshSequence.set(row.id,(this.refreshSequence.get(row.id)||0)+1);this.meta.set(row.id,row);this.remote.set(row.id,null);this.deliver(row.id,null);continue;}
        if(!old||old.revision!==row.revision)await this.refresh(row.id);
      }
      this.loaded=true;
      // Locally cached sheets with no corresponding server document are never
      // discarded. Their first upload is an explicit create, with collision checks.
      this.observe();this.flush();
    }catch(error){this.fail(error);}
  }
  async refresh(id){
    const sequence=(this.refreshSequence.get(id)||0)+1;this.refreshSequence.set(id,sequence);
    const result=await this.store.readCharacter(id);if(this.stopped||sequence!==this.refreshSequence.get(id))return;
    if(result){
      if(result.meta.revision<(this.meta.get(id)?.revision||0))return;
      const latest=this.liveRecords.get(id);
      if(latest&&latest.revision>result.live.revision){result.live=latest;result.character=joinCharacter(splitCharacter(result.character).content,latest);}
      else this.liveRecords.set(id,result.live);
      this.meta.set(id,{...result.meta,liveRevision:result.live.revision});this.remote.set(id,result.character);this.deliver(id,result.character);
    }
    else{this.remote.set(id,null);this.deliver(id,null);}
  }
  async refreshLive(id){
    const current=this.remote.get(id),meta=this.meta.get(id);
    if(!current||!meta)return this.refresh(id);
    const result=await this.store.readLive(id);if(this.stopped)return;
    if(!result){this.remote.set(id,null);this.deliver(id,null);return;}
    if(result.meta.revision!==meta.revision)return this.refresh(id);
    if((this.liveRecords.get(id)?.revision||0)>result.live.revision)return this.deliver(id,this.remote.get(id));
    this.liveRecords.set(id,result.live);meta.liveRevision=result.live.revision;
    const remote=joinCharacter(splitCharacter(this.remote.get(id)).content,result.live);
    this.remote.set(id,remote);this.deliver(id,remote);
  }
  deliver(id,remote){
    if(this.stopped||this.queue.some(op=>op.characterId===id))return;
    if(this.onRemote(id,copy(remote))!==false){if(remote)this.baseline.set(id,copy(remote));else this.baseline.delete(id);}
  }
  deliverDeferred(){for(const [id,remote] of this.remote)this.deliver(id,remote);}
  observe(hpActions=new Map()){
    if(this.stopped||this.blocked)return false;
    const state=this.getState(),next=new Map(state.characters.map(c=>[c.id,c])),added=[];
    for(const [id,c] of next){
      const before=this.baseline.get(id),known=this.meta.get(id),pending=this.queue.some(op=>op.characterId===id);
      let operation;
      if(!before||(!known&&this.loaded&&!pending))operation={create:copy(c)};
      else if(!equal(before,c))operation=makeOperation(before,c,hpActions.get(id));
      if(operation&&(operation.create||hasChanges(operation)))added.push({...operation,id:uid(),characterId:id});
    }
    for(const [id] of this.baseline)if(!next.has(id)){
      const meta=this.meta.get(id)||{};
      added.push({id:uid(),characterId:id,delete:true,revision:meta.revision||0,liveRevision:meta.liveRevision||0});
    }
    if(added.length){
      added.forEach(op=>op.order=Date.now()*1000+(this.sequence++%1000));
      this.queue.push(...added);
      try{for(const op of added)this.storage.setItem(this.prefix+op.id,JSON.stringify(op));this.reloadQueue();}
      catch{for(const op of added){try{this.storage.removeItem(this.prefix+op.id);}catch{}}this.queue=this.queue.filter(op=>!added.includes(op));this.status('error','Device storage is full. Cloud queue could not be saved. Export a backup before closing.');return false;}
      this.baseline=new Map(state.characters.map(c=>[c.id,copy(c)]));
      const urgent=added.some(op=>op.create||op.delete||op.live?.length||op.hpAction||op.conditions||op.resources?.slots.length||op.resources?.features.length);
      clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),urgent?0:700);
    }
    this.select(state.activeId);
    this.status(!this.online()?'offline':this.conflict?'conflict':this.queue.length?'pending':'synced',this.conflict?.message||'');
    return true;
  }
  fail(error){
    if(this.stopped)return;
    this.status(this.online()?'error':'offline',cloudMessage(error));
    clearTimeout(this.retry);this.retry=setTimeout(()=>this.indexError?this.retrySync():this.flush(),10000);
  }
  async flush(){
    if(this.stopped||this.blocked||this.conflict)return;
    if(this.running){this.flushRequested=true;return;}
    if(!this.online()){this.status('offline','Changes stay on this device until you reconnect.');return;}
    this.flushRequested=false;this.running=true;let succeeded=false;
    const work=async()=>{
      try{
        this.reloadQueue();
        while(this.queue.length&&!this.stopped){
          const operation=this.queue[0];this.status('pending');
          try{await this.store.apply(operation.characterId,operation);}
          catch(error){if(error.code==='questlog/conflict'){this.conflict={...operation,message:error.message};this.status('conflict',error.message);return;}throw error;}
          if(this.stopped)return;
          this.dropOperations([operation.id]);this.reloadQueue();
          if(operation.create||operation.delete||operation.content?.length)await this.refresh(operation.characterId);
          else await this.refreshLive(operation.characterId);
        }
        this.status('synced');succeeded=true;
      }catch(error){this.fail(error);}
    };
    try{
      // Serialize queue consumers across tabs. Operation receipts remain the
      // ultimate deduplication mechanism after crashes or lost responses.
      if(globalThis.navigator?.locks)await navigator.locks.request(`questlog-sync-${this.store.uid}`,work);else await work();
    }finally{
      this.running=false;
      // The lock callback can finish before locks.request releases the lock.
      // Preserve a flush requested in that window, while retaining error backoff
      // and the explicit resolution required for conflicts.
      if(this.flushRequested&&succeeded)await this.flush();
    }
  }
  async resolve(choice){
    if(!this.conflict)return;
    const id=this.conflict.characterId;
    if(choice==='local'){
      // Rebase the current local copy explicitly onto the latest cloud copy.
      const remote=await this.store.readCharacter(id),local=this.getState().characters.find(c=>c.id===id);
      if(local&&!remote)throw new Error('This ID was deleted. Export or duplicate the local character with a new ID to preserve it.');
      this.dropOperations(this.queue.filter(op=>op.characterId===id).map(op=>op.id));
      if(local){
        if(remote)this.queue.push({...makeOperation(remote.character,local),id:uid(),characterId:id,force:true});
      }else if(remote)this.queue.push({id:uid(),characterId:id,delete:true,force:true});
    }else{
      this.dropOperations(this.queue.filter(op=>op.characterId===id).map(op=>op.id));await this.refresh(id);
    }
    this.conflict=null;this.saveQueue();this.deliverDeferred();this.flush();
  }
}
