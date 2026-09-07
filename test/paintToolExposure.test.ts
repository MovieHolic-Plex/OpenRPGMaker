import { describe, expect, it } from "vitest";
import { activeTools, runTool, toOpenAiTools } from "@/editor/tools";
import { planRequiredToolSchemas } from "@/ai/planToolExposure";
import { buildOrchestratorUserPayload, workPlanFromOrchestratorDecision } from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";

describe("precise tile painting is an active capability", () => {
  it("exposes the required paint operation instead of substituting semantic fill", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan", goal: "Paint a verified atlas tile",
      layers: [{ title: "Terrain", items: [{ title: "Paint", instruction: "Paint the inspected tile", successTools: ["paint_tiles"] }] }],
    });
    expect(planRequiredToolSchemas(plan).map(tool => tool.function.name)).toContain("paint_tiles");
    expect(toOpenAiTools().map(tool => tool.function.name)).toContain("paint_tiles");
    expect(activeTools().some(tool => tool.name === "fill_region")).toBe(true);
  });

  it("can paint actual snow atlas cells on a blank map", () => {
    const context = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const result = runTool(context, "paint_tiles", {
      mapId, layer: "lower", mode: "rect", tile: 67, from: { x: 2, y: 2 }, to: { x: 8, y: 8 },
    });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    expect(context.project.tilesets[map.tilesetId].terrain[map.lowerTiles[4 * map.width + 4]]).toBe(3);
  });

  it("does not advertise hidden legacy names as canonical planner capabilities", () => {
    const payload = buildOrchestratorUserPayload({ userText: "Inspect the map", activePlan: null });
    expect(payload).not.toContain("clear_region");
    expect(payload).toContain("paint_tiles");
  });
});
