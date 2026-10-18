// jp_city 거리 구성기 프로브 — bun scripts/qa/jp-street-probe.mts [--out output/evidence/jp-street] [--seeds 6] [--style shopping]
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { planJpCityStreet, runJpStreetPlan } from "../../src/project/jpCityStreetComposer.ts";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps.ts";
import type { Project } from "../../src/project/types.ts";
import { measureLotEmptiness } from "./jpLotEmptiness.mts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "output/evidence/jp-street"); fs.mkdirSync(OUT, { recursive: true });
for (let seed = Number(arg("from", "1")); seed <= Number(arg("seeds", "6")); seed++) {
  const p = createNewProjectSeed("adventure-jrpg", "t") as Project; ensureBundledTilesets(p);
  const ctx = { project: p };
  const W = Number(arg("w", "52")), H = Number(arg("h", "34"));
  const id = p.startMapId;
  { const m = p.maps[id]!, kit = p.tilesets.jp_city!; m.tilesetId = kit.id; m.tileSize = kit.tileSize; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); }
  runTool(ctx, "resize_map", { mapId: id, width: W, height: H }); { const kit = p.tilesets.jp_city!; p.maps[id]!.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); }
  const plan = planJpCityStreet({ mapId: id, width: W, height: H, seed, style: arg("style", "shopping") as "shopping", shops: seed % 2 ? ["konbini", "ramen"] : ["cafe", "izakaya"] });
  const errs: string[] = [];
  const skipRe = process.env.SKIP ? new RegExp(process.env.SKIP) : undefined;
  const r = runJpStreetPlan(plan, (tool, args) => { if (skipRe && skipRe.test(String(args.objectId ?? ""))) return; const res = runTool(ctx, tool, args); if (!res.ok) { errs.push(`${tool}: ${res.summary.slice(0, 120)}`); throw new Error(res.summary); } return (res as { data?: unknown }).data as never; }, process.env.NOLOT ? undefined : () => ({ map: ctx.project.maps[id]!, tileset: ctx.project.tilesets.jp_city! }));
  { const m = ctx.project.maps[id]!; let n = 0; for (let y = 14; y < 18; y++) for (let x = 0; x < W; x++) if ((m.upperTiles[y * W + x] ?? -1) >= 0) n++; if (process.env.V) console.log("upper cells in road", n); }
  if (process.env.DUMPX) { const m = ctx.project.maps[id]!; const x = Number(process.env.DUMPX); for (let y = 12; y < 26; y++) console.log(y, m.lowerTiles[y * W + x], m.upperTiles[y * W + x]); }
  // 시작 위치 표시(초록 네모)는 렌더 도구가 그리는 표지이지 타일이 아니다 — 검수 그림에서는 기본으로 끈다(MARK=1 로 켠다). 2026-10-18 사용자가 도로 위 초록 네모를 타일 결함으로 읽었다.
  fs.writeFileSync(`${OUT}/street-${seed}.png`, renderMapPng(process.env.MARK ? ctx.project : { ...ctx.project, startMapId: "__none__" }, ctx.project.maps[id]!).png);
  { const m = ctx.project.maps[id]!; const e = measureLotEmptiness(ctx.project, m); console.log(`empty ${seed} ${(e.ratio * 100).toFixed(1)}% (${e.empty}/${e.lot})`); fs.writeFileSync(`${OUT}/street-${seed}.map.json`, JSON.stringify({ width: m.width, height: m.height, tilesetId: m.tilesetId, lowerTiles: m.lowerTiles, upperTiles: m.upperTiles, upperOverlayTiles: m.upperOverlayTiles, lowerOverlayTiles: m.lowerOverlayTiles })); fs.writeFileSync(`${OUT}/street-${seed}.empty.json`, JSON.stringify({ w: m.width, h: m.height, ratio: e.ratio, empty: e.empty, lot: e.lot, mask: Array.from(e.mask) })); }
  console.log(seed, plan.summary, JSON.stringify(r)); if (process.env.V) console.log(errs.slice(0, 8).join("\n"));
}
