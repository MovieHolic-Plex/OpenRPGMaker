import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";

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
    store.replace(live);

    const result = await applyProposedProject(proposed, {
      source: "agent", summary: "Title edit", toolNames: ["set_title_screen"],
    });

    expect(result.ok).toBe(true);
    expect(store.getCurrent().world).toEqual(live.world);
    expect(store.getCurrent().meta.title).toBe("New title");
  });
});
