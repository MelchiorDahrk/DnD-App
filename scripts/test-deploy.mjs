import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const port=process.env.DEPLOY_TEST_PORT||'4199';
const base=new URL(process.env.DEPLOY_TEST_URL||`http://127.0.0.1:${port}/dist/`);
assert.ok(base.pathname.endsWith('/'),'DEPLOY_TEST_URL must end with / so Pages asset paths resolve correctly.');
const env={...process.env,QUESTLOG_VISUAL_CHECKS:process.env.QUESTLOG_VISUAL_CHECKS||'0',THEME_TEST_PRODUCTION:'1'};
for(const key of ['PRESET_TEST_URL','PORTRAIT_TEST_URL','SHEET_TEST_URL','ITEM_ICON_TEST_URL','DICE_TEST_URL','THEME_TEST_URL','MAGIC_ITEM_TEST_URL'])env[key]=base.href;
const suites=[
  ['sheet-layout',3],['item-icons',3],['magic-items',3],['dice',4],['themes',5],
  ['portraits',10],['portrait-photos',5],['presets',5]
];
const diagnostics=resolve(root,'.tmp/browser-diagnostics/deploy');
await mkdir(diagnostics,{recursive:true});
let server,serverError,serverLog='';

async function runSuite(name,minutes) {
  const start=Date.now();
  console.log(`RUN production ${name} checks at ${base.href} (limit ${minutes} minutes)`);
  let output='',timedOut=false;
  const child=spawn(process.execPath,[`scripts/test-${name}.mjs`],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  for(const [stream,destination] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]) {
    stream.on('data',data=>{output+=data;destination.write(data);});
  }
  const timer=setTimeout(()=>{timedOut=true;child.kill();},minutes*60000);
  try {
    await new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('close',(code,signal)=>{
        if(timedOut)reject(new Error(`${name} checks exceeded ${minutes} minutes.`));
        else if(code!==0)reject(new Error(`${name} checks failed (${signal||code}). See ${diagnostics}.`));
        else resolve();
      });
    });
    console.log(`PASS production ${name} checks (${((Date.now()-start)/1000).toFixed(1)}s)`);
  } finally {
    clearTimeout(timer);
    await writeFile(resolve(diagnostics,`${name}.log`),output);
  }
}

try {
  if(!process.env.DEPLOY_TEST_URL) {
    assert.ok(existsSync(resolve(root,'dist/index.html')),'Build the production app first: npm run build');
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...env,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
    server.once('error',error=>{serverError=error;});
    for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog+=data;});
  }
  const deadline=Date.now()+10000;
  while(true) {
    if(serverError)throw serverError;
    if(server&&server.exitCode!==null)throw new Error(`Production preview server exited (${server.exitCode}): ${serverLog}`);
    try {
      const response=await fetch(base,{signal:AbortSignal.timeout(1000)});
      await response.arrayBuffer();
      if(response.ok)break;
    } catch { /* Retry while the local preview starts. */ }
    if(Date.now()>=deadline)throw new Error(`Production app is unavailable at ${base.href}. ${serverLog}`);
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  for(const [name,minutes] of suites)await runSuite(name,minutes);
  console.log('All production browser checks passed.');
} finally {
  server?.kill();
  if(serverLog)await writeFile(resolve(diagnostics,'server.log'),serverLog);
}
