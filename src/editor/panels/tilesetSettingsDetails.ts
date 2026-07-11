import { textControl } from "@/editor/panels/databaseControls";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { renderPalettePresetEditor } from "@/editor/panels/palettePresetEditor";
import { renderTilesetCheckerSummary } from "@/editor/panels/tilesetCheckerSummary";
import { openTilesetReviewWizard } from "@/editor/panels/tilesetReviewWizard";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import {
  getTilesetSectionTab,
  renderTilesetMetadataEditor,
  setTilesetSectionTab,
} from "@/editor/panels/tilesetMetadataEditor";
import { openTilesetSettingsModal } from "@/editor/panels/tilesetPassageModal";
import { TILESET_SECTION_TABS, type TilesetSectionTab } from "@/editor/panels/tilesetUsageGuide";
import { store } from "@/project/store";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type DisabledButtonSpec = {
  readonly extraClass?: string;
  readonly label: string;
  readonly testid: string;
  readonly title: string;
};

const DEFAULT_TRANSPARENT_COLOR = "#ff00ff";

export function renderTilesetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  return el("section", {
    class: "tileset-db-editor simplified rm2k3-tileset-editor",
    children: [
      renderTilesetProperties(tileset, rerender),
      el("div", {
        class: "rm2k3-tileset-main",
        children: [renderTilesetMetadataEditor(tileset, rerender), renderTabSidePanel(tileset, tab, rerender)],
      }),
    ],
  });
}

function renderTilesetProperties(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-properties rm2k3-tileset-properties",
    children: [
      el("fieldset", {
        class: "rm2k3-db-fieldset rm2k3-tileset-name-field",
        dataset: { testid: "tileset-rm2k3-name" },
        children: [el("legend", { text: "이름" }), textControl("", tileset.name, (value) => updateTilesetName(tileset.id, value), "tileset-rm2k3-name-input")],
      }),
      el("fieldset", {
        class: "rm2k3-db-fieldset rm2k3-tileset-graphic-field",
        dataset: { testid: "tileset-rm2k3-graphic" },
        children: [
          el("legend", { text: "타일셋 그래픽" }),
          el("div", { class: "rm2k3-tileset-graphic-value", text: tileset.image.id }),
          disabledButton({
            extraClass: "rm2k3-browse-button",
            label: "...",
            testid: "tileset-rm2k3-graphic-browse",
            title: "타일셋 그래픽 교체는 리소스 관리자에서 처리합니다.",
          }),
        ],
      }),
      renderTransparentColorField(tileset, rerender),
      renderSectionTabs(rerender),
    ],
  });
}

// 3탭: 타일 규칙 / 타일 지식(단어장) / 구성 — 성격이 다른 기능을 한 화면에 쌓지 않는다.
function renderSectionTabs(rerender: () => void): HTMLElement {
  const active = getTilesetSectionTab();
  return el("div", {
    class: "tileset-section-tabs",
    attrs: { role: "tablist", "aria-label": "타일셋 섹션" },
    dataset: { testid: "tileset-section-tabs" },
    children: TILESET_SECTION_TABS.map((tab) =>
      el("button", {
        class: `database-footer-button tileset-section-tab${tab.id === active ? " active" : ""}`,
        text: tab.label,
        attrs: { type: "button", role: "tab", "aria-selected": String(tab.id === active) },
        dataset: { testid: `tileset-section-tab-${tab.id}` },
        on: { click: () => setTilesetSectionTab(tab.id, rerender) },
      }),
    ),
  });
}

function renderTabSidePanel(tileset: TilesetDef, tab: TilesetSectionTab, rerender: () => void): HTMLElement {
  if (tab === "rules") {
    const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
    return el("aside", {
      class: "rm2k3-tileset-terrain-pane tileset-rules-legend-pane",
      children: [
        el("fieldset", {
          class: "rm2k3-db-fieldset",
          dataset: { testid: "tileset-rules-side" },
          children: [
            el("legend", { text: "칩셋 범례" }),
            el("div", {
              class: "tileset-legend-sheet-info",
              dataset: { testid: "tileset-sheet-info" },
              text: `${tileset.count}칸 · ${tileset.tilesPerRow}열 × ${rows}행 · ${tileset.tileSize}px`,
            }),
            el("ul", {
              class: "tileset-layer-legend",
              dataset: { testid: "tileset-layer-legend" },
              children: [
                el("li", {
                  class: "tileset-legend-item layer-lower",
                  children: [
                    el("span", { class: "tileset-legend-swatch layer-lower", attrs: { "aria-hidden": "true" } }),
                    el("span", { text: "하위 — 지면·벽·몸통 (초록 테)" }),
                  ],
                }),
                el("li", {
                  class: "tileset-legend-item layer-upper",
                  children: [
                    el("span", { class: "tileset-legend-swatch layer-upper", attrs: { "aria-hidden": "true" } }),
                    el("span", { text: "상위 — 수관·지붕·오버레이 (파란 테)" }),
                  ],
                }),
                el("li", {
                  class: "tileset-legend-item layer-both",
                  children: [
                    el("span", { class: "tileset-legend-swatch layer-both", attrs: { "aria-hidden": "true" } }),
                    el("span", { text: "양쪽 — 어느 레이어에도 사용 가능" }),
                  ],
                }),
              ],
            }),
            el("ul", {
              class: "tileset-passage-legend",
              children: [
                el("li", { text: "O 통행 · X 차단 · ★ 상위 표시(하층 통행 따름)" }),
              ],
            }),
            el("button", {
              class: "database-footer-button rm2k3-global-terrain-button",
              text: "전체 칩셋 창 · 통행 (O/X/★)",
              attrs: { type: "button", title: "칩셋 그래픽 전체 시트를 별도 창에서 보고 통행을 편집" },
              dataset: { testid: "tileset-settings-open" },
              on: { click: () => openTilesetSettingsModal(tileset.id, rerender) },
            }),
            el("div", {
              class: "tileset-rule-note",
              text: "가운데 시트가 전체 칩셋입니다(스크롤로 하단 행까지). 우클릭 → 의미/통행/레이어. 필터 전체|하위|상위, 배율 2x(기본)·3x·4x, 휠·←→↑↓·중클릭 드래그. ‘하위’ 필터면 상위 타일이 어두워져 안 보이는 것처럼 느껴질 수 있으니 전체를 쓰세요.",
            }),
          ],
        }),
      ],
    });
  }
  if (tab === "knowledge") {
    return el("aside", {
      class: "rm2k3-tileset-terrain-pane",
      children: [
        renderTilesetCheckerSummary(tileset),
        el("button", {
          class: "database-footer-button",
          text: "AI 재감사",
          attrs: { type: "button" },
          dataset: { testid: "tileset-reaudit" },
          on: { click: () => openTilesetReviewWizard(tileset.id) },
        }),
        renderPalettePresetEditor(tileset, rerender),
      ],
    });
  }
  return el("aside", {
    class: "rm2k3-tileset-terrain-pane",
    children: [
      el("fieldset", {
        class: "rm2k3-db-fieldset rm2k3-tileset-autotile",
        children: [
          el("legend", { text: "자동타일 애니메이션" }),
          el("div", { class: "tileset-db-autotile-swatch" }),
          el("div", { class: "tileset-db-resource", text: passageSummary(tileset) }),
        ],
      }),
    ],
  });
}

function disabledButton(spec: DisabledButtonSpec): HTMLButtonElement {
  return el("button", {
    class: `database-footer-button ${spec.extraClass ?? ""} disabled`.trim(),
    text: spec.label,
    attrs: { type: "button", disabled: "true", title: spec.title },
    dataset: { testid: spec.testid },
  });
}

function updateTilesetName(tilesetId: string, value: string): void {
  // 텍스트 입력 스트림(키 입력마다 호출) — 1파 4c042b9와 동일하게 커밋 단위로 병합한다.
  recordCoalescedSnapshot(`tileset-name:${tilesetId}`);
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) target.name = value;
  });
}

function updateTilesetTransparentColor(tilesetId: string, value: string): void {
  recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    target.transparentColor = value;
  });
}

function clearTilesetTransparentColor(tilesetId: string): void {
  recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) delete target.transparentColor;
  });
}

function renderTransparentColorField(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const current = colorInputValue(tileset);
  const colorInput = el("input", {
    class: "rm2k3-transparent-color",
    attrs: { type: "color", title: "타일셋의 투명 처리할 색(색 키)", "aria-label": "투명색" },
    value: current,
    dataset: { testid: "tileset-transparent-color" },
  });
  const hexInput = el("input", {
    class: "rm2k3-transparent-hex",
    attrs: {
      type: "text",
      inputmode: "text",
      maxlength: "7",
      pattern: "#[0-9a-fA-F]{6}",
      spellcheck: "false",
      "aria-label": "투명색 HEX",
    },
    value: current,
    dataset: { testid: "tileset-transparent-hex" },
  });
  colorInput.addEventListener("input", () => {
    hexInput.value = colorInput.value;
  });
  colorInput.addEventListener("change", () => {
    updateTilesetTransparentColor(tileset.id, colorInput.value);
    rerender();
  });
  hexInput.addEventListener("input", () => {
    const normalized = normalizeRgbHexColor(hexInput.value);
    if (normalized) colorInput.value = normalized;
  });
  hexInput.addEventListener("change", () => {
    const normalized = normalizeRgbHexColor(hexInput.value);
    if (!normalized) {
      const fallback = colorInputValue(store.getCurrent().tilesets[tileset.id] ?? tileset);
      hexInput.value = fallback;
      colorInput.value = fallback;
      return;
    }
    hexInput.value = normalized;
    colorInput.value = normalized;
    updateTilesetTransparentColor(tileset.id, normalized);
    rerender();
  });
  const resetButton = el("button", {
    class: "database-footer-button",
    text: "기본값으로",
    attrs: { type: "button", title: "칩셋 기본 투명색으로 되돌리기" },
    dataset: { testid: "tileset-transparent-reset" },
    on: {
      click: () => {
        clearTilesetTransparentColor(tileset.id);
        rerender();
      },
    },
  });
  resetButton.disabled = !tileset.transparentColor;
  return el("fieldset", {
    class: "rm2k3-db-fieldset rm2k3-tileset-transparent-field",
    dataset: { testid: "tileset-transparent-field" },
    children: [
      el("legend", { text: "투명색" }),
      el("div", { class: "rm2k3-transparent-row", children: [colorInput, hexInput, resetButton] }),
    ],
  });
}

function colorInputValue(tileset: TilesetDef): string {
  return normalizeRgbHexColor(tileset.transparentColor ?? "") ?? DEFAULT_TRANSPARENT_COLOR;
}

function passageSummary(tileset: TilesetDef): string {
  const marks = Array.from({ length: tileset.count }, (_unused, index) => passageMarkForTile(tileset, index));
  const open = marks.filter((mark) => mark === "o").length;
  const blocked = marks.filter((mark) => mark === "x").length;
  const upper = marks.filter((mark) => mark === "star").length;
  return `O ${open} / X ${blocked} / * ${upper}`;
}
