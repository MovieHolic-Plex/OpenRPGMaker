import { editorState, type TileSelection } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { replaceTileStack, tileStackAt } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

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
  const map = store.getCurrent().maps[mapId];
  if (!map) return false;
  const lower = copyLayerSelection(map, selection, "lower");
  const upper = copyLayerSelection(map, selection, "upper");
  editorState.set({
    clipboard: {
      width: selection.width,
      height: selection.height,
      lowerTiles: lower.tiles,
      upperTiles: upper.tiles,
      lowerStacks: lower.stacks,
      upperStacks: upper.stacks,
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
    for (let cy = 0; cy < clipboard.height; cy++) {
      for (let cx = 0; cx < clipboard.width; cx++) {
        const tx = x + cx;
        const ty = y + cy;
        if (!isInsideMap(tx, ty, targetMap.width, targetMap.height)) continue;
        const sourceIndex = cy * clipboard.width + cx;
        const targetIndex = ty * targetMap.width + tx;
        pasteLayerTile(targetMap, "lower", targetIndex, clipboard.lowerTiles[sourceIndex], clipboard.lowerStacks?.[sourceIndex] ?? []);
        pasteLayerTile(targetMap, "upper", targetIndex, clipboard.upperTiles[sourceIndex], clipboard.upperStacks?.[sourceIndex] ?? []);
      }
    }
  });
  return true;
}

function copyLayerSelection(
  map: GameMap,
  selection: TileSelection,
  layer: TileLayer,
): { readonly tiles: number[]; readonly stacks: number[][] } {
  const source = tilesForLayer(map, layer);
  const tiles: number[] = [];
  const stacks: number[][] = [];
  for (let y = 0; y < selection.height; y++) {
    for (let x = 0; x < selection.width; x++) {
      const index = (selection.y + y) * map.width + selection.x + x;
      tiles.push(source[index]);
      stacks.push([...tileStackAt(map, layer, index)]);
    }
  }
  return { tiles, stacks };
}

function pasteLayerTile(
  map: GameMap,
  layer: TileLayer,
  index: number,
  tile: number,
  stack: readonly number[],
): void {
  const target = tilesForLayer(map, layer);
  target[index] = tile;
  replaceTileStack(map, layer, index, stack);
}

function tilesForLayer(map: { lowerTiles: number[]; upperTiles: number[] }, layer: TileLayer): number[] {
  return layer === "upper" ? map.upperTiles : map.lowerTiles;
}

function isInsideMap(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}
