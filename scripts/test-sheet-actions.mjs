import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {defaultPartyState} from '../tests/helpers/default-party.mjs';
import {checkSheetImprovements} from '../tests/helpers/sheet-improvements.mjs';

const root=resolve(import.meta.dirname,'..'),port=process.env.SHEET_ACTIONS_TEST_PORT||'4196';
const base=process.env.SHEET_ACTIONS_TEST_URL||`http://127.0.0.1:${port}/`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files/Mozilla Firefox/firefox.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Set BROWSER_PATH to a browser.');
let server,browser;
try {
  if(!process.env.SHEET_ACTIONS_TEST_URL) {
    server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Test server did not start')),10000);
      server.once('error',error=>{clearTimeout(timer);reject(error);});
      server.once('exit',code=>{clearTimeout(timer);reject(Error(`Test server exited (${code})`));});
      server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
      server.stderr.once('data',data=>{clearTimeout(timer);reject(Error(String(data)));});
    });
  }
  browser=await puppeteer.launch({executablePath,browser:/firefox/i.test(executablePath)?'firefox':'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  await page.goto(base,{waitUntil:'networkidle0'});
  await checkSheetImprovements(page,{base,original:defaultPartyState(),root});
  assert.deepEqual(errors,[]);
} finally {
  await browser?.close();
  server?.kill();
}
