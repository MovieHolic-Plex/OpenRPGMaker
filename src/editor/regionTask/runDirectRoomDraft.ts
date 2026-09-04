import {
  clearAgentGhostPreview,
  setAgentGhostPreviewHidden,
} from "@/editor/agentGhostPreview";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import {
  buildHouseInteriorPlan,
  createHouseDoorEvent,
} from "@/editor/houseInteriors";
import {
  advanceRoomDraft,
  startInteriorRoomDraft,
} from "@/editor/roomHarness/facade";
import type {
  InteriorRoomPlan,
  InteriorThemeModifier,
} from "@/editor/interiorRoomPipeline";
import { canMove, inBounds, isPassable } from "@/project/collision";
import { store } from "@/project/store";
import type { Command, GameMap, MapId, Project } from "@/project/types";
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

const PRESET_CONFIG: Record<DirectInteriorPresetId, {
  readonly label: string;
  readonly scale: "cottage-l" | "cottage3" | "mansion";
  readonly program: "dwelling" | "inn" | "manor";
}> = {
  home: { label: "주거 3실", scale: "cottage-l", program: "dwelling" },
  inn: { label: "여관 3실", scale: "cottage3", program: "inn" },
  manor: { label: "대저택 5실", scale: "mansion", program: "manor" },
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

    const draft = cloneDetachedDraft(base);
    const presetId = options.preset ?? "inn";
    const preset = PRESET_CONFIG[presetId];
    const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed!) : Date.now() % 1_000_000;
    const interiorMapId = uniqueMapId(draft);
    const plan = withModifier(buildHouseInteriorPlan({
      mapId: interiorMapId,
      name: `${sourceMap.name} · ${preset.label}`,
      seed,
      scale: preset.scale,
      program: preset.program,
    }), options.modifier);

    let session = startInteriorRoomDraft(draft, plan as unknown as Record<string, unknown>);
    for (let guard = 0; guard < 16 && Object.values(session.checklist).some((state) => state === "open"); guard += 1) {
      session = advanceRoomDraft(draft, session.id);
    }
    if (Object.values(session.checklist).some((state) => state === "open")) {
      throw new Error("실내 레이어 생성이 제한 단계 안에 완료되지 않았습니다.");
    }

    const interiorMap = draft.maps[interiorMapId];
    if (!interiorMap) throw new Error("생성된 실내 맵을 찾을 수 없습니다.");
    const entry = pickInteriorEntry(draft, interiorMap, plan);
    if (!entry) throw new Error("실내 입구 옆에 통행 가능한 착지 칸이 없습니다.");
    retargetInteriorEntrance(
      interiorMap,
      options.mapId,
      doorway.returnPosition.x,
      doorway.returnPosition.y,
    );

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

function withModifier(
  plan: InteriorRoomPlan,
  modifier: InteriorThemeModifier | undefined,
): InteriorRoomPlan {
  if (!modifier) return plan;
  return {
    ...plan,
    themeModifiers: [...new Set([...(plan.themeModifiers ?? []), modifier])],
    rooms: plan.rooms?.map((room) => ({
      ...room,
      modifiers: [...new Set([...(room.modifiers ?? []), modifier])],
    })),
  };
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
  plan: InteriorRoomPlan,
): { x: number; y: number } | null {
  const candidates = [
    { x: plan.door.x, y: plan.door.y - 1 },
    { x: plan.door.x - 1, y: plan.door.y },
    { x: plan.door.x + 1, y: plan.door.y },
    { x: plan.door.x, y: plan.door.y + 1 },
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

function retargetInteriorEntrance(
  map: GameMap,
  returnMapId: MapId,
  returnX: number,
  returnY: number,
): void {
  const event = map.events.find((candidate) => candidate.id === `ev_entrance_${map.id}`);
  if (!event) throw new Error("생성된 실내 출구 이벤트를 찾을 수 없습니다.");
  let replaced = 0;
  const retarget = (commands: readonly Command[]): Command[] => commands.map((command) => {
    if (command.kind !== "transfer") return command;
    replaced += 1;
    return { ...command, mapId: returnMapId, x: returnX, y: returnY };
  });
  event.commands = retarget(event.commands);
  event.pages = (event.pages ?? []).map((page) => ({ ...page, commands: retarget(page.commands) }));
  if (replaced === 0) throw new Error("생성된 실내 출구에 전송 명령이 없습니다.");
}
