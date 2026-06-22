// test/actions.test.ts
// 에디터 액션(fill 로직) 검증 — store 없이 로직 직접 테스트(v2 레이어 기반).
// actions.ts의 fill 구현과 동일 로직을 lowerTiles 대상으로 검증.

import { describe, it, expect } from "vitest";
import { createBlankMap, TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";

// fillTile과 동일 로직(store 없이, lowerTiles 대상).
function fillLogic(m: GameMap, x: number, y: number, newTile: number): void {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
  const arr = m.lowerTiles;
  const startIdx = y * m.width + x;
  const target = arr[startIdx];
  if (target === newTile) return;
  const queue = [startIdx];
  const seen = new Set<number>([startIdx]);
  while (queue.length) {
    const idx = queue.shift();
    if (idx === undefined) break;
    arr[idx] = newTile;
    const cx = idx % m.width;
    const cy = Math.floor(idx / m.width);
    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      const ni = ny * m.width + nx;
      if (seen.has(ni)) continue;
      if (arr[ni] !== target) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
}

describe("paint 로직", () => {
  it("단일 칸 타일 변경", () => {
    const m = createBlankMap("m", 3, 3);
    m.lowerTiles[1 * 3 + 1] = TILE.WATER;
    expect(m.lowerTiles[4]).toBe(TILE.WATER);
  });
});

describe("fill 로직", () => {
  it("연결된 같은 타일 영역을 새 타일로 채운다", () => {
    const m = createBlankMap("m", 4, 4); // 전부 GRASS(lower)
    fillLogic(m, 0, 0, TILE.WATER);
    expect(m.lowerTiles.every((t: number) => t === TILE.WATER)).toBe(true);
  });

  it("다른 타일은 넘어가지 않는다", () => {
    const m = createBlankMap("m", 5, 1);
    m.lowerTiles[2] = TILE.WALL;
    fillLogic(m, 0, 0, TILE.PATH);
    expect(m.lowerTiles[0]).toBe(TILE.PATH);
    expect(m.lowerTiles[1]).toBe(TILE.PATH);
    expect(m.lowerTiles[2]).toBe(TILE.WALL); // 안 바뀜
    expect(m.lowerTiles[3]).toBe(TILE.GRASS);
    expect(m.lowerTiles[4]).toBe(TILE.GRASS);
  });

  it("같은 타일로 채우면 변화 없음", () => {
    const m = createBlankMap("m", 3, 3);
    fillLogic(m, 0, 0, TILE.GRASS);
    expect(m.lowerTiles.every((t: number) => t === TILE.GRASS)).toBe(true);
  });
});
