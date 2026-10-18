// 일본 지역 30종 프로브 — bun scripts/qa/jp-region-probe.mts [--out output/evidence/jp-region] [--seed 1] [--only onsen_ryokan_town,station_plaza]
// 지역마다 jp_city 맵을 권장 크기로 만들어 compose_jp_region 으로 짓고 PNG·요약 JSON 을 쓴다.
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps.ts";
import { JP_REGIONS } from "../../src/editor/jpCity/japaneseRegionsCatalog.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "output/evidence/jp-region"); fs.mkdirSync(OUT, { recursive: true });
const seed = Number(arg("seed", "1"));
const only = arg("only", "").split(",").filter(Boolean);
const rows: unknown[] = [];
for (const region of JP_REGIONS) {
  if (only.length && !only.includes(region.id)) continue;
  const p = createNewProjectSeed("adventure-jrpg", "t") as Project; ensureBundledTilesets(p);
  const ctx = { project: p };
  const id = p.startMapId;
  const [W, H] = region.size;
  { const m = p.maps[id]!, kit = p.tilesets.jp_city!; m.tilesetId = kit.id; m.tileSize = kit.tileSize; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); }
  runTool(ctx, "resize_map", { mapId: id, width: W, height: H }); { const kit = p.tilesets.jp_city!; p.maps[id]!.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); }
  const res = runTool(ctx, "compose_jp_region", { mapId: id, region: region.id, seed, replace: true }) as { ok: boolean; summary: string; warnings?: string[]; data?: Record<string, unknown> };
  const m = ctx.project.maps[id]!;
  fs.writeFileSync(`${OUT}/${String(region.no).padStart(2, "0")}-${region.id}.png`, renderMapPng({ ...ctx.project, startMapId: "__none__" }, m).png);
  const violations = Array.isArray(res.data?.violations) ? (res.data.violations as string[]) : [];
  const s4 = (res.data?.section4 as Record<string, number> | undefined) ?? { v1Failures: 0, whitelistViolations: 0, signatureClones: 0, adjacentClones: 0, strayTrees: 0, stairEndpoints: 0 };
  rows.push({ no: region.no, id: region.id, ok: res.ok && violations.length === 0, w: W, h: H, stamped: res.data?.stamped ?? res.data?.built, unplaced: res.data?.unplaced, failed: res.data?.failed, violations, ...s4, section4: s4, warnings: res.warnings, summary: res.summary.slice(0, 160) });
  console.log(region.no, region.id, res.ok && violations.length === 0 ? "ok" : "FAIL", `stamped:${res.data?.stamped ?? res.data?.built ?? ""}`, `violations:${violations.length}`, violations.length ? violations.join("; ") : "");
}
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(rows, null, 1));
