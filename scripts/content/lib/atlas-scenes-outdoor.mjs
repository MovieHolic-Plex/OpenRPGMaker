// Outdoor plans of tiledata/atlas-scenes (탈것·항구·특수 장면) — OutdoorMap (lib/outdoor-kit.mjs) on this pipeline's
// copies of forest_harmony and the climate sheets, with the vehicle / scene pieces of oprn_atlas_vehicles grafted from
// the sheet's vehicle base (lib/atlas-scenes-kit.mjs). Each build(b, ctx) paints the terrain and places things, and
// returns the check entry (or leaves the first exit). Every ship, raft, cart, stall and stage has a reason on the map.
import assert from "node:assert/strict";
import { stampVehicle, OutdoorDeck, piece } from "./atlas-scenes-kit.mjs";
import { dressShip } from "./atlas-scenes-ships.mjs";
import { harborPlans } from "./atlas-scenes-harbors.mjs";
import { scenePlans } from "./atlas-scenes-festivals.mjs";
import { roadPlans } from "./atlas-scenes-roads.mjs";

export const F = "forest_harmony", SNOW = "forest_harmony_snow", ASH = "forest_harmony_volcano", SAND = "forest_harmony_desert", AUTUMN = "forest_harmony_autumn";

/** Stamp a vehicle / scene piece at the vehicle base of the map's sheet. */
export const V = (b, name, x, y, opt = {}) => stampVehicle(b, name, x, y, { base: b.vehicleBase, ...opt });

/** V at (x, y) or the nearest spot within r cells where the piece fits (logged when moved); fails when none does. */
export function Vnear(b, name, x, y, opt = {}, r = 3) {
  const spots = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) spots.push([x + dx, y + dy, Math.abs(dx) + Math.abs(dy) * 1.1]);
  spots.sort((a, c) => a[2] - c[2]);
  for (const [X, Y] of spots) {
    if (!b.inside(X, Y)) continue;
    // keep one free cell round a blocked piece so it never seals a door front or a road
    const p = piece(name);
    let clear = true;
    for (const a of b.access) if (a.x >= X - 1 && a.x <= X + p.w && a.y >= Y - 1 && a.y <= Y + p.h) clear = false;
    if (!clear || X + p.w > b.W || Y + p.h > b.H) continue;
    try { const v = V(b, name, X, Y, opt); if (X !== x || Y !== y) b.log.skipped.push(`moved ${name} ${x},${y}→${X},${Y}`); return v; }
    catch (e) { if (!(e instanceof assert.AssertionError)) throw e; }
  }
  assert.fail(`Vehicle ${name} does not fit near ${x},${y} ${b.spec.id}`);
}

/** A ship moored on the map's water: stamped, its gangway foot and deckhouse door made targets, the deck dressed. */
export function mooredShip(b, name, x, y, { purpose, kind, cannons = 0, seed = 1, cargo, extras, clutter } = {}) {
  const v = V(b, name, x, y, { on: "water", purpose });
  const g = new OutdoorDeck(b, b.vehicleBase, purpose ?? "배");
  dressShip(g, v, { kind: kind ?? name.split(":")[2], cannons, seed, cargo, extras, clutter });
  if (v.gangway) b.access.push({ role: "gangway", x: v.gangway.x, y: v.gangway.y });
  for (const d of v.doors) b.access.push({ role: "deck-door", x: d.x, y: d.y + 1 });
  return v;
}

export function outdoorPlans() {
  return [...harborPlans(), ...scenePlans(), ...roadPlans()].map((p) => ({ outdoor: true, as: "place", ...p }));
}
