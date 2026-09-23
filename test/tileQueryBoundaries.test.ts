import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

function context(): ToolContext {
  const project = createBlankProject();
  const start = project.maps[project.startMapId];
  const base = project.tilesets[DEFAULT_TILESET_ID];
  for (const [id, count] of [["tiles_start", 2], ["tiles_target", 3], ["tiles_explicit", 1]] as const) {
    project.tilesets[id] = {
      ...structuredClone(base), id, count, tilesPerRow: 1,
      tileMeta: [], tileGroups: [], terrain: Array(count).fill(0),
    };
  }
  start.tilesetId = "tiles_start";
  project.maps.map_target = { ...structuredClone(start), id: "map_target", tilesetId: "tiles_target" };
  return { project };
}

describe.each([
  { ask: "similar", startTiles: [1], targetTiles: [1, 2], explicitTiles: [] },
  { ask: "unclassified", startTiles: [0, 1], targetTiles: [0, 1, 2], explicitTiles: [0] },
])("tile_query $ask selectors", ({ ask, startTiles, targetTiles, explicitTiles }) => {
  it("uses the target map's distinct tileset without an explicit tileset", () => {
    const ctx = context();
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "tile_query", { ask, mapId: "map_target", tileId: 0 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ tilesetId: "tiles_target", tiles: targetTiles });
    expect(ctx.project).toEqual(before);
  });

  it("uses the start map's tileset when selectors are omitted", () => {
    const result = runTool(context(), "tile_query", { ask, tileId: 0 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ tilesetId: "tiles_start", tiles: startTiles });
  });

  it("lets an explicit tileset override the target and start maps", () => {
    const result = runTool(context(), "tile_query", {
      ask, tileId: 0, mapId: "map_target", tilesetId: "tiles_explicit",
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ tilesetId: "tiles_explicit", tiles: explicitTiles });
  });

  it("does not replace a target map's missing tileset with the start tileset", () => {
    const ctx = context();
    ctx.project.maps.map_target.tilesetId = "tiles_missing";
    const result = runTool(ctx, "tile_query", { ask, tileId: 0, mapId: "map_target" });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "tileset-not-found" }));
  });
});

describe.each(["similar", "unclassified", "labels", "vocab", "unapproved"])(
  "tile_query %s explicit invalid selectors",
  (ask) => {
    it.each(["map_missing", "", "   "])("rejects mapId %j rather than browsing the start map", (mapId) => {
      const result = runTool(context(), "tile_query", { ask, tileId: 0, mapId });
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "map-not-found" }));
    });

    it.each(["tiles_missing", "", "   "])("rejects tilesetId %j even with a valid target map", (tilesetId) => {
      const result = runTool(context(), "tile_query", { ask, tileId: 0, mapId: "map_target", tilesetId });
      expect(result.ok).toBe(false);
      expect(result.data).toBeUndefined();
    });
  },
);

describe("tile_query labels filters", () => {
  it("returns zero labels for an unmatched nonempty query", () => {
    const result = runTool({ project: createBlankProject() }, "tile_query", {
      ask: "labels", query: "not-a-material-st01",
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ query: "not-a-material-st01", labels: [] });
  });

  it.each([undefined, "", "   "])("keeps bounded label browsing for query %j", (query) => {
    const ctx = context();
    ctx.project.tilesets.tiles_target.tileMeta = [
      { label: "fixture-alpha", description: "", source: "user" },
      { label: "fixture-beta", description: "", source: "user" },
    ];
    const result = runTool(ctx, "tile_query", { ask: "labels", mapId: "map_target", query, limit: 1 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({
      tilesetId: "tiles_target", labels: [{ kind: "tile", tileId: 0, label: "fixture-alpha" }],
    });
  });

  it("keeps description-only browsing when the empty query has no labeled tiles or groups", () => {
    const ctx = context();
    ctx.project.tilesets.tiles_target.tileMeta = [{ label: "", description: "fixture-detail", source: "user" }];
    const result = runTool(ctx, "tile_query", { ask: "labels", mapId: "map_target", query: "" });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ labels: [{ kind: "tile", tileId: 0, description: "fixture-detail" }] });
  });
});

// Detail/palette used to bypass the shared selector resolver and silently read DEFAULT.
describe.each(["tile_info", "palette"])("tile_query %s selector parity", ask => {
  it.each([
    [{}, "tiles_start"],
    [{ mapId: "map_target" }, "tiles_target"],
    [{ mapId: "map_target", tilesetId: "tiles_explicit" }, "tiles_explicit"],
  ])("honors selector %j", (selector, expected) => {
    const ctx = context(), before = structuredClone(ctx.project);
    const result = runTool(ctx, "tile_query", { ask, tileIds: [0], ...selector });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ tilesetId: expected });
    expect(ctx.project).toEqual(before);
  });
  it("does not fall back when an explicit map is missing", () => {
    expect(runTool(context(), "tile_query", { ask, mapId: "missing", tileIds: [0] }).ok).toBe(false);
  });
});
