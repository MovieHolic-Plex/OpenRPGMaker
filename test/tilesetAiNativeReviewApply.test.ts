import { beforeEach, describe, expect, it } from "vitest";

import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { applyAiReviewProposals } from "@/editor/tilesetAiNativeReviewApply";
import {
  completeAiReview,
  createAiReviewIdle,
  startAiReview,
  type TilesetAiReviewProposal,
} from "@/editor/tilesetAiNativeReviewModel";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

let tilesetId = "";

function currentTileset(): TilesetDef {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset fixture");
  return tileset;
}

function proposal(
  id: string,
  confidence: number,
  tileIds: readonly number[],
): TilesetAiReviewProposal {
  return {
    cellLayers: null,
    confidence,
    description: `${id} description`,
    evidence: "AI geometry",
    feedback: "",
    id,
    name: id,
    passage: { down: false, left: false, right: false, up: false },
    placementRules: `${id} rule`,
    question: `${id} question`,
    quickReplies: ["Yes", "No"],
    status: "pending",
    template: "repeatable-cliff-2x3",
    tileIds,
  };
}

describe("AI-native review apply", () => {
  beforeEach(() => {
    const project = createBlankProject();
    tilesetId = Object.keys(project.tilesets)[0] ?? "";
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset fixture");
    tileset.tileGroups = [];
    tileset.tileMeta = undefined;
    store.replace(project);
    resetMapEditHistory();
  });

  it("accepts only high-confidence proposals in one undoable batch", () => {
    // Given
    const columns = currentTileset().tilesPerRow;
    const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
    const highA = proposal("high-a", 0.94, [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1]);
    const highB = proposal("high-b", 0.88, [3, 4, columns + 3, columns + 4, (columns * 2) + 3, (columns * 2) + 4]);
    const uncertain = proposal("uncertain", 0.7, [6, 7, columns + 6, columns + 7, (columns * 2) + 6, (columns * 2) + 7]);
    const state = completeAiReview(
      startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
      { fingerprint, proposals: [uncertain, highB, highA], summary: "three", warnings: [] },
    );

    // When
    const applied = applyAiReviewProposals({ mode: "high", state, tilesetId });

    // Then
    expect(applied.kind).toBe("applied");
    if (applied.kind !== "applied") throw new Error("apply failed");
    expect(applied.appliedIds).toEqual(["high-a", "high-b"]);
    expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["high-a", "high-b"]);
    expect(undoMapEdit()).toBe(true);
    expect(currentTileset().tileGroups).toEqual([]);
  });

  it("rejects stale proposals and skips tiles protected by human knowledge", () => {
    // Given
    const columns = currentTileset().tilesPerRow;
    const protectedTiles = [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1];
    currentTileset().tileGroups = [{
      defaultLayer: "lower",
      description: "Human cliff",
      id: "human-cliff",
      name: "Human cliff",
      origin: "user",
      placementRules: "Keep",
      role: "wall",
      source: "user",
      tileIds: protectedTiles,
    }];
    const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
    const state = completeAiReview(
      startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
      { fingerprint, proposals: [proposal("overwrite", 0.99, protectedTiles)], summary: "one", warnings: [] },
    );

    // When
    const protectedResult = applyAiReviewProposals({ mode: "high", state, tilesetId });
    currentTileset().tileSize += 1;
    const staleResult = applyAiReviewProposals({ mode: "high", state, tilesetId });

    // Then
    expect(protectedResult).toEqual(expect.objectContaining({ appliedIds: [], kind: "applied", skippedIds: ["overwrite"] }));
    expect(staleResult.kind).toBe("stale");
    expect(currentTileset().tileGroups?.find((group) => group.id === "human-cliff")?.name).toBe("Human cliff");
  });

  it("applies only the strongest proposal when AI candidates overlap", () => {
    // Given
    const columns = currentTileset().tilesPerRow;
    const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
    const strongest = proposal("strongest", 0.97, [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1]);
    const overlapping = proposal("overlapping", 0.9, [1, 2, columns + 1, columns + 2, (columns * 2) + 1, (columns * 2) + 2]);
    const state = completeAiReview(
      startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
      { fingerprint, proposals: [overlapping, strongest], summary: "overlap", warnings: [] },
    );

    // When
    const result = applyAiReviewProposals({ mode: "high", state, tilesetId });

    // Then
    expect(result).toEqual({ appliedIds: ["strongest"], kind: "applied", skippedIds: ["overlapping"] });
    expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["strongest"]);
  });

  it("applies a staged conversational proposal only after explicit selected apply", () => {
    // Given
    const columns = currentTileset().tilesPerRow;
    const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
    const staged = { ...proposal("staged", 0.72, [0, 1, columns, columns + 1, columns * 2, columns * 2 + 1]), status: "accepted" as const };
    const state = completeAiReview(
      startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
      { fingerprint, proposals: [staged], summary: "staged", warnings: [] },
    );

    // When
    const beforeApply = currentTileset().tileGroups;
    const result = applyAiReviewProposals({ mode: "selected", proposalIds: ["staged"], state, tilesetId });

    // Then
    expect(beforeApply).toEqual([]);
    expect(result).toEqual({ appliedIds: ["staged"], kind: "applied", skippedIds: [] });
    expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["staged"]);
  });
});
