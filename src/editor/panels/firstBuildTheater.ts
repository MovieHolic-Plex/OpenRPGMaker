// editor/panels/firstBuildTheater.ts
// 첫 새 게임 빌드 중 캔버스 집중 뷰 + 실제 상태 기반 4단계 진행 바 + 완료 시 바로 플레이 배너.
//
// 가짜 퍼센트는 쓰지 않는다. store 의 gameDesignBrief.generationPending 과
// teamActivity(TeamBoardState) 의 실제 실행 단계·도구 활동만으로 4단계를 계산한다.
import { el } from "@/util/dom";
import { store } from "@/project/store";
import { subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import type { TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { plainAction, stopAllPresences } from "./aiPresence";
import { openTestPlayModal } from "./testPlayModal";
import "@/styles/shell/first-build-theater.css";

export const FIRST_BUILD_THEATER_TESTIDS = {
  root: "first-build-theater",
  step: "first-build-step",
  status: "first-build-status",
  toolsToggle: "first-build-tools-toggle",
  playNow: "first-build-play-now",
  dismiss: "first-build-dismiss",
} as const;

export const FIRST_BUILD_STEPS = [
  { id: "skeleton", label: "뼈대 준비" },
  { id: "stage", label: "첫 무대 짓기" },
  { id: "cast", label: "인물·사건 배치" },
  { id: "verify", label: "플레이 확인" },
] as const;

export type FirstBuildPhase = "idle" | "building" | "ready" | "failed";

export type FirstBuildViewModel = {
  readonly phase: FirstBuildPhase;
  /** 0..3. ready 일 때는 4(전부 완료). */
  readonly stepIndex: number;
  readonly statusLine: string;
  readonly title: string;
};

const CAST_EVENT_TOOL_RE = /event|npc|dialogue|cutscene|quest|monster|enemy|troop|item|actor|romance|mystery|boss|shop|database/iu;
const VERIFY_TOOL_RE = /verify|inspect|review|scene_test|play|check|lint/iu;

function inferBuildingStepIndex(board: TeamBoardState | null): number {
  if (!board || board.phase === "준비") return 0;
  if (board.phase === "검토 대기" || board.phase === "적용 중") return 3;

  let sawStage = false;
  let sawCast = false;
  let sawVerify = false;

  for (const agent of board.agents) {
    if (agent.role === "reviewer" && (agent.state === "실행 중" || agent.state === "완료")) sawVerify = true;
    if (agent.toolCalls > 0) sawStage = true;
    for (const entry of agent.log) {
      if (entry.kind === "review") sawVerify = true;
      if (entry.kind === "tool") {
        if (VERIFY_TOOL_RE.test(entry.name)) sawVerify = true;
        else if (CAST_EVENT_TOOL_RE.test(entry.name)) sawCast = true;
        else sawStage = true;
      }
    }
    for (const key of agent.changedKeys) {
      if (CAST_EVENT_TOOL_RE.test(key)) sawCast = true;
    }
  }
  for (const key of board.changedKeys) {
    if (CAST_EVENT_TOOL_RE.test(key)) sawCast = true;
  }

  if (sawVerify) return 3;
  if (sawCast) return 2;
  if (sawStage) return 1;
  return 0;
}

function liveStatusText(board: TeamBoardState | null, stepIndex: number): string {
  if (!board) return FIRST_BUILD_STEPS[stepIndex]?.label ?? "뼈대 준비";
  if (board.phase === "검토 대기") return "검토 대기 중";
  if (board.phase === "적용 중") return "지도에 적용하는 중";
  const activeAgent = board.agents.find((agent) => agent.state === "실행 중");
  if (activeAgent) {
    const runningTool = [...activeAgent.log].reverse().find((entry) => entry.kind === "tool" && entry.ok === null);
    if (runningTool && runningTool.kind === "tool" && runningTool.summary) return plainAction(runningTool.summary);
    if (activeAgent.lastLine) return plainAction(activeAgent.lastLine);
  }
  return FIRST_BUILD_STEPS[stepIndex]?.label ?? "첫 무대 짓기";
}

export function deriveFirstBuildViewModel(input: {
  readonly tracked: boolean;
  readonly generationPending: boolean;
  readonly board: TeamBoardState | null;
  readonly title: string;
}): FirstBuildViewModel {
  const { tracked, generationPending, board, title } = input;
  if (!tracked && !generationPending) {
    return { phase: "idle", stepIndex: 0, statusLine: "", title };
  }
  if (board && (board.phase === "실패" || board.phase === "중단")) {
    return {
      phase: "failed",
      stepIndex: inferBuildingStepIndex(board),
      statusLine: board.error || "첫 빌드를 끝내지 못했습니다",
      title,
    };
  }
  if (board && (board.phase === "적용됨" || board.phase === "완료")) {
    return {
      phase: "ready",
      stepIndex: FIRST_BUILD_STEPS.length,
      statusLine: "첫 구간 준비 완료",
      title,
    };
  }
  if (!generationPending && tracked && !board) {
    return {
      phase: "ready",
      stepIndex: FIRST_BUILD_STEPS.length,
      statusLine: "첫 구간 준비 완료",
      title,
    };
  }
  const stepIndex = inferBuildingStepIndex(board);
  return {
    phase: "building",
    stepIndex,
    statusLine: liveStatusText(board, stepIndex),
    title,
  };
}

/**
 * 캔버스 하단에 첫 빌드 집중 뷰 바를 붙이고, 진행 중에는 편집기 좌측 도크를 접어 캔버스를 넓힌다.
 * 사용자가 「편집 도구 보기」를 누르면 즉시 좌측 도크를 되돌린다.
 */
export function mountFirstBuildTheater(
  canvasArea: HTMLElement,
  layout: HTMLElement,
  onLayoutChange: () => void,
): () => void {
  const root = el("aside", {
    class: "first-build-theater",
    attrs: { role: "status", "aria-live": "polite", "aria-label": "첫 게임 제작 진행", hidden: "" },
    dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.root, phase: "idle" },
  });
  canvasArea.append(root);

  let projectScope = JSON.stringify(store.getProjectIdentity());
  let tracked = store.getCurrent().gameDesignBrief?.generationPending === true;
  let dismissed = false;
  let focusSuppressed = false;
  let board: TeamBoardState | null = null;
  let lastFocused = false;
  let lastBuildingBar = false;
  let lastRenderKey = "";

  const applyFocusChrome = (focused: boolean): void => {
    const leftSidebar = layout.querySelector<HTMLElement>(":scope > .ai-chat-sidebar");
    const leftResizer = layout.querySelector<HTMLElement>(":scope > .resizer-left");
    const rightInspector = layout.querySelector<HTMLElement>(":scope > .right-inspector");
    if (leftSidebar) leftSidebar.style.display = focused ? "none" : "";
    if (leftResizer) leftResizer.style.display = focused ? "none" : "";
    if (rightInspector) rightInspector.style.display = focused ? "none" : "";
  };

  const syncStatusBarHidden = (hideStatusBar: boolean): void => {
    if (hideStatusBar === lastBuildingBar) return;
    lastBuildingBar = hideStatusBar;
    const statusBar = document.querySelector<HTMLElement>('[data-testid="ai-status-bar"]');
    if (statusBar) statusBar.style.display = hideStatusBar ? "none" : "";
  };

  const syncFocusClass = (nextFocused: boolean): void => {
    if (nextFocused === lastFocused) {
      if (nextFocused) applyFocusChrome(true);
      return;
    }
    lastFocused = nextFocused;
    layout.classList.toggle("is-first-build-focus", nextFocused);
    onLayoutChange();
    applyFocusChrome(nextFocused);
  };

  const render = (): void => {
    const project = store.getCurrent();
    const scope = JSON.stringify(store.getProjectIdentity());
    if (scope !== projectScope) {
      projectScope = scope;
      tracked = project.gameDesignBrief?.generationPending === true;
      dismissed = false;
      focusSuppressed = false;
      lastRenderKey = "";
    } else if (project.gameDesignBrief?.generationPending === true) {
      tracked = true;
      dismissed = false;
    }

    const vm = dismissed
      ? { phase: "idle" as const, stepIndex: 0, statusLine: "", title: project.meta.title }
      : deriveFirstBuildViewModel({
          tracked,
          generationPending: project.gameDesignBrief?.generationPending === true,
          board,
          title: project.meta.title || "새 게임",
        });

    const visible = vm.phase !== "idle";
    const focused = vm.phase === "building" && !focusSuppressed;
    root.hidden = !visible;
    root.dataset.phase = vm.phase;
    syncFocusClass(focused);
    syncStatusBarHidden(vm.phase === "building");
    if (!visible) return;

    const renderKey = `${vm.phase}|${vm.stepIndex}|${vm.statusLine}|${vm.title}|${focusSuppressed ? 1 : 0}`;
    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    const stepNodes = FIRST_BUILD_STEPS.map((step, idx) => {
      const done = vm.phase === "ready" || idx < vm.stepIndex;
      const active = vm.phase === "building" && idx === vm.stepIndex;
      return el("div", {
        class: `fbt-step${done ? " is-done" : ""}${active ? " is-active" : ""}`,
        dataset: { testid: `${FIRST_BUILD_THEATER_TESTIDS.step}-${step.id}`, state: done ? "done" : active ? "active" : "pending" },
        children: [
          el("span", { class: "fbt-dot", text: done ? "✓" : String(idx + 1), attrs: { "aria-hidden": "true" } }),
          el("span", { class: "fbt-label", text: step.label }),
        ],
      });
    });

    if (vm.phase === "ready") {
      root.replaceChildren(
        el("div", { class: "fbt-steps", children: stepNodes }),
        el("div", { class: "fbt-ready-row", children: [
          el("div", { class: "fbt-ready-meta", children: [
            el("strong", { class: "fbt-ready-title", text: vm.title, attrs: { translate: "no" } }),
            el("span", { class: "fbt-status", text: vm.statusLine, dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.status } }),
          ] }),
          el("div", { class: "fbt-actions", children: [
            el("button", {
              class: "fbt-btn",
              attrs: { type: "button" },
              dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.dismiss },
              text: "편집하기",
              on: { click: () => { dismissed = true; tracked = false; render(); } },
            }),
            el("button", {
              class: "fbt-btn is-primary",
              attrs: { type: "button" },
              dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.playNow },
              text: "▶ 방금 만든 게임 플레이해 보기",
              on: { click: () => { void openTestPlayModal(); } },
            }),
          ] }),
        ] }),
      );
      return;
    }

    if (vm.phase === "failed") {
      root.replaceChildren(
        el("div", { class: "fbt-ready-row", children: [
          el("span", { class: "fbt-status is-error", text: vm.statusLine, dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.status } }),
          el("div", { class: "fbt-actions", children: [
            el("button", {
              class: "fbt-btn",
              attrs: { type: "button" },
              dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.dismiss },
              text: "편집 도구 열기",
              on: { click: () => { dismissed = true; tracked = false; render(); } },
            }),
          ] }),
        ] }),
      );
      return;
    }

    // building phase
    root.replaceChildren(
      el("div", { class: "fbt-steps", children: stepNodes }),
      el("div", { class: "fbt-live-row", children: [
        el("span", { class: "fbt-live-dot", attrs: { "aria-hidden": "true" } }),
        el("span", { class: "fbt-status", text: vm.statusLine, dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.status } }),
        el("div", { class: "fbt-actions", children: [
          el("button", {
            class: "fbt-btn is-subtle",
            attrs: { type: "button" },
            dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.toolsToggle },
            text: focusSuppressed ? "집중 보기" : "편집 도구 보기",
            on: { click: () => { focusSuppressed = !focusSuppressed; render(); } },
          }),
          ...(board ? [el("button", {
            class: "fbt-btn is-stop",
            attrs: { type: "button" },
            text: "■ 멈춤",
            on: { click: () => { stopAllPresences(); } },
          })] : []),
        ] }),
      ] }),
    );
  };

  const unsubStore = store.subscribe(() => render());
  const unsubTeam = subscribeTeamActivity((next) => {
    board = next;
    render();
  });
  render();

  return () => {
    unsubStore();
    unsubTeam();
    applyFocusChrome(false);
    syncStatusBarHidden(false);
    layout.classList.remove("is-first-build-focus");
    root.remove();
  };
}
