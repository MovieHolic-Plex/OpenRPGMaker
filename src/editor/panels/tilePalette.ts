import { el, clearChildren } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import type { Layer } from "@/editor/editorState";
import { getEditorChrome } from "@/editor/editorUiMode";
import { renderBasicLeftRail } from "@/editor/panels/basicLeftRail";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { makeLeftLayerSwitcher } from "@/editor/panels/leftLayerSwitcher";
import { isDefaultTilesetTexture, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { openTilePropsDialog } from "@/editor/panels/tilePropsDialog";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { makeStructureKitShelf } from "@/editor/harnessSuggestion/structureKitShelf";
import { makePaletteStampStatus, makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { makeCustomPalette, makeGridPalette, gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
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
let showQuickTileNumbers = false;
/** 붓 보조 펼침 상태 — 팔레트는 붓질마다 재렌더되므로 DOM 에 맡기면 매번 닫힌다. */
let brushAssistOpen = false;
/** 맵 우클릭 스포이트 후 팔레트 타일 그림판 셀로 스크롤 (전문가 모드). */
let pendingRevealSelectedTile = false;
let resetChipsetScroll = false;
const recentTiles: number[] = [];

type PaletteScroll = {
  readonly containerLeft: number;
  readonly containerTop: number;
  readonly sheetLeft: number;
  readonly sheetTop: number;
};

export function renderTilePalette(container: HTMLElement): void {
  // The rail owns its focus and flyout snapshots. Do not detach its focused node
  // before it can capture them (the real browser moves focus to body on removal).
  if (getEditorChrome().paletteRail) {
    renderBasicLeftRail(container);
    return;
  }
  const focusSnapshot = captureFocus(container);
  const previousPaletteScroll = readPaletteScroll(container);
  clearChildren(container);
  const state = editorState.get();

  if (state.layer === "event") {
    const project = store.getCurrent();
    const mapId = state.currentMapId ?? project.startMapId;
    const map = project.maps[mapId];
    const tileset = map ? project.tilesets[map.tilesetId] : undefined;
    if (map && tileset) {
      container.append(makeTileToolbar({ map, rerender: renderPalettePreservingViewport, state, tileset }));
    }
    // 이벤트 레이어에서도 레이어 전환이 보여야 한다 — 없으면 바닥으로 돌아가는 길이 사이드바에 없다.
    container.append(makeLeftLayerSwitcher(state.layer));
    renderEventEditor(container);
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

  const body = makePaletteSurface({ map, state, tileLayer, tileset });
  shell.append(body.root);
  const palette: HTMLElement | null = body.palette;

  container.append(shell);
  applyRovingTabindex(container);
  restoreFocus(container, focusSnapshot);
  if (palette) restorePaletteScroll(container, palette, previousPaletteScroll);
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
    dataset: { testid: "selected-tile-status" },
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
      on: { click: () => { if (hasTile) revealPaletteTileFromMap(selectedTile); } },
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
      on: { click: () => openTilePropsDialog(selectedTile, tileset) },
    })
  );
  return chip;
}

/**
 * 좌패널 단일 면. 위에서 아래로 한 흐름이다 —
 * 무엇을 골랐나(칩) → 무엇으로 칠하나(도구) → 무엇을 찾나(필터) → 고르기(팔레트)
 * → 붓 보조 → 이 타일의 속성 → 구조 킷.
 */
function makePaletteSurface(input: {
  readonly map: { readonly id: string; readonly name: string; readonly tilesetId: string };
  readonly state: ReturnType<typeof editorState.get>;
  readonly tileLayer: Exclude<Layer, "event">;
  readonly tileset: TilesetDef;
}): { readonly root: HTMLElement; readonly palette: HTMLElement } {
  const { map, state, tileLayer, tileset } = input;
  const root = el("div", {
    class: "palette-work-pane is-paint",
    dataset: { testid: "palette-work-pane-paint" },
  });

  root.append(makeSelectedTileStatus(state.selectedTile, tileset, map));
  root.append(makeTileToolbar({ map, rerender: renderPalettePreservingViewport, state, tileset }));
  // 도구 → 레이어 가 사이드바 최상단 순서다(사용 번도 순). 상단 「도구」 메뉴에 있었던
  // 레이어 항목을 이리로 옷긴 것이다 — test/editorMenuSidebarIa.test.ts 가 이 순서를 고정한다.
  root.append(makeLeftLayerSwitcher(state.layer));
  root.append(makePaletteStampStatus(state.activePaletteStamp, renderPalettePreservingViewport));
  root.append(makePaletteFilterBar(tileset));

  const visibleTiles = filteredTileIdSet(tileset);
  const palette = isCustomTileset(tileset)
    ? makeCustomPalette({
        layer: tileLayer,
        onSelectTile: selectPaletteTile,
        selectedTile: state.selectedTile,
        tileset,
        visibleTiles,
      })
    : makeGridPalette({
        layer: tileLayer,
        onSelectTile: selectPaletteTile,
        selectedTile: state.selectedTile,
        tileset,
        visibleTiles,
      });
  if (showQuickTileNumbers) palette.classList.add("show-index");
  root.append(palette);

  root.append(makeBrushAssistSection(map.id, state, tileset));
  // 타일 속성은 인라인이 아니라 창이다 — 인스펙터 본문 346px 가 좌패널(526px)에서
  // 팔레트를 2px 로 눌렀다. 진입은 위 선택칩의 ⚙. (tilePropsDialog.ts 헤더 주석)

  // 구조 킷 선반은 팔레트 **아래**. 원래 위였는데, 당시 주석("등록 전에는 렌더 안 됨")대로
  // 보통 비어 있어서 공짜였다. 2026-07-20 에 내장 집 킷이 합류하면서 선반이 상시 렌더로 바뀌었고
  // 실측 팔레트 창 446px 중 192px(43%)을 점거해 타일 팔레트를 접힘선 아래로 밀어냈다.
  // 타일 선택이 이 면의 주 작업이므로 순서를 뒤집고, 내장 킷은 기본 접힘으로 둔다.
  const kitShelf = makeStructureKitShelf({
    tileset,
    activeKitId: state.activePaletteStamp?.kitId ?? null,
    rerender: renderPalettePreservingViewport,
  });
  if (kitShelf) root.append(kitShelf);

  return { root, palette };
}

/**
 * 검색 + 카테고리 한 줄. 예전 「찾기」 탭의 알맹이지만 별개 그리드를 만들지 않고
 * 위의 팔레트 하나를 필터링한다 — 같은 타일 그림판을 두 방식으로 보여주지 않는다.
 */
function makePaletteFilterBar(tileset: TilesetDef): HTMLElement {
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
        renderPalettePreservingViewport();
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
  bar.append(el("div", { class: "palette-filter-search-row", children: [search, numberToggle] }));

  const chips = el("div", {
    class: "tile-category-tabs",
    attrs: { role: "group", "aria-label": "타일 분류" },
    dataset: { testid: "palette-category-chips" },
  });
  for (const category of TILE_CATEGORIES) {
    const active = activeTileCategory === category.id;
    chips.append(
      el("button", {
        class: "btn tile-category-tab" + (active ? " active" : ""),
        text: category.label,
        attrs: {
          type: "button",
          "aria-pressed": String(active),
          title: category.id === "all" ? "분류 필터 끄기" : `${category.label} 타일만 보기`,
        },
        dataset: { testid: `tile-category-${category.id}` },
        on: {
          click: () => {
            // 켜져 있는 분류를 다시 누르면 필터가 풀린다 — 되돌리려고 "전체"를 찾지 않게.
            activeTileCategory = active && category.id !== "all" ? "all" : category.id;
            renderPalettePreservingViewport();
          },
        },
      })
    );
  }
  bar.append(chips);

  if (isFilterActive()) {
    const matched = filteredTileIndexes(tileset).length;
    bar.append(
      el("div", {
        class: "palette-filter-status",
        dataset: { testid: "palette-filter-status" },
        children: [
          el("span", { text: `${matched}개 일치` }),
          el("button", {
            class: "btn btn-mini palette-filter-clear",
            text: "필터 해제",
            attrs: { type: "button", title: "검색어와 분류 필터를 지운다" },
            dataset: { testid: "palette-filter-clear" },
            on: {
              click: () => {
                tileSearchQuery = "";
                activeTileCategory = "all";
                renderPalettePreservingViewport();
              },
            },
          }),
        ],
      })
    );
  }
  return bar;
}

/**
 * 붓 보조. 이웃 연결 자동/수동은 **붓의 동작을 바꾸는 토글**이므로 접이식이 닫혀 있어도
 * 보여야 한다 — 예전에는 「속성」 탭에 있어서 이웃 성형 여부를 모르고 칠하게 됐다.
 * 그래서 별도 줄을 만들지 않고 **요약줄 안에** 얹는다. 실측에서 별도 줄은 33px 를
 * 먹어 팔레트를 252px 로 눌렀다(스펙 하한 260px). 요약줄에 합치면 그 줄이 공짜가 된다.
 * 즐겨찾기·닮은 타일·쓴 곳은 참고 정보라 펼쳤을 때만 나온다.
 */
function makeBrushAssistSection(
  mapId: string,
  state: ReturnType<typeof editorState.get>,
  tileset: TilesetDef
): HTMLElement {
  const panel = makeTileBrushAssistPanel({
    autoConnectMode: state.autoConnectMode,
    mapId,
    onSelectTile: selectPaletteTile,
    rerender: renderPalettePreservingViewport,
    selectedTile: state.selectedTile,
    tileset,
  });
  const modeRow = panel.querySelector<HTMLElement>(".tile-brush-mode-row");

  // <details>/<summary> 를 쓰지 않는다 — 요약줄 안에 버튼을 넣으면 그 클릭이 summary 의
  // 기본 동작(접기/펴기)과 싸운다. stopPropagation+preventDefault 로 막을 수는 있지만
  // 버튼 핸들러가 그 사이에 팔레트를 재렌더해 노드가 분리되므로 순서가 취약하다.
  // 직접 제어하는 헤더 줄이 더 단순하고 확실하다.
  const section = el("div", {
    class: "palette-inline-section palette-brush-assist" + (brushAssistOpen ? " is-open" : ""),
    dataset: { testid: "palette-brush-assist-section", open: String(brushAssistOpen) },
  });
  const header = el("div", { class: "palette-inline-header" });
  header.append(
    el("button", {
      class: "palette-inline-toggle",
      attrs: {
        type: "button",
        "aria-expanded": String(brushAssistOpen),
        title: brushAssistOpen ? "붓 보조 접기" : "즐겨찾기 · 닮은 타일 · 이 맵에서 쓴 곳 펼치기",
      },
      dataset: { testid: "palette-brush-assist-toggle" },
      on: {
        click: () => {
          brushAssistOpen = !brushAssistOpen;
          renderPalettePreservingViewport();
        },
      },
      children: [
        el("span", { class: "palette-inline-caret", text: brushAssistOpen ? "▾" : "▸", attrs: { "aria-hidden": "true" } }),
        el("span", { text: "붓 보조" }),
      ],
    })
  );
  // 이웃 연결은 접혀 있어도 이 줄에 남는다.
  if (modeRow) header.append(modeRow);
  section.append(header);
  if (brushAssistOpen) section.append(panel);
  return section;
}

// makeTilePropsSection 은 삭제됨 — src/editor/panels/tilePropsDialog.ts 의 창으로 대체.
// 인라인 접이식으로 시도했다가 실측에서 되돌렸다(팔레트 273px → 2px). 이유는 그 파일 헤더에.

function renderCurrentPalette(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (root) renderTilePalette(root);
}

function renderPalettePreservingViewport(): void {
  preservePaletteViewport(renderCurrentPalette);
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

function filteredTileIndexes(tileset: TilesetDef): readonly number[] {
  return filterTileIndexes(tileset, {
    category: activeTileCategory,
    query: tileSearchQuery,
    recent: recentTiles,
  });
}

export function selectPaletteTile(index: number): void {
  preservePaletteViewport(() => {
    const existingIndex = recentTiles.indexOf(index);
    if (existingIndex >= 0) recentTiles.splice(existingIndex, 1);
    recentTiles.unshift(index);
    if (recentTiles.length > 18) recentTiles.length = 18;
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
  if (getEditorChrome().paletteRail) return;
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
  const cell =
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
  palette.scrollLeft = scroll.sheetLeft;
  palette.scrollTop = scroll.sheetTop;
  container.scrollLeft = scroll.containerLeft;
  container.scrollTop = scroll.containerTop;
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
