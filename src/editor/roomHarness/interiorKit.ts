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
import type { ConceptOverlayRoom, ConceptOverlayThing } from "@/editor/conceptBundleResolve";
import {
  resolveHouseInteriorProgram,
  resolveHouseInteriorScale,
  wallMaterialForKit,
  type HouseExteriorHint,
  type HouseInteriorProgram,
  type HouseInteriorScale,
} from "@/editor/houseInteriors";
import { ALL_HOUSE_KIT_IDS, isHouseKitId } from "@/editor/houseKit";
import { isConceptChipId, isConceptPlaceRole } from "@/project/types/conceptBundle";
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

const HOUSE_INTERIOR_PROGRAMS = ["dwelling", "shop", "inn", "workshop", "study", "manor"] as const;

function isHouseInteriorProgram(value: string): value is HouseInteriorProgram {
  return (HOUSE_INTERIOR_PROGRAMS as readonly string[]).includes(value);
}

function parseRequiredTrimmedString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ToolError(`${label} must be a non-empty string`, { code: "invalid-args" });
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ToolError(`${label} must be a non-empty string`, { code: "invalid-args" });
  }
  return trimmed;
}

function parseExteriorHint(value: unknown): HouseExteriorHint | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError("exterior must be an object", { code: "invalid-args" });
  }
  const rec = value as Record<string, unknown>;

  let stories: HouseExteriorHint["stories"];
  if (rec.stories !== undefined) {
    if (rec.stories !== 1 && rec.stories !== 2 && rec.stories !== 3) {
      throw new ToolError("exterior.stories must be 1|2|3", { code: "invalid-args" });
    }
    stories = rec.stories;
  }

  let kitId: HouseExteriorHint["kitId"];
  if (rec.kitId !== undefined) {
    const raw = parseRequiredTrimmedString(rec.kitId, "exterior.kitId");
    if (!isHouseKitId(raw)) {
      throw new ToolError(`exterior.kitId must be ${ALL_HOUSE_KIT_IDS.join("|")}`, { code: "invalid-args" });
    }
    kitId = raw;
  }

  let templateId: string | undefined;
  if (rec.templateId !== undefined) {
    templateId = parseRequiredTrimmedString(rec.templateId, "exterior.templateId");
  }

  let footprintArea: number | undefined;
  if (rec.footprintArea !== undefined) {
    if (typeof rec.footprintArea !== "number" || !Number.isFinite(rec.footprintArea)) {
      throw new ToolError("exterior.footprintArea must be a number", { code: "invalid-args" });
    }
    footprintArea = rec.footprintArea;
  }

  let program: HouseInteriorProgram | undefined;
  if (rec.program !== undefined) {
    const raw = parseRequiredTrimmedString(rec.program, "exterior.program");
    if (!isHouseInteriorProgram(raw)) {
      throw new ToolError(`exterior.program must be ${HOUSE_INTERIOR_PROGRAMS.join("|")}`, { code: "invalid-args" });
    }
    program = raw;
  }

  let ownerName: string | undefined;
  if (rec.ownerName !== undefined) {
    ownerName = parseRequiredTrimmedString(rec.ownerName, "exterior.ownerName");
  }

  return {
    ...(stories !== undefined ? { stories } : {}),
    ...(kitId !== undefined ? { kitId } : {}),
    ...(templateId !== undefined ? { templateId } : {}),
    ...(footprintArea !== undefined ? { footprintArea } : {}),
    ...(program !== undefined ? { program } : {}),
    ...(ownerName !== undefined ? { ownerName } : {}),
  };
}

/** InteriorRoomPlan plus non-breaking exterior echo fields that downstream code ignores. */
export type ParsedInteriorRoomPlan = InteriorRoomPlan & {
  readonly exterior?: HouseExteriorHint;
  readonly exteriorScale?: HouseInteriorScale;
  readonly exteriorProgram?: HouseInteriorProgram;
};

export function parseInteriorPlan(args: Record<string, unknown>): ParsedInteriorRoomPlan {
  const mapId = String(args.mapId ?? "").trim();
  const name = String(args.name ?? mapId).trim();
  const width = Math.floor(Number(args.width ?? 16));
  const height = Math.floor(Number(args.height ?? 13));
  const seed = args.seed !== undefined ? Math.floor(Number(args.seed)) : Date.now() % 1_000_000;
  const exterior = parseExteriorHint(args.exterior);
  const exteriorProgram = exterior ? resolveHouseInteriorProgram(exterior, seed) : undefined;
  const exteriorScale = exterior ? resolveHouseInteriorScale(exterior, seed) : undefined;
  const theme = String(args.theme ?? exteriorProgram ?? "bedroom").trim();
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
  let wallMaterial = args.wallMaterial !== undefined ? String(args.wallMaterial) : undefined;
  if (wallMaterial !== undefined && !["cream", "gold-brick", "stone-brick"].includes(wallMaterial)) {
    throw new ToolError(`wallMaterial must be cream|gold-brick|stone-brick`, { code: "invalid-args" });
  }
  if (wallMaterial === undefined && exterior) {
    wallMaterial = wallMaterialForKit(exterior.kitId);
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
    seed,
    floorTile: args.floorTile !== undefined ? Math.floor(Number(args.floorTile)) : undefined,
    wallMaterial: wallMaterial as InteriorRoomPlan["wallMaterial"],
    ...(tilesetId ? { tilesetId } : {}),
    ...parseConceptOverlay(args.concept),
    ...(exterior
      ? {
          exterior,
          ...(exteriorScale !== undefined ? { exteriorScale } : {}),
          ...(exteriorProgram !== undefined ? { exteriorProgram } : {}),
        }
      : {}),
  };
}

function parseConceptOverlay(value: unknown): Pick<InteriorRoomPlan, "concept"> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object") throw new ToolError("concept must be an object", { code: "invalid-args" });
  const record = value as Record<string, unknown>;
  const rooms: Record<string, ConceptOverlayRoom> = {};
  const roomsRaw = record.rooms;
  if (roomsRaw && typeof roomsRaw === "object") {
    for (const [roomId, raw] of Object.entries(roomsRaw as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const role = String(entry.role ?? "room");
      const thingsRaw = Array.isArray(entry.things) ? entry.things : [];
      const things: ConceptOverlayThing[] = [];
      for (const item of thingsRaw) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const objectId = String(rec.objectId ?? "").trim();
        if (!objectId) continue;
        const chips = Array.isArray(rec.chips) ? rec.chips.map((chip) => String(chip)).filter(isConceptChipId) : [];
        things.push({
          thingId: String(rec.thingId ?? objectId),
          objectId,
          label: String(rec.label ?? objectId),
          chips,
          required: rec.required === true,
        });
      }
      rooms[roomId] = {
        placeId: String(entry.placeId ?? roomId),
        placeLabel: String(entry.placeLabel ?? entry.placeId ?? roomId),
        role: isConceptPlaceRole(role) ? role : "room",
        things,
      };
    }
  }
  return {
    concept: {
      bundleId: String(record.bundleId ?? ""),
      facilityId: String(record.facilityId ?? ""),
      facilityLabel: String(record.facilityLabel ?? ""),
      rooms,
    },
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
