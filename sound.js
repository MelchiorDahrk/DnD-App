import {SOUND_ASSETS} from './sound-assets.js';
import {SOUND_EVENTS,SOUND_CATEGORIES} from './sound-events.js';
export {SOUND_EVENTS,SOUND_CATEGORIES} from './sound-events.js';

export const AUDIO_PREFERENCES_KEY='questlog.audio.v1';
const unit=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.min(1,Math.max(0,value)):fallback;
const defaults=()=>({volume:.65,categories:Object.fromEntries(Object.keys(SOUND_CATEGORIES).map(key=>[key,1]))});
function preferences(input){
  const value=defaults();value.volume=unit(input?.volume,value.volume);
  for(const key of Object.keys(value.categories))value.categories[key]=unit(input?.categories?.[key],1);
  return value;
}

// One context per manager, bounded decoded cache, pending loads and live voices.
// All public playback operations resolve false on failure, never reject into gameplay.
export function createSoundManager(options={}){
  const assets=options.assets||SOUND_ASSETS,events=options.events||SOUND_EVENTS;
  let storage=options.storage;try{storage??=globalThis.localStorage;}catch{}
  let prefs=defaults();try{prefs=preferences(JSON.parse(storage?.getItem(AUDIO_PREFERENCES_KEY)||'null'));}catch{}
  let enabled=false,unlocked=false,ctx=null,epoch=0,ambientEpoch=0;
  const cache=new Map(),loading=new Map(),voices=new Set(),last=new Map();
  const now=options.now||(()=>Date.now());
  const createContext=options.createContext||(()=>{const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;return AudioContext?new AudioContext():null;});
  const fetchAudio=options.fetchAudio||(url=>fetch(url));
  const baseURL=options.baseURL||import.meta.url;
  const hidden=()=>options.isHidden?.()??globalThis.document?.hidden??false;
  const allowed=()=>enabled&&unlocked&&!hidden()&&prefs.volume>0;
  function getPreferences(){return structuredClone(prefs);}
  function gainFor(entry){return prefs.volume*(prefs.categories[entry.category]??1)*entry.gain;}
  function remove(entry){clearTimeout(entry.timer);voices.delete(entry);try{entry.source.disconnect();entry.node.disconnect();}catch{}}
  function stop(entry,fade=0){
    if(!voices.has(entry))return;
    try{
      if(fade&&ctx){entry.node.gain.cancelScheduledValues(ctx.currentTime);entry.node.gain.setValueAtTime(entry.node.gain.value,ctx.currentTime);entry.node.gain.linearRampToValueAtTime(0,ctx.currentTime+fade);entry.source.stop(ctx.currentTime+fade);clearTimeout(entry.timer);entry.timer=setTimeout(()=>remove(entry),fade*1000+100);}
      else{entry.source.stop();remove(entry);}
    }catch{remove(entry);}
  }
  function stopAmbience(fade=.25){ambientEpoch++;for(const entry of voices)if(entry.ambient)stop(entry,fade);}
  function stopAll(){epoch++;ambientEpoch++;for(const entry of voices)stop(entry);}
  function configure(update={}){
    if(typeof update.enabled==='boolean')enabled=update.enabled;
    prefs=preferences({...prefs,...update,categories:{...prefs.categories,...update.categories}});
    try{storage?.setItem(AUDIO_PREFERENCES_KEY,JSON.stringify(prefs));}catch{}
    if(!enabled||prefs.volume===0)stopAll();
    else for(const entry of voices){const value=gainFor(entry);try{entry.node.gain.cancelScheduledValues(ctx.currentTime);entry.node.gain.setTargetAtTime(value,ctx.currentTime,.025);}catch{}}
    return getPreferences();
  }
  function unlock(){
    if(!enabled||hidden())return false;
    try{
      ctx??=createContext();if(!ctx)return false;
      unlocked=true;
      // resume() must be invoked synchronously inside the interaction handler.
      const resumed=ctx.resume?.();resumed?.catch?.(()=>{});return true;
    }catch{return false;}
  }
  async function bufferFor(id){
    if(cache.has(id)){const buffer=cache.get(id);cache.delete(id);cache.set(id,buffer);return buffer;}
    if(loading.has(id))return loading.get(id);
    if(loading.size>=8)return null;
    const asset=assets[id];if(!asset)return null;
    const promise=(async()=>{
      for(const format of ['ogg','mp3']){
        const path=asset.files?.[format];
        if(!/^assets\/sfx\/[a-z0-9/-]+\.(ogg|mp3)$/.test(path||'')||path.includes('..'))continue;
        try{
          const response=await fetchAudio(new URL(path,baseURL));if(!response.ok)continue;
          const data=await response.arrayBuffer();
          const buffer=await ctx.decodeAudioData(data);if(!buffer?.duration||buffer.duration>30)continue;
          cache.set(id,buffer);if(cache.size>24)cache.delete(cache.keys().next().value);return buffer;
        }catch{/* Try the bundled MP3 when Vorbis isn't supported (older Safari). */}
      }
      return null;
    })().finally(()=>loading.delete(id));
    loading.set(id,promise);return promise;
  }
  async function play(name,{delay=0,ambient=false,fadeIn=0,maxDuration=15}={}){
    const event=events[name];
    if(!event||!allowed()||!ctx||(prefs.categories[event.category]??1)===0)return false;
    const time=now();if(time-(last.get(name)??-Infinity)<event.cooldown)return false;
    last.set(name,time);
    const token=epoch,ambientToken=ambientEpoch;
    try{
      const variants=event.variants.filter(id=>assets[id]);if(!variants.length)return false;
      const id=variants[Math.floor(Math.random()*variants.length)],buffer=await bufferFor(id);
      if(!buffer||token!==epoch||(ambient&&ambientToken!==ambientEpoch)||!allowed())return false;
      if((prefs.categories[event.category]??1)===0)return false;
      // Drop the oldest voices before allocating new nodes, including repeated events.
      const same=[...voices].filter(v=>v.name===name);if(same.length>=2)stop(same[0]);
      if(voices.size>=8)stop(voices.values().next().value);
      const source=ctx.createBufferSource(),node=ctx.createGain();
      const entry={source,node,name,category:event.category,gain:event.gain,ambient,timer:null};
      voices.add(entry);
      try{
        source.buffer=buffer;source.loop=ambient;source.connect(node);node.connect(ctx.destination);
        const start=ctx.currentTime+unit(delay,0),volume=gainFor(entry);
        node.gain.setValueAtTime(fadeIn?0:volume,start);
        if(fadeIn)node.gain.linearRampToValueAtTime(volume,start+Math.min(2,fadeIn));
        source.onended=()=>remove(entry);
        source.start(start);
        const duration=ambient?Math.max(1,Math.min(20,maxDuration)):Math.min(15,buffer.duration);
        if(ambient){node.gain.setValueAtTime(volume,start+duration-.5);node.gain.linearRampToValueAtTime(0,start+duration);}
        source.stop(start+duration);
        entry.timer=setTimeout(()=>remove(entry),(duration+unit(delay,0))*1000+200);
        return true;
      }catch{stop(entry);return false;}
    }catch{return false;}
  }
  function startAmbience(name='rest.campfire',options={}){stopAmbience(0);return play(name,{...options,ambient:true,fadeIn:.5,maxDuration:options.maxDuration||12});}
  function diagnostics(){return {enabled,unlocked,voices:voices.size,cached:cache.size,pending:loading.size};}
  return {configure,getPreferences,unlock,play,startAmbience,stopAmbience,stopAll,diagnostics};
}

export const sound=createSoundManager();
if(typeof document!=='undefined'){
  document.addEventListener('pointerdown',()=>sound.unlock(),{capture:true,passive:true});
  document.addEventListener('keydown',()=>sound.unlock(),{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.stopAll();});
  globalThis.addEventListener('pagehide',()=>sound.stopAll());
  globalThis.addEventListener('hashchange',()=>sound.stopAmbience());
}
