// 맵 그림 1배(모델 없음): project.json 또는 run-dir(project.sqlite) 의 맵을 PNG 로 찍는다 — 빌더 수정 전/후 비교용.
//   bun scripts/qa/assistant-v2/renderMaps.mts <project.json|run-dir> <outPrefix> [맵 이름 일부...]
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { renderMapPng } from "../../qa-game/render.mts";
import type { Project } from "../../../src/project/types.ts";

const [input, prefix, ...names] = process.argv.slice(2);
if (!input || !prefix) throw new Error("renderMaps <project.json|run-dir> <outPrefix> [맵 이름 일부...]");
const project: Project = input.endsWith(".json") ? JSON.parse(fs.readFileSync(input, "utf8")) : readProjectSqlite(path.join(input, "project"));
fs.mkdirSync(path.dirname(prefix), { recursive: true });
for (const map of Object.values(project.maps)) {
  if (names.length && !names.some((name) => (map.name ?? map.id).includes(name))) continue;
  const file = `${prefix}-${(map.name ?? map.id).replace(/[^\p{L}\p{N}]+/gu, "_")}-${map.id.slice(-6)}.png`;
  fs.writeFileSync(file, renderMapPng(project, map).png);
  console.log(`${file} ${map.width}x${map.height} 이벤트 ${(map.events ?? []).length} 시작=${project.startMapId === map.id}`);
}
