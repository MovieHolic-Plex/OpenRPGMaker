// editor/content/beodeulStarterMap.ts
// 「예제로 시작」·첫 실행 안내 「작은 마을 추가하기」의 시작 마을 — 버들항(beodeul_city) 블록 조립 마을.
//
// 왜 있나(2026-10-01): EasyRPG 계열 칩셋 폐기(2026-09-29) 뒤에도 두 경로는 합본 마을 칸 번호로 꾸민
// createStarterMap(defaultMaps.ts)을 썼다. 새 프로젝트 기본이 버들항이 되면서(#1789) 첫 맵만 옛 칩셋으로 남았다.
// 조수와 같은 도구(author_beodeul_town)로 짓고, 첫 구간 뼈대(playableSegment)가 요구하는 모양을 맞춘다:
// 시작 칸과 같은 줄이 동쪽 끝까지 길로 이어져야 한다 — 뼈대가 (맵 가로-1, 시작 y) 에 다음 맵 문을 단다.

import { runTool } from "@/editor/tools/toolRunner";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";

const STARTER_WIDTH = 40;
const STARTER_HEIGHT = 30;
const STARTER_SEED = 7;
const PAVING = "버들항 길 포석";
const PLAIN_GRASS = 737;

export interface BeodeulStarter {
  readonly map: GameMap;
  readonly startPos: { readonly x: number; readonly y: number };
}

function run(ctx: { project: Project }, name: string, args: Record<string, unknown>): Record<string, unknown> {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`시작 마을 ${name} 실패: ${result.summary}`);
  return (result.data ?? {}) as Record<string, unknown>;
}

/** 버들항 시작 마을 한 장. project 는 읽기만 한다(복제본에서 짓는다). 버들항 타일셋이 없으면 undefined. */
export function createBeodeulStarterMap(project: Project, name = "버들 마을"): BeodeulStarter | undefined {
  if (!project.tilesets[DEFAULT_TILESET_ID]) return undefined;
  const ctx = { project: { ...structuredClone({ ...project, maps: {} }), maps: {} } as Project };
  const created = run(ctx, "create_map", { name, width: STARTER_WIDTH, height: STARTER_HEIGHT, tilesetId: DEFAULT_TILESET_ID });
  const mapId = String(created.mapId ?? Object.keys(ctx.project.maps)[0]);
  const town = run(ctx, "author_beodeul_town", { mapId, seed: STARTER_SEED });
  const map = ctx.project.maps[mapId]!;
  const columns = town.columns as { x: number; w: number }[];
  const bands = town.bands as { y: number; h: number }[];
  const planW = Math.max(...columns.map((column) => column.x + column.w));
  // 첫 띠 아래 길(2줄)이 시작 줄이다.
  const roadY = bands[0]!.y + bands[0]!.h;

  // 오른쪽 남는 띠(블록 격자 밖)는 나무를 심어 두었다 — 비우고 시작 줄 길을 동쪽 끝까지 잇는다.
  for (let y = 0; y < map.height; y++) {
    for (let x = planW; x < map.width; x++) {
      map.lowerTiles[y * map.width + x] = PLAIN_GRASS;
      map.upperTiles[y * map.width + x] = -1;
    }
  }
  if (planW < map.width) run(ctx, "fill_region", { mapId, rect: { x: planW, y: roadY, w: map.width - planW, h: 2 }, material: PAVING });
  return { map: ctx.project.maps[mapId]!, startPos: { x: 3, y: roadY } };
}
