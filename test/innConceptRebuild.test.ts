import { expect, it } from "vitest";
import { SCRATCH_INN_BUNDLE as bundle } from "@/project/defaults/scratchInnBundle";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { VR } from "@/editor/interiorRoomPipeline";
import { deserialize, serialize } from "@/project/io";
import { conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";

it("separates accommodation from ground-floor food preparation and one reception transaction", () => {
  const facility = bundle.facilities[0];
  if (!facility) throw new Error("Inn facility missing");
  expect(conceptFacilityLevels(bundle, facility)).toEqual([1, 2, 3]);
  expect(bundle.things.filter(thing => thing.chips.includes("sleep")).map(thing => thing.id)).toEqual(["front_desk"]);
  expect(bundle.things.some(thing => thing.chips.includes("loot") || ["piano", "armor", "display"].includes(thing.objectId))).toBe(false);
  expect(bundle.places.filter(place => place.level === 2 && place.role === "room").map(place => place.id)).toEqual(["dorm", "merchant", "single", "suite"]);
});

for (const seed of [1, 7, 19, 42, 99]) it(`inn seed ${seed}: distinct rooms and one reception transaction survive save/load`, () => {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "place_concept", { query: "inn", mapId: "inn_rebuild", seed }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  expect([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])]).toEqual([]);
  const project = deserialize(serialize(ctx.project));
  const upper = project.maps.inn_rebuild_2f;
  const ground = project.maps.inn_rebuild;
  const facility = bundle.facilities[0];
  if (!upper || !ground || !facility) throw new Error("Built inn missing");
  const rooms = layoutConceptFacility(bundle, facility, { level: 2 }).rooms;
  for (const room of rooms.filter(room => ["dorm", "merchant", "single", "suite"].includes(room.placeId))) {
    const tiles: number[] = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      tiles.push(upper.upperTiles[y * upper.width + x] ?? -1);
    }
    const verticalBeds = room.placeId === "dorm" ? 2 : room.placeId === "single" ? 1 : 0;
    const horizontalBeds = room.placeId === "merchant" || room.placeId === "suite" ? 1 : 0;
    expect(tiles.filter(tile => tile === VR.BED_V_HEAD)).toHaveLength(verticalBeds);
    expect(tiles.filter(tile => tile === VR.BED_V_FOOT)).toHaveLength(verticalBeds);
    expect(tiles.filter(tile => tile === VR.BED_L)).toHaveLength(horizontalBeds);
  }
  const inns = Object.values(project.maps).flatMap(map => map.events)
    .filter(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)].some(command => command.kind === "inn"));
  expect(inns).toHaveLength(1);
  expect(ground.events).toContain(inns[0]);
});
