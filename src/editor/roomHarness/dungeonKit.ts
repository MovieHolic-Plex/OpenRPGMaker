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
import { planDungeonGraph, validateDungeonGraph, type DungeonDesign, type DungeonGraph } from "@/editor/dungeonGeneration/topology";
import { exceedsMapDimensionLimit, mapSizeLimitMessage } from "@/project/mapSizeLimits";
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
  const width = Math.max(8, Math.floor(Number(args.width ?? 48)));
  const height = Math.max(8, Math.floor(Number(args.height ?? 40)));
  if (!Number.isFinite(width) || !Number.isFinite(height) || exceedsMapDimensionLimit(width, height)) throw new ToolError(mapSizeLimitMessage("던전"), { code: "map-too-large" });
  const hazard = args.hazard === undefined ? true : Boolean(args.hazard);
  const layout = args.layout ?? (width >= 18 && height >= 18 ? "connected" : "single-room");
  if (layout !== "connected" && layout !== "single-room") throw new ToolError("layout must be connected or single-room", { code: "invalid-args" });
  const seed = args.seed === undefined ? 1 : Number(args.seed);
  if (!Number.isSafeInteger(seed)) throw new ToolError("seed must be a safe integer", { code: "invalid-args" });
  const character = (args.character ?? "cavern") as DungeonDesign["character"];
  if (!["cavern", "mine", "crystal", "crypt"].includes(character!)) throw new ToolError("unknown dungeon character", { code: "invalid-args" });
  if (layout === "connected" && (width < 18 || height < 18)) throw new ToolError("connected dungeon requires at least 18×18", { code: "invalid-args" });
  const plan: DungeonRoomPlan = { mapId, name, width, height, theme, hazard, layout, seed, character };
  if (layout === "connected") {
    // Validate before any map allocation/mutation; the engine checks the overall map-size limit.
    if (args.graph !== undefined && (!args.graph || typeof args.graph !== "object")) throw new ToolError("graph must be an object", { code: "invalid-args" });
    const graph = args.graph === undefined ? planDungeonGraph(width, height, plan) : args.graph as DungeonGraph;
    const errors = validateDungeonGraph(graph, width, height);
    if (errors.length) throw new ToolError(errors.join("; "), { code: "invalid-args" });
    return { ...plan, graph: structuredClone(graph) };
  }
  return plan;
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
