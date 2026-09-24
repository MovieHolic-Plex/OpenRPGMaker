import { editorState, type TileSelection } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
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
  // 값이 같으면 통지하지 않는다. editorState.set 의 무변경 판정은 **참조 비교**라
  // 새 객체 리터럴은 언제나 "변경"으로 통과하고, 통지 하나가 좌측 독 전체 재구축을
  // 부른다(editor.ts refreshPanels). 우클릭 영역 드래그는 pointermove 마다 여기를
  // 호출하므로 같은 칸 안에서 움직이는 프레임이 그대로 재구축이 됐다.
  const current = editorState.get().selection;
  if (
    current &&
    current.mapId === mapId &&
    current.x === selection.x &&
    current.y === selection.y &&
    current.width === width &&
    current.height === height
  ) {
    return true;
  }
  editorState.set({
    selection: { mapId, x: selection.x, y: selection.y, width, height },
  });
  return true;
}

export function clearSelection(): void {
  editorState.set({ selection: null, pastePreview: null });
}

// 선택 영역을 하위+상위 레이어(오버레이 스택 포함) 통째로 복사한다.
// RM2K3의 영역 복사처럼 레이어를 나누지 않는다 — 붙여넣기 시 두 레이어가 함께 복원된다.
export function copySelection(mapId: MapId): boolean {
  const state = editorState.get();
  const selection = state.selection;
  if (!selection || selection.mapId !== mapId) {
    showClipboardToast("복사할 영역이 없습니다 — 선택 도구(V)로 영역을 먼저 지정하세요.", "error");
    return false;
  }
  const map = store.getCurrent().maps[mapId];
  if (!map || !isRegionInsideMap(selection.x, selection.y, selection.width, selection.height, map.width, map.height)) {
    showClipboardToast("선택 영역이 맵 밖입니다.", "error");
    return false;
  }
  const lower = { tiles: [] as number[], stacks: [] as number[][], overlay: [] as number[] };
  const upper = { tiles: [] as number[], stacks: [] as number[][], overlay: [] as number[] };
  const shadow: number[] = [];
  for (let y = 0; y < selection.height; y++) {
    for (let x = 0; x < selection.width; x++) {
      const index = (selection.y + y) * map.width + selection.x + x;
      lower.tiles.push(map.lowerTiles[index]);
      lower.stacks.push([...tileStackAt(map, "lower", index)]);
      lower.overlay.push(layerTileAt(map, 2, index));
      upper.tiles.push(map.upperTiles[index]);
      upper.stacks.push([...tileStackAt(map, "upper", index)]);
      upper.overlay.push(layerTileAt(map, 4, index));
      shadow.push(shadowAt(map, index));
    }
  }
  editorState.set({
    clipboard: {
      width: selection.width,
      height: selection.height,
      lower,
      upper,
      shadow,
    },
  });
  showClipboardToast(`${selection.width}×${selection.height} 복사됨`, "ok");
  return true;
}

// ── 붙여넣기 미리보기 모드 ──
// Ctrl+V → 고스트가 커서 추종 → 클릭으로 확정, Esc로 취소.

/** 붙여넣기 미리보기 모드 진입. 클립보드가 없으면 false. */
export function enterPastePreview(mapId: MapId, x: number, y: number): boolean {
  const clipboard = editorState.get().clipboard;
  if (!clipboard) {
    showClipboardToast("붙여넣을 내용이 없습니다 — 먼저 복사하세요.", "error");
    return false;
  }
  const map = store.getCurrent().maps[mapId];
  if (!map) return false;
  editorState.set({ pastePreview: { x: clampPasteOrigin(x, clipboard.width, map.width), y: clampPasteOrigin(y, clipboard.height, map.height) } });
  return true;
}

/** 미리보기 위치 갱신 (커서 추종). */
export function movePastePreview(mapId: MapId, x: number, y: number): void {
  const clipboard = editorState.get().clipboard;
  const map = store.getCurrent().maps[mapId];
  if (!clipboard || !map) return;
  const next = {
    x: clampPasteOrigin(x, clipboard.width, map.width),
    y: clampPasteOrigin(y, clipboard.height, map.height),
  };
  const current = editorState.get().pastePreview;
  if (current && current.x === next.x && current.y === next.y) return;
  editorState.set({ pastePreview: next });
}

/** 미리보기 확정 → 실제 붙여넣기. */
export function confirmPastePreview(mapId: MapId): boolean {
  const preview = editorState.get().pastePreview;
  if (!preview) return false;
  // 붙여넣은 칸에 선택 툴바가 따라오면 Ctrl+V 스탬프 작업을 가린다.
  // 미리보기 중에도 칩은 숨기고, 확정 뒤에는 원본 선택을 내려 다시 띄우지 않는다.
  editorState.set({ pastePreview: null, selection: null });
  return pasteClipboard(mapId, preview.x, preview.y);
}

/** 미리보기 취소. */
export function cancelPastePreview(): boolean {
  if (!editorState.get().pastePreview) return false;
  editorState.set({ pastePreview: null });
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
        setLayerTileAt(targetMap, 2, targetIndex, clipboard.lower.overlay?.[sourceIndex] ?? -1);
        setLayerTileAt(targetMap, 4, targetIndex, clipboard.upper.overlay?.[sourceIndex] ?? -1);
        setShadowAt(targetMap, targetIndex, clipboard.shadow?.[sourceIndex] ?? 0);
      }
    }
  }, { scope: "map", mapId, cells });
  showClipboardToast(`${clipboard.width}×${clipboard.height} 붙여넣기 완료`, "ok");
  return true;
}

/** 선택 영역을 하위+상위 모두 빈 칸으로 지운다. */
export function clearSelectionRegion(mapId: MapId): boolean {
  const selection = editorState.get().selection;
  if (!selection || selection.mapId !== mapId) return false;
  const map = store.getCurrent().maps[mapId];
  if (!map || !isRegionInsideMap(selection.x, selection.y, selection.width, selection.height, map.width, map.height)) return false;
  const cells = pastedCells(map, selection.width, selection.height, selection.x, selection.y);
  recordProjectSnapshot();
  store.update((project) => {
    const targetMap = project.maps[mapId];
    if (!targetMap) return;
    for (let cy = 0; cy < selection.height; cy++) {
      for (let cx = 0; cx < selection.width; cx++) {
        const tx = selection.x + cx;
        const ty = selection.y + cy;
        if (!isInsideMap(tx, ty, targetMap.width, targetMap.height)) continue;
        const idx = ty * targetMap.width + tx;
        targetMap.lowerTiles[idx] = -1;
        targetMap.upperTiles[idx] = -1;
        replaceTileStack(targetMap, "lower", idx, []);
        replaceTileStack(targetMap, "upper", idx, []);
        setLayerTileAt(targetMap, 2, idx, -1);
        setLayerTileAt(targetMap, 4, idx, -1);
        setShadowAt(targetMap, idx, 0);
      }
    }
  }, { scope: "map", mapId, cells });
  showClipboardToast("영역 지우기 완료", "ok");
  return true;
}

function clampPasteOrigin(origin: number, clipSize: number, mapSize: number): number {
  return Math.max(0, Math.min(origin, mapSize - Math.min(clipSize, mapSize)));
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
