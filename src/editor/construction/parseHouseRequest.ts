import { gableHouseFormSize, gableHouseFormStories, GABLE_HOUSE_FORM_SPECS } from "@/editor/gableHouseCompose";
import { ALL_HOUSE_KIT_IDS, isHouseKitId, type HouseKitId } from "@/editor/houseKit";
import { findGableHouseFormSpec, gableFormMixWeight } from "@/project/defaults/gableHouseFormCatalog";
import { ToolError } from "@/editor/tools/types";
import {
  AUTHORED_HOUSE_FORM_DEFS,
  findAuthoredHouseForm,
} from "@/project/defaults/authoredHouseFormCatalog";
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
const SINGLE_KEYS = ["kind", "mapId", "kitId", "wings", "interior", "interiorPlan", "door", "ownerName", "windows", "yard", ...SHAPE_KEYS] as const;
const LOTS_KEYS = ["kind", "mapId", "houses", "seed"] as const;
const PLAN_KEYS = ["kitId", "wings", "interior", "interiorPlan", "door", "ownerName", "windows", "yard", ...SHAPE_KEYS] as const;

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
      return assignDefaultGableForms(parseSingleRequest(request));
    case "lots":
      return assignDefaultGableForms(parseLotsRequest(request));
    default:
      throw new ToolError("authorHouse.kind must be single or lots.", { code: "invalid-args" });
  }
}

function hashInts(...values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const value of values) {
    h ^= value & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (value >>> 16) & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * templateId 를 생략한 사각형 한 장짜리 집에 박공 조합 형태를 골고루 배정한다(2026-09-25 기본 분배).
 *
 * 예전에는 wings 그대로의 모임지붕 사각형이 되어, 모델이 templateId 를 빠뜨리면 마을이 네모 덩어리만 남았다.
 * 낮은 벽·옥상 데크·여러 날개·3층을 명시한 집은 의도가 있는 사각형이라 건드리지 않는다. stories:2 는 2층 박공에서 고른다.
 * 형태는 날개 사각형 안에 들어가는 것 중 크기가 비슷한 것(폭·높이 차 ≤2)을 먼저, 같은 요청 안에서는 겹치지 않게
 * (seed·순번 해시) 고른다. 앵커는 가로 가운데·아래 맞춤 — 요청한 앞면(문 줄)이 그대로다.
 */
function assignDefaultGableForms(request: AuthorHouseRequest): AuthorHouseRequest {
  const used = new Set<string>();
  const seed = request.kind === "lots" ? request.seed ?? 1 : 1;
  const assign = <T extends HouseCore>(plan: T, index: number): T => {
    if (plan.templateId !== undefined || plan.wings.length !== 1) return plan;
    const stories = plan.stories ?? 1;
    if (stories > 2 || plan.lowWall === true || plan.roofDeck === true) return plan;
    const wing = plan.wings[0] as HouseWing;
    // 층수가 같은 박공만 — stories:2 를 준 집은 2층 박공(gable-2f*), 생략·1 이면 단층 박공.
    const sized = GABLE_HOUSE_FORM_SPECS.filter((spec) => gableFormMixWeight(spec) > 0 && gableHouseFormStories(spec) === stories)
      .map((spec) => ({ spec, ...gableHouseFormSize(spec) }))
      .filter((entry) => entry.w <= wing.w && entry.h <= wing.h);
    if (sized.length === 0) return plan;
    const close = sized.filter((entry) => entry.w >= wing.w - 2 && entry.h >= wing.h - 2);
    const pool = close.length > 0 ? close : sized;
    const fresh = pool.filter((entry) => !used.has(entry.spec.id));
    const from = fresh.length > 0 ? fresh : pool;
    // 가중치 추첨(spec.mix) — 해시를 [0,1) 로 펴서 누적 가중치에서 고른다.
    const weights = from.map((entry) => gableFormMixWeight(entry.spec));
    let ticket = (hashInts(seed, index, wing.x, wing.y, wing.w, wing.h) / 0x100000000) * weights.reduce((sum, weight) => sum + weight, 0);
    let pick = 0;
    while (pick < from.length - 1 && ticket >= weights[pick]!) {
      ticket -= weights[pick]!;
      pick += 1;
    }
    const chosen = from[pick]!;
    used.add(chosen.spec.id);
    return {
      ...plan,
      templateId: chosen.spec.id,
      stories,
      wings: [{ x: wing.x + Math.floor((wing.w - chosen.w) / 2), y: wing.y + wing.h - chosen.h, w: chosen.w, h: chosen.h }],
    };
  };
  if (request.kind === "single") return assign(request, 0);
  return { ...request, houses: request.houses.map((house, index) => assign(house, index)) };
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
  const rawKitId = record["kitId"];
  let kitId: HouseKitId;
  if (isHouseKitId(rawKitId)) {
    kitId = rawKitId;
  } else {
    // 저작 형태(셀 레시피)는 재료가 레시피에 고정돼 kitId 인자가 무의미하다 — 생략 허용.
    const templateId = typeof record["templateId"] === "string" ? record["templateId"] : undefined;
    const form = templateId === undefined ? undefined : findAuthoredHouseForm(templateId);
    const gable = templateId === undefined ? undefined : findGableHouseFormSpec(templateId);
    if (form !== undefined) kitId = form.kitId;
    else if (gable !== undefined && rawKitId === undefined) {
      // 박공 조합 형태는 킷을 따른다 — 빠뜨리면 형태 id 로 결정적으로 고른다.
      kitId = ALL_HOUSE_KIT_IDS[hashInts(...[...gable.id].map((char) => char.charCodeAt(0))) % ALL_HOUSE_KIT_IDS.length]!;
    } else {
      throw new ToolError(`${scope}.kitId is not a known house kit.`, { code: "invalid-args" });
    }
  }
  const ownerName = optionalString(record, "ownerName", scope);
  const windows = parseWindows(record["windows"], scope);
  const interiorPlan = parseInteriorPlan(record["interiorPlan"], scope);
  const shape = parseShape(record, scope, parseWings(requiredArray(record, "wings", scope), scope), kitId);
  return {
    kitId: shape.kitId,
    wings: shape.wings,
    interior: parseInteriorMode(record["interior"], scope),
    door: booleanOrDefault(record, "door", { scope, defaultValue: true }),
    ...(ownerName === undefined ? {} : { ownerName }),
    ...(windows === undefined ? {} : { windows }),
    ...(interiorPlan === undefined ? {} : { interiorPlan }),
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
 * (rooftop-deck 은 파랑 평지붕 전용 — 어기면 시공이 깨진다).
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
  const anchor = wings[0] as HouseWing;
  const gable = def ? undefined : findGableHouseFormSpec(templateId);
  if (gable) {
    // 박공 조합 형태 — 칸 모양은 고정, 재료는 요청 킷을 따른다(시공 때 합성).
    const size = gableHouseFormSize(gable);
    return {
      kitId: requestedKitId,
      wings: [{ x: anchor.x, y: anchor.y, w: size.w, h: size.h }],
      templateId: gable.id,
      stories: 1,
      ...(chimney === undefined ? {} : { chimney }),
    };
  }
  if (!def) {
    // 날개 문법으로 못 만드는 저작 형태(셀 레시피) — 폭 상한 없는 고정 형태다.
    const form = findAuthoredHouseForm(templateId);
    if (!form) {
      const known = [
        ...GABLE_HOUSE_FORM_SPECS.map((entry) => entry.id),
        ...HOUSE_TEMPLATE_DEFS.map((entry) => entry.id),
        ...AUTHORED_HOUSE_FORM_DEFS.map((entry) => entry.id),
      ];
      throw new ToolError(
        `${scope}.templateId '${templateId}' 는 알 수 없는 형태입니다. 사용 가능: ${known.join(", ")}`,
        { code: "invalid-args" },
      );
    }
    return {
      kitId: form.kitId,
      wings: [{ x: anchor.x, y: anchor.y, w: form.w, h: form.h }],
      templateId: form.id,
      stories: form.stories,
    };
  }
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
    rejectUnknownKeys(wing, ["x", "y", "w", "h", "stories"], wingScope);
    const x = requiredInteger(wing, "x", wingScope);
    const y = requiredInteger(wing, "y", wingScope);
    const w = requiredInteger(wing, "w", wingScope);
    const h = requiredInteger(wing, "h", wingScope);
    // 날개별 층수(계단식 집). 생략하면 계획 전체의 stories 를 쓴다.
    const wingStories = optionalInteger(wing, "stories", wingScope);
    if (wingStories !== undefined && wingStories !== 1 && wingStories !== 2 && wingStories !== 3) {
      throw new ToolError(`${wingScope}.stories must be 1, 2 or 3.`, { code: "invalid-args" });
    }
    // LLM이 최소 크기를 어기는 경우가 잦으므로 클램프로 자동 보정 (에러→재시도 왕복 제거).
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      w: Math.max(3, w),
      h: Math.max(5, h),
      ...(wingStories === undefined ? {} : { stories: wingStories as 1 | 2 | 3 }),
    };
  });
}
/**
 * 실내 설계 원문. 모양(객체)만 보고 통과시킨다 — objectId 가 이 프로젝트의 물건 어휘인지는
 * houseKitDomain 이 타일셋을 들고 판정한다(파서는 프로젝트를 모른다).
 */
function parseInteriorPlan(value: unknown, scope: string): unknown {
  if (value === undefined || value === null) return undefined;
  return requireRecord(value, `${scope}.interiorPlan`);
}

function parseInteriorMode(value: unknown, scope: string): HouseInteriorMode {
  // 생략하면 들어가서 걷는 집이 기본 — 외장만은 명시적으로 exterior-only.
  if (value === undefined || value === null) return "linked-interior";
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
