import { describe, expect, it } from "vitest";
import { VR } from "@/editor/interiorRoomPipeline";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

function villageInteriors(seed: number): GameMap[] {
  const context: ToolContext = { project: createEmptyToolProject("probe") };
  const result = runTool(context, "author_village", {
    target: { kind: "new", mapId: "m", name: "m", width: 64, height: 40 },
    houseCount: 8, seed, morphology: "street", countPolicy: "exact", forestDensity: "normal",
    theme: "눈 덮인 항구 마을", npcCount: 0,
  });
  expect(result.ok, result.summary).toBe(true);
  return Object.values(context.project.maps).filter((map) => map.id.startsWith("map_house_interior"));
}

describe("village house interiors — cabinet base", () => {
  it("keeps the floor under a cabinet: the mostly transparent base chip rides on the upper layer", () => {
    let cabinets = 0;
    for (const map of villageInteriors(2)) {
      expect(map.lowerTiles.filter((tile) => tile === VR.CABINET_L), map.id).toEqual([]);
      map.upperTiles.forEach((tile, index) => {
        if (tile !== VR.CABINET_L) return;
        cabinets += 1;
        // The base stands on a floor tile, directly under the cabinet body.
        expect(map.lowerTiles[index - map.width], map.id).toBe(VR.CABINET_U);
        expect([72, 73, 12, 13, 42, 43, 102, 103]).toContain(map.lowerTiles[index]);
      });
    }
    expect(cabinets).toBeGreaterThan(0);
  }, 60_000);
});
