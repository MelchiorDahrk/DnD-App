// Content fingerprints include the actual transitive geometry, not every pack.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const hash=data=>createHash('sha256').update(data).digest('hex');
export async function geometryFingerprinter(directory){
  const parse=text=>new Map(text.split(/^0 FILE /m).slice(1).map(section=>{const i=section.indexOf('\n');return [section.slice(0,i).trim(),section.slice(i+1)];}));
  const core=parse(await readFile(resolve(directory,'core.ldr'),'utf8')),shared=new Map();
  return async id=>{
    const pack=parse(await readFile(resolve(directory,'p',id+'.ldr'),'utf8'));
    const seen=new Map(),stack=[id+'.dat'];
    while(stack.length){
      const name=stack.pop();if(seen.has(name))continue;
      let text=pack.get(name)??core.get(name);
      if(text===undefined){if(!shared.has(name))shared.set(name,readFile(resolve(directory,'parts',name),'utf8'));text=await shared.get(name);}
      seen.set(name,hash(text));
      for(const line of text.split('\n')){const fields=line.trim().split(/\s+/);if(fields[0]==='1'&&fields.length>=15)stack.push(fields.slice(14).join(' '));}
    }
    return hash(JSON.stringify([...seen].sort(([a],[b])=>a.localeCompare(b))));
  };
}
