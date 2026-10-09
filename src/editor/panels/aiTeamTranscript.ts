// 팀원 한 명의 과정 — 팀 데크 오른쪽 열. 배정 → 턴 → 툴 행 → 말 → 검수 → 완료를 순서대로 그린다.
// 상태는 teamBoardState 의 `agent.log` 가 만들고 이 파일은 그리기만 한다.
// 툴 행은 조수 작업 타임라인(aiChatRenderers.renderToolActivityEntry)과 같은 어휘다 —
// 칩 · 한국어 라벨(aiToolLabels) · 요약 · ✓/✗, 함수 원명은 title. 두 번째 어휘를 만들지 않는다.

import { createKeyedRows } from "./aiKeyedRows";
import { el } from "@/util/dom";
import type { TeamAgentLogEntry, TeamBoardAgent } from "@/ai/piAgent/teamBoardState";
import { deckIcon } from "./aiDeckIcons";
import { toolIconKey, toolLabel } from "./aiToolLabels";

const REVIEW_FINDINGS_SHOWN = 6;

/** 상세 보기(스튜디오) — 툴 인자 줄을 보이고 요약·본문을 자르지 않는다. */
export interface TeamTranscriptOptions {
  readonly detail?: boolean;
}

function toolRow(entry: Extract<TeamAgentLogEntry, { kind: "tool" }>, detail: boolean): HTMLElement {
  const tone = entry.ok === null ? "running" : entry.ok ? "ok" : "error";
  const summary = entry.ok === null ? "실행 중" : entry.summary || (entry.ok ? "완료" : "실패");
  const status = entry.ok === null
    ? el("span", { class: "ai-deck-spin ai-team-spin", attrs: { "aria-hidden": "true" } })
    : deckIcon(entry.ok ? "check" : "x", { size: 15 });
  const what = el("span", {
    class: "ai-act-what",
    children: [
      el("span", { class: "ai-act-label", text: toolLabel(entry.name), ...(detail ? { attrs: { title: entry.name } } : {}) }),
      el("span", { class: "ai-act-sum", text: summary }),
    ],
  });
  if (detail && entry.args) {
    what.append(el("span", { class: "ai-team-tx-args", text: entry.args, dataset: { testid: "ai-team-tx-args" } }));
  }
  return el("li", {
    class: `ai-team-tx-row ai-team-tx-tool is-${tone}`,
    dataset: { testid: "ai-team-tx-tool", tool: entry.name, state: tone },
    attrs: { title: `${entry.name} — ${summary}` },
    children: [
      el("span", { class: "ai-act-chip is-icon", attrs: { "aria-hidden": "true" }, children: [deckIcon(toolIconKey(entry.name), { size: 15 })] }),
      what,
      el("span", { class: "ai-act-status", attrs: { "aria-label": tone === "running" ? "실행 중" : tone === "ok" ? "완료" : "실패" }, children: [status] }),
    ],
  });
}

function statsLine(entry: Extract<TeamAgentLogEntry, { kind: "done" }>): string {
  const parts = [
    entry.stats && entry.stats.turns > 0 ? `${entry.stats.turns}턴` : null,
    entry.stats && entry.stats.toolCalls > 0 ? `툴 ${entry.stats.toolCalls}${entry.stats.toolErrors ? ` (실패 ${entry.stats.toolErrors})` : ""}` : null,
    entry.stats ? `${Math.max(1, Math.round(entry.stats.ms / 1000))}초` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ");
}

export function renderTeamTranscriptEntry(entry: TeamAgentLogEntry, options: TeamTranscriptOptions = {}): HTMLElement {
  const detail = options.detail === true;
  switch (entry.kind) {
    case "task":
      return el("li", {
        class: "ai-team-tx-row ai-team-tx-task",
        dataset: { testid: "ai-team-tx-task" },
        children: [el("span", { class: "ai-team-tx-tag", text: "배정" }), el("span", { class: "ai-team-tx-body", text: entry.text })],
      });
    case "turn":
      return el("li", { class: "ai-team-tx-row ai-team-tx-turn", dataset: { testid: "ai-team-tx-turn" }, text: `${entry.index}턴` });
    case "tool":
      return toolRow(entry, detail);
    case "text":
      return el("li", { class: "ai-team-tx-row ai-team-tx-text", dataset: { testid: "ai-team-tx-text" }, text: entry.text });
    case "error":
      return el("li", { class: "ai-team-tx-row ai-team-tx-error", dataset: { testid: "ai-team-tx-error" }, text: entry.text });
    case "status":
      // 실행 방향이 바뀐 사실(계약 해제·맵 연결 등). 도구 행과 같은 과정 줄에 놓되 태그로 구분한다.
      return el("li", {
        class: `ai-team-tx-row ai-team-tx-task ai-team-tx-status${entry.ok === false ? " is-error" : ""}`,
        dataset: { testid: "ai-team-tx-status", name: entry.name },
        children: [el("span", { class: "ai-team-tx-tag", text: "상태" }), el("span", { class: "ai-team-tx-body", text: entry.text })],
      });
    case "review": {
      const row = el("li", {
        class: `ai-team-tx-row ai-team-tx-review ${entry.ok ? "is-ok" : "is-findings"}`,
        dataset: { testid: "ai-team-tx-review", ok: String(entry.ok) },
      });
      row.append(el("span", { class: "ai-team-tx-verdict", text: entry.ok ? "검수 통과" : `검수 지적 ${entry.findings.length}건` }));
      if (entry.findings.length > 0) {
        const list = el("ul", { class: "ai-team-tx-findings" });
        for (const finding of entry.findings.slice(0, REVIEW_FINDINGS_SHOWN)) list.append(el("li", { text: finding }));
        if (entry.findings.length > REVIEW_FINDINGS_SHOWN) list.append(el("li", { class: "ai-team-tx-more", text: `외 ${entry.findings.length - REVIEW_FINDINGS_SHOWN}건` }));
        row.append(list);
      }
      return row;
    }
    case "done": {
      const stats = statsLine(entry);
      return el("li", {
        class: `ai-team-tx-row ai-team-tx-done ${entry.ok ? "is-ok" : "is-error"}`,
        dataset: { testid: "ai-team-tx-done", ok: String(entry.ok) },
        children: [
          el("span", { class: "ai-team-tx-tag", text: entry.ok ? "완료" : "실패" }),
          el("span", { class: "ai-team-tx-body", text: [entry.summary, stats].filter(Boolean).join(" — ") }),
        ],
      });
    }
    default:
      return assertNever(entry);
  }
}

function assertNever(value: never): never {
  throw new Error(`unknown transcript entry: ${JSON.stringify(value)}`);
}

export interface TeamTranscriptHandle {
  readonly root: HTMLElement;
  /** 같은 팀원의 새 상태를 그린다. 팀원이 바뀌면 스크롤을 맨 아래로 되돌린다. */
  update(agent: TeamBoardAgent): void;
}

function headCounters(agent: TeamBoardAgent): string {
  return [
    agent.mapName ?? agent.mapId ?? (agent.role === "orchestrator" ? "전체" : null),
    agent.turns > 0 ? `${agent.turns}턴` : null,
    agent.toolCalls > 0 ? `툴 ${agent.toolCalls}${agent.toolErrors ? ` (실패 ${agent.toolErrors})` : ""}` : null,
  ].filter((part): part is string => part !== null).join(" · ");
}

/** 선택한 팀원의 과정 열. 머리(배지·이름·계수) + 행 목록. 실행 중이면 새 행이 붙을 때 바닥을 따라간다. */
export function createTeamTranscript(options: TeamTranscriptOptions = {}): TeamTranscriptHandle {
  const renderEntry = (entry: TeamAgentLogEntry): HTMLElement => renderTeamTranscriptEntry(entry, options);
  const kind = el("span", { class: "ai-team-role ai-team-tx-kind", dataset: { testid: "ai-team-tx-kind" } });
  const name = el("span", { class: "ai-team-tx-name", dataset: { testid: "ai-team-tx-name" } });
  const counters = el("span", { class: "ai-team-tx-counters" });
  const head = el("header", { class: "ai-team-tx-head", children: [kind, name, counters] });
  const dropped = el("p", { class: "ai-team-tx-dropped", attrs: { hidden: "" }, dataset: { testid: "ai-team-tx-dropped" } });
  const list = el("ol", { class: "ai-team-tx-list", dataset: { testid: "ai-team-tx-list" }, attrs: { "aria-live": "polite" } });
  const scroller = el("div", { class: "ai-team-tx-scroll", children: [dropped, list] });
  const root = el("section", { class: "ai-team-tx", dataset: { testid: "ai-team-transcript" }, attrs: { "aria-label": "팀원 과정" }, children: [head, scroller] });

  let shownAgentId: string | null = null;
  let shownLog: readonly TeamAgentLogEntry[] = [];
  let shownDropped = 0;
  let reconcile = createKeyedRows(list, renderEntry);

  const atBottom = (): boolean => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 24;

  const update = (agent: TeamBoardAgent): void => {
    const switched = agent.agentId !== shownAgentId;
    const follow = switched || atBottom();
    kind.textContent = agent.kindLabel;
    kind.className = `ai-team-role ai-team-tx-kind role-${agent.role}`;
    // 이름이 종류 배지와 같으면(라벨 없는 단독 시공) 「시공 시공」 이 되므로 배지만 남긴다 — 팀원 열과 같은 규칙.
    name.textContent = agent.roleLabel === agent.kindLabel ? "" : agent.roleLabel;
    name.hidden = agent.roleLabel === agent.kindLabel;
    counters.textContent = headCounters(agent);
    root.dataset.state = agent.state;
    if (agent.droppedLog > 0) { dropped.textContent = `이전 ${agent.droppedLog}행은 접었습니다`; dropped.removeAttribute("hidden"); }
    else dropped.setAttribute("hidden", "");
    // Stable ordinal also covers entries without tool IDs. Tool completion replaces
    // only that row, while a capped log removes only its expired prefix.
    if (switched || agent.droppedLog < shownDropped) {
      list.replaceChildren();
      reconcile = createKeyedRows(list, renderEntry);
    }
    if (switched || shownLog !== agent.log || shownDropped !== agent.droppedLog) {
      reconcile(agent.log, (_entry, index) => String(agent.droppedLog + index));
    }
    shownDropped = agent.droppedLog;
    shownAgentId = agent.agentId;
    shownLog = agent.log;
    if (follow) scroller.scrollTop = scroller.scrollHeight;
  };

  return { root, update };
}
