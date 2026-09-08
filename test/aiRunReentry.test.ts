import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { reviewingChat } from "./aiEpochFixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { bounded, deferred, epochRunner } from "./aiEpochFixture";
import { fixedDeclarer } from "./intentFixture";
import { installFakeDom } from "./fakeDom";
import * as activityLog from "@/ai/activityLog";

vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));

const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 6 } satisfies ReturnType<typeof defaultAiConfig>;
const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
const tools = (...calls: { name: string; args: Record<string, unknown> }[]): ChatResult => ({
  message: { role: "assistant", content: null, tool_calls: calls.map((call, index) => ({ id: `call-${index}`, type: "function",
    function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls",
});
beforeEach(() => {
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory();
});
afterEach(async () => { await store.flush(); resetMapEditHistory(); resetIntentDeclarationCache(); vi.restoreAllMocks(); });

it.each(["cancelled", "response-final"])("settles A before a synchronous %s outcome subscriber retires A and starts B", async ending => {
  const entered = deferred<void>(); const release = deferred<ChatResult>();
  const eventsA: SessionEvent[] = [];
  let replacing = false;
  let b: Promise<TurnResult> | undefined;
  let nested: TurnResult | undefined;
  let bRound = 0;
  const abort = new AbortController();
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => {
      if (!replacing && ending === "cancelled") { entered.resolve(); return release.promise; }
      if (replacing && bRound++ === 0) return tools({ name: "set_title_screen", args: { title: "B_CURRENT" } });
      return final;
    }) });
  const a = session.sendUserMessage("A", event => {
    eventsA.push(event);
    if (event.type !== "run_outcome" || replacing) return;
    replacing = true; // Bound the hostile callback itself, not production terminalization.
    nested = session.retireRun();
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  }, abort.signal);
  try {
    if (ending === "cancelled") { await bounded(entered.promise); abort.abort(); }
    const resultA = await bounded(a);
    if (!b) throw new Error("A terminal subscriber did not start B");
    const resultB = await bounded(b);
    expect(resultA.runOutcome?.execution).toBe(ending);
    expect(nested).toBe(resultA);
    expect(eventsA.filter(event => event.type === "run_recap").length).toBeLessThanOrEqual(1);
    const recaps = session.getAuditEntries().filter(entry => entry.kind === "status" && entry.text.startsWith("run-recap "));
    expect(recaps).toHaveLength(2); // Exactly one fully prepared historical recap per owner.
    expect(resultA.recap?.runOutcome).toEqual(resultA.runOutcome);
    expect(resultB.proposedCalls.map(call => call.args.title)).toEqual(["B_CURRENT"]);
    expect(session.getRunOutcome()).toEqual(resultB.runOutcome);
    const snapshot = structuredClone(session.getHarnessSnapshot());
    release.resolve(final); await release.promise;
    expect(session.getHarnessSnapshot()).toEqual(snapshot);
  } finally { release.resolve(final); await bounded(a); if (b) await bounded(b); }
});

it("an old successful tool callback cannot start image work or reacquire B's helper authority", async () => {
  const mapId = store.getCurrent().startMapId;
  let replacing = false;
  let b: Promise<TurnResult> | undefined;
  let cancelled: TurnResult | undefined;
  let aRound = 0; let bRound = 0;
  const images = vi.fn(async () => []);
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield, renderImages: images,
    chat: reviewingChat(async () => replacing
      ? bRound++ === 0 ? tools({ name: "set_title_screen", args: { title: "B_CURRENT" } }) : final
      : aRound++ === 0 ? tools({ name: "set_title_screen", args: { title: "A_DRAFT" } },
        { name: "show_map_region", args: { mapId, x: 0, y: 0, w: 2, h: 2 } },
        { name: "set_title_screen", args: { title: "A_MUST_NOT_START" } }) : final) });
  const a = session.sendUserMessage("A", event => {
    if (event.type !== "tool_call" || event.name !== "show_map_region" || replacing) return;
    expect(event.result.ok).toBe(true);
    replacing = true;
    cancelled = session.retireRun();
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  });
  try {
    const resultA = await bounded(a);
    if (!b) throw new Error("Real image-tool callback did not start B");
    const resultB = await bounded(b);
    expect(images).not.toHaveBeenCalled();
    expect(resultA).toBe(cancelled);
    expect(resultA.proposedCalls.map(call => call.args.title)).toEqual(["A_DRAFT"]);
    expect(resultB.proposedCalls.map(call => call.args.title)).toEqual(["B_CURRENT"]);
    expect(session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "set_title_screen")).toHaveLength(2);
  } finally { await bounded(a); if (b) await bounded(b); }
});

it("acceptance reentry retains the just-successful write and its real protocol response for same-goal resume", async () => {
  const project = store.getCurrent(); const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing fixture map");
  const plan = { name: "set_work_plan", args: { goal: "Title", requirements: [{ id: "size", title: "Size",
    criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height }] }],
    layers: [{ title: "Title", items: [{ title: "Title", instruction: "Title" }] }] } };
  let round = 0; let replacing = false;
  let b: Promise<TurnResult> | undefined; let cancelled: TurnResult | undefined;
  let atRetirement: ReturnType<AssistantSession["getHarnessSnapshot"]> | undefined;
  const session = new AssistantSession(project, { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => replacing ? final : round++ === 0 ? tools(plan) : tools({ name: "set_title_screen", args: { title: "A_DRAFT" } })) });
  const a = session.sendUserMessage("A", event => {
    if (event.type !== "acceptance" || replacing || session.getProposedProject().system.titleScreen?.title !== "A_DRAFT") return;
    replacing = true;
    cancelled = session.retireRun();
    atRetirement = session.getHarnessSnapshot();
    b = session.sendUserMessage("Continue", undefined, undefined, { goalAction: "resume" });
  });
  try {
    await bounded(a);
    if (!b) throw new Error("Acceptance subscriber did not enter B");
    const resultB = await bounded(b);
    expect(cancelled?.proposedCalls.map(call => call.args.title)).toEqual(["A_DRAFT"]);
    const response = atRetirement?.messages.filter(message => message.role === "tool" && message.name === "set_title_screen").at(-1);
    if (typeof response?.content !== "string") throw new Error("Successful A protocol response missing");
    expect(JSON.parse(response.content)).toMatchObject({ ok: true });
    expect(resultB.proposedCalls.map(call => call.args.title)).toEqual(["A_DRAFT"]);
    const applied = await applyProposedProject(session.getProposedProject(), { base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Resume A draft", toolNames: ["set_title_screen"], operation: session.getRunOperation() });
    expect(applied.ok).toBe(true);
    expect(store.getCurrent().system.titleScreen?.title).toBe("A_DRAFT");
  } finally { await bounded(a); if (b) await bounded(b); }
});

it("a replacement requested from retirement publication wins over the suspended outer entry", async () => {
  const entered = deferred<void>(); const release = deferred<ChatResult>();
  let b: Promise<TurnResult> | undefined;
  let replacing = false;
  const instructions: string[] = [];
  const session = new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield, config,
    declareIntent: facts => { instructions.push(facts.userText); return fixedDeclarer({ mode: "other" })(facts); },
    chat: reviewingChat(async () => { if (!replacing) { entered.resolve(); return release.promise; } return final; }) });
  const a = session.sendUserMessage("A", event => {
    if (event.type !== "run_outcome" || replacing) return;
    replacing = true;
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  });
  try {
    await bounded(entered.promise);
    const c = await bounded(session.sendUserMessage("C", undefined, undefined, { goalAction: "new-goal" }));
    if (!b) throw new Error("Retirement did not synchronously start B");
    const resultB = await bounded(b);
    expect(c.stoppedReason).toBe("aborted");
    expect(resultB.stoppedReason).toBe("final");
    expect(instructions).toEqual(["A", "B"]);
    expect(session.getRunOutcome()).toEqual(resultB.runOutcome);
  } finally { release.resolve(final); await bounded(a); if (b) await bounded(b); }
});

it("a terminal subscriber exception after starting B cannot terminalize B on A's stack", async () => {
  let b: Promise<TurnResult> | undefined; let replacing = false;
  const fault = new Error("SUBSCRIBER_FAILURE");
  const session = new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield, config, declareIntent: fixedDeclarer({ mode: "other" }), chat: reviewingChat(async () => final) });
  const a = session.sendUserMessage("A", event => {
    if (event.type !== "run_outcome" || replacing) return;
    replacing = true;
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
    throw fault;
  });
  const observedA = a.then(result => ({ result }), error => ({ error }));
  try {
    const outcome = await bounded(observedA);
    if (!b) throw new Error("Terminal subscriber did not start B");
    const resultB = await bounded(b);
    expect(outcome).toEqual({ error: fault });
    expect(resultB.runOutcome?.execution).toBe("response-final");
    expect(session.getRunOutcome()).toEqual(resultB.runOutcome);
    expect(session.getAuditEntries().filter(entry => entry.kind === "status" && entry.text.startsWith("run-recap "))).toHaveLength(2);
  } finally { await bounded(observedA); if (b) await bounded(b); }
});

it("duplicate same-owner retirement retains normal terminal callback delivery exactly once", async () => {
  const events: SessionEvent[] = [];
  const retired: (TurnResult | undefined)[] = [];
  let token: ((delta: string) => void) | undefined;
  const session = new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield, config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: reviewingChat(async (_config, request) => { token = request.onToken; return final; }) });
  const result = await session.sendUserMessage("A", event => {
    events.push(event);
    if (event.type === "run_outcome") {
      token?.("LATE_TERMINAL_TOKEN");
      retired.push(session.retireRun(), session.retireRun());
    }
  });
  expect(events.filter(event => event.type === "run_recap")).toHaveLength(1);
  expect(events.filter(event => event.type === "run_outcome")).toHaveLength(2);
  expect(events.filter(event => event.type === "assistant_token")).toHaveLength(0);
  expect(retired).toHaveLength(4);
  for (const snapshot of retired) expect(snapshot).toBe(result);
  expect(result.runOutcome?.execution).toBe("response-final");
});

it("retry cancellation is settled before its recap callback synchronously starts B", async () => {
  const entered = deferred<void>(); const release = deferred<ChatResult>();
  let priming = true; let replacing = false;
  let b: Promise<TurnResult> | undefined; let nested: TurnResult | undefined;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield, config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: reviewingChat(async () => {
      if (priming) { priming = false; throw new Error("AUTHORING_FAILURE"); }
      if (!replacing) { entered.resolve(); return release.promise; }
      return final;
    }) });
  const failed = await session.sendUserMessage("Prime failed authoring");
  expect(failed.stoppedReason).toBe("error");
  const abort = new AbortController();
  const retry = session.retryLastTurn(event => {
    events.push(event);
    if (event.type !== "run_recap" || replacing) return;
    replacing = true;
    nested = session.retireRun();
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  }, abort.signal);
  try {
    await bounded(entered.promise); abort.abort();
    const cancelled = await bounded(retry);
    if (!b) throw new Error("Retry terminal callback did not start B");
    const resultB = await bounded(b);
    expect(nested).toBe(cancelled);
    expect(cancelled.runOutcome?.execution).toBe("cancelled");
    expect(events.filter(event => event.type === "run_recap")).toHaveLength(1);
    expect(resultB.runOutcome?.execution).toBe("response-final");
    expect(session.getRunOutcome()).toEqual(resultB.runOutcome);
  } finally { release.resolve(final); await bounded(retry); if (b) await bounded(b); }
});

it("milestone callback replacement preserves actual A content and applies only B's new item", async () => {
  let replacing = false; let aRound = 0; let bRound = 0;
  let b: Promise<TurnResult> | undefined;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => {
      if (replacing) return bRound++ === 0 ? tools({ name: "upsert_item", args: { item: { id: "item_B", name: "B item", price: 37 } } }) : final;
      if (aRound++ === 0) return tools({ name: "set_work_plan", args: { goal: "Title", layers: [{ title: "Title",
        items: [{ title: "Title", instruction: "Title", successTools: ["set_title_screen"] }] }] } });
      return aRound === 2 ? tools({ name: "set_title_screen", args: { title: "A_APPLIED" } }) : final;
    }) });
  const a = session.sendUserMessage("A", event => {
    if (event.type !== "milestone_applied" || replacing) return;
    replacing = true;
    session.retireRun();
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  }, undefined, { autonomous: true });
  try {
    const cancelled = await bounded(a);
    if (!b) throw new Error("Applied milestone did not start B");
    const resultB = await bounded(b);
    expect(cancelled.appliedCalls?.map(call => call.args.title)).toEqual(["A_APPLIED"]);
    expect(cancelled.proposedCalls).toEqual([]);
    expect(resultB.proposedCalls.map(call => call.name)).toEqual(["upsert_item"]);
    const applied = await applyProposedProject(session.getProposedProject(), { base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "B", toolNames: ["upsert_item"], operation: session.getRunOperation() });
    expect(applied.ok).toBe(true);
    expect(store.getCurrent().system.titleScreen?.title).toBe("A_APPLIED");
    expect(store.getCurrent().database.items.find(item => item.id === "item_B")?.price).toBe(37);
  } finally { await bounded(a); if (b) await bounded(b); }
});

it("the runner continuation cannot apply or prove with a session operation replaced inside A's callback", async () => {
  const restoreDom = installFakeDom();
  vi.spyOn(activityLog, "recordAiActivity").mockImplementation(async entry => activityLog.buildAiActivityLogRecord(entry));
  const enteredB = deferred<void>(); const releaseB = deferred<ChatResult>();
  let replacing = false; let round = 0;
  let b: Promise<TurnResult> | undefined;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => {
      if (replacing) { enteredB.resolve(); return releaseB.promise; }
      return round++ === 0 ? tools({ name: "set_title_screen", args: { title: "A_DRAFT" } }) : final;
    }) });
  const f = epochRunner(session);
  const proof = vi.spyOn(session, "proveAppliedRevision");
  const a = f.runner.executeTurn(session, "A", (onEvent, signal) => session.sendUserMessage("A", event => {
    onEvent(event);
    if (event.type !== "run_outcome" || replacing) return;
    replacing = true;
    b = session.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  }, signal));
  try {
    await bounded(enteredB.promise);
    const snapshot = structuredClone(session.getHarnessSnapshot());
    const ownerB = session.getRunOperation();
    await bounded(a);
    expect(f.deps.applyProposal).not.toHaveBeenCalled();
    expect(proof).not.toHaveBeenCalled();
    expect(ownerB.signal.aborted).toBe(false);
    expect(session.getHarnessSnapshot()).toEqual(snapshot);
    expect.soft(f.surface.turnBusy).toBe(false);
    expect.soft(f.surface.activeAbortController).toBeNull();
    releaseB.resolve(final);
    if (!b) throw new Error("Session callback did not start B");
    expect((await bounded(b)).stoppedReason).toBe("final");
    const next = await bounded(f.send("C", { goalAction: "new-goal" }));
    expect(next.stoppedReason).toBe("final");
    expect(next.runOutcome?.execution).toBe("response-final");
    expect(f.surface.turnBusy).toBe(false);
    expect(f.surface.activeAbortController).toBeNull();
  } finally { releaseB.resolve(final); await bounded(a); if (b) await bounded(b); restoreDom(); }
});
