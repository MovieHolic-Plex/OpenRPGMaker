import { isSameMapMove, withAssistantViewTransition } from "@/editor/assistantViewSwitch";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { isAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { discardConstructionLogs, planConstructionReveal, requestAgentConstructionReveal } from "@/editor/agentConstructionReveal";
import { prefersReducedMotion } from "@/util/reducedMotion";
import { isUiInBackground } from "@/ai/yieldToUi";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";

export type AgentFocusLayer = "lower" | "upper" | "event";

export interface AgentFocusCell {
  readonly x: number;
  readonly y: number;
  readonly layer: AgentFocusLayer;
}

export interface AgentFocusBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AgentFocusTarget {
  readonly mapId: MapId;
  readonly cells: readonly AgentFocusCell[];
  readonly bounds: AgentFocusBounds | null;
  readonly score: number;
}

type MutableFocus = {
  bounds: AgentFocusBounds | null;
  cells: AgentFocusCell[];
  mapId: MapId;
  order: number;
  score: number;
};

type Listener = (target: AgentFocusTarget) => void;

const listeners = new Set<Listener>();

export function subscribeAgentFocusHighlight(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestAgentFocusHighlight(target: AgentFocusTarget): void {
  if (!target.bounds) return;
  for (const listener of listeners) listener(target);
}

/**
 * Application keeps the user's view by default. follow:true is reserved for a
 * direct user action such as the preview button; model tool calls do not set it.
 */
export function focusAcceptedAgentChanges(before: Project, after: Project, options: { readonly follow?: boolean } = {}): AgentFocusTarget | null {
  const target = summarizeAcceptedAgentChanges(before, after);
  if (!target) return null;
  const currentMapId = editorState.get().currentMapId ?? before.startMapId ?? null;
  // 보던 맵이 사라졌으면(빈 프로젝트를 통째로 바꾸는 생성·맵 삭제) 지킬 시야가 없다 — 팔레트가 「맵을 선택하세요」로
  // 비지 않게 새 시작 맵으로 옮긴다(2026-10-06 실측: build_monster_game create 뒤 map_blank_start 가 남았다).
  if (currentMapId && !after.maps[currentMapId]) {
    selectEditorMap(after.maps[after.startMapId] ? after.startMapId : target.mapId);
    return target;
  }
  if (isUiInBackground()) {
    discardConstructionLogs();
    return target;
  }
  if (options.follow !== true) {
    if (target.mapId !== currentMapId) {
      discardConstructionLogs(target.mapId);
      return target;
    }
    const map = after.maps[target.mapId];
    const plan = map && isAiLiveCanvasEnabled() && !prefersReducedMotion()
      ? planConstructionReveal(before.maps[target.mapId], map, after.tilesets[map.tilesetId])
      : null;
    if (!plan || !requestAgentConstructionReveal(plan)) requestAgentFocusHighlight(target);
    return target;
  }
  // 맵이 바뀌면 캔버스가 한 프레임에 통째로 갈리고 카메라는 새 맵 한가운데로 붙는다 —
  // 그 하드컷을 크로스페이드로 덮는다. 맵 선택·강조·카메라를 **한 묶음**으로 넣어야
  // 덮인 동안 전부 끝나고, 베일이 걷힐 때 이미 완성된 화면이 나온다.
  const sameMap = isSameMapMove(target.mapId);
  // 도구가 시공 기록을 남긴 큰 시공(새 마을 맵 등)은 「✓ 반영됨」 강조 대신 그 기록을 실제 순서대로 다시 튼다(2026-10-03).
  // 계획은 베일 밖에서 미리 세운다 — 베일이 걷힐 때 이미 덮개가 깔려 있어야 완성본이 먼저 비치지 않는다.
  const afterMap = after.maps[target.mapId];
  const reveal = afterMap && isAiLiveCanvasEnabled() && !prefersReducedMotion()
    ? planConstructionReveal(before.maps[target.mapId], afterMap, after.tilesets[afterMap.tilesetId])
    : null;
  withAssistantViewTransition(target.mapId, () => {
    selectEditorMap(target.mapId, { clearEventSelection: currentMapId !== target.mapId });
    if (!reveal || !requestAgentConstructionReveal(reveal)) requestAgentFocusHighlight(target);
    // 하이라이트만 켜고 카메라를 두면 변경 영역이 화면 밖일 때 "아무 일도 안 일어난 것"으로
    // 보인다 — bbox 는 이미 손에 있으니 화면 밖일 때만 데려간다. 판정은 씬이 실제 카메라로
    // 한다(planCameraFocus). 사용자가 지금 칠하거나 화면을 끌고 있으면 씬이 요청을 무시한다.
    if (target.bounds) {
      requestEditorCameraFocus({
        mapId: target.mapId,
        // 내림하지 않는다 — planCameraFocus 가 쓰는 정확한 중심과 폴백 값이 어긋나면 반 타일이 밀린다.
        tileX: target.bounds.x + target.bounds.width / 2,
        tileY: target.bounds.y + target.bounds.height / 2,
        bounds: target.bounds,
        // 다른 맵으로 옮겨 가며 시공 연출을 트는 경우(새 마을 맵)는 어차피 화면이 바뀐다 — 지어지는 전체가 보이게 줌을 맞춘다.
        // 같은 맵에서 보던 자리는 빼앗지 않는다(onlyIfOffscreen).
        onlyIfOffscreen: !(reveal && !sameMap),
        ...(sameMap ? {} : { immediate: true }),
      });
    }
  });
  return target;
}

export function summarizeAcceptedAgentChanges(before: Project, after: Project): AgentFocusTarget | null {
  const focusByMap = new Map<MapId, MutableFocus>();
  const afterMapIds = Object.keys(after.maps);
  let order = 0;

  for (const mapId of afterMapIds) {
    const afterMap = after.maps[mapId];
    if (!afterMap) continue;
    const beforeMap = before.maps[mapId];
    if (beforeMap === afterMap) continue;
    const focus = ensureFocus(focusByMap, mapId, order++);
    if (!beforeMap) {
      includeBounds(focus, fullMapBounds(afterMap));
      focus.score += afterMap.width * afterMap.height + 1000;
      continue;
    }

    collectChangedTiles(beforeMap, afterMap, focus);
    collectChangedTileStacks(beforeMap, afterMap, focus);
    collectChangedEvents(beforeMap, afterMap, focus);
    if (beforeMap.width !== afterMap.width || beforeMap.height !== afterMap.height) {
      includeResizeArea(beforeMap, afterMap, focus);
      focus.score += Math.max(1, Math.abs(afterMap.width * afterMap.height - beforeMap.width * beforeMap.height));
    } else if (focus.cells.length === 0 && mapMetadataChanged(beforeMap, afterMap)) {
      focus.score += 1;
    }
  }

  includeStartPositionChange(before, after, focusByMap, order);

  if (focusByMap.size === 0 && Object.keys(before.maps).some((mapId) => !after.maps[mapId])) {
    const fallbackMapId = after.maps[after.startMapId] ? after.startMapId : afterMapIds[0];
    if (fallbackMapId) ensureFocus(focusByMap, fallbackMapId, order).score = 1;
  }

  let best: MutableFocus | null = null;
  for (const focus of focusByMap.values()) {
    if (focus.score <= 0) continue;
    if (!best || focus.score > best.score || (focus.score === best.score && focus.order > best.order)) {
      best = focus;
    }
  }
  if (!best) return null;
  return {
    mapId: best.mapId,
    cells: dedupeCells(best.cells),
    bounds: best.bounds,
    score: best.score,
  };
}

function ensureFocus(map: Map<MapId, MutableFocus>, mapId: MapId, order: number): MutableFocus {
  const existing = map.get(mapId);
  if (existing) return existing;
  const next: MutableFocus = { bounds: null, cells: [], mapId, order, score: 0 };
  map.set(mapId, next);
  return next;
}

function collectChangedTiles(before: GameMap, after: GameMap, focus: MutableFocus): void {
  const commonWidth = Math.min(before.width, after.width);
  const commonHeight = Math.min(before.height, after.height);
  for (let y = 0; y < commonHeight; y += 1) {
    for (let x = 0; x < commonWidth; x += 1) {
      const beforeIndex = y * before.width + x;
      const afterIndex = y * after.width + x;
      if (before.lowerTiles[beforeIndex] !== after.lowerTiles[afterIndex]) includeCell(focus, { x, y, layer: "lower" });
      if (before.upperTiles[beforeIndex] !== after.upperTiles[afterIndex]) includeCell(focus, { x, y, layer: "upper" });
    }
  }
  if (after.width > before.width) {
    for (let y = 0; y < after.height; y += 1) {
      for (let x = before.width; x < after.width; x += 1) {
        includeCell(focus, { x, y, layer: "lower" });
        includeCell(focus, { x, y, layer: "upper" });
      }
    }
  }
  if (after.height > before.height) {
    for (let y = before.height; y < after.height; y += 1) {
      for (let x = 0; x < Math.min(before.width, after.width); x += 1) {
        includeCell(focus, { x, y, layer: "lower" });
        includeCell(focus, { x, y, layer: "upper" });
      }
    }
  }
}

function collectChangedTileStacks(before: GameMap, after: GameMap, focus: MutableFocus): void {
  if (before.width !== after.width || before.height !== after.height) return;
  collectChangedStackLayer(before.lowerTileStacks, after.lowerTileStacks, after, "lower", focus);
  collectChangedStackLayer(before.upperTileStacks, after.upperTileStacks, after, "upper", focus);
}

function collectChangedStackLayer(
  before: Record<number, number[]> | undefined,
  after: Record<number, number[]> | undefined,
  map: GameMap,
  layer: "lower" | "upper",
  focus: MutableFocus
): void {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const raw of keys) {
    const index = Number.parseInt(raw, 10);
    if (!Number.isInteger(index) || index < 0 || index >= map.width * map.height) continue;
    const prev = JSON.stringify(before?.[index] ?? []);
    const next = JSON.stringify(after?.[index] ?? []);
    if (prev !== next) includeCell(focus, { x: index % map.width, y: Math.floor(index / map.width), layer });
  }
}

function collectChangedEvents(before: GameMap, after: GameMap, focus: MutableFocus): void {
  const beforeEvents = eventById(before.events);
  const afterEvents = eventById(after.events);
  for (const [id, event] of afterEvents) {
    const prev = beforeEvents.get(id);
    if (!prev) {
      includeCell(focus, { x: event.x, y: event.y, layer: "event" });
    } else if (JSON.stringify(prev) !== JSON.stringify(event)) {
      includeCell(focus, { x: event.x, y: event.y, layer: "event" });
      if (prev.x !== event.x || prev.y !== event.y) includeCell(focus, { x: prev.x, y: prev.y, layer: "event" });
    }
  }
  for (const [id, event] of beforeEvents) {
    if (!afterEvents.has(id)) includeCell(focus, { x: event.x, y: event.y, layer: "event" });
  }
}

function eventById(events: readonly GameEvent[]): Map<string, GameEvent> {
  return new Map(events.map((event) => [event.id, event]));
}

function includeStartPositionChange(before: Project, after: Project, focusByMap: Map<MapId, MutableFocus>, order: number): void {
  if (
    before.startMapId === after.startMapId &&
    before.startPos.x === after.startPos.x &&
    before.startPos.y === after.startPos.y
  ) {
    return;
  }
  const map = after.maps[after.startMapId];
  if (!map) return;
  const focus = ensureFocus(focusByMap, after.startMapId, order);
  includeCell(focus, { x: after.startPos.x, y: after.startPos.y, layer: "event" });
}

function includeResizeArea(before: GameMap, after: GameMap, focus: MutableFocus): void {
  if (after.width <= 0 || after.height <= 0) return;
  if (after.width < before.width || after.height < before.height) {
    includeBounds(focus, fullMapBounds(after));
    return;
  }
  if (after.width > before.width) {
    includeBounds(focus, { x: before.width, y: 0, width: after.width - before.width, height: after.height });
  }
  if (after.height > before.height) {
    includeBounds(focus, { x: 0, y: before.height, width: after.width, height: after.height - before.height });
  }
}

function includeCell(focus: MutableFocus, cell: AgentFocusCell): void {
  focus.cells.push(cell);
  includeBounds(focus, { x: cell.x, y: cell.y, width: 1, height: 1 });
  focus.score += 1;
}

function includeBounds(focus: MutableFocus, bounds: AgentFocusBounds): void {
  if (bounds.width <= 0 || bounds.height <= 0) return;
  if (!focus.bounds) {
    focus.bounds = bounds;
    return;
  }
  const x0 = Math.min(focus.bounds.x, bounds.x);
  const y0 = Math.min(focus.bounds.y, bounds.y);
  const x1 = Math.max(focus.bounds.x + focus.bounds.width, bounds.x + bounds.width);
  const y1 = Math.max(focus.bounds.y + focus.bounds.height, bounds.y + bounds.height);
  focus.bounds = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function fullMapBounds(map: GameMap): AgentFocusBounds {
  return { x: 0, y: 0, width: map.width, height: map.height };
}

function dedupeCells(cells: readonly AgentFocusCell[]): readonly AgentFocusCell[] {
  const unique = new Map<string, AgentFocusCell>();
  for (const cell of cells) unique.set(`${cell.layer}:${cell.x},${cell.y}`, cell);
  return [...unique.values()];
}

function mapMetadataChanged(before: GameMap, after: GameMap): boolean {
  return (
    before.name !== after.name ||
    before.tilesetId !== after.tilesetId ||
    before.tileSize !== after.tileSize ||
    before.encounterRate !== after.encounterRate ||
    JSON.stringify(before.troopIds ?? []) !== JSON.stringify(after.troopIds ?? []) ||
    JSON.stringify(before.encounterTable ?? []) !== JSON.stringify(after.encounterTable ?? []) ||
    JSON.stringify(before.fieldSpawns ?? []) !== JSON.stringify(after.fieldSpawns ?? [])
  );
}
