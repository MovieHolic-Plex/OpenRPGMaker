import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import type { Project } from "@/project/types";
import { sha256HexText } from "@/util/sha256";
import { parseContextFooter } from "../contextFooter";
import { RESTORED_TRANSCRIPT_MAX_CHARS, serializeAuditTranscript } from "../conversationReplay";
import type { AuditEntry } from "../assistantSessionCore";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { PlanOnlyContinuation, PlanOnlyGoalState } from "../planOnlyContinuation";
import type { VolumeSnapshot } from "../volumeContract";
import type { WorkPlan } from "../workPlan";
import { parseAssistantPayload, type AssistantJobPayload } from "./assistantPayload";
import { canonicalJson } from "./resultPatch";
import { jsonValue, parseProject } from "./checkpointState";
import { parseWorkPlan, SESSION_PLAN_LIMIT } from "./sessionProgress";
import type { AiJobInput, BlobRef, JsonObject } from "./contracts";

export interface AssistantContinuationState extends PlanOnlyGoalState {
  version: 1;
  kind: "plan-only";
  inputRef: BlobRef;
  /** Source-owned bounded conversation context, including inherited clean planning turns. */
  history?: string;
}
function shape(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const r = requireRecord("continuation state", value);
  assert(Object.keys(r).every(key => keys.includes(key)), "Unexpected continuation field");
  return r;
}
function count(value: unknown): number {
  const n = requireNumber("continuation count", value);
  assert(Number.isSafeInteger(n) && n >= 0, "Invalid continuation count"); return n;
}
function volume(value: unknown): VolumeSnapshot {
  const r = shape(value, ["authoredMaps", "multiPageNpcs", "shops", "quests"]);
  return { authoredMaps: count(r.authoredMaps), multiPageNpcs: count(r.multiPageNpcs), shops: count(r.shops), quests: count(r.quests) };
}
function blob(value: unknown): BlobRef {
  const r = shape(value, ["sha256", "byteLength", "mediaType"]);
  const sha256 = requireString("continuation input hash", r.sha256), byteLength = count(r.byteLength);
  assert(/^[a-f0-9]{64}$/.test(sha256) && r.mediaType === "application/json", "Invalid continuation input reference");
  return { sha256, byteLength, mediaType: "application/json" };
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
/** Ineligible authored plans remain valid output, but do not advertise restoration support. */
export function canContinuePlan(plan: WorkPlan): boolean {
  const items = plan.layers.flatMap(layer => layer.items);
  return JSON.stringify(plan).length <= SESSION_PLAN_LIMIT && plan.currentItemId !== null
    && plan.id.trim().length > 0 && plan.goal.trim().length > 0
    && plan.layers.every(layer => layer.id.trim().length > 0 && layer.title.trim().length > 0)
    && items.every(item => item.id.trim().length > 0 && item.title.trim().length > 0 && item.instruction.trim().length > 0
      && (item.status === "pending" || item.status === "in_progress"))
    && items.filter(item => item.status === "in_progress").length === 1
    && plan.layers[plan.currentLayerIndex]?.items.some(item => item.id === plan.currentItemId && item.status === "in_progress") === true
    && new Set(plan.layers.map(layer => layer.id)).size === plan.layers.length
    && new Set(items.map(item => item.id)).size === items.length;
}
export function createContinuationHistory(priorTranscript: string | undefined, instruction: string, assistantText: string): string {
  const entries: AuditEntry[] = [{ kind: "user", text: instruction }, { kind: "assistant", text: assistantText }];
  if (priorTranscript) entries.unshift({ kind: "user", text: priorTranscript });
  // Reuse the existing newest-entry retention policy. Its omission notice may add
  // characters beyond the requested budget; clamp the final text to the same bound.
  return serializeAuditTranscript(entries, RESTORED_TRANSCRIPT_MAX_CHARS).slice(-RESTORED_TRANSCRIPT_MAX_CHARS);
}
export function parseAssistantContinuationState(value: unknown): AssistantContinuationState {
  const r = shape(value, ["version", "kind", "inputRef", "readBeforeWrite", "adventure", "volume", "history"]);
  assert(r.version === 1 && r.kind === "plan-only", "Unsupported continuation state");
  const read = r.readBeforeWrite === null ? null : shape(r.readBeforeWrite, ["project", "collections", "references"]);
  const adventure = r.adventure === null ? null : shape(r.adventure, ["village", "dungeon", "party", "battle"]);
  const v = r.volume === null ? null : shape(r.volume, ["baseline", "minimum"]);
  const history = r.history === undefined ? undefined : requireString("continuation history", r.history);
  assert(history === undefined || history.length <= RESTORED_TRANSCRIPT_MAX_CHARS, "Oversized continuation history");
  return { version: 1, kind: "plan-only", inputRef: blob(r.inputRef), ...(history === undefined ? {} : { history }),
    readBeforeWrite: read === null ? null : { project: requireBoolean("read project", read.project), references: requireBoolean("read references", read.references),
      collections: requireArray("read collections", read.collections).map(value => requireString("read collection", value)) },
    adventure: adventure === null ? null : { village: requireBoolean("village", adventure.village), dungeon: requireBoolean("dungeon", adventure.dungeon),
      party: requireBoolean("party", adventure.party), battle: requireBoolean("battle", adventure.battle) },
    volume: v === null ? null : { baseline: volume(v.baseline), minimum: volume(v.minimum) } };
}
/** Validate both freshly retained output and completed-checkpoint restoration. */
export function continuationOutput(turn: JsonObject): { state: AssistantContinuationState; plan: WorkPlan } | null {
  if (turn.continuationState === undefined) return null;
  const state = parseAssistantContinuationState(turn.continuationState), plan = parseWorkPlan(turn.workPlan);
  assert(turn.stoppedReason === "final" && turn.completion === "complete" && canContinuePlan(plan)
    && requireArray("plan-only proposals", turn.proposedCalls).length === 0
    && (turn.appliedCalls === undefined || requireArray("plan-only applied calls", turn.appliedCalls).length === 0), "Invalid clean planning boundary");
  return { state, plan };
}
function validateTarget(project: Project, mapId: string | undefined): void {
  if (mapId !== undefined) assert(project.maps[mapId] !== undefined, "Continuation target is unavailable in current snapshot");
}
export async function resolveAssistantContinuation(input: AiJobInput & { family: "assistant" }, payload: AssistantJobPayload, baseline: Project, host: AiJobHost): Promise<{
  seed: PlanOnlyContinuation; priorTranscript: string;
} | null> {
  const binding = payload.continuation;
  if (!binding) return null;
  assert(input.dependsOn.length === 1 && input.dependsOn[0] === binding.sourceJobId, "Continuation requires its exact dependency");
  const source = host.dependencies.find(result => result.jobId === binding.sourceJobId);
  assert(source !== undefined && source.family === "assistant" && same(source.project, input.project), "Continuation predecessor identity mismatch");
  assert(await sha256HexText(canonicalJson(source)) === binding.resultSha256, "Continuation result hash mismatch");
  const retained = continuationOutput(source.payload);
  assert(retained !== null && source.generatedSnapshot !== null, "CONTINUATION_UNAVAILABLE");
  const { state, plan } = retained;
  assert(source.artifacts.some(ref => same(ref, state.inputRef)), "Continuation input is outside source manifest");
  const original = requireRecord("continuation source input", await host.readJson(state.inputRef));
  assert(original.version === 1 && original.family === "assistant" && same(original.project, input.project)
    && same(original.projectSnapshot, source.baseSnapshot), "Continuation source input identity mismatch");
  const originalPayload = parseAssistantPayload(original.payload);
  assert(same(jsonValue(originalPayload.config), jsonValue(payload.config)) && originalPayload.domain === payload.domain
    && originalPayload.context.budgetChars === payload.context.budgetChars
    && originalPayload.context.preferenceMemorySection === payload.context.preferenceMemorySection, "Continuation captured provider/settings mismatch");
  assert(payload.priorTranscript === undefined, "Continuation history is owned by its source");
  // No source draft is transplanted. Reading it only establishes that the declared clean
  // planning boundary did not already execute a project change.
  const [base, generated] = await Promise.all([host.readJson(source.baseSnapshot), host.readJson(source.generatedSnapshot)]);
  assert(same(jsonValue(parseProject(base)), jsonValue(parseProject(generated))), "Continuation source contains project changes");
  validateTarget(baseline, plan.targetMapId);
  validateTarget(baseline, payload.context.currentMapId);
  if (input.target.mapId !== undefined) validateTarget(baseline, requireString("target map", input.target.mapId));
  const selection = payload.selection;
  const scope = payload.turn?.scope;
  // The session executes implicitSpecFromContext(text) before structured scope.
  // Validate that recognized footer authority too; do not change foreground precedence.
  const footer = parseContextFooter(payload.instruction);
  const footerScope = footer?.mapId && footer.selection ? { mapId: footer.mapId, x: footer.selection.x, y: footer.selection.y,
    width: footer.selection.w, height: footer.selection.h } : undefined;
  for (const rect of [selection, scope ? { mapId: scope.mapId, ...scope.region } : undefined, footerScope]) {
    if (!rect) continue;
    const map = baseline.maps[rect.mapId];
    assert(map !== undefined, "Continuation target is unavailable in current snapshot");
    assert([rect.x, rect.y, rect.width, rect.height].every(Number.isSafeInteger) && rect.x >= 0 && rect.y >= 0
      && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= map.width && rect.y + rect.height <= map.height, "Continuation scope is outside current snapshot");
    assert(plan.targetMapId === undefined || plan.targetMapId === rect.mapId, "Continuation scope conflicts with plan target");
  }
  const assistantText = requireString("source assistant text", source.payload.assistantText);
  // A legacy first-level source can derive its complete context from its own input.
  // A legacy bound source without retained history cannot recover ancestors safely.
  assert(state.history !== undefined || originalPayload.continuation === undefined, "CONTINUATION_HISTORY_UNAVAILABLE");
  return { seed: { workPlan: plan, readBeforeWrite: state.readBeforeWrite, adventure: state.adventure, volume: state.volume },
    priorTranscript: state.history ?? createContinuationHistory(originalPayload.priorTranscript, originalPayload.instruction, assistantText) };
}
