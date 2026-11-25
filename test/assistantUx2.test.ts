import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import { clearActivityAtlasCache, loadActivityTilesetAtlas } from "@/ai/toolImageCanvas";
import type { TilesetDef, GameMap, Project } from "@/project/types";
import { decodeDataUrlPng, installToolImageRasterDom } from "./toolImageRasterDom";
import { captureActivityVisuals } from "@/ai/activityVisual";
import { isolateTimers } from "./mergedTeardown";

describe("assistantUx2ActivityAtlas", () => {
  isolateTimers();
  let restore: () => void;
  beforeEach(() => { restore = installToolImageRasterDom(); clearActivityAtlasCache(); });
  afterEach(() => { clearActivityAtlasCache(); vi.restoreAllMocks(); restore(); });
  function png(red: number, green: number, blue: number): string {
    const image = new PNG({ width: 32, height: 32 });
    for (let i = 0; i < image.data.length; i += 4) image.data.set([red, green, blue, 255], i);
    return `data:image/png;base64,${PNG.sync.write(image).toString("base64")}`;
  }
  function tileset(): TilesetDef {
    return { id: "t", name: "T", image: { type: "uploaded", id: "atlas" }, kind: "custom", tileSize: 16, tilesPerRow: 2, count: 4,
      passability: [{}, {}, {}, {}], priority: ["lower", "lower", "lower", "lower"], terrain: [0, 0, 0, 0], transparentColor: "#ff00ff" };
  }
  function pixel(atlas: HTMLImageElement | HTMLCanvasElement) {
    const url = "toDataURL" in atlas ? atlas.toDataURL() : atlas.src;
    return [...decodeDataUrlPng(url).data.slice(0, 4)];
  }
  describe("activity atlas cache", () => {
    it("coalesces twenty distinct visuals into one keyed atlas and one whole-atlas scan", async () => {
      const context = document.createElement("canvas").getContext("2d")!;
      const scan = vi.spyOn(Object.getPrototypeOf(context), "getImageData");
      const source = png(255, 0, 255), spec = tileset();
      const images = await Promise.all(Array.from({ length: 20 }, () => loadActivityTilesetAtlas(structuredClone(spec), source, new Map())));
      expect(images.every(image => image === images[0])).toBe(true);
      expect(scan).toHaveBeenCalledTimes(1);
      expect(pixel(images[0]!)).toEqual([255, 0, 255, 0]);
      const raw = await loadActivityTilesetAtlas({ ...spec, transparentColor: undefined }, source, new Map());
      expect(pixel(raw)).toEqual([255, 0, 255, 255]);
    });

    it("keys exact captured graft source bytes and refuses absent uploaded sources", async () => {
      const spec = { ...tileset(), tileGrafts: [{ targetTile: 0, sourceChipset: "uploaded-history", sourceTile: 0 }] };
      const base = png(255, 0, 255), oldSources = new Map([["uploaded-history", png(255, 0, 0)]]);
      const old = await loadActivityTilesetAtlas(spec, base, oldSources);
      const next = await loadActivityTilesetAtlas(spec, base, new Map([["uploaded-history", png(0, 0, 255)]]));
      expect(pixel(old)).toEqual([255, 0, 0, 255]);
      expect(pixel(next)).toEqual([0, 0, 255, 255]);
      expect(await loadActivityTilesetAtlas(spec, base, oldSources)).toBe(old);
      await expect(loadActivityTilesetAtlas(spec, base, new Map())).rejects.toThrow("Graft atlas snapshot unavailable");
    });

    it("evicts older atlases once the retained entry bound is exceeded", async () => {
      const spec = tileset(), source = png(1, 2, 3);
      const first = await loadActivityTilesetAtlas(spec, source, new Map());
      for (let i = 10; i < 19; i++) await loadActivityTilesetAtlas(spec, png(i, 2, 3), new Map());
      expect(await loadActivityTilesetAtlas(spec, source, new Map())).not.toBe(first);
    });
  });
});

describe("assistantUx2ActivityVisual", () => {
  isolateTimers();
  afterEach(() => vi.restoreAllMocks());
  function fixture() {
    const tileset: TilesetDef = { id: "t", name: "T", image: { type: "uploaded", id: "atlas" }, kind: "custom",
      tileSize: 16, tilesPerRow: 2, count: 2, passability: [{}, {}], priority: ["lower", "upper"], terrain: [0, 0] };
    const map: GameMap = { id: "m", name: "M", width: 128, height: 128, tileSize: 16, tilesetId: "t",
      lowerTiles: Array(128 * 128).fill(0), upperTiles: Array(128 * 128).fill(-1), events: [],
      lowerOverlayTiles: Array(128 * 128).fill(-1), upperOverlayTiles: Array(128 * 128).fill(-1), shadowBits: Array(128 * 128).fill(0),
      relief: { width: 128, height: 128, levels: Array(128 * 128).fill(1), wallDecor: [{ x: 11, y: 12, row: 1, tile: 1 }] },
      terrainDesign: { waterDepth: Array(128 * 128).fill(1), lockedCells: [12 * 128 + 11] },
      doodadGroups: [{ id: "inside", label: "group", kitId: "kit", cells: [{ index: 12 * 128 + 11, tile: 1, before: 0 }, { index: 0, tile: 1, before: 0 }] }] };
    map.lowerOverlayTiles![12 * 128 + 11] = 1; map.upperOverlayTiles![12 * 128 + 11] = 1; map.shadowBits![12 * 128 + 11] = 3;
    const project = { maps: { m: map }, tilesets: { t: tileset }, database: {}, assets: { uploaded: {
      atlas: { id: "atlas", name: "atlas", kind: "tileset", dataUrl: "data:image/png;base64,YQ==", meta: {} },
    } } } as unknown as Project;
    return { project, map, tileset };
  }
  const capture = (project: Project) => captureActivityVisuals(project, "paint_tiles", { mapId: "m", x: 11, y: 12, width: 12, height: 8 })[0]!;
  describe("bounded immutable activity capture", () => {
    it("crops auxiliary grids before cloning while retaining layer order and rebased memberships", () => {
      const { project, map } = fixture();
      const before = structuredClone(map);
      for (const values of [map.lowerOverlayTiles!, map.upperOverlayTiles!, map.shadowBits!, map.relief!.levels]) {
        vi.spyOn(values, "slice").mockImplementation(() => { throw new Error("full auxiliary clone"); });
      }
      const visual = capture(project), crop = visual.map!;
      expect(crop).toMatchObject({ width: 12, height: 8, relief: { width: 12, height: 8, wallDecor: [{ x: 1, y: 1, row: 1, tile: 1 }] },
        terrainDesign: { lockedCells: [13] }, doodadGroups: [{ id: "inside", cells: [{ index: 13, tile: 1, before: 0 }] }] });
      expect([crop.lowerOverlayTiles![13], crop.upperOverlayTiles![13], crop.shadowBits![13], crop.relief!.levels[13], crop.terrainDesign!.waterDepth![13]]).toEqual([1, 1, 3, 1, 1]);
      expect(crop.relief!.levels).toHaveLength(96);
      expect(map.relief!.wallDecor).toEqual(before.relief!.wallDecor);
      expect(map.doodadGroups).toEqual(before.doodadGroups);
      expect(map.terrainDesign).toEqual(before.terrainDesign);
    });

    it("shares frozen tileset snapshots and retains uploaded graft bytes across replacements", () => {
      const { project, tileset } = fixture();
      tileset.tileGrafts = [{ targetTile: 1, sourceChipset: "source", sourceTile: 0 }];
      project.assets.uploaded.source = { id: "source", name: "source", kind: "tileset", dataUrl: "old pixels", meta: {} };
      const first = capture(project), second = capture(project);
      expect(first.tileset).toBe(second.tileset);
      expect(first.tileset).not.toBe(tileset);
      expect(Object.isFrozen(first.tileset)).toBe(true);
      project.tilesets.t = { ...tileset, transparentColor: "#ffffff" };
      project.assets.uploaded.source = { ...project.assets.uploaded.source, dataUrl: "new pixels" };
      const next = capture(project);
      expect(first.graftAssets!.source!.dataUrl).toBe("old pixels");
      expect(next.graftAssets!.source!.dataUrl).toBe("new pixels");
      expect(next.tileset).not.toBe(first.tileset);
    });

    it("rejects oversized tileset metadata before allocating a snapshot or auxiliary crop", () => {
      const { project, tileset } = fixture();
      tileset.name = "x".repeat(1_100_001);
      const clone = vi.spyOn(globalThis, "structuredClone");
      expect(captureActivityVisuals(project, "paint_tiles", { mapId: "m" })).toEqual([]);
      expect(clone).not.toHaveBeenCalled();
    });
  });
});
