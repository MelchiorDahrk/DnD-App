import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createScanHandler} from './scan-api.mjs';
import {extractPortrait} from './portrait-scan-api.mjs';
import {validatePortraitPhotos} from '../portrait-scan.js';
const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.PORT||4173);
const scanHandler=createScanHandler();
const portraitHandler=createScanHandler({extract:extractPortrait,validateImages:validatePortraitPhotos,resultKey:'suggestions',subject:'portrait',model:process.env.OPENAI_PORTRAIT_MODEL||process.env.OPENAI_SCAN_MODEL||'gpt-4.1'});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.ldr':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(/^\/(?:dist\/)?api\/scan-sheet\/?$/.test(pathname)){await scanHandler(req,res);return;}
    if(/^\/(?:dist\/)?api\/suggest-portrait\/?$/.test(pathname)){await portraitHandler(req,res);return;}
    if(pathname.split('/').some(part=>part.startsWith('.')&&part!=='.nojekyll')||/^\/(?:scripts|tests|node_modules)(\/|$)/.test(pathname)){res.writeHead(403);res.end('Forbidden');return;}
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return;}
    let target=resolve(root,'.'+pathname);
    if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
    if((await stat(target)).isDirectory())target=resolve(target,'index.html');
    const body=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Questlog is ready at http://localhost:${port}`));
