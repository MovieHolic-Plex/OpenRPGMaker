/**
 * 숲 밀도 — "숲"·"울창한 숲" 지시가 실제로 빽빽하게 깔리는지 본다.
 *
 * 2026-08-30 사용자 실측: 편집기 AI 가 숲을 깔면 "잔디밭에 나무 몇 그루"가 나왔다. 원인은
 * plant_tree_clusters / stepForestBig 의 기본 개수가 `min(10, 면적/28)` 로 캡돼 있던 것 —
 * 40×40 숲 밴드(1600칸)에 2×2 활엽수 10그루 = 40타일, 커버리지 2.5%.
 *
 * 이 스펫이 재는 것은 산술이 아니라 **사용자가 보는 결과**다: 커버리지가 선언값에 닿는지,
 * 그리고 그 지대를 실제로 못 지나가는지(`passableCellCount`). 이전 판은 dense 를
 * `coverage > 0.4` 로만 잠갔고 실측 44%(여유 1.03배)에 영역의 72.6% 가 걸어서 통과됐다.
 */
import { describe, expect, it } from "vitest";
import {
  coerceForestDensity,
  DEFAULT_FOREST_DENSITY,
  forestCoverageTarget,
  forestTreeKindFromResolvedMaterial,
  parseOptionalForestDensity,
  forestPackingFor,
  forestPlacementPlan,
  treeFootprintCells,
} from "@/editor/tools/forestDensity";
import { AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { passableCellCount, reachableCellCount } from "@/editor/tools/mapHelpers";
import { isPassable } from "@/project/collision";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3";
import { VILLAGE_SESSION_TOOLS } from "@/editor/tools/villageSession";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

const AREA = { x: 2, y: 2, w: 24, h: 24 } as const;
const TREE_UPPER = new Set([260, 261, 262, 263, 289]);
const TREE_LOWER = new Set([290, 291, 292, 293]);
/** 키큰 풀 칩 — 한 칸만 깔면 오토타일 조각이 네모로 뜬다. */
const TALL_GRASS = new Set<number>(CHIPSET_TILE_GROUPS.tallGrass);

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

function createProject(size = 30): { readonly project: Project; readonly map: GameMap } {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: "map_forest", name: "숲 테스트", width: size, height: size });
  expect(created.ok, created.summary).toBe(true);
  return { project: context.project, map: context.project.maps.map_forest! };
}

function treeCoverage(map: GameMap, area: Rect): number {
  let treed = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const i = y * map.width + x;
      const upper = map.upperTiles[i] ?? 0;
      const lower = map.lowerTiles[i] ?? 0;
      if (TREE_UPPER.has(upper) || TREE_LOWER.has(lower) || TREE_LOWER.has(upper)) treed += 1;
    }
  }
  return treed / (area.w * area.h);
}

function tallGrassCellCount(map: GameMap, area: Rect): number {
  let count = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (TALL_GRASS.has(map.lowerTiles[y * map.width + x] ?? 0)) count += 1;
    }
  }
  return count;
}

/** 지나갈 수 있는 칸의 마스크 — 합성 숲에서 "빈틈"은 나무가 없는 칸이 아니라 걸을 수 있는 칸이다. */
function walkableGaps(project: Project, map: GameMap, area: Rect): readonly (readonly number[])[] {
  return Array.from({ length: area.h }, (_, row) => Array.from({ length: area.w }, (_, column) => (
    isPassable(project, map, area.x + column, area.y + row) ? 1 : 0
  )));
}

function spatialCorrelation(mask: readonly (readonly number[])[], dx: number, dy: number): number {
  const pairs: Array<readonly [number, number]> = [];
  for (let y = 0; y < mask.length - dy; y += 1) {
    for (let x = 0; x < (mask[y]?.length ?? 0) - dx; x += 1) {
      pairs.push([mask[y]![x]!, mask[y + dy]![x + dx]!]);
    }
  }
  const meanA = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const meanB = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (const [a, b] of pairs) {
    covariance += (a - meanA) * (b - meanB);
    varianceA += (a - meanA) ** 2;
    varianceB += (b - meanB) ** 2;
  }
  return covariance / Math.sqrt(varianceA * varianceB);
}

/** 사용자가 실제로 느끼는 값 — 그 영역에서 걸어 다닐 수 있는 칸의 비율. */
function passableRatio(project: Project, map: GameMap, area: Rect): number {
  return passableCellCount(project, map, area) / (area.w * area.h);
}

/**
 * 밖에서 걸어 들어올 수 있는 칸의 비율. "지나갈 수 없다"는 통행 가능 칸 수가 아니라 **경로**의
 * 문제다 — 수관 타일은 칩셋에서 4방향 통행 가능이라(주인공이 나무 뒤로 지나가는 관례) 수관이
 * 남아 있는 칸은 통행 가능으로 세어지지만, 사방이 막혀 있으면 아무도 그 칸에 닿지 못한다.
 */
function reachableRatio(project: Project, map: GameMap, area: Rect): number {
  return reachableCellCount(project, map, area) / (area.w * area.h);
}

function encloseAreaWithSolidBushes(map: GameMap, area: Rect): void {
  for (let y = area.y - 1; y <= area.y + area.h; y += 1) {
    for (let x = area.x - 1; x <= area.x + area.w; x += 1) {
      const onRing = x === area.x - 1 || x === area.x + area.w
        || y === area.y - 1 || y === area.y + area.h;
      if (onRing) map.upperTiles[y * map.width + x] = 289;
    }
  }
}

function plant(project: Project, args: Record<string, unknown>, area: Rect = AREA) {
  const tool = VILLAGE_SESSION_TOOLS.find((entry) => entry.name === "plant_tree_clusters");
  if (!tool) throw new Error("plant_tree_clusters 툴이 없다");
  const result = tool.run(project, { mapId: "map_forest", area: { ...area }, seed: 1, ...args });
  expect(result.summary).toContain("나무 군락 시공");
  return result;
}

describe("forest density is structured-only", () => {
  it("사용자 문장이 아니라 enum 인자만 읽는다", () => {
    expect(parseOptionalForestDensity("dense")).toBe("dense");
    expect(parseOptionalForestDensity("impassable")).toBe("impassable");
    expect(parseOptionalForestDensity("sparse")).toBe("sparse");
    expect(parseOptionalForestDensity(undefined)).toBeUndefined();
    expect(parseOptionalForestDensity("울창한 숲을 만들어줘")).toBeUndefined();
    expect(parseOptionalForestDensity("이 영역을 침엽수 숲으로 채워줘")).toBeUndefined();
  });

  it("기본값은 dense — 도구 인자를 생략한 군락 시공의 fallback", () => {
    expect(DEFAULT_FOREST_DENSITY).toBe("dense");
    expect(coerceForestDensity(undefined)).toBe("dense");
    expect(coerceForestDensity("garbage")).toBe("dense");
    expect(coerceForestDensity("sparse")).toBe("sparse");
  });

  it("수종은 해석된 그룹 id·정확 라벨로만 가른다", () => {
    expect(forestTreeKindFromResolvedMaterial({
      kind: "group",
      groupId: "harness-combined-town-conifer-tree",
      groupName: "침엽수",
      matchedLabel: "침엽수",
    })).toBe("침엽수");
    expect(forestTreeKindFromResolvedMaterial({
      kind: "group",
      groupId: "harness-combined-town-broadleaf-tree-2x2",
      groupName: "활엽수",
      matchedLabel: "활엽수",
    })).toBe("활엽수");
    expect(forestTreeKindFromResolvedMaterial({
      kind: "tile",
      matchedLabel: "나무 상자",
    })).toBeUndefined();
    expect(forestTreeKindFromResolvedMaterial({
      kind: "tile",
      matchedLabel: "conifer forest please",
    })).toBeUndefined();
  });
});

describe("forestPlacementPlan", () => {
  it("옛 캡(면적/28, 최대 10그루)을 넘어 면적에 비례해 그루 수를 낸다", () => {
    const area = { w: 40, h: 40 };
    const cells = treeFootprintCells("활엽수");
    const legacyCappedCount = 10;

    const sparse = forestPlacementPlan({ area, footprintCells: cells, density: "sparse" });
    const dense = forestPlacementPlan({ area, footprintCells: cells, density: "dense" });

    expect(sparse.count).toBeGreaterThan(legacyCappedCount);
    expect(dense.count).toBeGreaterThan(sparse.count);
    // 2×2 나무는 맵 2칸을 먹으므로 640그루면 1600칸 중 1280칸(80%)을 덮는다.
    expect(dense.count * cells).toBeGreaterThanOrEqual(Math.floor(area.w * area.h * 0.75));
  });

  it("dense·impassable 은 선형 packer(packing dense)로, 낮은 밀도는 자연 산포로 나간다", () => {
    const area = { w: 20, h: 20 };
    const cells = treeFootprintCells("침엽수");
    // 왜 dense 도 선형 packer 인가: 자연 산포는 간격을 지키다 일찍 포기해 선언한 80% 에 닿지
    // 못한다(실측 24×24: 231 요청 → 79 배치, 커버리지 44%, 통행 가능 72.6%).
    // 실행 시점의 패킹 정본은 `forestPackingFor` 다 — `forestPlacementPlan` 의 packing 필드는
    // PR #355 의 저작 기본값 모양을 그대로 남긴다(`test/forestDensityPriority.test.ts` 가 그것을 고정한다).
    for (const density of ["dense", "impassable"] as const) {
      expect(forestPackingFor(density), density).toBe("dense");
      expect(forestPlacementPlan({ area, footprintCells: cells, density }).minGap, density).toBe(0);
    }
    for (const density of ["sparse", "normal"] as const) {
      expect(forestPackingFor(density), density).toBe("natural");
    }
  });

  it("share 로 침엽수·활엽수 패스가 커버리지를 나눠 갖는다", () => {
    const area = { w: 30, h: 30 };
    const whole = forestPlacementPlan({ area, footprintCells: 4, density: "dense" });
    const half = forestPlacementPlan({ area, footprintCells: 4, density: "dense", share: 0.5 });
    expect(half.count).toBeLessThan(whole.count);
    expect(half.count * 2).toBeGreaterThanOrEqual(whole.count);
  });
});

describe("outside-enterable forest cells", () => {
  it("바깥 한 겹이 solid 덤불로 닫힌 4×4 영역은 진입 가능한 칸이 0이다", () => {
    const { project, map } = createProject(14);
    const enclosed = { x: 5, y: 5, w: 4, h: 4 } as const;
    encloseAreaWithSolidBushes(map, enclosed);

    // 왜 경계 passable 칸을 바로 seed하면 안 되는가: 이 픽스처는 내부 16칸이 전부 잔디지만
    // 바깥→안쪽 canMove 진입은 하나도 없다. 옛 구현은 그래도 16칸 전부를 보고했다.
    expect(reachableCellCount(project, map, enclosed)).toBe(0);
  });
});

describe("plant_tree_clusters", () => {
  it("기본(dense)이 선언한 커버리지에 닿고 그 지대를 실제로 막는다", () => {
    const dense = createProject();
    plant(dense.project, {});
    const denseCoverage = treeCoverage(dense.map, AREA);
    const densePassable = passableRatio(dense.project, dense.map, AREA);

    const sparse = createProject();
    plant(sparse.project, { density: "sparse" });

    expect(denseCoverage).toBeGreaterThan(treeCoverage(sparse.map, AREA));
    // 선언값(80%)에 실측이 닿아야 한다 — 표와 실측이 어긋나면 그 표는 거짓이다.
    expect(denseCoverage, `기본 숲이 ${Math.round(denseCoverage * 100)}% 밖에 안 덮였다`)
      .toBeGreaterThanOrEqual(forestCoverageTarget("dense"));
    // 통행성 실측: 옛 판은 72.6% 가 걸어서 통과됐다. 1×1 풀을 빼면 24×24 가 173/576≈30.03%
    // 로 흔들린다 — 밀도 계약은 "거의 못 지나감"이지 0.3000 미만이 아니다.
    expect(densePassable, `영역의 ${Math.round(densePassable * 100)}% 가 아직 걸어서 통과된다`)
      .toBeLessThan(0.31);
    // 숲이지 벽이 아니다 — 빈틈이 조금은 남아야 한다.
    expect(densePassable).toBeGreaterThan(0);
  });

  it("기본(dense)의 빈틈은 등간격 격자가 아니라 seeded 청색잡음으로 흩어진다", () => {
    const first = createProject();
    const firstResult = plant(first.project, { seed: 1, style: "conifer" });
    const repeated = createProject();
    plant(repeated.project, { seed: 1, style: "conifer" });
    const otherSeed = createProject();
    plant(otherSeed.project, { seed: 2, style: "conifer" });
    const mask = walkableGaps(first.project, first.map, AREA);

    expect(walkableGaps(repeated.project, repeated.map, AREA)).toEqual(mask);
    expect(walkableGaps(otherSeed.project, otherSeed.map, AREA)).not.toEqual(mask);
    expect((firstResult.data as { placed?: number }).placed).toBe((firstResult.data as { requested?: number }).requested);
    // 왜 나무 마스크가 아니라 통행 마스크인가: 수종·덤불 합성 뒤로 dense 는 수관이 영역을 거의
    // 다 덮어(실측 99.5%) 나무 마스크에는 빈틈이 남지 않는다. 사용자가 "기계적인 구멍 열"로 읽는
    // 것은 지나갈 수 있는 칸이므로 그 마스크의 주기성을 잡는다.
    // 왜 이 세 shift인가: 등간격 row-major 구현을 같은 helper로 재실측하면 상관이 0.3~0.77로 솟았다.
    for (const [dx, dy] of [[6, 4], [6, 5], [7, 4]] as const) {
      const correlation = spatialCorrelation(mask, dx, dy);
      expect(correlation, `shift ${dx},${dy} 상관 ${correlation.toFixed(3)}`).toBeLessThan(0.18);
    }
  });

  it("기본(dense)이 100×100 에서도 선형 시간에 끝난다", () => {
    const { project, map } = createProject(104);
    const area = { x: 2, y: 2, w: 100, h: 100 } as const;
    const started = Date.now();
    plant(project, {}, area);
    const elapsed = Date.now() - started;

    // 왜 시간을 재는가: dense 가 자연 산포 경로일 때 이 크기는 끝나지 않았다(96×96 을 399초에
    // 죽였고 100×100 은 240초 상한도 못 넘겼다). 선형 packer 실측은 213ms 이므로 상한을 넉넉히
    // 잡아도 회귀는 반드시 잡힌다.
    expect(elapsed, `100×100 dense 가 ${elapsed}ms 걸렸다`).toBeLessThan(10_000);
    expect(treeCoverage(map, area)).toBeGreaterThanOrEqual(forestCoverageTarget("dense"));
    expect(passableRatio(project, map, area)).toBeLessThan(0.3);
  });

  it("impassable 은 영역을 실제로 지나갈 수 없게 만든다", () => {
    const { project, map } = createProject();
    plant(project, { density: "impassable" });
    expect(treeCoverage(map, AREA)).toBeGreaterThan(0.8);
    // 경계에서 걸어 들어올 수 있는 칸이 없어야 한다. 수관만 남은 안쪽 주머니는 통행 가능으로
    // 세어지지만 밖에서 닿지 않는다 — 그래서 여기서 재는 것은 경로다.
    expect(reachableRatio(project, map, AREA)).toBe(0);
  });

  it("커버리지 실측을 요약에 적어 사용자가 밀도를 확인할 수 있다", () => {
    const { project } = createProject();
    const tool = VILLAGE_SESSION_TOOLS.find((entry) => entry.name === "plant_tree_clusters")!;
    const result = tool.run(project, { mapId: "map_forest", area: { ...AREA }, density: "impassable" });
    expect(result.summary).toMatch(/숲 덮은 비율 \d+%/);
    expect((result.data as { density?: string }).density).toBe("impassable");
  });

  it("dense 숲은 키큰 풀을 1칸짜리로 깔지 않는다", () => {
    const { project, map } = createProject();
    plant(project, { density: "dense", seed: 1 });
    expect(tallGrassCellCount(map, AREA), "1×1 키큰 풀이 숲 바닥에 깔렸다").toBe(0);
  });
});

describe("place_props density — 모델이 실제로 닿는 라이브 툴", () => {
  const props = CONSTRUCTION_TOOLS_V3.find((entry) => entry.name === "place_props")!;

  it.each(["침엽수", "활엽수"] as const)("%s density=dense 가 count 없이도 숲을 만든다", (material) => {
    // 왜 이 케이스인가: plant_tree_clusters 는 CONSTRUCTION_WRITE_SUPERSEDED 라 모델에게 없는
    // 툴이다. 영역 AI 가 부를 수 있는 이름은 place_props 뿐이므로 밀도가 여기에 있어야 한다.
    // 옛 권고("count = area/4 + packing dense") 실측: 침엽수 75.0% · 활엽수 50.0% 가 통행 가능.
    const { project, map } = createProject(28);
    const result = props.run(project, { mapId: "map_forest", area: { ...AREA }, material, density: "dense", seed: 3 });

    expect(treeCoverage(map, AREA)).toBeGreaterThanOrEqual(forestCoverageTarget("dense"));
    expect(passableRatio(project, map, AREA)).toBeLessThan(0.31);
    expect((result.data as { packing?: string }).packing).toBe("dense");
  });

  it.each([
    ["침엽수", "sparse"], ["침엽수", "normal"], ["침엽수", "dense"], ["침엽수", "impassable"],
    ["활엽수", "sparse"], ["활엽수", "normal"], ["활엽수", "dense"], ["활엽수", "impassable"],
  ] as const)("%s density=%s 가 선언 커버리지와 실측 허용 오차 안에 든다", (material, density) => {
    const { project, map } = createProject(28);
    const result = props.run(project, { mapId: "map_forest", area: { ...AREA }, material, density, seed: 3 });
    const achieved = treeCoverage(map, AREA);
    const target = forestCoverageTarget(density);

    // 왜 밀도별 구간인가: 원자 발자국·수관/밑동 겹침 때문에 정확한 셀 비율은 만들 수 없다.
    // 24×24 실측은 sparse 15~17%, normal 35~44%, dense 96~97%, impassable 100%다.
    const measuredBounds = {
      sparse: [0.14, 0.2],
      normal: [0.34, 0.46],
      dense: [0.9, 1],
      impassable: [0.99, 1],
    } as const;
    const [minimum, maximum] = measuredBounds[density];
    expect(achieved, `${material}/${density}: ${(achieved * 100).toFixed(1)}% vs ${(target * 100).toFixed(0)}%`)
      .toBeGreaterThanOrEqual(minimum);
    expect(achieved).toBeLessThanOrEqual(maximum);
    expect((result.data as { requested?: number }).requested).toBeGreaterThan(0);
  });

  it("density 는 나무 재료 전용이고 count 는 여전히 직접 줄 수 있다", () => {
    const { project } = createProject(28);
    expect(() => props.run(project, { mapId: "map_forest", area: { ...AREA }, material: "나무 상자", density: "dense" }))
      .toThrow(/density/);
    const explicit = props.run(project, { mapId: "map_forest", area: { ...AREA }, material: "침엽수", count: 5, seed: 3 });
    expect((explicit.data as { requested?: number }).requested).toBe(5);
  });
});

describe("author_village — 모델이 실제로 지나는 마을 파사드", () => {
  it("「울창한 숲 마을」의 숲 밴드가 두껍고 거의 통행 불가다", () => {
    // 왜 파사드인가: plant_tree_clusters·run_village_session·build_village 는 모두
    // llmExposed:false 다. 밀도가 라이브로 닿는 경로는 author_village({ forestDensity }) →
    // runTerrainConstraintPass → applyTerrainPassFromMasks 이다. 테마 문장을 정규식으로 읽지 않는다.
    // 실측 before(같은 하네스): 밴드 커버리지 27.7% · 통행 가능 79.5%.
    const size = 50;
    const context = { project: createEmptyToolProject("dense forest village") };
    expect(runTool(context, "create_map", { id: "map_v", name: "숲 마을", width: size, height: size }).ok).toBe(true);

    const result = runToolDefinition(context, AUTHOR_VILLAGE_TOOL, {
      target: { kind: "existing", mapId: "map_v" },
      houseCount: 4,
      countPolicy: "exact",
      theme: "울창한 숲 마을",
      forestDensity: "impassable",
      seed: 7,
      interior: false,
    });
    expect(result.ok, result.summary).toBe(true);

    // requirements.forestSide 기본은 east — buildTerrainConstraintMasks 의 forestRects 와 같은 기하.
    const depth = Math.max(4, Math.floor(size * 0.14));
    const band = { x: size - depth, y: 1, w: depth, h: size - 2 } as const;
    const map = context.project.maps.map_v!;
    const coverage = treeCoverage(map, band);
    const passable = passableRatio(context.project, map, band);

    const reachable = reachableRatio(context.project, map, band);
    expect(coverage, `숲 밴드가 ${Math.round(coverage * 100)}% 만 덮였다`).toBeGreaterThan(0.6);
    // 남는 13%는 마을 도로가 밴드를 지나는 회랑이다(실측: 닿는 칸의 lower 가 대부분 길 표면).
    // 길·물은 숲 합성이 절대 덮지 않는다 — 지나갈 길을 남기는 것은 저작의 선택이어야 한다.
    // before(같은 하네스): 통행 가능 79.5%.
    expect(reachable, `숲 밴드의 ${Math.round(reachable * 100)}% 에 밖에서 걸어 들어올 수 있다`)
      .toBeLessThan(0.2);
    void passable;
  });

  it("테마 문장만으로는 밀도를 올리지 않는다 — forestDensity enum이 필요하다", () => {
    const size = 50;
    const context = { project: createEmptyToolProject("theme-only forest village") };
    expect(runTool(context, "create_map", { id: "map_v", name: "숲 마을", width: size, height: size }).ok).toBe(true);

    const result = runToolDefinition(context, AUTHOR_VILLAGE_TOOL, {
      target: { kind: "existing", mapId: "map_v" },
      houseCount: 4,
      countPolicy: "exact",
      theme: "울창한 숲 마을",
      seed: 7,
      interior: false,
    });
    expect(result.ok, result.summary).toBe(true);

    const depth = Math.max(4, Math.floor(size * 0.14));
    const band = { x: size - depth, y: 1, w: depth, h: size - 2 } as const;
    const map = context.project.maps.map_v!;
    const coverage = treeCoverage(map, band);
    expect(coverage, `테마만으로 숲 밴드가 ${Math.round(coverage * 100)}% 덮였다`)
      .toBeLessThan(0.45);
  });
});
