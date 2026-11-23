import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MAGIC_ITEMS,MAGIC_ITEM_AUDIT} from '../magic-item-data.js';
import {EQUIPMENT,MAGIC_ITEMS as catalogMagicItems,MAGIC_ITEM_VERSIONS,MAGIC_VARIANT_EQUIPMENT,findEquipment,equipmentFields,equipmentDescription,itemFromEquipment} from '../catalog.js';
import {variantForRoll} from '../magic-item-variants.js';
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

test('missing prices use stated rarity, item consumption and the default base equipment',()=>{
  assert.ok(catalogMagicItems.every(item=>!/^Unlisted$|^Unlisted \(|^Varies$|^B\s*\+/i.test(item.cost)));
  assert.equal(findEquipment('magic-2014-blood-spear').cost,'401 GP');
  assert.equal(findEquipment('magic-2014-feather-token').cost,'50 GP');
  assert.equal(findEquipment('magic-2014-all-purpose-tool').cost,'400–40,000 GP');
  assert.match(findEquipment('magic-2014-blood-spear').priceNote,/rarity guideline.*Spear/);
  assert.equal(findEquipment('magic-2014-ring-of-winter').cost,'Priceless');
  assert.equal(findEquipment('magic-2014-tearulai').cost,'DM sets price');
  assert.equal(findEquipment('magic-armor-of-invulnerability').cost,'201,500 GP');
  assert.equal(findEquipment('magic-repeating-shot').cost,'450 GP');
  assert.equal(findEquipment('magic-goading-ammunition').cost,'200 GP 5 CP');
  assert.equal(findEquipment('magic-spell-scroll-level-7').cost,'25,000 GP');
  assert.equal(findEquipment('magic-bag-of-holding').cost,'400 GP');
});

test('version rolls cover each die face once and keep acquired versions distinct through a backup',()=>{
  const ids=[...EQUIPMENT,...MAGIC_VARIANT_EQUIPMENT].map(item=>item.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const family of MAGIC_ITEM_VERSIONS.values()){
    for(let total=1;total<=family.sides;total++){
      assert.equal(family.choices.filter(choice=>total>=choice.min&&total<=choice.max).length,1);
    }
  }
  assert.equal(MAGIC_ITEM_VERSIONS.has('magic-wand-of-wonder'),false);
  assert.equal(MAGIC_ITEM_VERSIONS.get('magic-bag-of-tricks').sides,undefined);
  const tokens=MAGIC_ITEM_VERSIONS.get('magic-quaal-s-feather-token');
  assert.deepEqual([1,20,21,35,36,50,51,65,66,90,91,100].map(n=>variantForRoll(tokens,n).label),
    ['Anchor','Anchor','Bird','Bird','Fan','Fan','Swan Boat','Swan Boat','Tree','Tree','Whip','Whip']);
  const anchor=variantForRoll(tokens,1).entry,whip=variantForRoll(tokens,100).entry;
  assert.equal(anchor.cost,'200 GP');assert.equal(whip.cost,'2,000 GP');
  assert.equal(whip.category,'Consumable');
  const c=makeCharacter();c.items=[anchor,whip].map(itemFromEquipment);
  const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}};
  const items=parseBackup(JSON.stringify(state)).characters[0].items;
  assert.deepEqual(items,c.items);assert.equal(findEquipment(items[1].catalogId),whip);
  assert.match(items[1].description,/1d6 \+ 5 Force damage/);
  assert.doesNotMatch(items[1].description,/Swan Boat/);
});
