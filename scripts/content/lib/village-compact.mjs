// Compact a finished village by removing empty grass/forest bands (object-aware seam carving).
// A seam is one cell per row (vertical) or per column (horizontal), stepping at most one cell between rows, and
// only diagonally through soft cells (grass, canopy, road, wide water). Houses, landmarks, props, access cells,
// stairs, falls, bridges and grass crests are never cut, and a seam only crosses them where they are unaffected:
// a cliff column that is identical to its neighbour (vertical seams only), a road with road on both sides, water
// with water two cells out on both sides (so a 4-wide river keeps its width). Removing a walkable cell between two
// blocked cells would close a corridor, removing a blocked cell between two walkable ones would open a wall: both
// are forbidden. Cells within two of a house cost more, so yards keep their room.
// The caller re-autotiles roads/water/canopy and refits trunks afterwards; `place(x, y)` maps an original cell to
// the compacted map (a removed cell maps to where its nearest surviving neighbour went).
const INF = 1e9;

export function compactVillage(map, { hard, cliff, near, soft: classOf, walk, target, strict = true, check = null, retries = 16 }) {
  const W0 = map.width, H0 = map.height;
  let G = Array.from({ length: H0 }, (_, y) => Array.from({ length: W0 }, (_, x) => {
    const i = y * W0 + x;
    return { i, l: map.lowerTiles[i], u: map.upperTiles[i], hard: hard.has(i), cliff: cliff.has(i), near: near.has(i), k: classOf(i), walk: walk(i) };
  }));
  const T = (A) => A[0].map((_, x) => A.map((row) => row[x]));
  const same = (a, b) => a && b && a.l === b.l && a.u === b.u && !b.hard;
  // One vertical seam over grid A (rows). `vertical` says whether A is the map itself (false = transposed).
  function seam(A, vertical) {
    const H = A.length, W = A[0].length;
    const cost = (x, y) => {
      if (x < 2 || x > W - 3) return [INF, false];
      const b = A[y][x], a = A[y][x - 1], c = A[y][x + 1];
      if (b.hard || b[vertical ? "blockV" : "blockH"]) return [INF, false];
      if (b.cliff) return vertical && same(b, c) && c.cliff ? [6, false] : [INF, false];
      const extra = b.near ? 4 : 0;
      if (b.k === "grass") return strict && !a.walk && !c.walk ? [INF, false] : [1 + extra, true];
      if (b.k === "canopy") return strict && a.walk && c.walk ? [INF, false] : [3 + extra, true];
      if (b.k === "road") return a.k === "road" && c.k === "road" ? [2 + extra, true] : [INF, false];
      if (b.k === "water") return [-2, -1, 1, 2].every((d) => A[y][x + d]?.k === "water") ? [4, true] : [INF, false];
      return same(b, c) ? [6 + extra, false] : [INF, false];
    };
    const C = A.map((row, y) => row.map((_, x) => cost(x, y)));
    const D = A.map((row) => row.map(() => INF)), P = A.map((row) => row.map(() => 0));
    for (let x = 0; x < W; x++) D[0][x] = C[0][x][0];
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const [c, softHere] = C[y][x];
      if (c >= INF) continue;
      let best = INF, bp = x;
      for (const dx of [0, -1, 1]) {
        const px = x + dx;
        if (px < 0 || px >= W || D[y - 1][px] >= INF) continue;
        if (dx && !(softHere && C[y - 1][px][1])) continue;
        if (D[y - 1][px] < best) { best = D[y - 1][px]; bp = px; }
      }
      if (best < INF) { D[y][x] = best + c; P[y][x] = bp; }
    }
    let x = 0;
    for (let k = 1; k < W; k++) if (D[H - 1][k] < D[H - 1][x]) x = k;
    if (D[H - 1][x] >= INF) return null;
    const s = Array(H);
    for (let y = H - 1; y >= 0; y--) { s[y] = x; x = P[y][x]; }
    return { path: s, cost: D[H - 1][s[H - 1]] };
  }
  const removed = { columns: 0, rows: 0, rejected: 0 };
  // One seam along an axis. With `check`, the seam is kept only if the smaller map still passes it; otherwise it is
  // put back and its cells are closed to later seams on that axis (up to `retries` times per step).
  const snapshot = (A) => {
    const where = new Map();
    A.forEach((row, y) => row.forEach((c, x) => where.set(c.i, { x, y })));
    return { map: { ...map, width: A[0].length, height: A.length, lowerTiles: A.flat().map((c) => c.l), upperTiles: A.flat().map((c) => c.u) }, at: (i) => where.get(i) };
  };
  const step = (vertical) => {
    for (let r = 0; r <= retries; r++) {
      const A = vertical ? G : T(G), s = seam(A, vertical);
      if (!s) return false;
      const cut = s.path.map((x, y) => A[y][x]);
      s.path.forEach((x, y) => A[y].splice(x, 1));
      const next = vertical ? A : T(A);
      if (!check || check(snapshot(next))) { G = next; return true; }
      s.path.forEach((x, y) => A[y].splice(x, 0, cut[y]));
      for (const c of cut) c[vertical ? "blockV" : "blockH"] = true;
      removed.rejected++;
    }
    return false;
  };
  for (;;) {
    let did = false;
    if (G[0].length > target.w && step(true)) { removed.columns++; did = true; }
    if (G.length > target.h && step(false)) { removed.rows++; did = true; }
    if (!did) break;
  }
  const H = G.length, W = G[0].length, where = new Map();
  G.forEach((row, y) => row.forEach((c, x) => where.set(c.i, { x, y })));
  const place = (x0, y0) => {
    for (let r = 0; r < Math.max(W0, H0); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= W0 || y >= H0) continue;
      const p = where.get(y * W0 + x);
      if (p) return { x: Math.max(0, Math.min(W - 1, p.x - dx)), y: Math.max(0, Math.min(H - 1, p.y - dy)) };
    }
    throw Error("empty map");
  };
  const out = { ...map, width: W, height: H, lowerTiles: G.flat().map((c) => c.l), upperTiles: G.flat().map((c) => c.u) };
  return { map: out, place, survives: (i) => where.has(i), at: (i) => where.get(i), removed, before: { width: W0, height: H0 } };
}

/** Re-autotile every cell of an autotile group on one layer from the joined set. Off the map a cell keeps the
 * edge bits its tile already had (a river leaving the map keeps flowing, a road's edge stays an edge). */
export function reautotile(map, group, layer, joinedTiles) {
  const W = map.width, H = map.height, A = map[layer + "Tiles"], members = new Set(Object.values(group.variantMap));
  const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  const maskOf = new Map();
  for (const [k, t] of Object.entries(group.variantMap)) if (!maskOf.has(t)) maskOf.set(t, Number(k));
  const next = [...A];
  let changed = 0;
  for (let i = 0; i < W * H; i++) {
    if (!members.has(A[i])) continue;
    const x = i % W, y = Math.floor(i / W), old = maskOf.get(A[i]) ?? 0;
    const inMap = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H;
    let mask = 0;
    // Edges N,E,S,W: a neighbour on the map joins by tile; off the map the old tile's edge bit is kept.
    for (let b = 0; b < 4; b++) {
      const X = x + N8[b][0], Y = y + N8[b][1];
      if (inMap(X, Y) ? joinedTiles.has(A[Y * W + X]) : old & (1 << b)) mask |= 1 << b;
    }
    // Corners NE,SE,SW,NW (bits 4..7) between edges (N,E),(E,S),(S,W),(W,N); off the map a corner joins when both edges do.
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([e1, e2], k) => {
      const b = 4 + k, X = x + N8[b][0], Y = y + N8[b][1], edges = (mask & (1 << e1)) && (mask & (1 << e2));
      if (inMap(X, Y) ? joinedTiles.has(A[Y * W + X]) : edges) mask |= 1 << b;
    });
    const t = group.variantMap[String(mask)];
    if (t !== undefined && t !== A[i]) { next[i] = t; changed++; }
  }
  map[layer + "Tiles"] = next;
  return changed;
}
