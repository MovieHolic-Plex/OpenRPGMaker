import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import { clearActivityAtlasCache, loadActivityTilesetAtlas } from "@/ai/toolImageCanvas";
import type { TilesetDef } from "@/project/types";
import { decodeDataUrlPng, installToolImageRasterDom } from "./toolImageRasterDom";

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
