/** dungeon-room-v1 킷 — dungeonRoomPipeline을 RoomHarnessKit로 래핑. */
import {
  applyDungeonRoomLayer,
  createEmptyDungeonRoomMap,
  DUNGEON_ROOM_BUILD_ORDER,
  DUNGEON_ROOM_DEMO_PLANS,
  DUNGEON_ROOM_KIT_ID,
  DUNGEON_ROOM_THEMES,
  ensureDungeonRoomHarness,
  evaluateDungeonRoom,
  runDungeonRoomPipeline,
  type DungeonRoomPlan,
  type DungeonRoomTheme,
} from "@/editor/dungeonRoomPipeline";
import { ToolError } from "@/editor/tools/types";
import type { RoomHarnessKit } from "./types";

function parseDungeonPlan(args: Record<string, unknown>): DungeonRoomPlan {
  const theme = String(args.theme ?? "").trim() as DungeonRoomTheme;
  if (!DUNGEON_ROOM_THEMES.includes(theme)) {
    throw new ToolError(`theme must be ${DUNGEON_ROOM_THEMES.join("|")}`, { code: "invalid-args" });
  }
  const mapId = String(args.mapId ?? `map_dungeon_${theme}`).trim();
  const name = String(args.name ?? mapId).trim();
  const width = Math.max(8, Math.floor(Number(args.width ?? 26)));
  const height = Math.max(8, Math.floor(Number(args.height ?? 18)));
  const hazard = args.hazard === undefined ? true : Boolean(args.hazard);
  return { mapId, name, width, height, theme, hazard };
}

export const DUNGEON_ROOM_KIT: RoomHarnessKit<DungeonRoomPlan> = {
  kitId: DUNGEON_ROOM_KIT_ID,
  themes: DUNGEON_ROOM_THEMES,
  buildOrder: DUNGEON_ROOM_BUILD_ORDER,
  demoPlans: DUNGEON_ROOM_DEMO_PLANS,
  ensureHarness: ensureDungeonRoomHarness,
  parsePlan: parseDungeonPlan,
  mapIdOf: (plan) => plan.mapId,
  nameOf: (plan) => plan.name,
  createEmptyMap: createEmptyDungeonRoomMap,
  applyLayer: applyDungeonRoomLayer,
  runPipeline: runDungeonRoomPipeline,
  evaluate: evaluateDungeonRoom,
  demoMatch: (demo) => DUNGEON_ROOM_DEMO_PLANS.find((p) => p.theme === demo),
  startLog: (plan) => `[plan] theme=${plan.theme} ${plan.width}×${plan.height}`,
};
