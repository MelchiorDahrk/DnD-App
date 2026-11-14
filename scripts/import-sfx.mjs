// Development only. Normal builds/playback never contact the source repositories.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {unzipSync} from 'fflate';

const root=resolve(import.meta.dirname,'..');
const selection=JSON.parse(await readFile(resolve(root,'scripts/sfx-selection.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cache=resolve(root,'.cache/sfx/import');
await mkdir(cache,{recursive:true});
const offline=process.argv.includes('--offline');
async function download(url,expected){
  if(!/^[a-f0-9]{64}$/.test(expected))throw Error(`Missing pinned hash: ${url}`);
  const path=resolve(cache,expected);
  let bytes;try{bytes=await readFile(path);}catch{
    if(offline)throw Error(`Not cached: ${url}`);
    const response=await fetch(url);if(!response.ok)throw Error(`${response.status}: ${url}`);
    bytes=Buffer.from(await response.arrayBuffer());
  }
  if(hash(bytes)!==expected)throw Error(`SHA-256 mismatch: ${url}`);
  await writeFile(path,bytes);return bytes;
}
const catalogURL=`https://raw.githubusercontent.com/${selection.repository}/${selection.revision}/index.json`;
const catalog=JSON.parse(await download(catalogURL,selection.catalogSha256));
const ffmpeg=process.env.FFMPEG||'ffmpeg';
function run(args,encoding='utf8'){
  const result=spawnSync(ffmpeg,args,{encoding,windowsHide:true,maxBuffer:32*1024*1024});
  if(result.error||result.status!==0)throw Error(result.error?.message||String(result.stderr));
  return result;
}
const version=run(['-version']).stdout.split(/\r?\n/)[0];
const assets=[];
for(const chosen of selection.sounds){
  if(!/^[a-z0-9-]+$/.test(chosen.id)||!['dice','combat','magic','progression','inventory','interface','ambient'].includes(chosen.category))throw Error('Unsafe asset ID/category');
  const entry=chosen.catalogId?catalog.sounds.find(s=>s.id===chosen.catalogId):chosen;
  const local=chosen.sourceType==='user-provided';
  if(!entry||(!local&&entry.license!=='CC0-1.0'))throw Error(`Only verified CC0 or explicitly user-provided assets are allowed: ${chosen.id}`);
  if(local&&(!/^scripts\/sfx-sources\/[a-zA-Z0-9_. -]+\.(wav|mp3)$/.test(chosen.localFile||'')||chosen.localFile.includes('..')))throw Error(`Unsafe local source: ${chosen.id}`);
  const format=chosen.catalogId?['ogg','wav','flac','mp3'].find(f=>entry[`file_${f}`]):chosen.format;
  const originalSha256=chosen.catalogId?entry[`sha256_${format}`]:chosen.sha256;
  const sourceFileURL=local?null:chosen.catalogId?entry[`download_url_${format}`].replace('/main/',`/${selection.revision}/`):chosen.downloadUrl;
  let bytes=local?await readFile(resolve(root,chosen.localFile)):await download(sourceFileURL,originalSha256);
  if(local&&hash(bytes)!==originalSha256)throw Error(`SHA-256 mismatch: ${chosen.localFile}`);
  if(chosen.archivePath){
    bytes=unzipSync(bytes)[chosen.archivePath];
    if(!bytes||hash(bytes)!==chosen.extractedSha256)throw Error(`Archive member mismatch: ${chosen.id}`);
  }
  const input=resolve(cache,`${chosen.id}.${chosen.archivePath?'wav':format}`);
  await writeFile(input,bytes);
  const directory=resolve(root,'assets/sfx',chosen.category);await mkdir(directory,{recursive:true});
  const files={},sha256={},sizes={};
  const trim=[...(chosen.start!==undefined?['-ss',String(chosen.start)]:[]),...(chosen.duration?['-t',String(chosen.duration)]:[])];
  const measured=run(['-hide_banner','-i',input,...trim,'-af','aformat=channel_layouts=mono,volumedetect','-f','null','-']).stderr;
  const peak=Number(measured.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  if(!Number.isFinite(peak))throw Error(`Silent or invalid selection: ${chosen.id}`);
  const normalizationDb=Number(Math.min(20,-3-peak).toFixed(2));
  // Development mastering: consistent peaks, capped amplification and no runtime conversion.
  const filters=['aformat=sample_rates=44100:channel_layouts=mono',`volume=${normalizationDb}dB`,'alimiter=limit=0.707:level=false'];
  for(const outputFormat of ['ogg','mp3']){
    const path=`assets/sfx/${chosen.category}/${chosen.id}.${outputFormat}`;
    run(['-hide_banner','-loglevel','error','-y','-i',input,...trim,'-map_metadata','-1','-af',filters.join(','),'-ac','1','-ar','44100',...(outputFormat==='ogg'?['-c:a','libvorbis','-q:a','3','-fflags','+bitexact','-flags:a','+bitexact']:['-c:a','libmp3lame','-b:a','96k','-write_xing','0','-id3v2_version','0']),resolve(root,path)]);
    const output=await readFile(resolve(root,path));files[outputFormat]=path;sha256[outputFormat]=hash(output);sizes[outputFormat]=output.length;
  }
  const pcm=run(['-hide_banner','-loglevel','error','-i',resolve(root,files.ogg),'-f','s16le','-ac','1','-ar','44100','-'],null).stdout;
  assets.push({id:chosen.id,filename:`${chosen.id}.ogg`,category:chosen.category,files,catalogId:chosen.catalogId||null,author:chosen.author||null,pack:entry.pack,sourceURL:entry.source||null,sourceFileURL,license:entry.license||null,...(local?{sourceType:chosen.sourceType,localFile:chosen.localFile,originalFilename:basename(chosen.localFile)}:{}),originalSha256,originalFormat:format,...(chosen.archivePath?{archivePath:chosen.archivePath,extractedSha256:chosen.extractedSha256}:{}),duration:Number((pcm.length/88200).toFixed(3)),tags:chosen.tags||entry.tags,edit:{start:chosen.start||0,duration:chosen.duration||null,normalizationDb},sha256,sizes});
  console.log(`Imported ${chosen.id}`);
}
const manifest={version:1,source:{repository:selection.repository,revision:selection.revision,catalogURL,catalogSha256:selection.catalogSha256},encoding:{tool:version,ogg:'Vorbis q3, mono 44.1kHz',mp3:'LAME 96kbps, mono 44.1kHz',peakLimitDb:-3},assets};
await writeFile(resolve(root,'assets/sfx/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(root,'sound-assets.js'),`// Generated by scripts/import-sfx.mjs. Provenance: assets/sfx/manifest.json\nexport const SOUND_ASSETS = ${JSON.stringify(Object.fromEntries(assets.map(a=>[a.id,{files:a.files,duration:a.duration}])) ,null,2)};\nexport const SOUND_FILES = Object.values(SOUND_ASSETS).flatMap(asset=>Object.values(asset.files));\n`);
console.log(`${assets.length} sounds, ${assets.reduce((sum,a)=>sum+Object.values(a.sizes).reduce((n,v)=>n+v,0),0)} bytes including MP3 fallbacks.`);
