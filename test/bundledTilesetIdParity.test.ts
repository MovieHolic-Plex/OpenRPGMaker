import { describe, expect, it } from "vitest";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledTilesetIdForAssetForTest } from "@/project/defaults/defaultAssets";

/**
 * `ensureBundledTilesets` 는 무거운 생성자를 부르기 전에 id 로 존재를 확인한다. 그 id 계산이
 * 생성자 결과와 어긋나면 타일셋이 중복 생성되거나 참고문서 보강이 조용히 건너뛰어진다 —
 * 실패가 화면에 안 뜨는 종류라 계약으로 못박는다.
 * (숲마을·성채·Slates·EasyRPG 시트는 2026-10-07 저작권 정리로 번들에서 빠졌다.)
 */
describe("bundled tileset id parity", () => {
  it("단독 생성자가 있는 특수 타일셋의 id 가 일치한다", async () => {
    const { createJoseonBaramTileset } = await import("@/project/defaults/joseonBaram");
    const { createModernCityTileset } = await import("@/project/defaults/modernCity");
    const { createJpCityTileset } = await import("@/project/defaults/jpCity");
    const { createWizardingWorldTileset } = await import("@/project/defaults/wizardingWorld");

    const creators: Record<string, () => { id: string }> = {
      tex_joseon_baram: createJoseonBaramTileset,
      tex_modern_city: createModernCityTileset,
      tex_jp_city: createJpCityTileset,
      tex_wizarding_world: createWizardingWorldTileset,
    };
    const byKey = new Map(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => [a.textureKey, a]));
    for (const [textureKey, creator] of Object.entries(creators)) {
      const asset = byKey.get(textureKey);
      expect(asset, textureKey).toBeDefined();
      expect(bundledTilesetIdForAssetForTest(asset!), textureKey).toBe(creator().id);
    }
  });

  it("지운 시트는 번들 목록에 없다", () => {
    const keys = new Set<string>(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => a.textureKey));
    for (const key of ["tex_forest_harmony", "tex_opengameart_castle", "tex_slates_32", "tex_easyrpg_chipset_dungeon", "tex_tibo_interior_expanded"]) {
      expect(keys.has(key), key).toBe(false);
    }
  });
});
