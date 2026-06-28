// editor/editorState.ts
// 에디터 UI 상태: 현재 편집 중인 맵, 선택 도구/레이어, 선택 이벤트.
// Project 데이터(store)와 분리된 에디터 세션 전용 UI 상태.
// 상세 설계: docs/specs/2026-06-18-rm2k3-overhaul-design.md 3.1.

import type { MapId } from "@/project/types";

export type Tool = "paint" | "fill" | "collision" | "event" | "erase" | "select" | "eyedropper" | "pan";
export type PaintShape = "pen" | "rect" | "round";
export type Layer = "lower" | "upper" | "event";
export const EDITOR_ZOOM_LEVELS = [1, 2, 3, 4, 6, 8] as const;
export type EditorZoom = typeof EDITOR_ZOOM_LEVELS[number];
export const EDITOR_BRUSH_SIZES = [1, 3, 5] as const;
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
  brushSize: EditorBrushSize;
  selectedEventPageId: string | null;
  selection: TileSelection | null;
  clipboard: TileClipboard | null;
}

type Listener = (s: EditorState) => void;

class EditorStateStore {
  private state: EditorState = {
    currentMapId: null,
    tool: "paint",
    zoom: 2,
    layer: "lower",
    paintShape: "pen",
    selectedTile: 0,
    brushSize: 1,
    selectedEventId: null,
    selectedEventPageId: null,
    selection: null,
    clipboard: null,
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
