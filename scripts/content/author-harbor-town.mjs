// A large harbor town (80×64, the scale of 비취 대계곡) for the diverse forest villages, built with the same whole parts and
// rules as scripts/content/author-diverse-villages.mjs: houses are the eight authored house templates copied whole,
// the church and graveyard are the landmark stamps, cliffs/stairs/waterfall/bridges/farms/roads/forest are painted by
// the same grammar, and household/civic props come from the same programs. Four districts:
//   - temple quarter on the north-west terrace (church, graveyard, herbalist),
//   - farm quarter on the north-east terrace (houses with vegetable plots and a field),
//   - market square in the lower west (well, stalls, notice board) with the woodworker and store,
//   - harbor in the lower south-east (fishing house, warehouse, boatwright, a pier into the bay).
// A river from the north forest crosses the terrace, falls over the cliff and runs into the bay; two bridges and two
// stairs make one walking loop (lower west → west stairs → terrace → north bridge → east terrace → east stairs →
// harbor → south bridge → market).
// Usage: node scripts/content/author-harbor-town.mjs <revision-13 catalog.json> <out.json>
//   The input only lends its tileset and house templates; the output is { plans:[plan], maps:{ id: map } }, merged
//   into the fill input by fill-diverse-villages.mjs --add=<out.json>.
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { placeCivicProps } from "./lib/village-civic-props.mjs";
import { placeHouseholdProps, PROP_PROGRAMS } from "./lib/village-household-props.mjs";
import { paintVillageCliffs } from "./lib/village-cliffs.mjs";
import { farmlandTiles } from "./lib/village-farmland.mjs";
import { stairTile, isStairTile } from "./lib/cliff-stairs.mjs";

const [input, out] = process.argv.slice(2);
if (!input || !out) throw Error("Usage: author-harbor-town.mjs <catalog.json> <out.json>");
const catalog = JSON.parse(fs.readFileSync(input, "utf8"));
const ts = catalog.tileset, cliff = catalog.cliffBindings, riverTiles = catalog.riverTiles;
const parts = JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json")).props;
const extraParts = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json"));
parts.push(...extraParts.props);
for (const name of extraParts.oversized.names) parts.splice(parts.findIndex((p) => p.name === name), 1);
const landmarkDefs = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/landmarks.json"));
// House templates: the first lived-in copy of each authored template, whole (both layers).
const templates = {};
for (const p of catalog.plans) for (const h of p.houses) {
  if (templates[h.template] || h.abandoned) continue;
  const m = catalog.maps[p.id], cells = Array.from({ length: h.w * h.h }, (_, k) => (h.y + Math.floor(k / h.w)) * m.width + h.x + k % h.w);
  templates[h.template] = { w: h.w, h: h.h, label: h.label, window: h.window, lower: cells.map((i) => m.lowerTiles[i]), upper: cells.map((i) => m.upperTiles[i]),
    doorAt: { x: h.doorAt.x - h.x, y: h.doorAt.y - h.y }, front: { x: h.front.x - h.x, y: h.front.y - h.y } };
}
let forest, reach;
await withTsModule("src/editor/tools/village/forestContour.ts", "harbor-forest.mjs", (m) => { forest = m; });
await withTsModule("src/project/lint/reachability.ts", "harbor-reach.mjs", (m) => { reach = m; });

const spec = {
  id: "nuleolmok-harbor-town", series: "concept", name: "너울목 항구 마을", width: 80, height: 64, seed: 1049, start: { x: 2, y: 39 },
  note: "북쪽 숲에서 나온 강이 윗단을 가로질러 절벽을 폭포로 넘고 남동쪽 물굽이로 흘러든다. 윗단 서쪽은 교회와 묘지가 있는 신전 구역, 윗단 동쪽은 밭을 끼고 사는 농가 구역, 아랫단 서쪽은 우물과 좌판이 있는 장터, 아랫단 남동쪽은 긴 부두와 배가 있는 항구다. 두 다리와 두 계단이 한 바퀴 도는 길을 만든다",
  entrance: { x: 0, y: 39 },
  // Houses [x, y, template]: temple quarter, farm quarter, market, west homes, harbor.
  houses: [[29, 7, 3], [45, 5, 1], [63, 5, 4], [5, 30, 0], [15, 31, 7], [4, 47, 5], [15, 47, 2], [27, 48, 3], [48, 41, 6], [57, 29, 0], [63, 40, 7]],
  landmarks: [["church", 8, 7], ["graveyard", 17, 6]],
  cliffs: [{ points: [[4, 22], [16, 22], [18, 21], [32, 21], [34, 22], [48, 22], [50, 21], [62, 21], [64, 22], [75, 22]], height: 5 }],
  stairs: [[24, 21, 5], [56, 21, 5]],
  river: { width: 4, points: [[41, 0], [41, 34], [41, 40], [44, 46], [44, 56]], pools: [[41, 29, 4.5, 2.5]] },
  bridges: [[39, 11, 4], [39, 37, 4]],
  // Sea in the south-east bay: the shore bends with the coordinates, never a straight line.
  coast: (x, y) => (x >= 36 && y > 51 + 2 * Math.sin(x / 6) + (x < 46 ? 46 - x : 0) / 2) || (y >= 30 && x > 73 + 2 * Math.sin(y / 5)),
  dock: [55, 52, 2, 8],
  farms: [[53, 6, 6, 4]],
  spine: [[3, 39], [14, 40], [26, 41], [35, 40], [45, 39], [54, 49], [62, 38], [56, 28], [56, 16], [47, 13], [34, 13], [26, 16], [25, 28], [26, 41]],
  patches: [[76, 10, 8, 16, 10], [70, 60, 10, 6, 8], [2, 12, 5, 10, 8], [36, 2, 10, 4, 8]],
  clearings: [[20, 36, 14, 8, 14], [52, 40, 12, 8, 12], [22, 12, 14, 7, 10], [56, 12, 14, 6, 10], [16, 52, 16, 6, 10]],
  ponds: [],
  crest: null,
};
const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const roadGroup = group("forest_harmony_road_47"), waterGroup = group("forest_harmony_lake_47");
const W = spec.width, H = spec.height, area = { x: 0, y: 0, w: W, h: H };
const m = { id: spec.id, name: spec.name, width: W, height: H, tileSize: 16, tilesetId: ts.id, lowerTiles: Array(W * H).fill(240), upperTiles: Array(W * H).fill(-1), events: [] };
if (process.env.VILLAGE_DUMP) process.on("exit", () => fs.writeFileSync(process.env.VILLAGE_DUMP, JSON.stringify({ tileset: ts, plans: [], maps: { [m.id]: m } })));
const point = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const reserved = new Set(), roads = new Set(), water = new Set(), houses = [], placements = [], access = [];
const reserve = (x, y, w, h, pad = 0) => { for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inside(xx, yy)) reserved.add(point(xx, yy)); };
const cliffPlan = paintVillageCliffs(m, spec.cliffs, cliff);
// Cliff ends die into forest (wings), so the terrace is reachable by its stairs alone.
const wings = new Set();
for (const c of spec.cliffs) for (const side of ["left", "right"]) {
  const [ex, ey] = side === "left" ? c.points[0] : c.points.at(-1), reach0 = c[side + "Reach"] ?? 4;
  for (let y = Math.max(0, c[side + "From"] ?? ey - 3); y <= Math.min(H - 1, ey + c.height + 1); y++) for (let d = 1; d <= reach0; d++) {
    const x = side === "left" ? ex - d : ex + d;
    if (inside(x, y) && cliffPlan.cells[point(x, y)] !== "cliff") wings.add(point(x, y));
  }
}
for (const [x, y, height] of spec.stairs) {
  for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) {
    const i = point(xx, yy);
    assert(cliffPlan.cliff.has(i), "Stair must span the whole face");
    m.lowerTiles[i] = stairTile(xx, x);
    m.upperTiles[i] = -1;
  }
  reserve(x, y - 1, 2, height + 3, 1);
  access.push({ role: "stairs-top", x, y: y - 1 }, { role: "stairs-bottom", x, y: y + height + 1 });
}
const fallCells = new Set(), falls = [], river = new Set();
{
  const { points, width } = spec.river;
  for (let n = 0; n < points.length - 1; n++) {
    const [x0, y0] = points[n], [x1, y1] = points[n + 1], steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4;
    for (let k = 0; k <= steps; k++) {
      const cx = x0 + (x1 - x0) * k / steps, cy = Math.round(y0 + (y1 - y0) * k / steps), left = Math.round(cx - width / 2);
      for (let d = 0; d < width; d++) if (inside(left + d, cy)) river.add(point(left + d, cy));
    }
  }
  for (const [cx, cy, rx, ry] of spec.river.pools ?? []) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
    if (inside(x, y) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && !cliffPlan.cliff.has(point(x, y))) river.add(point(x, y));
  for (const i of river) {
    const x = i % W, y = Math.floor(i / W);
    if (!cliffPlan.cliff.has(i)) { water.add(i); continue; }
    const c = cliffPlan.columns.find((k) => k.x === x && y >= k.y && y <= k.y + k.height);
    m.upperTiles[i] = -1;
    if (y === c.y) water.add(i);
    else { m.lowerTiles[i] = riverTiles.fall; fallCells.add(i); }
    if (y === c.y) falls.push({ x, y: c.y, height: c.height, tile: riverTiles.fall });
  }
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (spec.coast(x, y) && cliffPlan.cells[point(x, y)] === "ground") water.add(point(x, y));
const paintGroup = (cells, g, layer = "lower", joined = cells) => {
  for (const i of cells) {
    const x = i % W, y = Math.floor(i / W);
    let mask = 0;
    neighbors.forEach(([dx, dy], b) => { if (inside(x + dx, y + dy) ? joined.has(point(x + dx, y + dy)) : true) mask |= 1 << b; });
    m[layer + "Tiles"][i] = g.variantMap[String(mask)];
  }
};
paintGroup(water, waterGroup, "lower", new Set([...water, ...fallCells]));
for (const i of [...water, ...fallCells]) reserve(i % W, Math.floor(i / W), 1, 1, 1);
const bridgeCells = new Set();
for (const [x, y, w] of spec.bridges) {
  for (let dx = 0; dx < w; dx++) for (const [dy, tile] of [[0, riverTiles.bridgeTop], [1, riverTiles.bridgeBottom]]) {
    const i = point(x + dx, y + dy);
    assert(water.has(i), "Bridge must stand on the river " + (x + dx) + "," + (y + dy));
    m.lowerTiles[i] = tile;
    bridgeCells.add(i);
  }
  for (const dy of [0, 1]) for (const [ax, role] of [[x - 1, "bridge-west"], [x + w, "bridge-east"]]) {
    assert(!water.has(point(ax, y + dy)), "Bridge end lands in water " + ax + "," + (y + dy));
    if (dy === 0) access.push({ role, x: ax, y });
  }
}
for (const [n, [x, y, template]] of spec.houses.entries()) {
  const t = templates[template];
  for (let k = 0; k < t.w * t.h; k++) {
    const to = point(x + k % t.w, y + Math.floor(k / t.w));
    assert(m.upperTiles[to] === -1 && m.lowerTiles[to] === 240 && !water.has(to), `House overlaps terrain ${x + k % t.w},${y + Math.floor(k / t.w)}`);
    m.lowerTiles[to] = t.lower[k];
    m.upperTiles[to] = t.upper[k];
  }
  const house = { id: spec.id + "-house-" + (n + 1), role: "house", label: t.label, window: t.window, abandoned: false, vines: [], x, y, w: t.w, h: t.h, template,
    doorAt: { x: x + t.doorAt.x, y: y + t.doorAt.y }, front: { x: x + t.front.x, y: y + t.front.y } };
  const program = PROP_PROGRAMS.houses[spec.id]?.[x + "," + y];
  assert(program, "Missing authored house purpose " + x + "," + y);
  Object.assign(house, program);
  houses.push(house);
  reserve(x, y, t.w, t.h, 2);
  reserve(house.front.x, house.front.y, 1, 3, 2);
  access.push({ role: "door-front", ...house.front });
}
const landmarks = [], landmarkSolid = new Set();
for (const [kind, x, y] of spec.landmarks) {
  const b = landmarkDefs.buildings[kind], yd = landmarkDefs.yards[kind], def = b ?? yd;
  const at = (dx, dy) => point(x + dx, y + dy), id = spec.id + "-" + kind;
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) {
    const i = at(dx, dy);
    assert(inside(x + dx, y + dy) && m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !water.has(i) && !reserved.has(i), "Landmark overlaps " + id + " " + (x + dx) + "," + (y + dy));
    landmarkSolid.add(i);
  }
  const entry = { id, kind, label: def.label, x, y, w: def.w, h: def.h };
  if (b) {
    b.lower.forEach((t, k) => { m.lowerTiles[at(k % b.w, Math.floor(k / b.w))] = t; });
    b.upper.forEach((t, k) => { m.upperTiles[at(k % b.w, Math.floor(k / b.w))] = t; });
    entry.doors = b.doors.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
    for (const d of entry.doors) access.push({ role: "landmark-door", x: d.x, y: d.y + 1, landmarkId: id });
    reserve(x, y, b.w, b.h, 2);
  } else {
    const [gx, gw] = yd.gate, bottom = yd.h - 1;
    for (let dx = 0; dx < yd.w; dx++) {
      m.upperTiles[at(dx, 0)] = dx === 0 ? 378 : dx === yd.w - 1 ? 380 : 379;
      if (dx < gx || dx >= gx + gw) m.upperTiles[at(dx, bottom)] = dx === 0 ? 438 : dx === yd.w - 1 ? 410 : dx === yd.w - 2 ? 409 : 439;
    }
    for (let dy = 1; dy < bottom; dy++) { m.upperTiles[at(0, dy)] = 408; m.upperTiles[at(yd.w - 1, dy)] = 408; }
    for (const [dx, dy, t] of yd.contents) m.upperTiles[at(dx, dy)] = t;
    entry.gate = { x: x + gx, y: y + bottom, w: gw };
    access.push({ role: "yard-gate", x: x + gx, y: y + yd.h, landmarkId: id }, { role: "yard-inside", x: x + gx, y: y + bottom - 1, landmarkId: id });
    reserve(x, y, yd.w, yd.h + 1, 1);
  }
  landmarks.push(entry);
  placements.push({ name: def.label, x, y, w: def.w, h: def.h, kind: "landmark", landmarkId: id, lower: Array.from({ length: def.w * def.h }, (_, k) => m.lowerTiles[at(k % def.w, Math.floor(k / def.w))]), upper: Array.from({ length: def.w * def.h }, (_, k) => m.upperTiles[at(k % def.w, Math.floor(k / def.w))]) });
}
const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
const solid = new Set(landmarkSolid);
for (const h of houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) solid.add(point(x, y));
for (let i = 0; i < W * H; i++) if (water.has(i) && !bridgeCells.has(i) || wings.has(i) || cliffPlan.cliff.has(i) && !isStairTile(m.lowerTiles[i], cliff[374])) solid.add(i);
let bx, by;
const route = (a, b) => {
  [bx, by] = b;
  const start = point(...a), end = point(...b), dist = new Map([[start, 0]]), prev = new Map(), q = [start];
  let found = false;
  while (q.length) {
    q.sort((a2, b2) => dist.get(a2) + Math.abs(a2 % W - bx) + Math.abs(Math.floor(a2 / W) - by) - (dist.get(b2) + Math.abs(b2 % W - bx) + Math.abs(Math.floor(b2 / W) - by)));
    const here = q.shift();
    if (here === end) { found = true; break; }
    const x = here % W, y = Math.floor(here / W);
    for (const [dx, dy] of neighbors.slice(0, 4)) {
      const nx = x + dx, ny = y + dy, ni = point(nx, ny);
      if (!inside(nx, ny) || solid.has(ni)) continue;
      const cost = dist.get(here) + (roads.has(ni) ? 0.75 : 1) + 0.015 * ((nx * 13 + ny * 7) % 11);
      if (cost < (dist.get(ni) ?? Infinity)) { dist.set(ni, cost); prev.set(ni, here); if (!q.includes(ni)) q.push(ni); }
    }
  }
  if (!found) throw Error("No route " + a + " " + b);
  for (let i = end; i !== start; i = prev.get(i)) roads.add(i);
  roads.add(start);
};
route([spec.entrance.x, spec.entrance.y], spec.spine[0]);
for (let depth = 0; depth < 5; depth++) for (let lane = -1; lane <= 1; lane++) {
  const x = spec.entrance.x + depth, y = spec.entrance.y + lane;
  assert(!solid.has(point(x, y)), "Entrance corridor intersects terrain");
  roads.add(point(x, y)); access.push({ role: "map-entrance", x, y });
}
for (let n = 1; n < spec.spine.length; n++) route(spec.spine[n - 1], spec.spine[n]);
const nearestSpine = (x, y) => spec.spine.reduce((b, q) => Math.hypot(q[0] - x, q[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? q : b);
for (const h of houses) route([h.front.x, h.front.y], nearestSpine(h.front.x, h.front.y));
for (const p of access.filter((p2) => p2.role.startsWith("stairs") || p2.role.startsWith("bridge") || p2.role === "landmark-door" || p2.role === "yard-gate")) route([p.x, p.y], nearestSpine(p.x, p.y));
// The pier: boards over the bay from the harbor shore; the road meets its root.
{
  const [x, y, w, h] = spec.dock;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { m.upperTiles[point(x + dx, y + dy)] = 199; reserve(x + dx, y + dy, 1, 1, 1); }
  route([x, y - 1], nearestSpine(x, y - 1));
  access.push({ role: "dock-end", x, y: y + h - 1 });
}
const centerRoads = [...roads];
for (const i of centerRoads) {
  const x = i % W, y = Math.floor(i / W);
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const ni = point(x + dx, y + dy);
    if (inside(x + dx, y + dy) && !solid.has(ni) && m.lowerTiles[ni] === 240 && m.upperTiles[ni] === -1) roads.add(ni);
  }
}
const roadPaint = new Set([...roads].filter((i) => !isStairTile(m.lowerTiles[i], cliff[374]) && !bridgeCells.has(i) && m.upperTiles[i] !== 199));
paintGroup(roadPaint, roadGroup);
for (const i of roads) reserve(i % W, Math.floor(i / W), 1, 1, 2);
const field = (x, y) => {
  const influence = ([cx, cy, rx, ry, strength]) => strength * Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
  return forest.forestContourScore(x, y, area, spec.seed, 0.42) + spec.patches.reduce((v, p) => v + influence(p), 0) - spec.clearings.reduce((v, p) => v + influence(p), 0)
    + (wings.has(point(Math.floor(x), Math.floor(y))) ? 50 : 0);
};
const freeRect = (x, y, w, h) => x >= 2 && y >= 2 && x + w < W - 2 && y + h < H - 2 && Array.from({ length: w * h }, (_, n) => point(x + n % w, y + Math.floor(n / w))).every((i) => m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !roads.has(i) && !reserved.has(i));
for (const [x, y, w, h] of spec.farms) {
  assert(freeRect(x, y, w, h), "Farm overlaps " + x + "," + y);
  const lower = farmlandTiles(w, h);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) m.lowerTiles[point(x + dx, y + dy)] = lower[dy * w + dx];
  reserve(x, y, w, h, 1);
  placements.push({ name: "텃밭", x, y, w, h, kind: "farm", lower, upper: Array(w * h).fill(-1) });
}
const grove = forest.paintContouredForest(m, area, group("forest_harmony_grove_47"), (x, y) => m.lowerTiles[point(x, y)] === 240 && m.upperTiles[point(x, y)] === -1 && !reserved.has(point(x, y)), spec.seed, 0.42, undefined, field);
const stamp = (name, x, y, w, h, lower, upper, kind) => {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const i = point(x + dx, y + dy), j = dy * w + dx;
    if (lower) m.lowerTiles[i] = lower[j];
    m.upperTiles[i] = upper[j];
  }
  reserve(x, y, w, h);
  placements.push({ name, x, y, w, h, kind, lower: lower ?? "KEEP", upper });
};
const farm = placements.find((o) => o.kind === "farm");
const activitySites = { dock: { x: spec.dock[0], y: spec.dock[1], w: spec.dock[2], h: spec.dock[3] }, farm: { x: farm.x, y: farm.y, w: farm.w, h: farm.h } };
const household = placeHouseholdProps({ map: m, houses, parts, roads, access, cliffCells: cliffPlan.cliff, reachable: reach.computeReachableCells(project, m, spec.start.x, spec.start.y), stamp, sites: activitySites });
for (const o of household.placed) Object.assign(placements.find((p) => p.kind === "prop" && p.x === o.x && p.y === o.y), { ownerId: o.ownerId, kit: o.kit, purpose: o.purpose, anchor: o.anchor, side: o.side });
let reachable = reach.computeReachableCells(project, m, spec.start.x, spec.start.y);
const blocked = access.filter((a) => !reachable.has(a.x + "," + a.y));
assert.equal(blocked.length, 0, "Blocked: " + JSON.stringify(blocked));
const civicPlan = { houses, landmarks, placements, activitySites, roadCells: [...roads], access, entrance: spec.entrance };
const civic = process.env.VILLAGE_NOCIVIC ? { zones: [] } : placeCivicProps({ map: m, plan: civicPlan, parts, project, reach });
reachable = reach.computeReachableCells(project, m, spec.start.x, spec.start.y);
{
  const shut = structuredClone(m);
  for (const [x, y, height] of spec.stairs) for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) shut.lowerTiles[point(xx, yy)] = cliff[172];
  const below = reach.computeReachableCells({ tilesets: { [ts.id]: ts }, maps: { [m.id]: shut } }, shut, spec.start.x, spec.start.y);
  const leaks = [...below].map((k) => k.split(",").map(Number)).filter(([x, y]) => cliffPlan.cells[point(x, y)] === "plateau");
  assert.equal(leaks.length, 0, "Terrace reachable without stairs " + JSON.stringify(leaks.slice(0, 6)));
}
forest.shadeForestCanopy(m, group("forest_harmony_grove_47"));
m.layoutPlan = { version: 1, kind: "diverse-village-reference", seed: spec.seed, regions: houses, notes: spec.note, entrance: spec.entrance, civicPlaces: civic.zones, landmarks };
const { coast, ...plain } = spec;
const plan = { ...plain, coast: true, trees: [], falls, houses, landmarks, placements, activitySites, civicPlaces: civic.zones, yards: household.yards, access, grassJoins: [],
  grove: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns }, reachableCells: reachable.size, cliffColumns: cliffPlan.columns, roadCells: [...roads] };
fs.writeFileSync(out, JSON.stringify({ plans: [plan], maps: { [m.id]: m } }));
console.log(spec.id, { houses: houses.length, objects: placements.length, forest: grove.canopyCells, reachable: reachable.size, civic: civic.zones.length });
