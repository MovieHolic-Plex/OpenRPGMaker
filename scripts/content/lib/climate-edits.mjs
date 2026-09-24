// Climate edits laid over a finished forest-village map once it is re-pointed at a climate sheet
// (scripts/content/build-climate-chipsets.py). Shared by the climate villages and the climate fields.
// Tile numbers are the forest village's; only these edits add climate-specific pieces.
import assert from "node:assert/strict";

export const GROUND = 240;
// Two small volcanic peaks already on the sheet (upper, solid): dormant 858/859/888/889 and erupting 918/919/948/949.
export const PEAKS = [[858, 859, 918, 919], [888, 889, 948, 949]];
// Desert plants already on the sheet (upper, solid): cactus, palm, grey boulder.
export const CACTUS = 769, PALM = 770, BOULDER = 537;

/** Swap every water tile in the given cells for its ice copy (both layers). Returns the number of swapped tiles. */
export function freezeCells(map, cells, ice) {
  let frozen = 0;
  for (const i of cells) for (const layer of ["lowerTiles", "upperTiles"]) {
    const t = map[layer][i];
    if (ice.has(t)) { map[layer][i] = ice.get(t); frozen++; }
  }
  return frozen;
}

/** Pairs of volcanic peaks (4×2) on bare ash only: the ring round each must be plain ground, six cells from any keep-clear point.
 * With `dressing`, ground dressing (tall grass, wildflowers — `dressing.is(lower, upper)`) also counts as plain: the
 * peak's footprint and ring are cleared back to ash and `dressing.cleared(cells)` re-autotiles what is left round it. */
export function placePeaks(map, count, keepClear, dressing = null) {
  const W = map.width, at = (x, y) => y * W + x;
  const bare = (x, y) => x >= 0 && y >= 0 && x < W && y < map.height && ((map.lowerTiles[at(x, y)] === GROUND && map.upperTiles[at(x, y)] < 0) || !!dressing?.is(map.lowerTiles[at(x, y)], map.upperTiles[at(x, y)]));
  const picked = [], candidates = [], edits = [];
  for (let y = 2; y < map.height - 3; y++) for (let x = 2; x < W - 5; x++) {
    let ok = true;
    for (let dy = -1; dy <= 2 && ok; dy++) for (let dx = -1; dx <= 4 && ok; dx++) ok = bare(x + dx, y + dy);
    if (ok && keepClear.every(([fx, fy]) => Math.hypot(fx - x, fy - y) > 6)) candidates.push([x, y]);
  }
  while (picked.length < count && candidates.length) {
    const score = ([x, y]) => Math.min(...[...picked, ...keepClear].map(([px, py]) => Math.hypot(px - x, py - y)));
    candidates.sort((a, b) => score(b) - score(a) || a[1] - b[1] || a[0] - b[0]);
    const [x, y] = candidates.shift();
    if (dressing) {
      // The candidate list was built before earlier peaks cleared their rings; re-check this one still fits.
      let fits = true;
      for (let dy = -1; dy <= 2 && fits; dy++) for (let dx = -1; dx <= 4 && fits; dx++) fits = bare(x + dx, y + dy);
      if (!fits) continue;
      const cleared = [];
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 4; dx++) {
        const i = at(x + dx, y + dy);
        if (map.lowerTiles[i] !== GROUND || map.upperTiles[i] >= 0) { map.lowerTiles[i] = GROUND; map.upperTiles[i] = -1; cleared.push(i); }
      }
      dressing.cleared(cleared);
    }
    PEAKS.forEach((r, dy) => r.forEach((t, dx) => { map.upperTiles[at(x + dx, y + dy)] = t; }));
    picked.push([x, y]);
    edits.push({ kind: "volcanic-peaks", x, y, w: 4, h: 2, upper: PEAKS });
  }
  assert.equal(picked.length, count, "no room for peaks");
  return edits;
}

/**
 * Desert dressing. Broadleaf trees and bushes would not grow in sand: each free-standing tree stamp is cleared back to
 * sand and replaced by one plant at its foot — a palm when water is within five cells, a cactus otherwise (a big tree
 * also leaves a boulder). Then palms line the water's edge and a few cacti stand on open sand. Everything stays one
 * cell off roads, doors and other plants (the ring round each plant is bare sand).
 */
export function dressDesert(map, { vegetation, water, keepClear, palms, cacti, seed }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const bare = (x, y) => inside(x, y) && map.lowerTiles[at(x, y)] === GROUND && map.upperTiles[at(x, y)] < 0;
  const ringBare = (x, y) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => bare(x + dx, y + dy)));
  const clear = (x, y) => keepClear.every(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y) > 2);
  const nearWater = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (water.has(at(x + dx, y + dy)) && inside(x + dx, y + dy)) return true; return false; };
  const planted = [], edits = [];
  const plant = (x, y, tile, why) => { map.upperTiles[at(x, y)] = tile; planted.push([x, y]); edits.push({ kind: "desert-plant", x, y, tile, why }); };
  let replaced = 0;
  for (const o of vegetation) {
    // Only a stamp that is still intact on this map is replaced (a climate edit may already have covered it).
    const cells = Array.from({ length: o.w * o.h }, (_, k) => [o.x + k % o.w, o.y + Math.floor(k / o.w), k]);
    if (!cells.every(([x, y, k]) => map.lowerTiles[at(x, y)] === o.lower[k] && map.upperTiles[at(x, y)] === o.upper[k])) continue;
    for (const [x, y] of cells) { map.lowerTiles[at(x, y)] = GROUND; map.upperTiles[at(x, y)] = -1; }
    const fx = o.x + (o.w >> 1), fy = o.y + o.h - 1;
    plant(fx, fy, nearWater(fx, fy, 5) ? PALM : CACTUS, "replaces " + o.name);
    if (o.w * o.h >= 12) plant(o.x, o.y + 1, BOULDER, "replaces " + o.name);
    replaced++;
  }
  // Palms on the water's edge (one cell from water), spaced three apart, scanning from a seeded offset.
  const shore = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (bare(x, y) && nearWater(x, y, 1) && !water.has(at(x, y))) shore.push([x, y]);
  const spaced = (x, y, d) => planted.every(([px, py]) => Math.abs(px - x) + Math.abs(py - y) >= d);
  for (let k = 0, n = 0, start = seed % Math.max(1, shore.length); k < shore.length && n < palms; k++) {
    const [x, y] = shore[(start + k * 7) % shore.length];
    if (bare(x, y) && clear(x, y) && spaced(x, y, 3) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => bare(x + dx, y + dy)).length >= 2) { plant(x, y, PALM, "shore"); n++; }
  }
  // Cacti on open sand, away from water.
  const open = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (ringBare(x, y) && !nearWater(x, y, 6)) open.push([x, y]);
  for (let k = 0, n = 0, start = (seed * 31) % Math.max(1, open.length); k < open.length && n < cacti; k++) {
    const [x, y] = open[(start + k * 97) % open.length];
    if (ringBare(x, y) && clear(x, y) && spaced(x, y, 6)) { plant(x, y, CACTUS, "open sand"); n++; }
  }
  return { edits, replaced };
}

/** Cells reachable from `entry` under the runtime move rule. */
export function reachable(canMove, project, map, entry) {
  const W = map.width, at = (x, y) => y * W + x;
  const seen = new Set([at(...entry)]), queue = [entry];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy, k = at(X, Y);
      if (X >= 0 && Y >= 0 && X < W && Y < map.height && !seen.has(k) && canMove(project, map, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
    }
  }
  return seen;
}
