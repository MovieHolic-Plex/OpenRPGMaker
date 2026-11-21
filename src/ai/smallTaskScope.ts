import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { BUILTIN_EQUIPMENT_SLOTS } from "@/project/equipmentSlots";
import { eventDisplayName } from "@/project/eventDisplayName";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { compactMapLayers, EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt, TILE_LAYER_NOS } from "@/project/mapLayers";
import { exceedsMapDimensionLimit } from "@/project/mapSizeLimits";
import { questDefId } from "@/project/quest/questDef";
import type { GameEvent, GameMap, MapConnection, MapTreeNode, Project, Rect } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { getTool } from "@/editor/tools/toolRegistry";
import { SAVE_QUEST_EVENT_FIRST } from "@/editor/smallTask/primitives/errors";
import { onlyDialogueChanged } from "./smallTaskDialogueScope";
import { questDependsOnDraft, removedDatabaseReference, type SmallTaskDraftSource } from "./smallTaskReferences";

type DatabaseCollection = keyof Project["database"];
type ProjectArea = "quests" | "switches" | "variables" | "commonEvents" | "endings" | "system";
type PageTarget = { readonly mapId: string; readonly eventId: string; readonly pageId: string };

/** Supplied by the host from the user's selection. Tool arguments never define this boundary. */
export type SmallTaskScope =
  | (PageTarget & { readonly kind: "dialogue" })
  | (PageTarget & { readonly kind: "eventPage"; readonly field?: "conditions" })
  | { readonly kind: "tileEvent"; readonly mapId: string; readonly x: number; readonly y: number; readonly eventId: string | null }
  | {
      readonly kind: "dbEntries";
      readonly entries: readonly { readonly collection: DatabaseCollection; readonly id: string; readonly fields?: readonly string[] }[];
      readonly create?: { readonly collection: DatabaseCollection; readonly max: number; readonly ids?: readonly string[] };
      readonly remove?: true;
    }
  | { readonly kind: "dbRemove"; readonly collection: DatabaseCollection; readonly id: string }
  | { readonly kind: "mapRegion"; readonly mapId: string; readonly rect: Readonly<Rect> }
  | {
      readonly kind: "mapMeta";
      readonly mapId: string;
      readonly fields?: readonly (keyof GameMap)[];
      readonly connections?: "none" | "outgoing" | "both";
      readonly startPosition?: boolean;
    }
  | { readonly kind: "mapResize"; readonly mapId: string }
  | { readonly kind: "mapRemove"; readonly mapId: string }
  | { readonly kind: "newMap"; readonly max: 1; readonly sourceMapId?: string }
  | {
      readonly kind: "projectArea";
      readonly area: ProjectArea;
      readonly ids?: readonly string[];
      readonly create?: number;
      readonly fields?: readonly string[];
      readonly remove?: true;
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

function normalizePage(before: Project, after: Project, scope: Extract<SmallTaskScope, { kind: "dialogue" | "eventPage" }>, report: Report): Project {
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
  pages[pageIndex] = scope.kind === "eventPage" && scope.field === "conditions"
    ? { ...page, conditions: oldPage.conditions }
    : { ...page, commands: oldPage.commands };
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
  const create = scope.remove ? undefined : scope.create;
  if (create) collections.add(create.collection);
  const max = create?.max ?? 0;
  const createLimit = Number.isSafeInteger(max) && max > 0 ? max : 0;
  for (const collection of collections) {
    const oldEntries = before.database[collection];
    const newEntries = after.database[collection];
    if (!Array.isArray(newEntries) || jsonEqual(oldEntries, newEntries)) continue;
    const original = new Map<string, Entry>(oldEntries?.map(entry => [entry.id, entry]));
    const editable = new Map(scope.entries.filter(entry => entry.collection === collection).map(entry => [entry.id, entry]));
    const ids = new Set(newEntries.map(entry => entry.id));
    // Keep duplicate IDs visible to the comparison instead of masking them as allowed creates/edits.
    if (ids.size !== newEntries.length || original.size !== (oldEntries?.length ?? 0)) continue;
    const additions: Entry[] = [];
    const kept: Entry[] = [];
    for (const entry of newEntries) {
      const oldEntry = original.get(entry.id);
      const allowed = editable.get(entry.id);
      if (!oldEntry && create?.collection === collection && additions.length < createLimit
        && (create.ids === undefined || create.ids.includes(entry.id))) {
        changed.add(entryLabel(collection, entry));
        additions.push(entry);
      } else if (oldEntry && allowed && !scope.remove) {
        if (!jsonEqual(oldEntry, entry)) changed.add(entryLabel(collection, entry));
        kept.push(allowed.fields === undefined ? oldEntry : resetFields(oldEntry, entry, new Set(allowed.fields)));
      } else {
        kept.push(entry);
      }
    }
    if (scope.remove) {
      for (const [i, entry] of (oldEntries ?? []).entries()) {
        if (editable.has(entry.id) && !ids.has(entry.id)
          && !(collection === "equipmentSlots" && BUILTIN_EQUIPMENT_SLOTS.some(slot => slot.id === entry.id))) {
          changed.add(entryLabel(collection, entry));
          kept.splice(i, 0, entry);
        }
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

function mapRegionPassability(
  before: Project, after: Project, map: GameMap, inside: (index: number) => boolean,
): Project["tilesets"] {
  const original = before.tilesets[map.tilesetId];
  const edited = after.tilesets[map.tilesetId];
  if (!original || !edited || jsonEqual(original.passability, edited.passability)
    || original.passability.length !== edited.passability.length) return after.tilesets;
  const changed = new Set<number>();
  original.passability.forEach((flags, index) => {
    if (!jsonEqual(flags, edited.passability[index])) changed.add(index);
  });
  const selected = new Set<number>();
  const shared = new Set<number>();
  // Passability is a tileset property. Every occurrence in both versions must belong to the selection.
  for (const project of [before, after]) {
    for (const candidate of Object.values(project.maps)) {
      if (candidate.tilesetId !== map.tilesetId) continue;
      for (let index = 0; index < candidate.width * candidate.height; index++) {
        const seen = candidate.id === map.id && inside(index) ? selected : shared;
        for (const layer of TILE_LAYER_NOS) {
          const tile = layerTileAt(candidate, layer, index);
          if (changed.has(tile)) seen.add(tile);
        }
        for (const stack of [candidate.lowerTileStacks?.[index], candidate.upperTileStacks?.[index]]) {
          for (const tile of stack ?? []) if (changed.has(tile)) seen.add(tile);
        }
      }
    }
  }
  const passability = edited.passability.map((flags, index) =>
    selected.has(index) && !shared.has(index) ? original.passability[index]! : flags);
  return { ...after.tilesets, [map.tilesetId]: { ...edited, passability } };
}

function normalizeMapRegion(
  before: Project, after: Project, { mapId, rect }: Extract<SmallTaskScope, { kind: "mapRegion" }>, report: Report,
): Project {
  const original = before.maps[mapId];
  const map = after.maps[mapId];
  const { x, y, w, h } = rect;
  const label = mapLabel(original ?? map, mapId);
  if (!original || !map || original.width !== map.width || original.height !== map.height
    || ![x, y, w, h].every(Number.isSafeInteger) || x < 0 || y < 0 || w < 1 || h < 1
    || x + w > map.width || y + h > map.height) {
    report(`${label}의 선택 영역`);
    return after;
  }
  const size = map.width * map.height;
  const inside = (index: number) => {
    const column = index % map.width;
    const row = Math.floor(index / map.width);
    return Number.isSafeInteger(index) && index >= 0 && column >= x && column < x + w && row >= y && row < y + h;
  };
  for (const key of MAP_TILE_KEYS) {
    if (jsonEqual(original[key], map[key])) continue;
    if (key === "lowerTileStacks" || key === "upperTileStacks") {
      const oldStacks: Record<string, number[]> = original[key] ?? {};
      const newStacks: Record<string, number[]> = map[key] ?? {};
      if (Object.keys({ ...oldStacks, ...newStacks }).some(key => {
        const index = Number(key);
        return !jsonEqual(oldStacks[key], newStacks[key]) && (!inside(index) || String(index) !== key);
      })) report(`${label}의 선택 영역 바깥 타일 더미`);
      continue;
    }
    const defaultValue = key === "shadowBits" ? 0 : -1;
    const oldLayer = original[key];
    const newLayer = map[key];
    const required = key === "lowerTiles" || key === "upperTiles";
    if ((newLayer !== undefined && (!Array.isArray(newLayer) || newLayer.length !== size)) || (required && !newLayer)) {
      report(`${label}의 타일 층 크기`);
      continue;
    }
    for (let index = 0; index < Math.max(size, oldLayer?.length ?? 0); index++) {
      if (!inside(index) && (oldLayer?.[index] ?? defaultValue) !== (newLayer?.[index] ?? defaultValue)) {
        report(`${label}의 선택 영역 바깥 타일`);
        break;
      }
    }
  }
  const normalized = { ...map };
  for (const key of MAP_TILE_KEYS) Object.assign(normalized, { [key]: original[key] });
  return { ...after, maps: { ...after.maps, [mapId]: normalized }, tilesets: mapRegionPassability(before, after, original, inside) };
}

function mentionsMap(connection: MapConnection, mapId: string): boolean {
  return connection.from.mapId === mapId || connection.to.mapId === mapId;
}

function normalizeMapMeta(
  before: Project, after: Project, scope: Extract<SmallTaskScope, { kind: "mapMeta" }>, report: Report,
): Project {
  const { mapId, fields, connections = "outgoing", startPosition = fields === undefined } = scope;
  const original = before.maps[mapId];
  const map = after.maps[mapId];
  if (!original || !map) {
    report(`${mapLabel(original ?? map, mapId)} 대상을 찾을 수 없음`);
    return after;
  }
  const structural = new Set<string>([
    "id", "width", "height", "events", "relief", "doodadGroups", "terrainDesign", "worldmapSource", ...MAP_TILE_KEYS,
  ]);
  const editable = new Set(fields ?? keysOf(original, map));
  const normalized = resetFields(original, map, new Set([...editable].filter(key => !structural.has(key))));
  const protectedConnections = (project: Project) => (project.mapConnections ?? []).filter(connection =>
    connections === "both" ? !mentionsMap(connection, mapId) : connection.from.mapId !== mapId);
  const connectionsAllowed = connections !== "none" && jsonEqual(protectedConnections(before), protectedConnections(after))
    && new Set(after.mapConnections?.map(connection => connection.id)).size === (after.mapConnections?.length ?? 0);
  const startAllowed = startPosition && after.startMapId === mapId;
  return {
    ...after,
    maps: { ...after.maps, [mapId]: normalized },
    mapConnections: connectionsAllowed ? before.mapConnections : after.mapConnections,
    startMapId: startAllowed ? before.startMapId : after.startMapId,
    startPos: startAllowed ? before.startPos : after.startPos,
  };
}

function normalizeMapResize(before: Project, after: Project, mapId: string, report: Report): Project {
  const original = before.maps[mapId];
  const map = after.maps[mapId];
  if (!original || !map || ![map.width, map.height].every(size => Number.isSafeInteger(size) && size > 0)) {
    report(`${mapLabel(original ?? map, mapId)}의 크기`);
    return after;
  }
  if (original.width === map.width && original.height === map.height) return after;
  if (exceedsMapDimensionLimit(map.width, map.height)) {
    report(`${mapLabel(map, mapId)}의 크기`);
    return after;
  }
  const size = map.width * map.height;
  if (map.lowerTiles.length !== size || map.upperTiles.length !== size
    || EXTRA_LAYER_KEYS.some(key => map[key] !== undefined && map[key]?.length !== size)) {
    report(`${mapLabel(map, mapId)}의 타일 층 크기`);
  }
  const mapWithOldSize = resetFields(original, map, new Set(["width", "height", ...MAP_TILE_KEYS]));
  return { ...after, maps: { ...after.maps, [mapId]: mapWithOldSize } };
}

function normalizeMapRemove(before: Project, after: Project, mapId: string, report: Report): Project {
  const map = before.maps[mapId];
  if (!map || mapId === before.startMapId || Object.hasOwn(after.maps, mapId)) {
    if (!map || !jsonEqual(map, after.maps[mapId])) report(`${mapLabel(map, mapId)}의 삭제`);
    return after;
  }
  function survivingNodes(node: MapTreeNode): MapTreeNode[] {
    const children = node.children.flatMap(survivingNodes);
    return node.mapId === mapId ? children : [{ ...node, children }];
  }
  const [first, ...siblings] = survivingNodes(before.mapTree);
  const [newRoot, ...others] = Object.keys(before.maps).filter(id => id !== mapId);
  const expectedTree = first ? { ...first, children: [...first.children, ...siblings] }
    : { mapId: newRoot, children: others.map(id => ({ mapId: id, children: [] })) };
  if (!jsonEqual(after.mapTree, expectedTree)) {
    report(`${mapLabel(map, mapId)}의 맵 목록`);
    return after;
  }
  return {
    ...after, maps: { ...after.maps, [mapId]: map },
    mapTree: before.mapTree,
  };
}

function normalizeNewMap(
  before: Project, after: Project, scope: Extract<SmallTaskScope, { kind: "newMap" }>, report: Report,
): Project {
  const added = Object.keys(after.maps).filter(id => !Object.hasOwn(before.maps, id));
  if (added.length > scope.max) {
    report("새 맵은 한 장만 추가할 수 있음");
    return after;
  }
  const [id] = added;
  if (id === undefined) return after;
  const maps = { ...after.maps };
  if (maps[id]?.id !== id) report("새 맵의 식별 정보");
  delete maps[id];

  let entries = 0;
  const isNewLeaf = (node: MapTreeNode) => node.mapId === id && node.kind !== "folder" && node.children.length === 0;
  function withoutNewLeaf(node: MapTreeNode): MapTreeNode {
    const children = node.children.filter(child => {
      if (!isNewLeaf(child)) return true;
      entries++;
      return false;
    }).map(withoutNewLeaf);
    return { ...node, children };
  }
  const firstRoot = !before.mapTree.mapId && !before.mapTree.children.length && isNewLeaf(after.mapTree);
  const mapTree = firstRoot ? before.mapTree : withoutNewLeaf(after.mapTree);
  if (!firstRoot && entries !== 1) report("새 맵의 목록 항목");

  const newLinks = (after.mapConnections ?? []).filter(connection =>
    !before.mapConnections?.some(original => original.id === connection.id));
  const source = scope.sourceMapId;
  const allowedLink = newLinks.length === 1 && source && Object.hasOwn(before.maps, source)
    && mentionsMap(newLinks[0]!, id) && mentionsMap(newLinks[0]!, source) ? newLinks[0] : undefined;
  const links = after.mapConnections?.filter(link => link !== allowedLink);
  const mapConnections = jsonEqual(links ?? [], before.mapConnections ?? []) ? before.mapConnections : links;
  return { ...after, maps, mapTree, mapConnections };
}

function resetFields<T extends object>(before: T, after: T, fields: ReadonlySet<string>): T {
  const result = { ...after };
  for (const key of keysOf(before, after)) if (fields.has(String(key))) result[key] = before[key];
  return result;
}

function normalizeProjectArea(
  before: Project, after: Project, { area, ids, create, fields, remove }: Extract<SmallTaskScope, { kind: "projectArea" }>, report: Report,
): Project {
  const editable = new Set(ids);
  if (area === "system") {
    const systemFields = new Set(editable);
    if (editable.has("startParty")) systemFields.add("startActorIds");
    const sessionFields = new Set<string>();
    if (editable.has("startGold") || editable.has("session.gold")) sessionFields.add("gold");
    if (editable.has("startParty") || editable.has("session.partyActorIds")) sessionFields.add("partyActorIds");
    let system = resetFields(before.system, after.system, systemFields);
    if (editable.has("title") && before.system.titleScreen && after.system.titleScreen && !systemFields.has("titleScreen")) {
      system = { ...system, titleScreen: { ...after.system.titleScreen, title: before.system.titleScreen.title } };
    }
    const meta = editable.has("title") || editable.has("meta.title") ? { ...after.meta, title: before.meta.title } : after.meta;
    return { ...after, system, meta, session: resetFields(before.session, after.session, sessionFields) };
  }
  if (jsonEqual(before[area], after[area])) return after;
  const label = ROOT_LABELS[area]!;
  const oldRows = before[area] ?? [];
  const newRows = after[area] ?? [];
  const idOf = (row: (typeof oldRows)[number]) => "id" in row ? row.id : questDefId(row);
  const oldIds = new Set(oldRows.map(idOf));
  const newIds = new Set(newRows.map(idOf));
  if (newIds.size !== newRows.length) report(`${label}의 중복 항목`);
  const additions = newRows.filter(row => !oldIds.has(idOf(row)));
  const limit = !remove && create !== undefined && Number.isSafeInteger(create) && create > 0 ? create : 0;
  if (additions.length > limit) report(`${label}의 새 항목 수`);
  const unselected = (row: (typeof oldRows)[number]) => !editable.has(idOf(row));
  if (!jsonEqual(oldRows.filter(unselected), newRows.filter(row => oldIds.has(idOf(row)) && unselected(row)))) {
    report(`${label}의 선택하지 않은 항목`);
  }
  if (!jsonEqual(oldRows.filter(row => newIds.has(idOf(row))).map(idOf),
    newRows.filter(row => oldIds.has(idOf(row))).map(idOf))) report(`${label}의 순서`);
  if (remove || fields) {
    const allowedFields = new Set(remove ? [] : fields);
    const byId = new Map(newRows.map(row => [idOf(row), row]));
    for (const row of oldRows.filter(row => editable.has(idOf(row)))) {
      const next = byId.get(idOf(row));
      if (next ? !jsonEqual(row, resetFields(row, next, allowedFields)) : !remove) {
        report(`${label}의 허용되지 않은 항목 변경`);
      }
    }
  }
  return { ...after, [area]: before[area] };
}

const REASONS: Record<SmallTaskScope["kind"], string> = {
  dialogue: "이 요청에서는 선택한 페이지의 대사 문구와 선택지 이름만 고칠 수 있습니다.",
  eventPage: "이 요청에서는 선택한 이벤트 페이지의 명령만 고칠 수 있습니다.",
  tileEvent: "이 요청에서는 선택한 칸과 그 칸의 이벤트만 고칠 수 있습니다.",
  dbEntries: "이 요청에서는 선택한 자료집 항목과 허용된 새 항목만 고칠 수 있습니다.",
  dbRemove: "이 요청에서는 선택한 자료집 항목만 삭제할 수 있습니다.",
  mapRegion: "이 요청에서는 선택한 영역의 칸만 고칠 수 있습니다.",
  mapMeta: "이 요청에서는 선택한 맵의 속성과 연결만 고칠 수 있습니다.",
  mapResize: "이 요청에서는 선택한 맵의 크기와 그에 따른 타일만 바꿀 수 있습니다.",
  mapRemove: "이 요청에서는 선택한 맵과 그 맵의 목록 항목만 삭제할 수 있습니다.",
  newMap: "이 요청에서는 새 맵 한 장과 그 맵의 목록 항목, 출발 맵과의 연결만 추가할 수 있습니다.",
  projectArea: "이 요청에서는 지정된 프로젝트 항목만 고칠 수 있습니다.",
};

export function checkSmallTaskScope(
  before: Project, after: Project, scope: SmallTaskScope, live?: SmallTaskDraftSource,
): SmallTaskScopeResult {
  const outside = new Set<string>();
  const report: Report = what => { outside.add(what); };
  const changedEntries = new Set<string>();
  // Copy only the edited paths to preserve reference-equality fast paths for unchanged maps and assets.
  let normalized: Project;
  let referenceAfter: Project | undefined;
  let explanation = REASONS[scope.kind];
  const databaseScope = scope.kind === "dbRemove"
    ? { kind: "dbEntries", entries: [{ collection: scope.collection, id: scope.id }], remove: true } as const
    : scope.kind === "dbEntries" ? scope : undefined;
  switch (scope.kind) {
    case "dbRemove":
    case "dbEntries":
      ({ normalized, referenceAfter } = normalizeDatabase(before, after, databaseScope!, changedEntries));
      break;
    case "tileEvent":
      normalized = normalizeTileEvent(before, after, scope, report);
      break;
    case "mapRegion":
      normalized = normalizeMapRegion(before, after, scope, report);
      break;
    case "mapMeta":
      normalized = normalizeMapMeta(before, after, scope, report);
      break;
    case "mapResize":
      normalized = normalizeMapResize(before, after, scope.mapId, report);
      break;
    case "mapRemove":
      normalized = normalizeMapRemove(before, after, scope.mapId, report);
      break;
    case "newMap":
      normalized = normalizeNewMap(before, after, scope, report);
      break;
    case "projectArea":
      normalized = normalizeProjectArea(before, after, scope, report);
      break;
    default:
      if (scope.kind === "eventPage" && scope.field === "conditions") {
        explanation = "이 요청에서는 선택한 이벤트 페이지의 조건만 고칠 수 있습니다.";
      }
      normalized = normalizePage(before, after, scope, report);
  }
  describeOutsideChanges(before, normalized, report);

  if (scope.kind === "projectArea" && scope.area === "quests" && questDependsOnDraft(before, after, live)) {
    explanation = SAVE_QUEST_EVENT_FIRST;
    report("퀘스트가 사용하는 미저장 이벤트");
  }
  if (databaseScope?.remove && !outside.size && changedEntries.size) {
    const removed = databaseScope.entries.filter(({ collection, id }) =>
      before.database[collection]?.some(row => row.id === id) && !after.database[collection]?.some(row => row.id === id));
    if (removedDatabaseReference(before, after, removed, live)) {
      explanation = "다른 설정이나 이벤트, 스크립트에서 쓰는 자료집 항목은 삭제할 수 없습니다.";
      for (const label of changedEntries) report(`${label}의 참조`);
    }
  } else if (referenceAfter && !outside.size && changedEntries.size) {
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
