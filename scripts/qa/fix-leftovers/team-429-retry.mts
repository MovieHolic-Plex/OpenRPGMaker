// 429 자동 재시도 증거(연애·JRPG 공통 팀 런타임): 시공 팀원이 429 로 죽은 채 팀장이 finish 하는 장면을 가짜 실행기로 재현한다. LLM 호출 없음.
//   bun scripts/qa/fix-leftovers/team-429-retry.mts [failTimes=1] [auto|off]   (off = origin/main 과 같은 «가드만» 동작을 보려고 재시도를 끈다)
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "../../../src/ai/piAgent/protocol";
import type { PiToolShape } from "../../../src/ai/piAgent/toolAdapter";
import type { PiTeamSpec } from "../../../src/ai/piAgent/teamSpec";
import { runPiTeam } from "../../lib/piTeamRuntime";

const failTimes = Number(process.argv[2] ?? 1);
const ctx = { project: createBlankProject() };
runTool(ctx, "create_map", { id: "map_a", name: "A(비어 있음)", width: 10, height: 10 });
const TEAM: PiTeamSpec = { version: 1, orchestratorNotes: "", members: [
  { id: "builder", label: "시공", kind: "builder", summary: "s", prompt: "p", toolDomains: [], maxTurns: 5, enabled: true },
  { id: "reviewer", label: "검수", kind: "reviewer", summary: "s", prompt: "p", toolDomains: [], maxTurns: 5, enabled: true },
] };
const done = (project: PiAgentRequest["project"], keys: string[] = []): PiAgentDoneEvent => ({ type: "done", project, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: keys });
const call = async (tools: readonly PiToolShape[], name: string, params: unknown) => JSON.parse((await tools.find((t) => t.name === name)!.execute("c", params)).content[0]!.text);
let builderRuns = 0; const log: string[] = [];
const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }) => {
  const extra = opts.extraTools ?? [];
  if (extra.some((t) => t.name === "assign_map_agent")) {
    await call(extra, "assign_map_agent", { mapId: "map_a", task: "집을 짓는다", member: "builder" });
    await call(extra, "wait_agents", {});
    log.push("팀장: finish 호출");
    try { await call(extra, "finish", { report: "끝" }); log.push("팀장: finish 수락"); } catch (error) { log.push(`팀장: finish 거절 → ${(error as Error).message.slice(0, 90)}…`); throw error; }
    return done(req.project);
  }
  if (extra.some((t) => t.name === "report_review")) { await extra.find((t) => t.name === "report_review")!.execute("c", { ok: true, findings: [] }); return done(req.project); }
  builderRuns += 1;
  if (builderRuns <= failTimes) { log.push(`시공 #${builderRuns}: 429 로 끊김`); throw new Error("429 All credentials for model gemini-4-argon-high are cooling down retry-after-ms=299000"); }
  log.push(`시공 #${builderRuns}: 성공${req.task.includes("자동 재시도") ? " (자동 재시도 문구 포함)" : ""}`);
  const next = structuredClone(req.project); next.maps.map_a = { ...next.maps.map_a!, name: "A(지어짐)" }; return done(next, ["maps.map_a"]);
};
const events: PiAgentEvent[] = [];
let result: PiAgentDoneEvent | undefined; let error = "";
try { result = await runPiTeam({ mode: "team", provider: "test", task: "마을을 지어라", mapIds: [], project: ctx.project, team: TEAM } as PiAgentRequest,
  { runAgent: runAgent as never, onEvent: (e) => events.push(e), rateLimitBackoffMs: () => 0 }); } catch (e) { error = (e as Error).message.slice(0, 120); }
for (const row of log) console.log(row);
for (const e of events) if (e.type === "agent_event" && e.event.type === "assistant" && /429|재시도/.test(e.event.text)) console.log(`[팀 알림] ${e.event.text.slice(0, 140)}`);
console.log(result ? `결과: map_a = ${result.project.maps.map_a!.name}; 시공 실행 ${builderRuns}회` : `결과: 팀 실행 실패 — ${error}; 시공 실행 ${builderRuns}회`);
