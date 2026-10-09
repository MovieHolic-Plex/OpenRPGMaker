import { readFileSync, existsSync } from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PIXEL_ENEMY_SHEETS, pixelEnemyCell } from "@/assets/pixelEnemySheets";
import { pixelEnemyPortraitPath } from "@/assets/pixelEnemyPortraits";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";

describe("native enemy battler files", () => {
  it("resolves every registered generated enemy to an existing public image", () => {
    const ids = builtinGeneratedResourceIds().filter((id) => id.startsWith("generated-enemy-"));
    expect(ids.length).toBeGreaterThanOrEqual(140);
    for (const id of ids) {
      const url = resolveAssetResourceUrl(id);
      expect(url, id).not.toBeNull();
      expect(existsSync(`public${url}`), `${id} -> ${url}`).toBe(true);
      expect(url).not.toContain("/starter/monster-");
      expect(url).not.toContain("/generated/monsters/");
    }
  });

  it("uses one exact idle cell for whole-image consumers rather than exposing a pose grid", () => {
    for (const sheet of PIXEL_ENEMY_SHEETS) {
      const cell = pixelEnemyCell(sheet);
      const source = PNG.sync.read(readFileSync(`public/${sheet.path}`));
      const portraitPath = pixelEnemyPortraitPath(sheet);
      const portrait = PNG.sync.read(readFileSync(`public/${portraitPath}`));
      expect(resolveAssetResourceUrl(sheet.resourceId)).toBe(`/${portraitPath}`);
      expect([source.width, source.height]).toEqual([cell * 3, cell * 3]);
      expect([portrait.width, portrait.height]).toEqual([cell, cell]);
      for (let y = 0; y < cell; y++) {
        expect(portrait.data.subarray(y * cell * 4, (y + 1) * cell * 4).equals(
          source.data.subarray(y * source.width * 4, (y * source.width + cell) * 4),
        ), sheet.resourceId).toBe(true);
      }
    }
  });

  it("retains named saved-project aliases without recreating the numeric filler pool", () => {
    expect(resolveAssetResourceUrl("generated-enemy-zombie-01-enemy_extra_016")).toBe(resolveAssetResourceUrl("generated-enemy-zombie-01"));
    expect(resolveAssetResourceUrl("generated-enemy-skeleton-01-enemy_extra_038")).toBe(resolveAssetResourceUrl("generated-enemy-skeleton-01"));
    expect(resolveAssetResourceUrl("enemy_extra_016")).toBeNull();
    expect(defaultBattleRecords().enemies.filter((enemy) => /^enemy_extra_\d+$/.test(enemy.id))).toEqual([]);
  });

  it("gives every common default enemy a registered resource", () => {
    const registered = new Set(builtinGeneratedResourceIds());
    const missing = defaultBattleRecords().enemies
      .filter((enemy) => enemy.monsterResourceId && !registered.has(enemy.monsterResourceId))
      .map((enemy) => `${enemy.id} -> ${enemy.monsterResourceId}`);
    expect(missing).toEqual([]);
  });

  it("uses the already selected collect-species sprite for sparkit-fire", () => {
    expect(resolveAssetResourceUrl("generated-enemy-sparkit-fire")).toBe("/assets/harnesses/monster-collect-species/sparkit/front.png");
  });
});
