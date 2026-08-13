// editor/tools/jsonSchema.ts
// JSON Schema 기반 최소 인자 검증(필수 필드/타입). 깊은 구조는 검증하지 않고
// 툴 내부의 기존 shape 검증기(io/shape*)에 위임한다.

import type { JsonSchema, JsonSchemaType } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonString(value: unknown, schema: JsonSchema): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const first = trimmed[0];
  const wantsObject = schemaHasType(schema, "object");
  const wantsArray = schemaHasType(schema, "array");
  if (!wantsObject && !wantsArray) return value;
  if ((wantsObject && first !== "{") || (wantsArray && first !== "[")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function schemaHasType(schema: JsonSchema, type: JsonSchemaType): boolean {
  return Array.isArray(schema.type) ? schema.type.includes(type) : schema.type === type;
}

const SINGLE_OBJECT_ARRAY_MARK = "__rpgzzuSingleObjectArray";

function shouldWrapSingleObjectAsArray(schema: JsonSchema): boolean {
  return schema.type === "array" && schema.items?.type === "object" && schema.description?.includes("단일 Command object") === true;
}

function singleObjectArray(value: unknown): unknown[] {
  const array = [value];
  Object.defineProperty(array, SINGLE_OBJECT_ARRAY_MARK, { value: true, enumerable: false });
  return array;
}

const COORDINATE_WRAPPER_KEYS = ["rect", "region", "area", "bounds", "at", "pos", "point"] as const;

function dimensionAlias(key: string): string | null {
  if (key === "w") return "width";
  if (key === "h") return "height";
  if (key === "width") return "w";
  if (key === "height") return "h";
  return null;
}

function coordinateValue(record: Record<string, unknown>, key: string): unknown {
  const value = record[key];
  if (value !== undefined) return value;
  const alias = dimensionAlias(key);
  return alias ? record[alias] : undefined;
}

function coordinateKeys(properties: Record<string, JsonSchema>): string[] {
  return ["x", "y", "w", "h", "width", "height"].filter((key) => properties[key] !== undefined);
}

function isCoordinateObjectSchema(schema: JsonSchema): boolean {
  if (schema.type !== "object") return false;
  const properties = schema.properties ?? {};
  return properties.x !== undefined && properties.y !== undefined;
}

function normalizeFlatCoordinateAliases(properties: Record<string, JsonSchema>, args: Record<string, unknown>): void {
  for (const key of coordinateKeys(properties)) {
    if (args[key] !== undefined) continue;
    const aliasValue = coordinateValue(args, key);
    if (aliasValue !== undefined) args[key] = aliasValue;
  }
}

function flattenCoordinateWrapper(properties: Record<string, JsonSchema>, args: Record<string, unknown>): void {
  const keys = coordinateKeys(properties);
  if (!keys.includes("x") || !keys.includes("y")) return;

  for (const wrapperKey of COORDINATE_WRAPPER_KEYS) {
    const wrapper = args[wrapperKey];
    if (!isRecord(wrapper)) continue;
    for (const key of keys) {
      if (args[key] !== undefined) continue;
      const value = coordinateValue(wrapper, key);
      if (value !== undefined) args[key] = value;
    }
    return;
  }
}

function wrapFlatCoordinates(properties: Record<string, JsonSchema>, args: Record<string, unknown>): void {
  const coordinateFields = Object.entries(properties).filter(([, childSchema]) => isCoordinateObjectSchema(childSchema));
  if (coordinateFields.length !== 1) return;

  const [field, childSchema] = coordinateFields[0];
  if (args[field] !== undefined) return;

  const childProperties = childSchema.properties ?? {};
  const keys = coordinateKeys(childProperties);
  if (!keys.includes("x") || !keys.includes("y")) return;
  const requiredKeys = childSchema.required?.length ? childSchema.required : keys;
  if (!requiredKeys.every((key) => coordinateValue(args, key) !== undefined)) return;

  const wrapped: Record<string, unknown> = {};
  for (const key of keys) {
    const value = coordinateValue(args, key);
    if (value !== undefined) wrapped[key] = value;
  }
  args[field] = wrapped;
}

function normalizeCoordinateShape(schema: JsonSchema, args: Record<string, unknown>): void {
  const properties = schema.properties ?? {};
  normalizeFlatCoordinateAliases(properties, args);
  flattenCoordinateWrapper(properties, args);
  wrapFlatCoordinates(properties, args);
}

function coerceForSchema(schema: JsonSchema, value: unknown): unknown {
  const parsed = parseJsonString(value, schema);
  const schemaTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  const objectCandidate = coerceBooleanEnabledObject(schema, parsed);
  if (schemaTypes.includes("object") && isRecord(Array.isArray(objectCandidate) && objectCandidate.length === 1 ? objectCandidate[0] : objectCandidate)) {
    const unwrapped = Array.isArray(objectCandidate) && objectCandidate.length === 1 ? objectCandidate[0] : objectCandidate;
    const properties = schema.properties ?? {};
    const next: Record<string, unknown> = { ...unwrapped };
    normalizeCoordinateShape(schema, next);
    for (const [key, childSchema] of Object.entries(properties)) {
      if (next[key] !== undefined) next[key] = coerceForSchema(childSchema, next[key]);
    }
    return next;
  }
  if (schemaTypes.includes("array") && Array.isArray(parsed)) {
    if (!schema.items) return parsed;
    return parsed.map((entry) => coerceForSchema(schema.items as JsonSchema, entry));
  }
  if (shouldWrapSingleObjectAsArray(schema) && isRecord(parsed)) {
    return singleObjectArray(coerceForSchema(schema.items as JsonSchema, parsed));
  }
  if (schemaTypes.includes("integer") || schemaTypes.includes("number")) {
    if (typeof parsed === "string" && parsed.trim() !== "") {
      const number = Number(parsed);
      if (Number.isFinite(number)) return number;
    }
  }
  if (schemaTypes.length > 1) return parsed;
  switch (schemaTypes[0]) {
    case "object": {
      const candidate = coerceBooleanEnabledObject(schema, parsed);
      const unwrapped = Array.isArray(candidate) && candidate.length === 1 ? candidate[0] : candidate;
      if (!isRecord(unwrapped)) return unwrapped;
      const properties = schema.properties ?? {};
      const next: Record<string, unknown> = { ...unwrapped };
      normalizeCoordinateShape(schema, next);
      for (const [key, childSchema] of Object.entries(properties)) {
        if (next[key] !== undefined) next[key] = coerceForSchema(childSchema, next[key]);
      }
      return next;
    }
    case "array": {
      if (!Array.isArray(parsed)) {
        if (shouldWrapSingleObjectAsArray(schema) && isRecord(parsed)) {
          return singleObjectArray(coerceForSchema(schema.items as JsonSchema, parsed));
        }
        return parsed;
      }
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
  return parsed;
}

function coerceBooleanEnabledObject(schema: JsonSchema, value: unknown): unknown {
  if (typeof value !== "boolean") return value;
  if (!schemaHasType(schema, "object")) return value;
  const enabled = schema.properties?.enabled;
  if (!enabled || !schemaHasType(enabled, "boolean")) return value;
  return { enabled: value };
}

// LLM 툴콜에서 흔히 나오는 무해한 표현 흔들림을 스키마 검증 전에 정규화한다.
export function normalizeArgsForSchema(schema: JsonSchema, args: unknown): unknown {
  return coerceForSchema(schema, args);
}

// 값이 스키마 타입에 부합하는지 판정.
function matchesSingleType(value: unknown, type: JsonSchemaType): boolean {
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

function matchesType(value: unknown, type: JsonSchema["type"]): boolean {
  const schemaTypes = Array.isArray(type) ? type : [type];
  return schemaTypes.some((entry) => matchesSingleType(value, entry));
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
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in (schema.properties ?? {}))) errors.push(`허용되지 않은 인자: ${key}`);
    }
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
    if (typeof value === "string") {
      if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
        errors.push(`인자 '${key}'는 ${propSchema.minLength}자 이상이어야 합니다.`);
      }
      if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
        errors.push(`인자 '${key}'는 ${propSchema.maxLength}자 이하여야 합니다.`);
      }
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
