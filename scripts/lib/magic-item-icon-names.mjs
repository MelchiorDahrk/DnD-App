import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Keep geometry/rendering imports small: the renderer needs names, not rules text.
export async function refreshMagicItemIconNames(root){
  const groups=[];
  for(const file of ['legacy-magic-item-data.js','magic-item-data.js']){
    const content=await readFile(resolve(root,file),'utf8');
    const match=content.match(/export const (?:LEGACY_MAGIC_ITEMS|MAGIC_ITEMS)=([\s\S]+);\s*$/);
    if(!match)throw Error(`Missing generated catalog: ${file}`);
    groups.push(JSON.parse(match[1]).map(({name,iconKey})=>[name,iconKey]));
    if(file==='legacy-magic-item-data.js'){
      const audit=JSON.parse(content.match(/export const LEGACY_MAGIC_ITEM_AUDIT=([^\n]+);/)?.[1]||'{}');
      groups.push((audit.sharedItems||[]).map(({name,iconKey})=>[name,iconKey]));
    }
  }
  await writeFile(resolve(root,'magic-item-icon-names.js'),'// Generated magic item artwork aliases; current-edition names take precedence.\nexport const MAGIC_ITEM_ICON_NAMES='+JSON.stringify(groups.flat())+';\n');
}
