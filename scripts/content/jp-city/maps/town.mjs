#!/usr/bin/env node
// jp_city 예제 맵 ② 동네 한 장(역 앞·상점가·주택가·신사·학교·공원) — 코드로 까는 생성기 + 검사기.
// 근거: tiledata/jp-city/research/README.md (생활도로 4칸·보도 없음·路側帯 흰 선·側溝, 전봇대 25~35칸·전선, 셔터 가게 1~2/10, 블록 담, 동네 거점 5~7곳).
//
//   node scripts/content/jp-city/maps/town.mjs            # 맵 생성·검사 → maps/out/town.{map,report}.json
//   node scripts/content/jp-city/maps/town.mjs --publish  # 검사 통과 시 지역 참고본(.oprn.json·스냅샷·장소 항목)도 쓴다
//
// 층: 1층 바닥(보도·생활도로·판석·자갈·잔디·주차) · 2층 노면 표시(투명 덧그림) · 3층 건물·소품 · 4층 전봇대·전선(건물 앞에 서므로 덮어 그린다).
// 건물은 손 도트 통 키트(jp-bldg-*), 오토타일(생활도로·선로·철망)은 엔진 autotileNeighborMask 로 칸마다 마스크를 계산해 쓴다.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..");
if (!process.env.TOWN_UNDER_TSX) {
  const r = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit", cwd: ROOT, env: { ...process.env, TOWN_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const OUT = join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });
const PUBLISH = process.argv.includes("--publish");

const { autotileNeighborMask, autotileVariantForMask, autotileVariantForCell } = await imp("src/project/defaults/autotileEngine.ts");
const { createJpCityTileset } = await imp("src/project/defaults/jpCity.ts");
const { createEmptyToolProject } = await imp("src/editor/tools/emptyProject.ts");
const { canMove, isPassable } = await imp("src/project/collision.ts");

const TS = createJpCityTileset();
const KIT = Object.fromEntries(TS.structureKits.map((k) => [k.id, k]));
const GRP = Object.fromEntries(TS.autotileGroups.map((g) => [g.id, g]));
const W = 96, H = 80;
const SW = 707, GRAVEL = 725, LAWN = 841, PAVE_A = 839, PAVE_B = 840, PARK_FLOOR = 721, PARK_LINE = 722;

const L1 = new Array(W * H).fill(SW), L2 = new Array(W * H).fill(-1), L3 = new Array(W * H).fill(-1), L4 = new Array(W * H).fill(-1);
const own3 = new Array(W * H).fill(""), own4 = new Array(W * H).fill(""), ground = new Array(W * H).fill("");
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const idx = (x, y) => y * W + x;
const issues = [];
const fail = (msg) => issues.push(msg);
const single = (id) => KIT[id].rows[0].upperTiles[0];

// ───────────────────────── 찍기 도구
const doors = [], solidCells = [], placed = [];
function stamp(id, x0, y0, { layer = 3, tag = id } = {}) {
  const k = KIT[id];
  if (!k) throw new Error("키트 없음 " + id);
  const own = layer === 4 ? own4 : own3, L = layer === 4 ? L4 : L3;
  for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
    const x = x0 + c, y = y0 + r;
    if (!inb(x, y)) continue;
    const t = k.rows[r].tiles[c], u = k.rows[r].upperTiles[c];
    if (t >= 0) L1[idx(x, y)] = t;
    if (u < 0) continue;
    if (own[idx(x, y)]) fail(`겹침 ${tag} 가 ${own[idx(x, y)]} 위에 (${x},${y}) ${layer}층`);
    own[idx(x, y)] = tag; L[idx(x, y)] = u;
    if (TS.passability[u] && !TS.passability[u].up && !TS.passability[u].down && TS.tileMeta[u]?.passage !== "star") solidCells.push([x, y, tag]);
  }
  placed.push({ id, x: x0, y: y0, w: k.width, h: k.height, layer });
  for (const p of k.parts ?? []) if (p.kind === "entrance") {
    const a = (k.ai?.access ?? []).find((q) => q.dx === p.dx) ?? { dx: p.dx, dy: p.dy + 1 };
    doors.push({ b: tag, x: x0 + p.dx, y: y0 + p.dy, ax: x0 + a.dx, ay: y0 + a.dy });
  }
}
// 발(왼쪽 아래 칸) 기준
const put = (id, x, yFoot, opt = {}) => stamp(id, x, yFoot - KIT[id].height + 1, opt);
const fillL1 = (x0, y0, x1, y1, t, tag) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { L1[idx(x, y)] = typeof t === "function" ? t(x, y) : t; if (tag) ground[idx(x, y)] = tag; } };
const checker = (x, y) => ((x + y) % 2 === 0 ? PAVE_A : PAVE_B);

// ───────────────────────── 1. 바닥 띠(위 → 아래)
// 선로(북쪽 끝): 자갈 + 가로 선로 + 남쪽 철망
fillL1(0, 0, W - 1, 2, GRAVEL, "rail-bed");
const RAIL_Y = 1, FENCE_Y = 2;
// 간선(동서 4줄) y14..17 · 남북 생활도로 서 x26..29, 동 x70..73 (y14..78) · 생활도로 1 y42..45 · 2 y55..58 · 3 y75..78
const AVE = [14, 17], LANE_EW = [[42, 45], [55, 58], [75, 78]], LANE_NS = [[26, 29], [70, 73]], NS_Y = [14, 78];
const SHOTENGAI = [29, 32];
const laneSet = new Set();
const addLane = (x, y) => { if (inb(x, y)) laneSet.add(idx(x, y)); };
for (let y = AVE[0]; y <= AVE[1]; y++) for (let x = 0; x < W; x++) addLane(x, y);
for (const [a, b] of LANE_EW) for (let y = a; y <= b; y++) for (let x = 0; x < W; x++) addLane(x, y);
for (const [a, b] of LANE_NS) for (let x = a; x <= b; x++) for (let y = NS_Y[0]; y <= NS_Y[1]; y++) addLane(x, y);
// 상점가 보행 길(판석) — 생활도로가 가로지르는 칸은 길로 남긴다
fillL1(0, SHOTENGAI[0], W - 1, SHOTENGAI[1], checker, "shotengai");
// 역 앞 광장(판석)
fillL1(30, 12, 54, 13, checker, "ekimae-plaza");

// ───────────────────────── 2. 건물·구역(뒷줄 = 위 먼저)
// 역 앞 줄(발 y=11)
put("jp-bldg-koban", 1, 11);
put("jp-bldg-row-ekimae", 8, 11);
put("jp-bldg-station-small", 34, 11);
put("jp-bldg-conbini", 49, 11);
// 코인 주차장 x60..70 y6..11
fillL1(60, 6, 70, 11, PARK_FLOOR, "coin-lot");
for (const x of [60, 65, 70]) for (let y = 6; y <= 11; y++) L1[idx(x, y)] = PARK_LINE;
put("jp-prop-car-white", 61, 10, { tag: "car-1" }); put("jp-prop-car-silver-r", 66, 10, { tag: "car-2" });
for (const x of [63, 68]) L2[idx(x, 11)] = single("jp-mark-lockplate");
put("jp-prop-coin-sign", 70, 7, { tag: "coin-sign" });
put("jp-bldg-post-office", 72, 11);
put("jp-bldg-clinic", 82, 11);
put("jp-prop-vend-pair", 92, 11, { tag: "vend-ekimae" });

// 상점가 북쪽 줄(발 y=28, 문은 상점가 판석 길을 본다)
put("jp-bldg-row-shotengai-b", 0, 28);
put("jp-prop-arch-shotengai", 24, 22, { tag: "arch-west" });          // 간선 → 서쪽 골목 입구 아치(기둥 x24·x31)
put("jp-bldg-row-shutter-a", 33, 28);
put("jp-bldg-shop-barber", 62, 28);
put("jp-prop-arch-shotengai2", 68, 22, { tag: "arch-east" });         // 동쪽 골목 입구 아치(남口)
put("jp-bldg-row-shotengai-d", 76, 28);

// 둘째 줄(발 y=41, 문은 생활도로 1)
put("jp-bldg-sento", 0, 41);
put("jp-bldg-coin-laundry", 12, 41);
put("jp-jizo", 21, 41, { tag: "jizo" });
put("jp-prop-vending-aka", 22, 41, { tag: "vend-b" });
put("jp-mirror2", 24, 41, { tag: "mirror-b" });
put("jp-bldg-row-shotengai-c", 33, 41);
put("jp-bldg-machikoba-home", 59, 41);
put("jp-mirror2", 68, 41, { tag: "mirror-c" });
put("jp-bldg-supermarket", 75, 41);
put("jp-bldg-shop-tabako", 90, 41);

// 주택가(발 y=53, 담·대문 줄 y=54, 문은 생활도로 2)
const HOUSES = [
  ["jp-bldg-house-hip2", 0, "wall"], ["jp-bldg-house-shed-modern", 10, "fence"], ["jp-bldg-apart-wood2", 31, null], ["jp-bldg-house-tile3", 46, "wall"],
  ["jp-bldg-house-gable-garage", 54, null], ["jp-bldg-house-machiya", 62, null], ["jp-bldg-house-western", 74, "wall"], ["jp-bldg-house-nisetai", 84, "wall"],
];
const WALL_Y = 54;
for (const [id, x, wall] of HOUSES) {
  put(id, x, wall === "fence" ? 52 : 53);
  if (!wall) continue;
  const k = KIT[id];
  const doorCols = new Set((k.parts ?? []).filter((p) => p.kind === "entrance").map((p) => x + p.dx));
  const x0 = x, x1 = x + k.width - 1;
  for (let wx = x0; wx <= x1; wx++) {
    if (doorCols.has(wx)) continue;                                     // 대문 자리(문 앞 접근칸)
    const left = wx === x0 || doorCols.has(wx - 1), right = wx === x1 || doorCols.has(wx + 1);
    if (doorCols.has(wx + 1) && wall === "wall") { put("jp-gatepost", wx, WALL_Y, { tag: "gatepost-" + id }); continue; }
    if (wall === "wall") put(left ? "jp-bwall-end-l" : right ? "jp-bwall-end-r" : ((wx - x0) % 4 === 2 ? "jp-bwall-sukashi" : "jp-bwall-plain"), wx, WALL_Y, { tag: "wall-" + id });
    else put(left ? "jp-bwallf-end-l" : right ? "jp-bwallf-end-r" : "jp-bwallf-plain", wx, WALL_Y, { tag: "fence-" + id });
  }
}
put("jp-prop-car-white-r", 18, 54, { tag: "carport-car" });
put("jp-carport", 19, 54, { tag: "carport", layer: 4 });
put("jp-propane", 23, 53, { tag: "propane" });

put("jp-pots", 69, 54, { tag: "pots-b" });

// 남쪽 띠(y59..74): 신사(서) · 학교(가운데) · 공원(동)
fillL1(0, 59, 25, 74, GRAVEL, "shrine");
fillL1(30, 70, 69, 73, GRAVEL, "schoolyard");
fillL1(74, 59, 95, 74, LAWN, "park");
put("jp-bldg-shrine-haiden", 9, 65);
fillL1(12, 66, 13, 74, checker, "sando");                             // 참배길(판석) — 도리이 가운데 두 칸 → 拝殿 앞
put("jp-torii", 11, 71, { tag: "torii" });
put("jp-prop-stone-lantern", 10, 68, { tag: "lantern-l" }); put("jp-prop-stone-lantern", 15, 68, { tag: "lantern-r" });
put("jp-prop-tree-sakura", 1, 66, { tag: "sakura-1" }); put("jp-prop-tree-zelkova", 21, 66, { tag: "zelkova-1" });
put("jp-prop-tree-zelkova", 2, 73, { tag: "zelkova-2" }); put("jp-prop-tree-sakura", 22, 74, { tag: "sakura-2" });
put("jp-keijiban", 6, 74, { tag: "keijiban-shrine" });
put("jp-bldg-school", 31, 69);
put("jp-bldg-school-gym", 54, 69);
put("jp-school-gate", 38, 74, { tag: "school-gate" });
// 공원
put("jp-prop-tree-sakura", 75, 64, { tag: "park-sakura-1" }); put("jp-prop-tree-sakura", 90, 64, { tag: "park-sakura-2" });
put("jp-prop-tree-zelkova", 82, 63, { tag: "park-zelkova" });
put("jp-prop-swing", 78, 70, { tag: "swing" }); put("jp-prop-slide", 82, 70, { tag: "slide" }); put("jp-prop-sandbox", 85, 70, { tag: "sandbox" });
put("jp-prop-bench", 83, 74, { tag: "bench-1" }); put("jp-prop-bench", 79, 74, { tag: "bench-2" }); put("jp-keijiban", 92, 74, { tag: "keijiban-park" });

// ───────────────────────── 3. 생활도로·선로·철망(오토타일)
const laneG = GRP["jp-lane-road"], railG = GRP["jp-rail-track"], fenceG = GRP["jp-fence-mesh"];
const kitLaneIds = new Set(TS.tileMeta.map((m, i) => ((m.label ?? "").startsWith("생활도로") ? i : -1)).filter((i) => i >= 0));
const laneConnect = new Set([...laneG.memberTileIds, ...kitLaneIds]);
// 간선 횡단보도(역 앞) — 키트가 길 4줄을 대신한다
const CW = { x: 39, y: AVE[0] };
stamp("jp-road-lane-crosswalk-h", CW.x, CW.y, { tag: "crosswalk" });
const inCw = (x, y) => x >= CW.x && x < CW.x + 6 && y >= CW.y && y < CW.y + 4;
const laneCells = [...laneSet].map((i) => [i % W, Math.floor(i / W)]).filter(([x, y]) => !inCw(x, y));
for (const [x, y] of laneCells) {
  if (own3[idx(x, y)] && !own3[idx(x, y)].startsWith("arch") && !own3[idx(x, y)].startsWith("car")) { /* 아치·차는 길 위에 선다 */ }
  L1[idx(x, y)] = laneG.variantMap["255"]; ground[idx(x, y)] = "lane";
}
const view1 = { width: W, height: H, lowerTiles: L1 };
function shape(group, view, cellsList, connectSet, edge) {
  const nb = group.neighborhood ?? 4;
  const res = cellsList.map(([x, y]) => [x, y, autotileVariantForMask(group, autotileNeighborMask(view, x, y, (t) => connectSet.has(t), nb, edge))]);
  for (const [x, y, v] of res) view.lowerTiles[idx(x, y)] = v;
}
shape(laneG, view1, laneCells, laneConnect, true);
const railCells = []; for (let x = 0; x < W; x++) railCells.push([x, RAIL_Y]);
for (const [x, y] of railCells) L1[idx(x, y)] = railG.variantMap["15"];
shape(railG, view1, railCells, new Set(railG.memberTileIds), true);
const fenceCells = []; for (let x = 0; x < W; x++) fenceCells.push([x, FENCE_Y]);
for (const [x, y] of fenceCells) { if (L3[idx(x, y)] >= 0) fail(`철망이 3층 칸 위에 (${x},${y})`); L3[idx(x, y)] = fenceG.variantMap["15"]; own3[idx(x, y)] = "fence"; }
const view3 = { width: W, height: H, lowerTiles: L3 };
shape(fenceG, view3, fenceCells, new Set(fenceG.memberTileIds), true);
// 학교 운동장 남쪽 철망(정문 자리 빼고)
const yardFence = []; for (let x = 30; x <= 69; x++) if (x < 38 || x > 43) yardFence.push([x, 74]);
for (const [x, y] of yardFence) { if (L3[idx(x, y)] >= 0) { fail(`운동장 철망이 3층 칸 위에 (${x},${y})`); continue; } L3[idx(x, y)] = fenceG.variantMap["15"]; own3[idx(x, y)] = "yard-fence"; }
shape(fenceG, view3, yardFence, new Set(fenceG.memberTileIds), true);

// ───────────────────────── 4. 노면 표시(2층): 생활도로 가장자리 側溝+흰 선, 「30」
const isLane = (x, y) => inb(x, y) && laneSet.has(idx(x, y));
const nsCol = (x) => LANE_NS.some(([a, b]) => x >= a && x <= b);
const ewRow = (y) => LANE_EW.some(([a, b]) => y >= a && y <= b);
let grateK = 0;
for (const [a, b] of LANE_EW) for (let x = 0; x < W; x++) {
  if (nsCol(x)) continue;
  const g = (++grateK % 7 === 0);
  L2[idx(x, a)] = single("jp-mark-edge-n" + (g ? "-grate" : ""));
  L2[idx(x, b)] = single("jp-mark-edge-s" + (g ? "-grate" : ""));
}
for (const [a, b] of LANE_NS) for (let y = AVE[1] + 1; y <= NS_Y[1]; y++) {
  if (ewRow(y) || (y >= SHOTENGAI[0] && y <= SHOTENGAI[1])) continue;
  L2[idx(a, y)] = single("jp-mark-edge-w"); L2[idx(b, y)] = single("jp-mark-edge-e");
}
// 「30」(남북 길 가운데 두 열)
for (const [x, y0] of [[27, 47], [71, 61]]) {
  const k = KIT["jp-mark-30"];
  for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) { const t = k.rows[r].upperTiles[c]; if (t >= 0) L2[idx(x + c, y0 + r)] = t; }
}

// ───────────────────────── 6. 길가·간선 소품
put("jp-bus-stop", 33, 13, { tag: "bus-stop" });
put("jp-prop-bike-rack", 56, 13, { tag: "bike-rack-ekimae" });
put("jp-prop-bus-r", 48, AVE[1], { tag: "bus" });
put("jp-prop-car-taxi", 18, AVE[1] - 2, { tag: "taxi" });
for (const x of [6, 20, 62, 86]) put("jp-prop-lamp-post", x, 19, { tag: `lamp-${x}` });
put("jp-hydrant-sign", 25, 53, { tag: "hydrant" });

// ───────────────────────── 6b. 거리 표정(빈 자리에만) — 문·접근칸·길은 비운다. 놓지 못한 후보는 건너뛰고 수만 센다.
const reserved = new Set();
for (const d of doors) { reserved.add(idx(d.x, d.y)); reserved.add(idx(d.ax, d.ay)); reserved.add(idx(d.ax, d.ay + 1)); }
const deco = { placed: 0, skipped: 0 };
function tryPut(id, x, yFoot, tag, { layer = 3, onLane = false } = {}) {
  const k = KIT[id], y0 = yFoot - k.height + 1, own = layer === 4 ? own4 : own3;
  for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
    if (k.rows[r].upperTiles[c] < 0) continue;
    const xx = x + c, yy = y0 + r;
    if (!inb(xx, yy) || own[idx(xx, yy)] || own3[idx(xx, yy)] || reserved.has(idx(xx, yy)) || (!onLane && laneSet.has(idx(xx, yy)))) {
      deco.skipped++; if (process.env.TOWN_DEBUG) console.error("skip", tag, xx, yy, own3[idx(xx, yy)] || (reserved.has(idx(xx, yy)) ? "reserved" : laneSet.has(idx(xx, yy)) ? "lane" : "?")); return false;
    }
  }
  stamp(id, x, y0, { layer, tag }); deco.placed++; return true;
}
// 상점가 판석 길: 노보리(가게 앞)·입간판·화분·자전거·벤치. 가운데 줄 y30 은 걸어 다니는 줄로 비운다.
for (let x = 1; x < W - 1; x++) {
  if (nsCol(x)) continue;
  if (x % 7 === 3) tryPut(["jp-prop-nobori-aka", "jp-prop-nobori-sora", "jp-prop-nobori-midori"][x % 3], x, 31, `nobori-${x}`);
  else if (x % 11 === 6) tryPut("jp-prop-a-frame", x, 29, `aframe-${x}`);
  if (x % 13 === 1) tryPut(["jp-prop-bike-sora", "jp-prop-bike-aka", "jp-prop-bike-midori"][x % 3], x, 32, `bike-${x}`);
  else if (x % 9 === 4) tryPut("jp-prop-planter", x, 32, `planter-${x}`);
}
tryPut("jp-prop-bench", 50, 32, "bench-shotengai"); tryPut("jp-prop-cat-loaf", 58, 31, "cat-shotengai");
// 신사: 手水舎·석등 한 쌍 더·산울타리(북쪽)·고양이
for (const [x, f] of [[16, 70]]) if (tryPut("jp-prop-chozuya", x, f, "chozuya")) break;
for (let x = 0; x <= 24; x++) tryPut("jp-prop-wall-hedge", x, 60, `hedge-shrine-${x}`);
tryPut("jp-prop-cat-sit", 13, 73, "cat-shrine");
// 학교: 운동장 철망 안쪽 화분 줄·자전거 거치대
for (let x = 31; x <= 68; x += 3) if (x < 37 || x > 44) tryPut("jp-prop-planter", x, 73, `planter-yard-${x}`);
tryPut("jp-prop-bike-rack", 45, 73, "bike-rack-school"); tryPut("jp-prop-bike-rack", 47, 73, "bike-rack-school-2");
// 공원: 북쪽 산울타리(입구 두 칸)·나무 더·벤치·자판기
for (let x = 74; x <= 95; x++) if (x < 84 || x > 85) tryPut("jp-prop-wall-hedge", x, 60, `hedge-park-${x}`);
const PARK_TREES = [["jp-prop-tree-zelkova", 74, 74], ["jp-prop-tree-ginkgo", 88, 73], ["jp-prop-tree-ginkgo", 92, 70]];
for (const [id, x, f] of PARK_TREES) tryPut(id, x, f, `park-${id}-${x}-${f}`);
for (const [x, f] of [[82, 66], [85, 66], [76, 66]]) tryPut("jp-prop-planter", x, f, `planter-park-${x}-${f}`);
tryPut("jp-prop-vending-sora", 79, 66, "vend-park"); tryPut("jp-prop-bench", 88, 66, "bench-park-3"); tryPut("jp-prop-cat-wood", 81, 72, "cat-park");
// 주택가: 실외기·쓰레기망·화분(집 옆 빈칸)
for (const [id, x, f] of [["jp-ac-unit", 9, 53], ["jp-ac-unit", 30, 53], ["jp-prop-garbage-net", 44, 54], ["jp-gomi-box", 24, 54], ["jp-prop-pot", 61, 53], ["jp-ac-unit", 73, 53], ["jp-prop-pot", 83, 53]]) tryPut(id, x, f, `life-${id}-${x}`);
// 둘째 줄 앞: 자전거·화분
for (const [id, x, f] of [["jp-prop-bike-aka", 18, 41], ["jp-prop-planter", 57, 41], ["jp-prop-garbage-net", 66, 41], ["jp-prop-bike-sora", 88, 41]]) tryPut(id, x, f, `b-${id}-${x}`);

// ───────────────────────── 5. 전봇대·전선(4층) — 생활도로 남쪽 가장자리. 전봇대는 건물 앞에 서므로 간판·창을 덜 가리는 x 를 고른다.
// 비용 = 기둥 열(키트 x+1)이 덮는 건물 칸(기물은 ×0.6) + 완목 열(양옆) ×0.3 + 간격이 12칸에서 벗어난 정도. 간격은 전선 키트가 있는 5~20칸(실제 30~40m 보다 촘촘하게).
const POLE = KIT["jp-pole"], SPANS = [...Array(16)].map((_, i) => i + 5).filter((L) => KIT["jp-wire-" + L]);
const isBldg = (x, y) => (!inb(x, y) || !own3[idx(x, y)] || own3[idx(x, y)] === "fence" || own3[idx(x, y)] === "yard-fence" ? 0 : own3[idx(x, y)].startsWith("jp-bldg") ? 1 : 0.6);
const poles = [];
function poleRow(fy, { kit = "jp-pole" } = {}) {
  const top = fy - POLE.height + 1;
  const ok = (px) => {
    if (px < 0 || px + 2 >= W || nsCol(px + 1) || own3[idx(px + 1, fy)]) return false;
    for (let r = 0; r < POLE.height; r++) for (let c = 0; c < 3; c++) if (POLE.rows[r].upperTiles[c] >= 0 && own4[idx(px + c, top + r)]) return false;
    return true;
  };
  const cost = (px) => { let v = 0; for (let y = top; y < fy; y++) { if (isBldg(px + 1, y)) v += 1; if (y < top + 3) v += 0.3 * (isBldg(px, y) + isBldg(px + 2, y)); } return v; };
  const best = new Map();                                              // px → [총비용, 앞 px]
  for (let px = 0; px <= 5; px++) if (ok(px)) best.set(px, [cost(px), -1]);
  for (let px = 1; px < W - 2; px++) {
    if (!ok(px)) continue;
    for (const L of SPANS) {
      const pv = best.get(px - L); if (!pv) continue;
      const wireFree = (() => { const k = KIT["jp-wire-" + L]; for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) if (k.rows[r].upperTiles[c] >= 0 && own4[idx(px - L + 3 + c, top + r)]) return false; return true; })();
      if (!wireFree) continue;
      const v = pv[0] + cost(px) + 0.02 * (L - 12) ** 2;
      if (!best.has(px) || v < best.get(px)[0]) best.set(px, [v, px - L]);
    }
  }
  let end = -1;
  for (let px = W - 3; px >= W - 9; px--) if (best.has(px) && (end < 0 || best.get(px)[0] < best.get(end)[0])) end = px;
  if (end < 0) { fail(`전봇대 줄 ${fy}: 놓을 자리 없음`); return; }
  const xs = []; for (let px = end; px >= 0; px = best.get(px)[1]) xs.unshift(px);
  for (const px of xs) { put(kit, px, fy, { layer: 4, tag: `pole-${px}-${fy}` }); poles.push([px, fy]); }
  for (let i = 0; i + 1 < xs.length; i++) stamp("jp-wire-" + (xs[i + 1] - xs[i]), xs[i] + 3, top, { layer: 4, tag: `wire-${xs[i]}-${fy}` });
  report0.poles.push({ row: fy, xs, cover: +xs.reduce((v, px) => v + cost(px), 0).toFixed(1) });
}
const report0 = { poles: [] };
for (const [, b] of LANE_EW) poleRow(b);

// ───────────────────────── 7. 검사
const project = createEmptyToolProject("jp-town");
project.tilesets.jp_city = TS;
const MAP = { id: "jp-city-town", name: "일본 도시 · 동네 한 장", width: W, height: H, tilesetId: "jp_city", tileSize: 16, lowerTiles: L1, lowerOverlayTiles: L2, upperTiles: L3, upperOverlayTiles: L4, events: [], climate: { mode: "inherit" } };
project.maps[MAP.id] = MAP;
// 탈것: 조수 도구와 같은 planMapTransit 으로 깐다 — 맵 끝→끝 동서 길(간선은 역 앞 횡단보도를 지나 한 띠)에 좌측통행 차 흐름,
// 버스 정류장 둘(몸 가운데 = 역 앞 광장 서쪽 / 학교 정문 x 38~43 앞). 지하철 출입구는 아직 없다(역은 지상 작은 역사).
const { planMapTransit } = await imp("src/editor/tools/transitTools.ts");
const transitPlan = planMapTransit(project, MAP, { auto: { headwaySec: 9, busHeadwaySec: 40, busStops: [
  { x: 34, y: AVE[0], at: "center", name: "駅前", waitSec: 6 },
  { x: 40, y: LANE_EW[2][0], at: "center", name: "学校前", waitSec: 6 },
] } });
MAP.transit = transitPlan.next;
fs.writeFileSync(join(OUT, "town.map.json"), JSON.stringify(MAP));
const pass = (x, y) => isPassable(project, MAP, x, y);
const START = [41, 12];
const reach = new Set([idx(...START)]);
const q = [START];
while (q.length) {
  const [x, y] = q.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (!inb(nx, ny) || reach.has(idx(nx, ny)) || !canMove(project, MAP, x, y, nx, ny)) continue;
    reach.add(idx(nx, ny)); q.push([nx, ny]);
  }
}
const report = { map: { id: MAP.id, size: [W, H] }, start: START, poles: report0.poles, transit: { routes: MAP.transit.routes.map((r) => r.id), notes: transitPlan.notes, warnings: transitPlan.warnings } };
const doorRes = doors.map((d) => ({ ...d, doorBlocked: !pass(d.x, d.y), accessPassable: pass(d.ax, d.ay), accessReached: reach.has(idx(d.ax, d.ay)) }));
report.doors = { n: doors.length, allReached: doorRes.every((d) => d.doorBlocked && d.accessPassable && d.accessReached), failing: doorRes.filter((d) => !(d.doorBlocked && d.accessPassable && d.accessReached)) };
const body = solidCells.map(([x, y, id]) => ({ x, y, id, passable: pass(x, y) }));
report.solid = { cells: body.length, openByEngine: body.filter((b) => b.passable).length, open: body.filter((b) => b.passable).slice(0, 8) };
function maskAudit(group, viewTiles, extra) {
  const members = new Set(group.memberTileIds), connect = new Set([...(group.connectTileIds ?? group.memberTileIds), ...extra]);
  const view = { width: W, height: H, lowerTiles: viewTiles };
  let cells = 0, bad = 0; const ex = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = viewTiles[idx(x, y)]; if (!members.has(t)) continue; cells++;
    const v = autotileVariantForCell(view, { ...group, connectTileIds: [...connect], edgeConnects: true }, x, y);
    if (v !== t) { bad++; if (ex.length < 5) ex.push([x, y, t, v]); }
  }
  return { cells, mismatch: bad, ex };
}
report.autotiles = { lane: maskAudit(laneG, L1, [...kitLaneIds]), rail: maskAudit(railG, L1, []), fence: maskAudit(fenceG, L3, []) };
let l4NoBaseOk = 0; for (let i = 0; i < W * H; i++) if (L4[i] >= 0) l4NoBaseOk++;
report.layers = { overlaps: issues.length, issues: issues.slice(0, 12), l2: L2.filter((t) => t >= 0).length, l3: L3.filter((t) => t >= 0).length, l4: l4NoBaseOk };
const BARE = new Set([SW, PAVE_A, PAVE_B, GRAVEL, LAWN]);
let worst = 0, worstAt = null;
const bare = (x, y) => BARE.has(L1[idx(x, y)]) && L3[idx(x, y)] < 0 && L4[idx(x, y)] < 0;
for (let y0 = 0; y0 + 13 <= H; y0++) for (let x0 = 0; x0 + 17 <= W; x0++) {
  let c = 0; for (let y = y0; y < y0 + 13; y++) for (let x = x0; x < x0 + 17; x++) if (bare(x, y)) c++;
  if (c / 221 > worst) { worst = c / 221; worstAt = [x0, y0]; }
}
report.emptiness = { worst17x13: +worst.toFixed(3), worstAt };
report.reach = { reachable: reach.size, walkable: (() => { let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pass(x, y)) n++; return n; })() };
report.placed = placed.length; report.deco = deco;
const ok = issues.length === 0 && report.doors.allReached && report.solid.openByEngine === 0 && Object.values(report.autotiles).every((a) => a.mismatch === 0);
report.ok = ok;
fs.writeFileSync(join(OUT, "town.report.json"), JSON.stringify({ ...report, placedList: placed, doorList: doorRes }, null, 1));
console.log(JSON.stringify(report, null, 1));
if (!ok) process.exitCode = 2;

if (PUBLISH) {
  if (!ok) { console.error("검사 실패 — 지역 참고본을 쓰지 않았다"); process.exit(2); }
  const REGION_DIR = join(ROOT, "public/assets/region-references");
  const PLACE_ID = "jp-city-town-96x80";
  const NAME = "일본 도시 · 동네 한 장 (역 앞·상점가·주택가·신사·학교·공원)";
  const tpl = JSON.parse(fs.readFileSync(join(REGION_DIR, "jp-city-apartment-1k.oprn.json"), "utf8"));
  const mapOut = { ...MAP, name: NAME };
  const proj = structuredClone(tpl);
  proj.meta.title = NAME;
  proj.tilesets = { jp_city: { ...structuredClone(TS), referenceDocuments: structuredClone(TS.referenceDocuments ?? []) } };
  proj.maps = { [MAP.id]: mapOut };
  proj.mapTree = { mapId: MAP.id, children: [] };
  proj.startMapId = MAP.id; proj.startPos = { x: START[0], y: START[1] };
  proj.mapConnections = [];
  fs.writeFileSync(join(REGION_DIR, "jp-city-town.oprn.json"), JSON.stringify(proj));
  fs.copyFileSync(join(ROOT, "verify-shots/jp-city/town-1x.png"), join(REGION_DIR, "jp-city-town.png"));
  const slim = { id: TS.id, image: TS.image, tileSize: TS.tileSize, tilesPerRow: TS.tilesPerRow, count: TS.count, passability: TS.passability, priority: TS.priority, terrain: TS.terrain };
  fs.writeFileSync(join(ROOT, "src/project/regionReferences/jp-city-town.json"), JSON.stringify({ map: mapOut, tileset: slim }));
  const entry = {
    id: PLACE_ID, name: NAME, kind: "completed-place", placeKind: "settlement", revision: 2, x: 0, y: 0, width: W, height: H, tilesetId: "jp_city",
    preview: "/assets/region-references/jp-city-town.png", tilesetPreview: "/assets/jp-city/jp-city-chipset.png",
    projectDownload: "/assets/region-references/jp-city-town.oprn.json",
    sourceProjectId: "oprn-bundled-jp-city-town", sourceMapId: MAP.id, snapshotProjectId: "oprn-place-jp-city-town-v1",
    rules: [
      `${W}×${H}칸 일본 동네 한 장. 위에서 아래로 띠를 쌓았다: 선로·철망 → 역 앞 줄(交番·역 앞 상가 줄·작은 역사·편의점·코인 주차·우체국·의원) → 역 앞 판석 광장 → 간선(4줄, 역 앞 횡단보도·버스·택시) → 상점가 북쪽 줄(벽 맞댄 상가 줄 키트, 셔터 가게 섞임, 입구 아치 둘) → 상점가 판석 길 → 둘째 줄(銭湯·코인 세탁소·상가 줄·町工場·슈퍼) → 생활도로 1 → 주택가(블록 담·대문·카포트) → 생활도로 2 → 신사(拝殿·도리이·석등)·小学校(교사·체육관·운동장·정문)·공원 → 생활도로 3.`,
      "생활도로(폭 4칸, 보도 없음)는 가장자리 칸에 側溝 뚜껑 + 路側帯 흰 선(2층 투명 덧그림)을 깔고 7칸마다 グレーチング, 남북 길 가운데에 주황 「30」. 전봇대는 생활도로 1·2·3 남쪽 가장자리에 서고(간격 5~20칸 중 간판·창을 덜 가리는 자리 — poleRow 비용 최소화) 전선(jp-wire-L, 왼쪽 전봇대 x+3·맨 위 줄)이 이어진다 — 건물 앞에 서므로 전봇대·전선은 4층이다. 상점가 판석 길은 노보리·입간판·화분·자전거, 주택가는 블록 담·문기둥·카포트·프로판 봄베·실외기, 신사는 拝殿·도리이·手水舎·석등·참배길.",
      "건물은 손 도트 통 키트(jp-bldg-*)를 키트 격자 그대로 찍었고(3층), 생활도로·선로·철망은 오토타일 엔진 규칙으로 마스크를 계산해 썼다. 문은 모두 길(상점가 판석·생활도로·간선 보도)에 면하고 접근칸이 한 길망으로 이어진다.",
      `문 ${doors.length}개 접근칸 전부 시작 (${START[0]},${START[1]}) 에서 도달, 막힘 칸 ${report.solid.cells}개 전부 엔진이 막는다.`,
      "공용 AI 문서가 아니라 조립 예제다 — 키트 id·좌표는 scripts/content/jp-city/maps/town.mjs 를 본다.",
    ],
    limitations: "차 흐름·버스는 map.transit 으로 실제로 다닌다(동서 길 4줄 좌측통행, 버스 정류장 駅前·学校前 — set_map_transit 과 같은 planMapTransit). 지상 선로의 열차·행인·이벤트 없음(코인 주차장 차는 세워 둔 소품). 건물은 정면 하나라 남쪽 줄 건물은 북쪽 길에서 지붕만 보인다. 남북 골목의 아치는 간선 쪽 입구에만 있다. 밤 조명 없음. 자동 생성 프리셋이 아니다.",
  };
  const tsPath = join(ROOT, "src/project/jpCityPlaceReferences.ts");
  const src = fs.readFileSync(tsPath, "utf8");
  const m = src.match(/export const JP_CITY_PLACE_REFERENCES = (\[[\s\S]*\]) as const;/);
  const arr = JSON.parse(m[1]).filter((e) => e.id !== PLACE_ID);
  arr.push(entry);
  fs.writeFileSync(tsPath, "// Generated by scripts/content/jp-city/maps/*.mjs --publish. 일본 도시(jp_city) 예제 under 장소; snapshots in regionReferences/jp-city-*.json.\nexport const JP_CITY_PLACE_REFERENCES = " + JSON.stringify(arr, null, 2) + " as const;\n");
  console.log("publish", { download: fs.statSync(join(REGION_DIR, "jp-city-town.oprn.json")).size });
}
