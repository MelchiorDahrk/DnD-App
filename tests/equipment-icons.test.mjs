import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LDRAW_ICONS,EXTRA_ITEM_ICONS,ITEM_ICON_LIBRARY,ITEM_ICON_DEFAULTS,equipmentIconParts,equipmentIconURL,normalizeEquipmentName} from '../equipment-icons.js';
import {itemIconMarkup,attackIconMarkup} from '../item-icons.js';
import {EQUIPMENT,WEAPONS,itemFromEquipment,attackFromWeapon} from '../catalog.js';
import {defaultCharacters} from '../default-characters.js';
import {parseBackup} from '../model.js';
import {defaultPartyState} from './helpers/default-party.mjs';

test('chosen library icons override automatic names and safely fall back for unknown keys',()=>{
  const item={name:'Longsword',category:'Weapon',iconKey:'katana'};
  assert.equal(equipmentIconURL(item),'./assets/equipment/katana.webp');
  assert.match(itemIconMarkup(item),/\/katana.webp/);
  assert.match(attackIconMarkup({...item,weaponId:'rapier'}),/\/katana.webp/);
  for(const iconKey of ['',null,{},'missing','__proto__','constructor','../../bad','"><img src=x>']) {
    assert.equal(equipmentIconURL({...item,iconKey}),'./assets/equipment/longsword.webp');
    assert.match(itemIconMarkup({name:'Custom',category:'Gear',iconKey}),/\/backpack.webp/);
  }
});

test('item icon selections survive backups while old items keep automatic artwork',()=>{
  const state=defaultPartyState();
  state.characters[0].items[0].iconKey='katana';
  assert.equal(parseBackup(JSON.stringify(state)).characters[0].items[0].iconKey,'katana');
  delete state.characters[0].items[0].iconKey;
  assert.equal(parseBackup(JSON.stringify(state)).characters[0].items[0].iconKey,undefined);
  state.characters[0].items[0].iconKey='future-icon';
  assert.ok(parseBackup(JSON.stringify(state)),'future keys use automatic artwork until available');
  state.characters[0].items[0].iconKey='../../unsafe';
  assert.throws(()=>parseBackup(JSON.stringify(state)),/invalid item icon/);
});

test('library includes unused weapons and supplies with searchable labels, groups and part IDs',()=>{
  assert.ok(Object.keys(EXTRA_ITEM_ICONS).length>=100);
  assert.equal(ITEM_ICON_LIBRARY.length,Object.keys(LDRAW_ICONS).length);
  for(const key of ['katana','dwarvenaxe','chakram','crown','apple','ratchet']) {
    const entry=ITEM_ICON_LIBRARY.find(entry=>entry.key===key);
    assert.ok(entry?.label&&entry.group);
    assert.ok(entry.keywords.includes(EXTRA_ITEM_ICONS[key].part));
    assert.equal(equipmentIconURL({name:'Homebrew',iconKey:key}),`./assets/equipment/${key}.webp`);
  }
});

test('equipment mapping uses exact normalized names, independent of generated inventory IDs',()=>{
  const preset=EQUIPMENT.find(p=>p.name==='Longsword');
  const item=itemFromEquipment(preset);
  assert.notEqual(item.id,preset.id);
  assert.equal(equipmentIconURL(item),'./assets/equipment/longsword.webp');
  assert.equal(equipmentIconURL({...item,id:'anything'}),equipmentIconURL(preset));
  assert.equal(equipmentIconURL({name:'  LONGSWORD  '}),equipmentIconURL(item));
  assert.equal(normalizeEquipmentName('Miner’s Pick'),normalizeEquipmentName("Miner's Pick"));
  assert.match(itemIconMarkup(item),/loading="lazy"/);
});

test('custom and unsafe names receive bundled category artwork with SVG fallbacks',()=>{
  for(const name of ['A very special sword','Longsword +1','<img onerror=bad>']) {
    const item={name,category:'Weapon'};
    assert.equal(equipmentIconURL(item),null);
    assert.match(itemIconMarkup(item),/<img src="\.\/assets\/equipment\/longsword.webp"/);
    assert.match(itemIconMarkup(item),/<svg/);
    assert.doesNotMatch(itemIconMarkup(item),/onerror/);
  }
  for(const category of ['Weapon','Armor','Consumable','Treasure','Gear','unknown']) {
    const markup=itemIconMarkup({name:'Custom',category});
    assert.match(markup,/<svg/);
    assert.match(markup,/<img/);
  }
  for(const key of Object.values(ITEM_ICON_DEFAULTS))assert.ok(LDRAW_ICONS[key],key);
});

test('every inventory item on all three default characters has an explicit LEGO icon',()=>{
  const characters=defaultCharacters();
  assert.equal(characters.reduce((count,c)=>count+c.items.length,0),63);
  for(const c of characters)for(const item of c.items) {
    assert.ok(equipmentIconURL(item),`${c.name}: ${item.name}`);
    assert.match(itemIconMarkup(item),/<img src="\.\/assets\/equipment\//);
    assert.equal(equipmentIconURL({...item,id:'independent-save-id'}),equipmentIconURL(item));
  }
});

test('every catalog item and default attack has explicit artwork',()=>{
  for(const item of [...EQUIPMENT,...defaultCharacters().flatMap(c=>c.attacks)]) {
    assert.ok(equipmentIconURL(item),item.name);
    assert.match(itemIconMarkup(item),/<img src="\.\/assets\/equipment\//);
  }
  for(const weapon of WEAPONS)assert.match(attackIconMarkup(attackFromWeapon(weapon,defaultCharacters()[0])),/<img/);
  assert.equal(new Set(['Beast: Bite','Beast: Claws','Beast: Tail'].map(name=>equipmentIconURL({name}))).size,3);
});

test('named and renamed attacks share the base weapon artwork across all views',()=>{
  for(const name of ['Blood spear','Magic spear','+1 Battleaxe','Handaxes','Javelins','Daggers']) {
    assert.ok(equipmentIconURL({name}),name);
    assert.match(itemIconMarkup({name,category:'Weapon'}),/equipment-icon/);
  }
  assert.match(attackIconMarkup({name:'Beast: Bite'}),/\/bite.webp/);
  assert.match(attackIconMarkup({name:'Beast Claws'}),/\/claws.webp/);
  assert.match(attackIconMarkup({name:'Beast: Tail defense'}),/\/tail.webp/);
  assert.match(attackIconMarkup({name:'Unarmed Strike',weaponId:''}),/\/unarmed.webp/);
  assert.match(attackIconMarkup({name:'Moonblade',weaponId:'rapier'}),/\/rapier.webp/);
  assert.match(attackIconMarkup({name:'Longsword +1'}),/\/longsword.webp/);
  assert.match(attackIconMarkup({name:'Custom action',weaponId:''}),/\/longsword.webp/);
  assert.match(attackIconMarkup({name:'Custom ranged action',weaponId:''},'bow'),/\/shortbow.webp/);
  assert.match(itemIconMarkup({name:'Homebrew feature'},'star'),/\/action.webp/);
  assert.match(itemIconMarkup({name:'Homebrew spell'},'spark'),/\/wand.webp/);
});

test('mapped names are unique and all bundled thumbnails are small WebP files',async()=>{
  const names=new Set();
  for(const [key,entry] of Object.entries(LDRAW_ICONS)) {
    const {names:aliases=[]}=entry;
    for(const {id,color} of equipmentIconParts(entry)) {
      assert.match(id,/^[a-z0-9-]+$/);assert.ok(Number.isInteger(color));
    }
    for(const name of aliases){const normalized=normalizeEquipmentName(name);assert.ok(!names.has(normalized),name);names.add(normalized);assert.equal(equipmentIconURL({name}),`./assets/equipment/${key}.webp`);}
    const bytes=await readFile(new URL(`../assets/equipment/${key}.webp`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.length<20000,`${key} should be small`);
  }
});
