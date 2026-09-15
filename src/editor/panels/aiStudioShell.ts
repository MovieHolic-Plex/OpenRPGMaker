// AI 스튜디오 셸 — 「장면 콘솔」. 살아 있는 맵 에디터를 모니터에 들이고, 아래 덱에 AI 도구를 깐다.
//
//   장면 레일(썸네일·검색·새 장면) | 모니터(머리띠 + 실제 Phaser 캔버스) | 조수(상태·브리핑·로그·입력줄)
//                                 | 덱(도구 · 작업 · 변경 · 활동, 접기)
//
// 썸네일 그림이 아니다. 모니터는 edit-canvas 를 재부모화해서 줌·팬·클릭이 그대로 된다.
// 설계: docs/superpowers/specs/2026-09-03-ai-studio-console-design.md

import type { WorkItem, WorkPlan } from "@/ai/workPlan";
import { addMap } from "@/editor/actions";
import { withAssistantViewTransition } from "@/editor/assistantViewSwitch";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { readAgentBrief } from "@/editor/panels/aiAgentBrief";
import {
  renderChangePreviewCard,
  type ChangePreviewInput,
} from "@/editor/panels/aiChangePreview";
import { renderEditorIcon, type EditorIconName } from "@/editor/panels/eventEditor/editorIcons";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import { createPlanningListView, currentPlanningMapId, type PlanningListView } from "@/editor/panels/aiPlanningList";
import { listMapPlanningItems } from "@/editor/mapPlanningActions";
import {
  filterToolCategories,
  FREQUENT_TOOL_NAMES,
  openToolBrowserModal,
} from "@/editor/panels/toolBrowserModal";
import type { ToolDefinition } from "@/editor/tools/types";
import { TOOL_LABELS, toolGroup, toolIconKey, toolLabel, type ToolGroup } from "./aiToolLabels";
import { deckIcon } from "./aiDeckIcons";
import { subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import { LANE_STATUS_LABEL } from "@/ai/piAgent/lane";
import type { LaneManager } from "./aiLaneManager";
import { laneSession } from "./aiLaneSession";
import {
  laneStatusClass,
  renderAgentLiveList,
  renderLaneThread,
  renderNewLanePane,
  renderTeamLiveRows,
  renderThreadList,
  type LaneFormState,
  type StudioThread,
} from "./aiLaneBoard";
import { teamBoardTotals, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { createTeamWorkPane } from "./aiTeamWorkPane";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";

export type StudioDeckTab = "newLane" | "tools" | "work" | "planning" | "changes" | "activity";

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
  /** 레인 매니저를 외부가 소유하면 그걸 쓴다(기본은 셸이 만든다). */
  readonly laneManager?: LaneManager;
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
  { id: "newLane", label: "새 레인", icon: "plus" },
  { id: "tools", label: "도구", icon: "tool" },
  { id: "work", label: "작업", icon: "lines" },
  { id: "planning", label: "기획", icon: "check" },
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

const STUDIO_LAYOUT_KEY = "oprn:ai-studio-layout";
const STUDIO_SPLITTER_MIN = { scenes: 180, chat: 280, deck: 140 } as const;
const STUDIO_SPLITTER_MAX = { scenes: 480, chat: 640, deck: 560 } as const;

interface StudioLayoutSizes {
  scenes: number;
  chat: number;
  deck: number;
}

function readStudioLayout(): Partial<StudioLayoutSizes> {
  try {
    const raw = localStorage.getItem(STUDIO_LAYOUT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StudioLayoutSizes>;
    const out: Partial<StudioLayoutSizes> = {};
    for (const key of ["scenes", "chat", "deck"] as const) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

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
  let deckTab: StudioDeckTab = "newLane";
  // 2026-09-16: 덱은 맵 위로 올라오는 오버레이 드로워다 — 기본은 닫힘, 맵이 세로를 다 쓴다.
  let deckCollapsed = true;
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
  let splitterCleanup: (() => void) | null = null;
  const SPLITTER_DEFAULTS: StudioLayoutSizes = { scenes: 252, chat: 400, deck: 236 };
  const savedLayout = readStudioLayout();
  const layoutSizes: StudioLayoutSizes = {
    scenes: savedLayout.scenes ?? SPLITTER_DEFAULTS.scenes,
    chat: savedLayout.chat ?? SPLITTER_DEFAULTS.chat,
    deck: savedLayout.deck ?? SPLITTER_DEFAULTS.deck,
  };
  const clampInit = (key: keyof StudioLayoutSizes, value: number): number => {
    const min = STUDIO_SPLITTER_MIN[key];
    const max = STUDIO_SPLITTER_MAX[key];
    if (!Number.isFinite(value)) return SPLITTER_DEFAULTS[key];
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  layoutSizes.scenes = clampInit("scenes", layoutSizes.scenes);
  layoutSizes.chat = clampInit("chat", layoutSizes.chat);
  layoutSizes.deck = clampInit("deck", layoutSizes.deck);

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

  // ── 좌 레일 — 조수 활동(실시간) · 채팅 목록 · 장면 ───────────────────────────
  // 2026-09-16 재배치: 가운데는 맵, 왼쪽은 «지금 누가 무엇을 하는가 + 무슨 대화가 있는가»,
  // 오른쪽은 「지금 보고 있는 채팅」. 장면 목록은 좌 레일 안으로 들어와 검색·추가를 그대로 갖는다.
  let selectedThreadId = "director";
  const agentCount = el("span", { class: "ai-studio-count", text: "0" });
  const agentsLiveDot = el("span", { class: "ai-studio-status-dot", attrs: { "aria-hidden": "true" } });
  const agentList = el("div", { class: "ai-studio-agents", dataset: { testid: "ai-studio-agents" } });
  const threadList = el("div", { class: "ai-studio-threads", dataset: { testid: "ai-studio-threads" } });
  const leftRail = el("aside", {
    class: "ai-studio-left",
    attrs: { "aria-label": "조수와 채팅" },
    dataset: { testid: "ai-studio-left" },
    children: [
      el("section", {
        class: "ai-studio-rail-section is-agents",
        children: [
          el("div", {
            class: "ai-studio-pane-head",
            children: [
              el("h3", { class: "ai-studio-pane-title", children: ["조수", agentCount] }),
              el("div", {
                class: "ai-studio-pane-actions",
                children: [
                  el("button", {
                    class: "ai-studio-icon-btn",
                    attrs: { type: "button", title: "새 레인", "aria-label": "새 레인 만들기" },
                    dataset: { testid: "ai-studio-new-lane" },
                    children: [renderEditorIcon("plus")],
                    on: { click: () => showTab("newLane", true) },
                  }),
                  agentsLiveDot,
                ],
              }),
            ],
          }),
          agentList,
        ],
      }),
      el("section", {
        class: "ai-studio-rail-section is-threads",
        children: [
          el("div", {
            class: "ai-studio-pane-head",
            children: [el("h3", { class: "ai-studio-pane-title", children: ["채팅"] })],
          }),
          threadList,
        ],
      }),
      scenesPane,
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
  // 닫힌 드로워의 입구 — 덱이 화면 밖으로 나가도 이 손잡이는 맵 위에 남는다.
  const drawerHandle = el("button", {
    class: "ai-studio-drawer-handle",
    attrs: { type: "button", title: "도구 드로워 열기", "aria-label": "도구 드로워", "aria-expanded": "false" },
    dataset: { testid: "ai-studio-deck-handle" },
    children: [el("span", { text: "도구" }), renderEditorIcon("caret")],
    on: {
      click: () => {
        if (deckCollapsed) showTab(deckTab, true);
        else setDeckCollapsed(true);
      },
    },
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
      drawerHandle,
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
  const laneThreadSlot = el("div", {
    class: "ai-studio-lane-thread-slot",
    dataset: { testid: "ai-studio-lane-thread-slot" },
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
  const chatHeadTitle = el("h2", { class: "ai-studio-who-title", text: "감독", dataset: { testid: "ai-studio-thread-title" } });
  const chatPane = el("aside", {
    class: "ai-studio-chat",
    dataset: { testid: "ai-studio-chat" },
    attrs: { "aria-label": "지금 보는 chat" },
    children: [
      el("header", {
        class: "ai-studio-chat-head",
        children: [
          el("span", { class: "ai-studio-status-dot", attrs: { "aria-hidden": "true" } }),
          el("div", {
            class: "ai-studio-who",
            children: [
              chatHeadTitle,
              statusLine,
            ],
          }),
          chatCollapseButton,
        ],
      }),
      el("div", { class: "ai-studio-chat-body", children: [briefing, chatLogSlot, laneThreadSlot] }),
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
        attrs: { type: "button", role: "tab", "aria-selected": "false", "aria-label": tab.label, title: tab.label },
        dataset: { testid: `ai-studio-tab-${tab.id}` },
        children: [renderEditorIcon(tab.icon), el("span", { text: tab.label }), badge],
        on: { click: () => showTab(tab.id, true) },
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
    class: "ai-studio-deck is-drawer",
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
    class: "ai-studio-shell is-deck-overlay",
    attrs: { "aria-label": "AI 스튜디오" },
    dataset: { testid: "ai-studio-shell" },
    children: [leftRail, monitorPane, chatPane, deckPaneRoot],
  });

  // ── 스플리터(리사이즈) ────────────────────────────────────────────────────
  // 장면 레일 | 모니터 | 조수 3열 + 하단 덱. 좌·우 열 너비와 덱 높이를 드래그/키보드로
  // 조절한다. 접힘(is-*-collapsed)과는 독립 — 접힌 동안은 손잡이를 숨기고, 펼치면
  // 마지막 사용자 크기로 돌아온다. 크기는 CSS 변수 3개로만 말하고 localStorage에 둔다.
  const clampSize = (key: keyof StudioLayoutSizes, value: number): number => {
    const min = STUDIO_SPLITTER_MIN[key];
    const max = STUDIO_SPLITTER_MAX[key];
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  };

  const applySplitterSize = (key: keyof StudioLayoutSizes, value: number, persist: boolean): void => {
    const px = clampSize(key, value);
    layoutSizes[key] = px;
    root.style.setProperty(
      key === "scenes" ? "--studio-scenes-col" : key === "chat" ? "--studio-chat-col" : "--studio-deck-h",
      `${px}px`,
    );
    if (persist) {
      try {
        localStorage.setItem(STUDIO_LAYOUT_KEY, JSON.stringify(layoutSizes));
      } catch {
        // 저장 실패는 무시 — 다음 드래그에서 다시 쓴다.
      }
    }
  };

  const resetSplitterSize = (key: keyof StudioLayoutSizes): void => {
    applySplitterSize(key, SPLITTER_DEFAULTS[key], true);
    requestCanvasFit();
  };

  const splitterCleanups: Array<() => void> = [];

  const createSplitter = (
    key: keyof StudioLayoutSizes,
    orientation: "vertical" | "horizontal",
    testId: string,
    label: string,
  ): HTMLDivElement => {
    const splitter = el("div", {
      class: `ai-studio-splitter is-${orientation}`,
      attrs: {
        role: "separator",
        tabindex: "0",
        "aria-label": label,
        "aria-orientation": orientation,
        title: `${label} — 드래그하거나 ←→↑↓ 키로 조절, 더블클릭이면 되돌리기`,
      },
      dataset: { testid: testId },
    }) as HTMLDivElement;
    const STEP = 16;
    const onKeyDown = (event: KeyboardEvent): void => {
      const horizontal = orientation === "vertical";
      const dec = horizontal ? ["ArrowLeft", "ArrowUp"] : ["ArrowUp", "ArrowLeft"];
      const inc = horizontal ? ["ArrowRight", "ArrowDown"] : ["ArrowDown", "ArrowRight"];
      if (dec.includes(event.key)) {
        event.preventDefault();
        applySplitterSize(key, layoutSizes[key] - (event.shiftKey ? STEP * 4 : STEP), true);
        requestCanvasFit();
      } else if (inc.includes(event.key)) {
        event.preventDefault();
        applySplitterSize(key, layoutSizes[key] + (event.shiftKey ? STEP * 4 : STEP), true);
        requestCanvasFit();
      } else if (event.key === "Home") {
        event.preventDefault();
        applySplitterSize(key, STUDIO_SPLITTER_MIN[key], true);
        requestCanvasFit();
      } else if (event.key === "End") {
        event.preventDefault();
        applySplitterSize(key, STUDIO_SPLITTER_MAX[key], true);
        requestCanvasFit();
      }
    };
    const onDblClick = (): void => resetSplitterSize(key);
    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startPos = orientation === "vertical" ? event.clientX : event.clientY;
      const startSize = layoutSizes[key];
      // 덱 스플리터는 위로 당길수록 높아진다(부호 반전), 좌·우 열은 오른쪽/왼쪽으로 당길수록 넓어진다.
      const sign = key === "deck" ? -1 : key === "chat" ? -1 : 1;
      const move = (moveEvent: PointerEvent): void => {
        const pos = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
        applySplitterSize(key, startSize + sign * (pos - startPos), false);
      };
      const up = (): void => {
        document.removeEventListener("pointermove", move as EventListener);
        document.removeEventListener("pointerup", up as EventListener);
        document.removeEventListener("pointercancel", up as EventListener);
        try {
          localStorage.setItem(STUDIO_LAYOUT_KEY, JSON.stringify(layoutSizes));
        } catch {
          // 저장 실패는 무시.
        }
        requestCanvasFit();
      };
      document.addEventListener("pointermove", move as EventListener);
      document.addEventListener("pointerup", up as EventListener);
      document.addEventListener("pointercancel", up as EventListener);
    };
    splitter.addEventListener("keydown", onKeyDown as EventListener);
    splitter.addEventListener("dblclick", onDblClick);
    splitter.addEventListener("pointerdown", onPointerDown as EventListener);
    splitterCleanups.push(() => {
      splitter.removeEventListener("keydown", onKeyDown as EventListener);
      splitter.removeEventListener("dblclick", onDblClick);
      splitter.removeEventListener("pointerdown", onPointerDown as EventListener);
    });
    return splitter;
  };

  const scenesSplitter = createSplitter("scenes", "vertical", "ai-studio-split-scenes", "장면 레일 너비");
  const chatSplitter = createSplitter("chat", "vertical", "ai-studio-split-chat", "조수 너비");
  splitterCleanup = (): void => {
    for (const fn of splitterCleanups.splice(0)) fn();
  };
  // 그리드 자식으로 끼워 넣는다 — 순서가 열 배치(좌 레일 | 손잡이 | 모니터 | 손잡이 | 채팅 | 덱)다.
  // 덱 손잡이는 덱 섹션 첫 자식으로 넣어 머리띠 바로 위에만 앉힌다(탭 클릭 가로채기 방지).
  // FakeDom(test/fakeDom.ts)에는 insertBefore가 없어 children 한 번에 박는다.
  root.replaceChildren(leftRail, scenesSplitter, monitorPane, chatSplitter, chatPane, deckPaneRoot);
  for (const key of ["scenes", "chat", "deck"] as const) applySplitterSize(key, layoutSizes[key], false);

  // 좁은 화면에서는 좌·우 열을 깎아 가운데 맵을 지킨다 — 저장값(사용자가 드래그한 폭)은 건드리지 않고
  // CSS 변수만 조인다. 36px = 손잡이 2×8 + 셸 좌우 여백 2×10. (실측 2026-09-16: 1024 에서 그냥 두면 맵이 330px 였다.)
  const STUDIO_CHROME_WIDTH = 36;
  const MIN_MAP_WIDTH = 360;
  const setColumnVar = (key: "scenes" | "chat", px: number): void => {
    root.style.setProperty(key === "scenes" ? "--studio-scenes-w" : "--studio-chat-w", px + "px");
  };
  let lastResponsive: string | null = null;
  const COLLAPSED_COLUMN_WIDTH = 52;
  const applyResponsiveWidths = (): void => {
    if (typeof window === "undefined") return;
    const viewport = window.innerWidth;
    if (!Number.isFinite(viewport) || viewport <= 0) return;
    let scenes = scenesCollapsed ? COLLAPSED_COLUMN_WIDTH : layoutSizes.scenes;
    let chat = chatCollapsed ? COLLAPSED_COLUMN_WIDTH : layoutSizes.chat;
    let deficit = scenes + chat + STUDIO_CHROME_WIDTH + MIN_MAP_WIDTH - viewport;
    // 오른쪽(지금 보는 채팅)부터 깎고, 그래도 모자라면 왼쪽도 깎는다. 접힌 열은 깎을 것이 없다.
    if (deficit > 0 && !chatCollapsed) { const next = Math.max(STUDIO_SPLITTER_MIN.chat, chat - deficit); deficit -= chat - next; chat = next; }
    if (deficit > 0 && !scenesCollapsed) { scenes = Math.max(STUDIO_SPLITTER_MIN.scenes, scenes - deficit); }
    const signature = [scenesCollapsed, chatCollapsed, scenes, chat].join("|");
    // requestCanvasFit 이 «다시 맞추기» 로 resize 를 다시 쏘므로, 값이 그대로면 여기서 멈춘다(무한 왕복 방지).
    if (signature === lastResponsive) return;
    lastResponsive = signature;
    // 접힘 폭(52px)은 CSS 클래스가 소유한다 — 인라인 변수를 지워야 그 규칙이 산다.
    if (scenesCollapsed) root.style.removeProperty("--studio-scenes-w");
    else setColumnVar("scenes", scenes);
    if (chatCollapsed) root.style.removeProperty("--studio-chat-w");
    else setColumnVar("chat", chat);
    requestCanvasFit();
  };
  applyResponsiveWidths();
  if (typeof window !== "undefined") window.addEventListener("resize", applyResponsiveWidths);
  // 드로워가 열려 있을 때 Esc 로 닫는다 — 맵 위를 가리는 표면이므로 탈출구가 필요하다.
  const onDrawerKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || event.isComposing || event.defaultPrevented || deckCollapsed || !attachedTo) return;
    event.preventDefault();
    setDeckCollapsed(true);
  };
  if (typeof document !== "undefined") document.addEventListener("keydown", onDrawerKeydown);

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

  const showTab = (tab: StudioDeckTab, open = false): void => {
    deckTab = tab;
    for (const [id, button] of tabButtons) {
      const on = id === tab;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", String(on));
    }
    toolFilterWrap.classList.toggle("is-hidden", tab !== "tools");
    renderDeck();
    // 사용자가 탭을 골랐거나 작업·변경이 새로 뜬 것이면 드로워를 연다. 부팅 직후의 초기화는 열지 않는다.
    if (open) setDeckCollapsed(false);
  };

  let drawerOpener: HTMLElement | null = null;
  const setDeckCollapsed = (next: boolean): void => {
    const changed = deckCollapsed !== next;
    if (changed && !next) drawerOpener = document.activeElement as HTMLElement | null;
    deckCollapsed = next;
    deckPaneRoot.inert = next;
    deckPaneRoot.setAttribute("aria-hidden", String(next));
    root.classList.toggle("is-deck-collapsed", next);
    deckPaneRoot.classList.toggle("is-collapsed", next);
    drawerHandle.setAttribute("aria-expanded", String(!next));
    drawerHandle.setAttribute("title", next ? "도구 드로워 열기" : "도구 드로워 닫기");
    collapseButton.setAttribute("aria-expanded", String(!next));
    collapseButton.setAttribute("aria-label", "도구 드로워 닫기");
    collapseButton.setAttribute("title", "도구 드로워 닫기");
    if (changed && next) (drawerOpener?.isConnected ? drawerOpener : drawerHandle).focus();
    else if (changed) tabButtons.get(deckTab)?.focus();
  };

  const setScenesCollapsed = (next: boolean): void => {
    scenesCollapsed = next;
    root.classList.toggle("is-scenes-collapsed", next);
    scenesCollapseButton.setAttribute("aria-expanded", String(!next));
    scenesCollapseButton.setAttribute("aria-label", next ? "장면 목록 펼치기" : "장면 목록 접기");
    scenesCollapseButton.setAttribute("title", next ? "장면 목록 펼치기" : "장면 목록 접기");
    scenesCollapseButton.replaceChildren(renderEditorIcon(next ? "arrowRight" : "arrowLeft"));
    applyResponsiveWidths();
    requestCanvasFit();
  };

  const setChatCollapsed = (next: boolean): void => {
    chatCollapsed = next;
    root.classList.toggle("is-chat-collapsed", next);
    chatCollapseButton.setAttribute("aria-expanded", String(!next));
    chatCollapseButton.setAttribute("aria-label", next ? "조수 펼치기" : "조수 접기");
    chatCollapseButton.setAttribute("title", next ? "조수 펼치기" : "조수 접기");
    chatCollapseButton.replaceChildren(renderEditorIcon(next ? "arrowLeft" : "arrowRight"));
    applyResponsiveWidths();
    requestCanvasFit();
  };

  // 보존 기획 판은 자기 상태(입력 중인 초안)를 들고 있으므로 한 번 만들어 재사용한다 — 매 툴콜마다
  // 다시 그리면 사용자가 타이핑 중인 한 줄이 사라진다.
  let planningView: PlanningListView | null = null;
  const refreshPlanningBadge = (): void => {
    const count = listMapPlanningItems(currentPlanningMapId()).filter((item) => item.status === "active").length;
    setBadge("planning", count > 0 ? String(count) : null);
  };
  const ensurePlanningView = (): PlanningListView => {
    planningView ??= createPlanningListView({ onChanged: () => refreshPlanningBadge() });
    return planningView;
  };

  // 실행 보드(teamActivity 버스) — 조수 데크의 「작업」 탭과 같은 상태, 스튜디오는 상세(detail)로 그린다.
  let teamBoard: TeamBoardState | null = null;
  const teamWork = createTeamWorkPane({ detail: true });

  // ── 에이전트 레인 ─────────────────────────────────────────────────────────
  // 실행·중단·적용은 매니저가 소유한다. 셸은 «고른 레인·폼 값·안내문» 만 들고 그린다.
  // 레인은 화면보다 오래 산다 — 셸이 다시 만들어져도 세션 매니저가 들고 있다(aiLaneSession.ts).
  const laneManager = options.laneManager ?? laneSession();
  const unsubscribeLanes = laneManager.subscribe(() => onLanesChanged());
  const laneDefaults = laneManager.defaults();
  let laneForm: LaneFormState = {
    mapIds: [editorState.get().currentMapId ?? store.getCurrent().startMapId].filter((id): id is string => Boolean(id)),
    agentLabel: "시공A",
    provider: laneDefaults.provider,
    model: laneDefaults.model,
    instruction: "",
    maxTurns: 12,
  };
  let laneNotice: string | null = null;
  let laneSignature = "";
  let laneSeq = 0;

  /** 입력 중인 필드를 다시 그리면 타이핑이 사라진다 — 기획 판과 같은 이유로 포커스 동안은 건너뛴다. */
  const lanesTyping = (): boolean => {
    if (typeof document === "undefined") return false;
    const active = document.activeElement;
    if (!active || !deckPane.contains(active)) return false;
    return active.tagName === "INPUT" || active.tagName === "TEXTAREA";
  };

  /** 레인 하나가 바뀔 때마다 장면 목록을 다시 짓지 않는다 — 상태 구성이 바뀔 때만 칩을 갱신한다. */
  const onLanesChanged = (): void => {
    const lanes = laneManager.lanes();
    const review = lanes.filter((lane) => lane.status === "review").length;
    setBadge("newLane", review > 0 ? String(review) : null);
    const signature = lanes.map((lane) => `${lane.spec.id}:${lane.status}`).join("|");
    if (signature !== laneSignature) {
      laneSignature = signature;
      refreshScenes();
    }
    renderLeftRail();
    syncThreadView();
    if (deckTab === "newLane" && !lanesTyping()) renderDeck();
  };

  const studioThreads = (): readonly StudioThread[] => [
    { id: "director", label: "감독", kind: "director", detail: "전체 지시·질문·배정" },
    ...laneManager.lanes().map((lane) => ({
      id: lane.spec.id,
      label: lane.spec.label,
      kind: "lane" as const,
      status: lane.status,
      detail: lane.spec.agentLabel,
    })),
  ];

  const renderLeftRail = (): void => {
    const lanes = laneManager.lanes();
    const teamAgents = teamBoard?.agents ?? [];
    const running = lanes.filter((lane) => lane.status === "running").length
      + teamAgents.filter((agent) => agent.state === "실행 중").length;
    const review = lanes.filter((lane) => lane.status === "review").length;
    agentCount.textContent = String(lanes.length + teamAgents.length);
    agentsLiveDot.dataset.state = running > 0 ? "busy" : review > 0 ? "attention" : "idle";
    const blocks: HTMLElement[] = [];
    if (lanes.length > 0) {
      blocks.push(renderAgentLiveList({
        lanes,
        project: store.getCurrent(),
        now: Date.now(),
        selectedThreadId,
        notice: laneNotice,
        onSelectThread: (id) => selectThread(id),
        onStop: (id) => laneManager.stop(id),
        onApply: (id) => void applyLane(id),
        onDiscard: (id) => laneManager.discard(id),
      }));
    }
    // 팀 실행(/pi team)의 팀장·팀원도 같은 절에 산다 — 여기서 안 보이면 「왼쪽에서 실시간」 이 반쪽이 된다.
    const teamBlock = renderTeamLiveRows({ agents: teamAgents, onOpenBoard: () => showTab("work", true) });
    if (teamBlock) blocks.push(teamBlock);
    if (blocks.length === 0) {
      blocks.push(renderAgentLiveList({
        lanes: [], project: store.getCurrent(), now: Date.now(), selectedThreadId,
        notice: laneNotice, onSelectThread: (id) => selectThread(id),
        onStop: () => undefined, onApply: () => undefined, onDiscard: () => undefined,
      }));
    }
    agentList.replaceChildren(...blocks);
    threadList.replaceChildren(renderThreadList({
      threads: studioThreads(),
      selectedId: selectedThreadId,
      onSelect: (id) => selectThread(id),
    }));
  };

  const selectThread = (id: string): void => {
    selectedThreadId = id;
    renderLeftRail();
    syncThreadView();
    if (deckTab === "newLane") renderDeck();
  };

  /** 오른쪽 열 = 지금 보고 있는 채팅. 감독이면 기존 로그·포저, 레인이면 그 레인 스레드. */
  const syncThreadView = (): void => {
    const lane = selectedThreadId === "director" ? null : laneManager.get(selectedThreadId);
    chatPane.classList.toggle("is-lane-thread", lane !== null);
    chatHeadTitle.textContent = lane ? `${lane.spec.label} · ${lane.spec.agentLabel}` : "감독";
    if (!lane) {
      laneThreadSlot.replaceChildren();
      return;
    }
    laneThreadSlot.replaceChildren(renderLaneThread({
      lane,
      project: store.getCurrent(),
      now: Date.now(),
      notice: laneNotice,
      onStart: (id) => void startLane(id),
      onStop: (id) => laneManager.stop(id),
      onRetry: (id) => void startLane(id),
      onApply: (id) => void applyLane(id),
      onDiscard: (id) => laneManager.discard(id),
      onFollowUp: (id, text) => void followUpLane(id, text),
    }));
  };

  const laneLabel = (mapIds: readonly string[]): string => {
    const project = store.getCurrent();
    return mapIds.map((id) => project.maps[id]?.name ?? id).join(" + ") || "레인";
  };

  const laneChipFor = (mapId: string): HTMLElement | null => {
    const lane = laneManager.lanes().find((state) => state.spec.mapIds.includes(mapId) && state.status !== "discarded");
    if (!lane) return null;
    return el("span", {
      class: `ai-studio-lane-chip ${laneStatusClass(lane.status)}`,
      text: `${lane.spec.agentLabel} · ${LANE_STATUS_LABEL[lane.status]}`,
      dataset: { testid: "ai-studio-lane-chip", laneId: lane.spec.id, status: lane.status },
    });
  };

  const startLane = async (id: string): Promise<void> => {
    const outcome = await laneManager.start(id);
    laneNotice = outcome.ok ? null : outcome.issue ?? "시작하지 못했습니다";
    renderDeck();
    renderLeftRail();
    syncThreadView();
  };

  const applyLane = async (id: string): Promise<void> => {
    laneNotice = "적용 중…";
    renderDeck();
    renderLeftRail();
    const outcome = await laneManager.apply(id);
    laneNotice = outcome.ok
      ? `적용했습니다 — 바뀐 키 ${outcome.changedKeys.length}개${outcome.spills.length > 0 ? `, 묶음 밖 ${outcome.spills.length}건 버림` : ""}`
      : outcome.issue;
    renderDeck();
    renderLeftRail();
    syncThreadView();
  };

  const createLaneFromForm = (): void => {
    const instruction = laneForm.instruction.trim();
    if (laneForm.mapIds.length === 0) { laneNotice = "묶음을 하나 이상 고르세요"; renderDeck(); return; }
    if (instruction.length === 0) { laneNotice = "지시를 한 줄 적으세요"; renderDeck(); return; }
    laneSeq += 1;
    const id = `lane_${laneSeq}_${Math.random().toString(36).slice(2, 7)}`;
    laneManager.add({
      id,
      label: laneLabel(laneForm.mapIds),
      mapIds: [...laneForm.mapIds],
      agentLabel: laneForm.agentLabel.trim() || "에이전트",
      provider: laneForm.provider,
      model: laneForm.model,
      instruction,
      maxTurns: laneForm.maxTurns,
    });
    selectedThreadId = id;
    laneForm = { ...laneForm, instruction: "" };
    laneNotice = null;
    setDeckCollapsed(true);
    selectThread(id);
    void startLane(id);
  };

  const followUpLane = async (id: string, text: string): Promise<void> => {
    const lane = laneManager.get(id);
    if (!lane) return;
    // Pi 실행은 무상태다 — 후속 지시는 앞선 지시·보고를 문자열로 다시 실어 새 실행으로 보낸다.
    const report = lane.steps.filter((step) => step.kind === "assistant").slice(-1)[0]?.text ?? "";
    const instruction = [
      `원래 지시: ${lane.spec.instruction}`,
      report ? `이전 보고: ${report}` : "",
      `추가 지시: ${text}`,
    ].filter(Boolean).join("\n");
    const outcome = await laneManager.start(id, { instruction });
    laneNotice = outcome.ok ? null : outcome.issue ?? "시작하지 못했습니다";
    renderDeck();
  };


  const renderDeck = (): void => {
    if (deckTab === "newLane") {
      deckPane.replaceChildren(renderNewLanePane({
        form: laneForm,
        project: store.getCurrent(),
        currentMapId: editorState.get().currentMapId ?? null,
        notice: laneNotice,
        onFormChange: (patch) => {
          laneForm = { ...laneForm, ...patch };
          if (patch.provider !== undefined || patch.mapIds !== undefined) renderDeck();
        },
        onCreate: createLaneFromForm,
      }));
      return;
    }
    if (deckTab === "tools") {
      deckPane.replaceChildren(renderToolsPane(toolQuery, options.onUseTool));
      return;
    }
    if (deckTab === "work") {
      if (teamBoard) {
        teamWork.update(teamBoard);
        // 자율 실행 체크리스트가 함께 있으면 좌: 계획, 우: 실행 보드.
        if (workPlan) deckPane.replaceChildren(el("div", { class: "ai-studio-work-split", children: [renderWorkPane(workPlan, workActive), teamWork.root] }));
        else deckPane.replaceChildren(teamWork.root);
      } else {
        deckPane.replaceChildren(renderWorkPane(workPlan, workActive));
      }
      return;
    }
    if (deckTab === "planning") {
      const view = ensurePlanningView();
      view.refresh();
      deckPane.replaceChildren(view.root);
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
    walkScenes(project.mapTree, null, 0, project, currentId, query, rows, expandedScenes, laneChipFor, (mapId) => {
      if (expandedScenes.has(mapId)) expandedScenes.delete(mapId);
      else expandedScenes.add(mapId);
      refreshScenes();
    });
    sceneCount.textContent = String(Object.keys(project.maps).length);
    // 기획 항목은 맵별이다 — 장면을 바꿔으면 막 상자와 리스트를 그 맵 것으로 갈아끈다.
    refreshPlanningBadge();
    if (deckTab === "planning" && planningView) planningView.refresh();
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
    withAssistantViewTransition(mapId, () => { selectEditorMap(mapId); });
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
    briefing.replaceChildren(
      el("p", { class: "ai-studio-kicker", text: "지금 이 장면" }),
      el("h3", { class: "ai-studio-briefing-title", text: brief.mapName }),
      el("p", { class: "ai-studio-briefing-meta", text: meta.join(" · ") }),
      ...(brief.deficit ? [el("p", { class: "ai-studio-briefing-deficit", text: brief.deficit })] : []),

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
    if (!attachedTo) return;
    if (parked.length > 0) return;
    if (monitorStage.querySelector("[data-testid=edit-canvas]")) return;
    const showingEmpty = monitorStage.querySelector("[data-testid=ai-studio-monitor-empty]");
    // 부팅 때 oprn:ai-studio=1 이면 attach 시점에 캔버스가 아직 document 에 없다.
    // 빈 자리만 두고 끝나지 말고, 캔버스·줌이 생기면 다시 입양한다.
    if (showingEmpty && typeof document !== "undefined") {
      const canvasReady = document.querySelector("[data-testid=edit-canvas]");
      const zoomReady = document.querySelector("[data-testid=editor-zoom-controls]");
      if (canvasReady || zoomReady) {
        adoptLiveMap();
        return;
      }
    }
    if (!showingEmpty) {
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
    // persist-studio 부팅: 캔버스 노드는 이미 있지만 renderEditor 가 layout 을 main 에
    // 붙이기 전이라 document.querySelector 가 못 찾는다. 이 턴이 끝나면 다시 입양한다.
    if (typeof queueMicrotask === "function") queueMicrotask(() => refreshMonitor());
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
    if (teamBoard) {
      const sum = teamBoardTotals(teamBoard);
      setBadge("work", sum.running > 0 ? String(sum.running) : sum.agents > 0 ? String(sum.agents) : "");
      return;
    }
    if (!workPlan) {
      setBadge("work", null);
      return;
    }
    const items = planItems(workPlan);
    const done = items.filter((item) => item.status === "done").length;
    setBadge("work", `${done}/${items.length}`);
  };

  const unsubscribeTeamActivity = subscribeTeamActivity((state) => {
    teamBoard = state;
    teamWork.update(state);
    refreshWorkBadge();
    renderLeftRail();
    // 팀원 활동은 이제 좌 레일에 실시간으로 선다 — 맵을 덮는 드로워를 스스로 열지 않는다(배지만).
    if (deckTab === "work" && !deckCollapsed) renderDeck();
  });

  showTab("newLane");
  setDeckCollapsed(true);
  renderLeftRail();
  syncThreadView();

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
      const appeared = plan != null && workPlan == null;
      workPlan = plan;
      workActive = active;
      refreshWorkBadge();
      // 계획이 새로 떠도 드로워를 스스로 열지 않는다(배지로 알린다) — 좌 레일과 같은 규칙.
      if (appeared || deckTab === "work") renderDeck();
    },
    setChangePreview(input) {
      const appeared = input != null && changePreview == null;
      changePreview = input;
      setBadge("changes", input ? "" : null);
      // 변경이 새로 떠도 드로워를 스스로 열지 않는다(배지로 알린다) — 좌 레일·계획과 같은 규칙.
      if (appeared || deckTab === "changes") renderDeck();
    },
    setToolLines(lines) {
      toolLines = lines.slice(0, ACTIVITY_LIMIT);
      setBadge("activity", toolLines.length > 0 ? String(toolLines.length) : null);
      if (deckTab === "activity") renderDeck();
    },
    setDeckTab: (tab) => showTab(tab, true),
    dispose() {
      detach();
      unsubscribeTeamActivity();
      unsubscribeLanes();
      if (typeof document !== "undefined") document.removeEventListener("keydown", onDrawerKeydown);
      splitterCleanup?.();
      splitterCleanup = null;
      if (typeof window !== "undefined") window.removeEventListener("resize", applyResponsiveWidths);
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
  laneChip: (mapId: MapId) => HTMLElement | null,
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
      walkScenes(child, parentMapId, depth, project, currentId, query, rows, expanded, laneChip, onToggleFold);
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
      const laneChipEl = laneChip(node.mapId);
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
            // 장면 목록은 스튜디오에서 가장 자주 눌리는 화면 전환이다 — 하드컷이면
            // 목록을 훑는 동안 캔버스가 계속 확확 갈린다(editor/assistantViewSwitch.ts).
            withAssistantViewTransition(node.mapId, () => { selectEditorMap(node.mapId); });
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
                  ...(laneChipEl ? [laneChipEl] : []),
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
      walkScenes(child, node.mapId, depth, project, currentId, query, rows, expanded, laneChip, onToggleFold);
      continue;
    }
    if (!showMapChildren) continue;
    walkScenes(child, node.mapId, depth + 1, project, currentId, query, rows, expanded, laneChip, onToggleFold);
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
