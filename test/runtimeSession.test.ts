import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { getMapTile, setMapTileOverride, startSession } from "@/project/session";

describe("runtime session map overrides", () => {
  it("keeps project map tile arrays unchanged while session overrides resolve at runtime", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const originalLower = [...map.lowerTiles];
    const session = startSession(project);

    setMapTileOverride(session, mapId, "lower", 0, TILE.WATER);

    expect(project.maps[mapId].lowerTiles).toEqual(originalLower);
    expect(getMapTile(session, mapId, "lower", map, 0)).toBe(TILE.WATER);
    expect(map.lowerTiles[0]).toBe(originalLower[0]);
  });
});
