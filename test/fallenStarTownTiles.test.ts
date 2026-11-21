import { readFileSync } from "node:fs";
import type Phaser from "phaser";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { registerTilesetTextureFrames } from "@/assets/bundled";
import { chipsetBandRects, chipsetNeedsBands, tileFrameOrigin } from "@/assets/chipsetTextureBands";

const TILE = 16;
const PER_ROW = 128;

type FrozenTown = {
  map: {
    id: string;
    name: string;
    width: number;
    height: number;
    tilesetId: string;
    lowerTiles: number[];
    upperTiles: number[];
  };
  tilesets: Record<string, { baseCount: number; count: number }>;
};

/** frozenTowns.ts `shiftTile` 과 같다. 기록 때보다 시트가 길어진 덧붙임 칸만 지금 꼬리로 옮긴다. */
function shiftTile(tile: number, base: number, delta: number, shift: number): number {
  return tile >= base && tile < base + delta ? tile + shift : tile;
}

function tileBox(tile: number): { x: number; y: number } {
  return { x: (tile % PER_ROW) * TILE, y: Math.floor(tile / PER_ROW) * TILE };
}

function opaquePixels(png: PNG, tile: number): { count: number; r: number; g: number; b: number } {
  const { x, y } = tileBox(tile);
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let py = y; py < y + TILE; py += 1) {
    for (let px = x; px < x + TILE; px += 1) {
      const i = (py * png.width + px) * 4;
      if ((png.data[i + 3] ?? 0) <= 200) continue;
      count += 1;
      r += png.data[i] ?? 0;
      g += png.data[i + 1] ?? 0;
      b += png.data[i + 2] ?? 0;
    }
  }
  return count === 0 ? { count, r: 0, g: 0, b: 0 } : { count, r: r / count, g: g / count, b: b / count };
}

describe("폴른 스타 왕도 아스텔 tiles", () => {
  const sheet = JSON.parse(readFileSync("src/assets/beodeulCitySheet.json", "utf8")) as { count: number; tilesPerRow: number };
  const town = (JSON.parse(readFileSync("src/project/flagship/fallen/frozenTowns.json", "utf8")) as { towns: Record<string, FrozenTown> }).towns.fs_hub!;
  const append = town.tilesets.beodeul_city!;
  const delta = append.count - append.baseCount;
  const shift = sheet.count - append.baseCount;
  const png = PNG.sync.read(readFileSync("public/assets/beodeul-city/beodeul-city-chipset.png"));
  const pngTiles = Math.floor(png.height / TILE) * sheet.tilesPerRow;
  const lower = town.map.lowerTiles.map((tile) => shiftTile(tile, append.baseCount, delta, shift));
  const upper = town.map.upperTiles.map((tile) => shiftTile(tile, append.baseCount, delta, shift));

  it("points the frozen town at opaque pixels on the live Beodeul sheet", () => {
    expect(town.map).toMatchObject({ id: "fs_hub", name: "왕도 아스텔", width: 56, height: 44, tilesetId: "beodeul_city" });
    expect(sheet).toMatchObject({ count: 61312, tilesPerRow: PER_ROW });
    expect(png.width).toBe(2048);
    expect(png.height).toBeGreaterThan(2048);
    expect(pngTiles).toBe(sheet.count);
    expect(lower.filter((tile) => tile === 737).length).toBeGreaterThan(1000);

    const inSheet = (tile: number) => tile >= 0 && tile < sheet.count;
    for (const tile of new Set(lower.filter(inSheet))) {
      expect(opaquePixels(png, tile).count, `lower tile ${tile}`).toBeGreaterThan(0);
    }
    for (const tile of new Set(upper.filter(inSheet))) {
      expect(opaquePixels(png, tile).count, `upper tile ${tile}`).toBeGreaterThan(0);
    }
    const grass = opaquePixels(png, 737);
    expect(grass.count).toBe(TILE * TILE);
    expect(grass.g).toBeGreaterThan(grass.r);
    expect(grass.g).toBeGreaterThan(grass.b);
    expect(upper.some((tile) => tile >= sheet.count)).toBe(true);
    expect(lower.every((tile) => tile < 0 || tile < sheet.count)).toBe(true);
  });

  it("addresses town tiles on 2048px bands, including ground past the first band and the graft tail", () => {
    expect(chipsetNeedsBands(png.width, png.height)).toBe(true);
    const rects = chipsetBandRects(png.width, png.height);
    expect(rects).not.toBeNull();
    expect(rects!.every((rect) => rect.width <= 2048 && rect.height <= 2048 && rect.height % TILE === 0)).toBe(true);
    expect(rects!.reduce((sum, rect) => sum + rect.height, 0)).toBe(png.height);

    const pastFirstBand = lower.find((tile) => tile >= 0 && tileBox(tile).y >= 2048);
    expect(pastFirstBand).toBeTypeOf("number");
    const ground = tileFrameOrigin(pastFirstBand!, PER_ROW, TILE, rects!.length, 2048, 2048, 1);
    expect(ground.sourceIndex).toBeGreaterThanOrEqual(1);
    expect(ground.y).toBe(tileBox(pastFirstBand!).y - ground.sourceIndex * 2048);
    expect(ground.y + TILE).toBeLessThanOrEqual(rects![ground.sourceIndex]!.height);

    const graftTile = upper.find((tile) => tile >= sheet.count)!;
    const bakedTiles = sheet.count + delta;
    const bakedHeight = Math.ceil(bakedTiles / PER_ROW) * TILE;
    const baked = chipsetBandRects(2048, bakedHeight)!;
    const graft = tileFrameOrigin(graftTile, PER_ROW, TILE, baked.length, 2048, 2048, 1);
    expect(graft.sourceIndex).toBe(baked.length - 1);
    expect(graft.y + TILE).toBeLessThanOrEqual(baked[graft.sourceIndex]!.height);
    expect(tileFrameOrigin(pastFirstBand!, PER_ROW, TILE, 1, 2048, png.height, 1).sourceIndex).toBe(0);
  });

  it("registers a lazy frame on the band that holds the town tile", () => {
    const tile = lower.find((index) => index >= 0 && tileBox(index).y >= 2048)!;
    const frames: Record<string, { name: string }> = {};
    const added: unknown[][] = [];
    const texture = {
      key: "tex_probe",
      source: [
        { width: 2048, height: 2048 },
        { width: 2048, height: 2048 },
        { width: 2048, height: 2048 },
        { width: 2048, height: png.height - 6144 },
      ],
      __oprnBandCols: 1,
      frames,
      get(name?: string | number) { return frames[String(name)]; },
      has(name: string) { return frames[name] !== undefined; },
      add(name: string, sourceIndex: number, x: number, y: number, width: number, height: number) {
        added.push([name, sourceIndex, x, y, width, height]);
        frames[name] = { name };
        return frames[name];
      },
      getFrameNames() { return Object.keys(frames); },
    };
    const scene = {
      textures: { get: () => texture, exists: () => true },
      anims: { exists: () => false, create: () => undefined },
    } as unknown as Phaser.Scene;

    registerTilesetTextureFrames(scene, "tex_probe", Math.max(tile + 1, 4097), TILE, PER_ROW);
    texture.get(`tile_${tile}`);

    const origin = tileFrameOrigin(tile, PER_ROW, TILE, texture.source.length, 2048, 2048, 1);
    expect(added).toContainEqual([`tile_${tile}`, origin.sourceIndex, origin.x, origin.y, TILE, TILE]);
    expect(origin.sourceIndex).toBeGreaterThanOrEqual(1);
  });
});
