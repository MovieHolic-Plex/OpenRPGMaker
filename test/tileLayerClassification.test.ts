import { describe, expect, it } from "vitest";
import { defaultPaintLayerForTile, tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { createBlankProject, TILE } from "@/project/defaults";
import type { TilesetDef } from "@/project/types";

// RM2K3식 타일 레이어 분류 — 각 타일의 홈 레이어 판정과 팔레트 노출 규칙.

function bundledTileset(): TilesetDef {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  return project.tilesets[map.tilesetId];
}

describe("tileLayerHome — 홈 레이어 판정", () => {
  it("WATER(하네스 lower 그룹)는 lower가 홈이다", () => {
    expect(tileLayerHome(bundledTileset(), TILE.WATER)).toBe("lower");
  });

  it("울타리(stackable 소품)는 upper가 홈이다 — 지면 보존", () => {
    const tileset = bundledTileset();
    for (const fence of [378, 379, 380, 408, 409, 410, 438, 439]) {
      expect(tileLayerHome(tileset, fence)).toBe("upper");
    }
  });

  it("FLOWERS(투명 칩)는 mixed 그룹이라도 upper가 홈이다 — 하위에 깔리면 검게 보인다", () => {
    expect(tileLayerHome(bundledTileset(), TILE.FLOWERS)).toBe("upper");
  });

  it("불투명 mixed 소품(441)은 양쪽 레이어를 허용한다", () => {
    expect(tileLayerHome(bundledTileset(), 441)).toBe("both");
  });

  it("분류 없는 타일셋(priority 전부 lower)에서는 요청 레이어를 존중하도록 both를 반환한다", () => {
    const tileset = bundledTileset();
    const unclassified: TilesetDef = {
      ...tileset,
      id: "unclassified",
      image: { type: "bundled", id: "not-town" },
      tileGroups: [],
      priority: tileset.priority.map(() => "lower" as const),
    };
    expect(tileLayerHome(unclassified, 10)).toBe("both");
  });
});

describe("tileVisibleOnLayer — 팔레트 레이어별 노출", () => {
  it("lower 홈 타일은 lower 팔레트에만 보인다", () => {
    const tileset = bundledTileset();
    expect(tileVisibleOnLayer(tileset, TILE.WATER, "lower")).toBe(true);
    expect(tileVisibleOnLayer(tileset, TILE.WATER, "upper")).toBe(false);
  });

  it("upper 홈 타일(울타리)은 upper 팔레트에만 보인다", () => {
    const tileset = bundledTileset();
    expect(tileVisibleOnLayer(tileset, 378, "upper")).toBe(true);
    expect(tileVisibleOnLayer(tileset, 378, "lower")).toBe(false);
  });

  it("불투명 mixed 타일(441)은 양쪽 팔레트에, 투명 칩(FLOWERS)은 상위에만 보인다", () => {
    const tileset = bundledTileset();
    expect(tileVisibleOnLayer(tileset, 441, "lower")).toBe(true);
    expect(tileVisibleOnLayer(tileset, 441, "upper")).toBe(true);
    expect(tileVisibleOnLayer(tileset, TILE.FLOWERS, "lower")).toBe(false);
    expect(tileVisibleOnLayer(tileset, TILE.FLOWERS, "upper")).toBe(true);
  });
});

describe("defaultPaintLayerForTile — 스탬프 배치 레이어", () => {
  it("단일 홈 타일은 홈 레이어, mixed는 priority를 따른다", () => {
    const tileset = bundledTileset();
    expect(defaultPaintLayerForTile(tileset, TILE.WATER)).toBe("lower");
    expect(defaultPaintLayerForTile(tileset, 378)).toBe("upper");
    expect(defaultPaintLayerForTile(tileset, TILE.FLOWERS)).toBe(tileset.priority[TILE.FLOWERS] ?? "lower");
  });
});
