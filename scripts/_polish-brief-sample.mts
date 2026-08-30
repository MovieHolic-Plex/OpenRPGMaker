// scripts/_polish-brief-sample.mts
// 보고서용 텍스트 증거 — 다듬기가 모델에 실제로 보내는 메시지를 실제 프리셋 맵으로 한 번 찍는다.
// 출력: reports/region-polish/polish-message.txt (+ 요약 통계는 stdout).
import fs from "node:fs";
import path from "node:path";
import { analyzeRegionSurroundings, formatRegionSurroundingsBrief } from "@/editor/regionTask/regionSurroundings";
import { buildRegionPolishMessage } from "@/editor/regionTask/regionPolish";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

const MAP_ID = "m_report";
const W = 24;
const H = 18;
const REGION = { x: 8, y: 6, width: 8, height: 6 };

const context = { project: createBlankProject() };
const created = runTool(context, "create_map", { id: MAP_ID, name: "보고서 샘플 마을", width: W, height: H });
if (!created.ok) throw new Error(created.summary);

const project: Project = context.project;
const map = project.maps[MAP_ID];
const at = (x: number, y: number): number => y * W + x;

// 잔디 바탕 + 왼쪽 호수 + 영역으로 들어오는 흙길 + 위쪽 숲 — "주변" 이 실제로 존재하는 장면.
map.lowerTiles.fill(TILE.GRASS);
for (let y = 0; y < H; y += 1) for (let x = 0; x < 6; x += 1) map.lowerTiles[at(x, y)] = TILE.WATER;
for (let x = 3; x < W; x += 1) map.lowerTiles[at(x, REGION.y + 2)] = TILE.PATH;
for (let x = 7; x < 18; x += 1) map.upperTiles[at(x, 4)] = TILE.TREE;
map.events = [
  { id: "ev_shop", name: "잡화점 주인", x: 6, y: 9, trigger: { kind: "action" }, commands: [] },
  { id: "ev_guard", name: "문지기", x: 18, y: 8, trigger: { kind: "action" }, commands: [] },
  { id: "ev_chest", name: "보물상자", x: 10, y: 8, trigger: { kind: "action" }, commands: [] },
] as never;

const surroundings = analyzeRegionSurroundings(project, MAP_ID as never, REGION);
if (!surroundings) throw new Error("주변 분석 실패");

const message = buildRegionPolishMessage({
  instruction: POLISH_INSTRUCTION,
  mapName: map.name,
  mapId: MAP_ID as never,
  region: REGION,
  surroundings,
  materialHint: "",
});

const outDir = path.resolve("reports/region-polish");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "polish-message.txt"), `${message}\n`, "utf8");
fs.writeFileSync(
  path.join(outDir, "polish-brief.txt"),
  `${formatRegionSurroundingsBrief(surroundings)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  messageChars: message.length,
  messageLines: message.split("\n").length,
  briefChars: formatRegionSurroundingsBrief(surroundings).length,
  crossings: surroundings.crossings.length,
  entrances: surroundings.entrances.length,
  insideEvents: surroundings.insideEvents.length,
  neighborEvents: surroundings.neighborEvents.length,
}, null, 2));
