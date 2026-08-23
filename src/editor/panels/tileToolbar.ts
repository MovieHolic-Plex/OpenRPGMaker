import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { editorState } from "@/editor/editorState";
import type { Tool } from "@/editor/editorState";
import { el } from "@/util/dom";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { isTileToolbarItemActive, selectEyedropperTool, selectTileTool } from "@/editor/panels/tileToolbarActions";
import type { TileToolId } from "@/editor/panels/tileToolbarActions";
import { makeOverflowDropdown } from "@/editor/panels/tileToolbarMenus";
import type { TileToolbarModel } from "@/editor/panels/tileToolbarMenus";
import { store } from "@/project/store";

export {
  selectEyedropperTool,
  selectTileTool,
  setTileBrushSize,
} from "@/editor/panels/tileToolbarActions";

type TileToolbarItem = {
  readonly id: "undo" | TileToolId;
  readonly label: string;
  readonly icon: SvgIconName;
  /** 구 tool-grid에서 승계한 testid — e2e/자동화 계약이라 이름을 바꾸지 않는다. */
  readonly testid: string;
};

// 라벨은 **행위**를 말한다(2026-08-21 용어 정리 라운드). 예전 "펜 / 사각형 칠하기 / 원형 칠하기 /
// 채우기" 는 RM2K3 도구 스트립의 어휘를 그대로 옮긴 것이었다. 도형 채우기 자체는 어느
// 그림 도구에나 있는 일반 기능이므로 **기능은 유지하고 이름만** 바꾼다 — 쓸 수 있는 기능을
// 지우는 것은 상표 회피의 수단이 아니다.
const TOOLBAR_ITEMS: readonly TileToolbarItem[] = [
  { id: "undo", label: "되돌리기", icon: "undo", testid: "oprn-tool-undo" },
  { id: "select", label: "영역 선택", icon: "select", testid: "tool-select" },
  { id: "pen", label: "칠하기", icon: "pen", testid: "tool-paint" },
  { id: "erase", label: "지우기", icon: "eraser", testid: "tool-erase" },
  { id: "rect", label: "사각형 채우기", icon: "rect", testid: "oprn-tool-rect" },
  { id: "round", label: "타원 채우기", icon: "round", testid: "oprn-tool-round" },
  { id: "fill", label: "이어진 영역 채우기", icon: "fill", testid: "tool-fill" },
];

type MapModeItem = {
  readonly id: Extract<Tool, "eyedropper" | "pan" | "collision" | "event">;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
};

/** 구 "도구" 섹션(tilePaletteToolbar)에서 이관한 맵 모드 도구 — 그리기 도구와 구분선으로 나뉜다. */
const MODE_ITEMS: readonly MapModeItem[] = [
  { id: "eyedropper", label: "타일 집기", hint: "맵에 놓인 타일을 찍어 팔레트 선택으로 가져옵니다", icon: "eyedropper" },
  { id: "pan", label: "화면 밀기", hint: "드래그로 맵 화면을 움직입니다. Space를 누른 동안에도 움직입니다", icon: "hand" },
  { id: "collision", label: "통행 표시", hint: "지나갈 수 있는 칸인지 표시하고 바꿉니다", icon: "collision" },
  { id: "event", label: "장면 놓기", hint: "맵에 이벤트를 놓거나 놓인 이벤트를 고릅니다", icon: "event" },
];

let latestToolbarRerender: (() => void) | null = null;
let toolbarBadgeRefreshInstalled = false;

export function makeTileToolbar(model: TileToolbarModel): HTMLElement {
  installToolbarBadgeRefresh(model.rerender);
  const { state } = model;
  const row = el("div", {
    class: "oprn-tile-toolbar",
    attrs: { role: "toolbar", "aria-label": "타일 그리기 도구" },
    dataset: { testid: "oprn-tile-toolbar" },
  });
  const historyState = getMapEditHistoryState();

  for (const item of TOOLBAR_ITEMS) {
    if (item.id === "select") row.append(el("span", { class: "oprn-tile-toolbar-separator", attrs: { "aria-hidden": "true" } }));
    const active = item.id !== "undo" && isTileToolbarItemActive(item.id, state.tool, state.paintShape);
    const button = el("button", {
      class: "oprn-tile-tool" + (active ? " active" : ""),
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
          selectTileTool(item.id);
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

  row.append(el("span", { class: "oprn-tile-toolbar-separator", attrs: { "aria-hidden": "true" } }));
  row.append(makeMapModeGroup(model));
  row.append(el("span", { class: "oprn-tile-toolbar-spacer", attrs: { "aria-hidden": "true" } }));
  // 좁은 팔레트에서도 1줄을 유지하기 위해 검사/기록/인스펙터는 ⋯ overflow 로 흡수.
  row.append(makeOverflowDropdown(model));

  return row;
}

/**
 * 맵 모드 도구 그룹 (스포이트·이동·통행·이벤트).
 * testid "tool-grid"는 구 도구 섹션 컨테이너에서 승계 — 셸 e2e가 존재를 검증한다.
 */
function makeMapModeGroup(model: TileToolbarModel): HTMLElement {
  const { state } = model;
  const group = el("span", {
    class: "oprn-tile-toolbar-modes",
    attrs: { role: "group", "aria-label": "맵 모드 도구" },
    dataset: { testid: "tool-grid" },
  });
  for (const item of MODE_ITEMS) {
    const active = state.tool === item.id;
    group.append(
      el("button", {
        class: "oprn-tile-tool" + (active ? " active" : ""),
        attrs: {
          "aria-label": item.label,
          "aria-pressed": String(active),
          title: item.hint,
        },
        children: [makeSvgIcon(item.icon)],
        dataset: { testid: `tool-${item.id}` },
        on: {
          click: () => {
            if (item.id === "eyedropper") selectEyedropperTool();
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
