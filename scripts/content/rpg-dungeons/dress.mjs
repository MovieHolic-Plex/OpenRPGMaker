// Floor dressing, the last and lightest step. Rubble, bones and rocks go in one to three heaps against a wall
// corner (where a ceiling or wall would have come down), never spread over the floor — the floor stays visible.
// No floor-texture patches (moss reads as grass, gravel as footprints, slabs as missing tiles) and nothing that
// does not belong: no crystals in lava or the demon keep, no furniture anywhere. Terrain (outcrops against the
// walls, water, lava, pillars in the plans) does the real work of breaking big floors; the heaps finish it.
// Solid pieces are kept only if every cell the entrance could reach is still reachable, and nothing goes on the
// shortest paths from the entrance to the targets/exits or on laid walkways.

/** Bare floor bodies: what the emptiness check counts as "plain". Dressing tiles are deliberately not in it. */
export const PLAIN_FLOORS = [421, 187, 108, 301, 67, 110, 141];

// A heap: one landmark piece (a boulder, a stalagmite) with loose debris packed round it.
const one = (t) => ({ cells: [[0, 0, t]] });
const tall = (top, bottom) => ({ cells: [[0, 0, top], [0, 1, bottom]] });
const square = (a, b, c, d) => ({ cells: [[0, 0, a], [1, 0, b], [0, 1, c], [1, 1, d]] });
const RUBBLE = { cells: [[0, 0, 259], [1, 0, 260]] };
const STALAGMITE = tall(261, 291), CRYSTAL_PILLAR = tall(262, 292);
const BIG_BROWN = square(318, 319, 348, 349), BIG_GREY = square(322, 323, 352, 353);

const PALETTES = {
  cave: { big: [BIG_BROWN, STALAGMITE], bits: [382, 383, 412, "rubble"], grove: [STALAGMITE, one(288), one(288), one(290)] },
  stone: { big: [BIG_GREY, RUBBLE], bits: [382, 383, 412, "rubble"] },
  crypt: { big: [RUBBLE, BIG_GREY], bits: [383, 382, 299, "rubble"] },
  desert: { big: [BIG_BROWN, RUBBLE], bits: [412, 299, "rubble"] },
  tower: { big: [], bits: [] },
  hall: { big: [BIG_GREY, RUBBLE], bits: [382, 383, 412, "rubble"] },
  demon: { big: [BIG_BROWN, one(288)], bits: [412, 299, 412] },
  lava: { big: [BIG_BROWN, one(288)], bits: [412, 412, 288], grove: [one(288), one(288), BIG_BROWN, one(412)] },
  ice: { big: [BIG_GREY, CRYSTAL_PILLAR], bits: [382, 383, 413], grove: [CRYSTAL_PILLAR, one(413), one(289), STALAGMITE] },
  sea: { big: [BIG_BROWN], bits: [412, 382, 288], grove: [one(288), one(288), BIG_BROWN, one(412)] },
  // the lair's gold (259·260·382·383·322…353 on its sheet) stays in the hand-placed hoard round the nest
  lair: { big: [BIG_BROWN, STALAGMITE], bits: [412, 412], grove: [one(288), one(288), STALAGMITE, BIG_BROWN] },
};

const SCREEN_W = 17, SCREEN_H = 13;

export function dressFloor(m, spec, { passable, protect, clear, reach }, target = { sq: 4, screen: 0.38 }) {
  const W = m.width, H = m.height;
  const pal = PALETTES[spec.dress ?? spec.theme];
  if (!pal || spec.dress === false || !pal.big.length) return { placed: 0, heaps: 0, log: [] };
  const maxHeaps = spec.heaps ?? 3;
  let seed = [...spec.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const plain = new Set(PLAIN_FLOORS);
  const bare = (x, y) => inside(x, y) && m.upperTiles[y * W + x] === -1 && plain.has(m.lowerTiles[y * W + x]);
  const free = (x, y) => bare(x, y) && !protect.has(y * W + x) && !clear.has(y * W + x);
  // a wall-ish neighbour: not floor at all (void, wall face, water, lava), or a solid prop
  // (off the map is not a wall: a corridor runs on out of view, and nothing is heaped in its mouth)
  const hard = (x, y) => inside(x, y) && !bare(x, y) && (m.upperTiles[y * W + x] === -1 || !passable(m.upperTiles[y * W + x]));
  const corner = (x, y) => x > 2 && y > 2 && x < W - 3 && y < H - 3 && (hard(x - 1, y) || hard(x + 1, y)) && (hard(x, y - 1) || hard(x, y + 1));
  const log = [], heaps = [];
  let reached = reach ? reach(m) : null;
  const put = (x, y, piece) => {
    const cells = piece.cells.map(([dx, dy, t]) => [x + dx, y + dy, t]);
    if (!cells.every(([a, b]) => free(a, b))) return false;
    const solid = cells.some(([, , t]) => !passable(t));
    cells.forEach(([a, b, t]) => { m.upperTiles[b * W + a] = t; });
    if (solid && reached) {
      const now = reach(m), own = new Set(cells.map(([a, b]) => b * W + a));
      if ([...reached].some((k) => !own.has(k) && !now.has(k))) { cells.forEach(([a, b]) => { m.upperTiles[b * W + a] = -1; }); return false; }
      reached = now;
    }
    log.push({ kind: "prop", x, y, tiles: cells.map(([a, b, t]) => [a - x, b - y, t]) });
    return true;
  };
  const grow = (x, y, n) => {
    const cells = [[x, y]], seen = new Set([y * W + x]);
    for (let i = 0; i < cells.length && cells.length < n; i++) {
      // grow along the walls first so the heap hugs the corner
      const [cx, cy] = cells[i];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort((p, q) => (corner(cx + q[0], cy + q[1]) - corner(cx + p[0], cy + p[1])) || rnd() - 0.5);
      for (const [dx, dy] of dirs) {
        const X = cx + dx, Y = cy + dy;
        if (cells.length < n && free(X, Y) && !seen.has(Y * W + X)) { seen.add(Y * W + X); cells.push([X, Y]); }
      }
    }
    return cells;
  };
  for (let n = 0; n < maxHeaps; n++) {
    const s = bareStats(m);
    if (s.sq <= target.sq && s.screen <= target.screen) break;
    const [wx, wy] = s.win ?? [0, 0];
    let best = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!free(x, y) || !corner(x, y)) continue;
      if (heaps.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 8)) continue;
      const inWin = x >= wx && x < wx + SCREEN_W && y >= wy && y < wy + SCREEN_H;
      const inSq = s.at && x >= s.at[0] - 2 && x < s.at[0] + s.sq + 2 && y >= s.at[1] - 2 && y < s.at[1] + s.sq + 2;
      const score = (s.sq > target.sq ? inSq * 4 : 0) + inWin * 2 + rnd();
      if (!best || score > best.score) best = { x, y, score };
    }
    if (!best) break;
    const heap = grow(best.x, best.y, 6 + Math.floor(rnd() * 4));
    const bigs = [...pal.big].sort(() => rnd() - 0.5);
    heap.some(([a, b]) => bigs.some((p) => put(a, b, p)));
    for (const [a, b] of heap) {
      if (!free(a, b) || rnd() < 0.25) continue;
      const bit = pick(pal.bits);
      if (bit === "rubble") put(a, b, RUBBLE) || put(a, b, one(383));
      else put(a, b, one(bit));
    }
    heaps.push([best.x, best.y]);
  }
  // Natural ground growth, still in clumps against the rock: a stand of stalagmites, a crystal knot, coral.
  // Only where the ground itself grows things (caves, ice, lava, sea); built rooms pass by their plan.
  const groves = [];
  for (let n = 0; n < (spec.groves ?? 14) && pal.grove?.length; n++) {
    const s = bareStats(m);
    if (s.sq <= target.sq && s.screen <= target.screen) break;
    const [wx, wy] = s.win ?? [0, 0];
    let best = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // a stand may also rise inside an open square that is too big (stalagmites grow mid-floor too)
      const inBig = s.sq > target.sq && s.at && x >= s.at[0] + 1 && x < s.at[0] + s.sq - 1 && y >= s.at[1] + 1 && y < s.at[1] + s.sq - 1;
      if (!free(x, y) || !(corner(x, y) || inBig)) continue;
      if ([...heaps, ...groves].some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 5)) continue;
      const inWin = x >= wx && x < wx + SCREEN_W && y >= wy && y < wy + SCREEN_H;
      const inSq = s.at && x >= s.at[0] - 2 && x < s.at[0] + s.sq + 2 && y >= s.at[1] - 2 && y < s.at[1] + s.sq + 2;
      const score = (s.sq > target.sq ? inSq * 4 : 0) + inWin * 2 + rnd();
      if (!best || score > best.score) best = { x, y, score };
    }
    if (!best) break;
    const clump = grow(best.x, best.y, 4 + Math.floor(rnd() * 2));
    let placed = 0;
    for (const [a, b] of clump) if (free(a, b) && [...pal.grove].sort(() => rnd() - 0.5).some((p) => put(a, b, p))) placed++;
    groves.push([best.x, best.y]);
    if (!placed) break;
  }
  const final = bareStats(m);
  return { placed: log.length, heaps: heaps.length, groves: groves.length, maxSq: final.sq, screen: +final.screen.toFixed(3), log };
}

/** Emptiness numbers the gate checks: the largest bare square and the barest 17×13 screen (stepped by 4). */
export function bareStats(m) {
  const W = m.width, H = m.height, plain = new Set(PLAIN_FLOORS);
  const bare = (x, y) => m.upperTiles[y * W + x] === -1 && plain.has(m.lowerTiles[y * W + x]);
  const dp = Array.from({ length: H + 1 }, () => Array(W + 1).fill(0));
  let sq = 0, at = null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!bare(x, y)) continue;
    const v = 1 + Math.min(dp[y][x + 1], dp[y + 1][x], dp[y][x]);
    dp[y + 1][x + 1] = v;
    if (v > sq) { sq = v; at = [x - v + 1, y - v + 1]; }
  }
  const sw = Math.min(SCREEN_W, W), sh = Math.min(SCREEN_H, H);
  const steps = (n, s) => [...new Set([...Array.from({ length: Math.max(1, n - s + 1) }, (_, i) => i).filter((i) => i % 4 === 0), n - s])];
  let screen = 0, win = null;
  for (const y0 of steps(H, sh)) for (const x0 of steps(W, sw)) {
    let p = 0;
    for (let y = y0; y < y0 + sh; y++) for (let x = x0; x < x0 + sw; x++) p += bare(x, y);
    if (p / (sw * sh) > screen) { screen = p / (sw * sh); win = [x0, y0]; }
  }
  return { sq, at, screen, win, bare };
}
