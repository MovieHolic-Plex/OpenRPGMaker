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
import { emptiness, fillNaturalGaps, rng } from "./lib/village-fullness.mjs";
import { arrangeTallGrass, ALL_TALL_GRASS, TALL_GRASS_TILES } from "./lib/tall-grass.mjs";
const BURIED = new Set(["snow", "volcano"]);
// Snow and ash: the short grass by houses and roads (G) is trodden under; the dark forest-edge grass (E) and the light
// meadow grass (F) stay, in the sheet's frosted / ash colours.
const TRODDEN = new Set(Object.values(TALL_GRASS_TILES.G)), KEPT_GRASS = new Set(["E", "F"].flatMap((k) => Object.values(TALL_GRASS_TILES[k])));

const OUT = "tiledata/climate-villages";
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const sheets = JSON.parse(fs.readFileSync(`${OUT}/sheets.json`));
const PLANS = [
  { id: "climate-snow-pine-hamlets", climate: "snow", from: "pine-hamlets", name: "솔바람 산촌 · 설원",
    note: "눈 덮인 산기슭에 흩어진 산촌. 솔숲 수관에 눈이 얹히고 지붕이 하얗게 덮였다. 개울은 얼지 않고 흐른다" },
  { id: "climate-snow-chapel-hill", climate: "snow", from: "chapel-hill-parish", name: "종탑 언덕 교구 · 설원", freezeRiver: true,
    note: "눈 쌓인 언덕 위 종탑 교구. 계단 길과 묘지, 교구 마당이 모두 눈밭이 되고 강과 폭포 아래 소가 얼어붙었다(폭포만 흐른다)" },
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
// Ground dressing from the forest village's fill pass (tall grass E/F/G, wildflowers): a climate edit may clear it.
const GRASS = ALL_TALL_GRASS, FLOWERS = new Set([348, 288]);
// Wildflowers do not bloom in snow, ash or sand.
const UNFLOWERED = { snow: FLOWERS, volcano: FLOWERS, desert: FLOWERS };
// A leafy broadleaf tree is green on every sheet: in snow it gives way to a snow-laden round bush, in sand the
// desert dressing turns it into palms and cacti, and the gap fill of both skips tree scenes.
const LEAFLESS = new Set(["snow", "desert"]);
const LAKE = new Set(Object.values(village.tileset.autotileGroups.find((g) => g.id === "forest_harmony_lake_47").variantMap));
const ROAD = new Set(Object.values(village.tileset.autotileGroups.find((g) => g.id === "forest_harmony_road_47").variantMap));
const CLIFF = new Set(Object.values(village.cliffBindings));
const vegetation = {};
for (const list of Object.values(JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/retained-vegetation.json")))) for (const o of list) {
  const short = o.name.split(" · ")[1];
  vegetation[short] ??= { name: o.name, w: o.w, h: o.h, lower: o.lower, upper: o.upper };
}
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
    for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements.filter((p) => p.kind !== "vegetation"), ...(plan.yards ?? [])])
      for (let y = o.y; y < o.y + (o.h ?? 1); y++) for (let x = o.x; x < o.x + (o.w ?? 1); x++) taken.add(at(x, y));
    // Wildflowers do not bloom in snow, ash or sand: loose ones on open ground go (a lone tuft of grass in their place
    // read as a dotted carpet, review 2026-09-24); the gap fill below groups what is left.
    if (UNFLOWERED[spec.climate]) {
      // A flower tucked against a bush becomes one more bush of the same thicket (289) when the way stays open;
      // any other flower goes.
      let removed = 0, bushed = 0;
      const projectNow = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
      const open = () => { const seen = reachable(api.canMove, projectNow, map, [plan.start.x, plan.start.y]); return plan.access.every((a) => seen.has(at(a.x, a.y))); };
      const inPlant = (i) => plan.placements.some((o) => o.kind === "vegetation" && i % W >= o.x && i % W < o.x + o.w && Math.floor(i / W) >= o.y && Math.floor(i / W) < o.y + o.h);
      for (let i = 0; i < map.upperTiles.length; i++) {
        if (!UNFLOWERED[spec.climate].has(map.upperTiles[i]) || !PLAIN.has(map.lowerTiles[i]) || taken.has(i)) continue;
        const x = i % W, y = Math.floor(i / W);
        const hugs = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < map.height && inPlant(at(x + dx, y + dy)));
        map.upperTiles[i] = hugs ? 289 : -1;
        if (hugs && !open()) map.upperTiles[i] = -1;
        if (map.upperTiles[i] === 289) bushed++; else removed++;
      }
      edits.push({ kind: "unflowered", cells: removed + bushed, bushes: bushed, tiles: [...UNFLOWERED[spec.climate]], rule: "눈·재·모래에는 꽃이 피지 않는다: 덤불에 붙은 꽃은 같은 덤불(289)로, 나머지 꽃은 걷는다" });
    }
    if (spec.climate === "snow") {
      // Green broadleaf crowns in snow (review): each whole 3×4 tree becomes the snow-laden round bush 3×3 on its lower
      // three rows; the crown row goes back to snow.
      const bush = vegetation["둥근 덤불"];
      let swapped = 0;
      for (const o of plan.placements.filter((p) => p.kind === "vegetation" && /활엽수/.test(p.name) && p.w === 3 && p.h === 4)) {
        for (let y = o.y; y < o.y + 4; y++) for (let x = o.x; x < o.x + 3; x++) { map.lowerTiles[at(x, y)] = 240; map.upperTiles[at(x, y)] = -1; }
        for (let k = 0; k < 9; k++) { const i = at(o.x + k % 3, o.y + 1 + Math.floor(k / 3)); map.lowerTiles[i] = bush.lower[k]; map.upperTiles[i] = bush.upper[k]; }
        swapped++;
      }
      edits.push({ kind: "snow-bushes", trees: swapped, rule: "활엽수 3×4 → 눈 덮인 둥근 덤불 3×3(아래 세 줄), 맨 윗줄은 눈밭" });
    }
    if (spec.freezeRiver) {
      // The whole river and its plunge pools freeze (the waterfall keeps falling); bridges stay.
      const cells = [];
      map.lowerTiles.forEach((t, i) => { if (LAKE.has(t)) cells.push(i); });
      const frozen = freezeCells(map, cells, ice);
      assert(frozen > 40, "river did not freeze");
      edits.push({ kind: "freeze-river", swappedTiles: frozen, rule: "강·소의 물 칸 t → 얼음 칸 ice[t]; 폭포(2700)와 다리는 그대로" });
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
      { is: (l, u) => (l === 240 || GRASS.has(l)) && (u < 0 || FLOWERS.has(u)), cleared: () => { map.lowerTiles = arrangeTallGrass(map, { tileset, houses: plan.houses, seed: plan.seed }).lowerTiles; } }));
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
    // The fill gate (town: no plain 5×5 square, no 17×13 screen over 40% plain) once more after the climate edits,
    // with the same grouped scenes as the forest village (lib/village-fullness.mjs fillNaturalGaps): no tree scenes in
    // snow or sand, no flowers in snow, ash or sand; tall grass E/F/G is the sheet's own frosted / ash / dry / russet grass.
    {
      const isPlain = (x, y) => map.upperTiles[at(x, y)] === -1 && PLAIN.has(map.lowerTiles[at(x, y)]);
      const near = (x, y, r, test) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < map.height && test(at(xx, yy))) return true; return false; };
      const ring = new Set();
      for (const a of plan.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ring.add(at(a.x + dx, a.y + dy));
      // Solid pieces keep off access rings, doors and objects (one cell round), and stand beside — never on — roads, water and cliffs.
      const bare = (x, y) => !ring.has(at(x, y)) && !near(x, y, 1, (i) => taken.has(i) || CLIFF.has(map.upperTiles[i]) || CLIFF.has(map.lowerTiles[i])) && !near(x, y, 0, (i) => ROAD.has(map.lowerTiles[i]) || LAKE.has(map.lowerTiles[i]) || water.has(map.lowerTiles[i]) || map.lowerTiles[i] >= sheets.baseCount);
      const project = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
      const entry = [plan.start.x, plan.start.y];
      const reachOk = () => { const seen = reachable(api.canMove, project, map, entry); return targets.every(([x, y]) => seen.has(at(x, y))); };
      const yardFree = new Set(plan.access.map((a) => at(a.x, a.y)));
      for (const o of [...plan.houses, ...plan.placements.filter((p) => p.kind !== "vegetation"), ...(plan.yards ?? [])])
        for (let y = o.y; y < o.y + (o.h ?? 1); y++) for (let x = o.x; x < o.x + (o.w ?? 1); x++) yardFree.add(at(x, y));
      const fill = (trodden) => fillNaturalGaps({ map, isPlain, templates: vegetation, random: rng(plan.seed * 13 + spec.id.length), accept: reachOk,
        limits: { maxSq: 4, screen: 0.39 }, allow: (scene) => !(LEAFLESS.has(spec.climate) && scene.tree),
        // Without flowers the two-bush pair is still a group (never a lone bush), so it may fill narrow ground.
        flowerTiles: UNFLOWERED[spec.climate] ? [] : [348, 288], small: !!UNFLOWERED[spec.climate],
        // Tall grass may grow inside a landmark's open yard (the fenced pond, the graveyard); solid pieces may not.
        take: (x, y, solid) => (solid ? !taken.has(at(x, y)) && bare(x, y) : !yardFree.has(at(x, y))),
        grass: { members: trodden ? KEPT_GRASS : ALL_TALL_GRASS, arrange: (m) => { m.lowerTiles = arrangeTallGrass(m, { tileset, houses: plan.houses, seed: plan.seed }).lowerTiles; } } });
      // Snow and ash: the short grass by houses and roads (G) goes back to snow / ash, and new patches may only be E or F
      // (a patch the arranger would make G is refused) — review: 「흰색·재색 조각이 얼룩처럼 온 마을에」. When the village is
      // then too bare for the gate (a dense village whose open ground is all within three cells of a house or road), the
      // G grass stays and the fill runs as in the forest village.
      const saved = [map.lowerTiles.slice(), map.upperTiles.slice()];
      let before = emptiness(map, isPlain), gaps = null;
      if (BURIED.has(spec.climate)) {
        let buried = 0;
        map.lowerTiles.forEach((t, i) => { if (TRODDEN.has(t)) { map.lowerTiles[i] = 240; buried++; } });
        before = emptiness(map, isPlain);
        gaps = fill(true);
        if (gaps.maxSq <= 4 && gaps.screen <= 0.4) edits.push({ kind: "buried-grass", cells: buried, rule: "집·길 곁 키큰 풀 G(짧음) → 바닥; 숲 가 E(짙음)·트인 풀밭 F(밝음)만 남기고 새 덩이도 E·F 만" });
        else { [map.lowerTiles, map.upperTiles] = [saved[0].slice(), saved[1].slice()]; before = emptiness(map, isPlain); gaps = null; edits.push({ kind: "buried-grass", cells: 0, kept: "G grass kept: without it the village fails the fill gate" }); }
      }
      gaps ??= fill(false);
      (process.env.CLIMATE_SOFT ? (ok, msg) => ok || console.error("GATE", msg, JSON.stringify(gaps.screenAt)) : assert)(gaps.maxSq <= 4 && gaps.screen <= 0.4, `fill gate ${spec.id} maxSq=${gaps.maxSq} screen=${gaps.screen.toFixed(3)}`);
      edits.push({ kind: "fill", pieces: gaps.pieces.length, scenes: gaps.pieces.map((p) => p.name),
        emptiness: { before: { maxSq: before.maxSq, screen: +before.screen.toFixed(3) }, after: { maxSq: gaps.maxSq, screen: +gaps.screen.toFixed(3) } },
        rule: "빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 덩이 장면(덤불숲·바위와 덤불·키큰 풀 덩이, 가을은 나무·꽃 포함)" });
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
