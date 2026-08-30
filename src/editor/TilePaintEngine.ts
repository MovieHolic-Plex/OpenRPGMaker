import type Phaser from "phaser";
import {
  paintTilesBulk,
  eraseVisibleTilesBulk,
  toggleCollision,
  fillTile,
} from "@/editor/actions";
import type { TileStrokeCell } from "@/editor/tileActions";
import { editorState } from "@/editor/editorState";
import { revealPaletteTileFromMap } from "@/editor/panels/tilePalette";
import { selectTileRegion } from "@/editor/mapClipboard";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { beginKitStampCapture, checkKitStampConditions, commitKitStampCapture } from "@/editor/structurePlacementActions";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { visibleTilePickAt } from "@/editor/tilePicking";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { MapId, TilesetDef } from "@/project/types";
import { toast } from "@/util/toast";

export type TileLayer = "lower" | "upper";

type TilePickTarget = {
  readonly mapId: MapId;
  readonly layer: TileLayer;
  readonly x: number;
  readonly y: number;
};

export type TilePaintEngineDeps = {
  readonly mapId: () => MapId | null;
  readonly pointerToTile: (ptr: Phaser.Input.Pointer) => { readonly x: number; readonly y: number };
  readonly updatePointerStatus: (ptr: Phaser.Input.Pointer) => void;
  readonly eventLayerClickCount: (target: {
    readonly mapId: MapId;
    readonly ptr: Phaser.Input.Pointer;
    readonly x: number;
    readonly y: number;
  }) => number;
  readonly pointerClickCount: (ptr: Phaser.Input.Pointer) => number;
  readonly offerEventLayerSwitchAt: (mapId: MapId, x: number, y: number, layer: string, clickCount: number) => boolean;
  readonly showEventLayerClickFeedback: (mapId: MapId, x: number, y: number) => void;
  readonly openExistingEventAt: (mapId: MapId, x: number, y: number) => boolean;
  readonly handleEventClick: (mapId: MapId, x: number, y: number, openEditor?: boolean) => void;
  readonly tilesetForMap: (mapId: MapId) => TilesetDef | undefined;
  readonly setLastPointerTile: (point: { readonly x: number; readonly y: number }) => void;
  readonly getPaintState: () => { readonly isPainting: boolean; readonly lastPaintKey: string };
  readonly setPaintState: (state: { readonly isPainting?: boolean; readonly lastPaintKey?: string }) => void;
};

export class TilePaintEngine {
  constructor(private readonly deps: TilePaintEngineDeps) {}

  applyAtPointer(ptr: Phaser.Input.Pointer): void {
    const mid = this.deps.mapId();
    if (!mid) return;
    const { x, y } = this.deps.pointerToTile(ptr);
    this.deps.setLastPointerTile({ x, y });
    this.deps.updatePointerStatus(ptr);

    const tool = editorState.get().tool;
    const layer = editorState.get().layer;
    if (!canEditMap(mid) && toolCanMutateMap(tool)) {
      this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
      toast(mapEditLockNotice(mid), "error");
      return;
    }
    const { activePaletteStamp, autoConnectMode, brushSize, selectedTile } = editorState.get();
    const key = `${x},${y}`;
    const firstStrokeTile = this.deps.getPaintState().lastPaintKey === "";
    const repeatedNonEventCell = layer !== "event" && key === this.deps.getPaintState().lastPaintKey;
    const tileLayer: TileLayer = layer === "upper" ? "upper" : "lower";
    const clickCount =
      layer === "event" ? this.deps.eventLayerClickCount({ mapId: mid, ptr, x, y }) : this.deps.pointerClickCount(ptr);
    if (this.deps.offerEventLayerSwitchAt(mid, x, y, layer, clickCount)) return;
    if (repeatedNonEventCell) return;
    this.deps.setPaintState({ lastPaintKey: key });
    if (layer === "event") this.deps.showEventLayerClickFeedback(mid, x, y);

    if (layer === "event" && clickCount >= 2 && this.deps.openExistingEventAt(mid, x, y)) {
      return;
    }

    switch (tool) {
      case "paint":
        // 스냅샷은 스트로크(드래그) 시작 시 1회만 — 셀마다 찍으면 드래그 한 번에 맵 clone+직렬화가
        // N번 돌아 렉의 원인이 되고, undo도 셀 단위로 쪼개져 되돌리기가 고통스럽다.
        if (firstStrokeTile) recordTileEditSnapshot(mid);
        {
          if (activePaletteStamp) {
            // 배치 조건(kit.ai.placement) 검사 — 킷에 조건이 있을 때만 돈다.
            // hard 를 어기면 **칠하지 않는다**. 예전에는 조건이 산문뿐이라 아무 일도 일어나지 않았고,
            // 「화덕은 북벽에 붙는다」 같은 말이 지켜지는지 확인할 방법이 없었다.
            // 토스트는 스트로크 첫 타일에서만 — 드래그로 같은 말을 수십 번 띄우지 않는다.
            const conditions = checkKitStampConditions(mid, activePaletteStamp, x, y);
            if (conditions && conditions.verdict.blocked.length > 0) {
              if (firstStrokeTile) {
                toast(
                  `여기엔 '${conditions.kit.name ?? "구조물"}'을 놓을 수 없습니다 — `
                  + conditions.verdict.blocked.map((failure) => failure.text).join(" / "),
                  "error",
                );
              }
              break;
            }
            if (conditions && conditions.verdict.warnings.length > 0 && firstStrokeTile) {
              toast(conditions.verdict.warnings.map((failure) => failure.text).join(" / "), "info");
            }
            // 구조물 배치 기록은 **스트로크의 첫 타일에서 한 번만** — 드래그로 배치가 수십 개 생기는 것을 막는다.
            // 구조물 킷이 아닌 스탬프(일반 드래그 선택·실내 오브젝트)는 beginKitStampCapture 가 null 을 준다.
            const capture = firstStrokeTile ? beginKitStampCapture(mid, activePaletteStamp, x, y) : null;
            applyPaletteStamp({ mapId: mid, stamp: activePaletteStamp, x, y, autoConnect: autoConnectMode });
            if (capture) commitKitStampCapture(capture);
            break;
          }
          // 브러시 전 칸을 한 번의 updateMap 으로 (셀마다 clone 금지)
          paintTilesBulk(
            mid,
            brushStrokeCells({ centerX: x, centerY: y, size: brushSize, layer: tileLayer, tile: selectedTile }),
            { autoConnect: autoConnectMode },
          );
        }
        break;
      case "fill":
        if (firstStrokeTile) {
          recordTileEditSnapshot(mid);
          fillTile(mid, tileLayer, x, y, selectedTile, { autoConnect: autoConnectMode });
        }
        break;
      case "erase":
        if (firstStrokeTile) recordTileEditSnapshot(mid);
        eraseVisibleTilesBulk(
          mid,
          tileLayer,
          brushStrokePoints({ centerX: x, centerY: y, size: brushSize }),
          { autoConnect: autoConnectMode },
        );
        break;
      case "collision":
        if (firstStrokeTile) recordTileEditSnapshot(mid, { includeTilesets: true });
        toggleCollision(mid, x, y);
        break;
      case "event":
        this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
        this.deps.handleEventClick(mid, x, y, clickCount >= 2);
        break;
      case "select":
        selectTileRegion(mid, { mapId: mid, x, y, width: 1, height: 1 });
        break;
      case "eyedropper":
        this.pickTileAt({ mapId: mid, layer: tileLayer, x, y });
        break;
      case "pan":
        break;
    }
  }

  pickTileAtPointer(ptr: Phaser.Input.Pointer): void {
    const mapId = this.deps.mapId();
    if (!mapId) return;
    const { x, y } = this.deps.pointerToTile(ptr);
    this.pickVisibleTileAt(mapId, x, y);
  }

  /** 좌표 기반 스포이트. 우클릭 메뉴처럼 포인터가 이미 지나간 뒤 실행되는 경로가 쓴다. */
  pickVisibleTileAt(mapId: MapId, x: number, y: number): void {
    const map = store.getCurrent().maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const pick = visibleTilePickAt(map, y * map.width + x);
    if (!pick) return;
    this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
    editorState.set({
      activePaletteStamp: null,
      selectedTile: pick.tile,
      layer: pick.layer,
      tool: "paint",
    });
    // 전문가 모드: 우클릭 스포이트 후 팔레트 타일 그림판(하위/상위 레이어 시트)로 이동
    revealPaletteTileFromMap(pick.tile);
  }

  pickTileAt(target: TilePickTarget): void {
    const map = store.getCurrent().maps[target.mapId];
    if (!map) return;
    if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) return;
    const index = target.y * map.width + target.x;
    const tile =
      target.layer === "upper"
        ? topTileInStack(map, "upper", index) ?? map.upperTiles[index]
        : topTileInStack(map, "lower", index) ?? map.lowerTiles[index];
    const fallbackTile =
      target.layer === "upper" ? topTileInStack(map, "lower", index) ?? map.lowerTiles[index] : tile;
    const selectedTile = tile >= 0 ? tile : fallbackTile;
    if (selectedTile < 0) return;
    editorState.set({
      selectedTile,
      layer: target.layer,
      tool: "paint",
    });
    revealPaletteTileFromMap(selectedTile);
  }
}

function recordTileEditSnapshot(mapId: MapId, options: { readonly includeTilesets?: boolean } = {}): void {
  recordProjectSnapshot(undefined, mapId, { kind: "map", includeTilesets: options.includeTilesets });
}

function brushStrokePoints(stroke: {
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
}): readonly { x: number; y: number }[] {
  const offset = Math.floor(stroke.size / 2);
  const points: { x: number; y: number }[] = [];
  for (let y = stroke.centerY - offset; y <= stroke.centerY + offset; y += 1) {
    for (let x = stroke.centerX - offset; x <= stroke.centerX + offset; x += 1) {
      points.push({ x, y });
    }
  }
  return points;
}

function brushStrokeCells(stroke: {
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
  readonly layer: TileLayer;
  readonly tile: number;
}): readonly TileStrokeCell[] {
  return brushStrokePoints(stroke).map((point) => ({
    layer: stroke.layer,
    x: point.x,
    y: point.y,
    tile: stroke.tile,
  }));
}

function applyPaletteStamp(input: {
  readonly autoConnect: boolean;
  readonly mapId: MapId;
  readonly stamp: PaletteStamp;
  readonly x: number;
  readonly y: number;
}): void {
  // 여러 칸 스탬프는 "고른 그대로" 찍는다 — 클러스터 동반 확장이 셀마다 발화해
  // 스탬프 밖 이웃의 상위 레이어를 덮어쓰던 문제 차단 + 의도한 배열 보존.
  // 1칸 스탬프는 지형 오토타일(흙길/모래 등)이 기대대로 성형되도록 autoConnect 를 존중한다.
  const single = input.stamp.cells.length === 1;
  paintTilesBulk(
    input.mapId,
    input.stamp.cells.map((cell) => ({
      layer: cell.layer,
      x: input.x + cell.dx,
      y: input.y + cell.dy,
      tile: cell.tile,
    })),
    {
      autoConnect: single ? input.autoConnect : false,
      clusterExpand: false,
    },
  );
}

function toolCanMutateMap(tool: string): boolean {
  return tool === "paint" || tool === "fill" || tool === "erase" || tool === "collision" || tool === "event";
}
