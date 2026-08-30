/**
 * 숲 밀도 — "숲"·"울창한 숲" 지시가 실제로 빽빽하게 깔리는지 본다.
 *
 * 2026-08-30 사용자 실측: 편집기 AI 가 숲을 깔면 "잔디밭에 나무 몇 그루"가 나왔다. 원인은
 * plant_tree_clusters / stepForestBig 의 기본 개수가 `min(10, 면적/28)` 로 캡돼 있던 것 —
 * 40×40 숲 밴드(1600칸)에 2×2 활엽수 10그루 = 40타일, 커버리지 2.5%.
 */
import { describe, expect, it } from "vitest";
import {
  coerceForestDensity,
  DEFAULT_FOREST_DENSITY,
  forestDensityFromText,
  forestPlacementPlan,
  treeFootprintCells,
} from "@/editor/tools/forestDensity";
import { VILLAGE_SESSION_TOOLS } from "@/editor/tools/villageSession";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

const AREA = { x: 2, y: 2, w: 24, h: 24 } as const;
const TREE_UPPER = new Set([260, 261, 262, 263, 289]);
const TREE_LOWER = new Set([290, 291, 292, 293]);

function createProject(): { readonly project: Project; readonly map: GameMap } {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: "map_forest", name: "숲 테스트", width: 30, height: 30 });
  expect(created.ok, created.summary).toBe(true);
  return { project: context.project, map: context.project.maps.map_forest! };
}

function treeCoverage(map: GameMap, area: typeof AREA): number {
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

function plant(project: Project, args: Record<string, unknown>): void {
  const tool = VILLAGE_SESSION_TOOLS.find((entry) => entry.name === "plant_tree_clusters");
  if (!tool) throw new Error("plant_tree_clusters 툴이 없다");
  const result = tool.run(project, { mapId: "map_forest", area: { ...AREA }, ...args });
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

  it("impassable 만 packing dense(간격 0)로 나간다", () => {
    const area = { w: 20, h: 20 };
    const cells = treeFootprintCells("침엽수");
    expect(forestPlacementPlan({ area, footprintCells: cells, density: "dense" }).packing).toBe("natural");
    const impassable = forestPlacementPlan({ area, footprintCells: cells, density: "impassable" });
    expect(impassable.packing).toBe("dense");
    expect(impassable.minGap).toBe(0);
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
  it("기본(dense)이 옛 기본보다 훨씬 두껍게 깔린다", () => {
    const dense = createProject();
    plant(dense.project, {});
    const denseCoverage = treeCoverage(dense.map, AREA);

    const sparse = createProject();
    plant(sparse.project, { density: "sparse" });
    const sparseCoverage = treeCoverage(sparse.map, AREA);

    expect(denseCoverage).toBeGreaterThan(sparseCoverage);
    expect(denseCoverage, `기본 숲이 ${Math.round(denseCoverage * 100)}% 밖에 안 덮였다`).toBeGreaterThan(0.4);
  });

  it("impassable 은 영역을 거의 통행 불가로 만든다", () => {
    const { project, map } = createProject();
    plant(project, { density: "impassable" });
    expect(treeCoverage(map, AREA)).toBeGreaterThan(0.8);
  });

  it("커버리지 실측을 요약에 적어 사용자가 밀도를 확인할 수 있다", () => {
    const { project } = createProject();
    const tool = VILLAGE_SESSION_TOOLS.find((entry) => entry.name === "plant_tree_clusters")!;
    const result = tool.run(project, { mapId: "map_forest", area: { ...AREA }, density: "impassable" });
    expect(result.summary).toMatch(/나무 덮은 비율 \d+%/);
    expect((result.data as { density?: string }).density).toBe("impassable");
  });
});
