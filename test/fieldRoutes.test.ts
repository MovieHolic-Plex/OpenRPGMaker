// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { regionReferenceContext } from "@/project/regionReferences";
import { preloadAllRegionReferences, readRegionReference } from "@/project/regionReferenceSnapshots";
import { FIELD_ROUTE_PLACE_REFERENCES } from "@/project/fieldRoutePlaceReferences";
import catalog from "../tiledata/field-routes/catalog.json";
import village from "../tiledata/forest-villages/diverse/catalog.json";
import shipped from "@/assets/sharedFieldRouteReferences.json";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { createClimateVillageTileset } from "@/project/defaults/climateVillages";
import { canMove } from "@/project/collision";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import type { GameMap, Project, TilesetDef } from "@/project/types";

// Snapshots are per-file lazy chunks; the synchronous reads below need them loaded.
beforeAll(preloadAllRegionReferences);

const maps = catalog.maps as unknown as Record<string, GameMap>;
const categories = shipped as unknown as Record<string, { id: string; documents: { id: string }[] }>;
const tilesets: Record<string, TilesetDef> = {
  forest_harmony: village.tileset as unknown as TilesetDef,
  ...Object.fromEntries((["snow", "volcano", "desert", "autumn"] as const).map((k) => [`forest_harmony_${k}`, createClimateVillageTileset(k)])),
};
const walk = (map: GameMap, entry: number[]) => {
  const project = { maps: { [map.id]: map }, tilesets } as unknown as Project;
  const seen = new Set([entry[1]! * map.width + entry[0]!]), queue = [entry as [number, number]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = (y + dy) * map.width + x + dx;
      if (!seen.has(k) && canMove(project, map, x, y, x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
    }
  }
  return seen;
};

describe("fields between villages", () => {
  it("connects every exit, stair, bridge and cave (and the ice) under the runtime move rule", () => {
    expect(catalog.plans).toHaveLength(7);
    for (const plan of catalog.plans) {
      const map = maps[plan.id]!, seen = walk(map, plan.entry);
      for (const [x, y] of plan.targets) expect(seen.has(y! * map.width + x!), `${plan.id} ${x},${y}`).toBe(true);
      // Exits sit on the map edge and name the village entrance they meet.
      for (const e of plan.exits) {
        expect(e.x === 0 || e.y === 0 || e.x === map.width - 1 || e.y === map.height - 1).toBe(true);
        expect(e.meets.length).toBeGreaterThan(0);
      }
    }
  });

  it("only climbs a cliff by its stairs", () => {
    for (const plan of catalog.plans.filter((p) => p.stairs.length)) {
      const map = structuredClone(maps[plan.id]!);
      for (const s of plan.stairs) for (let y = s.y; y <= s.y + s.height; y++) for (let x = s.x; x < s.x + 2; x++) map.lowerTiles[y * map.width + x] = village.cliffBindings["172"];
      const seen = walk(map, plan.entry), exitsAbove = plan.exits.filter((e) => e.y < plan.stairs[0]!.y);
      for (const e of exitsAbove) expect(seen.has(e.y * map.width + e.x), `${plan.id} reaches ${e.side} exit without stairs`).toBe(false);
    }
  });

  it("re-points each climate field at its climate sheet with the forest field's numbers", () => {
    for (const plan of catalog.plans.filter((p) => "from" in p && p.from)) {
      const map = maps[plan.id]!, source = maps[(plan as { from: string }).from]!;
      expect(map.tilesetId).toBe(`forest_harmony_${(plan as { climate: string }).climate}`);
      const changed = map.lowerTiles.filter((t, i) => t !== source.lowerTiles[i]).length + map.upperTiles.filter((t, i) => t !== source.upperTiles[i]).length;
      // Only the climate edits differ (autumn: none).
      if ((plan as { climate: string }).climate === "autumn") expect(changed).toBe(0);
      else expect(changed).toBeGreaterThan(0);
    }
  });

  it("reassembles every field raster through bounded AI reads and lists it under 장소", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const };
    const cards = listSpatialGalleryCards(session);
    expect(FIELD_ROUTE_PLACE_REFERENCES).toHaveLength(7);
    for (const entry of FIELD_ROUTE_PLACE_REFERENCES) {
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

  it("seeds one field guidance category per tileset, once", () => {
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
