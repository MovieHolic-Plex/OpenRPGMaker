import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as tar from 'tar';
import ts from 'typescript';
import { sha256, validateStillRows, installStillArchive, verifyStills } from '../scripts/lib/openingStillPack.mjs';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'oprn-still-contract-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const bytes=Buffer.from('controlled fixture bytes');
  await writeFile(join(root,'one.png'),bytes);
  const archive=join(root,'pack.tar');
  await tar.c({file:archive,cwd:root},['one.png']);
  const still={id:'oprn-pack-still-one',fileName:'one.png',sha256:await sha256(join(root,'one.png')),bytes:bytes.length};
  const manifest={schemaVersion:1,repo:'MovieHolic-Plex/rpg-zzu',tag:'stills-v1',archive:{fileName:'rpg-zzu-stills-v1.tar',bytes:(await readFile(archive)).length,sha256:await sha256(archive)},count:1,totalBytes:bytes.length,stills:[still]};
  return {root,archive,manifest,target:join(root,'installed/pack')};
}

test('catalog builder emits parseable TS for multiline prompts and preserves bundled moods',async t=>{
  const {root}=await fixture(t);
  await mkdir(join(root,'scripts'));await mkdir(join(root,'src/assets'),{recursive:true});
  await copyFile(resolve('scripts/build-opening-still-catalog.mjs'),join(root,'scripts/build-opening-still-catalog.mjs'));
  await copyFile(resolve('src/assets/openingStillMoods.ts'),join(root,'src/assets/openingStillMoods.ts'));
  await writeFile(join(root,'manifest.json'),JSON.stringify({stills:[{id:'oprn-pack-still-one',fileName:'one.png',name:'장면',tags:['겨울'],prompt:'first\nline\r\u2028const bad = ;'}]}));
  const result=spawnSync(process.execPath,[join(root,'scripts/build-opening-still-catalog.mjs'),'--staging',root],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const source=await readFile(join(root,'src/assets/openingStillMoods.ts'),'utf8');
  assert.equal(ts.createSourceFile('catalog.ts',source,ts.ScriptTarget.Latest,true).parseDiagnostics.length,0);
  assert.match(source,/const PACK_STILL_MOODS: readonly OpeningStillMood\[\] = \[/);
  assert.match(source,/oprn-still-hero-dawn/);
});

test('install, verify, corruption detection and repair',async t=>{
  const f=await fixture(t);
  assert.equal((await installStillArchive(f)).complete,true);
  assert.equal((await verifyStills(f.target,f.manifest)).verified,1);
  await writeFile(join(f.target,'one.png'),'broken');
  assert.equal((await verifyStills(f.target,f.manifest)).complete,false);
  await installStillArchive(f);
  assert.equal((await verifyStills(f.target,f.manifest)).complete,true);
});

test('missing archive member is rejected before touching a healthy installation; staging is cleaned',async t=>{
  const f=await fixture(t);await installStillArchive(f);
  const previous=await readFile(join(f.target,'one.png'));
  f.manifest.stills.push({...f.manifest.stills[0],id:'oprn-pack-still-two',fileName:'two.png'});
  f.manifest.count=2;f.manifest.totalBytes*=2;
  await assert.rejects(installStillArchive(f),/누락\/손상/);
  assert.deepEqual(await readFile(join(f.target,'one.png')),previous);
  assert.deepEqual(await readdir(join(f.target,'..')),['pack']);
});

test('wrong archive hash and unsafe or duplicate catalog names are rejected',async t=>{
  const f=await fixture(t);f.manifest.archive.sha256='0'.repeat(64);
  await assert.rejects(installStillArchive(f),/sha256/);
  const row={id:'oprn-pack-still-a',fileName:'a.png',name:'a',tags:['a']};
  assert.throws(()=>validateStillRows([{...row,fileName:'../a.png'}]));
  assert.throws(()=>validateStillRows([row,row]));
});
