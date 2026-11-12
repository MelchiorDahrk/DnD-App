import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EQUIPMENT_ICONS,equipmentIconURL,normalizeEquipmentName} from '../equipment-icons.js';
import {itemIconMarkup} from '../item-icons.js';
import {EQUIPMENT,itemFromEquipment} from '../catalog.js';

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

test('mapped names are unique and all bundled thumbnails are small WebP files',async()=>{
  const names=new Set();
  for(const [key,{names:aliases,part,color}] of Object.entries(EQUIPMENT_ICONS)) {
    assert.match(part,/^[a-z0-9-]+$/);assert.ok(Number.isInteger(color));
    assert.ok(EQUIPMENT.some(p=>aliases.some(name=>normalizeEquipmentName(name)===normalizeEquipmentName(p.name))),`${key}: maps an actual equipment preset`);
    for(const name of aliases){const normalized=normalizeEquipmentName(name);assert.ok(!names.has(normalized),name);names.add(normalized);}
    const bytes=await readFile(new URL(`../assets/equipment/${key}.webp`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.length<20000,`${key} should be small`);
  }
});
