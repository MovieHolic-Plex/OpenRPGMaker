import type { Project, ProjectV1, ProjectV2 } from "../types";
import { normalizeDatabaseRecords } from "../databaseRecordModel";
import { assert, cloneJson, type JsonRecord, requireNumber, requireRecord, requireString } from "./guards";
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
  validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);

  const project = cloneJson<Project>(data);
  project.database = normalizeDatabaseRecords(project.database);
  validateProjectReferences(project);
  return project;
}
