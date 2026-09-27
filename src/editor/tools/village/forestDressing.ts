// editor/tools/village/forestDressing.ts
// 숲마을 칩(forest_harmony)의 place_props 숲 — 굽이숲 수관을 깐 뒤 영역 크기에 맞춰 꾸민다.
//
// 왜 (2026-09-26 사용자): 「숲」이 수관과 밑동만 이어진 한 덩어리였다. 숲이라면 크기에 따라 물이 흐르고,
// 트인 풀밭에 작은 나무·돌이 있고, 쯔꾸르식 「통행 가능한 수관」 — 밑으로 걸어 들어가면 주인공이 잎에 가려지는
// 숨은 길과 그 안의 보물 자리가 있어야 한다.
//
// 순서가 계약이다:
// 1. 물은 수관보다 **먼저** 예약한다. 수관 조립(paintContouredForest)이 예약 칸을 피해 가장자리와 밑동을 맞춘다.
//    수관을 깐 뒤 물을 파면 밑동이 잘리거나 수관 가장자리가 물 위에 떠 버린다.
// 2. 숨은 길은 수관을 깐 **뒤** 고른다. 수관 칸만 ★ 쌍둥이(ensureWalkableCanopy)로 바꾸므로 그림은 그대로다.
//    밑동(아래층 막힘 칩) 칸은 절대 지나가지 않는다 — 밑동을 지우면 나무가 반 토막 난다.
// 3. 꾸밈은 마지막에, 수관·밑동·물·길·이벤트가 없는 맨 풀밭에만 놓는다.

import { TILE } from "@/project/defaults/constants";
import { ensureWalkableCanopy, forestCanopyTiles } from "@/project/defaults/forestGrove";
import { setLayerTileAt } from "@/project/mapLayers";
import type { AutotileGroup, GameMap, Rect, TilesetDef } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { shadeForestCanopy } from "./forestContour";
import { FOREST_TRUNK_TILES } from "./forestTrunkTiles";
import { stampTree, treeStampCells, type TreeKit, type TreeStamp } from "./treeKit";
import { VILLAGE_ANIMATED_WATER_TILE } from "./waterTiles";

type Point = { readonly x: number; readonly y: number };

/** 숲 바닥 소품(상위·통행 불가). 29 돌 무더기, 537 회백색 바위 더미, 768 꽃 둥근 관목 — wildRouteForest 와 같은 칩. */
const STONES = [29, 537] as const;
const FLOWER_SHRUB = 768;

/** 물 크기 구간(영역 칸 수). 작은 숲은 물이 들어가면 숲이 사라지고, 큰 숲은 연못 하나로는 비어 보인다. */
export const FOREST_POND_MIN_CELLS = 150;
export const FOREST_STREAM_MIN_CELLS = 480;

export type ForestWaterKind = "none" | "pond" | "stream";

export interface ForestWaterPlan {
  readonly kind: ForestWaterKind;
  readonly cells: ReadonlySet<number>;
}

export interface ForestDressingReport {
  readonly water: ForestWaterKind;
  readonly waterCells: number;
  readonly secretPathCells: number;
  /** 수관 속 막다른 칸 — 밖에서 걸어 들어갈 수 있고 8방향이 수관·밑동이라 보물 자리로 쓴다. */
  readonly secretSpots: readonly Point[];
  readonly smallTrees: number;
  readonly shrubs: number;
  readonly stones: number;
}

function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}

/** 영역 크기로 물 종류를 고른다. impassable 은 물을 넣지 않는다 — 물가가 걸어 들어오는 틈이 된다. */
export function forestWaterKindFor(area: Rect, density: "dense" | "impassable"): ForestWaterKind {
  if (density === "impassable") return "none";
  const cells = area.w * area.h;
  if (cells >= FOREST_STREAM_MIN_CELLS && Math.min(area.w, area.h) >= 14) return "stream";
  if (cells >= FOREST_POND_MIN_CELLS && Math.min(area.w, area.h) >= 8) return "pond";
  return "none";
}

/**
 * 물 칸을 예약한다(아직 칠하지 않는다). 개울은 영역의 긴 변을 따라 한쪽 끝에서 반대쪽 끝까지 굽이쳐 흐르고
 * 폭 3~4칸(물가 칩은 잔디 쪽이 어두워 2칸 폭은 가운데 수면이 없는 검은 띠로 보인다), 연못은 영역 안쪽의 찌그러진 타원. `free` 가 거짓인 칸(이벤트·집·길·기존 소품)은 쓰지 않는다.
 */
export function planForestWater(map: GameMap, area: Rect, kind: ForestWaterKind, seed: number,
  free: (x: number, y: number) => boolean): ForestWaterPlan {
  const cells = new Set<number>();
  const W = map.width;
  const inside = (x: number, y: number): boolean => x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
  const add = (x: number, y: number): void => { if (inside(x, y) && free(x, y)) cells.add(y * W + x); };
  const rng = mulberry32((seed ^ 0x6a09e667) >>> 0);
  if (kind === "stream") {
    const horizontal = area.w >= area.h;
    const length = horizontal ? area.w : area.h, span = horizontal ? area.h : area.w;
    const base = (horizontal ? area.y : area.x) + Math.floor(span * (0.35 + rng() * 0.3));
    const phase = rng() * Math.PI * 2, amp = Math.max(1.5, span * 0.18);
    for (let t = 0; t < length; t++) {
      const centre = base + Math.round(Math.sin(t * 0.21 + phase) * amp + Math.sin(t * 0.07 - phase) * amp * 0.6);
      const width = 3 + (hash(t, 3, seed) < 0.4 ? 1 : 0);
      for (let k = 0; k < width; k++) {
        const c = Math.max((horizontal ? area.y : area.x) + 1, Math.min((horizontal ? area.y + area.h : area.x + area.w) - 2, centre + k));
        if (horizontal) add(area.x + t, c); else add(c, area.y + t);
      }
    }
  } else if (kind === "pond") {
    const rx = Math.max(2, Math.round(area.w * (0.16 + rng() * 0.05))), ry = Math.max(2, Math.round(area.h * (0.14 + rng() * 0.05)));
    const cx = area.x + rx + 2 + Math.floor(rng() * Math.max(1, area.w - 2 * rx - 4));
    const cy = area.y + ry + 2 + Math.floor(rng() * Math.max(1, area.h - 2 * ry - 4));
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const wobble = 1 + (hash(x, y, seed) - 0.5) * 0.35;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= wobble) add(x, y);
    }
  }
  // 1칸짜리 물 조각은 물가 오토타일이 점으로 보인다 — 4방향 이웃이 없는 칸을 버린다.
  for (const index of [...cells]) {
    const x = index % W, y = Math.floor(index / W);
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => cells.has((y + dy!) * W + x + dx!)).length;
    if (n === 0) cells.delete(index);
  }
  return { kind: cells.size > 0 ? kind : "none", cells };
}

/** 물은 0번 애니메이션 물로 칠한다 — 렌더가 물가를 합성하고 움직인다(waterTiles.VILLAGE_ANIMATED_WATER_TILE). */
export function paintForestWater(map: GameMap, _tileset: TilesetDef, plan: ForestWaterPlan): number {
  if (plan.cells.size === 0) return 0;
  for (const index of plan.cells) {
    map.lowerTiles[index] = VILLAGE_ANIMATED_WATER_TILE;
    map.upperTiles[index] = TILE.EMPTY;
  }
  return plan.cells.size;
}

/**
 * 쯔꾸르식 숨은 수관 길. 수관 가장자리 한 칸(입구: 수관 칸이고 바로 바깥 이웃이 걸을 수 있는 땅)에서 수관 속으로
 * 몇 칸 파고든 뒤 막다른 주머니에서 끝난다. 길의 수관만 ★ 쌍둥이로 바꾸므로 겉에서 보면 그냥 숲이다.
 * 밑동 칸(아래층 막힘)·물은 지나지 않는다. 영역이 크면 입구를 더 둔다. 찾은 주머니 칸을 돌려준다.
 */
export function carveSecretCanopyPaths(map: GameMap, area: Rect, grove: AutotileGroup, walk: AutotileGroup,
  seed: number, walkable: (x: number, y: number) => boolean): { cells: number; spots: Point[] } {
  const W = map.width, H = map.height;
  const canopy = forestCanopyTiles(grove);
  const twin = new Map<number, number>();
  const groveTiles = [...forestCanopyTiles(grove)].sort((a, b) => a - b);
  const walkTiles = [...forestCanopyTiles(walk)].sort((a, b) => a - b);
  // 두 그룹은 같은 순서로 만든 쌍둥이다(ensureWalkableCanopy) — 정렬 순서가 곧 짝이다.
  groveTiles.forEach((tile, i) => twin.set(tile, walkTiles[i]!));
  const inside = (x: number, y: number): boolean => x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
  const solidCanopy = (x: number, y: number): boolean => inside(x, y)
    && canopy.has(map.upperTiles[y * W + x]!) && !FOREST_TRUNK_TILES.has(map.lowerTiles[y * W + x]!);
  const deep = (x: number, y: number): number => {
    let d = 0;
    for (let r = 1; r <= 3; r++) {
      let all = true;
      for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (!canopy.has(map.upperTiles[ny * W + nx]!) && !FOREST_TRUNK_TILES.has(map.lowerTiles[ny * W + nx]!)) { all = false; break; }
      }
      if (!all) break;
      d = r;
    }
    return d;
  };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  // 입구 후보: 수관 칸인데 4방향 중 하나가 걸을 수 있는 땅(영역 밖 포함). 남쪽 입구는 밑동이 있어 생기지 않는다.
  const entries: { x: number; y: number; dir: readonly [number, number]; score: number }[] = [];
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    if (!solidCanopy(x, y)) continue;
    for (const [dx, dy] of DIRS) {
      if (!walkable(x - dx, y - dy)) continue;
      entries.push({ x, y, dir: [dx, dy], score: hash(x, y, seed) });
      break;
    }
  }
  entries.sort((a, b) => a.score - b.score);
  const want = Math.max(1, Math.min(4, Math.floor((area.w * area.h) / 220)));
  const used = new Set<number>();
  const spots: Point[] = [];
  let cells = 0;
  const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);
  for (const entry of entries) {
    if (spots.length >= want) break;
    if ([...used].some(i => Math.abs(i % W - entry.x) + Math.abs(Math.floor(i / W) - entry.y) < 6)) continue;
    const path: Point[] = [{ x: entry.x, y: entry.y }];
    let [dx, dy] = entry.dir;
    const length = 3 + Math.floor(rng() * 4);
    for (let step = 0; step < length; step++) {
      const last = path[path.length - 1]!;
      const options = [[dx, dy], [dy, dx], [-dy, -dx]] as const;
      let best: Point | undefined, bestDepth = -1;
      for (const [ox, oy] of options) {
        const nx = last.x + ox, ny = last.y + oy;
        if (!solidCanopy(nx, ny) || path.some(p => p.x === nx && p.y === ny) || used.has(ny * W + nx)) continue;
        const depth = deep(nx, ny) + (ox === dx && oy === dy ? 0.5 : 0) + rng() * 0.4;
        if (depth > bestDepth) { bestDepth = depth; best = { x: nx, y: ny }; }
      }
      if (!best) break;
      if (best.x - last.x !== dx || best.y - last.y !== dy) [dx, dy] = [best.x - last.x, best.y - last.y] as [number, number];
      path.push(best);
    }
    if (path.length < 3) continue;
    const pocket = path[path.length - 1]!;
    if (deep(pocket.x, pocket.y) < 1) continue;
    for (const p of path) {
      const i = p.y * W + p.x;
      map.upperTiles[i] = twin.get(map.upperTiles[i]!) ?? map.upperTiles[i]!;
      used.add(i);
      cells++;
    }
    // 캐릭터 그림은 한 칸보다 크고 머리가 윗 칸에 걸친다. 윗 칸이 막힌(x) 수관이면 캐릭터와 y 정렬돼 머리가 잎 위로 나온다.
    // 같은 그림의 ★ 쌍둥이를 4층에 겹쳐 둔다 — 통행은 3층(막힘)이 그대로 정하고 그림만 항상 캐릭터 위다.
    for (const p of path) {
      if (p.y === 0) continue;
      const above = (p.y - 1) * W + p.x;
      const tile = map.upperTiles[above]!;
      if (!canopy.has(tile)) continue;
      setLayerTileAt(map, 4, above, twin.get(tile) ?? tile);
    }
    spots.push(pocket);
  }
  if (cells > 0) shadeForestCanopy(map, walk, area);
  return { cells, spots };
}

/**
 * 트인 풀밭 꾸밈 — 작은 나무·덤불·돌·꽃관목. 개수는 **남은 맨 풀밭 칸 수**에 비례한다(영역이 클수록 많다).
 * 스탬프가 놓일 모든 칸이 맨 풀밭이어야 하고, 한 번 놓은 자리 둘레 1칸은 비워 둔다(소품이 벽처럼 붙지 않게).
 */
export function dressForestFloor(map: GameMap, area: Rect, kit: TreeKit, seed: number,
  bare: (x: number, y: number) => boolean): { smallTrees: number; shrubs: number; stones: number } {
  const W = map.width;
  const inside = (x: number, y: number): boolean => x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
  const taken = new Set<number>();
  const open = (x: number, y: number): boolean => inside(x, y) && bare(x, y) && !taken.has(y * W + x);
  let openCells = 0;
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) if (open(x, y)) openCells++;
  const rng = mulberry32((seed ^ 0x510e527f) >>> 0);
  const fits = (stamp: TreeStamp, x: number, y: number): boolean => {
    for (let dy = -1; dy <= stamp.h; dy++) for (let dx = -1; dx <= stamp.w; dx++) {
      const own = dx >= 0 && dy >= 0 && dx < stamp.w && dy < stamp.h && stamp.cells[dy * stamp.w + dx];
      if (own ? !open(x + dx, y + dy) : taken.has((y + dy) * W + x + dx)) return false;
    }
    return true;
  };
  const place = (stamp: TreeStamp, budget: number): number => {
    let placed = 0;
    for (let tries = 0; tries < budget * 30 && placed < budget; tries++) {
      const x = area.x + Math.floor(rng() * area.w), y = area.y + Math.floor(rng() * area.h);
      if (!fits(stamp, x, y)) continue;
      stampTree(map, stamp, x, y);
      for (const i of treeStampCells(stamp, x, y, W)) taken.add(i);
      placed++;
    }
    return placed;
  };
  const single = (tile: number): TreeStamp => ({ id: `prop-${tile}`, w: 1, h: 1, cells: [{ layer: "upper", tile }] });
  // 밀도는 남은 풀밭 칸 수에 비례한다: 작은 나무 70칸, 덤불 45칸, 꽃관목 90칸, 돌 60칸당 하나.
  const smallTrees = place(kit.medium, Math.floor(openCells / 70));
  const shrubs = kit.shrubs.reduce((sum, stamp, i) => sum + place(stamp, Math.floor(openCells / (45 * (i + 1)))), 0)
    + place(single(FLOWER_SHRUB), Math.floor(openCells / 90));
  const stones = STONES.reduce((sum, tile) => sum + place(single(tile), Math.max(openCells >= 12 ? 1 : 0, Math.floor(openCells / 60))), 0);
  return { smallTrees, shrubs, stones };
}

/** 수관 뒤 단계(숨은 길 + 풀밭 꾸밈). 물은 호출자가 수관 전에 예약·칠한다. */
export function finishForestHarmonyForest(input: {
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly area: Rect;
  readonly density: "dense" | "impassable";
  readonly seed: number;
  readonly kit: TreeKit;
  readonly water: ForestWaterPlan;
  readonly waterCells: number;
  readonly free: (x: number, y: number) => boolean;
}): ForestDressingReport {
  const { map, tileset, area, density, seed, kit } = input;
  const W = map.width;
  const grove = kit.grove!;
  const canopy = forestCanopyTiles(grove);
  const ground = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= W || y >= map.height) return false;
    const i = y * W + x;
    return input.free(x, y) && !input.water.cells.has(i) && map.upperTiles[i] === TILE.EMPTY
      && !FOREST_TRUNK_TILES.has(map.lowerTiles[i]!) && !canopy.has(map.upperTiles[i]!);
  };
  let secretPathCells = 0;
  let secretSpots: Point[] = [];
  // impassable 은 「못 지나간다」는 약속이다 — 숨은 길도 만들지 않는다.
  if (density === "dense") {
    const walk = ensureWalkableCanopy(tileset);
    if (walk) {
      // 입구 바로 밖은 영역 밖이어도 된다(숲 가장자리에서 들어가는 길이 흔하다).
      const outsideOk = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= W || y >= map.height) return false;
        const i = y * W + x;
        return map.upperTiles[i] === TILE.EMPTY && !FOREST_TRUNK_TILES.has(map.lowerTiles[i]!) && !input.water.cells.has(i)
          && map.lowerTiles[i] === TILE.GRASS;
      };
      const carved = carveSecretCanopyPaths(map, area, grove, walk, seed, outsideOk);
      secretPathCells = carved.cells;
      secretSpots = carved.spots;
    }
  }
  const dressed = dressForestFloor(map, area, kit, seed, ground);
  return { water: input.water.kind, waterCells: input.waterCells, secretPathCells, secretSpots, ...dressed };
}
