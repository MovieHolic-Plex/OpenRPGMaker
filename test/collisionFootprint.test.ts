// test/collisionFootprint.test.ts
// 발자국 지형 통행 판정 — 선행 모서리만 검사한다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3.

import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { canMove, canMoveFootprint } from "@/project/collision";
import { UNIT_FOOTPRINT } from "@/project/footprint";
import type { GameMap, Project } from "@/project/types";

const WIDE = 20;
const TALL = 15;

function scene(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("발자국 시험장", WIDE, TALL, project.maps[project.startMapId].tilesetId);
  project.maps[map.id] = map;
  return { project, map };
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
}

describe("canMoveFootprint(1x1) 은 canMove 와 완전히 같다", () => {
  it("벽이 흩어진 맵에서 모든 칸 · 4방향이 일치한다", () => {
    const { project, map } = scene();
    for (const [x, y] of [[3, 3], [4, 7], [10, 2], [11, 11], [17, 8]]) setLower(map, x, y, TILE.WALL);
    for (const [x, y] of [[6, 6], [12, 4]]) setLower(map, x, y, TILE.WATER);

    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let compared = 0;
    for (let y = 0; y < TALL; y += 1) {
      for (let x = 0; x < WIDE; x += 1) {
        for (const [dx, dy] of deltas) {
          const expected = canMove(project, map, x, y, x + dx, y + dy);
          const actual = canMoveFootprint(project, map, x, y, UNIT_FOOTPRINT, x + dx, y + dy);
          expect(actual, `(${x},${y}) → (${x + dx},${y + dy})`).toBe(expected);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(WIDE * TALL * 4);
  });
});

describe("선행 모서리 검사", () => {
  it("3x3 은 1x1 이 안 닿는 벽에 막힌다", () => {
    const { project, map } = scene();
    // (5,5) 에 선 3x3 의 발자국은 x 4..6, y 3..5.
    // 오른쪽 한 칸 이동의 선행 모서리는 x=6 열(y 3..5)이고 목적 칸은 x=7 열이다.
    setLower(map, 7, 3, TILE.WALL);

    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 5)).toBe(true);
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 6, 5)).toBe(false);
  });

  it("선행 모서리가 아닌 칸의 벽은 이동을 막지 않는다", () => {
    const { project, map } = scene();
    // 왼쪽으로 갈 때 x=7 열(오른쪽 끝 바깥)은 선행 모서리가 아니다.
    setLower(map, 7, 3, TILE.WALL);
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 4, 5)).toBe(true);
  });

  it("세로 이동은 위·아래 행이 선행 모서리다", () => {
    const { project, map } = scene();
    // (5,5) 3x3 → 위로: 선행 모서리는 top 행 y=3, 목적은 y=2.
    setLower(map, 4, 2, TILE.WALL);
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 5, 4)).toBe(false);
    // 아래로: 선행 모서리는 bottom 행 y=5, 목적은 y=6. 위쪽 벽은 무관하다.
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 5, 6)).toBe(true);
  });
});

describe("좁은 통로", () => {
  it("3칸 높이는 2칸 통로에 못 들어가고 1칸 높이는 들어간다", () => {
    const { project, map } = scene();
    // y=3 과 y=6 을 x=8..14 구간에서 막아 y=4,5 두 칸짜리 통로를 만든다.
    for (let x = 8; x <= 14; x += 1) {
      setLower(map, x, 3, TILE.WALL);
      setLower(map, x, 6, TILE.WALL);
    }
    // 3x3 이 (6,5) 에 서 있다 — 발자국 x 5..7, y 3..5 는 전부 통로 밖이라 유효한 출발이다.
    expect(canMoveFootprint(project, map, 6, 5, { width: 3, height: 3 }, 7, 5)).toBe(false);
    // 1x1 은 통로로 들어간다.
    expect(canMoveFootprint(project, map, 7, 5, UNIT_FOOTPRINT, 8, 5)).toBe(true);
  });
});

describe("경계 조건", () => {
  it("같은 칸으로의 이동은 false 다", () => {
    const { project, map } = scene();
    expect(canMoveFootprint(project, map, 5, 5, { width: 2, height: 2 }, 5, 5)).toBe(false);
  });

  it("발자국이 맵 밖으로 나가면 막힌다", () => {
    const { project, map } = scene();
    // (0,5) 에 선 3x3 의 left 는 -1 이라 왼쪽 이동은 경계를 벗어난다.
    expect(canMoveFootprint(project, map, 0, 5, { width: 3, height: 3 }, -1, 5)).toBe(false);
  });

  it("대각은 H·V 중 한 경로만 열려도 통과한다", () => {
    const { project, map } = scene();
    setLower(map, 6, 5, TILE.WALL); // 가로 먼저 가는 경로를 막는다
    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 6)).toBe(true);
    setLower(map, 5, 6, TILE.WALL); // 세로 먼저 가는 경로도 막는다
    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 6)).toBe(false);
  });
});
