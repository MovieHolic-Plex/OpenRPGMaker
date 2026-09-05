import { describe, expect, it } from "vitest";
import { getTool, runTool, ToolError } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";

function fixture() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 24;
  map.height = 20;
  map.lowerTiles = Array(map.width * map.height).fill(TILE.GRASS);
  map.upperTiles = Array(map.width * map.height).fill(TILE.EMPTY);
  const tileset = project.tilesets[map.tilesetId];
  const at = (x: number, y: number) => y * map.width + x;
  const args = { mapId: map.id, id: "ev_dungeon_chest_east", x: 19, y: 6, contents: { gold: 100 } };
  return { project, map, tileset, at, args };
}

describe("treasure chest surface placement", () => {
  it("rejects the observed shoreline coordinate without requiring a prior tile query", () => {
    const { project, map, at, args } = fixture();
    // QA's (19,6): water, with reachable grass immediately north and east.
    for (const [x, y] of [[18, 5], [18, 6], [19, 6], [18, 7], [19, 7]]) {
      map.lowerTiles[at(x, y)] = TILE.WATER;
    }
    expect(isPassable(project, map, 19, 6)).toBe(false);
    expect(isPassable(project, map, 19, 5)).toBe(true);
    expect(isPassable(project, map, 20, 6)).toBe(true);
    const ctx = { project };

    const result = runTool(ctx, "place_chest", args);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chest-on-water", mapId: map.id, x: 19, y: 6 }),
    ]));
    expect(result.summary).toContain("물 위");
    expect(ctx.project).toBe(project);
    expect(map.events).toHaveLength(0);
  });

  it("still rejects exposed water when an author makes its passage open", () => {
    const { project, map, tileset, at, args } = fixture();
    map.lowerTiles[at(19, 6)] = TILE.WATER;
    tileset.passability[TILE.WATER] = passableFlag();
    expect(isPassable(project, map, 19, 6)).toBe(true);

    expect(() => getTool("place_chest")!.run(project, args)).toThrow(/물 위/);
    expect(map.events).toHaveLength(0);
  });

  it("allows a walkable bridge over water but not a star overlay", () => {
    const { project, map, tileset, at, args } = fixture();
    map.lowerTiles[at(19, 6)] = TILE.WATER;
    map.upperTiles[at(19, 6)] = TILE.PATH;
    tileset.passability[TILE.PATH] = passableFlag();
    tileset.priority[TILE.PATH] = "upper";
    expect(() => getTool("place_chest")!.run(project, args)).toThrow(/물 위/);
    expect(map.events).toHaveLength(0);

    tileset.priority[TILE.PATH] = "lower";
    const result = getTool("place_chest")!.run(project, args);
    expect(result.data).toMatchObject({ x: 19, y: 6, adjusted: false });
    expect(map.events[0].pages?.[0].commands).toContainEqual({ kind: "changeGold", op: "+=", amount: 100 });
  });

  it("uses the current tileset's water role instead of treating every tile 120 as water", () => {
    const { project, map, tileset, at, args } = fixture();
    const importedId = "tiles_imported";
    tileset.id = importedId;
    project.tilesets[importedId] = tileset;
    map.tilesetId = importedId;
    tileset.tileGroups = [];
    tileset.tileMeta = {
      [TILE.PATH]: { label: "수면", description: "", role: "water" },
      [TILE.WATER]: { label: "벽감", description: "", role: "wall" },
    };
    tileset.passability[TILE.PATH] = blockedFlag();
    map.lowerTiles[at(19, 6)] = TILE.PATH;
    expect(() => getTool("place_chest")!.run(project, args)).toThrow(/물 위/);

    map.lowerTiles[at(19, 6)] = TILE.WATER;
    const result = getTool("place_chest")!.run(project, args);
    expect(result.data).toMatchObject({ x: 19, y: 6, adjusted: false });
  });

  it("does not let automatic landing pick an exposed passable water tile", () => {
    const { project, map, tileset, at, args } = fixture();
    for (let y = 5; y <= 7; y++) {
      for (let x = 18; x <= 20; x++) map.lowerTiles[at(x, y)] = TILE.WALL;
    }
    map.lowerTiles[at(18, 5)] = TILE.WATER;
    tileset.passability[TILE.WATER] = passableFlag();

    let error: unknown;
    try { getTool("place_chest")!.run(project, args); }
    catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ToolError);
    expect(error).toMatchObject({ code: "chest-on-water", x: 18, y: 5 });
    expect(map.events).toHaveLength(0);
  });
});
