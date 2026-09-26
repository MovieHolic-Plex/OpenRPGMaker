import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SHARED_CONTENT_ENDPOINT, SHARED_CONTENT_PREVIEW_ENDPOINT, type SharedContentLibrary, type SharedContentScope, type SharedContentSnapshot } from '../../src/project/sharedContentSchema';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
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
      : db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all()) as { id: string; revision: string; payload: string }[];
    return { revision: snapshotRevision(all), libraries: Object.fromEntries(rows.map(r => [r.id, linkPreviews(r.id, r.revision, JSON.parse(r.payload) as SharedContentLibrary)])) };
  } finally { db.close(); }
}
function previewUrl(library: string, revision: string, kind: 'place' | 'region', id: string): string {
  return `${SHARED_CONTENT_PREVIEW_ENDPOINT}?${new URLSearchParams({ library, kind, id, v: revision.slice(0, 16) })}`;
}
function linkPreviews(libraryId: string, revision: string, library: SharedContentLibrary): SharedContentLibrary {
  for (const [id, value] of Object.entries(library.previews ?? {})) {
    if (value.startsWith('data:')) library.previews[id] = previewUrl(libraryId, revision, 'place', id);
  }
  for (const [id, region] of Object.entries(library.regions ?? {})) {
    if (region.preview.startsWith('data:')) region.preview = previewUrl(libraryId, revision, 'region', id);
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
export function sharedContentResponse(method: string, url: URL) {
  if(method !== 'GET') return {status:405,body:{error:'공용 콘텐츠는 호스트 등록 절차에서 수정합니다.'}};
  const scope: SharedContentScope = url.searchParams.get('scope') === 'defaults' ? 'defaults' : 'all';
  try {return {status:200,body:readSharedContentForEditor(scope)};}
  catch {return {status:500,body:{error:'공용 SQLite 자료를 읽지 못했습니다.'}};}
}
export function sharedContentPreviewResponse(method: string, url: URL): { status: number; mime?: string; bytes?: Buffer } {
  if (method !== 'GET') return { status: 405 };
  try {
    const found = readSharedContentPreview(url.searchParams.get('library') ?? '', url.searchParams.get('kind') ?? '', url.searchParams.get('id') ?? '');
    return found ? { status: 200, ...found } : { status: 404 };
  } catch { return { status: 500 }; }
}
/** 미리보기 주소에는 라이브러리 판본(v)이 들어 있어 판본이 바뀌면 주소도 바뀐다 — 길게 캐시해도 된다. */
export const SHARED_CONTENT_PREVIEW_CACHE = 'private, max-age=31536000, immutable';
export function sharedContentMiddleware(req: IncomingMessage,res: ServerResponse,next:()=>void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === SHARED_CONTENT_PREVIEW_ENDPOINT) {
    const result = sharedContentPreviewResponse(req.method ?? 'GET', url);
    if (!result.bytes) { res.writeHead(result.status).end(); return; }
    res.writeHead(200, { 'content-type': result.mime!, 'content-length': result.bytes.length, 'cache-control': SHARED_CONTENT_PREVIEW_CACHE }).end(result.bytes);
    return;
  }
  if(url.pathname!==SHARED_CONTENT_ENDPOINT) return next();
  const result=sharedContentResponse(req.method??'GET', url);
  res.writeHead(result.status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(result.body));
}
