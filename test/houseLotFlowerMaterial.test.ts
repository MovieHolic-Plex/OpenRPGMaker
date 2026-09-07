import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";

it("builds a flower-yard house using the actual bundled flower material", () => {
  // Given a real empty map and the bundled material catalog.
  const context = { project: createBlankProject() };
  const mapId = "flower-yard-regression";
  expect(runTool(context, "create_map", { id: mapId, name: "Flower yard", width: 32, height: 24 }).ok).toBe(true);
  const map = context.project.maps[mapId];
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  // When the high-level producer chooses its own material from a semantic yard tag.
  const result = runTool(context, "author_house", {
    kind: "lots", mapId, seed: 7,
    houses: [{ kitId: "bright-plaster", wings: [{ x: 6, y: 4, w: 8, h: 6 }], door: true, interior: "exterior-only", yard: ["flowers"] }],
  });
  // Then the whole construction succeeds and real flower tiles appear in the yard.
  expect(result.ok, result.summary).toBe(true);
  const built = context.project.maps[mapId];
  expect(built.upperTiles.some(tile => tile === 288 || tile === 348)).toBe(true);
});
