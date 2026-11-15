// jp_city 거리 측정 — 거리 종류·씨앗·크기마다 건물 반복, 소품 종류, 도로 몫, 죽은 띠, 빈 창, 차를 센다(모델 없음).
//   bun scripts/qa/jp-street-measure.mts --out <폴더> [--styles shopping,residential,shitamachi,shotengai] [--seeds 1-6] [--sizes 60x48,52x34]
//        [--regions station_plaza,torii_shrine_precinct] [--key <게임 열쇠>] [--png] [--shard i/n]
// 지도에서만 센다(구성기 기록 없이): 키트를 층 2~4 의 칸 무늬로 찾아 소품·건물 개수를 낸다 — 조수가 손으로 지은 지도에도 같은 잣대다.
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps.ts";
import { measureJpStreet, type JpStreetMeasure } from "./jpStreetMeasure.mts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const has = (n: string) => process.argv.includes(`--${n}`);
const OUT = arg("out", "output/evidence/jp-street-measure"); fs.mkdirSync(OUT, { recursive: true });
const styles = arg("styles", "shopping,residential,shitamachi,shotengai").split(",").filter(Boolean);
const [s0, s1] = arg("seeds", "1-6").split("-").map(Number);
const sizes = arg("sizes", "60x48,52x34").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const regions = arg("regions", "").split(",").filter(Boolean);
const key = arg("key", "");
const [shardI, shardN] = arg("shard", "0/1").split("/").map(Number);

interface Row extends JpStreetMeasure { readonly label: string; readonly style: string; readonly seed: number; readonly w: number; readonly h: number; readonly ok: boolean; readonly summary: string; readonly ms: number }
const rows: Row[] = [];
const jobs: { label: string; style: string; seed: number; w: number; h: number; region?: string }[] = [];
for (const [w, h] of sizes) for (const style of styles) for (let seed = s0!; seed <= (s1 ?? s0!); seed++) jobs.push({ label: `${style}-${w}x${h}-${seed}`, style, seed, w: w!, h: h! });
for (const region of regions) for (let seed = s0!; seed <= Math.min(s1 ?? s0!, s0! + 1); seed++) jobs.push({ label: `region-${region}-${seed}`, style: `region:${region}`, seed, w: 0, h: 0, region });

const base = createNewProjectSeed("adventure-jrpg", "t") as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
jobs.forEach((job, index) => {
  if (index % shardN! !== shardI) return;
  const t0 = Date.now();
  const p = JSON.parse(baseJson) as Project;
  const ctx = { project: p, ...(key ? { assistantRun: true, lookKey: key } : {}) } as { project: Project };
  const id = p.startMapId;
  let W = job.w, H = job.h;
  if (job.region) {
    const sz = (runTool(ctx, "list_jp_regions", {}) as { data?: { regions?: { id: string; size: [number, number] }[] } }).data?.regions?.find((r) => r.id === job.region)?.size;
    W = sz?.[0] ?? 60; H = sz?.[1] ?? 44;
  }
  { const m = p.maps[id]!, kit = p.tilesets.jp_city!; m.tilesetId = kit.id; m.tileSize = kit.tileSize; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); m.events = []; }
  runTool(ctx, "resize_map", { mapId: id, width: W, height: H });
  { const kit = ctx.project.tilesets.jp_city!; const m = ctx.project.maps[id]!; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); m.upperTiles.fill(-1); }
  const res = (job.region
    ? runTool(ctx, "compose_jp_region", { mapId: id, region: job.region, seed: job.seed, replace: true })
    : runTool(ctx, "compose_jp_city_street", { mapId: id, seed: job.seed, style: job.style, replace: true })) as { ok: boolean; summary: string };
  const map = ctx.project.maps[id]!;
  const m = measureJpStreet(ctx.project, map);
  if (has("doors")) for (const l of map.locations ?? []) if ((l.note ?? "").includes("닿지 않음")) console.log("  닿지 않는 문:", l.name, l.x, l.y, l.w, l.h, (l.note ?? "").slice(0, 60));
  const png = has("png") || has("colour") ? renderMapPng({ ...ctx.project, startMapId: "__none__" }, map).png : undefined;
  if (png && has("png")) fs.writeFileSync(`${OUT}/${job.label}.png`, png);
  rows.push({ label: job.label, style: job.style, seed: job.seed, w: W, h: H, ok: res.ok, summary: res.summary.slice(0, 400), ms: Date.now() - t0, ...m });
  console.log(`${job.label} ${res.ok ? "ok" : "FAIL " + res.summary.slice(0, 160)} 건물 ${m.buildings} 종류 ${m.distinctLooks} 최대반복 ${m.maxRepeat}(${m.maxRepeatLook}) 소품 ${m.props}/${m.distinctProps}종 도로 ${(m.roadShare * 100).toFixed(1)}% 죽은띠 ${(m.deadBandShare * 100).toFixed(1)}% 빈창 ${m.emptyWindows} 빈8×6 ${(m.emptySmallWindows * 100).toFixed(1)}% 차 ${m.cars} 닿지않는문 ${m.unreachableDoors} ${Date.now() - t0}ms`);
});
fs.writeFileSync(`${OUT}/rows${shardN! > 1 ? `-${shardI}` : ""}.json`, JSON.stringify(rows, null, 1));
