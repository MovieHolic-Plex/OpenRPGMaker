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

export function committedEvents(events: readonly GameEvent[]): GameEvent[] {
  const committed: GameEvent[] = [];
  for (const event of events) {
    if (!event.draft) {
      committed.push(structuredClone(event));
      continue;
    }
    if (event.draft.kind === "edit" && event.draft.original) {
      committed.push(structuredClone(event.draft.original));
    }
  }
  return committed;
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
      changes: [{ path: "event", before: undefined, after }],
    };
  }
  const before = draft.original;
  if (!before) return null;
  return {
    mapId,
    eventId: event.id,
    kind: "updated",
    changes: diffValues(before, after, "event"),
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
