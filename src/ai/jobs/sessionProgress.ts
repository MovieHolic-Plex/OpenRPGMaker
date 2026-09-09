import type { SessionEvent } from "../assistantSessionCore";
import type { WorkPlan, WorkItem } from "../workPlan";
import type { SessionUsageTotals } from "../sessionUsage";
import { assert, requireArray, requireBoolean, requireRecord, requireString } from "@/project/io/guards";

export const SESSION_ACTIVITY_LIMIT = 32;
export const SESSION_SUMMARY_LIMIT = 512;
export const SESSION_PLAN_LIMIT = 131072;
export interface SessionRunBudget {
  turnIndex: number;
  rounds: { used: number; total: number } | null;
  driverContinuations: { used: number; total: number; exhausted: boolean } | null;
}
export interface SessionActivity {
  id: number;
  turnIndex: number;
  index?: number;
  kind: "tool" | "milestone" | "paused";
  name?: string;
  nameTruncated?: boolean;
  ok?: boolean;
  summary: string;
  truncated: boolean;
}
/** Presentation only. Neither this frontier nor the displayed plan may drive execution. */
export interface SessionProgress {
  version: 1;
  revision: number;
  turnIndex: number;
  workPlan: WorkPlan | null;
  workPlanOmitted?: boolean;
  phase: "plan" | "execute" | "review" | null;
  currentTool: { turnIndex: number; index: number; name: string; nameTruncated?: boolean } | null;
  recentActivity: SessionActivity[];
  omittedActivityCount: number;
  budget: Omit<SessionRunBudget, "turnIndex">;
  usage: SessionUsageTotals | null;
  usageOmitted?: boolean;
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const r = requireRecord("session progress", value);
  assert(Object.keys(r).every(key => keys.includes(key)), "Unknown session progress field");
  return r;
}
function integer(value: unknown, minimum = 0): number {
  assert(typeof value === "number" && Number.isSafeInteger(value) && value >= minimum, "Invalid progress count");
  return value;
}
function text(value: unknown, limit = SESSION_SUMMARY_LIMIT): string {
  const s = requireString("progress text", value);
  assert(s.length <= limit, "Oversized progress text");
  return s;
}
function choice<const T extends string>(value: unknown, choices: readonly T[]): T {
  assert(typeof value === "string" && choices.includes(value as T), "Invalid progress enum");
  return value as T;
}
/** Strict full-plan validation; independent of the optional observation projection. */
export function parseWorkPlan(value: unknown): WorkPlan {
  assert(JSON.stringify(value).length <= SESSION_PLAN_LIMIT, "Oversized progress plan");
  const p = record(value, ["id", "goal", "createdAt", "layers", "currentLayerIndex", "currentItemId", "plannerNote", "targetMapId"]);
  const fullText = (v: unknown) => text(v, SESSION_PLAN_LIMIT);
  const layers = requireArray("plan layers", p.layers).map(value => {
    const l = record(value, ["id", "title", "items"]);
    const items = requireArray("plan items", l.items).map(value => {
      const i = record(value, ["id", "title", "instruction", "doneWhen", "successTools", "requiresAnyWrite", "status", "note"]);
      const item: WorkItem = { id: fullText(i.id), title: fullText(i.title), instruction: fullText(i.instruction),
        status: choice(i.status, ["pending", "in_progress", "done", "skipped", "blocked"]) };
      return { ...item, ...(i.doneWhen === undefined ? {} : { doneWhen: fullText(i.doneWhen) }),
        ...(i.note === undefined ? {} : { note: fullText(i.note) }),
        ...(i.successTools === undefined ? {} : { successTools: requireArray("success tools", i.successTools).map(fullText) }),
        ...(i.requiresAnyWrite === undefined ? {} : { requiresAnyWrite: requireBoolean("requiresAnyWrite", i.requiresAnyWrite) }) };
    });
    assert(items.length > 0, "Empty progress layer");
    return { id: fullText(l.id), title: fullText(l.title), items };
  });
  const currentLayerIndex = integer(p.currentLayerIndex);
  assert(layers.length > 0 && currentLayerIndex < layers.length, "Invalid progress plan cursor");
  const currentItemId = p.currentItemId === null ? null : fullText(p.currentItemId);
  assert(currentItemId === null || layers[currentLayerIndex]!.items.some(i => i.id === currentItemId), "Invalid progress item cursor");
  const createdAt = fullText(p.createdAt);
  assert(Number.isFinite(Date.parse(createdAt)), "Invalid progress plan clock");
  return { id: fullText(p.id), goal: fullText(p.goal), createdAt, layers, currentLayerIndex, currentItemId,
    ...(p.plannerNote === undefined ? {} : { plannerNote: fullText(p.plannerNote) }),
    ...(p.targetMapId === undefined ? {} : { targetMapId: fullText(p.targetMapId) }) };
}
function counter(value: unknown): { used: number; total: number } {
  const c = requireRecord("progress budget", value), used = integer(c.used), total = integer(c.total, 1);
  assert(used <= total, "Progress budget exceeded");
  return { used, total };
}
function usage(value: unknown): SessionUsageTotals {
  const keys = ["calls", "promptTokens", "completionTokens", "callsWithoutUsage"];
  const counts = (r: Record<string, unknown>) => {
    const calls = integer(r.calls), callsWithoutUsage = integer(r.callsWithoutUsage);
    assert(callsWithoutUsage <= calls, "Invalid missing usage count");
    return { calls, promptTokens: integer(r.promptTokens), completionTokens: integer(r.completionTokens), callsWithoutUsage };
  };
  const r = record(value, [...keys, "byModel"]);
  const byModel = requireArray("model usage", r.byModel).map(value => {
    const m = record(value, [...keys, "model"]);
    return { model: text(m.model), ...counts(m) };
  });
  assert(byModel.length <= 32 && new Set(byModel.map(m => m.model)).size === byModel.length, "Invalid model usage window");
  const result = { ...counts(r), byModel };
  for (const key of ["calls", "promptTokens", "completionTokens", "callsWithoutUsage"] as const)
    assert(byModel.reduce((sum, m) => sum + m[key], 0) === result[key], "Inconsistent model usage");
  return result;
}
export function parseSessionProgress(value: unknown): SessionProgress {
  const r = record(value, ["version", "revision", "turnIndex", "workPlan", "workPlanOmitted", "phase", "currentTool", "recentActivity", "omittedActivityCount", "budget", "usage", "usageOmitted"]);
  assert(r.version === 1, "Unsupported session progress version");
  const revision = integer(r.revision), turnIndex = integer(r.turnIndex);
  assert(turnIndex <= revision, "Invalid turn frontier");
  const tool = r.currentTool === null ? null : record(r.currentTool, ["turnIndex", "index", "name", "nameTruncated"]);
  const currentTool = tool === null ? null : { turnIndex: integer(tool.turnIndex, 1), index: integer(tool.index, 1), name: text(tool.name),
    ...(tool.nameTruncated === undefined ? {} : { nameTruncated: requireBoolean("nameTruncated", tool.nameTruncated) }) };
  assert(currentTool === null || currentTool.turnIndex === turnIndex, "Invalid current tool turn");
  const recentActivity = requireArray("recent activity", r.recentActivity).map(value => {
    const a = record(value, ["id", "turnIndex", "index", "kind", "name", "nameTruncated", "ok", "summary", "truncated"]);
    const kind = choice(a.kind, ["tool", "milestone", "paused"]);
    const row: SessionActivity = { id: integer(a.id, 1), turnIndex: integer(a.turnIndex, 1), kind,
      summary: text(a.summary), truncated: requireBoolean("truncated", a.truncated),
      ...(a.index === undefined ? {} : { index: integer(a.index, 1) }),
      ...(a.name === undefined ? {} : { name: text(a.name) }),
      ...(a.nameTruncated === undefined ? {} : { nameTruncated: requireBoolean("nameTruncated", a.nameTruncated) }),
      ...(a.ok === undefined ? {} : { ok: requireBoolean("ok", a.ok) }) };
    assert(row.id <= revision && row.turnIndex <= turnIndex, "Invalid activity frontier");
    assert(kind === "tool" ? row.index !== undefined && row.name !== undefined && row.ok !== undefined
      : row.index === undefined && row.name === undefined && row.nameTruncated === undefined && row.ok === undefined, "Invalid activity fields");
    return row;
  });
  assert(recentActivity.length <= SESSION_ACTIVITY_LIMIT && recentActivity.every((row, i) => i === 0 || row.id > recentActivity[i - 1]!.id), "Invalid activity window");
  const omittedActivityCount = integer(r.omittedActivityCount);
  assert(omittedActivityCount + recentActivity.length <= revision, "Invalid omitted activity count");
  const b = record(r.budget, ["rounds", "driverContinuations"]);
  if (b.rounds !== null) record(b.rounds, ["used", "total"]);
  const d = b.driverContinuations === null ? null : record(b.driverContinuations, ["used", "total", "exhausted"]);
  const driverContinuations = d === null ? null : { ...counter(d), exhausted: requireBoolean("exhausted", d.exhausted) };
  assert(driverContinuations === null || driverContinuations.exhausted === (driverContinuations.used === driverContinuations.total), "Invalid exhaustion state");
  const workPlan = r.workPlan === null ? null : parseWorkPlan(r.workPlan);
  const workPlanOmitted = r.workPlanOmitted === undefined ? undefined : requireBoolean("workPlanOmitted", r.workPlanOmitted);
  assert(!workPlanOmitted || workPlan === null, "Omitted plan must be null");
  const usageOmitted = r.usageOmitted === undefined ? undefined : requireBoolean("usageOmitted", r.usageOmitted);
  assert(!usageOmitted || r.usage === null, "Omitted usage must be null");
  return { version: 1, revision, turnIndex, workPlan, ...(workPlanOmitted === undefined ? {} : { workPlanOmitted }),
    phase: r.phase === null ? null : choice(r.phase, ["plan", "execute", "review"]), currentTool, recentActivity,
    omittedActivityCount, budget: { rounds: b.rounds === null ? null : counter(b.rounds), driverContinuations },
    usage: r.usage === null ? null : usage(r.usage), ...(usageOmitted === undefined ? {} : { usageOmitted }) };
}
function emptyProgress(): SessionProgress {
  return { version: 1, revision: 0, turnIndex: 0, workPlan: null, phase: null, currentTool: null,
    recentActivity: [], omittedActivityCount: 0, budget: { rounds: null, driverContinuations: null }, usage: null };
}
/** Reconstruct observations from the same session, never inject them into it. Until the
 * deterministic semantic frontier is reached, retain the last durable presentation.
 * Status/error/recap prose and tokens are deliberately not frontier events: a transient
 * failed provider acknowledgement is not reproduced when its paid response is replayed. */
export function createSessionProgressObserver(previous?: SessionProgress) {
  const current = emptyProgress();
  const frontier = previous?.revision ?? 0;
  // Session-handled completion can run nested verification tools before its own
  // tool_call event. Preserve the parent's ordinal without persisting a call stack.
  const started: NonNullable<SessionProgress["currentTool"]>[] = [];
  const append = (row: Omit<SessionActivity, "id" | "turnIndex" | "truncated">) => {
    current.recentActivity.push({ ...row, id: current.revision, turnIndex: current.turnIndex,
      summary: row.summary.slice(0, SESSION_SUMMARY_LIMIT), truncated: row.summary.length > SESSION_SUMMARY_LIMIT });
    if (current.recentActivity.length > SESSION_ACTIVITY_LIMIT) { current.recentActivity.shift(); current.omittedActivityCount++; }
  };
  return {
    reconstructing: () => current.revision < frontier,
    observe(event: SessionEvent): void {
      switch (event.type) {
        case "run_budget": {
          const budget = { rounds: event.rounds, driverContinuations: event.driverContinuations };
          if (event.turnIndex === current.turnIndex && JSON.stringify(budget) === JSON.stringify(current.budget)) return;
          current.revision++;
          if (event.turnIndex !== current.turnIndex) { started.length = 0; current.currentTool = null; current.phase = null; }
          current.turnIndex = event.turnIndex; current.budget = structuredClone(budget); break;
        }
        case "work_plan": {
          const omitted = JSON.stringify(event.plan).length > SESSION_PLAN_LIMIT;
          const next = omitted ? null : structuredClone(event.plan);
          if (JSON.stringify(next) === JSON.stringify(current.workPlan) && omitted === (current.workPlanOmitted ?? false)) return;
          current.revision++; current.workPlan = next;
          if (omitted) current.workPlanOmitted = true; else delete current.workPlanOmitted;
          break;
        }
        case "phase":
          if (current.phase === event.value) return;
          current.revision++; current.phase = event.value; break;
        case "tool_started":
          current.revision++;
          current.currentTool = { turnIndex: current.turnIndex, index: event.index, name: event.name.slice(0, SESSION_SUMMARY_LIMIT),
            ...(event.name.length > SESSION_SUMMARY_LIMIT ? { nameTruncated: true } : {}) };
          started.push(current.currentTool);
          break;
        case "tool_call": {
          current.revision++;
          const tool = started.pop()!;
          append({ kind: "tool", index: tool.index, name: tool.name, ...(tool.nameTruncated ? { nameTruncated: true } : {}), ok: event.result.ok, summary: event.result.summary });
          current.currentTool = started.at(-1) ?? null; break;
        }
        case "milestone_checkpointed":
          current.revision++; append({ kind: "milestone", summary: event.title }); break;
        case "proposal_paused":
          current.revision++; append({ kind: "paused", summary: event.reason }); break;
      }
    },
    snapshot(sample?: SessionUsageTotals): SessionProgress {
      if (current.revision < frontier) return structuredClone(previous!);
      if (sample) {
        const omitted = sample.byModel.length > 32 || sample.byModel.some(m => m.model.length > SESSION_SUMMARY_LIMIT);
        current.usage = omitted ? null : structuredClone(sample);
        if (omitted) current.usageOmitted = true; else delete current.usageOmitted;
      }
      return structuredClone(current);
    },
  };
}
