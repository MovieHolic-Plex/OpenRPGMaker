import { commitEventDraftAuthoredWrites, eventDraftAuthoredDiff } from "./eventDraftAuthored";
import type { GameEvent, GameMap, MapId, PersistedGameEvent, Project } from "@/project/types";

export type EventDiffKind = "created" | "updated";

export interface EventFieldDiff {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface EventDiff {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly kind: EventDiffKind;
  readonly changes: readonly EventFieldDiff[];
}

export function isEventDraft(event: GameEvent): boolean {
  return event.draft !== undefined;
}

export function isNewEventDraft(event: GameEvent): boolean {
  return event.draft?.kind === "new";
}

export function eventWithoutDraft(event: GameEvent): PersistedGameEvent {
  const snapshot = structuredClone(event);
  delete snapshot.draft;
  return snapshot;
}

/**
 * Events at the explicit Apply/OK commit boundary.
 *
 * Open new drafts do not exist in canonical project data yet. Open edit drafts
 * contribute their pre-edit original, never the working body. The working body
 * remains available to the editor through the live project and local draft vault.
 */
export function committedEvents(events: readonly GameEvent[]): GameEvent[] {
  const committed: GameEvent[] = [];
  for (const event of events) {
    if (event.draft?.kind === "new") continue;
    if (event.draft?.kind === "edit") {
      // A deleted canonical event must not be written back from the pre-edit snapshot.
      if (event.draft.conflict?.kind === "remote-delete") continue;
      if (event.draft.original) committed.push(structuredClone(event.draft.original));
      continue;
    }
    committed.push(eventWithoutDraft(event));
  }
  return committed;
}

/**
 * Working events shown by editor-only surfaces. Draft metadata is hidden from
 * consumers, while the current working body stays visible in the live session.
 */
export function editorWorkingEvents(events: readonly GameEvent[]): GameEvent[] {
  return events.map((event) => eventWithoutDraft(event));
}

export function mapWithCommittedEvents(map: GameMap): GameMap {
  const next = structuredClone(map);
  next.events = committedEvents(map.events);
  return next;
}

export function projectWithoutEventDrafts(project: Project): Project {
  const next = structuredClone(project);
  for (const map of Object.values(next.maps)) {
    map.events = committedEvents(map.events);
  }
  return next;
}

/**
 * A new draft has never been canonical, so a save round-trip must put it back.
 * An edit draft whose id is missing from the incoming project was deleted.
 * Putting that event back would undo the deletion on the next save.
 */
export function shouldRetainOpenEventDraft(
  incomingEvents: readonly { readonly id: string }[] | undefined,
  event: GameEvent,
): boolean {
  if (!event.draft) return false;
  if (event.draft.kind === "new") return true;
  return (incomingEvents ?? []).some((item) => item.id === event.id);
}

/**
 * Keep the on-screen working body, but point an edit draft's save baseline at the
 * incoming canonical event when that body is no longer `draft.original`.
 * The next `committedEvents` write then persists the incoming event, not the stale pre-edit snapshot.
 * A matching baseline (ordinary autosave round-trip) stays untouched. Conflict metadata on the draft is kept.
 */
export function rebaseOpenEditDraft(
  incomingEvents: readonly GameEvent[] | undefined,
  liveEvent: GameEvent,
): GameEvent {
  const next = structuredClone(liveEvent);
  if (next.draft?.kind !== "edit") return next;
  const incoming = (incomingEvents ?? []).find((item) => item.id === next.id);
  if (!incoming || incoming.draft) return next;
  const canonical = eventWithoutDraft(incoming);
  const original = next.draft.original;
  if (original && diffValues(original, canonical, "event").length === 0) return next;
  next.draft = { ...next.draft, kind: "edit", original: canonical };
  return next;
}

/**
 * 직렬화 전용 투영 — 같은 이벤트 규약(새 초안 제외, 편집 초안은 원본)을 적용하되
 * 프로젝트를 복제하지 않는다. 반환 객체는 원본과 타일 배열까지 구조를 공유하므로
 * **읽기/직렬화 외의 용도로 쓰면 안 된다.** 변형이 필요하면 projectWithoutEventDrafts 를 쓸 것.
 */
function projectViewWithoutEventDrafts(project: Project): Project {
  let maps: Record<string, GameMap> | null = null;
  for (const [mapId, map] of Object.entries(project.maps)) {
    if (!map.events.some((event) => event.draft !== undefined)) continue;
    maps ??= { ...project.maps };
    maps[mapId] = { ...map, events: committedEventsView(map.events) };
  }
  return maps ? { ...project, maps } : project;
}

/** committedEvents 의 복제 없는 쌍둥이. 같은 순서·같은 키로 같은 JSON 을 낸다. */
function committedEventsView(events: readonly GameEvent[]): GameEvent[] {
  const committed: GameEvent[] = [];
  for (const event of events) {
    if (event.draft?.kind === "new") continue;
    if (event.draft?.kind === "edit") {
      if (event.draft.conflict?.kind === "remote-delete") continue;
      if (event.draft.original) committed.push(event.draft.original);
      continue;
    }
    if (event.draft === undefined) {
      committed.push(event);
      continue;
    }
    const { draft: _dropped, ...withoutDraft } = event;
    committed.push(withoutDraft as GameEvent);
  }
  return committed;
}

/**
 * `JSON.stringify(projectWithoutEventDrafts(project))` 와 **바이트 단위로 같은 문자열**을
 * 프로젝트 전체 복제 없이 만든다.
 *
 * 왜 따로 두는가: 이 투영을 쓰는 호출자 대부분은 결과를 변형하므로 깊은 복제가 필요하다.
 * 그러나 내보내기 미러는 곧바로 stringify 만 한다 — 거기서 복제는 순수 낭비였고,
 * 120x100 맵 드래그 측정에서 그 경로 비용의 62%(874/1404ms)를 차지했다.
 */
export function projectJsonWithoutEventDrafts(project: Project): string {
  return JSON.stringify(projectViewWithoutEventDrafts(project));
}

/**
 * Re-apply in-memory event editor drafts onto a canonical saved project.
 * Canonical persistence omits new drafts and keeps edit originals; this restores
 * the local working body plus draft metadata so the session and Cancel survive
 * a remote merge/reload.
 */
export function projectWithPreservedEventDrafts(saved: Project, live: Project): Project {
  const next = structuredClone(saved);
  for (const [mapId, liveMap] of Object.entries(live.maps)) {
    const targetMap = next.maps[mapId];
    if (!targetMap) continue;
    for (const liveEvent of liveMap.events) {
      if (!liveEvent.draft) continue;
      const index = targetMap.events.findIndex((event) => event.id === liveEvent.id);
      if (index >= 0) {
        // Working body stays on screen. A changed canonical body becomes the next save baseline.
        targetMap.events[index] = rebaseOpenEditDraft(targetMap.events, liveEvent);
      } else if (liveEvent.draft.kind === "edit") {
        const preserved = structuredClone(liveEvent);
        preserved.draft = { ...preserved.draft!, conflict: { kind: "remote-delete", detectedAt: Date.now() } };
        targetMap.events.push(preserved);
      } else {
        targetMap.events.push(structuredClone(liveEvent));
      }
    }
  }
  return next;
}

export function beginEventEditDraft(project: Project, mapId: MapId, eventId: string): boolean {
  const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event || event.draft?.kind === "new") return false;
  if (event.draft?.kind === "edit") return true;
  event.draft = { kind: "edit", original: eventWithoutDraft(event) };
  return true;
}

export function commitEventDraft(project: Project, mapId: MapId, eventId: string): EventDiff | null {
  const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event?.draft) return null;
  const diff = eventDraftDiff(mapId, event);
  commitEventDraftAuthoredWrites(project, event);
  delete event.draft;
  return diff;
}

export function discardEventDraft(project: Project, mapId: MapId, eventId: string): boolean {
  const map = project.maps[mapId];
  if (!map) return false;
  const index = map.events.findIndex((event) => event.id === eventId);
  const event = map.events[index];
  if (index < 0 || !event?.draft) return false;
  if (event.draft.kind === "new") {
    map.events.splice(index, 1);
    return true;
  }
  if (event.draft.original) {
    map.events[index] = structuredClone(event.draft.original);
    return true;
  }
  return false;
}

/**
 * "사용자가 실제로 손댔는가" — 닫기 가드와 푸터 상태의 단일 판정 기준.
 * edit 드래프트는 original 대비, new 드래프트는 생성 직후 스냅샷(original에 저장) 대비.
 * new 드래프트의 created diff(항상 1건)를 그대로 쓰면 갓 만든 이벤트가
 * 손대기도 전에 "변경사항 있음"이 되므로(2026-08-18 적대 평가 B01) 분리한다.
 */
export function eventDraftHasUserChanges(project: Project, mapId: MapId, eventId: string): boolean {
  const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event?.draft) return false;
  if (eventDraftAuthoredDiff(event).length > 0) return true;
  const baseline = event.draft.original;
  if (!baseline) return event.draft.kind === "new" ? true : false;
  return diffValues(baseline, eventWithoutDraft(event), "event").length > 0;
}

export function eventDraftDiffById(project: Project, mapId: MapId, eventId: string): EventDiff | null {
  const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
  return event ? eventDraftDiff(mapId, event) : null;
}

export function eventDraftDiff(mapId: MapId, event: GameEvent): EventDiff | null {
  const draft = event.draft;
  if (!draft) return null;
  const after = eventWithoutDraft(event);
  if (draft.kind === "new") {
    return {
      mapId,
      eventId: event.id,
      kind: "created",
      changes: [{ path: "event", before: undefined, after }, ...eventDraftAuthoredDiff(event)],
    };
  }
  const before = draft.original;
  if (!before) return null;
  return {
    mapId,
    eventId: event.id,
    kind: "updated",
    changes: [...diffValues(before, after, "event"), ...eventDraftAuthoredDiff(event)],
  };
}

function diffValues(before: unknown, after: unknown, path: string): EventFieldDiff[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    return diffArrays(before, after, path);
  }
  if (isRecord(before) && isRecord(after)) {
    return diffRecords(before, after, path);
  }
  return [{ path, before, after }];
}

function diffArrays(before: readonly unknown[], after: readonly unknown[], path: string): EventFieldDiff[] {
  const diffs: EventFieldDiff[] = [];
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    diffs.push(...diffValues(before[index], after[index], `${path}[${index}]`));
  }
  return diffs;
}

function diffRecords(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
  path: string
): EventFieldDiff[] {
  const diffs: EventFieldDiff[] = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    if (!hasOwn(before, key)) {
      diffs.push({ path: `${path}.${key}`, before: undefined, after: after[key] });
      continue;
    }
    if (!hasOwn(after, key)) {
      diffs.push({ path: `${path}.${key}`, before: before[key], after: undefined });
      continue;
    }
    diffs.push(...diffValues(before[key], after[key], `${path}.${key}`));
  }
  return diffs;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function hasOwn(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
