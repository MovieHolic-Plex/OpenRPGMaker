import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
import { linkSharedTileReferenceImages } from './sharedContentSqlite';
import type { SharedTileReferenceSnapshot } from '../../src/project/sharedTileReferences';
import type { Project } from '../../src/project/types';
import type { SharedSpatialReferences } from '../../src/project/sharedSpatialReferences';
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const sharedTileReferencesFile = () => process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite');
/**
 * 호스트 응답용 직렬화본 — 카탈로그 판본이 같으면 읽기·검증·직렬화·압축을 다시 하지 않는다(encodedSharedContent 선례).
 * 실측(2026-09-26): 응답 183MB(공간 105MB), 읽기+직렬화 24.8s. 대부분 base64 이미지라 gzip(1) 도 132MB 에 멈추지만,
 * 매 요청 24.8s 를 판본당 한 번으로 줄이는 것이 본체다. 판본 확인은 payload 없는 SELECT 다.
 * 압축본만 들고 있어 상주 메모리를 줄이고, gzip 을 못 받는 클라이언트에는 호출자가 풀어 보낸다.
 * 파일이 없으면 null — 빈 스냅샷은 작아서 캐시할 이유가 없다.
 */
const encodedCache = new Map<string, { revision: string; gzip: Buffer }>();
export function encodedSharedTileReferences(file = sharedTileReferencesFile()): Buffer | null {
  if (!existsSync(file)) return null;
  const db = new DatabaseSync(file, { readOnly: true });
  let revision: string;
  try { revision = hash((db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]).map(r => r.id + ':' + r.revision).join('\n')); }
  finally { db.close(); }
  const cached = encodedCache.get(file);
  if (cached?.revision === revision) return cached.gzip;
  const snapshot = readSharedTileReferences(file);
  // 카탈로그 응답과 같은 내용 주소로 바꾼다 — 늦게 적용돼도 프로젝트 참고문서를 인라인으로 되돌리지 않는다.
  // 이미지 식별 필드(imageSha256·dataUrlSha256)는 타일셋 그림 자체라 그대로다.
  linkSharedTileReferenceImages(snapshot.entries, file);
  const gzip = gzipSync(JSON.stringify(snapshot), { level: 1 });
  encodedCache.set(file, { revision: snapshot.revision, gzip });
  return gzip;
}
export function readSharedTileReferences(file = sharedTileReferencesFile()): SharedTileReferenceSnapshot {
  if (!existsSync(file)) return { revision: '', entries: [] };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[];
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
          spatial.regions.push({ ...reference, sourceMapId: map.id }); spatial.maps[map.id] = map; spatial.tilesets[tile.id] = tile;
          if (tile.image.type === 'uploaded' && lib.assets[tile.image.id]) spatial.assets[tile.image.id] = lib.assets[tile.image.id];
        }
      }
      for (const [id, tile] of Object.entries(lib.tilesets)) {
        if (!id.startsWith('shared_') || !tile.referenceDocuments?.length || tile.image?.type !== 'uploaded') continue;
        const asset = lib.assets[tile.image.id], dataUrl = asset?.dataUrl;
        if (!dataUrl?.startsWith('data:image/') || !dataUrl.includes(';base64,')) continue;
        if (seen.has(id)) throw new Error(`Duplicate shared tileset ID: ${id}`);
        validateTilesetReferences(tile.referenceDocuments); seen.add(id);
        entries.push({ id, tileSize: tile.tileSize, tilesPerRow: tile.tilesPerRow, count: tile.count, assetId: tile.image.id,
          imageSha256: hash(Buffer.from(dataUrl.split(',')[1], 'base64')), dataUrlSha256: hash(dataUrl), documents: tile.referenceDocuments,
          kits: tile.structureKits?.filter(k => k.id.startsWith('shared_')) });
      }
    }
    return { revision: hash(rows.map(r => r.id + ':' + r.revision).join('\n')), entries, spatial };
  } finally { db.close(); }
}
