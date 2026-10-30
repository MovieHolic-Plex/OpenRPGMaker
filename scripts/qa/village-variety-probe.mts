// 마을 다양성 프로브 — 같은 요청을 make_place 처럼 salt 만 바꿔 세 번 짓고, 서로 얼마나 다른지 잴 재료를 남긴다(LLM 없이).
//   bun scripts/qa/village-variety-probe.mts [--out /tmp/vh/var] [--runs 3] [--only 1,3]
// 2026-10-29 맵 반복 조사(마을 24장 중 19장이 「세로 강+다리+가로 큰길」 한 구도) 뒤, 지형 먼저 마을이 요청마다·판마다 달라지는지 본다.
// 결과: <out>/<n>-<k>.png, <out>/fp.json(판마다 통행 격자·1층/2층 타일·찍은 키트) — 지문 비교는 suite/mapvqa/analyze.py 와 같은 잣대(통행 24×24·흑백 32×32·타일·키트 분포)로
//   /tmp/vh/variety.py 가 한다.
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { villageArgs } from "../../src/ai/v2/builders/village.ts";
import { isPassable } from "../../src/project/collision.ts";
import type { Project } from "../../src/project/types.ts";
import type { PlaceSpec } from "../../src/ai/v2/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/vh/var");
const RUNS = Number(arg("runs", "3"));
const only = arg("only", "").split(",").filter(Boolean).map(Number);
fs.mkdirSync(OUT, { recursive: true });

// village-height-first-ab.mts 와 같은 10요청(모델이 땅 설계로 고를 법한 landform 포함)
const CASES: { n: number; ask: string; spec: Partial<PlaceSpec>; landform: string; settle?: string }[] = [
  { n: 1, ask: "강가의 평범한 시골 마을", spec: { name: "버들 마을", theme: "river", size: "medium", hints: { water: "river" } }, landform: "terraces" },
  { n: 2, ask: "언덕 위에 자리 잡은 마을", spec: { name: "언덕 마을", theme: "river", features: ["hillside"], size: "medium", hints: { water: "none" } }, landform: "hill" },
  { n: 3, ask: "산골짜기 산촌", spec: { name: "산골 마을", theme: "river", features: ["highland", "scatter"], size: "small", hints: { water: "river" } }, landform: "slope" },
  { n: 4, ask: "작은 포구 어촌", spec: { name: "갈매기 포구", theme: "coast", size: "medium" }, landform: "terraces" },
  { n: 5, ask: "계단식 다랑이 마을", spec: { name: "다랑이 마을", theme: "river", features: ["terraces"], size: "large", hints: { water: "none" } }, landform: "terraces" },
  { n: 6, ask: "눈 덮인 산마을", spec: { name: "설산 마을", theme: "snow", features: ["hillside"], size: "medium" }, landform: "slope" },
  { n: 7, ask: "사막 오아시스 마을", spec: { name: "모래 우물", theme: "desert", size: "medium" }, landform: "hill" },
  { n: 8, ask: "늪지 수상 마을", spec: { name: "갈대 늪 마을", theme: "swamp", size: "medium" }, landform: "terraces" },
  { n: 9, ask: "광장이 있는 강가 장터 마을", spec: { name: "장터 마을", theme: "river", features: ["plaza"], size: "large", hints: { water: "river" } }, landform: "hill" },
  { n: 10, ask: "흩어진 농가가 있는 들판 마을(강 없음)", spec: { name: "들판 농가", theme: "river", features: ["scatter"], size: "small", hints: { water: "none" } }, landform: "terraces", settle: "low" },
];

const base = createBlankProject() as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const fp: Record<string, unknown>[] = [];
for (const c of CASES) {
  if (only.length && !only.includes(c.n)) continue;
  for (let k = 0; k < RUNS; k += 1) {
    // make_place 의 salt 처럼 판마다 새로(재현되게 요청 이름·판 번호 해시로)
    const salt = ([...`${c.spec.name}#${k}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261) % 1_000_000);
    const spec = { type: "village", ...c.spec, hints: { ...(c.spec.hints ?? {}), landform: c.landform, ...(c.settle ? { settle: c.settle } : {}) }, salt } as PlaceSpec;
    const { args } = villageArgs(spec);
    if (spec.salt !== undefined && (args.theme === undefined || args.theme === "river" || args.theme === "coast")) {
      if (args.terrain === undefined && salt % 3 === 0) args.terrain = "terraces";
      if (args.forestType === undefined) args.forestType = (["broadleaf", "conifer", "mixed"] as const)[Math.floor(salt / 3) % 3];
      if (args.width === undefined && args.height === undefined) { const [w, h] = ([[42, 34], [50, 32], [38, 40]] as const)[Math.floor(salt / 9) % 3]!; args.width = w; args.height = h + 8; }
    }
    const a = { ...args, seed: salt % 100000, id: `v${c.n}_${k}`, name: c.spec.name };
    const ctx = { project: JSON.parse(baseJson) as Project };
    const r = runTool(ctx, "author_beodeul_town", a as never);
    if (!r.ok) { console.log(c.n, k, "FAIL", r.summary.slice(0, 160)); continue; }
    const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
    fs.writeFileSync(`${OUT}/${c.n}-${k}.png`, renderMapPng(ctx.project, map).png);
    const pass: number[] = []; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) pass.push(isPassable(ctx.project, map, x, y) ? 1 : 0);
    fp.push({ n: c.n, k, ask: c.ask, salt, w: map.width, h: map.height, pass: pass.join(""), lower: map.lowerTiles, upper: map.upperTiles,
      kits: (map.structurePlacements ?? []).map((p: any) => p.kitId), landform: d.landform, settle: d.settle, tiers: d.tiers, high: d.high, houses: d.houses, anchors: d.anchors, gathering: d.gathering?.why, note: d.relief?.note ?? "" });
    console.log(`${c.n}-${k}`, map.width + "x" + map.height, d.landform, d.settle, d.high, "집", d.houses, "모이는 곳", d.gathering?.why, (d.anchors ?? []).join(","));
  }
}
fs.writeFileSync(`${OUT}/fp.json`, JSON.stringify(fp));
