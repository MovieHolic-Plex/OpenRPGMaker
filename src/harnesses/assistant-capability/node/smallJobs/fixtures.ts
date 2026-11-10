// 작은 일 묶음의 시작 상태 셋. 일마다 새로 만든다(서로 독립).
//   blank   — createBlankProject 그대로(빈 맵 한 장).
//   starter — 거의 빈 프로젝트: 풀밭 마을 한 장에 주민 셋(미루·마사·경비) + 이어지지 않은 빈 들판 한 장.
//   built   — 조수 v2 가 실제로 만든 작은 게임 《얼음 아래의 노래》(맵 6장·이벤트 38개·청사진·할 일 장부 포함)를 얼린 것.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createBlankProject } from '../../../../project/defaults';
import type { Project } from '../../../../project/types';
import { CAPABILITY_MAP_ID, createCapabilityFixtureProject } from '../capabilityFixture';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const BUILT_FIXTURE_FILE = resolve(REPO_ROOT, 'harness-data/assistant-capability/small-jobs/built-game.json.gz');

export const FIXTURE_IDS = ['blank', 'starter', 'built'] as const;
export type FixtureId = typeof FIXTURE_IDS[number];

export const STARTER_MAP_ID = CAPABILITY_MAP_ID;
export const STARTER_FIELD_MAP_ID = 'map_blank_start';

function starter(): Project {
  const project = createCapabilityFixtureProject() as any;
  project.meta.title = '잿불 마을 이야기';
  if (project.system.titleScreen) project.system.titleScreen.title = project.meta.title;
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

export function buildFixture(id: FixtureId): Project {
  if (id === 'blank') return createBlankProject();
  if (id === 'starter') return starter();
  if (id === 'built') return built();
  throw Error(`없는 픽스처: ${String(id)}`);
}
