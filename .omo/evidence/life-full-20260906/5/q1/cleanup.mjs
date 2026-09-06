import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const entry = JSON.parse(await readFile(new URL('entry.json', root), 'utf8'));
const browser = JSON.parse(await readFile(new URL('browser.json', root), 'utf8'));
assert.equal(browser.ok, true);
assert.deepEqual(browser.runs.map(run => run.bootFlag), ['omitted', 'false', 'true']);
for (const run of browser.runs) {
  assert.equal(run.contextClosed, true);
  assert.deepEqual(run.audioCleanup, { globals: [], audioElements: 0 });
}
assert.deepEqual(browser.cleanup, { browserClosed: true, contextsClosed: true, serverClosed: true, remoteWrites: 0 });
const port = await new Promise((resolve, reject) => {
  const socket = createConnection({ host: '127.0.0.1', port: browser.port });
  socket.setTimeout(1000, () => { socket.destroy(); reject(new Error('port check timeout')); });
  socket.once('connect', () => { socket.destroy(); reject(new Error('task-owned server still listening')); });
  socket.once('error', error => {
    socket.destroy();
    if (error.code === 'ECONNREFUSED') resolve({ port: browser.port, code: error.code });
    else reject(error);
  });
});
const removed = [];
assert.equal(entry.distExisted, false);
for (const path of ['dist', '.omo/evidence/life-full-20260906/5/q1/browser-cache']) {
  const stat = await lstat(path);
  assert.equal(stat.isSymbolicLink(), false, path);
  assert.equal(stat.isDirectory(), true, path);
  assert.equal(execFileSync('git', ['ls-files', '-z', '--', path]).length, 0, path);
  await rm(path, { recursive: true });
  removed.push(path);
}
let preserved = 0;
for (const [path, sha256] of Object.entries(entry.protected)) {
  const content = await readFile(path);
  if (path === '.omo/evidence/life-full-20260906/5/SUMMARY.md') {
    const original = execFileSync('git', ['show', `${entry.head}:${path}`], { encoding: 'utf8' });
    assert.equal(content.toString().endsWith(original), true, 'prior SUMMARY must remain verbatim');
  } else assert.equal(createHash('sha256').update(content).digest('hex'), sha256, path);
  preserved += 1;
}
const result = { head: entry.head, tree: entry.tree, port, removed, preservedPriorFiles: preserved, browser: browser.cleanup, task: 'st_01a07495', sharedLockRemoved: false, sharedNodeModulesTouched: false, remoteWrites: 0 };
await writeFile(new URL('cleanup.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
