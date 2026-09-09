// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { serialize } from "@/project/io";
import { geographyPreviewMap, geographyRasterTile, renderGeographyRaster } from "@/editor/panels/spatialGeographyRaster";
import type { Project } from "@/project/types";
import { geographyControllerFault } from "./support/spatialGeographyControllerFixture";
import { geographyFixture } from "./support/spatialGeographyFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

function firstRegion(project: Project) {
  const region = Object.values(fixtureDocument(project).library.regions)[0];
  if (!region) throw new TypeError("Missing region");
  return region;
}

describe("geographyPreviewMap typed failures", () => {
  it("returns an error without a map for unsupported material and leaves live state", () => {
    const project = geographyFixture("region");
    const before = serialize(project);
    const region = firstRegion(project);
    const preview = geographyPreviewMap(project, {
      ...region,
      terrain: { ...region.terrain, floor: "lava" },
    });
    expect(serialize(project)).toBe(before);
    expect(preview.map).toBeUndefined();
    expect(preview.error?.code).toBe("material");
    const host = document.createElement("div");
    host.append(renderGeographyRaster(project, { ...region, terrain: { ...region.terrain, floor: "lava" } }).node);
    const canvas = host.querySelector("canvas");
    expect(canvas?.dataset.painted).toBe("error");
    expect(canvas?.dataset.error).toMatch(/^material:/);
    expect(canvas?.dataset.width).toBeUndefined();
  });

  it.each([
    { fault: "narrow-mountain", code: "invalid-args" },
    { fault: "mountain-overflow", code: "out-of-bounds" },
  ] as const)("returns an error without a map for $fault", ({ fault, code }) => {
    const project = geographyControllerFault(fault);
    const before = serialize(project);
    const preview = geographyPreviewMap(project, firstRegion(project));
    expect(serialize(project)).toBe(before);
    expect(preview.map).toBeUndefined();
    expect(preview.error?.code).toBe(code);
  });

  it("keeps terrain without a partial route when a blocked path fails", () => {
    const project = geographyControllerFault("blocked-route");
    const before = serialize(project);
    const region = firstRegion(project);
    const preview = geographyPreviewMap(project, region);
    expect(serialize(project)).toBe(before);
    expect(preview.error?.code).toBe("blocked");
    if (!preview.map) throw new TypeError("terrain should remain");
    expect(preview.map.lowerTiles.some((tile) => tile >= 0)).toBe(true);
    expect(geographyRasterTile(preview.map, 20, 8)).toBe(geographyRasterTile(preview.map, 2, 2));
  });

  it("does not swallow unknown construction failures", () => {
    const project = geographyFixture("region");
    const region = firstRegion(project);
    expect(() => geographyPreviewMap(project, {
      ...region,
      terrain: { ...region.terrain, tilesetId: "missing-atlas" },
    })).toThrow();
    expect(project.maps["spatial-geography-ui:" + region.id]).toBeUndefined();
  });
});
