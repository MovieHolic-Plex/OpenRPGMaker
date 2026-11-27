// 편집·플레이 씬은 맵이 쓰지 않는 이식 소스 칩셋을 싣지 않고(bundled.ts unusedGraftSourceTextureKeys),
// 이식 칸이 맵에 생기면 그 타일셋의 소스를 모두 싣는지 본다.
import { describe, expect, it, vi } from "vitest";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, BUNDLED_REFERENCE_CHIPSET_ASSETS, loadBundledAssets, mapNeedsUnloadedGraftSources } from "@/assets/bundled";
import { activeTileGrafts } from "@/assets/tileGrafts";
import { chipsetLoadTextureKey } from "@/assets/chipsetTransparency";
import { createBlankProject } from "@/project/defaults";

function queuedKeys(project: ReturnType<typeof createBlankProject>): string[] {
  const keys: string[] = [];
  loadBundledAssets({ load: { image: (key: string) => { keys.push(key); }, on: vi.fn() } as never }, project);
  return keys;
}

describe("이식 소스 칩셋 지연 싣기", () => {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const grafts = activeTileGrafts(tileset);
  const bundledKeys = new Set([...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS].map((asset) => asset.textureKey));
  const sources = [...new Set(grafts.map((graft) => graft.sourceChipset))]
    .filter((key) => key !== (tileset.image as { id?: string }).id && bundledKeys.has(key));

  it("시작 맵에 이식 칸이 없으면 이식 소스는 싣지 않고 바탕 시트는 싣는다", () => {
    expect(sources.length).toBeGreaterThan(0);
    const keys = queuedKeys(project);
    expect(keys).toContain(chipsetLoadTextureKey((tileset.image as { id: string }).id));
    expect(sources.filter((source) => keys.includes(chipsetLoadTextureKey(source)))).toEqual([]);
    expect(mapNeedsUnloadedGraftSources(map, tileset, () => false)).toBe(false);
  });

  it("맵에 이식 칸을 하나 두면 그 타일셋의 이식 소스를 모두 싣는다", () => {
    const withGraft = structuredClone(project);
    const graftedMap = withGraft.maps[withGraft.startMapId]!;
    graftedMap.lowerTiles[0] = grafts[0]!.targetTile;
    const keys = queuedKeys(withGraft);
    expect(sources.filter((source) => !keys.includes(chipsetLoadTextureKey(source)))).toEqual([]);
    const graftedTileset = withGraft.tilesets[graftedMap.tilesetId]!;
    expect(mapNeedsUnloadedGraftSources(graftedMap, graftedTileset, () => false)).toBe(true);
    expect(mapNeedsUnloadedGraftSources(graftedMap, graftedTileset, () => true)).toBe(false);
  });
});
