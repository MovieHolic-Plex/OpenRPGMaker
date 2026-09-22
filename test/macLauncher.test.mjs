import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { launchServer } from '../scripts/mac-launch.mjs';

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
