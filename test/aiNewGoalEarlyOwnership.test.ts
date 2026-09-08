import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type SessionTurnOptions, type TurnResult } from "@/ai/assistantSession";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import type { RunOutcome } from "@/ai/runOutcome";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { fixedDeclarer } from "./intentFixture";
import { plan, skip, type Call } from "./requiredOutcomeFixture";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";

beforeEach(resetIntentDeclarationCache);
afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
function tools(calls: readonly Call[]): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: calls.map((call, index) => ({
    id: `call-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
  })) }, finishReason: "tool_calls" };
}

function goalFixture() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing new-goal fixture map");
  const size = { id: "size", title: "Size", criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height }] };
  let response = tools([plan([size], ["size"]), skip]);
  let intent: Partial<IntentDeclaration> = { mode: "other" };
  let boundaryHook: (boundary: "wiki" | "intent", signal?: AbortSignal) => void = () => {};
  const events: SessionEvent[] = [];
  const boundaries: string[] = [];
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
    yieldToUi: cooperativeNodeYield,
    prepareProjectWiki: async input => { boundaries.push("wiki"); boundaryHook("wiki", input.signal); return undefined; },
    declareIntent: async (facts, signal) => { boundaries.push("intent"); boundaryHook("intent", signal); return fixedDeclarer(intent)(facts); },
    chat: async () => { const next = response; response = final; return next; },
  });
  return {
    session, events, boundaries, map, size,
    respond(calls: readonly Call[]) { response = tools(calls); },
    setIntent(value: Partial<IntentDeclaration>) { intent = value; },
    atBoundary(hook: typeof boundaryHook) { boundaryHook = hook; },
    send(text: string, options: SessionTurnOptions = {}, signal?: AbortSignal) {
      events.length = 0; boundaries.length = 0;
      return session.sendUserMessage(text, event => events.push(event), signal, options);
    },
  };
}

function agreement(session: AssistantSession, result: TurnResult, events: readonly SessionEvent[], outcome: RunOutcome): void {
  expect(result.runOutcome).toEqual(outcome);
  expect(session.getRunOutcome()).toEqual(outcome);
  expect(session.getHarnessSnapshot().runOutcome).toEqual(outcome);
  expect(result.recap?.runOutcome).toEqual(outcome);
  expect(events.filter(event => event.type === "run_outcome").map(event => event.runOutcome)).toEqual([outcome, outcome]);
  expect(events.filter(event => event.type === "run_recap").map(event => event.recap.runOutcome)).toEqual([outcome]);
  const recapAudit = session.getAuditEntries().filter(entry => entry.kind === "status" && entry.text?.startsWith("run-recap ")).at(-1);
  if (recapAudit?.kind !== "status") throw new Error("Missing serialized public recap");
  const serialized: unknown = JSON.parse(recapAudit.text.slice("run-recap ".length));
  expect(serialized).toMatchObject({ runOutcome: outcome });
}

async function assessed(f: ReturnType<typeof goalFixture>) {
  const result = await f.send("Inspect the original map");
  const snapshot = f.session.getAcceptanceSnapshot();
  if (!snapshot) throw new Error("Real plan failed to establish canonical assessment");
  expect(f.events.find(event => event.type === "tool_call" && event.name === "set_work_plan")).toMatchObject({ result: { ok: true } });
  expect(f.session.getWorkPlan()?.layers[0]?.items[0]).toMatchObject({ status: "skipped", requirementIds: ["size"] });
  expect(snapshot).toMatchObject({ status: "verified", items: [{ id: "size", required: true, mapId: f.map.id, evidence: [{ passed: true }] }] });
  const criterion: unknown = JSON.parse(snapshot.items[0]?.evidence[0]?.expected ?? "null");
  expect(criterion).toEqual(f.size.criteria[0]);
  agreement(f.session, result, f.events, { execution: "response-final", goal: "satisfied", delivery: "no-change" });
  return { result, snapshot, originalResult: structuredClone(result) };
}

describe("host new-goal early ownership", () => {
  describe.each(["wiki", "intent"] as const)("%s boundary", boundary => {
    it.each(["failure", "cancel-in-boundary", "already-aborted"] as const)("archives real satisfaction before %s", async ending => {
      const f = goalFixture();
      const old = await assessed(f);
      const controller = new AbortController();
      if (ending === "already-aborted") controller.abort();
      let atBoundary: AcceptanceSnapshot | null | undefined;
      let boundaryHistory: readonly AcceptanceSnapshot[] = [];
      f.atBoundary((current, signal) => {
        if (current !== boundary) return;
        atBoundary = f.session.getAcceptanceSnapshot();
        boundaryHistory = f.session.getAcceptanceHistory();
        if (ending === "cancel-in-boundary") controller.abort();
        signal?.throwIfAborted();
        throw new Error(`${boundary}-entry-failure`);
      });
      // Public entry runs synchronously to its first await; ownership must already have moved.
      const pending = f.send("Start a completely different goal", { goalAction: "new-goal" }, controller.signal);
      const atEntry = f.session.getAcceptanceSnapshot();
      const next = await pending;
      const expected: RunOutcome = { execution: ending === "failure" ? "failed" : "cancelled", goal: "unassessed", delivery: "no-change" };
      console.log("R2_PUBLIC_ENTRY", JSON.stringify({ boundary, ending, dimensions: { mapId: f.map.id, width: f.map.width, height: f.map.height }, old: old.snapshot,
        atEntry, atBoundary, boundaryHistory, next: next.runOutcome, getter: f.session.getRunOutcome(), harness: f.session.getHarnessSnapshot().runOutcome,
        recap: next.recap?.runOutcome, history: f.session.getAcceptanceHistory(), events: f.events.filter(event => ["acceptance", "run_outcome", "run_recap"].includes(event.type)), oldResultUnchanged: JSON.stringify(old.result) === JSON.stringify(old.originalResult) }));
      expect(next.stoppedReason).toBe(ending === "failure" ? "error" : "aborted");
      agreement(f.session, next, f.events, expected);
      expect(atEntry).toBeNull();
      // P3 retires execution before dispatch when the signal is already aborted.
      // The public goal/archive assertions below still run for every entry.
      if (ending === "already-aborted") {
        expect(atBoundary).toBeUndefined();
        expect(boundaryHistory).toEqual([]);
        expect(f.boundaries).toEqual([]);
      } else {
        expect(atBoundary).toBeNull();
        expect(boundaryHistory).toEqual([old.snapshot]);
        expect(f.boundaries).toEqual(boundary === "wiki" ? ["wiki"] : ["wiki", "intent"]);
      }
      expect(f.session.getWorkPlan()).toBeNull();
      expect(f.session.getAcceptanceSnapshot()).toBeNull();
      expect(f.session.getAcceptanceHistory()).toEqual([old.snapshot]);
      expect(f.session.getAcceptanceHistory()[0]).toBe(old.snapshot);
      expect(f.events.filter(event => event.type === "acceptance")).toEqual([{ type: "acceptance", snapshot: null }]);
      expect(old.result).toEqual(old.originalResult);
    });
  });

  it("archives once across repeated failed entries and keeps history immutable through later assessment and withdrawal", async () => {
    const f = goalFixture();
    const old = await assessed(f);
    const historyBefore = f.session.getAcceptanceHistory();
    const scope = { mapId: f.map.id, region: { x: 1, y: 2, width: 3, height: 4 } };
    f.atBoundary(() => { throw new Error("wiki-entry-failure"); });
    for (const instruction of ["First failed owner", "Second failed owner"]) {
      const failed = await f.send("Transport envelope", { goalAction: "new-goal", instruction, scope });
      agreement(f.session, failed, f.events, { execution: "failed", goal: "unassessed", delivery: "no-change" });
      expect(f.session.getAcceptanceHistory()).toEqual([old.snapshot]);
    }
    expect(historyBefore).toEqual([]);
    const history = f.session.getAcceptanceHistory();
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(old.snapshot)).toBe(true);
    expect(Object.isFrozen(old.snapshot.items)).toBe(true);
    expect(Object.isFrozen(old.snapshot.items[0])).toBe(true);
    expect(Object.isFrozen(old.snapshot.items[0]?.source)).toBe(true);
    expect(Object.isFrozen(old.snapshot.items[0]?.evidence[0])).toBe(true);
    f.atBoundary(() => {});
    f.respond([plan([{ ...f.size, criteria: [{ ...f.size.criteria[0], width: f.map.width + 1 }] }]), skip]);
    const resumed = await f.send("Retry the new owner", { goalAction: "resume" });
    agreement(f.session, resumed, f.events, { execution: "blocked", goal: "incomplete", delivery: "no-change" });
    const current = f.session.getAcceptanceSnapshot();
    if (!current) throw new Error("Missing resumed assessment");
    expect(current.id).not.toBe(old.snapshot.id);
    expect(current.items[0]?.source).toMatchObject({ text: "Second failed owner", scope });
    expect(f.session.withdrawRequirement({ acceptanceId: old.snapshot.id, requirementId: "size", reason: "Stale historical action" })).toBe(false);
    expect(f.session.withdrawRequirement({ acceptanceId: current.id, requirementId: "size", reason: "Current scoped action" })).toBe(true);
    f.session.refreshAcceptance(f.session.baselineProject);
    expect(f.session.getAcceptanceHistory()[0]).toBe(old.snapshot);
    expect(f.session.getAcceptanceHistory()).toEqual(history);
    expect(old.result).toEqual(old.originalResult);
    const completedCurrent = f.session.getAcceptanceSnapshot();
    await f.send("Third owner", { goalAction: "new-goal" });
    expect(f.session.getAcceptanceHistory()).toEqual([old.snapshot, completedCurrent]);
    expect(history).toEqual([old.snapshot]);
  });

  it("captures the failed new owner's pre-await baseline rather than the old request or a later resume", async () => {
    const f = goalFixture();
    await assessed(f);
    const newBaseline = structuredClone(f.session.baselineProject);
    const map = newBaseline.maps[f.map.id];
    if (!map) throw new Error("Missing baseline map");
    map.name = "New owner baseline";
    f.session.rebaseProject(newBaseline);
    f.atBoundary(() => { throw new Error("wiki-entry-failure"); });
    await f.send("Preserve this map", { goalAction: "new-goal" });
    f.atBoundary(() => {});
    f.respond([plan([{ id: "preserve", title: "Preserve", criteria: [{ kind: "preserve", target: { mapId: f.map.id } }] }]), skip]);
    const resumed = await f.send("Resume preserving", { goalAction: "resume" });
    agreement(f.session, resumed, f.events, { execution: "response-final", goal: "satisfied", delivery: "no-change" });
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.source?.text).toBe("Preserve this map");
  });

  it.each(["ask", "inferred-question", "model-reset", "model-continuation", "ask-new-goal"] as const)("retains the current assessment for %s without new host authority", async mode => {
    const f = goalFixture();
    const old = await assessed(f);
    if (mode === "inferred-question") f.setIntent({ mode: "question" });
    if (mode === "model-reset") f.setIntent({ mode: "other", resetsContext: true });
    if (mode === "model-continuation") f.setIntent({ mode: "other", source: "continuation" });
    const result = await f.send("Explain the current goal", mode === "ask" || mode === "ask-new-goal"
      ? { composerMode: "ask", ...(mode === "ask-new-goal" ? { goalAction: "new-goal" } : {}) } : {});
    agreement(f.session, result, f.events, { execution: "response-final", goal: "satisfied", delivery: "no-change" });
    expect(f.session.getAcceptanceSnapshot()).toEqual(old.snapshot);
    expect(f.session.getAcceptanceHistory()).toEqual([]);
    expect(old.result).toEqual(old.originalResult);
  });

  it("does not let a model question classification undo explicit host new-goal ownership", async () => {
    const f = goalFixture();
    const old = await assessed(f);
    f.setIntent({ mode: "question", resetsContext: false, source: "continuation" });
    const result = await f.send("A different goal", { goalAction: "new-goal" });
    agreement(f.session, result, f.events, { execution: "response-final", goal: "unassessed", delivery: "no-change" });
    expect(f.session.getAcceptanceHistory()).toEqual([old.snapshot]);
    expect(f.session.getAcceptanceSnapshot()).toBeNull();
  });

  it.each(["same-goal", "resume"] as const)("retains genuine satisfaction and owned delivery as appropriate on %s failure", async mode => {
    let round = 0;
    let fault = false;
    const f = applyFixture(async () => {
      if (round++ > 0) return final;
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("Missing applied map");
      return tools([plan([{ id: "size", title: "Size", criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height }] }]), skip,
        { name: "set_title_screen", args: { title: "Owned delivery" } }]);
    }, async facts => {
      if (fault) throw new Error("intent-entry-failure");
      return fixedDeclarer({ mode: "other" })(facts);
    }, undefined, cooperativeNodeYield);
    const first = await f.run();
    expect(first.review?.status).toBe("approved");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    const applied = await applyProposedProject(f.session.getProposedProject(), { base: f.session.getProposalBase(), baseline: f.session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    await f.session.proveAppliedRevision();
    expect(first.runOutcome).toEqual({ execution: "response-final", goal: "satisfied", delivery: "persisted-verified" });
    const original = structuredClone(first);
    const snapshot = f.session.getAcceptanceSnapshot();
    fault = true; f.events.length = 0;
    const result = await f.session.sendUserMessage("Continue the current assessment", event => f.events.push(event), undefined, mode === "resume" ? { goalAction: "resume" } : {});
    const expected: RunOutcome = { execution: "failed", goal: "satisfied", delivery: mode === "resume" ? "persisted-verified" : "no-change" };
    agreement(f.session, result, f.events, expected);
    expect(f.session.getAcceptanceSnapshot()).toEqual(snapshot);
    expect(f.session.getAcceptanceHistory()).toEqual([]);
    expect(first).toEqual(original);
    console.log("R2_SAME_GOAL_CONTROL", JSON.stringify({ mode, outcome: result.runOutcome, history: f.session.getAcceptanceHistory() }));
  });
});
