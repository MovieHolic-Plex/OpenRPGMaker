import { MIN_BOUNDS_SIZE } from "@/editor/tools/village/constants";
import { isHouseKitId } from "@/editor/houseKit";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { ToolError } from "@/editor/tools/types";

import {
  optionalBoolean,
  optionalInteger,
  optionalString,
  rejectUnknownKeys,
  requiredArray,
  requiredInteger,
  requiredString,
  requireRecord,
  type BoundaryRecord,
} from "./boundary";
import {
  VILLAGE_GROUND_THEMES,
  VILLAGE_SETTLEMENT_LAYOUTS,
  type AuthorVillageRequest,
  type VillageResidentPlan,
  type AuthorVillageTarget,
  type ConstructionCountPolicy,
  type ConstructionRect,
  type PlannedMapDescriptor,
  type VillageGroundTheme,
  type VillageHousePlan,
  type VillageSettlementLayout,
} from "./contracts";

const REQUEST_KEYS = ["target", "houseCount", "housePlans", "countPolicy", "groundTheme", "settlementLayout", "npcCount", "residents", "theme", "forestDensity", "seed", "interior", "presetId", "fullMap"] as const;
const FOREST_DENSITIES = ["sparse", "normal", "dense", "impassable"] as const;
const EXISTING_TARGET_KEYS = ["kind", "mapId", "bounds", "fullMap"] as const;
const NEW_TARGET_KEYS = ["kind", "mapId", "name", "width", "height", "plannedMap"] as const;
const HOUSE_PLAN_KEYS = ["kitId", "yard", "ownerName", "templateId", "program"] as const;
const RESIDENT_KEYS = ["name", "role", "lines"] as const;
const MIN_HOUSES = 1;
const MAX_HOUSES = 32;
const MIN_MAP_SIZE = 20;
const MAX_MAP_SIZE = MAX_TOOL_MAP_DIMENSION;
const MAX_NPCS = 512;

export function parseAuthorVillageRequest(value: unknown): AuthorVillageRequest {
  const request = normalizeRequestShape(requireRecord(value, "authorVillage"));
  rejectUnknownKeys(request, REQUEST_KEYS, "authorVillage");
  const houseCount = requiredInteger(request, "houseCount", "authorVillage");
  if (houseCount < MIN_HOUSES || houseCount > MAX_HOUSES) {
    throw new ToolError("authorVillage.houseCount must be between 1 and 32.", { code: "invalid-args" });
  }
  const housePlans = parseHousePlans(request["housePlans"]);
  if (housePlans !== undefined && housePlans.length !== houseCount) {
    throw new ToolError("authorVillage.housePlans length must equal houseCount.", { code: "invalid-args" });
  }
  const theme = optionalString(request, "theme", "authorVillage");
  const forestDensity = parseOptionalEnum(request["forestDensity"], FOREST_DENSITIES, "authorVillage.forestDensity");
  // 사용자 저작 프리셋 id — 데이터베이스 「마을」탭 레코드를 가리킨다. 없는 id는 빌더가 경고로 흘린다.
  const presetId = optionalString(request, "presetId", "authorVillage");
  const seed = optionalInteger(request, "seed", "authorVillage");
  const interior = optionalBoolean(request, "interior", "authorVillage");
  const groundTheme = parseOptionalEnum(request["groundTheme"], VILLAGE_GROUND_THEMES, "authorVillage.groundTheme");
  const settlementLayout = parseOptionalEnum(request["settlementLayout"], VILLAGE_SETTLEMENT_LAYOUTS, "authorVillage.settlementLayout");
  const npcCount = optionalInteger(request, "npcCount", "authorVillage");
  const fullMap = optionalBoolean(request, "fullMap", "authorVillage");
  const residents = parseResidents(request["residents"]);
  if (npcCount !== undefined && (npcCount < 0 || npcCount > MAX_NPCS)) {
    throw new ToolError(`authorVillage.npcCount must be between 0 and ${MAX_NPCS}.`, { code: "invalid-args" });
  }
  return {
    target: withFullMap(parseTarget(request["target"]), fullMap),
    houseCount,
    countPolicy: parseCountPolicy(request["countPolicy"]),
    ...(housePlans === undefined ? {} : { housePlans }),
    ...(groundTheme === undefined ? {} : { groundTheme: groundTheme as VillageGroundTheme }),
    ...(settlementLayout === undefined ? {} : { settlementLayout: settlementLayout as VillageSettlementLayout }),
    ...(npcCount === undefined ? {} : { npcCount }),
    ...(residents === undefined ? {} : { residents }),
    ...(theme === undefined ? {} : { theme }),
    ...(forestDensity === undefined ? {} : { forestDensity }),
    ...(presetId === undefined ? {} : { presetId }),
    ...(seed === undefined ? {} : { seed }),
    ...(interior === undefined ? {} : { interior }),
  };
}

function normalizeRequestShape(request: BoundaryRecord): BoundaryRecord {
  const target = request["target"];
  if (typeof target !== "object" || target === null || Array.isArray(target)) return request;
  const normalizedTarget = { ...(target as BoundaryRecord) };
  // JSON Schema cannot express this discriminated union to every function-calling gateway.
  // Models therefore send fields from both target variants; discard only the known opposite-variant fields.
  if (normalizedTarget["kind"] === "existing") {
    for (const key of ["name", "width", "height", "plannedMap"]) delete normalizedTarget[key];
  } else if (normalizedTarget["kind"] === "new") {
    delete normalizedTarget["bounds"];
  }
  return { ...request, target: normalizedTarget };
}

function parseOptionalEnum<T extends string>(value: unknown, values: readonly T[], scope: string): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && values.includes(value as T)) return value as T;
  throw new ToolError(`${scope} must be one of ${values.join("|")}.`, { code: "invalid-args" });
}

function withFullMap(target: AuthorVillageTarget, fullMap: boolean | undefined): AuthorVillageTarget {
  if (fullMap === undefined || target.kind !== "existing") return target;
  return { ...target, fullMap };
}

function parseTarget(value: unknown): AuthorVillageTarget {
  const target = requireRecord(value, "authorVillage.target");
  const kind = requiredString(target, "kind", "authorVillage.target");
  switch (kind) {
    case "existing":
      return parseExistingTarget(target);
    case "new":
      return parseNewTarget(target);
    default:
      throw new ToolError("authorVillage.target.kind must be existing or new.", { code: "invalid-args" });
  }
}

function parseExistingTarget(target: BoundaryRecord): AuthorVillageTarget {
  rejectUnknownKeys(target, EXISTING_TARGET_KEYS, "authorVillage.target");
  const bounds = target["bounds"] === undefined
    ? undefined
    : parseRect(target["bounds"], "authorVillage.target.bounds");
  const fullMap = optionalBoolean(target, "fullMap", "authorVillage.target");
  return {
    kind: "existing",
    mapId: requiredString(target, "mapId", "authorVillage.target"),
    ...(bounds === undefined ? {} : { bounds }),
    ...(fullMap === undefined ? {} : { fullMap }),
  };
}

function parseNewTarget(target: BoundaryRecord): AuthorVillageTarget {
  rejectUnknownKeys(target, NEW_TARGET_KEYS, "authorVillage.target");
  const mapId = requiredString(target, "mapId", "authorVillage.target");
  const width = parseMapDimension(target, "width", "authorVillage.target");
  const height = parseMapDimension(target, "height", "authorVillage.target");
  // plannedMap은 선택 — 주면 mapId·width·height가 일치해야 하고, 생략하면 target 값으로 채운다.
  // 모델이 같은 값을 두 번 에코하다 어긋나는 planned-map-mismatch가 잦해서 선택으로 바꿨다.
  const plannedMap = target["plannedMap"] === undefined
    ? { mapId, width, height }
    : parsePlannedMap(target["plannedMap"]);
  if (plannedMap.mapId !== mapId || plannedMap.width !== width || plannedMap.height !== height) {
    throw new ToolError("authorVillage.target plannedMap must match its mapId and dimensions.", {
      code: "planned-map-mismatch",
      mapId,
    });
  }
  return {
    kind: "new",
    mapId,
    name: requiredString(target, "name", "authorVillage.target"),
    width,
    height,
    plannedMap,
  };
}

function parsePlannedMap(value: unknown): PlannedMapDescriptor {
  const plannedMap = requireRecord(value, "authorVillage.target.plannedMap");
  rejectUnknownKeys(plannedMap, ["mapId", "width", "height"], "authorVillage.target.plannedMap");
  return {
    mapId: requiredString(plannedMap, "mapId", "authorVillage.target.plannedMap"),
    width: parseMapDimension(plannedMap, "width", "authorVillage.target.plannedMap"),
    height: parseMapDimension(plannedMap, "height", "authorVillage.target.plannedMap"),
  };
}

function parseMapDimension(record: BoundaryRecord, key: string, scope: string): number {
  const value = requiredInteger(record, key, scope);
  if (value < MIN_MAP_SIZE || value > MAX_MAP_SIZE) {
    throw new ToolError(`${scope}.${key} must be between ${MIN_MAP_SIZE} and ${MAX_MAP_SIZE}.`, { code: "invalid-args" });
  }
  return value;
}

function parseRect(value: unknown, scope: string): ConstructionRect {
  const rect = requireRecord(value, scope);
  rejectUnknownKeys(rect, ["x", "y", "w", "h"], scope);
  const x = requiredInteger(rect, "x", scope);
  const y = requiredInteger(rect, "y", scope);
  const w = requiredInteger(rect, "w", scope);
  const h = requiredInteger(rect, "h", scope);
  // 기존 맵 bounds 하한은 16 — 정확히 뷰포트(16×16) 크기의 선택도 받아야 한다.
  // 새 맵 전체(MIN_MAP_SIZE 20)와는 다른 기준이다.
  if (x < 0 || y < 0 || w < MIN_BOUNDS_SIZE || h < MIN_BOUNDS_SIZE) {
    throw new ToolError(`${scope} requires x/y >= 0 and w/h >= ${MIN_BOUNDS_SIZE}.`, { code: "invalid-args" });
  }
  return { x, y, w, h };
}

function parseHousePlans(value: unknown): readonly VillageHousePlan[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ToolError("authorVillage.housePlans must be an array.", { code: "invalid-args" });
  }
  return value.map((entry, index) => parseHousePlan(entry, index));
}

function parseHousePlan(value: unknown, index: number): VillageHousePlan {
  const scope = `authorVillage.housePlans[${index}]`;
  const plan = requireRecord(value, scope);
  rejectUnknownKeys(plan, HOUSE_PLAN_KEYS, scope);
  const kitId = plan["kitId"];
  if (kitId !== undefined && !isHouseKitId(kitId)) {
    throw new ToolError(`${scope}.kitId is not a known house kit.`, { code: "invalid-args" });
  }
  const yard = plan["yard"] === undefined ? [] : parseStringArray(requiredArray(plan, "yard", scope), `${scope}.yard`);
  const ownerName = optionalString(plan, "ownerName", scope);
  const templateId = optionalString(plan, "templateId", scope);
  const program = parseProgram(plan["program"], scope);
  return {
    ...(kitId === undefined ? {} : { kitId }),
    yard,
    ...(ownerName === undefined ? {} : { ownerName }),
    ...(templateId === undefined ? {} : { templateId }),
    ...(program === undefined ? {} : { program }),
  };
}

function parseResidents(value: unknown): readonly VillageResidentPlan[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError("authorVillage.residents must be an array.", { code: "invalid-args" });
  return value.map((entry, index) => {
    const scope = `authorVillage.residents[${index}]`;
    const resident = requireRecord(entry, scope);
    rejectUnknownKeys(resident, RESIDENT_KEYS, scope);
    const name = optionalString(resident, "name", scope);
    if (name === undefined) throw new ToolError(`${scope}.name is required.`, { code: "invalid-args" });
    const role = optionalString(resident, "role", scope);
    const lines = resident["lines"] === undefined ? undefined : parseStringArray(requiredArray(resident, "lines", scope), `${scope}.lines`);
    return { name, ...(role === undefined ? {} : { role }), ...(lines === undefined ? {} : { lines }) };
  });
}

function parseStringArray(values: readonly unknown[], scope: string): readonly string[] {
  return values.map((value, index) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ToolError(`${scope}[${index}] must be a non-empty string.`, { code: "invalid-args" });
    }
    return value.trim();
  });
}

function parseCountPolicy(value: unknown): ConstructionCountPolicy {
  if (value === undefined || value === "exact") return "exact";
  if (value === "best-effort") return value;
  throw new ToolError("authorVillage.countPolicy must be exact or best-effort.", { code: "invalid-args" });
}

function parseProgram(value: unknown, scope: string): VillageHousePlan["program"] {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ToolError(`${scope}.program is invalid.`, { code: "invalid-args" });
  }
  switch (value) {
    case "dwelling":
    case "shop":
    case "inn":
    case "workshop":
    case "study":
    case "manor":
      return value;
    default:
      throw new ToolError(`${scope}.program is invalid.`, { code: "invalid-args" });
  }
}
