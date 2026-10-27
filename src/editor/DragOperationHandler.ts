import type Phaser from "phaser";
import { editorMapTileSize } from "@/editor/mapGeometry";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { prepareReliefRead } from "@/editor/reliefGroundSurface";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import { editorState, type PaintShape } from "@/editor/editorState";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { appendCellCountToLatestMapEdit, getMapEditHistoryMarker, recordMapEditIfChanged, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectTileRegion } from "@/editor/mapClipboard";
import { moveEvent } from "@/editor/eventActions";
import { tileCellsForPaintShape, tileRectFromDrag, tileRectWithinBounds, type TilePoint } from "@/editor/tileShapeTools";
import { paintTilesBulk } from "@/editor/actions";
import { worldmapAutoTile } from '@/project/worldmapAutoBrush';
import { editorWorkingEvents } from "@/project/eventDrafts";
import { eventBodyFitsMap, eventBodyRect, findEventCoveringPoint } from "@/project/eventFootprintQuery";
import { rectsOverlap } from "@/project/footprint";
import { store } from "@/project/store";
import type { GameEvent, MapId } from "@/project/types";
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
    readonly worldmapAutoBackground: boolean;
  }
  | {
    readonly kind: "eventMove";
    readonly mapId: MapId;
    readonly eventId: string;
    readonly origin: TilePoint;
    /** 드래그를 시작한 순간의 발밑 앵커. 잡은 칸과 다를 수 있다. */
    readonly anchor: TilePoint;
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
        worldmapAutoBackground: state.worldmapAutoBackground,
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
    const existing = findEventCoveringPoint(editorWorkingEvents(map.events), point.x, point.y);
    if (!existing) return;
    this.eventDragCandidate = { mapId, eventId: existing.id, origin: point };
  }

  tryPromoteEventDrag(ptr: Phaser.Input.Pointer): boolean {
    const candidate = this.eventDragCandidate;
    if (!candidate) return false;
    const point = this.deps.pointerToTile(ptr);
    if (point.x === candidate.origin.x && point.y === candidate.origin.y) return false;
    const map = store.getCurrent().maps[candidate.mapId];
    const moving = map
      ? editorWorkingEvents(map.events).find((event) => event.id === candidate.eventId)
      : undefined;
    if (!moving) {
      this.eventDragCandidate = null;
      return false;
    }
    this.dragOperation = {
      kind: "eventMove",
      mapId: candidate.mapId,
      eventId: candidate.eventId,
      origin: candidate.origin,
      anchor: { x: moving.x, y: moving.y },
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
    // 도형 드래그 전 칸을 한 번의 updateMap 으로 (N번 structuredClone 금지)
    const marker = getMapEditHistoryMarker();
    const recorded = recordMapEditIfChanged(operation.mapId, () => {
      paintTilesBulk(
        operation.mapId,
        cells.map((cell) => ({
          layer: operation.layer,
          x: cell.x,
          y: cell.y,
          tile: operation.tile,
        })),
        { autoConnect: operation.autoConnect, worldmapAutoBackground: operation.worldmapAutoBackground },
      );
    }, { label: operation.shape === "rect" ? "사각형 칠하기" : "타원 칠하기" });
    if (recorded) appendCellCountToLatestMapEdit(operation.mapId, marker);
  }

  private commitEventMoveDrag(operation: Extract<DragOperation, { readonly kind: "eventMove" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !isInsideMapPoint(point, map)) return;
    const events = editorWorkingEvents(map.events);
    const moving = events.find((event) => event.id === operation.eventId);
    if (!moving) return;
    const plan = planEventDragMove({
      mapWidth: map.width,
      mapHeight: map.height,
      moving: { ...moving, x: operation.anchor.x, y: operation.anchor.y },
      others: events,
      anchor: operation.anchor,
      origin: operation.origin,
      drop: point,
    });
    if (!plan.ok && plan.reason === "same") return;
    if (!canEditMap(operation.mapId)) {
      toast(mapEditLockNotice(operation.mapId), "error");
      return;
    }
    if (!plan.ok) {
      toast(
        plan.reason === "occupied"
          ? "이미 다른 이벤트가 있는 칸입니다."
          : "이벤트 몸이 맵 밖으로 나갑니다.",
        "error",
      );
      return;
    }
    recordProjectSnapshot();
    moveEvent(operation.mapId, operation.eventId, plan.x, plan.y);
    editorState.set({ selectedEventId: operation.eventId });
  }

  private renderShapeDragPreview(operation: Extract<DragOperation, { readonly kind: "shape" }>, point: TilePoint): void {
    const layer = this.deps.hoverPreviewLayer();
    if (!layer) return;
    layer.removeAll(true);
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    prepareReliefRead(map);
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return;
    const tileSize = editorMapTileSize(operation.mapId);
    const lift = map.relief ? reliefLiftField(map.relief) : null;
    const cells = tileCellsForPaintShape(operation.shape, operation.start, point, { width: map.width, height: map.height });
    for (const cell of cells) {
      const liftPx = (lift ? cellLift(lift, cell.x, cell.y) : 0) * tileSize;
      const tile = operation.worldmapAutoBackground ? worldmapAutoTile(map, tileset, operation.tile, cell.x, cell.y, cells) : operation.tile;
      const preview = createChipsetTileObject(this.scene, map, tileset, cell.x, cell.y, tile);
      preview.y -= liftPx;
      preview.setAlpha(0.62);
      layer.add(preview);
      const marker = this.scene.add.rectangle(cell.x * tileSize, cell.y * tileSize - liftPx, tileSize, tileSize, 0x3bc9db, 0.18);
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

type EventDragMovePlan =
  | { readonly ok: true; readonly x: number; readonly y: number }
  | { readonly ok: false; readonly reason: "same" | "outside" | "occupied" };

/**
 * 이벤트 드래그의 도착 앵커.
 *
 * 잡은 칸이 커서 아래에 남는다. 1칸이면 잡은 칸이 곧 앵커라 도착점은 드롭 칸이다.
 * 2칸 이상에서 머리·옆 칸을 잡으면 앵커는 포인터가 움직인 칸 수만큼만 이동한다.
 * 도착한 몸 사각이 맵 밖이거나 다른 이벤트 몸과 겹치면 옮기지 않는다.
 */
export function planEventDragMove(input: {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly moving: GameEvent;
  readonly others: readonly GameEvent[];
  readonly anchor: TilePoint;
  readonly origin: TilePoint;
  readonly drop: TilePoint;
}): EventDragMovePlan {
  const x = input.anchor.x + (input.drop.x - input.origin.x);
  const y = input.anchor.y + (input.drop.y - input.origin.y);
  if (x === input.anchor.x && y === input.anchor.y) return { ok: false, reason: "same" };
  const moved = { ...input.moving, x, y };
  const body = eventBodyRect(moved);
  if (!eventBodyFitsMap(moved, input.mapWidth, input.mapHeight)) {
    return { ok: false, reason: "outside" };
  }
  const occupied = input.others.some((event) =>
    event.id !== input.moving.id && rectsOverlap(eventBodyRect(event), body));
  if (occupied) return { ok: false, reason: "occupied" };
  return { ok: true, x, y };
}
