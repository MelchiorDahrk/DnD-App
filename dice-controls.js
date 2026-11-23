const quantities=Array.from({length:50},(_,index)=>index+1);
const standardDice=[4,6,8,10,12,20,100];
const displayValue=(kind,value)=>kind==='sides'?'d'+value:String(value);

export function diceControlsMarkup({quantity=1,sides=20}={}) {
  const wheel=(kind,label,values,value)=>`<div class="dice-knob"><span>${label}</span><div class="dice-wheel" data-dice-wheel="${kind}" tabindex="0" role="spinbutton" aria-label="${label}" aria-valuemin="${values[0]}" aria-valuemax="${values.at(-1)}" aria-valuenow="${value}" aria-valuetext="${displayValue(kind,value)}">${values.map(option=>`<span data-dice-value="${option}" aria-hidden="true">${displayValue(kind,option)}</span>`).join('')}</div></div>`;
  return `<div class="dice-knobs">${wheel('quantity','Quantity',quantities,quantity)}${wheel('sides','Die type',standardDice,sides)}</div>`;
}

const selected=wheel=>Number(wheel.getAttribute('aria-valuenow'));

export function readDiceSelection(root) {
  return {
    quantity:selected(root.querySelector('[data-dice-wheel="quantity"]')),
    sides:selected(root.querySelector('[data-dice-wheel="sides"]')),
  };
}

export function mountDiceControls(root,onChange) {
  const wheels=[...root.querySelectorAll('[data-dice-wheel]')];
  if(!wheels.length||wheels[0].dataset.mounted)return;
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
  const notify=()=>onChange?.(readDiceSelection(root));
  for(const wheel of wheels){
    wheel.dataset.mounted='true';
    position(wheel,[...wheel.children].findIndex(option=>Number(option.dataset.diceValue)===selected(wheel)));
    wheel.addEventListener('scroll',()=>{
      const height=wheel.firstElementChild.offsetHeight;
      const option=wheel.children[Math.round(wheel.scrollTop/height)];
      if(option&&selected(wheel)!==Number(option.dataset.diceValue)){mark(wheel,option);notify();}
    },{passive:true});
    wheel.addEventListener('click',event=>{
      if(event.target.parentElement!==wheel)return;
      position(wheel,[...wheel.children].indexOf(event.target));notify();
    });
    wheel.addEventListener('keydown',event=>{
      const current=[...wheel.children].findIndex(option=>Number(option.dataset.diceValue)===selected(wheel));
      const next={ArrowUp:current+1,ArrowRight:current+1,ArrowDown:current-1,ArrowLeft:current-1,Home:0,End:wheel.children.length-1}[event.key];
      if(next===undefined)return;
      event.preventDefault();
      position(wheel,Math.min(wheel.children.length-1,Math.max(0,next)));notify();
    });
  }
}
