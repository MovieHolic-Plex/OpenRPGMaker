// editor/tools/jsonSchema.ts
// JSON Schema 기반 최소 인자 검증(필수 필드/타입). 깊은 구조는 검증하지 않고
// 툴 내부의 기존 shape 검증기(io/shape*)에 위임한다.

import type { JsonSchema } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonString(value: unknown, schema: JsonSchema): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const first = trimmed[0];
  if ((schema.type === "object" && first !== "{") || (schema.type === "array" && first !== "[")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function coerceForSchema(schema: JsonSchema, value: unknown): unknown {
  const parsed = parseJsonString(value, schema);
  switch (schema.type) {
    case "object": {
      const unwrapped = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
      if (!isRecord(unwrapped)) return unwrapped;
      const properties = schema.properties ?? {};
      const next: Record<string, unknown> = { ...unwrapped };
      for (const [key, childSchema] of Object.entries(properties)) {
        if (next[key] !== undefined) next[key] = coerceForSchema(childSchema, next[key]);
      }
      return next;
    }
    case "array": {
      if (!Array.isArray(parsed)) return parsed;
      if (!schema.items) return parsed;
      return parsed.map((entry) => coerceForSchema(schema.items as JsonSchema, entry));
    }
    case "integer":
    case "number": {
      if (typeof parsed === "string" && parsed.trim() !== "") {
        const number = Number(parsed);
        if (Number.isFinite(number)) return number;
      }
      return parsed;
    }
    case "string":
    case "boolean":
      return parsed;
  }
}

// LLM 툴콜에서 흔히 나오는 무해한 표현 흔들림을 스키마 검증 전에 정규화한다.
export function normalizeArgsForSchema(schema: JsonSchema, args: unknown): unknown {
  return coerceForSchema(schema, args);
}

// 값이 스키마 타입에 부합하는지 판정.
function matchesType(value: unknown, type: JsonSchema["type"]): boolean {
  switch (type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
  }
}

// 최상위 object 스키마에 대해 args를 검증하고 오류 메시지 배열을 반환한다(빈 배열=통과).
export function validateArgs(schema: JsonSchema, args: unknown): string[] {
  const errors: string[] = [];
  if (schema.type !== "object") {
    errors.push("툴 파라미터 스키마의 최상위 타입은 object여야 합니다.");
    return errors;
  }
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    errors.push("인자는 객체여야 합니다.");
    return errors;
  }
  const record = args as Record<string, unknown>;
  for (const key of schema.required ?? []) {
    if (record[key] === undefined) errors.push(`필수 인자 누락: ${key}`);
  }
  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const value = record[key];
    if (value === undefined) continue;
    if (!matchesType(value, propSchema.type)) {
      errors.push(`인자 '${key}'의 타입이 ${propSchema.type}이어야 합니다.`);
      continue;
    }
    if (propSchema.enum && !propSchema.enum.includes(value as string | number)) {
      errors.push(`인자 '${key}'는 [${propSchema.enum.join(", ")}] 중 하나여야 합니다.`);
    }
    if (propSchema.type === "array" && propSchema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        if (!matchesType(value[i], propSchema.items.type)) {
          errors.push(`인자 '${key}[${i}]'의 타입이 ${propSchema.items.type}이어야 합니다.`);
        }
      }
    }
  }
  return errors;
}
