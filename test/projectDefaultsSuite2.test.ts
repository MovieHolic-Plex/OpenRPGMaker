import { describe, expect, it, beforeEach } from "vitest";
import { LAKE_AUTOTILE_TILE, lakeAutotileQuarterSources, sourceQuarterForLakeChip } from "@/project/defaults/lakeAutotile";
import { createBlankProject, COMBINED_TOWN_TILESET_ID, ensureSwitchVariableSlots, createStarterMap, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILE_SIZE, DEFAULT_EASYRPG_CHARSET_ID, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY, ensureBundledResourceProfiles, removeLegacyRmTileset } from "@/project/defaults";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { TILE, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID, DEFAULT_STATE_ID, DEFAULT_TILE_COUNT } from "@/project/defaults/constants";
import { runTool } from "@/editor/tools/toolRunner";
import { isMapWaterTile, waterBoundsInMap } from "@/editor/tools/queryTools";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { AUTOTILE_DIR, autotileEditTriggersGroup, autotileNeighborMask, autotileVariantForCell, autotileVariantForMask, buildEdgeCornerVariantMap, shapeAutotileGroupAround, autotileLayerView } from "@/project/defaults/autotileEngine";
import { DEFAULT_AUTOTILE_GROUPS, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP, autotileGroupsForTileset, cloneDefaultAutotileGroups } from "@/project/defaults/autotileGroups";
import { DIRT_ROAD_TILE, SAND_TILE, CHIPSET_TILE_GROUPS, describeChipsetTile, tileLabelForIndex, FARMLAND_TILE, TERRAIN_TAG, dirtLikeTiles } from "@/project/defaults/chipsetMapping";
import { type AutotileGroup, type GameMap, type TilesetDef, type Project, type Command, SCHEMA_VERSION } from "@/project/types";
import { setLayerTileAt } from "@/project/mapLayers";
import { createBattleRuntime, type ActorCommand, type BattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { createBattleSequencer } from "@/player/battleSequencer";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import { ACTOR_MAGE_ID } from "@/project/defaults/defaultDatabaseRecordIds";
import { chipsetAnimationKey, TEX_TILESET, TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { animationFrameForTile, animationKeyForTile, animationStripForTile, CHIPSET_ANIMATION_FPS, WATERFALL_ANIMATION_FPS } from "@/project/defaults/chipsetAnimation";
import { defaultTilesets, retiredEasyRpgChipsetTileset, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses, isHarnessStackableTile } from "@/project/tilesetHarness";
import { searchResources } from "@/assets/resourceSearch";
import { CHIPSET_LABEL_CORRECTIONS, seedChipsetLabelCorrections } from "@/project/defaults/chipsetLabelCorrections";
import { deserialize, serialize } from "@/project/io";
import { worldTileDescription } from "@/project/defaults/worldTileDescriptions";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { COMBO_BRUSH_CATEGORIES, COMBO_BRUSH_REVIEW_OWNER, CURATED_COMBO_BRUSHES, comboBrushCatalogEntry, comboBrushStampFromCatalog, curatedComboBrushesForTileset } from "@/editor/comboBrushCatalog";
import { comboBrushLayerSummary, isComboBrush } from "@/editor/comboBrush";
import { defaultPaintLayerForTile } from "@/editor/tileLayerClassification";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { farmlandGroupForTileset, wateredFarmlandGroupForTileset } from "@/project/defaults/farmlandGroup";
import { roadAutotileTileForCell, paintRoadRect, shapeRoadEdges, type RoadRect, isRoadTile } from "@/project/defaults/roadAutotile";
import { addMap, moveMapInTree, paintTile, resizeMap, setMapTileset } from "@/editor/actions";
import { addEvent } from "@/editor/eventActions";
import { copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { setTerrainTag } from "@/editor/tilesetActions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { filterRoadWidthCells, repairRoadPath, roadObstacleMaskFor } from "@/editor/tools/roadObstacles";
import type { Point } from "@/editor/tools/mapHelpers";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { isPassable } from "@/project/collision";
import { buildFieldBattleMonsterEvent, buildComplexEnemy, buildComplexTroop, buildComplexMonsterBundle, layoutTroopMembers, seedHomeDungeonComplexTroops } from "@/project/defaults/complexMonsterAuthoring";
import { evalCondition, startSession } from "@/project/session";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { CURRENT_MONSTER_STAND_IN } from "@/project/defaults/currentMonsterStandIns";
import { elementMultiplierFor } from "@/battle/battlePredict";
import { affinitySentences, nextAffinityGrade } from "@/editor/panels/databaseElementAffinity";
import { applyDefaultElementAffinities } from "@/project/defaults/defaultElementAffinities";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { ATLAS_CARTOGRAPHY_ID } from "@/project/defaults/atlasCartography";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import sampleProject from "./fixtures/projects/oprn-sample-v3.json";
import { createDungeonTerrainAutotileGroups, DUNGEON_TERRAIN_AUTOTILE_PREFIX } from "@/project/defaults/dungeonTerrainAutotiles";
import { readFileSync } from "node:fs";
import { archetypeActions, BOSS_ELEMENT_SKILLS, SPIRIT_ELEMENT_SKILLS } from "@/project/defaults/enemyActionArchetypes";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { generatedEnemyRecords } from "@/project/defaults/generatedEnemyRecords";
import { DEFAULT_ELEMENT_RATE_LABELS } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { composeCombinedTownRetroWorldTileset } from "@/project/defaults/combinedTownRetroWorld";
import { isolateTimers } from "./mergedTeardown";

describe("autotile", () => {
  isolateTimers();
  describe("autotile", () => {
    isolateTimers();
    type TileGrid = readonly (readonly number[])[];
    function mapFromRows(rows: TileGrid): { readonly width: number; readonly height: number; readonly lowerTiles: readonly number[] } {
      return {
        width: rows[0]?.length ?? 0,
        height: rows.length,
        lowerTiles: rows.flat(),
      };
    }
    describe("animated water autotile", () => {
      it("uses animated water body quarters when surrounded", () => {
        const water = LAKE_AUTOTILE_TILE.BODY;
        const map = mapFromRows([
          [water, water, water],
          [water, water, water],
          [water, water, water],
        ]);

        expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
          LAKE_AUTOTILE_TILE.BODY,
          LAKE_AUTOTILE_TILE.BODY,
          LAKE_AUTOTILE_TILE.BODY,
          LAKE_AUTOTILE_TILE.BODY,
        ]);
      });

      it("treats map bounds as land for water edges", () => {
        const water = LAKE_AUTOTILE_TILE.BODY;
        const map = mapFromRows([[water, water]]);

        expect(lakeAutotileQuarterSources(map, 0, 0).map((part) => part.tile)).toEqual([
          LAKE_AUTOTILE_TILE.OUTER_CORNER,
          LAKE_AUTOTILE_TILE.EDGE_NORTH,
          LAKE_AUTOTILE_TILE.OUTER_CORNER,
          LAKE_AUTOTILE_TILE.EDGE_SOUTH,
        ]);
      });
    });
  });
  describe("mapRegionWaterAndCompact", () => {
    isolateTimers();
    // toolResultForModel is private — exercise via compact behavior through session isn't easy;
    // water detection and get_map_region data.water are the public contract.

    describe("isMapWaterTile / waterBoundsInMap", () => {
      it("treats lake autotile and TILE.WATER as water", () => {
        expect(isMapWaterTile(TILE.WATER)).toBe(true);
        // body tile from lake set if exported
        const body = (LAKE_AUTOTILE_TILE as { BODY?: number }).BODY ?? (LAKE_AUTOTILE_TILE as unknown as number);
        if (typeof body === "number") {
          expect(isMapWaterTile(body)).toBe(true);
        }
      });

      it("get_map_region returns water.bounds for lake tiles", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId]!;
        // paint a small water blob using TILE.WATER
        for (let y = 5; y < 9; y += 1) {
          for (let x = 6; x < 11; x += 1) {
            map.lowerTiles[y * map.width + x] = TILE.WATER;
          }
        }
        const result = runTool({ project }, "get_map_region", {
          mapId,
          x: 0,
          y: 0,
          w: map.width,
          h: map.height,
        });
        expect(result.ok).toBe(true);
        const data = result.data as {
          water: { cellCount: number; bounds: { x: number; y: number; w: number; h: number } | null };
          grid: string[];
        };
        expect(data.water.cellCount).toBe(4 * 5);
        expect(data.water.bounds).toEqual({ x: 6, y: 5, w: 5, h: 4 });
        // grid uses ~
        expect(data.grid[5]!.slice(6, 11)).toBe("~~~~~");
        expect(result.summary).toContain("물");
      });

      it("uses the active tileset rather than foreign water/tree numbers", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const tileset = structuredClone(project.tilesets[map.tilesetId]);
        tileset.id = "custom-interior";
        tileset.image = { type: "uploaded", id: "custom-atlas" };
        tileset.tileMeta = [];
        tileset.tileGroups = [];
        tileset.palettePresets = [];
        project.tilesets[tileset.id] = tileset;
        map.tilesetId = tileset.id;
        map.lowerTiles.fill(TILE.WATER);
        map.upperTiles.fill(TILE.EMPTY);
        map.upperTiles[0] = TILE.TREE;
        const query = () => runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 2, h: 1 });
        const unrelated = query().data as { water: { cellCount: number }; grid: string[] };
        expect(unrelated.water.cellCount).toBe(0);
        expect(unrelated.grid[0]).not.toMatch(/[~T]/);
        tileset.tileMeta[TILE.WATER] = { label: "water", description: "", role: "water", source: "user" };
        const explicit = query().data as { water: { cellCount: number }; grid: string[] };
        expect(explicit.water.cellCount).toBe(2);
        expect(explicit.grid[0]).toBe("~~");
      });

      it("waterBoundsInMap matches painted water rectangle", () => {
        // TILE.WATER is a combined-town chip id; without a tileset argument only a combined-town map reads it as water.
        const project = startOnRetiredCombinedTown(createBlankProject());
        const map = project.maps[project.startMapId]!;
        map.lowerTiles[3 * map.width + 4] = TILE.WATER;
        map.lowerTiles[3 * map.width + 5] = TILE.WATER;
        const b = waterBoundsInMap(map, 0, 0, map.width, map.height);
        expect(b).toEqual({ cellCount: 2, x: 4, y: 3, w: 2, h: 1 });
      });
    });
    describe("show_map_region size cap", () => {
      // Complete coverage is exempt (see wholeMapCoverageRender.test.ts); the cap still
      // stops the roaming it was added for, which is oversized *partial* slices.
      it("clamps huge partial requests to 24×24 on a large map", () => {
        const project = createBlankProject();
        const big = createBlankMap("big", 60, 60);
        big.id = "map_big";
        project.maps[big.id] = big;
        const result = runTool({ project }, "show_map_region", {
          mapId: big.id,
          x: 4,
          y: 4,
          w: 80,
          h: 80,
        });
        expect(result.ok).toBe(true);
        const data = result.data as { w: number; h: number };
        expect(data.w).toBe(24);
        expect(data.h).toBe(24);
        expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(true);
      });
    });
    describe("custom atlas semantics", () => {
      it("uses authored water metadata rather than colliding default atlas numbers", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const tileset = structuredClone(project.tilesets[map.tilesetId]!);
        tileset.id = "custom-semantic-atlas";
        tileset.image = { type: "uploaded", id: "custom-semantic-image" };
        tileset.tileMeta = [];
        tileset.palettePresets = [];
        tileset.tileGroups = [];
        tileset.tileMeta[0] = { label: "grass", description: "", tags: ["grass"] };
        tileset.tileMeta[425] = { label: "water", description: "", tags: ["water"] };
        project.tilesets[tileset.id] = tileset;
        map.tilesetId = tileset.id;
        map.events = [];
        map.lowerTiles.fill(0);
        map.upperTiles.fill(TILE.EMPTY);
        map.lowerTiles[map.width + 1] = 425;
        const result = runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 3, h: 3 });
        expect(result.ok).toBe(true);
        const data = result.data as { grid: string[]; water: { cellCount: number; bounds: unknown } };
        expect(data.water).toMatchObject({ cellCount: 1, bounds: { x: 1, y: 1, w: 1, h: 1 } });
        expect(data.grid[1][1]).toBe("~");
        expect(data.grid[0]).not.toContain("~");
        expect(waterBoundsInMap(map, 0, 0, 3, 3)).toBeNull();
        expect(waterBoundsInMap(map, 0, 0, 3, 3, tileset)?.cellCount).toBe(1);
      });
    });
  });
});

describe("autotileEngine", () => {
  isolateTimers();
  describe("autotileEngine", () => {
    isolateTimers();
    type MapView = { width: number; height: number; lowerTiles: number[] };
    function mapFromRows(rows: readonly (readonly number[])[]): MapView {
      return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
    }
    function at(map: MapView, x: number, y: number): number {
      return map.lowerTiles[y * map.width + x];
    }
    // 단순 대칭 오토타일 그룹: 몸통 0, 변/모서리 10~18.
    const SIMPLE_TILES = {
      body: 10,
      edgeN: 11,
      edgeS: 12,
      edgeW: 13,
      edgeE: 14,
      cornerNW: 15,
      cornerNE: 16,
      cornerSW: 17,
      cornerSE: 18,
    } as const;
    const SIMPLE_MEMBERS = [SIMPLE_TILES.body, 11, 12, 13, 14, 15, 16, 17, 18];
    const SIMPLE_GROUP: AutotileGroup = {
      id: "simple",
      name: "simple",
      neighborhood: 4,
      memberTileIds: SIMPLE_MEMBERS,
      variantMap: buildEdgeCornerVariantMap(SIMPLE_TILES),
    };
    describe("autotile bitmask engine", () => {
      it("계산한 4방향 비트마스크가 방향 비트와 일치한다", () => {
        // 중앙(1,1)만 멤버, 동/남 이웃만 멤버 → E|S 비트.
        const map = mapFromRows([
          [99, 99, 99],
          [99, 10, 10],
          [99, 10, 99],
        ]);
        const members = new Set(SIMPLE_MEMBERS);
        const mask = autotileNeighborMask(map, 1, 1, (t) => members.has(t), 4);
        expect(mask).toBe(AUTOTILE_DIR.E | AUTOTILE_DIR.S);
      });

      it("8방향에서 대각선 이웃 비트를 포함한다", () => {
        const map = mapFromRows([
          [10, 99, 99],
          [99, 10, 99],
          [99, 99, 99],
        ]);
        const members = new Set(SIMPLE_MEMBERS);
        const mask = autotileNeighborMask(map, 1, 1, (t) => members.has(t), 8);
        expect(mask & AUTOTILE_DIR.NW).toBe(AUTOTILE_DIR.NW);
        expect(mask & AUTOTILE_DIR.N).toBe(0);
      });

      it("variantMap 은 몸통/변/모서리 16종을 모두 매핑한다", () => {
        const variantMap = buildEdgeCornerVariantMap(SIMPLE_TILES);
        expect(Object.keys(variantMap)).toHaveLength(16);
        // 이웃 전무 → 좌상 모서리, 사방 연결 → 몸통.
        expect(variantMap[String(0)]).toBe(SIMPLE_TILES.cornerNW);
        const all = AUTOTILE_DIR.N | AUTOTILE_DIR.E | AUTOTILE_DIR.S | AUTOTILE_DIR.W;
        expect(variantMap[String(all)]).toBe(SIMPLE_TILES.body);
      });

      it("autotileVariantForMask 가 마스크로 타일을 조회한다", () => {
        // 북쪽만 없음 → 북쪽 변.
        const mask = AUTOTILE_DIR.E | AUTOTILE_DIR.S | AUTOTILE_DIR.W;
        expect(autotileVariantForMask(SIMPLE_GROUP, mask)).toBe(SIMPLE_TILES.edgeN);
      });

      it("autotileVariantForCell 은 멤버가 아닌 셀에는 undefined 를 반환한다", () => {
        const map = mapFromRows([[99]]);
        expect(autotileVariantForCell(map, SIMPLE_GROUP, 0, 0)).toBeUndefined();
      });

      it("shapeAutotileGroupAround 가 2x2 블록을 4모서리로 만든다", () => {
        const map = mapFromRows([
          [10, 10],
          [10, 10],
        ]);
        shapeAutotileGroupAround(map, SIMPLE_GROUP, [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]);
        expect(at(map, 0, 0)).toBe(SIMPLE_TILES.cornerNW);
        expect(at(map, 1, 0)).toBe(SIMPLE_TILES.cornerNE);
        expect(at(map, 0, 1)).toBe(SIMPLE_TILES.cornerSW);
        expect(at(map, 1, 1)).toBe(SIMPLE_TILES.cornerSE);
      });

      it("edgeConnects 그룹은 맵 밖을 이어진 이웃으로 본다(MZ) — 가장자리를 채운 칸은 몸통으로 남는다", () => {
        const rows = [
          [10, 10],
          [10, 10],
        ];
        const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
        const mz = mapFromRows(rows);
        shapeAutotileGroupAround(mz, { ...SIMPLE_GROUP, edgeConnects: true }, points);
        expect(mz.lowerTiles).toEqual([SIMPLE_TILES.body, SIMPLE_TILES.body, SIMPLE_TILES.body, SIMPLE_TILES.body]);
        expect(autotileNeighborMask(mapFromRows([[10]]), 0, 0, (t) => t === 10, 4, true)).toBe(15);
        // 기존 그룹(생략)은 그대로 — 맵 밖 = 끊김.
        expect(autotileNeighborMask(mapFromRows([[10]]), 0, 0, (t) => t === 10, 4)).toBe(0);
      });

      it("variantMap 에 매핑이 없으면 타일을 바꾸지 않는다", () => {
        const partial: AutotileGroup = { id: "p", name: "p", memberTileIds: [10], variantMap: {} };
        const map = mapFromRows([[10]]);
        shapeAutotileGroupAround(map, partial, [{ x: 0, y: 0 }]);
        expect(at(map, 0, 0)).toBe(10);
      });
    });
    describe("autotile trigger", () => {
      it("다음/이전 타일이 트리거 집합에 있으면 참", () => {
        expect(autotileEditTriggersGroup(SIMPLE_GROUP, undefined, 10)).toBe(true);
        expect(autotileEditTriggersGroup(SIMPLE_GROUP, 10, 99)).toBe(true);
        expect(autotileEditTriggersGroup(SIMPLE_GROUP, undefined, 99)).toBe(false);
      });

      it("모래 기본 그룹은 물 편집으로도 트리거된다", () => {
        expect(autotileEditTriggersGroup(DEFAULT_SAND_AUTOTILE_GROUP, undefined, TILE.WATER)).toBe(true);
      });
    });
    describe("built-in default groups reproduce legacy road/sand behavior", () => {
      it("흙길 2x2 → 4모서리", () => {
        const map = mapFromRows([
          [TILE.PATH, TILE.PATH],
          [TILE.PATH, TILE.PATH],
        ]);
        shapeAutotileGroupAround(map, DEFAULT_ROAD_AUTOTILE_GROUP, [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]);
        expect(at(map, 0, 0)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
        expect(at(map, 1, 0)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_EAST);
        expect(at(map, 0, 1)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_WEST);
        expect(at(map, 1, 1)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
      });

      it("모래는 인접 물을 연결된 이웃으로 취급한다", () => {
        // 중앙 모래의 서쪽 열이 전부 물, 나머지는 모래 → 물이 연결로 취급되어 8방 전부 연결 = 몸통.
        const map = mapFromRows([
          [TILE.WATER, TILE.SAND, TILE.SAND],
          [TILE.WATER, TILE.SAND, TILE.SAND],
          [TILE.WATER, TILE.SAND, TILE.SAND],
        ]);
        expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.BODY);
        // 물을 비멤버(잔디)로 바꾸면 서쪽 연결이 끊겨 서쪽 변이 된다.
        const landMap = mapFromRows([
          [TILE.GRASS, TILE.SAND, TILE.SAND],
          [TILE.GRASS, TILE.SAND, TILE.SAND],
          [TILE.GRASS, TILE.SAND, TILE.SAND],
        ]);
        expect(autotileVariantForCell(landMap, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.EDGE_WEST);
      });

      it("외딴 1칸 모래/흙길은 외딴 점 타일이 되고, 외딴 점을 칠하면 그대로 유지된다", () => {
        const map = mapFromRows([
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
          [TILE.GRASS, TILE.SAND, TILE.GRASS],
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
        ]);
        expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.ISOLATED);
        const roadMap = mapFromRows([
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
          [TILE.GRASS, DIRT_ROAD_TILE.BODY, TILE.GRASS],
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
        ]);
        expect(autotileVariantForCell(roadMap, DEFAULT_ROAD_AUTOTILE_GROUP, 1, 1)).toBe(DIRT_ROAD_TILE.ISOLATED);
        // "363을 깔면 알아서 오토타일" 요건: 외딴 점 타일 자체를 칠해도 성형 후 그대로.
        const dotMap = mapFromRows([
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
          [TILE.GRASS, SAND_TILE.ISOLATED, TILE.GRASS],
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
        ]);
        shapeAutotileGroupAround(dotMap, DEFAULT_SAND_AUTOTILE_GROUP, [{ x: 1, y: 1 }]);
        expect(at(dotMap, 1, 1)).toBe(SAND_TILE.ISOLATED);
      });

      it("십자 교차로의 오목 코너 4칸은 합성 오목 타일이 된다", () => {
        // 3칸 폭 십자: 가로 rows 3~5, 세로 cols 3~5 (9x9).
        const S = TILE.SAND;
        const grid: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(TILE.GRASS));
        for (let x = 0; x < 9; x++) for (let y = 3; y <= 5; y++) grid[y][x] = S;
        for (let y = 0; y < 9; y++) for (let x = 3; x <= 5; x++) grid[y][x] = S;
        const map = mapFromRows(grid);
        const points: { x: number; y: number }[] = [];
        for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (at(map, x, y) === S) points.push({ x, y });
        shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, points);
        // 오목 4칸: 4방 모래 + 대각 1곳 잔디.
        for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5]] as const) {
          expect(at(map, x, y), `(${x},${y})`).toBe(SAND_TILE.INNER_CORNER);
        }
        // 교차 중심은 대각까지 전부 모래 → 몸통 유지.
        expect(at(map, 4, 4)).toBe(SAND_TILE.BODY);
        // 팔 끝 볼록 모서리는 기존 9-슬라이스 유지.
        expect(at(map, 3, 0)).toBe(SAND_TILE.CORNER_NORTH_WEST);
        expect(at(map, 5, 0)).toBe(SAND_TILE.CORNER_NORTH_EAST);
      });

      it("대각에 접한 셀만 편집해도 이웃 몸통이 오목 코너로 재성형된다(8방 재검사)", () => {
        const grid: number[][] = Array.from({ length: 5 }, () => Array<number>(5).fill(SAND_TILE.BODY));
        const map = mapFromRows(grid);
        // (0,0)을 잔디로 바꾼 편집 — 대각 이웃 (1,1)은 몸통에서 오목 코너로 바뀌어야 한다.
        map.lowerTiles[0] = TILE.GRASS;
        shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, [{ x: 0, y: 0 }]);
        expect(at(map, 1, 1)).toBe(SAND_TILE.INNER_CORNER);
      });

      it("autotileGroupsForTileset 는 기본 Combined Town에서만 내장 그룹으로 폴백한다", () => {
        // 내장 그룹 수가 늘어도 깨지지 않게 파생값으로 대조 (2026-07-17: 4→11종).
        expect(autotileGroupsForTileset(undefined)).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
        // 합본 마을·던전 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다 — 그 칩셋을 들고 있는 옛 저장본을 재현한다.
        const project = withRetiredEasyRpgTilesets(createBlankProject());
        expect(autotileGroupsForTileset(project.tilesets[COMBINED_TOWN_TILESET_ID])).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
        // 던전은 내장 Combined Town 그룹으로 폴백하지 않고 자기 시드 그룹만 노출한다.
        const dungeonGroups = autotileGroupsForTileset(project.tilesets.easyrpg_chipset_dungeon);
        expect(dungeonGroups.every((group) => group.id.startsWith("harness-dungeon-v1-terrain-"))).toBe(true);
        expect(dungeonGroups.some((group) => group.id.startsWith("builtin_"))).toBe(false);
        // 병합 폴백: 흙길만 덮는 사용자 그룹이 영속돼 있어도 내장 모래 그룹은 살아있어야 한다.
        const withCustomRoad = structuredClone(project.tilesets[COMBINED_TOWN_TILESET_ID]!);
        withCustomRoad.autotileGroups = [
          { id: "custom_road", name: "커스텀 흙길", neighborhood: 8, memberTileIds: [DIRT_ROAD_TILE.BODY], variantMap: {} },
        ];
        const merged = autotileGroupsForTileset(withCustomRoad);
        expect(merged.map((group) => group.id)).toEqual([
          "custom_road",
          ...DEFAULT_AUTOTILE_GROUPS.filter((group) => group.id !== "builtin_dirt_road").map((group) => group.id),
        ]);
        const cloned = cloneDefaultAutotileGroups();
        expect(cloned).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
        expect(cloned[0]?.memberTileIds).not.toBe(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
      });
    });
  });
  // 오토타일이 칠한 층 배열에서 모양을 잡는다(MZ 4층 — 2층 풀 장식 A2). 설계: docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 3
  describe("autotileLayerView", () => {
    isolateTimers();
    const TILES = { body: 10, edgeN: 11, edgeS: 12, edgeW: 13, edgeE: 14, cornerNW: 15, cornerNE: 16, cornerSW: 17, cornerSE: 18 } as const;
    const GROUP: AutotileGroup = {
      id: "grass-deco",
      name: "풀 장식",
      neighborhood: 4,
      memberTileIds: [10, 11, 12, 13, 14, 15, 16, 17, 18],
      variantMap: buildEdgeCornerVariantMap(TILES),
    };
    function blankMap(width = 5, height = 5): GameMap {
      return {
        id: "m", name: "m", width, height, tilesetId: "t", tileSize: 16,
        lowerTiles: new Array<number>(width * height).fill(10), upperTiles: new Array<number>(width * height).fill(-1), events: [],
      } as GameMap;
    }
    describe("autotileLayerView", () => {
      it("2층에 칠한 멤버는 2층 이웃 기준으로 모양이 잡히고 1층은 그대로다", () => {
        const map = blankMap();
        const lowerBefore = map.lowerTiles.slice();
        // 2층 가운데 가로 3칸 띠 (1..3, 2) — 1층은 전부 같은 그룹 몸통(10)이라 1층 이웃을 보면 모두 몸통이 된다.
        const points = [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }];
        for (const p of points) setLayerTileAt(map, 2, p.y * map.width + p.x, TILES.body);
        shapeAutotileGroupAround(autotileLayerView(map, 2), GROUP, points);
        const row = [1, 2, 3].map((x) => map.lowerOverlayTiles![2 * map.width + x]);
        // 위아래가 비었으므로 몸통이 아니라 가장자리/모서리다(2층 이웃 기준).
        expect(row).toEqual([TILES.cornerNW, TILES.edgeN, TILES.cornerNE]);
        expect(map.lowerTiles).toEqual(lowerBefore);
      });

      it("1층 뷰는 lowerTiles, 3층 뷰는 upperTiles 를 그대로 빌려준다", () => {
        const map = blankMap();
        expect(autotileLayerView(map, 1).lowerTiles).toBe(map.lowerTiles);
        expect(autotileLayerView(map, 3).lowerTiles).toBe(map.upperTiles);
      });

      it("2·4층 칸이 없는 옛 맵에서는 모양 잡기가 새 키를 만들지 않는다", () => {
        const map = blankMap();
        for (const layer of [2, 4] as const) {
          shapeAutotileGroupAround(autotileLayerView(map, layer), GROUP, [{ x: 2, y: 2 }]);
        }
        expect("lowerOverlayTiles" in map).toBe(false);
        expect("upperOverlayTiles" in map).toBe(false);
      });
    });
  });
});

describe("battleStatusItemMessage", () => {
  isolateTimers();
  function readyBattle(options: {
    inventory: Record<string, number>;
    stateIds?: Record<string, readonly string[]>;
    vitals?: Record<string, { hp: number; mp: number }>;
    partyActorIds?: readonly string[];
  }) {
    const project = createBlankProject();
    const troopId = project.database.troops[0]?.id;
    if (!troopId) throw new Error("missing troop");
    const partyActorIds = options.partyActorIds ?? [DEFAULT_ACTOR_ID];
    const runtime = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
      rng: () => 0.5,
      party: {
        partyActorIds: [...partyActorIds],
        levels: Object.fromEntries(partyActorIds.map((id) => [id, 1])),
        experience: Object.fromEntries(partyActorIds.map((id) => [id, 0])),
        ...(options.vitals ? { vitals: options.vitals } : {}),
        ...(options.stateIds ? { stateIds: options.stateIds } : {}),
      },
      sessionState: { switches: {}, variables: {}, inventory: options.inventory },
    });
    for (let i = 0; i < 40 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    return runtime;
  }
  function useItem(runtime: BattleRuntime, itemId: string, targetActorId?: string) {
    const command: ActorCommand = { kind: "item", itemId, targetEnemyId: "", ...(targetActorId ? { targetActorId } : {}) };
    const before = runtime.snapshot();
    runtime.performActorCommand(command);
    const after = runtime.snapshot();
    return { command, before, after, delta: after.timeline.slice(before.timeline.length) };
  }
  /** 명령 직후 메시지 창에 올라오는 줄. 적 턴까지 가지 않도록 몇 비트만 뺀다. */
  function spokenLines(runtime: BattleRuntime, command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): string[] {
    const lines: string[] = [];
    const queue: Array<() => void> = [];
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => lines.push(...state.lines),
        onSyncView: () => {},
        onDamageFeedback: () => {},
        onResultStage: () => {},
        onSequenceBusy: () => {},
      },
      (callback) => {
        queue.push(callback);
        return queue.length;
      },
      () => {},
    );
    sequencer.runAfterActorCommand(command, before, after);
    for (let i = 0; i < 16 && queue.length > 0; i += 1) queue.shift()?.();
    sequencer.cancel();
    return lines;
  }
  describe("status-only battle medicine messages", () => {
    it("cures poison without a zero heal or an insufficient-effect line", () => {
      const runtime = readyBattle({
        inventory: { item_antidote: 1 },
        stateIds: { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID] },
      });
      const { command, before, after, delta } = useItem(runtime, "item_antidote", DEFAULT_ACTOR_ID);
      const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);

      expect(after.actors[0]?.stateIds ?? []).not.toContain(DEFAULT_STATE_ID);
      expect(after.eventState.inventory.item_antidote ?? 0).toBe(0);
      expect(own.some((entry) => entry.kind === "stateRemoved" && entry.stateId === DEFAULT_STATE_ID)).toBe(true);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(false);

      const director = actorCommandDirectorState(command, before, after).lines.join(" ");
      expect(director).toContain("해독초");
      expect(director).toContain("사용했다");
      expect(director).not.toContain("효과가 충분하지 않았다");

      const spoken = spokenLines(runtime, command, before, after).join(" ");
      expect(spoken).toContain("해독초");
      expect(spoken).toContain("독이 풀렸다");
      expect(spoken).not.toContain("효과가 충분하지 않았다");
      expect(spoken).not.toContain("합계 0");
    });

    it("still says the effect was insufficient when the antidote cures nothing", () => {
      const runtime = readyBattle({ inventory: { item_antidote: 1 } });
      const { command, before, after, delta } = useItem(runtime, "item_antidote", DEFAULT_ACTOR_ID);
      const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);

      expect(after.eventState.inventory.item_antidote ?? 0).toBe(0);
      expect(own.some((entry) => entry.kind === "stateRemoved")).toBe(false);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(true);
      expect(actorCommandDirectorState(command, before, after).lines.join(" ")).toContain("효과가 충분하지 않았다");
    });

    it("still heals a wounded ally and still reports a full-HP potion as insufficient", () => {
      const wounded = readyBattle({
        inventory: { [DEFAULT_ITEM_ID]: 1 },
        vitals: { [DEFAULT_ACTOR_ID]: { hp: 20, mp: 5 } },
      });
      const healed = useItem(wounded, DEFAULT_ITEM_ID, DEFAULT_ACTOR_ID);
      expect(healed.after.actors[0]?.hp).toBe(70);
      expect(healed.delta.some((entry) => entry.kind === "healing" && entry.resource === "hp" && (entry.amount ?? 0) > 0)).toBe(true);
      expect(actorCommandDirectorState(healed.command, healed.before, healed.after).lines.join(" ")).toMatch(/회복했다/);

      const full = readyBattle({
        inventory: { [DEFAULT_ITEM_ID]: 1 },
        vitals: { [DEFAULT_ACTOR_ID]: { hp: 9999, mp: 9999 } },
      });
      const wasted = useItem(full, DEFAULT_ITEM_ID, DEFAULT_ACTOR_ID);
      const own = wasted.delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);
      expect(wasted.after.actors[0]?.hp).toBe(wasted.after.actors[0]?.maxHp);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(true);
      expect(actorCommandDirectorState(wasted.command, wasted.before, wasted.after).lines.join(" ")).toContain("효과가 충분하지 않았다");
    });

    it("does not summarize a party cleanse as zero recovery", () => {
      const runtime = readyBattle({
        inventory: { item_gen2_party_cleanse: 1 },
        partyActorIds: [DEFAULT_ACTOR_ID, ACTOR_MAGE_ID],
        stateIds: {
          [DEFAULT_ACTOR_ID]: ["state_attack_down"],
          [ACTOR_MAGE_ID]: ["state_attack_down"],
        },
      });
      const { command, before, after, delta } = useItem(runtime, "item_gen2_party_cleanse");
      const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);
      const cured = own.filter((entry) => entry.kind === "stateRemoved" && entry.stateId === "state_attack_down");

      expect(cured).toHaveLength(2);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(after.actors.every((actor) => !actor.stateIds.includes("state_attack_down"))).toBe(true);
      expect(after.eventState.inventory.item_gen2_party_cleanse ?? 0).toBe(0);

      const spoken = spokenLines(runtime, command, before, after).join(" ");
      expect(spoken).toContain("맑은 종");
      // 같은 상태가 여럿에게서 잇달아 풀리면 한 줄로 묶일 수 있다(「주인공, 마도사의 공격 하락이 풀렸다.」) — 두 이름과 문장이 다 읽히면 된다.
      expect(spoken).toMatch(/주인공(?:, 마도사)?의 공격 하락이 풀렸다/);
      expect(spoken).toMatch(/(?:주인공, )?마도사의 공격 하락이 풀렸다/);
      expect(spoken).not.toContain("효과가 충분하지 않았다");
      expect(spoken).not.toContain("합계 0");
      expect(spoken).not.toMatch(/의 공격!/);
    });
  });
});

describe("chipsetAnimation", () => {
  isolateTimers();
  describe("chipset water animation mapping", () => {
    it("treats horizontal water triplets as one 3fps terrain animation", () => {
      expect(CHIPSET_ANIMATION_FPS).toBe(3);
      expect(animationStripForTile(0)).toMatchObject({ baseTile: 0, frames: [0, 1, 2], fps: 3 });
      expect(animationStripForTile(1)).toMatchObject({ baseTile: 0, frames: [0, 1, 2], fps: 3 });
      expect(animationStripForTile(90)).toMatchObject({ baseTile: 90, frames: [90, 91, 92], fps: 3 });
      expect(animationStripForTile(92)).toMatchObject({ baseTile: 90, frames: [90, 91, 92], fps: 3 });
      expect(animationStripForTile(120)).toMatchObject({ baseTile: 120, frames: [120, 121, 122], fps: 3 });
      expect(animationKeyForTile(91)).toBe(animationKeyForTile(90));
    });

    it("treats waterfall as vertical 4-frame loop at 4fps (123→153→183→213)", () => {
      expect(WATERFALL_ANIMATION_FPS).toBe(4);
      expect(animationStripForTile(123)).toMatchObject({
        baseTile: 123,
        frames: [123, 153, 183, 213],
        fps: 4,
      });
      // 가로 이웃 124/125 는 같은 세로 루프의 다른 열 — 123과 섞이지 않는다.
      expect(animationStripForTile(124)?.frames).toEqual([124, 154, 184, 214]);
      expect(animationStripForTile(125)?.frames).toEqual([125, 155, 185, 215]);
      // 123 한 칸만 저장해도 세로로 프레임이 바뀐다.
      expect(animationFrameForTile(123, 0)).toBe(123);
      expect(animationFrameForTile(123, 250)).toBe(153);
      expect(animationFrameForTile(123, 500)).toBe(183);
      expect(animationFrameForTile(123, 750)).toBe(213);
      expect(animationFrameForTile(123, 1000)).toBe(123);
      // 예전 잘못된 가로 해석: 123→124 가 되면 안 된다.
      expect(animationFrameForTile(123, 250)).not.toBe(124);
    });

    it("selects the visible chipset frame from elapsed time", () => {
      expect(animationFrameForTile(90, 0)).toBe(90);
      expect(animationFrameForTile(90, 334)).toBe(91);
      expect(animationFrameForTile(90, 667)).toBe(92);
      expect(animationFrameForTile(90, 1000)).toBe(90);
      expect(animationFrameForTile(7, 667)).toBe(7);
    });

    it("scopes non-legacy animation keys to the active chipset texture", () => {
      const key = animationKeyForTile(120);
      expect(key).toBeTruthy();
      expect(chipsetAnimationKey(TEX_TILESET, key!)).toBe(key);
      expect(chipsetAnimationKey("tex_easyrpg_chipset_combined_town", key!)).toBe(
        `tex_easyrpg_chipset_combined_town:${key}`,
      );
    });
  });
});

describe("chipsetLabelCorrections", () => {
  isolateTimers();
  describe("chipsetLabelCorrections", () => {
    isolateTimers();
    // 보정 대상 칸은 모두 EasyRPG 칩셋(합본 마을·던전·실내·레트로 집/바깥·월드) 것이다. 그 시트들은 2026-10-07 저작권 정리로
    // 새 프로젝트에서 빠졌지만 옛 저장본은 들고 있고, 로드 정규화가 여기에 보정을 심는다 — 그 옛 정의를 다시 만든다.
    function retiredTilesets(): Record<string, TilesetDef> {
      const keys = [...new Set(CHIPSET_LABEL_CORRECTIONS.map(correction => correction.textureKey))];
      return Object.fromEntries(keys.map(key => {
        const tileset = retiredEasyRpgChipsetTileset(key, key);
        return [tileset.id, tileset];
      }));
    }
    describe("approved chipset corrections", () => {
      it("finds stained glass rather than gems after metadata seeding", () => {
        const tilesets = retiredTilesets();
        ensureTilesetHarnesses({ tilesets });
        const tileset = tilesets.easyrpg_chipset_retro_house!;
        expect(searchResources("tile", "스테인드 글라스", { tileset }).map(result => result.id)).toContain("tile:84");
        expect(searchResources("tile", "보석", { tileset }).map(result => result.id)).not.toContain("tile:84");
      });

      it("keeps floor runtime contracts while correcting their semantic role", () => {
        const tilesets = retiredTilesets();
        ensureTilesetHarnesses({ tilesets });
        const tileset = tilesets.easyrpg_chipset_dungeon!;
        for (const tile of [78, 79]) {
          expect(tileset.tileMeta?.[tile]?.role).toBe("floor");
          expect(tileset.priority[tile]).toBe("lower");
          expect(tileset.passability[tile]).toEqual({ up: true, down: true, left: true, right: true });
        }
      });

      it("describes the mine lower row with fixed caps and a repeating center", () => {
        const tilesets = retiredTilesets();
        ensureTilesetHarnesses({ tilesets });
        const tileset = tilesets.easyrpg_chipset_dungeon!;
        expect([255, 256, 257].map(tile => tileset.tileMeta?.[tile]?.repeatability)).toEqual(["fixed", "center", "fixed"]);
      });

      it("cycles the whirlpool by increasing tile ID independently of the placed frame", () => {
        for (const tile of [125, 155, 185, 215]) {
          expect([0, 250, 500, 750, 1000].map(time => animationFrameForTile(tile, time))).toEqual([125, 155, 185, 215, 125]);
        }
      });

      it("preserves user metadata when the harness is reapplied", () => {
        const tilesets = retiredTilesets();
        const tileset = tilesets.easyrpg_chipset_retro_house!;
        const custom = { label: "사용자 창문", description: "직접 작성", tags: ["사용자 태그"], source: "user" as const };
        if (!tileset.tileMeta) throw new Error("missing tile metadata");
        tileset.tileMeta[84] = custom;
        ensureTilesetHarnesses({ tilesets });
        expect(tileset.tileMeta[84]).toEqual(custom);
      });

      it("keeps all approved metadata through save and load without resurrecting old tags", () => {
        const project = createBlankProject();
        const retired = retiredTilesets();
        ensureTilesetHarnesses({ tilesets: retired });
        Object.assign(project.tilesets, retired);
        const restored = deserialize(serialize(project));
        for (const correction of CHIPSET_LABEL_CORRECTIONS) {
          const tileset = Object.values(restored.tilesets).find(entry => entry.image.id === correction.textureKey);
          const meta = tileset?.tileMeta?.[correction.index];
          expect(meta?.label).toBe(correction.label);
          expect(meta?.tags).toEqual(correction.tags);
          expect(meta?.repeatability).toBe(correction.repeatability);
          expect(searchResources("tile", correction.label, { tileset }).map(result => result.id)).toContain(`tile:${correction.index}`);
        }
      });

      it("is idempotent and does not modify layout or passability", () => {
        const tilesets = { ...defaultTilesets(), ...retiredTilesets() };
        ensureTilesetHarnesses({ tilesets });
        for (const tileset of Object.values(tilesets)) {
          const before = JSON.stringify(tileset);
          expect(seedChipsetLabelCorrections(tileset)).toBe(false);
          expect(JSON.stringify(tileset)).toBe(before);
        }
      });

      it("preserves origin-user, locked, and grafted artwork on corrected slots", () => {
        for (const protection of ["origin", "locked", "graft"] as const) {
          const tilesets = retiredTilesets();
          const tileset = tilesets.easyrpg_chipset_retro_house!;
          const custom = { label: "직접 판독한 그림", description: "보존", source: "ai" as const,
            ...(protection === "origin" ? { origin: "user" as const } : {}),
            ...(protection === "locked" ? { locked: true } : {}) };
          if (!tileset.tileMeta) throw new Error("missing tile metadata");
          tileset.tileMeta[84] = custom;
          if (protection === "graft") tileset.tileGrafts = [{ targetTile: 84, sourceChipset: "tex_easyrpg_chipset_dungeon", sourceTile: 84 }];
          ensureTilesetHarnesses({ tilesets });
          expect(tileset.tileMeta[84]).toEqual(custom);
        }
      });
    });
  });
  describe("worldTileDescriptions", () => {
    isolateTimers();
    const WORLD_ID = "easyrpg_chipset_world";
    const WORLD_TEXTURE = "tex_easyrpg_chipset_world";
    const BLANK_SLOTS = [233, 258];
    const tileset = () => retiredEasyRpgTileset(WORLD_ID);
    const descriptions = (ts: TilesetDef) => ts.tileMeta!.map(meta => meta.description);
    function clearDescriptions(ts: TilesetDef): void {
      for (const meta of ts.tileMeta!) meta.description = "";
    }
    function withoutDescriptions(ts: TilesetDef): TilesetDef {
      const result = structuredClone(ts);
      clearDescriptions(result);
      return result;
    }
    describe("World tile descriptions", () => {
      it("documents every one of the 478 drawn slots and leaves the two blank slots empty", () => {
        const described: number[] = [];
        const empty: number[] = [];
        for (let tile = 0; tile < 480; tile++) {
          const description = worldTileDescription(tile);
          if (description.trim()) {
            described.push(tile);
            expect(description, `tile ${tile}`).toMatch(/[가-힣]/);
          } else {
            empty.push(tile);
          }
        }
        expect(described).toHaveLength(478);
        expect(empty).toEqual(BLANK_SLOTS);
        for (const tile of [-1, 480, 900]) expect(worldTileDescription(tile)).toBe("");
      });

      it("fills legacy World descriptions without changing any other metadata or runtime flag", () => {
        const ts = tileset();
        clearDescriptions(ts);
        const before = withoutDescriptions(ts);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
        const corrected = new Map(CHIPSET_LABEL_CORRECTIONS
          .filter(entry => entry.textureKey === WORLD_TEXTURE)
          .map(entry => [entry.index, entry.description]));
        expect(descriptions(ts)).toEqual(Array.from({ length: 480 }, (_, tile) => corrected.get(tile) ?? worldTileDescription(tile)));
        expect(withoutDescriptions(ts)).toEqual(before);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
      });

      it.each([
        { name: "피아노", tiles: [417, 418, 419], layout: "[417,418,419]" },
        { name: "파이프오르간", tiles: [444, 445, 474, 475], layout: "[444,445] / [474,475]" },
        { name: "큰 붉은 왕좌", tiles: [447, 448, 449, 477, 478, 479], layout: "[447,448,449] / [477,478,479]" },
      ])("describes the complete $name assembly without rewriting older semantic labels", ({ name, tiles, layout }) => {
        const ts = tileset();
        const labels = tiles.map(tile => ts.tileMeta![tile]!.label);
        for (const tile of tiles) ts.tileMeta![tile]!.description = "";
        applyEasyRpgThemeMetadataPacks(ts);
        for (const tile of tiles) {
          expect(ts.tileMeta![tile]!.description, `tile ${tile}`).toContain(name);
          expect(ts.tileMeta![tile]!.description, `tile ${tile}`).toContain(layout);
        }
        expect(tiles.map(tile => ts.tileMeta![tile]!.label)).toEqual(labels);
      });

      it("preserves existing nonempty World prose even when metadata is not user locked", () => {
        const ts = tileset();
        ts.tileMeta![67]!.description = "  마을 입구에서만 쓰는 흙길입니다.  ";
        ts.tileMeta![262] = { ...ts.tileMeta![262]!, source: "ai", description: "여울 마을의 작은 여관입니다." };
        const expected = [67, 262].map(tile => ts.tileMeta![tile]!.description);
        applyEasyRpgThemeMetadataPacks(ts);
        expect([67, 262].map(tile => ts.tileMeta![tile]!.description)).toEqual(expected);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
      });

      it("preserves complete user-authored and locked metadata, including deliberately empty descriptions", () => {
        const ts = tileset();
        ts.tileMeta![67] = {
          label: "사용자가 정한 길", description: "", source: "user", tags: ["개인 지도"],
          role: "prop", defaultLayer: "upper", passage: "star", confidence: "low",
        };
        ts.tileMeta![120] = {
          label: "잠근 바다", description: "수정하지 않는 바다 설명", source: "ai", userLocked: true,
          tags: ["잠금"], role: "prop", defaultLayer: "upper", passage: "passable", repeatability: "fixed",
        };
        for (const tile of [67, 120]) {
          ts.priority[tile] = "upper";
          ts.passability[tile] = { up: true, down: false, left: true, right: false };
        }
        const authored = () => [67, 120].map(tile => ({
          meta: ts.tileMeta![tile], priority: ts.priority[tile], passability: ts.passability[tile],
        }));
        const before = structuredClone(authored());
        applyEasyRpgThemeMetadataPacks(ts);
        expect(authored()).toEqual(before);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
      });

      it("does not attach original artwork descriptions to grafted slots and preserves their existing prose", () => {
        const ts = tileset();
        ts.tileMeta![67]!.description = "";
        ts.tileMeta![262]!.description = "";
        ts.tileMeta![120]!.description = "바다 자리에 이식한 집 그림입니다.";
        ts.tileGrafts = [67, 120, 262].map(targetTile => ({ targetTile, sourceChipset: WORLD_TEXTURE, sourceTile: 292 }));
        const before = withoutDescriptions(ts);
        applyEasyRpgThemeMetadataPacks(ts);
        expect([67, 120, 262].map(tile => ts.tileMeta![tile]!.description)).toEqual(["", "바다 자리에 이식한 집 그림입니다.", ""]);
        expect(withoutDescriptions(ts)).toEqual(before);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
        delete ts.tileGrafts;
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
        expect(ts.tileMeta![67]!.description).toBe(worldTileDescription(67));
        expect(ts.tileMeta![262]!.description).toBe(worldTileDescription(262));
        expect(ts.tileMeta![120]!.description).toBe("바다 자리에 이식한 집 그림입니다.");
      });

      it("does not introduce World prose into other bundled chipsets or an uploaded atlas with the same ID", () => {
        for (const ts of Object.values(defaultTilesets())) {
          if (ts.id === WORLD_ID) continue;
          const before = structuredClone(ts);
          applyEasyRpgThemeMetadataPacks(ts);
          expect(ts, ts.id).toEqual(before);
        }
        const uploaded = tileset();
        uploaded.image = { type: "uploaded", id: WORLD_TEXTURE };
        clearDescriptions(uploaded);
        const before = structuredClone(uploaded);
        expect(applyEasyRpgThemeMetadataPacks(uploaded)).toBe(false);
        expect(uploaded).toEqual(before);
      });

      it("fills legacy prose during load-time ensure and preserves it through later save/load cycles", () => {
        const project = withRetiredEasyRpgTilesets(createBlankProject());
        const ts = project.tilesets[WORLD_ID]!;
        clearDescriptions(ts);
        ts.tileMeta![262]!.description = "저장한 여울 마을 설명";
        ts.tileMeta![67] = { ...ts.tileMeta![67]!, source: "user", description: "" };
        ts.tileMeta![120] = { ...ts.tileMeta![120]!, userLocked: true, description: "잠근 바다 설명" };
        ts.tileGrafts = [{ targetTile: 292, sourceChipset: WORLD_TEXTURE, sourceTile: 262 }];
        const loaded = deserialize(serialize(project));
        // ProjectStore runs this after deserialization; parsing alone does not seed defaults.
        ensureBundledTilesets(loaded);
        const loadedTs = loaded.tilesets[WORLD_ID]!;
        expect(loadedTs.tileMeta![0]!.description).toBe(worldTileDescription(0));
        expect([67, 120, 262, 292].map(tile => loadedTs.tileMeta![tile]!.description))
          .toEqual(["", "잠근 바다 설명", "저장한 여울 마을 설명", ""]);
        expect(loadedTs.tileGrafts).toEqual(ts.tileGrafts);
        const before = structuredClone(loadedTs);
        ensureBundledTilesets(loaded);
        expect(loadedTs).toEqual(before);
        expect(applyEasyRpgThemeMetadataPacks(loadedTs)).toBe(false);
        const reloaded = deserialize(serialize(loaded));
        ensureBundledTilesets(reloaded);
        const reloadedTs = reloaded.tilesets[WORLD_ID]!;
        expect(reloadedTs.tileMeta).toEqual(loadedTs.tileMeta);
        expect(reloadedTs.tileGrafts).toEqual(loadedTs.tileGrafts);
        expect(applyEasyRpgThemeMetadataPacks(reloadedTs)).toBe(false);
      });

      it("resolves a World material by its seeded description without a label or tag match", () => {
        const ts = tileset();
        const description = ts.tileMeta![417]!.description;
        expect(description).not.toBe("");
        ts.tileMeta![417]!.label = "";
        ts.tileMeta![417]!.tags = [];
        const result = resolveMaterialByLabel(ts, description, { preferGroup: false });
        expect(result).toMatchObject({ kind: "tile", tileId: 417, matchedLabel: "", matchedDescription: description });
        expect(result.status).not.toBe("missing");
        ts.tileMeta![417]!.description = "";
        expect(resolveMaterialByLabel(ts, description, { preferGroup: false })).not.toMatchObject({ kind: "tile", tileId: 417 });
      });
    });
  });
});

describe("chipsetMapping", () => {
  isolateTimers();
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
});

describe("complexMonsterAuthoring", () => {
  isolateTimers();
  describe("battleResultErasePattern", () => {
    isolateTimers();
    function flatten(commands: readonly Command[]): Command[] {
      const out: Command[] = [];
      for (const command of commands) {
        out.push(command);
        if (command.kind === "fork") {
          out.push(...flatten(command.then));
          if (command.else) out.push(...flatten(command.else));
        }
      }
      return out;
    }
    describe("field monster victory erase pattern", () => {
      it("builds battle then victory-only erase + clear switch", () => {
        const event = buildFieldBattleMonsterEvent({
          id: "monster_test",
          name: "시험체",
          x: 5,
          y: 6,
          troopId: "troop_test_boss",
          intro: "싸운다!",
          victory: "이겼다!",
          spriteId: "tex_easyrpg_charset_monster1",
          characterIndex: 0,
          clearSwitch: "sw_0099",
        });
        const live = event.pages[0]!;
        const flat = flatten(live.commands);
        expect(flat.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
        expect(
          flat.some(
            (c) =>
              c.kind === "m2Command" &&
              c.commandId === "m2-086-erase-event"
          )
        ).toBe(true);
        expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);

        const victoryFork = live.commands.find((c) => c.kind === "fork");
        expect(victoryFork).toMatchObject({
          kind: "fork",
          condition: { kind: "battleResult", result: "victory" },
        });
      });

      it("battleResult condition evaluates session battle outcome", () => {
        const project = createBlankProject();
        const session = startSession(project);
        expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(false);
        session.battleResult = "victory";
        expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(true);
        expect(evalCondition(session, { kind: "battleResult", result: "escape" })).toBe(false);
      });
    });
  });
  describe("complexMonsterAuthoring", () => {
    isolateTimers();
    describe("complexMonsterAuthoring", () => {
      it("layouts multi-member troops with distinct x positions", () => {
        const members = layoutTroopMembers([
          { enemyId: "a" },
          { enemyId: "b" },
          { enemyId: "c" },
        ]);
        expect(members).toHaveLength(3);
        expect(members[0]!.x).toBeLessThan(members[1]!.x);
        expect(members[1]!.x).toBeLessThan(members[2]!.x);
        expect(new Set(members.map((m) => m.enemyId)).size).toBe(3);
      });

      it("builds enemy with actions and troop with multi members + intro battle page", () => {
        const enemy = buildComplexEnemy({
          id: "enemy_test_boss",
          name: "테스트 보스",
          monsterResourceId: "generated-enemy-dragon-01",
          stats: { maxHp: 80, attack: 20, defense: 15 },
          skillIds: ["skill_fire"],
        });
        expect(enemy.id).toBe("enemy_test_boss");
        expect(enemy.monsterResourceId).toBe("generated-enemy-dragon-01");
        expect(enemy.stats.maxHp).toBe(80);
        expect(enemy.actions.length).toBeGreaterThanOrEqual(2);

        const troop = buildComplexTroop({
          id: "troop_test_boss",
          name: "테스트 트룹",
          members: [
            { enemyId: enemy.id },
            { enemyId: enemy.id },
          ],
          previewBackgroundResourceId: "easyrpg-backdrop-sunset1",
          introMessage: "보스가 등장했다!",
          uncapturable: true,
        });
        expect(troop.members).toHaveLength(2);
        expect(troop.enemyIds).toEqual([enemy.id, enemy.id]);
        expect(troop.uncapturable).toBe(true);
        expect(troop.battleEventPages.length).toBeGreaterThanOrEqual(1);
        expect(troop.battleEventPages[0]!.commands.some((c) => c.kind === "text")).toBe(true);
        // sky panoramas may be rewritten; still has some background
        expect(troop.previewBackgroundResourceId).toBeTruthy();
      });

      it("builds field battle monster with live/defeated pages", () => {
        const event = buildFieldBattleMonsterEvent({
          id: "monster_test",
          name: "시험체",
          x: 5,
          y: 6,
          troopId: "troop_test_boss",
          intro: "싸운다!",
          victory: "이겼다!",
          spriteId: "tex_easyrpg_charset_monster1",
          characterIndex: 0,
          clearSwitch: "sw_0099",
        });
        expect(event.pages).toHaveLength(2);
        const live = event.pages[0]!;
        expect(live.conditions).toEqual([{ kind: "switch", switchId: "sw_0099", value: false }]);
        expect(live.commands.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
        const flat = live.commands.flatMap((c) =>
          c.kind === "fork" ? [c, ...c.then, ...(c.else ?? [])] : [c]
        );
        expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);
        expect(flat.some((c) => c.kind === "m2Command" && c.commandId === "m2-086-erase-event")).toBe(true);
        const gone = event.pages[1]!;
        expect(gone.conditions).toEqual([{ kind: "switch", switchId: "sw_0099", value: true }]);
      });

      it("bundle + home dungeon seed upsert multi-enemy themed troops", () => {
        const project = createBlankProject();
        const beforeTroops = project.database.troops.length;
        const beforeEnemies = project.database.enemies.length;
        const seeded = seedHomeDungeonComplexTroops(project);
        expect(seeded.enemies.length).toBeGreaterThanOrEqual(6);
        expect(seeded.troops.length).toBeGreaterThanOrEqual(6);
        expect(project.database.enemies.length).toBeGreaterThanOrEqual(beforeEnemies + 6);
        expect(project.database.troops.length).toBeGreaterThanOrEqual(beforeTroops + 6);

        const lavaBoss = project.database.troops.find((t) => t.id === "troop_lava_ember_pack");
        expect(lavaBoss).toBeTruthy();
        expect((lavaBoss!.members?.length ?? 0)).toBeGreaterThanOrEqual(3);
        expect(lavaBoss!.battleEventPages.length).toBeGreaterThanOrEqual(1);

        const iceDrake = project.database.troops.find((t) => t.id === "troop_ice_azure_drake");
        expect(iceDrake?.uncapturable).toBe(true);
        expect(iceDrake?.members?.[0]?.enemyId).toBe("enemy_ice_azure_drake");

        const bundle = buildComplexMonsterBundle({
          enemySeeds: [
            {
              id: "enemy_bundle_a",
              name: "A",
              monsterResourceId: "generated-enemy-slime-01",
              stats: { maxHp: 20, attack: 8 },
            },
          ],
          troop: {
            id: "troop_bundle",
            name: "번들",
            members: [{ enemyId: "enemy_bundle_a" }, { enemyId: "enemy_bundle_a" }],
          },
          field: {
            id: "monster_bundle",
            name: "번들몹",
            x: 1,
            y: 1,
            troopId: "troop_bundle",
            intro: "i",
            victory: "v",
            spriteId: "tex_easyrpg_charset_monster2",
            characterIndex: 1,
            clearSwitch: "sw_0001",
          },
        });
        expect(bundle.enemies).toHaveLength(1);
        expect(bundle.troop.members).toHaveLength(2);
        expect(bundle.fieldEvent.id).toBe("monster_bundle");
      });
    });
  });
  describe("dbImageMatching", () => {
    isolateTimers();
    describe("database image matching", () => {
      it("assigns unique matching monster graphics for default enemies and species", () => {
        const project = createBlankProject();
        // qa1124 항목 4(오너 2026-11-24 «최신 몬스터들 반영»): 새 프로젝트 기본 적은 모두 현행 20칸 세트 그림이다.
        // 현행 그림이 없던 종은 대역 표(currentMonsterStandIns)의 가장 가까운 종 그림을 나눠 쓴다 — 그 밖의 공유는 실패.
        const monsterIds = project.database.enemies.map((enemy) => enemy.monsterResourceId);
        const generatedIds = monsterIds.filter((id) => id?.startsWith("generated-enemy-"));
        expect(generatedIds.length).toBe(monsterIds.length);
        expect(generatedIds.length).toBeGreaterThanOrEqual(100);
        expect(monsterIds.filter((id) => !isCurrentMonsterArt(id))).toEqual([]);
        for (const enemy of project.database.enemies) {
          const owners = project.database.enemies.filter((other) => other.monsterResourceId === enemy.monsterResourceId);
          if (owners.length === 1) continue;
          const tails = owners.map((other) => CURRENT_MONSTER_STAND_IN[other.id.replace(/^enemy_/u, "")] ?? other.id.replace(/^enemy_/u, ""));
          expect(new Set(tails).size, `${enemy.monsterResourceId}: ${owners.map((o) => o.id).join(", ")}`).toBe(1);
        }
        for (const id of monsterIds) {
          expect(resolveAssetResourceUrl(id), id).toBeTruthy();
        }

        const bySpecies = Object.fromEntries(
          (project.database.monsterSpecies ?? []).map((species) => [species.id, species.graphic.monsterResourceId]),
        );
        expect(Object.keys(bySpecies).sort()).toEqual([
          "species_aqualing", "species_cave_bat", "species_ember_drake", "species_forest_hornet",
          "species_king_slime", "species_leafling", "species_mine_skeleton", "species_sparkit",
          "species_stone_golem", "species_wild_slime",
        ]);
        expect(bySpecies.species_wild_slime).toBe("generated-enemy-slime-01");
        expect(bySpecies.species_king_slime).toBe("generated-enemy-slime-01");
        expect(bySpecies.species_cave_bat).toBe("generated-enemy-bat-01");
        expect(bySpecies.species_stone_golem).toBe("generated-enemy-golem-01");
        expect(bySpecies.species_ember_drake).toBe("generated-enemy-dragon-01");
        expect(bySpecies.species_leafling).toBe("generated-enemy-leafling-01");
        expect(bySpecies.species_forest_hornet).toBe("generated-enemy-sylph-hornet");
        expect(bySpecies.species_sparkit).toBe("generated-enemy-sparkit-fire");
        expect(bySpecies.species_aqualing).toBe("generated-enemy-aqualing-01");
        expect(bySpecies.species_mine_skeleton).toBe("generated-enemy-skeleton-01");
        for (const id of ["species_leafling", "species_sparkit", "species_aqualing"]) {
          expect(project.database.monsterSpecies?.find((species) => species.id === id)?.graphic.graphicHue).toBe(0);
        }
        expect(project.database.monsterSpecies?.find((species) => species.id === "species_sparkit")?.types).toEqual(["fire"]);
        for (const id of Object.values(bySpecies)) {
          expect(resolveAssetResourceUrl(id), id).toBeTruthy();
        }
      });

      it("uses distinct item and equipment icons for similar gear tiers", () => {
        const project = createBlankProject();
        const iron = project.database.equipment.find((entry) => entry.id === "equip_iron_sword");
        const steel = project.database.equipment.find((entry) => entry.id === "equip_steel_sword");
        const bronze = project.database.equipment.find((entry) => entry.id === "equip_sword");
        expect(bronze?.iconResourceId).toBe("cc0-jetrel-bronze-sword");
        expect(iron?.iconResourceId).toBe("cc0-jetrel-iron-sword");
        expect(steel?.iconResourceId).toBe("cc0-jetrel-steel-sword");

        const capture = project.database.items.find((item) => item.id === "item_capture_orb");
        const hiPotion = project.database.items.find((item) => item.id === "item_hi_potion");
        const elixir = project.database.items.find((item) => item.id === "item_elixir");
        const panacea = project.database.items.find((item) => item.id === "item_panacea");
        expect(capture?.iconResourceId).toBe("cc0-jetrel-capture-orb");
        expect(hiPotion?.iconResourceId).toBe("cc0-jetrel-hi-potion");
        expect(elixir?.iconResourceId).toBe("cc0-jetrel-elixir");
        expect(panacea?.iconResourceId).toBe("cc0-jetrel-panacea");

        for (const id of [
          bronze?.iconResourceId,
          iron?.iconResourceId,
          steel?.iconResourceId,
          capture?.iconResourceId,
          hiPotion?.iconResourceId,
          elixir?.iconResourceId,
          panacea?.iconResourceId,
        ]) {
          expect(resolveAssetResourceUrl(id), String(id)).toBeTruthy();
        }
      });

      it("seeds dungeon bone guards with skeleton art instead of bat art", () => {
        const project = createBlankProject();
        const { enemies } = seedHomeDungeonComplexTroops(project);
        const bone = enemies.find((enemy) => enemy.id === "enemy_stone_bone_guard");
        expect(bone?.monsterResourceId).toBe("generated-enemy-skeleton-01");
        expect(resolveAssetResourceUrl("generated-enemy-skeleton-01")).toBe(
          "/assets/generated/pixel-enemy-portraits/skeleton-01.png",
        );
      });
    });
  });
});

describe("defaultElementAffinities", () => {
  isolateTimers();
  describe("기본 적 예시 상성 (qa1124 8-2·8-3)", () => {
    it("새 프로젝트 기본 적에 약점이 생기고 골렘은 타격 2배다", () => {
      const project = createBlankProject();
      expect(project.database.enemies.some((enemy) => Object.values(enemy.elementRates ?? {}).some((grade) => grade !== "C"))).toBe(false);
      const changed = applyDefaultElementAffinities(project.database.enemies, project.database.elements ?? []);
      expect(changed).toBeGreaterThan(0);
      const golem = project.database.enemies.find((enemy) => enemy.id === "enemy_stone_golem")!;
      expect(golem.elementRates?.hit).toBe("A");
      expect(elementMultiplierFor(project, "hit", golem.id)).toBe(2);
      expect(affinitySentences(project, "hit").length).toBeGreaterThan(0);
    });

    it("작가가 정한 등급은 덮지 않는다", () => {
      const project = createBlankProject();
      const golem = project.database.enemies.find((enemy) => enemy.id === "enemy_stone_golem")!;
      golem.elementRates = { ...golem.elementRates, hit: "E" };
      applyDefaultElementAffinities(project.database.enemies, project.database.elements ?? []);
      expect(golem.elementRates.hit).toBe("E");
    });

    it("한 번 누르면 보통 → 2배 → 1.5배 → 절반 → 무효 → 보통", () => {
      expect(["C", "A", "B", "D", "E"].map((grade) => nextAffinityGrade(grade as never))).toEqual(["A", "B", "D", "E", "C"]);
    });
  });
});

// test/defaults.test.ts
// 빈 프로젝트 무결성 검증 — v2 스키마(3레이어/Database/Map Tree).
describe("defaults", () => {
  isolateTimers();
  const STARTER_VILLAGE_SMALL_HOUSE_PATTERN = [
    [374, 375, 374, 375, 374],
    [404, 405, 404, 405, 404],
    [102, 103, 103, 103, 104],
    [132, 133, 329, 133, 134],
    [162, 163, 359, 163, 164],
  ] as const;
  // 옛 시작 마을(합본 마을 칩셋)의 주민 이벤트 id — 지금 createStarterMap 은 이들을 만들지 않는다.
  const RETIRED_STARTER_VILLAGE_NPC_IDS = ["event_starter_mina", "event_starter_rowen", "event_starter_sera"] as const;
  type PatternSubject = {
    readonly tiles: readonly number[];
    readonly mapWidth: number;
    readonly mapHeight: number;
  };
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function tileSizesIn(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => tileSizesIn(entry));
    }
    if (!isRecord(value)) return [];
    return Object.entries(value).flatMap(([key, entry]) => {
      if (key === "tileSize" && typeof entry === "number") return [entry];
      return tileSizesIn(entry);
    });
  }
  describe("createBlankProject", () => {
    it("진짜 빈 프로젝트 shape를 만든다", () => {
      const p = createBlankProject();
      const maps = Object.values(p.maps);
      const startMap = p.maps[p.startMapId];

      expect(maps).toHaveLength(1);
      expect(startMap).toBeDefined();
      if (!startMap) throw new Error("missing blank start map");
      expect(startMap.name).toBe("빈 맵");
      expect(startMap.width).toBe(20);
      expect(startMap.height).toBe(15);
      expect(startMap.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(startMap.events).toHaveLength(0);
      expect(startMap.lowerTiles).toHaveLength(20 * 15);
      expect(startMap.upperTiles).toHaveLength(20 * 15);
      // 버들항의 민무늬 풀 칸(737). TILE.GRASS(240)는 합본 마을 번호라 버들항에서는 벽이다.
      expect(startMap.lowerTiles.every((tile) => tile === 737)).toBe(true);
      expect(startMap.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
      expect(p.mapTree).toEqual({ mapId: p.startMapId, children: [] });
      expect(p.villageInfoDocuments).toEqual([]);
      expect(p.system.startActorIds).toEqual(["actor_hero"]);
      expect(p.session.partyActorIds).toEqual(["actor_hero"]);
    });

    it("스키마 버전 3을 가진다", () => {
      const p = createBlankProject();
      expect(p.version).toBe(SCHEMA_VERSION);
      expect(SCHEMA_VERSION).toBe(4);
    });

    it("startMapId가 maps에 존재한다", () => {
      const p = createBlankProject();
      expect(p.maps[p.startMapId]).toBeDefined();
    });

    it("startPos가 시작 맵 경계 안에 있다", () => {
      const p = createBlankProject();
      const m = p.maps[p.startMapId];
      expect(p.startPos.x).toBeGreaterThanOrEqual(0);
      expect(p.startPos.x).toBeLessThan(m.width);
      expect(p.startPos.y).toBeGreaterThanOrEqual(0);
      expect(p.startPos.y).toBeLessThan(m.height);
    });

    it("빈 프로젝트로 헤드리스 런타임 세션을 시작할 수 있다", () => {
      const p = createBlankProject();
      const session = startSession(p);

      expect(session.currentMapId).toBe(p.startMapId);
      expect(session.x).toBe(p.startPos.x);
      expect(session.y).toBe(p.startPos.y);
      expect(p.maps[session.currentMapId]).toBeDefined();
    });

    it("Database 구조가 있다(switches/variables/commonEvents/tilesets)", () => {
      const p = createBlankProject();
      expect(Array.isArray(p.switches)).toBe(true);
      expect(Array.isArray(p.variables)).toBe(true);
      expect(Array.isArray(p.commonEvents)).toBe(true);
      expect(p.tilesets[DEFAULT_TILESET_ID]).toBeDefined();
    });

    // Break caught: reintroducing the fixed 1,000-slot seed makes a new project
    // look capped and bloats every project/session beyond the first-use picker block.
    it("starts with one small picker block instead of 1000 preallocated slots", () => {
      const p = createBlankProject();

      // 번호 슬롯은 고르기 한 블록(20개)뿐이고, 그 밖의 스위치는 아이템이 켜는 스위치를 선언한 것뿐이다(#777 `ensureItemSwitchDefs` — 아이템마다 하나).
      // 전에는 총수 31(20 + 기동석 11)을 못박았는데, 기본 아이템의 스위치가 15개가 된 공개 기준선(0d4f13e7c)부터 35 라 떨어졌다 — 수가 아니라 구성을 본다.
      const numbered = p.switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id));
      const named = p.switches.filter((entry) => !/^sw_\d{4}$/u.test(entry.id));
      const itemSwitchIds = [...new Set(p.database.items.flatMap((item) => (item.switchId ? [item.switchId] : [])))];
      expect(numbered).toHaveLength(20);
      expect(itemSwitchIds.length).toBeGreaterThan(0);
      expect(named.map((entry) => entry.id).sort()).toEqual([...itemSwitchIds].sort());
      expect(named.every((entry) => entry.name.length > 0)).toBe(true);
      expect(p.variables).toHaveLength(20);
      expect(p.switches[0]).toEqual({ id: "sw_0001", name: "" });
      expect(p.variables[0]).toEqual({ id: "var_0001", name: "" });
      expect(p.switches.some((entry) => entry.id === "sw_1000")).toBe(false);
      expect(p.variables.some((entry) => entry.id === "var_1000")).toBe(false);
      expect(p.session.switches.sw_0020).toBe(false);
      expect(p.session.variables.var_0020).toBe(0);
    });

    // Break caught: removing fixed-slot allocation must not discard legacy/authored
    // start-state ids that still need editable definitions.
    it("keeps start-state switch and variable ids without filling artificial blank slots", () => {
      const p = createBlankProject();
      p.switches = [];
      p.variables = [];
      p.session.switches = { sw_legacy_gate: true };
      p.session.variables = { var_legacy_score: 5 };

      const changed = ensureSwitchVariableSlots(p);

      expect(changed).toBe(true);
      // 아이템이 있는 한 기동석 스위치도 함께 선언된다 — 여기서 보는 것은 "인공적인 빈
      // 슬롯(sw_NNNN)이 끼어들지 않는가" 이므로 그 축만 본다.
      expect(p.switches.filter((entry) => entry.id === "sw_legacy_gate")).toHaveLength(1);
      expect(p.switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id))).toEqual([]);
      expect(p.variables).toEqual([{ id: "var_legacy_score", name: "" }]);
      expect(p.session.switches.sw_legacy_gate).toBe(true);
      // 아이템 기동석 세션 값은 함께 실린다 — 인공적인 빈 숫자 슬롯만 없으면 된다.
      expect(Object.keys(p.session.switches).filter((id) => /^sw_\d{4}$/u.test(id))).toEqual([]);
      expect(p.session.variables).toEqual({ var_legacy_score: 5 });
    });

    it("uses Beodeul City as the project-wide default chipset; the retired Combined Town sheet is no longer bundled", () => {
      const p = createBlankProject();
      const defaultTileset = p.tilesets[DEFAULT_TILESET_ID];
      const chipsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "chipset");

      expect(DEFAULT_TILESET_ID).toBe("beodeul_city");
      // 합본 마을 시트는 2026-10-07 저작권 정리로 번들에서 빠졌다 — 새 프로젝트에는 없고, 옛 저장본이 든 정의만 편집기가 계속 읽는다(retiredEasyRpgTilesets).
      expect(p.tilesets[COMBINED_TOWN_TILESET_ID]).toBeUndefined();
      expect(defaultTileset?.name).toBe(DEFAULT_TILESET_NAME);
      expect(defaultTileset?.image).toEqual({ type: "bundled", id: DEFAULT_TILESET_TEXTURE_KEY });
      expect(p.maps[p.startMapId].tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(chipsetProfiles[0]?.assetId).toBe(DEFAULT_TILESET_TEXTURE_KEY);
      expect(chipsetProfiles.filter((profile) => profile.assetId === DEFAULT_TILESET_TEXTURE_KEY)).toHaveLength(1);
      expect(chipsetProfiles.some((profile) => profile.assetId === LEGACY_RM_TILESET_TEXTURE_KEY)).toBe(false);
      expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeUndefined();
    });

    it("removes legacy RM sample tilesets and rewires old maps to bundled EasyRPG chipsets", () => {
      const p = createBlankProject();
      p.tilesets[LEGACY_RM_TILESET_ID] = {
        ...p.tilesets[DEFAULT_TILESET_ID],
        id: LEGACY_RM_TILESET_ID,
        name: "기본 타일셋",
        image: { type: "bundled", id: LEGACY_RM_TILESET_TEXTURE_KEY },
      };
      p.maps.map_town = { ...p.maps[p.startMapId], id: "map_town", name: "샘플 마을", tilesetId: LEGACY_RM_TILESET_ID };
      p.maps.map_dungeon = { ...p.maps[p.startMapId], id: "map_dungeon", name: "샘플 던전", tilesetId: LEGACY_RM_TILESET_ID };
      p.maps.map_interior = { ...p.maps[p.startMapId], id: "map_interior", name: "샘플 실내", tilesetId: LEGACY_RM_TILESET_ID };

      expect(removeLegacyRmTileset(p)).toBe(true);

      expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeUndefined();
      expect(p.maps.map_town.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
      expect(p.maps.map_dungeon.tilesetId).toBe("easyrpg_chipset_dungeon");
      expect(p.maps.map_interior.tilesetId).toBe("easyrpg_chipset_interior");
    });

    it("removes the legacy RM sample chipset resource profile", () => {
      const p = createBlankProject();
      p.resourceProfiles.push({
        kind: "chipset",
        name: "기본 타일셋",
        tileWidth: 16,
        tileHeight: 16,
        imageWidth: 480,
        imageHeight: 256,
        assetId: LEGACY_RM_TILESET_TEXTURE_KEY,
      });

      expect(ensureBundledResourceProfiles(p)).toBe(true);

      expect(p.resourceProfiles.some((profile) => profile.assetId === LEGACY_RM_TILESET_TEXTURE_KEY)).toBe(false);
    });

    it("ensureBundledResourceProfiles 가 저장본의 생성 얼굴 프로필을 걷어낸다", () => {
      const p = createBlankProject();
      // 예전 저장본처럼 생성 시리즈 낱장 프로필이 남아 있는 상태를 만든다. 지금 생성 시리즈로 등록된 낱장(GENERATED_FACESET_FACE_IDS)의 하나를 쓴다 —
      // 전에 쓰던 generated-actor-hero-01-face-01 은 그 그림과 함께 목록에서 빠져(공개 기준선부터) 걷어낼 대상으로 알아보지 못했다.
      const generatedFaceId = [...GENERATED_FACESET_FACE_IDS][0]!;
      expect(p.resourceProfiles.some((profile) => profile.assetId === generatedFaceId)).toBe(false);
      p.resourceProfiles.push({
        kind: "faceset",
        name: "빈 칸 · 생성",
        assetId: generatedFaceId,
        imageWidth: 48,
        imageHeight: 48,
      });

      expect(ensureBundledResourceProfiles(p)).toBe(true);

      expect(p.resourceProfiles.some((profile) => profile.assetId === generatedFaceId)).toBe(false);
      // 저작 목록에 다시 끼어들지도 않아야 한다.
      expect(p.resourceProfiles.some((profile) => profile.kind === "faceset" && GENERATED_FACESET_FACE_IDS.has(profile.assetId ?? ""))).toBe(false);
    });

    it("Map Tree가 있고 루트가 startMapId", () => {
      const p = createBlankProject();
      expect(p.mapTree.mapId).toBe(p.startMapId);
      expect(Array.isArray(p.mapTree.children)).toBe(true);
    });

    it("does not ship a legacy default NPC sprite in assets.sprites", () => {
      const p = createBlankProject();
      expect(p.assets.sprites.hero).toBeUndefined();
      expect(p.assets.sprites).toEqual({});
      expect(p.assets.uploaded).toBeDefined();
    });

    it("keeps removed legacy character tokens out of the default project export", () => {
      const p = createBlankProject();
      const exported = serialize(p);
      const forbiddenTokens = [
        ["npc", "villager"].join("_"),
        ["tex", "npc", "villager"].join("_"),
        ["DEFAULT", "SPRITE", "NPC"].join("_"),
        ["TEX", "NPC"].join("_"),
      ];
      const charsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "charset");

      for (const token of forbiddenTokens) {
        expect(exported.includes(token)).toBe(false);
      }
      expect(DEFAULT_EASYRPG_CHARSET_ID).toBe("tex_easyrpg_charset_people1");
      expect(charsetProfiles.some((profile) => profile.assetId === DEFAULT_EASYRPG_CHARSET_ID)).toBe(true);
    });

    it("meta.terms가 있다", () => {
      const p = createBlankProject();
      expect(typeof p.meta.terms.gold).toBe("string");
    });

    it("uses RM2K3 16x16 tiles for runtime, defaults, export, and sample fixtures", () => {
      const p = createBlankProject();
      const exported = JSON.parse(serialize(p));

      expect(DEFAULT_TILE_SIZE).toBe(16);
      expect(RUNTIME_TILE_SIZE).toBe(16);
      expect(PREVIEW_TILE_SIZE).toBe(16);
      expect(p.tilesets[DEFAULT_TILESET_ID].tileSize).toBe(16);
      expect(p.maps[p.startMapId].tileSize).toBe(16);
      // 지도 기호 시트(atlas_cartography)만 32px 칸이다 — 월드맵에 얹는 기호 그림 시트라 맵이 깔리는 칩셋이 아니다(공개 기준선부터 새 프로젝트에 실린다).
      // 그 밖의 모든 타일셋·맵·킷은 16px 이다.
      const { [ATLAS_CARTOGRAPHY_ID]: cartography, ...mapTilesets } = exported.tilesets as Record<string, unknown>;
      expect(new Set(tileSizesIn(cartography))).toEqual(new Set([32]));
      expect(Object.keys(mapTilesets).length).toBeGreaterThan(0);
      expect(tileSizesIn({ ...exported, tilesets: mapTilesets }).every((tileSize) => tileSize === 16)).toBe(true);
      expect(tileSizesIn(sampleProject).every((tileSize) => tileSize === 16)).toBe(true);
    });

    it("maps bundled chipset terrain, priority, and passability by atlas index", () => {
      // TILE.* 는 합본 마을 시트의 칸 번호다 — 기본 타일셋(버들항)이 아니라 합본 마을로 확인한다.
      // 그 시트는 새 프로젝트에 없다(2026-10-07 정리) — 옛 저장본이 든 정의(편집기가 계속 읽는 것)로 본다.
      const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
      const passable = { up: true, down: true, left: true, right: true };
      const solid = { up: false, down: false, left: false, right: false };

      expect(tileset.terrain[TILE.WATER]).toBe(TERRAIN_TAG.WATER);
      expect(tileset.terrain[TILE.PATH]).toBe(TERRAIN_TAG.NORMAL);
      expect(tileset.passability[TILE.WATER]).toEqual(solid);
      expect(tileset.passability[TILE.PATH]).toEqual(passable);
      // Tree bases occupy lower; the renderer composites ground beneath their transparency.
      // Canopies and other transparent props remain upper-layer tiles.
      expect(tileset.priority[TILE.TREE]).toBe("lower");
      expect(tileset.passability[TILE.TREE]).toEqual(solid);
      expect(tileset.priority[TILE.FLOWERS]).toBe("upper");
      expect(tileset.passability[TILE.FLOWERS]).toEqual(passable);
      expect(tileset.priority[85]).toBe("upper");
      expect(tileset.priority[378]).toBe("upper");
      expect(tileset.priority[374]).toBe("lower");
      const passableRoofTiles = [374, 375, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 436, 437].filter((tile) => !(
        tileset.passability[tile]?.up === false &&
        tileset.passability[tile]?.down === false &&
        tileset.passability[tile]?.left === false &&
        tileset.passability[tile]?.right === false
      ));
      expect(passableRoofTiles).toEqual([]);
      expect(tileLabelForIndex(TILE.PATH)).toBe("Dirt road");
    });

    it("describes one chipset cell as the smallest mapping unit", () => {
      expect(describeChipsetTile(TILE.PATH)).toMatchObject({
        index: TILE.PATH,
        column: 0,
        row: 12,
        label: "Dirt road",
        layer: "lower",
        passage: "passable",
        terrainTag: TERRAIN_TAG.NORMAL,
        repeatRole: "body",
        confirmed: true,
      });
      expect(describeChipsetTile(TILE.TREE)).toMatchObject({
        label: "Tree",
        layer: "upper",
        passage: "solid",
        repeatRole: "object",
        confirmed: true,
      });
      expect(describeChipsetTile(390)).toMatchObject({
        label: "Dirt corner",
        repeatRole: "edge",
        confirmed: true,
      });
    });

  });
  describe("createBlankMap", () => {
    it("lowerTiles/upperTiles 길이 = width*height", () => {
      const m = createBlankMap("테스트", 5, 4);
      expect(m.lowerTiles.length).toBe(20);
      expect(m.upperTiles.length).toBe(20);
    });

    it("기본 lower는 전부 잔디, upper는 전부 빈 칸", () => {
      const m = createBlankMap("테스트", 3, 3);
      expect(m.lowerTiles.every((t: number) => t === 737)).toBe(true);
      // 다른 칩셋의 빈 맵은 그 칩셋의 맨 풀로 채운다 — 번들에 없는 칩셋(옛 저장본의 합본 마을)은 그 정의를 넘겨야 바닥을 고른다.
      const town = createBlankMap("테스트", 3, 3, COMBINED_TOWN_TILESET_ID, DEFAULT_TILE_SIZE, retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID));
      expect(town.lowerTiles.every((t: number) => t === TILE.GRASS)).toBe(true);
      expect(town.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
      expect(m.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
    });

    it("tilesetId가 기본 타일셋", () => {
      const m = createBlankMap("테스트", 3, 3);
      expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
    });
  });
  describe("createStarterMap", () => {
    // createStarterMap() 은 기본 칩셋이 버들항이 된 뒤(2026-09-30)로 빈 30×30 맵이다. 집 세 채·흙길·주민 셋이 있던 합본 마을은 여기서 더 짓지 않는다 —
    // 시작 마을은 editor/content/beodeulStarterMap.ts 가 짓고(beodeulStarterMap.test.ts), 빈 맵의 바닥·가장자리는 starterVillage.test.ts 가 본다.
    // 전에는 이 묶음의 세 경우(집 무늬 374… 세 채와 이어진 길 · 흙길 칸 · 주민 이벤트 셋)가 그 옛 마을을 찾았고 공개 기준선(0d4f13e7c)부터 떨어졌다.
    // 세 경우가 보던 것이 모두 없어져 한 경우로 모은다: 크기·이름은 그대로이고, 옛 마을의 집·길·주민이 이 맵에 없다.
    it("builds the default 마을 as a blank 30x30 map: no combined-town houses, dirt roads or starter NPCs are authored here", () => {
      const m = createStarterMap();

      expect(m.name).toBe("마을");
      expect(m.width).toBe(30);
      expect(m.height).toBe(30);
      expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(m.lowerTiles.length).toBe(30 * 30);
      expect(m.upperTiles.length).toBe(30 * 30);
      expect(countPatternOccurrences({ tiles: m.lowerTiles, mapWidth: m.width, mapHeight: m.height }, STARTER_VILLAGE_SMALL_HOUSE_PATTERN)).toBe(0);
      const roadTiles = new Set<number>(dirtLikeTiles());
      expect(roadTiles.has(TILE.PATH)).toBe(true);
      expect(m.lowerTiles.filter((tile) => roadTiles.has(tile))).toEqual([]);
      expect(m.events.filter((event) => (RETIRED_STARTER_VILLAGE_NPC_IDS as readonly string[]).includes(event.id))).toEqual([]);
      expect(m.events).toEqual([]);
    });

    it("keeps the compact village boundary open grass (no wall frame)", () => {
      const m = createStarterMap();
      for (let x = 0; x < m.width; x++) {
        expect(m.lowerTiles[0 * m.width + x]).not.toBe(TILE.WALL);
        expect(m.lowerTiles[(m.height - 1) * m.width + x]).not.toBe(TILE.WALL);
      }
      for (let y = 0; y < m.height; y++) {
        expect(m.lowerTiles[y * m.width + 0]).not.toBe(TILE.WALL);
        expect(m.lowerTiles[y * m.width + (m.width - 1)]).not.toBe(TILE.WALL);
      }
    });
  });
  function countPatternOccurrences(
    subject: PatternSubject,
    pattern: readonly (readonly number[])[]
  ): number {
    let count = 0;
    const patternHeight = pattern.length;
    const patternWidth = pattern[0]?.length ?? 0;
    for (let y = 0; y <= subject.mapHeight - patternHeight; y += 1) {
      for (let x = 0; x <= subject.mapWidth - patternWidth; x += 1) {
        if (matchesPatternAt(subject, pattern, { x, y })) count += 1;
      }
    }
    return count;
  }
  function matchesPatternAt(
    subject: PatternSubject,
    pattern: readonly (readonly number[])[],
    origin: { readonly x: number; readonly y: number }
  ): boolean {
    for (let y = 0; y < pattern.length; y += 1) {
      const row = pattern[y];
      if (!row) return false;
      for (let x = 0; x < row.length; x += 1) {
        const tile = row[x];
        if (tile !== undefined && tile >= 0 && subject.tiles[(origin.y + y) * subject.mapWidth + origin.x + x] !== tile) return false;
      }
    }
    return true;
  }
});

describe("dungeonTerrainAutotiles", () => {
  isolateTimers();
  describe("dungeon terrain autotiles (RM2k3 blocks ×12 + 카펫)", () => {
    it("블랭크 프로젝트의 던전 타일셋에 지형 그룹 13종이 시드된다 (재적용은 idempotent)", () => {
      const dungeon = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
      const ids = (dungeon.autotileGroups ?? []).map((group) => group.id);
      for (const key of [
        "stone", "chasm", "redrock", "lava", "pit-pale", "pit-gold",
        "snow", "ice", "dirt", "moss", "abyss-blue", "abyss-gray", "red-carpet",
      ]) {
        expect(ids).toContain(`${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
      }
      expect(applyEasyRpgThemeMetadataPacks(dungeon)).toBe(false);
    });

    it("용암: 몸통 304 blob이 변/모서리로 성형되고 1칸은 고립 243, 구멍 주변은 오목 245", () => {
      const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("lava"))!;
      const W = 9;
      const H = 9;
      const BODY = 304;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(271) };
      const points: { x: number; y: number }[] = [];
      // 4×4 blob + 외딴 1칸
      for (let y = 2; y <= 5; y += 1) {
        for (let x = 2; x <= 5; x += 1) {
          map.lowerTiles[y * W + x] = BODY;
          points.push({ x, y });
        }
      }
      map.lowerTiles[1 * W + 7] = BODY;
      points.push({ x: 7, y: 1 });
      // 구멍(오목 코너 유발)
      map.lowerTiles[3 * W + 3] = 271;
      shapeAutotileGroupAround(map, group, points);

      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      expect(at(2, 2)).toBe(273); //   NW 코너
      expect(at(5, 2)).toBe(275); //   NE 코너
      expect(at(2, 5)).toBe(333); //   SW 코너
      expect(at(5, 5)).toBe(335); //   SE 코너
      expect(at(4, 2)).toBe(274); //   북 변
      expect(at(2, 4)).toBe(303); //   서 변
      expect(at(4, 4)).toBe(245); //   구멍 대각 → 오목 코너 소스
      expect(at(7, 1)).toBe(243); //   고립 1칸
      // 바탕 칸(적암 244)은 멤버가 아니다
      expect(group.memberTileIds).not.toContain(244);
    });

    it("붉은 카펫(9-슬라이스): 고립/오목은 몸통 169로 폴백, 3×3 성형은 정상", () => {
      const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("red-carpet"))!;
      const W = 7;
      const H = 7;
      const BODY = 169;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(157) };
      const points: { x: number; y: number }[] = [];
      for (let y = 2; y <= 4; y += 1) {
        for (let x = 2; x <= 4; x += 1) {
          map.lowerTiles[y * W + x] = BODY;
          points.push({ x, y });
        }
      }
      map.lowerTiles[1 * W + 6] = BODY; // 외딴 1칸 → 몸통 169 유지
      points.push({ x: 6, y: 1 });
      shapeAutotileGroupAround(map, group, points);
      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      expect(at(2, 2)).toBe(138); // NW
      expect(at(3, 2)).toBe(139); // N
      expect(at(4, 4)).toBe(200); // SE
      expect(at(3, 3)).toBe(169); // 몸통
      expect(at(6, 1)).toBe(169); // 고립 = 몸통 폴백
      // 계단(228~230)은 카펫 그룹 멤버가 아니다
      expect(group.memberTileIds).not.toContain(228);
      expect(group.memberTileIds).not.toContain(229);
      expect(group.memberTileIds).not.toContain(230);
    });

    it("호스트 지형은 오버레이 블록을 연결로 본다 (흙→이끼: 이끼 옆 흙은 몸통 유지)", () => {
      const groups = createDungeonTerrainAutotileGroups();
      const dirt = groups.find((g) => g.id.endsWith("-dirt"))!;
      const moss = groups.find((g) => g.id.endsWith("-moss"))!;
      // 이끼 바탕 아트 = 흙이므로 전환 테두리는 이끼 쪽이 그린다 — 흙은 이끼를 연결로 취급.
      for (const tile of moss.memberTileIds) expect(dirt.connectTileIds).toContain(tile);
      expect(moss.connectTileIds).not.toContain(421); // 역방향은 아니다(이끼는 흙 옆에서 테두리를 그린다)

      // 흙밭 한가운데 이끼를 얹고 흙을 재성형해도 이끼 인접 흙은 몸통(421)을 유지한다.
      const W = 7;
      const H = 7;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(421) };
      map.lowerTiles[3 * W + 3] = 424; // 중앙 이끼 몸통
      const points: { x: number; y: number }[] = [];
      for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) points.push({ x, y });
      shapeAutotileGroupAround(map, dirt, points);
      expect(map.lowerTiles[3 * W + 2]).toBe(421);
      expect(map.lowerTiles[2 * W + 3]).toBe(421);
      expect(map.lowerTiles[2 * W + 2]).toBe(421);
    });

    it("심연(푸른 테두리): 몸통 427 blob의 변/모서리 성형", () => {
      const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("abyss-blue"))!;
      const W = 7;
      const H = 7;
      const BODY = 427;
      const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(157) };
      const points: { x: number; y: number }[] = [];
      for (let y = 2; y <= 4; y += 1) {
        for (let x = 2; x <= 4; x += 1) {
          map.lowerTiles[y * W + x] = BODY;
          points.push({ x, y });
        }
      }
      shapeAutotileGroupAround(map, group, points);
      const at = (x: number, y: number) => map.lowerTiles[y * W + x];
      expect(at(2, 2)).toBe(396); // NW
      expect(at(3, 2)).toBe(397); // N
      expect(at(4, 2)).toBe(398); // NE
      expect(at(3, 3)).toBe(427); // 몸통
      expect(at(3, 4)).toBe(457); // 남 변
    });

    it("던전 하네스 그룹은 타일 중복 없이 시드된다 (재적용 idempotency 전제)", () => {
      const dungeon = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
      const seen = new Map<number, string>();
      for (const group of dungeon.tileGroups ?? []) {
        for (const tile of group.tileIds) {
          expect(seen.has(tile), `tile ${tile} in ${seen.get(tile)} and ${group.id}`).toBe(false);
          seen.set(tile, group.id);
        }
      }
      // 물(1)은 통행 불가, 적암 바닥(270)은 통행 가능 계약
      expect(dungeon.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
      expect(dungeon.passability[270]).toEqual({ up: true, down: true, left: true, right: true });
      // 투명 배경 소품은 상위 레이어
      expect(dungeon.priority[262]).toBe("upper");
      expect(dungeon.priority[327]).toBe("upper");
    });
  });
});

describe("enemyActionArchetypes", () => {
  isolateTimers();
  const db = defaultDatabase() as any;
  const skillById = new Map<string, any>((db.skills as any[]).map((skill) => [skill.id, skill]));
  /** MP 비용은 DB 에서 유도한다. id 목록을 상수로 박으면 누가 그 스킬에 mpCost 를 붙여도
   *  테스트는 초록으로 남고 고갈 방어만 조용히 무너진다. */
  function mpCostOf(skillId: string): number {
    const skill = skillById.get(skillId);
    if (!skill) throw new Error(`${skillId} 가 기본 DB 에 없다`);
    return skill.mpCost?.flat ?? 0;
  }
  /** 상태를 걸거나 속성을 띠거나 MP 를 먹는 스킬 = 그 아키타입의 정체성.
   *  평범한 무료 무기 공격(attack/sword_slash/throwing_knife)과 구분한다. */
  function isIdentitySkill(skillId: string): boolean {
    const skill = skillById.get(skillId);
    if (!skill) throw new Error(`${skillId} 가 기본 DB 에 없다`);
    return (skill.stateEffects ?? []).length > 0 || typeof skill.elementId === "string" || mpCostOf(skillId) > 0;
  }
  describe("archetypeActions", () => {
    const archetypes = ["blob", "venom", "brute", "curse", "caster", "bulwark", "tactician", "flyer", "boss"] as const;

    it("모든 아키타입이 행동을 2개 이상 준다 — 1개면 효용도 AI 가 선택할 게 없다", () => {
      for (const a of archetypes) {
        expect(archetypeActions(a, "skill_fire").length, a).toBeGreaterThanOrEqual(2);
      }
    });

    it("모든 아키타입이 MP 0 스킬을 최소 1개 갖는다 — MP 고갈 시 행동 불능을 막는다", () => {
      for (const a of archetypes) {
        const ids = archetypeActions(a, "skill_fire").map((p) => p.skillId);
        const free = ids.filter((id) => mpCostOf(id) === 0);
        expect(free.length, `${a}: ${ids.map((id) => `${id}(${mpCostOf(id)}MP)`).join(", ")}`).toBeGreaterThanOrEqual(1);
      }
    });

    // R14 규칙 1 (B1 개정). 점수식은 damage 스킬의 stateEffects 를 안 본다
    // (runtime.ts:1896-1898). 상태·보조 정체성기는 효용이 "상태 부여 확률" 이라 데미지
    // 축과 단위가 다르므로, 앵커보다 **우선순위**가 낮으면 영구히 사장된다.
    //
    // 데미지형 정체성기는 이 검사가 아니라 아래 "점수 축약형" 검사가 본다 — 우선순위만
    // 보면 보스 속성기(5)가 앵커(7)보다 낮아 오탐이 난다. 실제로는 위력차가 우선순위차를
    // 상쇄해 **점수가 동률**이다(BOSS_ELEMENT 주석 참조).
    it("상태·보조 정체성기가 앵커보다 낮은 우선순위를 갖지 않는다", () => {
      for (const a of archetypes) {
        const patterns = archetypeActions(a, "skill_fire");
        const anchor = patterns.find((p) => p.skillId === "skill_attack");
        const support = patterns.filter(
          (p) => isIdentitySkill(p.skillId) && skillById.get(p.skillId)?.effect?.kind !== "damage",
        );
        if (!anchor || support.length === 0) continue;
        const worst = Math.min(...support.map((p) => p.priority));
        expect(
          worst,
          `${a}: 상태·보조 정체성기 최저 ${worst} < 앵커 ${anchor.priority} — 영구히 사장된다`,
        ).toBeGreaterThanOrEqual(anchor.priority);
      }
    });

    // 데미지형 정체성기는 우선순위가 아니라 **점수 축약형**으로 본다.
    // `core = priority*10 + power + floor(스탯/2)` 이고 대상 관련 항은 모든 데미지 스킬이
    // 공유하므로(runtime.ts:1881-1888), 두 데미지 스킬의 우열은 core 로 정해진다.
    // 앵커의 core 는 AI 가 보는 위력 10 으로 계산한다 — 실피해는 attackPower 지만
    // **선택**을 하는 건 AI 의 잘못된 평가 쪽이다(runtime.ts:1897 vs 1953).
    it("데미지형 정체성기의 점수가 앵커보다 낮지 않다 — mind = attack 구간 전체", () => {
      const losers: string[] = [];
      for (const a of archetypes) {
        const patterns = archetypeActions(a, "skill_fire");
        for (let stat = 9; stat <= 214; stat += 1) {
          const core = (p: (typeof patterns)[number]) =>
            Math.max(1, p.priority) * 10 + (skillById.get(p.skillId)?.power ?? 0) + Math.floor(stat / 2);
          const damage = patterns.filter((p) => skillById.get(p.skillId)?.effect?.kind === "damage");
          const identity = damage.filter((p) => isIdentitySkill(p.skillId));
          const anchor = damage.find((p) => p.skillId === "skill_attack");
          if (!anchor || identity.length === 0) continue;
          // 보스는 always(동률) + turn 버스트(위) 두 벌을 갖는다. "정체성이 살아 있는가" 는
          // 그중 **최선**으로 판정한다 — 버스트가 주기 발화를 맡는 설계다.
          const best = Math.max(...identity.map(core));
          if (best < core(anchor)) losers.push(`${a}@stat${stat}: 정체성 ${best} < 앵커 ${core(anchor)}`);
        }
      }
      expect(losers.slice(0, 5), `${losers.length}건 사장`).toEqual([]);
    });

    // B1 규칙 3 — **앵커 불변식.** 이게 이 파일에서 회당 피해를 지키는 유일한 장치다.
    //
    // 런타임의 두 경로가 다른 위력을 쓴다: 실제 피해는
    // `skillId === DEFAULT_SKILL_ID ? user.attackPower : skill.power`(runtime.ts:1953) 라
    // skill_attack 의 실위력이 시전자 attackPower(로스터 9~214)인데, AI 효용은
    // `enemyDamageUtility(user, target, skill.power, …)`(runtime.ts:1897) 로 **10** 을 본다.
    // 그래서 고정 위력 무료기(sword_slash 22 / throwing_knife 18)를 앵커 위에 두면 AI 가
    // 자기 최강수를 영구히 버린다 — 실측 출하 트룹 4개 합계 피해 806 → 180(−78%).
    //
    // 유료 정체성기는 MP 가 횟수를 묶어서 앵커 위에 둬도 안전하지만(몇 번 쓰고 내려온다),
    // **무료** 고정 위력기는 자기제한이 없어 한번 이기면 전투 내내 이긴다. 그래서 이 검사는
    // MP 0 짜리 순수 데미지 스킬만 본다.
    it("앵커(skill_attack)가 고정 위력 무료 데미지 스킬보다 우선순위가 높다", () => {
      for (const a of archetypes) {
        const patterns = archetypeActions(a, "skill_fire");
        const anchor = patterns.find((p) => p.skillId === "skill_attack");
        expect(anchor, `${a}: 앵커 skill_attack 이 없다`).toBeDefined();
        // 고정 위력 무료 데미지 = MP 0 + damage 효과 + 상태·속성 없음(= 정체성 아님).
        const fixedFree = patterns.filter(
          (p) =>
            p.skillId !== "skill_attack" &&
            mpCostOf(p.skillId) === 0 &&
            skillById.get(p.skillId)?.effect?.kind === "damage" &&
            !isIdentitySkill(p.skillId),
        );
        for (const rival of fixedFree) {
          expect(
            anchor!.priority,
            `${a}: ${rival.skillId}(${rival.priority}) 가 앵커(${anchor!.priority}) 이상이다 — ` +
              `앵커가 영구히 사장되고 회당 피해가 위력 ${skillById.get(rival.skillId)?.power} 로 고정된다`,
          ).toBeGreaterThan(rival.priority);
        }
      }
    });

    // R14 규칙 2 (B1 개정). "유료 > 무료" 를 전면 적용하던 규칙은 보스에서 역효과였다 —
    // 보스 maxMp 는 40 이라 유료 속성기가 자기제한되지 않고 앵커를 통째로 밀어낸다.
    // 그래서 규칙을 **비-데미지 유료기**(상태·보조)로 좁힌다. 이쪽은 상태가 이미 걸려
    // 있으면 효용 0 으로 강등돼(runtime.ts:1822) MP 와 상태 중복이 이중으로 묶어준다.
    it("유료 상태·보조기가 같은 아키타입의 무료 스킬보다 낮은 우선순위를 갖지 않는다", () => {
      for (const a of archetypes) {
        const patterns = archetypeActions(a, "skill_fire");
        const paidSupport = patterns.filter(
          (p) => mpCostOf(p.skillId) > 0 && skillById.get(p.skillId)?.effect?.kind !== "damage",
        );
        const free = patterns.filter((p) => mpCostOf(p.skillId) === 0);
        if (paidSupport.length === 0 || free.length === 0) continue;
        const worstPaid = Math.min(...paidSupport.map((p) => p.priority));
        const bestFree = Math.max(...free.map((p) => p.priority));
        expect(worstPaid, `${a}: 유료 상태·보조 최저 ${worstPaid} < 무료 최고 ${bestFree}`).toBeGreaterThanOrEqual(bestFree);
      }
    });

    it("참조하는 스킬이 전부 실재한다", () => {
      const known = new Set((db.skills as any[]).map((s) => s.id));
      for (const a of archetypes) {
        for (const p of archetypeActions(a, "skill_fire")) {
          expect(known.has(p.skillId), `${a} → ${p.skillId} 없음`).toBe(true);
        }
      }
      for (const skillId of Object.values(SPIRIT_ELEMENT_SKILLS)) {
        expect(known.has(skillId), `${skillId} 없음`).toBe(true);
      }
    });

    // 조용히 폴백하는 쪽은 정확히 **키**다. Task 4 가 SPIRIT_ELEMENT_SKILLS[enemy.id] 로
    // 조회하면 오타난 키는 아무 신호 없이 무속성 skill_arcane_bolt 폴백으로 떨어지고,
    // SkillId = string 이라 타입도 못 잡는다.
    it("SPIRIT_ELEMENT_SKILLS 의 키(적 id)가 전부 기본 DB 에 실재한다", () => {
      const knownEnemies = new Set((db.enemies as any[]).map((e) => e.id));
      for (const enemyId of Object.keys(SPIRIT_ELEMENT_SKILLS)) {
        expect(knownEnemies.has(enemyId), `${enemyId} 가 기본 DB 의 적에 없음 — 조용히 폴백한다`).toBe(true);
      }
    });

    it("BOSS_ELEMENT_SKILLS 의 키(적 id)가 전부 기본 DB 에 실재한다", () => {
      const knownEnemies = new Set((db.enemies as any[]).map((e) => e.id));
      for (const enemyId of Object.keys(BOSS_ELEMENT_SKILLS)) {
        expect(knownEnemies.has(enemyId), `${enemyId} 가 기본 DB 의 적에 없음 — 조용히 폴백한다`).toBe(true);
      }
    });

    it("boss 만 turn 조건 패턴을 갖는다", () => {
      for (const a of archetypes) {
        const hasTurn = archetypeActions(a, "skill_fire").some((p) => p.condition.kind === "turn");
        expect(hasTurn, a).toBe(a === "boss");
      }
    });
  });
  describe("스타터 적", () => {
    it("기본 트룹이 쓰는 적이 전부 행동 2개 이상을 갖는다", () => {
      const db = defaultDatabase() as any;
      const used = new Set(db.troops.flatMap((t: any) => (t.members ?? []).map((m: any) => m.enemyId)));
      expect(used.size).toBeGreaterThan(0);
      for (const id of used) {
        const enemy = db.enemies.find((e: any) => e.id === id);
        expect(enemy, `${id} 없음`).toBeDefined();
        expect((enemy.actions ?? []).length, `${id} 행동 부족`).toBeGreaterThanOrEqual(2);
      }
    });
  });
  describe("적 전원", () => {
    it("행동이 1개뿐인 적이 없다", () => {
      const db = defaultDatabase() as any;
      const shallow = db.enemies.filter((e: any) => (e.actions ?? []).length <= 1).map((e: any) => e.id);
      expect(shallow, `행동 1개뿐: ${shallow.join(", ")}`).toEqual([]);
    });

    it("정령 10마리가 서로 다른 속성 공격을 쓴다 — 속성 저항이 의미를 가지려면", () => {
      const db = defaultDatabase() as any;
      const spiritIds = Object.keys(SPIRIT_ELEMENT_SKILLS);
      const used = new Set<string>();
      for (const id of spiritIds) {
        const enemy = db.enemies.find((e: any) => e.id === id);
        expect(enemy, `${id} 없음`).toBeDefined();
        for (const p of enemy.actions) {
          const skill = db.skills.find((s: any) => s.id === p.skillId);
          if (skill?.elementId) used.add(skill.elementId);
        }
      }
      // 불·물·대지·바람·신성·암흑·얼음 = 7종 이상이 정령 계열에서 실제로 쓰인다.
      expect(used.size, `쓰인 속성: ${[...used].join(",")}`).toBeGreaterThanOrEqual(7);
    });

    it("모든 적이 MP 0 스킬을 최소 1개 갖는다", () => {
      const db = defaultDatabase() as any;
      const free = new Set(db.skills.filter((s: any) => (s.mpCost?.flat ?? 0) === 0).map((s: any) => s.id));
      const stuck = db.enemies
        .filter((e: any) => !(e.actions ?? []).some((p: any) => free.has(p.skillId)))
        .map((e: any) => e.id);
      expect(stuck, `MP 고갈 시 행동 불능: ${stuck.join(", ")}`).toEqual([]);
    });
  });
  // 적이 dark 속성 공격(skill_dark)을 쓰는데 저항 시드 표에 dark 가 없으면, 맞는 쪽
  // (액터·직업)의 elementRates 에 등급이 없어 runtime.elementMultiplierFor 가 배율 1.0 으로
  // 조용히 빠진다 — 무속성 공격과 수치가 완전히 같아져 curse 아키타입의 속성 배정이 장식이 된다.
  describe("dark 속성 저항 시드", () => {
    it("기본 저항 시드 표가 dark 를 포함한다", () => {
      expect(DEFAULT_ELEMENT_RATE_LABELS.map((entry) => entry.id)).toContain("dark");
    });

    it("시드 표의 모든 속성이 elements 테이블에 실재한다", () => {
      const known = new Set((defaultDatabase().elements ?? []).map((entry) => entry.id));
      for (const label of DEFAULT_ELEMENT_RATE_LABELS) {
        expect(known.has(label.id), `${label.id} 가 elements 에 없음`).toBe(true);
      }
    });

    it("새 적/액터의 elementRates 가 dark 등급을 갖는다", () => {
      expect(normalizeEnemyRecord({ id: "enemy_probe", name: "탐침" }).elementRates?.dark).toBe("C");
      expect(defaultDatabase().actors[0]?.elementRates?.dark).toBe("C");
    });
  });
  // ── 산출물: 계열별 배정표 ───────────────────────────────────────────────────
  // Task 5·6 이 이 표를 기준으로 재측정한다. 손으로 적은 표는 코드와 어긋나므로,
  // 아래 EXPECTED 는 **레코드의 actions 를 archetypeActions() 출력과 대조해 역판정한
  // 결과**와 매 실행마다 맞춰진다. 배정을 바꾸면 이 표가 먼저 빨개진다.
  const ARCHETYPES = [
    "blob",
    "venom",
    "brute",
    "curse",
    "caster",
    "bulwark",
    "tactician",
    "flyer",
    "boss",
  ] as const;
  function signatureOf(patterns: readonly any[]): string {
    return patterns
      .map((p) => `${p.skillId}@${p.priority}@${p.condition.kind}`)
      .sort()
      .join("|");
  }
  /** 이 적의 행동 집합을 낳은 아키타입을 역판정한다. 정령·보스는 개체 속성을 넘겨야 맞는다. */
  function classify(enemy: any): string | null {
    const want = signatureOf(enemy.actions ?? []);
    const elements: (string | undefined)[] = [
      undefined,
      (SPIRIT_ELEMENT_SKILLS as Record<string, string>)[enemy.id],
      (BOSS_ELEMENT_SKILLS as Record<string, string>)[enemy.id],
    ];
    for (const archetype of ARCHETYPES) {
      for (const element of elements) {
        if (signatureOf(archetypeActions(archetype, element)) === want) return archetype;
      }
    }
    return null;
  }
  const EXPECTED_ARCHETYPES: Record<string, string[]> = {
    // 슬라임·젤리 (8)
    blob: [
      "enemy_slime_blue",
      "enemy_slime_red",
      "enemy_slime_green",
      "enemy_slime_metal",
      "enemy_slime_king",
      "enemy_slime_cube",
      "enemy_ooze_black",
      "enemy_ooze_acid",
    ],
    // 곤충·절지 (12)
    venom: [
      "enemy_bat_cave",
      "enemy_bat_vampire",
      "enemy_bee_giant",
      "enemy_spider_cave",
      "enemy_spider_widow",
      "enemy_scorpion_sand",
      "enemy_beetle_horn",
      "enemy_mantis_blade",
      "enemy_centipede_fire",
      "enemy_moth_dust",
      "enemy_worm_sand",
      "enemy_ant_soldier",
    ],
    // 야수 (14)
    brute: [
      "enemy_wolf_grey",
      "enemy_wolf_dire",
      "enemy_boar_tusk",
      "enemy_bear_brown",
      "enemy_tiger_saber",
      "enemy_rat_giant",
      "enemy_bird_hawk",
      "enemy_snake_viper",
      "enemy_cat_shadow",
      "enemy_goat_mountain",
      "enemy_crab_rock",
      "enemy_hound_hell",
      "enemy_ape_stone",
      "enemy_deer_forest",
    ],
    // 언데드 (12)
    curse: [
      "enemy_skeleton_bone",
      "enemy_skeleton_archer",
      "enemy_skeleton_knight",
      "enemy_zombie_rot",
      "enemy_ghoul_grave",
      "enemy_ghost_pale",
      "enemy_wraith_dark",
      "enemy_lich_frost",
      "enemy_mummy_bandage",
      "enemy_banshee_wail",
      "enemy_revenant_vengeful",
      "enemy_bonepile_crawler",
    ],
    // 정령·원소 (10)
    caster: [
      "enemy_spirit_fire",
      "enemy_spirit_water",
      "enemy_spirit_earth",
      "enemy_spirit_wind",
      "enemy_spirit_light",
      "enemy_spirit_dark",
      "enemy_wisp_blue",
      "enemy_sylph_air",
      "enemy_undine_sea",
      "enemy_salamander_flame",
    ],
    // 골렘·구조물 (10)
    bulwark: [
      "enemy_golem_stone",
      "enemy_golem_iron",
      "enemy_golem_clay",
      "enemy_golem_crystal",
      "enemy_armor_living",
      "enemy_sword_flying",
      "enemy_mimic_chest",
      "enemy_scarecrow_field",
      "enemy_puppet_string",
      "enemy_totem_cursed",
    ],
    // 인간형 (15)
    tactician: [
      "enemy_goblin_scout",
      "enemy_goblin_brute",
      "enemy_orc_warrior",
      "enemy_orc_shaman",
      "enemy_kobold_digger",
      "enemy_bandit_mask",
      "enemy_mage_rogue",
      "enemy_knight_fallen",
      "enemy_lizardman_spear",
      "enemy_harpy_cliff",
      "enemy_minotaur_maze",
      "enemy_centaur_plains",
      "enemy_troll_cave",
      "enemy_ogre_club",
      "enemy_imp_mischief",
    ],
    // 수생·비행 (9)
    flyer: [
      "enemy_fish_piranha",
      "enemy_squid_deep",
      "enemy_shark_land",
      "enemy_eel_electric",
      "enemy_griffin_sky",
      "enemy_wyvern_cliff",
      "enemy_roc_giant",
      "enemy_gargoyle_stone",
      "enemy_phoenix_rebirth",
    ],
    // 드래곤·보스 (10)
    boss: [
      "enemy_dragon_whelp",
      "enemy_dragon_red",
      "enemy_dragon_blue",
      "enemy_dragon_bone",
      "enemy_hydra_three",
      "enemy_behemoth_horn",
      "enemy_demon_lord",
      "enemy_angel_fallen",
      "enemy_eye_floating",
      "enemy_plant_carnivore",
    ],
  };
  describe("생성된 적 100마리 배정표", () => {
    const generated = generatedEnemyRecords() as any[];

    // 역판정이 성립하려면 9 개 아키타입의 서명이 서로 달라야 한다. 같아지면 classify 가
    // 먼저 걸린 쪽을 조용히 반환해 배정표가 거짓으로 초록이 된다.
    it("아키타입 서명이 서로 겹치지 않는다 — 역판정의 전제", () => {
      const seen = new Map<string, string>();
      for (const archetype of ARCHETYPES) {
        const sig = signatureOf(archetypeActions(archetype, "skill_fire"));
        expect(seen.has(sig), `${archetype} 가 ${seen.get(sig)} 와 서명 충돌`).toBe(false);
        seen.set(sig, archetype);
      }
    });

    it("100마리 전원이 어느 아키타입에서 유래했는지 판정된다", () => {
      const orphans = generated.filter((e) => classify(e) === null).map((e) => e.id);
      expect(orphans, `헬퍼 출력과 안 맞는 적: ${orphans.join(", ")}`).toEqual([]);
      expect(generated.length).toBe(100);
    });

    it("배정표가 코드에서 유도한 결과와 일치한다", () => {
      const derived: Record<string, string[]> = {};
      for (const enemy of generated) (derived[classify(enemy)!] ??= []).push(enemy.id);
      expect(derived).toEqual(EXPECTED_ARCHETYPES);
    });

    it("정령 10마리만 caster 이며 SPIRIT_ELEMENT_SKILLS 의 키와 정확히 같다", () => {
      expect(EXPECTED_ARCHETYPES.caster.slice().sort()).toEqual(Object.keys(SPIRIT_ELEMENT_SKILLS).sort());
    });

    // EXPECTED_ARCHETYPES 만으로는 **체계적** 오배정을 못 잡는다 — 표를 편집 결과에서
    // 뽑았으므로 구획을 통째로 잘못 붙여도 표가 같이 틀려 초록이 된다. 그래서 배정의
    // 근거인 소스의 구획 주석을 직접 읽어 계획의 계열↔아키타입 표와 대조한다.
    it("소스의 구획 주석과 아키타입이 계획의 표대로 대응한다", () => {
      const SECTION_ARCHETYPE: Record<string, string> = {
        "슬라임·젤리": "blob",
        "곤충·절지": "venom",
        야수: "brute",
        언데드: "curse",
        "정령·원소": "caster",
        "골렘·구조물": "bulwark",
        인간형: "tactician",
        "수생·비행": "flyer",
        "드래곤·보스": "boss",
      };
      const source = readFileSync(new URL("../src/project/defaults/generatedEnemyRecords.ts", import.meta.url), "utf8");
      const byId = new Map(generated.map((e) => [e.id, e]));
      const seenSections = new Set<string>();
      let section: string | null = null;
      let checked = 0;
      for (const line of source.split("\n")) {
        const comment = line.match(/^\s*\/\/ (.+)$/);
        if (comment && SECTION_ARCHETYPE[comment[1]!]) {
          section = comment[1]!;
          seenSections.add(section);
          continue;
        }
        const record = line.match(/normalizeEnemyRecord\(\{ \.\.\.\{"id":"([a-z_]+)"/);
        if (!record) continue;
        const id = record[1]!;
        expect(section, `${id} 가 구획 주석 밖에 있다`).not.toBeNull();
        expect(classify(byId.get(id)), `${id} (${section})`).toBe(SECTION_ARCHETYPE[section!]);
        checked += 1;
      }
      expect(checked, "소스에서 읽어낸 레코드 수").toBe(100);
      expect(seenSections.size, "소스에서 읽어낸 구획 수").toBe(9);
    });
  });
  // ── Task 5 ─────────────────────────────────────────────────────────────────
  // 여기까지는 레퍼토리의 **존재**만 보증했다. 아래는 그 레퍼토리가 **발화**하는지를 건다.

  /** 브리프의 보스 목록 = 생성 로스터의 드래곤·보스 구획 10 + 스타터 `enemy_dragon`. */
  const BOSS_IDS = [
    "enemy_dragon",
    "enemy_dragon_whelp",
    "enemy_dragon_red",
    "enemy_dragon_blue",
    "enemy_dragon_bone",
    "enemy_hydra_three",
    "enemy_behemoth_horn",
    "enemy_demon_lord",
    "enemy_angel_fallen",
    "enemy_eye_floating",
    "enemy_plant_carnivore",
  ] as const;
  describe("보스 MP 예산", () => {
    it("보스는 4MP 특수기를 10회 쓸 수 있다", () => {
      for (const id of BOSS_IDS) {
        const enemy = (db.enemies as any[]).find((e) => e.id === id);
        expect(enemy, `${id} 없음`).toBeDefined();
        expect(enemy.stats.maxMp, id).toBe(40);
      }
    });

    it("보스가 아닌 적의 maxMp 는 10 그대로다", () => {
      const boss = new Set<string>(BOSS_IDS);
      const odd = (db.enemies as any[]).filter((e) => !boss.has(e.id) && e.stats.maxMp !== 10).map((e) => e.id);
      expect(odd, `예상 밖 maxMp: ${odd.join(", ")}`).toEqual([]);
    });
  });
  // ── R16: 적 mind 스케일 ─────────────────────────────────────────────────────
  // 데미지 효용은 `max(0, power + floor(스탯/2) − floor(대상방어/2))`(runtime.ts:1881-1888),
  // 선택 점수는 `max(1,priority)*10 + utility`(runtime.ts:1820) 다. 대상방어 항과
  // 킬(+1000)·HP비율(+20·손실률) 보너스는 **같은 대상에 대해 모든 데미지 스킬이 공유**하므로
  // 두 데미지 스킬의 우열은 아래 축약형으로 결정된다. mind 가 전원 10 이면 마법 정체성기는
  // `power + 5` 에 묶이고 물리 무료기는 적 attack 에 비례해 커져 정체성기가 영구히 진다.
  //
  // 한계를 숨기지 않는다: 축약형은 **양쪽 효용이 모두 양수인 구간**에서만 순서를 보증한다.
  // `max(0,…)` 가 한쪽만 0 으로 자르면 그쪽은 `-1000 + priority` 밴드로 강등된다
  // (runtime.ts:1822). 위력 8 짜리 poison_sting 은 대상방어가 `attack/2 + 8`~`+9` 인 딱 두
  // 칸에서 자기만 잘려 기본공격(위력 10)에 진다 — 우선순위 차이로는 못 메우는 구조적 잔재다.
  type ScoredDamage = { readonly id: string; readonly core: number };
  /** 이 적의 `actions` 중 데미지 효과 스킬만, 대상 소거한 점수 축약형으로 환산한다.
   *
   *  turn 조건 패턴도 센다(B1). 보스의 속성기는 `always`(앵커와 동률) + `turn` 버스트(위)
   *  두 벌인데, `always` 만 보면 "정체성이 죽었다" 로 오판한다 — 주기 발화를 맡는 건
   *  버스트다. 대신 아래 검사는 정체성 쪽 **최선**과 평범 쪽 최선을 비교한다. */
  function damageCores(enemy: any, identity: boolean): ScoredDamage[] {
    return (enemy.actions ?? [])
      .map((p: any) => ({ pattern: p, skill: skillById.get(p.skillId) }))
      .filter((e: any) => e.skill?.effect?.kind === "damage" && isIdentitySkill(e.pattern.skillId) === identity)
      .map((e: any) => ({
        id: e.pattern.skillId,
        core:
          Math.max(1, e.pattern.priority) * 10 +
          e.skill.power +
          Math.floor((e.skill.effect.statistic === "mind" ? enemy.stats.mind : enemy.stats.attack) / 2),
      }));
  }
  describe("적 mind 스케일 (R16)", () => {
    it("생성된 적 100마리의 mind 가 그 적의 attack 과 같다", () => {
      const odd = (generatedEnemyRecords() as any[])
        .filter((e) => e.stats.mind !== e.stats.attack)
        .map((e) => `${e.id}(mind ${e.stats.mind} ≠ attack ${e.stats.attack})`);
      expect(odd, `mind 규칙 위반: ${odd.join(", ")}`).toEqual([]);
    });

    it("데미지형 정체성 스킬이 같은 적의 평범한 무료 데미지 스킬을 이긴다 — 106마리 전원", () => {
      const losers: string[] = [];
      for (const enemy of db.enemies as any[]) {
        const identity = damageCores(enemy, true);
        const plain = damageCores(enemy, false);
        if (identity.length === 0 || plain.length === 0) continue;
        const bestPlain = plain.reduce((a, b) => (a.core >= b.core ? a : b));
        // 정체성 쪽은 **최선**으로 판정한다(B1). 보스처럼 같은 스킬을 always/turn 두 벌로
        // 든 경우 always 하나만 보면 오판한다 — 주기 발화를 맡는 건 버스트 쪽이다.
        const bestIdentity = identity.reduce((a, b) => (a.core >= b.core ? a : b));
        if (bestIdentity.core < bestPlain.core) {
          losers.push(`${enemy.id}(atk ${enemy.stats.attack}/mind ${enemy.stats.mind}): ${bestIdentity.id} ${bestIdentity.core} < ${bestPlain.id} ${bestPlain.core}`);
        }
      }
      expect(losers, `정체성기가 사장된다:\n${losers.join("\n")}`).toEqual([]);
    });

    // 위 검사는 **현재 로스터의 공격력 값**만 본다. 로스터가 넓어지거나 계열 배정이 바뀌면
    // 조용히 통과할 수 있으므로, 규칙 자체를 공격력 전 구간에서 검사한다.
    // 구간 상한 214 는 현재 로스터의 최댓값(enemy_demon_lord)이다.
    it("mind = attack 규칙이 공격력 9~214 전 구간에서 정체성 데미지 스킬을 살린다", () => {
      const archetypes = ["blob", "venom", "curse", "caster", "bulwark", "boss"] as const;
      const losers: string[] = [];
      for (const archetype of archetypes) {
        for (let attack = 9; attack <= 214; attack += 1) {
          const probe = { id: archetype, stats: { attack, mind: attack }, actions: archetypeActions(archetype, "skill_fire") };
          const identity = damageCores(probe, true);
          const plain = damageCores(probe, false);
          if (identity.length === 0 || plain.length === 0) continue;
          const bestPlain = plain.reduce((a, b) => (a.core >= b.core ? a : b));
          for (const entry of identity) {
            if (entry.core < bestPlain.core) losers.push(`${archetype}@atk${attack}: ${entry.id} < ${bestPlain.id}`);
          }
        }
      }
      expect(losers.slice(0, 5), `${losers.length}건 사장`).toEqual([]);
    });
  });
  // ── R20: 생성 보스 10마리의 속성 ────────────────────────────────────────────
  describe("보스 속성 배정 (R20)", () => {
    const generatedBossIds = BOSS_IDS.filter((id) => id !== "enemy_dragon");

    it("생성 보스 10마리가 전부 속성 공격을 쓴다 — 무속성 폴백이 남아 있지 않다", () => {
      const colorless: string[] = [];
      for (const id of generatedBossIds) {
        const enemy = (db.enemies as any[]).find((e) => e.id === id);
        expect(enemy, `${id} 없음`).toBeDefined();
        const elements = (enemy.actions as any[])
          .map((p) => skillById.get(p.skillId)?.elementId)
          .filter((entry): entry is string => typeof entry === "string");
        if (elements.length === 0) colorless.push(id);
      }
      expect(colorless, `무속성 폴백(skill_arcane_bolt)에 남은 보스: ${colorless.join(", ")}`).toEqual([]);
    });

    // 저항 시드 표에 없는 속성은 액터·직업의 elementRates 에 등급이 없어 배율 1.0 으로 조용히
    // 빠진다(actorModel.ts 의 dark 주석과 같은 실패). 예: skill_leaf 의 "grass".
    it("보스가 쓰는 속성이 전부 저항 시드 표에 있다 — 없으면 무속성과 수치가 같다", () => {
      const seeded = new Set(DEFAULT_ELEMENT_RATE_LABELS.map((entry) => entry.id));
      for (const skillId of Object.values(BOSS_ELEMENT_SKILLS)) {
        const element = skillById.get(skillId)?.elementId;
        expect(element, `${skillId} 에 elementId 가 없다`).toBeTypeOf("string");
        expect(seeded.has(element!), `${skillId} 의 속성 ${element} 가 시드 표에 없다`).toBe(true);
      }
    });

    it("BOSS_ELEMENT_SKILLS 가 생성 보스 10마리를 정확히 덮는다", () => {
      expect(Object.keys(BOSS_ELEMENT_SKILLS).slice().sort()).toEqual(generatedBossIds.slice().sort());
    });
  });
  // ── 개체 속성 매핑의 오타 안전장치 ──────────────────────────────────────────
  // 이 두 표는 유일한 **무성(無聲) 실패 경로**다. 키를 오타내면 `undefined` 가 나오고
  // archetypeActions 의 `?? "skill_arcane_bolt"` 가 삼켜서 무속성으로 조용히 떨어진다.
  // 컴파일 쪽은 `as const`(리터럴 키)로 막는다 — 표의 키를 오타내면 그 키를 점 접근하는
  // generatedEnemyRecords.ts 가 타입 오류가 된다. 여기서는 컴파일이 못 보는 두 가지를 막는다:
  //   (1) 표의 키와 소비하는 레코드의 id 가 어긋나는 짝짓기 사고(붉은 용에 청룡의 속성),
  //   (2) 표에는 있는데 아무도 안 읽는 죽은 항목.
  describe("속성 매핑 표의 오타 안전장치", () => {
    const source = readFileSync(new URL("../src/project/defaults/generatedEnemyRecords.ts", import.meta.url), "utf8");

    it("레코드가 참조하는 속성 표의 키가 그 레코드 자신의 id 와 같다", () => {
      const mismatches: string[] = [];
      let referenced = 0;
      for (const line of source.split("\n")) {
        const id = line.match(/normalizeEnemyRecord\(\{ \.\.\.\{"id":"([a-z_]+)"/)?.[1];
        if (!id) continue;
        for (const [, table, key] of line.matchAll(/(SPIRIT|BOSS)_ELEMENT_SKILLS\.([A-Za-z0-9_]+)/g)) {
          referenced += 1;
          if (key !== id) mismatches.push(`${id} 레코드가 ${table}_ELEMENT_SKILLS.${key} 를 읽는다`);
        }
      }
      expect(mismatches, mismatches.join("\n")).toEqual([]);
      expect(referenced, "소스에서 읽어낸 속성 표 참조 수").toBe(
        Object.keys(SPIRIT_ELEMENT_SKILLS).length + Object.keys(BOSS_ELEMENT_SKILLS).length,
      );
    });

    it("두 표의 모든 키가 소스에서 실제로 읽힌다 — 죽은 항목이 없다", () => {
      const read = new Set([...source.matchAll(/(?:SPIRIT|BOSS)_ELEMENT_SKILLS\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!));
      const dead = [...Object.keys(SPIRIT_ELEMENT_SKILLS), ...Object.keys(BOSS_ELEMENT_SKILLS)].filter((key) => !read.has(key));
      expect(dead, `아무도 읽지 않는 표 항목: ${dead.join(", ")}`).toEqual([]);
    });
  });
});

/**
 * 숲 나무 확장 띠(forest-trees:*) 물체를 place_props 로 놓으면 물체 모양 그대로 찍혀야 한다.
 *
 * 2026-09-27 「작은 숲속에 오두막 하나」 실측: 그룹의 sourceRect 는 픽셀 단위(숲 벽 160×96)인데 발자국
 * 계산이 칸 단위로 읽어 실패했고, 표본 빌더가 타일 앞 6개를 가로 한 줄로 늘어놓았다. 그래서 큰 참나무·활엽수는
 * 수관 조각 한 줄, 숲 벽은 밑동 한 줄이 되어 맵에 잎 없는 줄기만 남았다.
 */
describe("forestTreeObjectPlacement", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  /**
   * 숲 나무 확장 띠 그룹(forest-trees:*)을 지닌 혼합 칩셋(합본 마을+레트로 월드맵+숲 나무 띠).
   * 이 그룹을 들고 있던 숲마을(forest_harmony)·합본 마을 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다.
   * 옛 저장본이 들고 있는 정의를 되살려 조립기(composeCombinedTownRetroWorldTileset)로 같은 그룹을 다시 만든다.
   */
  function forestTreesTileset(): TilesetDef {
    return composeCombinedTownRetroWorldTileset(
      retiredEasyRpgTileset("easyrpg_chipset_combined_town"),
      retiredEasyRpgTileset("easyrpg_chipset_retro_world"),
    );
  }
  function project(width = 40, height = 20): { project: Project } {
    const ctx = { project: createBlankProject() };
    const tileset = forestTreesTileset();
    ctx.project.tilesets[tileset.id] = tileset;
    const start = ctx.project.maps[MAP_ID]!;
    start.tilesetId = tileset.id;
    start.lowerTiles.fill(TILE.GRASS);
    start.upperTiles.fill(TILE.EMPTY);
    expect(runTool(ctx, "resize_map", { mapId: MAP_ID, width, height }).ok).toBe(true);
    return ctx;
  }
  function forestTreesGroups(project: Project) {
    return Object.values(project.tilesets).find((tileset) => tileset.tileGroups?.some((group) => group.id.startsWith("forest-trees:")))!.tileGroups!;
  }
  function bounds(cells: readonly number[], width: number) {
    const xs = cells.map((index) => index % width), ys = cells.map((index) => Math.floor(index / width));
    return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  }
  describe("forest-trees 물체 place_props", () => {
    it.each([
      ["숲 나무 · 큰 참나무", "forest-trees:big-oak"],
      ["숲 나무 · 활엽수", "forest-trees:tree"],
    ])("%s 는 previewMap 모양대로 수관(상위)과 밑동(하위)을 함께 찍는다", (material, groupId) => {
      const ctx = project();
      const group = forestTreesGroups(ctx.project).find((g) => g.id === groupId)!;
      const preview = group.previewMap!;
      const canopy = new Set(preview.upperTiles.filter((tile) => tile >= 0));
      const trunk = new Set(preview.lowerTiles.filter((tile) => group.tileIds.includes(tile)));
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 20 }, material, count: 1, seed: 3 });
      expect(result.ok).toBe(true);
      const map = ctx.project.maps[MAP_ID]!;
      const upperCells = map.upperTiles.flatMap((tile, index) => (canopy.has(tile) ? [index] : []));
      const lowerCells = map.lowerTiles.flatMap((tile, index) => (trunk.has(tile) ? [index] : []));
      // 옛 버그: 수관 조각 6칸이 가로 1줄. 이제 수관 칸 수와 높이가 원본과 같다.
      expect(upperCells).toHaveLength(canopy.size);
      expect(lowerCells).toHaveLength(trunk.size);
      expect(bounds([...upperCells, ...lowerCells], map.width)).toEqual({ w: preview.width, h: preview.height });
    });

    // 「숲 벽·숲 기둥 낱개 거절 → density 안내」·「숲 벽 + density → 굽이숲 수관」 두 사례는 은퇴: 굽이숲 수관(forestGrove)은
    // 숲마을(forest_harmony) 칩셋 전용 경로로 2026-10-07 저작권 정리 때 칩셋과 함께 지웠다(wildRouteTool.ts 주석).
  });
});
