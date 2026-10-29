// 방탈출 바깥 출구 증명(모델 없음): 실제 조수 방탈출(밀실 남쪽 틈 → 시작 «빈 맵» 이동)에서
//  A) 지금 끝맺음 순서(retireBlankStart → sealEscapeExits → dressInteriorExits)가 걸어 나가는 길을 없애는지,
//  B) 시작 맵이 자리표시가 아닐 때(그림 한 칸 — 은퇴 대상 아님) 출하 검사 blueprint-escape-leak 가 잡고 build_blueprint_path 가 치우는지,
// 그리고 둘 다 자동 플레이가 여전히 엔딩(번호 입력)까지 가는지 본다.
//   bun scripts/qa/assistant-v2/escapeExitCheck.mts <run-dir> [outDir]
import fs from "node:fs";
import path from "node:path";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { walkBlueprint, escapeLeaks } from "../../../src/ai/v2/blueprint.ts";
import { buildBlueprintPath, sealEscapeExits } from "../../../src/ai/v2/blueprintPath.ts";
import { retireBlankStart } from "../../../src/ai/v2/blankStart.ts";
import { dressInteriorExits } from "../../../src/ai/v2/exitDress.ts";
import { runAutoPlay } from "../../../src/qa/gameCheck/autoPlay.ts";
import type { Project } from "../../../src/project/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const dir = process.argv[2]!;
const out = process.argv[3] ?? "qa-runs/v2scratch/escape-exit";
fs.mkdirSync(out, { recursive: true });
const load = (p: string): Project => { const j = JSON.parse(fs.readFileSync(path.join(dir, p), "utf8")); return (j.project ?? j) as Project; };
const exported = load("play/player.json");
const base = load("session/snapshots/003-before.json");
const project0 = { ...exported, tilesets: base.tilesets, assets: base.assets } as Project;
const room = Object.values(project0.maps).find((m) => m.name === "밀실")!.id;

function state(label: string, project: Project) {
  const leaks = escapeLeaks(project);
  const blockers = walkBlueprint(project).blockers;
  const play = runAutoPlay(project, { budgetMs: 20_000 }).runs[0];
  const exits = (project.maps[room]?.events ?? []).filter((e) => JSON.stringify(e.pages).includes('"kind":"transfer"')).map((e) => `${e.id}@(${e.x},${e.y})`);
  console.log(`== ${label}\n  바깥 이동 ${leaks.length}: ${leaks.map((l) => `${l.eventId} → ${l.toMapId}`).join(", ") || "없음"} · 밀실 이동 이벤트: ${exits.join(" ") || "없음"}\n  출하 검사 청사진 막힘: ${blockers.map((b) => b.id).join(", ") || "없음"}\n  시작: ${project.startMapId} (${project.startPos?.x},${project.startPos?.y}) · 맵: ${Object.keys(project.maps).join(", ")}\n  자동 플레이: ${play?.ok ? "성공" : "실패"} 엔딩=${play?.endingReached ?? "-"} · ${(play?.steps ?? []).map((s) => s.goal).join(" → ")}`);
}

// A) 끝맺음 마감 순서 그대로(verbs.ts session.clearLanes): 먼저 번호 단계 고치기(build_blueprint_path) 결과 위에서.
{
  const ctx: ToolContext = { project: structuredClone(project0), currentMapId: project0.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  state("A 전(실제 결과)", ctx.project);
  fs.writeFileSync(path.join(out, "A-before.png"), renderMapPng(ctx.project, ctx.project.maps[room]!).png);
  const notes = [...retireBlankStart(run), ...sealEscapeExits(run)];
  for (const id of Object.keys(ctx.project.maps)) notes.push(...dressInteriorExits(run, id).notes);
  const path1 = buildBlueprintPath(run);
  console.log(`-- 마감: ${notes.join(" / ")}\n-- build_blueprint_path(): ${path1.summary.slice(0, 300)}`);
  state("A 후", ctx.project);
  fs.writeFileSync(path.join(out, "A-after.png"), renderMapPng(ctx.project, ctx.project.maps[room]!).png);
}
// B) 시작 맵이 자리표시가 아니다(위층 그림 한 칸) — 은퇴가 못 치우는 바깥 맵.
{
  const p = structuredClone(project0);
  const outside = Object.values(p.maps).find((m) => m.id !== room)!;
  outside.upperTiles[0] = outside.lowerTiles[0]!;
  const ctx: ToolContext = { project: p, currentMapId: p.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  console.log(`\n-- B retireBlankStart: ${retireBlankStart(run).join(" / ") || "(치운 것 없음 — 자리표시 아님)"}`);
  state("B 전(바깥 맵이 자리표시 아님)", ctx.project);
  const res = buildBlueprintPath(run);
  console.log(`-- build_blueprint_path(): ${res.ok ? "ok" : "FAIL"} — ${res.summary.slice(0, 500)}`);
  state("B 후", ctx.project);
  fs.writeFileSync(path.join(out, "B-after.png"), renderMapPng(ctx.project, ctx.project.maps[room]!).png);
}
