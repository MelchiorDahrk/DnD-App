// Compile the existing Svelte state module for Node tests with installed tooling.
// Server compilation makes $state plain data; the actual browser tests use runes.
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {compileModule} from 'svelte/compiler';
const root=resolve(import.meta.dirname,'../..');
const lib=resolve(root,'vendor/bricktrait/src/lib');
let source=stripTypeScriptTypes(await readFile(resolve(lib,'state.svelte.ts'),'utf8'));
source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${pathToFileURL(resolve(lib,path+(path.endsWith('.js')?'':'.ts'))).href}'`);
const compiled=compileModule(source,{filename:'state.svelte.js',generate:'server'}).js.code;
await mkdir(resolve(root,'.tmp'),{recursive:true});
// Node runs test files in separate processes. Each worker needs its own module:
// another worker must never truncate a module while this one is importing it.
const directory=await mkdtemp(resolve(root,'.tmp/bricktrait-state-'));
const out=resolve(directory,'state.mjs');
await writeFile(out,compiled);
export const stateModuleURL=pathToFileURL(out).href;
export const state=await import(stateModuleURL);
