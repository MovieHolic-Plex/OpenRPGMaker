import { ToolError } from "@/editor/tools/types";

export type BoundaryRecord = Readonly<Record<string, unknown>>;

export function requireRecord(value: unknown, scope: string): BoundaryRecord {
  if (!isBoundaryRecord(value)) {
    throw new ToolError(`${scope} must be an object.`, { code: "invalid-args" });
  }
  return value;
}

function isBoundaryRecord(value: unknown): value is BoundaryRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 허용 키 목록을 강제한다. 거부 메시지에 **허용 키 전체**를 실어야 한다 — 2026-08-23 실측:
 * `authorHouse.kitId is not allowed.` 만 돌려주자 모델이 무엇이 허용되는지 알 수 없어 같은 인자를
 * 4회 연속 재전송했다. author_house 처럼 `kind` 에 따라 허용 키가 갈리는 툴은 스키마로 표현할 수
 * 없으므로(oneOf 금지), 이 에러 문구가 유일한 교정 신호다.
 */
export function rejectUnknownKeys(record: BoundaryRecord, keys: readonly string[], scope: string): void {
  const unknownKey = Object.keys(record).find((key) => !keys.includes(key));
  if (unknownKey !== undefined) {
    throw new ToolError(
      `${scope}.${unknownKey} is not allowed. Allowed keys here: ${keys.join(", ")}.`,
      { code: "invalid-args" },
    );
  }
}

export function requiredString(record: BoundaryRecord, key: string, scope: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${scope}.${key} must be a non-empty string.`, { code: "invalid-args" });
  }
  return value.trim();
}

export function optionalString(record: BoundaryRecord, key: string, scope: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${scope}.${key} must be a non-empty string.`, { code: "invalid-args" });
  }
  return value.trim();
}

export function requiredInteger(record: BoundaryRecord, key: string, scope: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ToolError(`${scope}.${key} must be an integer.`, { code: "invalid-args" });
  }
  return value;
}

export function optionalInteger(record: BoundaryRecord, key: string, scope: string): number | undefined {
  if (record[key] === undefined) return undefined;
  return requiredInteger(record, key, scope);
}

export function booleanOrDefault(
  record: BoundaryRecord,
  key: string,
  options: { readonly scope: string; readonly defaultValue: boolean },
): boolean {
  const value = record[key];
  if (value === undefined) return options.defaultValue;
  if (typeof value !== "boolean") {
    throw new ToolError(`${options.scope}.${key} must be a boolean.`, { code: "invalid-args" });
  }
  return value;
}

export function optionalBoolean(record: BoundaryRecord, key: string, scope: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ToolError(`${scope}.${key} must be a boolean.`, { code: "invalid-args" });
  }
  return value;
}

export function requiredBoolean(record: BoundaryRecord, key: string, scope: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new ToolError(`${scope}.${key} must be a boolean.`, { code: "invalid-args" });
  }
  return value;
}

export function requiredArray(record: BoundaryRecord, key: string, scope: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new ToolError(`${scope}.${key} must be an array.`, { code: "invalid-args" });
  }
  return value;
}
