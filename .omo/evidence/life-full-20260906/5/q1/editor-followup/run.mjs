import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, lstat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = new URL('./', import.meta.url);
const cwd = process.cwd();
const port = Number(process.env.DEV_SERVER_PORT);
assert.ok(Number.isInteger(port) && port > 0);
assert.equal(process.env.E2E_FREEZE_DEV_SERVER, '1');
assert.equal(process.env.E2E_RETRIES, '0');
const cache = resolve('.omo/evidence/life-full-20260906/5/q1/editor-followup/vite-cache');
const trackedPaths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const trackedBefore = new Map(await Promise.all(trackedPaths.map(async path => [path, sha(await readFile(path))])));
const result = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  cwd, pid: process.pid, port, freeze: process.env.E2E_FREEZE_DEV_SERVER,
  started: new Date().toISOString(), command: ['npm', 'run', 'test:e2e', '--',
    '--config', '.omo/evidence/life-full-20260906/5/q1/editor-followup/playwright.config.ts',
    'test/e2e/oprn-audio-test-dialog.spec.ts', '--project=chromium', '--workers=1', '--retries=0'],
};
let server;
let output = '';
try {
  server = await createServer({
    configFile: resolve('vite.config.ts'), configLoader: 'runner', cacheDir: cache,
    server: { host: '127.0.0.1', port, strictPort: true, https: undefined },
  });
  assert.equal(server.config.server.hmr, false);
  assert.equal(server.config.server.watch, null);
  assert.equal(server.config.server.strictPort, true);
  await server.listen();
  const address = server.httpServer.address();
  assert.equal(address.port, port);
  result.server = { ownerPid: process.pid, cwd, url: `http://127.0.0.1:${port}`, fresh: true,
    reuse: false, hmr: server.config.server.hmr, watch: server.config.server.watch, cache };
  console.log(JSON.stringify({ server: result.server }));
  const child = spawn(result.command[0], result.command.slice(1), { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  result.testPid = child.pid;
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => {
    output += bytes.toString(); process.stdout.write(bytes);
  });
  const finished = await new Promise((resolveRun, reject) => {
    child.once('error', reject);
    child.once('close', (exit, signal) => resolveRun({ exit, signal }));
  });
  Object.assign(result, finished);
  process.exitCode = finished.exit ?? 1;
} catch (error) {
  result.error = String(error?.stack ?? error);
  process.exitCode = 1;
  throw error;
} finally {
  if (server) await server.close();
  result.serverClosed = true;
  result.portCleanup = await new Promise((resolveCheck, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000, () => { socket.destroy(); reject(new Error('cleanup socket deadline')); });
    socket.once('connect', () => { socket.destroy(); reject(new Error('owned port still listening')); });
    socket.once('error', error => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') resolveCheck(error.code); else reject(error);
    });
  });
  try {
    const cacheStat = await lstat(cache);
    assert.equal(cacheStat.isSymbolicLink(), false);
    assert.equal(execFileSync('git', ['ls-files', '-z', '--', cache]).length, 0);
    await rm(cache, { recursive: true });
    result.removed = [cache];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    result.cacheAlreadyAbsent = true;
  }
  for (const [path, digest] of trackedBefore) assert.equal(sha(await readFile(path)), digest, path);
  result.trackedFilesUnchanged = trackedBefore.size;
  result.finished = new Date().toISOString();
  result.outputSha256 = sha(output);
  await writeFile(new URL('execution.txt', root), output);
  await writeFile(new URL('execution.json', root), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
