import { describe, expect, it } from "vitest";
import { applyAiMappingAnswerForTest } from "@/editor/panels/tilesetAiQuestionEditor";
import { analyzeTilesetSelection } from "@/editor/panels/tilesetAiMappingRules";
import { buildSetupMappingAnswer } from "@/editor/panels/tilesetAiSetupMapping";
import { defaultTileset } from "@/project/defaults/defaultAssets";

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
