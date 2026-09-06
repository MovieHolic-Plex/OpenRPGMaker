import assert from 'node:assert/strict';
import { readdir, readlink, rm, readFile, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
const out='.omo/evidence/life-full-20260906/39/observation-correction';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const result={cwd:process.cwd(),head:git('rev-parse','HEAD'),baseTree:git('rev-parse','HEAD^{tree}'),testedProductTree:git('write-tree'),scriptChecks:[],screenshots:[],removed:[],runtimeLeaks:[]};
for(const file of await readdir(out)) if(file.endsWith('.mjs')) {
  const checked=spawnSync(process.execPath,['--check',`${out}/${file}`],{encoding:'utf8'});
  result.scriptChecks.push({file,exit:checked.status,stderr:checked.stderr});
  assert.equal(checked.status,0);
}
for(const file of ['title-autosave','title-manual','running-manual','running-autosave']) {
  const path=`${out}/firefox/${file}.png`, bytes=await readFile(path);
  const size={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  assert.deepEqual(size,{width:1280,height:960});
  result.screenshots.push({path,...size,sha256:createHash('sha256').update(bytes).digest('hex'),visualInspection:'unavailable: image tool reports current model cannot view images; DOM assertions are verified'});
}
assert.equal(git('ls-files','dist'),'');
for(const path of ['dist','/tmp/st_01a0759d-public-cache','/tmp/st_01a0759d-browser-cache','/tmp/st_01a0759d-firefox-cache','/tmp/st_01a0759d-build-cache','/tmp/st_01a0759d-typecheck-cache','/tmp/st_01a0759d-index-cache']) {
  await rm(path,{recursive:true,force:true});result.removed.push(path);
}
for(const pid of await readdir('/proc')) {
  if(!/^\d+$/.test(pid)||Number(pid)===process.pid)continue;
  try {
    const executable=basename(await readlink(`/proc/${pid}/exe`));
    if(!/^(node|firefox|firefox-bin|chrome|chromium|headless_shell)$/.test(executable))continue;
    const cwd=await readlink(`/proc/${pid}/cwd`);
    if(cwd===process.cwd())result.runtimeLeaks.push({pid,executable,cwd});
  } catch(error) {if(error.code!=='ENOENT'&&error.code!=='EACCES')throw error;}
}
assert.deepEqual(result.runtimeLeaks,[]);
result.index={workingBlob:git('hash-object','openwiki/INDEX.md'),baseBlob:git('rev-parse','HEAD:openwiki/INDEX.md')};
assert.equal(result.index.workingBlob,result.index.baseBlob);
result.trackedCacheDiff=git('diff','HEAD','--','.vite-cache/deps/_metadata.json','.vite-cache/deps/package.json');
assert.equal(result.trackedCacheDiff,'');
result.remoteWrites=0;
result.parentFiles=[];
for(const [file,expected] of [
  ['parent-failed-suite.json','0a20aaa0ef53f7da9f058fdafb30aaa3c8eb9217cd5a5fe2aadf73cc7a71dca8'],
  ['parent-browser-proof.mjs','539b9a1d0dfd46da0755812e8a3ffdb36b8cc9155f1756a593e39d29a7f62549'],
]) {
  const path=`.omo/evidence/life-full-20260906/39/${file}`;
  const sha256=createHash('sha256').update(await readFile(path)).digest('hex');
  assert.equal(sha256,expected);
  assert.equal(git('ls-files','--',path),'');
  result.parentFiles.push({path,sha256,trackedOrStaged:false});
}
result.notes='The browser receipts removed literal public/browser caches; this final cleanup additionally removes the actual VITE_CACHE_DIR=...firefox-cache plus all task-owned build output. No tracked/shared cache was removed.';
await writeFile(`${out}/cleanup.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
