// Map builder for tiledata/rpg-outdoors: the forest-village parts (cliff column grammar, stairs, river + waterfall +
// bridge, lake autotile, road autotile, contoured forest, whole tree stamps, whole houses/landmarks, whole props)
// driven by a small plan per map. Terrain and placement only — no events.
// Used by scripts/content/author-rpg-outdoors.mjs. Numbers are the diverse forest-village tileset's (forest_harmony +
// grafts 2550~2729); the climate sheets share them, so a plan runs unchanged on snow/volcano/desert/autumn.
import fs from "node:fs";
import assert from "node:assert/strict";
import { harborParts } from "./harbor-kit.mjs";
import { arrangeTallGrass } from "./tall-grass.mjs";
import { arrangeBareGroves, bareTreeStamps } from "./bare-trees.mjs";
import { cliffColumns, paintVillageCliffs } from "./village-cliffs.mjs";
import { dressDesertGround, dressVolcanoGround, terrainKit } from "./climate-terrain.mjs";
import { stairTile, isStairTile } from "./cliff-stairs.mjs";

export const GROUND = 240;
export const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
export const rng = (seed) => () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) | 0; return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296; };

// Single-cell and small pieces that are not in the part lists (all upper layer).
const EXTRA_PARTS = [
  ["돌 무더기", [[29]]], ["회백색 바위 더미", [[537]]], ["꽃 둥근 관목", [[768]]], ["덤불", [[289]]], ["들꽃", [[348]]], ["들꽃 무리", [[288]]],
  ["선인장", [[769]]], ["야자수", [[770]]], ["마법진", [[231]]], ["성 깃발", [[179], [209]]], ["벽 횃불", [[318]]], ["우물", [[382]]],
  ["큰 비석", [[414, 415, 416], [444, 445, 446], [474, 475, 476]]], ["천막", [[417, 418, 419], [447, 448, 449], [477, 478, 479]]],
  ["묘지 십자 비석", [[323]]], ["돌단", [[268, 269]]], ["팻말", [[440]]], ["벽보", [[320]]], ["사다리", [[322]]],
  ["침엽수", [[260], [290]], [[-1], [290]], [[260], [-1]]], ["마른나무", [[261], [291]], [[-1], [291]], [[261], [-1]]],
  ["활엽수 작은", [[262, 263], [292, 293]], [[-1, -1], [292, 293]], [[262, 263], [-1, -1]]],
  ["흙 무덤", [[259]]], ["우편함", [[350]]], ["화분 붉은", [[351]]], ["여관 간판", [[443]]],
];
// Walkable single-cell dressing (upper ★/passable): flowers, magic circle.
export const WALKABLE_UPPER = new Set([288, 348, 231, 179, 209]);
// Loose debris tiles (rock piles, dry sapling, skull, broken fence): only beside a cliff, shore, forest or built piece.
export const DEBRIS = new Set([29, 537, 740, 383, 410]);
// Props that stand on their own in the land (ruins, graves, dead trees, landforms, tents) — no owner needed.
const SELF_STANDING = new Set(["마른나무", "마른 묘목", "회백색 바위 더미", "돌 무더기", "흰 돌기둥", "돌 석상", "돌 오벨리스크", "마법진", "큰 비석",
  "흙 무덤", "묘비", "돌 십자가", "해골", "부서진 울타리", "천막", "낮은 돌 우물"]);
// Props whose reason is a road (lamps, signs) or water (fishing gear); the rest need a house, plaza, stall, pier, camp or well.
const ROADSIDE = new Set(["돌등", "나무 이정표", "표지판", "게시판", "벤치"]);
const WATERSIDE = new Set(["낚시 바구니", "징검돌"]);
const REASON_PROPS = new Set(["장터 노점", "과일 좌판", "모닥불", "천막", "낮은 돌 우물", "채소밭", "허수아비"]);

export function loadKit(api) {
  const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
  const ts = village.tileset;
  const parts = [...JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json")).props,
    ...JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json")).props]
    .filter((p) => p.name !== "과일 바구니")
    .map((p) => ({ name: p.name, w: p.width, h: p.height, upper: p.targetUpper }));
  for (const [name, upper, lower, upperOnly] of EXTRA_PARTS) {
    const h = upper.length, w = upper[0].length;
    // Two-layer pieces (trees): a lower row with grass backing under an upper crown.
    if (lower) parts.push({ name, w, h, upper: upperOnly, lower });
    else parts.push({ name, w, h, upper });
  }
  // Harbour pieces (rowboats, mooring posts, gear) of the shared harbor kit grafted into the forest tileset (lib/harbor-kit.mjs).
  parts.push(...harborParts(ts));
  // Whole houses cut from the approved diverse villages (template → first placement).
  const houses = {};
  for (const plan of village.plans) for (const h of plan.houses) {
    if (houses[h.template]) continue;
    const m = village.maps[plan.id], cut = (a) => Array.from({ length: h.w * h.h }, (_, k) => a[(h.y + Math.floor(k / h.w)) * m.width + h.x + k % h.w]);
    houses[h.template] = { template: h.template, label: h.label, w: h.w, h: h.h, lower: cut(m.lowerTiles), upper: cut(m.upperTiles),
      door: { x: h.doorAt.x - h.x, y: h.doorAt.y - h.y }, front: { x: h.front.x - h.x, y: h.front.y - h.y } };
  }
  const landmarks = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/landmarks.json"));
  const group = (id) => ts.autotileGroups.find((g) => g.id === id);
  // Sand patch autotile: the dirt block 360.. shifted three columns (363.. labelled Sand / Desert edge on the sheet).
  const dirt = group("builtin_dirt_road");
  const sand = { id: "oprn_outdoor_sand", variantMap: Object.fromEntries(Object.entries(dirt.variantMap).map(([k, v]) => [k, v + 3])) };
  const groups = { road: group("forest_harmony_road_47"), lake: group("forest_harmony_lake_47"), grove: group("forest_harmony_grove_47"),
    cobble: group("builtin_cobble"), stone: group("builtin_stone_court"), gravel: group("builtin_gravel_court"), farm: group("builtin_farmland"),
    tallGrass: group("builtin_tall_grass"), undergrowth: group("builtin_undergrowth"), darkDeep: group("builtin_darkness_deep"),
    darkness: group("builtin_darkness"), dirt, sand, snowPatch: group("builtin_snow") };
  const trees = {};
  for (const [id, x, w, h, cells] of [["big-oak", 14, 4, 5, ["CCCC", "CCCC", "CCCC", "eTTe", ".TT."]], ["tree", 18, 3, 4, ["CCC", "CCC", "eTe", "eTe"]],
    ["dark-tree", 21, 2, 4, ["CC", "CC", "TT", "TT"]], ["round-bush", 23, 3, 3, ["TTT", "TTT", "TTT"]], ["dark-bush", 26, 3, 3, ["TTT", "TTT", "TTT"]], ["small-bush", 23, 2, 2, ["TT", "TT"]]]) {
    const lower = [], upper = [];
    cells.forEach((row, dy) => [...row].forEach((c, dx) => {
      const t = 960 + (id === "small-bush" ? dy + 3 : dy) * 30 + x + dx;
      if (c === "C") { lower.push(GROUND); upper.push(t); } else if (c === ".") { lower.push(-1); upper.push(-1); } else { lower.push(t); upper.push(-1); }
    }));
    trees[id] = { id, w, h, lower, upper };
  }
  return { api, village, ts, parts, houses, landmarks, groups, trees, cliff: village.cliffBindings, riverTiles: village.riverTiles };
}

export const YARD_KITS = {
  herbs: { label: "약초 손질", parts: ["약초 화분", "씨앗 자루", "화분"] },
  laundry: { label: "빨래 말리기", parts: ["빨랫줄", "나무통", "화분"] },
  woodwork: { label: "목공", parts: ["장작 더미", "통나무 더미", "나무 상자", "가로 탁자"] },
  storage: { label: "창고", parts: ["나무 상자", "술통", "작은 오크통", "과일 상자"] },
  farm: { label: "농사", parts: ["채소밭", "채소밭", "허수아비", "씨앗 자루"] },
  fishing: { label: "고기잡이", parts: ["낚시 바구니", "나무통", "통나무 더미", "항아리"] },
  smith: { label: "대장일", parts: ["무기 거치대", "무기 거치대", "장작", "나무통"] },
  tavern: { label: "주막", parts: ["술통", "술통", "벤치", "가로 탁자"] },
  garden: { label: "꽃 가꾸기", parts: ["꽃 화단", "화분", "새집", "돌등"] },
  shop: { label: "가게", parts: ["과일 좌판", "나무 상자", "항아리", "표지판"] },
  guard: { label: "경비", parts: ["무기 거치대", "벽 횃불", "나무 상자", "술통"] },
  mine: { label: "광석 캐기", parts: ["돌 무더기", "회백색 바위 더미", "나무 상자", "장작"] },
  bees: { label: "벌치기", parts: ["새집", "꽃 화단", "항아리", "화분"] },
  desert: { label: "대추야자 손질", parts: ["항아리", "항아리", "과일 좌판", "나무통"] },
  nomad: { label: "유목 살림", parts: ["모닥불", "나무통", "장작", "항아리"] },
};

// Cut a rectangle from an approved reference map (both layers), blank an inner rectangle back to ground, then shrink it to
// w×h by dropping columns/rows that repeat their neighbour exactly (the middle of the longest identical run first) —
// the castle-town wall ring and gate are re-sized this way instead of being assembled by hand.
const REF_GRASS = new Set([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332]);
export function carveReference(file, [x0, y0, x1, y1], w, h, { blank = [], keepUpper = new Set() } = {}) {
  const ref = JSON.parse(fs.readFileSync(file)).map, W = ref.width;
  let cols = [];
  for (let x = x0; x <= x1; x++) {
    const col = [];
    for (let y = y0; y <= y1; y++) {
      const inBlank = blank.some(([bx0, by0, bx1, by1]) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1);
      const lo = ref.lowerTiles[y * W + x], up = ref.upperTiles[y * W + x];
      col.push(inBlank ? [-1, -1] : [REF_GRASS.has(lo) ? -1 : lo, REF_GRASS.has(lo) && !keepUpper.has(up) && up >= 0 && ![18, 19, 20, 78, 80, 108, 109, 110, 24, 25, 54, 55, 179, 209].includes(up) ? -1 : up]);
    }
    cols.push(col);
  }
  const same = (a, b) => a.length === b.length && a.every((c, k) => c[0] === b[k][0] && c[1] === b[k][1]);
  const shrink = (lines, target) => {
    while (lines.length > target) {
      let best = -1, bestLen = 0;
      for (let i = 0; i < lines.length;) {
        let j = i; while (j + 1 < lines.length && same(lines[j + 1], lines[i])) j++;
        if (j - i + 1 > bestLen && j > i) { bestLen = j - i + 1; best = i + ((j - i) >> 1); }
        i = j + 1;
      }
      assert(best >= 0, `Cannot shrink ${file} to ${target} (no repeated line)`);
      lines.splice(best, 1);
    }
    return lines;
  };
  cols = shrink(cols, w);
  let rows = cols[0].map((_, y) => cols.map((c) => c[y]));
  rows = shrink(rows, h);
  return { w, h, lower: rows.flat().map((c) => c[0]), upper: rows.flat().map((c) => c[1]) };
}

export class OutdoorMap {
  constructor(kit, spec, seed) {
    this.kit = kit; this.spec = spec; this.seed = seed ?? spec.seed;
    const W = this.W = spec.width, H = this.H = spec.height;
    this.ground = spec.ground ?? GROUND;
    this.map = { id: spec.id, name: spec.name, width: W, height: H, tileSize: 16, tilesetId: spec.tilesetId,
      lowerTiles: Array(W * H).fill(this.ground), upperTiles: Array(W * H).fill(-1), events: [] };
    this.lower = this.map.lowerTiles; this.upper = this.map.upperTiles;
    this.keep = new Set(); this.occupied = new Set(); this.solid = new Set();
    this.cliffCells = new Set(); this.cliffPlan = null; this.wings = new Set(); this.stairList = [];
    this.water = new Set(); this.edgeWet = new Set(); this.fallCells = new Set(); this.bridgeCells = new Set(); this.falls = [];
    this.dress = new Set(); this.plazaCells = new Set(); this.softKeep = new Set(); this.treeCells = new Set(); this.noRoad = new Set(); this.grassCells = new Set(); this.clusters = []; this.clusterOf = new Map();
    this.roads = new Set(); this.paved = new Map(); this.access = []; this.placements = []; this.houses = []; this.landmarks = []; this.exitList = [];
    this.random = rng(this.seed * 7919 + 13);
    this.log = { skipped: [] };
  }
  at(x, y) { return y * this.W + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  xy(i) { return [i % this.W, Math.floor(i / this.W)]; }
  reserve(x, y, w, h, pad = 0) {
    for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (this.inside(xx, yy)) this.keep.add(this.at(xx, yy));
  }
  bare(i) { return this.lower[i] === this.ground && this.upper[i] === -1; }
  freeRect(x, y, w, h, { keep = true, road = true, paved = false } = {}) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const X = x + dx, Y = y + dy, i = this.at(X, Y);
      if (!this.inside(X, Y)) return false;
      const onPaving = paved && this.paved.has(i) && this.upper[i] === -1 && this.paved.get(i) !== "tallGrass";
      if (!(this.bare(i) || onPaving) || this.occupied.has(i) || this.solid.has(i) || this.water.has(i) || (this.paved.has(i) && !onPaving)) return false;
      if (road && this.roads.has(i)) return false;
      if (keep && this.keep.has(i)) return false;
    }
    return true;
  }

  // ── terrain ──
  cliffs(profiles) {
    this.cliffProfiles = profiles;
    this.cliffPlan = paintVillageCliffs(this.map, profiles, this.kit.cliff);
    for (const i of this.cliffPlan.cliff) { this.cliffCells.add(i); this.keep.add(i); }
    for (const c of profiles) for (const side of ["left", "right"]) {
      if (c[side] === "open") continue;
      const [ex, ey] = side === "left" ? c.points[0] : c.points.at(-1);
      const room = side === "left" ? ex : this.W - 1 - ex, reach = room <= 6 ? room : (c[side + "Reach"] ?? 4);
      for (let y = Math.max(0, ey - 3); y <= Math.min(this.H - 1, ey + c.height + 1); y++) for (let d = 1; d <= reach; d++) {
        const x = side === "left" ? ex - d : ex + d;
        if (this.inside(x, y) && !this.cliffCells.has(this.at(x, y))) this.wings.add(this.at(x, y));
      }
    }
  }
  stairs(list) {
    const cliff = this.kit.cliff;
    for (const [x, y, height] of list) {
      for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) {
        const i = this.at(xx, yy);
        assert(this.cliffCells.has(i), `Stair must span the whole face ${this.spec.id} ${xx},${yy}`);
        this.lower[i] = stairTile(xx, x); this.upper[i] = -1;
      }
      this.reserve(x, y - 1, 2, height + 3, 1);
      const top = { x, y: y - 1 }, bottom = { x, y: y + height + 1 };
      this.access.push({ role: "stairs-top", ...top }, { role: "stairs-bottom", ...bottom });
      this.stairList.push({ x, y, height, top, bottom });
    }
  }
  cave(x, y) {
    const i = this.at(x, y), c = this.cliffPlan.columns.find((k) => k.x === x && y > k.y && y <= k.y + k.height);
    assert(this.cliffCells.has(i) && c, `Cave must sit on a cliff face ${this.spec.id} ${x},${y}`);
    this.upper[i] = this.kit.cliff[413];
    const approach = { x, y: c.y + c.height + 1 };
    this.access.push({ role: "cave-approach", ...approach });
    this.reserve(x, y, 1, c.y + c.height + 2 - y, 1);
    this.solid.add(i);
    return approach;
  }
  // Mine shaft cut into a cliff face: a w×h block of the darkness autotile (black hole, grey stone frame) replacing face
  // cells. The grafted cave mouth (413 → 2690) still carries the retro sheet's pink key colour, so it is not used.
  shaft(x, y, w = 2, h = 2) {
    const g = this.kit.groups.darkness, cells = new Set();
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const X = x + dx, Y = y + dy, i = this.at(X, Y), c = this.cliffPlan.columns.find((k) => k.x === X && Y >= k.y && Y <= k.y + k.height);
      assert(this.cliffCells.has(i) && c && Y > c.y && Y < c.y + c.height, `Shaft must sit inside a cliff face ${this.spec.id} ${X},${Y}`);
      cells.add(i);
    }
    for (const i of cells) {
      const [cx, cy] = this.xy(i);
      let mask = 0; N8.forEach(([dx, dy], b) => { if (cells.has(this.at(cx + dx, cy + dy))) mask |= 1 << b; });
      this.lower[i] = g.variantMap[String(mask)]; this.upper[i] = -1; this.solid.add(i);
    }
    const c = this.cliffPlan.columns.find((k) => k.x === x && y >= k.y && y <= k.y + k.height), foot = { x, y: c.y + c.height + 1 };
    this.access.push({ role: "shaft-foot", ...foot });
    this.reserve(x, c.y + c.height + 1, w, 2, 0);
    this.placements.push({ name: "갱도 입구", kind: "shaft", x, y, w, h });
    return foot;
  }
  // Castle gardens: the landmark's stone courts (lower 307, nothing on top) get garden pieces — flower beds, planters,
  // lamps, a fountain — until no court square larger than maxSq is left bare. The castle is solid, so this is dressing.
  decorateCourt(entry, items = ["꽃 화단", "꽃 화단", "화분", "돌등", "낮은 돌 우물"], { maxSq = 2, court = 307 } = {}) {
    const cells = new Set();
    for (let y = entry.y; y < entry.y + entry.h; y++) for (let x = entry.x; x < entry.x + entry.w; x++) { const i = this.at(x, y); if (this.lower[i] === court && this.upper[i] === -1) cells.add(i); }
    const empty = (i) => cells.has(i) && this.upper[i] === -1;
    let placed = 0;
    for (let step = 0; step < 400; step++) {
      const P = new Uint8Array(this.W * this.H); for (const i of cells) if (empty(i)) P[i] = 1;
      const e = this.emptiness(P);
      if (e.maxSq <= maxSq) break;
      let ok = false;
      for (let k = 0; k < 20 && !ok; k++) {
        const name = items[Math.floor(this.random() * items.length)], p = this.part(name);
        const x = e.at[0] + Math.floor(this.random() * Math.max(1, e.maxSq - p.w + 1)), y = e.at[1] + Math.floor(this.random() * Math.max(1, e.maxSq - p.h + 1));
        let fits = true;
        for (let dy = 0; dy < p.h && fits; dy++) for (let dx = 0; dx < p.w && fits; dx++) fits = empty(this.at(x + dx, y + dy)) && this.inside(x + dx, y + dy);
        if (!fits) continue;
        for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) { const up = p.upper[dy][dx]; if (up >= 0) this.upper[this.at(x + dx, y + dy)] = up; else this.upper[this.at(x + dx, y + dy)] = 289; }
        this.placements.push({ name, kind: "prop", x, y, w: p.w, h: p.h, owner: "성 정원", purpose: "성 안뜰 정원" });
        placed++; ok = true;
      }
      if (!ok) break;
    }
    return placed;
  }
  // The castle's flat grey palace roofs (49 "궁 지붕 돌판") read as bare courts from above. Every roof slab that sits
  // wholly inside the roof rim becomes an enclosed inner garden: grass, a hedge at the corners, flower bunches, planters
  // and — in the biggest one — a fountain. Drawn straight into the tiles (walled in, nobody walks there), so no placements.
  roofGardens(entry, { roof = 49 } = {}) {
    const inBox = (x, y) => x >= entry.x && y >= entry.y && x < entry.x + entry.w && y < entry.y + entry.h;
    const rim = new Set([18, 19, 20, 78, 80, 108, 109, 110, roof]);
    const garden = new Set();
    for (let y = entry.y; y < entry.y + entry.h; y++) for (let x = entry.x; x < entry.x + entry.w; x++) {
      if (this.upper[this.at(x, y)] !== roof) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) ok = inBox(x + dx, y + dy) && rim.has(this.upper[this.at(x + dx, y + dy)]);
      if (ok) garden.add(this.at(x, y));
    }
    // Group into rectangles-ish regions (4-connected).
    const regions = [], seen = new Set();
    for (const s of garden) {
      if (seen.has(s)) continue;
      const q = [s], cells = []; seen.add(s);
      while (q.length) { const i = q.pop(); cells.push(i); for (const j of [i - 1, i + 1, i - this.W, i + this.W]) if (garden.has(j) && !seen.has(j)) { seen.add(j); q.push(j); } }
      regions.push(cells);
    }
    regions.sort((a, b) => b.length - a.length);
    const set = (i, lo, up) => { this.lower[i] = lo; this.upper[i] = up; this.solid.add(i); this.occupied.add(i); this.keep.add(i); };
    const drawPart = (name, x, y) => { const p = this.part(name); for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) { const i = this.at(x + dx, y + dy); set(i, p.lower?.[dy][dx] ?? 240, p.upper[dy][dx]); } };
    const fits = (x, y, w, h, free) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!free.has(this.at(x + dx, y + dy))) return false; return true; };
    let drawn = 0;
    regions.forEach((cells, n) => {
      const xs = cells.map((i) => i % this.W), ys = cells.map((i) => Math.floor(i / this.W));
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const free = new Set(cells);
      for (const i of cells) set(i, this.random() < 0.25 ? 1140 + Math.floor(this.random() * 8) : 240, -1);
      const take = (x, y, w, h) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) free.delete(this.at(x + dx, y + dy)); };
      // Fountain in the middle of the largest garden; planters flank it.
      const well = this.part("낮은 돌 우물"), cx = Math.round((x0 + x1 + 1 - well.w) / 2), cy = Math.round((y0 + y1 + 1 - well.h) / 2);
      if (n === 0 && fits(cx, cy, well.w, well.h, free)) { drawPart("낮은 돌 우물", cx, cy); take(cx - 1, cy, well.w + 2, well.h); }
      // Hedges in the four corners, flower bunches along the long sides, a planter pair.
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) if (free.has(this.at(x, y))) { set(this.at(x, y), 240, 289); free.delete(this.at(x, y)); }
      for (let x = x0 + 1; x < x1; x += 2) for (const y of [y0, y1]) if (free.has(this.at(x, y)) && this.random() < 0.7) { set(this.at(x, y), 240, 348); free.delete(this.at(x, y)); }
      const pot = this.part("화분");
      for (const x of [x0 + 1, x1 - pot.w]) { const y = Math.round((y0 + y1) / 2); if (y > y0 && y < y1 && fits(x, y, pot.w, pot.h, free)) { drawPart("화분", x, y); take(x, y, pot.w, pot.h); } }
      drawn++;
    });
    this.log.gardens = (this.log.gardens ?? 0) + drawn;
    return drawn;
  }
  // Watered garden plots (tilled farmland with a vegetable bed or two) on open ground within `near` cells of water —
  // the gardens an oasis or a riverside hamlet lives on. Each plot keeps a one-cell walkway ring.
  gardenPlots(count, { near = 6, sizes = [[5, 3], [4, 3], [6, 2], [4, 2]], owner = "물가 밭", scarecrow = true } = {}) {
    const ok = (i) => { const [x, y] = this.xy(i); return this.inside(x, y) && this.bare(i) && !this.keep.has(i) && !this.occupied.has(i) && !this.roads.has(i) && !this.water.has(i); };
    const access = new Set(); for (const a of this.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) access.add(this.at(a.x + dx, a.y + dy));
    let made = 0;
    for (let tries = 0; made < count && tries < 3000; tries++) {
      const [w, h] = sizes[Math.floor(this.random() * sizes.length)];
      const x = 1 + Math.floor(this.random() * (this.W - w - 2)), y = 1 + Math.floor(this.random() * (this.H - h - 2));
      let fits = true;
      for (let dy = -1; dy <= h && fits; dy++) for (let dx = -1; dx <= w && fits; dx++) { const i = this.at(x + dx, y + dy); fits = ok(i) && !access.has(i); }
      if (!fits || !this.nearWater(x + (w >> 1), y + (h >> 1), near)) continue;
      const cells = this.rectCells(x, y, w, h);
      this.pave(cells, "farm");
      for (const i of cells) this.occupied.add(i);
      this.placements.push({ name: owner, kind: "paving", group: "farm", cells: cells.length, x, y, w, h });
      const bed = this.part("채소밭");
      for (let bx = x; bx + bed.w <= x + w; bx += bed.w + (this.random() < 0.5 ? 1 : 0)) if (h >= bed.h && this.random() < 0.8) {
        for (let dy = 0; dy < bed.h; dy++) for (let dx = 0; dx < bed.w; dx++) this.upper[this.at(bx + dx, y + dy)] = bed.upper[dy][dx];
      }
      this.reserve(x, y, w, h, 1);
      made++;
    }
    return made;
  }
  // Collapse a placed house: the roof falls in (its cells become rubble ground — rock piles and broken timbers heaped
  // along the wall, grass between), and the front wall keeps its door but loses a stretch at one or both ends.
  ruin(entry, { rubble = [29, 537, 29, 410], share = 0.45 } = {}) {
    const h = this.kit.houses[entry.template], wallTop = entry.door.y - 1, doorX = entry.door.x;
    const roof = new Set();
    for (let y = entry.y; y < wallTop; y++) for (let x = entry.x; x < entry.x + entry.w; x++) {
      const i = this.at(x, y); roof.add(i);
      this.lower[i] = this.ground; this.upper[i] = -1; this.solid.delete(i);
    }
    // One or two heaps of fallen stone and timber against the inside of the wall, grass beyond them.
    for (let k = 0, heaps = 1 + (entry.w > 5 ? 1 : 0); k < heaps; k++) {
      const sx = entry.x + Math.floor(this.random() * entry.w), seedCell = this.at(sx, wallTop - 1);
      const cells = this.blob(sx, wallTop - 1, Math.round(roof.size * share / heaps), (j) => roof.has(j) && this.upper[j] === -1);
      if (!roof.has(seedCell)) continue;
      for (const c of cells) { this.upper[c] = rubble[Math.floor(this.random() * rubble.length)]; this.solid.add(c); }
    }
    // Broken wall ends: one to two columns of the wall (never the door column or its neighbours) fall to rubble.
    const ends = [entry.x, entry.x + entry.w - 1].filter((x) => Math.abs(x - doorX) > 1);
    for (const x of ends) {
      if (this.random() < 0.35) continue;
      for (let y = wallTop; y <= entry.door.y; y++) { const i = this.at(x, y); this.lower[i] = this.ground; this.upper[i] = y === entry.door.y ? rubble[0] : -1; if (y === entry.door.y) this.solid.add(i); else this.solid.delete(i); }
    }
    entry.ruined = true; entry.label = "무너진 집 · " + entry.label;
    this.placements.push({ name: "무너진 집", kind: "piece", x: entry.x, y: entry.y, w: entry.w, h: entry.h });
    return entry;
  }
  // Cliff dwelling: a house's front wall with its door (template rows door-1..door, three or five columns round the
  // door) set into the foot of a cliff face, so the house is dug into the rock and has a real door at the cliff toe.
  cliffHouse(template, x, { role = "절벽 집", wide = false, cliffY } = {}) {
    const h = this.kit.houses[template], half = wide ? 2 : 1, w = half * 2 + 1, rows = 3;
    const col = (X) => this.cliffPlan.columns.find((k) => k.x === X && (cliffY === undefined || (cliffY >= k.y && cliffY <= k.y + k.height)));
    const cs = Array.from({ length: w }, (_, k) => col(x + k));
    assert(cs.every(Boolean) && cs.every((c) => c.y + c.height === cs[0].y + cs[0].height), `Cliff house needs an even cliff face ${this.spec.id} ${x}`);
    const bottom = cs[0].y + cs[0].height;
    // Three rows: the eave above the wall, the wall, the door row.
    for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < w; dx++) {
      const k = (h.door.y - rows + 1 + dy) * h.w + h.door.x - half + dx, i = this.at(x + dx, bottom - rows + 1 + dy);
      assert(this.cliffCells.has(i), `Cliff house off the cliff face ${this.spec.id} ${x + dx},${bottom - rows + 1 + dy}`);
      this.lower[i] = h.lower[k]; this.upper[i] = h.upper[k]; this.solid.add(i); this.occupied.add(i);
    }
    const door = { x: x + half, y: bottom }, front = { x: x + half, y: bottom + 1 };
    this.access.push({ role: "door-front", ...front });
    this.reserve(front.x, front.y, 1, 2, 0);
    const entry = { id: `${this.spec.id}-cliff-house-${this.houses.length + 1}`, template, label: "절벽 집 · " + h.label, role, yard: null, x, y: bottom - rows + 1, w, h: rows, door, front, cliff: true };
    this.houses.push(entry);
    return entry;
  }
  river({ width, points, pools = [] }) {
    const river = new Set();
    for (let n = 0; n < points.length - 1; n++) {
      const [x0, y0] = points[n], [x1, y1] = points[n + 1], steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4;
      for (let k = 0; k <= steps; k++) {
        const cx = x0 + (x1 - x0) * k / steps, cy = Math.round(y0 + (y1 - y0) * k / steps), left = Math.round(cx - width / 2);
        for (let d = 0; d < width; d++) if (this.inside(left + d, cy)) river.add(this.at(left + d, cy));
      }
    }
    // Pools bulge to one side with a wobbling rim (a plain ellipse centred on the channel reads as a cross).
    for (const [cx, cy, rx, ry] of pools) {
      const ph = this.random() * 6.28, ph2 = this.random() * 6.28;
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const t = Math.atan2((y - cy) / ry, (x - cx) / rx), r = 1 + 0.22 * Math.sin(t * 2 + ph) + 0.12 * Math.sin(t * 3 + ph2);
        if (this.inside(x, y) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r && !this.cliffCells.has(this.at(x, y))) river.add(this.at(x, y));
      }
    }
    for (const i of river) {
      const [x, y] = this.xy(i);
      assert(!isStairTile(this.lower[i], this.kit.cliff[374]), "River runs over a stair " + this.spec.id);
      this.edgeWet.add(i);
      if (!this.cliffCells.has(i)) { this.water.add(i); continue; }
      const c = this.cliffPlan.columns.find((k) => k.x === x && y >= k.y && y <= k.y + k.height);
      this.upper[i] = -1;
      if (y === c.y) { this.water.add(i); this.falls.push({ x, y: c.y, height: c.height, tile: this.kit.riverTiles.fall }); }
      else { this.lower[i] = this.kit.riverTiles.fall; this.fallCells.add(i); }
    }
  }
  // Irregular pond: an ellipse whose rim wobbles with a seeded angle term (never a clean oval).
  pond(cx, cy, rx, ry, wobble = 0.16) {
    // Ellipse with a wobbling rim (two angular harmonics) plus fine value noise so banks bend instead of stepping.
    const ph = this.random() * 6.28, ph2 = this.random() * 6.28, seed = Math.floor(this.random() * 1e6);
    const hash = (a, b) => { let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff * 2 - 1; };
    const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, l = (a, b, t) => a + (b - a) * t;
      return l(l(hash(ix, iy), hash(ix + 1, iy), tx), l(hash(ix, iy + 1), hash(ix + 1, iy + 1), tx), ty); };
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (!this.inside(x, y) || this.cliffCells.has(this.at(x, y))) continue;
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx), r = 1 + wobble * Math.sin(a * 3 + ph) + wobble * 0.6 * Math.sin(a * 5 + ph2) + 0.12 * noise(x / 2.3, y / 2.3);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < r * r) this.water.add(this.at(x, y));
    }
  }
  // Sea/lake region given by a predicate; `edge` keeps the water flowing past the map edge (no bank there).
  waterWhere(fn, edge = true) {
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const i = this.at(x, y);
      if (fn(x, y) && !this.cliffCells.has(i)) { this.water.add(i); if (edge) this.edgeWet.add(i); }
    }
  }
  unwater(fn) { for (const i of [...this.water]) if (fn(...this.xy(i))) { this.water.delete(i); this.edgeWet.delete(i); } }
  smoothWater() {
    // One-cell spurs and pinholes read as noise on the lake autotile: trim/fill until stable.
    for (let changed = true, n = 0; changed && n < 8; n++) {
      changed = false;
      for (let i = 0; i < this.W * this.H; i++) {
        const [x, y] = this.xy(i), wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.inside(x + dx, y + dy) ? this.water.has(this.at(x + dx, y + dy)) : this.edgeWet.has(i)).length;
        if (this.water.has(i) && wet < 2 && !this.fallCells.has(i)) { this.water.delete(i); this.edgeWet.delete(i); changed = true; }
        else if (!this.water.has(i) && wet >= 4 && !this.cliffCells.has(i) && this.bare(i)) { this.water.add(i); changed = true; }
      }
    }
  }
  paintWater() {
    const g = this.kit.groups.lake, joined = new Set([...this.water, ...this.fallCells]);
    for (const i of this.water) {
      const [x, y] = this.xy(i);
      let mask = 0;
      N8.forEach(([dx, dy], b) => { if (this.inside(x + dx, y + dy) ? joined.has(this.at(x + dx, y + dy)) : this.edgeWet.has(i)) mask |= 1 << b; });
      this.lower[i] = g.variantMap[String(mask)];
      this.upper[i] = -1;
    }
    for (const i of [...this.water, ...this.fallCells]) { const [x, y] = this.xy(i); this.reserve(x, y, 1, 1, 1); }
  }
  bridges(list) {
    for (const [hint, y] of list) {
      const run = (yy) => { let a = hint, b = hint; assert(this.water.has(this.at(hint, yy)), `Bridge hint off the water ${this.spec.id} ${hint},${yy}`);
        while (this.water.has(this.at(a - 1, yy))) a--; while (this.water.has(this.at(b + 1, yy))) b++; return [a, b]; };
      const [x, end] = run(y), w = end - x + 1;
      assert.deepEqual(run(y + 1), [x, end], `Bridge rows differ ${this.spec.id} y=${y}`);
      for (let dx = 0; dx < w; dx++) for (const [dy, tile] of [[0, this.kit.riverTiles.bridgeTop], [1, this.kit.riverTiles.bridgeBottom]]) {
        const i = this.at(x + dx, y + dy); this.lower[i] = tile; this.bridgeCells.add(i);
      }
      this.access.push({ role: "bridge-west", x: x - 1, y }, { role: "bridge-east", x: x + w, y });
      this.placements.push({ name: "나무다리", kind: "bridge", x, y, w, h: 2 });
    }
  }
  // Vertical bridge (north-south over an east-west channel): plank columns of the same pieces.
  dock(x, y, w, h, role = "dock-end") {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = this.at(x + dx, y + dy);
      assert(this.water.has(i), `Dock off the water ${this.spec.id} ${x + dx},${y + dy}`);
      this.upper[i] = 199; this.bridgeCells.add(i);
    }
    this.placements.push({ name: "선착장", kind: "dock", x, y, w, h });
    const end = h > w ? { x, y: y + h - 1 } : { x: x + w - 1, y };
    this.access.push({ role, ...end });
    return end;
  }

  // Pier from a shore point: walk `dir` until water, then lay `len` plank cells (width 1 or 2) while it stays water.
  pier(x, y, dir, len, width = 1) {
    const [dx, dy] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[dir];
    let k = 0;
    while (this.inside(x, y) && !this.water.has(this.at(x, y)) && k++ < 40) { x += dx; y += dy; }
    assert(this.water.has(this.at(x, y)), `Pier never reaches water ${this.spec.id}`);
    let n = 0;
    for (; n < len; n++) {
      const cells = Array.from({ length: width }, (_, w) => [x + dx * n + (dx ? 0 : w), y + dy * n + (dy ? 0 : w)]);
      if (!cells.every(([X, Y]) => this.inside(X, Y) && this.water.has(this.at(X, Y)))) break;
    }
    assert(n >= 2, `Pier too short ${this.spec.id} ${x},${y}`);
    const w = dx ? n : width, h = dy ? n : width, ox = dx < 0 ? x - n + 1 : x, oy = dy < 0 ? y - n + 1 : y;
    const end = this.dock(ox, oy, w, h);
    const land = [x - dx, y - dy];
    this.access.push({ role: "pier-foot", x: land[0], y: land[1] });
    return { end, land };
  }
  peek(tag = "") { if (process.env.OUTDOOR_PEEK === this.spec.id) console.log(`── ${this.spec.id} ${tag}\n` + this.ascii()); }
  ascii() {
    const rows = [];
    for (let y = 0; y < this.H; y++) {
      let r = (y % 10) + " ";
      for (let x = 0; x < this.W; x++) {
        const i = this.at(x, y);
        r += this.water.has(i) ? (this.bridgeCells.has(i) ? "=" : "~") : this.fallCells.has(i) ? "|" : isStairTile(this.lower[i], this.kit.cliff[374]) ? "S" : this.cliffCells.has(i) ? "#"
          : this.roads.has(i) ? "+" : this.paved.has(i) ? ":" : this.solid.has(i) ? "X" : this.occupied.has(i) ? "o" : this.wings.has(i) ? "w" : this.isForest(i) ? "T" : this.keep.has(i) ? "," : ".";
      }
      rows.push(r);
    }
    return "  " + Array.from({ length: this.W }, (_, x) => x % 10).join("") + "\n" + rows.join("\n");
  }

  // ── structures ──
  house(template, x, y, opt = {}) {
    const h = this.kit.houses[template];
    assert(h, "Unknown house template " + template);
    for (let dy = 0; dy < h.h; dy++) for (let dx = 0; dx < h.w; dx++) {
      const i = this.at(x + dx, y + dy);
      assert(this.inside(x + dx, y + dy) && this.bare(i) && !this.water.has(i) && !this.occupied.has(i) && !this.paved.has(i), `House overlaps ${this.spec.id} t${template} ${x + dx},${y + dy}`);
      this.lower[i] = h.lower[dy * h.w + dx]; this.upper[i] = h.upper[dy * h.w + dx];
      this.occupied.add(i); this.solid.add(i);
    }
    const cells = Array.from({ length: h.w * h.h }, (_, k) => this.at(x + k % h.w, y + Math.floor(k / h.w)));
    const WINDOWS = new Set([84, 85, 86, 87, 88]);
    if (opt.window) for (const i of cells) if (WINDOWS.has(this.upper[i])) this.upper[i] = opt.window;
    const vines = [];
    if (opt.window === 88) {
      const WALLS = new Set([12, 13, 14, 15, 16, 17, 42, 43, 44, 45, 46, 47, 72, 73, 74, 75, 76, 77]);
      const col = cells.find((i) => WALLS.has(this.lower[i]) && this.upper[i] === -1 && WALLS.has(this.lower[i + this.W]) && this.upper[i + this.W] === -1 && Math.abs(i % this.W - (x + h.door.x)) > 1);
      if (col !== undefined) { this.upper[col] = 265; this.upper[col + this.W] = 295; vines.push(this.xy(col)); }
    }
    const front = { x: x + h.front.x, y: y + h.front.y };
    const entry = { id: `${this.spec.id}-house-${this.houses.length + 1}`, template, label: (opt.window === 88 ? "폐가 · " : "") + h.label, role: opt.role ?? "집",
      yard: opt.yard ?? null, yardSide: opt.side ?? null, x, y, w: h.w, h: h.h, door: { x: x + h.door.x, y: y + h.door.y }, front, window: opt.window ?? null, vines };
    this.houses.push(entry);
    this.reserve(x, y, h.w, h.h, 1);
    this.reserve(front.x, front.y, 1, 2, 0);
    this.access.push({ role: "door-front", ...front, house: entry.id });
    this.placements.push({ name: entry.label, kind: "house", x, y, w: h.w, h: h.h, role: entry.role, yard: entry.yard });
    return entry;
  }
  // The house at (x,y) or the nearest spot within `r` cells whose footprint + one-cell ring + two front rows are free.
  houseNear(template, x, y, opt = {}, r = 9) {
    const h = this.kit.houses[template], spots = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) spots.push([x + dx, y + dy, Math.abs(dx) + Math.abs(dy) * 1.2]);
    spots.sort((a, b) => a[2] - b[2]);
    for (const [X, Y] of spots) {
      if (!this.freeRect(X, Y, h.w, h.h, { keep: false })) continue;
      if (!this.freeRect(X - 1, Y - 1, h.w + 2, h.h + 3, { keep: false, road: false })) continue;
      if (this.houses.some((o) => X < o.x + o.w + 2 && X + h.w + 2 > o.x && Y < o.y + o.h + 2 && Y + h.h > o.y - 1)) continue;
      if (X !== x || Y !== y) this.log.skipped.push(`moved house t${template} ${x},${y}→${X},${Y}`);
      return this.house(template, X, Y, opt);
    }
    assert.fail(`No room for house t${template} near ${x},${y} ${this.spec.id}`);
  }
  landmark(kind, x, y) {
    const defs = this.kit.landmarks, b = defs.buildings[kind], yd = defs.yards[kind], def = b ?? yd;
    assert(def, "Unknown landmark " + kind);
    const id = `${this.spec.id}-${kind}-${this.landmarks.length + 1}`, at = (dx, dy) => this.at(x + dx, y + dy);
    for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) {
      const i = at(dx, dy);
      assert(this.inside(x + dx, y + dy) && this.bare(i) && !this.water.has(i) && !this.occupied.has(i), `Landmark overlaps ${id} ${x + dx},${y + dy}`);
    }
    const entry = { id, kind, label: def.label, x, y, w: def.w, h: def.h };
    if (b) {
      b.lower.forEach((t, k) => { this.lower[at(k % b.w, Math.floor(k / b.w))] = t; });
      b.upper.forEach((t, k) => { this.upper[at(k % b.w, Math.floor(k / b.w))] = t; });
      for (let k = 0; k < b.w * b.h; k++) { const i = at(k % b.w, Math.floor(k / b.w)); this.occupied.add(i); this.solid.add(i); }
      entry.doors = b.doors.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
      for (const d of entry.doors) this.access.push({ role: "landmark-door", x: d.x, y: d.y + 1, landmark: id });
      this.reserve(x, y, b.w, b.h, 1);
    } else {
      const [gx, gw] = yd.gate, bottom = yd.h - 1, pond = new Set();
      for (let dx = 0; dx < yd.w; dx++) {
        this.upper[at(dx, 0)] = dx === 0 ? 378 : dx === yd.w - 1 ? 380 : 379;
        if (dx < gx || dx >= gx + gw) this.upper[at(dx, bottom)] = dx === 0 ? 438 : dx === yd.w - 1 ? 410 : dx === yd.w - 2 ? 409 : 439;
      }
      for (let dy = 1; dy < bottom; dy++) { this.upper[at(0, dy)] = 408; this.upper[at(yd.w - 1, dy)] = 408; }
      if (yd.pond) {
        const [cx, cy, rx, ry] = yd.pond, [x0, y0, x1, y1] = yd.pondBounds, island = new Set(yd.island.map(([dx, dy]) => at(dx, dy)));
        for (let dy = y0; dy <= y1; dy++) for (let dx = x0; dx <= x1; dx++) if (((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 <= 1 + 0.14 * Math.sin(dx * 1.7 + dy * 2.3) && !island.has(at(dx, dy))) pond.add(at(dx, dy));
        for (let trimmed = true; trimmed;) { trimmed = false; for (const i of pond) if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => pond.has(i + ox + oy * this.W)).length < 2) { pond.delete(i); trimmed = true; } }
        const g = this.kit.groups.lake;
        for (const i of pond) { const [px, py] = this.xy(i); let mask = 0; N8.forEach(([ddx, ddy], bit) => { if (pond.has(this.at(px + ddx, py + ddy))) mask |= 1 << bit; }); this.lower[i] = g.variantMap[String(mask)]; this.solid.add(i); }
      }
      for (const [dx, dy, t] of yd.contents) this.upper[at(dx, dy)] = t;
      for (let k = 0; k < yd.w * yd.h; k++) { const i = at(k % yd.w, Math.floor(k / yd.w)); if (this.upper[i] !== -1) this.solid.add(i); this.occupied.add(i); }
      entry.gate = { x: x + gx, y: y + bottom, w: gw };
      this.access.push({ role: "yard-gate", x: x + gx, y: y + yd.h, landmark: id }, { role: "yard-inside", x: x + gx, y: y + bottom - 1, landmark: id });
      this.reserve(x, y, yd.w, yd.h + 1, 1);
    }
    this.landmarks.push(entry);
    this.placements.push({ name: def.label, kind: "landmark", x, y, w: def.w, h: def.h });
    return entry;
  }
  // A whole two-layer piece cut from an approved reference map (lower -1 = keep this map's ground).
  stampPiece(name, x, y, w, h, lower, upper, { walkable = [] } = {}) {
    const open = new Set(walkable);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = this.at(x + dx, y + dy), k = dy * w + dx;
      assert(this.inside(x + dx, y + dy), `Piece leaves the map ${name}`);
      if (lower[k] < 0 && upper[k] < 0) continue;
      this.keep.add(i);
      if (lower[k] >= 0) this.lower[i] = lower[k];
      this.upper[i] = upper[k];
      this.occupied.add(i);
      const pass = this.kit.ts.passability[this.upper[i] >= 0 ? this.upper[i] : this.lower[i]];
      if (!open.has(k) && !(pass && pass.up && pass.down)) this.solid.add(i);
    }
    this.placements.push({ name, kind: "piece", x, y, w, h });
  }
  // Gatehouse towers: the round wall tower of the castle-town wall end (2×8: top 24/25, body 138–143, base 54/55)
  // raised on both sides of a gate gap so the gate reads as a gatehouse (문루), not a hole in the wall.
  gateTowers(x, y, gapX, gapW, name = "관문 문루") {
    const TOWER = [[[21, 24], [412, 25]], [[138, -1], [139, -1]], [[140, -1], [141, -1]], [[140, -1], [141, -1]], [[140, -1], [141, -1]], [[142, -1], [143, -1]], [[140, -1], [141, -1]], [[81, 54], [81, 55]]];
    for (const tx of [gapX - 2, gapX + gapW]) for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = this.at(tx + dx, y + dy), [lo, up] = TOWER[dy][dx];
      this.lower[i] = lo; this.upper[i] = up; this.solid.add(i); this.occupied.add(i); this.keep.add(i); this.noRoad.add(i); this.paved.delete(i); this.roads.delete(i);
    }
    this.placements.push({ name, kind: "piece", x: gapX - 2, y, w: gapW + 4, h: 8 });
  }
  // A wooden stage (festival): deck body 222, north edge 230, west 228, east 229, front row 192 (↓ closed).
  stage(x, y, w, h, name = "축제 무대") {
    assert(this.freeRect(x, y, w, h, { keep: false, paved: true }), `Stage does not fit ${this.spec.id} ${x},${y}`);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = this.at(x + dx, y + dy);
      this.lower[i] = dy === h - 1 ? 192 : dy === 0 ? 230 : dx === 0 ? 228 : dx === w - 1 ? 229 : 222;
      this.paved.delete(i); this.plazaCells.delete(i); this.occupied.add(i); this.keep.add(i); this.noRoad.add(i);
    }
    this.placements.push({ name, kind: "stage", x, y, w, h });
  }
  // On a paved plaza the routed paths are only bookkeeping: hand the plaza cells back so pieces may stand there
  // (check() still proves every door and exit reachable).
  plazaUnroad() { for (const i of this.plazaCells) this.roads.delete(i); }
  // A boat moored on open water: every drawn cell must be water (not a pier); solid, recorded as a landform.
  moor(name, x, y, { purpose = "정박한 배" } = {}) {
    const p = this.part(name);
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) {
      if (p.upper[dy][dx] < 0) continue;
      const i = this.at(x + dx, y + dy);
      assert(this.inside(x + dx, y + dy) && this.water.has(i) && !this.bridgeCells.has(i) && this.upper[i] === -1, `Boat ${name} off the water ${this.spec.id} ${x},${y}`);
    }
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) {
      if (p.upper[dy][dx] < 0) continue;
      const i = this.at(x + dx, y + dy); this.upper[i] = p.upper[dy][dx]; this.solid.add(i); this.occupied.add(i);
    }
    this.placements.push({ name, kind: "boat", x, y, w: p.w, h: p.h, purpose });
  }
  // Mooring poles standing in the water beside a pier (cells given), skipped where something is already there.
  posts(cells) {
    let n = 0;
    for (const [x, y] of cells) { const i = this.at(x, y); if (!this.inside(x, y) || !this.water.has(i) || this.bridgeCells.has(i) || this.upper[i] !== -1) continue; this.put("계류 말뚝", x, y, { owner: "부두", purpose: "계류 말뚝", check: false }); n++; }
    return n;
  }
  // Paved area painted with one autotile group (cobble plaza, stone court, sand patch, farmland…).
  pave(cells, groupName, { walk = true, name } = {}) {
    const g = this.kit.groups[groupName], set = new Set(cells.filter((i) => !this.water.has(i) && !this.cliffCells.has(i)));
    for (const i of set) {
      const [x, y] = this.xy(i);
      let mask = 0;
      N8.forEach(([dx, dy], b) => { if (this.inside(x + dx, y + dy) ? set.has(this.at(x + dx, y + dy)) || this.paved.get(this.at(x + dx, y + dy)) === groupName : true) mask |= 1 << b; });
      this.lower[i] = g.variantMap[String(mask)];
      this.paved.set(i, groupName);
      this.keep.add(i);
      if (!walk) this.solid.add(i);
    }
    if (name) { this.placements.push({ name, kind: "paving", group: g.id, cells: set.size }); for (const i of set) this.plazaCells.add(i); }
    return set;
  }
  ellipseCells(cx, cy, rx, ry, wobble = 0) {
    const out = [], ph = this.random() * 6.28;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (!this.inside(x, y)) continue;
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx), r = 1 + wobble * Math.sin(a * 3 + ph);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r) out.push(this.at(x, y));
    }
    return out;
  }
  rectCells(x, y, w, h) { const out = []; for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.inside(x + dx, y + dy)) out.push(this.at(x + dx, y + dy)); return out; }

  // Freeze water into the snow sheet's walkable ice copies (tiledata/climate-villages/sheets.json snow.ice).
  freeze(fn = () => true) {
    const ice = new Map(JSON.parse(fs.readFileSync("tiledata/climate-villages/sheets.json")).snow.ice);
    let n = 0;
    for (const i of this.water) {
      if (!fn(...this.xy(i))) continue;
      for (const layer of [this.lower, this.upper]) if (ice.has(layer[i])) { layer[i] = ice.get(layer[i]); n++; }
      this.iced ??= new Set(); this.iced.add(i);
    }
    return n;
  }
  // Wooden fence ring (the lake village's yard grammar): 378·379·380 top, 408 sides, 438 … 439 … 409·410 bottom, gate gap.
  fenceRing(x, y, w, h, gateX, gateW = 2, name = "울타리") {
    const at = (dx, dy) => this.at(x + dx, y + dy), bottom = h - 1;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) assert(this.freeRect(x + dx, y + dy, 1, 1, { keep: false }), `Fence overlaps ${this.spec.id} ${x + dx},${y + dy}`);
    for (let dx = 0; dx < w; dx++) {
      this.upper[at(dx, 0)] = dx === 0 ? 378 : dx === w - 1 ? 380 : 379;
      if (dx < gateX || dx >= gateX + gateW) this.upper[at(dx, bottom)] = dx === 0 ? 438 : dx === w - 1 ? 410 : dx === w - 2 ? 409 : 439;
    }
    for (let dy = 1; dy < bottom; dy++) { this.upper[at(0, dy)] = 408; this.upper[at(w - 1, dy)] = 408; }
    for (let k = 0; k < w * h; k++) { const i = at(k % w, Math.floor(k / w)); if (this.upper[i] !== -1) { this.solid.add(i); this.occupied.add(i); } this.keep.add(i); }
    this.access.push({ role: "yard-gate", x: x + gateX, y: y + h }, { role: "yard-inside", x: x + gateX, y: y + bottom - 1 });
    this.placements.push({ name, kind: "fence", x, y, w, h, gate: { x: x + gateX, w: gateW } });
    return { inside: [x + 1, y + 1, w - 2, h - 2] };
  }

  // ── roads ──
  exits(list) {
    for (const [n, e] of list.entries()) {
      const edge = { west: [0, e.at], east: [this.W - 1, e.at], north: [e.at, 0], south: [e.at, this.H - 1] }[e.side];
      const inward = { west: [1, 0], east: [-1, 0], north: [0, 1], south: [0, -1] }[e.side];
      for (let depth = 0; depth < 5; depth++) for (let lane = -1; lane <= 1; lane++) {
        const x = edge[0] + inward[0] * depth + (inward[0] ? 0 : lane), y = edge[1] + inward[1] * depth + (inward[1] ? 0 : lane);
        const i = this.at(x, y);
        assert(this.inside(x, y) && !this.solid.has(i) && !this.water.has(i) && !this.cliffCells.has(i) && !this.wings.has(i), `Exit corridor intersects terrain ${this.spec.id} ${x},${y}`);
        this.roads.add(i);
      }
      this.access.push({ role: "map-exit", exit: n, x: edge[0], y: edge[1] });
      this.exitList.push({ ...e, x: edge[0], y: edge[1], inner: [edge[0] + inward[0] * 4, edge[1] + inward[1] * 4] });
    }
  }
  blockedForRoad(i) {
    return (this.water.has(i) && !this.bridgeCells.has(i)) || this.fallCells.has(i) || this.wings.has(i) || this.solid.has(i) || this.noRoad.has(i)
      || (this.cliffCells.has(i) && !isStairTile(this.lower[i], this.kit.cliff[374]));
  }
  resolve(p) {
    if (Array.isArray(p)) return p;
    const [kind, n] = p.split(":");
    if (kind === "exit") return this.exitList[+n].inner;
    const s = this.stairList[+n];
    if (kind === "stairs-top") return [s.top.x, s.top.y];
    if (kind === "stairs-bottom") return [s.bottom.x, s.bottom.y];
    const a = this.access.filter((q) => q.role === kind)[+n];
    assert(a, "Unknown waypoint " + p);
    return [a.x, a.y];
  }
  route(a, b, { into = this.roads } = {}) {
    const W = this.W, start = this.at(...a), end = this.at(...b), dist = new Map([[start, 0]]), prev = new Map(), q = [start];
    const h = (i) => Math.abs(i % W - b[0]) + Math.abs(Math.floor(i / W) - b[1]);
    let found = false;
    while (q.length) {
      let best = 0;
      for (let k = 1; k < q.length; k++) if (dist.get(q[k]) + h(q[k]) < dist.get(q[best]) + h(q[best])) best = k;
      const at = q.splice(best, 1)[0];
      if (at === end) { found = true; break; }
      const x = at % W, y = Math.floor(at / W);
      for (const [dx, dy] of N8.slice(0, 4)) {
        const nx = x + dx, ny = y + dy, ni = this.at(nx, ny);
        if (!this.inside(nx, ny) || (this.blockedForRoad(ni) && ni !== end)) continue;
        const cost = dist.get(at) + (into.has(ni) || this.paved.has(ni) ? 0.7 : 1) + 0.015 * ((nx * 13 + ny * 7) % 11) + (this.keep.has(ni) && !into.has(ni) ? 0.3 : 0);
        if (cost < (dist.get(ni) ?? Infinity)) { dist.set(ni, cost); prev.set(ni, at); if (!q.includes(ni)) q.push(ni); }
      }
    }
    if (!found) throw new assert.AssertionError({ message: `No route ${this.spec.id} ${a} → ${b}` });
    for (let i = end; i !== start; i = prev.get(i)) into.add(i);
    into.add(start);
  }
  spine(lines) { for (const line of lines) { const pts = line.map((p) => this.resolve(p)); for (let n = 1; n < pts.length; n++) this.route(pts[n - 1], pts[n]); } }
  // Join every door front and the listed access roles to the nearest road cell.
  connect(roles = ["door-front", "stairs-top", "stairs-bottom", "bridge-west", "bridge-east", "landmark-door", "yard-gate", "cave-approach"]) {
    for (const a of this.access.filter((q) => roles.includes(q.role))) {
      if (this.roads.has(this.at(a.x, a.y))) continue;
      let best = null, bd = Infinity;
      for (const i of this.roads) { const [x, y] = this.xy(i), d = Math.abs(x - a.x) + Math.abs(y - a.y); if (d < bd) { bd = d; best = [x, y]; } }
      if (best) this.route([a.x, a.y], best);
    }
  }
  paintRoads(groupName = "road", { widen = true } = {}) {
    if (widen) for (const i of [...this.roads]) {
      const [x, y] = this.xy(i);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const ni = this.at(x + dx, y + dy);
        if (this.inside(x + dx, y + dy) && !this.blockedForRoad(ni) && this.bare(ni) && !this.keepDoor(ni)) this.roads.add(ni);
      }
    }
    const g = this.kit.groups[groupName], paint = new Set([...this.roads].filter((i) => !isStairTile(this.lower[i], this.kit.cliff[374]) && !this.bridgeCells.has(i) && !this.paved.has(i) && !this.solid.has(i) && !this.occupied.has(i)));
    const join = new Set([...paint, ...[...this.paved.keys()].filter((i) => this.paved.get(i) === groupName)]);
    for (const i of paint) {
      const [x, y] = this.xy(i);
      let mask = 0;
      N8.forEach(([dx, dy], b) => { if (this.inside(x + dx, y + dy) ? join.has(this.at(x + dx, y + dy)) : this.exitList.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 2)) mask |= 1 << b; });
      this.lower[i] = g.variantMap[String(mask)];
    }
    for (const i of this.roads) { const [x, y] = this.xy(i); this.reserve(x, y, 1, 1, 1); }
  }
  keepDoor(i) { return this.houses.some((h) => { const [x, y] = this.xy(i); return y >= h.y && y < h.y + h.h && x >= h.x && x < h.x + h.w; }); }

  // ── props ──
  part(name) { const p = this.kit.parts.find((q) => q.name === name); assert(p, "Missing part " + name); return p; }
  put(name, x, y, { owner, purpose, check = true } = {}) {
    const p = this.part(name);
    if (check) assert(this.freeRect(x, y, p.w, p.h, { keep: false, paved: true }), `Prop ${name} does not fit ${this.spec.id} ${x},${y}`);
    for (let k = 0; k < p.w * p.h; k++) {
      const dx = k % p.w, dy = Math.floor(k / p.w), i = this.at(x + dx, y + dy);
      const up = p.upper[dy][dx], lo = p.lower?.[dy][dx];
      if (up >= 0) this.upper[i] = up;
      if (lo !== undefined && lo >= 0) this.lower[i] = lo;
      this.occupied.add(i);
      if (!WALKABLE_UPPER.has(up)) this.solid.add(i);
    }
    this.reserve(x, y, p.w, p.h, 1);
    const o = { name, kind: "prop", x, y, w: p.w, h: p.h, ...(owner ? { owner } : {}), ...(purpose ? { purpose } : {}) };
    this.placements.push(o);
    return o;
  }
  // Explicit props: the given spot, or the nearest free one within four cells (recorded when moved).
  props(list) {
    for (const [name, x, y, purpose, owner] of list) {
      const spots = [];
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) spots.push([x + dx, y + dy, Math.abs(dx) + Math.abs(dy) + (dy !== 0) * 0.1]);
      spots.sort((a, b) => a[2] - b[2]);
      const o = this.putFirst(name, spots.map(([a, c]) => [a, c]), { purpose, owner });
      assert(o, `Prop ${name} does not fit ${this.spec.id} near ${x},${y}`);
      if (o.x !== x || o.y !== y) this.log.skipped.push(`moved ${name} ${x},${y}→${o.x},${o.y}`);
    }
  }
  // Try a list of candidate spots for one piece; first free wins.
  putFirst(name, spots, opts) { const p = this.part(name); for (const [x, y] of spots) if (this.freeRect(x, y, p.w, p.h, { keep: false, paved: true }) && !this.nearDoor(x, y, p.w, p.h)) return this.put(name, x, y, opts); return null; }
  nearDoor(x, y, w, h) { return this.houses.some((hs) => x <= hs.front.x + 1 && x + w - 1 >= hs.front.x - 1 && y <= hs.front.y + 1 && y + h - 1 >= hs.front.y - 1); }
  // Purpose yards: the kit's pieces packed beside the house, beside its front wall first, never on the door line.
  yards() {
    for (const h of this.houses.filter((q) => q.yard)) {
      const kit = YARD_KITS[h.yard];
      assert(kit, "Unknown yard kit " + h.yard);
      const placed = [];
      for (const name of kit.parts) {
        const p = this.part(name), spots = [];
        const sides = h.yardSide === "left" ? ["left"] : h.yardSide === "right" ? ["right"] : h.yardSide === "front" ? ["front"] : ["right", "left", "front"];
        for (const side of sides) {
          if (side === "front") for (let dy = 1; dy <= 3; dy++) for (let dx = -2; dx < h.w + 2; dx++) spots.push([h.x + dx, h.y + h.h + dy - 1, Math.abs(dy) + Math.abs(dx - h.w / 2) * 0.3]);
          else for (let dx = 1; dx <= 4; dx++) for (let dy = -3; dy <= 1; dy++) {
            const x = side === "right" ? h.x + h.w + dx - 1 : h.x - dx - p.w + 1, y = h.y + h.h - 1 + dy - (p.h - 1);
            spots.push([x, y, dx + Math.abs(dy) * 0.5]);
          }
        }
        spots.sort((a, b) => a[2] - b[2]);
        const o = this.putFirst(name, spots.map(([x, y]) => [x, y]), { owner: h.id, purpose: kit.label });
        if (o) placed.push(o); else this.log.skipped.push(`${h.id} ${name}`);
      }
      h.yardPlaced = placed.map((o) => o.name);
    }
  }

  // ── vegetation ──
  forest({ bands = {}, blobs = [], clear = [], noise = 1, coverage = 0.9, seedShift = 0 } = {}) {
    const { api, groups } = this.kit, W = this.W, H = this.H, area = { x: 0, y: 0, w: W, h: H }, seed = this.seed + seedShift;
    const edge = (x, y) => {
      let v = -8;
      const d = { north: y, south: H - 1 - y, west: x, east: W - 1 - x };
      for (const [side, t] of Object.entries(bands)) { const [thick, amp = 2.5] = Array.isArray(t) ? t : [t]; v = Math.max(v, (thick - d[side]) * 3 + amp * 3 * Math.sin((side === "north" || side === "south" ? x : y) / 3.1 + this.seed)); }
      return v;
    };
    const infl = (x, y, [cx, cy, rx, ry, s = 12]) => s * Math.max(0, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
    const score = (x, y) => edge(x, y) + blobs.reduce((v, b) => v + infl(x, y, b), 0) - clear.reduce((v, b) => v + infl(x, y, b), 0)
      + noise * 4 * api.forestContourScore(x, y, area, seed, 0.5) / 10 + (this.wings.has(this.at(Math.floor(x), Math.floor(y))) ? 60 : 0);
    const free = (x, y) => this.bare(this.at(x, y)) && !this.keep.has(this.at(x, y)) && !this.occupied.has(this.at(x, y));
    const grove = api.paintContouredForest(this.map, area, groups.grove, free, seed, coverage, undefined, score);
    // Bare pockets sealed inside the canopy read as holes: close them (and the root row that hung above).
    const canopy = new Set(groups.grove.memberTileIds), isCanopy = (x, y) => this.inside(x, y) && canopy.has(this.upper[this.at(x, y)]);
    const trunk = (t) => 1340 <= t && t < 1470;
    const bare = (i) => this.upper[i] === -1 && (this.lower[i] === this.ground || trunk(this.lower[i])) && !this.keep.has(i) && !this.occupied.has(i);
    const sealed = new Set();
    for (let start = 0, seen = new Set(); start < W * H; start++) {
      if (seen.has(start) || !bare(start)) continue;
      const comp = [start]; seen.add(start); let open = false;
      for (let k = 0; k < comp.length; k++) for (const [dx, dy] of N8.slice(0, 4)) {
        const [cx, cy] = this.xy(comp[k]), x = cx + dx, y = cy + dy, j = this.at(x, y);
        if (!this.inside(x, y)) continue;
        if (bare(j)) { if (!seen.has(j)) { seen.add(j); comp.push(j); } } else if (!isCanopy(x, y)) open = true;
      }
      if (!open && comp.length < 40) comp.forEach((i) => sealed.add(i));
    }
    for (const i of sealed) {
      this.upper[i] = groups.grove.variantMap["255"]; this.lower[i] = this.ground;
      for (let j = i - W; j >= 0 && trunk(this.lower[j]) && canopy.has(this.upper[j]); j -= W) this.lower[j] = this.ground;
    }
    for (const i of sealed) for (const [dx, dy] of [[0, 0], ...N8]) {
      const [cx, cy] = this.xy(i), x = cx + dx, y = cy + dy;
      if (!isCanopy(x, y)) continue;
      let mask = 0; N8.forEach(([ox, oy], bit) => { if (isCanopy(x + ox, y + oy)) mask |= 1 << bit; });
      this.upper[this.at(x, y)] = groups.grove.variantMap[String(mask)];
    }
    // Closing pockets re-fitted edges: shade the canopy interior again (leaf fill, deterministic by position).
    if (sealed.size) api.shadeForestCanopy(this.map, groups.grove);
    this.forestReport = { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns, sealed: sealed.size };
    for (let i = 0; i < W * H; i++) if (canopy.has(this.upper[i]) || trunk(this.lower[i])) this.keep.add(i);
  }
  isForest(i) { const t = this.upper[i]; return (t >= 2550 && t <= 2607) || (this.lower[i] >= 1340 && this.lower[i] < 1470); }
  // loose: may stand on the pad another tree reserved (trees of one clump touch).
  stampTree(id, x, y, { ring = 1, loose = false } = {}) {
    if (id === "dark-bush") id = "round-bush"; // 986 family reads as a pit (FILL-RULES 금지 재료)
    const t = this.kit.trees[id];
    for (let dy = -ring; dy < t.h + ring; dy++) for (let dx = -ring; dx < t.w + ring; dx++) {
      const X = x + dx, Y = y + dy, i = this.at(X, Y);
      const own = dx >= 0 && dy >= 0 && dx < t.w && dy < t.h;
      if (!this.inside(X, Y)) return false;
      if (own && (!this.bare(i) || (this.keep.has(i) && !(loose && this.softKeep.has(i))) || this.occupied.has(i))) return false;
      if (!own && (this.occupied.has(i) || this.roads.has(i) || this.solid.has(i) || this.water.has(i) || this.isForest(i) || (this.upper[i] !== -1 && !WALKABLE_UPPER.has(this.upper[i])))) return false;
    }
    for (let k = 0; k < t.w * t.h; k++) {
      const i = this.at(x + k % t.w, y + Math.floor(k / t.w));
      if (t.lower[k] >= 0) this.lower[i] = t.lower[k];
      this.upper[i] = t.upper[k];
      if (t.lower[k] !== GROUND && t.lower[k] >= 0) this.solid.add(i);
      this.occupied.add(i); this.dress.add(i); this.treeCells.add(i);
    }
    for (let yy = y - 1; yy <= y + t.h; yy++) for (let xx = x - 1; xx <= x + t.w; xx++) if (this.inside(xx, yy) && !this.keep.has(this.at(xx, yy))) { this.keep.add(this.at(xx, yy)); this.softKeep.add(this.at(xx, yy)); }
    this.placements.push({ name: "나무 · " + id, kind: "vegetation", x, y, w: t.w, h: t.h, lower: t.lower, upper: t.upper });
    return true;
  }
  trees(list) { for (const [id, x, y] of list) if (!this.stampTree(id, x, y)) this.log.skipped.push(`tree ${id} ${x},${y}`); }
  // Irregular tree clumps standing in front of a straight forest edge (2-3 trees each, never a row).
  edgeClumps(count, kinds = ["tree", "big-oak", "round-bush", "small-bush"]) {
    let made = 0;
    const edgeCells = [];
    for (let i = 0; i < this.W * this.H; i++) {
      if (!this.bare(i) || this.keep.has(i)) continue;
      const [x, y] = this.xy(i);
      if (N8.slice(0, 4).some(([dx, dy]) => this.inside(x + dx, y + dy) && this.isForest(this.at(x + dx, y + dy)))) edgeCells.push([x, y]);
    }
    for (let tries = 0; made < count && tries < 400 && edgeCells.length; tries++) {
      const [x, y] = edgeCells[Math.floor(this.random() * edgeCells.length)];
      let n = 0;
      for (let k = 0; k < 3; k++) {
        const id = kinds[Math.floor(this.random() * kinds.length)], t = this.kit.trees[id];
        const ox = x + Math.round((this.random() - 0.5) * 6) - (t.w >> 1), oy = y + Math.round((this.random() - 0.5) * 4) - (t.h >> 1);
        if (this.stampTree(id, ox, oy, { ring: 0 })) n++;
      }
      if (n) made++;
    }
    return made;
  }
  scatterTrees(count, kinds, region = null) {
    let n = 0;
    for (let tries = 0; n < count && tries < 3000; tries++) {
      const id = kinds[Math.floor(this.random() * kinds.length)], t = this.kit.trees[id];
      const [rx, ry, rw, rh] = region ?? [1, 1, this.W - 2, this.H - 2];
      const x = rx + Math.floor(this.random() * (rw - t.w)), y = ry + Math.floor(this.random() * (rh - t.h));
      if (this.placements.some((p) => p.kind === "vegetation" && Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 4)) continue;
      if (this.stampTree(id, x, y)) n++;
    }
    return n;
  }
  // Ground variation: tall-grass clumps, flowers and bushes in threes (a small triangle, never a line), stones.
  clumpCells(x, y, size) {
    const cells = [this.at(x, y)], set = new Set(cells);
    for (let k = 0; cells.length < size && k < size * 12; k++) {
      const [cx, cy] = this.xy(cells[Math.floor(this.random() * cells.length)]), [dx, dy] = N8[Math.floor(this.random() * 4)];
      const X = cx + dx, Y = cy + dy, i = this.at(X, Y);
      if (this.inside(X, Y) && !set.has(i) && this.bare(i) && !this.keep.has(i) && !this.occupied.has(i)) { set.add(i); cells.push(i); }
    }
    return cells;
  }
  // Tall grass (E/F/G redraw, PR #1421): beds are laid as cells here (E placeholder art) and given their final type —
  // E by the forest, G by houses and roads, F in the open — by arrangeTallGrass at the end of fill(). Beds start from a
  // 2×2 core and grow compact so none is a one-cell band.
  grassBed(x, y, size, ok = (j) => this.bare(j) && !this.keep.has(j) && !this.occupied.has(j)) {
    const core = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [x + dx, y + dy]);
    if (!core.every(([X, Y]) => this.inside(X, Y) && ok(this.at(X, Y)))) return null;
    const cells = [...new Set([...core.map(([X, Y]) => this.at(X, Y)), ...this.blob(x, y, size, ok)])];
    this.pave(cells, "tallGrass");
    const id = this.clusters.length; this.clusters.push({ id, kind: "grass", group: "tallGrass", cells: new Set(cells) });
    for (const c of cells) { this.keep.delete(c); this.occupied.add(c); this.dress.add(c); this.clusterOf.set(c, id); this.grassCells.add(c); }
    this.placements.push({ name: "키 큰 풀 덤불", kind: "dressing", cluster: "grass", cells: cells.length, x, y });
    return cells;
  }
  tallGrass(count, [min, max] = [5, 12], region = null) {
    let n = 0;
    for (let tries = 0; n < count && tries < 2000; tries++) {
      const [rx, ry, rw, rh] = region ?? [2, 2, this.W - 4, this.H - 4];
      const x = rx + Math.floor(this.random() * rw), y = ry + Math.floor(this.random() * rh);
      if (this.grassBed(x, y, Math.max(6, min + Math.floor(this.random() * (max - min + 1))))) n++;
    }
    return n;
  }
  // Final tall-grass types (lib/tall-grass.mjs): drops bits smaller than 2×2, trims corners, one type per patch.
  arrangeGrass() {
    if (!this.grassCells.size) return null;
    const { lowerTiles, stats } = arrangeTallGrass(this.map, { tileset: this.spec.tileset, houses: this.houses, cells: this.grassCells, seed: this.seed });
    for (let i = 0; i < lowerTiles.length; i++) if (lowerTiles[i] !== this.lower[i]) {
      if (this.grassCells.has(i) && lowerTiles[i] === this.ground) { this.grassCells.delete(i); this.dress.delete(i); this.occupied.delete(i); this.paved.delete(i); }
      this.lower[i] = lowerTiles[i];
    }
    this.grassReport = stats;
    return stats;
  }
  threes(tile, count, region = null, spread = 1) {
    let n = 0;
    const shapes = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 1], [-1, 1]], [[0, 0], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [-1, 1], [1, 2]]];
    for (let tries = 0; n < count && tries < 3000; tries++) {
      const [rx, ry, rw, rh] = region ?? [2, 2, this.W - 4, this.H - 4];
      const x = rx + Math.floor(this.random() * rw), y = ry + Math.floor(this.random() * rh);
      const shape = shapes[Math.floor(this.random() * shapes.length)].map(([dx, dy]) => [x + dx * spread, y + dy * spread]);
      const ok = shape.every(([X, Y]) => this.inside(X, Y) && this.bare(this.at(X, Y)) && !this.keep.has(this.at(X, Y)) && !this.occupied.has(this.at(X, Y)));
      if (!ok) continue;
      const tiles = Array.isArray(tile) ? tile : [tile];
      if (tiles.some((t) => DEBRIS.has(t)) && !this.debrisAnchor(x, y)) continue;
      shape.forEach(([X, Y], k) => {
        const t = tiles[k % tiles.length], i = this.at(X, Y);
        this.upper[i] = t; this.occupied.add(i); this.dress.add(i); if (!WALKABLE_UPPER.has(t)) { this.solid.add(i); this.keep.add(i); }
      });
      this.placements.push({ name: "셋 묶음 " + tiles.join("/"), kind: "dressing", x, y, cells: shape });
      // Walkable threes (flowers) are seeds of flower drifts the fill may grow.
      if (tiles.every((t) => WALKABLE_UPPER.has(t))) { const id = this.clusters.length, cs = shape.map(([X, Y]) => this.at(X, Y)); this.clusters.push({ id, kind: "flowers", group: null, cells: new Set(cs), tiles }); cs.forEach((c) => this.clusterOf.set(c, id)); }
      n++;
    }
    return n;
  }
  singles(tile, count, region = null) {
    let n = 0;
    for (let tries = 0; n < count && tries < 2000; tries++) {
      const [rx, ry, rw, rh] = region ?? [2, 2, this.W - 4, this.H - 4];
      const x = rx + Math.floor(this.random() * rw), y = ry + Math.floor(this.random() * rh);
      const ring = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => this.at(x + dx, y + dy)));
      if (!ring.every((i) => this.bare(i) && !this.keep.has(i) && !this.occupied.has(i))) continue;
      if (DEBRIS.has(tile) && !this.debrisAnchor(x, y)) continue;
      const i = this.at(x, y);
      this.upper[i] = tile; this.occupied.add(i); this.dress.add(i);this.reserve(x, y, 1, 1, 1);
      if (!WALKABLE_UPPER.has(tile)) this.solid.add(i);
      this.placements.push({ name: "장식 " + tile, kind: "dressing", x, y, w: 1, h: 1 });
      n++;
    }
    return n;
  }

  // Single upper pieces (palms, cacti) on cells passing `pred`, one bare ring round each, `gap` apart.
  singlesWhere(tile, count, pred, gap = 3, { shore = false } = {}) {
    const spots = [];
    for (let y = 1; y < this.H - 1; y++) for (let x = 1; x < this.W - 1; x++) if (pred(x, y)) spots.push([x, y]);
    let n = 0;
    for (let k = 0; k < spots.length * 3 && n < count; k++) {
      const [x, y] = spots[Math.floor(this.random() * spots.length)];
      const ring = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => this.at(x + dx, y + dy)));
      if (!this.bare(this.at(x, y)) || (this.keep.has(this.at(x, y)) && !shore) || this.occupied.has(this.at(x, y))) continue;
      if (!ring.every((i) => !this.occupied.has(i) && !this.roads.has(i) && (!this.solid.has(i) || this.water.has(i)))) continue;
      if (this.placements.some((p) => p.kind === "dressing" && p.tile === tile && Math.abs(p.x - x) + Math.abs(p.y - y) < gap)) continue;
      const i = this.at(x, y);
      this.upper[i] = tile; this.occupied.add(i); this.dress.add(i);this.solid.add(i); this.reserve(x, y, 1, 1, 1);
      this.placements.push({ name: "장식 " + tile, kind: "dressing", tile, x, y, w: 1, h: 1 });
      n++;
    }
    return n;
  }
  // Rocks, twigs and bones lie where they come from — a cliff foot, a shore, a forest edge or beside a built piece —
  // never strewn evenly over open ground (FILL-RULES 금지 배치).
  debrisAnchor(x, y, r = 2) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy, j = this.at(X, Y);
      if (!this.inside(X, Y)) continue;
      if (this.cliffCells.has(j) || this.water.has(j) || this.isForest(j) || (this.occupied.has(j) && !this.dress.has(j) && this.upper[j] !== -1)) return true;
    }
    return false;
  }
  nearWater(x, y, r) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.water.has(this.at(x + dx, y + dy)) && this.inside(x + dx, y + dy)) return true; return false; }
  // Volcanic peaks already on the climate sheets (4×2, upper, solid): dormant 858/859/888/889, erupting 918/919/948/949.
  peaks(list) {
    const PEAK = [[858, 859, 918, 919], [888, 889, 948, 949]];
    for (const [x0, y0, soft] of list) {
      // A soft peak (third item true) moves up to 3 cells to fit, or is skipped (logged); a plain one must fit.
      let x = x0, y = y0;
      if (soft && !this.freeRect(x, y, 4, 2)) {
        const near = [];
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (this.freeRect(x0 + dx, y0 + dy, 4, 2)) near.push([dx * dx + dy * dy, x0 + dx, y0 + dy]);
        near.sort((a, b) => a[0] - b[0]);
        if (!near.length) { this.log.skipped.push(`peak ${x0},${y0}`); continue; }
        [, x, y] = near[0];
        this.log.skipped.push(`moved peak ${x0},${y0}→${x},${y}`);
      }
      assert(this.freeRect(x, y, 4, 2), `Peak does not fit ${this.spec.id} ${x},${y}`);
      PEAK.forEach((r, dy) => r.forEach((t, dx) => { const i = this.at(x + dx, y + dy); this.upper[i] = t; this.occupied.add(i); this.solid.add(i); }));
      this.reserve(x, y, 4, 2, 1);
      this.placements.push({ name: "화산 봉우리", kind: "landform", x, y, w: 4, h: 2 });
    }
  }  // Mud puddles by the ponds (swamps): small convex ellipses only — the dirt autotile has no inner corners, so a ragged
  // rim reads as stair steps. Kept off roads, doors and yards, one bare cell from other dressing.
  mudPools(count, { rx = [2.6, 4.2], ry = [1.8, 2.8], near = 4, group = "road" } = {}) {
    const doors = new Set();
    for (const a of this.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) doors.add(this.at(a.x + dx, a.y + dy));
    let n = 0;
    for (let tries = 0; n < count && tries < 600; tries++) {
      const cx = 2 + this.random() * (this.W - 4), cy = 2 + this.random() * (this.H - 4);
      if (!this.nearWater(Math.round(cx), Math.round(cy), near)) continue;
      const a = rx[0] + this.random() * (rx[1] - rx[0]), b = ry[0] + this.random() * (ry[1] - ry[0]);
      // A wobbling ellipse, then smoothed: no one-cell spurs, notches filled — a soft blob, never a plus or a staircase.
      const ph = this.random() * 6.28, set0 = new Set();
      for (let y = Math.floor(cy - b - 1); y <= Math.ceil(cy + b + 1); y++) for (let x = Math.floor(cx - a - 1); x <= Math.ceil(cx + a + 1); x++) {
        if (!this.inside(x, y)) continue;
        const t = Math.atan2((y - cy) / b, (x - cx) / a), r = 1 + 0.18 * Math.sin(t * 2 + ph) + 0.1 * Math.sin(t * 3 + ph * 1.7);
        if (((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= r * r) set0.add(this.at(x, y));
      }
      for (let k = 0; k < 4; k++) {
        const orth = (i) => { const [x, y] = this.xy(i); return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.inside(x + dx, y + dy) && set0.has(this.at(x + dx, y + dy))).length; };
        const ring = new Set(); for (const i of set0) { const [x, y] = this.xy(i); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inside(x + dx, y + dy)) ring.add(this.at(x + dx, y + dy)); }
        for (const i of [...ring]) if (!set0.has(i) && orth(i) >= 3) set0.add(i);
        for (const i of [...set0]) if (orth(i) < 2) set0.delete(i);
      }
      const cells = [...set0];
      if (cells.length < 8) continue;
      const clear = cells.every((i) => { const [x, y] = this.xy(i); if (!this.bare(i) || this.occupied.has(i) || this.roads.has(i) || doors.has(i) || this.keep.has(i)) return false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = this.at(x + dx, y + dy); if (this.inside(x + dx, y + dy) && (this.dress.has(j) || this.roads.has(j))) return false; } return true; });
      if (!clear) continue;
      const set = this.pave(cells, group);
      for (const c of set) { this.keep.delete(c); this.occupied.add(c); this.dress.add(c); }
      this.placements.push({ name: "진흙 웅덩이", kind: "dressing", cluster: "mud", cells: set.size, x: Math.round(cx), y: Math.round(cy) });
      n++;
    }
    return n;
  }
  // Plain = empty upper over bare ground, a grass texture, or the body of a paving (cobble / stone / gravel / dirt / sand /
  // snow): a big paved square is as empty as a lawn (FILL-RULES: count plaza body tiles as plain).
  plainBodies() {
    return this._bodies ??= new Set(["cobble", "stone", "gravel", "dirt", "sand", "snowPatch"].map((k) => this.kit.groups[k]?.variantMap["255"]).filter((t) => t != null));
  }
  plainGrid() {
    const P = new Uint8Array(this.W * this.H), body = this.plainBodies();
    for (let i = 0; i < P.length; i++) {
      const l = this.lower[i];
      P[i] = this.upper[i] === -1 && !this.spotCells?.has(i) && (l === this.ground || (l >= 1140 && l <= 1147) || body.has(l)) ? 1 : 0;
    }
    return P;
  }
  emptiness(P = this.plainGrid()) {
    const W = this.W, H = this.H, dp = new Int32Array((W + 1) * (H + 1));
    let best = 0, at = [0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P[y * W + x]) {
      const v = 1 + Math.min(dp[y * (W + 1) + x + 1], dp[(y + 1) * (W + 1) + x], dp[y * (W + 1) + x]);
      dp[(y + 1) * (W + 1) + x + 1] = v;
      if (v > best) { best = v; at = [x - v + 1, y - v + 1]; }
    }
    const sw = Math.min(17, W), sh = Math.min(13, H);
    let worst = 0, wat = [0, 0];
    const ys = [...Array.from({ length: Math.max(1, Math.ceil((H - sh + 1) / 4)) }, (_, k) => k * 4), H - sh], xs = [...Array.from({ length: Math.max(1, Math.ceil((W - sw + 1) / 4)) }, (_, k) => k * 4), W - sw];
    for (const y0 of ys) for (const x0 of xs) {
      let p = 0; for (let y = y0; y < y0 + sh; y++) for (let x = x0; x < x0 + sw; x++) p += P[y * W + x];
      const r = p / (sw * sh); if (r > worst) { worst = r; wat = [x0, y0]; }
    }
    return { maxSq: best, at, screen: worst, screenAt: wat };
  }
  // Irregular compact blob grown from (x, y): each step takes a free 4-neighbour, favouring cells already hugged by the
  // blob (rounded body) with enough noise for a ragged edge.
  blob(x, y, size, ok) {
    const cells = [this.at(x, y)], set = new Set(cells);
    for (let k = 0; cells.length < size && k < size * 6; k++) {
      const cand = new Map();
      for (const c of cells) {
        const [cx, cy] = this.xy(c);
        for (const [dx, dy] of N8.slice(0, 4)) {
          const X = cx + dx, Y = cy + dy, j = this.at(X, Y);
          if (!this.inside(X, Y) || set.has(j) || cand.has(j) || !ok(j)) continue;
          let n = 0; for (const [ex, ey] of N8) if (set.has(this.at(X + ex, Y + ey)) && this.inside(X + ex, Y + ey)) n++;
          cand.set(j, n * n + 1 + this.random() * 4);
        }
      }
      if (!cand.size) break;
      let r = this.random() * [...cand.values()].reduce((s, v) => s + v, 0), pick;
      for (const [j, w] of cand) { r -= w; if (r <= 0) { pick = j; break; } }
      pick ??= [...cand.keys()][0];
      set.add(pick); cells.push(pick);
    }
    return cells;
  }
  // Close empty ground until the emptiness gate passes (/tmp/oprn-qa/FILL-RULES.md) with natural clusters only — tree
  // clumps (2–4 trees of the tree kit), bush groups (289 / small bush), flower bunches of 3–5 and rock groups beside a
  // cliff, water or forest — each one bare cell from the next; named pavings (plazas) get whole plaza pieces.
  // Banned here (FILL-RULES 금지 재료): undergrowth 9–101, the dark bush 986 family, one-flower-per-tile confetti and evenly
  // strewn twigs, rocks or bones. Tall grass only as E/F/G beds (lib/tall-grass.mjs) on the green forest sheet.
  fill(opts = {}) {
    // Tall-grass arranging trims beds after the loop; if that reopens the gate, fill again (up to twice more).
    let g;
    for (let k = 0; k < 3; k++) { g = this.fillOnce(opts); if (g.maxSq <= (opts.maxSq ?? 4) && g.screen <= (opts.screen ?? 0.4)) break; }
    return g;
  }
  fillOnce({ maxSq = 4, screen = 0.4, palette = { trees: 3, bushes: 1.2, flowers: 1.5, rocks: 0.3 }, flowers = [348], bushes = [289],
    rocks = [537, 29], trees = ["tree", "round-bush", "small-bush", "big-oak"], plaza = [], gap: gap0 = 1, tight = true, flowerSize = [3, 5], bushSize = [3, 5],
    rockSize = [2, 4], treeCount = [2, 4], seedSq = maxSq, groves = 6, grassSize = [8, 16], growShare = 0.5, growCap = 60, groveSq = maxSq + 3, flowerCap = Math.round(this.W * this.H / 160), stands = [], standCount = [2, 4], shoreBushes = [], shoreR = 5, flowersNearWater = 0, smallBushShare = 0.4, rocksAnywhere = false, standsAsSpots = false, spotCap = Infinity } = {}) {
    let gap = gap0;
    const nearAccess = new Set();
    for (const a of this.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearAccess.add(this.at(a.x + dx, a.y + dy));
    const plazaItems = new Map(plaza);
    const free = (i) => this.bare(i) && !this.occupied.has(i) && !nearAccess.has(i) && !this.roads.has(i) && !this.paved.has(i);
    // Bunches keep a bare cell from other bunches but may sit at the foot of a tree clump.
    const roomy = (i) => { const [x, y] = this.xy(i); for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) { const j = this.at(x + dx, y + dy); if (this.inside(x + dx, y + dy) && this.dress.has(j) && !this.treeCells.has(j)) return false; } return true; };
    // Grass beds keep a bare cell from other beds of another kind; beds of grass that meet merge (grow below).
    const roomyBed = (i, own = -1) => { const [x, y] = this.xy(i); for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) { const j = this.at(x + dx, y + dy);
      if (!this.inside(x + dx, y + dy) || !this.dress.has(j) || this.treeCells.has(j)) continue; const c = this.clusterOf.get(j); if (c === own || (c !== undefined && this.clusters[c].kind === "grass")) continue; return false; } return true; };
    const growGrass = (x0, y0, w, h) => {
      const opts = [];
      for (const c of this.clusters) {
        if (c.kind !== "grass" || c.cells.size >= growCap) continue;
        for (const i of c.cells) { const [x, y] = this.xy(i);
          for (const [dx, dy] of N8.slice(0, 4)) { const X = x + dx, Y = y + dy, j = this.at(X, Y);
            if (X >= x0 && Y >= y0 && X < x0 + w && Y < y0 + h && this.inside(X, Y) && !c.cells.has(j) && free(j) && roomyBed(j, c.id)) opts.push([c, j]); } }
      }
      if (!opts.length) return false;
      const [c, j] = any(opts);
      c.cells.add(j); this.dress.add(j); this.occupied.add(j); this.clusterOf.set(j, c.id); this.grassCells.add(j);
      this.pave([...c.cells], "tallGrass");
      return true;
    };
    const growBunch = (x0, y0, w, h) => {
      const opts = [];
      for (const c of this.clusters) {
        if (c.kind === "grass" || !c.tiles || c.tiles.includes(289) || c.cells.size >= (c.kind === "flowers" ? 9 : 6)) continue;
        for (const i of c.cells) { const [x, y] = this.xy(i);
          for (const [dx, dy] of N8.slice(0, 4)) { const X = x + dx, Y = y + dy, j = this.at(X, Y);
            if (X < x0 || Y < y0 || X >= x0 + w || Y >= y0 + h || !this.inside(X, Y) || c.cells.has(j)) continue;
            if (!(c.kind === "flowers" ? free(j) : solidOk(j))) continue;
            let n = 0, orth = 0, foreign = false;
            for (const [ex, ey] of N8) { const k = this.at(X + ex, Y + ey); if (!this.inside(X + ex, Y + ey)) continue; if (c.cells.has(k)) { n++; if (!ex || !ey) orth++; } else if (this.dress.has(k) && !this.treeCells.has(k)) foreign = true; }
            // Compact growth only: a notch (two sides) or a corner that touches three cells; the bunch stays roughly round.
            if (foreign || !(orth >= 2 || n >= 3)) continue;
            const xs = [...c.cells, j].map((q) => q % this.W), ys = [...c.cells, j].map((q) => Math.floor(q / this.W));
            const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
            if (Math.max(bw, bh) > 2 * Math.min(bw, bh) + 1) continue;
            opts.push([c, j, n]); } }
      }
      if (!opts.length) return false;
      opts.sort((a, b) => b[2] - a[2]);
      const [c, j] = opts[Math.floor(this.random() * Math.min(opts.length, 6))];
      c.cells.add(j); this.clusterOf.set(j, c.id); upperOn(j, any(c.tiles)); this.dress.add(j); this.occupied.add(j);
      return true;
    };
    const solidOk = (i) => { const [x, y] = this.xy(i); if (!free(i) || (this.keep.has(i) && !this.softKeep.has(i))) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = this.at(x + dx, y + dy); if (!this.inside(x + dx, y + dy)) continue; if ((this.roads.has(j) && gap > 0) || this.water.has(j) || nearAccess.has(j)) return false; }
      return true; };
    // Rocks lie where rock comes from: at a cliff foot, a shore or a forest edge.
    const rockAnchor = (i) => { const [x, y] = this.xy(i); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = this.at(x + dx, y + dy); if (this.inside(x + dx, y + dy) && (this.cliffCells.has(j) || this.water.has(j) || this.isForest(j))) return true; } return false; };
    const entries = Object.entries(palette).filter(([, w]) => w > 0), total = entries.reduce((s, [, w]) => s + w, 0);
    const pick = () => { let r = this.random() * total; for (const [k, w] of entries) { r -= w; if (r <= 0) return k; } return entries[0][0]; };
    const any = (a) => a[Math.floor(this.random() * a.length)];
    const size = ([a, b]) => a + Math.floor(this.random() * (b - a + 1));
    const mark = (cells, name, kind) => { for (const c of cells) { this.dress.add(c); this.occupied.add(c); } const [x, y] = this.xy(cells[0]); this.placements.push({ name, kind: "dressing", cluster: kind, cells: cells.length, x, y }); };
    const upperOn = (i, t) => { this.upper[i] = t; if (!WALKABLE_UPPER.has(t)) { this.solid.add(i); this.keep.add(i); } };
    const place = (kind, x, y) => {
      const i0 = this.at(x, y);
      if (kind === "plaza") {
        const group = this.paved.get(i0), items = plazaItems.get(group);
        if (!items || !this.plazaCells.has(i0)) return false;
        const empty = (i) => this.plazaCells.has(i) && this.paved.get(i) === group && this.upper[i] === -1 && !nearAccess.has(i);
        for (let k = 0; k < 8; k++) {
          const name = any(items), p = this.part(name), px = x - Math.floor(this.random() * p.w), py = y - Math.floor(this.random() * p.h);
          // Pieces may stand shoulder to shoulder (a stall with its barrels) as long as the plaza stays crossable.
          let fits = true;
          for (let dy = 0; dy < p.h && fits; dy++) for (let dx = 0; dx < p.w && fits; dx++) fits = this.inside(px + dx, py + dy) && empty(this.at(px + dx, py + dy));
          if (!fits || this.cutsAround(px, py, p.w, p.h)) continue;
          this.put(name, px, py, { purpose: "광장 나누기", check: false });
          return true;
        }
        return false;
      }
      if (kind === "grass") {
        const ok = (j) => free(j) && roomyBed(j);
        return !!this.grassBed(x, y, size(grassSize), ok);
      }
      if (kind === "flowers" || kind === "bushes" || kind === "rocks") {
        const tiles = kind === "bushes" && shoreBushes.length && this.nearWater(x, y, shoreR) ? shoreBushes : { flowers, bushes, rocks }[kind], walk = kind === "flowers";
        if (!tiles.length) return false;
        if (kind === "rocks" && !rocksAnywhere && !rockAnchor(i0)) return false;
        if (kind === "flowers" && flowersNearWater && !this.nearWater(x, y, flowersNearWater)) return false;
        const ok = (j) => (walk ? free(j) : solidOk(j)) && roomy(j);
        if (!ok(i0)) return false;
        // Small bush kit (2×2) half of the time for green bushes.
        if (kind === "bushes" && tiles.includes(289) && this.random() < smallBushShare) {
          const t = this.kit.trees["small-bush"];
          const own = []; for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) own.push(this.at(x + dx, y + dy));
          if (!own.every((j) => { const [X, Y] = this.xy(j); return this.inside(X, Y) && ok(j); })) return false;
          return this.stampTree("small-bush", x, y, { ring: 0, loose: true });
        }
        const want = size({ flowers: flowerSize, bushes: bushSize, rocks: rockSize }[kind]);
        // Flower bunches are compact: a 2×2 core (when it fits) plus a cell or so. Cacti, twigs and rocks start from an
        // L of three instead — a field of 2×2 squares reads as a checkerboard.
        const L = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]]];
        const core = (kind === "flowers" ? [[0, 0], [1, 0], [0, 1], [1, 1]] : any(L)).map(([dx, dy]) => [x + dx, y + dy]);
        const cells = core.every(([X, Y]) => this.inside(X, Y) && ok(this.at(X, Y)))
          ? [...core.map(([X, Y]) => this.at(X, Y)), ...this.blob(x, y, want, ok).filter((c) => !core.some(([X, Y]) => this.at(X, Y) === c))].slice(0, Math.max(want, 4))
          : this.blob(x, y, want, ok);
        if (cells.length < Math.min(want, 3) && !(kind === "rocks" && cells.length >= 2)) return false;
        // Never a straight row or column of three or more (reads as a fence or a planted line).
        if (cells.length >= 3) { const xs = new Set(cells.map((c) => c % this.W)), ys = new Set(cells.map((c) => Math.floor(c / this.W))); if (xs.size === 1 || ys.size === 1) return false; }
        for (const c of cells) upperOn(c, any(tiles));
        mark(cells, { flowers: "들꽃 묶음", bushes: "덤불 무리", rocks: "바위 무리" }[kind], kind);
        { const id = this.clusters.length; this.clusters.push({ id, kind, group: null, cells: new Set(cells), tiles }); for (const c of cells) this.clusterOf.set(c, id); }
        return true;
      }
      if (kind === "stands") {
        if (!stands.length || (standsAsSpots && (this.bareSpots?.length ?? 0) >= spotCap)) return false;
        const want = size(standCount), mine = [];
        const ok2 = (X, Y) => this.inside(X, Y) && this.inside(X, Y + 1) && solidOk(this.at(X, Y)) && solidOk(this.at(X, Y + 1)) && roomy(this.at(X, Y)) && roomy(this.at(X, Y + 1));
        if (!ok2(x, y)) return false;
        mine.push([x, y]);
        for (let k = 0; k < 12 && mine.length < want; k++) {
          const [px, py] = any(mine), [dx, dy] = any([[1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [0, -2]]);
          const X = px + dx, Y = py + dy;
          if (mine.some(([mx, my]) => mx === X && Math.abs(my - Y) < 2) || !ok2(X, Y)) continue;
          mine.push([X, Y]);
        }
        if (mine.length < 2) return false;
        const cells = [];
        // standsAsSpots: leave the 1×2 cells bare and reserved (the leafless-tree art is placed there later).
        for (const [X, Y] of mine) { const p = this.part(any(stands)); for (let dy = 0; dy < 2; dy++) { const i = this.at(X, Y + dy); cells.push(i); if (standsAsSpots) { this.keep.add(i); (this.spotCells ??= new Set()).add(i); continue; } upperOn(i, p.upper[dy][0]); if (p.lower?.[dy]?.[0] >= 0) this.lower[i] = p.lower[dy][0]; } }
        mark(cells, "나무 무리", "stands");
        // Bare-tree spots: the 1×2 stand cells, kept so the leafless-tree art can replace them later (catalog bareTreeSpots).
        if (standsAsSpots) (this.bareSpots ??= []).push(...mine.map(([X, Y]) => [X, Y]));
        return true;
      }
      if (kind === "trees") {
        // A clump: the first tree on the target, the next ones shoulder to shoulder round it (never a row or a grid).
        const want = size(treeCount), mine = [];
        const fits = (id, ox, oy) => {
          const t = this.kit.trees[id], own = [];
          for (let dy = -1; dy <= t.h; dy++) for (let dx = -1; dx <= t.w; dx++) { const X = ox + dx, Y = oy + dy, i = this.at(X, Y);
            if (!this.inside(X, Y) || nearAccess.has(i) || this.roads.has(i) || this.water.has(i)) return false; if (dx >= 0 && dy >= 0 && dx < t.w && dy < t.h) own.push(i); }
          const ours = new Set(mine.flatMap((p) => Array.from({ length: p.w * p.h }, (_, q) => this.at(p.x + q % p.w, p.y + Math.floor(q / p.w)))));
          return own.every((i) => { const [X, Y] = this.xy(i); for (let ey = -gap; ey <= gap; ey++) for (let ex = -gap; ex <= gap; ex++) { const j = this.at(X + ex, Y + ey); if (this.inside(X + ex, Y + ey) && this.dress.has(j) && !ours.has(j) && !own.includes(j)) return false; } return true; });
        };
        const first = any(trees), t0 = this.kit.trees[first], fx = x - (t0.w >> 1), fy = y - (t0.h >> 1);
        if (!fits(first, fx, fy) || !this.stampTree(first, fx, fy, { ring: 0, loose: true })) return false;
        mine.push({ x: fx, y: fy, w: t0.w, h: t0.h });
        for (let n = 1, k = 0; n < want && k < 12; k++) {
          const id = any(trees), t = this.kit.trees[id], p = any(mine), j = Math.floor(this.random() * 3) - 1;
          const spots = [[p.x + p.w, p.y + j + (p.h - t.h)], [p.x - t.w, p.y + j + (p.h - t.h)], [p.x + j, p.y + p.h - 1], [p.x + j, p.y - t.h + 1]];
          const [ox, oy] = any(spots);
          if (fits(id, ox, oy) && this.stampTree(id, ox, oy, { ring: 0, loose: true })) { mine.push({ x: ox, y: oy, w: t.w, h: t.h }); n++; }
        }
        return true;
      }
      return false;
    };
    // Biggest anchors first: a wood (forest canopy blob) in every open square of groveSq or more, then tree clumps.
    if (groves) {
      const P = this.plainGrid(), blobs = [];
      for (const a of this.access) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.inside(a.x + dx, a.y + dy)) P[this.at(a.x + dx, a.y + dy)] = 0;
      for (const i of this.roads) P[i] = 0;
      for (let k = 0; k < groves; k++) {
        const e = this.emptiness(P);
        if (e.maxSq < groveSq) break;
        const r = e.maxSq / 2;
        blobs.push([e.at[0] + r, e.at[1] + r, r * (0.8 + this.random() * 0.3), r * (0.7 + this.random() * 0.3), 12]);
        for (let y = e.at[1]; y < e.at[1] + e.maxSq; y++) for (let x = e.at[0]; x < e.at[0] + e.maxSq; x++) P[this.at(x, y)] = 0;
      }
      if (blobs.length) { this.forest({ blobs, noise: 0.6, seedShift: 17 }); this.groveBlobs = blobs.length; }
    }
    let flowerCount = 0;
    const dead = new Set();
    // Big anchors first: tree clumps until they no longer fit, then bushes, flower bunches and rocks in what is left.
    let steps = 0, fails = 0, g, treePhase = !!palette.trees, treeFails = 0, growing = false;
    for (; steps < 4000; steps++) {
      const P = this.plainGrid(); g = this.emptiness(P);
      if (g.maxSq <= maxSq && g.screen <= screen) break;
      // After the tree phase, part of the closing is done by growing grass beds (fewer, larger patches).
      if (!treePhase && palette.grass && g.maxSq <= maxSq && this.random() < growShare && growGrass(g.screenAt[0], g.screenAt[1], 17, 13)) { fails = 0; continue; }
      if (growing && g.maxSq <= maxSq && growBunch(g.screenAt[0], g.screenAt[1], 17, 13)) { fails = 0; continue; }
      // Aim at the biggest empty square first, then at the emptiest screen; ground that refused everything is set aside.
      const T = P.slice(); for (const i of dead) T[i] = 0;
      const t = this.emptiness(T);
      const [x0, y0, w, h] = t.maxSq > seedSq ? [t.at[0], t.at[1], t.maxSq, t.maxSq] : [t.screenAt[0], t.screenAt[1], 17, 13];
      const cand = [];
      for (let y = y0; y < Math.min(this.H, y0 + h); y++) for (let x = x0; x < Math.min(this.W, x0 + w); x++) if (T[this.at(x, y)]) cand.push([x, y]);
      let placed = false;
      for (let k = 0; k < 30 && !placed && cand.length; k++) {
        const [tx, ty] = cand.splice(Math.floor(this.random() * cand.length), 1)[0], i = this.at(tx, ty);
        let kind = this.plazaCells.has(i) ? "plaza" : treePhase ? "trees" : pick();
        if (kind === "flowers" && flowerCount >= flowerCap) kind = "bushes";
        placed = place(kind, tx, ty);
        if (placed && kind === "flowers") flowerCount++;
        if (!placed && k % 5 === 4 && !treePhase) dead.add(i);
      }
      if (treePhase) { treeFails = placed ? 0 : treeFails + 1; if (treeFails > 12) { treePhase = false; fails = 0; } if (!placed) continue; }
      if (process.env.FILL_DEBUG) console.log("fill", steps, g.maxSq, g.screen.toFixed(2), [x0, y0, w, h].join(","), cand.length, placed);
      if (placed) fails = 0;
      else if (++fails > 70) {
        // Last pass: once the one-cell rings between clumps are all that is left, clumps may lean on each other
        // (a rock at the foot of a shrub, cacti against a rock) — still no rows, still clear of roads and doors.
        if (process.env.FILL_DEBUG) console.log("phase", growing ? "tight" : "grow", steps, g.screen.toFixed(2));
        if (!growing) { growing = true; fails = 0; dead.clear(); continue; }
        if (gap > 0 && tight) { gap = 0; fails = 0; dead.clear(); continue; }
        break;
      }
    }
    if (this.arrangeGrass()) g = this.emptiness();
    this.fillReport = { steps, ...g };
    return g;
  }

  // Would a solid w×h block at (x, y) cut the ground round it in two? (walkable runs along its one-cell ring)
  cutsAround(x, y, w, h) {
    const ring = [];
    for (let X = x - 1; X <= x + w; X++) ring.push([X, y - 1]);
    for (let Y = y; Y <= y + h; Y++) ring.push([x + w, Y]);
    for (let X = x + w - 1; X >= x - 1; X--) ring.push([X, y + h]);
    for (let Y = y + h - 1; Y >= y; Y--) ring.push([x - 1, Y]);
    const open = ring.map(([X, Y]) => this.inside(X, Y) && !this.solid.has(this.at(X, Y)) && !this.water.has(this.at(X, Y)) && !this.cliffCells.has(this.at(X, Y)));
    let runs = 0; for (let k = 0; k < open.length; k++) if (open[k] && !open[(k + open.length - 1) % open.length]) runs++;
    return runs > 1 || !open.some(Boolean);
  }
  // Split a big paved plaza: whole pieces (stalls, beds, benches, lamps…) on the paving until its largest empty square is
  // ≤ maxSq, each with a one-cell walkway ring so the plaza stays crossable.
  plazaFill(groupName, items, maxSq = 3) {
    const cells = new Set([...this.paved.entries()].filter(([, g]) => g === groupName).map(([i]) => i));
    const nearAccess = new Set();
    for (const a of this.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearAccess.add(this.at(a.x + dx, a.y + dy));
    const empty = (i) => cells.has(i) && this.upper[i] === -1;
    let placed = 0;
    for (let step = 0; step < 200; step++) {
      const W = this.W, dp = new Int32Array((W + 1) * (this.H + 1)); let best = 0, at = [0, 0];
      for (let y = 0; y < this.H; y++) for (let x = 0; x < W; x++) if (empty(this.at(x, y))) {
        const v = 1 + Math.min(dp[y * (W + 1) + x + 1], dp[(y + 1) * (W + 1) + x], dp[y * (W + 1) + x]); dp[(y + 1) * (W + 1) + x + 1] = v;
        if (v > best) { best = v; at = [x - v + 1, y - v + 1]; }
      }
      if (best <= maxSq) break;
      let ok = false;
      for (let k = 0; k < 30 && !ok; k++) {
        const name = items[Math.floor(this.random() * items.length)], p = this.part(name);
        const x = at[0] + Math.floor(this.random() * Math.max(1, best - p.w + 1)), y = at[1] + Math.floor(this.random() * Math.max(1, best - p.h + 1));
        let fits = true;
        for (let dy = -1; dy <= p.h && fits; dy++) for (let dx = -1; dx <= p.w && fits; dx++) {
          const X = x + dx, Y = y + dy, i = this.at(X, Y), own = dx >= 0 && dy >= 0 && dx < p.w && dy < p.h;
          fits = this.inside(X, Y) && (own ? empty(i) && !nearAccess.has(i) : !this.solid.has(i) || this.water.has(i));
        }
        if (!fits) continue;
        this.put(name, x, y, { purpose: "광장 나누기", check: false });
        placed++; ok = true;
      }
      if (!ok) break;
    }
    return placed;
  }

  // ── checks ──
  // Leafless trees (lib/bare-trees.mjs; baked into the desert/ash/snow sheets from 2880) on the bare-tree spots fill left
  // (standsAsSpots): the spots are released and their lower cells offered as grove sites (trunk foot). Groves keep two
  // cells off roads, doors, stairs and bridges and one off water, cliffs and objects; no undergrowth; a grove that cuts
  // the way to a door or exit is rolled back. Afterwards no foot row carries more than three trees (no fence line).
  bareGroves({ seed = this.seed, cactus = null, rock = 537, spacing, rockChance } = {}) {
    const spots = this.bareSpots ?? [];
    if (!spots.length) return null;
    for (const i of this.spotCells ?? []) this.keep.delete(i);
    this.spotCells = new Set();
    const before = this.upper.slice(), entry = this.exitList[0].inner;
    const accept = () => { const seen = this.walk(this.map, entry); return this.access.every((a) => seen.has(this.at(a.x, a.y))); };
    const keep = [...this.access.map((a) => [a.x, a.y]), ...this.exitList.flatMap((e) => [[e.x, e.y], e.inner])];
    const out = arrangeBareGroves(this.map, { tileset: this.spec.tileset, houses: this.houses, keep, reserved: new Set(this.keep),
      sites: spots.map(([x, y]) => this.at(x, y + 1)).filter((i) => i < this.W * this.H), seed, rock, cactus, accept, ...(spacing ? { spacing } : {}), ...(rockChance != null ? { rockChance } : {}) });
    // Fence check: trees whose foot shares a row, counted per row in runs along x (gap ≤ 3 cells).
    const stamps = new Map(bareTreeStamps(this.spec.tileset).map((s) => [s.id, s]));
    const feet = out.groves.flatMap((g) => g.trees.map((t) => ({ x: t.x, foot: t.y + stamps.get(t.id).h - 1, w: stamps.get(t.id).w })));
    let fence = 0;
    for (const f of feet) fence = Math.max(fence, feet.filter((o) => o.foot === f.foot && Math.abs(o.x - f.x) <= 12).length);
    for (let i = 0; i < this.upper.length; i++) if (this.upper[i] !== before[i]) { this.occupied.add(i); this.solid.add(i); }
    this.bareSpots = [];
    this.groveReport = { groves: out.groves.length, trees: out.trees, rolledBack: out.stats.rolledBack, candidates: out.stats.candidates, fenceRow: fence };
    this.placements.push(...out.groves.map((g) => ({ name: "잎 없는 나무 덩이", kind: "grove", x: g.x, y: g.y, w: 1, h: 1, trees: g.trees, props: g.props.map((p) => [p.tile, p.x, p.y]) })));
    const g = this.emptiness();
    this.fillReport = { ...(this.fillReport ?? {}), ...g, groves: this.groveReport };
    return this.groveReport;
  }
  // Desert and ash (user 2026-09-25: 「돌·선인장·풀이 너무 많다」, 「화산은 균열·용암, 모래는 사구」): close the emptiness
  // gate with the ground itself (lib/climate-terrain.mjs) — lava plates, crack networks, a small lava pool with its
  // fumarole and a basalt cluster on ash; dunes, ripple sand, cracked earth, a mesa or two, one remote bones spot and a
  // few cactus clumps on sand. Walkable ground only on open sand / ash (never roads, pavings, doors, yards or the cell
  // round a house); solid pieces also keep a cell off water, cliffs, roads and other solids, and roll back if they cut
  // the way from the first exit to a door or exit.
  climateGround({ climate, maxSq = 4, screen = 0.38, seed = this.seed, ...extra } = {}) {
    const map = this.map, W = this.W, body = this.plainBodies();
    const isPlain = (x, y) => { const i = y * W + x, l = map.lowerTiles[i]; return map.upperTiles[i] === -1 && !this.spotCells?.has(i) && (l === this.ground || (l >= 1140 && l <= 1147) || body.has(l)); };
    const nearAccess = new Set();
    for (const a of this.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearAccess.add(this.at(a.x + dx, a.y + dy));
    for (const e of this.exitList) for (const [x, y] of [[e.x, e.y], e.inner]) nearAccess.add(this.at(x, y));
    const near = (x, y, r, test) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (this.inside(xx, yy) && test(this.at(xx, yy))) return true; return false; };
    // (keep cells stay walkable and occupied open cells are left-over reservations — bare-tree spots no grove used — so
    // walkable ground may cover them; solid pieces may not)
    const busy = (i, solid) => (solid && (this.keep.has(i) || this.occupied.has(i))) || this.roads.has(i) || this.paved.has(i) || nearAccess.has(i) || this.plazaCells.has(i);
    const take = (x, y, solid) => {
      const i = this.at(x, y);
      if (map.lowerTiles[i] !== this.ground || map.upperTiles[i] !== -1 || busy(i, solid)) return false;
      if (this.houses.some((h) => x >= h.x - 1 && x <= h.x + h.w && y >= h.y - 1 && y <= h.y + h.h)) return false;
      return !solid || !near(x, y, 1, (j) => this.solid.has(j) || this.water.has(j) || this.cliffCells.has(j) || this.roads.has(j) || this.paved.has(j) || nearAccess.has(j) || this.bridgeCells.has(j));
    };
    const entry = this.exitList[0].inner, targets = [...this.access.map((a) => [a.x, a.y]), ...this.exitList.map((e) => e.inner)];
    // every prop that could be walked up to keeps a reachable cell beside it (OutdoorMap.check)
    const reachAll = () => { const seen = this.walk(map, entry); return (X, Y) => this.inside(X, Y) && seen.has(this.at(X, Y)); };
    const beside = (o, hit) => { for (let dy = -1; dy <= o.h; dy++) for (let dx = -1; dx <= o.w; dx++) if (hit(o.x + dx, o.y + dy)) return true; return false; };
    const hit0 = reachAll(), props = this.placements.filter((p) => p.kind === "prop" && beside(p, hit0));
    const accept = () => { const hit = reachAll(); return targets.every(([x, y]) => hit(x, y)) && props.every((o) => beside(o, hit)); };
    const before = map.upperTiles.slice();
    const opts = { kit: terrainKit(this.spec.tileset), isPlain, take, accept, seed, limits: { maxSq, screen }, water: this.water, ...extra };
    const out = climate === "volcano" ? dressVolcanoGround(map, opts) : dressDesertGround(map, opts);
    // (the dressing may swap the layer arrays when it rolls a piece back)
    this.lower = map.lowerTiles; this.upper = map.upperTiles;
    for (let i = 0; i < this.upper.length; i++) if (this.upper[i] !== before[i]) { this.occupied.add(i); if (this.upper[i] >= 0) this.solid.add(i); }
    const kinds = {}; for (const p of out.pieces) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
    this.groundReport = { pieces: kinds, cells: out.counts };
    const g = this.emptiness();
    this.fillReport = { ...(this.fillReport ?? {}), ...g, ground: this.groundReport };
    return g;
  }
  walk(map = this.map, from) {
    const project = { tilesets: { [this.spec.tileset.id]: this.spec.tileset }, maps: { [map.id]: map } };
    const start = from ?? this.entry, seen = new Set([this.at(...start)]), queue = [start];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of N8.slice(0, 4)) {
        const X = x + dx, Y = y + dy, k = this.at(X, Y);
        if (this.inside(X, Y) && !seen.has(k) && this.kit.api.canMove(project, map, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
      }
    }
    return seen;
  }
  // 3차 판정: every life prop needs its reason within two cells (a house, plaza, stall, pier, well, camp; a road for
  // lamps and signs; water for fishing gear). Props without one are taken out (logged) instead of left in the field.
  pruneUnowned(r = 2) {
    const houseCells = new Set(), landmarkCells = new Set();
    for (const h of this.houses) for (let k = 0; k < h.w * h.h; k++) houseCells.add(this.at(h.x + k % h.w, h.y + Math.floor(k / h.w)));
    for (const l of this.landmarks) for (let k = 0; k < l.w * l.h; k++) landmarkCells.add(this.at(l.x + k % l.w, l.y + Math.floor(k / l.w)));
    const reasonCells = new Set();
    for (const o of this.placements) if (o.kind === "prop" && REASON_PROPS.has(o.name)) for (let k = 0; k < o.w * o.h; k++) reasonCells.add(this.at(o.x + k % o.w, o.y + Math.floor(k / o.w)));
    const near = (o, test) => { for (let dy = -r; dy < o.h + r; dy++) for (let dx = -r; dx < o.w + r; dx++) { const X = o.x + dx, Y = o.y + dy; if (this.inside(X, Y) && test(this.at(X, Y))) return true; } return false; };
    let removed = 0;
    for (let n = this.placements.length - 1; n >= 0; n--) {
      const o = this.placements[n];
      if (o.kind !== "prop" || o.owner || o.purpose === "광장 나누기" || SELF_STANDING.has(o.name)) continue;
      const own = new Set(Array.from({ length: o.w * o.h }, (_, k) => this.at(o.x + k % o.w, o.y + Math.floor(k / o.w))));
      const other = (test) => (i) => !own.has(i) && test(i);
      const built = other((i) => houseCells.has(i) || landmarkCells.has(i) || this.plazaCells.has(i) || this.bridgeCells.has(i) || reasonCells.has(i) || this.paved.get(i) === "farm");
      const ok = WATERSIDE.has(o.name) ? near(o, (i) => this.water.has(i) || this.bridgeCells.has(i))
        : ROADSIDE.has(o.name) ? near(o, (i) => this.roads.has(i) || built(i))
        : near(o, built);
      if (ok) continue;
      for (const i of own) { this.upper[i] = -1; this.solid.delete(i); this.occupied.delete(i); this.keep.delete(i); }
      this.placements.splice(n, 1); this.log.skipped.push(`unowned ${o.name} ${o.x},${o.y}`); removed++;
    }
    return removed;
  }
  check({ entry, extra = [], leak = true, pruneProps = true, seals = [] }) {
    this.entry = entry;
    if (pruneProps) this.pruneUnowned();
    let seen = this.walk();
    const near = (o) => { for (let dy = -1; dy <= o.h; dy++) for (let dx = -1; dx <= o.w; dx++) { const X = o.x + dx, Y = o.y + dy; if (this.inside(X, Y) && seen.has(this.at(X, Y))) return true; } return false; };
    if (pruneProps) {
      // Yard pieces nobody can walk up to are taken back out (logged) rather than left unreachable.
      for (let n = this.placements.length - 1; n >= 0; n--) {
        const o = this.placements[n];
        if (o.kind !== "prop" || !o.owner || near(o)) continue;
        for (let k = 0; k < o.w * o.h; k++) { const i = this.at(o.x + k % o.w, o.y + Math.floor(k / o.w)); this.upper[i] = -1; this.solid.delete(i); this.occupied.delete(i); }
        this.placements.splice(n, 1); this.log.skipped.push(`unreachable ${o.owner} ${o.name}`);
      }
      seen = this.walk();
    }
    const targets = [...this.access, ...extra.map(([x, y]) => ({ role: "extra", x, y }))];
    const blocked = targets.filter((a) => !seen.has(this.at(a.x, a.y)));
    if (blocked.length && process.env.OUTDOOR_WALK === this.spec.id) console.log(this.ascii().split("\n").map((r, y) => y === 0 ? r : [...r].map((c, k) => k > 1 && seen.has(this.at(k - 2, y - 1)) ? "r" : c).join("")).join("\n"));
    assert.equal(blocked.length, 0, "Blocked " + this.spec.id + ": " + JSON.stringify(blocked.slice(0, 6)));
    for (const o of this.placements.filter((p) => p.kind === "prop")) assert(near(o), `Prop out of reach ${this.spec.id} ${o.name} ${o.x},${o.y}`);
    let leaks = 0;
    if (leak && this.stairList.length && this.cliffPlan) {
      const shut = structuredClone(this.map);
      for (const s of this.stairList) for (let yy = s.y; yy <= s.y + s.height; yy++) for (let xx = s.x; xx < s.x + 2; xx++) shut.lowerTiles[this.at(xx, yy)] = this.kit.cliff[172];
      const low = this.walk(shut);
      const bad = [...low].filter((i) => this.cliffPlan.cells[i] === "plateau");
      leaks = bad.length;
      assert.equal(leaks, 0, "Terrace reachable without stairs " + this.spec.id + " " + JSON.stringify(bad.slice(0, 6).map((i) => this.xy(i))));
    }
    // Seals: with the given cells shut (a gate, a bridge), the target must be out of reach — the barrier has no way round.
    const sealChecks = [];
    for (const { name, close, target } of seals) {
      const shut = structuredClone(this.map);
      for (const [x, y] of close) { shut.upperTiles[this.at(x, y)] = 29; }
      const low = this.walk(shut);
      assert(!low.has(this.at(...target)), `Seal ${name} leaks ${this.spec.id}`);
      sealChecks.push({ name, close: close.length, target, sealed: true });
    }
    return { reachable: seen.size, targets: targets.length, blocked: 0, terraceLeaks: leaks, seals: sealChecks };
  }
}

export function cliffRim(profile) { return cliffColumns(profile); }
