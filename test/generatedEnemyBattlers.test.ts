import { readFileSync, existsSync } from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PIXEL_ENEMY_SHEETS, pixelEnemyCell } from "@/assets/pixelEnemySheets";
import { pixelEnemyPortraitPath } from "@/assets/pixelEnemyPortraits";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";

/** 알파 0 화소의 RGB 를 0 으로 맞춘 사본 — 투명 칸에 남은 RGB 찌꺼기를 비교에서 뺀다. */
function visibleBytes(rgba: Buffer): Buffer {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) if (out[i + 3] === 0) out.fill(0, i, i + 3);
  return out;
}

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
      // 완전 투명 칸의 RGB 는 그림이 아니다 — 다시 그린 시트(#2931 등)와 초상은 투명 칸 RGB 가 다르게 저장됐다. 보이는 화소만 같아야 한다.
      for (let y = 0; y < cell; y++) {
        expect(visibleBytes(portrait.data.subarray(y * cell * 4, (y + 1) * cell * 4)).equals(
          visibleBytes(source.data.subarray(y * source.width * 4, (y * source.width + cell) * 4)),
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
