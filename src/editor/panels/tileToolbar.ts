import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import type { Tool } from "@/editor/editorState";
import { el } from "@/util/dom";
import { makeTileHistoryControls } from "@/editor/panels/tileHistoryMenu";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { isTileToolbarItemActive, selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";
import type { TileToolId } from "@/editor/panels/tileToolbarActions";
import { getEditorChrome } from "@/editor/editorUiMode";
import { makeInspectionControls, RULE_AUDIT_UPDATED_EVENT, type TileToolbarModel } from "@/editor/panels/tileToolbarMenus";
import { installPointerStrokeGate, runWhenPointerReleased } from "@/editor/pointerStrokeGate";
import { store } from "@/project/store";

export {
  selectEyedropperTool,
  selectMapModeTool,
  selectTileTool,
  setTileBrushSize,
} from "@/editor/panels/tileToolbarActions";

type TileToolbarItem = {
  readonly id: Exclude<TileToolId, "rect" | "round">;
  readonly label: string;
  readonly icon: SvgIconName;
  /** hotkeys.ts 의 단축키 표기 — 툴팁에 같이 적어 잘린 도구도 키보드로 부를 수 있게 한다. */
  readonly hotkey?: string;
  /** 구 tool-grid에서 승계한 testid — e2e/자동화 계약이라 이름을 바꾸지 않는다. */
  readonly testid: string;
};

// 라벨은 **행위**를 말한다(2026-08-21 용어 정리 라운드). 예전 "펜 / 사각형 칠하기 / 원형 칠하기 /
// 채우기" 는 RM2K3 도구 스트립의 어휘를 그대로 옮긴 것이었다. 도형 채우기 자체는 어느
// 그림 도구에나 있는 일반 기능이므로 **기능은 유지하고 이름만** 바꾼다 — 쓸 수 있는 기능을
// 지우는 것은 상표 회피의 수단이 아니다.
// 되돌리기/다시실행은 이 목록에 없다 — 도구를 «고르는» 것이 아니라 «실행하는» 것이고,
// 각자 펼쳐보기 메뉴를 달고 다니므로 makeTileHistoryControls 가 한 쌍으로 낸다.
const TOOLBAR_ITEMS: readonly TileToolbarItem[] = [
  { id: "select", label: "영역 선택", hotkey: "V", icon: "select", testid: "tool-select" },
  // 아이콘은 초보 레일과 같은 brush 를 쓴다 — 한 행위에 두 글리프를 두지 않는다.
  { id: "pen", label: "칠하기", hotkey: "B", icon: "brush", testid: "tool-paint" },
  { id: "erase", label: "지우기", hotkey: "E", icon: "eraser", testid: "tool-erase" },
  { id: "fill", label: "이어진 영역 채우기", hotkey: "G", icon: "fill", testid: "tool-fill" },
];

type MapModeItem = {
  readonly id: Extract<Tool, "eyedropper">;
  readonly label: string;
  readonly hint: string;
  readonly hotkey: string;
  readonly icon: SvgIconName;
};

/** 구 "도구" 섹션(tilePaletteToolbar)에서 이관한 맵 모드 도구 — 그리기 도구와 구분선으로 나뉜다. */
const MODE_ITEMS: readonly MapModeItem[] = [
  { id: "eyedropper", label: "타일 집기", hint: "맵에 놓인 타일을 찍어 팔레트 선택으로 가져옵니다", hotkey: "I", icon: "eyedropper" },
];

/** 툴팁 표기는 초보 레일·레이어 전환과 같은 형식이다: 라벨 (단축키) — 설명. */
function toolbarTooltip(label: string, hotkey: string | undefined, hint?: string): string {
  const head = hotkey ? `${label} (${hotkey})` : label;
  return hint ? `${head} — ${hint}` : head;
}

let latestToolbarRerender: (() => void) | null = null;
let toolbarBadgeRefreshInstalled = false;

/**
 * Daily tools occupy one row. Shape, navigation and clipboard choices live in
 * the labelled Tools surface; inspection utilities live below the sheet.
 */
export function makeTileToolbar(model: TileToolbarModel): HTMLElement {
  installToolbarBadgeRefresh(model.rerender);
  const { state } = model;
  const row = el("div", {
    class: "oprn-tile-toolbar",
    attrs: { role: "toolbar", "aria-label": "타일 그리기 도구" },
    dataset: { testid: "oprn-tile-toolbar" },
  });
  const scroll = el("div", { class: "oprn-tile-toolbar-scroll" });
  // 히스토리 쌍은 이벤트 레이어에서도 남는다 — 이벤트 편집도 같은 undo 스택을 쓴다.
  scroll.append(makeTileHistoryControls(model.rerender));

  for (const item of TOOLBAR_ITEMS) {
    if (state.layer === "event") continue;
    if (item.id === "select") scroll.append(el("span", { class: "oprn-tile-toolbar-separator", attrs: { "aria-hidden": "true" } }));
    const active = item.id === 'pen' ? state.tool === 'paint'
      : isTileToolbarItemActive(item.id, state.tool, state.paintShape);
    scroll.append(el("button", {
      class: "oprn-tile-tool" + (active ? " active" : ""),
      attrs: {
        "aria-label": item.label,
        "aria-pressed": String(active),
        title: toolbarTooltip(item.label, item.hotkey),
      },
      children: [makeSvgIcon(item.icon)],
      dataset: { testid: item.testid },
      on: {
        // 다시 그리기는 editorState 구독(editor.ts)이 맡는다. 여기서도 rerender 하면 클릭 한 번에
        // 팔레트가 두 번 지어진다(2026-09-26 실측 클릭당 약 120ms × 2).
        click: () => selectTileTool(item.id),
      },
    }));
  }

  if (state.layer !== "event" && getEditorChrome().advancedSidebarControls) scroll.append(makeMapModeGroup(model));
  row.append(scroll);
  // 「검사·기록」 ⋯ 메뉴(인스펙터·규칙 감사·작업 기록)는 사이드바 맨 아래 줄에서 여기로 왔다(2026-09-17).
  // 잘 안 보는 옵션이라 상단 도구막대 끝의 ⋯ 하나로 치운다. 이벤트 레이어에서도 같은 자리다.
  row.append(makeInspectionControls(model));

  return row;
}

/**
 * Expert quick sampling; Standard reaches the same action through Tools.
 */
function makeMapModeGroup(model: TileToolbarModel): HTMLElement {
  const { state } = model;
  const group = el("span", {
    class: "oprn-tile-toolbar-modes",
    attrs: { role: "group", "aria-label": "맵 모드 도구" },
    dataset: { testid: "tool-quick-modes" },
  });
  for (const item of MODE_ITEMS) {
    const active = state.tool === item.id;
    group.append(
      el("button", {
        class: "oprn-tile-tool" + (active ? " active" : ""),
        attrs: {
          "aria-label": item.label,
          "aria-pressed": String(active),
          title: toolbarTooltip(item.label, item.hotkey, item.hint),
        },
        children: [makeSvgIcon(item.icon)],
        dataset: { testid: `tool-${item.id}` },
        on: {
          click: () => selectMapModeTool(item.id),
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
  // 도구막대 재구축 = 좌측 타일 팔레트 전체 재구축이다(100×100 마을에서 한 번 100~200ms).
  // 스트로크 도중에는 팔레트에 바뀔 것이 없으므로(배지·되돌리기 단추는 끝난 뒤 맞으면 된다)
  // 누르고 있는 동안은 미루고 손을 뗄 때 한 번 짓는다 — pointerStrokeGate 참고.
  installPointerStrokeGate();
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(MAP_EDIT_HISTORY_EVENT, () => runWhenPointerReleased(rerenderLatestToolbar));
    window.addEventListener(RULE_AUDIT_UPDATED_EVENT, () => runWhenPointerReleased(rerenderLatestToolbar));
  }
  // 페인트 드래그는 칸마다 store emit 을 내므로 **후행** 디바운스로 묶는다. 예전 선행 잠금
  // (`if (timer) return`)은 드래그 내내 120ms 마다 팔레트를 다시 지어 칠하기를 끊기게 했다
  // (2026-09-23). 되돌리기(MAP_EDIT_HISTORY_EVENT)는 빈도가 낮아 디바운스 없이 그린다.
  store.subscribe(() => {
    if (typeof document === "undefined") return;
    if (toolbarStoreRerenderTimer !== null) clearTimeout(toolbarStoreRerenderTimer);
    toolbarStoreRerenderTimer = setTimeout(() => {
      toolbarStoreRerenderTimer = null;
      runWhenPointerReleased(rerenderLatestToolbar);
    }, TOOLBAR_STORE_RERENDER_DEBOUNCE_MS);
  });
}

function rerenderLatestToolbar(): void {
  // 타이머·미룬 작업은 구독 시점보다 오래 산다 — 문서가 사라진 뒤(테스트 환경 해체, 창 종료)
  // 그리면 renderCurrentPalette 가 document 를 만지다 터진다.
  if (typeof document === "undefined") return;
  latestToolbarRerender?.();
}

const TOOLBAR_STORE_RERENDER_DEBOUNCE_MS = 120;
let toolbarStoreRerenderTimer: ReturnType<typeof setTimeout> | null = null;
