import { editorState, type TileClipboardRelief, type TileSelection } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { compactMapLayers, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { replaceTileStack, tileStackAt } from "@/project/mapOverlayTiles";
import { copyRelief, emptyRelief } from "@/project/relief/edit";
import { RELIEF_MAX_LEVEL, type ReliefData } from "@/project/relief/types";
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
      relief: reliefStampFromMap(map, selection.x, selection.y, selection.width, selection.height),
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
  // pastedCells 는 칸마다 lower·upper 두 줄이다 — 기록 라벨에는 칸(위치) 수를 적는다.
  recordProjectSnapshot(`붙여넣기 · ${cells.length / 2}칸`);
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
    if (clipboard.relief) {
      applyReliefStamp(targetMap, clipboard.relief, x, y, clipboard.width, clipboard.height);
    }
    // 빈 칸을 붙여 마지막 2·4층·그림자 칸이 비면 선택 칸을 뺀다 — 옛 맵 모양으로 돌아간다.
    compactMapLayers(targetMap);
  }, { scope: "map", mapId, cells, ...(clipboard.relief ? { relief: true as const } : {}) });
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
  recordProjectSnapshot(`선택 영역 지우기 · ${cells.length / 2}칸`);
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
    if (targetMap.relief) {
      applyReliefStamp(
        targetMap,
        { levels: new Array(selection.width * selection.height).fill(0) },
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    }
    compactMapLayers(targetMap);
  }, { scope: "map", mapId, cells, ...(map.relief ? { relief: true as const } : {}) });
  showClipboardToast("영역 지우기 완료", "ok");
  return true;
}

function reliefStampFromMap(map: GameMap, originX: number, originY: number, width: number, height: number): TileClipboardRelief {
  const levels: number[] = [];
  const ramps: number[] = [];
  let anyRamp = false;
  for (let cy = 0; cy < height; cy += 1) {
    for (let cx = 0; cx < width; cx += 1) {
      const index = (originY + cy) * map.width + originX + cx;
      levels.push(map.relief?.levels[index] ?? 0);
      const ramp = map.relief?.ramps?.[index] ?? 0;
      ramps.push(ramp);
      if (ramp > 0) anyRamp = true;
    }
  }
  const wallDecor = (map.relief?.wallDecor ?? []).flatMap((decor) => {
    if (decor.x < originX || decor.y < originY || decor.x >= originX + width || decor.y >= originY + height) return [];
    return [{ x: decor.x - originX, y: decor.y - originY, row: decor.row, tile: decor.tile }];
  });
  return {
    levels,
    ...(anyRamp ? { ramps } : {}),
    ...(wallDecor.length > 0 ? { wallDecor } : {}),
  };
}

/** 스탬프의 높이로 사각형을 덮는다. 평지 스탬프는 그 칸의 언덕·경사·벽 장식을 지운다. */
function applyReliefStamp(
  map: GameMap,
  stamp: TileClipboardRelief,
  originX: number,
  originY: number,
  stampWidth: number,
  stampHeight: number,
): void {
  const { width, height } = map;
  const current = map.relief;
  if (current && (current.width !== width || current.height !== height || current.levels.length !== width * height)) return;
  const stampRaises = stamp.levels.some((level) => level > 0)
    || (stamp.ramps?.some((ramp) => ramp > 0) ?? false)
    || (stamp.wallDecor?.length ?? 0) > 0;
  if (!current && !stampRaises) return;

  const relief: ReliefData = current ? copyRelief(current) : emptyRelief(width, height);
  const writeRamps = Boolean(relief.ramps) || (stamp.ramps?.some((ramp) => ramp > 0) ?? false);
  if (writeRamps) relief.ramps ??= new Array(width * height).fill(0);

  const covered = new Set<string>();
  for (let cy = 0; cy < stampHeight; cy += 1) {
    for (let cx = 0; cx < stampWidth; cx += 1) {
      const x = originX + cx;
      const y = originY + cy;
      if (!isInsideMap(x, y, width, height)) continue;
      const sourceIndex = cy * stampWidth + cx;
      const targetIndex = y * width + x;
      relief.levels[targetIndex] = clampReliefLevel(stamp.levels[sourceIndex] ?? 0);
      if (relief.ramps) relief.ramps[targetIndex] = clampReliefRamp(stamp.ramps?.[sourceIndex] ?? 0);
      covered.add(`${x},${y}`);
    }
  }
  const kept = (relief.wallDecor ?? []).filter((decor) => !covered.has(`${decor.x},${decor.y}`));
  const added = (stamp.wallDecor ?? []).flatMap((decor) => {
    const x = originX + decor.x;
    const y = originY + decor.y;
    if (!covered.has(`${x},${y}`)) return [];
    return [{ x, y, row: decor.row, tile: decor.tile }];
  });
  if (kept.length + added.length > 0) relief.wallDecor = [...kept, ...added];
  else delete relief.wallDecor;
  if (relief.ramps && !relief.ramps.some((ramp) => ramp > 0)) delete relief.ramps;
  // 경사로(1~8)는 낮은 끝 단이 0이어도 칸의 일부다. reliefIsFlat 은 그 칸을 평지로 본다.
  if (reliefHasStamp(relief)) map.relief = relief;
  else delete map.relief;
}

function reliefHasStamp(relief: ReliefData): boolean {
  return relief.levels.some((level) => level > 0)
    || (relief.ramps?.some((ramp) => ramp > 0) ?? false)
    || (relief.wallDecor?.length ?? 0) > 0;
}

function clampReliefLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(RELIEF_MAX_LEVEL, Math.round(value)));
}

function clampReliefRamp(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 9) return 0;
  return value;
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
