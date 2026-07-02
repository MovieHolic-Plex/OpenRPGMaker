import { EDITOR_BRUSH_SIZES } from "@/editor/editorState";
import type { EditorState } from "@/editor/editorState";
import { canPlaceStructureStampOnMap, STRUCTURE_STAMPS } from "@/editor/structureStampTools";
import type { StructureStampId } from "@/editor/structureStampTools";
import { tileStampsForTile } from "@/editor/tileStampBrushes";
import { isFavoriteTile, toggleFavoriteTile } from "@/editor/panels/tileBrushTools";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import {
  selectRpgMakerEyedropperTool,
  selectRpgMakerStructureStamp,
  selectRpgMakerTileTool,
  setRpgMakerBrushSize,
  toggleRpgMakerTileStamp,
} from "@/editor/panels/rpgMakerTileToolbarActions";
import { makeSvgIcon } from "@/editor/panels/rpgMakerTileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/rpgMakerTileToolbarIcons";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { GameMap, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ToolbarMenuId = "inspector" | "brush" | "template" | null;

export type RpgMakerToolbarModel = {
  readonly state: EditorState;
  readonly map: Pick<GameMap, "tilesetId">;
  readonly tileset: TilesetDef;
  readonly rerender: () => void;
};

let openMenu: ToolbarMenuId = null;

export function makeInspectorDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const { state, tileset } = model;
  const wrapper = makeToolbarMenuWrapper("tile-inspector-menu");
  const active = openMenu === "inspector";
  wrapper.append(makeMenuToggle("inspector", "인스펙터", active, state.tool === "eyedropper" || state.activeStampId !== null, model.rerender));
  if (!active) return wrapper;

  const selectedTile = state.selectedTile;
  const tileLayer = selectedTile >= 0 ? (tileset.priority[selectedTile] ?? "lower") : "lower";
  const stamp = selectedTile >= 0 ? tileStampsForTile(selectedTile, tileset)[0] : null;
  const menu = el("div", { class: "rpg-maker-toolbar-dropdown rpg-maker-inspector-dropdown", attrs: { role: "menu" }, dataset: { testid: "tile-inspector-dropdown" } });
  menu.append(makeInspectorSummary(selectedTile, tileset, tileLayer));
  menu.append(makeOptionItem("즐겨찾기", isFavoriteTile(selectedTile), selectedTile < 0, () => {
    toggleFavoriteTile(selectedTile);
    model.rerender();
  }));
  menu.append(makeOptionItem("채우기", state.tool === "fill", false, () => {
    selectRpgMakerTileTool("fill");
    closeToolbarMenus();
    model.rerender();
  }));
  menu.append(makeOptionItem("스탬프", Boolean(stamp && state.activeStampId === stamp.id), !stamp, () => {
    toggleRpgMakerTileStamp(selectedTile, tileset);
    model.rerender();
  }));
  menu.append(makeOptionItem("스포이드", state.tool === "eyedropper", false, () => {
    selectRpgMakerEyedropperTool();
    closeToolbarMenus();
    model.rerender();
  }));
  wrapper.append(menu);
  return wrapper;
}

export function makeBrushDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const { state } = model;
  const wrapper = makeToolbarMenuWrapper("brush-size-menu");
  const active = openMenu === "brush";
  wrapper.append(makeMenuToggle("brush", `브러시 ${state.brushSize}`, active, state.brushSize > 1, model.rerender));
  if (!active) return wrapper;

  const menu = el("div", { class: "rpg-maker-toolbar-dropdown rpg-maker-brush-dropdown", attrs: { role: "menu" }, dataset: { testid: "brush-size-dropdown" } });
  for (const size of EDITOR_BRUSH_SIZES) {
    menu.append(makeOptionItem(`${size} x ${size}`, state.brushSize === size, false, () => {
      setRpgMakerBrushSize(size);
      closeToolbarMenus();
      model.rerender();
    }, `brush-size-${size}`));
  }
  wrapper.append(menu);
  return wrapper;
}

export function makeTemplateDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const { state, map } = model;
  const wrapper = makeToolbarMenuWrapper("structure-stamp-menu");
  const active = openMenu === "template";
  wrapper.append(makeMenuToggle("template", "템플릿", active, state.activeStructureStampId !== null, model.rerender));
  if (!active) return wrapper;

  const menu = el("div", { class: "rpg-maker-template-dropdown", attrs: { role: "menu" }, dataset: { testid: "structure-stamp-dropdown" } });
  for (const stamp of STRUCTURE_STAMPS) {
    const compatible = canPlaceStructureStampOnMap(map, stamp.id);
    const itemActive = compatible && state.activeStructureStampId === stamp.id;
    const item = el("button", {
      class: "rpg-maker-template-item" + (itemActive ? " active" : ""),
      attrs: {
        "aria-disabled": String(!compatible),
        "aria-label": stamp.description,
        "aria-pressed": String(itemActive),
        role: "menuitemradio",
        title: compatible ? stamp.description : structureStampDisabledHint(stamp.id),
      },
      children: [
        el("span", { class: "rpg-maker-template-label", text: stamp.label }),
        el("span", { class: "rpg-maker-template-description", text: stamp.description }),
      ],
      dataset: { testid: `structure-stamp-${stamp.id}` },
      on: {
        click: () => {
          if (!compatible) return;
          selectRpgMakerStructureStamp(stamp.id);
          closeToolbarMenus();
          model.rerender();
        },
      },
    });
    item.disabled = !compatible;
    menu.append(item);
  }
  wrapper.append(menu);
  return wrapper;
}

function makeInspectorSummary(selectedTile: number, tileset: TilesetDef, tileLayer: "lower" | "upper"): HTMLElement {
  return el("div", {
    class: "rpg-maker-inspector-summary",
    children: [
      el("div", { class: "rpg-maker-inspector-preview", attrs: { style: tilePreviewStyle(selectedTile, tileset) } }),
      makeInspectorField("타일", selectedTile >= 0 ? tileDisplayLabelForIndex(selectedTile) : "없음"),
      makeInspectorField("ID", selectedTile >= 0 ? String(selectedTile).padStart(4, "0") : "----"),
      makeInspectorField("레이어", tileLayer === "upper" ? "상위" : "하위"),
      makeInspectorField("통행", selectedTile >= 0 ? "통과" : "-"),
    ],
  });
}

function makeToolbarMenuWrapper(testId: string): HTMLElement {
  return el("div", { class: "rpg-maker-toolbar-menu", dataset: { testid: testId } });
}

function makeMenuToggle(menu: Exclude<ToolbarMenuId, null>, label: string, expanded: boolean, active: boolean, rerender: () => void): HTMLButtonElement {
  return el("button", {
    class: "rpg-maker-tile-tool" + (active ? " active" : ""),
    attrs: {
      "aria-expanded": String(expanded),
      "aria-haspopup": "menu",
      "aria-label": label,
      title: label,
    },
    children: [makeSvgIcon(menuIcon(menu))],
    dataset: { testid: `rpg-maker-tool-${menu}` },
    on: {
      click: () => {
        openMenu = expanded ? null : menu;
        rerender();
      },
    },
  });
}

function menuIcon(menu: Exclude<ToolbarMenuId, null>): SvgIconName {
  switch (menu) {
    case "brush":
      return "brush";
    case "inspector":
      return "inspector";
    case "template":
      return "template";
  }
}

function makeInspectorField(label: string, value: string): HTMLElement {
  return el("div", {
    class: "rpg-maker-inspector-field",
    children: [
      el("span", { class: "rpg-maker-inspector-field-label", text: label }),
      el("span", { class: "rpg-maker-inspector-field-value", text: value }),
    ],
  });
}

function makeOptionItem(label: string, active: boolean, disabled: boolean, action: () => void, testId?: string): HTMLButtonElement {
  const button = el("button", {
    class: "rpg-maker-option-item" + (active ? " active" : ""),
    attrs: { "aria-checked": String(active), "aria-disabled": String(disabled), role: "menuitemcheckbox", title: label },
    text: label,
    dataset: testId ? { testid: testId } : undefined,
    on: { click: action },
  });
  button.disabled = disabled;
  return button;
}

function closeToolbarMenus(): void {
  openMenu = null;
}

function tilePreviewStyle(selectedTile: number, tileset: TilesetDef): string {
  if (selectedTile < 0 || selectedTile >= tileset.count) return "";
  return tilesetTileBackgroundStyle(tileset, selectedTile, 32);
}

function structureStampDisabledHint(id: StructureStampId): string {
  if (id === "house-interior-10x10") return "Interior 칩셋 맵에서만 사용할 수 있습니다.";
  return "외부 칩셋 맵에서만 사용할 수 있습니다.";
}
