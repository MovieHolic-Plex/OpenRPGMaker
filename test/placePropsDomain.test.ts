import { describe, expect, it, vi } from "vitest";
import { passableCellCount } from "@/editor/tools/mapHelpers";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { PLACEMENT_TOOLS } from "@/editor/tools/placementTools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolExecResult } from "@/editor/tools/types";
import { createBlankProject as createBlankDefaultProject, createBlankMap } from "@/project/defaults";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import type { GameMap, Project } from "@/project/types";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import type { ToolContext } from "@/editor/tools";
import { TILE } from "@/project/defaults/constants";
import { poissonScatter } from "@/editor/tools/naturalScatter";
import { mulberry32 } from "@/util/rng";
import { useRetiredCombinedTown, withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { isolateTimers } from "./mergedTeardown";

/**
 * packing:"dense" — "아예 통행불가능하게" 를 실제로 달성하는지 본다.
 *
 * 2026-08-29 15:44 지시("2x2 나무를 많이심어서 아예 통행불가능하게")는 나무가 심겨도 실패로
 * 보였다. 기본 산포는 minGap 1 / maxGap 3 을 지켜 나무 사이를 반드시 비워 두므로 몇 그루를
 * 심어도 지나갈 길이 남는다(실측: 12×12 영역에 24그루 = 통행 칸 144→96).
 *
 * dense 는 간격을 없애고 발자국이 들어가는 자리마다 놓는다(실측: 66그루 = 144→12).
 * 남는 12칸은 맨 윗줄 수관 아래 — 수관 타일은 ★(passability 를 하층에서 물려받음)이고
 * 그 줄의 하층은 잔디다. 그래서 완전 봉쇄를 단정하지 않고 남은 통행 칸 수를 요약에 적는다.
 * 합성 타일로는 이 판정이 안 나온다(passability 표가 비어 있어 전부 통행 가능) — 그래서
 * 이 스펙은 기본 타일셋의 실제 재료 라벨을 쓴다.
 */
describe("densePackingPlacement", () => {
  isolateTimers();
  const AREA = { x: 2, y: 2, w: 12, h: 12 } as const;
  /** 2×2 활엽수 — 수관(upper) 2칸 + 밑동(lower) 2칸. 15:44 지시의 "2x2 나무" 그 자체. */
  const TREE = "활엽수";
  /** 문법 없는 1칸 소품 — place_props 의 단일 타일 경로를 태운다. */
  const BOX = "나무 상자";
  function createProject(): { readonly project: Project; readonly map: GameMap } {
    // 활엽수 2×2 문법·나무 상자 라벨과 그 통행 표는 합본 마을 칩셋의 것이다 — 옛 저장본처럼 그 정의를 되살리고 그 칩셋으로 맵을 만든다.
    const context = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
    const created = runTool(context, "create_map", { id: "map_dense", name: "밀집 테스트", width: 20, height: 20, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
    expect(created.ok, created.summary).toBe(true);
    return { project: context.project, map: context.project.maps.map_dense };
  }
  function data(result: ToolExecResult): Record<string, unknown> {
    if (typeof result.data !== "object" || result.data === null) throw new Error(`data 없음: ${result.summary}`);
    return result.data as Record<string, unknown>;
  }
  function plant(project: Project, material: string, extra: Record<string, unknown> = {}): ToolExecResult {
    return placePropsOnDraft(project, { mapId: "map_dense", area: { ...AREA }, material, count: 200, ...extra });
  }
  describe("packing: dense", () => {
    it("자연 산포는 지나갈 길을 남기고 dense 는 거의 다 막는다", () => {
      const natural = createProject();
      const naturalResult = plant(natural.project, TREE);
      const naturalPassable = passableCellCount(natural.project, natural.map, AREA);

      const dense = createProject();
      const denseResult = plant(dense.project, TREE, { packing: "dense" });
      const densePassable = passableCellCount(dense.project, dense.map, AREA);

      expect(naturalPassable, `자연 산포가 이미 다 막았다면 이 스펙이 무의미하다`).toBeGreaterThan(AREA.w * AREA.h / 2);
      expect(densePassable, `dense=${densePassable} natural=${naturalPassable}`).toBeLessThan(naturalPassable / 4);
      expect(Number(data(denseResult).placed)).toBeGreaterThan(Number(data(naturalResult).placed) * 2);
      expect(data(denseResult).packing).toBe("dense");
      expect(data(denseResult).passableAfter).toBe(densePassable);
    });

    it("요약이 남은 통행 칸을 실측해서 말한다 — 완전 봉쇄를 단정하지 않는다", () => {
      const { project, map } = createProject();
      const result = plant(project, TREE, { packing: "dense" });
      const passable = passableCellCount(project, map, AREA);
      expect(result.summary).toContain(`통행 가능 칸 ${AREA.w * AREA.h}→${passable}`);
      expect(result.summary).toContain("밀집");
      // 0칸일 때만 완전 차단이라고 말한다.
      expect(result.summary.includes("완전 차단")).toBe(passable === 0);
    });

    it("dense 는 모델이 같이 보낸 minGap 을 무시한다", () => {
      const withGap = createProject();
      const gapped = plant(withGap.project, TREE, { packing: "dense", minGap: 3 });
      const zeroGap = createProject();
      const flush = plant(zeroGap.project, TREE, { packing: "dense", minGap: 0 });
      expect(data(gapped).placed).toBe(data(flush).placed);
      expect(gapped.summary).toContain("간격 0");
    });

    it("packing 을 주지 않으면 기존 산포 결과가 그대로다", () => {
      const before = createProject();
      const legacy = plant(before.project, TREE, { seed: 7 });
      const after = createProject();
      const explicit = plant(after.project, TREE, { seed: 7, packing: "natural" });
      expect(explicit.summary).toBe(legacy.summary);
      expect(after.map.upperTiles).toEqual(before.map.upperTiles);
      expect(after.map.lowerTiles).toEqual(before.map.lowerTiles);
    });

    it("place_props 의 단일 타일 경로도 dense 를 지켜 영역을 봉쇄한다", () => {
      // 간격을 요구한 자연 산포는 반드시 빈칸을 남긴다.
      const natural = createProject();
      const naturalResult = plant(natural.project, BOX, { minGap: 2 });
      const dense = createProject();
      const denseResult = plant(dense.project, BOX, { packing: "dense", minGap: 2 });
      const naturalPlaced = Number(data(naturalResult).placed);
      const densePlaced = Number(data(denseResult).placed);
      expect(densePlaced, `dense=${densePlaced} natural=${naturalPlaced}`).toBeGreaterThan(naturalPlaced);
      // 1칸 소품이 12×12 를 빈틈 없이 덮는다 — 통행 칸 0.
      expect(densePlaced).toBe(AREA.w * AREA.h);
      expect(passableCellCount(dense.project, dense.map, AREA)).toBe(0);
      expect(passableCellCount(natural.project, natural.map, AREA)).toBeGreaterThan(0);
      expect(denseResult.summary).toContain("빈틈 없이 배치");
      expect(denseResult.summary).toContain("완전 차단");
    });

    it("잘못된 packing 값은 거부한다", () => {
      const scatterTool = PLACEMENT_TOOLS.find((entry) => entry.name === "scatter_object");
      if (!scatterTool) throw new Error("scatter_object tool missing");
      const { project, map } = createProject();
      expect(() => scatterTool.run(project, { mapId: map.id, presetId: "x", paletteRole: "y", area: { ...AREA }, count: 4, packing: "packed" }))
        .toThrow(/packing/);
    });
  });
});

describe("placePropsAdversarialHardening", () => {
  isolateTimers();
  // 합본 마을 타일 번호·재료(돌벽=12, 팻말, 침엽수)를 겨냥한 시험 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵은 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
  const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
  const MAP_ID = "map_blank_start";
  function tileCounts(map: { width: number; height: number; lowerTiles: readonly number[]; upperTiles: readonly number[] }, tileId: number): number {
    let count = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        if (map.lowerTiles[index] === tileId || map.upperTiles[index] === tileId) count += 1;
      }
    }
    return count;
  }
  describe("place_props adversarial hardening", () => {
    it("단일 타일로 해석되는 수역 재료(물)도 소품 산포를 거절한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const before = tileCounts(ctx.project.maps[MAP_ID], 0);
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "물", count: 4 });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("material-not-prop");
      expect(tileCounts(ctx.project.maps[MAP_ID], 0)).toBe(before);
    });

    it("단일 타일로 해석되는 벽 재료(돌벽→타일 12·role=wall)도 소품 산포를 거절한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "돌벽", count: 4 });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("material-not-prop");
    });

    it("단일 타일 경로의 0배치는 영역을 넓혀 재시도하고 그 사실을 경고로 남긴다", () => {
      // 2026-09-18: 요청 영역이 꽉 차면 placement-zero 로 거부하던 것을, 2칸씩 최대 3번 넓혀 놓는다.
      const ctx: ToolContext = { project: createBlankProject() };
      const map = ctx.project.maps[MAP_ID];
      for (let y = 2; y < 8; y += 1) {
        for (let x = 2; x < 8; x += 1) map.upperTiles[y * map.width + x] = 288;
      }
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "팻말", count: 4 });
      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("넓힘");
      expect((result.diff?.warnings ?? []).some((w) => w.includes("놓을 자리가 없어") && w.includes("넓혀"))).toBe(true);
    });

    it("맵을 다 채워 넓혀도 자리가 없으면 여전히 placement-zero 실패다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const map = ctx.project.maps[MAP_ID];
      map.upperTiles.fill(288);
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "팻말", count: 4 });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("placement-zero");
    });

    it("맵 밖 영역은 tile_erase 오진단이 아니라 영역 밖 실패다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: -40, y: -40, w: 6, h: 6 }, material: "키큰 풀", count: 4 });
      expect(result.ok).toBe(false);
      expect(`${result.summary}`).toContain("밖입니다");
      expect(`${result.summary}`).not.toContain("tile_erase");
    });

    it("도메인 직접 호출의 맵 밖 영역은 placement-zero로 영역 밖을 말한다", () => {
      const project = createBlankProject();
      expect(() => placePropsOnDraft(project, { mapId: MAP_ID, area: { x: -40, y: -40, w: 6, h: 6 }, material: "덤불", count: 4 }))
        .toThrowError(/밖에 있습니다/);
      try {
        placePropsOnDraft(project, { mapId: MAP_ID, area: { x: -40, y: -40, w: 6, h: 6 }, material: "덤불", count: 4 });
        expect.unreachable();
      } catch (error) {
        expect((error as { code?: string }).code).toBe("placement-zero");
        expect(`${(error as Error).message}`).not.toContain("tile_erase");
      }
    });

    it("맵을 삐져나가는 영역은 거절된다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 13, y: 11, w: 10, h: 6 }, material: "키큰 풀", count: 4 });
      expect(result.ok).toBe(false);
    });

    it("count 0·음수는 거절된다", () => {
      const zero: ToolContext = { project: createBlankProject() };
      expect(runTool(zero, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "키큰 풀", count: 0 }).ok).toBe(false);
      const negative: ToolContext = { project: createBlankProject() };
      expect(runTool(negative, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "키큰 풀", count: -3 }).ok).toBe(false);
    });

    it("trunkVisible·origins는 사일런트 드롭 대신 거절된다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 2, y: 2, w: 10, h: 10 },
        material: "침엽수",
        count: 4,
        trunkVisible: true,
        origins: [{ x: 2, y: 2 }],
      });
      expect(result.ok).toBe(false);
      expect(`${result.summary}`).toContain("trunkVisible");
    });

    it("소품 재료(덤불)는 그대로 산포한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 10, h: 10 }, material: "덤불", count: 4 });
      expect(result.ok, result.summary).toBe(true);
      expect(tileCounts(ctx.project.maps[MAP_ID], TILE.EMPTY)).toBeLessThan(ctx.project.maps[MAP_ID].width * ctx.project.maps[MAP_ID].height);
    });
  });
});

describe("placePropsSparseWork", () => {
  isolateTimers();
  function everyPredicateVisits(run: () => void): number {
    const original = Array.prototype.every;
    let visits = 0;
    const observer = vi.spyOn(Array.prototype, "every").mockImplementation(function (this: unknown[], predicate, thisArg) {
      return original.call(this, (value, index, array) => {
        visits += 1;
        return predicate.call(thisArg, value, index, array);
      });
    });
    try { run(); } finally { observer.mockRestore(); }
    return visits;
  }
  function pointSomePredicateVisits(run: () => void): number {
    const original = Array.prototype.some;
    let visits = 0;
    const observer = vi.spyOn(Array.prototype, "some").mockImplementation(function (this: unknown[], predicate, thisArg) {
      return original.call(this, (value, index, array) => {
        if (typeof value === "object" && value !== null && "x" in value && "y" in value) visits += 1;
        return predicate.call(thisArg, value, index, array);
      });
    });
    try { run(); } finally { observer.mockRestore(); }
    return visits;
  }
  function fixture() {
    // 「나무 상자」(237)·TILE.GRASS·TILE.FLOWERS 는 합본 마을 칩셋 번호다 — 정리 전 빈 프로젝트처럼 그 칩셋 위에서 잰다.
    const project = withRetiredCombinedTownMaps(createBlankProject());
    const map = useRetiredCombinedTown(createBlankMap("Sparse contract", 20, 20));
    map.id = "sparse-contract";
    project.maps[map.id] = map;
    return { project, map, area: { x: 2, y: 2, w: 16, h: 16 } };
  }
  describe("zero-gap candidate work", () => {
    it.each([0, -2])("gap %s keeps the seeded permutation without pairwise predicate visits", (gap) => {
      const bounds = { x: 2, y: 2, width: 16, height: 16 };
      let actual: ReturnType<typeof poissonScatter> | undefined;
      // Observe work while preserving every actual predicate and its result.
      const visits = everyPredicateVisits(() => { actual = poissonScatter(bounds, 256, gap, mulberry32(17)); });
      expect(visits).toBe(0);
      // Distinct integer cells are already >= 1 apart. This unchanged positive-gap
      // path supplies the same full seeded order, not a second shuffle implementation.
      let reference: ReturnType<typeof poissonScatter> | undefined;
      const controlVisits = everyPredicateVisits(() => { reference = poissonScatter(bounds, 256, 1, mulberry32(17)); });
      expect(controlVisits).toBe(256 * 255 / 2);
      expect(actual).toEqual(reference);
    });

    it.each([[0, 0, 0], [3.9, 3, 0], [300, 256, 44]])(
      "request %s preserves count normalization, uniqueness and missing count", (count, placed, missing) => {
        const result = poissonScatter({ x: 0, y: 0, width: 16, height: 16 }, count, 0, mulberry32(17));
        expect(result.points).toHaveLength(placed);
        expect(new Set(result.points.map(({ x, y }) => `${x},${y}`)).size).toBe(placed);
        expect(result.missing).toBe(missing);
      },
    );
  });
  describe("sparse prop acceptance", () => {
    it("does not add quadratic accepted-point scans when minGap is zero", () => {
      const { project, map, area } = fixture();
      let result: ReturnType<typeof placePropsOnDraft> | undefined;
      const visits = pointSomePredicateVisits(() => {
        result = placePropsOnDraft(project, { mapId: map.id, area, material: "나무 상자", count: 256, minGap: 0, seed: 17 });
      });
      expect(result?.data).toMatchObject({ placed: 256, requested: 256 });
      // Includes the real in-bounds candidate scan, but not an all-pairs loop.
      expect(visits).toBeLessThanOrEqual(area.w * area.h);
    });

    it("fills every requested available slot without consuming count on obstacles", () => {
      const { project, map, area } = fixture();
      const free = [[2, 2], [2, 5], [5, 2], [5, 5]] as const;
      const freeKeys = new Set(free.map(([x, y]) => `${x},${y}`));
      for (let y = 2; y < 18; y++) for (let x = 2; x < 18; x++) {
        map.upperTiles[y * map.width + x] = freeKeys.has(`${x},${y}`) ? TILE.EMPTY : TILE.FLOWERS;
      }
      const result = placePropsOnDraft(project, { mapId: map.id, area, material: "나무 상자", count: 4, minGap: 3, seed: 17 });
      expect(result.data).toMatchObject({ placed: 4, requested: 4, tileId: 237 });
      for (let y = 2; y < 18; y++) for (let x = 2; x < 18; x++) {
        expect(map.upperTiles[y * map.width + x]).toBe(freeKeys.has(`${x},${y}`) ? 237 : TILE.FLOWERS);
        expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
      }
    });

    it("preserves minGap between accepted props and deterministic replay", () => {
      const first = fixture();
      const second = fixture();
      for (const entry of [first, second]) {
        const result = placePropsOnDraft(entry.project, { mapId: entry.map.id, area: entry.area, material: "나무 상자", count: 12, minGap: 3, seed: 17 });
        expect(result.data).toMatchObject({ placed: 12, requested: 12 });
      }
      expect(first.map.upperTiles).toEqual(second.map.upperTiles);
      const points = first.map.upperTiles.flatMap((tile, index) => tile === 237 ? [{ x: index % first.map.width, y: Math.floor(index / first.map.width) }] : []);
      expect(points).toHaveLength(12);
      for (const [index, point] of points.entries()) for (const other of points.slice(index + 1)) {
        expect((point.x - other.x) ** 2 + (point.y - other.y) ** 2).toBeGreaterThanOrEqual(9);
      }
    });
  });
});

describe("villageTreePlacement", () => {
  isolateTimers();
  // 이 시험의 칸 번호(벽 76 · 울타리 409 · 밑동 290 · 수관 260 · TILE.GRASS)와 재료 낱말 «침엽수» 는 합본 마을(combined_town) 칩셋의 것이다.
  // 2026-09-30 부터 새 프로젝트의 기본 칩셋은 버들항(beodeul_city)이고 합본 마을 정의는 2026-10-07 정리로 새 프로젝트에서 빠졌다 —
  // 버들항의 나무는 구조 킷(stamp_object)이라 «침엽수» 라벨 타일이 없고 76·409 도 벽·울타리가 아니다. 그래서 열 경우가 모두
  // material-not-found 로 끝났다(공개 기준선 0d4f13e7c 부터). 옛 저장본처럼 시작 맵을 합본 마을 위에 놓고 본다(#3560 이 같은 갈래 시험들을 옮긴 방식).
  const combinedTownProject = () => startOnRetiredCombinedTown(createBlankProject());
  // A single candidate proves rejection happens before either half is written.
  // No runner rollback or cleanup can conceal a partial tree here.
  describe.each(["natural", "dense"] as const)("tree footprint eligibility (%s)", (packing) => {
    it.each(["canopy over wall", "trunk over fence", "recorded stacked house", "recorded empty house"])("rejects the whole object: %s", (obstacle) => {
      const project = combinedTownProject();
      const map = project.maps.map_blank_start;
      const top = 3 * map.width + 3;
      const bottom = top + map.width;
      if (obstacle === "canopy over wall") map.lowerTiles[top] = 76;
      if (obstacle === "trunk over fence") map.upperTiles[bottom] = 409;
      if (obstacle === "recorded stacked house") map.lowerTileStacks = { [top]: [TILE.GRASS, 76] };
      if (obstacle.startsWith("recorded")) map.layoutPlan = {
        version: 1, kind: "houses", regions: [{ id: "house", role: "house", x: 3, y: 3, w: 1, h: 1 }],
      };
      const before = structuredClone(map);
      expect(() => placePropsOnDraft(project, {
        // expandArea:false — 이 검사는 "그 자리 적격성" 이다. 기본값(확장)이면 옆 칸에 놓여 검사 뜻이 사라진다.
        mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7, packing, expandArea: false,
      })).toThrowError(expect.objectContaining({ code: "placement-zero" }));
      expect(map).toEqual(before);
      expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
    });

    it("keeps legitimate canopy-over-trunk forest overlap", () => {
      const project = combinedTownProject();
      const map = project.maps.map_blank_start;
      const top = 3 * map.width + 3;
      map.lowerTiles[top] = 290;
      map.upperTiles[top - map.width] = 260;
      const result = placePropsOnDraft(project, {
        mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7, packing,
      });
      expect(result.data).toMatchObject({ placed: 1 });
      expect(map.lowerTiles[top]).toBe(290);
      expect(map.upperTiles[top]).toBe(260);
      expect(map.lowerTiles[top + map.width]).toBe(290);
      expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
    });
  });
});
