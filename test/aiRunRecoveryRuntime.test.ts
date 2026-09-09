import { imageDeliveryForRequest } from "./independentReviewFixture";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import * as llm from "@/ai/llmClient";
import * as activity from "@/ai/activityLog";
import * as adapter from "@/editor/tools/applyChangesetToStore";
import * as commits from "@/project/projectCommitLog";
import * as sync from "@/project/supabaseProjectSync";
import { AI_RECORD_STORES, readAllAiRecords, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { readLatestRunCheckpoint, type RunCheckpoint } from "@/ai/runCheckpointStore";
import { getTool, runTool } from "@/editor/tools";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { getAiAssistantStatus } from "@/editor/aiAssistantBridge";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse } from "./independentReviewFixture";
import { bounded, deferred, epochRunner, reviewingChat } from "./aiEpochFixture";
import { installFakeDom } from "./fakeDom";

vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
const checkpointHost = { conversationId: "crash-conversation", projectId: "recovery-project", projectContextKey: "remote:recovery-project" };
const config = { ...llm.defaultAiConfig(), agentMode: "chat" as const, model: "fixture", liteModel: "fixture", maxToolCalls: 12 };
const final: llm.ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
const tool = (name: string, args: unknown): llm.ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
let restoreDom: () => void;
beforeEach(async () => {
  restoreDom = installFakeDom(); vi.stubGlobal("indexedDB", new IDBFactory()); resetAiRecordDbForTest();
  const values = new Map([[llm.AI_CONFIG_STORAGE_KEY, JSON.stringify(config)]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubEnv("VITE_SUPABASE_URL", ""); vi.stubEnv("VITE_SUPABASE_ANON_KEY", ""); vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing recovery start map");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("Missing recovery start tileset");
  // Keep the real map and its tileset; unrelated bundled tilesets are not recovery inputs.
  project.tilesets = { [map.tilesetId]: tileset };
  store.replace(project); resetMapEditHistory();
  vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: checkpointHost.projectId });
  vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
  vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
  await writeAiRecords(AI_RECORD_STORES.conversations, [{ id: checkpointHost.conversationId, title: "Original request", model: "fixture", savedAt: 1,
    projectContextKey: checkpointHost.projectContextKey, entries: [{ kind: "user", text: "Create a marker" }] }]);
});
afterEach(async () => {
  teardownAiChatPanel(); await bounded(whenAiChatPanelSettled()); await store.flush(); resetMapEditHistory();
  resetAiRecordDbForTest(); restoreDom(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
async function checkpoint(): Promise<RunCheckpoint> {
  const read = await readLatestRunCheckpoint(checkpointHost.conversationId, checkpointHost.projectId, checkpointHost.projectContextKey);
  expect(read).toMatchObject({ kind: "found", durable: true });
  if (read.kind !== "found") throw new Error(`Expected real runtime checkpoint: ${read.kind}`);
  return read.checkpoint;
}
async function crashImage() {
  return { project: structuredClone(store.getCurrent()), conversations: await readAllAiRecords(AI_RECORD_STORES.conversations),
    checkpoints: await readAllAiRecords(AI_RECORD_STORES.runCheckpoints) };
}
async function recreate(image: Awaited<ReturnType<typeof crashImage>>) {
  resetAiRecordDbForTest(); vi.stubGlobal("indexedDB", new IDBFactory()); resetAiRecordDbForTest();
  await writeAiRecords(AI_RECORD_STORES.conversations, image.conversations);
  await writeAiRecords(AI_RECORD_STORES.runCheckpoints, image.checkpoints);
  store.replace(image.project); resetMapEditHistory();
}

it("crashes after a real applied create before final transcript persistence; recreated panel Continue creates/applies nothing", async () => {
  const createTool = getTool("upsert_event"); if (!createTool) throw new Error("Missing native event tool");
  const create = vi.spyOn(createTool, "run"), apply = vi.spyOn(adapter, "applyProposedProject");
  const entered = deferred<void>(), release = deferred<void>(), completed = deferred<void>();
  const originalCommit = commits.recordProjectCommit;
  vi.spyOn(commits, "recordProjectCommit").mockImplementationOnce(async input => {
    const result = await originalCommit(input); entered.resolve(); await release.promise; completed.resolve(); return result;
  });
  const project = store.getCurrent(), mapId = project.startMapId, beforeCount = project.maps[mapId]?.events.length ?? 0;
  const map = project.maps[mapId];
  if (!map) throw new Error("Missing native marker map");
  const marker = { id: "recovery-marker", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [{
    id: "recovery-page", name: "Marker", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
  }] };
  const responses = [tool("upsert_event", { mapId, event: marker }),
    tool("show_map_region", { mapId, x: 0, y: 0, w: map.width, h: map.height }), final];
  let round = 0;
  const reviewedChat = reviewingChat(async () => responses[round++] ?? final);
  const session = new AssistantSession(project, { config, checkpoint: checkpointHost, declareIntent: fixedDeclarer({ mode: "other" }),
    // Same lifecycle image as aiAssistantSession.test.ts: real native capture, revision and delivery gates;
    // this test asserts delivery/approval plumbing, not pixel quality. Required problems still reject review.
    renderImages: async () => [{ label: "Lifecycle map capture",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }],
    chat: async (phaseConfig, request) => ({ ...await reviewedChat(phaseConfig, request), imageDelivery: imageDeliveryForRequest(request) }) });
  const host = epochRunner(session), running = host.send("Create a marker");
  try {
    await bounded(Promise.race([entered.promise, running.then(result => {
      throw new Error(`Native commit seam was not reached: ${JSON.stringify({ result, review: session.getResultReview(), audit: session.getAuditEntries() })}`);
    })]));
    expect(create).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    // Pre-C must fail on the missing durable row at this real apply seam, not on a missing method.
    // Once C exists, await its actual causal write promise before inspecting the row.
    if ("whenCheckpointed" in session && typeof session.whenCheckpointed === "function") await bounded(session.whenCheckpointed());
    const saved = await checkpoint();
    expect(saved.status).toBe("active"); expect(saved.applied?.calls.map(call => call.name)).toEqual(["upsert_event"]);
    expect(saved.pending).toBeNull(); expect(store.getCurrent().maps[mapId]?.events).toHaveLength(beforeCount + 1);
    const image = await crashImage();
    // Fork the actual durable bytes at the crash boundary. Later cancellation is cleanup of the old process only.
    host.runner.abortTurn(); release.resolve(); await bounded(completed.promise); await bounded(running); await bounded(session.whenCheckpointed());
    await recreate(image);
    const network = vi.spyOn(llm, "chatCompletion");
    const panel = renderAiChatPanel(); document.body.append(panel); await bounded(whenAiChatPanelSettled());
    expect((panel.querySelector('[data-testid="ai-run-recovery"]') as HTMLElement | null)?.dataset.state).toBe("resumable");
    expect(create).toHaveBeenCalledTimes(1); expect(apply).toHaveBeenCalledTimes(1); expect(network).not.toHaveBeenCalled();
    const done = deferred<void>();
    vi.mocked(activity.recordAiActivity).mockImplementation(async entry => {
      if (entry.result?.stoppedReason && !entry.result.pending) done.resolve();
      return activity.buildAiActivityLogRecord(entry);
    });
    const button = panel.querySelector('[data-testid="ai-run-continue"]'); if (!button) throw new Error("Missing actual recovery Continue");
    button.dispatchEvent(new Event("click")); await bounded(done.promise); await bounded(whenAiChatPanelSettled());
    expect(create).toHaveBeenCalledTimes(1); expect(apply).toHaveBeenCalledTimes(1); expect(network).not.toHaveBeenCalled();
    expect(store.getCurrent().maps[mapId]?.events).toHaveLength(beforeCount + 1);
    expect(getAiAssistantStatus().turnBusy).toBe(false);
    const successor = await checkpoint();
    expect(successor.epoch).toBeGreaterThan(saved.epoch); expect(successor.runId).not.toBe(saved.runId);
    expect(successor.applied?.calls).toEqual(saved.applied?.calls);
  } finally { release.resolve(); await bounded(running); }
});

it("restores the same WorkPlan and immutable requirements, executing only its remaining task without resetting consumed budget", async () => {
  const waiting = deferred<void>(), response = deferred<llm.ChatResult>(); let round = 0;
  const recoveryConfig = { ...config, maxTokens: 4096 };
  const usage = (completion_tokens: number) => ({ prompt_tokens: 100, completion_tokens, total_tokens: 100 + completion_tokens });
  const plan = { goal: "Exact title", acceptance: [{ id: "title", title: "Exact title", criteria: [{ kind: "gameTitle", title: "RECOVERED_TITLE" }] }],
    layers: [{ title: "Remaining", items: [{ title: "Set title", instruction: "Set exact title", successTools: ["set_title_screen"] }] }] };
  const session = new AssistantSession(store.getCurrent(), { config: recoveryConfig, checkpoint: checkpointHost, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: reviewingChat(async () => { if (round++ === 0) return { ...tool("set_work_plan", plan), usage: usage(64) }; waiting.resolve(); return response.promise; }) });
  const running = session.sendUserMessage("Set exact title");
  try {
    await bounded(waiting.promise); await bounded(session.whenCheckpointed());
    const saved = await checkpoint(), image = await crashImage();
    if (!saved.runtime?.acceptance || !saved.workPlan) throw new Error("Missing canonical plan checkpoint");
    expect(saved.budget.remainingToolCalls).toBeLessThan(config.maxToolCalls);
    session.retireRun(); response.resolve(final); await bounded(running); await bounded(session.whenCheckpointed());
    await recreate(image);
    let resumedRound = 0;
    const reviewEntered = deferred<number>(), releaseReview = deferred<void>();
    const resumed = new AssistantSession(store.getCurrent(), { config: recoveryConfig, checkpoint: checkpointHost, declareIntent: fixedDeclarer({ mode: "other" }),
      chat: async (phaseConfig, request) => {
        const review = approvedReviewResponse(request);
        if (review) {
          reviewEntered.resolve(phaseConfig.maxTokens);
          await releaseReview.promise;
          return { ...review, usage: usage(16) };
        }
        return resumedRound++ === 0
          ? { ...tool("set_title_screen", { title: "RECOVERED_TITLE" }), usage: usage(40) }
          : { ...final, usage: usage(60) };
      } });
    expect(resumed.restoreCheckpoint(await checkpoint(), true).kind).toBe("resumable");
    expect(resumed.getWorkPlan()).toEqual(saved.workPlan);
    const host = epochRunner(resumed);
    const completing = host.runner.executeTurn(resumed, "Continue", (onEvent, signal) => resumed.resumeRecoveredRun(onEvent, signal), { composerMode: "do" });
    try {
      const offeredTokens = await bounded(Promise.race([reviewEntered.promise,
        completing.then(() => { throw new Error("Recovered turn settled without entering independent review"); })]));
      await bounded(resumed.whenCheckpointed());
      const reviewing = await checkpoint();
      expect(saved.budget.remainingOutputTokens).toBe(recoveryConfig.maxTokens - 64);
      expect(offeredTokens).toBe(saved.budget.remainingOutputTokens - 40 - 60);
      expect(reviewing.budget.remainingToolCalls).toBe(saved.budget.remainingToolCalls - 3);
      expect(reviewing.budget.remainingOutputTokens).toBe(saved.budget.remainingOutputTokens - 40 - 60);
    } finally { releaseReview.resolve(); await bounded(completing); }
    expect(store.getCurrent().system.titleScreen?.title).toBe("RECOVERED_TITLE");
    const result = await checkpoint();
    expect(result.workPlan?.id).toBe(saved.workPlan.id);
    expect(result.runtime?.acceptance?.promises).toEqual(saved.runtime.acceptance.promises);
    expect(result.request).toEqual(saved.request);
    expect(result.budget.remainingToolCalls).toBeLessThan(saved.budget.remainingToolCalls);
    expect(host.deps.applyProposal).toHaveBeenCalledTimes(1);
  } finally { response.resolve(final); await bounded(running); }
});


it("reassesses completed recovered scheduling with real ending-quality checks and zero create or apply calls", async () => {
  const ctx = { project: store.getCurrent() };
  const ending = runTool(ctx, "define_ending", { id: "uninvoked-recovery-ending", name: "Ending", conditions: [] });
  expect(ending.ok).toBe(true);
  store.replace(ctx.project);
  const seed = new AssistantSession(store.getCurrent(), { config, checkpoint: checkpointHost,
    declareIntent: fixedDeclarer({ mode: "other" }), chat: async () => final });
  await bounded(seed.sendUserMessage("Inspect current completion"));
  await bounded(seed.whenCheckpointed());
  const saved = await checkpoint();
  // Completed scheduling does not certify the artifact. Retain the real current project and ledger bytes.
  const completed: RunCheckpoint = { ...saved, workPlan: {
    id: "completed-scheduling", goal: "Inspect current completion", createdAt: "2026-09-08T00:00:00Z",
    currentLayerIndex: 0, currentItemId: null, layers: [{ id: "final", title: "Final", items: [{
      id: "inspection", title: "Inspection", instruction: "Inspect current completion", status: "done",
    }] }],
  } };
  const qualityTool = getTool("evaluate_game_quality"), createTool = getTool("upsert_event");
  if (!qualityTool || !createTool) throw new Error("Missing native recovery test tools");
  const quality = vi.spyOn(qualityTool, "run"), create = vi.spyOn(createTool, "run");
  const apply = vi.spyOn(adapter, "applyProposedProject"), writer = vi.fn(async () => final);
  const resumed = new AssistantSession(store.getCurrent(), { config, checkpoint: checkpointHost,
    declareIntent: fixedDeclarer({ mode: "other" }), chat: writer });
  expect(resumed.restoreCheckpoint(completed, true).kind).toBe("resumable");
  const before = structuredClone(store.getCurrent());
  const result = await bounded(resumed.resumeRecoveredRun());
  await bounded(resumed.whenCheckpointed());
  expect(quality).toHaveBeenCalledTimes(1);
  expect(result.completionAssessment?.checks.find(check => check.name === "evaluate_game_quality")?.result.data)
    .toMatchObject({ verdict: { blocked: true }, coverage: { endings: { uninvokedIds: ["uninvoked-recovery-ending"] } } });
  expect(writer).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  expect(result.proposedCalls).toEqual([]); expect(store.getCurrent()).toEqual(before);
});
