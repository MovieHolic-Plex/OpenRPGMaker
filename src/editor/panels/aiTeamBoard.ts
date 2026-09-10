// 팀 보드 — `/pi` 실행을 대화 로그 안에 카드로 그린다. 팀장·시공·검수 에이전트가 행 하나씩,
// 행마다 상태·턴·툴콜·마지막 한 줄. 상태는 teamBoardState 리듀서가 만들고 이 파일은 그리기만 한다.
// 스타일: tabs-b-assistant-panel/20-team-board.css (tokens.css 변수만, !important 0).

import { el } from "@/util/dom";
import { teamBoardTotals, type TeamBoardAgent, type TeamBoardState } from "@/ai/piAgent/teamBoardState";

export interface TeamBoardReview {
  readonly onApply: () => void;
  readonly onDiscard: () => void;
}

export interface TeamBoardHandle {
  readonly root: HTMLElement;
  update(state: TeamBoardState): void;
  /** 검토 대기 단계의 적용/버리기 버튼 콜백. 단계가 바뀌면 버튼은 사라진다. */
  setReview(review: TeamBoardReview | null): void;
}

const PHASE_TONE: Record<TeamBoardState["phase"], string> = {
  "준비": "idle", "실행 중": "running", "적용 중": "running", "검토 대기": "review", "적용됨": "done", "버림": "muted", "중단": "muted", "실패": "error",
};
const AGENT_TONE: Record<TeamBoardAgent["state"], string> = {
  "대기": "idle", "실행 중": "running", "완료": "done", "실패": "error", "중단": "muted",
};

function agentTitle(agent: TeamBoardAgent): string {
  if (agent.role === "orchestrator") return "전체";
  return agent.mapName ? `${agent.mapName}` : agent.mapId ?? "";
}

function renderAgent(agent: TeamBoardAgent, startedAt: number): HTMLElement {
  const counters = [
    agent.turns > 0 ? `${agent.turns}턴` : null,
    agent.toolCalls > 0 ? `툴 ${agent.toolCalls}${agent.toolErrors ? ` (실패 ${agent.toolErrors})` : ""}` : null,
    agent.stats ? `${Math.max(1, Math.round(agent.stats.ms / 1000))}초` : null,
  ].filter((part): part is string => part !== null);
  const row = el("li", {
    class: `ai-team-agent is-${AGENT_TONE[agent.state]} role-${agent.role}`,
    dataset: { testid: "ai-team-agent", agentId: agent.agentId, state: agent.state },
    attrs: { "aria-label": `${agent.roleLabel} ${agentTitle(agent)} ${agent.state}` },
  });
  const head = el("div", { class: "ai-team-agent-head" });
  head.append(el("span", { class: "ai-team-role", text: agent.roleLabel }));
  // 팀원 이름이 배지를 덮으면 그 행이 시공인지 검수인지 사라진다 — 종류를 따로 붙인다.
  if (agent.kindLabel && agent.kindLabel !== agent.roleLabel) {
    head.append(el("span", { class: "ai-team-kind", text: agent.kindLabel, dataset: { testid: "ai-team-kind" } }));
  }
  head.append(
    el("span", { class: "ai-team-map", text: agentTitle(agent), attrs: { title: agent.mapId ?? "" } }),
    el("span", { class: "ai-team-agent-state", text: agent.state, dataset: { testid: "ai-team-agent-state" } }),
  );
  if (agent.state === "실행 중") head.append(el("span", { class: "ai-deck-spin ai-team-spin", attrs: { "aria-hidden": "true" } }));
  if (counters.length > 0) head.append(el("span", { class: "ai-team-counters", text: counters.join(" · ") }));
  row.append(head);
  if (agent.fixOf) {
    // 같은 맵에 시공 행이 둘 쌓였을 때 어느 것이 검수 지적 때문에 다시 돈 것인지 밝힌다.
    row.append(el("p", { class: "ai-team-fix-of", text: "검수 지적을 고치러 다시 배정됨", dataset: { testid: "ai-team-fix-of", fixOf: agent.fixOf } }));
  }
  if (agent.task && agent.role !== "orchestrator") {
    // 팀장이 쓴 작업 지시는 길다 — 두 줄로 접고, 누르면 펼친다.
    const task = el("p", { class: "ai-team-task is-clamped", text: agent.task, attrs: { role: "button", tabindex: "0", "aria-expanded": "false", title: "누르면 전체 지시를 펼칩니다" } });
    const toggle = () => { const open = task.classList.toggle("is-clamped"); task.setAttribute("aria-expanded", String(!open)); };
    task.addEventListener("click", toggle);
    task.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
    row.append(task);
  }
  if (agent.review) {
    const review = el("div", { class: `ai-team-review ${agent.review.ok ? "is-ok" : "is-findings"}` });
    review.append(el("span", { class: "ai-team-review-verdict", text: agent.review.ok ? "검수 통과" : `지적 ${agent.review.findings.length}건` }));
    if (agent.review.findings.length > 0) {
      const list = el("ul", { class: "ai-team-findings" });
      for (const finding of agent.review.findings.slice(0, 4)) list.append(el("li", { text: finding }));
      review.append(list);
    }
    row.append(review);
  } else if (agent.lastLine) {
    row.append(el("p", { class: `ai-team-last is-${agent.lastKind}`, text: agent.lastLine, attrs: { "aria-live": agent.state === "실행 중" ? "polite" : "off" } }));
  }
  if (agent.spills.length > 0 || agent.conflicts.length > 0) {
    row.append(el("p", {
      class: "ai-team-warn",
      text: [
        agent.spills.length > 0 ? `범위 밖 변경 버림: ${agent.spills.join(", ")}` : null,
        agent.conflicts.length > 0 ? `같은 맵 충돌: ${agent.conflicts.join(", ")}` : null,
      ].filter(Boolean).join(" · "),
    }));
  }
  void startedAt;
  return row;
}

export function createTeamBoard(initial: TeamBoardState): TeamBoardHandle {
  const startedAt = Date.now();
  const root = el("section", {
    class: "ai-team-board",
    dataset: { testid: "ai-team-board" },
    attrs: { role: "group", "aria-label": initial.mode === "team" ? "Pi 팀 실행" : "Pi 에이전트 실행" },
  });
  const badge = el("span", { class: "ai-change-badge ai-team-badge", text: initial.mode === "team" ? "Pi 팀" : "Pi 에이전트" });
  const title = el("span", { class: "ai-team-title", text: initial.task, attrs: { title: initial.task } });
  const phase = el("span", { class: "ai-team-phase", text: initial.phase, dataset: { testid: "ai-team-phase" }, attrs: { "aria-live": "polite" } });
  const totals = el("span", { class: "ai-team-totals" });
  const head = el("header", { class: "ai-team-head" });
  head.append(badge, title, phase, totals);
  const list = el("ol", { class: "ai-team-agents", attrs: { "aria-label": "에이전트" } });
  const foot = el("footer", { class: "ai-team-foot", attrs: { hidden: "" } });
  root.append(head, list, foot);

  let review: TeamBoardReview | null = null;
  const reviewBlock = (state: TeamBoardState): HTMLElement => {
    const block = el("div", { class: "ai-team-review-card", dataset: { testid: "ai-team-review" }, attrs: { role: "group", "aria-label": "검토" } });
    block.append(el("p", { class: "ai-team-review-title", text: "결과를 검토하고 적용하세요. 적용 전까지 프로젝트는 바뀌지 않습니다." }));
    if (state.reviewChips.length > 0) {
      const chips = el("div", { class: "ai-change-chips ai-team-review-chips" });
      for (const chip of state.reviewChips) chips.append(el("span", { class: "ai-change-chip", text: chip }));
      block.append(chips);
    }
    const actions = el("div", { class: "ai-team-review-actions" });
    const apply = el("button", { class: "ai-team-btn is-primary", text: "적용", attrs: { type: "button" }, dataset: { testid: "ai-team-apply" } });
    apply.addEventListener("click", () => review?.onApply());
    const discard = el("button", { class: "ai-team-btn", text: "버리기", attrs: { type: "button" }, dataset: { testid: "ai-team-discard" } });
    discard.addEventListener("click", () => review?.onDiscard());
    actions.append(apply, discard);
    block.append(actions);
    return block;
  };

  const update = (state: TeamBoardState): void => {
    root.dataset.phase = state.phase;
    root.className = `ai-team-board is-${PHASE_TONE[state.phase]}`;
    phase.textContent = state.phase;
    const sum = teamBoardTotals(state);
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    totals.textContent = sum.agents > 0
      ? `에이전트 ${sum.agents}${sum.running ? ` (${sum.running} 실행 중)` : ""} · 툴 ${sum.toolCalls}${sum.toolErrors ? ` (실패 ${sum.toolErrors})` : ""} · ${elapsed}초`
      : `${elapsed}초`;
    list.replaceChildren(...state.agents.map((agent) => renderAgent(agent, startedAt)));
    const footParts: HTMLElement[] = [];
    if (state.report) footParts.push(el("p", { class: "ai-team-report", text: state.report, dataset: { testid: "ai-team-report" } }));
    if (state.error) footParts.push(el("p", { class: "ai-team-error", text: state.error }));
    if (state.phase === "검토 대기" && review) footParts.push(reviewBlock(state));
    if (state.applied) footParts.push(el("p", { class: "ai-team-applied", text: state.applied, dataset: { testid: "ai-team-applied" } }));
    if (footParts.length > 0) { foot.replaceChildren(...footParts); foot.removeAttribute("hidden"); }
    else foot.setAttribute("hidden", "");
  };
  // 실행 중엔 1초마다 경과 시간만 다시 쓴다. 끝나면 멈춘다.
  let lastState = initial;
  let ticker: ReturnType<typeof setInterval> | null = null;
  const syncTicker = (): void => {
    const running = lastState.phase === "실행 중" || lastState.phase === "적용 중" || lastState.phase === "준비";
    if (running && ticker === null) ticker = setInterval(() => { if (root.isConnected) update(lastState); else stopTicker(); }, 1000);
    if (!running) stopTicker();
  };
  const stopTicker = (): void => { if (ticker !== null) { clearInterval(ticker); ticker = null; } };
  const updateAndTick = (state: TeamBoardState): void => { lastState = state; update(state); syncTicker(); };
  updateAndTick(initial);
  return {
    root,
    update: updateAndTick,
    setReview(next) { review = next; update(lastState); },
  };
}
