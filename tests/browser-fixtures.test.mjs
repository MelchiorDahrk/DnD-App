import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT} from '../catalog.js';
import {linkWeaponActions} from '../inventory.js';
import {parseBackup} from '../model.js';
import {defaultPartyState} from './helpers/default-party.mjs';
import {catalogSheetState} from './helpers/sheet-fixtures.mjs';

test('catalog browser fixture survives replacing a persisted, linked inventory',()=>{
  const original=defaultPartyState();
  original.characters.forEach(linkWeaponActions);
  assert.ok(original.characters[0].attacks.some(attack=>attack.itemId),'exercise the state saved by app startup');
  const before=structuredClone(original);
  const fixture=catalogSheetState(original),character=fixture.characters.find(c=>c.id===fixture.activeId);
  assert.deepEqual(original,before,'building a fixture must not modify the default party');
  assert.equal(character.items.length,EQUIPMENT.length+1);
  assert.ok(character.attacks.every(attack=>!attack.itemId));
  const renamed=character.attacks.find(attack=>attack.id==='renamed-weapon');
  assert.equal(renamed.name,'Renamed rapier');
  assert.equal(renamed.weaponId,'rapier');
  fixture.characters.forEach(linkWeaponActions);
  assert.ok(!renamed.itemId,'a custom renamed attack must not link to a catalog weapon');
  assert.ok(character.attacks.some(attack=>attack.itemId),'real catalog weapons still get linked');
  assert.deepEqual(parseBackup(JSON.stringify(fixture)),fixture,'fixture also survives app startup and a second reload');
});
