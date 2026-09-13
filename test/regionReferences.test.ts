// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { REGION_REFERENCES, readRegionReference, regionReferenceContext } from "@/project/regionReferences";
import snapshot from "@/project/regionReferences/walled-settlement.json";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { renderSpatialRegionsCanvas, renderSpatialRegionsInspector, spatialRegionsChrome } from "@/editor/panels/spatialRegionsTab";

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
