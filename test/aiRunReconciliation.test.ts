import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { readLatestRunCheckpoint, saveRunCheckpoint, runCheckpointId, type RunCheckpoint } from "@/ai/runCheckpointStore";
import { checkpointContentIdentity, isRunRuntimeState, reconcileRunCheckpoint, restoreCheckpointBaselines, type RunRuntimeState } from "@/ai/runRecovery";
import { checkpointProjectView } from "@/ai/checkpointPayload";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";

// Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
// panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
// single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
vi.setConfig({ testTimeout: 120_000 });

function makeProject() {
  const project = createBlankProject();
  const tilesetId = project.maps[project.startMapId]!.tilesetId;
  project.tilesets = { [tilesetId]: project.tilesets[tilesetId]! };
  return project;
}

function fixture(project = makeProject()): RunCheckpoint & { readonly runtime: RunRuntimeState } {
  const evidence = new ToolVerificationEvidence();
  return { schemaVersion: 1, conversationId: "conversation", runId: "run", epoch: 1, projectId: "P", projectContextKey: "remote:P",
    savedAt: 1, status: "active", request: { requestId: "request", text: "Original goal", scope: null },
    baseContentIdentity: checkpointContentIdentity(project), currentContentIdentity: checkpointContentIdentity(project), workPlan: null,
    budget: { remainingToolCalls: 2, remainingOutputTokens: 100, remainingAutoRunSteps: 3, remainingWorkPlanSteps: 4,
      ralphAttemptsByItemId: [], repeatedToolFailures: [] }, verification: evidence.snapshot(), acceptance: null,
    applied: null, save: null, proof: null, pending: null,
    runtime: { schemaVersion: 2, instruction: "Original goal", requestText: "Original goal", composerMode: "do", autonomous: false,
      execution: "response-final", requestBaseline: checkpointProjectView(project), acceptance: null, verification: evidence.exportRecovery(), currentTurnIndex: 1, verificationOwnerSequence: 0, verificationOwners: [],
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
  if (kind === "malformed") await writeAiRecords("runCheckpoints", [{ ...checkpoint, id: runCheckpointId(checkpoint), runtime: { schemaVersion: 2 } }]);
  expect(await read()).toMatchObject({ kind: "unsupported" });
});
it.each(["proposal-ready", "applying", "saving", "proving"] as const)("does not authorize uncertain %s work", async stage => {
  const current = makeProject(), checkpoint = fixture(current);
  const draft = structuredClone(current); draft.meta.title = "Prepared result";
  await saveRunCheckpoint({ ...checkpoint, pending: { operationId: "apply", stage,
    proposal: stage === "saving" || stage === "proving" ? null : { baseContentIdentity: checkpoint.currentContentIdentity,
      contentIdentity: checkpointContentIdentity(draft), calls: [] } } });
  expect(reconcileRunCheckpoint(await read(), current)).toMatchObject({ kind: "needs-reconciliation", next: "inspect-current-project" });
});
it("reconciles a prepared snapshot already present without inventing an applied receipt", async () => {
  const draft = makeProject(), checkpoint = fixture(draft);
  draft.meta.title = "Prepared result";
  await saveRunCheckpoint({ ...checkpoint, pending: { operationId: "apply", stage: "applying", proposal: {
    baseContentIdentity: checkpoint.currentContentIdentity, contentIdentity: checkpointContentIdentity(draft), calls: [] } } });
  const result = reconcileRunCheckpoint(await read(), draft);
  expect(result).toMatchObject({ kind: "resumable", reason: "prepared-content-present", checkpoint: { applied: null } });
  draft.meta.title = "Later human edit";
  expect(reconcileRunCheckpoint(await read(), draft).kind).toBe("needs-reconciliation");
});
it.each(["cancelled", "awaiting-user"] as const)("keeps %s inactive even with matching content", async execution => {
  const project = makeProject(), checkpoint = fixture(project);
  await saveRunCheckpoint({ ...checkpoint, runtime: { ...checkpoint.runtime, execution } });
  expect(reconcileRunCheckpoint(await read(), project)).toMatchObject({ kind: "terminal", next: "new-request" });
});
it("keeps legacy and memory-backed rows transcript-only", async () => {
  const project = makeProject(), checkpoint = fixture(project);
  await saveRunCheckpoint({ ...checkpoint, runtime: undefined });
  expect(reconcileRunCheckpoint(await read(), project).kind).toBe("unsupported");
  vi.stubGlobal("indexedDB", undefined); resetAiRecordDbForTest();
  await saveRunCheckpoint(checkpoint);
  expect(reconcileRunCheckpoint(await read(), project)).toMatchObject({ kind: "unsupported", reason: "not-durable" });
});
it.each(["request", "ledger", "promise"] as const)("revalidates the %s baseline after an earlier successful runtime validation", kind => {
  const project = makeProject(), checkpoint = fixture(project);
  const ledger = new AssistantAcceptanceLedger("acceptance", "Original goal", project);
  ledger.adopt([{ id: "title", title: "Title", criteria: [{ kind: "gameTitle", title: "Expected" }] }],
    project, checkpoint.request);
  const runtime = { ...checkpoint.runtime, acceptance: ledger.recoveryView(checkpointProjectView) };
  expect(isRunRuntimeState(runtime)).toBe(true);
  const baseline = kind === "request" ? runtime.requestBaseline
    : kind === "ledger" ? runtime.acceptance.baseline : runtime.acceptance.promises[0]?.baseline;
  if (!baseline) throw new Error("Missing canonical baseline");
  const meta = Reflect.get(baseline, "meta");
  Reflect.set(meta, "title", "Different valid baseline");
  expect(isRunRuntimeState(runtime)).toBe(true);
  Reflect.set(meta, "title", 123);
  expect(isRunRuntimeState(runtime)).toBe(false);
});
it("persists host runtime recovery state through the actual checkpoint boundary", async () => {
  await expect(saveRunCheckpoint(fixture())).resolves.toEqual({ durable: true, written: true });
});

it("keeps identity stable across equivalent objects and detects map and event edits in place", () => {
  const project = makeProject();
  const map = project.maps[project.startMapId]!;
  const event = { id: "checkpoint-event", x: 2, y: 2, trigger: { kind: "action" as const },
    commands: [{ kind: "text" as const, body: "hello" }] };
  map.events.push(event);
  const identity = checkpointContentIdentity(project);
  const equivalent = { ...project, maps: structuredClone(project.maps), meta: {
    terms: project.meta.terms, author: project.meta.author, title: project.meta.title,
  } };
  expect(checkpointContentIdentity(equivalent)).toBe(identity);
  map.name = "Renamed map";
  const renamed = checkpointContentIdentity(project);
  expect(renamed).not.toBe(identity);
  event.commands[0]!.body = "hello again";
  expect(checkpointContentIdentity(project)).not.toBe(renamed);
});

it("keeps full-project runtime v1 rows transcript-only", async () => {
  const project = makeProject(), checkpoint = fixture(project);
  await writeAiRecords("runCheckpoints", [{ ...checkpoint, id: runCheckpointId(checkpoint),
    runtime: { ...checkpoint.runtime, schemaVersion: 1, requestBaseline: project } }]);
  expect(await read()).toEqual({ kind: "unsupported", reason: "schema-version", durable: true });
});

it("restores an authored change to a bundled tileset from the compact baseline", async () => {
  const project = makeProject();
  const tilesetId = project.maps[project.startMapId]!.tilesetId;
  const tileset = project.tilesets[tilesetId]!;
  tileset.tileMeta![0] = { ...tileset.tileMeta![0]!, label: "Authored tile label" };
  await saveRunCheckpoint(fixture(project));
  const readback = await read();
  if (readback.kind !== "found" || !readback.checkpoint.runtime) throw new Error("Missing checkpoint runtime");
  const restored = restoreCheckpointBaselines(readback.checkpoint.runtime);
  expect(restored.requestBaseline.tilesets[tilesetId]?.tileMeta?.[0]?.label).toBe("Authored tile label");
});
