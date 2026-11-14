export const ACTION_TYPES = {action:'Action',bonus:'Bonus Action',reaction:'Reaction',free:'No action',passive:'Passive',special:'Special'};

// Only infer activation from explicit timing language, never from spell effects.
export function actionTiming(entry,kind) {
  if (entry.actionType) return entry.actionType;
  if (kind==='attack') return 'action';
  if (kind==='item' && /^potion of healing$/i.test(entry.name)) return 'bonus';
  const text=kind==='spell'?entry.castingTime:entry.description;
  if (!text) return '';
  if (/^(?:1\s+)?bonus action\b/i.test(text) || /\b(?:as|use|take|spend) (?:a |an |your )?bonus action\b/i.test(text) || /\bspend\b[^.]*\band a bonus action\b/i.test(text)) return 'bonus';
  if (/^(?:1\s+)?reaction\b/i.test(text) || /\b(?:as|use|take|spend) (?:a |an |your )?reaction\b/i.test(text) || /^only[^:]*:\s*reaction\b/i.test(text)) return 'reaction';
  if (/^(?:1\s+)?action\b/i.test(text) || /\b(?:as|use|take|spend) (?:a |an |your )action\b/i.test(text)) return 'action';
  return kind==='spell'?'special':'';
}

export function sheetItems(c) {
  const sorted=[...c.items].sort((a,b)=>(a.category==='Consumable'?-1:0)-(b.category==='Consumable'?-1:0));
  return sorted.filter((item,index)=>index<3 || item.equipped || c.sheetLayout?.favorites.pack?.includes(item.id));
}

export function sheetSpells(c) {
  return c.spells.filter(spell=>spell.prepared || c.concentration===spell.name);
}
