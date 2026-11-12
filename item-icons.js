import {equipmentIconURL} from './equipment-icons.js';
import {icon} from './icons.js';

export function itemIconMarkup(item) {
  const fallback = icon({Weapon:'sword',Armor:'shield',Consumable:'heart',Treasure:'spark',Gear:'bag'}[item.category] || 'bag');
  const url = equipmentIconURL(item);
  return url ? `<span class="equipment-icon">${fallback}<img src="${url}" alt="" width="160" height="160" loading="lazy" decoding="async"></span>` : fallback;
}

/** Keep the SVG visible if an asset is unavailable, without inline handlers. */
export function installItemIconFallbacks(root = document) {
  root.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.equipment-icon')) event.target.remove();
  }, true);
}
