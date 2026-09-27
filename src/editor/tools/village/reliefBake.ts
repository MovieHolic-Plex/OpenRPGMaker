// editor/tools/village/reliefBake.ts
// 높이(map.relief) → 진짜 절벽 타일. 「높이」 붓·sculpt_relief 가 부른다.
//
// 왜 있는가(2026-09-27): 높이 붓은 map.relief 숫자만 바꾸고 절벽은 렌더러가 하위·상위 사이에 불투명 그림으로 덧그렸다.
// 그래서 하위·상위 붓·지우개·스포이트로 절벽을 고칠 수 없었다(사용자 「높이에서 깐 타일은 하위·상위에서 수정이 안 된다」).
// 절벽 어휘가 있는 칩셋(숲마을·합본 마을+레트로 월드맵)에서는 높이를 남향 벽 문법(cliffGrammar.ts)으로 하위 층 타일에 굽고
// relief.baked 를 켠다 — 편집기는 baked 맵의 덧그림을 그리지 않는다. 높이 숫자는 붓의 기준(올리기/내리기)으로 남는다.
//
// 굽기는 「이전 높이 계획 ↔ 새 높이 계획」의 차이 칸만 고친다. 하위 붓으로 손본 칸은 그 칸의 계획이 바뀌지 않는 한 그대로다.

import { RETRO_WORLD_TILE_OFFSET, TILE } from "@/project/defaults/constants";
import { effectiveHeights } from "@/project/relief/render";
import { gridFromRelief, type HeightGrid, type ReliefData } from "@/project/relief/types";
import type { GameMap, TilesetDef } from "@/project/types";
import { buildWall, CLIFF_TILE, type WallCell } from "./cliffGrammar";
import { tilesetHasCliffVocabulary } from "./relief";

interface SouthEdge {
  readonly x: number;
  readonly s: number;
  readonly top: number;
  readonly drop: number;
  next?: SouthEdge;
  prev?: SouthEdge;
}

export interface ReliefTilePlan {
  readonly width: number;
  readonly height: number;
  readonly tiles: Int16Array;
  readonly walls: number;
  readonly skipped: number;
}

/** 두 이웃 열의 남쪽 가장자리가 같은 벽면으로 이어지는가 — 긴 쪽 열이 짧은 쪽 윗선 행까지 끊김 없이 대지여야 한다. */
function faceConnects(h: HeightGrid, a: SouthEdge, b: SouthEdge): boolean {
  if (a.top !== b.top) return false;
  const [longer, shorter] = a.s >= b.s ? [a, b] : [b, a];
  for (let y = shorter.s - 1; y <= longer.s - 1; y += 1) {
    if (y < 0 || (h[y]?.[longer.x] ?? 0) < longer.top) return false;
  }
  return true;
}

function wallCells(chain: readonly SouthEdge[], width: number): WallCell[] {
  const first = chain[0]!, last = chain[chain.length - 1]!;
  const rawLip = chain.map((edge, i) => (i === 0 ? edge.s : Math.max(chain[i - 1]!.s, edge.s)));
  rawLip.push(last.s);
  const height = 1 + Math.max(...chain.map((edge) => edge.drop));
  const spec = { xa: first.x, xb: last.x + 1, rawLip, height, exposedLeft: first.x > 0, exposedRight: last.x < width - 1 };
  try {
    return buildWall(spec).cells;
  } catch {
    // 짧은 벽에서 양 끝을 묻을 자리가 모자라면 끝을 묻지 않고 한 번 더 — 그래도 안 되면 그 벽은 건너뛴다.
    return buildWall({ ...spec, exposedLeft: false, exposedRight: false }).cells;
  }
}

/** 높이 격자 → 남향 벽 타일 계획. 렌더러와 같은 유효 높이(1칸 돌기·홈 깎기)를 쓴다. */
export function planReliefTiles(relief: ReliefData | undefined, width: number, height: number): ReliefTilePlan {
  const tiles = new Int16Array(width * height).fill(-1);
  if (!relief || relief.width !== width || relief.height !== height || !relief.levels.some((v) => v > 0)) {
    return { width, height, tiles, walls: 0, skipped: 0 };
  }
  const h = effectiveHeights(gridFromRelief(relief));
  const columns: SouthEdge[][] = Array.from({ length: width }, () => []);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height - 1; y += 1) {
      const a = h[y]![x]!, b = h[y + 1]![x]!;
      if (a > b) columns[x]!.push({ x, s: y + 1, top: a, drop: a - b });
    }
  }
  for (let x = 0; x < width - 1; x += 1) {
    for (const edge of columns[x]!) {
      let best: SouthEdge | undefined;
      for (const candidate of columns[x + 1]!) {
        if (candidate.prev || !faceConnects(h, edge, candidate)) continue;
        if (!best || Math.abs(candidate.s - edge.s) < Math.abs(best.s - edge.s)) best = candidate;
      }
      if (best) { edge.next = best; best.prev = edge; }
    }
  }
  const chains: SouthEdge[][] = [];
  for (const column of columns) {
    for (const edge of column) {
      if (edge.prev) continue;
      const chain: SouthEdge[] = [];
      for (let e: SouthEdge | undefined = edge; e; e = e.next) chain.push(e);
      chains.push(chain);
    }
  }
  chains.sort((a, b) => a[0]!.top - b[0]!.top);
  let walls = 0, skipped = 0;
  for (const chain of chains) {
    let cells: WallCell[];
    try {
      cells = wallCells(chain, width);
    } catch {
      skipped += 1;
      continue;
    }
    walls += 1;
    for (const cell of cells) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;
      tiles[cell.y * width + cell.x] = cell.tile;
    }
  }
  return { width, height, tiles, walls, skipped };
}

const CLIFF_IDS: readonly number[] = Object.values(CLIFF_TILE).filter((tile) => tile !== CLIFF_TILE.stairs);

export interface ReliefBakeResult {
  readonly painted: number;
  readonly restored: number;
  readonly kept: number;
}

export function reliefBakesToTiles(tileset: Pick<TilesetDef, "image" | "count"> | undefined): boolean {
  return tilesetHasCliffVocabulary(tileset);
}

/**
 * previous(고치기 전 relief) → map.relief 로 바뀐 계획만큼 하위 층 절벽 타일을 고친다. map.relief.baked 를 켠다.
 * previous 가 굽지 않은 옛 높이면 이전 계획을 빈 것으로 보고 맵 전체를 굽는다.
 * 절벽 어휘가 없는 칩셋이면 아무것도 안 하고 undefined.
 */
export function bakeReliefTiles(
  map: GameMap,
  tileset: TilesetDef | undefined,
  previous: ReliefData | undefined,
  tileOffset: number = RETRO_WORLD_TILE_OFFSET,
): ReliefBakeResult | undefined {
  if (!reliefBakesToTiles(tileset)) return undefined;
  const { width, height } = map;
  const before = planReliefTiles(previous?.baked ? previous : undefined, width, height).tiles;
  const after = planReliefTiles(map.relief, width, height).tiles;
  const cliffIds = new Set(CLIFF_IDS.map((tile) => tile + tileOffset));
  const stairs = CLIFF_TILE.stairs + tileOffset;
  const groundAt = (x: number, y: number): number => {
    // 벽이 물러난 칸은 같은 열의 가까운 땅(위 먼저 — 대지 윗면)으로 되돌린다.
    for (let d = 1; d < height; d += 1) {
      for (const yy of [y - d, y + d]) {
        if (yy < 0 || yy >= height) continue;
        const tile = map.lowerTiles[yy * width + x] ?? TILE.EMPTY;
        if (tile >= 0 && !cliffIds.has(tile) && tile !== stairs) return tile;
      }
    }
    return TILE.GRASS;
  };
  const writable = (index: number, previousTile: number): boolean => {
    const current = map.lowerTiles[index] ?? TILE.EMPTY;
    if (current === stairs) return false;
    if (cliffIds.has(current) || (previousTile >= 0 && current === previousTile + tileOffset)) return true;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) return false;
    if (current < 0) return true;
    const pass = tileset?.passability[current];
    return !!pass && pass.up && pass.down && pass.left && pass.right;
  };
  let painted = 0, restored = 0, kept = 0;
  for (let index = 0; index < after.length; index += 1) {
    const was = before[index]!, want = after[index]!;
    if (was === want) continue;
    const x = index % width, y = Math.floor(index / width);
    if (want >= 0) {
      if (!writable(index, was)) { kept += 1; continue; }
      map.lowerTiles[index] = want + tileOffset;
      painted += 1;
    } else if ((map.lowerTiles[index] ?? TILE.EMPTY) === was + tileOffset) {
      // 사용자가 하위 붓으로 바꾼 칸은 계획이 사라져도 건드리지 않는다.
      map.lowerTiles[index] = groundAt(x, y);
      restored += 1;
    }
  }
  if (map.relief) map.relief.baked = true;
  return { painted, restored, kept };
}
