import { afterEach, expect, it, vi } from "vitest";
import type { TurnResult } from "@/ai/assistantSession";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";

afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

it("does not settle a newer query when an old run's proof is cancelled", async () => {
  // Given a saved run whose proof transport completes after a new query.
  const f = applyFixture();
  const result = await f.run();
  expect(result.review?.status).toBe("approved");
  expect(f.session.isDraftReviewApproved()).toBe(true);
  const applied = await applyProposedProject(f.session.getProposedProject(), { baseline: f.session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
  if (!applied.ok) throw new Error(applied.issue);
  f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
  const controller = new AbortController();
  let query: TurnResult | undefined;
  f.setProofResponse(async () => {
    query = await f.run();
    controller.abort();
    return Response.json([]);
  });
  // When the old proof finishes with cancellation.
  await f.session.proveAppliedRevision(undefined, controller.signal);
  // Then only the old operation was cancelled, never the new query.
  expect(query?.runOutcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
  expect(f.session.getRunOutcome()).toEqual(query?.runOutcome);
});

it("rechecks a canonical no-write pass when the live assessed map changes", async () => {
  // Given a store-backed session with existing explicit canonical acceptance.
  let round = 0;
  const f = applyFixture(async () => round++ === 0 ? {
    message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
      name: "set_work_plan", arguments: JSON.stringify({ goal: "Size", requirements: [{ id: "size", title: "Size",
        criteria: [{ kind: "mapDimensions", target: { mapId: store.getCurrent().startMapId }, width: 20, height: 15 }] }],
        layers: [{ title: "Inspect", items: [{ title: "Inspect", instruction: "Inspect" }] }] }),
    } }, { id: "skip", type: "function", function: { name: "skip_work_item", arguments: "{}" } }] }, finishReason: "tool_calls",
  } : { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" });
  const result = await f.run();
  expect(result.runOutcome?.goal).toBe("satisfied");
  const snapshot = f.session.getAcceptanceSnapshot();
  const events = f.events.length;
  // When the assessed live map changes without an eager consumer refresh.
  store.update(project => {
    const map = project.maps[project.startMapId];
    if (map) {
      map.width = 19;
      map.lowerTiles = map.lowerTiles.slice(0, map.width * map.height);
      map.upperTiles = map.upperTiles.slice(0, map.width * map.height);
    }
  });
  // Then a read-only projection cannot reuse the old pass or mutate the ledger.
  expect(f.session.getRunOutcome()?.goal).toBe("incomplete");
  expect(f.session.getAcceptanceSnapshot()).toBe(snapshot);
  expect(f.events).toHaveLength(events);
});
