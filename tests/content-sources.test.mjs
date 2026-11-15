import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_SOURCES,contentSourceIds,contentEnabled,visibleContent} from '../content-sources.js';
import {FEATURE_CATALOG,featureFields} from '../feature-catalog.js';
import {EQUIPMENT,itemFromEquipment} from '../catalog.js';
import {catalogPicker,characterChoice,filterEquipment} from '../catalog-ui.js';
import {initialState} from '../default-characters.js';
import {makeCharacter,parseBackup} from '../model.js';

const giants='Bigby Presents: Glory of the Giants';
const giantFeats=FEATURE_CATALOG.filter(entry=>entry.book===giants);
const hiddenSources=contentSourceIds(giantFeats[0]);
const settings={sound:false,hiddenSources};

test('every catalog source has a unique setting and spelling variants share the same setting',()=>{
  assert.equal(new Set(CONTENT_SOURCES.map(source=>source.id)).size,CONTENT_SOURCES.length);
  const ids=new Set(CONTENT_SOURCES.map(source=>source.id));
  for(const entry of [...FEATURE_CATALOG,...EQUIPMENT])for(const id of contentSourceIds(entry))assert.ok(ids.has(id),entry.name);
  for(const title of ['Bigby Presents - Glory of the Giants',giants])assert.deepEqual(contentSourceIds({source:title,edition:'2014'}),hiddenSources);
  assert.deepEqual(contentSourceIds({source:'Forgotten Realms - Heroes of Faerun'}),contentSourceIds({book:'Forgotten Realms: Heroes of Faerûn'}));
  assert.deepEqual(contentSourceIds({source:'Source: D&D Beyond Drops - June 2026'}),contentSourceIds({source:'DND Beyond Drops - August 2026'}));
  assert.notDeepEqual(contentSourceIds({book:'Player’s Handbook (2014)'}),contentSourceIds({book:'Player’s Handbook (2024)'}));
});

test('settings hide all eight giant feats and their items from initial and searched choices',()=>{
  const character=makeCharacter({level:9});
  assert.equal(giantFeats.length,8);
  assert.ok(giantFeats.some(entry=>entry.name==='Guile of the Cloud Giant'));
  assert.equal(visibleContent(giantFeats,{}).length,8);
  assert.deepEqual(visibleContent(giantFeats,settings),[]);
  const giantItems=EQUIPMENT.filter(entry=>contentSourceIds(entry,'item').includes(hiddenSources[0]));
  assert.equal(giantItems.length,27);
  assert.deepEqual(filterEquipment(giantItems,{settings}),[]);
  assert.deepEqual(filterEquipment(giantItems,{settings,query:'giant'}),[]);
  const featPicker=catalogPicker('feat',character,settings),itemPicker=catalogPicker('item',character,settings);
  for(const entry of giantFeats)assert.ok(!featPicker.includes(entry.id),entry.name);
  for(const entry of giantItems)assert.ok(!itemPicker.includes(`value="${entry.id}"`),entry.name);
  assert.equal(visibleContent(FEATURE_CATALOG,{}).length,FEATURE_CATALOG.length);
});

test('shared entries stay available until every listed source is disabled; custom resources stay available',()=>{
  const shared={source:"Player's Handbook; Dungeon Master's Guide",edition:'2024'};
  const [phb,dmg]=contentSourceIds(shared,'item');
  assert.equal(contentEnabled(shared,{hiddenSources:[phb]},'item'),true);
  assert.equal(contentEnabled(shared,{hiddenSources:[phb,dmg]},'item'),false);
  const allHidden={hiddenSources:CONTENT_SOURCES.map(source=>source.id)};
  assert.ok(visibleContent(FEATURE_CATALOG,allHidden).every(entry=>entry.group==='Custom resources'));
  assert.equal(filterEquipment(EQUIPMENT,{settings:allHidden}).length,0);
  const choice=characterChoice('Species','race','Human',{settings:allHidden});
  assert.match(choice,/<option value="Human" selected>/);
  assert.ok(!choice.includes('value="Dragonborn"'));
});

test('source preferences round-trip without changing saved features, items, or older backups',()=>{
  const state=initialState(),character=makeCharacter({level:9});
  character.features=[{id:'cloud',used:1,...featureFields(giantFeats.find(entry=>entry.name==='Guile of the Cloud Giant'),character)}];
  character.items=[{id:'giant-item',...itemFromEquipment(EQUIPMENT.find(entry=>contentSourceIds(entry,'item').includes(hiddenSources[0])))}];
  state.characters=[character];state.activeId=character.id;
  const old=parseBackup(JSON.stringify(state));
  assert.deepEqual(old.settings,{sound:false});
  state.settings=settings;
  const loaded=parseBackup(JSON.stringify(state));
  assert.deepEqual(loaded.characters,old.characters);
  assert.deepEqual(loaded.settings,settings);
  for(const invalid of [null,'all',[1],['<script>'],Array(501).fill('source')]){
    state.settings={sound:false,hiddenSources:invalid};
    assert.throws(()=>parseBackup(JSON.stringify(state)),/invalid content sources/);
  }
});
