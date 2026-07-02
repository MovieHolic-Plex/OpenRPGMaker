import type { Project, ProjectV1, ProjectV2 } from "../types";
import { normalizeDatabaseRecords, normalizeSystemRecords } from "../databaseRecordModel";
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
  validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);

  const project = cloneJson<Project>(data);
  project.mapConnections ??= [];
  project.villageInfoDocuments ??= [];
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
