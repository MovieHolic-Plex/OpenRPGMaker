import type { AutotileGroup, GameMap, Rect } from "@/project/types";
import { forestTrunkCandidates } from "./forestTrunkTiles";
import type { ForestGroveReport } from "./forestGroves";

const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]] as const;

/** Seeded coherent value noise; smooth interpolation, never a per-tile coin flip. */
function noise(x: number, y: number, seed: number): number {
  const hash = (a: number, b: number): number => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const ease = (v: number): number => v * v * v * (v * (v * 6 - 15) + 10);
  const tx = ease(x - ix), ty = ease(y - iy);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), tx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), tx), ty);
}

function fbm(x: number, y: number, seed: number): number {
  return (noise(x, y, seed) + 0.5 * noise(x * 2, y * 2, seed ^ 0x45d9f3b)
    + 0.25 * noise(x * 4, y * 4, seed ^ 0x119de1f3)) / 1.75;
}

/** A continuous, warped implicit clearing: coarse bends and fine edge variation
 * are separate scales. This adapts multiscale control to a tile mask, not the
 * volumetric renderer or Phasor erosion algorithm in the cited research.
 * See openwiki/village-layout-research.md for primary sources and scope. */
export function forestContourScore(x: number, y: number, area: Rect, seed: number, coverage: number): number {
  const px = x - area.x, py = y - area.y;
  const wx = px + 7.5 * fbm(px / 9, py / 9, seed ^ 0x23a17);
  const wy = py + 7.5 * fbm(px / 9 + 9.7, py / 9 - 3.2, seed ^ 0x734a1);
  const rx = area.w * 0.4, ry = area.h * 0.43;
  const clearing = (Math.hypot((wx - area.w / 2) / rx, (wy - area.h / 2) / ry) - 1) * Math.min(rx, ry);
  return clearing + 7 * fbm(wx / 8, wy / 8, seed ^ 0x91671)
    + 1.2 * noise(wx / 3, wy / 3, seed ^ 0x75931) + (coverage - 0.4) * 7;
}

/** Continuous contour fitted to the approved cliff-village trunk assemblies.
 * Root pixels, full three-row height and end caps are shared with legacy groves. */
export function paintContouredForest(map: GameMap, area: Rect, group: AutotileGroup,
  free: (x: number, y: number) => boolean, seed: number, coverage: number,
  desired?: (x: number, y: number) => boolean): ForestGroveReport {
  const W = map.width;
  const inside = (x: number, y: number): boolean => x >= Math.max(0, area.x) && y >= Math.max(0, area.y)
    && x < Math.min(W, area.x + area.w) && y < Math.min(map.height, area.y + area.h);
  const open = (x: number, y: number): boolean => inside(x, y) && free(x, y)
    && !map.lowerTileStacks?.[y * W + x]?.length && !map.upperTileStacks?.[y * W + x]?.length;
  const candidates: { index: number; score: number }[] = [];
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    // At the map boundary the forest continues out of view. Reserving two root
    // rows there created an artificial straight treeline across the whole map.
    if (!open(x, y) || (y + 1 < map.height && !open(x, y + 1))
      || (y + 2 < map.height && !open(x, y + 2)) || (desired && !desired(x, y))) continue;
    const score = forestContourScore(x + 0.5, y + 0.5, area, seed, coverage);
    if (score > 0) candidates.push({ index: y * W + x, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const forest = new Set(candidates.slice(0, Math.floor(area.w * area.h * Math.max(0, Math.min(1, coverage)))).map(c => c.index));
  const f = (x: number, y: number): boolean => inside(x, y) && forest.has(y * W + x);
  // Discard isolated flecks, preserving curved diagonal connections and bays.
  const seen = new Set<number>();
  for (const start of forest) {
    if (seen.has(start)) continue;
    const component = [start]; seen.add(start);
    for (let i = 0; i < component.length; i++) {
      const index = component[i]!, x = index % W, y = Math.floor(index / W);
      for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
        const next = (y + dy) * W + x + dx;
        if (f(x + dx, y + dy) && !seen.has(next)) { seen.add(next); component.push(next); }
      }
    }
    if (component.length < 8) component.forEach(index => forest.delete(index));
  }
  let trunks = new Map<number, number>(), trunkRuns = 0;
  // Fit complete roots, never substitute a different tree or crop a trunk. A
  // failed placement retracts only the exposed row, retaining one-cell bends.
  // Every retry removes cells, so repair is bounded by the initial mask size.
  const repairLimit = forest.size;
  for (let attempt = 0; attempt <= repairLimit; attempt++) {
    trunks = new Map(); trunkRuns = 0;
    let invalid: { x: number; y: number; width: number } | undefined;
    outer: for (let y = area.y; y < area.y + area.h; y++) {
      // The forest continues past the bottom of the map; no roots are visible.
      if (y === map.height - 1) continue;
      for (let x = area.x; x < area.x + area.w; x++) {
        if (!f(x, y) || f(x, y + 1) || (trunks.has(y * W + x) && trunks.has((y + 1) * W + x))) continue;
        const start = x;
        while (f(x + 1, y) && !f(x + 1, y + 1)
          && !(trunks.has(y * W + x + 1) && trunks.has((y + 1) * W + x + 1))) x++;
        const width = x - start + 1;
        const candidates = forestTrunkCandidates(start, width);
        const candidate = candidates.find(c => c.rows.every((row, dy) => row.every((tile, dx) => {
          const cx = c.x + dx, cy = y + dy, index = cy * W + cx;
          return open(cx, cy) && f(cx, y)
            && (!trunks.has(index) || trunks.get(index) === tile);
        })));
        if (!candidate) { invalid = { x: start, y, width }; break outer; }
        candidate.rows.forEach((row, dy) => row.forEach((tile, dx) => trunks.set((y + dy) * W + candidate.x + dx, tile)));
        trunkRuns++;
      }
    }
    if (!invalid) break;
    for (let x = invalid.x; x < invalid.x + invalid.width; x++) forest.delete(invalid.y * W + x);
  }
  for (const index of forest) {
    const x = index % W, y = Math.floor(index / W);
    let mask = 0;
    NEIGHBORS.forEach(([dx, dy], bit) => { if (f(x + dx, y + dy)) mask |= 1 << bit; });
    map.upperTiles[index] = group.variantMap[String(mask)]!;
  }
  for (const [index, tile] of trunks) map.lowerTiles[index] = tile;
  return { cells: new Set([...forest, ...trunks.keys()]), canopyCells: forest.size, trunkRuns };
}
