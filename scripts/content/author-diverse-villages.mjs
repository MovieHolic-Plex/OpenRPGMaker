import { placeCivicProps } from "./lib/village-civic-props.mjs";
// New exterior studies built from verified whole parts; never edits the source project.
import { placeHouseholdProps, PROP_PROGRAMS } from "./lib/village-household-props.mjs";
import { paintVillageCliffs } from "./lib/village-cliffs.mjs";
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
parts.push(...JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/extra-parts.json")).props);
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
let forest, reach;
await withTsModule("src/editor/tools/village/forestContour.ts", "diverse-forest.mjs", (m) => {
  forest = m;
});
await withTsModule("src/project/lint/reachability.ts", "diverse-reach.mjs", (m) => {
  reach = m;
});
const plans = [
  { id: "pine-hamlets", name: "솔바람 흩어진 산촌", width: 80, height: 64, seed: 191, start: { x: 40, y: 60 }, note: "숲에서 숲까지 이어진 절벽 위 윗단과 아랫마을, 계단 세 곳, 갈라지는 오솔길과 작은 샘", houses: [[12, 9, 3], [33, 6, 0], [61, 12, 7], [17, 31, 5], [44, 28, 1], [61, 43, 6], [29, 47, 2]], cliffs: [{ points: [[6,21],[10,21],[12,20],[22,20],[24,19],[30,19],[32,18],[46,18],[48,19],[52,19],[55,22],[70,22],[72,21],[76,21]], height: 5 }], stairs: [[16, 20, 5], [39, 18, 5], [62, 22, 5]], ponds: [[10, 47, 5, 4]], spine: [[40, 60], [40, 54], [38, 43], [31, 33], [19, 29], [31, 33], [39, 26], [39, 16], [24, 17], [39, 16], [52, 17], [62, 20], [62, 30], [56, 37], [66, 36]], farms: [[20, 41, 6, 4], [37, 13, 6, 4]], trees: 28 },
  { id: "terrace-cliff-village", name: "층바위 절벽마을", width: 88, height: 72, seed: 347, start: { x: 42, y: 68 }, note: "세 높이의 대지, 네 계단과 절벽 아래 작업 마당", houses: [[27, 9, 0], [49, 11, 4], [13, 29, 1], [37, 33, 7], [65, 36, 5], [18, 55, 2], [47, 59, 6], [70, 56, 3]], cliffs: [{ points: [[7,45],[14,45],[16,46],[28,46],[30,47],[40,47],[42,46],[56,46],[58,45],[83,45]], height: 6 }, { points: [[19,21],[30,21],[32,20],[36,20],[38,21],[44,21],[46,22],[58,22],[60,21],[66,21],[68,20],[74,20]], height: 6 }], stairs: [[34, 20, 6], [62, 21, 6], [26, 46, 6], [45, 46, 6]], ponds: [], spine: [[42, 68], [42, 63], [27, 56], [27, 53], [27, 40], [34, 31], [34, 27], [34, 18], [62, 19], [62, 28], [60, 40], [46, 44], [46, 53], [46, 58], [70, 66]], farms: [[43, 40, 9, 4], [11, 41, 8, 3]], trees: 28, cave: [71, 50]},
  { id: "reed-bay-village", name: "갈대물굽이 포구", width: 88, height: 64, seed: 521, start: { x: 6, y: 33 }, note: "물굽이를 따라 비껴 앉은 집, 좁은 골목과 긴 선착장", houses: [[11, 9, 3], [31, 5, 7], [52, 12, 0], [12, 30, 1], [34, 22, 5], [52, 31, 6], [12, 42, 2], [34, 39, 4]], cliffs: [{ points: [[7,19],[12,19],[14,18],[26,18],[29,15],[41,15]], height: 5, rightFrom: 8 }], stairs: [[18, 18, 5], [31, 15, 5]], ponds: [], coast: true, spine: [[6, 33], [21, 36], [26, 29], [19, 24], [26, 29], [32, 23], [48, 26], [48, 40], [56, 43], [57, 47]], farms: [[20, 13, 4, 4], [25, 47, 6, 4]], trees: 18, dock: [56, 45, 21, 2] }
];
const terrainDetails = {
  'pine-hamlets': { entrance:{x:40,y:63}, crest:{x:9,y:4,width:20,shoulder:3}, patches:[[5,12,12,9,9],[43,3,10,9,10],[76,19,10,14,8]], clearings:[[20,8,9,6,9]] },
  'terrace-cliff-village': { entrance:{x:42,y:71}, crest:{x:26,y:4,width:39,shoulder:3}, patches:[[9,13,13,10,11],[76,9,13,12,11],[40,1,12,7,9]], clearings:[[44,8,22,6,12],[4,34,6,8,7]] },
  'reed-bay-village': { entrance:{x:0,y:33}, crest:{x:9,y:4,width:17,shoulder:3}, patches:[[3,12,10,12,12],[46,2,14,8,10],[66,22,9,12,9]], clearings:[[20,8,11,6,8]] },
};
for (const p of plans) Object.assign(p,terrainDetails[p.id]);
const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const houseSources = original.layoutPlan.regions.filter((r) => r.role === "house");
const group = (id) => ts.autotileGroups.find((g) => g.id === id);
const roadGroup = group("forest_harmony_road_47"), waterGroup = group("forest_harmony_lake_47");
delete ts.referenceDocuments;
const result = { tileset: ts, cliffBindings: cliff, grassBindings, plans: [], maps: {} };
for (const spec of plans) {
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wet = spec.ponds.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + 0.12 * Math.sin(x + y)) || spec.coast && (y > 52 + 3 * Math.sin(x / 10) || x > 70 + 4 * Math.sin(y / 9));
    if (wet && cliffPlan.cells[point(x, y)] === "ground") water.add(point(x, y));
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
      assert.equal(m.upperTiles[to], -1, `House overlaps cliff ${spec.id} ${x + dx},${y + dy}`);
      assert.equal(m.lowerTiles[to], 240, `House overlaps relief ${spec.id} ${x + dx},${y + dy}`);
      m.lowerTiles[to] = original.lowerTiles[from];
      m.upperTiles[to] = original.upperTiles[from];
    }
    // The 1x2 doorway: keep the source bottom tile, the cell above it is solid black (source 329 above 359).
    const doorTop = point(x + h.doorAt.x - h.x, y + h.doorAt.y - h.y - 1);
    if (m.lowerTiles[doorTop] === 359) m.lowerTiles[doorTop] = 329;
    const house = { id: spec.id + "-house-" + (n + 1), role: "house", label: h.label, x, y, w: h.w, h: h.h, template, doorAt: { x: x + h.doorAt.x - h.x, y: y + h.doorAt.y - h.y }, front: { x: x + h.front.x - h.x, y: y + h.front.y - h.y } };
    const program=PROP_PROGRAMS.houses[spec.id]?.[x+","+y];
    assert(program,"Missing authored house purpose");
    Object.assign(house,program);
    houses.push(house);
    reserve(x, y, h.w, h.h, 2);
    reserve(house.front.x, house.front.y, 1, 3, 2);
    access.push({ role: "door-front", ...house.front });
  }
  const project = { tilesets: { [ts.id]: ts }, maps: { [m.id]: m } };
  const solid = new Set();
  for (const h of houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) solid.add(point(x, y));
  for (let i = 0; i < W * H; i++) if (water.has(i) || wings.has(i) || cliffPlan.cliff.has(i) && m.lowerTiles[i] !== cliff[374]) solid.add(i);
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
    m.upperTiles[point(x, y)] = cliff[413];
    reserve(x, y, 1, 3, 2);
    access.push({ role: "cave-approach", x, y: y + 2 });
  }
  const grassJoins=[];
  const crest=spec.crest;
  for(let dx=0;dx<crest.width;dx++) {
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
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) m.lowerTiles[point(x + dx, y + dy)] = 188;
      reserve(x, y, w, h);
      placements.push({ name: "텃밭", x, y, w, h, kind: "farm", lower: Array(w * h).fill(188), upper: Array(w * h).fill(-1) });
    }
  }
  // Retain the already approved individual trees exactly while reorganizing props.
  const retained=JSON.parse(fs.readFileSync('tiledata/forest-villages/diverse/retained-vegetation.json'))[spec.id];
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
  const civicPlan={houses,placements,activitySites,roadCells:[...roads],access,entrance:spec.entrance};
  const civic=placeCivicProps({map:m,plan:civicPlan,parts,project,reach});
  reachable=reach.computeReachableCells(project,m,spec.start.x,spec.start.y);
  {
    const shut = structuredClone(m);
    for (const [x, y, height] of spec.stairs) for (let yy = y; yy <= y + height; yy++) for (let xx = x; xx < x + 2; xx++) shut.lowerTiles[point(xx, yy)] = cliff[172];
    const below = reach.computeReachableCells({ tilesets: { [ts.id]: ts }, maps: { [m.id]: shut } }, shut, spec.start.x, spec.start.y);
    const leaks = [...below].map((k) => k.split(",").map(Number)).filter(([x, y]) => cliffPlan.cells[point(x, y)] === "plateau");
    assert.equal(leaks.length, 0, "Terrace reachable without stairs " + spec.id + " " + JSON.stringify(leaks.slice(0, 6)));
  }
  m.layoutPlan = { version: 1, kind: "diverse-village-reference", seed: spec.seed, regions: houses, notes: spec.note, entrance:spec.entrance, civicPlaces:civic.zones };
  result.maps[m.id] = m;
  result.plans.push({ ...spec, houses, placements, activitySites, civicPlaces:civic.zones, yards:household.yards.filter(y=>!rejectedOwners.has(y.ownerId)), access, grassJoins, grove: { canopyCells: grove.canopyCells, trunkRuns: grove.trunkRuns }, reachableCells: reachable.size, cliffColumns: cliffPlan.columns, roadCells: [...roads] });
  console.log(spec.id, { houses: houses.length, objects: placements.length, forest: grove.canopyCells, reachable: reachable.size });
}
fs.writeFileSync(path.join(out, "authored.json"), JSON.stringify(result));
