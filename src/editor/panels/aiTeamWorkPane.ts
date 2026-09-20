import { createActivityView } from "./aiActivityView";
// 작업 페인 — 실행 중인 `/pi` 의 팀원 열 + 선택 팀원의 과정 열. 조수 데크의 「작업」 탭과
// 스튜디오 덱의 「작업」 탭이 같은 컴포넌트를 쓴다(스튜디오는 detail: 툴 인자·전체 문장까지).
//
// DOM:
//   section.ai-team-work[data-detail?]
//     ├ p.ai-team-work-empty                        상태 없음 안내
//     ├ div.ai-team-work-body[.is-single]           팀원 열(ul) + 과정 열(aiTeamTranscript)
//     ├ div.ai-team-work-review                     「검토 대기」 스트립 — 버리기 · 보고서 열기 · 적용
//     └ footer.ai-team-work-foot                    합계 · 보고 · 오류 · 적용 문장
//
// 상태는 teamActivity 버스에서 오고(단독 /pi 도 같은 버스를 탄다), 검토 버튼은 버스의
// 검토 액션 슬롯(setTeamReviewActions)을 부른다 — 로그 카드의 적용/버리기와 같은 클로저다.
// 스타일: tabs-b-assistant-panel/22-team-work.css (tokens 변수만).

import { el } from "@/util/dom";
import { currentTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { teamBoardTotals, type TeamBoardAgent, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { createTeamTranscript } from "./aiTeamTranscript";

export interface TeamWorkPaneOptions {
  /** 상세 보기(스튜디오) — 툴 인자 줄·팀원 통계·바뀐 키 수까지 그린다. */
  readonly detail?: boolean;
}

export interface TeamWorkPaneHandle {
  readonly root: HTMLElement;
  /** 버스가 준 보드 상태를 그린다. null 이면 빈 안내. */
  update(state: TeamBoardState | null): void;
}

function orderedAgents(state: TeamBoardState): readonly TeamBoardAgent[] {
  const leads = state.agents.filter((agent) => agent.role === "orchestrator");
  const rest = state.agents.filter((agent) => agent.role !== "orchestrator");
  return [...leads, ...rest];
}

/** 사용자가 고르지 않았을 때 따라갈 팀원 — 가장 최근에 배정된 팀원, 없으면 팀장. */
function defaultSelection(state: TeamBoardState): string | null {
  const ordered = orderedAgents(state);
  const newest = [...ordered].reverse().find((agent) => agent.role !== "orchestrator");
  return newest?.agentId ?? ordered[0]?.agentId ?? null;
}

function memberMeta(agent: TeamBoardAgent, detail: boolean): string {
  const parts = [
    agent.state,
    agent.turns > 0 ? `${agent.turns}턴` : null,
    agent.toolCalls > 0 ? `툴 ${agent.toolCalls}${agent.toolErrors ? ` (실패 ${agent.toolErrors})` : ""}` : null,
    agent.review && !agent.review.ok ? `지적 ${agent.review.findings.length}` : null,
    detail && agent.stats ? `${Math.max(1, Math.round(agent.stats.ms / 1000))}초` : null,
    detail && agent.changedKeys.length > 0 ? `바뀐 키 ${agent.changedKeys.length}` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ");
}

export function createTeamWorkPane(options: TeamWorkPaneOptions = {}): TeamWorkPaneHandle {
  const detail = options.detail === true;
  let activity: TeamBoardState | null = null;
  let pinnedAgentId: string | null = null;

  const members = el("ul", { class: "ai-team-work-members", dataset: { testid: "ai-team-work-members" }, attrs: { "aria-label": "팀원" } });
  const transcript = createTeamTranscript({ detail });
  const activityView = createActivityView({ archive: false });
  const body = el("div", { class: "ai-team-work-body", children: [members, activityView.root, transcript.root] });
  const empty = el("p", {
    class: "ai-team-work-empty",
    dataset: { testid: "ai-team-work-empty" },
    text: "실행 중인 작업이 없습니다. 조수에게 지시를 보내면 팀원별 과정이 여기 흐릅니다.",
  });
  const review = el("div", { class: "ai-team-work-review", dataset: { testid: "ai-team-work-review" }, attrs: { hidden: "", role: "group", "aria-label": "검토 대기" } });
  const foot = el("footer", { class: "ai-team-work-foot", dataset: { testid: "ai-team-work-foot" }, attrs: { hidden: "" } });
  const root = el("section", {
    class: `ai-team-work${detail ? " is-detail" : ""}`,
    dataset: { testid: "ai-team-work", ...(detail ? { detail: "true" } : {}) },
    attrs: { "aria-label": "작업 과정" },
    children: [empty, body, review, foot],
  });

  const selectedAgent = (): TeamBoardAgent | null => {
    if (!activity) return null;
    const wanted = pinnedAgentId ?? defaultSelection(activity);
    return activity.agents.find((agent) => agent.agentId === wanted) ?? activity.agents[0] ?? null;
  };

  const renderMembers = (state: TeamBoardState, selected: TeamBoardAgent | null): void => {
    members.replaceChildren(...orderedAgents(state).map((agent) => {
      const isSelected = selected?.agentId === agent.agentId;
      const button = el("button", {
        class: `ai-team-work-member is-${agent.state === "실행 중" ? "running" : agent.state === "실패" ? "error" : agent.state === "완료" ? "done" : "idle"} role-${agent.role}`,
        attrs: { type: "button", "aria-selected": String(isSelected), title: agent.task || agent.roleLabel },
        dataset: { testid: "ai-team-work-member", agentId: agent.agentId, state: agent.state },
        on: { click: () => { pinnedAgentId = agent.agentId; render(); } },
      });
      const head = el("div", { class: "ai-team-work-member-head" });
      head.append(el("span", { class: `ai-team-role role-${agent.role}`, text: agent.kindLabel, dataset: { testid: "ai-team-work-member-kind" } }));
      if (agent.roleLabel !== agent.kindLabel) head.append(el("span", { class: "ai-team-work-member-name", text: agent.roleLabel }));
      if (agent.state === "실행 중") head.append(el("span", { class: "ai-deck-spin ai-team-spin", attrs: { "aria-hidden": "true" } }));
      button.append(head);
      const where = agent.role === "orchestrator" ? "전체" : agent.mapName ?? agent.mapId ?? "";
      if (where) button.append(el("div", { class: "ai-team-work-member-where", text: where }));
      button.append(el("div", { class: "ai-team-work-member-meta", text: memberMeta(agent, detail) }));
      if (detail && agent.task) button.append(el("div", { class: "ai-team-work-member-task", text: agent.task }));
      if (agent.fixOf) button.append(el("div", { class: "ai-team-work-member-fix", text: "검수 지적 수정 배정" }));
      return el("li", { children: [button] });
    }));
  };

  const renderReview = (state: TeamBoardState): void => {
    if (state.phase !== "검토 대기") { review.replaceChildren(); review.setAttribute("hidden", ""); return; }
    review.removeAttribute("hidden");
    const actions = currentTeamReviewActions();
    const chips = state.reviewChips.length > 0 ? ` · ${state.reviewChips.join(" · ")}` : "";
    const label = el("span", { class: "ai-team-work-review-label", text: `검토 대기${chips}` });
    const buttons = el("div", { class: "ai-team-work-review-actions" });
    const button = (text: string, testid: string, onClick: (() => void) | undefined, primary = false): HTMLButtonElement => {
      const node = el("button", {
        class: `ai-team-btn${primary ? " is-primary" : ""}`,
        text,
        attrs: { type: "button", ...(onClick ? {} : { disabled: "", title: "이 실행의 검토는 대화 탭의 카드에서 합니다" }) },
        dataset: { testid },
        on: { click: () => onClick?.() },
      }) as HTMLButtonElement;
      return node;
    };
    buttons.append(button("버리기", "ai-team-work-discard", actions ? actions.discard : undefined));
    if (actions?.openReport) buttons.append(button("보고서 열기", "ai-team-work-report", actions.openReport));
    buttons.append(button("적용", "ai-team-work-apply", actions ? actions.apply : undefined, true));
    review.replaceChildren(label, buttons);
  };

  const renderFoot = (state: TeamBoardState): void => {
    const sum = teamBoardTotals(state);
    const parts: HTMLElement[] = [];
    if (sum.agents > 0) {
      const changed = detail && state.changedKeys.length > 0 ? ` · 바뀐 키 ${state.changedKeys.length}` : "";
      parts.push(el("span", {
        class: "ai-team-work-totals",
        dataset: { testid: "ai-team-work-totals" },
        text: `에이전트 ${sum.agents}${sum.running ? ` (${sum.running} 실행 중)` : ""} · 툴 ${sum.toolCalls}${sum.toolErrors ? ` (실패 ${sum.toolErrors})` : ""}${changed}`,
      }));
    }
    if (state.report) parts.push(el("p", { class: "ai-team-work-report-line", dataset: { testid: "ai-team-work-report-line" }, text: state.report }));
    if (state.error) parts.push(el("p", { class: "ai-team-work-error", text: state.error }));
    if (state.applied) parts.push(el("p", { class: "ai-team-work-applied", text: state.applied }));
    if (parts.length > 0) { foot.replaceChildren(...parts); foot.removeAttribute("hidden"); }
    else { foot.replaceChildren(); foot.setAttribute("hidden", ""); }
  };

  const render = (): void => {
    root.dataset.phase = activity?.phase ?? "";
    if (!activity || activity.agents.length === 0) {
      empty.removeAttribute("hidden");
      body.setAttribute("hidden", "");
      members.replaceChildren();
      review.replaceChildren();
      review.setAttribute("hidden", "");
      foot.replaceChildren();
      foot.setAttribute("hidden", "");
      return;
    }
    empty.setAttribute("hidden", "");
    body.removeAttribute("hidden");
    // 한 명뿐인 실행(질문·읽기 전용)은 팀원 열 없이 과정만 — 목업 a3 의 계약.
    body.classList.toggle("is-single", activity.agents.length < 2);
    const selected = selectedAgent();
    renderMembers(activity, selected);
    if (selected) transcript.update(selected);
    activityView.update(activity.trace, selected?.agentId);
    transcript.root.hidden = Boolean(activity.trace);
    renderReview(activity);
    renderFoot(activity);
  };

  const update = (state: TeamBoardState | null): void => {
    const previous = activity;
    activity = state;
    // 새 실행이 오면 고정을 푼다 — 이전 실행의 팀원 id 가 남아 있으면 첫 렌더가 빈 과정을 고른다.
    if (state === null || (previous !== null && previous.task !== state.task)) pinnedAgentId = null;
    if (pinnedAgentId && state && !state.agents.some((agent) => agent.agentId === pinnedAgentId)) pinnedAgentId = null;
    render();
  };

  update(null);
  return { root, update };
}
