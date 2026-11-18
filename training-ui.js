import {ABILITIES,SKILLS,signed,skillBonus} from './model.js';
import {icon} from './icons.js';
import {ARMOR_TRAINING,LANGUAGE_GROUPS,trainingFor} from './training-rules.js';
import {WEAPONS} from './catalog.js';
import {toolCatalog,itemTool} from './inventory.js';
import {itemIconMarkup} from './item-icons.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(action,label,cls='btn',attrs='')=>`<button type="button" data-action="${action}" class="${cls}" ${attrs}>${label}</button>`;
const sheetEntry=(key,label)=>`data-sheet-entry="${esc(key)}" data-sheet-label="${esc(label)}"`;
const group=(title,body)=>`<fieldset class="training-group"><legend>${esc(title)}</legend>${body}</fieldset>`;
export function renderSkills(c,{editing=false}={}) {
  const choice=(kind,id,label,checked)=>`<label class="training-choice${editing?'':' is-readonly'}"><input type="checkbox" data-training="${kind}" value="${esc(id)}" ${checked?'checked':''} ${editing?'':'disabled'}><span>${esc(label)}</span></label>`;
  const description=text=>editing?`<p class="skill-description">${text}</p>`:'';
  const t=trainingFor(c),active=c.sheetLayout?.skillsTab==='saves'?'skills':c.sheetLayout?.skillsTab||'skills';
  const tabs=[['skills','Skills'],['proficiencies','Proficiencies'],['languages','Languages'],['tools','Tools']];
  const skills=description('Tap a dot: untrained → proficient → expertise. Tap a bonus to roll.')+Object.entries(SKILLS).filter(([name])=>!c.sheetLayout?.skillsProficientOnly||c.skills.includes(name)||c.expertise.includes(name)).map(([name,key])=>`<div class="skill-row" ${sheetEntry('skill-'+name,name)}>${btn('skill-prof',`<span class="prof-dot ${c.expertise.includes(name)?'expert':c.skills.includes(name)?'active':''}"></span>`,'prof-toggle',`data-skill="${esc(name)}" ${editing?'':'disabled'} aria-label="${esc(name)} proficiency: ${c.expertise.includes(name)?'expertise':c.skills.includes(name)?'proficient':'untrained'}.${editing?' Tap to change.':''}"`)}<span class="skill-name">${name}</span><span class="skill-ability">${key}</span>${btn('skill-roll',signed(skillBonus(c,name)),'skill-roll',`data-skill="${esc(name)}" aria-label="Roll ${esc(name)}"`)}</div>`).join('');
  const proficiencies=description('Your weapon choices update attack bonuses. Armor training controls shield AC and the penalties for untrained armor.')+
    group('Armor training',ARMOR_TRAINING.map(name=>choice('armor',name,name==='Shield'?'Shields':name+' armor',t.armor.includes(name))).join(''))+
    ['Simple','Martial'].map(family=>{const weapons=WEAPONS.filter(w=>w.family.startsWith(family));return group(family+' weapons',choice('weapon-group',family,'All '+family.toLowerCase()+' weapons',weapons.every(w=>t.weapons.includes(w.id)))+`<div class="training-options">${weapons.map(w=>choice('weapons',w.id,w.name,t.weapons.includes(w.id))).join('')}</div>`);}).join('');
  const listed=Object.values(LANGUAGE_GROUPS).flat(),custom=t.languages.filter(name=>!listed.includes(name));
  const languages=description('Tick every language you know. Rare languages require a feature or your DM’s approval. Primordial dialects are mutually intelligible.')+
    Object.entries(LANGUAGE_GROUPS).map(([label,names])=>group(label,`<div class="training-options">${names.map(name=>choice('languages',name,name,t.languages.includes(name))).join('')}</div>`)).join('')+
    (custom.length?group('Other languages',custom.map(name=>choice('languages',name,name,true)).join('')):'')+(editing?btn('custom-language','Add another language','btn btn-sm'):'');
  const ownedTools=new Set(c.items.filter(item=>item.qty>0).map(item=>itemTool(item)?.id));
  const toolOrder=entry=>ownedTools.has(entry.id)?0:t.tools.includes(entry.id)?1:2;
  const tools=description('Training and ownership are separate. Tick your proficiencies; add tools to your pack to use them. Rolls don’t consume reusable tools.')+
    ['Tools','Musical instruments','Gaming sets'].map(label=>group(label,toolCatalog().filter(e=>e.group===label).sort((a,b)=>toolOrder(a)-toolOrder(b)).map(entry=>{
      const owned=c.items.filter(item=>itemTool(item)?.id===entry.id&&item.qty>0),trained=t.tools.includes(entry.id);
      return `<div class="training-tool-row"><span class="item-symbol">${itemIconMarkup(entry)}</span><div class="training-tool-info">${choice('tools',entry.id,entry.name,trained)}<small>${ABILITIES[entry.toolAbility]} · ${owned.length?'In pack ×'+owned.reduce((sum,item)=>sum+item.qty,0):'Not in pack'}</small></div>${owned.length?btn('use-item','Use','btn btn-sm',`data-id="${owned[0].id}" aria-label="Use ${esc(entry.name)}"`):btn('add-tool','Add to pack','btn btn-sm',`data-tool="${entry.id}" aria-label="Add ${esc(entry.name)} to pack"`)}</div>`;
    }).join(''))).join('');
  const content={skills,proficiencies,languages,tools};
  const notes=['languages','armorProficiencies','weaponProficiencies','toolProficiencies'].filter(key=>c[key]);
  return `<section class="panel" data-sheet-section="skills"><div class="panel-heading"><h2>Skills & training</h2>${btn('training-edit',icon(editing?'check':'edit'),'icon-btn',`aria-label="${editing?'Finish editing':'Edit'} skills and training" aria-pressed="${editing}"`)}</div><div class="panel-body"><div class="training-tabs" role="tablist" aria-label="Skills and training">${tabs.map(([id,label])=>btn('skills-tab',label,`filter-tab${active===id?' active':''}`,`id="skills-tab-${id}" role="tab" aria-selected="${active===id}" aria-controls="skills-panel-${id}" tabindex="${active===id?0:-1}" data-tab="${id}"`)).join('')}</div>${tabs.map(([id,label])=>`<div class="training-tab-panel" role="tabpanel" id="skills-panel-${id}" aria-labelledby="skills-tab-${id}" ${active===id?'':'hidden'}>${id==='skills'?`<div class="skill-controls">${btn('skills-filter',c.sheetLayout?.skillsProficientOnly?'Proficient only':'All skills','btn btn-sm',`aria-pressed="${!!c.sheetLayout?.skillsProficientOnly}" aria-label="Show only proficient skills"`)}</div>`:''}${content[id]}</div>`).join('')}${notes.length?`<details class="training-notes"><summary>Original training notes</summary><p class="form-help">Kept from your previous sheet for reference. The selections above control your rules.</p>${notes.map(key=>`<p>${esc(c[key])}</p>`).join('')}</details>`:''}</div></section>`;
}
