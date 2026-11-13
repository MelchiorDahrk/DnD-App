import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,longRest,shortRest,SAVE_VERSION,parseBackup,CLASSES} from '../model.js';
import {restRefreshes,restReminders} from '../rest-rules.js';
import {REST_REFERENCES} from '../rest-reference-data.js';
const feature=(name,extra={})=>({id:crypto.randomUUID(),name,description:'',maxUses:2,used:2,reset:'long',shortRestRecovery:0,rollFormula:'',wiki:'',...extra});
const names=(c,kind)=>restReminders(c,kind).map(r=>r.title);

test('long rest preview is read-only and agrees with actual selected resource recovery',()=>{
 const c=makeCharacter({class:'Fighter',race:'Dwarf',level:5,hp:2,maxHp:45,hitDice:1,tempHp:8,exhaustion:3,concentration:'Bless',deathFailure:2});
 c.slots[0]={max:3,used:2};c.conditions=['Poisoned'];
 c.features=[feature('Second Wind'),feature('Superiority Dice',{reset:'short',maxUses:4,used:3}),feature('Sealed power'),feature('Dawn charges',{reset:'manual'})];
 const before=structuredClone(c),options={reduceExhaustion:false,skipFeatureIds:[c.features[2].id]};
 const rows=restRefreshes(c,options);assert.deepEqual(c,before);
 longRest(c,options);
 for(const row of rows.filter(r=>r.featureId)){const f=c.features.find(f=>f.id===row.featureId);assert.equal(row.after,f.maxUses-f.used);}
 assert.equal(rows.find(r=>r.key==='hp').after,c.hp);assert.equal(rows.find(r=>r.key==='slot-0').after,c.slots[0].max-c.slots[0].used);
 assert.equal(c.features[2].used,2);assert.equal(c.features[3].used,2);assert.equal(c.exhaustion,3);assert.deepEqual(c.conditions,['Poisoned']);
 const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};assert.deepEqual(parseBackup(JSON.stringify(state)).characters[0],c);
});

test('each core class receives only its eligible rest choices without requiring feature presets',()=>{
 for(const cls of Object.keys(CLASSES)){
  const c=makeCharacter({class:cls,race:'Halfling'}),list=names(c);
  assert.equal(list.includes('Weapon Mastery'),['Fighter','Barbarian','Paladin','Ranger','Rogue'].includes(cls),cls);
  assert.equal(list.includes('Prepared spells'),['Artificer','Cleric','Druid','Wizard','Paladin','Ranger'].includes(cls),cls);
  assert.equal(list.includes('Wizard cantrip'),cls==='Wizard',cls);
  assert.equal(list.includes('Portent'),false,cls);
 }
});

test('subclass choices honor unlock levels and aliases',()=>{
 assert.ok(names(makeCharacter({class:'Druid',subclass:'Circle of the Land',level:3})).includes('Circle of the Land Spells'));
 assert.ok(!names(makeCharacter({class:'Barbarian',subclass:'Path of the Wild Heart',level:5})).includes('Aspect of the Wilds'));
 assert.ok(names(makeCharacter({class:'Barbarian',subclass:'Path of the Totem Warrior',level:6})).includes('Aspect of the Wilds'));
 assert.ok(names(makeCharacter({class:'Wizard',subclass:'School of Divination',level:3})).includes('Portent'));
 assert.ok(names(makeCharacter({class:'Barbarian',subclass:'Path of the Beast',level:6})).includes('Bestial Soul'));
 assert.ok(!names(makeCharacter({class:'Barbarian',subclass:'Path of the Beast',level:5})).includes('Bestial Soul'));
 assert.ok(names(makeCharacter({class:'Artificer',subclass:'Alchemist',level:3})).includes('Experimental Elixir'));
});

test('species, feats, invocations, custom rules, spells, and inventory participate without granting unowned options',()=>{
 const c=makeCharacter({class:'Fighter',race:'Human'});
 assert.ok(names(c).includes('Resourceful'));assert.ok(!names(c).includes('Crafter'));
 c.features=[feature('Crafter (Origin feat)',{maxUses:0,reset:'manual'}),feature('Pact of the Tome',{maxUses:0,reset:'manual'}),feature('Homebrew blessing',{description:'After a Long Rest, choose your element.'})];
 c.spells=[{id:'wish',name:'Wish',notes:'',wiki:''}];c.items=[{id:'wand',name:'Wand of Magic Missiles',qty:1,description:'',wiki:''}];
 const reminders=restReminders(c);
 for(const name of ['Crafter (Origin feat)','Pact of the Tome','Homebrew blessing','Wish','Wand of Magic Missiles'])assert.ok(reminders.some(r=>r.title===name),name);
 assert.match(reminders.find(r=>r.title==='Wand of Magic Missiles').detail,/dawn/);
 assert.match(reminders.find(r=>r.title==='Homebrew blessing').detail,/choose your element/);
 assert.ok(names(makeCharacter({race:'High Elf'})).includes('High Elf cantrip'));
 assert.ok(names(makeCharacter({race:'High Elf',level:3})).includes('Detect Magic (lineage)'));
 const legacyElf=makeCharacter({race:'High Elf',level:5});legacyElf.features=[feature('Elf traits',{description:'2014 High Elf lineage.',maxUses:0,reset:'manual'})];
 assert.ok(!names(legacyElf).includes('Misty Step (lineage)'));
 assert.ok(!names(legacyElf).includes('High Elf cantrip'));
 assert.ok(names(makeCharacter({race:'Dragonborn',level:5})).includes('Draconic Flight'));
 assert.ok(!names(makeCharacter({race:'Dragonborn',level:4})).includes('Draconic Flight'));
});

test('tracked resources do not duplicate generic recovery reminders, but retain rest choices',()=>{
 const c=makeCharacter({class:'Fighter',subclass:'Battle Master',level:3});
 c.features=[feature('Second Wind'),feature('Superiority Dice',{reset:'short'}),feature('Weapon Mastery',{maxUses:0,reset:'manual'})];
 const reminders=restReminders(c);
 assert.ok(!reminders.some(r=>['Second Wind','Combat Superiority'].includes(r.title)));
 assert.equal(reminders.filter(r=>r.title==='Weapon Mastery').length,1);
 assert.equal(reminders.find(r=>r.title==='Weapon Mastery').featureId,c.features[2].id);
});

test('short rests retain partial recovery and Pact Magic without showing long-rest-only choices',()=>{
 const c=makeCharacter({class:'Warlock',pactMagic:true});c.slots[0]={max:2,used:2};
 c.features=[feature('Partial recovery',{shortRestRecovery:1}),feature('Blocked recovery',{reset:'short'})];
 const options={kind:'short',skipFeatureIds:[c.features[1].id]},rows=restRefreshes(c,options);
 shortRest(c,0,()=>1,options);
 for(const row of rows.filter(r=>r.featureId)){const f=c.features.find(f=>f.id===row.featureId);assert.equal(row.after,f.maxUses-f.used);}
 assert.equal(c.slots[0].used,0);
 assert.ok(!names(makeCharacter({class:'Druid',level:2}),'short').includes('Wild Shape'));
 assert.ok(names(makeCharacter({class:'Ranger',subclass:'Hunter',level:7}),'short').includes('Defensive Tactics'));
});

test('special cooldowns are flagged, and references retain source and timing distinctions',()=>{
 const c=makeCharacter({class:'Cleric',level:20});c.features=[feature('Divine Intervention'),feature('Ancient blessing',{description:'Recover after 1d4 Long Rests.'})];
 assert.ok(restRefreshes(c).filter(r=>r.featureId).every(r=>r.cooldown));
 assert.ok(restReminders(c).some(r=>/2d4 Long Rests/.test(r.detail)));
 assert.ok(restReminders(c).some(r=>r.title==='Ancient blessing'));
 assert.ok(REST_REFERENCES.length>500);
 assert.ok(REST_REFERENCES.every(r=>r.name&&r.level>=1&&r.level<=20&&r.wiki.startsWith('https://')));
 assert.ok(REST_REFERENCES.some(r=>r.legacy&&r.subclass==='Path of the Beast'));
});
