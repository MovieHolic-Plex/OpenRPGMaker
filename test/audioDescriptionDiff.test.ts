import { describe, expect, it } from "vitest";
import { proposalCallChangedSomething, proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import type { ProposedCall } from "@/ai/assistantSession";
import { constructionAuditFromResult } from "@/editor/construction/constructionAudit";
import { parseConstructionOutcome } from "@/editor/construction/parseConstructionOutcome";
import { changePreviewChips } from "@/editor/panels/aiChangePreview";
import { fallbackDiffParts } from "@/editor/panels/aiProposalSummary";
import { canAutoApplyProposal } from "@/editor/proposalSafety";
import { summarizeChanges } from "@/editor/tools/changeset";
import { createBlankProject } from "@/project/defaults";
import { combineDiffs, summaryForDiff } from "@/project/projectCommitLog";
import { audioDescriptionToolProject, MUSIC_ID } from "./support/audioDescriptionToolProject";

describe("audio description change summaries", () => {
  it("counts changed kind and ID states when values are added, cleared, or reset", () => {
    // Given
    const before = audioDescriptionToolProject();
    before.audioDescriptions = { music: { a: "", b: "old", c: "same" }, sound: { a: "sound" } };
    const after = structuredClone(before);
    after.audioDescriptions = { music: { b: "", c: "same", d: "new" } };
    // When
    const diff = summarizeChanges(before, after);
    // Then
    expect(diff).toMatchObject({ audioDescriptionsChanged: 4, tilesChanged: 0, systemChanged: false });
  });

  it("ignores record order when override states are unchanged", () => {
    // Given
    const before = audioDescriptionToolProject();
    before.audioDescriptions = { music: { a: "", b: "same" } };
    const after = structuredClone(before);
    after.audioDescriptions = { music: { b: "same", a: "" } };
    // When
    const diff = summarizeChanges(before, after);
    // Then
    expect(diff).toMatchObject({ audioDescriptionsChanged: 0 });
  });

  it("combines new counts while treating a legacy omitted count as zero", () => {
    // Given
    const project = audioDescriptionToolProject();
    const legacy = summarizeChanges(project, project);
    Reflect.deleteProperty(legacy, "audioDescriptionsChanged");
    const first = { ...legacy, audioDescriptionsChanged: 2 };
    const second = { ...legacy, audioDescriptionsChanged: 3 };
    // When
    const combined = combineDiffs([legacy, first, undefined, second]);
    // Then
    expect(combined).toMatchObject({ audioDescriptionsChanged: 5 });
  });

  it("keeps a description-only proposal meaningful and visible", () => {
    // Given
    const before = audioDescriptionToolProject();
    const after = structuredClone(before);
    after.audioDescriptions = { music: { [MUSIC_ID]: "sentinel" } };
    const diff = summarizeChanges(before, after);
    const call: ProposedCall = {
      name: "set_audio_description",
      args: { kind: "music", resourceId: MUSIC_ID, action: "set", description: "sentinel" },
      summary: "fixture",
      result: { ok: true, summary: "fixture", diff },
      destructive: false,
      requiresApproval: false,
    };
    // When
    const changed = proposalCallChangedSomething(call);
    // Then
    expect(changed).toBe(true);
    expect(proposalCompletenessWarnings({ requestText: "set audio description", calls: [call] })).toEqual([]);
    expect(changePreviewChips(diff)).toHaveLength(1);
    expect(fallbackDiffParts([call])).toHaveLength(1);
    expect(summaryForDiff(diff)).not.toBe(summaryForDiff(summarizeChanges(before, before)));
    expect(canAutoApplyProposal({ calls: [call], before, after, currentMapId: before.startMapId })).toBe(false);
  });

  it.each([undefined, 0, 1])(
    "preserves tile-only safety compatibility when the audio count is %j", (count) => {
      // Given
      const before = createBlankProject();
      const after = structuredClone(before);
      const map = after.maps[after.startMapId];
      if (!map) throw new TypeError("Blank project must contain its start map");
      map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
      const legacy = summarizeChanges(before, before);
      Reflect.deleteProperty(legacy, "audioDescriptionsChanged");
      const diff = {
        ...legacy, tilesChanged: 1,
        ...(count === undefined ? {} : { audioDescriptionsChanged: count }),
      };
      const call: ProposedCall = {
        name: "paint_tiles", args: { mapId: before.startMapId }, summary: "fixture",
        result: { ok: true, summary: "fixture", diff }, destructive: false, requiresApproval: false,
      };
      // When
      const safe = canAutoApplyProposal({ calls: [call], before, after, currentMapId: before.startMapId });
      // Then
      expect(safe).toBe(count !== 1);
    },
  );

  it.each([undefined, 0, 1])("parses construction summaries when the audio count is %j", (count) => {
    // Given
    const project = audioDescriptionToolProject();
    const { warnings, ...legacy } = summarizeChanges(project, project);
    Reflect.deleteProperty(legacy, "audioDescriptionsChanged");
    const outcome = {
      executionOk: false, applied: false, outcome: "failed",
      requestedEntrypoint: "author_village", canonicalRoute: "author_village",
      selectedImplementation: "fixture", routeChanges: [],
      activityPersistence: "not-recorded", projectPersistence: "not-requested",
      target: { kind: "existing", mapId: "qa-map" }, counts: { requested: 1, actual: 0 },
      diff: { ...legacy, ...(count === undefined ? {} : { audioDescriptionsChanged: count }) },
      warnings,
    };
    // When
    const parsed = parseConstructionOutcome(outcome);
    // Then
    expect(parsed.diff).toMatchObject({ audioDescriptionsChanged: count ?? 0 });
    const audit = constructionAuditFromResult({ resultData: { construction: outcome }, observation: "no-change" });
    if (count === 1) expect(audit).toBeNull();
    else expect(audit).toMatchObject({ outcome: "no-change" });
  });
});
