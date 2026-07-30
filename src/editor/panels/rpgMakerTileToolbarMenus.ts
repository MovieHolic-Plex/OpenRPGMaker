import { EDITOR_BRUSH_SIZES } from "@/editor/editorState";
import type { EditorState } from "@/editor/editorState";
import { copySelection, pasteClipboard } from "@/editor/mapClipboard";
import { mapHistoryEntryCount, renderMapHistoryPanel } from "@/editor/panels/mapHistoryPanel";
import { renderRuleAuditPanel, ruleAuditViolationCount } from "@/editor/panels/ruleAuditPanel";
import { isFavoriteTile, toggleFavoriteTile } from "@/editor/panels/tileBrushTools";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import {
  selectRpgMakerEyedropperTool,
  selectRpgMakerTileTool,
  setRpgMakerBrushSize,
} from "@/editor/panels/rpgMakerTileToolbarActions";
import { makeSvgIcon } from "@/editor/panels/rpgMakerTileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/rpgMakerTileToolbarIcons";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { GameMap, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ToolbarMenuId = "inspector" | "overflow" | "ruleAudit" | "history" | null;
type OpenToolbarMenuId = Exclude<ToolbarMenuId, null>;
type SvgToolbarMenuId = Exclude<OpenToolbarMenuId, "ruleAudit" | "history">;

export type RpgMakerToolbarModel = {
  readonly state: EditorState;
  readonly map: Pick<GameMap, "id" | "tilesetId">;
  readonly tileset: TilesetDef;
  readonly rerender: () => void;
};

let openMenu: ToolbarMenuId = null;
const TOOLBAR_MENU_ICONS = { inspector: "inspector", overflow: "more" } as const satisfies Record<SvgToolbarMenuId, SvgIconName>;

export function makeInspectorDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const { state, tileset } = model;
  const wrapper = makeToolbarMenuWrapper("tile-inspector-menu");
  const active = openMenu === "inspector";
  wrapper.append(makeMenuToggle("inspector", "인스펙터", active, state.tool === "eyedropper", model.rerender));
  if (!active) return wrapper;

  const selectedTile = state.selectedTile;
  const tileLayer = selectedTile >= 0 ? (tileset.priority[selectedTile] ?? "lower") : "lower";
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
  menu.append(makeOptionItem("스포이드", state.tool === "eyedropper", false, () => {
    selectRpgMakerEyedropperTool();
    closeToolbarMenus();
    model.rerender();
  }));
  wrapper.append(menu);
  return wrapper;
}

export function makeRuleAuditDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const wrapper = makeToolbarMenuWrapper("tile-rule-audit-menu");
  const active = openMenu === "ruleAudit";
  const count = ruleAuditViolationCount();
  const toggle = makeMenuToggle("ruleAudit", "규칙 감사", active, count > 0, model.rerender);
  if (count > 0) toggle.append(makeToolbarBadge(count, "rule-audit-badge", true));
  wrapper.append(toggle);
  if (!active) return wrapper;

  const menu = el("div", {
    class: "rpg-maker-toolbar-dropdown rpg-maker-rule-audit-dropdown",
    attrs: { role: "menu" },
    dataset: { testid: "tile-rule-audit-dropdown" },
  });
  menu.append(renderRuleAuditPanel());
  wrapper.append(menu);
  return wrapper;
}

export function makeHistoryDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const wrapper = makeToolbarMenuWrapper("tile-history-menu");
  const active = openMenu === "history";
  const count = mapHistoryEntryCount();
  const toggle = makeMenuToggle("history", "작업 기록", active, count > 0, model.rerender);
  if (count > 0) toggle.append(makeToolbarBadge(count, "history-badge", false));
  wrapper.append(toggle);
  if (!active) return wrapper;

  const menu = el("div", {
    class: "rpg-maker-toolbar-dropdown rpg-maker-history-dropdown",
    attrs: { role: "menu" },
    dataset: { testid: "tile-history-dropdown" },
  });
  menu.append(renderMapHistoryPanel());
  wrapper.append(menu);
  return wrapper;
}

/**
 * ⋯ 오버플로 메뉴 — 저빈도 컨트롤을 한 토글로 묶는다:
 * 복사/붙여넣기, 인스펙터/규칙/기록, 브러시 크기.
 * copy-button/paste-button/brush-size-N testid는 그대로 승계.
 */
export function makeOverflowDropdown(model: RpgMakerToolbarModel): HTMLElement {
  const { state, map, tileset } = model;
  const wrapper = makeToolbarMenuWrapper("toolbar-overflow-menu");
  const panelOpen = openMenu === "overflow" || openMenu === "inspector" || openMenu === "ruleAudit" || openMenu === "history";
  const ruleCount = ruleAuditViolationCount();
  const historyCount = mapHistoryEntryCount();
  const highlighted = state.brushSize > 1 || ruleCount > 0;
  const toggle = makeMenuToggle("overflow", "더 보기", panelOpen, highlighted, model.rerender);
  if (ruleCount > 0) toggle.append(makeToolbarBadge(ruleCount, "rule-audit-badge", true));
  wrapper.append(toggle);
  if (!panelOpen) return wrapper;

  const menu = el("div", {
    class: "rpg-maker-toolbar-dropdown rpg-maker-overflow-dropdown",
    attrs: { role: "menu" },
    dataset: { testid: "toolbar-overflow-dropdown" },
  });

  menu.append(makeOverflowSectionLabel("편집"));
  menu.append(makeOptionItem("복사 (선택 영역)", false, false, () => {
    void copySelection(map.id);
    closeToolbarMenus();
    model.rerender();
  }, "copy-button"));
  menu.append(makeOptionItem("붙여넣기", false, false, () => {
    const target = state.selection ?? { x: 0, y: 0 };
    void pasteClipboard(map.id, target.x, target.y);
    closeToolbarMenus();
    model.rerender();
  }, "paste-button"));

  menu.append(makeOverflowSectionLabel("검사"));
  menu.append(makeOptionItem("인스펙터", openMenu === "inspector", false, () => {
    openMenu = openMenu === "inspector" ? "overflow" : "inspector";
    model.rerender();
  }, "rpg-maker-tool-inspector"));
  menu.append(makeOptionItem(
    ruleCount > 0 ? `규칙 감사 (${ruleCount})` : "규칙 감사",
    openMenu === "ruleAudit",
    false,
    () => {
      openMenu = openMenu === "ruleAudit" ? "overflow" : "ruleAudit";
      model.rerender();
    },
    "toolbar-toggle-ruleAudit",
  ));
  menu.append(makeOptionItem(
    historyCount > 0 ? `작업 기록 (${historyCount})` : "작업 기록",
    openMenu === "history",
    false,
    () => {
      openMenu = openMenu === "history" ? "overflow" : "history";
      model.rerender();
    },
    "toolbar-toggle-history",
  ));

  if (openMenu === "inspector") {
    const selectedTile = state.selectedTile;
    const tileLayer = selectedTile >= 0 ? (tileset.priority[selectedTile] ?? "lower") : "lower";
    menu.append(makeOverflowSectionLabel("인스펙터"));
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
    menu.append(makeOptionItem("스포이드", state.tool === "eyedropper", false, () => {
      selectRpgMakerEyedropperTool();
      closeToolbarMenus();
      model.rerender();
    }));
  } else if (openMenu === "ruleAudit") {
    menu.append(makeOverflowSectionLabel("규칙 감사"));
    menu.append(renderRuleAuditPanel());
  } else if (openMenu === "history") {
    menu.append(makeOverflowSectionLabel("작업 기록"));
    menu.append(renderMapHistoryPanel());
  }

  menu.append(makeOverflowSectionLabel("브러시 크기"));
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

function makeOverflowSectionLabel(label: string): HTMLElement {
  return el("div", { class: "rpg-maker-overflow-section", attrs: { "aria-hidden": "true" }, text: label });
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

function makeMenuToggle(menu: OpenToolbarMenuId, label: string, expanded: boolean, active: boolean, rerender: () => void): HTMLButtonElement {
  return el("button", {
    class: "rpg-maker-tile-tool" + (active ? " active" : ""),
    attrs: {
      "aria-expanded": String(expanded),
      "aria-haspopup": "menu",
      "aria-label": label,
      title: label,
    },
    children: [makeMenuIcon(menu)],
    dataset: { testid: menuToggleTestId(menu) },
    on: {
      click: () => {
        // overflow 토글은 인스펙터/규칙/기록 패널이 열려 있어도 닫아 1줄 상태를 복구한다.
        if (menu === "overflow" && (openMenu === "inspector" || openMenu === "ruleAudit" || openMenu === "history")) {
          openMenu = null;
        } else {
          openMenu = expanded ? null : menu;
        }
        rerender();
      },
    },
  });
}

function makeMenuIcon(menu: OpenToolbarMenuId): Node {
  if (menu === "ruleAudit") return el("span", { class: "rpg-maker-menu-glyph", attrs: { "aria-hidden": "true" }, text: "🔎" });
  if (menu === "history") return el("span", { class: "rpg-maker-menu-glyph", attrs: { "aria-hidden": "true" }, text: "🕘" });
  return makeSvgIcon(TOOLBAR_MENU_ICONS[menu]);
}

function menuToggleTestId(menu: OpenToolbarMenuId): string {
  if (menu === "ruleAudit") return "toolbar-toggle-ruleAudit";
  if (menu === "history") return "toolbar-toggle-history";
  // inspector → rpg-maker-tool-inspector (기존 계약), overflow → rpg-maker-tool-overflow
  return `rpg-maker-tool-${menu}`;
}

function makeToolbarBadge(count: number, testId: string, danger: boolean): HTMLElement {
  return el("span", {
    class: "toolbar-badge" + (danger ? " danger" : ""),
    attrs: { "aria-hidden": "true" },
    dataset: { testid: testId },
    text: String(count),
  });
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

