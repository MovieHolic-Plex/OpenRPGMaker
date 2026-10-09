// editor/tools/farmSpatialTools.ts
// 농장 공간 저작(건물·장식 타입, 가축 건물, 시작 배치·가축).
// 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)에서
// 에디터 UI 는 쓰는데 어떤 툴도 쓰지 못하던 저작 필드를 담당한다.
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { normalizeFarmAnimalBuildingDefinitions, normalizeFarmAnimalStartInstances } from "@/project/p1FoundationRecords";
import {
  isSpatialFootprint,
  isSpatialOrientation,
  normalizeFarmBuildingPlacements,
  normalizeFarmBuildingTypes,
  normalizeHomeDecorationPlacements,
  normalizeHomeDecorationTypes,
} from "@/project/spatialPlacements";
import type {
  FarmAnimalBuildingDefinition,
  FarmAnimalStartInstance,
  FarmBuildingPlacement,
  FarmBuildingTypeRecord,
  GameMap,
  HomeDecorationPlacement,
  HomeDecorationTypeRecord,
  Project,
} from "@/project/types";
import {
  FARM_ANIMAL_BUILDING_PARAMETERS,
  FARM_BUILDING_TYPE_PARAMETERS,
  HOME_DECORATION_TYPE_PARAMETERS,
  SESSION_FARM_STATE_PARAMETERS,
} from "./farmSpatialToolSchemas";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function requiredId(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ToolError(`${label}.${key}에 비어 있지 않은 문자열이 필요합니다.`, { code: "invalid-args" });
  }
  return value.trim();
}

function requiredInteger(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new ToolError(`${label}.${key}에 정수가 필요합니다.`, { code: "invalid-args" });
  }
  return value;
}

function optionalId(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function idsFrom(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError(`${label}는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
  return value.map((entry, index) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new ToolError(`${label}[${index}]에 비어 있지 않은 문자열 id가 필요합니다.`, { code: "invalid-args" });
    }
    return entry.trim();
  });
}

function sample(ids: readonly string[]): string {
  return `${ids.slice(0, 12).join(", ") || "없음"}${ids.length > 12 ? " …" : ""}`;
}

function requireKnownId(value: string, validIds: readonly string[], label: string): void {
  if (validIds.includes(value)) return;
  throw new ToolError(`${label} '${value}'을(를) 찾을 수 없습니다. 사용 가능한 id(${validIds.length}개): ${sample(validIds)}`, {
    code: "invalid-reference",
  });
}

function requireKnownIds(values: readonly string[], validIds: readonly string[], label: string): void {
  const unknown = [...new Set(values.filter((value) => !validIds.includes(value)))];
  if (unknown.length === 0) return;
  throw new ToolError(`${label}에 없는 id가 있습니다: ${unknown.join(", ")}. 사용 가능한 id(${validIds.length}개): ${sample(validIds)}`, {
    code: "invalid-reference",
  });
}

/**
 * 그래픽 리소스 id 는 참조다. 여기서 막지 않으면 프로젝트 전역 무결성 검사가 나중에
 * "...graphicResourceId does not exist" 로 커밋을 거부해 모델이 어느 인자를 고쳐야 할지 모른다.
 * 검사 집합은 무결성 검사와 같은 collectResourceIds — 업로드 소재뿐 아니라 내장 카탈로그
 * (에디터 UI 기본값 easyrpg-picture-cloud 등)도 유효한 참조다.
 */
function requireKnownResourceId(project: Project, value: string, label: string): void {
  const resourceIds = collectResourceIds(project);
  if (resourceIds.has(value)) return;
  const uploaded = Object.keys(project.assets.uploaded);
  const suggestions = uploaded.length > 0 ? uploaded : [...resourceIds];
  throw new ToolError(
    `${label} '${value}'은(는) 등록된 리소스가 아닙니다. 사용 가능한 리소스 id(${resourceIds.size}개) 예: ${sample(suggestions)}`
      + " — 새 소재는 upsert_resource로 먼저 등록하세요.",
    { code: "invalid-reference" },
  );
}

function requireKnownOrientationGraphics(project: Project, value: unknown, label: string): void {
  if (value === undefined) return;
  const graphics = recordOf(value, label);
  for (const [orientation, resourceId] of Object.entries(graphics)) {
    if (resourceId === undefined) continue;
    if (typeof resourceId !== "string" || !resourceId.trim()) {
      throw new ToolError(`${label}.${orientation}에 비어 있지 않은 리소스 id가 필요합니다.`, { code: "invalid-args" });
    }
    requireKnownResourceId(project, resourceId.trim(), `${label}.${orientation}`);
  }
}

function requireMapAndBounds(project: Project, mapId: string, x: number, y: number, label: string): GameMap {
  const mapIds = Object.keys(project.maps);
  const map = project.maps[mapId];
  if (!map) {
    throw new ToolError(`${label}.mapId '${mapId}'을(를) 찾을 수 없습니다. 사용 가능한 맵 id(${mapIds.length}개): ${sample(mapIds)}`, {
      code: "map-not-found",
      mapId,
      x,
      y,
    });
  }
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    throw new ToolError(
      `${label} 좌표 (${x}, ${y})가 맵 '${mapId}' 범위를 벗어났습니다. x=0..${map.width - 1} (너비 ${map.width}), y=0..${map.height - 1} (높이 ${map.height})`,
      { code: "out-of-bounds", mapId, x, y },
    );
  }
  return map;
}

function upsertById<T extends { readonly id: string }>(list: readonly T[] | undefined, record: T): T[] {
  const values = list ?? [];
  const index = values.findIndex((entry) => entry.id === record.id);
  if (index < 0) return [...values, record];
  return values.map((entry, entryIndex) => (entryIndex === index ? record : entry));
}

function upsertByInstanceId<T extends { readonly instanceId: string }>(list: readonly T[], records: readonly T[]): T[] {
  const result = [...list];
  for (const record of records) {
    const index = result.findIndex((entry) => entry.instanceId === record.instanceId);
    if (index < 0) result.push(record);
    else result[index] = record;
  }
  return result;
}

function parseFarmBuildingType(project: Project, value: unknown): FarmBuildingTypeRecord {
  const raw = recordOf(value, "buildingType");
  const id = requiredId(raw, "id", "buildingType");
  requiredId(raw, "name", "buildingType");
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    throw new ToolError("buildingType.levels에 level 1부터 시작하는 레벨을 하나 이상 넣어야 합니다.", { code: "invalid-args" });
  }
  raw.levels.forEach((valueAtLevel, index) => {
    const level = recordOf(valueAtLevel, `buildingType.levels[${index}]`);
    if (requiredInteger(level, "level", `buildingType.levels[${index}]`) !== index + 1) {
      throw new ToolError(`buildingType.levels는 level 1부터 빈틈 없이 오름차순이어야 합니다. index ${index}의 올바른 level은 ${index + 1}입니다.`, {
        code: "invalid-args",
      });
    }
    if (!isSpatialFootprint(level.footprint)) {
      throw new ToolError(`buildingType.levels[${index}].footprint는 width/height 1..16, 넓이 합 128 이하여야 합니다.`, { code: "invalid-args" });
    }
    requireKnownResourceId(project, requiredId(level, "graphicResourceId", `buildingType.levels[${index}]`), `buildingType.levels[${index}].graphicResourceId`);
    requireKnownOrientationGraphics(project, level.orientationGraphicResourceIds, `buildingType.levels[${index}].orientationGraphicResourceIds`);
    if (level.cost !== undefined) {
      const cost = recordOf(level.cost, `buildingType.levels[${index}].cost`);
      if (cost.items !== undefined) {
        if (!Array.isArray(cost.items)) throw new ToolError(`buildingType.levels[${index}].cost.items는 배열이어야 합니다.`, { code: "invalid-args" });
        const costItemIds = cost.items.map((item, itemIndex) => requiredId(recordOf(item, `cost.items[${itemIndex}]`), "itemId", `cost.items[${itemIndex}]`));
        requireKnownIds(costItemIds, project.database.items.map((item) => item.id), `buildingType.levels[${index}].cost.items.itemId`);
      }
    }
  });
  requireKnownIds(idsFrom(raw.allowedMapIds, "buildingType.allowedMapIds"), Object.keys(project.maps), "buildingType.allowedMapIds");
  const normalized = normalizeFarmBuildingTypes([raw])?.[0];
  if (!normalized || normalized.id !== id) {
    throw new ToolError("buildingType 정규화에 실패했습니다. id/name/levels/graphicResourceId를 확인하세요.", { code: "invalid-args" });
  }
  return normalized;
}

function parseHomeDecorationType(project: Project, value: unknown): HomeDecorationTypeRecord {
  const raw = recordOf(value, "decorationType");
  const id = requiredId(raw, "id", "decorationType");
  requiredId(raw, "name", "decorationType");
  const placementItemId = requiredId(raw, "placementItemId", "decorationType");
  requireKnownId(placementItemId, project.database.items.map((item) => item.id), "decorationType.placementItemId");
  requireKnownResourceId(project, requiredId(raw, "graphicResourceId", "decorationType"), "decorationType.graphicResourceId");
  requireKnownOrientationGraphics(project, raw.orientationGraphicResourceIds, "decorationType.orientationGraphicResourceIds");
  if (raw.footprint !== undefined && !isSpatialFootprint(raw.footprint)) {
    throw new ToolError("decorationType.footprint는 width/height 1..16, 넓이 합 128 이하여야 합니다.", { code: "invalid-args" });
  }
  if (raw.allowedOrientations !== undefined) {
    if (!Array.isArray(raw.allowedOrientations) || raw.allowedOrientations.some((orientation) => !isSpatialOrientation(orientation))) {
      throw new ToolError("decorationType.allowedOrientations는 down/left/right/up 배열이어야 합니다.", { code: "invalid-args" });
    }
  }
  requireKnownIds(idsFrom(raw.allowedMapIds, "decorationType.allowedMapIds"), Object.keys(project.maps), "decorationType.allowedMapIds");
  const normalized = normalizeHomeDecorationTypes([raw])?.[0];
  if (!normalized || normalized.id !== id) {
    throw new ToolError("decorationType 정규화에 실패했습니다. id/placementItemId/graphicResourceId를 확인하세요.", { code: "invalid-args" });
  }
  return normalized;
}

function parseFarmAnimalBuilding(project: Project, value: unknown): FarmAnimalBuildingDefinition {
  const raw = recordOf(value, "building");
  const id = requiredId(raw, "id", "building");
  requiredId(raw, "name", "building");
  const mapId = requiredId(raw, "mapId", "building");
  const x = requiredInteger(raw, "x", "building");
  const y = requiredInteger(raw, "y", "building");
  requireMapAndBounds(project, mapId, x, y, "building");
  const allowedSpeciesIds = idsFrom(raw.allowedSpeciesIds, "building.allowedSpeciesIds");
  requireKnownIds(allowedSpeciesIds, (project.database.farmAnimalSpecies ?? []).map((species) => species.id), "building.allowedSpeciesIds");
  const normalized = normalizeFarmAnimalBuildingDefinitions([{
    id,
    name: requiredId(raw, "name", "building"),
    mapId,
    x,
    y,
    capacity: raw.capacity === undefined ? 4 : requiredInteger(raw, "capacity", "building"),
    allowedSpeciesIds,
  }])?.[0];
  if (!normalized) throw new ToolError("building 정규화에 실패했습니다.", { code: "invalid-args" });
  return normalized;
}

interface SectionArgs {
  readonly upsert: readonly unknown[];
  readonly remove: readonly string[];
}

function parseSection(value: unknown, label: string): SectionArgs {
  const raw = recordOf(value, label);
  const upsert = raw.upsert === undefined ? [] : raw.upsert;
  if (!Array.isArray(upsert)) throw new ToolError(`${label}.upsert는 배열이어야 합니다.`, { code: "invalid-args" });
  return { upsert, remove: idsFrom(raw.remove, `${label}.remove`) };
}

function parseFarmAnimal(project: Project, value: unknown, index: number): FarmAnimalStartInstance {
  const label = `farmAnimals.upsert[${index}]`;
  const raw = recordOf(value, label);
  const speciesId = requiredId(raw, "speciesId", label);
  requireKnownId(speciesId, (project.database.farmAnimalSpecies ?? []).map((species) => species.id), `${label}.speciesId`);
  const buildingId = optionalId(raw, "buildingId");
  if (buildingId) requireKnownId(buildingId, (project.system.farmAnimalBuildings ?? []).map((building) => building.id), `${label}.buildingId`);
  const normalized = normalizeFarmAnimalStartInstances([{
    instanceId: requiredId(raw, "instanceId", label),
    speciesId,
    name: requiredId(raw, "name", label),
    ...(buildingId ? { buildingId } : {}),
    ...(optionalId(raw, "eventId") ? { eventId: optionalId(raw, "eventId") } : {}),
  }])?.[0];
  if (!normalized) throw new ToolError(`${label} 정규화에 실패했습니다.`, { code: "invalid-args" });
  return normalized;
}

function parseBuildingPlacement(project: Project, value: unknown, index: number): FarmBuildingPlacement {
  const label = `farmBuildingPlacements.upsert[${index}]`;
  const raw = recordOf(value, label);
  const typeId = requiredId(raw, "typeId", label);
  const types = project.database.farmBuildingTypes ?? [];
  requireKnownId(typeId, types.map((type) => type.id), `${label}.typeId`);
  const level = raw.level === undefined ? 1 : requiredInteger(raw, "level", label);
  const type = types.find((candidate) => candidate.id === typeId);
  const validLevels = type?.levels.map((definition) => String(definition.level)) ?? [];
  requireKnownId(String(level), validLevels, `${label}.level`);
  const mapId = requiredId(raw, "mapId", label);
  const x = requiredInteger(raw, "x", label);
  const y = requiredInteger(raw, "y", label);
  requireMapAndBounds(project, mapId, x, y, label);
  const orientation = raw.orientation ?? "down";
  if (!isSpatialOrientation(orientation)) throw new ToolError(`${label}.orientation은 down/left/right/up 중 하나여야 합니다.`, { code: "invalid-args" });
  const normalized = normalizeFarmBuildingPlacements([{
    instanceId: requiredId(raw, "instanceId", label), typeId, level, mapId, x, y, orientation,
  }])?.[0];
  if (!normalized) throw new ToolError(`${label} 정규화에 실패했습니다.`, { code: "invalid-args" });
  return normalized;
}

function parseDecorationPlacement(project: Project, value: unknown, index: number): HomeDecorationPlacement {
  const label = `homeDecorationPlacements.upsert[${index}]`;
  const raw = recordOf(value, label);
  const typeId = requiredId(raw, "typeId", label);
  const types = project.database.homeDecorationTypes ?? [];
  requireKnownId(typeId, types.map((type) => type.id), `${label}.typeId`);
  const mapId = requiredId(raw, "mapId", label);
  const x = requiredInteger(raw, "x", label);
  const y = requiredInteger(raw, "y", label);
  requireMapAndBounds(project, mapId, x, y, label);
  const orientation = raw.orientation ?? "down";
  if (!isSpatialOrientation(orientation)) throw new ToolError(`${label}.orientation은 down/left/right/up 중 하나여야 합니다.`, { code: "invalid-args" });
  const type = types.find((candidate) => candidate.id === typeId);
  requireKnownId(orientation, type?.allowedOrientations ?? [], `${label}.orientation`);
  const normalized = normalizeHomeDecorationPlacements([{
    instanceId: requiredId(raw, "instanceId", label), typeId, mapId, x, y, orientation,
  }])?.[0];
  if (!normalized) throw new ToolError(`${label} 정규화에 실패했습니다.`, { code: "invalid-args" });
  return normalized;
}

const upsertFarmBuildingType: ToolDefinition = {
  name: "upsert_farm_building_type",
  description: "범용 농장 건물 유형(레벨·발자국·비용·그래픽·허용 맵)을 database.farmBuildingTypes에 등록/수정한다.",
  mode: "write",
  parameters: FARM_BUILDING_TYPE_PARAMETERS,
  run(draft, args): ToolExecResult {
    const record = parseFarmBuildingType(draft, args.buildingType);
    draft.database.farmBuildingTypes = upsertById(draft.database.farmBuildingTypes, record);
    return { summary: `농장 건물 유형 '${record.name}' 등록/수정`, data: { buildingType: record } };
  },
};

const upsertHomeDecorationType: ToolDefinition = {
  name: "upsert_home_decoration_type",
  description: "집 장식 유형(배치 아이템·발자국·통행·방향·그래픽·허용 맵)을 database.homeDecorationTypes에 등록/수정한다.",
  mode: "write",
  parameters: HOME_DECORATION_TYPE_PARAMETERS,
  run(draft, args): ToolExecResult {
    const record = parseHomeDecorationType(draft, args.decorationType);
    draft.database.homeDecorationTypes = upsertById(draft.database.homeDecorationTypes, record);
    return { summary: `집 장식 유형 '${record.name}' 등록/수정`, data: { decorationType: record } };
  },
};

const upsertFarmAnimalBuilding: ToolDefinition = {
  name: "upsert_farm_animal_building",
  description: "가축 축사(맵·좌표·수용량·허용 종)를 system.farmAnimalBuildings에 등록/수정한다.",
  mode: "write",
  parameters: FARM_ANIMAL_BUILDING_PARAMETERS,
  run(draft, args): ToolExecResult {
    const record = parseFarmAnimalBuilding(draft, args.building);
    draft.system.farmAnimalBuildings = upsertById(draft.system.farmAnimalBuildings, record);
    return { summary: `가축 축사 '${record.name}' 등록/수정`, data: { building: record } };
  },
};

const setSessionFarmState: ToolDefinition = {
  name: "set_session_farm_state",
  description: "시작 가축·범용 농장 건물 배치·집 장식 배치를 session 배열별로 독립 upsert/remove한다. 보내지 않은 배열은 보존한다.",
  mode: "write",
  parameters: SESSION_FARM_STATE_PARAMETERS,
  run(draft, args): ToolExecResult {
    const changed: string[] = [];
    if (args.farmAnimals !== undefined) {
      const section = parseSection(args.farmAnimals, "farmAnimals");
      const upserted = section.upsert.map((value, index) => parseFarmAnimal(draft, value, index));
      const retained = (draft.session.farmAnimals ?? []).filter((entry) => !section.remove.includes(entry.instanceId));
      draft.session.farmAnimals = upsertByInstanceId(retained, upserted);
      changed.push(`가축 ${upserted.length}건 upsert/${section.remove.length}건 remove`);
    }
    if (args.farmBuildingPlacements !== undefined) {
      const section = parseSection(args.farmBuildingPlacements, "farmBuildingPlacements");
      const upserted = section.upsert.map((value, index) => parseBuildingPlacement(draft, value, index));
      const retained = (draft.session.farmBuildingPlacements ?? []).filter((entry) => !section.remove.includes(entry.instanceId));
      draft.session.farmBuildingPlacements = upsertByInstanceId(retained, upserted);
      changed.push(`농장 건물 배치 ${upserted.length}건 upsert/${section.remove.length}건 remove`);
    }
    if (args.homeDecorationPlacements !== undefined) {
      const section = parseSection(args.homeDecorationPlacements, "homeDecorationPlacements");
      const upserted = section.upsert.map((value, index) => parseDecorationPlacement(draft, value, index));
      const retained = (draft.session.homeDecorationPlacements ?? []).filter((entry) => !section.remove.includes(entry.instanceId));
      draft.session.homeDecorationPlacements = upsertByInstanceId(retained, upserted);
      changed.push(`집 장식 배치 ${upserted.length}건 upsert/${section.remove.length}건 remove`);
    }
    if (changed.length === 0) {
      throw new ToolError("바꿀 섹션이 없습니다. farmAnimals/farmBuildingPlacements/homeDecorationPlacements 중 하나를 보내세요.", { code: "invalid-args" });
    }
    return { summary: `농장 시작 상태: ${changed.join(", ")}`, data: { changed } };
  },
};

export const FARM_SPATIAL_TOOLS: readonly ToolDefinition[] = [
  upsertFarmBuildingType,
  upsertHomeDecorationType,
  upsertFarmAnimalBuilding,
  setSessionFarmState,
];
