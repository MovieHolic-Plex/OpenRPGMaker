// 작은 일 묶음의 시작 상태 셋. 일마다 새로 만든다(서로 독립).
//   blank   — createBlankProject 그대로(빈 맵 한 장).
//   starter — 거의 빈 프로젝트: 풀밭 마을 한 장에 주민 셋(미루·마사·경비) + 이어지지 않은 빈 들판 한 장.
//   built   — 조수 v2 가 실제로 만든 작은 게임 《얼음 아래의 노래》(맵 6장·이벤트 38개·청사진·할 일 장부 포함)를 얼린 것.
//   dbsmall — 빈 프로젝트의 자료집을 줄인 것(넷째 묶음 «자료집 고치기» — 기본 자료집 약 2,700건은 «전부 다시 써 줘» 한 턴에 들지 않는다).
//             배우 12 · 직업 12 · 스킬 약 130(안 쓰는 것 8) · 아이템 7(안 쓰는 것 6) · 장비 11 · 적 6 · 적 그룹 7 · 상태 약 12. 남긴 레코드가 가리키는 것은 모두 남긴다(끊긴 참조 0).
//             실제 편집기는 열 때 고전 명단(ensureRetroRosterRecords — 배우·직업·스킬·상태)을 다시 채운다 — 실행 판에서는 아이템·장비·적·적 그룹만 작게 남는다.
//             판정은 모두 «편집기가 연 문서»(before)와 견주므로 그대로 맞다(안 쓰는 스킬 수는 그 문서에서 센다).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createBlankProject } from '../../../../project/defaults';
import type { Project } from '../../../../project/types';
import { CAPABILITY_MAP_ID, createCapabilityFixtureProject } from '../capabilityFixture';
import { unusedRecords } from '../../../../editor/tools/dbRecordDelete';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const BUILT_FIXTURE_FILE = resolve(REPO_ROOT, 'harness-data/assistant-capability/small-jobs/built-game.json.gz');

export const FIXTURE_IDS = ['blank', 'starter', 'built', 'dbsmall'] as const;
export type FixtureId = typeof FIXTURE_IDS[number];

export const STARTER_MAP_ID = CAPABILITY_MAP_ID;
export const STARTER_FIELD_MAP_ID = 'map_blank_start';

function starter(): Project {
  const project = createCapabilityFixtureProject() as any;
  project.meta.title = '잿불 마을 이야기';
  if (project.system.titleScreen) project.system.titleScreen.title = project.meta.title;
  // 새 프로젝트는 2026-11-24 부터 타이틀 곡을 갖고 태어난다. «타이틀 화면에 음악이 나오게 해 줘»(title-bgm-starter)가
  // 아무것도 안 하고 통과하지 않도록 이 픽스처는 예전처럼 타이틀 곡을 비운다.
  if (project.system.titleScreen) delete project.system.titleScreen.musicResourceId;
  const map = project.maps[STARTER_MAP_ID];
  // 경비는 원래 30칸 맵의 (28,11)에 서 있었다 — 24×18 맵 안으로 들인다.
  const guard = map.events.find((event: any) => event.id === 'ev_ember_guard');
  guard.x = 20; guard.y = 9;
  // 이벤트 이름을 첫 페이지 이름으로 채운다(사용자가 목록에서 보는 이름).
  for (const event of map.events) event.name ??= event.pages?.[0]?.name;
  project.startPos = { x: 12, y: 15 };
  project.maps[STARTER_FIELD_MAP_ID].name = '동쪽 들판';
  if (project.system.opening) project.system.opening.enabled = false;
  return project;
}

let builtOverlay: Record<string, unknown> | null = null;
function built(): Project {
  builtOverlay ??= JSON.parse(gunzipSync(readFileSync(BUILT_FIXTURE_FILE)).toString('utf8')).overlay as Record<string, unknown>;
  return Object.assign(createBlankProject() as any, structuredClone(builtOverlay)) as Project;
}

/** 줄일 자료집 표. 다른 표(몬스터 종족·작물·설정…)는 그대로 두고, 그 표들과 프로젝트가 가리키는 id 를 씨앗으로 남긴다. */
const TRIMMED = ['actors', 'classes', 'skills', 'items', 'equipment', 'enemies', 'troops', 'states'] as const;
function dbsmall(): Project {
  const project = createBlankProject() as any;
  const db = project.database;
  const keep: Record<string, Set<string>> = Object.fromEntries(TRIMMED.map(table => [table, new Set<string>()]));
  const tableOf = new Map<string, string>();
  for (const table of TRIMMED) for (const row of db[table]) tableOf.set(row.id, table);
  const seed = (value: unknown): void => {
    if (typeof value === 'string') { const table = tableOf.get(value); if (table) keep[table]!.add(value); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { const table = tableOf.get(key); if (table) keep[table]!.add(key); seed(child); }
  };
  const { tilesets: _t, assets: _a, database: _d, ...rest } = project;
  seed(rest);
  seed(Object.fromEntries(Object.entries(db).filter(([table]) => !(TRIMMED as readonly string[]).includes(table))));
  for (const actor of db.actors.slice(0, 3)) keep.actors!.add(actor.id);
  for (const troop of db.troops) keep.troops!.add(troop.id);
  for (const row of db.items.slice(0, 6)) keep.items!.add(row.id);
  for (const row of db.equipment.slice(0, 6)) keep.equipment!.add(row.id);
  // 아무도 안 쓰는 스킬 여덟(«안 쓰는 것 지워 줘» 의 대상) — 기본 자료집에서 자기 자리 밖 참조가 0 인 것.
  for (const row of unusedRecords(project, ['skills']).get('skills')!.slice(0, 8)) keep.skills!.add(row.id);
  const size = () => TRIMMED.reduce((sum, table) => sum + keep[table]!.size, 0);
  for (let before = -1; before !== size();) {
    before = size();
    for (const table of TRIMMED) for (const row of db[table]) if (keep[table]!.has(row.id)) seed(row);
  }
  for (const table of TRIMMED) db[table] = db[table].filter((row: any) => keep[table]!.has(row.id));
  project.meta.title = '작은 자료집';
  return project as Project;
}

export function buildFixture(id: FixtureId): Project {
  if (id === 'blank') return createBlankProject();
  if (id === 'starter') return starter();
  if (id === 'built') return built();
  if (id === 'dbsmall') return dbsmall();
  throw Error(`없는 픽스처: ${String(id)}`);
}
