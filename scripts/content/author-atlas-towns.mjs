// Author the atlas towns (tiledata/atlas-towns): ordinary fantasy RPG towns and cities — home villages and their burnt /
// rebuilt states, river, lake, hill and cliff villages, ports, a walled capital split into districts, fortress, mining,
// farming, mountain, elf, dwarf, climate, spa, pilgrim, oasis, nomad, monster, abandoned and festival towns.
// Each plan (lib/atlas-town-plans*.mjs) drives the TownMap builder (lib/atlas-town-map.mjs = OutdoorMap + gable houses,
// fitted walls, atlas parts). Terrain and placement only — no events; exits say what they meet.
// A failed check (blocked door, terrace leak, emptiness gate) redraws from the next seed (recorded).
// Usage: node scripts/content/author-atlas-towns.mjs   (ATLAS_ONLY=<id,id> re-authors some; ATLAS_DEBUG=1, OUTDOOR_WALK=<id>)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { loadTownKit, TownMap, townTilesets } from "./lib/atlas-town-map.mjs";
import { PLANS } from "./lib/atlas-town-plans.mjs";
import { GATES, THEME_FILL } from "./lib/rpg-outdoor-fill.mjs";
import { snowCastleTops } from "./lib/climate-terrain.mjs";

const SNOW_WALLS = JSON.parse(fs.readFileSync("tiledata/climate-villages/sheets.json", "utf8")).terrain.snowWalls;
const OUT = "tiledata/atlas-towns";
const only = process.env.ATLAS_ONLY ? process.env.ATLAS_ONLY.split(",") : null;
const old = fs.existsSync(`${OUT}/catalog.json`) ? JSON.parse(fs.readFileSync(`${OUT}/catalog.json`)) : { plans: [], maps: {} };
const oldReport = fs.existsSync(`${OUT}/validation.json`) ? JSON.parse(fs.readFileSync(`${OUT}/validation.json`)) : [];
const plans = [], maps = {}, report = [], failures = [];
const ids = new Set();
for (const p of PLANS) { assert(!ids.has(p.id), "duplicate plan " + p.id); ids.add(p.id); }

await withTsModule("scripts/content/lib/atlas-towns-entry.ts", "atlas-towns-entry.mjs", async (api) => {
  const tilesets = await townTilesets(api);
  assert(tilesets.forest_harmony.count >= 3491, "forest_harmony lacks the atlas town parts: " + tilesets.forest_harmony.count);
  const kit = loadTownKit(api, tilesets.forest_harmony);
  for (const plan of PLANS) {
    if (only && !only.includes(plan.id)) {
      const p = old.plans.find((q) => q.id === plan.id);
      if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); }
      continue;
    }
    const tileset = tilesets[plan.tilesetId];
    assert(tileset, "Unknown tileset " + plan.tilesetId);
    const gate = GATES[plan.gate ?? "town"] === GATES.field || plan.gate === "field" ? { maxSq: 5, screen: 0.5 } : { maxSq: 4, screen: 0.4 };
    let done = null, lastError;
    for (let attempt = 0; !done && attempt < (plan.tries ?? 12); attempt++) {
      const b = new TownMap(kit, { ...plan, tileset }, plan.seed + attempt);
      try {
        const entry = plan.build(b);
        for (const [group, items] of plan.plaza ?? []) b.plazaFill(group, items);
        b.pruneUnowned();
        const theme = { ...GATES[plan.gate ?? "town"], ...THEME_FILL[plan.theme ?? plan.tilesetId], plaza: plan.plaza ?? [], ...(plan.fill ?? {}) };
        if (plan.fill !== false) b.fill(theme.ground ? { ...theme, ...theme.fillGate } : theme);
        if (theme.standsAsSpots) {
          b.bareGroves({ seed: plan.seed, cactus: null, ...(theme.groveRockChance != null ? { rockChance: theme.groveRockChance } : {}) });
          if (theme.topUp) b.fill({ ...theme, ...theme.topUp, standsAsSpots: false, stands: [], groves: 0 });
        }
        if (theme.ground) {
          const g = b.climateGround({ climate: theme.ground, maxSq: gate.maxSq, screen: gate.screen - 0.03, seed: plan.seed, ...(theme.groundOpts ?? {}), ...(plan.groundOpts ?? {}) });
          assert(g.maxSq <= gate.maxSq && g.screen <= gate.screen, `Ground gate ${plan.id} maxSq=${g.maxSq} screen=${g.screen.toFixed(3)}`);
        }
        if (plan.after) plan.after(b);
        b.finishLighting();
        if (plan.tilesetId === "forest_harmony_snow") b.snowTops = snowCastleTops(b.map, SNOW_WALLS);
        const check = b.check({ entry: entry ?? b.exitList[0].inner, extra: plan.extraTargets ?? [], leak: plan.leak !== false, seals: b.seals ?? [] });
        const e = b.emptiness();
        if (plan.fill !== false && !plan.skipGate) assert(e.maxSq <= gate.maxSq && e.screen <= gate.screen, `Emptiness gate ${plan.id} maxSq=${e.maxSq} screen=${e.screen.toFixed(3)} at ${e.at} / ${e.screenAt}`);
        done = { b, check, seed: plan.seed + attempt, entry: entry ?? b.exitList[0].inner, e };
      } catch (err) {
        if (!(err instanceof assert.AssertionError)) throw err;
        lastError = err;
        if (process.env.ATLAS_DEBUG) console.log(plan.id, attempt, err.message.slice(0, 300));
        if (process.env.ATLAS_ASCII === plan.id) console.log(b.ascii());
        if (/overlaps|does not fit|Unknown|Stair must|Exit corridor|Bridge|Dock|Cave|leaves the map|Missing part|Cannot|Seal |No room|Fence overlaps|Pier |Shaft |Peak |needs the forest/.test(err.message)) break;
      }
    }
    if (!done) {
      failures.push(plan.id + ": " + lastError.message.split("\n")[0]);
      const p = old.plans.find((q) => q.id === plan.id);
      if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); }
      continue;
    }
    const { b, check, seed, entry, e } = done;
    maps[plan.id] = b.map;
    plans.push({ ...strip(plan), seedUsed: seed, entry, exits: b.exitList.map(({ inner, ...x }) => x), access: b.access, stairs: b.stairList.map(({ top, bottom, ...s }) => s),
      houses: b.houses.map(({ vines, ...h }) => h), landmarks: b.landmarks, night: b.map.defaultLighting ?? null,
      placements: b.placements.filter((o) => o.kind !== "dressing").map(({ lower, upper, cells, ...o }) => o),
      dressing: b.placements.filter((o) => o.kind === "dressing").length, forest: b.forestReport ?? null, ground: b.groundReport ?? null, bareGroves: b.groveReport ?? null, skipped: b.log.skipped });
    report.push({ id: plan.id, seed, entry, ...check, emptiness: { maxSq: e.maxSq, screen: +e.screen.toFixed(3), at: e.at, screenAt: e.screenAt } });
    console.log(plan.id, `${plan.width}x${plan.height}`, { seed, houses: b.houses.length, props: b.placements.filter((o) => o.kind === "prop").length, reachable: check.reachable, skipped: b.log.skipped.length, empty: [e.maxSq, +e.screen.toFixed(2)] });
  }
});
function strip(plan) { const { build, after, ...rest } = plan; return rest; }
fs.mkdirSync(OUT, { recursive: true });
// Plans in PLANS order (ATLAS_ONLY keeps the others from the old catalog).
const order = new Map(PLANS.map((p, k) => [p.id, k]));
plans.sort((a, b) => order.get(a.id) - order.get(b.id));
fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ plans, maps }) + "\n");
fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report.filter(Boolean).sort((a, b) => order.get(a.id) - order.get(b.id)), null, 1) + "\n");
if (failures.length) { console.error("FAILED\n" + failures.join("\n")); process.exitCode = 1; }
