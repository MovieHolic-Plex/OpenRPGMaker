import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  answerTilesetAiQuestion,
  applyConfirmedTilesetAiKnowledge,
  conversationSnapshot,
  resetTilesetAiConversation,
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

let tilesetId = "";

function currentTileset(): TilesetDef {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset fixture");
  return tileset;
}

describe("conversational tileset AI session", () => {
  beforeEach(() => {
    const project = createBlankProject();
    tilesetId = Object.keys(project.tilesets)[0] ?? "";
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset fixture");
    tileset.tileGroups = [];
    store.replace(project);
    resetTilesetAiReviewSessions();
    resetTilesetAiConversation();
  });

  afterEach(() => {
    setTilesetAiReviewAnalyzer(null);
    resetTilesetAiReviewSessions();
    resetTilesetAiConversation();
  });

  it("asks, carries the answer into reanalysis, stages the refreshed group, then applies explicitly", async () => {
    // Given
    const receivedFeedback: string[][] = [];
    setTilesetAiReviewAnalyzer(async (tileset, feedback) => {
      receivedFeedback.push([...feedback]);
      const columns = tileset.tilesPerRow;
      return {
        kind: "success",
        rawAnswer: "{}",
        review: {
          fingerprint: tilesetKnowledgeFingerprint(tileset),
          proposals: [
            {
              cellLayers: null,
              confidence: 0.72,
              description: "2x3 cliff",
              evidence: "Two rows of cliff faces",
              feedback: "",
              id: "cliff",
              name: "반복 절벽",
              passage: { down: false, left: false, right: false, up: false },
              placementRules: feedback.length > 0 ? "Repeat horizontally" : "",
              question: "가로로 이어 붙이는 패턴인가요?",
              quickReplies: ["가로로만 반복", "가로·세로 모두 반복", "반복 안 함"],
              status: "pending",
              template: "repeatable-cliff-2x3",
              tileIds: [0, 1, columns, columns + 1, columns * 2, columns * 2 + 1],
            },
            {
              cellLayers: ["upper", "upper", "lower", "lower"],
              confidence: 0.63,
              description: "Tree",
              evidence: "Canopy above trunk",
              feedback: "",
              id: "tree",
              name: "레이어 2 나무",
              passage: { down: false, left: false, right: false, up: false },
              placementRules: "Place as one object",
              question: "윗부분은 상위 레이어인가요?",
              quickReplies: ["맞아", "아니야"],
              status: "pending",
              template: "tree",
              tileIds: [3, 4, columns + 3, columns + 4],
            },
          ],
          summary: "Two questions",
          warnings: [],
        },
      };
    });
    await runTilesetAiReview(currentTileset(), () => undefined);

    // When
    await answerTilesetAiQuestion(currentTileset(), "가로로만 반복", () => undefined);

    // Then
    const staged = conversationSnapshot(currentTileset());
    expect(receivedFeedback.at(-1)).toContain("반복 절벽: 가로로만 반복");
    expect(staged.turns.map((turn) => turn.role)).toEqual(["assistant", "user", "assistant"]);
    expect(staged.confirmed.map((proposal) => proposal.id)).toEqual(["cliff"]);
    expect(staged.current?.id).toBe("tree");
    expect(currentTileset().tileGroups).toEqual([]);

    const applied = applyConfirmedTilesetAiKnowledge(currentTileset());
    expect(applied).toBe(1);
    expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["반복 절벽"]);
  });
});
