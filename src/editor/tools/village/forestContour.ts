import type { AutotileGroup, GameMap, Rect } from "@/project/types";
import { shadeAutotileInterior } from "@/project/defaults/autotileEngine";
import { forestCanopyTiles } from "@/project/defaults/forestGrove";
import { FOREST_TRUNK_MIN_WIDTH, FOREST_TRUNK_TILES, forestTrunkCandidates } from "./forestTrunkTiles";
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
  desired?: (x: number, y: number) => boolean,
  scoreAt?: (x: number, y: number) => number): ForestGroveReport {
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
    const score = scoreAt ? scoreAt(x + 0.5, y + 0.5) : forestContourScore(x + 0.5, y + 0.5, area, seed, coverage);
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
  const report = fitForest(map, area, group, forest, open, desired);
  shadeForestCanopy(map, group, area);
  return report;
}

/** Re-fits the trunks of a canopy already on the map, for maps painted before the trunk assemblies
 * matched their edges exactly. The canopy mask is kept except where an edge must move, old trunks
 * become `ground`, and `free` says which other cells may take canopy or trunks. */
export function refitForestTrunks(map: GameMap, area: Rect, group: AutotileGroup, ground: number,
  free: (x: number, y: number) => boolean): ForestGroveReport {
  const W = map.width, canopy = forestCanopyTiles(group), before = new Set<number>();
  for (let y = Math.max(0, area.y); y < Math.min(map.height, area.y + area.h); y++)
    for (let x = Math.max(0, area.x); x < Math.min(W, area.x + area.w); x++) {
      const index = y * W + x;
      if (FOREST_TRUNK_TILES.has(map.lowerTiles[index]!)) map.lowerTiles[index] = ground;
      if (canopy.has(map.upperTiles[index]!)) before.add(index);
    }
  const inside = (x: number, y: number): boolean => x >= Math.max(0, area.x) && y >= Math.max(0, area.y)
    && x < Math.min(W, area.x + area.w) && y < Math.min(map.height, area.y + area.h);
  const open = (x: number, y: number): boolean => inside(x, y) && (before.has(y * W + x) || free(x, y))
    && !map.lowerTileStacks?.[y * W + x]?.length && !map.upperTileStacks?.[y * W + x]?.length;
  const forest = new Set(before), report = fitForest(map, area, group, forest, open);
  for (const index of before) if (!forest.has(index)) map.upperTiles[index] = -1;
  shadeForestCanopy(map, group, area);
  return report;
}

/** Shapes the edges of a canopy mask, fits whole trunks under every bottom edge and paints both. */
function fitForest(map: GameMap, area: Rect, group: AutotileGroup, forest: Set<number>,
  open: (x: number, y: number) => boolean, desired?: (x: number, y: number) => boolean): ForestGroveReport {
  const W = map.width;
  const inside = (x: number, y: number): boolean => x >= Math.max(0, area.x) && y >= Math.max(0, area.y)
    && x < Math.min(W, area.x + area.w) && y < Math.min(map.height, area.y + area.h);
  const f = (x: number, y: number): boolean => inside(x, y) && forest.has(y * W + x);
  fitBottomEdges(forest, W, map.height, area, (x, y) => open(x, y)
    && (y + 1 >= map.height || open(x, y + 1)) && (y + 2 >= map.height || open(x, y + 2))
    && (!desired || desired(x, y)));
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
          // Below the canopy row a root must stand in the open: under a neighbouring canopy it shows
          // through that tile's transparent edge as a trunk cut in half.
          return open(cx, cy) && f(cx, y) && (dy === 0 || !f(cx, cy))
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

/** Leaf interior by depth (forestGrove.ts): re-pick the full canopy cells within two cells of the area, whose depth
 * the new edges may have changed. Seeded by position only, so repainting the same mask gives the same tiles. */
export function shadeForestCanopy(map: GameMap, group: AutotileGroup, area?: Rect): number {
  const grown = area && { x: area.x - 2, y: area.y - 2, w: area.w + 4, h: area.h + 4 };
  return shadeAutotileInterior({ width: map.width, height: map.height, lowerTiles: map.upperTiles }, group, grown);
}

/** Trunks fit any bottom edge FOREST_TRUNK_MIN_WIDTH or more cells wide (forestTrunkCandidates); the
 * trunk repair would otherwise retract a narrower step row by row. First close one-row gaps under an
 * edge, so the lower root stands in the open, and run edges near the map's bottom off the map. Then
 * move each narrow step onto the edge of a neighbouring column, up or down, whichever changes fewer
 * cells (up on a tie, keeping the meadow). A move touches no run but the one it joins, so every move
 * merges two runs and the sweep ends. `hold` says whether a cell may carry canopy (it and the two root
 * rows below it are free). */
function fitBottomEdges(forest: Set<number>, W: number, H: number, area: Rect,
  hold: (x: number, y: number) => boolean): void {
  const inside = (x: number, y: number): boolean => x >= Math.max(0, area.x) && y >= Math.max(0, area.y)
    && x < Math.min(W, area.x + area.w) && y < Math.min(H, area.y + area.h);
  const f = (x: number, y: number): boolean => inside(x, y) && forest.has(y * W + x);
  const bottom = (x: number, y: number): boolean => f(x, y) && !f(x, y + 1);
  for (let changed = true; changed;) {
    changed = false;
    for (let y = area.y; y < area.y + area.h - 1; y++) for (let x = area.x; x < area.x + area.w; x++) {
      if (!bottom(x, y)) continue;
      if (y + 2 >= H) {
        for (let yy = y + 1; yy < H; yy++) if (hold(x, yy)) { forest.add(yy * W + x); changed = true; }
      } else if (f(x, y + 2) && hold(x, y + 1)) { forest.add((y + 1) * W + x); changed = true; }
    }
  }
  const run = (a: number, b: number, test: (c: number) => boolean): boolean => {
    for (let c = a; c <= b; c++) if (!test(c)) return false;
    return true;
  };
  for (let changed = true; changed;) {
    changed = false;
    for (let y = area.y; y < area.y + area.h - 1; y++) for (let x = area.x; x < area.x + area.w; x++) {
      if (!bottom(x, y) || bottom(x - 1, y)) continue;
      const a = x;
      while (bottom(x + 1, y)) x++;
      const b = x;
      if (b - a + 1 >= FOREST_TRUNK_MIN_WIDTH || y + 2 >= H) continue;
      let best: { from: number; to: number; add: boolean } | undefined;
      for (const n of [a - 1, b + 1]) {
        // Up: the step is canopy up to where the neighbour's edge is.
        for (let r = y - 1; run(a, b, c => f(c, r)); r--) if (f(n, r)) {
          if (bottom(n, r) && (!best || y - r < best.to - best.from + 1)) best = { from: r + 1, to: y, add: false };
          break;
        }
        // Down: open ground the canopy may take, to the neighbour's deeper edge.
        if (!f(n, y + 1)) continue;
        for (let r = y + 1; r < H - 2 && run(a, b, c => hold(c, r) && !f(c, r)) && f(n, r); r++) if (bottom(n, r)) {
          if (run(a, b, c => !f(c, r + 1) && !f(c, r + 2)) && (!best || r - y < best.to - best.from + 1))
            best = { from: y + 1, to: r, add: true };
          break;
        }
      }
      if (!best) continue;
      for (let r = best.from; r <= best.to; r++) for (let c = a; c <= b; c++) {
        if (best.add) forest.add(r * W + c); else forest.delete(r * W + c);
      }
      changed = true;
    }
  }
}
