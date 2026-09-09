import { aiRecordBackendKind, AI_RECORD_STORES, mutateAiRecord, readAllAiRecords } from "./aiRecordDb";
import type { AcceptanceSnapshot, AcceptanceSource } from "./assistantAcceptance";
import type { ProposedCall, RunEndProofState } from "./assistantSession";
import type { ToolVerificationEvidence } from "./toolVerificationEvidence";
import type { WorkPlan } from "./workPlan";
import type { ProjectPersistenceReceipt } from "@/project/store";
import type { Project } from "@/project/types";

import { isRunRuntimeState, type RunRuntimeState } from "./runRecovery";

export const RUN_CHECKPOINT_SCHEMA_VERSION = 1;
const STORE = AI_RECORD_STORES.runCheckpoints;

export interface RunCheckpointKey {
  readonly conversationId: string;
  readonly runId: string;
  readonly epoch: number;
  readonly projectId: string;
  readonly projectContextKey: string;
}

/** Only host-captured facts. A restored receipt is historical data, not a store-issued token. */
export interface RunCheckpoint extends RunCheckpointKey {
  readonly schemaVersion: typeof RUN_CHECKPOINT_SCHEMA_VERSION;
  readonly savedAt: number;
  /** Absent in storage-only v1 rows: those remain transcript-only. */
  readonly runtime?: RunRuntimeState;
  readonly status: "active" | "awaiting-user" | "terminal";
  readonly request: AcceptanceSource;
  readonly baseContentIdentity: string;
  readonly currentContentIdentity: string;
  readonly workPlan: WorkPlan | null;
  readonly budget: {
    readonly remainingToolCalls: number;
    readonly remainingOutputTokens: number;
    readonly remainingAutoRunSteps: number;
    readonly remainingWorkPlanSteps: number;
    readonly ralphAttemptsByItemId: readonly (readonly [string, number])[];
    readonly repeatedToolFailures: readonly (readonly [string, readonly (readonly [string, {
      readonly target: string; readonly count: number; readonly summary: string;
    }])[]])[];
  };
  /** Existing projections, not a lossless ledger import and never new proof authority. */
  readonly verification: ReturnType<ToolVerificationEvidence["snapshot"]>;
  readonly acceptance: AcceptanceSnapshot | null;
  readonly applied: {
    readonly operationId: string;
    readonly contentIdentity: string;
    readonly commitId: string | null;
    readonly calls: readonly ProposedCall[];
  } | null;
  readonly save: ProjectPersistenceReceipt | null;
  readonly proof: RunEndProofState | null;
  /** One unresolved operation embedded in its row; null after settlement, no side-store blobs. */
  readonly pending: {
    readonly operationId: string;
    readonly stage: "proposal-ready" | "applying" | "saving" | "proving";
    readonly proposal: {
      readonly baseContentIdentity: string;
      readonly contentIdentity: string;
      readonly project: Project;
      readonly calls: readonly ProposedCall[];
    } | null;
  } | null;
}

export type RunCheckpointUnsupportedReason = "schema-version" | "malformed" | "identity-mismatch";
export type RunCheckpointRead = { readonly durable: boolean } & (
  | { readonly kind: "missing" }
  | { readonly kind: "found"; readonly checkpoint: RunCheckpoint }
  | { readonly kind: "unsupported"; readonly reason: RunCheckpointUnsupportedReason });

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const oneOf = (value: unknown, values: readonly string[]): boolean => typeof value === "string" && values.includes(value);

/** IDB supports undefined optional fields; reject functions, cycles and non-data objects on both backends. */
function dataOnly(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const valid = Reflect.ownKeys(value).every(key => typeof key === "string"
    && (Array.isArray(value) && key === "length" || (() => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor && dataOnly(descriptor.value, ancestors);
    })()));
  ancestors.delete(value);
  return valid;
}

function validKey(value: unknown): value is RunCheckpointKey {
  return record(value) && text(value.conversationId) && text(value.runId) && count(value.epoch)
    && text(value.projectId) && text(value.projectContextKey);
}

/** Project is deliberately outside the key: a foreign project must be rejected, not silently selected. */
export function runCheckpointId(key: RunCheckpointKey): string {
  if (!validKey(key)) throw new TypeError("Invalid checkpoint identity");
  return JSON.stringify([key.conversationId, key.runId, key.epoch]);
}

function source(value: unknown): boolean {
  if (!record(value) || !text(value.requestId) || typeof value.text !== "string") return false;
  if (value.scope === null) return true;
  if (!record(value.scope) || !text(value.scope.mapId) || !record(value.scope.region)) return false;
  const region = value.scope.region;
  return count(region.x) && count(region.y) && count(region.width) && region.width > 0 && count(region.height) && region.height > 0;
}

function workPlan(value: unknown): boolean {
  if (value === null) return true;
  if (!record(value) || !text(value.id) || typeof value.goal !== "string" || !text(value.createdAt)
    || !count(value.currentLayerIndex) || !(value.currentItemId === null || text(value.currentItemId)) || !Array.isArray(value.layers)) return false;
  const items: Record<string, unknown>[] = [];
  if (!value.layers.every(layer => record(layer) && text(layer.id) && typeof layer.title === "string"
    && Array.isArray(layer.items) && layer.items.every(item => {
      if (!record(item) || !text(item.id) || typeof item.title !== "string" || typeof item.instruction !== "string"
        || !oneOf(item.status, ["pending", "in_progress", "done", "skipped", "blocked"])) return false;
      items.push(item); return true;
    }))) return false;
  return (value.currentItemId === null || items.some(item => item.id === value.currentItemId))
    && [value.requirements, value.acceptance].every(promises => promises === undefined || Array.isArray(promises)
      && promises.every(promise => record(promise) && text(promise.id) && typeof promise.title === "string"
        && (promise.criteria === null || Array.isArray(promise.criteria))));
}

function calls(value: unknown): boolean {
  return Array.isArray(value) && value.every(call => record(call) && text(call.name) && record(call.args)
    && typeof call.summary === "string" && record(call.result) && typeof call.result.ok === "boolean" && typeof call.destructive === "boolean");
}

function receipt(value: unknown, projectId: string): boolean {
  return record(value) && value.projectId === projectId && text(value.revisionId)
    && count(value.mutationGeneration) && text(value.contentIdentity) && (value.sha256 === undefined || text(value.sha256));
}

function validPayload(value: Record<string, unknown>): boolean {
  if (!validKey(value) || !count(value.savedAt) || !oneOf(value.status, ["active", "awaiting-user", "terminal"])
    || !source(value.request) || !text(value.baseContentIdentity) || !text(value.currentContentIdentity) || !workPlan(value.workPlan)) return false;
  if (value.runtime !== undefined && !isRunRuntimeState(value.runtime)) return false;
  const budget = value.budget;
  if (!record(budget) || ![budget.remainingToolCalls, budget.remainingOutputTokens, budget.remainingAutoRunSteps, budget.remainingWorkPlanSteps].every(count)
    || !Array.isArray(budget.ralphAttemptsByItemId) || !budget.ralphAttemptsByItemId.every(entry => Array.isArray(entry) && entry.length === 2 && text(entry[0]) && count(entry[1]))
    || !Array.isArray(budget.repeatedToolFailures) || !budget.repeatedToolFailures.every(entry => Array.isArray(entry) && entry.length === 2 && text(entry[0])
      && Array.isArray(entry[1]) && entry[1].every(failure => Array.isArray(failure) && failure.length === 2 && text(failure[0]) && record(failure[1])
        && typeof failure[1].target === "string" && count(failure[1].count) && typeof failure[1].summary === "string"))) return false;
  const verification = value.verification;
  if (!record(verification) || ![verification.requirements, verification.findings, verification.attempts, verification.approaches, verification.resolutions]
    .every(entries => Array.isArray(entries) && entries.every(record))) return false;
  if (value.acceptance !== null && (!record(value.acceptance) || !text(value.acceptance.id) || typeof value.acceptance.goal !== "string"
    || !oneOf(value.acceptance.status, ["pending", "working", "verifying", "verified", "blocked"]) || !Array.isArray(value.acceptance.items))) return false;
  if (value.applied !== null && (!record(value.applied) || !text(value.applied.operationId) || !text(value.applied.contentIdentity)
    || !(value.applied.commitId === null || text(value.applied.commitId)) || !calls(value.applied.calls))) return false;
  if (value.save !== null && !receipt(value.save, value.projectId)) return false;
  if (value.proof !== null) {
    const proof = value.proof;
    if (!record(proof) || !oneOf(proof.status, ["attempted", "failed", "succeeded"]) || typeof proof.verified !== "boolean"
      || (proof.receipt !== undefined && !receipt(proof.receipt, value.projectId))) return false;
    if (proof.proof !== undefined && (!record(proof.proof) || !receipt(proof.proof.receipt, value.projectId)
      || !oneOf(proof.proof.kind, ["verified", "mismatch", "disabled", "cancelled", "failed"]))) return false;
    if (proof.verified && (proof.status !== "succeeded" || !record(proof.receipt) || !record(value.save)
      || proof.receipt.revisionId !== value.save.revisionId || proof.receipt.contentIdentity !== value.save.contentIdentity)) return false;
  }
  if (value.pending !== null) {
    const pending = value.pending;
    if (value.status === "terminal" || !record(pending) || !text(pending.operationId)
      || !oneOf(pending.stage, ["proposal-ready", "applying", "saving", "proving"])) return false;
    if (pending.proposal === null) return pending.stage === "saving" || pending.stage === "proving";
    const proposal = pending.proposal;
    if (!record(proposal) || !text(proposal.baseContentIdentity) || !text(proposal.contentIdentity)
      || !calls(proposal.calls)) return false;
    // 초안 바이트는 **적용 대기(applying)** 에서만 필요하다 — 거기서만 재개가 그 내용을 쓴다.
    // proposal-ready 는 항상 재조정으로 가므로 바이트를 싣지 않는다. 쓰지 못할 것을 쓰기마다
    // 복제하면 저작 왕복이 느려진다(2026-09-09 실측: 사건 캡처 한 줄이 30초).
    if (pending.stage === "applying") {
      if (!record(proposal.project) || !record(proposal.project.meta) || !record(proposal.project.maps)) return false;
    } else if (proposal.project !== undefined) {
      if (!record(proposal.project) || !record(proposal.project.meta) || !record(proposal.project.maps)) return false;
    }
  }
  return true;
}

function invalid(value: unknown, key: RunCheckpointKey): RunCheckpointUnsupportedReason | null {
  if (!record(value)) return "malformed";
  if (typeof value.schemaVersion === "number" && Number.isSafeInteger(value.schemaVersion) && value.schemaVersion > 0
    && value.schemaVersion !== RUN_CHECKPOINT_SCHEMA_VERSION) return "schema-version";
  if (value.schemaVersion !== RUN_CHECKPOINT_SCHEMA_VERSION || !dataOnly(value)
    || Object.keys(value).some(field => !["id", "schemaVersion", "conversationId", "runId", "epoch", "projectId", "projectContextKey", "savedAt", "status",
      "request", "baseContentIdentity", "currentContentIdentity", "workPlan", "budget", "verification", "acceptance", "applied", "save", "proof", "pending", "runtime"].includes(field))
    || !validPayload(value)) return "malformed";
  if (value.id !== runCheckpointId(key) || value.conversationId !== key.conversationId || value.runId !== key.runId || value.epoch !== key.epoch
    || value.projectId !== key.projectId || value.projectContextKey !== key.projectContextKey) return "identity-mismatch";
  return null;
}

export async function readRunCheckpoint(key: RunCheckpointKey): Promise<RunCheckpointRead> {
  const expected = { ...key };
  const id = runCheckpointId(expected);
  let checkpoint: RunCheckpoint | undefined;
  let reason: RunCheckpointUnsupportedReason | undefined;
  const outcome = await mutateAiRecord(STORE, id, current => {
    if (current === null) return undefined;
    reason = invalid(current, expected) ?? undefined;
    if (!reason) checkpoint = structuredClone(current) as RunCheckpoint;
    return undefined;
  });
  const durable = outcome.backend === "indexeddb";
  if (checkpoint) return { kind: "found", checkpoint, durable };
  if (reason) return { kind: "unsupported", reason, durable };
  return { kind: "missing", durable };
}

/** Same run/epoch replaces the whole row atomically; stale or terminal-to-active writes never win. */
export async function saveRunCheckpoint(checkpoint: RunCheckpoint): Promise<{ readonly durable: boolean; readonly written: boolean }> {
  const id = runCheckpointId(checkpoint);
  const row = { ...checkpoint, id };
  const reason = invalid(row, checkpoint);
  if (reason) {
    // 사유만 던지면 어느 필드가 깨졌는지 알 수 없어 다음 실행이 같은 자리를 다시 헤맨다.
    // 실측(2026-09-09): 실표면에서 malformed 만 남아 원인 추적에 여러 번의 재현이 필요했다.
    const probe: Record<string, unknown> = row;
    const named: readonly (readonly [string, boolean])[] = reason !== "malformed" ? [] : [
      ["key", validKey(probe)], ["savedAt", count(probe.savedAt)],
      ["status", oneOf(probe.status, ["active", "awaiting-user", "terminal"])],
      ["request", source(probe.request)], ["baseContentIdentity", text(probe.baseContentIdentity)],
      ["currentContentIdentity", text(probe.currentContentIdentity)], ["workPlan", workPlan(probe.workPlan)],
      ["runtime", probe.runtime === undefined || isRunRuntimeState(probe.runtime)],
      ["dataOnly", dataOnly(probe)],
      ["acceptance", probe.acceptance === null || (record(probe.acceptance) && text(probe.acceptance.id)
        && typeof probe.acceptance.goal === "string"
        && oneOf(probe.acceptance.status, ["pending", "working", "verifying", "verified", "blocked"])
        && Array.isArray(probe.acceptance.items))],
      ["applied", probe.applied === null || (record(probe.applied) && text(probe.applied.operationId)
        && text(probe.applied.contentIdentity) && (probe.applied.commitId === null || text(probe.applied.commitId))
        && calls(probe.applied.calls))],
      ["save", probe.save === null || receipt(probe.save, String(probe.projectId))],
      ["proof", probe.proof === null || (record(probe.proof)
        && oneOf(probe.proof.status, ["attempted", "failed", "succeeded"]) && typeof probe.proof.verified === "boolean"
        && (probe.proof.receipt === undefined || receipt(probe.proof.receipt, String(probe.projectId))))],
      ["pending", probe.pending === null || (record(probe.pending) && probe.status !== "terminal"
        && text(probe.pending.operationId)
        && oneOf(probe.pending.stage, ["proposal-ready", "applying", "saving", "proving"]))],
    ];
    const field = named.filter(([, ok]) => !ok).map(([name]) => name).join(",");
    throw new TypeError(`Invalid checkpoint: ${reason}${field ? ` (${field})` : ""}`);
  }
  // Capture before any await; caller mutation cannot alter this write on either backend.
  const snapshot = structuredClone(row);
  const result = await mutateAiRecord(STORE, id, current => {
    if (current !== null) {
      const unsupported = invalid(current, snapshot);
      if (unsupported) throw new TypeError(`Existing checkpoint unsupported: ${unsupported}`);
      const previous = current as RunCheckpoint;
      if (previous.savedAt > snapshot.savedAt || previous.status === "terminal" && snapshot.status !== "terminal") return undefined;
    }
    return snapshot;
  });
  return { durable: result.backend === "indexeddb", written: result.written };
}

/** Explicit caller-owned retention policy. Never remove active/awaiting-user/unknown or unresolved rows. */
export async function deleteTerminalRunCheckpointsForConversation(
  conversationId: string, projectContextKey: string,
): Promise<{ readonly durable: boolean; readonly deleted: number }> {
  if (!text(conversationId) || !text(projectContextKey)) throw new TypeError("Invalid checkpoint cleanup identity");
  let deleted = 0;
  const rows = await readAllAiRecords<{ readonly id: string }>(STORE);
  for (const row of rows) {
    if (!record(row) || !validKey(row) || row.conversationId !== conversationId || row.projectContextKey !== projectContextKey) continue;
    const key = row;
    const result = await mutateAiRecord(STORE, row.id, current => {
      if (invalid(current, key) !== null || !record(current) || current.status !== "terminal" || current.pending !== null) return undefined;
      return null;
    });
    if (result.written) deleted++;
  }
  return { durable: await aiRecordBackendKind() === "indexeddb", deleted };
}

/** Select host epoch, never last-completion time. Foreign/ambiguous newest rows block admission. */
export async function readLatestRunCheckpoint(conversationId: string, projectId: string, projectContextKey: string): Promise<RunCheckpointRead> {
  const rows = (await readAllAiRecords<RunCheckpoint & { readonly id: string }>(STORE))
    .filter(row => record(row) && row.conversationId === conversationId);
  const durable = await aiRecordBackendKind() === "indexeddb";
  if (!rows.length) return { kind: "missing", durable };
  if (rows.some(row => !count(row.epoch))) return { kind: "unsupported", reason: "malformed", durable };
  const epoch = Math.max(...rows.map(row => row.epoch));
  const newest = rows.filter(row => row.epoch === epoch);
  const selected = newest[0];
  if (newest.length !== 1 || !selected || !text(selected.runId)) return { kind: "unsupported", reason: "malformed", durable };
  return readRunCheckpoint({ conversationId, projectId, projectContextKey, runId: selected.runId, epoch });
}
