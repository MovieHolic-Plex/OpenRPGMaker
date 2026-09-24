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

/** Tall-grass clumps (builtin_tall_grass, lower, walkable) beside the forest: each a union of 2×2 blocks grown
 * from a seed two cells off the canopy, autotiled on its own. */
export function placeTallGrass({ map, bare, nearForest, group, count, random, accept }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, members = new Set(Object.values(group.variantMap));
  const seeds = [];
  for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) if (nearForest(x, y)) seeds.push([x, y]);
  const clumps = [];
  for (let tries = 0; clumps.length < count && tries < count * 40 && seeds.length; tries++) {
    const [sx, sy] = seeds[Math.floor(random() * seeds.length)];
    const blob = new Set();
    const block = (x, y) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [x + dx, y + dy]);
    const fits = (cells) => cells.every(([x, y]) => bare(x, y) && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => !members.has(map.lowerTiles[at(x + dx, y + dy)]) || blob.has(at(x + dx, y + dy)))));
    if (!fits(block(sx, sy))) continue;
    block(sx, sy).forEach(([x, y]) => blob.add(at(x, y)));
    const grow = 2 + Math.floor(random() * 3);
    for (let g = 0; g < grow * 4 && blob.size < 4 * (grow + 1) - 2; g++) {
      const cells = [...blob], i = cells[Math.floor(random() * cells.length)], x = i % W + Math.floor(random() * 3) - 1, y = Math.floor(i / W) + Math.floor(random() * 3) - 1;
      const b = block(x, y);
      if (fits(b)) b.forEach(([cx, cy]) => blob.add(at(cx, cy)));
    }
    const before = [...blob].map((i) => map.lowerTiles[i]);
    for (const i of blob) {
      const x = i % W, y = Math.floor(i / W);
      let mask = 0;
      [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([dx, dy], b) => { if (blob.has(at(x + dx, y + dy))) mask |= 1 << b; });
      map.lowerTiles[i] = group.variantMap[String(mask)];
    }
    if (!accept([...blob])) { [...blob].forEach((i, k) => { map.lowerTiles[i] = before[k]; }); continue; }
    clumps.push([...blob].map((i) => ({ x: i % W, y: Math.floor(i / W), layer: "lower", tile: map.lowerTiles[i] })));
  }
  return clumps;
}

// Three pieces, never in a line: every pattern is a small triangle.
const TRIANGLES = [[[0, 0], [2, 0], [1, 1]], [[0, 0], [1, 1], [0, 2]], [[1, 0], [0, 1], [2, 2]], [[0, 0], [2, 1], [0, 2]], [[1, 0], [0, 2], [2, 1]], [[0, 1], [2, 0], [1, 2]]];
export const WILD = [
  { name: "들꽃", tiles: [348, 348, 348], layer: "upper", weight: 40 },
  { name: "꽃덤불", tiles: [288, 348, 288], layer: "upper", weight: 25 },
  { name: "덤불", tiles: [289, 289, 348], layer: "upper", weight: 15 },
  { name: "풀포기", tiles: [243, 243, 243], layer: "lower", weight: 20 },
];
/** Wildflowers, flower bushes, bushes and grass tufts in threes on open ground, groups five cells apart. */
export function placeWildGroups({ map, bare, count, random, accept }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, groups = [], centres = [];
  const open = [];
  for (let y = 1; y < H - 3; y++) for (let x = 1; x < W - 3; x++) if (bare(x, y)) open.push([x, y]);
  const total = WILD.reduce((s, k) => s + k.weight, 0);
  for (let tries = 0; groups.length < count && tries < count * 30 && open.length; tries++) {
    const [x, y] = open[Math.floor(random() * open.length)];
    if (centres.some(([cx, cy]) => Math.max(Math.abs(cx - x), Math.abs(cy - y)) < 4)) continue;
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

// Clumps of two or three standing trees; offsets stagger the pieces so they never read as a row.
const CLUMPS = [
  [["활엽수", 0, 0], ["작은 덤불", 3, 2]],
  [["둥근 덤불", 0, 1], ["활엽수", 3, 0]],
  [["활엽수", 0, 1], ["활엽수", 3, 0], ["작은 덤불", 6, 3]],
  [["작은 덤불", 0, 1], ["둥근 덤불", 2, 0], ["작은 덤불", 5, 2]],
  [["활엽수", 0, 0], ["둥근 덤불", 3, 1]],
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
    if (e - x + 1 >= 6) spots.push({ kind: "below", x0: x, x1: e, y });
  }
  // Straight top edges: canopy runs with bare ground above them; the clump stands one row clear of the crowns.
  for (let y = 3; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const top = (xx) => isForest(xx, y) && !isForest(xx, y - 1) && bare(xx, y - 1);
    if (!top(x) || top(x - 1)) continue;
    let e = x;
    while (top(e + 1)) e++;
    if (e - x + 1 >= 6) spots.push({ kind: "above", x0: x, x1: e, y });
  }
  for (const dir of [-1, 1]) for (let x = 1; x < W - 1; x++) for (let y = 1; y < H - 1; y++) {
    const side = (yy) => isForest(x, yy) && !isForest(x + dir, yy) && bare(x + dir, yy);
    if (!side(y) || side(y - 1)) continue;
    let e = y;
    while (side(e + 1)) e++;
    if (e - y + 1 >= 6) spots.push({ kind: dir < 0 ? "west" : "east", x, y0: y, y1: e });
  }
  const placed = [];
  if (process.env.VILLAGE_FULLNESS_DEBUG) console.error("tree spots", spots.length, spots.slice(0, 6));
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
      const ok = stamps.every((st) => cellsOf(st).every((c) => bare(c.x, c.y))) && [...own].every((i) => {
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
