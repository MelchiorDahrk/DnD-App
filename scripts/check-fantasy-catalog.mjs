import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import rules from '../vendor/bricktrait/fantasy-catalog.json' with {type:'json'};
import cmfs from '../vendor/bricktrait/cmf-catalog.json' with {type:'json'};
import themes from '../vendor/bricktrait/theme-catalog.json' with {type:'json'};
import {EQUIPMENT_ICONS,equipmentIconParts} from '../equipment-icons.js';
import {fantasyCatalog,isFantasyPart} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';

export function checkFantasyCatalog() {
  const root=resolve(import.meta.dirname,'..');
  const all=JSON.parse(readFileSync(resolve(root,'vendor/bricktrait/static/ldraw/catalog.json'),'utf8'));
  const byId=new Map(all.map(p=>[p.id,p]));
  byId.set('standard',{id:'standard',cat:'legs'});
  for(const groups of [rules.categories,rules.include,cmfs.categories,...Object.values(themes.themes)])for(const [cat,entries] of Object.entries(groups))for(const id of Object.keys(entries)) {
    if(byId.get(id)?.cat!==cat)throw new Error(`Fantasy allowlist: missing or miscategorized ${cat}/${id}`);
  }
  const allowed=fantasyCatalog([...byId.values()]);
  if(!isFantasyPart(byId.get('standard')))throw new Error('Keep standard hips/legs approved: they are the default and randomizer fallback.');
  for(const cat of ['head','headgear','neck','back','torso','legs','hand'])if(!allowed.some(p=>p.cat===cat))throw new Error(`Empty fantasy slot: ${cat}`);
  for(const [key,entry] of Object.entries(EQUIPMENT_ICONS))for(const {id} of equipmentIconParts(entry)) {
    if(!byId.has(id))throw new Error(`Equipment icon ${key} needs LDraw part ${id}`);
  }
  console.log(`Validated ${allowed.length} selectable portrait parts and ${Object.keys(EQUIPMENT_ICONS).length} equipment icon mappings`);
}
