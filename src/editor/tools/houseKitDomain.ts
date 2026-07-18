import {
  HOUSE_KITS,
  stampFootprintHouseKit,
  type FootprintWing,
  type HouseKitId,
  type HouseKitWindowsOption,
} from "@/editor/houseKit";
import {
  createHouseDoorEvent,
  createHouseInteriorMap,
  registerInteriorMaps,
  type HouseInteriorProgram,
  type HouseInteriorScale,
  type HouseStoryCount,
} from "@/editor/houseInteriors";
import type { MapId, Project } from "@/project/types";
import {
  appendTreeChildOnce,
  ensureDoorFrontPassable,
  seedFromString,
  uniqueProjectId,
  upsertEvent,
} from "./houseKitDraftSupport";
import { ToolError } from "./types";

const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;

export const PUBLIC_HOUSE_KIT_IDS = [
  "blue-stone",
  "bright-plaster",
  "amber-wood",
  "slate-wood",
  "timber-hall",
  "aframe-stone",
] as const satisfies readonly HouseKitId[];

export const INTERNAL_ONLY_HOUSE_KIT_IDS = [] as const satisfies readonly HouseKitId[];

export type BuildHouseKitInput = {
  readonly mapId: MapId;
  readonly kitId: HouseKitId;
  readonly wings: readonly FootprintWing[];
  readonly door: boolean;
  readonly doorEvent: boolean;
  readonly interior: boolean;
  readonly ownerName?: string;
  readonly windows?: HouseKitWindowsOption;
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

  const result = stampFootprintHouseKit(map, {
    kitId: input.kitId,
    wings: input.wings,
    ...(input.windows === undefined ? {} : { windows: input.windows }),
  });
  if (!result.ok) throw new ToolError(result.reason ?? "집 시공 실패", { code: "house-kit-failed", mapId: input.mapId });

  const warnings: string[] = [];
  let doorNote = "문 없음";
  let interiorData: HouseKitInteriorData | undefined;
  if (input.door && result.doorAt) {
    const { x, y } = result.doorAt;
    map.lowerTiles[(y - 1) * map.width + x] = DOOR_TOP_TILE;
    map.lowerTiles[y * map.width + x] = DOOR_BOTTOM_TILE;
    const clearanceWarning = ensureDoorFrontPassable(draft, map, { x, y });
    if (clearanceWarning) warnings.push(clearanceWarning);
    doorNote = `문 (${x},${y})`;
    if (input.interior && input.doorEvent) {
      const base = `${map.id}_${input.kitId}_${x}_${y}`;
      const interiorMapId = uniqueProjectId(draft, "map_house_interior", base);
      const doorEventId = uniqueProjectId(draft, "ev_house_door", base);
      const exitEventId = uniqueProjectId(draft, "ev_house_exit", base);
      const ownerName = input.ownerName?.trim() || map.name;
      const footprintArea = input.wings.reduce((sum, wing) => sum + wing.w * wing.h, 0);
      const stories: HouseStoryCount = input.wings.some((wing) => wing.h >= 11)
        ? 3
        : input.wings.some((wing) => wing.h >= 9)
          ? 2
          : 1;
      const interior = createHouseInteriorMap({
        id: interiorMapId,
        name: `${ownerName}의 집 내부`,
        returnMapId: map.id,
        returnX: x,
        returnY: y + 1,
        exitEventId,
        seed: seedFromString(base),
        exterior: { stories, kitId: input.kitId, footprintArea, ownerName },
      });
      registerInteriorMaps(draft, interior);
      appendTreeChildOnce(draft.mapTree, interiorMapId, map.id);
      let parentFloorId = interiorMapId;
      for (const floor of interior.floors) {
        if (floor.floor <= 1) continue;
        appendTreeChildOnce(draft.mapTree, floor.mapId, parentFloorId);
        parentFloorId = floor.mapId;
      }
      upsertEvent(map.events, createHouseDoorEvent({
        eventId: doorEventId,
        x,
        y,
        interiorMapId,
        kitId: input.kitId,
        name: `${ownerName}의 집 문`,
        entryX: interior.entry.x,
        entryY: interior.entry.y,
      }));
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
      };
      doorNote = `${doorNote}, 내부 ${interiorMapId}`;
    }
  }

  const windowNote = input.windows === false ? "창문 없음" : "창문 자동";
  const baseData: HouseKitBuildBaseData = {
    doorAt: result.doorAt ?? null,
    kitId: input.kitId,
    wings: input.wings,
  };
  const data: HouseKitBuildData = interiorData ? { ...baseData, ...interiorData } : baseData;
  return {
    summary: `${map.name}에 '${kit.name}' 집 시공 — 날개 ${input.wings.length}개, ${doorNote}, ${windowNote}. 집 키트 규칙 적용 완료.`,
    ...(warnings.length > 0 ? { warnings } : {}),
    data,
  };
}
