// 빈 새 프로젝트를 구운 «정규화한 새 번들 타일셋»에서 지연으로 만든다(src/project/defaults/freshStarter.ts).
import { describe, expect, it } from "vitest";
import { createStarterBlankProject } from "@/project/defaults";
import { createFreshStarterBlankProject } from "@/project/defaults/freshStarter";
import { ensureBundledResourceProfiles, ensureBundledTilesets, removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { reshapeJpCityMapBorders } from "@/project/defaults/jpCityEdgeMigration";
import { repairInteriorTransparentPropLayers } from "@/project/defaults/interiorTransparentPropLayerRepair";
import { ensureSharedTileReferences } from "@/project/sharedTileReferences";
import { externalizeBundledReferenceImages } from "@/project/bundledReferenceImages";
import { deserialize, serialize } from "@/project/io";
import { isFreshBundledTileset, isPendingLazyTileset } from "@/project/bundledTilesetLazy";
import { cloneProjectSharingReferenceDocuments } from "@/project/projectClone";

describe("구운 새 번들 타일셋으로 짓는 빈 프로젝트", () => {
  it("맵이 쓰는 타일셋만 되돌리고, 정규화기는 나머지를 되돌리지 않으며, 저장본에는 차이만 싣는다", async () => {
    const project = await createFreshStarterBlankProject();
    const mapTilesets = new Set(Object.values(project.maps).map((map) => map.tilesetId));
    const ids = Object.keys(project.tilesets);
    expect(ids).toEqual(Object.keys(createStarterBlankProject().tilesets));
    for (const id of ids) {
      expect(isFreshBundledTileset(project.tilesets[id])).toBe(true);
      expect(isPendingLazyTileset(project.tilesets[id])).toBe(!mapTilesets.has(id));
    }
    // store.normalizeCurrentProject 가 타일셋을 읽는 정규화기들.
    ensureBundledTilesets(project);
    reshapeJpCityMapBorders(project);
    ensureSharedTileReferences(project);
    externalizeBundledReferenceImages(project);
    repairInteriorTransparentPropLayers(project);
    removeLegacySpriteReferences(project);
    ensureBundledResourceProfiles(project);
    cloneProjectSharingReferenceDocuments(project);
    const wire = serialize(project);
    for (const id of ids) if (!mapTilesets.has(id)) expect(isPendingLazyTileset(project.tilesets[id])).toBe(true);
    expect(wire.length).toBeLessThan(5_000_000);
    const tilesets = (JSON.parse(wire) as { tilesets: Record<string, object> }).tilesets;
    for (const id of ids) expect(Object.hasOwn(tilesets[id]!, "bundledTilesetDiff")).toBe(true);
  }, 300_000);

  it("되돌린 값은 정규화한 새 타일셋과 같고 정규화기가 더 바꿀 것이 없다(구운 표가 낡지 않았다)", async () => {
    const fresh = await createFreshStarterBlankProject();
    // 읽기는 지연 항목을 되돌린다 — 평범한 객체 사본은 «새 항목» 표지가 없어 정규화기가 끝까지 본다.
    const materialized = JSON.parse(JSON.stringify(fresh.tilesets)) as typeof fresh.tilesets;
    const plain = { tilesets: materialized, maps: fresh.maps };
    const before = JSON.stringify(materialized);
    ensureBundledTilesets(plain);
    removeLegacySpriteReferences(plain);
    expect(JSON.stringify(plain.tilesets)).toBe(before);

    const eager = createStarterBlankProject();
    ensureBundledTilesets(eager);
    expect(JSON.stringify(materialized)).toBe(JSON.stringify(eager.tilesets));
  }, 300_000);

  it("저장본을 다시 읽으면 같은 값이다", async () => {
    const fresh = await createFreshStarterBlankProject();
    const reloaded = deserialize(serialize(fresh));
    expect(JSON.stringify(reloaded.tilesets)).toBe(JSON.stringify(fresh.tilesets));
  }, 300_000);
});
