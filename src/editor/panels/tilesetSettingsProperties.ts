import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { textControl } from "@/editor/panels/databaseControls";
import { getTilesetSectionTab, setTilesetSectionTab } from "@/editor/panels/tilesetMetadataEditor";
import { TILESET_SECTION_TABS } from "@/editor/panels/tilesetUsageGuide";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type DisabledButtonSpec = {
  readonly extraClass?: string;
  readonly label: string;
  readonly testid: string;
  readonly title: string;
};

const DEFAULT_TRANSPARENT_COLOR = "#ff00ff";

export function renderTilesetProperties(tileset: TilesetDef, rerender: () => void): HTMLElement {
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
  colorInput.addEventListener("input", () => { hexInput.value = colorInput.value; });
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
    on: { click: () => { clearTilesetTransparentColor(tileset.id); rerender(); } },
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

function updateTilesetName(tilesetId: string, value: string): void {
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
    if (target) target.transparentColor = value;
  });
}

function clearTilesetTransparentColor(tilesetId: string): void {
  recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) delete target.transparentColor;
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

function colorInputValue(tileset: TilesetDef): string {
  return normalizeRgbHexColor(tileset.transparentColor ?? "") ?? DEFAULT_TRANSPARENT_COLOR;
}
