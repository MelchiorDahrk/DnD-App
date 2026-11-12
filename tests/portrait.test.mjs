import test from 'node:test';
import assert from 'node:assert/strict';
import {validPortrait,portraitMarkup} from '../portrait.js';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';

// Keep a real Bricktrait design fixture independent of the save validator.
const design={
  figure:{head:{id:'3626cp01',color:14},headgear:{id:'3901',color:6},neck:{id:null,color:6},back:{id:null,color:4},torso:{id:'973p01',color:15,arms:4,hands:14},legs:{id:'standard',color:1,hips:1},handR:{id:null,color:71,spin:0},handL:{id:null,color:71,spin:0},pose:{head:0,armR:0,armL:0,raiseR:0,raiseL:0,wristR:0,wristL:0,legR:0,legL:0,spreadR:0,spreadL:0}},
  view:{yaw:0,pitch:0,zoom:1},style:{background:'space',backdrop:'#262a72',backdrop2:'#0d0f2b',ring:true,ringColor:'#1f5ef5',shape:'round',outline:false,retro:false}
};
const portrait=()=>({image:'data:image/webp;base64,UklGRg==',design:structuredClone(design)});
const state=c=>({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});

test('portraits survive backup export/import with their editable design',()=>{
  const c=makeCharacter({portrait:portrait()});
  assert.deepEqual(parseBackup(JSON.stringify(state(c))).characters[0].portrait,c.portrait);
  assert.match(portraitMarkup(c),/data:image\/webp;base64/);
});

test('existing version 2 characters need no migration or new portrait field',()=>{
  const c=makeCharacter();assert.equal(Object.hasOwn(c,'portrait'),false);
  assert.equal(parseBackup(JSON.stringify(state(c))).characters[0].portrait,undefined);
  assert.match(portraitMarkup(c),/portrait-adventurer.webp/);
});

test('backup validation rejects unsafe images, excessive data, invalid parts and malformed designs',()=>{
  const cases=[
    p=>p.image='https://example.org/track.png',
    p=>p.image='data:image/svg+xml;base64,PHN2Zz4=',
    p=>p.image='data:image/png;base64,abc" onerror="bad',
    p=>p.image='data:image/png;base64,'+'A'.repeat(180000),
    p=>delete p.design.figure.head,
    p=>p.design.figure.head.id='../../index.html',
    p=>p.design.figure.head.color='red',
    p=>p.design.figure.pose.armR=Infinity,
    p=>p.design.view.zoom=500,
    p=>p.design.style.background='image',
    p=>p.design.style.ringColor='url(https://example.org)',
    p=>p.design.extra='x'.repeat(12000)
  ];
  for(const mutate of cases){const p=portrait();mutate(p);assert.equal(validPortrait(p),false);assert.throws(()=>parseBackup(JSON.stringify(state(makeCharacter({portrait:p})))),/portrait/);}
});

