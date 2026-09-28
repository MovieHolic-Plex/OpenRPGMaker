import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
import type { SharedTileReferenceSnapshot } from '../../src/project/sharedTileReferences';
import type { Project } from '../../src/project/types';
import type { SharedSpatialReferences } from '../../src/project/sharedSpatialReferences';
import { gunzipSync, gzipSync } from 'node:zlib';
import { sharedContentPreviewUrl, sharedReferenceImageLinker } from './sharedContentSqlite';
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const defaultFile = () => process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite');
export function readSharedTileReferences(file = defaultFile(), options: { readonly linkImages?: boolean } = {}): SharedTileReferenceSnapshot {
  if (!existsSync(file)) return { revision: '', entries: [] };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[];
    const link = options.linkImages ? sharedReferenceImageLinker(file) : null;
    const entries: SharedTileReferenceSnapshot['entries'] = [], seen = new Set<string>();
    const spatial: SharedSpatialReferences = {regions: [], maps: {}, tilesets: {}, assets: {}};
    for (const row of rows) {
      const lib = JSON.parse(row.payload) as { tilesets: Project['tilesets']; assets: Project['assets']['uploaded']; maps?: Project['maps']; regionReferences?: SharedSpatialReferences['regions']; regions?: Record<string, SharedSpatialReferences['regions'][number]> };
      const regions = new Map((lib.regionReferences ?? []).map(reference => [reference.id, reference]));
      for (const reference of Object.values(lib.regions ?? {})) {
        const previous = regions.get(reference.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(reference)) throw new Error(`Conflicting shared region reference: ${reference.id}`);
        regions.set(reference.id, reference);
      }
      if (regions.size) {
        for (const reference of regions.values()) {
          // regions is keyed by the saved snapshot; sourceMapId is provenance and
          // several snapshots can legitimately originate from the same source map.
          const snapshot = lib.regions?.[reference.id] ? lib.maps?.[reference.id] : lib.maps?.[reference.sourceMapId];
          const map = snapshot && { ...snapshot, id: reference.id }, tile = map && lib.tilesets[map.tilesetId];
          if (!reference.id.startsWith('shared_') || !map || !tile || reference.width !== map.width || reference.height !== map.height
            || reference.tilesetId !== map.tilesetId || map.lowerTiles.length !== map.width * map.height || map.upperTiles.length !== map.width * map.height) throw new Error('Invalid shared region reference');
          if (reference.referenceDocuments) validateTilesetReferences(reference.referenceDocuments);
          // 편집기 응답: 미리보기는 호스트 미리보기 주소로(regions 에 저장된 것만 그 경로로 읽힌다).
          const preview = link && lib.regions?.[reference.id]?.preview.startsWith('data:') ? sharedContentPreviewUrl(row.id, row.revision, 'region', reference.id) : reference.preview;
          if (link) { link(reference.referenceDocuments); link(tile.referenceDocuments); for (const kit of tile.structureKits ?? []) link(kit.referenceDocuments); }
          spatial.regions.push({ ...reference, preview, sourceMapId: map.id }); spatial.maps[map.id] = map; spatial.tilesets[tile.id] = tile;
          if (tile.image.type === 'uploaded' && lib.assets[tile.image.id]) spatial.assets[tile.image.id] = lib.assets[tile.image.id];
        }
      }
      for (const [id, tile] of Object.entries(lib.tilesets)) {
        if (!id.startsWith('shared_') || !tile.referenceDocuments?.length || tile.image?.type !== 'uploaded') continue;
        const asset = lib.assets[tile.image.id], dataUrl = asset?.dataUrl;
        if (!dataUrl?.startsWith('data:image/') || !dataUrl.includes(';base64,')) continue;
        if (seen.has(id)) throw new Error(`Duplicate shared tileset ID: ${id}`);
        validateTilesetReferences(tile.referenceDocuments); seen.add(id);
        if (link) { link(tile.referenceDocuments); for (const kit of tile.structureKits ?? []) link(kit.referenceDocuments); }
        entries.push({ id, tileSize: tile.tileSize, tilesPerRow: tile.tilesPerRow, count: tile.count, assetId: tile.image.id,
          imageSha256: hash(Buffer.from(dataUrl.split(',')[1], 'base64')), dataUrlSha256: hash(dataUrl), documents: tile.referenceDocuments,
          kits: tile.structureKits?.filter(k => k.id.startsWith('shared_')) });
      }
    }
    return { revision: hash(rows.map(r => r.id + ':' + r.revision).join('\n')), entries, spatial };
  } finally { db.close(); }
}

/**
 * 편집기가 받는 응답. 참고 이미지는 호스트 주소로, 지역 미리보기는 미리보기 주소로 바꾸고 gzip 해서 판본마다 한 번 만든다.
 * 실측(2026-09-26): 원본 191MB 를 부팅마다 4.7s 에 만들어 보냈고, 편집기의 10s 제한을 넘겨 항상 실패했다(부팅 +10s).
 */
const encodedCache = new Map<string, { revision: string; gzip: Buffer }>();
export function encodedSharedTileReferences(file = defaultFile()): Buffer {
  return encodedSharedTileReferencesWithRevision(file).gzip;
}
/** 압축본과 그 판본. 판본은 카탈로그 행 판본의 해시라 payload 를 읽지 않고 1ms 대에 얻는다. */
export function encodedSharedTileReferencesWithRevision(file = defaultFile()): { readonly revision: string; readonly gzip: Buffer } {
  if (!existsSync(file)) return { revision: '', gzip: gzipSync(JSON.stringify({ revision: '', entries: [] }), { level: 1 }) };
  const db = new DatabaseSync(file, { readOnly: true });
  let revision: string;
  try { revision = hash((db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]).map(r => r.id + ':' + r.revision).join('\n')); }
  finally { db.close(); }
  const cached = encodedCache.get(file);
  if (cached?.revision === revision) return cached;
  const snapshot = readSharedTileReferences(file, { linkImages: true });
  const gzip = gzipSync(JSON.stringify(snapshot), { level: 1 });
  const entry = { revision: snapshot.revision, gzip };
  encodedCache.set(file, entry);
  return entry;
}
/**
 * `accept-encoding` 에 gzip 이 없으면 풀어서 준다. `ifNoneMatch` 가 지금 판본이면 본문 없이 304 다.
 * 실측(2026-09-28, Tailscale 참여): 이 응답이 부팅마다 gzip 25MB(4.4–8.0s)를 다시 보냈다.
 */
export function sharedTileReferencesBody(acceptEncoding: string | undefined, ifNoneMatch?: string): { readonly body: Buffer; readonly gzip: boolean; readonly etag: string; readonly notModified: boolean } {
  const gzip = /\bgzip\b/.test(acceptEncoding ?? '');
  // 304 판정에는 판본만 있으면 된다. 첫 요청이면 본문(약 190MB 읽기·압축, 호스트 메인 스레드 약 6s)을 만들지 않는다.
  const revision = sharedTileReferencesRevision();
  const early = `"tile-references-${revision}"`;
  if (ifNoneMatch && ifNoneMatch.split(',').some(tag => tag.trim() === early)) return { body: Buffer.alloc(0), gzip, etag: early, notModified: true };
  const encoded = encodedSharedTileReferencesWithRevision();
  const etag = `"tile-references-${encoded.revision}"`;
  return { body: gzip ? encoded.gzip : gunzipSync(encoded.gzip), gzip, etag, notModified: false };
}
/** 카탈로그 판본(행 판본의 해시). payload 를 읽지 않는다. `readSharedTileReferences` 의 revision 과 같은 값이다. */
export function sharedTileReferencesRevision(file = defaultFile()): string {
  if (!existsSync(file)) return '';
  const db = new DatabaseSync(file, { readOnly: true });
  try { return hash((db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]).map(r => r.id + ':' + r.revision).join('\n')); }
  finally { db.close(); }
}
