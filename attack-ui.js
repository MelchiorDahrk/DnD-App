import {mod,rollDice,signed,validDiceFormula,RULES_URL} from './model.js';
import {attackWeapon,attackMastery,attackContext,attackOutcome,damageFormula,rollAttackDamage,rerollAttackDie,toppleDC,hasWeaponProperty,attackDamageFeatures} from './attack-rules.js';
import {itemIconMarkup} from './item-icons.js';
import {equipmentIconURL} from './equipment-icons.js';
import {icon} from './icons.js';
import {playAttackEffect} from './vfx.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,attrs='',primary=false)=>`<button type="button" class="btn${primary?' btn-primary':''}" data-combat-action="${action}" ${attrs}>${label}</button>`;
const input=(label,name,value='',attrs='')=>`<label class="form-field">${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const check=(label,name,checked=false)=>`<label class="check-field"><input type="checkbox" name="${name}" ${checked?'checked':''}>${label}</label>`;
const select=(label,name,values,current)=>`<label class="form-field">${label}<select name="${name}">${values.map(([value,label])=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('')}</select></label>`;
const resultMarkup=(r,label)=>`<div class="roll-modal combat-result"><div class="roll-expression">${esc(label)} · ${esc(r.expression)}${r.mode!=='normal'?' · '+r.mode:''}</div><div class="big-die">${icon('dice')}<strong>${r.total}</strong></div><div class="roll-breakdown">${r.rolls.length?esc(r.rolls.join(r.mode==='normal'?' + ':' & '))+(r.mode!=='normal'?` → ${r.natural}`:'')+(r.bonus?' '+signed(r.bonus):''):'Fixed damage'} = ${r.total}</div></div>`;
let controller;

export function openAttack({character:c,attack:initial,modal,setModal,recordRoll,onChange,damageOnly=false}) {
  controller?.abort();controller=new AbortController();
  const signal=controller.signal;
  let a=initial,options={},roll=null,outcome=null,damage=null,save=null,extras=[],usedFeatures=new Set(),cleaveUsed=false,lightUsed=false,clawUsed=false,extraKind='',mastery='';
  function reset(next,kind='') {
    a=next;extraKind=kind;roll=null;outcome=null;damage=null;save=null;extras=[];usedFeatures=new Set();
    mastery=attackMastery(c,a);
    options={kind:attackWeapon(a)?.family.endsWith('ranged')?'ranged':'melee',ac:'',distance:'',cover:'none',advantage:false,disadvantage:false,closeEnemy:false,fearVisible:false,twoHanded:false,override:false,keepAbility:c.features.some(f=>/two.weapon fighting/i.test(f.name))};
    if(damageOnly){outcome='hit';damageOnly=false;render();}else setup();
  }
  const artworkName=()=>equipmentIconURL(a)?a.name:attackWeapon(a)?.name||a.name;
  const header=()=>`<div class="combat-weapon"><span class="combat-icon">${itemIconMarkup({name:artworkName(),category:'Weapon'},options.kind==='ranged'?'bow':'sword')}</span><div><strong>${esc(a.name)}</strong><small>${esc(a.type)} · ${esc(a.range)}${mastery?' · '+mastery:''}${extraKind?' · '+esc(extraKind):''}</small></div></div>`;
  function setup() {
    const w=attackWeapon(a),thrown=w?.properties.includes('Thrown');
    setModal('Make your attack.',`${header()}<div class="form-grid combat-setup">${input('Target AC (optional)','ac',options.ac,'type="number" min="0" max="99" step="1"')}${select('Target cover','cover',[['none','None'],['half','Half (+2 AC)'],['three-quarters','Three-quarters (+5 AC)'],['total','Total (cannot target)']],options.cover)}${input('Distance in feet (optional)','distance',options.distance,'type="number" min="0" max="99999" step="1"')}${thrown||!w?select('Attack type','kind',[['melee','Melee'],['ranged','Ranged / thrown']],options.kind):''}</div>${check('Situational advantage (Vex, Help, unseen attacker, etc.)','advantage',options.advantage)}${check('Situational disadvantage (unseen target, target Prone at distance, etc.)','disadvantage',options.disadvantage)}${check('Ranged: visible, non-Incapacitated enemy within 5 ft.','closeEnemy',options.closeEnemy)}${w?.properties.includes('Versatile')?check('Use two hands for Versatile melee damage','twoHanded',options.twoHanded):''}${extraKind==='Light extra attack'?check('Keep ability damage (Two-Weapon Fighting or a specific feature)','keepAbility',options.keepAbility):''}${c.features.some(f=>/^Tactical Master\b/i.test(f.name))&&mastery?select('Tactical Master: mastery for this attack','mastery',[[mastery,mastery],...['Push','Sap','Slow'].filter(m=>m!==mastery).map(m=>[m,m])],mastery):''}<details class="combat-details"><summary>Exceptions & rules</summary>${check('Feature / DM exception: use only the situational boxes','override',options.override)}<p>Both advantage and disadvantage cancel, regardless of how many sources apply. Saved roll mode, Heavy, your tracked conditions, range, and nearby enemies are checked. Resolve visibility, target conditions, underwater combat, and special features with your DM.</p><p>Each roll is one attack. Extra Attack, actions, Reactions, and once-per-turn limits are tracked at the table.</p>${a.notes?`<p>${esc(a.notes)}</p>`:''}</details><div class="modal-actions">${button('close','Cancel')}${button('roll',icon('dice')+'Roll to hit','',true)}</div>`);
    if(c.conditions.includes('Frightened'))modal.querySelector('.combat-setup').insertAdjacentHTML('afterend',check('Frightened: the source of fear is in line of sight','fearVisible',options.fearVisible));
  }
  function readOptions() {
    const form=modal.querySelector('form');
    if(!form.reportValidity())return false;
    const data=new FormData(form);
    for(const name of ['ac','cover','distance','kind'])if(data.has(name))options[name]=data.get(name);
    for(const name of ['advantage','disadvantage','closeEnemy','fearVisible','twoHanded','override','keepAbility'])options[name]=data.has(name);
    if(options.kind==='ranged')options.twoHanded=false;
    if(data.has('mastery'))mastery=data.get('mastery');
    return true;
  }
  function animate(result,phase,damageLabel=a.type) {
    playAttackEffect({name:artworkName()},{ranged:options.kind==='ranged',critical:outcome==='critical',miss:outcome==='miss',label:phase==='damage'?`${result.total} ${damageLabel}`:a.name,detail:phase==='damage'?'DAMAGE':outcome==='critical'?'CRITICAL HIT':outcome==='miss'?'MISS':'ATTACK ROLL',target:'.combat-weapon'});
  }
  function doRoll() {
    if(!readOptions())return;
    const context=attackContext(c,a,options);
    if(context.blocked)throw new Error(context.blocked);
    roll=rollDice(`1d20${signed(context.bonus)}`,context.mode);recordRoll(roll,a.name+' · to hit');
    outcome=attackOutcome(roll,options.ac,context.coverBonus);render();animate(roll,'attack');
  }
  function masteryMarkup() {
    if(!mastery)return '';
    let body='';
    if(outcome==='miss'&&mastery==='Graze')body=`<strong>${Math.max(0,mod(c.stats[a.ability]))} ${esc(a.type)} damage</strong><p>Graze uses only your attack ability modifier. No magic bonus, Rage, extra dice, or critical doubling.</p>`;
    if(outcome&&outcome!=='miss'){
      const descriptions={Push:'Move a Large or smaller target up to 10 feet directly away.',Sap:'The target has disadvantage on its next attack before your next turn starts.',Slow:'If damage was dealt, reduce target Speed by 10 feet until your next turn starts. Repeated Slow hits do not stack.',Vex:'If damage was dealt, your next attack against this same creature has advantage before your next turn ends. Select situational advantage when making that attack.'};
      if(descriptions[mastery])body=`<p>${descriptions[mastery]}</p>`;
      if(mastery==='Topple')body=`<p>Target Constitution save · <strong>DC ${toppleDC(c,a)}</strong>. Failure makes it Prone. Use its stat block or have the DM roll.</p><div class="form-grid">${input('Target CON save modifier','targetCon','0','type="number" required min="-99" max="99" step="1"')}${select('Target save mode','targetSaveMode',[['normal','Normal'],['advantage','Advantage'],['disadvantage','Disadvantage']],'normal')}</div>${button('topple','Roll target save')}${save?`<p class="combat-save" role="status">${esc(save.rolls.join(' & '))} ${signed(save.bonus)} = <strong>${save.total}</strong> · ${save.total<toppleDC(c,a)?'Failed: Prone':'Saved'}</p>`:''}`;
      if(mastery==='Cleave'&&options.kind==='melee')body=`<p>Second creature: within your reach and 5 feet of the first. Once per turn; positive ability damage is omitted.</p>${button('cleave',cleaveUsed?'Cleave already used in this sequence':'Make Cleave attack',cleaveUsed?'disabled':'')}`;
    }
    if(mastery==='Nick'&&roll)body='<p>Nick moves the Light extra attack into your Attack action. It shares the same one extra attack; it does not also grant a Bonus Action attack.</p>';
    return body?`<section class="combat-followup" data-mastery="${mastery}"><h3>${mastery}</h3>${body}</section>`:'';
  }
  function lightMarkup() {
    if(!roll||!hasWeaponProperty(a,'Light')||lightUsed)return '';
    const choices=c.attacks.filter(other=>other.id!==a.id&&hasWeaponProperty(other,'Light'));
    return `<section class="combat-followup"><h3>Light extra attack</h3><p>After a Light attack in your Attack action, use a different Light weapon later this turn. Confirm the extra attack is still available. Omit positive ability damage unless a feature allows it.</p>${choices.map(other=>button('light',`${attackMastery(c,other)==='Nick'?'Nick · Attack action':'Bonus Action'} · ${esc(other.name)}`,`data-id="${other.id}"`)).join('')}${!choices.length?'<p>Add a second Light weapon attack to use it here.</p>':''}</section>`;
  }
  function extraMarkup() {
    if(!outcome||outcome==='miss')return '';
    const features=attackDamageFeatures(c,a);
    return `<details class="combat-details"><summary>Extra damage & features</summary><p>Confirm the trigger and once-per-turn limit. Attack damage dice double on a critical hit; bonuses stay fixed. Saving throw damage is separate.</p>${features.map(f=>button('feature',esc(f.name)+(f.maxUses?` · ${f.maxUses-f.used} left`:''),`data-id="${f.id}" ${usedFeatures.has(f.id)||(f.maxUses&&f.used>=f.maxUses)?'disabled':''}`)).join('')}${/hunter.?s mark/i.test(c.concentration)?button('mark','Hunter’s Mark · marked target only',usedFeatures.has('mark')?'disabled':''):''}${input('Additional attack damage dice / fixed amount','extraDamage','','type="text" maxlength="30" placeholder="2d6 or 2"')}${check('Double these dice on a critical hit','criticalExtra',true)}${button('extra','Roll extra damage')}<p>Rage, Sneak Attack eligibility, maneuvers, Smite costs, resistance, immunity, vulnerability, concentration saves, and other target effects remain table decisions.</p></details>`;
  }
  function render() {
    const context=attackContext(c,a,options);
    const status=!outcome?`<p class="combat-question">Confirm the hit with your DM.</p><div class="combat-buttons">${button('hit','Hit')}${button('critical','Critical hit')}${button('miss','Miss')}</div>`:`<div class="combat-outcome ${outcome==='miss'?'combat-miss':''}" role="status">${outcome==='critical'?'✦ Critical hit':outcome==='hit'?'Hit':'Miss'}${options.ac!==''?` · AC ${Number(options.ac)+context.coverBonus}`:''}${roll?.natural===1?' · natural 1':roll?.natural===20?' · natural 20':''}</div>`;
    const modes=roll?`<p class="form-help">${esc([...context.advantages,...context.disadvantages].join(' · ')||'Normal roll')}${context.advantages.length&&context.disadvantages.length?' · Advantage and disadvantage cancel.':''}</p>`:'';
    const inspiration=c.inspiration&&roll&&!damage&&!extras.length&&!save?`<div class="combat-inspiration"><p>Heroic Inspiration: reroll one die and keep its new value.</p>${roll.rolls.map((value,i)=>button('inspiration',`Reroll die ${i+1} (${value})`,`data-index="${i}"`)).join('')}</div>`:'';
    const specialCritical=roll&&outcome&&roll.natural!==1&&roll.natural!==20&&!damage&&!extras.length&&!save?`<p class="form-help">${button(outcome==='critical'?'hit':'critical',outcome==='critical'?'Use a normal hit':'Feature / target effect: critical hit')}</p>`:'';
    const formula=damageFormula(c,a,{twoHanded:options.twoHanded,omitAbility:['Cleave','Light extra attack'].includes(extraKind),keepAbility:extraKind==='Light extra attack'&&options.keepAbility});
    const damagePanel=outcome&&outcome!=='miss'?`<section class="combat-followup"><h3>${outcome==='critical'?'Critical damage':'Damage'}</h3>${!roll&&!damage?check('Critical hit','directCritical',outcome==='critical'):''}<p>${esc(formula)}${outcome==='critical'?' · double dice, keep bonuses':''} · ${esc(a.type)}</p>${damage?resultMarkup(damage,a.type+' damage'):button('damage','Roll damage','',true)}</section>`:'';
    const claws=roll&&!clawUsed&&/^Beast: Claws$/i.test(a.name)&&c.features.some(f=>/Form of the Beast/i.test(f.name))?`<section class="combat-followup"><h3>Beast Claws</h3><p>In Claws form during Rage, once on your turn after a claw attack in your Attack action, make one extra claw attack in that action. Confirm it is still available.</p>${button('claw','Extra claw attack')}</section>`:'';
    const reminders=[...context.warnings,a.notes].filter(Boolean);
    if(damage||extras.length)reminders.push('Apply resistance, vulnerability, and immunity by damage type. A concentrating target checks a Constitution save after taking damage: DC 10 or half the damage taken (round down), whichever is higher, capped at DC 30.');
    setModal(esc(a.name)+(extraKind?' · '+esc(extraKind):''),`${header()}${roll?resultMarkup(roll,'To hit'):''}${status}${modes}${inspiration}${specialCritical}${damagePanel}${masteryMarkup()}${lightMarkup()}${claws}${extras.map(({label,result})=>`<div class="combat-extra-result">${esc(label)}${resultMarkup(result,'Extra damage')}</div>`).join('')}${extraMarkup()}${reminders.length?`<details class="combat-details"><summary>Weapon reminders & notes</summary>${reminders.map(n=>`<p>${esc(n)}</p>`).join('')}</details>`:''}<p class="form-help"><a href="${RULES_URL}/equipment#MasteryProperties" target="_blank" rel="noopener noreferrer">2024 weapon rules</a> · Apply damage and conditions to the target at the table.</p><div class="modal-actions">${button('close','Done')}${button('again','Another attack')}</div>`);
  }
  modal.addEventListener('click',event=>{
    const el=event.target.closest('[data-combat-action]');if(!el||el.disabled)return;
    try{
      const action=el.dataset.combatAction;
      if(action==='close'){modal.close();return;}
      if(action==='roll'){doRoll();return;}
      if(action==='again'){reset(a);return;}
      if(['hit','critical','miss'].includes(action)){outcome=action;render();return;}
      if(action==='inspiration'){
        if(!c.inspiration||!roll||damage||extras.length||save)return;
        roll=rerollAttackDie(roll,Number(el.dataset.index));c.inspiration=false;onChange();recordRoll(roll,a.name+' · Inspiration reroll');
        outcome=attackOutcome(roll,options.ac,attackContext(c,a,options).coverBonus);save=null;render();animate(roll,'attack');return;
      }
      if(action==='damage'){
        if(damage||!outcome||outcome==='miss')return;
        if(!roll)outcome=modal.querySelector('[name="directCritical"]').checked?'critical':'hit';
        const formula=damageFormula(c,a,{twoHanded:options.twoHanded,omitAbility:['Cleave','Light extra attack'].includes(extraKind),keepAbility:extraKind==='Light extra attack'&&options.keepAbility});
        damage=rollAttackDamage(formula,outcome==='critical');recordRoll(damage,a.name+' · damage');render();animate(damage,'damage');return;
      }
      if(action==='topple'){
        const target=modal.querySelector('[name="targetCon"]');if(!target.reportValidity())return;
        save=rollDice(`1d20${signed(Number(target.value))}`,modal.querySelector('[name="targetSaveMode"]').value);recordRoll(save,'Topple · target Constitution save');render();return;
      }
      if(action==='cleave'&&!cleaveUsed){cleaveUsed=true;reset(a,'Cleave');return;}
      if(action==='light'&&!lightUsed){const next=c.attacks.find(v=>v.id===el.dataset.id);if(!next)return;lightUsed=true;reset(next,'Light extra attack');return;}
      if(action==='claw'&&!clawUsed){clawUsed=true;reset(a,'Extra claw attack');return;}
      if(action==='feature'||action==='mark'||action==='extra'){
        let formula,label,critical=outcome==='critical',feature;
        if(action==='feature'){
          feature=attackDamageFeatures(c,a).find(f=>f.id===el.dataset.id);if(!feature||usedFeatures.has(feature.id))return;
          if(feature.maxUses&&feature.used>=feature.maxUses)throw new Error('No uses remain.');
          formula=feature.rollFormula;label=feature.name;
        }else if(action==='mark'){if(usedFeatures.has('mark'))return;formula='1d6';label='Hunter’s Mark · Force';}
        else {formula=modal.querySelector('[name="extraDamage"]').value.trim();label='Extra attack damage';critical=critical&&modal.querySelector('[name="criticalExtra"]').checked;}
        if(!validDiceFormula(formula))throw new Error('Use damage dice like 2d6+3 or a fixed amount.');
        const result=rollAttackDamage(formula,critical);
        if(feature){usedFeatures.add(feature.id);if(feature.maxUses){feature.used++;onChange();}}
        if(action==='mark')usedFeatures.add('mark');
        extras.push({label,result});recordRoll(result,a.name+' · '+label);render();animate(result,'damage',label);
      }
    }catch(error){const errorNode=modal.querySelector('#form-error');errorNode.hidden=false;errorNode.className='form-error';errorNode.textContent=error.message;}
  },{signal});
  modal.addEventListener('close',()=>controller?.abort(),{once:true,signal});
  reset(initial);
}
