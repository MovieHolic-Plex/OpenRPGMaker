import { editorState, type TileSelection } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { replaceTileStack, tileStackAt } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

type TileLayer = "lower" | "upper";

export function selectTileRegion(mapId: MapId, selection: TileSelection): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map) return false;
  if (!isInsideMap(selection.x, selection.y, map.width, map.height)) return false;
  const width = Math.min(selection.width, map.width - selection.x);
  const height = Math.min(selection.height, map.height - selection.y);
  editorState.set({
    selection: { mapId, x: selection.x, y: selection.y, width, height },
  });
  return true;
}

export function copySelection(mapId: MapId): boolean {
  const state = editorState.get();
  const selection = state.selection;
  if (!selection || selection.mapId !== mapId) return false;
  const layer = state.layer === "upper" ? "upper" : "lower";
  const map = store.getCurrent().maps[mapId];
  if (!map) return false;
  const source = layer === "upper" ? map.upperTiles : map.lowerTiles;
  const tiles: number[] = [];
  const stacks: number[][] = [];
  for (let y = 0; y < selection.height; y++) {
    for (let x = 0; x < selection.width; x++) {
      const index = (selection.y + y) * map.width + selection.x + x;
      tiles.push(source[index]);
      stacks.push([...tileStackAt(map, layer, index)]);
    }
  }
  editorState.set({
    clipboard: {
      layer,
      width: selection.width,
      height: selection.height,
      tiles,
      stacks,
    },
  });
  return true;
}

export function pasteClipboard(mapId: MapId, x: number, y: number): boolean {
  const clipboard = editorState.get().clipboard;
  if (!clipboard) return false;
  const map = store.getCurrent().maps[mapId];
  if (!map || !isInsideMap(x, y, map.width, map.height)) return false;
  recordProjectSnapshot();
  store.update((project) => {
    const targetMap = project.maps[mapId];
    if (!targetMap) return;
    const target = tilesForLayer(targetMap, clipboard.layer);
    for (let cy = 0; cy < clipboard.height; cy++) {
      for (let cx = 0; cx < clipboard.width; cx++) {
        const tx = x + cx;
        const ty = y + cy;
        if (!isInsideMap(tx, ty, targetMap.width, targetMap.height)) continue;
        const sourceIndex = cy * clipboard.width + cx;
        const targetIndex = ty * targetMap.width + tx;
        target[targetIndex] = clipboard.tiles[sourceIndex];
        replaceTileStack(targetMap, clipboard.layer, targetIndex, clipboard.stacks?.[sourceIndex] ?? []);
      }
    }
  });
  return true;
}

function tilesForLayer(map: { lowerTiles: number[]; upperTiles: number[] }, layer: TileLayer): number[] {
  return layer === "upper" ? map.upperTiles : map.lowerTiles;
}

function isInsideMap(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}
