import test from 'node:test';
import assert from 'node:assert/strict';
import {validPortrait,portraitMarkup,defaultPortrait} from '../portrait.js';
import {CLASS_PORTRAITS,RACE_PORTRAITS,DEFAULT_PORTRAIT_IDS,defaultPortraitId} from '../portrait-defaults.js';
import {DEFAULT_PORTRAITS} from '../portrait-default-data.js';
import catalog from '../vendor/bricktrait/preset-catalog.json' with {type:'json'};
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {defaultStyle,transparentStyle} from '../vendor/bricktrait/src/lib/compose.ts';

// Keep a real Bricktrait design fixture independent of the save validator.
const design={
  figure:{head:{id:'3626cp01',color:14},headgear:{id:'3901',color:6},neck:{id:null,color:6},back:{id:null,color:4},torso:{id:'973p01',color:15,arms:4,hands:14},legs:{id:'standard',color:1,hips:1},handR:{id:null,color:71,spin:0},handL:{id:null,color:71,spin:0},pose:{head:0,armR:0,armL:0,raiseR:0,raiseL:0,wristR:0,wristL:0,legR:0,legL:0,spreadR:0,spreadL:0}},
  view:{yaw:0,pitch:0,zoom:1},style:{background:'space',backdrop:'#262a72',backdrop2:'#0d0f2b',ring:true,ringColor:'#1f5ef5',shape:'round',outline:false,retro:false}
};
const portrait=()=>({image:'data:image/webp;base64,UklGRg==',design:structuredClone(design)});
const state=c=>({version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}});

test('portraits survive backup export/import with their editable design',()=>{
  const c=makeCharacter({portrait:portrait()});
  c.items=[{id:'independent-inventory-id',name:'Longsword',category:'Weapon',qty:1,weight:3,equipped:true,description:'Family heirloom',wiki:''}];
  assert.deepEqual(parseBackup(JSON.stringify(state(c))).characters[0].portrait,c.portrait);
  assert.deepEqual(parseBackup(JSON.stringify(state(c))).characters[0].items,c.items);
  assert.match(portraitMarkup(c),/data:image\/webp;base64/);
});

test('new defaults and reopened legacy designs use alpha without mutating saved data',()=>{
  for(const style of [defaultStyle,transparentStyle(design.style)]) {
    assert.equal(style.background,'none');assert.equal(style.ring,false);
    assert.equal(style.shape,'square');assert.equal(style.outline,false);
  }
  const old=portrait(),before=structuredClone(old);
  const working=structuredClone(old.design);working.style=transparentStyle(working.style);
  assert.deepEqual(working.figure,old.design.figure);assert.deepEqual(working.view,old.design.view);
  assert.deepEqual(old,before);
  assert.ok(validPortrait(old));
  assert.ok(validPortrait({...old,design:working}));
});

test('existing version 2 characters need no migration or new portrait field',()=>{
  const c=makeCharacter();assert.equal(Object.hasOwn(c,'portrait'),false);
  assert.equal(parseBackup(JSON.stringify(state(c))).characters[0].portrait,undefined);
  assert.match(portraitMarkup(c),/original-greenwood-scout.webp/);
});

test('automatic figures cover classes, exact subclasses and species lineages with stable fallbacks',()=>{
  for(const [cls,[name,subclasses]] of Object.entries(CLASS_PORTRAITS)) {
    assert.equal(defaultPortraitId({class:cls}),`original-${name}`);
    for(const [subclass,preset] of Object.entries(subclasses))assert.equal(defaultPortraitId({race:'Human',class:cls,subclass}),`original-${preset}`);
    assert.equal(defaultPortraitId({class:cls,subclass:'Custom subclass'}),`original-${name}`);
  }
  for(const [race,[name,classes]] of Object.entries(RACE_PORTRAITS)) {
    assert.equal(defaultPortraitId({race,class:'Custom class'}),`original-${name}`);
    for(const [cls,preset] of Object.entries(classes))assert.equal(defaultPortraitId({race,class:cls}),`original-${preset}`);
  }
  assert.equal(defaultPortraitId({race:'  WoOd   eLF ',class:'rOgUe',subclass:'Assassin'}),'original-forest-duelist');
  assert.equal(defaultPortraitId({race:'Hill Dwarf',class:'Barbarian',subclass:'Path of the Beast'}),'original-mountain-shieldbearer');
  assert.equal(defaultPortraitId({race:'Drow',class:'Fighter'}),'original-silver-mail-sentinel');
  assert.equal(defaultPortraitId({race:'Infernal Tiefling',class:'Warlock'}),'original-ember-invoker');
  assert.equal(defaultPortraitId({race:'Custom species',class:'Wizard'}),'original-star-robed-sage');
  assert.equal(defaultPortraitId({race:'Custom species',class:'Custom class'}),null);
  assert.equal(defaultPortrait({}),null);
  assert.match(portraitMarkup({}),/portrait-adventurer.webp/);
});

test('default images and editable figures use the same catalog entry, without changing character saves',()=>{
  assert.deepEqual(Object.keys(DEFAULT_PORTRAITS).sort(),[...DEFAULT_PORTRAIT_IDS].sort());
  for(const id of DEFAULT_PORTRAIT_IDS) {
    const preset=catalog.presets.find(p=>p.id===id);
    assert.ok(preset,id);
    assert.deepEqual(DEFAULT_PORTRAITS[id],{thumbnail:preset.thumbnail,figure:preset.figure});
  }
  const c=makeCharacter({race:'Human',class:'Wizard'}),before=structuredClone(c);
  const preset=defaultPortrait(c);
  assert.match(portraitMarkup(c),new RegExp(preset.thumbnail));
  preset.figure.head.id=null;
  assert.ok(defaultPortrait(c).figure.head.id,'editing a working figure cannot change future defaults');
  assert.deepEqual(c,before);
  c.portrait=portrait();
  assert.match(portraitMarkup(c),/data:image\/webp;base64/);
  c.race='Dwarf';c.class='Barbarian';
  assert.match(portraitMarkup(c),/data:image\/webp;base64/,'changing character choices preserves a saved custom image');
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

