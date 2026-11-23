const quantities=Array.from({length:50},(_,index)=>index+1);
const standardDice=[4,6,8,10,12,20,100];
const dieTypes=sides=>standardDice.includes(sides)?standardDice:[...standardDice,sides].sort((a,b)=>a-b);
const displayValue=(kind,value)=>kind==='sides'?'d'+value:String(value);

function expressionParts(expression) {
  const match=expression.toLowerCase().replace(/\s/g,'').match(/^(\d{0,2})d(\d{1,3})([+-]\d{1,4})?$/);
  if(!match)return null;
  const quantity=Number(match[1]||1),sides=Number(match[2]);
  if(quantity>=1&&quantity<=50&&sides>=2&&sides<=100)return {quantity,sides,modifier:match[3]||''};
  return null;
}
const wheelOptions=(kind,values)=>values.map(value=>`<span data-dice-value="${value}" aria-hidden="true">${displayValue(kind,value)}</span>`).join('');

export function diceControlsMarkup(expression) {
  const {quantity,sides}=expressionParts(expression)||{quantity:1,sides:20};
  const wheel=(kind,label,values,value)=>`<div class="dice-knob"><span>${label}</span><div class="dice-wheel" data-dice-wheel="${kind}" tabindex="0" role="spinbutton" aria-label="${label}" aria-valuemin="${values[0]}" aria-valuemax="${values.at(-1)}" aria-valuenow="${value}" aria-valuetext="${displayValue(kind,value)}">${wheelOptions(kind,values)}</div></div>`;
  return `<div class="dice-knobs">${wheel('quantity','Quantity',quantities,quantity)}${wheel('sides','Die type',dieTypes(sides),sides)}</div>`;
}

export function mountDiceControls(root,input,onChange=()=>{}) {
  const wheels=[...root.querySelectorAll('[data-dice-wheel]')];
  if(!wheels.length||wheels[0].dataset.mounted)return;
  const selected=wheel=>Number(wheel.getAttribute('aria-valuenow'));
  function mark(wheel,option) {
    const value=Number(option.dataset.diceValue);
    wheel.querySelector('.is-selected')?.classList.remove('is-selected');
    option.classList.add('is-selected');
    wheel.setAttribute('aria-valuenow',value);
    wheel.setAttribute('aria-valuetext',option.textContent);
  }
  function position(wheel,index) {
    const option=wheel.children[index];
    if(!option)return;
    mark(wheel,option);
    wheel.scrollTop=index*option.offsetHeight;
  }
  const [quantity,sides]=wheels;
  function updateExpression() {
    input.value=`${selected(quantity)}d${selected(sides)}${expressionParts(input.value)?.modifier||''}`;
    onChange(input.value);
  }
  function syncFromExpression() {
    const parts=expressionParts(input.value);
    if(!parts)return;
    if(!sides.querySelector(`[data-dice-value="${parts.sides}"]`)){
      const types=dieTypes(parts.sides);
      sides.innerHTML=wheelOptions('sides',types);
      sides.setAttribute('aria-valuemin',types[0]);
    }
    for(const wheel of wheels)position(wheel,[...wheel.children].findIndex(option=>Number(option.dataset.diceValue)===parts[wheel.dataset.diceWheel]));
  }
  for(const wheel of wheels){
    wheel.dataset.mounted='true';
    position(wheel,[...wheel.children].findIndex(option=>Number(option.dataset.diceValue)===selected(wheel)));
    wheel.addEventListener('scroll',()=>{
      const height=wheel.firstElementChild.offsetHeight;
      const option=wheel.children[Math.round(wheel.scrollTop/height)];
      if(option&&selected(wheel)!==Number(option.dataset.diceValue)){mark(wheel,option);updateExpression();}
    },{passive:true});
    wheel.addEventListener('click',event=>{
      if(event.target.parentElement!==wheel)return;
      position(wheel,[...wheel.children].indexOf(event.target));updateExpression();
    });
    wheel.addEventListener('keydown',event=>{
      const current=[...wheel.children].findIndex(option=>Number(option.dataset.diceValue)===selected(wheel));
      const next={ArrowUp:current+1,ArrowRight:current+1,ArrowDown:current-1,ArrowLeft:current-1,Home:0,End:wheel.children.length-1}[event.key];
      if(next===undefined)return;
      event.preventDefault();
      position(wheel,Math.min(wheel.children.length-1,Math.max(0,next)));updateExpression();
    });
  }
  input.addEventListener('input',()=>{syncFromExpression();onChange(input.value);});
}
