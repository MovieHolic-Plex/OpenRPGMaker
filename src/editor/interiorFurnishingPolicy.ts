import type { ConceptOverlayThing } from "./conceptBundleResolve";

// Automatic choices share a function, not just a graphic. A dining assembly
// already includes its seats: another table/chair assembly is not extra chairs.
const GROUPS: readonly (readonly string[])[] = [
  ["home_table", "dining_table", "table_chairs", "reading_table", "tea_table", "table_round", "table_wood", "consultation_table"],
  ["table_long", "work_table", "table_white"],
  ["stove", "hearth", "stone_hearth_lit", "stone_hearth_unlit"],
  ["rug", "rug_mat", "rug_red"],
];

/** Budget optional automatic furnishings against usable floor, not the map bbox.
 * Required quantities win; individual classroom desks retain their authored capacity.
 * Unrelated storage/display furniture and fixed authored objects are unaffected.
 */
export function selectInteriorFurnishings(things: readonly ConceptOverlayThing[], floorArea: number, identity: (thing: ConceptOverlayThing) => string = thing => thing.objectId, existing: readonly string[] = []): readonly ConceptOverlayThing[] {
  const budget = Math.max(1, Math.floor(floorArea / 60));
  const counts = GROUPS.map(group => things.filter(t => t.required && group.includes(identity(t))).length + existing.filter(id => group.includes(id)).length);
  return things.filter(thing => {
    // A three-row prep/work bench needs an approach beyond the stove in small kitchens.
    if (!thing.required && identity(thing) === "work_table" && floorArea < 24) return false;
    const group = GROUPS.findIndex(ids => ids.includes(identity(thing)));
    if (group < 0 || thing.required) return true;
    if (counts[group]! >= budget) return false;
    counts[group] = counts[group]! + 1;
    return true;
  });
}
