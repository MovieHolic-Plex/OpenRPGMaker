/**
 * store.update COW(cloneProjectForUpdate) 와 예전 경로(cloneProjectForMutation)의 동등성 검사(헤드리스, vitest 아님).
 * 같은 변경기를 두 경로에 돌려 (1) 직렬화 바이트(키 순서 포함) 동일 (2) 원본 불변 (3) 안 건드린 맵·DB·타일셋은 참조 동일 (4) 옛 스프라이트 정리 결과 동일을 본다.
 * 사용: LAG_PROJECT_DIR=/tmp/lag-proj-b npx tsx scripts/bench/cow-equivalence.mts
 */
import { loadLagProject } from './lib/lagLoad.mts';
import { cloneProjectForMutation, finishProjectMutation, cloneProjectForUpdate, finishProjectUpdate, applyCleanedProjection } from '../../src/project/projectClone';
import { removeLegacySpriteReferences } from '../../src/project/defaults/defaultAssets';
import type { Project } from '../../src/project/types';

const { project } = await loadLagProject(process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b');
const legacy = ['npc', 'villager'].join('_');
const mapIds = Object.keys(project.maps);
const sizeOf = (id: string) => JSON.stringify(project.maps[id]).length;
const biggest = mapIds.reduce((a, b) => (sizeOf(a) >= sizeOf(b) ? a : b));
const other = mapIds.find((id) => id !== biggest);
const dbKey = (Object.keys(project.database) as (keyof Project['database'])[]).find((k) => Array.isArray(project.database[k]) && (project.database[k] as unknown[]).length > 0)!;
const tsId = Object.keys(project.tilesets)[0]!;
const w = (project.maps[biggest] as any).width as number;

/** 큰 뿌리를 뺀 나머지 + 맵·DB 는 직렬화. 타일셋은 id→참조 로 따로 본다(279MB 를 글로 만들지 않는다). */
const bytes = (p: Project): string => {
  const r = p as unknown as Record<string, unknown>;
  const shell: Record<string, unknown> = {};
  for (const k of Object.keys(r)) shell[k] = k === 'tilesets' ? Object.keys(r[k] as object) : r[k];
  return JSON.stringify(shell);
};

const cases: [string, (d: Project) => void][] = [
  ['아무것도 안 함', () => {}],
  ['1셀 칠하기', (d) => { (d.maps[biggest] as any).lowerTiles[3 * w + 1] = 7; }],
  ['맵 이름 변경', (d) => { (d.maps[biggest] as any).name = 'renamed'; }],
  ['DB 필드', (d) => { (d.database as any)[dbKey][0].name = 'edited'; }],
  ['옛 스프라이트 문자열(맵 이름)', (d) => { (d.maps[biggest] as any).name = legacy; }],
  ['옛 스프라이트 문자열(DB)', (d) => { (d.database as any)[dbKey][0].name = legacy; }],
  ['맵 추가', (d) => { (d.maps as any).zz_new = { ...JSON.parse(JSON.stringify(project.maps[biggest])), id: 'zz_new' }; }],
  ['맵 삭제', (d) => { if (other) delete (d.maps as any)[other]; }],
  ['maps 통째 교체', (d) => { d.maps = { ...d.maps } as any; (d.maps[biggest] as any).name = 'w'; }],
  ['타일셋 필드', (d) => { (d.tilesets[tsId] as any).name = 'ts-edited'; }],
  ['루트 필드', (d) => { (d as any).title = 'new-title'; }],
  ['읽기만', (d) => { void JSON.stringify((d.maps[biggest] as any).name); void d.database; }],
];

let failed = 0;
const beforeBytes = bytes(project);
for (const [label, mut] of cases) {
  const oldDraft = cloneProjectForMutation(project);
  try { mut(oldDraft); } finally { finishProjectMutation(oldDraft); }
  removeLegacySpriteReferences(oldDraft);

  const newDraft = cloneProjectForUpdate(project);
  let summary!: ReturnType<typeof finishProjectUpdate>;
  try { mut(newDraft); } finally { summary = finishProjectUpdate(newDraft); }
  removeLegacySpriteReferences(summary.cleanupTarget);
  applyCleanedProjection(newDraft, summary.cleanupTarget);

  const problems: string[] = [];
  if (bytes(oldDraft) !== bytes(newDraft)) problems.push('직렬화 다름');
  if (bytes(project) !== beforeBytes) problems.push('원본이 바뀜');
  for (const id of Object.keys(project.tilesets)) {
    const o = oldDraft.tilesets[id]; const n = newDraft.tilesets[id];
    if (JSON.stringify(Object.keys(o ?? {})) !== JSON.stringify(Object.keys(n ?? {}))) { problems.push(`타일셋 ${id} 키 다름`); break; }
    if (id !== tsId && n !== project.tilesets[id]) { problems.push(`타일셋 ${id} 참조 끊김`); break; }
  }
  if (label === '타일셋 필드' && JSON.stringify((newDraft.tilesets[tsId] as any).name) !== JSON.stringify((oldDraft.tilesets[tsId] as any).name)) problems.push('타일셋 필드 값 다름');
  const touchedMaps = new Set(['1셀 칠하기', '맵 이름 변경', '옛 스프라이트 문자열(맵 이름)']);
  if (touchedMaps.has(label)) {
    for (const id of mapIds) if (id !== biggest && newDraft.maps[id] !== project.maps[id]) { problems.push(`안 건드린 맵 ${id} 참조 끊김`); break; }
  }
  if (label === '아무것도 안 함' || label === '읽기만') {
    if (newDraft.maps !== project.maps) problems.push('읽지 않은 maps 참조 끊김');
    if (newDraft.database !== project.database) problems.push('읽지 않은 database 참조 끊김');
  }
  if (label === 'DB 필드' && newDraft.maps !== project.maps) problems.push('DB 편집인데 maps 참조 끊김');
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label}${problems.length ? '  ← ' + problems.join(', ') : ''}`);
  if (problems.length) failed += 1;
}
console.log(failed ? `실패 ${failed}건` : '전부 동등');
process.exit(failed ? 1 : 0);
