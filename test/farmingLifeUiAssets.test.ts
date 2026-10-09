import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import runtimeAssetInventory from "@/player/runtimeAssets.json";

describe("farming life UI assets", () => {
  it("registers every P0-P2 journal illustration at a shipped public path", () => {
    // Break caught: a generated card exists only in a local imagegen folder or is
    // referenced with a path that the exported player cannot serve.
    expect(Object.keys(FARMING_LIFE_UI_ASSETS)).toEqual([
      "animals",
      "buildings",
      "bundles",
      "decorating",
      "fishing",
      "foraging",
      "makers",
      "museum",
    ]);
    const paths = Object.values(FARMING_LIFE_UI_ASSETS);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).toMatch(/^\/assets\/farming\/life-ui\/[a-z-]+\.png$/);
      expect(existsSync(resolve("public", path.slice(1)))).toBe(true);
      expect(runtimeAssetInventory.paths).toContain(path.slice(1));
    }
  });
});
