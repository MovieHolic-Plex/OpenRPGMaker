// Author the climate villages on the snow / volcano / desert / autumn sheets (scripts/content/build-climate-chipsets.py).
// Each map is a finished diverse forest village (tiledata/forest-villages/diverse) re-pointed at a climate tileset:
// tile numbers are identical, so houses, cliffs, roads and forest assemblies stay exactly as authored. Climate edits:
//  - snow: a pond can freeze — its water tiles are swapped for the appended ice copies (same shore shapes, walkable);
//  - volcano: water is already lava on the sheet; clearings can get a pair of volcanic peaks (plain 858/859/888/889 + erupting 918/919/948/949);
//  - desert: free-standing trees give way to palms (near water) and cacti, palms line the shore, cacti stand on open sand;
//  - autumn: the sheet alone (gold grass, autumn leaves).
// The edits live in lib/climate-edits.mjs, shared with the climate fields (author-field-routes.mjs).
// Usage: node scripts/content/author-climate-villages.mjs   (writes tiledata/climate-villages/catalog.json + validation.json)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { dressDesert, freezeCells, placePeaks, reachable } from "./lib/climate-edits.mjs";
import { emptiness, fillPlainGaps, retileGrass, rng } from "./lib/village-fullness.mjs";

const OUT = "tiledata/climate-villages";
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const sheets = JSON.parse(fs.readFileSync(`${OUT}/sheets.json`));
const PLANS = [
  { id: "climate-snow-pine-hamlets", climate: "snow", from: "pine-hamlets", name: "솔바람 산촌 · 설원",
    note: "눈 덮인 산기슭에 흩어진 산촌. 솔숲 수관에 눈이 얹히고 지붕이 하얗게 덮였다. 개울은 얼지 않고 흐른다" },
  { id: "climate-snow-chapel-hill", climate: "snow", from: "chapel-hill-parish", name: "종탑 언덕 교구 · 설원",
    note: "눈 쌓인 언덕 위 종탑 교구. 계단 길과 묘지, 교구 마당이 모두 눈밭이 된다" },
  { id: "climate-snow-frozen-mistpond", climate: "snow", from: "mistpond-hollow", name: "얼어붙은 안개못", freeze: "mistpond-hollow-shrine-pond",
    note: "울타리 친 못이 통째로 얼어 석상 섬까지 걸어 들어갈 수 있는 설원 폐촌. 서쪽 강과 폭포는 얼지 않았다" },
  { id: "climate-volcano-twin-falls", climate: "volcano", from: "twin-falls-river-village", name: "두 폭포 · 용암 강마을",
    note: "용암 강이 마을 한가운데를 흐르다 두 줄 절벽에서 용암 폭포로 떨어진다. 단마다 현무암 다리가 두 강둑을 잇는다" },
  { id: "climate-volcano-ford-castle", climate: "volcano", from: "ford-castle-town", name: "잿빛 여울성",
    note: "재로 덮인 벌판 위 성채 마을. 해자와 여울이 용암으로 바뀌고 숲은 그을린 검은 숲이 된다" },
  { id: "climate-volcano-lava-pond", climate: "volcano", from: "mistpond-hollow", name: "용암못 폐촌", peaks: 2,
    note: "울타리 친 못이 끓는 용암못이 된 폐촌. 빈 재밭 두 곳에 작은 화산 봉우리 한 쌍(잠든 봉우리·분화하는 봉우리)이 솟아 있다" },
  { id: "climate-desert-terrace-canyon", climate: "desert", from: "terrace-cliff-village", name: "사암 층바위 협곡마을", desert: { palms: 0, cacti: 10 },
    note: "세 높이의 사암 대지를 네 계단이 잇는 협곡 마을. 모래밭 곳곳에 선인장과 바위가 있고 마른 덤불숲이 협곡을 둘러싼다" },
  { id: "climate-desert-reed-bay", climate: "desert", from: "reed-bay-village", name: "모래 물굽이 포구", desert: { palms: 12, cacti: 6 },
    note: "모래 해안 물굽이를 따라 비껴 앉은 포구 마을. 물가에 야자수가 늘어서고 긴 선착장이 바다로 나간다" },
  { id: "climate-autumn-twin-falls", climate: "autumn", from: "twin-falls-river-village", name: "가을 두 폭포 강마을",
    note: "단풍 든 숲에서 나온 강이 두 줄 절벽을 폭포로 떨어지는 가을 강마을. 금빛 풀밭에 노란 활엽수와 붉은 덤불이 있다" },
  { id: "climate-autumn-chapel-hill", climate: "autumn", from: "chapel-hill-parish", name: "가을 종탑 언덕 교구",
    note: "단풍 숲으로 둘러싸인 언덕 위 종탑 교구. 금빛 풀밭의 계단 길과 묘지, 폭포 아래 소가 가을빛이다" },
];
const ice = new Map(sheets.snow.ice), water = new Set(sheets.volcano.lava);
// Ground dressing from the forest village's fill pass (tall grass, wildflowers): a climate edit may clear it.
const tallGrass = village.tileset.autotileGroups.find((g) => g.id === "builtin_tall_grass");
const GRASS = new Set(Object.values(tallGrass.variantMap)), FLOWERS = new Set([348, 288]);
const UNFLOWERED = { snow: FLOWERS, volcano: FLOWERS, desert: new Set([288]) };
const PLAIN = new Set([240, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);

await withTsModule("scripts/content/lib/climate-villages-entry.ts", "climate-villages-entry.mjs", async (api) => {
  const tilesets = Object.fromEntries(["snow", "volcano", "desert", "autumn"].map((k) => [k, api.createClimateVillageTileset(k)]));
  for (const t of Object.values(tilesets)) delete t.referenceDocuments;
  const maps = {}, plans = [], report = [];
  for (const spec of PLANS) {
    const src = village.maps[spec.from], plan = village.plans.find((p) => p.id === spec.from);
    const tileset = tilesets[spec.climate];
    const map = { id: spec.id, name: spec.name, width: src.width, height: src.height, tileSize: 16, tilesetId: tileset.id,
      lowerTiles: [...src.lowerTiles], upperTiles: [...src.upperTiles], events: [] };
    const W = map.width, at = (x, y) => y * W + x;
    const edits = [];
    const targets = plan.houses.map((h) => [h.front.x, h.front.y]);
    // Cells owned by the village's houses, landmarks, props and yards (and every access cell): climate dressing and
    // fill never touch them.
    const taken = new Set(plan.access.map((a) => at(a.x, a.y)));
    for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements, ...(plan.yards ?? [])])
      for (let y = o.y; y < o.y + (o.h ?? 1); y++) for (let x = o.x; x < o.x + (o.w ?? 1); x++) taken.add(at(x, y));
    // Wildflowers do not bloom in snow or ash, and a leafy flower bush does not grow in sand: loose ones on open
    // ground become a tuft of the sheet's own tall grass (frosted, ash-grey or dry), re-autotiled with its neighbours.
    if (UNFLOWERED[spec.climate]) {
      const swapped = [];
      for (let i = 0; i < map.upperTiles.length; i++)
        if (UNFLOWERED[spec.climate].has(map.upperTiles[i]) && map.lowerTiles[i] === 240 && !taken.has(i)) { map.upperTiles[i] = -1; map.lowerTiles[i] = tallGrass.variantMap["0"]; swapped.push(i); }
      retileGrass(map, tallGrass, swapped);
      edits.push({ kind: "unflowered", cells: swapped.length, tiles: [...UNFLOWERED[spec.climate]], rule: "빈 땅의 들꽃·꽃덤불 → 이 시트의 키큰 풀 한 포기(눈 덮인·잿빛·마른 풀), 이웃과 다시 이음" });
    }
    if (spec.freeze) {
      const box = plan.landmarks.find((l) => l.id === spec.freeze);
      const cells = [];
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) cells.push(at(x, y));
      const frozen = freezeCells(map, cells, ice);
      assert(frozen > 20, "pond did not freeze");
      // Walk onto the ice: the frozen cell nearest the fence gate.
      const g = box.gate, iceCells = [];
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++)
        if (map.lowerTiles[at(x, y)] >= sheets.baseCount && map.upperTiles[at(x, y)] < 0) iceCells.push([x, y]);
      iceCells.sort((a, b) => Math.hypot(a[0] - g.x, a[1] - g.y) - Math.hypot(b[0] - g.x, b[1] - g.y));
      const centre = [box.x + (box.w >> 1), box.y + (box.h >> 1)];
      const inner = iceCells.slice().sort((a, b) => Math.hypot(a[0] - centre[0], a[1] - centre[1]) - Math.hypot(b[0] - centre[0], b[1] - centre[1]))[0];
      targets.push(iceCells[0], inner);
      edits.push({ kind: "freeze", landmark: box.id, box: [box.x, box.y, box.w, box.h], swappedTiles: frozen, rule: "물 칸 t → 얼음 칸 ice[t] (sheets.json snow.ice)" });
    }
    if (spec.peaks) edits.push(...placePeaks(map, spec.peaks, plan.houses.map((h) => [h.front.x, h.front.y]),
      { is: (l, u) => (l === 240 || GRASS.has(l)) && (u < 0 || FLOWERS.has(u)), cleared: (cells) => retileGrass(map, tallGrass, cells) }));
    if (spec.desert) {
      const wet = new Set();
      map.lowerTiles.forEach((t, i) => { if (water.has(t)) wet.add(i); });
      const keepClear = [...plan.access.map((a) => [a.x, a.y]), [plan.start.x, plan.start.y]];
      const vegetation = plan.placements.filter((o) => o.kind === "vegetation");
      const dressed = dressDesert(map, { vegetation, water: wet, keepClear, seed: plan.seed, ...spec.desert });
      edits.push({ kind: "desert", replacedTrees: dressed.replaced, plants: dressed.edits.length, rule: "나무 덩이 → 발치에 야자(물 5칸 안)·선인장(큰 나무는 바위 하나 더), 물가 야자, 빈 모래밭 선인장" }, ...dressed.edits);
    }
    if (spec.climate === "volcano") {
      const lava = map.lowerTiles.filter((t) => water.has(t)).length + map.upperTiles.filter((t) => water.has(t)).length;
      const bridges = map.lowerTiles.concat(map.upperTiles).filter((t) => sheets.volcano.stoneBridges.includes(t)).length;
      edits.push({ kind: "sheet", lavaCells: lava, basaltBridgeCells: bridges, rule: "물 칸은 시트에서 용암으로 칠해져 있다(번호·통행 그대로)" });
    }
    // The fill gate (town: no plain 5×5 square, no 17×13 screen over 40% plain) once more after the climate edits —
    // a desert that cleared its trees back to sand gets the same walkable fill (tall grass is dry scrub on this sheet).
    {
      const isPlain = (x, y) => map.upperTiles[at(x, y)] === -1 && PLAIN.has(map.lowerTiles[at(x, y)]);
      const before = emptiness(map, isPlain);
      const gaps = fillPlainGaps({ map, isPlain, canTake: (x, y) => !taken.has(at(x, y)), group: tallGrass, random: rng(plan.seed * 13 + spec.id.length),
        flowerKinds: [[[348, 348, 348], [288, 348, 288]], [[348, 348, 348]], []][spec.climate === "autumn" ? 0 : spec.climate === "desert" ? 1 : 2] });
      assert(gaps.maxSq <= 4 && gaps.screen <= 0.4, `fill gate ${spec.id} maxSq=${gaps.maxSq} screen=${gaps.screen.toFixed(3)}`);
      edits.push({ kind: "fill", pieces: gaps.pieces.length, cells: gaps.pieces.reduce((n, p) => n + p.cells.length, 0),
        emptiness: { before: { maxSq: before.maxSq, screen: +before.screen.toFixed(3) }, after: { maxSq: gaps.maxSq, screen: +gaps.screen.toFixed(3) } },
        rule: "빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 삐죽한 풀숲 덩이·세 송이 들꽃" });
    }
    // Reachability with the runtime move rule, from the village entrance to every door front (+ the ice).
    const project = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
    const entry = [plan.start.x, plan.start.y];
    const seen = reachable(api.canMove, project, map, entry);
    const blocked = targets.filter(([x, y]) => !seen.has(at(x, y)));
    report.push({ id: spec.id, entry, targets, reachable: seen.size, blocked });
    maps[spec.id] = map;
    plans.push({ ...spec, tilesetId: tileset.id, entry, targets, width: W, height: map.height, edits,
      houses: plan.houses.map(({ id, role, label, x, y, w, h, front }) => ({ id, role, label, x, y, w, h, front })) });
  }
  const bad = report.filter((r) => r.blocked.length);
  assert(!bad.length, "unreachable: " + JSON.stringify(bad));
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ source: "tiledata/forest-villages/diverse/catalog.json", plans, maps }) + "\n");
  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  console.log({ maps: Object.keys(maps), reach: report.map((r) => `${r.id}:${r.reachable}/${r.targets.length}`), edits: plans.map((p) => p.edits.filter((e) => e.kind !== "desert-plant").map((e) => e.kind + (e.kind === "unflowered" ? e.cells : e.emptiness ? `${e.pieces}:${e.emptiness.before.screen}->${e.emptiness.after.screen}` : e.swappedTiles ?? e.lavaCells ?? e.plants ?? `@${e.x},${e.y}`))) });
});
