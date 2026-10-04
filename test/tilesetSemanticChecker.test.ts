import { describe, expect, it } from "vitest";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import {
  summarizeTileUsage,
  summarizeTilesetGenerationReadiness,
} from "@/project/tilesetSemanticChecker";

describe("tileset semantic checker", () => {
  it("reports the default combined-town metadata as ready for every generation role", () => {
    // Given: the bundled default tileset has semantic groups and high-confidence tile metadata.
    const tileset = defaultTileset();

    // When: the tileset checker evaluates generation readiness.
    const summary = summarizeTilesetGenerationReadiness(tileset);

    // Then: city, house, road, water, and decor generation are all covered.
    expect(summary.ready).toBe(true);
    expect(summary.checks.map((check) => check.id)).toEqual(["city", "house", "road", "water", "decor"]);
    expect(summary.checks.every((check) => check.ready)).toBe(true);
    expect(summary.checks.find((check) => check.id === "city")?.coveredRoles).toEqual(
      expect.arrayContaining(["building", "terrain", "wall", "water"])
    );
  });

  it("names missing role slots when semantic groups are incomplete", () => {
    // Given: a tileset that lost all water groups.
    const tileset = defaultTileset();
    tileset.tileGroups = tileset.tileGroups?.filter((group) => group.role !== "water");

    // When: the tileset checker evaluates generation readiness.
    const summary = summarizeTilesetGenerationReadiness(tileset);

    // Then: city and water generation identify the missing water slot.
    expect(summary.ready).toBe(false);
    expect(summary.checks.find((check) => check.id === "city")?.missingRoleSlots).toContain("water");
    expect(summary.checks.find((check) => check.id === "water")?.missingRoleSlots).toContain("water");
  });

  it("summarizes selected tile tags and placement rules from metadata groups", () => {
    // Given: a selected tile that belongs to a semantic road group.
    const tileset = defaultTileset();
    const roadGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
    if (!roadGroup) throw new Error("expected terrain road group");
    const tile = roadGroup.tileIds[0];

    // When: the selected tile usage summary is built.
    const usage = summarizeTileUsage(tileset, tile);

    // Then: inspector data includes visible meaning tags and rule text.
    expect(usage.tags).toEqual(expect.arrayContaining(["terrain", "lower", "passable"]));
    expect(usage.groups[0]).toEqual(
      expect.objectContaining({
        name: roadGroup.name,
        role: "terrain",
        defaultLayer: "lower",
      })
    );
    expect(usage.ruleText).toContain(roadGroup.placementRules);
  });

  it("marks groups with invalid structure rules as invalid", () => {
    // Given: a semantic group whose structural rules reference missing roles and out-of-range tiles.
    const tileset = defaultTileset();
    const invalidGroup = tileset.tileGroups?.find((group) => group.role === "roof");
    if (!invalidGroup) throw new Error("expected roof group");
    Object.assign(invalidGroup, {
      junctions: [
        { action: "omit", atRoles: ["missingPart"], side: "below", withRole: "wall" },
        { action: "omit", side: "above", withRole: "sky" },
      ],
      overlays: [{ tileIds: [tileset.count + 1], when: "ridge" }],
    });

    // When: the tileset checker evaluates generation readiness.
    const summary = summarizeTilesetGenerationReadiness(tileset);

    // Then: the malformed structural rule excludes that group from valid generation coverage.
    expect(summary.invalidGroups.map((group) => group.id)).toContain(invalidGroup.id);
  });
});
