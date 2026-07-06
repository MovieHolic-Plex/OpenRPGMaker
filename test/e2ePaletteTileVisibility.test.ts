import { describe, expect, it } from "vitest";
import { tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { createBlankProject } from "@/project/defaults";
import type { TilesetDef } from "@/project/types";

// e2e 스펙(rm2k3-map-editor.spec.ts)이 클릭하는 타일이 엄격 레이어 필터 후에도
// 해당 레이어 팔레트 시트에 존재하는지 고정한다. 여기가 깨지면 e2e도 깨진다.

function bundledTileset(): TilesetDef {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  return project.tilesets[map.tilesetId];
}

describe("팔레트 레이어 필터 — e2e가 참조하는 타일 노출 보장", () => {
  it("FILL_TILE(6)/PAINT_TILE(7)은 하위 팔레트에 보인다", () => {
    const tileset = bundledTileset();
    expect(tileVisibleOnLayer(tileset, 6, "lower")).toBe(true);
    expect(tileVisibleOnLayer(tileset, 7, "lower")).toBe(true);
  });

  it("UPPER_TILE(374, 사선 지붕 오버레이)은 상위 팔레트에 보인다", () => {
    const tileset = bundledTileset();
    expect(tileVisibleOnLayer(tileset, 374, "upper")).toBe(true);
  });
});
