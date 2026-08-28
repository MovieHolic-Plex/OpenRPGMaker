// test/characterFootprint.test.ts
// 발밑 앵커 발자국 프리미티브 단위 테스트.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §1.

import { describe, expect, it } from "vitest";
import {
  CHARACTER_FOOTPRINT_AXIS_MAX,
  UNIT_FOOTPRINT,
  footprintBounds,
  footprintCells,
  footprintContains,
  normalizeCharacterFootprint,
  normalizeCharacterScale,
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
    expect(footprintCells(5, 7, UNIT_FOOTPRINT)).toEqual([{ x: 5, y: 7 }]);
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
    for (const cell of footprintCells(5, 7, fp)) {
      expect(rectsOverlap(bounds, pointRect(cell.x, cell.y))).toBe(true);
    }
    expect(footprintCells(5, 7, fp)).toHaveLength(4);
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
