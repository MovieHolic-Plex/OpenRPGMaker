// panels/structureKitEditorDialog.ts
// 구조물 편집기 — DB 모달 위에 뜨는 전용 다이얼로그.
//
// 왜 인스펙터가 아니라 다이얼로그인가:
//   인스펙터 열은 harness-suggestion.css:297 에서 width:352px 고정이고, 패딩을 빼면 324px 다.
//   내장 집 9×8 을 scale 3 으로 그리면 432px 라 들어가지 않는다. 타일 팔레트를 둘 자리는 더 없다.
//
// 저장 버튼이 없는 이유:
//   모든 편집은 store.update() 로 즉시 반영되고, DB 모달을 취소하면
//   createDatabaseModalDirtySession 이 세션 전체를 롤백한다. 이 모달의 기존 규약이다.
//   (같은 이유로 아무것도 저장하지 않던 인스펙터의 [지금 저장] 버튼을 없앴다.)
//
// 타일 팔레트로 renderTilePalette() 를 쓰지 않는 이유:
//   그 함수는 editorState 의 전역 브러시를 바꾼다 — 구조물 편집 중 타일을 고르면
//   맵 붓까지 같이 바뀐다. 순수 헬퍼 tilesetTileBackgroundStyle 로 격자를 직접 그린다.
//
//   (2026-08-30 정정) 그 경고는 renderTilePalette 에만 해당한다. 한 단계 아래
//   makeGridPalette/makeCustomPalette(panels/tilePaletteGrid.ts)는 순수 인자만 받고
//   전역을 건드리지 않으므로 원래 쓸 수 있었다. 그래도 계속 자체 격자를 쓰는 이유는 둘이다:
//     ① 그 팔레트의 칸 크기가 컨테이너 쿼리(--chipset-cell: 100cqi)에 묶여 있어
//        좌패널 밖에서는 컨테이너를 새로 세워 줘야 한다.
//     ② makeGridPalette 는 오토타일을 대표 1칸으로 접고 레이어로 걸러서 480칸 중
//        일부가 사라진다 — 구조물은 지붕 변형 같은 세부 타일이 필요하다.
//   대신 검색·분류 계산은 맵 팔레트와 같은 출처(panels/tilePaletteFilter.ts)를 쓴다.

import { chatCompletion, loadAiConfig } from "@/ai/llmClient";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";
import { TILE_SIZE } from "@/assets/bundled";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { structureKitLayerHome } from "@/editor/harnessSuggestion/structureKitModel";
import {
  createBlankStructureKit,
  createStructureKitFromHouse,
  replaceStructureKit,
} from "@/editor/harnessSuggestion/structureKitActions";
import {
  addPart,
  cellAtPoint,
  cellHintAt,
  normalizeDragRect,
  paintCell,
  removeCellHint,
  removePart,
  resizeKit,
  setCellHint,
  tileAt,
  updatePart,
  type KitLayer,
} from "@/editor/harnessSuggestion/structureKitRasterModel";
import { HOUSE_KITS } from "@/editor/houseKit";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { openMapContextMenu } from "@/editor/panels/mapContextMenu";
import {
  TILE_CATEGORIES,
  filterTileIndexes,
  type TileCategoryId,
} from "@/editor/panels/tilePaletteFilter";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { tileCellsForPaintShape } from "@/editor/tileShapeTools";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { PUBLIC_HOUSE_KIT_IDS } from "@/editor/tools/houseKitDomain";
import { unregisterModal } from "@/editor/ui/modalStack";
import { describeChipsetTile, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import {
  asPlacementFacing,
  asPlacementZone,
  describePlacementSurface,
  facingLabel,
  PLACEMENT_FACINGS,
  PLACEMENT_ZONES,
  placementZoneLabel,
} from "@/project/placementSurface";
import { store } from "@/project/store";
import type {
  PlacementSurfaceCondition,
  SectionStructureKitDef,
  StructureGrowthAxis,
  StructureKitAiMeta,
  StructureKitCellHint,
  StructureKitPart,
  StructureKitPartKind,
  TileGroupRole,
  TilesetDef,
  TilesetId,
} from "@/project/types";
import { el } from "@/util/dom";
import { randomUuid } from "@/util/id";
import { toast } from "@/util/toast";

/**
 * 캔버스 영역이 감당하는 크기(px) — 다이얼로그가 아직 레이아웃되지 않은 첫 렌더와
 * getBoundingClientRect 가 0 을 주는 환경(유닛 테스트의 FakeDom)용 대체값이다.
 * 실제로는 매 렌더에서 캔버스 칸의 실측 크기를 쓴다.
 */
const CANVAS_FALLBACK_W = 1040;
const CANVAS_FALLBACK_H = 620;

/** 확대 단계 — 맵 편집기의 줌 스테퍼와 같은 눈금. */
const ZOOM_STEPS: readonly number[] = [1, 2, 3, 4, 6, 8];

/** 편집기 다이얼로그의 testid — openDialog 가 이 값을 오버레이 dataset 에 그대로 박는다. */
const EDITOR_DIALOG_TESTID = "structure-kit-editor";

/**
 * 도구. 예전에는 paint·erase·part 셋뿐이라 한 칸씩 클릭해야 했고 사각형·채우기·스포이트가
 * 없었다. 도형 계산은 맵 편집기와 같은 순수 함수(tileShapeTools)를 쓴다.
 */
type EditorTool = "paint" | "erase" | "part" | "hint" | "rect" | "ellipse" | "fill" | "pick";

/** 드래그로 영역을 정하는 도구인가 — 이 도구들은 뗄 때 한 번에 커밋한다. */
function isDragShapeTool(tool: EditorTool): boolean {
  return tool === "rect" || tool === "ellipse";
}

interface EditorSession {
  tilesetId: TilesetId;
  kitId: string;
  tool: EditorTool;
  layer: KitLayer;
  tile: number;
  tab: "shape" | "ai";
  /** null = 창에 맞춤(자동). 숫자면 사람이 고른 배율. */
  zoom: number | null;
  showGrid: boolean;
  /** 팔레트 검색어·분류 — 맵 팔레트의 모듈 전역과 **분리된** 이 편집기만의 상태다. */
  search: string;
  category: TileCategoryId;
  recent: number[];
  /** 켜면 이 구조물이 아직 쓰지 않은 타일만 팔레트에 남긴다. */
  unusedOnly: boolean;
  /** AI 메타 폼의 미저장 편집 상태. [초안 수락] 전까지 store 에는 닿지 않는다. */
  draft: StructureKitAiMeta | null;
  /**
   * 지금 편집 중인 킷. 사라졌으면 알리고 편집기를 닫은 뒤 undefined 를 준다.
   * 모든 편집 경로(칠하기·부위·크기·AI)는 findKit 을 직접 부르지 않고 이걸 쓴다 —
   * 조용히 return 하면 그 뒤의 모든 편집이 store 에 닿지 못한 채 무음으로 사라진다.
   */
  readonly requireKit: () => SectionStructureKitDef | undefined;
}

/**
 * 구조물 편집기가 지금 떠 있는가.
 * DB 모달의 문서 레벨 Ctrl+Z 가드가 이걸 본다 — undo 는 store 를 통째로 갈아치우므로
 * 편집기가 보던 킷이 사라지고, 그 뒤 편집이 전부 헛일이 된다.
 * 상태 플래그가 아니라 DOM 부착 여부로 판정한다 — 백드롭 클릭·Escape 처럼
 * 우리 콜백을 거치지 않는 닫기 경로가 있어 플래그는 새기 쉽다.
 */
export function isStructureKitEditorOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(`[data-testid="${EDITOR_DIALOG_TESTID}"]`) !== null;
}

export function openStructureKitEditor(tilesetId: TilesetId, kitId: string, onClosed: () => void): void {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const kit = findKit(tilesetId, kitId);
  if (!tileset || !kit) return;

  let overlay: Element | null = null;
  let closed = false;

  // DB 모달을 취소로 닫거나 Ctrl+Z 로 store 가 교체되면 이 킷이 사라진다.
  // 예전에는 조용히 return 해서, 사용자는 계속 칠하는데 아무것도 저장되지 않았다.
  const closeBecauseKitVanished = (): void => {
    if (closed) return;
    closed = true;
    toast("이 구조물이 사라졌습니다 (되돌리기 때문일 수 있어요)", "error");
    if (overlay) {
      unregisterModal(overlay);
      overlay.remove();
    }
    onClosed();
  };

  const session: EditorSession = {
    tilesetId,
    kitId,
    tool: "paint",
    layer: "lower",
    tile: TILE.GRASS,
    tab: "shape",
    zoom: null,
    showGrid: true,
    search: "",
    category: "all",
    recent: [],
    unusedOnly: false,
    draft: null,
    requireKit: () => {
      const current = findKit(tilesetId, kitId);
      if (!current) closeBecauseKitVanished();
      return current;
    },
  };

  /**
   * 킷 로컬 되돌리기 스택. mapEditHistory 의 recordProjectSnapshot 을 쓰지 않는 이유는 둘이다:
   *   ① 스트로크마다 프로젝트 전체를 structuredClone 한다.
   *   ② DB 모달을 취소하면 truncateMapEditHistoryFromMarker 가 세션 중 스냅샷을 전부
   *      폐기해서, 편집기 안에서 쌓은 되돌리기 이력도 함께 사라진다.
   * 킷 하나만 들고 있으면 둘 다 해당하지 않는다.
   */
  const past: SectionStructureKitDef[] = [];
  const future: SectionStructureKitDef[] = [];
  const HISTORY_LIMIT = 80;

  const pushHistory = (before: SectionStructureKitDef): void => {
    past.push(before);
    if (past.length > HISTORY_LIMIT) past.shift();
    future.length = 0;
  };

  /** 한 덩어리 편집 — 되돌리기 한 번에 되돌아간다. */
  const commitKit = (before: SectionStructureKitDef, next: SectionStructureKitDef): void => {
    if (next === before) return;
    pushHistory(before);
    replaceStructureKit(session.tilesetId, next);
  };

  const canvasWrap = el("div", { class: "structure-kit-editor-canvas-wrap" });
  // 캔버스와 정확히 같은 크기의 위치 기준 상자. 격자선·도형 미리보기가 여기에 겹친다.
  // 좌표 계산도 이 상자를 본다 — canvasWrap 은 스크롤 컨테이너라 캔버스보다 크고
  // 내용을 가운데 정렬하므로, wrap 기준으로 재면 그 여백만큼 클릭이 밀린다.
  //
  // **testid 와 포인터 리스너가 같은 요소여야 한다.** 예전에는 testid 가 wrap 에 붙어
  // 있었는데 이름이 `...-canvas` 인 요소의 boundingBox 가 캔버스가 아니라 1084x721 스크롤
  // 칸이었다. 그래서 e2e 가 "캔버스 모서리"라고 믿고 끈 좌표가 실제로는 캔버스 밖 여백이었고,
  // cellFromEvent 가 null 을 돌려 부위 드래그가 조용히 아무것도 안 했다. 스테이지는
  // 캔버스와 픽셀 단위로 같은 상자이므로 둘을 여기로 모은다.
  const canvasStage = el("div", {
    class: "structure-kit-editor-canvas-stage",
    dataset: { testid: "structure-kit-editor-canvas" },
  });
  const gridOverlay = el("div", { class: "structure-kit-editor-grid-lines" });
  const previewOverlay = el("div", { class: "structure-kit-editor-preview" });
  canvasWrap.replaceChildren(canvasStage);

  const tabsWrap = el("div", { class: "structure-kit-editor-tools" });
  const rightWrap = el("div", { class: "structure-kit-editor-right" });
  const toolsWrap = el("div", { class: "structure-kit-editor-tools" });
  const filterWrap = el("div", { class: "structure-kit-editor-filter" });
  const paletteWrap = el("div", {
    class: "structure-kit-editor-palette",
    dataset: { testid: "structure-kit-editor-palette" },
  });
  const viewWrap = el("div", { class: "structure-kit-editor-viewbar" });
  const sizeWrap = el("div", { class: "structure-kit-editor-size" });
  const partsWrap = el("div", {
    class: "structure-kit-editor-parts",
    dataset: { testid: "structure-kit-editor-parts" },
  });
  // 칸 힌트 목록은 부위 목록과 같은 자리·같은 규약(폭 전체, 칩처럼 가로 흐름)을 쓴다.
  // 별도 목록으로 둔 이유는 소비자가 다르기 때문이다: 부위는 워프·간판 좌표를 만들고,
  // 칸 힌트는 시공 반복 축과 AI 설명으로 간다.
  const hintsWrap = el("div", {
    // 부위 목록의 흐름 규약(폭 전체·칩처럼 가로 흐름·넘치면 스크롤)을 그대로 쓰고
    // 높이만 낮춘다 — 같은 클래스만 쓰면 두 목록이 128px 씩 캔버스 높이를 먹는다.
    class: "structure-kit-editor-parts structure-kit-editor-hints",
    dataset: { testid: "structure-kit-editor-cell-hints" },
  });
  const aiWrap = el("div", { class: "structure-kit-editor-ai" });

  /** 지금 캔버스에 쓰인 배율. 좌표 환산이 렌더와 같은 값을 봐야 한다. */
  let activeScale = 3;

  /**
   * 캔버스만 다시 그린다. 칠하기 경로는 이것만 부른다 —
   * 예전에는 한 칸 칠할 때마다 480개 팔레트 버튼을 재생성하고 팔레트 노드를 재부모해서
   * 스크롤이 맨 위로 튀었다(맵 팔레트가 preservePaletteViewport 로 3중 복원까지 하는 그 병).
   */
  const redrawCanvasOnly = (): void => {
    const current = session.requireKit();
    if (!current) return;
    activeScale = resolveScale(current, session, canvasWrap);
    drawCanvasStage(canvasStage, gridOverlay, previewOverlay, tileset, current, session, activeScale);
    // 칠하는 도중에도 "사용 중" 표식과 개수가 따라온다. refresh 는 자기 입력이 그대로면 즉시
    // 빠지므로 드래그 한 칸마다 부려도 실제 DOM 쓰기는 바뀐 프레임에만 일어난다.
    syncPalette();
  };

  const refreshViewBar = (): void => {
    drawViewBar(viewWrap, session, redraw, {
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      undo,
      redo,
      currentScale: activeScale,
    });
  };

  /**
   * 오른쪽 열은 **열 때 한 번만** 조립한다.
   *
   * 예전에는 redraw 마다 `rightWrap.replaceChildren(tabsWrap, toolsWrap, filterWrap, paletteWrap)` 로
   * 같은 노드를 다시 붙였다. 재부모(re-parent)는 스크롤 컨테이너의 scrollTop 을 0 으로 되돌리고
   * 포커스를 body 로 떨어뜨린다 — 실측(1440×900, 12×10 킷): 팔레트를 400px 내려 타일을 하나
   * 고르면 scrollTop 400 → 0, 두 번째 고를 때 250 → 0, 검색창에 글자를 치다 타일을 고르면
   * document.activeElement 가 search → BODY. 사용자가 "state 때문에 화면이 흔들린다"고 한 그것이다.
   * 그래서 붓 선택·필터·도구 전환은 **이미 있는 노드의 클래스만** 바꾼다.
   */
  const palette = createPalette(paletteWrap, tileset, session, () => {
    // 붓만 바뀌었다 — 캔버스도 부위 목록도 그대로다. 도구줄과 팔레트 표식만 갱신한다.
    tools.refresh();
    syncPalette();
  });
  const filterBar = createFilterBar(filterWrap, session, () => syncPalette());
  const tools = createTools(toolsWrap, session, (changed) => {
    tools.refresh();
    // 레이어를 바꾸면 스테이지 테두리(바닥/덧그림)가 달라진다 — 캔버스만 다시 그린다.
    if (changed === "layer") redrawCanvasOnly();
  });
  const tabs = createTabs(tabsWrap, session, () => redraw());

  /**
   * 팔레트 표식과 "사용 중 N칸" 은 **같은 집합**을 보므로 한 경로로 밀어야 한다.
   * 따로 놓았다가 e2e 에서 잡혔다: 칸을 칠하면 쓰인 타일엔 표식이 붙는데 숫자는
   * "사용 중 없음" 에 멈추어 있었다 — 칠하기 경로가 필터 줄을 갱신하지 않았기 때문이다.
   */
  function syncPalette(): void {
    filterBar.refresh(palette.refresh());
  }
  // 오른쪽 열은 지금 이 한 번만 조립된다. 툴·필터·팔레트·AI 폼은 전부 여기 남아 있고
  // 탭 전환은 hidden 을 토글한다 — 노드를 떼었다 다시 붙이면 팔레트 스크롤이 매번 맨 위로 튄다.
  rightWrap.replaceChildren(tabsWrap, toolsWrap, filterWrap, paletteWrap, aiWrap);

  const redraw = (): void => {
    const current = session.requireKit();
    if (!current) return;
    redrawCanvasOnly();
    refreshViewBar();
    drawSize(sizeWrap, current, redraw, session, commitKit);
    // #338 의 refresh 방식을 쓴다 — 예전 replaceChildren 재부모가 붓을 고를 때마다 팔레트를
    // 떼었다 붙여 흔들림을 만들었다. 여기에 #339 의 칸 힌트(hintsWrap)를 얹는다.
    tabs.refresh();
    tools.refresh();
    syncPalette();
    const shapeTab = session.tab === "shape";
    setHidden(partsWrap, !shapeTab);
    setHidden(hintsWrap, !shapeTab);
    setHidden(toolsWrap, !shapeTab);
    setHidden(filterWrap, !shapeTab);
    setHidden(paletteWrap, !shapeTab);
    setHidden(aiWrap, shapeTab);
    if (shapeTab) {
      drawParts(partsWrap, current, session, redraw, commitKit);
      drawCellHints(hintsWrap, current, session, redraw, commitKit);
    } else {
      drawAiTab(aiWrap, current, tileset, session, redraw, commitKit);
    }
  };

  function undo(): void {
    const previous = past.pop();
    if (!previous) return;
    const current = session.requireKit();
    if (!current) return;
    future.push(current);
    replaceStructureKit(session.tilesetId, previous);
    redraw();
  }

  function redo(): void {
    const next = future.pop();
    if (!next) return;
    const current = session.requireKit();
    if (!current) return;
    past.push(current);
    replaceStructureKit(session.tilesetId, next);
    redraw();
  }

  let dragStart: { readonly cx: number; readonly cy: number } | null = null;
  /** 칠하기 스트로크 시작 시점의 킷 — 뗄 때 이력에 한 번만 밀어 넣는다. */
  let strokeBefore: SectionStructureKitDef | null = null;

  const cellFromEvent = (event: PointerEvent, kit: SectionStructureKitDef) =>
    cellAtPoint(canvasStage.getBoundingClientRect(), activeScale, event.clientX, event.clientY, kit);

  /** 한 칸 칠하기. 이미 같은 타일이면 아무것도 하지 않는다 — 드래그 중 헛 렌더를 막는다. */
  const paintOneCell = (cx: number, cy: number): boolean => {
    const current = session.requireKit();
    if (!current) return false;
    const tile = session.tool === "erase" ? TILE.EMPTY : session.tile;
    if (tileAt(current, cx, cy, session.layer) === tile) return false;
    replaceStructureKit(session.tilesetId, paintCell(current, cx, cy, session.layer, tile));
    return true;
  };

  canvasStage.addEventListener("pointerdown", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    const current = session.requireKit();
    if (!current) return;
    const cell = cellFromEvent(pointer, current);
    if (!cell) return;

    // 스포이트는 드래그 개념이 없다 — 누른 칸의 타일을 붓으로 집고 끝난다.
    if (session.tool === "pick") {
      const picked = tileAt(current, cell.cx, cell.cy, session.layer);
      if (picked === TILE.EMPTY) {
        toast("빈 칸이라 집을 타일이 없습니다.", "info");
        return;
      }
      session.tile = picked;
      session.tool = "paint";
      noteRecentTile(session, picked);
      redraw();
      return;
    }

    // 칸 힌트는 드래그가 아니라 한 칸이다 — 누른 칸의 증분 축을 고르고 끝난다.
    // 메모는 아래 목록에서 적는다(팝오버에 텍스트 입력을 넣으면 바깥클릭 닫기와 싸운다).
    if (session.tool === "hint") {
      applyCellHintGrowth(cell.cx, cell.cy, { x: pointer.clientX, y: pointer.clientY }, session, redraw, commitKit);
      return;
    }

    // 이어진 같은 타일 영역을 한 번에 채운다.
    if (session.tool === "fill") {
      const filled = fillContiguous(current, cell.cx, cell.cy, session.layer, session.tile);
      if (filled === current) return;
      commitKit(current, filled);
      redraw();
      return;
    }

    // 드래그 도중 포인터가 캔버스 밖(도구 줄·팔레트·부위 목록)으로 나가도 pointermove/up 이
    // 이 리스너에 도착하도록 캡처한다 — 캡처가 없으면 밖에서 뗀 제스처는 dragStart 를
    // 영영 못 지우고, 나중에 엉뚱한 pointerup 과 짝지어져 유령 부위를 만든다.
    if (pointer.pointerId !== undefined) canvasStage.setPointerCapture(pointer.pointerId);

    if (session.tool === "part" || isDragShapeTool(session.tool)) {
      dragStart = cell;
      if (isDragShapeTool(session.tool)) drawShapePreview(previewOverlay, cell, cell, session, current, activeScale);
      return;
    }

    // 칠하기·지우기: 여기서부터 뗄 때까지가 한 스트로크다.
    strokeBefore = current;
    if (paintOneCell(cell.cx, cell.cy)) redrawCanvasOnly();
  });

  // 예전에는 pointermove 리스너가 아예 없어서 한 칸씩 클릭해야 했다.
  canvasStage.addEventListener("pointermove", (event) => {
    const pointer = event as PointerEvent;
    const current = session.requireKit();
    if (!current) return;

    // 도형 미리보기 — 뗄 때 어디가 칠해지는지 끌면서 보여준다.
    if (dragStart && isDragShapeTool(session.tool)) {
      const now = cellFromEvent(pointer, current);
      if (now) drawShapePreview(previewOverlay, dragStart, now, session, current, activeScale);
      return;
    }
    if (!strokeBefore) return;
    // buttons 를 보는 이유: 캔버스 밖에서 버튼을 뗀 뒤 다시 들어오면 pointerup 을 놓쳐
    // strokeBefore 가 남아 있을 수 있다. 그때 계속 칠하면 누르지 않은 채로 칠해진다.
    if (pointer.buttons !== undefined && (pointer.buttons & 1) === 0) return;
    const cell = cellFromEvent(pointer, current);
    if (!cell) return;
    if (paintOneCell(cell.cx, cell.cy)) redrawCanvasOnly();
  });

  canvasStage.addEventListener("pointerup", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    if (pointer.pointerId !== undefined && canvasStage.hasPointerCapture(pointer.pointerId)) {
      canvasStage.releasePointerCapture(pointer.pointerId);
    }

    // 칠하기 스트로크 종료 — 여러 칸을 칠했어도 되돌리기 한 번에 되돌아간다.
    const before = strokeBefore;
    strokeBefore = null;
    if (before) {
      const after = session.requireKit();
      if (after && after !== before) {
        pushHistory(before);
        // 여기서 full redraw 를 부르면 팔레트 480칸이 재생성돼 스크롤이 맨 위로 튄다.
        // 스트로크가 바꾼 것은 캔버스와 되돌리기 버튼 상태뿐이므로 그 둘만 갱신한다.
        redrawCanvasOnly();
        refreshViewBar();
      }
      return;
    }

    // dragStart 는 도구 전환·리사이즈를 거쳐도 여기서 반드시 비운다 — 성공 경로에서만
    // 지우면 도구를 바꾼 채로 뗀 제스처가 dragStart 를 남기고, 나중에 도구를 part 로
    // 되돌린 뒤의 무관한 pointerup 이 그 낡은 시작점으로 유령 부위를 만든다.
    const start = dragStart;
    dragStart = null;
    previewOverlay.replaceChildren();
    if (!start) return;
    const current = session.requireKit();
    if (!current) return;
    const end = cellFromEvent(pointer, current) ?? start;

    if (isDragShapeTool(session.tool)) {
      const cells = tileCellsForPaintShape(
        session.tool === "rect" ? "rect" : "round",
        { x: start.cx, y: start.cy },
        { x: end.cx, y: end.cy },
        { width: current.width, height: current.height },
      );
      let next = current;
      for (const cell of cells) next = paintCell(next, cell.x, cell.y, session.layer, session.tile);
      commitKit(current, next);
      redraw();
      return;
    }

    if (session.tool !== "part") return;
    const rect = normalizeDragRect(start, end);
    const commit = (kind: StructureKitPartKind): void => {
      const target = session.requireKit();
      if (!target) return;
      commitKit(target, addPart(target, rect, kind, `pt_${randomUuid()}`));
      redraw();
    };
    // 예전에는 종류가 언제나 "입구" 로 굳어 창문·간판·자리를 그릴 방법이 아예 없었다.
    // 팝오버를 못 띄우는 환경이면 가장 잦은 용도인 입구로 만든다(옛 동작).
    if (!openPartKindMenu({ x: pointer.clientX, y: pointer.clientY }, null, commit)) commit("entrance");
  });

  openDialog(
    EDITOR_DIALOG_TESTID,
    `${kit.name ?? "구조물"} 편집`,
    [
      el("div", {
        class: "structure-kit-editor-shell",
        children: [
          el("div", {
            class: "structure-kit-editor-grid",
            children: [
              el("div", {
                class: "structure-kit-editor-left",
                children: [canvasWrap, el("div", { class: "structure-kit-editor-underbar", children: [viewWrap, sizeWrap] })],
              }),
              rightWrap,
            ],
          }),
          partsWrap,
          hintsWrap,
        ],
      }),
    ],
    [{
      label: "닫기",
      testid: "structure-kit-editor-close",
      action: () => {
        closed = true;
        onClosed();
      },
    }],
  );
  // openDialog 는 오버레이를 돌려주지 않는다 — 자기가 박은 testid 로 되찾아 둔다.
  // 킷이 사라졌을 때 이 노드를 직접 떼어 내야 하기 때문이다.
  overlay = typeof document !== "undefined"
    ? document.querySelector(`[data-testid="${EDITOR_DIALOG_TESTID}"]`)
    : null;

  installEditorShortcuts(overlay, undo, redo);
  redraw();
  // 다이얼로그가 붙은 다음에 다시 잰다 — 첫 redraw 때는 아직 레이아웃이 없어서 캔버스 칸
  // 크기가 0 이고 배율이 대체값으로 떨어진다. 캔버스만 갱신하면 보기 줄의 "맞춤 (n x)"
  // 표시가 그 대체값에 머물러 실제 배율과 어긋나므로 둘을 함께 다시 그린다.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      redrawCanvasOnly();
      refreshViewBar();
    });
  }
}

/**
 * 편집기 안에서의 Ctrl+Z / Ctrl+Shift+Z(=Ctrl+Y).
 * document 에 붙이는 이유: 다이얼로그 안에 포커스가 없으면(배경 클릭 직후 등)
 * 오버레이까지 키 이벤트가 올라오지 않는다. 대신 오버레이가 DOM 에서 사라지면
 * 스스로 떼어낸다 — 백드롭 클릭·Escape 처럼 우리 콜백을 거치지 않는 닫기 경로가 있어
 * 닫기 훅에만 의존하면 리스너가 샌다.
 *
 * 문서 레벨 Ctrl+Z(databaseModal)는 편집기가 열려 있으면 무시하도록 이미 막아 두었다.
 */
function installEditorShortcuts(overlay: Element | null, undo: () => void, redo: () => void): void {
  if (!overlay || typeof document === "undefined") return;
  const onKey = (event: KeyboardEvent): void => {
    if (!overlay.isConnected) {
      document.removeEventListener("keydown", onKey, true);
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      undo();
      return;
    }
    if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      event.stopPropagation();
      redo();
    }
  };
  document.addEventListener("keydown", onKey, true);
}

/** 최근 쓴 타일 — 팔레트의 "최근" 분류가 이걸 본다. 맵 팔레트와 분리된 이 편집기만의 목록이다. */
function noteRecentTile(session: EditorSession, tile: number): void {
  const existing = session.recent.indexOf(tile);
  if (existing >= 0) session.recent.splice(existing, 1);
  session.recent.unshift(tile);
  if (session.recent.length > 18) session.recent.length = 18;
}

/**
 * 이어진 같은 타일 영역을 채운다(4방향).
 * mapHelpers.floodFillCells 를 쓰지 않은 이유: 그 함수는 GameMap 을 받고 lowerTiles 만
 * 보므로 덧그림 레이어를 채울 수 없다. 킷은 두 레이어를 모두 채워야 한다.
 */
function fillContiguous(
  kit: SectionStructureKitDef,
  cx: number,
  cy: number,
  layer: KitLayer,
  tile: number,
): SectionStructureKitDef {
  const target = tileAt(kit, cx, cy, layer);
  if (target === tile) return kit;
  let next = kit;
  const seen = new Set<number>();
  const pending: [number, number][] = [[cx, cy]];
  while (pending.length > 0) {
    const point = pending.pop();
    if (!point) break;
    const [x, y] = point;
    if (x < 0 || y < 0 || x >= kit.width || y >= kit.height) continue;
    const key = y * kit.width + x;
    if (seen.has(key)) continue;
    seen.add(key);
    if (tileAt(next, x, y, layer) !== target) continue;
    next = paintCell(next, x, y, layer, tile);
    pending.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return next;
}

/** 시작점 선택 — 빈 칸이냐, 집 한 채냐. 집 갈래는 combined_town 앨범에서만 열린다. */
export function openNewStructureKitDialog(tilesetId: TilesetId, onCreated: (kitId: string) => void): void {
  let houseKitId: string = PUBLIC_HOUSE_KIT_IDS[0]!;
  let width = 9;
  let height = 8;

  const kitSelect = el("select", {
    dataset: { testid: "structure-kit-new-house-kit" },
    children: PUBLIC_HOUSE_KIT_IDS.map((id) =>
      el("option", { attrs: { value: id }, text: HOUSE_KITS[id]?.name ?? id }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (target instanceof HTMLSelectElement) houseKitId = target.value;
      },
    },
  });

  const numberField = (label: string, testid: string, value: number, apply: (next: number) => void): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-size-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "number", min: "3", max: "32" },
          value: String(value),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (target instanceof HTMLInputElement) apply(Number(target.value));
            },
          },
        }),
      ],
    });

  openDialog(
    "structure-kit-new",
    "새 구조물",
    [
      el("p", { class: "structure-kit-quiet", text: "빈 칸에서 시작하거나, 집 한 채를 놓고 고쳐 나갈 수 있습니다." }),
      el("div", {
        class: "structure-kit-new-house",
        children: [kitSelect, numberField("폭", "structure-kit-new-width", width, (n) => { width = n; }),
          numberField("높이", "structure-kit-new-height", height, (n) => { height = n; })],
      }),
    ],
    [
      {
        label: "빈 3×3 으로 시작",
        testid: "structure-kit-new-blank",
        action: () => onCreated(createBlankStructureKit(tilesetId).id),
      },
      {
        label: "이 집으로 시작",
        testid: "structure-kit-new-house-confirm",
        action: () => {
          const kit = createStructureKitFromHouse(tilesetId, houseKitId, { width, height });
          if (!kit) {
            const kitLabel = HOUSE_KITS[houseKitId as keyof typeof HOUSE_KITS]?.name ?? houseKitId;
            toast(`'${kitLabel}' 은 ${width}×${height} 크기로 지어지지 않습니다 — 폭·높이를 바꿔 보세요.`, "info");
            return;
          }
          onCreated(kit.id);
        },
      },
      { label: "취소", testid: "structure-kit-new-cancel" },
    ],
  );
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(8, Math.max(1, Math.floor(value)));
}

/**
 * 주어진 공간에 맞는 배율.
 *
 * 예전 canvasScale 은 **폭만** 봤다. 그래서 3×64 처럼 세로로 긴 킷이면 배율 4 가 잡혀
 * 캔버스가 192×4096px 이 되어 다이얼로그를 세로로 뚫었다. 두 축 중 작은 쪽을 쓴다.
 */
export function fitScale(widthTiles: number, heightTiles: number, availW: number, availH: number): number {
  const byWidth = Math.floor(availW / (Math.max(1, widthTiles) * TILE_SIZE));
  const byHeight = Math.floor(availH / (Math.max(1, heightTiles) * TILE_SIZE));
  return clampScale(Math.min(byWidth, byHeight));
}

/** 사람이 배율을 골랐으면 그것, 아니면 캔버스 칸 실측에 맞춘 값. */
function resolveScale(kit: SectionStructureKitDef, session: EditorSession, wrap: HTMLElement): number {
  if (session.zoom !== null) return clampScale(session.zoom);
  const rect = typeof wrap.getBoundingClientRect === "function"
    ? wrap.getBoundingClientRect()
    : { width: 0, height: 0 };
  // 레이아웃 전(첫 렌더)·FakeDom 에서는 0 이 나온다 — 그때만 대체값을 쓴다.
  const availW = (rect.width || CANVAS_FALLBACK_W) - 10;
  const availH = (rect.height || CANVAS_FALLBACK_H) - 10;
  return fitScale(kit.width, kit.height, availW, availH);
}

function findKit(tilesetId: TilesetId, kitId: string): SectionStructureKitDef | undefined {
  const kit = store.getCurrent().tilesets[tilesetId]?.structureKits?.find((candidate) => candidate.id === kitId);
  return kit?.kind === "section" ? kit : undefined;
}

const AI_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];

const AI_ROLE_LABELS: Record<TileGroupRole, string> = {
  building: "건물",
  castle: "성",
  fence: "울타리",
  roof: "지붕",
  terrain: "지형",
  water: "물",
  wall: "벽",
  prop: "소품",
};

/** 분류(TileGroupRole)의 한글 라벨 — 인스펙터의 AI 메타 요약도 이 라벨을 그대로 쓴다. */
export function aiRoleLabel(role: TileGroupRole): string {
  return AI_ROLE_LABELS[role];
}

const REPEATABILITY_OPTIONS: readonly { readonly value: "" | "repeat" | "fixed"; readonly label: string }[] = [
  { value: "", label: "미지정" },
  { value: "repeat", label: "반복 가능" },
  { value: "fixed", label: "한 채 완결" },
];

/**
 * 증분 축 어휘 — 구조물 전체와 칸 하나가 **같은 단어**를 쓴다.
 * 다른 단어를 쓰면 사람이 「구조물은 가로인데 칸은 수평」을 같은 뜻으로 읽을 이유가 없다.
 */
const GROWTH_AXIS_LABELS: Readonly<Record<StructureGrowthAxis, string>> = {
  horizontal: "가로로 증분 가능",
  vertical: "세로로 증분 가능",
  both: "가로·세로 모두 증분 가능",
};

const GROWTH_AXES: readonly StructureGrowthAxis[] = ["horizontal", "vertical", "both"];

/** 칸 힌트 배지·목록에 쓰는 짧은 표시. 칸이 작아 긴 말이 들어가지 않는다. */
const GROWTH_AXIS_GLYPHS: Readonly<Record<StructureGrowthAxis, string>> = {
  horizontal: "↔",
  vertical: "↕",
  both: "✛",
};

export function growthAxisLabel(axis: StructureGrowthAxis): string {
  return GROWTH_AXIS_LABELS[axis];
}

/** 홈 레이어의 한글 라벨. 편집기 도구줄과 같은 어휘를 쓴다 — 하층/상층이 아니라 바닥/덧그림. */
export function layerHomeLabel(layerHome: "lower" | "upper" | "perCell"): string {
  return layerHome === "lower" ? "바닥" : layerHome === "upper" ? "덧그림" : "칸별";
}

const GROWTH_AXIS_OPTIONS: readonly { readonly value: "" | StructureGrowthAxis; readonly label: string }[] = [
  { value: "", label: "미지정 — 반복 값을 따른다" },
  ...GROWTH_AXES.map((axis) => ({ value: axis, label: GROWTH_AXIS_LABELS[axis] })),
];

const LAYER_HOME_OPTIONS: readonly {
  readonly value: "" | "lower" | "upper" | "perCell";
  readonly label: string;
}[] = [
  { value: "", label: "미지정 — 그림에서 유도" },
  { value: "lower", label: "바닥" },
  { value: "upper", label: "덧그림" },
  { value: "perCell", label: "칸별" },
];

/**
 * 초안 프롬프트. 모델에 넘기는 것은 이것뿐이다 —
 * 크기·타일 행렬·각 타일의 사람 읽는 라벨·기존 이름 목록.
 * 라벨을 함께 주는 이유: 모델이 타일 번호의 의미를 추측하지 않게 한다.
 */
export function buildAiMetaDraftPrompt(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  existingNames: readonly string[],
): string {
  const used = collectUsedTiles(kit);
  const legend = [...used]
    .sort((a, b) => a - b)
    .map((tile) => {
      // describeChipsetTile 의 label/aiLabel 은 AI 내부용 영문("Wood door top")이라 한글 단서가
      // 없다 — tileDisplayLabelForIndex 의 한글 표시명("116 나무 문 상")을 앞에 붙여야 실제로
      // "사람이 읽는 라벨"이 된다. aiLabel 은 배치 힌트(예: "146 바로 위")로 그대로 덧붙인다.
      const readable = tileDisplayLabelForIndex(tile);
      const described = describeChipsetTile(tile);
      return `  ${readable}${described.aiLabel ? ` (${described.aiLabel})` : ""}`;
    })
    .join("\n");

  const matrix = kit.rows
    .map((row) => row.tiles.map((tile) => (tile === TILE.EMPTY ? "." : String(tile))).join(" "))
    .join("\n");

  return [
    `타일셋: ${tileset.name}`,
    `구조물 이름: ${kit.name ?? "구조물"}`,
    `크기: ${kit.width}×${kit.height}`,
    "",
    "타일 행렬(하층):",
    matrix,
    "",
    "타일 뜻:",
    legend,
    "",
    `이미 쓰는 이름(중복 피할 것): ${existingNames.join(", ") || "없음"}`,
    "",
    "이 구조물의 description(무엇인지), placementRules(어디에 어떻게 놓는지),",
    `tags(검색어 배열), role(${AI_ROLES.join("|")}), repeatability(repeat|fixed),`,
    `growthAxis(${GROWTH_AXES.join("|")}), layerHome(lower|upper|perCell), themes(어울리는 테마 배열)를`,
    "JSON 한 덩어리로만 답하라. repeatability 는 가로로 이어 찍어도 되면 repeat, 한 채로 완결이면 fixed.",
    "growthAxis 는 **무한히 이어붙여도 그림이 성립하는 방향**이다 — 벽은 높이로 쌓으면 vertical,",
    "울타리·성벽은 horizontal, 바닥 무늬처럼 사방으로 이어지면 both. 집·우물같이 한 채로 끝나는 것은 생략해라.",
    "layerHome 은 바닥에 깔리면 lower, 사람 위로 덮이는 지붕·나뭇잎은 upper, 섞여 있으면 perCell.",
    "",
    "추가로 placement 배열을 낼 수 있다 — 이것은 산문이 아니라 **편집기가 실제로 검사하는 조건**이다.",
    `각 항목은 {zone, facing, strength}. zone ∈ ${PLACEMENT_ZONES.join("|")},`,
    `facing ∈ ${PLACEMENT_FACINGS.join("|")}(zone=againstWall 에서만 의미), strength ∈ hard|soft.`,
    "확실하지 않으면 placement 를 아예 빼라 — 틀린 hard 조건은 시공을 막아 버린다.",
  ].join("\n");
}

/** 초안 응답 → 메타. origin 은 언제나 "ai" 다 — 사람이 수락해야 "user" 가 된다. */
export function parseAiMetaDraft(text: string): StructureKitAiMeta | null {
  let parsed: unknown;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  // 공백뿐인 문자열은 "내용 있음"으로 치지 않는다 — 그렇지 않으면 모델이 빈 프롬프트를
  // 돌려줘도 이 함수가 non-null 을 반환해 session.draft 를 덮어써, 사람이 요청 전에
  // 이미 입력해 두었던 값(반복·분류 포함)을 조용히 지워 버린다.
  if (!description.trim() && !placementRules.trim()) return null;

  const role = AI_ROLES.find((candidate) => candidate === record.role);
  const repeatability = record.repeatability === "repeat" || record.repeatability === "fixed"
    ? record.repeatability
    : undefined;
  const growthAxis = GROWTH_AXES.find((candidate) => candidate === record.growthAxis);
  const layerHome = record.layerHome === "lower" || record.layerHome === "upper" || record.layerHome === "perCell"
    ? record.layerHome
    : undefined;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
  const themes = Array.isArray(record.themes)
    ? record.themes.filter((theme): theme is string => typeof theme === "string" && theme.trim().length > 0)
    : undefined;
  const placement = parseAiPlacementConditions(record.placement);

  return {
    description,
    placementRules,
    ...(placement.length > 0 ? { placement } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(themes && themes.length > 0 ? { themes } : {}),
    ...(role ? { role } : {}),
    ...(repeatability ? { repeatability } : {}),
    ...(growthAxis ? { growthAxis } : {}),
    ...(layerHome ? { layerHome } : {}),
    origin: "ai",
  };
}

/**
 * 모델이 낸 배치 조건 파싱 — 아는 값만 통과시키고 나머지는 조용히 버린다.
 * 모르는 zone 을 억지로 매핑하지 않는 이유: 틀린 hard 조건은 시공을 **막으므로**,
 * "조건이 없다"보다 "엉뚱한 조건이 걸렸다"가 훨씬 나쁘다.
 */
function parseAiPlacementConditions(value: unknown): PlacementSurfaceCondition[] {
  if (!Array.isArray(value)) return [];
  const parsed: PlacementSurfaceCondition[] = [];
  for (const entry of value.slice(0, 4)) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const zone = asPlacementZone(record.zone);
    if (!zone) continue;
    const facing = zone === "againstWall" ? asPlacementFacing(record.facing) : undefined;
    parsed.push({
      id: `pc_${randomUuid()}`,
      strength: record.strength === "soft" ? "soft" : "hard",
      zone,
      ...(facing && facing !== "any" ? { facing } : {}),
    });
  }
  return parsed;
}

/**
 * 캔버스 + 격자선 + 도형 미리보기.
 *
 * backgroundTile 을 null(어두운 바탕)로 두는 것은 의도다. 인스펙터 미리보기는 잔디 받침을
 * 깔아 "맵에 놓으면 이렇게 보인다"를 보여주지만, 편집기에서는 **빈 칸과 잔디를 칠한 칸이
 * 구별돼야** 한다. 빈 칸은 찍을 때 투명하게 남는 칸이라 뜻이 다르다.
 *
 * 격자선을 캔버스에 직접 긋지 않는 이유: renderTileCellsToCanvas 는 캔버스를 즉시 돌려주고
 * 타일 그림판 이미지가 로드되는 프레임에 내용을 그린다(kitRender.ts:135-150). 지금 그으면
 * 그 비동기 렌더가 배경부터 다시 칠하면서 지워 버린다. 그래서 위에 겹치는 층으로 둔다.
 */
function drawCanvasStage(
  stage: HTMLElement,
  gridOverlay: HTMLElement,
  previewOverlay: HTMLElement,
  tileset: TilesetDef,
  kit: SectionStructureKitDef,
  session: EditorSession,
  scale: number,
): void {
  const cells = [];
  for (let y = 0; y < kit.height; y += 1) {
    for (let x = 0; x < kit.width; x += 1) {
      const lower = kit.rows[y]?.tiles[x] ?? TILE.EMPTY;
      const upper = kit.rows[y]?.upperTiles?.[x] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) cells.push({ dx: x, dy: y, layer: "lower" as const, tile: lower });
      if (upper !== TILE.EMPTY) cells.push({ dx: x, dy: y, layer: "upper" as const, tile: upper });
    }
  }
  const canvas = renderTileCellsToCanvas({
    tileset,
    widthTiles: kit.width,
    heightTiles: kit.height,
    cells,
    scale,
    backgroundTile: null,
  });
  canvas.className = "structure-kit-editor-canvas";
  const cellPx = TILE_SIZE * scale;
  stage.setAttribute("style", `width:${kit.width * cellPx}px;height:${kit.height * cellPx}px`);
  gridOverlay.setAttribute("style", `--structure-kit-cell:${cellPx}px`);
  // 지금 어느 레이어를 칠하는지 — 예전에는 캔버스에 layer-lower/layer-upper 클래스를
  // 붙였지만 그 클래스에 CSS 정의가 없어서 시각 신호가 0 이었다(죽은 클래스).
  stage.dataset.layer = session.layer;
  // 칸 힌트 배지 — 목록만 있으면 "어느 칸이었지"를 좌표로 역산해야 한다. 격자선처럼 겹치는
  // 층으로 둔다(캔버스에 직접 그리면 타일셋 이미지가 늦게 로드될 때 지워진다 — 위 주석 참고).
  const hintBadges = (kit.cellHints ?? []).map((hint) =>
    el("div", {
      class: "structure-kit-editor-hint-badge",
      attrs: {
        style: `left:${hint.dx * cellPx}px;top:${hint.dy * cellPx}px`,
        title: cellHintTitle(hint),
      },
      text: hint.growth ? GROWTH_AXIS_GLYPHS[hint.growth] : "\u270e",
    }),
  );
  const hintOverlay = hintBadges.length > 0
    ? [el("div", { class: "structure-kit-editor-hints-overlay", children: hintBadges })]
    : [];
  stage.replaceChildren(
    canvas,
    ...(session.showGrid ? [gridOverlay] : []),
    ...hintOverlay,
    previewOverlay,
  );
}

/** 드래그 중 어디가 칠해질지 미리 보여준다. 맵 편집기의 고스트와 같은 역할. */
function drawShapePreview(
  host: HTMLElement,
  start: { readonly cx: number; readonly cy: number },
  end: { readonly cx: number; readonly cy: number },
  session: EditorSession,
  kit: SectionStructureKitDef,
  scale: number,
): void {
  const cells = tileCellsForPaintShape(
    session.tool === "rect" ? "rect" : "round",
    { x: start.cx, y: start.cy },
    { x: end.cx, y: end.cy },
    { width: kit.width, height: kit.height },
  );
  const cellPx = TILE_SIZE * scale;
  host.replaceChildren(
    ...cells.map((cell) =>
      el("div", {
        class: "structure-kit-editor-preview-cell",
        attrs: {
          style: `left:${cell.x * cellPx}px;top:${cell.y * cellPx}px;width:${cellPx}px;height:${cellPx}px`,
        },
      }),
    ),
  );
}

/** 팔레트 한 칸의 픽셀 크기 — CSS 의 .structure-kit-editor-swatch 와 같은 값이어야 한다. */
const SWATCH_PX = 26;

/** 보이기/숨기기 한 줄짜리 헬퍼 — hidden 속성은 FakeDom 에서도 그대로 읽힌다. */
function setHidden(node: HTMLElement, hidden: boolean): void {
  if (hidden) node.setAttribute("hidden", "");
  else node.removeAttribute("hidden");
}

/**
 * 이 킷이 지금 쓰고 있는 타일 번호. 두 레이어를 모두 본다.
 *
 * 왜 필요한가: 480칸 팔레트에서 "이미 이 구조물에 쓴 타일"이 구별되지 않으면 사용자는
 * 방금 지붕에 쓴 타일을 다시 찾으려고 시트를 눈으로 훑는다. 표식과 [안 쓴 타일만] 필터가
 * 같은 집합을 본다.
 */
export function collectUsedTiles(kit: SectionStructureKitDef): Set<number> {
  const used = new Set<number>();
  for (const row of kit.rows) {
    for (const tile of row.tiles) if (tile !== TILE.EMPTY) used.add(tile);
    for (const tile of row.upperTiles ?? []) if (tile !== TILE.EMPTY) used.add(tile);
  }
  return used;
}

type PaletteView = {
  /**
   * 이미 만들어 둔 480칸의 **클래스만** 갱신한다 — 스크롤·포커스가 그대로 남는다.
   * 지금 킷이 쓰는 타일 칸수를 돌려준다 — 필터 줄의 숫자가 같은 집합에서 나와야 하기 때문이다.
   */
  readonly refresh: () => number;
};

/**
 * 타일 팔레트. 480칸을 **전부** 유지한다 — 구조물은 지붕 변형처럼 세부 타일이 필요해서
 * 맵 팔레트처럼 오토타일을 대표 1칸으로 접으면 만들 수 없는 구조물이 생긴다.
 * 검색·분류에 걸리지 않은 칸은 숨기지 않고 흐리게만 한다: 칸의 위치가 원본 시트의 좌표라
 * 숨기면 "어디쯤 타일"인지 감각이 깨진다(맵 편집기의 커스텀 아틀라스와 같은 판단).
 * 예외는 [안 쓴 타일만] 뿐이다 — 사용자가 명시적으로 켠 필터이고, 걸러지는 쪽이 소수다.
 *
 * **노드는 열 때 한 번만 만든다.** 예전에는 타일을 고를 때마다 480개를 재생성하고
 * 부모에 다시 붙여서 스크롤이 맨 위로 튀었다(실측 400 → 0).
 */
function createPalette(
  host: HTMLElement,
  tileset: TilesetDef,
  session: EditorSession,
  onPick: () => void,
): PaletteView {
  const swatches: HTMLElement[] = [];
  for (let tile = 0; tile < tileset.count; tile += 1) {
    const label = tileDisplayLabelForIndex(tile);
    const index = tile;
    swatches.push(
      el("button", {
        class: "structure-kit-editor-swatch",
        attrs: {
          type: "button",
          style: tilesetTileBackgroundStyle(tileset, tile, SWATCH_PX),
          // 칸에 글자가 없어 접근성 이름이 title 뿐이다. 지금 잡힌 붓은 색으로만
          // 구별되므로 aria-pressed 로도 알려야 한다. 사용 여부는 refresh 가 덧붙인다.
          title: label,
          "aria-label": label,
          "aria-pressed": "false",
        },
        dataset: { testid: `structure-kit-editor-tile-${tile}` },
        on: {
          click: () => {
            session.tile = index;
            // 도구가 지우기·스포이트·부위·칸 힌트였으면 칠하기로 돌린다. 사각형·타원·채우기는
            // 타일만 바꿔 그 도구를 계속 쓰게 둔다 — 맵 편집기와 같은 감각이다.
            if (
              session.tool === "erase" || session.tool === "pick"
              || session.tool === "part" || session.tool === "hint"
            ) {
              session.tool = "paint";
            }
            noteRecentTile(session, index);
            onPick();
          },
        },
      }),
    );
  }
  const empty = el("div", {
    class: "structure-kit-editor-palette-empty",
    text: "조건에 맞는 타일이 없습니다.",
    dataset: { testid: "structure-kit-editor-palette-empty" },
  });
  host.replaceChildren(...swatches, empty);

  // 마지막으로 그린 상태의 지문. 칠하기 드래그는 칸마다 refresh 를 부르므로,
  // 바뀐 것이 없으면 480번의 DOM 쓰기를 아예 하지 않는다.
  let signature = "";

  const refresh = (): number => {
    const kit = findKit(session.tilesetId, session.kitId);
    const used = kit ? collectUsedTiles(kit) : new Set<number>();
    const next = [
      session.tile,
      session.category,
      session.search,
      session.unusedOnly ? "unused" : "all",
      session.recent.join(","),
      [...used].sort((a, b) => a - b).join(","),
    ].join("|");
    if (next === signature) return used.size;
    signature = next;

    const visible = new Set(
      filterTileIndexes(tileset, {
        category: session.category,
        query: session.search,
        recent: session.recent,
      }),
    );
    let shown = 0;
    for (let tile = 0; tile < swatches.length; tile += 1) {
      const swatch = swatches[tile];
      if (!swatch) continue;
      const isActive = tile === session.tile;
      const isUsed = used.has(tile);
      // 고른 타일은 필터에 안 걸려도 항상 선명하고 사라지지 않는다 — 아니면 "선택 중"인 칸이
      // 흐려지거나 [안 쓴 타일만] 을 켜는 순간 지금 쓰는 붓이 화면에서 없어진다.
      const hidden = session.unusedOnly && isUsed && !isActive;
      const matches = visible.has(tile) && !hidden;
      swatch.classList.toggle("active", isActive);
      swatch.classList.toggle("is-filtered-out", !matches && !isActive);
      swatch.classList.toggle("is-used", isUsed);
      setHidden(swatch, hidden);
      swatch.setAttribute("aria-pressed", isActive ? "true" : "false");
      const label = isUsed
        ? `${tileDisplayLabelForIndex(tile)} · 이 구조물에 사용 중`
        : tileDisplayLabelForIndex(tile);
      swatch.setAttribute("title", label);
      swatch.setAttribute("aria-label", label);
      if (matches) shown += 1;
    }
    setHidden(empty, shown > 0);
    return used.size;
  };

  refresh();
  return { refresh };
}

type FilterBarView = {
  /** 분류칩 활성 표시와 "사용 중 N칸" 숫자만 고친다 — 검색창 노드는 건드리지 않는다. */
  readonly refresh: (usedCount: number) => void;
};

/**
 * 팔레트 위 검색창 + 분류칩 + [안 쓴 타일만]. 분류 목록과 필터 계산은 맵 팔레트와 같은 출처
 * (panels/tilePaletteFilter.ts)를 쓴다 — 규칙이 두 곳에서 갈라지지 않게.
 *
 * 노드를 한 번만 만드는 이유는 팔레트와 같다. 특히 검색창을 다시 만들면 한 글자 칠 때마다
 * 포커스와 커서 위치가 날아간다.
 */
function createFilterBar(
  host: HTMLElement,
  session: EditorSession,
  onFilterChange: () => void,
): FilterBarView {
  const search = el("input", {
    class: "structure-kit-editor-search",
    attrs: { type: "search", placeholder: "번호·이름·태그로 타일 찾기" },
    value: session.search,
    dataset: { testid: "structure-kit-editor-search" },
    on: {
      input: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        session.search = target.value;
        onFilterChange();
      },
    },
  });

  const chips = TILE_CATEGORIES.map((category) =>
    el("button", {
      class: "structure-kit-editor-chip",
      attrs: { type: "button", "aria-pressed": "false" },
      text: category.label,
      dataset: { testid: `structure-kit-editor-category-${category.id}` },
      on: {
        click: () => {
          session.category = category.id;
          applyChipState();
          onFilterChange();
        },
      },
    }),
  );

  const applyChipState = (): void => {
    TILE_CATEGORIES.forEach((category, index) => {
      const chip = chips[index];
      if (!chip) return;
      const active = session.category === category.id;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  // 체크박스인 이유: 필터를 켜 둔 상태가 화면에 계속 남아야 한다. 분류칩에 섞으면
  // "집" 같은 분류와 배타가 되어 둘을 같이 걸 수 없다 — 실제 저작은 둘을 겹쳐 쓴다.
  const unusedBox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "structure-kit-editor-unused-only" },
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        session.unusedOnly = target.checked;
        onFilterChange();
      },
    },
  });
  // 숫자를 `data-used-count` 로도 낸다. 테스트가 "사용 중 2칸" 같은 **문구**를 잡으면
  // 카피를 다듬는 순간 관계없는 테스트가 깨진다 — 기계가 읽는 것은 값이어야 한다.
  const usedCountLabel = el("span", {
    class: "structure-kit-editor-used-count",
    dataset: { testid: "structure-kit-editor-used-count", usedCount: "0" },
    text: "",
  });

  host.replaceChildren(
    search,
    el("div", { class: "structure-kit-editor-chips", children: chips }),
    el("div", {
      class: "structure-kit-editor-filter-row",
      children: [
        el("label", {
          class: "structure-kit-editor-unused-label",
          children: [unusedBox, el("span", { text: "안 쓴 타일만" })],
        }),
        usedCountLabel,
      ],
    }),
  );
  applyChipState();

  return {
    refresh: (usedCount: number) => {
      applyChipState();
      usedCountLabel.dataset.usedCount = String(usedCount);
      usedCountLabel.textContent = usedCount > 0 ? `사용 중 ${usedCount}칸` : "사용 중 없음";
    },
  };
}

type TabsView = { readonly refresh: () => void };

function createTabs(host: HTMLElement, session: EditorSession, onSwitch: () => void): TabsView {
  const make = (label: string, testid: string, tab: EditorSession["tab"]): HTMLElement =>
    el("button", {
      class: "btn small",
      attrs: { type: "button" },
      text: label,
      dataset: { testid },
      on: { click: () => { session.tab = tab; onSwitch(); } },
    });

  const buttons: readonly { readonly node: HTMLElement; readonly tab: EditorSession["tab"] }[] = [
    { node: make("모양", "structure-kit-editor-tab-shape", "shape"), tab: "shape" },
    { node: make("AI 메타", "structure-kit-editor-tab-ai", "ai"), tab: "ai" },
  ];
  host.replaceChildren(...buttons.map((entry) => entry.node));

  const refresh = (): void => {
    for (const entry of buttons) entry.node.classList.toggle("primary", session.tab === entry.tab);
  };
  refresh();
  return { refresh };
}

/**
 * 도구 목록. 예전에는 칠하기·지우기 둘뿐이라 사각형·채우기·스포이트가 없었다.
 * 레이어 이름은 맵 편집기와 같은 어휘로 통일했다 — 하층/상층 → 바닥/덧그림.
 * (testid 는 lower/upper 를 그대로 유지한다. 바꾸면 기존 테스트가 깨진다.)
 */
const TOOL_BUTTONS: readonly {
  readonly tool: EditorTool;
  readonly label: string;
  readonly icon: SvgIconName;
  readonly testid: string;
}[] = [
  { tool: "paint", label: "칠하기", icon: "brush", testid: "structure-kit-editor-tool-paint" },
  { tool: "erase", label: "지우기", icon: "eraser", testid: "structure-kit-editor-tool-erase" },
  { tool: "rect", label: "사각형", icon: "rect", testid: "structure-kit-editor-tool-rect" },
  { tool: "ellipse", label: "타원", icon: "round", testid: "structure-kit-editor-tool-ellipse" },
  { tool: "fill", label: "이어진 곳 채우기", icon: "fill", testid: "structure-kit-editor-tool-fill" },
  { tool: "pick", label: "스포이트", icon: "eyedropper", testid: "structure-kit-editor-tool-pick" },
  { tool: "part", label: "부위 그리기", icon: "select", testid: "structure-kit-editor-tool-part" },
  { tool: "hint", label: "칸 힌트 (증분 축·메모)", icon: "template", testid: "structure-kit-editor-tool-hint" },
];

type ToolsView = { readonly refresh: () => void };

/** 뭐가 바뀐는지 — 레이어는 캔버스 테두리까지 바꾸므로 호출부가 구별해야 한다. */
type ToolChange = "tool" | "layer";

/**
 * 도구·레이어 버튼. 노드를 한 번만 만들고 활성 표식은 refresh 가 클래스로만 바꾼다 —
 * 예전에는 도구를 누를 때마다 오른쪽 열을 통째 다시 조립해서 팔레트 스크롤이 튀었다.
 */
function createTools(
  host: HTMLElement,
  session: EditorSession,
  onChange: (changed: ToolChange) => void,
): ToolsView {
  // 아이콘은 맵 편집기의 SVG 팩토리를 그대로 쓴다 — 유니코드 글리프는 폰트에 따라
  // 안 그려지거나 뭉개져서 무슨 도구인지 알 수 없었다. (makeTileToolbar 자체는 부르지
  // 않는다: installToolbarBadgeRefresh 가 모듈 전역을 마지막 호출자로 덮어써서
  // 맵 팔레트의 자동 갱신이 이 편집기로 샌다.)
  const toolNodes = TOOL_BUTTONS.map((entry) => ({
    tool: entry.tool,
    node: el("button", {
      class: "btn small structure-kit-editor-tool",
      // aria-pressed 는 맵 도구막대와 같은 규약이다. 아이콘 전용 버튼이라 이게 없으면
      // 화면 낭독기 쪽에서 지금 어느 도구가 잡혀 있는지 알 방법이 색뿐이다.
      attrs: { type: "button", title: entry.label, "aria-label": entry.label, "aria-pressed": "false" },
      children: [makeSvgIcon(entry.icon)],
      dataset: { testid: entry.testid },
      on: { click: () => { session.tool = entry.tool; onChange("tool"); } },
    }),
  }));

  const layerNodes = [
    { layer: "lower" as KitLayer, label: "바닥", testid: "structure-kit-editor-layer-lower" },
    { layer: "upper" as KitLayer, label: "덧그림", testid: "structure-kit-editor-layer-upper" },
  ].map((entry) => ({
    layer: entry.layer,
    node: el("button", {
      class: "btn small structure-kit-editor-layer-btn",
      attrs: { type: "button", "aria-label": `${entry.label} 레이어`, "aria-pressed": "false" },
      text: entry.label,
      dataset: { testid: entry.testid },
      on: { click: () => { session.layer = entry.layer; onChange("layer"); } },
    }),
  }));

  host.replaceChildren(
    el("div", { class: "structure-kit-editor-tool-row", children: toolNodes.map((entry) => entry.node) }),
    el("div", { class: "structure-kit-editor-tool-row", children: layerNodes.map((entry) => entry.node) }),
  );

  const refresh = (): void => {
    for (const entry of toolNodes) {
      const active = session.tool === entry.tool;
      entry.node.classList.toggle("primary", active);
      entry.node.setAttribute("aria-pressed", active ? "true" : "false");
    }
    for (const entry of layerNodes) {
      const active = session.layer === entry.layer;
      entry.node.classList.toggle("primary", active);
      entry.node.setAttribute("aria-pressed", active ? "true" : "false");
    }
  };
  refresh();
  return { refresh };
}

/** 캔버스 아래 보기 줄 — 되돌리기 · 확대 · 격자. */
function drawViewBar(
  host: HTMLElement,
  session: EditorSession,
  redraw: () => void,
  history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
    /** 지금 캔버스에 실제로 쓰인 배율 — "맞춤" 에서 확대/축소의 기준점. */
    readonly currentScale: number;
  },
): void {
  const iconButton = (
    body: Node | string,
    label: string,
    testid: string,
    enabled: boolean,
    onClick: () => void,
    extraClass = "",
  ): HTMLElement =>
    el("button", {
      class: `btn small${extraClass ? ` ${extraClass}` : ""}`,
      attrs: enabled
        ? { type: "button", title: label, "aria-label": label }
        : { type: "button", title: label, "aria-label": label, disabled: "" },
      children: [body],
      dataset: { testid },
      on: { click: () => { if (enabled) onClick(); } },
    });

  const zoomLabel = session.zoom === null ? `맞춤 (${history.currentScale}x)` : `${session.zoom}x`;
  /**
   * 한 단계 확대/축소. "맞춤" 상태에서는 **지금 실제로 쓰이는 배율**을 기준으로 삼는다 —
   * 고정 인덱스에서 출발하면 맞춤이 5x 인데 [+] 를 눌러 3x 로 줄어드는 일이 생긴다.
   */
  const stepZoom = (direction: 1 | -1): void => {
    const base = session.zoom ?? history.currentScale;
    const next = direction > 0
      ? ZOOM_STEPS.find((step) => step > base)
      : [...ZOOM_STEPS].reverse().find((step) => step < base);
    if (next === undefined) return;
    session.zoom = next;
    redraw();
  };

  host.replaceChildren(
    el("div", {
      class: "structure-kit-editor-viewbar-group",
      children: [
        iconButton(makeSvgIcon("undo"), "되돌리기 (Ctrl+Z)", "structure-kit-editor-undo", history.canUndo, history.undo),
        // redo 아이콘이 따로 없어서 undo 를 좌우 반전해 쓴다(CSS).
        iconButton(
          makeSvgIcon("undo"),
          "다시하기 (Ctrl+Shift+Z)",
          "structure-kit-editor-redo",
          history.canRedo,
          history.redo,
          "structure-kit-editor-redo-icon",
        ),
      ],
    }),
    el("div", { class: "structure-kit-editor-viewbar-sep" }),
    el("div", {
      class: "structure-kit-editor-viewbar-group",
      children: [
        iconButton("−", "축소", "structure-kit-editor-zoom-out", true, () => stepZoom(-1)),
        el("span", {
          class: "structure-kit-editor-zoom-value",
          text: zoomLabel,
          dataset: { testid: "structure-kit-editor-zoom-value" },
        }),
        iconButton("+", "확대", "structure-kit-editor-zoom-in", true, () => stepZoom(1)),
        el("button", {
          class: "btn small",
          attrs: { type: "button" },
          text: "맞춤",
          dataset: { testid: "structure-kit-editor-zoom-fit" },
          on: { click: () => { session.zoom = null; redraw(); } },
        }),
      ],
    }),
    el("div", { class: "structure-kit-editor-viewbar-sep" }),
    el("button", {
      class: `btn small${session.showGrid ? " primary" : ""}`,
      attrs: { type: "button", "aria-pressed": session.showGrid ? "true" : "false" },
      text: "격자",
      dataset: { testid: "structure-kit-editor-grid-toggle" },
      on: { click: () => { session.showGrid = !session.showGrid; redraw(); } },
    }),
  );
}

type CommitKit = (before: SectionStructureKitDef, next: SectionStructureKitDef) => void;

function drawSize(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  redraw: () => void,
  session: EditorSession,
  commitKit: CommitKit,
): void {
  const field = (
    label: string,
    testid: string,
    value: number,
    apply: (next: number) => { width: number; height: number },
  ): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-size-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "number", min: "1", max: "64" },
          value: String(value),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLInputElement)) return;
              const current = session.requireKit();
              if (!current) return;
              const next = apply(Number(target.value));
              const result = resizeKit(current, next.width, next.height);
              // 크기 변경도 되돌릴 수 있어야 한다 — 부위가 잘리는 편집이라 특히.
              commitKit(current, result.kit);
              if (result.clamped > 0 || result.dropped > 0 || result.droppedHints > 0) {
                // 조용히 지우지 않는다 — 사용자가 입구가 사라진 걸 나중에야 알게 하면 안 된다.
                // 칸 힌트도 같은 규약이다: 1×1 이라 잘릴 수 없고 삭제만 있으므로 따로 센다.
                const parts = [
                  result.clamped > 0 ? `부위 ${result.clamped}개 잘림` : "",
                  result.dropped > 0 ? `부위 ${result.dropped}개 삭제` : "",
                  result.droppedHints > 0 ? `칸 힌트 ${result.droppedHints}개 삭제` : "",
                ].filter(Boolean);
                toast(parts.join(", "), "info");
              }
              redraw();
            },
          },
        }),
      ],
    });

  host.replaceChildren(
    field("폭", "structure-kit-editor-width", kit.width, (value) => ({ width: value, height: kit.height })),
    field("높이", "structure-kit-editor-height", kit.height, (value) => ({ width: kit.width, height: value })),
  );
}

const PART_KIND_OPTIONS: readonly { readonly value: StructureKitPartKind; readonly label: string }[] = [
  { value: "entrance", label: "입구" },
  { value: "window", label: "창문" },
  { value: "sign", label: "간판" },
  { value: "anchor", label: "자리" },
];

/** 팝오버 항목의 글리프. 툴 레일이 이미 쓰는 아이콘 이름만 고른다(없는 이름은 빈 칸이 된다). */
const PART_KIND_ICONS: Readonly<Record<StructureKitPartKind, string>> = {
  entrance: "link",
  window: "window",
  sign: "title",
  anchor: "pin",
};

function partKindLabel(kind: StructureKitPartKind): string {
  return PART_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/**
 * 부위 종류 팝오버. 맵 컨텍스트 메뉴 위젯을 그대로 빌린다 —
 * 클릭 지점 배치·바깥클릭/Esc 닫기·화살표 키 이동이 이미 들어 있다.
 * 그 파일은 건드리지 않고, 이 쓰임에 맞게 라벨과 testid 만 뒤에서 덮어쓴다.
 *
 * window 가 없는 환경(노드 유닛 테스트)에서는 그 위젯이 resize/scroll 리스너를 못 붙여
 * 던진다 — false 를 돌려주고 호출부가 팝오버 없는 경로로 넘어가게 한다.
 */
function openPartKindMenu(
  point: { readonly x: number; readonly y: number },
  currentKind: StructureKitPartKind | null,
  pick: (kind: StructureKitPartKind) => void,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  openMapContextMenu({
    mapId: "structure-kit-part-kind",
    mapName: "부위 종류",
    point,
    items: PART_KIND_OPTIONS.map((option) => ({
      action: () => pick(option.value),
      icon: PART_KIND_ICONS[option.value],
      id: `part-kind-${option.value}`,
      label: option.value === currentKind ? `${option.label} (현재)` : option.label,
      testId: `structure-kit-part-kind-option-${option.value}`,
    })),
  });
  const menu = document.querySelector<HTMLElement>('[data-testid="map-context-menu-structure-kit-part-kind"]');
  if (menu) {
    menu.dataset.testid = "structure-kit-part-kind-menu";
    menu.setAttribute("aria-label", "부위 종류 고르기");
    // `.map-context-menu` 의 층(z-index: --z-status)은 맵 셸 기준이라 편집기
    // 다이얼로그(--z-popover-high) 뒤에 깔린다. 이 쓰임만 한 층 올린다.
    menu.classList.add("structure-kit-part-kind-menu");
  }
  return true;
}

/** 아이콘 한 글자 버튼 — 부위 행의 ✎ · ✕. */
function partActionButton(
  glyph: string,
  label: string,
  testid: string,
  onClick: (event: Event) => void,
): HTMLElement {
  return el("button", {
    class: "structure-kit-editor-part-action",
    attrs: { type: "button", title: label, "aria-label": label },
    text: glyph,
    dataset: { testid },
    on: { click: onClick },
  });
}

/** 버튼에서 뜨는 팝오버의 기준점 — 키보드로 눌렀으면 clientX 가 0 이라 버튼 아래를 쓴다. */
function pointFromButtonEvent(event: Event): { readonly x: number; readonly y: number } {
  const mouse = event as MouseEvent;
  if (mouse.clientX || mouse.clientY) return { x: mouse.clientX, y: mouse.clientY };
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }
  return { x: 0, y: 0 };
}

function drawParts(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  session: EditorSession,
  redraw: () => void,
  commitKit: CommitKit,
): void {
  const parts = kit.parts ?? [];
  const rows: HTMLElement[] = [
    el("div", {
      class: "structure-kit-editor-parts-head",
      children: [
        el("div", { class: "structure-kit-editor-parts-title", text: `부위 (${parts.length})` }),
        // 인스펙터에 있던 [문에서 입구 추정]이 여기로 왔다 — 부위를 고치는 자리가 편집기다.
        el("button", {
          class: "btn small structure-kit-estimate",
          attrs: { type: "button" },
          text: "문에서 추정",
          dataset: { testid: "structure-kit-estimate-entrance" },
          on: {
            click: () => {
              const current = session.requireKit();
              if (!current) return;
              const estimated = autoEstimateEntranceParts(current);
              if (estimated.length === 0) {
                toast("문 타일을 찾지 못했습니다.", "info");
                return;
              }
              const merged = [
                ...(current.parts ?? []).filter((part) => part.kind !== "entrance"),
                ...estimated,
              ];
              commitKit(current, { ...current, parts: merged });
              toast(`입구 ${estimated.length}곳 추정 완료`, "ok");
              redraw();
            },
          },
        }),
      ],
    }),
  ];

  if (parts.length === 0) {
    rows.push(
      el("p", {
        class: "structure-kit-quiet",
        text: "[부위 그리기]로 캔버스를 끌면 종류를 고르는 창이 뜹니다.",
      }),
    );
  }

  // 부위 목록은 이제 폭 전체를 쓰므로 칩처럼 가로로 흐른다 — 세로는 캔버스에 양보한다.
  const chips = parts.map((part, index) =>
    el("div", {
      class: "structure-kit-editor-part-row",
      children: [
        el("span", { class: "structure-kit-editor-part-index", text: String(index + 1) }),
        el("span", { class: "structure-kit-editor-part-kind", text: partKindLabel(part.kind) }),
        el("span", {
          class: "structure-kit-editor-part-range",
          text: `(${part.dx},${part.dy}) ${part.w}×${part.h}`,
        }),
        partActionButton("✎", "부위 편집", `structure-kit-editor-part-edit-${part.id}`, (event) => {
          openPartKindMenu(pointFromButtonEvent(event), part.kind, (kind) => {
            const current = session.requireKit();
            if (!current) return;
            commitKit(current, updatePart(current, part.id, { kind }));
            redraw();
          });
        }),
        partActionButton("✕", "부위 삭제", `structure-kit-editor-part-delete-${part.id}`, () => {
          const current = session.requireKit();
          if (!current) return;
          commitKit(current, removePart(current, part.id));
          redraw();
        }),
      ],
    }),
  );
  if (chips.length > 0) rows.push(el("div", { class: "structure-kit-editor-parts-list", children: chips }));

  host.replaceChildren(...rows);
}

/**
 * 문 타일을 찾아 입구 부위를 추정한다. 인스펙터에서 옮겨 왔다 —
 * 부위를 만드는 자리와 고치는 자리가 갈려 있으면 사용자가 어디를 봐야 할지 모른다.
 */
function autoEstimateEntranceParts(kit: SectionStructureKitDef): StructureKitPart[] {
  const estimated: StructureKitPart[] = [];
  // 문 타일 id 예: 116, 146, 360 등 (RM2k3 도어 패턴)
  const DOOR_TILES = new Set([116, 146, 117, 147, 360, 361]);

  for (let y = 0; y < kit.rows.length; y += 1) {
    const row = kit.rows[y];
    if (!row) continue;
    for (let x = 0; x < kit.width; x += 1) {
      const tile = row.tiles[x] ?? -1;
      const upper = row.upperTiles?.[x] ?? -1;
      if (DOOR_TILES.has(tile) || DOOR_TILES.has(upper)) {
        estimated.push({
          id: `pt_${randomUuid()}`,
          kind: "entrance",
          dx: x,
          dy: Math.max(0, y - 1),
          w: 1,
          h: 3,
          note: "문 2칸 + 앞 1칸",
        });
      }
    }
  }
  return estimated;
}

/** 배지·목록의 마우스오버 문구. 축과 메모를 한 문장으로 합친다. */
function cellHintTitle(hint: StructureKitCellHint): string {
  const axis = hint.growth ? growthAxisLabel(hint.growth) : "메모";
  return hint.note ? `(${hint.dx},${hint.dy}) ${axis} — ${hint.note}` : `(${hint.dx},${hint.dy}) ${axis}`;
}

/** 팝오버가 없는 환경(노드 유닛 테스트)에서 쓰는 결정적 순환: 가로 → 세로 → 양방향 → 없음. */
function nextCellHintGrowth(current: StructureGrowthAxis | undefined): StructureGrowthAxis | null {
  if (current === undefined) return "horizontal";
  if (current === "horizontal") return "vertical";
  if (current === "vertical") return "both";
  return null;
}

/**
 * 한 칸의 증분 축을 고른다. 팝오버를 띄울 수 있으면 목록에서 고르게 하고,
 * 못 띄우는 환경이면 같은 값들을 정해진 순서로 순환한다 — 어느 쪽이든 축은 이 네 값뿐이다.
 */
function applyCellHintGrowth(
  cx: number,
  cy: number,
  point: { readonly x: number; readonly y: number },
  session: EditorSession,
  redraw: () => void,
  commitKit: CommitKit,
): void {
  const write = (growth: StructureGrowthAxis | null): void => {
    const target = session.requireKit();
    if (!target) return;
    commitKit(target, setCellHint(target, cx, cy, { growth }));
    redraw();
  };
  const current = session.requireKit();
  if (!current) return;
  const existing = cellHintAt(current, cx, cy);
  if (!openCellHintMenu(point, existing?.growth, write)) write(nextCellHintGrowth(existing?.growth));
}

/**
 * 증분 축 팝오버. 부위 종류 팝오버와 같은 위젯·같은 이유(클릭 지점 배치·바깥클릭/Esc·화살표 이동).
 * window 가 없는 환경에서는 false 를 돌려주고 호출부가 순환 경로로 넘어간다.
 */
function openCellHintMenu(
  point: { readonly x: number; readonly y: number },
  currentGrowth: StructureGrowthAxis | undefined,
  pick: (growth: StructureGrowthAxis | null) => void,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  openMapContextMenu({
    mapId: "structure-kit-cell-hint",
    mapName: "칸 힌트",
    point,
    items: [
      ...GROWTH_AXES.map((axis) => ({
        action: () => pick(axis),
        icon: axis === "vertical" ? "layers" : axis === "both" ? "composite" : "terrain",
        id: `cell-hint-${axis}`,
        label: axis === currentGrowth ? `${growthAxisLabel(axis)} (현재)` : growthAxisLabel(axis),
        testId: `structure-kit-editor-hint-option-${axis}`,
      })),
      {
        action: () => pick(null),
        icon: "close",
        id: "cell-hint-clear",
        label: "증분 축 지우기",
        testId: "structure-kit-editor-hint-option-clear",
      },
    ],
  });
  const menu = document.querySelector<HTMLElement>('[data-testid="map-context-menu-structure-kit-cell-hint"]');
  if (menu) {
    menu.dataset.testid = "structure-kit-editor-hint-menu";
    menu.setAttribute("aria-label", "칸 힌트 고르기");
    menu.classList.add("structure-kit-part-kind-menu");
  }
  return true;
}

/**
 * 칸 힌트 목록 — 칸마다 축과 **사람이 쓴 한 줄**이 붙는다.
 * 메모를 여기서 받는 이유: 이 문장이 AI 프롬프트에 그대로 실린다. 「가로로 증분 가능」 같은
 * 축 표현은 드롭다운이 담당하고, 「창 사이는 2칸 띄운다」처럼 축으로 못 적는 것은 이 칸이 받는다.
 */
function drawCellHints(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  session: EditorSession,
  redraw: () => void,
  commitKit: CommitKit,
): void {
  const hints = kit.cellHints ?? [];
  const rows: HTMLElement[] = [
    el("div", {
      class: "structure-kit-editor-parts-head",
      children: [
        el("div", {
          class: "structure-kit-editor-parts-title",
          text: `칸 힌트 (${hints.length})`,
        }),
      ],
    }),
  ];

  if (hints.length === 0) {
    rows.push(
      el("p", {
        class: "structure-kit-quiet",
        dataset: { testid: "structure-kit-editor-cell-hints-empty" },
        text: "[칸 힌트] 도구로 칸을 누르면 «가로로 증분 가능» 같은 축을 붙입니다. 벽처럼 끝없이 이어지는 부분에 씁니다.",
      }),
    );
  }

  const chips = hints.map((hint) =>
    el("div", {
      class: "structure-kit-editor-part-row",
      dataset: { testid: `structure-kit-editor-cell-hint-${hint.dx}-${hint.dy}` },
      children: [
        el("span", { class: "structure-kit-editor-part-range", text: `(${hint.dx},${hint.dy})` }),
        el("button", {
          class: "btn small structure-kit-editor-hint-axis",
          attrs: { type: "button", title: "증분 축 고르기" },
          text: hint.growth ? growthAxisLabel(hint.growth) : "축 없음",
          dataset: { testid: `structure-kit-editor-cell-hint-axis-${hint.dx}-${hint.dy}` },
          on: {
            click: (event: Event) => {
              applyCellHintGrowth(hint.dx, hint.dy, pointFromButtonEvent(event), session, redraw, commitKit);
            },
          },
        }),
        el("input", {
          class: "structure-kit-editor-hint-note",
          attrs: { type: "text", placeholder: "이 칸 설명", "aria-label": `(${hint.dx},${hint.dy}) 칸 설명` },
          value: hint.note ?? "",
          dataset: { testid: `structure-kit-editor-cell-hint-note-${hint.dx}-${hint.dy}` },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLInputElement)) return;
              const current = session.requireKit();
              if (!current) return;
              commitKit(current, setCellHint(current, hint.dx, hint.dy, { note: target.value || null }));
              redraw();
            },
          },
        }),
        partActionButton("✕", "칸 힌트 삭제", `structure-kit-editor-cell-hint-delete-${hint.dx}-${hint.dy}`, () => {
          const current = session.requireKit();
          if (!current) return;
          commitKit(current, removeCellHint(current, hint.dx, hint.dy));
          redraw();
        }),
      ],
    }),
  );
  if (chips.length > 0) rows.push(el("div", { class: "structure-kit-editor-parts-list", children: chips }));

  host.replaceChildren(...rows);
}

function drawAiTab(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
  commitKit: (before: SectionStructureKitDef, next: SectionStructureKitDef) => void,
): void {
  const current = session.draft ?? kit.ai ?? { description: "", placementRules: "", origin: "ai" as const };
  const pendingApproval = current.origin !== "user";

  const area = (label: string, testid: string, value: string, apply: (next: string) => void): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-ai-field",
      children: [
        el("span", { text: label }),
        el("textarea", {
          value,
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLTextAreaElement)) return;
              apply(target.value);
            },
          },
        }),
      ],
    });

  const draft: StructureKitAiMeta = { ...current };
  session.draft = draft;

  const repeatabilitySelect = el("select", {
    dataset: { testid: "structure-kit-editor-ai-repeatability" },
    children: REPEATABILITY_OPTIONS.map((option) =>
      el("option", {
        attrs: (draft.repeatability ?? "") === option.value
          ? { value: option.value, selected: "" }
          : { value: option.value },
        text: option.label,
      }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        // "미지정" 은 undefined 를 저장하는 게 아니라 키 자체를 지운다 — 다른 optional 메타
        // 필드와 같은 규약(예: bakeStructureKit 의 tags 처리)이다.
        if (target.value === "repeat" || target.value === "fixed") draft.repeatability = target.value;
        else delete draft.repeatability;
      },
    },
  });

  const roleSelect = el("select", {
    dataset: { testid: "structure-kit-editor-ai-role" },
    children: [
      el("option", {
        attrs: draft.role === undefined ? { value: "", selected: "" } : { value: "" },
        text: "미지정",
      }),
      ...AI_ROLES.map((role) =>
        el("option", {
          attrs: draft.role === role ? { value: role, selected: "" } : { value: role },
          text: aiRoleLabel(role),
        }),
      ),
    ],
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.value) draft.role = target.value as TileGroupRole;
        else delete draft.role;
      },
    },
  });

  const selectField = (label: string, select: HTMLElement): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-ai-field",
      children: [el("span", { text: label }), select],
    });

  /**
   * 쉼표로 나누는 문자열 목록 필드(태그·테마).
   * 칩 UI 로 하지 않은 이유: 값 어휘가 **열린 집합**이다 — 실내 테마 7종은 방 채우기 전용이고
   * 야외 구조물의 테마는 사람이 짓는다("사막 마을"). 고를 수 있는 값만 고르게 해야 하는 곳은
   * 배치 조건이고 그건 기계가 검사한다. 이쪽은 사람이 지은 말이라 닫아 둘 근거가 없다.
   */
  const listField = (
    label: string,
    testid: string,
    placeholder: string,
    values: readonly string[] | undefined,
    apply: (next: string[]) => void,
  ): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-ai-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "text", placeholder },
          value: (values ?? []).join(", "),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLInputElement)) return;
              apply(
                target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0),
              );
            },
          },
        }),
      ],
    });

  // 증분 축 — 「반복」 드롭다운이 표현하지 못하는 것을 맡는다: 그쪽은 가로 전용이다.
  // 이 값이 세로를 포함하면 stamp_structure_kit 의 세로 반복(repeatY)이 열린다.
  const growthSelect = el("select", {
    dataset: { testid: "structure-kit-editor-ai-growth" },
    children: GROWTH_AXIS_OPTIONS.map((option) =>
      el("option", {
        attrs: (draft.growthAxis ?? "") === option.value
          ? { value: option.value, selected: "" }
          : { value: option.value },
        text: option.label,
      }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        const axis = GROWTH_AXES.find((candidate) => candidate === target.value);
        if (axis) draft.growthAxis = axis;
        else delete draft.growthAxis;
      },
    },
  });

  // 홈 레이어. 자동 유도값을 같은 줄에 적어 둔다 — 「미지정」이 무엇으로 읽히는지 모르면
  // 사람은 이 칸을 건드릴 이유를 못 찾는다.
  const layerSelect = el("select", {
    dataset: { testid: "structure-kit-editor-ai-layer" },
    children: LAYER_HOME_OPTIONS.map((option) =>
      el("option", {
        attrs: (draft.layerHome ?? "") === option.value
          ? { value: option.value, selected: "" }
          : { value: option.value },
        text: option.label,
      }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.value === "lower" || target.value === "upper" || target.value === "perCell") {
          draft.layerHome = target.value;
        } else {
          delete draft.layerHome;
        }
      },
    },
  });

  // 배치 조건 — 「설명 / 배치 규칙」과 달리 **기계가 검사하는** 조건이다.
  // 여기서 hard 로 걸어 둔 조건을 어기면 사람이 팔레트로 찍어도, AI 가 stamp_structure_kit 을
  // 불러도 시공이 거부된다. 산문(배치 규칙)은 남겨 둔다 — 사람이 읽는 설명은 여전히 필요하다.
  const conditionsBlock = renderPlacementConditionEditor(draft, redraw);

  host.replaceChildren(
    el("div", {
      class: "structure-kit-editor-ai-head",
      children: [
        el("button", {
          class: "btn small",
          attrs: { type: "button" },
          text: "✨ AI 초안 받기",
          dataset: { testid: "structure-kit-editor-ai-draft" },
          on: { click: () => { void requestAiMetaDraft(kit, tileset, session, redraw); } },
        }),
        ...(pendingApproval
          ? [el("span", { class: "structure-kit-editor-ai-badge", text: "미승인" })]
          : []),
      ],
    }),
    area("설명", "structure-kit-editor-ai-description", draft.description, (next) => { draft.description = next; }),
    area("배치 규칙(설명용 문장)", "structure-kit-editor-ai-placement", draft.placementRules, (next) => { draft.placementRules = next; }),
    conditionsBlock,
    selectField("반복", repeatabilitySelect),
    selectField("증분 축 (무한 확장 방향)", growthSelect),
    selectField("분류", roleSelect),
    selectField(`레이어 (미지정이면 지금 그림은 ${layerHomeLabel(structureKitLayerHome(kit))})`, layerSelect),
    listField(
      "태그",
      "structure-kit-editor-ai-tags",
      "쉼표로 나눔 — 예: 벽, 방어, 석조",
      draft.tags,
      (next) => {
        if (next.length > 0) draft.tags = next;
        else delete draft.tags;
      },
    ),
    listField(
      "사용 테마",
      "structure-kit-editor-ai-themes",
      "쉼표로 나눔 — 예: bedroom, tavern, 사막 마을",
      draft.themes,
      (next) => {
        if (next.length > 0) draft.themes = next;
        else delete draft.themes;
      },
    ),
    el("button", {
      class: "btn primary",
      attrs: { type: "button" },
      text: "초안 수락 — 내가 보증",
      dataset: { testid: "structure-kit-editor-ai-accept" },
      on: {
        click: () => {
          const target = session.requireKit();
          if (!target) return;
          // 제로 부트스트랩: 여기가 origin 을 "user" 로 만드는 유일한 지점이다.
          // commitKit 을 지나야 한다. replaceStructureKit 을 직접 부르면 future 가 남아서,
          // 되돌리기 뒤에 수락하면 다음 다시하기가 사용자가 보증한 메타를 지운다.
          commitKit(target, { ...target, ai: { ...draft, origin: "user" } });
          session.draft = null;
          toast("AI 메타를 승인했습니다", "ok");
          redraw();
        },
      },
    }),
  );
}

/**
 * 배치 조건 편집기 — zone·방향·강도 세 개의 드롭다운 한 줄이 조건 하나다.
 *
 * 자유 텍스트를 파싱하지 않고 드롭다운으로만 받는 이유: 파싱은 실패하면 **조용히** 조건이
 * 사라지고, 사라진 조건은 "검사했는데 통과했다"와 구분되지 않는다. 고를 수 있는 값만 고르게 한다.
 *
 * `draft` 를 제자리에서 고친다 — 세션 초안 규약(수락 버튼을 눌러야 store 에 커밋)을 그대로 따른다.
 * 줄을 더하거나 지운 뒤에는 redraw 로 다시 그린다(초안은 session.draft 에 살아 있다).
 */
function renderPlacementConditionEditor(draft: StructureKitAiMeta, redraw: () => void): HTMLElement {
  const conditions = draft.placement ?? [];

  const zoneSelect = (condition: PlacementSurfaceCondition): HTMLElement =>
    el("select", {
      dataset: { testid: "structure-kit-editor-condition-zone" },
      attrs: { "aria-label": "배치 면" },
      children: PLACEMENT_ZONES.map((zone) =>
        el("option", {
          attrs: condition.zone === zone ? { value: zone, selected: "" } : { value: zone },
          text: placementZoneLabel(zone),
        }),
      ),
      on: {
        change: (event: Event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLSelectElement)) return;
          const zone = asPlacementZone(target.value);
          if (!zone) return;
          condition.zone = zone;
          // 방향은 `againstWall` 에서만 뜻이 있다 — 다른 면으로 바꾸면 키를 지운다.
          if (zone !== "againstWall") delete condition.facing;
          redraw();
        },
      },
    });

  const facingSelect = (condition: PlacementSurfaceCondition): HTMLElement =>
    el("select", {
      dataset: { testid: "structure-kit-editor-condition-facing" },
      attrs: { "aria-label": "어느 쪽이 벽" },
      children: PLACEMENT_FACINGS.map((facing) =>
        el("option", {
          attrs: (condition.facing ?? "any") === facing ? { value: facing, selected: "" } : { value: facing },
          text: facingLabel(facing),
        }),
      ),
      on: {
        change: (event: Event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLSelectElement)) return;
          const facing = asPlacementFacing(target.value);
          if (!facing) return;
          if (facing === "any") delete condition.facing;
          else condition.facing = facing;
          redraw();
        },
      },
    });

  const strengthSelect = (condition: PlacementSurfaceCondition): HTMLElement =>
    el("select", {
      dataset: { testid: "structure-kit-editor-condition-strength" },
      attrs: { "aria-label": "강도" },
      children: [
        el("option", {
          attrs: condition.strength === "hard" ? { value: "hard", selected: "" } : { value: "hard" },
          text: "필수 — 어기면 못 찍음",
        }),
        el("option", {
          attrs: condition.strength === "soft" ? { value: "soft", selected: "" } : { value: "soft" },
          text: "권장 — 경고만",
        }),
      ],
      on: {
        change: (event: Event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLSelectElement)) return;
          condition.strength = target.value === "soft" ? "soft" : "hard";
          redraw();
        },
      },
    });

  const row = (condition: PlacementSurfaceCondition, index: number): HTMLElement =>
    el("li", {
      class: "structure-kit-editor-condition-row",
      dataset: { testid: "structure-kit-editor-condition-row" },
      children: [
        zoneSelect(condition),
        // 방향 칸은 `againstWall` 에서만 뜻이 있으므로 그때만 보여 준다 — 안 쓰는 칸을
        // 비활성으로 남겨 두면 "왜 안 먹지"를 유발한다.
        ...(condition.zone === "againstWall" ? [facingSelect(condition)] : []),
        strengthSelect(condition),
        el("span", {
          class: "structure-kit-editor-condition-preview",
          text: describePlacementSurface(condition),
        }),
        el("button", {
          class: "btn small",
          attrs: { type: "button", title: "이 조건 지우기", "aria-label": "이 조건 지우기" },
          text: "✕",
          dataset: { testid: "structure-kit-editor-condition-remove" },
          on: {
            click: () => {
              draft.placement = conditions.filter((_, position) => position !== index);
              if (draft.placement.length === 0) delete draft.placement;
              redraw();
            },
          },
        }),
      ],
    });

  return el("div", {
    class: "structure-kit-editor-ai-field structure-kit-editor-conditions",
    dataset: { testid: "structure-kit-editor-conditions" },
    children: [
      el("span", { text: "배치 조건 (실제로 검사함)" }),
      el("p", {
        class: "structure-kit-editor-condition-hint",
        text: conditions.length === 0
          ? "조건이 없으면 아무 자리에나 찍힙니다. 예: [벽에 붙은 바닥] + [북쪽] + [필수] 로 걸면 북쪽이 벽이 아닌 자리에서는 찍히지 않습니다."
          : "«필수» 조건을 어기면 사람이 찍어도 AI 가 찍어도 거부됩니다.",
      }),
      el("ul", { class: "structure-kit-editor-condition-list", children: conditions.map(row) }),
      el("button", {
        class: "btn small",
        attrs: { type: "button" },
        text: "+ 조건 추가",
        dataset: { testid: "structure-kit-editor-condition-add" },
        on: {
          click: () => {
            draft.placement = [
              ...conditions,
              { id: `pc_${randomUuid()}`, strength: "hard", zone: "againstWall", facing: "north" },
            ];
            redraw();
          },
        },
      }),
    ],
  });
}

async function requestAiMetaDraft(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): Promise<void> {
  const existingNames = (store.getCurrent().tilesets[session.tilesetId]?.structureKits ?? [])
    .filter((candidate) => candidate.id !== kit.id)
    .map((candidate) => candidate.name ?? "구조물");

  toast("AI 초안을 요청하는 중...", "info");
  try {
    const result = await chatCompletion(loadAiConfig(), {
      messages: [
        {
          role: "system",
          // 공용 봉투 경유. includePolicy 는 끈다 — 산출물이 JSON 한 덩어리라 마무리 톤 규칙이 방해된다.
          // 성향은 켠다: 구조물 이름·배치 설명의 어투가 사람 취향을 따라야 한다.
          content: composeSystemPrompt({
            surface: "structure-kit",
            body:
              "너는 2D 타일 RPG 편집기의 구조물 어휘 사서다."
              + " 주어진 타일 행렬을 보고 이 구조물이 무엇이고 어디에 놓아야 하는지 기술한다."
              + " JSON 한 덩어리로만 답하고 다른 말은 붙이지 않는다.",
            includeMemory: true,
          }),
        },
        { role: "user", content: buildAiMetaDraftPrompt(kit, tileset, existingNames) },
      ],
    });
    const text = typeof result.message.content === "string"
      ? result.message.content
      : (result.message.content ?? [])
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("");
    const draft = parseAiMetaDraft(text);
    if (!draft) {
      // 폼을 비우지 않는다 — 사람이 쓰던 내용을 모델 실패로 날리지 않는다.
      toast("초안을 읽지 못했습니다. 직접 적어 주세요.", "error");
      return;
    }
    session.draft = draft;
    redraw();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`초안 요청 실패: ${message}`, "error");
  }
}
