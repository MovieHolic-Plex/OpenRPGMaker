import { describe, expect, it } from "vitest";
import {
  addPart,
  bakeCellsToRows,
  cellHintAt,
  bakeInteriorObject,
  bakeStructureKit,
  cellAtPoint,
  copyName,
  normalizeDragRect,
  paintCell,
  removeCellHint,
  removePart,
  resizeKit,
  setCellHint,
  tileAt,
  updatePart,
} from "@/editor/harnessSuggestion/structureKitRasterModel";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
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

describe("bakeCellsToRows", () => {
  it("셀 목록을 행렬로 편다", () => {
    const rows = bakeCellsToRows(
      [
        { dx: 0, dy: 0, layer: "lower", tile: 240 },
        { dx: 1, dy: 0, layer: "upper", tile: 208 },
        { dx: 1, dy: 1, layer: "lower", tile: 116 },
      ],
      2,
      2,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.tiles).toEqual([240, TILE.EMPTY]);
    expect(rows[0]!.upperTiles).toEqual([TILE.EMPTY, 208]);
    // 상층이 빈 행은 upperTiles 를 기록하지 않는다 — 기존 직렬화 규약과 같다.
    expect(rows[1]!.tiles).toEqual([TILE.EMPTY, 116]);
    expect(rows[1]!.upperTiles).toBeUndefined();
  });
});

describe("bakeStructureKit", () => {
  it("section 킷을 굳히고 id·이름을 새로 붙인다", () => {
    const baked = bakeStructureKit(kit3x3(), "kit_baked", "통나무집 사본");
    expect(baked.kind).toBe("section");
    expect(baked.id).toBe("kit_baked");
    expect(baked.name).toBe("통나무집 사본");
    expect(baked.learnedFrom).toBe("db-authored");
    expect(baked.width).toBeGreaterThan(0);
    expect(baked.rows).toHaveLength(baked.height);
    expect(baked.rows[0]!.tiles).toHaveLength(baked.width);
    // 실제 타일이 하나라도 들어 있어야 한다 — 빈 껍데기를 구우면 의미가 없다.
    const painted = baked.rows.some((row) => row.tiles.some((tile) => tile !== TILE.EMPTY));
    expect(painted).toBe(true);
  });

  it("section 킷은 부위까지 그대로 복사한다", () => {
    const source = { ...kit3x3(), parts: [{ id: "p1", kind: "entrance" as const, dx: 1, dy: 1, w: 1, h: 2 }] };
    const baked = bakeStructureKit(source, "kit_copy", "우물 사본");
    expect(baked.parts).toHaveLength(1);
    expect(baked.parts![0]!.id).toBe("p1");
    expect(baked.rows).toEqual(source.rows);
  });
});

describe("bakeInteriorObject", () => {
  it("실내 오브젝트를 section 으로 굳히고 role·snap·themes 는 버린다", () => {
    const object = INTERIOR_OBJECT_CATALOG[0]!;
    const baked = bakeInteriorObject(object, "kit_bed", "침대 사본");
    expect(baked.kind).toBe("section");
    expect(baked.width).toBe(object.width);
    expect(baked.height).toBe(object.height);
    expect(baked.learnedFrom).toBe("db-authored");
    expect(baked.parts ?? []).toHaveLength(0);
    expect(Object.keys(baked)).not.toContain("role");
    expect(Object.keys(baked)).not.toContain("themes");
    expect(Object.keys(baked)).not.toContain("snap");
  });
});

describe("copyName", () => {
  it("사본 이름을 만든다", () => {
    expect(copyName("우물", [])).toBe("우물 사본");
  });

  it("이미 사본이 있으면 번호를 올린다", () => {
    expect(copyName("우물", ["우물", "우물 사본"])).toBe("우물 사본 2");
    expect(copyName("우물", ["우물 사본", "우물 사본 2"])).toBe("우물 사본 3");
  });
});

describe("칸 힌트", () => {
  it("증분 축을 붙이고 다시 읽는다", () => {
    const next = setCellHint(kit3x3(), 1, 2, { growth: "vertical" });
    expect(next.cellHints).toEqual([{ dx: 1, dy: 2, growth: "vertical" }]);
    expect(cellHintAt(next, 1, 2)?.growth).toBe("vertical");
    expect(cellHintAt(next, 0, 0)).toBeUndefined();
  });

  it("같은 칸을 다시 쓰면 항목이 늘지 않고 덮인다", () => {
    const once = setCellHint(kit3x3(), 0, 0, { growth: "horizontal" });
    const twice = setCellHint(once, 0, 0, { growth: "both" });
    expect(twice.cellHints).toHaveLength(1);
    expect(twice.cellHints![0]!.growth).toBe("both");
  });

  /* 축만 바꾸는 조작이 사람이 적어 둔 메모를 조용히 지우면, 사용자는 지워진 줄도 모른다. */
  it("축을 바꿔도 메모가 남고, 메모를 바꿔도 축이 남는다", () => {
    const withNote = setCellHint(kit3x3(), 2, 0, { growth: "horizontal", note: "벽 몸통" });
    const changedAxis = setCellHint(withNote, 2, 0, { growth: "vertical" });
    expect(changedAxis.cellHints![0]).toEqual({ dx: 2, dy: 0, growth: "vertical", note: "벽 몸통" });
    const changedNote = setCellHint(changedAxis, 2, 0, { note: "기둥" });
    expect(changedNote.cellHints![0]).toEqual({ dx: 2, dy: 0, growth: "vertical", note: "기둥" });
  });

  it("축과 메모가 모두 비면 항목 자체가 사라진다 — 뜻 없는 좌표를 AI 에게 주지 않는다", () => {
    const withBoth = setCellHint(kit3x3(), 1, 1, { growth: "both", note: "메모" });
    const cleared = setCellHint(setCellHint(withBoth, 1, 1, { growth: null }), 1, 1, { note: null });
    expect(cleared.cellHints).toBeUndefined();
  });

  it("빈 문자열 메모는 메모 없음과 같다", () => {
    const kit = setCellHint(kit3x3(), 0, 1, { note: "   " });
    expect(kit.cellHints).toBeUndefined();
  });

  it("경계 밖 좌표는 무시한다", () => {
    const kit = kit3x3();
    expect(setCellHint(kit, 3, 0, { growth: "both" })).toBe(kit);
    expect(setCellHint(kit, 0, -1, { growth: "both" })).toBe(kit);
  });

  it("없는 칸을 지우면 원본을 그대로 돌려준다(참조 동일)", () => {
    const kit = kit3x3();
    expect(removeCellHint(kit, 0, 0)).toBe(kit);
  });

  it("크기를 줄여 밖으로 나간 힌트는 삭제되고 개수가 보고된다", () => {
    const kit = setCellHint(setCellHint(kit3x3(), 0, 0, { growth: "both" }), 2, 2, { growth: "vertical" });
    const result = resizeKit(kit, 2, 2);
    expect(result.droppedHints).toBe(1);
    expect(result.kit.cellHints).toEqual([{ dx: 0, dy: 0, growth: "both" }]);
  });

  it("전부 나가면 cellHints 키 자체가 없어진다", () => {
    const kit = setCellHint(kit3x3(), 2, 2, { growth: "vertical" });
    const result = resizeKit(kit, 1, 1);
    expect(result.droppedHints).toBe(1);
    expect(result.kit.cellHints).toBeUndefined();
    // 입력을 변형하지 않는다 — 되돌리기 스택이 같은 객체를 들고 있다.
    expect(kit.cellHints).toHaveLength(1);
  });

  it("굽기가 칸 힌트를 함께 가져간다 — 사본도 어휘를 잃지 않는다", () => {
    const kit = setCellHint(kit3x3(), 1, 0, { growth: "horizontal", note: "가로로 증분 가능" });
    const baked = bakeStructureKit(kit, "kit_copy", "사본");
    expect(baked.cellHints).toEqual([{ dx: 1, dy: 0, growth: "horizontal", note: "가로로 증분 가능" }]);
    // 깊은 사본이어야 한다 — 사본을 고치면 원본이 따라 바뀌면 안 된다.
    expect(baked.cellHints![0]).not.toBe(kit.cellHints![0]);
  });
});
