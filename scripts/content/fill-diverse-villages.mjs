// Village fullness (revision 14, the user-approved "B" of claude-viz/village-fullness.html) for the diverse forest
// villages, applied to a finished catalog:
//  1. household yards: each house's activity becomes its whole 3–5 piece kit (prop-programs.json), plus a flower
//     box or pot on each side of the door with the door front kept clear (placeDoorFlanks);
//  2. a plaza round the village well: benches, flower boxes, stone lanterns (fullness-programs.json);
//  3. compaction: empty grass/forest bands are removed by object-aware seam carving (lib/village-compact.mjs) —
//     houses, landmarks, props, access cells, stairs, falls and bridges move rigidly; every coordinate of the plan
//     (houses, doors, civic places, landmarks, cliffs, stairs, access, roads …) is mapped onto the smaller map;
//     roads and water are re-autotiled, the canopy is re-shaped with whole trunks (refitForestTrunks) and shaded;
//  4. ground: tall-grass clumps by the forest, wildflowers/bushes in threes, 2–3 tree clumps in front of straight
//     forest edges (lib/village-fullness.mjs).
// Every step re-checks that every door, stair, bridge end, landmark gate and civic use cell is reachable from the
// start, that the terraces are reachable only by their stairs, and the catalog's own household/civic/cliff checks.
// Usage: node scripts/content/fill-diverse-villages.mjs <catalog-before.json> <catalog-out.json> [--only=mapId]
//   (the input is the revision-13 catalog: git show afd4fb604:tiledata/forest-villages/diverse/catalog.json)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { compactVillage, reautotile } from "./lib/village-compact.mjs";
import { placeHouseholdProps, placeDoorFlanks, inspectHouseholdProps } from "./lib/village-household-props.mjs";
import { inspectCivicProps } from "./lib/village-civic-props.mjs";
import { cliffColumns, inspectVillageCliffs } from "./lib/village-cliffs.mjs";
import { placePlaza, placeTreeClumps, fillNaturalGaps, emptiness, rng, cellsOf } from "./lib/village-fullness.mjs";
import { pruneUnowned } from "./lib/village-ownership.mjs";
import { reshapePools } from "./lib/village-pools.mjs";

const args = process.argv.slice(2), only = args.find((a) => a.startsWith("--only="))?.slice(7);
const [input, output] = args.filter((a) => !a.startsWith("--"));
if (!input || !output) throw Error("Usage: fill-diverse-villages.mjs <catalog-before.json> <catalog-out.json> [--only=mapId]");
const catalog = JSON.parse(fs.readFileSync(input, "utf8"));
const DIR = "tiledata/forest-villages/diverse";
const programs = JSON.parse(fs.readFileSync(`${DIR}/fullness-programs.json`, "utf8")).villages;
const parts = JSON.parse(fs.readFileSync("tiledata/tilesets/forest_harmony/dewbank-village/parts.json")).props;
const extra = JSON.parse(fs.readFileSync(`${DIR}/extra-parts.json`));
parts.push(...extra.props);
for (const name of extra.oversized.names) parts.splice(parts.findIndex((p) => p.name === name), 1);
const templates = {};
for (const list of Object.values(JSON.parse(fs.readFileSync(`${DIR}/retained-vegetation.json`)))) for (const o of list) {
  const short = o.name.split(" · ")[1];
  templates[short] ??= { name: o.name, w: o.w, h: o.h, lower: o.lower, upper: o.upper };
}
const ts = catalog.tileset, group = (id) => ts.autotileGroups.find((g) => g.id === id);
const grove = group("forest_harmony_grove_47"), roadGroup = group("forest_harmony_road_47"), lakeGroup = group("forest_harmony_lake_47"), tallGrass = group("builtin_tall_grass");
const { forestCanopyTiles } = await withTsModule("src/project/defaults/forestGrove.ts", "fill-grove.mjs", (m) => m);
const { FOREST_TRUNK_TILES } = await withTsModule("src/editor/tools/village/forestTrunkTiles.ts", "fill-trunks.mjs", (m) => m);
const forest = await withTsModule("src/editor/tools/village/forestContour.ts", "fill-forest.mjs", (m) => m);
const reach = await withTsModule("src/project/lint/reachability.ts", "fill-reach.mjs", (m) => m);
const CAN = forestCanopyTiles(grove), TRUNK = FOREST_TRUNK_TILES, ROOTS = new Set([1430, 1431, 1432, 1433, 1461, 1462, 1463]);
const ROAD = new Set(Object.values(roadGroup.variantMap)), LAKE = new Set(Object.values(lakeGroup.variantMap));
const WET = new Set([...LAKE, catalog.riverTiles.fall, catalog.riverTiles.bridgeTop, catalog.riverTiles.bridgeBottom]);
const CLIFF_TILES = new Set(Object.values(catalog.cliffBindings));
const passable = (t) => t < 0 || Object.values(ts.passability[t] ?? { up: false }).every(Boolean);
const rect = (o) => cellsOf({ x: o.x, y: o.y, w: o.w, h: o.h });

// Seams first run loose (a corridor or a one-cell wall may be cut); if any access, terrace or catalog check then
// fails, the village is redone from its input with the corridor/wall rules on (strict).
for (const [n, original] of catalog.plans.entries()) {
  if (only && original.id !== only) continue;
  assert(!original.fullness, "Already filled: " + original.id);
  const map0 = catalog.maps[original.id];
  let done = null;
  for (const strict of [false, true]) {
    const plan = structuredClone(original);
    catalog.maps[plan.id] = structuredClone(map0);
    try { fillVillage(plan, strict); done = plan; break; }
    catch (error) { if (strict || !(error instanceof assert.AssertionError)) throw error; console.error(plan.id, "loose seams failed, retrying strict:", error.message.slice(0, 160)); }
  }
  catalog.plans[n] = done;
}
function fillVillage(plan, strict) {
  const spec = programs[plan.id];
  assert(spec, "No fullness program for " + plan.id);
  let m = catalog.maps[plan.id];
  const random = rng(plan.seed * 7 + 14);
  const project = () => ({ tilesets: { [ts.id]: ts }, maps: { [m.id]: m } });
  const W0 = m.width, H0 = m.height;
  const key = (x, y) => x + "," + y;
  const seenNow = () => reach.computeReachableCells(project(), m, plan.start.x, plan.start.y);
  const reachOk = (seen) => plan.access.every((a) => seen.has(key(a.x, a.y)))
    && plan.placements.filter((o) => o.kind === "prop").every((o) => rect(o).some((c) => reach.isAdjacentOrOn(seen, c.x, c.y)))
    && plan.placements.filter((o) => o.kind === "civic-prop" && o.useAt).every((o) => seen.has(key(o.useAt.x, o.useAt.y)));
  const stamp = (name, x, y, w, h, lower, upper, kind) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = (y + dy) * m.width + x + dx, j = dy * w + dx;
      if (lower) m.lowerTiles[i] = lower[j];
      m.upperTiles[i] = upper[j];
    }
    plan.placements.push({ name, x, y, w, h, kind, lower: lower ?? "KEEP", upper });
  };

  // 0. No grass crest: the faint /—\ line of grass joins on flat grass read as half-laid tiles (review 2026-09-24).
  const crestCells = plan.grassJoins.length;
  for (const j of plan.grassJoins) m.lowerTiles[j.y * m.width + j.x] = 240;
  plan.grassJoins = [];
  plan.crest = null;

  // 1. Household yards: clear the old 2–3 piece yards, place the whole kits, then the door flanks.
  for (const o of plan.placements.filter((q) => q.kind === "prop")) for (const c of rect(o)) m.upperTiles[c.y * m.width + c.x] = -1;
  plan.placements = plan.placements.filter((q) => q.kind !== "prop");
  const roads = new Set(plan.roadCells), cliffCells = new Set(plan.cliffColumns.flatMap((c) => Array.from({ length: c.height + 1 }, (_, d) => (c.y + d) * m.width + c.x)));
  const household = placeHouseholdProps({ map: m, houses: plan.houses, parts, roads, access: plan.access, cliffCells, reachable: seenNow(), stamp, sites: plan.activitySites ?? {} });
  for (const o of household.placed) Object.assign(plan.placements.find((p) => p.kind === "prop" && p.x === o.x && p.y === o.y), { ownerId: o.ownerId, kit: o.kit, purpose: o.purpose, anchor: o.anchor, side: o.side });
  {
    const seen = seenNow();
    const rejected = new Set(plan.placements.filter((o) => o.kind === "prop" && !rect(o).some((c) => reach.isAdjacentOrOn(seen, c.x, c.y))).map((o) => o.ownerId));
    for (const o of plan.placements.filter((q) => q.kind === "prop" && rejected.has(q.ownerId))) for (const c of rect(o)) m.upperTiles[c.y * m.width + c.x] = -1;
    plan.placements = plan.placements.filter((q) => !(q.kind === "prop" && rejected.has(q.ownerId)));
    plan.yards = household.yards.filter((y) => !rejected.has(y.ownerId));
  }
  const flanks = placeDoorFlanks({ map: m, houses: plan.houses, parts, roads, access: plan.access, stamp,
    accept: (o) => { const seen = seenNow(); return reachOk(seen) && rect(o).some((c) => reach.isAdjacentOrOn(seen, c.x, c.y)); } });
  for (const o of flanks) Object.assign(plan.placements.find((p) => p.kind === "prop" && p.x === o.x && p.y === o.y && !p.kit), { ownerId: o.ownerId, kit: o.kit, purpose: o.purpose, anchor: o.anchor, side: o.side });
  assert(reachOk(seenNow()), "Yards block access " + plan.id);

  // 2. Plaza round the well.
  const zone = plan.civicPlaces.find((z) => z.id === spec.plaza.zone);
  const center = plan.placements.find((o) => o.kind === "civic-prop" && o.placeId === zone.id && o.name === spec.plaza.center);
  assert(zone && center, "Plaza centre missing " + plan.id);
  const inRect = (o, x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
  const accessAt = new Set(plan.access.map((a) => key(a.x, a.y)));
  const plazaFree = (x, y) => {
    if (x < 1 || y < 1 || x >= m.width - 1 || y >= m.height - 1) return false;
    const i = y * m.width + x;
    return m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !roads.has(i)
      && ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => accessAt.has(key(x + dx, y + dy)))
      && !plan.houses.some((h) => inRect(h, x, y)) && !(plan.landmarks ?? []).some((l) => inRect(l, x, y));
  };
  const plaza = placePlaza({ map: m, plan, parts, zone, center, items: spec.plaza.items, free: plazaFree,
    accept: (o) => {
      const seen = seenNow();
      if (!reachOk(seen)) return null;
      return rect(o).flatMap((c) => [{ x: c.x, y: c.y + 1 }, { x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y - 1 }]).find((c) => seen.has(key(c.x, c.y))) ?? null;
    } });
  for (const o of plaza) plan.access.push({ role: "civic-use", ...o.useAt, placeId: o.placeId, propId: o.id });
  assert(reachOk(seenNow()), "Plaza blocks access " + plan.id);

  // 3. Compaction.
  const W = m.width, idx = (x, y) => y * W + x, hard = new Set(), cliff = new Set(), near = new Set();
  const addRect = (o, set = hard) => { for (const c of rect(o)) if (c.x >= 0 && c.y >= 0 && c.x < W && c.y < m.height) set.add(idx(c.x, c.y)); };
  for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements, ...(plan.yards ?? [])]) addRect(o);
  for (const a of plan.access) hard.add(idx(a.x, a.y));
  for (const z of plan.civicPlaces) if (z.site) addRect(z.site);
  for (const [x, y, h] of plan.stairs) addRect({ x, y, w: 2, h: h + 1 });
  for (const f of plan.falls ?? []) addRect({ x: f.x, y: f.y, w: 1, h: f.height + 1 });
  for (const [x, y, w] of plan.bridges ?? []) addRect({ x, y, w, h: 2 });
  if (plan.dock) addRect({ x: plan.dock[0], y: plan.dock[1], w: plan.dock[2], h: plan.dock[3] });
  if (plan.cave) hard.add(idx(plan.cave[0], plan.cave[1]));
  for (const j of plan.grassJoins) hard.add(idx(j.x, j.y));
  if (plan.crest) addRect({ x: plan.crest.x, y: plan.crest.y, w: plan.crest.width, h: plan.crest.shoulder + 1 });
  for (const c of plan.cliffColumns) for (let d = 0; d <= c.height; d++) if (!hard.has(idx(c.x, c.y + d))) cliff.add(idx(c.x, c.y + d));
  for (const h of plan.houses) addRect({ x: h.x - 2, y: h.y - 2, w: h.w + 4, h: h.h + 4 }, near);
  const classOf = (i) => {
    const l = m.lowerTiles[i], u = m.upperTiles[i];
    if (CAN.has(u)) return "canopy";
    if (u !== -1) return "other";
    if (l === 240 || TRUNK.has(l)) return "grass";
    if (ROAD.has(l)) return "road";
    if (LAKE.has(l)) return "water";
    return "other";
  };
  const walk = (i) => passable(m.lowerTiles[i]) && passable(m.upperTiles[i]);
  // Every kept seam: all access cells reachable, every yard prop beside reachable ground, and with the stairs shut
  // no terrace cell reachable (cells followed by their original index).
  const accessIdx = plan.access.map((a) => idx(a.x, a.y)), propIdx = plan.placements.filter((o) => o.kind === "prop").map((o) => rect(o).map((c) => idx(c.x, c.y)));
  const stairIdx = plan.stairs.flatMap(([x, y, h]) => rect({ x, y, w: 2, h: h + 1 }).map((c) => idx(c.x, c.y)));
  const plateauIdx = plan.cliffColumns.flatMap((c) => Array.from({ length: Math.max(0, c.y - 5) }, (_, k) => idx(c.x, 5 + k)));
  // Re-autotile roads and water, re-shape the canopy with whole trunks; objects and access cells take no forest.
  const keptIdx = new Set(plan.access.map((a) => idx(a.x, a.y)));
  for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements, ...(plan.yards ?? [])]) for (const c of rect(o)) keptIdx.add(idx(c.x, c.y));
  const finish = (sm, pos) => {
    reautotile(sm, roadGroup, "lower", ROAD);
    reautotile(sm, lakeGroup, "lower", WET);
    const kept = new Set([...keptIdx].map((i) => { const p = pos(i); return p.y * sm.width + p.x; }));
    const at2 = (x, y) => y * sm.width + x;
    return forest.refitForestTrunks(sm, { x: 0, y: 0, w: sm.width, h: sm.height }, grove, 240,
      (x, y) => sm.lowerTiles[at2(x, y)] === 240 && sm.upperTiles[at2(x, y)] === -1 && !kept.has(at2(x, y)));
  };
  const check = ({ map: raw, at: pos }) => {
    const sm = structuredClone(raw);
    finish(sm, pos);
    const pr = { tilesets: { [ts.id]: ts }, maps: { [sm.id]: sm } }, s = pos(idx(plan.start.x, plan.start.y));
    const seen = reach.computeReachableCells(pr, sm, s.x, s.y), k = (i) => { const p = pos(i); return key(p.x, p.y); };
    if (!accessIdx.every((i) => seen.has(k(i)))) return false;
    if (!propIdx.every((cells) => cells.some((i) => { const p = pos(i); return reach.isAdjacentOrOn(seen, p.x, p.y); }))) return false;
    const shut = { ...sm, lowerTiles: [...sm.lowerTiles] };
    for (const i of stairIdx) { const p = pos(i); shut.lowerTiles[p.y * sm.width + p.x] = catalog.cliffBindings[172]; }
    const below = reach.computeReachableCells({ tilesets: pr.tilesets, maps: { [sm.id]: shut } }, shut, s.x, s.y);
    return !plateauIdx.some((i) => { const p = pos(i); return p && below.has(key(p.x, p.y)); });
  };
  const carved = compactVillage(m, { check, hard, cliff, near, soft: classOf, walk, target: { w: spec.target[0], h: spec.target[1] }, strict });
  const P = (x, y) => carved.place(x, y);
  const mapPoint = (o) => { const p = P(o.x, o.y); o.x = p.x; o.y = p.y; };
  const walkXY = (v) => {
    if (Array.isArray(v)) { v.forEach(walkXY); return; }
    if (!v || typeof v !== "object") return;
    if (typeof v.x === "number" && typeof v.y === "number") mapPoint(v);
    for (const [k, c] of Object.entries(v)) if (!["lower", "upper", "tiles", "source"].includes(k)) walkXY(c);
  };
  const oldColumns = plan.cliffs.map((profile) => cliffColumns(profile));
  plan.cliffColumns = plan.cliffColumns.filter((c) => carved.survives(idx(c.x, c.y)));
  for (const field of ["start", "entrance", "crest", "houses", "landmarks", "placements", "activitySites", "civicPlaces", "yards", "access", "grassJoins", "falls", "cliffColumns"]) walkXY(plan[field]);
  const pair = (a) => { const p = P(a[0], a[1]); a[0] = p.x; a[1] = p.y; };
  for (const field of ["stairs", "spine", "patches", "clearings", "ponds", "farms", "bridges"]) for (const a of plan[field] ?? []) pair(a);
  if (plan.dock) pair(plan.dock);
  if (plan.cave) pair(plan.cave);
  if (plan.river) { plan.river.points.forEach(pair); (plan.river.pools ?? []).forEach(pair); }
  plan.cliffs = plan.cliffs.map((profile, n) => {
    const cols = oldColumns[n].filter((c) => carved.survives(idx(c.x, c.y))).map((c) => carved.at(idx(c.x, c.y)));
    // Fewest vertices whose interpolation (cliffColumns) gives back every column.
    const points = [[cols[0].x, cols[0].y]];
    let a = 0;
    for (let b = 2; b <= cols.length; b++) {
      const fits = b < cols.length && cols.slice(a, b + 1).every((c) => c.y === Math.round(cols[a].y + (cols[b].y - cols[a].y) * (c.x - cols[a].x) / (cols[b].x - cols[a].x)));
      if (!fits) { points.push([cols[b - 1].x, cols[b - 1].y]); a = b - 1; }
    }
    const out = { ...profile, points };
    for (const side of ["leftFrom", "rightFrom"]) if (typeof profile[side] === "number") out[side] = P(side === "leftFrom" ? profile.points[0][0] : profile.points.at(-1)[0], profile[side]).y;
    return out;
  });
  plan.roadCells = plan.roadCells.filter((i) => carved.survives(i)).map((i) => { const p = carved.at(i); return p.y * carved.map.width + p.x; });
  m = carved.map;
  catalog.maps[plan.id] = m;
  plan.width = m.width;
  plan.height = m.height;
  // Cliff columns must come back from the profiles exactly (the validator paints them from `cliffs`).
  const fromProfiles = plan.cliffs.flatMap((p) => cliffColumns(p).map((c) => c.x + "," + c.y + "," + c.side));
  assert.deepEqual(fromProfiles.sort(), plan.cliffColumns.map((c) => c.x + "," + c.y + "," + c.side).sort(), "Cliff profile drift " + plan.id);
  const refit = finish(m, carved.at);
  const W2 = m.width, at = (x, y) => y * W2 + x;
  const keepRect = (o, set, pad = 0) => { for (let y = o.y - pad; y < o.y + o.h + pad; y++) for (let x = o.x - pad; x < o.x + o.w + pad; x++) if (x >= 0 && y >= 0 && x < W2 && y < m.height) set.add(at(x, y)); };
  assert(reachOk(seenNow()), "Compaction blocks access " + plan.id + " " + JSON.stringify(plan.access.filter((a) => !seenNow().has(key(a.x, a.y)))));

  // 4. Plunge pools get an irregular shore (the authored integer ellipses drew as crosses), then every life prop
  // without a reason within two cells is removed (lib/village-ownership.mjs).
  const objectCells = new Set();
  for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements, ...(plan.yards ?? [])]) keepRect(o, objectCells, 1);
  const roadNow = () => { const r = new Set(); m.lowerTiles.forEach((t, i) => { if (ROAD.has(t) || t === catalog.riverTiles.bridgeTop || t === catalog.riverTiles.bridgeBottom) r.add(i); }); return r; };
  const accessRing = new Set();
  for (const a of plan.access) keepRect({ x: a.x, y: a.y, w: 1, h: 1 }, accessRing, 1);
  const roadCellsNow = roadNow();
  const pools = reshapePools({ map: m, pools: plan.river?.pools ?? [], lakeGroup, wet: WET, random,
    canWet: (x, y) => { const i = at(x, y); return m.lowerTiles[i] === 240 && m.upperTiles[i] === -1 && !objectCells.has(i) && !accessRing.has(i)
      && ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => roadCellsNow.has(at(x + dx, y + dy))); },
    canDry: () => true });
  assert(reachOk(seenNow()), "Pools block access " + plan.id);
  const water = new Set(); m.lowerTiles.forEach((t, i) => { if (LAKE.has(t) || t === catalog.riverTiles.fall) water.add(i); });
  const roadsForOwners = roadNow();
  for (const [x, y, h] of plan.stairs) for (let d = -1; d <= h + 1; d++) for (const dx of [0, 1]) roadsForOwners.add(at(x + dx, y + d));
  const pruned = pruneUnowned({ map: m, plan, roads: roadsForOwners, water, inspect: () => [...inspectCivicProps(m, plan), ...inspectHouseholdProps(m, plan)] });

  // 5. Ground: 2–3 tree clumps in front of straight forest edges, then natural scenes (tree + bush, thickets,
  // flowering shrubs, rocks with a bush) until the gate passes. No tall grass: the old 243–335 art is banned until
  // the E/F/G redraw lands (placeGrassPatch is ready for it).
  // A ground piece may not cut off any walkable ground: the count of walkable cells the start cannot reach never grows.
  const orphans = () => { const s = seenNow(); let w = 0; for (let i = 0; i < m.lowerTiles.length; i++) if (walk(i)) w++; return { ok: reachOk(s), orphans: w - s.size }; };
  let orphanCount = orphans().orphans;
  const noSealing = () => { const r = orphans(); if (!r.ok || r.orphans > orphanCount) return false; orphanCount = r.orphans; return true; };
  const reserved = new Set();
  for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements, ...(plan.yards ?? [])]) keepRect(o, reserved, ["prop", "civic-prop"].includes(o.kind) ? 0 : 1);
  for (const a of plan.access) keepRect({ x: a.x, y: a.y, w: 1, h: 1 }, reserved, 1);
  for (let i = 0; i < W2 * m.height; i++) {
    const l = m.lowerTiles[i], u = m.upperTiles[i];
    if (WET.has(l) || CLIFF_TILES.has(u) || CLIFF_TILES.has(l) || ROAD.has(l)) keepRect({ x: i % W2, y: Math.floor(i / W2), w: 1, h: 1 }, reserved, 1);
  }
  const bare = (x, y) => x >= 1 && y >= 1 && x < W2 - 1 && y < m.height - 1 && m.lowerTiles[at(x, y)] === 240 && m.upperTiles[at(x, y)] === -1 && !reserved.has(at(x, y));
  const clumps = placeTreeClumps({ map: m, bare, isForest: (x, y) => x >= 0 && y >= 0 && x < W2 && y < m.height && CAN.has(m.upperTiles[at(x, y)]),
    rootRow: (x, y) => x >= 0 && y >= 0 && x < W2 && y < m.height && ROOTS.has(m.lowerTiles[at(x, y)]), templates, count: spec.trees, random,
    accept: noSealing });
  clumps.forEach((stamps, k) => { for (const s of stamps) { plan.placements.push({ name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, kind: "vegetation", clump: k + 1, lower: s.lower, upper: s.upper }); keepRect(s, reserved, 1); } });
  // The fill gate (FILL-RULES: town maxSq ≤ 4, screen ≤ 40%).
  const PLAIN = new Set([240, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);
  const isPlain = (x, y) => m.upperTiles[at(x, y)] === -1 && PLAIN.has(m.lowerTiles[at(x, y)]);
  const objects = new Set(), accessCells = new Set(plan.access.map((a) => at(a.x, a.y)));
  for (const o of [...plan.houses, ...(plan.landmarks ?? []), ...plan.placements, ...(plan.yards ?? [])]) keepRect(o, objects, 0);
  const before = emptiness(m, isPlain);
  const gaps = fillNaturalGaps({ map: m, isPlain, templates, random, accept: noSealing,
    // Solid pieces keep a ring off roads, water, cliffs, doors and objects; flowers only avoid access cells and objects.
    take: (x, y, solid) => !accessCells.has(at(x, y)) && !objects.has(at(x, y)) && (!solid || bare(x, y)) });
  gaps.pieces.forEach((p, k) => { for (const s of p.stamps) plan.placements.push({ name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, kind: "vegetation", scene: k + 1, lower: s.lower ?? "KEEP", upper: s.upper }); });

  // Final checks, then the plan's derived fields.
  const seen = seenNow();
  assert(reachOk(seen), "Blocked " + plan.id);
  {
    const shut = structuredClone(m), face = catalog.cliffBindings[172];
    for (const [x, y, h] of plan.stairs) for (let yy = y; yy <= y + h; yy++) for (let xx = x; xx < x + 2; xx++) shut.lowerTiles[at(xx, yy)] = face;
    const below = reach.computeReachableCells({ tilesets: { [ts.id]: ts }, maps: { [m.id]: shut } }, shut, plan.start.x, plan.start.y);
    for (const c of plan.cliffs) {
      const [x0] = c.points[0], [x1] = c.points.at(-1);
      const tops = new Map(plan.cliffColumns.filter((k) => k.x >= x0 && k.x <= x1).map((k) => [k.x, k.y]));
      const leak = [...below].map((k) => k.split(",").map(Number)).find(([x, y]) => tops.has(x) && y >= (c.north ?? 5) && y < tops.get(x));
      assert(!leak, "Terrace reachable without stairs " + plan.id + " " + leak);
    }
  }
  for (const z of plan.civicPlaces) if (z.site) z.site.tiles = rect(z.site).map((c) => m[z.site.layer + "Tiles"][at(c.x, c.y)]);
  const errors = [...inspectCivicProps(m, plan), ...inspectHouseholdProps(m, plan), ...inspectVillageCliffs(m, plan, catalog.cliffBindings)];
  assert.equal(errors.length, 0, plan.id + " " + JSON.stringify(errors.slice(0, 8)));
  plan.grove = { canopyCells: refit.canopyCells, trunkRuns: refit.trunkRuns };
  plan.reachableCells = seen.size;
  plan.fullness = {
    revision: 14, before: { width: W0, height: H0 }, after: { width: m.width, height: m.height }, removed: carved.removed,
    yards: plan.yards.length, yardProps: plan.placements.filter((o) => o.kind === "prop" && o.kit !== "doorway").length,
    doorFlanks: flanks.length, plaza: plaza.map((o) => o.name), treeClumps: clumps.length, crestCellsRemoved: crestCells,
    pools, unownedRemoved: pruned,
    scenes: gaps.pieces.map((p) => ({ name: p.name, at: p.stamps[0] ? [p.stamps[0].x, p.stamps[0].y] : p.flowers[0].slice(0, 2), flowers: p.flowers.length })),
    emptiness: { beforeGapFill: { maxSq: before.maxSq, screen: +before.screen.toFixed(3) }, after: { maxSq: gaps.maxSq, screen: +gaps.screen.toFixed(3) } },
  };
  m.layoutPlan = { ...m.layoutPlan, regions: plan.houses, entrance: plan.entrance, civicPlaces: plan.civicPlaces, landmarks: plan.landmarks ?? [] };
  console.log(plan.id, `${W0}x${H0} -> ${m.width}x${m.height}`, JSON.stringify(carved.removed), { yards: plan.fullness.yards, yardProps: plan.fullness.yardProps, doorFlanks: flanks.length, plaza: plaza.length, trees: clumps.length, crest: crestCells, pools: JSON.stringify(pools.map((p) => [p.added, p.dried])), unowned: pruned.length, scenes: gaps.pieces.length, empty: JSON.stringify(plan.fullness.emptiness), reachable: seen.size });
}
fs.writeFileSync(output, JSON.stringify(catalog));
