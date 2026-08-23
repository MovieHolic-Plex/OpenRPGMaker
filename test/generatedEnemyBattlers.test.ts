import { describe, expect, it } from "vitest";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";

describe("generated enemy battler files", () => {
  it("resolves every generated-enemy monster URL to an existing public file", async () => {
    const existsSync = await loadExistsSync();
    const enemyIds = builtinGeneratedResourceIds().filter((id) => id.startsWith("generated-enemy-"));
    const monsterUrls = enemyIds
      .map((id) => ({ id, url: resolveAssetResourceUrl(id) }))
      .filter((entry) => typeof entry.url === "string" && entry.url.includes("/monster-") && entry.url.endsWith(".png"));

    expect(new Set(monsterUrls.map((entry) => entry.url)).size).toBeGreaterThanOrEqual(100);
    const missing = monsterUrls
      .filter((entry) => !existsSync(`public${entry.url}`))
      .map((entry) => `${entry.id} -> ${entry.url}`);
    expect(missing).toEqual([]);
    expect(resolveAssetResourceUrl("generated-enemy-slime-01")).toBe("/assets/generated/starter/monster-slime-01.png");
    expect(resolveAssetResourceUrl("generated-enemy-dragon-01")).toBe("/assets/generated/starter/monster-dragon-01.png");
  });
});

async function loadExistsSync(): Promise<(path: string) => boolean> {
  const moduleName = "node:fs";
  const fsModule = await import(moduleName);
  if (typeof fsModule.existsSync !== "function") throw new Error("node:fs existsSync is unavailable");
  return fsModule.existsSync;
}
