import {REST_REFERENCES} from './rest-reference-data.js';
import {SUBCLASS_ALIASES} from './progression-options.js';
import {referenceURL} from './reference-links.js';

const normalize=value=>String(value||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const same=(a,b)=>normalize(a)===normalize(b);
const matches=(name,rule)=>same(name,rule)||normalize(name).startsWith(normalize(rule)+' ')||normalize(name).endsWith(' '+normalize(rule));
const wiki=path=>'https://dnd2024.wikidot.com/'+path;
const earlier=path=>'https://dnd5e.wikidot.com/'+path;
const restText=text=>/\b(?:long\s+rests?|short\s+(?:or\s+long\s+)?rests?|dawn|dusk|daily|each day|per day|every day)\b/i.test(text);
const shortText=text=>/\bshort\s+(?:or\s+long\s+)?rests?\b/i.test(text);
const specialCooldown=text=>/\b(?:\d+d\d+|[2-9]|seven|several|multiple|consecutive)\s+(?:long\s+rests|days)\b|multi.day|multi.rest/i.test(text);
const restChoice=text=>(text.match(/[^.!?]*\b(?:long rests?|short rests?|short or long rests?)\b[^.!?]*[.!?]?/gi)||[]).some(sentence=>/\b(?:choose|replace|change|roll|create|produce|vanish|expire|disappear|lasts until)\b/i.test(sentence));

// These are original summaries, including choices which abbreviated presets omit.
const summaries={
 'weapon mastery':'Practice weapon drills. Fighter and Barbarian can replace one mastered weapon; Paladin, Ranger, and Rogue can change their selected weapon kinds. Update the mastery notes on your attacks.',
 'wild shape':'You may replace one known Beast form with another form allowed by your Druid level.',
 'wild companion':'A familiar summoned through Wild Companion disappears when you finish this Long Rest.',
 'relentless rage':'Reset the Constitution saving throw DC for Relentless Rage to 10.',
 'persistent rage':'Your once-per-Long-Rest recovery of Rage when rolling Initiative is available again.',
 'aspect of the wilds':'You may change your Aspect of the Wilds choice: Owl, Panther, or Salmon.',
 'circle of the land spells':'Choose arid, polar, temperate, or tropical land, then update your always-prepared Circle spells.',
 'cosmic omen':'Consult your Star Map and roll a die. Record Weal for an even result or Woe for an odd result; your omen uses replenish.',
 'star map':'Your free Guiding Bolt castings replenish. You can also replace a lost Star Map with its rest ceremony.',
 'hunters prey':'You may switch between Colossus Slayer and Horde Breaker.',
 'defensive tactics':'You may switch between Escape the Horde and Multiattack Defense.',
 'primal companion':'You may summon a different Beast of the Land, Sea, or Sky. Replace the previous companion and record the new stat block.',
 'fiendish resilience':'Choose a damage resistance other than Force; record the new resistance.',
 'celestial resilience':'After the rest clears old temporary HP, gain temporary HP equal to Warlock level + Charisma modifier. Up to five eligible allies gain half that amount; apply these benefits manually.',
 'portent':'Roll two d20s (three with Greater Portent at Wizard level 14). Replace your unused foretelling results with the new rolls.',
 'greater portent':'Roll three d20s for Portent and replace the previous foretelling results.',
 'arcane ward':'The previous Arcane Ward ends. You can create a new ward when you next cast an eligible Abjuration spell; it does not refill merely by resting.',
 'overchannel':'Reset the escalating self-damage from Overchannel; your next qualifying use is the first use since resting.',
 'spell mastery':'You may replace one mastered spell with an eligible spell of the same level from your spellbook.',
 'font of magic':'Restore Sorcery Points from the tracked pool. Spell slots created by Flexible Casting disappear; remove any extra slots from your slot maximums.',
 'pact of the tome':'You may conjure a new Book of Shadows, choosing three cantrips and two level 1 Ritual spells you do not already have prepared.',
 'resourceful':'Gain Heroic Inspiration. Turn it on in the character sheet if you do not already have it.',
 'high elf cantrip':'You may replace your lineage cantrip with a different Wizard cantrip. This applies to the 2024 High Elf trait.',
 'crafter':'With the required proficient Artisan’s Tools, make one eligible Fast Crafting item. Your previous Fast Crafting item falls apart.',
 'musician':'You may play a proficient Musical Instrument to grant Heroic Inspiration to a number of allies equal to your Proficiency Bonus.',
 'chef':'With ingredients and Cook’s Utensils, you may make a number of treats equal to your Proficiency Bonus. Record the treats and their expiration.',
 'inspiring leader':'You may give your inspiring performance and grant its temporary HP to up to six eligible creatures. Apply the new temporary HP after clearing old temporary HP.',
 'weapon master':'You may change the weapon kind selected for this feat to another eligible kind; update attack mastery notes.',
 'boon of energy resistance':'You may change the two damage types selected for your Energy Resistances.',
 'bestial soul':'Choose your swimming, climbing, or jumping adaptation for this rest; update movement notes.',
 'whispers of the dead':'Choose the temporary skill or tool proficiency granted by this feature and replace your previous choice.',
 'spirit session':'The spell learned through the previous Spirit Session expires. You may conduct a new qualifying session and record the new spell.',
 'rune carver':'You may replace a known rune and inscribe your known runes on eligible objects. Each object can bear only one rune.',
 'blessing of the forge':'You may bless one eligible nonmagical suit of armor or simple/martial weapon; the previous blessing expires.',
 'experimental elixir':'Produce your free Experimental Elixir(s), rolling for their effects. Unused elixirs from the previous Long Rest disappear. Use the earlier Artificer rules recorded on this sheet.',
 'infuse item':'You may infuse eligible objects using your known infusions, respecting your active infusion limit; decide which existing infusions to replace.',
 'infusing an item':'You may infuse eligible objects using your known infusions, respecting your active infusion limit; decide which existing infusions to replace.',
 'armor model':'With Smith’s Tools, you may switch your Arcane Armor between Guardian and Infiltrator.',
 'spell storing item':'Store an eligible level 1 or 2 Artificer spell in a weapon or spellcasting focus. Record the new spell and its available uses.',
 'steel defender':'You may create a new Steel Defender with Smith’s Tools; doing so replaces the previous defender.',
 'master scriviner':'You may create your special spell scroll using your Wizardly Quill, blank paper, and an eligible spell in your Awakened Spellbook.',
 'lunar embodiment':'You may change your lunar phase and update the associated benefits and free spell casting.',
 'greater divine intervention':'If Divine Intervention cast Wish, it remains unavailable for 2d4 Long Rests. Keep that cooldown separately; a single rest does not always restore it.',
 'one with the word':'Track any 3d6-day loss of spells separately. A single Long Rest does not end this cooldown.'
};

function referenceFor(entry,category,c) {
 const candidates=REST_REFERENCES.filter(r=>(r.category||'feature')===category&&matches(entry.name,r.name));
 return candidates.find(r=>r.className===c.class&&(!r.subclass||same(r.subclass,c.subclass)))||candidates.find(r=>!r.className)||candidates[0];
}
function summary(rule) {
 const custom=summaries[normalize(rule.name)];
 if(custom)return custom;
 if(rule.kind==='dawn')return 'This item recharges at dawn. Check that dawn has occurred, then apply its recharge roll or amount manually; completing a rest alone does not recharge it.';
 if(rule.kind==='cooldown')return 'Check the remaining multi-day or multi-rest cooldown in this rule. Do not automatically restore it after just one rest.';
 if(rule.kind==='recovery')return 'Regain this ability’s eligible expended uses or free castings. Add or update its resource in Features to track recovery automatically.';
 return 'Review this rule’s rest benefits, choices, and expiring effects using the linked reference. Apply choices and effects to the sheet manually.';
}

/** Character-specific choices, untracked recovery, and other manual rest effects. */
export function restReminders(c,kind='long') {
 const result=[],keys=new Set(),isLong=kind==='long';
 const add=(name,detail,url,extra={})=>{
  const key=extra.key||normalize(name);
  if(keys.has(key))return;keys.add(key);
  result.push({key,title:name,detail,wiki:url?referenceURL(url,name,extra.target==='spells'?'spell':extra.target==='inventory'?'equipment':c.class):url,target:'features',...extra});
 };
 const recorded=c.features||[];
 const subclass=Object.entries(SUBCLASS_ALIASES).find(([name])=>same(name,c.subclass))?.[1]||c.subclass;
 const implicit=REST_REFERENCES.filter(r=>r.implicit&&r.className===c.class&&(!r.subclass||same(r.subclass,subclass))&&c.level>=Math.max(r.subclass?3:1,r.level)&&(!r.legacy||r.className==='Artificer'||r.subclass)&&(!r.subclass||r.legacy||!REST_REFERENCES.some(other=>other.legacy&&same(other.subclass,r.subclass))));
 for(const rule of implicit) {
  if(!isLong&&!rule.short)continue;
  if(!isLong&&['wild shape','rune carver'].includes(normalize(rule.name)))continue;
  if(['spellcasting','preparing and casting spells','pact magic','font of inspiration','greater portent'].includes(normalize(rule.name)))continue;
  const feature=recorded.find(f=>matches(f.name,rule.name)||(same(rule.name,'Combat Superiority')&&same(f.name,'Superiority Dice')));
  // A tracked resource already appears in the automatic refresh list. Keep its choices.
  if(feature?.maxUses>0&&feature.reset!=='manual'&&rule.kind==='recovery'&&!summaries[normalize(rule.name)])continue;
  const detail=same(rule.name,'Weapon Mastery')?`${['Fighter','Barbarian'].includes(c.class)?'You may replace one mastered weapon':'You may change your selected weapon kinds'}. Practice weapon drills and update the mastery notes on your attacks.`:same(rule.name,'Portent')&&c.level>=14?'Roll three d20s for Greater Portent. Replace your unused foretelling results with the new rolls.':summary(rule);
  add(rule.name,detail,rule.wiki,feature?{featureId:feature.id}:{});
 }
 if(isLong) {
  const legacyLineage=recorded.some(f=>/2014|legacy|earlier.book/i.test(f.description)&&/lineage|elf|drow|tiefling/i.test(f.name+' '+f.description));
  const prepared=['Cleric','Druid','Wizard','Artificer'].includes(c.class);
  if(prepared)add('Prepared spells',c.class==='Wizard'?'You may change your prepared spells using eligible spells in your spellbook. Keep always-prepared spells selected.':'You may change your prepared spells to eligible spells from your class list. Keep always-prepared spells selected.',c.class==='Artificer'?earlier('artificer'):wiki(c.class.toLowerCase()+':main'),{target:'spells'});
  if(['Paladin','Ranger'].includes(c.class))add('Prepared spells',`You may replace one prepared ${c.class} spell with another eligible ${c.class} spell. Keep always-prepared spells selected.`,wiki(c.class.toLowerCase()+':main'),{target:'spells'});
  if(c.class==='Wizard')add('Wizard cantrip','You may replace one cantrip from Wizard Spellcasting with another Wizard cantrip.',wiki('wizard:main'),{target:'spells'});
  if(same(c.race,'Human'))add('Resourceful',summaries.resourceful,wiki('species:human'));
  if(same(c.race,'High Elf')&&!legacyLineage)add('High Elf cantrip',summaries['high elf cantrip'],wiki('species:elf'),{target:'spells'});
  const extraSpecies={
   Kalashtar:'Choose your temporary skill proficiency from Severed from Dreams; the previous choice expires.',
   Khoravar:'You may replace your Fey Gift cantrip and your Skill Versatility proficiency. Lethargy Resilience instead requires 1d4 Long Rests to recover; track that cooldown separately.',
   Hexblood:'Your Eerie Token expires. You may create a new token, and your free Hex Magic castings replenish.',
   Duskling:'Choose your Inner Magic benefit: Ardor, Mobility, or Vigor. Restore its limited switches and apply the chosen benefit to your sheet.'
  };
  if(extraSpecies[c.race])add(c.race+' traits',extraSpecies[c.race],wiki('species:'+normalize(c.race)));
  const species={Aasimar:[[1,'Healing Hands'],[3,'Celestial Revelation']],Dragonborn:[[1,'Breath Weapon'],[5,'Draconic Flight']],Dwarf:[[1,'Stonecunning']],Goliath:[[1,'Giant Ancestry'],[5,'Large Form']],Orc:[[1,'Adrenaline Rush'],[1,'Relentless Endurance']], 'Half-Orc':[[1,'Relentless Endurance']], 'Forest Gnome':[[1,'Speak with Animals (lineage)']]};
  for(const [level,name] of species[c.race]||[])if(c.level>=level&&!recorded.some(f=>matches(f.name,name)&&f.maxUses>0&&f.reset!=='manual'))add(name,'Your species trait’s expended uses replenish. Record the uses in Features if this trait is not already tracked.',c.race==='Half-Orc'?earlier('half-orc'):wiki('species:'+normalize(c.race).split(' ').pop()));
  const lineage={Drow:['Faerie Fire','Darkness'],'High Elf':['Detect Magic','Misty Step'],'Wood Elf':['Longstrider','Pass without Trace'],'Abyssal Tiefling':['Ray of Sickness','Hold Person'],'Chthonic Tiefling':['False Life','Ray of Enfeeblement'],'Infernal Tiefling':['Hellish Rebuke','Darkness']};
  // New sheets follow 2024; explicitly recorded older lineage rules take precedence.
  for(const [index,name] of (lineage[c.race]||[]).entries())if(!legacyLineage&&c.level>=(index?5:3)&&!recorded.some(f=>normalize(f.name).includes(normalize(name))&&f.maxUses>0&&f.reset!=='manual'))add(name+' (lineage)','Your free 2024 lineage casting is available again. Keep its spell and any separately tracked feature use in sync.',wiki('species:'+(c.race.includes('Tiefling')?'tiefling':'elf')));
  const speciesRule=REST_REFERENCES.find(r=>r.category==='species'&&same(r.name,c.race));
  if(speciesRule&&!species[c.race]&&!extraSpecies[c.race]&&!['Human','High Elf','Wood Elf','Drow'].includes(c.race))add(c.race+' traits','Review your species’ rest-based recovery, rest duration, choices, and expiring effects. Update any benefits not already tracked in Features.',speciesRule.wiki);
 }
 for(const feature of recorded) {
  if(['spellcasting','pact magic','preparing and casting spells'].includes(normalize(feature.name)))continue;
  const rule=referenceFor(feature,'feature',{...c,subclass});
  const text=feature.description||'';
  if(!isLong&&!shortText(text)&&!rule?.short)continue;
  if(!restText(text)&&!rule)continue;
  const existing=result.find(r=>matches(feature.name,r.title));
  if(existing){existing.featureId=feature.id;continue;}
  if(feature.maxUses>0&&feature.reset!=='manual'&&(!rule||rule.kind==='recovery')&&!restChoice(text)&&!specialCooldown(text)&&!summaries[normalize(rule?.name)])continue;
  const cooldown=specialCooldown(text);
  add(feature.name,cooldown?'Check this feature’s multi-day or multi-rest cooldown before restoring it. '+text:rule?summary(rule):text,feature.wiki||rule?.wiki,{featureId:feature.id,key:'feature:'+feature.id});
 }
 for(const [category,entries,target] of [['spell',c.spells||[],'spells'],['item',(c.items||[]).filter(i=>i.qty>0),'inventory']])for(const entry of entries) {
  const rule=referenceFor(entry,category,c),text=entry.description||entry.notes||'';
  if(!rule&&!restText(text))continue;
  if(category==='spell'&&!rule&&recorded.some(f=>normalize(f.name).includes(normalize(entry.name))&&f.maxUses>0&&f.reset!=='manual'))continue;
  if(!isLong&&!rule?.short&&!shortText(text))continue;
  const detail=category==='item'?(rule?.kind==='dawn'||rule?.dawn||/dawn/i.test(text)?summary({kind:'dawn'}):'Review this item’s rest-based recharge, choices, and expiring effects. Apply any recharge roll manually.'):'Review this spell’s interaction with rest, including any daily casting limits, recovery, penalties, or companion benefits. Resting does not automatically recast the spell.';
  add(entry.name,detail,entry.wiki||rule?.wiki,{key:category+':'+entry.id,target});
 }
 if(isLong&&c.conditions.length)add('Conditions','Your recorded conditions stay in place. Remove a condition only if its own effect says this rest ends it.',wiki('rules-glossary'),{target:'conditions'});
 if(isLong)add('Reduced maximum HP & ability scores','If an effect restores reduced maximum HP or ability scores after this rest, update those values in the sheet. Check the effect’s rules first.',wiki('rules-glossary'),{target:'stats'});
 return result;
}

/** Exact before/after values for the model’s automatic recovery, without mutation. */
export function restRefreshes(c,{kind='long',reduceExhaustion=true,skipFeatureIds=[]}={}) {
 const rows=[],long=kind==='long';
 const add=(key,title,before,after,detail='')=>rows.push({key,title,before,after,detail});
 if(long) {
  add('hp','Hit points',c.hp,c.maxHp);
  add('hit-dice','Hit Dice',c.hitDice,c.level,`d${c.hitDie} available`);
  add('temp-hp','Temporary hit points',c.tempHp,0);
  add('exhaustion','Exhaustion',c.exhaustion,reduceExhaustion?Math.max(0,c.exhaustion-1):c.exhaustion,reduceExhaustion?'Remove one level if eligible':'Recovery disabled');
  add('concentration','Concentration',c.concentration||'None','None');
  add('death-saves','Death saves',`${c.deathSuccess} successes / ${c.deathFailure} failures`,'0 successes / 0 failures');
 }
 if(long||(c.class==='Warlock'&&c.pactMagic===true))c.slots.forEach((slot,index)=>{if(slot.max)add('slot-'+index,`${c.pactMagic?'Pact Magic · ':''}Level ${index+1} spell slots`,slot.max-slot.used,slot.max);});
 for(const f of c.features) {
  if(!f.maxUses||f.reset==='manual'||(!long&&f.reset!=='short'&&!f.shortRestRecovery))continue;
  const used=skipFeatureIds.includes(f.id)?f.used:long||f.reset==='short'?0:Math.max(0,f.used-f.shortRestRecovery);
  rows.push({key:'feature:'+f.id,title:f.name,before:f.maxUses-f.used,after:f.maxUses-used,detail:`of ${f.maxUses} uses available`,featureId:f.id,cooldown:specialCooldown(f.description||'')||referenceFor(f,'feature',c)?.kind==='cooldown'||same(f.name,'Lethargy Resilience')||same(f.name,'Greater Divine Intervention')||(c.class==='Cleric'&&c.level>=20&&same(f.name,'Divine Intervention'))});
 }
 return rows;
}
