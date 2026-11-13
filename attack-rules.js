// Attack helpers for the 2024 rules. Summaries and sources: docs/attacks.md.
import {attackBonus,mod,proficiency,randomDie,rollDice,signed} from './model.js';
import {WEAPONS} from './catalog.js';

export const MASTERIES=['Cleave','Graze','Nick','Push','Sap','Slow','Topple','Vex'];
export function attackWeapon(a) {
  if(a.weaponId!==undefined)return WEAPONS.find(w=>w.id===a.weaponId)||null;
  // Word boundaries prevent a custom "shadowblade" from becoming a longsword.
  const name=a.name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  return [...WEAPONS].sort((a,b)=>b.name.length-a.name.length).find(w=>` ${name} `.includes(` ${w.name.toLowerCase()} `))||null;
}
export function attackMastery(c,a) {
  if(a.mastery!==undefined)return a.mastery;
  const weapon=attackWeapon(a);
  if(!weapon)return '';
  // Old saves have no structured choices. Only a recorded choice unlocks mastery;
  // a weapon's catalog description or class alone never grants it.
  const choice=`${weapon.name} (${weapon.mastery})`.toLowerCase();
  return c.features.some(f=>/^weapon mastery\b/i.test(f.name)&&f.description.toLowerCase().includes(choice))?weapon.mastery:'';
}
export const hasWeaponProperty=(a,property)=>attackWeapon(a)?.properties.includes(property)||false;
export const toppleDC=(c,a)=>8+mod(c.stats[a.ability])+proficiency(c.level);
export function resolveRollMode(advantage,disadvantage) {
  return advantage===disadvantage?'normal':advantage?'advantage':'disadvantage';
}
export function attackContext(c,a,options={}) {
  const weapon=attackWeapon(a),ranged=options.kind==='ranged'||(!options.kind&&weapon?.family.endsWith('ranged'));
  const advantages=[],disadvantages=[],warnings=[];
  if(!options.override&&a.rollMode==='advantage')advantages.push('Saved attack advantage');
  if(!options.override&&a.rollMode==='disadvantage')disadvantages.push('Saved attack disadvantage');
  if(options.advantage)advantages.push('Situational advantage');
  if(options.disadvantage)disadvantages.push('Situational disadvantage');
  if(!options.override){
    if(weapon?.properties.includes('Heavy')&&c.stats[weapon.family.endsWith('ranged')?'dex':'str']<13)disadvantages.push('Heavy: ability score below 13');
    for(const condition of ['Blinded','Poisoned','Prone','Restrained'])if(c.conditions.includes(condition))disadvantages.push(condition);
    if(c.conditions.includes('Frightened')&&options.fearVisible)disadvantages.push('Frightened: source in line of sight');
    if(ranged&&options.closeEnemy)disadvantages.push('Enemy within 5 ft.');
  }
  const range=a.range.match(/(\d+)\s*\/\s*(\d+)/)||weapon?.properties.match(/(\d+)\s*\/\s*(\d+)/);
  const singleRange=a.range.match(/^\s*(\d+)\s*ft/i)?.[1];
  const reach=Number(singleRange||(weapon?.properties.includes('Reach')?10:5));
  let blocked='';
  if(options.distance!==''&&options.distance!==undefined){
    const distance=Number(options.distance);
    if(!Number.isFinite(distance)||distance<0)throw new Error('Enter a nonnegative distance.');
    if(ranged&&range){
      if(distance>Number(range[2]))blocked='Target is beyond the weapon’s long range.';
      else if(distance>Number(range[1])&&!options.override)disadvantages.push('Long range');
    }else if(ranged&&singleRange&&distance>Number(singleRange))blocked='Target is beyond this attack’s range.';
    else if(!ranged&&distance>reach)blocked='Target is beyond this attack’s reach.';
  }
  if(options.cover==='total')blocked='Total cover prevents targeting directly.';
  const unable=c.conditions.find(v=>['Incapacitated','Paralyzed','Petrified','Stunned','Unconscious'].includes(v));
  if(unable)blocked=`${unable}: you cannot make attacks.`;
  if(options.override)warnings.push('Feature / DM exception: only the selected situational advantage / disadvantage applies.');
  if(weapon?.properties.includes('Ammunition'))warnings.push('Check ammunition and a free loading hand; expend one piece per attack. Inventory quantities may be bundles.');
  if(weapon?.properties.includes('Loading'))warnings.push('Loading: one shot per action, Bonus Action, or Reaction, even with Extra Attack.');
  if(weapon?.properties.includes('Two-Handed')||options.twoHanded)warnings.push('Check both hands are free; a wielded shield can conflict. Lance: mounted exception applies.');
  if(weapon?.properties.includes('Finesse'))warnings.push('Finesse uses the same ability for accuracy and damage; check your saved damage modifier.');
  if(c.conditions.includes('Frightened'))warnings.push('Frightened attack disadvantage applies only while the source of fear is in line of sight.');
  return {weapon,ranged,advantages,disadvantages,warnings,blocked,mode:resolveRollMode(advantages.length>0,disadvantages.length>0),bonus:attackBonus(c,a),coverBonus:options.cover==='half'?2:options.cover==='three-quarters'?5:0};
}
export function attackOutcome(result,ac,coverBonus=0) {
  if(result.natural===1)return 'miss';
  if(result.natural===20)return 'critical';
  return ac===''||ac===undefined?null:result.total>=Number(ac)+coverBonus?'hit':'miss';
}
export function damageFormula(c,a,{twoHanded=false,omitAbility=false,keepAbility=false}={}) {
  let expression=a.damage.toLowerCase().replace(/\s/g,'');
  const versatile=attackWeapon(a)?.properties.match(/Versatile \((\d+d\d+)\)/)?.[1];
  if(twoHanded&&versatile)expression=expression.replace(/^\d*d\d+/,versatile);
  if(omitAbility&&!keepAbility){
    const remove=Math.max(0,mod(c.stats[a.ability]));
    if(/^\d+$/.test(expression))return String(Math.max(0,Number(expression)-remove));
    const match=expression.match(/^(\d*d\d+)([+-]\d+)?$/);
    if(match){const bonus=Number(match[2]||0)-remove;expression=match[1]+(bonus?signed(bonus):'');}
  }
  return expression;
}
export function rollAttackDamage(expression,critical=false,roller=randomDie) {
  const result=rollDice(expression,'normal',roller);
  if(critical&&result.rolls.length){
    const match=result.expression.match(/^(\d*)d(\d+)/),count=Number(match[1]||1),sides=Number(match[2]);
    const extra=Array.from({length:count},()=>roller(sides));
    result.rolls.push(...extra);result.total+=extra.reduce((sum,n)=>sum+n,0);
    result.expression=`${count*2}d${sides}${result.bonus?signed(result.bonus):''}`;
  }
  result.total=Math.max(0,result.total);result.natural=null;
  return result;
}
export function rerollAttackDie(result,index,roller=randomDie) {
  if(!Number.isInteger(index)||index<0||index>=result.rolls.length)throw new Error('Choose one attack die to reroll.');
  const rolls=[...result.rolls];rolls[index]=roller(20);
  const natural=result.mode==='advantage'?Math.max(...rolls):result.mode==='disadvantage'?Math.min(...rolls):rolls[0];
  return {...result,rolls,natural,total:natural+result.bonus};
}
export function attackDamageFeatures(c,a) {
  return c.features.filter(f=>f.rollFormula&&(/superiority dice|colossus slayer|radiant strikes/i.test(f.name)||(/sneak attack/i.test(f.name)&&(hasWeaponProperty(a,'Finesse')||attackWeapon(a)?.family.endsWith('ranged')))));
}
