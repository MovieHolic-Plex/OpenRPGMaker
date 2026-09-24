import { placeCivicProps } from "./lib/village-civic-props.mjs";
// New exterior studies built from verified whole parts; never edits the source project.
import { placeHouseholdProps, PROP_PROGRAMS } from "./lib/village-household-props.mjs";
import { paintVillageCliffs } from "./lib/village-cliffs.mjs";
import { farmlandTiles } from "./lib/village-farmland.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { withTsModule } from "../ontology-ts-loader.mjs";
const [input, out] = process.argv.slice(2);
if (!input || !out) throw Error("Usage: author-diverse-villages.mjs canonical-export.json output-dir");
fs.mkdirSync(out, { recursive: true });
// Layout iteration aid: VILLAGE_DUMP=file.json keeps the last map being authored, even when an assertion stops the run.
let lastMap = null;
if (process.env.VILLAGE_DUMP) process.on("exit", () => lastMap && fs.writeFileSync(process.env.VILLAGE_DUMP, JSON.stringify(lastMap)));
const source = JSON.parse(fs.readFileSync(input)), ts = structuredClone(source.tilesets.forest_harmony), original = source.maps.dewbank_village;
const parts = JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json")).props;
const extraParts = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json"));
parts.push(...extraParts.props);
for (const name of extraParts.oversized.names) parts.splice(parts.findIndex((p) => p.name === name), 1);
// Fill the blank labels of the pieces these villages use (windows 84~88, castle stone, banners, vines).
for (const [n, meta] of Object.entries(JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/tile-labels.json")).tiles)) {
  const old = ts.tileMeta[n] ?? {};
  if (!old.label || old.label === "창문") ts.tileMeta[n] = { ...old, ...meta };
}
const landmarkDefs = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/landmarks.json"));
const WINDOWS = new Set([84, 85, 86, 87, 88]), WALLS = new Set([12, 13, 14, 15, 16, 17, 42, 43, 44, 45, 46, 47, 72, 73, 74, 75, 76, 77]);
const cliffIds = [18, 19, 48, 49, 78, 79, 80, 108, 110, 138, 139, 140, 171, 172, 173, 201, 202, 203, 231, 374, 413, 232];
const offset = Math.ceil(ts.count / 30) * 30, cliff = Object.fromEntries(cliffIds.map((n, i) => [n, offset + i]));
for (const [i, n] of cliffIds.entries()) {
  const id = offset + i;
  const matched = {18:3,19:4,48:5,49:6,139:7,232:8}[n];
  ts.tileGrafts.push(matched !== undefined ? { sourceChipset:"tex_forest_harmony_grass_joins", sourceTile:matched, targetTile:id } : { sourceChipset: n === 413 ? "tex_easyrpg_chipset_retro_world" : "tex_forest_harmony", sourceTile: n === 413 ? n : n + 480, targetTile: id });
  const walk = n === 374;
  ts.priority[id] = "lower";
  ts.terrain[id] = 0;
  ts.passability[id] = { up: walk, down: walk, left: walk, right: walk };
  ts.tileMeta[id] = { label: n === 374 ? "돌계단" : n === 413 ? "동굴 입구" : `절벽 · 숲마을 ${n + 480}`, description: "바닥240에 맞는 숲마을 색 보정판. 큰 폭포 원본의 밝은 잔디판과 구분한다.", role: n === 374 ? "floor" : "cliff", defaultLayer: n === 374 ? "lower" : "upper", source: "user", userLocked: true, passage: walk ? "passable" : "solid", ...n === 413 ? { layerBacking: cliff[172] } : {} };
}
const grassBindings = { 504: offset + cliffIds.length, 505: offset + cliffIds.length + 1, 559: offset + cliffIds.length + 2 };
for (const [i, original] of [504,505,559].entries()) {
  const id = grassBindings[original];
  ts.tileGrafts.push({ sourceChipset:'tex_forest_harmony_grass_joins', sourceTile:i===2?9:i, targetTile:id });
  ts.passability[id] = { up:true, down:true, left:true, right:true };
  ts.priority[id] = 'lower'; ts.terrain[id] = 0;
  ts.tileMeta[id] = { label:`잔디 ${original===559?"수평 반복":"사선"} ${original} · 색 맞춤`, description:'바닥240 유지. 원본 경계의 알파 모양 보존. 지붕/암벽 면이 아닌 잔디 가장자리.', role:'terrain', defaultLayer:'lower', layerBacking:240, passage:'passable', source:'user', userLocked:true };
}
ts.count = Math.ceil((offset + cliffIds.length + 3) / 30) * 30;
while (ts.terrain.length < ts.count) ts.terrain.push(0);
while (ts.priority.length < ts.count) ts.priority.push("lower");
while (ts.passability.length < ts.count) ts.passability.push({ up: false, down: false, left: false, right: false });
while (ts.tileMeta.length < ts.count) ts.tileMeta.push({ label: "미사용", source: "unknown" });
// River kit from the CC0 World sheet (same pieces as 비취 대계곡): waterfall frame 0 and the two plank rows of a bridge.
// Its water/banks are already this sheet's lake_47 (World 120 = forest_harmony 1563), so only these three are grafted.
const riverTiles = { fall: ts.count, bridgeTop: ts.count + 1, bridgeBottom: ts.count + 2 };
for (const [id, sourceTile, label, walk] of [[riverTiles.fall, 123, "폭포 · World 123", false], [riverTiles.bridgeTop, 102, "나무다리 윗줄 · World 102", true], [riverTiles.bridgeBottom, 103, "나무다리 아랫줄 · World 103", true]]) {
  ts.tileGrafts.push({ sourceChipset: "tex_easyrpg_chipset_world", sourceTile, targetTile: id });
  ts.priority[id] = "lower";
  ts.terrain[id] = 0;
  ts.passability[id] = { up: walk, down: walk, left: walk, right: walk };
  ts.tileMeta[id] = { label, description: walk ? "강을 가로지르는 2행 다리. 윗줄102·아랫줄103을 강폭만큼 반복한다." : "절벽 면을 대신하는 폭포. 윗선 칸은 물, 면·밑단 칸이 폭포다. 번들 칩셋이라 정지 그림(첫 프레임).", role: walk ? "bridge" : "water", defaultLayer: "lower", source: "user", userLocked: true, passage: walk ? "passable" : "solid" };
}
ts.count += 30;
while (ts.terrain.length < ts.count) ts.terrain.push(0);
while (ts.priority.length < ts.count) ts.priority.push("lower");
while (ts.passability.length < ts.count) ts.passability.push({ up: false, down: false, left: false, right: false });
while (ts.tileMeta.length < ts.count) ts.tileMeta.push({ label: "미사용", source: "unknown" });
let forest, reach;
await withTsModule("src/editor/tools/village/forestContour.ts", "diverse-forest.mjs", (m) => {
  forest = m;
});
await withTsModule("src/project/lint/reachability.ts", "diverse-reach.mjs", (m) => {
  reach = m;
});
const plans = [
  { id: "pine-hamlets", name: "솔바람 흩어진 산촌", width: 80, height: 64, seed: 191, start: { x: 40, y: 60 }, note: "숲에서 숲까지 이어진 절벽 위 윗단과 아랫마을, 계단 세 곳, 갈라지는 오솔길과 작은 샘", houses: [[12, 9, 3], [33, 6, 0], [61, 12, 7], [17, 31, 5], [44, 28, 1], [61, 43, 6], [29, 47, 2]], cliffs: [{ points: [[6,21],[10,21],[12,20],[22,20],[24,19],[30,19],[32,18],[46,18],[48,19],[52,19],[55,22],[70,22],[72,21],[76,21]], height: 5 }], stairs: [[16, 20, 5], [39, 18, 5], [62, 22, 5]], ponds: [[10, 47, 5, 4]], spine: [[40, 60], [40, 54], [38, 43], [31, 33], [19, 29], [31, 33], [39, 26], [39, 16], [24, 17], [39, 16], [52, 17], [62, 20], [62, 30], [56, 37], [66, 36]], farms: [[20, 41, 6, 4], [37, 13, 6, 4]], trees: 28 },
  { id: "terrace-cliff-village", name: "층바위 절벽마을", width: 88, height: 72, seed: 347, start: { x: 42, y: 68 }, note: "세 높이의 대지, 네 계단과 절벽 아래 작업 마당", houses: [[27, 9, 0], [49, 11, 4], [13, 29, 1], [37, 33, 7], [65, 36, 5], [18, 55, 2], [47, 59, 6], [70, 56, 3]], cliffs: [{ points: [[7,45],[14,45],[16,46],[28,46],[30,47],[40,47],[42,46],[56,46],[58,45],[83,45]], height: 6 }, { points: [[19,21],[30,21],[32,20],[36,20],[38,21],[44,21],[46,22],[58,22],[60,21],[66,21],[68,20],[74,20]], height: 6 }], stairs: [[34, 20, 6], [62, 21, 6], [26, 46, 6], [45, 46, 6]], ponds: [], spine: [[42, 68], [42, 63], [27, 56], [27, 53], [27, 40], [34, 31], [34, 27], [34, 18], [62, 19], [62, 28], [60, 40], [46, 44], [46, 53], [46, 58], [70, 66]], farms: [[43, 40, 9, 4], [11, 41, 8, 3]], trees: 28, cave: null},
  { id: "twin-falls-river-village", name: "두 폭포 강마을", width: 88, height: 72, seed: 733, start: { x: 24, y: 68 }, note: "북쪽 숲에서 나온 강이 마을 한가운데를 흐르며 두 줄 절벽에서 폭포로 떨어지고, 단마다 다리가 양쪽 강둑을 잇는다", houses: [[14, 6, 4], [58, 8, 7], [12, 31, 0], [30, 29, 5], [52, 30, 6], [70, 30, 1], [10, 55, 2], [58, 56, 3]], cliffs: [{ points: [[6,21],[12,21],[14,20],[36,20],[38,19],[50,19],[52,20],[70,20],[72,21],[82,21]], height: 6 }, { points: [[6,45],[16,45],[18,44],[36,44],[38,43],[48,43],[50,44],[68,44],[70,45],[82,45]], height: 6 }], stairs: [[26, 20, 6], [62, 20, 6], [22, 44, 6], [64, 44, 6]], ponds: [], river: { width: 4, pools: [[43,29,5.5,3.2],[41,53,6,3.4]], points: [[44,0],[44,5],[42,7],[42,13],[43,14],[43,31],[40,34],[40,40],[41,41],[41,57],[44,60],[44,66],[45,67],[45,71]] }, bridges: [[40, 9, 4], [38, 36, 4], [42, 62, 4]], spine: [[24, 70], [24, 60], [22, 52], [22, 42], [30, 38], [26, 28], [26, 18], [30, 12], [38, 10], [48, 10], [56, 15], [62, 18], [62, 28], [50, 38], [64, 42], [64, 52], [54, 62], [36, 63], [24, 60]], farms: [[18, 58, 6, 4]], trees: 20 },
  { id: "reed-bay-village", name: "갈대물굽이 포구", width: 88, height: 64, seed: 521, start: { x: 6, y: 33 }, note: "물굽이를 따라 비껴 앉은 집, 좁은 골목과 긴 선착장", houses: [[11, 9, 3], [31, 5, 7], [52, 12, 0], [12, 30, 1], [34, 22, 5], [52, 31, 6], [12, 42, 2], [34, 39, 4]], cliffs: [{ points: [[7,19],[12,19],[14,18],[26,18],[29,15],[41,15]], height: 5, rightFrom: 8 }], stairs: [[18, 18, 5], [31, 15, 5]], ponds: [], coast: true, spine: [[6, 33], [21, 36], [26, 29], [19, 24], [26, 29], [32, 23], [48, 26], [48, 40], [56, 43], [57, 47]], farms: [[20, 13, 4, 4], [25, 47, 6, 4]], trees: 18, dock: [56, 45, 21, 2] },
  { id: "chapel-hill-parish", series: "concept", name: "종탑 언덕 교구마을", width: 80, height: 64, seed: 811, start: { x: 40, y: 60 }, note: "윗단 언덕에 스테인드글라스 교회와 울타리 친 외곽 묘지가 있고, 북쪽에서 온 강이 절벽을 폭포로 넘어 아랫마을을 가로지른다", houses: [[46, 7, 3, 85], [66, 6, 0, 85], [10, 32, 1, 85], [24, 35, 4, 86], [46, 33, 2, 85], [12, 50, 0, 86], [46, 50, 7, 87]], landmarks: [["church", 30, 5], ["graveyard", 10, 7]], cliffs: [{ points: [[6,22],[20,22],[22,21],[34,21],[36,22],[74,22]], height: 5 }], stairs: [[26, 21, 5], [40, 22, 5]], ponds: [], river: { width: 4, pools: [[59,30,5,3]], points: [[60,0],[60,8],[59,12],[59,30],[60,36],[64,42],[66,50],[66,63]] }, bridges: [[57, 14, 4]], spine: [[40, 60], [40, 44], [40, 28], [40, 20], [33, 16], [22, 18], [14, 16], [22, 18], [27, 20], [33, 16], [48, 16], [56, 15], [66, 16], [48, 16], [40, 20], [40, 32], [53, 31], [40, 32], [40, 44], [20, 44], [14, 47], [20, 44], [40, 44], [52, 44]], farms: [[24, 50, 6, 4]], trees: 20 },
  { id: "ford-castle-town", series: "concept", name: "여울성 나루", width: 100, height: 92, seed: 907, start: { x: 48, y: 88 }, note: "맨 윗단에 두 겹 성벽·둥근 탑·층층 궁을 갖춘 작은 성(왕궁이 있는 이중 성벽 도시의 내성을 줄인 것)이 서고, 동쪽 강이 두 줄 절벽에서 폭포로 떨어지며 성 아랫마을 세 단을 다리로 잇는다", houses: [[12, 12, 7, 87], [89, 14, 3, 87], [16, 31, 0, 87], [10, 54, 0, 86], [26, 55, 2, 87], [58, 53, 4, 86], [90, 55, 5, 86], [12, 78, 1, 86], [52, 79, 0, 87], [62, 80, 2, 86]], landmarks: [["castle", 29, 4]], cliffs: [{ points: [[6,45],[40,45],[42,44],[58,44],[60,45],[94,45]], height: 6 }, { points: [[6,69],[30,69],[32,68],[52,68],[54,69],[94,69]], height: 6 }], stairs: [[48, 44, 6], [22, 45, 6], [36, 68, 6], [66, 69, 6]], ponds: [], river: { width: 4, pools: [[84,55,5,3],[83,79,5.5,3.2]], points: [[84,0],[84,20],[83,24],[83,56],[84,60],[84,64],[83,66],[83,82],[81,86],[81,91]] }, bridges: [[81, 26, 4], [82, 62, 4]], spine: [[48, 90], [48, 84], [37, 77], [37, 66], [48, 63], [48, 52], [48, 41], [30, 41], [22, 43], [18, 40], [16, 22], [18, 40], [30, 41], [48, 41], [70, 41], [78, 30], [86, 28], [91, 22], [86, 28], [78, 30], [70, 41], [48, 41], [48, 52], [48, 63], [20, 63], [48, 63], [72, 63], [81, 63], [92, 63], [72, 63], [66, 77], [64, 89], [48, 87], [20, 88], [48, 87]], farms: [], trees: 20 },
  { id: "mistpond-hollow", series: "concept", name: "안개못 폐촌", width: 80, height: 64, seed: 613, start: { x: 40, y: 60 }, note: "사람이 떠난 마을 한가운데 울타리 친 못과 섬 위 석상이 남았고, 서쪽 강이 절벽을 폭포로 넘어 흐르며 외곽에 잊힌 묘지가 있다", houses: [[6, 5, 3, 88], [52, 5, 3, 88], [20, 26, 2, 88], [54, 27, 1, 88], [22, 47, 0, 88], [58, 46, 4, 88], [44, 48, 5, 86]], landmarks: [["shrine-pond", 33, 29], ["graveyard-small", 66, 33]], cliffs: [{ points: [[6,18],[24,18],[26,17],[46,17],[48,18],[74,18]], height: 5 }], stairs: [[30, 17, 5], [62, 18, 5]], ponds: [], river: { width: 4, pools: [[15,26,4.5,2.8]], points: [[16,0],[16,10],[15,12],[15,30],[14,36],[14,63]] }, bridges: [[13, 12, 4]], spine: [[40, 62], [40, 44], [40, 42], [40, 44], [26, 44], [25, 38], [30, 30], [30, 24], [30, 15], [20, 14], [9, 14], [20, 14], [30, 15], [50, 15], [54, 14], [62, 16], [62, 26], [58, 37], [50, 44], [40, 44], [56, 44], [62, 44], [69, 42]], farms: [], trees: 16 }
];
const terrainDetails = {
  'pine-hamlets': { entrance:{x:40,y:63}, crest:{x:9,y:4,width:20,shoulder:3}, patches:[[5,12,12,9,9],[43,3,10,9,10],[76,19,10,14,8]], clearings:[[20,8,9,6,9]] },
  'terrace-cliff-village': { entrance:{x:42,y:71}, crest:{x:26,y:4,width:39,shoulder:3}, patches:[[9,13,13,10,11],[76,9,13,12,11],[40,1,12,7,9]], clearings:[[44,8,22,6,12],[4,34,6,8,7]] },
  'twin-falls-river-village': { entrance:{x:24,y:71}, crest:null, patches:[[4,10,10,12,10],[84,10,10,12,10],[4,60,8,10,9],[84,62,8,10,9]], clearings:[[26,12,12,6,8],[62,12,12,6,8],[20,34,12,6,8],[62,34,12,6,8],[24,60,12,6,8],[62,60,12,6,8]] },
  'chapel-hill-parish': { entrance:{x:40,y:63}, crest:null, patches:[[3,30,8,14,10],[77,30,8,14,10],[73,40,6,10,10],[70,58,10,8,9],[4,60,8,8,9]], clearings:[[33,10,12,8,10],[16,10,9,6,9],[30,42,20,8,10]] },
  'ford-castle-town': { entrance:{x:48,y:91}, crest:null, patches:[[4,10,8,16,10],[96,8,8,16,10],[4,86,8,8,9],[96,88,8,8,9],[74,8,5,6,8]], clearings:[[49,20,26,16,14],[18,20,10,8,9],[48,58,30,7,10],[40,84,26,6,10]] },
  'mistpond-hollow': { entrance:{x:40,y:63}, crest:null, patches:[[3,40,8,14,10],[77,20,6,12,9],[76,56,8,8,9],[4,60,8,6,9],[38,5,9,4,10]], clearings:[[40,34,12,10,12],[48,52,14,6,9]] },
  'reed-bay-village': { entrance:{x:0,y:33}, crest:{x:9,y:4,width:17,shoulder:3}, patches:[[3,12,10,12,12],[46,2,14,8,10],[66,22,9,12,9]], clearings:[[20,8,11,6,8]] },
};
for (const p of plans) Object.assign(p,terrainDetails[p.id]);
const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const houseSources = original.layoutPlan.regions.filter((r) => r.role === "house");
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const roadGroup = group("forest_harmony_road_47"), waterGroup = group("forest_harmony_lake_47");
delete ts.referenceDocuments;
const result = { tileset: ts, cliffBindings: cliff, grassBindings, riverTiles, plans: [], maps: {} };
for (const spec of plans.filter((p) => !process.env.VILLAGE_ONLY || p.id === process.env.VILLAGE_ONLY)) {
  const W = spec.width, H = spec.height, area = { x: 0, y: 0, w: W, h: H }, m = { id: spec.id, name: spec.name, width: W, height: H, tileSize: 16, tilesetId: ts.id, lowerTiles: Array(W * H).fill(240), upperTiles: Array(W * H).fill(-1), events: [] };
  lastMap = m;
  const point = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const reserved = new Set(), roads = new Set(), water = new Set(), houses = [], placements = [], access = [];
  const reserve = (x, y, w, h, pad = 0) => {
    for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inside(xx, yy)) reserved.add(point(xx, yy));
  };
  const cliffPlan = paintVillageCliffs(m, spec.cliffs, cliff);
  // A cliff only reads as height when its ends die into forest: the terrace is reachable by stairs alone.
  const wings = new Set();
  for (const c of spec.cliffs) for (const side of ["left", "right"]) {
    if (c[side] === "open") continue;
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
      m.lowerTiles[i] = cliff[374];
      m.upperTiles[i] = -1;
    }
    reserve(x, y - 1, 2, height + 3, 1);
    access.push({ role: "stairs-top", x, y: y - 1 }, { role: "stairs-bottom", x, y: y + height + 1 });
  }
  // River: a 'width'-wide brush along the centerline. Where it crosses a cliff the rim cell becomes water and the
  // face cells below it become waterfall; the pool continues under the toe.
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
    // Plunge pools under the falls: wider water on the lower tier only, never on a cliff face.
    for (const [cx, cy, rx, ry] of spec.river.pools ?? []) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (inside(x, y) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && !cliffPlan.cliff.has(point(x, y))) river.add(point(x, y));
    }
    for (const i of river) {
      const x = i % W, y = Math.floor(i / W);
      assert(m.lowerTiles[i] !== cliff[374], "River runs over a stair " + spec.id + " " + x + "," + y);
      if (!cliffPlan.cliff.has(i)) { water.add(i); continue; }
      const c = cliffPlan.columns.find((k) => k.x === x && y >= k.y && y <= k.y + k.height);
      m.upperTiles[i] = -1;
      if (y === c.y) water.add(i);
      else { m.lowerTiles[i] = riverTiles.fall; fallCells.add(i); }
      if (y === c.y) falls.push({ x, y: c.y, height: c.height, tile: riverTiles.fall });
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wet = spec.ponds.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + 0.12 * Math.sin(x + y)) || spec.coast && (y > 52 + 3 * Math.sin(x / 10) || x > 70 + 4 * Math.sin(y / 9));
    if (wet && cliffPlan.cells[point(x, y)] === "ground") water.add(point(x, y));
  }
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
  const bridgeCells = new Set();
  for (const [x, y, w] of spec.bridges ?? []) {
    for (let dx = 0; dx < w; dx++) for (const [dy, tile] of [[0, riverTiles.bridgeTop], [1, riverTiles.bridgeBottom]]) {
      const i = point(x + dx, y + dy);
      assert(water.has(i), "Bridge must stand on the river " + spec.id + " " + (x + dx) + "," + (y + dy));
      m.lowerTiles[i] = tile;
      bridgeCells.add(i);
    }
    for (const dy of [0, 1]) for (const [ax, role] of [[x - 1, "bridge-west"], [x + w, "bridge-east"]]) {
      assert(!water.has(point(ax, y + dy)), "Bridge end lands in water " + spec.id + " " + ax + "," + (y + dy));
      if (dy === 0) access.push({ role, x: ax, y });
    }
  }
  for (const [n, [x, y, template, windowTile]] of spec.houses.entries()) {
    const h = houseSources[template];
    for (let dy = 0; dy < h.h; dy++) for (let dx = 0; dx < h.w; dx++) {
      const to = point(x + dx, y + dy), from = (h.y + dy) * 88 + h.x + dx;
      assert.equal(m.upperTiles[to], -1, `House overlaps cliff ${spec.id} ${x + dx},${y + dy}`);
      assert.equal(m.lowerTiles[to], 240, `House overlaps relief ${spec.id} ${x + dx},${y + dy}`);
      m.lowerTiles[to] = original.lowerTiles[from];
      m.upperTiles[to] = original.upperTiles[from];
    }
    // The 1x2 doorway: keep the source bottom tile, the cell above it is solid black (source 329 above 359).
    const doorTop = point(x + h.doorAt.x - h.x, y + h.doorAt.y - h.y - 1);
    if (m.lowerTiles[doorTop] === 359) m.lowerTiles[doorTop] = 329;
    // One window kind per house; 88 (broken) marks an abandoned house, whose wall also grows a vine.
    const cellsOf = Array.from({ length: h.w * h.h }, (_, k) => point(x + k % h.w, y + Math.floor(k / h.w)));
    if (windowTile !== undefined) for (const i of cellsOf) if (WINDOWS.has(m.upperTiles[i])) m.upperTiles[i] = windowTile;
    const kinds = [...new Set(cellsOf.map((i) => m.upperTiles[i]).filter((t) => WINDOWS.has(t)))];
    assert(kinds.length <= 1, "House mixes window kinds " + spec.id + " " + x + "," + y);
    const abandoned = kinds[0] === 88, vines = [];
    if (abandoned) {
      const column = cellsOf.find((i) => WALLS.has(m.lowerTiles[i]) && m.upperTiles[i] === -1 && WALLS.has(m.lowerTiles[i + W]) && m.upperTiles[i + W] === -1 && Math.abs(i % W - (x + h.doorAt.x - h.x)) > 1);
      assert(column !== undefined, "Abandoned house without a bare wall " + spec.id);
      m.upperTiles[column] = 265;
      m.upperTiles[column + W] = 295;
      vines.push({ x: column % W, y: Math.floor(column / W), tiles: [265, 295] });
    }
    const house = { id: spec.id + "-house-" + (n + 1), role: "house", label: (abandoned ? "폐가 · " : "") + h.label, window: kinds[0] ?? null, abandoned, vines, x, y, w: h.w, h: h.h, template, doorAt: { x: x + h.doorAt.x - h.x, y: y + h.doorAt.y - h.y }, front: { x: x + h.front.x - h.x, y: y + h.front.y - h.y } };
    const program=PROP_PROGRAMS.houses[spec.id]?.[x+","+y];
    assert(program,"Missing authored house purpose");
    Object.assign(house,program);
    houses.push(house);
    reserve(x, y, h.w, h.h, 2);
    reserve(house.front.x, house.front.y, 1, 3, 2);
    access.push({ role: "door-front", ...house.front });
  }
  // Landmarks: whole buildings (church, castle) and fenced yards (graveyard, fenced pond), stamped as one unit.
  const landmarks = [], landmarkSolid = new Set(), pondCells = new Set();
  for (const [kind, x, y] of spec.landmarks ?? []) {
    const b = landmarkDefs.buildings[kind], yd = landmarkDefs.yards[kind], def = b ?? yd;
    assert(def, "Unknown landmark " + kind);
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
        // Same ring as the lake village's yards: 408 on both sides, 438 … 439 … 409·410 along the bottom.
        if (dx < gx || dx >= gx + gw) m.upperTiles[at(dx, bottom)] = dx === 0 ? 438 : dx === yd.w - 1 ? 410 : dx === yd.w - 2 ? 409 : 439;
      }
      for (let dy = 1; dy < bottom; dy++) { m.upperTiles[at(0, dy)] = 408; m.upperTiles[at(yd.w - 1, dy)] = 408; }
      if (yd.pond) {
        const [cx, cy, rx, ry] = yd.pond, [x0, y0, x1, y1] = yd.pondBounds, island = new Set(yd.island.map(([dx, dy]) => at(dx, dy)));
        for (let dy = y0; dy <= y1; dy++) for (let dx = x0; dx <= x1; dx++) if (((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 <= 1 + 0.14 * Math.sin(dx * 1.7 + dy * 2.3) && !island.has(at(dx, dy))) pondCells.add(at(dx, dy));
      }
      // A pond cell with fewer than two wet sides is a one-tile spur; trim until the shore is smooth.
      for (let trimmed = true; trimmed;) {
        trimmed = false;
        for (const i of pondCells) if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => pondCells.has(i + ox + oy * W)).length < 2) { pondCells.delete(i); trimmed = true; }
      }
      for (const [dx, dy, t] of yd.contents) m.upperTiles[at(dx, dy)] = t;
      entry.gate = { x: x + gx, y: y + bottom, w: gw };
      access.push({ role: "yard-gate", x: x + gx, y: y + yd.h, landmarkId: id }, { role: "yard-inside", x: x + gx, y: y + bottom - 1, landmarkId: id });
      reserve(x, y, yd.w, yd.h + 1, 1);
    }
    landmarks.push(entry);
    placements.push({ name: def.label, x, y, w: def.w, h: def.h, kind: "landmark", landmarkId: id, lower: Array.from({ length: def.w * def.h }, (_, k) => m.lowerTiles[at(k % def.w, Math.floor(k / def.w))]), upper: Array.from({ length: def.w * def.h }, (_, k) => m.upperTiles[at(k % def.w, Math.floor(k / def.w))]) });
  }
  if (pondCells.size) {
    paintGroup(pondCells, waterGroup);
    for (const p of placements.filter((o) => o.kind === "landmark")) p.lower = Array.from({ length: p.w * p.h }, (_, k) => m.lowerTiles[point(p.x + k % p.w, p.y + Math.floor(k / p.w))]);
  }
  const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
  const solid = new Set(landmarkSolid);
  for (const h of houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) solid.add(point(x, y));
  for (let i = 0; i < W * H; i++) if (water.has(i) && !bridgeCells.has(i) || wings.has(i) || cliffPlan.cliff.has(i) && m.lowerTiles[i] !== cliff[374]) solid.add(i);
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
  connect([spec.entrance.x,spec.entrance.y],spec.spine[0]);
  // Width three at the map edge, tapering into the two-cell road.
  const vertical = spec.entrance.y===H-1;
  for(let depth=0;depth<5;depth++) for(let lane=-1;lane<=1;lane++) {
    const x=spec.entrance.x+(vertical?lane:depth), y=spec.entrance.y+(vertical?-depth:lane);
    assert(!solid.has(point(x,y)), 'Entrance corridor intersects terrain');
    roads.add(point(x,y)); access.push({role:'map-entrance',x,y});
  }
  for (let n = 1; n < spec.spine.length; n++) connect(spec.spine[n - 1], spec.spine[n]);
  for (const h of houses) {
    const a = [h.front.x, h.front.y], nearest = spec.spine.reduce((b, q) => Math.hypot(q[0] - a[0], q[1] - a[1]) < Math.hypot(b[0] - a[0], b[1] - a[1]) ? q : b);
    connect(a, nearest);
  }
  for (const p of access.filter((p2) => p2.role.startsWith("stairs") || p2.role.startsWith("bridge") || p2.role === "landmark-door" || p2.role === "yard-gate")) connect([p.x, p.y], spec.spine.reduce((b, q) => Math.hypot(q[0] - p.x, q[1] - p.y) < Math.hypot(b[0] - p.x, b[1] - p.y) ? q : b));
  const centerRoads = [...roads];
  for (const i of centerRoads) {
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const ni = point(x + dx, y + dy);
      if (inside(x + dx, y + dy) && !solid.has(ni) && m.lowerTiles[ni] === 240) roads.add(ni);
    }
  }
  const roadPaint = new Set([...roads].filter((i) => m.lowerTiles[i] !== cliff[374] && !bridgeCells.has(i)));
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
    m.upperTiles[point(x, y)] = cliff[413];
    reserve(x, y, 1, 3, 2);
    access.push({ role: "cave-approach", x, y: y + 2 });
  }
  const grassJoins=[];
  const crest=spec.crest;
  for(let dx=0;dx<(crest?.width??0);dx++) {
    const end=crest.width-1-dx, x=crest.x+dx;
    const y=crest.y+Math.max(0,crest.shoulder-Math.min(dx,end));
    const sourceTile=dx<=crest.shoulder?504:end<=crest.shoulder?505:559;
    const i=point(x,y),tile=grassBindings[sourceTile];
    assert(m.lowerTiles[i]===240&&m.upperTiles[i]===-1&&!roads.has(i),'Complete crest overlaps reserved content '+spec.id+' '+x+','+y);
    m.lowerTiles[i]=tile; reserve(x,y,1,1,1);
    grassJoins.push({x,y,sourceTile,tile,layer:'lower',backing:240,upper:-1});
  }
  const field=(x,y)=> {
    const influence=([cx,cy,rx,ry,strength])=>strength*Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2));
    return forest.forestContourScore(x,y,area,spec.seed,0.48)
      +spec.patches.reduce((v,p)=>v+influence(p),0)-spec.clearings.reduce((v,p)=>v+influence(p),0)
      +(wings.has(point(Math.floor(x),Math.floor(y)))?50:0);
  };
  const grove = forest.paintContouredForest(m, area, group("forest_harmony_grove_47"), (x,y)=>m.lowerTiles[point(x,y)]===240 && m.upperTiles[point(x,y)]===-1 && !reserved.has(point(x,y)), spec.seed, 0.48, undefined, field);
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
      const lower = farmlandTiles(w, h);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) m.lowerTiles[point(x + dx, y + dy)] = lower[dy * w + dx];
      reserve(x, y, w, h);
      placements.push({ name: "텃밭", x, y, w, h, kind: "farm", lower, upper: Array(w * h).fill(-1) });
    }
  }
  // Retain the already approved individual trees exactly while reorganizing props.
  // VILLAGE_BARE=1 (layout iteration): leave out kept trees and civic places so new ones can be fitted to a changed layout.
  const retained=process.env.VILLAGE_BARE?[]:JSON.parse(fs.readFileSync('tiledata/forest-villages/diverse/retained-vegetation.json'))[spec.id]??[];
  for(const o of retained) {
    // Terrain moved under a kept tree (cliff/forest rework): drop that tree rather than cut it.
    if(!freeRect(o.x,o.y,o.w,o.h)) continue;
    stamp(o.name,o.x,o.y,o.w,o.h,o.lower,o.upper,o.kind);
  }
  const activitySites={...(spec.dock?{dock:{x:spec.dock[0],y:spec.dock[1],w:spec.dock[2],h:spec.dock[3]}}:{}),...(()=>{const farm=placements.find(o=>o.kind==='farm');return farm?{farm:{x:farm.x,y:farm.y,w:farm.w,h:farm.h}}:{};})()};
  const household=placeHouseholdProps({map:m,houses,parts,roads,access,cliffCells:cliffPlan.cliff,reachable:reach.computeReachableCells(project,m,spec.start.x,spec.start.y),stamp,sites:activitySites});
  for(const o of household.placed) Object.assign(placements.find(p=>p.kind==='prop'&&p.x===o.x&&p.y===o.y),{ownerId:o.ownerId,kit:o.kit,purpose:o.purpose,anchor:o.anchor,side:o.side});
  let reachable = reach.computeReachableCells(project, m, spec.start.x, spec.start.y);
  const rejectedOwners=new Set(placements.filter(o=>o.kind==='prop'&&!Array.from({length:o.w*o.h},(_,i)=>[o.x+i%o.w,o.y+Math.floor(i/o.w)]).some(([x,y])=>reach.isAdjacentOrOn(reachable,x,y))).map(o=>o.ownerId));
  for(let n=placements.length-1;n>=0;n--) {const o=placements[n];if(o.kind==='prop'&&rejectedOwners.has(o.ownerId)){for(let dy=0;dy<o.h;dy++)for(let dx=0;dx<o.w;dx++)m.upperTiles[point(o.x+dx,o.y+dy)]=-1;placements.splice(n,1);}}
  reachable = reach.computeReachableCells(project, m, spec.start.x, spec.start.y);
  const blocked = access.filter((a) => !reachable.has(a.x + "," + a.y));
  assert.equal(blocked.length, 0, "Blocked " + spec.id + ": " + JSON.stringify(blocked));
  const civicPlan={houses,landmarks,placements,activitySites,roadCells:[...roads],access,entrance:spec.entrance};
  const civic=process.env.VILLAGE_BARE||process.env.VILLAGE_NOCIVIC?{zones:[]}:placeCivicProps({map:m,plan:civicPlan,parts,project,reach});
  reachable=reach.computeReachableCells(project,m,spec.start.x,spec.start.y);
  {
    const shut = structuredClone(m);
    for (const [x, y, height] of spec.stairs) for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) shut.lowerTiles[point(xx, yy)] = cliff[172];
    const below = reach.computeReachableCells({ tilesets: { [ts.id]: ts }, maps: { [m.id]: shut } }, shut, spec.start.x, spec.start.y);
    const leaks = [...below].map((k) => k.split(",").map(Number)).filter(([x, y]) => cliffPlan.cells[point(x, y)] === "plateau");
    assert.equal(leaks.length, 0, "Terrace reachable without stairs " + spec.id + " " + JSON.stringify(leaks.slice(0, 6)));
  }
  // Leaf interior by depth over the finished canopy (forestGrove.ts); a pure function of the canopy mask.
  forest.shadeForestCanopy(m, group("forest_harmony_grove_47"));
  m.layoutPlan = { version: 1, kind: "diverse-village-reference", seed: spec.seed, regions: houses, notes: spec.note, entrance:spec.entrance, civicPlaces:civic.zones, landmarks };
  result.maps[m.id] = m;
  result.plans.push({ ...spec, falls, houses, landmarks, placements, activitySites, civicPlaces:civic.zones, yards:household.yards.filter(y=>!rejectedOwners.has(y.ownerId)), access, grassJoins, grove: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns }, reachableCells: reachable.size, cliffColumns: cliffPlan.columns, roadCells: [...roads] });
  console.log(spec.id, { houses: houses.length, objects: placements.length, forest: grove.canopyCells, reachable: reachable.size });
}
fs.writeFileSync(path.join(out, "authored.json"), JSON.stringify(result));
