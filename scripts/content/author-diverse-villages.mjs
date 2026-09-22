// New exterior studies built from verified whole parts; never edits the source project.
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { withTsModule } from "../ontology-ts-loader.mjs";
const [input, out] = process.argv.slice(2);
if (!input || !out) throw Error("Usage: author-diverse-villages.mjs canonical-export.json output-dir");
fs.mkdirSync(out, { recursive: true });
const source = JSON.parse(fs.readFileSync(input)), ts = structuredClone(source.tilesets.forest_harmony), original = source.maps.dewbank_village;
const parts = JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json")).props;
const cliffIds = [18, 19, 48, 49, 78, 79, 80, 108, 110, 138, 139, 140, 171, 172, 173, 201, 202, 203, 231, 374, 413];
const offset = Math.ceil(ts.count / 30) * 30, cliff = Object.fromEntries(cliffIds.map((n, i) => [n, offset + i]));
for (const [i, n] of cliffIds.entries()) {
  const id = offset + i;
  ts.tileGrafts.push({ sourceChipset: "tex_easyrpg_chipset_retro_world", sourceTile: n, targetTile: id });
  const walk = [78, 79, 80, 108, 110, 138, 139, 140, 374].includes(n);
  ts.priority[id] = "lower";
  ts.terrain[id] = 0;
  ts.passability[id] = { up: walk, down: walk, left: walk, right: walk };
  ts.tileMeta[id] = { label: n === 374 ? "돌계단" : n === 413 ? "동굴 입구" : `절벽 원본 ${n}`, description: "레트로 월드맵 원본을 번호 혼동 없이 이식", role: n === 374 ? "floor" : "cliff", defaultLayer: "lower", source: "user", userLocked: true, passage: walk ? "passable" : "solid", ...n === 413 ? { layerBacking: cliff[172] } : {} };
}
ts.count = Math.ceil((offset + cliffIds.length) / 30) * 30;
while (ts.terrain.length < ts.count) ts.terrain.push(0);
while (ts.priority.length < ts.count) ts.priority.push("lower");
while (ts.passability.length < ts.count) ts.passability.push({ up: false, down: false, left: false, right: false });
while (ts.tileMeta.length < ts.count) ts.tileMeta.push({ label: "미사용", source: "unknown" });
let relief, forest, reach;
await withTsModule("src/editor/tools/village/relief.ts", "diverse-relief.mjs", (m) => {
  relief = m;
});
await withTsModule("src/editor/tools/village/forestContour.ts", "diverse-forest.mjs", (m) => {
  forest = m;
});
await withTsModule("src/project/lint/reachability.ts", "diverse-reach.mjs", (m) => {
  reach = m;
});
const chamfer = (x0, y0, x1, y1, c = 3) => ({ x0, y0, x1, y1, nw: c, ne: c, sw: c, se: c });
const plans = [
  { id: "pine-hamlets", name: "솔바람 흩어진 산촌", width: 80, height: 64, seed: 191, start: { x: 40, y: 60 }, note: "세 빈터에 흩어진 집, 두 둔덕, 갈라지는 오솔길과 작은 샘", houses: [[12, 9, 3], [33, 6, 0], [61, 12, 7], [17, 31, 5], [44, 28, 1], [61, 43, 6], [29, 47, 2]], plateaus: [{ level: 1, parts: [chamfer(8, 5, 26, 23), chamfer(20, 6, 30, 16, 2)] }, { level: 1, parts: [chamfer(55, 7, 75, 27), chamfer(50, 7, 61, 15, 2)] }], stairs: [[19, 23], [64, 27]], ponds: [[10, 47, 5, 4]], spine: [[40, 60], [40, 54], [38, 43], [29, 28], [30, 21], [42, 19], [49, 24], [56, 37], [66, 36]], farms: [[20, 41, 6, 4], [37, 13, 6, 4]], trees: 28 },
  { id: "terrace-cliff-village", name: "층바위 절벽마을", width: 88, height: 72, seed: 347, start: { x: 42, y: 68 }, note: "세 높이의 대지, 네 계단과 절벽 아래 작업 마당", houses: [[27, 9, 0], [49, 11, 4], [13, 29, 1], [37, 30, 7], [65, 28, 5], [18, 54, 2], [47, 54, 6], [70, 51, 3]], plateaus: [{ level: 1, parts: [chamfer(8, 6, 39, 46, 4), chamfer(34, 4, 61, 48, 4), chamfer(56, 8, 81, 45, 4)] }, { level: 2, parts: [chamfer(21, 5, 47, 23, 3), chamfer(43, 8, 70, 26, 3)] }], stairs: [[34, 23], [58, 26], [26, 46], [46, 48]], ponds: [], spine: [[42, 68], [42, 63], [29, 52], [26, 45], [30, 40], [34, 26], [34, 20], [58, 20], [58, 27], [59, 39], [60, 51], [70, 60]], farms: [[43, 40, 9, 4], [11, 41, 8, 3]], trees: 28, cave: [71, 45] },
  { id: "reed-bay-village", name: "갈대물굽이 포구", width: 88, height: 64, seed: 521, start: { x: 6, y: 33 }, note: "물굽이를 따라 비껴 앉은 집, 좁은 골목과 긴 선착장", houses: [[11, 9, 3], [31, 5, 7], [52, 12, 0], [12, 25, 1], [34, 22, 5], [52, 31, 6], [12, 42, 2], [34, 39, 4]], plateaus: [{ level: 1, parts: [chamfer(7, 5, 25, 22, 3)] }], stairs: [[19, 22]], ponds: [], coast: true, spine: [[6, 33], [21, 36], [26, 29], [29, 18], [43, 17], [48, 26], [48, 40], [56, 43], [57, 47]], farms: [[20, 13, 4, 4], [25, 47, 6, 4]], trees: 18, dock: [56, 45, 21, 2] }
];
const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const houseSources = original.layoutPlan.regions.filter((r) => r.role === "house");
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const roadGroup = group("forest_harmony_road_47"), waterGroup = group("forest_harmony_lake_47");
delete ts.referenceDocuments;
const result = { tileset: ts, cliffBindings: cliff, plans: [], maps: {} };
for (const spec of plans) {
  let rand = spec.seed;
  const rng = () => {
    rand = Math.imul(rand, 1664525) + 1013904223 >>> 0;
    return rand / 4294967296;
  };
  const W = spec.width, H = spec.height, area = { x: 0, y: 0, w: W, h: H }, m = { id: spec.id, name: spec.name, width: W, height: H, tileSize: 16, tilesetId: ts.id, lowerTiles: Array(W * H).fill(240), upperTiles: Array(W * H).fill(-1), events: [] };
  const point = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const reserved = new Set(), roads = new Set(), water = new Set(), houses = [], placements = [], access = [];
  const reserve = (x, y, w, h, pad = 0) => {
    for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inside(xx, yy)) reserved.add(point(xx, yy));
  };
  const reliefPlan = relief.rasterize(spec.plateaus, W, H, area);
  relief.paintRelief(m, reliefPlan);
  for (let i = 0; i < W * H; i++) {
    if (m.lowerTiles[i] !== 240) {
      const n = m.lowerTiles[i] - 480;
      assert(cliff[n] !== void 0, "Missing cliff source " + n);
      m.lowerTiles[i] = cliff[n];
    }
  }
  for (const [x, y] of spec.stairs) {
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x; xx < x + 2; xx++) m.lowerTiles[point(xx, yy)] = cliff[374];
    reserve(x, y - 2, 2, 5, 1);
    access.push({ role: "stairs-top", x, y: y - 2 }, { role: "stairs-bottom", x, y: y + 2 });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wet = spec.ponds.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + 0.12 * Math.sin(x + y)) || spec.coast && (y > 52 + 3 * Math.sin(x / 10) || x > 70 + 4 * Math.sin(y / 9));
    if (wet && reliefPlan.cells[point(x, y)] === "ground") water.add(point(x, y));
  }
  const paintGroup = (cells, g, layer = "lower") => {
    for (const i of cells) {
      const x = i % W, y = Math.floor(i / W);
      let mask = 0;
      neighbors.forEach(([dx, dy], b) => {
        if (inside(x + dx, y + dy) && cells.has(point(x + dx, y + dy))) mask |= 1 << b;
      });
      m[layer + "Tiles"][i] = g.variantMap[String(mask)];
    }
  };
  paintGroup(water, waterGroup);
  for (const i of water) reserve(i % W, Math.floor(i / W), 1, 1, 1);
  for (const [n, [x, y, template]] of spec.houses.entries()) {
    const h = houseSources[template];
    for (let dy = 0; dy < h.h; dy++) for (let dx = 0; dx < h.w; dx++) {
      const to = point(x + dx, y + dy), from = (h.y + dy) * 88 + h.x + dx;
      assert.equal(m.lowerTiles[to], 240, `House overlaps relief ${spec.id} ${x + dx},${y + dy}`);
      m.lowerTiles[to] = original.lowerTiles[from];
      m.upperTiles[to] = original.upperTiles[from];
    }
    const house = { id: spec.id + "-house-" + (n + 1), role: "house", label: h.label, x, y, w: h.w, h: h.h, template, doorAt: { x: x + h.doorAt.x - h.x, y: y + h.doorAt.y - h.y }, front: { x: x + h.front.x - h.x, y: y + h.front.y - h.y } };
    houses.push(house);
    reserve(x, y, h.w, h.h, 2);
    reserve(house.front.x, house.front.y, 1, 3, 2);
    access.push({ role: "door-front", ...house.front });
  }
  const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
  const solid = new Set();
  for (const h of houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) solid.add(point(x, y));
  for (let i = 0; i < W * H; i++) if (water.has(i) || reliefPlan.cliff.has(i) && m.lowerTiles[i] !== cliff[374]) solid.add(i);
  const route = (a, b) => {
    const start = point(...a), end = point(...b), dist = new Map([[start, 0]]), prev = new Map(), q = [start];
    let found = false;
    while (q.length) {
      q.sort((a2, b2) => dist.get(a2) + Math.abs(a2 % W - bx) + Math.abs(Math.floor(a2 / W) - by) - (dist.get(b2) + Math.abs(b2 % W - bx) + Math.abs(Math.floor(b2 / W) - by)));
      const at = q.shift();
      if (at === end) {
        found = true;
        break;
      }
      const x = at % W, y = Math.floor(at / W);
      for (const [dx, dy] of neighbors.slice(0, 4)) {
        const nx = x + dx, ny = y + dy, ni = point(nx, ny);
        if (!inside(nx, ny) || solid.has(ni)) continue;
        const cost = dist.get(at) + (roads.has(ni) ? 0.75 : 1) + 0.015 * ((nx * 13 + ny * 7) % 11);
        if (cost < (dist.get(ni) ?? Infinity)) {
          dist.set(ni, cost);
          prev.set(ni, at);
          if (!q.includes(ni)) q.push(ni);
        }
      }
    }
    if (!found) throw Error("No route " + spec.id + " " + a + " " + b);
    let i = end;
    while (i !== start) {
      roads.add(i);
      i = prev.get(i);
    }
    roads.add(start);
  };
  let bx, by;
  const connect = (a, b) => {
    [bx, by] = b;
    route(a, b);
  };
  for (let n = 1; n < spec.spine.length; n++) connect(spec.spine[n - 1], spec.spine[n]);
  for (const h of houses) {
    const a = [h.front.x, h.front.y], nearest = spec.spine.reduce((b, q) => Math.hypot(q[0] - a[0], q[1] - a[1]) < Math.hypot(b[0] - a[0], b[1] - a[1]) ? q : b);
    connect(a, nearest);
  }
  for (const p of access.filter((p2) => p2.role.startsWith("stairs"))) connect([p.x, p.y], spec.spine.reduce((b, q) => Math.hypot(q[0] - p.x, q[1] - p.y) < Math.hypot(b[0] - p.x, b[1] - p.y) ? q : b));
  const centerRoads = [...roads];
  for (const i of centerRoads) {
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const ni = point(x + dx, y + dy);
      if (inside(x + dx, y + dy) && !solid.has(ni) && m.lowerTiles[ni] === 240) roads.add(ni);
    }
  }
  const roadPaint = new Set([...roads].filter((i) => m.lowerTiles[i] !== cliff[374]));
  paintGroup(roadPaint, roadGroup);
  for (const i of roads) reserve(i % W, Math.floor(i / W), 1, 1, 2);
  if (spec.dock) {
    const [x, y, w, h] = spec.dock;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      m.upperTiles[point(x + dx, y + dy)] = 199;
      reserve(x + dx, y + dy, 1, 1, 1);
    }
    connect([x, y - 1], spec.spine.at(-1));
    access.push({ role: "dock-end", x: x + w - 1, y });
  }
  if (spec.cave) {
    const [x, y] = spec.cave;
    m.lowerTiles[point(x, y)] = cliff[413];
    reserve(x, y, 1, 3, 2);
    access.push({ role: "cave-approach", x, y: y + 2 });
  }
  const grove = forest.paintContouredForest(m, area, group("forest_harmony_grove_47"), (x, y) => reliefPlan.cells[point(x, y)] === "ground" && m.lowerTiles[point(x, y)] === 240 && !reserved.has(point(x, y)), spec.seed, 0.48);
  const freeRect = (x, y, w, h) => x >= 2 && y >= 2 && x + w < W - 2 && y + h < H - 2 && Array.from({ length: w * h }, (_, n) => point(x + n % w, y + Math.floor(n / w))).every((i) => m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !roads.has(i) && !reserved.has(i));
  const stamp = (name, x, y, w, h, lower, upper, kind) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = point(x + dx, y + dy), j = dy * w + dx;
      if (lower) m.lowerTiles[i] = lower[j];
      m.upperTiles[i] = upper[j];
    }
    reserve(x, y, w, h);
    placements.push({ name, x, y, w, h, kind, lower: lower ?? "KEEP", upper });
  };
  for (const [x, y, w, h] of spec.farms) {
    if (freeRect(x, y, w, h)) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) m.lowerTiles[point(x + dx, y + dy)] = 188;
      reserve(x, y, w, h);
      placements.push({ name: "텃밭", x, y, w, h, kind: "farm", lower: Array(w * h).fill(188), upper: Array(w * h).fill(-1) });
    }
  }
  const byName = (name) => parts.find((p) => p.name === name);
  const themes = [["꽃 화단", "화분", "빨랫줄", "새집", "우편함"], ["채소밭", "허수아비", "씨앗 자루", "과일 바구니", "나무 울타리"], ["장작", "나무통", "과일 상자", "나무 상자", "가로 탁자"], ["약초 화분", "덩굴 아치", "돌등", "항아리", "표지판"]];
  for (const [n, h] of houses.entries()) for (let k = 0; k < 9; k++) {
    const name = themes[n % 4][k % 5], p = byName(name);
    let placed = false;
    for (let attempt = 0; attempt < 100 && !placed; attempt++) {
      const x = h.x - 5 + Math.floor(rng() * (h.w + 10)), y = h.y + Math.floor(rng() * (h.h + 8));
      if (freeRect(x, y, p.width, p.height)) {
        stamp(name, x, y, p.width, p.height, null, p.targetUpper.flat(), "prop");
        placed = true;
      }
    }
  }
  for (const name of ["낮은 돌 우물", "게시판", "가로 탁자", "과일 바구니", "표지판", "돌등", "낚시 바구니"]) {
    const p = byName(name), anchor = spec.spine[Math.floor(spec.spine.length / 2)];
    for (let attempt = 0; attempt < 120; attempt++) {
      const x = anchor[0] - 8 + Math.floor(rng() * 17), y = anchor[1] - 5 + Math.floor(rng() * 14);
      if (freeRect(x, y, p.width, p.height)) {
        stamp(name, x, y, p.width, p.height, null, p.targetUpper.flat(), "prop");
        break;
      }
    }
  }
  const vegetation = ["forest-trees:tree", "forest-trees:round-bush", "forest-trees:small-bush"];
  for (let n = 0; n < spec.trees; n++) {
    const g = ts.tileGroups.find((g2) => g2.id === vegetation[n % 3]), v = g.previewMap;
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = 3 + Math.floor(rng() * (W - 7)), y = 3 + Math.floor(rng() * (H - 8));
      if (freeRect(x, y, v.width, v.height)) {
        stamp(g.name, x, y, v.width, v.height, v.lowerTiles, v.upperTiles, "vegetation");
        break;
      }
    }
  }
  let reachable = reach.computeReachableCells(project, m, spec.start.x, spec.start.y);
  for (let n = placements.length - 1; n >= 0; n--) {
    const o = placements[n];
    if (o.kind !== "prop") continue;
    if (!Array.from({ length: o.w * o.h }, (_, i) => [o.x + i % o.w, o.y + Math.floor(i / o.w)]).some(([x, y]) => reach.isAdjacentOrOn(reachable, x, y))) {
      for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) m.upperTiles[point(o.x + dx, o.y + dy)] = -1;
      placements.splice(n, 1);
    }
  }
  reachable = reach.computeReachableCells(project, m, spec.start.x, spec.start.y);
  const blocked = access.filter((a) => !reachable.has(a.x + "," + a.y));
  assert.equal(blocked.length, 0, "Blocked " + spec.id + ": " + JSON.stringify(blocked));
  m.layoutPlan = { version: 1, kind: "diverse-village-reference", seed: spec.seed, regions: houses, notes: spec.note };
  result.maps[m.id] = m;
  result.plans.push({ ...spec, houses, placements, access, grove: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns }, reachableCells: reachable.size, roadCells: [...roads] });
  console.log(spec.id, { houses: houses.length, objects: placements.length, forest: grove.canopyCells, reachable: reachable.size });
}
fs.writeFileSync(path.join(out, "authored.json"), JSON.stringify(result));
