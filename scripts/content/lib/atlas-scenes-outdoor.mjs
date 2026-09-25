// Outdoor plans of tiledata/atlas-scenes (탈것·항구·특수 장면) — OutdoorMap (lib/outdoor-kit.mjs) on this pipeline's
// copies of forest_harmony and the climate sheets, with the vehicle / scene pieces of oprn_atlas_vehicles grafted from
// the sheet's vehicle base (lib/atlas-scenes-kit.mjs). Each build(b, ctx) paints the terrain and places things, and
// returns the check entry (or leaves the first exit). Every ship, raft, cart, stall and stage has a reason on the map.
import { stampVehicle, OutdoorDeck } from "./atlas-scenes-kit.mjs";
import { dressShip } from "./atlas-scenes-ships.mjs";
import { harborPlans } from "./atlas-scenes-harbors.mjs";
import { scenePlans } from "./atlas-scenes-festivals.mjs";
import { roadPlans } from "./atlas-scenes-roads.mjs";

export const F = "forest_harmony", SNOW = "forest_harmony_snow", ASH = "forest_harmony_volcano", SAND = "forest_harmony_desert", AUTUMN = "forest_harmony_autumn";

/** Stamp a vehicle / scene piece at the vehicle base of the map's sheet. */
export const V = (b, name, x, y, opt = {}) => stampVehicle(b, name, x, y, { base: b.vehicleBase, ...opt });

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
