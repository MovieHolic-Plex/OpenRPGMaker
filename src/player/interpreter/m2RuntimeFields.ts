import type { M2CommandValue } from "@/project/types";

export function fieldString(fields: Record<string, unknown>, key: string, fallback: string): string {
  if (!(key in fields)) console.warn(`[m2] missing field: ${key}`);
  const value = fields[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function fieldNumber(fields: Record<string, M2CommandValue>, key: string, fallback: number): number {
  if (!(key in fields)) console.warn(`[m2] missing field: ${key}`);
  const value = fields[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function fieldBoolean(fields: Record<string, M2CommandValue>, key: string, fallback: boolean): boolean {
  if (!(key in fields)) console.warn(`[m2] missing field: ${key}`);
  const value = fields[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}
