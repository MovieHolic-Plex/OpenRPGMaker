import { afterEach, expect, it, vi } from "vitest";
import { AssistantSession, type AssistantSessionOptions, type SessionEvent, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createProjectWikiCoordinator, type WikiCoordinatorDependencies, type WikiDeliveryMilestone, type WikiTurnInput } from "@/editor/projectWikiCoordinator";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { ExtractProjectWikiInput } from "@/ai/projectWikiClient";
import type { ProjectWikiPatch } from "@/project/world";
import { fixedDeclarer } from "./intentFixture";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";

afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

function patch(input: ExtractProjectWikiInput): ProjectWikiPatch {
  return { upserts: [{
    id: "w_ultra", type: "guideline", name: "Combat", summary: "Contact battles",
    wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sourceIds: input.sources.map(source => source.id) },
  }] };
}

function fixture(overrides: Partial<WikiCoordinatorDependencies> = {}, prepare?: AssistantSessionOptions["prepareProjectWiki"]) {
  const coordinator = createProjectWikiCoordinator({ history: async () => [], extract: async input => patch(input), ...overrides });
  const authored = vi.fn(async (): Promise<ChatResult> => ({ message: { role: "assistant", content: "RESULT" }, finishReason: "stop" }));
  const events: SessionEvent[] = [];
  const session = new AssistantSession(store.getCurrent(), { config: { ...defaultAiConfig(), agentMode: "chat" },
    prepareProjectWiki: prepare ?? coordinator.prepare, declareIntent: fixedDeclarer({ mode: "other" }), chat: authored });
  return { session, authored, events, run: (signal?: AbortSignal) => session.sendUserMessage("Use contact battles", event => events.push(event), signal) };
}

function localStore() {
  vi.useFakeTimers(); resetIntentDeclarationCache();
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createEmptyToolProject("Isolated review fixture")); resetMapEditHistory();
}

// Captured world-authoring source remains uncovered: wiki delivery alone is not goal proof.
function agreement(f: ReturnType<typeof fixture>, result: TurnResult, expected: NonNullable<TurnResult["runOutcome"]>) {
  expect(f.session.getAcceptanceSnapshot()?.items).toMatchObject([{ id: "request-1:source:0", required: true,
    coverage: "uncovered", status: "blocked", source: { text: "Use contact battles" },
    sourceSpan: { start: 0, end: 19, quote: "Use contact battles" }, evidence: [] }]);
  expect(f.session.getAcceptanceSnapshot()?.items).toHaveLength(1);
  expect(result.runOutcome).toEqual(expected);
  expect(f.session.getRunOutcome()).toEqual(expected);
  expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
  expect(result.recap?.runOutcome).toEqual(expected);
  expect(f.events.filter(event => event.type === "run_outcome").at(-1)?.runOutcome).toEqual(expected);
  expect(result.proposedCalls).toEqual([]);
  expect(result.appliedCalls).toEqual([]); // Wiki ownership never fabricates authoring tool calls.
}

it("a real wiki write preceding a checkpoint failure is applied, not no-change", async () => {
  localStore();
  const f = fixture();
  const result = await f.run();
  expect(store.getCurrent().world?.entities[0]?.id).toBe("w_ultra");
  expect(store.hasUnsavedChanges()).toBe(true);
  expect(f.authored).not.toHaveBeenCalled();
  expect(result.stoppedReason).toBe("error");
  agreement(f, result, { execution: "failed", goal: "incomplete", delivery: "applied" });
});

it("retains the real apply when cancellation happens in the live store subscriber", async () => {
  localStore();
  const controller = new AbortController();
  const unsubscribe = store.subscribe(() => { if (store.getCurrent().world?.entities.length) controller.abort(); });
  try {
    const f = fixture();
    const result = await f.run(controller.signal);
    expect(store.getCurrent().world?.entities[0]?.id).toBe("w_ultra");
    expect(f.authored).not.toHaveBeenCalled();
    agreement(f, result, { execution: "cancelled", goal: "incomplete", delivery: "applied" });
  } finally { unsubscribe(); }
});

it("owns history backfill even when its checkpoint fails before current extraction", async () => {
  localStore();
  const extract = vi.fn(async (input: ExtractProjectWikiInput) => patch(input));
  const f = fixture({ history: async () => [{ id: "old-user", kind: "user", text: "Contact combat", at: 1 }], extract });
  const result = await f.run();
  expect(extract).toHaveBeenCalledTimes(1);
  expect(store.getCurrent().world?.entities[0]?.wiki?.sources[0]?.id).toBe("old-user");
  agreement(f, result, { execution: "failed", goal: "incomplete", delivery: "applied" });
});

it("keeps empty extraction no-change without requiring an unloaded save", async () => {
  localStore();
  const before = store.getCurrent();
  const f = fixture({ extract: async () => ({ upserts: [] }) });
  const result = await f.run();
  expect(store.getCurrent()).toBe(before);
  expect(f.authored).toHaveBeenCalledTimes(1);
  agreement(f, result, { execution: "blocked", goal: "incomplete", delivery: "no-change" });
});

it("owns successful real save, consumes its current proof, and rechecks freshness without mutating history", async () => {
  applyFixture();
  const f = fixture();
  const result = await f.run();
  expect(store.getCurrent().world?.entities[0]?.wiki?.combatMode).toBe("contact");
  expect(f.session.getProposedProject().world).toEqual(store.getCurrent().world);
  expect(store.hasUnsavedChanges()).toBe(false);
  expect(f.authored).toHaveBeenCalledTimes(1);
  agreement(f, result, { execution: "blocked", goal: "incomplete", delivery: "persisted" });
  const proof = await f.session.proveAppliedRevision(event => f.events.push(event));
  expect(proof).toMatchObject({ status: "succeeded", verified: true, commitId: null });
  expect(proof.receipt && store.isPersistenceReceiptCurrent(proof.receipt)).toBe(true);
  agreement(f, result, { execution: "blocked", goal: "incomplete", delivery: "persisted-verified" });
  store.update(project => { project.meta.title = "Later human edit"; });
  expect(f.session.getRunOutcome()?.delivery).toBe("persisted");
  expect(result.runOutcome?.delivery).toBe("persisted-verified"); // Historical publication, not current proof.
});

it.each(["human-edit", "cancellation"])("retains the accepted wiki version when %s follows save before callback delivery", async afterSave => {
  applyFixture();
  const controller = new AbortController();
  const f = fixture({ flush: async () => {
    const saved = await store.flush();
    if (saved.kind !== "saved" || !saved.receipt) throw new Error("Wiki did not reach real accepted persistence");
    if (afterSave === "human-edit") store.update(project => { project.meta.title = "Human edit after acceptance"; });
    else controller.abort();
    return saved;
  } });
  const result = await f.run(controller.signal);
  agreement(f, result, { execution: afterSave === "cancellation" ? "cancelled" : "blocked", goal: "incomplete", delivery: "persisted" });
  expect(f.session.getRunEndProof()?.verified ?? false).toBe(false);
  if (afterSave === "human-edit") {
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.getCurrent().meta.title).toBe("Human edit after acceptance");
  } else expect(f.authored).not.toHaveBeenCalled();
});

it.each(["human-edit", "cancellation"])("retains an accepted wiki retry without current proof after %s", async afterSave => {
  applyFixture();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const f = fixture();
  const result = await f.run();
  const owned = store.getCurrent();
  expect(result.runOutcome?.delivery).toBe("applied");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  const flush = store.flush.bind(store);
  const controller = new AbortController();
  vi.spyOn(store, "flush").mockImplementation(async () => {
    const saved = await flush();
    if (saved.kind !== "saved" || !saved.receipt) throw new Error("Retry did not actually save");
    expect(store.isPersistenceReceiptForProject(saved.receipt, owned)).toBe(true);
    expect(store.isPersistenceReceiptForProject({ ...saved.receipt }, owned)).toBe(false);
    if (afterSave === "human-edit") store.update(project => { project.meta.title = "Human edit after retry"; });
    else controller.abort();
    return saved;
  });
  const proof = await f.session.proveAppliedRevision(event => f.events.push(event), controller.signal);
  expect(proof).toMatchObject({ status: "failed", verified: false, reason: afterSave === "human-edit" ? "stale" : "cancelled" });
  agreement(f, result, { execution: afterSave === "human-edit" ? "failed" : "cancelled", goal: "incomplete", delivery: "persisted" });
});

it("does not own a previous wiki write or its clean-flush receipt on empty extraction", async () => {
  applyFixture();
  await createProjectWikiCoordinator({ history: async () => [], extract: async input => patch(input) })
    .prepare({ text: "Earlier request", mapId: null, composerMode: "do" });
  const saved = await store.flush();
  expect(saved.kind === "saved" && !!saved.receipt).toBe(true);
  const f = fixture({ extract: async () => ({ upserts: [] }) });
  agreement(f, await f.run(), { execution: "blocked", goal: "incomplete", delivery: "no-change" });
});

it.each(["stale", "foreign", "missing"])("rejects %s checkpoint receipts for a real wiki apply", async kind => {
  applyFixture();
  const previous = await store.flush();
  if (previous.kind !== "saved" || !previous.receipt) throw new Error("Fixture did not save a real revision");
  const receipt = previous.receipt;
  const f = fixture({ flush: async () => {
    if (kind === "missing") return { kind: "saved" };
    if (kind === "foreign") {
      const current = await store.flush();
      if (current.kind !== "saved" || !current.receipt) throw new Error("No current receipt to copy");
      return { kind: "saved", receipt: { ...current.receipt } };
    }
    return { kind: "saved", receipt };
  } });
  agreement(f, await f.run(), { execution: "blocked", goal: "incomplete", delivery: "applied" });
});

it.each(["subscriber", "flush"])("does not claim an unrelated human revision saved during %s", async boundary => {
  applyFixture();
  let edited = false;
  const edit = () => { edited = true; store.update(project => { project.meta.title = "Concurrent human edit"; }); };
  const unsubscribe = store.subscribe(() => { if (boundary === "subscriber" && !edited && store.getCurrent().world?.entities.length) edit(); });
  try {
    const f = fixture(boundary === "flush" ? { flush: async () => { edit(); return store.flush(); } } : {});
    const result = await f.run();
    expect(edited).toBe(true);
    expect(store.getCurrent().meta.title).toBe("Concurrent human edit");
    expect(store.hasUnsavedChanges()).toBe(false);
    agreement(f, result, { execution: "blocked", goal: "incomplete", delivery: "applied" });
    await f.session.proveAppliedRevision(event => f.events.push(event));
    agreement(f, result, { execution: "blocked", goal: "incomplete", delivery: "applied" });
  } finally { unsubscribe(); }
});

it("ignores late old wiki callbacks after a newer run without rewriting either result", async () => {
  applyFixture();
  let callback: WikiTurnInput["onDelivery"];
  const milestones: WikiDeliveryMilestone[] = [];
  const coordinator = createProjectWikiCoordinator({ history: async () => [], extract: async input => patch(input) });
  const f = fixture({}, async input => {
    callback = input.onDelivery;
    return coordinator.prepare({ ...input, onDelivery: milestone => { milestones.push(milestone); input.onDelivery?.(milestone); } });
  });
  const old = await f.run();
  const oldOutcome = old.runOutcome;
  const oldCallback = callback;
  expect(milestones.map(milestone => milestone.kind)).toEqual(["applied", "persisted"]);
  const newer = await f.session.sendUserMessage("What changed?", event => f.events.push(event), undefined, { composerMode: "ask" });
  const count = f.events.length;
  milestones.forEach(milestone => oldCallback?.(milestone));
  expect(f.events).toHaveLength(count);
  expect(old.runOutcome).toBe(oldOutcome);
  agreement(f, newer, { execution: "response-final", goal: "incomplete", delivery: "no-change" });
});

it.each([true, false])("carries the actual observed wiki apply through the ordinary apply result with save=%s", async save => {
  const f = applyFixture();
  await createProjectWikiCoordinator({ history: async () => [], extract: async input => patch(input) })
    .prepare({ text: "Earlier declaration", mapId: null, composerMode: "do" });
  const result = await f.run();
  if (!save) store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const applied = await applyProposedProject(f.session.getProposedProject(), {
    source: "agent", summary: "Title edit", toolNames: ["set_title_screen"],
  });
  if (!applied.ok) throw new Error(applied.issue);
  expect(store.getCurrent().world?.entities.some(entity => entity.wiki?.kind === "progress")).toBe(true);
  expect(applied.wikiDelivery?.kind).toBe(save ? "persisted" : "applied");
  expect(applied.wikiDelivery?.project).toBe(store.getCurrent());
  expect(applied.commitProject).not.toBe(store.getCurrent());
  f.session.recordAppliedProject(applied);
  expect(result.runOutcome?.delivery).toBe(save ? "persisted" : "applied");
  expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen"]);
  if (save) {
    const proof = await f.session.proveAppliedRevision();
    expect(proof).toMatchObject({ status: "succeeded", verified: true, commitId: null });
    expect(result.runOutcome?.delivery).toBe("persisted-verified");
  } else {
    expect(applied.wikiWarning).toBeDefined(); // Preserve the existing optional progress-warning policy.
  }
});
