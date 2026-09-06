import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFixture } from "./runOutcomeApplyFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";

afterEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("run outcome actual application", () => {
  it.each(["verified", "failed", "cancelled"] as const)("settles the returned result when ordinary proof is %s", async (proof) => {
    // Given a real returned title draft and the native apply response.
    const f = applyFixture();
    const result = await f.run();
    const applied = await applyProposedProject(f.session.getProposedProject(), {
      source: "agent", summary: "Title", toolNames: result.proposedCalls.map(call => call.name),
    });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied);
    f.session.rebaseProject(store.getCurrent());
    const controller = new AbortController();
    if (proof === "failed") f.setProofResponse(() => Response.json([], { status: 503 }));
    // When the real receipt/proof path finishes (cancellation follows accepted save).
    await f.session.proveAppliedRevision(event => {
      f.events.push(event);
      if (proof === "cancelled" && event.type === "persistence_proof" && event.state.receipt) controller.abort();
    }, controller.signal);
    // Then the same result/recap and terminal event reflect settled delivery.
    const expected = { execution: proof === "cancelled" ? "cancelled" : "response-final", goal: "unassessed",
      delivery: proof === "verified" ? "persisted-verified" : "persisted" };
    expect(result).toHaveProperty("runOutcome", expected);
    expect(result.recap).toHaveProperty("runOutcome", expected);
    expect(result.proposedCalls).toHaveLength(0);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen"]);
    expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
  });

  it("refreshes the compact recap when proof settles after the returned draft", async () => {
    // Given a returned draft with an already published recap.
    const f = applyFixture();
    await f.run();
    const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    // When proof finishes after the original session return.
    await f.session.proveAppliedRevision();
    // Then the serialized audit recap is settled too, without duplicate recaps.
    const recaps = f.session.getAuditEntries().filter(entry => entry.kind === "status" && entry.text.startsWith("run-recap "));
    expect(recaps).toHaveLength(1);
    const entry = recaps[0];
    if (!entry || entry.kind !== "status") throw new Error("Missing recap");
    const payload: unknown = JSON.parse(entry.text.slice("run-recap ".length));
    expect(payload).toHaveProperty("runOutcome.delivery", "persisted-verified");
  });

  it("publishes apply rejection through the original session subscriber", async () => {
    // Given a returned draft whose owner subscribed before execution.
    const f = applyFixture();
    const result = await f.run();
    // When the host reports an actual rejection boundary.
    f.session.recordApplyRejected();
    // Then the original result and event agree while the draft remains pending.
    const expected = { execution: "failed", goal: "unassessed", delivery: "draft" };
    expect(result.runOutcome).toEqual(expected);
    expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
  });

  it("rechecks current proof without mutating the historical returned result", async () => {
    // Given a verified applied run.
    const f = applyFixture();
    const result = await f.run();
    const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    await f.session.proveAppliedRevision();
    store.update(project => { project.meta.title = "Later human edit"; });
    const before = f.session.getAuditEntries().length;
    // When a read-only getter projects currentness.
    const current = f.session.getRunOutcome();
    // Then only live projection loses verification; no save/event/history mutation occurs.
    expect(current?.delivery).toBe("persisted");
    expect(result.runOutcome?.delivery).toBe("persisted-verified");
    expect(f.session.getAuditEntries()).toHaveLength(before);
  });

  it("does not credit an old receipt when another user run only queries", async () => {
    // Given an applied and verified earlier run in the same session.
    const f = applyFixture();
    const first = await f.run();
    const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    await f.session.proveAppliedRevision();
    // When a new user message produces no writes.
    const next = await f.run();
    // Then the prior result stays historical and the new result owns no delivery.
    expect(first).toHaveProperty("runOutcome.delivery", "persisted-verified");
    expect(next).toHaveProperty("runOutcome", { execution: "response-final", goal: "unassessed", delivery: "no-change" });
  });
});
