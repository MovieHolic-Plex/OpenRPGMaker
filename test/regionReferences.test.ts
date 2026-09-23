// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import { REGION_REFERENCES, PLACE_REFERENCES, regionReferenceContext } from "@/project/regionReferences";
import { preloadAllRegionReferences, readRegionReference } from "@/project/regionReferenceSnapshots";
import emeraldSnapshot from "@/project/regionReferences/emerald-basin.json";
import hillSnapshot from "@/project/regionReferences/hill-forest-village.json";
import { COMBINED_TOWN_RETRO_WORLD_TILESET_ID } from "@/project/defaults/constants";
import { SHIP_PLACE_REFERENCES } from "@/project/shipPlaceReferences";
import ships from "@/project/regionReferences/ships.json";
import { existsSync } from "node:fs";
import snapshot from "@/project/regionReferences/walled-settlement.json";
import lakeSnapshot from "@/project/regionReferences/lake-village.json";
import { renderSpatialPlacesStage, spatialPlacesTabChrome } from "@/editor/panels/spatialPlacesTab";
import castleSnapshot from "@/project/regionReferences/castle-town.json";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { renderSpatialRegionsCanvas, renderSpatialRegionsInspector, spatialRegionsChrome } from "@/editor/panels/spatialRegionsTab";

// Snapshots are per-file lazy chunks; the synchronous reads below need them loaded.
beforeAll(preloadAllRegionReferences);

const id = REGION_REFERENCES[0].id;
describe("completed region references", () => {
  it("reassembles every frozen tile and its passage metadata through bounded AI reads", () => {
    const project = createBlankProject(), before = JSON.stringify(project), lower: number[] = [], upper: number[] = [];
    let row: number | null = 0;
    while (row !== null) {
      const result = runTool({ project }, "read_region_reference", { id, row, rows: 8 });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as ReturnType<typeof readRegionReference>;
      lower.push(...data.map.lowerTiles); upper.push(...data.map.upperTiles);
      for (const tile of data.tileset.tiles) expect(tile.passability).toEqual(snapshot.tileset.passability[tile.tile]);
      row = data.map.nextRow;
    }
    expect(lower).toEqual(snapshot.map.lowerTiles); expect(upper).toEqual(snapshot.map.upperTiles);
    expect(JSON.stringify(project)).toBe(before);
    expect(regionReferenceContext()).toContain(id);
  });
  it("shows the full emerald field as a default natural place without a project-owned region", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const, placeKindFilter: "natural" as const };
    const card = listSpatialGalleryCards(session).find(c => c.regionReferenceId === "emerald-basin-80x64");
    expect(card?.source).toBe("default");
    const project = createBlankProject();
    expect(project.maps[emeraldSnapshot.map.id]).toBeUndefined();
    const before = JSON.stringify(project), lower: number[] = [], upper: number[] = [];
    let row: number | null = 0;
    while (row !== null) {
      const result = runTool({ project }, "read_region_reference", { id: card!.regionReferenceId, row, rows: 16 });
      expect(result.ok, result.summary).toBe(true);
      const page = result.data as ReturnType<typeof readRegionReference>;
      lower.push(...page.map.lowerTiles); upper.push(...page.map.upperTiles);
      row = page.map.nextRow;
    }
    expect(lower).toEqual(emeraldSnapshot.map.lowerTiles);
    expect(upper).toEqual(emeraldSnapshot.map.upperTiles);
    expect(JSON.stringify(project)).toBe(before);
    expect(renderSpatialPlacesStage(session, card, () => {}).canvas.querySelector("img")?.getAttribute("src"))
      .toBe("/assets/region-references/emerald-basin.png");
  });
  it("ships the hill forest village as a default settlement place with the mixed chipset frozen alongside", () => {
    const hillId = "hill-forest-village-64x64";
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const, placeKindFilter: "settlement" as const };
    const card = listSpatialGalleryCards(session).find(c => c.regionReferenceId === hillId);
    expect(card?.source).toBe("default");
    expect(card?.placeKind).toBe("settlement");
    expect(existsSync("public/assets/region-references/hill-forest-village.png")).toBe(true);
    const project = createBlankProject();
    expect(project.maps[hillSnapshot.map.id]).toBeUndefined();
    const before = JSON.stringify(project), lower: number[] = [], upper: number[] = [];
    let row: number | null = 0;
    while (row !== null) {
      const result = runTool({ project }, "read_region_reference", { id: hillId, row, rows: 16 });
      expect(result.ok, result.summary).toBe(true);
      const page = result.data as ReturnType<typeof readRegionReference>;
      expect(page.map.width).toBe(64);
      lower.push(...page.map.lowerTiles); upper.push(...page.map.upperTiles);
      for (const tile of page.tileset.tiles) {
        expect(tile.passability).toEqual(hillSnapshot.tileset.passability[tile.tile]);
        expect(tile.priority).toEqual(hillSnapshot.tileset.priority[tile.tile]);
      }
      row = page.map.nextRow;
    }
    expect(lower).toEqual(hillSnapshot.map.lowerTiles); expect(upper).toEqual(hillSnapshot.map.upperTiles);
    expect(JSON.stringify(project)).toBe(before);
    // 저장본은 혼합 칩셋(1140칸) 위의 마을이고, 숲 나무 확장 띠(960~)와 언덕 어휘(레트로 반쪽 480~959)를 실제로 쓴다.
    expect(hillSnapshot.tileset.id).toBe(COMBINED_TOWN_RETRO_WORLD_TILESET_ID);
    expect(hillSnapshot.tileset.count).toBe(1140);
    const used = new Set([...hillSnapshot.map.lowerTiles, ...hillSnapshot.map.upperTiles]);
    expect([...used].filter(tile => tile >= 960).length).toBeGreaterThan(50);
    expect([...used].filter(tile => tile >= 480 && tile < 960).length).toBeGreaterThan(5);
    // 주민 배치만 남기고 실내로 가는 집 문 이벤트는 뺐다.
    expect(hillSnapshot.map.events.length).toBe(12);
    expect(hillSnapshot.map.events.every(event => event.id.startsWith("ev_village_"))).toBe(true);
    expect(renderSpatialPlacesStage(session, card, () => {}).canvas.querySelector("img")?.getAttribute("src"))
      .toBe("/assets/region-references/hill-forest-village.png");
    expect(regionReferenceContext()).toContain(hillId);
  });
  it("reads the castle raster rather than the settlement and exposes it in the gallery", () => {
    const castleId = "castle-town-100x100", lower: number[] = [], upper: number[] = [];
    let row: number | null = 0;
    while (row !== null) {
      const page = readRegionReference(castleId, row, 16);
      expect(page.map.width).toBe(100);
      lower.push(...page.map.lowerTiles); upper.push(...page.map.upperTiles);
      for (const tile of page.tileset.tiles) {
        expect(tile.passability).toEqual(castleSnapshot.tileset.passability[tile.tile]);
        expect(tile.priority).toEqual(castleSnapshot.tileset.priority[tile.tile]);
      }
      row = page.map.nextRow;
    }
    expect(lower).toEqual(castleSnapshot.map.lowerTiles); expect(upper).toEqual(castleSnapshot.map.upperTiles);
    const cards = listSpatialGalleryCards({ ...spatialSession(), tab: "regions", mode: "design", source: "defaults", regionKindFilter: "settlement" });
    expect(cards.some(c => c.regionReferenceId === castleId)).toBe(true);
    expect(regionReferenceContext()).toContain(castleId);
    expect(() => readRegionReference(castleId, 100)).toThrow();
  });
  it("reconstructs the lake and exact place crops without exposing mutation actions", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const };
    const cards = listSpatialGalleryCards(session);
    const lake = readRegionReference("lake-village-60x60", 0, 16);
    expect(lake.map.lowerTiles).toEqual(lakeSnapshot.map.lowerTiles.slice(0, 60 * 16));
    for (const place of PLACE_REFERENCES.filter(p => p.sourceMapId === lakeSnapshot.map.id)) {
      const page = readRegionReference(place.id, 0, 16);
      const expected = Array.from({length: place.height}, (_, y) => lakeSnapshot.map.lowerTiles.slice((place.y+y)*60+place.x, (place.y+y)*60+place.x+place.width)).flat();
      expect(page.map.lowerTiles).toEqual(expected);
      expect(page.map.nextRow).toBeNull();
      const card = cards.find(c => c.regionReferenceId === place.id);
      expect(card).toBeDefined();
      const stage = renderSpatialPlacesStage(session, card, () => {});
      expect(stage.canvas.querySelector("img")?.getAttribute("src")).toBe(place.preview);
      expect(spatialPlacesTabChrome(card, () => {})).not.toHaveProperty("apply");
      const result = runTool({project:createBlankProject()}, "read_region_reference", {});
      expect(JSON.stringify(result.data)).toContain(place.id);
    }
  });
  it("ships all seven saved maps as default places independent of project activation", () => {
    const session = { ...spatialSession(), tab: "places" as const, mode: "design" as const, source: "defaults" as const };
    const cards = listSpatialGalleryCards(session);
    expect(SHIP_PLACE_REFERENCES).toHaveLength(4);
    for (const entry of SHIP_PLACE_REFERENCES) {
      const expected = ships.maps[entry.sourceMapId as keyof typeof ships.maps];
      const lower: number[] = [], upper: number[] = [];
      let row: number | null = 0;
      while (row !== null) {
        const page = readRegionReference(entry.id, row, 16);
        lower.push(...page.map.lowerTiles); upper.push(...page.map.upperTiles);
        expect(page.map.events).toEqual(expected.events);
        row = page.map.nextRow;
      }
      expect(lower).toEqual(expected.lowerTiles); expect(upper).toEqual(expected.upperTiles);
      const card = cards.find(c => c.regionReferenceId === entry.id)!;
      expect(card.source).toBe("default");
      expect(renderSpatialPlacesStage(session, card, () => {}).canvas.querySelector("img")?.getAttribute("src")).toBe(entry.preview);
      expect(existsSync(`public${entry.preview}`)).toBe(true);
      expect(regionReferenceContext()).toContain(entry.id);
    }
    expect(ships.maps.map_bluewave_harbor.width).toBe(64);
  });
  it("rejects unknown IDs and invalid pages; returned rasters cannot mutate the source", () => {
    expect(() => readRegionReference("missing")).toThrow();
    for (const row of [-1, 45, 1.5, NaN]) expect(() => readRegionReference(id, row)).toThrow();
    expect(() => readRegionReference(id, 0, 17)).toThrow();
    const page = readRegionReference(id); page.map.lowerTiles[0] = -999;
    expect(readRegionReference(id).map.lowerTiles[0]).not.toBe(-999);
  });
  it("is visible in settlement gallery without activation and exposes a read-only preview", () => {
    const session = { ...spatialSession(), tab: "regions" as const, mode: "design" as const, source: "defaults" as const, regionKindFilter: "settlement" as const };
    const card = listSpatialGalleryCards(session).find(c => c.regionReferenceId === id)!;
    expect(card).toBeDefined(); expect(card.canonicalSource).toBeUndefined();
    const canvas = renderSpatialRegionsCanvas(session, card, () => {});
    expect(canvas.dataset.testid).toBe("spatial-canvas");
    expect(canvas.querySelector("img")?.getAttribute("src")).toBe(REGION_REFERENCES[0].preview);
    expect(renderSpatialRegionsInspector(session, card, () => {}).textContent).toContain("3칸");
    const chrome = spatialRegionsChrome(card, () => {});
    expect(chrome).not.toHaveProperty("apply"); expect(chrome).not.toHaveProperty("activate");
  });
});
