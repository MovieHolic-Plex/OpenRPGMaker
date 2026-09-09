import { describe, expect, it } from "vitest";
import type { ProposedCall } from "@/ai/assistantSession";
import { constructionAuditFromResult } from "@/editor/construction/constructionAudit";
import { parseConstructionOutcome } from "@/editor/construction/parseConstructionOutcome";
import { changePreviewChips } from "@/editor/panels/aiChangePreview";
import { fallbackDiffParts } from "@/editor/panels/aiProposalSummary";
import { canAutoApplyProposal } from "@/editor/proposalSafety";
import { summarizeChanges } from "@/editor/tools/changeset";
import { countMonsterMetadataChanges } from "@/project/monsterMetadata";
import { summaryForDiff } from "@/project/projectCommitLog";
import { audioDescriptionProject } from "./helpers/audioDescriptionPersistenceTransport";

describe("monster metadata accounting", () => {
  it("keeps metadata-only changes visible when presenting proposal and commit summaries", () => {
    // Given
    const before = audioDescriptionProject(undefined);
    const after = { ...before, monsterMetadata: { orphan: { description: "VALUE" } } };
    const diff = summarizeChanges(before, after);
    const call: ProposedCall = { name: "fixture", args: {}, summary: "fixture", result: { ok: true, summary: "fixture", diff }, destructive: false, requiresApproval: false };
    // When
    const chips = changePreviewChips(diff);
    // Then
    expect(chips).toHaveLength(1);
    expect(fallbackDiffParts([call])).toHaveLength(1);
    expect(summaryForDiff(diff)).not.toBe(summaryForDiff(summarizeChanges(before, before)));
  });

  it.each([undefined, 0, 1])("preserves tile-only safety compatibility when metadata count is %j", count => {
    // Given
    const before = audioDescriptionProject(undefined);
    const after = structuredClone(before);
    const map = after.maps[after.startMapId];
    if (!map) throw new TypeError("Missing fixture map");
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    const legacy = summarizeChanges(before, before);
    delete legacy.monsterMetadataChanged;
    const diff = { ...legacy, tilesChanged: 1, ...(count === undefined ? {} : { monsterMetadataChanged: count }) };
    const call: ProposedCall = { name: "paint_tiles", args: { mapId: before.startMapId }, summary: "fixture", result: { ok: true, summary: "fixture", diff }, destructive: false, requiresApproval: false };
    // When
    const safe = canAutoApplyProposal({ calls: [call], before, after, currentMapId: before.startMapId });
    // Then
    expect(safe).toBe(count !== 1);
  });

  it.each([undefined, 0, 1])("parses optional metadata totals when a construction outcome count is %j", count => {
    // Given
    const project = audioDescriptionProject(undefined);
    const { warnings, ...legacy } = summarizeChanges(project, project);
    delete legacy.monsterMetadataChanged;
    const outcome = {
      executionOk: false, applied: false, outcome: "failed",
      requestedEntrypoint: "author_village", canonicalRoute: "author_village",
      selectedImplementation: "fixture", routeChanges: [],
      activityPersistence: "not-recorded", projectPersistence: "not-requested",
      target: { kind: "existing", mapId: "qa-map" }, counts: { requested: 1, actual: 0 },
      diff: { ...legacy, ...(count === undefined ? {} : { monsterMetadataChanged: count }) }, warnings,
    };
    // When
    const parsed = parseConstructionOutcome(outcome);
    // Then
    expect(parsed.diff).toMatchObject({ monsterMetadataChanged: count ?? 0 });
    const audit = constructionAuditFromResult({ resultData: { construction: outcome }, observation: "no-change" });
    if (count === 1) expect(audit).toBeNull();
    else expect(audit).toMatchObject({ outcome: "no-change" });
  });

  it("ignores record and field insertion order when override states remain equal", () => {
    // Given
    const before = { a: { name: "A", tags: ["a"] }, b: { description: "" } };
    const after = { b: { description: "" }, a: { tags: ["a"], name: "A" } };
    // When
    const count = countMonsterMetadataChanges(before, after);
    // Then
    expect(count).toBe(0);
  });
});
