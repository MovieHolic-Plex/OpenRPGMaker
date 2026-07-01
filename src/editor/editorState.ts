// editor/editorState.ts
// 에디터 UI 상태: 현재 편집 중인 맵, 선택 도구/레이어, 선택 이벤트.
// Project 데이터(store)와 분리된 에디터 세션 전용 UI 상태.
// 상세 설계: docs/specs/2026-06-18-rm2k3-overhaul-design.md 3.1.

import type { MapId } from "@/project/types";
import type { StructureStampId } from "@/editor/structureStampTools";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import type { TileStampId } from "@/editor/tileStampBrushes";

export type Tool = "paint" | "fill" | "collision" | "event" | "erase" | "select" | "eyedropper" | "pan";
export type PaintShape = "pen" | "rect" | "round";
export type Layer = "lower" | "upper" | "event";
export type AutoConnectMode = boolean;
export type ActiveStampId = TileStampId | null;
export type ActiveStructureStampId = StructureStampId | null;
export type ActivePaletteStamp = PaletteStamp | null;
export const EDITOR_ZOOM_LEVELS = [1, 2, 3, 4, 6, 8] as const;
export type EditorZoom = typeof EDITOR_ZOOM_LEVELS[number];
export const EDITOR_BRUSH_SIZES = [1, 2, 3, 4] as const;
export type EditorBrushSize = typeof EDITOR_BRUSH_SIZES[number];

export interface TileSelection {
  mapId: MapId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileClipboard {
  layer: "lower" | "upper";
  width: number;
  height: number;
  tiles: number[];
  stacks?: number[][];
}

export interface EditorState {
  currentMapId: MapId | null;
  tool: Tool;
  zoom: EditorZoom;
  selectedEventId: string | null;
  layer: Layer;
  paintShape: PaintShape;
  selectedTile: number;
  autoConnectMode: AutoConnectMode;
  activeStampId: ActiveStampId;
  activeStructureStampId: ActiveStructureStampId;
  activePaletteStamp: ActivePaletteStamp;
  brushSize: EditorBrushSize;
  selectedEventPageId: string | null;
  selection: TileSelection | null;
  clipboard: TileClipboard | null;
  showGrid: boolean;
  // 배틀 애니메이션 에디터 — 현재 편집 중인 애니메이션의 선택 프레임/셀 인덱스.
  selectedAnimationFrameIndex: number;
  selectedAnimationCellIndex: number;
}

type Listener = (s: EditorState) => void;

class EditorStateStore {
  private state: EditorState = {
    currentMapId: null,
    tool: "paint",
    zoom: 2,
    layer: "lower",
    paintShape: "pen",
    selectedTile: 360,
    autoConnectMode: true,
    activeStampId: null,
    activeStructureStampId: null,
    activePaletteStamp: null,
    brushSize: 1,
    selectedEventId: null,
    selectedEventPageId: null,
    selection: null,
    clipboard: null,
    showGrid: true,
    selectedAnimationFrameIndex: 0,
    selectedAnimationCellIndex: 0,
  };
  private listeners = new Set<Listener>();

  get(): EditorState {
    return this.state;
  }

  set(patch: Partial<EditorState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const editorState = new EditorStateStore();
