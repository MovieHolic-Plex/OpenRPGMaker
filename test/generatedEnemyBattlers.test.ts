import { describe, expect, it } from "vitest";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";

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

  it("routes every numbered default enemy to its matching enemy-art file", async () => {
    // Break caught: broad name fallbacks or a non-generated prefix bypass the
    // enemy_extra_NNN route and show a shared image (or no image) in the DB.
    const existsSync = await loadExistsSync();
    const numberedEnemies = defaultBattleRecords().enemies.filter((enemy) => /^enemy_extra_\d+$/.test(enemy.id));

    const mismatches = numberedEnemies.flatMap((enemy) => {
      const number = enemy.id.match(/(\d+)$/)?.[1];
      const expectedUrl = `/assets/generated/monsters/enemy-art-${number}.png`;
      const actualUrl = resolveAssetResourceUrl(enemy.monsterResourceId);
      return actualUrl === expectedUrl && existsSync(`public${expectedUrl}`)
        ? []
        : [{ enemyId: enemy.id, actualUrl, expectedUrl }];
    });

    expect(mismatches).toEqual([]);
  });
});

async function loadExistsSync(): Promise<(path: string) => boolean> {
  const moduleName = "node:fs";
  const fsModule = await import(moduleName);
  if (typeof fsModule.existsSync !== "function") throw new Error("node:fs existsSync is unavailable");
  return fsModule.existsSync;
}
