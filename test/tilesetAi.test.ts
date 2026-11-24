import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerTilesetAiQuestion, applyConfirmedTilesetAiKnowledge, conversationSnapshot, resetTilesetAiConversation } from "@/editor/tilesetAiConversationSession";
import { resetTilesetAiReviewSessions, runTilesetAiReview, setTilesetAiReviewAnalyzer } from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint, analyzeTilesetKnowledge } from "@/editor/tilesetAiNativeAnalysis";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { applyAiMappingAnswer as applyAiMappingAnswerForTest } from "@/editor/panels/tilesetAiMappingParser";
import { analyzeTilesetSelection } from "@/editor/panels/tilesetAiMappingRules";
import { buildSetupMappingAnswer } from "@/editor/panels/tilesetAiSetupMapping";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { normalizeAiTileMetadata } from "@/editor/panels/tilesetAiMetadataNormalizer";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { applyAiReviewProposals } from "@/editor/tilesetAiNativeReviewApply";
import { completeAiReview, createAiReviewIdle, startAiReview, type TilesetAiReviewProposal, aiReviewBuckets, editAiReviewProposal, failAiReview, isAiReviewStale, markAiReviewOffline, markAiReviewSaved, markAiReviewSaving, skipAiReviewProposal } from "@/editor/tilesetAiNativeReviewModel";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { shouldApplyTempDragPaint } from "@/editor/panels/tilesetAiTerrainExample";
import { isolateTimers } from "./mergedTeardown";

describe("tilesetAiConversationSession", () => {
  isolateTimers();
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
});

describe("tilesetAiMappingRules", () => {
  isolateTimers();
  describe("tileset AI mapping rules", () => {
    it("detects a horizontal expandable terrain strip with preserved caps", () => {
      const result = analyzeTilesetSelection({
        selectedTiles: [6, 7, 8],
        tilesPerRow: 30,
      });

      const block = result.patternBlocks[0];
      expect(block?.patternGrammar).toEqual(expect.objectContaining({
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 3,
        preserveCaps: true,
      }));
      expect(block?.patternGrammar?.parts.map((part) => part.role)).toEqual(["leftCap", "repeatBody", "rightCap"]);
      expect(result.previewMaps[0]?.lowerTiles.filter((tile) => tile === 7).length).toBeGreaterThan(3);
    });

    it("detects a vertical expandable terrain strip with preserved caps", () => {
      const result = analyzeTilesetSelection({
        selectedTiles: [6, 36, 66],
        tilesPerRow: 30,
      });

      const block = result.patternBlocks[0];
      expect(block?.patternGrammar).toEqual(expect.objectContaining({
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 3,
        preserveCaps: true,
      }));
      expect(block?.patternGrammar?.parts.map((part) => part.role)).toEqual(["topCap", "repeatBody", "bottomCap"]);
      expect(result.previewMaps[0]?.lowerTiles.filter((tile) => tile === 36).length).toBeGreaterThan(3);
    });

    it("detects a nine-slice expandable terrain block for RPG-style bounded terrain", () => {
      const result = analyzeTilesetSelection({
        selectedTiles: [6, 7, 8, 36, 37, 38, 66, 67, 68],
        tilesPerRow: 30,
      });

      const block = result.patternBlocks[0];
      expect(block?.patternGrammar).toEqual(expect.objectContaining({
        axis: "both",
        kind: "nine_slice_expandable",
        minHeight: 3,
        minWidth: 3,
        preserveCaps: true,
      }));
      expect(block?.patternGrammar?.parts.map((part) => part.role)).toEqual([
        "topLeft",
        "top",
        "topRight",
        "left",
        "center",
        "right",
        "bottomLeft",
        "bottom",
        "bottomRight",
      ]);
      expect(result.previewMaps[0]?.lowerTiles).toHaveLength(256);
      expect(result.previewMaps[0]?.lowerTiles.filter((tile) => tile === 37).length).toBeGreaterThan(8);
    });

    it("detects a source-preserving 6x4 castle wall block instead of loose tile labels", () => {
      const result = analyzeTilesetSelection({
        selectedTiles: [
          246, 247, 248, 249, 250, 251,
          276, 277, 278, 279, 280, 281,
          306, 307, 308, 309, 310, 311,
          336, 337, 338, 339, 340, 341,
        ],
        tilesPerRow: 30,
      });

      expect(result.patternBlocks).toEqual([
        expect.objectContaining({
          kind: "source_rect",
          label: "성벽 상단 블록",
          confidence: "high",
          sourceRect: { x: 6, y: 8, width: 6, height: 4 },
        }),
      ]);
      expect(result.previewMaps[0]?.lowerTiles.filter((tile) => tile !== 240)).toHaveLength(96);
    });

    it("asks the minimum bordered-terrain question for a 3x3 outside/body selection", () => {
      const result = analyzeTilesetSelection({
        selectedTiles: [390, 391, 392, 420, 421, 422, 450, 451, 452],
        tilesPerRow: 30,
      });

      expect(result.confidence).toBe("medium");
      expect(result.minimumQuestions).toContain("이 9칸은 외곽/모서리/중앙이 있는 자동 연결 지형인가요?");
    });

    it("classifies many chipset selections without dropping low-confidence questions", () => {
      const samples: readonly (readonly number[])[] = [
        [6, 7, 8, 36, 37, 38, 66, 67, 68],
        [15, 16, 17, 45, 46, 47, 75, 76, 77],
        [102, 103, 104, 132, 133, 134, 162, 163, 164],
        [240, 241, 242, 270, 271, 272, 300, 301, 302],
        [246, 247, 248, 249, 250, 251, 276, 277, 278, 279, 280, 281],
        [306, 307, 308, 309, 310, 311, 336, 337, 338, 339, 340, 341],
        [342, 343, 344, 372, 373, 374],
        [363, 364, 365, 393, 394, 395, 423, 424, 425],
        [390, 391, 392, 420, 421, 422, 450, 451, 452],
        [393, 394, 395, 423, 424, 425, 453, 454, 455],
        [402, 403, 432, 433, 462, 463],
        [414, 415, 416, 444, 445, 446, 474, 475, 476],
        [0, 30, 60, 90],
        [93, 123, 153, 183, 213],
        [120, 150, 180, 210],
        [186, 187, 188, 216, 217, 218],
        [259, 260, 289, 290],
        [318, 319, 320],
        [327, 328, 357, 358],
        [374, 375, 376, 404, 405, 406],
        [378, 379, 380, 408, 409, 410, 438, 439],
        [385, 386, 387, 434, 435, 436, 464, 466, 467],
        [389, 418, 419, 448, 449, 477, 478, 479],
        [12, 13, 14, 42, 43, 44, 72, 73, 74],
        [192, 222, 228, 229, 230],
        [193, 194, 195, 196, 197, 223, 224, 225, 226, 227],
        [288, 348, 351],
        [329, 359],
        [440, 441, 442, 443, 472, 473],
        [246, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338],
      ];

      const results = samples.map((selectedTiles) => analyzeTilesetSelection({ selectedTiles, tilesPerRow: 30 }));

      expect(results).toHaveLength(30);
      expect(results.filter((result) => result.patternBlocks.length > 0).length).toBeGreaterThanOrEqual(20);
      expect(results.filter((result) => result.minimumQuestions.length > 0).length).toBeGreaterThanOrEqual(20);
      expect(results.every((result) => result.minimumQuestions.length <= 2)).toBe(true);
    });

    it("persists top-level pattern blocks as source-rect tile groups", () => {
      const tileset = defaultTileset();
      const selectedTiles = [
        246, 247, 248, 249, 250, 251,
        276, 277, 278, 279, 280, 281,
        306, 307, 308, 309, 310, 311,
        336, 337, 338, 339, 340, 341,
      ];
      const answer = JSON.stringify({
        summary: "성벽 상단 블록",
        confidence: "high",
        minimumQuestions: [],
        tiles: selectedTiles.map((tile) => ({
          tile,
          label: "성벽 상단",
          description: "성곽 위쪽 구조",
          terrainTag: 4,
          defaultLayer: "lower",
          role: "body",
          placementRules: "원본 배열 유지",
        })),
        groups: [],
        patternBlocks: [{
          kind: "source_rect",
          label: "성벽 상단 블록",
          confidence: "high",
          tileIds: selectedTiles,
          sourceRect: { x: 6, y: 8, width: 6, height: 4 },
          placementRules: "6x4 원본 배열을 유지해서 찍기",
        }],
        previewMaps: [{
          name: "성벽 상단 16x16 예시",
          width: 16,
          height: 16,
          lowerTiles: Array.from({ length: 256 }, (_, index) => (index < 24 ? selectedTiles[index % selectedTiles.length] : 240)),
          upperTiles: Array.from({ length: 256 }, () => -1),
        }],
      });

      applyAiMappingAnswerForTest(tileset, selectedTiles, answer);

      const aiGroups = tileset.tileGroups?.filter((group) => group.id.startsWith("ai-")) ?? [];
      expect(aiGroups).toEqual([
        expect.objectContaining({
          confidence: "high",
          name: "성벽 상단 블록",
          role: "castle",
          sourceRect: { x: 6, y: 8, width: 6, height: 4 },
        }),
      ]);
      expect(aiGroups[0]?.previewMap?.lowerTiles).toHaveLength(256);
    });

    it("persists AI pattern grammar on tile groups", () => {
      const tileset = defaultTileset();
      const selectedTiles = [6, 7, 8];
      const answer = JSON.stringify({
        summary: "가로 확장 지형",
        confidence: "medium",
        minimumQuestions: [],
        tiles: selectedTiles.map((tile) => ({
          tile,
          label: "가로 지형",
          description: "양끝 보존 반복 지형",
          terrainTag: 1,
          defaultLayer: "lower",
          role: "body",
          placementRules: "양끝을 고정하고 가운데를 반복",
        })),
        groups: [],
        patternBlocks: [{
          kind: "horizontal_expandable",
          label: "가로 확장 지형",
          confidence: "medium",
          tileIds: selectedTiles,
          sourceRect: { x: 6, y: 0, width: 3, height: 1 },
          patternGrammar: {
            kind: "horizontal_expandable",
            axis: "horizontal",
            minWidth: 3,
            parts: [
              { role: "leftCap", tileIds: [6] },
              { role: "repeatBody", tileIds: [7] },
              { role: "rightCap", tileIds: [8] },
            ],
            preserveCaps: true,
            repeat: "body",
          },
          placementRules: "양끝 보존, 가운데 반복",
        }],
        previewMaps: [{
          name: "가로 확장 16x16 예시",
          width: 16,
          height: 16,
          lowerTiles: Array.from({ length: 256 }, (_, index) => (index >= 130 && index <= 141 ? 7 : 240)),
          upperTiles: Array.from({ length: 256 }, () => -1),
        }],
      });

      applyAiMappingAnswerForTest(tileset, selectedTiles, answer);

      const aiGroup = tileset.tileGroups?.find((group) => group.id.startsWith("ai-"));
      expect(aiGroup?.patternGrammar).toEqual(expect.objectContaining({
        axis: "horizontal",
        kind: "horizontal_expandable",
        preserveCaps: true,
        repeat: "body",
      }));
      expect(aiGroup?.patternGrammar?.parts.map((part) => part.role)).toEqual(["leftCap", "repeatBody", "rightCap"]);
    });

    it("builds a user-confirmed path autotile mapping inside the tileset AI tool", () => {
      const tileset = defaultTileset();
      const selectedTiles = [390, 391, 392, 420, 421, 422, 450, 451, 452];
      const answer = buildSetupMappingAnswer(tileset, selectedTiles, {
        intent: "pathAutotile",
        repeatability: "edgesAndCenter",
        scope: "rules",
        structure: "threeByThree",
      });

      applyAiMappingAnswerForTest(tileset, selectedTiles, answer);

      const aiGroup = tileset.tileGroups?.find((group) => group.id.startsWith("ai-"));
      expect(aiGroup).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        name: "길 오토타일",
        role: "terrain",
      }));
      expect(aiGroup?.patternGrammar).toEqual(expect.objectContaining({
        axis: "both",
        kind: "autotile_3x3",
        repeat: "center",
      }));
      expect(tileset.tileMeta?.[421]).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        label: "길 중앙",
        repeatability: "repeat",
        role: "body",
      }));
    });

  });
});

describe("tilesetAiMetadataNormalizer", () => {
  isolateTimers();
  describe("normalizeAiTileMetadata", () => {
    it("Given a 3x3 pattern with repeated labels When normalizing Then it assigns position-specific names and metadata", () => {
      const tileIds = [159, 160, 161, 189, 190, 191, 219, 220, 221];
      const answer = JSON.stringify({
        summary: "석재 바닥 블록",
        tiles: tileIds.map((tile) => ({
          defaultLayer: "lower",
          label: "성벽 상단",
          placementRules: "3x3 지형에 사용",
          repeatability: "auto",
          role: "single",
          tile,
        })),
        patternBlocks: [
          {
            sourceRect: { height: 3, width: 3 },
            tileIds,
          },
        ],
      });

      const normalized = JSON.parse(normalizeAiTileMetadata(answer)) as {
        readonly tiles: readonly { readonly label: string; readonly repeatability: string; readonly role: string }[];
      };

      expect(normalized.tiles.map((tile) => tile.label)).toEqual([
        "성벽 좌상단",
        "성벽 상단",
        "성벽 우상단",
        "성벽 좌측",
        "성벽 중앙",
        "성벽 우측",
        "성벽 좌하단",
        "성벽 하단",
        "성벽 우하단",
      ]);
      expect(normalized.tiles.map((tile) => tile.role)).toEqual(["edge", "edge", "edge", "edge", "body", "edge", "edge", "edge", "edge"]);
      expect(normalized.tiles.map((tile) => tile.repeatability)).toEqual([
        "fixed",
        "repeat",
        "fixed",
        "repeat",
        "repeat",
        "repeat",
        "fixed",
        "repeat",
        "fixed",
      ]);
    });

    it("Given a locked user label When normalizing Then it keeps the locked name", () => {
      const tileIds = [159, 160, 161, 189, 190, 191, 219, 220, 221];
      const answer = JSON.stringify({
        tiles: tileIds.map((tile, index) => ({
          label: "성벽 상단",
          tile,
          userLocked: index === 0,
        })),
        patternBlocks: [{ sourceRect: { height: 3, width: 3 }, tileIds }],
      });

      const normalized = JSON.parse(normalizeAiTileMetadata(answer)) as {
        readonly tiles: readonly { readonly label: string; readonly repeatability?: string; readonly role?: string }[];
      };

      expect(normalized.tiles[0]?.label).toBe("성벽 상단");
      expect(normalized.tiles[0]?.role).toBeUndefined();
      expect(normalized.tiles[0]?.repeatability).toBeUndefined();
      expect(normalized.tiles[1]?.label).toBe("성벽 상단");
      expect(normalized.tiles[1]?.role).toBe("edge");
      expect(normalized.tiles[1]?.repeatability).toBe("repeat");
      expect(normalized.tiles[2]?.label).toBe("성벽 우상단");
    });

    it("Given distinct labels but weak roles When normalizing Then it still fixes 3x3 role and repeatability", () => {
      const tileIds = [159, 160, 161, 189, 190, 191, 219, 220, 221];
      const answer = JSON.stringify({
        tiles: tileIds.map((tile, index) => ({
          label: `타일 ${index}`,
          repeatability: "auto",
          role: "single",
          tile,
        })),
        patternBlocks: [{ sourceRect: { height: 3, width: 3 }, tileIds }],
      });

      const normalized = JSON.parse(normalizeAiTileMetadata(answer)) as {
        readonly tiles: readonly { readonly label: string; readonly repeatability: string; readonly role: string }[];
      };

      expect(normalized.tiles.map((tile) => tile.label)).toEqual(tileIds.map((_tile, index) => `타일 ${index}`));
      expect(normalized.tiles[0]).toMatchObject({ repeatability: "fixed", role: "edge" });
      expect(normalized.tiles[4]).toMatchObject({ repeatability: "repeat", role: "body" });
      expect(normalized.tiles[8]).toMatchObject({ repeatability: "fixed", role: "edge" });
    });

    it("Given a non-json AI failure When normalizing Then it returns the failure text", () => {
      expect(normalizeAiTileMetadata("AI 호출 실패: HTTP 500")).toBe("AI 호출 실패: HTTP 500");
    });
  });
});

describe("tilesetAiNativeAnalysis", () => {
  isolateTimers();
  function firstTileset(): TilesetDef {
    const project = createBlankProject();
    const tileset = Object.values(project.tilesets)[0];
    if (!tileset) throw new Error("missing tileset fixture");
    return tileset;
  }
  describe("AI-native whole tileset analysis", () => {
    it("sends the whole image and returns detached typed proposals", async () => {
      // Given
      const tileset = firstTileset();
      tileset.tileGroups = [];
      const before = JSON.stringify(tileset);
      const imageDataUrl = "data:image/png;base64,d2hvbGUtdGlsZXNldA==";
      let capturedPrompt = "";
      let capturedImage = "";

      // When
      const result = await analyzeTilesetKnowledge(tileset, {
        feedback: ["The upper row is tree canopy"],
        renderImage: async () => imageDataUrl,
        request: async (request) => {
          capturedPrompt = request.prompt;
          capturedImage = request.imageDataUrl;
          return JSON.stringify({
            proposals: [
              {
                cellLayers: ["upper", "upper", "lower", "lower"],
                confidence: 0.91,
                description: "Tree canopy and trunks",
                evidence: "A connected 2x2 object",
                name: "Forest tree",
                passage: { down: false, left: false, right: false, up: false },
                placementRules: "Place as one object",
                question: "Is the canopy on the upper layer?",
                quickReplies: ["Yes", "No"],
                template: "tree",
                tileIds: [0, 1, tileset.tilesPerRow, tileset.tilesPerRow + 1],
              },
            ],
            summary: "One semantic group",
          });
        },
      });

      // Then
      expect(result.kind).toBe("success");
      if (result.kind !== "success") throw new Error("analysis failed");
      expect(capturedImage).toBe(imageDataUrl);
      const prompt = JSON.parse(capturedPrompt);
      expect(prompt).toEqual(expect.objectContaining({
        humanFeedback: ["The upper row is tree canopy"],
        outputSchemaVersion: 1,
        task: "analyze_tileset_knowledge",
      }));
      expect(prompt.tileset).toEqual(expect.objectContaining({ count: tileset.count, tilesPerRow: tileset.tilesPerRow }));
      expect(result.review.proposals).toEqual([
        expect.objectContaining({
          confidence: 0.91,
          name: "Forest tree",
          question: "Is the canopy on the upper layer?",
          quickReplies: ["Yes", "No"],
          status: "pending",
          template: "tree",
        }),
      ]);
      expect(result.review.fingerprint).toBe(tilesetKnowledgeFingerprint(tileset));
      expect(JSON.stringify(tileset)).toBe(before);
    });

    it("preserves human knowledge and reports malformed proposals as partial", async () => {
      // Given
      const tileset = firstTileset();
      tileset.tileGroups = [{
        defaultLayer: "upper",
        description: "Human desk",
        id: "human-desk",
        name: "Human desk",
        origin: "user",
        placementRules: "Keep this",
        role: "prop",
        source: "user",
        tileIds: [0, 1],
      }];

      // When
      const result = await analyzeTilesetKnowledge(tileset, {
        renderImage: async () => "data:image/png;base64,dA==",
        request: async () => JSON.stringify({
          proposals: [
            { confidence: 0.96, name: "Overwrite", template: "desk", tileIds: [0, 1] },
            { confidence: 0.8, name: "Outside", template: "desk", tileIds: [tileset.count + 1] },
            { confidence: 0.79, name: "Partially outside", template: "desk", tileIds: [6, 7, tileset.count + 1] },
            { confidence: 0.78, name: "Duplicate", template: "desk", tileIds: [8, 8] },
            { cellLayers: ["upper", "lower"], confidence: 0.75, name: "Unsorted", template: "tree", tileIds: [10, 9] },
            { confidence: 0.72, name: "Valid", template: "desk", tileIds: [4, 5] },
          ],
          summary: "Mixed response",
        }),
      });

      // Then
      expect(result.kind).toBe("success");
      if (result.kind !== "success") throw new Error("analysis failed");
      expect(result.review.proposals.map((proposal) => proposal.name)).toEqual(["Valid"]);
      expect(result.review.warnings).toHaveLength(5);
    });
  });
});

describe("tilesetAiNativeReviewApply", () => {
  isolateTimers();
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
});

describe("tilesetAiNativeReviewInbox", () => {
  isolateTimers();
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
});

describe("tilesetAiNativeReviewModel", () => {
  isolateTimers();
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
});

describe("tilesetAiSetupMapping", () => {
  isolateTimers();
  describe("tileset AI setup mapping", () => {
    it("uses existing tileset labels for a user-confirmed grass terrain draft", () => {
      const tileset = defaultTileset();
      const selectedTiles = [240, 241, 242, 270, 271, 272, 300, 301, 302];
      const answer = buildSetupMappingAnswer(tileset, selectedTiles, {
        intent: "autoTerrain",
        repeatability: "edgesAndCenter",
        scope: "rules",
        structure: "threeByThree",
      });

      applyAiMappingAnswerForTest(tileset, selectedTiles, answer);

      const aiGroup = tileset.tileGroups?.find((group) => group.id.startsWith("ai-"));
      // 2026-07-11 grass-autotile 하네스 그룹(T7)이 선택 범위의 대부분(240/270-272/300-302)에
      // "잔디" 라벨을 이미 부여해두므로, 다수결 라벨링이 일반 "지형" 대신 "잔디"를 채택한다.
      expect(aiGroup).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        name: "잔디 오토타일",
        role: "terrain",
      }));
      expect(tileset.tileMeta?.[271]).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        label: "잔디 중앙",
        repeatability: "repeat",
        role: "body",
      }));
    });

    it("builds a user-confirmed house wall draft from existing house metadata", () => {
      const tileset = defaultTileset();
      const selectedTiles = [15, 16, 17, 45, 46, 47, 75, 76, 77];
      const answer = buildSetupMappingAnswer(tileset, selectedTiles, {
        intent: "buildingHouse",
        repeatability: "edgesAndCenter",
        scope: "rules",
        structure: "threeByThree",
      });

      applyAiMappingAnswerForTest(tileset, selectedTiles, answer);

      const aiGroup = tileset.tileGroups?.find((group) => group.id.startsWith("ai-"));
      expect(aiGroup).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        name: "흰 집 벽 확장 묶음",
        role: "building",
      }));
      expect(tileset.tileMeta?.[46]).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        label: "흰 집 벽 확장 중앙",
        repeatability: "repeat",
        role: "body",
      }));
    });

    it("stores a user-confirmed road autotile draft as one 3x3 group", () => {
      const tileset = defaultTileset();
      const selectedTiles = [390, 391, 392, 420, 421, 422, 450, 451, 452];
      const answer = buildSetupMappingAnswer(tileset, selectedTiles, {
        intent: "pathAutotile",
        repeatability: "edgesAndCenter",
        scope: "rules",
        structure: "threeByThree",
      });

      applyAiMappingAnswerForTest(tileset, selectedTiles, answer);

      const aiGroups = tileset.tileGroups?.filter((group) => group.id.startsWith("ai-")) ?? [];
      expect(aiGroups).toHaveLength(1);
      expect(aiGroups[0]).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        name: "길 오토타일",
        role: "terrain",
        tileIds: selectedTiles,
      }));
      expect(aiGroups[0]?.patternGrammar).toEqual(expect.objectContaining({
        kind: "autotile_3x3",
        repeat: "center",
      }));
      expect(tileset.tileMeta?.[421]).toEqual(expect.objectContaining({
        defaultLayer: "lower",
        label: "길 중앙",
        repeatability: "repeat",
        role: "body",
      }));
    });
  });
});

describe("tilesetAiTerrainExample", () => {
  isolateTimers();
  describe("tileset AI terrain example editor", () => {
    it("does not keep erasing on hover after the primary pointer is released", () => {
      expect(shouldApplyTempDragPaint(true, "erase", false)).toBe(false);
    });

    it("only drag-paints while the primary pointer remains down", () => {
      expect(shouldApplyTempDragPaint(true, "paint", true)).toBe(true);
      expect(shouldApplyTempDragPaint(false, "paint", true)).toBe(false);
      expect(shouldApplyTempDragPaint(true, "stamp", true)).toBe(false);
    });
  });
});
