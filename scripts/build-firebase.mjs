import {build} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await build({configFile:false,build:{outDir:resolve(root,'firebase-sdk'),emptyOutDir:true,minify:true,lib:{entry:resolve(root,'scripts/firebase-entry.js'),formats:['es'],fileName:()=> 'firebase.js'},rolldownOptions:{output:{codeSplitting:false}}}});
await mkdir(resolve(root,'firebase-sdk'),{recursive:true});
await writeFile(resolve(root,'firebase-sdk/LICENSE'),'Firebase JavaScript SDK — Copyright Google LLC\n\n'+await readFile(resolve(root,'docs/licenses/firebase-Apache-2.0.txt'),'utf8'));
