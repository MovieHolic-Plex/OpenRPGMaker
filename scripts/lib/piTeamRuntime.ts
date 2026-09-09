// Bun 전용 Pi 팀 런타임. 팀장 에이전트(orchestrator)가 커스텀 툴로 시공·검수 에이전트를 띄운다.
// 하위 에이전트는 runPiAgent 를 그대로 재사용하고, 시공 결과는 맵 묶음 단위로 작업 사본(working)에
// 순서대로 병합된다. 같은 턴의 assign_map_agent 여러 개는 코어가 병렬로 실행한다(concurrency: shared).

import { mergeMapBundles } from "../../src/ai/piAgent/mapBundle.ts";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest, type PiTeamRoleId } from "../../src/ai/piAgent/protocol.ts";
import { PI_TEAM_ROLES, teamRoleSummaries } from "../../src/ai/piAgent/team.ts";
import type { PiToolShape } from "../../src/ai/piAgent/toolAdapter.ts";
import type { Project } from "../../src/project/types.ts";
import { runPiAgent, type RunPiAgentOptions } from "./piAgentRuntime.ts";

const MAX_FIX_ROUNDS_PER_MAP = 2;

function text(body: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }] };
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 는 비어 있지 않은 문자열이어야 합니다`);
  return value.trim();
}

export async function runPiTeam(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const emit = (event: PiAgentEvent) => options.onEvent?.(event);
  const base = request.project;
  let working: Project = structuredClone(base) as Project;
  const started = Date.now();
  const counters: Record<PiTeamRoleId, number> = { orchestrator: 0, builder: 0, reviewer: 0 };
  const fixRounds = new Map<string, number>();
  const conflictsSeen = new Set<string>();
  let toolCalls = 0;
  let toolErrors = 0;
  let subTurns = 0;
  let finished: string | null = null;

  const candidateMaps = request.mapIds.length > 0 ? [...request.mapIds] : Object.keys(base.maps);
  const mapName = (id: string | null) => (id ? working.maps[id]?.name ?? null : null);
  const nextId = (role: PiTeamRoleId) => `${role}-${++counters[role]}`;
  const child = (agentId: string): RunPiAgentOptions => ({
    apiKey: options.apiKey,
    signal: options.signal,
    onEvent: (event) => emit({ type: "agent_event", agentId, event }),
  });

  emit({ type: "team_start", task: request.task, roles: teamRoleSummaries() });

  async function assign(mapId: string, task: string): Promise<string> {
    if (!working.maps[mapId]) throw new Error(`맵 '${mapId}' 이 프로젝트에 없습니다. 후보: ${candidateMaps.join(", ")}`);
    const agentId = nextId("builder");
    emit({ type: "agent_spawn", agentId, role: "builder", mapId, mapName: mapName(mapId), task });
    const role = PI_TEAM_ROLES.builder;
    const snapshot = structuredClone(working) as Project;
    try {
      const done = await runPiAgent(
        { ...request, mode: "single", mapIds: [mapId], project: snapshot, systemPrompt: role.systemPrompt(snapshot, [mapId], task), maxTurns: role.maxTurns, task },
        child(agentId),
      );
      const merged = mergeMapBundles(working, [{ mapIds: [mapId], project: done.project }]);
      working = merged.project;
      for (const id of merged.conflicts) conflictsSeen.add(id);
      toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns;
      const spills = merged.spills.flatMap((spill) => spill.keys);
      const summary = summaryOf(done);
      emit({ type: "agent_done", agentId, ok: true, summary, stats: done.stats, changedKeys: done.changedKeys, spills, conflicts: merged.conflicts });
      return JSON.stringify({ ok: true, agentId, mapId, summary, changedKeys: done.changedKeys, spills, toolCalls: done.stats.toolCalls, toolErrors: done.stats.toolErrors });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ type: "agent_done", agentId, ok: false, summary: message, stats: { ms: 0, turns: 0, toolCalls: 0, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] });
      throw new Error(JSON.stringify({ ok: false, agentId, mapId, error: message }));
    }
  }

  async function review(mapId: string, focus: string | undefined): Promise<string> {
    if (!working.maps[mapId]) throw new Error(`맵 '${mapId}' 이 프로젝트에 없습니다`);
    const agentId = nextId("reviewer");
    const task = focus ? `맵 '${mapId}' 검수. 특히: ${focus}` : `맵 '${mapId}' 의 시공 결과를 검수하라.`;
    emit({ type: "agent_spawn", agentId, role: "reviewer", mapId, mapName: mapName(mapId), task });
    const role = PI_TEAM_ROLES.reviewer;
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
    const done = await runPiAgent(
      { ...request, mode: "single", mapIds: [mapId], project: snapshot, systemPrompt: role.systemPrompt(snapshot, [mapId], task), maxTurns: role.maxTurns, task },
      { ...child(agentId), readOnlyTools: true, extraTools: [reportTool] },
    );
    toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns;
    const result = verdict ?? { ok: false, findings: ["검수 에이전트가 report_review 를 호출하지 않았습니다: " + summaryOf(done)] };
    emit({ type: "review", agentId, mapId, ok: result.ok, findings: result.findings });
    emit({ type: "agent_done", agentId, ok: true, summary: result.ok ? "검수 통과" : `지적 ${result.findings.length}건`, stats: done.stats, changedKeys: [], spills: [], conflicts: [] });
    return JSON.stringify({ ok: result.ok, mapId, findings: result.findings });
  }

  const orchestratorTools: PiToolShape[] = [
    {
      name: "assign_map_agent",
      label: "assign_map_agent",
      description: "맵 하나에 시공 에이전트를 띄운다. 한 턴에 여러 개 호출하면 병렬로 돈다. task 에는 그 맵에서 할 일을 위치·크기·재료까지 구체적으로 적는다. 결과 요약과 변경 키를 돌려준다.",
      parameters: { type: "object", properties: { mapId: { type: "string" }, task: { type: "string" } }, required: ["mapId", "task"], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as Record<string, unknown>;
        const mapId = str(rec.mapId, "mapId");
        const rounds = (fixRounds.get(mapId) ?? -1) + 1;
        if (rounds > MAX_FIX_ROUNDS_PER_MAP) throw new Error(`맵 '${mapId}' 은 이미 수정 ${MAX_FIX_ROUNDS_PER_MAP}회를 썼습니다. finish 로 현재 상태를 보고하세요.`);
        fixRounds.set(mapId, rounds);
        return text(await assign(mapId, str(rec.task, "task")));
      },
    },
    {
      name: "review_map",
      label: "review_map",
      description: "맵 하나를 검수 에이전트에게 맡긴다(읽기 전용). ok 와 findings 를 돌려준다. 여러 맵은 한 턴에 병렬로 호출한다.",
      parameters: { type: "object", properties: { mapId: { type: "string" }, focus: { type: "string" } }, required: ["mapId"], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as Record<string, unknown>;
        return text(await review(str(rec.mapId, "mapId"), typeof rec.focus === "string" ? rec.focus : undefined));
      },
    },
    {
      name: "finish",
      label: "finish",
      description: "팀 작업을 끝낸다. report 에 무엇을 어디에 만들었고 검수가 어땠는지 한 문단으로 적는다. 이 호출 뒤에는 더 할 일이 없다.",
      parameters: { type: "object", properties: { report: { type: "string" } }, required: ["report"], additionalProperties: false },
      async execute(_id, params) {
        finished = str((params as Record<string, unknown>)?.report, "report");
        emit({ type: "team_report", text: finished });
        return text({ ok: true });
      },
    },
  ];

  const orchestratorId = nextId("orchestrator");
  emit({ type: "agent_spawn", agentId: orchestratorId, role: "orchestrator", mapId: null, mapName: null, task: request.task });
  const orch = PI_TEAM_ROLES.orchestrator;
  const orchDone = await runPiAgent(
    { ...request, mode: "single", mapIds: candidateMaps, project: working, systemPrompt: orch.systemPrompt(base, request.mapIds, request.task), maxTurns: orch.maxTurns },
    { ...child(orchestratorId), toolNames: orch.toolNames, extraTools: orchestratorTools },
  );
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
