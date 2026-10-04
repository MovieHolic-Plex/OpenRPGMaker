import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { builtinGeneratedResourceIds, resolveGeneratedAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

// The old painted hero sheets were removed by user request. Their IDs still load,
// while the bundled catalog and renderer cannot request those PNGs.
describe("retired starter hero sheets", () => {
  const ids = ["hero", ...[1, 2, 3, 4, 5, 6].map(i => `generated-actor-hero-0${i}-battle`)];

  it("removes the directory and excludes retired IDs from available artwork", () => {
    expect(existsSync(new URL("../public/assets/generated/starter", import.meta.url))).toBe(false);
    for (const id of ids) {
      expect(resolveGeneratedAssetResourceUrl(id)).toBeNull();
      expect(builtinGeneratedResourceIds()).not.toContain(id);
      expect(builtinGeneratedResourceIds(true)).toContain(id);
    }
  });

  it("still loads projects that refer to retired hero IDs", () => {
    expect(() => deserialize(JSON.stringify(battleFixture))).not.toThrow();
  });
});
