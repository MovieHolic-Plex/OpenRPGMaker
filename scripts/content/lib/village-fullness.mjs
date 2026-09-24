// Fullness pass for a finished (compacted) village: a plaza round the well, tall-grass clumps by the forest,
// wildflowers and bushes in threes, and small irregular tree clumps in front of long straight forest edges.
// Everything stands on bare ground (lower 240, upper -1) outside the caller's reserved cells, and every piece is
// offered to `accept` (the caller re-checks reachability) before it is kept.
export const cellsOf = (o) => Array.from({ length: o.w * o.h }, (_, k) => ({ x: o.x + k % o.w, y: o.y + Math.floor(k / o.w) }));
export const distance = (a, b) => Math.max(0, a.x - b.x - b.w + 1, b.x - a.x - a.w + 1) + Math.max(0, a.y - b.y - b.h + 1, b.y - a.y - a.h + 1);
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Benches, flower boxes and stone lanterns round the zone's centre piece (the well), each one cell apart from
 * the others, one or two cells from the well, inside the zone's anchor range. Returns the added civic items. */
export function placePlaza({ map, plan, parts, zone, center, items, free, accept }) {
  const anchorSite = zone.site, added = [];
  const others = () => plan.placements.filter((o) => o.kind === "civic-prop" && o.placeId === zone.id);
  let n = zone.items.filter((i) => i.id.startsWith(zone.id + "-plaza-")).length;
  for (const name of items) {
    const p = parts.find((q) => q.name === name);
    if (!p) throw Error("Missing plaza part " + name);
    const candidates = [];
    for (let y = center.y - 3 - p.height; y <= center.y + center.h + 3; y++) for (let x = center.x - 3 - p.width; x <= center.x + center.w + 3; x++) {
      const o = { x, y, w: p.width, h: p.height }, d = distance(o, center);
      if (d < 2 || d > 3 || distance(o, anchorSite) > zone.anchor.maxDistance) continue;
      if (!cellsOf(o).every(({ x: cx, y: cy }) => free(cx, cy))) continue;
      const gap = Math.min(...others().map((q) => distance(o, q)));
      if (gap < 2) continue;
      candidates.push({ o, score: (d === 2 ? 0 : 3) - Math.min(gap, 6) });
    }
    candidates.sort((a, b) => a.score - b.score || a.o.y - b.o.y || a.o.x - b.o.x);
    for (const { o } of candidates) {
      const upper = p.targetUpper.flat();
      const item = { id: `${zone.id}-plaza-${++n}`, name, x: o.x, y: o.y, purpose: PLAZA_PURPOSE[name] ?? "광장을 채우는 쉼터 소품", near: center.name };
      const placed = { ...item, w: p.width, h: p.height, kind: "civic-prop", placeId: zone.id, lower: "KEEP", upper };
      cellsOf(placed).forEach((c, k) => { map.upperTiles[c.y * map.width + c.x] = upper[k]; });
      const useAt = accept(placed);
      if (!useAt) { cellsOf(placed).forEach((c) => { map.upperTiles[c.y * map.width + c.x] = -1; }); n--; continue; }
      placed.useAt = useAt;
      zone.items.push(item);
      plan.placements.push(placed);
      added.push(placed);
      break;
    }
  }
  return added;
}
const PLAZA_PURPOSE = {
  "벤치": "우물가에 앉아 쉬는 자리",
  "꽃 화단": "마을 한가운데를 꾸미는 화단",
  "돌등": "밤에 우물가를 밝히는 돌등",
  "화분": "우물가를 꾸미는 화분",
  "마른 묘목": "우물가에 말라 버린 묘목",
  "통나무 더미": "쓰다 버려 둔 통나무",
  "부서진 울타리": "무너진 채 남은 우물가 울타리",
};

/** A ragged patch: grown one cell at a time from `seed`, each step taking a frontier cell weighted by how many of its
 * four sides already touch the patch (so it stays one piece) times a random factor (so the outline wanders). */
export function growBlob({ W, H, seed, size, ok, random }) {
  const at = (x, y) => y * W + x;
  if (!ok(seed[0], seed[1])) return null;
  const blob = new Set([at(seed[0], seed[1])]);
  while (blob.size < size) {
    const front = new Map();
    for (const i of blob) {
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = at(X, Y);
        if (X < 0 || Y < 0 || X >= W || Y >= H || blob.has(k) || !ok(X, Y)) continue;
        front.set(k, (front.get(k) ?? 0) + 1);
      }
    }
    if (!front.size) break;
    // Round on the whole (cells far from the seed are less likely), ragged at the rim (the random factor).
    let best = -1, pick = null;
    for (const [k, n] of [...front].sort((a, b) => a[0] - b[0])) {
      const d2 = (k % W - seed[0]) ** 2 + (Math.floor(k / W) - seed[1]) ** 2;
      const w = n * n * (0.25 + random()) / (1 + 0.12 * d2);
      if (w > best) { best = w; pick = k; }
    }
    blob.add(pick);
  }
  // No one-cell spurs: a cell touching the patch on one side only is dropped (twice, for two-cell spurs).
  for (let pass = 0; pass < 2 && blob.size > 4; pass++) for (const i of [...blob]) {
    const x = i % W, y = Math.floor(i / W);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => blob.has(at(x + dx, y + dy))).length <= 1) blob.delete(i);
  }
  return blob;
}

/** Fray a patch's outline: now and then a lone tuft (the group's single piece) just off a convex corner, touching the
 * patch only at the corner, so the silhouette is not a stack of rectangles. Returns the tuft cells. */
export function frayGrass(map, group, blob, ok, random, p = 0.3) {
  const W = map.width, at = (x, y) => y * W + x, members = new Set(Object.values(group.variantMap)), tufts = [];
  for (const i of [...blob].sort((a, b) => a - b)) {
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const X = x + dx, Y = y + dy, k = at(X, Y);
      if (blob.has(k) || !ok(X, Y) || members.has(map.lowerTiles[k])) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => members.has(map.lowerTiles[at(X + ex, Y + ey)]))) continue;
      if (random() < p) { map.lowerTiles[k] = group.variantMap["0"]; tufts.push(k); }
    }
  }
  return tufts;
}

/** Autotile every tall-grass cell in and around `cells` against its eight neighbours. */
export function retileGrass(map, group, cells) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, members = new Set(Object.values(group.variantMap));
  const around = new Set();
  for (const i of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = i % W + dx, y = Math.floor(i / W) + dy;
    if (x >= 0 && y >= 0 && x < W && y < H && members.has(map.lowerTiles[at(x, y)])) around.add(at(x, y));
  }
  for (const i of around) {
    const x = i % W, y = Math.floor(i / W);
    let mask = 0;
    [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([dx, dy], b) => {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < H && members.has(map.lowerTiles[at(X, Y)])) mask |= 1 << b;
    });
    map.lowerTiles[i] = group.variantMap[String(mask)];
  }
}

/** Tall-grass patches (builtin_tall_grass, lower, walkable) beside the forest: ragged blobs of 7–16 cells grown from
 * a seed within two cells of the canopy, one bare cell apart from any other tall grass. */
export function placeTallGrass({ map, bare, nearForest, group, count, random, accept }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, members = new Set(Object.values(group.variantMap));
  const seeds = [];
  for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) if (nearForest(x, y)) seeds.push([x, y]);
  const clumps = [];
  const apart = (x, y) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => !members.has(map.lowerTiles[at(x + dx, y + dy)])));
  for (let tries = 0; clumps.length < count && tries < count * 40 && seeds.length; tries++) {
    const seed = seeds[Math.floor(random() * seeds.length)];
    const blob = growBlob({ W, H, seed, size: 7 + Math.floor(random() * 10), ok: (x, y) => bare(x, y) && apart(x, y), random });
    if (!blob || blob.size < 5) continue;
    const before = [...blob].map((i) => map.lowerTiles[i]);
    for (const i of blob) map.lowerTiles[i] = group.variantMap["255"];
    const tufts = frayGrass(map, group, blob, bare, random);
    tufts.forEach((i) => { before.push(240); blob.add(i); });
    retileGrass(map, group, blob);
    if (!accept([...blob])) { [...blob].forEach((i, k) => { map.lowerTiles[i] = before[k]; }); continue; }
    clumps.push([...blob].map((i) => ({ x: i % W, y: Math.floor(i / W), layer: "lower", tile: map.lowerTiles[i] })));
  }
  return clumps;
}

// Three pieces, never in a line: every pattern is a tight clump (an L, or a chevron touching at the corners), so the
// three read as one group rather than as dots sprinkled apart.
const TRIANGLES = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [1, 1], [2, 0]], [[0, 1], [1, 0], [2, 1]]];
export const WILD = [
  { name: "들꽃", tiles: [348, 348, 348], layer: "upper", weight: 50 },
  { name: "꽃덤불", tiles: [288, 348, 288], layer: "upper", weight: 35 },
  { name: "덤불", tiles: [289, 289, 348], layer: "upper", weight: 15 },
];
/** Wildflowers, flower bushes and bushes in threes on open ground, groups six cells apart: a few groups, not a
 * carpet (the gap fill keeps the same distance from them). */
export function placeWildGroups({ map, bare, count, random, accept }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, groups = [], centres = [];
  const open = [];
  for (let y = 1; y < H - 3; y++) for (let x = 1; x < W - 3; x++) if (bare(x, y)) open.push([x, y]);
  const total = WILD.reduce((s, k) => s + k.weight, 0);
  for (let tries = 0; groups.length < count && tries < count * 30 && open.length; tries++) {
    const [x, y] = open[Math.floor(random() * open.length)];
    if (centres.some(([cx, cy]) => Math.max(Math.abs(cx - x), Math.abs(cy - y)) < 6)) continue;
    let r = random() * total, kind = WILD[0];
    for (const k of WILD) { if ((r -= k.weight) < 0) { kind = k; break; } }
    const shape = TRIANGLES[Math.floor(random() * TRIANGLES.length)];
    const cells = shape.map(([dx, dy], k) => ({ x: x + dx, y: y + dy, layer: kind.layer, tile: kind.tiles[k] }));
    if (!cells.every((c) => bare(c.x, c.y))) continue;
    for (const c of cells) map[c.layer + "Tiles"][at(c.x, c.y)] = c.tile;
    if (!accept(cells)) { for (const c of cells) map[c.layer + "Tiles"][at(c.x, c.y)] = c.layer === "lower" ? 240 : -1; continue; }
    groups.push({ name: kind.name, cells });
    centres.push([x, y]);
  }
  return groups;
}

/** Emptiness of a map as the fill gate measures it (/tmp/oprn-qa/emptiness.py): the side of the largest square of
 * plain cells, and the largest share of plain cells in any 17×13 screen stepped by four cells. */
export function emptiness(map, isPlain) {
  const W = map.width, H = map.height, P = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => isPlain(x, y)));
  const dp = Array.from({ length: H + 1 }, () => Array(W + 1).fill(0));
  let maxSq = 0, sqAt = [0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P[y][x]) {
    dp[y + 1][x + 1] = 1 + Math.min(dp[y][x + 1], dp[y + 1][x], dp[y][x]);
    if (dp[y + 1][x + 1] > maxSq) { maxSq = dp[y + 1][x + 1]; sqAt = [x - maxSq + 1, y - maxSq + 1]; }
  }
  const sw = Math.min(17, W), sh = Math.min(13, H);
  let screen = 0, screenAt = [0, 0];
  const ys = [...Array.from({ length: Math.ceil(Math.max(1, H - sh + 1) / 4) }, (_, k) => k * 4), H - sh];
  const xs = [...Array.from({ length: Math.ceil(Math.max(1, W - sw + 1) / 4) }, (_, k) => k * 4), W - sw];
  for (const y0 of ys) for (const x0 of xs) {
    let p = 0;
    for (let y = y0; y < y0 + sh; y++) for (let x = x0; x < x0 + sw; x++) p += P[y][x];
    if (p / (sw * sh) > screen) { screen = p / (sw * sh); screenAt = [x0, y0]; }
  }
  return { maxSq, sqAt, screen, screenAt, P };
}

/** Natural fill until the gate passes. The target is the largest plain square (or, once squares are small, the
 * emptiest screen's largest plain square). Most pieces are a ragged tall-grass patch seeded somewhere inside it
 * (sometimes with three flowers tucked against its edge); the rest are one group of three flowers, never within
 * five cells of another flower group, so the ground never turns into an even dotted carpet. Both are walkable, so
 * paths and reachability are untouched; access cells are never covered. `flowerKinds` (first = common, last = rarer)
 * may be narrowed or emptied where flowers would be out of place (snow, ash). */
export function fillPlainGaps({ map, isPlain, canTake, group, random, limits = { maxSq: 4, screen: 0.4 }, maxSteps = 400, flowerGroups = [], flowerKinds = [[348, 348, 348], [288, 348, 288]] }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x;
  const pieces = [], tried = new Set(), flowers = [...flowerGroups];
  const ok = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && isPlain(x, y) && canTake(x, y) && map.lowerTiles[at(x, y)] === 240;
  const flowerFar = (x, y) => flowers.every(([fx, fy]) => Math.max(Math.abs(fx - x), Math.abs(fy - y)) >= 6);
  const putFlowers = (x0, y0, avoid) => {
    const order = TRIANGLES.map((s, k) => [s, random() + k * 0]).sort((a, b) => a[1] - b[1]).map(([s]) => s);
    for (const shape of order) {
      const kind = random() < 0.6 ? flowerKinds[0] : flowerKinds.at(-1);
      const put = shape.map(([dx, dy], k) => [x0 + dx, y0 + dy, kind[k]]);
      if (!put.every(([x, y]) => ok(x, y) && !avoid.has(at(x, y)))) continue;
      for (const [x, y, t] of put) map.upperTiles[at(x, y)] = t;
      flowers.push([x0 + 1, y0 + 1]);
      return { name: kind[0] === 288 ? "꽃덤불" : "들꽃", cells: put.map(([x, y]) => [x, y]) };
    }
    return null;
  };
  for (let step = 0; step < maxSteps; step++) {
    const e = emptiness(map, isPlain);
    if (e.maxSq <= limits.maxSq && e.screen <= limits.screen) break;
    const square = (x0, y0, sw, sh) => {
      let best = 0, found = null;
      const dp = Array.from({ length: sh + 1 }, () => Array(sw + 1).fill(0));
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (e.P[y0 + y][x0 + x] && canTake(x0 + x, y0 + y) && !tried.has(at(x0 + x, y0 + y))) {
        dp[y + 1][x + 1] = 1 + Math.min(dp[y][x + 1], dp[y + 1][x], dp[y][x]);
        if (dp[y + 1][x + 1] > best) { best = dp[y + 1][x + 1]; found = { x: x0 + x - best + 1, y: y0 + y - best + 1, w: best, h: best }; }
      }
      return found;
    };
    let box = e.maxSq > limits.maxSq ? square(0, 0, W, H) : null;
    if (!box || box.w <= limits.maxSq) box = e.screen > limits.screen ? square(e.screenAt[0], e.screenAt[1], Math.min(17, W), Math.min(13, H)) : box;
    if (!box) break;
    // A seed anywhere in the box, not always its centre, so pieces do not fall on a grid.
    const sx = box.x + Math.floor(random() * box.w), sy = box.y + Math.floor(random() * box.h);
    let placed = 0;
    if (random() < 0.78 || !flowerFar(sx, sy) || !flowerKinds.length) {
      const blob = growBlob({ W, H, seed: [sx, sy], size: 7 + Math.floor(random() * 10), ok, random });
      if (blob && blob.size >= 4) {
        for (const i of blob) map.lowerTiles[i] = group.variantMap["255"];
        for (const i of frayGrass(map, group, blob, ok, random)) blob.add(i);
        retileGrass(map, group, blob);
        const piece = { name: "키큰 풀", cells: [...blob].map((i) => [i % W, Math.floor(i / W)]) };
        pieces.push(piece);
        placed = blob.size;
        // Three flowers against the patch's edge now and then.
        if (random() < 0.35 && flowerKinds.length) {
          const edge = [];
          for (const i of blob) for (const [dx, dy] of [[2, 0], [-3, 0], [0, 2], [0, -3], [2, 2], [-3, -3]]) {
            const x = i % W + dx, y = Math.floor(i / W) + dy;
            if (flowerFar(x + 1, y + 1)) edge.push([x, y]);
          }
          if (edge.length) {
            const [fx, fy] = edge[Math.floor(random() * edge.length)];
            const f = putFlowers(fx, fy, blob);
            if (f) { pieces.push(f); placed += 3; }
          }
        }
      }
    } else {
      const f = putFlowers(sx - 1, sy - 1, new Set());
      if (f) { pieces.push(f); placed = 3; }
    }
    if (!placed) tried.add(at(sx, sy));
    if (!placed && [...Array(box.w * box.h).keys()].every((k) => tried.has(at(box.x + k % box.w, box.y + Math.floor(k / box.w))) || !ok(box.x + k % box.w, box.y + Math.floor(k / box.w))))
      for (let dy = 0; dy < box.h; dy++) for (let dx = 0; dx < box.w; dx++) tried.add(at(box.x + dx, box.y + dy));
  }
  return { pieces, ...emptiness(map, isPlain) };
}

// Clumps of two or three standing trees; offsets stagger the pieces so they never read as a row.
const CLUMPS = [
  [["활엽수", 0, 0], ["작은 덤불", 3, 2]],
  [["둥근 덤불", 0, 1], ["활엽수", 3, 0]],
  [["활엽수", 0, 1], ["활엽수", 3, 0], ["작은 덤불", 6, 3]],
  [["작은 덤불", 0, 1], ["둥근 덤불", 2, 0], ["작은 덤불", 5, 2]],
  [["활엽수", 0, 0], ["둥근 덤불", 3, 1]],
  [["둥근 덤불", 0, 0], ["작은 덤불", 3, 1]],
  [["작은 덤불", 0, 0], ["작은 덤불", 2, 1], ["작은 덤불", 1, 3]],
  [["작은 덤불", 0, 1], ["둥근 덤불", 2, 0]],
];
/** Tree clumps one cell in front of a straight forest edge (a root row of six or more cells, or a canopy side
 * six or more rows tall). Each piece is a whole retained-vegetation stamp; the clump keeps a one-cell ring of
 * bare ground from the forest, roads and other objects. */
export function placeTreeClumps({ map, bare, isForest, rootRow, templates, count, random, accept }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, spots = [];
  // Straight bottom edges: runs of root cells; straight sides: runs of canopy cells with open ground beside them.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!rootRow(x, y) || rootRow(x - 1, y)) continue;
    let e = x;
    while (rootRow(e + 1, y)) e++;
    if (e - x + 1 >= 5) spots.push({ kind: "below", x0: x, x1: e, y });
  }
  // Straight top edges: canopy runs with bare ground above them; the clump stands one row clear of the crowns.
  for (let y = 3; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const top = (xx) => isForest(xx, y) && !isForest(xx, y - 1) && bare(xx, y - 1);
    if (!top(x) || top(x - 1)) continue;
    let e = x;
    while (top(e + 1)) e++;
    if (e - x + 1 >= 5) spots.push({ kind: "above", x0: x, x1: e, y });
  }
  for (const dir of [-1, 1]) for (let x = 1; x < W - 1; x++) for (let y = 1; y < H - 1; y++) {
    const side = (yy) => isForest(x, yy) && !isForest(x + dir, yy) && bare(x + dir, yy);
    if (!side(y) || side(y - 1)) continue;
    let e = y;
    while (side(e + 1)) e++;
    if (e - y + 1 >= 5) spots.push({ kind: dir < 0 ? "west" : "east", x, y0: y, y1: e });
  }
  const placed = [];
  const order = spots.map((s) => [random(), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  const shuffle = (a) => a.map((v) => [random(), v]).sort((p, q) => p[0] - q[0]).map(([, v]) => v);
  for (const s of order) {
    if (placed.length >= count) break;
    const tries = [];
    for (const combo of CLUMPS) for (const mirror of [false, true]) {
      const pieces = combo.map(([name, dx, dy]) => ({ t: templates[name], dx, dy }));
      const w = Math.max(...pieces.map((p) => p.dx + p.t.w)), h = Math.max(...pieces.map((p) => p.dy + p.t.h));
      // In front of a bottom edge the clump may run a little past the edge's ends; beside a side it may start above.
      if (s.kind === "below") for (let x = s.x0 - 2; x + w - 1 <= s.x1 + 2; x++) tries.push({ pieces, w, mirror, o: [x, s.y + 2] });
      else if (s.kind === "above") for (let x = s.x0 - 2; x + w - 1 <= s.x1 + 2; x++) tries.push({ pieces, w, mirror, o: [x, s.y - 1 - h] });
      else for (let y = s.y0 - 2; y + h - 1 <= s.y1 + 2; y++) tries.push({ pieces, w, mirror, o: [s.kind === "west" ? s.x - 1 - w : s.x + 2, y] });
    }
    for (const { pieces, w, mirror, o } of shuffle(tries).slice(0, 60)) {
      const stamps = pieces.map((p) => ({ ...p.t, x: o[0] + (mirror ? w - p.dx - p.t.w : p.dx), y: o[1] + p.dy }));
      const own = new Set(stamps.flatMap((st) => cellsOf(st).map((c) => at(c.x, c.y))));
      // A standing tree (crown on the upper layer) keeps a one-cell ring of bare ground so its crown never merges
      // with the forest canopy; a bush (lower layer only) may stand right beside it.
      const crowned = new Set(stamps.filter((st) => st.upper.some((t) => t >= 0)).flatMap((st) => cellsOf(st).map((c) => at(c.x, c.y))));
      const ok = stamps.every((st) => cellsOf(st).every((c) => bare(c.x, c.y))) && [...crowned].every((i) => {
        const x = i % W, y = Math.floor(i / W);
        return [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => own.has(at(x + dx, y + dy)) || bare(x + dx, y + dy)));
      });
      if (!ok || placed.some((q) => q.some((st) => stamps.some((a) => distance(a, st) < 4)))) continue;
      const saved = [...own].map((i) => [i, map.lowerTiles[i], map.upperTiles[i]]);
      for (const st of stamps) cellsOf(st).forEach((c, k) => { map.lowerTiles[at(c.x, c.y)] = st.lower[k]; map.upperTiles[at(c.x, c.y)] = st.upper[k]; });
      if (!accept(stamps)) { for (const [i, l, u] of saved) { map.lowerTiles[i] = l; map.upperTiles[i] = u; } continue; }
      placed.push(stamps);
      break;
    }
  }
  return placed;
}

// Natural fill without tall grass (the old 243–335 grass is banned until the E/F/G redraw lands). Each piece is a
// small scene, never a lone dot: a tree with a bush at its foot, a thicket of bushes, a flowering shrub (a bush with
// three to five flowers tucked round it), or rocks with a bush beside them. Pieces are whole stamps of the retained
// vegetation (3×4 broadleaf, 3×3 round bush, 2×2 small bush) and single-cell bush 289 / flowers 348·288 / rocks.
// Big masses first (few pieces, each a real grove or thicket), so the ground never reads as an even sprinkle.
const SCENES = [
  { name: "나무 덩이", weight: 30, parts: [["활엽수", 0, 0], ["활엽수", 3, 1], ["작은 덤불", 6, 3], ["둥근 덤불", 0, 4]], tree: true },
  { name: "나무 두 그루", weight: 22, parts: [["활엽수", 0, 1], ["활엽수", 3, 0], ["작은 덤불", 1, 5]], tree: true },
  { name: "나무와 덤불", weight: 18, parts: [["활엽수", 0, 0], ["둥근 덤불", 3, 1], ["작은 덤불", 2, 4]], tree: true },
  { name: "덤불숲", weight: 18, parts: [["둥근 덤불", 0, 0], ["둥근 덤불", 3, 1], ["작은 덤불", 1, 3]] },
  { name: "꽃 핀 덤불숲", weight: 14, parts: [["둥근 덤불", 0, 0], ["작은 덤불", 3, 1]], flowers: [4, 5] },
  { name: "작은 덤불숲", weight: 8, parts: [["작은 덤불", 0, 0], ["작은 덤불", 2, 1], ["덤불", 0, 2]] },
  { name: "바위와 덤불", weight: 4, parts: [["바위", 0, 0], ["작은 덤불", 1, 0], ["바위", 0, 1]], rocks: true },
  // Tall grass E/F/G (PR #1421): one ragged patch of 10–20 cells, only when the caller passes `grass` (the patch is
  // laid by lib/tall-grass.mjs arrangeTallGrass — whole 2×2 blocks, corners trimmed, one kind per patch).
  { name: "풀숲", weight: 26, parts: [], grass: true },
  // Narrow ground (between a road and a house) only takes smaller pieces: a round bush with flowers at its foot, two
  // small bushes, or a bed of four or five wildflowers — still one clump each.
  { name: "꽃 핀 둥근 덤불", weight: 10, tier: 2, parts: [["둥근 덤불", 0, 0]], flowers: [3, 5] },
  // Smaller pieces make an even sprinkle (review 2026-09-24): available, but only when a caller asks for them.
  { name: "덤불 한 쌍", weight: 8, tier: 3, small: true, parts: [["작은 덤불", 0, 0], ["덤불", 2, 1]], flowers: [3, 4] },
  { name: "들꽃 무리", weight: 6, tier: 3, small: true, parts: [], flowers: [4, 5] },
];
const SINGLE = { "덤불": { name: "덤불", w: 1, h: 1, lower: null, upper: [289] }, "바위": { name: "바위", w: 1, h: 1, lower: null, upper: [537] } };
export const NATURAL_SCENES = SCENES;
/**
 * Fill plain ground until the gate passes with the scenes above. `take(x, y, solid)` says whether a cell may take a
 * piece (solid pieces need more room: the caller keeps them off roads, doors and access rings); `accept(cells)` is
 * the caller's reachability check (a scene is rolled back if it seals ground). `allow` filters scenes (a climate
 * without broadleaf trees or flowers narrows it). Returns { pieces, maxSq, screen }.
 */
export function fillNaturalGaps({ map, isPlain, take, templates, random, accept, allow = () => true, limits = { maxSq: 4, screen: 0.4 }, maxSteps = 600, flowerTiles = [348, 288], singles = SINGLE, small = false, grass = null }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, pieces = [], tried = new Set();
  const scenes = SCENES.filter((s) => allow(s) && (!s.small || small) && (!s.flowers || flowerTiles.length) && (!s.grass || grass));
  // grass = { members: Set of tall-grass tiles, arrange(map) }: a patch is grown, cut to whole 2×2 blocks, and the whole
  // map's tall grass re-laid by `arrange` (idempotent). Patches stay one cell apart from each other.
  const grassPatch = (sx, sy) => {
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && isPlain(x, y) && take(x, y, false)
      && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => !grass.members.has(map.lowerTiles[at(x + dx, y + dy)])));
    const blob = growBlob({ W, H, seed: [sx, sy], size: 10 + Math.floor(random() * 11), ok: free, random });
    if (!blob) return null;
    const inBlock = (i) => { const x = i % W, y = Math.floor(i / W); return [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => [[0, 0], [1, 0], [0, 1], [1, 1]].every(([ex, ey]) => blob.has(at(x + dx + ex, y + dy + ey)))); };
    for (let again = true; again;) { again = false; for (const i of [...blob]) if (!inBlock(i)) { blob.delete(i); again = true; } }
    if (blob.size < 8) return null;
    const saved = map.lowerTiles.slice();
    for (const i of blob) map.lowerTiles[i] = 304;
    grass.arrange(map);
    const laid = [...blob].filter((i) => grass.members.has(map.lowerTiles[i]));
    if (laid.length < 8 || !accept(laid.map((i) => ({ x: i % W, y: Math.floor(i / W) })))) { map.lowerTiles = saved; return null; }
    return { name: "풀숲", stamps: [], flowers: [], grass: laid.map((i) => [i % W, Math.floor(i / W)]) };
  };
  const pieceOf = (name) => singles[name] ?? templates[name];
  for (let step = 0; step < maxSteps && scenes.length; step++) {
    const e = emptiness(map, isPlain);
    if (e.maxSq <= limits.maxSq && e.screen <= limits.screen) break;
    const square = (x0, y0, sw, sh) => {
      let best = 0, found = null;
      const dp = Array.from({ length: sh + 1 }, () => Array(sw + 1).fill(0));
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (e.P[y0 + y][x0 + x] && take(x0 + x, y0 + y, false) && !tried.has(at(x0 + x, y0 + y))) {
        dp[y + 1][x + 1] = 1 + Math.min(dp[y][x + 1], dp[y + 1][x], dp[y][x]);
        if (dp[y + 1][x + 1] > best) { best = dp[y + 1][x + 1]; found = { x: x0 + x - best + 1, y: y0 + y - best + 1, w: best, h: best }; }
      }
      return found;
    };
    let box = e.maxSq > limits.maxSq ? square(0, 0, W, H) : null;
    if (!box || box.w <= limits.maxSq) box = e.screen > limits.screen ? square(e.screenAt[0], e.screenAt[1], Math.min(17, W), Math.min(13, H)) : box;
    if (!box) break;
    const sx = box.x + Math.floor(random() * box.w), sy = box.y + Math.floor(random() * box.h);
    // Scenes in a weighted shuffle, each anchored so it covers the seed cell.
    // Bigger tiers first: a small piece only goes where no grove or thicket fits.
    const order = scenes.map((s) => [(s.tier ?? 1) * 100 - Math.log(random() + 1e-9) / s.weight, s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s);
    let placed = null;
    for (const scene of order) {
      if (scene.grass) { placed = grassPatch(sx, sy); if (placed) break; continue; }
      for (let attempt = 0; attempt < 4 && !placed; attempt++) {
        const mirror = random() < 0.5;
        const parts = scene.parts.map(([name, dx, dy]) => ({ t: pieceOf(name), dx, dy }));
        const w = Math.max(1, ...parts.map((p) => p.dx + p.t.w)), h = Math.max(1, ...parts.map((p) => p.dy + p.t.h));
        const ox = sx - Math.floor(random() * w), oy = sy - Math.floor(random() * h);
        const stamps = parts.map((p) => ({ ...p.t, x: ox + (mirror ? w - p.dx - p.t.w : p.dx), y: oy + p.dy }));
        const cells = stamps.flatMap((st) => cellsOf(st).map((c, k) => ({ ...c, lower: st.lower?.[k] ?? null, upper: st.upper[k] })));
        if (!cells.every((c) => c.x >= 1 && c.y >= 1 && c.x < W - 1 && c.y < H - 1 && isPlain(c.x, c.y) && take(c.x, c.y, true))) continue;
        // Flowers hug the scene: a tight run of free cells round it (never a scatter).
        const flowers = [];
        if (scene.flowers) {
          const own = new Set(cells.map((c) => at(c.x, c.y)));
          const [lo, hi] = scene.flowers, want = lo + Math.floor(random() * (hi - lo + 1));
          const ring = parts.length ? [] : [at(sx, sy)].filter((k) => isPlain(sx, sy) && take(sx, sy, false));
          const around = parts.length ? cells : [{ x: sx, y: sy }, { x: sx + 1, y: sy }, { x: sx, y: sy + 1 }, { x: sx - 1, y: sy }, { x: sx, y: sy - 1 }];
          for (const c of around) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const x = c.x + dx, y = c.y + dy, k = at(x, y);
            if (!own.has(k) && !ring.includes(k) && x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && isPlain(x, y) && take(x, y, false)) ring.push(k);
          }
          if (ring.length >= lo) {
            const run = [parts.length ? ring[Math.floor(random() * ring.length)] : ring[0]];
            while (run.length < want) {
              const next = ring.find((k) => !run.includes(k) && run.some((r) => Math.abs(r % W - k % W) <= 1 && Math.abs(Math.floor(r / W) - Math.floor(k / W)) <= 1));
              if (next === undefined) break;
              run.push(next);
            }
            const shift = random() < 0.5 ? 0 : 1;
            if (run.length >= lo) run.forEach((k, n) => flowers.push({ x: k % W, y: Math.floor(k / W), upper: flowerTiles[(n + shift) % flowerTiles.length] }));
          }
          if (flowers.length < lo) continue;
        }
        const saved = [...cells, ...flowers].map((c) => [at(c.x, c.y), map.lowerTiles[at(c.x, c.y)], map.upperTiles[at(c.x, c.y)]]);
        for (const c of cells) { if (c.lower != null) map.lowerTiles[at(c.x, c.y)] = c.lower; map.upperTiles[at(c.x, c.y)] = c.upper; }
        for (const f of flowers) map.upperTiles[at(f.x, f.y)] = f.upper;
        if (!accept([...cells, ...flowers])) { for (const [i, l, u] of saved) { map.lowerTiles[i] = l; map.upperTiles[i] = u; } continue; }
        placed = { name: scene.name, stamps: stamps.map(({ name, x, y, w, h, lower, upper }) => ({ name, x, y, w, h, lower, upper })), flowers: flowers.map((f) => [f.x, f.y, f.upper]) };
      }
      if (placed) break;
    }
    if (placed) pieces.push(placed);
    else tried.add(at(sx, sy));
  }
  return { pieces, ...emptiness(map, isPlain) };
}

/**
 * Prepared for the E/F/G tall-grass redraw (not called until it lands; the old 243–335 art stays banned). A patch is
 * a union of 2×2 blocks (never a one-cell strip) with its convex corners trimmed, and one family for the whole patch:
 * E (dense) when it touches the forest canopy, G (short) within two cells of a house or road, F (bright) otherwise.
 * `families[kind].variantMap` picks each cell's piece from its eight neighbours (never a random piece).
 */
export function placeGrassPatch({ map, seed, blocks, ok, families, touchesCanopy, nearHouseOrRoad, random }) {
  const W = map.width, at = (x, y) => y * W + x, cells = new Set();
  let [bx, by] = seed;
  for (let n = 0; n < blocks; n++) {
    const block = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [bx + dx, by + dy]);
    if (block.every(([x, y]) => ok(x, y))) block.forEach(([x, y]) => cells.add(at(x, y)));
    [bx, by] = [bx + Math.floor(random() * 3) - 1, by + Math.floor(random() * 3) - 1];
  }
  // Trim convex corners (a cell open on two perpendicular sides), keeping every 2×2 core.
  for (const i of [...cells]) {
    const x = i % W, y = Math.floor(i / W), has = (dx, dy) => cells.has(at(x + dx, y + dy));
    if ((!has(-1, 0) || !has(1, 0)) && (!has(0, -1) || !has(0, 1)) && cells.size > 6 && random() < 0.6) cells.delete(i);
  }
  if (cells.size < 4) return null;
  const list = [...cells];
  const kind = list.some((i) => touchesCanopy(i % W, Math.floor(i / W))) ? "E" : list.some((i) => nearHouseOrRoad(i % W, Math.floor(i / W))) ? "G" : "F";
  const vm = families[kind].variantMap;
  for (const i of list) {
    const x = i % W, y = Math.floor(i / W);
    let mask = 0;
    [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([dx, dy], b) => { if (cells.has(at(x + dx, y + dy))) mask |= 1 << b; });
    map.lowerTiles[i] = vm[String(mask)];
  }
  return { kind, cells: list.map((i) => [i % W, Math.floor(i / W)]) };
}
