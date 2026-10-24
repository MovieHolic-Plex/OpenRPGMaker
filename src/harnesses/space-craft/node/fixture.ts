import { existsSync, linkSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { createBlankProject } from '../../../project/defaults';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { execFileSync } from 'node:child_process';

export interface SpaceCase {
  readonly id: string;
  readonly category: string;
  readonly mode: string;
  readonly startTileset: string;
  readonly prompt: string;
  /** 시작 상태를 결정론 도구로 미리 짓는다(편집·NPC·컷신 과제처럼 「이미 있는 맵」에서 시작하는 요청). 실제 도구 레지스트리로 돈다. */
  readonly startBuild?: readonly { readonly tool: string; readonly args: Record<string, unknown> }[];
  /** 시작 프로젝트의 확정 기획(gameDesignBrief) — 새 게임 인터뷰를 마친 상태. 맞는 제작 하네스가 있으면 그 씨앗(연애 첫 만남 계약·임시 초안)까지 심는다. */
  readonly startBrief?: Record<string, unknown>;
}
export interface SpaceSeed {
  readonly timeoutMs: number;
  readonly repeat: number;
  readonly categories: Record<string, { readonly label: string; readonly families: readonly string[]; readonly note?: string }>;
  readonly forbiddenFamilies: readonly string[];
  readonly cases: readonly SpaceCase[];
  readonly gates: { readonly reachableRatioMin: number; readonly emptyPctMax: number; readonly emptySquareMax: number; readonly mirrorMax: number };
}

export const SEED_FILE = resolve('harness-data/space-craft/seed.json');
export const loadSeed = (): SpaceSeed => JSON.parse(readFileSync(SEED_FILE, 'utf8'));

/** 과제 × 반복 폴더 이름. 반복은 r1..rN — 첫 시도를 덮어쓰지 않는다. */
export function attemptIds(seed: SpaceSeed, selected?: string, repeat = seed.repeat): { caseId: string; attempt: string }[] {
  const ids = selected?.split(',');
  const cases = seed.cases.filter(entry => !ids || ids.includes(entry.id));
  if (!cases.length) throw Error(`모르는 과제: ${selected}`);
  return cases.flatMap(entry => Array.from({ length: repeat }, (_, i) => ({ caseId: entry.id, attempt: `${entry.id}-r${i + 1}` })));
}

/**
 * 새 프로젝트(createBlankProject) 그대로에서 시작한다 — 사용자가 처음 여는 상태가 실제 출발점이다.
 * 현대 과제만 시작 맵 칩셋을 jp_city 로 바꾼다(현대 거리를 보다가 가게 안을 만들어 달라는 상황).
 */
export async function prepare(root: string, selected?: string, repeat?: number, sharedFrom?: string): Promise<void> {
  const seed = loadSeed();
  mkdirSync(root, { recursive: true });
  const pinned = resolve(root, 'shared-content.sqlite');
  if (!existsSync(pinned)) {
    if (sharedFrom) linkSync(resolve(sharedFrom), pinned);
    else if (existsSync(sharedContentFile())) {
      const source = new DatabaseSync(sharedContentFile(), { readOnly: true });
      try { await backup(source, pinned); } finally { source.close(); }
    }
  }
  for (const { caseId, attempt } of attemptIds(seed, selected, repeat)) {
    const entry = seed.cases.find(value => value.id === caseId)!;
    const dir = resolve(root, attempt), projectDir = resolve(dir, 'project');
    if (existsSync(resolve(projectDir, 'project.sqlite'))) throw Error(`기존 실행 덮어쓰기 거부: ${dir}`);
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    if (!project.tilesets[entry.startTileset]) throw Error(`시작 칩셋 없음: ${entry.startTileset}`);
    start.tilesetId = entry.startTileset;
    project.meta.title = `공간 제작 시험 · ${attempt}`;
    if (project.system.opening) project.system.opening.enabled = false;
    mkdirSync(dir, { recursive: true });
    // 시작 짓기는 Bun 으로 실제 도구 레지스트리를 돌린다(vite-node 는 레지스트리 전체를 끌어오다 의존성 재최적화로 서버를 재시작한다).
    if (entry.startBuild?.length || entry.startBrief) {
      const io = resolve(dir, 'start-build.json');
      writeFileSync(io, JSON.stringify({ project, steps: entry.startBuild ?? [], ...(entry.startBrief ? { brief: entry.startBrief } : {}) }));
      execFileSync('bun', [resolve('src/harnesses/space-craft/node/startBuild.mts'), io], { stdio: 'inherit' });
      Object.assign(project, JSON.parse(readFileSync(io, 'utf8')).project);
    }
    if (existsSync(pinned)) linkSync(pinned, resolve(dir, 'shared-content.sqlite'));
    const store = await initLocalProjectStore({ projectDir });
    try {
      await store.saveProject(project);
      const snapshot = store.loadSnapshot()!;
      writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ schemaVersion: 1, caseId, attempt, category: entry.category,
        projectId: store.projectId, projectDir, revision: snapshot.revision, sha256: snapshot.sha256,
        startMapId: project.startMapId, startTileset: entry.startTileset, task: entry.prompt }, null, 2));
    } finally { store.close(); }
    console.log(`prepared ${attempt}`);
  }
}
