import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {getInstalledBrowsers} from '@puppeteer/browsers';
export async function findChromium(){
  const explicit=process.env.CHROME_PATH||process.env.BROWSER_PATH;if(explicit)return explicit;
  const cache=resolve(import.meta.dirname,'../../.cache/puppeteer');
  const installed=await getInstalledBrowsers({cacheDir:cache}).catch(()=>[]);
  const local=installed.find(b=>existsSync(b.executablePath));if(local)return resolve(local.executablePath);
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
}
