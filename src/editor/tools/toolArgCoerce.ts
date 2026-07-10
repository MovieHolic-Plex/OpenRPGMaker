// 툴 인자 정규화 공용 계층 (구 v2 support).
// 원칙: (1) 모든 인자 오류는 "다시 보낼 형식 예시" 동봉 (2) 흔한 별칭 수용
// (3) 엔진 run() 은 각 툴/엔진 모듈에 두고 여기선 계약만 담당.

import type { ToolDefinition } from "./types";
import { ToolError } from "./types";

export interface PointArg {
  x: number;
  y: number;
}

export function failWithExample(message: string, example: Record<string, unknown>, code = "invalid-args"): never {
  throw new ToolError(`${message} — 다시 보낼 형식 예시: ${JSON.stringify(example)}`, { code });
}

export function byName(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`툴 배선 오류: 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

export function coercePoint(value: unknown, field: string, example: Record<string, unknown>): PointArg {
  if (typeof value !== "object" || value === null) failWithExample(`${field}는 {x,y} 객체여야 합니다`, example);
  const record = value as Record<string, unknown>;
  const x = coerceInt(record.x, `${field}.x`, example);
  const y = coerceInt(record.y, `${field}.y`, example);
  return { x, y };
}

export function coerceInt(value: unknown, field: string, example: Record<string, unknown>): number {
  const num = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num) || !Number.isInteger(num)) {
    failWithExample(`${field}는 정수여야 합니다 (받은 값: ${JSON.stringify(value)})`, example);
  }
  return num;
}

export function coercePointArray(value: unknown, field: string, example: Record<string, unknown>): PointArg[] {
  if (!Array.isArray(value) || value.length === 0) failWithExample(`${field}는 [{x,y},...] 배열이어야 합니다`, example);
  return value.map((entry, index) => coercePoint(entry, `${field}[${index}]`, example));
}

export function coerceTileIndex(record: Record<string, unknown>, field: string, example: Record<string, unknown>): number {
  const raw = record.tile ?? record.tileId ?? record.index ?? record.id;
  if (raw === undefined) failWithExample(`${field}에 tile(타일 인덱스)이 없습니다`, example);
  return coerceInt(raw, `${field}.tile`, example);
}

export function coerceEnum<T extends string>(value: unknown, allowed: readonly T[], field: string, example: Record<string, unknown>): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  failWithExample(`${field}는 [${allowed.join(", ")}] 중 하나여야 합니다 (받은 값: ${JSON.stringify(value)})`, example);
}

export function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], field: string, example: Record<string, unknown>): T | undefined {
  if (value === undefined || value === null) return undefined;
  return coerceEnum(value, allowed, field, example);
}

export function compactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
}
