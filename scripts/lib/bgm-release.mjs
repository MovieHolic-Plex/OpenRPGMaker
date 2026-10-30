import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, parse, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import * as tar from 'tar';

export const RELEASE = Object.freeze({
  schemaVersion: 1, version: 1, repo: 'MovieHolic-Plex/OpenRPGMaker', tag: 'bgm-v1',
  archiveName: 'rpg-zzu-bgm-v1.tar', manifestName: 'bgm-release-v1.json',
  license: 'CC0-1.0', source: 'https://bgmreview-h4zeq64k.manus.space/',
  cdn: 'https://cheapcdn.sgp1.cdn.digitaloceanspaces.com/rpg-zzu/bgm/v1/',
  count: 281, totalBytes: 1303934164,
});
const HASH = /^[a-f0-9]{64}$/;
const ID = /^cc0-bgm-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME = /^[a-z0-9][a-z0-9_-]*\.(mp3|wav)$/;
const compare = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const destination = (root) => join(resolve(root), 'public/assets/cc0/audio/catalog');
const fail = (message, extra) => {
  const error = new Error(message);
  if (extra) Object.assign(error, extra);
  throw error;
};
const PUBLIC_MISS = new Set([401, 403, 404, 429]);
const GITHUB_RELEASE_HOSTS = new Set([
  'github.com', 'api.github.com', 'release-assets.githubusercontent.com',
  'objects.githubusercontent.com', 'github-releases.githubusercontent.com',
]);
const LOCAL_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);
const ARCHIVE_TIMEOUT_MS = 30 * 60 * 1000;
const METADATA_LIMIT = 1_048_576;
const RELEASE_TOKEN = /^[A-Za-z0-9._-]+$/;
const positive = (n) => Number.isSafeInteger(n) && n > 0;
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) fail('Invalid manifest fields');
}
function validateTracks(tracks, sorted = true) {
  if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > RELEASE.count) fail('Invalid track count');
  const ids = new Set(); const names = new Set();
  for (const [index, track] of tracks.entries()) {
    keys(track, ['id', 'fileName', 'bytes', 'sha256']);
    if (!ID.test(track.id) || !NAME.test(track.fileName) || track.fileName.length > 100
      || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])\./i.test(track.fileName)
      || !positive(track.bytes) || track.bytes > RELEASE.totalBytes || !HASH.test(track.sha256)
      || ids.has(track.id) || names.has(track.fileName)
      || (sorted && index > 0 && compare(tracks[index - 1], track) >= 0)) fail('Invalid or duplicate track');
    ids.add(track.id); names.add(track.fileName);
  }
}
export function validateManifest(manifest, { production = false } = {}) {
  keys(manifest, ['schemaVersion', 'version', 'repo', 'tag', 'archive', 'count', 'totalBytes', 'license', 'source', 'tracks']);
  for (const key of ['schemaVersion', 'version', 'repo', 'tag', 'license', 'source']) {
    if (manifest[key] !== RELEASE[key]) fail(`Invalid manifest ${key}`);
  }
  validateTracks(manifest.tracks);
  keys(manifest.archive, ['fileName', 'bytes', 'sha256']);
  if (manifest.archive.fileName !== RELEASE.archiveName || !positive(manifest.archive.bytes)
    || !HASH.test(manifest.archive.sha256)) fail('Invalid archive identity');
  const total = manifest.tracks.reduce((sum, track) => sum + track.bytes, 0);
  const tarBytes = manifest.tracks.reduce((sum, track) => sum + 512 + Math.ceil(track.bytes / 512) * 512, 1024);
  if (manifest.count !== manifest.tracks.length || manifest.totalBytes !== total
    || total > RELEASE.totalBytes || manifest.archive.bytes < 1024
    || manifest.archive.bytes > tarBytes + 10240) fail('Invalid manifest totals');
  if (production && (manifest.count !== RELEASE.count || total !== RELEASE.totalBytes)) fail('Incomplete production manifest');
  return manifest;
}
async function maybeStat(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}
// Inspect every existing ancestor, including the checkout itself. Never follow destination links.
async function safeDirectory(path, create = false) {
  const absolute = resolve(path); const volume = parse(absolute).root;
  let current = volume;
  for (const part of absolute.slice(volume.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let info = await maybeStat(current);
    if (!info && create) {
      try { await mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      info = await lstat(current);
    }
    if (info && (!info.isDirectory() || info.isSymbolicLink())) fail(`Unsafe destination ancestor: ${current}`);
  }
}
async function regularFile(path) {
  const info = await maybeStat(path);
  if (info && (!info.isFile() || info.isSymbolicLink())) fail(`Unsafe file: ${path}`);
  return info;
}
export async function hashFile(path, { signal = undefined } = {}) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path, { signal })) { bytes += chunk.length; hash.update(chunk); }
  return { bytes, sha256: hash.digest('hex') };
}
async function matches(path, expected, signal = undefined) {
  signal?.throwIfAborted();
  const info = await regularFile(path);
  if (!info || info.size !== expected.bytes) return false;
  return (await hashFile(path, { signal })).sha256 === expected.sha256;
}
export async function verifyInstalled({ root, manifest, signal = undefined }) {
  signal?.throwIfAborted();
  validateManifest(manifest);
  const dir = destination(root); await safeDirectory(dir);
  const missing = [];
  for (const track of manifest.tracks) {
    if (!await matches(join(dir, track.fileName), track, signal)) missing.push(track.id);
  }
  return { complete: missing.length === 0, verified: manifest.count - missing.length, missing };
}
function meter(expected) {
  let bytes = 0; const hash = createHash('sha256');
  const stream = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > expected.bytes) return callback(new Error('Download exceeds trusted byte limit'));
    hash.update(chunk); callback(null, chunk);
  } });
  return { stream, check() {
    const sha256 = hash.digest('hex');
    if (bytes !== expected.bytes || (expected.sha256 && sha256 !== expected.sha256)) fail('Byte count or SHA256 mismatch');
    return { bytes, sha256 };
  } };
}
function assertDownloadUrl(address) {
  if (address.username || address.password) fail('Unsafe download URL');
  const local = address.protocol === 'http:' && LOCAL_HOSTS.has(address.hostname);
  if (address.protocol !== 'https:' && !local) fail('Unsafe download URL');
}
function originBase(base) {
  const url = new URL(base);
  assertDownloadUrl(url);
  if (url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) fail('Unsafe download URL');
  return base.endsWith('/') ? base.slice(0, -1) : base;
}
function redirectHosts(bases) {
  const hosts = new Set(GITHUB_RELEASE_HOSTS);
  for (const base of bases) {
    const host = new URL(base).hostname;
    if (LOCAL_HOSTS.has(host)) hosts.add(host);
  }
  return hosts;
}
async function fetchResponse(address, { signal, headers, allowRedirectHosts }) {
  assertDownloadUrl(address);
  if (!allowRedirectHosts) return fetch(address, { signal, redirect: 'error', headers });
  const allowed = new Set(allowRedirectHosts);
  let current = address;
  for (let hop = 0; hop <= 5; hop++) {
    assertDownloadUrl(current);
    if (!allowed.has(current.hostname)) fail(`Download redirect host refused: ${current.hostname}`, { publicUnavailable: true });
    const response = await fetch(current, { signal, redirect: 'manual', headers });
    const location = response.headers.get('location');
    const redirecting = response.status === 0 || (response.status >= 300 && response.status < 400 && response.status !== 304);
    if (!redirecting) return response;
    await response.body?.cancel();
    if (!location) fail('Download redirect missing Location', { publicUnavailable: true });
    if (hop === 5) fail('Too many download redirects', { publicUnavailable: true });
    current = new URL(location, current);
  }
  fail('Too many download redirects', { publicUnavailable: true });
}
export async function downloadFile({ url, path, bytes, sha256, timeoutMs = 120000, signal: externalSignal = undefined, headers = undefined, allowRedirectHosts = undefined }) {
  const address = new URL(url);
  assertDownloadUrl(address);
  const temp = `${path}.${randomUUID()}.part`;
  try {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = externalSignal ? AbortSignal.any([externalSignal, deadline]) : deadline;
    const response = await fetchResponse(address, { signal, headers, allowRedirectHosts });
    if (!response.ok) {
      await response.body?.cancel();
      fail(`Download HTTP ${response.status}`, { publicUnavailable: PUBLIC_MISS.has(response.status), status: response.status });
    }
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== bytes) {
      await response.body?.cancel();
      fail('Download Content-Length mismatch', { publicUnavailable: true });
    }
    const check = meter({ bytes, sha256 });
    await pipeline(Readable.fromWeb(response.body), check.stream, createWriteStream(temp, { flags: 'wx', mode: 0o600 }), { signal });
    const result = check.check(); await rename(temp, path); return result;
  } finally { await rm(temp, { force: true }); }
}
function miss(message) {
  return fail(message, { publicUnavailable: true });
}
function releaseTarget(manifest) {
  const parts = String(manifest.repo ?? '').split('/');
  const tokens = [manifest.tag, manifest.archive?.fileName, ...parts];
  if (parts.length !== 2 || tokens.some((value) => typeof value !== 'string' || !RELEASE_TOKEN.test(value) || value.includes('..'))) {
    fail('Invalid release target');
  }
  return manifest;
}
function stopForAbort(signal, error) {
  if (signal?.aborted) throw signal.reason ?? error;
  if (error?.name === 'TimeoutError') throw error;
}
async function readLimited(response) {
  const chunks = []; let total = 0;
  for await (const chunk of Readable.fromWeb(response.body)) {
    total += chunk.length;
    if (total > METADATA_LIMIT) fail('Release metadata exceeds size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function fetchJson(url, signal) {
  const deadline = AbortSignal.timeout(30000);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const response = await fetch(url, {
    signal: combined, redirect: 'error',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'oprn-bgm-install', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    fail(`Download HTTP ${response.status}`, { publicUnavailable: PUBLIC_MISS.has(response.status), status: response.status });
  }
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) > METADATA_LIMIT) {
    await response.body?.cancel();
    fail('Release metadata exceeds size limit');
  }
  let parsed;
  try { parsed = JSON.parse(await readLimited(response)); }
  catch (error) { if (error.message === 'Release metadata exceeds size limit') throw error; miss('Release metadata is not JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) miss('Release metadata is not JSON');
  return parsed;
}
async function downloadViaApi({ manifest, path, signal, fetchFile, apiBase, hosts }) {
  const root = originBase(apiBase);
  const metadata = await fetchJson(`${root}/repos/${manifest.repo}/releases/tags/${encodeURIComponent(manifest.tag)}`, signal);
  const assets = Array.isArray(metadata.assets) ? metadata.assets.filter((asset) => asset?.name === manifest.archive.fileName) : [];
  if (assets.length > 1) fail('공개 릴리스 자산 이름이 중복입니다.');
  if (assets.length !== 1) miss('공개 릴리스에서 BGM 자산을 찾지 못했습니다.');
  const asset = assets[0];
  if (asset.state && asset.state !== 'uploaded') miss('공개 릴리스 자산이 아직 업로드되지 않았습니다.');
  if (asset.size !== undefined && Number(asset.size) !== manifest.archive.bytes) fail('공개 릴리스 자산 크기가 신뢰 매니페스트와 다릅니다.');
  const id = String(asset.id ?? '');
  if (!/^[0-9]{1,18}$/.test(id)) miss('공개 릴리스 자산 id가 올바르지 않습니다.');
  await fetchFile({
    url: `${root}/repos/${manifest.repo}/releases/assets/${id}`, path,
    bytes: manifest.archive.bytes, sha256: manifest.archive.sha256, timeoutMs: ARCHIVE_TIMEOUT_MS, signal,
    headers: { Accept: 'application/octet-stream', 'User-Agent': 'oprn-bgm-install', 'X-GitHub-Api-Version': '2022-11-28' },
    allowRedirectHosts: hosts,
  });
}
async function downloadWithGh({ manifest, directory, signal, spawnProcess }) {
  // Fallback only. Credentials stay in gh's own store and are never placed in argv or logs.
  await new Promise((resolvePromise, reject) => {
    const child = spawnProcess('gh', ['release', 'download', manifest.tag, '--repo', manifest.repo,
      '--pattern', manifest.archive.fileName, '--dir', directory], {
      stdio: 'ignore', windowsHide: true, env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
    });
    let shutdown; let cancelled = false;
    const stop = () => {
      if (cancelled) return;
      cancelled = true;
      child.kill('SIGTERM');
      shutdown = setTimeout(() => child.kill('SIGKILL'), 2000);
    };
    const timeout = setTimeout(stop, ARCHIVE_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeout); clearTimeout(shutdown);
      signal?.removeEventListener('abort', stop);
    };
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    child.once('error', () => { cleanup(); reject(new Error('gh 실행 실패: gh 설치를 확인하세요.')); });
    child.once('close', (code) => {
      cleanup();
      if (signal?.aborted) reject(signal.reason);
      else if (code === 0 && !cancelled) resolvePromise();
      else reject(new Error('gh 다운로드 실패: gh 설치와 네트워크를 확인하세요.'));
    });
  });
}
// bgm-v1 is a public release. Anonymous HTTPS is the install path. gh runs only when both the
// browser asset URL and the public API asset endpoint refuse. The committed manifest's size
// and SHA-256 are the integrity check; a hash mismatch does not fall through to another channel.
export async function downloadRelease({
  manifest, directory, signal = undefined, spawnProcess = spawn, fetchFile = downloadFile,
  apiBase = 'https://api.github.com', downloadBase = 'https://github.com',
}) {
  signal?.throwIfAborted();
  const target = releaseTarget(manifest);
  const path = join(directory, target.archive.fileName);
  const hosts = redirectHosts([apiBase, downloadBase]);
  const direct = `${originBase(downloadBase)}/${target.repo}/releases/download/${encodeURIComponent(target.tag)}/${encodeURIComponent(target.archive.fileName)}`;
  const errors = [];
  const channels = [
    () => fetchFile({
      url: direct, path, bytes: target.archive.bytes, sha256: target.archive.sha256,
      timeoutMs: ARCHIVE_TIMEOUT_MS, signal, allowRedirectHosts: hosts,
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'oprn-bgm-install' },
    }),
    () => downloadViaApi({ manifest: target, path, signal, fetchFile, apiBase, hosts }),
  ];
  for (const channel of channels) {
    try { await channel(); return path; }
    catch (error) {
      stopForAbort(signal, error);
      if (!error.publicUnavailable) throw error;
      errors.push(error);
    }
  }
  console.error('익명 BGM 다운로드가 거절되어 gh로 다시 시도합니다.');
  try { await downloadWithGh({ manifest: target, directory, signal, spawnProcess }); }
  catch (error) {
    stopForAbort(signal, error);
    const prior = errors.map((item) => item.message).join('; ');
    throw new Error(`공개 BGM 릴리스를 받지 못했습니다 (${prior}). ${error.message} 수동 설치: https://github.com/${target.repo}/releases/tag/${target.tag} 의 ${target.archive.fileName} 를 받아 --archive 로 지정하세요.`);
  }
  return path;
}
async function snapshotArchive(archive, target, expected, signal) {
  signal?.throwIfAborted();
  const info = await regularFile(archive);
  if (!info || info.size !== expected.bytes) fail('Archive byte count mismatch');
  const check = meter(expected);
  await pipeline(createReadStream(archive), check.stream, createWriteStream(target, { flags: 'wx', mode: 0o600 }), { signal });
  check.check();
}
async function extractVerified(archive, dir, manifest, signal) {
  signal?.throwIfAborted();
  const allowed = new Map(manifest.tracks.map((track) => [track.fileName, track]));
  const seen = new Set(); let invalid;
  await tar.t({ file: archive, strict: true, onReadEntry(entry) {
    const track = allowed.get(entry.path);
    if (!track || seen.has(entry.path) || entry.type !== 'File' || entry.linkpath || entry.size !== track.bytes) {
      invalid ??= new Error(`Invalid archive entry: ${entry.path}`);
    }
    seen.add(entry.path);
  } });
  signal?.throwIfAborted();
  if (invalid) throw invalid;
  if (seen.size !== manifest.count) fail('Archive is missing tracks');
  await tar.x({ file: archive, cwd: dir, strict: true, noChmod: true, noMtime: true,
    filter: (path, entry) => allowed.has(path) && entry.type === 'File' });
  for (const track of manifest.tracks) {
    if (!await matches(join(dir, track.fileName), track, signal)) fail(`Extracted SHA256 mismatch: ${track.id}`);
  }
}
export async function installRelease({ root, manifest, archive, download = downloadRelease, promote = rename, signal = undefined }) {
  signal?.throwIfAborted();
  validateManifest(manifest);
  const dir = destination(root); const parent = dirname(dir);
  await safeDirectory(parent, true);
  const lockPath = join(parent, '.bgm-install.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') fail('BGM 설치 잠금이 있습니다. 다른 설치가 끝났는지 확인하세요. 중단된 설치의 잠금은 실행 중인 설치가 없음을 확인한 뒤 직접 제거하세요.');
    throw error;
  }
  let staging; let installed = 0;
  try {
    await lock.writeFile(`${process.pid}\n`);
    const status = await verifyInstalled({ root, manifest, signal });
    if (status.complete) return { installed: 0, verified: manifest.count, complete: true };
    staging = await mkdtemp(join(parent, '.bgm-stage-'));
    const snapshot = join(staging, 'verified.tar');
    if (archive) await snapshotArchive(resolve(archive), snapshot, manifest.archive, signal);
    else {
      const downloaded = await download({ manifest, directory: staging, signal });
      await snapshotArchive(downloaded, snapshot, manifest.archive, signal);
      await rm(downloaded);
    }
    const files = join(staging, 'files'); await mkdir(files);
    await extractVerified(snapshot, files, manifest, signal);
    await safeDirectory(dir, true);
    for (const track of manifest.tracks) {
      await safeDirectory(dir);
      const target = join(dir, track.fileName);
      if (await matches(target, track, signal)) continue;
      await promote(join(files, track.fileName), target);
      installed++;
    }
    const final = await verifyInstalled({ root, manifest, signal });
    if (!final.complete) fail(`BGM 최종 검증 실패: ${final.missing.join(', ')}`);
    return { installed, verified: final.verified, complete: true };
  } catch (error) {
    if (installed > 0) {
      const partial = new Error(`BGM 파일 ${installed}개를 교체했지만 전체 설치/최종 검증이 완료되지 않았습니다. 같은 명령을 다시 실행하면 복구합니다.`, { cause: error });
      partial.installed = installed; throw partial;
    }
    throw error;
  } finally {
    try { if (staging) await rm(staging, { recursive: true, force: true }); }
    finally { await lock.close(); await rm(lockPath); }
  }
}
export async function createRelease({ tracks, sourceDir, outDir }) {
  tracks = [...tracks].sort(compare); validateTracks(tracks);
  await safeDirectory(sourceDir);
  for (const track of tracks) {
    if (!await matches(join(sourceDir, track.fileName), track)) fail(`Source SHA256 mismatch: ${track.id}`);
  }
  await mkdir(outDir, { recursive: true });
  const temp = await mkdtemp(join(outDir, '.pack-'));
  try {
    const archive = join(temp, RELEASE.archiveName);
    await tar.c({ file: archive, cwd: sourceDir, portable: true, noPax: true, mtime: new Date(0),
      jobs: 1, strict: true, onWriteEntry(entry) { entry.mode = 0o644; entry.stat.mode = 0o100644; } }, tracks.map((track) => track.fileName));
    const manifest = validateManifest({ schemaVersion: RELEASE.schemaVersion, version: RELEASE.version,
      repo: RELEASE.repo, tag: RELEASE.tag, archive: { fileName: RELEASE.archiveName, ...await hashFile(archive) },
      count: tracks.length, totalBytes: tracks.reduce((sum, track) => sum + track.bytes, 0),
      license: RELEASE.license, source: RELEASE.source, tracks });
    const json = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestHash = createHash('sha256').update(json).digest('hex');
    await writeFile(join(temp, RELEASE.manifestName), json);
    await writeFile(join(temp, 'SHA256SUMS'), `${manifest.archive.sha256}  ${RELEASE.archiveName}\n${manifestHash}  ${RELEASE.manifestName}\n`);
    for (const name of [RELEASE.archiveName, RELEASE.manifestName, 'SHA256SUMS']) await rename(join(temp, name), join(outDir, name));
    return manifest;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export async function readTrustedManifest(path) {
  return validateManifest(JSON.parse(await readFile(path, 'utf8')), { production: true });
}
