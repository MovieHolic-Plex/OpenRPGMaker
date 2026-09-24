// 생성 건물 큰 숲마을 저작. 저장소 뿌리에서: node scripts/asset-gen/forest-harmony-buildings/author_village.mjs <picks.json> <out.json>
// 바탕 타일셋 = 공용 숲마을 7종 정본(tiledata/forest-villages/diverse/catalog.json)의 숲마을 타일셋. 생성 건물 칸은 그 뒤에 새 번호로 붙이고
// tileGrafts 로 새 시트(tex_gen_fh_buildings)를 가리킨다. 통행은 설계도(village_tiles.py 가 옮긴 칸 역할), 길·숲·도달은 기존 마을 도구 그대로.
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../../ontology-ts-loader.mjs";
const [picksPath, outPath] = process.argv.slice(2);
if (!picksPath || !outPath) throw Error("Usage: author_village.mjs picks.json out.json");
const OUT = process.env.OUT_DIR || ".omo/asset-gen-tmp/fh-bld";
const plan = JSON.parse(fs.readFileSync("tiledata/forest-harmony-buildings/village-plan.json", "utf8"));
const picks = JSON.parse(fs.readFileSync(picksPath, "utf8"));
const gen = JSON.parse(fs.readFileSync(`${OUT}/village/gen-tiles.json`, "utf8"));
const catalog = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json", "utf8"));
const parts = [...JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json", "utf8")).props,
  ...JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json", "utf8")).props];
const ts = structuredClone(catalog.tileset);
delete ts.referenceDocuments;
let forest, reach;
await withTsModule("src/editor/tools/village/forestContour.ts", "gv-forest.mjs", (m) => { forest = m; });
await withTsModule("src/project/lint/reachability.ts", "gv-reach.mjs", (m) => { reach = m; });

// ── 생성 칸 등록 ──
const base = Math.ceil(ts.count / 30) * 30, layerOf = new Map();
for (const b of Object.values(gen.buildings)) for (const c of b.cells) if (c && c.k !== undefined) layerOf.set(c.k, c);
for (let k = 0; k < gen.tiles; k++) {
  const id = base + k, c = layerOf.get(k), walk = c.walk, upper = c.layer === "U";
  ts.tileGrafts.push({ sourceChipset: "tex_gen_fh_buildings", sourceTile: k, targetTile: id });
  ts.passability[id] = { up: walk, down: walk, left: walk, right: walk };
  ts.priority[id] = upper ? "upper" : "lower";
  ts.terrain[id] = 0;
  ts.tileMeta[id] = { label: upper ? "생성 건물 · 지붕 위(굴뚝·첨탑)" : "생성 건물", role: "building", source: "user", userLocked: true,
    defaultLayer: upper ? "upper" : "lower", passage: walk ? "passable" : "solid", description: "설계도 방식 생성 건물 칸. 통행은 설계도가 정한다." };
}
ts.count = Math.ceil((base + gen.tiles) / 30) * 30;
for (const [arr, fill] of [[ts.terrain, 0], [ts.priority, "lower"]]) while (arr.length < ts.count) arr.push(fill);
while (ts.passability.length < ts.count) ts.passability.push({ up: false, down: false, left: false, right: false });
while (ts.tileMeta.length < ts.count) ts.tileMeta.push({ label: "미사용", source: "unknown" });

// ── 맵 ──
const W = plan.width, H = plan.height, area = { x: 0, y: 0, w: W, h: H };
const m = { id: plan.id, name: plan.name, width: W, height: H, tileSize: 16, tilesetId: ts.id, lowerTiles: Array(W * H).fill(240), upperTiles: Array(W * H).fill(-1), events: [] };
const P = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const reserved = new Set(), roads = new Set(), solid = new Set(), access = [], buildings = [];
const reserve = (x, y, w, h, pad = 0) => { for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inside(xx, yy)) reserved.add(P(xx, yy)); };
for (const s of plan.slots) {
  const art = picks[s.id]; assert(art, "고른 그림 없음 " + s.id);
  const b = gen.buildings[art]; assert(b, "시트에 없는 그림 " + art);
  // 계획 좌표는 설계도 맨 위(원래 머리 줄). 굴뚝·첨탑이 더 솟아 bp_fit 이 머리 줄을 늘렸으면 그만큼 위에서 시작한다.
  const top = s.y - b.headExtra;
  b.cells.forEach((c, k) => {
    if (!c) return;
    const x = s.x + k % b.w, y = top + Math.floor(k / b.w), i = P(x, y);
    assert(inside(x, y) && m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !reserved.has(i), `건물 겹침 ${s.id} ${x},${y}`);
    const tile = c.orig ?? base + c.k;
    if (c.layer === "U") m.upperTiles[i] = tile; else m.lowerTiles[i] = tile;
    if (!(c.walk || c.layer === "U")) solid.add(i);
  });
  const doors = b.doors.map((d) => ({ x: s.x + d.x, y: top + d.y, front: { x: s.x + d.front[0], y: top + d.front[1] } }));
  buildings.push({ id: s.id, role: s.role, blueprint: s.blueprint, art, label: b.label, x: s.x, y: top, w: b.w, h: b.h, headExtra: b.headExtra, doors });
  reserve(s.x, top, b.w, b.h, 1);
  for (const d of doors) { reserve(d.front.x, d.front.y, 1, 2, 0); access.push({ role: "door-front", building: s.id, ...d.front }); }
}
// 광장: 길 오토타일로 채우는 넓은 마당
const pz = plan.plaza;
for (let y = pz.y; y < pz.y + pz.h; y++) for (let x = pz.x; x < pz.x + pz.w; x++) { assert(!solid.has(P(x, y)), "광장이 건물과 겹침"); roads.add(P(x, y)); }
// 길: 입구 → 뼈대 → 문 앞 (A*, 이미 길인 칸은 싸게)
const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]], N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const route = ([ax, ay], [bx, by]) => {
  // 상태 = 칸×들어온 방향. 방향을 바꾸면 값을 더 매겨 계단 길 대신 ㄱ자 길이 된다.
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
      // 2칸 폭으로 넓힐 오른쪽·아래 칸도 비어 있어야 한다(도착 칸은 문 앞이라 예외)
      if (!inside(nx, ny) || solid.has(ni) || (nx + 1 < W && solid.has(P(nx + 1, ny)) || ny + 1 < H && solid.has(P(nx, ny + 1))) && ni !== end) return;
      const cost = dist.get(at) + (roads.has(ni) ? 0.5 : 1) + (dir !== 4 && dir !== d ? 3 : 0);
      const k = key(ni, d);
      if (cost < (dist.get(k) ?? Infinity)) { dist.set(k, cost); prev.set(k, at); if (!open.includes(k)) open.push(k); }
    });
  }
  assert(goal !== undefined, `길 없음 ${ax},${ay} → ${bx},${by}`);
  for (let k = goal; k !== key(start, 4); k = prev.get(k)) roads.add(Math.floor(k / 5));
  roads.add(start);
};
const spinePts = plan.spine.flat();
route([plan.entrance.x, plan.entrance.y], plan.spine[0][0]);
for (const line of plan.spine) for (let n = 1; n < line.length; n++) route(line[n - 1], line[n]);
// 뼈대 끼리는 광장으로 이어진다(각 뼈대 첫 점이 광장 가장자리)
for (const a of access) {
  const near = spinePts.reduce((b, q) => Math.hypot(q[0] - a.x, q[1] - a.y) < Math.hypot(b[0] - a.x, b[1] - a.y) ? q : b);
  route([a.x, a.y], near);
}
// 막다른 꼬리 자르기: 뼈대 끝이 문 앞보다 더 뻗은 곳. 문 앞·입구·광장은 남기고 이웃이 하나뿐인 칸을 반복해 지운다.
const keep = new Set([...access.map((a) => P(a.x, a.y)), P(plan.entrance.x, plan.entrance.y)]);
for (let y = pz.y; y < pz.y + pz.h; y++) for (let x = pz.x; x < pz.x + pz.w; x++) keep.add(P(x, y));
for (let cut = true; cut;) {
  cut = false;
  for (const i of [...roads]) {
    if (keep.has(i)) continue;
    const x = i % W, y = Math.floor(i / W);
    if (N4.filter(([dx, dy]) => inside(x + dx, y + dy) && roads.has(P(x + dx, y + dy))).length <= 1) { roads.delete(i); cut = true; }
  }
}
// 2칸 폭: 오른쪽·아래로 한 칸 (건물·광장 밖 잔디만)
for (const i of [...roads]) {
  const x = i % W, y = Math.floor(i / W);
  for (const [dx, dy] of [[1, 0], [0, 1]]) { const ni = P(x + dx, y + dy); if (inside(x + dx, y + dy) && !solid.has(ni) && m.lowerTiles[ni] === 240 && m.upperTiles[ni] === -1) roads.add(ni); }
}
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const roadGroup = group("forest_harmony_road_47");
for (const i of roads) {
  if (m.lowerTiles[i] !== 240) continue;
  const x = i % W, y = Math.floor(i / W); let mask = 0;
  N8.forEach(([dx, dy], bit) => { if (inside(x + dx, y + dy) && roads.has(P(x + dx, y + dy))) mask |= 1 << bit; });
  m.lowerTiles[i] = roadGroup.variantMap[String(mask)];
}
for (const i of roads) reserve(i % W, Math.floor(i / W), 1, 1, 1);
// 밭
for (const [x, y, w, h] of plan.farms) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = P(xx, yy); assert(m.lowerTiles[i] === 240 && !roads.has(i), "밭이 길·건물과 겹침 " + xx + "," + yy); m.lowerTiles[i] = 188; }
  reserve(x, y, w, h, 1);
}
// 소품: 원본 부품 그대로. 자리가 막히면 건너뛰고 기록한다(길 위·건물 위에 억지로 놓지 않는다).
const props = [], skipped = [];
const near = [];
for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) near.push([dx, dy]);
for (const [name, px, py] of plan.props) {
  const p = parts.find((q) => q.name === name); assert(p, "없는 부품 " + name);
  const w = p.width, h = p.height;
  // 계획 자리가 막히면 4칸 안에서 가장 가까운 빈자리(광장 소품은 광장 안, 나머지는 잔디 위)
  const fits = (x, y) => {
    const cells = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const t = p.targetUpper[dy][dx], i = P(x + dx, y + dy);
      if (t === null || t < 0) continue;
      if (!inside(x + dx, y + dy) || solid.has(i) || m.upperTiles[i] !== -1) return null;
      if (inPlaza(px, py) ? !inPlaza(x + dx, y + dy) : roads.has(i) || m.lowerTiles[i] !== 240 && m.lowerTiles[i] !== 188) return null;
      cells.push([i, t]);
    }
    return cells;
  };
  const spot = near.map(([dx, dy]) => [px + dx, py + dy]).find(([x, y]) => fits(x, y));
  if (!spot) { skipped.push([name, px, py]); continue; }
  const [x, y] = spot;
  for (const [i, t] of fits(x, y)) { m.upperTiles[i] = t; if (!ts.passability[t]?.up) solid.add(i); }
  reserve(x, y, w, h, 0);
  props.push({ name, x, y, w, h, moved: x !== px || y !== py });
}
function inPlaza(x, y) { return x >= pz.x && y >= pz.y && x < pz.x + pz.w && y < pz.y + pz.h; }
// 숲: 마을 가운데 빈터, 가장자리 숲 (기존 숲 윤곽 + 줄기 조립)
const influence = (x, y, [cx, cy, rx, ry, s]) => s * Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
const field = (x, y) => forest.forestContourScore(x, y, area, plan.seed, 0.4) + plan.patches.reduce((v, p) => v + influence(x, y, p), 0) - plan.clearings.reduce((v, p) => v + influence(x, y, p), 0);
const grove = forest.paintContouredForest(m, area, group("forest_harmony_grove_47"), (x, y) => m.lowerTiles[P(x, y)] === 240 && m.upperTiles[P(x, y)] === -1 && !reserved.has(P(x, y)), plan.seed, 0.4, undefined, field);
// 마을 안 나무: 기존 숲마을이 쓰는 나무 조립(활엽수 3×4·둥근 덤불 3×3·작은 덤불 2×2)을 그대로 찍는다. 자리는 위치 해시로 결정적.
const retained = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/retained-vegetation.json", "utf8"));
const treeKinds = plan.trees.kinds.map((name) => Object.values(retained).flat().find((o) => o.name === name));
const hash = (x, y, s) => { let v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791); v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
const trees = [];
const freeRect = (x, y, w, h) => x >= 1 && y >= 1 && x + w < W - 1 && y + h < H - 1 && Array.from({ length: w * h }, (_, k) => P(x + k % w, y + Math.floor(k / w)))
  .every((i) => m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !reserved.has(i));
const spots = [];
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) spots.push([hash(x, y, plan.seed), x, y]);
spots.sort((a, b) => a[0] - b[0]);
for (const [r, x, y] of spots) {
  if (trees.length >= plan.trees.count) break;
  const o = treeKinds[Math.floor(hash(y, x, 7) * treeKinds.length)];
  if (!freeRect(x - 1, y - 1, o.w + 2, o.h + 2)) continue;           // 한 칸 둘레까지 비어 있어야(길·집·숲에 붙지 않게)
  for (let k = 0; k < o.w * o.h; k++) {
    const i = P(x + k % o.w, y + Math.floor(k / o.w));
    m.lowerTiles[i] = o.lower[k]; m.upperTiles[i] = o.upper[k];
  }
  reserve(x, y, o.w, o.h, 1);
  trees.push({ name: o.name, x, y, w: o.w, h: o.h });
}
// 도달: 엔진 canMove BFS
const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
const reachable = reach.computeReachableCells(project, m, plan.entrance.x, plan.entrance.y);
const blocked = access.filter((a) => !reachable.has(a.x + "," + a.y));
m.layoutPlan = { version: 1, kind: "generated-building-village", seed: plan.seed, regions: buildings, entrance: plan.entrance, notes: plan.note };
const result = { map: m, tileset: ts, genTileBase: base, genTiles: gen.tiles, buildings, props, trees, skipped, access, blocked, grove: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns },
  reachable: [...reachable], roads: roads.size };
fs.writeFileSync(outPath, JSON.stringify(result));
console.log({ buildings: buildings.length, doors: access.length, blocked: blocked.length, props: props.length, trees: trees.length, skipped, forest: grove.canopyCells, reachable: reachable.size, newTiles: gen.tiles });
assert.equal(blocked.length, 0, "문 앞 칸 도달 실패 " + JSON.stringify(blocked));
