// 2024 equipment / SRD 5.2.1 (CC BY 4.0). Quantities are catalog units.
// https://www.dndbeyond.com/sources/dnd/br-2024/equipment
export const equipmentName = name => String(name||'').trim().toLowerCase().replace(/[’']/g,'').replace(/\s+/g,' ');
export const PACK_CONTENTS = {
  'burglars pack': [['Backpack',1],['Ball Bearings',1],['Bell',1],['Candle',10],['Crowbar',1],['Lantern, Hooded',1],['Oil',7],['Rations',5],['Rope',1],['Tinderbox',1],['Waterskin',1]],
  'diplomats pack': [['Chest',1],['Clothes, Fine',1],['Ink',1],['Ink Pen',5],['Lamp',1],['Case, Map or Scroll',2],['Oil',4],['Paper',5],['Parchment',5],['Perfume',1],['Tinderbox',1]],
  'dungeoneers pack': [['Backpack',1],['Caltrops',1],['Crowbar',1],['Oil',2],['Rations',10],['Rope',1],['Tinderbox',1],['Torch',10],['Waterskin',1]],
  'entertainers pack': [['Backpack',1],['Bedroll',1],['Bell',1],['Lantern, Bullseye',1],['Costume',3],['Mirror',1],['Oil',8],['Rations',9],['Tinderbox',1],['Waterskin',1]],
  'explorers pack': [['Backpack',1],['Bedroll',1],['Oil',2],['Rations',10],['Rope',1],['Tinderbox',1],['Torch',10],['Waterskin',1]],
  'priests pack': [['Backpack',1],['Blanket',1],['Holy Water',1],['Lamp',1],['Rations',7],['Robe',1],['Tinderbox',1]],
  'scholars pack': [['Backpack',1],['Book',1],['Ink',1],['Ink Pen',1],['Lamp',1],['Oil',10],['Parchment',10],['Tinderbox',1]]
};

export function defaultItemUses(item) {
  if(equipmentName(item.name)==='healers kit')return {maxUses:10,consumeOnEmpty:true};
  // Older arrows tracked individually must not become bundles of twenty.
  const bundle=/\b(\d+) pieces per bundle\b/i.exec(item.details||item.description||'');
  if(bundle)return {maxUses:Number(bundle[1]),consumeOnEmpty:true};
  return {maxUses:0,consumeOnEmpty:false};
}

export function itemUses(item) {
  const defaults=defaultItemUses(item),maxUses=item.maxUses??defaults.maxUses;
  return {maxUses,usesLeft:item.qty===0?0:(item.usesLeft??maxUses),consumeOnEmpty:item.consumeOnEmpty??defaults.consumeOnEmpty};
}

export function removeEmptyItems(character) {
  const favorites=character.sheetLayout?.favorites?.pack||[];
  const before=character.items.length;
  character.items=character.items.filter(item=>item.qty>0||favorites.includes(item.id));
  removeMissingItemActions(character);
  return before-character.items.length;
}

export function removeMissingItemActions(character) {
  const weapons=new Set(character.items.filter(item=>item.category==='Weapon').map(item=>item.id));
  const removed=new Set((character.attacks||[]).filter(attack=>attack.itemId&&!weapons.has(attack.itemId)).map(attack=>attack.id));
  if(!removed.size)return;
  character.attacks=character.attacks.filter(attack=>!removed.has(attack.id));
  const favorites=character.sheetLayout?.favorites?.attacks;
  if(favorites)character.sheetLayout.favorites.attacks=favorites.filter(id=>!removed.has(id));
}

export function setItemQuantity(character,item,quantity) {
  const before=item.qty,uses=itemUses(item);
  item.qty=Math.max(0,Math.min(99999,Math.trunc(quantity)));
  if(uses.maxUses&&uses.consumeOnEmpty) {
    if(!item.qty)item.usesLeft=0;
    else if(!before)item.usesLeft=uses.maxUses;
  }
  removeEmptyItems(character);
}

// A counter describes the current item; unopened items in the stack stay full.
// Rechargeable items keep their quantity and are refilled explicitly by editing.
export function spendItemUse(character,item) {
  if(!character.items.includes(item)||item.qty<1)return false;
  const uses=itemUses(item);
  if(uses.maxUses) {
    if(uses.usesLeft<1)return false;
    Object.assign(item,uses,{usesLeft:uses.usesLeft-1});
    if(!item.usesLeft&&uses.consumeOnEmpty) {
      item.qty--;
      if(item.qty)item.usesLeft=uses.maxUses;
    }
  } else if(item.category==='Consumable')item.qty--;
  else return false;
  removeEmptyItems(character);
  return true;
}
