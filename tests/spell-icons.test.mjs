import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {automaticSpellIcon,selectSpellIcon,spellIconMarkup,spellIconURL,spellEffectIcon,validSpellIconKey,SPELL_ICON_LIBRARY,spellIconPicker} from '../spell-icons.js';
import {SCHOOL_SPELL_ICONS} from '../spell-icon-mappings.js';
import {SPELL_CATALOG} from '../progression-data.js';
import {demoCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {splitCharacter,joinCharacter,fragments,makeOperation,applyFields,publicProjection,validPublicDetails} from '../cloud-model.js';
import {itemIconMarkup} from '../item-icons.js';
import {ITEM_ICON_DEFAULTS} from '../equipment-icons.js';

test('popular spells have deliberate, recognizable effect imagery',()=>{
  const choices={Fireball:'fireball','Magic Missile':'hypersonic-bolt',Shield:'magic-shield','Cure Wounds':'healing','Healing Word':'heart-beats','Misty Step':'teleport','Mage Hand':'magic-palm','Detect Magic':'third-eye','Lightning Bolt':'heavy-lightning',Counterspell:'lightning-dissipation','Eldritch Blast':'plasma-bolt','Sacred Flame':'candle-flame','Spiritual Weapon':'energy-sword','Speak with Animals':'wolf-howl',Invisibility:'invisible',Fly:'angel-wings',Polymorph:'transform','Animate Dead':'skeleton-inside',Bless:'beams-aura',Web:'spider-web',Thunderwave:'sonic-boom',Sleep:'sleepy','Hold Person':'imprisoned',Revivify:'heart-wings','Summon Dragon':'dragon-head','Summon Beast':'paw','Summon Undead':'ghost-ally','Summon Fey':'fairy'};
  for(const [name,key] of Object.entries(choices))assert.deepEqual(automaticSpellIcon({name}).key,key,name);
  assert.equal(new Set(Object.values(choices)).size,Object.keys(choices).length);
  assert.equal(automaticSpellIcon({name:'  MISTY—STEP  '}).key,'teleport');
  assert.equal(automaticSpellIcon({name:'Tasha’s Hideous Laughter'}).key,'delighted');
  assert.equal(automaticSpellIcon({name:'Fireball',damageType:'cold',school:'Illusion'}).source,'exact');
});

test('every catalog spell has exact artwork with substantial visual variety',()=>{
  const selections=SPELL_CATALOG.map(automaticSpellIcon);
  assert.ok(selections.every(entry=>entry.source==='exact'&&validSpellIconKey(entry.key)));
  assert.ok(new Set(selections.map(entry=>entry.key)).size>=200);
  assert.ok(SPELL_ICON_LIBRARY.length<300,'Only the selected subset is shipped');
});

test('structured effects, damage descriptors, and summoned creatures match deterministically',()=>{
  for(const type of ['fire','cold','lightning','thunder','acid','poison','necrotic','radiant','psychic','force']){
    for(const data of [{damageType:type},{damageTypes:[type]},{damage:{damage_type:{name:type}}},{effects:[{type:'damage',damageType:type}]}]){
      const result=automaticSpellIcon({name:'Homebrew',school:'Illusion',...data});
      assert.equal(result.source,'effect');assert.equal(result.tone,type);assert.ok(validSpellIconKey(result.key));
    }
  }
  assert.equal(automaticSpellIcon({damageTypes:['cold','fire']}).tone,'cold');
  for(const effect of ['healing','teleportation','summoning','illusion','transformation','protection','nature','resurrection','flight'])assert.equal(automaticSpellIcon({effects:[effect]}).source,'effect');
  assert.equal(automaticSpellIcon({healing:{formula:'2d8'}}).tone,'healing');
  assert.equal(automaticSpellIcon({summon:{creatureType:'Dragon'}}).key,'dragon-head');
  assert.equal(automaticSpellIcon({summonType:'undead'}).key,'ghost-ally');
  for(const name of ['Wildfire Ward','Ice Cream Dream','Healer’s Bane','Unfire','constructor','__proto__'])assert.equal(automaticSpellIcon({name,school:'Abjuration',notes:'Resistant to fire damage. Cannot heal or teleport.'}).source,'school');
  assert.equal(spellEffectIcon({summonType:'constructor',effect:'not healing'}),null);
});

test('eight distinct school defaults and unknown/homebrew spells always resolve safely',()=>{
  const keys=[];
  for(const [school,entry] of Object.entries(SCHOOL_SPELL_ICONS)){
    const selected=automaticSpellIcon({name:'Uncatalogued Spell',school:school.toUpperCase()});
    assert.equal(selected.source,'school');assert.equal(selected.key,entry.key);keys.push(selected.key);
  }
  assert.equal(new Set(keys).size,8);
  for(const school of [undefined,'Other','constructor','__proto__']){
    const selected=automaticSpellIcon({name:'Homebrew',school});assert.equal(selected.source,'unknown');assert.ok(validSpellIconKey(selected.key));
  }
  assert.ok(validSpellIconKey(automaticSpellIcon().key));
  assert.doesNotMatch(spellIconMarkup({}),/equipment|wand/);
});

test('manual keys persist across name/school changes; Automatic follows those changes',()=>{
  const spell={name:'Fireball',school:'Evocation'};
  assert.equal(selectSpellIcon(spell).key,'fireball');spell.name='Misty Step';assert.equal(selectSpellIcon(spell).key,'teleport');
  spell.spellIconKey='ghost';spell.name='Shield';spell.school='Abjuration';assert.equal(selectSpellIcon(spell).key,'ghost');assert.equal(selectSpellIcon(spell).source,'manual');
  spell.spellIconKey='';assert.equal(selectSpellIcon(spell).key,'magic-shield');
  spell.name='Homebrew';spell.school='Illusion';assert.equal(selectSpellIcon(spell).key,'drama-masks');
  for(const key of ['',null,{},'missing','constructor','__proto__','../../bad','\"><img src=x>']){
    assert.equal(selectSpellIcon({name:'Fireball',spellIconKey:key}).key,'fireball');assert.equal(spellIconURL(key),null);
  }
  assert.match(spellIconPicker({name:'<unsafe>',spellIconKey:'ghost'}),/name="spellIconKey" value="ghost" checked/);
});

const saved=character=>({version:SAVE_VERSION,characters:[character],activeId:character.id,settings:{sound:false}});
test('legacy saves and JSON backups retain optional stable keys and homebrew metadata',()=>{
  const character=demoCharacter(),legacy=JSON.stringify(saved(character));assert.deepEqual(parseBackup(legacy),JSON.parse(legacy));
  const spell=character.spells[0];spell.spellIconKey='ghost';spell.damageType='cold';spell.effects=['teleportation'];
  const restored=parseBackup(JSON.stringify(saved(character))).characters[0];assert.deepEqual(restored.spells,character.spells);
  spell.spellIconKey='future-icon';assert.equal(parseBackup(JSON.stringify(saved(character))).characters[0].spells[0].spellIconKey,'future-icon');
  assert.notEqual(selectSpellIcon(spell).source,'manual','Future/removed keys fall back without breaking imports');
  for(const key of ['../../bad',123,'x'.repeat(101)]){spell.spellIconKey=key;assert.throws(()=>parseBackup(JSON.stringify(saved(character))),/invalid spell icon/);}
});

test('Firebase content fragments, field operations, and party projections preserve manual art',()=>{
  const before=demoCharacter(),after=structuredClone(before);after.spells[0].spellIconKey='ghost';
  const {content,live}=splitCharacter(after),encoded=fragments(content).join('');
  assert.deepEqual(joinCharacter(JSON.parse(encoded),live),after);
  const operation=makeOperation(before,after),updated=applyFields(splitCharacter(before).content,operation.content);
  assert.equal(joinCharacter(updated,live).spells[0].spellIconKey,'ghost');
  const shared=publicProjection(after);assert.equal(shared.details.spells[0].spellIconKey,'ghost');assert.ok(validPublicDetails(shared.details));
  shared.details.spells[0].spellIconKey='../../bad';assert.equal(validPublicDetails(shared.details),false);
  assert.ok(validPublicDetails(publicProjection(before).details),'Legacy party details stay compatible');
  const homebrew=structuredClone(before);homebrew.spells[0].name='Winter Lance';homebrew.spells[0].damageType='cold';
  assert.equal(publicProjection(homebrew).details.spells[0].spellIconKey,'snowflake-2','Shared homebrew effects retain the same artwork');
  assert.equal(publicProjection(homebrew).details.spells[0].damageType,undefined,'Private metadata stays private');
});

test('bundled assets, attribution, offline cache and deployment paths are complete',async()=>{
  await import('../scripts/check-spell-icons.mjs');
  const [sw,build,html,app,css]=await Promise.all(['sw.js','scripts/build.mjs','index.html','app.js','spell-icons.css'].map(file=>readFile(new URL(`../${file}`,import.meta.url),'utf8')));
  assert.match(sw,/\.\.\.SPELL_ICON_FILES/);assert.match(sw,/spell-icon-mappings.js/);assert.match(sw,/spell-icon-manifest.js/);
  assert.match(build,/assets\/spell-icons/);assert.match(build,/spell-icons.css/);assert.match(html,/\.\/spell-icons.css/);
  assert.doesNotMatch(app,/itemIconMarkup\(s,'spark'\)/);
  for(const entry of SPELL_ICON_LIBRARY){
    const relative=spellIconURL(entry.key);assert.equal(new URL(relative,'https://example.github.io/questlog/').pathname,`/questlog/assets/spell-icons/${entry.key}.svg`);
  }
  assert.match(css,/data-theme="dark"/);assert.match(css,/radial-gradient/);assert.match(css,/spell-icon-fallback/);
});

test('physical equipment and actual magic wands retain the LEGO pipeline',()=>{
  assert.equal(ITEM_ICON_DEFAULTS.spark,'wand');
  assert.match(itemIconMarkup({name:'Wand of Magic Missiles',category:'Gear'},'spark'),/assets\/equipment\/wand.webp/);
  assert.match(itemIconMarkup({name:'Longsword',category:'Weapon'}),/assets\/equipment\/longsword.webp/);
  assert.doesNotMatch(spellIconMarkup({name:'Magic Missile'}),/assets\/equipment/);
});
