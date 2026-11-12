// Downloads the LDraw parts library into .ldraw/, and the parts still in
// review on the Parts Tracker into .ldraw-unofficial/ (each skipped if already there).
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';

const LIBRARIES = [
	{
		url: 'https://library.ldraw.org/library/updates/complete.zip',
		dest: path.resolve(process.env.LDRAW_DIR ?? '.ldraw')
	},
	{
		url: 'https://library.ldraw.org/library/unofficial/ldrawunf.zip',
		dest: path.resolve(process.env.LDRAW_UNOFFICIAL_DIR ?? '.ldraw-unofficial')
	}
];

for (const { url, dest } of LIBRARIES) {
	if (fs.existsSync(path.join(dest, '.questlog-complete'))) {
		console.log(`Already present in ${dest}`);
		continue;
	}
	console.log(`Downloading ${url}...`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);
	const zip = new Uint8Array(await res.arrayBuffer());

	console.log('Extracting...');
	const files = unzipSync(zip);
	// Bound concurrent writes: the large library otherwise extracts very slowly
	// on Windows HDDs. Only LDraw source and license files are needed by the packer.
	const entries = Object.entries(files).filter(([name]) => !name.endsWith('/') && /\.(dat|ldr|txt)$/i.test(name));
	const directories = new Set(entries.map(([name]) => path.dirname(path.join(dest, name.replace(/^ldraw\//, '')))));
	await Promise.all([...directories].map(dir => fs.promises.mkdir(dir, { recursive: true })));
	let next = 0;
	await Promise.all(Array.from({length:32}, async () => {
		while (next < entries.length) {
			const [name, data] = entries[next++];
			const out = path.resolve(dest, name.replace(/^ldraw\//, ''));
			if (!out.startsWith(path.resolve(dest) + path.sep)) throw new Error('Invalid archive path');
			// Reuse complete files from an interrupted extraction.
			const previous = await fs.promises.stat(out).catch(() => null);
			if (previous?.size !== data.length) await fs.promises.writeFile(out, data);
		}
	}));
	console.log(`Done: ${Object.keys(files).length} files in ${dest}`);
	fs.writeFileSync(path.join(dest, '.questlog-complete'), url);
}
