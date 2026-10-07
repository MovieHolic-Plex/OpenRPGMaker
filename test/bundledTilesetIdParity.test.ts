import { describe, expect, it } from "vitest";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledTilesetIdForAssetForTest } from "@/project/defaults/defaultAssets";

/**
 * `ensureBundledTilesets` 는 무거운 생성자를 부르기 전에 id 로 존재를 확인한다. 그 id 계산이
 * 생성자 결과와 어긋나면 타일셋이 중복 생성되거나 참고문서 보강이 조용히 건너뛰어진다 —
 * 실패가 화면에 안 뜨는 종류라 계약으로 못박는다.
 *
 * 합본 마을+레트로 월드맵은 두 표준 시트를 합성하는 `composeCombinedTownRetroWorldTileset`
 * 이라 단독 호출이 없다 — 그 id 는 상수 대조로 확인한다.
 */
describe("bundled tileset id parity", () => {
  it("단독 생성자가 있는 특수 타일셋의 id 가 일치한다", async () => {
    const { createSharedVillageObjectsTileset } = await import("@/project/defaults/sharedVillageObjects");
    const { createForestHarmonyTileset } = await import("@/project/defaults/forestHarmony");
    const { createTiboInteriorTileset } = await import("@/project/defaults/tiboInterior");
    const { createJoseonBaramTileset } = await import("@/project/defaults/joseonBaram");
    const { createModernCityTileset } = await import("@/project/defaults/modernCity");
    const { createJpCityTileset } = await import("@/project/defaults/jpCity");
    const { createWizardingWorldTileset } = await import("@/project/defaults/wizardingWorld");

    const creators: Record<string, () => { id: string }> = {
      tex_shared_forest_village_objects: createSharedVillageObjectsTileset,
      tex_forest_harmony: createForestHarmonyTileset,
      tex_tibo_interior_expanded: createTiboInteriorTileset,
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

  it("성채·Slates·합본+레트로 월드맵도 텍스처 키에서 바로 확인된다", async () => {
    const { CASTLE_TILESET_ID, COMBINED_TOWN_RETRO_WORLD_TILESET_ID } = await import("@/project/defaults/constants");
    const { SLATES_32_ID } = await import("@/project/defaults/slates32");
    const byKey = new Map(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => [a.textureKey, a]));

    expect(bundledTilesetIdForAssetForTest(byKey.get("tex_opengameart_castle")!)).toBe(CASTLE_TILESET_ID);
    expect(bundledTilesetIdForAssetForTest(byKey.get("tex_slates_32")!)).toBe(SLATES_32_ID);
    expect(bundledTilesetIdForAssetForTest(byKey.get("tex_easyrpg_chipset_combined_town_retro_world")!))
      .toBe(COMBINED_TOWN_RETRO_WORLD_TILESET_ID);
  });

  it("일반 EasyRPG 칩셋은 텍스처 키에서 접두사만 뗀 id 를 쓴다", () => {
    const byKey = new Map(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => [a.textureKey, a]));
    const dungeon = byKey.get("tex_easyrpg_chipset_dungeon");
    expect(dungeon).toBeDefined();
    expect(bundledTilesetIdForAssetForTest(dungeon!)).toBe("easyrpg_chipset_dungeon");
  });
});

