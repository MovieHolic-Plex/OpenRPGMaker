// Author the climate villages on the snow / volcano sheets (scripts/content/build-climate-chipsets.py).
// Each map is a finished diverse forest village (tiledata/forest-villages/diverse) re-pointed at a climate tileset:
// tile numbers are identical, so houses, cliffs, roads and forest assemblies stay exactly as authored. Climate edits:
//  - snow: a pond can freeze — its water tiles are swapped for the appended ice copies (same shore shapes, walkable);
//  - volcano: water is already lava on the sheet; clearings can get a pair of volcanic peaks (plain 858/859/888/889 + erupting 918/919/948/949).
// Usage: node scripts/content/author-climate-villages.mjs   (writes tiledata/climate-villages/catalog.json + validation.json)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";

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
];
const PEAKS = [[858, 859, 918, 919], [888, 889, 948, 949]];
const ice = new Map(sheets.snow.ice), water = new Set(sheets.volcano.lava);
const GROUND = 240;

await withTsModule("scripts/content/lib/climate-villages-entry.ts", "climate-villages-entry.mjs", async (api) => {
  const tilesets = { snow: api.createClimateVillageTileset("snow"), volcano: api.createClimateVillageTileset("volcano") };
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
    if (spec.freeze) {
      const box = plan.landmarks.find((l) => l.id === spec.freeze);
      let frozen = 0;
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++)
        for (const layer of ["lowerTiles", "upperTiles"]) {
          const t = map[layer][at(x, y)];
          if (ice.has(t)) { map[layer][at(x, y)] = ice.get(t); frozen++; }
        }
      assert(frozen > 20, "pond did not freeze");
      // Walk onto the ice: the frozen cell nearest the fence gate.
      const g = box.gate, cells = [];
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++)
        if (map.lowerTiles[at(x, y)] >= sheets.baseCount && map.upperTiles[at(x, y)] < 0) cells.push([x, y]);
      cells.sort((a, b) => Math.hypot(a[0] - g.x, a[1] - g.y) - Math.hypot(b[0] - g.x, b[1] - g.y));
      const centre = [box.x + (box.w >> 1), box.y + (box.h >> 1)];
      const inner = cells.slice().sort((a, b) => Math.hypot(a[0] - centre[0], a[1] - centre[1]) - Math.hypot(b[0] - centre[0], b[1] - centre[1]))[0];
      targets.push(cells[0], inner);
      edits.push({ kind: "freeze", landmark: box.id, box: [box.x, box.y, box.w, box.h], swappedTiles: frozen, rule: "물 칸 t → 얼음 칸 ice[t] (sheets.json snow.ice)" });
    }
    if (spec.peaks) {
      // A 4×2 pair of peaks on bare ash only: the ring around it must be plain ground with nothing on top, away from doors.
      const bare = (x, y) => x >= 0 && y >= 0 && x < W && y < map.height && map.lowerTiles[at(x, y)] === GROUND && map.upperTiles[at(x, y)] < 0;
      const fronts = plan.houses.map((h) => [h.front.x, h.front.y]);
      const picked = [];
      const candidates = [];
      for (let y = 2; y < map.height - 3; y++) for (let x = 2; x < W - 5; x++) {
        let ok = true;
        for (let dy = -1; dy <= 2 && ok; dy++) for (let dx = -1; dx <= 4 && ok; dx++) ok = bare(x + dx, y + dy);
        if (ok && fronts.every(([fx, fy]) => Math.hypot(fx - x, fy - y) > 6)) candidates.push([x, y]);
      }
      while (picked.length < spec.peaks && candidates.length) {
        const score = ([x, y]) => Math.min(...[...picked, ...fronts].map(([px, py]) => Math.hypot(px - x, py - y)));
        candidates.sort((a, b) => score(b) - score(a) || a[1] - b[1] || a[0] - b[0]);
        const [x, y] = candidates.shift();
        PEAKS.forEach((r, dy) => r.forEach((t, dx) => { map.upperTiles[at(x + dx, y + dy)] = t; }));
        picked.push([x, y]);
        edits.push({ kind: "volcanic-peaks", x, y, w: 4, h: 2, upper: PEAKS });
      }
      assert.equal(picked.length, spec.peaks, "no room for peaks");
    }
    if (spec.climate === "volcano") {
      const lava = map.lowerTiles.filter((t) => water.has(t)).length + map.upperTiles.filter((t) => water.has(t)).length;
      const bridges = map.lowerTiles.concat(map.upperTiles).filter((t) => sheets.volcano.stoneBridges.includes(t)).length;
      edits.push({ kind: "sheet", lavaCells: lava, basaltBridgeCells: bridges, rule: "물 칸은 시트에서 용암으로 칠해져 있다(번호·통행 그대로)" });
    }
    // Reachability with the runtime move rule, from the village entrance to every door front (+ the ice).
    const project = { maps: { [map.id]: map }, tilesets: { [tileset.id]: tileset } };
    const entry = [plan.start.x, plan.start.y];
    const seen = new Set([at(...entry)]), queue = [entry];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = at(X, Y);
        if (X >= 0 && Y >= 0 && X < W && Y < map.height && !seen.has(k) && api.canMove(project, map, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
      }
    }
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
  console.log({ maps: Object.keys(maps), reach: report.map((r) => `${r.id}:${r.reachable}/${r.targets.length}`), edits: plans.map((p) => p.edits.map((e) => e.kind + (e.swappedTiles ?? e.lavaCells ?? `@${e.x},${e.y}`))) });
});
