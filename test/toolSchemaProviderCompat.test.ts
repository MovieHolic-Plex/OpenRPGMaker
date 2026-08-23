// 툴 파라미터 스키마의 프로바이더 호환 계약 (2026-07-08).
// Gemini(LLM 경유)는 function declaration 스키마를 엄격 검증한다:
// - type 은 단일 문자열이어야 한다 (["boolean","object"] 같은 union 금지)
// - properties 는 type:"object" 에서만 허용
// - items 는 type:"array" 에서만 허용
// 위반 시 요청 전체가 400 으로 죽어 "채팅 치면 에러" 로 나타난다 — build_house_kit.windows 회귀의 재발 방지.
//
// 2026-08-23 추가: `type:"object"` 인데 properties 가 없는 노드도 금지한다. 400 은 안 나지만
// strict function-calling 경로에서 모델이 그 객체의 필드를 표현할 방법이 없어 `{}` 만 보낸다.
// 실측: set_work_plan `layers:[{}]` 8회, set_build_spec `assets:[{}]` 10회 연속 실패 후 계획 폐기 →
// 스펙 게이트가 fill_region/place_npc 까지 차단해 한 턴이 통째로 헛돌았다. 배열 개수(1,2,3,6,5)만
// 바뀌고 내용은 항상 비어 있었다는 점이 모델이 아니라 스키마가 벽이라는 증거다.
// 실제 shape 를 description 문자열에만 적어두는 것은 계약이 아니다 — properties 로 선언해야 한다.
import { describe, expect, it } from "vitest";
import { allTools } from "@/editor/tools/toolRegistry";
import { SET_BUILD_SPEC_TOOL, WORK_PLAN_TOOLS } from "@/ai/assistantSession";
type SchemaNode = {
  readonly type?: unknown;
  readonly properties?: Record<string, SchemaNode>;
  readonly items?: SchemaNode;
  readonly additionalProperties?: unknown;
};

/** 모델에 노출되는 전체 파라미터 스키마 — 레지스트리 툴 + 세션 전용 툴. */
function exposedSchemas(): { name: string; parameters: SchemaNode }[] {
  const registry = allTools().map((tool) => ({ name: tool.name, parameters: tool.parameters as SchemaNode }));
  const session = [SET_BUILD_SPEC_TOOL, ...WORK_PLAN_TOOLS].map((tool) => ({
    name: tool.function.name,
    parameters: tool.function.parameters as SchemaNode,
  }));
  return [...registry, ...session];
}

function walk(node: SchemaNode, path: string, violations: string[], isRoot: boolean): void {
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
});
