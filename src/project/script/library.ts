// project/script/library.ts — project script library (shared `@lib/<id>` helper modules): load normalization
// and shape helpers shared by io, the runtime and the editor. Player-safe.
import {
  SCRIPT_COMPILED_LIMIT,
  SCRIPT_LIBRARY_ID_PATTERN,
  SCRIPT_LIBRARY_LIMIT,
  SCRIPT_REF_KINDS,
  SCRIPT_SOURCE_LIMIT,
  type ScriptEffects,
  type ScriptModule,
  type ScriptRef,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const REF_KINDS: ReadonlySet<string> = new Set(SCRIPT_REF_KINDS);

function normalizeRefs(value: unknown): ScriptRef[] {
  if (!Array.isArray(value)) return [];
  const out: ScriptRef[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.kind !== "string" || typeof entry.id !== "string") continue;
    if (!REF_KINDS.has(entry.kind) || !entry.id) continue;
    out.push({ kind: entry.kind as ScriptRef["kind"], id: entry.id });
  }
  return out;
}

/** Tolerant: drops malformed rows instead of failing a project load. */
export function normalizeScriptEffects(value: unknown): ScriptEffects | undefined {
  if (!isRecord(value)) return undefined;
  const dynamic = Array.isArray(value.dynamic)
    ? value.dynamic.flatMap((entry) => isRecord(entry) && typeof entry.api === "string"
      ? [{ api: entry.api, line: typeof entry.line === "number" && Number.isFinite(entry.line) ? Math.trunc(entry.line) : 0 }]
      : [])
    : [];
  return { reads: normalizeRefs(value.reads), writes: normalizeRefs(value.writes), calls: normalizeRefs(value.calls), dynamic };
}

/**
 * Library normalization for project load. Invalid ids, duplicates and oversize modules are dropped
 * (a broken library row must not make the whole project unloadable); `undefined` when nothing is left.
 */
export function normalizeScriptLibrary(value: unknown): ScriptModule[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: ScriptModule[] = [];
  for (const entry of value) {
    if (out.length >= SCRIPT_LIBRARY_LIMIT) break;
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!SCRIPT_LIBRARY_ID_PATTERN.test(id) || seen.has(id)) continue;
    const source = typeof entry.source === "string" ? entry.source : "";
    const compiled = typeof entry.compiled === "string" ? entry.compiled : "";
    if (source.length > SCRIPT_SOURCE_LIMIT || compiled.length > SCRIPT_COMPILED_LIMIT) continue;
    seen.add(id);
    const module: ScriptModule = { id, source, compiled };
    if (typeof entry.name === "string" && entry.name.trim()) module.name = entry.name.trim();
    if (typeof entry.description === "string" && entry.description.trim()) module.description = entry.description.trim();
    const effects = normalizeScriptEffects(entry.effects);
    if (effects) module.effects = effects;
    if (typeof entry.sourceHash === "string") module.sourceHash = entry.sourceHash;
    if (typeof entry.apiVersion === "number" && Number.isInteger(entry.apiVersion)) module.apiVersion = entry.apiVersion;
    out.push(module);
  }
  return out.length ? out : undefined;
}

export function findScriptModule(library: readonly ScriptModule[] | undefined, id: string): ScriptModule | undefined {
  return library?.find((entry) => entry.id === id);
}

/** Library import specifier → module id (`@lib/shop` → `shop`). */
export function libraryIdFromSpecifier(specifier: string): string | undefined {
  if (!specifier.startsWith("@lib/")) return undefined;
  const id = specifier.slice(5);
  return SCRIPT_LIBRARY_ID_PATTERN.test(id) ? id : undefined;
}
