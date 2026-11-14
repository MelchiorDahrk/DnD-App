import test from 'node:test';
import assert from 'node:assert/strict';
import {FEATURE_CATALOG,filterFeatures,featureFields} from '../feature-catalog.js';
import {CLASSES,makeCharacter,SAVE_VERSION,parseBackup,shortRest,longRest,rollFeature,validDiceFormula} from '../model.js';
import {SUBCLASSES,SPECIES} from '../catalog.js';
import {catalogPicker} from '../catalog-ui.js';

const find=(name,owner)=>{
  const entry=FEATURE_CATALOG.find(e=>e.name===name&&(!owner||e.owner===owner));
  assert.ok(entry,`${owner||''}: ${name}`);return entry;
};
test('feature catalog covers every supported class, subclass, species family and all four core feat categories',()=>{
  assert.equal(new Set(FEATURE_CATALOG.map(e=>e.id)).size,FEATURE_CATALOG.length);
  for(const name of Object.keys(CLASSES))assert.ok(FEATURE_CATALOG.some(e=>e.group==='Class features'&&e.className===name),name);
  for(const subclass of SUBCLASSES)assert.ok(FEATURE_CATALOG.some(e=>e.subclass===subclass.name&&e.className===subclass.className),subclass.name);
  for(const species of SPECIES)assert.ok(filterFeatures({character:makeCharacter({race:species.name}),group:'Species traits'}).length,species.name);
  // Magic Initiate's three spell lists represent one of the 75 core feats.
  assert.equal(FEATURE_CATALOG.filter(e=>e.group==='Origin feats').length,12);
  assert.equal(FEATURE_CATALOG.filter(e=>e.group==='General feats').length,43);
  assert.equal(FEATURE_CATALOG.filter(e=>e.group==='Fighting styles').length,10);
  assert.equal(FEATURE_CATALOG.filter(e=>e.group==='Epic boons').length,12);
  for(const e of FEATURE_CATALOG){assert.match(e.id,/^[a-z0-9-]+$/);assert.ok(e.details);assert.ok(e.group==='Custom resources'||/^https:\/\/dnd(?:5e|2024)\.wikidot.com\//.test(e.wiki));}
});
test('suggestions honor class, subclass, lineage families, and level while All options remains unrestricted',()=>{
  const c=makeCharacter({class:'Fighter',subclass:'Battle Master',race:'Wood Elf',level:3});
  const names=filterFeatures({character:c}).map(e=>e.name);
  for(const name of ['Second Wind','Superiority Dice','Riposte','Fey Ancestry','Longstrider (lineage)','Lucky'])assert.ok(names.includes(name),name);
  for(const name of ['Rage','Focus Points','Darkness (lineage)','Pass without Trace (lineage)','Improved Critical','Boon of Fate'])assert.ok(!names.includes(name),name);
  assert.ok(filterFeatures({character:c,scope:'character-all-levels'}).some(e=>e.name==='Indomitable'));
  assert.equal(filterFeatures({character:c,scope:'all'}).length,FEATURE_CATALOG.length);
  assert.ok(filterFeatures({character:c,scope:'all',query:'barbarian rage'}).some(e=>e.name==='Rage'));
  assert.equal(filterFeatures({character:c,query:'does-not-exist'}).length,0);
  assert.ok(filterFeatures({character:{race:'Hill Dwarf',level:3},group:'Species traits'}).some(e=>e.name==='Dwarven Toughness'));
  assert.ok(!filterFeatures({character:{race:'Custom folk',level:3},group:'Species traits'}).length);
});
test('resource snapshots scale by class level while proficiency uses total character level',()=>{
  const c=makeCharacter({class:'Fighter',level:17,stats:{str:10,dex:10,con:14,int:14,wis:16,cha:18}});
  let f=featureFields(find('Second Wind'),c,3);
  assert.equal(f.maxUses,2);assert.equal(f.shortRestRecovery,1);assert.equal(f.rollFormula,'1d10+3');assert.equal(f.reset,'long');
  assert.equal(featureFields(find('Second Wind'),c,4).maxUses,3);
  assert.equal(featureFields(find('Second Wind'),c,10).maxUses,4);
  assert.equal(featureFields(find('Action Surge'),c).maxUses,2);
  assert.equal(featureFields(find('Superiority Dice'),c,3).rollFormula,'1d8');
  assert.equal(featureFields(find('Superiority Dice'),c,18).rollFormula,'1d12');
  assert.equal(featureFields(find('Bardic Inspiration'),c,4).reset,'long');
  assert.equal(featureFields(find('Bardic Inspiration'),c,5).reset,'short');
  assert.equal(featureFields(find('Bardic Inspiration'),c,5).maxUses,4);
  assert.equal(featureFields(find('Lucky'),c,1).maxUses,6);
  assert.equal(featureFields(find('Breath Weapon'),c,1).rollFormula,'4d10');
  assert.equal(featureFields(find('Lay On Hands'),c,20).maxUses,100);
  assert.equal(featureFields(find('Sneak Attack'),c,11).rollFormula,'6d6');
  assert.equal(featureFields(find('Wild Shape'),c,6).maxUses,3);
  assert.equal(featureFields(find('Channel Divinity','Cleric'),c,18).maxUses,4);
  const low=makeCharacter({stats:{str:8,dex:8,con:8,int:8,wis:8,cha:8}});
  assert.equal(featureFields(find('Tireless'),low,10).maxUses,1);
  assert.equal(featureFields(find('Tireless'),low,10).rollFormula,'1d8-1');
  assert.equal(featureFields(find('Wholeness of Body'),low,6).rollFormula,'1d8-1');
});
test('shared options do not create duplicate resource pools; long/short rest defaults behave correctly',()=>{
  for(const name of ['Riposte','Cutting Words','Divine Spark','Flurry of Blows','Quickened Spell']){
    const f=featureFields(find(name));assert.equal(f.maxUses,0,name);assert.equal(f.rollFormula,'',name);
  }
  const c=makeCharacter({class:'Fighter',level:3});
  c.features=['Second Wind','Action Surge','Superiority Dice'].map(name=>({id:name,used:1,...featureFields(find(name),c)}));
  shortRest(c,0);
  assert.deepEqual(c.features.map(f=>f.used),[0,0,0]);
  c.features.forEach(f=>f.used=f.maxUses);
  longRest(c);
  assert.ok(c.features.every(f=>f.used===0));
  const f=c.features[2];rollFeature(f,()=>4);assert.equal(f.used,1);
  f.used=f.maxUses;assert.throws(()=>rollFeature(f),/No uses remaining/);
});
test('every preset round-trips at low and high levels, including 100-point resources',()=>{
  for(const level of [1,20]){
    const c=makeCharacter({level,stats:{str:8,dex:8,con:8,int:8,wis:8,cha:8}});
    c.features=FEATURE_CATALOG.map(e=>({id:e.id,used:0,...featureFields(e,c)}));
    for(const f of c.features)assert.ok(!f.rollFormula||validDiceFormula(f.rollFormula),`${f.name}: ${f.rollFormula}`);
    const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
    assert.deepEqual(parseBackup(JSON.stringify(state)),state);
  }
});
test('picker exposes scope, categories, search, custom entries and initial character suggestions',()=>{
  const html=catalogPicker('feat',makeCharacter({class:'Fighter',subclass:'Battle Master',race:'Drow',level:3}));
  assert.match(html,/data-catalog-scope="feat"/);assert.match(html,/All options/);
  assert.match(html,/data-catalog-group="feat"/);assert.match(html,/data-catalog-search="feat"/);
  assert.match(html,/Superiority Dice/);assert.doesNotMatch(html,/<option[^>]*>Rage/);
  assert.match(html,/Custom entry/);assert.match(html,/data-feature-level/);
});
