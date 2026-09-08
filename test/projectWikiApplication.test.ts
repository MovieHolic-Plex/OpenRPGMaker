import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { applyRegionProjectWithHistory } from "@/editor/regionTask/runRegionTask";

vi.mock("@/project/projectCommitLog", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/project/projectCommitLog")>(),
  recordProjectCommit: async () => ({
    commitId: null,
    persisted: false,
    reviewStatus: "approved",
    summary: "Wiki application test",
    toolNames: [],
    recordedAt: "2026-09-07T00:00:00Z",
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wiki ownership at authoring application", () => {
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
      source: "agent", summary: "Title edit", toolNames: ["set_title_screen"],
    });

    expect(result.ok).toBe(true);
    expect(store.getCurrent().world).toEqual(live.world);
    expect(store.getCurrent().meta.title).toBe("New title");
  });
});
