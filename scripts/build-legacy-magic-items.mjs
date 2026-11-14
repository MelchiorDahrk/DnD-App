// Import the 2014 wiki's published item index. A revised 2024 item always wins;
// earlier-only entries retain their own rules and source attribution.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pageContent,nodes,text} from './lib/wiki-html.mjs';
import {MAGIC_ITEMS as current} from '../magic-item-data.js';
import {WEAPONS,ARMOR} from '../catalog.js';
import {magicItemIcon} from './lib/magic-item-art.mjs';
import {refreshMagicItemIconNames} from './lib/magic-item-icon-names.mjs';
const root=resolve(import.meta.dirname,'..'),cache=resolve(root,'.tmp/legacy-magic');
const base='https://dnd5e.wikidot.com',indexPath='/wondrous-items';
const download=process.argv.includes('--download');
const cacheFile=path=>resolve(cache,encodeURIComponent(path).replace(/%/g,'_')+'.html');
await mkdir(cache,{recursive:true});
async function page(path){
  if(download){
    const response=await fetch(base+path,{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);
    const html=await response.text();if(/page you want to access does not exist/i.test(html))throw Error(`Missing page: ${path}`);
    await writeFile(cacheFile(path),html);
  }
  return pageContent(await readFile(cacheFile(path),'utf8'));
}
const index=await page(indexPath),rows=new Map();
const sourceNames=new Map(nodes(index,n=>n.tag==='tr').map(row=>row.children.filter(n=>n.tag==='td').map(text)).filter(cells=>cells.length===2));
const rarityNames=['Common','Uncommon','Rare','Very Rare','Legendary','Artifact','Unique','Unknown'];
for(const tab of nodes(index,n=>/^wiki-tab-0-\d+$/.test(n.attrs.id||''))){
  const rarity=rarityNames[+tab.attrs.id.split('-').at(-1)];
  for(const row of nodes(tab,n=>n.tag==='tr')){
    const cells=row.children.filter(n=>n.tag==='td'),link=cells[0]&&nodes(cells[0],n=>n.tag==='a'&&n.attrs.href?.startsWith('/wondrous-items:'))[0];
    if(!link)continue;const path=link.attrs.href;
    if(rows.has(path)){rows.get(path).rarities.push(rarity);continue;}
    rows.set(path,{path,name:text(link),itemType:text(cells[1]),attuned:text(cells[2]),sourceCode:text(cells[3]),rarities:[rarity]});
  }
}
if(rows.size<800)throw Error(`Incomplete 2014 index: ${rows.size}`);
await writeFile(resolve(root,'scripts/data/legacy-magic-item-index.json'),JSON.stringify([...rows.values()],null,2)+'\n');
const summaries=JSON.parse(await readFile(resolve(root,'scripts/data/legacy-magic-item-summaries.json'),'utf8'));
const tableSummaries=JSON.parse(await readFile(resolve(root,'scripts/data/legacy-magic-table-summaries.json'),'utf8'));
for(const kind of ['Magic-Items'])if(download){
  const response=await fetch(`https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-${kind}.json`);
  if(!response.ok)throw Error(`2014 SRD ${kind}: ${response.status}`);
  await mkdir(resolve(root,'.tmp/rules'),{recursive:true});await writeFile(resolve(root,`.tmp/rules/2014-${kind}.json`),await response.text());
}
const srd=JSON.parse(await readFile(resolve(root,'.tmp/rules/2014-Magic-Items.json'),'utf8'));
const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/(\d)or(?=\d)/g,'$1');
const currentByName=new Map(current.map(item=>[normal(item.name),item]));
// Renamed/combined revisions describe the same item. Similar but distinct items
// such as Feather Token and Quaal's Feather Token are deliberately kept separate.
const revisionAliases={
  rodofthepactkeeper123:'Rod of the Pact Keeper',
  wandofthewarmage:'Wand of the War Mage, +1, +2 or +3',
  arrowofslaying:'Ammunition of Slaying',
  bookofviledarknessvariant:'Book of Vile Darkness',
  wrapsofunarmedprowess:'Wraps of Unarmed Power',
  scrolloftarrasquesummoning:'Scroll of Titan Summoning'
};
const srdAliases={quaalsfeathertoken:'feathertoken',hewardshandyhaversack:'handyhaversack',nolzursmarvelouspigments:'marvelouspigments',daernsinstantfortress:'instantfortress',apparatusofkwalish:'apparatusofthecrab',keoghtomsointment:'restorativeointment',quiverofehlonna:'efficientquiver',ironbandsofbilarro:'ironbandsofbinding',stoneofgoodluckluckstone:'stoneofgoodluck'};
const groups={Armor:'Armor & shields',Weapon:'Weapons',Potion:'Potions',Ring:'Rings',Rod:'Rods',Scroll:'Scrolls',Staff:'Staves',Wand:'Wands','Wondrous Item':'Wondrous items'};
// Explicit physical weights verified in each item's text; capacities and target
// weight limits are not the item's own weight. Listed weights override base gear.
const listedWeights={
  'Heward\'s Hireling Armor':10,'Rod of the Vonindod':100,'Staff of Defense':3,"Gurt's Greataxe":325,
  'Abracadabrus':25,'Alchemy Jug (Blue)':12,'Alchemy Jug (Orange)':12,'Cauldron of Plenty':50,
  'Chest of Preserving':25,'Conch of Teleportation':20,"Constantori's Portrait":15,'Cracked Driftglobe':1,
  'Devastation Orb':10,'Grimoire Infinitus':3,"Iggwilv's Cauldron":80,'Infernal Puzzle Box':3,'Mimir':5,
  'Mirror of Reflected Pasts':25,'Mizzium Apparatus':8,'Orb of Gonging':5,'Orb of Skoraeus':8,
  'Ornithopter of Flying':25,'Soul Coin':.33,'Witchlight Vane':3
};
function ruleBlocks(node){
  if(typeof node==='string'||node.tag==='table')return [];
  if(/^(p|li|h[1-6])$/.test(node.tag))return [text(node)];
  return node.children.flatMap(ruleBlocks);
}
const items=[],shared=[];
for(const row of rows.values()){
  const key=normal(row.name),revision=currentByName.get(key)||currentByName.get(normal(revisionAliases[key]||''))||current.find(item=>!item.variantOf&&item.wiki.split(':').at(-1)===row.path.split(':').at(-1));
  if(revision){shared.push({path:row.path,name:row.name,currentId:revision.id,iconKey:revision.iconKey});continue;}
  const body=await page(row.path),paragraphs=nodes(body,n=>n.tag==='p').map(text);
  const isMetadata=p=>/^(?:Armor|Shield|Weapon|Potion|Ring|Rod|Scroll|Staff|Wand|Wondrous Item)[, (]/i.test(p);
  const metadata=nodes(body,n=>n.tag==='em'||n.tag==='strong').map(text).find(isMetadata)||paragraphs.find(isMetadata);
  const isSource=p=>/^Sources?\s*[:–-]/i.test(p);
  const sources=[...new Set(paragraphs.filter(isSource).map(p=>p.replace(/^Sources?\s*[:–-]\s*/i,'').replace(metadata||'','').trim()))];
  if(!sources.length&&row.sourceCode)sources.push(sourceNames.get(row.sourceCode)||row.sourceCode);
  if(!metadata||!sources.length)throw Error(`Missing 2014 metadata: ${row.path}`);
  const attunement=metadata.match(/\(requires attunement[^)]*\)/i)?.[0].slice(1,-1)||(/attuned/i.test(row.attuned)?'Requires Attunement':'Not required');
  // An SRD generic name can collide with a different supplement item (notably
  // Eberron's common Feather Token versus the DMG's Quaal feather tokens).
  const match=sources.some(source=>/Dungeon Master.?s Guide/i.test(source))?srd.find(item=>normal(item.name)===(srdAliases[key]||key)):undefined;
  const tables=tableSummaries[row.path]||nodes(body,n=>n.tag==='table').map(table=>nodes(table,n=>n.tag==='tr').map(tr=>tr.children.filter(n=>/^(td|th)$/.test(n.tag)).map(text))).filter(t=>t.length);
  const rules=summaries[row.path]||(match?(tables.length?ruleBlocks(body).filter(p=>p!==metadata&&!isSource(p)).join('\n\n'):Array.isArray(match.desc)?match.desc.join('\n\n'):match.desc):'');
  if(!rules)throw Error(`Missing original 2014 summary: ${row.path}`);
  const baseType=metadata.match(/^(?:armor|weapon)\s*\(([^)]+)\)/i)?.[1]||(/^Shield,/i.test(metadata)?'Shield':'');
  const baseItem=baseType&&[...WEAPONS,...ARMOR].find(item=>normal(item.name)===normal(baseType)||normal(item.name.replace(/ Armor$/i,''))===normal(baseType));
  const weight=listedWeights[row.name]??baseItem?.weight??(row.itemType==='Potion'?.5:row.itemType==='Staff'?4:row.itemType==='Wand'?1:row.itemType==='Rod'?2:0);
  const weightStatus=row.name in listedWeights?'Listed item weight'+(row.name==='Soul Coin'?' (1/3 lb., rounded)':''):baseItem?`2024 base ${baseItem.name} weight`:row.itemType==='Potion'?'Standard vial':/^(Staff|Wand|Rod)$/.test(row.itemType)?'Standard base item; review':'Unspecified; enter actual weight (currently excluded)';
  const drinkable=row.itemType==='Potion'&&!/^Oil\b/i.test(row.name);
  const details=[rules.replace(/\*\*|__/g,'').replace(/\r/g,'').trim(),baseItem?`Base equipment (2024): ${baseItem.name}. ${baseItem.details} Apply the item's magical overrides above.`:'',drinkable?'2024 potion use: Bonus Action to drink or administer; apply its effects at the table.':''].filter(Boolean).join('\n\n');
  const slug=row.path.slice('/wondrous-items:'.length).replace(/[^a-z0-9-]/g,'-');
  items.push({id:'magic-2014-'+slug,name:row.name,group:'Magic · '+(groups[row.itemType]||row.itemType),category:row.itemType==='Armor'?'Armor':row.itemType==='Weapon'?'Weapon':/Potion|Scroll/.test(row.itemType)?'Consumable':'Gear',weight,weightStatus,cost:'Unlisted (2014 wiki)',details,wiki:base+row.path,magic:true,edition:'2014',itemType:row.itemType,rarities:[...new Set(row.rarities)],rarity:[...new Set(row.rarities)].join(' / '),attunement,source:sources.join('; '),typeDetails:metadata,iconKey:magicItemIcon(row.name,row.itemType),tables,...(drinkable?{actionType:'bonus'}:{}),rulesSource:match&&!summaries[row.path]?'SRD 5.1 (CC BY 4.0)':'Original wiki summary'});
}
items.sort((a,b)=>a.group.localeCompare(b.group)||a.name.localeCompare(b.name));
const audit={index:base+indexPath,snapshotDate:'2026-11-14',uniqueItems:rows.size,addedItems:items.length,presets:items.length,sharedItems:shared,sourcePaths:[...rows.keys()].sort()};
await writeFile(resolve(root,'legacy-magic-item-data.js'),'// Generated by scripts/build-legacy-magic-items.mjs; 2024 revisions take precedence.\nexport const LEGACY_MAGIC_ITEM_AUDIT='+JSON.stringify(audit)+';\nexport const LEGACY_MAGIC_ITEMS=[\n'+items.map(item=>'  '+JSON.stringify(item)).join(',\n')+'\n];\n');
await refreshMagicItemIconNames(root);
console.log(`${rows.size} earlier wiki items: ${shared.length} use 2024 revisions; ${items.length} earlier-only presets added.`);
