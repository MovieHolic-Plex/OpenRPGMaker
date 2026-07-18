import { describe, expect, it } from "vitest";
import {
  constructionAuditFromResult,
  isCanonicalConstructionResult,
  serializeConstructionAudit,
} from "@/editor/construction/constructionAudit";
import type {
  ConstructionDiffTotals,
  ConstructionOutcome,
} from "@/editor/construction/contracts";

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
      supabaseAnonKey: "must-not-leak",
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
    expect(serialized).not.toContain("supabaseAnonKey");
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
