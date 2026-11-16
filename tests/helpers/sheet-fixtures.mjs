import {EQUIPMENT,itemFromEquipment} from '../../catalog.js';
import {parseBackup} from '../../model.js';

export function catalogSheetState(original) {
  const state=structuredClone(original),character=state.characters.find(c=>c.id===state.activeId);
  character.items=EQUIPMENT.map(itemFromEquipment);
  character.items.push({...character.items[0],id:'custom-item',name:'Custom treasure',category:'Treasure'});
  // Browser startup links actions to inventory IDs. This fixture replaces that
  // inventory, so retain the action fields without links to removed weapons.
  for(const attack of character.attacks)delete attack.itemId;
  // Use a custom name so startup cannot link this to the catalog's Moonblade.
  character.attacks.push({...character.attacks[0],id:'renamed-weapon',name:'Renamed rapier',weaponId:'rapier',iconKey:''});
  return parseBackup(JSON.stringify(state));
}
