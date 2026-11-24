import { describe, expect, it } from "vitest";
import { autotilePaintTile, classifyTerrainChip, paletteCatalogFor, paletteHasSmartCatalog, prefabChips, prefabThumbTiles, searchPaletteCatalog } from "@/editor/panels/tilePaletteCatalog";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "@/project/defaults/joseonBaram";
import type { AutotileGroup, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { autotileRepresentativeTile, buildCustomPaletteModel, buildGridPaletteModel, CUSTOM_PALETTE_MIN_CELL_SIZE, makeCustomPalette, makeGridPalette, GRID_PALETTE_COLUMNS, gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";
import { createPaletteStampFromDisplayDrag, createPaletteStampFromDrag, paletteStampIncludesTile } from "@/editor/tilePaletteStamp";
import { isolateTimers } from "./mergedTeardown";

describe("tilePaletteCatalog", () => {
  isolateTimers();
  function pass(count: number) {
    return Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
  }
  function kit(partial: Pick<SectionStructureKitDef, "id" | "name" | "width" | "height" | "rows"> & {
    role?: "building" | "prop";
    themes?: string[];
    tags?: string[];
  }): SectionStructureKitDef {
    return {
      id: partial.id,
      name: partial.name,
      kind: "section",
      width: partial.width,
      height: partial.height,
      rows: partial.rows,
      learnedFrom: "user-paint",
      ai: {
        description: partial.name ?? partial.id,
        placementRules: "",
        role: partial.role,
        themes: partial.themes,
        tags: partial.tags,
      },
    };
  }
  function roadGroup(): AutotileGroup {
    return {
      id: "dirt-road",
      name: "조선 흙길",
      memberTileIds: [1, 8],
      variantMap: { "0": 1, "255": 8 },
      layer: "lower",
    };
  }
  function fixture(): TilesetDef {
    const count = 16;
    return {
      id: "catalog-fixture",
      name: "합성",
      kind: "custom",
      image: { type: "bundled", id: "catalog-sheet" },
      tileSize: 16,
      count,
      tilesPerRow: 8,
      passability: pass(count),
      priority: Array.from({ length: count }, () => "lower"),
      terrain: Array(count).fill(0),
      tileMeta: [
        undefined,
        { label: "흙길 외곽" },
        undefined,
        { label: "연못" },
        { label: "기와 조각", tags: ["기와"] },
      ],
      autotileGroups: [roadGroup()],
      tileGroups: [
        {
          id: "pond",
          name: "연못",
          role: "water",
          defaultLayer: "lower",
          tileIds: [3],
          description: "",
          placementRules: "",
        },
        {
          id: "road-dup",
          name: "조선 흙길 (오토타일)",
          role: "terrain",
          defaultLayer: "lower",
          tileIds: [1, 8],
          description: "",
          placementRules: "",
        },
        {
          id: "house-group",
          name: "기와 묶음",
          role: "building",
          defaultLayer: "lower",
          tileIds: [4],
          description: "",
          placementRules: "",
        },
      ],
      structureKits: [
        kit({
          id: "giwa-house",
          name: "조선 기와집",
          width: 2,
          height: 2,
          rows: [{ tiles: [4, 5] }, { tiles: [4, 5] }],
          role: "building",
          themes: ["village", "마을"],
          tags: ["기와"],
        }),
      ],
    };
  }
  describe("tile palette catalog", () => {
    it("paints an autotile from the filled neighbor and files a dirt road under 길", () => {
      const group = roadGroup();
      expect(autotilePaintTile(group)).toBe(8);
      expect(classifyTerrainChip("조선 흙길", "dirt-road", "", [])).toBe("road");
      const road = paletteCatalogFor(fixture()).terrain.find((card) => card.autotileGroupId === "dirt-road");
      expect(road).toMatchObject({ kind: "autotile", chip: "road", paintTile: 8, name: "조선 흙길" });
    });

    it("drops a tile group that is already an autotile and keeps water and buildings searchable", () => {
      const catalog = paletteCatalogFor(fixture());
      expect(catalog.terrain.map((card) => card.name)).not.toContain("조선 흙길 (오토타일)");
      expect(catalog.terrain.map((card) => card.chip)).toContain("water");
      expect(catalog.otherGroups.map((card) => card.name)).toEqual(["기와 묶음"]);
    });

    it("ranks prefabs ahead of individual tiles and prefers Hangul theme chips", () => {
      const tileset = fixture();
      const found = searchPaletteCatalog(tileset, "기와");
      expect(found.prefabs.map((hit) => hit.kind === "prefab" ? hit.card.name : "")).toContain("조선 기와집");
      expect(found.tiles.map((hit) => hit.kind === "tile" ? hit.label : "")).toContain("기와 조각");
      expect(found.prefabTotal).toBeGreaterThan(0);
      expect(found.tileTotal).toBeGreaterThan(0);
      const chips = prefabChips(paletteCatalogFor(tileset).prefabs);
      expect(chips.map((chip) => chip.label)).toContain("마을");
      expect(chips.map((chip) => chip.label)).not.toContain("village");
    });

    it("samples a prefab mosaic in the kit's own column count", () => {
      const house = fixture().structureKits![0]!;
      expect(prefabThumbTiles(house, 16)).toEqual({ columns: 2, tiles: [4, 5, 4, 5] });
    });

    it("has no smart catalog when the tileset has no groups or kits", () => {
      const bare = fixture();
      bare.autotileGroups = [];
      bare.tileGroups = [];
      bare.structureKits = [];
      expect(paletteHasSmartCatalog(bare)).toBe(false);
    });

    it("builds joseon terrain from the real autotile body and skips the duplicate road group", () => {
      const tileset = createJoseonBaramTileset();
      const started = performance.now();
      const catalog = paletteCatalogFor(tileset);
      expect(performance.now() - started).toBeLessThan(1000);
      const road = tileset.autotileGroups?.find((group) => group.name === "조선 흙길");
      expect(road?.variantMap["255"]).toEqual(expect.any(Number));
      const card = catalog.terrain.find((item) => item.autotileGroupId === road?.id);
      expect(card).toMatchObject({ name: "조선 흙길", kind: "autotile", paintTile: road?.variantMap["255"] });
      expect(catalog.terrain.some((item) => item.name === "조선 흙길 (오토타일)")).toBe(false);
      const found = searchPaletteCatalog(tileset, "기와집");
      expect(found.prefabs.some((hit) => hit.kind === "prefab" && hit.card.name.includes("기와집"))).toBe(true);
    });

    it("builds beodeul prefabs and a named road card", () => {
      const catalog = paletteCatalogFor(createBeodeulCityTileset());
      expect(catalog.prefabs.length).toBeGreaterThan(100);
      expect(catalog.terrain.some((card) => card.name.includes("버들항 길"))).toBe(true);
    });
  });
});

describe("tilePaletteGrid", () => {
  isolateTimers();
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
});

describe("tilePaletteStamp", () => {
  isolateTimers();
  describe("tile palette drag stamps", () => {
    it("creates a source-preserving 3x3 stamp from dragged chipset tiles", () => {
      const tileset = testTileset();

      const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

      expect(stamp.width).toBe(3);
      expect(stamp.height).toBe(3);
      expect(stamp.cells.map((cell) => cell.tile)).toEqual([10, 11, 12, 18, 19, 20, 26, 27, 28]);
      expect(stamp.cells.find((cell) => cell.tile === 19)).toEqual({ dx: 1, dy: 1, layer: "upper", tile: 19 });
    });

    it("marks every source tile inside the dragged rectangle", () => {
      const tileset = testTileset();
      const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

      expect(paletteStampIncludesTile(stamp, 19, tileset.tilesPerRow)).toBe(true);
      expect(paletteStampIncludesTile(stamp, 29, tileset.tilesPerRow)).toBe(false);
    });

    it("creates a stamp from the visible reordered palette grid", () => {
      const tileset = testTileset();
      const displayTiles = [240, 303, 421, 424, 342, 343, 306, 366, 374, 375, 270, 120, 93, 123, 153, 246];

      const stamp = createPaletteStampFromDisplayDrag({
        displayTiles,
        displayTilesPerRow: 10,
        endTile: 270,
        startTile: 303,
        tileset: { ...tileset, count: 512 },
      });

      expect(stamp.width).toBe(2);
      expect(stamp.height).toBe(2);
      expect(stamp.cells.map((cell) => cell.tile)).toEqual([240, 303, 270, 120]);
      expect(paletteStampIncludesTile(stamp, 303, tileset.tilesPerRow)).toBe(true);
      expect(paletteStampIncludesTile(stamp, 342, tileset.tilesPerRow)).toBe(false);
    });
  });
  function testTileset(): TilesetDef {
    return {
      count: 64,
      id: "test",
      image: { id: "test-image", type: "uploaded" },
      name: "Test",
      passability: Array.from({ length: 64 }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: 64 }, (_, index) => index === 19 ? "upper" : "lower"),
      terrain: Array.from({ length: 64 }, () => 0),
      tileSize: 16,
      tilesPerRow: 8,
    };
  }
});
