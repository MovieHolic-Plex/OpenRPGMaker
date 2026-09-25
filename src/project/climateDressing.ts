// 기후 칩셋(사막·화산·가을)으로 옮긴 숲마을 맵의 기후 손질 — 조수 도구(author_village groundTheme)용 런타임 판.
//
// 저작 스크립트의 scripts/content/lib/bare-trees.mjs(clearLeafyTrees·arrangeBareGroves·plantPalmGroves)와
// climate-edits.mjs 의 규칙을 그대로 옮겼다(덤불 밑풀·빈칸 풀밭은 뺐다). 저작 쪽이 정본이고, 규칙이 바뀌면 여기도 맞춘다.
// 2026-09-25 조수 시험: 사막 시트로 지은 마을에 꽃덤불 288(33칸)·화분 351·초록 덤불이 그대로 깔렸다.
import tallGrassSpec from "@/assets/forestTallGrass.json";
import type { GameMap, TilesetDef } from "./types";

export type DressClimate = "desert" | "volcano" | "autumn";
export const GROUND = 240, ROCK = 537, CACTUS = 769, PALM = 770;
/** Green garden pieces that do not belong on sand, ash or in autumn: flower bush 288, planter 351. */
export const GARDEN_TILES: ReadonlySet<number> = new Set([288, 351]);
const PLAIN = new Set([240, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);
const ALL_TALL_GRASS = new Set<number>([244, ...Object.values((tallGrassSpec as { tiles: Record<string, Record<string, number>> }).tiles).flatMap(row => Object.values(row))]);
export const isLeafyTree = (t: number) => (t >= 2550 && t <= 2609) || (t >= 1200 && t <= 1463) || (t >= 960 && t <= 1123) || t === 289;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type StampCell = { dx: number; dy: number; tile: number; layer: "lower" | "upper" };
type Stamp = { id: string; kind: string; w: number; h: number; cells: StampCell[] };

function bareTreeStamps(tileset: TilesetDef): Stamp[] {
  return (tileset.tileGroups ?? []).filter(g => g.id.startsWith("bare-trees:") && g.previewMap).map(g => {
    const { width: w, height: h, lowerTiles, upperTiles } = g.previewMap!;
    const cells: StampCell[] = [];
    for (let k = 0; k < w * h; k++) {
      const up = upperTiles[k]!, lo = lowerTiles[k]!;
      if (up >= 0) cells.push({ dx: k % w, dy: Math.floor(k / w), tile: up, layer: "upper" });
      else if (lo >= 0 && lo !== GROUND) cells.push({ dx: k % w, dy: Math.floor(k / w), tile: lo, layer: "lower" });
    }
    const id = g.id.slice("bare-trees:".length);
    return { id, kind: id.split("-")[0]!, w, h, cells };
  });
}

/** Leafy trees and bushes back to bare ground; rocks left touching a cleared cell go too. */
export function clearLeafyTrees(map: GameMap): Set<number> {
  const cleared = new Set<number>();
  for (let i = 0; i < map.lowerTiles.length; i++) {
    const lo = isLeafyTree(map.lowerTiles[i]!), up = map.upperTiles[i]! >= 0 && isLeafyTree(map.upperTiles[i]!);
    if (!lo && !up) continue;
    if (lo) map.lowerTiles[i] = GROUND;
    if (up) map.upperTiles[i] = -1;
    cleared.add(i);
  }
  const W = map.width, H = map.height;
  for (let i = 0; i < map.upperTiles.length; i++) {
    if (map.upperTiles[i] !== ROCK) continue;
    const x = i % W, y = Math.floor(i / W);
    let touches = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && cleared.has((y + dy) * W + x + dx)) touches = true;
    if (touches) map.upperTiles[i] = -1;
  }
  return cleared;
}

const LIFE_ROLES = new Set(["building", "wall", "roof", "door", "window", "fence"]);
function contexts(tileset: TilesetDef) {
  const groups = tileset.autotileGroups ?? [], meta = (tileset.tileMeta ?? []) as ({ role?: string; label?: string } | undefined)[];
  const members = (test: (id: string) => boolean) => new Set(groups.filter(g => test(g.id)).flatMap(g => [...(g.memberTileIds ?? []), ...Object.values(g.variantMap ?? {})]));
  const road = members(id => /road|dirt|cobble/.test(id) && !/grass/.test(id));
  const water = members(id => /lake|water|ice/.test(id));
  const life = (t: number) => road.has(t) || LIFE_ROLES.has(meta[t]?.role ?? "") || /계단|다리|울타리|문\/입구|stairs|bridge|fence|door/.test(meta[t]?.label ?? "");
  return { life, water: (t: number) => water.has(t) || meta[t]?.role === "water" };
}

export interface GroveOptions {
  readonly sites?: Iterable<number>;
  readonly keep?: readonly (readonly [number, number])[];
  readonly clearance?: number;
  readonly rock?: number | null;
  readonly cactus?: number | null;
  readonly rockChance?: number;
  readonly seed?: number;
}

/** Bare-tree groves (lead tree + 0–2 companions + foot rocks/dry shrubs), never single pieces. Returns trees placed. */
export function arrangeBareGroves(map: GameMap, tileset: TilesetDef, options: GroveOptions = {}): { groves: number; trees: number } {
  const W = map.width, H = map.height, N = W * H, at = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const stamps = bareTreeStamps(tileset);
  if (!stamps.length) return { groves: 0, trees: 0 };
  const random = rng(options.seed ?? 1), clearance = options.clearance ?? 2, band = 4, spacing = { band: 8, inner: 13 };
  const rock = options.rock === undefined ? ROCK : options.rock, cactus = options.cactus ?? null;
  const ctx = contexts(tileset);
  const life = new Uint8Array(N), hard = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const lo = map.lowerTiles[i]!, up = map.upperTiles[i]!;
    if (ctx.life(lo) || (up >= 0 && ctx.life(up))) life[i] = 1;
    else if (ctx.water(lo) || up >= 0 || !(PLAIN.has(lo) || ALL_TALL_GRASS.has(lo))) hard[i] = 1;
  }
  for (const event of map.events) if (inside(event.x, event.y)) life[at(event.x, event.y)] = 1;
  for (const [x, y] of options.keep ?? []) if (inside(x, y)) life[at(x, y)] = 1;
  const within = (mask: Uint8Array, x: number, y: number, r: number) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inside(xx, yy) && mask[at(xx, yy)]) return true;
    return false;
  };
  const taken = new Uint8Array(N);
  const free = (x: number, y: number, trunk: boolean) => {
    if (!inside(x, y)) return false;
    const i = at(x, y), lo = map.lowerTiles[i]!;
    return !taken[i] && map.upperTiles[i]! < 0 && (trunk ? PLAIN.has(lo) : PLAIN.has(lo) || ALL_TALL_GRASS.has(lo))
      && !within(life, x, y, clearance) && !within(hard, x, y, 1);
  };
  const byKind = (k: string) => stamps.filter(s => s.kind === k);
  const pick = (k: string) => { const l = byKind(k); return l.length ? l[Math.floor(random() * l.length)]! : undefined; };
  const feet: { x: number; y: number }[] = [];
  const footOf = (st: Stamp, x0: number, y0: number) => ({ x: x0 + (st.w - 1) / 2, y: y0 + st.h - 1 });
  const rowFull = (st: Stamp, x0: number, y0: number) => {
    if (st.kind === "shrub") return false;
    const f = footOf(st, x0, y0), all = [...feet, f];
    const near = (a: { y: number }, g: { y: number }) => Math.abs(a.y - g.y) <= 1;
    const crowded = (g: { x: number; y: number }) => {
      const xs = all.filter(h => near(h, g)).map(h => h.x);
      for (let s = g.x - 9; s <= g.x; s++) if (xs.filter(x => x >= s && x < s + 10).length > 3) return true;
      return false;
    };
    return [f, ...feet.filter(g => near(g, f) && Math.abs(g.x - f.x) < 10)].some(crowded);
  };
  const fits = (st: Stamp, x0: number, y0: number) => {
    for (let dy = 0; dy < st.h; dy++) for (let dx = 0; dx < st.w; dx++) if (!inside(x0 + dx, y0 + dy) || taken[at(x0 + dx, y0 + dy)]) return false;
    if (st.cells.some(c => c.layer === "lower" && (y0 + c.dy >= H - 1 || x0 + c.dx <= 0 || x0 + c.dx >= W - 1))) return false;
    if (rowFull(st, x0, y0)) return false;
    return st.cells.every(c => free(x0 + c.dx, y0 + c.dy, c.layer === "lower"));
  };
  const put = (st: Stamp, x0: number, y0: number, trees: { x: number; y: number; w: number }[]) => {
    if (!fits(st, x0, y0)) return false;
    for (let dy = 0; dy < st.h; dy++) for (let dx = 0; dx < st.w; dx++) taken[at(x0 + dx, y0 + dy)] = 1;
    for (const c of st.cells) (c.layer === "lower" ? map.lowerTiles : map.upperTiles)[at(x0 + c.dx, y0 + c.dy)] = c.tile;
    trees.push({ x: x0, y: y0, w: st.w });
    feet.push(footOf(st, x0, y0));
    return true;
  };
  const putTile = (tile: number, x: number, y: number) => {
    if (!free(x, y, false)) return false;
    taken[at(x, y)] = 1;
    map.upperTiles[at(x, y)] = tile;
    return true;
  };
  const edge = (x: number, y: number) => Math.min(x, y, W - 1 - x, H - 1 - y);
  const sites = [...(options.sites ?? Array.from({ length: N }, (_, i) => i))].filter(i => free(i % W, Math.floor(i / W), true));
  for (let k = sites.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [sites[k], sites[j]] = [sites[j]!, sites[k]!]; }
  const centres: [number, number, boolean][] = [];
  let treeCount = 0;
  for (const i of sites) {
    const x = i % W, y = Math.floor(i / W), inBand = edge(x, y) <= band, d = inBand ? spacing.band : spacing.inner;
    if (centres.some(([cx, cy, cb]) => (x - cx) ** 2 + (y - cy) ** 2 < (cb && inBand ? d : Math.max(d, spacing.inner)) ** 2)) continue;
    const trees: { x: number; y: number; w: number }[] = [];
    const jitter = Math.floor(random() * 4), inward = y <= band ? 1 : H - 1 - y <= band ? -1 : random() < 0.5 ? 1 : -1;
    const footRow = (st: Stamp) => !inBand ? y + (jitter % 3) - 1 : y <= band ? Math.max(y, st.h) + jitter : H - 1 - y <= band ? Math.min(y, H - 2) - jitter : y + inward * jitter;
    let lead: { st: Stamp; x0: number; y0: number } | null = null;
    for (const kind of inBand || random() < 0.4 ? ["big", "mid", "small"] : ["mid", "big", "small"]) {
      const st = pick(kind);
      if (!st) continue;
      const fy = footRow(st);
      for (const [ox, oy] of [[0, 0], [-1, 0], [1, 0], [0, inward], [0, -inward]] as const) {
        const x0 = x - Math.floor(st.w / 2) + ox, y0 = fy + oy - st.h + 1;
        if (put(st, x0, y0, trees)) { lead = { st, x0, y0 }; break; }
      }
      if (lead) break;
    }
    if (!lead) continue;
    const mates = inBand ? 1 + Math.floor(random() * 2) : Math.floor(random() * 2);
    for (let m = 0; m < mates; m++) {
      const st = pick(random() < 0.5 ? "small" : "mid");
      if (!st) continue;
      const side = random() < 0.5 ? -1 : 1, foot = lead.y0 + lead.st.h - st.h;
      done: for (const s of [side, -side]) for (const dy of [1, -1, 2, 0]) {
        const bx = s > 0 ? Math.max(lead.x0 + lead.st.w, ...trees.map(t => t.x + t.w)) : Math.min(lead.x0, ...trees.map(t => t.x)) - st.w;
        if (put(st, bx, foot + dy, trees)) break done;
      }
    }
    const by = lead.y0 + lead.st.h - 1, lx = lead.x0, rx = lead.x0 + lead.st.w;
    const spots: [number, number][] = [[lx - 1, by], [rx, by], [lx - 1, by + 1], [rx, by + 1], [lx + Math.floor(lead.st.w / 2), by + 1], [lx, by + 1]];
    for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [spots[k], spots[j]] = [spots[j]!, spots[k]!]; }
    const rockless = options.rockChance != null && random() >= options.rockChance;
    let rocks = rock != null && !rockless ? (inBand ? 1 + Math.floor(random() * 2) : 1) : 0, shrubs = 1 + Math.floor(random() * 2);
    const shrubStamps = byKind("shrub");
    for (const [sx, sy] of spots) if (rocks && rock != null && putTile(rock, sx, sy)) rocks--;
    for (const [sx, sy] of spots) if (shrubs && shrubStamps.length && putTile(shrubStamps[Math.floor(random() * shrubStamps.length)]!.cells[0]!.tile, sx, sy)) shrubs--;
    if (cactus != null && !inBand && random() < 0.5) for (const [sx, sy] of spots) if (putTile(cactus, sx, sy)) break;
    centres.push([x, y, inBand]);
    treeCount += trees.length;
  }
  return { groves: centres.length, trees: treeCount };
}

/** Desert palm clumps (2–3 palms) on the shore, clumps ten cells apart, off roads/doors/houses by two cells. */
export function plantPalmGroves(map: GameMap, tileset: TilesetDef, { groups = 3, seed = 1 }: { groups?: number; seed?: number } = {}): number {
  const W = map.width, H = map.height, at = (x: number, y: number) => y * W + x, random = rng(seed * 7 + 3);
  const ctx = contexts(tileset);
  const water = new Set<number>();
  for (let i = 0; i < W * H; i++) if (ctx.water(map.lowerTiles[i]!)) water.add(i);
  const life = (x: number, y: number, r: number) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) {
      const i = at(xx, yy);
      if (ctx.life(map.lowerTiles[i]!) || (map.upperTiles[i]! >= 0 && ctx.life(map.upperTiles[i]!)) || map.events.some(e => e.x === xx && e.y === yy)) return true;
    }
    return false;
  };
  const bare = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && PLAIN.has(map.lowerTiles[at(x, y)]!) && map.upperTiles[at(x, y)]! < 0;
  const ring = (x: number, y: number) => [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => (dx === 0 && dy === 0) || bare(x + dx, y + dy) || water.has(at(x + dx, y + dy))));
  const shore: [number, number][] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!bare(x, y) || life(x, y, 2) || !ring(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => water.has(at(x + dx!, y + dy!)))) shore.push([x, y]);
  }
  for (let k = shore.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [shore[k], shore[j]] = [shore[j]!, shore[k]!]; }
  const clumps: [number, number][] = [];
  let placed = 0;
  for (const [x, y] of shore) {
    if (clumps.length >= groups) break;
    if (clumps.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 10)) continue;
    const want = 2 + Math.floor(random() * 2), mine: [number, number][] = [[x, y]];
    for (const [sx, sy] of shore) {
      if (mine.length >= want) break;
      const d = Math.max(Math.abs(sx - x), Math.abs(sy - y));
      if (d >= 2 && d <= 3 && mine.every(([mx, my]) => Math.max(Math.abs(mx - sx), Math.abs(my - sy)) >= 2)) mine.push([sx, sy]);
    }
    if (mine.length < 2) continue;
    for (const [px, py] of mine) map.upperTiles[at(px, py)] = PALM;
    clumps.push([x, y]);
    placed += mine.length;
  }
  return placed;
}

export interface ClimateDressResult { readonly treesCleared: number; readonly gardenRemoved: number; readonly groves: number; readonly bareTrees: number; readonly palms: number }

/**
 * Dress a forest-village map that now points at a climate sheet. Desert / volcano: leafy trees and bushes → bare
 * ground, then bare-tree groves where the forest stood (desert inland groves may take a cactus, palms by water);
 * all three: flower bushes 288 and planters 351 are removed. Only cells that were trees become groves, so nothing that
 * was walkable is blocked.
 */
export function dressClimateMap(map: GameMap, tileset: TilesetDef, climate: DressClimate, seed: number): ClimateDressResult {
  let gardenRemoved = 0;
  for (let i = 0; i < map.upperTiles.length; i++) {
    if (GARDEN_TILES.has(map.upperTiles[i]!)) { map.upperTiles[i] = -1; gardenRemoved += 1; }
    if (GARDEN_TILES.has(map.lowerTiles[i]!)) { map.lowerTiles[i] = GROUND; gardenRemoved += 1; }
  }
  if (climate === "autumn") return { treesCleared: 0, gardenRemoved, groves: 0, bareTrees: 0, palms: 0 };
  const cleared = clearLeafyTrees(map);
  const groves = arrangeBareGroves(map, tileset, { sites: cleared, seed, ...(climate === "desert" ? { cactus: CACTUS, rockChance: 0.5 } : {}) });
  const palms = climate === "desert" ? plantPalmGroves(map, tileset, { seed }) : 0;
  return { treesCleared: cleared.size, gardenRemoved, groves: groves.groves, bareTrees: groves.trees, palms };
}
