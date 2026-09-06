// 툴 파라미터 스키마의 프로바이더 호환 계약 (2026-07-08).
// Gemini(LLM 경유)는 function declaration 스키마를 엄격 검증한다:
// - type 은 단일 문자열이어야 한다 (["boolean","object"] 같은 union 금지)
// - properties 는 type:"object" 에서만 허용
// - items 는 type:"array" 에서만 허용
// 위반 시 요청 전체가 400 으로 죽어 "채팅 치면 에러" 로 나타난다 — author_house.windows 회귀의 재발 방지.
//
// 2026-08-23 추가: `type:"object"` 인데 properties 가 없는 노드도 금지한다. 400 은 안 나지만
// strict function-calling 경로에서 모델이 그 객체의 필드를 표현할 방법이 없어 `{}` 만 보낸다.
// 실측: set_work_plan `layers:[{}]` 8회, set_build_spec `assets:[{}]` 10회 연속 실패 후 계획 폐기 →
// 스펙 게이트가 fill_region/place_npc 까지 차단해 한 턴이 통째로 헛돌았다. 배열 개수(1,2,3,6,5)만
// 바뀌고 내용은 항상 비어 있었다는 점이 모델이 아니라 스키마가 벽이라는 증거다.
// 실제 shape 를 description 문자열에만 적어두는 것은 계약이 아니다 — properties 로 선언해야 한다.
//
// 2026-08-29 추가: 같은 벽을 노드가 아니라 **필드 단위**로 또 밟았다. 검증기가 재제출 때
// overExisting 을 요구하는데 SET_BUILD_SPEC_TOOL 의 assets.items.properties 에 그 이름이 없어
// 모델이 9회 연속 재제출에서 단 한 번도 낼 수 없었다. 같은 턴의 confirmDestroy(선언돼 있음)는
// 정상적으로 나왔다 — 차이는 오직 선언 여부였다. 결과: 영역 턴이 24콜 예산을 태우고
// max-tool-calls 로 잘려 313칸이 미적용으로 남았다. 검증기가 이름을 부르는 필드는 선언돼야 한다.
import { describe, expect, it } from "vitest";
import { allTools } from "@/editor/tools/toolRegistry";
import { SET_BUILD_SPEC_TOOL, SPEC_REMEDY_FIELDS, WORK_PLAN_TOOLS } from "@/ai/assistantSession";
import { ACCEPTANCE_CRITERIA_SCHEMA, ACCEPTANCE_SCHEMA, ACCEPTANCE_TOOLS } from "@/ai/assistantAcceptanceTools";
import { parseAcceptance, parseAcceptanceCriteria, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { workPlanFromSetToolArgs } from "@/ai/workPlan";
type SchemaNode = {
  readonly type?: unknown;
  readonly enum?: readonly unknown[];
  readonly required?: readonly string[];
  readonly minimum?: number;
  readonly minItems?: number;
  readonly properties?: Record<string, SchemaNode>;
  readonly items?: SchemaNode;
  readonly additionalProperties?: unknown;
  readonly oneOf?: readonly SchemaNode[];
  readonly anyOf?: readonly SchemaNode[];
};

/** 모델에 노출되는 전체 파라미터 스키마 — 레지스트리 툴 + 세션 전용 툴. */
function exposedSchemas(): { name: string; parameters: SchemaNode }[] {
  const registry = allTools().map((tool) => ({ name: tool.name, parameters: tool.parameters as SchemaNode }));
  const session = [SET_BUILD_SPEC_TOOL, ...WORK_PLAN_TOOLS, ...ACCEPTANCE_TOOLS].map((tool) => ({
    name: tool.function.name,
    parameters: tool.function.parameters as SchemaNode,
  }));
  return [...registry, ...session];
}

function walk(node: SchemaNode, path: string, violations: string[], isRoot: boolean): void {
  if (node.oneOf !== undefined || node.anyOf !== undefined) {
    violations.push(`${path}: oneOf/anyOf 는 strict provider tool schema 에서 금지됩니다`);
  }
  if (node.type !== undefined && typeof node.type !== "string") {
    violations.push(`${path}: type 은 단일 문자열이어야 합니다 (${JSON.stringify(node.type)})`);
  }
  if (node.properties !== undefined && node.type !== "object") {
    violations.push(`${path}: properties 는 type:"object" 에서만 허용됩니다 (type=${JSON.stringify(node.type)})`);
  }
  if (node.items !== undefined && node.type !== "array") {
    violations.push(`${path}: items 는 type:"array" 에서만 허용됩니다 (type=${JSON.stringify(node.type)})`);
  }
  // 루트 파라미터는 인자 없는 툴(get_work_plan 등)이 있으므로 빈 properties 를 허용한다.
  // 키가 런타임 id 인 딕셔너리(elementRates, priceBySeason 등)는 properties 로 표현할 수 없다 —
  // `additionalProperties: true` 를 명시해 의도적 자유 맵임을 선언한 노드만 면제한다.
  const dynamicMap = node.additionalProperties === true;
  if (!isRoot && node.type === "object" && !dynamicMap && Object.keys(node.properties ?? {}).length === 0) {
    violations.push(
      `${path}: type:"object" 인데 properties 가 없습니다 — 모델이 {} 밖에 보낼 수 없습니다. ` +
        `허용 필드를 properties 로 선언하거나(유니온은 키 합집합을 선택 필드로), 진짜 동적 키 맵이면 additionalProperties:true 를 명시하세요.`,
    );
  }
  for (const [key, child] of Object.entries(node.properties ?? {})) walk(child, `${path}.${key}`, violations, false);
  if (node.items) walk(node.items, `${path}[]`, violations, false);
  for (const [index, child] of (node.oneOf ?? []).entries()) walk(child, `${path}.oneOf[${index}]`, violations, false);
  for (const [index, child] of (node.anyOf ?? []).entries()) walk(child, `${path}.anyOf[${index}]`, violations, false);
}

describe("툴 스키마 프로바이더 호환(Gemini 엄격 검증)", () => {
  it("전 툴 파라미터가 union type/비객체 properties/비배열 items 를 쓰지 않는다", () => {
    const violations: string[] = [];
    for (const { name, parameters } of exposedSchemas()) walk(parameters, name, violations, true);
    expect(violations.filter((v) => !v.includes("properties 가 없습니다"))).toEqual([]);
  });

  it("객체 타입 파라미터는 properties 를 선언한다 (모델이 {} 만 보내는 벽 방지)", () => {
    const violations: string[] = [];
    for (const { name, parameters } of exposedSchemas()) walk(parameters, name, violations, true);
    expect(violations.filter((v) => v.includes("properties 가 없습니다"))).toEqual([]);
  });

  it("노출 스키마 어디에도 provider 금지 oneOf/anyOf 가 없다", () => {
    const violations: string[] = [];
    for (const { name, parameters } of exposedSchemas()) walk(parameters, name, violations, true);
    expect(violations.filter((v) => v.includes("oneOf/anyOf"))).toEqual([]);
  });

  it("실측 회귀: set_work_plan.layers 와 set_build_spec.assets 가 항목 필드를 노출한다", () => {
    const setPlan = WORK_PLAN_TOOLS.find((tool) => tool.function.name === "set_work_plan");
    const layerItem = (setPlan?.function.parameters as SchemaNode).properties?.layers?.items;
    expect(Object.keys(layerItem?.properties ?? {})).toContain("items");
    expect(Object.keys(layerItem?.properties?.items?.items?.properties ?? {})).toEqual(
      expect.arrayContaining(["title", "instruction"]),
    );

    const assetItem = (SET_BUILD_SPEC_TOOL.function.parameters as SchemaNode).properties?.assets?.items;
    expect(Object.keys(assetItem?.properties ?? {})).toEqual(
      expect.arrayContaining(["id", "kind", "x", "y", "w", "h"]),
    );
  });

  it("실측 회귀: 검증기가 재제출을 요구하는 필드(SPEC_REMEDY_FIELDS)가 set_build_spec.assets 에 선언돼 있다", () => {
    const assetItem = (SET_BUILD_SPEC_TOOL.function.parameters as SchemaNode).properties?.assets?.items;
    const declared = Object.keys(assetItem?.properties ?? {});
    // 선언되지 않은 필드를 요구하면 모델이 낼 방법이 없어 거부 루프가 예산을 태운다.
    expect(declared).toEqual(expect.arrayContaining([...SPEC_REMEDY_FIELDS]));
  });

  it("overExisting 은 clear|keep 로 열거돼 모델이 값까지 정확히 낼 수 있다", () => {
    const assetItem = (SET_BUILD_SPEC_TOOL.function.parameters as SchemaNode).properties?.assets?.items;
    const overExisting = assetItem?.properties?.overExisting;
    expect(overExisting?.type).toBe("string");
    expect(overExisting?.enum).toEqual(["clear", "keep"]);
  });
});

// Every runtime variant must be expressible without a union or invented wrapper.
const criterionCases: AcceptanceCriterion[] = [
  { kind: "toolVerdict", tool: "run_lint", args: {} },
  { kind: "toolVerdict", tool: "play_walkthrough", args: {
    mapId: "map_start", scenario: [{ do: "setVariable", id: "progress", value: 0 },
      { expect: "variable", id: "progress", value: 0 }],
    runtimeKeys: { "authored-id": [null, false, 0, "0", { nested: {} }] },
  } },
  ...[{ mapId: "map_start" }, { newMapName: "New room" }].flatMap((target): AcceptanceCriterion[] => [
    { kind: "mapDimensions", target, width: 20, height: 15 },
    { kind: "mapCount", targets: [target], count: 1 },
    { kind: "reachability", target, from: { x: 0, y: 0 }, to: [{ x: 1, y: 0 }] },
    ...[undefined, { x: 0, y: 1, w: 2, h: 3 }].flatMap((region): AcceptanceCriterion[] => [
      { kind: "eventCount", target, count: 0, ...(region ? { region } : {}) },
      ...(["targetChange", "preserve", "imageReviewed"] as const).map(kind => ({ kind, target, ...(region ? { region } : {}) })),
    ]),
  ]),
  { kind: "mapCount", targets: [{ mapId: "map_start" }, { newMapName: "New room" }], count: 2 },
];

function expectRepresentable(schema: SchemaNode | undefined, value: unknown): void {
  expect(schema).toBeDefined();
  if (!schema) throw new Error("Missing exposed schema field");
  if (schema.enum) expect(schema.enum).toContain(value);
  if (Array.isArray(value)) {
    expect(schema.type).toBe("array");
    if (schema.minItems !== undefined) expect(value.length).toBeGreaterThanOrEqual(schema.minItems);
    for (const entry of value) expectRepresentable(schema.items, entry);
  } else if (typeof value === "object" && value !== null) {
    expect(schema.type).toBe("object");
    for (const key of schema.required ?? []) expect(value).toHaveProperty(key);
    for (const [key, entry] of Object.entries(value)) {
      const child = schema.properties?.[key];
      if (child) expectRepresentable(child, entry);
      else expect(schema.additionalProperties).toBe(true);
    }
  } else {
    expect(schema.type).toBe(typeof value === "number" ? "integer" : typeof value);
    if (typeof value === "number") {
      expect(Number.isSafeInteger(value)).toBe(true);
      if (schema.minimum !== undefined) expect(value).toBeGreaterThanOrEqual(schema.minimum);
    }
  }
}

describe("acceptance and requirement schema/runtime contract", () => {
  it.each(criterionCases)("represents and roundtrips $kind %j on every exposed surface", criterion => {
    const setPlanTool = exposedSchemas().find(schema => schema.name === "set_work_plan");
    const repairTool = exposedSchemas().find(schema => schema.name === "repair_acceptance");
    if (!setPlanTool || !repairTool) throw new Error("Missing exposed acceptance tool");
    const setPlan = setPlanTool.parameters;
    const repair = repairTool.parameters;
    const criteria: unknown = JSON.parse(JSON.stringify([criterion]));
    for (const field of ["acceptance", "requirements"] as const) {
      expect(setPlan.properties?.[field]).toBe(ACCEPTANCE_SCHEMA);
      expect(setPlan.properties?.[field]?.items?.properties?.criteria).toBe(ACCEPTANCE_CRITERIA_SCHEMA);
      const args = { goal: "Schema roundtrip", [field]: [{ id: "promise", title: "Promise", criteria }],
        layers: [{ title: "Verify", items: [{ title: "Verify", instruction: "Check the promise" }] }] };
      expectRepresentable(setPlan, args);
      expect(workPlanFromSetToolArgs(args)?.[field]).toEqual([{ id: "promise", title: "Promise", required: true, criteria }]);
    }
    expect(repair.properties?.criteria).toBe(ACCEPTANCE_CRITERIA_SCHEMA);
    expectRepresentable(repair, { itemId: "promise", criteria });
    expect(parseAcceptanceCriteria(criteria)).toEqual([criterion]);
  });

  it("keeps the shared discriminator, closed structural keys and genuine dynamic args", () => {
    const schema: SchemaNode = ACCEPTANCE_CRITERIA_SCHEMA;
    const item = schema.items;
    expect(item?.type).toBe("object");
    expect(item?.required).toEqual(["kind"]);
    expect(item?.additionalProperties).toBe(false);
    expect(item?.properties?.kind).toEqual({ type: "string", enum: [
      "toolVerdict", "mapDimensions", "mapCount", "eventCount", "targetChange", "preserve", "imageReviewed", "reachability",
    ] });
    expect(Object.keys(item?.properties ?? {}).sort()).toEqual([
      "args", "count", "from", "height", "kind", "region", "target", "targets", "to", "tool", "width",
    ]);
    expect(item?.properties?.args).toMatchObject({ type: "object", additionalProperties: true });
    expect(item?.properties?.target).toMatchObject({ type: "object", additionalProperties: false,
      properties: { mapId: { type: "string" }, newMapName: { type: "string" } } });
    expect(item?.properties?.targets?.items).toBe(item?.properties?.target);
    expect(item?.properties?.from?.required).toEqual(["x", "y"]);
    expect(item?.properties?.region?.required).toEqual(["x", "y", "w", "h"]);
    for (const key of ["width", "height"]) expect(item?.properties?.[key]?.minimum).toBe(1);
    expect(item?.properties?.count?.minimum).toBe(0);
    for (const key of ["targets", "to"]) expect(item?.properties?.[key]?.minItems).toBe(1);
  });

  it.each(criterionCases)("retains runtime requiredness and rejects extra fields for $kind %j", criterion => {
    const valid: Record<string, unknown> = { ...criterion };
    for (const key of Object.keys(valid).filter(key => key !== "region")) {
      const missing = { ...valid };
      delete missing[key];
      expect(parseAcceptanceCriteria([criterion, missing]), `missing ${key}`).toBeNull();
    }
    for (const extra of ["source", "evidence", "passed", "withdrawal", "fingerprint", "evidenceId",
      ...(criterion.kind === "toolVerdict" ? ["target"] : ["args"])]) {
      expect(parseAcceptanceCriteria([criterion, { ...valid, [extra]: {} }]), `extra ${extra}`).toBeNull();
    }
  });

  it.each([{}, { mapId: "map_start", newMapName: "New room" }, { mapId: "" }, { newMapName: " " },
    { mapId: "map_start", passed: true }])("rejects malformed or ambiguous target %j", target => {
    expect(parseAcceptanceCriteria([{ kind: "preserve", target }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "mapCount", targets: [target], count: 1 }])).toBeNull();
  });

  it.each([undefined, null, [], "{}", 0, false])("rejects non-object exact args %j", args => {
    expect(parseAcceptanceCriteria([{ kind: "toolVerdict", tool: "run_lint", args }])).toBeNull();
  });

  it("preserves required defaults and never accepts an unregistered verification tool", () => {
    const criteria = [criterionCases[0]];
    for (const required of [undefined, true, false, "false"]) {
      const promise = { id: "promise", title: "Promise", criteria, ...(required === undefined ? {} : { required }) };
      expect(parseAcceptance([promise])).toEqual([{ id: "promise", title: "Promise",
        required: required !== false, criteria: required === "false" ? null : criteria }]);
    }
    expect(parseAcceptanceCriteria([{ kind: "toolVerdict", tool: "set_map_properties", args: {} }])).toBeNull();
  });
});
