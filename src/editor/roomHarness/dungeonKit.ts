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
import { DUNGEON_LANDMARKS, DUNGEON_PRESSURES, type DungeonLandmark, type DungeonPressure } from "@/editor/dungeonGeneration/expedition";
import { DUNGEON_PATHS, planDungeonGraph, validateDungeonGraph, type DungeonDesign, type DungeonGraph, type DungeonPath } from "@/editor/dungeonGeneration/topology";
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
  const path = args.path === undefined ? undefined : String(args.path) as DungeonPath;
  if (path !== undefined && !DUNGEON_PATHS.includes(path)) throw new ToolError("path must be straight|cave|winding", { code: "invalid-args" });
  const linkMapId = typeof args.linkMapId === "string" && args.linkMapId.trim() ? args.linkMapId.trim() : undefined;
  const landmark = args.landmark === undefined ? undefined : String(args.landmark) as DungeonLandmark;
  if (landmark !== undefined && !DUNGEON_LANDMARKS.includes(landmark)) throw new ToolError("landmark must be altar|tower|gate|sound", { code: "invalid-args" });
  const pressure = args.pressure === undefined ? undefined : String(args.pressure) as DungeonPressure;
  if (pressure !== undefined && !DUNGEON_PRESSURES.includes(pressure)) throw new ToolError("pressure must be patrol|tide|rising", { code: "invalid-args" });
  const troopId = typeof args.troopId === "string" && args.troopId.trim() ? args.troopId.trim() : undefined;
  if (layout === "connected" && (width < 18 || height < 18)) throw new ToolError("connected dungeon requires at least 18×18", { code: "invalid-args" });
  const plan: DungeonRoomPlan = { mapId, name, width, height, theme, hazard, layout, seed, character, ...(path ? { path } : {}), ...(linkMapId ? { linkMapId } : {}), ...(landmark ? { landmark } : {}), ...(pressure ? { pressure } : {}), ...(troopId ? { troopId } : {}) };
  if (layout === "connected") {
    // Validate before any map allocation/mutation; the engine checks the overall map-size limit.
    if (args.graph !== undefined && (!args.graph || typeof args.graph !== "object")) throw new ToolError("graph must be an object", { code: "invalid-args" });
    let graph = args.graph === undefined ? planDungeonGraph(width, height, plan) : args.graph as DungeonGraph;
    // 용암 동굴에는 수정 방이 없다(푸른 수정 금지) — 시드가 뽑은 crystal 역할을 chamber 로 바꾼다.
    if (args.graph === undefined && theme === "lava" && character !== "crypt") graph = { ...graph, rooms: graph.rooms.map(r => r.role === "crystal" ? { ...r, role: "chamber" } : r) };
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
