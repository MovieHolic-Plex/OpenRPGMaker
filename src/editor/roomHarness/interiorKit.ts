/** villager-room-v1 킷 — interiorRoomPipeline을 RoomHarnessKit로 래핑. */
import {
  applyInteriorRoomLayer,
  createEmptyRoomMap,
  type RoomLayer,
  ensureInteriorRoomHarness,
  evaluateInteriorRoom,
  INTERIOR_ROOM_BUILD_ORDER,
  INTERIOR_ROOM_DEMO_PLANS,
  INTERIOR_ROOM_KIT_ID,
  INTERIOR_ROOM_THEMES,
  INTERIOR_ROOM_TILESET_ID,
  INTERIOR_THEME_MODIFIERS,
  interiorVocabFromTileset,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
  type InteriorThemeModifier,
  type Wing,
} from "@/editor/interiorRoomPipeline";
import type { Project } from "@/project/types";
import { ToolError } from "@/editor/tools/types";
import type { RoomHarnessKit } from "./types";

// interiorRoomSession.ts에서 이관 — 실내 플랜 arg 파서.
function parseThemeModifiers(value: unknown, label: string): InteriorThemeModifier[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError(`${label} must be an array`, { code: "invalid-args" });
  const modifiers = [...new Set(value.map((entry) => String(entry) as InteriorThemeModifier))];
  const invalid = modifiers.find((modifier) => !INTERIOR_THEME_MODIFIERS.includes(modifier));
  if (invalid) {
    throw new ToolError(`${label} must contain ${INTERIOR_THEME_MODIFIERS.join("|")}`, { code: "invalid-args" });
  }
  return modifiers;
}

export function parseInteriorPlan(args: Record<string, unknown>): InteriorRoomPlan {
  const mapId = String(args.mapId ?? "").trim();
  const name = String(args.name ?? mapId).trim();
  const width = Math.floor(Number(args.width ?? 16));
  const height = Math.floor(Number(args.height ?? 13));
  const theme = String(args.theme ?? "bedroom").trim();
  if (!theme) {
    throw new ToolError("theme 이 비어 있다 — 타일셋 방 종류 id 또는 bedroom|study|dining|kitchen|storage|tavern|corridor", {
      code: "invalid-args",
    });
  }
  const tilesetId = args.tilesetId !== undefined ? String(args.tilesetId).trim() : undefined;
  const door = args.door as { x?: number; y?: number } | undefined;
  if (!mapId || !door || typeof door.x !== "number" || typeof door.y !== "number") {
    throw new ToolError("mapId + door:{x,y} required", { code: "invalid-args" });
  }
  const wingsRaw = args.wings as Wing[] | undefined;
  const roomsRaw = args.rooms as Array<{ id?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown; theme?: unknown; modifiers?: unknown; floorTile?: unknown }> | undefined;
  const hasRooms = Array.isArray(roomsRaw) && roomsRaw.length > 0;
  if (!hasRooms && (!Array.isArray(wingsRaw) || wingsRaw.length === 0)) {
    throw new ToolError("wings 또는 rooms 필요: 바닥 bbox 배열 {x,y,w,h} (rooms는 {id,x,y,w,h,theme?})", {
      code: "invalid-args",
    });
  }
  const wings = (Array.isArray(wingsRaw) ? wingsRaw : []).map((w) => ({
    x: Math.floor(Number(w.x)),
    y: Math.floor(Number(w.y)),
    w: Math.floor(Number(w.w)),
    h: Math.floor(Number(w.h)),
  }));
  const rooms = hasRooms
    ? roomsRaw!.map((r: Record<string, unknown>, index) => {
        const roomTheme = r.theme !== undefined ? String(r.theme).trim() : undefined;
        if (roomTheme !== undefined && !roomTheme) {
          throw new ToolError(`rooms[${index}].theme 이 비어 있다`, { code: "invalid-args" });
        }
        return {
          id: String(r.id ?? `room_${index}`),
          x: Math.floor(Number(r.x)),
          y: Math.floor(Number(r.y)),
          w: Math.floor(Number(r.w)),
          h: Math.floor(Number(r.h)),
          theme: roomTheme,
          modifiers: parseThemeModifiers(r.modifiers, `rooms[${index}].modifiers`),
          floorTile: r.floorTile !== undefined ? Math.floor(Number(r.floorTile)) : undefined,
        };
      })
    : undefined;
  const innerDoorsRaw = args.innerDoors as Array<{ x?: unknown; y?: unknown }> | undefined;
  const innerDoors = Array.isArray(innerDoorsRaw)
    ? innerDoorsRaw.map((d) => ({ x: Math.floor(Number(d.x)), y: Math.floor(Number(d.y)) }))
    : undefined;
  const wallMaterial = args.wallMaterial !== undefined ? String(args.wallMaterial) : undefined;
  if (wallMaterial !== undefined && !["cream", "gold-brick", "stone-brick"].includes(wallMaterial)) {
    throw new ToolError(`wallMaterial must be cream|gold-brick|stone-brick`, { code: "invalid-args" });
  }
  return {
    mapId,
    name,
    width,
    height,
    wings,
    rooms,
    innerDoors,
    door: { x: Math.floor(door.x), y: Math.floor(door.y) },
    theme,
    themeModifiers: parseThemeModifiers(args.themeModifiers, "themeModifiers"),
    // seed 미지정 시 매번 새 판을 뽑는다(구버그: 상수 1 고정 → 재생성 항상 동일).
    seed: args.seed !== undefined ? Math.floor(Number(args.seed)) : Date.now() % 1_000_000,
    floorTile: args.floorTile !== undefined ? Math.floor(Number(args.floorTile)) : undefined,
    wallMaterial: wallMaterial as InteriorRoomPlan["wallMaterial"],
    ...(tilesetId ? { tilesetId } : {}),
  };
}

function vocabFor(plan: InteriorRoomPlan, project?: Project) {
  const tilesetId = plan.tilesetId ?? INTERIOR_ROOM_TILESET_ID;
  return interiorVocabFromTileset(project?.tilesets[tilesetId]);
}

export const INTERIOR_ROOM_KIT: RoomHarnessKit<InteriorRoomPlan> = {
  kitId: INTERIOR_ROOM_KIT_ID,
  themes: INTERIOR_ROOM_THEMES,
  buildOrder: INTERIOR_ROOM_BUILD_ORDER,
  demoPlans: INTERIOR_ROOM_DEMO_PLANS,
  ensureHarness: ensureInteriorRoomHarness,
  parsePlan: parseInteriorPlan,
  mapIdOf: (plan) => plan.mapId,
  nameOf: (plan) => plan.name,
  createEmptyMap: createEmptyRoomMap,
  applyLayer: (map, plan, layer, project) =>
    applyInteriorRoomLayer(map, plan, layer as RoomLayer, vocabFor(plan, project)),
  runPipeline: (plan, project) => runInteriorRoomPipeline(plan, vocabFor(plan, project)),
  evaluate: (map, plan, attempt, project) => evaluateInteriorRoom(map, plan, attempt, 3, vocabFor(plan, project)),
  demoMatch: (demo) => INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === demo),
  startLog: (plan) => `[plan] wings=${plan.wings.length} theme=${plan.theme}`,
};
