// Pre-renders every part thumbnail into static/thumbs/<id>.webp, so the
// catalogue shows up at once instead of rendering in the visitor's browser.
//
// Uses the app's own rendering code through a small Vite page
// (scripts/thumbs/) driven by a headless Chrome. Existing thumbnails are kept
// unless the rendering code changed, so reruns only add what is missing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { LDRAW_ICONS, equipmentIconParts, equipmentIconView } from '../../../equipment-icons.js';

const equipment = process.argv.includes('--equipment');
const OUT = equipment ? path.resolve('../../assets/equipment') : path.resolve('static/thumbs');
const BATCH = 40;
// Files that change how a thumbnail looks (new parts are simply added).
// Other changes that matter bump THUMB_VERSION in thumb-render.ts.
const INPUTS = ['src/lib/scene.ts', 'src/lib/thumb-render.ts', 'src/lib/ldraw.ts', 'scripts/thumbs/main.ts'];
if (equipment) INPUTS.push('../../equipment-icons.js', 'static/ldraw/catalog.json', 'src/lib/portrait-scene.ts', 'src/lib/lighting.ts', 'src/lib/materials.ts', 'src/lib/equipment-render.ts');

const CHROME =
	process.env.CHROME_PATH ??
	[
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
	].find((p) => fs.existsSync(p));
if (!fs.existsSync('static/ldraw/catalog.json')) throw new Error('Run `npm run build:portraits` from the Questlog root first');

// Start over when the rendering changed
const stamp = crypto.createHash('sha1');
for (const f of INPUTS) stamp.update(fs.readFileSync(f));
const version = stamp.digest('hex');
const versionFile = path.join(OUT, '.version');
const changed = !fs.existsSync(versionFile) || fs.readFileSync(versionFile, 'utf8') !== version;
if (!equipment && changed) {
	console.log('Rendering changed, rebuilding every thumbnail');
}
fs.mkdirSync(OUT, { recursive: true });
const mapped = Object.entries(LDRAW_ICONS).map(([key, item]) => {
	const parts = equipmentIconParts(item);
	return {id:parts[0].id,color:parts[0].color,parts,view:equipmentIconView(item),key};
});
const filename = item => path.join(OUT, `${equipment ? item.key : item.id}.webp`);
if (equipment && !changed && mapped.every(item => fs.existsSync(filename(item)))) {
	console.log(`${mapped.length} equipment thumbnails are up to date`);
	process.exit(0);
}
if (!CHROME) throw new Error('Thumbnail generation requires Chromium. Set CHROME_PATH (CI installs Chrome explicitly).');

const server = await createServer({
	configFile: false,
	root: path.resolve('scripts/thumbs'),
	publicDir: path.resolve('static'),
	logLevel: 'warn',
	server: { port: 0 }
});
await server.listen();
const url = server.resolvedUrls.local[0];

let browser;
try {
	browser = await puppeteer.launch({
		executablePath: CHROME,
		headless: true,
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
	});

	const page = await browser.newPage();
	page.on('pageerror', (e) => console.error('page:', e.message));
	await page.goto(url);
	const parts = await page.evaluate(() => window.thumbsReady);
	const items = equipment ? mapped : parts;
	const todo = items.filter(item => changed || !fs.existsSync(filename(item)));
	console.log(`${items.length} thumbnails, ${todo.length} to render`);

	let failed = 0;
	const start = Date.now();
	for (let i = 0; i < todo.length; i += BATCH) {
		const batch = todo.slice(i, i + BATCH);
		const urls = await page.evaluate((b) => window.renderThumbs(b), batch);
		batch.forEach((item, j) => {
			if (!urls[j]) return failed++;
			fs.writeFileSync(filename(item), Buffer.from(urls[j].split(',')[1], 'base64'));
		});
		const done = Math.min(i + BATCH, todo.length);
		process.stdout.write(`\r${done}/${todo.length} (${Math.round((Date.now() - start) / 1000)} s)`);
	}
	if (todo.length) process.stdout.write('\n');
	if (failed && equipment) throw new Error(`${failed} equipment thumbnails failed to render`);
	if (failed) console.warn(`${failed} thumbnails failed, the app renders them live`);
	fs.writeFileSync(versionFile, version);
} finally {
	await browser?.close();
	await server.close();
}
