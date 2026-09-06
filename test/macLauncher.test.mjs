import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, stat, rm, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { EventEmitter, once } from 'node:events';
import { spawn } from 'node:child_process';

const api = () => import('../scripts/mac-launch.mjs');
async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'RPG launcher 한글 '));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('new entrypoints require Node 24, not older or newer majors', async () => {
  const { requireNode24 } = await import('../scripts/setup-local.mjs');
  for (const version of ['20.19.0', '22.12.0', '25.0.0', 'garbage']) assert.throws(() => requireNode24(version), { code: 'NODE_VERSION' });
  assert.doesNotThrow(() => requireNode24('24.11.1'));
});

test('npm is required; ci runs only when node_modules is absent, never repairs broken installs', async t => {
  const { ensureDependencies } = await import('../scripts/setup-local.mjs');
  const root = await directory(t);
  const calls = [];
  const run = async (command, args, options) => { calls.push([command, args, options.cwd]); };
  await ensureDependencies(root, run);
  assert.deepEqual(calls, [['npm', ['--version'], root], ['npm', ['ci'], root]]);
  await mkdir(join(root, 'node_modules'));
  calls.length = 0;
  await ensureDependencies(root, run);
  assert.deepEqual(calls, [['npm', ['--version'], root]]);
  await rm(join(root, 'node_modules'), { recursive: true });
  await symlink(join(root, 'missing'), join(root, 'node_modules'));
  calls.length = 0;
  await ensureDependencies(root, run);
  assert.equal(calls.length, 1);
  await assert.rejects(ensureDependencies(root, async () => { throw new Error('missing'); }), { code: 'NPM_MISSING' });
});

test('failed install stops with recovery instead of starting server or deleting partial install', async t => {
  const { ensureDependencies } = await import('../scripts/setup-local.mjs');
  const root = await directory(t);
  await assert.rejects(ensureDependencies(root, async (_command, args) => {
    if (args[0] === 'ci') { await mkdir(join(root, 'node_modules')); throw new Error('failure'); }
  }), { code: 'INSTALL_FAILED' });
  assert.equal((await stat(join(root, 'node_modules'))).isDirectory(), true);
});

test('Vite is strict loopback HTTP with runner; browser opens only after own listen succeeds', { timeout: 10000 }, async () => {
  const { launchServer } = await api();
  const gate = Promise.withResolvers();
  const listening = Promise.withResolvers();
  const signals = new EventEmitter();
  let opened = ''; let closed = 0;
  const server = { listen: async () => { listening.resolve(); await gate.promise; }, close: async () => { closed++; } };
  const started = launchServer({ root: '/tmp/space 한글', projectId: 'my & 한글#project', signals, log() {}, open: async url => { opened = url; }, createServer: async options => {
    assert.equal(options.configLoader, 'runner');
    assert.equal(options.root, '/tmp/space 한글');
    assert.deepEqual(options.server, { host: '127.0.0.1', port: 9999, strictPort: true, https: false, open: false });
    return server;
  } });
  await listening.promise;
  assert.equal(opened, '');
  gate.resolve();
  const running = await started;
  assert.equal(new URL(opened).origin, 'http://127.0.0.1:9999');
  assert.equal(new URL(opened).searchParams.get('project'), 'my & 한글#project');
  signals.emit('SIGTERM');
  await running.closed;
  assert.equal(closed, 1);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('port conflicts close own server and never open or reuse another origin', async () => {
  const { launchServer } = await api();
  let closed = 0;
  const signals = new EventEmitter();
  await assert.rejects(launchServer({ root: '.', projectId: 'existing', signals, log() {}, open: () => assert.fail('must not open'), createServer: async () => ({ listen: async () => { throw Object.assign(new Error('Port 9999 is already in use'), { code: 'EADDRINUSE' }); }, close: async () => { closed++; } }) }), { code: 'PORT_BUSY' });
  assert.equal(closed, 1);
  assert.equal(signals.listenerCount('SIGINT'), 0);
});

test('browser failure reports stable URL and no-open bypasses browser; SIGINT closes exactly once', async () => {
  const { launchServer } = await api();
  for (const open of [false, async () => { throw new Error('unavailable'); }]) {
    const signals = new EventEmitter(); const logs = []; let closed = 0;
    const running = await launchServer({ root: '.', projectId: 'existing', signals, log: line => logs.push(line), open, createServer: async () => ({ listen: async () => {}, close: async () => { closed++; } }) });
    assert.ok(logs.some(line => line.includes('http://127.0.0.1:9999/?project=existing')));
    signals.emit('SIGINT'); signals.emit('SIGTERM');
    await running.closed;
    assert.equal(closed, 1);
  }
});

test('Finder bash wrapper quotes paths and preserves arguments from another cwd', async t => {
  const root = await directory(t);
  await mkdir(join(root, 'scripts'));
  await copyFile(new URL('../Start RPG Maker.command', import.meta.url), join(root, 'Start RPG Maker.command'));
  await writeFile(join(root, 'scripts/mac-launch.mjs'), 'console.log(JSON.stringify({cwd:process.cwd(), args:process.argv.slice(2)}));');
  const child = spawn('/bin/bash', [join(root, 'Start RPG Maker.command'), '--no-open'], { cwd: '/', env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` }, stdio: ['ignore', 'pipe', 'pipe'] });
  const ended = once(child, 'close', { signal: AbortSignal.timeout(10000) });
  let stdout = ''; child.stdout.on('data', chunk => { stdout += chunk; });
  const [code] = await ended;
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), { cwd: root, args: ['--no-open'] });
});


test('signals during pending Vite startup close owned resources without opening browser', { timeout: 10000 }, async () => {
  const { launchServer } = await api();
  for (const phase of ['create', 'listen']) {
    const entered = Promise.withResolvers(); const release = Promise.withResolvers();
    const signals = new EventEmitter(); let closed = 0; let listens = 0;
    const server = { listen: async () => { listens++; if (phase === 'listen') { entered.resolve(); await release.promise; } }, close: async () => { closed++; } };
    const pending = launchServer({ root: '.', projectId: 'existing', signals, log: () => assert.fail('must not report ready'), open: () => assert.fail('must not open'), createServer: async () => {
      if (phase === 'create') { entered.resolve(); await release.promise; }
      return server;
    } });
    const rejected = assert.rejects(pending, { code: 'CANCELLED' });
    await entered.promise;
    signals.emit('SIGINT');
    release.resolve();
    await rejected;
    assert.equal(closed, 1);
    assert.equal(listens, phase === 'create' ? 0 : 1);
    assert.equal(signals.listenerCount('SIGINT'), 0);
  }
});

test('real Vite strict-port collision preserves the other HTTP server', { timeout: 15000 }, async t => {
  const { launchServer } = await api();
  const { createServer: vite } = await import('vite');
  const { createServer: http } = await import('node:http');
  const other = http((_req, res) => res.end('other owner'));
  const listening = once(other, 'listening'); other.listen(0, '127.0.0.1'); await listening;
  t.after(() => new Promise(resolve => other.close(resolve)));
  const port = other.address().port;
  const root = await directory(t);
  await assert.rejects(launchServer({ root, projectId: 'existing', signals: new EventEmitter(), open: () => assert.fail('must not open'), createServer: options => {
    // Remap only the occupied port to isolate tests from real user port 9999.
    // Keep the actual Vite create/listen/close and strictPort contract intact.
    assert.equal(options.server.port, 9999);
    return vite({ ...options, configFile: false, server: { ...options.server, port } });
  } }), { code: 'PORT_BUSY' });
  const response = await fetch(`http://127.0.0.1:${port}`);
  assert.equal(await response.text(), 'other owner');
});


test('command cancellation forwards SIGTERM and reaps the owned child', { timeout: 15000 }, async () => {
  const script = new URL('../scripts/setup-local.mjs', import.meta.url).href;
  const childCode = `console.log('OWNED_READY:' + process.pid);process.stdin.resume();`;
  const parentCode = `import {runCommand} from ${JSON.stringify(script)}; await runCommand(process.execPath, ['-e', ${JSON.stringify(childCode)}], {stdio:['pipe','inherit','inherit']}).catch(()=>{process.exitCode=1;});`;
  const parent = spawn(process.execPath, ['--input-type=module', '-e', parentCode], { stdio: ['ignore', 'pipe', 'pipe'] });
  let ownedPid;
  try {
    const ready = new Promise((resolveReady, reject) => {
      let output = '';
      parent.stdout.on('data', data => { output += data; const match = output.match(/OWNED_READY:(\d+)/); if (match) resolveReady(Number(match[1])); });
      parent.once('error', reject);
      parent.once('exit', () => reject(new Error('parent exited before child readiness')));
    });
    const ended = once(parent, 'close', { signal: AbortSignal.timeout(10000) });
    ownedPid = await ready;
    parent.kill('SIGTERM');
    const [code, signal] = await ended;
    assert.equal(code, 1);
    assert.equal(signal, null);
    assert.throws(() => process.kill(ownedPid, 0), { code: 'ESRCH' });
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
    if (ownedPid) { try { process.kill(ownedPid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
  }
});


test('CLI pins the validated normalized configuration snapshot for Vite after the probe', { timeout: 15000 }, async t => {
  const { createServer: http } = await import('node:http');
  const root = await directory(t);
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'node_modules/vite'), { recursive: true });
  for (const name of ['mac-launch.mjs', 'setup-local.mjs']) await copyFile(new URL(`../scripts/${name}`, import.meta.url), join(root, 'scripts', name));
  const file = join(root, '.env.local');
  const backend = http(async (_req, res) => {
    // Another owner may edit configuration while a read probe is in flight.
    await writeFile(file, 'SUPABASE_UPSTREAM_URL=http://unsafe.invalid\nSUPABASE_ANON_KEY=sb_secret_wrong\nVITE_SUPABASE_PROJECT_ID=wrong\n');
    res.end('[{"project_id":"existing"}]');
  });
  const listening = once(backend, 'listening'); backend.listen(0, '127.0.0.1'); await listening;
  t.after(() => new Promise(resolveClosed => backend.close(resolveClosed)));
  const origin = `http://127.0.0.1:${backend.address().port}`;
  await writeFile(file, `SUPABASE_UPSTREAM_URL=HTTP://127.0.0.1:${backend.address().port}/\nSUPABASE_ANON_KEY=sb_publishable_fixture\nVITE_SUPABASE_PROJECT_ID=existing\nVITE_SUPABASE_USE_PROXY=1\n`);
  await writeFile(join(root, 'node_modules/vite/package.json'), '{"type":"module","exports":"./index.mjs"}');
  await writeFile(join(root, 'node_modules/vite/index.mjs'), `export {loadEnv} from ${JSON.stringify(import.meta.resolve('vite'))}; export async function createServer(){console.log('SNAPSHOT:'+JSON.stringify({url:process.env.SUPABASE_UPSTREAM_URL,key:process.env.SUPABASE_ANON_KEY,project:process.env.VITE_SUPABASE_PROJECT_ID,proxy:process.env.VITE_SUPABASE_USE_PROXY,clientKey:process.env.VITE_SUPABASE_ANON_KEY}));throw new Error('end fixture before listening');}`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.includes('SUPABASE')));
  const child = spawn(process.execPath, [join(root, 'scripts/mac-launch.mjs'), '--no-open'], { cwd: '/', env, stdio: ['ignore', 'pipe', 'pipe'] });
  const ended = once(child, 'close', { signal: AbortSignal.timeout(10000) });
  let stdout = ''; child.stdout.on('data', data => { stdout += data; });
  const [code] = await ended;
  assert.equal(code, 1); // The fixture intentionally stops before opening any port.
  const snapshot = JSON.parse(stdout.match(/SNAPSHOT:(.*)/)[1]);
  assert.deepEqual(snapshot, { url: origin, key: 'sb_publishable_fixture', project: 'existing', proxy: '1', clientKey: '' });
});
