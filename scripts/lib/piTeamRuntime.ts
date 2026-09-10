// Pi 팀 런타임. 팀장 에이전트(orchestrator)가 커스텀 툴로 시공·검수 에이전트를 띄운다.
// 하위 에이전트는 runPiAgent 를 그대로 재사용하고, 시공 결과는 맵 묶음 단위로 작업 사본(working)에
// 도착 순서대로 병합된다.
//
// 배정 계약은 세 가지다.
//
// 1. **맵 in-flight 락** — 코어는 같은 턴의 툴 호출을 병렬로 돌린다(concurrency 기본 "shared").
//    같은 맵에 두 배정이 겹치면 둘 다 병합 전 사본에서 출발해 나중 결과가 앞 결과를 통째로
//    덮었다. 전에는 팀장 프롬프트의 문장 하나가 유일한 방어였다 — 이제 툴이 거절한다.
// 2. **시작/확인 분리** — assign 은 즉시 돌아오고, 팀장은 check_agents 로 중간을 본다.
//    전에는 assign 이 완료까지 await 해서 팀장이 헤매는 팀원을 끝날 때까지 몰랐다.
// 3. **업무 예산과 수정 예산의 분리** — src/ai/piAgent/teamAssignments.ts 참고.
//
// 팀장이 wait 없이 끝나도(턴 상한 등) 런타임이 남은 배정을 거두어 병합한다.

import { mapBundleIds, mergeMapBundles } from "../../src/ai/piAgent/mapBundle.ts";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest, type PiTeamRoleId } from "../../src/ai/piAgent/protocol.ts";
import { PI_TEAM_ROLES, teamRoleSummaries } from "../../src/ai/piAgent/team.ts";
import {
  claimAssignment,
  createTeamAssignmentLedger,
  recordTeamReview,
  runningAssignments,
  settleAssignment,
  teamAssignmentBudget,
  type TeamAssignmentLedger,
} from "../../src/ai/piAgent/teamAssignments.ts";
import { plainLine } from "../../src/ai/piAgent/teamBoardState.ts";
import { defaultTeamSpec, enabledMembers, memberSystemPrompt, normalizeTeamSpec, type PiTeamMember } from "../../src/ai/piAgent/teamSpec.ts";
import type { PiToolShape } from "../../src/ai/piAgent/toolAdapter.ts";
import type { Project } from "../../src/project/types.ts";
import type { RunPiAgentOptions } from "./piAgentRuntime.ts";

export type RunPiAgentFn = (request: PiAgentRequest, options: RunPiAgentOptions) => Promise<PiAgentDoneEvent>;

export interface RunPiTeamOptions extends RunPiAgentOptions {
  /**
   * 하위 에이전트 실행기. 비우면 Bun 전용 runPiAgent 를 지연 임포트한다 — 정적으로 걸면
   * oh-my-pi 코어가 모듈 그래프에 딸려 들어와 Node/vitest 에서 이 파일을 열 수 없다.
   */
  readonly runAgent?: RunPiAgentFn;
}

type AgentState = "실행 중" | "완료" | "실패";

interface AgentProgress {
  turns: number;
  toolCalls: number;
  toolErrors: number;
  lastLine: string;
}

interface AgentOutcome {
  readonly agentId: string;
  readonly mapId: string;
  readonly member: string;
  readonly phase: "work" | "fix";
  readonly ok: boolean;
  readonly summary: string;
  readonly changedKeys: readonly string[];
  readonly spills: readonly string[];
  readonly conflicts: readonly string[];
}

interface Inflight {
  readonly agentId: string;
  readonly promise: Promise<AgentOutcome>;
}

function text(body: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }] };
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 는 비어 있지 않은 문자열이어야 합니다`);
  return value.trim();
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim()) : [];
}

export async function runPiTeam(request: PiAgentRequest, options: RunPiTeamOptions = {}): Promise<PiAgentDoneEvent> {
  const runAgent: RunPiAgentFn = options.runAgent ?? (await import("./piAgentRuntime.ts")).runPiAgent;
  const emit = (event: PiAgentEvent) => options.onEvent?.(event);
  const base = request.project;
  let working: Project = structuredClone(base) as Project;
  const started = Date.now();
  const counters: Record<PiTeamRoleId, number> = { orchestrator: 0, builder: 0, reviewer: 0 };
  let toolCalls = 0;
  let toolErrors = 0;
  let subTurns = 0;
  let finished: string | null = null;

  const team = request.team ? normalizeTeamSpec(request.team) : defaultTeamSpec();
  const builders = enabledMembers(team, "builder");
  const reviewers = enabledMembers(team, "reviewer");
  if (builders.length === 0) throw Object.assign(new Error("팀에 켜진 시공 팀원이 없습니다. 팀 패널에서 팀원을 켜 주세요."), { status: 400 });

  let ledger: TeamAssignmentLedger = createTeamAssignmentLedger(teamAssignmentBudget(builders.length));
  const progress = new Map<string, AgentProgress>();
  const outcomes = new Map<string, AgentOutcome>();
  const inflight: Inflight[] = [];

  const pickMember = (id: unknown, pool: PiTeamMember[], what: string): PiTeamMember => {
    if (typeof id !== "string" || !id.trim()) return pool[0]!;
    const found = pool.find((member) => member.id === id.trim());
    if (!found) throw new Error(`${what} 팀원 '${id}' 이 없습니다. 가능: ${pool.map((member) => member.id).join(", ")}`);
    return found;
  };
  const candidateMaps = request.mapIds.length > 0 ? [...request.mapIds] : Object.keys(base.maps);
  const mapName = (id: string | null) => (id ? working.maps[id]?.name ?? null : null);
  const child = (agentId: string): RunPiAgentOptions => ({
    apiKey: options.apiKey,
    signal: options.signal,
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    onEvent: (event) => {
      const row = progress.get(agentId);
      if (row) {
        if (event.type === "turn") row.turns = event.index;
        else if (event.type === "tool_start") row.toolCalls += 1;
        else if (event.type === "tool_end") {
          if (!event.ok) row.toolErrors += 1;
          row.lastLine = `${event.ok ? "✓" : "✗"} ${event.name} — ${plainLine(event.summary)}`;
        } else if (event.type === "assistant") row.lastLine = plainLine(event.text, 220);
      }
      emit({ type: "agent_event", agentId, event });
    },
  });

  emit({ type: "team_start", task: request.task, roles: teamRoleSummaries() });

  /** 배정 하나의 결과를 작업 사본에 얹는다. 도착 순서대로 동기 실행되므로 서로 끼어들지 않는다. */
  function mergeOutcome(agentId: string, mapId: string, snapshot: Project, done: PiAgentDoneEvent): { spills: string[]; conflicts: string[] } {
    // 지금 다른 맵에서 도는 배정의 묶음을 건드렸는지 — 남의 작업 구역에 손을 댄 경우다.
    const busyMaps = new Set(runningAssignments(ledger).filter((assignment) => assignment.agentId !== agentId).map((assignment) => assignment.mapId));
    const bundle = new Set([...mapBundleIds(done.project, mapId), ...mapBundleIds(working, mapId)]);
    const conflicts = [...bundle].filter((id) => busyMaps.has(id)).sort();
    // 감사 기준은 병합 시점의 working 이 아니라 이 에이전트가 출발한 사본이다. 그 사이 남이
    // 병합한 맵을 이 에이전트의 범위 밖 변경으로 잘못 잡지 않기 위함.
    const merged = mergeMapBundles(working, [{ mapIds: [mapId], project: done.project, base: snapshot }]);
    working = merged.project;
    return { spills: merged.spills.flatMap((spill) => [...spill.keys]), conflicts };
  }

  function startAssign(mapId: string, task: string, member: PiTeamMember): AgentOutcome | Record<string, unknown> {
    if (!working.maps[mapId]) throw new Error(`맵 '${mapId}' 이 프로젝트에 없습니다. 후보: ${candidateMaps.join(", ")}`);
    const agentId = `builder-${counters.builder + 1}`;
    const claim = claimAssignment(ledger, { mapId, agentId, memberId: member.id });
    if (!claim.ok) throw new Error(claim.reason);
    counters.builder += 1;
    ledger = claim.ledger;
    const { phase, fixOf } = claim.assignment;
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
    emit({
      type: "agent_spawn", agentId, role: "builder", mapId, mapName: mapName(mapId), task,
      memberId: member.id, label: member.label, ...(fixOf ? { fixOf } : {}),
    });
    const snapshot = structuredClone(working) as Project;
    const promise = (async (): Promise<AgentOutcome> => {
      try {
        const done = await runAgent(
          {
            ...request, mode: "single", mapIds: [mapId], project: snapshot, task,
            systemPrompt: memberSystemPrompt(member, snapshot, [mapId]), maxTurns: member.maxTurns,
            ...(member.model ? { model: member.model } : {}),
            ...(member.toolDomains.length > 0 ? { toolDomains: member.toolDomains } : {}),
          },
          child(agentId),
        );
        const { spills, conflicts } = mergeOutcome(agentId, mapId, snapshot, done);
        ledger = settleAssignment(ledger, agentId, true);
        toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns;
        const summary = summaryOf(done);
        const outcome: AgentOutcome = { agentId, mapId, member: member.id, phase, ok: true, summary, changedKeys: done.changedKeys, spills, conflicts };
        outcomes.set(agentId, outcome);
        emit({ type: "agent_done", agentId, ok: true, summary, stats: done.stats, changedKeys: done.changedKeys, spills, conflicts });
        return outcome;
      } catch (error) {
        ledger = settleAssignment(ledger, agentId, false);
        const message = error instanceof Error ? error.message : String(error);
        const outcome: AgentOutcome = { agentId, mapId, member: member.id, phase, ok: false, summary: message, changedKeys: [], spills: [], conflicts: [] };
        outcomes.set(agentId, outcome);
        emit({ type: "agent_done", agentId, ok: false, summary: message, stats: { ms: 0, turns: 0, toolCalls: 0, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] });
        return outcome;
      }
    })();
    inflight.push({ agentId, promise });
    return { ok: true, agentId, mapId, member: member.id, phase, state: "실행 중" as AgentState };
  }

  function reportFor(agentId: string): Record<string, unknown> {
    const assignment = ledger.assignments.find((candidate) => candidate.agentId === agentId);
    const row = progress.get(agentId) ?? { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" };
    const outcome = outcomes.get(agentId);
    const state: AgentState = !outcome ? "실행 중" : outcome.ok ? "완료" : "실패";
    return {
      agentId, mapId: assignment?.mapId ?? null, member: assignment?.memberId ?? null, phase: assignment?.phase ?? null, state,
      turns: row.turns, toolCalls: row.toolCalls, toolErrors: row.toolErrors, lastLine: row.lastLine,
      ...(outcome ? { summary: outcome.summary, changedKeys: outcome.changedKeys, spills: outcome.spills, conflicts: outcome.conflicts } : {}),
    };
  }

  /** 비우면 지금까지 배정한 전부. 방금 끝난 배정도 포함해야 팀장이 결과를 받는다. */
  function selectAgents(raw: unknown): string[] {
    const wanted = idList(raw);
    return wanted.length > 0 ? wanted : ledger.assignments.map((assignment) => assignment.agentId);
  }

  async function review(mapId: string, focus: string | undefined, member: PiTeamMember): Promise<string> {
    if (!working.maps[mapId]) throw new Error(`맵 '${mapId}' 이 프로젝트에 없습니다`);
    const busy = runningAssignments(ledger).find((assignment) => assignment.mapId === mapId);
    if (busy) throw new Error(`맵 '${mapId}' 은 아직 ${busy.memberId}(${busy.agentId})가 작업 중입니다. wait_agents 로 끝난 뒤 검수하세요 — 반쯤 지어진 맵을 검수하면 엉뚱한 지적이 나옵니다.`);
    const agentId = `reviewer-${counters.reviewer + 1}`;
    counters.reviewer += 1;
    const task = focus ? `맵 '${mapId}' 검수. 특히: ${focus}` : `맵 '${mapId}' 의 시공 결과를 검수하라.`;
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
    emit({ type: "agent_spawn", agentId, role: "reviewer", mapId, mapName: mapName(mapId), task, memberId: member.id, label: member.label });
    let verdict: { ok: boolean; findings: string[] } | null = null;
    const reportTool: PiToolShape = {
      name: "report_review",
      label: "report_review",
      description: "검수 결론을 보고한다. ok 는 문제가 없을 때만 true. findings 는 고쳐야 할 점(좌표 포함) 목록.",
      parameters: { type: "object", properties: { ok: { type: "boolean" }, findings: { type: "array", items: { type: "string" } } }, required: ["ok", "findings"], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as { ok?: unknown; findings?: unknown };
        verdict = { ok: rec.ok === true, findings: Array.isArray(rec.findings) ? rec.findings.map(String).slice(0, 12) : [] };
        return text({ ok: true, recorded: true });
      },
    };
    const snapshot = structuredClone(working) as Project;
    const done = await runAgent(
      {
        ...request, mode: "single", mapIds: [mapId], project: snapshot, task,
        systemPrompt: memberSystemPrompt(member, snapshot, [mapId]), maxTurns: member.maxTurns,
        ...(member.model ? { model: member.model } : {}),
        ...(member.toolDomains.length > 0 ? { toolDomains: member.toolDomains } : {}),
      },
      { ...child(agentId), readOnlyTools: true, extraTools: [reportTool] },
    );
    toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns;
    const result = verdict ?? { ok: false, findings: ["검수 에이전트가 report_review 를 호출하지 않았습니다: " + summaryOf(done)] };
    ledger = recordTeamReview(ledger, { mapId, agentId, ok: result.ok });
    emit({ type: "review", agentId, mapId, ok: result.ok, findings: result.findings });
    emit({ type: "agent_done", agentId, ok: true, summary: result.ok ? "검수 통과" : `지적 ${result.findings.length}건`, stats: done.stats, changedKeys: [], spills: [], conflicts: [] });
    return JSON.stringify({ ok: result.ok, agentId, mapId, findings: result.findings });
  }

  const orchestratorTools: PiToolShape[] = [
    {
      name: "assign_map_agent",
      label: "assign_map_agent",
      description: `맵 하나에 시공 팀원을 붙이고 **곧바로 돌아온다**(끝날 때까지 기다리지 않는다). 한 턴에 여러 맵을 배정하면 함께 돈다. 같은 맵에는 한 번에 한 명만 붙는다 — 시공 뒤 장식처럼 이어 하려면 wait_agents 로 앞 팀원이 끝난 것을 확인한 뒤 배정한다. task 에는 그 맵에서 할 일을 위치·크기·재료까지 구체적으로 적는다. member 는 시공 팀원 id(${builders.map((m) => m.id).join(", ")}); 비우면 ${builders[0]!.id}.`,
      parameters: { type: "object", properties: { mapId: { type: "string" }, task: { type: "string" }, member: { type: "string", enum: builders.map((m) => m.id) } }, required: ["mapId", "task"], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as Record<string, unknown>;
        return text(startAssign(str(rec.mapId, "mapId"), str(rec.task, "task"), pickMember(rec.member, builders, "시공")));
      },
    },
    {
      name: "check_agents",
      label: "check_agents",
      description: "배정한 팀원들이 지금 무엇을 하고 있는지 본다(기다리지 않는다). 턴·툴콜·마지막 한 줄과 끝난 배정의 결과를 돌려준다. agentIds 를 비우면 전부.",
      parameters: { type: "object", properties: { agentIds: { type: "array", items: { type: "string" } } }, required: [], additionalProperties: false },
      async execute(_id, params) {
        const ids = selectAgents((params as Record<string, unknown>)?.agentIds);
        return text({ agents: ids.map(reportFor) });
      },
    },
    {
      name: "wait_agents",
      label: "wait_agents",
      description: "배정한 팀원이 끝날 때까지 기다렸다가 결과(요약·변경 키·범위 밖 변경)를 돌려준다. agentIds 를 비우면 진행 중인 배정 전부. 검수를 붙이거나 같은 맵에 다음 팀원을 배정하기 전에 부른다.",
      parameters: { type: "object", properties: { agentIds: { type: "array", items: { type: "string" } } }, required: [], additionalProperties: false },
      async execute(_id, params) {
        const ids = selectAgents((params as Record<string, unknown>)?.agentIds);
        await Promise.all(inflight.filter((entry) => ids.includes(entry.agentId)).map((entry) => entry.promise));
        return text({ agents: ids.map(reportFor) });
      },
    },
    {
      name: "review_map",
      label: "review_map",
      description: reviewers.length > 0
        ? `맵 하나를 검수 팀원에게 맡긴다(읽기 전용, 끝날 때까지 기다린다). ok 와 findings 를 돌려준다. 그 맵에 아직 작업 중인 팀원이 있으면 거절한다. member 는 검수 팀원 id(${reviewers.map((m) => m.id).join(", ")}); 비우면 ${reviewers[0]!.id}.`
        : "검수 팀원이 없다. 호출하면 실패한다 — finish 로 바로 보고하라.",
      parameters: { type: "object", properties: { mapId: { type: "string" }, focus: { type: "string" }, ...(reviewers.length > 0 ? { member: { type: "string", enum: reviewers.map((m) => m.id) } } : {}) }, required: ["mapId"], additionalProperties: false },
      async execute(_id, params) {
        if (reviewers.length === 0) throw new Error("팀에 켜진 검수 팀원이 없습니다. 검수를 건너뛰고 finish 하세요.");
        const rec = (params ?? {}) as Record<string, unknown>;
        return text(await review(str(rec.mapId, "mapId"), typeof rec.focus === "string" ? rec.focus : undefined, pickMember(rec.member, reviewers, "검수")));
      },
    },
    {
      name: "finish",
      label: "finish",
      description: "팀 작업을 끝낸다. report 에 무엇을 어디에 만들었고 검수가 어땠는지 한 문단으로 적는다. 진행 중인 배정이 있으면 거절한다 — wait_agents 를 먼저 부른다.",
      parameters: { type: "object", properties: { report: { type: "string" } }, required: ["report"], additionalProperties: false },
      async execute(_id, params) {
        const running = runningAssignments(ledger);
        if (running.length > 0) {
          throw new Error(`아직 ${running.map((assignment) => `${assignment.memberId}(${assignment.agentId}, ${assignment.mapId})`).join(", ")} 가 작업 중입니다. wait_agents 로 결과를 받은 뒤 보고하세요.`);
        }
        finished = str((params as Record<string, unknown>)?.report, "report");
        emit({ type: "team_report", text: finished });
        return text({ ok: true });
      },
    },
  ];

  const orchestratorId = `orchestrator-${++counters.orchestrator}`;
  progress.set(orchestratorId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
  emit({ type: "agent_spawn", agentId: orchestratorId, role: "orchestrator", mapId: null, mapName: null, task: request.task });
  const orch = PI_TEAM_ROLES.orchestrator;
  const orchDone = await runAgent(
    { ...request, mode: "single", mapIds: candidateMaps, project: working, systemPrompt: orch.systemPrompt(base, request.mapIds, request.task, team), maxTurns: orch.maxTurns },
    { ...child(orchestratorId), toolNames: orch.toolNames, extraTools: orchestratorTools },
  );
  // 팀장이 wait 없이 끝났을 수 있다(턴 상한·조기 finish 실패). 남은 배정을 거두어 병합한다 —
  // 여기서 놓치면 이미 끝난 시공 결과가 조용히 사라진다.
  await Promise.all(inflight.map((entry) => entry.promise));
  emit({ type: "agent_done", agentId: orchestratorId, ok: true, summary: finished ?? summaryOf(orchDone), stats: orchDone.stats, changedKeys: [], spills: [], conflicts: [] });
  if (!finished) emit({ type: "team_report", text: summaryOf(orchDone) || "팀장이 finish 를 호출하지 않고 끝났습니다." });

  const done: PiAgentDoneEvent = {
    type: "done",
    project: working,
    stats: { ms: Date.now() - started, turns: orchDone.stats.turns + subTurns, toolCalls: toolCalls + orchDone.stats.toolCalls, toolErrors: toolErrors + orchDone.stats.toolErrors, usage: orchDone.stats.usage },
    changedKeys: changedProjectKeys(base, working),
  };
  emit(done);
  return done;
}

function summaryOf(done: PiAgentDoneEvent): string {
  return `${done.changedKeys.length}개 키 변경 · ${done.stats.toolCalls}툴콜 · ${Math.round(done.stats.ms / 1000)}초`;
}
