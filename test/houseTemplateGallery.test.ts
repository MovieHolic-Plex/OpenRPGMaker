import { describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults";

describe("house template gallery project", () => {
  it("restores all house templates in one map-tree gallery", () => {
    const project = createHouseTemplateGalleryProject();
    const maps = Object.values(project.maps);
    const smallHouseMaps = maps.filter((map) => map.name.includes("small_house_01"));

    expect(smallHouseMaps).toHaveLength(9);
    expect(maps.length).toBeGreaterThanOrEqual(14);
    expect(project.mapTree.mapId).toBe(project.startMapId);
    expect(project.mapTree.children).toHaveLength(maps.length - 1);
  });
});
