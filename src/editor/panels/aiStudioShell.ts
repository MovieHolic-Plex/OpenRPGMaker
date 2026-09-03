// AI 스튜디오 셸 — 「장면 콘솔」. 살아 있는 맵 에디터를 모니터에 들이고, 아래 덱에 AI 도구를 깐다.
//
//   장면 레일(썸네일·검색·새 장면) | 모니터(머리띠 + 실제 Phaser 캔버스) | 조수(상태·브리핑·로그·입력줄)
//                                 | 덱(도구 · 작업 · 변경 · 활동, 접기)
//
// 썸네일 그림이 아니다. 모니터는 edit-canvas 를 재부모화해서 줌·팬·클릭이 그대로 된다.
// 설계: docs/superpowers/specs/2026-09-03-ai-studio-console-design.md

import type { WorkItem, WorkPlan } from "@/ai/workPlan";
import { addMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { directorStartPrompts, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import {
  renderChangePreviewCard,
  type ChangePreviewInput,
} from "@/editor/panels/aiChangePreview";
import { renderEditorIcon, type EditorIconName } from "@/editor/panels/eventEditor/editorIcons";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import {
  filterToolCategories,
  FREQUENT_TOOL_NAMES,
  openToolBrowserModal,
} from "@/editor/panels/toolBrowserModal";
import type { ToolDefinition } from "@/editor/tools/types";
import { TOOL_LABELS, toolGroup, toolIconKey, toolLabel, type ToolGroup } from "./aiToolLabels";
import { deckIcon } from "./aiDeckIcons";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";

export type StudioDeckTab = "tools" | "work" | "changes" | "activity";

export interface StudioShellPieces {
  readonly historyLogMount: HTMLElement;
  readonly commandBar: HTMLElement;
}

export interface StudioShellOptions {
  readonly onExit: () => void;
  readonly onFontZoom: (delta: number) => void;
  readonly onUseTool?: (tool: ToolDefinition) => void;
  /** 브리핑의 제안 버튼 — 입력줄을 채우는 쪽이 받는다. */
  readonly onSuggest?: (instruction: string) => void;
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
  in_progress: "진행 중",
  done: "완료",
  skipped: "건너뜀",
  blocked: "막힘",
};

const DECK_TABS: readonly { readonly id: StudioDeckTab; readonly label: string; readonly icon: EditorIconName }[] = [
  { id: "tools", label: "도구", icon: "tool" },
  { id: "work", label: "작업", icon: "lines" },
  { id: "changes", label: "변경", icon: "image" },
  { id: "activity", label: "활동", icon: "clock" },
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

const DEFAULT_SCENE_SIZE = { width: 20, height: 15 } as const;
const ACTIVITY_LIMIT = 40;

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
  let deckCollapsed = false;
  let workPlan: WorkPlan | null = null;
  let workActive = false;
  let changePreview: ChangePreviewInput | null = null;
  let toolLines: readonly string[] = [];
  let sceneQuery = "";
  let toolQuery = "";
  let scenesCollapsed = false;
  let chatCollapsed = false;
  const expandedScenes = new Set<string>();
  let parked: ParkedNode[] = [];
  let fitObserver: ResizeObserver | null = null;
  let logObserver: MutationObserver | null = null;

  // ── 장면 레일 ─────────────────────────────────────────────────────────────
  const sceneCount = el("span", {
    class: "ai-studio-count",
    dataset: { testid: "ai-studio-scene-count" },
  });
  const sceneList = el("div", {
    class: "ai-studio-scene-list",
    dataset: { testid: "ai-studio-scenes" },
  });
  const sceneSearch = el("input", {
    class: "ai-studio-search-input",
    attrs: { type: "search", placeholder: "장면 찾기", "aria-label": "장면 찾기", autocomplete: "off" },
    dataset: { testid: "ai-studio-scene-search" },
    on: {
      input: () => {
        sceneQuery = sceneSearch.value.trim();
        refreshScenes();
      },
    },
  }) as HTMLInputElement;
  const addSceneButton = el("button", {
    class: "ai-studio-icon-btn",
    attrs: { type: "button", title: "새 장면", "aria-label": "새 장면 만들기" },
    dataset: { testid: "ai-studio-scene-add" },
    children: [renderEditorIcon("plus")],
    on: { click: () => createScene() },
  });
  const scenesCollapseButton = el("button", {
    class: "ai-studio-icon-btn",
    attrs: { type: "button", title: "장면 목록 접기", "aria-label": "장면 목록 접기", "aria-expanded": "true" },
    dataset: { testid: "ai-studio-scenes-collapse" },
    children: [renderEditorIcon("arrowLeft")],
    on: { click: () => setScenesCollapsed(!scenesCollapsed) },
  });
  const scenesPane = el("aside", {
    class: "ai-studio-scenes",
    attrs: { "aria-label": "장면" },
    children: [
      el("div", {
        class: "ai-studio-pane-head",
        children: [
          el("h3", { class: "ai-studio-pane-title", children: ["장면", sceneCount] }),
          el("div", { class: "ai-studio-pane-actions", children: [addSceneButton, scenesCollapseButton] }),
        ],
      }),
      el("label", {
        class: "ai-studio-search",
        children: [renderEditorIcon("search"), sceneSearch],
      }),
      sceneList,
    ],
  });

  // ── 모니터 ───────────────────────────────────────────────────────────────
  const monitorStage = el("div", {
    class: "ai-studio-monitor-stage",
    dataset: { testid: "ai-studio-monitor-stage" },
  });
  const monitorChrome = el("div", {
    class: "ai-studio-monitor-chrome",
    dataset: { testid: "ai-studio-monitor-chrome" },
  });
  const monitorLabel = el("h2", {
    class: "ai-studio-monitor-label",
    dataset: { testid: "ai-studio-monitor-label" },
    text: "맵 에디터",
  });
  const monitorMeta = el("div", {
    class: "ai-studio-monitor-meta",
    dataset: { testid: "ai-studio-monitor-meta" },
  });
  const exitButton = el("button", {
    class: "ai-studio-exit",
    attrs: { type: "button", title: "스튜디오를 닫고 타일 편집기로 돌아갑니다" },
    dataset: { testid: "ai-studio-exit" },
    children: [renderEditorIcon("arrowLeft"), el("span", { text: "편집기로" })],
    on: { click: () => options.onExit() },
  });
  const monitorPane = el("section", {
    class: "ai-studio-monitor",
    dataset: { testid: "ai-studio-monitor" },
    attrs: { "aria-label": "맵 모니터" },
    children: [
      el("header", {
        class: "ai-studio-monitor-head",
        children: [
          el("div", { class: "ai-studio-monitor-title", children: [monitorLabel, monitorMeta] }),
          el("div", { class: "ai-studio-monitor-tools", children: [monitorChrome, exitButton] }),
        ],
      }),
      monitorStage,
    ],
  });

  // ── 조수 ─────────────────────────────────────────────────────────────────
  const statusLine = el("p", {
    class: "ai-studio-who-line",
    dataset: { testid: "ai-studio-status", state: "idle" },
    text: "대기 중",
  });
  const briefing = el("section", {
    class: "ai-studio-briefing",
    attrs: { "aria-label": "지금 이 장면" },
    dataset: { testid: "ai-studio-briefing" },
  });
  const chatLogSlot = el("div", {
    class: "ai-studio-chat-log",
    dataset: { testid: "ai-studio-chat-log" },
  });
  const composerSlot = el("div", {
    class: "ai-studio-composer",
    dataset: { testid: "ai-studio-composer" },
  });
  const chatCollapseButton = el("button", {
    class: "ai-studio-icon-btn",
    attrs: { type: "button", title: "조수 접기", "aria-label": "조수 접기", "aria-expanded": "true" },
    dataset: { testid: "ai-studio-chat-collapse" },
    children: [renderEditorIcon("arrowRight")],
    on: { click: () => setChatCollapsed(!chatCollapsed) },
  });
  const chatPane = el("aside", {
    class: "ai-studio-chat",
    dataset: { testid: "ai-studio-chat" },
    attrs: { "aria-label": "조수" },
    children: [
      el("header", {
        class: "ai-studio-chat-head",
        children: [
          el("span", { class: "ai-studio-status-dot", attrs: { "aria-hidden": "true" } }),
          el("div", {
            class: "ai-studio-who",
            children: [
              el("h2", { class: "ai-studio-who-title", text: "조수" }),
              statusLine,
            ],
          }),
          chatCollapseButton,
        ],
      }),
      el("div", { class: "ai-studio-chat-body", children: [briefing, chatLogSlot] }),
      composerSlot,
    ],
  });

  chatLogSlot.addEventListener("wheel", (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    options.onFontZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  // ── 덱 ───────────────────────────────────────────────────────────────────
  const deckPane = el("div", {
    class: "ai-studio-deck-pane",
    dataset: { testid: "ai-studio-deck-pane" },
  });
  const tabButtons = new Map<StudioDeckTab, HTMLButtonElement>();
  const tabBadges = new Map<StudioDeckTab, HTMLElement>();
  const tabs = el("div", {
    class: "ai-studio-tabs",
    attrs: { role: "tablist", "aria-label": "스튜디오 덱" },
    children: DECK_TABS.map((tab) => {
      const badge = el("span", { class: "ai-studio-tab-badge", attrs: { hidden: "" } });
      const button = el("button", {
        class: "ai-studio-tab",
        attrs: { type: "button", role: "tab", "aria-selected": "false" },
        dataset: { testid: `ai-studio-tab-${tab.id}` },
        children: [renderEditorIcon(tab.icon), el("span", { text: tab.label }), badge],
        on: { click: () => showTab(tab.id) },
      }) as HTMLButtonElement;
      tabButtons.set(tab.id, button);
      tabBadges.set(tab.id, badge);
      return button;
    }),
  });
  const toolFilter = el("input", {
    class: "ai-studio-search-input",
    attrs: { type: "search", placeholder: "도구 찾기", "aria-label": "도구 찾기", autocomplete: "off" },
    dataset: { testid: "ai-studio-tool-filter" },
    on: {
      input: () => {
        toolQuery = toolFilter.value.trim();
        if (deckTab === "tools") renderDeck();
      },
    },
  }) as HTMLInputElement;
  const toolFilterWrap = el("label", {
    class: "ai-studio-search is-deck",
    children: [renderEditorIcon("search"), toolFilter],
  });
  const allToolsButton = el("button", {
    class: "ai-studio-ghost-btn",
    text: "모든 도구",
    attrs: { type: "button", title: "툴 브라우저에서 전체 도구를 봅니다" },
    dataset: { testid: "ai-studio-tools-all" },
    on: { click: () => void openToolBrowserModal() },
  });
  const collapseButton = el("button", {
    class: "ai-studio-icon-btn ai-studio-deck-collapse",
    attrs: { type: "button", title: "덱 접기", "aria-label": "덱 접기", "aria-expanded": "true" },
    dataset: { testid: "ai-studio-deck-collapse" },
    children: [renderEditorIcon("caret")],
    on: { click: () => setDeckCollapsed(!deckCollapsed) },
  });
  const deckPaneRoot = el("section", {
    class: "ai-studio-deck",
    dataset: { testid: "ai-studio-deck" },
    attrs: { "aria-label": "AI 도구 덱" },
    children: [
      el("div", {
        class: "ai-studio-deck-head",
        children: [tabs, el("div", { class: "ai-studio-deck-actions", children: [toolFilterWrap, allToolsButton, collapseButton] })],
      }),
      deckPane,
    ],
  });

  const root = el("div", {
    class: "ai-studio-shell",
    attrs: { "aria-label": "AI 스튜디오" },
    dataset: { testid: "ai-studio-shell" },
    children: [scenesPane, monitorPane, chatPane, deckPaneRoot],
  });

  // ── 덱 상태 ───────────────────────────────────────────────────────────────
  const setBadge = (tab: StudioDeckTab, text: string | null): void => {
    const badge = tabBadges.get(tab);
    if (!badge) return;
    if (text === null) {
      badge.textContent = "";
      badge.setAttribute("hidden", "");
      badge.classList.remove("is-dot");
      return;
    }
    badge.removeAttribute("hidden");
    badge.classList.toggle("is-dot", text === "");
    badge.textContent = text;
  };

  const showTab = (tab: StudioDeckTab): void => {
    deckTab = tab;
    for (const [id, button] of tabButtons) {
      const on = id === tab;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", String(on));
    }
    toolFilterWrap.classList.toggle("is-hidden", tab !== "tools");
    renderDeck();
  };

  const setDeckCollapsed = (next: boolean): void => {
    deckCollapsed = next;
    deckPaneRoot.classList.toggle("is-collapsed", next);
    collapseButton.setAttribute("aria-expanded", String(!next));
    collapseButton.setAttribute("aria-label", next ? "덱 펼치기" : "덱 접기");
    collapseButton.setAttribute("title", next ? "덱 펼치기" : "덱 접기");
    requestCanvasFit();
  };

  const setScenesCollapsed = (next: boolean): void => {
    scenesCollapsed = next;
    root.classList.toggle("is-scenes-collapsed", next);
    scenesCollapseButton.setAttribute("aria-expanded", String(!next));
    scenesCollapseButton.setAttribute("aria-label", next ? "장면 목록 펼치기" : "장면 목록 접기");
    scenesCollapseButton.setAttribute("title", next ? "장면 목록 펼치기" : "장면 목록 접기");
    scenesCollapseButton.replaceChildren(renderEditorIcon(next ? "arrowRight" : "arrowLeft"));
    requestCanvasFit();
  };

  const setChatCollapsed = (next: boolean): void => {
    chatCollapsed = next;
    root.classList.toggle("is-chat-collapsed", next);
    chatCollapseButton.setAttribute("aria-expanded", String(!next));
    chatCollapseButton.setAttribute("aria-label", next ? "조수 펼치기" : "조수 접기");
    chatCollapseButton.setAttribute("title", next ? "조수 펼치기" : "조수 접기");
    chatCollapseButton.replaceChildren(renderEditorIcon(next ? "arrowLeft" : "arrowRight"));
    requestCanvasFit();
  };

  const renderDeck = (): void => {
    if (deckTab === "tools") {
      deckPane.replaceChildren(renderToolsPane(toolQuery, options.onUseTool));
      return;
    }
    if (deckTab === "work") {
      deckPane.replaceChildren(renderWorkPane(workPlan, workActive));
      return;
    }
    if (deckTab === "activity") {
      deckPane.replaceChildren(renderActivityPane(toolLines));
      return;
    }
    if (!changePreview) {
      deckPane.replaceChildren(emptyHint("image", "아직 비교할 변경이 없습니다. 조수가 맵을 고치면 이전/이후가 여기 뜹니다."));
      return;
    }
    deckPane.replaceChildren(renderChangePreviewCard(changePreview));
  };

  // ── 장면 ─────────────────────────────────────────────────────────────────
  const refreshScenes = (): void => {
    const project = store.getCurrent();
    const currentId = editorState.get().currentMapId ?? project.startMapId;
    const rows: HTMLElement[] = [];
    const query = sceneQuery.toLocaleLowerCase();
    expandAncestors(project.mapTree, currentId, expandedScenes);
    walkScenes(project.mapTree, null, 0, project, currentId, query, rows, expandedScenes, (mapId) => {
      if (expandedScenes.has(mapId)) expandedScenes.delete(mapId);
      else expandedScenes.add(mapId);
      refreshScenes();
    });
    sceneCount.textContent = String(Object.keys(project.maps).length);
    if (rows.length === 0) {
      rows.push(el("p", {
        class: "ai-studio-empty-text",
        text: sceneQuery ? `‘${sceneQuery}’ 에 맞는 장면이 없습니다.` : "장면이 없습니다.",
      }));
    }
    sceneList.replaceChildren(...rows);
  };

  const createScene = (): void => {
    const project = store.getCurrent();
    const name = `새 장면 ${Object.keys(project.maps).length + 1}`;
    const mapId = addMap(name, DEFAULT_SCENE_SIZE.width, DEFAULT_SCENE_SIZE.height);
    if (!mapId) return;
    selectEditorMap(mapId);
    refreshScenes();
    refreshMonitor();
  };

  // ── 모니터·브리핑 ──────────────────────────────────────────────────────────
  const conversationEmpty = (): boolean => {
    const mount = pieces?.historyLogMount;
    const log = mount?.querySelector<HTMLElement>(".ai-chat-log") ?? null;
    return !log || log.childElementCount === 0;
  };

  const refreshBriefing = (): void => {
    const empty = conversationEmpty();
    briefing.hidden = !empty;
    if (!empty) return;
    const brief = readAgentBrief();
    const meta: string[] = [];
    if (brief.mapSize) meta.push(brief.mapSize);
    meta.push(`이벤트 ${brief.eventCount}`);
    meta.push(brief.layerShort);
    const prompts = directorStartPrompts(brief);
    briefing.replaceChildren(
      el("p", { class: "ai-studio-kicker", text: "지금 이 장면" }),
      el("h3", { class: "ai-studio-briefing-title", text: brief.mapName }),
      el("p", { class: "ai-studio-briefing-meta", text: meta.join(" · ") }),
      ...(brief.deficit ? [el("p", { class: "ai-studio-briefing-deficit", text: brief.deficit })] : []),
      el("div", {
        class: "ai-studio-suggest-list",
        children: prompts.map((prompt) =>
          el("button", {
            class: "ai-studio-suggest",
            attrs: { type: "button", title: prompt.instruction },
            dataset: { testid: "ai-studio-suggest", prompt: prompt.id },
            children: [
              el("b", { text: prompt.label }),
              el("span", { text: prompt.instruction }),
            ],
            on: { click: () => options.onSuggest?.(prompt.instruction) },
          }),
        ),
      }),
    );
  };

  const refreshMonitor = (): void => {
    const project = store.getCurrent();
    const mapId = editorState.get().currentMapId ?? project.startMapId;
    const map = project.maps[mapId];
    const brief = readAgentBrief();
    monitorLabel.textContent = map ? (map.name || mapId) : "맵 에디터";
    const chips: HTMLElement[] = [];
    if (map) chips.push(metaChip(`${map.width}×${map.height}`));
    if (map) chips.push(metaChip(`이벤트 ${map.events.length}`));
    chips.push(metaChip(brief.layerShort));
    monitorMeta.replaceChildren(...chips);
    refreshBriefing();
    if (parked.length > 0) return;
    if (monitorStage.querySelector("[data-testid=edit-canvas]")) return;
    if (!monitorStage.querySelector("[data-testid=ai-studio-monitor-empty]")) {
      monitorStage.replaceChildren(monitorEmpty());
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
    else monitorStage.append(monitorEmpty());
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

  const watchLog = (mount: HTMLElement): void => {
    logObserver?.disconnect();
    logObserver = null;
    if (typeof MutationObserver === "undefined") return;
    logObserver = new MutationObserver(() => refreshBriefing());
    logObserver.observe(mount, { childList: true, subtree: true });
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
    watchLog(next.historyLogMount);
    showTab(deckTab);
    if (typeof ResizeObserver !== "undefined") {
      fitObserver = new ResizeObserver(() => requestCanvasFit());
      fitObserver.observe(monitorStage);
    }
  };

  const detach = (): void => {
    fitObserver?.disconnect();
    fitObserver = null;
    logObserver?.disconnect();
    logObserver = null;
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

  const refreshWorkBadge = (): void => {
    if (!workPlan) {
      setBadge("work", null);
      return;
    }
    const items = planItems(workPlan);
    const done = items.filter((item) => item.status === "done").length;
    setBadge("work", `${done}/${items.length}`);
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
      const idle = trimmed === "" || trimmed === "대기";
      statusLine.textContent = idle ? "대기 중" : trimmed;
      statusLine.dataset.state = idle ? "idle" : "busy";
      chatPane.classList.toggle("is-busy", !idle);
    },
    setWorkPlan(plan, active) {
      workPlan = plan;
      workActive = active;
      refreshWorkBadge();
      if (plan && attachedTo) showTab("work");
      else if (deckTab === "work") renderDeck();
    },
    setChangePreview(input) {
      changePreview = input;
      setBadge("changes", input ? "" : null);
      if (input && attachedTo) showTab("changes");
      else if (deckTab === "changes") renderDeck();
    },
    setToolLines(lines) {
      toolLines = lines.slice(0, ACTIVITY_LIMIT);
      setBadge("activity", toolLines.length > 0 ? String(toolLines.length) : null);
      if (deckTab === "activity") renderDeck();
    },
    setDeckTab: showTab,
    dispose() {
      detach();
    },
  };
}

function emptyHint(icon: EditorIconName, text: string): HTMLElement {
  return el("div", {
    class: "ai-studio-empty",
    children: [
      el("span", { class: "ai-studio-empty-icon", attrs: { "aria-hidden": "true" }, children: [renderEditorIcon(icon)] }),
      el("p", { class: "ai-studio-empty-text", text }),
    ],
  });
}

function metaChip(text: string): HTMLElement {
  return el("span", { class: "ai-studio-chip", text });
}

function monitorEmpty(): HTMLElement {
  return el("div", {
    class: "ai-studio-monitor-empty",
    dataset: { testid: "ai-studio-monitor-empty" },
    children: [
      el("span", { class: "ai-studio-empty-icon", attrs: { "aria-hidden": "true" }, children: [renderEditorIcon("image")] }),
      el("p", { class: "ai-studio-empty-text", text: "맵을 여기서 직접 움직입니다" }),
    ],
  });
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

function expandAncestors(tree: MapTreeNode, currentId: MapId | null, expanded: Set<string>): void {
  let id: MapId | null = currentId;
  while (id) {
    const parent = findParentMapId(tree, id);
    if (!parent) break;
    expanded.add(parent);
    id = parent;
  }
}

function walkScenes(
  node: MapTreeNode,
  parentMapId: MapId | null,
  depth: number,
  project: Project,
  currentId: MapId | null,
  query: string,
  rows: HTMLElement[],
  expanded: ReadonlySet<string>,
  onToggleFold: (mapId: MapId) => void,
): void {
  const filtering = query.length > 0;
  if (isMapTreeFolder(node)) {
    if (!filtering) {
      rows.push(el("div", {
        class: "ai-studio-scene-group",
        children: [
          el("span", { text: mapTreeNodeLabel(node, project.maps) }),
          el("span", { class: "ai-studio-count", text: String(countMaps(node)) }),
        ],
      }));
    }
    for (const child of node.children) {
      walkScenes(child, parentMapId, depth, project, currentId, query, rows, expanded, onToggleFold);
    }
    return;
  }
  const map = project.maps[node.mapId];
  const mapChildCount = node.children.filter((child) => !isMapTreeFolder(child)).length;
  if (map) {
    const name = map.name || node.mapId;
    const matches = !filtering || name.toLocaleLowerCase().includes(query);
    if (matches) {
      const interior = Boolean(parentMapId ?? findParentMapId(project.mapTree, node.mapId));
      const on = node.mapId === currentId;
      const isStart = node.mapId === project.startMapId;
      const canFold = !filtering && mapChildCount > 0;
      const open = expanded.has(node.mapId);
      // 실내는 배지가 아니라 들여쓰기(--scene-depth)와 data-kind 로만 말한다 — 15행에 같은
      // 배지가 반복되면 정보가 아니라 소음이다(실측 2026-09-03). 기본은 부모 아래 접기.
      const sceneBtn = el("button", {
        class: on ? "ai-studio-scene is-on" : "ai-studio-scene",
        attrs: {
          type: "button",
          "aria-current": on ? "true" : "false",
          title: name,
          style: `--scene-depth:${filtering || canFold ? 0 : depth}`,
        },
        dataset: { testid: "ai-studio-scene", mapId: node.mapId, kind: interior ? "interior" : "map" },
        on: {
          click: () => {
            selectEditorMap(node.mapId);
          },
        },
        children: [
          createMapThumbnail(node.mapId, {
            width: 56,
            height: 42,
            className: "ai-studio-scene-thumb",
            testId: `ai-studio-thumb-${node.mapId}`,
          }),
          el("span", {
            class: "ai-studio-scene-body",
            children: [
              el("span", {
                class: "ai-studio-scene-line",
                children: [
                  el("b", { text: name }),
                  ...(isStart ? [el("span", { class: "ai-studio-badge is-start", text: "시작" })] : []),
                ],
              }),
              el("span", {
                class: "ai-studio-scene-meta",
                text: `${map.width}×${map.height} · 이벤트 ${map.events.length}`,
              }),
            ],
          }),
        ],
      });
      if (!canFold) {
        rows.push(sceneBtn);
      } else {
        const foldLabel = open ? "하위 장면 접기" : `하위 장면 ${mapChildCount}개 펼치기`;
        rows.push(el("div", {
          class: open ? "ai-studio-scene-row is-open" : "ai-studio-scene-row",
          attrs: { style: `--scene-depth:${depth}` },
          children: [
            el("button", {
              class: open ? "ai-studio-scene-fold is-open" : "ai-studio-scene-fold",
              attrs: {
                type: "button",
                title: foldLabel,
                "aria-label": foldLabel,
                "aria-expanded": String(open),
              },
              dataset: { testid: "ai-studio-scene-fold", mapId: node.mapId },
              children: [renderEditorIcon("caret")],
              on: {
                click: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFold(node.mapId);
                },
              },
            }),
            sceneBtn,
          ],
        }));
      }
    }
  }
  const showMapChildren = filtering || expanded.has(node.mapId);
  for (const child of node.children) {
    if (isMapTreeFolder(child)) {
      walkScenes(child, node.mapId, depth, project, currentId, query, rows, expanded, onToggleFold);
      continue;
    }
    if (!showMapChildren) continue;
    walkScenes(child, node.mapId, depth + 1, project, currentId, query, rows, expanded, onToggleFold);
  }
}

function countMaps(node: MapTreeNode): number {
  let total = 0;
  for (const child of node.children) {
    if (!isMapTreeFolder(child)) total += 1;
    total += countMaps(child);
  }
  return total;
}

function toolShortLabel(tool: ToolDefinition): string {
  // 사전(aiToolLabels)에 있으면 로그 행과 같은 이름. 없으면 설명 첫 절을 잘라 쓴다.
  if (TOOL_LABELS[tool.name]) return toolLabel(tool.name);
  const cut = tool.description.split(/[.\n(]/u)[0]?.trim() ?? tool.name;
  return cut.length > 10 ? `${cut.slice(0, 9)}…` : cut;
}

function renderToolCard(tool: ToolDefinition, onUseTool?: (tool: ToolDefinition) => void): HTMLElement {
  // 데크(2026-09-03): 아이콘 타일. 「편집/조회」 반복 라벨은 정보가 0 이라 걷었다 — 묶음 헤더가 대신 말한다.
  return el("button", {
    class: `ai-studio-tool-card is-${toolGroup(tool.name)}`,
    attrs: {
      type: "button",
      title: tool.description,
    },
    dataset: { testid: "ai-studio-tool-card", tool: tool.name },
    on: {
      click: () => onUseTool?.(tool),
    },
    children: [
      deckIcon(toolIconKey(tool.name), { size: 22 }),
      el("b", { text: toolShortLabel(tool) }),
    ],
  });
}

const STUDIO_TOOL_GROUPS: readonly { readonly id: ToolGroup; readonly title: string; readonly includes: readonly ToolGroup[] }[] = [
  { id: "build", title: "짓기", includes: ["build", "world"] },
  { id: "people", title: "사람·이야기", includes: ["people"] },
  { id: "inspect", title: "보기·검사", includes: ["inspect", "system"] },
];

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

function toolMatches(tool: ToolDefinition, query: string): boolean {
  if (!query) return true;
  const hay = `${tool.name} ${toolShortLabel(tool)} ${tool.description}`.toLocaleLowerCase();
  return hay.includes(query);
}

function toolGrid(tools: readonly ToolDefinition[], onUseTool?: (tool: ToolDefinition) => void): HTMLElement {
  return el("div", {
    class: "ai-studio-tool-grid",
    dataset: { testid: "ai-studio-tool-grid" },
    children: STUDIO_TOOL_GROUPS.flatMap((group) => {
      const members = tools.filter((tool) => group.includes.includes(toolGroup(tool.name)));
      if (members.length === 0) return [];
      return [el("section", {
        class: "ai-studio-tool-group",
        dataset: { group: group.id },
        children: [
          el("h5", { class: "ai-studio-tool-group-title", text: group.title }),
          el("div", { class: "ai-studio-tool-tiles", children: members.map((tool) => renderToolCard(tool, onUseTool)) }),
        ],
      })];
    }),
  });
}

function renderToolsPane(rawQuery: string, onUseTool?: (tool: ToolDefinition) => void): HTMLElement {
  const query = rawQuery.toLocaleLowerCase();
  const frequent = studioDeckTools().filter((tool) => toolMatches(tool, query));
  const frequentNames = new Set(studioDeckTools().map((tool) => tool.name));
  const sections: HTMLElement[] = [];
  if (frequent.length > 0) {
    sections.push(el("section", {
      class: "ai-studio-tool-section",
      children: [
        el("h4", { class: "ai-studio-kicker", text: "자주 쓰는" }),
        toolGrid(frequent, onUseTool),
      ],
    }));
  }
  for (const category of filterToolCategories("")) {
    const tools = category.tools.filter((tool) => !frequentNames.has(tool.name) && toolMatches(tool, query));
    if (tools.length === 0) continue;
    const details = el("details", {
      class: "ai-studio-tool-section is-group",
      ...(query ? { attrs: { open: "" } } : {}),
      children: [
        el("summary", {
          class: "ai-studio-tool-summary",
          children: [
            renderEditorIcon("caret"),
            el("span", { text: category.label }),
            el("span", { class: "ai-studio-count", text: String(tools.length) }),
          ],
        }),
        toolGrid(tools, onUseTool),
      ],
    });
    sections.push(details);
  }
  if (sections.length === 0) {
    return el("p", {
      class: "ai-studio-empty-text",
      text: rawQuery ? `‘${rawQuery}’ 에 맞는 도구가 없습니다.` : "쓸 수 있는 AI 도구가 없습니다.",
    });
  }
  return el("div", { class: "ai-studio-tools", children: sections });
}

function planItems(plan: WorkPlan): WorkItem[] {
  return (Array.isArray(plan.layers) ? plan.layers : []).flatMap((layer) =>
    Array.isArray(layer.items) ? layer.items : [],
  );
}

function renderWorkPane(plan: WorkPlan | null, active: boolean): HTMLElement {
  if (!plan) {
    return emptyHint("lines", "아직 작업 계획이 없습니다. 조수에게 장면을 맡기면 단계가 여기 쌓입니다.");
  }
  const items = planItems(plan);
  const done = items.filter((item) => item.status === "done").length;
  const percent = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
  const layers = Array.isArray(plan.layers) ? plan.layers : [];
  return el("div", {
    class: "ai-studio-work",
    dataset: { testid: "ai-studio-work" },
    children: [
      el("header", {
        class: "ai-studio-work-head",
        children: [
          el("div", {
            class: "ai-studio-work-title",
            children: [
              el("p", { class: "ai-studio-kicker", text: active ? "진행 중" : "이번 장면" }),
              el("h4", { class: "ai-studio-goal", text: plan.goal || "작업 계획" }),
            ],
          }),
          el("span", { class: "ai-studio-work-count", text: `${done}/${items.length}` }),
        ],
      }),
      el("div", {
        class: "ai-studio-work-progress",
        attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(percent) },
        dataset: { testid: "ai-studio-work-progress" },
        // 채움은 width 가 아니라 transform 으로 움직인다 — 합성 단계에서만 그려져 레이아웃을 흔들지 않는다.
        children: [el("span", { class: "ai-studio-work-progress-fill", attrs: { style: `--progress:${(percent / 100).toFixed(2)}` } })],
      }),
      ...layers.flatMap((layer) => {
        const layerItems = Array.isArray(layer.items) ? layer.items : [];
        return [
          ...(layers.length > 1 && layer.title ? [el("p", { class: "ai-studio-work-layer", text: layer.title })] : []),
          ...layerItems.map((item) => {
            const status = item.status ?? "pending";
            return el("div", {
              class: `ai-studio-work-item is-${status}`,
              dataset: { testid: "ai-studio-work-item", status },
              children: [
                el("span", { class: "ai-studio-work-dot", attrs: { "aria-hidden": "true" } }),
                el("span", { class: "ai-studio-work-name", text: item.title || "작업" }),
                el("span", {
                  class: `ai-studio-work-mark is-${status}`,
                  text: WORK_STATUS_LABEL[status],
                }),
              ],
            });
          }),
        ];
      }),
    ],
  });
}

function renderActivityPane(lines: readonly string[]): HTMLElement {
  if (lines.length === 0) {
    const empty = emptyHint("clock", "조수가 도구를 부르면 호출 기록이 최신순으로 여기 흐릅니다.");
    empty.dataset.testid = "ai-studio-activity";
    return empty;
  }
  return el("ol", {
    class: "ai-studio-activity",
    dataset: { testid: "ai-studio-activity" },
    attrs: { "aria-label": "도구 호출 기록" },
    children: lines.map((line) => el("li", { class: "ai-studio-tool-line", text: line })),
  });
}
