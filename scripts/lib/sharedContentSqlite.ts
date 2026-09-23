import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SHARED_CONTENT_ENDPOINT, type SharedContentLibrary, type SharedContentSnapshot } from '../../src/project/sharedContentSchema';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
export const sharedContentFile = () => process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function open(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS content_libraries (id TEXT PRIMARY KEY, revision TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS content_history (id TEXT NOT NULL, revision TEXT NOT NULL, payload TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY(id, revision));');
  return db;
}
export function readSharedContent(file = sharedContentFile()): SharedContentSnapshot {
  const db = open(file);
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as { id: string; revision: string; payload: string }[];
    return { revision: hash(rows.map(r => r.id + ':' + r.revision).join('\n')), libraries: Object.fromEntries(rows.map(r => [r.id, JSON.parse(r.payload)])) };
  } finally { db.close(); }
}
/** Local publishing API only. Compare-and-swap is scoped to a library, not unrelated catalogs. */
export function publishSharedContent(id: string, value: SharedContentLibrary, expectedRevision: string | null, file = sharedContentFile()) {
  if (!/^[\w.-]{1,100}$/.test(id) || value.version !== 1) throw new Error('Invalid shared library');
  for (const t of Object.values(value.tilesets)) {
    if(t.referenceDocuments) validateTilesetReferences(t.referenceDocuments);
    if(t.referenceSourceTilesetId && !value.tilesets[t.referenceSourceTilesetId]) throw new Error('Missing reference owner');
  }
  for(const root of value.roots) if(!value.places[root]) throw new Error('Missing place root');
  for(const place of Object.values(value.places)) if(place.exterior && !value.tilesets[place.exterior.tilesetId]?.structureKits?.some(k=>k.id===place.exterior!.kitId)) throw new Error('Missing place raster');
  for (const [id, region] of Object.entries(value.regions ?? {})) {
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
export function sharedContentResponse(method: string) {
  if(method !== 'GET') return {status:405,body:{error:'공용 콘텐츠는 호스트 등록 절차에서 수정합니다.'}};
  try {return {status:200,body:readSharedContent()};}
  catch {return {status:500,body:{error:'공용 SQLite 자료를 읽지 못했습니다.'}};}
}
export function sharedContentMiddleware(req: IncomingMessage,res: ServerResponse,next:()=>void) {
  if((req.url??'').split('?')[0]!==SHARED_CONTENT_ENDPOINT) return next();
  const result=sharedContentResponse(req.method??'GET');
  res.writeHead(result.status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(result.body));
}
