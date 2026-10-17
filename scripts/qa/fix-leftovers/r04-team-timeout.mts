// R04 증거: 팀 실행의 timeoutMs 가 하위 에이전트마다 통째로 걸리는지, 팀 전체 상한으로 줄어드는지 본다.
// 사용: bun scripts/qa/fix-leftovers/r04-team-timeout.mts [런타임 모듈 경로(기본 ../../lib/piTeamRuntime.ts)]
// 가짜 실행기가 정해진 시간만큼 자고 «받은 timeoutMs» 와 «팀 시작 뒤 경과» 를 기록한다. LLM 호출 없음.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools";
import type { PiAgentDoneEvent, PiAgentRequest } from "../../../src/ai/piAgent/protocol";
import type { PiToolShape } from "../../../src/ai/piAgent/toolAdapter";
import type { PiTeamSpec } from "../../../src/ai/piAgent/teamSpec";

const modulePath = process.argv[2] ?? "../../lib/piTeamRuntime.ts";
const { runPiTeam } = await import(modulePath) as typeof import("../../lib/piTeamRuntime");

const ctx = { project: createBlankProject() };
runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
const TEAM: PiTeamSpec = { version: 1, orchestratorNotes: "", members: [
  { id: "builder", label: "시공", kind: "builder", summary: "s", prompt: "p", toolDomains: [], maxTurns: 5, enabled: true },
  { id: "reviewer", label: "검수", kind: "reviewer", summary: "s", prompt: "p", toolDomains: [], maxTurns: 5, enabled: true },
] };
const CAP = 3000;
const t0 = Date.now();
const rows: string[] = [];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const done = (project: PiAgentRequest["project"]): PiAgentDoneEvent => ({ type: "done", project, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [] });
const call = async (tools: readonly PiToolShape[], name: string, params: unknown) => JSON.parse((await tools.find((t) => t.name === name)!.execute("c", params)).content[0]!.text);

const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[]; timeoutMs?: number }) => {
  const extra = opts.extraTools ?? [];
  const role = extra.some((t) => t.name === "assign_map_agent") ? "팀장" : extra.some((t) => t.name === "report_review") ? "검수" : "시공";
  rows.push(`${role.padEnd(2)} 시작 +${String(Date.now() - t0).padStart(4)}ms  받은 상한 ${String(opts.timeoutMs).padStart(5)}ms  → 이 에이전트가 끝날 수 있는 가장 늦은 시각 +${Date.now() - t0 + (opts.timeoutMs ?? 0)}ms`);
  if (role === "팀장") {
    await sleep(1200);
    await call(extra, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
    await call(extra, "wait_agents", {});
    await call(extra, "review_map", { mapId: "map_a" });
    await call(extra, "finish", { report: "끝" });
  } else if (role === "검수") {
    await sleep(100);
    await extra.find((t) => t.name === "report_review")!.execute("c", { ok: true, findings: [] });
  } else await sleep(900);
  return done(req.project);
};
await runPiTeam({ mode: "team", provider: "test", task: "마을을 지어라", mapIds: [], project: ctx.project, team: TEAM, timeoutMs: CAP } as PiAgentRequest,
  { runAgent: runAgent as never, timeoutMs: CAP });
console.log(`팀 상한 ${CAP}ms — 모듈 ${modulePath}`);
for (const row of rows) console.log(row);
const worst = Math.max(...rows.map((r) => Number(r.match(/가장 늦은 시각 \+(\d+)ms/)![1])));
console.log(`가장 늦게 끝날 수 있는 시각 +${worst}ms → 팀 상한 ${CAP}ms ${worst <= CAP + 50 ? "안" : "초과(" + (worst - CAP) + "ms)"}`);
