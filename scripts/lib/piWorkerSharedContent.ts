// One catalog installation per revision, shared by team members in this worker.
// Reading and parsing the entire SQLite catalog for every child agent blocks the
// Bun event loop long enough to suppress its heartbeat and trip the client.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { readSharedContent, sharedContentFile } from './sharedContentSqlite';
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
