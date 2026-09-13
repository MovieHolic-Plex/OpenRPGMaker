import { beforeAll, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { VR } from "@/editor/interiorRoomPipeline";
import { checkReachability } from "@/project/lint/reachability";
import type { GameMap, Project } from "@/project/types";

let project: Project;
beforeAll(() => {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "place_concept", { template: true, query: "inn", mapId: "architecture_inn", seed: 7 }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  expect([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])]).toEqual([]);
  project = ctx.project;
});

function floor(level: number): GameMap {
  const map = project.maps[`architecture_inn${level > 1 ? `_${level}f` : ""}`];
  if (!map) throw new Error("Inn floor missing");
  return map;
}

it("continues the horizontal stair flight through both wall-face rows", () => {
  const map = floor(1);
  const stairs = map.events.find(event => event.id.includes("_main_stair_"));
  if (!stairs) throw new Error("Main stair missing");
  for (const y of [stairs.y - 2, stairs.y - 1, stairs.y]) {
    expect(map.lowerTiles.slice(y * map.width + stairs.x - 1, y * map.width + stairs.x + 2)).toEqual([141, 111, 171]);
  }
});

it("puts windows on the upper wall face instead of at floor height", () => {
  let windows = 0;
  for (const level of [1, 2, 3]) {
    const map = floor(level);
    map.upperTiles.forEach((tile, index) => {
      if (tile !== VR.WINDOW) return;
      windows++;
      expect([74, 75, 76, 77]).toContain(map.lowerTiles[index]);
    });
  }
  expect(windows).toBeGreaterThanOrEqual(5);
});

it("keeps the lightly furnished single room at its authored small footprint", () => {
  const facility = SCRATCH_INN_BUNDLE.facilities[0];
  if (!facility) throw new Error("Inn missing");
  const layout = layoutConceptFacility(SCRATCH_INN_BUNDLE, facility, { level: 2 });
  const single = layout.rooms.find(room => room.placeId === "single");
  expect(single && [single.w, single.h]).toEqual([5, 3]);
  const dorm = layout.rooms.find(room => room.placeId === "dorm");
  expect(dorm && dorm.w * dorm.h).toBeLessThanOrEqual(28);
});

it("uses interior stair landings instead of turning every floor entrance into stairs", () => {
  for (const level of [2, 3]) {
    const map = floor(level);
    const descent = map.events.find(event => event.id === `ev_entrance_${map.id}`);
    const stamp = map.roomHarnessPlan as { plan: { door: { x: number; y: number } } };
    if (!descent) throw new Error("Descent missing");
    expect([descent.x, descent.y]).not.toEqual([stamp.plan.door.x, stamp.plan.door.y]);
    expect(map.upperTiles[descent.y * map.width + descent.x]).toBe(474);
    expect(map.upperTiles.filter(tile => tile === 474 || tile === 475)).toHaveLength(1);
    expect(map.lowerTiles).not.toContain(444);
  }
});

it("keeps upper-wall inspection events reachable from the floor", () => {
  for (const level of [1, 2, 3]) {
    const map = floor(level);
    const entry = map.events.find(event => event.id === `ev_entrance_${map.id}`);
    if (!entry) throw new Error("Entry missing");
    const result = checkReachability(project, map.id, { x: entry.x, y: entry.y + (level === 1 ? -1 : 1) }, map.events);
    expect(result.unreachable).toEqual([]);
  }
});
