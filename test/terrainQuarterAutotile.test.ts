import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { supportsChipsetQuarterComposition } from "@/editor/tilesetImage";
import { dungeonTerrainQuarterKits } from "@/project/defaults/dungeonTerrainQuarter";
import { chipsetQuarterComposition, isTerrainQuarterTile, terrainQuarterSources, type TerrainQuarter } from "@/project/defaults/terrainQuarterAutotile";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { createInteriorWallFrameAutotileGroup, ensureTilesetHarnesses, INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID } from "@/project/tilesetHarness";
import { runInteriorRoomPipeline } from "@/editor/interiorRoomPipeline";
import type { AutotileGroup, TilesetDef } from "@/project/types";
import { DARK_WALL_QUARTER_SOURCE, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { createWorldCoastAutotileGroup, hasWorldCoastMapping, isWorldAnimatedTile, seedWorldCoastMapping, WORLD_COAST_GROUP_ID, WORLD_SEA_TILES, WORLD_SNOW_SHORE_TILES, WORLD_WATER_TILES } from "@/project/defaults/worldCoastMapping";
import { createWorldTerrainAutotileGroups, seedWorldTerrainAutotiles, worldTerrainQuarterKit } from "@/project/defaults/worldTerrainAutotiles";
import { serialize, deserialize } from "@/project/io";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { isolateTimers } from "./mergedTeardown";

describe("dungeonTerrainQuarter", () => {
  isolateTimers();
  type MapView = { width: number; height: number; lowerTiles: number[] };
  function mapFromRows(rows: readonly (readonly number[])[]): MapView {
    return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
  }
  function quarterTile(sources: readonly { quarter: string; tile: number }[] | undefined, quarter: string): number | undefined {
    return sources?.find((entry) => entry.quarter === quarter)?.tile;
  }
  const dungeonTileset = () => withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
  describe("dungeon terrain quarter composition (RM2k3 8×8 미니타일)", () => {
    it("던전 타일셋이 프로덕션 쿼터 렌더 게이트를 통과한다", () => {
      expect(supportsChipsetQuarterComposition(dungeonTileset())).toBe(true);
      expect(dungeonTerrainQuarterKits(dungeonTileset())).toHaveLength(12);
      // 다른 칩셋에서는 던전 킷이 잡히면 안 된다 (combined-town 흙길과 id 충돌).
      expect(dungeonTerrainQuarterKits(withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_interior)).toBeNull();
    });

    it("심연 링 코너(저장 368): 대각 하나만 열림 → 해당 쿼터만 오목 소스, 나머지는 몸통", () => {
      // 링 안쪽 코너 — S/E는 변 타일, 대각(SE)만 바닥(187).
      const map = mapFromRows([
        [427, 427, 427],
        [427, 368, 457],
        [427, 428, 187],
      ]);
      const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
      expect(composition).not.toBeNull();
      expect(quarterTile(composition?.sources, "nw")).toBe(427); // 몸통 쿼터
      expect(quarterTile(composition?.sources, "ne")).toBe(427);
      expect(quarterTile(composition?.sources, "sw")).toBe(427);
      expect(quarterTile(composition?.sources, "se")).toBe(368); // 노치 1개만
    });

    it("용암 구멍 대각 셀(저장 245): 구멍 방향 쿼터만 오목, 나머지 몸통", () => {
      // 3×3 용암 가운데가 적암(244)으로 뚫린 상황의 NW 대각 셀.
      const map = mapFromRows([
        [304, 304, 304],
        [304, 245, 274],
        [304, 303, 244],
      ]);
      const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
      expect(quarterTile(composition?.sources, "se")).toBe(245);
      expect(quarterTile(composition?.sources, "nw")).toBe(304);
    });

    it("1칸 폭 심연 기둥: 좌우 쿼터가 서/동 변으로 갈라진다", () => {
      const F = 187;
      const map = mapFromRows([
        [F, 427, F],
        [F, 427, F],
        [F, 427, F],
      ]);
      const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
      expect(quarterTile(composition?.sources, "nw")).toBe(426); // 서변
      expect(quarterTile(composition?.sources, "ne")).toBe(428); // 동변
      expect(quarterTile(composition?.sources, "sw")).toBe(426);
      expect(quarterTile(composition?.sources, "se")).toBe(428);
    });

    it("connectsTo: 이끼 옆 흙 몸통은 합성 불필요(null) — 이끼를 연결로 본다", () => {
      const D = 421;
      const map = mapFromRows([
        [D, D, D],
        [D, D, 424],
        [D, D, D],
      ]);
      // 던전 킷이 우선 매칭돼 combined-town 흙길 킷(이끼=모래를 비연결로 봄)을 덮는다.
      expect(chipsetQuarterComposition(map, dungeonTileset(), 1, 1)).toBeNull();
    });

    it("이끼 쪽은 흙 옆에서 자기 테두리를 그린다(비연결) — 역방향 아님", () => {
      const M = 424;
      const map = mapFromRows([
        [421, 421, 421],
        [421, M, M],
        [421, M, M],
      ]);
      const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
      expect(composition).not.toBeNull();
      expect(quarterTile(composition?.sources, "nw")).toBe(393); // 이끼 NW 볼록 코너 쿼터
    });
  });
});

describe("interiorAutotile", () => {
  isolateTimers();
  // 이 하네스(어두운 벽 366·공허 430·크림 회벽 104~106)는 EasyRPG 실내·던전 칩셋의 것이다 — 2026-10-07 정리 뒤 새 프로젝트에는 없으니
  // 옛 저장본처럼 정의를 되살린다. 현재 실내 v5(atlas_biome_interior)는 이 번호 체계를 쓰지 않는다.
  const blankWithRetiredSheets = () => withRetiredEasyRpgTilesets(createBlankProject());
  function wallFrameGroup(tileset: TilesetDef | undefined): AutotileGroup | undefined {
    return tileset?.autotileGroups?.find((group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
  }
  describe("interior wall-frame autotile harness (Option B: no house wall-frame store group)", () => {
    it("does not seed house wall-frame autotile; seeds dark 366 only", () => {
      const project = blankWithRetiredSheets();
      const interior = project.tilesets.easyrpg_chipset_interior;
      expect(wallFrameGroup(interior)).toBeUndefined();
      const dark = interior.autotileGroups?.find((g) => g.id.includes("dark-wall"));
      expect(dark).toBeDefined();
      expect(dark?.memberTileIds).toEqual([366]);
      // user groups preserved
      const custom = { id: "user_custom_autotile", name: "user", memberTileIds: [1], variantMap: { "0": 1 } };
      interior.autotileGroups = [custom as any, ...(interior.autotileGroups ?? [])];
      ensureTilesetHarnesses(project);
      expect(wallFrameGroup(interior)).toBeUndefined();
      expect(interior.autotileGroups?.some((group) => group.id === "user_custom_autotile")).toBe(true);
    });

    it("does not seed interior-specific autotiles on dungeon tilesets (but does seed dungeon's own)", () => {
      const dungeon = blankWithRetiredSheets().tilesets.easyrpg_chipset_dungeon;
      // 실내 전용 그룹(벽 프레임)은 던전에 새지 않는다.
      expect(wallFrameGroup(dungeon)).toBeUndefined();
      const ids = autotileGroupsForTileset(dungeon).map((group) => group.id);
      expect(ids).not.toContain(INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
      expect(ids.every((id) => !id.startsWith("harness-interior-house-v1-"))).toBe(true);
      // 대신 던전 자체 지형 오토타일 13종은 시드된다(2026-07-13 추가).
      expect(ids.filter((id) => id.startsWith("harness-dungeon-v1-terrain-"))).toHaveLength(13);
    });

    it("keeps wall-frame group absent after ensureTilesetHarnesses", () => {
      const project = blankWithRetiredSheets();
      const interior = project.tilesets.easyrpg_chipset_interior;
      interior.autotileGroups = [];
      expect(wallFrameGroup(interior)).toBeUndefined();

      expect(ensureTilesetHarnesses(project)).toBe(true);
      expect(wallFrameGroup(interior)).toBeUndefined();
      expect(autotileGroupsForTileset(interior).length).toBeGreaterThanOrEqual(1);
    });

    // 회귀: 서벽(dark-mass 428) 자리에 크림 회벽을 놓으면 뒤쪽 공허가 벽 조각을 흘리면 안 된다.
    // 옛 버그: (1,6)에 크림 104/106 → 인접 공허 (0,5)(0,6)(0,7)(1,7)에 428/368 조각 누출("매우 많이 망가짐").
    // 크림 면은 dark-mass 렌더 대상은 아니지만 이웃 판정(isMass)에서는 벽으로 쳐야 누출이 없다.
    it("cream wall placed on a dark-mass wall cell does not bleed onto exterior void (오두막 (1,6) 회귀)", () => {
      const tileset = blankWithRetiredSheets().tilesets.easyrpg_chipset_interior;
      // 천장 오토타일(harness-interior-house-v1-ceiling)은 공허 테두리를 일부러 다시 그린다 — 이 회귀는 어두운 벽 덩이(428/368)
      // 누출만 보므로 천장 문법을 뺀다.
      tileset.autotileGroups = (tileset.autotileGroups ?? []).filter((group) => group.id !== "harness-interior-house-v1-ceiling");
      const { map } = runInteriorRoomPipeline({
        mapId: "map_rp_hut_v1", name: "연습 · 오두막 (10×9)",
        width: 10, height: 9, wings: [{ x: 2, y: 4, w: 5, h: 3 }],
        door: { x: 4, y: 6 }, theme: "storage", floorTile: 139, seed: 11,
      });
      const w = map.width;
      // 공허(430) 셀의 렌더 서명을 배치 전에 수집.
      const voidSig = (): Map<number, string> => {
        const sig = new Map<number, string>();
        for (let y = 0; y < map.height; y += 1) {
          for (let x = 0; x < w; x += 1) {
            if (map.lowerTiles[y * w + x] !== 430) continue;
            const c = chipsetQuarterComposition(map, tileset, x, y);
            sig.set(y * w + x, c ? c.sources.map((s) => `${s.quarter}@${s.tile}`).join(",") : "plain");
          }
        }
        return sig;
      };
      const before = voidSig();

      for (const cream of [104, 105, 106]) {
        const snapshot = [...map.lowerTiles];
        map.lowerTiles[6 * w + 1] = cream; // (1,6) 서벽 자리에 크림 회벽
        shapeAutotileGroupAround(map, createInteriorWallFrameAutotileGroup(), [{ x: 1, y: 6 }]);
        const after = voidSig();
        for (const [idx, sig] of after) {
          // 어떤 공허 셀도 배치 때문에 벽 조각(비-plain)을 새로 얻으면 안 된다.
          expect(`${idx}:${sig}`).toBe(`${idx}:${before.get(idx)}`);
        }
        map.lowerTiles.splice(0, map.lowerTiles.length, ...snapshot); // 원복 후 다음 타일 검사
      }
    });
  });
});

describe("interiorWallFrameQuarterComposition", () => {
  isolateTimers();
  // 어두운 벽(366) 4분할 합성은 EasyRPG 실내 칩셋 전용이다 — 2026-10-07 정리 뒤 새 프로젝트에는 없으니 옛 저장본의 정의를 되살린다.
  const retiredInterior = () => retiredEasyRpgTileset("easyrpg_chipset_interior");
  /**
   * 로드 정규화는 이 시트에 천장 오토타일(harness-interior-house-v1-ceiling, interiorCeilingAutotile.ts)도 심는다. 그 문법은 공허·천장 칸을
   * 일부러 4분할로 그린다 — 아래 「통 타일은 4분할하지 않는다」 사례는 어두운 벽·벽틀 경로만 보므로 천장 문법을 뺀 시트로 잰다.
   */
  const retiredInteriorWithoutCeiling = () => {
    const tileset = retiredInterior();
    tileset.autotileGroups = (tileset.autotileGroups ?? []).filter((group) => group.id !== "harness-interior-house-v1-ceiling");
    return tileset;
  };
  type MapView = {
    readonly width: number;
    readonly height: number;
    readonly lowerTiles: number[];
  };
  type InteriorCornerFixture = {
    readonly center: number;
    readonly east?: number;
    readonly north?: number;
    readonly south?: number;
    readonly west?: number;
    readonly northEast?: number;
    readonly northWest?: number;
    readonly southEast?: number;
    readonly southWest?: number;
  };
  function mapWithInteriorCorner(fixture: InteriorCornerFixture): MapView {
    return {
      width: 3,
      height: 3,
      lowerTiles: [
        fixture.northWest ?? 72, fixture.north ?? 72, fixture.northEast ?? 72,
        fixture.west ?? 72, fixture.center, fixture.east ?? 72,
        fixture.southWest ?? 72, fixture.south ?? 72, fixture.southEast ?? 72,
      ],
    };
  }
  const B = DARK_WALL_TILE.BODY;
  const Q = DARK_WALL_QUARTER_SOURCE;
  const F = 72;
  describe("interior dark-wall quarter composition (Option B: store 366 only)", () => {
    it("allows the Interior tileset through production quarter-render gates", () => {
      const tileset = retiredInterior();
      expect(supportsChipsetQuarterComposition(tileset)).toBe(true);
    });

    it("isolated 366 → four convex corner quarters", () => {
      const tileset = retiredInterior();
      const composition = chipsetQuarterComposition(
        mapWithInteriorCorner({ center: B }),
        tileset,
        1,
        1,
      );
      expect(composition).toEqual({
        underlayTile: Q.center,
        sources: [
          { quarter: "nw", tile: Q.cornerNW, offsetX: 0, offsetY: 0 },
          { quarter: "ne", tile: Q.cornerNE, offsetX: 8, offsetY: 0 },
          { quarter: "sw", tile: Q.cornerSW, offsetX: 0, offsetY: 8 },
          { quarter: "se", tile: Q.cornerSE, offsetX: 8, offsetY: 8 },
        ],
      });
    });

    it("1-row band of 366 → N/S edge quarters", () => {
      const tileset = retiredInterior();
      const composition = chipsetQuarterComposition(
        mapWithInteriorCorner({ center: B, west: B, east: B }),
        tileset,
        1,
        1,
      );
      expect(composition).toEqual({
        underlayTile: Q.center,
        sources: [
          { quarter: "nw", tile: Q.edgeN, offsetX: 0, offsetY: 0 },
          { quarter: "ne", tile: Q.edgeN, offsetX: 8, offsetY: 0 },
          { quarter: "sw", tile: Q.edgeS, offsetX: 0, offsetY: 8 },
          { quarter: "se", tile: Q.edgeS, offsetX: 8, offsetY: 8 },
        ],
      });
    });

    it("1-col band of 366 → W/E edge quarters", () => {
      const tileset = retiredInterior();
      const composition = chipsetQuarterComposition(
        mapWithInteriorCorner({ center: B, north: B, south: B }),
        tileset,
        1,
        1,
      );
      expect(composition).toEqual({
        underlayTile: Q.center,
        sources: [
          { quarter: "nw", tile: Q.edgeW, offsetX: 0, offsetY: 0 },
          { quarter: "ne", tile: Q.edgeE, offsetX: 8, offsetY: 0 },
          { quarter: "sw", tile: Q.edgeW, offsetX: 0, offsetY: 8 },
          { quarter: "se", tile: Q.edgeE, offsetX: 8, offsetY: 8 },
        ],
      });
    });

    it("cross junction of 366 (diagonals open) → concave 368 ×4", () => {
      const tileset = retiredInterior();
      const composition = chipsetQuarterComposition(
        mapWithInteriorCorner({
          center: B,
          north: B,
          south: B,
          west: B,
          east: B,
          northWest: F,
          northEast: F,
          southWest: F,
          southEast: F,
        }),
        tileset,
        1,
        1,
      );
      expect(composition).toEqual({
        underlayTile: Q.center,
        sources: [
          { quarter: "nw", tile: Q.concave, offsetX: 0, offsetY: 0 },
          { quarter: "ne", tile: Q.concave, offsetX: 8, offsetY: 0 },
          { quarter: "sw", tile: Q.concave, offsetX: 0, offsetY: 8 },
          { quarter: "se", tile: Q.concave, offsetX: 8, offsetY: 8 },
        ],
      });
    });

    it("solid 3×3 of 366 → center body quarters", () => {
      const tileset = retiredInterior();
      const composition = chipsetQuarterComposition(
        {
          width: 3,
          height: 3,
          lowerTiles: [B, B, B, B, B, B, B, B, B],
        },
        tileset,
        1,
        1,
      );
      expect(composition).toEqual({
        underlayTile: Q.center,
        sources: [
          { quarter: "nw", tile: Q.center, offsetX: 0, offsetY: 0 },
          { quarter: "ne", tile: Q.center, offsetX: 8, offsetY: 0 },
          { quarter: "sw", tile: Q.center, offsetX: 0, offsetY: 8 },
          { quarter: "se", tile: Q.center, offsetX: 8, offsetY: 8 },
        ],
      });
    });

    it("house whole tiles (428/397/105/430/233/257) are never quarter-composed", () => {
      const tileset = retiredInteriorWithoutCeiling();
      for (const center of [428, 397, 105, 430, 233, 257, 258, 456, 457, 458, 396, 398, 426]) {
        expect(
          chipsetQuarterComposition(
            mapWithInteriorCorner({ center, north: center, south: center, west: F, east: F }),
            tileset,
            1,
            1,
          ),
        ).toBeNull();
      }
    });

    it("does not invent quarters on deep void", () => {
      const tileset = retiredInteriorWithoutCeiling();
      expect(
        chipsetQuarterComposition(
          mapWithInteriorCorner({ center: 430, west: 426, south: 457, southWest: 456 }),
          tileset,
          1,
          1,
        ),
      ).toBeNull();
    });
  });
});

describe("terrainQuarterAutotile", () => {
  isolateTimers();
  type MapView = { width: number; height: number; lowerTiles: number[] };
  function mapFromRows(rows: readonly (readonly number[])[]): MapView {
    return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
  }
  function quarterTile(sources: readonly { quarter: string; tile: number }[] | null, quarter: string): number | undefined {
    return sources?.find((entry) => entry.quarter === quarter)?.tile;
  }
  function expectQuarterTiles(
    sources: readonly { quarter: TerrainQuarter; tile: number }[] | null,
    expected: Record<TerrainQuarter, number>
  ): void {
    expect(sources).not.toBeNull();
    for (const quarter of ["nw", "ne", "sw", "se"] as const) {
      expect(quarterTile(sources, quarter), quarter).toBe(expected[quarter]);
    }
  }
  describe("terrain quarter rendering (모래/흙길 8x8 합성)", () => {
    it("9-슬라이스와 오목 코너, 흙길 BODY_ALT만 쿼터 대상으로 판정한다", () => {
      expect(isTerrainQuarterTile(SAND_TILE.BODY)).toBe(true);
      expect(isTerrainQuarterTile(SAND_TILE.EDGE_NORTH)).toBe(true);
      expect(isTerrainQuarterTile(SAND_TILE.CORNER_SOUTH_EAST)).toBe(true);
      expect(isTerrainQuarterTile(SAND_TILE.INNER_CORNER)).toBe(true);
      expect(isTerrainQuarterTile(DIRT_ROAD_TILE.INNER_CORNER)).toBe(true);
      expect(isTerrainQuarterTile(DIRT_ROAD_TILE.BODY_ALT)).toBe(true);
      expect(isTerrainQuarterTile(SAND_TILE.ISOLATED)).toBe(false);
      expect(isTerrainQuarterTile(364)).toBe(false);
      expect(isTerrainQuarterTile(TILE.GRASS)).toBe(false);
    });

    it("가로 3x1 길 가운데 칸은 위쪽 북변, 아래쪽 남변 쿼터를 합성한다", () => {
      const S = SAND_TILE.BODY, G = TILE.GRASS;
      const map = mapFromRows([
        [G, G, G],
        [S, SAND_TILE.EDGE_NORTH, S],
        [G, G, G],
      ]);
      const sources = terrainQuarterSources(map, 1, 1);
      expectQuarterTiles(sources, {
        nw: SAND_TILE.EDGE_NORTH,
        ne: SAND_TILE.EDGE_NORTH,
        sw: SAND_TILE.EDGE_SOUTH,
        se: SAND_TILE.EDGE_SOUTH,
      });
    });

    it("세로 1x3 길 가운데 칸은 왼쪽 서변, 오른쪽 동변 쿼터를 합성한다", () => {
      const R = DIRT_ROAD_TILE.BODY, G = TILE.GRASS;
      const map = mapFromRows([
        [G, R, G],
        [G, DIRT_ROAD_TILE.EDGE_WEST, G],
        [G, R, G],
      ]);
      const sources = terrainQuarterSources(map, 1, 1);
      expectQuarterTiles(sources, {
        nw: DIRT_ROAD_TILE.EDGE_WEST,
        ne: DIRT_ROAD_TILE.EDGE_EAST,
        sw: DIRT_ROAD_TILE.EDGE_WEST,
        se: DIRT_ROAD_TILE.EDGE_EAST,
      });
    });

    it("가로 3x1 서쪽 끝 칸은 서쪽 볼록 모서리와 동쪽 변 쿼터를 합성한다", () => {
      const S = SAND_TILE.BODY, G = TILE.GRASS;
      const map = mapFromRows([
        [G, G, G],
        [SAND_TILE.CORNER_NORTH_WEST, S, S],
        [G, G, G],
      ]);
      const sources = terrainQuarterSources(map, 0, 1);
      expectQuarterTiles(sources, {
        nw: SAND_TILE.CORNER_NORTH_WEST,
        ne: SAND_TILE.EDGE_NORTH,
        sw: SAND_TILE.CORNER_SOUTH_WEST,
        se: SAND_TILE.EDGE_SOUTH,
      });
    });

    it("잔디 대각 귀퉁이만 오목 쿼터, 나머지는 몸통 쿼터", () => {
      // 십자 교차로의 좌상 오목 칸: NW 대각만 잔디, 나머지 대각·4방은 모래.
      const S = SAND_TILE.BODY;
      const map = mapFromRows([
        [TILE.GRASS, S, S],
        [S, SAND_TILE.INNER_CORNER, S],
        [S, S, S],
      ]);
      const sources = terrainQuarterSources(map, 1, 1);
      expectQuarterTiles(sources, {
        nw: SAND_TILE.INNER_CORNER,
        ne: SAND_TILE.BODY,
        sw: SAND_TILE.BODY,
        se: SAND_TILE.BODY,
      });
      // 쿼터 오프셋 기하: nw(0,0)/ne(8,0)/sw(0,8)/se(8,8).
      expect(sources?.map((entry) => [entry.quarter, entry.offsetX, entry.offsetY])).toEqual([
        ["nw", 0, 0],
        ["ne", 8, 0],
        ["sw", 0, 8],
        ["se", 8, 8],
      ]);
    });

    it("십자 중심에서 대각 4곳 전부 잔디면 네 쿼터 모두 오목이다", () => {
      const S = SAND_TILE.BODY, G = TILE.GRASS;
      const map = mapFromRows([
        [G, S, G],
        [S, SAND_TILE.BODY, S],
        [G, S, G],
      ]);
      expectQuarterTiles(terrainQuarterSources(map, 1, 1), {
        nw: SAND_TILE.INNER_CORNER,
        ne: SAND_TILE.INNER_CORNER,
        sw: SAND_TILE.INNER_CORNER,
        se: SAND_TILE.INNER_CORNER,
      });
    });

    it("대각까지 전부 연결된 몸통 칸은 null로 통짜 렌더에 맡긴다", () => {
      const S = SAND_TILE.BODY;
      const map = mapFromRows([
        [S, S, S],
        [S, S, S],
        [S, S, S],
      ]);
      expect(terrainQuarterSources(map, 1, 1)).toBeNull();
    });

    it("모래는 물 대각을 연결로 취급한다(해변 접합) — 흙길은 아니다", () => {
      const S = SAND_TILE.BODY;
      const sandMap = mapFromRows([
        [TILE.WATER, S, S],
        [S, SAND_TILE.INNER_CORNER, S],
        [S, S, S],
      ]);
      expect(quarterTile(terrainQuarterSources(sandMap, 1, 1), "nw")).toBe(SAND_TILE.BODY);
      const R = DIRT_ROAD_TILE.BODY;
      const roadMap = mapFromRows([
        [TILE.WATER, R, R],
        [R, DIRT_ROAD_TILE.INNER_CORNER, R],
        [R, R, R],
      ]);
      expect(quarterTile(terrainQuarterSources(roadMap, 1, 1), "nw")).toBe(DIRT_ROAD_TILE.INNER_CORNER);
    });

    it("ISOLATED 363 저장 칸은 null로 통짜 렌더를 유지한다", () => {
      const map = mapFromRows([[SAND_TILE.ISOLATED]]);
      expect(terrainQuarterSources(map, 0, 0)).toBeNull();
    });

    it("흙길 ISOLATED 360 단독 저장 칸은 null로 통짜 렌더를 유지한다", () => {
      const map = mapFromRows([[DIRT_ROAD_TILE.ISOLATED]]);
      expect(terrainQuarterSources(map, 0, 0)).toBeNull();
    });

    it("흙길 BODY_ALT 저장 칸도 쿼터 합성 대상이다", () => {
      const R = DIRT_ROAD_TILE.BODY, G = TILE.GRASS;
      const map = mapFromRows([
        [G, G, G],
        [R, DIRT_ROAD_TILE.BODY_ALT, R],
        [G, G, G],
      ]);
      expectQuarterTiles(terrainQuarterSources(map, 1, 1), {
        nw: DIRT_ROAD_TILE.EDGE_NORTH,
        ne: DIRT_ROAD_TILE.EDGE_NORTH,
        sw: DIRT_ROAD_TILE.EDGE_SOUTH,
        se: DIRT_ROAD_TILE.EDGE_SOUTH,
      });
    });

    it("쿼터 대상이 아니거나 맵 밖이면 null", () => {
      const map = mapFromRows([[TILE.GRASS]]);
      expect(terrainQuarterSources(map, 0, 0)).toBeNull();
      expect(terrainQuarterSources(map, 5, 5)).toBeNull();
    });
  });
});

describe("worldCoastMapping", () => {
  isolateTimers();
  const tileset = () => retiredEasyRpgTileset("easyrpg_chipset_world");
  const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });
  describe("World coast mapping", () => {
    it("seeds existing projects idempotently, keeping terrain and runtime passage aligned", () => {
      const ts = tileset();
      ts.autotileGroups = []; ts.tileGroups = [];
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
      expect(ts.autotileGroups?.map(g => g.id)).toEqual([WORLD_COAST_GROUP_ID, ...createWorldTerrainAutotileGroups().map(g => g.id)]);
      expect(WORLD_WATER_TILES).toHaveLength(36);
      for (const tile of WORLD_WATER_TILES) {
        expect(ts.priority[tile]).toBe("lower");
        expect(Object.values(ts.passability[tile]!)).toEqual([false, false, false, false]);
      }
      expect(Object.values(ts.passability[240]!)).toEqual([true, true, true, true]);
    });

    it("preserves authored groups, locked metadata, and other tilesets", () => {
      const ts = tileset();
      ts.autotileGroups = [{ ...createWorldCoastAutotileGroup(), id: "my-sea", name: "내 바다" }];
      const original = JSON.stringify(ts.autotileGroups);
      seedWorldCoastMapping(ts);
      expect(JSON.stringify(ts.autotileGroups)).toBe(original);
      expect(isLakeAutotileTile(120, ts)).toBe(false);
      ts.tileMeta![120] = { label: "내 타일", source: "user", userLocked: true, defaultLayer: "upper", passage: "passable" };
      ts.priority[120] = "upper";
      applyEasyRpgThemeMetadataPacks(ts);
      expect(ts.tileMeta![120]!.label).toBe("내 타일");
      expect(ts.priority[120]).toBe("upper");
      const retro = retiredEasyRpgTileset("easyrpg_chipset_retro_world");
      const before = JSON.stringify(retro);
      expect(seedWorldCoastMapping(retro)).toBe(false);
      expect(JSON.stringify(retro)).toBe(before);
    });

    it("includes snow shores but excludes waterfalls, plain variants, and source props", () => {
      const ts = tileset();
      for (const tile of [123, 125, 240, 301, 322]) {
        expect(isLakeAutotileTile(tile, ts)).toBe(false);
        expect(chipsetQuarterComposition(map([[tile]]), ts, 0, 0)).toBeNull();
      }
      for (const tile of WORLD_SNOW_SHORE_TILES) expect(isLakeAutotileTile(tile, ts)).toBe(true);
      expect(chipsetQuarterComposition(map([[421]]), ts, 0, 0)).not.toBeNull();
      expect(isLakeAutotileTile(3)).toBe(true); // Existing village canal remains supported.
    });

    it("migrates the exact old 24-slot group and its bundled metadata without replacing authored snow", () => {
      const ts = tileset();
      const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds: [...WORLD_SEA_TILES], connectTileIds: [...WORLD_SEA_TILES] };
      ts.autotileGroups = [legacy];
      const coastMetadata = ts.tileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!;
      coastMetadata.tileIds = [...WORLD_SEA_TILES];
      expect(seedWorldCoastMapping(ts)).toBe(true);
      expect(hasWorldCoastMapping(ts)).toBe(true);
      expect(ts.tileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!.tileIds).toEqual(WORLD_WATER_TILES);
      expect(seedWorldCoastMapping(ts)).toBe(false);

      const snow = { ...createWorldCoastAutotileGroup(), id: "my-snow", memberTileIds: [...WORLD_SNOW_SHORE_TILES], connectTileIds: [...WORLD_SNOW_SHORE_TILES] };
      ts.autotileGroups = [legacy, snow];
      const before = structuredClone(ts.autotileGroups);
      expect(seedWorldCoastMapping(ts)).toBe(false);
      expect(ts.autotileGroups).toEqual(before);
    });

    it("opts out immediately after in-place grammar edits and does not silently restore them", () => {
      const ts = tileset();
      const group = ts.autotileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!;
      expect(isLakeAutotileTile(120, ts)).toBe(true);
      group.variantMap["255"] = 3;
      expect(isLakeAutotileTile(120, ts)).toBe(false);
      expect(seedWorldCoastMapping(ts)).toBe(false);
      expect(group.variantMap["255"]).toBe(3);
    });

    it("retains v1 grass coast rendering and connection scope beside authored snow", () => {
      const ts = tileset();
      const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
      const snow = { ...createWorldCoastAutotileGroup(), id:"my-snow", memberTileIds:[...WORLD_SNOW_SHORE_TILES], connectTileIds:[...WORLD_SNOW_SHORE_TILES] };
      ts.autotileGroups = [legacy,snow];
      ts.tileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)!.tileIds = [...WORLD_SEA_TILES];
      const before = structuredClone(ts.autotileGroups);
      expect(seedWorldCoastMapping(ts)).toBe(false);
      expect(ts.autotileGroups).toEqual(before);
      expect(hasWorldCoastMapping(ts)).toBe(true);
      expect(isLakeAutotileTile(120,ts)).toBe(true);
      expect(isLakeAutotileTile(3,ts)).toBe(false);
      expect(chipsetQuarterComposition(map([[3]]),ts,0,0)).toBeNull();
      // The user's snow tiles are not members or connections of the grass coast.
      const strip = map([[3,120,3],[3,120,3],[3,120,3]]);
      expect(lakeAutotileQuarterSources(strip,1,1,ts).map(p=>p.tile)).toEqual([30,30,30,30]);
      const snowyLand = map([[190,120,190],[120,120,120],[190,120,190]]);
      expect(lakeAutotileQuarterSources(snowyLand,1,1,ts).map(p=>p.tile)).toEqual([90,90,90,90]);
      expect(ts.tileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)!.tileIds).toEqual(WORLD_SEA_TILES);
      const project = withRetiredEasyRpgTilesets(createBlankProject()); project.tilesets[ts.id] = ts;
      const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
      expect(loaded.autotileGroups!.find(g=>g.id==="my-snow")).toEqual(snow);
      expect(isLakeAutotileTile(120,loaded)).toBe(true);
      expect(isLakeAutotileTile(3,loaded)).toBe(false);
    });

    it("expands only v1 slot sets while preserving authored name and trigger scope", () => {
      const ts = tileset();
      const legacy = { ...createWorldCoastAutotileGroup(), name:"내 초원바다", triggerTileIds:[120],
        memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
      ts.autotileGroups = [legacy];
      expect(seedWorldCoastMapping(ts)).toBe(true);
      const migrated = ts.autotileGroups[0]!;
      expect(migrated).toEqual({...legacy,memberTileIds:WORLD_WATER_TILES,connectTileIds:WORLD_WATER_TILES});
      expect(seedWorldCoastMapping(ts)).toBe(false);
      const project = withRetiredEasyRpgTilesets(createBlankProject()); project.tilesets[ts.id] = ts;
      const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
      expect(loaded.autotileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)).toEqual(migrated);
    });

    it("opts out of fixed coast art when a source or animation frame is grafted", () => {
      const ts = tileset();
      const original = structuredClone(ts.autotileGroups);
      for (const targetTile of [120,0,31,35]) {
        ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        expect(hasWorldCoastMapping(ts)).toBe(false);
        expect(isLakeAutotileTile(120,ts)).toBe(false);
        expect(chipsetQuarterComposition(map([[120]]),ts,0,0)).toBeNull();
        expect(seedWorldCoastMapping(ts)).toBe(false);
        expect(ts.autotileGroups).toEqual(original);
      }
      ts.tileGrafts = [{targetTile:262,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:292}];
      expect(hasWorldCoastMapping(ts)).toBe(true);
      delete ts.tileGrafts;
      expect(hasWorldCoastMapping(ts)).toBe(true);
    });

    it("does not seed or expand a coast group over grafted source slots", () => {
      const ts = tileset();
      ts.autotileGroups = [];
      ts.tileGrafts = [{targetTile:120,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      expect(seedWorldCoastMapping(ts)).toBe(false);
      expect(ts.autotileGroups).toEqual([]);
      const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
      ts.autotileGroups = [legacy];
      ts.tileGrafts[0]!.targetTile = 3;
      expect(seedWorldCoastMapping(ts)).toBe(false);
      expect(ts.autotileGroups).toEqual([legacy]);
      expect(isLakeAutotileTile(120,ts)).toBe(true);
      expect(isLakeAutotileTile(3,ts)).toBe(false);
      expect(lakeAutotileQuarterSources(map([[190,120,190],[120,120,120],[190,120,190]]),1,1,ts).map(p=>p.tile)).toEqual([90,90,90,90]);
      delete ts.tileGrafts;
      expect(seedWorldCoastMapping(ts)).toBe(true);
      expect(ts.autotileGroups[0]!.memberTileIds).toEqual(WORLD_WATER_TILES);
    });

    it("stops only the affected three-frame water strip when any frame is grafted", () => {
      const ts = tileset();
      for (const targetTile of [120,121,122]) {
        ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        for (const tile of [120,121,122]) expect(isWorldAnimatedTile(tile,ts)).toBe(false);
        for (const tile of [0,1,2,150,151,152,123,153,183,213]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
      }
      delete ts.tileGrafts;
      for (const tile of [120,121,122]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
      expect(isWorldAnimatedTile(120)).toBe(true);
      expect(isWorldAnimatedTile(262,ts)).toBe(false);
    });

    it("stops only the affected vertical four-frame effect when any frame is grafted", () => {
      const ts = tileset();
      for (const frames of [[123,153,183,213],[124,154,184,214],[125,155,185,215]]) {
        for (const targetTile of frames) {
          ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
          for (const tile of frames) expect(isWorldAnimatedTile(tile,ts)).toBe(false);
          const unrelated = [120,121,122,123,124,125,153,154,155,183,184,185,213,214,215].filter(t=>!frames.includes(t));
          for (const tile of unrelated) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
        }
      }
      ts.tileGrafts = [{targetTile:262,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:292}];
      for (const tile of [123,153,183,213]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
    });

    it("uses all four independent quarters for every 8-neighbor topology", () => {
      const ts = tileset();
      const offsets = [[1,0,1],[2,1,2],[1,2,4],[0,1,8],[2,0,16],[2,2,32],[0,2,64],[0,0,128]];
      const expectedDirections = [[1,8,128],[1,2,16],[4,8,64],[4,2,32]];
      for (let mask = 0; mask < 256; mask++) {
        const m = map([[240,240,240],[240,120,240],[240,240,240]]);
        for (const [x,y,bit] of offsets) if (mask & bit!) m.lowerTiles[y! * 3 + x!] = 120;
        const parts = lakeAutotileQuarterSources(m, 1, 1, ts);
        for (let q = 0; q < 4; q++) {
          const [v,h,d] = expectedDirections[q]!;
          const expected = !(mask & v!) && !(mask & h!) ? 0 : !(mask & v!) ? 60 : !(mask & h!) ? 30 : !(mask & d!) ? 90 : 120;
          expect(parts[q]!.tile, `mask=${mask}, quarter=${q}`).toBe(expected);
        }
      }
    });

    it("keeps open sea at the canvas edge and reshapes after land is erased", () => {
      const ts = tileset();
      expect(lakeAutotileQuarterSources(map([[120]]),0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
      const m = map([[120,120,120],[120,240,120],[120,120,120]]);
      const before = lakeAutotileQuarterSources(m,0,0,ts);
      expect(before.find(p=>p.quarter === "se")!.tile).toBe(90);
      m.lowerTiles[4] = 120;
      shapeAutotileGroupAround(m, createWorldCoastAutotileGroup(), [{x:1,y:1}]);
      expect(lakeAutotileQuarterSources(m,0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
      const strip = map([[240,240,240],[120,120,120],[240,240,240]]);
      expect(lakeAutotileQuarterSources(strip,1,1,ts).map(p=>p.tile)).toEqual([60,60,60,60]);
    });
  });
});

describe("worldTerrainAutotiles", () => {
  isolateTimers();
  // Independently transcribed from the 30-column World.png atlas; do not derive
  // expected art roles from WORLD_TERRAIN_BLOCKS or the implementation's kits.
  const ART = [
    { key: "dirt", anchor: 6, solid: false, isolatedArt: false },
    { key: "sand", anchor: 9, solid: false, isolatedArt: false },
    { key: "marsh", anchor: 126, solid: true, isolatedArt: false },
    { key: "snow", anchor: 129, solid: false, isolatedArt: false },
    { key: "tall-grass", anchor: 243, solid: false, isolatedArt: false },
    { key: "snow-forest", anchor: 246, solid: true, isolatedArt: true },
    { key: "snow-mountain", anchor: 249, solid: true, isolatedArt: true },
    { key: "forest", anchor: 360, solid: true, isolatedArt: true },
    { key: "mountain", anchor: 363, solid: true, isolatedArt: true },
    { key: "metal-pit", anchor: 366, solid: true, isolatedArt: false },
    { key: "rock-pit", anchor: 369, solid: true, isolatedArt: false },
  ] as const;
  const PREFIX = "harness-world-v2-terrain-";
  const tileset = () => retiredEasyRpgTileset("easyrpg_chipset_world");
  const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });
  const neighborBits = [[1,0,1],[2,1,2],[1,2,4],[0,1,8],[2,0,16],[2,2,32],[0,2,64],[0,0,128]] as const;
  // Each tuple: two perpendicular neighbor bits, diagonal bit, exposed corner,
  // horizontal boundary, vertical boundary, destination quarter and pixel offset.
  const quarterRoles = [
    [1,8,128,30,31,60,"nw",0,0], [1,2,16,32,31,62,"ne",8,0],
    [4,8,64,90,91,60,"sw",0,8], [4,2,32,92,91,62,"se",8,8],
  ] as const;
  describe("World terrain autotiles", () => {
    it.each(ART)("composes $key correctly for all 256 independent neighbor topologies", ({ key, anchor, isolatedArt }) => {
      const ts = tileset();
      const group = ts.autotileGroups!.find(g=>g.id===PREFIX+key)!;
      for (let mask = 0; mask < 256; mask++) {
        const m = map([[240,240,240],[240,anchor+61,240],[240,240,240]]);
        for (const [x,y,bit] of neighborBits) if (mask & bit) m.lowerTiles[y*3+x] = anchor+61;
        const composition = chipsetQuarterComposition(m,ts,1,1);
        const expected = quarterRoles.map(([vertical,horizontal,diagonal,corner,hEdge,vEdge,quarter,offsetX,offsetY]) => {
          const joined = Number(Boolean(mask & vertical)) + Number(Boolean(mask & horizontal));
          const offset = joined === 0 ? corner : joined === 2 ? (mask & diagonal ? 61 : 2) : mask & horizontal ? hEdge : vEdge;
          return { quarter, tile: anchor+offset, offsetX, offsetY };
        });
        // A null composition is a deliberate whole-tile optimization, so compare
        // the effective four source quarters, including that renderer fallback.
        const effective = composition?.sources ?? quarterRoles.map((r) => ({ quarter: r[6], tile: anchor+61, offsetX: r[7], offsetY: r[8] }));
        expect(effective, `anchor=${anchor}, mask=${mask}`).toEqual(expected);
        // Verify the persisted variant IDs produced by painting still render the
        // same boundary after neighboring cells have also been reshaped.
        shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
        const shaped = chipsetQuarterComposition(m,ts,1,1);
        if (isolatedArt && (mask & 15) === 0) {
          expect(m.lowerTiles[4]).toBe(anchor);
          expect(shaped).toBeNull();
        } else {
          const shapedEffective = shaped?.sources ?? quarterRoles.map(r=>({quarter:r[6],tile:m.lowerTiles[4],offsetX:r[7],offsetY:r[8]}));
          expect(shapedEffective, `shaped anchor=${anchor}, mask=${mask}`).toEqual(expected);
        }
      }
    });

    it.each(ART)("distinguishes $key isolated artwork from flat ground", ({ anchor, isolatedArt }) => {
      const m = map([[240,240,240],[240,anchor,240],[240,240,240]]);
      const composition = chipsetQuarterComposition(m,tileset(),1,1);
      if (isolatedArt) expect(composition).toBeNull();
      else expect(composition?.sources.map(p=>p.tile)).toEqual([anchor+30,anchor+32,anchor+90,anchor+92]);
    });

    it("shapes newly painted terrain, repairs diagonal erasure, and restores the painted corner", () => {
      const ts = tileset();
      const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
      const m = map([[240,240,240,240,240],[240,421,421,421,240],[240,421,421,421,240],[240,421,421,421,240],[240,240,240,240,240]]);
      const points = m.lowerTiles.map((_,i)=>({x:i%5,y:Math.floor(i/5)}));
      shapeAutotileGroupAround(m,group,points);
      expect([m.lowerTiles[6],m.lowerTiles[7],m.lowerTiles[8],m.lowerTiles[11],m.lowerTiles[12],m.lowerTiles[13],m.lowerTiles[16],m.lowerTiles[17],m.lowerTiles[18]])
        .toEqual([390,391,392,420,421,422,450,451,452]);
      m.lowerTiles[6] = 240;
      shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
      expect(m.lowerTiles[12]).toBe(362);
      expect(chipsetQuarterComposition(m,ts,2,2)?.sources.map(p=>p.tile)).toEqual([362,421,421,421]);
      m.lowerTiles[6] = 421;
      shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
      expect(m.lowerTiles[12]).toBe(421);
      expect(m.lowerTiles[6]).toBe(390);
      const strip = map([[240,240,240,240,240],[240,421,421,421,240],[240,240,240,240,240]]);
      shapeAutotileGroupAround(strip,group,[{x:1,y:1},{x:2,y:1},{x:3,y:1}]);
      expect(chipsetQuarterComposition(strip,ts,2,1)?.sources.map(p=>p.tile)).toEqual([391,391,451,451]);
    });

    it("treats snowy woods and mountains as snow hosts without rewriting their tiles", () => {
      const ts = tileset();
      const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"snow")!;
      const m = map([[307,310,247],[250,190,246],[249,307,310]]);
      const before = [...m.lowerTiles];
      shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
      expect(m.lowerTiles).toEqual(before);
      expect(chipsetQuarterComposition(m,ts,1,1)).toBeNull();
      m.lowerTiles[0] = 240;
      shapeAutotileGroupAround(m,group,[{x:0,y:0}]);
      expect(m.lowerTiles[4]).toBe(131);
      expect(chipsetQuarterComposition(m,ts,1,1)?.sources.map(p=>p.tile)).toEqual([131,190,190,190]);
    });

    it("chooses grass and snow shoreline independently for each corner", () => {
      const ts = tileset();
      const mixed = map([[190,120,240],[120,120,120],[240,120,190]]);
      expect(lakeAutotileQuarterSources(mixed,1,1,ts).map(p=>p.tile)).toEqual([93,90,90,93]);
      for (const snow of [190,247,250,246,307,249,310]) {
        const east = map([[120,120,120],[120,120,snow],[120,120,120]]);
        expect(lakeAutotileQuarterSources(east,1,1,ts).map(p=>p.tile)).toEqual([120,33,120,33]);
      }
      // A stored snow shoreline remains water and must join surrounding ocean.
      expect(lakeAutotileQuarterSources(map([[3]]),0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
      const snowAtSea = map([[120,120,120],[120,190,120],[120,120,120]]);
      const snowGroup = ts.autotileGroups!.find(g=>g.id===PREFIX+"snow")!;
      shapeAutotileGroupAround(snowAtSea,snowGroup,[{x:1,y:1}]);
      expect(snowAtSea.lowerTiles[4]).toBe(190);
    });

    it("seeds all 11 disjoint groups idempotently with consistent layer and passage", () => {
      const ts = tileset();
      ts.autotileGroups = []; ts.tileGroups = [];
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
      const claimed = new Set<number>();
      for (const {key,anchor,solid} of ART) {
        const group = ts.autotileGroups!.find(g=>g.id===PREFIX+key)!;
        const expected = [anchor,anchor+2,anchor+30,anchor+31,anchor+32,anchor+60,anchor+61,anchor+62,anchor+90,anchor+91,anchor+92];
        expect(group.memberTileIds).toEqual(expected);
        expect(Object.keys(group.variantMap)).toHaveLength(256);
        expect(group.memberTileIds).not.toContain(anchor+1);
        for (const t of expected) {
          expect(claimed.has(t)).toBe(false); claimed.add(t);
          expect(ts.tileMeta![t]).toMatchObject({defaultLayer:"lower",passage:solid?"solid":"passable"});
          expect(ts.priority[t]).toBe("lower");
          expect(Object.values(ts.passability[t]!)).toEqual([!solid,!solid,!solid,!solid]);
        }
      }
      expect(claimed.size).toBe(121);
      expect(claimed.has(240)).toBe(false);
      expect(ts.tileMeta![362]!.passage).toBe("solid"); // Original semantic table had a passable forest corner.
    });

    it("preserves authored overlapping groups and user or locked tile metadata", () => {
      const ts = tileset();
      const custom = { ...createWorldTerrainAutotileGroups().find(g=>g.id===PREFIX+"forest")!, id:"my-forest",name:"내 숲" };
      ts.autotileGroups = [custom];
      ts.tileMeta![421] = {label:"내 숲 몸통",source:"user",defaultLayer:"upper",passage:"passable"};
      ts.tileMeta![424] = {label:"고정 산",source:"bundled-default",userLocked:true,defaultLayer:"upper",passage:"passable"};
      for (const t of [421,424]) { ts.priority[t]="upper"; ts.passability[t]={up:true,down:false,left:true,right:false}; }
      const metadata = [421,424].map(t=>structuredClone({meta:ts.tileMeta![t],priority:ts.priority[t],pass:ts.passability[t]}));
      const original = structuredClone(custom);
      applyEasyRpgThemeMetadataPacks(ts);
      expect(ts.autotileGroups!.find(g=>g.id==="my-forest")).toEqual(original);
      expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
      expect(worldTerrainQuarterKit(ts,421)).toBeNull();
      expect([421,424].map(t=>({meta:ts.tileMeta![t],priority:ts.priority[t],pass:ts.passability[t]}))).toEqual(metadata);
    });

    it.each([
      ["variant",(g:AutotileGroup)=>{g.variantMap["255"]=240;}],
      ["neighborhood",(g:AutotileGroup)=>{g.neighborhood=4;}],
      ["members",(g:AutotileGroup)=>{g.memberTileIds[0]=240;}],
      ["connections",(g:AutotileGroup)=>{g.connectTileIds!.push(240);}],
    ] as const)("disables fixed quarter composition immediately after in-place %s edits", (_,edit) => {
      const ts = tileset();
      const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
      expect(worldTerrainQuarterKit(ts,421)).not.toBeNull();
      edit(group);
      const before = structuredClone(group);
      expect(worldTerrainQuarterKit(ts,421)).toBeNull();
      expect(seedWorldTerrainAutotiles(ts)).toBe(false);
      expect(group).toEqual(before);
      expect(chipsetQuarterComposition(map([[421]]),ts,0,0)).toBeNull();
    });

    it("leaves every other bundled tileset untouched even though tile IDs overlap", () => {
      for (const ts of Object.values(defaultTilesets())) {
        // worldmap_selected 는 월드 시트 480칸 정의를 그대로 복제해 아이콘만 덧붙인다(worldmapSelected.ts) — 같은 지형 킷을 갖는 것이 맞다.
        if (ts.id === "easyrpg_chipset_world" || ts.id === "worldmap_selected") continue;
        const before = structuredClone(ts);
        expect(seedWorldTerrainAutotiles(ts)).toBe(false);
        for (const {anchor} of ART) expect(worldTerrainQuarterKit(ts,anchor+61)).toBeNull();
        expect(ts).toEqual(before);
      }
    });

    it("preserves grafted artwork by opting its whole source block out of fixed quarter rendering", () => {
      const ts = tileset();
      const original = structuredClone(ts.autotileGroups);
      for (const targetTile of [421,360,390,362]) {
        ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        ts.tileMeta![targetTile] = {label:"내 집 그림",source:"user",userLocked:true};
        expect(worldTerrainQuarterKit(ts,421)).toBeNull();
        expect(chipsetQuarterComposition(map([[240,240,240],[240,421,240],[240,240,240]]),ts,1,1)).toBeNull();
        expect(worldTerrainQuarterKit(ts,424)).not.toBeNull();
        expect(seedWorldTerrainAutotiles(ts)).toBe(false);
        expect(ts.autotileGroups).toEqual(original);
      }
      // T+1 is not a source slot; grafting this spare sample must not disable forest.
      ts.tileGrafts = [{targetTile:361,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      expect(worldTerrainQuarterKit(ts,421)).not.toBeNull();
      ts.tileGrafts = [{targetTile:421,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      const project = withRetiredEasyRpgTilesets(createBlankProject()); project.tilesets[ts.id]=ts;
      const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
      expect(loaded.tileGrafts).toEqual(ts.tileGrafts);
      expect(worldTerrainQuarterKit(loaded,421)).toBeNull();
      delete loaded.tileGrafts;
      expect(worldTerrainQuarterKit(loaded,421)).not.toBeNull();
    });

    it("does not create a canonical terrain group over an existing graft", () => {
      const ts = tileset();
      ts.autotileGroups = []; ts.tileGroups=[];
      ts.tileGrafts = [{targetTile:421,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      expect(seedWorldTerrainAutotiles(ts)).toBe(true);
      expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
      expect(ts.tileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
      expect(ts.autotileGroups).toHaveLength(10);
      expect(seedWorldTerrainAutotiles(ts)).toBe(false);
      delete ts.tileGrafts;
      expect(seedWorldTerrainAutotiles(ts)).toBe(true);
      expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(true);
      expect(seedWorldTerrainAutotiles(ts)).toBe(false);
    });

    it("retains terrain groups, shaped tiles and quarter rendering through project serialization", () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const ts = project.tilesets.easyrpg_chipset_world!;
      const m = createBlankMap("World terrain serialization contract",5,3,ts.id);
      m.lowerTiles = [240,240,240,240,240,240,421,421,421,240,240,240,240,240,240];
      const forest = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
      shapeAutotileGroupAround(m,forest,[{x:1,y:1},{x:2,y:1},{x:3,y:1}]);
      project.maps = {[m.id]:m}; project.mapTree={mapId:m.id,children:[]}; project.startMapId=m.id; project.startPos={x:0,y:0};
      const loaded = deserialize(serialize(project));
      const loadedTs=loaded.tilesets[ts.id]!;
      expect(loadedTs.autotileGroups).toEqual(ts.autotileGroups);
      expect(loaded.maps[m.id]!.lowerTiles).toEqual(m.lowerTiles);
      expect(chipsetQuarterComposition(loaded.maps[m.id]!,loadedTs,2,1)).toEqual(chipsetQuarterComposition(m,ts,2,1));
      expect(loadedTs.tileMeta![362]).toEqual(ts.tileMeta![362]);
      expect(applyEasyRpgThemeMetadataPacks(loadedTs)).toBe(false);
    });
  });
  // Regression from the authored world's road-side cove (63,23): diagonal snow cannot tint a grass edge.
  it("chooses snow skin only from land contributing the quarter boundary", () => {
    const ts = retiredEasyRpgTileset("easyrpg_chipset_world");
    const m = {width:3,height:3,lowerTiles:[120,240,190,120,120,120,120,120,120]};
    const ne = lakeAutotileQuarterSources(m,1,1,ts).find(p=>p.quarter==="ne")!;
    expect(ne.tile).toBe(60);
    m.lowerTiles[1]=120;
    expect(lakeAutotileQuarterSources(m,1,1,ts).find(p=>p.quarter==="ne")!.tile).toBe(93);
  });
});
