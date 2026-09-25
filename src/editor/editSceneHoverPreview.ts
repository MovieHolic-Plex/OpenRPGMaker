import { mapTileSize } from "@/project/tileGeometry";
import type Phaser from "phaser";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { comboBrushPlacement } from "@/editor/comboBrush";
import { editorState } from "@/editor/editorState";
import { brushStrokePoints } from "@/editor/TilePaintEngine";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

/** 페인트/드래그 중에는 팔레트 raw 호버를 그리지 않는다 — 성형 결과와 겹쳐 깜빡임이 난다. */
export function shouldShowPaintHoverPreview(input: {
  readonly isPainting: boolean;
  readonly dragActive: boolean;
}): boolean {
  return !input.isPainting && !input.dragActive;
}

type HoverPreviewSpec = {
  readonly centerX: number;
  readonly centerY: number;
  readonly layer: Phaser.GameObjects.Container;
  readonly mapId: MapId;
  readonly scene: Phaser.Scene;
  /** 이 맵의 좌표 단위(px). 렌더와 같은 값을 써야 미리보기가 칸에 정확히 앉는다. */
  readonly tileSize?: number;
};

const HOVER_PREVIEW_KEY = "oprnHoverPreviewKey";

function hoverPreviewKey(spec: HoverPreviewSpec): string {
  const state = editorState.get();
  const stamp = state.activePaletteStamp;
  const stampKey = stamp
    ? `${stamp.width}x${stamp.height}:${stamp.source.startTile}-${stamp.source.endTile}:${stamp.cells.length}`
    : "";
  return [
    spec.mapId, spec.centerX, spec.centerY, state.tool, state.layer,
    state.selectedTile, state.brushSize, state.paintShape, stampKey,
  ].join("|");
}

export function renderHoverTilePreview(spec: HoverPreviewSpec): void {
  const key = hoverPreviewKey(spec);
  if (spec.layer.getData(HOVER_PREVIEW_KEY) === key && spec.layer.list.length > 0) return;
  spec.layer.setData(HOVER_PREVIEW_KEY, key);
  spec.layer.removeAll(true);
  const map = store.getCurrent().maps[spec.mapId];
  if (!map) return;
  const tileSize = spec.tileSize ?? mapTileSize(map);
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return;
  const state = editorState.get();
  if (state.tool !== "paint" && state.tool !== "fill" && state.tool !== "erase") return;
  if (spec.centerX < 0 || spec.centerY < 0 || spec.centerX >= map.width || spec.centerY >= map.height) return;
  if (state.tool === "paint" && state.activePaletteStamp) {
    // 발자국은 comboBrushPlacement 하나로 푸다 — 여기서 두 번째 경계 계산을 하지 않는다.
    // 예전에는 미리보기와 페인트가 각자 `x < map.width` 를 세서 둘이 어긋날 수 있었고,
    // 잘리는 칸은 그냥 안 그려서 "누르면 몇 칸이 사라진다"는 사실이 누르기 전에 보이지 않았다.
    const placement = comboBrushPlacement({
      bounds: { height: map.height, width: map.width },
      stamp: state.activePaletteStamp,
      x: spec.centerX,
      y: spec.centerY,
    });
    for (const placed of placement.cells) {
      const { x, y } = placed;
      if (placed.inBounds) {
        const preview = createChipsetTileObject(spec.scene, map, tileset, x, y, placed.cell.tile);
        preview.setAlpha(placed.cell.layer === "upper" ? 0.72 : 0.58);
        spec.layer.add(preview);
      }
      // 맵 밖 칸도 표시한다 — 붉은 슬롯이 계약대로 "이 칸은 잘린다"를 미리 말한다.
      const marker = spec.scene.add.rectangle(
        x * tileSize,
        y * tileSize,
        tileSize,
        tileSize,
        placed.inBounds ? 0x51cf66 : 0xff6b6b,
        placed.inBounds ? 0.12 : 0.22,
      );
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, placed.inBounds ? 0xd3f9d8 : 0xffc9c9, placed.inBounds ? 0.72 : 0.9);
      spec.layer.add(marker);
    }
    return;
  }
  const erasing = state.tool === "erase" || state.selectedTile < 0;
  if (state.selectedTile < 0 && state.tool !== "erase" && state.layer !== "upper") return;
  const size = state.tool === "erase" || (state.tool === "paint" && state.paintShape === "pen") ? state.brushSize : 1;
  for (const { x, y } of brushStrokePoints({ centerX: spec.centerX, centerY: spec.centerY, size })) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (!erasing) {
      const preview = createChipsetTileObject(spec.scene, map, tileset, x, y, state.selectedTile);
      preview.setAlpha(0.62);
      spec.layer.add(preview);
    }
    const marker = spec.scene.add.rectangle(x * tileSize, y * tileSize, tileSize, tileSize, erasing ? 0xff6b6b : 0x3bc9db, 0.18);
    marker.setOrigin(0, 0);
    marker.setStrokeStyle(1, 0xe7f5ff, 0.85);
    spec.layer.add(marker);
  }
}
