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
  // mapId 기본값(`map_dungeon_${theme}`)을 없앴다 — 같은 테마로 다시 호출하면 앞선 던전을
  // 조용히 덮어썼다(2026-08-29 modify 진단). 대상 맵은 호출자가 반드시 지목한다.
  const mapId = String(args.mapId ?? "").trim();
  if (!mapId) {
    throw new ToolError("mapId 를 지정하라 — 테마 기본 id 는 같은 테마의 기존 던전을 덮어쓴다", {
      code: "invalid-args",
    });
  }
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
