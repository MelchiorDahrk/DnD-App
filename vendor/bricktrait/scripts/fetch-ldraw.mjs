// Explicit refresh replaces complete libraries, including removed upstream files.
// Ordinary builds reuse the last successful, self-contained local snapshot.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';

export const LIBRARIES = [
  {url:'https://library.ldraw.org/library/updates/complete.zip',dest:path.resolve(process.env.LDRAW_DIR ?? '.ldraw')},
  {url:'https://library.ldraw.org/library/unofficial/ldrawunf.zip',dest:path.resolve(process.env.LDRAW_UNOFFICIAL_DIR ?? '.ldraw-unofficial')}
];
export function archivePath(dest, name) {
  const clean=name.replaceAll('\\','/').replace(/^ldraw\//i,'');
  const out=path.resolve(dest,clean);
  if(!out.startsWith(path.resolve(dest)+path.sep))throw new Error('Invalid archive path');
  return out;
}
export async function fetchLibraries({refresh=false,libraries=LIBRARIES}={}) {
  const rename=async(from,to)=>{
    for(let attempt=0;;attempt++)try{return await fs.rename(from,to);}catch(error){
      if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=10)throw error;
      await new Promise(r=>setTimeout(r,300));
    }
  };
  for(const {url,dest} of libraries) {
    if(!refresh && await fs.access(path.join(dest,'.questlog-complete')).then(()=>true,()=>false)) {
      console.log(`Using cached library ${dest}`);continue;
    }
    console.log(`Downloading ${url}`);
    const response=await fetch(url,{signal:AbortSignal.timeout(300000)});
    if(!response.ok)throw new Error(`LDraw download failed: ${response.status}`);
    const zip=new Uint8Array(await response.arrayBuffer());
    const files=unzipSync(zip);
    console.log(`Extracting ${Object.keys(files).length} archive entries`);
    const stage=dest+`.refresh-${process.pid}`,backup=dest+`.previous-${process.pid}`;
    const clean=async target=>{
      if(path.dirname(target)!==path.dirname(dest)||!target.startsWith(dest+'.'))throw new Error('Unsafe refresh cleanup');
      await fs.rm(target,{recursive:true,force:true});
    };
    await clean(stage);await fs.mkdir(stage,{recursive:true});
    try {
      const entries=Object.entries(files).filter(([name])=>!name.endsWith('/')&&/\.(dat|ldr|txt|png)$/i.test(name));
      const outputs=entries.map(([name,data])=>[archivePath(stage,name),data]);
      await Promise.all([...new Set(outputs.map(([out])=>path.dirname(out)))].map(dir=>fs.mkdir(dir,{recursive:true})));
      let next=0;
      await Promise.all(Array.from({length:32},async()=>{
        while(next<outputs.length){const [out,data]=outputs[next++];await fs.writeFile(out,data);}
      }));
      await fs.access(path.join(stage,'parts'));await fs.access(path.join(stage,'p'));
      await fs.writeFile(path.join(stage,'.questlog-complete'),JSON.stringify({url,sha256:createHash('sha256').update(zip).digest('hex'),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),files:outputs.length},null,2)+'\n');
      await clean(backup);
      const hadPrevious=await fs.access(dest).then(()=>true,()=>false);
      if(hadPrevious)await rename(dest,backup);
      try{await rename(stage,dest);}catch(error){if(hadPrevious)await rename(backup,dest);throw error;}
      await clean(backup);
      console.log(`Installed ${outputs.length} files in ${dest}`);
    }finally{await clean(stage);}
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await fetchLibraries({refresh:process.argv.includes('--refresh')});
