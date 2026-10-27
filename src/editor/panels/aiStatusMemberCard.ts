// editor/panels/aiStatusMemberCard.ts
// 지도 아래 상태 줄에서 조수 칩을 눌렀을 때 뜨는 카드 — 「이 조수가 무엇을 맡았고, 지금 뭘 하고, 어디까지 했나」.
//
// 왜(2026-10-18 사용자 불만): 「팀원들이 작업하고 있어요」 칩을 눌러도 「지금 …」 한 줄과 「아직 끝낸 단계가 없어요」 뿐이었다.
// 팀 보드(teamActivity)에 이미 있는 배정·단계 기록·작업 그림을 여기서 같은 관측(teamObservation)으로 보여 준다 — 새 관측은 만들지 않는다.
// 오른쪽 도크의 조수 상세(aiTeamSidebar)와 같은 원천이라, 「조수 상세 패널 열기」로 넘어가도 같은 내용이 이어진다.
//
// DOM 계약: `ai-status-pop-head` · `ai-status-pop-task-card` · `ai-status-pop-now-banner` · `ai-status-pop-media` · `ai-status-pop-timeline`.

import { currentTeamActivity } from "@/ai/piAgent/teamActivity";
import { formatEditorDate } from "@/i18n";
import type { TeamBoardAgent, TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { el } from "@/util/dom";
import { activityEntryIndex } from "./aiActivityIndex";
import { createActivityMedia } from "./aiActivityMedia";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { isActive, PRESENCE_LABEL, type Presence } from "./aiPresence";
import { teamObservation } from "./aiTeamObservation";

/** 팝오버에 펼치는 최근 단계 수. 더 오래된 단계는 「조수 상세」의 작업 기록에서 본다. */
const TIMELINE_LIMIT = 8;

type Step = { label: string; at?: number; failed: boolean; running?: boolean; step?: number; ms?: number };

/** 경과 시간 「12초」·「1분 05초」 — 상태 줄의 시계와 카드의 시계·소요 시간이 같은 표기를 쓴다. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, "0")}초`;
}

function took(ms: number | undefined): string {
  if (ms === undefined || ms < 100) return "";
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}초` : formatElapsed(ms);
}

/** 앞 턴(대화창)의 보드에서 이 조수의 행. 다른 맵 대기열·영역 작업은 보드가 따로라 없다. */
function boardAgent(presence: Presence): { board: TeamBoardState; agent: TeamBoardAgent } | null {
  if (presence.source !== "chat") return null;
  const board = currentTeamActivity();
  const agent = board?.agents.find(item => item.agentId === presence.id);
  return board && agent ? { board, agent } : null;
}

function roleOf(presence: Presence, agent: TeamBoardAgent | undefined): { label: string; icon: DeckIconName } {
  if (agent?.role === "orchestrator") return { label: agent.kindLabel || "팀장", icon: "flag" };
  if (agent?.role === "reviewer" || presence.readsOnly) return { label: agent?.kindLabel || "검수", icon: "shield" };
  if (agent) return { label: agent.kindLabel || "시공", icon: /장식|정원|숲/.test(agent.roleLabel) ? "tree" : "house" };
  if (presence.source === "region") return { label: "영역", icon: "selection" };
  return { label: "조수", icon: "user" };
}

/** 이 조수가 함께 도는 팀 실행의 일인가 — 그렇다면 오른쪽 도크의 조수 상세에 같은 행이 있다. */
export function presenceInTeamRun(presence: Presence): boolean {
  return presence.source === "chat" && currentTeamActivity()?.mode === "team";
}

export function createStatusMemberCard(): {
  render(presence: Presence, actions: readonly HTMLElement[], onClose: () => void): HTMLElement[];
  tick(): void;
} {
  let clockNode: HTMLElement | null = null;
  let clockPresence: Presence | null = null;
  // 그림은 같은 그림이면 다시 만들지 않는다 — 조수 이벤트마다 다시 그리면 읽던 그림이 깜박인다.
  let mediaNode: HTMLElement | null = null;
  let mediaId = "";

  const clockText = (presence: Presence): string => {
    const parts: string[] = [];
    if (presence.steps > 0) parts.push(`${presence.steps}단계 진행`);
    if (presence.startedAt !== undefined && isActive(presence)) parts.push(formatElapsed(Date.now() - presence.startedAt));
    return parts.join(" · ");
  };

  function render(presence: Presence, actions: readonly HTMLElement[], onClose: () => void): HTMLElement[] {
    const found = boardAgent(presence);
    const agent = found?.agent;
    const role = roleOf(presence, agent);
    const working = presence.state === "working";

    const meta = el("span", { class: "ai-status-pop-clock", dataset: { testid: "ai-status-pop-clock" }, attrs: { translate: "no" }, text: clockText(presence) });
    clockNode = meta; clockPresence = presence;
    const head = el("header", { class: "ai-status-pop-head", children: [
      el("span", { class: "ai-status-pop-avatar", dataset: { tone: String(presence.tone), state: presence.state }, attrs: { "aria-hidden": "true" }, children: [
        deckIcon(role.icon, { size: 18 }),
        el("span", { class: `ai-status-pop-pulse${isActive(presence) ? " is-pulse" : ""}`, dataset: { state: presence.state } }),
      ] }),
      el("div", { class: "ai-status-pop-ident", children: [
        el("div", { class: "ai-status-pop-title", children: [
          el("strong", { text: presence.name }),
          el("span", { class: "ai-status-tag", dataset: { state: presence.state }, text: PRESENCE_LABEL[presence.state] }),
        ] }),
        el("div", { class: "ai-status-pop-meta", children: [
          el("span", { class: "ai-status-pop-role", text: `#${presence.no} · ${role.label}`, attrs: { translate: "no" } }),
          el("span", { class: "ai-status-pop-scope", text: presence.mapName ?? "프로젝트 전체", attrs: { translate: "no" } }),
          meta,
        ] }),
      ] }),
      el("button", { class: "ai-status-pop-close", attrs: { type: "button", "aria-label": "닫기", title: "닫기" }, children: [deckIcon("x", { size: 15 })], on: { click: onClose } }),
    ] });

    const task = el("section", { class: "ai-status-pop-task-card", dataset: { testid: "ai-status-pop-task" }, children: [
      el("span", { class: "ai-status-pop-label", text: "배정된 임무" }),
      el("p", { text: presence.task || "아직 배정받은 임무가 없어요", attrs: { translate: "no" } }),
    ] });

    const now = el("div", { class: "ai-status-pop-now-banner", dataset: { testid: "ai-status-pop-now", state: presence.state }, attrs: { role: "status" }, children: [
      working ? el("span", { class: "ai-status-spinner", attrs: { "aria-hidden": "true" } })
        : el("span", { class: "ai-status-pop-now-icon", attrs: { "aria-hidden": "true" }, children: [deckIcon(presence.state === "failed" ? "alert" : presence.state === "waiting" ? "clock" : "check", { size: 15 })] }),
      el("span", { class: "ai-status-pop-label", text: "지금" }),
      el("span", { class: "ai-status-pop-now-text", text: presence.note && !working ? `${presence.action} · ${presence.note}` : presence.action }),
    ] });

    const media = found?.board.trace ? activityEntryIndex(found.board.trace).mediaByActor.get(found.agent.agentId) : undefined;
    const latest = media?.at(-1);
    if (!latest) { mediaNode = null; mediaId = ""; }
    else if (latest.id !== mediaId || !mediaNode) {
      mediaId = latest.id;
      mediaNode = el("div", { class: "ai-status-pop-media", dataset: { testid: "ai-status-pop-media" }, children: [createActivityMedia([latest], "")] });
    }

    // 보드에 이 조수의 기록이 있으면 더 길게(최근 8단계·시각·소요 시간), 없으면 Presence 가 들고 온 최근 3줄로.
    const steps: readonly Step[] = found
      ? teamObservation(found.agent, found.board.trace, undefined, TIMELINE_LIMIT).recent
      : [...presence.recent].reverse();
    const rows = steps.length ? steps.map((step, index) => {
      const status = step.failed ? "error" : step.running ? "running" : "ok";
      const time = step.running ? "진행 중" : [step.at ? formatEditorDate(new Date(step.at), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "", took(step.ms)].filter(Boolean).join(" · ");
      return el("li", { dataset: { status }, children: [
        el("span", { class: "ai-status-step-mark", attrs: { "aria-label": status === "error" ? "실패" : status === "running" ? "진행 중" : "완료" }, children: [
          status === "running" ? el("span", { class: "ai-status-spinner is-small" }) : deckIcon(status === "error" ? "x" : "check", { size: 15 }),
        ] }),
        el("span", { class: "ai-status-step-no", text: String(step.step ?? (found ? "" : index + 1)), attrs: { translate: "no" } }),
        el("span", { class: "ai-status-step-text", text: step.label }),
        ...(time ? [el("time", { text: time, attrs: { translate: "no" } })] : []),
      ] });
    }) : [el("li", { class: "is-empty", text: working ? "첫 단계를 준비하고 있어요" : "기록된 단계가 없어요" })];
    const timeline = el("section", { class: "ai-status-pop-timeline", dataset: { testid: "ai-status-pop-timeline" }, children: [
      el("div", { class: "ai-status-pop-section-head", children: [
        el("span", { class: "ai-status-pop-label", text: "작업 과정" }),
        el("span", { class: "ai-status-pop-count", text: steps.length ? `최근 ${steps.length}단계` : "" }),
      ] }),
      // 최신 단계가 맨 아래 — 목록이 넘치면 진행 중인 단계가 잘리지 않게 DOM 을 뒤집고 column-reverse 로 아래에서부터 쌓는다.
      el("ol", { children: rows.reverse() }),
    ] });

    return [head, task, now, ...(mediaNode ? [mediaNode] : []), timeline, el("footer", { class: "ai-status-pop-actions", children: [...actions] })];
  }

  return {
    render,
    tick() {
      if (!clockNode || !clockPresence || !clockNode.isConnected) return;
      const text = clockText(clockPresence);
      if (clockNode.textContent !== text) clockNode.textContent = text;
    },
  };
}
