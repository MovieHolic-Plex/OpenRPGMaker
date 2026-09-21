import {
  extendGroupDrag,
  groupCellClass,
  groupCellText,
  handleGroupTileClick,
  startGroupDrag,
  stopGroupDrag,
} from "@/editor/panels/tilesetGroupEditor";
import { cellTitle, hasAiMetadata, isUnlabeledTile } from "@/editor/panels/tilesetMetadataControls";
import { openTilesetTileContextMenu } from "@/editor/panels/tilesetTileContextMenu";
import { autotileHoverTileIds } from "@/editor/panels/tilesetAutotileEditor";
import { modeHelpText, type TilesetEditMode } from "@/editor/panels/tilesetUsageGuide";
import { tileLayerHome, type TileLayerHome } from "@/editor/tileLayerClassification";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { passageMarkForTile, type PassageMark } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ChipsetPreviewModel = {
  readonly tileset: TilesetDef;
  readonly mode: TilesetEditMode;
  readonly selectedTile: number;
  readonly rerender: () => void;
  readonly onApplyModeTile: (tile: number) => void;
  /** quiet: 스크롤 유지·리마운트 없이 selectedTile 만 갱신(우클릭 메뉴용). */
  readonly onSelectTile: (tile: number, options?: { readonly quiet?: boolean }) => void;
  /** Optional: open full-sheet passage modal from the preview chrome. */
  readonly onOpenFullSheet?: () => void;
  /** 미분류(라벨·설명 비어 있음) 타일만 강조 */
  readonly unlabeledOnly?: boolean;
  readonly passagePaint?: PassageMark;
  readonly highlightTileIds?: ReadonlySet<number>;
  readonly onPaintStrokeStart?: () => void;
  readonly onPaintStrokeEnd?: () => void;
};

type LayerFilter = "all" | "lower" | "upper";

/** 기본 2x — 한 화면에 더 많은 행. 전체 시트는 프리뷰 박스 안 스크롤.
 *  1x 는 30열 시트(480px)가 스크롤 없이 들어가는 유일한 배율 — 전체를 한눈에 볼 때 쓴다. */
const PREVIEW_SCALES = [1, 2, 3, 4] as const;
let previewScale: number = 2;
let passageDragActive = false;
let passagePaintedByPointer = false;
let passageDragModel: ChipsetPreviewModel | null = null;
let layerFilter: LayerFilter = "all";
let unlabeledOnlyFilter = false;
let previewPanState: PreviewPanState | null = null;

export function getUnlabeledOnlyFilter(): boolean {
  return unlabeledOnlyFilter;
}

export function setUnlabeledOnlyFilter(value: boolean): void {
  unlabeledOnlyFilter = value;
}

export function renderChipsetPreviewPanel(model: ChipsetPreviewModel): HTMLElement {
  return el("div", {
    class: "tileset-db-preview-wrap",
    dataset: { testid: "tileset-db-preview-wrap" },
    children: [renderPreviewHeader(model), renderChipsetPreview(model)],
  });
}

function renderPreviewHeader(model: ChipsetPreviewModel): HTMLElement {
  const unlabeledOn = model.unlabeledOnly ?? unlabeledOnlyFilter;
  const passageChrome = model.mode === "passage";
  const autotileChrome = model.mode === "autotile";
  return el("div", {
    class: `tileset-db-preview-header${passageChrome ? " passage-chrome" : ""}`,
    children: [
      el("div", {
        class: "tileset-db-preview-title-row",
        children: [
          // 예전에는 오토타일일 때 여기에 autotileComposerHint() 를 그대로 넣어서
          // 바로 위 도구 상자의 안내문과 똑같은 문장이 40px 간격으로 두 번 보였다.
          ...(passageChrome ? [] : [el("div", {
            class: "tileset-db-preview-title",
            text: "타일 그림판",
          })]),
          el("div", {
            class: "tileset-db-layer-filter",
            attrs: { role: "tablist", "aria-label": "레이어 필터" },
            dataset: { testid: "tileset-layer-filter" },
            children: [
              renderLayerFilterButton({ filter: "all", text: "전체", title: "하위·상위 전부 표시", model }),
              renderLayerFilterButton({ filter: "lower", text: "하위", title: "하위 레이어 타일만 강조", model }),
              renderLayerFilterButton({ filter: "upper", text: "상위", title: "상위 레이어 타일만 강조", model }),
              ...(passageChrome || autotileChrome
                ? []
                : [
                    el("button", {
                      class: unlabeledOn ? "active" : "",
                      text: "미분류",
                      attrs: {
                        type: "button",
                        role: "tab",
                        title: "라벨·설명이 비어 있는 타일만 강조",
                        "aria-selected": String(unlabeledOn),
                      },
                      dataset: { testid: "tileset-filter-unlabeled" },
                      on: {
                        click: () => {
                          unlabeledOnlyFilter = !unlabeledOnlyFilter;
                          stableRerender(model.rerender);
                        },
                      },
                    }),
                  ]),
            ],
          }),
        ],
      }),
      el("div", {
        class: "tileset-db-preview-scale",
        children: [
          ...PREVIEW_SCALES.map((scale) =>
            renderScaleButton({
              scale,
              text: `${scale}x`,
              title: scale === 1 ? "1배 (시트 전체가 한눈에)" : scale === 2 ? "2배 (기본)" : scale === 3 ? "3배" : "4배 (크게)",
              model,
            }),
          ),
          ...(passageChrome
            ? []
            : [
                renderScrollButton({ axis: "x", direction: -1, text: "←", title: "왼쪽으로 이동" }),
                renderScrollButton({ axis: "x", direction: 1, text: "→", title: "오른쪽으로 이동" }),
                renderScrollButton({ axis: "y", direction: -1, text: "↑", title: "위로 이동" }),
                renderScrollButton({ axis: "y", direction: 1, text: "↓", title: "아래로 이동" }),
              ]),
          ...(autotileChrome || !model.onOpenFullSheet
            ? []
            : [
                el("button", {
                  class: "tileset-db-fullsheet-btn",
                  text: "전체창",
                  attrs: { type: "button", title: "그림판 전체를 별도 창에서 통행(O/X/★) 편집" },
                  dataset: { testid: "tileset-settings-open" },
                  on: { click: () => model.onOpenFullSheet?.() },
                }),
              ]),
        ],
      }),
    ],
  });
}

function renderLayerFilterButton(model: {
  readonly filter: LayerFilter;
  readonly text: string;
  readonly title: string;
  readonly model: ChipsetPreviewModel;
}): HTMLButtonElement {
  return el("button", {
    class: layerFilter === model.filter ? "active" : "",
    text: model.text,
    attrs: {
      type: "button",
      role: "tab",
      title: model.title,
      "aria-selected": String(layerFilter === model.filter),
    },
    dataset: { testid: `tileset-layer-filter-${model.filter}` },
    on: {
      click: () => {
        layerFilter = model.filter;
        stableRerender(model.model.rerender);
      },
    },
  });
}

function renderScaleButton(model: {
  readonly scale: number;
  readonly text: string;
  readonly title: string;
  readonly model: ChipsetPreviewModel;
}): HTMLButtonElement {
  return el("button", {
    class: previewScale === model.scale ? "active" : "",
    text: model.text,
    attrs: { type: "button", title: model.title },
    dataset: { testid: `tileset-preview-scale-${model.scale}` },
    on: {
      click: () => {
        previewScale = model.scale;
        stableRerender(model.model.rerender);
      },
    },
  });
}

function renderScrollButton(model: {
  readonly axis: "x" | "y";
  readonly direction: -1 | 1;
  readonly text: string;
  readonly title: string;
}): HTMLButtonElement {
  return el("button", {
    class: "scroll",
    text: model.text,
    attrs: { type: "button", title: model.title },
    on: {
      click: () => scrollChipsetPreview(model.axis, model.direction),
    },
  });
}

function renderChipsetPreview(model: ChipsetPreviewModel): HTMLElement {
  const previewCell = model.tileset.tileSize * previewScale;
  const previewWidth = model.tileset.tilesPerRow * previewCell;
  const rows = Math.ceil(model.tileset.count / model.tileset.tilesPerRow);
  const previewHeight = rows * previewCell;
  return el("div", {
    class: "tileset-db-preview",
    dataset: { testid: "tileset-db-preview", layerFilter },
    attrs: {
      style: [
        `--tileset-cols:${model.tileset.tilesPerRow}`,
        `--tileset-cell:${previewCell}px`,
        `--tileset-width:${previewWidth}px`,
        `--tileset-height:${previewHeight}px`,
      ].join(";"),
    },
    children: [
      el("img", {
        attrs: {
          src: tilesetImageUrl(model.tileset),
          alt: `${model.tileset.name} 타일 그림판 (${model.tileset.count}칸)`,
          width: String(previewWidth),
          height: String(previewHeight),
        },
      }),
      el("div", {
        class: "tileset-db-click-grid",
        // 격자 시맨틱 + roving tabindex. 예전에는 480 칸이 전부 tabindex 0 이라
        // 시트를 지나 아래 이름 필드로 가려면 Tab 을 480 번 눌러야 했다.
        attrs: {
          role: "grid",
          "aria-label": `${model.tileset.name} 타일 격자 — 방향키로 이동, Enter 로 적용`,
          "aria-colcount": String(model.tileset.tilesPerRow),
          "aria-rowcount": String(rows),
        },
        children: Array.from({ length: model.tileset.count }, (_, index) => renderTileCell(model, index)),
        on: {
          keydown: (event) => {
            if (event instanceof KeyboardEvent) handleGridKeyDown(model, event);
          },
        },
      }),
      ...(model.mode === "passage"
        ? []
        : [
            el("div", {
              class: "tileset-db-preview-meta",
              dataset: { testid: "tileset-db-preview-meta" },
              attrs: { title: PREVIEW_SCROLL_HELP },
              text: previewMetaText(model, rows),
            }),
          ]),
    ],
    on: {
      auxclick: (event) => {
        if (event instanceof MouseEvent && event.button === 1) event.preventDefault();
      },
      mousedown: (event) => startPreviewPan(event),
    },
  });
}

/**
 * 시트 아래 상태줄.
 *
 * 예전에는 조작법까지 한 줄에 이어 붙여 964px 이 됐고 502px 만 보였다(48% 가 잘림,
 * 스크롤바도 없음). 상태(무엇이 보이는지)만 남기고 조작법은 title 로 뺀다.
 * 단위도 「칩」이 아니라 다른 곳과 같은 「칸」으로 맞춘다.
 */
function previewMetaText(model: ChipsetPreviewModel, rows: number): string {
  const filterLabel = layerFilter === "all" ? "전체 레이어" : layerFilter === "lower" ? "하위만" : "상위만";
  const unlabeledOn = model.unlabeledOnly ?? unlabeledOnlyFilter;
  const unlabeledLabel = unlabeledOn ? " · 미분류 강조" : "";
  return `${model.tileset.count}칸 · ${model.tileset.tilesPerRow}열×${rows}행 · ${previewScale}x · ${filterLabel}${unlabeledLabel} · ${modeHelpText(model.mode)}`;
}

const PREVIEW_SCROLL_HELP = "스크롤: 휠 · 방향키 · 가운데 버튼 드래그 (전체 시트)";

const PASSAGE_SPOKEN: Record<PassageMark, string> = { o: "통과", x: "막힘", star: "위 지나감" };

/** 격자 안 방향키 이동. 선택을 옮기고 포커스를 새 칸으로 넘긴다. */
function handleGridKeyDown(model: ChipsetPreviewModel, event: KeyboardEvent): void {
  const cols = model.tileset.tilesPerRow;
  const last = model.tileset.count - 1;
  const step =
    event.key === "ArrowRight" ? 1
    : event.key === "ArrowLeft" ? -1
    : event.key === "ArrowDown" ? cols
    : event.key === "ArrowUp" ? -cols
    : 0;
  let next = step === 0 ? -1 : model.selectedTile + step;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = last;
  if (event.key === "PageDown") next = Math.min(last, model.selectedTile + cols * 8);
  if (event.key === "PageUp") next = Math.max(0, model.selectedTile - cols * 8);
  if (next < 0 || next > last) return;
  event.preventDefault();
  model.onSelectTile?.(next, { quiet: true });
  paintSelectedCell(next);
  const cell = document.querySelector<HTMLElement>(`.tileset-db-click-grid [data-tile="${next}"]`);
  if (!cell) return;
  for (const node of document.querySelectorAll<HTMLElement>(".tileset-db-click-grid .tileset-db-cell")) {
    node.tabIndex = -1;
  }
  cell.tabIndex = 0;
  cell.focus();
  cell.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function tileCellAriaLabel(
  model: ChipsetPreviewModel,
  index: number,
  mark: PassageMark,
  home: TileLayerHome,
  unlabeled: boolean,
): string {
  const parts = [`타일 ${index}`];
  if (model.mode === "terrain") parts.push(`지형 ${model.tileset.terrain[index] ?? 0}`);
  else if (model.mode !== "autotile" && model.mode !== "group") parts.push(PASSAGE_SPOKEN[mark]);
  parts.push(layerHomeLabel(home));
  if (unlabeled) parts.push("미분류");
  return `${parts.join(", ")}. 우클릭 또는 컨텍스트 메뉴 키로 의미 편집`;
}

function renderTileCell(model: ChipsetPreviewModel, index: number): HTMLButtonElement {
  const mark = passageMarkForTile(model.tileset, index);
  const home = tileLayerHome(model.tileset, index);
  const selected = index === model.selectedTile ? " selected" : "";
  const unlabeledOn = model.unlabeledOnly ?? unlabeledOnlyFilter;
  const unlabeled = isUnlabeledTile(model.tileset, index);
  const dimmed = isLayerDimmed(home) || (unlabeledOn && !unlabeled) ? " layer-dimmed" : "";
  const unlabeledClass = unlabeled ? " unlabeled" : "";
  const autotileMember = model.mode === "autotile" && model.highlightTileIds?.has(index) ? " autotile-member" : "";
  const markClass = model.mode === "autotile" ? "" : ` mark-${mark}`;
  return el("button", {
    class: `tileset-db-cell${markClass} layer-${home}${selected}${dimmed}${unlabeledClass}${autotileMember}${model.mode === "group" ? groupCellClass(index) : ""}`,
    text: cellText(model, index),
    attrs: {
      type: "button",
      role: "gridcell",
      // 선택된 칸 하나만 Tab 순서에 남기고 나머지는 방향키로 옮긴다.
      tabindex: index === model.selectedTile ? "0" : "-1",
      title: `${cellTitle(model.tileset, index)} · ${layerHomeLabel(home)}${unlabeled ? " · 미분류" : ""} · 우클릭: 의미/통행/레이어`,
      // 통행 상태를 접근 가능한 이름에 넣는다. 예전에는 칠하기로 통행을 바꿔도 이 이름이
      // 그대로여서 보조기술 사용자에게는 이 화면의 본래 데이터가 아예 보이지 않았다.
      "aria-label": tileCellAriaLabel(model, index, mark, home, unlabeled),
    },
    dataset: {
      testid: `tileset-db-cell-${index}`,
      layer: home,
      tile: String(index),
      unlabeled: unlabeled ? "1" : "0",
    },
    on: {
      click: (event) => handleTileClick(model, index, event),
      contextmenu: (event) => handleTileContextMenu(model, index, event),
      pointerdown: (event) => handlePointerDown(model, index, event),
      mousedown: (event) => {
        // 우클릭(2)·중클릭(1)은 드래그/포커스 훔치기 금지 — 메뉴·팬만 담당.
        if (!(event instanceof MouseEvent) || event.button !== 0) return;
        event.preventDefault();
      },
      pointerenter: () => {
        handlePointerEnter(model, index);
        if (model.mode === "autotile") paintAutotileHover(autotileHoverTileIds(model.tileset, index));
      },
      pointerup: stopGroupDrag,
    },
  });
}

function isLayerDimmed(home: TileLayerHome): boolean {
  if (layerFilter === "all") return false;
  if (layerFilter === "lower") return home === "upper";
  return home === "lower";
}

function layerHomeLabel(home: TileLayerHome): string {
  if (home === "upper") return "상위 레이어";
  if (home === "lower") return "하위 레이어";
  return "양쪽 레이어";
}

function handleTileContextMenu(model: ChipsetPreviewModel, tile: number, event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  // 전체 패널 리마운트 금지 — 스크롤이 튀며 화면이 움직이는 원인.
  model.onSelectTile(tile, { quiet: true });
  // 선택 하이라이트만 DOM 에서 갱신 (리렌더 없이)
  paintSelectedCell(tile);
  const mouse = event instanceof MouseEvent ? event : null;
  openTilesetTileContextMenu({
    tilesetId: model.tileset.id,
    tile,
    clientX: mouse?.clientX ?? 0,
    clientY: mouse?.clientY ?? 0,
    rerender: () => stableRerender(model.rerender),
  });
}

function paintAutotileHover(ids: ReadonlySet<number>): void {
  const root = document.querySelector(".tileset-db-click-grid");
  if (!root) return;
  for (const node of root.querySelectorAll(".autotile-hover")) {
    node.classList.remove("autotile-hover");
  }
  for (const tile of ids) {
    root.querySelector(`[data-tile="${tile}"]`)?.classList.add("autotile-hover");
  }
}

function paintSelectedCell(tile: number): void {
  const root = document.querySelector(".tileset-db-click-grid");
  if (!root) return;
  for (const node of root.querySelectorAll(".tileset-db-cell.selected")) {
    node.classList.remove("selected");
  }
  const cell = root.querySelector(`[data-tile="${tile}"]`);
  cell?.classList.add("selected");
}

function handleTileClick(model: ChipsetPreviewModel, tile: number, event: Event): void {
  event.preventDefault();
  const rerender = () => stableRerender(model.rerender);
  if (model.mode === "group") {
    model.onSelectTile(tile, { quiet: true });
    handleGroupTileClick(tile, event, rerender);
    return;
  }
  if (model.mode === "ai") {
    model.onSelectTile(tile);
    return;
  }
  if (model.mode === "passage") {
    model.onSelectTile(tile, { quiet: true });
    paintSelectedCell(tile);
    if (!passagePaintedByPointer) {
      model.onPaintStrokeStart?.();
      model.onApplyModeTile(tile);
      model.onPaintStrokeEnd?.();
      paintPassageCell(tile, model.passagePaint ?? "o");
      rerender();
    }
    passagePaintedByPointer = false;
    return;
  }
  if (model.mode === "terrain") {
    model.onSelectTile(tile, { quiet: true });
    model.onApplyModeTile(tile);
    rerender();
    return;
  }
  if (model.mode === "autotile") {
    model.onSelectTile(tile, { quiet: true });
    paintSelectedCell(tile);
    model.onApplyModeTile(tile);
    rerender();
    return;
  }
  model.onSelectTile(tile);
}

function handlePointerDown(model: ChipsetPreviewModel, tile: number, event: Event): void {
  // 우클릭·중클릭은 드래그 시작 금지
  if (event instanceof PointerEvent && event.button !== 0) return;
  if (event instanceof MouseEvent && event.button !== 0) return;
  event.preventDefault();
  if (model.mode === "group") startGroupDrag(tile, event, () => stableRerender(model.rerender));
  if (model.mode === "passage") startPassageDrag(model, tile);
}

function handlePointerEnter(model: ChipsetPreviewModel, tile: number): void {
  if (model.mode === "group") {
    model.onSelectTile(tile, { quiet: true });
    extendGroupDrag(tile, () => stableRerender(model.rerender));
  }
  if (model.mode === "passage") extendPassageDrag(tile);
}

function startPassageDrag(model: ChipsetPreviewModel, tile: number): void {
  passageDragActive = true;
  passagePaintedByPointer = true;
  passageDragModel = model;
  model.onPaintStrokeStart?.();
  model.onSelectTile(tile, { quiet: true });
  model.onApplyModeTile(tile);
  paintPassageCell(tile, model.passagePaint ?? "o");
  paintSelectedCell(tile);
  window.addEventListener("pointerup", stopPassageDrag, { once: true });
  window.addEventListener("pointercancel", stopPassageDrag, { once: true });
}

function extendPassageDrag(tile: number): void {
  if (!passageDragActive || !passageDragModel) return;
  passageDragModel.onSelectTile(tile, { quiet: true });
  passageDragModel.onApplyModeTile(tile);
  paintPassageCell(tile, passageDragModel.passagePaint ?? "o");
  paintSelectedCell(tile);
}

function stopPassageDrag(): void {
  if (!passageDragActive) return;
  passageDragActive = false;
  const model = passageDragModel;
  passageDragModel = null;
  model?.onPaintStrokeEnd?.();
  if (model) stableRerender(model.rerender);
}

/**
 * 통행 표시는 세 상태 모두 글리프를 가진다.
 *
 * 예전에는 통과가 "글자 없음"이었다. 그러면 「통과」와 「칩이 어두워서 표시가 안 보임」이
 * 구별되지 않는다 — 실제로 던전 계열 어두운 칩 위에서 검은 X 가 사라져 어느 쪽인지 알 수
 * 없었다. 세 상태 모두 글리프를 두고, 대비는 CSS 의 흰 글자 + 어두운 외곽선이 책임진다.
 */
export function passageGlyph(mark: PassageMark): string {
  if (mark === "star") return "★";
  return mark === "o" ? "·" : "✕";
}

function paintPassageCell(tile: number, mark: PassageMark): void {
  const cell = document.querySelector(`[data-tile="${tile}"]`);
  if (!(cell instanceof HTMLElement)) return;
  cell.classList.remove("mark-o", "mark-x", "mark-star");
  cell.classList.add(`mark-${mark}`);
  cell.textContent = passageGlyph(mark);
  // 칠하는 즉시 접근 가능한 이름도 새 통행 상태로 바꾼다.
  const previous = cell.getAttribute("aria-label") ?? "";
  const next = previous.replace(/(^타일 \d+, )(통과|막힘|위 지나감)/, `$1${PASSAGE_SPOKEN[mark]}`);
  if (next !== previous) cell.setAttribute("aria-label", next);
}

function cellText(model: ChipsetPreviewModel, tile: number): string {
  if (model.mode === "terrain") return String(model.tileset.terrain[tile] ?? 0);
  if (model.mode === "ai") return hasAiMetadata(model.tileset, tile) ? "AI" : "";
  if (model.mode === "group") return groupCellText(model.tileset, tile);
  if (model.mode === "autotile") return "";
  return passageGlyph(passageMarkForTile(model.tileset, tile));
}

/** 테스트/디버그용: 현재 프리뷰 배율 */
export function getTilesetPreviewScale(): number {
  return previewScale;
}

function scrollChipsetPreview(axis: "x" | "y", direction: -1 | 1): void {
  const preview = document.querySelector(".tileset-db-preview");
  if (!preview) return;
  if (axis === "x") {
    const distance = Math.max(Math.floor(preview.clientWidth * 0.8), 160);
    preview.scrollLeft += direction * distance;
    return;
  }
  const distance = Math.max(Math.floor(preview.clientHeight * 0.8), 120);
  preview.scrollTop += direction * distance;
}

type PreviewPanState = {
  readonly preview: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
};

function startPreviewPan(event: Event): void {
  // 중클릭(휠 버튼)만 팬 — 우클릭(2)·좌클릭(0)은 절대 팬/스크롤 시작 안 함.
  if (!(event instanceof MouseEvent) || event.button !== 1 || !(event.currentTarget instanceof HTMLElement)) return;
  event.preventDefault();
  event.stopPropagation();
  previewPanState = {
    preview: event.currentTarget,
    scrollLeft: event.currentTarget.scrollLeft,
    scrollTop: event.currentTarget.scrollTop,
    startX: event.clientX,
    startY: event.clientY,
  };
  event.currentTarget.classList.add("panning");
  window.addEventListener("mousemove", handlePreviewPanMove);
  window.addEventListener("mouseup", stopPreviewPan);
}

function handlePreviewPanMove(event: MouseEvent): void {
  if (!previewPanState) return;
  previewPanState.preview.scrollLeft = previewPanState.scrollLeft - (event.clientX - previewPanState.startX);
  previewPanState.preview.scrollTop = previewPanState.scrollTop - (event.clientY - previewPanState.startY);
}

function stopPreviewPan(): void {
  previewPanState?.preview.classList.remove("panning");
  previewPanState = null;
  window.removeEventListener("mousemove", handlePreviewPanMove);
  window.removeEventListener("mouseup", stopPreviewPan);
}

type ScrollSnapshot = {
  readonly selector: string;
  readonly left: number;
  readonly top: number;
};

function stableRerender(rerender: () => void): void {
  const snapshots = captureScrollSnapshots();
  rerender();
  restoreScrollSnapshots(snapshots);
  if (typeof window === "undefined") return; // fakeDom 테스트 환경.
  window.requestAnimationFrame(() => restoreScrollSnapshots(snapshots));
  window.setTimeout(() => restoreScrollSnapshots(snapshots), 0);
}

function captureScrollSnapshots(): readonly ScrollSnapshot[] {
  return [".database-modal-body", ".tileset-db-preview"]
    .map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      return { selector, left: element.scrollLeft, top: element.scrollTop };
    })
    .filter((snapshot): snapshot is ScrollSnapshot => snapshot !== null);
}

function restoreScrollSnapshots(snapshots: readonly ScrollSnapshot[]): void {
  for (const snapshot of snapshots) {
    const element = document.querySelector(snapshot.selector);
    if (!element) continue;
    element.scrollLeft = snapshot.left;
    element.scrollTop = snapshot.top;
  }
}
