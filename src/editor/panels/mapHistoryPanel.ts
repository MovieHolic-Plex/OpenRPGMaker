import { editorState } from "@/editor/editorState";
import { showConfirm } from "@/editor/ui/modal";
import { editActivityEntryCount } from "@/editor/editActivityLog";
import {
  getMapEditHistoryEntries,
  getMapEditHistoryState,
  MAP_EDIT_HISTORY_EVENT,
  redoMapEdit,
  revertToHistoryIndex,
  undoMapEdit,
  type MapEditHistoryEntry,
} from "@/editor/mapEditHistory";
import { renderEditActivityPanel } from "@/editor/panels/editActivityPanel";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type HistoryTab = "undo" | "activity";

let autoMountInstalled = false;
let mountQueued = false;
let observedPaletteRoot: HTMLElement | null = null;
let paletteRootObserver: MutationObserver | null = null;

/**
 * 작업 기록 창. 두 탭으로 갈린다:
 *   **되돌리기** — `mapEditHistory` 의 undo 스택(50건, 되돌리면 사라지고 새로고침에 소멸).
 *   **행위 기록** — `editActivityLog` 의 감사 로그(500건, 되돌려도 남고 영속, 필드 단위 상세).
 * 두 자료가 담는 것이 정반대라(되돌리기용 before 스냅샷 vs 감사용 after 기록) 한 목록으로
 * 합치면 둘 다 나빠진다. 그래서 같은 창 안에서 탭으로만 나란히 둔다.
 *
 * 기본 탭은 **되돌리기** 다 — 기존 e2e/계약(`history-undo`·`history-redo`·`history-revert-*`)이
 * 창을 열면 바로 보이는 것을 전제로 붙어 있다.
 */
export function renderMapHistoryPanel(): HTMLElement {
  const root = el("details", {
    class: "map-history-panel panel-section",
    attrs: { open: "", "aria-label": "작업 기록" },
    dataset: { testid: "map-history-panel" },
  });

  const undoPane = el("div", {
    class: "map-history-pane",
    attrs: { role: "tabpanel", "aria-label": "되돌리기" },
    dataset: { testid: "map-history-pane-undo" },
  });
  const activityPane = el("div", {
    class: "map-history-pane",
    attrs: { role: "tabpanel", "aria-label": "행위 기록" },
    dataset: { testid: "map-history-pane-activity" },
  });
  activityPane.hidden = true;

  const undoTab = tabButton("undo", "되돌리기");
  const activityTab = tabButton("activity", activityTabLabel());
  const tabs = el("div", {
    class: "map-history-tabs",
    attrs: { role: "tablist", "aria-label": "작업 기록 종류" },
    children: [undoTab, activityTab],
  });

  // 행위 기록 창은 **처음 탭을 누를 때** 만든다. 창 자체는 도구막대가 재렌더될 때마다
  // 새로 만들어지므로, 미리 만들면 아무도 안 보는 창이 매번 localStorage 를 읽고
  // window 리스너를 하나 더 건다.
  let activityMounted = false;
  const select = (tab: HistoryTab): void => {
    if (tab === "activity" && !activityMounted) {
      activityMounted = true;
      activityPane.append(renderEditActivityPanel());
    }
    for (const [button, pane, name] of [
      [undoTab, undoPane, "undo"],
      [activityTab, activityPane, "activity"],
    ] as const) {
      const active = name === tab;
      button.setAttribute("aria-selected", String(active));
      pane.hidden = !active;
    }
  };
  undoTab.addEventListener("click", () => select("undo"));
  activityTab.addEventListener("click", () => select("activity"));

  /**
   * 되돌리기 창 **본문만** 갈아치운다. 탭 머리와 행위 기록 창을 같이 다시 만들면
   * 히스토리 이벤트 한 번에 선택 탭과 행위 기록 필터 입력이 초기화된다.
   */
  const refresh = (): void => {
    const state = getMapEditHistoryState();
    const undo = historyButton({
      action: () => {
        if (undoMapEdit()) toast("되돌렸습니다", "ok");
      },
      disabled: !state.canUndo,
      testId: "history-undo",
      text: "↶ 되돌리기",
      title: "직전 변경 되돌리기(Ctrl+Z)",
    });
    const redo = historyButton({
      action: () => {
        if (redoMapEdit()) toast("다시 실행했습니다", "ok");
      },
      disabled: !state.canRedo,
      testId: "history-redo",
      text: "↷ 다시실행",
      title: "다시 실행(Ctrl+Shift+Z)",
    });
    const list = el("ol", {
      class: "map-history-list",
      children: historyRows(getMapEditHistoryEntries()),
    });
    undoPane.replaceChildren(el("div", { class: "map-history-actions", children: [undo, redo] }), list);
    activityTab.textContent = activityTabLabel();
  };

  refresh();
  select("undo");
  root.replaceChildren(el("summary", { text: "🕑 작업 기록" }), tabs, undoPane, activityPane);
  if (typeof window !== "undefined") {
    // 창은 팔레트가 다시 그려질 때마다 새로 만들어진다. 이벤트 리스너를 걸어 두기만 하고 떼지 않으면
    // 버려진 창마다 히스토리 이벤트 한 번에 DOM 을 다시 만든다(누수). 창이 문서에서 떨어진 걸 처음 본 이벤트에서 스스로 뗀다.
    // 접혀 있으면(details 닫힘) 목록을 만들지 않고 «밀림» 표시만 해 두었다가 펼칠 때 한 번 맞춘다.
    // «한 번이라도 문서에 붙었다가 떨어진» 창만 버려진 것으로 본다 — 아직 안 붙은 창(조립 중·분리 렌더)은 그대로 갱신한다.
    let stale = false;
    let seenConnected = false;
    const onHistoryEvent = (): void => {
      if (root.isConnected === true) seenConnected = true;
      else if (seenConnected && root.isConnected === false) {
        window.removeEventListener(MAP_EDIT_HISTORY_EVENT, onHistoryEvent);
        return;
      }
      if (root.open === false) {
        stale = true;
        return;
      }
      refresh();
    };
    window.addEventListener(MAP_EDIT_HISTORY_EVENT, onHistoryEvent);
    // 만든 직후(동기 부착이 끝난 뒤) 붙어 있었는지 한 번 기록한다 — 이벤트가 오기 전에 버려진 창도 잡으려고.
    if (typeof queueMicrotask === "function") queueMicrotask(() => { if (root.isConnected === true) seenConnected = true; });
    root.addEventListener("toggle", () => {
      if (root.open && stale) {
        stale = false;
        refresh();
      }
    });
  }
  return root;
}

function tabButton(tab: HistoryTab, text: string): HTMLButtonElement {
  return el("button", {
    class: "map-history-tab",
    text,
    attrs: { type: "button", role: "tab", "aria-selected": "false" },
    dataset: { testid: `map-history-tab-${tab}` },
  });
}

function activityTabLabel(): string {
  const count = editActivityEntryCount();
  return count > 0 ? `행위 기록 (${count})` : "행위 기록";
}

export function mapHistoryEntryCount(): number {
  return getMapEditHistoryEntries().length;
}

export function installMapHistoryPanelAutoMount(): void {
  if (autoMountInstalled) return;
  autoMountInstalled = true;
  const schedule = (): void => scheduleMapHistoryPanelMount();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, schedule);
  editorState.subscribe(schedule);
  // 이 구독은 «팔레트 뿌리에 작업 기록 창이 있는가»만 확인한다. 타일 칠하기·높이 붓 통지(cells/relief)는 창의 유무를 바꾸지 못하므로 거른다.
  store.subscribe((_project, change) => {
    if (change?.scope === "map" && (change.cells?.length || change.relief) && !change.projectSwitch) return;
    schedule();
  });
  schedule();
}

function scheduleMapHistoryPanelMount(): void {
  if (mountQueued) return;
  mountQueued = true;
  const run = (): void => {
    mountQueued = false;
    mountMapHistoryPanel();
  };
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else setTimeout(run, 0);
}

function mountMapHistoryPanel(): void {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (!root) return;
  installPaletteRootObserver(root);
  if (root.querySelector('[data-testid="map-history-panel"]')) return;
  root.append(renderMapHistoryPanel());
}

function installPaletteRootObserver(root: HTMLElement): void {
  if (observedPaletteRoot === root || typeof MutationObserver === "undefined") return;
  paletteRootObserver?.disconnect();
  observedPaletteRoot = root;
  paletteRootObserver = new MutationObserver(() => {
    if (!root.querySelector('[data-testid="map-history-panel"]')) mountMapHistoryPanel();
  });
  paletteRootObserver.observe(root, { childList: true });
}

function historyRows(entries: readonly MapEditHistoryEntry[]): HTMLElement[] {
  if (entries.length === 0) return [el("li", { class: "map-history-empty", text: "작업 기록이 없습니다" })];
  return entries.map((entry) => historyRow(entry));
}

function historyRow(entry: MapEditHistoryEntry): HTMLElement {
  const project = store.getCurrent();
  const currentMapId = editorState.get().currentMapId ?? project.startMapId;
  const mapName = entry.mapId ? project.maps[entry.mapId]?.name ?? entry.mapId : "프로젝트";
  const otherMap = entry.mapId !== null && entry.mapId !== currentMapId;
  const marker = entry.current ? "● 현재" : `#${entry.at}`;
  const revertButton = el("button", {
    class: "map-history-revert",
    text: "이 지점으로 되돌리기",
    attrs: { type: "button", title: "이 기록 지점으로 프로젝트를 되돌립니다" },
    dataset: { testid: `history-revert-${entry.index}` },
    on: {
      click: () => {
        // 커스텀 인앱 모달(§2.4) — 네이티브 confirm 대체.
        void showConfirm({ title: "기록 되돌리기", message: `'${entry.label}' 지점으로 되돌릴까요?`, confirmLabel: "되돌리기" }).then((confirmed) => {
          if (!confirmed) return;
          if (revertToHistoryIndex(entry.index)) toast("되돌렸습니다", "ok");
        });
      },
    },
  });
  return el("li", {
    class: `map-history-item${entry.current ? " is-current" : ""}${otherMap ? " is-other-map" : ""}`,
    children: [
      el("span", { class: "map-history-dot", attrs: { "aria-hidden": "true" }, text: "●" }),
      el("div", {
        class: "map-history-content",
        children: [
          el("div", {
            class: "map-history-label-row",
            children: [
              el("span", { class: "map-history-label", text: entry.label }),
              el("span", { class: "map-history-current", text: marker }),
            ],
          }),
          el("div", { class: "map-history-map", text: otherMap ? `${mapName} (다른 맵)` : mapName }),
          revertButton,
        ],
      }),
    ],
  });
}

type HistoryButtonOptions = {
  readonly action: () => void;
  readonly disabled: boolean;
  readonly testId: string;
  readonly text: string;
  readonly title: string;
};

function historyButton(options: HistoryButtonOptions): HTMLButtonElement {
  const button = el("button", {
    class: "map-history-button",
    text: options.text,
    attrs: { type: "button", title: options.title },
    dataset: { testid: options.testId },
    on: { click: options.action },
  });
  button.disabled = options.disabled;
  button.setAttribute("aria-disabled", String(options.disabled));
  return button;
}
