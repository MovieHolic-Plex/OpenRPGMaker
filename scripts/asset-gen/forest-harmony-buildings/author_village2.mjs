// 판타지 중세 숲성 마을(village-plan2.json) 저작. 저장소 뿌리에서:
//   node scripts/asset-gen/forest-harmony-buildings/author_village2.mjs .omo/asset-gen-tmp/fh-bld/village2/picks.json .omo/asset-gen-tmp/fh-bld/village2/village.json
// author_village.mjs(생성 건물 등록·배치·길)에 공용 숲마을 7종의 부품을 더했다: 절벽·계단(village-cliffs), 강·폭포·다리(author-diverse-villages 와 같은 붓),
// 울타리 고리 문법(호수마을·묘지와 같은 칸), 묘지 마당(landmarks.json), 경작지(village-farmland). 건물·소품 그림은 생성작(검사 통과작)만.
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../../ontology-ts-loader.mjs";
import { arrangeTallGrass } from "../../content/lib/tall-grass.mjs";
import { paintVillageCliffs } from "../../content/lib/village-cliffs.mjs";
import { farmlandTiles } from "../../content/lib/village-farmland.mjs";
const [picksPath, outPath] = process.argv.slice(2);
if (!picksPath || !outPath) throw Error("Usage: author_village2.mjs picks.json out.json");
const OUT = process.env.OUT_DIR || ".omo/asset-gen-tmp/fh-bld";
const VD = `${OUT}/${process.env.VDIR || "village2"}`;
const plan = JSON.parse(fs.readFileSync("tiledata/forest-harmony-buildings/village-plan2.json", "utf8"));
const picks = JSON.parse(fs.readFileSync(picksPath, "utf8"));
const gen = JSON.parse(fs.readFileSync(`${VD}/gen-tiles.json`, "utf8"));
const catalog = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json", "utf8"));
const parts = [...JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json", "utf8")).props,
  ...JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json", "utf8")).props];
const landmarkDefs = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/landmarks.json", "utf8"));
const retained = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/retained-vegetation.json", "utf8"));
const ts = structuredClone(catalog.tileset);
delete ts.referenceDocuments;
const cliffTiles = Object.fromEntries(Object.entries(catalog.cliffBindings).map(([k, v]) => [Number(k), v]));
const riverTiles = catalog.riverTiles;
let forest, reach;
await withTsModule("src/editor/tools/village/forestContour.ts", "gv2-forest.mjs", (m) => { forest = m; });
await withTsModule("src/project/lint/reachability.ts", "gv2-reach.mjs", (m) => { reach = m; });

// ── 생성 칸 등록(author_village.mjs 와 같다) ──
const base = Math.ceil(ts.count / 30) * 30, layerOf = new Map();
for (const b of Object.values(gen.buildings)) for (const c of b.cells) if (c && c.k !== undefined) layerOf.set(c.k, c);
for (let k = 0; k < gen.tiles; k++) {
  const id = base + k, c = layerOf.get(k), walk = c.walk, upper = c.layer === "U";
  ts.tileGrafts.push({ sourceChipset: "tex_forest_harmony_fantasy_town", sourceTile: k, targetTile: id });
  ts.passability[id] = { up: walk, down: walk, left: walk, right: walk };
  ts.priority[id] = upper ? "upper" : "lower";
  ts.terrain[id] = 0;
  ts.tileMeta[id] = { label: upper ? "생성 건물 · 지붕 위(굴뚝·첨탑)" : "생성 건물", role: "building", source: "user", userLocked: true,
    defaultLayer: upper ? "upper" : "lower", passage: walk ? "passable" : "solid", description: "설계도 방식 생성 건물·소품 칸. 통행은 설계도가 정한다." };
}
ts.count = Math.ceil((base + gen.tiles) / 30) * 30;
for (const [arr, fill] of [[ts.terrain, 0], [ts.priority, "lower"]]) while (arr.length < ts.count) arr.push(fill);
while (ts.passability.length < ts.count) ts.passability.push({ up: false, down: false, left: false, right: false });
while (ts.tileMeta.length < ts.count) ts.tileMeta.push({ label: "미사용", source: "unknown" });

// ── 맵 ──
const W = plan.width, H = plan.height, area = { x: 0, y: 0, w: W, h: H };
const m = { id: plan.id, name: plan.name, width: W, height: H, tileSize: 16, tilesetId: ts.id, lowerTiles: Array(W * H).fill(240), upperTiles: Array(W * H).fill(-1), events: [] };
const P = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]], N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const reserved = new Set(), roads = new Set(), cobble = new Set(), solid = new Set(), water = new Set(), access = [], buildings = [], landmarks = [];
const reserve = (x, y, w, h, pad = 0) => { for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inside(xx, yy)) reserved.add(P(xx, yy)); };
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const paintGroup = (cells, g, joined = cells, edgeJoins = () => false) => {
  for (const i of cells) {
    const x = i % W, y = Math.floor(i / W); let mask = 0;
    N8.forEach(([dx, dy], b) => { if (inside(x + dx, y + dy) ? joined.has(P(x + dx, y + dy)) : edgeJoins(i)) mask |= 1 << b; });
    m.lowerTiles[i] = g.variantMap[String(mask)];
  }
};

// 절벽 + 계단: 끝은 숲으로 죽인다(계단으로만 오른다)
const cliffPlan = paintVillageCliffs(m, plan.cliffs, cliffTiles);
for (const c of plan.cliffs) for (const [ex, ey, dir] of [[...c.points[0], -1], [...c.points.at(-1), 1]]) {
  for (let y = Math.max(0, ey - 3); y <= Math.min(H - 1, ey + c.height + 1); y++) for (let d = 1; d <= 4; d++) {
    const x = ex + dir * d; if (inside(x, y) && cliffPlan.cells[P(x, y)] !== "cliff") solid.add(P(x, y));
  }
}
for (const [x, y, height] of plan.stairs) {
  for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) {
    const i = P(xx, yy); assert(cliffPlan.cliff.has(i), `계단이 절벽면 전체를 덮지 않음 ${xx},${yy}`);
    m.lowerTiles[i] = cliffTiles[374]; m.upperTiles[i] = -1;
  }
  reserve(x, y - 1, 2, height + 3, 1);
  access.push({ role: "stairs-top", x, y: y - 1 }, { role: "stairs-bottom", x, y: y + height + 1 });
}
for (const i of cliffPlan.cliff) if (m.lowerTiles[i] !== cliffTiles[374]) solid.add(i);

// 강: 폭 붓으로 중심선을 긋고, 절벽을 지나는 곳은 윗선 = 물, 면 = 폭포, 밑은 웅덩이
const river = new Set(), fallCells = new Set();
{
  const { points, width } = plan.river;
  for (let n = 0; n < points.length - 1; n++) {
    const [x0, y0] = points[n], [x1, y1] = points[n + 1], steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4;
    for (let k = 0; k <= steps; k++) {
      const cx = x0 + (x1 - x0) * k / steps, cy = Math.round(y0 + (y1 - y0) * k / steps), left = Math.round(cx - width / 2);
      for (let d = 0; d < width; d++) if (inside(left + d, cy)) river.add(P(left + d, cy));
    }
  }
  for (const [cx, cy, rx, ry] of plan.river.pools) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (inside(x, y) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && !cliffPlan.cliff.has(P(x, y))) river.add(P(x, y));
  }
  for (const i of river) {
    const x = i % W, y = Math.floor(i / W);
    if (!cliffPlan.cliff.has(i)) { water.add(i); continue; }
    const c = cliffPlan.columns.find((k) => k.x === x && y >= k.y && y <= k.y + k.height);
    m.upperTiles[i] = -1;
    if (y === c.y) water.add(i); else { m.lowerTiles[i] = riverTiles.fall; fallCells.add(i); }
  }
}
paintGroup(water, group("forest_harmony_lake_47"), new Set([...water, ...fallCells]), (i) => river.has(i));
for (const i of [...water, ...fallCells]) { solid.add(i); reserve(i % W, Math.floor(i / W), 1, 1, 1); }
// 다리: 계획은 [행, 가까운 x]. 그 행의 물 줄기 전체에 2행 다리를 놓는다(윗줄 102, 아랫줄 103)
const bridgeCells = new Set();
const runAt = (y, hint) => {
  let x0 = hint, n = 0; while (!water.has(P(x0, y)) && n++ < 12) x0 += x0 < W / 2 ? 1 : -1;
  if (!water.has(P(x0, y))) return null;
  while (water.has(P(x0 - 1, y))) x0--;
  let x1 = x0; while (water.has(P(x1 + 1, y))) x1++;
  return [x0, x1];
};
for (const [want, hint] of plan.bridges) {
  // 비스듬한 강은 윗줄·아랫줄 물 폭이 다르다 — 두 줄 물 줄기가 같은 행을 가까운 데서 찾는다(다리 끝이 물에 빠지지 않게)
  const by = [0, 1, -1, 2, -2, 3, -3].map((d) => want + d).find((y) => { const a = runAt(y, hint), b = runAt(y + 1, hint); return a && b && a[0] === b[0] && a[1] === b[1]; });
  assert(by !== undefined, "다리 놓을 행 없음 " + want);
  const [x0, x1] = runAt(by, hint);
  for (let x = x0; x <= x1; x++) for (const [dy, tile] of [[0, riverTiles.bridgeTop], [1, riverTiles.bridgeBottom]]) {
    const i = P(x, by + dy); assert(water.has(i), `다리 아랫줄이 물 밖 ${x},${by + dy}`);
    m.lowerTiles[i] = tile; bridgeCells.add(i); solid.delete(i);
  }
  for (const [ax, role] of [[x0 - 1, "bridge-west"], [x1 + 1, "bridge-east"]]) {
    for (const dy of [0, 1]) assert(!water.has(P(ax, by + dy)), `다리 끝이 물에 ${ax},${by + dy}`);
    access.push({ role, x: ax, y: by });
  }
}

// ── 생성 건물 ──
const stampGen = (s, art, kind) => {
  const b = gen.buildings[art]; assert(b, "시트에 없는 그림 " + art);
  const top = s.y - b.headExtra;
  b.cells.forEach((c, k) => {
    if (!c) return;
    const x = s.x + k % b.w, y = top + Math.floor(k / b.w), i = P(x, y);
    assert(inside(x, y) && !water.has(i) && !cliffPlan.cliff.has(i) && m.upperTiles[i] === -1 && (m.lowerTiles[i] === 240 || c.layer === "U"), `${kind} 겹침 ${s.id ?? art} ${x},${y}`);
    assert(!reserved.has(i) || kind === "prop" || s.riverside && [...N4, [0, 0]].some(([dx, dy]) => water.has(P(x + dx, y + dy)) || water.has(P(x + 2 * dx, y + 2 * dy))), `${kind} 이 예약 칸 위 ${s.id ?? art} ${x},${y}`);   // 물레방앗간은 물가에 붙는다
    const tile = c.orig ?? base + c.k;
    if (c.layer === "U") m.upperTiles[i] = tile; else m.lowerTiles[i] = tile;
    if (!(c.walk || (c.layer === "U" && kind !== "prop"))) solid.add(i);
  });
  return { b, top };
};
for (const s of plan.slots) {
  const art = picks[s.id]; assert(art, "고른 그림 없음 " + s.id);
  const { b, top } = stampGen(s, art, "건물");
  const doors = b.doors.map((d) => ({ x: s.x + d.x, y: top + d.y, front: { x: s.x + d.front[0], y: top + d.front[1] } }));
  buildings.push({ id: s.id, role: s.role, blueprint: s.blueprint, art, label: b.label, x: s.x, y: top, w: b.w, h: b.h, headExtra: b.headExtra, doors });
  reserve(s.x, top, b.w, b.h, 1);
  for (const d of doors) { reserve(d.front.x, d.front.y, 1, 2, 0); access.push({ role: "door-front", building: s.id, ...d.front }); }
}
const gate = buildings.find((b) => b.id === "gate");
const gateCells = [];
for (let k = 0; k < gate.w * gate.h; k++) {
  const c = gen.buildings[gate.art].cells[k]; if (!c?.walk || c.layer === "U") continue;
  gateCells.push([gate.x + k % gate.w, gate.y + Math.floor(k / gate.w)]);
}
const gateXs = [...new Set(gateCells.map(([x]) => x))], gateBottom = Math.max(...gateCells.map(([, y]) => y));
access.push({ role: "gate-inside", x: gateXs[0], y: gate.y - 1 });   // 문루(A 칸 = 상위·통행) 바로 안쪽 큰길

// ── 울타리 고리 문법(호수마을·묘지): 윗변 378·379·380, 옆 408, 밑변 438 … 439 … 409·410 ──
const fenceAt = (x, y, t) => {
  const i = P(x, y); if (water.has(i) || fallCells.has(i) || bridgeCells.has(i)) return false;
  assert(m.upperTiles[i] === -1 && m.lowerTiles[i] === 240, `울타리 겹침 ${x},${y}`);
  m.upperTiles[i] = t; solid.add(i); reserved.add(i); return true;
};
{
  const { x0, x1, top, bottom } = plan.fence;
  for (let y = top; y < bottom; y++) { fenceAt(x0, y, 408); fenceAt(x1, y, 408); }
  const gx0 = gate.x, gx1 = gate.x + gate.w - 1;
  for (let x = x0; x <= x1; x++) {
    if (x >= gx0 && x <= gx1) continue;
    const t = x === x0 ? 438 : x === x1 ? 410 : x === x1 - 1 ? 409 : 439;
    fenceAt(x, bottom, t);
  }
}
const yardRing = (x, y, w, h, gx, gw, id, label) => {
  const at = (dx, dy) => P(x + dx, y + dy), bottom = h - 1;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const i = at(dx, dy); assert(inside(x + dx, y + dy) && m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !water.has(i) && !reserved.has(i), `마당 겹침 ${id} ${x + dx},${y + dy}`);
  }
  for (let dx = 0; dx < w; dx++) {
    fenceAt(x + dx, y, dx === 0 ? 378 : dx === w - 1 ? 380 : 379);
    if (dx < gx || dx >= gx + gw) fenceAt(x + dx, y + bottom, dx === 0 ? 438 : dx === w - 1 ? 410 : dx === w - 2 ? 409 : 439);
  }
  for (let dy = 1; dy < bottom; dy++) { fenceAt(x, y + dy, 408); fenceAt(x + w - 1, y + dy, 408); }
  access.push({ role: "yard-gate", x: x + gx, y: y + h, yard: id }, { role: "yard-inside", x: x + gx, y: y + bottom - 1, yard: id });
  reserve(x, y, w, h + 1, 1);
  landmarks.push({ id, label, x, y, w, h, gate: { x: x + gx, y: y + bottom, w: gw } });
};
for (const [kind, x, y] of plan.yards) {
  const yd = landmarkDefs.yards[kind];
  yardRing(x, y, yd.w, yd.h, yd.gate[0], yd.gate[1], kind, yd.label);
  for (const [dx, dy, t] of yd.contents) { m.upperTiles[P(x + dx, y + dy)] = t; solid.add(P(x + dx, y + dy)); }
}
for (const [x, y, w, h, gx] of plan.pastures) yardRing(x, y, w, h, gx, 2, `pasture-${x}-${y}`, "울타리 친 목장");

// ── 밭(경작지 3×3 조각 문법): 길보다 먼저 — 길은 밭을 돌아간다 ──
const farmCells = new Set();
for (const [x, y, w, h] of plan.farms) {
  const tiles = farmlandTiles(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const i = P(x + xx, y + yy); assert(m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !solid.has(i), `밭이 겹침 ${x + xx},${y + yy}`);
    m.lowerTiles[i] = tiles[yy * w + xx]; farmCells.add(i);
  }
  reserve(x, y, w, h, 0);
}

// ── 길: 포석(광장·큰길) + 흙길(문 앞까지) ──
const pz = plan.plaza;
for (let y = pz.y; y < pz.y + pz.h; y++) for (let x = pz.x; x < pz.x + pz.w; x++) cobble.add(P(x, y));
for (const [x, y, w, h] of plan.cobble) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) cobble.add(P(xx, yy));
for (const i of cobble) assert(!solid.has(i) && m.lowerTiles[i] === 240 || m.lowerTiles[i] === cliffTiles[374], `포석이 막힌 칸 ${i % W},${Math.floor(i / W)}`);
for (const [x, y] of gateCells) cobble.add(P(x, y));   // 성문 통로 칸은 이미 생성 그림(검은 통로) — 길 연결용으로만 센다
const route = ([ax, ay], [bx, by]) => {
  const start = P(ax, ay), end = P(bx, by), key = (i, d) => i * 5 + d, dist = new Map([[key(start, 4), 0]]), prev = new Map(), open = [key(start, 4)];
  const h = (i) => Math.abs(i % W - bx) + Math.abs(Math.floor(i / W) - by);
  let goal;
  while (open.length) {
    open.sort((a, b) => dist.get(a) + h(Math.floor(a / 5)) - dist.get(b) - h(Math.floor(b / 5)));
    const at = open.shift(), i = Math.floor(at / 5), dir = at % 5;
    if (i === end) { goal = at; break; }
    const x = i % W, y = Math.floor(i / W);
    N4.forEach(([dx, dy], d) => {
      const nx = x + dx, ny = y + dy, ni = P(nx, ny);
      if (!inside(nx, ny) || farmCells.has(ni) || (solid.has(ni) && !bridgeCells.has(ni) && !cobble.has(ni))) return;
      const cost = dist.get(at) + (roads.has(ni) || cobble.has(ni) || bridgeCells.has(ni) ? 0.4 : 1) + (dir !== 4 && dir !== d ? 3 : 0);
      const k = key(ni, d);
      if (cost < (dist.get(k) ?? Infinity)) { dist.set(k, cost); prev.set(k, at); if (!open.includes(k)) open.push(k); }
    });
  }
  assert(goal !== undefined, `길 없음 ${ax},${ay} → ${bx},${by}`);
  for (let k = goal; k !== key(start, 4); k = prev.get(k)) { const i = Math.floor(k / 5); if (!cobble.has(i) && !bridgeCells.has(i)) roads.add(i); }
  if (!cobble.has(start) && !bridgeCells.has(start)) roads.add(start);
};
// 입구 → 성문 → 큰길. 계단 두 곳·다리 끝·문 앞·마당 문은 가장 가까운 포석·길로
route([plan.entrance.x, plan.entrance.y], [gateXs[0], gateBottom]);
// 다리는 망에 넣지 않는다 — 넣으면 강 건너 끝이 다리에만 붙고 길에는 안 닿는다. 다리는 아래에서 두 끝을 따로 잇는다.
const netCells = () => [...cobble, ...roads].filter((i) => !gateCells.some(([x, y]) => P(x, y) === i));
const byDistance = [...access].sort((a, b) => Math.hypot(a.x - W / 2, a.y - 50) - Math.hypot(b.x - W / 2, b.y - 50));
for (const a of byDistance) {
  if (cobble.has(P(a.x, a.y)) || roads.has(P(a.x, a.y))) continue;
  const net = netCells().filter((i) => {
    // 윗단 칸은 윗단 길로, 아랫단은 아랫단 길로(절벽을 가로질러 최단 거리를 재지 않게). 계단 끝은 양쪽.
    const up = (y) => y < 30;
    return a.role.startsWith("stairs") || up(Math.floor(i / W)) === up(a.y);
  });
  const near = net.reduce((b, i) => (Math.abs(i % W - a.x) + Math.abs(Math.floor(i / W) - a.y) < Math.abs(b % W - a.x) + Math.abs(Math.floor(b / W) - a.y) ? i : b), net[0]);
  route([a.x, a.y], [near % W, Math.floor(near / W)]);
}
// 계단 윗끝 ↔ 아랫끝이 같은 계단으로 이어지므로 윗단 길도 계단을 거쳐 전체 망에 붙는다. 다리 두 끝은 서로 잇는다.
for (let n = 0; n < access.length; n++) if (access[n].role === "bridge-west") route([access[n].x, access[n].y], [access[n + 1].x, access[n + 1].y]);
// 강 건너 윗단 룬석 고리: 다리 동쪽 끝에서 고리 한가운데까지(막다른 토막 길 대신)
if (plan.shrine) for (const a of access) if (a.role === "bridge-east" && a.y < 30) route([a.x, a.y], plan.shrine.path);
// 흙길 2칸 폭(오른쪽·아래, 잔디만)
for (const i of [...roads]) {
  const x = i % W, y = Math.floor(i / W);
  for (const [dx, dy] of [[1, 0], [0, 1]]) { const ni = P(x + dx, y + dy); if (inside(x + dx, y + dy) && !solid.has(ni) && !reserved.has(ni) && !cobble.has(ni) && m.lowerTiles[ni] === 240 && m.upperTiles[ni] === -1) roads.add(ni); }
}
const paved = new Set([...cobble].filter((i) => m.lowerTiles[i] === 240));
paintGroup(paved, group("builtin_cobble"));
const dirt = new Set([...roads].filter((i) => m.lowerTiles[i] === 240));
paintGroup(dirt, group("forest_harmony_road_47"), new Set([...dirt, ...paved]));
for (const i of [...paved, ...dirt]) reserve(i % W, Math.floor(i / W), 1, 1, 1);


// ── 소품: 원본 부품 + 생성 소품. 계획 자리가 막히면 4칸 안 가장 가까운 빈자리 ──
const props = [], skipped = [];
const ring = [];
for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
const inPlaza = (x, y) => x >= pz.x && y >= pz.y && x < pz.x + pz.w && y < pz.y + pz.h;
const mainStreet = (x) => x === 51 || x === 52;
const placeCells = (px, py, cellsOf) => {
  const fits = (x, y) => {
    const out = [];
    for (const [dx, dy, t] of cellsOf) {
      const i = P(x + dx, y + dy);
      if (!inside(x + dx, y + dy) || solid.has(i) || m.upperTiles[i] !== -1 || mainStreet(x + dx)) return null;
      if (inPlaza(px, py) ? !inPlaza(x + dx, y + dy) : paved.has(i) || dirt.has(i) || (m.lowerTiles[i] !== 240 && !farmlandSet.has(m.lowerTiles[i]))) return null;
      if (access.some((a) => Math.abs(a.x - x - dx) + Math.abs(a.y - y - dy) <= 1)) return null;   // 문 앞·계단·다리 끝은 비운다
      out.push([i, t]);
    }
    return out;
  };
  const spot = ring.map(([dx, dy]) => [px + dx, py + dy]).find(([x, y]) => fits(x, y));
  return spot ? { spot, cells: fits(...spot) } : null;
};
const farmlandSet = new Set(farmlandTiles(3, 3));
for (const [name, px, py] of plan.props) {
  const p = parts.find((q) => q.name === name); assert(p, "없는 부품 " + name);
  const cellsOf = [];
  for (let dy = 0; dy < p.height; dy++) for (let dx = 0; dx < p.width; dx++) { const t = p.targetUpper[dy][dx]; if (t !== null && t >= 0) cellsOf.push([dx, dy, t]); }
  const got = placeCells(px, py, cellsOf);
  if (!got) { skipped.push([name, px, py]); continue; }
  for (const [i, t] of got.cells) { m.upperTiles[i] = t; if (!ts.passability[t]?.up) solid.add(i); }
  reserve(got.spot[0], got.spot[1], p.width, p.height, 0);
  props.push({ name, x: got.spot[0], y: got.spot[1], w: p.width, h: p.height, moved: got.spot[0] !== px || got.spot[1] !== py });
}
const artsOf = (bp) => Object.keys(gen.buildings).filter((n) => gen.buildings[n].blueprint === bp).sort();
const hashp = (x, y, s) => { let v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791); v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
for (const [bp, px, py, vi] of plan.genProps) {   // vi = 모양 번호(없으면 자리 해시). 이웃한 같은 소품이 같은 도장으로 겹치지 않게 계획에서 고른다
  const arts = artsOf(bp); assert(arts.length, "생성 소품 없음 " + bp);
  const art = arts[vi !== undefined ? vi % arts.length : Math.floor(hashp(px, py, 7) * arts.length)];
  const b = gen.buildings[art], cellsOf = [];
  b.cells.forEach((c, k) => { if (c) cellsOf.push([k % b.w, Math.floor(k / b.w) - b.headExtra, c.orig ?? base + c.k]); });   // orig = 칩셋 원래 칸(손 그림 대신 원본을 쓰는 소품)
  const got = placeCells(px, py, cellsOf);
  if (!got) { skipped.push([b.label, px, py]); continue; }
  for (const [i, t] of got.cells) { m.upperTiles[i] = t; if (!ts.passability[t]?.up) solid.add(i); }
  reserve(got.spot[0], got.spot[1] - b.headExtra, b.w, b.h, 0);
  props.push({ name: b.label, generated: art, x: got.spot[0], y: got.spot[1], w: b.w, h: b.h, moved: got.spot[0] !== px || got.spot[1] !== py });
}

// ── 나무: 자리 지정(덩이로 둔다 — 흩뿌린 점무늬 대신) ──
const trees = [];
const freeRect = (x, y, w, h) => x >= 1 && y >= 1 && x + w < W - 1 && y + h < H - 1 && Array.from({ length: w * h }, (_, k) => P(x + k % w, y + Math.floor(k / w)))
  .every((i) => m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !reserved.has(i) && !solid.has(i));
for (const [name, tx, ty] of plan.trees) {
  const o = Object.values(retained).flat().find((q) => q.name === name); assert(o, "없는 나무 " + name);
  const spot = ring.map(([dx, dy]) => [tx + dx, ty + dy]).find(([x, y]) => freeRect(x - 1, y - 1, o.w + 2, o.h + 2));
  if (!spot) { skipped.push([name, tx, ty]); continue; }
  const [x, y] = spot;
  for (let k = 0; k < o.w * o.h; k++) { const i = P(x + k % o.w, y + Math.floor(k / o.w)); m.lowerTiles[i] = o.lower[k]; m.upperTiles[i] = o.upper[k]; }
  reserve(x, y, o.w, o.h, 1);
  trees.push({ name, x, y, w: o.w, h: o.h });
}

// ── 숲: 울타리 밖과 맨 위 띠는 숲, 안쪽은 비운다(마을은 트였고, 가장자리는 숲이 막는다) ──
const { x0: fx0, x1: fx1, bottom: fb } = plan.fence;
const road = (x, y) => y > fb && Math.abs(x - 51.5) < 4.5;
const field = (x, y) => {
  if (road(x, y)) return -5;
  if (plan.shrine && Math.hypot(x - plan.shrine.x, (y - plan.shrine.y) * 1.15) < plan.shrine.r) return -5;
  if (y < 4) return 3;
  if (x < fx0 || x > fx1) return 3;
  if (y > fb) return 1.2 + forest.forestContourScore(x, y, area, plan.seed, 0.4) - (Math.abs(x - 51.5) < 12 ? 1.4 : 0);
  if (y < 30) return forest.forestContourScore(x, y, area, plan.seed, 0.4) - 1 + (x > 88 && y < 8 ? 1 : 0) + (x < 20 && y < 6 ? 1 : 0);
  return -5;
};
const grove = forest.paintContouredForest(m, area, group("forest_harmony_grove_47"), (x, y) => m.lowerTiles[P(x, y)] === 240 && m.upperTiles[P(x, y)] === -1 && !reserved.has(P(x, y)), plan.seed, 0.4, undefined, field);

// ── 빈 잔디 채움(빈칸 게이트 /tmp/oprn-qa/FILL-RULES.md: 최대 빈 정사각형 ≤4칸, 17×13 한 화면에 빈 잔디 ≤40%) ──
// 자연 덩이만: 나무 2~3그루, 키큰 풀 덩이 + 들꽃, 덤불 셋(꽃 관목·덤불·바위·그루터기). 가장 넓게 빈 곳부터 하나씩 메운다.
const tallGrass = new Set(), fillers = [];
// 1칸 소품 모양 목록. 갈대는 물이 있는 쪽(side)별로 따로 — 물가 칸 안쪽 둑 때문에 물 쪽 끝에 붙은 그림이어야 물에 닿아 보인다.
const genPieces = (bp, pred = () => true) => artsOf(bp).filter((n) => pred(gen.buildings[n])).map((n) => { const c = gen.buildings[n].cells[0]; return c.orig ?? base + c.k; });
const pick = (list, x, y, s) => list.length ? list[Math.floor(hashf(x, y, s) * list.length)] : null;
// 위·왼쪽·오른쪽·아래 이웃과 다른 모양(같은 도장이 줄지어 붙지 않게)
const pickApart = (list, x, y, s) => {
  if (!list.length) return null;
  const near = new Set(N4.map(([dx, dy]) => m.upperTiles[P(x + dx, y + dy)]));
  const start = Math.floor(hashf(x, y, s) * list.length);
  for (let i = 0; i < list.length; i++) { const t = list[(start + i) % list.length]; if (!near.has(t)) return t; }
  return list[start];
};
const piece = { flowers: genPieces("prop-wildflowers"), reedsL: genPieces("prop-reeds", (b) => b.side === "L"), reedsR: genPieces("prop-reeds", (b) => b.side === "R") };
const plainAt = (x, y) => inside(x, y) && m.upperTiles[P(x, y)] === -1 && m.lowerTiles[P(x, y)] === 240 && !tallGrass.has(P(x, y));
const nearAccess = (x, y, r) => access.some((a) => Math.abs(a.x - x) <= r && Math.abs(a.y - y) <= r) || plan.npcs.some(([, , , nx, ny]) => nx === x && ny === y);
const openAround = (x, y) => N8.every(([dx, dy]) => plainAt(x + dx, y + dy) || tallGrass.has(P(x + dx, y + dy))) && !nearAccess(x, y, 1);
const hashf = (x, y, s) => { let v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791); v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
const largestSquare = (x0 = 0, y0 = 0, x1 = W, y1 = H) => {
  const dp = new Int32Array((W + 1) * (H + 1)); let best = 0, at = null;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!plainAt(x, y)) continue;
    const v = 1 + Math.min(dp[y * (W + 1) + x], dp[(y + 1) * (W + 1) + x], dp[y * (W + 1) + x + 1]);
    dp[(y + 1) * (W + 1) + x + 1] = v;
    if (v > best) { best = v; at = [x - v + 1, y - v + 1]; }
  }
  return { best, at };
};
const worstScreen = () => {
  let worst = 0, at = null;
  for (let y = 0; y + 13 <= H; y += 4) for (let x = 0; x + 17 <= W; x += 4) {
    let n = 0; for (let yy = y; yy < y + 13; yy++) for (let xx = x; xx < x + 17; xx++) if (plainAt(xx, yy) || tallGrass.has(P(xx, yy)) && false) n++;
    if (n / 221 > worst) { worst = n / 221; at = [x, y]; }
  }
  return { worst, at };
};
const treeKindsAll = ["숲 나무 · 활엽수", "숲 나무 · 둥근 덤불", "숲 나무 · 작은 덤불"].map((n) => Object.values(retained).flat().find((q) => q.name === n));
const putTree = (o, x, y) => {
  for (let k = 0; k < o.w * o.h; k++) if (!plainAt(x + k % o.w, y + Math.floor(k / o.w)) || nearAccess(x + k % o.w, y + Math.floor(k / o.w), 1)) return false;
  for (let dx = -1; dx <= o.w; dx++) for (let dy = -1; dy <= o.h; dy++) { const xx = x + dx, yy = y + dy; if (inside(xx, yy) && (paved.has(P(xx, yy)) || dirt.has(P(xx, yy))) && dy === o.h) return false; }   // 나무 밑동이 길에 닿지 않게
  for (let k = 0; k < o.w * o.h; k++) { const i = P(x + k % o.w, y + Math.floor(k / o.w)); m.lowerTiles[i] = o.lower[k]; m.upperTiles[i] = o.upper[k]; solid.add(i); }
  fillers.push({ kind: o.name, x, y }); return true;
};
const putOne = (t, x, y, walk) => {
  if (t === null || !plainAt(x, y) || !walk && !openAround(x, y)) return false;
  m.upperTiles[P(x, y)] = t; if (!walk) solid.add(P(x, y)); fillers.push({ kind: t, x, y }); return true;
};
const grassBlob = (cx, cy, rx, ry, seed) => {
  let n = 0;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 + 0.25 * (hashf(x, y, seed) - 0.5) || !plainAt(x, y)) continue;
    tallGrass.add(P(x, y)); n++;
  }
  return n;
};
const cluster = (cx, cy, size, k) => {
  const r = hashf(cx, cy, k);
  if (size >= 6 && r < 0.5) {                     // 나무 덩이: 활엽수 하나 + 덤불 하나~둘
    let ok = putTree(treeKindsAll[0], cx - 1, cy - 2);
    ok = putTree(treeKindsAll[1 + (k % 2)], cx + 2, cy) || ok;
    if (hashf(cy, cx, k) < 0.5) ok = putTree(treeKindsAll[2], cx - 3, cy + 1) || ok;
    if (ok) return true;
  }
  if (r < 0.8) {                                  // 키큰 풀 덩이 + 들꽃 두셋
    const n = grassBlob(cx + 0.5, cy + 0.5, 1.6 + size * 0.25, 1.2 + size * 0.15, k);
    // 들꽃은 풀 덩이 가장자리에 한두 송이만(같은 도장이 격자로 늘어서지 않게 모양도 섞는다)
    for (const [dx, dy] of [[2, 1], [-2, 0]].slice(0, 1 + (k % 2))) { const fx = cx + dx + (size > 5 ? 2 : 1), fy = cy + dy - 1; putOne(pickApart(piece.flowers, fx, fy, 5), fx, fy, true); }
    if (n) return true;
  }
  let ok = false;                                 // 덤불 셋(꽃 관목·덤불·바위나 그루터기)
  for (const [dx, dy, t] of [[0, 0, 768], [1, 1, 289], [-1, 1, 288]]) ok = putOne(t, cx + dx, cy + dy, false) || ok;   // 덤불 셋(바위·그루터기는 뺐다 — 마을 잔디에 굴러다니는 돌·뿌리는 어색하다)
  if (!ok) ok = grassBlob(cx + 0.5, cy + 0.5, 1.5, 1.2, k) > 0;
  return ok;
};
// 물가 갈대: 강 양옆 둑에 두세 칸짜리 무리로(외톨이 도장·일직선 줄 대신). 물이 왼쪽이면 왼쪽에 붙은 그림.
{
  const bank = [];
  for (const i of water) {
    const x = i % W, y = Math.floor(i / W);
    for (const dx of [-1, 1]) if (!water.has(P(x + dx, y)) && !fallCells.has(P(x + dx, y)) && !bridgeCells.has(P(x + dx, y)) && plainAt(x + dx, y)) bank.push([x + dx, y, dx > 0 ? "L" : "R"]);
  }
  const done = new Set();
  for (const [x, y, side] of bank) {
    if (done.has(P(x, y)) || hashf(x, y, 11) > 0.07) continue;
    const run = 2 + Math.floor(hashf(y, x, 12) * 2);
    for (let d = 0; d < run; d++) {
      const yy = y + d, ok = bank.some(([bx, by, bs]) => bx === x && by === yy && bs === side);
      if (!ok || done.has(P(x, yy))) break;
      done.add(P(x, yy)); putOne(pickApart(side === "L" ? piece.reedsL : piece.reedsR, x, yy, 13), x, yy, true);
    }
  }
}
for (let k = 0; k < 600; k++) {
  const sq = largestSquare();
  if (sq.best > 4) { if (!cluster(sq.at[0] + (sq.best >> 1), sq.at[1] + (sq.best >> 1), sq.best, k)) break; continue; }
  const sc = worstScreen();
  if (sc.worst <= 0.35) break;   // 키큰 풀 정리(2×2 미만 띠 제거)로 다시 비는 몫을 남긴다
  const inner = largestSquare(sc.at[0], sc.at[1], sc.at[0] + 17, sc.at[1] + 13);
  if (!inner.at || !cluster(inner.at[0] + (inner.best >> 1), inner.at[1] + (inner.best >> 1), inner.best, k)) break;
}
paintGroup(tallGrass, group("builtin_tall_grass"));
// 키큰 풀 E/F/G(#1421): 덩이마다 한 종류 — 수관 곁 E(짙음), 집·길 3칸 안 G(짧음), 나머지 F(밝음). 2×2 안 되는 띠는 잔디로.
const arranged = arrangeTallGrass(m, { tileset: ts, houses: buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })), seed: plan.seed });
m.lowerTiles = arranged.lowerTiles;
for (const i of [...tallGrass]) if (m.lowerTiles[i] === 240) tallGrass.delete(i);
const fillReport = { maxSq: largestSquare().best, screen: Math.round(worstScreen().worst * 100), clusters: fillers.length, tallGrass: tallGrass.size, tallGrassTypes: arranged.stats };

// ── 사람·동물(이벤트) ──
const frame = (k) => (Math.floor(k / 4) * 4 + 2) * 12 + (k % 4) * 3 + 1;   // 아래를 보고 선 칸(easyrpgRtp.charsetFrameIndex 와 같은 식)
const events = [];
const npcSpot = (x, y) => ring.map(([dx, dy]) => [x + dx, y + dy]).find(([xx, yy]) => {
  const i = P(xx, yy); return inside(xx, yy) && !solid.has(i) && m.upperTiles[i] === -1 && !events.some((e) => e.x === xx && e.y === yy) && !access.some((a) => a.x === xx && a.y === yy);
});
const addNpc = (name, sheet, k, x, y, move, text) => {
  const s = npcSpot(x, y); if (!s) { skipped.push([name, x, y]); return; }
  const id = `ev_${plan.id.replace(/-/g, "_")}_${events.length + 1}`;
  events.push({ id, name, placementRole: "npc", x: s[0], y: s[1], trigger: { kind: "action" }, commands: [],
    pages: [{ id: id + "_p1", name, conditions: [], graphic: { sprite: { type: "bundled", id: sheet }, pattern: frame(k), direction: "down" },
      trigger: { kind: "action" }, priority: "same", movement: { type: move, speed: move === "random" ? 2 : 3, frequency: move === "random" ? 2 : 3 },
      commands: text ? [{ kind: "text", speaker: name, body: text }] : [] }] });
};
for (const [name, sheet, k, x, y, move, text] of plan.npcs) addNpc(name, sheet, k, x, y, move, text);
for (const [name, k, x, y] of plan.animals) addNpc(name, "tex_easyrpg_charset_animal", k, x, y, "random", null);
m.events = events;

// ── 도달: 엔진 canMove BFS(입구에서) ──
const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
const reachable = reach.computeReachableCells(project, { ...m, events: [] }, plan.entrance.x, plan.entrance.y);
const blocked = access.filter((a) => !reachable.has(a.x + "," + a.y));
m.layoutPlan = { version: 1, kind: "generated-building-village", seed: plan.seed, regions: buildings, entrance: plan.entrance, notes: plan.note };
const result = { map: m, tileset: ts, genTileBase: base, genTiles: gen.tiles, buildings, landmarks, props, trees, skipped, access, blocked,
  grove: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns }, reachable: [...reachable], fill: fillReport, roads: dirt.size, cobble: paved.size, water: water.size, falls: fallCells.size, npcs: events.length };
fs.writeFileSync(outPath, JSON.stringify(result));
console.log({ fill: fillReport, buildings: buildings.length, landmarks: landmarks.length, doors: access.length, blocked: blocked.length, props: props.length, trees: trees.length, npcs: events.length,
  skipped, forest: grove.canopyCells, reachable: reachable.size, newTiles: gen.tiles, water: water.size, falls: fallCells.size, cobble: paved.size, dirt: dirt.size });
assert.equal(blocked.length, 0, "도달 실패 " + JSON.stringify(blocked));
