import test from 'node:test';
import assert from 'node:assert/strict';
import {jumpToSheetSection} from '../sheet-layout.js';

// Animation timing uses a controlled clock; a CI runner's painting speed is not
// evidence that scrolling is slow. Browser checks cover the actual destination.
function navigationClock(run,{reducedMotion=false}={}) {
  let now=0,nextId=0,y=0,focused;
  const frames=new Map(),positions={abilities:900,skills:2600,essentials:7200};
  const header={dataset:{},querySelectorAll:()=>[],getBoundingClientRect:()=>({height:84})};
  const sections=Object.fromEntries(Object.entries(positions).map(([key,top])=>[key,{
    getBoundingClientRect:()=>({top:top-y}),
    querySelector:()=>({focus:options=>{focused={key,...options};}})
  }]));
  const root={querySelector:selector=>selector==='.sheet-header'?header:sections[selector.match(/data-sheet-section="([^"]+)"/)?.[1]]};
  const runtime={
    window:{get scrollY(){return y;},scrollX:0,scrollTo:options=>{y=options.top;},matchMedia:()=>({matches:reducedMotion})},
    document:{documentElement:{scrollHeight:8000}},innerHeight:844,
    getComputedStyle:()=>({top:'65px'}),performance:{now:()=>now},
    requestAnimationFrame(callback){const id=++nextId;frames.set(id,callback);return id;},
    cancelAnimationFrame:id=>frames.delete(id)
  };
  const originals=new Map(Object.keys(runtime).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  try {
    for(const [key,value] of Object.entries(runtime))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
    run({
      jump:key=>jumpToSheetSection(root,key),frames,header,
      get y(){return y;},get focused(){return focused;},
      target:key=>positions[key]-65-84-12,
      tick(time){now=time;const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(now));}
    });
  } finally {
    for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}

test('sheet navigation eases through intermediate positions and finishes within 240 ms',()=>navigationClock(clock=>{
  clock.jump('essentials');
  assert.equal(clock.y,0,'starting a jump must not snap to its destination');
  assert.deepEqual(clock.focused,{key:'essentials',preventScroll:true});
  let previous=0;
  for(const time of [16,60,120,200,239]) {
    clock.tick(time);
    assert.ok(clock.y>previous&&clock.y<clock.target('essentials'),'each frame advances toward the heading');
    assert.equal(clock.header.dataset.activeSection,'essentials');
    previous=clock.y;
  }
  clock.tick(240);
  assert.equal(clock.y,clock.target('essentials'),'the heading clears the sticky header');
  assert.equal(clock.frames.size,0);
}));

test('sheet navigation completes on the next available frame when painting stalls',()=>navigationClock(clock=>{
  clock.jump('skills');
  clock.tick(1000);
  assert.equal(clock.y,clock.target('skills'));
  assert.equal(clock.frames.size,0,'a delayed frame must not restart or prolong the animation');
}));

test('a second section jump cancels unfinished travel in either direction',()=>navigationClock(clock=>{
  clock.jump('essentials');clock.tick(60);
  const start=clock.y;
  clock.jump('abilities');
  assert.equal(clock.y,start,'retargeting preserves the current position');
  assert.equal(clock.frames.size,1,'only the latest animation survives');
  clock.tick(180);
  assert.ok(clock.y<start&&clock.y>clock.target('abilities'));
  clock.tick(300);
  assert.equal(clock.y,clock.target('abilities'));
  assert.equal(clock.header.dataset.activeSection,'abilities');
  assert.equal(clock.frames.size,0);
}));

test('reduced motion goes directly to the section without scheduling animation',()=>navigationClock(clock=>{
  clock.jump('skills');
  assert.equal(clock.y,clock.target('skills'));
  assert.equal(clock.frames.size,0);
},{reducedMotion:true}));
