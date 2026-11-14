import {mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dice-engine');
await build({
  configFile:false,
  build:{
    outDir:out,emptyOutDir:true,minify:true,
    lib:{entry:resolve(root,'scripts/dice-engine-entry.js'),formats:['es'],fileName:()=> 'dice-engine.js'},
    rolldownOptions:{output:{codeSplitting:false}}
  }
});
// Resolve Three from open-dice: the portrait maker uses a different Three version.
const require=createRequire(import.meta.url);
const diceRoot=resolve(dirname(require.resolve('open-dice-dnd')),'..');
const diceRequire=createRequire(resolve(diceRoot,'package.json'));
const threeRoot=resolve(dirname(diceRequire.resolve('three')),'..');
const cannonRoot=resolve(dirname(diceRequire.resolve('cannon-es')),'..');
await mkdir(resolve(out,'licenses'),{recursive:true});
for(const [source,name] of [
  [resolve(diceRoot,'LICENSE'),'open-dice.txt'],
  [resolve(diceRoot,'THIRD_PARTY_NOTICES.txt'),'third-party-notices.txt'],
  [resolve(threeRoot,'LICENSE'),'three.txt'],
  [resolve(cannonRoot,'LICENSE'),'cannon-es.txt']
])await copyFile(source,resolve(out,'licenses',name));
