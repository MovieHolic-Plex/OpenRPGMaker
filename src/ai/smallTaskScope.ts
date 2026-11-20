import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { eventDisplayName } from "@/project/eventDisplayName";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { compactMapLayers, EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt, TILE_LAYER_NOS } from "@/project/mapLayers";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { getTool } from "@/editor/tools/toolRegistry";
import { onlyDialogueChanged } from "./smallTaskDialogueScope";

type DatabaseCollection = keyof Project["database"];
type PageTarget = { readonly mapId: string; readonly eventId: string; readonly pageId: string };

/** Supplied by the host from the user's selection. Tool arguments never define this boundary. */
export type SmallTaskScope =
  | (PageTarget & { readonly kind: "dialogue" })
  | (PageTarget & { readonly kind: "eventPage" })
  | { readonly kind: "tileEvent"; readonly mapId: string; readonly x: number; readonly y: number; readonly eventId: string | null }
  | {
      readonly kind: "dbEntries";
      readonly entries: readonly { readonly collection: DatabaseCollection; readonly id: string }[];
      readonly create?: { readonly collection: DatabaseCollection; readonly max: number };
    };

export type SmallTaskScopeResult = { readonly ok: true } | {
  readonly ok: false;
  readonly reason: string;
  readonly violations: readonly { readonly what: string }[];
};

const COMMAND_TOOLS = new Set(["insert_event_command", "update_event_command", "delete_event_command"]);

export function smallTaskScopeAllowsTool(scope: SmallTaskScope, name: string): boolean {
  const tool = getTool(name);
  if (!tool) return false;
  if (tool.mode === "read") return true;
  if (scope.kind === "dialogue") return name === "rewrite_dialogue" || COMMAND_TOOLS.has(name);
  if (scope.kind === "eventPage") return name === "event_command_assist" || COMMAND_TOOLS.has(name);
  return true;
}

type Report = (what: string) => void;

const MAP_TILE_KEYS = ["lowerTiles", "upperTiles", ...EXTRA_LAYER_KEYS, "lowerTileStacks", "upperTileStacks"] as const;
const ROOT_LABELS: Readonly<Record<string, string>> = {
  meta: "프로젝트 정보", system: "게임 시스템 설정", session: "게임 시작 상태",
  tilesets: "타일셋", assets: "리소스", resourceProfiles: "리소스 설정", switches: "스위치 자료",
  variables: "변수 자료", commonEvents: "공용 이벤트", mapTree: "맵 목록", mapConnections: "맵 연결",
  quests: "퀘스트", endings: "엔딩", characters: "캐릭터 자료",
};

function keysOf<T extends object>(before: T, after: T): (keyof T)[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort() as (keyof T)[];
}

function mapLabel(map: GameMap | undefined, id: string): string {
  return `『${map?.name?.trim() || id}』 맵`;
}

function eventLabel(map: GameMap, event: GameEvent): string {
  return `${mapLabel(map, map.id)}의 『${eventDisplayName(event)}』 이벤트`;
}

type Entry = { readonly id: string; readonly name?: string; readonly title?: string; readonly label?: string };

function entryLabel(collection: string, entry: Entry): string {
  const collectionLabel = DATABASE_AREA_LABELS[collection] ?? "레코드";
  return `자료집 ${collectionLabel} 『${entry.name?.trim() || entry.title?.trim() || entry.label?.trim() || entry.id}』`;
}

function describeRecordChanges(
  before: readonly Entry[], after: readonly Entry[], label: (entry: Entry) => string, orderLabel: string, report: Report,
): void {
  const oldRecords = new Map(before.map(entry => [entry.id, entry]));
  const newRecords = new Map(after.map(entry => [entry.id, entry]));
  if (oldRecords.size !== before.length || newRecords.size !== after.length) report(`${orderLabel}의 중복 항목`);
  for (const [id, entry] of oldRecords) if (!jsonEqual(entry, newRecords.get(id))) report(label(entry));
  for (const [id, entry] of newRecords) if (!oldRecords.has(id)) report(label(entry));
  const oldOrder = before.filter(entry => newRecords.has(entry.id)).map(entry => entry.id);
  const newOrder = after.filter(entry => oldRecords.has(entry.id)).map(entry => entry.id);
  if (!jsonEqual(oldOrder, newOrder)) report(`${orderLabel}의 순서`);
}

function describeOutsideChanges(before: Project, after: Project, report: Report): void {
  for (const key of keysOf(before, after)) {
    if (jsonEqual(before[key], after[key])) continue;
    if (key === "maps") {
      for (const id of keysOf(before.maps, after.maps)) {
        const oldMap = before.maps[id];
        const newMap = after.maps[id];
        if (jsonEqual(oldMap, newMap)) continue;
        const label = mapLabel(oldMap ?? newMap, id);
        if (!oldMap || !newMap) {
          report(label);
          continue;
        }
        if (!jsonEqual(oldMap.events, newMap.events)) {
          describeRecordChanges(oldMap.events, newMap.events, entry => eventLabel(oldMap, entry as GameEvent), `${label} 이벤트 목록`, report);
        }
        if (MAP_TILE_KEYS.some(field => !jsonEqual(oldMap[field], newMap[field]))) report(`${label}의 타일`);
        if (keysOf(oldMap, newMap).some(field => field !== "events" && !MAP_TILE_KEYS.some(tileField => tileField === field)
          && !jsonEqual(oldMap[field], newMap[field]))) report(`${label}의 속성`);
      }
    } else if (key === "database") {
      for (const collection of keysOf(before.database, after.database)) {
        const oldEntries = before.database[collection];
        const newEntries = after.database[collection];
        if (jsonEqual(oldEntries, newEntries)) continue;
        const label = `자료집 ${DATABASE_AREA_LABELS[collection] ?? "레코드"} 목록`;
        if (Array.isArray(oldEntries) || Array.isArray(newEntries)) {
          describeRecordChanges(oldEntries ?? [], newEntries ?? [], entry => entryLabel(collection, entry), label, report);
        }
        if (oldEntries === undefined || newEntries === undefined) report(label);
      }
    } else if (key === "session") {
      const { selfSwitches: oldSwitches, ...oldState } = before.session;
      const { selfSwitches: newSwitches, ...newState } = after.session;
      if (!jsonEqual(oldState, newState)) report(ROOT_LABELS.session!);
      for (const id of keysOf(oldSwitches ?? {}, newSwitches ?? {})) {
        if (jsonEqual(oldSwitches?.[id], newSwitches?.[id])) continue;
        const map = Object.values(before.maps).find(entry => entry.events.some(event => event.id === id));
        const event = map?.events.find(entry => entry.id === id);
        report(`${map && event ? eventLabel(map, event) : `『${id}』 이벤트`}의 셀프 스위치`);
      }
      if (jsonEqual(oldSwitches ?? {}, newSwitches ?? {}) && !jsonEqual(oldSwitches, newSwitches)) {
        report("게임 시작 상태의 셀프 스위치");
      }
    } else {
      report(ROOT_LABELS[key] ?? "프로젝트의 다른 설정");
    }
  }
}

function normalizePage(before: Project, after: Project, scope: PageTarget & { kind: "dialogue" | "eventPage" }, report: Report): Project {
  const oldMap = before.maps[scope.mapId];
  const map = after.maps[scope.mapId];
  const oldEvent = oldMap?.events.find(event => event.id === scope.eventId);
  const eventIndex = map?.events.findIndex(event => event.id === scope.eventId) ?? -1;
  const event = map?.events[eventIndex];
  const oldPage = oldEvent?.pages?.find(page => page.id === scope.pageId);
  const pageIndex = event?.pages?.findIndex(page => page.id === scope.pageId) ?? -1;
  const page = event?.pages?.[pageIndex];
  const label = `${oldMap && oldEvent ? eventLabel(oldMap, oldEvent) : mapLabel(oldMap ?? map, scope.mapId)}의 『${oldPage?.name || page?.name || scope.pageId}』 페이지`;
  if (!map || !event?.pages || !oldPage || !page) {
    report(`${label} 대상을 찾을 수 없음`);
    return after;
  }
  if (scope.kind === "dialogue" && !onlyDialogueChanged(oldPage.commands, page.commands)) {
    report(`${label}에서 대사 문구와 선택지 이름 외의 명령 변경`);
  }
  const pages = event.pages.slice();
  pages[pageIndex] = { ...page, commands: oldPage.commands };
  const events = map.events.slice();
  events[eventIndex] = { ...event, pages };
  return { ...after, maps: { ...after.maps, [scope.mapId]: { ...map, events } } };
}

function normalizeTileCells(before: GameMap, after: GameMap, index: number): GameMap {
  const map = { ...after };
  if (map.width !== before.width || map.height !== before.height) return map;
  for (const key of MAP_TILE_KEYS) {
    const values = map[key];
    if (Array.isArray(values)) Object.assign(map, { [key]: values.slice() });
  }
  for (const layer of TILE_LAYER_NOS) setLayerTileAt(map, layer, index, layerTileAt(before, layer, index));
  setShadowAt(map, index, shadowAt(before, index));
  // An optional layer appears when its first cell is painted and disappears when its last cell is erased.
  const originalLayers = { ...before };
  compactMapLayers(originalLayers);
  compactMapLayers(map);
  for (const key of EXTRA_LAYER_KEYS) {
    if (!map[key] && !originalLayers[key]) map[key] = before[key];
  }
  for (const key of ["lowerTileStacks", "upperTileStacks"] as const) {
    const stack = { ...map[key] };
    if (before[key]?.[index] !== undefined) stack[index] = before[key]![index]!;
    else delete stack[index];
    const original = before[key];
    map[key] = Object.keys(stack).length ? stack : original && Object.keys(original).length === 0 ? original : undefined;
  }
  return map;
}

function eventOwnsSelfSwitches(project: Project, eventId: string): boolean {
  let count = 0;
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) if (event.id === eventId && ++count > 1) return false;
  }
  return count === 1;
}

function normalizeTileEvent(before: Project, after: Project, scope: Extract<SmallTaskScope, { kind: "tileEvent" }>, report: Report): Project {
  const { mapId, x, y, eventId } = scope;
  const oldMap = before.maps[mapId];
  const newMap = after.maps[mapId];
  const label = mapLabel(oldMap ?? newMap, mapId);
  if (!oldMap || !newMap || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= oldMap.width || y >= oldMap.height) {
    report(`${label}의 대상 칸을 찾을 수 없음`);
    return after;
  }
  const atTile = (entry: GameEvent): boolean => entry.x === x && entry.y === y;
  const map = normalizeTileCells(oldMap, newMap, y * oldMap.width + x);
  let editedEventId: string | undefined;
  let removedEvent = false;
  if (eventId === null) {
    const oldIds = new Set(oldMap.events.map(event => event.id));
    const additions = map.events.filter(event => !oldIds.has(event.id));
    const allowed = additions.find(atTile);
    if (allowed) {
      map.events = map.events.filter(event => event !== allowed);
      editedEventId = allowed.id;
    }
  } else {
    const originalIndex = oldMap.events.findIndex(event => event.id === eventId);
    const original = oldMap.events[originalIndex];
    const index = map.events.findIndex(event => event.id === eventId);
    const event = map.events[index];
    if (!original || !atTile(original) || (event && !atTile(event))) {
      report(`${original ? eventLabel(oldMap, original) : `${label}의 대상 이벤트`}의 위치`);
    } else {
      map.events = map.events.slice();
      if (event) map.events[index] = original;
      else map.events.splice(originalIndex, 0, original);
      editedEventId = eventId;
      removedEvent = !event;
    }
  }

  let session = after.session;
  // Self switches are stored by event ID alone, so a duplicated ID cannot be treated as event-local.
  if (editedEventId && !jsonEqual(before.session.selfSwitches, after.session.selfSwitches)
    && (removedEvent || eventOwnsSelfSwitches(after, editedEventId))
    && (eventId === null ? !Object.hasOwn(before.session.selfSwitches ?? {}, editedEventId) : eventOwnsSelfSwitches(before, editedEventId))) {
    const selfSwitches = { ...after.session.selfSwitches };
    const original = before.session.selfSwitches?.[editedEventId];
    if (original === undefined) delete selfSwitches[editedEventId];
    else selfSwitches[editedEventId] = original;
    session = { ...after.session, selfSwitches: Object.keys(selfSwitches).length ? selfSwitches : before.session.selfSwitches && {} };
  }
  return { ...after, session, maps: { ...after.maps, [mapId]: map } };
}

function normalizeDatabase(before: Project, after: Project, scope: Extract<SmallTaskScope, { kind: "dbEntries" }>, changed: Set<string>) {
  const database = { ...after.database };
  const referenceDatabase = { ...after.database };
  const collections = new Set(scope.entries.map(entry => entry.collection));
  if (scope.create) collections.add(scope.create.collection);
  const max = scope.create?.max ?? 0;
  const createLimit = Number.isSafeInteger(max) && max > 0 ? max : 0;
  for (const collection of collections) {
    const oldEntries = before.database[collection];
    const newEntries = after.database[collection];
    if (!Array.isArray(newEntries) || jsonEqual(oldEntries, newEntries)) continue;
    const original = new Map<string, Entry>(oldEntries?.map(entry => [entry.id, entry]));
    const editable = new Set(scope.entries.filter(entry => entry.collection === collection).map(entry => entry.id));
    const ids = new Set(newEntries.map(entry => entry.id));
    // Keep duplicate IDs visible to the comparison instead of masking them as allowed creates/edits.
    if (ids.size !== newEntries.length) continue;
    const additions: Entry[] = [];
    const kept: Entry[] = [];
    for (const entry of newEntries) {
      const oldEntry = original.get(entry.id);
      if (!oldEntry && scope.create?.collection === collection && additions.length < createLimit) {
        changed.add(entryLabel(collection, entry));
        additions.push(entry);
      } else if (oldEntry && editable.has(entry.id)) {
        if (!jsonEqual(oldEntry, entry)) changed.add(entryLabel(collection, entry));
        kept.push(oldEntry);
      } else {
        kept.push(entry);
      }
    }
    Object.assign(database, { [collection]: kept.length ? kept : oldEntries ? [] : undefined });
    // Existing diagnostics sometimes include a row index. Keep those indices stable while checking creates.
    if (additions.length) {
      const priorRows = newEntries.filter(entry => original.has(entry.id));
      Object.assign(referenceDatabase, { [collection]: [...priorRows, ...additions] });
    }
  }
  return { normalized: { ...after, database }, referenceAfter: { ...after, database: referenceDatabase } };
}

const REASONS: Record<SmallTaskScope["kind"], string> = {
  dialogue: "이 요청에서는 선택한 페이지의 대사 문구와 선택지 이름만 고칠 수 있습니다.",
  eventPage: "이 요청에서는 선택한 이벤트 페이지의 명령만 고칠 수 있습니다.",
  tileEvent: "이 요청에서는 선택한 칸과 그 칸의 이벤트만 고칠 수 있습니다.",
  dbEntries: "이 요청에서는 선택한 자료집 항목과 허용된 새 항목만 고칠 수 있습니다.",
};

export function checkSmallTaskScope(before: Project, after: Project, scope: SmallTaskScope): SmallTaskScopeResult {
  const outside = new Set<string>();
  const report: Report = what => { outside.add(what); };
  const changedEntries = new Set<string>();
  // Copy only the edited paths to preserve reference-equality fast paths for unchanged maps and assets.
  let normalized: Project;
  let referenceAfter: Project | undefined;
  switch (scope.kind) {
    case "dbEntries":
      ({ normalized, referenceAfter } = normalizeDatabase(before, after, scope, changedEntries));
      break;
    case "tileEvent":
      normalized = normalizeTileEvent(before, after, scope, report);
      break;
    default:
      normalized = normalizePage(before, after, scope, report);
  }
  describeOutsideChanges(before, normalized, report);

  let explanation = REASONS[scope.kind];
  if (referenceAfter && !outside.size && changedEntries.size) {
    const existingIssues = new Set(collectProjectReferenceIssues(before, { databaseOnly: true }));
    if (collectProjectReferenceIssues(referenceAfter, { databaseOnly: true }).some(issue => !existingIssues.has(issue))) {
      explanation = "바뀐 자료집 항목에 연결할 대상을 찾을 수 없습니다.";
      for (const label of changedEntries) report(`${label}의 참조`);
    }
  }

  const violations = [...outside].map(what => ({ what }));
  if (!violations.length) return { ok: true };
  const lines = violations.slice(0, 3).map(({ what }) => `범위 밖: ${what}`);
  if (violations.length > lines.length) lines.push(`그 밖에 ${violations.length - lines.length}곳`);
  return { ok: false, reason: [explanation, ...lines].join("\n"), violations };
}
