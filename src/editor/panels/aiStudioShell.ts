// AI 스튜디오 셸 — 타일 에디터를 덮는 연출 워크스페이스.
//
// 기본 조수는 캔버스 위 입력줄 캡슐이다. 스튜디오만 이 레이아웃이다:
//   장면 목록 | 맵 모니터
//                 덱(작업/변경/도구)     | 오른쪽 전고 채팅
// 모니터는 타일 팔레트가 아니라 썸네일 미리보기다. 채팅은 오른쪽에만 산다.

import type { WorkItem, WorkPlan } from "@/ai/workPlan";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import {
  renderChangePreviewCard,
  type ChangePreviewInput,
} from "@/editor/panels/aiChangePreview";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";

export type StudioDeckTab = "work" | "changes" | "tools";

export interface StudioShellPieces {
  readonly historyLogMount: HTMLElement;
  readonly commandBar: HTMLElement;
}

export interface StudioShellOptions {
  readonly onExit: () => void;
  readonly onFontZoom: (delta: number) => void;
}

export interface StudioShell {
  readonly root: HTMLElement;
  attach(panel: HTMLElement, pieces: StudioShellPieces): void;
  detach(): void;
  attached(): boolean;
  refreshScenes(): void;
  refreshMonitor(): void;
  setStatus(text: string): void;
  setWorkPlan(plan: WorkPlan | null, active: boolean): void;
  setChangePreview(input: ChangePreviewInput | null): void;
  setToolLines(lines: readonly string[]): void;
  setDeckTab(tab: StudioDeckTab): void;
  dispose(): void;
}

const WORK_STATUS_LABEL: Record<WorkItem["status"], string> = {
  pending: "대기",
  in_progress: "중",
  done: "됨",
  skipped: "건너뜀",
  blocked: "막힘",
};

const DECK_TABS: readonly { readonly id: StudioDeckTab; readonly label: string }[] = [
  { id: "work", label: "작업" },
  { id: "changes", label: "변경" },
  { id: "tools", label: "도구" },
];

export function createStudioShell(options: StudioShellOptions): StudioShell {
  let attachedTo: HTMLElement | null = null;
  let logHome: HTMLElement | null = null;
  let barHome: HTMLElement | null = null;
  let pieces: StudioShellPieces | null = null;
  let deckTab: StudioDeckTab = "work";
  let workPlan: WorkPlan | null = null;
  let workActive = false;
  let changePreview: ChangePreviewInput | null = null;
  let toolLines: readonly string[] = [];

  const sceneList = el("div", {
    class: "ai-studio-scene-list",
    dataset: { testid: "ai-studio-scenes" },
  });
  const monitorStage = el("div", {
    class: "ai-studio-monitor-stage",
    dataset: { testid: "ai-studio-monitor-stage" },
  });
  const monitorLabel = el("span", {
    class: "ai-studio-monitor-label",
    dataset: { testid: "ai-studio-monitor-label" },
    text: "모니터",
  });
  const statusLine = el("p", {
    class: "ai-studio-who-line",
    dataset: { testid: "ai-studio-status" },
    text: "장면을 만들고 있음",
  });
  const chatLogSlot = el("div", {
    class: "ai-studio-chat-log",
    dataset: { testid: "ai-studio-chat-log" },
  });
  const composerSlot = el("div", {
    class: "ai-studio-composer",
    dataset: { testid: "ai-studio-composer" },
  });
  const deckPane = el("div", {
    class: "ai-studio-deck-pane",
    dataset: { testid: "ai-studio-deck-pane" },
  });
  const tabButtons = new Map<StudioDeckTab, HTMLButtonElement>();

  const tabs = el("div", {
    class: "ai-studio-tabs",
    attrs: { role: "tablist", "aria-label": "스튜디오 덱" },
    children: DECK_TABS.map((tab) => {
      const button = el("button", {
        class: "ai-studio-tab",
        text: tab.label,
        attrs: { type: "button", role: "tab", "aria-selected": "false" },
        dataset: { testid: `ai-studio-tab-${tab.id}` },
        on: { click: () => showTab(tab.id) },
      }) as HTMLButtonElement;
      tabButtons.set(tab.id, button);
      return button;
    }),
  });

  const root = el("div", {
    class: "ai-studio-shell",
    attrs: { "aria-label": "AI 스튜디오" },
    dataset: { testid: "ai-studio-shell" },
    children: [
      el("aside", {
        class: "ai-studio-scenes",
        children: [
          el("h3", { class: "ai-studio-kicker", text: "장면" }),
          sceneList,
        ],
      }),
      el("section", {
        class: "ai-studio-monitor",
        dataset: { testid: "ai-studio-monitor" },
        children: [monitorStage, monitorLabel],
      }),
      el("aside", {
        class: "ai-studio-chat",
        dataset: { testid: "ai-studio-chat" },
        children: [
          el("div", {
            class: "ai-studio-who",
            children: [
              el("h1", { class: "ai-studio-who-title", text: "조수" }),
              statusLine,
            ],
          }),
          chatLogSlot,
          composerSlot,
        ],
      }),
      el("section", {
        class: "ai-studio-deck",
        dataset: { testid: "ai-studio-deck" },
        children: [tabs, deckPane],
      }),
    ],
  });

  chatLogSlot.addEventListener("wheel", (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    options.onFontZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  const showTab = (tab: StudioDeckTab): void => {
    deckTab = tab;
    for (const [id, button] of tabButtons) {
      const on = id === tab;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", String(on));
    }
    renderDeck();
  };

  const emptyHint = (text: string): HTMLElement =>
    el("p", { class: "ai-studio-empty", text });

  const renderDeck = (): void => {
    if (deckTab === "work") {
      deckPane.replaceChildren(renderWorkPane(workPlan, workActive));
      return;
    }
    if (deckTab === "changes") {
      if (!changePreview) {
        deckPane.replaceChildren(emptyHint("아직 비교할 변경이 없습니다. 조수가 맵을 고치면 이전/이후가 여기 뜹니다."));
        return;
      }
      deckPane.replaceChildren(renderChangePreviewCard(changePreview));
      return;
    }
    if (toolLines.length === 0) {
      deckPane.replaceChildren(emptyHint("이번 장면에서 쓴 도구가 여기 쌓입니다."));
      return;
    }
    deckPane.replaceChildren(
      el("div", {
        class: "ai-studio-tool-list",
        dataset: { testid: "ai-studio-tool-list" },
        children: toolLines.map((line) => el("div", { class: "ai-studio-tool-line", text: line })),
      }),
    );
  };

  const refreshScenes = (): void => {
    const project = store.getCurrent();
    const currentId = editorState.get().currentMapId ?? project.startMapId;
    const rows: HTMLElement[] = [];
    walkScenes(project.mapTree, null, 0, project, currentId, rows);
    if (rows.length === 0) {
      rows.push(emptyHint("장면이 없습니다."));
    }
    sceneList.replaceChildren(...rows);
  };

  const refreshMonitor = (): void => {
    const project = store.getCurrent();
    const mapId = editorState.get().currentMapId ?? project.startMapId;
    const map = project.maps[mapId];
    monitorStage.replaceChildren();
    if (!map) {
      monitorLabel.textContent = "모니터 · 맵 없음";
      return;
    }
    const size = monitorThumbSize(map.width, map.height);
    const canvas = createMapThumbnail(mapId, {
      className: "ai-studio-monitor-thumb",
      height: size.height,
      testId: "ai-studio-monitor-thumb",
      width: size.width,
    });
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    monitorStage.append(canvas);
    monitorLabel.textContent = `모니터 · ${map.name || mapId}`;
  };

  const attach = (panel: HTMLElement, next: StudioShellPieces): void => {
    if (attachedTo === panel && pieces === next) {
      refreshScenes();
      refreshMonitor();
      renderDeck();
      return;
    }
    detach();
    pieces = next;
    logHome = next.historyLogMount.parentElement;
    barHome = next.commandBar.parentElement;
    next.historyLogMount.remove();
    chatLogSlot.append(next.historyLogMount);
    next.commandBar.remove();
    composerSlot.append(next.commandBar);
    panel.append(root);
    attachedTo = panel;
    refreshScenes();
    refreshMonitor();
    showTab(deckTab);
  };

  const detach = (): void => {
    if (!pieces) {
      root.remove();
      attachedTo = null;
      return;
    }
    pieces.historyLogMount.remove();
    logHome?.append(pieces.historyLogMount);
    pieces.commandBar.remove();
    barHome?.append(pieces.commandBar);
    root.remove();
    attachedTo = null;
    pieces = null;
    logHome = null;
    barHome = null;
  };

  showTab("work");

  return {
    root,
    attach,
    detach,
    attached: () => attachedTo !== null,
    refreshScenes,
    refreshMonitor,
    setStatus(text: string) {
      const trimmed = text.trim();
      statusLine.textContent = trimmed && trimmed !== "대기" ? trimmed : "장면을 만들고 있음";
    },
    setWorkPlan(plan, active) {
      workPlan = plan;
      workActive = active;
      if (plan && attachedTo) showTab("work");
      else renderDeck();
    },
    setChangePreview(input) {
      changePreview = input;
      if (input && attachedTo) showTab("changes");
      else renderDeck();
    },
    setToolLines(lines) {
      toolLines = lines;
      if (deckTab === "tools") renderDeck();
    },
    setDeckTab: showTab,
    dispose() {
      detach();
    },
  };
}

function walkScenes(
  node: MapTreeNode,
  parentMapId: MapId | null,
  depth: number,
  project: Project,
  currentId: MapId | null,
  rows: HTMLElement[],
): void {
  if (isMapTreeFolder(node)) {
    rows.push(el("div", {
      class: "ai-studio-scene-group",
      text: mapTreeNodeLabel(node, project.maps),
    }));
    for (const child of node.children) walkScenes(child, parentMapId, depth, project, currentId, rows);
    return;
  }
  const map = project.maps[node.mapId];
  if (map) {
    const interior = Boolean(parentMapId ?? findParentMapId(project.mapTree, node.mapId));
    const on = node.mapId === currentId;
    rows.push(el("button", {
      class: on ? "ai-studio-scene is-on" : "ai-studio-scene",
      attrs: {
        type: "button",
        "aria-current": on ? "true" : "false",
        style: `padding-left:${8 + depth * 10}px`,
      },
      dataset: { testid: "ai-studio-scene", mapId: node.mapId },
      on: {
        click: () => {
          selectEditorMap(node.mapId);
        },
      },
      children: [
        el("b", { text: map.name || node.mapId }),
        el("span", { class: "ai-studio-scene-kind", text: interior ? "실내" : "맵" }),
      ],
    }));
  }
  for (const child of node.children) {
    walkScenes(child, node.mapId, depth + 1, project, currentId, rows);
  }
}

function monitorThumbSize(mapWidth: number, mapHeight: number): { width: number; height: number } {
  const maxW = 560;
  const maxH = 360;
  const cell = 8;
  const w = Math.max(1, mapWidth * cell);
  const h = Math.max(1, mapHeight * cell);
  const scale = Math.min(maxW / w, maxH / h, 3);
  return {
    width: Math.max(120, Math.round(w * scale)),
    height: Math.max(90, Math.round(h * scale)),
  };
}

function renderWorkPane(plan: WorkPlan | null, active: boolean): HTMLElement {
  if (!plan) {
    return el("div", {
      class: "ai-studio-work",
      children: [
        el("h4", { class: "ai-studio-card-kicker", text: "이번 장면" }),
        el("p", {
          class: "ai-studio-empty",
          text: "아직 작업 계획이 없습니다. 조수에게 장면을 맡기면 단계가 여기 쌓입니다.",
        }),
      ],
    });
  }
  const items = (Array.isArray(plan.layers) ? plan.layers : []).flatMap((layer) =>
    Array.isArray(layer.items) ? layer.items : [],
  );
  return el("div", {
    class: "ai-studio-work",
    dataset: { testid: "ai-studio-work" },
    children: [
      el("h4", { class: "ai-studio-card-kicker", text: active ? "진행 중" : "이번 장면" }),
      ...(plan.goal ? [el("p", { class: "ai-studio-goal", text: plan.goal })] : []),
      ...items.map((item) => {
        const status = item.status ?? "pending";
        return el("div", {
          class: "ai-studio-work-item",
          dataset: { testid: "ai-studio-work-item", status },
          children: [
            el("span", { text: item.title || "작업" }),
            el("span", {
              class: `ai-studio-work-mark is-${status}`,
              text: WORK_STATUS_LABEL[status],
            }),
          ],
        });
      }),
    ],
  });
}
