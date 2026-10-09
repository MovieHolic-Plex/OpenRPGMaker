import type { ActivityEntry, ActivityTrace } from "@/ai/activityTrace";
import type { TeamBoardAgent } from "@/ai/piAgent/teamBoardState";
import type { LaneState } from "@/ai/piAgent/lane";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { activityEntryIndex } from "./aiActivityIndex";

/** Observable execution receipts only: private thinking and connection pulses are not work. */
export interface TeamObservation {
  scope: string;
  assignment: string;
  action: string;
  result: string;
  report?: string;
  startedAt?: number;
  lastAt?: number;
  recent: readonly { label: string; at?: number; failed: boolean; running?: boolean }[];
}

function describe(entry: ActivityEntry, scope: string, compact = false): string {
  if (entry.kind === "tool") {
    if (entry.status === "info") return entry.summary;
    const input = entry.input as { args?: Record<string, unknown> } | undefined;
    const coordination: Record<string, string> = {
      assign_map_agent: "조수에게 맵 작업을 배정하는 중", assign_task_agent: "조수에게 작업을 배정하는 중",
      wait_agents: "배정한 조수의 완료를 기다리는 중", check_agents: "조수들의 진행 상황을 확인하는 중",
      review_map: "맵 검수를 맡기는 중", finish: "팀 결과를 정리하는 중",
    };
    if (entry.status === "running" && coordination[entry.name]) return coordination[entry.name]!;
    return narrateAiActivity({ toolName: entry.name, args: input?.args, mapName: scope,
      done: entry.status === "ok" || entry.status === "error", ok: entry.status === "ok", summary: entry.status === "running" || compact ? undefined : entry.summary }).action;
  }
  if (entry.kind === "assistant") return "조수의 중간 보고를 받았어요";
  if (entry.kind === "turn") return "생각 중";
  if (entry.name === "model.stream") return "생각 중";
  return entry.summary;
}

export function teamObservation(agent: TeamBoardAgent | undefined, trace?: ActivityTrace, lane?: LaneState): TeamObservation {
  const scope = agent?.mapName || agent?.mapId || lane?.spec.label || "프로젝트 전체";
  const entries = trace ? (agent ? activityEntryIndex(trace).byActor.get(agent.agentId) ?? [] : trace.entries) : [];
  const observable = entries.filter(e => e.name !== "connection.heartbeat" && e.name !== "map.image.delivered");
  const active = observable.filter(e => e.kind === "tool" && e.status === "running");
  // Stream receipts update in place, so array order does not identify the latest signal.
  const last = observable.reduce<ActivityEntry | undefined>((latest, entry) => !latest || (entry.endedAt ?? entry.at) >= (latest.endedAt ?? latest.at) ? entry : latest, undefined);
  const ended = agent ? ["완료", "실패", "중단"].includes(agent.state) : lane ? lane.status !== "running" && lane.status !== "idle" : false;
  const failed = agent?.state === "실패" || lane?.status === "failed";
  const stopped = agent?.state === "중단" || lane?.status === "stopped";
  const receiptOrder = (a: ActivityEntry, b: ActivityEntry) => (a.endedAt ?? a.at) - (b.endedAt ?? b.at);
  const latestResult = observable.filter(e => e.kind === "tool" && e.status !== "running").sort(receiptOrder).at(-1);
  const reportEntry = [...observable].reverse().find(e => e.kind === "assistant");
  const report = (reportEntry?.output as { text?: string } | undefined)?.text
    || [...(agent?.log ?? [])].reverse().find(e => e.kind === "text")?.text
    || agent?.summary || lane?.result?.answer || lane?.result?.summary;
  let action = failed ? "작업을 끝내지 못했어요" : stopped ? "작업을 중단했어요" : ended ? "작업을 마쳤어요"
    : active.length ? describe(active.at(-1)!, scope) + (active.length > 1 ? ` · ${active.length}개 작업 진행 중` : "")
    : last?.kind === "status" ? last.summary
    : last?.name === "model.stream" ? "생각 중" : "생각 중";
  if (agent?.state === "대기" || lane?.status === "idle") action = "작업 시작을 기다리는 중";
  if (!trace && !ended) {
    const tool = [...(agent?.log ?? [])].reverse().find(e => e.kind === "tool" && e.ok === null);
    if (tool?.kind === "tool") action = narrateAiActivity({ toolName: tool.name }).action;
  }
  const recent = observable.filter(e => ["tool", "agent_spawn", "agent_done", "review", "status", "error"].includes(e.kind)).sort(receiptOrder).slice(-3)
    .map(e => ({ label: describe(e, scope), at: e.endedAt ?? e.at, failed: e.status === "error", running: e.kind === "tool" && e.status === "running" }));
  return {
    scope, assignment: agent?.task || lane?.spec.instruction || "", action,
    result: latestResult ? describe(latestResult, scope, true) : report || "아직 처리 결과가 없어요", report,
    startedAt: observable.find(e => e.kind === "agent_spawn" || e.kind === "start")?.at ?? lane?.startedAt ?? undefined,
    lastAt: observable.length ? Math.max(...observable.map(e => e.endedAt ?? e.at)) : undefined, recent,
  };
}

export function teamActivityAge(at: number | undefined, now = Date.now()): string {
  if (at === undefined) return "활동 시각 기록 없음";
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  return seconds < 60 ? `최근 활동 ${seconds}초 전` : seconds < 3600 ? `최근 활동 ${Math.floor(seconds / 60)}분 전` : `최근 활동 ${Math.floor(seconds / 3600)}시간 전`;
}
