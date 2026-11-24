import { describe, expect, it, beforeEach } from "vitest";
import { CHIPSET_TILE_GROUPS, describeChipsetTile, tileLabelForIndex, FARMLAND_TILE, DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { DEFAULT_TILE_COUNT } from "@/project/defaults/constants";
import { COMBO_BRUSH_CATEGORIES, COMBO_BRUSH_REVIEW_OWNER, CURATED_COMBO_BRUSHES, comboBrushCatalogEntry, comboBrushStampFromCatalog, curatedComboBrushesForTileset } from "@/editor/comboBrushCatalog";
import { comboBrushLayerSummary, isComboBrush } from "@/editor/comboBrush";
import { defaultPaintLayerForTile } from "@/editor/tileLayerClassification";
import { createBlankProject, TILE, COMBINED_TOWN_TILESET_ID } from "@/project/defaults";
import type { TilesetDef, AutotileGroup, Project } from "@/project/types";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { farmlandGroupForTileset, wateredFarmlandGroupForTileset } from "@/project/defaults/farmlandGroup";
import { LAKE_AUTOTILE_TILE, lakeAutotileQuarterSources, sourceQuarterForLakeChip } from "@/project/defaults/lakeAutotile";
import { roadAutotileTileForCell, paintRoadRect, shapeRoadEdges, type RoadRect, isRoadTile } from "@/project/defaults/roadAutotile";
import type { GameMap } from "@/project/types/project";
import { addMap, moveMapInTree, paintTile, resizeMap, setMapTileset } from "@/editor/actions";
import { addEvent } from "@/editor/eventActions";
import { copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { setTerrainTag } from "@/editor/tilesetActions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { isHarnessStackableTile } from "@/project/tilesetHarness";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { filterRoadWidthCells, repairRoadPath, roadObstacleMaskFor } from "@/editor/tools/roadObstacles";
import type { Point } from "@/editor/tools/mapHelpers";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { isPassable } from "@/project/collision";
import { isolateTimers } from "./mergedTeardown";

describe("chipsetMapping", () => {
  isolateTimers();
  describe("chipset AI mapping", () => {
    it("keeps every default chipset cell addressable for AI tiling", () => {
      for (let index = 0; index < DEFAULT_TILE_COUNT; index += 1) {
        const tile = describeChipsetTile(index);
        expect(tile.label.length).toBeGreaterThan(0);
        expect(tile.description.length).toBeGreaterThan(0);
        expect(tile.aiLabel).toBe(tile.description);
        expect(tile.tags.length).toBeGreaterThan(0);
      }
    });

    it("describes expanded EasyRPG exterior decoration groups", () => {
      expect(CHIPSET_TILE_GROUPS.houseWoodWallUpperObjects).toEqual([102, 103, 104]);
      expect(CHIPSET_TILE_GROUPS.houseWoodWallBodyObjects).toEqual([132, 133, 134]);
      expect(CHIPSET_TILE_GROUPS.houseWoodWallLowerObjects).toEqual([162, 163, 164]);
      expect(CHIPSET_TILE_GROUPS.groundDetail).toContain(402);
      expect(CHIPSET_TILE_GROUPS.fenceObjects).toContain(379);
      expect(tileLabelForIndex(132)).toBe("House wood wall body");
      expect(describeChipsetTile(379)).toMatchObject({
        key: "fence_object",
        description: "Fence top/bottom horizontal rail: repeat this tile across the upper or lower run between fence corners or terminators.",
        aiLabel: "Fence top/bottom horizontal rail: repeat this tile across the upper or lower run between fence corners or terminators.",
        label: "Fence",
        layer: "upper",
        repeatRole: "object",
        usage: "decoration",
        tags: expect.arrayContaining(["fence", "horizontal", "repeat-horizontal"]),
        confirmed: true,
      });
      expect(describeChipsetTile(408)).toMatchObject({
        description: "Fence vertical rail: repeat this tile down the left or right side of a fenced enclosure.",
        tags: expect.arrayContaining(["fence", "vertical", "repeat-vertical"]),
      });
      expect(describeChipsetTile(410)).toMatchObject({
        description: "Fence lower-right turn: use where the right vertical fence bends into the lower horizontal fence.",
        tags: expect.arrayContaining(["fence", "corner", "lower-right"]),
      });
      expect(describeChipsetTile(132)).toMatchObject({
        key: "house_wood_wall_body_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wood", "wall", "body", "upper"]),
      });
      expect(describeChipsetTile(384)).toMatchObject({
        key: "house_roof_object",
        aiLabel: "House roof object: upper-layer exterior home roof section for AI-composed village houses.",
        usage: "structure",
        tags: expect.arrayContaining(["house", "roof", "building", "upper"]),
      });
      expect(CHIPSET_TILE_GROUPS.houseObjects).toEqual(expect.arrayContaining([
        12, 13, 14,
        42, 43, 44,
        72, 73, 74,
        102, 103, 104,
        132, 133, 134,
        162, 163, 164,
        329, 359,
        374, 375, 376,
        434, 435, 436,
        464, 465, 466,
      ]));
      expect(CHIPSET_TILE_GROUPS.houseObjects).not.toContain(284);
      expect(CHIPSET_TILE_GROUPS.houseObjects).not.toContain(193);
      expect(CHIPSET_TILE_GROUPS.houseObjects).not.toContain(444);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallUpperObjects).toEqual([15, 16, 17]);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallBodyObjects).toEqual([45, 46, 47]);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallLowerObjects).toEqual([75, 76, 77]);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallObjects).toEqual([15, 16, 17, 45, 46, 47, 75, 76, 77]);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallRepeatColumnObjects).toEqual([16, 46, 76]);
      expect(CHIPSET_TILE_GROUPS.houseEntranceUpperObjects).toEqual([329]);
      expect(CHIPSET_TILE_GROUPS.houseEntranceLowerObjects).toEqual([359]);
      expect(CHIPSET_TILE_GROUPS.houseEntranceObjects).toEqual([329, 359]);
      expect(describeChipsetTile(12)).toMatchObject({
        key: "house_purple_stone_wall_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "purple-stone", "upper"]),
      });
      expect(describeChipsetTile(15)).toMatchObject({
        key: "house_white_wall_upper_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "white", "upper-wall", "left-cap"]),
      });
      expect(describeChipsetTile(16)).toMatchObject({
        key: "house_white_wall_upper_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "white", "upper-wall", "repeat-horizontal"]),
      });
      expect(describeChipsetTile(45)).toMatchObject({
        key: "house_white_wall_body_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "white", "body", "left-cap"]),
      });
      expect(describeChipsetTile(76)).toMatchObject({
        key: "house_white_wall_lower_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "white", "lower-wall", "repeat-horizontal"]),
      });
      expect(describeChipsetTile(102)).toMatchObject({
        key: "house_wood_wall_upper_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wood", "wall", "upper-wall", "upper"]),
      });
      expect(describeChipsetTile(162)).toMatchObject({
        key: "house_wood_wall_lower_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wood", "wall", "lower-wall", "upper"]),
      });
      expect(describeChipsetTile(193)).toMatchObject({
        key: "timber_post_structure_object",
        usage: "structure",
        tags: expect.arrayContaining(["timber", "post", "needs-manual-composition", "upper"]),
      });
      expect(describeChipsetTile(434)).toMatchObject({
        key: "house_facade_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "facade", "upper"]),
      });
      expect(describeChipsetTile(464)).toMatchObject({
        key: "house_facade_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "wall", "facade", "upper"]),
      });
      expect(describeChipsetTile(329)).toMatchObject({
        key: "house_entrance_upper_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "entrance", "upper-half"]),
      });
      expect(describeChipsetTile(359)).toMatchObject({
        key: "house_entrance_lower_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "entrance", "lower-half"]),
      });
      expect(describeChipsetTile(465)).toMatchObject({
        key: "house_door_object",
        usage: "structure",
        tags: expect.arrayContaining(["house", "door", "entrance", "upper"]),
      });
      expect(describeChipsetTile(444).key).toBe("building_front_object");
      expect(describeChipsetTile(475).key).toBe("building_front_object");
      expect(describeChipsetTile(418)).toMatchObject({
        key: "tent_object",
        usage: "structure",
        tags: expect.arrayContaining(["tent", "shelter", "upper"]),
      });
      expect(describeChipsetTile(366)).toMatchObject({
        key: "dark_wall_body",
        usage: "structure",
        tags: expect.arrayContaining(["dark", "wall", "solid"]),
      });
      expect(describeChipsetTile(327)).toMatchObject({
        key: "bench_object",
        usage: "decoration",
        tags: expect.arrayContaining(["bench", "horizontal", "upper"]),
      });
      expect(describeChipsetTile(358)).toMatchObject({
        key: "bench_object",
        tags: expect.arrayContaining(["vertical", "top"]),
      });
      expect(describeChipsetTile(388)).toMatchObject({
        key: "bench_object",
        tags: expect.arrayContaining(["vertical", "bottom"]),
      });
      expect(describeChipsetTile(349).key).toBe("house_yard_object");
      expect(describeChipsetTile(353).key).toBe("cemetery_object");
      expect(describeChipsetTile(383).key).toBe("cemetery_object");
      expect(describeChipsetTile(322).key).toBe("wall_ladder_object");
      expect(describeChipsetTile(235).tags).toEqual(expect.arrayContaining(["stretch"]));
      expect(describeChipsetTile(112).tags).toEqual(expect.arrayContaining(["stretch"]));
      // 원형 타워(2칸 폭) — 캡/베이스 upper, 몸·창문 lower solid
      expect(describeChipsetTile(24)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "upper",
        tags: expect.arrayContaining(["round-tower", "cap", "left"]),
      });
      expect(describeChipsetTile(25)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "upper",
        tags: expect.arrayContaining(["round-tower", "cap", "right"]),
      });
      expect(describeChipsetTile(54)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "upper",
        tags: expect.arrayContaining(["round-tower", "base"]),
      });
      expect(describeChipsetTile(55)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "upper",
        tags: expect.arrayContaining(["round-tower", "base"]),
      });
      expect(describeChipsetTile(138)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "lower",
        passage: "solid",
        tags: expect.arrayContaining(["round-tower", "neck"]),
      });
      expect(describeChipsetTile(140).tags).toEqual(expect.arrayContaining(["body", "stretch"]));
      expect(describeChipsetTile(142)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "lower",
        passage: "solid",
        tags: expect.arrayContaining(["round-tower", "window", "left"]),
      });
      expect(describeChipsetTile(143)).toMatchObject({
        key: "castle_round_tower_object",
        layer: "lower",
        passage: "solid",
        tags: expect.arrayContaining(["round-tower", "window", "right"]),
      });
      // 성 지붕 면 / 성벽 정면 (성채 맵 모듈)
      expect(describeChipsetTile(18)).toMatchObject({
        key: "castle_roof_object",
        layer: "lower",
        passage: "solid",
        tags: expect.arrayContaining(["castle", "roof"]),
      });
      expect(describeChipsetTile(79)).toMatchObject({
        key: "castle_roof_object",
        layer: "lower",
        passage: "solid",
      });
      expect(describeChipsetTile(21)).toMatchObject({
        key: "castle_wall_face_object",
        layer: "lower",
        passage: "solid",
        tags: expect.arrayContaining(["wall", "face", "top"]),
      });
      expect(describeChipsetTile(51)).toMatchObject({
        key: "castle_wall_face_object",
        tags: expect.arrayContaining(["body", "stretch"]),
      });
      expect(describeChipsetTile(81)).toMatchObject({
        key: "castle_wall_face_object",
        tags: expect.arrayContaining(["bottom"]),
      });
    });

    it("describes lake, waterfall, desert sand, and stake cells for AI placement", () => {
      expect(CHIPSET_TILE_GROUPS.lakeWaterBody).toContain(120);
      expect(CHIPSET_TILE_GROUPS.lakeWaterBody).not.toContain(121);
      expect(CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames).toEqual([120, 121, 122, 150, 151, 152, 180, 181, 182, 210, 211, 212]);
      expect(CHIPSET_TILE_GROUPS.waterBody).toContain(120);
      expect(CHIPSET_TILE_GROUPS.lakeWaterBody).not.toContain(123);
      expect(CHIPSET_TILE_GROUPS.lakeShoreEdges).toContain(60);
      expect(CHIPSET_TILE_GROUPS.lakeShoreEdges).not.toContain(61);
      expect(CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames).toContain(91);
      expect(CHIPSET_TILE_GROUPS.waterEdges).not.toContain(123);
      expect(CHIPSET_TILE_GROUPS.waterfallWater).toContain(123);
      expect(CHIPSET_TILE_GROUPS.waterfallWater).not.toContain(124);
      expect(CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames).toContain(124);
      expect(CHIPSET_TILE_GROUPS.desertSandBody).toContain(424);
      expect(CHIPSET_TILE_GROUPS.desertSandEdges).toContain(394);
      expect(CHIPSET_TILE_GROUPS.stakeObjects).toContain(378);
      expect(describeChipsetTile(120)).toMatchObject({
        key: "lake_water_body",
        usage: "terrain",
        repeatRole: "body",
        tags: expect.arrayContaining(["lake", "still-water", "body", "impassable"]),
      });
      expect(describeChipsetTile(121)).toMatchObject({
        key: "lake_water_body",
        usage: "terrain",
        repeatRole: "body",
        tags: expect.arrayContaining(["lake", "animation-frame"]),
      });
      expect(describeChipsetTile(60)).toMatchObject({
        key: "lake_shore_edge",
        usage: "edge",
        repeatRole: "edge",
        tags: expect.arrayContaining(["lake", "shore", "edge"]),
      });
      expect(describeChipsetTile(91)).toMatchObject({
        key: "lake_shore_edge",
        usage: "edge",
        repeatRole: "edge",
        tags: expect.arrayContaining(["lake", "animation-frame"]),
      });
      expect(describeChipsetTile(123)).toMatchObject({
        key: "waterfall_water",
        usage: "terrain",
        repeatRole: "detail",
        tags: expect.arrayContaining(["waterfall", "flowing-water"]),
      });
      expect(describeChipsetTile(424)).toMatchObject({
        key: "desert_sand_body",
        usage: "terrain",
        terrainTag: 2,
        tags: expect.arrayContaining(["desert", "sand", "body"]),
      });
      expect(describeChipsetTile(394)).toMatchObject({
        key: "desert_sand_edge",
        usage: "edge",
        repeatRole: "edge",
        tags: expect.arrayContaining(["desert", "sand", "edge"]),
      });
      expect(describeChipsetTile(378)).toMatchObject({
        key: "fence_object",
        description: "Fence upper-left corner: use at the top-left of a fenced enclosure before horizontal rail 379.",
        usage: "decoration",
        layer: "upper",
        tags: expect.arrayContaining(["fence", "corner", "upper-left"]),
      });
    });
  });
});

// test/comboBrushCatalog.test.ts
// 큐레이션 Combo Brush 목록의 **계약**. 이 파일이 지키는 것은 세 가지고, 전부
// "번호 인접으로 추론하지 않는다"는 규칙을 기계적으로 강제하기 위한 것이다:
//
//  ① 모든 셀 타일은 그 조합이 인용한 CHIPSET_TILE_GROUPS 가방 안에 있어야 한다.
//     → 목록이 근거 없이 이웃 번호를 끌어오면 여기서 깨진다.
//  ② 선언한 레이어가 엔진의 실제 판정(defaultPaintLayerForTile)과 같아야 한다.
//     → 지붕 면을 upper 로 잘못 적었던 실제 사고를 다시 잡는 자리.
//  ③ dx/dy 가 선언한 width×height 를 **정확히** 채워야 한다(구멍도 중복도 없다).
//
// 목록과 이 테스트가 어긋나면 목록이 아니라 테스트가 먼저 깨진다.
describe("comboBrushCatalog", () => {
  isolateTimers();
  function defaultTileset(): TilesetDef {
    const project = startOnRetiredCombinedTown(createBlankProject());
    const map = project.maps[project.startMapId]!;
    return project.tilesets[map.tilesetId]!;
  }
  describe("curated combo brush catalog contract", () => {
    it("ships at least one combination per declared category", () => {
      for (const category of COMBO_BRUSH_CATEGORIES) {
        expect(CURATED_COMBO_BRUSHES.some((entry) => entry.category === category.id)).toBe(true);
      }
    });

    it("gives every entry a unique id, a human name and a note", () => {
      const ids = CURATED_COMBO_BRUSHES.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const entry of CURATED_COMBO_BRUSHES) {
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.note.trim().length).toBeGreaterThan(0);
        expect(entry.sourceGroups.length).toBeGreaterThan(0);
        expect(comboBrushCatalogEntry(entry.id)).toBe(entry);
      }
    });

    // ① 근거 추적 — 인용한 가방 밖 타일은 목록에 들어올 수 없다.
    it("sources every cell tile from a CHIPSET_TILE_GROUPS bag the entry cites", () => {
      for (const entry of CURATED_COMBO_BRUSHES) {
        const allowed = new Set<number>();
        for (const key of entry.sourceGroups) {
          const bag = CHIPSET_TILE_GROUPS[key];
          expect(bag, `${entry.id} cites unknown group ${String(key)}`).toBeTruthy();
          for (const tile of bag) allowed.add(tile);
        }
        for (const cell of entry.cells) {
          expect(
            allowed.has(cell.tile),
            `${entry.id}: tile ${cell.tile} is not in [${entry.sourceGroups.join(", ")}]`,
          ).toBe(true);
        }
      }
    });

    // ② 레이어 라우팅 — 목록의 선언과 엔진 판정이 같아야 한다.
    it("declares the layer each tile actually lives on", () => {
      const tileset = defaultTileset();
      const mismatches: string[] = [];
      for (const entry of CURATED_COMBO_BRUSHES) {
        for (const cell of entry.cells) {
          const actual = defaultPaintLayerForTile(tileset, cell.tile);
          if (actual !== cell.layer) mismatches.push(`${entry.id} tile ${cell.tile}: declared ${cell.layer}, engine says ${actual}`);
        }
      }
      expect(mismatches).toEqual([]);
    });

    // ③ 발자국 — 선언한 폭·높이를 구멍 없이 정확히 채운다.
    it("fills the declared width x height footprint exactly once per cell", () => {
      for (const entry of CURATED_COMBO_BRUSHES) {
        expect(entry.width).toBeGreaterThan(0);
        expect(entry.height).toBeGreaterThan(0);
        const seen = new Set<string>();
        for (const cell of entry.cells) {
          expect(cell.dx, `${entry.id} dx out of range`).toBeGreaterThanOrEqual(0);
          expect(cell.dy, `${entry.id} dy out of range`).toBeGreaterThanOrEqual(0);
          expect(cell.dx).toBeLessThan(entry.width);
          expect(cell.dy).toBeLessThan(entry.height);
          const key = `${cell.dx},${cell.dy},${cell.layer}`;
          expect(seen.has(key), `${entry.id} duplicates ${key}`).toBe(false);
          seen.add(key);
        }
        // 셀이 최소한 각 행·열을 한 번씩은 건드려야 한다 — 빈 행/열이 있으면 선언이 과장이다.
        for (let dx = 0; dx < entry.width; dx += 1) {
          expect(entry.cells.some((cell) => cell.dx === dx), `${entry.id} column ${dx} empty`).toBe(true);
        }
        for (let dy = 0; dy < entry.height; dy += 1) {
          expect(entry.cells.some((cell) => cell.dy === dy), `${entry.id} row ${dy} empty`).toBe(true);
        }
      }
    });

    it("makes every entry a real composite combo brush, never a single cell", () => {
      for (const entry of CURATED_COMBO_BRUSHES) {
        const stamp = comboBrushStampFromCatalog(entry);
        expect(isComboBrush(stamp)).toBe(true);
        expect(stamp.origin).toBe("curated");
        expect(stamp.label).toBe(entry.name);
        expect(stamp.width).toBe(entry.width);
        expect(stamp.height).toBe(entry.height);
        expect(["lower", "upper", "mixed"]).toContain(comboBrushLayerSummary(stamp));
      }
    });

    it("exposes combinations only on the default chipset and only when the tiles exist", () => {
      expect(curatedComboBrushesForTileset({ isDefaultChipset: false, tileCount: 512 })).toEqual([]);
      const all = curatedComboBrushesForTileset({ isDefaultChipset: true, tileCount: 512 });
      expect(all.length).toBe(CURATED_COMBO_BRUSHES.length);
      // 타일 수가 모자란 칩셋에서는 범위를 넘는 조합이 조용히 빠진다(엉뚱한 그림 방지).
      const tiny = curatedComboBrushesForTileset({ isDefaultChipset: true, tileCount: 100 });
      expect(tiny.length).toBeLessThan(all.length);
      for (const entry of tiny) {
        for (const cell of entry.cells) expect(cell.tile).toBeLessThan(100);
      }
    });

    it("names the review owner so new presets cannot be added silently", () => {
      expect(COMBO_BRUSH_REVIEW_OWNER).toContain("editor-pre-edit-routing.md");
    });
  });
});

describe("farmlandGroup", () => {
  isolateTimers();
  // 농사 런타임은 타일셋 정의에서 경작지 그룹을 읽는다. 다른 시트에 EasyRPG 번호(187…)를 그리지 않는다.

  describe("farmlandGroupForTileset", () => {
    it("beodeul_city 는 번들 경작지 그룹 `farmland`(27,648번 꼬리)을 쓴다 — 187번(언덕 성벽)은 쓰지 않는다", () => {
      const tileset = createBeodeulCityTileset();
      expect(tileset.autotileGroups?.some((g) => g.id === "builtin_farmland")).toBeFalsy();
      const group = farmlandGroupForTileset(tileset);
      expect(group?.id).toBe("farmland");
      expect(group?.memberTileIds.every((tile) => tile >= 27648)).toBe(true);
      expect(group?.memberTileIds).not.toContain(FARMLAND_TILE.BODY);
    });

    it("beodeul_city 의 물 준 흙 그룹은 마른 흙과 같은 마스크마다 다른(어두운) 칸을 준다", () => {
      const tileset = createBeodeulCityTileset();
      const dry = farmlandGroupForTileset(tileset)!;
      const wet = wateredFarmlandGroupForTileset(tileset);
      expect(wet?.id).toBe("farmland_watered");
      expect(Object.keys(wet!.variantMap).sort()).toEqual(Object.keys(dry.variantMap).sort());
      for (const mask of Object.keys(dry.variantMap)) expect(wet!.variantMap[mask]).not.toBe(dry.variantMap[mask]);
    });

    it("물 준 흙 그룹이 없는 타일셋은 undefined (런타임은 틴트로 폴백)", () => {
      expect(wateredFarmlandGroupForTileset(undefined)).toBeUndefined();
      const tileset = { ...createBeodeulCityTileset(), autotileGroups: [] } as TilesetDef;
      expect(wateredFarmlandGroupForTileset(tileset)).toBeUndefined();
    });

    it("레거시 기본 타일셋(미지정)은 내장 경작지 그룹을 쓴다", () => {
      const group = farmlandGroupForTileset(undefined);
      expect(group?.id).toBe("builtin_farmland");
      expect(group?.variantMap["255"]).toBe(FARMLAND_TILE.BODY);
    });

    it("타일셋이 정의한 경작지 그룹을 번호 하드코딩 없이 그대로 쓴다", () => {
      const custom: AutotileGroup = {
        id: "farmland",
        name: "밭",
        memberTileIds: [9000, 9001],
        variantMap: { "255": 9001, "0": 9000 },
      };
      const tileset = { ...createBeodeulCityTileset(), autotileGroups: [custom] } as TilesetDef;
      expect(farmlandGroupForTileset(tileset)).toBe(custom);
    });

    it("멤버나 변형 지도가 비어 있는 그룹은 무시한다", () => {
      const empty: AutotileGroup = { id: "farmland", name: "밭", memberTileIds: [], variantMap: {} };
      const tileset = { ...createBeodeulCityTileset(), autotileGroups: [empty] } as TilesetDef;
      expect(farmlandGroupForTileset(tileset)).toBeUndefined();
    });
  });
});

describe("lakeAutotile", () => {
  isolateTimers();
  const WATER = LAKE_AUTOTILE_TILE.BODY;
  const LAND = 240;
  type TileGrid = readonly (readonly number[])[];
  function mapFromRows(rows: TileGrid): GameMap {
    const width = rows[0]?.length ?? 0;
    const height = rows.length;
    return {
      id: "test_map",
      name: "Test Map",
      width,
      height,
      tilesetId: "default",
      tileSize: 32,
      lowerTiles: rows.flat(),
      upperTiles: Array.from({ length: width * height }, () => 0),
      events: [],
    };
  }
  describe("lakeAutotileQuarterSources", () => {
    it("uses animated water body quarters when the water tile is surrounded", () => {
      const map = mapFromRows([
        [WATER, WATER, WATER],
        [WATER, WATER, WATER],
        [WATER, WATER, WATER],
      ]);

      expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
        LAKE_AUTOTILE_TILE.BODY,
        LAKE_AUTOTILE_TILE.BODY,
        LAKE_AUTOTILE_TILE.BODY,
        LAKE_AUTOTILE_TILE.BODY,
      ]);
    });

    it("uses outer corner quarter sources when two adjacent sides are land", () => {
      const map = mapFromRows([
        [LAND, LAND, LAND],
        [LAND, WATER, WATER],
        [LAND, WATER, WATER],
      ]);

      expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
        LAKE_AUTOTILE_TILE.OUTER_CORNER,
        LAKE_AUTOTILE_TILE.EDGE_NORTH,
        LAKE_AUTOTILE_TILE.EDGE_WEST,
        LAKE_AUTOTILE_TILE.BODY,
      ]);
    });

    it("uses INNER_CORNER(90) only when orthogonal are water and diagonal is land", () => {
      const map = mapFromRows([
        [LAND, WATER, WATER],
        [WATER, WATER, WATER],
        [WATER, WATER, WATER],
      ]);

      expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
        LAKE_AUTOTILE_TILE.INNER_CORNER, // 90 — 오목 모서리만
        LAKE_AUTOTILE_TILE.BODY,
        LAKE_AUTOTILE_TILE.BODY,
        LAKE_AUTOTILE_TILE.BODY,
      ]);
      expect(LAKE_AUTOTILE_TILE.INNER_CORNER).toBe(90);
    });

    it("straight south edge uses 60 strip NOT 90 — (24,30) 타입: 아래만 땅", () => {
      // N/W/E 물, S 땅 → 남쪽 직선 가장자리. inner corner 아님.
      const map = mapFromRows([
        [WATER, WATER, WATER],
        [WATER, WATER, WATER],
        [LAND, LAND, LAND],
      ]);
      const parts = lakeAutotileQuarterSources(map, 1, 1);
      const se = parts.find((part) => part.quarter === "se");
      const sw = parts.find((part) => part.quarter === "sw");
      const ne = parts.find((part) => part.quarter === "ne");
      const nw = parts.find((part) => part.quarter === "nw");

      // 아래 쿼터 = 가로 가장자리 60 (90 금지)
      expect(se?.tile).toBe(60);
      expect(sw?.tile).toBe(60);
      expect(se?.tile).not.toBe(90);
      expect(se?.sourceQuarter).toBe("se"); // 60 하단
      expect(sw?.sourceQuarter).toBe("sw");

      // 위 쿼터 = 사방이 물이므로 BODY (북쪽도 물)
      expect(ne?.tile).toBe(LAKE_AUTOTILE_TILE.BODY);
      expect(nw?.tile).toBe(LAKE_AUTOTILE_TILE.BODY);
    });

    it("90 is never selected for straight edges (N/S/E/W)", () => {
      const southEdge = mapFromRows([
        [WATER, WATER, WATER],
        [WATER, WATER, WATER],
        [LAND, LAND, LAND],
      ]);
      const northEdge = mapFromRows([
        [LAND, LAND, LAND],
        [WATER, WATER, WATER],
        [WATER, WATER, WATER],
      ]);
      const eastEdge = mapFromRows([
        [WATER, WATER, LAND],
        [WATER, WATER, LAND],
        [WATER, WATER, LAND],
      ]);
      const westEdge = mapFromRows([
        [LAND, WATER, WATER],
        [LAND, WATER, WATER],
        [LAND, WATER, WATER],
      ]);
      for (const map of [southEdge, northEdge, eastEdge, westEdge]) {
        const tiles = lakeAutotileQuarterSources(map, 1, 1).map((p) => p.tile);
        expect(tiles.includes(90)).toBe(false);
      }
    });

    it("east straight edge (30,25 type): tile 30 with matching side source, not 90", () => {
      const map = mapFromRows([
        [WATER, WATER, LAND],
        [WATER, WATER, LAND],
        [WATER, WATER, LAND],
      ]);
      const parts = lakeAutotileQuarterSources(map, 1, 1);
      const ne = parts.find((p) => p.quarter === "ne");
      const se = parts.find((p) => p.quarter === "se");
      expect(ne?.tile).toBe(30);
      expect(se?.tile).toBe(30);
      expect(ne?.sourceQuarter).toBe("ne");
      expect(se?.sourceQuarter).toBe("se");
    });
  });
  describe("sourceQuarterForLakeChip", () => {
    it("INNER 90: dest se uses se source (not confused with south edge)", () => {
      expect(sourceQuarterForLakeChip(90, "se")).toBe("se");
      expect(sourceQuarterForLakeChip(91, "se")).toBe("se");
      expect(sourceQuarterForLakeChip(92, "nw")).toBe("nw");
    });
  });
  describe("roadAutotileTileForCell", () => {
    it("treats tile 360 as the editable road center and resolves it to shaped road pieces", () => {
      const map = mapFromRows([
        [LAND, LAND, LAND],
        [LAND, TILE.PATH, TILE.PATH],
        [LAND, TILE.PATH, TILE.PATH],
      ]);

      expect(roadAutotileTileForCell(map, { x: 1, y: 1 })).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
      expect(roadAutotileTileForCell(map, { x: 2, y: 2 })).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
    });
  });
});

describe("mapEditCommands", () => {
  isolateTimers();
  function resetEditorState(): void {
    editorState.set({
      currentMapId: null,
      tool: "paint",
      layer: "lower",
      selectedTile: TILE.GRASS,
      selectedEventId: null,
      selection: null,
      clipboard: null,
    });
  }
  beforeEach(() => {
    store.replace(startOnRetiredCombinedTown(createBlankProject()));
    resetMapEditHistory();
    resetEditorState();
  });
  describe("map edit commands", () => {
    it("copies and pastes a selected lower-layer tile block", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      paintTile(mapId, "lower", 1, 1, TILE.WATER);
      editorState.set({ layer: "lower" });

      expect(selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 1, height: 1 })).toBe(true);
      expect(copySelection(mapId)).toBe(true);
      expect(pasteClipboard(mapId, 2, 1)).toBe(true);

      const map = store.getCurrent().maps[mapId];
      expect(map.lowerTiles[1 * map.width + 2]).toBe(TILE.WATER);
    });

    it("restores and reapplies a tile edit through undo/redo", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const index = 1 * map.width + 1;
      const before = map.lowerTiles[index];

      recordProjectSnapshot();
      paintTile(mapId, "lower", 1, 1, TILE.WATER);
      expect(store.getCurrent().maps[mapId].lowerTiles[index]).toBe(TILE.WATER);

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles[index]).toBe(before);

      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles[index]).toBe(TILE.WATER);
    });

    it("stores water autotile representative ids as ordinary lower-layer paint data", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;

      paintTile(mapId, "lower", 1, 1, LAKE_AUTOTILE_TILE.BODY);

      const map = store.getCurrent().maps[mapId];
      expect(map.lowerTiles[1 * map.width + 1]).toBe(LAKE_AUTOTILE_TILE.BODY);
    });

    it("routes transparent props to the upper layer even when lower is requested", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      // 투명 배경 소품(나무 263, 표지판 319)은 하위에 깔리면 검게 보이므로 상위 전용 —
      // 하위 요청도 상위로 라우팅되어 지면을 보존한다.
      const propPlacements = [
        { tile: 263, x: 1, y: 1 },
        { tile: 319, x: 4, y: 1 },
      ] as const;

      for (const placement of propPlacements) {
        const tileIndex = placement.y * map.width + placement.x;
        expect(isHarnessStackableTile(project.tilesets[map.tilesetId], placement.tile)).toBe(true);
        const groundBefore = store.getCurrent().maps[mapId].lowerTiles[tileIndex];
        paintTile(mapId, "lower", placement.x, placement.y, placement.tile);

        const updated = store.getCurrent().maps[mapId];
        expect(updated.upperTiles[tileIndex]).toBe(placement.tile);
        expect(updated.lowerTiles[tileIndex]).toBe(groundBefore);
        expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
      }
    });

    it("replaces mixed transparent prop objects on the selected upper layer", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const tileIndex = 2 * map.width + 2;

      paintTile(mapId, "upper", 2, 2, 263);
      paintTile(mapId, "upper", 2, 2, 319);

      const updated = store.getCurrent().maps[mapId];
      expect(updated.upperTiles[tileIndex]).toBe(319);
      expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
    });

    it("keeps a single upper tile when painting transparent props repeatedly", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const tileIndex = 2 * map.width + 2;
      const groundBefore = map.lowerTiles[tileIndex];

      // 263/319는 투명 소품이라 요청 레이어와 무관하게 상위 단일 슬롯에 남는다(스택 없음).
      paintTile(mapId, "upper", 2, 2, 263);
      paintTile(mapId, "upper", 2, 2, 263);
      paintTile(mapId, "lower", 2, 2, 319); // 하위 요청도 상위로 라우팅 — 마지막 붓이 이긴다.
      paintTile(mapId, "lower", 2, 2, 319);

      const updated = store.getCurrent().maps[mapId];
      expect(updated.upperTiles[tileIndex]).toBe(319);
      expect(updated.lowerTiles[tileIndex]).toBe(groundBefore);
      expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
      expect(updated.lowerTileStacks?.[tileIndex]).toBeUndefined();
    });

    it("routes windows and fences to the upper layer so the lower ground is preserved", () => {
      // Phase 0-5 회귀: 창문/울타리(하네스가 lower로 고정하는 stackable 소품)를 잔디 위에 칠해도
      // 단일 슬롯 lowerTiles를 덮어써 지면을 지우면 안 된다. 상위 레이어로 라우팅해 지면을 보존한다.
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const windowIndex = 2 * map.width + 2;
      const fenceIndex = 2 * map.width + 3;

      paintTile(mapId, "lower", 2, 2, TILE.GRASS);
      paintTile(mapId, "lower", 3, 2, TILE.GRASS);
      paintTile(mapId, "upper", 2, 2, 85);
      paintTile(mapId, "upper", 3, 2, 378);

      const updated = store.getCurrent().maps[mapId];
      // 지면(잔디)은 lower에 보존된다.
      expect(updated.lowerTiles[windowIndex]).toBe(TILE.GRASS);
      expect(updated.lowerTiles[fenceIndex]).toBe(TILE.GRASS);
      // 창문/울타리는 상위 레이어 오버레이로 올라간다.
      expect(updated.upperTiles[windowIndex]).toBe(85);
      expect(updated.upperTiles[fenceIndex]).toBe(378);
      expect(updated.lowerTileStacks?.[windowIndex]).toBeUndefined();
      expect(updated.lowerTileStacks?.[fenceIndex]).toBeUndefined();
    });

    it("shapes painted road tiles with the bundled road autotile tool", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const rect: RoadRect = { x: 1, y: 1, width: 3, height: 3 };
      const map = store.getCurrent().maps[mapId];
      const expected = structuredClone(map);
      paintRoadRect(expected, rect);
      shapeRoadEdges(expected, [rect]);

      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          paintTile(mapId, "lower", x, y, DIRT_ROAD_TILE.BODY);
        }
      }

      const actual = store.getCurrent().maps[mapId];
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          const index = y * actual.width + x;
          expect(actual.lowerTiles[index]).toBe(expected.lowerTiles[index]);
        }
      }
    });

    it("keeps events inside the map when resizing smaller", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const eventId = addEvent(mapId, 10, 8);
      paintTile(mapId, "lower", 1, 1, 263);
      paintTile(mapId, "upper", 2, 2, 85);
      paintTile(mapId, "upper", 5, 5, 85);

      resizeMap(mapId, 4, 4);

      const resized = store.getCurrent().maps[mapId];
      const event = resized.events.find((item) => item.id === eventId);
      expect(event?.x).toBe(3);
      expect(event?.y).toBe(3);
      // 263(나무)은 투명 소품이라 lower 요청도 upper로 라우팅된다.
      expect(resized.upperTiles[1 * resized.width + 1]).toBe(263);
      // 85(창문)는 stackable+lower 소품이라 upper로 라우팅된다(지면 보존).
      expect(resized.upperTiles[2 * resized.width + 2]).toBe(85);
      expect(resized.lowerTileStacks?.[1 * resized.width + 1]).toBeUndefined();
      expect(resized.lowerTileStacks?.[2 * resized.width + 2]).toBeUndefined();
      expect(resized.upperTileStacks?.[5 * resized.width + 5]).toBeUndefined();
    });

    it("shifts map tile content and events by a signed offset", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const eventId = addEvent(mapId, 1, 1);

      paintTile(mapId, "lower", 1, 1, TILE.WATER);
      // WALL(306)은 하위 홈 타일이라 엄격 분류에서 상위에 놓이지 않는다.
      // 상위 레이어 시프트 검증에는 상위로 라우팅되는 소품 85(창문)를 쓴다.
      paintTile(mapId, "upper", 1, 1, 85);

      expect(shiftMapContent(mapId, { dx: 1, dy: 1 })).toBe(true);

      const shifted = store.getCurrent().maps[mapId];
      const edgeIndex = 0;
      const newIndex = 2 * shifted.width + 2;
      const event = shifted.events.find((item) => item.id === eventId);
      expect(shifted.lowerTiles[edgeIndex]).toBe(TILE.GRASS);
      expect(shifted.upperTiles[edgeIndex]).toBe(TILE.EMPTY);
      expect(shifted.lowerTiles[newIndex]).toBe(TILE.WATER);
      expect(shifted.upperTiles[newIndex]).toBe(85);
      expect(event?.x).toBe(2);
      expect(event?.y).toBe(2);
    });

    it("edits terrain tags and map tree parentage through store actions", () => {
      const project = store.getCurrent();
      const rootMapId = project.startMapId;
      const childMapId = addMap("Interior");
      const grandChildMapId = addMap("Basement");

      moveMapInTree(grandChildMapId, childMapId);
      setTerrainTag(COMBINED_TOWN_TILESET_ID, TILE.WATER, 7);

      const current = store.getCurrent();
      expect(current.mapTree.children.some((node) => node.mapId === childMapId)).toBe(true);
      const childNode = current.mapTree.children.find((node) => node.mapId === childMapId);
      expect(childNode?.children.some((node) => node.mapId === grandChildMapId)).toBe(true);
      expect(current.mapTree.mapId).toBe(rootMapId);
      expect(current.tilesets[COMBINED_TOWN_TILESET_ID].terrain[TILE.WATER]).toBe(7);
    });

    it("keeps the selected tile inside the current map chipset when changing map tilesets", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const interiorTilesetId = "easyrpg_chipset_interior";
      const interiorTileset = project.tilesets[interiorTilesetId];
      if (!interiorTileset) throw new Error("expected bundled interior chipset");
      editorState.set({
        activePaletteStamp: {
          cells: [{ dx: 0, dy: 0, layer: "lower", tile: interiorTileset.count + 12 }],
          height: 1,
          source: { endTile: interiorTileset.count + 12, startTile: interiorTileset.count + 12 },
          width: 1,
        },
        currentMapId: mapId,
        selectedTile: interiorTileset.count + 12,
      });

      setMapTileset(mapId, interiorTilesetId);

      expect(store.getCurrent().maps[mapId].tilesetId).toBe(interiorTilesetId);
      expect(editorState.get().selectedTile).toBe(0);
      expect(editorState.get().activePaletteStamp).toBeNull();
    });
  });
});

// test/roadObstacleAvoidance.test.ts
// 고정하는 계약: 도로/길 툴은 건물을 관통하지 않는다.
//   (1) paint_road 가 집 사이를 가로지르면 집 칸을 덮지 않고 우회한다
//   (2) 우회해도 경로 연결성(문 앞 → 목표)이 유지된다
//   (3) 장애물이 없는 맵에서는 결과가 예전과 바이트 동일하다(퇴행 방지)
//   (4) lay_path 도 같은 보호를 받는다 — 두 레이어 바이트 동일로 검사한다
//   (5) 폭 셀은 경로가 아니므로 우회로를 만들지 않는다(엉뚱한 들판 길 금지)
//   (6) 끊긴 길은 커밋하지 않고 좌표와 함께 거절한다
//   (7) 나무는 길이 치우고, 물은 마른 우회로가 없을 때만 건넌다
describe("roadObstacleAvoidance", () => {
  isolateTimers();
  const MAP_ID = "map_road_obstacle";
  function context(width = 40, height = 24): { readonly ctx: ToolContext; readonly mapId: string } {
    // The road tiles, walls (374), trees (290/260), water and the 흙길 path material are combined-town ones. That sheet is retired
    // from new projects, so restore it and build the map on it.
    const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
    const created = runTool(ctx, "create_map", { id: MAP_ID, name: "도로 우회", width, height, tilesetId: COMBINED_TOWN_TILESET_ID });
    expect(created.ok, created.summary).toBe(true);
    return { ctx, mapId: MAP_ID };
  }
  function mapOf(ctx: ToolContext): GameMap {
    const map = ctx.project.maps[MAP_ID];
    if (!map) throw new Error("missing map");
    return map;
  }
  function expectOk(result: ToolResult): void {
    expect(result.ok, result.summary).toBe(true);
  }
  function buildHouse(ctx: ToolContext, origin: Point, width: number, height: number): void {
    expectOk(runTool(ctx, "build_house", { mapId: MAP_ID, origin, width, height, material: "plaster" }));
  }
  // 통행 불가 + 저작물이 있는 칸 = 도로가 덮으면 안 되는 칸.
  function blockedCells(project: Project, map: GameMap): ReadonlySet<string> {
    const cells = new Set<string>();
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        const authored = (map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY
          || (map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY;
        if (authored && !isPassable(project, map, x, y)) cells.add(`${x},${y}`);
      }
    }
    return cells;
  }
  // 셀별 (lower,upper) 스냅샷 — "덮지 않았다"를 두 레이어 바이트 동일로 검사한다.
  function layerSnapshot(map: GameMap, keys: Iterable<string>): ReadonlyMap<string, string> {
    const snapshot = new Map<string, string>();
    for (const key of keys) {
      const [x, y] = key.split(",").map(Number);
      const index = y * map.width + x;
      snapshot.set(key, `${map.lowerTiles[index] ?? TILE.EMPTY}/${map.upperTiles[index] ?? TILE.EMPTY}`);
    }
    return snapshot;
  }
  function changedCells(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
    return [...before.entries()].filter(([key, value]) => after.get(key) !== value).map(([key]) => key);
  }
  function roadKeys(map: GameMap): ReadonlySet<string> {
    const keys = new Set<string>();
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (isRoadTile(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) keys.add(`${x},${y}`);
      }
    }
    return keys;
  }
  // 도로 칸 집합이 4-이웃으로 이어져 있는가(끊긴 조각 수).
  function roadFragments(map: GameMap): number {
    const remaining = new Set(roadKeys(map));
    let fragments = 0;
    while (remaining.size > 0) {
      fragments += 1;
      const seed = remaining.values().next().value as string;
      const queue = [seed];
      remaining.delete(seed);
      while (queue.length > 0) {
        const [x, y] = (queue.pop() as string).split(",").map(Number);
        for (const step of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const key = `${x + step[0]},${y + step[1]}`;
          if (remaining.delete(key)) queue.push(key);
        }
      }
    }
    return fragments;
  }
  describe("도로 우회 — 건물 관통 방지", () => {
    it("두 집 사이를 가로지르는 paint_road 가 집 칸을 한 칸도 덮지 않는다", () => {
      const { ctx } = context();
      buildHouse(ctx, { x: 10, y: 6 }, 8, 8);
      buildHouse(ctx, { x: 24, y: 6 }, 8, 8);
      const map = mapOf(ctx);
      const protectedCells = blockedCells(ctx.project, map);
      expect(protectedCells.size).toBeGreaterThan(20);
      const before = layerSnapshot(map, protectedCells);
      const houses = captureHouseProtection(ctx.project);

      // 집 몸통을 정통으로 관통하는 폴리라인 — 벽·지붕이 이 경로상에 있다.
      const result = runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 2, y: 9 }, { x: 37, y: 9 }],
        style: "dirt",
        naturalness: 0,
      });

      expectOk(result);
      const after = mapOf(ctx);
      expect(changedCells(before, layerSnapshot(after, protectedCells))).toEqual([]);
      expect(captureHouseProtection(ctx.project)).toEqual(houses);
      expect((result.data as { obstacleCells: number }).obstacleCells).toBeGreaterThan(0);
    });

    it("집을 피한 도로가 하나로 이어진다(우회로가 연결성을 지킨다)", () => {
      const { ctx } = context();
      buildHouse(ctx, { x: 14, y: 5 }, 10, 9);

      expectOk(runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
        style: "dirt",
        naturalness: 0,
      }));

      expect(roadFragments(mapOf(ctx))).toBe(1);
    });

    it("집을 관통하던 칸 수를 결과 data 와 경고로 보고한다", () => {
      const { ctx } = context();
      buildHouse(ctx, { x: 14, y: 5 }, 10, 9);

      const result = runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
        style: "dirt",
        naturalness: 0,
      });

      expectOk(result);
      const data = result.data as { detouredSegments: number; obstacleCells: number; structureCells: number };
      expect(data.obstacleCells).toBeGreaterThan(0);
      expect(data.structureCells).toBeGreaterThan(0);
      expect(data.detouredSegments).toBeGreaterThan(0);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("통행 불가");
    });

    it("장애물이 없으면 경로 셀을 그대로 쓴다(기존 결과 유지)", () => {
      const { ctx } = context();
      const map = mapOf(ctx);
      const mask = roadObstacleMaskFor(ctx.project, map);
      const candidate: readonly Point[] = [{ x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }];

      const repaired = repairRoadPath(map, mask, candidate);

      expect(repaired.cells).toEqual(candidate);
      expect(repaired.blocked).toBe(0);
      expect(repaired.detours).toBe(0);
      expect(repaired.gaps).toBe(0);
      expect(repaired.startBlocked).toBe(false);
      expect(repaired.endBlocked).toBe(false);
    });

    it("빈 칸(EMPTY)은 장애물이 아니다 — 갓 만든 맵에서 길이 안 깔리는 퇴행 방지", () => {
      const { ctx } = context();
      const map = mapOf(ctx);
      const index = 9 * map.width + 5;
      map.lowerTiles[index] = TILE.EMPTY;
      map.upperTiles[index] = TILE.EMPTY;

      expect(roadObstacleMaskFor(ctx.project, map)(5, 9)).toBe("open");
    });

    it("폭 셀은 경로가 아니라 표본이므로 우회로를 만들지 않는다", () => {
      const { ctx } = context();
      buildHouse(ctx, { x: 14, y: 7 }, 10, 10);
      const map = mapOf(ctx);
      const mask = roadObstacleMaskFor(ctx.project, map);
      // 서로 인접하지 않은 폭 표본들 — 이 사이를 이으면 들판에 엉뚱한 길이 난다.
      const samples: readonly Point[] = [{ x: 12, y: 11 }, { x: 16, y: 11 }, { x: 27, y: 11 }];

      const filtered = filterRoadWidthCells(mask, samples);

      expect(filtered.cells).toEqual([{ x: 12, y: 11 }, { x: 27, y: 11 }]);
      expect(filtered.blocked).toBe(1);
      expect(filtered.structureCells).toBe(1);
    });

    it("자연도 높은 paint_road 가 요청 경로 주변만 칠한다(엉뚱한 들판 길 금지)", () => {
      const { ctx } = context();
      buildHouse(ctx, { x: 14, y: 7 }, 10, 10);

      expectOk(runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 3, y: 12 }, { x: 36, y: 12 }],
        style: "dirt",
        naturalness: 0.9,
        seed: 1,
      }));

      const painted = [...roadKeys(mapOf(ctx))].map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      });
      // 집 위(y<7)는 요청 경로(y=12)와 무관한 들판이다 — 여기 칠하면 우회로가 폭 셀을 이은 것.
      expect(painted.filter((cell) => cell.y < 7)).toEqual([]);
    });

    it("건물에 완전히 막히면 끊긴 길을 커밋하지 않고 좌표와 함께 거절한다", () => {
      const { ctx } = context(12, 8);
      const map = mapOf(ctx);
      // 세로 벽으로 맵을 두 쪽으로 가른다 — 우회로가 존재할 수 없다.
      for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 6] = 374;
      const before = layerSnapshot(map, blockedCells(ctx.project, map));

      const result = runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 2, y: 4 }, { x: 10, y: 4 }],
        style: "dirt",
        naturalness: 0,
      });

      expect(result.ok).toBe(false);
      expect(result.summary).toContain("끊깁");
      expect(result.summary).toContain("6,4");
      expect(changedCells(before, layerSnapshot(mapOf(ctx), before.keys()))).toEqual([]);
      expect(roadKeys(mapOf(ctx)).size).toBe(0);
    });

    it("끝점이 벽이면 벽 앞까지 깔고 endpointBlocked 로 알린다", () => {
      const { ctx } = context(12, 8);
      const map = mapOf(ctx);
      map.lowerTiles[4 * map.width + 9] = 374;

      const result = runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 2, y: 4 }, { x: 9, y: 4 }],
        style: "dirt",
        naturalness: 0,
      });

      expectOk(result);
      const data = result.data as { endpointBlocked: boolean; disconnectedSegments: number };
      expect(data.endpointBlocked).toBe(true);
      expect(data.disconnectedSegments).toBe(0);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("끝점");
      expect(mapOf(ctx).lowerTiles[4 * map.width + 9]).toBe(374);
    });

    it("나무는 길이 치운다 — 숲을 가로지르는 길이 뱀처럼 휘지 않는다", () => {
      const { ctx } = context(20, 10);
      const map = mapOf(ctx);
      // 나무 = 통행 불가 밑동(290) + ★수관(260).
      map.lowerTiles[5 * map.width + 9] = 290;
      map.upperTiles[5 * map.width + 9] = 260;

      expect(roadObstacleMaskFor(ctx.project, map)(9, 5)).toBe("open");

      const result = runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 2, y: 5 }, { x: 17, y: 5 }],
        style: "dirt",
        naturalness: 0,
      });

      expectOk(result);
      expect((result.data as { detouredSegments: number }).detouredSegments).toBe(0);
      expect(isRoadTile(mapOf(ctx).lowerTiles[5 * map.width + 9] ?? TILE.EMPTY)).toBe(true);
    });

    it("물은 마른 우회로가 있으면 살리고, 없으면 건너며 좌표로 알린다", () => {
      const { ctx } = context(20, 10);
      const map = mapOf(ctx);
      for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 10] = TILE.WATER;

      const result = runTool(ctx, "paint_road", {
        mapId: MAP_ID,
        points: [{ x: 2, y: 5 }, { x: 17, y: 5 }],
        style: "dirt",
        naturalness: 0,
      });

      expectOk(result);
      const data = result.data as { disconnectedSegments: number; waterCrossings: number };
      expect(data.disconnectedSegments).toBe(0);
      expect(data.waterCrossings).toBeGreaterThan(0);
      expect(roadFragments(mapOf(ctx))).toBe(1);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("다리");
    });

    it("lay_path 도 집 칸을 덮지 않는다(두 레이어 바이트 동일)", () => {
      const { ctx } = context();
      buildHouse(ctx, { x: 14, y: 5 }, 10, 9);
      const protectedCells = blockedCells(ctx.project, mapOf(ctx));
      expect(protectedCells.size).toBeGreaterThan(20);
      const before = layerSnapshot(mapOf(ctx), protectedCells);
      const houses = captureHouseProtection(ctx.project);

      const result = runTool(ctx, "lay_path", {
        mapId: MAP_ID,
        points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
        material: "흙길",
        naturalness: 0,
        seed: 5,
      });

      expectOk(result);
      expect(changedCells(before, layerSnapshot(mapOf(ctx), protectedCells))).toEqual([]);
      expect(captureHouseProtection(ctx.project)).toEqual(houses);
      expect(roadFragments(mapOf(ctx))).toBe(1);
      const data = result.data as { obstacleCells: number; structureCells: number; detouredSegments: number };
      expect(data.structureCells).toBeGreaterThan(0);
      expect(data.detouredSegments).toBeGreaterThan(0);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("통행 불가");
    });

    // Removed it "stamp_structure road 템플릿의 길이": stamp_structure was removed from the tool registry on purpose.
  });
  describe("roads respect completed-house geometry", () => {
    it("blocks passable bbox gaps, empty ridge, deck attachment, and recorded placements only", () => {
      const { ctx } = context();
      const map = mapOf(ctx);
      map.layoutPlan = { version: 1, kind: "houses", regions: [
        { id: "deck", role: "house", label: "Deck", x: 10, y: 5, w: 8, h: 8,
          shape: "rooftop-deck", doorAt: { x: 12, y: 12 } },
      ] };
      map.upperTiles[13 * map.width + 15] = 322;
      map.lowerTiles[4 * map.width + 10] = TILE.EMPTY;
      map.structurePlacements = [{ id: "human", kitId: "human-kit", x: 25, y: 5, w: 2, h: 2,
        before: { lower: [], upper: [] }, afterHash: "recorded" }];
      const mask = roadObstacleMaskFor(ctx.project, map);
      expect(isPassable(ctx.project, map, 12, 8)).toBe(true);
      for (let y = 4; y < 13; y += 1) {
        for (let x = 10; x < 18; x += 1) expect(mask(x, y), `${x},${y}`).toBe("structure");
      }
      expect(mask(15, 13)).toBe("structure");
      expect(mask(14, 13)).toBe("open");
      expect(mask(25, 5)).toBe("structure");
      expect(mask(26, 6)).toBe("structure");
      expect(mask(25, 4)).toBe("open");
      expect(mask(9, 4)).toBe("open");
    });

    it.each([
      { tool: "paint_road", args: { style: "dirt" }, tile: DIRT_ROAD_TILE.BODY },
      { tool: "paint_road", args: { style: "sand" }, tile: SAND_TILE.BODY },
      { tool: "lay_path", args: { material: "흙길" }, tile: DIRT_ROAD_TILE.BODY },
    ])("$tool $tile preserves protected autotile neighbors and their stacks", ({ tool, args, tile }) => {
      const { ctx } = context();
      const map = mapOf(ctx);
      map.layoutPlan = { version: 1, kind: "houses", regions: [
        { id: "house", role: "house", label: "House", x: 10, y: 5, w: 8, h: 8 },
      ] };
      const ridge = 4 * map.width + 10;
      map.lowerTiles[ridge] = tile;
      map.lowerTileStacks = { [ridge]: [TILE.GRASS, tile] };
      map.upperTileStacks = { [ridge]: [] };
      const before = captureHouseProtection(ctx.project);
      expectOk(runTool(ctx, tool, { mapId: MAP_ID, points: [{ x: 3, y: 3 }, { x: 30, y: 3 }],
        naturalness: 0, ...args }));
      expect(captureHouseProtection(ctx.project)).toEqual(before);
      expect(mapOf(ctx).lowerTiles[3 * map.width + 3]).not.toBe(TILE.GRASS);
      expect(mapOf(ctx).lowerTiles[3 * map.width + 30]).not.toBe(TILE.GRASS);
    });

    it.each(["paint_road", "lay_path"])("%s rejects a metadata-only barrier instead of committing disconnected pieces", (tool) => {
      const { ctx } = context(12, 8);
      mapOf(ctx).layoutPlan = { version: 1, kind: "houses", regions: [
        { id: "barrier", role: "house", label: "Barrier", x: 6, y: 0, w: 1, h: 8 },
      ] };
      const before = structuredClone(ctx.project);
      const result = runTool(ctx, tool, { mapId: MAP_ID, points: [{ x: 2, y: 4 }, { x: 10, y: 4 }],
        naturalness: 0, ...(tool === "paint_road" ? { style: "dirt" } : { material: "흙길" }) });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe(tool === "paint_road" ? "road-blocked" : "path-blocked");
      expect(ctx.project).toEqual(before);
      expect(roadKeys(mapOf(ctx)).size).toBe(0);
    });
  });
});
