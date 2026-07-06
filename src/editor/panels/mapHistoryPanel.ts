import { editorState } from "@/editor/editorState";
import {
  getMapEditHistoryEntries,
  getMapEditHistoryState,
  MAP_EDIT_HISTORY_EVENT,
  redoMapEdit,
  revertToHistoryIndex,
  undoMapEdit,
  type MapEditHistoryEntry,
} from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

let autoMountInstalled = false;
let mountQueued = false;
let observedPaletteRoot: HTMLElement | null = null;
let paletteRootObserver: MutationObserver | null = null;

export function renderMapHistoryPanel(): HTMLElement {
  const root = el("details", {
    class: "map-history-panel panel-section",
    attrs: { open: "", "aria-label": "작업 기록" },
    dataset: { testid: "map-history-panel" },
  });

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
    root.replaceChildren(
      el("summary", { text: "🕑 작업 기록" }),
      el("div", { class: "map-history-actions", children: [undo, redo] }),
      list
    );
  };

  refresh();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, refresh);
  return root;
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
  store.subscribe(schedule);
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
        if (typeof window !== "undefined" && !window.confirm(`'${entry.label}' 지점으로 되돌릴까요?`)) return;
        if (revertToHistoryIndex(entry.index)) toast("되돌렸습니다", "ok");
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
