import { afterEach, describe, expect, it } from "vitest";
import { resolve, join } from "node:path";
import { build } from "vite";
import { battlerIdleAnimation, battlerIdleAnimationUrl } from "@/assets/battlerIdleAnimations";
import { battlerHiresSheet, battlerHiresSheetUrl } from "@/assets/battlerHiresSheets";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import { existsSync } from "node:fs";
import spriteFiles from "@/assets/battleTrainerSpriteFiles.json";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets, trainerSpriteImagePaths } from "@/project/webExportAssets";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import { isolateTimers } from "./mergedTeardown";

describe("exportBattleAssetUrls", () => {
  isolateTimers();
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
});

// QA-AH119-001: the runtime builds /assets/battle-trainers/<role>/<file>.png from troop.trainerSprite
// (battleAssetPrefetch.ts:69, emeraldTrainerIntro.ts:40), so those paths never appear in project strings the
// dependency collector walks. The Astra 1.19 bundle shipped an empty battle-trainers folder and every trainer
// battle sprite 404'd. The collector must ship every committed file for a referenced role.
describe("exportBattleTrainerSprites", () => {
  isolateTimers();
  const PUBLIC_ROOT = join(process.cwd(), "public");
  const files = spriteFiles as Readonly<Record<string, readonly string[]>>;
  function projectWithTrainerSprite(sprite: { front: string; back?: string; throw?: string; backThrow?: string }) {
    const project = createBlankProject();
    project.database.troops = project.database.troops.map((troop, index) =>
      index === 0 ? { ...troop, trainerBattle: true, trainerSprite: sprite } : troop);
    return project;
  }
  describe("trainer battle sprite export dependencies", () => {
    it("ships both the front and back role files for a trainer troop", () => {
      // Given a monster-collect troop that shows a trainer in battle
      const project = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero" });

      // When the release dependency list is collected
      const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

      // Then the runtime-composed sprite URLs are all present
      expect(exported).toContain("assets/battle-trainers/astra_naru/front.png");
      expect(exported).toContain("assets/battle-trainers/astra_hero/back.png");
    });

    it("ships the throw sheet and orb of the throwing hero", () => {
      // Given the protagonist's back sprite carries a throw sheet and an orb cut-out
      const project = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero", backThrow: "astra_hero" });

      // When exported
      const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

      // Then every file the capture cinematic can ask for is in the bundle
      expect(exported).toContain("assets/battle-trainers/astra_hero/throw.png");
      expect(exported).toContain("assets/battle-trainers/astra_hero/orb.png");
      expect(exported).toContain("assets/battle-trainers/astra_hero/back.png");
    });

    it("only lists files that exist on disk", () => {
      // Given the generated manifest
      // When comparing each entry against public/
      // Then no export path points at a missing file (a missing source would fail the whole export)
      const referenced = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero", backThrow: "astra_hero" });
      const paths = trainerSpriteImagePaths(referenced);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.filter((path) => !existsSync(join(PUBLIC_ROOT, path)))).toEqual([]);
    });

    it("keeps the manifest in sync with public/assets/battle-trainers", async () => {
      // Given the sprite folders on disk
      const { readSpriteFiles } = await import("../scripts/content/sync-battle-trainer-sprite-files.mjs");
      // Then the committed manifest matches exactly (regenerate with the script when art is added)
      expect(readSpriteFiles(join(PUBLIC_ROOT, "assets/battle-trainers"))).toEqual(files);
    });

    it("adds no battle-trainers paths for a project with no trainer sprite", () => {
      // Given a project whose troops are ordinary monster encounters
      const project = createBlankProject();
      project.database.troops = project.database.troops.map((troop) => ({ ...troop, trainerSprite: undefined }));

      // When exported
      const declared = requiredRuntimeAssetPaths(project);
      const paths = collectWebExportAssets(project).map((asset) => asset.zipPath).filter((path) => path.startsWith("assets/battle-trainers/"));

      // Then the sprite collector adds nothing: only the always-shipped default roles that src/player/runtimeAssets.json
      // declares (since 15f8ce5de1, the player prefetches them) are present, and no troop-derived path is.
      expect(trainerSpriteImagePaths(project)).toEqual([]);
      expect(paths.filter((path) => !declared.has(path))).toEqual([]);
    });

    it("ignores a role with no committed art instead of emitting a broken path", () => {
      // Given a troop naming a role that has no folder under public/assets/battle-trainers
      const project = projectWithTrainerSprite({ front: "role_that_does_not_exist" });

      // When the paths are collected
      const paths = trainerSpriteImagePaths(project);

      // Then no path is invented
      expect(paths).toEqual([]);
    });

    it("does not treat an Object.prototype name as a role", () => {
      // Given a role id that is a valid identifier but also an inherited property name
      const project = projectWithTrainerSprite({ front: "constructor", back: "toString" });

      // When the paths are collected
      // Then the export neither throws nor invents a path
      expect(trainerSpriteImagePaths(project)).toEqual([]);
    });

    it("lets an uploaded picture shadow a bundled role id", () => {
      // Given a project upload that reuses the bundled role id astra_naru
      const project = projectWithTrainerSprite({ front: "astra_naru" });
      project.assets.uploaded.astra_naru = { id: "astra_naru", name: "astra_naru.png", kind: "image", path: "uploaded/astra_naru.png" } as never;

      // When the paths are collected
      // Then the bundled folder is not shipped (the upload owns the id)
      expect(trainerSpriteImagePaths(project)).toEqual([]);
    });
  });
});
