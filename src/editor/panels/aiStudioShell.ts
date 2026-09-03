// AI 스튜디오 셸 — 살아 있는 맵 에디터를 모니터에 들이고, 아래 덱에 AI 도구를 깐다.
//
//   장면 목록 | 맵 에디터(실제 Phaser 캔버스)
//                 AI 도구 덱                    | 오른쪽 전고 채팅
// 썸네일 그림이 아니다. 모니터는 edit-canvas 를 재부모화해서 줌·팬·클릭이 그대로 된다.

import type { WorkItem, WorkPlan } from "@/ai/workPlan";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import {
  renderChangePreviewCard,
  type ChangePreviewInput,
} from "@/editor/panels/aiChangePreview";
import { filterToolCategories, FREQUENT_TOOL_NAMES } from "@/editor/panels/toolBrowserModal";
import type { ToolDefinition } from "@/editor/tools/types";
import { TOOL_LABELS, toolLabel } from "./aiToolLabels";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";

export type StudioDeckTab = "tools" | "work" | "changes";

export interface StudioShellPieces {
  readonly historyLogMount: HTMLElement;
  readonly commandBar: HTMLElement;
}

export interface StudioShellOptions {
  readonly onExit: () => void;
  readonly onFontZoom: (delta: number) => void;
  readonly onUseTool?: (tool: ToolDefinition) => void;
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
  { id: "tools", label: "도구" },
  { id: "work", label: "작업" },
  { id: "changes", label: "변경" },
];


const STUDIO_EXTRA_TOOLS = [
  "create_map",
  "resize_map",
  "author_village",
  "paint_tiles",
  "stamp_structure",
  "find_events",
  "run_lint",
  "get_map_region",
  "create_quest",
  "link_maps",
] as const;

type ParkedNode = {
  readonly node: HTMLElement;
  readonly parent: HTMLElement;
  readonly next: ChildNode | null;
};

export function createStudioShell(options: StudioShellOptions): StudioShell {
  let attachedTo: HTMLElement | null = null;
  let logHome: HTMLElement | null = null;
  let barHome: HTMLElement | null = null;
  let pieces: StudioShellPieces | null = null;
  let deckTab: StudioDeckTab = "tools";
  let workPlan: WorkPlan | null = null;
  let workActive = false;
  let changePreview: ChangePreviewInput | null = null;
  let toolLines: readonly string[] = [];
  let parked: ParkedNode[] = [];
  let fitObserver: ResizeObserver | null = null;

  const sceneList = el("div", {
    class: "ai-studio-scene-list",
    dataset: { testid: "ai-studio-scenes" },
  });
  const monitorStage = el("div", {
    class: "ai-studio-monitor-stage",
    dataset: { testid: "ai-studio-monitor-stage" },
  });
  const monitorChrome = el("div", {
    class: "ai-studio-monitor-chrome",
    dataset: { testid: "ai-studio-monitor-chrome" },
  });
  const monitorLabel = el("span", {
    class: "ai-studio-monitor-label",
    dataset: { testid: "ai-studio-monitor-label" },
    text: "맵 에디터",
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
        children: [monitorStage, monitorChrome, monitorLabel],
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
    if (deckTab === "tools") {
      deckPane.replaceChildren(renderToolsPane(options.onUseTool));
      return;
    }
    if (deckTab === "work") {
      deckPane.replaceChildren(renderWorkPane(workPlan, workActive));
      return;
    }
    if (!changePreview) {
      deckPane.replaceChildren(emptyHint("아직 비교할 변경이 없습니다. 조수가 맵을 고치면 이전/이후가 여기 뜹니다."));
      return;
    }
    deckPane.replaceChildren(renderChangePreviewCard(changePreview));
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
    monitorLabel.textContent = map ? `맵 에디터 · ${map.name || mapId}` : "맵 에디터";
    if (parked.length > 0) return;
    if (monitorStage.querySelector("[data-testid=edit-canvas]")) return;
    if (!monitorStage.querySelector("[data-testid=ai-studio-monitor-empty]")) {
      monitorStage.replaceChildren(el("div", {
        class: "ai-studio-monitor-empty",
        dataset: { testid: "ai-studio-monitor-empty" },
        text: "맵을 여기서 직접 움직입니다",
      }));
    }
  };

  const adoptLiveMap = (): void => {
    releaseLiveMap();
    const canvas = typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-testid=edit-canvas]");
    const toolbar = typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-testid=editor-zoom-controls]");
    const shell = canvas?.closest(".editor-canvas-scroll-shell") as HTMLElement | null;
    parkNode(shell ?? canvas);
    parkNode(toolbar);
    monitorStage.replaceChildren();
    if (shell) monitorStage.append(shell);
    else if (canvas) monitorStage.append(canvas);
    else {
      monitorStage.append(el("div", {
        class: "ai-studio-monitor-empty",
        dataset: { testid: "ai-studio-monitor-empty" },
        text: "맵을 여기서 직접 움직입니다",
      }));
    }
    if (toolbar) monitorChrome.append(toolbar);
    requestCanvasFit();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestCanvasFit());
    }
  };

  const parkNode = (node: HTMLElement | null | undefined): void => {
    if (!node || !node.parentElement) return;
    parked.push({ node, parent: node.parentElement, next: node.nextSibling });
    node.remove();
  };

  const releaseLiveMap = (): void => {
    for (const item of parked.slice().reverse()) {
      item.node.remove();
      const parent = item.parent;
      if (item.next && item.next.parentNode === parent && typeof parent.insertBefore === "function") {
        parent.insertBefore(item.node, item.next);
      } else {
        parent.append(item.node);
      }
    }
    parked = [];
    monitorChrome.replaceChildren();
    requestCanvasFit();
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
    adoptLiveMap();
    refreshScenes();
    refreshMonitor();
    showTab(deckTab);
    if (typeof ResizeObserver !== "undefined") {
      fitObserver = new ResizeObserver(() => requestCanvasFit());
      fitObserver.observe(monitorStage);
    }
  };

  const detach = (): void => {
    fitObserver?.disconnect();
    fitObserver = null;
    releaseLiveMap();
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

  showTab("tools");

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
      else if (deckTab === "work") renderDeck();
    },
    setChangePreview(input) {
      changePreview = input;
      if (input && attachedTo) showTab("changes");
      else if (deckTab === "changes") renderDeck();
    },
    setToolLines(lines) {
      toolLines = lines;
      if (deckTab === "tools" && toolLines.length > 0) {
        // 라이브 도구 호출 로그는 카드 그리드 아래 보조로만 쓴다 — 덱 주인공은 도구 팔레트.
        void toolLines;
      }
    },
    setDeckTab: showTab,
    dispose() {
      detach();
    },
  };
}

function requestCanvasFit(): void {
  if (typeof window === "undefined") return;
  const fire = (): void => {
    window.dispatchEvent(new Event("resize"));
  };
  fire();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      fire();
      requestAnimationFrame(fire);
    });
  }
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

function toolShortLabel(tool: ToolDefinition): string {
  // 사전(aiToolLabels)에 있으면 로그 행과 같은 이름. 없으면 설명 첫 절을 잘라 쓴다.
  if (TOOL_LABELS[tool.name]) return toolLabel(tool.name);
  const cut = tool.description.split(/[.\n(]/u)[0]?.trim() ?? tool.name;
  return cut.length > 10 ? `${cut.slice(0, 9)}…` : cut;
}

function renderToolCard(tool: ToolDefinition, onUseTool?: (tool: ToolDefinition) => void): HTMLElement {
  return el("button", {
    class: "ai-studio-tool-card",
    attrs: {
      type: "button",
      title: tool.description,
    },
    dataset: { testid: "ai-studio-tool-card", tool: tool.name },
    on: {
      click: () => onUseTool?.(tool),
    },
    children: [
      el("b", { text: toolShortLabel(tool) }),
      el("span", {
        class: tool.mode === "write" ? "ai-studio-tool-mode is-write" : "ai-studio-tool-mode",
        text: tool.mode === "write" ? "편집" : "조회",
      }),
    ],
  });
}

function studioDeckTools(): ToolDefinition[] {
  const byName = new Map(
    filterToolCategories("").flatMap((category) => category.tools).map((tool) => [tool.name, tool]),
  );
  const cards: ToolDefinition[] = [];
  const seen = new Set<string>();
  for (const name of [...FREQUENT_TOOL_NAMES, ...STUDIO_EXTRA_TOOLS]) {
    if (seen.has(name)) continue;
    const tool = byName.get(name);
    if (!tool) continue;
    seen.add(name);
    cards.push(tool);
  }
  return cards;
}

function renderToolsPane(onUseTool?: (tool: ToolDefinition) => void): HTMLElement {
  const cards = studioDeckTools();
  if (cards.length === 0) {
    return el("p", { class: "ai-studio-empty", text: "쓸 수 있는 AI 도구가 없습니다." });
  }
  return el("div", {
    class: "ai-studio-tool-grid",
    dataset: { testid: "ai-studio-tool-grid" },
    children: cards.map((tool) => renderToolCard(tool, onUseTool)),
  });
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
