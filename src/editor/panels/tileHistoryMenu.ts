// editor/panels/tileHistoryMenu.ts
// 타일 도구막대의 되돌리기/다시실행 쌍과 그 옆의 간이 기록 메뉴.
//
// 여기서 새 히스토리를 만들지 않는다 — 스택은 `mapEditHistory` 하나뿐이고, 이 화면은
// 그것을 **보여주기만** 한다. 기록 창(mapHistoryPanel)도 같은 조회기를 쓰므로 두 화면이
// 다른 순서·다른 라벨을 낼 수 없다. 도구막대에 다시실행 단추가 없어서 감독이 Ctrl+Shift+Z
// 를 아는 사람만 쓸 수 있었던 것이 이 파일이 생긴 이유다(OPRN-OUT-021).
//
// 깊이(steps)는 모델이 센다. 여기서 index 로 다시 계산하면 "3단계"라고 써 놓고 2단계만
// 가는 종류의 불일치가 생긴다 — MapEditHistoryEntry.steps 를 그대로 쓴다.

import {
  getMapEditHistoryEntries,
  getMapEditHistoryRevision,
  getMapEditHistoryState,
  getMapEditRedoEntries,
  redoMapEdit,
  redoToHistoryIndex,
  revertToHistoryIndex,
  undoMapEdit,
  type MapEditHistoryEntry,
} from "@/editor/mapEditHistory";
import { SIDEBAR_SURFACE_OPEN } from "@/editor/panels/sidebarSurface";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { anchorMenuToViewport } from "@/editor/panels/tileToolbarMenus";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { showConfirm } from "@/editor/ui/modal";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 간이 메뉴가 싣는 최대 항목 수 — 그 위는 전체를 보는 「작업 기록」 창의 일이다. */
const MAX_MENU_ENTRIES = 10;

/**
 * 사이드바 팝오버 상호 배제에 쓰는 표면 이름. 검사·기록 메뉴(tileToolbarMenus)와
 * 보조 작업 표면(sidebarSurface)이 이미 같은 이벤트로 서로를 닫으므로, 이름만 다르게
 * 실어 보내면 세 갈래가 동시에 열리는 일이 없다.
 */
const HISTORY_MENU_SURFACE = "history-menu";

type HistoryDirection = "undo" | "redo";

type DirectionSpec = {
  readonly label: string;
  /** 툴팁은 두 플랫폼 표기를 함께 적는다 — 같은 빌드가 macOS 와 그 외를 모두 서비스한다. */
  readonly hotkey: string;
  readonly icon: SvgIconName;
  readonly actionTestId: string;
  readonly toggleTestId: string;
  readonly dropdownTestId: string;
  readonly moreTestId: string;
  readonly rowTestIdPrefix: string;
  readonly emptyText: string;
  readonly doneText: string;
  readonly entries: () => readonly MapEditHistoryEntry[];
  readonly enabled: () => boolean;
  /** 한 걸음 — 도구막대 단추와 단축키가 지나는 바로 그 경로. */
  readonly step: () => boolean;
  /** 여러 걸음을 한 번의 결정으로. */
  readonly traverse: (index: number) => boolean;
};

const DIRECTIONS: Readonly<Record<HistoryDirection, DirectionSpec>> = {
  undo: {
    label: "되돌리기",
    hotkey: "Ctrl+Z / ⌘Z",
    icon: "undo",
    actionTestId: "oprn-tool-undo",
    toggleTestId: "oprn-tool-undo-history",
    dropdownTestId: "oprn-undo-history-dropdown",
    moreTestId: "history-undo-more",
    rowTestIdPrefix: "history-undo-step",
    emptyText: "되돌릴 작업이 없습니다",
    doneText: "되돌렸습니다",
    entries: getMapEditHistoryEntries,
    enabled: () => getMapEditHistoryState().canUndo,
    step: undoMapEdit,
    traverse: revertToHistoryIndex,
  },
  redo: {
    label: "다시실행",
    hotkey: "Ctrl+Shift+Z / ⌘⇧Z, Ctrl+Y",
    icon: "redo",
    actionTestId: "oprn-tool-redo",
    toggleTestId: "oprn-tool-redo-history",
    dropdownTestId: "oprn-redo-history-dropdown",
    moreTestId: "history-redo-more",
    rowTestIdPrefix: "history-redo-step",
    emptyText: "다시 실행할 작업이 없습니다",
    doneText: "다시 실행했습니다",
    entries: getMapEditRedoEntries,
    enabled: () => getMapEditHistoryState().canRedo,
    step: redoMapEdit,
    traverse: redoToHistoryIndex,
  },
};

// 열림 상태는 모듈에 남긴다 — 도구막대는 히스토리 변경·store 변경마다 통째로 다시 그려지므로
// (tileToolbar 의 installToolbarBadgeRefresh) 노드에 상태를 붙여 두면 매번 닫힌다.
let openDirection: HistoryDirection | null = null;
let openAnchor: { readonly menu: HTMLElement; readonly trigger: HTMLElement } | null = null;
let latestRerender: (() => void) | null = null;
let anchorKeepersInstalled = false;
let detachDocumentListeners: (() => void) | null = null;

export function resetTileHistoryMenusForTests(): void {
  openDirection = null;
  openAnchor = null;
  latestRerender = null;
  anchorKeepersInstalled = false;
  detachDocumentListeners?.();
  detachDocumentListeners = null;
}

function closeHistoryMenu(restoreFocus: boolean): void {
  if (openDirection === null) return;
  const previous = openAnchor;
  openDirection = null;
  openAnchor = null;
  previous?.menu.remove();
  previous?.trigger.setAttribute("aria-expanded", "false");
  if (restoreFocus) previous?.trigger.focus();
}

function installDocumentListeners(): void {
  if (detachDocumentListeners || typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  const onPointerDown = (event: Event): void => {
    if (openDirection === null || hasOpenModalLayer() || !(event.target instanceof Node)) return;
    const anchor = openAnchor;
    if (anchor && (anchor.menu.contains(event.target) || anchor.trigger.contains(event.target))) return;
    closeHistoryMenu(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || openDirection === null || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    closeHistoryMenu(true);
  };
  const onSurfaceOpen = (event: Event): void => {
    if (event instanceof CustomEvent && event.detail !== HISTORY_MENU_SURFACE) closeHistoryMenu(false);
  };
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener(SIDEBAR_SURFACE_OPEN, onSurfaceOpen);
  detachDocumentListeners = () => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener(SIDEBAR_SURFACE_OPEN, onSurfaceOpen);
  };
}

/**
 * 되돌리기·다시실행 두 쌍(행위 단추 + 펼쳐보기)을 나란히 낸다.
 *
 * 두 방향은 같은 렌더 경로를 쓴다 — 한쪽에만 있는 표기·상태가 생기지 않게 하려면
 * 방향은 자료(DIRECTIONS)여야 하고 코드가 갈라지면 안 된다.
 */
export function makeTileHistoryControls(rerender: () => void): HTMLElement {
  latestRerender = rerender;
  installDocumentListeners();
  const group = el("span", {
    class: "oprn-tile-history-group",
    attrs: { role: "group", "aria-label": "되돌리기 · 다시실행" },
    dataset: { testid: "oprn-tool-history-group" },
  });
  for (const direction of ["undo", "redo"] as const) {
    const spec = DIRECTIONS[direction];
    group.append(makeActionButton(spec, rerender), ...makeDisclosure(direction, spec, rerender));
  }
  return group;
}

function makeActionButton(spec: DirectionSpec, rerender: () => void): HTMLButtonElement {
  const enabled = spec.enabled();
  const button = el("button", {
    class: "oprn-tile-tool",
    attrs: {
      type: "button",
      "aria-label": spec.label,
      title: `${spec.label} (${spec.hotkey})`,
    },
    children: [makeSvgIcon(spec.icon)],
    dataset: { testid: spec.actionTestId },
    on: {
      click: () => {
        // 한 걸음은 단축키와 완전히 같은 경로다(피드백 문구까지 맞춘다).
        if (spec.step()) toast(spec.doneText, "ok");
        closeHistoryMenu(false);
        rerender();
      },
    },
  });
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
  return button;
}

function makeDisclosure(direction: HistoryDirection, spec: DirectionSpec, rerender: () => void): readonly HTMLElement[] {
  const expanded = openDirection === direction;
  const entries = spec.entries();
  const toggle = el("button", {
    class: "oprn-tile-tool oprn-tile-history-toggle",
    attrs: {
      type: "button",
      "aria-expanded": String(expanded),
      "aria-haspopup": "menu",
      "aria-label": entries.length > 0 ? `${spec.label} 기록 펼쳐보기 (${entries.length}건)` : `${spec.label} 기록 펼쳐보기`,
      title: `${spec.label} 기록 펼쳐보기`,
    },
    children: [makeSvgIcon("chevronDown")],
    dataset: { testid: spec.toggleTestId },
    on: {
      click: () => {
        // 검사·기록 메뉴와 보조 표면이 이 이벤트로 스스로 닫힌다 — 팝오버 두 개가 겹치지 않는다.
        document.dispatchEvent(new CustomEvent(SIDEBAR_SURFACE_OPEN, { detail: HISTORY_MENU_SURFACE }));
        openDirection = openDirection === direction ? null : direction;
        rerender();
        if (openDirection !== null) openAnchor?.menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
      },
    },
  });
  if (!expanded) return [toggle];

  const menu = el("div", {
    class: "oprn-toolbar-dropdown",
    attrs: { role: "menu", "aria-label": `${spec.label} 기록` },
    dataset: { testid: spec.dropdownTestId, focusFallbackAnchor: spec.toggleTestId },
  });
  menu.addEventListener("keydown", (event) => moveRowFocus(menu, event));
  if (entries.length === 0) {
    menu.append(el("div", { class: "map-history-empty", text: spec.emptyText }));
  } else {
    for (const entry of entries.slice(0, MAX_MENU_ENTRIES)) menu.append(makeEntryRow(spec, entry, rerender));
    const remaining = entries.length - MAX_MENU_ENTRIES;
    if (remaining > 0) {
      menu.append(el("div", {
        class: "oprn-overflow-section",
        dataset: { testid: spec.moreTestId },
        text: `+${remaining}건 더 — 작업 기록에서 전체 보기`,
      }));
    }
  }
  scheduleAnchor(menu, toggle);
  return [toggle, menu];
}

/**
 * 항목 한 줄. 깊이가 2 이상이면 **몇 단계인지 라벨에 적고** 실행 전에 되묻는다 —
 * 목록에서 아래쪽을 고르는 것은 여러 작업을 한꺼번에 지나가는 일이고, 그걸 모른 채
 * 누르면 방금 한 편집 다섯 개가 조용히 사라진다. 되물은 뒤에는 **한 번의 결정**으로
 * 처리한다(revertToHistoryIndex / redoToHistoryIndex 가 undo 엔트리 하나로 접는다).
 */
function makeEntryRow(spec: DirectionSpec, entry: MapEditHistoryEntry, rerender: () => void): HTMLButtonElement {
  const multi = entry.steps >= 2;
  const revision = getMapEditHistoryRevision();
  const project = store.getCurrent();
  return el("button", {
    class: "oprn-option-item",
    attrs: { type: "button", role: "menuitem", title: multi ? `${entry.label} — ${entry.steps}단계` : entry.label },
    text: multi ? `${entry.label} · ${entry.steps}단계` : entry.label,
    dataset: {
      testid: `${spec.rowTestIdPrefix}-${entry.steps}`,
      historyStep: String(entry.steps),
      historyLabel: entry.label,
    },
    on: {
      click: () => {
        if (!multi) {
          if (spec.step()) {
            toast(`${spec.doneText} — ${entry.label}`, "ok");
            closeHistoryMenu(false);
          }
          rerender();
          return;
        }
        void showConfirm({
          title: `${spec.label} ${entry.steps}단계`,
          message: `'${entry.label}' 지점까지 ${entry.steps}단계를 한 번에 ${spec.label}합니다. 계속할까요?`,
          confirmLabel: `${entry.steps}단계 ${spec.label}`,
        }).then((confirmed) => {
          if (!confirmed) return;
          // The promise belongs to the displayed stack and project object, not
          // just an index or project ID (same-ID replacements are stale too).
          if (getMapEditHistoryRevision() !== revision || store.getCurrent() !== project) {
            toast("확인 중 작업 기록이 변경되었습니다. 기록을 다시 선택하세요.", "info");
            closeHistoryMenu(false);
            latestRerender?.();
            return;
          }
          if (!spec.traverse(entry.index)) return;
          toast(`${entry.steps}단계 ${spec.doneText} — ${entry.label}`, "ok");
          closeHistoryMenu(false);
          latestRerender?.();
        });
      },
    },
  });
}

/** 검사·기록 드롭다운과 같은 방향키 이동 규칙 — 메뉴마다 규칙이 다르면 키보드 사용자가 헤맨다. */
function moveRowFocus(menu: HTMLElement, event: Event): void {
  if (!(event instanceof KeyboardEvent) || !(event.target instanceof HTMLButtonElement)) return;
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  const index = buttons.indexOf(event.target);
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? buttons.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault();
  event.stopPropagation();
  buttons[next]?.focus();
}

/**
 * 위치는 **삽입 후에** 잡는다 — 이 함수는 아직 도구막대에 붙지 않은 분리 노드를 받으므로
 * 지금 재면 트리거 rect 가 전부 0 이다(tileToolbarMenus 가 같은 함정을 이미 밟았다).
 */
function scheduleAnchor(menu: HTMLElement, trigger: HTMLElement): void {
  if (typeof window === "undefined") return;
  openAnchor = { menu, trigger };
  const apply = (): void => {
    if (!menu.isConnected || !trigger.isConnected) return;
    anchorMenuToViewport(menu, trigger);
  };
  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(apply);
  else setTimeout(apply, 0);
  if (anchorKeepersInstalled) return;
  anchorKeepersInstalled = true;
  // 리스너는 모듈 수준에서 한 번만 — 좌패널은 상태가 바뀔 때마다 다시 그려지므로
  // 렌더마다 달면 버려진 메뉴 노드를 붙잡은 리스너가 무한히 쌓인다.
  const reanchor = (): void => {
    const current = openAnchor;
    if (!current) return;
    if (!current.menu.isConnected || !current.trigger.isConnected) {
      openAnchor = null;
      return;
    }
    anchorMenuToViewport(current.menu, current.trigger);
  };
  window.addEventListener("resize", reanchor);
  window.addEventListener("scroll", reanchor, true);
}
