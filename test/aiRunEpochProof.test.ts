import { afterEach, expect, it, vi } from "vitest";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { bounded, deferred } from "./aiEpochFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { store } from "@/project/store";

afterEach(async () => {
  await drainOutcomeFixtures();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

it.each(["save", "proof"])("A's delayed real %s result cannot change B, issue another proof, or rewrite historical A", async boundary => {
  const f = applyFixture();
  const a = await f.run();
  const applied = await applyProposedProject(f.session.getProposedProject(), { base: f.session.getProposalBase(), baseline: f.session.getDraftBaseline(), source: "agent", summary: "A", toolNames: ["set_title_screen"] });
  if (!applied.ok) throw new Error(applied.issue);
  f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
  const entered = deferred<void>(); const release = deferred<void>();
  const originalFlush = store.flush.bind(store);
  const originalVerify = store.verifyPersistedRevision.bind(store);
  const verify = vi.spyOn(store, "verifyPersistedRevision").mockImplementation(async (...args) => {
    const result = await originalVerify(...args);
    if (boundary === "proof") { entered.resolve(); await release.promise; }
    return result;
  });
  vi.spyOn(store, "flush").mockImplementation(async () => {
    const result = await originalFlush();
    if (boundary === "save") { entered.resolve(); await release.promise; }
    return result;
  });
  const proving = f.session.proveAppliedRevision(event => f.events.push(event));
  try {
    await bounded(entered.promise);
    // Replacement retires proof synchronously, before its old transport settles.
    const b = await bounded(f.session.sendUserMessage("B", event => f.events.push(event), undefined, { goalAction: "new-goal", composerMode: "ask" }));
    const snapshot = structuredClone(f.session.getHarnessSnapshot());
    const oldResult = structuredClone(a);
    const events = f.events.length;
    const writes = vi.fn(); const unsubscribe = store.subscribe(writes);
    try {
      release.resolve();
      expect(await bounded(proving)).toMatchObject({ status: "failed", reason: "cancelled", verified: false });
      expect(f.session.getHarnessSnapshot()).toEqual(snapshot);
      expect(f.session.getRunOutcome()).toEqual(b.runOutcome);
      expect(a).toEqual(oldResult);
      expect(f.events).toHaveLength(events);
      expect(verify).toHaveBeenCalledTimes(boundary === "proof" ? 1 : 0);
      expect(writes).not.toHaveBeenCalled();
      expect(store.getCurrent().system.titleScreen?.title).toBe("Run-owned title");
    } finally { unsubscribe(); }
  } finally { release.resolve(); await bounded(proving); }
});
