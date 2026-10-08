import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { createBlankProject } from '@/project/defaults';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';

const root = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw Error('genrePrepare requires experiment root');
const manifest = JSON.parse(readFileSync(resolve(root, 'experiment.json'), 'utf8'));
const pinned = resolve(root, 'shared-content-baseline.sqlite');
if (!existsSync(pinned)) {
  const source = new DatabaseSync(sharedContentFile(), { readOnly: true });
  try { await backup(source, pinned); } finally { source.close(); }
}
for (const entry of manifest.cases) {
  const dir = resolve(root, entry.id), projectDir = resolve(dir, 'project');
  if (existsSync(resolve(projectDir, 'project.sqlite'))) throw Error(`Existing canonical case refused: ${entry.id}`);
  mkdirSync(dir, { recursive: true });
  copyFileSync(pinned, resolve(dir, 'shared-content.sqlite'));
  const project = createBlankProject();
  project.meta.title = `조수 장르 제작 실측 · ${entry.label}`;
  const store = await initLocalProjectStore({ projectDir });
  try {
    await store.saveProject(project);
    const snapshot = store.loadSnapshot()!;
    writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ caseId: entry.id, projectDir,
      projectId: store.projectId, revision: snapshot.revision, sha256: snapshot.sha256,
      port: entry.port, source: 'createBlankProject', seededGameplay: false }, null, 2));
  } finally { store.close(); }
  console.log(`Prepared separate canonical project: ${entry.id}, port ${entry.port}`);
}
