// H2 인자 검사 재생 — 씬 벤치 판의 실패한 도구 호출(turns/*.json toolArgs·toolCalls)에 preCheck·retryCandidates 를 돌려
// «실행 전에 고쳤을 것 / 돌려보냈을 것 / 거절 뒤 다시 불렀을 것»을 센다. 모델 없이, 판 저장본(project/)만 읽는다.
//   bun scripts/qa/assistant-v2/argGuardReplay.mts <판 폴더 …>   (예: …/runs/omo-loop-1030b/g/terra/*/r*)
// 저장본은 판이 끝난 뒤 상태라 호출 당시와 이벤트 id 가 다를 수 있다 — 표의 «원래 실패» 열과 같이 읽는다.
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { preCheck, retryCandidates } from "../../../src/ai/v2/loop/argGuard.ts";
import type { Project } from "../../../src/project/types.ts";

const dirs = process.argv.slice(2);
let fails = 0, fixed = 0, rejected = 0, retried = 0;
for (const dir of dirs) {
  const turnsDir = path.join(dir, "session", "turns");
  if (!fs.existsSync(turnsDir)) continue;
  let project: Project;
  try { project = (await readProjectSqlite(path.join(dir, "project"))) as Project; } catch (error) { console.log(`# ${dir}: 저장본 못 읽음 ${String(error).slice(0, 80)}`); continue; }
  for (const f of fs.readdirSync(turnsDir).filter((n) => n.endsWith(".json"))) {
    const turn = JSON.parse(fs.readFileSync(path.join(turnsDir, f), "utf8")) as { toolCalls?: { type?: string; name: string; ok: boolean; summary: string }[]; toolArgs?: { name: string; args: unknown }[] };
    const ends = (turn.toolCalls ?? []).filter((c) => c.type === "tool_end");
    const args = turn.toolArgs ?? [];
    ends.forEach((c, i) => {
      if (c.ok || c.name === "todo") return;
      const a = args[i]?.name === c.name ? args[i]!.args : undefined;
      if (!a) return;
      fails += 1;
      const tool = getTool(c.name);
      const schema = tool?.parameters;
      const { todoId: _t, ...plain } = (a ?? {}) as Record<string, unknown>;
      const pre = preCheck(c.name, schema, plain, project);
      const line = `${path.basename(path.dirname(dir))}/${path.basename(dir)} ${c.name}: ${c.summary.replace(/\s+/gu, " ").slice(0, 110)}`;
      if (pre.kind === "reject") { rejected += 1; console.log(`돌려보냄  ${line}\n          → ${pre.message.slice(0, 220)}`); return; }
      if (pre.notes.length) { fixed += 1; console.log(`실행전고침 ${line}\n          → ${pre.notes.join(" · ").slice(0, 260)}`); return; }
      const cands = retryCandidates(c.name, schema, plain, c.summary, project);
      if (cands.length) { retried += 1; console.log(`다시부름  ${line}\n          → ${cands[0]!.note.slice(0, 220)}`); return; }
      console.log(`그대로    ${line}`);
    });
  }
}
console.log(`\n실패 호출 ${fails} — 실행 전 고침 ${fixed} · 돌려보냄 ${rejected} · 거절 뒤 다시 부름 후보 ${retried} · 그대로 ${fails - fixed - rejected - retried}`);
