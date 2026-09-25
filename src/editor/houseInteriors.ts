import { generateHouseTopology } from "./houseTopology";
import { openHousePlan } from "./openHousePlan";
import { compactHousePlan } from "./compactHousePlan";
import { charsetFrameIndex, type CharsetDirection } from "@/assets/easyrpgRtp";
import {
  DOOR_CLOSE_SE_POOL,
  DOOR_OPEN_SE_POOL,
  resolveSeVariant,
  type SeVariantContext,
} from "@/assets/seThemeVariants";
import {
  floorMaskFromPlan,
  runInteriorRoomPipeline,
  VR,
  interiorVocabFromTileset,
  type InteriorRoomPlan,
  type InteriorRoomTheme,
  type InteriorWallMaterial,
  type RoomSpec,
} from "@/editor/interiorRoomPipeline";
import { CEILING_TILE, shapeInteriorCeiling, southDoorOpening } from "@/editor/interiorHouseWallGrammar";
import { DEFAULT_TILE_SIZE, TILE } from "@/project/defaults/constants";
import type { Command, EventPageGraphic, GameEvent, GameMap, MapId, Project } from "@/project/types";
import type { HouseKitId } from "./houseKit";
import { bindSeedHouseInteriorPlan, conceptHouseFloorPlan, isCodeDraftFacility, resolveHouseConcept } from "./interiorConceptPlan";
import { createCanonicalHouseInterior } from "./spatial/legacyHouseInterior";
import { conceptFacilityLevels, type ResolvedConceptFacility } from "./conceptBundleResolve";
import { convertEntranceToDescent, findConceptDescent, linkConceptTransfers, listConceptConnections } from "./interiorConceptEvents";
import { ToolError } from "./tools/types";

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
export const HOUSE_DOOR_BACKGROUND_TILE = 359;

/** Exterior house door anchors occupy the bottom cell of a two-cell opening. */
export function stampHouseDoorBackground(map: GameMap, door: { readonly x: number; readonly y: number }): void {
  for (const y of [door.y - 1, door.y]) {
    const index = y * map.width + door.x;
    map.lowerTiles[index] = HOUSE_DOOR_BACKGROUND_TILE;
    map.upperTiles[index] = TILE.EMPTY;
    if (map.lowerTileStacks) delete map.lowerTileStacks[index];
    if (map.upperTileStacks) delete map.upperTileStacks[index];
  }
}

export const HOUSE_DOOR_FRAME_WAIT_MS = 100;
export const HOUSE_DOOR_OPEN_HOLD_MS = 180;
/**
 * 문 열림 효과음 — CC0 카탈로그 「문 열기 01」(Kenney RPG Audio, 0.92초).
 * 파일이 레포에 있어(public/assets/se/kenney-rpg/dooropen-1.ogg) 오프라인에서도 울린다.
 * 리소스 id 는 seCatalog 소속이라 이벤트 참조 검증(resourceReferenceValidation)을 그대로 통과한다.
 */
export const HOUSE_DOOR_OPEN_SE = "cc0-se-kra-dooropen-1";
/** 문 닫힘 효과음 — CC0 카탈로그 「문 닫기 01」(Kenney RPG Audio). 열기 01 과 짝. */
export const HOUSE_DOOR_CLOSE_SE = "cc0-se-kra-doorclose-1";

export type HouseDoorVariant = {
  readonly textureKey: typeof HOUSE_DOOR_CHARSET_TEXTURE;
  readonly characterIndex: number;
};

export type InteriorFloorMap = {
  readonly floor: number;
  readonly mapId: MapId;
  readonly map: GameMap;
};

/**
 * 실내 도면의 출처 — designed=호출자가 interiorPlan 으로 설계, authored=저작된 개념 꾸러미,
 * seed=절차 도면(scale×program) + 초안 장소·물건 씨앗. seed 는 "설계 없음 + 초안뿐" 인
 * 프로젝트의 기본 경로다(2026-09-12: 초안 템플릿을 찍어 모든 집 실내가 같아지던 결함).
 */
export type InteriorBlueprintSource = "designed" | "authored" | "seed";

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
  readonly interiorSource: InteriorBlueprintSource;
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

/** 파랑 계열 지붕 킷(석조 실내·돌 문짝) — 재료 킷 중 슬레이트·검은 기와도 여기. houseKit 을 import 하면 순환이라 id 로 적는다. */
const BLUE_FAMILY_KITS: ReadonlySet<HouseKitId> = new Set<HouseKitId>(["blue-stone", "slate-wood", "slate-brick", "charcoal-timber"]);

export function houseDoorVariantForKit(kitId: HouseKitId): HouseDoorVariant {
  return {
    textureKey: HOUSE_DOOR_CHARSET_TEXTURE,
    characterIndex: BLUE_FAMILY_KITS.has(kitId) ? 4 : 0,
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
  readonly seed?: number;
  readonly exclude?: SeVariantContext["exclude"];
}): Command[] {
  // 효과음은 첫 프레임과 같은 틱에 — 열림 모션(100+100+180ms)보다 SE 가 길어도 전이 뒤까지 이어진다.
  const resourceId = resolveSeVariant(DOOR_OPEN_SE_POOL, HOUSE_DOOR_OPEN_SE, {
    seed: options.seed,
    exclude: options.exclude,
  });
  const commands: Command[] = [{ kind: "playAudio", resourceId, loop: false }];
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
  readonly seed?: number;
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
        name: options.name ?? "집 문",
        conditions: [],
        graphic: houseDoorGraphic(options.kitId),
        // 열린 문이 기본값: 문 앞 통행 칸의 발판이 밟으면 전이시킨다(아래 참조).
        // 문 스프라이트 자체는 벽 칸 장식이라 below — 통행을 막지 않는다.
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        // RM2k3 door: fixed graphic so action-turn / idle remapping cannot snap the door closed.
        animationType: "fixedGraphic",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: houseDoorOpenCommands({
          eventId: options.eventId,
          interiorMapId: options.interiorMapId,
          kitId: options.kitId,
          entryX: options.entryX,
          entryY: options.entryY,
          seed: options.seed,
        }),
      },
    ],
  };
}

/**
 * 열린 문의 발판 — 문 앞 통행 칸에 놓는 투명 playerTouch 전이.
 *
 * 왜 문 스프라이트와 분리하나: 문 칸은 벽 타일이라 플레이어가 밟을 수 없고,
 * playerTouch+below 는 벽 칸 위에서 발동하지 않는다. 그래서 문 그림(벽 칸 장식)과
 * 전이 발판(문 앞 통행 칸)을 나눈다 — 시작집 문(STARTER_HOUSE_DOOR_APPROACH)과 같은 배치다.
 */
export function createHouseDoorStepEvent(options: {
  readonly eventId: string;
  /** Run the existing door page so authored opening effects/conditions remain authoritative. */
  readonly doorEventId?: string;
  readonly x: number;
  readonly y: number;
  readonly interiorMapId: MapId;
  readonly name?: string;
  readonly entryX?: number;
  readonly entryY?: number;
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
        name: options.name ?? "집 문",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: options.doorEventId ? [{ kind: "callMapEvent", eventId: options.doorEventId }] : [
          {
            kind: "transfer",
            mapId: options.interiorMapId,
            x: options.entryX ?? HOUSE_INTERIOR_ENTRY.x,
            y: options.entryY ?? HOUSE_INTERIOR_ENTRY.y,
            fade: "black",
          },
        ],
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
  const templateId = exterior?.templateId;
  // Catalog L-family ids are 'l' / 'l-mirror' / 'l-wide' / 'l-deep' (cottage-l|l-cottage aliases do not exist).
  if (
    templateId === "l"
    || templateId === "l-mirror"
    || templateId === "l-wide"
    || templateId === "l-deep"
    || templateId === "cottage-l"
    || templateId === "l-cottage"
  ) {
    return "cottage-l";
  }
  if (templateId === "cottage-low" || templateId === "hut-low" || templateId === "barn-low") {
    return "cottage2";
  }
  if (templateId === "rect-2f" || templateId === "rect-2f-slim" || templateId === "rect-3f") return "cottage3";
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
  void seed; // kept for API compatibility — no lottery when heuristics miss
  return houseProgramForOwner(exterior?.ownerName) ?? "dwelling";
}

/**
 * 집주인 이름·직업에서 실내 용도를 읽는다. 못 읽으면 undefined(평범한 민가).
 * 어부·선원·사냥꾼·농부는 연장·통을 두는 작업 공간(workshop), 등대지기·항해사·치료사·사제는
 * 지도·책·기록이 있는 서재(study) — 같은 민가 도면을 모든 직업에 찍지 않는다.
 */
export function houseProgramForOwner(ownerName: string | undefined): HouseInteriorProgram | undefined {
  const name = (ownerName ?? "").toLowerCase();
  if (!name) return undefined;
  if (/상인|상점|장사|잡화|merchant|shop|리코/.test(name)) return "shop";
  if (/여관|주점|술|inn|tavern|숙박/.test(name)) return "inn";
  if (/대장|목수|공방|craft|smith|workshop/.test(name)) return "workshop";
  if (/어부|선원|뱃사공|낚시|어망|사냥|농부|목동|fisher|sailor|boatman|hunter|farmer/.test(name)) return "workshop";
  if (/학자|서기|마법|sage|study|사서/.test(name)) return "study";
  if (/등대|항해|지도|약초|치료|의사|사제|신관|수녀|lighthouse|navigator|healer|priest|doctor/.test(name)) return "study";
  if (/촌장|영주|귀족|lord|chief|로안/.test(name)) return "manor";
  return undefined;
}

export function wallMaterialForKit(kitId: HouseKitId | undefined): InteriorWallMaterial | undefined {
  if (!kitId) return undefined;
  if (BLUE_FAMILY_KITS.has(kitId)) return "stone-brick";
  return "cream";
}

export function createHouseInteriorMap(options: {
  readonly project?: Project;
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
  /**
   * 호출자가 설계한 실내(place_concept plan 을 해석한 꾸러미). 있으면 꾸러미 템플릿 대신 이 도면을 짓는다 —
   * 같은 시설 템플릿을 매번 찍어내지 않기 위한 설계 입력이다(2026-09-11).
   */
  readonly interiorConcept?: ResolvedConceptFacility;
}): InteriorMapResult {
  const seed = options.seed >>> 0;
  const exterior = options.exterior;
  let stories: HouseStoryCount =
    exterior?.stories === 3 ? 3 : exterior?.stories === 2 ? 2 : 1;
  const scale = options.scale ?? resolveHouseInteriorScale(exterior, seed);
  const program = resolveHouseInteriorProgram(exterior, seed);
  if (options.project?.spatialAuthoring !== undefined) return createCanonicalHouseInterior({ ...options, project: options.project }, { scale, program });
  // 도면 정본은 설계(interiorPlan) > 저작된 꾸러미 > 절차 도면 순이다. 코드 초안 그대로의
  // 해석(isCodeDraftFacility)은 도면이 아니라 씨앗 — 절차 도면으로 실루엣을 내고 초안의
  // 장소·물건을 방 테마에 묶는다(bindInteriorConceptPlan). 초안 그대로 찍으면 같은
  // program 의 집마다 같은 실내가 찍힌다(2026-09-12).
  const concept = options.interiorConcept ?? (options.project ? resolveAuthoredHouseConcept(options.project, program) : undefined);
  const interiorSource: InteriorBlueprintSource =
    options.interiorConcept !== undefined ? "designed" : concept ? "authored" : "seed";
  /** 절차 도면을 꾸러미 장소·물건(씨앗)으로 묶는다. 씨앗이 없으면 테마 어휘 문법이 꾸민다. */
  const seedBlueprint = (plan: InteriorRoomPlan): InteriorRoomPlan => {
    if (!options.project) return plan;
    try {
      return bindSeedHouseInteriorPlan(plan, options.project, program);
    } catch (error) {
      if (error instanceof ToolError) return plan;
      throw error;
    }
  };
  if (concept) {
    stories = Math.min(3, Math.max(stories, ...conceptFacilityLevels(concept.bundle, concept.facility))) as HouseStoryCount;
  }
  // Luxury gold walls only for full mansions (2F+), not 1F cottage-l manor.
  // Kit wall mapping stays aligned with exterior blue-stone etc. unless scale is mansion.
  const wallMaterial =
    scale === "mansion"
      ? ("gold-brick" as const)
      : wallMaterialForKit(exterior?.kitId);

  const groundPlan = concept ? conceptHouseFloorPlan(concept, {
    mapId: options.id, name: stories >= 2 ? `${options.name} (1층)` : options.name, seed, level: 1,
  }) : seedBlueprint(buildHouseInteriorPlan({
    project: options.project,
    mapId: options.id,
    name: stories >= 2 ? `${options.name} (1층)` : options.name,
    seed,
    scale,
    program,
    floor: "ground",
    themeHint: options.theme,
    wallMaterial,
  }));
  const door = groundPlan.door;
  const exitAt = groundPlan.concept ? southDoorOpening(door, groundPlan.height) : door;
  const entry = { x: exitAt.x, y: Math.max(0, exitAt.y - 1) };

  const groundBuilt = materializeInteriorMap({
    project: options.project,
    plan: groundPlan,
    id: options.id,
    name: groundPlan.name,
    exitEventId: options.exitEventId,
    returnMapId: options.returnMapId,
    returnX: options.returnX,
    returnY: options.returnY,
    entry,
    door: exitAt,
    seed,
  });
  const ground = groundBuilt.map;
  const pipelineWarnings: string[] = [...groundBuilt.warnings];

  const floors: InteriorFloorMap[] = [{ floor: 1, mapId: options.id, map: ground }];
  if (stories === 1) {
    return {
      map: ground,
      entry,
      exit: exitAt,
      scale,
      program,
      stories: 1,
      floors,
      interiorSource,
      ...(pipelineWarnings.length ? { warnings: pipelineWarnings } : {}),
    };
  }

  let lowerMap = ground;
  let lowerMapId = options.id;
  // 계단은 복도 끝(2026-07-20 사용자 교정) — 복도가 있으면 문에서 먼 쪽 복도 끝, 없으면 기존 휴리스틱.
  let stairCell = listConceptConnections(ground)[0] ?? corridorStairCell(groundPlan)
    ?? wallBackedStairCell(ground, groundPlan, [entry, exitAt, door]) ?? pickStairCell(ground, entry, door);

  for (let floor = 2; floor <= stories; floor += 1) {
    const floorMapId = (
      floor === 2 && options.upperMapId ? options.upperMapId : `${options.id}_f${floor}`
    ) as MapId;
    const floorSeed = (seed ^ Math.imul(floor, 0x9e3779b1)) >>> 0;
    const floorProgram: HouseInteriorProgram =
      program === "shop" || program === "inn" ? "dwelling" : program;
    const floorScale: HouseInteriorScale =
      floor >= 3 ? "cottage2" : scale === "mansion" ? "cottage3" : "cottage2";

    const floorPlan = concept ? conceptHouseFloorPlan(concept, {
      mapId: floorMapId, name: `${options.name} (${floor}층)`, seed: floorSeed, level: floor,
    }) : seedBlueprint(buildHouseInteriorPlan({
      project: options.project,
      mapId: floorMapId,
      name: `${options.name} (${floor}층)`,
      seed: floorSeed,
      scale: floorScale,
      program: floorProgram,
      floor: "upper",
      wallMaterial,
    }));

    let stairDown = floorPlan.door;
    // 착지 방향: 계단 위 칸이 바닥이면 위(남향 착지), 아니면 아래 — 복도 북단 계단은 아래로 내린다.
    const floorMask = floorMaskFromPlan(floorPlan);
    const aboveIsFloor =
      stairDown.y - 1 >= 0 && floorMask[(stairDown.y - 1) * floorPlan.width + stairDown.x] === true;
    let floorEntry = { x: stairDown.x, y: aboveIsFloor ? stairDown.y - 1 : Math.min(floorPlan.height - 1, stairDown.y + 1) };
    const exitId =
      floor === 2 && options.upperExitEventId
        ? options.upperExitEventId
        : `${options.exitEventId}_f${floor}`;

    const floorBuilt = materializeInteriorMap({
      project: options.project,
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
    const authoredDescent = findConceptDescent(floorMap);
    if (authoredDescent) {
      stairDown = { x: authoredDescent.x, y: authoredDescent.y };
      floorEntry = { x: stairDown.x, y: stairDown.y + 1 };
    }
    const authoredAscent = listConceptConnections(lowerMap).length > 0;
    // 하강 착지는 올라가는 계단(밟기 전이) 칸이 아니라 그 옆 바닥이어야 한다 —
    // 계단 칸에 내리면 playerTouch 가 즉시 재발동해 위층으로 튕긴다(transfer-retrigger).
    const lowerLanding = authoredAscent
      ? { x: stairCell.x, y: stairCell.y + 1 }
      : stairFootCell(lowerMap, stairCell);

    if (authoredAscent) {
      // Keep the authored staircase picture and connect every transfer chip.
      const lowerDoor = floor === 2 ? groundPlan.door : (lowerMap.roomHarnessPlan!.plan as InteriorRoomPlan).door;
      linkConceptTransfers(lowerMap, lowerDoor, { mapId: floorMapId, ...floorEntry });
    } else {
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
    }

    if (authoredDescent) {
      convertEntranceToDescent(floorMap, { mapId: lowerMapId, ...lowerLanding });
    } else {
      sealUpperFloorDoorway(floorMap, floorPlan);
      stampStairsDown(floorMap, stairDown);
      // 위층에는 바깥 문이 없다 — 파이프라인이 매 층 두는 정문 이벤트는 return 대상 없이
      // 자기 맵 (door.x, door.y+1) 을 가리킨다. 개념 층에선 그 칸이 남벽이라
      // transfer-impassable 로 커밋이 거부된다. 하강은 아래 계단 전이가 소유한다.
      floorMap.events = (floorMap.events ?? []).filter(
        (event) => event.id !== `ev_entrance_${floorMap.id}`,
      );
    }
    placeStairTransfer(floorMap, {
      id: exitId,
      x: stairDown.x,
      y: stairDown.y,
      name: `${floor - 1}층으로`,
      mapId: lowerMapId,
      destX: lowerLanding.x,
      destY: lowerLanding.y,
    });

    if (!authoredAscent) {
      clearPassableLanding(lowerMap, stairCell.x, stairCell.y, { keepUpper: true });
      clearPassableLanding(lowerMap, lowerLanding.x, lowerLanding.y);
    }
    if (!authoredDescent) {
      clearPassableLanding(floorMap, stairDown.x, stairDown.y, { keepUpper: true });
      clearPassableLanding(floorMap, floorEntry.x, floorEntry.y);
    }

    floors.push({ floor, mapId: floorMapId, map: floorMap });
    lowerMap = floorMap;
    lowerMapId = floorMapId;
    stairCell = listConceptConnections(floorMap)[0] ?? corridorStairCell(floorPlan)
      ?? wallBackedStairCell(floorMap, floorPlan, [floorEntry, stairDown]) ?? pickStairCell(floorMap, floorEntry, stairDown);
  }

  const f2 = floors.find((f) => f.floor === 2);
  return {
    map: ground,
    entry,
    exit: exitAt,
    scale,
    program,
    stories,
    upperMapId: f2?.mapId,
    upperMap: f2?.map,
    floors,
    interiorSource,
    ...(pipelineWarnings.length ? { warnings: pipelineWarnings } : {}),
  };
}

/**
 * 집 실내의 도면 정본은 저작된 꾸러미뿐이다 — 코드 초안은 씨앗으로 되돌린다(2026-09-12).
 * 꾸러미가 비었거나 이 program 의 시설이 없으면 undefined — 호출부가 절차 도면으로 짓는다.
 */
function resolveAuthoredHouseConcept(project: Project, program: HouseInteriorProgram): ResolvedConceptFacility | undefined {
  try {
    const resolved = resolveHouseConcept(project, program);
    return isCodeDraftFacility(resolved) ? undefined : resolved;
  } catch (error) {
    if (error instanceof ToolError) return undefined;
    throw error;
  }
}

export function buildHouseInteriorPlan(input: {
  readonly mapId: MapId;
  readonly name: string;
  readonly seed: number;
  readonly scale: HouseInteriorScale;
  readonly project?: Project;
  readonly program?: HouseInteriorProgram;
  readonly floor?: "ground" | "upper";
  readonly themeHint?: InteriorRoomTheme;
  readonly wallMaterial?: InteriorWallMaterial;
  readonly returnMapId?: MapId;
  readonly returnX?: number;
  readonly returnY?: number;
}): InteriorRoomPlan {
  const program = input.program ?? "dwelling";
  const floor = input.floor ?? "ground";
  const finish = (plan: InteriorRoomPlan): InteriorRoomPlan => {
    const compact = compactHousePlan(plan, program);
    const activities = program === "dwelling" || program === "study" || program === "workshop" ? openHousePlan(compact) : compact;
    const shifted = shiftPlanForCeiling(generateHouseTopology(activities, `${program}:${input.scale}:${floor}`, candidate => {
      const shiftedCandidate = shiftPlanForCeiling(candidate);
      try {
        const bound = input.project ? bindSeedHouseInteriorPlan(shiftedCandidate, input.project, program) : shiftedCandidate;
        const result = runInteriorRoomPipeline(bound, input.project ? interiorVocabFromTileset(input.project.tilesets[bound.tilesetId ?? "easyrpg_chipset_interior"]) : undefined);
        return result.ok && !result.warnings.some(warning => /자리 없음|칩을 달지|walkability:|plan:/.test(warning));
      } catch (error) {
        if (error instanceof ToolError) return false;
        throw error;
      }
    }));
    // 같은 용도·규모의 집이 한 도면으로 찍히지 않게 — 시드가 도면을 좌우로 뒤집는다.
    const oriented = ((input.seed >>> 3) & 1) === 1 ? mirrorPlanX(shifted) : shifted;
    if (input.returnMapId === undefined && input.returnX === undefined && input.returnY === undefined) {
      return oriented;
    }
    return {
      ...oriented,
      ...(input.returnMapId !== undefined ? { returnMapId: input.returnMapId } : {}),
      ...(input.returnX !== undefined ? { returnX: input.returnX } : {}),
      ...(input.returnY !== undefined ? { returnY: input.returnY } : {}),
    };
  };
  if (floor === "upper") {
    return finish(upperFloorPlan(input.mapId, input.name, input.seed, program, input.wallMaterial));
  }
  switch (input.scale) {
    case "mansion":
      return finish(mansionPlan(input.mapId, input.name, input.seed, program, input.wallMaterial));
    case "cottage-l":
      return finish(cottageLPlan(input.mapId, input.name, input.seed, program, input.themeHint, input.wallMaterial));
    case "cottage3":
      return finish(cottage3Plan(input.mapId, input.name, input.seed, program, input.themeHint, input.wallMaterial));
    case "cottage2":
    default:
      return finish(cottage2Plan(input.mapId, input.name, input.seed, program, input.themeHint, input.wallMaterial));
  }
}

/** 방 배치를 방들의 가로 범위 중심으로 좌우 반전한다(벽 문법·가구는 반전된 도면에서 새로 짓는다). */
function mirrorPlanX(plan: InteriorRoomPlan): InteriorRoomPlan {
  const boxes = plan.rooms && plan.rooms.length > 0 ? plan.rooms : plan.wings;
  if (boxes.length === 0) return plan;
  const span = Math.min(...boxes.map((box) => box.x)) + Math.max(...boxes.map((box) => box.x + box.w - 1));
  const flipBox = <T extends { readonly x: number; readonly w: number }>(box: T): T => ({ ...box, x: span - (box.x + box.w - 1) });
  const flipCell = <T extends { readonly x: number }>(cell: T): T => ({ ...cell, x: span - cell.x });
  return {
    ...plan,
    rooms: plan.rooms?.map(flipBox),
    wings: plan.wings.map(flipBox),
    innerDoors: plan.innerDoors?.map(flipCell),
    door: flipCell(plan.door),
  };
}

/**
 * 천장 정본(2026-07-20) 여백 보정 — 북벽은 천장 1행 + 벽면 2행이 필요하므로
 * 방 최상단 y가 3 미만이면 전체를 아래로 밀고 높이를 늘린다("벽 위에는 반드시 천장").
 */
function shiftPlanForCeiling(plan: InteriorRoomPlan): InteriorRoomPlan {
  const boxes = plan.rooms && plan.rooms.length > 0 ? plan.rooms : plan.wings;
  const minY = Math.min(...boxes.map((box) => box.y));
  const shift = Math.max(0, 3 - minY);
  if (shift === 0) return plan;
  return {
    ...plan,
    height: plan.height + shift,
    rooms: (plan.rooms ?? []).map((room) => ({ ...room, y: room.y + shift })),
    wings: plan.wings.map((wing) => ({ ...wing, y: wing.y + shift })),
    innerDoors: (plan.innerDoors ?? []).map((d) => ({ ...d, y: d.y + shift })),
    door: { ...plan.door, y: plan.door.y + shift },
  };
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
 * 주방 돌바닥 + 침실 + 넓은 거실 식탁 — 타일 그림판 가구(화덕·침대·장탁자)로 채운다.
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
    program === "inn" || program === "study" ? "bedroom" :
    program === "shop" ? "storage" :
    "bedroom";

  // 천장 정본 v2: 상하로 붙은 방 사이 수평 벽은 반드시 3행(천장 1 + 크림 면 2) —
  // 북측 방과 거실 사이를 3행 갭으로 벌린다("천장 아래 벽 / 벽 위 천장" 쌍 불변식).
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
      y: 10,
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
    height: 19,
    wings: [],
    rooms,
    innerDoors: [
      { x: 10, y: 4 },
      { x: 6, y: 7 },
      { x: 13, y: 7 },
    ],
    door: { x: 7, y: 15 },
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
  // 2026-07-20 사용자 교정(대저택 정본): 세로 중앙 복도 + 남단 입구 + 복도 끝(북단) 계단.
  // 복도는 붉은 카펫 러너(paintCorridorCarpets), 방은 보랏빛 돌바닥(12) — "나무바닥만"에서 탈피.
  // 좌우 방은 복도와 1열 천장 기둥으로 나뉘고 측면 문(innerDoors)으로 연결된다.
  const rooms: RoomSpec[] = [
    { id: "master", x: 2, y: 2, w: 8, h: 6, theme: "bedroom", floorTile: 12 },
    { id: "study", x: 15, y: 2, w: 7, h: 6, theme: program === "workshop" ? "storage" : "study", floorTile: 12 },
    { id: "hall", x: 11, y: 2, w: 3, h: 16, theme: "corridor" },
    {
      id: "dining",
      x: 2,
      y: 11,
      w: 8,
      h: 7,
      theme: program === "inn" ? "tavern" : "dining",
      floorTile: 12,
    },
    {
      id: "kitchen",
      x: 15,
      y: 11,
      w: 7,
      h: 7,
      theme: program === "shop" ? "storage" : "kitchen",
      floorTile: 12,
    },
  ];
  return {
    mapId,
    name,
    width: 24,
    height: 21,
    wings: [],
    rooms,
    wallMaterial: wallMaterial ?? (luxury ? "gold-brick" : "stone-brick"),
    innerDoors: [
      { x: 10, y: 5 },
      { x: 14, y: 5 },
      { x: 10, y: 14 },
      { x: 14, y: 14 },
    ],
    door: { x: 12, y: 17 },
    theme: "dining",
    floorTile: floorTileForProgram(program, seed),
    seed,
  };
}

/** 2층: 침실 중심. manor(대저택)는 1층과 같은 세로 복도 정본 — 복도 북단이 계단 착지. */
function upperFloorPlan(
  mapId: MapId,
  name: string,
  seed: number,
  program: HouseInteriorProgram,
  wallMaterial?: InteriorWallMaterial,
): InteriorRoomPlan {
  if (program === "manor") {
    return {
      mapId,
      name,
      width: 24,
      height: 18,
      wings: [],
      rooms: [
        { id: "master2", x: 2, y: 2, w: 8, h: 6, theme: "bedroom", floorTile: 12 },
        { id: "guest", x: 15, y: 2, w: 7, h: 6, theme: "bedroom", floorTile: 12 },
        { id: "hall2", x: 11, y: 2, w: 3, h: 14, theme: "corridor" },
        { id: "study2", x: 2, y: 11, w: 8, h: 5, theme: "study", floorTile: 12 },
        { id: "storage2", x: 15, y: 11, w: 7, h: 5, theme: "storage", floorTile: 12 },
      ],
      innerDoors: [
        { x: 10, y: 5 },
        { x: 14, y: 5 },
        { x: 10, y: 13 },
        { x: 14, y: 13 },
      ],
      // 2층 "문" = 계단 착지 — 복도 끝(북단).
      door: { x: 12, y: 2 },
      theme: "bedroom",
      floorTile: 12,
      seed,
      wallMaterial: wallMaterial ?? "gold-brick",
    };
  }
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
        { id: "bedroom", x: 12, y: 3, w: 6, h: 5, theme: "bedroom" },
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
  readonly project?: Project;
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
  readonly seed?: number;
}): { map: GameMap; warnings: readonly string[] } {
  const result = runInteriorRoomPipeline(input.plan, input.project
    ? interiorVocabFromTileset(input.project.tilesets[input.plan.tilesetId ?? "easyrpg_chipset_interior"])
    : undefined);
  const map = result.map;
  map.roomHarnessPlan = { kitId: "villager-room-v1", plan: structuredClone(input.plan) };
  map.id = input.id;
  map.name = input.name;
  map.tileSize = map.tileSize ?? DEFAULT_TILE_SIZE;

  map.events = (map.events ?? []).filter(
    (event) => input.skipDefaultExit || (event.id !== `ev_entrance_${map.id}` && !(event.x === input.door.x && event.y === input.door.y)),
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
        seed: input.seed,
      }),
    );
  }

  clearPassableLanding(map, input.entry.x, input.entry.y);
  if (!input.skipDefaultExit) {
    clearPassableLanding(map, input.door.x, input.door.y, { keepUpper: Boolean(input.plan.concept) });
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

/**
 * 복도 없는 집의 오르막 자리 — 북벽에 등을 대고(위 칸이 벽면), 오르는 쪽(동쪽)에 착지 바닥,
 * 남쪽에서 다가설 바닥이 있는 칸. 방 한가운데 떠 있는 계단·벽으로 오르는 계단을 만들지 않는다.
 * 가구를 부수지 않도록 계단·착지·접근 칸이 비어 있는 자리만 쓴다(없으면 undefined → 옛 휴리스틱).
 * 서쪽이 벽인 구석을 먼저, 침실보다 공용 방을 먼저, 입구에서 가까운 자리를 먼저 고른다.
 */
function wallBackedStairCell(
  map: GameMap,
  plan: InteriorRoomPlan,
  avoid: readonly { readonly x: number; readonly y: number }[],
): { x: number; y: number } | undefined {
  const floor = floorMaskFromPlan(plan);
  const W = map.width;
  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < map.height && floor[y * W + x] === true;
  const upper = (x: number, y: number) => map.upperTiles[y * W + x] ?? -1;
  const hasEvent = (x: number, y: number, props: boolean) => (map.events ?? [])
    .some((event) => event.x === x && event.y === y && !(props && event.id.startsWith("ev_inspect_")));
  // 엄격: 비어 있는 칸만. 느슨: 계단 앞·착지의 단일 적재 소품(통·상자·자루)은 치우고 쓴다.
  const free = (x: number, y: number, lenient: boolean) => isFloor(x, y)
    && PASSABLE_LOWER_TILES.has(map.lowerTiles[y * W + x] ?? -1)
    && (upper(x, y) < 0 || (lenient && STAIR_CLEARABLE_PROPS.has(upper(x, y))))
    && !hasEvent(x, y, lenient)
    && !avoid.some((cell) => cell.x === x && cell.y === y);
  const roomAt = (x: number, y: number) => (plan.rooms ?? []).find((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h);
  const entry = avoid[0] ?? plan.door;
  for (const lenient of [false, true]) {
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = 1; y < map.height - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const room = roomAt(x, y);
        if (!room || isFloor(x, y - 1)) continue;
        if (!free(x, y, false) || !free(x + 1, y, lenient) || !free(x, y + 1, lenient)) continue;
        const score = (isFloor(x - 1, y) ? 0 : 100) + (room.theme === "bedroom" ? 0 : 50)
          - (Math.abs(x - entry.x) + Math.abs(y - entry.y));
        candidates.push({ x, y, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    // 계단 칸은 밟으면 층을 옮긴다 — 그 칸을 막아도 나머지 바닥이 입구에서 다 이어져야 한다.
    const reach = (stair: { x: number; y: number } | undefined, cleared: readonly { x: number; y: number }[]): number => {
      const open = (x: number, y: number) => isFloor(x, y)
        && (upper(x, y) < 0 || cleared.some((cell) => cell.x === x && cell.y === y));
      const seen = new Set<number>([entry.y * W + entry.x]);
      const queue = [entry];
      while (queue.length) {
        const cell = queue.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const x = cell.x + dx;
          const y = cell.y + dy;
          if (!open(x, y) || seen.has(y * W + x) || (stair && stair.x === x && stair.y === y)) continue;
          seen.add(y * W + x);
          queue.push({ x, y });
        }
      }
      return seen.size;
    };
    for (const cell of candidates) {
      const cleared = [{ x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }];
      // 치운 칸은 새로 열릴 뿐 — 원래 닿던 바닥이 계단 하나 말고는 줄지 않으면 된다.
      if (reach(cell, cleared) < reach(undefined, []) - 1) continue;
      for (const c of cleared) clearPassableLanding(map, c.x, c.y);
      return { x: cell.x, y: cell.y };
    }
  }
  return undefined;
}

/** 계단 자리를 내기 위해 치워도 되는 단일 적재 소품(상위 레이어) — 세트 가구(탁자·의자·침대)는 제외. */
const STAIR_CLEARABLE_PROPS = new Set<number>([VR.BARREL, VR.CRATE, VR.GRAIN, VR.BOX, VR.JARS, VR.BUCKET]);

/**
 * 위층에는 바깥 문이 없다 — 벽 문법은 모든 층의 문 칸 아래 천장 띠를 바닥으로 뚫는데, 위층에서
 * 그 돌출부가 하강 계단 바로 남쪽에 입구처럼 남는다. 남벽을 다시 닫는다.
 */
function sealUpperFloorDoorway(map: GameMap, plan: InteriorRoomPlan): void {
  const floor = floorMaskFromPlan(plan);
  const x = plan.door.x;
  for (let y = plan.door.y + 1; y < map.height; y += 1) {
    const index = y * map.width + x;
    if (floor[index] || !PASSABLE_LOWER_TILES.has(map.lowerTiles[index] ?? -1)) break;
    map.lowerTiles[index] = CEILING_TILE;
    map.upperTiles[index] = TILE.EMPTY;
    map.events = (map.events ?? []).filter((event) => !(event.x === x && event.y === y));
  }
  shapeInteriorCeiling(map);
}

/**
 * 밟기 계단 칸 옆의 하강 착지 — 계단 칸 위에 내리면 playerTouch 전이가 즉시 재발동한다.
 * 남쪽(y+1)을 우선한다 — 계단은 보통 복도 북단이라 플레이어는 남쪽에서 다가선다.
 */
function stairFootCell(map: GameMap, stair: { readonly x: number; readonly y: number }): { x: number; y: number } {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const x = stair.x + dx;
    const y = stair.y + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (!PASSABLE_LOWER_TILES.has(map.lowerTiles[y * map.width + x] ?? -1)) continue;
    if ((map.upperTiles[y * map.width + x] ?? -1) >= 0) continue;
    if ((map.events ?? []).some((event) => event.x === x && event.y === y)) continue;
    return { x, y };
  }
  return { x: stair.x, y: stair.y + 1 };
}

/**
 * 계단 셀 정본(2026-07-20): 복도가 있으면 그 층 문(착지)에서 먼 쪽 복도 끝.
 * 오르막 444 는 오른쪽 위로 오른다 — 2칸 복도에서 가운데(=동쪽 칸)에 두면 칸막이 벽으로 올라간다.
 * 서쪽 칸에 두고 동쪽 칸을 계단 머리의 착지로 남긴다.
 */
function corridorStairCell(plan: InteriorRoomPlan): { x: number; y: number } | null {
  const corridor = (plan.rooms ?? []).find((room) => room.theme === "corridor");
  if (!corridor) return null;
  const x = corridor.w >= 3 ? corridor.x + Math.floor(corridor.w / 2) : corridor.x;
  const northEnd = { x, y: corridor.y };
  const southEnd = { x, y: corridor.y + corridor.h - 1 };
  return Math.abs(plan.door.y - northEnd.y) >= Math.abs(plan.door.y - southEnd.y) ? northEnd : southEnd;
}

// 계단 착지·랜딩 정리 시 보존할 통행 가능 하부(바닥 재질 + 러그) — 복도 카펫을 지우지 않는다.
const PASSABLE_LOWER_TILES = new Set<number>([
  72, 73, 12, 13, 42, 43, 102, 103, 139,
  375, 376, 377, 405, 406, 407, 435, 436, 437,
  279, 280, 281, 309, 310, 311, 339, 340, 341,
  108, 109, 110, 138, 140, 168, 169, 170,
]);

function clearPassableLanding(
  map: GameMap,
  x: number,
  y: number,
  opts?: { readonly keepUpper?: boolean },
): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  const index = y * map.width + x;
  // 이미 통행 가능한 바닥/러그(복도 카펫)는 보존 — 착지 정리가 카펫을 끊지 않게.
  if (!PASSABLE_LOWER_TILES.has(map.lowerTiles[index] ?? -1)) map.lowerTiles[index] = 72;
  if (!opts?.keepUpper) map.upperTiles[index] = -1;
  map.events = (map.events ?? []).filter(
    (event) => !(event.x === x && event.y === y && event.id.startsWith("ev_inspect_")),
  );
}

// 2026-07-20 사용자 교정: 465~467 붉은 카펫 대계단(귀족 전용)을 민가 층계에서 배제 —
// 일반 계단 정본은 444(대각 오르막)·474/475(어둠 하강) (tileSemanticsInterior:79).
// 착지 3칸(x-1..x+1)을 바닥으로 정리하고 찍는다 — 가구 하드쌍(긴 탁자 등) 파편이 남지 않게.
function clearStairLanding(map: GameMap, center: { x: number; y: number }): void {
  for (let dx = -1; dx <= 1; dx += 1) {
    const x = center.x + dx;
    if (x < 0 || x >= map.width || center.y < 0 || center.y >= map.height) continue;
    const i = center.y * map.width + x;
    // 옆 칸이 벽이면 그대로 둔다 — 착지 정리가 칸막이·외벽에 바닥 구멍을 뚫지 않게.
    if (dx !== 0 && !PASSABLE_LOWER_TILES.has(map.lowerTiles[i] ?? -1)) continue;
    // 카펫/바닥 재질 보존 — 계단은 상위 타일이라 하부를 갈 필요가 없다(비통행 하부만 바닥으로).
    if (!PASSABLE_LOWER_TILES.has(map.lowerTiles[i] ?? -1)) map.lowerTiles[i] = 72;
    map.upperTiles[i] = -1;
  }
}

function stampStairsUp(map: GameMap, center: { x: number; y: number }): void {
  if (center.x < 0 || center.x >= map.width || center.y < 0 || center.y >= map.height) return;
  clearStairLanding(map, center);
  map.upperTiles[center.y * map.width + center.x] = 444;
}

function stampStairsDown(map: GameMap, center: { x: number; y: number }): void {
  if (center.x < 0 || center.x >= map.width || center.y < 0 || center.y >= map.height) return;
  clearStairLanding(map, center);
  map.upperTiles[center.y * map.width + center.x] = 474;
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

export function createHouseInteriorExitEvent(options: {
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
  readonly returnMapId: MapId;
  readonly returnX: number;
  readonly returnY: number;
  readonly seed?: number;
}): GameEvent {
  const closeSe = resolveSeVariant(DOOR_CLOSE_SE_POOL, HOUSE_DOOR_CLOSE_SE, { seed: options.seed });
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
          { kind: "playAudio", resourceId: closeSe, loop: false },
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
