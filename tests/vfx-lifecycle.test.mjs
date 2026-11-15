import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the public effect lifecycle with a controlled frame clock. Browser
// painting speed must not decide whether elapsed time expires the particles.
let clockId=0;
async function effectsClock(run) {
  let now=0,nextId=0;
  const frames=new Map(),timers=new Map();
  const context=new Proxy({},{get:()=>()=>{}});
  const createNode=()=>({
    children:[],className:'',dataset:{},style:{setProperty(){}},setAttribute(){},removeAttribute(){},
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}},
    prepend(node){node.parent=this;this.children.unshift(node);},
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);},
    getContext:()=>context
  });
  const body=createNode();
  const runtime={
    document:{body,hidden:false,createElement:createNode,querySelector:()=>null,addEventListener(){}},
    window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
    innerWidth:1280,innerHeight:900,devicePixelRatio:1,
    performance:{now:()=>now},
    requestAnimationFrame(callback){const id=++nextId;frames.set(id,callback);return id;},
    cancelAnimationFrame:id=>frames.delete(id),
    setTimeout(callback,delay){const id=++nextId;timers.set(id,{at:now+delay,callback});return id;},
    clearTimeout:id=>timers.delete(id)
  };
  const originals=new Map(Object.keys(runtime).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  try {
    for(const [key,value] of Object.entries(runtime))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
    const effects=await import(`../vfx.js?clock=${++clockId}`);
    await run({
      ...effects,body,frames,timers,
      tick(time) {
        now=time;
        for(const [id,timer] of timers)if(timer.at<=now){timers.delete(id);timer.callback();}
        const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(now));
      }
    });
  } finally {
    for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}

test('effect particles expire by elapsed time when frames are sparse',()=>effectsClock(clock=>{
  clock.playEffect('critical',{label:'Slow frames'});
  assert.equal(clock.body.children.length,1,'the effect mounted');
  // Follow the configured effect duration; changing an animation's length is safe.
  const expiry=Math.max(...[...clock.timers.values()].map(timer=>timer.at))+60000;
  clock.tick(expiry);clock.tick(expiry+1000);
  assert.equal(clock.body.children.length,0,'expired particles release the canvas and overlay');
  assert.equal(clock.frames.size,0,'no animation loop survives');
  assert.equal(clock.timers.size,0);
}));

test('canceling an effect removes its overlay and scheduled work',()=>effectsClock(clock=>{
  clock.playEffect('critical');clock.tick(250);clock.clearEffects();
  assert.equal(clock.body.children.length,0);
  assert.equal(clock.frames.size,0);
  assert.equal(clock.timers.size,0);
  clock.tick(5000);
  assert.equal(clock.body.children.length,0,'a canceled effect cannot reappear');
}));
