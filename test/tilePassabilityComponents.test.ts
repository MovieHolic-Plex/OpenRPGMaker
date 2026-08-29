// 통행 성분 색인이 **답을 바꾸지 않는다**는 증거.
//
// 이 최적화의 위험은 하나다: 낡은 색인이 "도달 불가" 라고 우겨서 벽이 열렸는데도 추격을
// 포기하는 것. 그래서 (1) 색인이 기대는 canMove 대칭 정리를 직접 확인하고,
// (2) 색인 있음/없음의 결과를 무작위 맵으로 대조하고, (3) 제자리 타일 수정 뒤에 색인이
// 스스로 낡음을 알아채는지 본다.
import { describe, expect, it } from "vitest";
import { findChasePath, nearestReachableCandidate, type ChasePoint } from "@/player/chaseAi";
import { canMove } from "@/project/collision";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import {
  armTerrainComponents,
  invalidateTilePassabilityComponents,
  terrainMayReach,
} from "@/project/tilePassabilityComponents";
import type { GameMap, Project } from "@/project/types";

const SIZE = 14;

function blankMap(id: string, size = SIZE): GameMap {
  const map = createBlankMap("성분 테스트", size, size);
  map.id = id;
  map.lowerTiles = new Array(size * size).fill(TILE.GRASS);
  map.upperTiles = new Array(size * size).fill(-1);
  return map;
}

function projectWith(map: GameMap): Project {
  const project = createBlankProject();
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 0 };
  return project;
}

/** 결정적 PRNG — 실패를 재현할 수 있어야 한다. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 색인을 전혀 쓰지 않는 참조 도달 판정 — 너비 우선 1회. */
function referenceReachable(project: Project, map: GameMap, from: ChasePoint, to: ChasePoint): boolean {
  if (from.x === to.x && from.y === to.y) return true;
  const width = map.width;
  const seen = new Set<number>([from.y * width + from.x]);
  let frontier: ChasePoint[] = [from];
  while (frontier.length > 0) {
    const next: ChasePoint[] = [];
    for (const point of frontier) {
      for (const delta of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const nx = point.x + delta.x;
        const ny = point.y + delta.y;
        if (nx < 0 || ny < 0 || nx >= width || ny >= map.height) continue;
        const key = ny * width + nx;
        if (seen.has(key)) continue;
        if (!canMove(project, map, point.x, point.y, nx, ny)) continue;
        if (nx === to.x && ny === to.y) return true;
        seen.add(key);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return false;
}

describe("canMove 대칭 — 성분 색인이 기대는 정리", () => {
  it("인접한 모든 칸 쌍에서 canMove(a,b) 와 canMove(b,a) 가 같다", () => {
    const map = blankMap("map_symmetry");
    const project = projectWith(map);
    // 통행 성질이 섞이도록 물·길·풀을 무작위로 깐다.
    const random = mulberry32(20260830);
    const palette = [TILE.GRASS, TILE.WATER, TILE.PATH];
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      map.lowerTiles[index] = palette[Math.floor(random() * palette.length)] as number;
    }
    let checked = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        for (const delta of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
          const nx = x + delta.x;
          const ny = y + delta.y;
          if (nx >= map.width || ny >= map.height) continue;
          checked += 1;
          expect(
            canMove(project, map, x, y, nx, ny),
            `(${x},${y}) ↔ (${nx},${ny}) 의 통행이 방향에 따라 다르다 — 성분 색인 전제가 깨진다`
          ).toBe(canMove(project, map, nx, ny, x, y));
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});

describe("색인이 있어도 결과가 같다 (무작위 맵 대조)", () => {
  it("findChasePath 는 색인 없음/있음에서 같은 경로를 낸다", () => {
    const random = mulberry32(7);
    for (let round = 0; round < 24; round += 1) {
      const map = blankMap(`map_diff_${round}`);
      const project = projectWith(map);
      // 벽 밀도를 올려가며 성분이 여러 개로 갈리게 한다.
      const wallRatio = 0.1 + (round % 6) * 0.09;
      for (let index = 0; index < map.lowerTiles.length; index += 1) {
        if (random() < wallRatio) map.lowerTiles[index] = TILE.WATER;
      }
      const from = { x: 1, y: 1 };
      const to = { x: SIZE - 2, y: SIZE - 2 };
      map.lowerTiles[from.y * SIZE + from.x] = TILE.GRASS;
      map.lowerTiles[to.y * SIZE + to.x] = TILE.GRASS;

      invalidateTilePassabilityComponents(map);
      const cold = findChasePath(project, map, from, to);
      armTerrainComponents(project, map);
      const warm = findChasePath(project, map, from, to);

      expect(warm, `round ${round}: 색인이 경로를 바꿨다`).toEqual(cold);
      // 참조 BFS 와도 도달 여부가 맞아야 한다.
      expect(cold.length > 0, `round ${round}: 도달 여부가 참조 BFS 와 다르다`)
        .toBe(referenceReachable(project, map, from, to));
    }
  });

  it("nearestReachableCandidate 는 색인 없음/있음에서 같은 후보를 낸다", () => {
    const random = mulberry32(99);
    for (let round = 0; round < 24; round += 1) {
      const map = blankMap(`map_cand_${round}`);
      const project = projectWith(map);
      const wallRatio = 0.08 + (round % 7) * 0.08;
      for (let index = 0; index < map.lowerTiles.length; index += 1) {
        if (random() < wallRatio) map.lowerTiles[index] = TILE.WATER;
      }
      const from = { x: 1, y: 1 };
      map.lowerTiles[from.y * SIZE + from.x] = TILE.GRASS;
      const candidates: ChasePoint[] = [];
      for (let y = 0; y < SIZE; y += 1) candidates.push({ x: SIZE - 1, y });
      for (let x = 0; x < SIZE; x += 1) candidates.push({ x, y: SIZE - 1 });

      invalidateTilePassabilityComponents(map);
      const cold = nearestReachableCandidate(project, map, from, candidates);
      armTerrainComponents(project, map);
      const warm = nearestReachableCandidate(project, map, from, candidates);

      expect(warm, `round ${round}: 색인이 후보 선택을 바꿨다`).toEqual(cold);
    }
  });
});

describe("낡은 색인은 스스로 들킨다", () => {
  it("벽을 제자리에서 열면 추격이 다시 경로를 찾는다", () => {
    const map = blankMap("map_wall_open");
    const project = projectWith(map);
    const wallX = 7;
    for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + wallX] = TILE.WATER;
    const from = { x: 2, y: 2 };
    const to = { x: SIZE - 2, y: 2 };

    // 첫 탐색이 실패하면서 색인이 만들어진다.
    expect(findChasePath(project, map, from, to)).toEqual([]);
    expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);

    // applyMapOverrides 와 같은 방식으로 **제자리** 수정 — 배열 identity 는 그대로다.
    const doorIndex = 2 * SIZE + wallX;
    const sameArray = map.lowerTiles;
    map.lowerTiles[doorIndex] = TILE.GRASS;
    expect(map.lowerTiles).toBe(sameArray);

    // 지문이 어긋나므로 색인은 다시 만들어지고 문을 통과하는 경로가 나와야 한다.
    expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(true);
    const path = findChasePath(project, map, from, to);
    expect(path.length, "벽이 열렸는데 추격이 경로를 못 찾았다 — 색인이 낡은 답을 우겼다")
      .toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual(to);
  });

  it("벽을 제자리에서 막으면 도달 불가로 바뀐다", () => {
    const map = blankMap("map_wall_close");
    const project = projectWith(map);
    const from = { x: 2, y: 2 };
    const to = { x: SIZE - 2, y: 2 };
    // 열린 맵에서 한 번 성공시켜 두고, 실패를 유도해 색인을 만든다.
    expect(findChasePath(project, map, from, to).length).toBeGreaterThan(0);
    const wallX = 7;
    for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + wallX] = TILE.WATER;
    expect(findChasePath(project, map, from, to)).toEqual([]);
    // 색인이 생긴 뒤에도 같은 답이어야 한다.
    expect(findChasePath(project, map, from, to)).toEqual([]);
    expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);
  });

  it("invalidateTilePassabilityComponents 는 색인을 버려 낙관 판정으로 되돌린다", () => {
    const map = blankMap("map_invalidate");
    const project = projectWith(map);
    for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + 7] = TILE.WATER;
    const from = { x: 2, y: 2 };
    const to = { x: SIZE - 2, y: 2 };
    armTerrainComponents(project, map);
    expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);
    invalidateTilePassabilityComponents(map);
    // 색인이 없으면 판정을 건너뛴다(낙관) — 결과는 A* 가 낸다.
    expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(true);
    expect(findChasePath(project, map, from, to)).toEqual([]);
  });
});

describe("색인을 쓰지 않는 경로", () => {
  it("색인이 없으면 첫 질의는 판정을 건너뛴다", () => {
    const map = blankMap("map_cold");
    const project = projectWith(map);
    for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + 7] = TILE.WATER;
    expect(terrainMayReach(project, map, 2, 2, SIZE - 2, 2)).toBe(true);
  });

  it("발자국 이동은 색인을 만들지도 쓰지도 않는다", () => {
    const map = blankMap("map_footprint");
    const project = projectWith(map);
    for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + 7] = TILE.WATER;
    const from = { x: 2, y: 2 };
    const to = { x: SIZE - 2, y: 2 };
    const pass = { footprint: { width: 3, height: 3 }, passRows: 1 } as const;

    // 통행 사각이 비대칭이라 성분 전제가 성립하지 않는다 — 색인을 남기면 안 된다.
    expect(findChasePath(project, map, from, to, pass)).toEqual([]);
    expect(
      terrainMayReach(project, map, from.x, from.y, to.x, to.y),
      "발자국 탐색이 색인을 만들었다 — 대칭 전제가 없는 그래프의 답이 섞인다"
    ).toBe(true);
  });
});
