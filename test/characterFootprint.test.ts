// test/characterFootprint.test.ts
// 발밑 앵커 발자국 프리미티브 단위 테스트.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §1.

import { describe, expect, it } from "vitest";
import {
  CHARACTER_FOOTPRINT_AXIS_MAX,
  UNIT_FOOTPRINT,
  footprintBounds,
  characterFootprintCells,
  nearestCellInRect,
  footprintContains,
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  normalizePassRows,
  passageBounds,
  pointRect,
  rectsOverlap,
} from "@/project/footprint";

describe("1x1 항등성 — 이 설계의 안전줄", () => {
  it("1x1 bounds 는 그 칸 자신이다", () => {
    expect(footprintBounds(5, 7, UNIT_FOOTPRINT)).toEqual({ left: 5, right: 5, top: 7, bottom: 7 });
  });

  it("1x1 bounds 는 pointRect 와 같다", () => {
    for (let x = -3; x <= 3; x += 1) {
      for (let y = -3; y <= 3; y += 1) {
        expect(footprintBounds(x, y, UNIT_FOOTPRINT)).toEqual(pointRect(x, y));
      }
    }
  });

  it("1x1 contains 는 그 칸에서만 참이다", () => {
    expect(footprintContains(5, 7, UNIT_FOOTPRINT, 5, 7)).toBe(true);
    expect(footprintContains(5, 7, UNIT_FOOTPRINT, 4, 7)).toBe(false);
    expect(footprintContains(5, 7, UNIT_FOOTPRINT, 5, 6)).toBe(false);
  });

  it("1x1 cells 는 한 칸이다", () => {
    expect(characterFootprintCells(5, 7, UNIT_FOOTPRINT)).toEqual([{ x: 5, y: 7 }]);
  });
});

describe("footprintBounds — 발밑 앵커", () => {
  it("2x2 는 오른쪽·위로 자라고 앵커가 좌하단이다", () => {
    expect(footprintBounds(5, 7, { width: 2, height: 2 })).toEqual({ left: 5, right: 6, top: 6, bottom: 7 });
  });

  it("3x3 은 앵커가 하단 중앙이다", () => {
    expect(footprintBounds(5, 7, { width: 3, height: 3 })).toEqual({ left: 4, right: 6, top: 5, bottom: 7 });
  });

  it("짝수 폭은 왼쪽으로 치우친다 — 앵커 왼쪽 칸 수가 오른쪽보다 적다", () => {
    const b = footprintBounds(5, 7, { width: 4, height: 1 });
    expect(b.left).toBe(4);
    expect(b.right).toBe(7);
    expect(5 - b.left).toBeLessThan(b.right - 5);
  });

  it("하단 행은 언제나 y 다", () => {
    for (const height of [1, 2, 3, 5, 8]) {
      expect(footprintBounds(5, 7, { width: 1, height }).bottom).toBe(7);
    }
  });
});

describe("rectsOverlap — AABB", () => {
  it("맞닿기만 해도 겹침이다(포함 경계)", () => {
    expect(rectsOverlap(pointRect(1, 1), pointRect(1, 1))).toBe(true);
  });

  it("한 칸 떨어지면 겹치지 않는다", () => {
    expect(rectsOverlap(pointRect(1, 1), pointRect(2, 1))).toBe(false);
    expect(rectsOverlap(pointRect(1, 1), pointRect(1, 2))).toBe(false);
  });

  it("2x2 발자국은 자기 네 칸 전부와 겹친다", () => {
    const fp = { width: 2, height: 2 };
    const bounds = footprintBounds(5, 7, fp);
    for (const cell of characterFootprintCells(5, 7, fp)) {
      expect(rectsOverlap(bounds, pointRect(cell.x, cell.y))).toBe(true);
    }
    expect(characterFootprintCells(5, 7, fp)).toHaveLength(4);
  });

  it("교차하는 큰 사각끼리도 겹침을 잡는다", () => {
    expect(rectsOverlap({ left: 0, right: 5, top: 0, bottom: 1 }, { left: 2, right: 3, top: -4, bottom: 9 })).toBe(true);
  });
});

describe("normalizeCharacterFootprint — 직렬화 방어", () => {
  it("잘못된 값은 1x1 로 떨어진다", () => {
    expect(normalizeCharacterFootprint(undefined)).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint(null)).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint("2x2")).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({})).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({ width: 0, height: -3 })).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({ width: 1.5, height: 2.5 })).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({ width: Number.NaN, height: 2 })).toEqual({ width: 1, height: 2 });
  });

  it("축 상한으로 클램프한다", () => {
    expect(normalizeCharacterFootprint({ width: 99, height: 99 })).toEqual({
      width: CHARACTER_FOOTPRINT_AXIS_MAX,
      height: CHARACTER_FOOTPRINT_AXIS_MAX,
    });
  });

  it("정상 값은 그대로 통과한다", () => {
    expect(normalizeCharacterFootprint({ width: 3, height: 2 })).toEqual({ width: 3, height: 2 });
  });
});

describe("normalizeCharacterScale", () => {
  it("생략·비정상은 1 이다", () => {
    expect(normalizeCharacterScale(undefined)).toBe(1);
    expect(normalizeCharacterScale("2")).toBe(1);
    expect(normalizeCharacterScale(Number.NaN)).toBe(1);
    expect(normalizeCharacterScale(0)).toBe(1);
    expect(normalizeCharacterScale(-2)).toBe(1);
  });

  it("범위 안 값은 그대로, 밖은 클램프한다", () => {
    expect(normalizeCharacterScale(2)).toBe(2);
    expect(normalizeCharacterScale(1.5)).toBe(1.5);
    expect(normalizeCharacterScale(99)).toBe(8);
    expect(normalizeCharacterScale(0.01)).toBe(0.25);
  });
});

describe("nearestCellInRect — 사각으로 올린 히트테스트의 소비자용", () => {
  // 사각으로 이벤트를 **찾은** 다음 그 결과로 방향·거리를 계산하는 곳이 있다.
  // 거기서 앵커 좌표를 그대로 쓰면 틀린다: 앵커는 발자국의 최근접 칸이 아니다.
  it("사각 안의 점은 그대로 둔다", () => {
    const rect = footprintBounds(15, 18, { width: 2, height: 2 }); // 15..16 × 17..18
    expect(nearestCellInRect(rect, 16, 18)).toEqual({ x: 16, y: 18 });
    expect(nearestCellInRect(rect, 15, 17)).toEqual({ x: 15, y: 17 });
  });

  it("사각 밖의 점은 최근접 모서리 칸으로 끌어당긴다", () => {
    const rect = footprintBounds(15, 18, { width: 2, height: 2 });
    expect(nearestCellInRect(rect, 16, 19), "정남향 아래").toEqual({ x: 16, y: 18 });
    expect(nearestCellInRect(rect, 20, 12), "우상 대각 멀리").toEqual({ x: 16, y: 17 });
    expect(nearestCellInRect(rect, 3, 30), "좌하 대각 멀리").toEqual({ x: 15, y: 18 });
  });

  it("1x1 에서는 항등이다 — 앵커가 곧 유일한 칸이다", () => {
    const rect = footprintBounds(5, 7, UNIT_FOOTPRINT);
    for (const [px, py] of [[5, 7], [4, 7], [5, 9], [99, -3]]) {
      expect(nearestCellInRect(rect, px, py), `(${px},${py})`).toEqual({ x: 5, y: 7 });
    }
  });
});

describe("비정규 발자국은 fail-open 하지 않는다", () => {
  // 정규화(normalizeCharacterFootprint)는 runtimeEventView 한 곳에만 있고
  // footprintBounds 는 원시 CharacterFootprint 를 받는다. 축이 1 미만이면
  // left > right 인 역사각이 되어 파생 함수들의 셀 루프가 0회 돌고, 통행 검사가
  // **한 번도 실행되지 않은 채 통과**한다. 통행 판정이 열리는 쪽으로 실패하는 것은
  // 벽 통과로 직결되므로 1x1 로 굳혀 막는다.
  //
  // 이 테스트가 실패하려면: footprintBounds 의 safeAxis 를 지우면 폭 0 의 bounds 가
  // { left: 5, right: 4 } 로 뒤집히고 아래 첫 단정이 깨진다.
  it("폭·높이 0 은 1 로 굳어 역사각이 되지 않는다", () => {
    expect(footprintBounds(5, 7, { width: 0, height: 0 })).toEqual(
      footprintBounds(5, 7, UNIT_FOOTPRINT)
    );
    for (const fp of [{ width: 0, height: 3 }, { width: 3, height: 0 }, { width: -2, height: -2 }]) {
      const rect = footprintBounds(5, 7, fp);
      expect(rect.left <= rect.right, `${JSON.stringify(fp)} 의 가로`).toBe(true);
      expect(rect.top <= rect.bottom, `${JSON.stringify(fp)} 의 세로`).toBe(true);
    }
  });

  it("역사각이 안 되므로 셀 순회가 빈 배열이 되지 않는다", () => {
    // 빈 배열이면 canMoveFootprint 의 선행 모서리 루프도 0회 돌아 무조건 true 다.
    expect(characterFootprintCells(5, 7, { width: 0, height: 0 })).toEqual([{ x: 5, y: 7 }]);
    expect(characterFootprintCells(5, 7, { width: Number.NaN, height: 2 })).toHaveLength(2);
  });

  it("소수 축은 내림한다 — 사각 좌표는 정수여야 한다", () => {
    expect(footprintBounds(5, 7, { width: 2.9, height: 1 })).toEqual(
      footprintBounds(5, 7, { width: 2, height: 1 })
    );
  });
});

// 2차 스펙 §1 — 몸 사각과 통행 사각의 분리.
describe("passageBounds — 통행 사각은 몸 사각의 하단 부분사각", () => {
  // 항등: passRows 가 몸 높이와 같으면(= 생략 시 정규화 기본값) 두 사각이 같다.
  // 이 항등이 깨지면 passRows 없는 기존 프로젝트의 통행 동작이 바뀐다.
  it("행 수가 몸 높이와 같으면 몸 사각과 정확히 같다", () => {
    for (const height of [1, 2, 3, CHARACTER_FOOTPRINT_AXIS_MAX]) {
      const fp = { width: 3, height };
      expect(passageBounds(5, 7, fp, height), `높이 ${height}`).toEqual(footprintBounds(5, 7, fp));
    }
  });

  it("행 수 1 이면 발밑 한 줄이다 — 좌우 폭은 몸과 같다", () => {
    const rect = passageBounds(5, 7, { width: 3, height: 3 }, 1);
    expect(rect).toEqual({ left: 4, right: 6, top: 7, bottom: 7 });
  });

  it("하단에 고정된다 — top 만 올라오고 bottom·left·right 는 몸과 같다", () => {
    const fp = { width: 4, height: 4 };
    const body = footprintBounds(9, 12, fp);
    for (const rows of [1, 2, 3, 4]) {
      const pass = passageBounds(9, 12, fp, rows);
      expect(pass.bottom, `${rows}행의 bottom`).toBe(body.bottom);
      expect(pass.left, `${rows}행의 left`).toBe(body.left);
      expect(pass.right, `${rows}행의 right`).toBe(body.right);
      expect(pass.top, `${rows}행의 top`).toBe(body.bottom - (rows - 1));
    }
  });

  // fail-closed: 행 수가 적을수록 통행이 열린다. 비정규 값은 다 막는 쪽으로 굳어야 한다.
  //
  // 이 테스트가 실패하려면: passageBounds 의 safePassRows 를 지우면 rows=0 이
  // top = bottom + 1 인 역사각을 만들고 첫 단정이 깨진다.
  it("비정규 행 수는 몸 전체로 올라간다 — fail-closed", () => {
    const fp = { width: 2, height: 3 };
    const body = footprintBounds(5, 7, fp);
    for (const rows of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(passageBounds(5, 7, fp, rows), `행 수 ${rows}`).toEqual(body);
    }
  });

  it("몸 높이를 넘는 행 수는 몸 높이로 클램프된다", () => {
    const fp = { width: 2, height: 2 };
    expect(passageBounds(5, 7, fp, 99)).toEqual(footprintBounds(5, 7, fp));
  });

  it("역사각이 되지 않으므로 통행 검사가 빈손으로 통과하지 않는다", () => {
    for (const rows of [0, -5, Number.NaN, 2.5]) {
      const rect = passageBounds(5, 7, { width: 3, height: 3 }, rows);
      expect(rect.top <= rect.bottom, `행 수 ${rows}`).toBe(true);
      expect(rect.left <= rect.right, `행 수 ${rows}`).toBe(true);
    }
  });
});

describe("normalizePassRows — 직렬화 방어", () => {
  it("생략·비정규는 몸 높이 전체다 — 그게 항등 기본값이다", () => {
    for (const bad of [undefined, null, "2", {}, [], Number.NaN, 0, -3, 2.5, true]) {
      expect(normalizePassRows(bad, 3), `${JSON.stringify(bad) ?? "undefined"}`).toBe(3);
    }
  });

  it("범위 안의 정수는 그대로다", () => {
    expect(normalizePassRows(1, 3)).toBe(1);
    expect(normalizePassRows(2, 3)).toBe(2);
  });

  it("몸 높이를 넘으면 몸 높이로 클램프한다", () => {
    expect(normalizePassRows(9, 3)).toBe(3);
  });

  it("몸 높이가 비정규면 clampAxis 와 같은 경계로 굳는다", () => {
    expect(normalizePassRows(5, 0)).toBe(1);
    expect(normalizePassRows(5, Number.NaN)).toBe(1);
    // 몸 높이가 상한을 넘으면 상한이 천장이 된다. 범위 안의 5 는 그대로 5 다.
    expect(normalizePassRows(5, CHARACTER_FOOTPRINT_AXIS_MAX + 10)).toBe(5);
    expect(normalizePassRows(99, CHARACTER_FOOTPRINT_AXIS_MAX + 10)).toBe(CHARACTER_FOOTPRINT_AXIS_MAX);
  });
});
