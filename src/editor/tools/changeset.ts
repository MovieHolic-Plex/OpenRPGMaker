// editor/tools/changeset.ts
// 툴은 Project를 직접 수정하지 않고 draft(구조적 복제)에 적용한다.
// 여기서 draft 생성 / diff 요약 / 커밋 게이트(projectLint)를 순수 함수로 제공한다.

import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { ChangeSummary } from "./types";

// 구조적 복제본(draft) 생성. 브라우저/Node 모두 structuredClone 전역 사용.
export function createDraft(project: Project): Project {
  return structuredClone(project);
}

function emptySummary(): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
  };
}

function countTileChanges(before: GameMap, after: GameMap): number {
  let changed = 0;
  const size = Math.max(before.lowerTiles.length, after.lowerTiles.length);
  for (let i = 0; i < size; i += 1) {
    if (before.lowerTiles[i] !== after.lowerTiles[i]) changed += 1;
    else if (before.upperTiles[i] !== after.upperTiles[i]) changed += 1;
  }
  return changed;
}

function indexEvents(events: readonly GameEvent[]): Map<string, GameEvent> {
  const map = new Map<string, GameEvent>();
  for (const event of events) map.set(event.id, event);
  return map;
}

function diffMapEvents(before: GameMap | undefined, after: GameMap, summary: ChangeSummary): void {
  const beforeEvents = indexEvents(before?.events ?? []);
  const afterEvents = indexEvents(after.events);
  for (const [id, event] of afterEvents) {
    const prev = beforeEvents.get(id);
    if (!prev) summary.eventsAdded += 1;
    else if (JSON.stringify(prev) !== JSON.stringify(event)) summary.eventsModified += 1;
  }
  for (const id of beforeEvents.keys()) {
    if (!afterEvents.has(id)) summary.eventsRemoved += 1;
  }
}

function diffDatabase(before: Project, after: Project, summary: ChangeSummary): void {
  const keys: Array<keyof Project["database"]> = [
    "actors",
    "classes",
    "skills",
    "items",
    "equipment",
    "enemies",
    "troops",
    "states",
    "battleAnimations",
  ];
  for (const key of keys) {
    const beforeList = (before.database[key] ?? []) as Array<{ id: string }>;
    const afterList = (after.database[key] ?? []) as Array<{ id: string }>;
    const beforeById = new Map(beforeList.map((record) => [record.id, JSON.stringify(record)]));
    const afterById = new Map(afterList.map((record) => [record.id, JSON.stringify(record)]));
    for (const [id, json] of afterById) {
      const prev = beforeById.get(id);
      if (prev === undefined || prev !== json) summary.dbRecordsChanged += 1;
    }
    for (const id of beforeById.keys()) {
      if (!afterById.has(id)) summary.dbRecordsChanged += 1;
    }
  }
}

function countNamedDefChanges(
  before: readonly { id: string; name: string }[],
  after: readonly { id: string; name: string }[]
): number {
  const beforeByName = new Map(before.map((entry) => [entry.id, entry.name]));
  let changed = 0;
  for (const entry of after) {
    const prev = beforeByName.get(entry.id);
    // 이름이 비어있다가 채워졌거나(사용 등록) 새 id면 "추가"로 집계.
    if (prev === undefined && entry.name !== "") changed += 1;
    else if (prev !== undefined && prev === "" && entry.name !== "") changed += 1;
  }
  return changed;
}

function diffWorld(before: Project, after: Project, summary: ChangeSummary): void {
  const beforeEntities = before.world?.entities ?? [];
  const afterEntities = after.world?.entities ?? [];
  const beforeById = new Map(beforeEntities.map((entity) => [entity.id, JSON.stringify(entity)]));
  const afterById = new Map(afterEntities.map((entity) => [entity.id, JSON.stringify(entity)]));
  for (const [id, json] of afterById) {
    const prev = beforeById.get(id);
    if (prev === undefined) summary.worldEntitiesAdded += 1;
    else if (prev !== json) summary.worldEntitiesModified += 1;
  }
}

function diffPalettePresets(before: Project, after: Project, summary: ChangeSummary): void {
  for (const [tilesetId, afterTileset] of Object.entries(after.tilesets)) {
    const beforeTileset = before.tilesets[tilesetId];
    const beforePresets = beforeTileset?.palettePresets ?? [];
    const afterPresets = afterTileset.palettePresets ?? [];
    const beforeById = new Map(beforePresets.map((preset) => [preset.id, JSON.stringify(preset)]));
    for (const preset of afterPresets) {
      const prev = beforeById.get(preset.id);
      if (prev === undefined) summary.palettePresetsAdded += 1;
      else if (prev !== JSON.stringify(preset)) summary.palettePresetsModified += 1;
    }
  }
}

// before → after 변경을 구조화 요약으로 계산한다.
export function summarizeChanges(before: Project, after: Project): ChangeSummary {
  const summary = emptySummary();
  const beforeMapIds = new Set(Object.keys(before.maps));
  const afterMapIds = new Set(Object.keys(after.maps));
  for (const id of afterMapIds) {
    if (!beforeMapIds.has(id)) summary.mapsAdded += 1;
  }
  for (const id of beforeMapIds) {
    if (!afterMapIds.has(id)) summary.mapsRemoved += 1;
  }
  for (const [id, afterMap] of Object.entries(after.maps)) {
    const beforeMap = before.maps[id];
    if (beforeMap) summary.tilesChanged += countTileChanges(beforeMap, afterMap);
    diffMapEvents(beforeMap, afterMap, summary);
  }
  diffDatabase(before, after, summary);
  for (const [id, afterTileset] of Object.entries(after.tilesets)) {
    if (JSON.stringify(before.tilesets[id]) !== JSON.stringify(afterTileset)) summary.tilesetsChanged += 1;
  }
  summary.switchesAdded = countNamedDefChanges(before.switches, after.switches);
  summary.variablesAdded = countNamedDefChanges(before.variables, after.variables);
  diffWorld(before, after, summary);
  diffPalettePresets(before, after, summary);
  summary.sessionChanged = JSON.stringify(before.session) !== JSON.stringify(after.session);
  summary.systemChanged = JSON.stringify(before.system) !== JSON.stringify(after.system);
  return summary;
}

export interface CommitResult {
  ok: boolean;
  issues: LintIssue[];
}

// 커밋 게이트: draft에 projectLint를 돌려 차단 error가 있으면 반영 거부.
// cluster-rule hard 위반은 배치 시점 강제 + lint 보고 대상이므로 커밋 차단에서는 제외한다.
// warning/info와 비차단 error는 통과시키되 issues로 함께 반환한다(모델/사람이 참고).
export function commitChangeset(draft: Project): CommitResult {
  const issues = projectLint(draft);
  const hasError = issues.some((issue) => issue.severity === "error" && !issue.code.startsWith("cluster-rule:"));
  return { ok: !hasError, issues };
}
