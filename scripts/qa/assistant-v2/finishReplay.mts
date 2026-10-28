// 끝맺음 재생(모델 없음): 저장된 조수 게임(project.sqlite)을 지금 코드의 끝맺음 자동 단계 — 실행기와 같은 함수 runFinishAutoBuild
// (장소 → 경로·회복 길 → 출구·이동 칸 마감 → 조립 기본값 → 출하 기본값) — 에 다시 통과시키고
// 전/후 게임 검사(자동 플레이 포함)를 비교한다. 「옛 배포본에서 엔딩에 못 간 판이 지금 코드로는 가는가」를 장르별로 본다.
//   bun scripts/qa/assistant-v2/finishReplay.mts <run-dir>... [--out <dir>] [--followup <마지막 차례 글>]
// --followup 을 주면 끝맺음이 도는 마지막 차례처럼 그 글 + 첫 요청 메모(composePiTask·priorRequestsNote — 편집기와 같은 합치기)를 요청 글로 쓴다.
// 주지 않으면 첫 요청 글(steps.log 의 001)만 — 「RPG 만들어 줘」처럼 «게임» 낱말이 없는 첫 요청은 출하 검사·조립이 돌지 않는다.
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { walkBlueprint } from "../../../src/ai/v2/blueprint.ts";
import { runFinishAutoBuild } from "../../../src/ai/v2/finishAutoBuild.ts";
import { shipBlockers } from "../../../src/ai/v2/shipChecks.ts";
import { runGameCheck } from "../../../src/qa/gameCheck/index.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { Project } from "../../../src/project/types.ts";
import { composePiTask } from "../../../src/ai/piAgent/executionRoute.ts";
import { priorRequestsNote } from "../../../src/ai/v2/priorRequests.ts";

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const out = outAt >= 0 ? argv[outAt + 1]! : "qa-runs/v2scratch/finish-replay";
const followAt = argv.indexOf("--followup");
const followup = followAt >= 0 ? argv[followAt + 1] : undefined;
const dirs = argv.filter((a, i) => a !== "--out" && i !== outAt + 1 && a !== "--followup" && (followAt < 0 || i !== followAt + 1));
fs.mkdirSync(out, { recursive: true });

const brief = (project: Project, task: string) => {
  const r = runGameCheck(project, { autoPlayBudgetMs: 30_000 });
  const blockers = r.findings.filter((f) => f.severity === "blocker").map((f) => `[${f.code}] ${f.message.slice(0, 200)}`);
  const run = r.autoPlay?.runs?.[0];
  return { blockers, auto: run ? `${run.ok ? "성공" : "실패"} 엔딩=${run.endingReached ?? "-"}${run.failure ? ` · ${run.failure.goal}: ${run.failure.detail.slice(0, 220)}` : ""}` : (r.autoPlay?.skipped ?? "자동 플레이 없음"), bp: walkBlueprint(project).blockers.map((b) => b.id), ship: shipBlockers(project, task).map((b) => b.id) };
};

/**
 * 판의 첫 요청 원문 — 스위트 판(runs/<묶음>/<모델>/<프롬프트 id>)이면 suite/prompts.json 의 그 id 문구, 아니면 세션 done/001.txt, 마지막으로 steps.log.
 * steps.log 의 「sent 001.txt: …」 줄은 잘린다(「…판타지 RPG 만들어 」) — 그걸 쓰면 게임 전체 요청 판정이 달라져 끝맺음 조립이 안 돈다(2026-10-29).
 */
function firstRequest(dir: string): string {
  const abs = path.resolve(dir);
  const promptsFile = path.join(abs, "..", "..", "..", "..", "prompts.json");
  if (fs.existsSync(promptsFile)) {
    const raw = JSON.parse(fs.readFileSync(promptsFile, "utf8")) as { prompts?: { id: string; text: string }[] } | { id: string; text: string }[];
    const hit = (Array.isArray(raw) ? raw : raw.prompts ?? []).find((p) => p.id === path.basename(abs));
    if (hit?.text) return hit.text;
  }
  const done = path.join(abs, "session", "done", "001.txt");
  if (fs.existsSync(done)) return fs.readFileSync(done, "utf8").trim();
  return fs.existsSync(path.join(abs, "steps.log")) ? (fs.readFileSync(path.join(abs, "steps.log"), "utf8").match(/sent 001\.txt: (.*)/u)?.[1] ?? "게임 만들어 줘") : "게임 만들어 줘";
}

for (const dir of dirs) {
  const name = `${path.basename(path.dirname(path.resolve(dir)))}-${path.basename(dir)}`;
  const project = readProjectSqlite(path.join(dir, "project"));
  const first = firstRequest(dir);
  const task = followup ? composePiTask(followup, priorRequestsNote([{ kind: "user", text: first } as never], followup)) : first;
  const before = brief(project, task);
  const ctx = { project: structuredClone(project), currentMapId: project.startMapId, assistantRun: true };
  const env = {
    ctx, request: { task, project, currentMapId: project.startMapId } as never,
    emit: () => {}, record: () => {}, sideChat: async () => { throw new Error("모델 없음"); }, checkpoint: async () => {},
  } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  createV2Tools(env, session);
  const notes: string[] = [];
  try {
    const auto = await runFinishAutoBuild(env, session);
    if (auto) notes.push(auto.split("\n").filter((l) => l.startsWith("- ")).join(" / ").slice(0, 600));
    if (!ctx.project.gameBlueprint) notes.push("청사진 없음 — 장소·경로·마감 단계가 돌지 않는다");
  } catch (e) { notes.push(`예외: ${(e as Error).stack?.slice(0, 400)}`); }
  const after = brief(ctx.project, task);
  const rec = { name, task, before, notes, after };
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(rec, null, 1));
  fs.writeFileSync(path.join(out, `${name}.project.json`), JSON.stringify(ctx.project));
  console.log(`\n### ${name}\n  전: 막힘 ${before.blockers.length} ${before.blockers.map((b) => b.slice(0, 120)).join(" | ")}\n      자동 ${before.auto}\n      청사진 ${before.bp.join(",") || "-"}\n      출하 ${before.ship.length} ${before.ship.join(",")}\n  끝맺음: ${notes.join("\n          ")}\n  후: 막힘 ${after.blockers.length} ${after.blockers.map((b) => b.slice(0, 160)).join(" | ")}\n      자동 ${after.auto}\n      청사진 ${after.bp.join(",") || "-"}\n      출하 ${after.ship.length} ${after.ship.join(",")}`);
}
