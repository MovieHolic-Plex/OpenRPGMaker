import { isHouseKitId } from "@/editor/houseKit";
import { ToolError } from "@/editor/tools/types";

import {
  booleanOrDefault,
  optionalInteger,
  optionalString,
  rejectUnknownKeys,
  requiredArray,
  requiredInteger,
  requiredString,
  requireRecord,
  type BoundaryRecord,
} from "./boundary";
import type {
  AuthorHousePlan,
  AuthorHouseRequest,
  HouseInteriorMode,
  HouseWindowOptions,
  HouseWing,
  HouseYardIntent,
} from "./contracts";

const SINGLE_KEYS = ["kind", "mapId", "kitId", "wings", "interior", "door", "ownerName", "windows"] as const;
const LOTS_KEYS = ["kind", "mapId", "houses", "seed"] as const;
const PLAN_KEYS = ["kitId", "wings", "interior", "door", "ownerName", "windows", "yard"] as const;

type HouseCore = Omit<AuthorHousePlan, "yard">;

export function parseAuthorHouseRequest(value: unknown): AuthorHouseRequest {
  const request = requireRecord(value, "authorHouse");
  const kind = requiredString(request, "kind", "authorHouse");
  switch (kind) {
    case "single":
      return parseSingleRequest(request);
    case "lots":
      return parseLotsRequest(request);
    default:
      throw new ToolError("authorHouse.kind must be single or lots.", { code: "invalid-args" });
  }
}

function parseSingleRequest(request: BoundaryRecord): AuthorHouseRequest {
  rejectUnknownKeys(request, SINGLE_KEYS, "authorHouse");
  return {
    kind: "single",
    mapId: requiredString(request, "mapId", "authorHouse"),
    ...parseHouseCore(request, "authorHouse"),
  };
}

function parseLotsRequest(request: BoundaryRecord): AuthorHouseRequest {
  rejectUnknownKeys(request, LOTS_KEYS, "authorHouse");
  const houses = requiredArray(request, "houses", "authorHouse").map((value, index) =>
    parseHousePlan(value, `authorHouse.houses[${index}]`));
  if (houses.length === 0) {
    throw new ToolError("authorHouse.houses must contain at least one plan.", { code: "invalid-args" });
  }
  const seed = optionalInteger(request, "seed", "authorHouse");
  return {
    kind: "lots",
    mapId: requiredString(request, "mapId", "authorHouse"),
    houses,
    ...(seed === undefined ? {} : { seed }),
  };
}

function parseHousePlan(value: unknown, scope: string): AuthorHousePlan {
  const plan = requireRecord(value, scope);
  rejectUnknownKeys(plan, PLAN_KEYS, scope);
  return {
    ...parseHouseCore(plan, scope),
    yard: parseYard(requiredArray(plan, "yard", scope), scope),
  };
}

function parseHouseCore(record: BoundaryRecord, scope: string): HouseCore {
  const kitId = record["kitId"];
  if (!isHouseKitId(kitId)) {
    throw new ToolError(`${scope}.kitId is not a known house kit.`, { code: "invalid-args" });
  }
  const ownerName = optionalString(record, "ownerName", scope);
  const windows = parseWindows(record["windows"], scope);
  return {
    kitId,
    wings: parseWings(requiredArray(record, "wings", scope), scope),
    interior: parseInteriorMode(record["interior"], scope),
    door: booleanOrDefault(record, "door", { scope, defaultValue: true }),
    ...(ownerName === undefined ? {} : { ownerName }),
    ...(windows === undefined ? {} : { windows }),
  };
}

function parseWings(values: readonly unknown[], scope: string): readonly HouseWing[] {
  if (values.length === 0) {
    throw new ToolError(`${scope}.wings must contain at least one rectangle.`, { code: "invalid-args" });
  }
  return values.map((value, index) => {
    const wingScope = `${scope}.wings[${index}]`;
    const wing = requireRecord(value, wingScope);
    rejectUnknownKeys(wing, ["x", "y", "w", "h"], wingScope);
    const x = requiredInteger(wing, "x", wingScope);
    const y = requiredInteger(wing, "y", wingScope);
    const w = requiredInteger(wing, "w", wingScope);
    const h = requiredInteger(wing, "h", wingScope);
    // LLM이 최소 크기를 어기는 경우가 잦으므로 클램프로 자동 보정 (에러→재시도 왕복 제거).
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      w: Math.max(3, w),
      h: Math.max(5, h),
    };
  });
}

function parseInteriorMode(value: unknown, scope: string): HouseInteriorMode {
  if (value === "exterior-only" || value === "linked-interior") return value;
  throw new ToolError(`${scope}.interior must be exterior-only or linked-interior.`, { code: "invalid-args" });
}

function parseWindows(value: unknown, scope: string): HouseWindowOptions | undefined {
  if (value === undefined) return undefined;
  // LLM이 true를 보내는 경우가 잦으므로 {}로 자동 변환 (에러→재시도 왕복 제거).
  if (value === true) return {};
  if (value === false) return false;
  const options = requireRecord(value, `${scope}.windows`);
  rejectUnknownKeys(options, ["spacing"], `${scope}.windows`);
  const spacing = optionalInteger(options, "spacing", `${scope}.windows`);
  if (spacing !== undefined && spacing < 0) {
    throw new ToolError(`${scope}.windows.spacing must be non-negative.`, { code: "invalid-args" });
  }
  return spacing === undefined ? {} : { spacing };
}

function parseYard(values: readonly unknown[], scope: string): readonly HouseYardIntent[] {
  return values.map((value, index) => {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    const yardScope = `${scope}.yard[${index}]`;
    const intent = requireRecord(value, yardScope);
    rejectUnknownKeys(intent, ["kind", "count"], yardScope);
    const count = requiredInteger(intent, "count", yardScope);
    if (count < 1) {
      throw new ToolError(`${yardScope}.count must be positive.`, { code: "invalid-args" });
    }
    return { kind: requiredString(intent, "kind", yardScope), count };
  });
}
