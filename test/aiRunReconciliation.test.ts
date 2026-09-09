import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { readLatestRunCheckpoint, saveRunCheckpoint, runCheckpointId, type RunCheckpoint } from "@/ai/runCheckpointStore";
import { checkpointContentIdentity, isRunRuntimeState, reconcileRunCheckpoint, type RunRuntimeState } from "@/ai/runRecovery";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";

function fixture(): RunCheckpoint & { readonly runtime: RunRuntimeState } {
  const project = createBlankProject();
  const evidence = new ToolVerificationEvidence();
  return { schemaVersion: 1, conversationId: "conversation", runId: "run", epoch: 1, projectId: "P", projectContextKey: "remote:P",
    savedAt: 1, status: "active", request: { requestId: "request", text: "Original goal", scope: null },
    baseContentIdentity: checkpointContentIdentity(project), currentContentIdentity: checkpointContentIdentity(project), workPlan: null,
    budget: { remainingToolCalls: 2, remainingOutputTokens: 100, remainingAutoRunSteps: 3, remainingWorkPlanSteps: 4,
      ralphAttemptsByItemId: [], repeatedToolFailures: [] }, verification: evidence.snapshot(), acceptance: null,
    applied: null, save: null, proof: null, pending: null,
    runtime: { schemaVersion: 1, instruction: "Original goal", requestText: "Original goal", composerMode: "do", autonomous: false,
      execution: "response-final", requestBaseline: project, acceptance: null, verification: evidence.exportRecovery(), currentTurnIndex: 1, verificationOwnerSequence: 0, verificationOwners: [],
      specs: [], latestSpecMapId: null, implicitSpec: null, viewSpec: null, viewSpecWorkItemId: null, originalContext: null,
      statefulNpcRequirement: false, npcRewardItemBaselines: [], volumeBaseline: null, volumeBar: null, volumeContinueUsed: 0,
      acceptanceRepairAttempts: 0, reviewAttempts: 0, lastBlockReasons: [], roundLimit: 2, outputLimit: 100 } };
}
beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("localStorage", undefined); resetAiRecordDbForTest(); });
afterEach(() => { resetAiRecordDbForTest(); vi.unstubAllGlobals(); });
const read = () => readLatestRunCheckpoint("conversation", "P", "remote:P");

it("selects the newest host epoch despite a retired run's later completion", async () => {
  const checkpoint = fixture();
  await saveRunCheckpoint({ ...checkpoint, epoch: 2, runId: "successor", savedAt: 2 });
  await saveRunCheckpoint({ ...checkpoint, savedAt: 100 });
  expect(await read()).toMatchObject({ kind: "found", checkpoint: { epoch: 2, runId: "successor" } });
});
it.each(["foreign", "ambiguous", "malformed"] as const)("does not admit a %s newest checkpoint", async kind => {
  const checkpoint = fixture();
  await saveRunCheckpoint(checkpoint);
  if (kind === "foreign") await saveRunCheckpoint({ ...checkpoint, projectId: "foreign", epoch: 2, runId: "foreign" });
  if (kind === "ambiguous") await saveRunCheckpoint({ ...checkpoint, runId: "ambiguous" });
  if (kind === "malformed") await writeAiRecords("runCheckpoints", [{ ...checkpoint, id: runCheckpointId(checkpoint), runtime: { schemaVersion: 1 } }]);
  expect(await read()).toMatchObject({ kind: "unsupported" });
});
it.each(["proposal-ready", "applying", "saving", "proving"] as const)("does not authorize uncertain %s work", async stage => {
  const checkpoint = fixture(), current = checkpoint.runtime.requestBaseline;
  const draft = structuredClone(current); draft.meta.title = "Prepared result";
  await saveRunCheckpoint({ ...checkpoint, pending: { operationId: "apply", stage,
    proposal: stage === "saving" || stage === "proving" ? null : { baseContentIdentity: checkpoint.currentContentIdentity,
      contentIdentity: checkpointContentIdentity(draft), project: draft, calls: [] } } });
  expect(reconcileRunCheckpoint(await read(), current)).toMatchObject({ kind: "needs-reconciliation", next: "inspect-current-project" });
});
it("reconciles a prepared snapshot already present without inventing an applied receipt", async () => {
  const checkpoint = fixture(), draft = structuredClone(checkpoint.runtime.requestBaseline);
  draft.meta.title = "Prepared result";
  await saveRunCheckpoint({ ...checkpoint, pending: { operationId: "apply", stage: "applying", proposal: {
    baseContentIdentity: checkpoint.currentContentIdentity, contentIdentity: checkpointContentIdentity(draft), project: draft, calls: [] } } });
  const result = reconcileRunCheckpoint(await read(), draft);
  expect(result).toMatchObject({ kind: "resumable", reason: "prepared-content-present", checkpoint: { applied: null } });
  draft.meta.title = "Later human edit";
  expect(reconcileRunCheckpoint(await read(), draft).kind).toBe("needs-reconciliation");
});
it.each(["cancelled", "awaiting-user"] as const)("keeps %s inactive even with matching content", async execution => {
  const checkpoint = fixture();
  await saveRunCheckpoint({ ...checkpoint, runtime: { ...checkpoint.runtime, execution } });
  expect(reconcileRunCheckpoint(await read(), checkpoint.runtime.requestBaseline)).toMatchObject({ kind: "terminal", next: "new-request" });
});
it("keeps legacy and memory-backed rows transcript-only", async () => {
  const checkpoint = fixture();
  await saveRunCheckpoint({ ...checkpoint, runtime: undefined });
  expect(reconcileRunCheckpoint(await read(), checkpoint.runtime.requestBaseline).kind).toBe("unsupported");
  vi.stubGlobal("indexedDB", undefined); resetAiRecordDbForTest();
  await saveRunCheckpoint(checkpoint);
  expect(reconcileRunCheckpoint(await read(), checkpoint.runtime.requestBaseline)).toMatchObject({ kind: "unsupported", reason: "not-durable" });
});
it.each(["request", "ledger", "promise"] as const)("revalidates the %s baseline after an earlier successful runtime validation", kind => {
  const checkpoint = fixture();
  const ledger = new AssistantAcceptanceLedger("acceptance", "Original goal", checkpoint.runtime.requestBaseline);
  ledger.adopt([{ id: "title", title: "Title", criteria: [{ kind: "gameTitle", title: "Expected" }] }],
    checkpoint.runtime.requestBaseline, checkpoint.request);
  const runtime = { ...checkpoint.runtime, acceptance: ledger.exportRecovery() };
  expect(isRunRuntimeState(runtime)).toBe(true);
  const baseline = kind === "request" ? runtime.requestBaseline
    : kind === "ledger" ? runtime.acceptance.baseline : runtime.acceptance.promises[0]?.baseline;
  if (!baseline) throw new Error("Missing canonical baseline");
  baseline.meta.title = "Different valid baseline";
  expect(isRunRuntimeState(runtime)).toBe(true);
  Reflect.set(baseline.meta, "title", 123);
  expect(isRunRuntimeState(runtime)).toBe(false);
});
it("persists host runtime recovery state through the actual checkpoint boundary", async () => {
  await expect(saveRunCheckpoint(fixture())).resolves.toEqual({ durable: true, written: true });
});
