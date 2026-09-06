import type { Project } from "@/project/types";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { sha256HexText } from "@/util/sha256";

/** Sorted object keys, original array order; uncommitted event drafts excluded. */
export const APPLIED_HASH_SCHEME = "project-canonical-json-no-event-drafts-v1";
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter(k => object[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(object[k])}`).join(",")}}`;
}
export const equalJson = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
export function canonicalProject(project: Project): Project { return deserialize(serialize(projectWithoutEventDrafts(project))); }
export function appliedSnapshotHash(project: Project): Promise<string> { return sha256HexText(canonicalJson(canonicalProject(project))); }
export class ResultConflict extends Error {
  constructor(readonly units: readonly string[]) { super(`Result conflicts: ${units.join(", ")}`); }
}
/** Explicit unit boundaries. Arrays below a record/map (commands, tile payloads) stay atomic.
 * Unsupported roots stay atomic, never a speculative recursive field merge. */
export function mergeResultProject(base: Project, generated: Project, live: Project, broadReads = false): Project {
  const b = canonicalProject(base), g = canonicalProject(generated), l = canonicalProject(live);
  if (broadReads && !equalJson(b, l)) throw new ResultConflict(["unknown-read-dependencies"]);
  const conflicts: string[] = [];
  function atomic(before: unknown, after: unknown, current: unknown, path: string): unknown {
    if (equalJson(before, after)) return structuredClone(current);
    // Even an equal independently created ID is a collision, not evidence of our application.
    if (!equalJson(before, current)) { conflicts.push(path); return current; }
    return structuredClone(after);
  }
  function record(before: Record<string, unknown>, after: Record<string, unknown>, current: Record<string, unknown>, path: string): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(current)])].sort()) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new ResultConflict([`${path}.${key}`]);
      const value = atomic(before[key], after[key], current[key], `${path}.${key}`);
      if (value !== undefined) next[key] = value;
    }
    return next;
  }
  function keyed(before: unknown[], after: unknown[], current: unknown[], path: string, key: (v: Record<string, unknown>) => string): unknown[] {
    function index(values: unknown[]): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const value of values) {
        const id = key(value as Record<string, unknown>);
        if (!id || Object.hasOwn(out, id) || ["__proto__", "constructor", "prototype"].includes(id)) throw new ResultConflict([`${path}:duplicate-id`]);
        out[id] = value;
      }
      return out;
    }
    const merged = record(index(before), index(after), index(current), path);
    // Keep live order, append generated creations in stable artifact order.
    const order = [...new Set([...current, ...after].map(v => key(v as Record<string, unknown>)))];
    return order.filter(id => Object.hasOwn(merged, id)).map(id => merged[id]);
  }
  const before = b as unknown as Record<string, unknown>, after = g as unknown as Record<string, unknown>, current = l as unknown as Record<string, unknown>;
  const next = record(before, after, current, "project");
  // Replace coarse conflicts only for explicitly supported keyed roots.
  const supported = new Set(["maps", "tilesets", "assets", "database", "resourceProfiles", "commonEvents", "switches", "variables"]);
  for (let i = conflicts.length - 1; i >= 0; i--) if (supported.has(conflicts[i].slice("project.".length))) conflicts.splice(i, 1);
  for (const root of ["maps", "tilesets", "characters"]) {
    if (before[root] && after[root] && current[root]) {
      const coarse = conflicts.indexOf(`project.${root}`); if (coarse >= 0) conflicts.splice(coarse, 1);
      next[root] = record(before[root] as Record<string, unknown>, after[root] as Record<string, unknown>, current[root] as Record<string, unknown>, root);
    }
  }
  const ba = b.assets, ga = g.assets, la = l.assets;
  next.assets = { ...record(ba as unknown as Record<string, unknown>, ga as unknown as Record<string, unknown>, la as unknown as Record<string, unknown>, "assets"), uploaded: record(ba.uploaded, ga.uploaded, la.uploaded, "assets.uploaded") };
  const uploadedConflict = conflicts.indexOf("assets.uploaded"); if (uploadedConflict >= 0) conflicts.splice(uploadedConflict, 1);
  const db: Record<string, unknown> = {};
  for (const table of new Set([...Object.keys(b.database), ...Object.keys(g.database), ...Object.keys(l.database)])) {
    const bv = (b.database as unknown as Record<string, unknown>)[table], gv = (g.database as unknown as Record<string, unknown>)[table], lv = (l.database as unknown as Record<string, unknown>)[table];
    db[table] = Array.isArray(bv) && Array.isArray(gv) && Array.isArray(lv) && [...bv, ...gv, ...lv].every(v => typeof v?.id === "string")
      ? keyed(bv, gv, lv, `database.${table}`, v => String(v.id)) : atomic(bv, gv, lv, `database.${table}`);
  }
  next.database = db;
  for (const root of ["commonEvents", "switches", "variables", "resourceProfiles"] as const) {
    next[root] = keyed(b[root], g[root], l[root], root, v => root === "resourceProfiles" ? `${v.kind}:${v.assetId}` : String(v.id));
  }
  const candidate = next as unknown as Project;
  // Comparison projections are not live editor state. Restore exact untouched drafts,
  // and never let a canonical map patch overwrite a map with a live edit/new draft.
  for (const [mapId, map] of Object.entries(live.maps)) {
    const drafts = map.events.filter(event => event.draft);
    if (!drafts.length) continue;
    if (!equalJson(b.maps[mapId], g.maps[mapId]) || !candidate.maps[mapId]) {
      conflicts.push(`maps.${mapId}:open-draft`);
      continue;
    }
    const events = candidate.maps[mapId].events;
    for (const draft of drafts) {
      const index = events.findIndex(event => event.id === draft.id);
      if (index < 0) events.push(structuredClone(draft));
      else events[index] = structuredClone(draft);
    }
  }
  if (conflicts.length) throw new ResultConflict(conflicts.sort());
  return candidate;
}
