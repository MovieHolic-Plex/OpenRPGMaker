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
import { describe, expect, it } from "vitest";
import { passableCellCount } from "@/editor/tools/mapHelpers";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { PLACEMENT_TOOLS } from "@/editor/tools/placementTools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolExecResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

const AREA = { x: 2, y: 2, w: 12, h: 12 } as const;
/** 2×2 활엽수 — 수관(upper) 2칸 + 밑동(lower) 2칸. 15:44 지시의 "2x2 나무" 그 자체. */
const TREE = "활엽수";
/** 문법 없는 1칸 소품 — place_props 의 단일 타일 경로를 태운다. */
const BOX = "나무 상자";

function createProject(): { readonly project: Project; readonly map: GameMap } {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: "map_dense", name: "밀집 테스트", width: 20, height: 20 });
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
