import { mkdir, readFile, rename, rm, writeFile, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { BGM_CATALOG } from '../src/assets/bgmCatalog';
import { findBgmRuntimeEntry } from '../src/assets/bgmCatalogRuntime';
import { createRelease, downloadFile, hashFile, readTrustedManifest, RELEASE } from './lib/bgm-release.mjs';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { help: { type: 'boolean' } }, strict: true, allowPositionals: false });
if (values.help) {
  console.log('npm run bgm:pack\nCDN → artifacts/bgm-release/cache (최대 동시 4곡) → artifacts/bgm-release/{rpg-zzu-bgm-v1.tar,bgm-release-v1.json,SHA256SUMS}\n검증 완료 후 assets/bgm-release-v1.json을 고정합니다. 기존 고정 목록과 다르면 실패합니다.');
} else {
  const outDir = join(checkout, 'artifacts/bgm-release');
  const sourceDir = join(outDir, 'cache');
  const pinnedPath = join(checkout, 'assets/bgm-release-v1.json');
  await mkdir(sourceDir, { recursive: true });
  const lockPath = join(outDir, '.pack.lock');
  const lock = await open(lockPath, 'wx', 0o600);
  try {
    let pinned: Awaited<ReturnType<typeof readTrustedManifest>> | undefined;
    try { pinned = await readTrustedManifest(pinnedPath); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    if (BGM_CATALOG.length !== RELEASE.count || BGM_CATALOG.reduce((sum, track) => sum + track.bytes, 0) !== RELEASE.totalBytes) {
      throw new Error('BGM 카탈로그 곡 수/전체 크기가 v1과 다릅니다.');
    }
    const tracks = BGM_CATALOG.map((track) => {
      const entry = findBgmRuntimeEntry(track.id);
      if (!entry) throw new Error(`런타임 항목 없음: ${track.id}`);
      const known = /^[a-f0-9]{64}$/.test(track.sha256) ? track.sha256 : '';
      if (!known && track.sha256 !== '' && track.sha256 !== 'release-manifest') throw new Error(`알 수 없는 원본 해시: ${track.id}`);
      const previous = pinned?.tracks.find((item: { id: string }) => item.id === track.id);
      if (pinned && (!previous || previous.fileName !== entry.fileName || previous.bytes !== track.bytes || (known && previous.sha256 !== known))) {
        throw new Error(`고정 목록과 카탈로그가 다릅니다: ${track.id}`);
      }
      return { id: track.id, fileName: entry.fileName, bytes: track.bytes, sha256: known || previous?.sha256 || '' };
    });
    const pending = tracks.values();
    let failure: unknown; let completed = 0;
    const worker = async () => {
      while (!failure) {
        const next = pending.next();
        if (next.done) return;
        const track = next.value;
        try {
          const path = join(sourceDir, track.fileName);
          let existing: Awaited<ReturnType<typeof hashFile>> | undefined;
          try { existing = await hashFile(path); }
          catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
          if (!existing || existing.bytes !== track.bytes || (track.sha256 && existing.sha256 !== track.sha256)) {
            existing = await downloadFile({ url: `${RELEASE.cdn}${encodeURIComponent(track.fileName)}`, path,
              bytes: track.bytes, sha256: track.sha256 || undefined });
          }
          track.sha256 = existing.sha256;
          console.log(`[${++completed}/${tracks.length}] ${track.id} ${track.bytes} ${track.sha256}`);
        } catch (error) { failure = error; }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (failure) throw failure;
    const manifest = await createRelease({ tracks, sourceDir, outDir });
    const json = await readFile(join(outDir, RELEASE.manifestName), 'utf8');
    if (pinned && JSON.stringify(manifest) !== JSON.stringify(pinned)) throw new Error('재생성한 릴리스가 고정 목록과 다릅니다. v1을 덮어쓰지 마세요.');
    await mkdir(dirname(pinnedPath), { recursive: true });
    const temp = `${pinnedPath}.${randomUUID()}.tmp`;
    try { await writeFile(temp, json, { flag: 'wx' }); await rename(temp, pinnedPath); }
    finally { await rm(temp, { force: true }); }
    console.log(JSON.stringify({ count: manifest.count, totalBytes: manifest.totalBytes, archive: manifest.archive, outDir }));
  } finally { await lock.close(); await rm(lockPath); }
}
