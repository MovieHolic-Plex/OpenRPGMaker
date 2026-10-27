import { describe, expect, it } from "vitest";
import { buildIndependentReviewRequest, reviewChanges, reviewMapReferenceRoots, type ReviewInput } from "@/ai/independentReview";
import { estimateContextTokens } from "@/ai/contextCompaction";
import { defaultAiConfig } from "@/ai/llmClient";
import { extractOriginalContext, originalContextWindow } from "@/ai/originalContext";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { independentReviewPayload } from "./independentReviewFixture";
// The 2026-10-07 default (beodeul_city, ~7MB) alone overflows complete review evidence; these window/scope cases keep the small retired sheet.
import { RETIRED_COMBINED_TOWN_TILESET_ID, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";

function reviewInput(before: Project, after: Project): ReviewInput {
  const changes = reviewChanges(before, after);
  const mapReferenceRoots = [before.startMapId, ...reviewMapReferenceRoots(before, after, changes)];
  return {
    revision: 1, originalRequest: "Rename the target map", changes,
    before: [extractOriginalContext(before, { snapshotId: "before", currentMapId: before.startMapId, mapReferenceRoots })],
    after: [extractOriginalContext(after, { snapshotId: "after", currentMapId: after.startMapId, mapReferenceRoots })],
    toolResults: [], acceptance: null, requiredProblems: [], images: [],
  };
}

describe("independent review map deltas", () => {
  it.each([false, true])("fits a complete small-map rename with five unchanged 256x256 maps (preset references: %s)", withPresets => {
    const before = startOnRetiredCombinedTown(createBlankProject());
    const target = before.maps[before.startMapId];
    if (!target) throw new Error("Blank project requires its start map");
    expect([target.width, target.height]).toEqual([20, 15]);
    for (let i = 0; i < 5; i++) {
      const id = `unchanged_${i}`;
      before.maps[id] = { ...createBlankMap(id, 256, 256, RETIRED_COMBINED_TOWN_TILESET_ID), id };
      if (withPresets) (before.testPresets ??= []).push({ id: `preset_${i}`, name: `Preset ${i}`,
        startMapId: id, startPos: { x: i + 1, y: i + 2 }, gold: 100 + i });
    }
    const after = structuredClone(before);
    const renamed = { ...structuredClone(target), name: "Renamed target" };
    after.maps[target.id] = renamed;
    const input = reviewInput(before, after);
    const config = defaultAiConfig();
    // 공장 기본 모델은 2026-10-14 에 gemini-4-argon 으로 바뀌었다(#2535, 조수 기본 = Argon medium).
    expect(config.model).toBe("gemini-4-argon");

    // Both whole-collection deltas and unconditional preset map closure overflow here.
    const request = buildIndependentReviewRequest(config, input);
    const delivered = independentReviewPayload(request);
    expect(delivered?.changes).toEqual([{ path: `/maps/${target.id}`, before: target, after: renamed }]);
    for (const side of ["before", "after"] as const) {
      const entries = delivered?.[side].flatMap(context => context.entries);
      expect(entries?.filter(entry => /^\/maps\/[^/]+$/.test(entry.id)).map(entry => entry.id))
        .toEqual([`/maps/${target.id}`]);
      expect(entries).toContainEqual({ id: "/session", value: before.session });
      if (withPresets) expect(entries).toContainEqual({ id: "/testPresets", value: before.testPresets });
      expect(delivered?.[side]).toEqual(input[side].map(context => ({ ...context,
        entries: context.entries.map(({ id, value }) => ({ id, value })) })));
    }
    expect(request.tools).toEqual([]);
    expect(request.tool_choice).toBe("none");
    expect(estimateContextTokens(request.messages) + Math.min(config.maxTokens, 16384))
      .toBeLessThanOrEqual(originalContextWindow(config));
  });

  it("retains complete changed, added and deleted maps and omits unchanged IDs", () => {
    const before = startOnRetiredCombinedTown(createBlankProject());
    const changed = { ...createBlankMap("Old map", 2, 2, RETIRED_COMBINED_TOWN_TILESET_ID), id: "changed",
      lowerTileStacks: { 0: [1, 2] }, upperTileStacks: { 3: [3, 4] },
      roomHarnessPlan: { kitId: "fixture", plan: { nested: { preserve: "complete values" } } } };
    const deleted = { ...createBlankMap("Deleted map", 3, 2, RETIRED_COMBINED_TOWN_TILESET_ID), id: "deleted" };
    before.maps[changed.id] = changed;
    before.maps[deleted.id] = deleted;
    const after = structuredClone(before);
    const revised = { ...structuredClone(changed), name: "New map", lowerTiles: [4, 3, 2, 1] };
    const added = { ...createBlankMap("Added map", 2, 3, RETIRED_COMBINED_TOWN_TILESET_ID), id: "added" };
    after.maps[changed.id] = revised;
    delete after.maps[deleted.id];
    after.maps[added.id] = added;

    expect(reviewChanges(before, after)).toEqual([
      { path: "/maps/changed", before: changed, after: revised },
      { path: "/maps/deleted", before: deleted, after: null },
      { path: "/maps/added", before: null, after: added },
    ]);
    expect(reviewChanges(before, structuredClone(before))).toEqual([]);
  });

  it("still refuses genuinely oversized complete changed-map evidence on the default reviewer", () => {
    const before = startOnRetiredCombinedTown(createBlankProject());
    const target = { ...createBlankMap("Large target", 512, 512, RETIRED_COMBINED_TOWN_TILESET_ID), id: before.startMapId };
    before.maps[target.id] = target;
    const after = structuredClone(before);
    after.maps[target.id] = { ...structuredClone(target), name: "Renamed large target" };
    const input = reviewInput(before, after);

    expect(() => buildIndependentReviewRequest(defaultAiConfig(), input))
      .toThrow("independent-review-window-exceeded");
  });
});
