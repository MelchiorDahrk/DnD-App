export const CLASSES = {Artificer:8,Barbarian:12,Bard:8,Cleric:8,Druid:8,Fighter:10,Monk:8,Paladin:10,Ranger:10,Rogue:8,Sorcerer:6,Warlock:8,Wizard:6};

export function characterClasses(character) {
  const additional=character.multiclass||[];
  return [{class:character.class,subclass:character.subclass,level:(character.level??1)-additional.reduce((sum,row)=>sum+row.level,0)},...additional];
}

export const characterClass = (character,name=character.class) => characterClasses(character).find(row=>row.class===name);
export const characterClassLevel = (character,name) => characterClass(character,name)?.level??0;
export const characterSubclass = (character,name) => characterClass(character,name)?.subclass||'';
export const totalClassLevel = rows => rows.reduce((sum,row)=>sum+row.level,0);
export const classBreakdown = character => characterClasses(character).map(row=>`${row.class} ${row.level}`).join(' / ');

// Retain the existing primary die override. Additional classes use their class die.
export const classHitDie = (character,name) => name===character.class ? character.hitDie : CLASSES[name];

export function advanceClass(character,className,subclass) {
  if(className===character.class)return {level:character.level+1,subclass};
  const additional=character.multiclass||[];
  const multiclass=additional.some(row=>row.class===className)
    ?additional.map(row=>row.class===className?{...row,level:row.level+1,subclass}:row)
    :[...additional,{class:className,level:1,subclass}];
  return {level:character.level+1,multiclass};
}

const primaryAbilities={
  Artificer:[['int']],Barbarian:[['str']],Bard:[['cha']],Cleric:[['wis']],Druid:[['wis']],
  Fighter:[['str','dex']],Monk:[['dex'],['wis']],Paladin:[['str'],['cha']],Ranger:[['dex'],['wis']],
  Rogue:[['dex']],Sorcerer:[['cha']],Warlock:[['cha']],Wizard:[['int']]
};

export function multiclassRequirements(character,className) {
  return [...new Set([...characterClasses(character).map(row=>row.class),className])].flatMap(name=>
    primaryAbilities[name].filter(group=>!group.some(ability=>character.stats[ability]>=13)).map(abilities=>({class:name,abilities})));
}

export function hitDicePools(character) {
  const maxima=new Map();
  for(const row of characterClasses(character)){
    const die=classHitDie(character,row.class);
    maxima.set(die,(maxima.get(die)||0)+row.level);
  }
  let spent=character.level-character.hitDice;
  return [...maxima].map(([die,max])=>{
    const used=Math.min(max,spent);
    spent-=used;
    return {die,max,available:character.hitDicePools?.[die]??max-used};
  });
}

export function setHitDicePools(character,pools) {
  character.hitDice=pools.reduce((sum,pool)=>sum+pool.available,0);
  if(character.multiclass?.length||pools.length>1)character.hitDicePools=Object.fromEntries(pools.map(pool=>[pool.die,pool.available]));
  else delete character.hitDicePools;
}

export function reconcileHitDice(character,previousPools) {
  const pools=hitDicePools(character);
  let unassigned=previousPools.reduce((sum,pool)=>sum+pool.max-pool.available,0);
  for(const pool of pools){
    const old=previousPools.find(row=>row.die===pool.die);
    const spent=Math.min(pool.max,old?old.max-old.available:0);
    pool.available=pool.max-spent;
    unassigned-=spent;
  }
  for(const pool of pools){
    const spent=Math.min(pool.available,unassigned);
    pool.available-=spent;
    unassigned-=spent;
  }
  setHitDicePools(character,pools);
}

export function validHitDicePools(character) {
  const stored=character.hitDicePools;
  if(stored===undefined)return true;
  if(!stored||typeof stored!=='object'||Array.isArray(stored))return false;
  const pools=hitDicePools(character);
  return Object.keys(stored).length===pools.length&&pools.every(({die,max})=>
    Number.isInteger(stored[die])&&stored[die]>=0&&stored[die]<=max)&&
    pools.reduce((sum,pool)=>sum+pool.available,0)===character.hitDice;
}
