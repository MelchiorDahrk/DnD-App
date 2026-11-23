// D&D Basic Rules (2024), Magic Item Values by Rarity and Scribing Spell Scrolls.
// https://www.dndbeyond.com/sources/dnd/br-2024/magic-items#MagicItemValuesbyRarity
// https://www.dndbeyond.com/sources/dnd/br-2024/equipment#SpellScrollCosts
const rarityGold={Common:100,Uncommon:400,Rare:4000,'Very Rare':40000,Legendary:200000};
const scrollScribingGold=[15,25,100,150,1000,1500,10000,12500,15000,50000];
const denominations={cp:1,sp:10,ep:50,gp:100,pp:1000};
const gp=value=>value.toLocaleString('en-US')+' GP';
const cp=value=>value%100?`${gp(Math.floor(value/100))} ${value%100} CP`:gp(value/100);
const price={rarity:'2024 rarity guideline',scroll:'Twice the 2024 scroll scribing cost'};

export function readCoinPrice(value) {
  const match=/^(\d+|\d{1,3}(?:,\d{3})+)\s+(cp|sp|ep|gp|pp)$/i.exec(String(value??'').trim());
  if(!match)return null;
  const copper=Number(match[1].replaceAll(',',''))*denominations[match[2].toLowerCase()];
  return Number.isSafeInteger(copper)&&copper>0?copper:null;
}

export function spellScrollPrice(level) {
  return {cost:gp(scrollScribingGold[level]*2),priceNote:price.scroll};
}

const legacyConsumables=new Set([
  'devastation-orb','dried-leech','dust-of-corrosion','dust-of-deliciousness','feather-token',
  'mind-crystal','pixie-dust','spell-gem','spellwrought-tattoo','teleportation-tablet'
].map(slug=>'magic-2014-'+slug));
const consumable=item=>item.category==='Consumable'||item.id==='magic-quaal-s-feather-token'
  ||item.parentId==='magic-quaal-s-feather-token'||legacyConsumables.has(item.parentId||item.id)
  ||item.id.startsWith('magic-2014-medal-of-')||/ammunition|arrow|sling bullet/i.test(item.weightStatus);

function basePrice(item,equipment) {
  const name=item.id==='magic-repeating-shot'?'Longbow':
    /^(?:Default base |Base )(.+?)(?: weight(?:;|$)|;)/i.exec(item.weightStatus)?.[1]
    ||/^(?:Armor|Weapon)\s*\(([^)]+)\)/i.exec(item.typeDetails)?.[1];
  const base=name&&equipment.find(entry=>entry.name.toLowerCase()===name.toLowerCase());
  if(base)return {name:base.name,copper:readCoinPrice(base.cost)};
  const shot=/^Default (arrow|sling bullet) weight per piece/.exec(item.weightStatus)?.[1];
  if(shot){
    const bundle=equipment.find(entry=>entry.id===(shot==='arrow'?'arrows':'bullets-sling'));
    const count=Number(/^(\d+) pieces per bundle/.exec(bundle?.details)?.[1]);
    const copper=readCoinPrice(bundle?.cost);
    if(count&&copper)return {name:'one '+shot,copper:Math.round(copper/count)};
  }
  return null;
}

function withBase(item,copper,base,note) {
  if(!base?.copper)return {...item,...(note?{priceNote:note}:{}),cost:cp(copper),priceCp:copper};
  const total=copper+base.copper;
  return {...item,cost:cp(total),priceNote:[note,`Includes base cost for ${base.name}`].filter(Boolean).join('. '),priceCp:total};
}

export function priceMagicItem(item,equipment) {
  if(readCoinPrice(item.cost)!==null||item.cost==='Priceless')return item;
  const formula=/^B\s*\+\s*(.+)$|^(.+)\s+\+ base item cost$/i.exec(item.cost);
  if(formula){
    const base=basePrice(item,equipment),copper=readCoinPrice(formula[1]||formula[2]);
    if(base?.copper&&copper)return withBase(item,copper,base);
    return {...item,priceNote:'Depends on the base equipment'};
  }
  if(item.id==='magic-spell-scroll')return {...item,cost:'30–100,000 GP',priceNote:`${price.scroll}. Depends on spell level`};
  if(item.id==='magic-thayan-spell-tattoo')return {...item,cost:'25–150 GP to ink',priceNote:'Inking cost depends on spell level. The DM sets the purchase price'};
  if(item.cost==='Special')return {...item,priceNote:'The DM sets the price'};
  if(item.rarities.includes('Artifact'))return {...item,cost:'Priceless'};
  const values=[...new Set(item.rarities.map(rarity=>rarityGold[rarity]).filter(Boolean))].sort((a,b)=>a-b);
  if(!values.length)return {...item,cost:'DM sets price'};
  const factor=consumable(item)?50:100;
  const base=/^(Armor|Weapon)$/.test(item.itemType)?basePrice(item,equipment):null;
  if(values.length===1)return withBase(item,values[0]*factor,base,price.rarity);
  const min=values[0]*factor+(base?.copper||0),max=values.at(-1)*factor+(base?.copper||0);
  const cost=min%100||max%100?`${cp(min)} – ${cp(max)}`:`${(min/100).toLocaleString('en-US')}–${gp(max/100)}`;
  return {...item,cost,priceNote:`${price.rarity}. Depends on the version${base?.copper?`. Includes base cost for ${base.name}`:''}`};
}
