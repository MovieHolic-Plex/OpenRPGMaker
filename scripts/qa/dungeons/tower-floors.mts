// 탑 층 나란히(2026-10-31 fs2 B10 「1~4층이 같은 둥근 계단방」) — author_dungeon 탑을 지어 층마다 PNG 를 그리고 한 장으로 붙인다.
//   bun scripts/qa/dungeons/tower-floors.mts <outDir> '<json args>'
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../../src/project/genrePresets.ts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { store } from "../../../src/project/store.ts";

const [out = "/tmp/tower-floors", raw = "{}"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const project = createBlankProject();
applyGenrePreset(project, "adventure-jrpg");
store.loadProject?.(project);
const args = { type: "tower", adapter: "beodeul", genre: "rpg", name: "하늘탑", floors: 4, direction: "up", populate: false, ...JSON.parse(raw) };
const res = getTool("author_dungeon")!.run(project, args) as { summary: string; data: { floors: string[] } };
const dd = res.data as Record<string, unknown>; console.log("links", JSON.stringify(dd.links), "warnings", JSON.stringify(dd.warnings));
for (const [i, id] of res.data.floors.entries()) {
  const map = project.maps[id]!;
  fs.writeFileSync(path.join(out, `f${i + 1}.png`), renderMapPng(project, map).png);
  console.log("floor", i + 1, id, `${map.width}x${map.height}`);
}
