// Read-only installed-runtime acceptance. Refuses installation at the injected run boundary.
// Run from this worktree; never prints env contents, hashes, or provider configuration.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupAiRuntime, runCommand } from '../../../../scripts/setup-local.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
assert.equal(process.cwd(), root);
const project = createRequire(join(root, 'package.json'));
const installed = createRequire(project.resolve(join(root, 'node_modules/@playwright/test/package.json')));
const { chromium } = installed('playwright');
const executable = chromium.executablePath();
await access(executable, constants.X_OK); // A missing browser must stop QA before any CLI invocation.
const metadata = value => ({ ino: value.ino, size: value.size, mode: value.mode, mtimeMs: value.mtimeMs });
const executableBefore = metadata(await stat(executable));
const envNames = (await readdir(root)).filter(name => name === '.env' || name.startsWith('.env.')).sort();
const envBefore = await Promise.all(envNames.map(async name => ({ bytes: await readFile(join(root, name)), metadata: metadata(await stat(join(root, name))) })));
const environment = { ...process.env };
const children = [];
const outcome = await setupAiRuntime({
  root,
  log() {},
  run: (command, args, options) => {
    assert.equal(command, process.execPath);
    assert.equal(args.includes('install'), false, 'Real browser installation is forbidden in this acceptance run');
    return runCommand(command, args, { ...options, spawnProcess: (cmd, argv, spawnOptions) => {
      const child = spawn(cmd, argv, spawnOptions);
      const record = { pid: child.pid, closed: false };
      children.push(record);
      child.once('close', (code, signal) => Object.assign(record, { closed: true, code, signal }));
      return child;
    } });
  },
});
assert.deepEqual(outcome, { installed: false });
assert.equal(children.length, 1);
for (const child of children) {
  assert.equal(child.closed, true);
  assert.equal(child.code, 0);
  assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
}
// Exercise the real npm user surface after the exact-runtime probe succeeded.
const cli = spawnSync('npm', ['run', 'setup:ai-runtime'], { cwd: root, encoding: 'utf8', timeout: 45000 });
assert.equal(cli.error, undefined);
assert.equal(cli.status, 0, 'Runtime-only npm command failed');
assert.equal(cli.signal, null);

// Independently observe the real browser close event; no context, page, or network target.
let browser;
let disconnected = false;
let version;
try {
  browser = await chromium.launch({ headless: true, executablePath: executable, timeout: 15000 });
  version = browser.version();
  browser.once('disconnected', () => { disconnected = true; });
} finally {
  if (browser) await browser.close();
}
assert.equal(disconnected, true);
assert.equal(browser.isConnected(), false);
assert.deepEqual(metadata(await stat(executable)), executableBefore);
assert.deepEqual((await readdir(root)).filter(name => name === '.env' || name.startsWith('.env.')).sort(), envNames);
for (const [index, name] of envNames.entries()) {
  assert.equal((await readFile(join(root, name))).equals(envBefore[index].bytes), true, 'Private env file bytes changed');
  assert.deepEqual(metadata(await stat(join(root, name))), envBefore[index].metadata);
}
assert.equal(JSON.stringify({ ...process.env }) === JSON.stringify(environment), true, 'Process environment changed');
console.log(JSON.stringify({
  platform: process.platform,
  node: process.versions.node,
  playwright: installed('playwright/package.json').version,
  chromium: version,
  installedBefore: true,
  setupResult: outcome,
  guardedProbeChildren: children,
  npmCommand: 'npm run setup:ai-runtime',
  npmExit: cli.status,
  npmOutput: cli.stdout.trim(),
  browserDisconnected: disconnected,
  executableUnchanged: true,
  envFileCount: envNames.length,
  envFilesAndProcessEnvironmentUnchanged: true,
  installerCalls: 0,
  appServersStarted: 0,
  providerOrSupabaseRequests: 0,
}, null, 2));
