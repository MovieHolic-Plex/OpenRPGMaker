// 우리가 저작한 pixelfx 효과(src/pixelfx/custom)는 vendor 동기화 밖이라 세 곳이 손으로 이어진다:
// 정적 import 표(custom/index.ts) · 파생 catalog.json(build-pixelfx-custom-catalog.mjs) · 그 효과를 쓰는 게임 데이터.
// 하나라도 어긋나면 전투에서 효과가 조용히 빠진다(loader 가 undefined) — 그 어긋남을 여기서 잡는다.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import customCatalog from "@/pixelfx/custom/catalog.json";
import { PIXEL_FX_CUSTOM } from "@/pixelfx/custom";
import { isKnownPixelFxEffect } from "@/pixelfx/catalog";
import { loadPixelFxModule } from "@/pixelfx/modules";
import { pixelFxEffectTiming } from "@/battle/animationTiming";
import { FALLEN_SKILL_FX } from "@/project/flagship/fallen/pixelfx";

const CUSTOM_DIR = join(import.meta.dirname, "..", "src", "pixelfx", "custom");

function customFiles(): string[] {
  const out: string[] = [];
  for (const category of readdirSync(CUSTOM_DIR, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const file of readdirSync(join(CUSTOM_DIR, category.name))) if (file.endsWith(".js") && !file.startsWith("_")) out.push(`${category.name}/${file.slice(0, -3)}`);
  }
  return out.sort();
}

describe("custom pixelfx effects", () => {
  it("lists every custom effect file in both the import table and the derived catalog", () => {
    expect(PIXEL_FX_CUSTOM.map((e) => e.id).sort()).toEqual(customFiles());
    expect(customCatalog.effects.map((e) => e.id).sort()).toEqual(customFiles());
  });

  it("loads each custom effect through the runtime loader with the catalog's meta", async () => {
    for (const entry of customCatalog.effects) {
      const mod = await loadPixelFxModule(entry.id);
      expect(mod, entry.id).toBeDefined();
      expect(mod!.meta.duration).toBe(entry.duration);
      expect([...mod!.meta.size]).toEqual(entry.size);
      expect(pixelFxEffectTiming(entry.id)).toEqual({ durationMs: Math.round(entry.duration * 1000), loop: entry.loop });
    }
  });

  it("gives every Fallen Star skill an effect the catalog knows", () => {
    const unknown = FALLEN_SKILL_FX.filter((e) => !isKnownPixelFxEffect(e.spec.effectId)).map((e) => `${e.skill} → ${e.spec.effectId}`);
    expect(unknown).toEqual([]);
  });
});
