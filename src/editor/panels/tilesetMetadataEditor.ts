import { renderAiQuestionPanel } from "@/editor/panels/tilesetAiQuestionEditor";
import { renderAutotileEditorPanel } from "@/editor/panels/tilesetAutotileEditor";
import { renderChipsetPreviewPanel } from "@/editor/panels/tilesetChipsetPreview";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
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
import {
  tabForTilesetMode,
  TILESET_TAB_MODES,
  TILESET_EDIT_MODES,
  type TilesetEditMode,
  type TilesetSectionTab,
} from "@/editor/panels/tilesetUsageGuide";
import { markUserTileRuntimeMetadata, setTileLayerOverride, userTileLayerOverride, type TileLayerChoice } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { isTransparentChipsetTile } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import { isCombinedTownTileset } from "@/project/tilesetHarness";
import { summarizeTileUsage } from "@/project/tilesetSemanticChecker";
import { blockedFlag, isBlockedPassage, passableFlag } from "@/project/tilesetPassage";
import type { TileAiMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

let selectedTile = 0;
let editMode: TilesetEditMode = "passage";

export function renderTilesetMetadataEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  clampSelectedTile(tileset);
  return el("div", {
    class: "tileset-db-edit-area",
    children: [
      renderEditSidebar(tileset, rerender),
      renderChipsetPreviewPanel({
        tileset,
        mode: editMode,
        selectedTile,
        unlabeledOnly: getUnlabeledOnlyFilter(),
        rerender,
        onApplyModeTile: (tile) => applyActiveModeClick(tileset.id, tile),
        onSelectTile: (tile, options) => {
          selectedTile = tile;
          // quiet: 우클릭 메뉴 — 전체 리마운트/스크롤 점프 금지
          if (options?.quiet) return;
          rerender();
        },
        onOpenFullSheet: () => openTilesetSettingsModal(tileset.id, rerender),
      }),
    ],
  });
}

function renderEditSidebar(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  const toolbox = renderToolBox(rerender);
  return el("div", {
    class: "tileset-db-edit-sidebar",
    children: [
      ...(toolbox ? [toolbox] : []),
      ...(tab === "knowledge" ? [renderUnlabeledQueuePanel(tileset, rerender)] : []),
      renderSelectedTilePanel(tileset, rerender),
      ...(editMode === "ai" ? [renderAiQuestionPanel(tileset, rerender, selectFirstAppliedTile)] : []),
      ...(editMode === "group" ? [renderTileGroupPanel(tileset, rerender)] : []),
      ...(tab === "compose" ? [renderAutotileEditorPanel(tileset, rerender)] : []),
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
          el("strong", { text: "미라벨 타일 큐" }),
          el("span", {
            dataset: { testid: "tileset-unlabeled-count" },
            text: unlabeled.length === 0 ? "완료" : `${unlabeled.length}개 남음`,
          }),
        ],
      }),
      el("p", {
        class: "tileset-rule-note",
        text: "라벨·설명이 둘 다 비어 있는 칩. 아래 필드로 채운 뒤 다음 → 로 순회합니다. 칩셋 미리보기의「미라벨」필터와 연동.",
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
            text: idxInQueue >= 0 ? `다음 (${idxInQueue + 1}/${unlabeled.length})` : "첫 미라벨",
            attrs: { type: "button", ...(unlabeled.length === 0 ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-unlabeled-next" },
            on: { click: () => go(1) },
          }),
          el("button", {
            class: `database-footer-button${filterOn ? " active" : ""}`,
            text: filterOn ? "미라벨 필터 ON" : "미라벨 필터",
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
  if (modes.length <= 1) return null;
  return el("div", {
    class: "tileset-db-tools",
    attrs: { role: "tablist", "aria-label": "타일셋 작업" },
    children: modes.map((modeId) => {
      const guide = TILESET_EDIT_MODES.find((entry) => entry.id === modeId);
      return el("button", {
        class: modeId === editMode ? "active" : "",
        text: guide?.label ?? modeId,
        attrs: { type: "button", role: "tab", "aria-selected": String(modeId === editMode) },
        dataset: { testid: `tileset-edit-mode-${modeId}` },
        on: { click: () => setMode(modeId, rerender) },
      });
    }),
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
      // 라벨/설명: 탭·모드와 무관하게 항상 편집 (칩 클릭 → 바로 고치기)
      ...renderTileMeaningEditors(tileset, meta),
      ...(tab === "rules" ? renderRuleControls(tileset, rerender) : []),
      ...(tab === "knowledge" ? [renderSelectedTileUsage(tileset)] : []),
    ],
  });
}

// ── 타일 규칙 탭: 레이어(자동/하위/상위) + 통행 + 지형 태그 ──────
function renderRuleControls(tileset: TilesetDef, rerender: () => void): HTMLElement[] {
  const override = userTileLayerOverride(tileset, selectedTile);
  const choice: TileLayerChoice = override ?? "auto";
  const home = tileLayerHome(tileset, selectedTile);
  const transparent = isCombinedTownTileset(tileset) && isTransparentChipsetTile(selectedTile);
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
      class: "rm2k3-db-fieldset tileset-rule-layer",
      dataset: { testid: "tileset-rule-layer" },
      children: [
        el("legend", { text: "레이어" }),
        el("div", { class: "tileset-rule-buttons", children: [layerButton("auto", "자동"), layerButton("lower", "하위"), layerButton("upper", "상위")] }),
        el("div", {
          class: "tileset-rule-note",
          dataset: { testid: "tileset-layer-note" },
          text: choice === "auto" ? `자동 판정: ${homeLabel}${transparent ? " (투명 배경 칩)" : ""}` : `사용자 확정: ${choice === "upper" ? "상위" : "하위"}`,
        }),
        ...(choice === "lower" && transparent
          ? [el("div", {
              class: "tileset-rule-warning",
              dataset: { testid: "tileset-layer-warning" },
              text: "⚠ 투명 배경 칩을 하위에 깔면 투명 부분이 검게 보일 수 있습니다.",
            })]
          : []),
      ],
    }),
    el("fieldset", {
      class: "rm2k3-db-fieldset tileset-rule-passage",
      dataset: { testid: "tileset-rule-passage" },
      children: [
        el("legend", { text: "통행" }),
        el("div", { class: "tileset-rule-buttons", children: [passageButton(false, "통행"), passageButton(true, "차단")] }),
      ],
    }),
    numberControl("지형 태그", tileset.terrain[selectedTile] ?? 0, (value) => updateTerrain(tileset.id, value), "tileset-field-terrain-tag"),
  ];
}

/** 선택 타일 라벨·설명 — 데이터베이스에서 바로 고치는 주 진입점. */
function renderTileMeaningEditors(tileset: TilesetDef, meta: TileAiMetadata): HTMLElement[] {
  return [
    el("fieldset", {
      class: "rm2k3-db-fieldset tileset-tile-meaning-edit",
      dataset: { testid: "tileset-tile-meaning-edit" },
      children: [
        el("legend", { text: "의미 (라벨·설명)" }),
        el("div", {
          class: "tileset-rule-note",
          text: "칩을 클릭한 뒤 여기서 고칩니다. 저장은 DB 확인/프로젝트 저장. source=user 로 표시되어 AI 검색·하네스보다 우선합니다.",
        }),
        textAreaControl("라벨", meta.label, (value) => updateMetadata(tileset.id, { label: value }), "tileset-field-ai-label"),
        textAreaControl("설명", meta.description, (value) => updateMetadata(tileset.id, { description: value }), "tileset-field-ai-description"),
      ],
    }),
  ];
}

function renderSelectedTileUsage(tileset: TilesetDef): HTMLElement {
  const usage = summarizeTileUsage(tileset, selectedTile);
  return el("section", {
    class: "tileset-db-selected-tile tileset-selected-usage",
    dataset: { testid: "tileset-selected-usage" },
    children: [
      el("div", { class: "tileset-selected-label", dataset: { testid: "tileset-selected-meaning" }, text: usage.label }),
      renderTagRow(usage.tags),
      el("div", { class: "tileset-selected-description", text: usage.description }),
      el("div", {
        class: "tileset-selected-groups",
        children: usage.groups.length > 0
          ? usage.groups.map((group) =>
              el("div", {
                class: "tileset-selected-group",
                text: `${group.name} / ${group.role} / ${group.defaultLayer}`,
              })
            )
          : [el("div", { class: "tileset-selected-group empty", text: "No semantic group" })],
      }),
      el("div", { class: "tileset-selected-rules", dataset: { testid: "tileset-selected-rules" }, text: usage.ruleText }),
    ],
  });
}

function renderTagRow(tags: readonly string[]): HTMLElement {
  return el("div", {
    class: "tileset-selected-tags",
    dataset: { testid: "tileset-selected-tags" },
    children: tags.length > 0
      ? tags.map((tag) => el("span", { class: "tileset-meaning-tag", text: tag }))
      : [el("span", { class: "tileset-meaning-tag empty", text: "untagged" })],
  });
}

function applyActiveModeClick(tilesetId: string, tile: number): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    if (editMode === "passage") {
      // 통행<->차단 토글. 레이어는 레이어 컨트롤로만 바꾼다(★ 순환 폐지 — 투명 칩 규칙과 충돌 방지).
      const blocked = isBlockedPassage(target.passability[tile]);
      target.passability[tile] = blocked ? passableFlag() : blockedFlag();
      markUserTileRuntimeMetadata(target, tile, { passage: blocked ? "passable" : "solid" });
    }
    if (editMode === "terrain") {
      target.terrain[tile] = ((target.terrain[tile] ?? 0) + 1) % 10;
      markUserTileRuntimeMetadata(target, tile, { terrainTag: target.terrain[tile] });
    }
  });
}

function updateLayerChoice(tilesetId: string, choice: TileLayerChoice): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) setTileLayerOverride(target, selectedTile, choice);
  });
}

function updatePassage(tilesetId: string, blocked: boolean): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    target.passability[selectedTile] = blocked ? blockedFlag() : passableFlag();
    markUserTileRuntimeMetadata(target, selectedTile, { passage: blocked ? "solid" : "passable" });
  });
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
    if (patch.label !== undefined) tileMeta.label = patch.label;
    if (patch.description !== undefined) tileMeta.description = patch.description;
    tileMeta.source = "user";
    nextMeta = { ...tileMeta };
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

export function getTilesetMetadataEditMode(): TilesetEditMode {
  return editMode;
}

export function getTilesetSectionTab(): TilesetSectionTab {
  return tabForTilesetMode(editMode);
}

export function setTilesetSectionTab(tab: TilesetSectionTab, rerender: () => void): void {
  if (getTilesetSectionTab() !== tab) editMode = TILESET_TAB_MODES[tab][0];
  rerender();
}

function setMode(mode: TilesetEditMode, rerender: () => void): void {
  editMode = mode;
  rerender();
}

function selectFirstAppliedTile(tiles: readonly number[]): void {
  selectedTile = tiles[0] ?? selectedTile;
}

function clampSelectedTile(tileset: TilesetDef): void {
  if (selectedTile < 0 || selectedTile >= tileset.count) selectedTile = 0;
}
