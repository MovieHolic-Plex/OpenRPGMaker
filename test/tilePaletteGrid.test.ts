import { describe, expect, it } from "vitest";
import {
  autotileRepresentativeTile,
  buildCustomPaletteModel,
  buildGridPaletteModel,
  CUSTOM_PALETTE_MIN_CELL_SIZE,
  makeCustomPalette,
  makeGridPalette,
  GRID_PALETTE_COLUMNS,
  gridPaletteDisplayTile,
} from "@/editor/panels/tilePaletteGrid";
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
    ...buildGridPaletteModel(tileset, "lower").tileIds,
    ...buildGridPaletteModel(tileset, "upper").tileIds,
  ]);
}

describe("buildGridPaletteModel (RM2003식 6열 팔레트 모델)", () => {
  it("fixes the palette reflow at 6 columns", () => {
    expect(GRID_PALETTE_COLUMNS).toBe(6);
  });

  it("collapses water/waterfall and builtin autotile groups to single representative cells up front", () => {
    const model = buildGridPaletteModel(makeDefaultTileset(), "lower");
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
    const model = buildGridPaletteModel(makeDefaultTileset(), "lower");
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
    const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");

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
    const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");
    expect(model.autotiles[0]?.representativeTile).toBe(9);
  });

  it("skips groups whose representative is outside the tileset", () => {
    const group: AutotileGroup = {
      id: "out_of_range",
      memberTileIds: [999],
      name: "범위 밖",
      variantMap: { "0": 999 },
    };
    const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");
    expect(model.autotiles).toEqual([]);
  });
});

describe("gridPaletteDisplayTile (숨겨진 변형 → 대표 칸 매핑)", () => {
  it("maps hidden autotile variants and water frames to their representative", () => {
    const tileset = makeDefaultTileset();
    expect(gridPaletteDisplayTile(tileset, 421)).toBe(360); // 흙길 몸통 → 대표
    expect(gridPaletteDisplayTile(tileset, 1)).toBe(0); // 호수 프레임 → 물 대표
    expect(gridPaletteDisplayTile(tileset, 123)).toBe(93); // 폭포 프레임 → 폭포 대표
    expect(gridPaletteDisplayTile(tileset, 465)).toBe(465); // 일반 타일은 그대로
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

  it("keeps source rows contiguous in the custom palette", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeCustomTileset([]);
      tileset.count = 480;
      tileset.tilesPerRow = 30;
      const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset }));
      expect(root.dataset.paletteKind).toBe("custom");
      expect(root.dataset.sourceColumns).toBe("30");
      expect(root.dataset.sourceRows).toBe("16");
      expect(root.dataset.displayColumns).toBe("30");
      expect(root.getAttribute("style")).toContain("--custom-cols:30");
      expect(root.getAttribute("style")).toContain(`--custom-min-cell:${CUSTOM_PALETTE_MIN_CELL_SIZE}px`);
      expect(root.querySelectorAll("button")).toHaveLength(480);
    } finally {
      restore();
    }
  });
});

// 좌패널 1면 통합(2026-08-21): 검색·분류 필터가 **이 팔레트 하나**에 걸린다.
// 예전에는 「찾기」 탭이 별개 그리드로 타일셋을 두 번째로 그렸고, 오토타일 대표 1칸
// 규칙을 안 따라 같은 칩셋이 탭에 따라 다르게 보였다.
describe("팔레트 필터 (visibleTiles)", () => {
  it("필터가 없으면(null) 전량 노출한다", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeDefaultTileset();
      const unfiltered = renderWithFakeDom(() =>
        makeGridPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset })
      );
      const explicitNull = renderWithFakeDom(() =>
        makeGridPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset, visibleTiles: null })
      );
      expect(explicitNull.querySelectorAll("button").length).toBe(unfiltered.querySelectorAll("button").length);
      expect(unfiltered.querySelectorAll("button").length).toBeGreaterThan(20);
    } finally {
      restore();
    }
  });

  it("6열 리플로우 팔레트는 걸러진 칸을 숨긴다 — 위치가 정보가 아니므로", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeDefaultTileset();
      const root = renderWithFakeDom(() =>
        makeGridPalette({
          layer: "lower",
          onSelectTile: () => undefined,
          selectedTile: 342,
          tileset,
          visibleTiles: new Set([342]),
        })
      );
      // 선택 타일 하나만 남는다(선택은 항상 예외로 그려진다).
      expect(root.querySelectorAll("button")).toHaveLength(1);
      expect(root.querySelector('[data-testid="chipset-tile-342"]')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it("선택 타일은 필터에 안 걸려도 항상 그린다 — 안 그러면 '선택 중'인 칸이 사라진다", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeDefaultTileset();
      const root = renderWithFakeDom(() =>
        makeGridPalette({
          layer: "lower",
          onSelectTile: () => undefined,
          selectedTile: 342,
          tileset,
          // 342 는 필터 밖이다.
          visibleTiles: new Set([465]),
        })
      );
      expect(root.querySelector('[data-testid="chipset-tile-342"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="chipset-tile-465"]')).not.toBeNull();
      expect(root.querySelectorAll("button")).toHaveLength(2);
    } finally {
      restore();
    }
  });

  it("결과가 0이면 빈 안내를 남긴다", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeDefaultTileset();
      const root = renderWithFakeDom(() =>
        makeGridPalette({
          layer: "lower",
          onSelectTile: () => undefined,
          selectedTile: -1,
          tileset,
          visibleTiles: new Set<number>(),
        })
      );
      expect(root.querySelectorAll("button")).toHaveLength(0);
      expect(root.querySelector('[data-testid="palette-filter-empty"]')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it("커스텀 아틀라스는 숨기지 않고 흐리게 한다 — 칸의 위치가 원본 시트 좌표다", () => {
    const restore = installFakeDom();
    try {
      const tileset = makeCustomTileset([]);
      const root = renderWithFakeDom(() =>
        makeCustomPalette({
          layer: "lower",
          onSelectTile: () => undefined,
          selectedTile: 0,
          tileset,
          visibleTiles: new Set([5]),
        })
      );
      // 32칸 전부 남아 아틀라스 모양이 유지된다.
      expect(root.querySelectorAll("button")).toHaveLength(32);
      const kept = root.querySelector('[data-testid="chipset-tile-5"]');
      const dimmed = root.querySelector('[data-testid="chipset-tile-9"]');
      expect(kept?.className).not.toContain("is-filtered-out");
      expect(dimmed?.className).toContain("is-filtered-out");
    } finally {
      restore();
    }
  });
});

describe("칸 선택 입력은 판 하나가 받는다", () => {
  function dispatch(target: HTMLElement, type: string, init: Record<string, unknown> = {}): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(init)) Object.defineProperty(event, key, { configurable: true, value });
    target.dispatchEvent(event);
  }

  it("포인터·보조기기 클릭·Enter 가 누른 칸의 타일을 한 번씩 고른다", () => {
    const restore = installFakeDom();
    try {
      const picked: number[] = [];
      const tileset = makeCustomTileset([]);
      tileset.count = 64;
      tileset.tilesPerRow = 8;
      const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: (tile) => picked.push(tile), selectedTile: 0, tileset }));
      const cell = root.querySelector<HTMLElement>('[data-testid="chipset-tile-9"]')!;

      dispatch(cell, "pointerdown", { button: 0 });
      dispatch(cell, "click", { detail: 1 });
      dispatch(cell, "pointerdown", { button: 2 });
      expect(picked).toEqual([9]);

      dispatch(cell, "click", { detail: 0 });
      dispatch(root.querySelector<HTMLElement>('[data-testid="chipset-tile-10"]')!, "keydown", { key: "Enter" });
      expect(picked).toEqual([9, 9, 10]);
    } finally {
      restore();
    }
  });
});
