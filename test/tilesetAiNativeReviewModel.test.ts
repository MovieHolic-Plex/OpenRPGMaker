import { describe, expect, it } from "vitest";

import {
  aiReviewBuckets,
  completeAiReview,
  createAiReviewIdle,
  editAiReviewProposal,
  failAiReview,
  isAiReviewStale,
  markAiReviewOffline,
  markAiReviewSaved,
  markAiReviewSaving,
  skipAiReviewProposal,
  startAiReview,
  type TilesetAiReviewProposal,
} from "@/editor/tilesetAiNativeReviewModel";

const FINGERPRINT = "tileset-a:revision-1";

function proposal(
  id: string,
  confidence: number,
  tileIds: readonly number[],
): TilesetAiReviewProposal {
  return {
    cellLayers: null,
    confidence,
    description: `${id} description`,
    evidence: `${tileIds.length} tiles`,
    feedback: "",
    id,
    name: id,
    passage: { down: false, left: false, right: false, up: false },
    placementRules: "",
    question: `${id} question`,
    quickReplies: ["Yes", "No"],
    status: "pending",
    template: "desk",
    tileIds,
  };
}

describe("AI-native tileset review model", () => {
  it("routes proposals into deterministic confidence buckets", () => {
    // Given
    const analyzing = startAiReview(createAiReviewIdle("tileset-a", FINGERPRINT), "request-1");

    // When
    const ready = completeAiReview(analyzing, {
      fingerprint: FINGERPRINT,
      proposals: [
        proposal("uncertain", 0.6, [20]),
        proposal("high-b", 0.9, [10]),
        proposal("low", 0.2, [30]),
        proposal("high-a", 0.95, [0]),
      ],
      summary: "four proposals",
      warnings: [],
    });

    // Then
    expect(ready.status).toBe("ready");
    expect(aiReviewBuckets(ready)).toEqual({
      high: [expect.objectContaining({ id: "high-a" }), expect.objectContaining({ id: "high-b" })],
      low: [expect.objectContaining({ id: "low" })],
      uncertain: [expect.objectContaining({ id: "uncertain" })],
    });
  });

  it("keeps feedback and skip decisions detached from the original proposals", () => {
    // Given
    const source = proposal("tree", 0.64, [1, 2]);
    const ready = completeAiReview(
      startAiReview(createAiReviewIdle("tileset-a", FINGERPRINT), "request-1"),
      { fingerprint: FINGERPRINT, proposals: [source], summary: "tree", warnings: [] },
    );

    // When
    const edited = editAiReviewProposal(ready, "tree", { feedback: "윗부분은 상위 레이어" });
    const skipped = skipAiReviewProposal(edited, "tree");

    // Then
    expect(source.feedback).toBe("");
    expect(source.status).toBe("pending");
    expect(skipped.proposals[0]).toEqual(expect.objectContaining({
      feedback: "윗부분은 상위 레이어",
      status: "skipped",
    }));
  });

  it("marks partial results and detects a changed tileset fingerprint", () => {
    // Given
    const analyzing = startAiReview(createAiReviewIdle("tileset-a", FINGERPRINT), "request-1");

    // When
    const partial = completeAiReview(analyzing, {
      fingerprint: FINGERPRINT,
      proposals: [proposal("desk", 0.7, [4, 5])],
      summary: "partial",
      warnings: ["Some tiles were not classified"],
    });

    // Then
    expect(partial.status).toBe("partial");
    expect(isAiReviewStale(partial, "tileset-a:revision-2")).toBe(true);
    expect(isAiReviewStale(partial, FINGERPRINT)).toBe(false);
  });

  it("represents recoverable analyzing, offline, error, saving, and saved states", () => {
    // Given
    const idle = createAiReviewIdle("tileset-a", FINGERPRINT);
    const analyzing = startAiReview(idle, "request-1");
    const ready = completeAiReview(analyzing, {
      fingerprint: FINGERPRINT,
      proposals: [proposal("water", 0.92, [0, 1, 2])],
      summary: "water",
      warnings: [],
    });

    // When
    const offline = markAiReviewOffline(analyzing, "AI connection unavailable");
    const error = failAiReview(analyzing, "Invalid response");
    const saving = markAiReviewSaving(ready);
    const saved = markAiReviewSaved(saving, "1 proposal applied");

    // Then
    expect([idle.status, analyzing.status, offline.status, error.status, saving.status, saved.status]).toEqual([
      "idle",
      "analyzing",
      "offline",
      "error",
      "saving",
      "saved",
    ]);
    expect(offline.previousProposals).toEqual([]);
    expect(saved.message).toBe("1 proposal applied");
  });
});
