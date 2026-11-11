import {mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
await mkdir(out,{recursive:true});
await mkdir(resolve(out,'assets'),{recursive:true});
for(const file of ['index.html','styles.css','app.js','model.js','icons.js','art.js','sw.js','manifest.webmanifest','.nojekyll'])await copyFile(resolve(root,file),resolve(out,file));
for(const file of ['icon.svg','icon-192.png','icon-512.png'])await copyFile(resolve(root,'assets',file),resolve(out,'assets',file));
console.log('Questlog built successfully → dist/ (static, GitHub Pages-ready)');
