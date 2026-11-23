import {spellScrollPrice} from './magic-item-prices.js';

const tokenEffects={
  Anchor:'As a Magic action, touch a vessel with the token to hold it in place for up to 24 hours. Touch the vessel again with the token to end the effect early. The token then disappears.',
  Bird:'As a Magic action, toss the token into the air to summon a nonattacking Roc that follows simple commands. It carries 500 pounds at 16 mph or 1,000 pounds at half speed. It rests an hour for every 3 hours of flight and disappears after flying 144 miles in a day, at 0 HP, or when dismissed as a Magic action.',
  Fan:'As a Magic action aboard a boat or ship, toss the token into the air. The fan it creates adds 5 mph to the vessel’s speed for 8 hours. You can dismiss it early as a Magic action.',
  'Swan Boat':'As a Magic action, touch the token to water at least 60 feet across to create a 50-by-20-foot boat. From aboard, use a Magic action to make it travel at 6 mph or turn up to 90 degrees. It lasts 24 hours and can be dismissed as a Magic action.',
  Tree:'As a Magic action outdoors, touch the token to an unoccupied space on the ground to grow an ordinary 60-foot oak. Its trunk is 5 feet across and its upper branches spread 20 feet from the trunk.',
  Whip:'As a Magic action, throw the token to a point within 10 feet to create a floating whip. As a Bonus Action, make a melee spell attack (+9) from the whip against a creature within 10 feet of it. On a hit, deal 1d6 + 5 Force damage. On later turns that Bonus Action can also move the whip up to 20 feet. It vanishes after 1 hour, when dismissed as a Magic action, or if you die or become Incapacitated.'
};
const hornRarity={Silver:'Rare',Brass:'Rare',Bronze:'Very Rare',Iron:'Legendary'};

// Only tables that describe a permanent item version belong here. Tables
// rolled on activation (for example, the Wand of Wonder) stay in the rules.
const acquisitionTables={
  'armor-of-resistance':'Damage Type',
  'potion-of-resistance':'Damage Type',
  'ring-of-resistance':'Damage Type',
  'scroll-of-protection':'Creature Type',
  'scroll-of-titan-summoning':'Titan',
  'ammunition-of-slaying':'Creature Type',
  'trick-weapon':'The Weapon Transforms Into A …',
  'carpet-of-flying':'Size',
  'horn-of-valhalla':'Horn Type',
  'manual-of-golems':'Golem',
  'quaal-s-feather-token':'Token'
};

const choiceTables={
  'belt-of-giant-strength':'Belt',
  'potion-of-giant-strength':'Potion',
  'potion-of-mana':'Potion',
  'potion-of-rejuvenation':'Potion',
  'troll-s-blood-elixir':'Potion',
  'instrument-of-the-bards':'Instrument',
  'necklace-of-the-beastly-familiar':'Gemstone',
  '2014-potion-of-mind-control':'Potion of …',
  '2014-sages-signet':'Signet',
  'spell-scroll':'Spell Level'
};
const slug=text=>text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function diceRange(text,sides) {
  if(!sides)return [];
  const [first,last=first]=text.split(/\s*[-–—]\s*/).map(value=>value==='00'&&sides===100?100:Number(value));
  return [first,last];
}

function tableChoices(item,heading) {
  const table=item.tables.find(([headers])=>headers.includes(heading));
  if(!table)return null;
  const [headers,...rows]=table;
  const sides=heading===acquisitionTables[item.id.slice(6)]?Number(/^1?d(\d+)$/i.exec(headers[0])?.[1]):0;
  const labelColumn=headers.indexOf(heading),rarityColumn=headers.indexOf('Rarity');
  const columns=headers.map((_,i)=>i).filter(i=>!(sides&&i===0)&&i!==rarityColumn);
  const choices=rows.filter(row=>row[labelColumn]!=='All').flatMap(row=>{
    const [min,max]=diceRange(row[0],sides);
    return row[labelColumn].split(/ or (?=(?:Belt|Potion) of )/).map(value=>{
      const level=heading==='Spell Level'?(value==='Cantrip'?0:Number(value)):null;
      const form=value.match(/ \(([^)]+)\)$/)?.[1];
      let label=value;
      if(level!==null)label=level===0?'Cantrip':`Level ${level}`;
      if(value===item.name)label='Standard';
      if(form&&(value.startsWith(item.name)||item.id==='magic-2014-potion-of-mind-control'))label=form[0].toUpperCase()+form.slice(1);
      if(heading==='Titan')label=value.split(' (')[0];
      const title=label==='Standard'?item.name:`${item.name} (${label})`;
      const rarity=heading==='Horn Type'?hornRarity[label]:item.rarities.find(r=>r.toLowerCase()===row[rarityColumn]?.toLowerCase());
      return {
        label,title,rarity,min,max,
        ...(level!==null?spellScrollPrice(level):{}),
        ...(heading==='Token'?{details:tokenEffects[label],category:'Consumable',actionType:'action'}:{}),
        ...(item.id==='magic-ammunition-of-slaying'?{category:'Consumable'}:{}),
        ...(item.id==='magic-trick-weapon'?{details:`${item.details} This weapon’s mundane form is ${label.toLowerCase()}.`}:{}),
        tables:[[columns.map(i=>headers[i]),columns.map(i=>i===labelColumn&&heading!=='Titan'?value:row[i])]]
      };
    });
  });
  return {sides,choices};
}

function variantChoices(item) {
  const key=item.id.slice(6),heading=acquisitionTables[key]||choiceTables[key];
  if(heading)return tableChoices(item,heading);
  if(key==='armor-of-vulnerability'){
    return {sides:3,choices:['Bludgeoning','Piercing','Slashing'].map((label,index)=>({
      label,min:index+1,max:index+1,details:`This armor gives you Resistance to ${label} damage while you wear it. Identify or attuning reveals the curse. Attuning gives you Vulnerability to the other two physical damage types, even if you remove the armor. Remove Curse or similar magic can end the curse.`
    }))};
  }
  if(key==='bag-of-tricks'){
    return {choices:['Gray','Rust','Tan'].map((label,index)=>({label,tables:[item.tables[index]]}))};
  }
  return null;
}

export function buildMagicItemVariants(items,priceItem) {
  const families=new Map();
  for(const item of items){
    const family=variantChoices(item);
    if(!family)continue;
    const choices=family.choices.map(({label,title,rarity,min,max,...overrides})=>{
      const choice=priceItem({
        ...item,id:`${item.id}-${slug(label)}`,parentId:item.id,name:title||`${item.name} (${label})`,
        ...(rarity?{rarities:[rarity],rarity,typeDetails:`${item.itemType}, ${rarity}${item.attunement==='Not required'?'':` (${item.attunement})`}`}:{}),
        ...overrides
      });
      return {label,min,max,entry:choice};
    });
    families.set(item.id,{sides:family.sides,choices});
  }
  return families;
}

export function variantForRoll(family,total) {
  return family.choices.find(({min,max})=>total>=min&&total<=max);
}
