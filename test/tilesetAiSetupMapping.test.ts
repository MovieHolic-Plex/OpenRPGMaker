import { describe, expect, it } from "vitest";
import { applyAiMappingAnswer as applyAiMappingAnswerForTest } from "@/editor/panels/tilesetAiMappingParser";
import { buildSetupMappingAnswer } from "@/editor/panels/tilesetAiSetupMapping";
import { defaultTileset } from "@/project/defaults/defaultAssets";

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
