import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EQUIPMENT_ICONS,equipmentIconParts,equipmentIconURL,normalizeEquipmentName} from '../equipment-icons.js';
import {itemIconMarkup} from '../item-icons.js';
import {EQUIPMENT,itemFromEquipment} from '../catalog.js';
import {defaultCharacters} from '../default-characters.js';

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

test('unmapped, renamed, custom and unsafe names retain generic SVG icons',()=>{
  for(const name of ['Pistol','Musket','A very special sword','Longsword +1','<img onerror=bad>']) {
    const item={name,category:'Weapon'};
    assert.equal(equipmentIconURL(item),null);
    assert.doesNotMatch(itemIconMarkup(item),/<img/);
    assert.match(itemIconMarkup(item),/<svg/);
  }
  assert.match(itemIconMarkup({name:'Custom',category:'unknown'}),/<svg/);
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

test('named default weapons resolve explicitly while custom names still use the chosen fallback',()=>{
  for(const name of ['Blood spear','Magic spear','+1 Battleaxe','Handaxes','Javelins','Daggers']) {
    assert.ok(equipmentIconURL({name}),name);
    assert.match(itemIconMarkup({name,category:'Weapon'}),/equipment-icon/);
  }
  assert.equal(itemIconMarkup({name:'Beast: Bite',category:'Weapon'},'sword'),itemIconMarkup({name:'Beast: Bite',category:'Weapon'}));
});

test('mapped names are unique and all bundled thumbnails are small WebP files',async()=>{
  const names=new Set();
  const equipment=[...EQUIPMENT,...defaultCharacters().flatMap(c=>c.items)];
  for(const [key,entry] of Object.entries(EQUIPMENT_ICONS)) {
    const {names:aliases}=entry;
    for(const {id,color} of equipmentIconParts(entry)) {
      assert.match(id,/^[a-z0-9-]+$/);assert.ok(Number.isInteger(color));
    }
    assert.ok(equipment.some(p=>aliases.some(name=>normalizeEquipmentName(name)===normalizeEquipmentName(p.name))),`${key}: maps a preset or default inventory item`);
    for(const name of aliases){const normalized=normalizeEquipmentName(name);assert.ok(!names.has(normalized),name);names.add(normalized);}
    const bytes=await readFile(new URL(`../assets/equipment/${key}.webp`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.length<20000,`${key} should be small`);
  }
});
