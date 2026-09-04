import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import {
  countMarketCells,
  evaluateVillageLook,
} from "@/editor/tools/villageEvaluate";
import { inferRequirementsFromQuery } from "@/editor/tools/villageRequirements";
import type { ToolContext } from "@/editor/tools/types";

function build(theme: string, seed = 7): { context: ToolContext; mapId: string } {
  const context: ToolContext = { project: createEmptyToolProject(`hard gate ${theme}`) };
  const result = runTool(context, "build_village", { theme, seed });
  expect(result.ok, result.summary).toBe(true);
  const mapId = (result.data as { mapId: string }).mapId;
  expect(typeof mapId).toBe("string");
  return { context, mapId };
}

describe("첫 plan 필수요소 hard 게이트", () => {
  it("장터 테마는 장터 소품을 실측으로 보장한다", () => {
    const { context, mapId } = build("장터 마을");
    const map = context.project.maps[mapId]!;
    expect(countMarketCells(map)).toBeGreaterThanOrEqual(3);
  });

  it("농촌 테마 look 평가는 farm 충족 여부를 requirementsMet에 싣는다", () => {
    const { context, mapId } = build("농촌 마을");
    const plan = inferRequirementsFromQuery("농촌 마을");
    expect(plan.landmarks).toContain("farm");
    const report = evaluateVillageLook({
      project: context.project,
      mapId,
      plan: {
        version: 1,
        id: "vplan_test",
        theme: "농촌 마을",
        requirements: plan,
        pathStyle: "dirt",
        kitMix: "mixed",
        yardStyle: "garden",
        plazaStyle: "garden",
        edgeTrees: "dense",
        plazaLayout: "center",
        houses: [],
        npcs: [],
        fences: false,
        decor: false,
        interior: false,
        seed: 7,
        buildOrder: ["plan", "map", "settlement"],
        summary: "test",
      },
    });
    const farm = report.requirementsMet?.find((entry) => entry.kind === "farm");
    expect(farm).toBeTruthy();
  });
});
