// AI 스튜디오 셸 — 「장면 콘솔」. 살아 있는 맵 에디터를 모니터에 들이고, 아래 덱에 **레인 보드**를 깐다.
//
//   장면 레일(썸네일·검색·새 장면) | 모니터(머리띠 + 실제 Phaser 캔버스) | 지금 보는 채팅(감독 또는 레인 스레드)
//                                 | 덱 = 레인 보드(레인 · 변경 · 활동) — 그리드 행, 접으면 한 줄
//
// 썸네일 그림이 아니다. 모니터는 edit-canvas 를 재부모화해서 줌·팬·클릭이 그대로 된다.
// 설계: docs/superpowers/specs/2026-09-03-ai-studio-console-design.md,
//       docs/superpowers/specs/2026-09-15-studio-agent-lanes-design.md §11 (2026-09-17 하단 레인 보드 확정)

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
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import type { ToolDefinition } from "@/editor/tools/types";
import { subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import { LANE_STATUS_LABEL, type LaneState } from "@/ai/piAgent/lane";
import type { LaneManager } from "./aiLaneManager";
import { laneSession } from "./aiLaneSession";
import {
  laneAvatarLetter,
  laneBoardSummary,
  laneStatusClass,
  renderLaneBoard,
  renderLaneBoardEmpty,
  renderLaneThread,
  renderNewLanePane,
  type LaneFormState,
} from "./aiLaneBoard";
import type { TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { createTeamWorkPane } from "./aiTeamWorkPane";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";

export type StudioDeckTab = "lanes" | "changes" | "activity";

export interface StudioShellPieces {
  readonly historyLogMount: HTMLElement;
  readonly commandBar: HTMLElement;
}

export interface StudioShellOptions {
  readonly onExit: () => void;
  readonly onFontZoom: (delta: number) => void;
  /** 「모든 도구」 모달에서 고른 도구 — 입력줄을 채우는 쪽이 받는다. */
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
  /** 보드 행을 고른 것과 같다 — 오른쪽 열이 그 레인 스레드가 된다. 스튜디오 밖 요약 줄이 부른다. */
  selectLane(id: string): void;
  /** 「기획」 팝오버를 연다(덱 탭에서 나갔다). */
  openPlanning(): void;
  /** 작업 중·결과 대기 레인이 있으면 확인창을 띄우고, 없으면 바로 onExit. */
  requestExit(): void;
  dispose(): void;
}

const WORK_STATUS_LABEL: Record<WorkItem["status"], string> = {
  pending: "대기",
  in_progress: "진행 중",
  done: "완료",
  skipped: "건너뜀",
  blocked: "막힘",
};

// 덱 탭은 셋(§11 결정 3). 도구는 「모든 도구」 모달, 새 레인·기획은 팝오버로 나갔다.
const DECK_TABS: readonly { readonly id: StudioDeckTab; readonly label: string; readonly icon: EditorIconName }[] = [
  { id: "lanes", label: "레인", icon: "lines" },
  { id: "changes", label: "변경", icon: "image" },
  { id: "activity", label: "활동", icon: "clock" },
];

const STUDIO_LAYOUT_KEY = "oprn:ai-studio-layout";
// 덱 높이는 CSS 가 소유한다(1440 → 284px, 1280 → 268px). 사용자가 끌어 바꾸는 것은 좌·우 열만.
const STUDIO_SPLITTER_MIN = { scenes: 180, chat: 280 } as const;
const STUDIO_SPLITTER_MAX = { scenes: 480, chat: 640 } as const;

interface StudioLayoutSizes {
  scenes: number;
  chat: number;
}

function readStudioLayout(): Partial<StudioLayoutSizes> {
  try {
    const raw = localStorage.getItem(STUDIO_LAYOUT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StudioLayoutSizes>;
    const out: Partial<StudioLayoutSizes> = {};
    for (const key of ["scenes", "chat"] as const) {
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
  let deckTab: StudioDeckTab = "lanes";
  // 2026-09-17(§11): 덱은 그리드 행으로 돌아왔다 — 기본은 펼침. ⌄ 로 접으면 머리 한 줄만 남는다.
  let deckCollapsed = false;
  let workPlan: WorkPlan | null = null;
  let workActive = false;
  let changePreview: ChangePreviewInput | null = null;
  let toolLines: readonly string[] = [];
  let sceneQuery = "";
  let scenesCollapsed = false;
  let chatCollapsed = false;
  const expandedScenes = new Set<string>();
  let parked: ParkedNode[] = [];
  let fitObserver: ResizeObserver | null = null;
  let logObserver: MutationObserver | null = null;
  let splitterCleanup: (() => void) | null = null;
  const SPLITTER_DEFAULTS: StudioLayoutSizes = { scenes: 252, chat: 400 };
  const savedLayout = readStudioLayout();
  const layoutSizes: StudioLayoutSizes = {
    scenes: savedLayout.scenes ?? SPLITTER_DEFAULTS.scenes,
    chat: savedLayout.chat ?? SPLITTER_DEFAULTS.chat,
  };
  const clampInit = (key: keyof StudioLayoutSizes, value: number): number => {
    const min = STUDIO_SPLITTER_MIN[key];
    const max = STUDIO_SPLITTER_MAX[key];
    if (!Number.isFinite(value)) return SPLITTER_DEFAULTS[key];
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  layoutSizes.scenes = clampInit("scenes", layoutSizes.scenes);
  layoutSizes.chat = clampInit("chat", layoutSizes.chat);

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

  // 좌 레일은 장면 트리뿐이다(§11 결정 1·구현 순서 2). 레인은 하단 보드가, 장면 행에는 레인 칩만 남는다.
  let selectedThreadId = "director";

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
    on: { click: () => requestExit() },
  });
  // 다른 장면에서 도는 레인 — 모니터 모서리의 라이브 썸네일(§11 결정 6). 지금 장면의 레인은 캔버스 고스트가 맡는다.
  const monitorLanes = el("div", {
    class: "ai-studio-monitor-lanes",
    dataset: { testid: "ai-studio-monitor-lanes" },
    attrs: { "aria-label": "다른 장면의 레인" },
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
      monitorLanes,
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
  // 자율 실행 체크리스트(setWorkPlan)는 「작업」 탭이 나가면서 감독 스레드 위로 왔다.
  const workSlot = el("div", { class: "ai-studio-work-slot", dataset: { testid: "ai-studio-work-slot" }, attrs: { hidden: "" } });
  // 팀 실행 보드(트랜스크립트) — 보드의 팀 행을 누르면 오른쫽 열이 이것이 된다.
  const teamSlot = el("div", { class: "ai-studio-team-slot", dataset: { testid: "ai-studio-team-slot" } });
  const backToDirector = el("button", {
    class: "ai-studio-ghost-btn ai-studio-back-director",
    text: "← 감독",
    attrs: { type: "button", title: "감독 스레드로 돌아가기", hidden: "" },
    dataset: { testid: "ai-studio-back-director" },
    on: { click: () => selectThread("director") },
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
          backToDirector,
          chatCollapseButton,
        ],
      }),
      el("div", { class: "ai-studio-chat-body", children: [briefing, workSlot, chatLogSlot, laneThreadSlot, teamSlot] }),
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
  // 머리띠 캡션 — 「작업 중 2 · 결과 대기 1 · 대기 1」. 접혀도 이 한 줄은 남는다.
  const deckCaption = el("span", {
    class: "ai-studio-deck-caption",
    dataset: { testid: "ai-studio-deck-caption" },
    attrs: { "aria-live": "polite" },
  });
  const allToolsButton = el("button", {
    class: "ai-studio-ghost-btn",
    text: "모든 도구",
    attrs: { type: "button", title: "툴 브라우저에서 전체 도구를 봅니다 (Ctrl K)" },
    dataset: { testid: "ai-studio-tools-all" },
    on: { click: () => void openToolBrowserModal() },
  });
  // 「팀장에게 맡기기」 — 감독 스레드의 입력줄로 보낸다. 감독이 에이전트를 배정하고 레인이 보드에 쌓인다.
  const delegateButton = el("button", {
    class: "ai-studio-ghost-btn",
    text: "팀장에게 맡기기",
    attrs: { type: "button", title: "감독에게 한 문장으로 지시하면 에이전트를 배정합니다" },
    dataset: { testid: "ai-studio-delegate" },
    on: {
      click: () => {
        selectThread("director");
        const input = composerSlot.querySelector<HTMLElement>("[data-testid=ai-input]");
        input?.focus();
      },
    },
  });
  const newLaneButton = el("button", {
    class: "ai-studio-ghost-btn is-accent",
    attrs: { type: "button", title: "새 레인 — 묶음·에이전트·지시를 정해 하나 세웁니다", "aria-expanded": "false", "aria-haspopup": "dialog" },
    dataset: { testid: "ai-studio-new-lane" },
    children: [renderEditorIcon("plus"), el("span", { text: "새 레인" })],
    on: { click: () => togglePopover("newLane") },
  });
  const planningBadge = el("span", { class: "ai-studio-tab-badge", attrs: { hidden: "" } });
  const planningButton = el("button", {
    class: "ai-studio-ghost-btn",
    attrs: { type: "button", title: "이 장면의 보존 기획 항목", "aria-expanded": "false", "aria-haspopup": "dialog" },
    dataset: { testid: "ai-studio-planning" },
    children: [el("span", { text: "기획" }), planningBadge],
    on: { click: () => togglePopover("planning") },
  });
  const collapseButton = el("button", {
    class: "ai-studio-icon-btn ai-studio-deck-collapse",
    attrs: { type: "button", title: "레인 보드 접기", "aria-label": "레인 보드 접기", "aria-expanded": "true" },
    dataset: { testid: "ai-studio-deck-collapse" },
    children: [renderEditorIcon("caret")],
    on: { click: () => setDeckCollapsed(!deckCollapsed) },
  });
  // 팝오버 둘(새 레인·기획)은 덱 머리띠 위로 뜬다 — 탭이 아니라 잠깐 열고 닫는 표면이다.
  const popover = el("div", {
    class: "ai-studio-popover",
    dataset: { testid: "ai-studio-popover" },
    attrs: { role: "dialog", hidden: "", "aria-label": "새 레인" },
  });
  let popoverKind: "newLane" | "planning" | null = null;
  const deckPaneRoot = el("section", {
    class: "ai-studio-deck",
    dataset: { testid: "ai-studio-deck" },
    attrs: { "aria-label": "레인 보드" },
    children: [
      el("div", {
        class: "ai-studio-deck-head",
        children: [
          el("div", { class: "ai-studio-deck-lead", children: [tabs, deckCaption] }),
          el("div", { class: "ai-studio-deck-actions", children: [delegateButton, newLaneButton, planningButton, allToolsButton, collapseButton] }),
        ],
      }),
      deckPane,
      popover,
    ],
  });

  const root = el("div", {
    class: "ai-studio-shell",
    attrs: { "aria-label": "AI 스튜디오" },
    dataset: { testid: "ai-studio-shell" },
    children: [scenesPane, monitorPane, chatPane, deckPaneRoot],
  });

  // ── 스플리터(리사이즈) ────────────────────────────────────────────────────
  // 장면 레일 | 모니터 | 조수 3열 + 하단 덱(높이는 CSS). 좌·우 열 너비를 드래그/키보드로
  // 조절한다. 접힘(is-*-collapsed)과는 독립 — 접힌 동안은 손잡이를 숨기고, 펼치면
  // 마지막 사용자 크기로 돌아온다. 크기는 CSS 변수 2개로만 말하고 localStorage에 둔다.
  const clampSize = (key: keyof StudioLayoutSizes, value: number): number => {
    const min = STUDIO_SPLITTER_MIN[key];
    const max = STUDIO_SPLITTER_MAX[key];
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  };

  const applySplitterSize = (key: keyof StudioLayoutSizes, value: number, persist: boolean): void => {
    const px = clampSize(key, value);
    layoutSizes[key] = px;
    root.style.setProperty(key === "scenes" ? "--studio-scenes-col" : "--studio-chat-col", `${px}px`);
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
      // 좌 열은 오른쫽으로, 우 열은 왼쪽으로 당길수록 넓어진다(부호 반전).
      const sign = key === "chat" ? -1 : 1;
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
  // 그리드 자식으로 끼워 넣는다 — 순서가 열 배치(장면 | 손잡이 | 모니터 | 손잡이 | 채팅 | 덱)다.
  root.replaceChildren(scenesPane, scenesSplitter, monitorPane, chatSplitter, chatPane, deckPaneRoot);
  for (const key of ["scenes", "chat"] as const) applySplitterSize(key, layoutSizes[key], false);

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
  // 팝오버(새 레인·기획)·나가기 확인창은 Esc 로 닫는다 — 맵 위를 가리는 표면이므로 탈출구가 필요하다.
  const onDrawerKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || event.isComposing || event.defaultPrevented || !attachedTo) return;
    if (exitDialog) { event.preventDefault(); closeExitDialog(); return; }
    if (popoverKind !== null) { event.preventDefault(); closePopover(); }
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
    renderDeck();
    // 사용자가 탭을 골랐으면 접힌 덱을 펼친다. 부팅 직후의 초기화는 접힘 상태를 건드리지 않는다.
    if (open && deckCollapsed) setDeckCollapsed(false);
  };

  const setDeckCollapsed = (next: boolean): void => {
    deckCollapsed = next;
    root.classList.toggle("is-deck-collapsed", next);
    deckPaneRoot.classList.toggle("is-collapsed", next);
    collapseButton.setAttribute("aria-expanded", String(!next));
    collapseButton.setAttribute("aria-label", next ? "레인 보드 펼치기" : "레인 보드 접기");
    collapseButton.setAttribute("title", next ? "레인 보드 펼치기" : "레인 보드 접기");
    requestCanvasFit();
  };

  // ── 팝오버(새 레인 · 기획) ────────────────────────────────────────────────
  const closePopover = (): void => {
    if (popoverKind === null) return;
    const opener = popoverKind === "newLane" ? newLaneButton : planningButton;
    popoverKind = null;
    popover.setAttribute("hidden", "");
    popover.replaceChildren();
    newLaneButton.setAttribute("aria-expanded", "false");
    planningButton.setAttribute("aria-expanded", "false");
    opener.focus();
  };
  const renderPopover = (): void => {
    if (popoverKind === "newLane") {
      popover.setAttribute("aria-label", "새 레인");
      popover.replaceChildren(renderNewLanePane({
        form: laneForm,
        project: store.getCurrent(),
        currentMapId: editorState.get().currentMapId ?? null,
        notice: laneNotice,
        onFormChange: (patch) => {
          laneForm = { ...laneForm, ...patch };
          if (patch.provider !== undefined || patch.mapIds !== undefined) renderPopover();
        },
        onCreate: createLaneFromForm,
      }));
      return;
    }
    if (popoverKind === "planning") {
      popover.setAttribute("aria-label", "기획");
      const view = ensurePlanningView();
      view.refresh();
      popover.replaceChildren(view.root);
    }
  };
  /** 「시공A」 → 다음 레인은 「시공B」. 이미 쓴 이름은 건너뛴다. */
  const nextAgentLabel = (): string => {
    const used = new Set(laneManager.lanes().map((lane) => lane.spec.agentLabel));
    for (let index = 0; index < 26; index += 1) {
      const candidate = `시공${String.fromCharCode(65 + index)}`;
      if (!used.has(candidate)) return candidate;
    }
    return "시공";
  };
  const openPopover = (kind: "newLane" | "planning"): void => {
    if (popoverKind !== null && popoverKind !== kind) closePopover();
    if (kind === "newLane") {
      // 묶음 기본값은 «지금 모니터에 있는 장면» — 셸을 만들 때의 맵에 묶어 두면 장면을 바꿔도 따라오지 않는다(실측 2026-09-17).
      const currentMapId = editorState.get().currentMapId ?? store.getCurrent().startMapId;
      laneForm = { ...laneForm, mapIds: currentMapId ? [currentMapId] : [], agentLabel: nextAgentLabel() };
    }
    popoverKind = kind;
    popover.dataset.kind = kind;
    popover.removeAttribute("hidden");
    (kind === "newLane" ? newLaneButton : planningButton).setAttribute("aria-expanded", "true");
    renderPopover();
    // 팝오버는 덱 위에 뜬다 — 덱이 접혀 있어도 폼은 보여야 하므로 접힘은 건드리지 않는다.
    const first = popover.querySelector<HTMLElement>("textarea, input, select, button");
    first?.focus();
  };
  const togglePopover = (kind: "newLane" | "planning"): void => {
    if (popoverKind === kind) closePopover();
    else openPopover(kind);
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
    if (count > 0) { planningBadge.textContent = String(count); planningBadge.removeAttribute("hidden"); }
    else { planningBadge.textContent = ""; planningBadge.setAttribute("hidden", ""); }
  };
  const ensurePlanningView = (): PlanningListView => {
    planningView ??= createPlanningListView({ onChanged: () => refreshPlanningBadge() });
    return planningView;
  };

  // 실행 보드(teamActivity 버스) — 팀장·팀원은 레인 보드에 행으로 서고, 상세(트랜스크립트)는 오른쪽 열의 팀 스레드다.
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

  const teamAgents = () => teamBoard?.agents ?? [];

  /** 머리띠 캡션과 「레인」 배지 — 결과 대기가 있으면 그 수가 배지다(사람이 판단할 것이 있다는 뜻). */
  const refreshLaneCaption = (): void => {
    const summary = laneBoardSummary(laneManager.lanes(), teamAgents());
    deckCaption.textContent = summary.text;
    setBadge("lanes", summary.review > 0 ? String(summary.review) : summary.total > 0 ? String(summary.total) : null);
    deckPaneRoot.classList.toggle("is-empty", summary.total === 0);
    deckPaneRoot.dataset.running = String(summary.running);
    deckPaneRoot.dataset.review = String(summary.review);
  };

  /** 레인 하나가 바뀔 때마다 장면 목록을 다시 짓지 않는다 — 상태 구성이 바뀔 때만 칩을 갱신한다. */
  const onLanesChanged = (): void => {
    const lanes = laneManager.lanes();
    refreshLaneCaption();
    const signature = lanes.map((lane) => `${lane.spec.id}:${lane.status}`).join("|");
    if (signature !== laneSignature) {
      laneSignature = signature;
      refreshScenes();
    }
    renderMonitorLanes();
    syncThreadView();
    if (deckTab === "lanes") renderDeck();
    if (exitDialog) renderExitDialog();
  };

  /** 다른 장면에서 도는 레인의 라이브 썸네일 — 지금 장면의 레인은 캔버스 고스트가 보여 준다. */
  const renderMonitorLanes = (): void => {
    const project = store.getCurrent();
    const currentId = editorState.get().currentMapId ?? project.startMapId;
    const others = laneManager.lanes().filter((lane) =>
      (lane.status === "running" || lane.status === "review") && !lane.spec.mapIds.includes(currentId));
    monitorLanes.hidden = others.length === 0;
    monitorLanes.replaceChildren(...others.map((lane) => {
      const mapId = lane.spec.mapIds[0] ?? currentId;
      return el("button", {
        class: `ai-studio-monitor-lane ${laneStatusClass(lane.status)}`,
        attrs: { type: "button", title: `${lane.spec.agentLabel} · ${lane.spec.label} — 이 장면으로` },
        dataset: { testid: "ai-studio-monitor-lane", laneId: lane.spec.id, status: lane.status },
        on: {
          click: () => {
            withAssistantViewTransition(mapId, () => { selectEditorMap(mapId); });
            selectThread(lane.spec.id);
          },
        },
        children: [
          createMapThumbnail(mapId, { width: 96, height: 60, className: "ai-studio-monitor-lane-thumb", testId: `ai-studio-monitor-lane-thumb-${lane.spec.id}` }),
          el("span", {
            class: "ai-studio-monitor-lane-label",
            children: [
              el("b", { text: `${laneAvatarLetter(lane.spec.agentLabel)} · ${lane.spec.label}` }),
              el("span", { class: `ai-studio-lane-chip ${laneStatusClass(lane.status)}`, text: LANE_STATUS_LABEL[lane.status] }),
            ],
          }),
        ],
      });
    }));
  };

  const selectThread = (id: string): void => {
    selectedThreadId = id;
    syncThreadView();
    if (deckTab === "lanes") renderDeck();
  };

  /** 오른쪽 열 = 지금 보고 있는 채팅. 감독이면 기존 로그·포저, 레인이면 그 레인 스레드, 팀이면 팀 보드. */
  const syncThreadView = (): void => {
    const team = selectedThreadId === "team" && teamBoard !== null;
    const lane = selectedThreadId === "director" || team ? null : laneManager.get(selectedThreadId);
    if (!lane && !team && selectedThreadId !== "director") selectedThreadId = "director";
    chatPane.classList.toggle("is-lane-thread", lane !== null);
    chatPane.classList.toggle("is-team-thread", team);
    chatHeadTitle.textContent = lane ? `${lane.spec.label} · ${lane.spec.agentLabel}` : team ? "팀 보드" : "감독";
    if (lane || team) backToDirector.removeAttribute("hidden"); else backToDirector.setAttribute("hidden", "");
    if (team) {
      laneThreadSlot.replaceChildren();
      teamWork.update(teamBoard);
      teamSlot.replaceChildren(teamWork.root);
      return;
    }
    teamSlot.replaceChildren();
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
    syncThreadView();
  };

  const applyLane = async (id: string): Promise<void> => {
    laneNotice = "적용 중…";
    renderDeck();
    const outcome = await laneManager.apply(id);
    laneNotice = outcome.ok
      ? `적용했습니다 — 바뀐 키 ${outcome.changedKeys.length}개${outcome.spills.length > 0 ? `, 묶음 밖 ${outcome.spills.length}건 버림` : ""}`
      : outcome.issue;
    renderDeck();
    syncThreadView();
  };

  const createLaneFromForm = (): void => {
    const instruction = laneForm.instruction.trim();
    if (laneForm.mapIds.length === 0) { laneNotice = "묶음을 하나 이상 고르세요"; renderPopover(); return; }
    if (instruction.length === 0) { laneNotice = "지시를 한 줄 적으세요"; renderPopover(); return; }
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
    closePopover();
    if (deckCollapsed) setDeckCollapsed(false);
    showTab("lanes");
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
    if (deckTab === "lanes") {
      const lanes = laneManager.lanes();
      const agents = teamAgents();
      if (lanes.length === 0 && agents.length === 0) {
        deckPane.replaceChildren(renderLaneBoardEmpty(laneNotice));
        return;
      }
      deckPane.replaceChildren(renderLaneBoard({
        lanes,
        teamAgents: agents,
        project: store.getCurrent(),
        now: Date.now(),
        selectedThreadId,
        notice: laneNotice,
        onSelectThread: (id) => selectThread(id),
        onStart: (id) => void startLane(id),
        onStop: (id) => laneManager.stop(id),
        onApply: (id) => void applyLane(id),
        onDiscard: (id) => laneManager.discard(id),
        onOpenTeam: () => selectThread("team"),
      }));
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

  // ── 나가기 확인 ───────────────────────────────────────────────────────────
  // 작업 중·결과 대기 레인이 있을 때 스튜디오를 나가면, 레인은 계속 돌지만 적용은 여기서만 된다.
  // 나가기 전에 그 사실과 「결과 먼저 보기」 길을 준다.
  let exitDialog: HTMLElement | null = null;
  const closeExitDialog = (): void => {
    exitDialog?.remove();
    exitDialog = null;
    exitButton.focus();
  };
  const liveLanes = (): readonly LaneState[] => laneManager.lanes().filter((lane) => lane.status === "running" || lane.status === "review");
  const renderExitDialog = (): void => {
    if (!exitDialog) return;
    const lanes = liveLanes();
    if (lanes.length === 0) { closeExitDialog(); return; }
    const project = store.getCurrent();
    const review = lanes.find((lane) => lane.status === "review");
    exitDialog.replaceChildren(
      el("div", {
        class: "ai-studio-exit-card",
        children: [
          el("h3", { class: "ai-studio-exit-title", text: "스튜디오를 나갑니다" }),
          el("p", { class: "ai-studio-exit-text", text: "레인은 계속 돕니다. 나가면 조수 카드의 요약 줄에서 다시 열 수 있고, 적용·버리기는 스튜디오에서 합니다." }),
          el("ul", {
            class: "ai-studio-exit-lanes",
            children: lanes.map((lane) => el("li", {
              dataset: { laneId: lane.spec.id },
              children: [
                el("span", { class: `ai-lane-status ${laneStatusClass(lane.status)}`, text: LANE_STATUS_LABEL[lane.status] }),
                el("b", { text: lane.spec.agentLabel }),
                el("span", {
                  class: "ai-studio-exit-lane-meta",
                  text: lane.status === "review"
                    ? `${lane.spec.mapIds.map((id) => project.maps[id]?.name ?? id).join(" + ")} · 적용 또는 버리기 전`
                    : `${lane.spec.mapIds.map((id) => project.maps[id]?.name ?? id).join(" + ")} · ${lane.progress.turns}${lane.spec.maxTurns ? `/${lane.spec.maxTurns}` : ""}턴`,
                }),
              ],
            })),
          }),
          el("div", {
            class: "ai-studio-exit-actions",
            children: [
              ...(review
                ? [el("button", {
                  class: "ai-lane-btn",
                  text: `${review.spec.agentLabel} 결과 먼저 보기`,
                  attrs: { type: "button" },
                  dataset: { testid: "ai-studio-exit-review" },
                  on: { click: () => { closeExitDialog(); if (deckCollapsed) setDeckCollapsed(false); showTab("lanes"); selectThread(review.spec.id); } },
                })]
                : []),
              el("button", { class: "ai-lane-btn", text: "취소", attrs: { type: "button" }, dataset: { testid: "ai-studio-exit-cancel" }, on: { click: () => closeExitDialog() } }),
              el("button", { class: "ai-lane-btn is-primary", text: "나가기", attrs: { type: "button" }, dataset: { testid: "ai-studio-exit-confirm" }, on: { click: () => { closeExitDialog(); options.onExit(); } } }),
            ],
          }),
        ],
      }),
    );
  };
  const requestExit = (): void => {
    if (liveLanes().length === 0) { options.onExit(); return; }
    if (!exitDialog) {
      exitDialog = el("div", {
        class: "ai-studio-exit-dialog",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "스튜디오 나가기" },
        dataset: { testid: "ai-studio-exit-dialog" },
        on: { click: ((event: MouseEvent) => { if (event.target === exitDialog) closeExitDialog(); }) as EventListener },
      });
      root.append(exitDialog);
    }
    renderExitDialog();
    exitDialog?.querySelector<HTMLElement>("[data-testid=ai-studio-exit-cancel]")?.focus();
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
    // 기획 항목은 맵별이다 — 장면을 바꿨으면 배지와 팝오버 리스트를 그 맵 것으로 갈아 끼운다.
    refreshPlanningBadge();
    if (popoverKind === "planning" && planningView) planningView.refresh();
    renderMonitorLanes();
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

  /** 자율 실행 체크리스트 — 감독 스레드 위 슬롯. 계획이 없으면 슬롯을 숨긴다. */
  const renderWorkSlot = (): void => {
    if (!workPlan) { workSlot.setAttribute("hidden", ""); workSlot.replaceChildren(); return; }
    workSlot.removeAttribute("hidden");
    workSlot.replaceChildren(renderWorkPane(workPlan, workActive));
  };

  const unsubscribeTeamActivity = subscribeTeamActivity((state) => {
    teamBoard = state;
    teamWork.update(state);
    // 팀장·팀원은 레인 보드의 행이다 — 캡션·배지·표를 같이 갱신한다.
    refreshLaneCaption();
    if (deckTab === "lanes") renderDeck();
    syncThreadView();
  });

  showTab("lanes");
  setDeckCollapsed(false);
  refreshLaneCaption();
  renderMonitorLanes();
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
      workPlan = plan;
      workActive = active;
      renderWorkSlot();
    },
    setChangePreview(input) {
      const appeared = input != null && changePreview == null;
      changePreview = input;
      setBadge("changes", input ? "" : null);
      // 변경이 새로 떠도 탭을 앗지 않는다(배지로 알린다) — 사용자가 보던 탭은 그대로.
      if (appeared || deckTab === "changes") renderDeck();
    },
    setToolLines(lines) {
      toolLines = lines.slice(0, ACTIVITY_LIMIT);
      setBadge("activity", toolLines.length > 0 ? String(toolLines.length) : null);
      if (deckTab === "activity") renderDeck();
    },
    setDeckTab: (tab) => showTab(tab, true),
    selectLane(id) {
      if (!laneManager.get(id)) return;
      if (deckCollapsed) setDeckCollapsed(false);
      showTab("lanes");
      selectThread(id);
    },
    openPlanning: () => openPopover("planning"),
    requestExit,
    dispose() {
      closeExitDialog();
      closePopover();
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
