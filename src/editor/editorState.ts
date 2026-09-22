// editor/editorState.ts
// 에디터 UI 상태: 현재 편집 중인 맵, 선택 도구/레이어, 선택 이벤트.
// Project 데이터(store)와 분리된 에디터 세션 전용 UI 상태.
// 상세 설계: docs/specs/2026-06-18-oprn-overhaul-design.md 3.1.

import type { MapId } from "@/project/types";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import {
  DEFAULT_ASSISTANT_TEMPERATURE,
  type AssistantTemperature,
} from "@/editor/assistantTemperature";

export type { AssistantTemperature };

export type Tool = "paint" | "fill" | "collision" | "event" | "erase" | "select" | "eyedropper" | "pan";
export type PaintShape = "pen" | "rect" | "round";
export type Layer = "lower" | "upper" | "event";
export type AutoConnectMode = boolean;
/**
 * 구조 보조(hard 클러스터 동반 배치)를 켜는가. **이웃 연결과 별개다** (OPRN-OUT-017).
 *
 * 이웃 연결(autoConnectMode)은 지형 오토타일 성형을 말하고, 이것은 나무·벤치·문처럼
 * 규칙이 짝을 요구하는 구조물의 동반 칸을 자동으로 놓아 주는 것을 말한다. 예전에는
 * 「이웃 연결: 수동」 하나가 두 가지를 다 끈다고 읽혔지만 실제로는 오토타일만 껐다.
 * 기본은 켜짐(true) — 보조 배치가 안전한 기본값이라는 계약은 그대로다.
 */
export type ClusterAssistMode = boolean;
export type ActivePaletteStamp = PaletteStamp | null;
/** 맵 캔버스 배율. 0.25·0.5 는 넓은 맵을 한눈에 보는 축소이고, 상한 8 은 픽셀 편집이다. */
export const EDITOR_ZOOM_LEVELS = [0.25, 0.5, 1, 2, 3, 4, 6, 8] as const;
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
  clusterAssistMode: ClusterAssistMode;
  activePaletteStamp: ActivePaletteStamp;
  brushSize: EditorBrushSize;
  selectedEventPageId: string | null;
  selection: TileSelection | null;
  pendingEventCoordinate: PendingEventCoordinate | null;
  clipboard: TileClipboard | null;
  // 붙여넣기 미리보기 모드 — 클립보드 고스트가 커서를 추종하고 클릭으로 확정.
  pastePreview: { x: number; y: number } | null;
  showGrid: boolean;
  assistantTemperature: AssistantTemperature;
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
    // 보조 배치가 기본 — 평범한 사용자에게는 짝이 자동으로 맞는 쪽이 안전하다.
    clusterAssistMode: true,
    activePaletteStamp: null,
    brushSize: 1,
    selectedEventId: null,
    selectedEventPageId: null,
    selection: null,
    pendingEventCoordinate: null,
    clipboard: null,
    pastePreview: null,
    showGrid: true,
    assistantTemperature: DEFAULT_ASSISTANT_TEMPERATURE,
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

/**
 * 선택 사각형·붙여넣기 고스트·클립보드만 바뀐 통지인가.
 * 이 세 필드는 캔버스 오버레이가 소유하고, 좌측 독·로케이션 DOM 을 다시 지을 이유가 없다.
 * 우클릭 영역 드래그·Ctrl+V 고스트 추적은 pointermove 마다 여기만 흔든다.
 */
const CANVAS_OVERLAY_EDITOR_KEYS = new Set<keyof EditorState>([
  "selection",
  "pastePreview",
  "clipboard",
]);

export function editorStateChangedOnlyCanvasOverlay(
  previous: EditorState,
  next: EditorState,
): boolean {
  if (previous === next) return true;
  let overlayChanged = false;
  for (const key of Object.keys(next) as (keyof EditorState)[]) {
    if (previous[key] === next[key]) continue;
    if (!CANVAS_OVERLAY_EDITOR_KEYS.has(key)) return false;
    overlayChanged = true;
  }
  return overlayChanged;
}
