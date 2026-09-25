// Author the fields between villages on the diverse forest-village tileset (tiledata/forest-villages/diverse/catalog.json).
// Same parts as the villages — cliff column grammar, stairs, river + waterfall + bridge, dirt road autotile, contoured forest,
// whole tree stamps and whole props — but no houses: a road runs from map edge to map edge through meadows and forest.
// Terrain only; the exits are documented (which village entrance they meet) but carry no transfer events.
// Then each climate sheet gets one field: the forest field re-pointed at the climate tileset (same numbers) plus the
// climate edits of the climate villages (lib/climate-edits.mjs), with the exits re-described for that climate's villages.
// Usage: node scripts/content/author-field-routes.mjs   (writes tiledata/field-routes/catalog.json + validation.json)
import fs from "node:fs";
import assert from "node:assert/strict";
import { cliffColumns, paintVillageCliffs } from "./lib/village-cliffs.mjs";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { dressDesert, freezeCells, placePeaks, reachable } from "./lib/climate-edits.mjs";
import { dressDesertGround, dressVolcanoGround, terrainKit } from "./lib/climate-terrain.mjs";
import { arrangeBareGroves, clearLeafyTrees } from "./lib/bare-trees.mjs";
import { stairTile, isStairTile } from "./lib/cliff-stairs.mjs";

const OUT = "tiledata/field-routes";
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const ts = village.tileset, cliff = village.cliffBindings, riverTiles = village.riverTiles;
const parts = [...JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json")).props,
  ...JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json")).props];
// The three approved free-standing tree assemblies of the villages (whole stamps, never cropped).
const TREES = Object.values(Object.fromEntries(Object.values(JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/retained-vegetation.json")))
  .flat().map((o) => [o.name, { name: o.name, w: o.w, h: o.h, lower: o.lower, upper: o.upper }])));
const GROUND = 240, COVERAGE = 0.55;
// Single-tile meadow dressing (upper layer, solid): grey boulder, rubble, flowering bush.
const DRESSING = { 537: "회백색 바위 더미", 29: "돌 무더기", 768: "꽃 둥근 관목" };

// exits: map-edge openings, 3 wide and 5 deep like a village entrance. The first exit is the lowest tier (entry of the checks).
// meets: the village entrance this edge is drawn to line up with (same x on an 80-wide village's south edge).
const PLANS = [
  { id: "field-forest-crossroads", name: "숲속 세 갈래길", width: 96, height: 64, seed: 1201,
    note: "서쪽에서 들어온 흙길이 숲 사이 빈터에서 북쪽 길과 동쪽 길로 갈라진다. 갈림길에 이정표와 쉼터, 남동쪽 풀밭에 작은 못이 있다",
    exits: [{ side: "west", at: 40, meets: "갈대물굽이 포구 서쪽 입구(0,33)" }, { side: "north", at: 40, meets: "솔바람 흩어진 산촌 남쪽 입구(40,63)" }, { side: "east", at: 24, meets: "다음 필드" }],
    spine: [["exit:0", [16, 40], [30, 37], [44, 34]], [[44, 34], [42, 22], [40, 10], "exit:1"], [[44, 34], [58, 32], [72, 27], [84, 24], "exit:2"]],
    ponds: [[70, 46, 6, 3.6]], cliffs: [], stairs: [],
    patches: [[22, 20, 9, 7, 11], [62, 12, 9, 7, 11], [26, 54, 10, 5, 10], [52, 50, 5, 5, 9], [86, 44, 5, 8, 9]],
    groves: [[30, 49, 9.6, 5.6], [58, 43, 8, 4.8], [30, 26, 8, 5.6], [54, 18, 8, 4.8], [80, 37, 8, 4.8], [16, 28, 8, 4.8]],
    clearings: [[44, 34, 9, 6, 12], [70, 46, 9, 6, 11], [18, 40, 7, 5, 8], [80, 24, 7, 5, 8]],
    props: [["나무 이정표", 47, 32], ["벤치", 48, 37], ["통나무 더미", 38, 38], ["통나무 더미", 39, 38], ["모닥불", 51, 37], ["돌 석상", 63, 43]],
    trees: 18, dressing: { 537: 5, 29: 3, 768: 6 } },
  { id: "field-ford-cliff-road", name: "여울 건너 벼랑길", width: 100, height: 72, seed: 1307,
    note: "숲을 가로지르는 한 줄 절벽 위아래로 길이 나 있다. 북쪽 숲에서 나온 여울이 절벽을 폭포로 넘고, 아랫단 길은 나무다리로 여울을 건너며 계단으로 윗단에 오른다",
    exits: [{ side: "south", at: 48, meets: "여울성 나루 남쪽 입구(48,91)" }, { side: "east", at: 54, meets: "다음 필드" }, { side: "north", at: 40, meets: "종탑 언덕 교구마을 남쪽 입구(40,63)" }],
    cliffs: [{ points: [[6, 30], [20, 30], [22, 29], [40, 29], [42, 30], [58, 30], [60, 31], [78, 31], [80, 30], [90, 30]], height: 6 }],
    stairs: [[30, 29, 6]],
    river: { width: 4, pools: [[63, 41, 5.5, 3.2]], points: [[66, 0], [66, 8], [64, 12], [64, 24], [63, 31], [63, 44], [61, 48], [61, 60], [62, 66], [62, 71]] },
    bridges: [[60, 53]],
    spine: [["exit:0", [48, 64], [46, 56], "bridge-west:0"], ["bridge-east:0", [74, 54], [88, 54], "exit:1"], [[46, 56], [34, 50], [31, 40], "stairs-bottom:0"], ["stairs-top:0", [33, 22], [38, 12], "exit:2"]],
    ponds: [], patches: [[14, 12, 9, 8, 11], [84, 12, 9, 8, 11], [20, 62, 9, 6, 10], [82, 66, 8, 5, 10], [44, 40, 6, 5, 12]],
    groves: [[44, 42, 8, 5.6], [18, 47, 8, 4.8], [80, 42, 8, 4.8], [50, 12, 8, 4.8], [80, 18, 8, 4.8], [24, 60, 8, 4.8]],
    clearings: [[36, 18, 10, 7, 12], [40, 58, 11, 7, 12], [76, 52, 10, 5, 10], [26, 44, 6, 6, 9]],
    props: [["나무 이정표", 44, 57], ["돌 석상", 28, 26], ["통나무 더미", 72, 57], ["벤치", 36, 24]],
    trees: 18, dressing: { 537: 5, 29: 3, 768: 6 } },
  { id: "field-two-step-pass", name: "두 단 고갯길", width: 80, height: 80, seed: 1409,
    note: "남쪽 기슭에서 북쪽 고개까지 절벽 두 줄을 계단 두 곳으로 오르는 고갯길. 가운뎃단에 작은 못, 윗단 절벽에 동굴 입구가 있다",
    exits: [{ side: "south", at: 40, meets: "필드 남쪽" }, { side: "north", at: 40, meets: "안개못 폐촌 남쪽 입구(40,63)" }],
    cliffs: [
      { points: [[6, 54], [18, 54], [20, 53], [36, 53], [38, 54], [56, 54], [58, 55], [74, 55]], height: 5 },
      { points: [[6, 26], [22, 26], [24, 25], [44, 25], [46, 26], [60, 26], [62, 27], [74, 27]], height: 5 },
    ],
    stairs: [[22, 53, 5], [52, 26, 5]], cave: [34, 27],
    spine: [["exit:0", [40, 70], [30, 64], "stairs-bottom:0"], ["stairs-top:0", [28, 46], [42, 40], [52, 36], "stairs-bottom:1"], ["stairs-top:1", [50, 18], [42, 10], "exit:1"], [[28, 46], [34, 36], "cave"]],
    ponds: [[62, 43, 5, 3.2]],
    patches: [[10, 10, 8, 10, 11], [70, 12, 8, 9, 11], [12, 40, 6, 8, 10], [68, 66, 8, 8, 10], [14, 70, 7, 6, 10]],
    groves: [[60, 65, 8, 5.6], [15, 46, 8, 4.8], [62, 15, 8, 4.8], [26, 15, 8, 4.8], [40, 49, 8, 4.8], [66, 34, 8, 4.8]],
    clearings: [[46, 12, 9, 6, 10], [40, 40, 12, 6, 12], [62, 43, 8, 5, 10], [38, 66, 11, 6, 12]],
    props: [["나무 이정표", 43, 74], ["통나무 더미", 26, 66], ["돌 석상", 47, 18], ["모닥불", 45, 44]],
    trees: 18, dressing: { 537: 5, 29: 3, 768: 6 } },
];

// Climate versions: meets[i] replaces exit i's village for that climate (villages in tiledata/climate-villages).
const CLIMATE_FIELDS = [
  { id: "field-snow-two-step-pass", climate: "snow", from: "field-two-step-pass", name: "눈 덮인 두 단 고갯길", freezePond: 0,
    meets: ["필드 남쪽", "얼어붙은 안개못 남쪽 입구(40,63)"],
    note: "눈 덮인 절벽 두 줄을 계단 두 곳으로 오르는 고갯길. 가운뎃단의 못이 얼어 걸어서 건널 수 있고, 윗단 절벽에 동굴 입구가 있다" },
  { id: "field-volcano-ford-cliff-road", climate: "volcano", from: "field-ford-cliff-road", name: "용암 강 벼랑길", peaks: 1, ground: "volcano",
    meets: ["잿빛 여울성 남쪽 입구(48,91)", "다음 필드", "용암못 폐촌 남쪽 입구(40,63)"],
    note: "재 덮인 절벽 위아래로 난 길. 북쪽에서 흘러온 용암 강이 절벽을 용암 폭포로 넘고, 아랫단 길은 현무암 다리로 건넌다. 빈 재밭은 식은 용암 판과 가지 친 용암 균열로 덮이고, 분기공이 김을 뿜는 작은 용암 웅덩이와 화산 봉우리 한 쌍이 있다" },
  { id: "field-desert-crossroads", climate: "desert", from: "field-forest-crossroads", name: "오아시스 세 갈래길", desert: { palms: 10, cacti: 0, feet: false }, ground: "desert", bareForest: true, groundOpts: { duneSeas: 2, duneShare: 0.55 },
    meets: ["모래 물굽이 포구 서쪽 입구(0,33)", "사암 층바위 협곡마을 남쪽 입구(42,71)", "다음 필드"],
    note: "트인 모래밭에서 길이 세 갈래로 갈린다. 남동쪽 오아시스 못가에 야자수가 둘러서고, 모래밭은 사구 능선과 모래 물결로 덮였다. 잎 없는 고목은 드문드문 덩이로만 서 있고 선인장은 한 무리뿐이다" },
  { id: "field-autumn-ford-cliff-road", climate: "autumn", from: "field-ford-cliff-road", name: "단풍 여울 벼랑길",
    meets: ["가을 두 폭포 강마을 남쪽 입구(24,71)", "다음 필드", "가을 종탑 언덕 교구 남쪽 입구(40,63)"],
    note: "단풍 숲을 가로지르는 절벽 위아래 길. 여울이 절벽을 폭포로 넘고, 금빛 풀밭 길이 나무다리로 여울을 건너 계단으로 윗단에 오른다" },
];

const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const roadGroup = group("forest_harmony_road_47"), waterGroup = group("forest_harmony_lake_47"), groveGroup = group("forest_harmony_grove_47");
const partByName = (name) => { const p = parts.find((q) => q.name === name); assert(p, "Missing part " + name); return p; };
const rng = (seed) => () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) | 0; return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296; };

let forest, reach, canMove;
await withTsModule("src/editor/tools/village/forestContour.ts", "field-forest.mjs", (m) => { forest = m; });
await withTsModule("src/project/lint/reachability.ts", "field-reach.mjs", (m) => { reach = m; });
await withTsModule("src/project/collision.ts", "field-collision.mjs", (m) => { canMove = m.canMove; });

const maps = {}, plans = [], report = [];
// Layout iteration aid: FIELD_DUMP=file.json keeps the last map being authored, even when an assertion stops the run.
let lastMap = null;
if (process.env.FIELD_DUMP) process.on("exit", () => lastMap && fs.writeFileSync(process.env.FIELD_DUMP, JSON.stringify({ maps: { [lastMap.id]: lastMap } })));
for (const spec of PLANS.filter((p) => !process.env.FIELD_ONLY || p.id === process.env.FIELD_ONLY)) {
  const W = spec.width, H = spec.height, area = { x: 0, y: 0, w: W, h: H };
  const m = { id: spec.id, name: spec.name, width: W, height: H, tileSize: 16, tilesetId: ts.id, lowerTiles: Array(W * H).fill(GROUND), upperTiles: Array(W * H).fill(-1), events: [] };
  lastMap = m;
  const point = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const reserved = new Set(), roads = new Set(), water = new Set(), access = [], placements = [];
  const reserve = (x, y, w, h, pad = 0) => {
    for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inside(xx, yy)) reserved.add(point(xx, yy));
  };
  const cliffPlan = paintVillageCliffs(m, spec.cliffs, cliff);
  // A cliff only reads as height when its ends die into forest (same wings as the villages).
  const wings = new Set();
  for (const c of spec.cliffs) for (const side of ["left", "right"]) {
    const [ex, ey] = side === "left" ? c.points[0] : c.points.at(-1);
    // Within six cells of the map edge the wing runs all the way out, so no one-column path slips round the end.
    const room = side === "left" ? ex : W - 1 - ex, reach = room <= 6 ? room : 4;
    for (let y = Math.max(0, ey - 3); y <= Math.min(H - 1, ey + c.height + 1); y++) for (let d = 1; d <= reach; d++) {
      const x = side === "left" ? ex - d : ex + d;
      if (inside(x, y) && !cliffPlan.cliff.has(point(x, y))) wings.add(point(x, y));
    }
  }
  const stairs = spec.stairs.map(([x, y, height]) => {
    for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) {
      const i = point(xx, yy);
      assert(cliffPlan.cliff.has(i), "Stair must span the whole face " + spec.id);
      m.lowerTiles[i] = stairTile(xx, x); m.upperTiles[i] = -1;
    }
    reserve(x, y - 1, 2, height + 3, 1);
    const top = { x, y: y - 1 }, bottom = { x, y: y + height + 1 };
    access.push({ role: "stairs-top", ...top }, { role: "stairs-bottom", ...bottom });
    return { x, y, height, top, bottom };
  });
  // River brush + waterfall where it crosses a cliff, plunge pools on the lower tier (village rule).
  const fallCells = new Set(), falls = [], river = new Set();
  if (spec.river) {
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
      assert(!isStairTile(m.lowerTiles[i], cliff[374]), "River runs over a stair " + spec.id);
      if (!cliffPlan.cliff.has(i)) { water.add(i); continue; }
      const c = cliffPlan.columns.find((k) => k.x === x && y >= k.y && y <= k.y + k.height);
      m.upperTiles[i] = -1;
      if (y === c.y) { water.add(i); falls.push({ x, y: c.y, height: c.height, tile: riverTiles.fall }); }
      else { m.lowerTiles[i] = riverTiles.fall; fallCells.add(i); }
    }
  }
  for (const [cx, cy, rx, ry] of spec.ponds) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + 0.12 * Math.sin(x + y) && !cliffPlan.cliff.has(point(x, y))) water.add(point(x, y));
  const paintGroup = (cells, g, layer = "lower", joined = cells) => {
    for (const i of cells) {
      const x = i % W, y = Math.floor(i / W);
      let mask = 0;
      neighbors.forEach(([dx, dy], b) => {
        // A river leaving the map keeps flowing past the edge instead of growing a bank there.
        if (inside(x + dx, y + dy) ? joined.has(point(x + dx, y + dy)) : river.has(i)) mask |= 1 << b;
      });
      m[layer + "Tiles"][i] = g.variantMap[String(mask)];
    }
  };
  paintGroup(water, waterGroup, "lower", new Set([...water, ...fallCells]));
  for (const i of [...water, ...fallCells]) reserve(i % W, Math.floor(i / W), 1, 1, 1);
  // Bridges are given as [x, y] on the river; the span is the water run of that row (both plank rows must match).
  const bridgeCells = new Set(), bridges = [];
  for (const [hint, y] of spec.bridges ?? []) {
    const run = (yy) => { let a = hint, b = hint; assert(water.has(point(hint, yy)), `Bridge hint off the river ${spec.id} ${hint},${yy}`);
      while (water.has(point(a - 1, yy))) a--; while (water.has(point(b + 1, yy))) b++; return [a, b]; };
    const [x, end] = run(y), w = end - x + 1;
    assert.deepEqual(run(y + 1), [x, end], `Bridge rows differ ${spec.id} y=${y}`);
    for (let dx = 0; dx < w; dx++) for (const [dy, tile] of [[0, riverTiles.bridgeTop], [1, riverTiles.bridgeBottom]]) {
      const i = point(x + dx, y + dy);
      m.lowerTiles[i] = tile; bridgeCells.add(i);
    }
    access.push({ role: "bridge-west", x: x - 1, y }, { role: "bridge-east", x: x + w, y });
    bridges.push({ x, y, w, h: 2 });
  }
  if (spec.cave) {
    const [x, y] = spec.cave;
    assert(cliffPlan.cliff.has(point(x, y)), "Cave must sit on a cliff face");
    m.upperTiles[point(x, y)] = cliff[413];
    const c = cliffPlan.columns.find((k) => k.x === x && y > k.y && y <= k.y + k.height);
    access.push({ role: "cave-approach", x, y: c.y + c.height + 1 });
    reserve(x, y, 1, c.y + c.height + 2 - y, 2);
  }
  // Solid cells for road routing: water (not bridges), cliff faces (not stairs), cliff wings.
  const solid = new Set();
  for (let i = 0; i < W * H; i++) if ((water.has(i) && !bridgeCells.has(i)) || fallCells.has(i) || wings.has(i) || (cliffPlan.cliff.has(i) && !isStairTile(m.lowerTiles[i], cliff[374]))) solid.add(i);
  if (spec.cave) solid.add(point(...spec.cave));
  // Exits: 3 wide at the map edge, 5 deep.
  const exits = spec.exits.map((e, n) => {
    const edge = { west: [0, e.at], east: [W - 1, e.at], north: [e.at, 0], south: [e.at, H - 1] }[e.side];
    const inward = { west: [1, 0], east: [-1, 0], north: [0, 1], south: [0, -1] }[e.side];
    for (let depth = 0; depth < 5; depth++) for (let lane = -1; lane <= 1; lane++) {
      const x = edge[0] + inward[0] * depth + (inward[0] ? 0 : lane), y = edge[1] + inward[1] * depth + (inward[1] ? 0 : lane);
      assert(inside(x, y) && !solid.has(point(x, y)), `Exit corridor intersects terrain ${spec.id} ${x},${y}`);
      roads.add(point(x, y));
    }
    access.push({ role: "map-exit", exit: n, x: edge[0], y: edge[1] });
    return { ...e, x: edge[0], y: edge[1], inner: [edge[0] + inward[0] * 4, edge[1] + inward[1] * 4] };
  });
  const resolve = (p) => {
    if (Array.isArray(p)) return p;
    const [kind, n] = p.split(":");
    if (kind === "exit") return exits[+n].inner;
    if (kind === "stairs-top") return [stairs[+n].top.x, stairs[+n].top.y];
    if (kind === "stairs-bottom") return [stairs[+n].bottom.x, stairs[+n].bottom.y];
    if (kind === "bridge-west" || kind === "bridge-east") { const b = bridges[+n]; return kind === "bridge-west" ? [b.x - 1, b.y] : [b.x + b.w, b.y]; }
    if (kind === "cave") return [access.find((a) => a.role === "cave-approach").x, access.find((a) => a.role === "cave-approach").y];
    throw Error("Unknown waypoint " + p);
  };
  const route = (a, b) => {
    const start = point(...a), end = point(...b), dist = new Map([[start, 0]]), prev = new Map(), q = [start];
    const h = (i) => Math.abs(i % W - b[0]) + Math.abs(Math.floor(i / W) - b[1]);
    let found = false;
    while (q.length) {
      let best = 0;
      for (let k = 1; k < q.length; k++) if (dist.get(q[k]) + h(q[k]) < dist.get(q[best]) + h(q[best])) best = k;
      const at = q.splice(best, 1)[0];
      if (at === end) { found = true; break; }
      const x = at % W, y = Math.floor(at / W);
      for (const [dx, dy] of neighbors.slice(0, 4)) {
        const nx = x + dx, ny = y + dy, ni = point(nx, ny);
        if (!inside(nx, ny) || solid.has(ni)) continue;
        const cost = dist.get(at) + (roads.has(ni) ? 0.75 : 1) + 0.015 * ((nx * 13 + ny * 7) % 11);
        if (cost < (dist.get(ni) ?? Infinity)) { dist.set(ni, cost); prev.set(ni, at); if (!q.includes(ni)) q.push(ni); }
      }
    }
    if (!found) throw Error(`No route ${spec.id} ${a} → ${b}`);
    for (let i = end; i !== start; i = prev.get(i)) roads.add(i);
    roads.add(start);
  };
  for (const line of spec.spine) {
    const pts = line.map(resolve);
    for (let n = 1; n < pts.length; n++) route(pts[n - 1], pts[n]);
  }
  // Two-cell road like the villages: widen every centre cell east and south onto plain ground.
  for (const i of [...roads]) {
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const ni = point(x + dx, y + dy);
      if (inside(x + dx, y + dy) && !solid.has(ni) && m.lowerTiles[ni] === GROUND) roads.add(ni);
    }
  }
  const roadPaint = new Set([...roads].filter((i) => !isStairTile(m.lowerTiles[i], cliff[374]) && !bridgeCells.has(i)));
  paintGroup(roadPaint, roadGroup);
  for (const i of roads) reserve(i % W, Math.floor(i / W), 1, 1, 2);
  // Props: whole parts, beside the road, never on it.
  const free = (x, y, w, h) => Array.from({ length: w * h }, (_, k) => [x + k % w, y + Math.floor(k / w)])
    .every(([cx, cy]) => inside(cx, cy) && m.lowerTiles[point(cx, cy)] === GROUND && m.upperTiles[point(cx, cy)] === -1 && !roads.has(point(cx, cy)) && !solid.has(point(cx, cy)));
  for (const [name, x, y] of spec.props) {
    const p = partByName(name), upper = p.targetUpper.flat();
    assert(free(x, y, p.width, p.height), `Prop ${name} does not fit on bare ground ${spec.id} ${x},${y}`);
    upper.forEach((t, k) => { m.upperTiles[point(x + k % p.width, y + Math.floor(k / p.width))] = t; });
    reserve(x, y, p.width, p.height, 1);
    placements.push({ name, kind: "prop", x, y, w: p.width, h: p.height, upper });
  }
  // Forest, trees and dressing, then the checks. The trunk repair can retract a thin forest edge (a cliff wing, a
  // grove's bottom row); when a check fails the dressing is redrawn from the next noise seed — deterministic, and recorded.
  const before = { lower: [...m.lowerTiles], upper: [...m.upperTiles], reserved: [...reserved], placements: placements.length };
  const dress = (seed) => {
    const influence = (x, y, [cx, cy, rx, ry, strength]) => strength * Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
    const base = (x, y) => forest.forestContourScore(x, y, area, seed, COVERAGE)
      + spec.patches.reduce((v, p) => v + influence(x, y, p), 0) - spec.clearings.reduce((v, p) => v + influence(x, y, p), 0)
      + (wings.has(point(Math.floor(x), Math.floor(y))) ? 50 : 0)
      // Groves: a soft rise the contour noise cuts into, so an island's edge wanders instead of tracing a box.
      + (spec.groves ?? []).reduce((v, [cx, cy, rx, ry]) => v + 60 * Math.max(0, 1 - (Math.abs((x - cx) / rx) ** 2.2 + Math.abs((y - cy) / ry) ** 2.2) ** (1 / 2.2)), 0);
    // Small meadow pockets sealed inside the forest read as holes: fill them (no road, stair or water in them).
    const pocket = new Set(), openCell = (i) => reserved.has(i) || base(i % W + 0.5, Math.floor(i / W) + 0.5) <= 0;
    for (let start = 0, seen = new Set(); start < W * H; start++) {
      if (seen.has(start) || !openCell(start)) continue;
      const comp = [start]; seen.add(start);
      for (let k = 0; k < comp.length; k++) for (const [dx, dy] of neighbors.slice(0, 4)) {
        const x = comp[k] % W + dx, y = Math.floor(comp[k] / W) + dy, j = point(x, y);
        if (inside(x, y) && !seen.has(j) && openCell(j)) { seen.add(j); comp.push(j); }
      }
      if (comp.length < 80 && !comp.some((i) => reserved.has(i))) comp.forEach((i) => pocket.add(i));
    }
    const field = (x, y) => base(x, y) + (pocket.has(point(Math.floor(x), Math.floor(y))) ? 40 : 0);
    const grove = forest.paintContouredForest(m, area, groveGroup, (x, y) => m.lowerTiles[point(x, y)] === GROUND && m.upperTiles[point(x, y)] === -1 && !reserved.has(point(x, y)), seed, COVERAGE, undefined, field);
    // The trunk repair can leave a few bare cells sealed inside the canopy; close them into the canopy (same autotile).
    const canopy = new Set([...groveGroup.memberTileIds, ...Object.values(groveGroup.variantMap)]), isCanopy = (x, y) => inside(x, y) && canopy.has(m.upperTiles[point(x, y)]);
    const trunk = (t) => 1340 <= t && t < 1470;
    const bare = (i) => m.upperTiles[i] === -1 && (m.lowerTiles[i] === GROUND || trunk(m.lowerTiles[i])) && !reserved.has(i);
    const sealed = new Set();
    for (let start = 0, seen = new Set(); start < W * H; start++) {
      if (seen.has(start) || !bare(start)) continue;
      const comp = [start]; seen.add(start);
      let open = false;
      for (let k = 0; k < comp.length; k++) for (const [dx, dy] of neighbors.slice(0, 4)) {
        const x = comp[k] % W + dx, y = Math.floor(comp[k] / W) + dy, j = point(x, y);
        if (!inside(x, y)) continue;
        if (bare(j)) { if (!seen.has(j)) { seen.add(j); comp.push(j); } }
        else if (!isCanopy(x, y)) open = true;
      }
      if (!open && comp.length < 40) comp.forEach((i) => sealed.add(i));
    }
    for (const i of sealed) {
      m.upperTiles[i] = groveGroup.variantMap["255"]; m.lowerTiles[i] = GROUND;
      // The root row under the canopy above belonged to the trunks just buried: take it too.
      for (let j = i - W; j >= 0 && trunk(m.lowerTiles[j]) && canopy.has(m.upperTiles[j]); j -= W) m.lowerTiles[j] = GROUND;
    }
    for (const i of sealed) for (const [dx, dy] of [[0, 0], ...neighbors]) {
      const x = i % W + dx, y = Math.floor(i / W) + dy;
      if (!isCanopy(x, y)) continue;
      let mask = 0;
      neighbors.forEach(([ox, oy], bit) => { if (isCanopy(x + ox, y + oy)) mask |= 1 << bit; });
      m.upperTiles[point(x, y)] = groveGroup.variantMap[String(mask)];
    }
    // The filled pockets changed the depth of the canopy around them: re-pick the leaf interior (forestGrove.ts).
    forest.shadeForestCanopy(m, groveGroup);
    // Free-standing trees on open meadow, away from the road and each other.
    const random = rng(seed), planted = [];
    const spots = [];
    for (let y = 2; y < H - 6; y++) for (let x = 2; x < W - 5; x++) spots.push([x, y]);
    for (let tries = 0; planted.length < spec.trees && tries < 4000; tries++) {
      const [x, y] = spots[Math.floor(random() * spots.length)], t = TREES[Math.floor(random() * TREES.length)];
      const ring = Array.from({ length: (t.w + 2) * (t.h + 2) }, (_, k) => [x - 1 + k % (t.w + 2), y - 1 + Math.floor(k / (t.w + 2))]);
      if (!ring.every(([cx, cy]) => inside(cx, cy) && m.lowerTiles[point(cx, cy)] === GROUND && m.upperTiles[point(cx, cy)] === -1 && !reserved.has(point(cx, cy)))) continue;
      if (planted.some((p) => Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5)) continue;
      for (let k = 0; k < t.w * t.h; k++) { const i = point(x + k % t.w, y + Math.floor(k / t.w)); m.lowerTiles[i] = t.lower[k]; m.upperTiles[i] = t.upper[k]; }
      reserve(x, y, t.w, t.h, 1);
      const tree = { name: t.name, kind: "vegetation", x, y, w: t.w, h: t.h, lower: t.lower, upper: t.upper };
      planted.push(tree); placements.push(tree);
    }
    // Single-tile dressing on open meadow, kept off the road verge.
    for (const [tile, count] of Object.entries(spec.dressing ?? {})) {
      let placed = 0;
      for (let tries = 0; placed < count && tries < 3000; tries++) {
        const x = 2 + Math.floor(random() * (W - 4)), y = 2 + Math.floor(random() * (H - 4));
        const ring = Array.from({ length: 9 }, (_, k) => [x - 1 + k % 3, y - 1 + Math.floor(k / 3)]);
        if (!ring.every(([cx, cy]) => m.lowerTiles[point(cx, cy)] === GROUND && m.upperTiles[point(cx, cy)] === -1 && !reserved.has(point(cx, cy)))) continue;
        m.upperTiles[point(x, y)] = +tile;
        reserve(x, y, 1, 1, 1);
        placements.push({ name: DRESSING[tile], kind: "dressing", x, y, w: 1, h: 1, upper: [+tile] });
        placed++;
      }
    }
    // Checks with the runtime move rule: every exit, stair end, bridge end and the cave reach each other.
    const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
    const walk = (mm) => {
      const seen = new Set([point(...exits[0].inner)]), queue = [exits[0].inner];
      while (queue.length) {
        const [x, y] = queue.shift();
        for (const [dx, dy] of neighbors.slice(0, 4)) {
          const X = x + dx, Y = y + dy, k = point(X, Y);
          if (inside(X, Y) && !seen.has(k) && canMove({ ...project, maps: { [mm.id]: mm } }, mm, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
        }
      }
      return seen;
    };
    const seen = walk(m);
    const blocked = access.filter((a) => !seen.has(point(a.x, a.y)));
    assert.equal(blocked.length, 0, "Blocked " + spec.id + ": " + JSON.stringify(blocked));
    for (const o of placements.filter((p) => p.kind === "prop"))
      assert(Array.from({ length: o.w * o.h }, (_, k) => [o.x + k % o.w, o.y + Math.floor(k / o.w)]).some(([x, y]) => reach.isAdjacentOrOn(new Set([...seen].map((i) => `${i % W},${Math.floor(i / W)}`)), x, y)), "Prop out of reach " + o.name);
    // With every stair shut, the lowest tier must not leak onto a terrace (the cliff ends die into forest).
    let leaks = [];
    if (stairs.length) {
      const shut = structuredClone(m);
      for (const s of stairs) for (let yy = s.y; yy <= s.y + s.height; yy++) for (let xx = s.x; xx < s.x + 2; xx++) shut.lowerTiles[point(xx, yy)] = cliff[172];
      const low = walk(shut), rim = new Map(cliffColumns(spec.cliffs[0]).map((c) => [c.x, c.y]));
      leaks = [...low].filter((i) => { const x = i % W, y = Math.floor(i / W); return rim.has(x) && y < rim.get(x); }).slice(0, 6);
      // exits on a terrace are allowed to reach that terrace from their own edge, so only exit 0 is checked.
      assert.equal(leaks.length, 0, "Terrace reachable without stairs " + spec.id + " " + JSON.stringify(leaks.map((i) => [i % W, Math.floor(i / W)])));
    }
    return { grove, planted, seen, leaks, sealed: sealed.size };
  };
  let dressed, forestSeed;
  for (let attempt = 0; !dressed; attempt++) {
    forestSeed = spec.seed + attempt;
    m.lowerTiles = [...before.lower]; m.upperTiles = [...before.upper];
    reserved.clear(); before.reserved.forEach((i) => reserved.add(i)); placements.length = before.placements;
    try { dressed = dress(forestSeed); } catch (e) { if (!(e instanceof assert.AssertionError) || attempt >= 40) throw e; }
  }
  const { grove, planted, seen, leaks, sealed } = dressed;
  report.push({ id: spec.id, forestSeed, entry: exits[0].inner, targets: access.map((a) => [a.x, a.y]), reachable: seen.size, blocked: [], terraceLeaks: leaks.length, sealedPocketCells: sealed });
  maps[spec.id] = m;
  const { patches, clearings, spine, ...rest } = spec;
  plans.push({ ...rest, tilesetId: ts.id, entry: exits[0].inner, exits: exits.map(({ inner, ...e }) => e), access, stairs: stairs.map(({ top, bottom, ...s }) => s), bridges, falls,
    placements, forest: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns }, roadCells: roads.size, targets: access.map((a) => [a.x, a.y]) });
  console.log(spec.id, { exits: exits.length, stairs: stairs.length, bridges: bridges.length, trees: planted.length, forest: grove.canopyCells, reachable: seen.size });
}
// ── climate versions ──
const sheets = JSON.parse(fs.readFileSync("tiledata/climate-villages/sheets.json"));
const ice = new Map(sheets.snow.ice), WATER = new Set(sheets.volcano.lava);
await withTsModule("scripts/content/lib/climate-villages-entry.ts", "field-climates-entry.mjs", async (api) => {
  const tilesets = Object.fromEntries(["snow", "volcano", "desert", "autumn"].map((k) => [k, api.createClimateVillageTileset(k)]));
  for (const spec of CLIMATE_FIELDS.filter((p) => !process.env.FIELD_ONLY || p.from === process.env.FIELD_ONLY)) {
    const src = maps[spec.from], plan = plans.find((p) => p.id === spec.from), tileset = tilesets[spec.climate];
    const map = { ...structuredClone(src), id: spec.id, name: spec.name, tilesetId: tileset.id };
    const W = map.width, at = (x, y) => y * W + x, edits = [];
    const targets = plan.targets.map(([x, y]) => [x, y]);
    const keepClear = plan.access.map((a) => [a.x, a.y]);
    if (spec.freezePond !== undefined) {
      const [cx, cy, rx, ry] = PLANS.find((p) => p.id === spec.from).ponds[spec.freezePond];
      const cells = [];
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) cells.push(at(x, y));
      const frozen = freezeCells(map, cells, ice);
      assert(frozen > 20, "pond did not freeze " + spec.id);
      // Walk onto the ice: the frozen cell nearest the pond's centre and the one nearest the road.
      const iceCells = cells.filter((i) => map.lowerTiles[i] >= sheets.baseCount).map((i) => [i % W, Math.floor(i / W)]);
      const near = (p) => iceCells.slice().sort((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1]))[0];
      targets.push(near([cx, cy]), near(plan.entry));
      edits.push({ kind: "freeze", pond: [cx, cy, rx, ry], swappedTiles: frozen, rule: "물 칸 t → 얼음 칸 ice[t] (sheets.json snow.ice)" });
    }
    if (spec.peaks) edits.push(...placePeaks(map, spec.peaks, keepClear));
    if (spec.desert) {
      const wet = new Set();
      map.lowerTiles.forEach((t, i) => { if (WATER.has(t)) wet.add(i); });
      const dressed = dressDesert(map, { vegetation: plan.placements.filter((o) => o.kind === "vegetation"), water: wet, keepClear, seed: plan.seed, ...spec.desert });
      edits.push({ kind: "desert", replacedTrees: dressed.replaced, plants: dressed.edits.length, rule: "나무 덩이 → 발치에 야자(물 5칸 안)·선인장(큰 나무는 바위 하나 더), 물가 야자, 빈 모래밭 선인장" }, ...dressed.edits);
    }
    // Desert and ash ground (user 2026-09-25: 「돌·선인장·풀이 너무 많다」): loose rock and flower-shrub singles and (ash)
    // the leafy bushes of the forest field go, and the emptiness gate (field: ≤5, ≤50%) is met by the ground itself —
    // lava plates, cracks and a lava pool on ash; dunes, ripples, cracked earth, a mesa and a few cactus clumps on sand.
    if (spec.ground) {
      const PLAIN = new Set([240, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);
      let cleared = 0;
      for (let i = 0; i < map.upperTiles.length; i++) if (DRESSING[map.upperTiles[i]]) { map.upperTiles[i] = -1; cleared++; }
      if (spec.climate === "volcano") for (const o of plan.placements.filter((p) => p.kind === "vegetation")) {
        for (let k = 0; k < o.w * o.h; k++) {
          const i = at(o.x + k % o.w, o.y + Math.floor(k / o.w));
          if (map.lowerTiles[i] === o.lower[k] && map.upperTiles[i] === o.upper[k]) { if (o.lower[k] >= 0 && o.lower[k] !== 240) map.lowerTiles[i] = 240; map.upperTiles[i] = -1; cleared++; }
        }
      }
      const wet = new Set(); map.lowerTiles.forEach((t, i) => { if (WATER.has(t)) wet.add(i); });
      const ring = new Set(); for (const [x, y] of keepClear) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ring.add(at(x + dx, y + dy));
      const project = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
      const isPlain = (x, y) => map.upperTiles[at(x, y)] === -1 && PLAIN.has(map.lowerTiles[at(x, y)]);
      const accept = () => { const seen = reachable(api.canMove, project, map, plan.entry); return targets.every(([x, y]) => seen.has(at(x, y))); };
      // Desert (user 2026-09-25: 「사막치고 나무가 너무 많다」): the forest field's thicket walls go back to open sand and
      // leafless-tree groves stand on a few of the cleared spots (sparse: edge band every ~16 cells, inland every ~22). The
      // forest field's campfire (381) goes too — a lone fire in the open sand reads as a fire in the road.
      if (spec.bareForest) {
        const { cleared: bare } = clearLeafyTrees(map);
        for (let i = 0; i < map.upperTiles.length; i++) if (map.upperTiles[i] === 381) { map.upperTiles[i] = -1; cleared++; }
        const groves = arrangeBareGroves(map, { tileset, keep: keepClear, sites: bare, seed: plan.seed, accept, spacing: { band: 16, inner: 22 } });
        edits.push({ kind: "bare-trees", clearedCells: bare.size, groves: groves.groves.length, trees: groves.trees,
          rule: "숲 벽(잎 달린 수관) → 맨 모래; 잎 없는 나무 덩이 드문드문(가장자리 띠 16칸·안쪽 22칸 간격); 모닥불 381 제거" });
      }
      const opts = { kit: terrainKit(tileset), isPlain, take: (x, y) => !ring.has(at(x, y)), accept, seed: plan.seed, limits: { maxSq: 5, screen: 0.47 }, water: wet, ...(spec.groundOpts ?? {}) };
      const g = spec.ground === "volcano" ? dressVolcanoGround(map, opts) : dressDesertGround(map, opts);
      assert(g.maxSq <= 5 && g.screen <= 0.5, `ground gate ${spec.id} maxSq=${g.maxSq} screen=${g.screen.toFixed(3)}`);
      const kinds = {}; for (const p of g.pieces) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
      edits.push({ kind: "ground", clearedCells: cleared, pieces: kinds, cells: g.counts, emptiness: { maxSq: g.maxSq, screen: +g.screen.toFixed(3) },
        rule: spec.ground === "volcano"
          ? "흩은 바위·꽃 관목과 잎 달린 덤불을 걷고, 빈칸 게이트(필드 ≤5·≤50%)를 땅으로 넘긴다: 식은 용암 판·용암 균열·작은 용암 웅덩이(분기공·유황)·현무암 기둥 한 무리"
          : "흩은 바위·꽃 관목과 나무 자리 선인장을 두지 않고, 빈칸 게이트(필드 ≤5·≤50%)를 땅으로 넘긴다: 사구·모래 물결·갈라진 땅·메사·외딴 뼈 한 곳·선인장 무리 몇" });
    }
    if (spec.climate === "volcano") {
      const lava = map.lowerTiles.filter((t) => WATER.has(t)).length + map.upperTiles.filter((t) => WATER.has(t)).length;
      const bridges = map.lowerTiles.concat(map.upperTiles).filter((t) => sheets.volcano.stoneBridges.includes(t)).length;
      edits.push({ kind: "sheet", lavaCells: lava, basaltBridgeCells: bridges, rule: "물 칸은 시트에서 용암으로 칠해져 있다(번호·통행 그대로)" });
    }
    const seen = reachable(api.canMove, { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } }, map, plan.entry);
    const blocked = targets.filter(([x, y]) => !seen.has(at(x, y)));
    assert.equal(blocked.length, 0, "Blocked " + spec.id + ": " + JSON.stringify(blocked));
    report.push({ id: spec.id, entry: plan.entry, targets, reachable: seen.size, blocked });
    maps[spec.id] = map;
    const { meets, ...rest } = spec;
    // Desert trees were replaced by plants (recorded in edits), so they are no longer placements of this map.
    const placements = spec.desert || spec.ground ? plan.placements.filter((o) => o.kind !== "vegetation" && !(spec.ground && o.kind === "dressing")) : plan.placements;
    plans.push({ ...plan, ...rest, tilesetId: tileset.id, exits: plan.exits.map((e, n) => ({ ...e, meets: meets[n] })), placements, targets, edits });
    console.log(spec.id, { edits: edits.filter((e) => e.kind !== "desert-plant").map((e) => e.kind), reachable: seen.size });
  }
});
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ source: "tiledata/forest-villages/diverse/catalog.json", plans, maps }) + "\n");
fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
