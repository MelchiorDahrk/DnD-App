import {equipmentIconURL,ITEM_ICON_DEFAULTS} from './equipment-icons.js';
import {icon} from './icons.js';
import {attackWeapon} from './attack-rules.js';

export function itemIconMarkup(item, fallbackName) {
  const fallback = icon(fallbackName || {Weapon:'sword',Armor:'shield',Consumable:'heart',Treasure:'spark',Gear:'bag'}[item.category] || 'bag');
  const key = ITEM_ICON_DEFAULTS[fallbackName] || ITEM_ICON_DEFAULTS[item.category] || ITEM_ICON_DEFAULTS.Gear;
  const url = equipmentIconURL(item) || `./assets/equipment/${key}.webp`;
  return `<span class="equipment-icon">${fallback}<img src="${url}" alt="" width="160" height="160" loading="lazy" decoding="async"></span>`;
}

/** Use the same named/base-weapon artwork on sheets, dialogs and attack VFX. */
export function attackIconMarkup(attack, fallbackName) {
  const artwork = equipmentIconURL(attack) ? attack : attackWeapon(attack) || attack;
  return itemIconMarkup({...artwork,category:'Weapon'},fallbackName || (artwork.family?.endsWith('ranged')?'bow':'sword'));
}

/** Keep the SVG visible if an asset is unavailable, without inline handlers. */
export function installItemIconFallbacks(root = document) {
  root.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.equipment-icon')) event.target.remove();
  }, true);
}
