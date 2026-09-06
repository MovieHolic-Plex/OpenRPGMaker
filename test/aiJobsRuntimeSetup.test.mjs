import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, stat, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter, once, getEventListeners } from 'node:events';
import { setupAiRuntime, runCommand } from '../scripts/setup-local.mjs';

const secret = 'sb_secret_fixture_do_not_echo';
async function fixture(t, { installed = false, installer = 'success', probe = 'success' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'RPG runtime setup space '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts'));
  await copyFile(new URL('../scripts/setup-local.mjs', import.meta.url), join(root, 'scripts/setup-local.mjs'));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  // A nested installed version must win over an unrelated top-level/global CLI.
  const testPackage = join(root, 'node_modules/@playwright/test');
  const runtime = join(testPackage, 'node_modules/playwright');
  await mkdir(runtime, { recursive: true });
  await writeFile(join(testPackage, 'package.json'), '{"name":"@playwright/test","version":"1.61.0"}');
  await writeFile(join(runtime, 'package.json'), JSON.stringify({ name: 'playwright', version: '1.61.0', main: 'index.cjs', bin: { playwright: 'cli.cjs' } }));
  const executable = join(root, 'managed-chromium');
  const events = join(root, 'events.jsonl');
  if (installed) await writeFile(executable, 'fixture', { mode: 0o755 });
  await writeFile(join(runtime, 'index.cjs'), `
    const fs = require('node:fs');
    const record = value => fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify(value) + '\\n');
    exports.chromium = {
      executablePath: () => ${JSON.stringify(executable)},
      launch: async options => {
        record({ kind: 'launch', options });
        if (${JSON.stringify(probe)} === 'failure') throw new Error(${JSON.stringify(secret)});
        if (!fs.existsSync(${JSON.stringify(executable)})) throw new Error('missing fixture runtime');
        if (${JSON.stringify(probe)} === 'cancel') {
          // Model Playwright's launch-time signal ownership and cleanup before exit.
          process.on('SIGTERM', () => { record({ kind: 'closed' }); process.exit(0); });
          console.log('PROBE_READY:' + process.pid);
          process.stdin.resume();
          return new Promise(() => {});
        }
        return { close: async () => {
          record({ kind: 'closed' });
          if (${JSON.stringify(probe)} === 'close-failure') throw new Error(${JSON.stringify(secret)});
        } };
      }
    };
  `);
  await writeFile(join(runtime, 'cli.cjs'), `
    const fs = require('node:fs');
    fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({kind:'install', args:process.argv.slice(2)}) + '\\n');
    if (${JSON.stringify(installer)} === 'cancel') {
      process.on('SIGINT', () => process.exit(0));
      process.on('SIGTERM', () => process.exit(0));
      console.log('INSTALLER_READY:' + process.pid);
      process.stdin.resume();
    } else if (${JSON.stringify(installer)} === 'failure') {
      console.error(${JSON.stringify(secret)}); process.exitCode = 1;
    } else if (${JSON.stringify(installer)} !== 'empty') {
      fs.writeFileSync(${JSON.stringify(executable)}, 'fixture', {mode:0o755});
    }
  `);
  await mkdir(join(root, 'node_modules/playwright'));
  await writeFile(join(root, 'node_modules/playwright/package.json'), '{"main":"index.cjs","bin":{"playwright":"cli.cjs"}}');
  for (const name of ['index.cjs', 'cli.cjs']) await writeFile(join(root, 'node_modules/playwright', name), 'throw new Error("wrong installed version selected");');
  return { root, executable, events, runtime };
}
async function recorded(events) {
  try { return (await readFile(events, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function cli(t, root, args = ['--ai-runtime'], env = {}) {
  const child = spawn(process.execPath, [join(root, 'scripts/setup-local.mjs'), ...args], {
    cwd: '/', env: { PATH: '', HOME: root, SUPABASE_ANON_KEY: secret, VITE_SUPABASE_PROJECT_ID: secret, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close', { signal: AbortSignal.timeout(10000) });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  return { child, closed, output: () => output };
}

test('explicit runtime CLI installs the exact project Chromium without private setup', { timeout: 15000 }, async t => {
  const { root, events, executable } = await fixture(t);
  const run = cli(t, root);
  const [code, signal] = await run.closed;
  assert.equal(code, 0, run.output());
  assert.equal(signal, null);
  const actions = await recorded(events);
  assert.deepEqual(actions.map(action => action.kind), ['install', 'launch', 'closed']);
  assert.deepEqual(actions[0].args, ['install', 'chromium']);
  assert.equal(actions[1].options.executablePath, executable);
  assert.equal(actions[1].options.headless, true);
  assert.ok(actions[1].options.timeout > 0 && actions[1].options.timeout <= 30000);
  assert.equal(run.output().includes(secret), false);
  assert.equal((await readdir(root)).some(name => name.startsWith('.env')), false);
});

test('installed runtime is probed and closed with no install or env mutation', { timeout: 15000 }, async t => {
  const { root, events } = await fixture(t, { installed: true });
  const files = ['.env', '.env.local', '.env.development', '.env.development.local'];
  const before = new Map();
  for (const file of files) {
    const path = join(root, file);
    await writeFile(path, `SUPABASE_ANON_KEY=${secret}\nMALFORMED='do not parse\n`, { mode: 0o600 });
    before.set(file, { bytes: await readFile(path), metadata: await stat(path) });
  }
  const run = cli(t, root);
  assert.equal((await run.closed)[0], 0, run.output());
  assert.deepEqual((await recorded(events)).map(action => action.kind), ['launch', 'closed']);
  assert.equal(run.output().includes(secret), false);
  for (const file of files) {
    const { bytes, metadata } = before.get(file);
    assert.deepEqual(await readFile(join(root, file)), bytes);
    const after = await stat(join(root, file));
    for (const key of ['ino', 'mode', 'mtimeMs']) assert.equal(after[key], metadata[key]);
  }
});

test('installer failure and false-success never report a usable runtime or expose raw errors', { timeout: 15000 }, async t => {
  for (const installer of ['failure', 'empty']) {
    const { root, events } = await fixture(t, { installer });
    const run = cli(t, root);
    assert.equal((await run.closed)[0], 1);
    assert.match(run.output(), installer === 'failure' ? /AI_RUNTIME_INSTALL:/ : /AI_RUNTIME_PROBE:/);
    assert.equal(run.output().includes(secret), false);
    assert.deepEqual((await recorded(events)).map(action => action.kind), ['install']);
    assert.equal((await readdir(root)).some(name => name.startsWith('.env')), false);
  }
});

test('unusable existing runtime and close failure fail without reinstalling', { timeout: 15000 }, async t => {
  for (const probe of ['failure', 'close-failure']) {
    const { root, events } = await fixture(t, { installed: true, probe });
    const run = cli(t, root);
    assert.equal((await run.closed)[0], 1);
    assert.match(run.output(), /AI_RUNTIME_PROBE:/);
    assert.equal(run.output().includes(secret), false);
    assert.deepEqual((await recorded(events)).map(action => action.kind), probe === 'failure' ? ['launch'] : ['launch', 'closed']);
  }
});

test('missing project package and missing local CLI never fall back to npm or global Playwright', { timeout: 15000 }, async t => {
  for (const missing of ['package', 'cli']) {
    const { root, runtime, events } = await fixture(t);
    await rm(missing === 'package' ? join(root, 'node_modules/@playwright') : join(runtime, 'cli.cjs'), { recursive: true });
    const run = cli(t, root);
    assert.equal((await run.closed)[0], 1);
    assert.match(run.output(), missing === 'package' ? /AI_RUNTIME_PACKAGE:/ : /AI_RUNTIME_INSTALL:/);
    assert.deepEqual(await recorded(events), []);
    assert.equal((await readdir(root)).some(name => name.startsWith('.env')), false);
  }
});

test('CLI rejects unknown, repeated, or credential-bearing arguments before any setup', { timeout: 15000 }, async t => {
  const { root, events } = await fixture(t);
  for (const args of [['--unknown'], ['--ai-runtime', '--ai-runtime'], ['--ai-runtime', secret]]) {
    const run = cli(t, root, args);
    assert.equal((await run.closed)[0], 1);
    assert.match(run.output(), /ARGUMENTS:/);
    assert.equal(run.output().includes(secret), false);
    assert.deepEqual(await recorded(events), []);
  }
});

test('no-argument CLI retains npm preflight and private configuration protection, never provisions', { timeout: 15000 }, async t => {
  const { root, events } = await fixture(t);
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(bin, 'npm'), `#!${process.execPath}\nimport fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({kind:'npm',args:process.argv.slice(2)})+'\\n');`, { mode: 0o755 });
  await writeFile(join(root, '.env.local'), secret, { mode: 0o600 });
  const run = cli(t, root, [], { PATH: bin });
  assert.equal((await run.closed)[0], 1);
  assert.match(run.output(), /CONFIG_EXISTS:/);
  assert.deepEqual(await recorded(events), [{ kind: 'npm', args: ['--version'] }]);
  assert.equal(await readFile(join(root, '.env.local'), 'utf8'), secret);
  assert.equal(run.output().includes(secret), false);
});

test('already aborted setup never spawns, logs readiness, or changes process environment', async t => {
  const { root, events } = await fixture(t);
  const controller = new AbortController(); controller.abort(new Error(secret));
  const before = { ...process.env };
  await assert.rejects(setupAiRuntime({ root, signal: controller.signal, run: () => assert.fail('must not spawn'), log: () => assert.fail('must not report success') }), { code: 'CANCELLED' });
  assert.deepEqual({ ...process.env }, before);
  assert.deepEqual(await recorded(events), []);
});

test('command cancellation is latched even for exit zero, waits for close and removes listeners', async () => {
  for (const cancellation of ['SIGINT', 'SIGTERM', 'abort']) {
    const signals = new EventEmitter(); const child = new EventEmitter(); const killed = [];
    const controller = new AbortController();
    child.kill = name => { killed.push(name); return true; };
    let settled = false;
    const pending = runCommand(process.execPath, [], { signals, signal: cancellation === 'abort' ? controller.signal : undefined, spawnProcess: () => child });
    const rejected = assert.rejects(pending, { code: 'CANCELLED' }).then(() => { settled = true; });
    if (cancellation === 'abort') controller.abort(); else signals.emit(cancellation);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.deepEqual(killed, [cancellation === 'abort' ? 'SIGTERM' : cancellation]);
    child.emit('close', 0, null);
    await rejected;
    assert.equal(signals.listenerCount('SIGINT'), 0);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  }
});

test('spawn errors remove signal listeners and pre-aborted commands do not spawn', async () => {
  const signals = new EventEmitter(); const child = new EventEmitter();
  const pending = runCommand(process.execPath, [], { signals, spawnProcess: () => child });
  const rejected = assert.rejects(pending, { code: 'ENOENT' });
  child.emit('error', Object.assign(new Error('fixture spawn failure'), { code: 'ENOENT' }));
  await rejected;
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
  await assert.rejects(runCommand(process.execPath, [], { signal: AbortSignal.abort(), spawnProcess: () => assert.fail('must not spawn') }), { code: 'CANCELLED' });
});

for (const phase of ['install', 'probe']) test(`cancellation during the real fixture ${phase} reaps its child without advancing setup`, { timeout: 15000 }, async t => {
  const { root, events } = await fixture(t, phase === 'install' ? { installer: 'cancel' } : { installed: true, probe: 'cancel' });
  const controller = new AbortController();
  const ready = Promise.withResolvers();
  let owned;
  const pending = setupAiRuntime({ root, signal: controller.signal, log() {}, run: (command, args, options) => runCommand(command, args, {
    ...options,
    spawnProcess: (cmd, argv, spawnOptions) => {
      owned = spawn(cmd, argv, { ...spawnOptions, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      owned.stdout.on('data', data => { output += data; if (/(?:INSTALLER|PROBE)_READY:\d+/.test(output)) ready.resolve(); });
      owned.once('error', ready.reject);
      owned.once('exit', () => ready.reject(new Error('installer exited before readiness')));
      t.after(() => { if (owned.exitCode === null && owned.signalCode === null) owned.kill('SIGKILL'); });
      return owned;
    },
  }) });
  const rejected = assert.rejects(pending, { code: 'CANCELLED' });
  await ready.promise;
  controller.abort();
  await rejected;
  assert.equal(owned.exitCode, 0); // A graceful child exit must not erase cancellation.
  assert.throws(() => process.kill(owned.pid, 0), { code: 'ESRCH' });
  assert.deepEqual((await recorded(events)).map(action => action.kind), phase === 'install' ? ['install'] : ['launch', 'closed']);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('cancellation between install and probe cannot announce success or launch another child', async t => {
  const { root } = await fixture(t);
  const controller = new AbortController(); let commands = 0;
  await assert.rejects(setupAiRuntime({ root, signal: controller.signal, log() {}, run: async () => { commands++; controller.abort(); } }), { code: 'CANCELLED' });
  assert.equal(commands, 1);
});

test('global NODE_PATH packages and mismatched transitive versions are not project provisioning', { timeout: 15000 }, async t => {
  for (const mismatch of ['global-test', 'global-runtime', 'version']) {
    const { root, runtime, events } = await fixture(t);
    const global = join(root, 'global'); await mkdir(global);
    if (mismatch === 'global-test') {
      await rename(join(root, 'node_modules/@playwright'), join(global, '@playwright'));
    } else if (mismatch === 'global-runtime') {
      await rename(runtime, join(global, 'playwright'));
      await rm(join(root, 'node_modules/playwright'), { recursive: true });
    } else {
      await writeFile(join(runtime, 'package.json'), JSON.stringify({ name: 'playwright', version: '0.0.1', main: 'index.cjs', bin: { playwright: 'cli.cjs' } }));
    }
    const run = cli(t, root, ['--ai-runtime'], { NODE_PATH: global });
    assert.equal((await run.closed)[0], 1);
    assert.match(run.output(), /AI_RUNTIME_PACKAGE:/);
    assert.deepEqual(await recorded(events), []);
  }
});

test('successful runtime-only API leaves process environment untouched', async t => {
  const { root } = await fixture(t, { installed: true });
  const before = { ...process.env };
  assert.deepEqual(await setupAiRuntime({ root, log() {} }), { installed: false });
  assert.deepEqual({ ...process.env }, before);
});
