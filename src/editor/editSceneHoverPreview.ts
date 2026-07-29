import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { editorState } from "@/editor/editorState";
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
};

export function renderHoverTilePreview(spec: HoverPreviewSpec): void {
  spec.layer.removeAll(true);
  const map = store.getCurrent().maps[spec.mapId];
  if (!map) return;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return;
  const state = editorState.get();
  if (state.selectedTile < 0 || (state.tool !== "paint" && state.tool !== "fill")) return;
  if (spec.centerX < 0 || spec.centerY < 0 || spec.centerX >= map.width || spec.centerY >= map.height) return;
  if (state.tool === "paint" && state.activePaletteStamp) {
    for (const cell of state.activePaletteStamp.cells) {
      const x = spec.centerX + cell.dx;
      const y = spec.centerY + cell.dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const preview = createChipsetTileObject(spec.scene, map, tileset, x, y, cell.tile);
      preview.setAlpha(cell.layer === "upper" ? 0.72 : 0.58);
      spec.layer.add(preview);
      const marker = spec.scene.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x51cf66, 0.12);
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, 0xd3f9d8, 0.72);
      spec.layer.add(marker);
    }
    return;
  }
  const size = state.tool === "paint" && state.paintShape === "pen" ? state.brushSize : 1;
  const offset = Math.floor(size / 2);
  for (let y = spec.centerY - offset; y <= spec.centerY + offset; y++) {
    for (let x = spec.centerX - offset; x <= spec.centerX + offset; x++) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const preview = createChipsetTileObject(spec.scene, map, tileset, x, y, state.selectedTile);
      preview.setAlpha(0.62);
      spec.layer.add(preview);
      const marker = spec.scene.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x3bc9db, 0.18);
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, 0xe7f5ff, 0.85);
      spec.layer.add(marker);
    }
  }
}
