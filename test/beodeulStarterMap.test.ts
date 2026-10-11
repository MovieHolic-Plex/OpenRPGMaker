import { describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

const seenProjects = vi.hoisted(() => [] as Project[]);

vi.mock("@/editor/tools/toolRunner", () => ({
  runTool: vi.fn((ctx: { project: Project }, name: string) => {
    seenProjects.push(ctx.project);
    if (name === "create_map") {
      ctx.project.maps.map_beodeul = {
        id: "map_beodeul",
        name: "버들 마을",
        width: 40,
        height: 30,
        tileSize: 16,
        tilesetId: DEFAULT_TILESET_ID,
        lowerTiles: new Array(40 * 30).fill(0),
        upperTiles: new Array(40 * 30).fill(-1),
        events: [],
      };
      return { ok: true, data: { mapId: "map_beodeul" } };
    }
    return { ok: true, data: { columns: [{ x: 0, w: 20 }], bands: [{ y: 0, h: 10 }] } };
  }),
}));

const { createBeodeulStarterMap } = await import("@/editor/content/beodeulStarterMap");

describe("beodeul starter map", () => {
  it("authors against a map-only context without cloning the full preset", () => {
    seenProjects.length = 0;
    const tileset = { id: DEFAULT_TILESET_ID, name: "버들항", tileSize: 16 } as Project["tilesets"][string];
    const project = {
      tilesets: { [DEFAULT_TILESET_ID]: tileset },
      maps: {},
      mapTree: { mapId: "", children: [] },
      startMapId: "",
      startPos: { x: 0, y: 0 },
    } as Project;

    const starter = createBeodeulStarterMap(project, "버들 마을");

    expect(starter?.map.id).toBe("map_beodeul");
    expect(seenProjects).toHaveLength(3);
    expect(seenProjects[0]?.tilesets[DEFAULT_TILESET_ID]).toBe(tileset);
    expect(project.maps).toEqual({});
    expect(project.mapTree).toEqual({ mapId: "", children: [] });
  });
});
