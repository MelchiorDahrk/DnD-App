import {mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dice-engine');
const require=createRequire(import.meta.url);
const diceRoot=resolve(dirname(require.resolve('open-dice-dnd')),'..');
// Keep rendered dice and their predictive collision shapes the same size.
// The pinned engine hardcodes size 1; adapt both creation paths without editing node_modules.
const sizePatches=new Map([
  [resolve(diceRoot,'src/dice.js').replaceAll('\\','/'),['const size = 1;','const size = options.size ?? 1;',1]],
  [resolve(diceRoot,'src/DiceRoller.js').replaceAll('\\','/'),['{ set: this._setFor(diceRoll), model: allowed[k]','{ size: diceRoll.size, set: this._setFor(diceRoll), model: allowed[k]',2]]
]);
const patchedFiles=new Set();
await build({
  configFile:false,
  resolve:{alias:[{find:/^open-dice-dnd$/,replacement:resolve(diceRoot,'src/index.js')}]},
  plugins:[{
    name:'questlog-dice-size',
    transform(source,id) {
      const patch=sizePatches.get(id.replaceAll('\\','/'));
      if(!patch)return;
      const [before,after,count]=patch;
      if(source.split(before).length-1!==count)throw new Error('Update the dice size adapter for this open-dice version.');
      patchedFiles.add(id.replaceAll('\\','/'));
      return {code:source.replaceAll(before,after),map:null};
    }
  }],
  build:{
    outDir:out,emptyOutDir:true,minify:true,
    lib:{entry:resolve(root,'scripts/dice-engine-entry.js'),formats:['es'],fileName:()=> 'dice-engine.js'},
    rolldownOptions:{output:{codeSplitting:false}}
  }
});
if(patchedFiles.size!==sizePatches.size)throw new Error('The dice build did not apply every size adapter.');
// Resolve Three from open-dice: the portrait maker uses a different Three version.
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
