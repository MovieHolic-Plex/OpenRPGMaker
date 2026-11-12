// 길망 행렬(모델 없음): 바깥 장소를 짓는 길마다 씨앗 N개로 지어 judge/roadNetwork 로 잰다 — 막다른 토막 · 출구 없는 가장자리 길 · 떨어진 길 조각.
//   ~/z-project/assistant-fable-runs/heavy-run.sh bun scripts/qa/assistant-v2/roadMatrix.mts <outDir> [--seeds 20] [--jobs 4] [--only <사례 id 앞머리,…>]
//   bun scripts/qa/assistant-v2/roadMatrix.mts <outDir> --table            # rows.jsonl → 표(table.md)
//   bun scripts/qa/assistant-v2/roadMatrix.mts <outDir> --png <사례 id> <씨앗 번호>   # 그 한 판을 1배 PNG 로(길 끝 표시 없음 — 그림은 눈으로 본다)
// 사례는 roadCases.ts. 결과는 <outDir>/rows.jsonl (한 판 한 줄). 무거운 재생이므로 heavy-run.sh 로 감싼다(--jobs ≤ 4).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { roadNetwork, type RoadNetwork } from "../../../src/ai/v2/judge/roadNetwork.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";
import { ROAD_CASES, type RoadCase } from "./roadCases.ts";

interface Row { case: string; group: string; n: number; seed: number; ok: boolean; note?: string; ms: number; maps: { id: string; name: string; w: number; h: number; net: RoadNetwork }[] }
const argv = process.argv.slice(2), out = argv[0] ?? "qa-runs/v2scratch/road-matrix";
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const seedOf = (n: number) => 1009 + n * 7919;
fs.mkdirSync(out, { recursive: true });

async function buildOne(c: RoadCase, n: number): Promise<{ row: Row; project: Project }> {
  const seed = seedOf(n), project = createBlankProject();
  if (c.kind === "place" && c.startTileset) project.maps[project.startMapId]!.tilesetId = c.startTileset;
  const before = new Set(Object.keys(project.maps));
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx), t0 = performance.now();
  let ok = false, note = "", ids: string[] = [];
  try {
    if (c.kind === "place") {
      const spec = { ...c.spec, salt: seed, ...(c.terrainSeed ? { hints: { ...(c.spec.hints ?? {}), terrainSeed: seed } } : {}) };
      const builder = builderFor(spec);
      if (!builder) note = "빌더 없음";
      else { await builder.prepare?.(spec); const res = builder.build(run, spec); ok = res.ok; ids = [...res.mapIds]; if (!res.ok) note = res.summary.slice(0, 200); }
    } else {
      const res = run.call(c.tool, { fromMapId: project.startMapId, ...c.args, seed });
      ok = res.ok; if (!res.ok) note = String(res.summary ?? "").slice(0, 200);
      ids = Object.keys(ctx.project.maps).filter((id) => !before.has(id));
    }
  } catch (e) { note = `ERR ${(e as Error).message.slice(0, 200)}`; }
  const maps = ok ? ids.flatMap((id) => { const m = ctx.project.maps[id] as GameMap | undefined; return m ? [{ id, name: m.name, w: m.width, h: m.height, net: roadNetwork(ctx.project, m) }] : []; }) : [];
  return { row: { case: c.id, group: c.group, n, seed, ok, ...(note ? { note } : {}), ms: Math.round(performance.now() - t0), maps }, project: ctx.project };
}

const cases = (() => { const only = flag("--only")?.split(","); return only ? ROAD_CASES.filter((c) => only.some((p) => c.id.startsWith(p))) : ROAD_CASES; })();
const seeds = Number(flag("--seeds") ?? 20);

if (argv.includes("--png")) {
  const i = argv.indexOf("--png"), c = ROAD_CASES.find((x) => x.id === argv[i + 1]), n = Number(argv[i + 2] ?? 0);
  if (!c) throw new Error(`사례 없음: ${argv[i + 1]}`);
  const { renderMapPng } = await import("../../qa-game/render.mts");
  const { row, project } = await buildOne(c, n);
  for (const m of row.maps) { const file = path.join(out, `${c.id}-${n}-${m.id}.png`); fs.writeFileSync(file, renderMapPng(project, project.maps[m.id]!).png); console.log(file, JSON.stringify({ deadEnds: m.net.deadEnds, edgeNoExit: m.net.edgeNoExit.map((e) => `${e.side}(${e.cells[0]!.x},${e.cells[0]!.y})×${e.cells.length}`), detached: m.net.detached })); }
  if (!row.ok) console.log("FAIL", row.note);
} else if (argv.includes("--table")) {
  const rows = fs.readFileSync(path.join(out, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
  const groups = new Map<string, Row[]>(); for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const lines = ["| 짓는 길 | 판 | 지음 | 길 있는 맵 | 막다른 토막(맵) | 그중 6걸음 이상 | 그중 맨땅에서 끝남 | 출구 없는 가장자리 길(맵) | 떨어진 길 조각(맵) |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
  const cell = (maps: Row["maps"], pick: (n: RoadNetwork) => number) => `${maps.reduce((s, m) => s + pick(m.net), 0)} (${maps.filter((m) => pick(m.net) > 0).length})`;
  const line = (label: string, rs: Row[]) => { const maps = rs.flatMap((r) => r.maps).filter((m) => m.net.cells > 0);
    return `| ${label} | ${rs.length} | ${rs.filter((r) => r.ok).length} | ${maps.length} | ${cell(maps, (n) => n.deadEnds.length)} | ${maps.reduce((s, m) => s + m.net.deadEnds.filter((d) => d.length >= 6).length, 0)} | ${maps.reduce((s, m) => s + m.net.deadEnds.filter((d) => d.into === "ground").length, 0)} | ${cell(maps, (n) => n.edgeNoExit.length)} | ${cell(maps, (n) => n.detached.length)} |`; };
  for (const [g, rs] of groups) lines.push(line(g, rs));
  lines.push(line("**모두**", rows));
  const byCase = ["", "| 사례 | 판 | 지음 | 막다른 토막(맵) | 출구 없는 가장자리 길(맵) | 떨어진 조각(맵) |", "|---|---:|---:|---:|---:|---:|"];
  const ids = [...new Set(rows.map((r) => r.case))];
  for (const id of ids) { const rs = rows.filter((r) => r.case === id), maps = rs.flatMap((r) => r.maps).filter((m) => m.net.cells > 0); byCase.push(`| ${id} | ${rs.length} | ${rs.filter((r) => r.ok).length} | ${cell(maps, (n) => n.deadEnds.length)} | ${cell(maps, (n) => n.edgeNoExit.length)} | ${cell(maps, (n) => n.detached.length)} |`); }
  fs.writeFileSync(path.join(out, "table.md"), [...lines, ...byCase, ""].join("\n"));
  console.log(lines.join("\n"));
  const fails = rows.filter((r) => !r.ok); if (fails.length) console.log(`\n못 지은 판 ${fails.length}: ${[...new Set(fails.map((r) => `${r.case}: ${r.note ?? ""}`))].slice(0, 12).join(" | ")}`);
} else if (flag("--shard")) {
  const [k, of] = flag("--shard")!.split("/").map(Number), file = path.join(out, `rows-${k}.jsonl`);
  let i = 0;
  for (const c of cases) for (let n = 0; n < seeds; n++) { if (i++ % of! !== k) continue; const { row } = await buildOne(c, n); fs.appendFileSync(file, JSON.stringify(row) + "\n"); }
} else {
  const jobs = Math.min(4, Math.max(1, Number(flag("--jobs") ?? 4)));
  for (const f of fs.readdirSync(out)) if (/^rows(-\d+)?\.jsonl$/u.test(f)) fs.rmSync(path.join(out, f));
  console.log(`사례 ${cases.length} × 씨앗 ${seeds} = ${cases.length * seeds}판 · 일꾼 ${jobs}`);
  const codes = await Promise.all(Array.from({ length: jobs }, (_, k) => new Promise<number>((done) => {
    const child = spawn(process.execPath, [process.argv[1]!, out, "--seeds", String(seeds), "--shard", `${k}/${jobs}`, ...(flag("--only") ? ["--only", flag("--only")!] : [])], { stdio: ["ignore", "ignore", "inherit"] });
    child.on("exit", (code) => done(code ?? 1));
  })));
  const all = Array.from({ length: jobs }, (_, k) => path.join(out, `rows-${k}.jsonl`)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8")).join("");
  fs.writeFileSync(path.join(out, "rows.jsonl"), all);
  console.log(`끝 — ${all.split("\n").filter(Boolean).length}판 · 일꾼 종료 코드 ${codes.join(",")} · 표: bun scripts/qa/assistant-v2/roadMatrix.mts ${out} --table`);
}
