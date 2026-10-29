// 코드 지형 마을 프로브 — 10요청을 코드 지형(자동 배치 또는 --layouts json, village-model-layout.mts 출력)으로 짓고 렌더·지표. 사용: bun scripts/qa/village-code-terrain-probe.mts --out <dir> [--only 1,3] [--salt N] [--layouts f]
import fs from "node:fs";
import { renderMapPng } from "../../scripts/qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import { villageArgs } from "../../src/ai/v2/builders/village.ts";
const CASES: any[] = [
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
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/vh/code1"); fs.mkdirSync(OUT, { recursive: true });
const only = arg("only", "").split(",").filter(Boolean).map(Number);
const layouts = arg("layouts", "") ? JSON.parse(fs.readFileSync(arg("layouts", ""), "utf8")) : {};
const salt = Number(arg("salt", "0"));

const base = createBlankProject() as any; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const rows: any[] = [];
for (const c of CASES) {
  if (only.length && !only.includes(c.n)) continue;
  const { args: a0 } = villageArgs({ type: "village", ...c.spec } as any);
  const args: any = { ...a0, landform: c.landform, seed: c.seed + salt, id: `v${c.n}C`, name: c.spec.name, ...(layouts[c.n] ? { layout: layouts[c.n].layout, terrainSeed: layouts[c.n].terrainSeed, width: layouts[c.n].width, height: layouts[c.n].height } : {}) };
  const ctx = { project: JSON.parse(baseJson) };
  const t0 = Date.now();
  const r = runTool(ctx as any, "author_beodeul_town", args);
  if (!r.ok) { console.log(c.n, "FAIL", r.summary); rows.push({ n: c.n, ok: false, summary: r.summary }); continue; }
  const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
  fs.writeFileSync(`${OUT}/${c.n}-C.png`, renderMapPng(ctx.project, map).png);
  fs.writeFileSync(`${OUT}/${c.n}-C.project.json`, JSON.stringify({ project: ctx.project, mapId: d.mapId }));
  const cf = analyzeCityForm(ctx.project, map);
  const doors = (d.doors ?? []) as { reached: boolean }[];
  const lr = (d.levelReach ?? {}) as Record<string, any>;
  const row = { n: c.n, ms: Date.now() - t0, size: `${map.width}x${map.height}`, houses: d.houses, anchors: d.anchors, unreached: doors.filter((x) => !x.reached).length, doors: doors.length,
    dead: cf.deadEnds.filter((x: any) => x.kind === "cell").length, ramps: d.relief?.ramps, rfail: d.relief?.fails, levels: d.relief?.levels,
    upMiss: Object.values(lr).reduce((s: number, e: any) => s + (e.walk - e.reached), 0), upWild: Object.values(lr).reduce((s: number, e: any) => s + (e.wild ?? 0), 0),
    layout: d.layout ? { auto: d.layout.auto, moved: d.layout.moved, failed: d.layout.failed, roadsFailed: d.layout.roadsFailed } : null, terrainSeed: d.terrainSeed, note: d.codeTerrain?.note, warnings: (r as any).warnings ?? [] };
  rows.push(row); console.log(c.n, JSON.stringify(row).slice(0, 600));
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
