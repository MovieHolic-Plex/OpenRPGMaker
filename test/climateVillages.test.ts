// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { regionReferenceContext } from "@/project/regionReferences";
import { preloadAllRegionReferences, readRegionReference } from "@/project/regionReferenceSnapshots";
import { CLIMATE_VILLAGE_PLACE_REFERENCES } from "@/project/climateVillagePlaceReferences";
import catalog from "../tiledata/climate-villages/catalog.json";
import sheets from "../tiledata/climate-villages/sheets.json";
import village from "../tiledata/forest-villages/diverse/catalog.json";
import shipped from "@/assets/sharedClimateVillageReferences.json";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { createClimateVillageTileset } from "@/project/defaults/climateVillages";
import { bundledChipsetSheetHeight, findBundledImageAsset } from "@/assets/bundled";
import { canMove } from "@/project/collision";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import type { GameMap, Project } from "@/project/types";

// Snapshots are per-file lazy chunks; the synchronous reads below need them loaded.
beforeAll(preloadAllRegionReferences);

const maps = catalog.maps as unknown as Record<string, GameMap>;
const categories = shipped as unknown as Record<string, { id: string; documents: { id: string }[] }>;
const pngHeight = (path: string) => readFileSync(path).readUInt32BE(20);

describe("snow, volcano, desert and autumn climate villages", () => {
  it("ships both climate sheets as bundled tilesets with forest-village numbering", () => {
    const project = createBlankProject();
    for (const kind of ["snow", "volcano", "desert", "autumn"] as const) {
      const key = `tex_forest_harmony_${kind}`;
      const tileset = project.tilesets[`forest_harmony_${kind}`]!;
      expect(tileset.image).toEqual({ type: "bundled", id: key });
      expect(tileset.tileGrafts ?? []).toEqual([]);
      for (const field of ["passability", "priority", "terrain", "tileMeta"] as const) expect(tileset[field]).toHaveLength(tileset.count);
      // Same meaning as the forest village for every base tile; only labels are climate-prefixed.
      expect(tileset.passability.slice(0, sheets.baseCount)).toEqual(village.tileset.passability);
      expect(pngHeight(`public/${findBundledImageAsset(key)!.path}`)).toBe(bundledChipsetSheetHeight(key));
    }
    const snow = project.tilesets.forest_harmony_snow!, volcano = project.tilesets.forest_harmony_volcano!;
    for (const [water, ice] of sheets.snow.ice) {
      expect(snow.tileMeta![ice]!.label).toContain("얼음판");
      expect(snow.passability[ice]!.up).toBe(!snow.tileMeta![water]!.label?.includes("폭포"));
    }
    expect(snow.autotileGroups!.some((g) => g.id === "forest_harmony_ice_47")).toBe(true);
    expect(volcano.tileMeta![0]!.label).toMatch(/^용암/);
    expect(volcano.passability[0]).toEqual(village.tileset.passability[0]);
    expect(volcano.tileMeta![2701]!.label).toContain("현무암 다리");
    const desert = project.tilesets.forest_harmony_desert!, autumn = project.tilesets.forest_harmony_autumn!;
    for (const t of sheets.desert.sandstone) if (village.tileset.tileMeta[t]?.label) expect(desert.tileMeta![t]!.label).toMatch(/^사암/);
    // Desert water stays water (oasis); the cactus and palm keep their own meaning.
    expect(desert.tileMeta![0]!.label).toBe(village.tileset.tileMeta[0]!.label);
    expect(desert.tileMeta![769]!.label).toContain("선인장");
    expect(autumn.passability).toEqual(village.tileset.passability);
  });

  it("dresses the desert villages with palms and cacti instead of broadleaf trees", () => {
    for (const plan of catalog.plans.filter((p) => p.climate === "desert")) {
      const map = maps[plan.id]!, plants = plan.edits.filter((e) => e.kind === "desert-plant") as { x: number; y: number; tile: number }[];
      expect(plants.length).toBeGreaterThan(10);
      for (const p of plants) expect(map.upperTiles[p.y * map.width + p.x]).toBe(p.tile);
      // No free-standing broadleaf canopy (978~980) is left on a desert map.
      expect(map.upperTiles.some((t) => t >= 978 && t <= 980)).toBe(false);
    }
  });

  it("keeps every door, and the frozen pond, reachable with the runtime move rule", () => {
    const tilesets = Object.fromEntries((["snow", "volcano", "desert", "autumn"] as const).map((k) => [`forest_harmony_${k}`, createClimateVillageTileset(k)]));
    for (const plan of catalog.plans) {
      const map = maps[plan.id]!, project = { maps: { [map.id]: map }, tilesets } as unknown as Project;
      const seen = new Set([plan.entry[1]! * map.width + plan.entry[0]!]), queue = [plan.entry as [number, number]];
      while (queue.length) {
        const [x, y] = queue.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = (y + dy) * map.width + x + dx;
          if (!seen.has(k) && canMove(project, map, x, y, x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
        }
      }
      for (const [x, y] of plan.targets) expect(seen.has(y! * map.width + x!), `${plan.id} ${x},${y}`).toBe(true);
    }
    const frozen = maps["climate-snow-frozen-mistpond"]!;
    expect(frozen.lowerTiles.filter((t) => t >= sheets.baseCount).length).toBeGreaterThan(20);
  });

  it("reassembles every place raster through bounded AI reads and lists it under 장소", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const };
    const cards = listSpatialGalleryCards(session);
    expect(CLIMATE_VILLAGE_PLACE_REFERENCES).toHaveLength(10);
    for (const entry of CLIMATE_VILLAGE_PLACE_REFERENCES) {
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

  it("seeds one guidance category per climate tileset, once", () => {
    const project = createBlankProject();
    for (const [tilesetId, category] of Object.entries(categories))
      expect(project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id === category.id)).toHaveLength(1);
    for (const [tilesetId, category] of Object.entries(categories))
      project.tilesets[tilesetId]!.referenceDocuments = project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id !== category.id);
    expect(ensureBundledTilesets(project)).toBe(true);
    for (const [tilesetId, category] of Object.entries(categories))
      expect(project.tilesets[tilesetId]!.referenceDocuments!.filter((c) => c.id === category.id)).toHaveLength(1);
    const again = JSON.stringify(project.tilesets);
    ensureBundledTilesets(project);
    expect(JSON.stringify(project.tilesets)).toBe(again);
  });
});
