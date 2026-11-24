import { beforeEach, describe, expect, it } from "vitest";
import { serialize, deserialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { DEFAULT_AUTOTILE_GROUPS, DEFAULT_UNDERGROWTH_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { store } from "@/project/store";
import { addAutotileGroup, fillAutotileVariantMap, removeAutotileGroup, seedDefaultAutotileGroups, setAutotileVariant, updateAutotileGroup } from "@/editor/tilesetActions";
import type { Project, AutotileGroup, GameMap } from "@/project/types";
import { auditCombinedTownAutotiles, repairCombinedTownAutotiles } from "@/project/combinedTownAutotileAudit";
import { startOnRetiredCombinedTown, RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import { isolateTimers } from "./mergedTeardown";

describe("autotileGroupPersistence", () => {
  isolateTimers();
  function firstTilesetId(project: Project): string {
    // 새 프로젝트의 첫 타일셋(버들항, 2026-10-07 저작권 정리 뒤 기본값)은 오토타일 그룹을 들고 태어난다 —
    // 이 시험은 「그룹이 없는 타일셋」에서 시작하는 일반 동작을 보므로 그룹 없는 첫 타일셋을 고른다.
    const id = Object.keys(project.tilesets).find((key) => !project.tilesets[key]?.autotileGroups?.length);
    if (!id) throw new Error("no tileset without autotile groups in blank project");
    return id;
  }
  function canonicalProject(): Project {
    const project = createBlankProject();
    // Text-only titleGraphic is omitted by system normalization. Keep that
    // unrelated migration out of the autotile byte-stability precondition.
    project.system = normalizeSystemRecords(project.system);
    return project;
  }
  beforeEach(() => {
    store.replace(canonicalProject());
  });
  describe("오토타일 그룹 직렬화 왕복", () => {
    it("구버전(오토타일 필드 없음) 프로젝트가 그대로 로드된다", () => {
      const project = canonicalProject();
      // 기본 프로젝트에는 autotileGroups 가 없다 → optional 필드이므로 왕복 무손실.
      const restored = deserialize(serialize(project));
      expect(serialize(restored)).toBe(serialize(project));
      const tilesetId = firstTilesetId(restored);
      expect(restored.tilesets[tilesetId].autotileGroups).toBeUndefined();
    });

    it("오토타일 그룹이 있는 프로젝트가 왕복 후 보존된다", () => {
      const tilesetId = firstTilesetId(store.getCurrent());
      const groupId = addAutotileGroup(tilesetId, "임포트 길");
      expect(groupId).not.toBeNull();
      fillAutotileVariantMap(tilesetId, groupId!, {
        body: 100,
        edgeN: 101,
        edgeS: 102,
        edgeW: 103,
        edgeE: 104,
        cornerNW: 105,
        cornerNE: 106,
        cornerSW: 107,
        cornerSE: 108,
      });
      updateAutotileGroup(tilesetId, groupId!, { memberTileIds: [100, 101, 102, 103, 104, 105, 106, 107, 108] });

      const before = store.getCurrent();
      const restored = deserialize(serialize(before));
      expect(serialize(restored)).toBe(serialize(before));

      const group = restored.tilesets[tilesetId].autotileGroups?.[0];
      expect(group?.name).toBe("임포트 길");
      expect(Object.keys(group?.variantMap ?? {})).toHaveLength(16);
      expect(group?.variantMap[String(0)]).toBe(105); // 이웃 전무 → 북서 모서리
    });
  });
  describe("오토타일 그룹 뮤테이션", () => {
    it("그룹 추가/기본값 시드/삭제가 동작한다", () => {
      const tilesetId = firstTilesetId(store.getCurrent());

      seedDefaultAutotileGroups(tilesetId);
      expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toEqual(DEFAULT_AUTOTILE_GROUPS);

      const groupId = addAutotileGroup(tilesetId, "추가");
      expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length + 1);

      removeAutotileGroup(tilesetId, groupId!);
      expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toEqual(DEFAULT_AUTOTILE_GROUPS);
    });

    it("단일 비트마스크 항목 편집과 제거", () => {
      const tilesetId = firstTilesetId(store.getCurrent());
      const groupId = addAutotileGroup(tilesetId, "그룹")!;

      setAutotileVariant(tilesetId, groupId, 5, 42);
      expect(store.getCurrent().tilesets[tilesetId].autotileGroups?.[0].variantMap[String(5)]).toBe(42);

      setAutotileVariant(tilesetId, groupId, 5, null);
      expect(store.getCurrent().tilesets[tilesetId].autotileGroups?.[0].variantMap[String(5)]).toBeUndefined();
    });

    it("마지막 그룹을 지우면 autotileGroups 필드가 제거된다", () => {
      const tilesetId = firstTilesetId(store.getCurrent());
      const groupId = addAutotileGroup(tilesetId, "그룹")!;
      removeAutotileGroup(tilesetId, groupId);
      expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toBeUndefined();
    });
  });
});

describe("combinedTownAutotileAudit", () => {
  isolateTimers();
  function fixture(group: AutotileGroup, tiles: readonly number[]): Project {
    const project = startOnRetiredCombinedTown(createBlankProject());
    project.meta = { ...project.meta, title: "audit fixture" };
    const map = project.maps[project.startMapId]!;
    map.width = tiles.length;
    map.height = 1;
    map.lowerTiles = [...tiles];
    map.upperTiles = tiles.map(() => 0);
    project.tilesets[map.tilesetId] = { ...project.tilesets[map.tilesetId]!, autotileGroups: [group] };
    return project;
  }
  describe("combined-town autotile audit", () => {
    const group = DEFAULT_AUTOTILE_GROUPS[0]!;
    const isolated = group.variantMap["0"]!;
    const connectedEast = group.variantMap["2"]!;
    const connectedWest = group.variantMap["8"]!;

    it("accepts canonical variants", () => {
      const report = auditCombinedTownAutotiles(fixture(group, [connectedEast, connectedWest]), "fixture");
      expect(report.findings).toEqual([]);
      expect(report.memberCells).toBe(2);
    });

    it("reports an incorrect boundary variant with coordinates", () => {
      const wrong = group.memberTileIds.find((tile) => tile !== isolated)!;
      const report = auditCombinedTownAutotiles(fixture(group, [wrong]), "fixture");
      expect(report.findings).toEqual([
        expect.objectContaining({ x: 0, y: 0, actual: wrong, expected: isolated, reason: "stale-variant" }),
      ]);
    });

    it("does not mutate the audited project", () => {
      const project = fixture(group, [isolated]);
      const before = structuredClone(project);
      auditCombinedTownAutotiles(project, "fixture");
      expect(project).toEqual(before);
    });

    it("excludes lake and base grass outside effective groups", () => {
      const report = auditCombinedTownAutotiles(fixture(group, [0, 240]), "fixture");
      expect(report.memberCells).toBe(0);
      expect(report.findings).toEqual([]);
    });

    it("merges a custom group with non-overlapping built-ins", () => {
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId]!;
      project.tilesets[map.tilesetId] = { ...project.tilesets[map.tilesetId]!, autotileGroups: [group] };
      const report = auditCombinedTownAutotiles(project, "fixture");
      expect(report.effectiveGroupIds.length).toBe(DEFAULT_AUTOTILE_GROUPS.length);
    });

    it("repairs every stale member variant deterministically", () => {
      const wrong = group.memberTileIds.find((tile) => tile !== isolated)!;
      const project = fixture(group, [wrong]);
      const original = structuredClone(project);
      const repaired = repairCombinedTownAutotiles(project);
      expect(auditCombinedTownAutotiles(repaired, "fixture").findings).toEqual([]);
      expect(project).toEqual(original);
      expect(repairCombinedTownAutotiles(repaired)).toEqual(repaired);
    });
  });
});

describe("forestFloorMix", () => {
  isolateTimers();
  const UNDERGROWTH = new Set<number>(DEFAULT_UNDERGROWTH_AUTOTILE_GROUP.memberTileIds);
  const TRUNKS = new Set([290, 291, 292, 293]);
  const CANOPIES = new Set([260, 261, 262, 263]);
  const BUSHES = new Set([288, 289]);
  /** 1×1 풀 — 키큰 풀 오토타일 조각 + 잔디 변형. 한 칸만 쓰면 네모로 뜬다. */
  const ONE_BY_ONE_GRASS = new Set([
    243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335,
    270, 271, 272, 300, 301, 302, 330,
  ]);
  function setup() {
    // 밑동 290~293·수관 260~263 은 옛 combined_town 칸 번호다 — 2026-10-07 정리 뒤 기본 칩셋(beodeul_city)이 아니므로 그 시트를 명시해 만든다.
    const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createEmptyToolProject("숲 바닥 혼합")) };
    const made = runTool(ctx, "create_map", { name: "숲", width: 30, height: 30, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
    const mapId = (made.data as { mapId: string }).mapId;
    return { ctx, mapId };
  }
  type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  function snapshot(map: GameMap, area: Area): { trunks: number; canopies: number; bushes: number } {
    let trunks = 0;
    let canopies = 0;
    let bushes = 0;
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        const i = y * map.width + x;
        const lower = map.lowerTiles[i] ?? 0;
        const upper = map.upperTiles[i] ?? 0;
        if (TRUNKS.has(upper) || TRUNKS.has(lower) || isTreeTrunkTileId(upper) || isTreeTrunkTileId(lower)) trunks += 1;
        if (CANOPIES.has(upper) || isTreeCanopyTileId(upper)) canopies += 1;
        if (BUSHES.has(upper) || BUSHES.has(lower)) bushes += 1;
      }
    }
    return { trunks, canopies, bushes };
  }
  function counts(map: GameMap, area: Area) {
    let undergrowth = 0;
    let water = 0;
    let waterOnTrunk = 0;
    let waterOnBush = 0;
    let cells = 0;
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        cells += 1;
        const i = y * map.width + x;
        const lower = map.lowerTiles[i] ?? 0;
        const upper = map.upperTiles[i] ?? 0;
        if (UNDERGROWTH.has(lower)) undergrowth += 1;
        if (isLakeAutotileTile(lower)) {
          water += 1;
          if (TRUNKS.has(upper) || TRUNKS.has(lower) || isTreeTrunkTileId(lower) || isTreeTrunkTileId(upper)) {
            waterOnTrunk += 1;
          }
          if (BUSHES.has(upper) || BUSHES.has(lower)) waterOnBush += 1;
        }
      }
    }
    return { undergrowth, water, waterOnTrunk, waterOnBush, cells };
  }
  describe("forest floor mix", () => {
    it("dense 합성: 짙은 수풀이 드물게 깔리고 수관·밑동·덤불이 살아남는다", () => {
      const { ctx, mapId } = setup();
      const area = { x: 2, y: 2, w: 20, h: 20 };
      const result = runTool(ctx, "place_props", {
        mapId, area, material: "침엽수", density: "dense", seed: 7,
      });
      expect(result.ok, result.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      const c = counts(map, area);
      expect(c.undergrowth).toBeGreaterThan(0);
      expect(c.undergrowth).toBeLessThan(c.cells * 0.35);
      expect(c.water).toBeLessThanOrEqual(8);
      expect(c.waterOnTrunk).toBe(0);
      expect(c.waterOnBush).toBe(0);
      const s = snapshot(map, area);
      expect(s.trunks).toBeGreaterThan(0);
      expect(s.canopies).toBeGreaterThan(0);
      expect(s.bushes).toBeGreaterThan(0);
    });

    it("tone 칠하기: 1×1 풀(키큰 풀·잔디 변형)을 lower에 쓰지 않는다", () => {
      const { ctx, mapId } = setup();
      const area = { x: 2, y: 2, w: 20, h: 20 };
      const result = runTool(ctx, "place_props", {
        mapId, area, material: "침엽수", density: "dense", seed: 7,
      });
      expect(result.ok, result.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let x = area.x; x < area.x + area.w; x += 1) {
          const lower = map.lowerTiles[y * map.width + x] ?? 0;
          expect(ONE_BY_ONE_GRASS.has(lower), `${x},${y}=${lower}`).toBe(false);
        }
      }
    });

    it("impassable 합성: 물웅덩이가 밑동·덤불을 덮지 않는다", () => {
      const { ctx, mapId } = setup();
      const area = { x: 2, y: 2, w: 20, h: 20 };
      const result = runTool(ctx, "place_props", {
        mapId, area, material: "활엽수", density: "impassable", seed: 11,
      });
      expect(result.ok, result.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      const c = counts(map, area);
      expect(c.undergrowth).toBeGreaterThan(0);
      expect(c.waterOnTrunk).toBe(0);
      expect(c.waterOnBush).toBe(0);
      const s = snapshot(map, area);
      expect(s.trunks).toBeGreaterThan(0);
      expect(s.canopies).toBeGreaterThan(0);
      expect(s.bushes).toBeGreaterThan(0);
    });
  });
});
