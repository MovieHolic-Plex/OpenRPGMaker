import type { GameEvent, GameMap, Project, SwitchDef, VariableDef } from "@/project/types";

export type SearchKind = "map" | "mapEvent" | "commonEvent" | "switch" | "variable";
export type SearchScope = "selectedMap" | "all";

export const SEARCH_KIND_LABELS: Readonly<Record<SearchKind, string>> = {
  map: "맵",
  mapEvent: "맵 이벤트",
  commonEvent: "공통 이벤트",
  switch: "스위치",
  variable: "변수",
};

export type MapSearchTarget = {
  readonly kind: "map";
  readonly mapId: string;
};

export type EventSearchTarget = {
  readonly kind: "event";
  readonly mapId: string;
  readonly eventId: string;
};

export type CommonEventSearchTarget = {
  readonly kind: "commonEvent";
  readonly commonEventId: string;
};

export type SearchTarget = MapSearchTarget | EventSearchTarget | CommonEventSearchTarget;

export type EventReference = {
  readonly mapId: string;
  readonly eventId: string;
  readonly name: string;
  readonly location: string;
  readonly target: EventSearchTarget;
};

type BaseResult = {
  readonly kind: SearchKind;
  readonly name: string;
  readonly location: string;
  readonly detail: string;
};

export type DirectResult = BaseResult & {
  readonly kind: "map" | "mapEvent" | "commonEvent";
  readonly target: SearchTarget;
};

export type ReferenceResult = BaseResult & {
  readonly kind: "switch" | "variable";
  readonly references: readonly EventReference[];
};

export type SearchResult = DirectResult | ReferenceResult;

export type SearchRequest = {
  readonly project: Project;
  readonly selectedMapId: string;
  readonly query: string;
  readonly scope: SearchScope;
};

export function searchProject(request: SearchRequest): SearchResult[] {
  const query = normalize(request.query);
  if (!query) return [];

  const maps = mapsInScope(request.project, request.selectedMapId, request.scope);
  return [
    ...mapResults(maps, query),
    ...mapEventResults(maps, query),
    ...(request.scope === "all" ? commonEventResults(request.project, query) : []),
    ...recordResults(request.project, maps, "switch", query),
    ...recordResults(request.project, maps, "variable", query),
  ];
}

function mapsInScope(project: Project, selectedMapId: string, scope: SearchScope): readonly GameMap[] {
  if (scope === "all") return Object.values(project.maps);
  const selected = project.maps[selectedMapId];
  return selected ? [selected] : [];
}

function mapResults(maps: readonly GameMap[], query: string): DirectResult[] {
  return maps.filter((map) => matches(query, map.name, map.id)).map((map) => ({
    kind: "map",
    name: displayName(map.name, map.id),
    location: `${map.width} × ${map.height}`,
    detail: map.id,
    target: { kind: "map", mapId: map.id },
  }));
}

function mapEventResults(maps: readonly GameMap[], query: string): DirectResult[] {
  return maps.flatMap((map) => map.events.flatMap((event) => matchingEventResults(map, event, query)));
}

function matchingEventResults(map: GameMap, event: GameEvent, query: string): DirectResult[] {
  const matchingPages = (event.pages ?? []).filter((page) => matches(query, page.name));
  if (matchingPages.length > 0) {
    return matchingPages.map((page, index) => ({
      kind: "mapEvent",
      name: displayName(page.name, event.id),
      location: `${displayName(map.name, map.id)} · 페이지 ${pageNumber(event, page.id, index)}`,
      detail: `${event.id} · (${event.x}, ${event.y})`,
      target: { kind: "event", mapId: map.id, eventId: event.id },
    }));
  }
  if (!matches(query, event.id)) return [];
  return [{
    kind: "mapEvent",
    name: displayName(event.pages?.[0]?.name ?? "", event.id),
    location: displayName(map.name, map.id),
    detail: `${event.id} · (${event.x}, ${event.y})`,
    target: { kind: "event", mapId: map.id, eventId: event.id },
  }];
}

function pageNumber(event: GameEvent, pageId: string, fallbackIndex: number): number {
  const index = event.pages?.findIndex((page) => page.id === pageId) ?? fallbackIndex;
  return Math.max(0, index) + 1;
}

function commonEventResults(project: Project, query: string): DirectResult[] {
  return project.commonEvents.filter((event) => matches(query, event.name, event.id)).map((event) => ({
    kind: "commonEvent",
    name: displayName(event.name, event.id),
    location: "공통 이벤트",
    detail: event.id,
    target: { kind: "commonEvent", commonEventId: event.id },
  }));
}

function recordResults(
  project: Project,
  maps: readonly GameMap[],
  kind: "switch" | "variable",
  query: string,
): ReferenceResult[] {
  const records: readonly (SwitchDef | VariableDef)[] = kind === "switch" ? project.switches : project.variables;
  return records.filter((record) => matches(query, record.name, record.id)).flatMap((record) => {
    const references = maps.flatMap((map) => map.events.filter((event) => eventReferences(event, kind, record.id)).map((event): EventReference => ({
      mapId: map.id,
      eventId: event.id,
      name: eventDisplayName(event),
      location: displayName(map.name, map.id),
      target: { kind: "event", mapId: map.id, eventId: event.id },
    })));
    if (references.length === 0) return [];
    return [{
      kind,
      name: displayName(record.name, record.id),
      location: `${references.length}개 이벤트에서 사용`,
      detail: record.id,
      references,
    }];
  });
}

function eventReferences(event: GameEvent, kind: "switch" | "variable", id: string): boolean {
  return referencesValue(event.condition, kind, id)
    || referencesValue(event.commands, kind, id)
    || (event.pages ?? []).some((page) => referencesValue(page.conditions, kind, id) || referencesValue(page.commands, kind, id));
}

function referencesValue(value: unknown, kind: "switch" | "variable", id: string): boolean {
  if (Array.isArray(value)) return value.some((entry) => referencesValue(entry, kind, id));
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  if (kind === "switch" && record.switchId === id) return true;
  if (kind === "variable" && record.variableId === id) return true;
  if (kind === "variable" && record.kind === "var" && record.id === id) return true;
  return Object.values(record).some((entry) => referencesValue(entry, kind, id));
}

function eventDisplayName(event: GameEvent): string {
  const name = event.pages?.find((page) => page.name.trim())?.name ?? "";
  return displayName(name, event.id);
}

function matches(query: string, ...values: readonly string[]): boolean {
  return values.some((value) => normalize(value).includes(query));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function displayName(name: string, fallback: string): string {
  return name.trim() || fallback;
}
