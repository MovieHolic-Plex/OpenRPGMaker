// 구운 번들 타일셋 요약(src/assets/bundledTilesetDigests.json)이 실제 계산과 같고, 저자가 고친 항목에는 심지 않는다(#5188).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { bundledTilesetById } from "@/project/defaults/defaultAssets";
import { jsonContentDigest, withTrustedSharedEntries } from "@/project/persistence/core/contentDigest";
import { bakedBundledTilesetDigests, seedBundledTilesetDigests } from "@/project/bundledTilesetDigests";

describe("구운 번들 타일셋 요약", () => {
  it("번들 정의마다 구운 요약이 실제 계산 값과 같다 — 다르면 scripts/content/bake-bundled-tileset-digests.mts 로 다시 굽는다", () => {
    const ids = Object.keys(createBlankProject().tilesets).sort();
    const baked = Object.keys(bakedBundledTilesetDigests).sort();
    expect(baked).toEqual(ids.filter((id) => bundledTilesetById(id)));
    for (const id of baked) {
      const definition = bundledTilesetById(id)!;
      expect({ id, digest: jsonContentDigest(definition), count: definition.count })
        .toEqual({ id, digest: bakedBundledTilesetDigests[id]!.digest, count: bakedBundledTilesetDigests[id]!.count });
    }
  }, 300_000);

  it("고치지 않은 항목은 구운 요약을 쓰고, 고친 항목은 계산으로 떨어져 «바뀜» 으로 보인다", () => {
    const pristine = createBlankProject();
    const edited = createBlankProject();
    const id = "beodeul_city";
    const tileset = edited.tilesets[id]!;
    const first = tileset.passability[0]!;
    tileset.passability = [{ ...first, up: !first.up }, ...tileset.passability.slice(1)];
    seedBundledTilesetDigests(pristine);
    seedBundledTilesetDigests(edited);
    const trusted = (value: unknown) => withTrustedSharedEntries(() => jsonContentDigest(value));
    expect(trusted(pristine.tilesets[id])).toBe(bakedBundledTilesetDigests[id]!.digest);
    expect(trusted(edited.tilesets[id])).not.toBe(bakedBundledTilesetDigests[id]!.digest);
    expect(trusted(edited.tilesets[id])).toBe(jsonContentDigest(structuredClone(edited.tilesets[id])));
    // 믿음 밖의 요약은 심은 기억을 쓰지 않고 끝까지 센다 — 값은 같다.
    expect(jsonContentDigest(pristine.tilesets[id])).toBe(bakedBundledTilesetDigests[id]!.digest);
  }, 300_000);
});
