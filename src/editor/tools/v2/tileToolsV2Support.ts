// editor/tools/v2/tileToolsV2Support.ts
// 타일 v2 툴 공용 지원 계층 — v1 실패 원인(스키마 부실/불친절한 오류)을 계약 수준에서 차단한다.
// 원칙: (1) 모든 인자 오류는 "다시 보낼 형식 예시"를 동봉 (2) 흔한 별칭(tileId/index 등)은 수용
// (3) 엔진은 v1 run()을 재사용 — v2는 계약(스키마/정규화/오류) 계층이다.

import type { ToolDefinition } from "../types";
import { ToolError } from "../types";

export interface PointArg {
  x: number;
  y: number;
}

// ToolError에 모델 자가수정용 재전송 예시를 동봉한다. issues로 변환돼 모델에게 그대로 전달된다.
export function failWithExample(message: string, example: Record<string, unknown>, code = "invalid-args"): never {
  throw new ToolError(`${message} — 다시 보낼 형식 예시: ${JSON.stringify(example)}`, { code });
}

export function byName(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`v2 배선 오류: v1 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

// {x,y} 좌표 인자 — 숫자 문자열("3")도 수용해 정수로 강제한다.
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

// 타일 인덱스 별칭 수용: tile / tileId / index / id 전부 허용.
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

// v1 run에 넘길 인자에서 undefined 필드를 제거한다(v1의 `x in args` 류 검사 오작동 방지).
export function compactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
}
