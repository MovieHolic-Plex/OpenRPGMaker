/**
 * 폴른 스타 숲 땅 모양 미리보기 — 데모 전체를 굽지 않고 숲 맵 다섯 장만 빈 프로젝트에 칠해 저장한다(수 초).
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/fallen-woodland-preview.mts <out.project.json>
 *   bun scripts/qa-game/render.mts --project <out.project.json> --out <dir>
 * 통행 격자(# 막힘 · . 통행 · = 길 · ~ 물 · ? 첫 출구에서 닿지 않는 통행 칸)도 찍는다.
 */
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { isPassable } from "@/project/collision";
import { serialize } from "@/project/io";
import { FOREST_SPECS } from "@/project/flagship/fallen/forestSpecs";
import { paintWoodland } from "@/project/flagship/fallen/woodland";
import type { Project } from "@/project/types";

const out = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? "/tmp/fs-woodland.project.json";
const project: Project = createBlankProject();
ensureBundledTilesets(project as never);
const only = process.env.ONLY?.split(",");
for (const spec of FOREST_SPECS) {
  if (only && !only.includes(spec.id)) continue;
  const t0 = Date.now();
  const r = paintWoodland(project, spec);
  const map = project.maps[spec.id]!;
  const W = map.width, H = map.height;
  const e = spec.exits[0]!;
  const seen = new Set<number>([e.y * W + e.x]);
  const q = [e.y * W + e.x];
  while (q.length) { const c = q.pop()!; const x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx!, ny = y + dy!; const n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !isPassable(project, map, nx, ny)) continue; seen.add(n); q.push(n); } }
  console.log(`\n== ${spec.id} ${W}x${H} ${Date.now() - t0}ms pockets=${JSON.stringify(r.pockets)}`);
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) { const c = y * W + x; const p = isPassable(project, map, x, y); row += !p ? (r.water.has(c) ? "~" : "#") : !seen.has(c) ? "?" : r.path.has(c) ? "=" : "."; }
    console.log(String(y).padStart(2) + " " + row);
  }
}
for (const id of Object.keys(project.maps)) if (!id.startsWith("fs_forest")) delete project.maps[id];
project.startMapId = Object.keys(project.maps)[0]!;
writeFileSync(out, serialize(project));
