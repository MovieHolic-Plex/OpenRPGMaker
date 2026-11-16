// Prepare one blank canonical SQLite project for a whole-game session (bun).
//   bun src/harnesses/assistant-capability/node/wholeGamePrepare.ts <game dir> <title> [--project-id <uuid>]
// Creates <game dir>/project (createBlankProject, no seeded gameplay) and pins a read-only
// backup of the shared content library to <game dir>/shared-content.sqlite.
// The store gets a NEW project id every run (the assistant's game key — village kind, house set, look, interior colours — comes
// from it, so runs differ like real users' games). --project-id <uuid> pins it, only to rebuild one game the same way (replay).
// 2026-11-16: the r2–r7 confirm builds pinned one id per request through a copy of this file (r*/vm/prepare-pinned.ts), so three
// rounds built the same village look — read as «the assistant always builds the same game».
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { createBlankProject } from '@/project/defaults';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';

const dir = resolve(process.argv[2] ?? '');
const title = process.argv[3] ?? 'Whole game';
const pinAt = process.argv.indexOf('--project-id');
const pin = pinAt >= 0 ? process.argv[pinAt + 1] ?? '' : '';
if (!process.argv[2]) throw Error('wholeGamePrepare <game dir> <title> [--project-id <uuid>]');
if (pinAt >= 0 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(pin)) throw Error(`--project-id wants a uuid, got «${pin}»`);
const projectDir = resolve(dir, 'project');
if (existsSync(resolve(projectDir, 'project.sqlite'))) throw Error(`Existing canonical project refused: ${projectDir}`);
mkdirSync(dir, { recursive: true });
const pinned = resolve(dir, 'shared-content.sqlite');
if (!existsSync(pinned)) {
  const source = new DatabaseSync(sharedContentFile(), { readOnly: true });
  try { await backup(source, pinned); } finally { source.close(); }
}
const project = createBlankProject();
project.meta.title = title;
const store = await initLocalProjectStore({ projectDir, ...(pin ? { projectId: pin } : {}) });
try {
  if (pin && store.projectId !== pin) throw Error(`--project-id ${pin}: the store kept ${store.projectId}`);
  await store.saveProject(project);
  const snapshot = store.loadSnapshot()!;
  writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ projectDir, projectId: store.projectId,
    revision: snapshot.revision, sha256: snapshot.sha256, source: 'createBlankProject', seededGameplay: false, pinnedProjectId: Boolean(pin) }, null, 2));
  console.log(`Prepared ${projectDir} (${store.projectId}${pin ? ' — pinned' : ' — new id'})`);
} finally { store.close(); }
