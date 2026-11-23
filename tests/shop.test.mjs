import test from 'node:test';
import assert from 'node:assert/strict';
import {findEquipment} from '../catalog.js';
import {makeCharacter} from '../model.js';
import {itemUses} from '../inventory-rules.js';
import {contentSourceIds} from '../content-sources.js';
import {
  STORE_TYPES,defaultMerchandise,newShop,merchandiseEntry,merchandiseLine,prepareShop,
  parsePrice,randomMerchandise,quoteSale,applyShopOrder,walletTotal
} from '../shop-model.js';
import {designatedDM,effectiveDM} from '../party-model.js';

const shop=(type='general')=>({...newShop(type),name:'The Brass Lantern',open:true});
const buy=(shop,character,itemId,quantity)=>applyShopOrder(shop,character,{kind:'buy',itemId,quantity,expectedUnitCp:shop.items[itemId].priceCp});

test('legacy, assigned, and unavailable DM characters resolve to the correct account',()=>{
  const character={id:'bob_guard',ownerId:'bob',characterId:'guard'};
  const party={ownerId:'alice',members:[{uid:'alice'},{uid:'bob'}],characters:[character]};
  assert.equal(effectiveDM(party),'alice');
  party.dm={sharedId:character.id,ownerId:'bob',characterId:'guard'};
  assert.equal(effectiveDM(party),'bob');
  assert.equal(designatedDM(party),character);
  assert.equal(effectiveDM({...party,characters:[]}),'alice');
  assert.equal(effectiveDM({...party,members:[{uid:'alice'}]}),'alice');
  assert.equal(effectiveDM({...party,dm:{...party.dm,characterId:'another'}}),'alice');
  assert.equal(party.ownerId,'alice');
});

test('all store types select curated, thematic catalog references',()=>{
  const expected={
    general:'torch',blacksmith:'longsword',armorer:'plate-armor',alchemist:'antitoxin',
    arcane:'component-pouch',scribe:'ink',jeweler:'gold-1-lb',stables:'horse-riding',outfitter:'tent',magic:'magic-bag-of-holding'
  };
  for(const [type,id] of Object.entries(expected)){
    const items=defaultMerchandise(type);
    assert.ok(items[id],type+' should contain '+id);
    assert.ok(Object.keys(items).length<=STORE_TYPES[type].limit);
    for(const line of Object.values(items)){
      assert.equal(merchandiseEntry(line),findEquipment(line.catalogId));
      if(!merchandiseEntry(line).magic)assert.equal(line.stock,null);
    }
  }
  assert.equal(defaultMerchandise('blacksmith').longbow,undefined);
  assert.equal(defaultMerchandise('general')['plate-armor'],undefined);
  assert.equal(defaultMerchandise('scribe')['magic-staff-of-healing'],undefined);
});

test('random magic merchandise honors rarity, group, sources, and skip rules',()=>{
  const entries=randomMerchandise({type:'Rings',rarity:'Rare',count:15},{},undefined,()=>0);
  assert.ok(entries.length>1);
  assert.equal(new Set(entries.map(entry=>entry.name.toLowerCase())).size,entries.length);
  assert.ok(entries.every(entry=>entry.itemType==='Ring'&&entry.rarities.includes('Rare')&&!entry.rarities.includes('Artifact')));
  const blocked=Object.fromEntries(entries.map(entry=>[entry.id,merchandiseLine(entry)]));
  assert.ok(randomMerchandise({type:'Rings',rarity:'Rare',count:15},blocked).every(entry=>!blocked[entry.id]&&entries.every(previous=>previous.name!==entry.name)));
  const hiddenSources=[...new Set(entries.flatMap(entry=>contentSourceIds(entry,'item')))];
  const filtered=randomMerchandise({type:'Rings',rarity:'Rare',count:100},{},{hiddenSources});
  assert.ok(filtered.every(entry=>contentSourceIds(entry,'item').some(source=>!hiddenSources.includes(source))));
  assert.ok(filtered.every(entry=>!entries.some(hidden=>hidden.id===entry.id)));
});

test('random magic uses the store specialty even when the item filter is Any',()=>{
  const stock=(storeType,type='Any')=>randomMerchandise({storeType,type,rarity:'Rare',count:100},{},{},()=>0);
  for(const [storeType,types] of Object.entries({armorer:['Armor'],alchemist:['Potion'],blacksmith:['Armor','Weapon'],arcane:['Wand','Staff','Rod','Scroll']})){
    const entries=stock(storeType);
    assert.ok(entries.length>0,storeType);
    assert.ok(entries.every(entry=>types.includes(entry.itemType)),storeType);
  }
  assert.ok(stock('jeweler','Rings').length>0);
  assert.deepEqual(stock('outfitter','Rings'),[]);
  assert.deepEqual(stock('armorer','Potions'),[]);
  assert.ok(stock('magic','Rings').every(entry=>!/World of Warcraft/i.test(entry.source)));
});

test('saving a new addition checks the final store type and preserves previously stocked lines',()=>{
  const draft=shop('armorer'),potion=findEquipment('potion-of-healing');
  draft.items[potion.id]=merchandiseLine(potion);
  assert.throws(()=>prepareShop(draft),/Potion of Healing is unavailable/);
  assert.ok(prepareShop(draft,{[potion.id]:draft.items[potion.id]}).items[potion.id]);
});

test('fixed prices, overrides, and stock constraints survive saving',()=>{
  for(const value of ['B+400 GP','500–1000 GP','Unlisted (2014 wiki)','Varies','0 GP','0.5 GP','10,00 GP','10GP and 1 SP'])assert.equal(parsePrice(value),null,value);
  assert.deepEqual(['5 CP','10 SP','1 EP','2 GP','2,000 PP'].map(parsePrice),[5,100,50,200,2000000]);
  const draft=shop('arcane');draft.multiplier=125;
  draft.items['magic-spell-scroll'].stock=3;
  delete draft.items.spellbook;
  const before=prepareShop(draft);
  assert.equal(before.items['magic-spell-scroll'].priceCp,null);
  const buyer=makeCharacter({gold:100});
  assert.throws(()=>buy(before,buyer,'magic-spell-scroll',1),/waiting for a price/);
  draft.items['magic-spell-scroll'].priceOverride=1234;
  const saved=prepareShop(draft);
  assert.equal(saved.items['magic-spell-scroll'].priceCp,1234);
  assert.equal(saved.items['magic-spell-scroll'].stock,3);
  assert.equal(saved.items['component-pouch'].priceCp,3125);
  assert.equal(saved.items.spellbook,undefined);
});

test('orders use all denominations, make change, and preserve bundle and weapon behavior',()=>{
  const character=makeCharacter({gold:1,electrum:1,silver:3,copper:20,platinum:1});
  const store=prepareShop(shop('outfitter'));
  const funds=walletTotal(character),arrows=buy(store,character,'arrows',2);
  assert.equal(arrows.remaining,null);
  assert.equal(character.items[0].qty,2);
  assert.deepEqual(itemUses(character.items[0]),{maxUses:20,usesLeft:20,consumeOnEmpty:true});
  assert.equal(walletTotal(character),funds-200);
  assert.equal(character.platinum,1);
  buy(store,character,'arrows',1);
  assert.equal(character.items.length,1);
  assert.equal(character.items[0].qty,3);
  assert.equal(character.platinum,0);
  assert.equal(walletTotal(character),funds-300);
  const smith=prepareShop(shop('blacksmith'));
  buy(smith,character,'dagger',2);
  buy(smith,character,'dagger',1);
  const [dagger]=character.items.filter(i=>i.catalogId==='dagger');
  assert.equal(dagger.qty,3);
  assert.equal(character.attacks.filter(a=>a.itemId===dagger.id).length,1);
  const before=structuredClone(character);
  assert.throws(()=>buy(smith,character,'longsword',1000),/enough coins/);
  assert.deepEqual(character,before);
});

test('selling follows store policy, restrictions, resale overrides, and linked actions',()=>{
  const character=makeCharacter({gold:100}),smith=prepareShop(shop('blacksmith'));
  buy(smith,character,'dagger',1);
  const dagger=character.items.find(i=>i.catalogId==='dagger'),wallet=walletTotal(character);
  dagger.equipped=true;
  assert.match(quoteSale(smith,character,dagger).error,/Unequip/);
  dagger.equipped=false;
  dagger.attuned=true;
  assert.match(quoteSale(smith,character,dagger).error,/unattune/);
  dagger.attuned=false;
  const general=prepareShop(shop());
  assert.match(quoteSale(general,character,dagger).error,/does not buy/);
  assert.deepEqual(quoteSale({...general,acceptAll:true},character,dagger),{unitCp:100});
  assert.deepEqual(quoteSale({...general,acceptAll:true},character,{...dagger,catalogId:'gold-bracelet'}),{unitCp:2500});
  smith.items.dagger.sellOverride=125;
  assert.deepEqual(quoteSale(smith,character,{...dagger,catalogId:undefined}),{unitCp:125});
  applyShopOrder(smith,character,{kind:'sell',itemId:dagger.id,quantity:1,expectedUnitCp:125});
  assert.equal(walletTotal(character),wallet+125);
  assert.equal(character.items.some(i=>i.id===dagger.id),false);
  assert.equal(character.attacks.some(a=>a.itemId===dagger.id),false);
});
