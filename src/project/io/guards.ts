import { COMMAND_KINDS } from "../commandKindRegistry";
import { ProjectFormatError } from "./errors";

export type JsonRecord = Record<string, unknown>;

export const resourceKinds = new Set([
  "chipset",
  "charset",
  "battle",
  "battleCharset",
  "battleWeapon",
  "backdrop",
  "gameOver",
  "monster",
  "faceset",
  "picture",
  "system",
  "system2",
  "title",
  "music",
  "sound",
]);

// commandKindRegistry.ts(단일 소스)에서 파생. kind 유니온과의 드리프트는
// commandKindRegistry.ts의 타입 레벨 검증 + test/commandKindCoverage.test.ts 가 차단한다.
export const commandKinds: ReadonlySet<string> = new Set(COMMAND_KINDS);

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function cloneJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) || "x";
}

export function requireRecord(label: string, value: unknown): JsonRecord {
  if (isRecord(value)) return value;
  throw new ProjectFormatError(`${label}가 객체가 아닙니다.`);
}

export function requireArray(label: string, value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new ProjectFormatError(`${label}가 배열이 아닙니다.`);
}

export function requireString(label: string, value: unknown): string {
  if (typeof value === "string") return value;
  throw new ProjectFormatError(`${label}가 문자열이 아닙니다.`);
}

export function requireNumber(label: string, value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new ProjectFormatError(`${label}가 숫자가 아닙니다.`);
}

export function requireBoolean(label: string, value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new ProjectFormatError(`${label}가 boolean이 아닙니다.`);
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ProjectFormatError(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
