import { describe, expect, it } from "vitest";

import { reassembleSelectedProposalProject } from "@/editor/panels/aiProposalSummary";
import * as applyChangesetToStore from "@/editor/tools/applyChangesetToStore";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ProposedCall } from "@/ai/assistantSession";

describe("canonical construction apply and undo policy", () => {
  it("uses map undo for existing targets and full-project undo for planned new targets", () => {
    // Given: the two canonical routes and their target variants.
    const candidate: unknown = Reflect.get(applyChangesetToStore, "toolUndoScope");
    expect(typeof candidate).toBe("function");
    if (typeof candidate !== "function") return;
    const existingHouse = candidate("author_house", { kind: "single", mapId: "m1" });
    const existingVillage = candidate("author_village", {
      target: { kind: "existing", mapId: "m1", bounds: { x: 2, y: 2, w: 10, h: 10 } },
    });
    const newVillage = candidate("author_village", {
      target: {
        kind: "new", mapId: "m2", name: "새 마을", width: 30, height: 28,
        plannedMap: { mapId: "m2", width: 30, height: 28 },
      },
    });

    // When/Then: existing writes are one-map snapshots; map creation is one project snapshot.
    expect(existingHouse).toEqual({ kind: "map", mapId: "m1" });
    expect(existingVillage).toEqual({ kind: "map", mapId: "m1" });
    expect(newVillage).toEqual({ kind: "project" });
  });

  it("never reruns a canonical facade while reassembling a partial proposal", () => {
    // Given: a canonical call whose preview already exists in the AssistantSession draft.
    const call: ProposedCall = {
      name: "author_house",
      args: { kind: "single", mapId: "m1", wings: [{ x: 2, y: 2, w: 7, h: 6 }] },
      summary: "previewed once",
      result: { ok: true, summary: "previewed once" },
      destructive: false,
      requiresApproval: false,
    };

    // When: a caller asks the legacy reassembly path to replay that selected call.
    const result = reassembleSelectedProposalProject(createEmptyToolProject(), [call], [true]);

    // Then: reassembly is rejected; full accept must commit getProposedProject() directly.
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      message: expect.stringContaining("preview"),
    }));
  });
});
