// benchmark/agent/detect.ts
// 자유 형식 맵에서 마을 구조를 탐지한다 — 픽스처 독립.
//
// 왜 필요한가: town/ 트랙은 "정해진 발자국에 집을 지어라"라고 시키므로 집 위치를
// 이미 안다. 이 트랙은 코딩 에이전트에게 **생짜로** "마을을 만들어라"라고 시키므로
// 맵 크기도, 집 수도, 어디에 무엇이 있는지도 모른 채 채점해야 한다.
// 그래서 감사 전에 탐지가 먼저 온다.
//
// 탐지 규칙은 전부 살아있는 테이블에서 파생한다(손으로 적은 타일 id 없음):
//   벽·지붕 = HOUSE_KITS 6벌 ∪ benchmark/groundTruth 의 파생 집합
//   문       = village/constants 문 규약 두 벌
//   길       = ROAD_TILES (흙길 ∪ 모래 ∪ 포석)
//   울타리   = village/constants FENCE_TILES

import { deriveRoofTiles, deriveWallTiles, deriveTreePairs } from "@/benchmark/groundTruth";
import { HOUSE_KITS } from "@/editor/houseKit";
import {
  DOOR_BOTTOM_TILE,
  DOOR_TOP_TILE,
  FENCE_TILES,
  ROAD_TILES,
} from "@/editor/tools/village/constants";
import { connectedComponents, inBounds, type GridView } from "@/benchmark/town/gridWalk";
import { EMPTY_CELL } from "@/benchmark/town/types";

export interface MapSubmission {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

// ── 타일 계열 ─────────────────────────────────────────────────────────────

function kitTiles(pick: "wall" | "roof"): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const kit of Object.values(HOUSE_KITS)) {
    if (pick === "wall") {
      for (const slice of [kit.wall.top, kit.wall.mid, kit.wall.bottom]) for (const tile of slice) ids.add(tile);
      if (kit.postColumn) for (const tile of kit.postColumn.tiles) ids.add(tile);
    } else {
      for (const value of Object.values(kit.roof)) if (typeof value === "number") ids.add(value);
      for (const value of Object.values(kit.roof.upper)) if (typeof value === "number") ids.add(value);
    }
  }
  return ids;
}

/** 문 두 벌 — 상단 → 짝이 되는 하단. village/houses.ts 규약. */
export const DOOR_PAIRS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([DOOR_TOP_TILE, DOOR_BOTTOM_TILE] as [number, number]),
  Object.freeze([329, 359] as [number, number]),
]);

export const WALL_FAMILY: ReadonlySet<number> = new Set([...kitTiles("wall"), ...deriveWallTiles()]);
export const ROOF_FAMILY: ReadonlySet<number> = new Set([...kitTiles("roof"), ...deriveRoofTiles()]);
export const ROAD_FAMILY: ReadonlySet<number> = new Set(ROAD_TILES);
export const FENCE_FAMILY: ReadonlySet<number> = new Set(FENCE_TILES);
/** 캐노피 → 같은 나무의 줄기. */
export const CANOPY_TO_TRUNK: ReadonlyMap<number, number> = new Map(
  deriveTreePairs().map(([canopy, trunk]) => [canopy, trunk]),
);

// ── 탐지 결과 ─────────────────────────────────────────────────────────────

export interface DetectedDoor {
  readonly x: number;
  /** 문 하단 행. 문 앞은 y+1 이다. */
  readonly y: number;
  /** 상·하단이 같은 벌인가. 섞였으면 문으로 세지만 결함으로 표시한다. */
  readonly sameFamily: boolean;
}

export interface DetectedBuilding {
  readonly cells: readonly number[];
  readonly bbox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** 이 건물 벽에 난 문들. */
  readonly doors: readonly DetectedDoor[];
}

export interface Detection {
  readonly buildings: readonly DetectedBuilding[];
  /** 문이 하나 이상 있는 건물 = 집. */
  readonly houses: readonly DetectedBuilding[];
  readonly doors: readonly DetectedDoor[];
  readonly roadCells: ReadonlySet<number>;
  readonly roadComponents: number;
  readonly largestRoadComponent: number;
  readonly fenceCells: ReadonlySet<number>;
  /** 캐노피가 있는데 그 칸 하위에 짝이 되는 줄기가 없는 조각난 나무. */
  readonly brokenTrees: number;
  readonly trees: number;
}

function lowerView(map: MapSubmission): GridView {
  return { width: map.width, height: map.height, cells: map.lower };
}

function tileAt(map: MapSubmission, layer: "lower" | "upper", x: number, y: number): number {
  if (!inBounds(map, x, y)) return EMPTY_CELL;
  return (layer === "lower" ? map.lower : map.upper)[y * map.width + x] ?? EMPTY_CELL;
}

/** 건물 = 벽·지붕 계열 타일의 8방향 연결 성분(대각으로 물린 지붕도 한 채로 본다). */
function detectBuildings(map: MapSubmission, doors: readonly DetectedDoor[]): DetectedBuilding[] {
  const members = new Set<number>();
  for (let index = 0; index < map.lower.length; index += 1) {
    const lower = map.lower[index] ?? EMPTY_CELL;
    const upper = map.upper[index] ?? EMPTY_CELL;
    const isBuilding =
      (lower !== EMPTY_CELL && (WALL_FAMILY.has(lower) || ROOF_FAMILY.has(lower))) ||
      (upper !== EMPTY_CELL && ROOF_FAMILY.has(upper));
    if (isBuilding) members.add(index);
  }
  // 8방향으로 묶는다 — 4방향만 쓰면 사선 지붕 캡이 본체와 떨어져 한 집이 여러 채로 세진다.
  const remaining = new Set(members);
  const groups: number[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    remaining.delete(first);
    const stack = [first];
    const cells: number[] = [];
    while (stack.length > 0) {
      const index = stack.pop()!;
      cells.push(index);
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(map, nx, ny)) continue;
          const next = ny * map.width + nx;
          if (!remaining.has(next)) continue;
          remaining.delete(next);
          stack.push(next);
        }
      }
    }
    groups.push(cells);
  }

  return groups.map((cells) => {
    let minX = map.width;
    let maxX = -1;
    let minY = map.height;
    let maxY = -1;
    for (const index of cells) {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    const cellSet = new Set(cells);
    // 문 타일(116/146…)은 벽 계열이 아니므로 건물 셀 집합에 없다. 그래서 "문 칸이
    // 건물에 속하는가"로 물으면 어느 집도 자기 문을 못 찾는다(2026-08-21 실측 버그).
    // 문은 벽을 뚫고 난 구멍이므로 **문 주위 8칸에 이 건물의 벽이 있는가**로 묶는다.
    const own = doors.filter((door) =>
      [door.y, door.y - 1].some((y) => {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = door.x + dx;
            const ny = y + dy;
            if (!inBounds(map, nx, ny)) continue;
            if (cellSet.has(ny * map.width + nx)) return true;
          }
        }
        return false;
      }),
    );
    return { cells, bbox, doors: own };
  });
}

/** 문 = 하위 레이어에 세로로 붙은 문 두 칸. 상·하단이 다른 벌이면 결함으로 표시한다. */
function detectDoors(map: MapSubmission): DetectedDoor[] {
  const tops = new Set(DOOR_PAIRS.map(([top]) => top));
  const bottoms = new Set(DOOR_PAIRS.map(([, bottom]) => bottom));
  const doors: DetectedDoor[] = [];
  for (let y = 1; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const bottom = tileAt(map, "lower", x, y);
      if (!bottoms.has(bottom)) continue;
      const top = tileAt(map, "lower", x, y - 1);
      if (!tops.has(top)) continue;
      doors.push({ x, y, sameFamily: DOOR_PAIRS.some(([t, b]) => t === top && b === bottom) });
    }
  }
  return doors;
}

export function detectVillage(map: MapSubmission): Detection {
  const doors = detectDoors(map);
  const buildings = detectBuildings(map, doors);

  const roadCells = new Set<number>();
  const fenceCells = new Set<number>();
  let trees = 0;
  let brokenTrees = 0;
  for (let index = 0; index < map.lower.length; index += 1) {
    const lower = map.lower[index] ?? EMPTY_CELL;
    const upper = map.upper[index] ?? EMPTY_CELL;
    if (lower !== EMPTY_CELL && ROAD_FAMILY.has(lower)) roadCells.add(index);
    if (upper !== EMPTY_CELL && FENCE_FAMILY.has(upper)) fenceCells.add(index);
    const trunkForCanopy = CANOPY_TO_TRUNK.get(upper);
    if (trunkForCanopy !== undefined) {
      trees += 1;
      // 조각난 나무 — 하네스가 hard rule 로 막는 결함이다(layoutPlacementValidate).
      if (lower !== trunkForCanopy) brokenTrees += 1;
    }
  }

  const components = connectedComponents(map, roadCells);
  return {
    buildings,
    houses: buildings.filter((building) => building.doors.length > 0),
    doors,
    roadCells,
    roadComponents: components.length,
    largestRoadComponent: components[0]?.length ?? 0,
    fenceCells,
    brokenTrees,
    trees,
  };
}

/** 하위 레이어 뷰 — 도달성 계산에 쓴다. */
export function submissionLowerView(map: MapSubmission): GridView {
  return lowerView(map);
}
