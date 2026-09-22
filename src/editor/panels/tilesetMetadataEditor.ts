import { renderTilesetReferences } from "./tilesetReferencePanel";
import {
  applyAutotileSheetPick,
  autotileHighlightTileIds,
  renderAutotileEditorPanel,
  renderAutotileLayoutToolbar,
} from "@/editor/panels/tilesetAutotileEditor";
import { renderChipsetPreviewPanel } from "@/editor/panels/tilesetChipsetPreview";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { textControl } from "@/editor/panels/databaseControls";
import {
  ensureTileMeta,
  listUnlabeledTileIds,
  metadataForTile,
  numberControl,
  passageText,
  textAreaControl,
} from "@/editor/panels/tilesetMetadataControls";
import { getUnlabeledOnlyFilter, setUnlabeledOnlyFilter } from "@/editor/panels/tilesetChipsetPreview";
import { openTilesetSettingsModal } from "@/editor/panels/tilesetPassageModal";
import { getTilesetPassagePaint, setTilesetPassagePaint } from "@/editor/panels/tilesetPassagePaint";
import {
  tabForTilesetMode,
  TILESET_TAB_MODES,
  TILESET_EDIT_MODES,
  type TilesetEditMode,
  type TilesetSectionTab,
} from "@/editor/panels/tilesetUsageGuide";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  markUserTileRuntimeMetadata,
  setTileBackingOverride,
  setTileLayerOverride,
  userTileBackingOverride,
  userTileLayerOverride,
  type TileBackingChoice,
  type TileLayerChoice,
} from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import {
  backgroundlessLowerReviews,
  DEFAULT_TRUNK_BACKING_TILE,
  tileLayerPolicy,
  TILE_ALPHA_CLASS_LABELS,
  TILE_LAYER_REVIEW_CHOICE_LABELS,
  type TileLayerPolicyClass,
  type TileLayerReviewChoice,
  type TileTransparencyDetection,
} from "@/editor/tileLayerPolicy";
import {
  cachedCustomChipsetAlphaScan,
  CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT,
  detectedTileAlphaClass,
  detectedTileAlphaSample,
  peekCustomChipsetAlphaScan,
} from "@/editor/customChipsetTransparency";
import { summarizeTileAlphaScan } from "@/project/tileAlphaScan";
import { isTransparentChipsetTile } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import { confirmUserTileMetadata } from "@/project/tilesetPalette";
import { isCombinedTownTileset } from "@/project/tilesetHarness";
import { isCustomTileset } from "@/project/tilesetKind";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import {
  isBlockedPassage,
  passageMarkForTile,
  passableFlag,
  setPassageMark,
  togglePassageDirection,
  type PassageMark,
} from "@/project/tilesetPassage";
import type { PassFlag, TileAiMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

let selectedTile = 0;
// 첫 화면은 통행(규칙) 탭이다. 타일셋을 연 사람이 가장 먼저 하는 일이 통행 칠하기이고,
// 비어 있는 AI 참고문서 목록이 첫 화면이면 할 일이 안 보였다(2026-09-23 맵 자료집 UI 정리).
let standaloneTab: "references" | "settings" | null = null;
let editMode: TilesetEditMode = "passage";
/** 방향별 통행. 리렌더마다 접히면 연속으로 방향을 못 고친다. */
let compassOpen = true;
const PASSAGE_META: Record<PassageMark, NonNullable<TileAiMetadata["passage"]>> = {
  o: "passable",
  x: "solid",
  star: "star",
};

/**
 * 커스텀 칩셋 픽셀 감지를 정책에 주입한다. 캐시 히트면 즉시, 아니면 null 을 주고 스캔을
 * 예약한다(`peek…` 이 예약한다) — 스캔이 끝나면 아래 `installAlphaScanRerender` 가 다시 그린다.
 *
 * 감지는 메타를 만지지 않는다. 여기서 나온 값은 검토 목록 항목과 근거 문장에만 쓰인다.
 */
function chipsetTransparencyDetection(tileset: TilesetDef): TileTransparencyDetection {
  return {
    classOf: (tile) => detectedTileAlphaClass(tileset, tile),
    sampleOf: (tile) => detectedTileAlphaSample(tileset, tile),
  };
}

/** 비동기 스캔 완료 → 규칙 탭 한 번 다시 그리기. 한 번 듣고 스스로 떼어 낸다(누수·루프 금지). */
function installAlphaScanRerender(host: HTMLElement, tilesetId: string, rerender: () => void): void {
  if (typeof window === "undefined") return;
  const onScanned = (event: Event): void => {
    const detail = (event as CustomEvent<{ tilesetId?: string }>).detail;
    if (detail?.tilesetId !== tilesetId) return;
    window.removeEventListener(CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT, onScanned);
    // 이미 화면에서 떼어진 노드라면 다시 그릴 이유가 없다.
    if (!host.isConnected) return;
    rerender();
  };
  window.addEventListener(CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT, onScanned);
}

export function renderTilesetMetadataEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  if (standaloneTab === "references") return renderTilesetReferences(tileset, rerender);
  clampSelectedTile(tileset);
  const paintLayout = editMode === "passage" || editMode === "terrain";
  const autotileLayout = editMode === "autotile";
  const preview = renderChipsetPreviewPanel({
    tileset,
    mode: editMode,
    selectedTile,
    unlabeledOnly: getUnlabeledOnlyFilter(),
    passagePaint: getTilesetPassagePaint(),
    highlightTileIds: autotileLayout ? autotileHighlightTileIds(tileset) : undefined,
    rerender,
    onApplyModeTile: (tile) => applyActiveModeClick(tileset.id, tile),
    onPaintStrokeStart: beginPassagePaintStroke,
    onPaintStrokeEnd: endPassagePaintStroke,
    onSelectTile: (tile, options) => {
      selectedTile = tile;
      // quiet: 우클릭 메뉴 — 전체 리마운트/스크롤 점프 금지
      if (options?.quiet) return;
      rerender();
    },
    onOpenFullSheet: () => openTilesetSettingsModal(tileset.id, rerender),
  });
  const sidebar = renderEditSidebar(tileset, rerender);
  const tools = paintLayout ? renderToolBox(rerender) : null;
  const autotileTools = autotileLayout ? renderAutotileLayoutToolbar(tileset, rerender) : null;
  const host = el("div", {
    class: `tileset-db-edit-area${editMode === "group" ? " knowledge-mode" : ""}${paintLayout ? " passage-paint" : ""}${autotileLayout ? " autotile-compose" : ""}`,
    children: paintLayout
      ? [...(tools ? [tools] : []), preview, sidebar]
      : autotileLayout
        ? [...(autotileTools ? [autotileTools] : []), preview, sidebar]
        : [sidebar, preview],
  });
  installAlphaScanRerender(host, tileset.id, rerender);
  return host;
}

function renderEditSidebar(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  const toolbox = renderToolBox(rerender);
  if (editMode === "group") {
    return el("div", {
      class: "tileset-db-edit-sidebar tileset-knowledge-sidebar",
      children: [renderTileGroupPanel(tileset, rerender)],
    });
  }
  if (editMode === "passage") {
    return el("div", {
      class: "tileset-db-edit-sidebar tileset-passage-inspector",
      children: [renderPassageInspector(tileset, rerender)],
    });
  }
  if (editMode === "terrain") {
    return el("div", {
      class: "tileset-db-edit-sidebar",
      children: [renderSelectedTilePanel(tileset, rerender)],
    });
  }
  if (editMode === "autotile") {
    return el("div", {
      class: "tileset-db-edit-sidebar tileset-autotile-sidebar",
      children: [renderAutotileEditorPanel(tileset, rerender)],
    });
  }
  return el("div", {
    class: "tileset-db-edit-sidebar",
    children: [
      ...(toolbox ? [toolbox] : []),
      ...(tab === "knowledge" ? [renderUnlabeledQueuePanel(tileset, rerender)] : []),
      renderSelectedTilePanel(tileset, rerender),
    ],
  });
}

/** 라벨·설명이 비어 있는 타일만 모아 순서대로 채우는 큐 */
function renderUnlabeledQueuePanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const unlabeled = listUnlabeledTileIds(tileset);
  const filterOn = getUnlabeledOnlyFilter();
  const idxInQueue = unlabeled.indexOf(selectedTile);
  const go = (delta: number) => {
    if (unlabeled.length === 0) return;
    if (idxInQueue < 0) {
      selectedTile = unlabeled[0]!;
    } else {
      const next = (idxInQueue + delta + unlabeled.length) % unlabeled.length;
      selectedTile = unlabeled[next]!;
    }
    setUnlabeledOnlyFilter(true);
    rerender();
  };
  return el("section", {
    class: "tileset-unlabeled-queue",
    dataset: { testid: "tileset-unlabeled-queue" },
    children: [
      el("div", {
        class: "tileset-unlabeled-queue-header",
        children: [
          el("strong", { text: "미분류 타일 큐" }),
          el("span", {
            dataset: { testid: "tileset-unlabeled-count" },
            text: unlabeled.length === 0 ? "완료" : `${unlabeled.length}개 남음`,
          }),
        ],
      }),
      el("div", {
        class: "tileset-unlabeled-queue-actions",
        children: [
          el("button", {
            class: "database-footer-button",
            text: "이전",
            attrs: { type: "button", ...(unlabeled.length === 0 ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-unlabeled-prev" },
            on: { click: () => go(-1) },
          }),
          el("button", {
            class: "database-footer-button",
            text: idxInQueue >= 0 ? `다음 (${idxInQueue + 1}/${unlabeled.length})` : "첫 미분류",
            attrs: { type: "button", ...(unlabeled.length === 0 ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-unlabeled-next" },
            on: { click: () => go(1) },
          }),
          el("button", {
            class: `database-footer-button${filterOn ? " active" : ""}`,
            text: filterOn ? "미분류 필터 ON" : "미분류 필터",
            attrs: { type: "button" },
            dataset: { testid: "tileset-unlabeled-filter-toggle" },
            on: {
              click: () => {
                setUnlabeledOnlyFilter(!getUnlabeledOnlyFilter());
                rerender();
              },
            },
          }),
        ],
      }),
      ...(unlabeled.length > 0 && unlabeled.length <= 48
        ? [
            el("div", {
              class: "tileset-unlabeled-id-list",
              dataset: { testid: "tileset-unlabeled-id-list" },
              children: unlabeled.slice(0, 48).map((id) =>
                el("button", {
                  class: id === selectedTile ? "active" : "",
                  text: String(id),
                  attrs: { type: "button", title: `타일 ${id}` },
                  on: {
                    click: () => {
                      selectedTile = id;
                      setUnlabeledOnlyFilter(true);
                      rerender();
                    },
                  },
                }),
              ),
            }),
          ]
        : unlabeled.length > 48
          ? [el("div", { class: "tileset-rule-note", text: `처음 48개 id만 목록 표시 (전체 ${unlabeled.length})` })]
          : []),
    ],
  });
}

// 현재 탭에 속한 편집 모드만 노출한다 — 화면당 기능을 1/3로 줄이는 3탭 재편의 핵심.
function renderToolBox(rerender: () => void): HTMLElement | null {
  const modes = TILESET_TAB_MODES[getTilesetSectionTab()];
  const paint = editMode === "passage" ? renderPassagePaintTools(rerender) : null;
  if (modes.length <= 1 && !paint) return null;
  return el("div", {
    class: "tileset-db-tools",
    attrs: { role: "tablist", "aria-label": "타일셋 작업" },
    children: [
      ...modes.map((modeId) => {
        const guide = TILESET_EDIT_MODES.find((entry) => entry.id === modeId);
        return el("button", {
          class: modeId === editMode ? "active" : "",
          text: guide?.label ?? modeId,
          attrs: { type: "button", role: "tab", "aria-selected": String(modeId === editMode) },
          dataset: { testid: `tileset-edit-mode-${modeId}` },
          on: { click: () => setMode(modeId, rerender) },
        });
      }),
      ...(paint ? [paint] : []),
    ],
  });
}

function renderPassagePaintTools(rerender: () => void): HTMLElement {
  const current = getTilesetPassagePaint();
  const paintButton = (mark: PassageMark, label: string, testid: string): HTMLElement =>
    el("button", {
      class: `database-footer-button tileset-passage-choice${current === mark ? " active" : ""}`,
      text: label,
      attrs: { type: "button", "aria-pressed": String(current === mark), title: `${label} — 시트에서 클릭·드래그로 칠합니다` },
      dataset: { testid },
      on: {
        click: () => {
          setTilesetPassagePaint(mark);
          rerender();
        },
      },
    });
  return el("fieldset", {
    class: "oprn-db-fieldset tileset-rule-passage",
    dataset: { testid: "tileset-rule-passage" },
    children: [
      el("legend", { text: "통행 붓" }),
      el("div", {
        class: "tileset-rule-buttons",
        children: [
          paintButton("o", "통과", "tileset-passage-open"),
          paintButton("x", "막힘", "tileset-passage-blocked"),
          paintButton("star", "위 ★", "tileset-passage-star"),
        ],
      }),
      el("span", { class: "tileset-passage-paint-hint", text: "시트에서 클릭·드래그로 칠합니다" }),
    ],
  });
}

function renderPassageInspector(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const home = tileLayerHome(tileset, selectedTile);
  const homeLabel = home === "both" ? "양쪽" : home === "upper" ? "상위" : "하위";
  const mark = passageMarkForTile(tileset, selectedTile);
  const markLabel = mark === "x" ? "막힘" : mark === "star" ? "위 ★" : "통과";
  const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
  const passage = tileset.passability[selectedTile] ?? passableFlag();
  return el("section", {
    class: "tileset-db-selected-tile tileset-passage-inspector-body",
    dataset: { testid: "tileset-selected-tile-panel" },
    children: [
      el("div", {
        class: "tileset-db-selected-header",
        children: [
          el("strong", { text: `${selectedTile}번` }),
          el("span", {
            class: `tileset-selected-layer-badge layer-${home}`,
            dataset: { testid: "tileset-selected-layer-badge" },
            text: homeLabel,
          }),
          el("span", { text: markLabel }),
        ],
      }),
      el("div", {
        class: "tileset-passage-zoom-row",
        children: [renderTileZoom(tileset, selectedTile)],
      }),
      (() => {
        const details = el("details", {
          class: "tileset-autotile-advanced",
          dataset: { testid: "tileset-passage-compass-details" },
          children: [
            el("summary", { text: "방향별 통행" }),
            renderPassageCompass(tileset.id, passage, rerender),
          ],
        });
        if (compassOpen) details.setAttribute("open", "");
        details.addEventListener("toggle", () => {
          compassOpen = details.open;
        });
        return details;
      })(),
      ...renderRuleControls(tileset, rerender).filter((node) => String(node.className ?? "").includes("tileset-rule-layer")),
      el("div", {
        class: "tileset-legend-sheet-info",
        dataset: { testid: "tileset-sheet-info" },
        text: `${tileset.count}칸 · ${tileset.tilesPerRow}열×${rows}행`,
      }),
      el("ul", {
        class: "tileset-layer-legend",
        dataset: { testid: "tileset-layer-legend" },
        children: [
          el("li", { class: "tileset-legend-item layer-lower", text: "하위 = 초록 테두리" }),
          el("li", { class: "tileset-legend-item layer-upper", text: "상위 = 파란 테두리" }),
        ],
      }),
    ],
  });
}

function renderTileZoom(tileset: TilesetDef, tile: number): HTMLElement {
  const size = tileset.tileSize;
  const zoom = 4;
  const col = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  const sheetW = tileset.tilesPerRow * size * zoom;
  return el("div", {
    class: "tileset-passage-zoom",
    attrs: {
      title: `${tile}번`,
      style: [
        `width:${size * zoom}px`,
        `height:${size * zoom}px`,
        `background-image:url("${tilesetImageUrl(tileset)}")`,
        `background-size:${sheetW}px auto`,
        `background-position:-${col * size * zoom}px -${row * size * zoom}px`,
      ].join(";"),
    },
  });
}

function renderPassageCompass(tilesetId: string, passage: PassFlag, rerender: () => void): HTMLElement {
  const edge = (key: keyof PassFlag, glyph: string): HTMLElement =>
    el("button", {
      class: `tileset-passage-edge ${passage[key] ? "open" : "shut"}`,
      text: glyph,
      attrs: {
        type: "button",
        title: passage[key] ? "통과 — 누르면 막힘" : "막힘 — 누르면 통과",
        "aria-pressed": String(passage[key]),
      },
      dataset: { testid: `tileset-knowledge-passage-${key}` },
      on: {
        click: () => {
          recordProjectSnapshot();
          store.update((project) => {
            const target = project.tilesets[tilesetId];
            if (!target) return;
            target.passability[selectedTile] = togglePassageDirection(
              target.passability[selectedTile] ?? passableFlag(),
              key,
            );
            const blocked = isBlockedPassage(target.passability[selectedTile]);
            markUserTileRuntimeMetadata(target, selectedTile, { passage: blocked ? "solid" : "passable" });
          }, { scope: "project", label: "타일 통행 방향" });
          rerender();
        },
      },
    });
  return el("div", {
    class: "tileset-passage-compass",
    children: [
      el("span"),
      edge("up", "↑"),
      el("span"),
      edge("left", "←"),
      el("span", { class: "tileset-passage-compass-hub", text: "방향" }),
      edge("right", "→"),
      el("span"),
      edge("down", "↓"),
      el("span"),
    ],
  });
}

function renderSelectedTilePanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  const meta = metadataForTile(tileset, selectedTile);
  const home = tileLayerHome(tileset, selectedTile);
  const homeLabel = home === "both" ? "양쪽" : home === "upper" ? "상위" : "하위";
  const sourceLabel = meta.source === "user" ? "직접 편집" : meta.source === "bundled-default" ? "하네스" : meta.source === "ai" ? "AI" : "미정";
  return el("section", {
    class: "tileset-db-selected-tile",
    dataset: { testid: "tileset-selected-tile-panel" },
    children: [
      el("div", {
        class: "tileset-db-selected-header",
        children: [
          el("strong", { text: `${selectedTile}번 타일` }),
          el("span", {
            class: `tileset-selected-layer-badge layer-${home}`,
            dataset: { testid: "tileset-selected-layer-badge" },
            text: homeLabel,
          }),
          el("span", { text: `통행 ${passageText(tileset, selectedTile)}` }),
          el("span", {
            class: "tileset-selected-source-badge",
            dataset: { testid: "tileset-selected-source-badge" },
            text: sourceLabel,
          }),
        ],
      }),
      ...renderTileMeaningEditors(tileset, meta, tab),
      ...(tab === "rules" ? renderRuleControls(tileset, rerender) : []),
    ],
  });
}

// ── 타일 규칙 탭: 레이어(자동/하위/상위) + 통행 + 지면 종류 ──────
const POLICY_KIND_LABELS: Readonly<Record<TileLayerPolicyClass, string>> = {
  opaqueFloor: "불투명 바닥",
  transparentOverlay: "투명 오버레이(상위)",
  backedLower: "받침 있는 하위",
  transparentLower: "투명 하위(받침 없음)",
  multiPart: "다중 조각",
};

// 받침 선택 — 투명 칩을 하위에 둘 때 아래에 깔 타일. 자동은 정책 기본값을 따른다.
function renderBackingControls(tileset: TilesetDef, backingTile: number | null, rerender: () => void): HTMLElement[] {
  const home = tileLayerHome(tileset, selectedTile);
  // 내장 칩셋은 생성 목록, 커스텀 칩셋은 정책(명시 태그 + 픽셀 감지)이 투명 여부를 말한다.
  const transparent = isCombinedTownTileset(tileset)
    ? isTransparentChipsetTile(selectedTile)
    : tileLayerPolicy(tileset, selectedTile, chipsetTransparencyDetection(tileset)).transparent;
  if (!transparent || home === "upper") return [];
  const override = userTileBackingOverride(tileset, selectedTile);
  const current: TileBackingChoice = override ?? "auto";
  const backingButton = (value: TileBackingChoice, label: string): HTMLElement =>
    el("button", {
      class: `database-footer-button tileset-backing-choice${current === value ? " active" : ""}`,
      text: label,
      attrs: { type: "button", "aria-pressed": String(current === value) },
      dataset: { testid: `tileset-backing-${typeof value === "number" ? "tile" : value}` },
      on: {
        click: () => {
          updateBackingChoice(tileset.id, value);
          rerender();
        },
      },
    });
  return [
    el("fieldset", {
      class: "oprn-db-fieldset tileset-rule-layer-backing",
      dataset: { testid: "tileset-rule-backing" },
      children: [
        el("legend", { text: "배경(받침)" }),
        el("div", {
          class: "tileset-rule-buttons",
          children: [
            backingButton("auto", "자동"),
            backingButton("none", "없음"),
            backingButton(DEFAULT_TRUNK_BACKING_TILE, "잔디 받침"),
          ],
        }),
        el("div", {
          class: "tileset-rule-note",
          dataset: { testid: "tileset-backing-note" },
          text: backingTile === null ? "받침 없음 — 투명 픽셀 아래가 비어 보입니다." : `받침 타일 ${backingTile} 을 함께 그립니다.`,
        }),
      ],
    }),
  ];
}

// 배경 없는 하위 타일 검토 — 목록은 읽기만 하고, 적용은 사용자가 고른 항목에만 일어난다.
// 커스텀 칩셋이면 픽셀 감지가 이 목록을 채운다(메타는 그대로 둔 채로).
function renderBackgroundlessReview(tileset: TilesetDef, rerender: () => void): HTMLElement[] {
  // peek 이 캐시 미스면 스캔을 예약하고, 완료 이벤트가 규칙 탭을 한 번 다시 그린다.
  const scan = peekCustomChipsetAlphaScan(tileset);
  const reviews = backgroundlessLowerReviews(tileset, chipsetTransparencyDetection(tileset));
  const scanNotes = renderAlphaScanNotes(tileset, scan);
  if (reviews.length === 0) return scanNotes;
  const choiceButton = (tile: number, choice: TileLayerReviewChoice): HTMLElement =>
    el("button", {
      class: "database-footer-button tileset-review-choice",
      text: TILE_LAYER_REVIEW_CHOICE_LABELS[choice],
      attrs: { type: "button" },
      dataset: { testid: `tileset-review-${tile}-${choice}` },
      on: {
        click: () => {
          applyReviewChoice(tileset.id, tile, choice);
          rerender();
        },
      },
    });
  return [
    el("fieldset", {
      class: "oprn-db-fieldset tileset-rule-layer-review",
      dataset: { testid: "tileset-rule-review" },
      children: [
        el("legend", { text: `배경 없는 하위 타일 검토 (${reviews.length})` }),
        el("div", {
          class: "tileset-rule-note",
          text: "가져온 칩셋을 자동으로 상위로 옮기지 않습니다. 타일마다 직접 고르세요.",
        }),
        ...scanNotes,
        el("ul", {
          class: "tileset-review-list",
          dataset: { testid: "tileset-review-list" },
          children: reviews.slice(0, REVIEW_LIST_LIMIT).map((review) =>
            el("li", {
              class: "tileset-review-item",
              dataset: { testid: `tileset-review-item-${review.tile}` },
              children: [
                el("span", { class: "tileset-review-tile", text: `타일 ${review.tile}` }),
                ...(review.detected
                  ? [el("span", {
                      class: `tileset-review-detected detected-${review.detected}`,
                      dataset: { testid: `tileset-review-detected-${review.tile}` },
                      text: `픽셀 감지 ${TILE_ALPHA_CLASS_LABELS[review.detected]}`,
                    })]
                  : []),
                el("span", { class: "tileset-review-reason", text: review.reason }),
                el("div", {
                  class: "tileset-rule-buttons",
                  children: review.choices.map((choice) => choiceButton(review.tile, choice)),
                }),
              ],
            })
          ),
        }),
      ],
    }),
  ];
}

const REVIEW_LIST_LIMIT = 20;

/**
 * 픽셀 감지 상태를 정직하게 표시한다. 세 가지 답만 있다.
 *  - 아직 스캔 중: "읽는 중" (목록이 곧 채워진다)
 *  - 읽음: 부류별 칸 수 요약 (사용자가 감지를 믿을지 스스로 판단할 근거)
 *  - 못 읽음: "알 수 없음" + 이유. **불투명이라고 말하지 않는다.**
 */
function renderAlphaScanNotes(tileset: TilesetDef, scan: ReturnType<typeof cachedCustomChipsetAlphaScan>): HTMLElement[] {
  if (!isCustomTileset(tileset)) return [];
  if (!scan) {
    return [el("div", {
      class: "tileset-rule-note",
      dataset: { testid: "tileset-alpha-scan-pending" },
      text: "칩셋 픽셀을 읽는 중입니다 — 끝나면 검토 목록이 채워집니다.",
    })];
  }
  if (scan.status === "unknown") {
    return [el("div", {
      class: "tileset-rule-warning",
      dataset: { testid: "tileset-alpha-scan-unknown" },
      text: `⚠ 투명 여부 알 수 없음 — ${scan.unknownReason ?? "이미지를 읽지 못했습니다."} 불투명으로 단정하지 않았습니다.`,
    })];
  }
  const summary = summarizeTileAlphaScan(scan);
  return [el("div", {
    class: "tileset-rule-note",
    dataset: { testid: "tileset-alpha-scan-summary" },
    text: `픽셀 감지: 불투명 ${summary.opaque} · 부분 투명 ${summary.partial} · 거의 빈 칸 ${summary.mostlyEmpty} · 가장자리만 부드러움 ${summary.softEdge} · 빈 칸 ${summary.empty}`,
  })];
}

function applyReviewChoice(tilesetId: string, tile: number, choice: TileLayerReviewChoice): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    if (choice === "overlay") {
      setTileLayerOverride(target, tile, "upper");
      setTileBackingOverride(target, tile, "auto");
      return;
    }
    if (choice === "lowerWithBacking") {
      setTileLayerOverride(target, tile, "lower");
      setTileBackingOverride(target, tile, DEFAULT_TRUNK_BACKING_TILE);
      return;
    }
    if (choice === "transparentLower") {
      setTileLayerOverride(target, tile, "lower");
      setTileBackingOverride(target, tile, "none");
      return;
    }
    setTileLayerOverride(target, tile, "auto");
    setTileBackingOverride(target, tile, "auto");
  });
}

function renderRuleControls(tileset: TilesetDef, rerender: () => void): HTMLElement[] {
  const override = userTileLayerOverride(tileset, selectedTile);
  const choice: TileLayerChoice = override ?? "auto";
  const home = tileLayerHome(tileset, selectedTile);
  const policy = tileLayerPolicy(tileset, selectedTile, chipsetTransparencyDetection(tileset));
  // 내장 칩셋은 생성 목록, 커스텀 칩셋은 정책(명시 태그 + 픽셀 감지)이 투명 여부를 말한다.
  const transparent = isCombinedTownTileset(tileset) ? isTransparentChipsetTile(selectedTile) : policy.transparent;
  const homeLabel = home === "both" ? "양쪽" : home === "upper" ? "상위" : "하위";
  const blocked = isBlockedPassage(tileset.passability[selectedTile]);

  const layerButton = (value: TileLayerChoice, label: string): HTMLElement =>
    el("button", {
      class: `database-footer-button tileset-layer-choice${choice === value ? " active" : ""}`,
      text: label,
      attrs: { type: "button", "aria-pressed": String(choice === value) },
      dataset: { testid: `tileset-layer-${value}` },
      on: {
        click: () => {
          updateLayerChoice(tileset.id, value);
          rerender();
        },
      },
    });

  const passageButton = (isBlockedChoice: boolean, label: string): HTMLElement =>
    el("button", {
      class: `database-footer-button tileset-passage-choice${blocked === isBlockedChoice ? " active" : ""}`,
      text: label,
      attrs: { type: "button", "aria-pressed": String(blocked === isBlockedChoice) },
      dataset: { testid: `tileset-passage-${isBlockedChoice ? "blocked" : "open"}` },
      on: {
        click: () => {
          updatePassage(tileset.id, isBlockedChoice);
          rerender();
        },
      },
    });

  return [
    el("fieldset", {
      class: "oprn-db-fieldset tileset-rule-layer",
      dataset: { testid: "tileset-rule-layer" },
      children: [
        el("legend", { text: "레이어" }),
        el("div", { class: "tileset-rule-buttons", children: [layerButton("auto", "자동"), layerButton("lower", "하위"), layerButton("upper", "상위")] }),
        el("div", {
          class: "tileset-rule-note",
          dataset: { testid: "tileset-layer-note" },
          text: choice === "auto" ? `자동 판정: ${homeLabel}${transparent ? " (투명 배경 칩)" : ""}` : `사용자 확정: ${choice === "upper" ? "상위" : "하위"}`,
        }),
        ...(policy.home !== "upper" && transparent && policy.backingTile === null
          ? [el("div", {
              class: "tileset-rule-warning",
              dataset: { testid: "tileset-layer-warning" },
              text: "⚠ 투명 배경 칩을 받침 없이 하위에 깔면 투명 부분이 검게 보일 수 있습니다.",
            })]
          : []),
        el("div", {
          class: "tileset-rule-note",
          dataset: { testid: "tileset-layer-policy-reason" },
          text: `${POLICY_KIND_LABELS[policy.kind]} — ${policy.reason}`,
        }),
        ...(policy.multiPart
          ? [el("div", {
              class: "tileset-rule-note",
              dataset: { testid: "tileset-layer-multipart" },
              text: `다중 조각 제약: ${policy.multiPart.partnerLabel}(${policy.multiPart.partnerTiles.join(", ")})과 짝을 이룹니다.`,
            })]
          : []),
      ],
    }),
    ...renderBackingControls(tileset, policy.backingTile, rerender),
    ...renderBackgroundlessReview(tileset, rerender),
    el("fieldset", {
      class: "oprn-db-fieldset tileset-rule-passage",
      dataset: { testid: "tileset-rule-passage" },
      children: [
        el("legend", { text: "통행" }),
        el("div", { class: "tileset-rule-buttons", children: [passageButton(false, "통행"), passageButton(true, "차단")] }),
      ],
    }),
    numberControl("지면 종류", tileset.terrain[selectedTile] ?? 0, (value) => updateTerrain(tileset.id, value), "tileset-field-terrain-tag"),
  ];
}

/** 규칙 탭은 라벨만. 설명은 지식 탭의 접힌 details. */
function renderTileMeaningEditors(
  tileset: TilesetDef,
  meta: TileAiMetadata,
  tab: TilesetSectionTab,
): HTMLElement[] {
  const labelField = textControl("", meta.label, (value) => updateMetadata(tileset.id, { label: value }), "tileset-field-ai-label");
  if (tab !== "knowledge") {
    return [
      el("fieldset", {
        class: "oprn-db-fieldset tileset-tile-meaning-edit",
        dataset: { testid: "tileset-tile-meaning-edit" },
        children: [el("legend", { text: "라벨" }), labelField],
      }),
    ];
  }
  const summary = meta.label.trim() || "설명";
  return [
    el("fieldset", {
      class: "oprn-db-fieldset tileset-tile-meaning-edit",
      dataset: { testid: "tileset-tile-meaning-edit" },
      children: [
        el("legend", { text: "라벨" }),
        labelField,
        el("details", {
          class: "tileset-advanced-details",
          dataset: { testid: "tileset-tile-meaning-details" },
          children: [
            el("summary", { text: summary }),
            textAreaControl("설명", meta.description, (value) => updateMetadata(tileset.id, { description: value }), "tileset-field-ai-description"),
          ],
        }),
      ],
    }),
  ];
}

function applyActiveModeClick(tilesetId: string, tile: number): void {
  if (editMode === "passage") {
    applyPassageMark(tilesetId, tile, getTilesetPassagePaint());
    return;
  }
  if (editMode === "autotile") {
    const tileset = store.getCurrent().tilesets[tilesetId];
    if (tileset) applyAutotileSheetPick(tileset, tile);
    return;
  }
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    if (editMode === "terrain") {
      target.terrain[tile] = ((target.terrain[tile] ?? 0) + 1) % 10;
      markUserTileRuntimeMetadata(target, tile, { terrainTag: target.terrain[tile] });
    }
  }, { scope: "project", label: "타일 지면 종류" });
}

let passageStrokeOpen = false;

export function beginPassagePaintStroke(): void {
  if (passageStrokeOpen) return;
  recordProjectSnapshot();
  passageStrokeOpen = true;
}

export function endPassagePaintStroke(): void {
  passageStrokeOpen = false;
}

function applyPassageMark(tilesetId: string, tile: number, mark: PassageMark): void {
  const current = store.getCurrent().tilesets[tilesetId];
  if (!current || passageMarkForTile(current, tile) === mark) return;
  if (!passageStrokeOpen) recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    setPassageMark(target, tile, mark);
    markUserTileRuntimeMetadata(target, tile, { passage: PASSAGE_META[mark] });
  }, { scope: "project", label: "타일 통행" });
}

function updateLayerChoice(tilesetId: string, choice: TileLayerChoice): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) setTileLayerOverride(target, selectedTile, choice);
  });
}

function updateBackingChoice(tilesetId: string, choice: TileBackingChoice): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) setTileBackingOverride(target, selectedTile, choice);
  });
}

function updatePassage(tilesetId: string, blocked: boolean): void {
  applyPassageMark(tilesetId, selectedTile, blocked ? "x" : "o");
}

function updateTerrain(tilesetId: string, value: number): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    target.terrain[selectedTile] = value;
    markUserTileRuntimeMetadata(target, selectedTile, { terrainTag: value });
  });
}

function updateMetadata(tilesetId: string, patch: Partial<TileAiMetadata>): void {
  let nextMeta: TileAiMetadata | null = null;
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    const tileMeta = ensureTileMeta(target, selectedTile);
    nextMeta = confirmUserTileMetadata(tileMeta, patch);
    target.tileMeta![selectedTile] = nextMeta;
  });
  if (nextMeta) syncSelectedTileBadge(nextMeta);
}

function syncSelectedTileBadge(meta: TileAiMetadata): void {
  const cell = document.querySelector(`[data-testid="tileset-db-cell-${selectedTile}"]`);
  if (!cell) return;
  cell.textContent = meta.label.trim() || meta.description.trim() ? "AI" : "";
}

export function setTilesetMetadataEditMode(mode: TilesetEditMode, rerender: () => void): void {
  setMode(mode, rerender);
}

/** Legacy route shortcuts only. Call on navigation, not on local redraw. */
export function applyTilesetFolderFacet(tab: string): void {
  if (tab === "tilesetAutotile") {
    standaloneTab = null;
    editMode = "autotile";
    setUnlabeledOnlyFilter(false);
    return;
  }
  if (tab === "tilesetUnlabeled") {
    standaloneTab = null;
    editMode = "ai";
    setUnlabeledOnlyFilter(true);
    return;
  }
  // The primary tileset route retains the author's last internal section/mode.
}

export function getTilesetMetadataEditMode(): TilesetEditMode {
  return editMode;
}

export { getTilesetPassagePaint, setTilesetPassagePaint } from "@/editor/panels/tilesetPassagePaint";

export function getTilesetSectionTab(): TilesetSectionTab {
  return standaloneTab ?? tabForTilesetMode(editMode);
}

export function setTilesetSectionTab(tab: TilesetSectionTab, rerender: () => void): void {
  if (getTilesetSectionTab() === tab) return;
  standaloneTab = tab === "references" || tab === "settings" ? tab : null;
  if (!standaloneTab) editMode = TILESET_TAB_MODES[tab][0]!;
  rerender();
}

function setMode(mode: TilesetEditMode, rerender: () => void): void {
  standaloneTab = null;
  editMode = mode;
  rerender();
}

function clampSelectedTile(tileset: TilesetDef): void {
  if (selectedTile < 0 || selectedTile >= tileset.count) selectedTile = 0;
}
