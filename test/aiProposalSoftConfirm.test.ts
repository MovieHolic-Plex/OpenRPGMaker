// 융합 기계 제거 후에도 soft-confirm 수락 훅이 동작하는지 고정한다.
import { describe, expect, it } from "vitest";
import { collectVocabSoftConfirms, markSoftVocabApprovalsOnProject } from "@/editor/panels/aiProposalFusion";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

describe("soft-confirm 수락 (pendingBuilds 제거 후)", () => {
  it("proposedCalls의 vocabSoftConfirm을 수집해 origin:user로 마킹한다", () => {
    const project = createEmptyToolProject();
    const tilesetId = Object.keys(project.tilesets)[0];
    const tileset = project.tilesets[tilesetId];
    tileset.tileGroups = [...(tileset.tileGroups ?? []), {
      id: "g-soft", name: "soft 재료", role: "prop", defaultLayer: "lower",
      tileIds: [5], description: "", placementRules: "", origin: "ai",
    } as never];
    const calls = [{
      name: "place_props", args: {},
      result: { ok: true, summary: "", data: { vocabSoftConfirm: {
        kind: "group", groupId: "g-soft", tileIds: [5], name: "soft 재료", role: "prop", layerHome: "lower", tilesetId,
      } } },
    }] as never;
    expect(collectVocabSoftConfirms(calls).length).toBe(1);
    const marked = markSoftVocabApprovalsOnProject(project, calls);
    expect(marked).toBe(1);
    expect(project.tilesets[tilesetId].tileGroups?.find((g) => g.id === "g-soft")?.origin).toBe("user");
  });
});
