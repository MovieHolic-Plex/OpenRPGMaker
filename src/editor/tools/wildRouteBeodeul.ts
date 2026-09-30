// editor/tools/wildRouteBeodeul.ts
// author_wild_route 의 버들항(beodeul_city) 시공 — 합본 마을 경로와 같은 길 계획(planRouteCorridor)을 버들항 재료로 칠한다.
//
// 왜 따로 있나(2026-10-01): 새 프로젝트 기본이 버들항이 되자(#1789) 몬스터 수집 첫 구간 뼈대가 이 도구에서 멈췄다
// (「숲마을·combined_town 계열에서만 시공」). 버들항 시트에는 키큰 풀 오토타일이 없어서,
// 풀숲은 시트의 짙은 잎 무늬 풀(통행 가능 한 칸 무늬)로 깐다. 제대로 된 키큰 풀은 시트에 손 도트로 더해야 한다.
// - 길: 버들항 길 포석(fill_region 재료, 줄 단위 사각형) — 포석 오토타일이 가장자리를 맞춘다.
// - 풀숲: 짙은 잎 풀 BEODEUL_THICKET_TILE.
// - 숲: 길·풀숲·출구 둘레를 비운 풀밭에 버들항 나무 키트(bd-tree-*)를 찍는다.

import type { GameMap, Project, TilesetDef } from "@/project/types";
import type { Rng } from "@/util/rng";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import type { ToolDefinition } from "./types";

const BEODEUL_TEXTURE = "tex_beodeul_city";
const BEODEUL_ID = "beodeul_city";
const PAVING = "버들항 길 포석";
/** 버들항 민무늬 풀(defaultMaps.ts plainGrassTileFor 와 같다). */
export const BEODEUL_PLAIN_GRASS = 737;
/** 짙은 잎 무늬 풀 — 통행 가능, 3×3 으로 이어 깔아도 이음새가 없다. 키큰 풀이 없는 시트의 풀숲 대용. */
export const BEODEUL_THICKET_TILE = 11628;

export function canPaintBeodeulWildRoute(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === BEODEUL_TEXTURE
    && !!tileset.structureKits?.some(kit => kit.id.startsWith("bd-tree-"));
}

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find(candidate => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

export interface BeodeulWildRouteInput {
  readonly project: Project;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly road: ReadonlySet<number>;
  readonly grass: ReadonlySet<number>;
  /** 나무를 심지 않을 칸(길·풀숲·출구·이벤트 둘레). */
  readonly reserved: ReadonlySet<number>;
  readonly rng: Rng;
}

export function paintBeodeulWildRoute(input: BeodeulWildRouteInput): { roadCells: number; treeCells: number } {
  const { project, map, tileset, road, grass, reserved, rng } = input;
  const fillRegion = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
  const stampObject = requireTool(SHARED_OBJECT_TOOLS, "stamp_object");
  const w = map.width;

  // 길: 행마다 이어진 칸을 사각형 하나로 칠한다(칸마다 부르면 오토타일 재합성이 칸 수만큼 돈다).
  const roadCells = [...road].filter(index => !grass.has(index)).sort((a, b) => a - b);
  for (let i = 0; i < roadCells.length;) {
    const start = roadCells[i]!, y = Math.floor(start / w);
    let end = start;
    while (i + 1 < roadCells.length && roadCells[i + 1] === end + 1 && Math.floor(roadCells[i + 1]! / w) === y) { i += 1; end = roadCells[i]!; }
    i += 1;
    fillRegion.run(project, { mapId: map.id, rect: { x: start % w, y, w: end - start + 1, h: 1 }, material: PAVING });
  }
  for (const index of grass) map.lowerTiles[index] = BEODEUL_THICKET_TILE;

  // 숲: 큰 나무부터 성긴 격자에 흔들어 찍는다. 발자국이 전부 빈 풀밭(민무늬 풀·상위 없음·예약 밖)일 때만.
  const trees = (tileset.structureKits ?? []).filter(kit => kit.id.startsWith("bd-tree-") && kit.width >= 2)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  const free = (x: number, y: number, kw: number, kh: number): boolean => {
    for (let dy = 0; dy < kh; dy++) for (let dx = 0; dx < kw; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= w || cy >= map.height) return false;
      const index = cy * w + cx;
      if (reserved.has(index) || map.lowerTiles[index] !== BEODEUL_PLAIN_GRASS || map.upperTiles[index]! >= 0) return false;
    }
    return true;
  };
  let treeCells = 0;
  for (let y = 0; y < map.height; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const kit = trees[Math.floor(rng() * trees.length)];
      if (!kit) break;
      const tx = x + Math.floor(rng() * 2), ty = y + Math.floor(rng() * 2);
      if (!free(tx, ty, kit.width, kit.height)) continue;
      try {
        stampObject.run(project, { objectId: `kit:${BEODEUL_ID}/${kit.id}`, mapId: map.id, x: tx, y: ty });
        treeCells += kit.width * kit.height;
      } catch {
        // 찍을 수 없는 자리(보호 칸 등)는 건너뛴다.
      }
    }
  }
  return { roadCells: roadCells.length, treeCells };
}
