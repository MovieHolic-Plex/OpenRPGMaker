// 헤드리스 Pi 에이전트 CLI (Bun). 프로젝트 파일을 읽어 맵마다 에이전트 하나씩 병렬로 돌리고,
// 맵 묶음 병합 → commitChangeset 게이트 → 결과 프로젝트/보고서를 쓴다. 브라우저 없이 같은 툴·같은 게이트.
//
//   bun scripts/pi-agent.mts --project game.json --task "집 한 채와 길" --maps map_a,map_b --out out.json
//   bun scripts/pi-agent.mts --blank map_a:24x18,map_b:24x18 --task "..." --maps map_a,map_b
//
// 옵션: --provider google-antigravity|openai-codex  --model <id>  --report report.json  --max-turns N  --serial
//       --team  팀장 에이전트가 맵을 나눠 시공·검수 에이전트를 띄운다(--maps 는 후보 맵)  --team-spec team.json  팀원 명세
//       --current <mapId>  사용자가 보고 있는 맵(브라우저의 현재 맵과 같은 뜻). 팀장의 「여기」 기준이자 칩셋 계열 검사의 기준
//       --approve-tileset-family <계열>  사용자가 승인한 칩셋 계열(반복 가능, 예: castle). 이 계열로의 칩셋 변경을 허용한다
//       --log-args  툴 호출 인자(tool_start)를 4000자까지 로그에 남긴다 — 모델이 무엇을 넣었는지 사후 분석용

import fs from "node:fs";
import path from "node:path";
import { runPiAgent } from "./lib/piAgentRuntime.ts";
import { renderToolRegionPngBase64 } from "./qa-game/render.mts";
import { runPiTeam } from "./lib/piTeamRuntime.ts";
import { normalizeTeamSpec } from "../src/ai/piAgent/teamSpec.ts";
import { resolveRequestApiKey } from "./lib/aiAuthRuntime.ts";
import { loadHeadlessProject } from "../src/headless/index.ts";
import { createBlankProject } from "../src/project/defaults/defaultProject.ts";
import { runTool, commitChangeset } from "../src/editor/tools/index.ts";
import { mergeMapBundles } from "../src/ai/piAgent/mapBundle.ts";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent } from "../src/ai/piAgent/protocol.ts";
import type { Project } from "../src/project/types.ts";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
/** 반복 가능한 옵션의 값 전부(`--x a --x b` → [a, b]). */
function args(name: string): string[] {
  const values: string[] = [];
  process.argv.forEach((value, index) => {
    const next = process.argv[index + 1];
    if (value === `--${name}` && next && !next.startsWith("--")) values.push(next);
  });
  return values;
}

function loadProject(): Project {
  const file = arg("project");
  if (file) return loadHeadlessProject(fs.readFileSync(file, "utf8"));
  const blank = arg("blank");
  if (!blank) throw new Error("--project <file> 또는 --blank map_a:WxH,... 가 필요합니다");
  const ctx = { project: createBlankProject() };
  for (const spec of blank.split(",")) {
    const [id, size = "24x18"] = spec.split(":");
    const [w, h] = size.split("x").map(Number);
    const result = runTool(ctx, "create_map", { id, name: id, width: w, height: h });
    if (!result.ok) throw new Error(`create_map ${id}: ${result.summary}`);
  }
  return ctx.project;
}

function logEvent(label: string, event: PiAgentEvent) {
  const prefix = label ? `[${label}] ` : "";
  if (event.type === "agent_spawn") { console.log(`${prefix}spawn ${event.agentId} (${event.label ?? event.role}) ${event.mapId ?? ""}${event.fixOf ? ` [수정←${event.fixOf}]` : ""} — ${event.task.slice(0, 120)}`); return; }
  if (event.type === "agent_event") { logEvent(event.agentId, event.event); return; }
  if (event.type === "agent_done") { console.log(`${prefix}done ${event.agentId} ok=${event.ok} ${event.summary}${event.spills.length ? ` spills=${event.spills.join(",")}` : ""}`); return; }
  if (event.type === "review") { console.log(`${prefix}review ${event.mapId} ok=${event.ok} ${event.findings.join(" | ")}`); return; }
  if (event.type === "team_report") { console.log(`${prefix}REPORT ${event.text}`); return; }
  if (event.type === "start") console.log(`${prefix}start ${event.provider}/${event.model} tools=${event.toolCount}`);
  else if (event.type === "tool_start" && flag("log-args")) console.log(`${prefix}  ARGS ${event.name} ${JSON.stringify(event.args).slice(0, 4000)}`);
  else if (event.type === "tool_end") console.log(`${prefix}  ${event.ok ? "OK  " : "FAIL"} ${event.name} — ${event.summary}`);
  else if (event.type === "assistant") console.log(`${prefix}assistant: ${event.text.replace(/\n/g, " ").slice(0, 300)}`);
  else if (event.type === "error") console.log(`${prefix}ERROR ${event.message.slice(0, 400)}`);
}

async function main() {
  const task = arg("task");
  if (!task) throw new Error("--task 가 필요합니다");
  const provider = arg("provider", "google-antigravity")!;
  const model = arg("model");
  const maxTurns = arg("max-turns") ? Number(arg("max-turns")) : undefined;
  const mapIds = (arg("maps") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const currentMapId = arg("current");
  const base = loadProject();
  if (currentMapId && !base.maps[currentMapId]) throw new Error(`--current 맵이 프로젝트에 없습니다: ${currentMapId}`);
  const approvedTilesetFamilies = args("approve-tileset-family");
  const here = {
    ...(currentMapId ? { currentMapId } : {}),
    ...(approvedTilesetFamilies.length ? { approvedTilesetFamilies } : {}),
  };
  const apiKey = await resolveRequestApiKey(provider);
  const groups = mapIds.length > 0 ? mapIds.map((id) => [id]) : [[] as string[]];
  const started = Date.now();
  // 브라우저는 캔버스로 show_map_region 이미지를 그린다. 헤드리스는 qa-game 과 같은 타일 렌더러(pngjs, 1→2→그림자→3→4층)로
  // 대신한다 — 넘기지 않으면 런타임이 「맵 이미지 전달 경로가 없습니다」로 호출을 실패시킨다(gen.mts 선례).
  const renderToolImage = async (project: Project, _toolName: string, data: unknown) => renderToolRegionPngBase64(project, data);
  const run = (ids: string[]) => runPiAgent(
    { provider, model, task, mapIds: ids, ...here, project: base, maxTurns },
    { apiKey, renderToolImage, onEvent: (event) => logEvent(groups.length > 1 ? ids.join(",") : "", event) },
  );
  const results: PiAgentDoneEvent[] = [];
  const team = flag("team");
  const teamSpec = arg("team-spec") ? normalizeTeamSpec(JSON.parse(fs.readFileSync(arg("team-spec")!, "utf8"))) : undefined;
  if (team) results.push(await runPiTeam({ mode: "team", provider, model, task, mapIds, ...here, project: base, ...(teamSpec ? { team: teamSpec } : {}) }, { apiKey, renderToolImage, onEvent: (event) => logEvent("", event) }));
  else if (flag("serial")) for (const ids of groups) results.push(await run(ids));
  else results.push(...await Promise.all(groups.map(run)));

  const merged = mapIds.length > 0 && !team
    ? mergeMapBundles(base, results.map((done, index) => ({ mapIds: groups[index]!, project: done.project })))
    : { project: results[0]!.project, spills: [] as never[], conflicts: [] as string[] };
  const gate = commitChangeset(merged.project, base);
  const report = {
    provider, model: model ?? null, task, mapIds, team, ms: Date.now() - started,
    agents: results.map((done, index) => ({ mapIds: team ? mapIds : groups[index], ...done.stats, changedKeys: done.changedKeys })),
    spills: merged.spills,
    conflicts: merged.conflicts,
    changedKeys: changedProjectKeys(base, merged.project),
    gate: { ok: gate.ok, issues: (gate as { issues?: unknown[] }).issues?.slice(0, 10) ?? [] },
  };
  const out = arg("out");
  if (out && gate.ok) fs.writeFileSync(out, JSON.stringify(merged.project));
  const reportPath = arg("report");
  if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify(report, null, 2));
  if (!gate.ok) process.exit(2);
}

main().catch((error) => { console.error("[pi-agent] 실패:", error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
