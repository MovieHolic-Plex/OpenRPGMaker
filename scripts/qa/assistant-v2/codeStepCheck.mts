// 번호·암호 청사진 단계 증명(모델 없음): 실제 조수 게임 사본에 출하 검사(walkBlueprint)와 build_blueprint_path 를 다시 돌리고
// 자동 플레이가 번호 입력을 거쳐야만 엔딩에 가는지 본다.
//   bun scripts/qa/assistant-v2/codeStepCheck.mts <run-dir> [outDir]
// run-dir = ~/z-project/assistant-whole-game/suite/runs/<묶음>/<모델>/<장르> (play/player.json · session/snapshots/003-before.json · session/turns/003.json)
import fs from "node:fs";
import path from "node:path";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { walkBlueprint } from "../../../src/ai/v2/blueprint.ts";
import { buildBlueprintPath, type PathStepText } from "../../../src/ai/v2/blueprintPath.ts";
import { runAutoPlay } from "../../../src/qa/gameCheck/autoPlay.ts";
import type { Project } from "../../../src/project/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const dir = process.argv[2]!;
const out = process.argv[3] ?? "qa-runs/v2scratch/code-step";
fs.mkdirSync(out, { recursive: true });
const load = (p: string): Project => { const j = JSON.parse(fs.readFileSync(path.join(dir, p), "utf8")); return (j.project ?? j) as Project; };

function report(label: string, project: Project) {
  const walk = walkBlueprint(project);
  console.log(`\n== ${label}`);
  console.log(`  출하 검사 청사진 막힘 ${walk.blockers.length}: ${walk.blockers.map((b) => `[${b.id}] ${b.message.slice(0, 220)}`).join("\n    ") || "없음"}`);
  const play = runAutoPlay(project, { budgetMs: 20_000 });
  for (const r of play.runs) {
    const kinds = r.steps.map((s) => `${s.goal}: ${s.detail.slice(0, 90)}`).join(" → ");
    console.log(`  자동 플레이 ${r.label}: ${r.ok ? "성공" : "실패"} 엔딩=${r.endingReached ?? "-"} · ${kinds.slice(0, 500)}`);
  }
  return { walk, play };
}
const summarizeEvents = (project: Project) => {
  for (const m of Object.values(project.maps)) for (const e of m.events ?? []) {
    if (!/ev_chain|ev_objective/u.test(e.id)) continue;
    console.log(`  EV ${e.id} 「${e.name}」 (${e.x},${e.y})`);
    for (const p of e.pages ?? []) console.log(`    조건 ${JSON.stringify(p.conditions)} · ${JSON.stringify(p.commands).slice(0, 260)}`);
  }
};

// 1) 실제 결과(고치기 전 빌더가 지은 것) — 새 출하 검사가 잡나.
// player.json 은 칩셋 통행·이름표를 뺀 내보내기라, 칩셋·에셋은 같은 게임 스냅숏(003-before)에서 채운다.
const exported = load("play/player.json");
const base = load("session/snapshots/003-before.json");
const final = { ...exported, tilesets: base.tilesets, assets: base.assets } as Project;
const a = report("실제 결과(play/player.json)", final);
fs.writeFileSync(path.join(out, "before.json"), JSON.stringify({ blockers: a.walk.blockers, play: a.play.runs.map((r) => ({ ok: r.ok, endingReached: r.endingReached, steps: r.steps.map((s) => `${s.goal}: ${s.detail}`) })) }, null, 1));

// 2) 같은 결과에 build_blueprint_path(인자 없음)를 다시 부른다 — 출하 검사가 돌려보낸 뒤 조수가 부르는 고치기.
{
  const ctx: ToolContext = { project: structuredClone(final), currentMapId: final.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const res = buildBlueprintPath(run);
  console.log(`\n-- 고치기 build_blueprint_path(): ${res.ok ? "ok" : "FAIL"} — ${res.summary.slice(0, 400)}`);
  if (res.warnings.length) console.log("  warn:", res.warnings.join(" | ").slice(0, 400));
  summarizeEvents(ctx.project);
  const b = report("고친 뒤(재빌드)", ctx.project);
  fs.writeFileSync(path.join(out, "after-rebuild.json"), JSON.stringify({ summary: res.summary, blockers: b.walk.blockers, play: b.play.runs.map((r) => ({ ok: r.ok, endingReached: r.endingReached, steps: r.steps.map((s) => `${s.goal}: ${s.detail}`) })) }, null, 1));
  for (const id of res.mapIds) { const m = ctx.project.maps[id]; if (m) fs.writeFileSync(path.join(out, `after-rebuild-${id}.png`), renderMapPng(ctx.project, m).png); }
}

// 3) 그 턴 그대로: 003-before 에 조수가 준 인자로 build_blueprint_path.
const turnFile = path.join(dir, "session/turns/003.json");
if (fs.existsSync(path.join(dir, "session/snapshots/003-before.json")) && fs.existsSync(turnFile)) {
  const before = load("session/snapshots/003-before.json");
  const args = (JSON.parse(fs.readFileSync(turnFile, "utf8")).toolArgs as { name: string; args: { steps?: PathStepText[] } }[]).find((t) => t.name === "build_blueprint_path")?.args ?? {};
  const ctx: ToolContext = { project: structuredClone(before), currentMapId: before.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const res = buildBlueprintPath(run, args.steps ?? []);
  console.log(`\n-- 턴 003 재현 build_blueprint_path(${JSON.stringify(args).slice(0, 160)}): ${res.ok ? "ok" : "FAIL"} — ${res.summary.slice(0, 400)}`);
  if (res.warnings.length) console.log("  warn:", res.warnings.join(" | ").slice(0, 400));
  summarizeEvents(ctx.project);
  const c = report("턴 003 재현 뒤", ctx.project);
  fs.writeFileSync(path.join(out, "after-turn003.json"), JSON.stringify({ summary: res.summary, blockers: c.walk.blockers, play: c.play.runs.map((r) => ({ ok: r.ok, endingReached: r.endingReached, steps: r.steps.map((s) => `${s.goal}: ${s.detail}`) })) }, null, 1));
  for (const id of res.mapIds) { const m = ctx.project.maps[id]; if (m) fs.writeFileSync(path.join(out, `after-turn003-${id}.png`), renderMapPng(ctx.project, m).png); }
}
