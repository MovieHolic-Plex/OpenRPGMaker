import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
import { SHARED_LIBRARY_REF, sharedTileReferenceKits, type SharedTileReferenceSnapshot } from '../../src/project/sharedTileReferences';
import type { Project } from '../../src/project/types';
import type { SharedSpatialReferences } from '../../src/project/sharedSpatialReferences';
import { gunzipSync, gzipSync } from 'node:zlib';
import { sharedContentPreviewUrl, sharedReferenceImageLinker } from './sharedContentSqlite';
import type { SharedContentSnapshot } from '../../src/project/sharedContentSchema';
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const defaultFile = () => process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite');
/**
 * `libraryRefs`: 편집기 응답 전용. 공용 카탈로그(`/__oprn/shared-content`)에 **같은 객체**로 들어 있는 타일셋·그림·참고문서를
 * 싣지 않고 라이브러리 id 만 적는다. 편집기는 이미 설치한 카탈로그에서 채운다(src/project/sharedTileReferences.ts).
 * 실측(2026-09-28, 팀 첫 참여): 이 응답 82MB(gzip 25MB) 전부가 카탈로그와 같은 글이었다.
 */
export function readSharedTileReferences(file = defaultFile(), options: { readonly linkImages?: boolean; readonly libraryRefs?: boolean } = {}): SharedTileReferenceSnapshot {
  if (!existsSync(file)) return { revision: '', entries: [] };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[];
    return tileReferencesFromRows(rows.map(row => ({ id: row.id, revision: row.revision, lib: JSON.parse(row.payload) })), file, options);
  } finally { db.close(); }
}

/**
 * 공용 카탈로그(readSharedContent 와 같은 모양)와 지역·타일 참고 스냅숏을 **한 번 읽고 한 번 파싱해** 둘 다 만든다.
 * 둘은 같은 content_libraries 행 전부(2026-10-04 기준 37행 505MB)를 따로 SELECT·JSON.parse 했다 — 워커의 첫 실행 준비가
 * 부하 걸린 머신에서 35~41s 였다. 두 설치는 읽기 전용이라(installSharedContent·installSharedSpatialReferences) 객체를 같이 써도 된다.
 */
export function readSharedCatalogsOnce(file = defaultFile()): { readonly tileReferences: SharedTileReferenceSnapshot; readonly content: SharedContentSnapshot } {
  if (!existsSync(file)) return { tileReferences: { revision: '', entries: [] }, content: { revision: hash(''), libraries: {} } };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = (db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[])
      .map(row => ({ id: row.id, revision: row.revision, lib: JSON.parse(row.payload) }));
    const tileReferences = tileReferencesFromRows(rows, file, {});
    return { tileReferences, content: { revision: tileReferences.revision, libraries: Object.fromEntries(rows.map(row => [row.id, row.lib])) } };
  } finally { db.close(); }
}

type SharedLibraryRow = { readonly id: string; readonly revision: string; readonly lib: { tilesets: Project['tilesets']; assets: Project['assets']['uploaded']; maps?: Project['maps']; regionReferences?: SharedSpatialReferences['regions']; regions?: Record<string, SharedSpatialReferences['regions'][number]> } };

function tileReferencesFromRows(rows: readonly SharedLibraryRow[], file: string, options: { readonly linkImages?: boolean; readonly libraryRefs?: boolean }): SharedTileReferenceSnapshot {
  const link = options.linkImages ? sharedReferenceImageLinker(file) : null;
  const entries: SharedTileReferenceSnapshot['entries'] = [], seen = new Set<string>();
  const spatial: SharedSpatialReferences = {regions: [], maps: {}, tilesets: {}, assets: {}};
  for (const row of rows) {
    const lib = row.lib;
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
        spatial.regions.push({ ...reference, preview, sourceMapId: map.id }); spatial.maps[map.id] = map;
        spatial.tilesets[tile.id] = options.libraryRefs ? { [SHARED_LIBRARY_REF]: row.id } as unknown as typeof tile : tile;
        if (tile.image.type === 'uploaded' && lib.assets[tile.image.id]) {
          spatial.assets[tile.image.id] = options.libraryRefs ? { [SHARED_LIBRARY_REF]: row.id } as unknown as typeof lib.assets[string] : lib.assets[tile.image.id];
        }
      }
    }
    for (const [id, tile] of Object.entries(lib.tilesets)) {
      if (!id.startsWith('shared_') || !tile.referenceDocuments?.length || tile.image?.type !== 'uploaded') continue;
      const asset = lib.assets[tile.image.id], dataUrl = asset?.dataUrl;
      if (!dataUrl?.startsWith('data:image/') || !dataUrl.includes(';base64,')) continue;
      if (seen.has(id)) throw new Error(`Duplicate shared tileset ID: ${id}`);
      validateTilesetReferences(tile.referenceDocuments); seen.add(id);
      if (link) { link(tile.referenceDocuments); for (const kit of tile.structureKits ?? []) link(kit.referenceDocuments); }
      const identity = { id, tileSize: tile.tileSize, tilesPerRow: tile.tilesPerRow, count: tile.count, assetId: tile.image.id,
        imageSha256: hash(Buffer.from(dataUrl.split(',')[1], 'base64')), dataUrlSha256: hash(dataUrl) };
      // 참고문서·구조 킷은 카탈로그 타일셋의 그것 그대로다(sharedTileReferenceKits 와 같은 거름).
      entries.push(options.libraryRefs
        ? { ...identity, library: row.id } as unknown as SharedTileReferenceSnapshot['entries'][number]
        : { ...identity, documents: tile.referenceDocuments, kits: sharedTileReferenceKits(tile) });
    }
  }
  return { revision: hash(rows.map(r => r.id + ':' + r.revision).join('\n')), entries, spatial };
}

/**
 * 편집기가 받는 응답. 참고 이미지는 호스트 주소로, 지역 미리보기는 미리보기 주소로 바꾸고 gzip 해서 판본마다 한 번 만든다.
 * 실측(2026-09-26): 원본 191MB 를 부팅마다 4.7s 에 만들어 보냈고, 편집기의 10s 제한을 넘겨 항상 실패했다(부팅 +10s).
 */
const encodedCache = new Map<string, { revision: string; gzip: Buffer }>();
/** 편집기 응답 형식 판. 2 = 카탈로그에 있는 타일셋·그림·참고문서를 라이브러리 표식으로 보낸다. */
const TILE_REFERENCES_WIRE = 'w2';
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
  const snapshot = readSharedTileReferences(file, { linkImages: true, libraryRefs: true });
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
  // 형식 판을 ETag 에 넣는다 — 라이브러리 표식 이전 형식을 기기에 캐시한 클라이언트가 304 로 옛 글을 계속 쓰지 않게.
  const early = `"tile-references-${TILE_REFERENCES_WIRE}-${revision}"`;
  if (ifNoneMatch && ifNoneMatch.split(',').some(tag => tag.trim() === early)) return { body: Buffer.alloc(0), gzip, etag: early, notModified: true };
  const encoded = encodedSharedTileReferencesWithRevision();
  const etag = `"tile-references-${TILE_REFERENCES_WIRE}-${encoded.revision}"`;
  return { body: gzip ? encoded.gzip : gunzipSync(encoded.gzip), gzip, etag, notModified: false };
}
/** 카탈로그 판본(행 판본의 해시). payload 를 읽지 않는다. `readSharedTileReferences` 의 revision 과 같은 값이다. */
export function sharedTileReferencesRevision(file = defaultFile()): string {
  if (!existsSync(file)) return '';
  const db = new DatabaseSync(file, { readOnly: true });
  try { return hash((db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]).map(r => r.id + ':' + r.revision).join('\n')); }
  finally { db.close(); }
}
