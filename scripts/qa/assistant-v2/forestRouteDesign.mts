/**
 * author_forest_route 설계·씨앗 시험(모델 없음). 빈 프로젝트에서 같은 인자 세 번(설계 없음)과 설계 셋을 짓고
 * 통행 격자·막다른 끝 도달·이전 숲길과 같은 설계 경고를 찍고 프로젝트를 저장한다(그림은 scripts/qa-game/render.mts).
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/qa/assistant-v2/forestRouteDesign.mts <out dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { isPassable } from "@/project/collision";
import { serialize } from "@/project/io";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project } from "@/project/types";

const OUT = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? "/tmp/forest-route-design";
mkdirSync(OUT, { recursive: true });
// 씬 벤치 opus 숲길 3판이 보낸 인자 그대로(sc-1030s-b3 r1).
const OPUS = { side: "north", count: 1, linkFrom: false, names: ["어스름 숲길"], moods: ["dim"], hiddenPerMap: 1 };
const DESIGNS = [
  { bends: 2, sway: "gentle", entryAt: 0.2, width: "wide", branches: [{ at: 0.4, toward: "right", length: 0.7, end: "chest" }], clearings: [{ at: 0.75, size: "large", toward: "left" }] },
  { bends: 5, sway: "wide", entryAt: 0.8, width: "narrow", branches: [{ at: 0.3, toward: "left", length: 0.5, end: "chest" }, { at: 0.65, toward: "right", length: 0.4, end: "nothing" }] },
  { bends: 3, sway: "normal", entryAt: 0.5, branches: [{ at: 0.55, toward: "left", length: 0.9, end: "clearing" }], clearings: [{ at: 0.25, size: "small", toward: "right" }] },
];
function grid(project: Project, mapId: string, entry: { x: number; y: number }, marks: Map<number, string>): { txt: string; reach: Set<number>; pass: string } {
  const map = project.maps[mapId]!; const W = map.width, H = map.height;
  const s = entry.y * W + entry.x; const seen = new Set<number>([s]); const q = [s];
  while (q.length) { const c = q.pop()!; const x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx!, ny = y + dy!, n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !isPassable(project, map, nx, ny)) continue; seen.add(n); q.push(n); } }
  let txt = ""; let pass = "";
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { const c = y * W + x; const p = isPassable(project, map, x, y); pass += p ? "1" : "0"; txt += marks.get(c) ?? (!p ? "#" : seen.has(c) ? "." : "?"); } txt += "\n"; }
  return { txt, reach: seen, pass };
}
const rows: unknown[] = [];
function build(label: string, args: Record<string, unknown>, project = createBlankProject()): Project {
  ensureBundledTilesets(project as never);
  const ctx = { project, assistantRun: true };
  const res = runTool(ctx, "author_forest_route", { fromMapId: project.startMapId, ...args }, { dryRun: false });
  if (!res.ok) { console.log(label, "실패", res.summary); process.exit(1); }
  const maps = (res.data as { maps: Array<{ mapId: string; entry: { x: number; y: number }; deadEnds?: { at: { x: number; y: number }; end: string }[]; design?: string; clearing: { x: number; y: number } }> }).maps;
  for (const m of maps) {
    const W = ctx.project.maps[m.mapId]!.width;
    const marks = new Map<number, string>((m.deadEnds ?? []).map((d) => [d.at.y * W + d.at.x, "D"]));
    marks.set(m.clearing.y * W + m.clearing.x, "C");
    const g = grid(ctx.project, m.mapId, m.entry, marks);
    const deadReach = (m.deadEnds ?? []).map((d) => g.reach.has(d.at.y * W + d.at.x));
    rows.push({ label, mapId: m.mapId, summary: res.summary, design: m.design, deadEnds: m.deadEnds, deadReach, clearingReach: g.reach.has(m.clearing.y * W + m.clearing.x), warnings: ((res as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).filter((w) => !w.startsWith("게임 시작")), pass: g.pass });
    console.log(`\n== ${label} ${m.mapId} ${res.summary}\n${m.design ?? "(설계 없음)"} 막다른 끝 닿음 ${JSON.stringify(deadReach)}\n경고 ${JSON.stringify(((res as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).filter((w) => !w.startsWith("게임 시작")) ?? [])}\n${g.txt}`);
  }
  return ctx.project;
}
for (let r = 1; r <= 3; r += 1) writeFileSync(`${OUT}/same${r}.project.json`, serialize(build(`same${r}`, OPUS)));
DESIGNS.forEach((d, i) => writeFileSync(`${OUT}/design${i + 1}.project.json`, serialize(build(`design${i + 1}`, { ...OPUS, designs: [d] }))));
// 같은 프로젝트에 같은 설계 두 번 → 「앞서 지은 숲길과 거의 같다」 경고.
{ const p = build("twinA", { ...OPUS, designs: [DESIGNS[0]] }); build("twinB", { ...OPUS, names: ["둘째 숲길"], designs: [DESIGNS[0]] }, p); }
// 대본 고정 씨앗(act2Opening 과 같은 seed 211·field·count 2) — 설계 없음 틀 그대로인지 해시로 본다.
build("flagship211", { side: "north", count: 2, linkFrom: false, terrain: "field", seed: 211 });
writeFileSync(`${OUT}/rows.json`, JSON.stringify(rows, null, 1));
