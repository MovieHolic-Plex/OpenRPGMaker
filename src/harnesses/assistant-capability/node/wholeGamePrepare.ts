// Prepare one blank canonical SQLite project for a whole-game session (bun).
//   bun src/harnesses/assistant-capability/node/wholeGamePrepare.ts <game dir> <title>
// Creates <game dir>/project (createBlankProject, no seeded gameplay) and pins a read-only
// backup of the shared content library to <game dir>/shared-content.sqlite.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { createBlankProject } from '@/project/defaults';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';

const dir = resolve(process.argv[2] ?? '');
const title = process.argv[3] ?? 'Whole game';
if (!process.argv[2]) throw Error('wholeGamePrepare <game dir> <title>');
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
const store = await initLocalProjectStore({ projectDir });
try {
  await store.saveProject(project);
  const snapshot = store.loadSnapshot()!;
  writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ projectDir, projectId: store.projectId,
    revision: snapshot.revision, sha256: snapshot.sha256, source: 'createBlankProject', seededGameplay: false }, null, 2));
  console.log(`Prepared ${projectDir} (${store.projectId})`);
} finally { store.close(); }
