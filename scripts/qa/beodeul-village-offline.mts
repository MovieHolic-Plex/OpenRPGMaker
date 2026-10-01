// author_beodeul_town 마을 문법(theme ≠ city) 오프라인 검증 — LLM 없이 도구를 직접 돌려 PNG·지표를 남긴다.
//   bun scripts/qa/beodeul-village-offline.mts [--2x] [theme:seed[:WxH] ...]   (기본: river·desert·swamp × seed 3·11·29)
// 출력: verify-shots/assistant-beodeul-village/offline-village/<theme>-<seed>/{render-1x.png,summary.json} (--2x 면 render-2x.png 도 — 커밋하지 않는다)
import fs from "node:fs";
import { createBlankProject } from "../../src/project/defaults.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { emptinessOf } from "../content/lib/beodeul-metrics.ts";

const twoX = process.argv.includes("--2x");
const args = process.argv.slice(2).filter((a) => a !== "--2x");
const specs = args.length ? args
  : ["river", "desert", "swamp"].flatMap((t) => [3, 11, 29].map((s) => `${t}:${s}`));
const rows: unknown[] = [];
for (const spec of specs) {
  const [theme, seedS, size] = spec.split(":");
  const [w, h] = size ? size.split("x").map(Number) : [undefined, undefined];
  const p: any = createBlankProject(); ensureBundledTilesets(p);
  const ctx: any = { project: p };
  const t0 = Date.now();
  const r: any = runTool(ctx, "author_beodeul_town", { theme, seed: Number(seedS ?? 7), ...(w ? { width: w, height: h } : {}) });
  if (!r.ok) { console.log(spec, "FAIL", r.summary); continue; }
  const map = ctx.project.maps[r.data.mapId];
  const em: any = emptinessOf(map, ctx.project.tilesets.beodeul_city);
  const cf: any = runTool(ctx, "check_city_form", { mapId: map.id });
  const dir = `verify-shots/assistant-beodeul-village/offline-village/${theme}-${seedS ?? 7}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/render-1x.png`, renderMapPng(ctx.project, map, 1).png);
  if (twoX) fs.writeFileSync(`${dir}/render-2x.png`, renderMapPng(ctx.project, map, 2).png);
  const doors = r.data.doors as { reached: boolean }[];
  const out = { spec, ms: Date.now() - t0, size: `${map.width}x${map.height}`, summary: r.summary, warnings: r.warnings,
    houses: r.data.houses, distinct: r.data.distinctHouses, doors: `${doors.filter((d) => d.reached).length}/${doors.length}`, stampFailed: r.data.stampFailed,
    open: { share: em.open.share, worst: em.open.worst, over40: em.open.over40 },
    cityForm: { ok: cf.data?.ok, counts: cf.data?.counts, advice: (cf.data?.advice ?? []).slice(0, 8) } };
  fs.writeFileSync(`${dir}/summary.json`, JSON.stringify(out, null, 1));
  rows.push(out);
  console.log(JSON.stringify({ spec, size: out.size, houses: out.houses, distinct: out.distinct, doors: out.doors, fail: out.stampFailed, open: out.open, cf: out.cityForm.ok, adv: (out.cityForm.advice as unknown[]).length, warn: out.warnings }).slice(0, 600));
}
