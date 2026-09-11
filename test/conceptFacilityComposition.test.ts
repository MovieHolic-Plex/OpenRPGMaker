import { describe, expect, it } from "vitest";
import { ensureConceptBundles, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { CONCEPT_FACILITY_TEMPLATES, SCRATCH_HOUSE_BUNDLE } from "@/project/defaults/conceptFacilityTemplates";
import type { GameMap } from "@/project/types";
import { isPassable } from "@/project/collision";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";

function build(query: string, seed = 7) {
  const context = { project: createBlankProject() };
  const result = runTool(context, "place_concept", {
    query, mapId: "quality", seed,
  }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  const map = context.project.maps.quality;
  if (!map) throw new Error("Missing generated map");
  return { map, result, project: context.project };
}

function objectOrigins(map: GameMap, id: string) {
  const object = interiorObjectById(id);
  if (!object) throw new Error(`Missing catalog object ${id}`);
  const origins: { x: number; y: number }[] = [];
  for (let y = 0; y <= map.height - object.height; y += 1) {
    for (let x = 0; x <= map.width - object.width; x += 1) {
      if (object.cells.every((cell) =>
        map[object.snap !== "wall-any" && cell.layer === "lower" ? "lowerTiles" : "upperTiles"][(y + cell.dy) * map.width + x + cell.dx] === cell.tile)) {
        origins.push({ x, y });
      }
    }
  }
  return origins;
}

describe("facility furniture composition", () => {
  it("places the house dining table on its rug without occupying the entrance lane", () => {
    // Given the public house template with a dining table and a rug.
    const facility = SCRATCH_HOUSE_BUNDLE.facilities[0];
    if (!facility) throw new Error("Missing house facility");
    const layout = layoutConceptFacility(SCRATCH_HOUSE_BUNDLE, facility);
    // When the real assistant construction tool builds it.
    const { map } = build("민가");
    // Then the intact table belongs to the rug, rather than sitting next to an empty rug.
    const rugs = objectOrigins(map, "rug_mat");
    const tables = objectOrigins(map, "table_chairs");
    expect(tables.some((table) => rugs.some((rug) =>
      table.x >= rug.x && table.x + 3 <= rug.x + 3
      && table.y >= rug.y && table.y < rug.y + 3))).toBe(true);
    for (const table of tables) {
      expect(table.x <= layout.door.x && table.x + 3 > layout.door.x).toBe(false);
    }
  });

  it("keeps warehouse stock in interior rows with a continuous central aisle", () => {
    const bundle = CONCEPT_FACILITY_TEMPLATES.find((entry) => entry.id === "warehouse");
    const facility = bundle?.facilities[0];
    if (!bundle || !facility) throw new Error("Missing warehouse");
    const layout = layoutConceptFacility(bundle, facility);
    const room = layout.rooms[0];
    if (!room) throw new Error("Missing stockroom");
    const { map, project } = build("창고");
    const crates = objectOrigins(map, "crate");
    expect(crates).toHaveLength(6);
    expect(crates.every(({ x, y }) =>
      x > room.x && x < room.x + room.w - 1
      && y > room.y && y < room.y + room.h - 1)).toBe(true);
    for (let y = room.y; y < room.y + room.h; y += 1) {
      const upper = map.upperTiles[y * map.width + layout.door.x];
      expect(upper).toBeLessThan(0);
      expect(isPassable(project, map, layout.door.x, y)).toBe(true);
    }
    const openingY = layout.door.y + 1;
    expect(map.upperTiles[openingY * map.width + layout.door.x]).toBe(176);
    expect(isPassable(project, map, layout.door.x, openingY)).toBe(true);
  });

  it("preserves authored furniture omissions during lookup and subsequent construction", () => {
    const context = { project: createBlankProject() };
    ensureConceptBundles(context.project);
    const bundles = context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles;
    const house = bundles?.find((entry) => entry.id === "house");
    if (!house) throw new Error("Missing authored house");
    house.things = house.things.filter((thing) => thing.objectId !== "table_chairs");
    const authored = structuredClone(bundles);
    runTool(context, "get_concept_facility", { query: "민가" }, { dryRun: false });
    expect(context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual(authored);
    const result = runTool(context, "place_concept", { query: "민가", mapId: "edited", seed: 7 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.edited;
    if (!map) throw new Error("Missing authored house map");
    expect(objectOrigins(map, "table_chairs")).toEqual([]);
  });

  it("keeps authored loot reachable when nine crates form a warehouse stock group", () => {
    const context = { project: createBlankProject() };
    const result = runTool(context, "place_concept", {
      query: "창고", mapId: "stock", seed: 7,
      plan: {
        places: [{ id: "hall", role: "entrance", size: "l", floor: "plank" }],
        things: Array.from({ length: 9 }, (_, index) => ({
          id: `crate_${index}`, objectId: "crate", placeIds: ["hall"],
          chips: index === 4 ? ["block", "loot"] : ["block"],
        })),
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.stock;
    if (!map) throw new Error("Missing warehouse");
    const event = map.events.find((entry) => entry.id.includes("_crate_4_"));
    if (!event) throw new Error("Missing authored loot event");
    const door = map.events.find((entry) => entry.pages?.[0]?.name === "입구");
    if (!door) throw new Error("Missing warehouse entrance");
    // Use the shipped collision contract: the new entrance marker is passable,
    // even though its upper-layer tile is not empty.
    const reachable = computeReachableCells(context.project, map, door.x, door.y - 1);
    expect(isAdjacentOrOn(reachable, event.x, event.y)).toBe(true);
    expect(objectOrigins(map, "crate")).toHaveLength(9);
  });

  for (const bundle of CONCEPT_FACILITY_TEMPLATES.filter((entry) => entry.id !== "inn")) {
    for (const seed of [7, 19, 31]) {
      it(`${bundle.id}: keeps complete required furniture in every intended room, seed ${seed}`, () => {
        const facility = bundle.facilities[0];
        if (!facility) throw new Error("Missing facility");
        const layout = layoutConceptFacility(bundle, facility);
        const { map, result, project } = build(facility.label, seed);
        expect(isPassable(project, map, layout.door.x, layout.door.y - 1)).toBe(true);
        const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
        expect(warnings.filter((line) => /자리 없음|walkability:|plan:/.test(line))).toEqual([]);
        for (const thing of bundle.things.filter((entry) => entry.required)) {
          const object = interiorObjectById(thing.objectId);
          if (!object) throw new Error("Missing required furniture definition");
          const origins = objectOrigins(map, thing.objectId);
          for (const room of layout.rooms.filter((entry) => thing.placeIds.includes(entry.placeId))) {
            expect(origins.some(({ x, y }) =>
              x >= room.x && x + object.width <= room.x + room.w
              && y >= room.y - 2 && y + object.height <= room.y + room.h),
            `${room.id}: ${thing.objectId}`).toBe(true);
          }
        }
      });
    }
    it(`${bundle.id}: offers a buildable reference plan without replacing the live template`, () => {
      const facility = bundle.facilities[0];
      if (!facility) throw new Error("Missing facility");
      const context = { project: createBlankProject() };
      const lookup = runTool(context, "get_concept_facility", { query: facility.label }, { dryRun: false });
      expect(lookup.ok).toBe(true);
      const data = lookup.data;
      if (!data || typeof data !== "object" || !("variants" in data) || !Array.isArray(data.variants)) {
        throw new Error("Missing design variants");
      }
      expect(data.variants.length).toBeGreaterThan(0);
      for (const variant of data.variants) {
        const result = runTool(context, "place_concept", {
          query: facility.label, mapId: `variant_${variant.id}`, plan: variant.plan, seed: 7,
        }, { dryRun: false });
        expect(result.ok, result.summary).toBe(true);
        const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
        expect(warnings.filter((line) => /자리 없음|walkability:|plan:/.test(line))).toEqual([]);
      }
    });
  }
});
