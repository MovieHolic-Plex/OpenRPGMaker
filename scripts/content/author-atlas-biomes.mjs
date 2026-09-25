// Author the biome fields of tiledata/atlas-biomes on the atlas biome sheets: every plan (lib/atlas-biome-plans.mjs)
// picks a layout archetype (lib/atlas-biome-layouts.mjs) and a biome; the builder lays terrain, exits and roads, then
// the biome dressing (lib/atlas-biome-themes.mjs): hero clumps, the fill with the biome's own pieces, leafless groves,
// water / sky decorations, cliff vines, frozen ponds, the border zone (neighbour lawn + pieces) and the blob grounds
// that close the emptiness gate. Terrain and placement only — no events. World maps: lib/atlas-biome-world.mjs.
// A check failure (blocked exit, terrace reachable without stairs, emptiness over the field gate) redraws the map
// from the next seed (recorded as seedUsed).
// Usage: node scripts/content/author-atlas-biomes.mjs            (ATLAS_ONLY=<id,id> re-authors some, keeping the rest)
//        ATLAS_BIOME=<kind> only the plans of one biome; ATLAS_DEBUG=1 prints the failure of every attempt.
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { loadKit } from "./lib/outdoor-kit.mjs";
import { BiomeMap, loadBiomes, useBiome } from "./lib/atlas-biome-kit.mjs";
import { theme, zoneTheme } from "./lib/atlas-biome-themes.mjs";
import { ARCHETYPES } from "./lib/atlas-biome-layouts.mjs";
import { PLANS } from "./lib/atlas-biome-plans.mjs";
import { buildBiomeWorld } from "./lib/atlas-biome-world.mjs";

const OUT = "tiledata/atlas-biomes";
const only = process.env.ATLAS_ONLY ? process.env.ATLAS_ONLY.split(",") : null;
const onlyBiome = process.env.ATLAS_BIOME ?? null;
const old = fs.existsSync(`${OUT}/catalog.json`) ? JSON.parse(fs.readFileSync(`${OUT}/catalog.json`)) : { plans: [], maps: {} };
const oldReport = fs.existsSync(`${OUT}/validation.json`) ? JSON.parse(fs.readFileSync(`${OUT}/validation.json`)) : [];
const GATE = { maxSq: 5, screen: 0.5 }, AIM = { maxSq: 5, screen: 0.45 };
const plans = [], maps = {}, report = [], failures = [];
const keepOld = (plan) => { const p = old.plans.find((q) => q.id === plan.id); if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); } };

await withTsModule("scripts/content/lib/atlas-biomes-entry.ts", "atlas-biomes-entry.mjs", async (api) => {
  const kit = loadKit(api), biomes = loadBiomes(api, kit);
  const rnd = (b, [a, c]) => a + Math.floor(b.random() * (c - a + 1));
  for (const plan of PLANS) {
    if ((only && !only.includes(plan.id)) || (onlyBiome && plan.biome !== onlyBiome)) { keepOld(plan); continue; }
    if (plan.world) {
      const { map, meta, check } = buildBiomeWorld(api, plan);
      maps[plan.id] = map; plans.push({ ...strip(plan), ...meta }); report.push({ id: plan.id, seed: plan.seed, ...check });
      console.log(plan.id, `${plan.width}x${plan.height}`, check.emptiness);
      continue;
    }
    const biome = biomes[plan.biome];
    useBiome(kit, biome);
    const th = theme(biome), arch = ARCHETYPES[plan.layout];
    assert(arch, "Unknown layout " + plan.layout);
    let done = null, lastError;
    for (let attempt = 0; !done && attempt < 40; attempt++) {
      const b = new BiomeMap(kit, { ...plan, tileset: biome.tileset, tilesetId: biome.tileset.id }, plan.seed + attempt, biome);
      try {
        b.noForest = !!th.noForestEdge;
        const lay = arch(plan.o ?? {});
        const entry = lay.build(b);
        plan.extra?.(b);
        // border fields: the neighbour biome's side of the map
        if (plan.zone) b.setZone((x, y) => plan.zone(x, y, b));
        // frozen ponds (taiga, tundra): whole water bodies only
        if (th.freeze) freezeBodies(b, th.freeze);
        // biome woods: extra canopy masses in the open, clear of roads, access and the existing forest
        if (th.canopy) {
          const n = rnd(b, th.canopy.count), blobs = [];
          const clearOf = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy), i = b.at(X, Y); if (!b.inside(X, Y)) continue; if (b.roads.has(i) || b.water.has(i) || b.cliffCells.has(i) || b.isForest(i) || b.zone?.has(i)) return false; } return true; };
          for (let k = 0; k < 300 && blobs.length < n; k++) {
            const rx = rnd(b, th.canopy.r), ry = Math.max(3, rx - 1 - Math.floor(b.random() * 2)), x = 2 + b.random() * (b.W - 4), y = 2 + b.random() * (b.H - 4);
            if (!clearOf(x, y, Math.max(2, Math.min(rx, ry) - 1)) || blobs.some((q) => Math.hypot(q[0] - x, q[1] - y) < q[2] + rx + 3)) continue;
            blobs.push([x, y, rx, ry, 24]);
          }
          if (blobs.length) b.forest({ blobs, noise: 0.6, seedShift: 29, coverage: 0.92 });
        }
        // hero clumps first (the big pieces need room), near water when asked
        if (th.hero) {
          const dist = th.hero.nearWater ? b.shoreDistanceLand() : null;
          b.clumps(th.hero.ids, rnd(b, th.hero.count), { per: th.hero.per, gapCheck: 6, near: dist ? (x, y) => (dist.get(b.at(x, y)) ?? 99) <= th.hero.nearWater : null });
        }
        if (th.landmark) b.clumps([th.landmark.id], 1, { per: [1, 1], gapCheck: 8 });
        // a few large ground patches first, in the open (organic ellipses), before the fill cuts the plain into gaps
        if (th.grounds?.length) b.groundFill(th.grounds, { maxSq: 0, screen: 0, cap: rnd(b, th.bigPatches ?? [2, 4]), size: [26, 48] });
        const fillOpts ={ maxSq: AIM.maxSq, screen: AIM.screen, treeCount: [2, 3], ...th.fill, ...(plan.fill ?? {}) };
        if (fillOpts.fillGate) Object.assign(fillOpts, fillOpts.fillGate);
        b.fill(fillOpts);
        if (th.bare) b.bareGroves({ seed: b.seed, rockChance: 0.3 });
        if (th.water && b.water.size) b.waterDeco(th.water.ids, rnd(b, th.water.count), { reach: th.water.reach, per: th.water.per ?? [2, 4], group: th.water.group ?? 2 });
        if (th.vines && b.cliffPlan) b.cliffVines(th.vines.ids, rnd(b, th.vines.count));
        if (th.decals) { let n = 0; for (let k = 0; k < 60 && n < 4; k++) { const x = 2 + Math.floor(b.random() * (b.W - 4)), y = 2 + Math.floor(b.random() * (b.H - 4)); if ([...b.paved].some(([i, g]) => g === "sand" && Math.abs(i % b.W - x) + Math.abs(Math.floor(i / b.W) - y) <= 1) && b.clusterTiles(th.decals, x, y, 3, (i) => b.paved.get(i) === "sand" || b.bare(i), true)) n++; } }
        if (plan.zone) b.zoneFill({ ...zoneTheme(biome), maxSq: AIM.maxSq, screen: AIM.screen });
        if (th.pools) b.groundFill([th.pools], { maxSq: 99, screen: 0.99, cap: rnd(b, [1, 2]), size: [8, 14], pool: th.pools });
        const g = b.groundFill(th.grounds, { maxSq: AIM.maxSq, screen: AIM.screen });
        b.pruneUnowned();
        const emptiness = b.emptiness();
        assert(emptiness.maxSq <= GATE.maxSq && emptiness.screen <= GATE.screen, `Field gate ${plan.id} maxSq=${emptiness.maxSq} screen=${emptiness.screen.toFixed(3)} at=${emptiness.screenAt} zone=${JSON.stringify(b.zoneReport ?? null)}`);
        if (plan.zone) b.paintZone();
        const check = b.check({ entry: entry ?? b.exitList[0].inner, extra: plan.extraTargets ?? [], leak: true });
        done = { b, check, seed: plan.seed + attempt, entry: entry ?? b.exitList[0].inner, emptiness };
      } catch (e) {
        if (!(e instanceof assert.AssertionError)) throw e;
        lastError = e;
        if (process.env.ATLAS_DEBUG) console.log(plan.id, attempt, e.message.split("\n")[0].slice(0, 240));
        if (process.env.ATLAS_ASCII === plan.id) { console.log(b.ascii()); const t = {}; for (const [, g] of b.paved) t[g] = (t[g] ?? 0) + 1; console.log(t); }
      }
    }
    if (!done) { failures.push(plan.id + ": " + lastError.message.split("\n")[0]); keepOld(plan); continue; }
    const { b, check, seed, entry, emptiness } = done;
    maps[plan.id] = b.map;
    const count = (kind) => b.placements.filter((o) => o.kind === kind).length;
    plans.push({ ...strip(plan), tilesetId: biome.tileset.id, seedUsed: seed, entry, exits: b.exitList.map(({ inner, ...e }) => e), access: b.access,
      stairs: b.stairList.map(({ top, bottom, ...s }) => s), cliffs: b.cliffProfiles ?? [], falls: b.falls,
      placements: b.placements.filter((o) => o.kind === "prop" || o.kind === "shaft").map(({ lower, upper, cells, ...o }) => o),
      pieces: tally(b), dressing: count("dressing"), groundPatches: b.placements.filter((o) => o.kind === "ground").map((o) => o.group),
      bareGroves: b.groveReport ?? null, zone: b.zonePaint ?? null, skipped: b.log.skipped });
    report.push({ id: plan.id, seed, entry, ...check, emptiness: { maxSq: emptiness.maxSq, screen: +emptiness.screen.toFixed(3), at: emptiness.at, screenAt: emptiness.screenAt } });
    console.log(plan.id, `${plan.width}x${plan.height}`, { seed, reach: check.reachable, empty: [emptiness.maxSq, +emptiness.screen.toFixed(2)], pieces: Object.keys(tally(b)).length, zone: b.zonePaint?.cells });
  }
});
function strip(plan) { const { build, extra, zone, o, ...rest } = plan; return { ...rest, layoutOptions: o ?? {}, hasZone: !!zone }; }
function tally(b) { const t = {}; for (const o of b.placements) if (o.kind === "vegetation") { const n = o.name.replace("나무 · ", ""); t[n] = (t[n] ?? 0) + 1; } return t; }
// Freeze whole water bodies: ponds (not touching the map edge) with probability p, everything when p >= 1.
function freezeBodies(b, p) {
  const seen = new Set();
  for (const s of b.water) {
    if (seen.has(s)) continue;
    const comp = [s]; seen.add(s); let edge = false;
    for (let k = 0; k < comp.length; k++) { const [x, y] = b.xy(comp[k]); if (x === 0 || y === 0 || x === b.W - 1 || y === b.H - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = b.at(x + dx, y + dy); if (b.inside(x + dx, y + dy) && b.water.has(j) && !seen.has(j) && !b.bridgeCells.has(j)) { seen.add(j); comp.push(j); } } }
    if (p >= 1 || (!edge && b.random() < p)) { const set = new Set(comp); b.freeze((x, y) => set.has(b.at(x, y))); }
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ source: "tiledata/atlas-biomes/sheets.json", plans, maps }) + "\n");
fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
if (failures.length) { console.error("FAILED\n" + failures.join("\n")); process.exitCode = 1; }
