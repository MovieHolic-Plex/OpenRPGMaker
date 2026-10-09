import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as tar from 'tar';

export function validateStillRows(stills, { release = false } = {}) {
  if (!Array.isArray(stills) || !stills.length) throw new Error('stills 배열이 비어 있습니다.');
  const ids = new Set(), files = new Set();
  for (const s of stills) {
    if (!s || !/^oprn-pack-still-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)
      || !/^[a-z0-9][a-z0-9_-]*\.(?:jpg|webp|png)$/.test(s.fileName)) throw new Error('잘못된 스틸 ID/파일명');
    if (ids.has(s.id) || files.has(s.fileName)) throw new Error('중복 스틸: ' + s.id);
    ids.add(s.id); files.add(s.fileName);
    if (release) {
      if (!/^[a-f0-9]{64}$/.test(s.sha256) || !Number.isSafeInteger(s.bytes) || s.bytes <= 0) throw new Error('잘못된 스틸 무결성 정보: ' + s.id);
    } else if (typeof s.name !== 'string' || !s.name.trim() || !Array.isArray(s.tags)
      || !s.tags.length || s.tags.some(t => typeof t !== 'string' || !t.trim())) throw new Error('이름/태그 누락: ' + s.id);
  }
  return stills;
}

export function validateStillRelease(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.repo !== 'MovieHolic-Plex/OpenRPGMaker' || manifest.tag !== 'stills-v1'
    || manifest.archive?.fileName !== 'rpg-zzu-stills-v1.tar' || !/^[a-f0-9]{64}$/.test(manifest.archive?.sha256)
    || !Number.isSafeInteger(manifest.archive?.bytes) || manifest.archive.bytes <= 0) throw new Error('잘못된 스틸 릴리스 manifest');
  validateStillRows(manifest.stills, { release: true });
  if (manifest.count !== manifest.stills.length || manifest.totalBytes !== manifest.stills.reduce((n, s) => n + s.bytes, 0)) throw new Error('스틸 개수/용량 불일치');
  return manifest;
}

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyStills(dir, manifest, signal) {
  const missing = [];
  for (const s of manifest.stills) {
    signal?.throwIfAborted();
    try {
      const stat = await lstat(join(dir, s.fileName));
      if (!stat.isFile() || stat.size !== s.bytes || await sha256(join(dir, s.fileName)) !== s.sha256) missing.push(s.id);
    } catch { missing.push(s.id); }
  }
  return { complete: !missing.length, verified: manifest.stills.length - missing.length, missing };
}

/** The caller holds the install lock. Verify the entire snapshot before replacing an installed pack. */
export async function installStillArchive({ archive, target, manifest, signal }) {
  validateStillRelease(manifest);
  const info = await lstat(archive);
  if (!info.isFile() || info.size !== manifest.archive.bytes || await sha256(archive) !== manifest.archive.sha256) throw new Error('아카이브 sha256/용량 불일치');
  const parent = join(target, '..');
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, '.stills-stage-'));
  const extracted = join(staging, 'files'), backup = join(staging, 'previous');
  const entries = new Map(manifest.stills.map(s => [s.fileName, s]));
  const seen = new Set();
  let backedUp = false, invalidEntry;
  try {
    await mkdir(extracted);
    await tar.x({ file: archive, cwd: extracted, strict: true, filter(name, entry) {
      const expected = entries.get(name);
      if (!expected || entry.type !== 'File' || entry.size !== expected.bytes || seen.has(name)) {
        invalidEntry ??= new Error('예상하지 않은 아카이브 항목: ' + name);
        return false;
      }
      seen.add(name);
      return true;
    } });
    if (invalidEntry) throw invalidEntry;
    const result = await verifyStills(extracted, manifest, signal);
    if (!result.complete) throw new Error('누락/손상 스틸: ' + result.missing.join(', '));
    signal?.throwIfAborted();
    try { await rename(target, backup); backedUp = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await rename(extracted, target); }
    catch (e) { if (backedUp) await rename(backup, target); throw e; }
    return result;
  } finally { await rm(staging, { recursive: true, force: true }); }
}
