// Author the atlas dungeons (tiledata/atlas-dungeons): ~100 floors and rooms of a normal fantasy RPG — tutorial cave,
// mine levels, catacombs, sewer maze, ghost ship, haunted manor, four element temples, ice/lava/sea caves, pyramid,
// sky and trial towers, ancient machine ruins, the rest of the demon castle, dragon nest, spider nest, bandit hideout,
// abandoned fort, secret lab, dream world, bonus abyss. Terrain and placement only — no events.
//
// Same grammar and checks as author-rpg-dungeons.mjs (rpg-dungeons/kit.mjs walls from the open mask, autotiled
// materials, dress.mjs heaps, runtime canMove reachability), on the dungeon family (rpg-dungeons/family.mjs: kit grafts
// 480~488 + the atlas parts 510~) and the thirteen atlas sheets of build-atlas-dungeon-sheets.py.
// Usage: node scripts/content/author-atlas-dungeons.mjs            (ATLAS_ONLY=id,… → catalog.partial.json; ATLAS_LAX=1)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { createKit, lines } from "./rpg-dungeons/kit.mjs";
import { dungeonFamily, loadParts } from "./rpg-dungeons/family.mjs";
import { dressFloor, bareStats } from "./rpg-dungeons/dress.mjs";
import { carveOutcrops } from "./rpg-dungeons/outcrops.mjs";
import { atlasPlans } from "./atlas-dungeons/plans.mjs";

const OUT = "tiledata/atlas-dungeons";
const SERIES = process.env.ATLAS_SERIES?.split(",");
const ONLY_IDS = process.env.ATLAS_ONLY?.split(",");
const ONLY = ONLY_IDS || SERIES ? true : null;
const WALL_FACE_TOPS = new Set([103, 102, 104]);

await withTsModule("scripts/content/lib/rpg-dungeons-entry.ts", "atlas-dungeons-entry.mjs", async (api) => {
  const base = api.createBlankProject();
  const parts = loadParts();
  const sheets = JSON.parse(fs.readFileSync(`${OUT}/sheets.json`, "utf8"));
  const family = (id, name, texture, drawn = []) => dungeonFamily(base, { id, name, texture, drawn, parts });
  const tilesets = {
    oprn_dungeon_stone: family("oprn_dungeon_stone", "던전 · EasyRPG + 계단·상자·광차 이식", "tex_easyrpg_chipset_dungeon"),
    oprn_dungeon_desert: family("oprn_dungeon_desert", "던전 · 사암 피라미드 (재칠)", "tex_oprn_dungeon_desert", [54, 55, 84, 85, 116, 144].map((t, i) => [t, `파라오 석관 ${i + 1}/6 (직접 그림)`])),
    oprn_dungeon_sea: family("oprn_dungeon_sea", "던전 · 해저 동굴 (재칠)", "tex_oprn_dungeon_sea"),
    oprn_dungeon_lair: family("oprn_dungeon_lair", "던전 · 용의 둥지 (재칠)", "tex_oprn_dungeon_lair"),
    oprn_dungeon_cave: family("oprn_dungeon_cave", "던전 · 동굴 물웅덩이 (재칠)", "tex_oprn_dungeon_cave"),
  };
  for (const s of Object.values(sheets)) tilesets[s.id] = family(s.id, s.name, s.texture);
  const kit = createKit(tilesets.oprn_dungeon_stone, { parts, strictFloor: true });

  const walk = (m, id, tilesetId, entry, parentMap) => {
    const map = { ...m, id, tilesetId }, project = { maps: { [id]: map }, tilesets };
    const W = m.width, start = entry[1] * W + entry[0], seen = new Set([start]), queue = [entry];
    if (parentMap) parentMap.set(start, -1);
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = Y * W + X;
        if (!seen.has(k) && api.canMove(project, map, x, y, X, Y)) { seen.add(k); parentMap?.set(k, y * W + x); queue.push([X, Y]); }
      }
    }
    return seen;
  };
  const routes = (spec, m, tilesetId) => {
    const parent = new Map();
    walk(m, spec.id, tilesetId, spec.entry, parent);
    const keep = new Set();
    for (const [x, y] of [...spec.targets, ...(spec.exits ?? []).map((e) => e.at)])
      for (let k = y * m.width + x; k !== undefined && k >= 0; k = parent.get(k)) keep.add(k);
    return keep;
  };

  const places = [];
  for (const plan of atlasPlans()) {
    if (ONLY_IDS && !ONLY_IDS.includes(plan.id)) continue;
    if (SERIES && !SERIES.includes(plan.series)) continue;
    const tilesetId = plan.tileset ?? "oprn_dungeon_stone", ts = tilesets[tilesetId];
    assert(ts, `${plan.id}: no tileset ${tilesetId}`);
    const passable = (t) => { const f = api.tilePassability(ts, 187, t); return f.up && f.down && f.left && f.right; };
    const reach = (m) => walk(m, plan.id, tilesetId, plan.entry);
    const carved = plan.outcrops
      ? carveOutcrops(plan, { build: (s) => kit.build(s), reach, routes: (m) => routes(plan, m, tilesetId), ...(typeof plan.outcrops === "object" ? plan.outcrops : {}) })
      : { spec: plan, log: [] };
    let spec = carved.spec;
    // Floor the entrance cannot reach becomes rock unless the plan means it (cells behind bars).
    for (let pass = 0; pass < 3 && !spec.sealed; pass++) {
      const probe = kit.build(spec).map, seen = reach(probe), rows = lines(spec.art).map((r) => [...r]);
      let changed = 0;
      for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
        const i = y * probe.width + x;
        if (seen.has(i) || !".,;Rstk".includes(rows[y][x])) continue;
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
    const clear = new Set();
    chars.forEach((row, y) => [...row].forEach((c, x) => { if ((spec.keepClear ?? "tr=w_|q").includes(c)) clear.add(y * map.width + x); }));
    const dressing = spec.dress === false ? { placed: 0, log: [] } : dressFloor(map, spec, { passable, reach, protect: routes(spec, map, tilesetId), clear });
    if (dressing.placed) placements.push({ kind: "dressing", note: "무너진 벽 곁·모서리에 몰아 둔 잔해 덩이(1~3곳) — 통로는 막지 않음", clumps: dressing.log });
    places.push({ spec, map, placements, tilesetId, warnings });
  }

  // ── reachability with the runtime move rule + emptiness numbers ──
  const maps = {}, report = [];
  for (const p of places) {
    const { spec } = p;
    const map = { id: spec.id, name: spec.name, width: p.map.width, height: p.map.height, tileSize: 16, tilesetId: p.tilesetId, lowerTiles: p.map.lowerTiles, upperTiles: p.map.upperTiles, events: [] };
    maps[spec.id] = map;
    const seen = walk(map, spec.id, p.tilesetId, spec.entry);
    const goals = [...spec.targets, ...(spec.exits ?? []).map((e) => e.at)];
    const blocked = goals.filter(([x, y]) => !seen.has(y * map.width + x));
    let walkable = 0;
    const stranded = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const f = api.tilePassability(tilesets[map.tilesetId], map.lowerTiles[i], map.upperTiles[i]);
      if (!(f.up || f.down || f.left || f.right)) continue;
      if (WALL_FACE_TOPS.has(map.lowerTiles[i]) && map.upperTiles[i] === -1) continue;
      walkable++;
      if (!seen.has(i)) stranded.push([x, y]);
    }
    const s = bareStats(map);
    report.push({ id: spec.id, entry: spec.entry, targets: spec.targets, exits: spec.exits ?? [], reachable: seen.size, walkable, stranded, blocked,
      emptiness: { maxSq: s.sq, screen: +s.screen.toFixed(3), win: s.win, at: s.at }, warnings: p.warnings, ...(spec.sealed ? { sealed: spec.sealed } : {}) });
  }
  const bad = report.filter((r) => r.blocked.length);
  if (bad.length) console.error("unreachable:", JSON.stringify(bad.map((r) => [r.id, r.blocked])));
  if (!process.env.ATLAS_LAX) assert(!bad.length, "unreachable goals");
  fs.mkdirSync(OUT, { recursive: true });
  const plans = places.map(({ spec, placements }) => {
    const { art: _a, overlay: _o, rails: _r, ...rest } = spec;
    return { ...rest, tilesetId: maps[spec.id].tilesetId, placements };
  });
  const used = new Set(Object.values(maps).map((m) => m.tilesetId));
  const usedTilesets = Object.fromEntries(Object.entries(tilesets).filter(([id]) => used.has(id)));
  const file = ONLY ? `${OUT}/catalog.partial.json` : `${OUT}/catalog.json`;
  fs.writeFileSync(file, JSON.stringify({ plans, maps, tilesets: usedTilesets }) + "\n");
  fs.writeFileSync(ONLY ? `${OUT}/validation.partial.json` : `${OUT}/validation.json`, JSON.stringify(report, null, 1) + "\n");
  const flag = (r) => (r.emptiness.maxSq > 4 || r.emptiness.screen > 0.4 ? " EMPTY" : "") + (r.stranded.length ? ` stranded ${r.stranded.length}` : "") + (r.blocked.length ? " BLOCKED" : "") + (r.warnings.length ? ` warn ${r.warnings.length}` : "");
  console.log(report.map((r) => `${r.id} ${maps[r.id].width}x${maps[r.id].height} ${maps[r.id].tilesetId.replace("oprn_dungeon_", "")} sq ${r.emptiness.maxSq} scr ${r.emptiness.screen}${flag(r)}`).join("\n"));
  console.log(`${report.length} maps → ${file}`);
});
