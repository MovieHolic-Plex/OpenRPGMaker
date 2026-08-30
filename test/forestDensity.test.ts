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
  forestDensityFromText,
  forestPlacementPlan,
  treeFootprintCells,
} from "@/editor/tools/forestDensity";
import { AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { passableCellCount } from "@/editor/tools/mapHelpers";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3";
import { VILLAGE_SESSION_TOOLS } from "@/editor/tools/villageSession";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

const AREA = { x: 2, y: 2, w: 24, h: 24 } as const;
const TREE_UPPER = new Set([260, 261, 262, 263, 289]);
const TREE_LOWER = new Set([290, 291, 292, 293]);

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

/** 사용자가 실제로 느끼는 값 — 그 영역에서 걸어 다닐 수 있는 칸의 비율. */
function passableRatio(project: Project, map: GameMap, area: Rect): number {
  return passableCellCount(project, map, area) / (area.w * area.h);
}

function plant(project: Project, args: Record<string, unknown>, area: Rect = AREA): void {
  const tool = VILLAGE_SESSION_TOOLS.find((entry) => entry.name === "plant_tree_clusters");
  if (!tool) throw new Error("plant_tree_clusters 툴이 없다");
  const result = tool.run(project, { mapId: "map_forest", area: { ...area }, seed: 1, ...args });
  expect(result.summary).toContain("나무 군락 시공");
}

describe("forestDensityFromText", () => {
  it("숲 표현은 dense, 울창·빽빽·통행 불가 표현은 impassable 로 읽는다", () => {
    expect(forestDensityFromText("이 영역을 침엽수 숲으로 채워줘")).toBe("dense");
    expect(forestDensityFromText("강촌마을")).toBeUndefined();
    expect(forestDensityFromText("울창한 숲을 만들어줘")).toBe("impassable");
    expect(forestDensityFromText("빽빽한 나무로 길을 막아줘")).toBe("impassable");
    expect(forestDensityFromText("나무를 드문드문 심은 숲")).toBe("sparse");
  });

  it("기본값은 dense — '숲'이라는 말 자체가 빽빽함을 뜻한다", () => {
    expect(DEFAULT_FOREST_DENSITY).toBe("dense");
    expect(coerceForestDensity(undefined)).toBe("dense");
    expect(coerceForestDensity("garbage")).toBe("dense");
    expect(coerceForestDensity("sparse")).toBe("sparse");
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
    // 왜 dense 도 dense packer 인가: 자연 산포는 간격을 지키다 일찍 포기해 선언한 80% 에 닿지
    // 못한다(실측 24×24: 231 요청 → 79 배치, 커버리지 44%, 통행 가능 72.6%).
    for (const density of ["dense", "impassable"] as const) {
      const plan = forestPlacementPlan({ area, footprintCells: cells, density });
      expect(plan.packing, density).toBe("dense");
      expect(plan.minGap, density).toBe(0);
    }
    for (const density of ["sparse", "normal"] as const) {
      expect(forestPlacementPlan({ area, footprintCells: cells, density }).packing, density).toBe("natural");
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
    // 통행성 실측(실측 19.8%): 옛 판은 72.6% 가 걸어서 통과됐다.
    expect(densePassable, `영역의 ${Math.round(densePassable * 100)}% 가 아직 걸어서 통과된다`)
      .toBeLessThan(0.3);
    // 숲이지 벽이 아니다 — 빈틈이 조금은 남아야 한다.
    expect(densePassable).toBeGreaterThan(0);
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

  it("impassable 은 영역을 거의 통행 불가로 만든다", () => {
    const { project, map } = createProject();
    plant(project, { density: "impassable" });
    expect(treeCoverage(map, AREA)).toBeGreaterThan(0.8);
    expect(passableRatio(project, map, AREA)).toBeLessThan(0.25);
  });

  it("커버리지 실측을 요약에 적어 사용자가 밀도를 확인할 수 있다", () => {
    const { project } = createProject();
    const tool = VILLAGE_SESSION_TOOLS.find((entry) => entry.name === "plant_tree_clusters")!;
    const result = tool.run(project, { mapId: "map_forest", area: { ...AREA }, density: "impassable" });
    expect(result.summary).toMatch(/나무 덮은 비율 \d+%/);
    expect((result.data as { density?: string }).density).toBe("impassable");
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
    expect(passableRatio(project, map, AREA)).toBeLessThan(0.3);
    expect((result.data as { packing?: string }).packing).toBe("dense");
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
    // llmExposed:false 다. 사용자 문구가 밀도로 이어지는 유일한 실경로가 author_village →
    // runTerrainConstraintPass → applyTerrainPassFromMasks 이다.
    // 실측 before(같은 하네스): 밴드 커버리지 27.7% · 통행 가능 79.5%.
    const size = 50;
    const context = { project: createEmptyToolProject("dense forest village") };
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

    // requirements.forestSide 기본은 east — buildTerrainConstraintMasks 의 forestRects 와 같은 기하.
    const depth = Math.max(4, Math.floor(size * 0.14));
    const band = { x: size - depth, y: 1, w: depth, h: size - 2 } as const;
    const map = context.project.maps.map_v!;
    const coverage = treeCoverage(map, band);
    const passable = passableRatio(context.project, map, band);

    expect(coverage, `숲 밴드가 ${Math.round(coverage * 100)}% 만 덮였다`).toBeGreaterThan(0.6);
    expect(passable, `숲 밴드의 ${Math.round(passable * 100)}% 가 걸어서 통과된다`).toBeLessThan(0.3);
  });
});
