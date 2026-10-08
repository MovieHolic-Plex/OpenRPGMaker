// One catalog installation per revision, shared by team members in this worker.
// Reading and parsing the entire SQLite catalog for every child agent blocks the
// Bun event loop long enough to suppress its heartbeat and trip the client.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { readSharedContent, readSharedReferenceImage, sharedContentFile } from './sharedContentSqlite';
import { setSharedReferenceImageReader } from '../../src/project/bundledReferenceImages';
import { readSharedTileReferences } from './sharedTileReferencesSqlite';
import { installSharedContent } from '../../src/project/sharedContent';
import { installSharedSpatialReferences } from '../../src/project/sharedSpatialReferences';

let installedKey: string | undefined;
let installing: Promise<void> | undefined;

function catalogKey(file: string): string {
  if (!existsSync(file)) return file + ':missing';
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return JSON.stringify([file, db.prepare('SELECT id, revision FROM content_libraries ORDER BY id').all()]);
  } finally { db.close(); }
}

export async function preparePiWorkerSharedContent(): Promise<void> {
  if (installing) await installing;
  const file = sharedContentFile();
  // 공용 참고 이미지는 워커가 SQLite 에서 직접 읽는다 — 상대 주소 fetch 는 Bun 에서 실패한다.
  setSharedReferenceImageReader(src => readSharedReferenceImage(src, file));
  const key = catalogKey(file);
  if (key === installedKey) return;
  const work = (async () => {
    installSharedSpatialReferences(readSharedTileReferences(file).spatial);
    await installSharedContent(readSharedContent(file));
    // Remember only successful installation. A failed read remains retryable.
    installedKey = key;
  })();
  installing = work;
  try { await work; } finally { if (installing === work) installing = undefined; }
}
