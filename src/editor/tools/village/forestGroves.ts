import type { AutotileGroup, GameMap, Rect } from "@/project/types";
import { paintContouredForest } from "./forestContour";
import { forestTrunkCandidates } from "./forestTrunkTiles";

const NEIGHBORS = [[0,-1], [1,0], [0,1], [-1,0], [1,-1], [1,1], [-1,1], [-1,-1]];

export interface ForestGroveReport {
  readonly cells: Set<number>;
  readonly canopyCells: number;
  readonly trunkRuns: number;
}

/** The cliff-village grammar: a connected canopy mask on a 2×3 lattice,
 * southern trunks starting ON its last row, and complete three-row end caps.
 * Invalid protrusions are removed from the mask before any map cell is changed. */
export function paintForestGroves(map: GameMap, area: Rect, group: AutotileGroup,
  free: (x: number, y: number) => boolean, seed: number, coverage = 0.65,
  desired?: (x: number, y: number) => boolean, naturalEdge = false): ForestGroveReport {
  if (naturalEdge) return paintContouredForest(map, area, group, free, seed, coverage, desired);
  const W = map.width, H = map.height;
  const inside = (x: number, y: number): boolean => x >= Math.max(0, area.x) && y >= Math.max(0, area.y)
    && x < Math.min(W, area.x + area.w) && y < Math.min(H, area.y + area.h);
  const open = (x: number, y: number): boolean => inside(x, y) && free(x, y)
    && !map.lowerTileStacks?.[y * W + x]?.length && !map.upperTileStacks?.[y * W + x]?.length;
  const phase = (seed >>> 0) % 997 / 997 * Math.PI * 2;
  const blocks: { x: number; y: number; score: number }[] = [];
  for (let y = area.y; y + 4 < area.y + area.h; y += 3) {
    for (let x = area.x; x + 1 < area.x + area.w; x += 2) {
      if (desired && !desired(x + 1, y + 1)) continue;
      // Reserve roots below every block, so the eventual southern edge cannot
      // overwrite a road, event, house, water cell or content outside the scope.
      let available = true;
      for (let dy = 0; dy < 5 && available; dy++) for (let dx = 0; dx < 2; dx++) {
        if (!open(x + dx, y + dy)) { available = false; break; }
      }
      if (!available) continue;
      const edge = Math.min(x - area.x, area.x + area.w - x - 2, y - area.y, area.y + area.h - y - 5);
      const wave = Math.sin(x * 0.19 + phase) * 2.5 + Math.cos(y * 0.23 - phase) * 2
        + Math.sin(x * 0.11 + y * 0.17 + phase) * 2;
      const score = wave - Math.min(edge, 12) * 0.6;
      blocks.push({ x, y, score });
    }
  }
  blocks.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const forest = new Set<number>();
  const limit = Math.min(blocks.length, Math.floor(area.w * area.h * Math.max(0, Math.min(1, coverage)) / 6));
  for (const { x, y } of blocks.slice(0, limit)) {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) forest.add((y + dy) * W + x + dx);
  }
  const f = (x: number, y: number): boolean => inside(x, y) && forest.has(y * W + x);
  let trunks = new Map<number, number>(), trunkRuns = 0;
  // Each retry removes at least one whole macrocell; no partial trunks survive.
  for (let attempt = 0; attempt <= blocks.length; attempt++) {
    trunks = new Map(); trunkRuns = 0;
    let invalid: { x: number; y: number; width: number } | undefined;
    outer: for (let y = area.y; y < area.y + area.h; y++) {
      for (let x = area.x; x < area.x + area.w; x++) {
        if (!f(x, y) || f(x, y + 1)) continue;
        const start = x;
        while (x + 1 < area.x + area.w && f(x + 1, y) && !f(x + 1, y + 1)) x++;
        const width = x - start + 1;
        const candidates = forestTrunkCandidates(start, width);
        let openLeft = start, openRight = start + width;
        while (openLeft > area.x && !f(openLeft - 1, y + 1)) openLeft--;
        while (openRight < area.x + area.w && !f(openRight, y + 1)) openRight++;
        if (width <= 4 && start + width / 2 < (openLeft + openRight) / 2) candidates.reverse();
        const candidate = candidates.find(c => c.rows.every((row, dy) => row.every((tile, dx) => {
          const cx = c.x + dx, cy = y + dy, index = cy * W + cx;
          return open(cx, cy) && f(cx, y) && ((cx >= start && cx < start + width) || f(cx, cy))
            && (!trunks.has(index) || trunks.get(index) === tile);
        })));
        if (!candidate) { invalid = { x: start, y, width }; break outer; }
        candidate.rows.forEach((row, dy) => row.forEach((tile, dx) => trunks.set((y + dy) * W + candidate.x + dx, tile)));
        trunkRuns++;
      }
    }
    if (!invalid) break;
    for (let x = invalid.x; x < invalid.x + invalid.width; x++) {
      for (let y = invalid.y - 2; y <= invalid.y; y++) forest.delete(y * W + x);
    }
  }
  // Isolated slivers that lost every useful cap disappear through the repair above.
  for (const index of forest) {
    const x = index % W, y = Math.floor(index / W);
    let mask = 0;
    NEIGHBORS.forEach(([dx, dy], bit) => { if (f(x + dx!, y + dy!)) mask |= 1 << bit; });
    map.upperTiles[index] = group.variantMap[String(mask)]!;
  }
  for (const [index, tile] of trunks) map.lowerTiles[index] = tile;
  return { cells: new Set([...forest, ...trunks.keys()]), canopyCells: forest.size, trunkRuns };
}
