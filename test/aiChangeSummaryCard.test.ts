import { describe, expect, it } from "vitest";
import { changeCountsLine, changedSinceRun, listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

type MapEvent = GameMap["events"][number];
const npc = (id: string, x: number, y: number, name = id): MapEvent => ({ id, name, x, y, pages: [] } as unknown as MapEvent);

function seed(): Project {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 12, height: 10 });
  if (!result.ok) throw new Error(result.summary);
  const map = ctx.project.maps.map_east!;
  return { ...ctx.project, maps: { ...ctx.project.maps, map_east: { ...map, events: [npc("ev_a", 1, 1, "촌장")] } } };
}

function withMap(project: Project, mapId: string, patch: Partial<GameMap>): Project {
  return { ...project, maps: { ...project.maps, [mapId]: { ...project.maps[mapId]!, ...patch } } };
}

describe("listChangeItems", () => {
  it("separates a map's tiles from its events and counts by kind", () => {
    const before = seed();
    const map = before.maps.map_east!;
    const tiles = [...map.lowerTiles]; tiles[5] = 9;
    const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
    const items = listChangeItems(before, after);
    expect(items.map((item) => `${item.kind}:${item.change}:${item.id}`)).toEqual(["map:modified:map_east", "event:modified:ev_a", "event:added:ev_b"]);
    expect(changeCountsLine(items)).toBe("맵 1 · 이벤트 2");
  });

  it("reports a new map once and its events", () => {
    const before = seed();
    const after = { ...before, maps: { ...before.maps, map_new: { ...before.maps.map_east!, id: "map_new", name: "숲속 마을" } } } as Project;
    const items = listChangeItems(before, after);
    expect(items.filter((item) => item.mapId === "map_new").map((item) => `${item.kind}:${item.change}`)).toEqual(["map:added", "event:added"]);
  });
});

describe("revertChangeItem", () => {
  it("puts one moved event back and leaves the other change alone", () => {
    const before = seed();
    const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
    const items = listChangeItems(before, after);
    const moved = items.find((item) => item.id === "ev_a")!;
    const next = revertChangeItem(after, before, moved);
    expect(next.maps.map_east!.events.map((event) => [event.id, event.x, event.y])).toEqual([["ev_a", 1, 1], ["ev_b", 2, 2]]);
  });

  it("removes an added event and an added map", () => {
    const before = seed();
    const after = { ...withMap(before, "map_east", { events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }),
      maps: { ...before.maps, map_east: { ...before.maps.map_east!, events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }, map_new: { ...before.maps.map_east!, id: "map_new" } } } as Project;
    const items = listChangeItems(before, after);
    const noEvent = revertChangeItem(after, before, items.find((item) => item.id === "ev_b")!);
    expect(noEvent.maps.map_east!.events.map((event) => event.id)).toEqual(["ev_a"]);
    const noMap = revertChangeItem(noEvent, before, items.find((item) => item.kind === "map" && item.id === "map_new")!);
    expect(Object.keys(noMap.maps)).not.toContain("map_new");
  });

  it("restores map tiles while keeping the map's current events", () => {
    const before = seed();
    const tiles = [...before.maps.map_east!.lowerTiles]; tiles[3] = 7;
    const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 6, 6, "촌장")] });
    const item = listChangeItems(before, after).find((entry) => entry.kind === "map")!;
    const next = revertChangeItem(after, before, item);
    expect(next.maps.map_east!.lowerTiles[3]).toBe(before.maps.map_east!.lowerTiles[3]);
    expect(next.maps.map_east!.events[0]!.x).toBe(6);
  });
});

describe("changedSinceRun", () => {
  it("notices a hand edit made after the run", () => {
    const before = seed();
    const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장")] });
    const item = listChangeItems(before, after)[0]!;
    expect(changedSinceRun(item, after, after)).toBe(false);
    expect(changedSinceRun(item, after, withMap(after, "map_east", { events: [npc("ev_a", 5, 4, "촌장")] }))).toBe(true);
  });
});
