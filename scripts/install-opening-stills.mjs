#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { installStillArchive, validateStillRelease, verifyStills } from './lib/openingStillPack.mjs';
const checkout = resolve(import.meta.dirname, '..');
const controller = new AbortController();
let interruptedExit;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interruptedExit = signal === 'SIGINT' ? 130 : 143;
  controller.abort(new Error('스틸 작업이 취소됐습니다.'));
});
let staging, lock;
try {
  const { values } = parseArgs({ options: { root: { type: 'string' }, archive: { type: 'string' }, verify: { type: 'boolean' }, help: { type: 'boolean' } }, strict: true });
  if (values.help) console.log('npm run stills:install [-- --archive /path/rpg-zzu-stills-v1.tar]\nnpm run stills:verify [-- --root /path/checkout]\n다운로드에는 gh 로그인과 비공개 저장소 접근 권한이 필요합니다.');
  else {
    if (values.verify && values.archive) throw new Error('--verify와 --archive를 함께 사용할 수 없습니다.');
    const manifest = validateStillRelease(JSON.parse(await readFile(join(checkout, 'assets/stills-release-v1.json'), 'utf8')));
    const target = join(resolve(values.root ?? checkout), 'public/assets/stills/pack');
    const current = await verifyStills(target, manifest, controller.signal);
    if (values.verify) {
      if (!current.complete) throw new Error('누락/손상 ' + current.missing.length + '장: ' + current.missing.join(', '));
      console.log('스틸 검증: ' + current.verified + '/' + manifest.count + '장');
    } else if (current.complete && !values.archive) console.log('스틸 ' + current.verified + '장 — 이미 설치되어 있습니다.');
    else {
      await mkdir(join(target, '..'), { recursive: true });
      const lockPath = join(target, '../.install.lock');
      try { await mkdir(lockPath); lock = lockPath; } catch (e) { if (e.code === 'EEXIST') throw new Error('다른 스틸 설치가 진행 중입니다.'); throw e; }
      staging = await mkdtemp(join(tmpdir(), 'oprn-stills-'));
      let archive = values.archive ? resolve(values.archive) : join(staging, manifest.archive.fileName);
      if (!values.archive) await new Promise((ok, fail) => {
        const child = spawn('gh', ['release', 'download', manifest.tag, '--repo', manifest.repo, '--pattern', manifest.archive.fileName, '--dir', staging], { stdio: ['ignore', 'ignore', 'pipe'], signal: controller.signal });
        let stderr = '';
        child.stderr.on('data', b => { stderr = (stderr + b).slice(-500); });
        child.on('error', fail);
        child.on('close', code => code === 0 ? ok() : fail(new Error('gh 다운로드 실패: ' + stderr.trim())));
      });
      const result = await installStillArchive({ archive, target, manifest, signal: controller.signal });
      console.log('스틸 ' + result.verified + '/' + manifest.count + '장 설치·검증 완료.');
    }
  }
} catch (e) { console.error('스틸 작업 실패: ' + e.message); process.exitCode = interruptedExit ?? 1; }
finally {
  if (staging) await rm(staging, { recursive: true, force: true });
  if (lock) await rm(lock, { recursive: true, force: true });
}
