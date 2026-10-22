// 던전 VQA 보조(2026-10-23): 조수 시도 폴더(live.json)의 바뀐 맵마다 공간 측정(space.mts)을 space.json 으로 쓴다.
//   bun scripts/qa/dungeons/space-run.mts <run-dir> [...]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { measureSpace } from "./space.mts";

const load = (p: string) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : JSON.parse(zlib.gunzipSync(fs.readFileSync(p + ".gz")).toString("utf8"));
for (const run of process.argv.slice(2)) {
  const live = load(path.join(run, "live.json"));
  const before = load(path.join(run, "before.json"));
  const out: Record<string, unknown> = {};
  for (const [id, m] of Object.entries<any>(live.maps)) {
    const b = before.maps?.[id];
    if (b && JSON.stringify([b.lowerTiles, b.events]) === JSON.stringify([m.lowerTiles, m.events])) continue;
    try { out[id] = { name: m.name, ...measureSpace(live, m) }; } catch (e) { out[id] = { error: String(e) }; }
  }
  fs.writeFileSync(path.join(run, "space.json"), JSON.stringify(out, null, 1));
  console.log(path.basename(run), Object.entries(out).map(([id, v]: [string, any]) => `${v.name} ${v.w}x${v.h} void ${v.voidPct}% screen≤${v.worstScreenVoidPct}% bare ${v.bareFloorPct}%`).join(" | "));
}
