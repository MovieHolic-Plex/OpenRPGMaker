// Tall grass E/F/G placement for forest_harmony maps (and the climate sheets, same tile numbers).
//
//   import { arrangeTallGrass, TALL_GRASS_TILES } from "./lib/tall-grass.mjs";
//   const { lowerTiles, patches, stats } = arrangeTallGrass(map, { tileset, houses, seed });
//   map.lowerTiles = lowerTiles;
//
// arrangeTallGrass(map, options?) → { lowerTiles: number[], patches: {type:"E"|"F"|"G", cells:number[]}[], stats }
//   map        { width, height, lowerTiles: number[], upperTiles?: number[] } — not mutated.
//   options.cells     Iterable<number> of cell indices that should be tall grass. Default: every lower cell already
//                     holding a tall grass tile (any of E/F/G, and the unused 244).
//   options.tileset   TilesetDef (optional). Its autotile groups give the variantMaps (builtin_tall_grass /
//                     _light / _short), the canopy (forest_harmony_grove_47 incl. interiorVariants,
//                     forest_harmony_canopy_47) and the roads (forest_harmony_road_47, builtin_dirt_road, builtin_cobble);
//                     tileMeta roles building/wall/roof/door/window/fence (either layer) count as houses.
//   options.houses    [{x,y,w,h}] house footprints (a village plan's `houses`) — counted as built cells.
//   options.canopy / options.built   (tile) => boolean overrides for the two contexts.
//   options.lawn      tile written where a tall grass tile is removed (default 240); other cut cells keep their tile.
//   options.seed      hash seed for corner trimming (default 1).
//   options.trim      share of convex corners to cut, 0..1 (default 0.7). options.type forces one type for every patch.
// Rules (user decision 2026-09-24, direction ①: one type per patch):
//   (a) cells not inside any full 2×2 tall grass block go back to lawn (no 1-wide bands, no single tufts);
//   (b) convex corners with straight edges are cut by a position hash when every neighbour stays inside a 2×2 block
//       (idempotent: a second run over an arranged map changes nothing);
//   (c) each 8-connected patch gets one type: E (dark) if it touches the forest canopy (Chebyshev 1),
//       else G (short) if a house or road is within 3 cells, else F (light);
//   (d) every cell takes its type's variantMap entry for its 8-neighbour mask within the patch.
// Tile numbers: src/assets/forestTallGrass.json (drawn by scripts/content/tiles/tall-grass-redraw.py).
import fs from "node:fs";

const SPEC = JSON.parse(fs.readFileSync(new URL("../../../src/assets/forestTallGrass.json", import.meta.url)));
export const TALL_GRASS_TILES = SPEC.tiles;
export const TALL_GRASS_GROUP_IDS = { E: "builtin_tall_grass", F: "builtin_tall_grass_light", G: "builtin_tall_grass_short" };
export const ALL_TALL_GRASS = new Set([244, ...Object.values(SPEC.tiles).flatMap(r => Object.values(r))]);
const DIR = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 };

/** 256-entry mask → tile map, same rule as autotileEngine.buildEdgeCornerInnerVariantMap. */
export function tallGrassVariantMap(type) {
  const r = SPEC.tiles[type], out = {};
  for (let m = 0; m < 256; m++) {
    const n = m & DIR.N, e = m & DIR.E, s = m & DIR.S, w = m & DIR.W;
    let t;
    if (!n && !e && !s && !w) t = r.isolated;
    else if (n && e && s && w) t = (m & 240) === 240 ? r.body : r.inner;
    else if (!n && !w) t = r.NW; else if (!n && !e) t = r.NE; else if (!s && !w) t = r.SW; else if (!s && !e) t = r.SE;
    else if (!n) t = r.N; else if (!s) t = r.S; else if (!w) t = r.W; else t = r.E;
    out[m] = t;
  }
  return out;
}

const HOUSE_ROLES = new Set(["building", "wall", "roof", "door", "window", "fence"]);
function contextTests(tileset) {
  const groups = tileset?.autotileGroups ?? [];
  const members = ids => new Set(groups.filter(g => ids.includes(g.id)).flatMap(g => [...g.memberTileIds, ...Object.values(g.variantMap), ...(g.interiorVariants ?? []).flat()]));
  const canopy = tileset ? members(["forest_harmony_grove_47", "forest_harmony_canopy_47"]) : new Set();
  if (!canopy.size) for (let t = 2550; t < 2608; t++) canopy.add(t);
  const road = tileset ? members(["forest_harmony_road_47", "builtin_dirt_road", "builtin_cobble"]) : new Set();
  if (!road.size) for (let t = 1470; t <= 1516; t++) road.add(t);
  const house = new Set((tileset?.tileMeta ?? []).flatMap((m, t) => HOUSE_ROLES.has(m?.role) ? [t] : []));
  return { canopy: t => canopy.has(t), road: t => road.has(t), house: t => house.has(t) };
}

function hash(x, y, seed) {
  let v = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return ((v >>> 8) & 0xffff) / 0x10000;
}

export function arrangeTallGrass(map, options = {}) {
  const W = map.width, H = map.height, N = W * H;
  const lower = [...map.lowerTiles], upper = map.upperTiles ?? [];
  const lawn = options.lawn ?? 240, seed = options.seed ?? 1, trim = options.trim ?? 0.7;
  const on = new Uint8Array(N);
  const wanted = options.cells ? [...options.cells] : lower.flatMap((t, i) => ALL_TALL_GRASS.has(t) ? [i] : []);
  for (const i of wanted) on[i] = 1;
  const originally = on.slice();
  const g = (x, y) => x >= 0 && y >= 0 && x < W && y < H && on[y * W + x] === 1;
  const inBlock = (x, y) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) =>
    g(x + dx, y + dy) && g(x + dx + 1, y + dy) && g(x + dx, y + dy + 1) && g(x + dx + 1, y + dy + 1));
  const filter = () => { // (a) — repeat until stable
    let removed = 0;
    for (let again = true; again;) {
      again = false;
      const drop = [];
      for (let i = 0; i < N; i++) if (on[i] && !inBlock(i % W, (i / W) | 0)) drop.push(i);
      for (const i of drop) { on[i] = 0; removed++; again = true; }
    }
    return removed;
  };
  let removed = filter(), trimmed = 0;
  // (b) convex corners (missing N+W, N+E, S+W or S+E) of the filtered shape — cuts do not expose new candidates.
  // Only a corner where both edges run straight: once cut, the notch's cells fail this test, so a second run
  // over an arranged map cuts nothing (idempotent).
  const corners = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g(x, y)) continue;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (g(x + dx, y) || g(x, y + dy)) continue;
      if (g(x - dx, y) && !g(x - dx, y + dy) && g(x, y - dy) && !g(x + dx, y - dy)) { corners.push([x, y]); break; }
    }
  }
  for (const [x, y] of corners) {
    if (hash(x, y, seed) >= trim) continue;
    on[y * W + x] = 0;
    const ok = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].every(([dx, dy]) => !g(x + dx, y + dy) || inBlock(x + dx, y + dy));
    if (ok) trimmed++; else on[y * W + x] = 1;
  }
  removed += filter();
  // (c) patches (8-connected) and their context.
  const ctx = contextTests(options.tileset);
  const canopyAt = options.canopy ?? ctx.canopy;
  const builtTile = options.built ?? (t => ctx.road(t));
  const houseTile = options.built ? () => false : ctx.house;
  const built = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (builtTile(lower[i]) || houseTile(lower[i]) || (upper[i] >= 0 && (houseTile(upper[i]) || builtTile(upper[i])))) built[i] = 1;
  for (const h of options.houses ?? []) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) built[y * W + x] = 1;
  const near = (i, r, test) => {
    const x0 = i % W, y0 = (i / W) | 0;
    for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) if (x >= 0 && y >= 0 && x < W && y < H && test(y * W + x)) return true;
    return false;
  };
  const isCanopy = j => canopyAt(lower[j]) || (upper[j] >= 0 && canopyAt(upper[j]));
  const patchOf = new Int32Array(N).fill(-1), patches = [];
  for (let i = 0; i < N; i++) {
    if (!on[i] || patchOf[i] >= 0) continue;
    const cells = [], stack = [i]; patchOf[i] = patches.length;
    while (stack.length) {
      const c = stack.pop(); cells.push(c);
      const cx = c % W, cy = (c / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy, j = y * W + x;
        if ((dx || dy) && g(x, y) && patchOf[j] < 0) { patchOf[j] = patches.length; stack.push(j); }
      }
    }
    cells.sort((a, b) => a - b);
    const type = options.type ?? (cells.some(c => near(c, 1, isCanopy)) ? "E" : cells.some(c => near(c, 3, j => built[j] === 1)) ? "G" : "F");
    patches.push({ type, cells });
  }
  // (d) tiles from the variantMap of each type.
  const maps = {};
  for (const type of ["E", "F", "G"]) {
    const group = options.tileset?.autotileGroups?.find(x => x.id === TALL_GRASS_GROUP_IDS[type]);
    maps[type] = group?.variantMap ?? tallGrassVariantMap(type);
  }
  for (let i = 0; i < N; i++) if (originally[i] && !on[i] && ALL_TALL_GRASS.has(lower[i])) lower[i] = lawn;
  for (const p of patches) {
    const same = (x, y) => g(x, y) && patchOf[y * W + x] === patchOf[p.cells[0]];
    for (const c of p.cells) {
      const x = c % W, y = (c / W) | 0;
      let m = 0;
      if (same(x, y - 1)) m |= DIR.N; if (same(x + 1, y)) m |= DIR.E; if (same(x, y + 1)) m |= DIR.S; if (same(x - 1, y)) m |= DIR.W;
      if (same(x + 1, y - 1)) m |= DIR.NE; if (same(x + 1, y + 1)) m |= DIR.SE; if (same(x - 1, y + 1)) m |= DIR.SW; if (same(x - 1, y - 1)) m |= DIR.NW;
      lower[c] = maps[p.type][String(m)] ?? maps[p.type][m];
    }
  }
  const count = t => patches.filter(p => p.type === t).length;
  return { lowerTiles: lower, patches, stats: { requested: wanted.length, removed, trimmed, cells: patches.reduce((a, p) => a + p.cells.length, 0), E: count("E"), F: count("F"), G: count("G") } };
}
