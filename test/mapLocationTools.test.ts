import { describe, expect, it } from "vitest";
import { getTool, runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { mapLocations } from "@/project/mapNamedLocations";
import type { GameMap, MapLayoutPlan, Project } from "@/project/types";

const MAP_ID = "tool_loc_map";

function context(layoutPlan?: MapLayoutPlan): ToolContext {
  const project: Project = createBlankProject();
  const map: GameMap = {
    id: MAP_ID,
    name: "툴 로케이션 맵",
    width: 24,
    height: 24,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(24 * 24).fill(TILE.GRASS),
    upperTiles: new Array(24 * 24).fill(TILE.EMPTY),
    events: [],
    ...(layoutPlan ? { layoutPlan } : {}),
  };
  project.maps[MAP_ID] = map;
  return { project };
}

describe("assistant map-location tools", () => {
  it("registers the read and write tools with the expected modes", () => {
    expect(getTool("list_map_locations")?.mode).toBe("read");
    expect(getTool("resolve_map_location")?.mode).toBe("read");
    expect(getTool("create_map_location")?.mode).toBe("write");
    expect(getTool("update_map_location")?.mode).toBe("write");
    expect(getTool("delete_map_location")?.mode).toBe("write");
    expect(getTool("adopt_layout_regions")?.mode).toBe("write");
  });

  it("creates a location and lists it back without the user restating coordinates", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", {
      mapId: MAP_ID,
      name: "정문 광장",
      x: 4,
      y: 4,
      w: 6,
      h: 6,
      note: "성문 앞",
    });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);

    const listed = runTool(ctx, "list_map_locations", { mapId: MAP_ID });
    expect(listed.ok).toBe(true);
    const locations = (listed.data as { locations: { id: string; name: string; note?: string }[] }).locations;
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ name: "정문 광장", x: 4, y: 4, w: 6, h: 6, note: "성문 앞" });
  });

  it("resolves by human name, by partial name and by point", () => {
    const ctx = context();
    runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "광장 안 좌판", x: 5, y: 5, w: 2, h: 2 });

    const byName = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, query: "정문 광장" });
    expect(byName.ok).toBe(true);
    expect((byName.data as { location: { name: string } }).location.name).toBe("정문 광장");

    const byPoint = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, x: 5, y: 5 });
    // 겹칠 때는 가장 구체적인(작은) 구역이 이긴다.
    expect((byPoint.data as { location: { name: string } }).location.name).toBe("광장 안 좌판");

    const miss = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, query: "없는 곳" });
    expect(miss.ok).toBe(false);
  });

  it("renaming through the tool keeps the stable id so references survive", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    const id = (created.data as { location: { id: string } }).location.id;
    const renamed = runTool(ctx, "update_map_location", { mapId: MAP_ID, locationId: "정문 광장", name: "중앙 광장" });
    expect(renamed.ok, JSON.stringify(renamed.issues)).toBe(true);
    expect((renamed.data as { location: { id: string; name: string } }).location).toMatchObject({ id, name: "중앙 광장" });
  });

  it("refuses to delete a referenced location unless the caller states a repair plan", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    const id = (created.data as { location: { id: string } }).location.id;
    ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

    const refused = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id });
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(refused.issues)).toContain("brokenReferences");
    // 거부된 호출은 아무것도 바꾸지 않는다.
    expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(1);
    expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(id);
  });

  it("deletes with detach and leaves the encounter intact but unrestricted", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    const id = (created.data as { location: { id: string } }).location.id;
    ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

    const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id, brokenReferences: "detach" });
    expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
    expect((deleted.data as { repaired: number }).repaired).toBe(1);
    expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(0);
    expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions).toBeUndefined();
  });

  it("deletes with freezeRect and demotes the encounter to the legacy raw rectangle", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    const id = (created.data as { location: { id: string } }).location.id;
    ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

    const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id, brokenReferences: "freezeRect" });
    expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
    expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions).toEqual({ region: { x: 4, y: 4, w: 6, h: 6 } });
  });

  it("deletes with remap and repoints the encounter at another location", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    const other = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "북쪽 숲", x: 14, y: 2, w: 6, h: 6 });
    const id = (created.data as { location: { id: string } }).location.id;
    const otherId = (other.data as { location: { id: string } }).location.id;
    ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

    const deleted = runTool(ctx, "delete_map_location", {
      mapId: MAP_ID,
      locationId: id,
      brokenReferences: "remap",
      replacementLocationId: otherId,
    });
    expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
    expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(otherId);
  });

  it("deletes an unreferenced location outright", () => {
    const ctx = context();
    const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
    const id = (created.data as { location: { id: string } }).location.id;
    const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id });
    expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
    expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(0);
  });

  it("adopt_layout_regions copies builder regions and leaves layoutPlan byte-identical", () => {
    const plan: MapLayoutPlan = {
      version: 1,
      kind: "village-harness-natural-v2",
      regions: [
        { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
        { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
      ],
    };
    const ctx = context(structuredClone(plan));
    const first = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID, roles: ["house"] });
    expect(first.ok, JSON.stringify(first.issues)).toBe(true);
    expect(mapLocations(ctx.project.maps[MAP_ID]).map((entry) => entry.name)).toEqual(["파랑 지붕 집"]);
    expect(ctx.project.maps[MAP_ID].layoutPlan).toEqual(plan);

    const again = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID, roles: ["house"] });
    expect(again.ok).toBe(true);
    expect((again.data as { adopted: unknown[]; skipped: string[] }).skipped).toEqual(["house-a"]);
    expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(1);
  });

  it("adopt_layout_regions refuses a map that was not produced by the builder", () => {
    const ctx = context();
    const result = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("layoutPlan");
  });

  it("find_layout_regions still only sees builder regions, not the human layer", () => {
    const plan: MapLayoutPlan = {
      version: 1,
      kind: "village-harness-natural-v2",
      regions: [{ id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 }],
    };
    const ctx = context(structuredClone(plan));
    runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "사람이 그린 구역", x: 1, y: 1, w: 3, h: 3 });
    const found = runTool(ctx, "find_layout_regions", { mapId: MAP_ID, query: "시장" });
    const regions = (found.data as { regions: { label: string }[] }).regions;
    expect(regions.map((region) => region.label)).toEqual(["중앙 시장"]);
  });
});
