// Author the climate villages on the snow / volcano / desert / autumn sheets (scripts/content/build-climate-chipsets.py).
// Each map is a finished diverse forest village (tiledata/forest-villages/diverse) re-pointed at a climate tileset:
// tile numbers are identical, so houses, cliffs, roads and forest assemblies stay exactly as authored. Climate edits:
//  - snow: a pond can freeze — its water tiles are swapped for the appended ice copies (same shore shapes, walkable);
//  - volcano: water is already lava on the sheet; clearings can get a pair of volcanic peaks (plain 858/859/888/889 + erupting 918/919/948/949);
//  - desert and volcano (`bare`): the leafy forest and every leafy tree stamp are cleared; leafless trees (lib/bare-trees.mjs,
//    sheet slots 2880~) stand in groves — denser in the map's edge band, sparse inland — with rocks, dry shrubs (and in
//    sand a cactus) at the trunk foot; a desert shore gets a few palm clumps; the rest of the gap is tall grass E/F;
//  - autumn: the sheet alone (gold grass, autumn leaves).
// The edits live in lib/climate-edits.mjs, shared with the climate fields (author-field-routes.mjs).
// Usage: node scripts/content/author-climate-villages.mjs   (writes tiledata/climate-villages/catalog.json + validation.json)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { cliffEndLedge, dressDesert, extendClearedCliffEnds, freezeCells, placePeaks, reachable } from "./lib/climate-edits.mjs";
import { arrangeBareGroves, clearLeafyTrees, growMeadows, isLeafyTree, plantPalmGroves, CACTUS } from "./lib/bare-trees.mjs";
import { emptiness, fillNaturalGaps, rng } from "./lib/village-fullness.mjs";
import { arrangeTallGrass, ALL_TALL_GRASS, TALL_GRASS_TILES } from "./lib/tall-grass.mjs";
import { dressDesertGround, dressVolcanoGround, terrainKit } from "./lib/climate-terrain.mjs";
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
  { id: "climate-volcano-twin-falls", climate: "volcano", from: "twin-falls-river-village", name: "두 폭포 · 용암 강마을", bare: {},
    note: "용암 강이 마을 한가운데를 흐르다 두 줄 절벽에서 용암 폭포로 떨어진다. 단마다 현무암 다리가 두 강둑을 잇는다. 숲 대신 그을린 고목 덩이가 맵 가장자리를 두른다" },
  { id: "climate-volcano-ford-castle", climate: "volcano", from: "ford-castle-town", name: "잿빛 여울성", bare: {},
    note: "재로 덮인 벌판 위 성채 마을. 해자와 여울이 용암으로 바뀌고, 숲이 있던 자리에는 그을린 고목이 덩이로 서 있다" },
  { id: "climate-volcano-lava-pond", climate: "volcano", from: "mistpond-hollow", name: "용암못 폐촌", peaks: 1, bare: {},
    note: "울타리 친 못이 끓는 용암못이 된 폐촌. 빈 재밭에 작은 화산 봉우리 한 쌍(잠든 봉우리·분화하는 봉우리)이 솟고, 재밭은 식은 용암 판과 가지 친 용암 균열로 갈라졌다. 그을린 고목 덩이가 폐촌을 둘러싼다" },
  { id: "climate-desert-terrace-canyon", climate: "desert", from: "terrace-cliff-village", name: "사암 층바위 협곡마을", bare: {},
    note: "세 높이의 사암 대지를 네 계단이 잇는 협곡 마을. 햇볕에 바랜 고목이 바위·선인장·마른 덤불과 덩이 지어 협곡 가장자리에 서 있다" },
  { id: "climate-desert-reed-bay", climate: "desert", from: "reed-bay-village", name: "모래 물굽이 포구", bare: { palms: 3 },
    note: "모래 해안 물굽이를 따라 비껴 앉은 포구 마을. 물가에 야자 몇 그루가 무리 지어 서고 긴 선착장이 바다로 나간다. 뭍 쪽 가장자리에는 바랜 고목 덩이" },
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
    // Levels stay levels: with the stairs shut, the ground at a cliff's top edge and at its foot must not meet unless
    // they already met in the forest village (clearing the forest must not open a way round a cliff end).
    const stairs = new Set(tileset.tileMeta.flatMap((m, t) => (/계단/.test(m?.label ?? "") ? [t] : [])));
    const levels = (m) => {
      const pj = { maps: { [m.id]: m }, tilesets: { [tileset.id]: tileset } }, comp = new Int32Array(W * m.height).fill(-1);
      const shut = (i) => stairs.has(m.lowerTiles[i]) || stairs.has(m.upperTiles[i]);
      let n = 0;
      for (let i = 0; i < comp.length; i++) {
        if (comp[i] >= 0 || shut(i)) continue;
        const queue = [i]; comp[i] = n;
        while (queue.length) {
          const c = queue.pop(), x = c % W, y = Math.floor(c / W);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const X = x + dx, Y = y + dy, k = Y * W + X;
            if (X >= 0 && Y >= 0 && X < W && Y < m.height && comp[k] < 0 && !shut(k) && api.canMove(pj, m, x, y, X, Y)) { comp[k] = n; queue.push(k); }
          }
        }
        n++;
      }
      return comp;
    };
    const sourceLevels = spec.bare ? levels({ ...map, lowerTiles: src.lowerTiles, upperTiles: src.upperTiles }) : null;
    const cliffPieces = (m) => {
      const isCliff = (i) => CLIFF.has(m.upperTiles[i]), seenP = new Set(), pieces = [];
      for (let i = 0; i < m.upperTiles.length; i++) {
        if (seenP.has(i) || !isCliff(i)) continue;
        const cells = [], queue = [i]; seenP.add(i);
        while (queue.length) {
          const c = queue.pop(), x = c % W, y = Math.floor(c / W); cells.push(c);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, k = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < m.height && !seenP.has(k) && isCliff(k)) { seenP.add(k); queue.push(k); } }
        }
        pieces.push(cells);
      }
      return pieces;
    };
    const cliffLeaks = (m) => {
      const after = levels(m), isCliff = (i) => CLIFF.has(m.upperTiles[i]), region = new Int32Array(W * m.height).fill(-1), leaks = [];
      let regions = 0;
      for (let i = 0; i < region.length; i++) {
        if (region[i] >= 0 || !isCliff(i)) continue;
        const queue = [i]; region[i] = regions;
        while (queue.length) {
          const c = queue.pop(), x = c % W, y = Math.floor(c / W);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, k = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < m.height && region[k] < 0 && isCliff(k)) { region[k] = regions; queue.push(k); } }
        }
        regions++;
      }
      for (let r = 0; r < regions; r++) {
        const top = [], foot = [];
        region.forEach((g, i) => {
          if (g !== r) return;
          if (i >= W && !isCliff(i - W) && after[i - W] >= 0) top.push(i - W);
          if (i + W < region.length && !isCliff(i + W) && after[i + W] >= 0) foot.push(i + W);
        });
        done: for (const a of top) for (const b of foot) if (after[a] === after[b] && sourceLevels[a] !== sourceLevels[b]) {
          const cells = []; region.forEach((g, i) => { if (g === r) cells.push(i); });
          leaks.push({ top: [a % W, Math.floor(a / W)], foot: [b % W, Math.floor(b / W)], cells });
          break done;
        }
      }
      return leaks;
    };
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
    if (spec.bare) {
      // Fewer trees in sand and ash (user 2026-09-25): the leafy forest and every leafy tree stamp go; leafless trees
      // stand in groves (lib/bare-trees.mjs) — the map's edge band every ~8 cells, the old forest inland every ~13 —
      // each with its own rocks and dry shrubs at the foot. Cliffs that ended in forest at the map edge run on to it.
      const forestBefore = map.lowerTiles.filter(isLeafyTree).length + map.upperTiles.filter((t) => t >= 0 && isLeafyTree(t)).length;
      const { cleared, orphans } = clearLeafyTrees(map);
      // No grass carpets on ash or sand (user 2026-09-25): ash keeps no tall grass at all, sand only the dry grass
      // within four cells of the water; loose foot rocks of the forest village's bush clumps go with the grass.
      const grassBefore = map.lowerTiles.filter((t) => GRASS.has(t)).length;
      {
        const wet = new Set(); map.lowerTiles.forEach((t, i) => { if (water.has(t)) wet.add(i); });
        const nearWet = (i) => { const x = i % W, y = Math.floor(i / W); for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (wet.has(at(x + dx, y + dy))) return true; return false; };
        map.lowerTiles.forEach((t, i) => { if (GRASS.has(t) && (spec.climate === "volcano" || !nearWet(i))) map.lowerTiles[i] = 240; });
      }
      const openGround = (i) => !taken.has(i) && map.upperTiles[i] < 0 && (PLAIN.has(map.lowerTiles[i]) || GRASS.has(map.lowerTiles[i]));
      const cliffCells = extendClearedCliffEnds(map, { cliff: CLIFF, cleared, open: openGround });
      // A cliff end the forest used to close and no extension can reach (a house or road on the way): a side ledge
      // on the upper level; failing that, the cleared forest piece that sealed it comes back, smallest piece first.
      const plugs = [], ledges = [];
      // First a side ledge on the upper level (plateau rim running north from the cliff's end), east or west.
      // Any cliff piece's end may be the way round (the leak shows on every piece of that cliff), so every piece and
      // side is tried; a ledge is kept only when it closes at least one leak.
      for (let leaks = cliffLeaks(map), k = 0; leaks.length && k < 8; k++) {
        let fixed = false;
        for (const cells of cliffPieces(map)) {
          for (const side of ["east", "west"]) {
            const saved = map.upperTiles.slice();
            const ledge = cliffEndLedge(map, { cells, side, open: (i) => openGround(i) && cleared.has(i) });
            if (!ledge) continue;
            const now = cliffLeaks(map);
            if (now.length < leaks.length) { ledges.push({ side, x: ledge[0] % W, y: [Math.floor(ledge.at(-1) / W), Math.floor(ledge[0] / W)] }); leaks = now; fixed = true; break; }
            map.upperTiles = saved;
          }
          if (fixed) break;
        }
        if (!fixed) break;
      }
      for (let leaks = cliffLeaks(map); leaks.length;) {
        const comps = [], seenC = new Set();
        for (const i of cleared) {
          if (seenC.has(i)) continue;
          const cells = [], stack = [i]; seenC.add(i);
          while (stack.length) {
            const c = stack.pop(); cells.push(c);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const x = c % W + dx, y = Math.floor(c / W) + dy, k = y * W + x;
              if (x >= 0 && y >= 0 && x < W && y < map.height && cleared.has(k) && !seenC.has(k)) { seenC.add(k); stack.push(k); }
            }
          }
          comps.push(cells);
        }
        comps.sort((a, b) => a.length - b.length);
        let fixed = false;
        for (const cells of comps) {
          const saved = cells.map((i) => [i, map.lowerTiles[i], map.upperTiles[i]]);
          for (const i of cells) { map.lowerTiles[i] = src.lowerTiles[i]; map.upperTiles[i] = src.upperTiles[i]; }
          const now = cliffLeaks(map);
          if (now.length < leaks.length) { for (const i of cells) cleared.delete(i); plugs.push({ cells: cells.length, at: [cells[0] % W, Math.floor(cells[0] / W)] }); leaks = now; fixed = true; break; }
          for (const [i, l, u] of saved) { map.lowerTiles[i] = l; map.upperTiles[i] = u; }
        }
        assert(fixed, `cliff leak on ${spec.id} cannot be sealed: ${JSON.stringify(leaks)}`);
      }
      map.lowerTiles = arrangeTallGrass(map, { tileset, houses: plan.houses, seed: plan.seed }).lowerTiles;
      const project = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
      const accept = () => { const seen = reachable(api.canMove, project, map, [plan.start.x, plan.start.y]); return targets.every(([x, y]) => seen.has(at(x, y))); };
      const keep = [...plan.access.map((a) => [a.x, a.y]), [plan.start.x, plan.start.y], ...targets];
      const wet = new Set();
      map.lowerTiles.forEach((t, i) => { if (water.has(t)) wet.add(i); });
      const palms = spec.bare.palms ? plantPalmGroves(map, { water: wet, groups: spec.bare.palms, seed: plan.seed, keep, houses: plan.houses, tileset, accept, reserved: taken }) : [];
      const groves = arrangeBareGroves(map, { tileset, houses: plan.houses, keep, reserved: taken, sites: cleared, seed: plan.seed,
        // Ash: no pale rock piles at the foot (they read as bones on grey ash) — dry shrubs only.
        // No cactus and only an occasional rock at the foot (the new cacti stand in their own clumps), no undergrowth grass.
        cactus: null, rock: spec.climate === "desert" ? 537 : null, rockChance: 0.3, accept });
      map.lowerTiles = arrangeTallGrass(map, { tileset, houses: plan.houses, seed: plan.seed }).lowerTiles;
      assert(groves.trees >= 4, `too few leafless trees on ${spec.id}: ${groves.trees}`);
      const forestAfter = map.lowerTiles.filter(isLeafyTree).length + map.upperTiles.filter((t) => t >= 0 && isLeafyTree(t)).length;
      edits.push({ kind: "bare-trees", forestCells: { before: forestBefore, after: forestAfter }, clearedCells: cleared.size, orphanRocks: orphans, grassCells: { before: grassBefore, after: map.lowerTiles.filter((t) => GRASS.has(t)).length },
        cliffExtended: cliffCells.length, ledges, forestPlugs: plugs, palms: palms.length, groves: groves.groves.length, trees: groves.trees, placed: groves.groves,
        rule: "잎 달린 숲·나무 도장(2550~2609·1200~1463·960~1123·289) → 맨땅; 잎 없는 나무(2880~, bare-trees:*) 덩이 — 가장자리 띠 8칸·안쪽 13칸 간격, 큰/중간 한 그루+곁나무 1~2+밑동 옆 바위·마른 덤불(사막 안쪽은 선인장); 집·길·문·계단·다리·울타리 2칸 밖; 물가 야자는 2~3그루 무리" });
    }
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
      // Sand and ash with leafless groves: no leafy bush or tree scenes — tall grass patches, and the small thicket
      // scenes drawn with the sheet's dry shrubs (2×2 clumps of four, bare-trees:shrub-*) instead of leafy bushes.
      const shrubs = (tileset.tileGroups ?? []).filter((g) => g.id.startsWith("bare-trees:shrub-")).map((g) => g.tileIds[0]);
      const dry = spec.bare ? { "작은 덤불": { name: "마른 덤불 무리", w: 2, h: 2, lower: null, upper: shrubs.slice(0, 4) } } : {};
      const singles = spec.bare ? { "덤불": { name: "마른 덤불", w: 1, h: 1, lower: null, upper: [shrubs[4]] }, "바위": { name: "바위", w: 1, h: 1, lower: null, upper: [537] } } : undefined;
      const DRY_SCENES = new Set(["작은 덤불숲"]);
      const fillGaps = (trodden, dryToo = false) => fillNaturalGaps({ map, isPlain, templates: { ...vegetation, ...dry }, ...(singles ? { singles } : {}), random: rng(plan.seed * 13 + spec.id.length), accept: reachOk,
        limits: { maxSq: 4, screen: 0.39 }, allow: (scene) => (spec.bare ? !!scene.grass || (dryToo && DRY_SCENES.has(scene.name)) : !(LEAFLESS.has(spec.climate) && scene.tree)),
        // Without flowers the two-bush pair is still a group (never a lone bush), so it may fill narrow ground.
        flowerTiles: UNFLOWERED[spec.climate] ? [] : [348, 288], small: !!UNFLOWERED[spec.climate],
        // Tall grass may grow inside a landmark's open yard (the fenced pond, the graveyard); solid pieces may not.
        take: (x, y, solid) => (solid ? !taken.has(at(x, y)) && bare(x, y) : !yardFree.has(at(x, y))),
        grass: { members: trodden ? KEPT_GRASS : ALL_TALL_GRASS, arrange: (m) => { m.lowerTiles = arrangeTallGrass(m, { tileset, houses: plan.houses, seed: plan.seed }).lowerTiles; } } });
      // Sand and ash lost their forest: what the separate patches cannot close is closed by dry meadows that may join
      // them (lib/bare-trees.mjs growMeadows) — never by more trees.
      const meadows = (members) => growMeadows(map, { isPlain, take: (x, y) => !yardFree.has(at(x, y)), members, seed: plan.seed,
        arrange: (mm) => { mm.lowerTiles = arrangeTallGrass(mm, { tileset, houses: plan.houses, seed: plan.seed }).lowerTiles; }, limits: { maxSq: 4, screen: 0.39 } });
      const passes = (g) => g.maxSq <= 4 && g.screen <= 0.4;
      if (spec.bare) {
        // Sand and ash (user 2026-09-25: 「돌·선인장·풀이 너무 많다」, 「화산은 균열·용암, 모래는 사구」): the gate is met by
        // the ground itself — lava plates and crack networks, dunes and ripple sand (lib/climate-terrain.mjs) — with a
        // few set pieces (a lava pool with its fumarole, one basalt cluster; mesas, one remote bones spot, a few cactus
        // clumps). No tall grass meadows, no loose rocks.
        const before = emptiness(map, isPlain);
        const kit = terrainKit(tileset);
        const wetCells = new Set(); map.lowerTiles.forEach((t, i) => { if (water.has(t)) wetCells.add(i); });
        // Walkable ground may also run inside a landmark's open yard (cracks round the fenced lava pond), never over
        // houses, household yards, props or access cells.
        const groundFree = new Set(plan.access.map((a) => at(a.x, a.y)));
        const isLandmark = (o) => (plan.landmarks ?? []).some((l) => l.x === o.x && l.y === o.y && l.w === o.w && l.h === o.h);
        for (const o of [...plan.houses, ...plan.placements.filter((p) => p.kind !== "vegetation" && !isLandmark(p)), ...(plan.yards ?? [])])
          for (let y = o.y; y < o.y + (o.h ?? 1); y++) for (let x = o.x; x < o.x + (o.w ?? 1); x++) groundFree.add(at(x, y));
        const opts = { kit, isPlain, seed: plan.seed, accept: reachOk, limits: { maxSq: 4, screen: 0.39 }, water: wetCells,
          // (ground keeps one cell off house walls, so a plate or dune never reads as rubble heaped against a house)
          take: (x, y, solid) => (solid ? !taken.has(at(x, y)) && bare(x, y) : !groundFree.has(at(x, y)) && !ring.has(at(x, y)) && !near(x, y, 0, (i) => ROAD.has(map.lowerTiles[i]))
            && !plan.houses.some((h) => x >= h.x - 1 && x <= h.x + h.w && y >= h.y - 1 && y <= h.y + h.h)),
          ...(spec.bare.ground ?? {}) };
        const gaps = spec.climate === "volcano" ? dressVolcanoGround(map, opts) : dressDesertGround(map, opts);
        (process.env.CLIMATE_SOFT ? (ok, msg) => ok || console.error("GATE", msg, JSON.stringify(gaps.screenAt)) : assert)(passes(gaps), `ground gate ${spec.id} maxSq=${gaps.maxSq} screen=${gaps.screen.toFixed(3)}`);
        const kinds = {}; for (const p of gaps.pieces) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
        edits.push({ kind: "ground", pieces: kinds, cells: gaps.counts,
          emptiness: { before: { maxSq: before.maxSq, screen: +before.screen.toFixed(3) }, after: { maxSq: gaps.maxSq, screen: +gaps.screen.toFixed(3) } },
          rule: spec.climate === "volcano"
            ? "빈칸 게이트를 땅으로 넘긴다: 식은 용암 판(2×2 덩이, 3×3 이상)·용암 균열(1칸 폭 가지)·작은 용암 웅덩이 1~2(분기공·유황)·현무암 기둥 한 무리, 흑요석·재 더미는 균열 곁에만. 키큰 풀·바위 없음"
            : "빈칸 게이트를 땅으로 넘긴다: 사구(3×2·4×3·6×3)·모래 물결 덩이·갈라진 마른 땅, 사암 메사 0~2, 외딴 곳 뼈·묻힌 기둥 한 곳, 선인장 무리 3~4. 풀은 물가만, 흩은 바위 없음" });
      } else {
      const fill = (trodden) => {
        const g = fillGaps(trodden);
        if (!spec.bare || passes(g)) return g;
        // E/F meadows first (on snow and ash they never become G); only if still open, meadows of any kind.
        let m = meadows(KEPT_GRASS), n = m.patches.length;
        if (!passes(m) && !trodden) { m = meadows(ALL_TALL_GRASS); n += m.patches.length; }
        // Last resort where no 2×2 grass block fits (narrow ground by fences and yards): a few dry shrub thickets.
        if (!passes(m) && !trodden) { const d = fillGaps(false, true); return { ...d, pieces: [...g.pieces, ...d.pieces], meadows: n }; }
        return { ...g, maxSq: m.maxSq, screen: m.screen, meadows: n };
      };
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
        else if (spec.bare) {
          // Ash without its forest: E/F alone cannot close the ground by houses and roads. The old G stays buried; the
          // gap fill carries on from here with G allowed, separate patches first and E/F meadows before any G meadow.
          const first = gaps;
          gaps = fill(false);
          gaps = { ...gaps, pieces: [...first.pieces, ...gaps.pieces], meadows: (first.meadows ?? 0) + (gaps.meadows ?? 0) };
          edits.push({ kind: "buried-grass", cells: buried, regrownG: map.lowerTiles.filter((t) => TRODDEN.has(t)).length,
            rule: "집·길 곁 키큰 풀 G(짧음) → 바닥; 새 덩이는 E·F 먼저, 숲을 걷어 E·F 만으로 게이트를 못 넘는 집·길 곁에만 G 덩이" });
        } else { [map.lowerTiles, map.upperTiles] = [saved[0].slice(), saved[1].slice()]; before = emptiness(map, isPlain); gaps = null; edits.push({ kind: "buried-grass", cells: 0, kept: "G grass kept: without it the village fails the fill gate" }); }
      }
      gaps ??= fill(false);
      (process.env.CLIMATE_SOFT ? (ok, msg) => ok || console.error("GATE", msg, JSON.stringify(gaps.screenAt)) : assert)(gaps.maxSq <= 4 && gaps.screen <= 0.4, `fill gate ${spec.id} maxSq=${gaps.maxSq} screen=${gaps.screen.toFixed(3)}`);
      edits.push({ kind: "fill", pieces: gaps.pieces.length, scenes: gaps.pieces.map((p) => p.name), ...(gaps.meadows ? { meadows: gaps.meadows } : {}),
        emptiness: { before: { maxSq: before.maxSq, screen: +before.screen.toFixed(3) }, after: { maxSq: gaps.maxSq, screen: +gaps.screen.toFixed(3) } },
        rule: "빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 덩이 장면(덤불숲·바위와 덤불·키큰 풀 덩이, 가을은 나무·꽃 포함)" });
      }
    }
    // Reachability with the runtime move rule, from the village entrance to every door front (+ the ice).
    const project = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
    const entry = [plan.start.x, plan.start.y];
    const seen = reachable(api.canMove, project, map, entry);
    const blocked = targets.filter(([x, y]) => !seen.has(at(x, y)));
    // No new way round a cliff end (stairs shut) compared with the forest village.
    const joined = spec.bare ? cliffLeaks(map).slice(0, 5).map((l) => [l.top, l.foot]) : [];
    report.push({ id: spec.id, entry, targets, reachable: seen.size, blocked, ...(spec.bare ? { joinedLevels: joined } : {}) });
    maps[spec.id] = map;
    plans.push({ ...spec, tilesetId: tileset.id, entry, targets, width: W, height: map.height, edits,
      houses: plan.houses.map(({ id, role, label, x, y, w, h, front }) => ({ id, role, label, x, y, w, h, front })) });
  }
  const bad = report.filter((r) => r.blocked.length || r.joinedLevels?.length);
  assert(!bad.length, "unreachable: " + JSON.stringify(bad));
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ source: "tiledata/forest-villages/diverse/catalog.json", plans, maps }) + "\n");
  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  console.log({ maps: Object.keys(maps), reach: report.map((r) => `${r.id}:${r.reachable}/${r.targets.length}`), edits: plans.map((p) => p.edits.filter((e) => e.kind !== "desert-plant").map((e) => e.kind + (e.kind === "unflowered" ? e.cells : e.emptiness ? `${e.pieces}:${e.emptiness.before.screen}->${e.emptiness.after.screen}` : e.swappedTiles ?? e.lavaCells ?? e.plants ?? `@${e.x},${e.y}`))) });
});
