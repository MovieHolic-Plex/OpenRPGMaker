import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { runTool } from "@/editor/tools/toolRunner";
import { conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import type { GameMap } from "@/project/types";

function targets(map: GameMap): string[] {
  return map.events.flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)])
    .flatMap(command => command.kind === "transfer" ? [command.mapId] : []);
}

it("builds distinct upstairs accommodation and a reachable attic from the inn bundle", () => {
  // Given the project-owned inn definition, not a separate report-only floor plan.
  const ctx = { project: createBlankProject() };
  const facility = SCRATCH_INN_BUNDLE.facilities[0];
  if (!facility) throw new Error("Inn facility missing");
  expect(conceptFacilityLevels(SCRATCH_INN_BUNDLE, facility)).toEqual([1, 2, 3]);

  // When the real authoring tool builds it and the project is reloaded.
  const result = runTool(ctx, "place_concept", { template: true, query: "inn", mapId: "explorable_inn", seed: 7 }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  expect([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])]).toEqual([]);
  const project = deserialize(serialize(ctx.project));
  const ground = project.maps.explorable_inn;
  const upper = project.maps.explorable_inn_2f;
  const attic = project.maps.explorable_inn_3f;
  if (!ground || !upper || !attic) throw new Error("All three floors must survive reload");

  // Then both stair flights can be traversed in both directions.
  expect(targets(ground)).toContain(upper.id);
  expect(targets(upper)).toContain(ground.id);
  expect(targets(upper)).toContain(attic.id);
  expect(targets(attic)).toContain(upper.id);
  for (const floor of [upper, attic]) {
    const descent = floor.events.find(event => event.id === `ev_entrance_${floor.id}`);
    if (!descent) throw new Error("Descent missing");
    expect(floor.upperTiles[descent.y * floor.width + descent.x]).toBe(474);
  }
  const layout = layoutConceptFacility(SCRATCH_INN_BUNDLE, facility, { level: 2 });
  const guestrooms = layout.rooms.filter(room => ["dorm", "merchant", "single", "suite"].includes(room.placeId));
  expect(guestrooms).toHaveLength(4);
  expect(new Set(guestrooms.map(room => `${room.w}:${room.h}:${room.shape ?? "rect"}`)).size).toBeGreaterThanOrEqual(3);
  const inns = [ground, upper, attic].flatMap(map => map.events)
    .flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)])
    .filter(command => command.kind === "inn");
  expect(inns).toHaveLength(1);
  expect(attic.width * attic.height).toBeLessThan(upper.width * upper.height);
  expect(attic.width).toBeLessThan(upper.width);
});

it("keeps a single attic space compact without inserting an unrequested corridor", () => {
  const facility = SCRATCH_INN_BUNDLE.facilities[0];
  if (!facility) throw new Error("Inn facility missing");
  const layout = layoutConceptFacility(SCRATCH_INN_BUNDLE, facility, { level: 3 });
  expect(layout.rooms.map(room => room.placeId)).toEqual(["attic"]);
});
