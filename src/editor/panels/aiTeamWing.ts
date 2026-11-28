// editor/panels/aiTeamWing.ts
// 안 B: 우측 2단 자석 팀 날개 — 하단 팀 바(ai-status-bar · first-build-theater)를 걷어내고
// 우측 플로팅 조수 카드 바로 왼쪽에 자석 도킹되는 팀 워크스페이스 날개로 통합한다.
//
// - 평상시(팀/첫 빌드 미실행): 완전 숨김 → 우측 조수 카드 단독 유지
// - 팀/첫 빌드 실행 중(> 1120px): 우측 조수 카드 왼쪽에 216px 자석 날개 도킹
//   (4단계 마일스톤 바 + 팀원별 실시간 맵 썸네일 카드 + 클릭 시 맵 이동/대화 포커스 + 검토/완료 플레이)
// - 날개만 접기: 38px 세로 손잡이 레일(팀원 상태 점 + 진행 요약)로 축소
// - 조수 전체 접힘 시: 날개도 함께 숨기고 우하단 단일 「✦ 조수」 알약에 라이브 팀 배지 표시
// - 좁은 화면(<= 1120px): 2단 날개 대신 조수 카드 상단 1줄 슬림 팀 스트립으로 자동 폴백

import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { currentTeamReviewActions, subscribeTeamActivity, type TeamReviewActions } from "@/ai/piAgent/teamActivity";
import { teamBoardTotals, type TeamBoardAgent, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { isTileCellChange, store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { plainAction, stopAllPresences } from "./aiPresence";
import { formatClock } from "./aiRunStream";
import {
  FIRST_BUILD_STEPS,
  FIRST_BUILD_THEATER_TESTIDS,
  briefContentKey,
  deriveFirstBuildViewModel,
  shouldRearmFirstBuild,
  type FirstBuildViewModel,
} from "./firstBuildTheater";
import { createMapThumbnail } from "./mapThumbnail";
import { openTestPlayModal } from "./testPlayModal";

export const AI_TEAM_WING_STATE_EVENT = "oprn:ai-team-wing-state";

export interface AiTeamWingPillState {
  readonly active: boolean;
  readonly label: string;
  readonly tone: "running" | "done" | "review" | "failed" | "idle";
}

const WING_FOLDED_KEY = "oprn:ai-team-wing-folded:v1";
// 4:3 비율로 렌더한 뒤 CSS object-fit: cover 로 잘라 좌우 검은 여백(레터박스) 없이 채운다.
const THUMB_W = 188;
const THUMB_H = 132;

const CAST_EVENT_TOOL_RE = /event|npc|dialogue|cutscene|quest|monster|enemy|troop|item|actor|romance|mystery|boss|shop|database/iu;
const VERIFY_TOOL_RE = /verify|inspect|review|scene_test|play|check|lint/iu;

function loadFolded(): boolean {
  try {
    return window.localStorage.getItem(WING_FOLDED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveFolded(folded: boolean): void {
  try {
    window.localStorage.setItem(WING_FOLDED_KEY, folded ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

function inferTeamStepIndex(board: TeamBoardState | null): number {
  if (!board || board.phase === "준비") return 0;
  if (board.phase === "적용됨" || board.phase === "완료") return FIRST_BUILD_STEPS.length;
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

function agentToneClass(agent: TeamBoardAgent): string {
  if (agent.state === "실패" || agent.state === "중단") return "is-error";
  if (agent.role === "orchestrator") return "is-role-lead";
  if (agent.role === "reviewer") return "is-role-qa";
  return "is-role-builder";
}

function agentStateLabel(agent: TeamBoardAgent): string {
  if (agent.state === "실행 중") return "작업 중";
  if (agent.state === "완료") return "완료 ✓";
  if (agent.state === "실패") return "실패";
  if (agent.state === "중단") return "중단";
  return "대기";
}

function agentLineText(agent: TeamBoardAgent): string {
  const runningTool = [...agent.log].reverse().find((entry) => entry.kind === "tool" && entry.ok === null);
  if (runningTool && runningTool.kind === "tool") {
    return plainAction(runningTool.summary || runningTool.name);
  }
  if (agent.lastLine) return plainAction(agent.lastLine);
  if (agent.summary) return plainAction(agent.summary);
  if (agent.task) return plainAction(agent.task);
  return agent.state === "완료" ? "작업 완료" : "대기 중";
}

function isRunningBoard(board: TeamBoardState | null): boolean {
  if (!board) return false;
  return board.phase === "준비" || board.phase === "실행 중" || board.phase === "적용 중";
}

function isDoneBoard(board: TeamBoardState | null): boolean {
  if (!board) return false;
  return board.phase === "적용됨" || board.phase === "완료";
}

function isFailedBoard(board: TeamBoardState | null): boolean {
  if (!board) return false;
  return board.phase === "실패" || board.phase === "중단";
}

function resolveMapName(mapId: string | null, fallback: string | null): string | null {
  if (fallback) return fallback;
  if (!mapId) return null;
  const map = store.getCurrent().maps[mapId];
  return map?.name || mapId;
}

function changedMapCount(board: TeamBoardState | null): number {
  if (!board) return 0;
  const ids = new Set<string>();
  for (const agent of board.agents) {
    if (agent.mapId) ids.add(agent.mapId);
  }
  for (const key of board.changedKeys) {
    if (key.startsWith("maps.") || key.startsWith("map:")) ids.add(key);
  }
  return ids.size;
}

export function mountAiTeamWing(
  aiPanel: HTMLElement,
  canvasArea: HTMLElement,
  layout: HTMLElement,
  onLayoutChange: () => void,
): () => void {
  // 1) 넓은 화면(> 1120px) 우측 자석 도킹 날개 (펼침 / 38px 세로 레일 겸용)
  const wing = el("aside", {
    class: "ai-team-wing",
    attrs: {
      role: "complementary",
      "aria-label": "AI 팀 작업 현황",
      hidden: "",
    },
    dataset: {
      testid: "ai-team-wing",
      active: "false",
      mode: "expanded",
      phase: "idle",
    },
  });

  // 2) 좁은 화면(<= 1120px) 자동 폴백: 조수 카드 상단(선택 컨텍스트 스트립 아래) 1줄 슬림 팀 스트립
  const inlineStrip = el("section", {
    class: "ai-team-wing-inline",
    attrs: {
      role: "status",
      "aria-live": "polite",
      "aria-label": "AI 팀 진행 요약",
      hidden: "",
    },
    dataset: { testid: "ai-team-wing-inline" },
  });

  const deck = aiPanel.querySelector<HTMLElement>(".ai-deck");
  const selStrip = deck?.querySelector<HTMLElement>(".ai-sel-context-strip") ?? null;
  const rail = deck?.querySelector<HTMLElement>(".ai-deck-rail") ?? null;
  if (selStrip) {
    selStrip.after(inlineStrip);
  } else if (rail) {
    rail.after(inlineStrip);
  } else if (deck) {
    deck.prepend(inlineStrip);
  }

  // aiPanel 과 같은 aiDock 호스트에 붙여 캔버스 포인터 게이트/휠 핸들러와 완전히 분리한다.
  const wingHost = aiPanel.parentElement ?? canvasArea;
  wingHost.append(wing);

  let projectScope = JSON.stringify(store.getProjectIdentity());
  let firstBuildTracked = store.getCurrent().gameDesignBrief?.generationPending === true;
  let completedFirstBuild = false;
  let firstBuildDismissed = false;
  let dismissedBriefKey: string | null = null;
  let ignoredFirstBuildBoardRef: TeamBoardState | null = null;
  let firstBuildBoard: TeamBoardState | null = null;

  let latestBoard: TeamBoardState | null = null;
  let dismissedTeamBoardRef: TeamBoardState | null = null;
  let ignoredScopeBoardRef: TeamBoardState | null = null;
  const ignoredScopeTraceIds = new Set<string>();
  let folded = loadFolded();
  let selectedAgentId: string | null = null;
  let runStartedAt: number | null = null;
  let lastBoardWasRunning = false;
  let autoOpenedForFirstBuild = false;
  let lastRenderSig = "";
  let lastPillSig = "";
  let lastFocusActive = false;
  let activeClockEl: HTMLElement | null = null;

  const isBoardOwnedByCurrentProject = (board: TeamBoardState | null): boolean => {
    if (!board) return false;
    if (board === ignoredScopeBoardRef) return false;
    const traceId = board.trace?.id;
    if (traceId && ignoredScopeTraceIds.has(traceId)) return false;
    const boardProjectId = board.trace?.projectId;
    if (boardProjectId && boardProjectId !== store.getProjectIdentity().id) return false;
    return true;
  };

  const updateClockText = (): void => {
    if (!activeClockEl) return;
    activeClockEl.textContent = runStartedAt !== null ? formatClock(Date.now() - runStartedAt) : "";
  };

  const emitPillState = (pillState: AiTeamWingPillState): void => {
    const sig = `${pillState.active ? 1 : 0}|${pillState.tone}|${pillState.label}`;
    if (sig === lastPillSig) return;
    lastPillSig = sig;
    window.dispatchEvent(new CustomEvent<AiTeamWingPillState>(AI_TEAM_WING_STATE_EVENT, { detail: pillState }));
  };

  const highlightAssistantLane = (agentId: string): void => {
    const lanes = aiPanel.querySelectorAll<HTMLElement>('[data-testid="ai-run-lane"]');
    for (const lane of lanes) {
      const match = lane.dataset.lane === agentId;
      lane.classList.toggle("is-team-focused", match);
      if (match) lane.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const selectAgent = (agent: TeamBoardAgent): void => {
    selectedAgentId = agent.agentId;
    if (agent.mapId && store.getCurrent().maps[agent.mapId]) {
      selectEditorMap(agent.mapId, { checkoutForEditing: false });
    }
    window.dispatchEvent(new CustomEvent("oprn:ai-team-select", {
      detail: { id: agent.agentId, mapId: agent.mapId },
    }));
    highlightAssistantLane(agent.agentId);
    render(true);
  };

  const dismissCurrent = (): void => {
    if (firstBuildTracked) {
      firstBuildDismissed = true;
      dismissedBriefKey = briefContentKey(store.getCurrent().gameDesignBrief);
      firstBuildTracked = false;
    }
    if (latestBoard) {
      dismissedTeamBoardRef = latestBoard;
    }
    selectedAgentId = null;
    render(true);
  };

  const syncFocusClass = (active: boolean): void => {
    if (active === lastFocusActive) return;
    lastFocusActive = active;
    layout.classList.toggle("is-first-build-focus", active);
    onLayoutChange();
  };

  type WingDerivedState =
    | {
        readonly active: false;
        readonly phase: "idle";
        readonly stepIndex: number;
        readonly statusLine: string;
        readonly title: string;
        readonly board: null;
        readonly isFirstBuild: false;
        readonly firstBuildVm: FirstBuildViewModel;
      }
    | {
        readonly active: true;
        readonly phase: "building" | "review" | "ready" | "failed";
        readonly stepIndex: number;
        readonly statusLine: string;
        readonly title: string;
        readonly board: TeamBoardState | null;
        readonly isFirstBuild: boolean;
        readonly firstBuildVm: FirstBuildViewModel;
      };

  const deriveState = (): WingDerivedState => {
    const project = store.getCurrent();
    const scope = JSON.stringify(store.getProjectIdentity());
    const pending = project.gameDesignBrief?.generationPending === true;
    const briefKey = briefContentKey(project.gameDesignBrief);

    if (scope !== projectScope) {
      projectScope = scope;
      firstBuildTracked = pending;
      completedFirstBuild = false;
      firstBuildDismissed = false;
      dismissedBriefKey = null;
      ignoredFirstBuildBoardRef = latestBoard;
      ignoredScopeBoardRef = latestBoard;
      if (latestBoard?.trace?.id) ignoredScopeTraceIds.add(latestBoard.trace.id);
      dismissedTeamBoardRef = latestBoard;
      firstBuildBoard = null;
      runStartedAt = null;
      lastBoardWasRunning = false;
      autoOpenedForFirstBuild = false;
      selectedAgentId = null;
    } else if (shouldRearmFirstBuild({
      pending,
      tracked: firstBuildTracked,
      dismissed: firstBuildDismissed,
      briefKey,
      dismissedBriefKey,
    })) {
      firstBuildTracked = true;
      completedFirstBuild = false;
      firstBuildDismissed = false;
      dismissedBriefKey = null;
      ignoredFirstBuildBoardRef = latestBoard;
      firstBuildBoard = null;
      autoOpenedForFirstBuild = false;
    }

    const firstBuildVm: FirstBuildViewModel = firstBuildDismissed
      ? { phase: "idle", stepIndex: 0, statusLine: "", title: project.meta.title || "새 게임" }
      : deriveFirstBuildViewModel({
          tracked: firstBuildTracked,
          generationPending: pending,
          completed: completedFirstBuild,
          board: firstBuildBoard,
          title: project.meta.title || "새 게임",
        });

    if (firstBuildVm.phase === "ready") completedFirstBuild = true;

    const teamBoardVisible =
      latestBoard !== null &&
      isBoardOwnedByCurrentProject(latestBoard) &&
      latestBoard !== dismissedTeamBoardRef &&
      latestBoard.mode === "team" &&
      latestBoard.phase !== "버림";

    const isFirstBuild = firstBuildVm.phase !== "idle";
    const activeBoard = isFirstBuild ? (firstBuildBoard ?? (teamBoardVisible ? latestBoard : null)) : (teamBoardVisible ? latestBoard : null);

    if (!isFirstBuild && !teamBoardVisible) {
      return {
        active: false,
        phase: "idle",
        stepIndex: 0,
        statusLine: "",
        title: project.meta.title || "새 게임",
        board: null,
        isFirstBuild: false,
        firstBuildVm,
      };
    }

    if (activeBoard?.phase === "검토 대기") {
      return {
        active: true,
        phase: "review",
        stepIndex: 3,
        statusLine: "변경을 검토하고 적용하세요",
        title: isFirstBuild ? firstBuildVm.title : (activeBoard.task || "팀 작업"),
        board: activeBoard,
        isFirstBuild,
        firstBuildVm,
      };
    }

    if (firstBuildVm.phase !== "idle") {
      return {
        active: true,
        phase: firstBuildVm.phase,
        stepIndex: firstBuildVm.stepIndex,
        statusLine: firstBuildVm.statusLine,
        title: firstBuildVm.title,
        board: activeBoard,
        isFirstBuild: true,
        firstBuildVm,
      };
    }

    // 일반 팀 실행
    const b = activeBoard!;
    const stepIndex = inferTeamStepIndex(b);
    if (isFailedBoard(b)) {
      return {
        active: true,
        phase: "failed",
        stepIndex,
        statusLine: b.error || "팀 작업을 끝내지 못했습니다",
        title: b.task || "팀 작업",
        board: b,
        isFirstBuild: false,
        firstBuildVm,
      };
    }
    if (isDoneBoard(b)) {
      return {
        active: true,
        phase: "ready",
        stepIndex: FIRST_BUILD_STEPS.length,
        statusLine: b.applied || "팀 작업을 마쳤어요",
        title: b.task || "팀 작업",
        board: b,
        isFirstBuild: false,
        firstBuildVm,
      };
    }
    const activeAgent = b.agents.find((a) => a.state === "실행 중");
    const statusLine = activeAgent ? agentLineText(activeAgent) : (FIRST_BUILD_STEPS[stepIndex]?.label ?? "팀 작업 중");
    return {
      active: true,
      phase: "building",
      stepIndex,
      statusLine,
      title: b.task || "팀 작업",
      board: b,
      isFirstBuild: false,
      firstBuildVm,
    };
  };

  const renderStepBars = (phase: string, stepIndex: number): HTMLElement =>
    el("div", {
      class: "ai-team-wing-steps",
      attrs: { role: "list", "aria-label": "진행 단계" },
      children: FIRST_BUILD_STEPS.map((step, idx) => {
        const done = phase === "ready" || idx < stepIndex;
        const active = (phase === "building" || phase === "review") && idx === stepIndex;
        return el("span", {
          class: `ai-team-wing-step-seg${done ? " is-done" : ""}${active ? " is-active" : ""}`,
          attrs: { role: "listitem", title: step.label },
          dataset: {
            testid: `${FIRST_BUILD_THEATER_TESTIDS.step}-${step.id}`,
            state: done ? "done" : active ? "active" : "pending",
          },
        });
      }),
    });

  const renderAgentCard = (agent: TeamBoardAgent, currentMapId: string | null): HTMLElement => {
    const project = store.getCurrent();
    const mapExists = Boolean(agent.mapId && project.maps[agent.mapId]);
    const mapLabel = resolveMapName(agent.mapId, agent.mapName);
    const isSelected = selectedAgentId === agent.agentId || (!selectedAgentId && Boolean(agent.mapId && agent.mapId === currentMapId));
    const toneCls = agentToneClass(agent);

    const children: HTMLElement[] = [
      el("div", {
        class: "ai-team-wing-agent-head",
        children: [
          el("span", {
            class: "ai-team-wing-agent-who",
            children: [
              el("span", { class: `ai-team-wing-dot ${toneCls}${agent.state === "실행 중" ? " is-pulse" : ""}`, attrs: { "aria-hidden": "true" } }),
              el("span", { class: "ai-team-wing-agent-name", text: agent.roleLabel || agent.kindLabel }),
            ],
          }),
          el("span", {
            class: `ai-team-wing-agent-state ${agent.state === "완료" ? "is-done" : agent.state === "실패" ? "is-error" : ""}`,
            text: agent.state === "실행 중" && agent.toolCalls > 0 ? `도구 ${agent.toolCalls}` : agentStateLabel(agent),
          }),
        ],
      }),
    ];

    if (agent.mapId && mapExists) {
      const thumb = createMapThumbnail(agent.mapId, {
        width: THUMB_W,
        height: THUMB_H,
        className: "ai-team-wing-thumb-canvas",
        testId: `ai-team-wing-thumb-${agent.agentId}-${agent.mapId}`,
      });
      children.push(
        el("div", {
          class: "ai-team-wing-thumb-wrap",
          children: [
            thumb,
            el("span", { class: "ai-team-wing-thumb-label", text: `${mapLabel ?? agent.mapId} ↗` }),
          ],
        }),
      );
    } else if (mapLabel) {
      children.push(el("div", { class: "ai-team-wing-map-chip", text: mapLabel }));
    }

    children.push(
      el("p", {
        class: "ai-team-wing-agent-line",
        text: agentLineText(agent),
        attrs: { title: agentLineText(agent) },
      }),
    );

    return el("button", {
      class: `ai-team-wing-agent ${toneCls}${isSelected ? " is-selected" : ""}`,
      attrs: {
        type: "button",
        title: mapExists ? `${mapLabel ?? "맵"}으로 이동하고 이 팀원 기록 보기` : `${agent.roleLabel} 작업 보기`,
      },
      dataset: {
        testid: "ai-team-wing-agent",
        agentId: agent.agentId,
        role: agent.role,
        state: agent.state,
        ...(agent.mapId ? { mapId: agent.mapId } : {}),
      },
      children,
      on: { click: () => selectAgent(agent) },
    });
  };

  const renderRail = (
    phase: "building" | "review" | "ready" | "failed",
    stepIndex: number,
    agents: readonly TeamBoardAgent[],
    workerCount: number,
  ): void => {
    const dots = (agents.length > 0 ? agents.slice(0, 6) : [null]).map((agent) =>
      el("span", {
        class: `ai-team-wing-rail-dot ${agent ? agentToneClass(agent) : "is-role-lead"}${agent?.state === "실행 중" || (!agent && phase === "building") ? " is-pulse" : ""}`,
        attrs: { "aria-hidden": "true" },
      }),
    );
    const label = phase === "ready"
      ? "완료 · ▶"
      : phase === "failed"
        ? "팀 중단"
        : phase === "review"
          ? "검토 대기"
          : `팀 ${Math.max(1, workerCount)} · ${Math.min(stepIndex + 1, FIRST_BUILD_STEPS.length)}/${FIRST_BUILD_STEPS.length}`;

    wing.replaceChildren(
      el("button", {
        class: "ai-team-wing-rail-btn",
        attrs: { type: "button", title: "팀 날개 펼치기", "aria-label": "팀 날개 펼치기" },
        dataset: { testid: "ai-team-wing-expand" },
        children: [
          el("span", { class: "ai-team-wing-rail-chevron", text: "◂", attrs: { "aria-hidden": "true" } }),
          el("span", { class: "ai-team-wing-rail-dots", children: dots }),
          el("span", { class: "ai-team-wing-rail-text", text: label }),
        ],
        on: {
          click: () => {
            folded = false;
            saveFolded(false);
            render(true);
          },
        },
      }),
    );
  };

  const renderInlineFallback = (
    phase: "building" | "review" | "ready" | "failed",
    stepIndex: number,
    statusLine: string,
    agents: readonly TeamBoardAgent[],
    workerCount: number,
    isFirstBuild: boolean,
    reviewActions: TeamReviewActions | null,
  ): void => {
    const stepLabel = phase === "ready"
      ? (isFirstBuild ? "MVP 준비 완료" : "팀 작업 완료")
      : phase === "failed"
        ? "작업 중단"
        : phase === "review"
          ? "검토 대기"
          : `${FIRST_BUILD_STEPS[Math.min(stepIndex, FIRST_BUILD_STEPS.length - 1)]?.label ?? "작업 중"}`;

    const actionBtns: HTMLElement[] = [];
    if (phase === "building") {
      actionBtns.push(
        el("button", {
          class: "ai-team-wing-mini-btn is-stop",
          text: "■ 멈춤",
          attrs: { type: "button", title: "팀 작업 멈춤" },
          on: { click: () => stopAllPresences() },
        }),
      );
    } else if (phase === "review" && reviewActions) {
      actionBtns.push(
        el("button", {
          class: "ai-team-wing-mini-btn is-primary",
          text: "변경 적용",
          attrs: { type: "button" },
          dataset: { testid: "ai-team-wing-inline-apply" },
          on: { click: () => reviewActions.apply() },
        }),
        el("button", {
          class: "ai-team-wing-mini-btn",
          text: "버리기",
          attrs: { type: "button" },
          dataset: { testid: "ai-team-wing-inline-discard" },
          on: { click: () => reviewActions.discard() },
        }),
      );
    } else if (phase === "ready") {
      actionBtns.push(
        el("button", {
          class: "ai-team-wing-mini-btn is-primary",
          text: "▶ 플레이",
          attrs: { type: "button" },
          on: { click: () => { void openTestPlayModal(); } },
        }),
        el("button", {
          class: "ai-team-wing-mini-btn",
          text: "닫기",
          attrs: { type: "button" },
          on: { click: () => dismissCurrent() },
        }),
      );
    } else if (phase === "failed") {
      actionBtns.push(
        el("button", {
          class: "ai-team-wing-mini-btn",
          text: "닫기",
          attrs: { type: "button" },
          on: { click: () => dismissCurrent() },
        }),
      );
    }

    const pills = agents.slice(0, 5).map((agent) =>
      el("button", {
        class: `ai-team-wing-inline-pill ${agentToneClass(agent)}${selectedAgentId === agent.agentId ? " is-selected" : ""}`,
        attrs: { type: "button", title: resolveMapName(agent.mapId, agent.mapName) ?? agent.roleLabel },
        children: [
          el("span", { class: `ai-team-wing-dot ${agentToneClass(agent)}${agent.state === "실행 중" ? " is-pulse" : ""}`, attrs: { "aria-hidden": "true" } }),
          el("span", { text: agent.roleLabel || agent.kindLabel }),
        ],
        on: { click: () => selectAgent(agent) },
      }),
    );

    inlineStrip.replaceChildren(
      el("div", {
        class: "ai-team-wing-inline-top",
        children: [
          el("span", {
            class: "ai-team-wing-inline-title",
            children: [
              el("span", { class: `ai-team-wing-live-dot${phase === "ready" ? " is-done" : phase === "failed" ? " is-error" : phase === "review" ? " is-review" : ""}`, attrs: { "aria-hidden": "true" } }),
              el("strong", { text: `팀 ${Math.max(1, workerCount)}명 · ${stepLabel}` }),
              el("span", { class: "ai-team-wing-inline-sub", text: statusLine }),
            ],
          }),
          el("div", { class: "ai-team-wing-inline-actions", children: actionBtns }),
        ],
      }),
      renderStepBars(phase, stepIndex),
      ...(pills.length > 0 ? [el("div", { class: "ai-team-wing-inline-pills", children: pills })] : []),
    );
  };

  const render = (force = false): void => {
    const state = deriveState();
    const aiCollapsed = aiPanel.classList.contains("is-collapsed");
    const isRunning = state.phase === "building";

    if (isRunning && !lastBoardWasRunning) {
      runStartedAt = Date.now();
    } else if (!state.active) {
      runStartedAt = null;
    }
    lastBoardWasRunning = isRunning;

    // 첫 새 게임 빌드 진입 시 접혀 있던 조수 카드를 1회 열어 팀 날개가 바로 보이게 한다.
    if (state.isFirstBuild && state.phase === "building" && aiCollapsed && !autoOpenedForFirstBuild) {
      autoOpenedForFirstBuild = true;
      openAiAssistantPanel();
    }

    const effectiveCollapsed = aiPanel.classList.contains("is-collapsed");
    const nextActive = state.active ? "true" : "false";
    const nextMode = folded ? "rail" : "expanded";
    if (wing.dataset.active !== nextActive) wing.dataset.active = nextActive;
    if (wing.dataset.phase !== state.phase) wing.dataset.phase = state.phase;
    if (wing.dataset.mode !== nextMode) wing.dataset.mode = nextMode;
    syncFocusClass(state.isFirstBuild && state.phase === "building");

    if (!state.active) {
      if (!wing.hidden) wing.hidden = true;
      if (!inlineStrip.hidden) inlineStrip.hidden = true;
      // emitPillState already deduplicates via lastPillSig, so always emit idle here even
      // if an active run previously returned early while aiPanel was collapsed.
      emitPillState({ active: false, label: "", tone: "idle" });
      lastRenderSig = "";
      return;
    }

    const agents = state.board?.agents ?? [];
    const totals = state.board ? teamBoardTotals(state.board) : { agents: 0, toolCalls: 0, toolErrors: 0, running: 0 };
    const workerCount = agents.length > 0 ? agents.length : 1;
    const stepNo = Math.min(state.stepIndex + 1, FIRST_BUILD_STEPS.length);

    const pillLabel = state.phase === "ready"
      ? "완료 · ▶ 플레이"
      : state.phase === "failed"
        ? "팀 중단"
        : state.phase === "review"
          ? "검토 대기"
          : `팀 ${workerCount}명 · ${stepNo}/${FIRST_BUILD_STEPS.length}`;
    const pillTone: AiTeamWingPillState["tone"] =
      state.phase === "ready" ? "done"
        : state.phase === "failed" ? "failed"
          : state.phase === "review" ? "review"
            : "running";
    emitPillState({ active: true, label: pillLabel, tone: pillTone });

    // 조수 카드 자체가 접혀 있으면 날개도 함께 숨기고 우하단 단일 알약에 상태를 맡긴다.
    wing.hidden = effectiveCollapsed;
    inlineStrip.hidden = effectiveCollapsed;
    if (effectiveCollapsed) return;

    const currentMapId = editorState.get().currentMapId;
    const clockText = runStartedAt !== null ? formatClock(Date.now() - runStartedAt) : "";
    const reviewActions = state.phase === "review" ? currentTeamReviewActions() : null;

    const sig = JSON.stringify([
      state.phase,
      state.stepIndex,
      state.statusLine,
      state.title,
      state.isFirstBuild,
      folded,
      selectedAgentId,
      currentMapId,
      Boolean(reviewActions),
      agents.map((a) => [a.agentId, a.state, a.roleLabel, a.mapId, a.mapName, a.toolCalls, a.lastLine]),
    ]);
    if (!force && sig === lastRenderSig) {
      updateClockText();
      return;
    }
    lastRenderSig = sig;

    renderInlineFallback(state.phase, state.stepIndex, state.statusLine, agents, workerCount, state.isFirstBuild, reviewActions);

    if (folded) {
      activeClockEl = null;
      renderRail(state.phase, state.stepIndex, agents, workerCount);
      return;
    }

    const headTitle = state.phase === "ready"
      ? (state.isFirstBuild ? "첫 빌드 완료" : "팀 완료")
      : state.phase === "failed"
        ? "팀 중단"
        : state.phase === "review"
          ? "검토 대기"
          : `팀 ${workerCount}명 · ${stepNo}/${FIRST_BUILD_STEPS.length}`;

    const stepHeading = state.phase === "ready"
      ? "플레이 준비 완료"
      : state.phase === "failed"
        ? "실행을 끝내지 못했어요"
        : state.phase === "review"
          ? "변경 검토"
          : FIRST_BUILD_STEPS[Math.min(state.stepIndex, FIRST_BUILD_STEPS.length - 1)]?.label ?? "작업 중";

    const headActions: HTMLElement[] = [];
    if (state.phase === "building") {
      headActions.push(
        el("button", {
          class: "ai-team-wing-icon-btn is-stop",
          text: "■",
          attrs: { type: "button", title: "팀 작업 멈춤", "aria-label": "팀 작업 멈춤" },
          dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.stop },
          on: { click: () => stopAllPresences() },
        }),
      );
    } else if (state.phase === "ready" || state.phase === "failed") {
      headActions.push(
        el("button", {
          class: "ai-team-wing-icon-btn",
          text: "✕",
          attrs: { type: "button", title: "팀 날개 닫기", "aria-label": "팀 날개 닫기" },
          on: { click: () => dismissCurrent() },
        }),
      );
    }
    headActions.push(
      el("button", {
        class: "ai-team-wing-icon-btn",
        text: "▸",
        attrs: { type: "button", title: "날개 접기", "aria-label": "날개 접기" },
        dataset: { testid: "ai-team-wing-fold" },
        on: {
          click: () => {
            folded = true;
            saveFolded(true);
            render(true);
          },
        },
      }),
    );

    const clockNode = el("span", { class: "ai-team-wing-clock", text: clockText });
    activeClockEl = clockNode;

    const header = el("header", {
      class: "ai-team-wing-head",
      children: [
        el("div", {
          class: "ai-team-wing-head-row",
          children: [
            el("span", {
              class: "ai-team-wing-title-wrap",
              children: [
                el("span", {
                  class: `ai-team-wing-live-dot${state.phase === "ready" ? " is-done" : state.phase === "failed" ? " is-error" : state.phase === "review" ? " is-review" : ""}`,
                  attrs: { "aria-hidden": "true" },
                }),
                el("span", { class: "ai-team-wing-title", text: headTitle }),
              ],
            }),
            el("div", { class: "ai-team-wing-head-actions", children: headActions }),
          ],
        }),
        renderStepBars(state.phase, state.stepIndex),
        el("div", {
          class: "ai-team-wing-step-meta",
          children: [
            el("strong", { class: "ai-team-wing-step-name", text: stepHeading }),
            clockNode,
          ],
        }),
        el("p", {
          class: `ai-team-wing-status${state.phase === "failed" ? " is-error" : ""}`,
          text: state.statusLine,
          dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.status },
          attrs: { title: state.statusLine },
        }),
      ],
    });

    const body = el("div", { class: "ai-team-wing-body", dataset: { testid: "ai-team-wing-body" } });

    if (state.phase === "ready") {
      const mapsCount = changedMapCount(state.board);
      const stats: HTMLElement[] = [
        el("div", {
          class: "ai-team-wing-stat",
          children: [
            el("strong", { text: mapsCount > 0 ? `${mapsCount}장` : `${Math.max(1, Object.keys(store.getCurrent().maps).length)}장` }),
            el("span", { text: mapsCount > 0 ? "바뀐 맵" : "전체 맵" }),
          ],
        }),
        el("div", {
          class: "ai-team-wing-stat",
          children: [
            el("strong", { text: totals.toolCalls > 0 ? `${totals.toolCalls}회` : (clockText || "완료") }),
            el("span", { text: totals.toolCalls > 0 ? "도구 실행" : "상태" }),
          ],
        }),
      ];

      body.append(
        el("div", {
          class: "ai-team-wing-done-card",
          children: [
            el("div", { class: "ai-team-wing-done-badge", text: state.isFirstBuild ? "✓ MVP까지 만들었어요" : "✓ 팀 작업 완료" }),
            el("div", { class: "ai-team-wing-done-title", text: state.title }),
            el("div", { class: "ai-team-wing-stats", children: stats }),
            el("button", {
              class: "ai-team-wing-cta is-primary",
              text: "▶ 방금 만든 게임 플레이",
              attrs: { type: "button" },
              dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.playNow },
              on: { click: () => { void openTestPlayModal(); } },
            }),
            el("button", {
              class: "ai-team-wing-cta",
              text: "요약 닫기 (단독 조수로)",
              attrs: { type: "button" },
              dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.dismiss },
              on: { click: () => dismissCurrent() },
            }),
          ],
        }),
      );
      if (agents.length > 0) {
        body.append(
          el("div", { class: "ai-team-wing-section-label", text: `참여 팀원 (${agents.length})` }),
          ...agents.map((agent) => renderAgentCard(agent, currentMapId)),
        );
      }
    } else if (agents.length > 0) {
      body.append(...agents.map((agent) => renderAgentCard(agent, currentMapId)));
    } else {
      body.append(
        el("div", {
          class: "ai-team-wing-empty",
          children: [
            el("span", { class: "ai-team-wing-live-dot", attrs: { "aria-hidden": "true" } }),
            el("span", { text: state.phase === "failed" ? state.statusLine : "팀장이 작업을 나누고 있어요…" }),
          ],
        }),
      );
    }

    const footItems: HTMLElement[] = [];
    if (state.phase === "review" && reviewActions) {
      footItems.push(
        el("button", {
          class: "ai-team-wing-cta is-primary",
          text: "변경 적용",
          attrs: { type: "button" },
          dataset: { testid: "ai-team-wing-apply" },
          on: { click: () => reviewActions.apply() },
        }),
        el("button", {
          class: "ai-team-wing-cta",
          text: "버리기",
          attrs: { type: "button" },
          dataset: { testid: "ai-team-wing-discard" },
          on: { click: () => reviewActions.discard() },
        }),
      );
    } else if (state.phase === "failed") {
      footItems.push(
        el("button", {
          class: "ai-team-wing-cta",
          text: "닫기",
          attrs: { type: "button" },
          dataset: { testid: FIRST_BUILD_THEATER_TESTIDS.dismiss },
          on: { click: () => dismissCurrent() },
        }),
      );
    }

    const footer = footItems.length > 0
      ? [el("footer", { class: "ai-team-wing-foot", children: footItems })]
      : [];

    wing.replaceChildren(header, body, ...footer);
  };

  let initialized = false;
  const unsubStore = store.subscribe((_project, change) => {
    if (!isTileCellChange(change)) render();
  });
  let lastWingMapId = editorState.get().currentMapId;
  const unsubEditor = editorState.subscribe((state) => {
    if (state.currentMapId === lastWingMapId) return;
    lastWingMapId = state.currentMapId;
    render();
  });
  const unsubTeam = subscribeTeamActivity((next) => {
    latestBoard = next;
    const owned = isBoardOwnedByCurrentProject(next);
    if (next && owned && next !== dismissedTeamBoardRef && isRunningBoard(next)) {
      dismissedTeamBoardRef = null;
    }
    if (!initialized) {
      ignoredFirstBuildBoardRef = next;
      return;
    }
    // 첫 빌드 완료 요약이 남아 있는 상태에서 현재 프로젝트의 새 팀 실행이 시작되면 완료 요약을 종료하고 새 팀 보드로 전환한다.
    const isFreshTeamRun =
      next !== null &&
      owned &&
      next.mode === "team" &&
      isRunningBoard(next) &&
      next !== ignoredFirstBuildBoardRef &&
      next !== firstBuildBoard &&
      (!firstBuildBoard?.trace?.id || next.trace?.id !== firstBuildBoard.trace.id);
    if (completedFirstBuild && isFreshTeamRun) {
      firstBuildTracked = false;
      completedFirstBuild = false;
      firstBuildBoard = null;
    } else if (firstBuildTracked && !completedFirstBuild && owned && next !== ignoredFirstBuildBoardRef) {
      firstBuildBoard = next;
    }
    render();
  });
  initialized = true;

  let lastAiCollapsed = aiPanel.classList.contains("is-collapsed");
  const syncCollapseState = (): void => {
    const nextCollapsed = aiPanel.classList.contains("is-collapsed");
    if (nextCollapsed === lastAiCollapsed) return;
    lastAiCollapsed = nextCollapsed;
    render(true);
  };
  aiPanel.addEventListener("oprn:ai-panel-collapse", syncCollapseState);
  const classObserver = typeof MutationObserver === "function"
    ? new MutationObserver(syncCollapseState)
    : null;
  classObserver?.observe(aiPanel, { attributes: true, attributeFilter: ["class"] });

  const clockTimer = window.setInterval(() => {
    if (lastBoardWasRunning) updateClockText();
  }, 1000);

  render(true);

  return () => {
    unsubStore();
    unsubEditor();
    unsubTeam();
    aiPanel.removeEventListener("oprn:ai-panel-collapse", syncCollapseState);
    classObserver?.disconnect();
    window.clearInterval(clockTimer);
    syncFocusClass(false);
    emitPillState({ active: false, label: "", tone: "idle" });
    clearChildren(wing);
    clearChildren(inlineStrip);
    wing.remove();
    inlineStrip.remove();
  };
}
