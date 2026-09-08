import { afterEach, expect, it, vi } from "vitest";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { defaultAiConfig, LlmError, type ChatResult } from "@/ai/llmClient";
import { clearTimeout, setTimeout } from "node:timers";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { fixedDeclarer } from "./intentFixture";
import type { TurnResult } from "@/ai/assistantSession";

const raw = "Resize map to 21x15";
const resizeDeclarer: IntentDeclarer = (facts, signal) => fixedDeclarer({ mode: "modify", requestRequirements: { entries: [{
  source: [{ start: 0, end: raw.length, quote: raw }],
  criteria: [{ kind: "mapDimensions", target: { mapId: store.getCurrent().startMapId }, width: 21, height: 15 }],
  bindings: [
    { source: { start: raw.indexOf("21"), end: raw.indexOf("21") + 2, quote: "21" }, role: "width", criterionIndex: 0, fieldPath: ["width"] },
    { source: { start: raw.indexOf("15"), end: raw.length, quote: "15" }, role: "height", criterionIndex: 0, fieldPath: ["height"] },
  ],
}] } })(facts, signal);
const ownedRuns = new Set<{ controller: AbortController; pending: Promise<TurnResult> }>();
async function bounded<T>(pending: Promise<T>, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller?.abort(); reject(new Error("Apply policy fixture completion deadline")); }, 10_000);
    })]);
  } finally { clearTimeout(timer); }
}
async function owned(controller: AbortController, start: () => Promise<TurnResult>): Promise<TurnResult> {
  const run = { controller, pending: start() };
  ownedRuns.add(run);
  try { return await bounded(run.pending, controller); }
  finally { controller.abort(); await bounded(run.pending); ownedRuns.delete(run); }
}

const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
function tool(name: string, args: Record<string, unknown>): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id: name, type: "function",
    function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}
function resizeContract() {
  const mapId = store.getCurrent().startMapId;
  return tool("set_work_plan", { goal: "Resize", requirements: [{ id: "size", title: "Size",
    criteria: [{ kind: "mapDimensions", target: { mapId }, width: 21, height: 15 }] }],
    layers: [{ title: "Resize", items: [{ id: "resize", title: "Resize", instruction: "Resize map", successTools: ["resize_map"] }] }],
  });
}
afterEach(async () => {
  try {
    for (const run of ownedRuns) run.controller.abort();
    await bounded(Promise.all([...ownedRuns].map(run => run.pending)));
    ownedRuns.clear();
    await drainOutcomeFixtures();
  }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

it.each([false, true])("settles the same verified requirement with milestone=%s", async autonomous => {
  // Given a canonical requirement that the existing applied map cannot satisfy.
  let round = 0;
  const f = applyFixture(async () => {
    switch (round++) {
      case 0: return resizeContract();
      case 1: return tool("resize_map", { mapId: store.getCurrent().startMapId, width: 21, height: 15 });
      default:
        if (autonomous) throw new LlmError("Unexpected resize fixture transport exhaustion", 401);
        return final;
    }
  }, resizeDeclarer);
  f.session.updateConfig({ ...defaultAiConfig(), model: "test", liteModel: "test", agentMode: "chat", maxToolCalls: 12, maxTokens: 8192 });
  const controller = new AbortController();
  const result = await owned(controller, () => f.session.sendUserMessage(raw, event => f.events.push(event), controller.signal, { autonomous }));
  if (!autonomous) {
    expect(f.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(result.runOutcome?.delivery).toBe("draft");
  }
  // When the ordinary path applies its actual pending result; milestone already used that same adapter.
  if (!autonomous) {
    const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "Resize", toolNames: ["resize_map"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied);
    f.session.rebaseProject(store.getCurrent());
    await f.session.proveAppliedRevision(event => f.events.push(event));
  }
  // Then both paths use the same post-apply completion policy and P1 proof authority.
  const expected = { execution: "response-final", goal: "satisfied", delivery: "persisted-verified" };
  expect(f.session.getAcceptanceSnapshot()?.status, JSON.stringify(f.session.getAcceptanceSnapshot())).toBe("verified");
  expect(f.session.getAcceptanceSnapshot()?.items).toMatchObject([
    { id: "request-1:source:0", required: true, coverage: "declared", status: "verified", evidence: [{ passed: true }] },
    { id: "size", required: true, status: "verified", evidence: [{ passed: true }] },
  ]);
  expect(f.session.getAcceptanceSnapshot()?.items.map(item => item.id)).toEqual(["request-1:source:0", "size"]);
  expect(result.appliedCalls?.map(call => call.name)).toEqual(["resize_map"]);
  expect(result.proposedCalls).toEqual([]);
  expect(result.runOutcome).toEqual(expected);
  expect(result.recap?.runOutcome).toEqual(expected);
  expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
  expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
});

it("uses the existing quick-reply stop decision without reclassifying response prose", async () => {
  // Given an unfinished legacy plan with the exact runtime quick-reply marker, without question prose.
  let round = 0;
  const f = applyFixture(async () => round++ === 0 ? tool("set_work_plan", {
    goal: "Title", layers: [{ title: "Title", items: [{ title: "Title", instruction: "Set title", successTools: ["set_title_screen"] }] }],
  }) : { message: { role: "assistant", content: `${QUICK_REPLY_MARKER} A | B` }, finishReason: "stop" });
  // When the real continuation policy pauses at its structured marker.
  const result = await f.run();
  // Then the carried stop reason is awaiting-user, not an independent text classifier's blocked guess.
  expect(result.runOutcome).toEqual({ execution: "awaiting-user", goal: "unassessed", delivery: "no-change" });
});

it.each(["blocked", "failed", "cancelled"] as const)("preserves genuine %s execution when an applied draft later verifies", async ending => {
  // Given a valid resize draft followed by an independent execution stop.
  let round = 0;
  const controller = new AbortController();
  const f = applyFixture(async () => {
    if (round++ === 0) return tool("set_work_plan", { goal: "Resize", requirements: [{ id: "size", title: "Size",
      criteria: [{ kind: "mapDimensions", target: { mapId: store.getCurrent().startMapId }, width: 21, height: 15 }] }],
      layers: [{ title: "Work", items: [{ title: "Work", instruction: "Resize and finish", successTools: ["upsert_item"] }] }],
    });
    if (round === 2) return tool("resize_map", { mapId: store.getCurrent().startMapId, width: 21, height: 15 });
    if (ending === "blocked") return tool("resize_map", { mapId: store.getCurrent().startMapId, width: 1, height: 1 });
    throw new LlmError("Transport fixture", 401);
  }, resizeDeclarer);
  f.session.updateConfig({ ...defaultAiConfig(), model: "test", liteModel: "test", agentMode: "chat", maxToolCalls: 12, maxTokens: 8192 });
  const result = await owned(controller, () => f.session.sendUserMessage(raw, event => {
    f.events.push(event);
    if (ending === "cancelled" && event.type === "tool_call" && event.name === "resize_map" && event.result.ok) controller.abort();
  }, controller.signal));
  expect(result.runOutcome?.execution).toBe(ending);
  if (ending === "blocked") {
    expect(f.events.filter(event => event.type === "tool_call" && event.name === "resize_map" && !event.result.ok)).not.toHaveLength(0);
    expect(f.events.find(event => event.type === "tool_call" && event.name === "resize_map" && !event.result.ok)).toMatchObject({
      args: { width: 1, height: 1 }, result: { ok: false },
    });
  }
  // When actual application satisfies the requirement after the genuine stop.
  const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "Resize", toolNames: ["resize_map"] });
  if (!applied.ok) throw new Error(applied.issue);
  f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
  await f.session.proveAppliedRevision();
  // Then satisfaction and persistence do not erase the independent execution failure/cancellation/block.
  expect(result.runOutcome).toEqual({ execution: ending, goal: "satisfied", delivery: "persisted-verified" });
  expect(f.session.getAcceptanceSnapshot()?.items.map(item => ({ id: item.id, required: item.required, status: item.status }))).toEqual([
    { id: "request-1:source:0", required: true, status: "verified" }, { id: "size", required: true, status: "verified" },
  ]);
});
