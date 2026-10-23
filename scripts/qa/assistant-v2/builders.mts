// 조수 v2 빌더 증명(모델 없음): 명세 → 결정론 빌더 → 1배 PNG·결과 JSON.
//   bun scripts/qa/assistant-v2/builders.mts <outDir> [caseId...]
// 사례는 scripts/qa/assistant-v2/builderCases.ts 의 BUILDER_CASES. 빌더는 src/ai/v2/builders/index.ts 의 PLACE_BUILDERS 에서 고른다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/builders/index.ts";
import { BUILDER_CASES } from "./builderCases.ts";
import { measureInteriorBareFloor } from "../../../src/editor/handInterior/bareFloor.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const out = process.argv[2] ?? "qa-runs/v2scratch/builders";
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
for (const c of BUILDER_CASES) {
  if (only.length && !only.includes(c.id)) continue;
  const project = createBlankProject();
  if (c.startTileset) project.maps[project.startMapId]!.tilesetId = c.startTileset;
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  for (const step of c.before ?? []) run.call(step.tool, step.args);
  const t0 = performance.now();
  try {
    const builder = builderFor(c.spec);
    if (!builder) { console.log(`== ${c.id} NO BUILDER`); continue; }
    await builder.prepare?.(c.spec);
    const res = builder.build(run, c.spec);
    const ms = Math.round(performance.now() - t0);
    for (const id of res.mapIds) { const m = ctx.project.maps[id]; if (m) { fs.writeFileSync(path.join(out, `${c.id}-${id}.png`), renderMapPng(ctx.project, m).png); const b = measureInteriorBareFloor(ctx.project, m); if (b) console.log(`  bare ${id.slice(0, 12)} ${b.pct}% ${b.regions.slice(0, 4).map((r) => `(${r.x},${r.y}) ${r.w}x${r.h}`).join(" ")}`); } }
    fs.writeFileSync(path.join(out, `${c.id}.json`), JSON.stringify({ spec: c.spec, result: { ...res, state: undefined }, calls: run.calls.map((x) => ({ tool: x.tool, ok: x.ok, summary: x.summary, args: x.args })) }, null, 1));
    console.log(`== ${c.id} ${res.ok ? "ok" : "FAIL"} ${ms}ms maps=${res.mapIds.join(",")} — ${res.summary.slice(0, 200)}`);
    if (res.warnings.length) console.log("  warn:", res.warnings.join(" | ").slice(0, 400));
    if (res.missingArt.length) console.log("  missing:", res.missingArt.join(", "));
  } catch (e) { console.log(`== ${c.id} ERR`, (e as Error).stack?.slice(0, 600)); }
}
