import { el, clearChildren } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import type { Layer } from "@/editor/editorState";
import { recentTilesView, recordRecentTile } from "@/editor/panels/tileBrushTools";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { makePaintShapeSelect } from "@/editor/panels/tileToolOptions";
import { makeSidebarMapHeader } from "@/editor/panels/sidebarMapHeader";
import { makeSidebarSurface } from "@/editor/panels/sidebarSurface";
import { isDefaultTilesetTexture, tilesetImageUrl, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { TILE_GRAFT_IMAGE_BAKED_EVENT } from "@/assets/tileGraftImageCache";
import { openTilePropsDialog } from "@/editor/panels/tilePropsDialog";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { makeStructureKitShelf } from "@/editor/harnessSuggestion/structureKitShelf";
import { makeComboBrushShelf } from "@/editor/panels/comboBrushShelf";
import { makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { makeTileBrushControls } from "@/editor/panels/tilePaletteStampStatus";
import { selectPaletteStamp } from "@/editor/panels/tileToolbarActions";
import { dismissLocationDrawModeForTool } from "@/editor/locationDrawMode";
import {
  applyPaletteSheetImage,
  makeCustomPalette,
  setCustomPaletteFilter,
  setVirtualPaletteActive,
  revealVirtualPaletteTile,
  makeGridPalette,
  gridPaletteDisplayTile,
  gridPaletteVisibleCount,
} from "@/editor/panels/tilePaletteGrid";
import {
  TILE_CATEGORIES,
  filterTileIndexes,
  type TileCategoryId,
} from "@/editor/panels/tilePaletteFilter";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { isCustomTileset } from "@/project/tilesetKind";
import { uiLabel } from "@/editor/uiCopy";
import { toast } from "@/util/toast";
import { captureFocus, restoreFocus, applyRovingTabindex } from "@/editor/panels/sidebarFocus";

// ── 좌패널 1면 통합 (2026-08-21) ──────────────────────────────────────────────
// 예전에는 「칠하기 | 찾기 | 속성」 3탭이었다. 감독 지적("칠하기만 있으면 되는 거
// 아닌가")대로 3탭 중 2개가 칠하기가 아니었고, 실측 결함이 붙어 있었다:
//   · 찾기  = 팔레트 2차 구현. 별개 셀·별개 그리드·96개 상한, 오토타일 대표 1칸
//             규칙 미적용 → 같은 타일 그림판이 탭에 따라 다르게 보였다. 게다가 고른 타일을
//             그 자리에서 칠할 수 없었다(그리기 툴바가 칠하기 탭에만 있었다).
//   · 속성  = 타일셋 저작 표면. 지면 종류 입력이 **두 개**였고(인스펙터 안 + 탭 하단),
//             `describeChipsetTile` 가드가 없어 기본 타일 그림판이 아닌 타일셋에서 메타가
//             전부 오답이었다. 빈 상태 안내는 "다른 탭으로 가라"였다.
//   · 붓의 동작을 바꾸는 연결 Auto/Manual 토글이 칠할 때 보이지 않았다.
// 이제 한 면이다: 선택칩 → 도구 → 필터 한 줄 → 팔레트 → 붓 보조 → 타일 속성 → 킷.
// 탭 전환 0회. 검색·카테고리는 팔레트 자체를 필터링한다.

// 분류 목록과 필터 계산은 panels/tilePaletteFilter.ts 로 옮겼다 — 구조물 편집기도 같은
// 검색·분류를 쓰는데, 여기 있던 비공개 함수는 아래 모듈 전역을 직접 읽어서 그대로
// 공유하면 두 팔레트의 필터 상태가 함께 움직인다. 상태는 이 파일이 계속 들고,
// 계산만 넘긴다.

let activeTileCategory: TileCategoryId = "all";
let tileSearchQuery = "";
const TILE_SEARCH_RENDER_DELAY_MS = 120;
let tileSearchRenderTimer: ReturnType<typeof setTimeout> | null = null;
let showQuickTileNumbers = false;
/** 맵 우클릭 스포이트 후 팔레트 타일 그림판 셀로 스크롤 (전문가 모드). */
let pendingRevealSelectedTile = false;
let resetChipsetScroll = false;

type PaletteScroll = {
  readonly containerLeft: number;
  readonly containerTop: number;
  readonly sheetLeft: number;
  readonly sheetTop: number;
};

/**
 * 칸 집합이 같을 때 시트 노드를 유지한다. 도구·붓·선택은 크롬만 다시 그린다.
 *
 * 키에 **넣지 않는 것**(2026-09-30 렉 수정): 그림 주소(타일 이식 베이크가 끝나면 바뀌지만 판의 CSS 변수
 * 하나만 갈면 된다 — applyPaletteSheetImage), 그리고 커스텀 판의 레이어·분류·검색어(칸 집합이 그 셋과
 * 무관하고 안 맞는 칸을 흐리게만 하므로 setCustomPaletteFilter 가 클래스만 맞춘다). 커스텀 1140칸을
 * 레이어·필터 전환마다 다시 짓던 것이 사라진다. 기본 리플로우 판은 칸 집합 자체가 레이어·필터로 바뀌므로 넣는다.
 */
function paintSheetRetainKey(tileset: TilesetDef, layer: Exclude<Layer, "event">): string {
  if (isCustomTileset(tileset)) return [tileset.id, tileset.count, tileset.tilesPerRow, "custom"].join("|");
  return [tileset.id, tileset.count, tileset.tilesPerRow, layer, activeTileCategory, tileSearchQuery, "grid"].join("|");
}

/** 필터가 켜져 있으면 기본 판은 칸 집합이 달라져 못 살린다. 커스텀 판은 언제나 살린다. */
function canRetainPalette(tileset: TilesetDef): boolean {
  return isCustomTileset(tileset) || !isFilterActive();
}

/**
 * 살릴 시트가 있으면 그 시트를 **DOM 에 둔 채** 돌려준다(떼지 않는다).
 *
 * 왜 (2026-09-30 실측, 기본 칩셋 1140칸): 예전에는 시트를 떼어 새 셸에 다시 붙였다. 떼는 순간 1140개 칸과
 * 자식 요소의 스타일·레이아웃 정보가 버려져, 맵 전환·레이어 전환마다 「Removed from layout / Added to layout」
 * 1139건 + UpdateLayoutTree 40ms 안팎이 다시 돌았다(같은 시트인데도). 이제 낡은 셸·판(pane)은 그대로 두고
 * 시트 앞뒤 형제만 새로 짠 것으로 바꾼다(swapPaneAroundSheet) — 시트는 한 번도 DOM 을 떠나지 않는다.
 * 셸 구조가 예상과 다르면(도크에 다른 자식이 있는 등) null → 예전 경로(전체 재생성)로 간다.
 */
interface InPlacePalette {
  readonly shell: HTMLElement;
  readonly pane: HTMLElement;
  readonly sheet: HTMLElement;
}

function findInPlacePalette(container: HTMLElement, key: string): InPlacePalette | null {
  if (container.childNodes.length !== 1) return null;
  const shell = container.firstElementChild;
  if (!(shell instanceof HTMLElement) || shell.dataset.testid !== "palette-work-shell") return null;
  if (shell.childNodes.length !== 1) return null;
  const pane = shell.firstElementChild;
  if (!(pane instanceof HTMLElement) || pane.dataset.testid !== "palette-work-pane-paint") return null;
  const sheet = Array.from(pane.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.testid === "tile-palette",
  );
  if (!sheet || sheet.dataset.retainKey !== key) return null;
  return { shell, pane, sheet };
}

/** 낡은 판에서 시트만 남기고, 새 판의 자리표시자 앞뒤 자식을 시트 앞뒤로 옮긴다. */
function swapPaneAroundSheet(pane: HTMLElement, sheet: HTMLElement, next: HTMLElement, slot: Node): void {
  for (const child of Array.from(pane.childNodes)) {
    if (child !== sheet) child.remove();
  }
  const before: Node[] = [];
  const after: Node[] = [];
  let seenSlot = false;
  for (const child of Array.from(next.childNodes)) {
    if (child === slot) { seenSlot = true; continue; }
    (seenSlot ? after : before).push(child);
  }
  for (const node of before) pane.insertBefore(node, sheet);
  for (const node of after) pane.append(node);
}

/**
 * 도크 갱신이 마지막으로 그린 팔레트의 입력. 같은 입력이면 다시 짓지 않는다.
 *
 * 왜 (2026-09-27 실측): `editor.ts refreshPanels` 는 셀 없는 맵 변경(이름·이벤트)·assets·project
 * 통지·이벤트 선택마다 좌측 도크를 통째로 다시 그렸다. 팔레트는 그 값들을 읽지 않는데도
 * 매번 셸을 버리고 새로 지었다. 이제 아래 입력이 그대로면 건너뛴다. 타일셋은 안 바뀌면 같은
 * 객체를 유지하므로(store.update 의 cloneProjectForMutation) 객체 비교로 충분하다.
 * 팔레트 안의 컨트롤(필터·보조 창 등)은 renderTilePalette 를 직접 불러 항상 다시 그린다.
 */
const renderedPaletteInputs = new WeakMap<HTMLElement, { readonly shell: Element; readonly inputs: readonly unknown[] }>();

/** 타일 레이어 팔레트가 읽는 값. 이벤트 레이어(이벤트 목록)는 맵 내용을 읽으므로 null — 항상 그린다. */
function paletteRenderInputs(): readonly unknown[] | null {
  const state = editorState.get();
  if (state.layer === "event") return null;
  const project = store.getCurrent();
  const map = project.maps[state.currentMapId ?? project.startMapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return null;
  return [
    // 맵 헤더는 맵 도크가 있는지에 따라 모양이 다르다(sidebarMapHeader.ts).
    document.querySelector('[data-testid="left-map-root"]') !== null,
    map.id,
    map.name,
    tileset,
    // 타일 이식 베이크가 끝나면 같은 타일셋이어도 그림 주소가 바뀐다.
    tilesetImageUrl(tileset),
    state.layer,
    state.tool,
    state.paintShape,
    state.selectedTile,
    state.autoConnectMode,
    state.clusterAssistMode,
    state.activePaletteStamp,
    state.brushSize,
    state.reliefMode,
    state.reliefLevel,
    activeTileCategory,
    tileSearchQuery,
    showQuickTileNumbers,
  ];
}

/**
 * 도크(panelRegistry)가 부르는 진입점. 마지막으로 그린 입력과 같고 그 셸이 아직 붙어 있으면
 * 아무것도 하지 않는다. 보조 창이 열려 있으면(사용 위치 등 맵 내용을 보여 준다) 그대로 그린다.
 */
export function refreshTilePalette(container: HTMLElement): void {
  if (!container.querySelector("[data-sidebar-surface]")) {
    const rendered = renderedPaletteInputs.get(container);
    const inputs = rendered && rendered.shell.parentElement === container ? paletteRenderInputs() : null;
    if (rendered && inputs && inputs.length === rendered.inputs.length && inputs.every((value, index) => value === rendered.inputs[index])) return;
  }
  renderTilePalette(container);
}

// 타일 이식 베이크는 첫 그리기 뒤에 끝난다(기본 칩셋 이식 553칸). 예전에는 상관없는 통지의 재생성이
// 구운 그림을 우연히 주웠다. 이제 그런 재생성이 없으므로 베이크 완료를 직접 받는다 — 그림 주소가
// 입력에 들어 있어 바뀐 때만 한 번 다시 그린다.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener(TILE_GRAFT_IMAGE_BAKED_EVENT, () => {
    const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
    if (root && renderedPaletteInputs.has(root)) preservePaletteViewport(() => refreshTilePalette(root));
  });
}

export function renderTilePalette(container: HTMLElement): void {
  renderedPaletteInputs.delete(container);
  const focusSnapshot = captureFocus(container);
  const state = editorState.get();
  let inPlace: InPlacePalette | null = null;
  if (state.layer !== "event") {
    const project = store.getCurrent();
    const map = project.maps[state.currentMapId ?? project.startMapId];
    const tileset = map ? project.tilesets[map.tilesetId] : undefined;
    if (tileset && canRetainPalette(tileset)) {
      inPlace = findInPlacePalette(container, paintSheetRetainKey(tileset, state.layer));
    }
  }
  // 시트가 제자리에 남으면 스크롤도 그대로다 — 스크롤 읽기(강제 레이아웃 ~65ms)와 복원을 건너뛴다.
  const previousPaletteScroll = inPlace ? null : readPaletteScroll(container);
  if (!inPlace) clearChildren(container);

  if (state.layer === "event") {
    // 레이어 전환은 캔버스가 소유한다. 여기서는 공통 셸 안의 내용을 이벤트 목록으로 바꾼다.
    const project = store.getCurrent();
    const mapId = state.currentMapId ?? project.startMapId;
    const map = project.maps[mapId];
    const tileset = map ? project.tilesets[map.tilesetId] : undefined;
    const shell = el("div", {
      class: "panel-section palette-work-shell is-single-surface",
      dataset: { testid: "palette-work-shell" },
    });
    const root = el("div", {
      class: "palette-work-pane is-event",
      dataset: { testid: "palette-work-pane-event" },
    });
    if (map) root.append(makeSidebarMapHeader(map, renderPalettePreservingViewport));
    if (map && tileset) {
      root.append(makeTileToolbar({ map, rerender: renderPalettePreservingViewport, state, tileset }));
    }
    renderEventEditor(root);
    // 검사 컨트롤(⋯ 오버플로·핀)은 도구막대 행 끝에 있다(tileToolbar.ts) — 사이드바 아래 줄은 비웠다.
    shell.append(root);
    container.append(shell);
    applyRovingTabindex(container);
    restoreFocus(container, focusSnapshot);
    return;
  }

  // event 분기 이후 타일 레이어로 좁힌다 (시트/클러스터 API가 lower|upper만 받음).
  const tileLayer: Exclude<Layer, "event"> = state.layer;

  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const shell = el("div", {
    class: "panel-section palette-work-shell is-single-surface",
    dataset: { testid: "palette-work-shell" },
  });
  if (!map) {
    shell.append(el("div", { class: "empty-hint", text: "맵을 선택하세요." }));
    container.append(shell);
    applyRovingTabindex(container);
    restoreFocus(container, focusSnapshot);
    return;
  }
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) {
    shell.append(el("div", { class: "empty-hint", text: uiLabel("tilesetMissing") }));
    container.append(shell);
    applyRovingTabindex(container);
    restoreFocus(container, focusSnapshot);
    return;
  }

  const body = makePaletteSurface({ map, state, tileLayer, tileset, retainedSheet: inPlace ? inPlace.sheet : null });
  let liveShell: Element = shell;
  if (inPlace && body.sheetSlot) {
    swapPaneAroundSheet(inPlace.pane, inPlace.sheet, body.root, body.sheetSlot);
    liveShell = inPlace.shell;
  } else {
    shell.append(body.root);
    container.append(shell);
  }
  const palette: HTMLElement | null = body.palette;

  const inputs = paletteRenderInputs();
  if (inputs) renderedPaletteInputs.set(container, { shell: liveShell, inputs });
  applyRovingTabindex(container);
  restoreFocus(container, focusSnapshot);
  if (palette && previousPaletteScroll) restorePaletteScroll(container, palette, previousPaletteScroll);
  if (pendingRevealSelectedTile) {
    pendingRevealSelectedTile = false;
    const tile = state.selectedTile;
    window.requestAnimationFrame(() => revealChipsetTileInPalette(tile));
  }
}

/**
 * 선택 타일 + 타일셋 이름을 한 줄 칩으로 — 구 palette-tileset-badge(별도 줄)를 흡수했다.
 *
 * 칩의 두 글자 조각은 둘 다 **눌리는 것**이다(2026-09-03). 그전에는 ⚙ 만 버튼이고 나머지는
 * 텍스트여서, 버튼처럼 테두리 친 칩에서 타일셋 이름을 눌러도 아무 일이 없었다 — 사용자가
 * "타일 세트를 눌러도 반응이 없다"고 한 그 자리다.
 *  · 타일 이름 → 시트를 그 타일 위치로 스크롤(스포이트와 같은 리빌).
 *  · 타일셋 이름 → 「맵 설정」을 열고 「타일 그림판」 선택에 초점. 타일셋을 바꾸는 집은 그 창
 *    하나이므로(헤더 IA 「한 동작에 집 하나」) 여기서 두 번째 선택기를 만들지 않는다.
 */
function selectedTileStatusKey(
  tileset: TilesetDef,
  map: { readonly id: string; readonly name: string },
  hasTile: boolean,
): string {
  return `${tileset.id}|${tileset.name}|${map.id}|${map.name}|${hasTile ? 1 : 0}`;
}

/**
 * 선택 칩을 DOM 교체 없이 갱신한다. 이 칩을 replaceWith 로 바꾸면 그 삽입·제거가 문서 전체 스타일 재계산
 * (실측 ~2,400개 요소, ~50ms)을 부르지만 텍스트·속성 변경은 0.3ms 다. 타일셋·맵·「타일 있음」 여부가
 * 같을 때만 재사용하고, 아니면 false 를 돌려 호출부가 새로 지어 갈아 끼운다.
 */
function updateSelectedTileStatus(
  chip: HTMLElement,
  selectedTile: number,
  tileset: TilesetDef,
  map: { readonly id: string; readonly name: string },
): boolean {
  const hasTile = selectedTile >= 0 && selectedTile < tileset.count;
  if (chip.dataset.statusKey !== selectedTileStatusKey(tileset, map, hasTile)) return false;
  const labelButton = chip.querySelector<HTMLElement>(".selected-tile-label");
  if (!labelButton) return false;
  const name = hasTile ? quickTileName(tileset, selectedTile) : "";
  const label = !hasTile ? "공백" : name.startsWith(`${selectedTile} `) ? name : `${selectedTile} ${name}`;
  if (hasTile) {
    const thumb = chip.querySelector<HTMLElement>(".selected-tile-thumb");
    if (!thumb) return false;
    thumb.setAttribute("style", tilesetTileBackgroundStyle(tileset, selectedTile, 24));
  }
  chip.dataset.selectedTile = String(selectedTile);
  chip.title = `선택 타일: ${label} · 타일셋: ${tileset.name}`;
  // textContent 대입은 자식 노드를 갈아 끼워(삽입·제거) 전체 재계산을 부른다 — 글 노드의 data 만 바꾼다.
  const labelText = labelButton.firstChild;
  if (labelText instanceof Text && labelButton.childNodes.length === 1) labelText.data = label;
  else labelButton.textContent = label;
  labelButton.setAttribute("aria-label", hasTile ? `선택 타일 ${label} — 팔레트에서 위치 보기` : "선택 타일 없음");
  return true;
}

function makeSelectedTileStatus(
  selectedTile: number,
  tileset: TilesetDef,
  map: { readonly id: string; readonly name: string },
): HTMLElement {
  const hasTile = selectedTile >= 0 && selectedTile < tileset.count;
  // 기본 타일 그림판 라벨(tileDisplayLabelForIndex)은 이미 "360 흙길 중심"처럼 번호로 시작 — 번호 중복 표기를 막는다.
  const name = hasTile ? quickTileName(tileset, selectedTile) : "";
  const label = !hasTile ? "공백" : name.startsWith(`${selectedTile} `) ? name : `${selectedTile} ${name}`;
  const chip = el("div", {
    class: "selected-tile-status",
    attrs: { title: `선택 타일: ${label} · 타일셋: ${tileset.name}` },
    dataset: {
      testid: "selected-tile-status",
      // 제자리 갱신(updateSelectedTileStatus)이 같은 칩을 재사용해도 되는지 가르는 열쇠와, 클릭이 읽는 현재 값.
      statusKey: selectedTileStatusKey(tileset, map, hasTile),
      selectedTile: String(selectedTile),
    },
  });
  if (hasTile) {
    chip.append(
      el("span", {
        class: "selected-tile-thumb",
        // 24px — 칩 높이(34px)에 맞춘 미리보기. CSS 의 .selected-tile-thumb 치수와 같아야 한다.
        attrs: { "aria-hidden": "true", style: tilesetTileBackgroundStyle(tileset, selectedTile, 24) },
      })
    );
  }
  chip.append(
    el("button", {
      class: "selected-tile-label",
      text: label,
      attrs: {
        type: "button",
        title: hasTile ? "팔레트에서 이 타일 위치로 이동" : "선택된 타일이 없습니다",
        "aria-label": hasTile ? `선택 타일 ${label} — 팔레트에서 위치 보기` : "선택 타일 없음",
      },
      dataset: { testid: "selected-tile-reveal" },
      on: { click: () => { if (hasTile) revealPaletteTileFromMap(Number(chip.dataset.selectedTile)); } },
    })
  );
  chip.append(
    el("button", {
      class: "selected-tile-tileset",
      text: tileset.name,
      attrs: {
        type: "button",
        title: `타일 그림판: ${tileset.name} — 맵 설정에서 바꿉니다`,
        "aria-label": `타일 그림판 ${tileset.name} — 맵 설정에서 바꾸기`,
      },
      dataset: { testid: "palette-tileset-name" },
      on: { click: () => openMapPropertiesDialog(map.id, map.name, { focus: "tileset" }) },
    })
  );
  // 속성 진입 — 예전 「속성」 탭의 자리. 창으로 열어 팔레트 높이를 건드리지 않는다.
  chip.append(
    el("button", {
      class: "selected-tile-props-button",
      text: "⚙",
      attrs: {
        type: "button",
        title: hasTile ? "타일 속성 (통행 · 지면 종류)" : "타일을 먼저 고르세요",
        "aria-label": "타일 속성 열기",
      },
      dataset: { testid: "selected-tile-props-open" },
      on: { click: () => openTilePropsDialog(Number(chip.dataset.selectedTile), tileset) },
    })
  );
  return chip;
}

/**
 * A single task: map/layers, tools/options, search, growing sheet, selected tile,
 * then utilities. Auxiliary work opens without taking height from the sheet.
 */
function makePaletteSurface(input: {
  readonly map: { readonly id: string; readonly name: string; readonly tilesetId: string };
  readonly state: ReturnType<typeof editorState.get>;
  readonly tileLayer: Exclude<Layer, "event">;
  readonly tileset: TilesetDef;
  readonly retainedSheet: HTMLElement | null;
}): { readonly root: HTMLElement; readonly palette: HTMLElement; readonly sheetSlot: Node | null } {
  const { map, state, tileLayer, tileset, retainedSheet } = input;
  const root = el("div", {
    class: "palette-work-pane is-paint",
    dataset: { testid: "palette-work-pane-paint" },
  });

  const model = { map, rerender: renderPalettePreservingViewport, state, tileset };
  root.append(makeSidebarMapHeader(map, renderPalettePreservingViewport));
  root.append(makeTileToolbar({ ...model, refreshChrome: refreshPaletteChrome }));
  const assist = makeBrushAssistSection(map.id, state, tileset);
  const options = el('div', { class: 'sidebar-paint-options' });
  options.append(makeTileBrushControls(state, renderPalettePreservingViewport));
  if (state.tool === 'paint' && !state.activePaletteStamp) options.append(makePaintShapeSelect(model));
  if (assist.modeRow) options.append(assist.modeRow);
  // 구조 보조는 이웃 연결과 나란히 보인다 — 두 계약이 따로 있다는 사실 자체가 UI 정보다.
  if (assist.clusterRow) options.append(assist.clusterRow);
  root.append(options);
  const visibleTiles = filteredTileIdSet(tileset);
  root.append(makePaletteFilterBar(tileset, tileLayer, state.selectedTile));
  const emptyHint = makePaletteEmptyHint(tileLayer);

  const palette = retainedSheet ?? (isCustomTileset(tileset)
    ? makeCustomPalette({
        onCreatePaletteStamp: selectPaletteStamp,
        layer: tileLayer,
        onSelectTile: selectPaletteTile,
        selectedTile: state.selectedTile,
        tileset,
        emptyHint,
        visibleTiles,
      })
    : makeGridPalette({
        // 기본 리플로우 팔레트도 사각 드래그 = Combo Brush (OPRN-OUT-022).
        // 예전에는 이 게 커스텀 아틀라스에만 있어 기본 칩셋 사용자는 조합을 만들 수 없었다.
        onCreatePaletteStamp: selectPaletteStamp,
        layer: tileLayer,
        onSelectTile: selectPaletteTile,
        selectedTile: state.selectedTile,
        tileset,
        emptyHint,
        visibleTiles,
      }));
  palette.dataset.retainKey = paintSheetRetainKey(tileset, tileLayer);
  if (retainedSheet) {
    // 살린 판은 칸을 다시 짓지 않는다 — 그림(이식 베이크)과 필터·선택만 제자리에서 맞춘다.
    applyPaletteSheetImage(palette, tilesetImageUrl(tileset));
    if (isCustomTileset(tileset)) setCustomPaletteFilter(palette, visibleTiles, state.selectedTile);
    const displayTile = isCustomTileset(tileset) ? state.selectedTile : gridPaletteDisplayTile(tileset, state.selectedTile);
    movePaletteActiveCell(palette, displayTile);
  }
  if (showQuickTileNumbers) palette.classList.add("show-index");
  else palette.classList.remove("show-index");
  // 살린 시트는 제자리에 두므로 새 판에는 자리표시자만 둔다(swapPaneAroundSheet 가 앞뒤를 시트 둘레로 옮긴다).
  const sheetSlot: Node | null = retainedSheet ? document.createComment("palette-sheet-slot") : null;
  root.append(sheetSlot ?? palette);

  root.append(makeSelectedTileStatus(state.selectedTile, tileset, map));
  // ⋯ 검사·기록 메뉴는 도구막대 행 끝으로 옮겼다(2026-09-17) — 이 줄엔 붓 보조·조합만 남는다.
  const utilities = el('div', { class: 'sidebar-utilities', children: [assist.section] });
  // 타일 속성은 인라인이 아니라 창이다 — 인스펙터 본문 346px 가 좌패널(526px)에서
  // 팔레트를 2px 로 눌렀다. 진입은 위 선택칩의 ⚙. (tilePropsDialog.ts 헤더 주석)

  // 구조 킷 선반은 팔레트 **아래**. 원래 위였는데, 당시 주석("등록 전에는 렌더 안 됨")대로
  // 보통 비어 있어서 공짜였다. 2026-07-20 에 내장 집 킷이 합류하면서 선반이 상시 렌더로 바뀌었고
  // 실측 팔레트 창 446px 중 192px(43%)을 점거해 타일 팔레트를 접힘선 아래로 밀어냈다.
  // 타일 선택이 이 면의 주 작업이므로 순서를 뒤집고, 내장 킷은 기본 접힘으로 둔다.
  // 「조합」 = 검토를 통과한 큐레이션 Combo Brush 목록 (OPRN-OUT-022).
  // 구조 킷 선반보다 **먼저** 온다: 내장 조합은 항상 있고, 킷은 사용자가 등록해야 생긴다.
  const comboShelf = makeComboBrushShelf({ rerender: renderPalettePreservingViewport, tileset });
  if (comboShelf) utilities.append(makeSidebarSurface({ id: 'combos', label: '조합', triggerId: 'sidebar-combo-brushes',
    rerender: renderPalettePreservingViewport, body: () => comboShelf }));

  const kitShelf = makeStructureKitShelf({
    tileset,
    activeKitId: state.activePaletteStamp?.kitId ?? null,
    rerender: renderPalettePreservingViewport,
  });
  if (kitShelf) utilities.append(makeSidebarSurface({ id: 'kits', label: '내 구조물', triggerId: 'sidebar-structure-kits',
    rerender: renderPalettePreservingViewport, body: () => kitShelf }));
  root.append(utilities);

  return { root, palette, sheetSlot };
}

/**
 * 검색 + 카테고리 한 줄. 예전 「찾기」 탭의 알맹이지만 별개 그리드를 만들지 않고
 * 위의 팔레트 하나를 필터링한다 — 같은 타일 그림판을 두 방식으로 보여주지 않는다.
 */
function makePaletteFilterBar(
  tileset: TilesetDef,
  tileLayer: Exclude<Layer, "event">,
  selectedTile: number,
): HTMLElement {
  const bar = el("div", {
    class: "palette-filter-bar",
    dataset: { testid: "palette-filter-bar" },
  });

  const search = el("input", {
    class: "tile-search-input",
    attrs: {
      type: "search",
      placeholder: "번호·이름·태그로 타일 찾기",
      "aria-label": "타일 찾기",
    },
    value: tileSearchQuery,
    dataset: { testid: "tile-search-input" },
    on: {
      input: (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        tileSearchQuery = target.value;
        // 글자마다 시트를 다시 짓지 않는다 — 한 번에 60~130ms(2026-09-26 실측)라 빠르게 치면 입력이 밀렸다.
        if (tileSearchRenderTimer !== null) clearTimeout(tileSearchRenderTimer);
        tileSearchRenderTimer = setTimeout(() => {
          tileSearchRenderTimer = null;
          refreshPaletteFilter();
        }, TILE_SEARCH_RENDER_DELAY_MS);
      },
    },
  });
  const numberToggle = el("button", {
    class: "btn tile-number-toggle" + (showQuickTileNumbers ? " active" : ""),
    text: "#",
    attrs: {
      type: "button",
      title: showQuickTileNumbers ? "타일 번호 숨기기" : "타일 번호 보이기",
      "aria-pressed": String(showQuickTileNumbers),
      "aria-label": "타일 번호 표시",
    },
    dataset: { testid: "tile-number-toggle" },
    on: {
      click: () => {
        showQuickTileNumbers = !showQuickTileNumbers;
        renderPalettePreservingViewport();
      },
    },
  });
  const categorySelect = el("select", {
    class: "tile-category-select", attrs: { "aria-label": "타일 분류" }, dataset: { testid: "tile-category-select" },
    on: { change: event => {
      if (!(event.currentTarget instanceof HTMLSelectElement)) return;
      const value = event.currentTarget.value;
      const category = TILE_CATEGORIES.find(item => item.id === value);
      if (category) activeTileCategory = category.id;
      refreshPaletteFilter();
    } },
  });
  for (const category of TILE_CATEGORIES) {
    // 분류 이름 옆에 **실제로 보일 칸 수**를 붙인다. 셀렉트를 열기 전에 무엇이 비어 있는지
    // 알 수 있어야 한다 — 덧그림 레이어의 지형/물은 이 수가 0이고, 그때 고르면 빈 시트를 본다.
    const count = paletteMatchCount(tileset, tileLayer, selectedTile, categoryVisibleTileSet(tileset, category.id));
    categorySelect.append(el("option", { value: category.id, text: `${category.label} (${count})` }));
  }
  categorySelect.value = activeTileCategory;
  bar.append(el("div", { class: "palette-filter-search-row", children: [search, categorySelect, numberToggle] }));

  const status = makePaletteFilterStatus(tileset, tileLayer, selectedTile);
  if (status) bar.append(status);
  return bar;
}

/** 필터 결과 줄(「N칸 표시」+ 해제 버튼). 필터가 없으면 null. 분류 수를 다시 세지 않으려고 바와 따로 만든다. */
function makePaletteFilterStatus(
  tileset: TilesetDef,
  tileLayer: Exclude<Layer, "event">,
  selectedTile: number,
  visibleTiles: ReadonlySet<number> | null = filteredTileIdSet(tileset),
): HTMLElement | null {
  if (!isFilterActive()) return null;
  // 개수는 **팔레트가 실제로 그리는 칸**을 센다(아래 paletteMatchCount 참고). 예전에는
  // 타일셋 인덱스 일치 수를 세서 표기가 화면과 갈라졌다.
  const matched = paletteMatchCount(tileset, tileLayer, selectedTile, visibleTiles);
  return (
    el("div", {
      class: "palette-filter-status",
      dataset: { testid: "palette-filter-status" },
      children: [
        el("span", { text: `${matched}칸 표시` }),
        el("button", {
          class: "btn btn-mini palette-filter-clear",
          text: "필터 해제",
          attrs: { type: "button", title: "검색어와 분류 필터를 지운다" },
          dataset: { testid: "palette-filter-clear" },
          on: {
            click: () => {
              tileSearchQuery = "";
              activeTileCategory = "all";
              refreshPaletteFilter();
              document.querySelector<HTMLElement>('[data-testid="tile-search-input"]')?.focus();
            },
          },
        }),
      ],
    })
  );
}

/**
 * Connection state stays beside the active brush; reference strips open in a
 * bounded auxiliary surface, never reducing the tile viewport.
 */
function makeBrushAssistSection(
  mapId: string,
  state: ReturnType<typeof editorState.get>,
  tileset: TilesetDef
): { readonly clusterRow: HTMLElement | null; readonly modeRow: HTMLElement | null; readonly section: HTMLElement } {
  const panel = makeTileBrushAssistPanel({
    autoConnectMode: state.autoConnectMode,
    clusterAssistMode: state.clusterAssistMode,
    mapId,
    onSelectTile: selectPaletteTile,
    rerender: renderPalettePreservingViewport,
    selectedTile: state.selectedTile,
    tileset,
  });
  const modeRow = panel.querySelector<HTMLElement>(".tile-brush-mode-row");
  const clusterRow = panel.querySelector<HTMLElement>(".tile-brush-cluster-row");

  modeRow?.remove();
  clusterRow?.remove();
  const section = makeSidebarSurface({ id: 'assist', label: '붓 보조', triggerId: 'palette-brush-assist-toggle',
    rerender: renderPalettePreservingViewport, body: () => panel });
  return { clusterRow, modeRow, section };
}

// makeTilePropsSection 은 삭제됨 — src/editor/panels/tilePropsDialog.ts 의 창으로 대체.
// 인라인 접이식으로 시도했다가 실측에서 되돌렸다(팔레트 273px → 2px). 이유는 그 파일 헤더에.

function renderCurrentPalette(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (root) renderTilePalette(root);
}

/**
 * 검색어·분류만 바뀐 경우 — 도구줄·붓 보조·구조 킷 선반을 다시 짓지 않고 시트의 흐림과 「N칸 표시」 줄만 맞춘다.
 * 실측(버들항 23,936칸): 전체 다시 그리기 600~770ms 중 선반·보조 패널 재구성이 350ms 였다.
 * 커스텀 아틀라스가 제자리에 살아 있을 때만 쓰고, 아니면 전체 경로로 돌아간다.
 */
function refreshPaletteFilter(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  const pane = root?.querySelector<HTMLElement>('[data-testid="palette-work-pane-paint"]');
  const sheet = pane?.querySelector<HTMLElement>('[data-testid="tile-palette"]');
  const bar = pane?.querySelector<HTMLElement>('[data-testid="palette-filter-bar"]');
  const state = editorState.get();
  const project = store.getCurrent();
  const map = project.maps[currentMapId()];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!root || !pane || !sheet || !bar || !tileset || state.layer === "event"
    || root.querySelector("[data-sidebar-surface]") || !isCustomTileset(tileset)
    || sheet.dataset.retainKey !== paintSheetRetainKey(tileset, state.layer)) {
    renderPalettePreservingViewport();
    return;
  }
  const visibleTiles = filteredTileIdSet(tileset);
  if (!setCustomPaletteFilter(sheet, visibleTiles, state.selectedTile)) {
    renderPalettePreservingViewport();
    return;
  }
  const searchInput = bar.querySelector<HTMLInputElement>('[data-testid="tile-search-input"]');
  if (searchInput && searchInput.value !== tileSearchQuery) searchInput.value = tileSearchQuery;
  const select = bar.querySelector<HTMLSelectElement>('[data-testid="tile-category-select"]');
  if (select) select.value = activeTileCategory;
  bar.querySelector('[data-testid="palette-filter-status"]')?.remove();
  const status = makePaletteFilterStatus(tileset, state.layer, state.selectedTile, visibleTiles);
  if (status) bar.append(status);
}

function renderPalettePreservingViewport(): void {
  preservePaletteViewport(renderCurrentPalette);
}

/** 도구줄 배지·되돌리기만 다시 그린다. 보조 창이 열려 있거나 자리가 없으면 전체로 돌아간다. */
function refreshPaletteChrome(): void {
  if (!syncMountedPaletteToolPick()) renderPalettePreservingViewport();
}



// combined_town 전용 정적 테이블(describeChipsetTile)을 다른 칩셋에 쓰면 오답 —
// 비기본 타일 그림판(실내 등)은 프로젝트 tileMeta 라벨을 쓴다. (2026-07-12 라벨 통일 라운드)
function quickTileName(tileset: TilesetDef, index: number): string {
  if (isDefaultTilesetTexture(tileset)) return tileDisplayLabelForIndex(index);
  return tileset.tileMeta?.[index]?.label?.trim() || `타일 ${index}`;
}

/** 검색어나 분류 필터가 실제로 걸려 있는가. 아니면 팔레트를 건드리지 않는다. */
function isFilterActive(): boolean {
  return tileSearchQuery.trim().length > 0 || activeTileCategory !== "all";
}

/**
 * 필터 결과를 Set 으로 — 팔레트가 칸마다 조회하므로 배열 순회는 O(n²)가 된다.
 * 필터가 없으면 `null` 을 돌려 팔레트가 전량 노출 경로를 타게 한다.
 */
function filteredTileIdSet(tileset: TilesetDef): ReadonlySet<number> | null {
  if (!isFilterActive()) return null;
  return new Set(filteredTileIndexes(tileset));
}

/**
 * 분류 하나만 걸었을 때의 타일 집합 — 셀렉트의 「지형 (42)」 같은 수를 내는 데 쓴다.
 * 검색어는 섞지 않는다: 분류 옆의 수는 분류의 크기이지 현재 검색의 크기가 아니다.
 */
function categoryVisibleTileSet(tileset: TilesetDef, category: TileCategoryId): ReadonlySet<number> {
  if (category === "all") return new Set(Array.from({ length: tileset.count }, (_, index) => index));
  return new Set(filterTileIndexes(tileset, { category, query: "", recent: recentTilesView() }));
}

/**
 * 지금 조건에 맞는 칸이 몇 개인가 — **팔레트 종류에 따라 답이 다르다.**
 *
 * · 기본 리플로우 팔레트: 안 맞는 칸을 아예 안 그린다. 그래서 그리는 수는
 *   gridPaletteVisibleCount(오토타일 대표 축약 · 변형 숨김 · 레이어 가시성 반영)다.
 * · 커스텀 아틀라스: 화면은 6열로 세로 리플로우하지만 원본 셀을 **하나도 숨기지 않고**
 *   안 맞는 것만 흐리게 한다. 그래서 화면에 있는 칸은 언제나 전량이고, 셀 수 있는 것은
 *   "맞는 칸"의 수다. 이 둘을 한 함수로 뭉치면 커스텀 아틀라스에서 0이라고 말하게 된다.
 */
function paletteMatchCount(
  tileset: TilesetDef,
  tileLayer: Exclude<Layer, "event">,
  selectedTile: number,
  visibleTiles: ReadonlySet<number> | null,
): number {
  if (isCustomTileset(tileset)) return visibleTiles ? visibleTiles.size : tileset.count;
  return gridPaletteVisibleCount({ layer: tileLayer, selectedTile, tileset, visibleTiles });
}

/**
 * 빈 시트의 안내 문장. 「조건에 맞는 타일이 없습니다」 만으로는 **무엇을 풀어야 하는지**
 * 알 수 없다 — 실측: 덧그림 레이어에서 「지형」을 고르면 0칸인데, 그 사실은 어느 칩이
 * 원인인지 말해 주지 않았다. 레이어를 아는 이 함수가 원인을 짚는다.
 */
function makePaletteEmptyHint(tileLayer: Exclude<Layer, "event">): string | undefined {
  const layerLabel = tileLayer === "upper" ? "상위" : "바닥";
  // 「지형」·「물」은 하위 레이어 전용 판정이다(tileMatchesCategory). 그 레이어가 아니면
  // 분류 자체가 0칸을 낳으므로, 검색어를 지우는 것으로는 풀리지 않는다는 걸 말해 준다.
  if (tileLayer === "upper" && (activeTileCategory === "terrain" || activeTileCategory === "water")) {
    return `「${activeTileCategory === "terrain" ? "지형" : "물"}」 분류는 바닥 레이어 전용입니다. ` +
      `바닥 레이어로 바꾸거나 분류를 「전체」로 되돌리세요. (${layerLabel} 레이어에는 해당 타일이 없습니다)`;
  }
  if (activeTileCategory !== "all") return "조건에 맞는 타일이 없습니다. 분류를 「전체」로 되돌려 보세요.";
  return undefined;
}

function filteredTileIndexes(tileset: TilesetDef): readonly number[] {
  return filterTileIndexes(tileset, {
    category: activeTileCategory,
    query: tileSearchQuery,
    recent: recentTilesView(),
  });
}

/**
 * 선택 타일만 바뀐 클릭. 시트를 비우고 칸을 다시 만들지 않고 활성 칸·선택 칩만 옮긴다.
 * 필터가 켜져 있거나 보조 창이 열려 있거나 대상 칸이 아직 없으면 false — 호출부가 전체를 다시 그린다.
 */
export function syncMountedPaletteSelection(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (!root?.querySelector("[data-testid='tile-palette']")) return false;
  if (root.querySelector("[data-sidebar-surface]")) return false;
  const state = editorState.get();
  if (state.layer === "event") return false;
  const tileset = currentTilesetForPalette();
  if (!tileset) return false;
  const displayTile = isCustomTileset(tileset) ? state.selectedTile : gridPaletteDisplayTile(tileset, state.selectedTile);

  if (isFilterActive()) return false;
  const sheet = root.querySelector<HTMLElement>('[data-testid="tile-palette"]');
  if (!sheet || !movePaletteActiveCell(sheet, displayTile)) return false;
  const map = store.getCurrent().maps[currentMapId()];
  const status = root.querySelector<HTMLElement>('[data-testid="selected-tile-status"]');
  if (status && map && !updateSelectedTileStatus(status, state.selectedTile, tileset, map)) {
    status.replaceWith(makeSelectedTileStatus(state.selectedTile, tileset, map));
  }
  rememberMountedPaletteInputs(root);
  return true;
}

/**
 * 레이어만 바뀐 통지에서 붓 줄의 다른 점이 「상태 칩의 data-layer」 하나뿐이면 그 속성만 옮긴다.
 * 줄을 replaceWith 하면 삽입·제거가 문서 전체 스타일 재계산(~50ms)을 부른다. 다른 점이 더 있으면
 * (크기 선택 유무·도장·높이 붓 등) false 를 돌려 호출부가 통째로 갈아 끼운다.
 */
function patchBrushControlsInPlace(current: HTMLElement, next: HTMLElement): boolean {
  const currentState = current.querySelector<HTMLElement>('[data-testid="tile-brush-state"]');
  const nextState = next.querySelector<HTMLElement>('[data-testid="tile-brush-state"]');
  if (!currentState || !nextState) return false;
  const nextLayer = nextState.dataset.layer ?? "";
  if (currentState.dataset.layer === nextLayer) {
    return current.outerHTML === next.outerHTML;
  }
  const previousLayer = currentState.dataset.layer;
  currentState.dataset.layer = nextLayer;
  if (current.outerHTML === next.outerHTML) return true;
  if (previousLayer === undefined) currentState.removeAttribute("data-layer");
  else currentState.dataset.layer = previousLayer;
  return false;
}

/**
 * 제자리 동기화(선택·도구·붓)가 끝난 뒤 지금 입력을 다시 적는다. 안 적으면 기록이 옛 선택·도구를
 * 들고 있어, 다음 무관한 통지(이벤트 편집 등)에서 refreshTilePalette 가 입력이 달라졌다고 보고
 * 전체를 다시 짓는다(2026-09-27 실측: 타일·도구·붓 변경 직후 무관한 통지마다 1회).
 */
function rememberMountedPaletteInputs(root: HTMLElement): void {
  const shell = root.querySelector(":scope > .palette-work-shell");
  const inputs = paletteRenderInputs();
  if (shell && inputs) renderedPaletteInputs.set(root, { shell, inputs });
  else renderedPaletteInputs.delete(root);
}

/**
 * 타일을 고르며 레이어도 바뀐 클릭(상위 전용 타일). 커스텀 아틀라스는 두 레이어에 같은 칸을
 * 보이므로 활성 칸·선택 글·붓 상태만 옮기면 된다. 기본 칩셋은 레이어마다 보이는 칸이 다르고,
 * 필터가 걸린 팔레트는 빈 칸 안내가 레이어를 말한다 — 둘 다 false 를 돌려 호출부가 전체를 다시 그린다.
 */
export function syncMountedPaletteLayerSelection(): boolean {
  if (typeof document === "undefined") return false;
  const tileset = currentTilesetForPalette();
  if (!tileset || !isCustomTileset(tileset)) return false;
  if (!syncMountedPaletteSelection()) return false;
  const controls = document.querySelector<HTMLElement>('[data-testid="left-palette-root"] [data-testid="tile-brush-controls"]');
  if (!controls) return false;
  const nextControls = makeTileBrushControls(editorState.get(), renderPalettePreservingViewport);
  if (!patchBrushControlsInPlace(controls, nextControls)) controls.replaceWith(nextControls);
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (root) rememberMountedPaletteInputs(root);
  return true;
}

/**
 * 도구·붓 모양·붓 크기만 바뀐 경우. 칸 195~2,000개짜리 시트는 이 값을 읽지 않는다 — 도구줄과
 * 붓 옵션 줄만 갈아끼운다. 전체 재생성은 클릭당 약 120ms 였다(2026-09-26 실측, 절반 이상이
 * 붙이기 직후 focus 복원과 옛 트리 떼기). 보조 창이 열려 있거나 자리가 없으면 false.
 */
export function syncMountedPaletteToolPick(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  const pane = root?.querySelector<HTMLElement>('[data-testid="palette-work-pane-paint"]');
  if (!root || !pane || root.querySelector("[data-sidebar-surface]")) return false;
  const toolbar = pane.querySelector<HTMLElement>('[data-testid="oprn-tile-toolbar"]');
  const options = pane.querySelector<HTMLElement>(".sidebar-paint-options");
  const controls = options?.querySelector<HTMLElement>('[data-testid="tile-brush-controls"]');
  const state = editorState.get();
  if (state.layer === "event" || !toolbar || !options || !controls) return false;
  const project = store.getCurrent();
  const map = project.maps[currentMapId()];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return false;
  const focusSnapshot = captureFocus(root);
  const model = { map, rerender: renderPalettePreservingViewport, state, tileset };
  toolbar.replaceWith(makeTileToolbar({ ...model, refreshChrome: refreshPaletteChrome }));
  const shape = options.querySelector<HTMLElement>(".sidebar-shape-select");
  const nextControls = makeTileBrushControls(state, renderPalettePreservingViewport);
  controls.replaceWith(nextControls);
  const wantsShape = state.tool === "paint" && !state.activePaletteStamp;
  if (wantsShape) {
    const nextShape = makePaintShapeSelect(model);
    if (shape) shape.replaceWith(nextShape);
    else nextControls.after(nextShape);
  } else shape?.remove();
  applyRovingTabindex(root);
  restoreFocus(root, focusSnapshot);
  rememberMountedPaletteInputs(root);
  return true;
}

function movePaletteActiveCell(sheet: HTMLElement, displayTile: number): boolean {
  // 가상화된 큰 아틀라스: 칸이 그려져 있지 않아도 상태만 옮기면 되므로 다시 그릴 필요가 없다.
  if (setVirtualPaletteActive(sheet, displayTile)) return true;
  const nextActive = sheet.querySelector<HTMLElement>(`[data-tile-index="${displayTile}"]`);
  if (!nextActive) return false;
  const oldActive = sheet.querySelector<HTMLElement>(".chipset-tile.active");
  if (oldActive === nextActive) return true;
  oldActive?.classList.remove("active");
  oldActive?.setAttribute("aria-pressed", "false");
  nextActive.classList.add("active");
  nextActive.setAttribute("aria-pressed", "true");
  sheet.querySelector<HTMLElement>('.chipset-tile[tabindex="0"]')?.setAttribute("tabindex", "-1");
  nextActive.setAttribute("tabindex", "0");
  return true;
}

export function selectPaletteTile(index: number): void {
  // 타일을 고르는 것은 「칠하겠다」는 선언이다. 같은 도구 상태가 유지되는 경우(이미 브러시)
  // 에는 아래 editorState 변화가 tool 을 건드리지 않아 감시자가 못 잡는다 — 여기서 끊는다.
  dismissLocationDrawModeForTool("paint");
  preservePaletteViewport(() => {
    recordRecentTile(index);
    const state = editorState.get();
    const tileset = currentTilesetForPalette();
    let nextLayer = state.layer;
    if (tileset && state.layer !== "event") {
      const home = tileLayerHome(tileset, index);
      if (home !== "both" && home !== state.layer) nextLayer = home;
    }
    const keepTools = new Set(["paint", "fill", "erase", "event"]);
    const switchToPaint = !keepTools.has(state.tool) && nextLayer !== "event";
    editorState.set({
      activePaletteStamp: null,
      layer: nextLayer,
      selectedTile: index,
      ...(switchToPaint ? { tool: "paint" as const } : {}),
    });
    if (nextLayer !== state.layer) {
      toast(
        nextLayer === "upper" ? "상위 레이어 타일 — 상위 레이어 편집으로 전환" : "하위 레이어 타일 — 하위 레이어 편집으로 전환",
        "ok"
      );
    }
  });
}


export function revealPaletteTileFromMap(tile: number): void {
  if (typeof document === "undefined") return;
  if (tile < 0) return;
  // 예전에는 여기서 작업 탭을 "칠하기"로 강제하고 localStorage 에도 썼다 — 맵에서
  // 스포이트를 쓰면 감독이 고른 탭이 조용히 덮였다. 이제 탭이 없으니 스크롤 리빌만 한다.
  //
  // 필터가 걸려 있으면 집은 타일이 팔레트에서 숨어 있을 수 있다. rm2k 팔레트는
  // 선택 타일을 필터 예외로 항상 그리므로(passesFilter) 리빌 대상은 존재한다.
  pendingRevealSelectedTile = true;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (root) renderTilePalette(root);
  else {
    window.requestAnimationFrame(() => {
      const r = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
      if (r) renderTilePalette(r);
    });
  }
}

function revealChipsetTileInPalette(tile: number): void {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (!root) return;
  // Custom atlases expose exact source cells; RM2K chipsets collapse authored autotile variants.
  const tileset = currentTilesetForPalette();
  const displayTile = tileset && !isCustomTileset(tileset) ? gridPaletteDisplayTile(tileset, tile) : tile;
  const virtualSheet = root.querySelector<HTMLElement>('[data-testid="tile-palette"]');
  const cell =
    (virtualSheet ? revealVirtualPaletteTile(virtualSheet, displayTile) : null) ??
    root.querySelector<HTMLElement>('[data-testid="chipset-tile-' + displayTile + '"]') ??
    root.querySelector<HTMLElement>('[data-testid="chipset-tile-' + tile + '"]') ??
    root.querySelector<HTMLElement>('[data-testid="quick-tile-' + tile + '"]');
  if (!cell) return;
  cell.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" });
  cell.classList.add("is-map-reveal");
  window.setTimeout(() => cell.classList.remove("is-map-reveal"), 1400);
}

function preservePaletteViewport(action: () => void): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    action();
    return;
  }
  const container = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  const palette = container ? paletteViewportElement(container) : null;
  const scroll = container ? readPaletteScroll(container) : null;
  const windowScroll = { x: window.scrollX, y: window.scrollY };
  action();
  const restore = (): void => {
    const nextContainer = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
    const nextPalette = nextContainer ? paletteViewportElement(nextContainer) : null;
    // 다시 그려지지 않았으면(선택만 제자리에서 옮긴 클릭) 스크롤도 그대로다. 여기서 scrollTop 을
    // 쓰면 방금 바뀐 활성 칸 때문에 레이아웃을 강제로 네 번 더 돈다.
    if (nextContainer === container && nextPalette === palette) return;
    if (scroll && nextContainer && nextPalette) applyPaletteScroll(nextContainer, nextPalette, scroll);
    if (palette && container && scroll) applyPaletteScroll(container, palette, scroll);
    window.scrollTo(windowScroll.x, windowScroll.y);
  };
  restore();
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 50);
  window.requestAnimationFrame(restore);
}

function readPaletteScroll(container: HTMLElement): PaletteScroll {
  const palette = paletteViewportElement(container);
  return {
    containerLeft: container.scrollLeft,
    containerTop: container.scrollTop,
    sheetLeft: palette?.scrollLeft ?? 0,
    sheetTop: palette?.scrollTop ?? 0,
  };
}

function paletteViewportElement(container: HTMLElement): HTMLElement | null {
  // 구 클러스터 팔레트(tile-palette-clusters)는 RM2K 팔레트로 대체·삭제됨 (2026-07-17).
  return container.querySelector<HTMLElement>('[data-testid="tile-palette"]');
}

function restorePaletteScroll(container: HTMLElement, palette: HTMLElement, scroll: PaletteScroll): void {
  if (resetChipsetScroll) {
    resetChipsetScroll = false;
    const resetScroll = { ...scroll, sheetLeft: 0, sheetTop: 0 };
    applyPaletteScroll(container, palette, resetScroll);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => applyPaletteScroll(container, palette, resetScroll));
    }
    return;
  }
  applyPaletteScroll(container, palette, scroll);
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => applyPaletteScroll(container, palette, scroll));
  }
}

function applyPaletteScroll(container: HTMLElement, palette: HTMLElement, scroll: PaletteScroll): void {
  // 방금 붙인 트리의 scrollLeft/Top 을 **읽으면** 레이아웃을 강제한다 — 레이어 전환 재생성 89ms 중 46ms 가
  // 이 읽기였다(2026-09-27 실측, "get scrollLeft"). 새 노드는 0 에서 시작하므로 0 은 쓸 필요가 없고,
  // 0 이 아닌 축만 쓴다. 쓰기도 레이아웃을 잴지만 스크롤을 옮긴 때만 치른다.
  if (scroll.sheetLeft) palette.scrollLeft = scroll.sheetLeft;
  if (scroll.sheetTop) palette.scrollTop = scroll.sheetTop;
  if (scroll.containerLeft) container.scrollLeft = scroll.containerLeft;
  if (scroll.containerTop) container.scrollTop = scroll.containerTop;
}

function currentMapId(): string {
  const project = store.getCurrent();
  return editorState.get().currentMapId ?? project.startMapId;
}

function currentTilesetForPalette(): TilesetDef | undefined {
  const project = store.getCurrent();
  const map = project.maps[currentMapId()];
  if (!map) return undefined;
  return project.tilesets[map.tilesetId];
}

// makeTerrainEditor 는 삭제됨 (2026-08-21). 「속성」 탭이 renderTileMappingInspector
// (안에 이미 terrainEditor 가 있다)와 이 함수를 **둘 다** 붙여, 같은 tileset.terrain[tile]
// 필드를 쓰는 입력이 화면에 두 개였다. 인스펙터 쪽(inspector-terrain-tag-input)만 남긴다.
