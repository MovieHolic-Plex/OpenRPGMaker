import { charsetFrameIndex, type CharsetDirection } from "@/assets/easyrpgRtp";
import {
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
  type InteriorRoomTheme,
  type InteriorWallMaterial,
  type RoomSpec,
  VR,
} from "@/editor/interiorRoomPipeline";
import { DEFAULT_TILE_SIZE } from "@/project/defaults/constants";
import type { Command, EventPageGraphic, GameEvent, GameMap, MapId, Project } from "@/project/types";
import type { HouseKitId } from "./houseKit";

/**
 * 마을/집 키트 실내 — villager-room-v1.
 *
 * 외관(stories / footprint / kitId) → scale+program → 실내.
 * 다층(2~3): 층마다 서브맵 + 계단 칩(STAIRS_*) + playerTouch transfer.
 * 맵 트리: 1F 아래 2F, 2F 아래 3F.
 */

export type HouseInteriorScale = "cottage2" | "cottage3" | "cottage-l" | "mansion";
export type HouseStoryCount = 1 | 2 | 3;

export type HouseInteriorProgram =
  | "dwelling"
  | "shop"
  | "inn"
  | "workshop"
  | "study"
  | "manor";

/** @deprecated 착지 기본값만 유지. */
export const HOUSE_INTERIOR_SIZE = { width: 20, height: 20 } as const;
export const HOUSE_INTERIOR_ENTRY = { x: 10, y: 15 } as const;
export const HOUSE_INTERIOR_EXIT = { x: 10, y: 16 } as const;

export const HOUSE_DOOR_CHARSET_TEXTURE = "tex_easyrpg_charset_object1";
export const HOUSE_DOOR_FRAME_WAIT_MS = 100;
export const HOUSE_DOOR_OPEN_HOLD_MS = 180;

export type HouseDoorVariant = {
  readonly textureKey: typeof HOUSE_DOOR_CHARSET_TEXTURE;
  readonly characterIndex: number;
};

export type InteriorFloorMap = {
  readonly floor: number;
  readonly mapId: MapId;
  readonly map: GameMap;
};

export type InteriorMapResult = {
  readonly map: GameMap;
  readonly entry: { readonly x: number; readonly y: number };
  readonly exit: { readonly x: number; readonly y: number };
  readonly scale: HouseInteriorScale;
  readonly program: HouseInteriorProgram;
  readonly stories: HouseStoryCount;
  readonly upperMapId?: MapId;
  readonly upperMap?: GameMap;
  readonly floors: readonly InteriorFloorMap[];
  /** Pipeline critique/furniture warnings. */
  readonly warnings?: readonly string[];
};

export type HouseExteriorHint = {
  readonly stories?: HouseStoryCount;
  readonly kitId?: HouseKitId;
  readonly footprintArea?: number;
  readonly templateId?: string;
  readonly program?: HouseInteriorProgram;
  readonly ownerName?: string;
};

export function houseDoorVariantForKit(kitId: HouseKitId): HouseDoorVariant {
  return {
    textureKey: HOUSE_DOOR_CHARSET_TEXTURE,
    characterIndex: kitId === "blue-stone" || kitId === "slate-wood" ? 4 : 0,
  };
}

export const HOUSE_DOOR_OPEN_DIRECTIONS = ["down", "right", "up"] as const satisfies readonly CharsetDirection[];
export type HouseDoorOpenStep = 0 | 1 | 2;

/**
 * RM2k3 Object1 door open: same character slot, **direction** down → right → up
 * (not walk-pattern left/center/right on the down row).
 * Pattern column stays 0 (closed-door column).
 */
export function houseDoorFrameIndex(kitId: HouseKitId, step: HouseDoorOpenStep): number {
  return charsetFrameIndex({
    characterIndex: houseDoorVariantForKit(kitId).characterIndex,
    direction: HOUSE_DOOR_OPEN_DIRECTIONS[step],
    pattern: 0,
  });
}

export function houseDoorGraphic(kitId: HouseKitId, step: HouseDoorOpenStep = 0): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: HOUSE_DOOR_CHARSET_TEXTURE },
    pattern: houseDoorFrameIndex(kitId, step),
  };
}

export function houseDoorOpenCommands(options: {
  readonly eventId: string;
  readonly interiorMapId: MapId;
  readonly kitId: HouseKitId;
  readonly entryX?: number;
  readonly entryY?: number;
}): Command[] {
  const commands: Command[] = [];
  for (const step of [0, 1, 2] as const) {
    commands.push({
      kind: "setEventGraphicPattern",
      eventId: options.eventId,
      pattern: houseDoorFrameIndex(options.kitId, step),
    });
    commands.push({ kind: "wait", ms: step === 2 ? HOUSE_DOOR_OPEN_HOLD_MS : HOUSE_DOOR_FRAME_WAIT_MS });
  }
  commands.push({
    kind: "transfer",
    mapId: options.interiorMapId,
    x: options.entryX ?? HOUSE_INTERIOR_ENTRY.x,
    y: options.entryY ?? HOUSE_INTERIOR_ENTRY.y,
    fade: "black",
  });
  return commands;
}

export function createHouseDoorEvent(options: {
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
  readonly interiorMapId: MapId;
  readonly kitId: HouseKitId;
  readonly name?: string;
  readonly entryX?: number;
  readonly entryY?: number;
}): GameEvent {
  return {
    id: options.eventId,
    x: options.x,
    y: options.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${options.eventId}_page`,
        name: options.name ?? "집 문",
        conditions: [],
        graphic: houseDoorGraphic(options.kitId),
        trigger: { kind: "action" },
        priority: "same",
        // RM2k3 door: fixed graphic so action-turn / idle remapping cannot snap the door closed.
        animationType: "fixedGraphic",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: houseDoorOpenCommands({
          eventId: options.eventId,
          interiorMapId: options.interiorMapId,
          kitId: options.kitId,
          entryX: options.entryX,
          entryY: options.entryY,
        }),
      },
    ],
  };
}

export function houseInteriorScaleFromSeed(seed: number): HouseInteriorScale {
  const n = (seed >>> 0) % 10;
  if (n === 0) return "mansion";
  if (n <= 3) return "cottage3";
  return "cottage2";
}

export function resolveHouseInteriorScale(
  exterior: HouseExteriorHint | undefined,
  seed: number,
): HouseInteriorScale {
  if (exterior?.stories && exterior.stories >= 2) {
    if (exterior.stories >= 3 || exterior.program === "manor") return "mansion";
    return exterior.footprintArea !== undefined && exterior.footprintArea >= 70 ? "mansion" : "cottage3";
  }
  if (exterior?.templateId === "rect-2f" || exterior?.templateId === "rect-3f") return "cottage3";
  if (exterior?.templateId === "cottage-l" || exterior?.templateId === "l-cottage") return "cottage-l";
  // 1층 영주/촌장 저택도 레퍼런스 L형 코티지 평면(주방·침실·홀) — 2층 이상만 풀 맨션.
  if (exterior?.program === "manor") {
    if (exterior.stories && exterior.stories >= 2) return "mansion";
    return "cottage-l";
  }
  // 1층 민가 기본: 레퍼런스 L형(주방·침실·홀) — 상점/여관/공방/서재는 아래 분기로.
  if (
    (exterior?.stories === undefined || exterior.stories === 1)
    && (exterior?.program === undefined || exterior.program === "dwelling")
    && exterior?.templateId !== "rect-tall"
  ) {
    return "cottage-l";
  }
  if (exterior?.program === "inn" || exterior?.program === "shop") return "cottage3";
  const area = exterior?.footprintArea;
  if (area !== undefined) {
    if (area >= 64) return "mansion";
    if (area >= 48) return "cottage3";
    return "cottage2";
  }
  return houseInteriorScaleFromSeed(seed);
}

export function resolveHouseInteriorProgram(
  exterior: HouseExteriorHint | undefined,
  seed: number,
): HouseInteriorProgram {
  if (exterior?.program) return exterior.program;
  const name = (exterior?.ownerName ?? "").toLowerCase();
  if (/상인|상점|장사|merchant|shop|리코/.test(name)) return "shop";
  if (/여관|주점|술|inn|tavern|숙박/.test(name)) return "inn";
  if (/대장|목수|공방|craft|smith|workshop/.test(name)) return "workshop";
  if (/학자|서기|마법|sage|study|사서/.test(name)) return "study";
  if (/촌장|영주|귀족|lord|chief|로안/.test(name)) return "manor";
  if (exterior?.stories && exterior.stories >= 2) return seed % 2 === 0 ? "dwelling" : "study";
  const pick = (seed >>> 0) % 5;
  return (["dwelling", "shop", "workshop", "study", "inn"] as const)[pick]!;
}

export function wallMaterialForKit(kitId: HouseKitId | undefined): InteriorWallMaterial | undefined {
  if (!kitId) return undefined;
  if (kitId === "blue-stone" || kitId === "slate-wood") return "stone-brick";
  if (kitId === "bright-plaster" || kitId === "amber-wood") return "cream";
  return undefined;
}

export function createHouseInteriorMap(options: {
  readonly id: MapId;
  readonly name: string;
  readonly returnMapId: MapId;
  readonly returnX: number;
  readonly returnY: number;
  readonly exitEventId: string;
  readonly seed: number;
  readonly scale?: HouseInteriorScale;
  readonly theme?: InteriorRoomTheme;
  readonly exterior?: HouseExteriorHint;
  readonly upperMapId?: MapId;
  readonly upperExitEventId?: string;
}): InteriorMapResult {
  const seed = options.seed >>> 0;
  const exterior = options.exterior;
  const stories: HouseStoryCount =
    exterior?.stories === 3 ? 3 : exterior?.stories === 2 ? 2 : 1;
  const scale = options.scale ?? resolveHouseInteriorScale(exterior, seed);
  const program = resolveHouseInteriorProgram(exterior, seed);
  // Luxury gold walls only for full mansions (2F+), not 1F cottage-l manor.
  // Kit wall mapping stays aligned with exterior blue-stone etc. unless scale is mansion.
  const wallMaterial =
    scale === "mansion"
      ? ("gold-brick" as const)
      : wallMaterialForKit(exterior?.kitId);

  const groundPlan = buildHouseInteriorPlan({
    mapId: options.id,
    name: stories >= 2 ? `${options.name} (1층)` : options.name,
    seed,
    scale,
    program,
    floor: "ground",
    themeHint: options.theme,
    wallMaterial,
  });
  const door = groundPlan.door;
  const entry = { x: door.x, y: Math.max(0, door.y - 1) };

  const groundBuilt = materializeInteriorMap({
    plan: groundPlan,
    id: options.id,
    name: groundPlan.name,
    exitEventId: options.exitEventId,
    returnMapId: options.returnMapId,
    returnX: options.returnX,
    returnY: options.returnY,
    entry,
    door,
  });
  const ground = groundBuilt.map;
  const pipelineWarnings: string[] = [...groundBuilt.warnings];

  const floors: InteriorFloorMap[] = [{ floor: 1, mapId: options.id, map: ground }];
  if (stories === 1) {
    return {
      map: ground,
      entry,
      exit: door,
      scale,
      program,
      stories: 1,
      floors,
      ...(pipelineWarnings.length ? { warnings: pipelineWarnings } : {}),
    };
  }

  let lowerMap = ground;
  let lowerMapId = options.id;
  let stairCell = pickStairCell(ground, entry, door);

  for (let floor = 2; floor <= stories; floor += 1) {
    const floorMapId = (
      floor === 2 && options.upperMapId ? options.upperMapId : `${options.id}_f${floor}`
    ) as MapId;
    const floorSeed = (seed ^ Math.imul(floor, 0x9e3779b1)) >>> 0;
    const floorProgram: HouseInteriorProgram =
      program === "shop" || program === "inn" ? "dwelling" : program;
    const floorScale: HouseInteriorScale =
      floor >= 3 ? "cottage2" : scale === "mansion" ? "cottage3" : "cottage2";

    const floorPlan = buildHouseInteriorPlan({
      mapId: floorMapId,
      name: `${options.name} (${floor}층)`,
      seed: floorSeed,
      scale: floorScale,
      program: floorProgram,
      floor: "upper",
      wallMaterial,
    });

    const stairDown = floorPlan.door;
    const floorEntry = { x: stairDown.x, y: Math.max(0, stairDown.y - 1) };
    const exitId =
      floor === 2 && options.upperExitEventId
        ? options.upperExitEventId
        : `${options.exitEventId}_f${floor}`;

    const floorBuilt = materializeInteriorMap({
      plan: floorPlan,
      id: floorMapId,
      name: floorPlan.name,
      exitEventId: exitId,
      returnMapId: lowerMapId,
      returnX: stairCell.x,
      returnY: stairCell.y,
      entry: floorEntry,
      door: stairDown,
      skipDefaultExit: true,
    });
    const floorMap = floorBuilt.map;
    pipelineWarnings.push(...floorBuilt.warnings);

    stampStairsUp(lowerMap, stairCell);
    placeStairTransfer(lowerMap, {
      id: `${options.exitEventId}_stairs_up_f${floor - 1}`,
      x: stairCell.x,
      y: stairCell.y,
      name: `${floor}층으로`,
      mapId: floorMapId,
      destX: floorEntry.x,
      destY: floorEntry.y,
    });

    stampStairsDown(floorMap, stairDown);
    placeStairTransfer(floorMap, {
      id: exitId,
      x: stairDown.x,
      y: stairDown.y,
      name: `${floor - 1}층으로`,
      mapId: lowerMapId,
      destX: stairCell.x,
      destY: stairCell.y,
    });

    clearPassableLanding(lowerMap, stairCell.x, stairCell.y, { keepUpper: true });
    clearPassableLanding(floorMap, stairDown.x, stairDown.y, { keepUpper: true });
    clearPassableLanding(floorMap, floorEntry.x, floorEntry.y);

    floors.push({ floor, mapId: floorMapId, map: floorMap });
    lowerMap = floorMap;
    lowerMapId = floorMapId;
    stairCell = pickStairCell(floorMap, floorEntry, stairDown);
  }

  const f2 = floors.find((f) => f.floor === 2);
  return {
    map: ground,
    entry,
    exit: door,
    scale,
    program,
    stories,
    upperMapId: f2?.mapId,
    upperMap: f2?.map,
    floors,
    ...(pipelineWarnings.length ? { warnings: pipelineWarnings } : {}),
  };
}

export function buildHouseInteriorPlan(input: {
  readonly mapId: MapId;
  readonly name: string;
  readonly seed: number;
  readonly scale: HouseInteriorScale;
  readonly program?: HouseInteriorProgram;
  readonly floor?: "ground" | "upper";
  readonly themeHint?: InteriorRoomTheme;
  readonly wallMaterial?: InteriorWallMaterial;
}): InteriorRoomPlan {
  const program = input.program ?? "dwelling";
  const floor = input.floor ?? "ground";
  if (floor === "upper") {
    return upperFloorPlan(input.mapId, input.name, input.seed, program, input.wallMaterial);
  }
  switch (input.scale) {
    case "mansion":
      return mansionPlan(input.mapId, input.name, input.seed, program, input.wallMaterial);
    case "cottage-l":
      return cottageLPlan(input.mapId, input.name, input.seed, program, input.themeHint, input.wallMaterial);
    case "cottage3":
      return cottage3Plan(input.mapId, input.name, input.seed, program, input.themeHint, input.wallMaterial);
    case "cottage2":
    default:
      return cottage2Plan(input.mapId, input.name, input.seed, program, input.themeHint, input.wallMaterial);
  }
}

// ── plans ────────────────────────────────────────────────────────────

function cottage2Plan(
  mapId: MapId,
  name: string,
  seed: number,
  program: HouseInteriorProgram,
  themeHint?: InteriorRoomTheme,
  wallMaterial?: InteriorWallMaterial,
): InteriorRoomPlan {
  const rooms = roomsForProgram(program, "cottage2", themeHint, seed);
  return {
    mapId,
    name,
    width: 20,
    height: 20,
    wings: [],
    rooms,
    innerDoors: [{ x: 10, y: 8 }],
    door: { x: 10, y: 16 },
    theme: rooms[rooms.length - 1]?.theme ?? "dining",
    floorTile: floorTileForProgram(program, seed),
    seed,
    ...(wallMaterial ? { wallMaterial } : {}),
  };
}


/**
 * L형 민가 (레퍼런스: 북서 주방/벽난로·북동 침실·남측 홀 식탁).
 * 주방 돌바닥 + 침실 + 넓은 거실 식탁 — 칩셋 가구(화덕·침대·장탁자)로 채운다.
 */
function cottageLPlan(
  mapId: MapId,
  name: string,
  seed: number,
  program: HouseInteriorProgram,
  themeHint?: InteriorRoomTheme,
  wallMaterial?: InteriorWallMaterial,
): InteriorRoomPlan {
  // Three-room L: kitchen NW, bedroom NE, living S-west.
  // Gapless shared edges become partition walls; innerDoors are openings.
  const livingTheme: InteriorRoomTheme =
    program === "inn" ? "tavern" :
    program === "shop" ? "dining" :
    program === "workshop" ? "kitchen" :
    themeHint === "tavern" || themeHint === "kitchen" || themeHint === "dining" ? themeHint :
    "dining";
  const northWestTheme: InteriorRoomTheme =
    program === "shop" || program === "workshop" ? "storage" :
    program === "study" ? "study" :
    "kitchen";
  const northEastTheme: InteriorRoomTheme =
    program === "inn" ? "bedroom" :
    program === "study" ? "study" :
    program === "shop" ? "storage" :
    "bedroom";

  const rooms: RoomSpec[] = [
    {
      id: "kitchen",
      x: 2,
      y: 2,
      w: 9,
      h: 5,
      theme: northWestTheme,
      floorTile: northWestTheme === "kitchen" || northWestTheme === "storage" ? 12 : 72,
    },
    {
      id: "bedroom",
      x: 11,
      y: 2,
      w: 7,
      h: 5,
      theme: northEastTheme,
      floorTile: 72,
    },
    {
      id: "living",
      x: 2,
      y: 7,
      w: 12,
      h: 6,
      theme: livingTheme,
      floorTile: livingTheme === "kitchen" ? 12 : 72,
    },
  ];

  return {
    mapId,
    name,
    width: 20,
    height: 16,
    wings: [],
    rooms,
    innerDoors: [
      { x: 10, y: 4 },
      { x: 6, y: 6 },
      { x: 13, y: 6 },
    ],
    door: { x: 7, y: 12 },
    theme: livingTheme,
    floorTile: floorTileForProgram(program, seed),
    seed,
    wallMaterial: wallMaterial ?? "stone-brick",
  };
}

function cottage3Plan(
  mapId: MapId,
  name: string,
  seed: number,
  program: HouseInteriorProgram,
  themeHint?: InteriorRoomTheme,
  wallMaterial?: InteriorWallMaterial,
): InteriorRoomPlan {
  const rooms = roomsForProgram(program, "cottage3", themeHint, seed);
  return {
    mapId,
    name,
    width: 20,
    height: 20,
    wings: [],
    rooms,
    innerDoors: [
      { x: 10, y: 4 },
      { x: 6, y: 8 },
      { x: 14, y: 8 },
    ],
    door: { x: 10, y: 16 },
    theme: rooms.find((r) => r.id === "living" || r.id === "shop" || r.id === "tavern")?.theme ?? "dining",
    floorTile: floorTileForProgram(program, seed),
    seed,
    ...(wallMaterial ? { wallMaterial } : {}),
  };
}

function mansionPlan(
  mapId: MapId,
  name: string,
  seed: number,
  program: HouseInteriorProgram,
  wallMaterial?: InteriorWallMaterial,
): InteriorRoomPlan {
  const luxury = program === "manor" || program === "dwelling";
  const rooms: RoomSpec[] = [
    { id: "master", x: 2, y: 2, w: 6, h: 5, theme: "bedroom" },
    { id: "guest", x: 10, y: 2, w: 6, h: 5, theme: program === "inn" ? "bedroom" : "study" },
    { id: "study", x: 18, y: 2, w: 4, h: 5, theme: program === "workshop" ? "storage" : "study" },
    { id: "hall", x: 2, y: 9, w: 20, h: 2, theme: "corridor" },
    {
      id: "dining",
      x: 2,
      y: 13,
      w: 8,
      h: 5,
      theme: program === "inn" ? "tavern" : program === "shop" ? "dining" : "dining",
    },
    {
      id: "kitchen",
      x: 12,
      y: 13,
      w: 6,
      h: 5,
      theme: program === "workshop" ? "storage" : "kitchen",
      floorTile: 12,
    },
    { id: "storage", x: 18, y: 13, w: 4, h: 5, theme: "storage" },
  ];
  return {
    mapId,
    name,
    width: 24,
    height: 22,
    wings: [],
    rooms,
    wallMaterial: wallMaterial ?? (luxury ? "gold-brick" : "stone-brick"),
    innerDoors: [
      { x: 5, y: 7 },
      { x: 13, y: 7 },
      { x: 19, y: 7 },
      { x: 6, y: 11 },
      { x: 14, y: 11 },
      { x: 19, y: 11 },
    ],
    door: { x: 6, y: 17 },
    theme: "dining",
    floorTile: floorTileForProgram(program, seed),
    seed,
  };
}

/** 2층: 침실 중심. */
function upperFloorPlan(
  mapId: MapId,
  name: string,
  seed: number,
  program: HouseInteriorProgram,
  wallMaterial?: InteriorWallMaterial,
): InteriorRoomPlan {
  const rooms: RoomSpec[] =
    program === "study"
      ? [
          { id: "study", x: 2, y: 3, w: 8, h: 5, theme: "study" },
          { id: "bedroom", x: 12, y: 3, w: 6, h: 5, theme: "bedroom" },
          { id: "hall", x: 2, y: 11, w: 16, h: 6, theme: "corridor" },
        ]
      : [
          { id: "bedroom", x: 2, y: 3, w: 8, h: 5, theme: "bedroom" },
          { id: "guest", x: 12, y: 3, w: 6, h: 5, theme: "bedroom" },
          { id: "hall", x: 2, y: 11, w: 16, h: 6, theme: "storage" },
        ];
  return {
    mapId,
    name,
    width: 20,
    height: 20,
    wings: [],
    rooms,
    innerDoors: [
      { x: 10, y: 4 },
      { x: 6, y: 8 },
      { x: 14, y: 8 },
    ],
    // 2F “문” 위치 = 계단 착지 (남쪽)
    door: { x: 10, y: 16 },
    theme: "bedroom",
    floorTile: 72,
    seed,
    ...(wallMaterial ? { wallMaterial } : {}),
  };
}

function roomsForProgram(
  program: HouseInteriorProgram,
  scale: "cottage2" | "cottage3",
  themeHint: InteriorRoomTheme | undefined,
  seed: number,
): RoomSpec[] {
  if (scale === "cottage2") {
    switch (program) {
      case "shop":
        return [
          { id: "stock", x: 2, y: 3, w: 16, h: 5, theme: "storage" },
          { id: "shop", x: 2, y: 11, w: 16, h: 6, theme: "dining" },
        ];
      case "inn":
        return [
          { id: "room", x: 2, y: 3, w: 16, h: 5, theme: "bedroom" },
          { id: "tavern", x: 2, y: 11, w: 16, h: 6, theme: "tavern" },
        ];
      case "workshop":
        return [
          { id: "work", x: 2, y: 3, w: 16, h: 5, theme: "storage" },
          { id: "living", x: 2, y: 11, w: 16, h: 6, theme: "kitchen", floorTile: 12 },
        ];
      case "study":
        return [
          { id: "study", x: 2, y: 3, w: 16, h: 5, theme: "study" },
          { id: "living", x: 2, y: 11, w: 16, h: 6, theme: "dining" },
        ];
      default: {
        const livingTheme: InteriorRoomTheme =
          themeHint === "kitchen" || themeHint === "tavern" || themeHint === "dining" ? themeHint : "dining";
        const bedTheme: InteriorRoomTheme = themeHint === "study" ? "study" : "bedroom";
        // seed로 좌우/상하 스왑 느낌 — 북측 테마만 바꿈
        if ((seed >>> 0) % 3 === 0) {
          return [
            { id: "bedroom", x: 2, y: 3, w: 16, h: 5, theme: bedTheme },
            { id: "living", x: 2, y: 11, w: 16, h: 6, theme: "kitchen", floorTile: 12 },
          ];
        }
        return [
          { id: "bedroom", x: 2, y: 3, w: 16, h: 5, theme: bedTheme },
          { id: "living", x: 2, y: 11, w: 16, h: 6, theme: livingTheme },
        ];
      }
    }
  }
  // cottage3
  switch (program) {
    case "shop":
      return [
        { id: "stock", x: 2, y: 3, w: 8, h: 5, theme: "storage" },
        { id: "back", x: 12, y: 3, w: 6, h: 5, theme: "bedroom" },
        { id: "shop", x: 2, y: 11, w: 16, h: 6, theme: "dining" },
      ];
    case "inn":
      return [
        { id: "room_a", x: 2, y: 3, w: 8, h: 5, theme: "bedroom" },
        { id: "room_b", x: 12, y: 3, w: 6, h: 5, theme: "bedroom" },
        { id: "tavern", x: 2, y: 11, w: 16, h: 6, theme: "tavern" },
      ];
    case "workshop":
      return [
        { id: "work", x: 2, y: 3, w: 8, h: 5, theme: "storage" },
        { id: "store", x: 12, y: 3, w: 6, h: 5, theme: "storage" },
        { id: "living", x: 2, y: 11, w: 16, h: 6, theme: "kitchen", floorTile: 12 },
      ];
    case "study":
      return [
        { id: "study", x: 2, y: 3, w: 8, h: 5, theme: "study" },
        { id: "archive", x: 12, y: 3, w: 6, h: 5, theme: "study" },
        { id: "living", x: 2, y: 11, w: 16, h: 6, theme: "dining" },
      ];
    case "manor":
      return [
        { id: "bedroom", x: 2, y: 3, w: 8, h: 5, theme: "bedroom" },
        { id: "study", x: 12, y: 3, w: 6, h: 5, theme: "study" },
        { id: "living", x: 2, y: 11, w: 16, h: 6, theme: "dining" },
      ];
    default:
      return [
        { id: "bedroom", x: 2, y: 3, w: 8, h: 5, theme: "bedroom" },
        { id: "study", x: 12, y: 3, w: 6, h: 5, theme: seed % 2 === 0 ? "study" : "storage" },
        { id: "living", x: 2, y: 11, w: 16, h: 6, theme: seed % 3 === 0 ? "kitchen" : "dining", floorTile: seed % 3 === 0 ? 12 : undefined },
      ];
  }
}

function floorTileForProgram(program: HouseInteriorProgram, seed: number): number {
  if (program === "workshop") return 12; // 돌
  if (program === "inn") return seed % 2 === 0 ? 72 : 102;
  if (program === "shop") return 72;
  return 72;
}


// ── materialize / stairs ─────────────────────────────────────────────

function materializeInteriorMap(input: {
  readonly plan: InteriorRoomPlan;
  readonly id: MapId;
  readonly name: string;
  readonly exitEventId: string;
  readonly returnMapId: MapId;
  readonly returnX: number;
  readonly returnY: number;
  readonly entry: { readonly x: number; readonly y: number };
  readonly door: { readonly x: number; readonly y: number };
  readonly skipDefaultExit?: boolean;
}): { map: GameMap; warnings: readonly string[] } {
  const result = runInteriorRoomPipeline(input.plan);
  const map = result.map;
  map.id = input.id;
  map.name = input.name;
  map.tileSize = map.tileSize ?? DEFAULT_TILE_SIZE;

  map.events = (map.events ?? []).filter(
    (event) => event.id !== `ev_entrance_${map.id}` && !(event.x === input.door.x && event.y === input.door.y),
  );
  if (!input.skipDefaultExit) {
    map.events.push(
      createHouseInteriorExitEvent({
        eventId: input.exitEventId,
        x: input.door.x,
        y: input.door.y,
        returnMapId: input.returnMapId,
        returnX: input.returnX,
        returnY: input.returnY,
      }),
    );
  }

  clearPassableLanding(map, input.entry.x, input.entry.y);
  if (!input.skipDefaultExit) {
    clearPassableLanding(map, input.door.x, input.door.y);
  }
  return { map, warnings: result.warnings ?? [] };
}

function pickStairCell(
  map: GameMap,
  entry: { x: number; y: number },
  door: { x: number; y: number },
): { x: number; y: number } {
  const candidates = [
    { x: entry.x, y: Math.max(1, entry.y - 2) },
    { x: entry.x - 1, y: Math.max(1, entry.y - 2) },
    { x: entry.x + 1, y: Math.max(1, entry.y - 2) },
    { x: door.x, y: Math.max(1, door.y - 3) },
  ];
  for (const c of candidates) {
    if (c.x < 1 || c.y < 0 || c.x >= map.width - 1 || c.y >= map.height) continue;
    if (c.x === door.x && c.y === door.y) continue;
    return c;
  }
  return { x: Math.min(map.width - 2, Math.max(1, entry.x)), y: Math.max(1, entry.y - 1) };
}

function clearPassableLanding(
  map: GameMap,
  x: number,
  y: number,
  opts?: { readonly keepUpper?: boolean },
): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  const index = y * map.width + x;
  map.lowerTiles[index] = 72;
  if (!opts?.keepUpper) map.upperTiles[index] = -1;
  map.events = (map.events ?? []).filter(
    (event) => !(event.x === x && event.y === y && event.id.startsWith("ev_inspect_")),
  );
}

function stampStairsUp(map: GameMap, center: { x: number; y: number }): void {
  const y = center.y;
  for (const [dx, tile] of [[-1, VR.STAIRS_L], [0, VR.STAIRS_M], [1, VR.STAIRS_R]] as const) {
    const x = center.x + dx;
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
    const i = y * map.width + x;
    map.lowerTiles[i] = 72;
    map.upperTiles[i] = tile;
  }
}

function stampStairsDown(map: GameMap, center: { x: number; y: number }): void {
  const y = center.y;
  for (const [dx, tile] of [[-1, VR.STAIRS_L], [0, VR.STAIRS_DOWN], [1, VR.STAIRS_R]] as const) {
    const x = center.x + dx;
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
    const i = y * map.width + x;
    map.lowerTiles[i] = 72;
    map.upperTiles[i] = tile;
  }
}

function placeStairTransfer(
  map: GameMap,
  opts: {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly name: string;
    readonly mapId: MapId;
    readonly destX: number;
    readonly destY: number;
  },
): void {
  map.events = (map.events ?? []).filter(
    (e) => e.id !== opts.id && !(e.x === opts.x && e.y === opts.y),
  );
  map.events.push({
    id: opts.id,
    x: opts.x,
    y: opts.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${opts.id}_page`,
        name: opts.name,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          {
            kind: "transfer",
            mapId: opts.mapId,
            x: opts.destX,
            y: opts.destY,
            fade: "black",
          },
        ],
      },
    ],
  });
}

function createHouseInteriorExitEvent(options: {
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
  readonly returnMapId: MapId;
  readonly returnX: number;
  readonly returnY: number;
}): GameEvent {
  return {
    id: options.eventId,
    x: options.x,
    y: options.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${options.eventId}_page`,
        name: "집 출구",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          {
            kind: "transfer",
            mapId: options.returnMapId,
            x: options.returnX,
            y: options.returnY,
            fade: "black",
          },
        ],
      },
    ],
  };
}

/** 프로젝트에 실내 맵(1F + 상층 서브맵 전부) 등록. */
export function registerInteriorMaps(draft: Project, interior: InteriorMapResult): void {
  if (interior.floors.length > 0) {
    for (const floor of interior.floors) {
      draft.maps[floor.mapId] = floor.map;
    }
    return;
  }
  draft.maps[interior.map.id] = interior.map;
  if (interior.upperMap && interior.upperMapId) {
    draft.maps[interior.upperMapId] = interior.upperMap;
  }
}
