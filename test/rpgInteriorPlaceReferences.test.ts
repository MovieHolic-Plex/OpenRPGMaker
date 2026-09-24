// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { regionReferenceContext } from "@/project/regionReferences";
import { preloadAllRegionReferences, readRegionReference } from "@/project/regionReferenceSnapshots";
import { RPG_INTERIOR_PLACE_REFERENCES } from "@/project/rpgInteriorPlaceReferences";
import catalog from "../tiledata/rpg-interiors/catalog.json";
import shipped from "@/assets/sharedRpgInteriorReferences.json";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";

// Snapshots are per-file lazy chunks; the synchronous reads below need them loaded.
beforeAll(preloadAllRegionReferences);

const maps = catalog.maps as unknown as Record<string, { lowerTiles: number[]; upperTiles: number[] }>;
const categories = shipped as unknown as { tilesetId: string; category: { id: string } }[];

describe("RPG interiors (inn, homes, church, guild, castle rooms, ship, arena, casino, auction)", () => {
  it("reassembles every place raster exactly through bounded AI reads and lists it under 장소", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const };
    const cards = listSpatialGalleryCards(session);
    expect(RPG_INTERIOR_PLACE_REFERENCES).toHaveLength(23);
    for (const entry of RPG_INTERIOR_PLACE_REFERENCES) {
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

  it("seeds each purpose category once onto the Tibo and ship sheets", () => {
    const project = createBlankProject();
    for (const { tilesetId, category } of categories)
      expect((project.tilesets[tilesetId]!.referenceDocuments ?? []).filter((c) => c.id === category.id)).toHaveLength(1);
    for (const { tilesetId, category } of categories)
      project.tilesets[tilesetId]!.referenceDocuments = project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id !== category.id);
    expect(ensureBundledTilesets(project)).toBe(true);
    for (const { tilesetId, category } of categories)
      expect(project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id === category.id)).toHaveLength(1);
    const again = JSON.stringify(project.tilesets);
    ensureBundledTilesets(project);
    expect(JSON.stringify(project.tilesets)).toBe(again);
  });
});
