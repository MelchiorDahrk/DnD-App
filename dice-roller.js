// Animate the exact, already-recorded dice. Physics never spends resources or rerolls rules.
const SUPPORTED=new Set([4,6,8,10,12,20,100]);
const MAX_PHYSICAL_DICE=20;
let current=null,engineModule=null;

export function beginDice() {
  clearDice();
  document.body.classList.add('dice-pending');
}

function reveal(session) {
  document.body.classList.remove('dice-pending');
  for(const {node,inert,hidden} of session.concealed) {
    node.inert=inert;
    if(hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',hidden);
  }
  session.concealed=[];
  session.faces.hidden=false;
}

export function diceAnimationPlan(result) {
  const sides=Number(String(result.expression).match(/^\d*d(\d+)/i)?.[1]);
  if(!result.rolls?.length)return {dice:[],note:''};
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

export function clearDice() {
  document.body.classList.remove('dice-pending');
  if(!current)return;
  const session=current;current=null;
  reveal(session);
  session.observer.disconnect();session.motion.removeEventListener('change',session.onMotion);
  document.removeEventListener('visibilitychange',session.onVisibility);
  releaseEngine(session);session.stage.remove();session.resolve('cancelled');
}

export function presentDice(result,host) {
  clearDice();
  if(!host?.isConnected||!result.rolls?.length||document.hidden)return Promise.resolve('skipped');
  const plan=diceAnimationPlan(result),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const stage=document.createElement('section');stage.className='dice-stage';stage.dataset.state='loading';
  stage.setAttribute('aria-label','Dice tray');
  const heading=document.createElement('div');heading.className='dice-stage-heading';
  const label=document.createElement('span');label.textContent=result.label||'Dice roll';
  const status=document.createElement('span');status.className='dice-stage-status';status.setAttribute('role','status');status.textContent='Preparing dice…';
  heading.append(label,status);
  const surface=document.createElement('div');surface.className='dice-surface';surface.setAttribute('aria-hidden','true');
  const note=document.createElement('p');note.className='dice-stage-note';note.textContent=plan.note;note.hidden=!plan.note;
  const faces=document.createElement('div');faces.className='dice-stage-faces';faces.hidden=true;faces.setAttribute('aria-label','Individual dice results');
  const kept=result.mode==='advantage'?Math.max(...result.rolls):result.mode==='disadvantage'?Math.min(...result.rolls):null;
  const keptIndex=kept===null?-1:result.rolls.indexOf(kept);
  result.rolls.forEach((value,index)=>{
    const face=document.createElement('span');face.textContent=value;
    if(index===keptIndex){face.className='dice-face-kept';face.setAttribute('aria-label',`${value}, kept die`);}
    faces.append(face);
  });
  stage.append(heading,surface,faces,note);host.prepend(stage);
  let resolve;
  const done=new Promise(finish=>{resolve=finish;});
  const session={stage,surface,status,motion,resolve,faces,engine:null,timer:null,concealed:[]};current=session;
  document.body.classList.add('dice-pending');
  const targets=[...document.querySelectorAll('#tray-die, #roll-detail, .history-row:first-child')];
  if(host.classList.contains('modal-body'))targets.push(...[...host.children].filter(node=>node!==stage));
  for(const node of targets) {
    session.concealed.push({node,inert:node.inert,hidden:node.getAttribute('aria-hidden')});
    node.inert=true;node.setAttribute('aria-hidden','true');
  }
  const active=()=>current===session&&stage.isConnected;
  const fallback=message=>{
    if(!active())return;
    session.failed=true;
    releaseEngine(session);stage.dataset.state='static';surface.hidden=true;
    reveal(session);
    status.textContent=`Result: ${result.total}`;note.hidden=false;note.textContent=message;
    resolve('static');
  };
  session.observer=new MutationObserver(()=>{if(current===session&&!stage.isConnected)clearDice();});
  session.observer.observe(document.body,{childList:true,subtree:true});
  session.onMotion=()=>{
    if(motion.matches&&['loading','rolling'].includes(stage.dataset.state))fallback('Reduced motion · see individual results below.');
  };
  session.onVisibility=()=>{if(document.hidden&&current===session)clearDice();};
  motion.addEventListener('change',session.onMotion);
  document.addEventListener('visibilitychange',session.onVisibility);
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
        if(kept!==null){note.hidden=false;note.textContent=`Keep the ${result.mode==='advantage'?'higher':'lower'} result (${kept}).`;}
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
    const dice=plan.dice.map(die=>({...die,diceColor:0xffffff,backgroundColor:'#365f58',textColor:'#fff5d7'}));
    // roll() may stay pending after destroy; completion uses the callback and our own cancelable promise.
    session.engine.roll(dice).catch(()=>fallback('3D dice unavailable · your recorded result is shown below.'));
  }).catch(()=>fallback('3D dice unavailable · your recorded result is shown below.'));
  return done;
}
