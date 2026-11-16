// Rebrickable source normalization. Mappings are evidence, never fuzzy print names.
import {resolveExternalPart,resolveExternalColor,assembleInventory} from './minifigure-presets.mjs';
const normalize=s=>String(s).toLowerCase().replace(/bluish|stone/g,'bluish').replace(/grey/g,'gray').replace(/[^a-z0-9]/g,'');
export function verifiedColorMap(colors,ldraw){
  const map={},evidence={};
  for(const [id,color] of Object.entries(colors)){
    const hits=ldraw.filter(c=>normalize(c.name)===normalize(color.name));
    if(hits.length===1){map[id]=hits[0].code;evidence[id]={ldraw:hits[0].code,source:'Exact named color in Rebrickable colors.csv and LDraw LDConfig.ldr',name:color.name};}
  }
  return {map,evidence};
}
export function keywordMappings(sourceParts){
  const found=new Map(),sources=new Map(sourceParts.map(p=>[p.id,p]));
  const canonical=part=>{
    const seen=new Set();let current=part;
    while(current.aliasTarget&&sources.has(current.aliasTarget)&&!seen.has(current.id)){seen.add(current.id);current=sources.get(current.aliasTarget);}
    return current;
  };
  for(const part of sourceParts)for(const external of part.externalIds){
    if(!found.has(external))found.set(external,[]);
    found.get(external).push(canonical(part));
  }
  const parts={},evidence={},ambiguous={};
  for(const [id,entries] of found){
    const unique=[...new Map(entries.map(p=>[p.id,p])).values()];
    // Distinct source geometries are never resolved by a fuzzy name guess.
    if(unique.length===1){parts[id]=unique[0].id;evidence[id]={ldraw:unique[0].id,source:`LDraw ${unique[0].source} ${unique[0].id}.dat !KEYWORDS Rebrickable ${id}`};}
    else ambiguous[id]=unique.map(p=>p.id);
  }
  return {parts,evidence,ambiguous};
}
export function normalizeBulkFigure(fig,data,mappings){
  const themes=[...new Set(fig.sets.flatMap(s=>s.themes))];
  const cmf=themes.includes('Collectible Minifigures');
  const theme=themes.includes('Dungeons & Dragons')?'Dungeons & Dragons':cmf?'Collectible Minifigures':themes.at(-1)||'Unclassified';
  const parts=fig.parts.map(item=>({quantity:item.quantity,is_spare:!!item.is_spare,part:{part_num:item.part_num,name:data.parts[item.part_num]?.name||item.part_num,external_ids:mappings.parts[item.part_num]?{LDraw:[mappings.parts[item.part_num]]}:{}},color:{id:item.color,name:data.colors[item.color]?.name||String(item.color),external_ids:mappings.colors[item.color]!==undefined?{LDraw:{ext_ids:[mappings.colors[item.color]]}}:{}}}));
  return {...fig,theme,themes,cmf,url:`https://rebrickable.com/minifigs/${fig.id}/`,parts};
}
export function torsoInventoryColors(name,colors){
  // Source descriptions explicitly state limb colors; missing/printed/moulded
  // arms need a reviewed assembly and are never inferred from the torso color.
  const match=name.match(/(?:,|Pattern|Print)\s*([^,]+?) Arms?(?:,?\s*(?:and )?([^,]+?) Hands?)?\s*$/i);
  if(!match)return null;
  const lookup=text=>Object.entries(colors).find(([,c])=>normalize(c.name)===normalize(text?.replace(/^and /i,'')||''))?.[0];
  const arms=lookup(match[1]),hands=lookup(match[2]);
  return arms!==undefined&&hands!==undefined?{arms:Number(arms),hands:Number(hands)}:null;
}
export function assembleBulkFigure(fig,data,parts,mappings){
  const source=normalizeBulkFigure(fig,data,mappings);
  const catalog=new Map(parts.map(p=>[p.id,p]));
  const inventory=[...source.parts];
  for(const item of source.parts){
    const id=resolveExternalPart(item.part,catalog,mappings);
    if(catalog.get(id)?.cat==='torso'&&!catalog.get(id).arms){
      const colors=torsoInventoryColors(item.part.name,data.colors);
      if(colors&&mappings.colors[colors.arms]!==undefined&&mappings.colors[colors.hands]!==undefined){
        for(const [part,color,quantity] of [['3818',colors.arms,1],['3819',colors.arms,1],['3820',colors.hands,2]])inventory.push({quantity,part:{part_num:`assembly-${part}`,name:'Separate limb explicitly described by source torso inventory',external_ids:{LDraw:[part]}},color:{id:color,external_ids:{LDraw:{ext_ids:[mappings.colors[color]]}}}});
      }
    }
  }
  return {source,...assembleInventory(inventory,parts,{sourceKind:'rebrickable',mappings})};
}
