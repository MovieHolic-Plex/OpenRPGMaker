// Author the outdoor fantasy maps of tiledata/rpg-outdoors (towns, fields, sacred places, story scenes, world map).
// Each plan in lib/rpg-outdoor-plans.mjs drives the OutdoorMap builder (lib/outdoor-kit.mjs) with the forest-village
// parts; climate plans run the same numbers on the climate sheets. Terrain and placement only — no events.
// A check failure (blocked door, terrace reachable without stairs) redraws the map from the next seed (recorded).
// Usage: node scripts/content/author-rpg-outdoors.mjs    (OUTDOOR_ONLY=<id,id> re-authors some, keeping the rest)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { loadKit, OutdoorMap } from "./lib/outdoor-kit.mjs";
import { PLANS } from "./lib/rpg-outdoor-plans.mjs";
import { buildWorldMap, worldKeyedTileset } from "./lib/rpg-outdoor-world.mjs";
import { GATES, THEME_FILL } from "./lib/rpg-outdoor-fill.mjs";
import { snowCastleTops } from "./lib/climate-terrain.mjs";

const SNOW_WALLS = JSON.parse(fs.readFileSync("tiledata/climate-villages/sheets.json", "utf8")).terrain.snowWalls;

const OUT = "tiledata/rpg-outdoors";
const only = process.env.OUTDOOR_ONLY ? process.env.OUTDOOR_ONLY.split(",") : null;
const old = fs.existsSync(`${OUT}/catalog.json`) ? JSON.parse(fs.readFileSync(`${OUT}/catalog.json`)) : { plans: [], maps: {} };
const oldReport = fs.existsSync(`${OUT}/validation.json`) ? JSON.parse(fs.readFileSync(`${OUT}/validation.json`)) : [];
const plans = [], maps = {}, report = [], failures = [];
await withTsModule("scripts/content/lib/rpg-outdoors-entry.ts", "rpg-outdoors-entry.mjs", async (api) => {
  const kit = loadKit(api);
  const blank = api.createBlankProject();
  const tilesets = { forest_harmony: kit.ts, easyrpg_chipset_world: blank.tilesets.easyrpg_chipset_world };
  for (const k of ["snow", "volcano", "desert", "autumn"]) { const t = api.createClimateVillageTileset(k); tilesets[t.id] = t; }
  { const t = worldKeyedTileset(blank.tilesets.easyrpg_chipset_world); tilesets[t.id] = t; }
  for (const plan of PLANS) {
    if (only && !only.includes(plan.id)) {
      const p = old.plans.find((q) => q.id === plan.id);
      if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); }
      continue;
    }
    const tileset = tilesets[plan.tilesetId];
    assert(tileset, "Unknown tileset " + plan.tilesetId);
    if (plan.world) {
      const { map, meta, check } = buildWorldMap(api, tileset, plan);
      maps[plan.id] = map;
      plans.push({ ...strip(plan), ...meta });
      report.push({ id: plan.id, seed: plan.seed, ...check });
      console.log(plan.id, check);
      continue;
    }
    let done = null, lastError;
    for (let attempt = 0; !done && attempt < 30; attempt++) {
      const b = new OutdoorMap(kit, { ...plan, tileset }, plan.seed + attempt);
      try {
        const entry = plan.build(b);
        for (const [group, items] of plan.plaza ?? []) b.plazaFill(group, items);
        b.pruneUnowned();
        const theme = { ...GATES[plan.gate ?? "town"], ...THEME_FILL[plan.theme ?? plan.tilesetId], plaza: plan.plaza ?? [], ...(plan.fill ?? {}) };
        if (plan.fill !== false) b.fill(theme.ground ? { ...theme, ...theme.fillGate } : theme);
        // Desert and ash: leafless-tree groves (lib/bare-trees.mjs) on the spots fill left bare.
        if (theme.standsAsSpots) {
          b.bareGroves({ seed: plan.seed, cactus: theme.ground ? null : plan.tilesetId === "forest_harmony_desert" ? 769 : null, ...(theme.groveRockChance != null ? { rockChance: theme.groveRockChance } : {}) });
          // Top up the open sand / ash round the groves with clumps (no grass, no trees): rocks on ash, cactus and rocks on sand.
          if (theme.topUp) b.fill({ ...theme, ...theme.topUp, standsAsSpots: false, stands: [], groves: 0 });
        }
        // Desert and ash: the rest of the gate is closed by the ground (dunes, ripples, lava plates, cracks…).
        if (theme.ground) {
          const hard = GATES[plan.gate ?? "town"] === GATES.field ? { maxSq: 5, screen: 0.5 } : { maxSq: 4, screen: 0.4 };
          const g = b.climateGround({ climate: theme.ground, maxSq: hard.maxSq, screen: hard.screen - 0.03, seed: plan.seed, ...(theme.groundOpts ?? {}), ...(plan.groundOpts ?? {}) });
          if (process.env.OUTDOOR_SOFT) { if (g.screen > hard.screen || g.maxSq > hard.maxSq) console.log("GROUND GATE", plan.id, g, "\n" + b.ascii()); }
          else assert(g.maxSq <= hard.maxSq && g.screen <= hard.screen, `Ground gate ${plan.id} maxSq=${g.maxSq} screen=${g.screen.toFixed(3)}`);
        }
        // Snow maps: castle walls, walks and tower heads take their snow-capped copies (same passage and layer).
        if (plan.tilesetId === "forest_harmony_snow") b.snowTops = snowCastleTops(b.map, SNOW_WALLS);
        const check = b.check({ entry: entry ?? b.exitList[0].inner, extra: plan.extraTargets ?? [], leak: plan.leak !== false, seals: b.seals ?? [] });
        done = { b, check, seed: plan.seed + attempt, entry: entry ?? b.exitList[0].inner };
      } catch (e) {
        if (!(e instanceof assert.AssertionError)) throw e;
        lastError = e;
        if (process.env.OUTDOOR_DEBUG) console.log(plan.id, attempt, e.message.slice(0, 300));
        if (process.env.OUTDOOR_ASCII) console.log(b.ascii());
        if (/overlaps|does not fit|Unknown|Stair must|Exit corridor|Bridge|Dock|Cave|leaves the map|Missing part|Cannot shrink|Seal |No room|Fence overlaps|Pier |Shaft |Peak /.test(e.message)) break;
      }
    }
    if (!done) {
      // Keep the rest of the run: report the failure, keep this plan's previous map (if any), exit non-zero at the end.
      failures.push(plan.id + ": " + lastError.message.split("\n")[0]);
      const p = old.plans.find((q) => q.id === plan.id);
      if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); }
      continue;
    }
    const { b, check, seed, entry } = done;
    maps[plan.id] = b.map;
    plans.push({ ...strip(plan), seedUsed: seed, entry, exits: b.exitList.map(({ inner, ...e }) => e), access: b.access, stairs: b.stairList.map(({ top, bottom, ...s }) => s),
      cliffs: b.cliffProfiles ?? [], falls: b.falls, houses: b.houses, landmarks: b.landmarks,
      placements: b.placements.filter((o) => o.kind !== "dressing").map(({ lower, upper, cells, ...o }) => o),
      dressing: b.placements.filter((o) => o.kind === "dressing").length, forest: b.forestReport ?? null, ground: b.groundReport ?? null, bareTreeSpots: b.bareSpots ?? [], bareGroves: b.groveReport ?? null, skipped: b.log.skipped });
    report.push({ id: plan.id, seed, entry, ...check, emptiness: b.fillReport ? { maxSq: b.fillReport.maxSq, screen: +b.fillReport.screen.toFixed(3), at: b.fillReport.at, screenAt: b.fillReport.screenAt } : null });
    console.log(plan.id, `${plan.width}x${plan.height}`, { seed, houses: b.houses.length, props: b.placements.filter((o) => o.kind === "prop").length, reachable: check.reachable, skipped: b.log.skipped.length, empty: b.fillReport && [b.fillReport.maxSq, +b.fillReport.screen.toFixed(2)], groves: b.groveReport ?? undefined });
  }
});
function strip(plan) { const { build, ...rest } = plan; return rest; }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ source: "tiledata/forest-villages/diverse/catalog.json", plans, maps }) + "\n");
fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
if (failures.length) { console.error("FAILED\n" + failures.join("\n")); process.exitCode = 1; }
