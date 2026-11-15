// Bundle wiki catalog facts and original reference summaries, plus CC BY 4.0 SRD rules.
// Refresh public research caches with --download; ordinary builds use committed data.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pageContent,nodes,text} from './lib/wiki-html.mjs';
import {WEAPONS,ARMOR,BASIC_EQUIPMENT} from '../catalog.js';
import {magicItemWeight} from './lib/magic-item-weights.mjs';
import {magicItemIcon} from './lib/magic-item-art.mjs';
import {refreshMagicItemIconNames} from './lib/magic-item-icon-names.mjs';
const root=resolve(import.meta.dirname,'..'),cache=resolve(root,'.tmp/rest-wiki');
const base='https://dnd2024.wikidot.com',indexPath='/magic-item:all';
const cacheFile=path=>resolve(cache,encodeURIComponent(path).replace(/%/g,'_')+'.html');
async function page(path){
  if(process.argv.includes('--download')){
    const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);
    const html=await r.text();if(/page you want to access does not exist/i.test(html))throw Error(`Missing page: ${path}`);
    await writeFile(cacheFile(path),html);
  }
  return pageContent(await readFile(cacheFile(path),'utf8'));
}
await mkdir(cache,{recursive:true});
const index=await page(indexPath),rows=new Map(),rarityNames=['Common','Uncommon','Rare','Very Rare','Legendary','Artifact','Varies'];
for(const [i,table] of nodes(index,n=>n.tag==='table').entries())for(const row of nodes(table,n=>n.tag==='tr')){
  const cells=row.children.filter(n=>n.tag==='td'),link=cells[0]&&nodes(cells[0],n=>n.tag==='a'&&n.attrs.href?.startsWith('/magic-item:'))[0];
  if(!link)continue;
  const path=link.attrs.href,existing=rows.get(path);
  if(existing){existing.rarities.push(rarityNames[i]);continue;}
  rows.set(path,{path,name:text(link),itemType:text(cells[1]),cost:text(cells[3]),rarities:[rarityNames[i]]});
}
if(rows.size<500)throw Error(`Incomplete wiki index: ${rows.size} items`);
const summaries=JSON.parse(await readFile(resolve(root,'scripts/data/magic-item-summaries.json'),'utf8'));
const srdFile=resolve(root,'.tmp/rules/2024-Magic-Items.json');
if(process.argv.includes('--download')){
  await mkdir(resolve(root,'.tmp/rules'),{recursive:true});
  const r=await fetch('https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Magic-Items.json');
  if(!r.ok)throw Error(`SRD: HTTP ${r.status}`);await writeFile(srdFile,await r.text());
}
const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const srd=JSON.parse(await readFile(srdFile,'utf8'));
const groups={Armor:'Armor & shields',Weapon:'Weapons',Potion:'Potions',Ring:'Rings',Rod:'Rods',Scroll:'Scrolls',Staff:'Staves',Wand:'Wands','Wondrous Item':'Wondrous items'};
const items=[];
// The community SRD JSON flattens some tables into joined words. Use the
// equivalent licensed page paragraphs for those entries; tables stay structured.
function licensedBlocks(node){
  if(typeof node==='string'||node.tag==='table')return [];
  if(/^(p|li|h[1-6])$/.test(node.tag))return [text(node)];
  return node.children.flatMap(licensedBlocks);
}
for(const row of rows.values()){
  const body=await page(row.path),paragraphs=nodes(body,n=>n.tag==='p').map(text);
  const metadata=nodes(body,n=>n.tag==='em').map(text).find(p=>/^(Armor|Weapon|Potion|Ring|Rod|Scroll|Staff|Wand|Wondrous Item)[, (]/i.test(p))||paragraphs.find(p=>/^(Armor|Weapon|Potion|Ring|Rod|Scroll|Staff|Wand|Wondrous Item)[, (]/i.test(p));
  const sources=[...new Set(paragraphs.filter(p=>p.startsWith('Source:')).map(p=>p.slice(7).replace(metadata||'','').trim()))];
  if(!metadata||!sources.length)throw Error(`Incomplete metadata: ${row.path}`);
  const attunement=metadata.match(/\(Requires Attunement[^)]*\)/i)?.[0].slice(1,-1)||(/requires attunement/i.test(metadata)?'Requires Attunement':'Not required');
  const match=srd.find(s=>normal(s.name)===normal(row.name));
  const tables=nodes(body,n=>n.tag==='table').map(table=>nodes(table,n=>n.tag==='tr').map(tr=>tr.children.filter(n=>/^(td|th)$/.test(n.tag)).map(text))).filter(t=>t.length);
  const rules=summaries[row.path]||(match?(tables.length?licensedBlocks(body).filter(p=>p!==metadata&&!p.startsWith('Source:')).join('\n\n'):Array.isArray(match.desc)?match.desc.join('\n\n'):match.desc):'');
  if(!rules)throw Error(`Missing original summary or SRD rules: ${row.path}`);
  const slug=row.path.slice('/magic-item:'.length);
  const baseType=metadata.match(/^(?:Armor|Weapon)\s*\(([^)]+)\)/i)?.[1];
  const baseItem=baseType&&[...WEAPONS,...ARMOR].find(item=>normal(item.name)===normal(baseType)||normal(item.name.replace(/ Armor$/,''))===normal(baseType));
  const iconKey=magicItemIcon(row.name,row.itemType);
  const weightFields=magicItemWeight({...row,typeDetails:metadata,iconKey},BASIC_EQUIPMENT);
  const drinkable=row.itemType==='Potion'&&!/^Oil\b/i.test(row.name);
  const details=[rules.replace(/\*\*|__/g,'').replace(/\r/g,'').trim(),baseItem?`Base equipment: ${baseItem.name}. ${baseItem.details}`:'',drinkable?'2024 potion use: Bonus Action to drink or administer; apply its listed effects.':''].filter(Boolean).join('\n\n');
  items.push({id:slug==='potion-of-healing'?slug:'magic-'+slug,name:row.name,group:'Magic · '+(groups[row.itemType]||row.itemType),category:/Armor/.test(row.itemType)?'Armor':row.itemType==='Weapon'?'Weapon':/Potion|Scroll/.test(row.itemType)?'Consumable':'Gear',...weightFields,cost:slug==='potion-of-healing'?'50 GP':row.cost||'Unlisted',details,wiki:base+row.path,magic:true,edition:'2024',itemType:row.itemType,rarities:row.rarities,rarity:row.rarities.join(' / '),attunement,source:sources.join('; '),typeDetails:metadata,iconKey,tables,...(drinkable?{actionType:'bonus'}:{}),rulesSource:match&&!summaries[row.path]?'SRD 5.2.1 (CC BY 4.0)':'Original wiki summary'});
}
// Split frequently used potency choices into usable inventory presets. Their
// shared page still retains every wiki table, including less common variants.
const healing=[['greater','Uncommon','4d4+4','200 GP'],['superior','Rare','8d4+8','2,000 GP'],['supreme','Very Rare','10d4+20','20,000 GP']];
const potion=items.find(i=>i.id==='potion-of-healing');
for(const [tier,rarity,formula,cost] of healing)items.push({...potion,id:`magic-potion-of-${tier}-healing`,name:`Potion of ${tier[0].toUpperCase()+tier.slice(1)} Healing`,rarity,rarities:[rarity],typeDetails:`Potion, ${rarity}`,cost,variantOf:potion.id,details:`Bonus Action: drink or administer within 5 feet. Restores ${formula} Hit Points. Using this item here reduces its quantity; apply healing separately.`});
for(const [slug,type,rarities] of [['weapon-1-2-or-3','Weapon',['Uncommon','Rare','Very Rare']],['ammunition-1-2-or-3','Ammunition',['Uncommon','Rare','Very Rare']],['shield-1-2-or-3','Shield',['Uncommon','Rare','Very Rare']],['armor-1-2-or-3','Armor',['Rare','Very Rare','Legendary']],['wand-of-the-war-mage-1-2-or-3','Wand of the War Mage',['Uncommon','Rare','Very Rare']]]){
  const parent=items.find(i=>i.wiki===base+'/magic-item:'+slug);if(!parent)throw Error(`Missing potency family: ${slug}`);
  for(let bonus=1;bonus<=3;bonus++){
    const rarity=rarities[bonus-1],price={Uncommon:400,Rare:4000,'Very Rare':40000,Legendary:200000}[rarity];
    const effect=type==='Armor'?`Gain +${bonus} AC in addition to the chosen base armor's normal AC. Keep its normal training, Strength, Stealth, and Dexterity rules.`:type==='Shield'?`Gain +${bonus} AC in addition to a Shield's normal +2 bonus (total +${bonus+2} AC).`:type==='Weapon'?`Gain +${bonus} to attack and damage rolls with the chosen base weapon. Keep its normal damage die, properties, and mastery.`:type==='Ammunition'?`Gain +${bonus} to attack and damage rolls. A piece loses its magic after hitting a target. Quantity counts individual pieces; default weight is one arrow, adjustable for other ammunition.`:`While holding this wand, gain +${bonus} to spell attack rolls and ignore Half Cover when making spell attacks.`;
    items.push({...parent,id:parent.id+'-'+bonus,name:`${type}, +${bonus}`,rarity,rarities:[rarity],typeDetails:`${type}, +${bonus} · ${rarity}${parent.attunement==='Not required'?'':` (${parent.attunement})`}`,cost:(type==='Ammunition'?price/2:price).toLocaleString('en-US')+' GP'+(/Weapon|Armor|Shield/.test(type)?' + base item cost':''),variantOf:parent.id,details:`Potency: +${bonus}. ${effect}`});
  }
}
items.sort((a,b)=>a.group.localeCompare(b.group)||a.name.localeCompare(b.name));
const snapshotDate=process.argv.includes('--download')?new Date().toISOString().slice(0,10):await readFile(resolve(cache,'audit-date.json'),'utf8').then(s=>JSON.parse(s).date).catch(()=>null);
const audit={index:base+indexPath,snapshotDate,uniqueItems:rows.size,variants:items.length-rows.size,presets:items.length,sourcePaths:[...rows.keys()].sort()};
await writeFile(resolve(root,'magic-item-data.js'),'// Generated by scripts/build-magic-items.mjs; see docs/magic-items.md for sources and scope.\nexport const MAGIC_ITEM_AUDIT='+JSON.stringify(audit)+';\nexport const MAGIC_ITEMS=[\n'+items.map(item=>'  '+JSON.stringify(item)).join(',\n')+'\n];\n');
await refreshMagicItemIconNames(root);
console.log(`${audit.uniqueItems} wiki items + ${audit.variants} potency presets = ${items.length} magic-item presets.`);
