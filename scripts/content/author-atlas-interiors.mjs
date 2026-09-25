// Author the atlas interiors — about a hundred ordinary fantasy-RPG rooms (homes of every standing, every kind of
// shop, inns and taverns, guilds, schools, temples, hospital, bank, theatre, bathhouse, casino, guard post and jail,
// workshops, castle rooms, ship cabins, desert/snow/volcano/autumn variants, two-floor pairs) on tibo_interior_expanded.
// Terrain and furnishing only (no doors/NPCs/shops/dialogue). The room grammar and checks are in atlas-interiors/kit.mjs;
// the rooms are in atlas-interiors/<group>.mjs. Writes tiledata/atlas-interiors/{catalog,validation,shared-objects}.json
// and stops when a target is unreachable, a floor pocket is sealed, or a placement rule breaks.
// Usage: node scripts/content/author-atlas-interiors.mjs [--only group,group]
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { createKit } from "./atlas-interiors/kit.mjs";
import { GROUPS } from "./atlas-interiors/groups.mjs";

const OUT = "tiledata/atlas-interiors";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;

await withTsModule("scripts/content/lib/rpg-places-entry.ts", "atlas-interiors-entry.mjs", async (api) => {
  const base = api.createBlankProject();
  const K = createKit(api, base);
  for (const [name, build] of Object.entries(GROUPS)) if (!only || only.includes(name)) {
    const before = K.places.length;
    build(K);
    for (const p of K.places.slice(before)) p.group ??= name;
  }
  const tilesets = { tibo_interior_expanded: K.TIBO };
  const { rules, report } = K.check({ tilesets });
  const ids = new Set();
  for (const p of K.places) { assert(!ids.has(p.id), `duplicate ${p.id}`); ids.add(p.id); }
  const maps = {};
  for (const p of K.places) maps[p.id] = { id: p.id, name: p.name, width: p.map.width, height: p.map.height, tileSize: 16, tilesetId: p.tilesetId, lowerTiles: p.map.lowerTiles, upperTiles: p.map.upperTiles, events: [] };
  // Plan notes carry what was placed, by name, after the author's own description.
  const plans = K.places.map(({ map: _m, stairCells: _s, placements, ...spec }) => {
    const names = [...new Set(placements.filter((q) => q.kind === "tibo-kit").map((q) => q.name))];
    return { ...spec, placements, furniture: names };
  });
  fs.mkdirSync(OUT, { recursive: true });
  const suffix = only ? `.${only.join("-")}` : "";
  fs.writeFileSync(`${OUT}/catalog${suffix}.json`, JSON.stringify({ plans, maps, tilesets }) + "\n");
  fs.writeFileSync(`${OUT}/validation${suffix}.json`, JSON.stringify(report, null, 2) + "\n");
  if (!only) fs.writeFileSync(`${OUT}/shared-objects.json`, JSON.stringify(K.cutObjects(), null, 1) + "\n");
  const bad = report.filter((r) => r.blocked.length), pocketed = report.filter((r) => r.pockets.length);
  if (rules.length) console.error("placement rules:\n  " + rules.join("\n  "));
  if (pocketed.length) console.error("sealed pockets:", JSON.stringify(pocketed.map((r) => ({ id: r.id, pockets: r.pockets }))));
  if (bad.length) console.error("unreachable:", JSON.stringify(bad.map((r) => ({ id: r.id, blocked: r.blocked }))));
  console.log({ maps: K.places.length, objects: K.objects.length, rules: rules.length, pockets: pocketed.length, unreachable: bad.length });
  assert((!bad.length && !pocketed.length && !rules.length) || process.env.ATLAS_LENIENT, "unreachable targets, sealed floor or placement rule broken");
});
