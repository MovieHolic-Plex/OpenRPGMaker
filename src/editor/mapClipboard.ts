import { editorState, type TileSelection } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { replaceTileStack, tileStackAt } from "@/project/mapOverlayTiles";
import { store, type ProjectChangeCell } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";
import { toast } from "@/util/toast";

type TileLayer = "lower" | "upper";
const CLIPBOARD_LAYERS: readonly TileLayer[] = ["lower", "upper"];

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

// 선택 영역을 하위+상위 레이어(오버레이 스택 포함) 통째로 복사한다.
// RM2K3의 영역 복사처럼 레이어를 나누지 않는다 — 붙여넣기 시 두 레이어가 함께 복원된다.
export function copySelection(mapId: MapId): boolean {
  const state = editorState.get();
  const selection = state.selection;
  if (!selection || selection.mapId !== mapId) {
    showClipboardToast("복사할 영역이 없습니다 — 선택 도구(5)로 영역을 먼저 지정하세요.", "error");
    return false;
  }
  const map = store.getCurrent().maps[mapId];
  if (!map || !isRegionInsideMap(selection.x, selection.y, selection.width, selection.height, map.width, map.height)) {
    showClipboardToast("선택 영역이 맵 밖입니다.", "error");
    return false;
  }
  const lower = { tiles: [] as number[], stacks: [] as number[][] };
  const upper = { tiles: [] as number[], stacks: [] as number[][] };
  for (let y = 0; y < selection.height; y++) {
    for (let x = 0; x < selection.width; x++) {
      const index = (selection.y + y) * map.width + selection.x + x;
      lower.tiles.push(map.lowerTiles[index]);
      lower.stacks.push([...tileStackAt(map, "lower", index)]);
      upper.tiles.push(map.upperTiles[index]);
      upper.stacks.push([...tileStackAt(map, "upper", index)]);
    }
  }
  editorState.set({
    clipboard: {
      width: selection.width,
      height: selection.height,
      lower,
      upper,
    },
  });
  showClipboardToast("복사됨", "ok");
  return true;
}

export function pasteClipboard(mapId: MapId, x: number, y: number): boolean {
  const clipboard = editorState.get().clipboard;
  if (!clipboard) {
    showClipboardToast("붙여넣을 내용이 없습니다 — 먼저 복사하세요.", "error");
    return false;
  }
  const map = store.getCurrent().maps[mapId];
  if (!map || !isInsideMap(x, y, map.width, map.height)) {
    showClipboardToast("붙여넣을 위치가 맵 밖입니다.", "error");
    return false;
  }
  const cells = pastedCells(map, clipboard.width, clipboard.height, x, y);
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
        for (const layer of CLIPBOARD_LAYERS) {
          const source = clipboard[layer];
          tilesForLayer(targetMap, layer)[targetIndex] = source.tiles[sourceIndex];
          replaceTileStack(targetMap, layer, targetIndex, source.stacks[sourceIndex] ?? []);
        }
      }
    }
  }, { scope: "map", mapId, cells });
  return true;
}

function pastedCells(map: GameMap, width: number, height: number, originX: number, originY: number): readonly ProjectChangeCell[] {
  const cells: ProjectChangeCell[] = [];
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const x = originX + cx;
      const y = originY + cy;
      if (!isInsideMap(x, y, map.width, map.height)) continue;
      cells.push({ x, y, layer: "lower" }, { x, y, layer: "upper" });
    }
  }
  return cells;
}

function tilesForLayer(map: GameMap, layer: TileLayer): number[] {
  return layer === "upper" ? map.upperTiles : map.lowerTiles;
}

function isInsideMap(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function isRegionInsideMap(x: number, y: number, regionWidth: number, regionHeight: number, mapWidth: number, mapHeight: number): boolean {
  return regionWidth > 0 && regionHeight > 0 && x >= 0 && y >= 0 && x + regionWidth <= mapWidth && y + regionHeight <= mapHeight;
}

function showClipboardToast(message: string, kind: "ok" | "error"): void {
  if (typeof document === "undefined") return;
  toast(message, kind);
}
