// 폴른 스타 1막 맵 PNG — 구운 project.json 에서 맵 몇 장을 그린다(이벤트는 표식).
//   bun scripts/qa/fallen-act1-render.mts <project.json> <outDir> <mapId,...> [scale]
import fs from "node:fs";
import path from "node:path";
import { renderMapPng } from "../qa-game/render.mts";
import { loadProjectFile } from "../qa-game/check.mts";
import { isPassable } from "@/project/collision";

const [file, out, ids, scale] = process.argv.slice(2);
const { project } = loadProjectFile(file!);
fs.mkdirSync(out!, { recursive: true });
for (const id of ids!.split(",")) {
  const map = project.maps[id];
  if (!map) { console.error("no map", id); continue; }
  const { png, note } = renderMapPng(project, map, Number(scale ?? 1));
  fs.writeFileSync(path.join(out!, `${id}.png`), png);
  const rows: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    let r = "";
    for (let x = 0; x < map.width; x += 1) r += isPassable(project, map, x, y) ? "." : "#";
    rows.push(`${String(y).padStart(2)} ${r}`);
  }
  fs.writeFileSync(path.join(out!, `${id}.pass.txt`), rows.join("\n"));
  console.log(id, map.width, map.height, note ?? "");
}
