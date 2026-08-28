import { describe, expect, it } from "vitest";
import { cellAtPoint, paintCell, tileAt } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { TILE } from "@/project/defaults/constants";
import type { SectionStructureKitDef } from "@/project/types";

function kit3x3(): SectionStructureKitDef {
  return {
    id: "kit_test",
    kind: "section",
    name: "테스트",
    width: 3,
    height: 3,
    rows: [
      { tiles: [240, 240, 240] },
      { tiles: [240, 116, 240] },
      { tiles: [240, 240, 240] },
    ],
    learnedFrom: "db-authored",
  };
}

describe("cellAtPoint", () => {
  // rect·scale 을 인자로 받는다 — fakeDom 의 getBoundingClientRect() 는 전부 0 이라
  // 함수 내부에서 DOM 을 읽으면 유닛 테스트가 무의미해진다.
  const rect = { left: 100, top: 50 };
  const size = { width: 3, height: 3 };

  it("좌상단 칸을 집는다", () => {
    // scale 3 → 칸 하나가 48px
    expect(cellAtPoint(rect, 3, 100, 50, size)).toEqual({ cx: 0, cy: 0 });
    expect(cellAtPoint(rect, 3, 147, 97, size)).toEqual({ cx: 0, cy: 0 });
  });

  it("가운데 칸을 집는다", () => {
    expect(cellAtPoint(rect, 3, 148, 98, size)).toEqual({ cx: 1, cy: 1 });
  });

  it("경계 밖은 null 을 준다", () => {
    expect(cellAtPoint(rect, 3, 99, 50, size)).toBeNull();
    expect(cellAtPoint(rect, 3, 100, 49, size)).toBeNull();
    expect(cellAtPoint(rect, 3, 244, 50, size)).toBeNull(); // cx 3 = 범위 밖
    expect(cellAtPoint(rect, 3, 100, 194, size)).toBeNull(); // cy 3 = 범위 밖
  });

  it("scale 1 에서도 맞는다", () => {
    expect(cellAtPoint(rect, 1, 116, 66, size)).toEqual({ cx: 1, cy: 1 });
  });
});

describe("paintCell", () => {
  it("하층 타일을 바꾼다", () => {
    const next = paintCell(kit3x3(), 0, 0, "lower", 421);
    expect(tileAt(next, 0, 0, "lower")).toBe(421);
    expect(tileAt(next, 1, 1, "lower")).toBe(116);
  });

  it("원본을 변형하지 않는다", () => {
    const original = kit3x3();
    paintCell(original, 0, 0, "lower", 421);
    expect(tileAt(original, 0, 0, "lower")).toBe(240);
  });

  it("upperTiles 가 없던 행에 상층을 칠하면 배열이 생긴다", () => {
    const next = paintCell(kit3x3(), 2, 0, "upper", 208);
    expect(tileAt(next, 2, 0, "upper")).toBe(208);
    expect(tileAt(next, 0, 0, "upper")).toBe(TILE.EMPTY);
    expect(next.rows[0]!.upperTiles).toHaveLength(3);
  });

  it("경계 밖 좌표는 킷을 그대로 돌려준다", () => {
    const original = kit3x3();
    expect(paintCell(original, 3, 0, "lower", 421)).toBe(original);
    expect(paintCell(original, -1, 0, "lower", 421)).toBe(original);
    expect(paintCell(original, 0, 3, "lower", 421)).toBe(original);
  });

  it("지우개는 EMPTY 를 칠하는 것과 같다", () => {
    const next = paintCell(kit3x3(), 1, 1, "lower", TILE.EMPTY);
    expect(tileAt(next, 1, 1, "lower")).toBe(TILE.EMPTY);
  });
});
