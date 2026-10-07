// editor/tools/storyWalkBeodeul.ts
// 스토리(회상·관계) 첫 구간 뼈대의 길 맵을 버들항 재료로 깐다 — 출구에서 이어지는 포석 산책길과, 길 끝 만남 광장
// (산울타리를 등진 벤치·가로등·꽃밭), 둘레의 나무. 마무리 대상(ev_segment_end)이 광장 벤치 앞에 선다.
//
// 왜(2026-10-07 사용자 지적 「기억의 길은 진짜 허접하다」): story-cutscene 뼈대의 paveRoute 가 비어 있어 길 맵이 빈 풀밭(24×12)으로
// 시작했고, 첫 장소 단계가 쓸 수 있는 바깥 도구는 몬스터 도로용 author_wild_route 뿐이었다. 모델은 그걸로 「기억의 길」을 깔아
// 짙은 잎 풀숲과 나무 벽뿐인 포켓몬 1번 도로가 마무리 장소가 됐다. 만남 장소다운 자리(앉을 곳·빛·꽃)가 하나도 없었다.

import type { GameMap, Project, TilesetDef } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { BEODEUL_PLAIN_GRASS, canPaintBeodeulWildRoute, plantBeodeulForestWall } from "./wildRouteBeodeul";
import type { ToolDefinition } from "./types";

const PAVED = "버들항 길 포석";

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find(candidate => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

export interface StoryWalkPlan {
  /** 서쪽 가장자리 출구(앞 장소에서 오는 문). */
  readonly exit: { readonly x: number; readonly y: number };
  /** 마무리 대상이 서는 칸 — 광장 동쪽, 벤치 앞. */
  readonly meet: { readonly x: number; readonly y: number };
}

export function canPaintStoryWalk(tileset: TilesetDef | undefined): tileset is TilesetDef {
  return !!tileset && canPaintBeodeulWildRoute(tileset)
    && ["bd-prop-bench_wood", "bd-prop-hedge", "bd-mpart-lamp-post", "bd-prop-flowerbed"].every(id => tileset.structureKits?.some(kit => kit.id === id));
}

/**
 * 산책길 + 만남 광장. 칸을 직접 고르지 않고 fill_region(포석 오토타일)과 stamp_object(버들항 키트)만 쓴다.
 * 찍을 수 없는 자리는 건너뛴다 — 어떤 소품이 빠져도 길과 광장은 남는다.
 */
export function paintBeodeulStoryWalk(project: Project, map: GameMap, tileset: TilesetDef, plan: StoryWalkPlan, seed = 7): { pavedCells: number; props: number; treeCells: number } {
  const fillRegion = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
  const stampObject = requireTool(SHARED_OBJECT_TOOLS, "stamp_object");
  const rng = mulberry32(seed ^ 0x570a17);
  const w = map.width, h = map.height;
  const { exit, meet } = plan;
  // 광장: 마무리 칸을 동쪽 끝에 둔 8×7. 맵이 작으면 줄인다.
  const px1 = Math.min(w - 2, meet.x), px0 = Math.max(exit.x + 6, px1 - 7);
  const py0 = Math.max(2, meet.y - 3), py1 = Math.min(h - 3, meet.y + 3);
  const fill = (x: number, y: number, rw: number, rh: number) => {
    if (rw <= 0 || rh <= 0) return;
    fillRegion.run(project, { mapId: map.id, rect: { x, y, w: rw, h: rh }, material: PAVED });
  };
  // 산책길: 출구 줄과 그 아래 줄, 두 칸 폭으로 광장까지.
  const pathY = Math.min(exit.y, h - 2);
  fill(0, pathY, px0, 2);
  fill(px0, py0, px1 - px0 + 1, py1 - py0 + 1);
  const pavedCells = px0 * 2 + (px1 - px0 + 1) * (py1 - py0 + 1);

  let props = 0;
  const used = new Set<number>();
  const stamp = (id: string, x: number, y: number): boolean => {
    const kit = tileset.structureKits?.find(candidate => candidate.id === id);
    if (!kit) return false;
    const cells: number[] = [];
    for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) cells.push((y + dy) * w + x + dx);
    if (cells.some(cell => used.has(cell))) return false;   // 소품끼리 겹쳐 찍지 않는다(꽃무더기가 가로수 잎을 덮었다).
    try {
      stampObject.run(project, { objectId: `kit:beodeul_city/${id}`, mapId: map.id, x, y });
      for (const cell of cells) used.add(cell);
      props += 1;
      return true;
    } catch {
      return false;
    }
  };
  // 광장 북쪽: 가운데 석상(교정·광장의 표지)과 양옆 산울타리 — 광장이 「막힌 곳」이 아니라 「들어앉은 자리」로 읽힌다.
  const mid = px0 + Math.floor((px1 - px0 + 1) / 2) - 1;
  const statue = stamp("bd-prop-statue_sage", mid, py0 - 2);
  for (let x = mid - 3; x >= px0 - 1; x -= 3) stamp("bd-prop-hedge", x, py0 - 2);
  for (let x = mid + (statue ? 2 : 0); x + 2 <= px1 + 1; x += 3) stamp("bd-prop-hedge", x, py0 - 2);
  // 벤치 둘 — 하나는 마무리 대상 바로 뒤, 하나는 광장 서쪽.
  stamp("bd-prop-bench_wood", meet.x - 1, meet.y - 1);
  stamp("bd-prop-bench_wood", px0 + 1, meet.y - 1);
  // 광장 입구와 동쪽 끝 가로등(1×3, 받침 칸만 막힘).
  stamp("bd-mpart-lamp-post", px0, py0);
  stamp("bd-mpart-lamp-post", px0, py1 - 2);
  if (px1 + 1 < w) { stamp("bd-mpart-lamp-post", px1 + 1, py0); stamp("bd-mpart-lamp-post", px1 + 1, py1 - 2); }
  // 광장 남쪽 꽃밭과 그 뒤 산울타리 — 광장을 남북으로 감싼다.
  for (let x = px0 + 2; x + 1 < px1 - 1; x += 3) stamp("bd-prop-flowerbed", x, py1);
  if (py1 + 2 < h) for (let x = px0; x + 2 <= px1; x += 3) stamp("bd-prop-hedge", x, py1 + 1);
  // 산책길 가로수(돌 화분, 2×3 — 아래 줄만 막힘)와 길섶 꽃무더기.
  for (let x = 3; x + 2 < px0 - 1; x += 6) {
    stamp("bd-prop-tree_planter", x, pathY - 3);
    stamp("bd-prop-tree_planter", x + 3, Math.min(h - 3, pathY + 3));
  }
  for (let x = 2; x < px0 - 1; x++) {
    if (rng() < 0.25) stamp("bd-mpart-flower-patch", x, pathY - 1);
    if (rng() < 0.25) stamp("bd-mpart-flower-patch", x, pathY + 2);
  }

  // 나머지 풀밭은 버들항 숲 벽으로 — 길·광장 둘레 1칸, 출구 둘레 2칸, 이벤트 둘레는 비운다.
  const reserved = new Set<number>();
  const reserve = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) reserved.add(ny * w + nx);
    }
  };
  for (let x = 0; x < px0; x++) { reserve(x, pathY, 1); reserve(x, pathY + 1, 1); }
  for (let y = py0 - 2; y <= py1; y++) for (let x = px0; x <= Math.min(w - 1, px1 + 1); x++) reserve(x, y, 1);
  reserve(exit.x, exit.y, 2);
  for (const event of map.events) reserve(event.x, event.y, 1);
  for (let i = 0; i < map.lowerTiles.length; i++) if (map.lowerTiles[i] !== BEODEUL_PLAIN_GRASS) reserved.add(i);
  const treeCells = plantBeodeulForestWall(project, map, tileset, reserved, rng, stampObject);
  return { pavedCells, props, treeCells };
}
