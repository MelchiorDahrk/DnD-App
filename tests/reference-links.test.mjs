import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wikiURL,referenceURL,subclassURL} from '../reference-links.js';
import {PAGES_2014,PAGES_2024} from '../reference-pages.js';
import {CLASS_OPTIONS,SPECIES,BACKGROUNDS,SUBCLASSES,ORIGIN_FEATS,EQUIPMENT} from '../catalog.js';
import {FEATURE_CATALOG} from '../feature-catalog.js';
import {SPELL_CATALOG} from '../progression-data.js';
import {LEGACY_SUBCLASSES} from '../progression-options.js';
import {demoCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {restReminders} from '../rest-rules.js';

const current='https://dnd2024.wikidot.com',earlier='https://dnd5e.wikidot.com';
const indexed=url=>{
  const u=new URL(url),paths=u.hostname==='dnd5e.wikidot.com'?PAGES_2014:PAGES_2024;
  assert.ok([new URL(current).hostname,new URL(earlier).hostname].includes(u.hostname),url);
  assert.ok(paths.includes(u.pathname),`Not in wiki index: ${url}`);
};
test('built-in catalogs and progression use indexed wiki pages, with individual pages for every feat and spell',()=>{
  for(const e of [...CLASS_OPTIONS,...SPECIES,...BACKGROUNDS,...SUBCLASSES,...ORIGIN_FEATS,...EQUIPMENT,...LEGACY_SUBCLASSES,...SPELL_CATALOG,...FEATURE_CATALOG.filter(e=>e.group!=='Custom resources')])indexed(e.wiki);
  for(const e of FEATURE_CATALOG.filter(e=>/feats|Fighting styles|Epic boons/.test(e.group)))assert.match(e.wiki,/\/feat:(?!all$).+/,e.name);
  for(const e of SPELL_CATALOG)assert.match(e.wiki,/\/spell:(?!all$).+/,e.name);
  for(const e of LEGACY_SUBCLASSES)assert.ok(e.wiki.startsWith(earlier+'/'),e.name);
  for(const e of CLASS_OPTIONS)assert.equal(e.wiki.startsWith(earlier+'/'),e.name==='Artificer',e.name);
});
test('references handle punctuation, SRD spell aliases, origin variants, styles, boons and earlier options',()=>{
  assert.equal(wikiURL('Hunter’s Mark','spell'),current+'/spell:hunter-s-mark');
  assert.equal(wikiURL('Enlarge/Reduce','spell'),current+'/spell:enlarge-reduce');
  assert.equal(wikiURL('Arcane Hand','spell'),current+'/spell:bigby-s-hand');
  assert.equal(wikiURL('Freezing Sphere','spell'),current+'/spell:otiluke-s-freezing-sphere');
  assert.equal(wikiURL('Magic Initiate (Wizard)','feat'),current+'/feat:magic-initiate');
  assert.equal(wikiURL('Fighting Style: Archery','feat'),current+'/feat:archery');
  assert.equal(wikiURL('Boon of Fate','feat'),current+'/feat:boon-of-fate');
  assert.equal(wikiURL('Fey-Touched','feat'),current+'/feat:fey-touched');
  assert.equal(wikiURL('Half-Elf','species','2014'),earlier+'/lineage:half-elf');
  assert.equal(wikiURL('Folk Hero','background','2014'),earlier+'/background:folk-hero');
  assert.equal(subclassURL('Path of the Beast','Barbarian','2014'),earlier+'/barbarian:beast');
  assert.equal(subclassURL('Purple Dragon Knight','Fighter','2014'),earlier+'/fighter:banneret');
  assert.equal(wikiURL('Homebrew not in the wiki','spell'),current+'/spell:all');
});
test('saved publisher feat, spell, feature and origin references resolve without modifying backups',()=>{
  const beyond='https://www.dndbeyond.com';
  assert.equal(referenceURL(beyond+'/sources/dnd/phb-2024/feats','Athlete','Fighter'),current+'/feat:athlete');
  assert.equal(referenceURL(beyond+'/sources/dnd/tcoe','Eldritch Adept'),earlier+'/feat:eldritch-adept');
  assert.equal(referenceURL(beyond+'/sources/dnd/xgte','Dwarven Fortitude','Fighter'),earlier+'/feat:dwarven-resilience');
  assert.equal(referenceURL(beyond+'/spells/2619079-cure-wounds','Renamed spell','spell'),current+'/spell:cure-wounds');
  assert.equal(referenceURL(beyond+'/sources/dnd/br-2014/spell-descriptions','Catnap','spell'),earlier+'/spell:catnap');
  assert.equal(referenceURL(beyond+'/sources/dnd/phb-2024/character-classes#BattleMaster','Riposte','Fighter'),current+'/fighter:battle-master');
  assert.equal(referenceURL(beyond+'/sources/dnd/br-2024/character-classes#Ranger','Favored Enemy','Ranger'),current+'/ranger:main');
  assert.equal(referenceURL(beyond+'/sources/dnd/basic-rules-2014/races#HalfElf','Fey Ancestry'),earlier+'/lineage:half-elf');
  const c=demoCharacter();c.features[0].wiki=beyond+'/sources/dnd/br-2024/character-classes#Ranger';
  const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}},json=JSON.stringify(state);
  referenceURL(c.features[0].wiki,c.features[0].name,c.class);
  assert.deepEqual(parseBackup(json),state);assert.equal(JSON.stringify(state),json);
});
test('custom URLs, explicit earlier wiki links and publisher attribution stay usable; unsafe input is rejected',()=>{
  for(const url of ['https://example.com/homebrew','https://dnd5e.wikidot.com/custom-rule','https://www.dndbeyond.com/characters/123','https://www.dndbeyond.com/srd','https://www.dndbeyond.com/sources/dnd/custom-book/spells','https://www.dndbeyond.com/posts/unrelated-article'])assert.equal(referenceURL(url,'Athlete','feat'),url);
  assert.equal(referenceURL('https://dnd5e.wikidot.com/spell:cure-wounds','Cure Wounds','spell'),earlier+'/spell:cure-wounds');
  assert.equal(referenceURL('javascript:alert(1)','Athlete','feat'),'');
  assert.doesNotThrow(()=>referenceURL('https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#%ZZ','Ranger'));
});
test('rest reminders resolve older saved publisher feat links',()=>{
  const c=demoCharacter();c.features.push({id:'chef',name:'Chef',description:'Prepare treats after a Long Rest.',wiki:'https://www.dndbeyond.com/sources/dnd/phb-2024/feats',maxUses:0,used:0,reset:'manual'});
  assert.equal(restReminders(c).find(r=>r.key==='feature:chef').wiki,current+'/feat:chef');
});
test('offline cache and static deployment include reference modules',async()=>{
  const [sw,build]=await Promise.all(['../sw.js','../scripts/build.mjs'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  for(const name of ['reference-links.js','reference-pages.js']){assert.ok(sw.includes(`'./${name}'`));assert.ok(build.includes(`'${name}'`));}
});
