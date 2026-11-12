// Refresh the reviewed, explicit CMF-associated catalog snapshot from local
// LDraw headers. Shared moulds are included; this is not a complete set inventory.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const parts=JSON.parse(await readFile(resolve(root,'vendor/bricktrait/static/ldraw/catalog.json'),'utf8'));
const categories={};
const supplements=new Set(['93563','27385','16709p0e','16709p0l']);
for(const part of parts){
  if(['body','equipment'].includes(part.cat))continue;
  let source='';
  for(const folder of ['ldraw','ldraw-unofficial']){
    try{source=await readFile(resolve(root,'.cache',folder,'parts',`${part.id}.dat`),'utf8');break;}catch{}
  }
  const keywords=[...source.matchAll(/^0 !KEYWORDS (.*)$/gmi)].map(m=>m[1]).join(' ');
  if(!/\bCMF\b|collect(?:i|a)ble minifigures|minifigures series|\b71047\b/i.test(keywords)&&!supplements.has(part.id))continue;
  (categories[part.cat]??={})[part.id]=part.name;
}
const result={_notes:['CMF = Collectible Minifigures. Explicit LDraw IDs associated by source keywords, plus reviewed supplements.','Includes shared moulds and available D&D CMF parts; incomplete source tags and missing LDraw geometry mean this is not an exhaustive CMF inventory.','Regenerate with node scripts/update-cmf-catalog.mjs after building the LDraw catalog. Explicit fantasy exclusions still take precedence.'],categories};
await writeFile(resolve(root,'vendor/bricktrait/cmf-catalog.json'),JSON.stringify(result,null,2)+'\n');
console.log(`CMF snapshot: ${Object.values(categories).reduce((n,entries)=>n+Object.keys(entries).length,0)} parts`);
