// Local, short-lived canvas effects. Nothing is downloaded or stored with a character.
const THEMES = {
  damage: {color:'#ed716b',accent:'#ffd4af',symbol:'strike',life:1100,count:44},
  heal: {color:'#75d9aa',accent:'#e6ffb8',symbol:'heart',life:1650,count:58},
  shield: {color:'#83cfff',accent:'#e5ecff',symbol:'shield',life:1650,count:52},
  inspiration: {color:'#edc772',accent:'#fff2bf',symbol:'star',life:2100,count:90},
  'inspiration-spent': {color:'#d7b777',accent:'#fff3d5',symbol:'star',life:1300,count:36},
  'short-rest': {color:'#f3b275',accent:'#ffe4a3',symbol:'camp',life:2600,count:80,scene:true},
  'long-rest': {color:'#a9b9ff',accent:'#e9e4ff',symbol:'moon',life:2800,count:96,scene:true},
  level: {color:'#edca7c',accent:'#e4ffc4',symbol:'star',life:2900,count:130,scene:true},
  spell: {color:'#b5a4f7',accent:'#d0f2ff',symbol:'rune',life:1750,count:66},
  resource: {color:'#9dd4bc',accent:'#eff9bb',symbol:'rune',life:1050,count:28},
  critical: {color:'#edca7c',accent:'#fff9dd',symbol:'star',life:1950,count:90},
  condition: {color:'#d6a0c5',accent:'#f8def4',symbol:'rune',life:1100,count:26},
  xp: {color:'#b9d583',accent:'#effbc7',symbol:'star',life:1200,count:36}
};

const SYMBOLS = {
  star:'<path d="m80 38 11 28 30 14-30 12-11 30-12-30-29-12 29-14Z"/>',
  heart:'<path d="M80 112 49 81C25 55 60 34 80 58c20-24 55-3 31 23Z"/>',
  shield:'<path d="m80 36 33 14v28c0 22-19 38-33 46-14-8-33-24-33-46V50Z"/><path d="m63 78 12 12 23-27"/>',
  strike:'<path d="m93 32-44 55h28l-10 41 44-57H84Z"/>',
  moon:'<path d="M99 40a42 42 0 1 0 21 63A37 37 0 0 1 99 40Z"/><path d="m116 40 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/>',
  camp:'<path d="m52 112 56-8m-54 0 52 10M80 39c5 25 25 28 25 47a25 25 0 0 1-50 0c0-10 5-19 12-25 0 12 7 13 7 13s12-12 6-35Z"/><path d="M80 81c12 12 13 19 0 23-13-4-12-11 0-23Z"/>',
  rune:'<path d="m80 33 39 47-39 47-39-47Z"/><path d="m80 52 23 28-23 28-23-28Z"/><path d="M80 19v14m0 94v14M19 80h22m78 0h22"/>'
};

export function effectGlyph(symbol='star') {
  return `<svg viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="vfx-glyph-orbit" cx="80" cy="80" r="68" stroke-dasharray="2 10 22 10"/><circle cx="80" cy="80" r="59" opacity=".35"/>${SYMBOLS[symbol]||SYMBOLS.star}</svg>`;
}

// Report actual changes: overhealing and a weaker Temp HP grant aren't gains.
export function hpFeedback(before,after,kind) {
  const lost=Math.max(0,before.hp-after.hp),absorbed=Math.max(0,before.tempHp-after.tempHp);
  const gained=Math.max(0,after.hp-before.hp),temp=Math.max(0,after.tempHp-before.tempHp);
  if(kind==='damage'&&lost+absorbed)return {kind:'damage',label:`−${lost+absorbed}`,detail:absorbed?`${lost} HP · ${absorbed} absorbed`:'HIT POINTS',amount:lost+absorbed};
  if(kind==='heal'&&gained)return {kind:'heal',label:`+${gained} HP`,detail:before.hp===0?'BACK ON YOUR FEET':'HEALING',amount:gained};
  if(kind==='temp'&&temp)return {kind:'shield',label:`+${temp} TEMP`,detail:'PROTECTED',amount:temp};
  return null;
}

let layer,canvas,context,frame=0,previous=0,particles=[],bursts=[];
const motions=new Set();
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand=(a,b)=>a+Math.random()*(b-a);

function mount() {
  if(layer)return;
  layer=document.createElement('div');
  layer.className='vfx-layer';layer.setAttribute('aria-hidden','true');
  // A passive popover puts effects above native dialogs without taking focus.
  layer.setAttribute('popover','manual');
  document.body.append(layer);
  try {layer.showPopover();} catch {layer.removeAttribute('popover');}
}

function position(target,scene) {
  const node=typeof target==='string'||!target?document.querySelector(target||'.hero .avatar-frame'):target;
  const rect=node?.getBoundingClientRect();
  const visible=rect&&rect.width>0&&rect.height>0&&rect.bottom>90&&rect.top<innerHeight-80;
  if(scene&&target&&visible)return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,node};
  return {
    x:scene?innerWidth/2:Math.max(Math.min(150,innerWidth/2),Math.min(innerWidth-150,visible?rect.left+rect.width/2:innerWidth/2)),
    y:scene?Math.min(innerHeight*.39,340):Math.max(105,Math.min(innerHeight-165,visible?rect.top+rect.height/2:innerHeight*.38)),
    node:visible?node:null
  };
}

function animateTarget(node,kind,color) {
  if(!node?.animate||reduced())return;
  const keyframes=kind==='damage'
    ? [{transform:'translateX(0)'},{transform:'translateX(-5px)',offset:.2},{transform:'translateX(4px)',offset:.4},{transform:'translateX(-2px)',offset:.65},{transform:'translateX(0)'}]
    : [{filter:'drop-shadow(0 0 0 transparent)'},{filter:`drop-shadow(0 0 12px ${color})`,offset:.35},{filter:'drop-shadow(0 0 0 transparent)'}];
  const animation=node.animate(keyframes,{duration:kind==='damage'?350:1000,easing:'ease-out'});
  motions.add(animation);animation.finished.catch(()=>{}).finally(()=>motions.delete(animation));
}

function seed(kind,theme,x,y) {
  if(!canvas) {
    canvas=document.createElement('canvas');canvas.className='vfx-canvas';layer.prepend(canvas);
    context=canvas.getContext('2d');resize();
  }
  if(!context)return;
  const scale=innerWidth<600?.7:1;
  const count=Math.round(theme.count*scale);
  for(let i=0;i<count;i++) {
    const angle=rand(0,Math.PI*2),speed=rand(35,theme.scene?210:145);
    const rising=['heal','short-rest','long-rest','level'].includes(kind);
    const orbit=['inspiration','spell','shield'].includes(kind)&&i%3===0;
    particles.push({x:x+(rising?rand(-105,105):0),y:y+(rising?rand(5,75):0),originX:x,originY:y,
      vx:Math.cos(angle)*speed,vy:rising?rand(-170,-40):Math.sin(angle)*speed,
      size:rand(1.2,kind==='damage'?3:2.5),age:-rand(0,theme.scene?.9:.25),life:rand(.5,theme.life/1000),
      color:i%3===0?theme.accent:theme.color,angle,radius:rand(38,100),orbit,
      shape:kind==='damage'?'streak':i%5===0?'star':'spark',gravity:kind==='damage'?150:rising?-8:45});
  }
  particles=particles.slice(-260);
  if(!frame){previous=performance.now();frame=requestAnimationFrame(draw);}
}

function resize() {
  if(!canvas)return;
  const ratio=Math.min(devicePixelRatio||1,1.75);
  canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);
  context?.setTransform(ratio,0,0,ratio,0,0);
}

function draw(now) {
  frame=0;
  if(!context||document.hidden||reduced()){clearEffects();return;}
  const dt=Math.min((now-previous)/1000,.04);previous=now;
  context.clearRect(0,0,innerWidth,innerHeight);
  context.globalCompositeOperation='lighter';
  particles=particles.filter(p=>p.age<p.life);
  for(const p of particles) {
    p.age+=dt;if(p.age<0)continue;
    const progress=Math.min(p.age/p.life,1);
    if(p.orbit) {
      p.angle+=dt*2.7;p.radius+=dt*22;
      p.x=p.originX+Math.cos(p.angle)*p.radius;p.y=p.originY+Math.sin(p.angle)*p.radius*.55;
    } else {p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-dt*.6;}
    context.globalAlpha=Math.sin(Math.PI*progress)*.85;context.fillStyle=p.color;context.strokeStyle=p.color;
    context.shadowColor=p.color;context.shadowBlur=p.shape==='star'?13:6;
    const size=p.size*(1-progress*.5);
    context.beginPath();
    if(p.shape==='streak') {
      context.lineWidth=size;context.moveTo(p.x,p.y);context.lineTo(p.x-p.vx*.07,p.y-p.vy*.07);context.stroke();
    } else if(p.shape==='star') {
      context.moveTo(p.x,p.y-size*3);context.lineTo(p.x+size*.7,p.y-size*.7);context.lineTo(p.x+size*3,p.y);
      context.lineTo(p.x+size*.7,p.y+size*.7);context.lineTo(p.x,p.y+size*3);context.lineTo(p.x-size*.7,p.y+size*.7);
      context.lineTo(p.x-size*3,p.y);context.lineTo(p.x-size*.7,p.y-size*.7);context.closePath();context.fill();
    } else {context.arc(p.x,p.y,size,0,Math.PI*2);context.fill();}
  }
  context.globalAlpha=1;context.shadowBlur=0;
  if(particles.length)frame=requestAnimationFrame(draw);
  else if(!bursts.length)clearEffects();
}

export function clearEffects() {
  cancelAnimationFrame(frame);frame=0;particles=[];
  for(const burst of bursts){clearTimeout(burst.timer);burst.node.remove();}
  bursts=[];
  for(const animation of motions)animation.cancel();motions.clear();
  layer?.remove();layer=canvas=context=null;
}

export function playEffect(kind,{label='',detail='',target,caption:showCaption=true,sigil:showSigil=true}={}) {
  const theme=THEMES[kind];if(!theme||document.hidden)return;
  mount();
  const calm=reduced();
  const {x,y,node}=position(target,theme.scene);
  const burst=document.createElement('div');
  burst.className=`vfx-event vfx-${kind}${theme.scene?' vfx-scene':''}${calm?' vfx-calm':''}`;
  burst.dataset.effect=kind;
  burst.style.setProperty('--vfx-color',theme.color);burst.style.setProperty('--vfx-accent',theme.accent);
  burst.style.setProperty('--vfx-x',`${x}px`);burst.style.setProperty('--vfx-y',`${y}px`);
  burst.style.setProperty('--vfx-life',`${theme.life}ms`);
  // Labels come from character names and spells too; keep them as text nodes.
  if(!calm) {
    const aura=document.createElement('div');aura.className='vfx-aura';
    burst.append(aura);
    if(showSigil){const sigil=document.createElement('div');sigil.className='vfx-sigil';sigil.innerHTML=effectGlyph(theme.symbol);burst.append(sigil);}
  }
  if(showCaption){
    const caption=document.createElement('div');caption.className='vfx-caption';
    const title=document.createElement('strong');title.textContent=label;
    const subtitle=document.createElement('span');subtitle.textContent=detail;
    caption.append(title,subtitle);burst.append(caption);
  }
  layer.append(burst);
  const entry={node:burst,timer:setTimeout(()=>{
    burst.remove();bursts=bursts.filter(item=>item!==entry);
    if(!bursts.length&&!frame)clearEffects();
  },calm?1500:theme.life)};
  bursts.push(entry);
  // Bound rapid taps; don't let old effects obscure the next action.
  if(bursts.length>3){const oldest=bursts.shift();clearTimeout(oldest.timer);oldest.node.remove();}
  if(!calm){animateTarget(node,kind,theme.color);seed(kind,theme,x,y);}
}

if(typeof window!=='undefined') {
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearEffects();});
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',clearEffects);
}
