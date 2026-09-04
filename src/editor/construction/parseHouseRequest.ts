import { isHouseKitId } from "@/editor/houseKit";
import { ToolError } from "@/editor/tools/types";
import {
  HOUSE_TEMPLATE_DEFS,
  findHouseTemplateDef,
  houseTemplateWingsAt,
} from "@/project/defaults/houseTemplateCatalog";

import {
  booleanOrDefault,
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
import type {
  AuthorHousePlan,
  AuthorHouseRequest,
  HouseInteriorMode,
  HouseStories,
  HouseWindowOptions,
  HouseWing,
  HouseYardIntent,
} from "./contracts";

const SHAPE_KEYS = ["templateId", "stories", "lowWall", "chimney", "roofDeck"] as const;
const SINGLE_KEYS = ["kind", "mapId", "kitId", "wings", "interior", "door", "ownerName", "windows", "yard", ...SHAPE_KEYS] as const;
const LOTS_KEYS = ["kind", "mapId", "houses", "seed"] as const;
const PLAN_KEYS = ["kitId", "wings", "interior", "door", "ownerName", "windows", "yard", ...SHAPE_KEYS] as const;

type HouseCore = Omit<AuthorHousePlan, "yard">;

/**
 * `kind` 로 허용 키가 갈리는 요청을 파싱한다. JSON Schema 로는 이 분기를 표현할 수 없어서
 * (`oneOf` 는 Gemini 게이트웨이가 400 으로 죽인다) 모델은 두 모드의 키를 섞어 보낸다 —
 * 2026-08-23 실측: `kind:"lots"` + 최상위 `kitId/wings` 조합을 한 턴에 33회 연속 보내고
 * 전부 거부당했다. 허용 키를 에러 문구에 실어도 교정되지 않았으므로(같은 턴에서 재현) 여기서
 * shape 기반으로 정규화한다 — 이 파일의 wings 클램프·windows:true 보정과 같은 방침이다.
 */
export function parseAuthorHouseRequest(value: unknown): AuthorHouseRequest {
  const request = normalizeRequestShape(requireRecord(value, "authorHouse"));
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

/**
 * 모드와 키 조합을 실제 내용에 맞춘다.
 * - `kind` 누락: `houses` 가 있으면 lots, 없으면 single.
 * - lots + 최상위 단일 모드 키: `houses` 가 없으면 그 키들을 houses[0] 로 접고, 있으면 잉여 키를 버린다.
 * - single + `houses`: lots 로 본다.
 */
function normalizeRequestShape(request: BoundaryRecord): BoundaryRecord {
  const hasHouses = Array.isArray(request["houses"]);
  const singleOnlyKeys = PLAN_KEYS.filter((key) => request[key] !== undefined);
  const kind = typeof request["kind"] === "string" ? request["kind"] : hasHouses ? "lots" : "single";
  if (kind === "single" && !hasHouses) return { ...request, kind };
  if (singleOnlyKeys.length === 0) return { ...request, kind: "lots" };

  const stripped: Record<string, unknown> = { kind: "lots", mapId: request["mapId"] };
  if (request["seed"] !== undefined) stripped["seed"] = request["seed"];
  if (hasHouses) {
    // houses 가 이미 있으면 최상위 단일 모드 키는 중복 의도다 — 버린다.
    stripped["houses"] = request["houses"];
    return stripped;
  }
  const folded: Record<string, unknown> = {};
  for (const key of singleOnlyKeys) folded[key] = request[key];
  folded["yard"] ??= [];
  stripped["houses"] = [folded];
  return stripped;
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
  const shape = parseShape(record, scope, parseWings(requiredArray(record, "wings", scope), scope), kitId);
  return {
    kitId: shape.kitId,
    wings: shape.wings,
    interior: parseInteriorMode(record["interior"], scope),
    door: booleanOrDefault(record, "door", { scope, defaultValue: true }),
    ...(ownerName === undefined ? {} : { ownerName }),
    ...(windows === undefined ? {} : { windows }),
    ...(shape.templateId === undefined ? {} : { templateId: shape.templateId }),
    ...(shape.stories === undefined ? {} : { stories: shape.stories }),
    ...(shape.lowWall === undefined ? {} : { lowWall: shape.lowWall }),
    ...(shape.chimney === undefined ? {} : { chimney: shape.chimney }),
    ...(shape.roofDeck === undefined ? {} : { roofDeck: shape.roofDeck }),
  };
}

type ShapeResolution = {
  readonly kitId: AuthorHousePlan["kitId"];
  readonly wings: readonly HouseWing[];
  readonly templateId?: string;
  readonly stories?: HouseStories;
  readonly lowWall?: boolean;
  readonly chimney?: boolean;
  readonly roofDeck?: boolean;
};

/**
 * 형태 어휘 해석. templateId 가 있으면 wings[0] 을 앵커로 카탈로그 날개를 전개하고,
 * 그 템플릿이 강제하는 킷·층수·낮은벽·옥상데크를 인자보다 우선 적용한다
 * (aframe 은 h 가 폭에 종속, rooftop-deck 은 파랑 평지붕 전용 — 어기면 시공이 깨진다).
 */
function parseShape(
  record: BoundaryRecord,
  scope: string,
  wings: readonly HouseWing[],
  requestedKitId: AuthorHousePlan["kitId"],
): ShapeResolution {
  const stories = parseStories(record, scope);
  const lowWall = optionalBoolean(record, "lowWall", scope);
  const chimney = optionalBoolean(record, "chimney", scope);
  const roofDeck = optionalBoolean(record, "roofDeck", scope);
  const templateId = optionalString(record, "templateId", scope);
  if (templateId === undefined) {
    return {
      kitId: requestedKitId,
      wings,
      ...(stories === undefined ? {} : { stories }),
      ...(lowWall === undefined ? {} : { lowWall }),
      ...(chimney === undefined ? {} : { chimney }),
      ...(roofDeck === undefined ? {} : { roofDeck }),
    };
  }
  const def = findHouseTemplateDef(templateId);
  if (!def) {
    throw new ToolError(
      `${scope}.templateId '${templateId}' 는 알 수 없는 형태입니다. 사용 가능: ${HOUSE_TEMPLATE_DEFS.map((entry) => entry.id).join(", ")}`,
      { code: "invalid-args" },
    );
  }
  const anchor = wings[0] as HouseWing;
  return {
    kitId: def.kitId ?? requestedKitId,
    wings: houseTemplateWingsAt(def, anchor.x, anchor.y),
    templateId: def.id,
    ...(def.lowWall ? { lowWall: true } : lowWall === undefined ? {} : { lowWall }),
    ...(def.lowWall ? {} : { stories: def.stories ?? stories ?? 1 }),
    ...(chimney === undefined ? {} : { chimney }),
    ...(def.roofDeck ? { roofDeck: true } : roofDeck === undefined ? {} : { roofDeck }),
  };
}

function parseStories(record: BoundaryRecord, scope: string): HouseStories | undefined {
  const stories = optionalInteger(record, "stories", scope);
  if (stories === undefined) return undefined;
  if (stories !== 1 && stories !== 2 && stories !== 3) {
    throw new ToolError(`${scope}.stories must be 1, 2 or 3.`, { code: "invalid-args" });
  }
  return stories;
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
  rejectUnknownKeys(options, ["enabled", "spacing"], `${scope}.windows`);
  const enabled = optionalBoolean(options, "enabled", `${scope}.windows`);
  const spacing = optionalInteger(options, "spacing", `${scope}.windows`);
  if (enabled === false) return false;
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
