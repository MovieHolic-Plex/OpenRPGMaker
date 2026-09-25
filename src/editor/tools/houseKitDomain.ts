import {
  HOUSE_KITS,
  type FootprintWing,
  type HouseKitId,
} from "@/editor/houseKit";
import { stampHouseExterior } from "@/editor/authoredHouseFormStamp";
import { gableAccentSeed, isGableHouseFormId } from "@/editor/gableHouseCompose";
import { tilesetHasHouseParts } from "@/project/defaults/forestHarmonyHouseParts";
import {
  createHouseInteriorMap,
  registerInteriorMaps,
  type HouseInteriorProgram,
  type HouseInteriorScale,
  type HouseStoryCount,
} from "@/editor/houseInteriors";
import { resolveDesignedInterior } from "@/editor/interiorConceptPlan";
import type { MapId, Project } from "@/project/types";
import {
  appendTreeChildOnce,
  applyHouseRoofDeck,
  ensureDoorFrontPassable,
  houseExteriorPlan,
  houseInteriorStories,
  seedFromString,
  uniqueProjectId,
  upsertHouseDoorEvents,
  type HouseShapeOptions,
} from "./houseKitDraftSupport";
import { ToolError } from "./types";
import { placeHouseLotFences } from "./village/fences";
import { houseBBox } from "./houseLotDecor";
import { assertHousePlacement, registerCompletedHouse } from "./houseProtection";

const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;

export const PUBLIC_HOUSE_KIT_IDS = [
  "blue-stone",
  "bright-plaster",
  "amber-wood",
  "slate-wood",
  "timber-hall",
] as const satisfies readonly HouseKitId[];

export const INTERNAL_ONLY_HOUSE_KIT_IDS = [] as const satisfies readonly HouseKitId[];

/** 형태 축(stories·lowWall·roofDeck·chimney·windows)은 HouseShapeOptions 가 정본이다. */
export type BuildHouseKitInput = HouseShapeOptions & {
  readonly mapId: MapId;
  readonly kitId: HouseKitId;
  readonly wings: readonly FootprintWing[];
  readonly door: boolean;
  readonly doorEvent: boolean;
  readonly interior: boolean;
  readonly ownerName?: string;
  /** 연결 실내의 설계(place_concept plan 모양). 생략하면 꾸러미 템플릿이 그대로 찍힌다 — 경고로 되먹인다. */
  readonly interiorPlan?: unknown;
  /** 앞마당 울타리+게이트 — 마을 파이프라인 정본(placeHouseLotFences) 재사용. 기본 꺼짐. */
  readonly fence?: boolean;
  /** 문 위 최상단 벽에 깃발 208/209 페어(village/decor 문법). 기본 꺼짐. */
  readonly banner?: boolean;
};

export type HouseKitInteriorData = {
  readonly interiorMapId: MapId;
  readonly floorMapIds: readonly MapId[];
  readonly doorEventId: string;
  readonly exitEventId: string;
  readonly entry: { readonly x: number; readonly y: number };
  readonly exit: { readonly x: number; readonly y: number };
  readonly scale: HouseInteriorScale;
  readonly program: HouseInteriorProgram;
  readonly stories: HouseStoryCount;
  readonly upperMapId?: MapId;
  /** 실내 도면의 출처 — planned=호출자가 설계, template=저작된 꾸러미 그대로, seed=절차 도면+초안 씨앗. */
  readonly designSource: "planned" | "template" | "seed";
};

type HouseKitBuildBaseData = {
  readonly doorAt: { readonly x: number; readonly y: number } | null;
  readonly kitId: HouseKitId;
  readonly wings: readonly FootprintWing[];
};

type HouseKitExteriorOnlyData = {
  readonly interiorMapId?: never;
  readonly doorEventId?: never;
  readonly exitEventId?: never;
  readonly entry?: never;
  readonly exit?: never;
  readonly scale?: never;
  readonly program?: never;
  readonly stories?: never;
  readonly upperMapId?: never;
};

export type HouseKitBuildData = HouseKitBuildBaseData & (HouseKitInteriorData | HouseKitExteriorOnlyData);

export type BuildHouseKitResult = {
  readonly summary: string;
  readonly warnings?: string[];
  readonly data: HouseKitBuildData;
};

export function isPublicHouseKitId(value: unknown): value is HouseKitId {
  return PUBLIC_HOUSE_KIT_IDS.some((kitId) => kitId === value);
}

export function buildHouseKit(draft: Project, input: BuildHouseKitInput): BuildHouseKitResult {
  const map = draft.maps[input.mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${input.mapId}`, { code: "missing-map", mapId: input.mapId });
  const kit = HOUSE_KITS[input.kitId];
  if (!kit) {
    throw new ToolError(
      `알 수 없는 키트: ${input.kitId} — 사용 가능: ${PUBLIC_HOUSE_KIT_IDS.join(", ")}`,
      { code: "unknown-kit", mapId: input.mapId },
    );
  }

  const bbox = houseBBox(input.wings);
  assertHousePlacement(map, bbox);
  const shape = houseExteriorPlan(input);
  // 저작 형태(셀 레시피) id 면 스탬프가 레시피로 바뀐다 — wings[0] 은 파서가 둔 앵커.
  // 박공 조합 형태 + 부품 칸이 있는 타일셋이면 자리마다 굴뚝·지붕창·차양·꼭대기 장식 0~2개.
  const accentSeed = input.templateId !== undefined && isGableHouseFormId(input.templateId) && tilesetHasHouseParts(draft.tilesets[map.tilesetId])
    ? gableAccentSeed(input.templateId, bbox.x, bbox.y)
    : undefined;
  const result = stampHouseExterior(map, {
    kitId: input.kitId, wings: input.wings, templateId: input.templateId, ...shape.stampOptions,
    ...(accentSeed === undefined ? {} : { accentSeed }),
  });
  if (!result.ok) throw new ToolError(result.reason ?? "집 시공 실패", { code: "house-kit-failed", mapId: input.mapId });

  const warnings: string[] = [];
  const deckApplied = applyHouseRoofDeck(map, input.wings, result.doorAt, input.roofDeck);
  let doorNote = "문 없음";
  let interiorData: HouseKitInteriorData | undefined;
  if (input.door && result.doorAt) {
    const { x, y } = result.doorAt;
    // 이벤트 문은 upsertHouseDoorEvents가 359 배경 두 칸과 Object1 스프라이트를 배치한다.
    // 이벤트 없는 타일 문만 기존 116/146 외형을 사용한다.
    const doorEventPlanned = input.interior && input.doorEvent;
    if (!doorEventPlanned) {
      map.lowerTiles[(y - 1) * map.width + x] = DOOR_TOP_TILE;
      map.lowerTiles[y * map.width + x] = DOOR_BOTTOM_TILE;
    }
    const clearanceWarning = ensureDoorFrontPassable(draft, map, { x, y });
    if (clearanceWarning) warnings.push(clearanceWarning);
    doorNote = `문 (${x},${y})`;
    if (doorEventPlanned) {
      const base = `${map.id}_${input.kitId}_${x}_${y}`;
      let interiorMapId = uniqueProjectId(draft, "map_house_interior", base);
      const doorEventId = uniqueProjectId(draft, "ev_house_door", base);
      const exitEventId = uniqueProjectId(draft, "ev_house_exit", base);
      const ownerName = input.ownerName?.trim() || map.name;
      const footprintArea = input.wings.reduce((sum, wing) => sum + wing.w * wing.h, 0);
      const stories = houseInteriorStories(input.stories, input.wings);
      const interiorSeed = seedFromString(base);
      // 설계 생략 경고는 실제로 지은 도면의 출처(템플릿/씨앗)를 본 뒤에 문구를 정한다 — 기본 문구는 버린다.
      const interior = createHouseInteriorMap({
        project: draft,
        id: interiorMapId,
        name: `${ownerName}의 집 내부`,
        returnMapId: map.id,
        returnX: x,
        returnY: y + 1,
        exitEventId,
        seed: interiorSeed,
        exterior: { stories, kitId: input.kitId, footprintArea, ownerName },
        interiorConcept: resolveDesignedInterior(draft, input.interiorPlan, { label: `${ownerName}의 집 내부`, warnings: [] }),
      });
      if (interior.interiorSource !== "designed") warnings.push(`실내를 설계하지 않아 ${interior.interiorSource === "seed" ? "절차 도면(초안 씨앗)" : "개념 꾸러미 템플릿"}으로 지었다 — 요청에 맞는 실내는 interiorPlan(장소 수·크기·구역·층·물건)이 정본이다.`);
      interiorMapId = interior.map.id;
      registerInteriorMaps(draft, interior);
      appendTreeChildOnce(draft.mapTree, interiorMapId, map.id);
      let parentFloorId = interiorMapId;
      for (const floor of interior.floors) {
        if (floor.floor <= 1) continue;
        appendTreeChildOnce(draft.mapTree, floor.mapId, parentFloorId);
        parentFloorId = floor.mapId;
      }
      upsertHouseDoorEvents(map, {
        eventId: doorEventId,
        x,
        y,
        interiorMapId,
        kitId: input.kitId,
        name: `${ownerName}의 집 문`,
        entryX: interior.entry.x,
        entryY: interior.entry.y,
        seed: interiorSeed,
      });
      interiorData = {
        interiorMapId,
        floorMapIds: interior.floors.map((floor) => floor.mapId),
        doorEventId,
        exitEventId,
        entry: interior.entry,
        exit: interior.exit,
        scale: interior.scale,
        program: interior.program,
        stories: interior.stories,
        ...(interior.upperMapId ? { upperMapId: interior.upperMapId } : {}),
        designSource: interior.interiorSource === "designed" ? "planned" : interior.interiorSource === "seed" ? "seed" : "template",
      };
      doorNote = `${doorNote}, 내부 ${interiorMapId}`;
    }
  }

  // ── 장식(선택): 깃발·울타리 — 마을 데코 패스의 정본 문법을 집 단독 시공에서도 ──
  const decorNotes: string[] = [];
  if (input.chimney) decorNotes.push("굴뚝");
  if (result.doorAt && (input.banner || input.fence)) {
    const { x: doorX, y: doorY } = result.doorAt;
    if (input.banner) {
      // village/decor.ts 문법: 지붕 바로 아래 최상단 벽 행, 문 양옆 208/209 (빈 칸에만).
      const bannerY = doorY - 2; // 도구 경로 벽 밴드 3행(상·중·하) — 상단 행
      for (const [dx, tile] of [[-1, 208], [1, 209]] as const) {
        const x = doorX + dx;
        if (x < 0 || x >= map.width || bannerY < 0) continue;
        const index = bannerY * map.width + x;
        if (map.upperTiles[index] === -1) map.upperTiles[index] = tile;
      }
      decorNotes.push("깃발 208/209");
    }
    if (input.fence) {
      placeHouseLotFences(map, [{
        bbox,
        doorAt: { x: doorX, y: doorY },
        front: { x: doorX, y: doorY + 1 },
        kitId: input.kitId,
        stories: shape.stories,
        templateId: "house-kit-single",
      }], seedFromString(`${map.id}_fence_${doorX}_${doorY}`));
      decorNotes.push("울타리+게이트");
    }
  }

  registerCompletedHouse(draft, map, {
    ...bbox, label: input.ownerName?.trim() || kit.name, kitId: input.kitId,
    ...(result.doorAt ? { doorAt: result.doorAt, front: { x: result.doorAt.x, y: result.doorAt.y + 1 } } : {}),
    ...(deckApplied ? { tags: ["roof-deck"] } : {}),
  });
  if (deckApplied) decorNotes.push("옥상 데크+사다리");
  const windowNote = result.formId ? "창문 레시피" : input.windows === false ? "창문 없음" : "창문 자동";
  const baseData: HouseKitBuildBaseData = {
    doorAt: result.doorAt ?? null,
    kitId: input.kitId,
    wings: input.wings,
  };
  const data: HouseKitBuildData = interiorData ? { ...baseData, ...interiorData } : baseData;
  const decorNote = decorNotes.length > 0 ? `, 장식(${decorNotes.join("·")})` : "";
  return {
    summary: `${map.name}에 '${kit.name}' 집 시공 — 날개 ${input.wings.length}개${shape.note}, ${doorNote}, ${windowNote}${decorNote}. 집 키트 규칙 적용 완료.`,
    ...(warnings.length > 0 ? { warnings } : {}),
    data,
  };
}

