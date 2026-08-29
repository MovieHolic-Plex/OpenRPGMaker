import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { editorState, type PaintShape } from "@/editor/editorState";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectTileRegion } from "@/editor/mapClipboard";
import { moveEvent } from "@/editor/eventActions";
import { tileCellsForPaintShape, tileRectFromDrag, tileRectWithinBounds, type TilePoint } from "@/editor/tileShapeTools";
import { paintTilesBulk } from "@/editor/actions";
import { editorWorkingEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";
import type { TileLayer } from "./TilePaintEngine";

type DragOperation =
  | {
    readonly kind: "select";
    readonly mapId: MapId;
    readonly start: TilePoint;
  }
  | {
    readonly kind: "shape";
    readonly layer: TileLayer;
    readonly mapId: MapId;
    readonly shape: Exclude<PaintShape, "pen">;
    readonly start: TilePoint;
    readonly tile: number;
    readonly autoConnect: boolean;
  }
  | {
    readonly kind: "eventMove";
    readonly mapId: MapId;
    readonly eventId: string;
    readonly origin: TilePoint;
  };

type EventDragCandidate = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly origin: TilePoint;
};

type SceneWithObjects = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
};

export type DragOperationHandlerDeps = {
  readonly mapId: () => MapId | null;
  readonly pointerToTile: (ptr: Phaser.Input.Pointer) => TilePoint;
  readonly hoverPreviewLayer: () => Phaser.GameObjects.Container | null;
  readonly clearHoverPreview: () => void;
  readonly showEventLayerClickFeedback: (mapId: MapId, x: number, y: number) => void;
  readonly setLastPointerTile: (point: TilePoint) => void;
  readonly setPaintState: (state: { readonly isPainting?: boolean; readonly lastPaintKey?: string }) => void;
};

export class DragOperationHandler {
  private dragOperation: DragOperation | null = null;
  private eventDragCandidate: EventDragCandidate | null = null;

  constructor(
    private readonly scene: SceneWithObjects,
    private readonly deps: DragOperationHandlerDeps
  ) {}

  active(): boolean {
    return this.dragOperation !== null;
  }

  /**
   * 드래그를 하고 있거나, 이벤트를 누른 채 아직 이동으로 승격되지 않은 후보를 들고 있다.
   *
   * `active()` 와 나누는 이유: 후보 상태에서도 `tryPromoteEventDrag` 가 살아 있는 카메라로
   * 타일을 다시 구하므로, 손을 대지 않았는데 카메라가 움직이면 눌린 자리와 다른 타일이 나와
   * 유령 이벤트 이동이 시작된다. 카메라 양보 판정은 이 넓은 쪽을 봐야 한다.
   */
  busy(): boolean {
    return this.dragOperation !== null || this.eventDragCandidate !== null;
  }

  clear(): void {
    this.dragOperation = null;
    this.eventDragCandidate = null;
  }

  clearEventCandidate(): void {
    this.eventDragCandidate = null;
  }

  begin(ptr: Phaser.Input.Pointer): boolean {
    const mapId = this.deps.mapId();
    if (!mapId) return false;
    const map = store.getCurrent().maps[mapId];
    if (!map) return false;
    const point = this.deps.pointerToTile(ptr);
    if (!isInsideMapPoint(point, map)) return false;
    const state = editorState.get();
    if (state.tool === "select") {
      this.dragOperation = { kind: "select", mapId, start: point };
      selectTileRegion(mapId, { mapId, x: point.x, y: point.y, width: 1, height: 1 });
      return true;
    }
    if (state.tool === "paint" && state.paintShape !== "pen" && state.selectedTile >= 0) {
      const layer: TileLayer = state.layer === "upper" ? "upper" : "lower";
      const operation: Extract<DragOperation, { readonly kind: "shape" }> = {
        kind: "shape",
        layer,
        mapId,
        shape: state.paintShape,
        start: point,
        tile: state.selectedTile,
        autoConnect: state.autoConnectMode,
      };
      this.dragOperation = operation;
      this.renderShapeDragPreview(operation, point);
      return true;
    }
    return false;
  }

  maybeBeginEventDragCandidate(ptr: Phaser.Input.Pointer): void {
    this.eventDragCandidate = null;
    if (editorState.get().layer !== "event") return;
    const mapId = this.deps.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    const point = this.deps.pointerToTile(ptr);
    if (!isInsideMapPoint(point, map)) return;
    const existing = editorWorkingEvents(map.events).find((event) => event.x === point.x && event.y === point.y);
    if (!existing) return;
    this.eventDragCandidate = { mapId, eventId: existing.id, origin: point };
  }

  tryPromoteEventDrag(ptr: Phaser.Input.Pointer): boolean {
    const candidate = this.eventDragCandidate;
    if (!candidate) return false;
    const point = this.deps.pointerToTile(ptr);
    if (point.x === candidate.origin.x && point.y === candidate.origin.y) return false;
    this.dragOperation = {
      kind: "eventMove",
      mapId: candidate.mapId,
      eventId: candidate.eventId,
      origin: candidate.origin,
    };
    this.eventDragCandidate = null;
    this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
    this.renderEventMoveDragPreview(this.dragOperation, point);
    return true;
  }

  update(ptr: Phaser.Input.Pointer): void {
    const operation = this.dragOperation;
    if (!operation) return;
    const point = this.deps.pointerToTile(ptr);
    this.deps.setLastPointerTile(point);
    if (operation.kind === "select") {
      this.updateSelectionDrag(operation, point);
      return;
    }
    if (operation.kind === "eventMove") {
      this.renderEventMoveDragPreview(operation, point);
      return;
    }
    this.renderShapeDragPreview(operation, point);
  }

  finish(ptr: Phaser.Input.Pointer): void {
    const operation = this.dragOperation;
    if (!operation) return;
    const point = this.deps.pointerToTile(ptr);
    if (operation.kind === "select") {
      this.updateSelectionDrag(operation, point);
      requestAiSelectionContext(editorState.get().selection);
    } else if (operation.kind === "eventMove") {
      this.commitEventMoveDrag(operation, point);
    } else {
      this.commitShapeDrag(operation, point);
    }
    this.dragOperation = null;
    this.deps.clearHoverPreview();
  }

  private updateSelectionDrag(operation: Extract<DragOperation, { readonly kind: "select" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    const rect = tileRectWithinBounds(tileRectFromDrag(operation.start, point), { width: map.width, height: map.height });
    if (!rect) return;
    selectTileRegion(operation.mapId, { mapId: operation.mapId, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  private commitShapeDrag(operation: Extract<DragOperation, { readonly kind: "shape" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    const cells = tileCellsForPaintShape(operation.shape, operation.start, point, { width: map.width, height: map.height });
    if (cells.length === 0) return;
    recordProjectSnapshot(undefined, operation.mapId, { kind: "map" });
    // 도형 드래그 전 칸을 한 번의 updateMap 으로 (N번 structuredClone 금지)
    paintTilesBulk(
      operation.mapId,
      cells.map((cell) => ({
        layer: operation.layer,
        x: cell.x,
        y: cell.y,
        tile: operation.tile,
      })),
      { autoConnect: operation.autoConnect },
    );
  }

  private commitEventMoveDrag(operation: Extract<DragOperation, { readonly kind: "eventMove" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !isInsideMapPoint(point, map)) return;
    if (point.x === operation.origin.x && point.y === operation.origin.y) return;
    if (!canEditMap(operation.mapId)) {
      toast(mapEditLockNotice(operation.mapId), "error");
      return;
    }
    const occupied = editorWorkingEvents(map.events).some(
      (event) => event.id !== operation.eventId && event.x === point.x && event.y === point.y
    );
    if (occupied) {
      toast("이미 다른 이벤트가 있는 칸입니다.", "error");
      return;
    }
    recordProjectSnapshot();
    moveEvent(operation.mapId, operation.eventId, point.x, point.y);
    editorState.set({ selectedEventId: operation.eventId });
  }

  private renderShapeDragPreview(operation: Extract<DragOperation, { readonly kind: "shape" }>, point: TilePoint): void {
    const layer = this.deps.hoverPreviewLayer();
    if (!layer) return;
    layer.removeAll(true);
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return;
    const cells = tileCellsForPaintShape(operation.shape, operation.start, point, { width: map.width, height: map.height });
    for (const cell of cells) {
      const preview = createChipsetTileObject(this.scene, map, tileset, cell.x, cell.y, operation.tile);
      preview.setAlpha(0.62);
      layer.add(preview);
      const marker = this.scene.add.rectangle(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x3bc9db, 0.18);
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, 0xe7f5ff, 0.85);
      layer.add(marker);
    }
  }

  private renderEventMoveDragPreview(operation: Extract<DragOperation, { readonly kind: "eventMove" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !isInsideMapPoint(point, map)) return;
    this.deps.showEventLayerClickFeedback(operation.mapId, point.x, point.y);
  }
}

function isInsideMapPoint(point: TilePoint, map: { readonly width: number; readonly height: number }): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}
