import {
  clearAgentGhostPreview,
  setAgentGhostPreviewHidden,
} from "@/editor/agentGhostPreview";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { createHouseDoorEvent } from "@/editor/houseInteriors";
import type { InteriorThemeModifier } from "@/editor/interiorRoomPipeline";
import { runTool } from "@/editor/tools";
import { canMove, inBounds, isPassable } from "@/project/collision";
import { store } from "@/project/store";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { genId } from "@/util/id";
import type { RegionRect } from "./clipToRegion";
import {
  findSafeRegionDoorway,
  reviewRegionDraft,
} from "./harnessReview";
import {
  getPendingRegionApply,
  setPendingRegionApply,
} from "./pendingRegionApply";
import { dispatchRegionTaskStatus } from "./regionTaskStatus";
import {
  applyRegionProjectWithHistory,
  countAddedMaps,
  countInRegionChangedCells,
  countInRegionChangedEvents,
  type RegionTaskResult,
} from "./runRegionTask";

export const DIRECT_INTERIOR_PRESETS = [
  { id: "home", label: "주거 3실" },
  { id: "inn", label: "여관 3실" },
  { id: "manor", label: "대저택 5실" },
] as const;

export type DirectInteriorPresetId = typeof DIRECT_INTERIOR_PRESETS[number]["id"];

export interface DirectInteriorRoomDraftOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly preset?: DirectInteriorPresetId;
  readonly modifier?: InteriorThemeModifier;
  readonly seed?: number;
}

export interface DirectInteriorRoomDraftDeps {
  getProject(): Project;
  applyProject(project: Project, label: string, mapId: MapId): void;
}

export type DirectInteriorRoomDraftRunner = (
  options: DirectInteriorRoomDraftOptions,
) => RegionTaskResult | Promise<RegionTaskResult>;

const DEFAULT_DEPS: DirectInteriorRoomDraftDeps = {
  getProject: () => store.getCurrent(),
  applyProject: applyRegionProjectWithHistory,
};

/**
 * 직접 실내 초안은 손 도트 실내 v5(atlas_biome_interior)로 짓는다 — 공용 실내 칩셋은 v5 하나다(2026-09-29 hard rule).
 * 예전에는 villager-room-v1 파이프라인(옛 EasyRPG 실내 칩셋)으로 지어서, 그 칩셋이 기본 프로젝트에서 빠진 뒤(#2335)
 * 새 프로젝트에서 「AI 없이 실내」 버튼이 늘 실패했다. 방 구성은 build_hand_interior_room 의 방 종류(roomKinds)다.
 */
const HAND_INTERIOR_TILESET_ID = "atlas_biome_interior";
const PRESET_CONFIG: Record<DirectInteriorPresetId, {
  readonly label: string;
  readonly rooms: readonly string[];
  readonly entrance: string;
}> = {
  home: { label: "주거 3실", rooms: ["living", "kitchen", "bedroom"], entrance: "living" },
  inn: { label: "여관 3실", rooms: ["tavern", "inn_room", "inn_room"], entrance: "tavern" },
  manor: { label: "대저택 5실", rooms: ["entrance", "living", "dining", "kitchen", "bedroom"], entrance: "entrance" },
};

/** 분위기 선택 → v5 배치·색감 변형(A 기본 · B 웜 우드 · C 쿨 스톤 · D 다크 헤링본). */
const MODIFIER_STYLE: Record<InteriorThemeModifier, "A" | "B" | "C" | "D"> = {
  rustic: "B",
  luxury: "D",
  sacred: "C",
  scholarly: "A",
  martial: "C",
};

/**
 * Quota-independent editor entry point for a connected interior proposal. It mutates only a
 * detached draft, then hands the result to the same stale-base/review/pending gate as AI work.
 */
export function runDirectInteriorRoomDraft(
  options: DirectInteriorRoomDraftOptions,
  deps: DirectInteriorRoomDraftDeps = DEFAULT_DEPS,
): RegionTaskResult {
  const empty = {
    applied: false,
    changedCells: 0,
    changedEvents: 0,
    mapsAdded: 0,
    clippedCells: 0,
    proposedCalls: 0,
    assistantText: "",
  } as const;
  let pendingRegistered = false;
  dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: true });
  try {
    const base = deps.getProject();
    const sourceMap = base.maps[options.mapId];
    if (!sourceMap) return { ...empty, ok: false, error: "선택한 맵을 찾을 수 없습니다." };

    getPendingRegionApply()?.discard();
    const doorway = findSafeRegionDoorway(base, options.mapId, options.region);
    if (!doorway) {
      return {
        ...empty,
        ok: false,
        error: "선택 영역에서 시작 위치와 연결된 빈 통행 문·복귀 칸을 찾을 수 없습니다.",
      };
    }

    const ctx = { project: cloneDetachedDraft(base) };
    const presetId = options.preset ?? "inn";
    const preset = PRESET_CONFIG[presetId];
    const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed!) : Date.now() % 1_000_000;
    const interiorMapId = uniqueMapId(ctx.project);
    const built = runTool(ctx, "build_hand_interior_room", {
      tileset: HAND_INTERIOR_TILESET_ID,
      mapId: interiorMapId,
      name: `${sourceMap.name} · ${preset.label}`,
      layout: {
        rooms: preset.rooms.map((kind) => ({ kind })),
        entrance: preset.entrance,
        seed: Math.max(1, Math.abs(seed)),
        ...(options.modifier ? { styleVariant: MODIFIER_STYLE[options.modifier] } : {}),
      },
    });
    if (!built.ok) throw new Error(built.summary);
    const draft = ctx.project;
    const interiorMap = draft.maps[interiorMapId];
    if (!interiorMap) throw new Error("생성된 실내 맵을 찾을 수 없습니다.");
    const exits = (built as { data?: { exits?: readonly { x: number; y: number }[] } }).data?.exits ?? [];
    const exit = exits[0];
    if (!exit) throw new Error("생성된 실내에 출구가 없습니다.");
    const entry = pickInteriorEntry(draft, interiorMap, exit);
    if (!entry) throw new Error("실내 입구 옆에 통행 가능한 착지 칸이 없습니다.");
    interiorMap.events.push(interiorExitEvent(interiorMap, exit, {
      mapId: options.mapId,
      x: doorway.returnPosition.x,
      y: doorway.returnPosition.y,
    }));

    const draftSource = draft.maps[options.mapId]!;
    const exteriorEventId = uniqueEventId(draftSource);
    draftSource.events.push(createHouseDoorEvent({
      eventId: exteriorEventId,
      x: doorway.door.x,
      y: doorway.door.y,
      interiorMapId,
      kitId: "bright-plaster",
      name: `${preset.label} 입구`,
      entryX: entry.x,
      entryY: entry.y,
      seed,
    }));

    const reviewProject = (project: Project) => reviewRegionDraft({
      base,
      draft: project,
      mapId: options.mapId,
      region: options.region,
    });
    const reviewed = reviewProject(draft);
    const changedCells = countInRegionChangedCells(base, reviewed.project, options.mapId, options.region);
    const changedEvents = countInRegionChangedEvents(base, reviewed.project, options.mapId, options.region);
    const mapsAdded = countAddedMaps(base, reviewed.project);
    const modifierLabel = options.modifier ? ` + ${options.modifier}` : "";
    const instruction = `AI 없이 실내 초안 · ${preset.label}${modifierLabel}`;
    const label = `실내 초안: ${preset.label}${modifierLabel}`;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: reviewed.project,
      mapId: options.mapId,
      region: options.region,
      changedCells,
      changedEvents,
      instruction,
      report: reviewed.report,
      getCurrentProject: deps.getProject,
      reviewProject,
      onApply: (project) => deps.applyProject(project, label, options.mapId),
      onDiscard: () => undefined,
      onSettle: () => {
        setAgentGhostPreviewHidden(false);
        clearAgentGhostPreview();
        dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: false });
      },
    });
    pendingRegistered = true;
    dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: true, phase: "pending" });
    return {
      ok: true,
      applied: false,
      changedCells,
      changedEvents,
      mapsAdded,
      clippedCells: 0,
      proposedCalls: 0,
      assistantText: "",
      review: reviewed.report,
      pending,
    };
  } catch (cause) {
    clearAgentGhostPreview();
    return {
      ...empty,
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    if (!pendingRegistered) {
      dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: false });
    }
  }
}

function uniqueMapId(project: Project): MapId {
  let id = genId("map_interior_direct") as MapId;
  while (project.maps[id]) id = genId("map_interior_direct") as MapId;
  return id;
}

function uniqueEventId(map: GameMap): string {
  const ids = new Set(map.events.map((event) => event.id));
  let id = genId("ev_room_door");
  while (ids.has(id)) id = genId("ev_room_door");
  return id;
}

function pickInteriorEntry(
  project: Project,
  map: GameMap,
  exit: { readonly x: number; readonly y: number },
): { x: number; y: number } | null {
  // 출구는 맨 아래 줄 틈이다 — 들어오면 그 바로 위 바닥에 선다.
  const candidates = [
    { x: exit.x, y: exit.y - 1 },
    { x: exit.x - 1, y: exit.y - 1 },
    { x: exit.x + 1, y: exit.y - 1 },
    { x: exit.x, y: exit.y - 2 },
  ];
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  for (const candidate of candidates) {
    if (!inBounds(map, candidate.x, candidate.y)
      || occupied.has(`${candidate.x},${candidate.y}`)
      || !isPassable(project, map, candidate.x, candidate.y)) continue;
    const canLeave = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
      canMove(project, map, candidate.x, candidate.y, candidate.x + dx, candidate.y + dy));
    if (canLeave) return candidate;
  }
  return null;
}

/** 실내 출구 칸(맨 아래 줄 틈)을 밟으면 바깥 문 앞 복귀 칸으로 나간다. */
function interiorExitEvent(
  map: GameMap,
  exit: { readonly x: number; readonly y: number },
  to: { readonly mapId: MapId; readonly x: number; readonly y: number },
): GameEvent {
  const id = `ev_entrance_${map.id}`;
  return {
    id,
    name: "출구",
    x: exit.x,
    y: exit.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [{
      id: `${id}_page`,
      name: "출구",
      conditions: [],
      graphic: {},
      trigger: { kind: "playerTouch" },
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "transfer", mapId: to.mapId, x: to.x, y: to.y, direction: "down", fade: "black" }],
    }],
  } as unknown as GameEvent;
}
