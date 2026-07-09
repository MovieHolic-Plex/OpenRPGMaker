import { renderAiQuestionPanel } from "@/editor/panels/tilesetAiQuestionEditor";
import { renderAutotileEditorPanel } from "@/editor/panels/tilesetAutotileEditor";
import { renderChipsetPreviewPanel } from "@/editor/panels/tilesetChipsetPreview";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import {
  ensureTileMeta,
  metadataForTile,
  numberControl,
  passageText,
  textAreaControl,
} from "@/editor/panels/tilesetMetadataControls";
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
        rerender,
        onApplyModeTile: (tile) => applyActiveModeClick(tileset.id, tile),
        onSelectTile: (tile) => {
          selectedTile = tile;
        },
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
      renderSelectedTilePanel(tileset, rerender),
      ...(editMode === "ai" ? [renderAiQuestionPanel(tileset, rerender, selectFirstAppliedTile)] : []),
      ...(editMode === "group" ? [renderTileGroupPanel(tileset, rerender)] : []),
      ...(tab === "compose" ? [renderAutotileEditorPanel(tileset, rerender)] : []),
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
  return el("section", {
    class: "tileset-db-selected-tile",
    children: [
      el("div", {
        class: "tileset-db-selected-header",
        children: [
          el("strong", { text: `${selectedTile}번 타일` }),
          el("span", { text: `통행 ${passageText(tileset, selectedTile)}` }),
        ],
      }),
      ...(tab === "rules" ? renderRuleControls(tileset, rerender) : []),
      ...(tab === "knowledge" ? [renderSelectedTileUsage(tileset), ...renderKnowledgeFields(tileset, meta)] : []),
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

function renderKnowledgeFields(tileset: TilesetDef, meta: TileAiMetadata): HTMLElement[] {
  if (editMode !== "ai") return [];
  return [
    textAreaControl("AI 라벨", meta.label, (value) => updateMetadata(tileset.id, { label: value }), "tileset-field-ai-label"),
    textAreaControl("AI 설명", meta.description, (value) => updateMetadata(tileset.id, { description: value }), "tileset-field-ai-description"),
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
