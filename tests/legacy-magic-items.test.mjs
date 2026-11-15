import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LEGACY_MAGIC_ITEMS,LEGACY_MAGIC_ITEM_AUDIT} from '../legacy-magic-item-data.js';
import {MAGIC_ITEMS as CURRENT} from '../magic-item-data.js';
import {MAGIC_ITEMS,EQUIPMENT,equipmentFields,equipmentDescription,itemFromEquipment} from '../catalog.js';
import {LDRAW_ICONS,equipmentIconURL} from '../equipment-icons.js';
import {filterEquipment,catalogPicker} from '../catalog-ui.js';
import {actionTiming} from '../sheet-actions.js';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
const sourceIndex=JSON.parse(await readFile(new URL('../scripts/data/legacy-magic-item-index.json',import.meta.url),'utf8'));
const currentById=new Map(CURRENT.map(item=>[item.id,item]));
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/(\d)or(?=\d)/g,'$1');

test('every 2014 source item is represented once by an earlier-only item or its 2024 revision',()=>{
  const legacyPaths=LEGACY_MAGIC_ITEMS.map(i=>new URL(i.wiki).pathname);
  const sharedPaths=LEGACY_MAGIC_ITEM_AUDIT.sharedItems.map(i=>i.path);
  const expected=sourceIndex.map(i=>i.path).sort();
  assert.ok(sourceIndex.length&&LEGACY_MAGIC_ITEMS.length&&sharedPaths.length);
  assert.deepEqual([...legacyPaths,...sharedPaths].sort(),expected);
  assert.equal(new Set([...legacyPaths,...sharedPaths]).size,sourceIndex.length);
  assert.deepEqual(LEGACY_MAGIC_ITEM_AUDIT.sourcePaths,expected);
  assert.deepEqual(new Set(MAGIC_ITEMS),new Set([...CURRENT,...LEGACY_MAGIC_ITEMS]));
  assert.ok(MAGIC_ITEMS.every(item=>EQUIPMENT.includes(item)));
});

test('2024 stats and descriptions always win shared names and reviewed renamed equivalents',()=>{
  for(const reference of LEGACY_MAGIC_ITEM_AUDIT.sharedItems){
    const current=currentById.get(reference.currentId);assert.ok(current,reference.name);
    assert.equal(current.edition,'2024');assert.ok(MAGIC_ITEMS.includes(current));
    assert.equal(LEGACY_MAGIC_ITEMS.some(i=>new URL(i.wiki).pathname===reference.path),false,reference.name);
  }
  const names=new Set(CURRENT.map(i=>norm(i.name)));
  assert.equal(LEGACY_MAGIC_ITEMS.some(i=>names.has(norm(i.name))),false);
  assert.equal(EQUIPMENT.filter(i=>i.name==='Bag of Holding').length,1);
  const bag=EQUIPMENT.find(i=>i.name==='Bag of Holding');assert.equal(bag.weight,5);assert.equal(bag.edition,'2024');
  assert.equal(EQUIPMENT.filter(i=>i.name==='Potion of Healing').length,1);
  assert.equal(actionTiming(equipmentFields(EQUIPMENT.find(i=>i.name==='Potion of Healing')),'item'),'bonus');
  for(const [legacy,current] of [['Wraps Of Unarmed Prowess','Wraps of Unarmed Power'],['Scroll of Tarrasque Summoning','Scroll of Titan Summoning'],['Arrow of Slaying','Ammunition of Slaying']]){
    const ref=LEGACY_MAGIC_ITEM_AUDIT.sharedItems.find(r=>r.name.toLowerCase()===legacy.toLowerCase());assert.ok(ref,legacy);assert.equal(currentById.get(ref.currentId).name,current);
  }
  assert.ok(EQUIPMENT.some(i=>i.name==='Feather Token'&&i.edition==='2014'),'distinct Eberron token remains separate');
  assert.ok(EQUIPMENT.some(i=>i.name==="Quaal's Feather Token"&&i.edition==='2024'));
  const feather=LEGACY_MAGIC_ITEMS.find(i=>i.name==='Feather Token');
  assert.match(feather.details,/20 feet/);assert.match(feather.details,/60 feet per round/);
  assert.doesNotMatch(feather.details,/anchor|boat|fan|tree|rare/i);
});

test('earlier-only items retain valid stats, source, rarity, correct base gear and rendered LDraw artwork',async()=>{
  for(const item of LEGACY_MAGIC_ITEMS){
    assert.match(item.id,/^magic-2014-[a-z0-9-]+$/);assert.equal(item.edition,'2014');
    assert.ok(item.details&&item.source&&item.attunement&&item.typeDetails,item.name);
    assert.ok(item.rarities.every(r=>['Common','Uncommon','Rare','Very Rare','Legendary','Artifact','Unique','Unknown'].includes(r)),item.name);
    assert.ok(LDRAW_ICONS[item.iconKey],item.name);
    assert.ok((await readFile(new URL(`../assets/equipment/${item.iconKey}.webp`,import.meta.url))).length>0);
    assert.ok(equipmentDescription(item).includes('Rules: 2014.'));
    assert.ok(equipmentDescription(item).length<=20000,item.name);
    assert.ok(equipmentIconURL(itemFromEquipment(item)),item.name);
  }
  const spear=LEGACY_MAGIC_ITEMS.find(i=>i.name==='Blood Spear');assert.match(spear.details,/1d6 piercing/);assert.match(spear.details,/Mastery: Sap/);assert.match(spear.details,/Base equipment \(2024\)/);
  assert.equal(actionTiming(equipmentFields(LEGACY_MAGIC_ITEMS.find(i=>i.name==='Potion of Watchful Rest')),'item'),'bonus');
  assert.equal(LEGACY_MAGIC_ITEMS.find(i=>i.name==='Staff of Defense').weight,3);
  assert.equal(LEGACY_MAGIC_ITEMS.find(i=>i.name==="Gurt's Greataxe").weight,325);
  assert.equal(LEGACY_MAGIC_ITEMS.find(i=>i.name==='Alchemy Jug (Blue)').weight,12);
});

test('combined catalog filters by actual rules edition and fits existing backups without a migration',()=>{
  assert.deepEqual(filterEquipment(MAGIC_ITEMS,{edition:'2014'}),MAGIC_ITEMS.filter(item=>item.edition==='2014'));
  assert.deepEqual(filterEquipment(MAGIC_ITEMS,{edition:'2024'}),MAGIC_ITEMS.filter(item=>item.edition==='2024'));
  assert.ok(filterEquipment(MAGIC_ITEMS,{edition:'2014',query:'blood spear'}).length===1);
  assert.equal(filterEquipment(MAGIC_ITEMS,{edition:'2014',query:'bag of holding'}).length,0);
  assert.match(catalogPicker('item'),/data-catalog-edition/);
  const c=makeCharacter();c.items=EQUIPMENT.map(itemFromEquipment);
  const state={version:SAVE_VERSION,characters:[c],activeId:c.id,settings:{sound:false}},serialized=JSON.stringify(state);
  assert.ok(Buffer.byteLength(serialized)<2000000);assert.deepEqual(parseBackup(serialized),state);
});
