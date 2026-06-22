import { describe, expect, it } from "vitest";

import { normalizeAiTileMetadata } from "@/editor/panels/tilesetAiMetadataNormalizer";

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
