import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { reviewingChat } from "./aiEpochFixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type AssistantSessionOptions, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult, type ChatRequest } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";
import { bounded, deferred, epochRunner } from "./aiEpochFixture";
import { installFakeDom } from "./fakeDom";
import * as activityLog from "@/ai/activityLog";
import * as commits from "@/project/projectCommitLog";
import * as adapter from "@/editor/tools/applyChangesetToStore";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { runTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";

vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
const title = (value: string): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: value, type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: value }) } }] }, finishReason: "tool_calls" });
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 } satisfies ReturnType<typeof defaultAiConfig>;
let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  vi.spyOn(activityLog, "recordAiActivity").mockImplementation(async entry => activityLog.buildAiActivityLogRecord(entry));
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory();
});
afterEach(async () => { await store.flush(); clearAgentBlueprint(); clearAgentGhostPreview(); resetMapEditHistory(); resetIntentDeclarationCache(); restoreDom?.(); vi.restoreAllMocks(); });

it("cancelled A's late model tool response cannot mutate a real replacement B", async () => {
  const entered = deferred<void>();
  const response = deferred<ChatResult>();
  const abort = new AbortController();
  let round = 0;
  const eventsA: SessionEvent[] = [];
  const eventsB: SessionEvent[] = [];
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => {
      if (round++ === 0) { entered.resolve(); return response.promise; }
      return round === 2 ? title("B_CURRENT") : final;
    }) });
  const a = session.sendUserMessage("A", event => eventsA.push(event), abort.signal);
  try {
    await bounded(entered.promise);
    abort.abort();
    const b = await bounded(session.sendUserMessage("B", event => eventsB.push(event), undefined, { goalAction: "new-goal" }));
    expect(b.proposedCalls.map(call => call.args.title)).toEqual(["B_CURRENT"]);
    const applied = await applyProposedProject(session.getProposedProject(), { base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "B", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    session.recordAppliedProject(applied); session.rebaseProject(store.getCurrent());
    const before = structuredClone(session.getHarnessSnapshot());
    const project = structuredClone(store.getCurrent());
    const eventCount = eventsB.length;
    response.resolve(title("A_LATE"));
    const cancelled = await bounded(a);
    expect(cancelled.stoppedReason).toBe("aborted");
    expect(session.getProposedProject().system.titleScreen?.title).toBe("B_CURRENT");
    expect(session.getHarnessSnapshot()).toEqual(before);
    expect(store.getCurrent()).toEqual(project);
    expect(eventsB).toHaveLength(eventCount);
    expect(eventsA.filter(event => event.type === "tool_call")).toEqual([]);
  } finally { response.resolve(final); await bounded(a); }
});

it.each(["intent", "wiki", "yield"])("retires A at the real %s await before B without discarding valid B work", async seam => {
  const entered = deferred<void>();
  const release = deferred<void>();
  const completed = deferred<void>();
  let first = true;
  const pause = async () => { if (!first) return; first = false; entered.resolve(); await release.promise; completed.resolve(); };
  let round = 0;
  const options: AssistantSessionOptions = { config,
    declareIntent: async facts => { if (seam === "intent") await pause(); return fixedDeclarer({ mode: "other" })(facts); },
    prepareProjectWiki: async () => { if (seam === "wiki") await pause(); return undefined; },
    yieldToUi: async () => { if (seam === "yield") await pause(); },
    chat: reviewingChat(async () => round++ === 0 ? title(seam === "yield" ? "A_NOT_STARTED" : "B_CURRENT") : seam === "yield" && round === 2 ? title("B_CURRENT") : final) };
  const session = new AssistantSession(store.getCurrent(), options);
  const f = epochRunner(session);
  const apply = vi.spyOn(adapter, "applyProposedProject");
  const a = f.send("A");
  try {
    await bounded(entered.promise);
    f.runner.abortTurn();
    expect(f.surface.turnBusy).toBe(false);
    const cancelled = await bounded(a); // Producer remains unresolved; terminal retirement is already observable.
    expect(cancelled.runOutcome?.execution).toBe("cancelled");
    const b = await bounded(f.send("B", { goalAction: "new-goal" }));
    expect(b.appliedCalls?.map(call => call.args.title)).toEqual(["B_CURRENT"]);
    const snapshot = structuredClone(session.getHarnessSnapshot());
    const ui = f.surface.log.textContent;
    const notifications = vi.mocked(f.surface.notifyIfObscuredByTestPlay).mock.calls.length;
    release.resolve(); await bounded(completed.promise);
    expect(session.getHarnessSnapshot()).toEqual(snapshot);
    expect(f.surface.log.textContent).toBe(ui);
    expect(vi.mocked(f.surface.notifyIfObscuredByTestPlay).mock.calls).toHaveLength(notifications);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(store.getCurrent().system.titleScreen?.title).toBe("B_CURRENT");
  } finally { release.resolve(); await bounded(a); }
});

it("the public runner ignores duplicate late events/results while B is actually running", async () => {
  const enteredB = deferred<void>();
  const releaseB = deferred<ChatResult>();
  const releaseA = deferred<TurnResult>();
  let eventsA: (event: SessionEvent) => void = () => { throw new Error("A not started"); };
  const session = new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield, config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: reviewingChat(async () => { enteredB.resolve(); return releaseB.promise; }) });
  const f = epochRunner(session);
  const a = f.runner.executeTurn(session, "A", onEvent => { eventsA = onEvent; return releaseA.promise; });
  let b: Promise<TurnResult> | undefined;
  try {
    f.runner.abortTurn();
    b = f.send("B", { goalAction: "new-goal", composerMode: "ask" });
    await bounded(enteredB.promise);
    const before = structuredClone(session.getHarnessSnapshot());
    const controller = f.surface.activeAbortController;
    const statusCalls = vi.mocked(f.surface.setStatus).mock.calls.length;
    const late: TurnResult = { assistantText: "A_LATE", proposedCalls: [], stoppedReason: "final" };
    for (const _duplicate of [1, 2]) {
      eventsA({ type: "assistant_message", content: "A_LATE" });
      eventsA({ type: "milestone_applied", title: "A_LATE", toolCount: 9, commitId: null });
      eventsA({ type: "run_outcome", runOutcome: { execution: "response-final", goal: "satisfied", delivery: "persisted-verified" } });
      releaseA.resolve(late);
    }
    await bounded(a);
    expect(session.getHarnessSnapshot()).toEqual(before);
    expect(f.surface.turnBusy).toBe(true);
    expect(f.surface.activeAbortController).toBe(controller);
    expect(vi.mocked(f.surface.setStatus).mock.calls).toHaveLength(statusCalls);
    expect(f.deps.applyProposal).not.toHaveBeenCalled();
    releaseB.resolve(final); await bounded(b);
    expect(vi.mocked(f.deps.settleWorkPlanTurn)).toHaveBeenCalledTimes(2);
  } finally { releaseA.resolve({ assistantText: "", proposedCalls: [], stoppedReason: "aborted" }); releaseB.resolve(final); await bounded(a); if (b) await bounded(b); }
});

it("late viewport images cannot rebuild B's messages or start A intent/tools", async () => {
  const entered = deferred<void>(); const release = deferred<void>(); const completed = deferred<void>();
  let first = true;
  const declare = vi.fn(fixedDeclarer({ mode: "other" }));
  const mapId = store.getCurrent().startMapId;
  const session = new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield, config, declareIntent: declare,
    contextOptions: { viewport: { mapId, x: 0, y: 0, w: 2, h: 2, centerX: 1, centerY: 1 } },
    renderImages: async () => {
      if (first) { first = false; entered.resolve(); await release.promise; completed.resolve(); }
      return [];
    }, chat: reviewingChat(async () => final) });
  const abort = new AbortController();
  const a = session.sendUserMessage("A", undefined, abort.signal);
  try {
    await bounded(entered.promise); abort.abort();
    await bounded(session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal", composerMode: "ask" }));
    const before = structuredClone(session.getHarnessSnapshot());
    release.resolve(); await bounded(completed.promise); await bounded(a);
    expect(session.getHarnessSnapshot()).toEqual(before);
    expect(declare).toHaveBeenCalledTimes(1);
  } finally { release.resolve(); await bounded(a); }
});

it("cancellation at the actual advisory yield prevents the old verification tool while preserving its applied milestone", async () => {
  const entered = deferred<void>(); const release = deferred<void>(); const completed = deferred<void>();
  let holding = false;
  let round = 0;
  let priming = true;
  const calls: ChatResult[] = [{ message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
    name: "set_work_plan", arguments: JSON.stringify({ goal: "Title", layers: [{ title: "Title", items: [{ title: "Title", instruction: "Title", successTools: ["set_title_screen"] }] }] }),
  } }] }, finishReason: "tool_calls" }, title("A_APPLIED")];
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: reviewingChat(async () => priming ? round++ === 0 ? title("A_APPLIED") : final : calls[round++] ?? final), yieldToUi: async () => {
      if (holding) { holding = false; entered.resolve(); await release.promise; completed.resolve(); }
    } });
  const seed = await session.sendUserMessage("Apply the first milestone");
  expect(seed.review?.status).toBe("approved");
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), operation: session.getRunOperation(),
    source: "agent", summary: "First milestone", toolNames: ["set_title_screen"],
    onApplied: mutation => session.recordAppliedMutation(mutation),
  });
  if (!applied.ok) throw new Error(applied.issue);
  session.recordAppliedProject(applied); session.rebaseProject(store.getCurrent());
  priming = false; round = 0;
  const events: SessionEvent[] = [];
  const abort = new AbortController();
  const a = session.sendUserMessage("Continue", event => {
    events.push(event);
    if (event.type === "tool_started" && event.name === "run_lint") holding = true;
  }, abort.signal, { autonomous: true });
  try {
    await bounded(entered.promise); abort.abort();
    const cancelled = await bounded(a);
    expect(cancelled.appliedCalls?.map(call => call.args.title)).toEqual(["A_APPLIED"]);
    await bounded(session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal", composerMode: "ask" }));
    const snapshot = structuredClone(session.getHarnessSnapshot());
    release.resolve(); await bounded(completed.promise);
    expect(events.filter(event => event.type === "tool_call" && event.name === "run_lint")).toEqual([]);
    expect(session.getHarnessSnapshot()).toEqual(snapshot);
    expect(store.getCurrent().system.titleScreen?.title).toBe("A_APPLIED");
  } finally { release.resolve(); await bounded(a); }
});

it("settles cancellation during final completion checks before held work fails and keeps replacement B isolated", async () => {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "define_ending", { id: "epoch_ending", name: "Exit", conditions: [] }).ok).toBe(true);
  store.replace(ctx.project);
  const entered = deferred<void>();
  const held = deferred<void>();
  let heldSettled = false;
  const heldOutcome = held.promise.then(
    () => { heldSettled = true; return { status: "fulfilled" as const }; },
    reason => { heldSettled = true; return { status: "rejected" as const, reason }; },
  );
  let holdYield = false;
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...config, maxToolCalls: 1 }, declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
    yieldToUi: () => {
      if (!holdYield) return cooperativeNodeYield();
      holdYield = false;
      entered.resolve();
      return held.promise;
    },
    chat: async () => {
      round += 1;
      if (round === 3) return { message: { role: "assistant", content: "B_READ_ONLY" }, finishReason: "stop" };
      if (round > 3) throw new Error("Unexpected model call");
      return { message: { role: "assistant", content: null, tool_calls: [{ id: `summary-${round}`, type: "function",
        function: { name: "get_project_summary", arguments: "{}" } }] }, finishReason: "tool_calls" };
    },
  });
  // Main's budget boundary must inspect the actual artifact even without a model final response.
  const control = await bounded(session.sendUserMessage("Inspect the artifact"));
  expect(control.stoppedReason).toBe("max-tool-calls");
  expect(control.completionAssessment?.checks.find(check => check.name === "evaluate_game_quality")?.result.data)
    .toMatchObject({ coverage: { endings: { defined: 1, uninvokedIds: ["epoch_ending"] } } });

  // Observe the real completion producer unchanged, rather than the public cancellation race.
  // With one read round and no model final, this entry belongs to finishAssessedRunRecap.
  const completionChecks = session["completionChecks"];
  const producerSettled = deferred<PromiseSettledResult<Awaited<ReturnType<typeof completionChecks>>>>();
  let observedA = false;
  session["completionChecks"] = function (...args) {
    if (observedA) return completionChecks.apply(this, args);
    observedA = true;
    holdYield = true;
    const producer = completionChecks.apply(this, args);
    void producer.then(
      value => producerSettled.resolve({ status: "fulfilled", value }),
      reason => producerSettled.resolve({ status: "rejected", reason }),
    );
    return producer;
  };
  const abort = new AbortController();
  const eventsA: SessionEvent[] = [];
  const eventsB: SessionEvent[] = [];
  const terminalOutcomes: ReturnType<typeof session.getRunOutcome>[] = [];
  const a = session.sendUserMessage("Inspect again", event => {
    eventsA.push(event);
    if (event.type === "completion_assessment" || event.type === "run_recap") terminalOutcomes.push(session.getRunOutcome());
  }, abort.signal, { goalAction: "new-goal" });
  try {
    await bounded(entered.promise);
    expect(eventsA.filter(event => event.type === "completion_assessment")).toEqual([]);
    abort.abort();
    const cancelled = await bounded(a);
    expect(heldSettled).toBe(false);
    expect(cancelled.stoppedReason).toBe("aborted");
    expect(cancelled.runOutcome?.execution).toBe("cancelled");
    expect(cancelled.completionAssessment?.checks).toEqual([]);
    expect(terminalOutcomes).toEqual([cancelled.runOutcome, cancelled.runOutcome]);
    const b = await bounded(session.sendUserMessage("B inspect only", event => eventsB.push(event), undefined, {
      goalAction: "new-goal", composerMode: "ask",
    }));
    expect(b.stoppedReason).toBe("final");
    expect(b.assistantText).toBe("B_READ_ONLY");
    expect(b.completionAssessment?.checks).toEqual([]);
    const snapshot = () => structuredClone({ harness: session.getHarnessSnapshot(), project: store.getCurrent(), eventsA, eventsB, cancelled, b });
    const before = snapshot();
    const failure = new ToolError("Late final-check yield failure", { code: "epoch-final-check-failure" });
    held.reject(failure);
    expect(await bounded(heldOutcome)).toEqual({ status: "rejected", reason: failure });
    await bounded(producerSettled.promise);
    expect(snapshot()).toEqual(before);
    expect(round).toBe(3);
  } finally {
    abort.abort();
    held.resolve();
    await bounded(a);
    if (observedA) await bounded(producerSettled.promise);
    session["completionChecks"] = completionChecks;
  }
});

it("the actual proposal owner consumes duplicate application requests once", async () => {
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => round++ === 0 ? title("ONCE") : final) });
  const result = await session.sendUserMessage("Apply once");
  const f = epochRunner(session);
  const appliedNotifications = vi.spyOn(session, "recordAppliedProject");
  const applying = vi.spyOn(adapter, "applyProposedProject");
  const calls = result.proposedCalls;
  const first = f.proposal.applyProposal(calls);
  try {
    expect(await f.proposal.applyProposal(calls)).toBe("rejected");
    expect(await first).toBe("applied");
    expect(await f.proposal.applyProposal(calls)).toBe("rejected");
    expect(applying).toHaveBeenCalledTimes(1);
    expect(appliedNotifications).toHaveBeenCalledTimes(1);
    expect(store.getCurrent().system.titleScreen?.title).toBe("ONCE");
  } finally { await first; }
});

it("late stream notifications and model responses cannot publish after a real B", async () => {
  const entered = deferred<void>();
  const response = deferred<ChatResult>();
  let requestA: ChatRequest | undefined;
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: reviewingChat(async (_config, request) => {
      if (round++ === 0) { requestA = request; entered.resolve(); return response.promise; }
      return round === 2 ? title("B_CURRENT") : final;
    }), yieldToUi: cooperativeNodeYield });
  const f = epochRunner(session);
  const a = f.send("A");
  try {
    await bounded(entered.promise); f.runner.abortTurn(); await bounded(a);
    await bounded(f.send("B", { goalAction: "new-goal" }));
    const snapshot = structuredClone(session.getHarnessSnapshot());
    const ui = f.surface.log.textContent;
    requestA?.onToken?.("A_LATE"); requestA?.onReasoning?.("A_LATE"); requestA?.onToken?.("A_LATE");
    response.resolve(title("A_LATE")); await response.promise;
    expect(session.getHarnessSnapshot()).toEqual(snapshot);
    expect(f.surface.log.textContent).toBe(ui);
    expect(f.deps.applyProposal).toHaveBeenCalledTimes(1);
  } finally { response.resolve(final); await bounded(a); }
});

it("keeps an applied A milestone but starts no late application/wiki work after the commit await", async () => {
  const entered = deferred<void>();
  const release = deferred<void>();
  const completion = deferred<void>();
  const original = commits.recordProjectCommit;
  let firstCommit = true;
  vi.spyOn(commits, "recordProjectCommit").mockImplementation(async input => {
    const result = await original(input);
    if (firstCommit) { firstCommit = false; entered.resolve(); await release.promise; completion.resolve(); }
    return result;
  });
  const responses: ChatResult[] = [{ message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
    name: "set_work_plan", arguments: JSON.stringify({ goal: "Title", layers: [{ title: "Title", items: [{ title: "Title", instruction: "Title", successTools: ["set_title_screen"] }] }] }),
  } }] }, finishReason: "tool_calls" }, title("A_APPLIED")];
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => responses[round++] ?? final) });
  const f = epochRunner(session);
  const applying = vi.spyOn(adapter, "applyProposedProject");
  const a = f.send("A", { autonomous: true });
  try {
    await bounded(entered.promise);
    expect(store.getCurrent().system.titleScreen?.title).toBe("A_APPLIED");
    f.runner.abortTurn();
    const cancelled = await bounded(a);
    expect(cancelled.appliedCalls?.map(call => call.args.title)).toEqual(["A_APPLIED"]);
    expect(cancelled.proposedCalls).toEqual([]);
    await bounded(f.send("B", { goalAction: "new-goal", composerMode: "ask" }));
    const snapshot = structuredClone(session.getHarnessSnapshot());
    const project = structuredClone(store.getCurrent());
    const mutation = vi.fn(); const unsubscribe = store.subscribe(mutation);
    try {
      release.resolve(); await bounded(completion.promise);
      await bounded(Promise.all(applying.mock.results.map(result => {
        if (result.type !== "return") throw new Error("Apply did not return");
        return result.value;
      })));
      expect(session.getHarnessSnapshot()).toEqual(snapshot);
      expect(store.getCurrent()).toEqual(project);
      expect(mutation).not.toHaveBeenCalled();
      expect(applying).toHaveBeenCalledTimes(1);
    } finally { unsubscribe(); }
  } finally { release.resolve(); await bounded(a); }
});
