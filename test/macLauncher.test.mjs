import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { launchServer, decideBuild, computeBuildFingerprint, ensureBuilt, readBuildStamp } from '../scripts/mac-launch.mjs';

async function options(t) {
  const root = await mkdtemp(join(tmpdir(), 'oprn launcher 한글 '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist-electron')); await writeFile(join(root, 'dist-electron/browser-bridge.js'), '// bridge');
  return { root, projectDir: join(root, 'my game'), signals: new EventEmitter(), log() {} };
}

test('browser opens only after SQLite host is ready and bridge is supplied', async t => {
  const config = await options(t); const ready = Promise.withResolvers(); let opened = false; let closed = 0;
  const pending = launchServer({ ...config, open: async () => { opened = true; }, startServer: async input => {
    assert.equal(input.projectDir, config.projectDir); assert.equal(input.browserBridgeSource, '// bridge');
    assert.equal(input.host, '127.0.0.1'); assert.equal(input.port, 9999);
    // 개인 실행은 루프백 전용 모드여야 한다. publicOrigin 을 넘기면 공유 호스트가 되어 AI 가 503 으로 꺼진다.
    assert.equal(input.publicOrigin, undefined); assert.equal(input.enableOwnerAi, undefined);
    await ready.promise; return { url: 'http://127.0.0.1:9999/', close: async () => { closed++; } };
  } });
  assert.equal(opened, false); ready.resolve(); const running = await pending; assert.equal(opened, true);
  config.signals.emit('SIGINT'); config.signals.emit('SIGTERM'); await running.closed;
  assert.equal(closed, 1); assert.equal(config.signals.listenerCount('SIGINT'), 0);
});

test('occupied port never opens a browser or reuses the existing server', async t => {
  const config = await options(t); let opened = false;
  await assert.rejects(launchServer({ ...config, open: async () => { opened = true; }, startServer: async () => { throw Object.assign(new Error('occupied'), { code: 'EADDRINUSE' }); } }), { code: 'PORT_BUSY' });
  assert.equal(opened, false); assert.equal(config.signals.listenerCount('SIGINT'), 0);
});

test('cancellation during host startup closes the late host without opening a browser', async t => {
  const config = await options(t); const ready = Promise.withResolvers(); let opened = false; let closed = 0;
  const pending = launchServer({ ...config, open: async () => { opened = true; }, startServer: async () => { await ready.promise; return { close: async () => { closed++; } }; } });
  config.signals.emit('SIGINT'); ready.resolve(); await assert.rejects(pending, { code: 'CANCELLED' });
  assert.equal(opened, false); assert.equal(closed, 1);
});

// ── 빌드 재사용 판정 ──
const stampOf = fingerprint => ({ version: 1, mode: 'git', fingerprint });

test('build decision: force, missing output, missing or old stamp and changed inputs rebuild', () => {
  const current = stampOf('aaa');
  assert.deepEqual(decideBuild({ force: true, outputsPresent: true, previous: current, current }), { build: true, reason: 'forced' });
  assert.equal(decideBuild({ outputsPresent: false, previous: current, current }).reason, 'missing-output');
  assert.equal(decideBuild({ outputsPresent: true, previous: null, current }).reason, 'missing-stamp');
  assert.equal(decideBuild({ outputsPresent: true, previous: { ...current, version: 0 }, current }).reason, 'missing-stamp');
  assert.equal(decideBuild({ outputsPresent: true, previous: stampOf('bbb'), current }).reason, 'changed');
  assert.deepEqual(decideBuild({ outputsPresent: true, previous: stampOf('aaa'), current }), { build: false, reason: 'up-to-date' });
});

test('fingerprint without git follows file size and mtime of the build inputs', async t => {
  const root = await mkdtemp(join(tmpdir(), 'oprn zip 한글 '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/깊은'), { recursive: true }); await writeFile(join(root, 'src/깊은/a.ts'), 'one'); await writeFile(join(root, 'index.html'), '<html>');
  const noGit = () => { throw new Error('not a git checkout'); };
  const first = computeBuildFingerprint(root, { git: noGit });
  assert.equal(first.mode, 'files');
  assert.equal(computeBuildFingerprint(root, { git: noGit }).fingerprint, first.fingerprint);
  await writeFile(join(root, 'src/깊은/a.ts'), 'one two');
  assert.notEqual(computeBuildFingerprint(root, { git: noGit }).fingerprint, first.fingerprint);
  const second = computeBuildFingerprint(root, { git: noGit });
  await writeFile(join(root, 'src/new.ts'), '');
  assert.notEqual(computeBuildFingerprint(root, { git: noGit }).fingerprint, second.fingerprint);
});

test('fingerprint with git uses HEAD and dirty inputs, and ignores an enclosing repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'oprn git '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src')); await writeFile(join(root, 'src/a.ts'), 'x');
  let head = 'h1'; let status = '';
  const git = (_cwd, args) => args[0] === 'rev-parse' ? (args[1] === 'HEAD' ? `${head}\n` : `${root}\n`) : status;
  const clean = computeBuildFingerprint(root, { git });
  assert.equal(clean.mode, 'git');
  head = 'h2'; const moved = computeBuildFingerprint(root, { git });
  assert.notEqual(moved.fingerprint, clean.fingerprint);
  status = ' M src/a.ts\0'; const dirty = computeBuildFingerprint(root, { git });
  assert.notEqual(dirty.fingerprint, moved.fingerprint);
  // 이미 더러운 파일을 다시 고치면 status 문자열은 같아도 지문이 바뀌어야 한다.
  await writeFile(join(root, 'src/a.ts'), 'xyz');
  assert.notEqual(computeBuildFingerprint(root, { git }).fingerprint, dirty.fingerprint);
  const nested = (cwd, args) => args[1] === '--show-toplevel' ? '/somewhere/else\n' : git(cwd, args);
  assert.equal(computeBuildFingerprint(root, { git: nested }).mode, 'files');
});

test('ensureBuilt builds once, stamps, then reuses the build until forced', async t => {
  const root = await mkdtemp(join(tmpdir(), 'oprn build '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runs = []; const logs = [];
  const run = async (_cmd, args) => {
    runs.push(args[1]);
    if (args[1] === 'build:packaged') { await mkdir(join(root, 'dist'), { recursive: true }); await writeFile(join(root, 'dist/index.html'), ''); }
    else { await mkdir(join(root, 'dist-electron'), { recursive: true }); await writeFile(join(root, 'dist-electron/browser-bridge.js'), ''); }
  };
  const options = { run, fingerprint: () => stampOf('same'), log: line => logs.push(line) };
  assert.equal((await ensureBuilt(root, options)).build, true);
  assert.deepEqual(runs, ['build:packaged', 'build:electron']);
  assert.equal(readBuildStamp(root).fingerprint, 'same');
  assert.equal((await ensureBuilt(root, options)).build, false);
  assert.equal(runs.length, 2);
  assert.deepEqual(logs, ['앱을 준비하는 중입니다(처음 한 번은 1~2분 걸려요)…', '이전 빌드를 그대로 씁니다.']);
  assert.equal((await ensureBuilt(root, { ...options, force: true })).reason, 'forced');
  assert.equal(runs.length, 4);
});

test('failed build leaves no stamp so the next launch rebuilds', async t => {
  const root = await mkdtemp(join(tmpdir(), 'oprn fail '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = async () => { throw new Error('build failed'); };
  await assert.rejects(ensureBuilt(root, { run, fingerprint: () => stampOf('x'), log() {} }));
  assert.equal(readBuildStamp(root), null);
});
