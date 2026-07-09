// 툴 파라미터 스키마의 프로바이더 호환 계약 (2026-07-08).
// Gemini(OpenRouter 경유)는 function declaration 스키마를 엄격 검증한다:
// - type 은 단일 문자열이어야 한다 (["boolean","object"] 같은 union 금지)
// - properties 는 type:"object" 에서만 허용
// - items 는 type:"array" 에서만 허용
// 위반 시 요청 전체가 400 으로 죽어 "채팅 치면 에러" 로 나타난다 — build_house_kit.windows 회귀의 재발 방지.
import { describe, expect, it } from "vitest";
import { allTools } from "@/editor/tools/toolRegistry";

type SchemaNode = {
  readonly type?: unknown;
  readonly properties?: Record<string, SchemaNode>;
  readonly items?: SchemaNode;
};

function walk(node: SchemaNode, path: string, violations: string[]): void {
  if (node.type !== undefined && typeof node.type !== "string") {
    violations.push(`${path}: type 은 단일 문자열이어야 합니다 (${JSON.stringify(node.type)})`);
  }
  if (node.properties !== undefined && node.type !== "object") {
    violations.push(`${path}: properties 는 type:"object" 에서만 허용됩니다 (type=${JSON.stringify(node.type)})`);
  }
  if (node.items !== undefined && node.type !== "array") {
    violations.push(`${path}: items 는 type:"array" 에서만 허용됩니다 (type=${JSON.stringify(node.type)})`);
  }
  for (const [key, child] of Object.entries(node.properties ?? {})) walk(child, `${path}.${key}`, violations);
  if (node.items) walk(node.items, `${path}[]`, violations);
}

describe("툴 스키마 프로바이더 호환(Gemini 엄격 검증)", () => {
  it("전 툴 파라미터가 union type/비객체 properties/비배열 items 를 쓰지 않는다", () => {
    const violations: string[] = [];
    for (const tool of allTools()) {
      walk(tool.parameters as SchemaNode, tool.name, violations);
    }
    expect(violations).toEqual([]);
  });
});
