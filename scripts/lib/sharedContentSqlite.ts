import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SHARED_CONTENT_ENDPOINT, SHARED_CONTENT_PREVIEW_ENDPOINT, type SharedContentLibrary, type SharedContentScope, type SharedContentSnapshot } from '../../src/project/sharedContentSchema';
import { validateTilesetReferences, type TilesetReferenceCategory } from '../../src/project/tilesetReferences';
import { parseSharedReferenceImage, sharedReferenceImageAddress, SHARED_REFERENCE_IMAGE_PREFIX } from '../../src/project/bundledReferenceImagePath';
export const sharedContentFile = () => process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function open(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS content_libraries (id TEXT PRIMARY KEY, revision TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS content_history (id TEXT NOT NULL, revision TEXT NOT NULL, payload TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY(id, revision));');
  return db;
}
const snapshotRevision = (rows: readonly { id: string; revision: string }[]) => hash(rows.map(r => r.id + ':' + r.revision).join('\n'));
export function readSharedContent(file = sharedContentFile()): SharedContentSnapshot {
  const db = open(file);
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as { id: string; revision: string; payload: string }[];
    return { revision: snapshotRevision(rows), libraries: Object.fromEntries(rows.map(r => [r.id, JSON.parse(r.payload)])) };
  } finally { db.close(); }
}
/**
 * 편집기용 스냅샷. 게시 스크립트가 쓰는 readSharedContent 와 달리 미리보기 dataURL 을 주소로 바꾼다.
 * 실측(2026-09-26): 전체 응답 395MB 중 미리보기가 185MB 였고, 부팅마다 이걸 받고 파싱하느라
 * 편집기 진입이 약 40초 걸렸다. 'defaults' 는 모든 프로젝트에 설치되는 projectDefaults 라이브러리만 준다.
 * revision 은 두 범위 모두 전체 행 기준이다 — 범위가 달라도 같은 카탈로그 판본임을 비교할 수 있어야 한다.
 */
export function readSharedContentForEditor(scope: SharedContentScope, file = sharedContentFile()): SharedContentSnapshot {
  const db = open(file);
  try {
    const all = db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[];
    const rows = (scope === 'defaults'
      ? db.prepare("SELECT id, revision, payload FROM content_libraries WHERE json_extract(payload, '$.projectDefaults') = 1 ORDER BY id").all()
      : scope === 'rest'
        // 부팅이 defaults 를 이미 받았다 — 뒤따르는 요청은 나머지만 받는다(2026-09-27 실측: defaults 20MB 가 두 번 왔다).
        ? db.prepare("SELECT id, revision, payload FROM content_libraries WHERE coalesce(json_extract(payload, '$.projectDefaults'), 0) != 1 ORDER BY id").all()
        : db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all()) as { id: string; revision: string; payload: string }[];
    const libraries = Object.fromEntries(rows.map(r => [r.id, linkReferenceImages(linkPreviews(r.id, r.revision, JSON.parse(r.payload) as SharedContentLibrary), referenceImageIndexFor(file, snapshotRevision(all)))]));
    return { revision: snapshotRevision(all), libraries, assetBytesSha256: defaultAssetBytesSha256(libraries) };
  } finally { db.close(); }
}
/**
 * 기본 라이브러리 그림의 바이트 SHA-256. 편집기는 설치 때 이 값으로 기본 자산의 정체를 맞춘다(src/project/sharedContent.ts).
 * HTTP 팀 참여 창은 crypto.subtle 이 없어 JS 로 셌다 — 호스트가 판본마다 한 번 센다(응답 압축본과 함께 캐시된다).
 */
function defaultAssetBytesSha256(libraries: Record<string, SharedContentLibrary>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const library of Object.values(libraries)) {
    if (!library.projectDefaults) continue;
    for (const asset of Object.values(library.assets)) {
      const dataUrl = asset.dataUrl;
      if (!dataUrl?.startsWith('data:image/')) continue;
      out[asset.id] = createHash('sha256').update(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')).digest('hex');
    }
  }
  return out;
}
/**
 * 타일셋 참고문서 이미지(타일셋·구조 킷)를 내용 주소로 바꾼다. 이 타일셋들은 프로젝트에 복사되는데,
 * 실측(2026-09-26) 기본 라이브러리 97MB 중 33.6MB 가 이 이미지 7,550장이었다. 장소·지역 문서는 복사되지 않아 그대로 둔다.
 * 주소 → 원본 dataURL 은 색인에 남겨 이미지 요청이 SQLite 를 다시 파싱하지 않게 한다.
 */
function linkReferenceImages(library: SharedContentLibrary, index: Map<string, string>): SharedContentLibrary {
  for (const tileset of Object.values(library.tilesets)) {
    linkReferenceCategories(tileset.referenceDocuments, index);
    for (const kit of tileset.structureKits ?? []) linkReferenceCategories(kit.referenceDocuments, index);
  }
  return library;
}
function linkReferenceCategories(categories: TilesetReferenceCategory[] | undefined, index: Map<string, string>): void {
  for (const category of categories ?? []) for (const image of category.images) {
    const address = sharedReferenceImageAddress(image.dataUrl);
    if (!address) continue;
    if (!index.has(address)) index.set(address, image.dataUrl);
    image.dataUrl = address;
  }
}
/**
 * 공용 타일 참고문서 응답(`/__oprn/shared-tile-references`)도 카탈로그와 **같은 주소**로 보낸다.
 * 실측(2026-09-26): 이 응답만 인라인 dataURL 이라, 늦게 도착해 열린 프로젝트에 적용되면 카탈로그가 주소로
 * 바꿔 둔 참고문서 295개가 인라인으로 되돌아갔다(15.3MB → 33.1MB). 타일셋 전부가 바뀐 것으로 보여 첫 칠하기
 * 저장이 60초 넘게 끝나지 않았다. 같은 색인에 넣으므로 주소 요청은 기존 핸들러가 바이트로 푼다.
 */
export function linkSharedTileReferenceImages(entries: readonly { documents: TilesetReferenceCategory[]; kits?: readonly { referenceDocuments?: TilesetReferenceCategory[] }[] }[], file = sharedContentFile()): void {
  const db = open(file);
  let revision: string;
  try { revision = snapshotRevision(db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]); }
  finally { db.close(); }
  const index = referenceImageIndexFor(file, revision);
  for (const entry of entries) {
    linkReferenceCategories(entry.documents, index);
    for (const kit of entry.kits ?? []) linkReferenceCategories(kit.referenceDocuments, index);
  }
}
const referenceImageIndexes = new Map<string, { revision: string; images: Map<string, string> }>();
function referenceImageIndexFor(file: string, revision: string): Map<string, string> {
  const current = referenceImageIndexes.get(file);
  if (current?.revision === revision) return current.images;
  const images = new Map<string, string>();
  referenceImageIndexes.set(file, { revision, images });
  return images;
}
/**
 * 같은 주소 규칙·색인으로 다른 호스트 응답(공용 타일 참고문서)의 참고 이미지를 주소로 바꾸는 함수를 돌려준다.
 * 판본은 한 번만 읽는다 — 호출자는 문서 수천 개를 돌린다.
 */
export function sharedReferenceImageLinker(file = sharedContentFile()): (categories: TilesetReferenceCategory[] | undefined) => void {
  const db = open(file);
  let revision: string;
  try { revision = snapshotRevision(db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]); }
  finally { db.close(); }
  const index = referenceImageIndexFor(file, revision);
  return (categories) => {
    for (const category of categories ?? []) for (const image of category.images) {
      const address = sharedReferenceImageAddress(image.dataUrl);
      if (!address) continue;
      if (!index.has(address)) index.set(address, image.dataUrl);
      image.dataUrl = address;
    }
  };
}
/** Bytes behind a shared reference image address. Builds the index from every library once per catalog revision. */
export function readSharedReferenceImage(address: string, file = sharedContentFile()): { mime: string; bytes: Buffer } | null {
  const parsed = parseSharedReferenceImage(address);
  if (!parsed) return null;
  const db = open(file);
  let revision: string;
  try { revision = snapshotRevision(db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]); }
  finally { db.close(); }
  const index = referenceImageIndexFor(file, revision);
  if (!index.has(address)) {
    for (const library of Object.values(readSharedContent(file).libraries)) linkReferenceImages(library, index);
  }
  const dataUrl = index.get(address);
  if (!dataUrl) return null;
  return { mime: parsed.mime, bytes: Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64') };
}
export function sharedContentPreviewUrl(library: string, revision: string, kind: 'place' | 'region', id: string): string {
  return `${SHARED_CONTENT_PREVIEW_ENDPOINT}?${new URLSearchParams({ library, kind, id, v: revision.slice(0, 16) })}`;
}
function linkPreviews(libraryId: string, revision: string, library: SharedContentLibrary): SharedContentLibrary {
  for (const [id, value] of Object.entries(library.previews ?? {})) {
    if (value.startsWith('data:')) library.previews[id] = sharedContentPreviewUrl(libraryId, revision, 'place', id);
  }
  for (const [id, region] of Object.entries(library.regions ?? {})) {
    if (region.preview.startsWith('data:')) region.preview = sharedContentPreviewUrl(libraryId, revision, 'region', id);
  }
  return library;
}
/** One preview image as bytes. The row is not parsed in JS; SQLite extracts the single field. */
export function readSharedContentPreview(library: string, kind: string, id: string, file = sharedContentFile()): { mime: string; bytes: Buffer } | null {
  if (kind !== 'place' && kind !== 'region') return null;
  const path = kind === 'place' ? "'$.previews.' || json_quote(?)" : "'$.regions.' || json_quote(?) || '.preview'";
  const db = open(file);
  try {
    const row = db.prepare(`SELECT json_extract(payload, ${path}) AS value FROM content_libraries WHERE id = ?`).get(id, library) as { value: unknown } | undefined;
    const match = typeof row?.value === 'string' ? /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(row.value) : null;
    return match ? { mime: match[1], bytes: Buffer.from(match[2], 'base64') } : null;
  } finally { db.close(); }
}
/** Local publishing API only. Compare-and-swap is scoped to a library, not unrelated catalogs. */
export function publishSharedContent(id: string, value: SharedContentLibrary, expectedRevision: string | null, file = sharedContentFile()) {
  if (!/^[\w.-]{1,100}$/.test(id) || value.version !== 1) throw new Error('Invalid shared library');
  for (const t of Object.values(value.tilesets)) {
    if(t.referenceDocuments) validateTilesetReferences(t.referenceDocuments);
    for (const kit of t.structureKits ?? []) if (kit.referenceDocuments) validateTilesetReferences(kit.referenceDocuments);
    if(t.referenceSourceTilesetId && !value.tilesets[t.referenceSourceTilesetId]) throw new Error('Missing reference owner');
  }
  for(const root of value.roots) if(!value.places[root]) throw new Error('Missing place root');
  for (const place of Object.values(value.places)) if (place.referenceDocuments) validateTilesetReferences(place.referenceDocuments);
  for(const place of Object.values(value.places)) if(place.exterior && !value.tilesets[place.exterior.tilesetId]?.structureKits?.some(k=>k.id===place.exterior!.kitId)) throw new Error('Missing place raster');
  for (const [id, region] of Object.entries(value.regions ?? {})) {
    if (region.referenceDocuments) validateTilesetReferences(region.referenceDocuments);
    const map = value.maps[id];
    if (!id.startsWith('shared_') || region.id !== id || region.kind !== 'completed-map' || !map
      || map.width !== region.width || map.height !== region.height || map.tilesetId !== region.tilesetId
      || !value.tilesets[map.tilesetId] || map.lowerTiles.length !== map.width * map.height
      || map.upperTiles.length !== map.width * map.height) throw new Error('Invalid shared region snapshot');
  }
  const payload = JSON.stringify(value), revision = hash(payload), db = open(file);
  try {
    db.exec('BEGIN IMMEDIATE');
    const old = db.prepare('SELECT revision, payload FROM content_libraries WHERE id=?').get(id) as { revision: string; payload: string } | undefined;
    if ((old?.revision ?? null) !== expectedRevision) throw new Error('Shared library changed. Reload before publishing.');
    if (old) db.prepare('INSERT OR IGNORE INTO content_history VALUES (?,?,?,?)').run(id,old.revision,old.payload,new Date().toISOString());
    db.prepare('INSERT INTO content_libraries VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at').run(id,revision,payload,new Date().toISOString());
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; } finally { db.close(); }
  const reloaded = readSharedContent(file).libraries[id];
  if(hash(JSON.stringify(reloaded)) !== revision) throw new Error('Shared SQLite reload mismatch');
  return {file,id,revision,reloaded};
}
export function sharedContentResponse(method: string, url: URL, ifNoneMatch?: string): { status: number; gzip?: Buffer; etag?: string; body?: { error: string } } {
  if(method !== 'GET') return {status:405,body:{error:'공용 콘텐츠는 호스트 등록 절차에서 수정합니다.'}};
  const requested = url.searchParams.get('scope');
  const scope: SharedContentScope = requested === 'defaults' || requested === 'rest' ? requested : 'all';
  try {
    const { revision, gzip } = encodedSharedContentWithRevision(scope);
    const etag = sharedContentEtag(scope, revision);
    // 판본이 같으면 본문 없이 304 — 부팅마다 73MB(gzip) 를 다시 받던 것을 없앤다(2026-09-27 실측).
    if (ifNoneMatch && ifNoneMatch.split(',').some(tag => tag.trim() === etag)) return { status: 304, etag };
    return {status:200,gzip,etag};
  }
  catch {return {status:500,body:{error:'공용 SQLite 자료를 읽지 못했습니다.'}};}
}
/** 범위마다 본문이 다르므로 ETag 에 범위를 넣는다. 판본은 전체 카탈로그 기준(모든 범위 공통)이다. */
export function sharedContentEtag(scope: SharedContentScope, revision: string): string {
  return `"${scope}-${revision}"`;
}
/**
 * 부팅 응답은 매번 같다 — 카탈로그 판본이 같으면 압축본을 재사용한다.
 * 실측(2026-09-26): defaults 104.7MB → gzip(1) 46MB, 압축 1.6s. 캐시가 없으면 부팅마다 SQLite 읽기·파싱(약 1.4s)과
 * 압축을 다시 한다. 판본 확인은 payload 없는 SELECT 라 1ms 대다. 압축본만 들고 있어 상주 메모리를 줄인다.
 */
const encodedCache = new Map<string, { revision: string; gzip: Buffer }>();
export function encodedSharedContent(scope: SharedContentScope, file = sharedContentFile()): Buffer {
  return encodedSharedContentWithRevision(scope, file).gzip;
}
export function encodedSharedContentWithRevision(scope: SharedContentScope, file = sharedContentFile()): { revision: string; gzip: Buffer } {
  const db = open(file);
  let revision: string;
  try { revision = snapshotRevision(db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all() as { id: string; revision: string }[]); }
  finally { db.close(); }
  const key = file + '\n' + scope, cached = encodedCache.get(key);
  if (cached?.revision === revision) return cached;
  const snapshot = readSharedContentForEditor(scope, file);
  const entry = { revision: snapshot.revision, gzip: gzipSync(JSON.stringify(snapshot), { level: 1 }) };
  encodedCache.set(key, entry);
  return entry;
}
export function sharedContentPreviewResponse(method: string, url: URL): { status: number; mime?: string; bytes?: Buffer } {
  if (method !== 'GET') return { status: 405 };
  try {
    const found = readSharedContentPreview(url.searchParams.get('library') ?? '', url.searchParams.get('kind') ?? '', url.searchParams.get('id') ?? '');
    return found ? { status: 200, ...found } : { status: 404 };
  } catch { return { status: 500 }; }
}
/** 미리보기 주소에는 라이브러리 판본(v)이 들어 있어 판본이 바뀌면 주소도 바뀐다 — 길게 캐시해도 된다.
 * 참고 이미지 주소는 내용 다이제스트라 같은 주소는 같은 바이트다. */
export const SHARED_CONTENT_PREVIEW_CACHE = 'private, max-age=31536000, immutable';
export function sharedReferenceImageResponse(method: string, url: URL): { status: number; mime?: string; bytes?: Buffer } {
  if (method !== 'GET') return { status: 405 };
  try {
    const found = readSharedReferenceImage(url.pathname);
    return found ? { status: 200, ...found } : { status: 404 };
  } catch { return { status: 500 }; }
}
export function sharedContentMiddleware(req: IncomingMessage,res: ServerResponse,next:()=>void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith(SHARED_REFERENCE_IMAGE_PREFIX)) {
    const result = sharedReferenceImageResponse(req.method ?? 'GET', url);
    if (!result.bytes) { res.writeHead(result.status).end(); return; }
    res.writeHead(200, { 'content-type': result.mime!, 'content-length': result.bytes.length, 'cache-control': SHARED_CONTENT_PREVIEW_CACHE }).end(result.bytes);
    return;
  }
  if (url.pathname === SHARED_CONTENT_PREVIEW_ENDPOINT) {
    const result = sharedContentPreviewResponse(req.method ?? 'GET', url);
    if (!result.bytes) { res.writeHead(result.status).end(); return; }
    res.writeHead(200, { 'content-type': result.mime!, 'content-length': result.bytes.length, 'cache-control': SHARED_CONTENT_PREVIEW_CACHE }).end(result.bytes);
    return;
  }
  if(url.pathname!==SHARED_CONTENT_ENDPOINT) return next();
  const result=sharedContentResponse(req.method??'GET', url, typeof req.headers['if-none-match'] === 'string' ? req.headers['if-none-match'] : undefined);
  // 브라우저 HTTP 캐시는 이 크기의 본문을 저장하지 않는다 — 클라이언트가 IndexedDB 에 판본별로 들고 If-None-Match 를 보낸다.
  const cacheHeaders = { 'cache-control': 'no-store', ...(result.etag ? { etag: result.etag } : {}) };
  if (result.status === 304) { res.writeHead(304, { ...cacheHeaders, vary: 'accept-encoding' }).end(); return; }
  if (!result.gzip) { res.writeHead(result.status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}).end(JSON.stringify(result.body)); return; }
  const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  const bytes = gzip ? result.gzip : gunzipSync(result.gzip);
  res.writeHead(200,{'content-type':'application/json; charset=utf-8',...cacheHeaders,'content-length':bytes.length,vary:'accept-encoding',...(gzip?{'content-encoding':'gzip'}:{})}).end(bytes);
}
