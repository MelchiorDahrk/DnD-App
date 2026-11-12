// Compact, portable portrait saves. The 3D editor itself is Bricktrait's vendored code.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const partId=value=>value===null||(typeof value==='string'&&/^(?:unf\/)?[a-zA-Z0-9_-]{1,100}$/.test(value));
const color=value=>Number.isInteger(value)&&number(value,0,1000000);
export function validPortrait(value) {
  if(!object(value)||typeof value.image!=='string'||value.image.length>180000||!/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image))return false;
  const d=value.design;
  if(!object(d)||JSON.stringify(d).length>12000||!object(d.figure)||!object(d.view)||!object(d.style))return false;
  const f=d.figure;
  for(const key of ['head','headgear','neck','back','torso','legs','handR','handL']) {
    if(!object(f[key])||!partId(f[key].id)||!color(f[key].color))return false;
  }
  if(!color(f.torso.arms)||!color(f.torso.hands)||!color(f.legs.hips))return false;
  if(!['handR','handL'].every(k=>number(f[k].spin,-360,360)))return false;
  if(!object(f.pose)||!['head','armR','armL','raiseR','raiseL','wristR','wristL','legR','legL','spreadR','spreadL'].every(k=>number(f.pose[k],-360,360)))return false;
  if(!number(d.view.yaw,-70,70)||!number(d.view.pitch,-25,35)||!number(d.view.zoom,.4,2))return false;
  const s=d.style;
  return ['space','solid','gradient','none'].includes(s.background)&&['round','square'].includes(s.shape)&&
    ['ring','outline','retro'].every(k=>typeof s[k]==='boolean')&&
    ['backdrop','backdrop2','ringColor'].every(k=>typeof s[k]==='string'&&/^#[a-fA-F0-9]{6}$/.test(s[k]));
}

export function portraitMarkup(character) {
  const src=validPortrait(character.portrait)?character.portrait.image:'./assets/portrait-adventurer.webp';
  return `<img class="character-portrait" src="${src}" alt="" width="256" height="256">`;
}
