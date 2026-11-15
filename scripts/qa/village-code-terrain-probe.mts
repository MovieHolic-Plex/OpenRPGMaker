// 코드 지형 마을 프로브 — 10요청을 코드 지형(자동 배치 또는 --layouts json, village-model-layout.mts 출력)으로 짓고 렌더·지표. 사용: bun scripts/qa/village-code-terrain-probe.mts --out <dir> [--only 1,3] [--salt N] [--layouts f] [--key 게임열쇠] [--dry] [--cliff earth|strata|rubble|ledge|crag|rock]
// --dry: 그림(png)과 프로젝트 사본(project.json, 판마다 80MB)을 쓰지 않는다 — 숫자(report.json · data.json)만 남긴다.
// --key: 그 게임 열쇠의 겉모습(집 벌·바닥·숲)으로 짓는다(조수 실행과 같은 길). 판마다 <n>-C.data.json 을 남긴다(village-yard-measure.mts 가 읽는다).
// --cliff: 게임 겉모습의 절벽 모습만 미리 적고 짓는다(다른 갈래는 원래 모습) — 단 높이·절벽 줄 굽이가 닿는 곳·길을 깨지 않는지 보는 데 쓴다.
import fs from "node:fs";
import { renderMapPng } from "../../scripts/qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import { villageArgs } from "../../src/ai/v2/place/builders/village.ts";
import { longestTierEdgeRuns } from "../../src/editor/tools/beodeulTerrainGen.ts";
import { tilesetLookTableFor } from "../../src/assets/tilesetLooks.ts";
const CASES: any[] = [
  { n: 1, ask: "강가의 평범한 시골 마을", spec: { name: "버들 마을", theme: "river", size: "medium" }, seed: 7 },
  { n: 2, ask: "언덕 위에 자리 잡은 마을", spec: { name: "언덕 마을", theme: "river", features: ["hillside"], size: "medium" }, landform: "hill", seed: 11 },
  { n: 3, ask: "산골짜기 산촌", spec: { name: "산골 마을", theme: "river", features: ["highland", "scatter"], size: "small" }, landform: "slope", seed: 23 },
  { n: 4, ask: "작은 포구 어촌", spec: { name: "갈매기 포구", theme: "coast", size: "medium" }, seed: 5 },
  { n: 5, ask: "계단식 다랑이 마을", spec: { name: "다랑이 마을", theme: "river", features: ["terraces"], size: "large" }, landform: "terraces", seed: 31 },
  { n: 6, ask: "눈 덮인 산마을", spec: { name: "설산 마을", theme: "snow", features: ["hillside"], size: "medium" }, landform: "slope", seed: 13 },
  { n: 7, ask: "사막 오아시스 마을", spec: { name: "모래 우물", theme: "desert", size: "medium" }, landform: "hill", seed: 17 },
  { n: 8, ask: "늪지 수상 마을", spec: { name: "갈대 늪 마을", theme: "swamp", size: "medium" }, seed: 19 },
  { n: 9, ask: "광장이 있는 강가 장터 마을", spec: { name: "장터 마을", theme: "river", features: ["plaza"], size: "large" }, seed: 41 },
  { n: 10, ask: "흩어진 농가가 있는 들판 마을(강 없음)", spec: { name: "들판 농가", theme: "river", features: ["scatter", "no river"], size: "small" }, settle: "low", seed: 3 },
];
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/vh/code1"); fs.mkdirSync(OUT, { recursive: true });
const only = arg("only", "").split(",").filter(Boolean).map(Number);
const layouts = arg("layouts", "") ? JSON.parse(fs.readFileSync(arg("layouts", ""), "utf8")) : {};
const salt = Number(arg("salt", "0"));
const key = arg("key", "");
const dry = process.argv.includes("--dry");
const cliff = arg("cliff", "");
// --habit step,lone,straight: 그 절벽 모습의 습관만 이 실행에서 바꿔 본다(단 높이와 굽이의 영향을 따로 재는 데 쓴다)
const habit = arg("habit", "").split(",").filter(Boolean).map(Number);
if (cliff && habit.length === 3) { const option = (tilesetLookTableFor("beodeul_city")!.parts.cliff!.options as Record<string, Record<string, unknown>>)[cliff]!; option.step = habit[0]; option.lone = habit[1]; if (habit[2]) option.straight = habit[2]; else delete option.straight; }

const base = createBlankProject() as any; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const rows: any[] = [];
for (const c of CASES) {
  if (only.length && !only.includes(c.n)) continue;
  const { args: a0 } = villageArgs({ type: "village", ...c.spec } as any);
  const args: any = { ...a0, ...(c.landform ? { landform: c.landform } : {}), seed: c.seed + salt, id: `v${c.n}C`, name: c.spec.name, ...(layouts[c.n] ? { layout: layouts[c.n].layout, terrainSeed: layouts[c.n].terrainSeed, width: layouts[c.n].width, height: layouts[c.n].height } : {}) };
  const ctx = { project: JSON.parse(baseJson), ...(key ? { assistantRun: true, lookKey: key } : {}) };
  if (cliff) ctx.project.tilesets.beodeul_city.look = { textureKey: tilesetLookTableFor("beodeul_city")!.texture, cliff };
  const t0 = Date.now();
  const r = runTool(ctx as any, "author_beodeul_town", args);
  if (!r.ok) { console.log(c.n, "FAIL", r.summary); rows.push({ n: c.n, ok: false, summary: r.summary }); continue; }
  const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
  if (!dry) {
    fs.writeFileSync(`${OUT}/${c.n}-C.png`, renderMapPng(ctx.project, map).png);
    fs.writeFileSync(`${OUT}/${c.n}-C.project.json`, JSON.stringify({ project: ctx.project, mapId: d.mapId }));
  }
  fs.writeFileSync(`${OUT}/${c.n}-C.data.json`, JSON.stringify({ n: c.n, ask: c.ask, data: d })); // village-yard-measure.mts 가 읽는다(문 앞·모이는 곳·마당)
  const cf = analyzeCityForm(ctx.project, map);
  const doors = (d.doors ?? []) as { reached: boolean }[];
  const lr = (d.levelReach ?? {}) as Record<string, any>;
  const runs = map.relief ? longestTierEdgeRuns(map.relief.levels, map.width, map.height) : { south: 0, side: 0 };
  const row = { n: c.n, ms: Date.now() - t0, size: `${map.width}x${map.height}`, houses: d.houses, anchors: d.anchors, unreached: doors.filter((x) => !x.reached).length, doors: doors.length,
    dead: cf.deadEnds.filter((x: any) => x.kind === "cell").length, runSouth: runs.south, runSide: runs.side, style: map.relief?.style ?? null, ramps: d.relief?.ramps, rfail: d.relief?.fails, levels: d.relief?.levels,
    upMiss: Object.values(lr).reduce((s: number, e: any) => s + (e.walk - e.reached), 0), upWild: Object.values(lr).reduce((s: number, e: any) => s + (e.wild ?? 0), 0), hillBehind: d.hillBehind ? { raised: d.hillBehind.raised, open: d.hillBehind.open, road: d.hillBehind.road, sample: d.hillBehind.sample } : null,
    forest: d.nature?.forestCells ?? 0, fields: d.fields ?? 0, landPlots: d.landPlots ?? 0, emptyScreens: d.emptyScreens ?? null,
    layout: d.layout ? { auto: d.layout.auto, moved: d.layout.moved, failed: d.layout.failed, roadsFailed: d.layout.roadsFailed } : null, terrainSeed: d.terrainSeed, note: d.codeTerrain?.note, summary: r.summary, warnings: (r as any).diff?.warnings ?? (r as any).warnings ?? [] };
  rows.push(row); console.log(c.n, JSON.stringify(row).slice(0, 600));
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
