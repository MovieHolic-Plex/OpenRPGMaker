import { describe, expect, it } from "vitest";
import emerald from "@/project/regionReferences/emerald-basin.json";
import { buildWall, CLIFF_TILE, erodeToSlope1, wallColumn } from "@/editor/tools/village/cliffGrammar";
import { paintRelief, paintReliefStairs, planRelief, rasterize, type Plateau } from "@/editor/tools/village/relief";

const CLIFF_VOCAB = new Set([18, 19, 48, 49, 139, 171, 172, 202, 203, 231, 232, 374]);
const GRASS = 240;
// 참고 맵에 잔디 옆 왼쪽 벽 끝이 없어(늘 길·맵 가장자리) 171 의 서쪽 잔디만 예외로 둔다.
const ALLOWED_EXTRA = new Set(["171W240"]);

function neighbourPairs(width: number, height: number, lower: ArrayLike<number>): Map<string, number> {
  const out = new Map<string, number>();
  const norm = (t: number) => (CLIFF_VOCAB.has(t) || t === GRASS ? t : undefined);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = lower[y * width + x]!;
      if (!CLIFF_VOCAB.has(t)) continue;
      for (const [dir, dx, dy] of [["N", 0, -1], ["S", 0, 1], ["W", -1, 0], ["E", 1, 0]] as const) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= width || Y >= height) continue;
        const u = norm(lower[Y * width + X]!);
        if (u === undefined) continue;
        const key = `${t}${dir}${u}`;
        out.set(key, (out.get(key) ?? 0) + 1);
      }
    }
  }
  return out;
}

const REF_PAIRS = neighbourPairs(emerald.map.width, emerald.map.height, emerald.map.lowerTiles);

function unseenPairs(width: number, height: number, lower: ArrayLike<number>): string[] {
  return [...neighbourPairs(width, height, lower).keys()].filter((key) => !REF_PAIRS.has(key) && !ALLOWED_EXTRA.has(key));
}

function blankMap(width: number, height: number) {
  return { width, height, lowerTiles: new Array(width * height).fill(GRASS), upperTiles: new Array(width * height).fill(-1) } as never as Parameters<typeof paintRelief>[0];
}

describe("south-wall cliff grammar (emerald basin)", () => {
  it("builds the reference flat column 139 / 172 / 202 and diagonal columns 18-231-48, 19-232-49", () => {
    expect(wallColumn(0, 5, 5, 7, 7, false, false).map((c) => c.tile)).toEqual([139, 172, 202]);
    expect(wallColumn(0, 5, 6, 7, 8, false, false).map((c) => c.tile)).toEqual([18, 231, 48]);
    expect(wallColumn(0, 6, 5, 8, 7, false, false).map((c) => c.tile)).toEqual([19, 232, 49]);
  });

  it("rejects a lip slope without a matching foot slope (231 over 49 never appears)", () => {
    expect(() => wallColumn(0, 5, 6, 7, 7, false, false)).toThrow(/matching foot/);
    expect(() => wallColumn(0, 5, 7, 7, 9, false, false)).toThrow(/45°/);
  });

  it("limits the lip to 45° and removes one-column south spikes", () => {
    expect(erodeToSlope1([0, 5, 5, 0])).toEqual([0, 1, 1, 0]);
    expect(erodeToSlope1([3, 4, 3])).toEqual([3, 3, 3]);
  });

  it("buries exposed ends like the reference (left 139/171/48, right 139/172/49 then 139/203)", () => {
    const { cells } = buildWall({ xa: 0, xb: 8, rawLip: new Array(9).fill(4), height: 2, exposedLeft: true, exposedRight: true });
    const column = (x: number) => cells.filter((c) => c.x === x).sort((a, b) => a.y - b.y).map((c) => c.tile);
    expect(column(0)).toEqual([CLIFF_TILE.lip, CLIFF_TILE.capLeftFace, CLIFF_TILE.grassSW]);
    expect(column(3)).toEqual([139, 172, 202]);
    expect(column(6)).toEqual([139, 172, 49]);
    expect(column(7)).toEqual([139, 203]);
  });

  it("paints hills whose every neighbour pair already occurs in the emerald basin", () => {
    const W = 48, H = 34;
    const shapes: Plateau[][] = [
      [{ level: 1, parts: [{ x0: -2, y0: -3, x1: W + 2, y1: 12, nw: 0, ne: 0, sw: 5, se: 4 }, { x0: 14, y0: 8, x1: 26, y1: 18, nw: 0, ne: 0, sw: 3, se: 2 }] }],
      [{ level: 1, parts: [{ x0: -3, y0: -2, x1: 14, y1: 26, nw: 0, ne: 3, sw: 0, se: 5 }] }],
      [{ level: 1, parts: [{ x0: 8, y0: 6, x1: 26, y1: 20, nw: 3, ne: 3, sw: 4, se: 4 }] }, { level: 2, parts: [{ x0: 13, y0: 10, x1: 21, y1: 15, nw: 1, ne: 2, sw: 2, se: 1 }] }],
    ];
    for (const plateaus of shapes) {
      const map = blankMap(W, H);
      paintRelief(map, rasterize(plateaus, W, H, { x: 0, y: 0, w: W, h: H }), 0);
      expect(unseenPairs(W, H, map.lowerTiles)).toEqual([]);
    }
    for (const seed of [1, 3, 7, 11, 19, 42]) {
      const map = blankMap(64, 48);
      const plan = planRelief({ area: { x: 0, y: 0, w: 64, h: 48 }, mapWidth: 64, mapHeight: 48, seed });
      expect(paintRelief(map, plan, 0).painted).toBeGreaterThan(0);
      expect(unseenPairs(64, 48, map.lowerTiles), `seed ${seed}`).toEqual([]);
    }
  });

  it("keeps plateau tops and the north side as plain grass (no 231 ring, no 108/110 edges)", () => {
    const W = 30, H = 24, map = blankMap(W, H);
    const plan = rasterize([{ level: 1, parts: [{ x0: 6, y0: 4, x1: 22, y1: 14, nw: 3, ne: 3, sw: 3, se: 3 }] }], W, H, { x: 0, y: 0, w: W, h: H });
    paintRelief(map, plan, 0);
    for (let y = 0; y < 10; y += 1) for (let x = 0; x < W; x += 1) expect(map.lowerTiles[y * W + x], `${x},${y}`).toBe(GRASS);
    expect(map.lowerTiles.filter((t) => t === 108 || t === 110 || t === 78 || t === 79 || t === 80)).toEqual([]);
  });

  it("turns a road crossing a flat column into 374 below the lip, leaving diagonal crossings as road", () => {
    const W = 30, H = 24, ROAD = 597, map = blankMap(W, H);
    const plan = rasterize([{ level: 1, parts: [{ x0: -2, y0: -2, x1: W + 2, y1: 10, nw: 0, ne: 0, sw: 0, se: 0 }] }], W, H, { x: 0, y: 0, w: W, h: H });
    paintRelief(map, plan, 0);
    for (let y = 0; y < H; y += 1) map.lowerTiles[y * W + 12] = ROAD;
    expect(paintReliefStairs(map, plan, (t) => t === ROAD, 0)).toBe(2);
    expect([9, 10, 11].map((y) => map.lowerTiles[y * W + 12])).toEqual([ROAD, 374, 374]);
  });
});
