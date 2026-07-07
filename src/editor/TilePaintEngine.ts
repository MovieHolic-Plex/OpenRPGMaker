import type Phaser from "phaser";
import {
  paintTile,
  eraseTile,
  toggleCollision,
  fillTile,
} from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { selectTileRegion } from "@/editor/mapClipboard";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { compatibleStampIdForTile, tileStampById, tileStampsForTile, type TileStamp } from "@/editor/tileStampBrushes";
import { visibleTilePickAt } from "@/editor/tilePicking";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { MapId, TilesetDef } from "@/project/types";
import { toast } from "@/util/toast";
import { placeStructureStamp } from "./structureStampTools";

type BrushStroke = {
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
  readonly applyCell: (x: number, y: number) => void;
};

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
    const { activePaletteStamp, activeStampId, activeStructureStampId, autoConnectMode, brushSize, selectedTile } = editorState.get();
    const tileset = this.deps.tilesetForMap(mid);
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
        recordTileEditSnapshot(mid);
        {
          if (activePaletteStamp) {
            applyPaletteStamp({ mapId: mid, stamp: activePaletteStamp, x, y });
            break;
          }
          if (activeStructureStampId) {
            placeStructureStamp(mid, { id: activeStructureStampId, origin: { x, y } });
            break;
          }
          const stamp = tileset
            ? tileStampsForTile(selectedTile, tileset).find((candidate) => candidate.id === activeStampId) ?? null
            : tileStampById(activeStampId);
          if (stamp) {
            applyStamp({ mapId: mid, layer: tileLayer, x, y, stamp, autoConnect: autoConnectMode });
          } else {
            applyBrush({
              centerX: x,
              centerY: y,
              size: brushSize,
              applyCell: (brushX, brushY) => paintTile(mid, tileLayer, brushX, brushY, selectedTile, { autoConnect: autoConnectMode }),
            });
          }
        }
        break;
      case "fill":
        if (firstStrokeTile) {
          recordTileEditSnapshot(mid);
          fillTile(mid, tileLayer, x, y, selectedTile, { autoConnect: autoConnectMode });
        }
        break;
      case "erase":
        recordTileEditSnapshot(mid);
        applyBrush({
          centerX: x,
          centerY: y,
          size: brushSize,
          applyCell: (brushX, brushY) => eraseTile(mid, tileLayer, brushX, brushY, { autoConnect: autoConnectMode }),
        });
        break;
      case "collision":
        recordTileEditSnapshot(mid, { includeTilesets: true });
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
    const map = store.getCurrent().maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const pick = visibleTilePickAt(map, y * map.width + x);
    if (!pick) return;
    this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
    const tileset = this.deps.tilesetForMap(mapId);
    editorState.set({
      activePaletteStamp: null,
      activeStampId: compatibleStampIdForTile(editorState.get().activeStampId, pick.tile, tileset),
      activeStructureStampId: null,
      selectedTile: pick.tile,
      layer: pick.layer,
      tool: "paint",
    });
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
    const tileset = this.deps.tilesetForMap(target.mapId);
    editorState.set({
      activeStampId: compatibleStampIdForTile(editorState.get().activeStampId, selectedTile, tileset),
      selectedTile,
      layer: target.layer,
      tool: "paint",
    });
  }
}

function recordTileEditSnapshot(mapId: MapId, options: { readonly includeTilesets?: boolean } = {}): void {
  recordProjectSnapshot(undefined, mapId, { kind: "map", includeTilesets: options.includeTilesets });
}

function applyBrush(stroke: BrushStroke): void {
  const offset = Math.floor(stroke.size / 2);
  for (let y = stroke.centerY - offset; y <= stroke.centerY + offset; y++) {
    for (let x = stroke.centerX - offset; x <= stroke.centerX + offset; x++) {
      stroke.applyCell(x, y);
    }
  }
}

function applyStamp(input: {
  readonly autoConnect: boolean;
  readonly layer: TileLayer;
  readonly mapId: MapId;
  readonly stamp: TileStamp;
  readonly x: number;
  readonly y: number;
}): void {
  for (const cell of input.stamp.cells) {
    paintTile(input.mapId, input.layer, input.x + cell.dx, input.y + cell.dy, cell.tile, { autoConnect: input.autoConnect });
  }
}

function applyPaletteStamp(input: {
  readonly mapId: MapId;
  readonly stamp: PaletteStamp;
  readonly x: number;
  readonly y: number;
}): void {
  for (const cell of input.stamp.cells) {
    paintTile(input.mapId, cell.layer, input.x + cell.dx, input.y + cell.dy, cell.tile, { autoConnect: false });
  }
}

function toolCanMutateMap(tool: string): boolean {
  return tool === "paint" || tool === "fill" || tool === "erase" || tool === "collision" || tool === "event";
}
