/**
 * @deprecated Implementation lives in interiorRoomPipeline.ts (procedural multi-phase).
 * Re-exports keep older imports working.
 */
export {
  INTERIOR_ROOM_KIT_ID as VILLAGER_ROOM_KIT_ID,
  INTERIOR_ROOM_TILESET_ID as VILLAGER_ROOM_TILESET_ID,
  INTERIOR_ROOM_FACE_ROWS as VILLAGER_ROOM_FACE_ROWS,
  VR,
  type Wing,
  type DoorSpec,
  type InteriorRoomTheme as VillagerRoomVariantId,
  type InteriorRoomPlan,
  INTERIOR_ROOM_DEMO_PLANS,
  runInteriorRoomPipeline,
  ensureInteriorRoomHarness,
  interiorBedHardRule,
  PROP_SURFACE,
} from "@/editor/interiorRoomPipeline";

import {
  INTERIOR_ROOM_DEMO_PLANS,
  runInteriorRoomPipeline,
  type InteriorRoomTheme,
} from "@/editor/interiorRoomPipeline";
import type { GameMap } from "@/project/types";

/** Build one demo map by theme (bedroom|study|dining). */
export function createVillagerRoomMap(theme: InteriorRoomTheme): GameMap {
  const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === theme);
  if (!plan) throw new Error(`unknown interior theme: ${theme}`);
  return runInteriorRoomPipeline(plan).map;
}
