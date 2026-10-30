// v2 거절 글 재생 — 씬 벤치 판의 실패한 편집기 도구 호출(turns/*.json toolCalls·toolArgs)을 판 저장본(project/)에서 다시 실행해
// 모델이 받던 글(toolAdapter.formatPiToolFailure — 예전 그대로)과 v2 가 이제 싣는 글(loop/failureText.ts)을 나란히 찍는다. 모델 없음.
//   bun scripts/qa/assistant-v2/failureTextReplay.mts [--limit N] <판 폴더 …>   (예: …/runs/omo-loop-1030b/g/terra/*/r*) — tsx 는 편집기 도구가 끌어오는 .css 를 못 읽어 bun 으로 돈다(argGuardReplay 와 같다)
// 저장본은 판이 끝난 뒤 상태라 같은 호출이 이제는 통과할 수 있다 — 그때는 기록된 요약(잘린 한 줄)을 거절 본문으로 쓰고 «재현 안 됨»이라 적는다.
// «이제»의 고친 호출은 모델이 보낸 원래 인자에서 계산한다(실행 중에는 H2 가 같은 고침을 실행 전에 이미 적용해 거절 자체가 안 난다).
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { runTool } from "../../../src/editor/tools/toolRunner.ts";
import { formatPiToolFailure } from "../../../src/ai/piAgent/toolAdapter.ts";
import { correctionFor, englishVerbFailureHead, formatV2Failure } from "../../../src/ai/v2/loop/failureText.ts";
import { withTransferRelocation } from "../../../src/ai/v2/game.ts";
import type { PiToolShape } from "../../../src/ai/piAgent/toolAdapter.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const li = argv.indexOf("--limit");
const limit = li >= 0 ? Number(argv[li + 1]) : 12;
const dirs = argv.filter((a, i) => a !== "--limit" && i !== li + 1);
const seen = new Set<string>();
let shown = 0;
outer: for (const dir of dirs) {
  const turnsDir = path.join(dir, "session", "turns");
  if (!fs.existsSync(turnsDir)) continue;
  let project: Project;
  try { project = (await readProjectSqlite(path.join(dir, "project"))) as Project; } catch (error) { console.log(`# ${dir}: 저장본 못 읽음 ${String(error).slice(0, 80)}`); continue; }
  for (const f of fs.readdirSync(turnsDir).filter((n) => n.endsWith(".json")).sort()) {
    const turn = JSON.parse(fs.readFileSync(path.join(turnsDir, f), "utf8")) as { toolCalls?: { type?: string; name: string; ok: boolean; summary: string }[]; toolArgs?: { name: string; args: unknown }[] };
    const ends = (turn.toolCalls ?? []).filter((c) => c.type === "tool_end");
    const args = turn.toolArgs ?? [];
    for (let i = 0; i < ends.length; i++) {
      const c = ends[i]!;
      const tool = getTool(c.name);
      if (c.ok || c.name === "todo") continue;
      if (!tool) {
        // v2 동사(edit_place 등): 표에 있는 거절만 영어 머리를 단다.
        const sig = `${c.name}:${c.summary.replace(/\d+/gu, "#").replace(/(ev|map)_[\w-]+/gu, "@").slice(0, 40)}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        const before = JSON.stringify({ ok: false, summary: c.summary });
        const head = englishVerbFailureHead(c.name, before);
        shown += 1;
        console.log(`\n=== ${shown}. ${path.basename(path.dirname(dir))}/${path.basename(dir)} ${c.name} (v2 verb — recorded summary)`);
        console.log(`--- before (${before.length} chars)\n${before}`);
        console.log(`--- after${head ? "" : " (unchanged — no rule)"}\n${head ? `${head}\n${before}` : before}`);
        if (shown >= limit) break outer;
        continue;
      }
      const a = args[i]?.name === c.name ? args[i]!.args : undefined;
      if (!a || typeof a !== "object") continue;
      const { todoId: _t, ...sent } = a as Record<string, unknown>;
      // 같은 거절 문장(숫자·id 가림)은 한 번만.
      const sig = `${c.name}:${c.summary.replace(/\d+/gu, "#").replace(/(ev|map)_[\w-]+/gu, "@").slice(0, 90)}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const ctx = { project, assistantRun: true } as Parameters<typeof runTool>[0];
      let before: string;
      let reproduced = true;
      try {
        const r = runTool(ctx, c.name, sent, { dryRun: true });
        if (r.ok) { reproduced = false; before = JSON.stringify({ ok: false, summary: c.summary }); }
        else before = formatPiToolFailure(r);
      } catch (error) { reproduced = false; before = JSON.stringify({ ok: false, summary: c.summary }); void error; }
      const correction = correctionFor(c.name, tool.parameters, sent, before, project);
      const after = formatV2Failure({ tool: c.name, sent, failText: before, ...(correction ? { correction } : {}) });
      shown += 1;
      console.log(`\n=== ${shown}. ${path.basename(path.dirname(dir))}/${path.basename(dir)} ${c.name}${reproduced ? "" : " (not reproducible on the saved project — recorded summary)"}`);
      console.log(`--- before (${before.length} chars)\n${before}`);
      console.log(`--- after (${after.length} chars)\n${after}`);
      if (shown >= limit) break outer;
    }
  }
}
console.log(`\n${shown} examples`);

// 결과 표시(tool_end) 점검: create_transfer_pair 가 doorAt 으로 거절된 뒤 자리 옮겨 이으면, 같은 호출 id 의 마지막 기록이 성공이어야 한다.
{
  const records = new Map<string, { ok: boolean; summary: string }>();
  const fake: PiToolShape = { name: "create_transfer_pair", label: "create_transfer_pair", description: "", parameters: {},
    async execute(id, params) {
      const p = params as { a?: { doorAt?: unknown } };
      if (p.a?.doorAt) {
        const fail = { ok: false, summary: "'create_transfer_pair' 실행 실패: 문앞 (24,7)에 안전한 출입구를 만들 수 없습니다: 시작 위치·기존 입구에서 닿는 문앞과 인접 착지 칸이 필요합니다", issues: [{ severity: "error", code: "transfer-unsafe", message: "문앞 (24,7)에 안전한 출입구를 만들 수 없습니다: 시작 위치·기존 입구에서 닿는 문앞과 인접 착지 칸이 필요합니다" }] };
        records.set(id, fail);
        throw new Error(JSON.stringify(fail));
      }
      records.set(id, { ok: true, summary: "출입구 쌍 생성: 던전(24,8) ↔ 보스 방(10,18)" });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, summary: "출입구 쌍 생성: 던전(24,8) ↔ 보스 방(10,18)" }) }] };
    } };
  const [wrapped] = withTransferRelocation([fake]);
  const out = await wrapped!.execute("call-1", { a: { mapId: "m1", x: 24, y: 8, doorAt: { x: 24, y: 7 } }, b: { mapId: "m2", x: 10, y: 18 } });
  console.log(`\n=== tool_end label check (withTransferRelocation): last record for call-1 ok=${records.get("call-1")?.ok} — ${records.get("call-1")?.summary}`);
  console.log(out.content.map((c) => (c as { text?: string }).text).join("\n"));
}
