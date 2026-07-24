import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { editorState } from "@/editor/editorState";
import type { Tool } from "@/editor/editorState";
import { el } from "@/util/dom";
import { makeSvgIcon } from "@/editor/panels/rpgMakerTileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/rpgMakerTileToolbarIcons";
import { isRpgMakerToolbarItemActive, selectRpgMakerEyedropperTool, selectRpgMakerTileTool } from "@/editor/panels/rpgMakerTileToolbarActions";
import type { RpgMakerTileTool } from "@/editor/panels/rpgMakerTileToolbarActions";
import { makeOverflowDropdown } from "@/editor/panels/rpgMakerTileToolbarMenus";
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
  /** 구 tool-grid에서 승계한 testid — e2e/자동화 계약이라 이름을 바꾸지 않는다. */
  readonly testid: string;
};

const TOOLBAR_ITEMS: readonly RpgMakerToolbarItem[] = [
  { id: "undo", label: "되돌리기", icon: "undo", testid: "rpg-maker-tool-undo" },
  { id: "select", label: "영역 선택", icon: "select", testid: "tool-select" },
  { id: "pen", label: "펜", icon: "pen", testid: "tool-paint" },
  { id: "erase", label: "지우개", icon: "eraser", testid: "tool-erase" },
  { id: "rect", label: "사각형 칠하기", icon: "rect", testid: "rpg-maker-tool-rect" },
  { id: "round", label: "원형 칠하기", icon: "round", testid: "rpg-maker-tool-round" },
  { id: "fill", label: "채우기", icon: "fill", testid: "tool-fill" },
];

type MapModeItem = {
  readonly id: Extract<Tool, "eyedropper" | "pan" | "collision" | "event">;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
};

/** 구 "도구" 섹션(tilePaletteToolbar)에서 이관한 맵 모드 도구 — 그리기 도구와 구분선으로 나뉜다. */
const MODE_ITEMS: readonly MapModeItem[] = [
  { id: "eyedropper", label: "스포이트", hint: "현재 맵 레이어에서 타일을 집습니다", icon: "eyedropper" },
  { id: "pan", label: "이동", hint: "드래그로 맵 화면을 움직입니다. Space를 누른 동안에도 이동합니다", icon: "hand" },
  { id: "collision", label: "통행", hint: "통행 가능 여부를 전환합니다", icon: "collision" },
  { id: "event", label: "이벤트", hint: "맵 이벤트를 배치하거나 선택합니다", icon: "event" },
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
      dataset: { testid: item.testid },
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

  row.append(el("span", { class: "rpg-maker-tile-toolbar-separator", attrs: { "aria-hidden": "true" } }));
  row.append(makeMapModeGroup(model));
  row.append(el("span", { class: "rpg-maker-tile-toolbar-spacer", attrs: { "aria-hidden": "true" } }));
  // 좁은 팔레트에서도 1줄을 유지하기 위해 검사/기록/인스펙터는 ⋯ overflow 로 흡수.
  row.append(makeOverflowDropdown(model));

  return row;
}

/**
 * 맵 모드 도구 그룹 (스포이트·이동·통행·이벤트).
 * testid "tool-grid"는 구 도구 섹션 컨테이너에서 승계 — 셸 e2e가 존재를 검증한다.
 */
function makeMapModeGroup(model: RpgMakerToolbarModel): HTMLElement {
  const { state } = model;
  const group = el("span", {
    class: "rpg-maker-tile-toolbar-modes",
    attrs: { role: "group", "aria-label": "맵 모드 도구" },
    dataset: { testid: "tool-grid" },
  });
  for (const item of MODE_ITEMS) {
    const active = state.tool === item.id;
    group.append(
      el("button", {
        class: "rpg-maker-tile-tool" + (active ? " active" : ""),
        attrs: {
          "aria-label": item.label,
          "aria-pressed": String(active),
          title: item.hint,
        },
        children: [makeSvgIcon(item.icon)],
        dataset: { testid: `tool-${item.id}` },
        on: {
          click: () => {
            if (item.id === "eyedropper") selectRpgMakerEyedropperTool();
            else editorState.set({ tool: item.id });
            model.rerender();
          },
        },
      })
    );
  }
  return group;
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
