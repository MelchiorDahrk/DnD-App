import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {execFile,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {deploymentGroups,deploymentOptions} from '../scripts/lib/deploy-suites.mjs';

const root=resolve(import.meta.dirname,'..');
const required=['sheet-layout','item-icons','magic-items','treasure','dice','themes','portraits','portrait-photos','presets'];

test('CI matrix partitions every required browser suite exactly once and fits the workflow deadline',()=>{
  const {matrix}=deploymentOptions(['--matrix']);
  const grouped=matrix.group.flatMap(group=>deploymentOptions(['--group',group]).suites);
  assert.deepEqual(grouped,deploymentOptions().suites);
  assert.deepEqual(grouped.map(([name])=>name).sort(),required.toSorted());
  assert.equal(new Set(grouped.map(([name])=>name)).size,required.length);
  const workflow=readFileSync(resolve(root,'.github/workflows/deploy.yml'),'utf8');
  const browserStep=workflow.match(/- name: Check production interactions, assets and offline behavior[\s\S]*?timeout-minutes:\s*(\d+)/);
  assert.ok(browserStep,'The production browser step has a bounded deadline.');
  for(const [group,suites] of Object.entries(deploymentGroups)) {
    const minutes=suites.reduce((sum,[,limit])=>sum+limit,0);
    assert.ok(minutes<Number(browserStep[1]),`${group}: suite limits leave room for the runner within the workflow step`);
  }
  for(const [name,minutes] of grouped) {
    assert.ok(existsSync(resolve(root,`scripts/test-${name}.mjs`)),name);
    assert.ok(minutes>0,name);
  }
  for(const group of ['dice','portraits','portrait-photos','presets'])assert.equal(deploymentGroups[group].length,1,'Heavy renderers run on separate machines.');
});

test('matrix output works without a build, browser or preview server',()=>{
  const result=spawnSync(process.execPath,['scripts/test-deploy.mjs','--matrix'],{
    cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,DEPLOY_TEST_URL:'invalid'}
  });
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim().replace(/^matrix=/,'')),deploymentOptions(['--matrix']).matrix);
});

test('invalid or empty group selections fail before checking the site',()=>{
  for(const args of [['--group'],['--group',''],['--group','unknown'],['--group','constructor'],['--group','dice','--matrix'],['--typo']]) {
    assert.throws(()=>deploymentOptions(args),/Usage:/);
  }
  const result=spawnSync(process.execPath,['scripts/test-deploy.mjs','--group','unknown'],{
    cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,DEPLOY_TEST_URL:'invalid'}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Usage:/);
  assert.doesNotMatch(result.stderr,/Invalid URL|Production app is unavailable/);
});

test('a browser suite failure exits unsuccessfully and records the failed group',async t=>{
  const preview=createServer((req,res)=>res.end('Preview ready'));
  await new Promise(done=>preview.listen(0,'127.0.0.1',done));
  t.after(()=>new Promise(done=>preview.close(done)));
  await mkdir(resolve(root,'.tmp'),{recursive:true});
  const temporary=await mkdtemp(resolve(root,'.tmp/deploy-runner-'));
  const summary=resolve(temporary,'summary.md');
  const diagnostics=resolve(temporary,'diagnostics');
  const failure=await promisify(execFile)(process.execPath,['scripts/test-deploy.mjs','--group','dice'],{
    cwd:root,windowsHide:true,timeout:15000,env:{
      ...process.env,DEPLOY_TEST_URL:`http://127.0.0.1:${preview.address().port}/production/`,
      BROWSER_PATH:resolve(temporary,'missing-browser.exe'),GITHUB_STEP_SUMMARY:summary,
      DEPLOY_TEST_DIAGNOSTICS_DIR:diagnostics
    }
  }).then(()=>null,error=>error);
  assert.ok(failure,'A failing browser suite must stop publication.');
  assert.equal(failure.code,1,failure.stderr);
  assert.match(failure.stderr,/dice checks failed/);
  assert.doesNotMatch(failure.stdout,/All production browser checks passed/);
  const report=JSON.parse(await readFile(resolve(diagnostics,'timings.json'),'utf8'));
  assert.equal(report.group,'dice');
  assert.deepEqual(report.timings.map(({suite,status})=>({suite,status})),[{suite:'dice',status:'failed'}]);
  assert.ok(report.timings[0].seconds>=0);
  assert.match(await readFile(resolve(diagnostics,'dice.log'),'utf8'),/missing-browser/);
  assert.match(await readFile(summary,'utf8'),/\| dice \| failed \|/);
});
