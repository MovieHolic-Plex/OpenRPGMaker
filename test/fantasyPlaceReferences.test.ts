// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { regionReferenceContext } from "@/project/regionReferences";
import { preloadAllRegionReferences, readRegionReference } from "@/project/regionReferenceSnapshots";
import { FANTASY_PLACE_REFERENCES } from "@/project/fantasyPlaceReferences";
import catalog from "../tiledata/rpg-places/catalog.json";
import shipped from "@/assets/sharedRpgPlaceReferences.json";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ensureForestHarmonyReferences } from "@/project/defaults/forestHarmony";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";

// Snapshots are per-file lazy chunks; the synchronous reads below need them loaded.
beforeAll(preloadAllRegionReferences);

const maps = catalog.maps as unknown as Record<string, { lowerTiles: number[]; upperTiles: number[] }>;
const categories = shipped as unknown as Record<string, { id: string; documents: { id: string }[] }>;

describe("fantasy shop, castle and demon-castle places", () => {
  it("reassembles every place raster exactly through bounded AI reads and lists it under 장소", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const };
    const cards = listSpatialGalleryCards(session);
    expect(FANTASY_PLACE_REFERENCES).toHaveLength(11);
    for (const entry of FANTASY_PLACE_REFERENCES) {
      const lower: number[] = [], upper: number[] = [];
      let row: number | null = 0;
      while (row !== null) {
        const page = readRegionReference(entry.id, row, 16);
        lower.push(...page.map.lowerTiles); upper.push(...page.map.upperTiles);
        row = page.map.nextRow;
      }
      expect(lower).toEqual(maps[entry.sourceMapId]!.lowerTiles);
      expect(upper).toEqual(maps[entry.sourceMapId]!.upperTiles);
      expect(cards.find((c) => c.regionReferenceId === entry.id)?.source).toBe("default");
      expect(existsSync(`public${entry.preview}`)).toBe(true);
      expect(existsSync(`public${entry.projectDownload}`)).toBe(true);
      expect(regionReferenceContext()).toContain(entry.id);
    }
  });

  it("seeds one guidance category onto each bundled tileset the places are drawn on", () => {
    const project = createBlankProject();
    for (const [tilesetId, category] of Object.entries(categories)) {
      const own = project.tilesets[tilesetId]!.referenceDocuments ?? [];
      expect(own.filter((c) => c.id === category.id)).toHaveLength(1);
    }
    // Old projects receive it once on load; a second pass changes nothing.
    for (const [tilesetId, category] of Object.entries(categories)) {
      project.tilesets[tilesetId]!.referenceDocuments = project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id !== category.id);
    }
    expect(ensureBundledTilesets(project)).toBe(true);
    for (const [tilesetId, category] of Object.entries(categories))
      expect(project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id === category.id)).toHaveLength(1);
    const again = JSON.stringify(project.tilesets);
    ensureBundledTilesets(project);
    expect(JSON.stringify(project.tilesets)).toBe(again);
  });

  it("renames the three shop signs only while the shipped colour label is untouched", () => {
    const project = createBlankProject(), tileset = project.tilesets.forest_harmony!;
    expect(tileset.tileMeta![627]!.label).toBe("무기점 간판 — 칼");
    tileset.tileMeta![627] = { ...tileset.tileMeta![627]!, label: "청록 화살표 벽표지" };
    tileset.tileMeta![628] = { ...tileset.tileMeta![628]!, label: "내가 고친 이름" };
    ensureForestHarmonyReferences(tileset);
    expect(tileset.tileMeta![627]!.label).toBe("무기점 간판 — 칼");
    expect(tileset.tileMeta![628]!.label).toBe("내가 고친 이름");
  });
});
