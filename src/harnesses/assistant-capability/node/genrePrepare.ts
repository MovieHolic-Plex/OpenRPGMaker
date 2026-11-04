import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { createBlankProject } from '@/project/defaults';
import { createProjectStartSeed } from '@/editor/projectStartSeed';
import { normalizeGameDesignBrief } from '@/project/gameDesignBrief';
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
  // startExample: 새 프로젝트 화면의 「예제로 시작」과 같은 길(작은 마을 한 장) — 맵이 있어야 하는 과제(오프닝 무대 등)용.
  const project = entry.startExample
    ? await createProjectStartSeed(entry.startExample, entry.label, 'example', 'wide')
    : entry.brief
    ? await createProjectStartSeed(entry.brief.presetId, entry.label, 'ai', 'wide')
    : createBlankProject();
  // 처음 만드는 게임 안내(firstRunGuide)는 조수 입력창을 덮는다 — 입력창 과제에서는 끈다(예제 마을은 그대로).
  if (entry.startExample) delete project.flags.firstRunGuide;
  if (entry.brief) project.gameDesignBrief = { ...normalizeGameDesignBrief(entry.brief), generationPending: true };
  project.meta.title = `조수 장르 제작 실측 · ${entry.label}`;
  const store = await initLocalProjectStore({ projectDir });
  try {
    await store.saveProject(project);
    const snapshot = store.loadSnapshot()!;
    writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ caseId: entry.id, projectDir,
      projectId: store.projectId, revision: snapshot.revision, sha256: snapshot.sha256,
      port: entry.port, source: entry.startExample ? `createProjectStartSeed example ${entry.startExample}` : entry.brief ? 'createProjectStartSeed + generationPending' : 'createBlankProject', seededGameplay: false }, null, 2));
  } finally { store.close(); }
  console.log(`Prepared separate canonical project: ${entry.id}, port ${entry.port}`);
}
