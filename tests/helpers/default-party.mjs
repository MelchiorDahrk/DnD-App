import {defaultCharacters,initialState} from '../../default-characters.js';

export function defaultPartyState() {
  const characters=defaultCharacters();
  return {...initialState(),characters,activeId:characters[0].id};
}
