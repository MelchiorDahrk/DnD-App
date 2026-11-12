import {timingSafeEqual} from 'node:crypto';
import {SHEET_SCAN_SCHEMA,SHEET_SCAN_INSTRUCTIONS,SCAN_LIMITS,validateScanImages,characterFromScan} from '../sheet-scan.js';

export async function extractSheet(images,{apiKey,model='gpt-4.1',fetchImpl=fetch,signal}={}) {
  validateScanImages(images);
  if(!apiKey)throw new Error('Scanning is not connected. The server needs OPENAI_API_KEY. See the sheet scanning setup in the README.');
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal,
    body:JSON.stringify({model,store:false,max_output_tokens:14000,instructions:SHEET_SCAN_INSTRUCTIONS,
      input:[{role:'user',content:[{type:'input_text',text:'Transcribe these pages of the same character. Return only sheet data and review warnings.'},...images.map(image_url=>({type:'input_image',image_url,detail:'high'}))]}],
      text:{format:{type:'json_schema',name:'character_sheet',strict:true,schema:SHEET_SCAN_SCHEMA}}})
  });
  if(!response.ok){
    // Provider bodies can contain request details. Never echo them or credentials to clients/logs.
    const messages={401:'The scan server’s API key was rejected. Ask its owner to check the key.',403:'The scan server cannot access the vision model.',429:'The scan service is busy or out of API credits. Try again later.'};
    const error=new Error(messages[response.status]||'The vision service could not scan this sheet. Try again later.');error.status=response.status===429?429:502;throw error;
  }
  const result=await response.json();
  if(result.status!=='completed')throw new Error('The scan did not finish. Try fewer photos or a clearer page.');
  const content=(result.output||[]).flatMap(v=>v.content||[]);
  if(content.some(v=>v.type==='refusal'))throw new Error('The image could not be transcribed. Try a clear photo of the character sheet.');
  const output=content.filter(v=>v.type==='output_text').map(v=>v.text).join('');
  if(output.length>500000)throw new Error('The scanner returned too much data. Try fewer pages.');
  let scan;try{scan=JSON.parse(output);}catch{throw new Error('The scanner returned unreadable data. Try again.');}
  characterFromScan(scan); // Validate the complete shape and ensure it makes a valid character before returning it.
  return scan;
}

function secretMatches(value,expected) {
  const a=Buffer.from(value||''),b=Buffer.from(expected||'');
  return a.length===b.length&&timingSafeEqual(a,b);
}
const loopback = address => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
function json(res,status,body,headers={}) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}

export function createScanHandler({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_SCAN_MODEL||'gpt-4.1',accessToken=process.env.SCAN_ACCESS_TOKEN,allowedOrigins=(process.env.SCAN_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean),fetchImpl=fetch,extract=extractSheet,validateImages=validateScanImages,resultKey='scan',subject='sheet'}={}) {
  let active=0;
  const attempts=new Map();
  return async function handleScan(req,res) {
    const origin=req.headers.origin;
    let sameOrigin=false;
    try{const url=new URL(origin);sameOrigin=['http:','https:'].includes(url.protocol)&&url.host===req.headers.host;}catch{}
    const allowed=origin&&(sameOrigin||allowedOrigins.includes(origin));
    const cors=allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}:{};
    if(origin&&!allowed){json(res,403,{error:'This website is not allowed to use this scan service.'});return;}
    if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
    if(req.method!=='POST'){json(res,405,{error:`Use POST to analyse ${subject} photos.`},{...cors,Allow:'POST, OPTIONS'});return;}
    if(!apiKey){json(res,503,{error:`Photo analysis is not connected. The server needs OPENAI_API_KEY. GitHub Pages needs a separate photo service; see the README’s ${subject==='portrait'?'portrait photo':'sheet scanning'} setup.`},cors);return;}
    let localHost=false;try{localHost=['localhost','127.0.0.1','[::1]'].includes(new URL(`http://${req.headers.host}`).hostname);}catch{}
    if(!accessToken&&(!loopback(req.socket.remoteAddress)||!localHost)){json(res,503,{error:'This scan server needs SCAN_ACCESS_TOKEN before it can accept remote photos.'},cors);return;}
    if(accessToken&&!secretMatches(req.headers.authorization,`Bearer ${accessToken}`)){json(res,401,{error:'Enter the photo service access code in the service connection settings.'},cors);return;}
    if(!req.headers['content-type']?.toLowerCase().startsWith('application/json')){json(res,415,{error:'Send photos as JSON.'},cors);return;}
    const address=req.socket.remoteAddress,now=Date.now();
    for(const [key,entry] of attempts)if(now-entry.start>600000)attempts.delete(key);
    const entry=attempts.get(address)||{start:now,count:0};attempts.set(address,entry);
    if(active>=2||entry.count>=10){json(res,429,{error:'Too many scans. Please wait a few minutes before trying again.'},cors);return;}
    entry.count++;active++;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),120000);
    const cancel=()=>{if(!res.writableEnded)controller.abort();};res.once('close',cancel);
    try{
      if(Number(req.headers['content-length'])>SCAN_LIMITS.bodyBytes){const e=new Error('Photos are too large. Try fewer or smaller pages.');e.status=413;throw e;}
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>SCAN_LIMITS.bodyBytes){const e=new Error('Photos are too large. Try fewer or smaller pages.');e.status=413;throw e;}chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{const e=new Error('The photo upload was unreadable. Choose the photos again.');e.status=400;throw e;}
      try{validateImages(body?.images);}catch(e){e.status=400;throw e;}
      for(const image of body.images){
        const [,format,payload]=image.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
        const bytes=Buffer.from(payload,'base64');
        const valid=format==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:format==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
        if(!valid){const e=new Error('One photo is not a valid JPG, PNG, or WebP image.');e.status=400;throw e;}
      }
      const scan=await extract(body.images,{apiKey,model,fetchImpl,signal:controller.signal});
      if(!res.destroyed)json(res,200,{[resultKey]:scan},cors);
    }catch(error){if(!res.destroyed)json(res,error.status|| (controller.signal.aborted?504:502),{error:controller.signal.aborted?'Photo analysis timed out. Try one clear photo at a time.':error.message},cors);}
    finally{clearTimeout(timeout);res.removeListener('close',cancel);active--;}
  };
}
