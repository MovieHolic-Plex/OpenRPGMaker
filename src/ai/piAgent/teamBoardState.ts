// 팀 보드 상태. 이벤트 스트림 → 보드가 그릴 상태를 만드는 순수 리듀서.
// 단일 `/pi` 실행도 같은 보드로 그린다: 패널이 평평한 이벤트를 agent_event 로 감싸 넣는다.

import type { PiAgentEvent, PiAgentStats, PiTeamRoleId } from "./protocol";

export type TeamAgentState = "대기" | "실행 중" | "완료" | "실패" | "중단";

/**
 * 팀원 한 명의 과정 한 행. 팀 데크의 트랜스크립트가 그린다 — `lastLine` 은 마지막 한 줄만 남기고
 * 이전 이벤트를 덮어버려 「팀원이 무엇을 하고 있는지」는 보이지 않았다(2026-09-14).
 * 툴 행은 tool_start 에서 `ok: null` 로 열리고 같은 id 의 tool_end 가 제자리에서 닫는다.
 */
export type TeamAgentLogEntry =
  | { readonly kind: "task"; readonly text: string }
  | { readonly kind: "turn"; readonly index: number }
  | { readonly kind: "tool"; readonly id: string; readonly name: string; readonly ok: boolean | null; readonly summary: string; readonly args?: string }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "error"; readonly text: string }
  | { readonly kind: "review"; readonly ok: boolean; readonly findings: readonly string[] }
  | { readonly kind: "done"; readonly ok: boolean; readonly summary: string; readonly stats: PiAgentStats | null };

/** 팀원 한 명이 들고 있는 과정 행 상한. 넘치면 앞을 버리고 `droppedLog` 로 셈한다(조용한 절단 금지). */
export const TEAM_AGENT_LOG_CAP = 200;
/** tool_end 가 짝을 찾을 때 뒤에서부터 들어보는 최대 행 수 — 열린 툴은 거의 마지막 행이다. */
const TOOL_PAIR_LOOKBACK = 40;

export interface TeamBoardAgent {
  readonly agentId: string;
  readonly role: PiTeamRoleId;
  /** 행에 크게 붙는 이름. 팀 모드면 팀원 이름(「정원사」), 아니면 역할 이름. */
  readonly roleLabel: string;
  /** 역할 이름(팀장·시공·검수). roleLabel 이 팀원 이름으로 덮여도 종류는 여기 남는다. */
  readonly kindLabel: string;
  /** 사용자 정의 팀원 id(팀 모드). */
  readonly memberId: string | null;
  /** 검수 지적을 고치러 간 배정이면 그 검수 행의 agentId. */
  readonly fixOf: string | null;
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly task: string;
  readonly state: TeamAgentState;
  readonly turns: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  /** 마지막 툴 결과나 보고 한 줄. */
  readonly lastLine: string;
  /** 마지막 줄이 툴 결과(고정폭)인지 말(본문체)인지. */
  readonly lastKind: "tool" | "text";
  readonly summary: string;
  readonly changedKeys: readonly string[];
  readonly spills: readonly string[];
  readonly conflicts: readonly string[];
  readonly review?: { readonly ok: boolean; readonly findings: readonly string[] };
  readonly stats?: PiAgentStats;
  /** 과정 행 — 오래된 것이 앞. 상한 `TEAM_AGENT_LOG_CAP`. */
  readonly log: readonly TeamAgentLogEntry[];
  /** 상한을 넘어 버린 앞 행 수. */
  readonly droppedLog: number;
}

export type TeamBoardPhase = "준비" | "실행 중" | "적용 중" | "검토 대기" | "적용됨" | "완료" | "버림" | "중단" | "실패";

export interface TeamBoardState {
  readonly mode: "single" | "team";
  readonly task: string;
  readonly phase: TeamBoardPhase;
  readonly agents: readonly TeamBoardAgent[];
  readonly report: string | null;
  readonly error: string | null;
  readonly applied: string | null;
  readonly changedKeys: readonly string[];
  /** 검토 대기 중 보여줄 변경 요약 칩. */
  readonly reviewChips: readonly string[];
}

const ROLE_LABELS: Record<PiTeamRoleId, string> = { orchestrator: "팀장", builder: "시공", reviewer: "검수" };

export function createTeamBoardState(mode: "single" | "team", task: string): TeamBoardState {
  return { mode, task, phase: "준비", agents: [], report: null, error: null, applied: null, changedKeys: [], reviewChips: [] };
}

function agentRow(agentId: string, role: PiTeamRoleId, mapId: string | null, mapName: string | null, task: string, memberId: string | null = null, label?: string, fixOf: string | null = null): TeamBoardAgent {
  return {
    agentId, role, roleLabel: label || ROLE_LABELS[role], kindLabel: ROLE_LABELS[role], memberId, mapId, mapName, task, fixOf,
    state: "대기", turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "", lastKind: "text", summary: "", changedKeys: [], spills: [], conflicts: [],
    log: task ? [{ kind: "task", text: task }] : [], droppedLog: 0,
  };
}

function appendLog(agent: TeamBoardAgent, entry: TeamAgentLogEntry): TeamBoardAgent {
  const log = [...agent.log, entry];
  if (log.length <= TEAM_AGENT_LOG_CAP) return { ...agent, log };
  const overflow = log.length - TEAM_AGENT_LOG_CAP;
  return { ...agent, log: log.slice(overflow), droppedLog: agent.droppedLog + overflow };
}

/** 같은 id 로 열린 툴 행을 닫는다. 짝이 없으면(상한에 밀렸거나 start 누락) 닫힌 행을 새로 붙인다. */
function closeToolLog(agent: TeamBoardAgent, id: string, name: string, ok: boolean, summary: string): TeamBoardAgent {
  const floor = Math.max(0, agent.log.length - TOOL_PAIR_LOOKBACK);
  for (let index = agent.log.length - 1; index >= floor; index -= 1) {
    const entry = agent.log[index];
    if (entry && entry.kind === "tool" && entry.id === id && entry.ok === null) {
      const log = agent.log.slice();
      // 열린 행의 인자는 남긴다 — 닫힐 때 잃으면 상세 보기가 실행 중에만 인자를 보였다.
      log[index] = { kind: "tool", id, name, ok, summary, ...(entry.args ? { args: entry.args } : {}) };
      return { ...agent, log };
    }
  }
  return appendLog(agent, { kind: "tool", id, name, ok, summary });
}

function updateAgent(state: TeamBoardState, agentId: string, patch: (agent: TeamBoardAgent) => TeamBoardAgent): TeamBoardState {
  const exists = state.agents.some((agent) => agent.agentId === agentId);
  const agents = exists
    ? state.agents.map((agent) => (agent.agentId === agentId ? patch(agent) : agent))
    : [...state.agents, patch(agentRow(agentId, "builder", agentId, null, ""))];
  return { ...state, agents };
}

/**
 * 툴 인자를 사람이 읽는 한 줄로 접는다 — 스튜디오 상세 보기가 그린다.
 * 객체는 `k: v · k: v`, 그 외는 JSON 한 줄. 긴 값은 상한에서 자른다(기본 200자).
 */
export function formatToolArgs(args: unknown, max = 200): string {
  if (args === null || args === undefined) return "";
  let line: string;
  if (typeof args === "object" && !Array.isArray(args)) {
    const entries = Object.entries(args as Record<string, unknown>);
    if (entries.length === 0) return "";
    line = entries.map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value) ?? String(value)}`).join(" · ");
  } else {
    line = JSON.stringify(args) ?? String(args);
  }
  line = line.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

/** 마크다운 장식(굵게·코드·머리표)을 벗기고 한 줄로 접는다. 보드는 본문을 렌더하지 않는다. */
export function plainLine(text: string, max = 140): string {
  const flat = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*`#>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
const trimLine = plainLine;

/** 하위 에이전트의 평평한 이벤트를 행에 반영한다. */
function applyAgentEvent(agent: TeamBoardAgent, event: PiAgentEvent): TeamBoardAgent {
  switch (event.type) {
    case "start": return { ...agent, state: "실행 중" };
    case "turn": return appendLog({ ...agent, state: "실행 중", turns: event.index }, { kind: "turn", index: event.index });
    case "tool_start": {
      const args = formatToolArgs(event.args);
      return appendLog(
        { ...agent, toolCalls: agent.toolCalls + 1, lastLine: `${event.name} 실행 중`, lastKind: "tool" },
        { kind: "tool", id: event.id, name: event.name, ok: null, summary: "", ...(args ? { args } : {}) },
      );
    }
    case "tool_end":
      return closeToolLog(
        { ...agent, toolErrors: agent.toolErrors + (event.ok ? 0 : 1), lastLine: `${event.ok ? "✓" : "✗"} ${event.name} — ${trimLine(event.summary)}`, lastKind: "tool" },
        event.id, event.name, event.ok, trimLine(event.summary, 400),
      );
    case "assistant":
      return appendLog(
        { ...agent, lastLine: trimLine(event.text, 220), lastKind: "text", summary: trimLine(event.text, 400) },
        { kind: "text", text: trimLine(event.text, 600) },
      );
    case "error":
      return appendLog({ ...agent, state: "실패", lastLine: trimLine(event.message), lastKind: "text" }, { kind: "error", text: trimLine(event.message, 400) });
    case "done": return { ...agent, state: agent.state === "실패" ? "실패" : "완료", stats: event.stats, changedKeys: event.changedKeys };
    default: return agent;
  }
}

export function reduceTeamBoard(state: TeamBoardState, event: PiAgentEvent): TeamBoardState {
  switch (event.type) {
    case "team_start":
      return { ...state, phase: "실행 중", task: event.task || state.task };
    case "agent_spawn": {
      const row = agentRow(event.agentId, event.role, event.mapId, event.mapName, event.task, event.memberId ?? null, event.label, event.fixOf ?? null);
      const others = state.agents.filter((agent) => agent.agentId !== event.agentId);
      return { ...state, phase: "실행 중", agents: [...others, { ...row, state: "실행 중" }] };
    }
    case "agent_event":
      return updateAgent({ ...state, phase: state.phase === "준비" ? "실행 중" : state.phase }, event.agentId, (agent) => applyAgentEvent(agent, event.event));
    case "agent_done":
      return updateAgent(state, event.agentId, (agent) => appendLog({
        ...agent,
        state: event.ok ? "완료" : "실패",
        summary: event.summary || agent.summary,
        // 완료된 행의 마지막 줄은 보고문으로 바꾼다 — 중간에 난 제공자 오류 문구가 남지 않게.
        ...(event.ok && (agent.summary || event.summary) ? { lastLine: agent.summary || event.summary, lastKind: "text" as const } : {}),
        stats: event.stats,
        changedKeys: event.changedKeys,
        spills: event.spills,
        conflicts: event.conflicts,
        turns: event.stats.turns || agent.turns,
        toolCalls: event.stats.toolCalls || agent.toolCalls,
      }, { kind: "done", ok: event.ok, summary: trimLine(event.summary || agent.summary, 600), stats: event.stats }));
    case "review":
      return updateAgent(state, event.agentId, (agent) => appendLog({
        ...agent,
        state: "완료",
        review: { ok: event.ok, findings: event.findings },
        lastLine: event.ok ? "검수 통과" : `검수 지적 ${event.findings.length}건`,
        lastKind: "text",
      }, { kind: "review", ok: event.ok, findings: event.findings }));
    case "team_report":
      return { ...state, report: event.text };
    case "error":
      return { ...state, phase: "실패", error: event.message };
    case "done":
      return { ...state, phase: state.phase === "실패" ? "실패" : "적용 중", changedKeys: event.changedKeys };
    // 최상위에 평평한 단일 에이전트 이벤트가 오면(구형 스트림) 한 행으로 모은다.
    case "start": case "turn": case "tool_start": case "tool_end": case "assistant":
      return updateAgent({ ...state, phase: "실행 중" }, "agent", (agent) => applyAgentEvent(agent, event));
    default:
      return state;
  }
}

export function markTeamBoardApplied(state: TeamBoardState, text: string): TeamBoardState {
  return { ...state, phase: "적용됨", applied: text };
}

/** 적용 없이 끝난 정상 종료 — 계획만·답변·변경 없음. 「적용됨」은 실제 커밋된 실행에만 쓴다. */
export function markTeamBoardDone(state: TeamBoardState, text: string): TeamBoardState {
  return { ...state, phase: "완료", applied: text };
}

/** 결과가 나왔지만 사용자의 승인을 기다린다. */
export function markTeamBoardReview(state: TeamBoardState, chips: readonly string[]): TeamBoardState {
  return { ...state, phase: "검토 대기", reviewChips: chips };
}

export function markTeamBoardDiscarded(state: TeamBoardState): TeamBoardState {
  return { ...state, phase: "버림", applied: "버렸습니다. 프로젝트는 그대로입니다." };
}

export function markTeamBoardAborted(state: TeamBoardState): TeamBoardState {
  return {
    ...state,
    phase: "중단",
    agents: state.agents.map((agent) => (agent.state === "실행 중" || agent.state === "대기" ? { ...agent, state: "중단" } : agent)),
  };
}

export function markTeamBoardFailed(state: TeamBoardState, message: string): TeamBoardState {
  return { ...state, phase: "실패", error: message };
}

export function teamBoardTotals(state: TeamBoardState): { agents: number; toolCalls: number; toolErrors: number; running: number } {
  return state.agents.reduce(
    (acc, agent) => ({
      agents: acc.agents + 1,
      toolCalls: acc.toolCalls + agent.toolCalls,
      toolErrors: acc.toolErrors + agent.toolErrors,
      running: acc.running + (agent.state === "실행 중" ? 1 : 0),
    }),
    { agents: 0, toolCalls: 0, toolErrors: 0, running: 0 },
  );
}
