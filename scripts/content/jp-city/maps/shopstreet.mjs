#!/usr/bin/env node
// jp_city 예제 맵 ① 상가 거리 — 코드로 까는 생성기 + 검사기. 계획서: shopstreet.plan.md
//
//   node scripts/content/jp-city/maps/shopstreet.mjs            # 맵 생성·검사 → maps/out/shopstreet.{map,plan,report}.json
//   node scripts/content/jp-city/maps/shopstreet.mjs --publish  # 검사 통과 시 지역 참고본(.oprn.json·스냅샷·장소 TS)도 쓴다
//
// 도로 오토타일(생활도로·선로·철망)은 엔진 autotileNeighborMask 로 마스크를 직접 계산해 칸 번호를 쓴다(스탬프는 재계산이 안 된다).
// 간선·건널목·아치·소품은 키트 격자 그대로 찍고, 건물은 조립기 buildJpCityBuilding 결과를 쓴다.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..");
if (!process.env.SHOPSTREET_UNDER_TSX) {
  const r = spawnSync("npx", ["--no-install", "tsx", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit", cwd: ROOT, env: { ...process.env, SHOPSTREET_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const OUT = join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });
const PUBLISH = process.argv.includes("--publish");

const { buildJpCityBuilding } = await imp("src/editor/jpCity/builder.ts");
const { autotileNeighborMask, autotileVariantForMask, shadeAutotileInterior, autotileVariantForCell } = await imp("src/project/defaults/autotileEngine.ts");
const { createJpCityTileset } = await imp("src/project/defaults/jpCity.ts");
const { createEmptyToolProject } = await imp("src/editor/tools/emptyProject.ts");
const { canMove, isPassable } = await imp("src/project/collision.ts");

const TS = createJpCityTileset();
const KIT = Object.fromEntries(TS.structureKits.map((k) => [k.id, k]));
const GRP = Object.fromEntries(TS.autotileGroups.map((g) => [g.id, g]));
const W = +(process.env.JP_W ?? 40), H = +(process.env.JP_H ?? 32);      // 간선 교차로는 북서 사분면(중앙분리대까지)만 보이게 자른다 — 동·남 팔과 반대편 차로는 맵 밖으로 이어진다
const SW = 707;                      // 보도 포석(오토타일 3183 과 화소가 같은 평평한 포장 — 생활도로 바깥 칸)
const PAVE_A = 839, PAVE_B = 840;    // 판석 A·B(가게 앞 포장)

const L1 = new Array(W * H).fill(SW), L2 = new Array(W * H).fill(-1), L3 = new Array(W * H).fill(-1), L4 = new Array(W * H).fill(-1);
const owner = new Array(W * H).fill("");           // 칸을 처음 차지한 구성 요소(겹침 검사용)
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const idx = (x, y) => y * W + x;
const issues = [];
const fail = (msg) => { issues.push(msg); };

// ───────────────────────── 키트 찍기(키트 격자 그대로 — tiles → 1층, upperTiles → 3층)
function stampKit(id, x0, y0, tag, { claim = true } = {}) {
  const k = KIT[id];
  if (!k) throw new Error("키트 없음 " + id);
  for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
    const x = x0 + c, y = y0 + r;
    if (!inb(x, y)) continue;                      // 맵 밖으로 이어지는 부분은 자른다
    const row = k.rows[r];
    const t = row.tiles[c], u = row.upperTiles[c];
    if (t < 0 && u < 0) continue;
    if (claim && owner[idx(x, y)]) fail(`겹침 ${tag} 가 ${owner[idx(x, y)]} 위에 (${x},${y})`);
    if (claim) owner[idx(x, y)] = owner[idx(x, y)] || tag;
    if (t >= 0) L1[idx(x, y)] = t;
    if (u >= 0) L3[idx(x, y)] = u;
  }
}
// 발(왼쪽 아래 칸) 기준으로 소품 키트를 찍는다.
const prop = (id, x, yFoot, tag = id) => stampKit(id, x, yFoot - KIT[id].height + 1, tag);

// ───────────────────────── 1. 간선도로(키트)
// 교차로 키트는 29×29 지만 동·남 팔(6칸)은 맵 밖이라 앞 23×23 만 보인다. 핵심(17×17)은 키트 칸 6..22.
const TX = +(process.env.JP_TX ?? 25), TY = +(process.env.JP_TY ?? 17);
stampKit("jp-road-trunk-x", TX, TY, "trunk-x");
// 세로 간선(북쪽 팔 연장): 8칸 키트를 위로 이어 붙이고 맨 위는 맵 밖으로 자른다.
for (const y of [9, 1, -7]) stampKit("jp-road-trunk-v", TX + 6, y, "trunk-v");
// 가로 간선(서쪽 팔 연장)
for (const x of [17, 9, 1, -7]) stampKit("jp-road-trunk-h", x, TY + 6, "trunk-h");

// ───────────────────────── 2. 오토타일: 생활도로(동서 길 + 남북 골목) · 선로 · 철망
const LANE_Y0 = 13, LANE_Y1 = 16;                 // 동서 상점가 길
const LANE_X0 = 12, LANE_X1 = 15;                 // 남북 골목
const FK_X = 20, FK_Y = 11;                        // 건널목 키트(가로 도로 × 세로 선로) 왼쪽 위
const RAIL_X = FK_X + 4;
const laneCells = [];
for (let y = LANE_Y0; y <= LANE_Y1; y++) for (let x = 0; x <= 30; x++) laneCells.push([x, y]);
for (let x = LANE_X0; x <= LANE_X1; x++) for (let y = 0; y <= 22; y++) if (y < LANE_Y0 || y > LANE_Y1) laneCells.push([x, y]);
// 건널목 키트가 덮는 칸(도로 4줄 × 키트 9칸)은 키트 타일이 도로를 맡는다.
const inFumikiri = (x, y) => x >= FK_X && x < FK_X + 9 && y >= FK_Y && y < FK_Y + 8;
stampKit("jp-fumikiri-h", FK_X, FK_Y, "fumikiri");
// 생활도로 횡단보도(상점가 길 서쪽, 마치야·카페 앞에서 남쪽 아치 쪽으로 건넌다): 키트 6×4 가 길 4줄을 대신한다.
const CW_X = 6;
const inLaneCw = (x, y) => x >= CW_X && x < CW_X + 6 && y >= LANE_Y0 && y <= LANE_Y1;
stampKit("jp-road-lane-crosswalk-h", CW_X, LANE_Y0, "lane-crosswalk");
const laneG = GRP["jp-lane-road"], railG = GRP["jp-rail-track"], fenceG = GRP["jp-fence-mesh"];
const LANE_FULL = laneG.variantMap["255"];
for (const [x, y] of laneCells) { if (inFumikiri(x, y) || inLaneCw(x, y)) continue; if (owner[idx(x, y)]) fail(`생활도로가 ${owner[idx(x, y)]} 위에 (${x},${y})`); owner[idx(x, y)] = "lane"; L1[idx(x, y)] = LANE_FULL; }
// 키트 안의 생활도로 칸(이름이 「생활도로」) 은 같은 도로로 이어 센다.
const kitLaneIds = new Set(TS.tileMeta.map((m, i) => ((m.label ?? "").startsWith("생활도로") ? i : -1)).filter((i) => i >= 0));
const laneConnect = new Set([...laneG.memberTileIds, ...kitLaneIds]);
const view1 = { width: W, height: H, lowerTiles: L1 };
function shape(group, view, cellsList, connectSet, edge) {
  const nb = group.neighborhood ?? 4;
  const res = [];
  for (const [x, y] of cellsList) {
    const m = autotileNeighborMask(view, x, y, (t) => connectSet.has(t), nb, edge);
    const v = autotileVariantForMask(group, m);
    res.push([x, y, v]);
  }
  for (const [x, y, v] of res) view.lowerTiles[idx(x, y)] = v;
  return res;
}
shape(laneG, view1, laneCells.filter(([x, y]) => !inFumikiri(x, y) && !inLaneCw(x, y)), laneConnect, true);

// 선로: 맵 위에서 들어와 건널목을 지나 끝막이(측선)로 끝난다.
const railCells = [];
for (let y = 0; y <= 20; y++) if (!(y >= FK_Y && y < FK_Y + 8)) railCells.push([RAIL_X, y]);
for (const [x, y] of railCells) { if (owner[idx(x, y)]) fail(`선로가 ${owner[idx(x, y)]} 위에 (${x},${y})`); owner[idx(x, y)] = "rail"; L1[idx(x, y)] = railG.variantMap["15"]; }
const railConnect = new Set([...railG.memberTileIds, 3679, 3680]);       // 건널목 키트 안의 선로 복사 칸·바닥판도 이어진 선로
const railShaped = shape(railG, view1, railCells, railConnect, true);
// 철망 담: 선로 양옆, 건널목 키트 위·아래만(키트 안은 경보기·차단기가 있다). 3층(upper).
const fenceCells = [];
for (const fx of [RAIL_X - 1, RAIL_X + 1]) for (let y = 0; y <= 21; y++) { if (y >= FK_Y - 1 && y <= FK_Y + 8) continue; fenceCells.push([fx, y]); }
for (const [x, y] of fenceCells) { if (L3[idx(x, y)] >= 0) fail(`철망이 3층 칸 위에 (${x},${y})`); L3[idx(x, y)] = fenceG.variantMap["15"]; }
const view3 = { width: W, height: H, lowerTiles: L3 };
const fenceSet = new Set(fenceG.memberTileIds);
shape(fenceG, view3, fenceCells, fenceSet, true);

// ───────────────────────── 3. 포장(가게 앞 판석)
for (let x = 0; x <= 30; x++) for (const y of [11, 12]) {
  if (owner[idx(x, y)]) continue;
  L1[idx(x, y)] = ((x + y) % 2 === 0) ? PAVE_A : PAVE_B;
}

// ───────────────────────── 4. 건물(조립기) — 뒷줄(A, 위) 먼저, 앞줄(B, 아래) 나중
const A_FOOT = 10, B_FOOT = 22;
const BUILDINGS = [
  // 북쪽 줄 A (앞면이 동서 길을 본다)
  { id: "A1a", x: 0, y: A_FOOT, w: 4, floors: [{ kind: "pairs", wall: "shiro", variants: [1, 0] }, { kind: "pairs", wall: "shiro", variants: [1, 0] }, { kind: "pairs", wall: "shiro", variants: [1, 0] }], ground: "gr.shutter.aka", door: { type: "house", col: 1 }, roof: "roof.plain.plain" },
  { id: "A1b", x: 4, y: A_FOOT, w: 4, floors: [{ kind: "slide", wall: "hodo", variants: [1, 0] }, { kind: "slide", wall: "hodo", variants: [0, 5] }], ground: "gr.glass.sora", door: { type: "cafe", col: 0 }, roof: "roof.ac.cyl" },
  { id: "A1c", x: 8, y: A_FOOT, w: 3, floors: [{ kind: "koushi", wall: "kinari", variants: [0, 1, 2] }], ground: "gr.machiya", groundVariants: [4, 5, 4], door: { type: "machiya", col: 0 }, roof: "roof.hip.slate", eave: "eave.slate" },
  { id: "A2", x: 17, y: A_FOOT, w: 6, roof: "roof.ac.tank", floors: [{ kind: "curtain", wall: "kinari", variants: [1, 0, 0] }, { kind: "curtain", wall: "kinari", variants: [0, 1, 0] }, { kind: "ribbon", wall: "hodo", variants: [1, 0, 1] }], ground: "gr.konbini.0", door: { type: "auto", col: 2 } },
  { id: "E1", x: 26, y: A_FOOT, w: 5, roof: "roof.ac.cyl", floors: [{ kind: "slide", wall: "kinari", variants: [1, 5, 0] }, { kind: "slide", wall: "kinari", variants: [2, 1, 4] }, { kind: "slide", wall: "kinari", variants: [5, 0, 3] }], ground: "gr.shutter.kii", door: { type: "steel", col: 1 } },
  // 남쪽 줄 B (앞면이 간선 보도를 본다) — 단층 점포
  { id: "B1a", x: 0, y: B_FOOT, w: 5, floors: [], ground: "gr.izakaya", door: { type: "noren", col: 1 }, roof: "roof.ac.plain" },
  { id: "B1b", x: 5, y: B_FOOT, w: 5, floors: [], ground: "gr.glass.kii", door: { type: "cafe", col: 2 }, roof: "roof.plain.tank" },
  { id: "B2", x: 18, y: B_FOOT, w: 5, floors: [], ground: "gr.shutter.sora", door: { type: "steel", col: 3 }, roof: "roof.plain.cyl" },
];
const doors = [];        // { b, x, y, ax, ay }
const solidCells = [];   // 건물 몸채가 막아야 하는 칸 [x,y]
const buildingLog = [];
for (const b of BUILDINGS) {
  const { id, ...input } = b;
  const res = buildJpCityBuilding(input, { world: { width: W, height: H, passable: () => true } });
  const errs = res.issues.filter((i) => i.severity === "error");
  if (errs.length) { fail(`건물 ${id}: ` + errs.map((e) => `${e.code}(${e.x},${e.y}) ${e.message}`).join(" / ")); continue; }
  const { x0, y0, w, h } = res.rect;
  buildingLog.push({ id, rect: { x0, y0, w, h }, ground: b.ground, roof: b.roof, floors: Array.isArray(b.floors) ? b.floors.length : b.floors, door: b.door?.type, warnings: res.issues.filter((i) => i.severity === "warning").map((i) => i.code) });
  for (const p of res.placements) {
    const i = idx(p.x, p.y);
    if (owner[i] && owner[i] !== id) fail(`건물 ${id} 가 ${owner[i]} 위에 (${p.x},${p.y})`);
    owner[i] = id;
    if (p.lower !== undefined) L1[i] = p.lower;
    L3[i] = p.upper ?? -1;
    L4[i] = p.overlay ?? -1;
  }
  res.solid.forEach((row, r) => row.forEach((s, c) => { if (s) solidCells.push([x0 + c, y0 + r, id]); }));
  res.doors.forEach((d, n) => doors.push({ b: id, x: d.x, y: d.y, ax: res.access[n].x, ay: res.access[n].y }));
}

// ───────────────────────── 5. 아치·건널목 곁 소품
stampKit("jp-prop-arch-shotengai", 10, B_FOOT - 4, "arch", { claim: false });

// ───────────────────────── 6. 소품(주인이 반경 2칸 안에 있는 것만)
const SPOTS = [];     // 소품 기록(보고용)
const put = (id, x, yFoot, why, claim = true) => {
  const k = KIT[id];
  stampKit(id, x, yFoot - k.height + 1, id, { claim });
  SPOTS.push({ id, x, y: yFoot, why });
};
// 코인 파킹(건널목 오른쪽 아래): 주차 바닥 + 칸 구분선 + 차 한 대 + 요금판
for (let y = 18; y <= 22; y++) for (let x = 26; x <= 30; x++) { if (owner[idx(x, y)]) continue; owner[idx(x, y)] = "coin-lot"; L1[idx(x, y)] = 721; }
for (const x of [26, 30]) for (let y = 18; y <= 22; y++) L1[idx(x, y)] = 722;
put("jp-prop-car-silver", 26, 21, "코인 파킹 자리 안 차", false);
put("jp-prop-coin-sign", 30, 19, "코인 파킹 요금판(주차장 안 모서리)", false);
// 간선 교차로 모퉁이 신호기
put("jp-prop-utility-pole2", 31, 13, "간선 보도(남북 길 끝) 전봇대 — 교차로 신호기와 한 칸이라도 겹치지 않게 북쪽에 둔다", false);
// 생활도로 교차 모퉁이: 커브 미러·일시정지 표지
put("jp-road-sign-mirror", 11, 11, "골목 서쪽 길가 커브 미러(표지와 같은 쪽에 쌓지 않는다)");
put("jp-road-sign-tomare", 16, 11, "남북 골목 북쪽 갈래, 남행 차 일시정지 표지(차가 달리는 동쪽 반의 길가)");
// 노면 글자 止まれ(jp-road-mark-tomare-*)는 이 맵에 안 쓴다: 남행 접근이라 180° 돌린 글자가 ×3 에서 읽히지 않았다(눈 판정). 표지(역삼각)만 둔다.
// 가게 곁
put("jp-prop-vending-aka", 17, 12, "편의점 A2 곁 자판기");
put("jp-prop-bike-rack", 20, 12, "편의점 A2 곁 자전거 거치대");
put("jp-prop-a-frame", 7, 12, "카페 A1b 입간판");
put("jp-prop-garbage-net", 10, 12, "마치야 A1c 곁 쓰레기 집하");
put("jp-prop-bike-rack", 3, 24, "점포 B1a 앞 보도 자전거 거치대", false);
put("jp-prop-planter", 7, 24, "점포 B1b 앞 보도 화단", false);
put("jp-prop-bollard", 30, 14, "동서 길 끝 볼라드(간선 보도 앞 차 막이)", false);
put("jp-prop-bollard", 30, 16, "동서 길 끝 볼라드(한 칸 띄움)", false);
// 간선 위 정차 차량(정지선 앞)
put("jp-prop-car-taxi", 15, 27, "간선 가로 서쪽 팔 동행(교차로 쪽) 차선 택시 — 왼쪽 통행이라 북쪽 반", false);

// ───────────────────────── 7. 검사
const project = createEmptyToolProject("jp-shopstreet");
project.tilesets.jp_city = TS;
const MAP = { id: "jp-city-shopstreet", name: "일본 도시 · 상가 거리", width: W, height: H, tilesetId: "jp_city", tileSize: 16, lowerTiles: L1, lowerOverlayTiles: L2, upperTiles: L3, upperOverlayTiles: L4, events: [], climate: { mode: "inherit" } };
project.maps[MAP.id] = MAP;
fs.writeFileSync(join(OUT, "shopstreet.map.json"), JSON.stringify(MAP));

const pass = (x, y) => isPassable(project, MAP, x, y);
const START = [28, 12];
const reach = new Set([idx(...START)]);
const q = [START];
while (q.length) {
  const [x, y] = q.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (!inb(nx, ny) || reach.has(idx(nx, ny))) continue;
    if (!canMove(project, MAP, x, y, nx, ny)) continue;
    reach.add(idx(nx, ny)); q.push([nx, ny]);
  }
}
const report = { map: { id: MAP.id, size: [W, H] }, start: START };
// (1) 문
const doorRes = doors.map((d) => ({ ...d, doorBlocked: !pass(d.x, d.y), accessPassable: pass(d.ax, d.ay), accessReached: reach.has(idx(d.ax, d.ay)) }));
report.doors = { n: doors.length, allReached: doorRes.every((d) => d.doorBlocked && d.accessPassable && d.accessReached), failing: doorRes.filter((d) => !(d.doorBlocked && d.accessPassable && d.accessReached)) };
// (2) 건물 몸채
const body = solidCells.map(([x, y, id]) => ({ x, y, id, passable: pass(x, y) }));
report.buildingBodies = { solidCells: body.length, openByEngine: body.filter((b) => b.passable).length, byBuilding: Object.fromEntries(BUILDINGS.map((b) => [b.id, body.filter((c) => c.id === b.id).length])) };
// (3) 횡단보도·건널목
const labelAt = (t) => (t >= 0 ? (TS.tileMeta[t]?.label ?? "") : "");
const crossCells = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const l = labelAt(L1[idx(x, y)]) + "|" + labelAt(L3[idx(x, y)]);
  if (l.includes("횡단보도") || l.includes("건널목 바닥판")) crossCells.push([x, y, l.includes("바닥판") ? "건널목" : "횡단보도"]);
}
report.crossings = {
  zebraCells: crossCells.filter((c) => c[2] === "횡단보도").length, railPlateCells: crossCells.filter((c) => c[2] === "건널목").length,
  allPassable: crossCells.every(([x, y]) => pass(x, y)), allReached: crossCells.every(([x, y]) => reach.has(idx(x, y))),
};
// 건널목 건너기: 선로 서쪽 (19,14) 에서 동쪽 (28,14) 까지 판 위를 걸어 도달(철망·도로만 쓰지 않고 판 열 24 를 지난다)
const crossWalk = (() => {
  const seen = new Set([idx(19, 14)]); const qq = [[19, 14]];
  while (qq.length) { const [x, y] = qq.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || seen.has(idx(nx, ny)) || !canMove(project, MAP, x, y, nx, ny)) continue; if (ny < LANE_Y0 || ny > LANE_Y1 || nx < 19 || nx > 29) continue; seen.add(idx(nx, ny)); qq.push([nx, ny]); } }
  return seen.has(idx(28, 14));
})();
report.crossings.fumikiriWalkAcross = crossWalk;
// (4) 오토타일 마스크: 칸마다 이웃에서 다시 계산해 쓴 칸과 비교(엔진 autotileVariantForCell, 독립 경로)
function maskAudit(group, viewTiles, extraConnect) {
  const members = new Set(group.memberTileIds);
  const connect = new Set([...(group.connectTileIds ?? group.memberTileIds), ...extraConnect]);
  const view = { width: W, height: H, lowerTiles: viewTiles };
  let cells = 0, mismatchEngineExact = 0, mismatchEdgeConnect = 0, mismatchBorderOnly = 0, mismatchPlain = 0;
  const bad = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = viewTiles[idx(x, y)];
    if (!members.has(t)) continue;
    cells++;
    const exact = autotileVariantForCell(view, { ...group, connectTileIds: [...connect], edgeConnects: false }, x, y);
    const edge = autotileVariantForCell(view, { ...group, connectTileIds: [...connect], edgeConnects: true }, x, y);
    if (exact !== t) { mismatchEngineExact++; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) mismatchBorderOnly++; }
    const plain = autotileVariantForCell(view, { ...group, edgeConnects: false }, x, y);      // 키트 연장 없이 엔진 원래 규칙 그대로
    if (plain !== t) mismatchPlain++;
    if (edge !== t) { mismatchEdgeConnect++; bad.push([x, y, t, edge]); }
  }
  return { cells, mismatchEngineExact, mismatchEngineExactInterior: mismatchEngineExact - mismatchBorderOnly, mismatchBorderOnlyOfThose: mismatchBorderOnly, mismatchPlainEngineNoKitExtension: mismatchPlain, mismatchEdgeConnect, bad: bad.slice(0, 6) };
}
report.autotileMasks = {
  "jp-lane-road": maskAudit(laneG, L1, [...kitLaneIds]),
  "jp-rail-track": maskAudit(railG, L1, [3679, 3680]),
  "jp-fence-mesh(3층)": maskAudit(fenceG, L3, []),
};
// (5) 층 겹침·층 정책
const pri = TS.priority;
let l1Upper = 0, l2Used = 0, l4NoBase = 0, groundInObject = 0;
for (let i = 0; i < W * H; i++) {
  if (L1[i] < 0) l1Upper++; else if (pri[L1[i]] === "upper") l1Upper++;
  if (L2[i] >= 0) l2Used++;
  if (L4[i] >= 0 && L3[i] < 0) l4NoBase++;
  for (const t of [L3[i], L4[i]]) if (t >= 0 && pri[t] === "lower" && TS.tileMeta[t]?.passage !== "star" && TS.tileMeta[t]?.defaultLayer === "lower") groundInObject++;
}
report.layers = { claimOverlaps: issues.length, issues: issues.slice(0, 10), l1EmptyOrUpperPriority: l1Upper, l2Cells: l2Used, l4WithoutL3: l4NoBase, groundTilesInObjectLayer: groundInObject };
// (6) 빈칸: 걷는 맨 포장(보도·판석)만 센다(아스팔트 도로는 동선이라 제외)
const BARE = new Set([SW, PAVE_A, PAVE_B]);
const bare = (x, y) => inb(x, y) && BARE.has(L1[idx(x, y)]) && L3[idx(x, y)] < 0 && L4[idx(x, y)] < 0;
let bareCells = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bare(x, y)) bareCells++;
let maxSq = 0, maxSqAt = null;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let n = 1; n <= 12; n++) {
  let ok = true;
  for (let dy = 0; dy < n && ok; dy++) for (let dx = 0; dx < n; dx++) if (!bare(x + dx, y + dy)) { ok = false; break; }
  if (!ok) break;
  if (n > maxSq) { maxSq = n; maxSqAt = [x, y]; }
}
let worstWin = 0, worstAt = null;
for (let y0 = 0; y0 + 13 <= H; y0++) for (let x0 = 0; x0 + 17 <= W; x0++) {
  let c = 0; for (let y = y0; y < y0 + 13; y++) for (let x = x0; x < x0 + 17; x++) if (bare(x, y)) c++;
  const r = c / (17 * 13); if (r > worstWin) { worstWin = r; worstAt = [x0, y0]; }
}
report.emptiness = { bareCells, bareRatioOfMap: +(bareCells / (W * H)).toFixed(3), maxEmptySquare: maxSq, maxEmptySquareAt: maxSqAt, worst17x13: +worstWin.toFixed(3), worst17x13At: worstAt, note: "bare = 보도·판석 칸이고 3·4층이 비어 있는 칸(아스팔트·선로·주차 바닥은 동선·기능이라 제외)" };
{ const ASPH = (t) => { const l = TS.tileMeta[t]?.label ?? ""; return l.startsWith("생활도로") || l.startsWith("아스팔트") || l.startsWith("간선도로"); };
  let a = 0; for (let i = 0; i < W * H; i++) if (L1[i] >= 0 && ASPH(L1[i])) a++;
  report.asphalt = { cells: a, ratio: +(a / (W * H)).toFixed(3) }; }
report.buildings = buildingLog;
report.props = SPOTS;
report.reach = { start: START, reachableCells: reach.size, walkableCells: (() => { let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pass(x, y)) n++; return n; })() };
const okAll = issues.length === 0 && report.doors.allReached && report.buildingBodies.openByEngine === 0 && report.crossings.allPassable && report.crossings.allReached && crossWalk
  && Object.values(report.autotileMasks).every((m) => m.mismatchEdgeConnect === 0) && l1Upper === 0 && l4NoBase === 0;
report.ok = okAll;
fs.writeFileSync(join(OUT, "shopstreet.report.json"), JSON.stringify(report, null, 1));
fs.writeFileSync(join(OUT, "shopstreet.plan.json"), JSON.stringify({ size: [W, H], start: START, doors, buildings: buildingLog, props: SPOTS, trunkKit: { id: "jp-road-trunk-x", at: [TX, TY] }, fumikiri: { id: "jp-fumikiri-h", at: [FK_X, FK_Y] }, lanes: { eastWest: { y: [LANE_Y0, LANE_Y1] }, northSouth: { x: [LANE_X0, LANE_X1] } } }));
console.log(JSON.stringify({ ok: okAll, doors: { n: report.doors.n, allReached: report.doors.allReached, failing: report.doors.failing }, buildingBodies: report.buildingBodies, crossings: report.crossings, autotileMasks: Object.fromEntries(Object.entries(report.autotileMasks).map(([k, v]) => [k, v])), layers: report.layers, emptiness: report.emptiness, reach: report.reach }, null, 1));
if (!okAll) process.exitCode = 2;

// ───────────────────────── 8. 지역 참고본 등록(--publish): 검사가 모두 통과했을 때만
if (PUBLISH) {
  if (!okAll) { console.error("검사 실패 — 지역 참고본을 쓰지 않았다"); process.exit(2); }
  const REGION_DIR = join(ROOT, "public/assets/region-references");
  const PLACE_ID = "jp-city-shopstreet-48x40";
  const NAME = "일본 도시 · 상가 거리 (간선 교차로·생활도로·건널목)";
  const tpl = JSON.parse(fs.readFileSync(join(REGION_DIR, "interior-inn-tavern-1f.oprn.json"), "utf8"));   // 기본 프로젝트 몸체를 빌려 온다(modern-city 와 같은 방식)
  const mapOut = { ...MAP, name: NAME };
  const proj = structuredClone(tpl);
  proj.meta.title = NAME;
  proj.tilesets = { jp_city: { ...structuredClone(TS), referenceDocuments: structuredClone(TS.referenceDocuments ?? []) } };
  proj.maps = { [MAP.id]: mapOut };
  proj.mapTree = { mapId: MAP.id, children: [] };
  proj.startMapId = MAP.id; proj.startPos = { x: START[0], y: START[1] };
  proj.mapConnections = [];
  fs.writeFileSync(join(REGION_DIR, "jp-city-shopstreet.oprn.json"), JSON.stringify(proj));
  fs.copyFileSync(join(ROOT, "verify-shots/jp-city/shopstreet-1x.png"), join(REGION_DIR, "jp-city-shopstreet.png"));
  const slim = { id: TS.id, image: TS.image, tileSize: TS.tileSize, tilesPerRow: TS.tilesPerRow, count: TS.count, passability: TS.passability, priority: TS.priority, terrain: TS.terrain };
  const snapDir = join(ROOT, "src/project/regionReferences");
  fs.writeFileSync(join(snapDir, "jp-city-shopstreet.json"), JSON.stringify({ map: mapOut, tileset: slim }));
  const b = buildingLog;
  const entry = {
    id: PLACE_ID, name: NAME, kind: "completed-place", placeKind: "settlement", revision: 2, x: 0, y: 0, width: W, height: H, tilesetId: "jp_city",
    preview: "/assets/region-references/jp-city-shopstreet.png", tilesetPreview: "/assets/jp-city/jp-city-chipset.png",
    projectDownload: "/assets/region-references/jp-city-shopstreet.oprn.json",
    sourceProjectId: "oprn-bundled-jp-city-shopstreet", sourceMapId: MAP.id, snapshotProjectId: "oprn-place-jp-city-shopstreet-v1",
    rules: [
      `${W}×${H}칸 상가 거리. 오른쪽 아래에 간선 4차선 교차로(키트 jp-road-trunk-x, 신호기·정지선·화살표·횡단보도 포함)의 북서 사분면이 걸치고(동·남 팔과 반대편 차로는 맵 밖으로 잘렸다), 왼쪽 위로 생활도로(폭 4칸, 보도 없음)가 동서·남북으로 뻗는다. 동서 길에는 생활도로 횡단보도 키트 1곳(jp-road-lane-crosswalk-h). 건물 ${b.length}채·소품 ${SPOTS.length}개·코인 파킹 1곳. 아스팔트 비율 ${Math.round(report.asphalt.ratio * 100)}%.`,
      "구역마다 앵커가 하나다: 편의점이 선로 곁 모퉁이를 잡고, 셔터 점포·카페·마치야·편의점·사무소 5채가 동서 길 북쪽 줄(문은 포장 앞마당에 면함)을 이루며, 단층 점포 3채와 상점가 아치(남북 골목의 입구)가 간선 보도에 면한다. 건널목(경보기 둘·올라간 차단기)은 동서 길과 남북 선로가 만나는 한 곳이고 선로 양옆은 철망 담이다.",
      "간선·건널목·아치·소품은 키트 격자 그대로 찍고(타일은 1층, 위층 칸은 3층), 생활도로·선로·철망은 오토타일 엔진 규칙(autotileNeighborMask)으로 칸마다 마스크를 계산해 썼다. 건물은 건물 조립기 결과다(뒷줄 먼저, 앞줄 나중).",
      `문 ${doors.length}개의 접근칸이 모두 한 길망(시작 (${START[0]},${START[1]}) 기준 걸을 수 있는 ${report.reach.walkableCells}칸 전부 도달)에서 이어지고, 건물 몸채 ${report.buildingBodies.solidCells}칸은 엔진 통행이 모두 막는다.`,
      "공용 AI 문서가 아니라 조립 예제다 — 키트 id·원점·건물 입력은 openwiki/jp-city.md 와 scripts/content/jp-city/maps/shopstreet.plan.md 를 본다.",
    ],
    limitations: "지형·건물·소품 배치 참고 사례. 움직이는 열차·차·행인·이벤트는 없다. 간선 교차로는 북서 사분면만 있고 동·남 팔·반대편 차로·신호기 둘(북동·남쪽)은 맵 밖이다(보이는 신호기 1기). 노면 글자 止まれ 는 키트(jp-road-mark-tomare-*)만 있고 이 맵에는 쓰지 않았다(180° 돌려야 해서 읽히지 않음). 생활도로·선로·철망 키트 칸 근처를 에디터에서 다시 칠하면 연결 목록에 키트 칸이 없어 끝막이로 바뀔 수 있다, 선로는 위 모서리에서 들어와 건널목을 지나 간선 보도 앞에서 끝막이로 끝나는 측선이다. 주택·역·공원·신사는 쓰지 않았다. 자동 생성 프리셋이 아니다.",
  };
  const ts = "// Generated by scripts/content/jp-city/maps/shopstreet.mjs --publish. 일본 도시(jp_city) 상가 거리 예제 under 장소; snapshot in regionReferences/jp-city-shopstreet.json.\nexport const JP_CITY_PLACE_REFERENCES = " + JSON.stringify([entry], null, 2) + " as const;\n";
  fs.writeFileSync(join(ROOT, "src/project/jpCityPlaceReferences.ts"), ts);
  console.log("publish", { download: fs.statSync(join(REGION_DIR, "jp-city-shopstreet.oprn.json")).size, snapshot: fs.statSync(join(snapDir, "jp-city-shopstreet.json")).size });
}
