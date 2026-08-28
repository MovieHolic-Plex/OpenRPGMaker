import { describe, expect, it } from "vitest";
import {
  addPart,
  cellAtPoint,
  normalizeDragRect,
  paintCell,
  removePart,
  resizeKit,
  tileAt,
  updatePart,
} from "@/editor/harnessSuggestion/structureKitRasterModel";
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

describe("resizeKit", () => {
  function kitWithParts(): SectionStructureKitDef {
    return {
      ...kit3x3(),
      parts: [
        { id: "p_inside", kind: "anchor", dx: 0, dy: 0, w: 1, h: 1 },
        { id: "p_straddle", kind: "window", dx: 1, dy: 1, w: 2, h: 2 },
        { id: "p_outside", kind: "sign", dx: 2, dy: 2, w: 1, h: 1 },
      ],
    };
  }

  it("늘리면 새 칸이 EMPTY 로 채워진다", () => {
    const result = resizeKit(kit3x3(), 5, 4);
    expect(result.kit.width).toBe(5);
    expect(result.kit.height).toBe(4);
    expect(result.kit.rows).toHaveLength(4);
    expect(result.kit.rows[0]!.tiles).toHaveLength(5);
    expect(tileAt(result.kit, 4, 0, "lower")).toBe(TILE.EMPTY);
    expect(tileAt(result.kit, 0, 3, "lower")).toBe(TILE.EMPTY);
    // 기존 내용은 남는다
    expect(tileAt(result.kit, 1, 1, "lower")).toBe(116);
    expect(result.clamped).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it("줄이면 잘린 칸이 사라진다", () => {
    const result = resizeKit(kit3x3(), 2, 2);
    expect(result.kit.width).toBe(2);
    expect(result.kit.rows).toHaveLength(2);
    expect(result.kit.rows[0]!.tiles).toHaveLength(2);
    expect(tileAt(result.kit, 1, 1, "lower")).toBe(116);
  });

  it("줄일 때 경계에 걸친 부위는 클램프하고 완전히 밖인 부위는 지운다", () => {
    const result = resizeKit(kitWithParts(), 2, 2);
    const ids = (result.kit.parts ?? []).map((part) => part.id);
    expect(ids).toContain("p_inside");
    expect(ids).toContain("p_straddle");
    expect(ids).not.toContain("p_outside");

    const straddle = result.kit.parts!.find((part) => part.id === "p_straddle")!;
    expect(straddle.dx).toBe(1);
    expect(straddle.dy).toBe(1);
    expect(straddle.w).toBe(1); // 1+2=3 → 2 로 클램프
    expect(straddle.h).toBe(1);

    expect(result.clamped).toBe(1);
    expect(result.dropped).toBe(1);
  });

  it("1칸 미만으로는 줄지 않는다", () => {
    const result = resizeKit(kit3x3(), 0, -2);
    expect(result.kit.width).toBe(1);
    expect(result.kit.height).toBe(1);
  });

  it("크기가 그대로면 킷을 그대로 돌려준다", () => {
    const original = kit3x3();
    const result = resizeKit(original, 3, 3);
    expect(result.kit).toBe(original);
    expect(result.clamped).toBe(0);
    expect(result.dropped).toBe(0);
  });
});

describe("normalizeDragRect", () => {
  it("어느 방향으로 끌어도 좌상단·크기로 정규화한다", () => {
    expect(normalizeDragRect({ cx: 2, cy: 3 }, { cx: 0, cy: 1 }))
      .toEqual({ dx: 0, dy: 1, w: 3, h: 3 });
  });

  it("한 칸 클릭은 1×1 이다", () => {
    expect(normalizeDragRect({ cx: 1, cy: 1 }, { cx: 1, cy: 1 }))
      .toEqual({ dx: 1, dy: 1, w: 1, h: 1 });
  });
});

describe("부위 CRUD", () => {
  it("부위를 더한다", () => {
    const next = addPart(kit3x3(), { dx: 1, dy: 0, w: 1, h: 3 }, "entrance", "p_new");
    expect(next.parts).toHaveLength(1);
    expect(next.parts![0]).toEqual({ id: "p_new", kind: "entrance", dx: 1, dy: 0, w: 1, h: 3 });
  });

  it("킷 경계를 넘는 부위는 클램프해서 더한다", () => {
    const next = addPart(kit3x3(), { dx: 2, dy: 2, w: 5, h: 5 }, "sign", "p_big");
    expect(next.parts![0]!.w).toBe(1);
    expect(next.parts![0]!.h).toBe(1);
  });

  it("부위를 고친다", () => {
    const withPart = addPart(kit3x3(), { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1");
    const next = updatePart(withPart, "p1", { kind: "window", note: "남쪽 창" });
    expect(next.parts![0]!.kind).toBe("window");
    expect(next.parts![0]!.note).toBe("남쪽 창");
    expect(next.parts![0]!.dx).toBe(0);
  });

  it("없는 부위를 고치면 킷을 그대로 돌려준다", () => {
    const withPart = addPart(kit3x3(), { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1");
    expect(updatePart(withPart, "nope", { kind: "sign" })).toBe(withPart);
  });

  it("부위를 지운다", () => {
    const withParts = addPart(
      addPart(kit3x3(), { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1"),
      { dx: 2, dy: 2, w: 1, h: 1 }, "sign", "p2",
    );
    const next = removePart(withParts, "p1");
    expect(next.parts).toHaveLength(1);
    expect(next.parts![0]!.id).toBe("p2");
  });

  it("원본을 변형하지 않는다", () => {
    const original = kit3x3();
    addPart(original, { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1");
    expect(original.parts).toBeUndefined();
  });
});
