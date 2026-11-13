import {equipmentIconURL,ITEM_ICON_DEFAULTS,ITEM_ICON_LIBRARY,validItemIconKey,normalizeEquipmentName} from './equipment-icons.js';
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

const esc = value => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

/** A library choice changes artwork only; the item's rules and name stay editable. */
export function itemIconPicker(item) {
  const selected=validItemIconKey(item.iconKey)?item.iconKey:'';
  const groups=[...new Set(ITEM_ICON_LIBRARY.map(entry=>entry.group))].sort();
  return `<details class="item-icon-picker"><summary><span class="item-icon-preview" data-item-icon-preview>${itemIconMarkup(item)}</span><span>Item icon<strong data-item-icon-label>${esc(ITEM_ICON_LIBRARY.find(entry=>entry.key===selected)?.label || 'Automatic')}</strong></span><span class="item-icon-browse">Browse library</span></summary><p class="form-help">Choose artwork for this item, or use Automatic to match its name and category.</p><div class="form-grid"><label class="form-field">Search icons<input type="search" data-item-icon-search placeholder="Try katana, crystal, food, or a part number" autocomplete="off"></label><label class="form-field">Icon category<select data-item-icon-group><option value="">All icons</option>${groups.map(group=>`<option>${esc(group)}</option>`).join('')}</select></label></div><label class="item-icon-auto"><input type="radio" name="iconKey" value="" ${selected?'':'checked'}>Automatic · match item name and category</label><p class="form-help" data-item-icon-count role="status">${ITEM_ICON_LIBRARY.length} icons available.</p><div class="item-icon-grid" role="group" aria-label="Item icon library">${ITEM_ICON_LIBRARY.map(entry=>`<label class="item-icon-choice" data-item-icon-key="${entry.key}"><input type="radio" name="iconKey" value="${entry.key}" ${selected===entry.key?'checked':''}><span>${itemIconMarkup({iconKey:entry.key,category:item.category})}<span>${esc(entry.label)}</span></span></label>`).join('')}</div></details>`;
}

/** Update in place so searching and choosing never replaces the editor form. */
export function updateItemIconPicker(root) {
  const picker=root.querySelector('.item-icon-picker');if(!picker)return;
  const key=picker.querySelector('[name="iconKey"]:checked')?.value || '';
  const item={name:root.querySelector('[name="name"]').value,category:root.querySelector('[name="category"]').value,iconKey:key};
  picker.querySelector('[data-item-icon-preview]').innerHTML=itemIconMarkup(item);
  picker.querySelector('[data-item-icon-label]').textContent=ITEM_ICON_LIBRARY.find(entry=>entry.key===key)?.label || 'Automatic';
  const query=normalizeEquipmentName(picker.querySelector('[data-item-icon-search]').value);
  const group=picker.querySelector('[data-item-icon-group]').value;
  const matches=new Set(ITEM_ICON_LIBRARY.filter(entry=>(!group||entry.group===group)&&query.split(' ').every(word=>normalizeEquipmentName(`${entry.label} ${entry.group} ${entry.keywords}`).includes(word))).map(entry=>entry.key));
  for(const choice of picker.querySelectorAll('[data-item-icon-key]'))choice.hidden=!matches.has(choice.dataset.itemIconKey);
  picker.querySelector('[data-item-icon-count]').textContent=matches.size?`${matches.size} of ${ITEM_ICON_LIBRARY.length} icons. Choose one below.`:'No icons found. Try another search or category.';
}
