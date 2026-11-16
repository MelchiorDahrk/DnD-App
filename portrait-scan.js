export const PORTRAIT_PHOTO_LIMITS={photos:3,fileBytes:15000000,imageBytes:3000000};
export const PORTRAIT_SLOTS={head:'Face',headgear:'Hair / headwear',neck:'Beard / neckwear',back:'Cape / back',torso:'Torso',legs:'Legs',handR:'Right hand',handL:'Left hand'};
const nullableNumber={type:['integer','null']};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const PORTRAIT_SCAN_SCHEMA=object({
  isMinifigure:{type:'boolean'},summary:{type:'string',maxLength:1000},
  warnings:{type:'array',items:{type:'string',maxLength:1000},maxItems:12},
  selections:{type:'array',maxItems:8,items:object({
    slot:{type:'string',enum:Object.keys(PORTRAIT_SLOTS)},id:{type:['string','null'],maxLength:100},
    color:nullableNumber,arms:nullableNumber,hands:nullableNumber,hips:nullableNumber,
    confidence:{type:'string',enum:['high','medium','low']},reason:{type:'string',maxLength:1000}
  })}
});

export function validatePortraitPhotos(images){
  if(!Array.isArray(images)||images.length<1||images.length>PORTRAIT_PHOTO_LIMITS.photos)throw new Error('Choose 1–3 photos of the same LEGO character.');
  for(const image of images){
    if(typeof image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new Error('Use JPG, PNG, or WebP photos.');
    if(image.length>PORTRAIT_PHOTO_LIMITS.imageBytes*4/3+100)throw new Error('A prepared photo is too large. Try a smaller image.');
  }
  return images;
}

function validateSuggestionShape(value,schema,path){
  if(value===null&&Array.isArray(schema.type)&&schema.type.includes('null'))return;
  const types=Array.isArray(schema.type)?schema.type:[schema.type];
  const type=Array.isArray(value)?'array':typeof value;
  if(!types.includes(type)&&!(types.includes('integer')&&Number.isInteger(value)))throw new Error(`The suggestions contained an invalid ${path}. Try matching again.`);
  if(schema.enum&&!schema.enum.includes(value))throw new Error(`The suggestions contained an invalid ${path}.`);
  if(typeof value==='number'&&(!Number.isFinite(value)||value<schema.minimum||value>schema.maximum))throw new Error(`The suggestions contained an out-of-range ${path}.`);
  if(typeof value==='string'&&value.length>schema.maxLength)throw new Error(`The suggestions contained too much text in ${path}.`);
  if(type==='array'){
    if(value.length>schema.maxItems)throw new Error(`Too many entries in ${path}.`);
    value.forEach((v,i)=>validateSuggestionShape(v,schema.items,`${path} ${i+1}`));
  }else if(type==='object'){
    if(!value)throw new Error(`The suggestions contained an invalid ${path}.`);
    for(const key of schema.required)if(!Object.hasOwn(value,key))throw new Error(`The suggestions omitted ${path}.${key}. Try again.`);
    if(Object.keys(value).some(key=>!Object.hasOwn(schema.properties,key)))throw new Error(`The suggestions contained unexpected fields in ${path}.`);
    for(const [key,child] of Object.entries(schema.properties))validateSuggestionShape(value[key],child,`${path}.${key}`);
  }
}

export function validatePortraitSuggestions(result,catalog,colors){
  validateSuggestionShape(result,PORTRAIT_SCAN_SCHEMA,'portrait suggestions');
  if(!result.isMinifigure)throw new Error(result.warnings[0]||'No single LEGO character was found. Choose clear photos of the same minifigure.');
  const parts=new Map(catalog.map(p=>[p.id,p]));
  const codes=new Set(colors.map(c=>c.code));
  const seen=new Set();
  for(const selection of result.selections){
    const {slot,id}=selection,cat=slot.startsWith('hand')?'hand':slot;
    if(seen.has(slot))throw new Error('The suggestions contained a duplicate slot. Try again.');
    seen.add(slot);
    if(id===null){if(['head','torso','legs'].includes(slot))throw new Error('A required portrait part was missing. Try a clearer photo.');}
    else if(parts.get(id)?.cat!==cat)throw new Error('A suggested part is unavailable. Try suggesting selections again.');
    for(const key of ['color','arms','hands','hips']){
      if(selection[key]!==null&&!codes.has(selection[key]))throw new Error('A suggested colour is unavailable. Try again.');
      if(selection[key]!==null&&key!=='color'&&!(slot==='torso'&&['arms','hands'].includes(key))&&!(slot==='legs'&&key==='hips'))throw new Error('A suggested colour belongs to the wrong slot. Try again.');
    }
  }
  if(!result.selections.length)throw new Error('No visible parts could be matched. Try a closer, well-lit photo.');
  return structuredClone(result);
}

/** Apply only reviewed slots; keep pose, camera and every other part untouched. */
export function applyPortraitSelections(figure,selections,catalog,colors){
  validatePortraitSuggestions({isMinifigure:true,summary:'',warnings:[],selections},catalog,colors);
  const next=structuredClone(figure);
  for(const selection of selections){
    const part=next[selection.slot];part.id=selection.id;
    for(const key of ['color','arms','hands','hips'])if(selection[key]!==null)part[key]=selection[key];
  }
  return next;
}
