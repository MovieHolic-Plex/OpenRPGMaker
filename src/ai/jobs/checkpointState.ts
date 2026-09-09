import { requireRecord, requireArray, requireString, requireNumber, requireBoolean, assert } from "@/project/io/guards";
import { deserialize } from "@/project/io/serialize";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { BlobRef, JsonObject, JsonValue } from "./contracts";
import { enumValue } from "./assistantPayload";
import { parseSessionProgress, type SessionProgress } from "./sessionProgress";

export interface ProjectDelta { path: string[]; value?: JsonValue }
export interface RecordedTool { name: string; args: string; delta: ProjectDelta[]; result: ToolResult }
export interface SessionJobState {
  startedAt: string;
  tools: RecordedTool[];
  toolRefs?: BlobRef[];
  draft: Project;
  progress?: SessionProgress;
  completed?: { turn: JsonObject; generatedSnapshot: BlobRef; artifacts?: BlobRef[] };
  partial?: { reason: string; turn: JsonObject };
}
function parseJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") { assert(Number.isFinite(value), "Non-finite JSON number"); return value; }
  if (Array.isArray(value)) return value.map(parseJson);
  const r = requireRecord("JSON object", value);
  return Object.fromEntries(Object.entries(r).map(([key, item]) => [key, parseJson(item)]));
}
/** Strip optional undefined fields only on owned in-memory values, then validate lossless wire JSON. */
export function jsonValue(value: unknown): JsonValue { return parseJson(JSON.parse(JSON.stringify(value))); }
export function jsonObject(value: unknown): JsonObject {
  const parsed = parseJson(value);
  assert(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed), "Expected JSON object");
  return requireJsonObject(parsed);
}
function requireJsonObject(value: JsonValue): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return Object.fromEntries(Object.entries(value));
  throw new Error("Expected JSON object");
}
export function parseProject(value: unknown): Project { return deserialize(JSON.stringify(value)); }
function strings(value: unknown): string[] { return requireArray("strings", value).map(v => requireString("string", v)); }
function parseRef(value: unknown): BlobRef {
  const r = requireRecord("blob reference", value); const sha256 = requireString("sha256", r.sha256);
  const byteLength = requireNumber("byteLength", r.byteLength);
  assert(/^[a-f0-9]{64}$/.test(sha256) && Number.isSafeInteger(byteLength) && byteLength >= 0, "Invalid blob reference");
  const mediaType = requireString("mediaType", r.mediaType); assert(mediaType === "application/json", "Checkpoint blobs must be JSON");
  return { sha256, byteLength, mediaType };
}
function validateToolResult(value: unknown): asserts value is ToolResult {
  const r = requireRecord("tool result", value);
  requireBoolean("ok", r.ok); requireString("summary", r.summary);
  if (r.diff !== undefined) {
    const d = requireRecord("tool diff", r.diff);
    for (const key of ["tilesChanged", "eventsAdded", "eventsModified", "eventsRemoved", "mapsAdded", "mapsRemoved", "dbRecordsChanged",
      "tilesetsChanged", "switchesAdded", "variablesAdded", "worldEntitiesAdded", "worldEntitiesModified", "palettePresetsAdded",
      "palettePresetsModified", "endingsChanged"]) requireNumber(key, d[key]);
    if (d.mapPropertiesChanged !== undefined) requireNumber("mapPropertiesChanged", d.mapPropertiesChanged);
    requireBoolean("sessionChanged", d.sessionChanged); requireBoolean("systemChanged", d.systemChanged); strings(d.warnings);
  }
  if (r.warnings !== undefined) strings(r.warnings);
  if (r.issues !== undefined) for (const value of requireArray("issues", r.issues)) {
    const i = requireRecord("issue", value);
    enumValue(i.severity, ["error", "warning"]); requireString("code", i.code); requireString("message", i.message);
    if (i.mapId !== undefined) requireString("mapId", i.mapId);
    if (i.x !== undefined) requireNumber("x", i.x);
    if (i.y !== undefined) requireNumber("y", i.y);
  }
}
function recordedTool(value: unknown): RecordedTool {
  const r = requireRecord("recorded tool", value);
  const args = requireString("args", r.args); requireRecord("tool args", JSON.parse(args));
  const delta = requireArray("project delta", r.delta).map(value => {
    const d = requireRecord("delta", value); const path = strings(d.path);
    assert(path.length > 0 && path.every(k => !["__proto__", "constructor", "prototype"].includes(k)), "Invalid delta path");
    return d.value === undefined ? { path } : { path, value: parseJson(d.value) };
  });
  const result = r.result;
  validateToolResult(result);
  // Tool results become JSON strings inside provider messages. Reconstructing their
  // objects in schema order changes those bytes (notably diff.mapPropertiesChanged)
  // and breaks the durable operation's identical-request contract on replay.
  return { name: requireString("tool name", r.name), args, delta, result: structuredClone(result) };
}
export async function parseSessionJobState(value: unknown, host: AiJobHost): Promise<SessionJobState> {
  const r = requireRecord("session checkpoint", value);
  assert(r.version === 1, "Unsupported session checkpoint version");
  const startedAt = requireString("startedAt", r.startedAt); assert(Number.isFinite(Date.parse(startedAt)), "Invalid checkpoint clock");
  const toolRefs = requireArray("toolRefs", r.toolRefs).map(parseRef);
  const draft = parseProject(await host.readJson(parseRef(r.draftRef)));
  const tools = await Promise.all(toolRefs.map(async ref => recordedTool(await host.readJson(ref))));
  let completed: SessionJobState["completed"];
  if (r.completed !== undefined) {
    const c = requireRecord("completed checkpoint", r.completed);
    const turn = jsonObject(c.turn); assert(turn.stoppedReason === "final", "Invalid completed turn");
    completed = { turn, generatedSnapshot: parseRef(c.generatedSnapshot),
      ...(c.artifacts === undefined ? {} : { artifacts: requireArray("completed artifacts", c.artifacts).map(value => {
        const ref = requireRecord("completed artifact", value);
        assert(Object.keys(ref).every(key => ["sha256", "byteLength", "mediaType"].includes(key)), "Unexpected completed artifact field");
        return parseRef(ref);
      }) }) };
  }
  let partial: SessionJobState["partial"];
  if (r.partial !== undefined) { const p = requireRecord("partial checkpoint", r.partial); partial = { reason: requireString("reason", p.reason), turn: jsonObject(p.turn) }; }
  assert(!(completed && partial), "Checkpoint cannot be both complete and partial");
  return { startedAt, tools, toolRefs, draft, completed, partial,
    ...(r.progress === undefined ? {} : { progress: parseSessionProgress(r.progress) }) };
}
/** Objects recurse, changed arrays are atomic. Unchanged/read-only projects retain no draft copy. */
export function projectDelta(before: Project, after: Project): ProjectDelta[] {
  if (before === after) return [];
  const changes: ProjectDelta[] = [];
  function walk(a: JsonValue, b: JsonValue, path: string[]): void {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const left = requireJsonObject(a), right = requireJsonObject(b);
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (!(key in right)) changes.push({ path: [...path, key] });
        else if (!(key in left)) changes.push({ path: [...path, key], value: right[key] });
        else walk(left[key]!, right[key]!, [...path, key]);
      }
    } else changes.push({ path, value: b });
  }
  walk(jsonValue(before), jsonValue(after), []); return changes;
}
export function applyProjectDelta(project: Project, delta: readonly ProjectDelta[]): Project {
  if (delta.length === 0) return project;
  const result = structuredClone(project);
  for (const change of delta) {
    let target = requireRecord("project", result);
    for (const key of change.path.slice(0, -1)) target = requireRecord("delta parent", target[key]);
    const key = change.path.at(-1)!;
    if (change.value === undefined) delete target[key];
    else Object.defineProperty(target, key, { value: structuredClone(change.value), writable: true, enumerable: true, configurable: true });
  }
  // Validate replayed structure, but retain exact authored fields instead of applying
  // load-time normalization a second time (e.g. explicit default title graphics).
  parseProject(result);
  return result;
}
