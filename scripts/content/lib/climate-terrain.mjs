// Climate ground (기후 지형) for maps on forest_harmony_volcano / _desert (sheet slots 3030~, drawn by
// scripts/content/climate-terrain.py, named by prepare-climate-tilesets.mjs). The ground itself is the decoration —
// cracks, cooled lava plates, dunes, ripple sand — and the few standing things (cacti, basalt, obsidian) sit by it in
// small clumps. Nothing is scattered one piece at a time (user 2026-09-25: 「돌·선인장·풀이 너무 많다」).
//
//   import { dressVolcanoGround, dressDesertGround, terrainKit } from "./lib/climate-terrain.mjs";
//   const kit = terrainKit(tileset);
//   const stats = dressVolcanoGround(map, { kit, isPlain, take, accept, seed, limits });
//
// terrainKit(tileset) → { blob: {plate, pool, cracked}, crack, stamps: Map<id, stamp>, ripple: number[] } or null
//   Read from the tileset's autotile groups (volcano_lava_plate_47 / volcano_lava_pool_47 / volcano_lava_crack /
//   desert_cracked_earth_47) and tile groups (climate-terrain:*). A stamp is { id, w, h, cells: [{dx, dy, tile, layer}] }.
//
// dressVolcanoGround(map, options) / dressDesertGround(map, options) → { pieces: [{kind, x, y, cells}], counts, maxSq, screen }
//   Mutates map. First a few set pieces (volcano: one or two small lava pools with fumaroles, one basalt cluster; desert:
//   up to two sandstone mesas, bones and a half-buried column in one remote spot, three or four cactus clumps), then —
//   while the fill gate fails (lib/village-fullness.mjs emptiness, options.limits, default { maxSq: 4, screen: 0.4 }) —
//   ground pieces grown from the largest plain square of the worst screen: volcano lava plates (2×2 blocks, 3×3 and up)
//   and crack networks (1 cell wide, branching, from a plate's edge or the open ash) with a rare obsidian shard or ash
//   heap on a crack; desert dunes (stamps 3×2 / 4×3 / 6×3), ripple sand patches and a few cracked-earth patches.
//   options.isPlain(x, y)          plain ground cell (the gate's notion; upper empty and lower in the plain set).
//   options.take(x, y, solid)      the caller's keep-out: false where nothing may go (access rings, yards, roads…).
//                                  Solid pieces also keep one cell off anything that is not plain ground or ours.
//   options.accept(cells)          reachability check for solid pieces (rolled back when it fails).
//   options.seed, options.limits, options.edgeBand (default 4)
//   options.setPieces              false to skip the set pieces (fields that already have their own).
//   desert: options.duneSeas (runs of 3–6 dunes, default 0), options.duneShare (fill share of dunes, 0.45),
//           options.mesas, options.cactusClumps; volcano: options.pools, options.basalt.
import { emptiness } from "./village-fullness.mjs";
import { rng } from "./bare-trees.mjs";

const DIRS = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 };
const OFF = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0], NE: [1, -1], SE: [1, 1], SW: [-1, 1], NW: [-1, -1] };
export const TERRAIN_FIRST = 3030;

export function terrainKit(tileset) {
  const auto = Object.fromEntries((tileset?.autotileGroups ?? []).map((g) => [g.id, g]));
  const stamps = new Map();
  for (const g of tileset?.tileGroups ?? []) {
    if (!g.id.startsWith("climate-terrain:") || !g.previewMap) continue;
    const { width: w, height: h, lowerTiles, upperTiles } = g.previewMap, cells = [];
    for (let k = 0; k < w * h; k++) {
      if (upperTiles[k] >= 0) cells.push({ dx: k % w, dy: Math.floor(k / w), tile: upperTiles[k], layer: "upper" });
      else if (lowerTiles[k] >= 0 && lowerTiles[k] !== 240) cells.push({ dx: k % w, dy: Math.floor(k / w), tile: lowerTiles[k], layer: "lower" });
    }
    stamps.set(g.id.slice("climate-terrain:".length), { id: g.id.slice("climate-terrain:".length), w, h, cells, tileIds: g.tileIds });
  }
  const blob = (id) => auto[id] && { variantMap: auto[id].variantMap, members: new Set(auto[id].memberTileIds), bodies: auto[id].interiorVariants?.[0] ?? [auto[id].variantMap["255"]] };
  const crack = auto.volcano_lava_crack && { variantMap: auto.volcano_lava_crack.variantMap, members: new Set(auto.volcano_lava_crack.memberTileIds) };
  if (!stamps.size && !crack) return null;
  return { blob: { plate: blob("volcano_lava_plate_47"), pool: blob("volcano_lava_pool_47"), cracked: blob("desert_cracked_earth_47") }, crack,
    stamps, ripple: stamps.get("ripple")?.tileIds ?? [] };
}

/** Every climate-ground tile number of the kit (for counting and for "is this ground dressed" tests). */
export function terrainTiles(kit) {
  const s = new Set();
  for (const b of Object.values(kit?.blob ?? {})) if (b) for (const t of b.members) s.add(t);
  if (kit?.crack) for (const t of kit.crack.members) s.add(t);
  for (const st of kit?.stamps?.values() ?? []) for (const c of st.cells) s.add(c.tile);
  return s;
}

function context(map, options) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const random = rng((options.seed ?? 1) * 31 + 7);
  const mine = new Uint8Array(W * H); // cells our pieces wrote (they may touch each other)
  const plain = (x, y) => inside(x, y) && options.isPlain(x, y);
  const take = (x, y, solid) => (options.take ? options.take(x, y, solid) : true);
  // A cell a piece may cover: plain and allowed; a solid piece also keeps one cell off anything that is neither plain
  // ground nor ours (ground pieces may run up to trees, rocks and walls: they are the ground under them).
  const ring = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (inside(X, Y) && !plain(X, Y) && !mine[at(X, Y)]) return false; } return true; };
  const free = (x, y, solid = false) => plain(x, y) && !mine[at(x, y)] && take(x, y, solid) && (!solid || ring(x, y));
  const edge = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
  return { W, H, at, inside, random, mine, free, plain, edge };
}

function paintBlob(map, ctx, group, cells) {
  const { W, H, at, random } = ctx;
  for (const i of cells) { map.lowerTiles[i] = group.bodies[0]; ctx.mine[i] = 1; }
  // re-pick the variant of every member cell round the blob (other blobs of the same group join it)
  const touched = new Set();
  for (const i of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = i % W + dx, y = Math.floor(i / W) + dy; if (ctx.inside(x, y)) touched.add(at(x, y)); }
  const on = (x, y) => ctx.inside(x, y) && group.members.has(map.lowerTiles[at(x, y)]);
  for (const i of touched) {
    const x = i % W, y = Math.floor(i / W);
    if (!on(x, y)) continue;
    let m = 0;
    for (const [k, b] of Object.entries(DIRS)) if (on(x + OFF[k][0], y + OFF[k][1])) m |= b;
    // full cells: one of the body drawings by a position hash (stable when repainted)
    map.lowerTiles[i] = m === 255 ? group.bodies[((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % group.bodies.length] : group.variantMap[String(m)];
  }
}

/** A ragged blob of whole 2×2 blocks (size cells) grown from (sx, sy) on cells where ok(x, y); convex corners trimmed. */
function growBlocks(ctx, sx, sy, size, ok) {
  const { at, random } = ctx, got = new Set();
  const block = (bx, by) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [bx + dx, by + dy]);
  const fits = (bx, by) => block(bx, by).every(([x, y]) => ok(x, y));
  const start = [[sx, sy], [sx - 1, sy], [sx, sy - 1], [sx - 1, sy - 1]].find(([bx, by]) => fits(bx, by));
  if (!start) return got;
  let [bx, by] = start;
  const front = [[bx, by]];
  for (let k = 0; k < size * 4 && got.size < size && front.length; k++) {
    [bx, by] = front[Math.floor(random() * front.length)];
    if (fits(bx, by)) for (const [x, y] of block(bx, by)) got.add(at(x, y));
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]][Math.floor(random() * 8)];
    if (fits(bx + dx, by + dy)) front.push([bx + dx, by + dy]);
  }
  return got;
}

/** A 4-connected patch of up to `size` cells from (sx, sy); cells with a single neighbour are trimmed (no spikes). */
function growCells(ctx, sx, sy, size, ok) {
  const { at, random, W } = ctx, got = new Set();
  if (!ok(sx, sy)) return got;
  got.add(at(sx, sy));
  const front = [[sx, sy]];
  for (let k = 0; k < size * 6 && got.size < size && front.length; k++) {
    const [x, y] = front[Math.floor(random() * front.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(random() * 4)];
    if (ok(x + dx, y + dy) && !got.has(at(x + dx, y + dy))) { got.add(at(x + dx, y + dy)); front.push([x + dx, y + dy]); }
  }
  // ripple lines run across: every cell keeps a left or right neighbour (a one-wide column reads as a dashed fence)
  for (let again = true; again;) {
    again = false;
    for (const i of [...got]) if (!got.has(i - 1) && !got.has(i + 1) || [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => got.has(i + dy * W + dx)).length < 2) { got.delete(i); again = true; }
  }
  return got;
}

function stampFits(ctx, st, x0, y0, solid) {
  for (let dy = 0; dy < st.h; dy++) for (let dx = 0; dx < st.w; dx++) if (!ctx.free(x0 + dx, y0 + dy, solid)) return false;
  return true;
}

function putStamp(map, ctx, st, x0, y0) {
  const cells = [];
  for (let dy = 0; dy < st.h; dy++) for (let dx = 0; dx < st.w; dx++) ctx.mine[ctx.at(x0 + dx, y0 + dy)] = 1;
  for (const c of st.cells) {
    const i = ctx.at(x0 + c.dx, y0 + c.dy);
    if (c.layer === "lower") map.lowerTiles[i] = c.tile; else map.upperTiles[i] = c.tile;
    cells.push({ x: x0 + c.dx, y: y0 + c.dy });
  }
  return cells;
}

function tryStamp(map, ctx, st, x0, y0, { solid = false, accept } = {}) {
  if (!st || !stampFits(ctx, st, x0, y0, solid)) return null;
  const saved = [map.lowerTiles.slice(), map.upperTiles.slice(), ctx.mine.slice()];
  const cells = putStamp(map, ctx, st, x0, y0);
  if (solid && accept && !accept(cells)) { [map.lowerTiles, map.upperTiles] = [saved[0], saved[1]]; ctx.mine.set(saved[2]); return null; }
  return cells;
}

/** 1-cell-wide branching crack network from (sx, sy): cells must be free, never form a 2×2 and never touch another
 * branch except through their parent. */
function growCrack(map, ctx, kit, sx, sy, length) {
  const { at, random, inside } = ctx, cells = new Set(), W = ctx.W;
  const isC = (x, y) => inside(x, y) && cells.has(at(x, y));
  // Other crack cells round a new cell may only be diagonal to it and next to its parent (a turn); anything else
  // would thicken the crack into a 2×2 or join two branches.
  const okCell = (x, y, px, py) => {
    if (!ctx.free(x, y) || isC(x, y)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if ((!dx && !dy) || !isC(X, Y) || (X === px && Y === py)) continue;
      if (!dx || !dy || Math.max(Math.abs(X - px), Math.abs(Y - py)) > 1) return false;
    }
    return true;
  };
  if (!ctx.free(sx, sy)) return cells;
  cells.add(at(sx, sy));
  // Each tip keeps a heading and a lean: most steps go ahead, the rest step aside toward its lean (a crack that wanders
  // on a slant, never a right-angled pipe); now and then a branch leaves with its own heading.
  const tips = [[sx, sy, Math.floor(random() * 4), random() < 0.5 ? 1 : 3]];
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let step = 0; step < length * 6 && cells.size < length && tips.length; step++) {
    const k = Math.floor(random() * tips.length); const [x, y, head, lean] = tips[k];
    const r = random(), nd = r < 0.58 ? head : r < 0.9 ? (head + lean) % 4 : (head + 4 - lean) % 4;
    const [dx, dy] = D4[nd];
    if (okCell(x + dx, y + dy, x, y)) {
      cells.add(at(x + dx, y + dy)); tips[k] = [x + dx, y + dy, head, lean];
      if (random() < 0.08) tips.push([x + dx, y + dy, (head + lean) % 4, random() < 0.5 ? 1 : 3]);
    } else if (random() < 0.35) tips.splice(k, 1);
  }
  if (cells.size < 7) return new Set();
  for (const i of cells) { ctx.mine[i] = 1; map.lowerTiles[i] = kit.crack.variantMap["0"]; }
  // lay the crack tiles by their N/E/S/W neighbours (straight runs alternate with the second drawing)
  const on = (x, y) => inside(x, y) && kit.crack.members.has(map.lowerTiles[at(x, y)]);
  for (const i of cells) {
    const x = i % W, y = Math.floor(i / W);
    let m = 0;
    if (on(x, y - 1)) m |= 1; if (on(x + 1, y)) m |= 2; if (on(x, y + 1)) m |= 4; if (on(x - 1, y)) m |= 8;
    map.lowerTiles[i] = kit.crack.variantMap[String(m)];
  }
  return cells;
}

function worstSquare(map, ctx, isPlain, limits, tried) {
  const e = emptiness(map, isPlain);
  if (e.maxSq <= limits.maxSq && e.screen <= limits.screen) return { done: true, e };
  const { W, H } = ctx;
  const [x0, y0, sw, sh] = e.maxSq > limits.maxSq ? [0, 0, W, H] : [e.screenAt[0], e.screenAt[1], Math.min(17, W), Math.min(13, H)];
  let best = 0, box = null;
  const dp = Array.from({ length: sh + 1 }, () => Array(sw + 1).fill(0));
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (isPlain(x0 + x, y0 + y) && !tried.has(ctx.at(x0 + x, y0 + y))) {
    dp[y + 1][x + 1] = 1 + Math.min(dp[y][x + 1], dp[y + 1][x], dp[y][x]);
    if (dp[y + 1][x + 1] > best) { best = dp[y + 1][x + 1]; box = [x0 + x - best + 1, y0 + y - best + 1, best]; }
  }
  return { done: false, e, box };
}

function count(map, kit) {
  const tiles = terrainTiles(kit), c = {};
  const name = new Map();
  for (const [k, b] of Object.entries(kit.blob)) if (b) for (const t of b.members) name.set(t, k);
  if (kit.crack) for (const t of kit.crack.members) name.set(t, "crack");
  const kind = (id) => id.split("-")[0] === "ash" ? "ash-heap" : id === "buried-column" ? "column" : id.split("-")[0];
  for (const [id, st] of kit.stamps) for (const cell of st.cells) if (!name.has(cell.tile)) name.set(cell.tile, kind(id));
  for (const lay of ["lowerTiles", "upperTiles"]) for (const t of map[lay]) if (tiles.has(t)) { const n = name.get(t); c[n] = (c[n] ?? 0) + 1; }
  return c;
}

function fillLoop(map, ctx, options, pieces, choose) {
  const limits = { maxSq: 4, screen: 0.4, ...(options.limits ?? {}) }, tried = new Set();
  let last = null;
  for (let step = 0; step < (options.maxSteps ?? 500); step++) {
    const w = worstSquare(map, ctx, options.isPlain, limits, tried);
    last = w.e;
    if (w.done || !w.box) break;
    const [bx, by, bs] = w.box;
    const sx = bx + Math.floor(ctx.random() * bs), sy = by + Math.floor(ctx.random() * bs);
    const piece = choose(sx, sy, bs);
    if (piece) pieces.push(piece); else tried.add(ctx.at(sx, sy));
  }
  const e = emptiness(map, options.isPlain);
  return { maxSq: e.maxSq, screen: e.screen, screenAt: e.screenAt };
}

export function dressVolcanoGround(map, options) {
  const kit = options.kit, ctx = context(map, options), pieces = [], R = ctx.random;
  if (!kit?.blob.plate || !kit.crack) return { pieces, counts: {}, ...emptiness(map, options.isPlain) };
  const cracks = [];
  const plate = (sx, sy, size) => {
    const cells = growBlocks(ctx, sx, sy, size, (x, y) => ctx.free(x, y));
    if (cells.size < 9) return null;
    paintBlob(map, ctx, kit.blob.plate, cells);
    return { kind: "plate", x: sx, y: sy, cells: cells.size };
  };
  const crack = (sx, sy, len) => {
    const cells = growCrack(map, ctx, kit, sx, sy, len);
    if (!cells.size) return null;
    cracks.push(...cells);
    return { kind: "crack", x: sx, y: sy, cells: cells.size };
  };
  // Set pieces: small lava pools with a fumarole beside, one basalt cluster near the edge.
  if (options.setPieces !== false) {
    const pools = options.pools ?? 1 + Math.floor(R() * 2);
    for (let k = 0, tries = 0; k < pools && tries < 200; tries++) {
      const x = 3 + Math.floor(R() * (ctx.W - 6)), y = 3 + Math.floor(R() * (ctx.H - 6));
      const cells = growBlocks(ctx, x, y, 12 + Math.floor(R() * 5), (xx, yy) => ctx.free(xx, yy, true) && ctx.free(xx - 1, yy, true) && ctx.free(xx + 1, yy, true));
      // no sausage: a pool spans at least 4 cells both ways (an L or a round of 2×2 blocks)
      const xs = [...cells].map((i) => i % ctx.W), ys = [...cells].map((i) => Math.floor(i / ctx.W));
      if (cells.size < 12 || Math.max(...xs) - Math.min(...xs) < 3 || Math.max(...ys) - Math.min(...ys) < 3) continue;
      const saved = [map.lowerTiles.slice(), ctx.mine.slice()];
      paintBlob(map, ctx, kit.blob.pool, cells);
      if (options.accept && !options.accept([...cells].map((i) => ({ x: i % ctx.W, y: Math.floor(i / ctx.W) })))) { map.lowerTiles = saved[0]; ctx.mine.set(saved[1]); continue; }
      pieces.push({ kind: "pool", x, y, cells: cells.size }); k++;
      // a fumarole with its sulfur stain two or three cells off the pool, and a crack running out of it
      const ring = [...cells].flatMap((i) => [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, -1]].map(([dx, dy]) => [i % ctx.W + dx, Math.floor(i / ctx.W) + dy]));
      for (let j = ring.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [ring[j], ring[r]] = [ring[r], ring[j]]; }
      const fum = kit.stamps.get(R() < 0.5 ? "fumarole-1" : "fumarole-2");
      for (const [fx, fy] of ring) {
        const got = tryStamp(map, ctx, fum, fx, fy - 1, { solid: true, accept: options.accept });
        if (!got) continue;
        pieces.push({ kind: "fumarole", x: fx, y: fy, cells: 2 });
        const s = kit.stamps.get(R() < 0.5 ? "sulfur-1" : "sulfur-2");
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, 0], [-1, 0]]) if (tryStamp(map, ctx, s, fx + dx, fy + dy)) { pieces.push({ kind: "sulfur", x: fx + dx, y: fy + dy, cells: 1 }); break; }
        break;
      }
      const edgeCells = [...cells].filter((i) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !cells.has(i + dy * ctx.W + dx)));
      for (let j = 0; j < 6; j++) {
        const i = edgeCells[Math.floor(R() * edgeCells.length)], [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
        const p = crack(i % ctx.W + dx * 2, Math.floor(i / ctx.W) + dy * 2, 8 + Math.floor(R() * 8));
        if (p) { pieces.push(p); break; }
      }
    }
    const bas = ["basalt-3x3", "basalt-3x2", "basalt-2x2-1", "basalt-2x2-2"];
    for (let k = 0, tries = 0; k < (options.basalt ?? 1) && tries < 300; tries++) {
      const st = kit.stamps.get(bas[Math.floor(R() * bas.length)]);
      const band = options.edgeBand ?? 4, side = Math.floor(R() * 4);
      const x = side === 0 ? 1 + Math.floor(R() * band) : side === 1 ? ctx.W - st.w - 1 - Math.floor(R() * band) : 1 + Math.floor(R() * (ctx.W - st.w - 2));
      const y = side === 2 ? 1 + Math.floor(R() * band) : side === 3 ? ctx.H - st.h - 1 - Math.floor(R() * band) : 1 + Math.floor(R() * (ctx.H - st.h - 2));
      const got = tryStamp(map, ctx, st, x, y, { solid: true, accept: options.accept });
      if (got) { pieces.push({ kind: "basalt", x, y, cells: got.length }); k++; }
    }
  }
  // Fill: plates and crack networks, cracks preferably from a plate's rim.
  let plates = 0;
  const res = fillLoop(map, ctx, options, pieces, (sx, sy, bs) => {
    if (bs >= 3 && (R() < 0.7 || plates < 2)) {
      const p = plate(sx, sy, 12 + Math.floor(R() * 20));
      if (p) {
        plates++;
        if (R() < 0.6) { // a crack out of the plate
          for (let j = 0; j < 8; j++) {
            const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
            let x = sx, y = sy;
            while (ctx.inside(x, y) && kit.blob.plate.members.has(map.lowerTiles[ctx.at(x, y)])) { x += dx; y += dy; }
            const c = crack(x + dx, y + dy, 8 + Math.floor(R() * 10));
            if (c) { pieces.push(c); break; }
          }
        }
        return p;
      }
    }
    return crack(sx, sy, 10 + Math.floor(R() * 12));
  });
  // A few shards and ash heaps on the cracks only (one per ~25 crack cells, at most 4).
  const extra = Math.min(4, Math.floor(cracks.length / 25));
  for (let k = 0, tries = 0; k < extra && tries < 60 && cracks.length; tries++) {
    const i = cracks[Math.floor(R() * cracks.length)], x = i % ctx.W, y = Math.floor(i / ctx.W);
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
    const st = kit.stamps.get(["obsidian-1", "obsidian-2", "ash-heap-1", "ash-heap-2"][Math.floor(R() * 4)]);
    // on bare ash right beside the crack (the ring rule would refuse the crack itself as a neighbour of ours: fine)
    const X = x + dx, Y = y + dy;
    if (!ctx.inside(X, Y) || !options.isPlain(X, Y) || ctx.mine[ctx.at(X, Y)] || !(options.take?.(X, Y, true) ?? true)) continue;
    const saved = map.upperTiles[ctx.at(X, Y)];
    map.upperTiles[ctx.at(X, Y)] = st.cells[0].tile;
    if (options.accept && !options.accept([{ x: X, y: Y }])) { map.upperTiles[ctx.at(X, Y)] = saved; continue; }
    ctx.mine[ctx.at(X, Y)] = 1; pieces.push({ kind: st.id.replace(/-\d$/, ""), x: X, y: Y, cells: 1 }); k++;
  }
  return { pieces, counts: count(map, kit), ...res };
}

export function dressDesertGround(map, options) {
  const kit = options.kit, ctx = context(map, options), pieces = [], R = ctx.random;
  if (!kit?.stamps.size) return { pieces, counts: {}, ...emptiness(map, options.isPlain) };
  const S = (id) => kit.stamps.get(id);
  const water = options.water ?? new Set();
  const nearWater = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (water.has(ctx.at(x + dx, y + dy))) return true; return false; };
  const ripple = (sx, sy, size) => {
    // ripple sand may follow narrow ground too (a floor texture, not a shape): grown cell by cell, spikes trimmed
    let cells = growBlocks(ctx, sx, sy, size, (x, y) => ctx.free(x, y));
    if (cells.size < 8) cells = growCells(ctx, sx, sy, Math.min(size, 12), (x, y) => ctx.free(x, y));
    if (cells.size < 5) return null;
    for (const i of cells) {
      const x = i % ctx.W, y = Math.floor(i / ctx.W), h = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 7;
      map.lowerTiles[i] = kit.ripple[h < 2 ? 0 : h < 4 ? 1 : h < 6 ? 2 : 3]; ctx.mine[i] = 1;
    }
    return { kind: "ripple", x: sx, y: sy, cells: cells.size };
  };
  const dune = (sx, sy, big) => {
    const ids = big >= 5 ? ["dune-l-1", "dune-m-1", "dune-m-2"] : big >= 3 ? ["dune-m-1", "dune-m-2", "dune-s-1", "dune-s-2"] : ["dune-s-1", "dune-s-2"];
    for (const id of ids.sort(() => R() - 0.5)) {
      const st = S(id);
      for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [-2, 0], [0, -2]]) {
        const got = tryStamp(map, ctx, st, sx - Math.floor(st.w / 2) + ox, sy - Math.floor(st.h / 2) + oy);
        if (got) return { kind: "dune", id, x: sx, y: sy, cells: got.length };
      }
    }
    return null;
  };
  const cracked = (sx, sy, size) => {
    if (!kit.blob.cracked || nearWater(sx, sy, 6)) return null;
    const cells = growBlocks(ctx, sx, sy, size, (x, y) => ctx.free(x, y));
    if (cells.size < 8) return null;
    paintBlob(map, ctx, kit.blob.cracked, cells);
    return { kind: "cracked", x: sx, y: sy, cells: cells.size };
  };
  if (options.setPieces !== false) {
    // Sandstone mesas: at most two, away from the middle (edge band first).
    const band = options.edgeBand ?? 5;
    for (let k = 0, tries = 0; k < (options.mesas ?? 1 + Math.floor(R() * 2)) && tries < 400; tries++) {
      const st = S(["mesa-3x3", "mesa-4x3", "mesa-5x4"][Math.floor(R() * 3)]);
      const x = 1 + Math.floor(R() * (ctx.W - st.w - 2)), y = 1 + Math.floor(R() * (ctx.H - st.h - 2));
      if (ctx.edge(x + (st.w >> 1), y + (st.h >> 1)) > band + 3) continue;
      const got = tryStamp(map, ctx, st, x, y, { solid: true, accept: options.accept });
      if (got) { pieces.push({ kind: "mesa", id: st.id, x, y, cells: got.length }); k++; }
    }
    // Bones and a half-buried column: one remote spot (farthest from anything that is not plain), both together.
    for (let tries = 0; tries < 300; tries++) {
      const x = 2 + Math.floor(R() * (ctx.W - 5)), y = 2 + Math.floor(R() * (ctx.H - 5));
      let remote = true;
      for (let dy = -4; dy <= 4 && remote; dy++) for (let dx = -4; dx <= 4; dx++) if (ctx.inside(x + dx, y + dy) && !ctx.plain(x + dx, y + dy)) { remote = false; break; }
      if (!remote) continue;
      const a = tryStamp(map, ctx, S("bones"), x, y, { solid: true, accept: options.accept });
      if (!a) continue;
      pieces.push({ kind: "bones", x, y, cells: 2 });
      const b = tryStamp(map, ctx, S("buried-column"), x + 2, y - 1, { solid: true, accept: options.accept }) ?? tryStamp(map, ctx, S("buried-column"), x - 1, y - 1, { solid: true, accept: options.accept });
      if (b) pieces.push({ kind: "column", x: x + 2, y: y - 1, cells: 2 });
      break;
    }
    // Dune seas (options.duneSeas, default none): a run of three to six dunes of mixed sizes a cell or two apart on wide
    // open sand — the dune field reads as dunes, not as one mound here and there.
    for (let k = 0, tries = 0; k < (options.duneSeas ?? 0) && tries < 200; tries++) {
      const cx = 6 + Math.floor(R() * (ctx.W - 12)), cy = 5 + Math.floor(R() * (ctx.H - 10));
      let open = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -7; dx <= 7; dx++) if (ctx.free(cx + dx, cy + dy)) open++;
      if (open < 15 * 9 * 0.7) continue;
      const got = [];
      for (const [ox, oy] of [[0, 0], [6, 1], [-6, -1], [3, -4], [-3, 4], [9, -3], [-9, 3]].sort(() => R() - 0.5)) {
        if (got.length >= 3 + Math.floor(R() * 4)) break;
        const d = dune(cx + ox + Math.floor(R() * 3) - 1, cy + oy, got.length ? 3 + Math.floor(R() * 3) : 5);
        if (d) got.push(d);
      }
      if (got.length < 3) continue;
      pieces.push(...got); k++;
      // the floor of the dune field is ripple sand (the gaps and stamp corners between dunes would stay bare)
      const xs = got.map((d) => d.x), ys = got.map((d) => d.y);
      let floor = 0;
      for (let y = Math.min(...ys) - 3; y <= Math.max(...ys) + 3; y++) for (let x = Math.min(...xs) - 4; x <= Math.max(...xs) + 4; x++) {
        if (!ctx.free(x, y)) continue;
        const i = ctx.at(x, y), h = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 7;
        map.lowerTiles[i] = kit.ripple[h < 2 ? 0 : h < 4 ? 1 : h < 6 ? 2 : 3]; ctx.mine[i] = 1; floor++;
      }
      pieces.push({ kind: "ripple", x: cx, y: cy, cells: floor });
    }
    // Cactus clumps: a saguaro with one or two small cacti, three or four clumps per map.
    for (let k = 0, tries = 0; k < (options.cactusClumps ?? 2 + Math.floor(R() * 2)) && tries < 300; tries++) {
      const x = 2 + Math.floor(R() * (ctx.W - 4)), y = 2 + Math.floor(R() * (ctx.H - 5));
      if (nearWater(x, y, 3)) continue;
      const lead = tryStamp(map, ctx, S(R() < 0.5 ? "cactus-saguaro" : "cactus-saguaro-2"), x, y, { solid: true, accept: options.accept });
      if (!lead) continue;
      let n = 1;
      for (const [dx, dy] of [[1, 1], [-1, 1], [2, 1], [-1, 0], [1, 0]].sort(() => R() - 0.5)) {
        if (n >= 2 + Math.floor(R() * 2)) break;
        if (tryStamp(map, ctx, S(R() < 0.6 ? "cactus-barrel" : "cactus-bloom"), x + dx, y + dy, { solid: true, accept: options.accept })) n++;
      }
      pieces.push({ kind: "cactus", x, y, cells: n }); k++;
    }
  }
  // Fill: dunes in the edge band and wide sand, ripple patches, now and then cracked earth.
  const res = fillLoop(map, ctx, options, pieces, (sx, sy, bs) => {
    const r = R();
    if (r < (options.duneShare ?? 0.45) && bs >= 2) { const d = dune(sx, sy, bs); if (d) return d; }
    if (r > 0.9 && bs >= 3) { const c = cracked(sx, sy, 10 + Math.floor(R() * 10)); if (c) return c; }
    return ripple(sx, sy, 10 + Math.floor(R() * 14));
  });
  return { pieces, counts: count(map, kit), ...res };
}

/**
 * Snow on the castle tops of a map on forest_harmony_snow. `snowWalls` is sheets.json terrain.snowWalls: [source,
 * copy] pairs drawn by climate-terrain.py (a source listed more than once has variants, picked by cell hash). Wall
 * tops, merlons, walks, the lower lip and tower heads take their snowy copy; the wall face 51 takes the copy with the
 * hanging snow only on its top row (a face two rows high would otherwise show two lips). Idempotent; returns the
 * number of cells changed.
 */
export function snowCastleTops(map, snowWalls) {
  const FACE = 51, W = map.width, to = new Map();
  for (const [src, dst] of snowWalls) { if (!to.has(src)) to.set(src, []); to.get(src).push(dst); }
  let n = 0;
  for (const layer of ["lowerTiles", "upperTiles"]) {
    const old = map[layer].slice();
    for (let i = 0; i < old.length; i++) {
      const v = to.get(old[i]);
      if (!v) continue;
      if (old[i] === FACE && i >= W && (old[i - W] === FACE || to.get(FACE).includes(old[i - W]))) continue;
      const x = i % W, y = Math.floor(i / W);
      map[layer][i] = v[(((x * 73856093) ^ (y * 19349663)) >>> 0) % v.length];
      n++;
    }
  }
  return n;
}
