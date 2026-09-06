import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, lstatSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
const root='.omo/evidence/life-full-20260906/';
const protectedHashes={
  '4/VERIFY.md':'766f31c0a0a11033e31d20c57303f8cfa951450af20088ad0694af2c3b68b494',
  '5/VERIFY.md':'58e4fb3abe153835b92c599b706823476c1c3811bcfb427a73effb4b5f279b7e',
  '5-supervisor/attempt1-execution.json':'d4aa30974669d959a38f8f411ae62c21513b74f87eb7ec03c87be5bfa0ada321',
  '5-supervisor/browser-attempt2.json':'7f2feca0d9b0965690479d99b1f242f618fe03ff885f601bada279ecef381c75',
};
for(const [path,hash] of Object.entries(protectedHashes))assert.equal(createHash('sha256').update(readFileSync(root+path)).digest('hex'),hash,path);
execFileSync('git',['diff','--exit-code','4e2d1762','--','src','scripts','WISH.md','package.json','package-lock.json','vitest.config.ts','.omo/gates-baseline.json','test/actionDebounceFootprint.test.ts','test/fixtures/life-full/coverage.json']);
const before=readFileSync(root+'5/correction/debugSession-before.ts','utf8');
const after=readFileSync('test/debugSession.test.ts','utf8');
const assertions=text=>text.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('expect('));
assert.deepEqual(assertions(after),assertions(before));assert.equal(assertions(after).length,17);
assert.equal(after.includes('await load()'),false);assert.equal(after.includes('async ()'),false);
const features=JSON.parse(readFileSync('test/fixtures/life-full/coverage.json','utf8')).features;
assert.equal(features.length,51);assert.ok(features.every(row=>row.status==='not-run'));
const browser=JSON.parse(readFileSync(root+'5/correction/browser.json','utf8'));
const harnessReceipt=JSON.parse(readFileSync(root+'5/correction/harness.json','utf8'));
const harness=JSON.parse(harnessReceipt.output.split('\n').find(line=>line.startsWith('{"url":')));
const ports=[browser.port,harness.port];
for(const port of ports) await new Promise((resolve,reject)=>{
  const socket=createConnection({host:'127.0.0.1',port});
  socket.setTimeout(1000,()=>{socket.destroy();reject(new Error('Port check timeout '+port));});
  socket.once('connect',()=>{socket.destroy();reject(new Error('Listener remains '+port));});
  socket.once('error',error=>{socket.destroy();if(error.code==='ECONNREFUSED')resolve();else reject(error);});
});
const generatedFixture=root+'5/correction/project.json';
if(existsSync(generatedFixture))assert.deepEqual(readFileSync(generatedFixture),readFileSync(root+'5/project.json'));
const removed=[],absent=[];
for(const path of ['dist',root+'5/correction/browser-cache',root+'5/correction/harness-cache',root+'5/correction/module-cache',generatedFixture]) {
  if(!existsSync(path)){absent.push(path);continue;}
  assert.equal(lstatSync(path).isSymbolicLink(),false);
  assert.equal(execFileSync('git',['ls-files','--',path],{encoding:'utf8'}),'');
  rmSync(path,{recursive:true});assert.equal(existsSync(path),false);removed.push(path);
}
const result={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),protectedHashes,productAndProtectedInputsUnchanged:true,assertionsPreserved:17,testsPreserved:4,coverageNotRun:51,portsRefused:ports,removed,alreadyAbsent:absent,remoteWrites:0,dependenciesInstalled:0};
writeFileSync(new URL('cleanup.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
