import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import {
  answerTilesetAiQuestion,
  applyConfirmedTilesetAiKnowledge,
  conversationSnapshot,
} from "@/editor/tilesetAiConversationSession";
import {
  resetTilesetAiReviewSessions,
  runTilesetAiReview,
  setTilesetAiReviewAnalyzer,
} from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let cleanupDom: (() => void) | null = null;
let tilesetId = "";

function currentTileset(): TilesetDef {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset fixture");
  return tileset;
}

describe("AI tileset workspace boundary", () => {
  beforeEach(() => {
    cleanupDom = installFakeDom();
    const project = createBlankProject();
    tilesetId = Object.keys(project.tilesets)[0] ?? "";
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset fixture");
    tileset.tileGroups = [];
    store.replace(project);
    resetTilesetAiReviewSessions();
  });

  afterEach(() => {
    setTilesetAiReviewAnalyzer(null);
    resetTilesetAiReviewSessions();
    cleanupDom?.();
    cleanupDom = null;
  });

  it("keeps AI controls out of the human-owned knowledge editor", () => {
    // Given / When
    const panel = renderTileGroupPanel(currentTileset(), () => undefined) as unknown as FakeElement;

    // Then
    expect(findByTestId(panel, "tileset-ai-review-inbox")).toBeNull();
    expect(findByTestId(panel, "tileset-ai-review-manual")).toBeNull();
    expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
  });

  it("stages high-confidence AI work without touching the project until explicit apply", async () => {
    // Given
    const tileset = currentTileset();
    const columns = tileset.tilesPerRow;
    const highTiles = [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1];
    const uncertainTiles = [3, 4, columns + 3, columns + 4, (columns * 2) + 3, (columns * 2) + 4];
    setTilesetAiReviewAnalyzer(async (source) => ({
      kind: "success",
      rawAnswer: "{}",
      review: {
        fingerprint: tilesetKnowledgeFingerprint(source),
        proposals: [
          {
            cellLayers: null,
            confidence: 0.94,
            description: "High confidence cliff",
            evidence: "2x3 repeated block",
            feedback: "",
            id: "high-cliff",
            name: "High cliff",
            passage: { down: false, left: false, right: false, up: false },
            placementRules: "Repeat in both directions",
            question: "Repeat in both directions?",
            quickReplies: ["Yes", "No"],
            status: "pending",
            template: "repeatable-cliff-2x3",
            tileIds: highTiles,
          },
          {
            cellLayers: null,
            confidence: 0.68,
            description: "Needs confirmation",
            evidence: "Ambiguous edge",
            feedback: "",
            id: "uncertain-cliff",
            name: "Uncertain cliff",
            passage: { down: false, left: false, right: false, up: false },
            placementRules: "",
            question: "Is this a cliff?",
            quickReplies: ["Yes", "No"],
            status: "pending",
            template: "repeatable-cliff-2x3",
            tileIds: uncertainTiles,
          },
        ],
        summary: "Two candidate groups",
        warnings: [],
      },
    }));
    // When
    await runTilesetAiReview(tileset, vi.fn());

    // Then
    expect(conversationSnapshot(tileset).confirmed.map((proposal) => proposal.name)).toEqual(["High cliff"]);
    expect(currentTileset().tileGroups).toEqual([]);
    expect(applyConfirmedTilesetAiKnowledge(tileset)).toBe(1);
    expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["High cliff"]);
  });

  it("sends an uncertain answer back to AI and stages the refreshed proposal", async () => {
    // Given
    const tileset = currentTileset();
    const feedbackRuns: string[][] = [];
    setTilesetAiReviewAnalyzer(async (source, feedback) => {
      feedbackRuns.push([...feedback]);
      return ({
      kind: "success",
      rawAnswer: "{}",
      review: {
        fingerprint: tilesetKnowledgeFingerprint(source),
        proposals: [{
          cellLayers: null,
          confidence: 0.61,
          description: "Tree",
          evidence: "Vertical object",
          feedback: "",
          id: "tree",
          name: "Tree",
          passage: { down: false, left: false, right: false, up: false },
          placementRules: "",
          question: "Is the canopy upper?",
          quickReplies: ["Yes", "No"],
          status: "pending",
          template: "tree",
          tileIds: [0, 1, source.tilesPerRow, source.tilesPerRow + 1],
        }],
        summary: "One uncertain group",
        warnings: [],
      },
      });
    });
    await runTilesetAiReview(tileset, vi.fn());

    // When
    await answerTilesetAiQuestion(tileset, "수관만 상위예요", vi.fn());

    // Then
    expect(feedbackRuns.at(-1)).toContain("Tree: 수관만 상위예요");
    expect(conversationSnapshot(tileset).confirmed.map((proposal) => proposal.name)).toEqual(["Tree"]);
    expect(currentTileset().tileGroups).toEqual([]);
  });
});
