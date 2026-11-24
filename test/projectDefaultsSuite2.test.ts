import { describe, expect, it } from "vitest";
import { LAKE_AUTOTILE_TILE, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { AUTOTILE_DIR, autotileEditTriggersGroup, autotileNeighborMask, autotileVariantForCell, autotileVariantForMask, buildEdgeCornerVariantMap, shapeAutotileGroupAround, autotileLayerView } from "@/project/defaults/autotileEngine";
import { DEFAULT_AUTOTILE_GROUPS, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP, autotileGroupsForTileset, cloneDefaultAutotileGroups } from "@/project/defaults/autotileGroups";
import { DIRT_ROAD_TILE, SAND_TILE, TERRAIN_TAG, describeChipsetTile, dirtLikeTiles, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { createBlankProject, COMBINED_TOWN_TILESET_ID, TILE, ensureSwitchVariableSlots, createBlankMap, createStarterMap, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILE_SIZE, DEFAULT_EASYRPG_CHARSET_ID, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY, ensureBundledResourceProfiles, removeLegacyRmTileset } from "@/project/defaults";
import { type AutotileGroup, type GameMap, type Project, type TilesetDef, SCHEMA_VERSION } from "@/project/types";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { setLayerTileAt } from "@/project/mapLayers";
import { createBattleRuntime, type ActorCommand, type BattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { createBattleSequencer } from "@/player/battleSequencer";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import { ACTOR_MAGE_ID } from "@/project/defaults/defaultDatabaseRecordIds";
import { DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";
import { ensureBundledBattleAnimations, defaultDatabase } from "@/project/defaults/defaultDatabase";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { chipsetAnimationKey, TEX_TILESET, TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { animationFrameForTile, animationKeyForTile, animationStripForTile, CHIPSET_ANIMATION_FPS, WATERFALL_ANIMATION_FPS } from "@/project/defaults/chipsetAnimation";
import { defaultTilesets, retiredEasyRpgChipsetTileset } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses, applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";
import { searchResources } from "@/assets/resourceSearch";
import { CHIPSET_LABEL_CORRECTIONS, seedChipsetLabelCorrections } from "@/project/defaults/chipsetLabelCorrections";
import { deserialize, serialize } from "@/project/io";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { ATLAS_CARTOGRAPHY_ID } from "@/project/defaults/atlasCartography";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import { startSession } from "@/project/session";
import sampleProject from "./fixtures/projects/oprn-sample-v3.json";
import { createDungeonTerrainAutotileGroups, DUNGEON_TERRAIN_AUTOTILE_PREFIX } from "@/project/defaults/dungeonTerrainAutotiles";
import { readFileSync } from "node:fs";
import { archetypeActions, BOSS_ELEMENT_SKILLS, SPIRIT_ELEMENT_SKILLS } from "@/project/defaults/enemyActionArchetypes";
import { generatedEnemyRecords } from "@/project/defaults/generatedEnemyRecords";
import { DEFAULT_ELEMENT_RATE_LABELS } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { runTool } from "@/editor/tools/toolRunner";
import { composeCombinedTownRetroWorldTileset } from "@/project/defaults/combinedTownRetroWorld";
import { isolateTimers } from "./mergedTeardown";

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

// 번들 전투 애니메이션 수렴 계약.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 갓 만든 프로젝트에서 ▶테스트가
// 아무 반응도 없었다. 당시 openTestPlayModal 첫 줄의 fail-closed 게이트가
// fail-closed 인데, 참조 문제가 18건 잡혔기 때문이다. 전부
// "item item_gen_*: animationId does not exist."
//
// 원인: generatedBattleEffectBindings 가 스타터 아이템·스킬을 생성 이펙트 팩
// (anim_gen_*)에 묶었는데, 로드되는 마을 데모 픽스처의 battleAnimations 는 팩
// 도입 이전 스냅샷(12개)이라 anim_gen_* 레코드가 하나도 없다. 정의는 있고
// (defaultBattleAnimationRecords() 는 43개를 낸다) 프로젝트에만 안 실린 상태였다.
//
// 그래서 ensureBundledResourceProfiles 와 같은 수렴 함수를 둔다 — 이미 저장된
// 프로젝트도 로드 한 번으로 번들 애니메이션을 되찾는다.
describe("bundledBattleAnimations", () => {
  isolateTimers();
  /** 생성 이펙트 팩 도입 이전 스냅샷을 흉내낸다 — anim_gen_* 를 전부 걷어낸다. */
  function projectWithStaleAnimations(): Project {
    const project = createBlankProject();
    project.database.battleAnimations = project.database.battleAnimations.filter(
      (record) => !record.id.startsWith("anim_gen_")
    );
    return project;
  }
  describe("ensureBundledBattleAnimations", () => {
    it("팩 이전 스냅샷에 빠진 anim_gen_* 레코드를 되채운다", () => {
      const project = projectWithStaleAnimations();
      const before = project.database.battleAnimations.length;
      expect(project.database.battleAnimations.some((r) => r.id.startsWith("anim_gen_"))).toBe(false);

      expect(ensureBundledBattleAnimations(project)).toBe(true);

      const after = project.database.battleAnimations.length;
      expect(after).toBeGreaterThan(before);
      expect(after).toBe(defaultBattleAnimationRecords().length);
    });

    it("두 번째 호출은 아무것도 바꾸지 않는다(멱등)", () => {
      const project = projectWithStaleAnimations();
      expect(ensureBundledBattleAnimations(project)).toBe(true);
      expect(ensureBundledBattleAnimations(project)).toBe(false);
    });

    it("저자가 고친 같은 id 레코드는 덮어쓰지 않는다", () => {
      const project = projectWithStaleAnimations();
      const kept = project.database.battleAnimations[0];
      expect(kept).toBeDefined();
      kept!.name = "저자가 바꾼 이름";

      ensureBundledBattleAnimations(project);

      const still = project.database.battleAnimations.find((r) => r.id === kept!.id);
      expect(still?.name).toBe("저자가 바꾼 이름");
    });

    it("수렴 뒤에는 애니메이션 참조 문제가 남지 않는다 — 재생 게이트가 열린다", () => {
      const project = projectWithStaleAnimations();
      const blocked = collectProjectReferenceIssues(project).filter((issue) =>
        issue.includes("animationId does not exist")
      );
      expect(blocked.length).toBeGreaterThan(0);

      ensureBundledBattleAnimations(project);

      const remaining = collectProjectReferenceIssues(project).filter((issue) =>
        issue.includes("animationId does not exist")
      );
      expect(remaining).toEqual([]);
    });
  });
  describe("갓 만든 프로젝트", () => {
    it("애니메이션 참조 문제 없이 시작한다", () => {
      const issues = collectProjectReferenceIssues(createBlankProject()).filter((issue) =>
        issue.includes("animationId does not exist")
      );
      expect(issues).toEqual([]);
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
