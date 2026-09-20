import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetFrameCount, bundledChipsetTileSize, bundledChipsetTilesPerRow, TILE_FRAME_COUNT } from "@/assets/bundled";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { textControl } from "@/editor/panels/databaseControls";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { getTilesetSectionTab, setTilesetSectionTab } from "@/editor/panels/tilesetMetadataEditor";
import { TILESET_SECTION_TABS } from "@/editor/panels/tilesetUsageGuide";
import { tilesetImageSourceUrl } from "@/editor/tilesetImage";
import { unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const DEFAULT_TRANSPARENT_COLOR = "#ff00ff";

export function renderTilesetProperties(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-properties oprn-tileset-properties",
    children: [
      el("fieldset", {
        class: "oprn-db-fieldset oprn-tileset-name-field",
        dataset: { testid: "tileset-oprn-name" },
        children: [el("legend", { text: "이름" }), textControl("", tileset.name, (value) => updateTilesetName(tileset.id, value), "tileset-oprn-name-input")],
      }),
      el("fieldset", {
        class: "oprn-db-fieldset oprn-tileset-graphic-field",
        dataset: { testid: "tileset-oprn-graphic" },
        children: [
          el("legend", { text: "타일셋 그래픽" }),
          el("div", {
            class: "oprn-tileset-graphic-value",
            text: chipsetDisplayName(tileset.image.id),
            attrs: { title: tileset.image.id },
          }),
          el("button", {
            class: "database-footer-button oprn-browse-button",
            text: "설정...",
            attrs: { type: "button", title: "타일셋 그래픽 고르기" },
            dataset: { testid: "tileset-oprn-graphic-browse" },
            on: { click: () => openTilesetGraphicPicker(tileset, rerender) },
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
    class: "oprn-transparent-color",
    attrs: { type: "color", title: "타일셋의 투명 처리할 색(색 키)", "aria-label": "투명색" },
    value: current,
    dataset: { testid: "tileset-transparent-color" },
  });
  const hexInput = el("input", {
    class: "oprn-transparent-hex",
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
    attrs: { type: "button", title: "그림판 기본 투명색으로 되돌리기" },
    dataset: { testid: "tileset-transparent-reset" },
    on: { click: () => { clearTilesetTransparentColor(tileset.id); rerender(); } },
  });
  resetButton.disabled = !tileset.transparentColor;
  return el("fieldset", {
    class: "oprn-db-fieldset oprn-tileset-transparent-field",
    dataset: { testid: "tileset-transparent-field" },
    children: [
      el("legend", { text: "투명색" }),
      el("div", { class: "oprn-transparent-row", children: [colorInput, hexInput, resetButton] }),
    ],
  });
}

const CHIPSET_KO: Record<string, string> = {
  tex_easyrpg_chipset_dungeon: "던전",
  tex_easyrpg_chipset_interior: "실내",
  tex_easyrpg_chipset_ship: "배",
  tex_easyrpg_chipset_world: "월드맵",
  tex_easyrpg_chipset_retro_dungeon: "레트로 던전",
  tex_easyrpg_chipset_retro_exterior: "레트로 바깥",
  tex_easyrpg_chipset_retro_house: "레트로 집",
  tex_easyrpg_chipset_combined_town: "마을",
  tex_easyrpg_chipset_retro_world: "레트로 월드맵",
  tex_easyrpg_chipset_combined_town_retro_world: "마을+레트로 월드맵",
};

function chipsetDisplayName(imageId: string): string {
  return CHIPSET_KO[imageId] ?? BUNDLED_EASYRPG_CHIPSET_ASSETS.find((asset) => asset.textureKey === imageId)?.name ?? imageId;
}

function openTilesetGraphicPicker(tileset: TilesetDef, rerender: () => void): void {
  const applyImage = (image: TilesetDef["image"]): void => {
    const sameId = tileset.image.type === image.type && tileset.image.id === image.id;
    if (sameId && !needsChipsetGeometry(tileset)) {
      closeTilesetGraphicPicker();
      return;
    }
    recordProjectSnapshot();
    store.update((project) => {
      const target = project.tilesets[tileset.id];
      if (!target) return;
      if (!sameId) target.image = image;
      if (isChipsetSource(image, project)) applyChipsetGeometry(target);
    });
    closeTilesetGraphicPicker();
    rerender();
  };
  const bundled = BUNDLED_EASYRPG_CHIPSET_ASSETS.map((asset) =>
    graphicChoiceButton(chipsetDisplayName(asset.textureKey), { type: "bundled", id: asset.textureKey }, tileset.image.id, () =>
      applyImage({ type: "bundled", id: asset.textureKey }),
    ),
  );
  const uploaded = Object.entries(store.getCurrent().assets.uploaded ?? {})
    .filter(([, asset]) => asset.kind === "chipset" || asset.kind === "tileset")
    .map(([id, asset]) =>
      graphicChoiceButton(asset.name || id, { type: "uploaded", id }, tileset.image.id, () => applyImage({ type: "uploaded", id })),
    );
  openDialog(
    "tileset-graphic-picker",
    "타일셋 그래픽 고르기",
    [
      el("p", {
        class: "tileset-graphic-picker-lead",
        text: "고르면 이 타일셋의 그림이 바뀝니다. 칸 수와 통행 규칙은 그대로 남습니다.",
      }),
      el("div", {
        class: "tileset-graphic-picker-list",
        attrs: { role: "listbox", "aria-label": "타일셋 그래픽" },
        children: [...bundled, ...uploaded],
      }),
    ],
    [{ label: "닫기", testid: "tileset-graphic-picker-close" }],
  );
}

function closeTilesetGraphicPicker(): void {
  const overlay = document.querySelector("[data-testid='tileset-graphic-picker']");
  if (overlay) {
    unregisterModal(overlay);
    overlay.remove();
  }
}

function isChipsetSource(image: TilesetDef["image"], project: ReturnType<typeof store.getCurrent>): boolean {
  if (image.type === "bundled") {
    return BUNDLED_EASYRPG_CHIPSET_ASSETS.some((asset) => asset.textureKey === image.id);
  }
  const kind = project.assets.uploaded?.[image.id]?.kind;
  return kind === "chipset" || kind === "tileset";
}

function applyChipsetGeometry(tileset: TilesetDef): void {
  tileset.tilesPerRow = bundledChipsetTilesPerRow(tileset.image.id);
  tileset.tileSize = bundledChipsetTileSize(tileset.image.id);
  resizeTilesetSlotArrays(tileset, bundledChipsetFrameCount(tileset.image.id));
  if (tileset.count > TILE_FRAME_COUNT) tileset.kind = "custom";
}

function needsChipsetGeometry(tileset: TilesetDef): boolean {
  return (
    tileset.tilesPerRow !== bundledChipsetTilesPerRow(tileset.image.id) ||
    tileset.tileSize !== bundledChipsetTileSize(tileset.image.id) ||
    tileset.count !== bundledChipsetFrameCount(tileset.image.id) ||
    tileset.passability.length !== bundledChipsetFrameCount(tileset.image.id)
  );
}

function resizeTilesetSlotArrays(tileset: TilesetDef, newCount: number): void {
  const open = { up: true, down: true, left: true, right: true };
  while (tileset.passability.length < newCount) tileset.passability.push({ ...open });
  while (tileset.priority.length < newCount) tileset.priority.push("lower");
  while (tileset.terrain.length < newCount) tileset.terrain.push(0);
  if (tileset.tileMeta) {
    while (tileset.tileMeta.length < newCount) tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
  }
  tileset.passability.length = newCount;
  tileset.priority.length = newCount;
  tileset.terrain.length = newCount;
  if (tileset.tileMeta) tileset.tileMeta.length = Math.min(tileset.tileMeta.length, newCount);
  tileset.count = newCount;
}

/**
 * 그래픽 고르기 항목.
 *
 * 예전에는 10px 글자 알약 13 개뿐이라 「그림 고르기」인데 그림이 하나도 없었다.
 * 실제 시트를 축소해 보여준다 — 이름만 보고 고르는 것보다 훨씬 빠르다.
 */
function graphicChoiceButton(
  label: string,
  image: TilesetDef["image"],
  selectedId: string,
  onPick: () => void,
): HTMLElement {
  const selected = image.id === selectedId;
  return el("button", {
    class: `tileset-graphic-option${selected ? " is-selected" : ""}`,
    attrs: { type: "button", role: "option", "aria-selected": String(selected), title: `${label}\n${image.id}` },
    dataset: { testid: `tileset-graphic-option-${image.id}` },
    on: { click: onPick },
    children: [
      el("span", {
        class: "tileset-graphic-option-thumb",
        attrs: { style: `background-image:url("${tilesetImageSourceUrl(image)}")`, "aria-hidden": "true" },
      }),
      el("span", { class: "tileset-graphic-option-name", text: label }),
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

function colorInputValue(tileset: TilesetDef): string {
  return normalizeRgbHexColor(tileset.transparentColor ?? "") ?? DEFAULT_TRANSPARENT_COLOR;
}
