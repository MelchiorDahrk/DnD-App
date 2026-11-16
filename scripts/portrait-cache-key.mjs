import {readFile} from 'node:fs/promises';
import {renderDependencyFingerprint} from './lib/portrait-cache.mjs';
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
console.log(`dependencies=${renderDependencyFingerprint(lock)}`);
