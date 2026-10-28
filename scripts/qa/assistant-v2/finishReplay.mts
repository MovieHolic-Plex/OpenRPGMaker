// 끝맺음 재생(모델 없음): 저장된 조수 게임(project.sqlite)을 지금 코드의 끝맺음 자동 단계(장소 → 경로 → 출구·이동 칸 마감)에 다시 통과시키고
// 전/후 게임 검사(자동 플레이 포함)를 비교한다. 「옛 배포본에서 엔딩에 못 간 판이 지금 코드로는 가는가」를 장르별로 본다.
//   bun scripts/qa/assistant-v2/finishReplay.mts <run-dir>... [--out <dir>]
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { walkBlueprint } from "../../../src/ai/v2/blueprint.ts";
import { runGameCheck } from "../../../src/qa/gameCheck/index.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const out = outAt >= 0 ? argv[outAt + 1]! : "qa-runs/v2scratch/finish-replay";
const dirs = argv.filter((a, i) => a !== "--out" && i !== outAt + 1);
fs.mkdirSync(out, { recursive: true });

const brief = (project: Project) => {
  const r = runGameCheck(project, { autoPlayBudgetMs: 30_000 });
  const blockers = r.findings.filter((f) => f.severity === "blocker").map((f) => `[${f.code}] ${f.message.slice(0, 200)}`);
  const run = r.autoPlay?.runs?.[0];
  return { blockers, auto: run ? `${run.ok ? "성공" : "실패"} 엔딩=${run.endingReached ?? "-"}${run.failure ? ` · ${run.failure.goal}: ${run.failure.detail.slice(0, 220)}` : ""}` : (r.autoPlay?.skipped ?? "자동 플레이 없음"), bp: walkBlueprint(project).blockers.map((b) => b.id) };
};

for (const dir of dirs) {
  const name = path.basename(dir);
  const project = readProjectSqlite(path.join(dir, "project"));
  const task = fs.existsSync(path.join(dir, "steps.log")) ? (fs.readFileSync(path.join(dir, "steps.log"), "utf8").match(/sent 001\.txt: (.*)/u)?.[1] ?? "게임 만들어 줘") : "게임 만들어 줘";
  const before = brief(project);
  const ctx = { project: structuredClone(project), currentMapId: project.startMapId, assistantRun: true };
  const env = {
    ctx, request: { task, project, currentMapId: project.startMapId } as never,
    emit: () => {}, record: () => {}, sideChat: async () => { throw new Error("모델 없음"); }, checkpoint: async () => {},
  } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  createV2Tools(env, session);
  const notes: string[] = [];
  try {
    if (ctx.project.gameBlueprint) {
      let walked = walkBlueprint(ctx.project).blockers;
      if (walked.some((b) => b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable")) notes.push(`장소: ${(await session.buildPlaces!()).join(" / ").slice(0, 300)}`);
      walked = walkBlueprint(ctx.project).blockers;
      if (walked.length) { const r = await session.buildPath!(walked.map((b) => b.id).join(",")); notes.push(`경로: ${r.ok ? "" : "실패 "}${r.summary.slice(0, 300)}`); }
      const lanes = await session.clearLanes!();
      if (lanes.length) notes.push(`마감: ${lanes.join(" / ").slice(0, 300)}`);
    } else notes.push("청사진 없음 — 끝맺음 자동 단계가 돌지 않는다");
  } catch (e) { notes.push(`예외: ${(e as Error).stack?.slice(0, 400)}`); }
  const after = brief(ctx.project);
  const rec = { name, task, before, notes, after };
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(rec, null, 1));
  fs.writeFileSync(path.join(out, `${name}.project.json`), JSON.stringify(ctx.project));
  console.log(`\n### ${name}\n  전: 막힘 ${before.blockers.length} ${before.blockers.map((b) => b.slice(0, 120)).join(" | ")}\n      자동 ${before.auto}\n      청사진 ${before.bp.join(",") || "-"}\n  끝맺음: ${notes.join("\n          ")}\n  후: 막힘 ${after.blockers.length} ${after.blockers.map((b) => b.slice(0, 160)).join(" | ")}\n      자동 ${after.auto}\n      청사진 ${after.bp.join(",") || "-"}`);
}
