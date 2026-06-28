import type { CommonEvent, GameMap, Project, SwitchDef, VariableDef } from "@/project/types";

export type SearchKind = "variable" | "switch" | "eventName";
export type SearchRange = "selectedMap" | "commonEvents" | "all";

export type SearchState = {
  activeKind: SearchKind;
  activeRange: SearchRange;
};

export type ResultEntry = {
  readonly kind: SearchKind;
  readonly place: string;
  readonly name: string;
  readonly detail: string;
};

export type SearchRequest = {
  readonly project: Project;
  readonly selectedMapId: string;
  readonly query: string;
  readonly kind: SearchKind;
  readonly range: SearchRange;
};

export const KIND_LABELS: Record<SearchKind, string> = {
  variable: "변수",
  switch: "스위치",
  eventName: "이벤트 이름",
};

export function createInitialSearchState(): SearchState {
  return {
    activeKind: "variable",
    activeRange: "selectedMap",
  };
}

export function searchProject(request: SearchRequest): ResultEntry[] {
  switch (request.kind) {
    case "variable":
      return request.project.variables.filter((record) => matchesRecord(record, request.query)).map((record) => recordResult("variable", "변수", record));
    case "switch":
      return request.project.switches.filter((record) => matchesRecord(record, request.query)).map((record) => recordResult("switch", "스위치", record));
    case "eventName":
      return eventNameResults(request);
  }
}

function eventNameResults(request: SearchRequest): ResultEntry[] {
  const selectedMap = request.project.maps[request.selectedMapId];
  const maps = request.range === "selectedMap" ? (selectedMap ? [selectedMap] : []) : Object.values(request.project.maps);
  const mapResults = request.range === "commonEvents" ? [] : maps.flatMap((map) => mapEventResults(map, request.query));
  const commonResults =
    request.range === "selectedMap"
      ? []
      : request.project.commonEvents.filter((event) => matchesRecord(event, request.query)).map(commonEventResult);
  return [...mapResults, ...commonResults];
}

function mapEventResults(map: GameMap, query: string): ResultEntry[] {
  return map.events
    .filter((event) => event.id.includes(query) || event.pages?.some((page) => page.name.includes(query)) === true)
    .map((event) => ({
      kind: "eventName",
      place: map.name,
      name: event.pages?.[0]?.name ?? event.id,
      detail: `${event.id} (${event.x}, ${event.y})`,
    }));
}

function commonEventResult(event: CommonEvent): ResultEntry {
  return { kind: "eventName", place: "공통 이벤트", name: event.name, detail: event.id };
}

function matchesRecord(record: SwitchDef | VariableDef | CommonEvent, query: string): boolean {
  return record.id.includes(query) || record.name.includes(query);
}

function recordResult(kind: SearchKind, place: string, record: SwitchDef | VariableDef): ResultEntry {
  return { kind, place, name: record.name, detail: record.id };
}
