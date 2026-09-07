import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { hashFile, readTrustedManifest } from '../lib/bgm-release.mjs';

// Real published-release acceptance. Owns only temporary checkouts; never edits project data.
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = await readTrustedManifest(join(root, 'assets/bgm-release-v1.json'));
const evidence = process.env.QA_EVIDENCE_DIR ?? join(root, 'output/evidence/bgm-release-pack');
await mkdir(evidence, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'bgm-published-proof-'));
const records = [];
const node = process.execPath;
const cli = join(root, 'scripts/install-bgm.mjs');
const local = checkout => join(checkout, 'public/assets/cc0/audio/catalog');
async function run(command, args, env = process.env, expected = 0) {
  const record = { command, args, code: null, output: '' };
  await new Promise((ok, fail) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const deadline = setTimeout(() => child.kill('SIGTERM'), 600000);
    child.stdout.on('data', data => { record.output += data; });
    child.stderr.on('data', data => { record.output += data; });
    child.once('error', error => { clearTimeout(deadline); fail(error); });
    child.once('close', code => { clearTimeout(deadline); record.code = code; ok(); });
  });
  records.push(record);
  console.log(JSON.stringify(record));
  assert.equal(record.code, expected);
}
async function digestInstalled(checkout) {
  const entries = [];
  for (const track of manifest.tracks) entries.push({ id: track.id, ...await hashFile(join(local(checkout), track.fileName)) });
  return entries;
}
try {
  const automatic = join(temp, 'automatic');
  await run(node, [cli, '--root', automatic]);
  const installed = await digestInstalled(automatic);
  assert.deepEqual(installed, manifest.tracks.map(track => ({ id: track.id, bytes: track.bytes, sha256: track.sha256 })));
  await run(node, [cli, '--verify', '--root', automatic]);
  // Absolute Node executable plus empty PATH proves the rerun cannot invoke gh.
  await run(node, [cli, '--root', automatic], { ...process.env, PATH: '' });
  // Keep the verified hashes, not two full installed copies, during manual acceptance.
  await rm(automatic, { recursive: true });
  const downloads = join(temp, 'downloads');
  await mkdir(downloads);
  await run('gh', ['release', 'download', 'bgm-v1', '--repo', manifest.repo, '--pattern', manifest.archive.fileName, '--dir', downloads]);
  const archive = join(downloads, manifest.archive.fileName);
  assert.deepEqual(await hashFile(archive), { bytes: manifest.archive.bytes, sha256: manifest.archive.sha256 });
  const manual = join(temp, 'manual with spaces');
  await run(node, [cli, '--root', manual, '--archive', archive], { ...process.env, PATH: '' });
  await run(node, [cli, '--verify', '--root', manual], { ...process.env, PATH: '' });
  const changed = manifest.tracks[0];
  await writeFile(join(local(manual), changed.fileName), 'user-existing-corrupt-audio');
  await writeFile(join(local(manual), 'unrelated.txt'), 'preserve this');
  const before = await digestInstalled(manual);
  // Sparse, correct-length but invalid-hash archive exercises integrity rejection.
  const corrupt = join(temp, 'corrupt.tar');
  const fd = await open(corrupt, 'wx');
  try { await fd.truncate(manifest.archive.bytes); } finally { await fd.close(); }
  await run(node, [cli, '--root', manual, '--archive', corrupt], process.env, 1);
  assert.deepEqual(await digestInstalled(manual), before);
  assert.deepEqual(await readdir(join(manual, 'public/assets/cc0/audio')), ['catalog']);
  await run(node, [cli, '--root', manual, '--archive', archive], { ...process.env, PATH: '' });
  assert.equal(await readFile(join(local(manual), 'unrelated.txt'), 'utf8'), 'preserve this');
  assert.deepEqual(await digestInstalled(manual), installed);
  await writeFile(join(evidence, 'published-cli.json'), JSON.stringify({ verifiedTracks: installed.length, archive: manifest.archive, records, preservedAfterCorruption: true, repaired: true, offlineRerun: true }, null, 2));
  console.log('PUBLISHED_CLI_PASS: authenticated download, manual install, 281 hashes, offline rerun, corruption preservation and repair');
} finally {
  await rm(temp, { recursive: true, force: true });
  await writeFile(join(evidence, 'published-cli-cleanup.json'), JSON.stringify({ removed: temp, processesClosed: true }));
  console.log(`CLI_CLEANUP: ${temp} removed`);
}
