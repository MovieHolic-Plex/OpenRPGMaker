import spec from "@/assets/forestTallGrass.json";
import type { GameMap, Rect, TilesetDef } from "../types";
import { FOREST_TALL_GRASS_KINDS, type TallGrassKind } from "./forestTallGrass";

// TS port of scripts/content/lib/tall-grass.mjs arrangeTallGrass (the authoring scripts keep their own copy; the
// rules are the same — keep them in step). Used by the assistant tools arrange_tall_grass and author_wild_route.
// Rules (user decision 2026-09-24, direction ①: one kind per patch):
//   (a) cells not inside any full 2×2 block go back to lawn (no 1-wide bands, no single tufts);
//   (b) convex corners with straight edges are cut by a position hash when every neighbour stays in a 2×2 block
//       (idempotent: a second run over an arranged map changes nothing);
//   (c) each 8-connected patch gets one kind: E if it touches the canopy (Chebyshev 1), else G if a house or road is
//       within 3 cells, else F;
//   (d) every cell takes its kind's variantMap entry for its 8-neighbour mask within the patch.

const DIR = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 } as const;
type Roles = typeof spec.tiles.E;
const TILES = spec.tiles as Record<TallGrassKind, Roles>;
export const ALL_TALL_GRASS: ReadonlySet<number> = new Set([244, ...Object.values(TILES).flatMap(r => Object.values(r))]);
const HOUSE_ROLES = new Set(["building", "wall", "roof", "door", "window", "fence"]);

export interface TallGrassPatch { readonly kind: TallGrassKind; readonly cells: number[] }
export interface ArrangeTallGrassOptions {
  /** Cells that should be tall grass. Default: every lower cell already holding a tall grass tile. */
  readonly cells?: Iterable<number>;
  readonly tileset?: TilesetDef;
  readonly houses?: readonly Rect[];
  readonly canopy?: (tile: number) => boolean;
  readonly built?: (tile: number) => boolean;
  /** Tile written where a tall grass tile is removed (default 240). */
  readonly lawn?: number;
  readonly seed?: number;
  /** Share of straight convex corners to cut, 0..1 (default 0.7). */
  readonly trim?: number;
  /** One kind for every patch. */
  readonly kind?: TallGrassKind;
  /** Kind used instead of a rule result the sheet must not show (volcano: G → F). */
  readonly replace?: Partial<Record<TallGrassKind, TallGrassKind>>;
}
export interface ArrangeTallGrassResult {
  readonly lowerTiles: number[];
  readonly patches: TallGrassPatch[];
  readonly stats: { requested: number; removed: number; trimmed: number; cells: number; E: number; F: number; G: number };
}

export function tallGrassVariantMap(kind: TallGrassKind): Record<number, number> {
  const r = TILES[kind], out: Record<number, number> = {};
  for (let m = 0; m < 256; m++) {
    const n = m & DIR.N, e = m & DIR.E, s = m & DIR.S, w = m & DIR.W;
    let t: number;
    if (!n && !e && !s && !w) t = r.isolated;
    else if (n && e && s && w) t = (m & 240) === 240 ? r.body : r.inner;
    else if (!n && !w) t = r.NW; else if (!n && !e) t = r.NE; else if (!s && !w) t = r.SW; else if (!s && !e) t = r.SE;
    else if (!n) t = r.N; else if (!s) t = r.S; else if (!w) t = r.W; else t = r.E;
    out[m] = t;
  }
  return out;
}

function groupTiles(tileset: TilesetDef | undefined, ids: readonly string[]): Set<number> {
  const groups = tileset?.autotileGroups ?? [];
  return new Set(groups.filter(g => ids.includes(g.id)).flatMap(g => [...g.memberTileIds, ...Object.values(g.variantMap), ...(g.interiorVariants ?? []).flat()]));
}

/** Canopy, road and house tests of a forest atlas (fallbacks: the shipped cell ranges). */
export function tallGrassContext(tileset: TilesetDef | undefined): { canopy: (t: number) => boolean; road: (t: number) => boolean; house: (t: number) => boolean } {
  const canopy = groupTiles(tileset, ["forest_harmony_grove_47", "forest_harmony_canopy_47"]);
  if (!canopy.size) for (let t = 2550; t < 2608; t++) canopy.add(t);
  const road = groupTiles(tileset, ["forest_harmony_road_47", "builtin_dirt_road", "builtin_cobble"]);
  if (!road.size) for (let t = 1470; t <= 1516; t++) road.add(t);
  const house = new Set<number>();
  (tileset?.tileMeta ?? []).forEach((m, t) => { if (m?.role && HOUSE_ROLES.has(m.role)) house.add(t); });
  return { canopy: t => canopy.has(t), road: t => road.has(t), house: t => house.has(t) };
}

function hash(x: number, y: number, seed: number): number {
  let v = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return ((v >>> 8) & 0xffff) / 0x10000;
}

export function arrangeTallGrass(map: Pick<GameMap, "width" | "height" | "lowerTiles" | "upperTiles">, options: ArrangeTallGrassOptions = {}): ArrangeTallGrassResult {
  const W = map.width, H = map.height, N = W * H;
  const lower = [...map.lowerTiles], upper = map.upperTiles ?? [];
  const lawn = options.lawn ?? 240, seed = options.seed ?? 1, trim = options.trim ?? 0.7;
  const on = new Uint8Array(N);
  const wanted = options.cells ? [...options.cells] : lower.flatMap((t, i) => ALL_TALL_GRASS.has(t) ? [i] : []);
  for (const i of wanted) if (i >= 0 && i < N) on[i] = 1;
  const originally = on.slice();
  const g = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && on[y * W + x] === 1;
  const inBlock = (x: number, y: number): boolean => ([[0, 0], [-1, 0], [0, -1], [-1, -1]] as const).some(([dx, dy]) =>
    g(x + dx, y + dy) && g(x + dx + 1, y + dy) && g(x + dx, y + dy + 1) && g(x + dx + 1, y + dy + 1));
  const filter = (): number => { // (a) — repeat until stable
    let removed = 0;
    for (let again = true; again;) {
      again = false;
      const drop: number[] = [];
      for (let i = 0; i < N; i++) if (on[i] && !inBlock(i % W, Math.floor(i / W))) drop.push(i);
      for (const i of drop) { on[i] = 0; removed++; again = true; }
    }
    return removed;
  };
  let removed = filter(), trimmed = 0;
  // (b) only a corner whose two edges run straight — once cut, the notch's cells fail this test (idempotent).
  const corners: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g(x, y)) continue;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      if (g(x + dx, y) || g(x, y + dy)) continue;
      if (g(x - dx, y) && !g(x - dx, y + dy) && g(x, y - dy) && !g(x + dx, y - dy)) { corners.push([x, y]); break; }
    }
  }
  const around = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
  for (const [x, y] of corners) {
    if (hash(x, y, seed) >= trim) continue;
    on[y * W + x] = 0;
    if (around.every(([dx, dy]) => !g(x + dx, y + dy) || inBlock(x + dx, y + dy))) trimmed++; else on[y * W + x] = 1;
  }
  removed += filter();
  // (c) patches (8-connected) and their context.
  const ctx = tallGrassContext(options.tileset);
  const canopyAt = options.canopy ?? ctx.canopy;
  const builtTile = options.built ?? ctx.road;
  const houseTile = options.built ? () => false : ctx.house;
  const built = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const u = upper[i] ?? -1;
    if (builtTile(lower[i]!) || houseTile(lower[i]!) || (u >= 0 && (houseTile(u) || builtTile(u)))) built[i] = 1;
  }
  for (const h of options.houses ?? []) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) built[y * W + x] = 1;
  const near = (i: number, r: number, test: (j: number) => boolean): boolean => {
    const x0 = i % W, y0 = Math.floor(i / W);
    for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) if (x >= 0 && y >= 0 && x < W && y < H && test(y * W + x)) return true;
    return false;
  };
  const isCanopy = (j: number): boolean => canopyAt(lower[j]!) || ((upper[j] ?? -1) >= 0 && canopyAt(upper[j]!));
  const patchOf = new Int32Array(N).fill(-1), patches: TallGrassPatch[] = [];
  for (let i = 0; i < N; i++) {
    if (!on[i] || patchOf[i]! >= 0) continue;
    const cells: number[] = [], stack = [i]; patchOf[i] = patches.length;
    while (stack.length) {
      const c = stack.pop()!; cells.push(c);
      const cx = c % W, cy = Math.floor(c / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy, j = y * W + x;
        if ((dx || dy) && g(x, y) && patchOf[j]! < 0) { patchOf[j] = patches.length; stack.push(j); }
      }
    }
    cells.sort((a, b) => a - b);
    let kind: TallGrassKind = options.kind ?? (cells.some(c => near(c, 1, isCanopy)) ? "E" : cells.some(c => near(c, 3, j => built[j] === 1)) ? "G" : "F");
    kind = options.replace?.[kind] ?? kind;
    patches.push({ kind, cells });
  }
  // (d) tiles from the variantMap of each kind.
  const maps = {} as Record<TallGrassKind, Record<string | number, number>>;
  for (const info of FOREST_TALL_GRASS_KINDS) {
    const group = options.tileset?.autotileGroups?.find(x => x.id === info.groupId);
    maps[info.kind] = group?.variantMap ?? tallGrassVariantMap(info.kind);
  }
  for (let i = 0; i < N; i++) if (originally[i] && !on[i] && ALL_TALL_GRASS.has(lower[i]!)) lower[i] = lawn;
  patches.forEach((p, id) => {
    const same = (x: number, y: number): boolean => g(x, y) && patchOf[y * W + x] === id;
    for (const c of p.cells) {
      const x = c % W, y = Math.floor(c / W);
      let m = 0;
      if (same(x, y - 1)) m |= DIR.N; if (same(x + 1, y)) m |= DIR.E; if (same(x, y + 1)) m |= DIR.S; if (same(x - 1, y)) m |= DIR.W;
      if (same(x + 1, y - 1)) m |= DIR.NE; if (same(x + 1, y + 1)) m |= DIR.SE; if (same(x - 1, y + 1)) m |= DIR.SW; if (same(x - 1, y - 1)) m |= DIR.NW;
      const tile = maps[p.kind][String(m)] ?? maps[p.kind][m];
      if (tile !== undefined) lower[c] = tile;
    }
  });
  const count = (k: TallGrassKind): number => patches.filter(p => p.kind === k).length;
  return { lowerTiles: lower, patches, stats: { requested: wanted.length, removed, trimmed, cells: patches.reduce((a, p) => a + p.cells.length, 0), E: count("E"), F: count("F"), G: count("G") } };
}
