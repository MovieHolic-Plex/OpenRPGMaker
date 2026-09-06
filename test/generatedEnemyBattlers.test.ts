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

  it.each([
    "leaf-fox", "fire-pup", "sparkit-fire", "skeleton-archer", "orc-shaman",
    "spirit-fire", "spirit-earth", "spirit-water", "wisp-blue",
  ])("registers audited %s art at its exact existing path", async (slug) => {
    const id = `generated-enemy-${slug}`;
    const url = `/assets/generated/monsters/corrected/${slug}.png`;
    expect(builtinGeneratedResourceIds()).toContain(id);
    expect(resolveAssetResourceUrl(id)).toBe(url);
    const existsSync = await loadExistsSync();
    expect(existsSync(`public${url}`)).toBe(true);
  });

  it("routes the enemy_extra_NNN resource suffix to its matching enemy-art file", async () => {
    // Break caught: broad name fallbacks or a non-generated prefix bypass the
    // enemy_extra_NNN route and show a shared image (or no image) in the DB.
    // The 115 numbered default enemies were deleted (2026-08-28), but the route
    // is still live for saved projects and for modernNocturneGame's two enemies,
    // whose monsterResourceId keeps the `-enemy_extra_016` / `-enemy_extra_038`
    // suffix precisely so this resolver branch supplies their art.
    const existsSync = await loadExistsSync();
    const suffixed = [
      "generated-enemy-zombie-01-enemy_extra_016",
      "generated-enemy-skeleton-01-enemy_extra_038",
    ];

    const mismatches = suffixed.flatMap((resourceId) => {
      const number = resourceId.match(/(\d+)$/)?.[1];
      const expectedUrl = `/assets/generated/monsters/enemy-art-${number}.png`;
      const actualUrl = resolveAssetResourceUrl(resourceId);
      return actualUrl === expectedUrl && existsSync(`public${expectedUrl}`)
        ? []
        : [{ resourceId, actualUrl, expectedUrl }];
    });

    expect(mismatches).toEqual([]);
  });

  it("ships no numbered filler enemies in the default database", () => {
    // The enemy_extra_006..120 block was arithmetic-series filler sharing pooled
    // art. Regrowing it means regrowing 115 records nobody authored.
    const numbered = defaultBattleRecords().enemies.filter((enemy) => /^enemy_extra_\d+$/.test(enemy.id));
    expect(numbered).toEqual([]);
  });

  it("gives every default enemy a registered 384px battler, never the legacy 64px pool", () => {
    // Break caught: enemy_mine_skel_archer shipped `generated-enemy-skeleton-01-enemy_extra_105`,
    // an id absent from the registry. It fell through to the enemy_extra_NNN regex and drew
    // legacy `enemy-art-105.png` at 64x64 while all 105 other enemies drew 384x384 — the enemy
    // rendered at a sixth of the expected area. Deleting the 115 filler records (2026-08-28)
    // left that one suffix behind. The registry is the contract: an unregistered id means the
    // fallback silently picked the art, so assert registration rather than the resolved URL.
    const registered = new Set(builtinGeneratedResourceIds());
    const unregistered = defaultBattleRecords()
      .enemies.filter((enemy) => typeof enemy.monsterResourceId === "string" && enemy.monsterResourceId.length > 0)
      .filter((enemy) => !registered.has(enemy.monsterResourceId as string))
      .map((enemy) => `${enemy.id} -> ${enemy.monsterResourceId}`);

    expect(unregistered).toEqual([]);
    expect(resolveAssetResourceUrl("generated-enemy-skeleton-01")).toBe(
      "/assets/generated/starter/monster-skeleton-01.png",
    );
  });
});

async function loadExistsSync(): Promise<(path: string) => boolean> {
  const moduleName = "node:fs";
  const fsModule = await import(moduleName);
  if (typeof fsModule.existsSync !== "function") throw new Error("node:fs existsSync is unavailable");
  return fsModule.existsSync;
}
