import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
// Always package from source so removed files cannot survive a local rebuild.
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of ['firebase-config.js','firebase-client.js','cloud-model.js','cloud-store.js','cloud-sync.js','cloud-ui.js'])await copyFile(resolve(root,file),resolve(out,file));
await cp(resolve(root,'firebase-sdk'),resolve(out,'firebase-sdk'),{recursive:true});
// The JSON setting contains public Firebase web identifiers only. An empty value
// keeps the checked-in public project; "null" produces a guest-only build.
if(process.env.QUESTLOG_FIREBASE_CONFIG?.trim()){
  const {writeFile}=await import('node:fs/promises');
  const config=JSON.parse(process.env.QUESTLOG_FIREBASE_CONFIG);
  await writeFile(resolve(out,'firebase-config.js'),`export const firebaseConfig=${JSON.stringify(config)};\nexport function configuration(scope=globalThis){return Object.hasOwn(scope,'QUESTLOG_FIREBASE_CONFIG')?scope.QUESTLOG_FIREBASE_CONFIG:firebaseConfig;}\n`);
}
for(const file of ['dice-roller.js','dice-roller.css'])await copyFile(resolve(root,file),resolve(out,file));
await cp(resolve(root,'dice-engine'),resolve(out,'dice-engine'),{recursive:true});
await mkdir(resolve(out,'assets'),{recursive:true});
await copyFile(resolve(root,'sheet-actions.js'),resolve(out,'sheet-actions.js'));
await copyFile(resolve(root,'condition-usage.js'),resolve(out,'condition-usage.js'));
for(const file of ['portrait-defaults.js','portrait-default-data.js'])await copyFile(resolve(root,file),resolve(out,file));
await copyFile(resolve(root,'published-feat-data.js'),resolve(out,'published-feat-data.js'));
for(const file of ['inventory-rules.js','inventory.js','armor-class.js'])await copyFile(resolve(root,file),resolve(out,file));
for(const file of ['training-data.js','training-rules.js','training-ui.js'])await copyFile(resolve(root,file),resolve(out,file));
await copyFile(resolve(root,'magic-item-data.js'),resolve(out,'magic-item-data.js'));
await copyFile(resolve(root,'treasure-data.js'),resolve(out,'treasure-data.js'));
for(const file of ['legacy-magic-item-data.js','magic-item-icon-names.js'])await copyFile(resolve(root,file),resolve(out,file));
for(const file of ['reference-links.js','reference-pages.js','attack-rules.js','attack-ui.js','level-up.js','level-up-ui.js','progression-data.js','progression-options.js','rest-rules.js','rest-reference-data.js','portrait-scan.js','portrait-photo-ui.js','portrait-image-analysis.js','portrait-match.js','portrait-match-worker.js'])await copyFile(resolve(root,file),resolve(out,file));
for(const file of ['index.html','theme.js','theme.css','styles.css','app.js','sound.js','sound-events.js','sound-assets.js','vfx.js','vfx.css','model.js','sheet-layout.js','character-hero.js','portrait.js','portrait-ui.js','catalog.js','feature-catalog.js','catalog-ui.js','content-sources.js','default-characters.js','icons.js','equipment-icons.js','item-icons.js','art.js','sw.js','manifest.webmanifest','.nojekyll'])await copyFile(resolve(root,file),resolve(out,file));
for(const file of ['icon.svg','icon-192.png','icon-512.png','portrait-adventurer.webp'])await copyFile(resolve(root,'assets',file),resolve(out,'assets',file));
await cp(resolve(root,'portrait-maker'),resolve(out,'portrait-maker'),{recursive:true});
await cp(resolve(root,'assets/gui'),resolve(out,'assets/gui'),{recursive:true});
await cp(resolve(root,'assets/equipment'),resolve(out,'assets/equipment'),{recursive:true});
await cp(resolve(root,'assets/status-icons'),resolve(out,'assets/status-icons'),{recursive:true});
await cp(resolve(root,'assets/sfx'),resolve(out,'assets/sfx'),{recursive:true});
console.log('Questlog built successfully → dist/ (static, GitHub Pages-ready)');
