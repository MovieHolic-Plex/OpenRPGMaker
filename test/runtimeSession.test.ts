import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { getMapTile, nextSessionRandom, setMapTileOverride, startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";

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

  it("saves and restores deterministic RNG stream progress", () => {
    const project = createBlankProject();
    const session = startSession(project, 1234);
    const beforeSaveNext = nextSessionRandom(session, "encounter");
    const snapshot = createSaveSnapshot(project, session);
    const expectedAfterSaveNext = nextSessionRandom(session, "encounter");

    const restored = applySaveSnapshot(project, snapshot);

    expect(restored.rng?.seed).toBe(1234);
    expect(beforeSaveNext).not.toBe(expectedAfterSaveNext);
    expect(nextSessionRandom(restored, "encounter")).toBe(expectedAfterSaveNext);
  });

  it("loads legacy save snapshots without RNG by assigning a compatible RNG state", () => {
    const project = createBlankProject();
    const session = startSession(project, 99);
    const snapshot = createSaveSnapshot(project, session);
    const legacySnapshot = {
      ...snapshot,
      session: {
        ...snapshot.session,
        rng: undefined,
      },
    };

    const restored = applySaveSnapshot(project, legacySnapshot);

    expect(restored.rng?.seed).toBeGreaterThan(0);
    expect(Number.isFinite(nextSessionRandom(restored, "battle"))).toBe(true);
  });
});
