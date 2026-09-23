import { describe, expect, it } from "vitest";
import { mapWorldScale, playPixelDensity, projectReferenceTileSize } from "@/project/mapViewScale";
import type { GameMap } from "@/project/types";

function maps(...sizes: number[]): { maps: Record<string, GameMap>; startMapId: string } {
  const entries = sizes.map((tileSize, index) => [`m${index}`, { id: `m${index}`, tileSize } as GameMap] as const);
  return { maps: Object.fromEntries(entries), startMapId: "m0" };
}

describe("mixed tile size view scale", () => {
  it("uses the tile size most maps use, so one imported map doesn't change the project's look", () => {
    expect(projectReferenceTileSize(maps(16, 16, 32))).toBe(16);
    expect(projectReferenceTileSize(maps(32, 16, 32))).toBe(32);
    expect(projectReferenceTileSize(maps(48))).toBe(48);
  });

  it("breaks ties with the start map, then the smaller cell", () => {
    expect(projectReferenceTileSize(maps(32, 16))).toBe(32);
    expect(projectReferenceTileSize({ ...maps(32, 16), startMapId: "missing" })).toBe(16);
  });

  it("recomputes when the maps object is replaced", () => {
    const project = maps(16, 16, 32);
    expect(projectReferenceTileSize(project)).toBe(16);
    project.maps = { ...project.maps, m0: { id: "m0", tileSize: 32 } as GameMap };
    expect(projectReferenceTileSize(project)).toBe(32);
  });

  it("maps world pixels to the reference cell", () => {
    expect(mapWorldScale(32, 16)).toBe(2);
    expect(mapWorldScale(16, 32)).toBe(0.5);
    expect(mapWorldScale(16, 16)).toBe(1);
  });

  it("raises canvas density only when a larger cell than the reference exists", () => {
    const resolution = { width: 320, height: 240 };
    expect(playPixelDensity(maps(16, 16), resolution)).toBe(1);
    expect(playPixelDensity(maps(32, 32, 16), resolution)).toBe(1); // smaller maps are zoomed in, not out
    expect(playPixelDensity(maps(16, 16, 32), resolution)).toBe(2);
    expect(playPixelDensity(maps(16, 16, 48), resolution)).toBe(3);
    expect(playPixelDensity(maps(16, 16, 32), resolution, 2)).toBe(1); // authored zoom already draws 32px 1:1
    expect(playPixelDensity(maps(16, 16, 48), { width: 1920, height: 1080 })).toBe(2); // canvas cap
  });
});
