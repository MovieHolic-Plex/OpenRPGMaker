import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { build } from "vite";
import { battlerIdleAnimation, battlerIdleAnimationUrl } from "@/assets/battlerIdleAnimations";
import { battlerHiresSheet, battlerHiresSheetUrl } from "@/assets/battlerHiresSheets";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";

afterEach(() => {
  registerExportAssetBase(null);
  registerInlineAssets(null);
});

describe("export battle asset URLs", () => {
  it.each([
    ["nested", "https://games.example.test/games/demo/assets/generated/starter/hires/hero-01-battle.png"],
    ["embedded", "data:image/png;base64,AQ=="],
  ])("resolves high resolution sheets for %s exports", (kind, expected) => {
    // Given
    registerExportAssetBase(new URL("https://games.example.test/games/demo/"));
    // 번들 스타터 고해상도 시트는 2026-10-03 에 빠졌다(BATTLER_HIRES_SHEETS = []) — URL 해석 계약은 같은 모양의 시트 항목으로 본다.
    expect(battlerHiresSheet("generated-actor-hero-01-battle")).toBeUndefined();
    const sheet = { resourceId: "generated-actor-hero-01-battle", path: "assets/generated/starter/hires/hero-01-battle.png", cellWidth: 192, cellHeight: 192 };
    if (kind === "embedded") registerInlineAssets({ [sheet.path]: "data:image/png;base64,AQ==" });

    // When
    const url = battlerHiresSheetUrl(sheet);

    // Then
    expect(url).toBe(expected);
  });

  it("resolves the actual idle producer against the exported directory", () => {
    // Given
    registerExportAssetBase(new URL("https://games.example.test/games/demo/"));
    const animation = battlerIdleAnimation("generated-actor-hero-01-back");
    if (!animation) throw new Error("Expected authored idle animation");

    // When
    const url = battlerIdleAnimationUrl(animation);

    // Then
    expect(url).toBe("https://games.example.test/games/demo/assets/generated/battle-skins/sprites/idle/hero-01-back.png");
  });

  it("resolves the actual idle producer from the HTML asset table", () => {
    // Given
    const animation = battlerIdleAnimation("generated-actor-hero-01-back");
    if (!animation) throw new Error("Expected authored idle animation");
    registerInlineAssets({ [animation.path]: "data:image/png;base64,AQ==" });

    // When
    const url = battlerIdleAnimationUrl(animation);

    // Then
    expect(url).toBe("data:image/png;base64,AQ==");
  });

  // (은퇴) 「HUD 아이콘 URL 을 Vite 로 굽는다」 — 스타터 battle-icon-* 그림과 그 url() 이 2026-10-03 스타터 자산 정리로 빠졌다.

  it("builds runtime fonts and fallback window skin without root-only URLs", async () => {
    // Given
    // 글꼴은 fonts.css(편집기가 런타임 시트 없이 즉시 싣는다), 기본 윈도스킨은 system.css 가 소유한다.
    const input = [resolve("src/styles/runtime/fonts.css"), resolve("src/styles/runtime/system.css")];

    // When
    const built = await build({
      configFile: false, publicDir: false, base: "./", logLevel: "silent",
      build: { write: false, assetsInlineLimit: 0, rollupOptions: { input } },
    });
    const output = Array.isArray(built) ? built[0] : built;
    if (!output || !("output" in output)) throw new Error("Expected completed CSS build");
    const cssFiles = output.output.filter((file) => file.type === "asset" && file.fileName.endsWith(".css"));
    if (cssFiles.length === 0) throw new Error("CSS artifact missing");
    const text = cssFiles
      .map((css) => (css.type !== "asset" ? "" : typeof css.source === "string" ? css.source : new TextDecoder().decode(css.source)))
      .join("\n");

    // Then
    expect([...text.matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g)]).toEqual([]);
    // 2026-10-07 정리로 Neo둥근모가 빠지고 갈무리 셋(9·11·11 Bold)만 남았다(fonts.css).
    expect(output.output.filter((file) => file.fileName.endsWith(".woff2"))).toHaveLength(3);
  });
});
