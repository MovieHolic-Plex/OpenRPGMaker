import { describe, expect, it } from "vitest";
import {
  evaluateGenrePackReadiness,
  verifyGenrePackAssertionReceipts,
  type GenrePackAssertionReceipt,
} from "@/project/genrePackReadiness";
import {
  evaluateOfficialGenrePackReadiness,
  evaluateOfficialGenrePackReadinessMatrix,
  OFFICIAL_GENRE_PACK_IDS,
  OFFICIAL_GENRE_PACK_REQUIREMENTS,
  type OfficialGenrePackId,
} from "@/project/officialGenrePackRequirements";
import { createBlankProject } from "@/project/defaults";
import { verifyExactOfficialGenrePackIds } from "@/project/officialGenrePackIds";

const PROJECT_REVISION = "a".repeat(64);
const passingAssertions = (packId: OfficialGenrePackId): GenrePackAssertionReceipt<OfficialGenrePackId> => ({
  schemaVersion: 1,
  packId,
  projectRevision: PROJECT_REVISION,
  assertions: OFFICIAL_GENRE_PACK_REQUIREMENTS[packId].requiredAssertions.map((assertionId) => ({
    assertionId,
    status: "passed" as const,
    evidence: `evidence/${packId}/${assertionId}.json`,
  })),
});

describe("genre pack readiness receipts", () => {
  it("uses persisted genre ids in the exact official matrix", () => {
    expect(OFFICIAL_GENRE_PACK_IDS).toEqual([
      "adventure-jrpg",
      "monster-collect",
      "horror-chase",
      "story-cutscene",
      "farm-life",
      "action-rpg",
    ]);
  });

  it("BREAK: direct receipt verification fails closed when no evidence validator is supplied", () => {
    const result = verifyGenrePackAssertionReceipts(
      OFFICIAL_GENRE_PACK_REQUIREMENTS,
      OFFICIAL_GENRE_PACK_IDS.map(passingAssertions)
    );

    expect(result.ok).toBe(false);
    expect(result.receiptErrors).toHaveLength(OFFICIAL_GENRE_PACK_IDS.length * 4);
    expect(result.receiptErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        receiptIndex: 0,
        assertionId: "headless-journey",
        code: "evidence-validation-missing",
      }),
    ]));
  });

  it.each(OFFICIAL_GENRE_PACK_IDS)("fails the browser identity gate when %s is missing", (packId) => {
    const result = verifyExactOfficialGenrePackIds(OFFICIAL_GENRE_PACK_IDS.filter((id) => id !== packId));
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(packId);
  });

  it("fails the browser identity gate on extra and duplicate variant ids", () => {
    const result = verifyExactOfficialGenrePackIds([...OFFICIAL_GENRE_PACK_IDS, "partner-raise", "farm-life"]);
    expect(result.ok).toBe(false);
    expect(result.extra).toContain("partner-raise");
    expect(result.duplicate).toContain("farm-life");
  });

  it.each(OFFICIAL_GENRE_PACK_IDS)("rejects screenshot-only evidence for %s", (packId) => {
    const receipts: GenrePackAssertionReceipt<OfficialGenrePackId>[] = OFFICIAL_GENRE_PACK_IDS.map(passingAssertions);
    const target = receipts.find((receipt) => receipt.packId === packId)!;
    const screenshotOnly = {
      ...target,
      assertions: [],
      screenshots: Array.from({ length: 50 }, (_, index) => `${packId}-${index}.png`),
    };
    receipts.splice(receipts.indexOf(target), 1, screenshotOnly);

    const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, receipts);

    expect(result.ok).toBe(false);
    expect(result.packs[packId].missingAssertions).toEqual(
      OFFICIAL_GENRE_PACK_REQUIREMENTS[packId].requiredAssertions
    );
  });

  it.each(OFFICIAL_GENRE_PACK_IDS)("fails %s when one semantic assertion fails", (packId) => {
    const receipts = OFFICIAL_GENRE_PACK_IDS.map(passingAssertions);
    const target = receipts.find((receipt) => receipt.packId === packId)!;
    target.assertions[0] = { ...target.assertions[0]!, status: "failed" };

    const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, receipts);

    expect(result.ok).toBe(false);
    expect(result.packs[packId].failedAssertions).toContain(target.assertions[0]!.assertionId);
  });

  it("computes readiness and cannot be promoted by a manual certified flag", () => {
    const requirement = OFFICIAL_GENRE_PACK_REQUIREMENTS["adventure-jrpg"];
    const receipt = evaluateGenrePackReadiness({
      requirement,
      resolveCommandSupport: () => "full",
      resolveAuthoredCommand: () => true,
      lintIssues: [],
      assertionReceipt: {
        ...passingAssertions("adventure-jrpg"),
        certified: true,
        assertions: [],
      } as GenrePackAssertionReceipt<OfficialGenrePackId> & { certified: boolean },
    });

    expect(receipt.status).toBe("blocked");
    expect(receipt.invalidReceiptReasons).toContain("invalid-receipt-schema");
  });

  it("keeps the broken monster pack blocked by actual command support even with passing assertions", () => {
    const requirement = OFFICIAL_GENRE_PACK_REQUIREMENTS["monster-collect"];
    const receipt = evaluateGenrePackReadiness({
      requirement,
      resolveCommandSupport: (commandId) => commandId === "giveMonster" ? "partial" : "full",
      resolveAuthoredCommand: () => true,
      lintIssues: [],
      assertionReceipt: passingAssertions("monster-collect"),
    });

    expect(receipt.status).toBe("blocked");
    expect(receipt.commandChecks).toContainEqual(expect.objectContaining({
      commandId: "giveMonster",
      actual: "partial",
      passed: false,
    }));
  });

  it("adapts the official monster pack to the real command registry instead of a fixture claim", () => {
    const receipt = evaluateOfficialGenrePackReadiness(
      createBlankProject(),
      "monster-collect",
      passingAssertions("monster-collect")
    );

    expect(receipt.status).toBe("blocked");
    expect(receipt.commandChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ commandId: "giveMonster", actual: "partial", passed: false }),
      expect.objectContaining({ commandId: "evolveMonster", actual: "partial", passed: false }),
    ]));
  });

  it("does not call a blank project ready from global command capability alone", () => {
    const receipt = evaluateOfficialGenrePackReadiness(
      createBlankProject(),
      "adventure-jrpg",
      passingAssertions("adventure-jrpg")
    );

    expect(receipt.status).not.toBe("ready");
  });

  it("blocks readiness when the real project lint reports broken references", () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events.push({
      id: "ev_broken_reference",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [{ kind: "changeItem", itemId: "item_missing", amount: 1 }],
    });

    const receipt = evaluateOfficialGenrePackReadiness(
      project,
      "adventure-jrpg",
      passingAssertions("adventure-jrpg")
    );

    expect(receipt.status).toBe("blocked");
    expect(receipt.blockingLintIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", code: "reference-validation" }),
    ]));
  });

  it("returns ready only when command, lint, and semantic assertion gates all pass", () => {
    const receipt = evaluateGenrePackReadiness({
      requirement: OFFICIAL_GENRE_PACK_REQUIREMENTS["adventure-jrpg"],
      resolveCommandSupport: () => "full",
      resolveAuthoredCommand: () => true,
      lintIssues: [],
      assertionReceipt: passingAssertions("adventure-jrpg"),
    });

    expect(receipt.status).toBe("ready");
  });

  it("binds a semantic receipt to the expected canonical project revision", () => {
    const result = verifyGenrePackAssertionReceipts(
      OFFICIAL_GENRE_PACK_REQUIREMENTS,
      OFFICIAL_GENRE_PACK_IDS.map(passingAssertions),
      { expectedProjectRevision: "b".repeat(64) }
    );

    expect(result.ok).toBe(false);
    expect(result.receiptErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "project-revision-mismatch" }),
    ]));
  });

  it("evaluates all five official packs as one matrix and keeps monster blocked", () => {
    const assertionReceipts = Object.fromEntries(
      OFFICIAL_GENRE_PACK_IDS.map((packId) => [packId, passingAssertions(packId)])
    ) as Record<OfficialGenrePackId, GenrePackAssertionReceipt<OfficialGenrePackId>>;

    const matrix = evaluateOfficialGenrePackReadinessMatrix(createBlankProject(), assertionReceipts);

    expect(Object.keys(matrix.packs).sort()).toEqual([...OFFICIAL_GENRE_PACK_IDS].sort());
    expect(matrix.ready).toBe(false);
    expect(matrix.packs["monster-collect"].status).toBe("blocked");
  });

  it("fails closed for malformed or unknown file-backed receipts", () => {
    const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, [
      ...OFFICIAL_GENRE_PACK_IDS.map(passingAssertions),
      { schemaVersion: 1, packId: "unknown-pack", projectRevision: PROJECT_REVISION, assertions: [] },
      { packId: "farm-life" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.unknownPackIds).toEqual(["unknown-pack"]);
    expect(result.invalidReceiptIndexes).toEqual([OFFICIAL_GENRE_PACK_IDS.length + 1]);
  });
});
