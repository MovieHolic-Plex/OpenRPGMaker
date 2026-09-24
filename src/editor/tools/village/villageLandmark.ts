// 마을의 랜드마크(등대) — 지은 마을 안 빈 땅에 둥근 탑 한 채를 세우고 꼭대기에 불을 켠다.
//
// 2026-09-24 등대지기 도그푸딩: 브리프의 중심이 「침묵의 등대」인데 항구 마을에는 등대가 없었다.
// 시공기는 theme 문장을 읽지 않고 집·길·숲만 지으므로, 모델이 landmark:"lighthouse" 로 명시하면
// 시공 뒤에 이 후처리가 세운다(기후 후처리 villageClimate 와 같은 자리).
//
// 모양은 지형 도구탭 큐레이션 조합 「원형 타워 (2×5)」(comboBrushCatalog combo_round_tower)를
// 그대로 쓴다 — 캡·베이스는 upper, 목·몸·창은 lower. 등불은 목(138|139, 불투명 벽면) 칸 upper 에
// 벽횃불 624 를 하나씩 얹어 꼭대기 등롱실이 불 켜진 것처럼 읽힌다(렌더 비교: 캡 위 허공은 떠 보이고,
// 캡 칸은 캡이 이미 upper 를 쓴다).
//
// 자리 규칙: 탑 2×5 칸과 바로 앞(남쪽) 2칸이 모두 통행 가능한 맨땅(길·물·집·이벤트 아님)이고,
// 세운 뒤에도 앞칸에서 닿는 칸 수가 탑 칸만큼만 줄어야 한다(길·마을을 끊지 않는다).
// 그중 물에 가까운 자리, 물이 없으면 북쪽 가장자리에 가까운 자리를 고른다.

import type { VillageLandmark } from "@/editor/construction/contracts";
import { canMove, isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import { FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";
import type { GameMap, Project } from "@/project/types";
import { protectedHouseCells } from "../houseProtection";
import { ROAD_TILES } from "./constants";
import { villageWaterPredicate } from "./waterTiles";

type TowerCell = { readonly dx: number; readonly dy: number; readonly lower?: number; readonly upper?: number };

const TOWER_WIDTH = 2;
const TOWER_HEIGHT = 5;
const BEACON_TILE = 624;
/** combo_round_tower 와 같은 층 배치 + 목 칸의 등불. 비운 층(undefined)은 기존 땅을 둔다. */
const LIGHTHOUSE_CELLS: readonly TowerCell[] = [
  { dx: 0, dy: 0, upper: 24 }, { dx: 1, dy: 0, upper: 25 },
  { dx: 0, dy: 1, lower: 138, upper: BEACON_TILE }, { dx: 1, dy: 1, lower: 139, upper: BEACON_TILE },
  { dx: 0, dy: 2, lower: 140 }, { dx: 1, dy: 2, lower: 141 },
  { dx: 0, dy: 3, lower: 142 }, { dx: 1, dy: 3, lower: 143 },
  { dx: 0, dy: 4, upper: 54 }, { dx: 1, dy: 4, upper: 55 },
];

export type PlacedVillageLandmark = {
  readonly kind: VillageLandmark;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** 탑 바로 앞(남쪽) 통행 칸 — create_transfer_pair 로 등대 맵과 잇는 자리. */
  readonly entrance: { readonly x: number; readonly y: number };
};

function reachableCount(project: Project, map: GameMap, sx: number, sy: number): number {
  const seen = new Uint8Array(map.width * map.height);
  seen[sy * map.width + sx] = 1;
  const queue = [sy * map.width + sx];
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % map.width;
    const y = (index - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const next = ny * map.width + nx;
      if (seen[next] || !canMove(project, map, x, y, nx, ny)) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return queue.length;
}

/** 물 칸에서 잰 맨해튼 거리(없으면 null). */
function waterDistance(map: GameMap, isWater: (index: number) => boolean): Int32Array | null {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  const queue: number[] = [];
  for (let index = 0; index < dist.length; index += 1) if (isWater(index)) { dist[index] = 0; queue.push(index); }
  if (queue.length === 0) return null;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % map.width;
    const y = (index - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const next = ny * map.width + nx;
      if (dist[next] !== -1) continue;
      dist[next] = dist[index]! + 1;
      queue.push(next);
    }
  }
  return dist;
}

/**
 * 숲마을 칩셋 맵에 등대를 세운다. 기후 칩셋으로 옮기기 전(applyVillageClimate 앞)에 부른다 —
 * 설원 칩셋은 칸 번호가 같아 그대로 눈 덮인 등대가 된다. 자리가 없으면 아무것도 바꾸지 않는다.
 */
export function placeVillageLandmark(project: Project, mapId: string, kind: VillageLandmark): { placed?: PlacedVillageLandmark; warnings: string[] } {
  const map = project.maps[mapId];
  if (!map) return { warnings: [] };
  if (map.tilesetId !== FOREST_HARMONY_ID) {
    return { warnings: [`landmark:"${kind}" 은 숲마을·설원 칩셋 마을에서만 세웁니다 — 이 맵(${map.tilesetId})에는 세우지 않았습니다.`] };
  }
  const tileset = project.tilesets[map.tilesetId];
  const lakeTile = villageWaterPredicate(map, tileset);
  const isWater = (index: number): boolean => {
    const tile = map.lowerTiles[index] ?? TILE.EMPTY;
    return lakeTile(tile) || tileset?.tileMeta?.[tile]?.role === "water";
  };
  const houses = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  const eventCells = new Set((map.events ?? []).map((event) => event.y * map.width + event.x));
  const bare = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const index = y * map.width + x;
    const lower = map.lowerTiles[index] ?? TILE.EMPTY;
    return !houses.has(index) && !eventCells.has(index) && !isWater(index) && !ROAD_TILES.has(lower)
      && (map.upperTiles[index] ?? TILE.EMPTY) === TILE.EMPTY && isPassable(project, map, x, y);
  };
  const nearHouse = (x: number, y: number): boolean => {
    for (let yy = y - 1; yy <= y + TOWER_HEIGHT; yy += 1) {
      for (let xx = x - 1; xx <= x + TOWER_WIDTH; xx += 1) {
        if (xx >= 0 && yy >= 0 && xx < map.width && yy < map.height && houses.has(yy * map.width + xx)) return true;
      }
    }
    return false;
  };
  const water = waterDistance(map, isWater);
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = 1; y + TOWER_HEIGHT < map.height - 1; y += 1) {
    for (let x = 1; x + TOWER_WIDTH <= map.width - 1; x += 1) {
      let ok = true;
      for (let dy = 0; dy <= TOWER_HEIGHT && ok; dy += 1) for (let dx = 0; dx < TOWER_WIDTH && ok; dx += 1) ok = bare(x + dx, y + dy);
      if (!ok || nearHouse(x, y)) continue;
      let score = y;
      if (water) {
        score = Number.POSITIVE_INFINITY;
        for (let dy = 0; dy <= TOWER_HEIGHT; dy += 1) for (let dx = -1; dx <= TOWER_WIDTH; dx += 1) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < map.width) score = Math.min(score, water[yy * map.width + xx]!);
        }
      }
      candidates.push({ x, y, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  const passableTotal = (() => {
    let count = 0;
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(project, map, x, y)) count += 1;
    return count;
  })();
  for (const at of candidates) {
    const front = { x: at.x, y: at.y + TOWER_HEIGHT };
    const before = reachableCount(project, map, front.x, front.y);
    // 마을의 큰 덩어리에 붙은 자리만 — 숲 속 외딴 빈터에 세운 등대는 걸어서 못 간다.
    if (before * 2 < passableTotal) continue;
    const saved = LIGHTHOUSE_CELLS.map(({ dx, dy }) => {
      const index = (at.y + dy) * map.width + at.x + dx;
      return { index, lower: map.lowerTiles[index]!, upper: map.upperTiles[index]! };
    });
    for (const cell of LIGHTHOUSE_CELLS) {
      const index = (at.y + cell.dy) * map.width + at.x + cell.dx;
      if (cell.lower !== undefined) map.lowerTiles[index] = cell.lower;
      if (cell.upper !== undefined) map.upperTiles[index] = cell.upper;
    }
    const after = reachableCount(project, map, front.x, front.y);
    if (after === before - LIGHTHOUSE_CELLS.length) {
      const placed: PlacedVillageLandmark = { kind, x: at.x, y: at.y, width: TOWER_WIDTH, height: TOWER_HEIGHT, entrance: front };
      return {
        placed,
        warnings: [`등대를 (${at.x},${at.y})에 세웠습니다(2×5, 꼭대기 등불). 입구는 앞칸 (${front.x},${front.y}) — create_transfer_pair 로 등대 맵과 잇습니다.`],
      };
    }
    for (const cell of saved) {
      map.lowerTiles[cell.index] = cell.lower;
      map.upperTiles[cell.index] = cell.upper;
    }
  }
  return { warnings: [`landmark:"${kind}" — 길·집·물을 막지 않고 세울 빈 땅(2×6)이 없어 세우지 않았습니다. 맵을 넓히거나 집 수를 줄입니다.`] };
}
