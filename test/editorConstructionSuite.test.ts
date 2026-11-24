import { describe, expect, it } from "vitest";
import { proposalCallChangedSomething, proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import type { ProposedCall } from "@/ai/assistantSession";
import { constructionAuditFromResult, isCanonicalConstructionResult, serializeConstructionAudit } from "@/editor/construction/constructionAudit";
import { parseConstructionOutcome } from "@/editor/construction/parseConstructionOutcome";
import { changePreviewChips } from "@/editor/panels/aiChangePreview";
import { fallbackDiffParts } from "@/editor/panels/aiProposalSummary";
import { canAutoApplyProposal } from "@/editor/proposalSafety";
import { summarizeChanges } from "@/editor/tools/changeset";
import { createBlankProject } from "@/project/defaults";
import { combineDiffs, summaryForDiff } from "@/project/projectCommitLog";
import { audioDescriptionToolProject, MUSIC_ID } from "./support/audioDescriptionToolProject";
import type { ConstructionDiffTotals, ConstructionOutcome } from "@/editor/construction/contracts";
import { isolateTimers } from "./mergedTeardown";

describe("audioDescriptionDiff", () => {
  isolateTimers();
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
});

describe("constructionOutcome", () => {
  isolateTimers();
  const ZERO_DIFF = {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
  } as const satisfies ConstructionDiffTotals;
  const BASE_OUTCOME = {
    requestedEntrypoint: "author_house",
    canonicalRoute: "author_house",
    selectedImplementation: "house-kit-domain",
    routeChanges: [],
    activityPersistence: "both",
    projectPersistence: "not-requested",
    target: { kind: "existing", mapId: "map_1" },
    counts: { requested: 1, actual: 1 },
    diff: { ...ZERO_DIFF, tilesChanged: 24 },
    warnings: [],
  } as const;
  const EXACT_OUTCOME = {
    ...BASE_OUTCOME,
    executionOk: true,
    applied: true,
    outcome: "applied",
  } as const satisfies ConstructionOutcome;
  describe("construction outcome audit vocabulary", () => {
    it("recognizes the canonical nested facade result and strips sibling secrets", () => {
      // Given: facade details that include unrelated sensitive-looking sibling data.
      const resultData = {
        construction: EXACT_OUTCOME,
        houses: [{ mapId: "map_1" }],
        legacyDbAnonKey: "must-not-leak",
        projectCredentials: { token: "must-not-leak" },
      };
      // When: the canonical construction result is recognized and serialized.
      const audit = constructionAuditFromResult({ resultData });
      const serialized = audit === null ? "" : serializeConstructionAudit(audit);
      // Then: only the approved vocabulary remains, with persistence meanings separate.
      expect(isCanonicalConstructionResult(resultData)).toBe(true);
      expect(audit).toMatchObject({
        executionOk: true,
        applied: true,
        outcome: "exact",
        requestedEntrypoint: "author_house",
        canonicalRoute: "author_house",
        routeChanges: [],
        counts: { requested: 1, actual: 1 },
        activityPersistence: "both",
        projectPersistence: "not-requested",
      });
      expect(serialized).not.toContain("must-not-leak");
      expect(serialized).not.toContain("legacyDbAnonKey");
      expect(JSON.parse(serialized)).toMatchObject({
        activityPersistence: "both",
        projectPersistence: "not-requested",
      });
    });

    it.each([
      ["exact", EXACT_OUTCOME, "canonical", "exact"],
      ["partial", {
        ...BASE_OUTCOME,
        counts: { requested: 10, actual: 9 },
        executionOk: true,
        applied: true,
        outcome: "partial",
      } as const satisfies ConstructionOutcome, "canonical", "partial"],
      ["failed", {
        ...BASE_OUTCOME,
        diff: ZERO_DIFF,
        executionOk: false,
        applied: false,
        outcome: "failed",
      } as const satisfies ConstructionOutcome, "canonical", "failed"],
      ["blocked", {
        ...BASE_OUTCOME,
        diff: ZERO_DIFF,
        executionOk: false,
        applied: false,
        outcome: "blocked",
      } as const satisfies ConstructionOutcome, "canonical", "blocked"],
      ["no-change", {
        ...BASE_OUTCOME,
        counts: { requested: 1, actual: 0 },
        diff: ZERO_DIFF,
        executionOk: false,
        applied: false,
        outcome: "failed",
      } as const satisfies ConstructionOutcome, "no-change", "no-change"],
      ["pending", {
        ...BASE_OUTCOME,
        diff: ZERO_DIFF,
        executionOk: false,
        applied: false,
        outcome: "pending-approval",
      } as const satisfies ConstructionOutcome, "canonical", "pending"],
    ] as const)("keeps %s distinct", (_label, construction, observation, expected) => {
      // Given: a canonical facade result in one lifecycle state.
      const resultData = { construction };
      // When: it is translated into the activity audit vocabulary.
      const audit = constructionAuditFromResult({ resultData, observation });
      // Then: the lifecycle state is neither collapsed into success nor another failure class.
      expect(audit?.outcome).toBe(expected);
    });

    it.each([
      ["an applied result", EXACT_OUTCOME],
      ["a blocked result", {
        ...BASE_OUTCOME,
        diff: ZERO_DIFF,
        executionOk: false,
        applied: false,
        outcome: "blocked",
      } as const satisfies ConstructionOutcome],
    ])("does not relabel %s as no-change", (_label, construction) => {
      // Given: a construction state with meaning other than a zero-change failure.
      const resultData = { construction };
      // When: a caller attempts to relabel it as no-change.
      const audit = constructionAuditFromResult({ resultData, observation: "no-change" });
      // Then: the inconsistent audit record is rejected.
      expect(audit).toBeNull();
    });

    it("keeps a declared compatibility alias distinct from fallback", () => {
      // Given: a deprecated entrypoint with its one declared static alias.
      const construction = {
        ...EXACT_OUTCOME,
        requestedEntrypoint: "build_house",
        routeChanges: [{ kind: "compatibility-alias", from: "build_house", to: "author_house" }],
      } as const satisfies ConstructionOutcome;
      // When: the wrapped facade result is serialized.
      const audit = constructionAuditFromResult({ resultData: { construction } });
      // Then: the alias is retained verbatim and never relabeled as fallback.
      expect(audit?.routeChanges).toEqual([
        { kind: "compatibility-alias", from: "build_house", to: "author_house" },
      ]);
      expect(serializeConstructionAudit(audit)).not.toContain("fallback");
    });

    it("does not reinterpret unrelated tool data as construction", () => {
      // Given: an ordinary non-construction tool payload.
      const resultData = { ok: true, mapId: "map_1", projectId: "secret-project" };
      // When: the construction recognizer inspects it.
      const audit = constructionAuditFromResult({ resultData });
      // Then: no global chat/tool outcome reinterpretation occurs.
      expect(isCanonicalConstructionResult(resultData)).toBe(false);
      expect(audit).toBeNull();
    });
  });
});
