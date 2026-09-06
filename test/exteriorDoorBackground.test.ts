import { describe, expect, it } from "vitest";
import { stampFootprintHouseKit } from "@/editor/houseKit";
import { HOUSE_DOOR_CHARSET_TEXTURE } from "@/editor/houseInteriors";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { upsertHouseDoorEvents } from "@/editor/tools/houseKitDraftSupport";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { GameMap } from "@/project/types";

function expectDoorBackground(map: GameMap, x: number, y: number) {
  for (const row of [y - 1, y]) {
    const index = row * map.width + x;
    expect(map.lowerTiles[index]).toBe(359);
    expect(map.upperTiles[index]).toBe(-1);
    expect(map.lowerTileStacks?.[index]).toBeUndefined();
    expect(map.upperTileStacks?.[index]).toBeUndefined();
  }
}

function expectExteriorDoors(map: GameMap) {
  const doors = map.events.filter(event =>
    event.pages?.[0]?.graphic.sprite?.id === HOUSE_DOOR_CHARSET_TEXTURE);
  expect(doors.length).toBeGreaterThan(0);
  for (const door of doors) {
    expectDoorBackground(map, door.x, door.y);
    expect(door.pages?.[0]?.commands.some(command => command.kind === "transfer")).toBe(true);
  }
}

describe("exterior door event backing", () => {
  it.each(["single", "lots"])("author_house %s keeps two 359 cells through serialization", (kind) => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const house = {
      kitId: "bright-plaster", wings: [{ x: 2, y: 2, w: 7, h: 8 }],
      interior: "linked-interior", door: true, yard: [],
    };
    const result = runTool(ctx, "author_house", kind === "single"
      ? { kind, mapId, ...house }
      : { kind, mapId, houses: [house], seed: 7 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const reloaded = deserialize(serialize(ctx.project));
    const map = reloaded.maps[mapId];
    if (!map) throw new Error("Missing exterior map");
    expectExteriorDoors(map);
  });

  it("clears old overlays and stacked tiles without changing adjacent wall cells", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing exterior map");
    const top = 4 * map.width + 5;
    const bottom = 5 * map.width + 5;
    map.lowerTiles[top - 1] = 43;
    map.upperTiles[top] = 260;
    map.upperTiles[bottom] = 290;
    map.lowerTileStacks = { [top]: [116], [bottom]: [146] };
    map.upperTileStacks = { [top]: [260], [bottom]: [290] };
    upsertHouseDoorEvents(map, {
      eventId: "door", x: 5, y: 5, interiorMapId: "interior", kitId: "bright-plaster",
    });
    expectDoorBackground(map, 5, 5);
    expect(map.lowerTiles[top - 1]).toBe(43);
    expect(map.events.find(event => event.id === "door")).toMatchObject({ x: 5, y: 5 });
    expect(map.events.find(event => event.id === "door_step")).toMatchObject({ x: 5, y: 6 });
  });

  it("the house stamp places the event on the lower background cell", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing exterior map");
    const result = stampFootprintHouseKit(map, {
      kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 7, h: 8 }],
      doorEvent: { eventId: "door", interiorMapId: "interior" },
    });
    expect(result.ok).toBe(true);
    expectExteriorDoors(map);
  });

  it("village decoration and door restoration preserve both background cells", () => {
    const ctx = { project: createEmptyToolProject("Door backing fixture") };
    const result = runTool(ctx, "build_village", { seed: 7 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const maps = Object.values(ctx.project.maps).filter(map =>
      map.events.some(event => event.pages?.[0]?.graphic.sprite?.id === HOUSE_DOOR_CHARSET_TEXTURE));
    expect(maps.length).toBeGreaterThan(0);
    for (const map of maps) expectExteriorDoors(map);
  }, 60_000);
});
