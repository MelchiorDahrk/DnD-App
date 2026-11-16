import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {keywordMappings,verifiedColorMap} from './lib/rebrickable-inventories.mjs';
const root=resolve(import.meta.dirname,'..');
export async function buildRebrickableMappings(){
  const report=JSON.parse(await fs.readFile(resolve(root,'.cache/portrait-coverage/ldraw-build-report.json'),'utf8'));
  const data=JSON.parse(await fs.readFile(resolve(root,'vendor/bricktrait/presets/sources/rebrickable-bulk.json'),'utf8'));
  const colors=JSON.parse(await fs.readFile(resolve(root,'vendor/bricktrait/static/ldraw/colors.json'),'utf8'));
  const {parts,evidence,ambiguous}=keywordMappings(report.sourceParts),palette=verifiedColorMap(data.colors,colors);
  const output={version:1,notes:['Part IDs come only from explicit LDraw !KEYWORDS Rebrickable references.','Colors use unique exact normalized color names in both public sources. Numeric identity alone is not a mapping.','Ambiguous mappings are retained for review and never selected automatically.'],parts,colors:palette.map,evidence,colorEvidence:palette.evidence,ambiguous};
  await fs.writeFile(resolve(root,'vendor/bricktrait/presets/rebrickable-mappings.json'),JSON.stringify(output,null,2)+'\n');
  console.log(`Verified ${Object.keys(parts).length} part mappings, ${Object.keys(palette.map).length} colors; ${Object.keys(ambiguous).length} ambiguous IDs require review.`);
  return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildRebrickableMappings();
