// editor/editorState.ts
// 에디터 UI 상태: 현재 편집 중인 맵, 선택 도구/레이어, 선택 이벤트.
// Project 데이터(store)와 분리된 에디터 세션 전용 UI 상태.
// 상세 설계: docs/specs/2026-06-18-rm2k3-overhaul-design.md 3.1.

import type { MapId } from "@/project/types";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";

export type Tool = "paint" | "fill" | "collision" | "event" | "erase" | "select" | "eyedropper" | "pan";
export type PaintShape = "pen" | "rect" | "round";
export type Layer = "lower" | "upper" | "event";
export type AutoConnectMode = boolean;
export type ActivePaletteStamp = PaletteStamp | null;
export type ChatDock = "float" | "side";
export const EDITOR_ZOOM_LEVELS = [1, 2, 3, 4, 6, 8] as const;
export type EditorZoom = typeof EDITOR_ZOOM_LEVELS[number];
export const EDITOR_BRUSH_SIZES = [1, 2, 3, 4] as const;
export type EditorBrushSize = typeof EDITOR_BRUSH_SIZES[number];

export interface PendingEventCoordinate {
  mapId: MapId;
  x: number;
  y: number;
}

export interface TileSelection {
  mapId: MapId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileClipboardLayer {
  tiles: number[];
  stacks: number[][];
}

// 복사는 항상 하위+상위 레이어를 통째로 담는다(RM2K3 영역 복사 관례).
export interface TileClipboard {
  width: number;
  height: number;
  lower: TileClipboardLayer;
  upper: TileClipboardLayer;
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
  activePaletteStamp: ActivePaletteStamp;
  brushSize: EditorBrushSize;
  selectedEventPageId: string | null;
  selection: TileSelection | null;
  pendingEventCoordinate: PendingEventCoordinate | null;
  clipboard: TileClipboard | null;
  // 붙여넣기 미리보기 모드 — 클립보드 고스트가 커서를 추종하고 클릭으로 확정.
  pastePreview: { x: number; y: number } | null;
  showGrid: boolean;
  chatDock: ChatDock;
  showLayoutBboxes: boolean;
  // 배틀 애니메이션 에디터 — 현재 편집 중인 애니메이션의 선택 프레임/셀 인덱스.
  selectedAnimationFrameIndex: number;
  selectedAnimationCellIndex: number;
}

type Listener = (s: EditorState) => void;

class EditorStateStore {
  private state: EditorState = {
    currentMapId: null,
    // 부팅 기본은 브러시+바닥 — 초보자의 첫 행동(타일 칠하기)이 바로 되게 한다.
    // (이벤트 기본값은 "타일 칠하려면 전환" 땜빵 힌트가 필요했다 — 2026-08-18 UX 리뷰 P2-7.)
    tool: "paint",
    zoom: 2,
    layer: "lower",
    paintShape: "pen",
    selectedTile: 360,
    // Manual by default: free tile placement must not reshape neighbors unless Auto is chosen.
    autoConnectMode: false,
    activePaletteStamp: null,
    brushSize: 1,
    selectedEventId: null,
    selectedEventPageId: null,
    selection: null,
    pendingEventCoordinate: null,
    clipboard: null,
    pastePreview: null,
    showGrid: true,
    chatDock: "float",
    showLayoutBboxes: false,
    selectedAnimationFrameIndex: 0,
    selectedAnimationCellIndex: 0,
  };
  private listeners = new Set<Listener>();

  get(): EditorState {
    return this.state;
  }

  set(patch: Partial<EditorState>): void {
    // 무변경 set은 통지하지 않는다 — 통지마다 팔레트/맵트리가 전체 재구축되므로,
    // pointerdown~pointerup 사이에 노드가 교체되면 사용자의 클릭이 증발한다(클릭 불가 보고 원인 중 하나).
    let changed = false;
    for (const key of Object.keys(patch) as (keyof EditorState)[]) {
      if (this.state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const editorState = new EditorStateStore();
