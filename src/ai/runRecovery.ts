import type { Project } from "@/project/types";
import { deserialize, serializeForComparison } from "@/project/io";
import { acceptanceRecord, parseAcceptanceCriteriaResult } from "./assistantAcceptance";
import { verificationInput } from "./toolVerificationEvidence";
import type { AcceptanceRecoveryState } from "./assistantAcceptanceLedger";
import type { VerificationRecoveryState } from "./toolVerificationEvidence";
import type { ComposerMode } from "./composerMode";
import type { BuildSpec } from "./buildSpec";
import type { OriginalContext } from "./originalContext";
import type { AdventureRequirements } from "./adventureCompletion";
import type { NpcRewardRequirements } from "./intentDeclaration";
import type { VolumeSnapshot, VolumeBar } from "./volumeContract";
import type { RunCheckpoint, RunCheckpointRead } from "./runCheckpointStore";
import type { RunOutcome } from "./runOutcome";

/** The existing session's goal/authoring state. No messages, functions, review or image capabilities. */
export interface RunRuntimeState {
  readonly schemaVersion: 1;
  readonly instruction: string;
  readonly requestText: string;
  readonly composerMode: ComposerMode;
  readonly autonomous: boolean;
  readonly execution: RunOutcome["execution"];
  /**
   * 이 요청의 원본 기준선. 수락 원장이 있으면 같은 프로젝트를 원장이 이미 보관하므로
   * 생략하고 그쪽을 쓴다 — 한 행에 같은 프로젝트를 두 벌 실으면 쓰기마다 그만큼 복제·검증한다.
   */
  readonly requestBaseline?: Project;
  readonly acceptance: AcceptanceRecoveryState | null;
  readonly verification: VerificationRecoveryState;
  readonly verificationOwnerSequence: number;
  readonly verificationOwners: readonly (readonly [string, string, readonly string[]])[];
  readonly currentTurnIndex: number;
  readonly specs: readonly (readonly [string, { readonly spec: BuildSpec; readonly turnIndex: number }])[];
  readonly latestSpecMapId: string | null;
  readonly implicitSpec: BuildSpec | null;
  readonly viewSpec: BuildSpec | null;
  readonly viewSpecWorkItemId: string | null;
  readonly originalContext: OriginalContext | null;
  readonly adventureRequirements?: AdventureRequirements;
  readonly npcRewardRequirements?: NpcRewardRequirements;
  readonly statefulNpcRequirement: boolean;
  readonly npcRewardItemBaselines: readonly (readonly [string, string])[];
  readonly volumeBaseline: VolumeSnapshot | null;
  readonly volumeBar: VolumeBar | null;
  readonly volumeContinueUsed: number;
  readonly acceptanceRepairAttempts: number;
  readonly reviewAttempts: number;
  readonly lastBlockReasons: readonly (readonly [string, string])[];
  readonly roundLimit: number;
  readonly outputLimit: number;
}

const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const pairs = (value: unknown): boolean => Array.isArray(value) && value.every(entry => Array.isArray(entry)
  && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string");
function source(value: unknown): boolean {
  if (!acceptanceRecord(value) || !text(value.requestId) || typeof value.text !== "string") return false;
  if (value.scope === null) return true;
  if (!acceptanceRecord(value.scope) || !text(value.scope.mapId) || !acceptanceRecord(value.scope.region)) return false;
  const region = value.scope.region;
  return [region.x, region.y, region.width, region.height].every(count) && Number(region.width) > 0 && Number(region.height) > 0;
}
/** JSON is a system boundary; malformed contracts never reach a live session. */
export function isRunRuntimeState(value: unknown): value is RunRuntimeState {
  // Different ledger owners can retain byte-identical original projects. Validate each
  // distinct payload once in this call only; a later read or mutation is always revalidated.
  const projects = new Set<string>();
  function project(value: unknown): boolean {
    try {
      const raw = JSON.stringify(value);
      if (!projects.has(raw)) { deserialize(raw); projects.add(raw); }
      return true;
    } catch { return false; }
  }
  function promise(value: unknown): boolean {
    return acceptanceRecord(value) && text(value.id) && typeof value.title === "string" && project(value.baseline)
      && (value.criteria === null || parseAcceptanceCriteriaResult(value.criteria).criteria !== null)
      && (value.required === undefined || typeof value.required === "boolean");
  }
  if (!acceptanceRecord(value) || value.schemaVersion !== 1 || !text(value.instruction) || !text(value.requestText)
    || !["do", "ask", "plan"].includes(String(value.composerMode)) || typeof value.autonomous !== "boolean"
    || !["response-final", "awaiting-user", "blocked", "cancelled", "budget-exhausted", "failed"].includes(String(value.execution))
    || !(value.requestBaseline === undefined ? value.acceptance !== null : project(value.requestBaseline))
    || typeof value.statefulNpcRequirement !== "boolean"
    || ![value.verificationOwnerSequence, value.currentTurnIndex, value.volumeContinueUsed, value.acceptanceRepairAttempts, value.reviewAttempts, value.roundLimit, value.outputLimit].every(count)
    || !pairs(value.npcRewardItemBaselines) || !pairs(value.lastBlockReasons)) return false;
  if (!Array.isArray(value.verificationOwners) || !value.verificationOwners.every(entry => Array.isArray(entry)
    && entry.length === 3 && text(entry[0]) && text(entry[1]) && Array.isArray(entry[2]) && entry[2].every(text))) return false;
  const acceptance = value.acceptance;
  if (acceptance !== null && (!acceptanceRecord(acceptance) || acceptance.schemaVersion !== 1 || !text(acceptance.id)
    || typeof acceptance.goal !== "string" || !project(acceptance.baseline) || typeof acceptance.stopped !== "boolean"
    || !pairs(acceptance.bindings) || !Array.isArray(acceptance.actionRequirements) || !acceptance.actionRequirements.every(promise)
    || !Array.isArray(acceptance.promises) || !acceptance.promises.every(entry => promise(entry) && acceptanceRecord(entry) && source(entry.source)
      && (entry.refinements === undefined || Array.isArray(entry.refinements) && entry.refinements.every(source))
      && (entry.withdrawal === undefined || acceptanceRecord(entry.withdrawal) && entry.withdrawal.source === "user"
        && entry.withdrawal.acceptanceId === acceptance.id && entry.withdrawal.requirementId === entry.id && text(entry.withdrawal.reason))))) return false;
  const verification = value.verification;
  if (!acceptanceRecord(verification) || verification.schemaVersion !== 1 || !count(verification.sequence) || !count(verification.revision)
    || !Array.isArray(verification.requirements) || !verification.requirements.every(entry => {
      if (!acceptanceRecord(entry) || !acceptanceRecord(entry.requirement)) return false;
      const required = entry.requirement;
      return text(required.checkId) && text(required.ownerId) && text(required.name)
        && (entry.inactive === undefined || typeof entry.inactive === "boolean")
        && (required.args === null || verificationInput(required.name, required.args) !== null);
    }) || !Array.isArray(verification.findings) || !verification.findings.every(entry => acceptanceRecord(entry)
      && text(entry.checkId) && text(entry.name) && acceptanceRecord(entry.args) && acceptanceRecord(entry.result)
      && acceptanceRecord(entry.verdict) && Array.isArray(entry.verdict.blockingIssues) && entry.verdict.blockingIssues.every(text))
    || !Array.isArray(verification.attempts) || !verification.attempts.every(entry => acceptanceRecord(entry) && text(entry.attemptId)
      && count(entry.revision) && text(entry.name) && acceptanceRecord(entry.args) && acceptanceRecord(entry.result))) return false;
  if (verification.lintBaseline !== undefined && verification.lintBaseline !== null && (!Array.isArray(verification.lintBaseline)
    || !verification.lintBaseline.every(entry => Array.isArray(entry) && entry.length === 2 && text(entry[0]) && count(entry[1])))) return false;
  const spec = (entry: unknown): boolean => acceptanceRecord(entry) && text(entry.mapId)
    && Array.isArray(entry.assets) && entry.assets.every(acceptanceRecord);
  if (!Array.isArray(value.specs) || !value.specs.every(entry => Array.isArray(entry) && entry.length === 2 && text(entry[0])
    && acceptanceRecord(entry[1]) && count(entry[1].turnIndex) && spec(entry[1].spec))
    || ![value.implicitSpec, value.viewSpec].every(entry => entry === null || spec(entry))) return false;
  if (value.originalContext !== null && (!acceptanceRecord(value.originalContext) || !text(value.originalContext.snapshotId)
    || !acceptanceRecord(value.originalContext.target) || !Array.isArray(value.originalContext.entries)
    || !value.originalContext.entries.every(entry => acceptanceRecord(entry) && text(entry.id) && Array.isArray(entry.reads)))) return false;
  return [value.volumeBaseline, value.volumeBar].every(entry => entry === null || acceptanceRecord(entry)
    && [entry.authoredMaps, entry.multiPageNpcs, entry.shops, entry.quests].every(count));
}

/** Same normalized content comparator as persistence. Synchronous to snapshot before reentrant observers. */
export function checkpointContentIdentity(project: Project): string {
  return serializeForComparison(project);
}

export type RunRecovery =
  | { readonly kind: "unsupported"; readonly reason: string; readonly next: "open-transcript" }
  | { readonly kind: "needs-reconciliation"; readonly reason: string; readonly next: "inspect-current-project"; readonly checkpoint: RunCheckpoint }
  | { readonly kind: "terminal"; readonly reason: string; readonly next: "new-request"; readonly checkpoint: RunCheckpoint }
  | { readonly kind: "resumable"; readonly reason: "confirmed-boundary" | "prepared-content-present"; readonly next: "continue"; readonly checkpoint: RunCheckpoint };

/** Read-only admission. Content presence is not an invented apply receipt, nor save/proof authority. */
export function reconcileRunCheckpoint(read: RunCheckpointRead, project: Project): RunRecovery {
  if (!read.durable || read.kind !== "found") return { kind: "unsupported",
    reason: !read.durable ? "not-durable" : read.kind === "unsupported" ? read.reason : "no-checkpoint", next: "open-transcript" };
  const checkpoint = read.checkpoint;
  if (!checkpoint.runtime || !isRunRuntimeState(checkpoint.runtime)) return { kind: "unsupported", reason: "no-runtime-state", next: "open-transcript" };
  const reconcile = (reason: string): RunRecovery => ({ kind: "needs-reconciliation", reason, next: "inspect-current-project", checkpoint });
  let identity: string;
  try { identity = checkpointContentIdentity(project); }
  catch { return { kind: "unsupported", reason: "malformed-project", next: "open-transcript" }; }
  if (checkpoint.status === "terminal" || checkpoint.status === "awaiting-user"
    || checkpoint.runtime.execution === "cancelled" || checkpoint.runtime.execution === "awaiting-user") {
    return { kind: "terminal", reason: checkpoint.runtime.execution, next: "new-request", checkpoint };
  }
  const pending = checkpoint.pending;
  if (checkpoint.runtime.composerMode === "ask") return reconcile("question-mode");
  if (pending?.proposal) {
    try {
      // 바이트가 실린 경우(적용 대기)에만 자기 정합성을 검사한다. proposal-ready 는 바이트를
      // 싣지 않으므로 신원 두 개의 관계만 본다.
      if (pending.proposal.project !== undefined
        && pending.proposal.contentIdentity !== checkpointContentIdentity(pending.proposal.project)) return reconcile("ambiguous-proposal");
      if (pending.proposal.contentIdentity === pending.proposal.baseContentIdentity) return reconcile("ambiguous-proposal");
    } catch { return { kind: "unsupported", reason: "malformed-proposal", next: "open-transcript" }; }
  }
  if (pending?.stage === "saving" || pending?.stage === "proving") return reconcile("save-or-proof-unconfirmed");
  if (pending?.proposal) {
    if (pending.stage !== "applying") return reconcile("unapplied-proposal");
    if (identity !== pending.proposal.contentIdentity) return reconcile("apply-unconfirmed");
    // This closes the synchronous mutation -> asynchronous IDB receipt gap without executing its tools.
    return { kind: "resumable", reason: "prepared-content-present", next: "continue", checkpoint };
  }
  if (identity !== checkpoint.currentContentIdentity) return reconcile("content-changed");
  if (checkpoint.save && !checkpoint.proof?.verified) return reconcile("save-unproven");
  return { kind: "resumable", reason: "confirmed-boundary", next: "continue", checkpoint };
}
