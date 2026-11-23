// Animate the exact, already-recorded dice. Physics never spends resources or rerolls rules.
const SUPPORTED=new Set([4,6,8,10,12,20,100]);
const MAX_PHYSICAL_DICE=20;
let current=null,partyCurrent=null,engineModule=null;
const isCurrent=session=>(session.spectator?partyCurrent:current)===session;

export const DICE_COLORS_KEY='questlog.dice-colors.v1';
export const DEFAULT_DICE_COLORS=Object.freeze({body:'#365f58',numbers:'#fff5d7'});

function normalizeDiceColors(input) {
  return Object.fromEntries(Object.entries(DEFAULT_DICE_COLORS).map(([key,fallback])=>
    [key,typeof input?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(input[key])?input[key].toLowerCase():fallback]));
}

// Appearance stays on this device, independently of character saves and backups.
export function createDiceColorPreferences(storage) {
  try {storage??=globalThis.localStorage;}catch{}
  let colors={...DEFAULT_DICE_COLORS};
  try {colors=normalizeDiceColors(JSON.parse(storage?.getItem(DICE_COLORS_KEY)||'null'));}catch{}
  return {
    get:()=>({...colors}),
    set(update) {
      colors=normalizeDiceColors({...colors,...update});
      try {if(storage){storage.setItem(DICE_COLORS_KEY,JSON.stringify(colors));return true;}}catch{}
      return false;
    }
  };
}
export const diceColorPreferences=createDiceColorPreferences();

export function beginDice() {
  clearDice();
  document.body.classList.add('dice-pending');
}

function reveal(session) {
  if(!session.spectator)document.body.classList.remove('dice-pending');
  for(const {node,inert,hidden} of session.concealed) {
    node.inert=inert;
    if(hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',hidden);
  }
  session.concealed=[];
  session.faces.hidden=false;session.faces.removeAttribute('aria-hidden');
  // Tray insertion and scrolling to Roll can leave a mobile total behind the fixed chrome.
  if(current===session&&session.stage.parentElement?.id==='dice-stage'&&matchMedia('(max-width:760px)').matches) {
    const total=document.querySelector('#tray-die')?.getBoundingClientRect();
    if(total) {
      const top=(document.querySelector('.topbar')?.getBoundingClientRect().bottom||0)+12;
      const bottom=(document.querySelector('.mobile-nav')?.getBoundingClientRect().top||innerHeight)-12;
      const offset=total.top<top?total.top-top:total.bottom>bottom?total.bottom-bottom:0;
      if(offset)window.scrollBy({top:offset,behavior:'instant'});
    }
  }
}

export function diceAnimationPlan(result) {
  const sides=Number(String(result.expression).match(/^\d*d(\d+)/i)?.[1]);
  if(!result.rolls?.length)return {dice:[],note:''};
  if(result.dieSides?.length===result.rolls.length&&result.dieSides.every(die=>SUPPORTED.has(die))){
    if(result.rolls.length>MAX_PHYSICAL_DICE)return {dice:[],note:'Large roll · see all individual results below.'};
    return {dice:result.rolls.map((rolled,index)=>({dice:`d${result.dieSides[index]}`,rolled})),note:'Mixed Hit Dice'};
  }
  if(!SUPPORTED.has(sides))return {dice:[],note:`d${sides} · see individual results below.`};
  if(result.rolls.length*(sides===100?2:1)>MAX_PHYSICAL_DICE)return {dice:[],note:'Large roll · see all individual results below.'};
  return {dice:result.rolls.map(rolled=>({dice:`d${sides}`,rolled})),note:sides===100?'Read tens + units; 00 and 0 = 100.':sides===10?'A 0 on a d10 counts as 10.':''};
}

// The engine reports raw 0 / 00 faces for ten and one hundred.
export function facesMatch(results=[]) {
  return results.length>0&&results.every(({type,visible,value})=>
    visible===value||((type==='d10'||type==='d100')&&visible===0&&(value===10||value===100)));
}

function releaseEngine(session) {
  clearTimeout(session.timer);
  session.resize?.disconnect();
  if(session.engine) {
    const engine=session.engine;session.engine=null;
    engine.destroy();
    engine.floor?.geometry.dispose();engine.floor?.material.dispose();
    engine.renderer.forceContextLoss();
  }
}

export function clearDice(spectator=false) {
  if(!spectator)document.body.classList.remove('dice-pending');
  const session=spectator?partyCurrent:current;
  if(!session)return;
  if(spectator)partyCurrent=null;else current=null;
  reveal(session);
  session.observer.disconnect();session.motion.removeEventListener('change',session.onMotion);
  document.removeEventListener('visibilitychange',session.onVisibility);
  releaseEngine(session);session.stage.remove();session.resolve('cancelled');
}

export const presentPartyDice=(result,host)=>presentDice(result,host,{spectator:true});
export function presentDice(result,host,{spectator=false}={}) {
  clearDice(spectator);
  if(!host?.isConnected||!result.rolls?.length||document.hidden)return Promise.resolve('skipped');
  const plan=diceAnimationPlan(result),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const stage=document.createElement('section');stage.className='dice-stage';stage.dataset.state='loading';
  const colors=diceColorPreferences.get();
  stage.style.setProperty('--dice-body',colors.body);stage.style.setProperty('--dice-numbers',colors.numbers);
  stage.setAttribute('aria-label','Dice tray');
  const heading=document.createElement('div');heading.className='dice-stage-heading';
  const label=document.createElement('span');label.textContent=result.label||'Dice roll';
  const status=document.createElement('span');status.className='dice-stage-status';status.setAttribute('role','status');status.textContent='Preparing dice…';
  heading.append(label,status);
  const surface=document.createElement('div');surface.className='dice-surface';surface.setAttribute('aria-hidden','true');
  const note=document.createElement('p');note.className='dice-stage-note';note.textContent=plan.note;note.hidden=!plan.note;
  const faces=document.createElement('div');faces.className='dice-stage-faces';faces.hidden=true;faces.setAttribute('aria-hidden','true');faces.setAttribute('aria-label','Individual dice results');
  const kept=result.mode==='advantage'?Math.max(...result.rolls):result.mode==='disadvantage'?Math.min(...result.rolls):null;
  const keptIndex=kept===null?-1:result.rolls.indexOf(kept);
  const keepResult=kept===null?'':`Keep the ${result.mode==='advantage'?'higher':'lower'} result`;
  if(keepResult){note.hidden=false;note.textContent=`${keepResult}.`;}
  result.rolls.forEach((value,index)=>{
    const face=document.createElement('span');face.textContent=value;
    if(index===keptIndex){face.className='dice-face-kept';face.setAttribute('aria-label',`${value}, kept die`);}
    faces.append(face);
  });
  stage.append(heading,surface,faces,note);host.prepend(stage);
  let resolve;
  const done=new Promise(finish=>{resolve=finish;});
  const session={stage,surface,status,motion,resolve,faces,spectator,engine:null,timer:null,concealed:[]};if(spectator)partyCurrent=session;else current=session;
  if(!spectator)document.body.classList.add('dice-pending');
  const targets=spectator?[]:[...document.querySelectorAll('#tray-die, #roll-detail, .history-row:first-child')];
  if(host.classList.contains('modal-body'))targets.push(...[...host.children].filter(node=>node!==stage));
  for(const node of targets) {
    session.concealed.push({node,inert:node.inert,hidden:node.getAttribute('aria-hidden')});
    node.inert=true;node.setAttribute('aria-hidden','true');
  }
  const active=()=>isCurrent(session)&&stage.isConnected;
  const fallback=message=>{
    if(!active())return;
    session.failed=true;
    releaseEngine(session);stage.dataset.state='static';surface.hidden=true;
    reveal(session);
    status.textContent=`Result: ${result.total}`;note.hidden=!message;note.textContent=message;
    resolve('static');
  };
  session.observer=new MutationObserver(()=>{if(isCurrent(session)&&!stage.isConnected)clearDice(spectator);});
  session.observer.observe(document.body,{childList:true,subtree:true});
  session.onMotion=()=>{
    if(motion.matches&&['loading','rolling'].includes(stage.dataset.state))fallback('Reduced motion · see individual results below.');
  };
  session.onVisibility=()=>{if(document.hidden&&isCurrent(session))clearDice(spectator);};
  motion.addEventListener('change',session.onMotion);
  document.addEventListener('visibilitychange',session.onVisibility);
  if(result.quick) {
    fallback(keepResult?`${keepResult} (${kept}).`:'');
    return done;
  }
  if(motion.matches||!plan.dice.length) {
    fallback(motion.matches?'Reduced motion · see individual results below.':plan.note);
    return done;
  }
  // A broken import, WebGL context or unfinished throw must never leave a loading state.
  session.timer=setTimeout(()=>fallback('3D dice unavailable · your recorded result is shown below.'),15000);
  engineModule??=import('./dice-engine/dice-engine.js').catch(error=>{engineModule=null;throw error;});
  engineModule.then(({DiceRoller})=>{
    if(!active()||session.failed)return;
    session.engine=new DiceRoller({
      container:surface,pixelRatio:Math.min(devicePixelRatio||1,1.5),soundVolume:0,
      onRollComplete:(_total,outcome)=>{
        if(!active())return;
        if(!facesMatch(outcome.results)) {fallback('See the recorded individual results below.');return;}
        clearTimeout(session.timer);stage.dataset.state='settled';status.textContent=`Result: ${result.total}`;
        if(keepResult){note.hidden=false;note.textContent=`${keepResult} (${kept}).`;}
        reveal(session);
        // Also lets browser checks verify the faces, not just that a canvas was created.
        stage.dispatchEvent(new CustomEvent('dice-settled',{bubbles:true,detail:outcome}));
        resolve('settled');
      }
    });
    surface.querySelector('canvas').addEventListener('webglcontextlost',()=>fallback('3D dice unavailable · your recorded result is shown below.'),{once:true});
    // open-dice 1.13 handles window resizes; this also covers dialog/container changes.
    session.resize=new ResizeObserver(()=>{
      const engine=session.engine;
      if(active()&&engine&&surface.clientWidth&&surface.clientHeight&&(engine.width!==surface.clientWidth||engine.height!==surface.clientHeight))engine._handleResize();
    });
    session.resize.observe(surface);
    stage.dataset.state='rolling';status.textContent='Rolling…';
    const size=matchMedia('(max-width:760px)').matches?3:1;
    // Keep the material tint white so body and number colors remain independent.
    const dice=plan.dice.map(die=>({...die,size,diceColor:0xffffff,backgroundColor:colors.body,textColor:colors.numbers}));
    // roll() may stay pending after destroy; completion uses the callback and our own cancelable promise.
    session.engine.roll(dice).catch(()=>fallback('3D dice unavailable · your recorded result is shown below.'));
  }).catch(()=>fallback('3D dice unavailable · your recorded result is shown below.'));
  return done;
}
