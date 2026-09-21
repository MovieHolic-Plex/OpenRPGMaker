import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { applyRegionProjectWithHistory } from "@/editor/regionTask/runRegionTask";
import { recordProjectCommit } from "@/project/projectCommitLog";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { manualWikiNote, wikiActivity } from "./fixtures/wikiActivity";

vi.mock("@/project/projectCommitLog", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/project/projectCommitLog")>(),
  recordProjectCommit: vi.fn(async () => ({
    commitId: null,
    persisted: false,
    reviewStatus: "approved",
    summary: "Wiki application test",
    toolNames: [],
    recordedAt: "2026-09-07T00:00:00Z",
  })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wiki ownership at authoring application", () => {
  it.each([false, true])("records repeated work only in history, including commit failure=%s", async (commitFails) => {
    const project = createBlankProject();
    project.world = { entities: [wikiActivity(), manualWikiNote], relations: [] };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    resetMapEditHistory();
    vi.mocked(recordProjectCommit).mockClear();
    const flush = vi.spyOn(store, "flush");
    for (let i = 0; i < 2; i++) {
      if (commitFails) vi.mocked(recordProjectCommit).mockRejectedValueOnce(new Error("commit unavailable"));
      const baseline = store.getCurrent();
      const proposed = structuredClone(baseline);
      proposed.meta.title = `제목 ${i}`;
      const result = await applyProposedProject(proposed, {
        base: captureProposalBase(baseline), baseline: new AuthoredProjectBaseline(baseline),
        source: "agent", summary: `제목 ${i}`, toolNames: ["set_title_screen"],
      });
      expect(result.ok).toBe(true);
      expect(store.getCurrent().world).toEqual(project.world);
      expect(store.getCurrent().meta.title).toBe(`제목 ${i}`);
    }
    expect(recordProjectCommit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(recordProjectCommit).mock.calls[1][0]).toMatchObject({ summary: "제목 1", toolNames: ["set_title_screen"] });
    expect(flush).not.toHaveBeenCalled();
    expect(getMapEditHistoryEntries()).toHaveLength(2);
  });

  it("preserves the live wiki when a region draft is applied", () => {
    const project = createBlankProject();
    const proposed = structuredClone(project);
    project.world = { entities: [{
      id: "w_new", type: "guideline", name: "New decision", summary: "Manual correction", origin: "user",
    }], relations: [] };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);

    applyRegionProjectWithHistory(proposed, "Region test", proposed.startMapId);

    expect(store.getCurrent().world).toEqual(project.world);
  });
  it("preserves newer manual wiki edits when an older authoring proposal is applied", async () => {
    const baseline = createBlankProject();
    baseline.world = {
      entities: [{ id: "w_combat", type: "guideline", name: "Combat", summary: "Old decision", origin: "user" }],
      relations: [],
    };
    const proposed = structuredClone(baseline);
    proposed.meta.title = "New title";
    const live = structuredClone(baseline);
    live.world = {
      entities: [{ id: "w_combat", type: "guideline", name: "Combat", summary: "Manual correction", origin: "user", locked: true }],
      relations: [],
    };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(baseline);
    const base = captureProposalBase(store.getCurrent());
    store.replace(live);

    const result = await applyProposedProject(proposed, {
      base,
      baseline: new AuthoredProjectBaseline(baseline),
      source: "agent", summary: "Title edit", toolNames: ["set_title_screen"],
    });

    expect(result.ok).toBe(true);
    expect(store.getCurrent().world).toEqual(live.world);
    expect(store.getCurrent().meta.title).toBe("New title");
  });
});
