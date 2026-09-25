// Author tiledata/atlas-scenes — 탈것·항구·특수 장면: ship decks (sailing / docked / boarding), ship cabins, sky and
// airship scenes, harbors with big ships moored, ferries and rafts, bridges, festivals, the execution square, boss
// stages, story scenes, camps on the road, lighthouses, gates and checkpoints, temple forecourts.
//
// Vehicles and scene pieces come from the bundled sheet oprn_atlas_vehicles (scripts/content/atlas-scenes/build_vehicles.py),
// grafted into this pipeline's copies of easyrpg_chipset_ship (from 480) and forest_harmony + climate sheets (from 3611,
// field E's range) — lib/atlas-scenes-kit.mjs. Outdoor plans use the OutdoorMap builder (lib/outdoor-kit.mjs); ship and sky
// plans use GridMap. Terrain and placement only — no events. Every map's entry must reach its doors, gangways and exits.
// Usage: node scripts/content/author-atlas-scenes.mjs      (ATLAS_ONLY=<id,id> re-authors some, keeping the rest)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "./../ontology-ts-loader.mjs";
import { loadKit, OutdoorMap } from "./lib/outdoor-kit.mjs";
import { GATES, THEME_FILL } from "./lib/rpg-outdoor-fill.mjs";
import { withVehicleGrafts, compactVehicleGrafts, FOREST_BASE, FOREST_LIMIT, SHIP_BASE } from "./lib/atlas-scenes-kit.mjs";
import { shipPlans, lockWater } from "./lib/atlas-scenes-ships.mjs";
import { skyPlans } from "./lib/atlas-scenes-sky.mjs";
import { cabinPlans } from "./lib/atlas-scenes-cabins.mjs";
import { outdoorPlans } from "./lib/atlas-scenes-outdoor.mjs";

const OUT = "tiledata/atlas-scenes";
const only = process.env.ATLAS_ONLY ? process.env.ATLAS_ONLY.split(",") : null;
const old = fs.existsSync(`${OUT}/catalog.json`) ? JSON.parse(fs.readFileSync(`${OUT}/catalog.json`)) : { plans: [], maps: {} };
const oldReport = fs.existsSync(`${OUT}/validation.json`) ? JSON.parse(fs.readFileSync(`${OUT}/validation.json`)) : [];
const strip = ({ build, ...rest }) => rest;

await withTsModule("scripts/content/lib/atlas-scenes-entry.ts", "atlas-scenes-entry.mjs", async (api) => {
  console.time("blank"); const blank = api.createBlankProject(); console.timeEnd("blank");
  const veh = blank.tilesets.oprn_atlas_vehicles;
  assert(veh, "new projects lack oprn_atlas_vehicles");
  // Working tilesets: every vehicle slot grafted at base + slot.
  const ship = withVehicleGrafts(blank.tilesets.easyrpg_chipset_ship, veh, SHIP_BASE);
  ship.transparentColor = "#ff678b";
  lockWater(ship);
  const forestBase = (t) => Math.max(FOREST_BASE, Math.ceil(t.count / 30) * 30);
  const climate = {};
  for (const k of ["snow", "volcano", "desert", "autumn"]) { const t = api.createClimateVillageTileset(k); climate[t.id] = withVehicleGrafts(t, veh, forestBase(t)); }
  console.time("forest"); const forest = withVehicleGrafts(blank.tilesets.forest_harmony, veh, FOREST_BASE); console.timeEnd("forest");
  const tilesets = { easyrpg_chipset_ship: ship, forest_harmony: forest, ...climate };
  const baseOf = { easyrpg_chipset_ship: SHIP_BASE, forest_harmony: FOREST_BASE, ...Object.fromEntries(Object.entries(climate).map(([id, t]) => [id, forestBase(api.createClimateVillageTileset(id.replace("forest_harmony_", "")))])) };
  console.time("kit"); const kit = loadKit(api); console.timeEnd("kit");
  const ctx = { api, ship, forest, climate, tilesets, baseOf, blank, kit };

  const PLANS = [...shipPlans(), ...skyPlans(), ...cabinPlans(), ...outdoorPlans()];
  const ids = new Set();
  for (const p of PLANS) { assert(!ids.has(p.id), "duplicate plan " + p.id); ids.add(p.id); }
  const plans = [], maps = {}, report = [], failures = [];
  for (const plan of PLANS) {
    if (only && !only.includes(plan.id)) {
      const p = old.plans.find((q) => q.id === plan.id);
      if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); }
      continue;
    }
    try {
      if (plan.outdoor) {
        const r = buildOutdoor(plan, ctx);
        maps[plan.id] = r.map; plans.push(r.plan); report.push(r.report);
        console.log(plan.id, `${plan.width}x${plan.height}`, r.report.seed, "reach", r.report.reachable, "empty", JSON.stringify(r.report.emptiness));
      } else {
        const { g, entry, extra } = plan.build(ctx);
        const check = g.check(api, entry);
        maps[plan.id] = g.map;
        plans.push({ ...strip(plan), entry, vehicles: g.vehicles.map(({ meta, ...v }) => v), placements: g.placements, ...(extra ?? {}) });
        report.push({ id: plan.id, entry, ...check });
        console.log(plan.id, `${plan.width}x${plan.height}`, check);
      }
    } catch (e) {
      if (!(e instanceof assert.AssertionError)) throw e;
      failures.push(`${plan.id}: ${e.message.split("\n")[0]}`);
      const p = old.plans.find((q) => q.id === plan.id);
      if (p) { plans.push(p); maps[plan.id] = old.maps[plan.id]; report.push(oldReport.find((r) => r.id === plan.id)); }
    }
  }
  // Renumber the vehicle grafts each tileset's maps use and trim the working tilesets.
  const out = {};
  for (const [id, t] of Object.entries(tilesets)) {
    const own = Object.values(maps).filter((m) => m.tilesetId === id);
    if (!own.length) continue;
    const base = baseOf[id];
    const { tileset, used } = compactVehicleGrafts(t, own, base, id === "easyrpg_chipset_ship" ? Infinity : base + 300);
    out[id] = tileset;
    console.log(`tileset ${id}: ${own.length} maps, ${used} vehicle tiles from ${base}`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ source: "scripts/content/author-atlas-scenes.mjs", plans, maps, tilesets: out }) + "\n");
  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  if (failures.length) { console.error("FAILED\n" + failures.join("\n")); process.exitCode = 1; }
});

// Outdoor plans: the rpg-outdoors loop (retry seeds on assertion failures, fill to the emptiness gate, check reach).
function buildOutdoor(plan, ctx) {
  const tileset = ctx.tilesets[plan.tilesetId];
  assert(tileset, "Unknown tileset " + plan.tilesetId);
  const base = ctx.baseOf[plan.tilesetId];
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    const b = new OutdoorMap(ctx.kit, { ...plan, tileset }, plan.seed + attempt);
    b.vehicleBase = base;
    try {
      const entry = plan.build(b, ctx);
      for (const [group, items] of plan.plaza ?? []) b.plazaFill(group, items);
      b.pruneUnowned();
      const theme = { ...GATES[plan.gate ?? "town"], ...THEME_FILL[plan.theme ?? plan.tilesetId], plaza: plan.plaza ?? [], ...(plan.fill ?? {}) };
      if (plan.fill !== false) b.fill(theme.ground ? { ...theme, ...theme.fillGate } : theme);
      if (theme.standsAsSpots) {
        b.bareGroves({ seed: plan.seed, cactus: theme.ground ? null : plan.tilesetId === "forest_harmony_desert" ? 769 : null });
        if (theme.topUp) b.fill({ ...theme, ...theme.topUp, standsAsSpots: false, stands: [], groves: 0 });
      }
      if (theme.ground) {
        const hard = GATES[plan.gate ?? "town"] === GATES.field ? { maxSq: 5, screen: 0.5 } : { maxSq: 4, screen: 0.4 };
        const g = b.climateGround({ climate: theme.ground, maxSq: hard.maxSq, screen: hard.screen - 0.03, seed: plan.seed, ...(theme.groundOpts ?? {}), ...(plan.groundOpts ?? {}) });
        assert(g.maxSq <= hard.maxSq && g.screen <= hard.screen, `Ground gate ${plan.id} maxSq=${g.maxSq} screen=${g.screen.toFixed(3)}`);
      }
      plan.finish?.(b, ctx);
      const check = b.check({ entry: entry ?? b.exitList[0].inner, extra: plan.extraTargets ?? [], leak: plan.leak !== false, seals: b.seals ?? [] });
      const { build, finish, ...rest } = plan;
      return {
        map: b.map,
        plan: { ...rest, seedUsed: plan.seed + attempt, entry: entry ?? b.exitList[0].inner, exits: b.exitList.map(({ inner, ...e }) => e), access: b.access,
          stairs: b.stairList.map(({ top, bottom, ...s }) => s), houses: b.houses, landmarks: b.landmarks, vehicles: b.vehicles ?? [],
          placements: b.placements.filter((o) => o.kind !== "dressing").map(({ lower, upper, cells, ...o }) => o), skipped: b.log.skipped },
        report: { id: plan.id, seed: plan.seed + attempt, entry: entry ?? b.exitList[0].inner, ...check,
          emptiness: b.fillReport ? { maxSq: b.fillReport.maxSq, screen: +b.fillReport.screen.toFixed(3) } : null },
      };
    } catch (e) {
      if (!(e instanceof assert.AssertionError)) throw e;
      lastError = e;
      if (process.env.ATLAS_DEBUG) console.log(plan.id, attempt, e.message.slice(0, 300));
      if (/overlaps|does not fit|Unknown|Stair must|Exit corridor|Bridge|Dock|Cave|leaves the map|Missing part|Cannot shrink|Seal |No room|Fence overlaps|Pier |Shaft |Peak |Vehicle /.test(e.message)) break;
    }
  }
  throw lastError;
}
