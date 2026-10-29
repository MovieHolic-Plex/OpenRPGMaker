// 마을 「높이 먼저」 A/B 프로브 — 같은 요청을 현행(A)·높이 먼저(B)로 LLM 없이 짓고 렌더·기계 지표를 남긴다.
//   bun scripts/qa/village-height-first-ab.mts [--out /tmp/vh/ab] [--only 1,3]
// A 인자 = 조수 v2 마을 빌더의 villageArgs(명세 낱말 → 도구 인자) 그대로. B = A + landform·settle(요청 낱말에서 모델이 고를 법한 것).
// 결과: <out>/<n>-A.png·<n>-B.png, <out>/report.json(집·문 도달·막다른 칸·단 도달·경사로 실패·경고).
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import { villageArgs } from "../../src/ai/v2/builders/village.ts";
import type { Project } from "../../src/project/types.ts";
import type { PlaceSpec } from "../../src/ai/v2/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/vh/ab");
const only = arg("only", "").split(",").filter(Boolean).map(Number);
fs.mkdirSync(OUT, { recursive: true });

interface Case { n: number; ask: string; spec: Partial<PlaceSpec>; landform: string; settle?: string; seed: number }
export const CASES: Case[] = [
  { n: 1, ask: "강가의 평범한 시골 마을", spec: { name: "버들 마을", theme: "river", size: "medium" }, landform: "terraces", seed: 7 },
  { n: 2, ask: "언덕 위에 자리 잡은 마을", spec: { name: "언덕 마을", theme: "river", features: ["hillside"], size: "medium" }, landform: "hill", seed: 11 },
  { n: 3, ask: "산골짜기 산촌", spec: { name: "산골 마을", theme: "river", features: ["highland", "scatter"], size: "small" }, landform: "slope", seed: 23 },
  { n: 4, ask: "작은 포구 어촌", spec: { name: "갈매기 포구", theme: "coast", size: "medium" }, landform: "terraces", seed: 5 },
  { n: 5, ask: "계단식 다랑이 마을", spec: { name: "다랑이 마을", theme: "river", features: ["terraces"], size: "large" }, landform: "terraces", seed: 31 },
  { n: 6, ask: "눈 덮인 산마을", spec: { name: "설산 마을", theme: "snow", features: ["hillside"], size: "medium" }, landform: "slope", seed: 13 },
  { n: 7, ask: "사막 오아시스 마을", spec: { name: "모래 우물", theme: "desert", size: "medium" }, landform: "hill", seed: 17 },
  { n: 8, ask: "늪지 수상 마을", spec: { name: "갈대 늪 마을", theme: "swamp", size: "medium" }, landform: "terraces", seed: 19 },
  { n: 9, ask: "광장이 있는 강가 장터 마을", spec: { name: "장터 마을", theme: "river", features: ["plaza"], size: "large" }, landform: "hill", seed: 41 },
  { n: 10, ask: "흩어진 농가가 있는 들판 마을(강 없음)", spec: { name: "들판 농가", theme: "river", features: ["scatter", "no river"], size: "small" }, landform: "terraces", settle: "low", seed: 3 },
];

const base = createBlankProject() as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const rows: Record<string, unknown>[] = [];
for (const c of CASES) {
  if (only.length && !only.includes(c.n)) continue;
  const { args: a0 } = villageArgs({ type: "village", ...c.spec } as PlaceSpec);
  for (const side of ["A", "B"] as const) {
    const args: Record<string, unknown> = { ...a0, seed: c.seed, id: `v${c.n}${side}`, name: c.spec.name };
    if (side === "B") { args.landform = c.landform; if (c.settle) args.settle = c.settle; }
    const ctx = { project: JSON.parse(baseJson) as Project };
    const t0 = Date.now();
    const r = runTool(ctx, "author_beodeul_town", args as never);
    const name = `${c.n}-${side}`;
    if (!r.ok) { rows.push({ n: c.n, side, ask: c.ask, ok: false, summary: r.summary }); console.log(name, "FAIL", r.summary); continue; }
    const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
    const png = renderMapPng(ctx.project, map).png;
    fs.writeFileSync(`${OUT}/${name}.png`, png);
    fs.writeFileSync(`${OUT}/${name}.project.json`, JSON.stringify({ project: ctx.project, mapId: d.mapId }));
    const cf = analyzeCityForm(ctx.project, map);
    const doors = (d.doors ?? []) as { reached: boolean }[];
    const lr = (d.levelReach ?? {}) as Record<string, { walk: number; reached: number }>;
    const upMiss = Object.values(lr).reduce((s, e) => s + (e.walk - e.reached), 0);
    const gates = (d.fenceGates ?? []) as { reached: boolean }[];
    const warnings = ((r as any).diff?.warnings ?? (r as any).warnings ?? []) as string[];
    const levels = d.relief?.levels as Record<string, number> | undefined;
    const row = {
      n: c.n, side, ask: c.ask, args, ok: true, ms: Date.now() - t0, size: `${map.width}x${map.height}`, form: d.form, terrain: d.terrain, landform: d.landform ?? null,
      houses: d.houses, distinct: d.distinctHouses, doors: doors.length, unreachedDoors: doors.filter((x) => !x.reached).length,
      deadCells: cf.deadEnds.filter((x) => x.kind === "cell").length, deadStreets: cf.deadEnds.filter((x) => x.kind === "street").length,
      longest: cf.lines.longestLen, isolated: cf.graph.isolated.length,
      levels, levelCount: levels ? Object.keys(levels).filter((k) => (levels[k] ?? 0) > 0).length : 1,
      ramps: d.relief?.ramps ?? 0, rampFails: d.relief?.fails ?? 0, cuts: d.relief?.cuts ?? 0, straddle: d.relief?.straddle ?? 0, roadOnRim: d.relief?.roadOnRim ?? 0, lowered: d.relief?.lowered ?? 0,
      upMiss, gateMiss: gates.filter((g) => !g.reached).length, stampFailed: d.stampFailed, trees: d.trees, fields: d.fields,
      note: d.relief?.note ?? "", warnings, summary: r.summary,
    };
    rows.push(row);
    console.log(name, JSON.stringify({ ms: row.ms, houses: row.houses, unreached: row.unreachedDoors, dead: row.deadCells, deadSt: row.deadStreets, lv: row.levels, ramps: row.ramps, rfail: row.rampFails, upMiss, gateMiss: row.gateMiss, fail: row.stampFailed, warn: warnings.length, note: row.note }));
  }
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
