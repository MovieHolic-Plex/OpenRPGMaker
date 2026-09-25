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
    if (spec.topUp) {
      const t = topUp(map, spec, { passable, reach, protect: routes(spec, map, tilesetId), clear, parts });
      if (t.length) placements.push({ kind: "natural-clumps", note: "빈칸 게이트를 넘기려 가장 빈 화면에 덧붙인 자연 덩이(이미 있는 벽·덩이에 붙여 자라게) — 통로는 막지 않음", clumps: t });
    }
    // A floor cell or two left cut off at a water edge (a rock put back by the fill pass turns into floor again when it
    // would float) gets a boulder: it is rock you cannot stand behind, not a pocket you cannot reach.
    {
      const seen = reach(map), stuck = [];
      for (let i = 0; i < map.width * map.height; i++) {
        if (seen.has(i) || map.upperTiles[i] !== -1 || ![421, 187, 108, 301, 67, 110, 141, 111].includes(map.lowerTiles[i])) continue;
        const f = api.tilePassability(ts, map.lowerTiles[i], -1);
        if (f.up || f.down || f.left || f.right) stuck.push(i);
      }
      if (stuck.length && stuck.length <= 6) {
        const chasm = kit.group("chasm"), wet = new Set(kit.members(chasm)), Wd = map.width;
        let pooled = false;
        for (const i of stuck) {
          if ([1, -1, Wd, -Wd].some((d) => wet.has(map.lowerTiles[i + d]))) { map.lowerTiles[i] = 190; pooled = true; }
          else map.upperTiles[i] = parts.alias["int:rocks"];
        }
        if (pooled) kit.autotile(map, chasm, kit.members(chasm));
        placements.push({ kind: "sealed-pocket", note: "닿지 않는 물가 한두 칸은 물로, 그 밖은 바위 더미로 메움", cells: stuck.map((i) => [i % Wd, Math.floor(i / Wd)]) });
      }
    }
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

// Natural clumps for the emptiness gate, grown where the barest screen is — each piece sits next to something that is
// already there (a wall, a heap, a stand), so the floor fills from the edges in as a cave does, not as confetti.
function topupPalettes() {
  const P1 = (t) => ({ cells: [[0, 0, t]] }), P2 = (a, b) => ({ cells: [[0, 0, a], [0, 1, b]] }), P4 = (a, b, c, d) => ({ cells: [[0, 0, a], [1, 0, b], [0, 1, c], [1, 1, d]] });
  return {
  cave: [P2(261, 291), P1(288), P1(290), P4(322, 323, 352, 353), P4(318, 319, 348, 349), P1(412)],
  sea: [P1(288), P4(318, 319, 348, 349), P1(412), P2(261, 291), P1(290)],
  ice: [P2(262, 292), P1(289), P1(413), P1(232), P4(322, 323, 352, 353)],
  lava: [P1(288), P1(412), P4(318, 319, 348, 349), P2(261, 291)],
  lair: [P1(288), P2(261, 291), P4(318, 319, 348, 349)],
  crypt: [P1(383), P1(299), { cells: [[0, 0, 259], [1, 0, 260]] }, P1(382)],
  // element temples: crystal growth in the sheet's own crystal colour (green / cyan / amber / red / violet…)
  shrine: [P2(262, 292), P1(289), P1(413), P1(289), P2(262, 292)],
  };
}
function topUp(m, spec, { passable, reach, protect, clear, parts }) {
  const W = m.width, H = m.height, plain = new Set([421, 187, 108, 301, 67, 110, 141]);
  let pal = topupPalettes()[spec.topUp === true ? "cave" : spec.topUp];
  if (spec.topUpParts) pal = [...pal, ...spec.topUpParts.map((k) => { const s = parts.stamps[k]; return { cells: s.upper.flatMap((r, dy) => r.map((t, dx) => [dx, dy, t])).filter(([, , t]) => t !== null) }; })];
  let seed = [...spec.id].reduce((a, c) => (a * 131 + c.charCodeAt(0)) >>> 0, 17);
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const bare = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.upperTiles[y * W + x] === -1 && plain.has(m.lowerTiles[y * W + x]);
  const free = (x, y) => bare(x, y) && !protect.has(y * W + x) && !clear.has(y * W + x);
  const log = [];
  let reached = reach(m);
  for (let n = 0; n < 40; n++) {
    const s = bareStats(m);
    if (s.sq <= 4 && s.screen <= 0.37) break;
    const [wx, wy] = s.sq > 4 ? [s.at[0] - 1, s.at[1] - 1] : s.win;
    const [ww, wh] = s.sq > 4 ? [s.sq + 2, s.sq + 2] : [17, 13];
    const cand = [];
    for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
      if (!free(x, y)) continue;
      let hard = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !bare(x + dx, y + dy)) hard++;
      if (hard) cand.push([hard + rnd() * 2, x, y]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    let done = false;
    for (const [, x, y] of cand.slice(0, 12)) {
      for (const piece of [...pal].map((p) => [p.cells.length + rnd(), p]).sort((a, b) => b[0] - a[0]).map(([, p]) => p)) {
        const cells = piece.cells.map(([dx, dy, t]) => [x + dx, y + dy, t]);
        if (!cells.every(([a, b]) => free(a, b))) continue;
        cells.forEach(([a, b, t]) => { m.upperTiles[b * W + a] = t; });
        if (cells.some(([, , t]) => !passable(t))) {
          const now = reach(m), own = new Set(cells.map(([a, b]) => b * W + a));
          if ([...reached].some((k) => !own.has(k) && !now.has(k))) { cells.forEach(([a, b]) => { m.upperTiles[b * W + a] = -1; }); continue; }
          reached = now;
        }
        log.push({ x, y, tiles: cells.map(([a, b, t]) => [a - x, b - y, t]) });
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) break;
  }
  return log;
}
