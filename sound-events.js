// Semantic gameplay events. Asset IDs and provenance live in the curated manifest.
const event=(category,variants,gain=1,cooldown=100)=>({category,variants,gain,cooldown});
export const SOUND_CATEGORIES={dice:'Dice & checks',combat:'Combat',magic:'Magic & healing',status:'Status effects',progression:'Progression & rests',inventory:'Inventory & books',interface:'Confirmations & errors',ambient:'Campfire ambience'};
export const SOUND_EVENTS={
  'dice.roll':event('dice',['die-1','die-2','die-3'],.8),
  'dice.multiple':event('dice',['dice-1','dice-2','dice-3','dice-shake'],.8),
  'dice.check':event('dice',['die-1','die-3'],.8),
  'dice.critical':event('progression',['pizzi-12'],.7,400),
  'dice.failure':event('interface',['error'],.45,400),
  'combat.sword':event('combat',['swing-sword','swing-light'],.75),
  'combat.heavy':event('combat',['swing-heavy'],.75),
  'combat.dagger':event('combat',['dagger-1','dagger-2'],.75),
  'combat.bow':event('combat',['bow-release'],.8),
  'combat.throw':event('combat',['swing-light'],.7),
  'combat.blunt':event('combat',['blunt-1','blunt-2'],.65),
  'combat.unarmed':event('combat',['punch-1','punch-2'],.65),
  'combat.hit':event('combat',['metal-1','metal-2','chop'],.6),
  'combat.arrow-hit':event('combat',['arrow-impact'],.7),
  'combat.miss':event('combat',['swing-light','swing-sword'],.6),
  'combat.critical':event('combat',['metal-2'],.85,250),
  'combat.damage':event('combat',['punch-1','punch-2'],.8,150),
  'condition.apply':event('status',['condition-apply'],.55,150),
  'condition.clear':event('status',['condition-clear'],.5,150),
  'magic.cast':event('magic',['spell-cast-1','spell-cast-2'],.55,220),
  // Dedicated fire/dark recordings are a documented gap; use the neutral cast cue.
  'magic.fire':event('magic',['spell-cast-1'],.55,220),
  'magic.ice':event('magic',['ice-cast'],.6,220),
  'magic.lightning':event('magic',['lightning-cast'],.45,220),
  'magic.radiant':event('magic',['magic-chime'],.5,220),
  'magic.dark':event('magic',['spell-cast-2'],.5,220),
  'magic.heal':event('magic',['healing-cast'],.55,220),
  'magic.protect':event('magic',['magic-chime'],.45,220),
  'magic.fizzle':event('magic',['error'],.4,250),
  'progression.xp':event('progression',['gain-xp'],.55,250),
  'progression.level':event('progression',['level-up'],.8,1000),
  'resource.restore':event('progression',['pizzi-10'],.5,200),
  'inspiration.gain':event('progression',['inspiration'],.6,250),
  'inspiration.spend':event('progression',['inspiration'],.55,250),
  'rest.short':event('progression',['short-rest'],.6,500),
  'rest.long':event('progression',['long-rest'],.65,500),
  'rest.campfire':event('ambient',['campfire'],.3,250),
  'item.potion':event('inventory',['potion-bottle','potion-bubble'],.75,180),
  'item.equip':event('inventory',['equip-latch'],.65),
  'item.equip.weapon':event('inventory',['equip-sword'],.65),
  'item.equip.dagger':event('inventory',['equip-blade'],.65),
  'item.equip.bow':event('inventory',['equip-bow'],.65),
  'item.equip.wood':event('inventory',['equip-wood'],.65),
  'item.equip.metal':event('inventory',['equip-metal'],.65),
  'item.equip.shield':event('inventory',['equip-shield'],.55),
  'item.equip.armor':event('inventory',['equip-armor'],.65),
  'item.equip.leather':event('inventory',['equip-leather'],.65),
  'item.equip.cloth':event('inventory',['pack-cloth'],.65),
  'item.equip.pack':event('inventory',['pack-leather'],.65),
  'item.equip.potion':event('inventory',['potion-bottle'],.65),
  'item.equip.book':event('inventory',['equip-book'],.65),
  'item.equip.scroll':event('inventory',['page-1'],.65),
  'item.equip.coin':event('inventory',['coins-1'],.65),
  'item.equip.jewelry':event('inventory',['equip-jewelry'],.65),
  'item.equip.focus':event('inventory',['magic-chime'],.45),
  'item.coin':event('inventory',['coins-1','coins-2'],.65),
  'item.acquire':event('inventory',['pack-leather','pack-cloth'],.65),
  'item.consume':event('inventory',['pack-leather'],.6),
  'book.open':event('inventory',['book-open'],.65,220),
  'book.close':event('inventory',['book-close'],.65,220),
  'book.page':event('inventory',['page-1','page-2'],.6,200),
  'ui.confirm':event('interface',['confirm'],.5,180),
  'ui.error':event('interface',['error'],.45,300)
};

export function equipSoundEvent(item={}){
  // Catalog magic items keep their base type in this header. Ignore effect text
  // and decorative icon choices, which can mention or depict unrelated gear.
  const rules=String(item.typeDetails||String(item.description||'').match(/^Rules: (?:2024|2014)\.\s*([^\n]+)/)?.[1]||'');
  const name=String(item.name||'').toLowerCase(),base=rules.match(/^(?:Weapon|Armor)\s*\(([^)]+)\)/i)?.[1];
  const equipmentType=base&&!/\b(any|or)\b/i.test(base)?base.toLowerCase():name;
  const type=(rules.split(',')[0]+' '+name).toLowerCase();
  if(item.category==='Weapon'){
    if(/\b(shortbow|longbow|crossbow|bow)\b/.test(equipmentType))return 'item.equip.bow';
    if(/\b(sling|whip)\b/.test(equipmentType))return 'item.equip.pack';
    if(/\b(dagger|knife|sickle)\b/.test(equipmentType))return 'item.equip.dagger';
    if(/\b(quarterstaff|staff|greatclub|club|wooden|blowgun|javelin|spear|pike)\b/.test(equipmentType))return 'item.equip.wood';
    if(/\b(warhammer|hammer|mace|maul|morningstar|flail|pick|axe|battleaxe|greataxe|handaxe|halberd|glaive|trident|pistol|musket|firearm)\b/.test(equipmentType))return 'item.equip.metal';
    return 'item.equip.weapon';
  }
  if(item.category==='Armor'){
    if(/\b(shield|buckler)\b/.test(equipmentType))return 'item.equip.shield';
    if(/\b(leather|hide)\b/.test(equipmentType))return 'item.equip.leather';
    if(/\bpadded\b/.test(equipmentType))return 'item.equip.cloth';
    return 'item.equip.armor';
  }
  if(/\b(potion|bottle|flask|vial|elixir|antitoxin|perfume|oil)\b/.test(type))return 'item.equip.potion';
  if(/\b(scroll|parchment|paper|map)\b/.test(type))return 'item.equip.scroll';
  if(/\b(spellbook|book|tome|manual|grimoire)\b/.test(type))return 'item.equip.book';
  if(/\b(backpack|bag|pouch|purse|satchel|belt|boots|shoes|slippers|gloves|leather)\b/.test(type))return 'item.equip.pack';
  if(/\b(coins?|(?:gold|silver|copper|platinum|electrum) pieces?)\b/.test(type))return 'item.equip.coin';
  if(/\b(rings?|amulet|necklace|pendant|brooch|bracelet|circlet|diadem|earrings?|beads?|gems?|jewels?)\b/.test(type))return 'item.equip.jewelry';
  if(/\b(cloak|robe|clothes|clothing|shirt|tunic|cape|vestments?|blanket|bedroll|tent|hat|cap)\b/.test(type))return 'item.equip.cloth';
  if(/\b(shield|buckler)\b/.test(name))return 'item.equip.shield';
  if(/\b(wand|rod|staff|focus|orb|crystal|holy symbol|reliquary)\b/.test(type))return 'item.equip.focus';
  if(/\b(gauntlets?|helm|helmet|crowbar|chain|manacles|pitons?|lock|key|bell|bucket|pot|pan|tools?)\b/.test(name))return 'item.equip.metal';
  if(/\b(wooden|torch|arrows?|bolts?|lute|lyre|flute|viol|drum)\b/.test(name))return 'item.equip.wood';
  if(item.category==='Treasure')return 'item.equip.jewelry';
  if(item.category==='Consumable')return 'item.equip.pack';
  return 'item.equip';
}

export function rollSoundEvent(result,label=''){
  if(!result?.rolls?.length)return null; // Fixed damage isn't a dice roll.
  if(result.rolls.length>1)return 'dice.multiple';
  return /check|sav(e|ing)|initiative/i.test(label)?'dice.check':'dice.roll';
}
export function rollFeedbackSoundEvent(result,criticalFeedback=true){
  if(criticalFeedback&&result.natural===20)return 'dice.critical';
  return result.natural===1?'dice.failure':null;
}

export function partyStatusSoundEvent(activity,spell){
  switch(activity.kind){
    case 'damage':return 'combat.damage';
    case 'healing':return 'magic.heal';
    case 'inspiration':return 'inspiration.gain';
    case 'condition':{
      const text=activity.text||'';
      if(text.startsWith('concentrates on '))return spellSoundEvent(spell||{name:text.slice('concentrates on '.length)});
      if(text==='ends concentration')return null;
      return /^(?:clears |Exhaustion decreases )/.test(text)?'condition.clear':'condition.apply';
    }
    default:return null;
  }
}
export function spellSoundEvent(spell={}){
  // Names are more specific than a broad school; don't infer damage from notes.
  const name=String(spell.name||'').toLowerCase();
  if(/heal|cure|healing word|restoration|revivify|regenerat|spare the dying|life transference/.test(name))return 'magic.heal';
  if(/radiant|sacred|holy|guiding bolt|sunbeam|sunburst|divine|word of radiance/.test(name))return 'magic.radiant';
  if(/\b(fire|flame|burning|scorching|meteor|hellish|searing)\b|fireball|firebolt/.test(name))return 'magic.fire';
  if(/\b(ice|cold|frost|snow|sleet|freez|freezing|blizzard)\b|frostbite/.test(name))return 'magic.ice';
  if(/lightning|thunder|shocking|witch bolt|storm/.test(name))return 'magic.lightning';
  if(/necrotic|vampiric|blight|wither|inflict|finger of death|chill touch|toll the dead|animate dead/.test(name))return 'magic.dark';
  if(/shield|protect|ward|armor|armour|sanctuary|resistance|bless|aid|barkskin|stoneskin/.test(name))return 'magic.protect';
  if(/^abjuration$/i.test(spell.school||''))return 'magic.protect';
  return 'magic.cast';
}
export function weaponSoundEvent(attack={},weapon=null,{ranged=false,outcome=null,phase='attack'}={}){
  if(outcome==='miss')return 'combat.miss';
  const name=String(weapon?.name||attack.name||'').toLowerCase();
  const bow=/bow|sling/.test(name);
  // Only confirmed hits use impact cues, including custom unknown attacks.
  if(phase==='impact'||phase==='damage'){
    if(!['hit','critical'].includes(outcome))return null;
    if(outcome==='critical')return 'combat.critical';
    if(bow&&ranged)return 'combat.arrow-hit';
    if(/unarmed|fist|punch|kick|claw|bite/.test(name))return 'combat.unarmed';
    if(/bludgeoning/i.test(attack.type||'')||/mace|club|hammer|staff|maul|flail/.test(name))return 'combat.blunt';
    return 'combat.hit';
  }
  if(bow)return 'combat.bow';
  if(ranged)return 'combat.throw';
  if(/dagger|knife/.test(name))return 'combat.dagger';
  if(weapon?.properties?.includes('Heavy')||/great|maul|heavy|halberd|glaive|pike/.test(name))return 'combat.heavy';
  // An unconfirmed unarmed/blunt attack gets movement rather than an impact.
  return 'combat.sword';
}
