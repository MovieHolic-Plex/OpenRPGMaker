/**
 * author_snow_route 미리보기 — 빈 프로젝트의 시작 맵 북쪽에 설원 길 두 장(얼음 틈 둘)을 짓고 저장한다.
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/snow-route-preview.mts <out.project.json>
 *   bun scripts/qa-game/render.mts --project <out.project.json> --out <dir>
 * 통행 격자(# 막힘 · . 통행 · = 틈 띠 · F/T 틈 앞뒤 착지 · ? 입구에서 닿지 않는 통행 칸)도 찍는다.
 */
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { isPassable } from "@/project/collision";
import { serialize } from "@/project/io";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project } from "@/project/types";

const out = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? "/tmp/snow-route.project.json";
let project: Project = createBlankProject();
ensureBundledTilesets(project as never);
const ctx = { project, assistantRun: false };
const t0 = Date.now();
const res = runTool(ctx, "author_snow_route", { fromMapId: project.startMapId, side: "north", count: 2, moods: ["snow", "blizzard"], gapCount: 2, seed: Number(process.env.SEED ?? 5) }, { dryRun: false });
project = ctx.project;
console.log(res.ok, res.summary, `${Date.now() - t0}ms`, JSON.stringify((res as { warnings?: unknown }).warnings ?? []));
if (!res.ok) process.exit(1);
const maps = (res.data as { maps: Array<{ mapId: string; entry: { x: number; y: number }; gaps: Array<{ cells: { x: number; y: number }[]; from: { x: number; y: number }; to: { x: number; y: number }; seals: boolean }> }> }).maps;
for (const m of maps) {
  const map = project.maps[m.mapId]!;
  const W = map.width, H = map.height;
  const band = new Set(m.gaps.flatMap((g) => g.cells.map((c) => c.y * W + c.x)));
  const land = new Map<number, string>();
  for (const g of m.gaps) { land.set(g.from.y * W + g.from.x, "F"); land.set(g.to.y * W + g.to.x, "T"); }
  const s = m.entry.y * W + m.entry.x;
  const seen = new Set<number>([s]); const q = [s];
  while (q.length) { const c = q.pop()!; const x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx!, ny = y + dy!, n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !isPassable(project, map, nx, ny)) continue; seen.add(n); q.push(n); } }
  console.log(`\n== ${m.mapId} ${W}x${H} gaps=${JSON.stringify(m.gaps.map((g) => ({ from: g.from, to: g.to, seals: g.seals, n: g.cells.length })))}`);
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) { const c = y * W + x; row += land.get(c) ?? (band.has(c) ? "=" : !isPassable(project, map, x, y) ? "#" : seen.has(c) ? "." : "?"); }
    console.log(String(y).padStart(2) + " " + row);
  }
}
writeFileSync(out, serialize(project));
