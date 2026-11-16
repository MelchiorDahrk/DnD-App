import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RENDER_PACKAGES,REFERENCE_RENDER_FILES,renderDependencies,renderDependencyFingerprint,rendererFingerprint,referenceSignature,reusableReference} from '../scripts/lib/portrait-cache.mjs';

function fixture(){
  const packages=Object.fromEntries(RENDER_PACKAGES.map(name=>[`node_modules/${name}`,{version:'1.0.0',integrity:`sha512-${name}`} ]));
  packages['']={dependencies:{firebase:'1.0.0'},devDependencies:{vite:'1.0.0'}};
  packages['node_modules/vite'].dependencies={compiler:'^1'};
  packages['node_modules/compiler']={version:'1.2.0',integrity:'sha512-compiler'};
  packages['node_modules/firebase']={version:'1.0.0',integrity:'sha512-firebase'};
  return {lockfileVersion:3,packages};
}
const sources=()=>Object.fromEntries(REFERENCE_RENDER_FILES.map(file=>[file,`// ${file}\nrender();\n`]));

test('unrelated Firebase additions, updates and root lock metadata cannot invalidate portraits',()=>{
  const before=fixture(),after=structuredClone(before);
  after.packages[''].dependencies.firebase='2.0.0';
  after.packages[''].devDependencies['firebase-tools']='15.0.0';
  after.packages['node_modules/firebase']={version:'2.0.0',integrity:'changed'};
  after.packages['node_modules/firebase-tools']={version:'15.0.0',dependencies:{grpc:'1'}};
  after.packages['node_modules/grpc']={version:'1.0.0'};
  assert.equal(renderDependencyFingerprint(before),renderDependencyFingerprint(after));
  assert.equal(rendererFingerprint(sources(),before),rendererFingerprint(sources(),after));
  assert.deepEqual(renderDependencies(before),renderDependencies(JSON.parse(JSON.stringify(before,null,8))));
});
test('actual Three, renderer toolchain and transitive dependency changes invalidate the cache',()=>{
  const before=fixture();
  for(const name of [...RENDER_PACKAGES,'compiler']){
    const after=structuredClone(before);after.packages[`node_modules/${name}`].version='2.0.0';
    assert.notEqual(renderDependencyFingerprint(before),renderDependencyFingerprint(after),name);
  }
  const tampered=structuredClone(before);tampered.packages['node_modules/three'].integrity='different-code';
  assert.notEqual(renderDependencyFingerprint(before),renderDependencyFingerprint(tampered));
});
test('deduplicating an identical renderer dependency does not cause another render',()=>{
  const root=fixture(),nested=structuredClone(root);
  nested.packages['node_modules/vite/node_modules/compiler']=nested.packages['node_modules/compiler'];
  delete nested.packages['node_modules/compiler'];
  assert.equal(renderDependencyFingerprint(root),renderDependencyFingerprint(nested));
  delete nested.packages['node_modules/vite/node_modules/compiler'];
  assert.throws(()=>renderDependencyFingerprint(nested),/Missing locked portrait dependency/);
});
test('real rendering source edits invalidate references, line endings do not',()=>{
  const original=sources(),windows=Object.fromEntries(Object.entries(original).map(([file,text])=>[file,text.replaceAll('\n','\r\n')]));
  assert.equal(rendererFingerprint(original,fixture()),rendererFingerprint(windows,fixture()));
  const changed={...original,[REFERENCE_RENDER_FILES[0]]:'changed rendering output'};
  assert.notEqual(rendererFingerprint(original,fixture()),rendererFingerprint(changed,fixture()));
});
test('legacy cache adoption requires equivalent renderer inputs AND exact per-part geometry',()=>{
  const renderer=rendererFingerprint(sources(),fixture()),geometry='actual-part-geometry';
  const cache={signature:referenceSignature('old-full-lock-hash',geometry),views:['existing descriptor']};
  const migrations=[{inputFingerprint:renderer,legacyRendererHashes:['old-full-lock-hash']}];
  assert.equal(reusableReference(cache,renderer,geometry,migrations),'legacy');
  assert.equal(reusableReference(cache,renderer,'edited-geometry',migrations),false);
  assert.equal(reusableReference(cache,'edited-renderer',geometry,migrations),false);
  assert.equal(reusableReference(cache,renderer,geometry,[]),false);
  const current={signature:referenceSignature(renderer,geometry)};
  assert.equal(reusableReference(current,renderer,geometry,migrations),'current');
});
test('CI uses scoped dependencies, retains old cache restore paths, and saves before Firebase tests',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8');
  const key=workflow.split('\n').find(line=>line.includes('key: bricktrait-ldraw-'));
  assert.match(key,/portrait-inputs.outputs.dependencies/);
  assert.doesNotMatch(key,/package-lock\.json|src\/lib\/\*\*/);
  assert.match(workflow,/bricktrait-ldraw-f333d939-v4-/);
  assert.ok(workflow.indexOf('- name: Save generated portrait assets')<workflow.indexOf('- name: Verify Firebase accounts'));
  assert.ok(workflow.indexOf('- name: Save generated equipment thumbnails')<workflow.indexOf('- name: Verify Firebase accounts'));
});
