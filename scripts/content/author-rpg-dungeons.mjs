// Author the RPG dungeon maps (caves, mine, catacomb, waterway, temple, tower, demon castle, climate caves,
// forest maze, sea cave, dragon lair) — terrain and placement only, no events.
//  - dungeon rooms: rpg-dungeons/kit.mjs (void rim autotile + theme wall face + autotiled materials) on the
//    EasyRPG dungeon sheet or one of its recoloured copies (build-rpg-dungeon-sheets.py: same tile numbers);
//  - forest maze: the forest_harmony canopy/trunk fitter (paintContouredForest) over a maze mask;
//  - demon castle front: the castle of 화산 · 여울성 (climate-volcano-ford-castle) kept as authored.
// Usage: node scripts/content/author-rpg-dungeons.mjs [outDir]   (default tiledata/rpg-dungeons)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { createKit, lines } from "./rpg-dungeons/kit.mjs";
import { dungeonFamily, loadParts } from "./rpg-dungeons/family.mjs";
import { dungeonPlans } from "./rpg-dungeons/plans.mjs";
import { outdoorPlans } from "./rpg-dungeons/outdoor.mjs";
import { dressFloor } from "./rpg-dungeons/dress.mjs";
import { carveOutcrops } from "./rpg-dungeons/outcrops.mjs";

const OUT = process.argv[2] ?? "tiledata/rpg-dungeons";
const ONLY = process.env.DUNGEON_ONLY?.split(",");
const WALL_FACE_TOPS = new Set([103, 102, 104]);

await withTsModule("scripts/content/lib/rpg-dungeons-entry.ts", "rpg-dungeons-entry.mjs", async (api) => {
  const base = api.createBlankProject();
  // Dungeon-family tilesets: the bundled dungeon definition + the grafts (kit GRAFTS 480~488, atlas parts 510~).
  const parts = loadParts();
  const family = (id, name, texture, drawn = []) => dungeonFamily(base, { id, name, texture, drawn, parts });
  const tilesets = {
    oprn_dungeon_stone: family("oprn_dungeon_stone", "던전 · EasyRPG + 계단·상자·광차 이식", "tex_easyrpg_chipset_dungeon"),
    oprn_dungeon_desert: family("oprn_dungeon_desert", "던전 · 사암 피라미드 (재칠)", "tex_oprn_dungeon_desert", [54, 55, 84, 85, 116, 144].map((t, i) => [t, `파라오 석관 ${i + 1}/6 (직접 그림)`])),
    oprn_dungeon_sea: family("oprn_dungeon_sea", "던전 · 해저 동굴 (재칠)", "tex_oprn_dungeon_sea"),
    oprn_dungeon_lair: family("oprn_dungeon_lair", "던전 · 용의 둥지 (재칠)", "tex_oprn_dungeon_lair"),
    oprn_dungeon_cave: family("oprn_dungeon_cave", "던전 · 동굴 물웅덩이 (재칠)", "tex_oprn_dungeon_cave"),
  };
  const kit = createKit(tilesets.oprn_dungeon_stone, { parts });

  // Shortest walk from the entrance to every target/exit (runtime move rule); dressing keeps off these cells.
  const routes = (spec, m, tilesetId) => {
    const map = { ...m, id: spec.id, tilesetId }, project = { maps: { [spec.id]: map }, tilesets };
    const W = m.width, start = spec.entry[1] * W + spec.entry[0], parent = new Map([[start, -1]]), queue = [spec.entry];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = Y * W + X;
        if (!parent.has(k) && api.canMove(project, map, x, y, X, Y)) { parent.set(k, y * W + x); queue.push([X, Y]); }
      }
    }
    const keep = new Set();
    for (const [x, y] of [...spec.targets, ...(spec.exits ?? []).map((e) => e.at)])
      for (let k = y * W + x; k !== undefined && k >= 0; k = parent.get(k)) keep.add(k);
    return keep;
  };
  const places = [];
  for (const plan of dungeonPlans()) {
    if (ONLY && !ONLY.includes(plan.id)) continue;
    const tilesetId = plan.tileset ?? "oprn_dungeon_stone", ts = tilesets[tilesetId];
    const passable = (t) => { const f = api.tilePassability(ts, 187, t); return f.up && f.down && f.left && f.right; };
    const reach = (m) => {
      const probe = { ...m, id: plan.id, tilesetId }, project = { maps: { [plan.id]: probe }, tilesets };
      const W = m.width, seen = new Set([plan.entry[1] * W + plan.entry[0]]), queue = [plan.entry];
      while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy, k = Y * W + X;
          if (!seen.has(k) && api.canMove(project, probe, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
        }
      }
      return seen;
    };
    // Terrain first: rock outcrops break a big bare cave floor before any debris is laid.
    const carved = plan.outcrops && !process.env.DUNGEON_NODRESS
      ? carveOutcrops(plan, { build: (s) => kit.build(s), reach, routes: (m) => routes(plan, m, tilesetId), ...(typeof plan.outcrops === "object" ? plan.outcrops : {}) })
      : { spec: plan, log: [] };
    let spec = carved.spec;
    // Floor the entrance cannot reach (a strip behind a pool, a pocket cut off by a rock spur) is filled in
    // as rock, unless the plan means it (cells behind bars).
    for (let pass = 0; pass < 3 && !spec.sealed; pass++) {
      const probe = kit.build(spec).map, seen = reach(probe), rows = lines(spec.art).map((r) => [...r]);
      let changed = 0;
      for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
        const i = y * probe.width + x;
        if (seen.has(i) || !".,;Rst".includes(rows[y][x])) continue;
        const f = api.tilePassability(ts, probe.lowerTiles[i], probe.upperTiles[i]);
        if (!(f.up || f.down || f.left || f.right)) continue;
        rows[y][x] = "#"; changed++;
      }
      if (!changed) break;
      spec = { ...spec, art: "\n" + rows.map((r) => r.join("")).join("\n") + "\n" };
    }
    const { map, placements, chars, warnings } = kit.build(spec);
    for (const w of warnings) console.error(`${spec.id}: prop ${w}`);
    if (carved.log.length) placements.push({ kind: "outcrops", note: "넓은 맨바닥을 가르는 바위 기둥(허공 덩이 + 벽면 두 줄)", blobs: carved.log });
    // Laid walkways (aisle, carpet, boards, ledges, inlay) stay clean like the route itself.
    const clear = new Set();
    chars.forEach((row, y) => [...row].forEach((c, x) => { if ((spec.keepClear ?? "tr=w_|q").includes(c)) clear.add(y * map.width + x); }));
    const dressing = process.env.DUNGEON_NODRESS ? { placed: 0, log: [] } : dressFloor(map, spec, { passable, reach, protect: routes(spec, map, tilesetId), clear, group: kit.group, autotile: (m, g) => kit.autotile(m, g, kit.members(g)) });
    if (dressing.placed) placements.push({ kind: "dressing", note: "무너진 벽 곁·모서리에 몰아 둔 잔해 덩이(1~3곳) — 통로는 막지 않음", clumps: dressing.log });
    places.push({ spec, map, placements, tilesetId, dressing: { placed: dressing.placed, maxSq: dressing.maxSq, screen: dressing.screen } });
  }
  for (const p of await outdoorPlans(api, base, ONLY)) {
    places.push(p);
    if (p.tileset) tilesets[p.tilesetId] = p.tileset;
  }

  // ── reachability with the runtime move rule ──
  const maps = {}, report = [];
  for (const p of places) {
    const { spec } = p;
    const map = { id: spec.id, name: spec.name, width: p.map.width, height: p.map.height, tileSize: 16, tilesetId: p.tilesetId, lowerTiles: p.map.lowerTiles, upperTiles: p.map.upperTiles, events: [] };
    maps[spec.id] = map;
    const project = { maps: { [spec.id]: map }, tilesets };
    const seen = new Set([spec.entry[1] * map.width + spec.entry[0]]), queue = [spec.entry];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = Y * map.width + X;
        if (!seen.has(k) && api.canMove(project, map, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
      }
    }
    const goals = [...spec.targets, ...(spec.exits ?? []).map((e) => e.at)];
    const blocked = goals.filter(([x, y]) => !seen.has(y * map.width + x));
    // Open floor that the entrance cannot reach is a design error unless the plan names it (cells behind bars, pits).
    let walkable = 0;
    const stranded = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const f = api.tilePassability(tilesets[map.tilesetId], map.lowerTiles[y * map.width + x], map.upperTiles[y * map.width + x]);
      if (!(f.up || f.down || f.left || f.right)) continue;
      // The lava face's top row (103) is flagged passable on the sheet; it is wall art, not floor.
      if (WALL_FACE_TOPS.has(map.lowerTiles[y * map.width + x]) && map.upperTiles[y * map.width + x] === -1) continue;
      walkable++;
      if (!seen.has(y * map.width + x)) stranded.push([x, y]);
    }
    const onWallTop = [...seen].filter((k) => WALL_FACE_TOPS.has(map.lowerTiles[k]) && map.upperTiles[k] === -1).map((k) => [k % map.width, Math.floor(k / map.width)]);
    if (onWallTop.length) console.error(spec.id, "wall top reachable:", JSON.stringify(onWallTop));
    report.push({ id: spec.id, entry: spec.entry, targets: spec.targets, exits: spec.exits ?? [], reachable: seen.size, walkable, stranded, blocked, onWallTop, ...(spec.sealed ? { sealed: spec.sealed } : {}) });
  }
  const bad = report.filter((r) => r.blocked.length);
  if (bad.length) console.error("unreachable:", JSON.stringify(bad));
  if (!process.env.DUNGEON_LAX) assert(!bad.length, "unreachable goals");
  fs.mkdirSync(OUT, { recursive: true });
  const plans = places.map(({ spec, placements }) => {
    const { art: _a, overlay: _o, rails: _r, ...rest } = spec;
    return { ...rest, tilesetId: maps[spec.id].tilesetId, placements };
  });
  if (!ONLY) {
    fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ plans, maps, tilesets }) + "\n");
    fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  } else fs.writeFileSync(`${OUT}/catalog.partial.json`, JSON.stringify({ plans, maps, tilesets }) + "\n");
  console.log(report.map((r) => `${r.id} ${maps[r.id].width}x${maps[r.id].height} reach ${r.reachable}/${r.walkable} ${JSON.stringify(places.find((p) => p.spec.id === r.id).dressing ?? "")}${r.stranded.length ? " stranded " + JSON.stringify(r.stranded.slice(0, 6)) : ""}`).join("\n"));
});
