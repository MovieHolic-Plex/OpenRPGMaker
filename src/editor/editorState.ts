// editor/editorState.ts
// 에디터 UI 상태: 현재 편집 중인 맵, 선택 도구/레이어, 선택 이벤트.
// Project 데이터(store)와 분리된 에디터 세션 전용 UI 상태.
// 상세 설계: docs/specs/2026-06-18-oprn-overhaul-design.md 3.1.

import type { ReliefBrushMode } from "@/project/relief/edit";
import type { MapId } from "@/project/types";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";

export type Tool = "paint" | "fill" | "collision" | "event" | "erase" | "select" | "eyedropper" | "pan" | "relief";
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
  /** 2층(lower 묶음) 또는 4층(upper 묶음). 없으면 빈칸. */
  overlay?: number[];
}

// 복사는 항상 하위+상위 레이어를 통째로 담는다(RM2K3 영역 복사 관례).
export interface TileClipboard {
  width: number;
  height: number;
  lower: TileClipboardLayer;
  upper: TileClipboardLayer;
  /** 그림자 비트. 없으면 0. */
  shadow?: number[];
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
  /** 「높이」 붓 방식 — 올리기/내리기/단 지정/평탄. map.relief 를 고친다. */
  reliefMode: ReliefBrushMode;
  /** 「단 지정」 붓이 맞출 단(0~14). */
  reliefLevel: number;
  selectedEventPageId: string | null;
  selection: TileSelection | null;
  pendingEventCoordinate: PendingEventCoordinate | null;
  clipboard: TileClipboard | null;
  // 붙여넣기 미리보기 모드 — 클립보드 고스트가 커서를 추종하고 클릭으로 확정.
  pastePreview: { x: number; y: number } | null;
  showGrid: boolean;
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
    reliefMode: "raise",
    reliefLevel: 2,
    selectedEventId: null,
    selectedEventPageId: null,
    selection: null,
    pendingEventCoordinate: null,
    clipboard: null,
    pastePreview: null,
    showGrid: true,
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

/**
 * 맵 트리가 읽는 에디터 필드는 현재 맵뿐이다.
 * 타일·도구·레이어 선택은 팔레트 일이라, 그때 맵 목록을 다시 만들면 마을마다 썸네일을 다시 그린다.
 */
export function editorStateNeedsMapTreeRefresh(previous: EditorState, next: EditorState): boolean {
  return previous.currentMapId !== next.currentMapId;
}

const PALETTE_REFRESH_KEYS = [
  "currentMapId",
  "tool",
  "layer",
  "paintShape",
  "selectedTile",
  "autoConnectMode",
  "clusterAssistMode",
  "activePaletteStamp",
  "brushSize",
  "reliefMode",
  "reliefLevel",
  "selectedEventId",
  "selectedEventPageId",
  "pendingEventCoordinate",
] as const satisfies readonly (keyof EditorState)[];

/** 좌측 타일 팔레트(이벤트 레이어일 때는 이벤트 목록)가 다시 그려져야 하는 통지인가. */
export function editorStateNeedsPaletteRefresh(previous: EditorState, next: EditorState): boolean {
  if (previous === next) return false;
  return PALETTE_REFRESH_KEYS.some((key) => previous[key] !== next[key]);
}

/**
 * 고른 타일과 타일 레이어(바닥↔상위)만 바뀌었는가 — 상위 전용 타일을 고르면 레이어가 따라온다.
 * 이벤트 레이어로 들어가거나 나오는 전환은 보이는 패널 자체가 바뀌므로 제외한다.
 */
export function editorStateChangedOnlySelectedTileAndLayer(previous: EditorState, next: EditorState): boolean {
  if (previous === next || previous.layer === "event" || next.layer === "event") return false;
  let changed = false;
  for (const key of Object.keys(next) as (keyof EditorState)[]) {
    if (previous[key] === next[key]) continue;
    if (key !== "selectedTile" && key !== "layer") return false;
    changed = true;
  }
  return changed;
}

/**
 * 붓 고르기(타일·스탬프·붓 모양·크기·도구·레이어)만 바뀌었는가.
 * 조수 패널은 이 필드를 입력창 안내문으로만 읽는다. 팔레트 클릭마다 칩·레일·크기 측정을
 * 다시 돌리면 본문 `:has()` 무효화로 문서 전체 스타일을 여러 번 다시 계산한다(2026-09-25 실측).
 */
const PAINT_PICK_KEYS: ReadonlySet<keyof EditorState> = new Set<keyof EditorState>([
  "selectedTile",
  "activePaletteStamp",
  "paintShape",
  "brushSize",
  "tool",
  "layer",
]);

/**
 * 이벤트 편집기 본문이 읽지 않는 필드들 — 줌·격자·선택 사각형·붓 고르기·애니메이션 프레임.
 * 본문은 명령 목록 전체를 다시 짓는다. 편집기를 열어 둔 채 맵을 확대하거나 팔레트를 누를
 * 때마다 수백 행을 다시 그릴 이유가 없다. 도구·레이어·좌표 지정 대기는 여기 넣지 않는다.
 */
const EVENT_EDITOR_IGNORED_KEYS: ReadonlySet<keyof EditorState> = new Set<keyof EditorState>([
  ...CANVAS_OVERLAY_EDITOR_KEYS,
  "zoom",
  "showGrid",
  "showLayoutBboxes",
  "selectedTile",
  "activePaletteStamp",
  "paintShape",
  "brushSize",
  "autoConnectMode",
  "clusterAssistMode",
  "selectedAnimationFrameIndex",
  "selectedAnimationCellIndex",
]);

export function editorStateNeedsEventEditorRefresh(previous: EditorState, next: EditorState): boolean {
  if (previous === next) return false;
  for (const key of Object.keys(next) as (keyof EditorState)[]) {
    if (previous[key] !== next[key] && !EVENT_EDITOR_IGNORED_KEYS.has(key)) return true;
  }
  return false;
}

/**
 * 도구·붓 모양·붓 크기만 바뀐 통지인가(선택 사각형·고스트는 함께 지워질 수 있다).
 * 팔레트 칸은 이 셋을 읽지 않는다 — 도구줄 눌림 상태와 붓 옵션 줄만 바꾸면 된다.
 * 레이어·도장이 같이 바뀌면 보이는 칸·선반이 달라지므로 전체 갱신이다.
 */
const TOOL_PICK_KEYS: ReadonlySet<keyof EditorState> = new Set<keyof EditorState>([
  ...CANVAS_OVERLAY_EDITOR_KEYS,
  "tool",
  "paintShape",
  "brushSize",
]);

export function editorStateChangedOnlyToolPick(previous: EditorState, next: EditorState): boolean {
  if (previous === next || previous.layer === "event" || next.layer === "event") return false;
  let toolChanged = false;
  for (const key of Object.keys(next) as (keyof EditorState)[]) {
    if (previous[key] === next[key]) continue;
    if (!TOOL_PICK_KEYS.has(key)) return false;
    if (!CANVAS_OVERLAY_EDITOR_KEYS.has(key)) toolChanged = true;
  }
  return toolChanged;
}

export function editorStateChangedOnlyPaintPick(previous: EditorState, next: EditorState): boolean {
  if (previous === next) return false;
  for (const key of Object.keys(next) as (keyof EditorState)[]) {
    if (previous[key] !== next[key] && !PAINT_PICK_KEYS.has(key)) return false;
  }
  return true;
}

/**
 * 고른 타일 번호만 바뀌었는가.
 * 그 경우는 팔레트 칸을 다시 만들 이유가 없다 — 활성 칸과 선택 칩만 바꾸면 된다.
 * 레이어·도구·스탬프가 같이 바뀌면 보이는 칸 자체가 달라지므로 전체 갱신이다.
 */
export function editorStateChangedOnlySelectedTile(previous: EditorState, next: EditorState): boolean {
  if (previous === next) return false;
  let selectionChanged = false;
  for (const key of Object.keys(next) as (keyof EditorState)[]) {
    if (previous[key] === next[key]) continue;
    if (key !== "selectedTile") return false;
    selectionChanged = true;
  }
  return selectionChanged;
}
