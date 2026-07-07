import type { Project, ProjectV1, ProjectV2 } from "../types";
import { normalizeDatabaseRecords, normalizeSystemRecords } from "../databaseRecordModel";
import { normalizeWorld } from "../world/guards";
import { assert, cloneJson, type JsonRecord, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { validateProjectReferences } from "./references";
import {
  requirePosition,
  validateAssets,
  validateCommonEvents,
  validateDatabase,
  validateMapTree,
  validateMaps,
  validateMeta,
  validateResourceProfiles,
  validateSession,
  validateSwitches,
  validateSystem,
  validateTileset,
  validateVariables,
} from "./shapeFields";

export function validateProjectV1(data: JsonRecord): ProjectV1 {
  requireNumber("version", data.version);
  requireRecord("meta", data.meta);
  requireRecord("assets", data.assets);
  requireRecord("maps", data.maps);
  requireString("startMapId", data.startMapId);
  requireRecord("startPos", data.startPos);
  requireRecord("flags", data.flags);
  return cloneJson<ProjectV1>(data);
}

export function validateProjectV2(data: JsonRecord): ProjectV2 {
  validateMeta(data.meta);
  validateAssets(data.assets);
  const tilesets = requireRecord("tilesets", data.tilesets);
  for (const [id, tileset] of Object.entries(tilesets)) validateTileset(id, tileset);
  validateSwitches(data.switches);
  validateVariables(data.variables);
  validateCommonEvents(data.commonEvents);
  const maps = validateMaps(data.maps);
  validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);
  return cloneJson<ProjectV2>(data);
}

export function validateProjectV3(data: JsonRecord): Project {
  validateMeta(data.meta);
  validateAssets(data.assets);
  validateResourceProfiles(data.resourceProfiles);
  const tilesets = requireRecord("tilesets", data.tilesets);
  for (const [id, tileset] of Object.entries(tilesets)) validateTileset(id, tileset);
  validateSwitches(data.switches);
  validateVariables(data.variables);
  validateCommonEvents(data.commonEvents);
  validateDatabase(data.database);
  validateSystem(data.system);
  validateSession(data.session);
  const maps = validateMaps(data.maps);
  validateMapConnections(data.mapConnections, new Set(Object.keys(maps)));
  validateVillageInfoDocuments(data.villageInfoDocuments, new Set(Object.keys(maps)));
  validateQuests(data.quests, new Set(Object.keys(maps)));
  validateTestPresets(data.testPresets, new Set(Object.keys(maps)));
  validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);

  const project = cloneJson<Project>(data);
  project.mapConnections ??= [];
  project.villageInfoDocuments ??= [];
  if (data.world !== undefined) project.world = normalizeWorld(data.world);
  project.database = normalizeDatabaseRecords(project.database);
  project.system = normalizeSystemRecords(project.system);
  validateProjectReferences(project);
  return project;
}

function validateVillageInfoDocuments(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "villageInfoDocuments는 배열이어야 합니다.");
  for (const [index, entry] of value.entries()) {
    const document = requireRecord(`villageInfoDocuments[${index}]`, entry);
    requireString(`villageInfoDocuments[${index}].id`, document.id);
    const mapId = requireString(`villageInfoDocuments[${index}].mapId`, document.mapId);
    assert(mapIds.has(mapId), `villageInfoDocuments[${index}].mapId가 존재하지 않는 맵입니다: ${mapId}`);
    requireString(`villageInfoDocuments[${index}].title`, document.title);
    requireString(`villageInfoDocuments[${index}].markdown`, document.markdown);
  }
}

// 퀘스트 정의(선언적 메타). 상세 step 구조는 questCompiler가 소비하므로 여기선 최상위 형태만 검증한다.
function validateQuests(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "quests는 배열이어야 합니다.");
  for (const [index, entry] of value.entries()) {
    const quest = requireRecord(`quests[${index}]`, entry);
    requireString(`quests[${index}].key`, quest.key);
    requireString(`quests[${index}].title`, quest.title);
    requireString(`quests[${index}].summary`, quest.summary);
    assert(Array.isArray(quest.steps), `quests[${index}].steps는 배열이어야 합니다.`);
    // giver가 기존 이벤트 참조면 맵 존재를 확인(생성형이면 컴파일 시 생성되므로 생략).
    const giver = quest.giver as { mapId?: unknown } | undefined;
    if (giver && typeof giver.mapId === "string") {
      assert(mapIds.has(giver.mapId), `quests[${index}].giver.mapId가 존재하지 않는 맵입니다: ${giver.mapId}`);
    }
  }
}

// 테스트 상태 프리셋(Phase 4-1). optional. 최상위 형태와 참조 맵 존재만 검증한다.
function validateTestPresets(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "testPresets는 배열이어야 합니다.");
  for (const [index, entry] of value.entries()) {
    const preset = requireRecord(`testPresets[${index}]`, entry);
    requireString(`testPresets[${index}].id`, preset.id);
    requireString(`testPresets[${index}].name`, preset.name);
    if (preset.switches !== undefined) requireRecord(`testPresets[${index}].switches`, preset.switches);
    if (preset.variables !== undefined) requireRecord(`testPresets[${index}].variables`, preset.variables);
    if (preset.inventory !== undefined) requireRecord(`testPresets[${index}].inventory`, preset.inventory);
    if (preset.gold !== undefined) requireNumber(`testPresets[${index}].gold`, preset.gold);
    if (preset.startMapId !== undefined) {
      const mapId = requireString(`testPresets[${index}].startMapId`, preset.startMapId);
      assert(mapIds.has(mapId), `testPresets[${index}].startMapId가 존재하지 않는 맵입니다: ${mapId}`);
    }
    if (preset.startPos !== undefined) requirePosition(`testPresets[${index}].startPos`, preset.startPos);
  }
}

function validateMapConnections(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "mapConnections는 배열이어야 합니다.");
  const connections = value;
  for (const [index, entry] of connections.entries()) {
    const connection = requireRecord(`mapConnections[${index}]`, entry);
    requireString(`mapConnections[${index}].id`, connection.id);
    if (connection.name !== undefined) requireString(`mapConnections[${index}].name`, connection.name);
    validateEndpoint(`mapConnections[${index}].from`, connection.from, mapIds);
    validateEndpoint(`mapConnections[${index}].to`, connection.to, mapIds);
    requireBoolean(`mapConnections[${index}].playerEnabled`, connection.playerEnabled);
    requireBoolean(`mapConnections[${index}].npcEnabled`, connection.npcEnabled);
  }
}

function validateEndpoint(label: string, value: unknown, mapIds: ReadonlySet<string>): void {
  const endpoint = requireRecord(label, value);
  const mapId = requireString(`${label}.mapId`, endpoint.mapId);
  assert(mapIds.has(mapId), `${label}.mapId가 존재하지 않는 맵입니다: ${mapId}`);
  requireNumber(`${label}.x`, endpoint.x);
  requireNumber(`${label}.y`, endpoint.y);
  if (endpoint.direction !== undefined) {
    const direction = requireString(`${label}.direction`, endpoint.direction);
    assert(direction === "left" || direction === "right" || direction === "up" || direction === "down", `${label}.direction이 잘못되었습니다.`);
  }
}
