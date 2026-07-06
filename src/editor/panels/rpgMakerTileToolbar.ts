import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { el } from "@/util/dom";
import { makeSvgIcon } from "@/editor/panels/rpgMakerTileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/rpgMakerTileToolbarIcons";
import { isRpgMakerToolbarItemActive, selectRpgMakerTileTool } from "@/editor/panels/rpgMakerTileToolbarActions";
import type { RpgMakerTileTool } from "@/editor/panels/rpgMakerTileToolbarActions";
import { makeBrushDropdown, makeHistoryDropdown, makeInspectorDropdown, makeRuleAuditDropdown, makeTemplateDropdown } from "@/editor/panels/rpgMakerTileToolbarMenus";
import type { RpgMakerToolbarModel } from "@/editor/panels/rpgMakerTileToolbarMenus";
import { store } from "@/project/store";

export {
  selectRpgMakerEyedropperTool,
  selectRpgMakerStructureStamp,
  selectRpgMakerTileTool,
  setRpgMakerBrushSize,
  toggleRpgMakerTileStamp,
} from "@/editor/panels/rpgMakerTileToolbarActions";

type RpgMakerToolbarItem = {
  readonly id: "undo" | RpgMakerTileTool;
  readonly label: string;
  readonly icon: SvgIconName;
};

const TOOLBAR_ITEMS: readonly RpgMakerToolbarItem[] = [
  { id: "undo", label: "되돌리기", icon: "undo" },
  { id: "select", label: "영역 선택", icon: "select" },
  { id: "pen", label: "펜", icon: "pen" },
  { id: "erase", label: "지우개", icon: "eraser" },
  { id: "rect", label: "사각형 칠하기", icon: "rect" },
  { id: "round", label: "원형 칠하기", icon: "round" },
  { id: "fill", label: "채우기", icon: "fill" },
];

let latestToolbarRerender: (() => void) | null = null;
let toolbarBadgeRefreshInstalled = false;

export function makeRpgMakerTileToolbar(model: RpgMakerToolbarModel): HTMLElement {
  installToolbarBadgeRefresh(model.rerender);
  const { state } = model;
  const row = el("div", {
    class: "rpg-maker-tile-toolbar",
    attrs: { role: "toolbar", "aria-label": "타일 그리기 도구" },
    dataset: { testid: "rpg-maker-tile-toolbar" },
  });
  const historyState = getMapEditHistoryState();

  for (const item of TOOLBAR_ITEMS) {
    if (item.id === "select") row.append(el("span", { class: "rpg-maker-tile-toolbar-separator", attrs: { "aria-hidden": "true" } }));
    const active = item.id !== "undo" && isRpgMakerToolbarItemActive(item.id, state.tool, state.paintShape);
    const button = el("button", {
      class: "rpg-maker-tile-tool" + (active ? " active" : ""),
      attrs: {
        "aria-label": item.label,
        "aria-pressed": String(active),
        title: item.label,
      },
      children: [makeSvgIcon(item.icon)],
      dataset: { testid: `rpg-maker-tool-${item.id}` },
      on: {
        click: () => {
          if (item.id === "undo") {
            if (undoMapEdit()) model.rerender();
            return;
          }
          selectRpgMakerTileTool(item.id);
          model.rerender();
        },
      },
    });
    if (item.id === "undo") {
      button.disabled = !historyState.canUndo;
      button.setAttribute("aria-disabled", String(!historyState.canUndo));
    }
    row.append(button);
  }
  row.append(el("span", { class: "rpg-maker-tile-toolbar-spacer", attrs: { "aria-hidden": "true" } }));
  row.append(makeInspectorDropdown(model));
  row.append(makeRuleAuditDropdown(model));
  row.append(makeHistoryDropdown(model));
  row.append(makeBrushDropdown(model));
  row.append(makeTemplateDropdown(model));

  return row;
}

function installToolbarBadgeRefresh(rerender: () => void): void {
  latestToolbarRerender = rerender;
  if (toolbarBadgeRefreshInstalled) return;
  toolbarBadgeRefreshInstalled = true;
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(MAP_EDIT_HISTORY_EVENT, () => latestToolbarRerender?.());
  }
  store.subscribe(() => {
    if (typeof document === "undefined") return;
    latestToolbarRerender?.();
  });
}
