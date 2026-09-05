import { describe, expect, it } from "vitest";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageTool";
import { buildVillageDomain, inspectVillageBuild } from "@/editor/tools/villageBuilder";
import { captureHouseProtection, type HouseSnapshot } from "@/editor/tools/houseProtection";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { createExistingProject, runFacade, EXISTING_TARGET } from "./authorVillageFacadeFixtures";

describe("village producer completion through toolRunner", () => {
  it.each([false, true])("retains sealed layers and stacks after global repair (snow=%s)", (snow) => {
    const project = snow ? createEmptyToolProject("winter city") : createExistingProject();
    let sealed: HouseSnapshot[] = [];
    const tool = createAuthorVillageTool({
      build(draft, args) {
        // Observe the real producer boundary; do not replace any generation stage.
        const result = buildVillageDomain(draft, args);
        sealed = captureHouseProtection(draft);
        return result;
      },
      inspect: inspectVillageBuild,
    });
    const args = snow ? {
      target: { kind: "new", mapId: "map_winter_city", name: "Winter City", width: 100, height: 100 },
      houseCount: 20, npcCount: 50, groundTheme: "snow", settlementLayout: "street-grid", seed: 41,
    } : { target: EXISTING_TARGET, houseCount: 4, seed: 7 };
    const result = runFacade(project, { ...args, countPolicy: "exact", interior: false }, tool);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    expect(sealed).toHaveLength(snow ? 20 : 4);
    expect(captureHouseProtection(project)).toEqual(sealed);
    // A second repair must not grow another canopy into a just-completed house.
    const reloaded = JSON.parse(JSON.stringify(project));
    repairTreePairsOnProject(reloaded);
    expect(captureHouseProtection(reloaded)).toEqual(sealed);
  }, 90_000);
});
