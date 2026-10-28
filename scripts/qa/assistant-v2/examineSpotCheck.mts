// 그림 없는 조사 칸 증명(모델 없음): 실제 조수 방탈출 맵의 투명 조사 칸(빈 바닥 위)에 settleExamineSpot 를 돌려
// 옆 가구로 붙는지·소품이 서는지·발밑으로 내려가는지, 그리고 그 칸이 더는 보이지 않는 벽이 아닌지 본다.
//   bun scripts/qa/assistant-v2/examineSpotCheck.mts <run-dir> <mapId> [outDir]
import fs from "node:fs";
import path from "node:path";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { examineHint, settleExamineSpot } from "../../../src/ai/v2/examineSpot.ts";
import { eventBlocks } from "../../../src/ai/v2/eventReach.ts";
import { isPassable } from "../../../src/project/collision.ts";
import type { Project } from "../../../src/project/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const [dir, mapId] = [process.argv[2]!, process.argv[3]!];
const out = process.argv[4] ?? "qa-runs/v2scratch/examine-spot";
fs.mkdirSync(out, { recursive: true });
const load = (p: string): Project => { const j = JSON.parse(fs.readFileSync(path.join(dir, p), "utf8")); return (j.project ?? j) as Project; };
const exported = load("play/player.json");
const base = load("session/snapshots/003-before.json");
const project = { ...exported, tilesets: base.tilesets, assets: base.assets } as Project;
const roleOf = (ev: { pages?: unknown[] }) => JSON.stringify(ev.pages ?? []).includes('"inputNumber"') || JSON.stringify(ev.pages ?? []).includes('"choices"') ? "code" : JSON.stringify(ev.pages ?? []).includes('"triggerEnding"') ? "ending" : "clue";
const describe = (p: Project) => p.maps[mapId]!.events.map((e) => {
  const map = p.maps[mapId]!;
  const wall = eventBlocks(e) && isPassable(p, map, e.x, e.y) && !((map.upperTiles[e.y * map.width + e.x] ?? -1) >= 0);
  return `${e.name ?? e.id}@(${e.x},${e.y}) prio=${e.pages?.[0]?.priority}${wall ? " ← 빈 바닥 투명 벽" : ""}`;
}).join("\n   ");
fs.writeFileSync(path.join(out, "before.png"), renderMapPng(project, project.maps[mapId]!).png);
console.log(`== 전\n   ${describe(project)}`);
const ctx: ToolContext = { project, currentMapId: mapId, assistantRun: true };
const run = createBuildRun(ctx);
for (const ev of project.maps[mapId]!.events.filter((e) => e.id.startsWith("ev_chain_") && !e.id.startsWith("ev_chain_seal_"))) {
  const notes = settleExamineSpot(run, mapId, ev.id, examineHint(roleOf(ev)));
  console.log(`-- ${ev.name}: ${notes.join(" / ") || "(그대로)"}`);
}
fs.writeFileSync(path.join(out, "after.png"), renderMapPng(ctx.project, ctx.project.maps[mapId]!).png);
fs.writeFileSync(path.join(out, "after-project.json"), JSON.stringify(ctx.project));
console.log(`== 후\n   ${describe(ctx.project)}`);
