import type { SpatialChildSlot, SpatialLibrary } from "./types";

export const FACILITY_FLOOR_MAX = 4;

/** A facility's ground-level yard is an outdoor space; indoor floors start at 1. */
export function isFacilityChildLevelAllowed(
  library: SpatialLibrary,
  slot: Pick<SpatialChildSlot<"space" | "place">, "source" | "level">,
): boolean {
  if (!Number.isInteger(slot.level)) return false;
  if (slot.level >= 1 && slot.level <= FACILITY_FLOOR_MAX) return true;
  return slot.level === 0 && slot.source.kind === "space"
    && library.spaces[slot.source.id]?.environment === "outdoor";
}
