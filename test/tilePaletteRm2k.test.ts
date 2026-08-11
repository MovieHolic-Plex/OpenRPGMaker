import { describe, expect, it } from "vitest";
import {
  autotileRepresentativeTile,
  buildCustomPaletteModel,
  buildRm2kPaletteModel,
  CUSTOM_PALETTE_MIN_CELL_SIZE,
  makeCustomPalette,
  RM2K_PALETTE_COLUMNS,
  rm2kPaletteDisplayTile,
} from "@/editor/panels/tilePaletteRm2k";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";
import type { AutotileGroup, TilesetDef } from "@/project/types";

// RM2003식 팔레트 모델 — 6열 리플로우 대상 목록(오토타일 대표 축약 + 변형 숨김) 순수 계산 검증.
// 오토타일 그룹 목록은 autotileGroupsForTileset() 동적 조회이므로, 내장 그룹이 추가되어도
// 깨지지 않도록 "포함/제외" 단위로만 단언한다(전체 목록 동등 비교 금지).

const COMBINED_TOWN_COUNT = 480;

function makeDefaultTileset(overrides?: Partial<TilesetDef>): TilesetDef {
  return {
    count: COMBINED_TOWN_COUNT,
    id: "combined_town_test",
    kind: "rpg2k",
    image: { id: "tex_easyrpg_chipset_combined_town", type: "bundled" },
    name: "Combined town",
    passability: Array.from({ length: COMBINED_TOWN_COUNT }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: COMBINED_TOWN_COUNT }, () => "lower" as const),
    terrain: Array.from({ length: COMBINED_TOWN_COUNT }, () => 0),
    tileSize: 16,
    tilesPerRow: 30,
    ...overrides,
  };
}

function makeCustomTileset(groups: AutotileGroup[]): TilesetDef {
  return makeDefaultTileset({
    kind: "custom",
    autotileGroups: groups,
    count: 32,
    id: "custom_test",
    image: { id: "tex_custom_sheet", type: "bundled" },
    tilesPerRow: 8,
  });
}


function unionTileIds(tileset: TilesetDef): ReadonlySet<number> {
  return new Set([
    ...buildRm2kPaletteModel(tileset, "lower").tileIds,
    ...buildRm2kPaletteModel(tileset, "upper").tileIds,
  ]);
}

describe("buildRm2kPaletteModel (RM2003식 6열 팔레트 모델)", () => {
  it("fixes the palette reflow at 6 columns", () => {
    expect(RM2K_PALETTE_COLUMNS).toBe(6);
  });

  it("collapses water/waterfall and builtin autotile groups to single representative cells up front", () => {
    const model = buildRm2kPaletteModel(makeDefaultTileset(), "lower");
    const reps = model.autotiles.map((entry) => entry.representativeTile);

    // RM2K식: 물(0)·폭포(93)가 맨 앞, 이어서 오토타일 그룹 대표(외딴/anchor).
    expect(reps[0]).toBe(0);
    expect(reps[1]).toBe(93);
    expect(reps).toContain(360); // 흙길
    expect(reps).toContain(363); // 모래
    expect(reps).toContain(129); // 포석
    expect(reps).toContain(126); // 경작지
    // 대표는 중복 없이 1칸씩.
    expect(new Set(reps).size).toBe(reps.length);
  });

  it("hides variantMap output tiles and water animation frames from the plain listing", () => {
    const tileset = makeDefaultTileset();
    const listed = unionTileIds(tileset);

    // 흙길 몸통/변 변형, 모래 몸통, 포석 몸통, 호수·폭포 프레임은 일반 나열에서 숨김.
    for (const hiddenTile of [421, 391, 424, 190, 120, 94, 0, 93, 360, 363]) {
      expect(listed.has(hiddenTile)).toBe(false);
    }
    // 오토타일이 아닌 일반 타일(돌바닥 342)은 그대로 나열.
    expect(listed.has(342)).toBe(true);
  });

  it("keeps the plain listing sorted, unique, and disjoint from representatives", () => {
    const model = buildRm2kPaletteModel(makeDefaultTileset(), "lower");
    const sorted = [...model.tileIds].sort((a, b) => a - b);

    expect(model.tileIds).toEqual(sorted);
    expect(new Set(model.tileIds).size).toBe(model.tileIds.length);
    for (const entry of model.autotiles) {
      expect(model.tileIds).not.toContain(entry.representativeTile);
    }
  });

  it("uses tileset autotile groups (no water entries) for non-default chipsets", () => {
    const group: AutotileGroup = {
      id: "custom_floor",
      memberTileIds: [5, 6, 7],
      name: "커스텀 바닥",
      variantMap: { "0": 5, "1": 6, "2": 7 },
    };
    const model = buildRm2kPaletteModel(makeCustomTileset([group]), "lower");

    expect(model.autotiles).toEqual([{ id: "custom_floor", name: "커스텀 바닥", representativeTile: 5 }]);
    expect(model.tileIds).not.toContain(6);
    expect(model.tileIds).not.toContain(7);
    // 물 축약은 combined_town 전용 — 커스텀 칩셋에서는 0이 일반 타일.
    expect(model.tileIds).toContain(0);
  });

  it("falls back to the first member when a group has no mask-0 variant", () => {
    const group: AutotileGroup = {
      id: "no_isolated",
      memberTileIds: [9, 10],
      name: "외딴 없음",
      variantMap: { "15": 10 },
    };
    expect(autotileRepresentativeTile(group)).toBe(9);
    const model = buildRm2kPaletteModel(makeCustomTileset([group]), "lower");
    expect(model.autotiles[0]?.representativeTile).toBe(9);
  });

  it("skips groups whose representative is outside the tileset", () => {
    const group: AutotileGroup = {
      id: "out_of_range",
      memberTileIds: [999],
      name: "범위 밖",
      variantMap: { "0": 999 },
    };
    const model = buildRm2kPaletteModel(makeCustomTileset([group]), "lower");
    expect(model.autotiles).toEqual([]);
  });
});

describe("rm2kPaletteDisplayTile (숨겨진 변형 → 대표 칸 매핑)", () => {
  it("maps hidden autotile variants and water frames to their representative", () => {
    const tileset = makeDefaultTileset();
    expect(rm2kPaletteDisplayTile(tileset, 421)).toBe(360); // 흙길 몸통 → 대표
    expect(rm2kPaletteDisplayTile(tileset, 1)).toBe(0); // 호수 프레임 → 물 대표
    expect(rm2kPaletteDisplayTile(tileset, 123)).toBe(93); // 폭포 프레임 → 폭포 대표
    expect(rm2kPaletteDisplayTile(tileset, 465)).toBe(465); // 일반 타일은 그대로
  });
});

describe("custom atlas palette", () => {
  it("infers kind-less uploaded and non-480 atlases as custom", () => {
    const uploaded = makeDefaultTileset({ kind: undefined, image: { id: "legacy_upload", type: "uploaded" } });
    const non480 = makeDefaultTileset({ kind: undefined, count: 32 });
    expect(buildCustomPaletteModel(uploaded)).toHaveLength(480);
    expect(buildCustomPaletteModel(non480)).toHaveLength(32);
  });

  it("lists exact source cells without RM2K autotile collapse", () => {
    const tileset = makeCustomTileset([{
      id: "custom_floor",
      memberTileIds: [5, 6, 7],
      name: "커스텀 바닥",
      variantMap: { "0": 5, "1": 6, "2": 7 },
    }]);

    expect(buildCustomPaletteModel(tileset)).toEqual(Array.from({ length: 32 }, (_, index) => index));
  });

  it("keeps the complete source sheet visible regardless of the active layer", () => {
    const tileset = makeCustomTileset([]);
    tileset.priority[3] = "upper";
    tileset.priority[11] = "upper";

    expect(buildCustomPaletteModel(tileset)).toEqual(Array.from({ length: 32 }, (_, index) => index));
  });

  it("renders the exact source column count instead of reflowing the atlas", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeCustomTileset([]);
      tileset.count = 480;
      tileset.tilesPerRow = 30;
      const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset }));
      expect(root.dataset.paletteKind).toBe("custom");
      expect(root.dataset.sourceColumns).toBe("30");
      expect(root.dataset.sourceRows).toBe("16");
      expect(root.getAttribute("style")).toContain("--custom-cols:30");
      expect(root.getAttribute("style")).toContain(`--custom-min-cell:${CUSTOM_PALETTE_MIN_CELL_SIZE}px`);
      expect(root.querySelectorAll("button")).toHaveLength(480);
    } finally {
      restore();
    }
  });
});
