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

describe("짝수 폭은 앵커가 왼쪽 끝이다", () => {
  // 다른 통행 테스트는 전부 홀수 폭(3)이라 이 계약을 못 잡는다. 홀짝이 갈리는 곳은
  // **왼쪽 모서리 하나뿐**이다: left = x − ⌊(width−1)/2⌋ 이므로
  //   폭 2 → left = x      (앵커가 발자국의 왼쪽 끝)
  //   폭 3 → left = x − 1
  // 오른쪽은 폭 2·3 모두 right = x + 1 이라 우향 이동으로는 둘을 구분할 수 없다.
  // 그래서 짝수 폭의 **좌향** 이동만이 추가 커버리지다.
  //
  // 이 테스트가 실패하려면: left 를 x − ⌊width/2⌋ 로 잡는 흔한 오구현이면 폭 2 의
  // left 가 x−1 로 밀려 선행 칸이 (4,5) 가 되고, 검사 대상이 (4,5)→(3,5) 로 바뀌어
  // 열린 칸을 보게 되므로 첫 단정이 true 로 뒤집힌다. 폭 3 에서는 그 오구현도
  // left = 4 로 같은 값이 나오기 때문에 기존 테스트가 통과해 버린다.
  it("폭 2 는 왼쪽으로 x, 오른쪽으로 x+1 까지만 뻗는다", () => {
    const { project, map } = scene();
    const fp = { width: 2, height: 1 };
    // (5,5) 에 선 폭 2 의 발자국은 (5,5) (6,5) — 왼쪽 끝이 앵커다.
    setLower(map, 4, 5, TILE.WALL); // 왼쪽 선행 칸 (5,5) 의 목적지
    setLower(map, 7, 5, TILE.WALL); // 오른쪽 선행 칸 (6,5) 의 목적지

    expect(canMoveFootprint(project, map, 5, 5, fp, 4, 5), "좌향 — 앵커 칸이 선행이다").toBe(false);
    expect(canMoveFootprint(project, map, 5, 5, fp, 6, 5), "우향 — (6,5) 가 선행이다").toBe(false);

    // 벽이 한 칸 더 밖에 있으면 양쪽 다 열린다 — 발자국이 그보다 넓지 않다는 뜻이다.
    const open = scene();
    setLower(open.map, 3, 5, TILE.WALL);
    setLower(open.map, 8, 5, TILE.WALL);
    expect(canMoveFootprint(open.project, open.map, 5, 5, fp, 4, 5), "좌향 여유").toBe(true);
    expect(canMoveFootprint(open.project, open.map, 5, 5, fp, 6, 5), "우향 여유").toBe(true);
  });

  it("폭 4 도 같은 규칙이다 — 왼쪽 1칸, 오른쪽 2칸", () => {
    const { project, map } = scene();
    // left = 5 − ⌊3/2⌋ = 4, right = 4 + 3 = 7. 발자국 (4,5)..(7,5).
    const fp = { width: 4, height: 1 };
    setLower(map, 3, 5, TILE.WALL); // 좌향 선행 칸 (4,5) 의 목적지
    expect(canMoveFootprint(project, map, 5, 5, fp, 4, 5), "좌향").toBe(false);

    const right = scene();
    setLower(right.map, 8, 5, TILE.WALL); // 우향 선행 칸 (7,5) 의 목적지
    expect(canMoveFootprint(right.project, right.map, 5, 5, fp, 6, 5), "우향").toBe(false);
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

describe("비정규 발자국이 벽을 통과하지 않는다", () => {
  // 검사 없이 통과하는 fail-open 은 통행 판정에서 가장 나쁜 실패 방향이다.
  // 이 테스트가 실패하려면: footprintBounds 가 축을 1 로 굳히지 않으면 폭 0 의
  // 선행 모서리가 빈 배열이 되고 아래 단정이 true 로 뒤집힌다.
  it("폭 0 은 1x1 처럼 막힌다", () => {
    const { project, map } = scene();
    setLower(map, 6, 5, TILE.WALL);
    expect(canMove(project, map, 5, 5, 6, 5), "기준: 1x1 은 막힌다").toBe(false);
    expect(canMoveFootprint(project, map, 5, 5, { width: 0, height: 0 }, 6, 5)).toBe(false);
    expect(canMoveFootprint(project, map, 5, 5, { width: 0, height: 3 }, 6, 5)).toBe(false);
  });
});

describe("대각에서는 canMove 와 갈린다 — 주석이 약속하는 범위", () => {
  // canMoveFootprint 의 항등 주장은 **직교 이동 한정**이다. 대각은 H·V 로 분해하므로
  // 두 경로가 다 막히면 false 인데, canMove 는 dx 가 0 이 아니면 가로만 보고 true 를 낸다.
  // 지금 canMove 에 대각을 넘기는 호출부는 없지만, 2차가 그 자리들을 갈아끼울 때
  // 이 차이를 모르고 치환하면 대각 통행이 조용히 좁아진다.
  it("1x1 대각에서 canMove 는 열고 canMoveFootprint 는 닫는다", () => {
    const { project, map } = scene();
    setLower(map, 6, 5, TILE.WALL); // 가로 먼저
    setLower(map, 5, 6, TILE.WALL); // 세로 먼저
    expect(canMove(project, map, 5, 5, 6, 6), "canMove 는 가로 한 번만 본다").toBe(true);
    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 6), "이쪽은 두 경로를 본다")
      .toBe(false);
  });
});
