import { describe, expect, it, beforeAll } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { RM_TYPE_GRAMMAR_PROFILE, MODERN_EXTERIORS_GRAMMAR_PROFILE, registerGrammarProfile } from "@/editor/tools/v3/grammarProfiles";
import { expandWall, buildEightNeighborVariantMap, expandRoof, resolveAutotile } from "@/editor/tools/v3/rmTypeExpander";
import { TILE, COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata, TilesetDef, AutotileGroup, TileGroupRole } from "@/project/types";
import { AUTOTILE_DIR, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import type { AiPreviewThemeEligibilityEvidence, AiPreviewThemeId } from "@/project/aiPreviewContracts";
import { generateAiPreviewThemeMap } from "@/project/aiPreviewThemeGrammar";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { LEGACY_ROLE_CAPABILITIES, roleCapabilities } from "@/project/tileRoles";
import { isolateTimers } from "./mergedTeardown";

describe("repeatableBlockGrammar", () => {
  isolateTimers();
  function tileset(): TilesetDef {
    return {
      count: 512,
      id: "repeatable-test",
      image: { type: "bundled", id: "test" },
      name: "Repeatable test",
      passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: 512 }, () => "lower" as const),
      terrain: Array.from({ length: 512 }, () => 0),
      tileSize: 16,
      tilesPerRow: 16,
    };
  }
  function repeatableGroup(): TileGroupMetadata {
    return {
      cellLayers: ["upper", "upper", "lower", "lower", "lower", "lower"],
      defaultLayer: "mixed",
      description: "2x3 repeatable cliff",
      id: "cliff-2x3",
      layerHome: "perCell",
      name: "2x3 cliff",
      origin: "user",
      patternGrammar: {
        axis: "both",
        blockHeight: 3,
        blockWidth: 2,
        kind: "repeatable_block",
        minHeight: 3,
        minWidth: 2,
        parts: [{ role: "repeatBody", tileIds: [1, 2, 3, 4, 5, 6] }],
        preserveCaps: false,
        repeat: "source_order",
      },
      placementRules: "Repeat the authored 2x3 block on both axes.",
      role: "wall",
      tileIds: [1, 2, 3, 4, 5, 6],
    };
  }
  describe("repeatable_block grammar", () => {
    it("expands a 2x3 authored block by two-dimensional modulo", () => {
      const expansion = expandWall(
        tileset(),
        repeatableGroup(),
        { h: 7, w: 5, x: 2, y: 3 },
        RM_TYPE_GRAMMAR_PROFILE,
        { material: "2x3 cliff" }
      );

      expect(expansion.edits).toHaveLength(35);
      expect(expansion.edits.map((edit) => edit.tile)).toEqual([
        1, 2, 1, 2, 1,
        3, 4, 3, 4, 3,
        5, 6, 5, 6, 5,
        1, 2, 1, 2, 1,
        3, 4, 3, 4, 3,
        5, 6, 5, 6, 5,
        1, 2, 1, 2, 1,
      ]);
      expect(expansion.edits.slice(0, 5).every((edit) => edit.layer === "upper")).toBe(true);
      expect(expansion.edits.slice(5, 15).every((edit) => edit.layer === "lower")).toBe(true);
    });

    it("previews the exact authored block and its per-cell layers", () => {
      const group = repeatableGroup();
      const sample = buildGroupSample(tileset(), {
        cellLayers: group.cellLayers,
        patternGrammar: group.patternGrammar,
        role: group.role,
        tileIds: group.tileIds,
      });

      expect(sample).toEqual({
        h: 3,
        lower: [TILE.EMPTY, TILE.EMPTY, 3, 4, 5, 6],
        upper: [1, 2, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
        w: 2,
      });
    });
  });
});

// test/rmTypeExpanderV3.test.ts
// RM-TYPE 전개기 계약 테스트 (타일 툴 v3 — V3B).
// 고정하는 계약: (1) 9분할 rect 전개의 role-셀 매핑 (2) 기둥 1×N cap 규약
// (3) 최소 크기 미달 = ToolError + "다시 보낼 형식 예시" (4) 8-이웃 variantMap의
// inner corner 재계산(기존 오토타일 엔진 마스크 규약 재사용) — 전부 순수/결정론.
describe("rmTypeExpanderV3", () => {
  isolateTimers();
  const EXAMPLE = { mapId: "map_1", rect: { x: 0, y: 0, w: 4, h: 4 }, wallVocabId: "wall" };
  function tileset(): TilesetDef {
    return withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
  }
  function nineSliceWall(def: TilesetDef): TileGroupMetadata {
    const group = def.tileGroups?.find((entry) => entry.id === `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`);
    if (!group?.patternGrammar) throw new Error("9분할 벽 하네스 그룹이 없습니다");
    return group;
  }
  function partTile(group: TileGroupMetadata, role: string): number {
    const tile = group.patternGrammar?.parts.find((part) => part.role === role)?.tileIds[0];
    if (tile === undefined) throw new Error(`파츠 없음: ${role}`);
    return tile;
  }
  describe("expandWall (RM-TYPE 전개기)", () => {
    it("9분할 4×4 전개: 모서리 4/변/center가 파츠 정의대로 매핑되고 벽은 lower로 간다", () => {
      const def = tileset();
      const group = nineSliceWall(def);
      const rect = { x: 2, y: 3, w: 4, h: 4 };
      const { edits, region } = expandWall(def, group, rect, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
      expect(region).toEqual(rect);
      expect(edits).toHaveLength(16);
      const at = (x: number, y: number) => edits.find((edit) => edit.x === x && edit.y === y)!;
      expect(at(2, 3).tile).toBe(partTile(group, "topLeft"));
      expect(at(5, 3).tile).toBe(partTile(group, "topRight"));
      expect(at(2, 6).tile).toBe(partTile(group, "bottomLeft"));
      expect(at(5, 6).tile).toBe(partTile(group, "bottomRight"));
      expect(at(3, 3).tile).toBe(partTile(group, "top"));
      expect(at(2, 4).tile).toBe(partTile(group, "left"));
      expect(at(4, 5).tile).toBe(partTile(group, "center"));
      for (const edit of edits) expect(edit.layer).toBe("lower"); // 벽 어휘 홈 = lower
    });

    it("기둥(vertical) 1×N 전개: 위/아래 cap 보존 + 중간은 반복 몸통, 최소 크기 미달은 예시 동봉 거부", () => {
      const def = tileset();
      const group: TileGroupMetadata = {
        id: "test-pillar", name: "기둥", role: "wall", defaultLayer: "lower",
        tileIds: [50, 51], description: "", placementRules: "",
        patternGrammar: {
          kind: "vertical_expandable", minHeight: 2, preserveCaps: true, repeat: "body",
          parts: [{ role: "top", tileIds: [50] }, { role: "bottom", tileIds: [51] }],
        },
      };
      const { edits } = expandWall(def, group, { x: 7, y: 2, w: 1, h: 4 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
      expect(edits.map((edit) => edit.tile)).toEqual([50, 51, 51, 51]); // cap 위 + repeat(bottom) + cap 아래
      expect(edits[0]).toMatchObject({ x: 7, y: 2 });
      expect(edits[3]).toMatchObject({ x: 7, y: 5 });

      let thrown: unknown;
      try {
        expandWall(def, group, { x: 7, y: 2, w: 1, h: 1 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
      } catch (error) {
        thrown = error;
      }
      expect(String((thrown as Error).message)).toContain("다시 보낼 형식 예시");
    });

    it("패턴 파츠 미정의(patternDefined:false) 그룹은 T1b 안내와 함께 거부한다", () => {
      const def = tileset();
      const group: TileGroupMetadata = {
        id: "test-empty", name: "빈 패턴", role: "wall", defaultLayer: "lower",
        tileIds: [50], description: "", placementRules: "",
      };
      expect(() => expandWall(def, group, { x: 0, y: 0, w: 3, h: 3 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE)).toThrowError(/패턴 파츠|patternGrammar/u);
    });
  });
  describe("expandRoof / resolveAutotile", () => {
    it("지붕은 벽 영역 바로 위에 전개되고 perCell/upper 홈 규약을 따른다", () => {
      const def = tileset();
      const roof: TileGroupMetadata = {
        id: "test-roof", name: "지붕", role: "roof", defaultLayer: "upper", layerHome: "upper",
        tileIds: [60, 61, 62], description: "", placementRules: "",
        patternGrammar: {
          kind: "horizontal_expandable", minWidth: 2, preserveCaps: true, repeat: "body",
          parts: [{ role: "leftCap", tileIds: [60] }, { role: "repeatBody", tileIds: [61] }, { role: "rightCap", tileIds: [62] }],
        },
      };
      const wallRegion = { x: 4, y: 6, w: 5, h: 3 };
      const { edits, region } = expandRoof(def, roof, wallRegion, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
      expect(region).toEqual({ x: 4, y: 5, w: 5, h: 1 }); // 벽 위 1행(처마)
      expect(edits.map((edit) => edit.tile)).toEqual([60, 61, 61, 61, 62]);
      for (const edit of edits) expect(edit.layer).toBe("upper");
      // 벽이 y=0이면 지붕 공간이 없어 거부.
      expect(() => expandRoof(def, roof, { x: 0, y: 0, w: 4, h: 3 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE)).toThrowError(/공간이 없습니다/u);
    });

    it("overlay_detail 지붕 어휘는 형제 roof-body 문법으로 전개해 하위 지붕 띠를 깐다", () => {
      const def = tileset();
      const roof: TileGroupMetadata = {
        id: "test-overlay-roof", name: "사선 지붕", role: "roof", defaultLayer: "upper", layerHome: "upper",
        tileIds: [374, 375, 376], description: "", placementRules: "",
        patternGrammar: {
          kind: "overlay_detail", preserveCaps: true, repeat: "source_order",
          parts: [{ role: "center", tileIds: [374, 375, 376] }],
        },
      };
      const { edits, region } = expandRoof(def, roof, { x: 3, y: 4, w: 4, h: 3 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
      expect(region).toEqual({ x: 3, y: 3, w: 4, h: 1 });
      // 오버레이 어휘는 같은 role의 roof-body 형제 문법(374|375*|377)으로 전개된다.
      // 홈은 형제 그룹을 따른다 — 몸체는 불투명이므로 하위.
      expect(edits).toHaveLength(4);
      expect(edits.map((edit) => edit.tile)).toEqual([374, 375, 375, 377]);
      for (const edit of edits) expect(edit.layer).toBe("lower");
    });

    it("resolveAutotile: 8-이웃 variantMap으로 inner corner(대각만 빈 셀)를 재계산한다", () => {
      const tiles = { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 6, cornerNE: 7, cornerSW: 8, cornerSE: 9 };
      const variantMap = buildEightNeighborVariantMap(tiles, { innerNW: 10, innerNE: 11, innerSW: 12, innerSE: 13 });
      expect(variantMap[String(255)]).toBe(1); // 완전 연결 = body
      expect(variantMap[String(255 - AUTOTILE_DIR.NE)]).toBe(11); // NE 대각만 빔 = inner corner
      expect(variantMap[String(AUTOTILE_DIR.E | AUTOTILE_DIR.S)]).toBe(6); // N/W 빔 = 외곽 NW 모서리

      const group: AutotileGroup = {
        id: "path8", name: "길", neighborhood: 8,
        memberTileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        variantMap,
      };
      // 5×5 맵: (2,2) 중심의 상하좌우+대각(NE 제외) 전부 멤버 → 중심은 innerNE로 바뀌어야 한다.
      const width = 5;
      const lowerTiles = Array.from({ length: 25 }, () => 0);
      const put = (x: number, y: number) => { lowerTiles[y * width + x] = 1; };
      for (const [x, y] of [[2, 2], [2, 1], [3, 2], [2, 3], [1, 2], [1, 1], [1, 3], [3, 3]] as const) put(x, y);
      const map = { width, height: 5, lowerTiles };
      const changed = resolveAutotile(group, [{ x: 2, y: 2 }], map);
      expect(changed).toBeGreaterThan(0);
      expect(map.lowerTiles[2 * width + 2]).toBe(11); // inner corner NE
    });

    // AI 길깔기·재료 칠하기·공간 컴파일은 resolveAutotile, 붓·채우기는 shapeAutotileGroupAround 를 쓴다.
    // 두 경로가 같은 모양에 다른 칸을 깔면 조수가 깔 지형만 깨져 보인다(2026-11-07 감사: 370그룹 중 136).
    const paintBoth = (group: AutotileGroup, cells: readonly { x: number; y: number }[], width: number, height: number) => {
      const body = group.variantMap[group.neighborhood === 8 ? "255" : "15"]!;
      const fresh = () => { const lowerTiles = Array.from({ length: width * height }, () => -1); for (const c of cells) lowerTiles[c.y * width + c.x] = body; return { width, height, lowerTiles }; };
      const brush = fresh();
      shapeAutotileGroupAround(brush, group, cells);
      const ai = fresh();
      resolveAutotile(group, cells, ai);
      return { brush: brush.lowerTiles, ai: ai.lowerTiles };
    };

    it("resolveAutotile: edgeConnects 그룹은 맵 밖을 이어진 것으로 본다 — 붓과 같은 칸", () => {
      const tiles = { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 6, cornerNE: 7, cornerSW: 8, cornerSE: 9 };
      const group: AutotileGroup = {
        id: "edge8", name: "맵 밖 연결", neighborhood: 8, edgeConnects: true,
        memberTileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        variantMap: buildEightNeighborVariantMap(tiles, { innerNW: 10, innerNE: 11, innerSW: 12, innerSE: 13 }),
      };
      // 맵 윗줄 전체를 칠한다: 북쪽·양 끝은 맵 밖 = 이어짐, 남쪽만 열려 있다 → 전부 남변(3).
      const cells = Array.from({ length: 4 }, (_, x) => ({ x, y: 0 }));
      const { brush, ai } = paintBoth(group, cells, 4, 3);
      expect(brush.slice(0, 4)).toEqual([3, 3, 3, 3]);
      expect(ai).toEqual(brush);
    });

    it("resolveAutotile: phaseVariants 그룹은 칸 위치로 몸통을 고른다 — 붓과 같은 칸", () => {
      const variantMap: Record<string, number> = {};
      for (let mask = 0; mask < 256; mask += 1) variantMap[String(mask)] = mask === 255 ? 100 : 50;
      const phaseMap = (body: number) => ({ "255": body });
      const group: AutotileGroup = {
        id: "phase", name: "위상 몸통", neighborhood: 8, edgeConnects: true,
        memberTileIds: [50, 100, 101, 102, 103],
        variantMap,
        phaseVariants: { w: 2, h: 2, maps: [phaseMap(100), phaseMap(101), phaseMap(102), phaseMap(103)] },
      };
      const cells = Array.from({ length: 16 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4) }));
      const { brush, ai } = paintBoth(group, cells, 4, 4);
      expect(new Set(brush)).toEqual(new Set([100, 101, 102, 103]));
      expect(ai).toEqual(brush);
    });

    it("resolveAutotile: 꽉 찬 칸의 깊이 변형(interiorVariants)을 몸통으로 덮지 않는다 — 붓과 같은 칸", () => {
      const tiles = { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 6, cornerNE: 7, cornerSW: 8, cornerSE: 9 };
      const group: AutotileGroup = {
        id: "depth", name: "깊이 음영", neighborhood: 8,
        memberTileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 20],
        variantMap: buildEightNeighborVariantMap(tiles),
        interiorVariants: [[20]],
      };
      const width = 5;
      const fresh = () => { const lowerTiles = Array.from({ length: 25 }, () => 1); lowerTiles[2 * width + 2] = 20; return { width, height: 5, lowerTiles }; };
      const cells = Array.from({ length: 25 }, (_, i) => ({ x: i % width, y: Math.floor(i / width) }));
      const brush = fresh();
      shapeAutotileGroupAround(brush, group, cells);
      const ai = fresh();
      resolveAutotile(group, cells, ai);
      expect(ai.lowerTiles[2 * width + 2]).toBe(20);
      expect(ai.lowerTiles).toEqual(brush.lowerTiles);
    });
  });
});

describe("themeCapabilityRoles", () => {
  isolateTimers();
  // 역할별 대표 타일 id. 서로 겹치지 않게 두어 맵에 찍힌 숫자만 보고
  // 어떤 role 이 선택됐는지 역추적할 수 있게 한다.
  const TILE_BY_ROLE: Readonly<Record<string, number>> = {
    terrain: 11,
    wall: 22,
    building: 33,
    prop: 44,
    water: 55,
    fence: 66,
    roof: 77,
    castle: 88,
  };
  function group(role: TileGroupRole): TileGroupMetadata {
    return {
      id: `g-${role}`,
      name: `${role} group`,
      role,
      defaultLayer: "lower",
      tileIds: [TILE_BY_ROLE[role]],
      description: "",
      placementRules: "",
    };
  }
  function evidence(roles: readonly TileGroupRole[]): AiPreviewThemeEligibilityEvidence {
    return {
      themeId: "interior-house",
      metadataPack: { metadataPackId: "test", metadataPackVersion: "1", bundledTextureIds: [] },
      satisfiedCapabilities: [],
      missingCapabilities: [],
      semanticGroups: roles.map(group),
    };
  }
  // generateAiPreviewThemeMap → firstCapabilityTile → groupsForCapability 로 실제로
  // 내려가는 유일한 공개 진입점. 표만 읽는 특성화 테스트와 달리 함수 본문을 통과한다.
  function themeMap(
    themeId: AiPreviewThemeId,
    roles: readonly TileGroupRole[],
    grammarProfile?: string
  ) {
    return generateAiPreviewThemeMap({
      charsetAssetId: "charset-1",
      charsetTextureKey: "charset-1",
      goal: "테스트",
      height: 5,
      mapId: "map-1",
      name: "테스트 맵",
      themeEligibility: { ...evidence(roles), themeId },
      themeId,
      tileset: { ...defaultTileset(), grammarProfile },
      width: 5,
    });
  }
  // 표가 완전히 빈 프로파일. 모든 능력이 소비처의 폴백으로 떨어지므로,
  // module-private 인 groupsForCapability 의 폴백 분기를 공개 진입점만으로 관통할 수 있다.
  const EMPTY_TABLE_PROFILE_ID = "test-empty-theme-capability-table";
  beforeAll(() => {
    registerGrammarProfile({
      id: EMPTY_TABLE_PROFILE_ID,
      label: "테스트용 빈 themeCapabilityRoles",
      supportedPatternKinds: ["single"],
      layerHomeByRole: {
        terrain: "lower",
        water: "lower",
        wall: "lower",
        building: "lower",
        castle: "lower",
        fence: "upper",
        roof: "perCell",
        prop: "perCell",
      },
      autotileNeighborhood: 8,
      themeCapabilityRoles: {},
    });
  });
  // 빈 표 프로파일에서 walkableFloor 를 폴백으로 흘려보낸 뒤 바닥에 찍힌 타일을 돌려준다.
  function fallbackFloorTile(roles: readonly TileGroupRole[]): number | undefined {
    return themeMap("interior-house", roles, EMPTY_TABLE_PROFILE_ID).map.lowerTiles[FLOOR];
  }
  // width 5 / height 5 기준 좌표 → lowerTiles 인덱스.
  const BORDER = 0;   // (0,0)
  const TRIM = 7;   // (2,1) — interior-house 의 roomTrim 행
  const FLOOR = 12;   // (2,2) — 내부 바닥

  describe("themeCapabilityRoles (특성화)", () => {
    it("기존 groupsForCapability 매핑을 그대로 재현한다", () => {
      const table = RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles;
      expect(table.walkableFloor).toEqual(["terrain"]);
      expect(table.solidBoundary).toEqual(["wall"]);
      expect(table.wallFace).toEqual(["wall"]);
      expect(table.roomTrim).toEqual(["building", "prop"]);
      expect(table.buildingShell).toEqual(["building", "prop"]);
      expect(table.doorOrEntrance).toEqual(["building", "prop"]);
      expect(table.waterOrHazard).toEqual(["water"]);
    });

    it("decorProp 은 표에 없고 폴백(prop/fence/roof)으로 떨어진다", () => {
      // 원본 groupsForCapability 도 decorProp 을 명시 분기하지 않고 catch-all 로
      // 처리했다. 표에 넣어버리면 폴백 경로가 죽어 동작 변화가 된다.
      expect(RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles.decorProp).toBeUndefined();
    });

    it("두 프로파일이 같은 표를 갖는다 (현행 코드가 프로파일 무관 단일 매핑이므로)", () => {
      expect(MODERN_EXTERIORS_GRAMMAR_PROFILE.themeCapabilityRoles).toEqual(
        RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles
      );
    });
  });
  describe("groupsForCapability (동작)", () => {
    it("walkableFloor 는 terrain, wallFace 는 wall, roomTrim 은 building 을 고른다", () => {
      const { map } = themeMap("interior-house", ["terrain", "wall", "building", "water"]);
      expect(map.lowerTiles[FLOOR]).toBe(TILE_BY_ROLE.terrain);
      expect(map.lowerTiles[BORDER]).toBe(TILE_BY_ROLE.wall);
      expect(map.lowerTiles[TRIM]).toBe(TILE_BY_ROLE.building);
    });

    it("roomTrim 은 building 이 없으면 prop 으로 간다", () => {
      const { map } = themeMap("interior-house", ["terrain", "wall", "prop"]);
      expect(map.lowerTiles[TRIM]).toBe(TILE_BY_ROLE.prop);
    });

    it("roomTrim 은 building/prop 이 모두 없으면 없는 것으로 취급한다", () => {
      // trimTile === null → roomTrim 행이 바닥으로 채워진다.
      const { map } = themeMap("interior-house", ["terrain", "wall", "water", "fence", "roof"]);
      expect(map.lowerTiles[TRIM]).toBe(TILE_BY_ROLE.terrain);
    });

    it("dungeon 의 solidBoundary 는 wall 을 고른다", () => {
      const { map } = themeMap("dungeon", ["terrain", "wall", "building"]);
      expect(map.lowerTiles[BORDER]).toBe(TILE_BY_ROLE.wall);
      expect(map.lowerTiles[FLOOR]).toBe(TILE_BY_ROLE.terrain);
    });

    it("역할이 하나도 안 맞으면 타일을 못 고른다", () => {
      // terrain 이 없으니 walkableFloor 는 null → floorTile 이 TILE.EMPTY(-1) 로 떨어지고,
      // wall 도 없으니 wallTile 은 floorTile 을 물려받는다.
      const { map } = themeMap("interior-house", ["water", "fence", "roof", "castle"]);
      expect(map.lowerTiles[FLOOR]).toBe(TILE.EMPTY);
      expect(map.lowerTiles[BORDER]).toBe(TILE.EMPTY);
    });
  });
  // 이 블록이 지키는 것: 표에 없는 능력의 폴백 목록 내용. decorProp 은 표에 없으므로
  // 전적으로 이 폴백에 의존하며, 공개 진입점은 decorProp 을 쓰지 않는다. 따라서 폴백
  // 리터럴을 직접 고정하지 않으면 decorProp 보증이 비어 있게 된다.
  describe("groupsForCapability 폴백 (표에 없는 능력)", () => {
    it("폴백은 prop 을 포함한다", () => {
      expect(fallbackFloorTile(["terrain", "prop"])).toBe(TILE_BY_ROLE.prop);
    });

    it("폴백은 fence 를 포함한다", () => {
      expect(fallbackFloorTile(["terrain", "fence"])).toBe(TILE_BY_ROLE.fence);
    });

    it("폴백은 roof 를 포함한다", () => {
      expect(fallbackFloorTile(["terrain", "roof"])).toBe(TILE_BY_ROLE.roof);
    });

    it("폴백은 prop/fence/roof 외의 역할은 받지 않는다", () => {
      // terrain·water·wall·building·castle 만 있으면 폴백은 아무것도 못 고른다.
      // 폴백이 "전부 허용"으로 넓어지면 이 단정이 깨진다.
      expect(fallbackFloorTile(["terrain", "water", "wall", "building", "castle"])).toBe(TILE.EMPTY);
    });
  });
});

describe("tileRoleCapabilities", () => {
  isolateTimers();
  /** 구 어휘 13종 = TileGroupRole 8 + PaletteSlotRole 8 − 공유 3(wall/water/roof). */
  const LEGACY_ROLE_IDS = [
    "building", "castle", "fence", "roof", "terrain", "water", "wall", "prop",
    "ground", "path", "decor", "boundary", "furniture",
  ] as const;
  describe("roleCapabilities — A-1 동등성", () => {
    it("구 어휘 13종 전부에 대해 능력을 돌려준다", () => {
      const tileset = defaultTileset();
      for (const roleId of LEGACY_ROLE_IDS) {
        const caps = roleCapabilities(tileset, roleId);
        expect(caps, `역할 ${roleId}`).toBeDefined();
        expect(caps.layerHome, `역할 ${roleId} 의 layerHome`).toMatch(/^(lower|upper|perCell)$/);
      }
    });

    it("layerHome 은 RM_TYPE 프로파일의 layerHomeByRole 과 일치한다", () => {
      const tileset = defaultTileset();
      for (const [roleId, expected] of Object.entries(RM_TYPE_GRAMMAR_PROFILE.layerHomeByRole)) {
        expect(roleCapabilities(tileset, roleId).layerHome, `역할 ${roleId}`).toBe(expected);
      }
    });

    it("sampleLayer 는 layerHome 과 별개이며 prop 에서 갈린다", () => {
      // groupSampleBuilder.targetLayer 는 prop 을 upper 로 강제하지만
      // 어휘 홈(layerHomeByRole)은 perCell 이다. 둘을 합치면 동작이 바뀐다.
      const tileset = defaultTileset();
      expect(roleCapabilities(tileset, "prop").layerHome).toBe("perCell");
      expect(roleCapabilities(tileset, "prop").sampleLayer).toBe("upper");
    });

    it("모르는 역할에는 결정론적 폴백을 준다", () => {
      const tileset = defaultTileset();
      const caps = roleCapabilities(tileset, "존재하지-않는-역할");
      expect(caps.layerHome).toBe("lower");
      expect(caps.sampleAs).toBeUndefined();
      expect(caps.autotile).toBe(false);
    });

    it("구 어휘 13종이 모두 표에 있다", () => {
      for (const roleId of LEGACY_ROLE_IDS) {
        expect(LEGACY_ROLE_CAPABILITIES[roleId], `역할 ${roleId} 가 표에 없다`).toBeDefined();
      }
    });

    it("필수 4필드는 모든 역할에 있다", () => {
      // 선택 필드(sampleLayer·sampleAs·expectedPassage·terrainTag)의 부재는 결함이 아니라
      // 설계다 — undefined = "이 역할은 이 질문에 답하지 않는다".
      const required = ["layerHome", "requiresPatternGrammar", "autotile", "needsBackdrop"] as const;
      for (const roleId of LEGACY_ROLE_IDS) {
        const caps = LEGACY_ROLE_CAPABILITIES[roleId]!;
        for (const key of required) {
          expect(key in caps, `역할 ${roleId} 의 ${key} 칸이 비었다`).toBe(true);
        }
      }
    });
  });
});
