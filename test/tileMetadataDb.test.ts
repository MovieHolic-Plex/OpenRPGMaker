import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { applyAiMappingAnswerForTest } from "@/editor/panels/tilesetAiQuestionEditor";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import { bundledEasyRpgTilesetId } from "@/assets/bundled";
import {
  createBlankProject,
  DEFAULT_TILESET_ID,
  LEGACY_RM_TILESET_ID,
  LEGACY_RM_TILESET_TEXTURE_KEY,
} from "@/project/defaults";
import { clearTileMetadataSqlite, loadProjectFromSqlite, saveProjectToSqlite } from "@/project/tileMetadataDb";
import type { TilesetDef } from "@/project/types";

describe("tileset metadata SQLite store", () => {
  beforeEach(async () => {
    await clearTileMetadataSqlite();
  });

  it("uses bundled default metadata only for the default bundled tileset", () => {
    const project = createBlankProject();
    const defaultBundled = project.tilesets[DEFAULT_TILESET_ID];
    const bundled = project.tilesets[LEGACY_RM_TILESET_ID];
    const uploaded: TilesetDef = {
      ...defaultBundled,
      id: "uploaded_tiles",
      image: { type: "uploaded", id: "custom-chipset" },
      tileMeta: undefined,
      tileGroups: undefined,
    };
    const legacyRm: TilesetDef = {
      ...defaultBundled,
      id: LEGACY_RM_TILESET_ID,
      image: { type: "bundled", id: LEGACY_RM_TILESET_TEXTURE_KEY },
    };

    expect(resolveTilesetTileContext(defaultBundled, 102)).toMatchObject({
      currentLabel: "통나무 집 벽 확장",
      metadataSource: "bundled-default",
    });
    expect(resolveTilesetTileContext(bundled ?? legacyRm, 102).metadataSource).toBe("bundled-default");
    expect(resolveTilesetTileContext(uploaded, 102)).toMatchObject({
      currentLabel: "Tile 102",
      metadataSource: "unknown",
    });
    expect(resolveTilesetTileContext(project.tilesets[bundledEasyRpgTilesetId("tex_easyrpg_chipset_retro_exterior")], 102)).toMatchObject({
      currentLabel: "Tile 102",
      metadataSource: "unknown",
    });
  });

  it("does not overwrite user-locked metadata with an AI answer", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
    tileset.tileMeta = [];
    tileset.tileMeta[102] = {
      label: "나무집 벽 좌상단",
      description: "사용자가 확정한 메타",
      source: "user",
      userLocked: true,
    };

    applyAiMappingAnswerForTest(tileset, [102], JSON.stringify({
      confidence: "high",
      tiles: [{
        tile: 102,
        label: "AI 성벽",
        description: "잘못된 추측",
        terrainTag: 0,
        defaultLayer: "upper",
        role: "edge",
        repeatability: "fixed",
        placementRules: "덮어쓰면 안 됨",
      }],
    }));

    expect(tileset.tileMeta[102]).toMatchObject({
      label: "나무집 벽 좌상단",
      description: "사용자가 확정한 메타",
      source: "user",
      userLocked: true,
    });
  });

  it("restores tile metadata and groups from SQLite", async () => {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
    tileset.tileMeta = [];
    tileset.tileMeta[102] = {
      label: "나무집 벽 좌상단",
      description: "확장 가능한 나무집 벽의 좌상단",
      defaultLayer: "upper",
      repeatability: "fixed",
      role: "edge",
      source: "ai",
      terrainTag: 0,
    };
    tileset.tileGroups = [{
      id: "ai-house-wall",
      name: "나무집 벽 3x3",
      role: "building",
      defaultLayer: "upper",
      tileIds: [102, 103, 104],
      description: "나무집 벽 묶음",
      placementRules: "모서리는 고정, 변은 반복",
      confidence: "high",
      source: "ai",
    }];

    await saveProjectToSqlite(project);
    const restored = await loadProjectFromSqlite();

    expect(restored.found).toBe(true);
    expect(restored.project?.tilesets[DEFAULT_TILESET_ID].tileMeta?.[102]).toMatchObject({
      label: "나무집 벽 좌상단",
      source: "ai",
      repeatability: "fixed",
    });
    expect(restored.project?.tilesets[DEFAULT_TILESET_ID].tileGroups?.[0]).toMatchObject({
      id: "ai-house-wall",
      name: "나무집 벽 3x3",
      source: "ai",
      tileIds: [102, 103, 104],
    });
  });
});
