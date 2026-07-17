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

export function rejectUnknownKeys(record: BoundaryRecord, keys: readonly string[], scope: string): void {
  const allowed = new Set(keys);
  const unknownKey = Object.keys(record).find((key) => !allowed.has(key));
  if (unknownKey !== undefined) {
    throw new ToolError(`${scope}.${unknownKey} is not allowed.`, { code: "invalid-args" });
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
