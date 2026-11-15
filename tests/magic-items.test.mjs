import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MAGIC_ITEMS,MAGIC_ITEM_AUDIT} from '../magic-item-data.js';
import {EQUIPMENT,equipmentFields,equipmentDescription,itemFromEquipment} from '../catalog.js';
import {PAGES_2024} from '../reference-pages.js';
import {LDRAW_ICONS,equipmentIconURL} from '../equipment-icons.js';
import {filterEquipment,catalogPicker,catalogBrowser} from '../catalog-ui.js';
import {makeCharacter,SAVE_VERSION,parseBackup} from '../model.js';

test('magic catalog covers every indexed item page exactly once, retaining variant stats',()=>{
  const category=/^\/magic-item:(?:all|armor|consumable|crafting|potion|ring|rod|scroll|sources|staff|type|wand|weapon|wondrous-item)$/;
  const expected=PAGES_2024.filter(path=>path.startsWith('/magic-item:')&&!category.test(path)).sort();
  const parents=MAGIC_ITEMS.filter(item=>!item.variantOf);
  assert.ok(expected.length);
  assert.equal(MAGIC_ITEM_AUDIT.uniqueItems,expected.length);
  assert.deepEqual(parents.map(item=>new URL(item.wiki).pathname).sort(),expected);
  assert.deepEqual(MAGIC_ITEM_AUDIT.sourcePaths,expected);
  assert.equal(new Set(EQUIPMENT.map(item=>item.id)).size,EQUIPMENT.length);
  assert.equal(EQUIPMENT.filter(item=>item.name==='Potion of Healing').length,1);
  assert.ok(MAGIC_ITEMS.find(item=>item.name==='Belt of Giant Strength').tables.flat(2).includes('29'));
  assert.doesNotMatch(MAGIC_ITEMS.find(item=>item.name==='Belt of Giant Strength').details,/BeltStr\.Rarity/);
  assert.equal(MAGIC_ITEMS.find(item=>item.name==='Enduring Spellbook').iconKey,'book');
  assert.match(equipmentDescription(MAGIC_ITEMS.find(item=>item.name==='Potion of Healing')),/10d4\s*\+\s*20/);
  assert.equal(MAGIC_ITEMS.find(item=>item.name==='Potion of Supreme Healing').typeDetails,'Potion, Very Rare');
});

test('magic presets retain stats, rarity, attunement, source, pricing and actual LEGO assets',async()=>{
  for(const item of MAGIC_ITEMS){
    assert.ok(item.details.length>0,item.name);
    assert.ok(item.rarity&&item.attunement&&item.source&&item.cost&&item.typeDetails,item.name);
    assert.ok(item.rarities.every(r=>['Common','Uncommon','Rare','Very Rare','Legendary','Artifact'].includes(r)),item.name);
    assert.ok(LDRAW_ICONS[item.iconKey],item.name);
    assert.ok((await readFile(new URL(`../assets/equipment/${item.iconKey}.webp`,import.meta.url))).length>0,item.name);
    const fields=equipmentFields(item);
    assert.equal(fields.iconKey,item.iconKey);
    assert.ok(equipmentIconURL(itemFromEquipment(item)),item.name);
    for(const value of [item.source,item.rarity,item.cost,item.attunement])assert.ok(fields.description.includes(value),item.name);
    assert.ok(fields.description.length<=20000,item.name);
  }
  const ring=MAGIC_ITEMS.find(item=>item.name==='Ring of Protection');
  assert.equal(ring.iconKey,'magicring');assert.match(ring.attunement,/Requires Attunement/);
  assert.equal(MAGIC_ITEMS.find(item=>item.name==='Cloak of Protection').iconKey,'cloak');
  assert.equal(MAGIC_ITEMS.find(item=>item.name==='Winged Boots').iconKey,'wingedboots');
  const shield=MAGIC_ITEMS.find(item=>item.name==='Sentinel Shield');
  assert.equal(shield.weight,6);assert.match(shield.details,/Base equipment: Shield/);
  assert.match(MAGIC_ITEMS.find(item=>item.name==='Staff of Power').details,/20 charges/);
  assert.equal(MAGIC_ITEMS.find(item=>item.name==='Potion of Flying').actionType,'bonus');
  assert.equal(MAGIC_ITEMS.find(item=>item.name==='Oil of Sharpness').actionType,undefined,'oil keeps its specified application time');
});

test('search combines item type, rarity, attunement, source, effects and tables',()=>{
  const options={query:'cloak protection',group:'Magic · Wondrous items',rarity:'Uncommon',attunement:'Required'};
  assert.deepEqual(filterEquipment(EQUIPMENT,options).map(i=>i.name),['Cloak of Protection']);
  assert.equal(filterEquipment(EQUIPMENT,{...options,attunement:'Not required'}).length,0);
  assert.ok(filterEquipment(MAGIC_ITEMS,{query:'giant 29'}).some(i=>i.name==='Belt of Giant Strength'));
  assert.ok(filterEquipment(MAGIC_ITEMS,{query:'wand war mage',rarity:'Rare'}).some(i=>i.name==='Wand of the War Mage, +2'));
  assert.match(catalogPicker('item'),/data-catalog-rarity/);
  assert.match(catalogBrowser(),/Magic items/);
});

test('complete magic catalog round-trips in existing version 2 backups with independent item IDs',()=>{
  const c=makeCharacter();c.items=MAGIC_ITEMS.map(itemFromEquipment);
  const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
  const serialized=JSON.stringify(state);
  assert.ok(Buffer.byteLength(serialized)<2000000);
  assert.deepEqual(parseBackup(serialized),state);
  const parent=MAGIC_ITEMS.find(i=>i.name==='Bag of Holding');
  assert.notEqual(itemFromEquipment(parent).id,itemFromEquipment(parent).id);
  const cloak=MAGIC_ITEMS.find(i=>i.name==='Cloak of Protection');
  assert.equal(cloak.weight,3);
  assert.match(equipmentDescription(cloak),/Estimated cloak; adjust to actual item/);
});
