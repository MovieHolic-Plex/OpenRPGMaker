import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { lineCells, type Point } from "@/editor/tools/mapHelpers";

export type AgentGhostLayer = "lower" | "upper" | "event";

export interface AgentGhostCell {
  readonly x: number;
  readonly y: number;
  readonly layer: AgentGhostLayer;
  /** 이 셀을 그릴 타일셋(맵 tilesetId). 타일 diff 셀에만 채워진다. */
  readonly tilesetId?: string;
  /** 변경 후(after) 타일 id — 렌더러가 실제 타일을 미리 그릴 수 있게 한다. */
  readonly tileId?: number;
}

/** 와이프 1스텝: 어떤 셀을 언제, 어떤 종류로 드러낼지. */
export interface GhostRevealStep {
  readonly cell: AgentGhostCell;
  readonly startMs: number;
  readonly kind: "tile" | "event";
}

export interface GhostRevealScheduleOptions {
  /** 와이프 총 길이(기본 GHOST_WIPE_DURATION_MS). */
  readonly durationMs?: number;
}

/** 좌→우 와이프 총 길이 — 셀 수와 무관하게 고정이다. */
export const GHOST_WIPE_DURATION_MS = 420;
/** 마지막 열이 드러난 뒤 완료로 넘어가기까지의 유지 시간. */
export const GHOST_WIPE_HOLD_MS = 150;

/**
 * 좌에서 우로 한 번 지나가는 단일 와이프 스케줄.
 *
 * 이전 구현은 셀 하나하나를 row-major 로 스탬프하며 최대 2.5초 동안 팝·링·스파크를 뿌렸다.
 * 변경 규모가 클수록 오래 걸리고, "무슨 연출인지"가 "무엇이 바뀌었는지"를 가렸다. 이제는
 * 열(x) 단위로 선단이 한 번 지나간다: 같은 열은 같은 시각에, 시각은 열 인덱스가 아니라
 * **x 위치에 비례**하므로 선단이 공간을 등속으로 지나가고, 총 길이는 항상 durationMs 다.
 */
export function buildGhostRevealSchedule(
  cells: readonly AgentGhostCell[],
  opts?: GhostRevealScheduleOptions
): readonly GhostRevealStep[] {
  if (cells.length === 0) return [];
  const duration = opts?.durationMs ?? GHOST_WIPE_DURATION_MS;
  const sorted = [...cells].sort((a, b) => a.x - b.x || a.y - b.y || layerOrder(a.layer) - layerOrder(b.layer));
  const minX = sorted[0].x;
  const maxX = sorted[sorted.length - 1].x;
  const span = maxX - minX;
  return sorted.map((cell) => ({
    cell,
    startMs: span > 0 ? ((cell.x - minX) / span) * duration : 0,
    kind: cell.layer === "event" ? ("event" as const) : ("tile" as const),
  }));
}

function layerOrder(layer: AgentGhostLayer): number {
  return layer === "lower" ? 0 : layer === "upper" ? 1 : 2;
}

export interface AgentGhostBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AgentGhostPreview {
  readonly id: string;
  readonly mapId: MapId;
  readonly toolName: string;
  readonly label: string;
  readonly cells: readonly AgentGhostCell[];
  readonly bounds: AgentGhostBounds;
}

export interface AgentGhostPreviewState {
  readonly previews: readonly AgentGhostPreview[];
  readonly revision: number;
  /** 툴 시작 직전(tool_started)에 세팅되는 실행 중 도구 — 상태칩 라벨 원천. */
  readonly runningToolName: string;
}

type Listener = (state: AgentGhostPreviewState) => void;
type TimerHandle = ReturnType<typeof setTimeout>;
type MutableArea = {
  bounds: AgentGhostBounds | null;
  cells: AgentGhostCell[];
  clipToMap: boolean;
  label: string;
  mapId: MapId;
  toolName: string;
};

export interface AgentGhostToolCallLike {
  readonly type: string;
  readonly name?: string;
  readonly result?: {
    readonly ok?: boolean;
  };
}

export interface ThrottledAgentGhostPreviewUpdater {
  readonly handleToolCall: (event: AgentGhostToolCallLike) => void;
  readonly flush: () => void;
  readonly cancel: () => void;
}

const STRUCTURE_FOOTPRINT = { width: 18, height: 16 } as const;
export const AGENT_GHOST_LIVE_UPDATE_THROTTLE_MS = 150;

const listeners = new Set<Listener>();
let previews: AgentGhostPreview[] = [];
let revision = 0;
let runningToolName = "";

// 원본 보기(꾹 누름) 동안 렌더만 숨긴다 — 프리뷰 데이터는 유지(시각 토글).
let hidden = false;

export function isAgentGhostPreviewHidden(): boolean {
  return hidden;
}

export function setAgentGhostPreviewHidden(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  emit();
}

export function subscribeAgentGhostPreview(listener: Listener): () => void {
  listeners.add(listener);
  listener(getAgentGhostPreviewState());
  return () => listeners.delete(listener);
}

export function hasAgentGhostPreviewSubscribers(): boolean {
  return listeners.size > 0;
}

export function getAgentGhostPreviewState(): AgentGhostPreviewState {
  return { previews: [...previews], revision, runningToolName };
}

/** tool_started 직전에 패널이 호출 — 렌더러 상태칩이 실행 중 도구를 즉시 반영한다. */
export function setAgentGhostRunningTool(name: string): void {
  if (runningToolName === name) return;
  runningToolName = name;
  emit();
}

export function clearAgentGhostRunningTool(): void {
  if (runningToolName === "") return;
  runningToolName = "";
  emit();
}

let draftMapProvider: ((mapId: MapId) => import("@/project/types").GameMap | undefined) | null = null;

/** 패널이 세션의 초안 프로젝트를 공급 — 렌더러가 컴포지터 경로로 타일을 찍는다. */
export function setAgentGhostDraftMapProvider(
  provider: ((mapId: MapId) => import("@/project/types").GameMap | undefined) | null
): void {
  draftMapProvider = provider;
}

export function getAgentGhostDraftMap(mapId: MapId): import("@/project/types").GameMap | undefined {
  return draftMapProvider?.(mapId);
}

export function agentGhostPreviewsForMap(state: AgentGhostPreviewState, mapId: MapId | null): readonly AgentGhostPreview[] {
  if (!mapId) return [];
  return state.previews.filter((preview) => preview.mapId === mapId);
}

export function clearAgentGhostPreview(): void {
  // 청사진(밑그림)은 여기서 지우지 않는다. 수명이 다르다 — 고스트는 한 턴짜리 초안이고
  // BuildSpec 은 세션 것이다(턴 간 유지). 묶어 뒀을 때는 적용 경로(aiProposalCard.applyProposal
  // 이 applyProposedProject 직전에 이 함수를 부른다)가 **처음 시공한 턴의 끝에서 청사진을
  // 지웠고**, set_build_spec 이 다음 턴에 다시 오지 않아 그 뒤로는 영원히 빈 상태였다.
  // 청사진 정리는 agentBlueprint.syncAgentBlueprintWithSpec(턴 시작) + clearAgentBlueprint
  // (새 대화·패널 폐기)가 맡는다.
  if (previews.length === 0 && runningToolName === "") return;
  previews = [];
  runningToolName = "";
  emit();
}

export function appendAgentGhostPreviewForToolCall(
  project: Project,
  toolName: string,
  args: Record<string, unknown>
): readonly AgentGhostPreview[] {
  const next = summarizeAgentGhostPreviewForToolCall(project, toolName, args);
  if (next.length === 0) return next;
  appendPreviews(next);
  return next;
}

export function replaceAgentGhostPreviewFromProjectDiff(
  baseProject: Project,
  draftProject: Project
): readonly AgentGhostPreview[] {
  const next = summarizeAgentGhostPreviewForProjectDiff(baseProject, draftProject);
  replacePreviews(next);
  return next;
}

export function summarizeAgentGhostPreviewForProjectDiff(
  baseProject: Project,
  draftProject: Project
): readonly AgentGhostPreview[] {
  const previewsByMap: AgentGhostPreview[] = [];
  const mapIds = new Set([...Object.keys(baseProject.maps), ...Object.keys(draftProject.maps)]);
  for (const mapId of mapIds) {
    const baseMap = baseProject.maps[mapId];
    const draftMap = draftProject.maps[mapId];
    const preview = mapDiffPreview(mapId, baseMap, draftMap);
    if (preview) previewsByMap.push(preview);
  }
  return previewsByMap;
}

export function createThrottledAgentGhostPreviewUpdater(options: {
  readonly getBaseProject: () => Project;
  readonly getDraftProject: () => Project;
  readonly isWriteTool: (toolName: string) => boolean;
  readonly throttleMs?: number;
  readonly apply?: (baseProject: Project, draftProject: Project) => void;
  readonly setTimeoutFn?: (handler: () => void, timeout: number) => TimerHandle;
  readonly clearTimeoutFn?: (handle: TimerHandle) => void;
}): ThrottledAgentGhostPreviewUpdater {
  const throttleMs = options.throttleMs ?? AGENT_GHOST_LIVE_UPDATE_THROTTLE_MS;
  const setTimeoutFn = options.setTimeoutFn ?? ((handler, timeout) => setTimeout(handler, timeout));
  const clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle));
  const apply = options.apply ?? ((baseProject, draftProject) => {
    replaceAgentGhostPreviewFromProjectDiff(baseProject, draftProject);
  });
  let timer: TimerHandle | null = null;
  let pending = false;

  const run = (): void => {
    timer = null;
    if (!pending) return;
    pending = false;
    apply(options.getBaseProject(), options.getDraftProject());
  };

  return {
    handleToolCall(event): void {
      if (event.type !== "tool_call" || !event.result?.ok || !event.name || !options.isWriteTool(event.name)) return;
      pending = true;
      if (timer !== null) return;
      timer = setTimeoutFn(run, throttleMs);
    },
    flush(): void {
      if (timer !== null) {
        clearTimeoutFn(timer);
        timer = null;
      }
      if (!pending) return;
      pending = false;
      apply(options.getBaseProject(), options.getDraftProject());
    },
    cancel(): void {
      if (timer !== null) clearTimeoutFn(timer);
      timer = null;
      pending = false;
    },
  };
}

export function summarizeAgentGhostPreviewForToolCall(
  project: Project,
  toolName: string,
  args: Record<string, unknown>
): readonly AgentGhostPreview[] {
  const areas: MutableArea[] = [];
  const mapId = stringValue(args.mapId);
  const map = mapId ? project.maps[mapId] : undefined;
  const pushArea = (area: MutableArea | null): void => {
    if (!area) return;
    const normalized = normalizeArea(project, area);
    if (normalized) areas.push(normalized);
  };

  switch (toolName) {
    case "paint_tiles":
      pushArea(paintTilesArea(project, args));
      break;
    case "paint_road":
      pushArea(pathArea(project, mapId, pointsValue(args.points), "paint_road", "도로 예정", "lower"));
      break;
    case "clear_region":
      pushArea(rectArea(project, mapId, rectFromXYWH(args), "clear_region", "영역 정리"));
      break;
    case "mirror_region":
      pushArea(rectArea(project, mapId, rectFromXYWH(args), "mirror_region", "대칭 변환"));
      break;
    case "build_house":
      pushArea(rectArea(project, mapId, rectFromOriginSize(args), "build_house", "집 건설"));
      break;
    case "build_house_kit":
      pushArea(rectArea(project, mapId, rectFromWings(args.wings), "build_house_kit", "집 키트"));
      break;
    case "author_house": {
      const houseMapId = stringValue(args.mapId) ?? nestedTargetMapId(args.target);
      if (args.kind === "lots" && Array.isArray(args.houses)) {
        for (const house of args.houses) {
          if (!house || typeof house !== "object") continue;
          const wings = (house as { wings?: unknown }).wings;
          pushArea(rectArea(project, houseMapId, rectFromWings(wings), "author_house", "집 부지"));
        }
      } else {
        pushArea(rectArea(project, houseMapId, rectFromWings(args.wings), "author_house", "집 시공"));
      }
      break;
    }
    case "author_village": {
      const villageMapId = nestedTargetMapId(args.target);
      const bounds = nestedTargetGhostBounds(args.target);
      pushArea(rectArea(project, villageMapId, bounds, "author_village", "마을 시공"));
      break;
    }
    case "build_house_lots": {
      const houses = Array.isArray(args.houses) ? args.houses : [];
      for (const house of houses) {
        if (!house || typeof house !== "object") continue;
        const wings = (house as { wings?: unknown }).wings;
        pushArea(rectArea(project, mapId, rectFromWings(wings), "build_house_lots", "집 부지"));
      }
      break;
    }
    case "stamp_structure":
      pushArea(rectArea(project, mapId, rectFromOriginFixed(args, STRUCTURE_FOOTPRINT), "stamp_structure", "구조물 스탬프"));
      break;
    case "scatter_object":
      pushArea(rectArea(project, mapId, rectValue(args.area), "scatter_object", "오브젝트 배치"));
      break;
    case "place_npc":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_npc", "NPC 배치"));
      break;
    case "place_battle_blocker":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_battle_blocker", "전투 이벤트 배치"));
      break;
    case "place_chest":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_chest", "보물상자 배치"));
      break;
    case "place_storage_chest":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_storage_chest", "보관 상자 배치"));
      break;
    case "place_savepoint":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_savepoint", "세이브 포인트 배치"));
      break;
    case "set_start_position":
      pushArea(pointArea(project, mapId, pointFromXY(args), "set_start_position", "시작 위치"));
      break;
    case "upsert_event":
      pushArea(upsertEventArea(project, args));
      break;
    case "move_event":
      pushArea(moveEventArea(project, args));
      break;
    case "remove_event":
      pushArea(existingEventArea(project, mapId, stringValue(args.eventId), "remove_event", "이벤트 제거"));
      break;
    case "duplicate_event":
      pushArea(pointArea(project, stringValue(args.toMapId), pointFromXY(args), "duplicate_event", "이벤트 복제"));
      break;
    case "create_transfer_pair":
      for (const area of transferPairAreas(project, args)) pushArea(area);
      break;
    case "create_map":
      pushArea(createdMapArea(args, "create_map", "새 맵"));
      break;
    case "generate_map":
      pushArea(createdMapArea(args, "generate_map", "생성 맵"));
      break;
    case "resize_map":
      for (const area of resizeMapAreas(project, map, mapId, args)) pushArea(area);
      break;
    case "remove_map":
      if (mapId && map) pushArea(boundsArea(mapId, fullMapBounds(map), "remove_map", "맵 제거"));
      break;
    default:
      break;
  }

  return areas.map((area) => finalizeArea(area, toolName, args));
}

function appendPreviews(next: readonly AgentGhostPreview[]): void {
  const byId = new Map(previews.map((preview) => [preview.id, preview]));
  for (const preview of next) byId.set(preview.id, preview);
  previews = [...byId.values()];
  emit();
}

function replacePreviews(next: readonly AgentGhostPreview[]): void {
  previews = [...next];
  emit();
}

function emit(): void {
  revision += 1;
  const state = getAgentGhostPreviewState();
  for (const listener of listeners) listener(state);
}

function mapDiffPreview(mapId: MapId, baseMap: GameMap | undefined, draftMap: GameMap | undefined): AgentGhostPreview | null {
  if (!baseMap && !draftMap) return null;
  if (!baseMap && draftMap) {
    return finalizeArea(boundsArea(mapId, fullMapBounds(draftMap), "live_project_diff", "새 맵 초안", false) as MutableArea, "live_project_diff", {
      mapId,
      kind: "created",
    });
  }
  if (baseMap && !draftMap) {
    return finalizeArea(boundsArea(mapId, fullMapBounds(baseMap), "live_project_diff", "맵 제거 초안", false) as MutableArea, "live_project_diff", {
      mapId,
      kind: "removed",
    });
  }
  const before = baseMap as GameMap;
  const after = draftMap as GameMap;
  const initialBounds = initialDiffBounds(before, after);
  const area = initialBounds
    ? boundsArea(mapId, initialBounds, "live_project_diff", "AI 작업 초안", false)
    : { bounds: null, cells: [], clipToMap: false, label: "AI 작업 초안", mapId, toolName: "live_project_diff" };
  if (!area) return null;
  collectTileDiffCells(area, before, after);
  collectEventDiffCells(area, before, after);
  const normalized = normalizeArea({ maps: { [mapId]: after } } as Project, area);
  if (!normalized?.bounds) return null;
  if (normalized.cells.length === 0 && sameMapShape(before, after)) return null;
  return finalizeArea(normalized, "live_project_diff", {
    mapId,
    kind: "changed",
    bounds: normalized.bounds,
    cells: normalized.cells,
  });
}

function initialDiffBounds(before: GameMap, after: GameMap): AgentGhostBounds | null {
  if (!sameMapShape(before, after)) {
    return {
      x: 0,
      y: 0,
      width: Math.max(before.width, after.width),
      height: Math.max(before.height, after.height),
    };
  }
  return null;
}

function sameMapShape(before: GameMap, after: GameMap): boolean {
  return before.width === after.width && before.height === after.height;
}

function collectTileDiffCells(area: MutableArea, before: GameMap, after: GameMap): void {
  const width = Math.min(before.width, after.width);
  const height = Math.min(before.height, after.height);
  if (!before.lowerTiles || !after.lowerTiles) return;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * before.width + x;
      const nextIndex = y * after.width + x;
      if (before.lowerTiles[index] !== after.lowerTiles[nextIndex] || !sameStacks(before.lowerTileStacks?.[index], after.lowerTileStacks?.[nextIndex])) {
        includeCell(area, { x, y, layer: "lower", tilesetId: after.tilesetId, tileId: afterTileId(after, "lower", nextIndex) });
      }
      if (before.upperTiles?.[index] !== after.upperTiles?.[nextIndex] || !sameStacks(before.upperTileStacks?.[index], after.upperTileStacks?.[nextIndex])) {
        includeCell(area, { x, y, layer: "upper", tilesetId: after.tilesetId, tileId: afterTileId(after, "upper", nextIndex) });
      }
    }
  }
}

function collectEventDiffCells(area: MutableArea, before: GameMap, after: GameMap): void {
  const beforeEvents = new Map(before.events.map((event) => [event.id, event]));
  const afterEvents = new Map(after.events.map((event) => [event.id, event]));
  const eventIds = new Set([...beforeEvents.keys(), ...afterEvents.keys()]);
  for (const eventId of eventIds) {
    const oldEvent = beforeEvents.get(eventId);
    const newEvent = afterEvents.get(eventId);
    if (!oldEvent && newEvent) {
      includeCell(area, { x: newEvent.x, y: newEvent.y, layer: "event" });
      continue;
    }
    if (oldEvent && !newEvent) {
      includeCell(area, { x: oldEvent.x, y: oldEvent.y, layer: "event" });
      continue;
    }
    if (!oldEvent || !newEvent) continue;
    const moved = oldEvent.x !== newEvent.x || oldEvent.y !== newEvent.y;
    const changed = moved || stableStringify(oldEvent) !== stableStringify(newEvent);
    if (!changed) continue;
    includeCell(area, { x: newEvent.x, y: newEvent.y, layer: "event" });
    if (moved) includeCell(area, { x: oldEvent.x, y: oldEvent.y, layer: "event" });
  }
}

/** 변경 후 그 좌표에 실제로 보이는 타일 id(스택이 있으면 최상단). */
function afterTileId(map: GameMap, layer: "lower" | "upper", index: number): number | undefined {
  const stack = layer === "lower" ? map.lowerTileStacks?.[index] : map.upperTileStacks?.[index];
  if (stack && stack.length > 0) return stack[stack.length - 1];
  const tile = layer === "lower" ? map.lowerTiles[index] : map.upperTiles?.[index];
  return typeof tile === "number" ? tile : undefined;
}

function sameStacks(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function finalizeArea(area: MutableArea, toolName: string, args: Record<string, unknown>): AgentGhostPreview {
  const bounds = area.bounds as AgentGhostBounds;
  const key = stableStringify(args);
  return {
    id: `${toolName}:${area.mapId}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${key}`,
    mapId: area.mapId,
    toolName,
    label: area.label,
    cells: dedupeCells(area.cells),
    bounds,
  };
}

function paintTilesArea(project: Project, args: Record<string, unknown>): MutableArea | null {
  const mapId = stringValue(args.mapId);
  const layer = args.layer === "upper" ? "upper" : "lower";
  const mode = stringValue(args.mode);
  if (!mapId || !mode) return null;
  if (mode === "rect") return rectArea(project, mapId, rectFromEndpoints(args), "paint_tiles", "페인트 영역", layer);
  if (mode === "line") {
    const from = pointValue(args.from);
    const to = pointValue(args.to);
    return pathArea(project, mapId, from && to ? lineCells(from, to) : [], "paint_tiles", "페인트 선", layer);
  }
  if (mode === "fill") return pointArea(project, mapId, pointValue(args.from), "paint_tiles", "채우기 시작점", layer);
  if (mode === "cells") return pathArea(project, mapId, pointsValue(args.cells), "paint_tiles", "페인트 셀", layer);
  return null;
}

function upsertEventArea(project: Project, args: Record<string, unknown>): MutableArea | null {
  const mapId = stringValue(args.mapId);
  const event = recordValue(args.event) as Partial<GameEvent> | null;
  if (!mapId || !event) return null;
  const next = pointFromXY(event);
  const area = pointArea(project, mapId, next, "upsert_event", "이벤트 저장");
  if (!area) return null;
  const existing = typeof event.id === "string" ? project.maps[mapId]?.events.find((entry) => entry.id === event.id) : undefined;
  if (existing && (existing.x !== event.x || existing.y !== event.y)) includeCell(area, { x: existing.x, y: existing.y, layer: "event" });
  return area;
}

function moveEventArea(project: Project, args: Record<string, unknown>): MutableArea | null {
  const mapId = stringValue(args.mapId);
  const next = pointFromXY(args);
  const eventId = stringValue(args.eventId);
  const area = pointArea(project, mapId, next, "move_event", "이벤트 이동");
  if (!area || !mapId || !eventId) return area;
  const existing = project.maps[mapId]?.events.find((event) => event.id === eventId);
  if (existing) includeCell(area, { x: existing.x, y: existing.y, layer: "event" });
  return area;
}

function transferPairAreas(project: Project, args: Record<string, unknown>): MutableArea[] {
  const a = recordValue(args.a);
  const b = recordValue(args.b);
  return [
    pointArea(project, stringValue(a?.mapId), a ? pointFromXY(a) : null, "create_transfer_pair", "출입구 A"),
    pointArea(project, stringValue(b?.mapId), b ? pointFromXY(b) : null, "create_transfer_pair", "출입구 B"),
  ].filter((area): area is MutableArea => area !== null);
}

function existingEventArea(
  project: Project,
  mapId: string | null,
  eventId: string | null,
  toolName: string,
  label: string
): MutableArea | null {
  if (!mapId || !eventId) return null;
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  return pointArea(project, mapId, event ? { x: event.x, y: event.y } : null, toolName, label);
}

function resizeMapAreas(
  project: Project,
  map: GameMap | undefined,
  mapId: string | null,
  args: Record<string, unknown>
): MutableArea[] {
  if (!mapId || !map) return [];
  const width = numberValue(args.width);
  const height = numberValue(args.height);
  if (width === null || height === null || width <= 0 || height <= 0) return [];
  if (width === map.width && height === map.height) return [];
  if (width < map.width || height < map.height) {
    return [rectArea(project, mapId, { x: 0, y: 0, width, height }, "resize_map", "새 맵 경계")].filter(
      (area): area is MutableArea => area !== null
    );
  }
  const areas: MutableArea[] = [];
  if (width > map.width) {
    const right = rectArea(project, mapId, { x: map.width, y: 0, width: width - map.width, height }, "resize_map", "가로 확장", undefined, false);
    if (right) areas.push(right);
  }
  if (height > map.height) {
    const bottom = rectArea(project, mapId, { x: 0, y: map.height, width, height: height - map.height }, "resize_map", "세로 확장", undefined, false);
    if (bottom) areas.push(bottom);
  }
  return areas;
}

function createdMapArea(args: Record<string, unknown>, toolName: string, label: string): MutableArea | null {
  const mapId = stringValue(args.id);
  const width = numberValue(args.width);
  const height = numberValue(args.height);
  if (!mapId || width === null || height === null || width <= 0 || height <= 0) return null;
  return boundsArea(mapId, { x: 0, y: 0, width, height }, toolName, label);
}

function rectArea(
  project: Project,
  mapId: string | null,
  bounds: AgentGhostBounds | null,
  toolName: string,
  label: string,
  layer?: AgentGhostLayer,
  clipToMap = true
): MutableArea | null {
  if (!mapId || !bounds) return null;
  const area = boundsArea(mapId, bounds, toolName, label, clipToMap);
  if (!area) return null;
  const cellLayer = layer ?? "lower";
  const cellCount = bounds.width * bounds.height;
  if (cellCount > 0 && cellCount <= 128) {
    for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) includeCell(area, { x, y, layer: cellLayer });
    }
  }
  return normalizeArea(project, area);
}

function pointArea(
  project: Project,
  mapId: string | null,
  point: Point | null,
  toolName: string,
  label: string,
  layer: AgentGhostLayer = "event"
): MutableArea | null {
  if (!mapId || !point) return null;
  const area = boundsArea(mapId, { x: point.x, y: point.y, width: 1, height: 1 }, toolName, label);
  if (!area) return null;
  includeCell(area, { x: point.x, y: point.y, layer });
  return normalizeArea(project, area);
}

function pathArea(
  project: Project,
  mapId: string | null,
  points: readonly Point[],
  toolName: string,
  label: string,
  layer: AgentGhostLayer
): MutableArea | null {
  if (!mapId || points.length === 0) return null;
  const area = boundsArea(mapId, { x: points[0].x, y: points[0].y, width: 1, height: 1 }, toolName, label);
  if (!area) return null;
  for (const point of points) includeCell(area, { x: point.x, y: point.y, layer });
  return normalizeArea(project, area);
}

function boundsArea(mapId: string, bounds: AgentGhostBounds, toolName: string, label: string, clipToMap = true): MutableArea | null {
  const normalized = normalizeBounds(bounds);
  if (!normalized) return null;
  return { bounds: normalized, cells: [], clipToMap, label, mapId, toolName };
}

function normalizeArea(project: Project, area: MutableArea): MutableArea | null {
  if (!area.bounds) return null;
  const map = project.maps[area.mapId];
  const bounds = map && area.clipToMap ? clipBoundsToMap(area.bounds, map) : normalizeBounds(area.bounds);
  if (!bounds) return null;
  const cells = map
    ? area.cells.filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < map.width && cell.y < map.height)
    : area.cells;
  return { ...area, bounds, cells };
}

function includeCell(area: MutableArea, cell: AgentGhostCell): void {
  if (!Number.isFinite(cell.x) || !Number.isFinite(cell.y)) return;
  area.cells.push(cell);
  includeBounds(area, { x: cell.x, y: cell.y, width: 1, height: 1 });
}

function includeBounds(area: MutableArea, bounds: AgentGhostBounds): void {
  const normalized = normalizeBounds(bounds);
  if (!normalized) return;
  if (!area.bounds) {
    area.bounds = normalized;
    return;
  }
  const x0 = Math.min(area.bounds.x, normalized.x);
  const y0 = Math.min(area.bounds.y, normalized.y);
  const x1 = Math.max(area.bounds.x + area.bounds.width, normalized.x + normalized.width);
  const y1 = Math.max(area.bounds.y + area.bounds.height, normalized.y + normalized.height);
  area.bounds = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function normalizeBounds(bounds: AgentGhostBounds): AgentGhostBounds | null {
  const x = Math.floor(bounds.x);
  const y = Math.floor(bounds.y);
  const width = Math.floor(bounds.width);
  const height = Math.floor(bounds.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function clipBoundsToMap(bounds: AgentGhostBounds, map: GameMap): AgentGhostBounds | null {
  const normalized = normalizeBounds(bounds);
  if (!normalized) return null;
  const x0 = Math.max(0, normalized.x);
  const y0 = Math.max(0, normalized.y);
  const x1 = Math.min(map.width, normalized.x + normalized.width);
  const y1 = Math.min(map.height, normalized.y + normalized.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function fullMapBounds(map: GameMap): AgentGhostBounds {
  return { x: 0, y: 0, width: map.width, height: map.height };
}

function rectFromEndpoints(args: Record<string, unknown>): AgentGhostBounds | null {
  const from = pointValue(args.from);
  const to = pointValue(args.to);
  if (!from || !to) return null;
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  return { x, y, width: Math.abs(to.x - from.x) + 1, height: Math.abs(to.y - from.y) + 1 };
}

function rectFromOriginSize(args: Record<string, unknown>): AgentGhostBounds | null {
  const origin = pointValue(args.origin);
  const width = numberValue(args.width);
  const height = numberValue(args.height);
  if (!origin || width === null || height === null) return null;
  return { x: origin.x, y: origin.y, width, height };
}

function rectFromWings(value: unknown): AgentGhostBounds | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const wing of value) {
    const record = recordValue(wing);
    if (!record) return null;
    const x = numberValue(record.x);
    const y = numberValue(record.y);
    const w = numberValue(record.w);
    const h = numberValue(record.h);
    if (x === null || y === null || w === null || h === null) return null;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function rectFromOriginFixed(
  args: Record<string, unknown>,
  size: { readonly width: number; readonly height: number }
): AgentGhostBounds | null {
  const origin = pointValue(args.origin);
  if (!origin) return null;
  return { x: origin.x, y: origin.y, width: size.width, height: size.height };
}

function rectFromXYWH(args: Record<string, unknown>): AgentGhostBounds | null {
  const x = numberValue(args.x);
  const y = numberValue(args.y);
  const width = numberValue(args.w);
  const height = numberValue(args.h);
  if (x === null || y === null || width === null || height === null) return null;
  return { x, y, width, height };
}

function rectValue(value: unknown): AgentGhostBounds | null {
  const record = recordValue(value);
  if (!record) return null;
  return rectFromXYWH(record);
}

function pointFromXY(value: Record<string, unknown> | Partial<GameEvent>): Point | null {
  const x = numberValue(value.x);
  const y = numberValue(value.y);
  if (x === null || y === null) return null;
  return { x, y };
}

function pointValue(value: unknown): Point | null {
  const record = recordValue(value);
  return record ? pointFromXY(record) : null;
}

function pointsValue(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  return value.map(pointValue).filter((point): point is Point => point !== null);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nestedTargetMapId(target: unknown): string | null {
  const record = recordValue(target);
  if (!record) return null;
  return stringValue(record.mapId);
}

function nestedTargetGhostBounds(target: unknown): AgentGhostBounds | null {
  const record = recordValue(target);
  if (!record) return null;
  const bounds = recordValue(record.bounds);
  if (bounds) {
    const x = numberValue(bounds.x);
    const y = numberValue(bounds.y);
    const w = numberValue(bounds.w);
    const h = numberValue(bounds.h);
    if (x !== null && y !== null && w !== null && h !== null) return { x, y, width: w, height: h };
  }
  const plannedMap = recordValue(record.plannedMap);
  if (plannedMap) {
    const w = numberValue(plannedMap.width);
    const h = numberValue(plannedMap.height);
    if (w !== null && h !== null) return { x: 0, y: 0, width: w, height: h };
  }
  const w = numberValue(record.width);
  const h = numberValue(record.height);
  if (w !== null && h !== null) return { x: 0, y: 0, width: w, height: h };
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dedupeCells(cells: readonly AgentGhostCell[]): readonly AgentGhostCell[] {
  const unique = new Map<string, AgentGhostCell>();
  for (const cell of cells) unique.set(`${cell.layer}:${cell.x},${cell.y}`, cell);
  return [...unique.values()];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
