// editor/tools/changeset.ts
// 툴은 Project를 직접 수정하지 않고 draft(구조적 복제)에 적용한다.
// 여기서 draft 생성 / diff 요약 / 커밋 게이트(projectLint)를 순수 함수로 제공한다.

import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { assertSpatialToolChange } from "./spatialToolState";
import { ToolError } from "./types";
import { ProjectFormatError } from "@/project/io/errors";
import { SpatialOperationError } from "@/project/spatial/domain";
import { countAudioDescriptionChanges } from "@/project/audioDescriptionChanges";
import { countMonsterMetadataChanges } from "@/project/monsterMetadata";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { ChangeSummary } from "./types";

// 구조적 복제본(draft) 생성. Project JSON과 editor-only detached session memory를 함께 복제한다.
export function createDraft(project: Project): Project {
  return cloneDetachedDraft(project);
}

function emptySummary(): ChangeSummary {
  return {
    tilesChanged: 0,
    mapPropertiesChanged: 0,
    audioDescriptionsChanged: 0,
    monsterMetadataChanged: 0,
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
    endingsChanged: 0,
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

function comparableMapProperties(map: GameMap): string {
  const {
    lowerTiles: _lowerTiles,
    upperTiles: _upperTiles,
    lowerTileStacks: _lowerTileStacks,
    upperTileStacks: _upperTileStacks,
    events: _events,
    ...properties
  } = map;
  return JSON.stringify(properties);
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
    "elements",
    "terrains",
    "battleCommands",
    "monsterSpecies",
    "crops",
    "lifeSkills",
    "farmAnimalSpecies",
    "fishSpecies",
    "farmBuildingTypes",
    "homeDecorationTypes",
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
    if (beforeMap) {
      summary.tilesChanged += countTileChanges(beforeMap, afterMap);
      if (comparableMapProperties(beforeMap) !== comparableMapProperties(afterMap)) {
        summary.mapPropertiesChanged = (summary.mapPropertiesChanged ?? 0) + 1;
      }
    }
    diffMapEvents(beforeMap, afterMap, summary);
  }
  if (JSON.stringify(before.mapTree) !== JSON.stringify(after.mapTree)) {
    summary.mapPropertiesChanged = (summary.mapPropertiesChanged ?? 0) + 1;
  }
  diffDatabase(before, after, summary);
  if (JSON.stringify(before.spatialAuthoring) !== JSON.stringify(after.spatialAuthoring)) summary.dbRecordsChanged += 1;
  for (const [id, afterTileset] of Object.entries(after.tilesets)) {
    if (JSON.stringify(before.tilesets[id]) !== JSON.stringify(afterTileset)) summary.tilesetsChanged += 1;
  }
  summary.switchesAdded = countNamedDefChanges(before.switches, after.switches);
  summary.variablesAdded = countNamedDefChanges(before.variables, after.variables);
  diffWorld(before, after, summary);
  diffPalettePresets(before, after, summary);
  summary.endingsChanged = countRecordChanges(before.endings ?? [], after.endings ?? []);
  summary.sessionChanged = JSON.stringify(before.session) !== JSON.stringify(after.session);
  summary.systemChanged = JSON.stringify(before.system) !== JSON.stringify(after.system);
  summary.audioDescriptionsChanged = countAudioDescriptionChanges(before.audioDescriptions, after.audioDescriptions);
  summary.monsterMetadataChanged = countMonsterMetadataChanges(before.monsterMetadata, after.monsterMetadata);
  return summary;
}

function countRecordChanges(before: readonly { id: string }[], after: readonly { id: string }[]): number {
  const beforeById = new Map(before.map((record) => [record.id, JSON.stringify(record)]));
  const afterById = new Map(after.map((record) => [record.id, JSON.stringify(record)]));
  let changed = 0;
  for (const [id, json] of afterById) {
    const prev = beforeById.get(id);
    if (prev === undefined || prev !== json) changed += 1;
  }
  for (const id of beforeById.keys()) {
    if (!afterById.has(id)) changed += 1;
  }
  return changed;
}

export interface CommitResult {
  ok: boolean;
  issues: LintIssue[];
  blocking: LintIssue[];
}

// 커밋 게이트: draft에 projectLint를 돌려 차단 error가 있으면 반영 거부.
// cluster-rule hard 위반은 배치 시점 강제 + lint 보고 대상이므로 커밋 차단에서는 제외한다.
// warning/info와 비차단 error는 통과시키되 issues로 함께 반환한다(모델/사람이 참고).
export function commitChangeset(draft: Project, baseline?: Project): CommitResult {
  try { assertSpatialToolChange(draft, baseline); }
  catch (error) {
    if (!(error instanceof ToolError || error instanceof ProjectFormatError || error instanceof SpatialOperationError)) throw error;
    const issue: LintIssue = { severity: "error", code: error instanceof ToolError ? error.code : "spatial-invalid", message: error.message };
    return { ok: false, issues: [issue], blocking: [issue] };
  }
  const issues = projectLint(draft);
  const isBlocking = (issue: LintIssue): boolean => issue.severity === "error" && !issue.code.startsWith("cluster-rule:");
  let blocking = issues.filter(isBlocking);
  if (baseline && blocking.length > 0) {
    // 이 변경이 만들지 않은 "기존" 오류는 커밋을 막지 않는다 — 시작 위치 통행 불가 같은
    // 선재 오류가 있는 프로젝트에서 무관한 편집(건축 팔레트/AI 툴)까지 전부 거부되던 버그의 수정.
    // 새로 생긴 오류만 차단해 추가 손상은 여전히 막는다.
    const baselineAtoms = new Set(projectLint(baseline).filter(isBlocking).flatMap(issueAtoms));
    blocking = blocking.filter((issue) => issueAtoms(issue).some((atom) => !baselineAtoms.has(atom)));
  }
  return { ok: blocking.length === 0, issues, blocking };
}

function issueKey(issue: LintIssue): string {
  return `${issue.code}|${issue.mapId ?? ""}|${issue.x ?? ""}|${issue.y ?? ""}|${issue.message}`;
}

/**
 * 기준선 대조 단위. 대부분의 lint 이슈는 메시지 1개 = 위반 1개라 키가 곧 원자다.
 *
 * serialize-roundtrip 은 예외다 — **여러 위반을 개행으로 이어 붙인 한 메시지**를 낸다.
 * 메시지 전체를 키로 쓰면 위반 하나를 지우는 편집조차 메시지가 달라져 "새 오류"로 분류되고,
 * 그 결과 **청소가 영구 차단된다**(2026-08-30 실측: 고아 아이템을 지우는
 * delete_database_record 10건이 연속으로 커밋 거부됨 — 고치려는 조건이 고치는 경로를 막는 교착).
 * 그래서 이 코드만 줄 단위로 쪼개 원자를 비교한다: 새 줄이 없으면 차단하지 않는다.
 */
function issueAtoms(issue: LintIssue): string[] {
  if (issue.code !== "serialize-roundtrip") return [issueKey(issue)];
  const lines = issue.message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length === 0) return [issueKey(issue)];
  return lines.map((line) => `${issue.code}|${line}`);
}
