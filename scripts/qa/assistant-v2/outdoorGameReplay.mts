// 야외 판 다시 짓기 + 끝까지 자동 플레이(모델 없음): 실제 조수 판(run-dir)의 청사진·자료집만 빈 프로젝트에 옮기고,
// 지금 코드의 끝맺음 자동 단계(runFinishAutoBuild — 청사진 장소 자동 짓기 → 경로 → 출구 마감 → 조립·출하 기본값)로 게임을 다시 지은 뒤
// 맵을 1배 PNG 로 찍고 자동 플레이(runGameCheck)로 엔딩까지 가는지 본다. Math.random 은 판마다 고정 씨앗이라 코드 전/후가 같은 무작위를 쓴다.
//   bun scripts/qa/assistant-v2/outdoorGameReplay.mts <outDir> <run-dir>...
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { runFinishAutoBuild } from "../../../src/ai/v2/finishAutoBuild.ts";
import { runGameCheck } from "../../../src/qa/gameCheck/index.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { Project } from "../../../src/project/types.ts";

const [out, ...dirs] = process.argv.slice(2);
if (!out || !dirs.length) throw new Error("outdoorGameReplay <outDir> <run-dir>...");
fs.mkdirSync(out, { recursive: true });
const realRandom = Math.random;

for (const dir of dirs) {
  const tag = dir.replace(/\/+$/, "").split("/").slice(-3).join("-");
  let s = [...tag].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const actual = readProjectSqlite(path.join(dir, "project"));
  const project: Project = createBlankProject();
  Object.assign(project, { gameBlueprint: structuredClone(actual.gameBlueprint), database: structuredClone(actual.database) });
  const task = fs.existsSync(path.join(dir, "steps.log")) ? (fs.readFileSync(path.join(dir, "steps.log"), "utf8").match(/sent 001\.txt: (.*)/u)?.[1] ?? "게임 만들어 줘") : "게임 만들어 줘";
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task, project, currentMapId: project.startMapId } as never, emit: () => {}, record: () => {}, sideChat: async () => { throw new Error("모델 없음"); }, checkpoint: async () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  createV2Tools(env, session);
  let note = "";
  try { note = (await runFinishAutoBuild(env, session)) ?? ""; } catch (e) { note = `예외: ${(e as Error).stack?.slice(0, 400)}`; }
  Math.random = realRandom;
  const p = ctx.project;
  const r = runGameCheck(p, { autoPlayBudgetMs: 30_000 });
  const run = r.autoPlay?.runs?.[0];
  const auto = run ? `${run.ok ? "성공" : "실패"} 엔딩=${run.endingReached ?? "-"}${run.failure ? ` · ${run.failure.goal}: ${run.failure.detail.slice(0, 200)}` : ""}` : (r.autoPlay?.skipped ?? "자동 플레이 없음");
  const files: string[] = [];
  for (const map of Object.values(p.maps)) {
    if (!map.events?.length && map.id !== p.startMapId) continue;
    const file = path.join(out, `${tag}-${(map.name ?? map.id).replace(/[^\p{L}\p{N}]+/gu, "_")}.png`);
    fs.writeFileSync(file, renderMapPng(p, map).png); files.push(path.basename(file));
  }
  fs.writeFileSync(path.join(out, `${tag}.project.json`), JSON.stringify(p));
  const rec = { tag, start: { mapId: p.startMapId, ...p.startPos }, startMap: p.maps[p.startMapId] ? `${p.maps[p.startMapId]!.name} ${p.maps[p.startMapId]!.width}×${p.maps[p.startMapId]!.height}` : "-", auto, blockers: r.findings.filter((f) => f.severity === "blocker").map((f) => f.code), files, note: note.split("\n").filter((l) => l.startsWith("- ")).join(" / ").slice(0, 500) };
  fs.writeFileSync(path.join(out, `${tag}.json`), JSON.stringify(rec, null, 1));
  console.log(JSON.stringify(rec));
}
