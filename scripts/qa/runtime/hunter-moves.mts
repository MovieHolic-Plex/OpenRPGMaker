// hunter-a.play.mjs 용 — 맵마다 칸별 이동 가능 방향(런타임 canMove 그대로)을 JSON 으로 뽑는다. 이벤트는 빼고 타일·높이만.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/hunter-moves.mts <project.json> <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import { canMove } from "@/project/collision";
import { deserialize } from "@/project/io";
const [src, dst] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(src!, "utf8"));
const project = deserialize(JSON.stringify(raw.project ?? raw));
const out: Record<string, string> = {};
for (const map of Object.values(project.maps)) {
  let s = "";
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    let m = 0;
    if (canMove(project, map, x, y, x, y - 1)) m |= 1;
    if (canMove(project, map, x, y, x, y + 1)) m |= 2;
    if (canMove(project, map, x, y, x - 1, y)) m |= 4;
    if (canMove(project, map, x, y, x + 1, y)) m |= 8;
    s += m.toString(16);
  }
  out[map.id] = s;
}
writeFileSync(dst!, JSON.stringify(out));
console.log("moves", Object.keys(out).join(","));
