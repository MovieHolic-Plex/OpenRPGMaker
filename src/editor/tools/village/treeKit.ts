// editor/tools/village/treeKit.ts
// 마을 시공이 심는 나무의 어휘를 타일셋에 따라 고른다.
//
// 합본 마을(과 그 어휘를 그대로 지닌 혼합 칩셋 위 반쪽)은 침엽수 1×2·활엽수 2×2·덤불 1칸의 예전 원자를 쓴다.
// 혼합 칩셋에 숲 나무 확장 띠(forestTreesExtension.ts, 960~)가 있으면 그 물체들 — 큰 참나무 4×5·활엽수 3×4·
// 짙은 나무 2×4·덤불 셋·숲 벽/기둥 — 을 스탬프로 쓴다. 스탬프는 칸마다 레이어가 정해져 있다(수관 상위,
// 밑동·덤불 하위). 하위 칸은 잔디를 덮지만 렌더러가 잔디 받침을 깔아(tileLayerPolicy) 투명 픽셀이 뚫리지 않는다.

import {
  FOREST_TREE_CELLS,
  forestTreeObject,
  forestTreesTileId,
  tilesetHasForestTrees,
  type ForestTreeObject,
} from "@/project/defaults/forestTreesExtension";
import type { GameMap, TilesetDef } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { OCC } from "./morphologyPlan";

export interface TreeStampCell {
  readonly layer: "lower" | "upper";
  readonly tile: number;
}

export interface TreeStamp {
  readonly id: string;
  readonly w: number;
  readonly h: number;
  /** 행 우선 w×h. null 은 물체에 속하지 않는 빈 칸(자리를 차지하지도, 그리지도 않는다). */
  readonly cells: readonly (TreeStampCell | null)[];
}

export interface TreeKit {
  readonly id: "combined-town" | "forest-trees";
  /** 큰 나무 — 먼 거리·녹지 한가운데. */
  readonly big: TreeStamp;
  /** 중간 나무 — 녹지 앵커·뒷마당. */
  readonly medium: TreeStamp;
  /** 작은 나무 — 가까운 거리 기본. */
  readonly small: TreeStamp;
  /** 덤불 — 마을 세포 바로 바깥. */
  readonly shrubs: readonly TreeStamp[];
  /** 짙은 숲 덩이 — 마을에서 아주 먼 곳. 비어 있으면 큰 나무로 대신한다. */
  readonly forest: readonly TreeStamp[];
}

const CONIFER_TOP = 260;
const CONIFER_BOTTOM = 290;
const BROADLEAF_TOP_LEFT = 262;
const BROADLEAF_TOP_RIGHT = 263;
const BROADLEAF_BOTTOM_LEFT = 292;
const BROADLEAF_BOTTOM_RIGHT = 293;
const BUSH_TILE = 289;

const up = (tile: number): TreeStampCell => ({ layer: "upper", tile });
const low = (tile: number): TreeStampCell => ({ layer: "lower", tile });

const BROADLEAF_2X2: TreeStamp = {
  id: "broadleaf",
  w: 2, h: 2,
  cells: [up(BROADLEAF_TOP_LEFT), up(BROADLEAF_TOP_RIGHT), low(BROADLEAF_BOTTOM_LEFT), low(BROADLEAF_BOTTOM_RIGHT)],
};
const CONIFER_1X2: TreeStamp = { id: "conifer", w: 1, h: 2, cells: [up(CONIFER_TOP), low(CONIFER_BOTTOM)] };
const BUSH_1X1: TreeStamp = { id: "bush", w: 1, h: 1, cells: [up(BUSH_TILE)] };

/** 합본 마을 원자 — 예전 시공과 같은 타일. */
export const COMBINED_TOWN_TREE_KIT: TreeKit = {
  id: "combined-town",
  big: BROADLEAF_2X2,
  medium: BROADLEAF_2X2,
  small: CONIFER_1X2,
  shrubs: [BUSH_1X1],
  forest: [],
};

function stampFromObject(object: ForestTreeObject): TreeStamp {
  const cells: (TreeStampCell | null)[] = [];
  for (let dy = 0; dy < object.h; dy += 1) {
    for (let dx = 0; dx < object.w; dx += 1) {
      const tile = forestTreesTileId(object.x + dx, object.y + dy);
      const kind = FOREST_TREE_CELLS.get(tile)?.kind ?? "empty";
      cells.push(kind === "empty" ? null : kind === "canopy" ? up(tile) : low(tile));
    }
  }
  return { id: object.id, w: object.w, h: object.h, cells };
}

let forestKit: TreeKit | undefined;

/** 숲 나무 확장 띠 스탬프. */
export function forestTreeKit(): TreeKit {
  forestKit ??= {
    id: "forest-trees",
    big: stampFromObject(forestTreeObject("big-oak")),
    medium: stampFromObject(forestTreeObject("tree")),
    small: stampFromObject(forestTreeObject("dark-tree")),
    shrubs: ["round-bush", "dark-bush", "small-bush"].map((id) => stampFromObject(forestTreeObject(id))),
    forest: ["forest-wall", "forest-column"].map((id) => stampFromObject(forestTreeObject(id))),
  };
  return forestKit;
}

export function treeKitForTileset(tileset: Pick<TilesetDef, "image" | "count"> | undefined): TreeKit {
  return tilesetHasForestTrees(tileset) ? forestTreeKit() : COMBINED_TOWN_TREE_KIT;
}

/** 스탬프의 모든 실제 칸이 free 이고 점유가 비어 있거나(녹지·밭 허용) 할 때만 찍을 수 있다. */
export function canStampTree(
  stamp: TreeStamp,
  x: number,
  y: number,
  free: (x: number, y: number) => boolean,
  occ: Uint8Array,
  W: number,
): boolean {
  for (let dy = 0; dy < stamp.h; dy += 1) {
    for (let dx = 0; dx < stamp.w; dx += 1) {
      if (!stamp.cells[dy * stamp.w + dx]) continue;
      const cx = x + dx, cy = y + dy;
      if (!free(cx, cy)) return false;
      const value = occ[cy * W + cx] ?? OCC.reserved;
      if (value !== OCC.free && value !== OCC.commons && value !== OCC.field) return false;
    }
  }
  return true;
}

/** 스탬프를 맵에 그리고 그린 칸 수를 돌려준다. 점유 표시는 markTreeStamp 로 따로 한다. */
export function stampTree(map: GameMap, stamp: TreeStamp, x: number, y: number): number {
  const W = map.width;
  let painted = 0;
  for (let dy = 0; dy < stamp.h; dy += 1) {
    for (let dx = 0; dx < stamp.w; dx += 1) {
      const cell = stamp.cells[dy * stamp.w + dx];
      if (!cell) continue;
      const index = (y + dy) * W + x + dx;
      if (cell.layer === "upper") map.upperTiles[index] = cell.tile;
      else map.lowerTiles[index] = cell.tile;
      painted += 1;
    }
  }
  return painted;
}

export function markTreeStamp(occ: Uint8Array, W: number, stamp: TreeStamp, x: number, y: number, value: number = OCC.reserved): void {
  for (let dy = 0; dy < stamp.h; dy += 1) {
    for (let dx = 0; dx < stamp.w; dx += 1) {
      if (!stamp.cells[dy * stamp.w + dx]) continue;
      occ[(y + dy) * W + x + dx] = value;
    }
  }
}

/** 스탬프가 차지하는 칸 index 목록(빈 칸 제외). */
export function treeStampCells(stamp: TreeStamp, x: number, y: number, W: number): number[] {
  const cells: number[] = [];
  for (let dy = 0; dy < stamp.h; dy += 1) {
    for (let dx = 0; dx < stamp.w; dx += 1) {
      if (stamp.cells[dy * stamp.w + dx]) cells.push((y + dy) * W + x + dx);
    }
  }
  return cells;
}

export interface ForestBandReport {
  /** 찍은 물체 수(숲 덩이 하나도 1). */
  readonly placed: number;
  /** 그린 칸 수. */
  readonly cells: number;
  readonly chunks: number;
}

/**
 * 숲 띠(terrain 마스크 forest) 를 킷으로 채운다 — 숲 덩이를 격자로 깔고(85%), 남은 자리에 큰 나무·활엽수·
 * 짙은 나무·덤불을 흩뿌린다. 점유 격자가 없는 경로(villageTerrainPass)용이라 free 판정만 받는다.
 * 킷에 숲 덩이가 없으면(합본 마을) 나무만 흩뿌린다.
 */
export function plantForestBand(
  map: GameMap,
  rect: { x: number; y: number; w: number; h: number },
  seed: number,
  kit: TreeKit,
  free: (x: number, y: number) => boolean,
): ForestBandReport {
  const W = map.width;
  const rng = mulberry32(seed >>> 0);
  const taken = new Set<number>();
  const inRect = (x: number, y: number): boolean => x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
  const open = (x: number, y: number): boolean => inRect(x, y) && !taken.has(y * W + x) && free(x, y);
  let placed = 0, cells = 0, chunks = 0;
  const place = (stamp: TreeStamp, x: number, y: number): boolean => {
    for (let dy = 0; dy < stamp.h; dy += 1) {
      for (let dx = 0; dx < stamp.w; dx += 1) {
        if (stamp.cells[dy * stamp.w + dx] && !open(x + dx, y + dy)) return false;
      }
    }
    cells += stampTree(map, stamp, x, y);
    for (const k of treeStampCells(stamp, x, y, W)) taken.add(k);
    placed += 1;
    return true;
  };
  // ① 숲 덩이 — 행마다 반 칸씩 엇갈린 격자. 띠 안쪽부터 채우고 가장자리는 나무에 맡긴다.
  const chunk = kit.forest[0];
  if (chunk) {
    for (let y = rect.y; y + chunk.h <= rect.y + rect.h; y += chunk.h) {
      const stagger = ((y - rect.y) / chunk.h) % 2 === 1 ? Math.floor(chunk.w / 2) : 0;
      for (let x = rect.x + stagger; x + chunk.w <= rect.x + rect.w; x += chunk.w) {
        if (rng() < 0.85 && place(chunk, x, y)) chunks += 1;
      }
    }
    const column = kit.forest[1];
    if (column) {
      // 남은 세로 틈에 숲 기둥.
      for (let y = rect.y; y + column.h <= rect.y + rect.h; y += column.h) {
        for (let x = rect.x; x + column.w <= rect.x + rect.w; x += column.w) {
          if (rng() < 0.5 && place(column, x, y)) chunks += 1;
        }
      }
    }
  }
  // ② 나무·덤불 — 남은 칸을 무작위 순서로 훑는다.
  const order: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) order.push(y * W + x);
  for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  for (const index of order) {
    const x = index % W, y = Math.floor(index / W);
    if (!open(x, y)) continue;
    const roll = rng();
    if (roll < 0.3 && place(kit.big, x, y)) continue;
    if (roll < 0.7 && place(kit.medium, x, y)) continue;
    if (roll < 0.9 && place(kit.small, x, y)) continue;
    const shrub = kit.shrubs[Math.floor(rng() * kit.shrubs.length)];
    if (shrub) place(shrub, x, y);
  }
  return { placed, cells, chunks };
}
