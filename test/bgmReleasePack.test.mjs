import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';

let release = {};
try { release = await import('../scripts/lib/bgm-release.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
function api(name) {
  assert.equal(typeof release[name], 'function', `release API ${name} must exist`);
  return release[name];
}
const digest = (data) => createHash('sha256').update(data).digest('hex');
const local = (root) => join(root, 'public/assets/cc0/audio/catalog');
async function fixture(t) {
  api('createRelease');
  const dir = await mkdtemp(join(tmpdir(), 'bgm-release-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'checkout');
  const sourceDir = join(dir, 'source');
  await mkdir(sourceDir);
  await mkdir(local(root), { recursive: true });
  const tracks = ['a', 'b'].map((name) => ({
    id: `cc0-bgm-${name}`, fileName: `${name}.mp3`, bytes: 7, sha256: digest(`audio-${name}`),
  }));
  for (const track of tracks) await writeFile(join(sourceDir, track.fileName), `audio-${track.fileName[0]}`);
  const outDir = join(dir, 'pack');
  const manifest = await release.createRelease({ tracks, sourceDir, outDir });
  return { dir, root, sourceDir, tracks, outDir, manifest, archive: join(outDir, manifest.archive.fileName) };
}
async function install(f, options = {}) {
  return api('installRelease')({ root: f.root, manifest: f.manifest, archive: f.archive, ...options });
}
async function noTemps(f) {
  assert.deepEqual((await readdir(join(f.root, 'public/assets/cc0/audio'))).sort(), ['catalog']);
}
async function malicious(f, entries, broken = false) {
  const { Header } = await import('tar');
  const buffers = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? 'audio-a');
    const header = new Header({ path: entry.path, size: entry.type ? 0 : content.length,
      mode: 0o644, type: entry.type ?? 'File', linkpath: entry.linkpath ?? '', mtime: new Date(0) });
    header.encode();
    buffers.push(header.block);
    if (!entry.type) buffers.push(content, Buffer.alloc((512 - content.length % 512) % 512));
  }
  buffers.push(Buffer.alloc(1024));
  const data = Buffer.concat(buffers);
  if (broken) data[0] ^= 1;
  const archive = join(f.dir, 'hostile.tar');
  await writeFile(archive, data);
  return { archive, manifest: { ...f.manifest, archive: { ...f.manifest.archive, bytes: data.length, sha256: digest(data) } } };
}

test('exports executable release boundary', () => {
  for (const name of ['createRelease', 'installRelease', 'verifyInstalled', 'validateManifest', 'downloadFile']) api(name);
});
test('actual tar roundtrip is deterministic and preserves identical starter/unrelated files', async (t) => {
  const f = await fixture(t);
  const second = join(f.dir, 'second');
  const again = await release.createRelease({ tracks: [...f.tracks].reverse(), sourceDir: f.sourceDir, outDir: second });
  assert.deepEqual(again, f.manifest);
  assert.deepEqual(await readFile(join(second, again.archive.fileName)), await readFile(f.archive));
  await writeFile(join(local(f.root), 'a.mp3'), 'audio-a');
  await writeFile(join(local(f.root), 'notes.txt'), 'keep');
  const before = await stat(join(local(f.root), 'a.mp3'));
  assert.equal((await install(f)).installed, 1);
  assert.equal((await stat(join(local(f.root), 'a.mp3'))).ino, before.ino);
  assert.equal(await readFile(join(local(f.root), 'notes.txt'), 'utf8'), 'keep');
  assert.equal((await release.verifyInstalled({ root: f.root, manifest: f.manifest })).complete, true);
  await noTemps(f);
});
test('archive checksum and size corruption preserve destination', async (t) => {
  const f = await fixture(t);
  await writeFile(join(local(f.root), 'a.mp3'), 'old audio');
  const bytes = await readFile(f.archive); bytes[520] ^= 1;
  await writeFile(f.archive, bytes);
  await assert.rejects(install(f));
  await writeFile(f.archive, bytes.subarray(0, 512));
  await assert.rejects(install(f));
  assert.deepEqual(await readdir(local(f.root)), ['a.mp3']);
  assert.equal(await readFile(join(local(f.root), 'a.mp3'), 'utf8'), 'old audio');
  await noTemps(f);
});
const validEntries = [{ path: 'a.mp3' }, { path: 'b.mp3', content: 'audio-b' }];
for (const [name, entries, broken] of [
  ['duplicate', [validEntries[0], ...validEntries]],
  ['extra', [...validEntries, { path: 'extra.mp3' }]],
  ['missing', [validEntries[0]]],
  ['traversal', [{ path: '../escape.mp3' }, ...validEntries]],
  ['absolute', [{ path: '/escape.mp3' }, ...validEntries]],
  ['backslash', [{ path: '..\\escape.mp3' }, ...validEntries]],
  ['symlink', [{ path: 'a.mp3', type: 'SymbolicLink', linkpath: '../escape' }, validEntries[1]]],
  ['hardlink', [{ path: 'a.mp3', type: 'Link', linkpath: 'b.mp3' }, validEntries[1]]],
  ['directory', [{ path: 'a.mp3', type: 'Directory' }, validEntries[1]]],
  ['wrong content', [{ path: 'a.mp3', content: 'corrupt' }, validEntries[1]]],
  ['malformed header', validEntries, true],
]) test(`rejects ${name} before destination promotion`, async (t) => {
  const f = await fixture(t);
  await writeFile(join(local(f.root), 'notes.txt'), 'keep');
  await assert.rejects(install(f, await malicious(f, entries, broken)));
  assert.deepEqual(await readdir(local(f.root)), ['notes.txt']);
  await noTemps(f);
});
test('rejects manifest traversal, duplicate ids/names, bad hashes, count and totals', async (t) => {
  const f = await fixture(t);
  for (const patch of [
    { count: 3 }, { totalBytes: 1 }, { schemaVersion: 2 },
    { tracks: [f.tracks[0], f.tracks[0]] },
    { tracks: [{ ...f.tracks[0], fileName: '../x.mp3' }, f.tracks[1]] },
    { tracks: [{ ...f.tracks[0], sha256: 'release-manifest' }, f.tracks[1]] },
    { archive: { ...f.manifest.archive, fileName: '../pack.tar' } },
  ]) assert.throws(() => release.validateManifest({ ...f.manifest, ...patch }));
});
test('rejects destination file and ancestor symlinks without writing outside root', async (t) => {
  const f = await fixture(t);
  const outside = join(f.dir, 'outside'); await mkdir(outside);
  await symlink(join(outside, 'a.mp3'), join(local(f.root), 'a.mp3'));
  await assert.rejects(install(f));
  await rm(join(f.root, 'public'), { recursive: true });
  await symlink(outside, join(f.root, 'public'));
  await assert.rejects(install(f));
  assert.deepEqual(await readdir(outside), []);
});
test('verified re-run is offline; corrupt file repairs without replacing good files', async (t) => {
  const f = await fixture(t); await install(f);
  const before = await stat(join(local(f.root), 'a.mp3'));
  const offline = () => { assert.fail('complete installation must not download'); };
  assert.equal((await install(f, { archive: undefined, download: offline })).installed, 0);
  await writeFile(join(local(f.root), 'b.mp3'), 'broken!');
  assert.equal((await release.verifyInstalled({ root: f.root, manifest: f.manifest })).complete, false);
  assert.equal((await install(f)).installed, 1);
  assert.equal((await stat(join(local(f.root), 'a.mp3'))).ino, before.ino);
  await noTemps(f);
});
test('exclusive lock rejects contention and retains the other owner lock', async (t) => {
  const f = await fixture(t);
  const lock = join(f.root, 'public/assets/cc0/audio/.bgm-install.lock');
  await writeFile(lock, 'other owner', { flag: 'wx' });
  await assert.rejects(install(f));
  assert.equal(await readFile(lock, 'utf8'), 'other owner');
  assert.deepEqual(await readdir(local(f.root)), []);
});
test('promotion failure leaves only valid files, cleans staging, and rerun repairs', async (t) => {
  const f = await fixture(t);
  const { rename } = await import('node:fs/promises');
  let promoted = 0;
  await assert.rejects(install(f, { promote: async (from, to) => {
    if (promoted++ === 1) throw new Error('injected rename failure');
    await rename(from, to);
  } }), (error) => error.installed === 1);
  assert.equal(await readFile(join(local(f.root), 'a.mp3'), 'utf8'), 'audio-a');
  assert.deepEqual(await readdir(local(f.root)), ['a.mp3']);
  await noTemps(f);
  assert.equal((await install(f)).installed, 1);
});
test('streaming HTTP success, truncated body and byte limit clean owned temporary files', async (t) => {
  api('downloadFile');
  const dir = await mkdtemp(join(tmpdir(), 'bgm-http-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createServer((req, res) => {
    res.writeHead(200, req.url === '/chunked' ? { Connection: 'close' } : { 'Content-Length': '7', Connection: 'close' });
    res.end(req.url === '/truncated' ? 'aud' : 'audio-a');
  });
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const listening = once(server, 'listening'); server.listen(0, '127.0.0.1'); await listening;
  const base = `http://127.0.0.1:${server.address().port}`;
  const path = join(dir, 'audio.mp3');
  await release.downloadFile({ url: `${base}/ok`, path, bytes: 7, sha256: digest('audio-a'), timeoutMs: 2000 });
  assert.equal(await readFile(path, 'utf8'), 'audio-a'); await rm(path);
  await assert.rejects(release.downloadFile({ url: `${base}/truncated`, path, bytes: 7, timeoutMs: 2000 }));
  await assert.rejects(release.downloadFile({ url: `${base}/chunked`, path, bytes: 2, timeoutMs: 2000 }));
  await assert.rejects(release.downloadFile({ url: `${base}/ok`, path, bytes: 7, sha256: '0'.repeat(64), timeoutMs: 2000 }));
  assert.deepEqual(await readdir(dir), []);
});
test('final full verification rejects a promotion that does not install its files', async (t) => {
  const f = await fixture(t);
  await assert.rejects(install(f, { promote: async () => {} }));
  await noTemps(f);
  assert.equal((await release.verifyInstalled({ root: f.root, manifest: f.manifest })).complete, false);
});
test('cancellation reaches a real download child and cleans lock/staging before rejecting', { timeout: 5000 }, async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  const { spawn } = await import('node:child_process');
  let child; let exited;
  t.after(() => { if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const operation = install(f, { archive: undefined, signal: controller.signal, download: async (options) => {
    assert.equal(options.signal, controller.signal);
    return release.downloadRelease({ ...options, spawnProcess: () => {
      child = spawn(process.execPath, ['-e', "process.on('message', () => {}); process.send('ready');"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      exited = once(child, 'exit');
      child.once('message', () => controller.abort(new Error('test cancellation')));
      return child;
    } });
  } });
  await assert.rejects(operation, /test cancellation/);
  assert.ok(child, 'the real child must have started');
  await exited;
  assert.ok(child.signalCode || child.exitCode !== null);
  await noTemps(f);
  assert.deepEqual(await readdir(local(f.root)), []);
});
