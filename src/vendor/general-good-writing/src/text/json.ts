import { compareCodePoints } from "./chars.ts";

export type JsonObject = { readonly [key: string]: Json };
export type Json = null | boolean | number | string | readonly Json[] | JsonObject;

/** `JSON.parse` yields only JSON values, so its result is a sound `Json`; this is the one place that assignment happens. */
export function parseJson(text: string): Json {
  const value: Json = JSON.parse(text);
  return value;
}

export function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !isJsonArray(value);
}

export function field(value: Json | undefined, key: string): Json | undefined {
  return isJsonObject(value) ? value[key] : undefined;
}

export function asString(value: Json | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: Json | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Canonical request JSON: keys sorted by code point, ", " and ": " separators, non-ASCII kept raw, integral numbers
 * without a decimal point. The Jev replay store is keyed by the sha256 of exactly this string, so changing any byte
 * of it orphans every recording.
 */
export function canonicalJson(value: Json): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (isJsonArray(value)) return `[${value.map(canonicalJson).join(", ")}]`;
  const keys = Object.keys(value).sort(compareCodePoints);
  return `{${keys.map((k) => `${JSON.stringify(k)}: ${canonicalJson(value[k] ?? null)}`).join(", ")}}`;
}

/** One-line JSON in insertion order with ", " and ": " separators; floats keep their fraction (1.0 stays 1.0 when marked). */
export function inlineJson(value: Json, floatKeys: ReadonlySet<string> = new Set()): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (isJsonArray(value)) return `[${value.map((v) => inlineJson(v, floatKeys)).join(", ")}]`;
  const parts = Object.keys(value).map((k) => {
    const v = value[k] ?? null;
    const rendered = typeof v === "number" && floatKeys.has(k) && Number.isInteger(v) ? `${v}.0` : inlineJson(v, floatKeys);
    return `${JSON.stringify(k)}: ${rendered}`;
  });
  return `{${parts.join(", ")}}`;
}

export function isJsonArray(value: Json | undefined): value is readonly Json[] {
  return Array.isArray(value);
}
