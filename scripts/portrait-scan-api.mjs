import {readFile} from 'node:fs/promises';
import {PORTRAIT_SCAN_SCHEMA,PORTRAIT_SCAN_INSTRUCTIONS,validatePortraitPhotos,validatePortraitSuggestions} from '../portrait-scan.js';
import {fantasyCatalog} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';

export async function loadPortraitCatalog(){
  const base=new URL('../vendor/bricktrait/static/ldraw/',import.meta.url);
  const [parts,colors]=await Promise.all(['catalog.json','colors.json'].map(async name=>JSON.parse(await readFile(new URL(name,base),'utf8'))));
  return {catalog:[...fantasyCatalog(parts),{id:'standard',name:'Standard hips and legs',cat:'legs'}],colors:colors.filter(c=>!c.alpha)};
}

export async function extractPortrait(images,{apiKey,model='gpt-4.1',fetchImpl=fetch,signal,catalog,colors}={}){
  validatePortraitPhotos(images);
  if(!apiKey)throw new Error('Photo suggestions need OPENAI_API_KEY on the server. See the README’s portrait photo setup.');
  if(!catalog||!colors)({catalog,colors}=await loadPortraitCatalog());
  const reference={parts:catalog.map(({id,name,cat,kind})=>({id,name,cat,...(kind?{kind}:{})})),colors:colors.map(({code,name})=>({code,name}))};
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal,
    body:JSON.stringify({model,store:false,max_output_tokens:5000,instructions:PORTRAIT_SCAN_INSTRUCTIONS,
      input:[{role:'user',content:[{type:'input_text',text:`Suggest selections for the foreground LEGO character. Available reference catalog: ${JSON.stringify(reference)}`},...images.map(image_url=>({type:'input_image',image_url,detail:'high'}))]}],
      text:{format:{type:'json_schema',name:'portrait_selections',strict:true,schema:PORTRAIT_SCAN_SCHEMA}}})
  });
  if(!response.ok){
    const messages={401:'The photo service’s API key was rejected. Ask its owner to check the key.',403:'The photo service cannot access the vision model.',429:'The photo service is busy or out of API credits. Try again later.'};
    const error=new Error(messages[response.status]||'The vision service could not suggest portrait selections. Try again later.');error.status=response.status===429?429:502;throw error;
  }
  const result=await response.json();
  if(result.status!=='completed')throw new Error('Photo analysis did not finish. Try one clearer photo.');
  const content=(result.output||[]).flatMap(v=>v.content||[]);
  if(content.some(v=>v.type==='refusal'))throw new Error('This photo could not be analysed. Try a clear photo of a LEGO character.');
  const output=content.filter(v=>v.type==='output_text').map(v=>v.text).join('');
  if(output.length>30000)throw new Error('The photo service returned too much data. Try again.');
  let suggestions;try{suggestions=JSON.parse(output);}catch{throw new Error('The photo service returned unreadable suggestions. Try again.');}
  return validatePortraitSuggestions(suggestions,catalog,colors);
}
