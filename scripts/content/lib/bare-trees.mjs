// Leafless trees (잎 없는 나무) for the desert, volcano and snow climate sheets (build-climate-chipsets.py bakes them
// from 2880; prepare-climate-tilesets.mjs names them bare-trees:big-1 … shrub-5). Shared by the climate villages and
// any map on forest_harmony_desert / _volcano / _snow.
//
//   import { clearLeafyTrees, arrangeBareGroves } from "./lib/bare-trees.mjs";
//   const { cleared } = clearLeafyTrees(map);                       // leafy forest and tree stamps → bare ground 240
//   const { groves, trees } = arrangeBareGroves(map, { tileset, houses, keep, sites: cleared, seed, accept });
//
// clearLeafyTrees(map, { tiles? }) → { cleared: Set<cell>, orphans: number }   (mutates map)
//   Every cell whose lower or upper tile is a leafy tree (canopy 2550~2609, forest assemblies 1200~1463, forest-wall /
//   broadleaf / big oak / columns / round and small bushes 960~1123, the bush 289) goes back to bare ground 240 / empty
//   upper. Rocks 537 left alone next to a cleared cell (they belonged to a bush clump) go too.
//
// arrangeBareGroves(map, options) → { groves: [{ x, y, band, trees: [{ id, x, y }], props: [{ tile, x, y }] }], trees, stats }
//   Mutates map. Groves, never single pieces: one big or mid tree, 1–2 companions (0–1 inland) standing against it,
//   and at the trunk foot 1–2 rocks and 1–2 dry shrubs (desert inland groves: sometimes a cactus).
//   options.tileset   TilesetDef with the bare-trees:* groups (climate tileset). Without them nothing is placed.
//   options.sites     Iterable<cell> where a grove may stand (e.g. `cleared`). Default: every free cell.
//   options.houses    [{x,y,w,h}] house footprints; options.keep [[x,y]] door fronts / access / entry points.
//   options.reserved  Set<cell> cells no piece may cover (plan objects, yards).
//   options.clearance cells kept free round houses, roads, doors, stairs, bridges, fences and keep points (default 2:
//                     nothing within 2 cells). Water, cliffs and other objects keep 1 cell.
//   options.band      edge band width (default 4): groves there are denser (options.spacing.band, default 8 cells
//                     between grove centres) than inland (options.spacing.inner, default 13).
//   options.rock      rock tile (default 537; null for none), options.cactus (desert: 769, default none), options.seed.
//   options.accept(cells) → boolean   caller's reachability check; a grove that fails is rolled back whole.
//   options.undergrowth { size: [min, max] cells (default 18–34), clearance (default = options.clearance), tile (304) }
//                     grows a tall grass patch (whole 2×2 blocks) from the grove's foot, marked with `tile`; lay the
//                     map's tall grass afterwards with arrangeTallGrass (it picks E/F/G and the edge pieces). On snow and
//                     ash use clearance 3 so the patch never turns into the short G grass by houses and roads.
//   Trees never share a cell (whole boxes stay apart: one upper tile per cell); a tree's -1 cells are left untouched.
import { ALL_TALL_GRASS } from "./tall-grass.mjs";
import { emptiness } from "./village-fullness.mjs";

export const BARE_TREE_FIRST = 2880;
export const GROUND = 240, ROCK = 537, CACTUS = 769, PALM = 770;
const PLAIN = new Set([240, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);
export const isLeafyTree = (t) => (t >= 2550 && t <= 2609) || (t >= 1200 && t <= 1463) || (t >= 960 && t <= 1123) || t === 289;

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Stamps from the tileset's bare-trees:* groups: { id, kind, w, h, cells: [{dx, dy, tile, layer}] } (-1 cells left out). */
export function bareTreeStamps(tileset) {
  return (tileset?.tileGroups ?? []).filter((g) => g.id.startsWith("bare-trees:")).map((g) => {
    const { width: w, height: h, lowerTiles, upperTiles } = g.previewMap, cells = [];
    for (let k = 0; k < w * h; k++) {
      const up = upperTiles[k], lo = lowerTiles[k];
      if (up >= 0) cells.push({ dx: k % w, dy: Math.floor(k / w), tile: up, layer: "upper" });
      else if (lo >= 0 && lo !== GROUND) cells.push({ dx: k % w, dy: Math.floor(k / w), tile: lo, layer: "lower" });
    }
    return { id: g.id.slice("bare-trees:".length), kind: g.id.slice("bare-trees:".length).split("-")[0], w, h, cells };
  });
}

export function clearLeafyTrees(map, { tiles = isLeafyTree } = {}) {
  const cleared = new Set();
  for (let i = 0; i < map.lowerTiles.length; i++) {
    const lo = tiles(map.lowerTiles[i]), up = map.upperTiles[i] >= 0 && tiles(map.upperTiles[i]);
    if (!lo && !up) continue;
    if (lo) map.lowerTiles[i] = GROUND;
    if (up) map.upperTiles[i] = -1;
    cleared.add(i);
  }
  const W = map.width, H = map.height;
  let orphans = 0;
  for (let i = 0; i < map.upperTiles.length; i++) {
    if (map.upperTiles[i] !== ROCK) continue;
    const x = i % W, y = Math.floor(i / W);
    let touches = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && cleared.has((y + dy) * W + x + dx)) touches = true;
    if (touches) { map.upperTiles[i] = -1; orphans++; }
  }
  return { cleared, orphans };
}

const LIFE_ROLES = new Set(["building", "wall", "roof", "door", "window", "fence"]);
function contexts(tileset) {
  const groups = tileset?.autotileGroups ?? [], meta = tileset?.tileMeta ?? [];
  const members = (test) => new Set(groups.filter((g) => test(g.id)).flatMap((g) => [...(g.memberTileIds ?? []), ...Object.values(g.variantMap ?? {})]));
  const road = members((id) => /road|dirt|cobble/.test(id) && !/grass/.test(id));
  const water = members((id) => /lake|water|ice/.test(id));
  const life = (t) => {
    const m = meta[t];
    return road.has(t) || LIFE_ROLES.has(m?.role) || /계단|다리|울타리|문\/입구|stairs|bridge|fence|door/.test(m?.label ?? "");
  };
  return { life, water: (t) => water.has(t) || meta[t]?.role === "water" };
}

export function arrangeBareGroves(map, options = {}) {
  const W = map.width, H = map.height, N = W * H, at = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const stamps = bareTreeStamps(options.tileset);
  const out = { groves: [], trees: 0, stats: { candidates: 0, rolledBack: 0 } };
  if (!stamps.length) return out;
  const random = rng(options.seed ?? 1), clearance = options.clearance ?? 2, band = options.band ?? 4;
  const spacing = { band: 8, inner: 13, ...(options.spacing ?? {}) };
  const rock = "rock" in options ? options.rock : ROCK, cactus = options.cactus ?? null, reserved = options.reserved ?? new Set();
  const ctx = contexts(options.tileset);
  // Keep-out rings: life (houses, roads, doors, stairs, bridges, fences, keep points) within `clearance`; water,
  // cliffs and any other standing object within one cell.
  const life = new Uint8Array(N), hard = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const lo = map.lowerTiles[i], up = map.upperTiles[i];
    if (ctx.life(lo) || (up >= 0 && ctx.life(up))) life[i] = 1;
    else if (ctx.water(lo) || up >= 0 || !(PLAIN.has(lo) || ALL_TALL_GRASS.has(lo))) hard[i] = 1;
  }
  for (const h of options.houses ?? []) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) if (inside(x, y)) life[at(x, y)] = 1;
  for (const [x, y] of options.keep ?? []) if (inside(x, y)) life[at(x, y)] = 1;
  const within = (mask, x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inside(xx, yy) && mask[at(xx, yy)]) return true; return false; };
  const taken = new Uint8Array(N); // boxes of placed trees and props
  // A cell can take a piece: free ground, off the keep-out rings, not reserved, not in another tree's box.
  const free = (x, y, trunk) => {
    if (!inside(x, y)) return false;
    const i = at(x, y), lo = map.lowerTiles[i];
    return !taken[i] && !reserved.has(i) && map.upperTiles[i] < 0 && (trunk ? PLAIN.has(lo) : PLAIN.has(lo) || ALL_TALL_GRASS.has(lo))
      && !within(life, x, y, clearance) && !within(hard, x, y, 1);
  };
  const byKind = (k) => stamps.filter((s) => s.kind === k);
  const pick = (k) => { const l = byKind(k); return l[Math.floor(random() * l.length)]; };
  const fits = (st, x0, y0) => {
    for (let dy = 0; dy < st.h; dy++) for (let dx = 0; dx < st.w; dx++) if (!inside(x0 + dx, y0 + dy) || taken[at(x0 + dx, y0 + dy)]) return false;
    return st.cells.every((c) => free(x0 + c.dx, y0 + c.dy, c.layer === "lower"));
  };
  let undo = [];
  const write = (layer, i, t) => { undo.push([layer, i, map[layer][i]]); map[layer][i] = t; };
  const put = (st, x0, y0, trees) => {
    if (!fits(st, x0, y0)) return false;
    for (let dy = 0; dy < st.h; dy++) for (let dx = 0; dx < st.w; dx++) { taken[at(x0 + dx, y0 + dy)] = 1; undo.push(["taken", at(x0 + dx, y0 + dy)]); }
    for (const c of st.cells) {
      const i = at(x0 + c.dx, y0 + c.dy);
      if (c.layer === "lower") { write("lowerTiles", i, c.tile); } else write("upperTiles", i, c.tile);
    }
    trees.push({ id: st.id, x: x0, y: y0, w: st.w, h: st.h });
    return true;
  };
  const putTile = (tile, x, y, props) => {
    if (!free(x, y, false)) return false;
    taken[at(x, y)] = 1; undo.push(["taken", at(x, y)]);
    write("upperTiles", at(x, y), tile);
    props.push({ tile, x, y });
    return true;
  };
  const rollback = () => {
    for (const u of undo.reverse()) if (u[0] === "taken") taken[u[1]] = 0; else map[u[0]][u[1]] = u[2];
    undo = [];
  };
  const edge = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
  // Grove centres (trunk foot): candidate sites in a seeded shuffle, denser in the edge band than inland.
  const sites = [...(options.sites ?? Array.from({ length: N }, (_, i) => i))].filter((i) => free(i % W, Math.floor(i / W), true));
  for (let k = sites.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [sites[k], sites[j]] = [sites[j], sites[k]]; }
  out.stats.candidates = sites.length;
  const centres = [];
  for (const i of sites) {
    const x = i % W, y = Math.floor(i / W), inBand = edge(x, y) <= band, d = inBand ? spacing.band : spacing.inner;
    if (centres.some(([cx, cy, cb]) => (x - cx) ** 2 + (y - cy) ** 2 < (cb && inBand ? d : Math.max(d, spacing.inner)) ** 2)) continue;
    undo = [];
    const trees = [], props = [];
    // Lead tree, trunk foot on the centre (a cell either side if the box does not fit).
    let lead = null;
    for (const kind of inBand && random() < 0.6 ? ["big", "mid", "small"] : ["mid", "big", "small"]) {
      const st = pick(kind);
      for (const ox of [0, -1, 1]) {
        const x0 = x - Math.floor(st.w / 2) + ox, y0 = y - st.h + 1;
        if (put(st, x0, y0, trees)) { lead = { st, x0, y0 }; break; }
      }
      if (lead) break;
    }
    if (!lead) continue;
    // Companions stand against the lead (left or right, feet within two rows of its foot).
    const mates = inBand ? 1 + Math.floor(random() * 2) : Math.floor(random() * 2);
    for (let m = 0; m < mates; m++) {
      const st = pick(random() < 0.67 ? "small" : "mid"), side = random() < 0.5 ? -1 : 1;
      const foot = lead.y0 + lead.st.h - st.h;
      done: for (const s of [side, -side]) for (const dy of [0, 1, -1, 2]) {
        const bx = s > 0 ? Math.max(lead.x0 + lead.st.w, ...trees.map((t) => t.x + t.w)) : Math.min(lead.x0, ...trees.map((t) => t.x)) - st.w;
        if (put(st, bx, foot + dy, trees)) break done;
      }
    }
    // Rocks and dry shrubs at the lead's foot; desert inland groves sometimes a cactus.
    const by = lead.y0 + lead.st.h - 1, lx = lead.x0, rx = lead.x0 + lead.st.w;
    const spots = [[lx - 1, by], [rx, by], [lx - 1, by + 1], [rx, by + 1], [lx + Math.floor(lead.st.w / 2), by + 1], [lx, by + 1]];
    for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
    let rocks = rock != null ? (inBand ? 1 + Math.floor(random() * 2) : 1) : 0, shrubs = 1 + Math.floor(random() * 2);
    const shrubStamps = byKind("shrub");
    for (const [sx, sy] of spots) if (rocks && putTile(rock, sx, sy, props)) rocks--;
    for (const [sx, sy] of spots) if (shrubs && shrubStamps.length && putTile(shrubStamps[Math.floor(random() * shrubStamps.length)].cells[0].tile, sx, sy, props)) shrubs--;
    if (cactus != null && !inBand && random() < 0.5) for (const [sx, sy] of spots) if (putTile(cactus, sx, sy, props)) break;
    const cells = [...trees.flatMap((t) => { const st = stamps.find((s) => s.id === t.id); return st.cells.map((c) => ({ x: t.x + c.dx, y: t.y + c.dy })); }), ...props];
    if (options.accept && !options.accept(cells)) { rollback(); out.stats.rolledBack++; continue; }
    undo = [];
    // Undergrowth: a patch of tall grass round the grove's foot (part of the same clump, walkable). Cells are marked
    // with the tall grass body 304; the caller lays the whole map's tall grass afterwards (arrangeTallGrass).
    const grass = [];
    if (options.undergrowth) {
      const { size = [18, 34], clearance: gc = clearance, tile = 304 } = options.undergrowth;
      const ok = (gx, gy) => inside(gx, gy) && gx > 0 && gy > 0 && gx < W - 1 && gy < H - 1 && !reserved.has(at(gx, gy)) && map.upperTiles[at(gx, gy)] < 0
        && PLAIN.has(map.lowerTiles[at(gx, gy)]) && !within(life, gx, gy, gc) && !within(hard, gx, gy, 1);
      const want = size[0] + Math.floor(random() * (size[1] - size[0] + 1)), got = new Set();
      const block = (bx, by) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [bx + dx, by + dy]);
      const starts = [[lx - 2, by - 1], [rx, by - 1], [lx + Math.floor(lead.st.w / 2) - 1, by + 1], [lx - 2, by + 1], [rx, by + 1]];
      for (let k = starts.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [starts[k], starts[j]] = [starts[j], starts[k]]; }
      for (const [sx, sy] of starts) {
        if (!block(sx, sy).every(([gx, gy]) => ok(gx, gy))) continue;
        let [bx, by2] = [sx, sy];
        for (let step = 0; step < want * 3 && got.size < want; step++) {
          const b = block(bx, by2);
          if (b.every(([gx, gy]) => ok(gx, gy))) for (const [gx, gy] of b) got.add(at(gx, gy));
          const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]][Math.floor(random() * 6)];
          if (block(bx + dx, by2 + dy).every(([gx, gy]) => ok(gx, gy))) [bx, by2] = [bx + dx, by2 + dy];
        }
        break;
      }
      if (got.size >= 8) for (const i of got) { map.lowerTiles[i] = tile; grass.push([i % W, Math.floor(i / W)]); }
    }
    centres.push([x, y, inBand]);
    out.groves.push({ x, y, band: inBand, trees: trees.map(({ id, x, y }) => ({ id, x, y })), props, grass: grass.length });
    out.trees += trees.length;
  }
  return out;
}

/**
 * Palm groves by the water (desert): `groups` clumps of 2–3 palms 770 on the shore (bare ground one cell from water),
 * palms two cells apart within a clump, clumps ten cells apart, off the keep-out rings (same rules as the groves).
 * Returns the placed palms [{x, y}].
 */
export function plantPalmGroves(map, { water, groups = 3, seed = 1, keep = [], houses = [], tileset, accept, reserved = new Set() }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, random = rng(seed * 7 + 3), placed = [];
  const ctx = contexts(tileset);
  const life = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) { const i = at(xx, yy); if (ctx.life(map.lowerTiles[i]) || (map.upperTiles[i] >= 0 && ctx.life(map.upperTiles[i])) || keep.some(([kx, ky]) => kx === xx && ky === yy) || houses.some((h) => xx >= h.x && xx < h.x + h.w && yy >= h.y && yy < h.y + h.h)) return true; } return false; };
  const bare = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && PLAIN.has(map.lowerTiles[at(x, y)]) && map.upperTiles[at(x, y)] < 0 && !reserved.has(at(x, y));
  const ring = (x, y) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => (dx === 0 && dy === 0) || bare(x + dx, y + dy) || water.has(at(x + dx, y + dy))));
  const shore = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!bare(x, y) || life(x, y, 2) || !ring(x, y)) continue;
    let wet = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (water.has(at(x + dx, y + dy))) wet = true;
    if (wet) shore.push([x, y]);
  }
  for (let k = shore.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [shore[k], shore[j]] = [shore[j], shore[k]]; }
  const clumps = [];
  for (const [x, y] of shore) {
    if (clumps.length >= groups) break;
    if (clumps.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 10)) continue;
    const want = 2 + Math.floor(random() * 2), mine = [[x, y]];
    for (const [sx, sy] of shore) {
      if (mine.length >= want) break;
      const d = Math.max(Math.abs(sx - x), Math.abs(sy - y));
      if (d >= 2 && d <= 3 && mine.every(([mx, my]) => Math.max(Math.abs(mx - sx), Math.abs(my - sy)) >= 2)) mine.push([sx, sy]);
    }
    if (mine.length < 2) continue;
    for (const [px, py] of mine) map.upperTiles[at(px, py)] = PALM;
    if (accept && !accept(mine.map(([px, py]) => ({ x: px, y: py })))) { for (const [px, py] of mine) map.upperTiles[at(px, py)] = -1; continue; }
    clumps.push([x, y]);
    placed.push(...mine.map(([px, py]) => ({ x: px, y: py })));
  }
  return placed;
}

/**
 * Meadows for sand and ash once the forest is gone: while the fill gate fails (lib/village-fullness.mjs emptiness —
 * no plain square over limits.maxSq, no 17×13 screen over limits.screen plain), a patch of whole 2×2 tall grass blocks
 * (size[0]..size[1] cells) grows from the largest plain square of the worst screen. Unlike the gap fill's separate
 * patches it may join an existing patch (one dry meadow rather than a dotted field). `arrange(map)` re-lays the map's
 * tall grass; a patch is kept only if every tall grass cell it creates is in `members` (snow / ash: E and F only).
 * `take(x, y)` guards reserved cells. Returns { patches, maxSq, screen }.
 */
export function growMeadows(map, { isPlain, take = () => true, members, arrange, seed = 1, limits = { maxSq: 4, screen: 0.4 }, maxSteps = 400, size = [8, 18] }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, random = rng(seed * 17 + 5), tried = new Set(), patches = [];
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && isPlain(x, y) && take(x, y);
  const foreign = () => map.lowerTiles.reduce((n, t) => n + (ALL_TALL_GRASS.has(t) && !members.has(t) ? 1 : 0), 0);
  let e = emptiness(map, isPlain);
  for (let step = 0; step < maxSteps && !(e.maxSq <= limits.maxSq && e.screen <= limits.screen); step++) {
    // Seed: a random cell of the largest untried plain square — over the whole map while a square is too big,
    // otherwise inside the emptiest screen.
    const [x0, y0, sw, sh] = e.maxSq > limits.maxSq ? [0, 0, W, H] : [e.screenAt[0], e.screenAt[1], Math.min(17, W), Math.min(13, H)];
    let best = 0, box = null;
    const dp = Array.from({ length: sh + 1 }, () => Array(sw + 1).fill(0));
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (ok(x0 + x, y0 + y) && !tried.has(at(x0 + x, y0 + y))) {
      dp[y + 1][x + 1] = 1 + Math.min(dp[y][x + 1], dp[y + 1][x], dp[y][x]);
      if (dp[y + 1][x + 1] > best) { best = dp[y + 1][x + 1]; box = [x0 + x - best + 1, y0 + y - best + 1, best]; }
    }
    if (!box) break;
    const sx = box[0] + Math.floor(random() * box[2]), sy = box[1] + Math.floor(random() * box[2]);
    const block = (bx, by) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [bx + dx, by + dy]);
    const fits = (bx, by) => block(bx, by).every(([x, y]) => ok(x, y));
    const start = [[sx, sy], [sx - 1, sy], [sx, sy - 1], [sx - 1, sy - 1]].find(([bx, by]) => fits(bx, by));
    const want = size[0] + Math.floor(random() * (size[1] - size[0] + 1)), got = new Set();
    if (start) {
      let [bx, by] = start;
      for (let k = 0; k < want * 3 && got.size < want; k++) {
        if (fits(bx, by)) for (const [x, y] of block(bx, by)) got.add(at(x, y));
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]][Math.floor(random() * 6)];
        if (fits(bx + dx, by + dy)) [bx, by] = [bx + dx, by + dy];
      }
    }
    if (got.size < 4) { tried.add(at(sx, sy)); continue; }
    const saved = map.lowerTiles.slice(), before = foreign();
    for (const i of got) map.lowerTiles[i] = 304;
    arrange(map);
    const laid = [...got].filter((i) => members.has(map.lowerTiles[i]));
    if (laid.length < 4 || foreign() > before) { map.lowerTiles = saved; tried.add(at(sx, sy)); continue; }
    patches.push(laid.map((i) => [i % W, Math.floor(i / W)]));
    e = emptiness(map, isPlain);
  }
  // Pinholes: plain cells a meadow closes on three or four sides join it (a meadow, not a sieve).
  if (patches.length) {
    const saved = map.lowerTiles.slice(), before = foreign();
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (!ok(x, y)) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => ALL_TALL_GRASS.has(map.lowerTiles[at(x + dx, y + dy)])).length;
        if (n >= 3) add.push(at(x, y));
      }
      for (const i of add) map.lowerTiles[i] = 304;
    }
    arrange(map);
    if (foreign() > before) map.lowerTiles = saved;
    e = emptiness(map, isPlain);
  }
  return { patches, maxSq: e.maxSq, screen: e.screen };
}
