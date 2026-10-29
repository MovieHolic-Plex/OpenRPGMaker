// 칸막이 방 통로 문틀 증명(모델 없음): 저장된 조수 게임 프로젝트(JSON)의 실내 맵에 dressInteriorExits 를 돌려
// 통로에 둥근 아치 문틀이 걸리는지, 자동 플레이가 그대로 엔딩까지 가는지 본다. 전/후 1배 PNG.
//   bun scripts/qa/assistant-v2/doorwayArchCheck.mts <project.json> <맵 이름> <outPrefix> [x0,y0,x1,y1 잘라 보기]
import fs from "node:fs";
import { PNG } from "pngjs";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { dressInteriorExits } from "../../../src/ai/v2/exitDress.ts";
import { runAutoPlay } from "../../../src/qa/gameCheck/autoPlay.ts";
import type { Project } from "../../../src/project/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const [file, name, prefix, crop] = process.argv.slice(2) as [string, string, string, string | undefined];
const project = JSON.parse(fs.readFileSync(file, "utf8")) as Project;
const map = Object.values(project.maps).find((m) => m.name === name)!;
const cut = (png: Buffer): Buffer => {
  if (!crop) return png;
  const [x0, y0, x1, y1] = crop.split(",").map(Number) as [number, number, number, number];
  const src = PNG.sync.read(png), out = new PNG({ width: (x1 - x0 + 1) * 16, height: (y1 - y0 + 1) * 16 });
  PNG.bitblt(src, out, x0 * 16, y0 * 16, out.width, out.height, 0, 0);
  return PNG.sync.write(out);
};
fs.writeFileSync(`${prefix}-before.png`, cut(renderMapPng(project, map).png));
const ctx = { project: structuredClone(project), currentMapId: map.id, assistantRun: true };
const run = createBuildRun(ctx);
const res = dressInteriorExits(run, map.id);
fs.writeFileSync(`${prefix}-after.png`, cut(renderMapPng(ctx.project, ctx.project.maps[map.id]!).png));
const before = runAutoPlay(project, { budgetMs: 30000 }).runs[0], after = runAutoPlay(ctx.project, { budgetMs: 30000 }).runs[0];
console.log(`${name}: ${res.notes.join(" / ") || "(변화 없음)"}\n  자동 플레이 전 ${before?.ok ? "성공" : "실패"} ${before?.endingReached ?? ""} → 후 ${after?.ok ? "성공" : "실패"} ${after?.endingReached ?? ""}`);
