import { describe, expect, it } from "vitest";
import emerald from "@/project/regionReferences/emerald-basin.json";
import { RETRO_WORLD_TILE_OFFSET } from "@/project/defaults/constants";
import { createForestHarmonyTileset } from "@/project/defaults/forestHarmony";
import { brushRelief, emptyRelief } from "@/project/relief/edit";
import type { ReliefData } from "@/project/relief/types";
import type { GameMap, TilesetDef } from "@/project/types";
import { bakeReliefTiles, planReliefTiles } from "@/editor/tools/village/reliefBake";

const GRASS = 240;
const OFF = RETRO_WORLD_TILE_OFFSET;
const CLIFF_VOCAB = new Set([18, 19, 48, 49, 139, 171, 172, 202, 203, 231, 232, 374]);
const tileset: TilesetDef = createForestHarmonyTileset();

function blankMap(width: number, height: number): GameMap {
  return {
    id: "map_t", name: "t", width, height, tilesetId: tileset.id,
    lowerTiles: new Array(width * height).fill(GRASS),
    upperTiles: new Array(width * height).fill(-1),
  } as unknown as GameMap;
}

function reliefWith(width: number, height: number, paint: (r: ReliefData) => void): ReliefData {
  const r = emptyRelief(width, height);
  paint(r);
  return r;
}

function rect(r: ReliefData, x0: number, y0: number, x1: number, y1: number, level: number): void {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) r.levels[y * r.width + x] = level;
}

function neighbourPairs(width: number, height: number, lower: ArrayLike<number>, offset: number): Set<string> {
  const out = new Set<string>();
  const norm = (t: number) => (CLIFF_VOCAB.has(t - offset) ? t - offset : t === GRASS ? GRASS : undefined);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = norm(lower[y * width + x]!);
      if (t === undefined || t === GRASS) continue;
      for (const [dir, dx, dy] of [["N", 0, -1], ["S", 0, 1], ["W", -1, 0], ["E", 1, 0]] as const) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= width || Y >= height) continue;
        const u = norm(lower[Y * width + X]!);
        if (u !== undefined) out.add(`${t}${dir}${u}`);
      }
    }
  }
  return out;
}

const REF = neighbourPairs(emerald.map.width, emerald.map.height, emerald.map.lowerTiles, 0);
const ALLOWED_EXTRA = new Set(["171W240"]);

describe("relief brush bakes cliffs into lower-layer tiles", () => {
  it("turns a raised rectangle into the reference south wall 139 / 172 / 202", () => {
    const W = 20, H = 14, map = blankMap(W, H);
    map.relief = reliefWith(W, H, (r) => rect(r, 3, 2, 15, 7, 1));
    const result = bakeReliefTiles(map, tileset, undefined)!;
    expect(result.painted).toBeGreaterThan(0);
    expect(map.relief.baked).toBe(true);
    const column = [6, 7, 8].map((y) => map.lowerTiles[y * W + 8]! - OFF);
    expect(column).toEqual([139, 172, 202]);
    expect(map.lowerTiles.slice(0, W * 5).every((t) => t === GRASS)).toBe(true);
  });

  it("only produces neighbour pairs seen in the emerald basin for brushed hills", () => {
    const W = 40, H = 30, map = blankMap(W, H);
    map.relief = reliefWith(W, H, (r) => {
      brushRelief(r, 12, 9, "set", { radius: 5, level: 1 });
      brushRelief(r, 26, 16, "set", { radius: 6, level: 1 });
    });
    bakeReliefTiles(map, tileset, undefined);
    const unseen = [...neighbourPairs(W, H, map.lowerTiles, OFF)].filter((k) => !REF.has(k) && !ALLOWED_EXTRA.has(k));
    expect(unseen).toEqual([]);
    expect(map.lowerTiles.some((t) => t - OFF === 18 || t - OFF === 19)).toBe(true);
  });

  it("leaves a lower-layer edit on a baked cliff cell alone when an unrelated area is brushed", () => {
    const W = 30, H = 16, map = blankMap(W, H);
    map.relief = reliefWith(W, H, (r) => rect(r, 2, 2, 12, 7, 1));
    bakeReliefTiles(map, tileset, undefined);
    const edited = 7 * W + 6;
    expect(map.lowerTiles[edited]! - OFF).toBe(172);
    map.lowerTiles[edited] = 421;
    const previous = structuredClone(map.relief);
    map.relief = reliefWith(W, H, (r) => { r.levels = previous.levels.slice(); rect(r, 18, 3, 27, 8, 1); });
    bakeReliefTiles(map, tileset, previous);
    expect(map.lowerTiles[edited]).toBe(421);
    expect(map.lowerTiles[8 * W + 22]! - OFF).toBe(172);
  });

  it("restores ground when the brush lowers a hill back to 0", () => {
    const W = 20, H = 14, map = blankMap(W, H);
    map.relief = reliefWith(W, H, (r) => rect(r, 3, 2, 15, 7, 1));
    bakeReliefTiles(map, tileset, undefined);
    const previous = structuredClone(map.relief);
    map.relief = emptyRelief(W, H);
    const result = bakeReliefTiles(map, tileset, previous)!;
    expect(result.restored).toBeGreaterThan(0);
    expect(map.lowerTiles.every((t) => t === GRASS)).toBe(true);
  });

  it("does not paint over blocked cells (water, upper decorations)", () => {
    const W = 20, H = 14, map = blankMap(W, H);
    const blocked = 7 * W + 8;
    map.upperTiles[blocked] = 260;
    map.relief = reliefWith(W, H, (r) => rect(r, 3, 2, 15, 7, 1));
    const result = bakeReliefTiles(map, tileset, undefined)!;
    expect(result.kept).toBeGreaterThan(0);
    expect(map.lowerTiles[blocked]).toBe(GRASS);
  });

  it("is a no-op for tilesets without the cliff vocabulary", () => {
    const W = 10, H = 8, map = blankMap(W, H);
    map.relief = reliefWith(W, H, (r) => rect(r, 2, 1, 8, 4, 1));
    const plain = { ...tileset, image: { type: "bundled", id: "tex_other" } } as TilesetDef;
    expect(bakeReliefTiles(map, plain, undefined)).toBeUndefined();
    expect(map.relief.baked).toBeUndefined();
    expect(map.lowerTiles.every((t) => t === GRASS)).toBe(true);
  });

  it("plans nothing for a flat relief", () => {
    expect([...planReliefTiles(emptyRelief(6, 6), 6, 6).tiles].every((t) => t === -1)).toBe(true);
  });
});
