// author_beodeul_town 오프라인 검증: 여러 크기·시드로 돌려 빈 바닥·문 앞 통행·도시 형태 검사·블록 반복을 잰다.
//   bun scripts/qa/beodeul-town-offline.mts [WxH[:seed[:harbour]] ...]   (기본: 40x30 60x60 100x100:3 100x100:9:h)
// 출력: verify-shots/assistant-beodeul-village/offline/<WxH-seed>/{render.png,summary.json}
import fs from "node:fs";
import { createBlankProject } from "../../src/project/defaults.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { analyzeBeodeul, emptinessOf } from "../content/lib/beodeul-metrics.ts";

const specs = process.argv.slice(2).length ? process.argv.slice(2) : ["40x30", "60x60", "100x100:3", "100x100:9:h"];
for (const spec of specs) {
  const [size, seedS, h] = spec.split(":");
  const [w, hh] = size!.split("x").map(Number);
  const p: any = createBlankProject(); ensureBundledTilesets(p);
  const ctx: any = { project: p };
  const t0 = Date.now();
  const r: any = runTool(ctx, "author_beodeul_town", { width: w, height: hh, seed: seedS ? Number(seedS) : 7, harbour: h === "h" });
  if (!r.ok) { console.log(spec, "FAIL", r.summary); continue; }
  const mapId = r.data.mapId; const map = ctx.project.maps[mapId];
  const stamps = [...r.data.blocks, ...(r.data.harbour ? [r.data.harbour] : [])].map((b: any) => ({ objectId: `kit:beodeul_city/${b.id}`, x: b.x, y: b.y }));
  const m: any = analyzeBeodeul(ctx.project, mapId, stamps);
  const em: any = emptinessOf(map, ctx.project.tilesets.beodeul_city);
  const cf: any = runTool(ctx, "check_city_form", { mapId });
  const dir = `verify-shots/assistant-beodeul-village/offline/${w}x${hh}-${seedS ?? 7}${h ? "h" : ""}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/render.png`, renderMapPng(ctx.project, map, 1).png);
  const out = { spec, ms: Date.now() - t0, size: `${map.width}x${map.height}`, blocks: r.data.blocks.length, summary: r.summary, warnings: r.warnings,
    metrics: { blank: m.blank ?? m.emptyRatio, streetReach: m.streetReach && { reached: m.streetReach.reached, total: m.streetReach.total, unreached: m.streetReach.unreached?.slice(0, 6) }, sameKitRepeats: m.sameKitRepeats, defects: Object.fromEntries(Object.entries(m.defects ?? {}).map(([k, v]) => [k, (v as unknown[]).length])) },
    emptiness: em, cityForm: { ok: cf.ok, summary: String(cf.summary).slice(0, 400) } };
  fs.writeFileSync(`${dir}/summary.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out).slice(0, 1500));
}
